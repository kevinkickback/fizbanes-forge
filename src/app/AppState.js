/**
 * Set the active character and optionally emit CHARACTER_SELECTED event.
 * This is the recommended way to select a character (not direct state mutation).
 * 
 * @param {Object|null} character - Character object to set as current, or null to clear
 * @param {Object} [options={}] - Optional configuration
 * @param {boolean} [options.skipEvent=false] - If true, skip emitting CHARACTER_SELECTED
 * 
 * @example
 * // ✅ Set a character and notify listeners
 * appState.setCurrentCharacter(character);
 * 
 * // ✅ Set without triggering CHARACTER_SELECTED
 * appState.setCurrentCharacter(character, { skipEvent: true });
 * 
 * // ❌ WRONG: Direct mutation (events won't fire correctly)
 * appState.state.currentCharacter = character;
 * 
 * @emits EventBus#state:currentCharacter:changed
 * @emits EventBus#CHARACTER_SELECTED - Unless skipEvent is true
 */
/**
 * Central application state singleton that emits change events.
 * 
 * ⚠️ IMMUTABILITY REQUIREMENT:
 * 
 * AppState uses an event-driven architecture where subscribers listen to state change
 * events through EventBus. This contract requires that:
 * 
 * 1. STATE MUST BE IMMUTABLE:
 *    - Never mutate the internal state directly (e.g., appState.state.character = x)
 *    - Never mutate objects returned from getters (e.g., char.abilities.strength = 20)
 *    - Always use setState() or specialized setters (setCurrentCharacter, setHasUnsavedChanges)
 * 
 * 2. WHY THIS MATTERS:
 *    - Event listeners compare old vs new state to detect changes
 *    - Direct mutations bypass this comparison, causing stale listener state
 *    - This leads to UI not updating, saves not triggering, and hard-to-debug race conditions
 * 
 * 3. CORRECT PATTERNS:
 * 
 *    // ✅ GOOD: Use setState() for complex updates
 *    appState.setState({
 *      currentCharacter: { ...character, level: 5 },
 *      hasUnsavedChanges: true
 *    });
 * 
 *    // ✅ GOOD: Use specialized setters
 *    appState.setCurrentCharacter(character);
 *    appState.setHasUnsavedChanges(true);
 * 
 *    // ✅ GOOD: Create new objects for character updates
 *    const updated = Character.applyLevel(currentChar, 5);
 *    appState.setState({ currentCharacter: updated });
 * 
 * 4. INCORRECT PATTERNS (DON'T DO THIS):
 * 
 *    // ❌ BAD: Direct mutation
 *    appState.state.currentCharacter.level = 5;
 * 
 *    // ❌ BAD: Mutating returned object
 *    const char = appState.getCurrentCharacter();
 *    char.abilities.strength = 20;  // This mutates cached state!
 * 
 *    // ❌ BAD: Partial destructure without setState
 *    appState.state.loadedData.spells = spells;  // Events won't fire!
 * 
 * 5. EVENT FLOW:
 *    setState() → Internal state replaced → OLD vs NEW compared → EventBus emits
 *    → Subscribers receive change event → UI updates, logic runs
 * 
 *    Without proper setState(), subscribers never learn about changes.
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

		console.info('AppState', 'State initialized', this.state);
	}

	/**
	 * Get a shallow copy of the entire state object.
	 * NOTE: Returned object is a shallow copy; nested objects are not deep-cloned.
	 * Do NOT mutate nested properties of the returned copy directly—use setState() instead.
	 * 
	 * @returns {Object} Shallow copy of state
	 * @example
	 * const state = appState.getState();
	 * // ✅ safe to examine: state.currentCharacter, state.currentPage
	 * // ❌ DO NOT: state.currentCharacter.level = 5; (mutations won't trigger events)
	 */
	getState() {
		return { ...this.state };
	}
	/**
	 * Replace specified state properties and emit change events.
	 * This is the only way to update state correctly and trigger listeners.
	 * 
	 * @param {Object} updates - Key-value pairs of state properties to update
	 * @example
	 * // ✅ Update character and mark unsaved
	 * appState.setState({
	 *   currentCharacter: newCharacter,
	 *   hasUnsavedChanges: true
	 * });
	 * 
	 * // ✅ Update nested data (requires full replacement, not mutation)
	 * appState.setState({
	 *   loadedData: {
	 *     ...appState.state.loadedData,
	 *     spells: newSpells
	 *   }
	 * });
	 * 
	 * @emits EventBus#STATE_CHANGED - Emitted for any state change
	 * @emits EventBus#state:KEY:changed - Emitted for each updated key
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

	setCurrentCharacter(character, options = {}) {
		console.info('AppState', 'Setting current character', {
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

	setFailedServices(services) {
		const normalized = Array.isArray(services) ? [...services] : [];
		this.setState({ failedServices: normalized });
	}

	getFailedServices() {
		return this.state.failedServices || [];
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
