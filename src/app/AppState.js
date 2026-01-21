/**
 * Central application state singleton that emits change events.
 * 
 * IMPORTANT: State must be treated as immutable. Always use setState() or
 * specialized setters (setCurrentCharacter, setHasUnsavedChanges).
 * Direct mutation bypasses change detection and breaks event listeners.
 */

import { eventBus, EVENTS } from '../lib/EventBus.js';

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
		return { ...this.state };
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

		const oldState = { ...this.state };

		// Merge updates
		this.state = {
			...this.state,
			...updates,
		};

		// Emit global state changed event
		eventBus.emit(EVENTS.STATE_CHANGED, this.state, oldState);

		Object.keys(updates).forEach((key) => {
			if (oldState[key] !== updates[key]) {
				const eventName = `state:${key}:changed`;
				eventBus.emit(eventName, updates[key], oldState[key]);
			}
		});
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
