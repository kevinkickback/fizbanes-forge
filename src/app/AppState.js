/**
 * Central application state singleton that emits change events.
 *
 * Uses Immer for immutable state updates. All state modifications go through
 * setState() or specialized setters which use Immer's produce() internally.
 * This eliminates accidental mutation bugs while allowing intuitive "mutative" syntax.
 */

import { produce, setAutoFreeze } from 'immer';
import { eventBus, EVENTS } from '../lib/EventBus.js';

// Disable auto-freeze because we store class instances (Character) in state
// that have methods and need to remain mutable for their internal operations
setAutoFreeze(false);

class AppStateImpl {
	constructor() {
		this.state = {
			// Application
			isLoading: false,
			currentPage: 'home',
			isLoadingCharacter: false,
			isNavigating: false,
			failedServices: [],

			// Character
			currentCharacter: null,
			characters: [],
			hasUnsavedChanges: false,

			// UI
			activeModal: null,
			notifications: [],

			// Settings
			settings: {
				characterSavePath: null,
				autoSave: true,
				logLevel: 'INFO',
			},

			// Data
			loadedData: {
				classes: null,
				races: null,
				backgrounds: null,
				spells: null,
				equipment: null,
				feats: null,
			},
		};

		console.debug('AppState', 'State initialized');
	}

	getState() {
		return this.state;
	}

	get(key) {
		const keys = key.split('.');
		let value = this.state;

		for (const k of keys) {
			value = value?.[k];
		}

		console.debug('AppState', `Get: ${key}`, value);
		return value;
	}

	setState(updates) {
		console.debug('AppState', 'setState called', updates);

		const oldState = this.state;

		// Use Immer to produce new immutable state
		this.state = produce(this.state, (draft) => {
			Object.assign(draft, updates);
		});

		// Emit global state changed event
		eventBus.emit(EVENTS.STATE_CHANGED, this.state, oldState);

		Object.keys(updates).forEach((key) => {
			if (oldState[key] !== this.state[key]) {
				const eventName = `state:${key}:changed`;
				eventBus.emit(eventName, this.state[key], oldState[key]);
			}
		});
	}

	// Update state using an Immer recipe function for complex nested updates
	updateState(recipe) {
		console.debug('AppState', 'updateState called with recipe');

		const oldState = this.state;
		this.state = produce(this.state, recipe);

		// Emit global state changed event
		eventBus.emit(EVENTS.STATE_CHANGED, this.state, oldState);

		// Emit individual change events for top-level keys that changed
		for (const key of Object.keys(this.state)) {
			if (oldState[key] !== this.state[key]) {
				const eventName = `state:${key}:changed`;
				eventBus.emit(eventName, this.state[key], oldState[key]);
			}
		}
	}

	setCurrentCharacter(character, options = {}) {
		console.debug('AppState', 'Setting current character', {
			id: character?.id,
			skipEvent: options.skipEvent,
		});
		this.setState({ currentCharacter: character });
		if (!options.skipEvent) {
			eventBus.emit(EVENTS.CHARACTER_SELECTED, character);
		}
	}

	getCurrentCharacter() {
		return this.state.currentCharacter;
	}

	setHasUnsavedChanges(hasChanges) {
		if (this.state.hasUnsavedChanges !== hasChanges) {
			console.debug('AppState', 'Unsaved changes:', hasChanges);
			this.setState({ hasUnsavedChanges: hasChanges });
		}
	}

	setCurrentPage(page) {
		console.debug('AppState', 'Setting current page:', page);
		this.setState({ currentPage: page });
		eventBus.emit(EVENTS.PAGE_CHANGED, page);
	}

	getCurrentPage() {
		return this.state.currentPage;
	}

	setLoading(loading) {
		this.setState({ isLoading: loading });
	}

	setFailedServices(services) {
		const normalized = Array.isArray(services) ? [...services] : [];
		this.setState({ failedServices: normalized });
	}

	getFailedServices() {
		return this.state.failedServices || [];
	}

	setCharacters(characters) {
		console.debug('AppState', 'Setting characters list', {
			count: characters.length,
		});
		this.setState({ characters });
	}

	getCharacters() {
		return this.state.characters;
	}

	setLoadedData(dataType, data) {
		console.debug('AppState', `Setting loaded data: ${dataType}`);
		this.setState({
			loadedData: {
				...this.state.loadedData,
				[dataType]: data,
			},
		});
		eventBus.emit(EVENTS.DATA_LOADED, dataType, data);
	}

	getLoadedData(dataType) {
		return this.state.loadedData[dataType];
	}

	clear() {
		console.warn('AppState', 'Clearing all state');
		const initialState = new AppStateImpl().state;
		this.state = initialState;
		eventBus.emit(EVENTS.STATE_CHANGED, this.state, {});
	}
}

// Export singleton instance
export const AppState = new AppStateImpl();
