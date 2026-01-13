/** Orchestrates renderer startup, data loading, and core component initialization. */

// Core imports - NEW ARCHITECTURE
import { eventBus, EVENTS } from '../lib/EventBus.js';

import { getNotificationCenter } from '../lib/NotificationCenter.js';
import { showNotification } from '../lib/Notifications.js';
import { AppState } from './AppState.js';
import { CharacterManager } from './CharacterManager.js';
import { NavigationController } from './NavigationController.js';
import { PageHandler } from './PageHandler.js';
import { themeManager } from './ThemeManager.js';
import { titlebarController } from './TitlebarController.js';

// Modal for data configuration
import { DataConfigurationModal } from '../ui/components/setup/DataConfiguration.js';
import { LoadingModal } from '../ui/components/setup/Modals.js';

// Service imports
import { DataLoader } from '../lib/DataLoader.js';
import { textProcessor } from '../lib/TextProcessor.js';
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

const MAX_DATA_LOAD_ATTEMPTS = 2;
const DATA_LOAD_BACKOFF_MS = 350;

// Guard against multiple initializations
let _isInitialized = false;
let _isInitializing = false;

function _sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _loadDataWithErrorHandling(promise, component) {
	try {
		return await promise;
	} catch (error) {
		console.warn('AppInitializer', `Failed to load ${component} data:`, error);
		return null;
	}
}

async function _checkDataFolder() {
	try {
		// Prefer previously configured data source
		const saved = await window.app.getDataSource();
		if (saved?.success && saved.type && saved.value) {
			console.info(
				'AppInitializer',
				'Using configured data source:',
				saved.type,
			);
			return true;
		}

		// No configured source – require user configuration every time
		console.warn(
			'AppInitializer',
			'No data source configured, showing configuration modal',
		);
		showNotification(
			'D&D data files are required. Please configure a data source.',
			'warning',
		);

		const modal = new DataConfigurationModal();
		const result = await modal.show();

		console.info('AppInitializer', 'User configured data source:', result.type);
		return true;
	} catch (error) {
		console.error('AppInitializer', 'Error checking data folder:', error);
		showNotification('Error checking data folder. Please try again.', 'error');
		return false;
	}
}

async function _validateDataSource() {
	const saved = await window.app.getDataSource();
	if (!saved?.type || !saved?.value) {
		return { ok: false, error: 'No data source configured' };
	}

	try {
		const validation = await window.app.validateDataSource({
			type: saved.type,
			value: saved.value,
		});
		if (!validation?.success) {
			return { ok: false, error: validation?.error || 'Validation failed' };
		}
		return { ok: true };
	} catch (error) {
		return { ok: false, error: error?.message || 'Validation error' };
	}
}

async function _promptDataSourceFix(errorMessage) {
	showNotification(
		`Data source error: ${errorMessage || 'Unknown issue'}. Please reconfigure your data source.`,
		'error',
	);

	try {
		const modal = new DataConfigurationModal({ allowClose: true });
		await modal.show();
	} catch (error) {
		console.warn(
			'AppInitializer',
			'User dismissed data source fix modal',
			error,
		);
		throw error;
	}
}

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
			_loadDataWithErrorHandling(
				variantRuleService.initialize(),
				'variantrules',
			),
		];

		await Promise.all(dataLoadPromises);
		return { success: true, errors };
	} catch (error) {
		console.error('AppInitializer', 'Error during game data loading:', error);
		errors.push(error);
		return { success: false, errors };
	}
}

async function _loadAllGameDataWithRetry() {
	let lastError = null;
	for (let attempt = 1; attempt <= MAX_DATA_LOAD_ATTEMPTS; attempt++) {
		if (attempt > 1) {
			await _sleep(DATA_LOAD_BACKOFF_MS * (attempt - 1));
		}

		const validation = await _validateDataSource();
		if (!validation.ok) {
			lastError = new Error(validation.error || 'Data source validation failed');
			if (attempt === MAX_DATA_LOAD_ATTEMPTS) {
				showNotification(
					`Data source validation failed: ${lastError.message}`,
					'error',
				);
				await _promptDataSourceFix(lastError.message);
				return { success: false, errors: [lastError] };
			}
			showNotification(
				`Data source validation failed (attempt ${attempt}/${MAX_DATA_LOAD_ATTEMPTS}). Retrying...`,
				'warning',
			);
			continue;
		}

		const loadResult = await _loadAllGameData();
		if (loadResult.success) return loadResult;

		lastError = loadResult.errors?.[0] || new Error('Data load failed');
		if (attempt === MAX_DATA_LOAD_ATTEMPTS) {
			showNotification(
				`Failed to load game data: ${lastError.message}`,
				'error',
			);
			await _promptDataSourceFix(lastError.message);
			return loadResult;
		}

		showNotification(
			`Game data load failed (attempt ${attempt}/${MAX_DATA_LOAD_ATTEMPTS}). Retrying...`,
			'warning',
		);
	}

	return { success: false, errors: lastError ? [lastError] : [] };
}

async function _initializeComponent(name, initFunction) {
	try {
		await initFunction();
		return { success: true, error: null };
	} catch (error) {
		console.error('AppInitializer', `Error initializing ${name}:`, error);
		return { success: false, error };
	}
}

async function _initializeCoreComponents() {
	const result = {
		success: true,
		loadedComponents: [],
		errors: [],
	};

	try {
		console.info(
			'AppInitializer',
			'Initializing core components with NEW architecture',
		);

		// Define components and their initialization sequence
		const components = [
			{ name: 'text processor', init: () => textProcessor.initialize() },
			{ name: 'titlebar controller', init: () => titlebarController.init() },
			{ name: 'page handler', init: () => PageHandler.initialize() },
			{
				name: 'navigation controller',
				init: () => NavigationController.initialize(),
			},
			{ name: 'settings service', init: () => settingsService.initialize() },
			{
				name: 'notification center',
				init: () => getNotificationCenter().initialize(),
			},
		];

		// Initialize each component in sequence
		for (const component of components) {
			const initResult = await _initializeComponent(
				component.name,
				component.init,
			);

			if (initResult.success) {
				result.loadedComponents.push(component.name);
				console.info('AppInitializer', `✓ ${component.name} initialized`);
			} else {
				result.errors.push(initResult.error);
				console.error(
					'AppInitializer',
					`✗ ${component.name} failed`,
					initResult.error,
				);
			}
		}

		// Set overall success based on whether any critical errors occurred
		result.success = result.errors.length === 0;

		console.info('AppInitializer', 'Core components initialized', {
			success: result.success,
			loaded: result.loadedComponents.length,
			errors: result.errors.length,
		});

		return result;
	} catch (error) {
		console.error(
			'AppInitializer',
			'Unexpected error during core component initialization:',
			error,
		);
		result.success = false;
		result.errors.push(error);
		return result;
	}
}

function _setupUiEventHandlers() {
	try {
		console.info('AppInitializer', 'Setting up UI event handlers');

		// Set up save button handler
		const saveButton = document.getElementById('saveCharacter');

		// Centralized unsaved indicator logic
		const PagesShowUnsaved = new Set(['build', 'details']);

		function updateUnsavedIndicator() {
			try {
				const hasUnsaved = AppState.get('hasUnsavedChanges');
				const currentPage = AppState.getCurrentPage();
				const shouldShow = Boolean(
					hasUnsaved && PagesShowUnsaved.has(currentPage),
				);

				// Update titlebar unsaved indicator (already managed by CHARACTER_UPDATED event)
				console.debug(
					'AppInitializer',
					`Unsaved indicator updated: show=${shouldShow}`,
					{
						hasUnsaved,
						currentPage,
					},
				);
			} catch (e) {
				console.error('AppInitializer', 'Error updating unsaved indicator', e);
			}
		}

		// Suppress CHARACTER_UPDATED events immediately after page/character changes
		let _suppressUntil = 0; // timestamp in ms
		const SuppressWindowMs = 150;

		// Helper to mark a short suppression window
		function suppressTemporary() {
			_suppressUntil = Date.now() + SuppressWindowMs;
			console.debug(
				'AppInitializer',
				`Temporary suppression enabled until ${new Date(_suppressUntil).toISOString()}`,
			);
		}

		// Listen for CHARACTER_UPDATED events to mark unsaved state
		eventBus.on(EVENTS.CHARACTER_UPDATED, () => {
			const now = Date.now();
			if (now < _suppressUntil) {
				console.debug(
					'AppInitializer',
					`Ignored CHARACTER_UPDATED due to suppression (now=${now})`,
				);
				return;
			}

			console.debug(
				'AppInitializer',
				`[${new Date().toISOString()}] EVENT: CHARACTER_UPDATED received`,
			);
			AppState.setHasUnsavedChanges(true);
			updateUnsavedIndicator();
		});

		// Listen for CHARACTER_SAVED events to clear unsaved state
		eventBus.on(EVENTS.CHARACTER_SAVED, () => {
			console.debug(
				'AppInitializer',
				`[${new Date().toISOString()}] EVENT: CHARACTER_SAVED received`,
			);
			AppState.setHasUnsavedChanges(false);
			updateUnsavedIndicator();
		});

		// Clear unsaved indicator when a new character is selected (fresh load)
		eventBus.on(EVENTS.CHARACTER_SELECTED, () => {
			console.debug(
				'AppInitializer',
				`[${new Date().toISOString()}] EVENT: CHARACTER_SELECTED received`,
			);
			AppState.setHasUnsavedChanges(false);
			suppressTemporary();
			updateUnsavedIndicator();
		});

		// Update indicator on page changes (show only on certain pages)
		eventBus.on(EVENTS.PAGE_CHANGED, (page) => {
			console.debug(
				'AppInitializer',
				`[${new Date().toISOString()}] EVENT: PAGE_CHANGED to "${page}"`,
			);
			// Suppress CHARACTER_UPDATED events that may be emitted during page init
			suppressTemporary();
			updateUnsavedIndicator();
		});

		// Listen for explicit AppState changes to hasUnsavedChanges
		eventBus.on('state:hasUnsavedChanges:changed', (newVal) => {
			console.debug(
				'AppInitializer',
				`state:hasUnsavedChanges:changed -> ${newVal}`,
			);
			updateUnsavedIndicator();
		});

		if (saveButton) {
			saveButton.addEventListener('click', async () => {
				try {
					console.info(
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

					await CharacterManager.saveCharacter();

					console.info('AppInitializer', 'Character saved successfully');
					showNotification('Character saved successfully', 'success');
					// Emit save event
					console.debug('AppInitializer', 'Emitting CHARACTER_SAVED event');
					eventBus.emit(EVENTS.CHARACTER_SAVED);
				} catch (error) {
					console.error('AppInitializer', 'Error saving character', error);
					showNotification('Error saving character', 'error');
				}
			});
		} else {
			console.warn('AppInitializer', 'Save button not found');
		}

		// Level Up modal button
		const levelUpBtn = document.getElementById('openLevelUpModalBtn');
		if (levelUpBtn) {
			let levelUpModalInstance = null;
			levelUpBtn.addEventListener('click', async () => {
				console.info('AppInitializer', '[LevelUp] Button clicked');
				try {
					const character = AppState.getCurrentCharacter();
					if (!character) {
						console.warn('AppInitializer', '[LevelUp] No current character');
						showNotification('No character selected', 'warning');
						return;
					}

					if (!levelUpModalInstance) {
						console.debug('AppInitializer', '[LevelUp] Importing LevelUpModal');
						const { LevelUpModal } = await import('../ui/components/level/Modal.js');
						levelUpModalInstance = new LevelUpModal();
					}
					console.debug('AppInitializer', '[LevelUp] Showing modal via controller');
					await levelUpModalInstance.show();
				} catch (error) {
					console.error('AppInitializer', 'Failed to open Level Up modal', error);
					// Fallback: attempt to open the modal directly if Bootstrap is available and element exists
					try {
						const el = document.getElementById('levelUpModal');
						const bs = window.bootstrap || globalThis.bootstrap;
						if (el && bs) {
							console.warn('AppInitializer', '[LevelUp] Falling back to direct Bootstrap.Modal.show()');
							new bs.Modal(el, { backdrop: true, keyboard: true }).show();
							showNotification('Level Up modal opened with fallback', 'warning');
						} else {
							showNotification('Failed to open Level Up modal', 'error');
						}
					} catch (fallbackErr) {
						console.error('AppInitializer', '[LevelUp] Fallback open failed', fallbackErr);
						showNotification('Failed to open Level Up modal', 'error');
					}
				}
			});
		} else {
			console.warn('AppInitializer', 'Level Up button not found');
		}

		console.info('AppInitializer', 'UI event handlers set up successfully');
	} catch (error) {
		console.error(
			'AppInitializer',
			'Error setting up UI event handlers',
			error,
		);
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
	// Prevent multiple simultaneous initializations
	if (_isInitializing) {
		console.warn('AppInitializer', 'Initialization already in progress, skipping');
		return { success: false, errors: ['Initialization already in progress'] };
	}

	if (_isInitialized) {
		console.info('AppInitializer', 'Application already initialized, cleaning up for reload');
		// Clear event bus to prevent duplicate listeners
		eventBus.clearAll();
		_isInitialized = false;
	}

	_isInitializing = true;

	const result = {
		success: true,
		loadedComponents: [],
		errors: [],
	};

	// Validate required assets before UI loads
	const REQUIRED_ASSETS = [
		'assets/bootstrap/dist/css/bootstrap.min.css',
		'assets/fontawesome/css/all.min.css',
		'assets/fontawesome/webfonts/fa-solid-900.woff2',
	];
	const missingAssets = [];
	for (const relPath of REQUIRED_ASSETS) {
		const req = new XMLHttpRequest();
		req.open('HEAD', relPath, false);
		try {
			req.send();
			if (req.status !== 200) {
				missingAssets.push(relPath);
			}
		} catch {
			missingAssets.push(relPath);
		}
	}
	if (missingAssets.length > 0) {
		console.warn('Missing required assets:', missingAssets);
		if (window.FF_DEBUG) {
			alert(`Missing required assets: ${missingAssets.join(', ')}`);
		}
	}
	// Mark body with debug class early so debug-only UI is toggled before loading screen
	try {
		if (window.FF_DEBUG === true) {
			document.body.classList.add('debug-mode');
		} else {
			document.body.classList.remove('debug-mode');
		}
	} catch (error) {
		console.warn('AppInitializer', 'Unable to set debug body class', error);
	}

	// Initialize theme manager early
	try {
		themeManager.init(eventBus);
		result.loadedComponents.push('ThemeManager');
	} catch (error) {
		console.warn('AppInitializer', 'Failed to initialize theme manager', error);
		result.errors.push(error);
	}

	// Clean up any leftover loading modal from previous session (e.g., reload)
	const existingModal = document.getElementById('loadingModal');
	if (existingModal) {
		existingModal.classList.remove('show');
		existingModal.style.display = 'none';
		existingModal.setAttribute('aria-hidden', 'true');
		existingModal.removeAttribute('aria-modal');
	}
	const existingBackdrops = document.querySelectorAll('.modal-backdrop');
	for (const backdrop of existingBackdrops) {
		backdrop.remove();
	}
	document.body.classList.remove('modal-open');
	document.body.style.overflow = '';
	document.body.style.paddingRight = '';

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

		// Step 0.5: Check for cached data and auto update setting
		const config = await window.app.settings.getAll();
		const cachePath = config.dataSourceCachePath;
		let hasCache = !!cachePath;
		// If local, treat as cached if valid
		if (config.dataSourceType === 'local' && config.dataSourceValue) {
			hasCache = true;
		}

		if (hasCache) {
			const autoUpdate = !!config.autoUpdateData;
			if (autoUpdate) {
				loadingModal.updateMessage('Updating data source...');
				loadingModal.updateProgress(15);
				try {
					const refreshResult = await window.app.refreshDataSource();
					if (!refreshResult?.success) {
						console.warn(
							'AppInitializer',
							`Data source update skipped/failed: ${refreshResult?.error || 'Unknown error'}`,
						);
						await _promptDataSourceFix(
							refreshResult?.error || 'Data source is invalid',
						);
						throw new Error('Data source update failed');
					} else {
						DataLoader.clearCache();
						console.info(
							'AppInitializer',
							'Checked data source for updates before load; cleared data cache',
						);
					}
				} catch (error) {
					console.warn('AppInitializer', 'Data source update failed', error);
				}
			} else {
				console.info(
					'AppInitializer',
					'Auto update disabled; skipping data sync',
				);
			}
		}

		// Step 1: Load all game data
		loadingModal.updateMessage('Loading game data...');
		loadingModal.updateProgress(30);
		const dataLoadResult = await _loadAllGameDataWithRetry();
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
		try {
			_setupUiEventHandlers();
		} catch (error) {
			console.error('AppInitializer', 'Error setting up UI event handlers:', error);
			result.errors.push(error);
		}

		// Set overall success based on whether any critical errors occurred
		result.success = result.errors.length === 0;

		// Hide loading modal before showing any notifications
		loadingModal.updateProgress(100);
		setTimeout(() => loadingModal.hide(), 200);

		if (!result.success) {
			console.warn(
				'AppInitializer',
				'Application initialized with errors:',
				result.errors,
			);
		}

		_isInitializing = false;
		_isInitialized = true;
		console.info('AppInitializer', 'Initialization complete');

		return result;
	} catch (error) {
		loadingModal.hide();
		_isInitializing = false;
		console.error(
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
		console.error('AppInitializer', 'Error during initialization:', error);
	});
});
