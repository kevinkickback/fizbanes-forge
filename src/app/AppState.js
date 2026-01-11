/** Central application state singleton that emits change events. */

import { eventBus, EVENTS } from '../lib/EventBus.js';

class AppStateImpl {
	constructor() {
		this.state = {
			// Application
			isLoading: false,
			currentPage: 'home',

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

		console.info('AppState', 'State initialized', this.state);
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

		// Emit specific events for key changes
		Object.keys(updates).forEach((key) => {
			if (oldState[key] !== updates[key]) {
				const eventName = `state:${key}:changed`;
				eventBus.emit(eventName, updates[key], oldState[key]);
				console.debug('AppState', `Emitted: ${eventName}`);
			}
		});

		console.info('AppState', 'State updated', { updates });
	}

	setCurrentCharacter(character) {
		console.info('AppState', 'Setting current character', {
			id: character?.id,
		});
		this.setState({ currentCharacter: character });
		eventBus.emit(EVENTS.CHARACTER_SELECTED, character);
	}

	getCurrentCharacter() {
		return this.state.currentCharacter;
	}

	setHasUnsavedChanges(hasChanges) {
		if (this.state.hasUnsavedChanges !== hasChanges) {
			console.info('AppState', 'Unsaved changes:', hasChanges);
			this.setState({ hasUnsavedChanges: hasChanges });
		}
	}

	setCurrentPage(page) {
		console.info('AppState', 'Setting current page:', page);
		this.setState({ currentPage: page });
		eventBus.emit(EVENTS.PAGE_CHANGED, page);
	}

	getCurrentPage() {
		return this.state.currentPage;
	}

	setLoading(loading) {
		this.setState({ isLoading: loading });
	}

	setCharacters(characters) {
		console.info('AppState', 'Setting characters list', {
			count: characters.length,
		});
		this.setState({ characters });
	}

	getCharacters() {
		return this.state.characters;
	}

	setLoadedData(dataType, data) {
		console.info('AppState', `Setting loaded data: ${dataType}`);
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
