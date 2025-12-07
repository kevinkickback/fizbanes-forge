/**
 * Bootstrap helper that orchestrates renderer startup and data loading.
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

// Modal for data configuration
import { DataConfigurationModal } from '../modules/setup/DataConfigurationModal.js';
import { LoadingModal } from '../modules/setup/LoadingModal.js';

// Service imports
import { actionService } from '../services/ActionService.js';
import { backgroundService } from '../services/BackgroundService.js';
import { classService } from '../services/ClassService.js';
import { conditionService } from '../services/ConditionService.js';
import { featService } from '../services/FeatService.js';
import { itemService } from '../services/ItemService.js';
import { monsterService } from '../services/MonsterService.js';
import { raceService } from '../services/RaceService.js';
import { settingsService } from '../services/SettingsService.js';
import { skillService } from '../services/SkillService.js';
import { spellService } from '../services/SpellService.js';
import { variantRuleService } from '../services/VariantRuleService.js';
import { DataLoader } from '../utils/DataLoader.js';
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
		Logger.warn('AppInitializer', `Failed to load ${component} data:`, error);
		return null;
	}
}

/**
 * Check if data folder is available, prompt user if not
 * @returns {Promise<boolean>} True if data is ready to load
 * @private
 */
async function _checkDataFolder() {
	try {
		// Prefer previously configured data source
		const saved = await window.app.getDataSource();
		if (saved?.success && saved.type && saved.value) {
			Logger.info(
				'AppInitializer',
				'Using configured data source:',
				saved.type,
			);
			return true;
		}

		// No configured source – require user configuration every time
		Logger.warn(
			'AppInitializer',
			'No data source configured, showing configuration modal',
		);
		showNotification(
			'D&D data files are required. Please configure a data source.',
			'warning',
		);

		const modal = new DataConfigurationModal();
		const result = await modal.show();

		Logger.info('AppInitializer', 'User configured data source:', result.type);
		return true;
	} catch (error) {
		Logger.error('AppInitializer', 'Error checking data folder:', error);
		showNotification('Error checking data folder. Please try again.', 'error');
		return false;
	}
}

/**
 * Prompt user to fix data source issues via the configuration modal.
 * Stops further initialization; modal will reload the page on successful reconfigure.
 * @param {string} errorMessage
 * @returns {Promise<void>}
 * @private
 */
async function _promptDataSourceFix(errorMessage) {
	showNotification(
		`Data source error: ${errorMessage || 'Unknown issue'}. Please reconfigure your data source.`,
		'error',
	);

	try {
		const modal = new DataConfigurationModal({ allowClose: true });
		await modal.show();
	} catch (error) {
		Logger.warn('AppInitializer', 'User dismissed data source fix modal', error);
		throw error;
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
			_loadDataWithErrorHandling(conditionService.initialize(), 'conditions'),
			_loadDataWithErrorHandling(monsterService.initialize(), 'monsters'),
			_loadDataWithErrorHandling(featService.initialize(), 'feats'),
			_loadDataWithErrorHandling(skillService.initialize(), 'skills'),
			_loadDataWithErrorHandling(actionService.initialize(), 'actions'),
			_loadDataWithErrorHandling(variantRuleService.initialize(), 'variantrules'),
		];

		await Promise.all(dataLoadPromises);
		return { success: true, errors };
	} catch (error) {
		Logger.error('AppInitializer', 'Error during game data loading:', error);
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
		Logger.error('AppInitializer', `Error initializing ${name}:`, error);
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
		Logger.error(
			'AppInitializer',
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

	// Mark body with debug class early so debug-only UI is toggled before loading screen
	try {
		if (window.FF_DEBUG === true) {
			document.body.classList.add('debug-mode');
		} else {
			document.body.classList.remove('debug-mode');
		}
	} catch (error) {
		Logger.warn('AppInitializer', 'Unable to set debug body class', error);
	}

	const loadingModal = new LoadingModal();
	loadingModal.show('Checking data files...');

	try {
		// Step 0: Check data folder availability
		loadingModal.updateMessage('Checking data files...');
		loadingModal.updateProgress(5);
		const dataReady = await _checkDataFolder();
		if (!dataReady) {
			throw new Error('Data folder not configured');
		}

		// Step 0.5: Refresh configured data source to pick up new/changed files
		loadingModal.updateMessage('Syncing data source...');
		loadingModal.updateProgress(15);
		try {
			const refreshResult = await window.app.refreshDataSource();
			if (!refreshResult?.success) {
				Logger.warn(
					'AppInitializer',
					`Data source refresh skipped/failed: ${refreshResult?.error || 'Unknown error'}`,
				);
				await _promptDataSourceFix(refreshResult?.error || 'Data source is invalid');
				throw new Error('Data source refresh failed');
			} else {
				DataLoader.clearCache();
				Logger.info(
					'AppInitializer',
					'Checked data source for updates before load; cleared data cache',
				);
			}
		} catch (error) {
			Logger.warn('AppInitializer', 'Data source refresh failed', error);
		}

		// Step 1: Load all game data
		loadingModal.updateMessage('Loading game data...');
		loadingModal.updateProgress(30);
		const dataLoadResult = await _loadAllGameData();
		if (!dataLoadResult.success) {
			result.errors.push(...dataLoadResult.errors);
		}

		// Step 2: Initialize core components
		loadingModal.updateMessage('Initializing components...');
		loadingModal.updateProgress(70);
		const componentsResult = await _initializeCoreComponents();
		result.loadedComponents = componentsResult.loadedComponents;
		result.errors.push(...componentsResult.errors);

		// Step 3: Set up UI event handlers
		loadingModal.updateMessage('Setting up UI...');
		loadingModal.updateProgress(90);
		_setupUIEventHandlers();

		// Set overall success based on whether any critical errors occurred
		result.success = result.errors.length === 0;

		// Hide loading modal before showing any notifications
		loadingModal.updateProgress(100);
		setTimeout(() => loadingModal.hide(), 200);

		if (!result.success) {
			Logger.warn(
				'AppInitializer',
				'Application initialized with errors:',
				result.errors,
			);
		}

		return result;
	} catch (error) {
		loadingModal.hide();
		Logger.error(
			'AppInitializer',
			'Fatal error during application initialization:',
			error,
		);
		result.success = false;
		result.errors.push(error);
		throw error;
	}
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
	initializeAll().catch((error) => {
		Logger.error('AppInitializer', 'Error during initialization:', error);
	});
});

export class AppInitializer {
	// ...
}
