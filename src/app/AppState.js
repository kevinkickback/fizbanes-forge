/**
 * AppState module
 *
 * Provides a singleton for managing global application state, emitting change events,
 * and providing accessors and mutators for stateful data such as current character, page, and loaded data.
 *
 * @module AppState
 */

import { eventBus, EVENTS } from '../lib/EventBus.js';

/**
 * Central application state singleton that emits change events.
 * @class
 */
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

	/**
	 * Get entire state (readonly).
	 * @returns {object} Current state
	 */
	getState() {
		return { ...this.state };
	}

	/**
	 * Get specific state value.
	 * @param {string} key - State key (supports dot notation)
	 * @returns {*} State value
	 */
	get(key) {
		const keys = key.split('.');
		let value = this.state;

		for (const k of keys) {
			value = value?.[k];
		}

		console.debug('AppState', `Get: ${key}`, value);
		return value;
	}

	/**
	 * Update state and emit events.
	 * @param {object} updates - State updates
	 */
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

	/**
	 * Set current character.
	 * @param {object|null} character - Character object or null
	 */
	setCurrentCharacter(character) {
		console.info('AppState', 'Setting current character', {
			id: character?.id,
		});
		this.setState({ currentCharacter: character });
		eventBus.emit(EVENTS.CHARACTER_SELECTED, character);
	}

	/**
	 * Get current character.
	 * @returns {object|null} Current character
	 */
	getCurrentCharacter() {
		return this.state.currentCharacter;
	}

	/**
	 * Mark character as having unsaved changes.
	 * @param {boolean} hasChanges - Whether there are unsaved changes
	 */
	setHasUnsavedChanges(hasChanges) {
		if (this.state.hasUnsavedChanges !== hasChanges) {
			console.info('AppState', 'Unsaved changes:', hasChanges);
			this.setState({ hasUnsavedChanges: hasChanges });
		}
	}

	/**
	 * Set current page.
	 * @param {string} page - Page identifier
	 */
	setCurrentPage(page) {
		console.info('AppState', 'Setting current page:', page);
		this.setState({ currentPage: page });
		eventBus.emit(EVENTS.PAGE_CHANGED, page);
	}

	/**
	 * Get current page.
	 * @returns {string} Current page
	 */
	getCurrentPage() {
		return this.state.currentPage;
	}

	/**
	 * Set loading state.
	 * @param {boolean} loading - Whether app is loading
	 */
	setLoading(loading) {
		this.setState({ isLoading: loading });
	}

	/**
	 * Set characters list.
	 * @param {Array} characters - Array of characters
	 */
	setCharacters(characters) {
		console.info('AppState', 'Setting characters list', {
			count: characters.length,
		});
		this.setState({ characters });
	}

	/**
	 * Get characters list.
	 * @returns {Array} Characters array
	 */
	getCharacters() {
		return this.state.characters;
	}

	/**
	 * Set loaded data for a specific type.
	 * @param {string} dataType - Type of data (classes, races, etc.)
	 * @param {*} data - The data to store
	 */
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

	/**
	 * Get loaded data for a specific type.
	 * @param {string} dataType - Type of data
	 * @returns {*} The loaded data or null
	 */
	getLoadedData(dataType) {
		return this.state.loadedData[dataType];
	}

	/**
	 * Clear all state (reset to initial).
	 */
	clear() {
		console.warn('AppState', 'Clearing all state');
		const initialState = new AppStateImpl().state;
		this.state = initialState;
		eventBus.emit(EVENTS.STATE_CHANGED, this.state, {});
	}
}

// Export singleton instance
export const AppState = new AppStateImpl();
