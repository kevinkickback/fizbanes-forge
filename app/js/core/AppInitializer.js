/**
 * AppInitializer.js
 * Core initialization utilities for application bootstrap process.
 * Manages the initialization sequence of all critical application components.
 *
 * @typedef {Object} InitializationOptions
 * @property {boolean} [loadAllData=true] - Whether to load all data sources
 * @property {boolean} [skipCharacterLoad=false] - Whether to skip loading characters
 * @property {boolean} [forceRefresh=false] - Whether to force refresh cached data
 *
 * @typedef {Object} InitializationResult
 * @property {boolean} success - Whether initialization was successful
 * @property {Array<string>} loadedComponents - List of successfully loaded components
 * @property {Array<Error>} errors - List of errors encountered during initialization
 *
 * @typedef {Object} DataLoadResult
 * @property {any} data - The loaded data or null if loading failed
 * @property {Error|null} error - The error that occurred during loading, if any
 */

// Core imports - NEW ARCHITECTURE
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { Logger } from '../infrastructure/Logger.js';
import { showNotification } from '../utils/Notifications.js';
import { AppState } from './AppState.js';
import { CharacterManager } from './CharacterManager.js';
import { NavigationController } from './NavigationController.js';
import { PageHandler } from './PageHandler.js';

// Service imports
import { backgroundService } from '../services/BackgroundService.js';
import { classService } from '../services/ClassService.js';
import { itemService } from '../services/ItemService.js';
import { raceService } from '../services/RaceService.js';
import { settingsService } from '../services/SettingsService.js';
import { spellService } from '../services/SpellService.js';
import { textProcessor } from '../utils/TextProcessor.js';

/**
 * Wrapper for data loader calls that handles errors consistently
 * @param {Promise<any>} promise - The data loader promise to execute
 * @param {string} component - The name of the component being loaded (for error reporting)
 * @returns {Promise<any|null>} The loaded data or null if loading failed
 * @private
 */
async function _loadDataWithErrorHandling(promise, component) {
	try {
		const result = await promise;
		return result;
	} catch (error) {
		console.warn(`Failed to load ${component} data:`, error);
		return null;
	}
}

/**
 * Loads all required game data in parallel
 * @returns {Promise<{success: boolean, errors: Array<Error>}>} Result of data loading operations
 * @private
 */
async function _loadAllGameData() {
	const errors = [];
	try {
		// Initialize all services in parallel
		const dataLoadPromises = [
			_loadDataWithErrorHandling(spellService.initialize(), 'spells'),
			_loadDataWithErrorHandling(itemService.initialize(), 'items'),
			_loadDataWithErrorHandling(classService.initialize(), 'classes'),
			_loadDataWithErrorHandling(raceService.initialize(), 'races'),
			_loadDataWithErrorHandling(backgroundService.initialize(), 'backgrounds'),
		];

		await Promise.all(dataLoadPromises);
		return { success: true, errors };
	} catch (error) {
		console.error('Error during game data loading:', error);
		errors.push(error);
		return { success: false, errors };
	}
}

/**
 * Initializes a single core component with error handling
 * @param {string} name - The name of the component
 * @param {Function} initFunction - The initialization function to call
 * @returns {Promise<{success: boolean, error: Error|null}>} Result of the initialization
 * @private
 */
async function _initializeComponent(name, initFunction) {
	try {
		await initFunction();
		return { success: true, error: null };
	} catch (error) {
		console.error(`Error initializing ${name}:`, error);
		return { success: false, error };
	}
}

/**
 * Initializes all core application components in the correct sequence
 * @returns {Promise<{success: boolean, loadedComponents: Array<string>, errors: Array<Error>}>} Result of component initialization
 * @private
 */
async function _initializeCoreComponents() {
	const result = {
		success: true,
		loadedComponents: [],
		errors: [],
	};

	try {
		Logger.info(
			'AppInitializer',
			'Initializing core components with NEW architecture',
		);

		// Define components and their initialization sequence
		const components = [
			{ name: 'text processor', init: () => textProcessor.initialize() },
			{ name: 'page handler', init: () => PageHandler.initialize() },
			{
				name: 'navigation controller',
				init: () => NavigationController.initialize(),
			},
			{ name: 'settings service', init: () => settingsService.initialize() },
		];

		// Initialize each component in sequence
		for (const component of components) {
			const initResult = await _initializeComponent(
				component.name,
				component.init,
			);

			if (initResult.success) {
				result.loadedComponents.push(component.name);
				Logger.info('AppInitializer', `✓ ${component.name} initialized`);
			} else {
				result.errors.push(initResult.error);
				Logger.error(
					'AppInitializer',
					`✗ ${component.name} failed`,
					initResult.error,
				);
			}
		}

		// Set overall success based on whether any critical errors occurred
		result.success = result.errors.length === 0;

		Logger.info('AppInitializer', 'Core components initialized', {
			success: result.success,
			loaded: result.loadedComponents.length,
			errors: result.errors.length,
		});

		return result;
	} catch (error) {
		console.error(
			'Unexpected error during core component initialization:',
			error,
		);
		result.success = false;
		result.errors.push(error);
		return result;
	}
}

/**
 * Set up UI event handlers (buttons, etc.)
 * @returns {void}
 * @private
 */
function _setupUIEventHandlers() {
	try {
		Logger.info('AppInitializer', 'Setting up UI event handlers');

		// Set up save button handler
		const saveButton = document.getElementById('saveCharacter');
		const unsavedIndicator = document.getElementById('unsavedChangesIndicator');

		// Centralized unsaved indicator logic
		const PAGES_SHOW_UNSAVED = new Set(['build', 'details']);

		function updateUnsavedIndicator() {
			try {
				const hasUnsaved = AppState.get('hasUnsavedChanges');
				const currentPage = AppState.getCurrentPage();
				const shouldShow = Boolean(
					hasUnsaved && PAGES_SHOW_UNSAVED.has(currentPage),
				);

				if (!unsavedIndicator) return;

				unsavedIndicator.style.display = shouldShow ? 'inline-block' : 'none';
				Logger.debug(
					'AppInitializer',
					`Unsaved indicator updated: show=${shouldShow}`,
					{
						hasUnsaved,
						currentPage,
						display: unsavedIndicator.style.display,
					},
				);
			} catch (e) {
				Logger.error('AppInitializer', 'Error updating unsaved indicator', e);
			}
		}

		// Suppress CHARACTER_UPDATED events immediately after page/character changes
		let _suppressUntil = 0; // timestamp in ms
		const SUPPRESS_WINDOW_MS = 150;

		// Helper to mark a short suppression window
		function suppressTemporary() {
			_suppressUntil = Date.now() + SUPPRESS_WINDOW_MS;
			Logger.debug(
				'AppInitializer',
				`Temporary suppression enabled until ${new Date(_suppressUntil).toISOString()}`,
			);
		}

		// Listen for CHARACTER_UPDATED events to mark unsaved state
		eventBus.on(EVENTS.CHARACTER_UPDATED, () => {
			const now = Date.now();
			if (now < _suppressUntil) {
				Logger.debug(
					'AppInitializer',
					`Ignored CHARACTER_UPDATED due to suppression (now=${now})`,
				);
				return;
			}

			Logger.debug(
				'AppInitializer',
				`[${new Date().toISOString()}] EVENT: CHARACTER_UPDATED received`,
			);
			AppState.setHasUnsavedChanges(true);
			updateUnsavedIndicator();
		});

		// Listen for CHARACTER_SAVED events to clear unsaved state
		eventBus.on(EVENTS.CHARACTER_SAVED, () => {
			Logger.debug(
				'AppInitializer',
				`[${new Date().toISOString()}] EVENT: CHARACTER_SAVED received`,
			);
			AppState.setHasUnsavedChanges(false);
			updateUnsavedIndicator();
		});

		// Clear unsaved indicator when a new character is selected (fresh load)
		eventBus.on(EVENTS.CHARACTER_SELECTED, () => {
			Logger.debug(
				'AppInitializer',
				`[${new Date().toISOString()}] EVENT: CHARACTER_SELECTED received`,
			);
			AppState.setHasUnsavedChanges(false);
			suppressTemporary();
			updateUnsavedIndicator();
		});

		// Update indicator on page changes (show only on certain pages)
		eventBus.on(EVENTS.PAGE_CHANGED, (page) => {
			Logger.debug(
				'AppInitializer',
				`[${new Date().toISOString()}] EVENT: PAGE_CHANGED to "${page}"`,
			);
			// Suppress CHARACTER_UPDATED events that may be emitted during page init
			suppressTemporary();
			updateUnsavedIndicator();
		});

		// Listen for explicit AppState changes to hasUnsavedChanges
		eventBus.on('state:hasUnsavedChanges:changed', (newVal) => {
			Logger.debug(
				'AppInitializer',
				`state:hasUnsavedChanges:changed -> ${newVal}`,
			);
			updateUnsavedIndicator();
		});

		// Listen for PAGE_CHANGED events to log floating bar visibility
		eventBus.on(EVENTS.PAGE_CHANGED, (page) => {
			Logger.debug(
				'AppInitializer',
				`[${new Date().toISOString()}] EVENT: PAGE_CHANGED to "${page}"`,
			);
			const floatingBar = document.querySelector('.floating-actions');
			const floatingBarVisible = floatingBar
				? window.getComputedStyle(floatingBar).display !== 'none'
				: false;
			const unsavedVisible = unsavedIndicator
				? unsavedIndicator.style.display !== 'none'
				: false;

			Logger.debug('AppInitializer', `On PAGE_CHANGED to "${page}"`, {
				floatingBarVisible: floatingBarVisible,
				unsavedIndicatorVisible: unsavedVisible,
				dataCurrentPage: document.body.getAttribute('data-current-page'),
			});
		});

		if (saveButton) {
			saveButton.addEventListener('click', async () => {
				try {
					Logger.info(
						'AppInitializer',
						`[${new Date().toISOString()}] Save button clicked`,
					);

					// Update character data from form inputs on details page
					const characterNameInput = document.getElementById('characterName');
					const playerNameInput = document.getElementById('playerName');
					const heightInput = document.getElementById('height');
					const weightInput = document.getElementById('weight');
					const genderInput = document.getElementById('gender');
					const backstoryTextarea = document.getElementById('backstory');

					const character = AppState.getCurrentCharacter();
					if (character) {
						if (characterNameInput) character.name = characterNameInput.value;
						if (playerNameInput) character.playerName = playerNameInput.value;
						if (heightInput) character.height = heightInput.value;
						if (weightInput) character.weight = weightInput.value;
						if (genderInput) character.gender = genderInput.value;
						if (backstoryTextarea)
							character.backstory = backstoryTextarea.value;
					}

					const result = await CharacterManager.saveCharacter();

					if (result.isOk()) {
						Logger.info('AppInitializer', 'Character saved successfully');
						showNotification('Character saved successfully', 'success');
						if (unsavedIndicator) {
							unsavedIndicator.style.display = 'none';
						}
						// Emit save event
						Logger.debug('AppInitializer', 'Emitting CHARACTER_SAVED event');
						eventBus.emit(EVENTS.CHARACTER_SAVED);
					} else {
						Logger.error(
							'AppInitializer',
							'Failed to save character',
							result.error,
						);
						showNotification(
							`Failed to save character: ${result.error}`,
							'error',
						);
					}
				} catch (error) {
					Logger.error('AppInitializer', 'Error saving character', error);
					showNotification('Error saving character', 'error');
				}
			});
		} else {
			Logger.warn('AppInitializer', 'Save button not found');
		}

		Logger.info('AppInitializer', 'UI event handlers set up successfully');
	} catch (error) {
		Logger.error('AppInitializer', 'Error setting up UI event handlers', error);
	}
}

//-------------------------------------------------------------------------
// Public API
//-------------------------------------------------------------------------

/**
 * Initializes all core components of the application in the correct order
 * @param {InitializationOptions} [_options={}] - Initialization options
 * @returns {Promise<InitializationResult>} The result of initialization
 * @throws {Error} If initialization fails catastrophically
 */
export async function initializeAll(_options = {}) {
	const result = {
		success: true,
		loadedComponents: [],
		errors: [],
	};

	try {
		// Step 1: Load all game data
		const dataLoadResult = await _loadAllGameData();
		if (!dataLoadResult.success) {
			result.errors.push(...dataLoadResult.errors);
		}

		// Step 2: Initialize core components
		const componentsResult = await _initializeCoreComponents();
		result.loadedComponents = componentsResult.loadedComponents;
		result.errors.push(...componentsResult.errors);

		// Step 3: Set up UI event handlers
		_setupUIEventHandlers();

		// Set overall success based on whether any critical errors occurred
		result.success = result.errors.length === 0;

		if (!result.success) {
			console.warn('Application initialized with errors:', result.errors);
		}

		return result;
	} catch (error) {
		console.error('Fatal error during application initialization:', error);
		result.success = false;
		result.errors.push(error);
		throw error;
	}
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
	initializeAll().catch((error) => {
		console.error('Error during initialization:', error);
	});
});

export class AppInitializer {
	// ...
}
