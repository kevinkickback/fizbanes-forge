/** Orchestrates renderer startup, data loading, and core component initialization. */

// Core imports - NEW ARCHITECTURE
import { eventBus } from '../lib/EventBus.js';

import { getNotificationCenter } from '../lib/NotificationCenter.js';
import { addPersistentNotification, showNotification } from '../lib/Notifications.js';
import { AppState } from './AppState.js';
import { NavigationController } from './NavigationController.js';
import { PageHandler } from './PageHandler.js';
import { themeManager } from './ThemeManager.js';
import { titlebarController } from './TitlebarController.js';
import { setupUiEventHandlers } from './UIHandlersInitializer.js';

// Modal for data configuration
import { DataConfigurationModal } from '../ui/components/setup/SetupDataConfiguration.js';
import { LoadingModal } from '../ui/components/setup/SetupModals.js';

// Service imports
import { DataLoader } from '../lib/DataLoader.js';
import { textProcessor } from '../lib/TextProcessor.js';
import { actionService } from '../services/ActionService.js';
import { backgroundService } from '../services/BackgroundService.js';
import { classService } from '../services/ClassService.js';
import { conditionService } from '../services/ConditionService.js';
import { deityService } from '../services/DeityService.js';
import { featService } from '../services/FeatService.js';
import { itemService } from '../services/ItemService.js';
import { monsterService } from '../services/MonsterService.js';
import { optionalFeatureService } from '../services/OptionalFeatureService.js';
import { raceService } from '../services/RaceService.js';
import { settingsService } from '../services/SettingsService.js';
import { skillService } from '../services/SkillService.js';
import { spellService } from '../services/SpellService.js';
import { variantRuleService } from '../services/VariantRuleService.js';

const MAX_DATA_LOAD_ATTEMPTS = 2;
const DATA_LOAD_BACKOFF_BASE_MS = 250; // Base delay for exponential backoff
const DATA_LOAD_BACKOFF_MAX_MS = 5000; // Max delay cap (5 seconds)

// Guard against multiple initializations
let _isInitialized = false;
let _isInitializing = false;
// Cleanup function for extracted UI handlers
let _uiHandlersCleanup = null;

// Track AppInitializer's own EventBus listeners for cleanup
const _appInitializerListeners = new Map();

function _sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}


function _updateServiceFailureBanner(failedServices = []) {
	const banner = document.getElementById('serviceFailureBanner');
	const list = document.getElementById('serviceFailureList');
	const reloadButton = document.getElementById('serviceReloadButton');

	if (!banner || !list) {
		return;
	}

	const hasFailures = Array.isArray(failedServices) && failedServices.length > 0;

	if (!hasFailures) {
		banner.style.display = 'none';
		banner.setAttribute('aria-hidden', 'true');
		list.textContent = '';
		return;
	}

	list.textContent = `Failed to load: ${failedServices.join(', ')}`;
	banner.style.display = 'flex';
	banner.setAttribute('aria-hidden', 'false');

	if (reloadButton && !reloadButton.dataset.bound) {
		reloadButton.dataset.bound = 'true';
		reloadButton.addEventListener('click', () => window.location.reload());
	}
}

/**
 * Calculate exponential backoff delay.
 * Formula: base * (2^(attempt-1)), capped at max.
 * @param {number} attempt - Attempt number (1-indexed)
 * @returns {number} Delay in milliseconds
 */
function _calculateExponentialBackoff(attempt) {
	if (attempt <= 1) return 0;
	// base * 2^(attempt-1): 250ms, 500ms, 1000ms, 2000ms, 4000ms, capped at 5000ms
	const delay = DATA_LOAD_BACKOFF_BASE_MS * 2 ** (attempt - 2);
	return Math.min(delay, DATA_LOAD_BACKOFF_MAX_MS);
}

async function _loadDataWithErrorHandling(promise, component, loadingModal) {
	try {
		if (loadingModal) {
			loadingModal.updateDetail(`Loading ${component}...`);
		}
		await promise;
		return { ok: true, error: null };
	} catch (error) {
		console.warn('AppInitializer', `Failed to load ${component} data:`, error);
		return { ok: false, error };
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

async function _loadAllGameData(loadingModal) {
	const errors = [];
	const failedServices = [];
	try {
		// Get data source info for display
		const dataSource = await window.app.getDataSource();
		const sourceType = dataSource?.type || 'unknown';
		const sourceValue = dataSource?.value || '';

		let sourceDesc = '';
		if (sourceType === 'local') {
			// Extract just the folder name for brevity
			const parts = sourceValue.split(/[\\/]/);
			const folderName = parts[parts.length - 1] || parts[parts.length - 2] || 'local folder';
			sourceDesc = `local: ${folderName}`;
		} else if (sourceType === 'url') {
			try {
				const url = new URL(sourceValue);
				sourceDesc = `remote: ${url.hostname}`;
			} catch {
				sourceDesc = 'remote server';
			}
		} else {
			sourceDesc = sourceType;
		}

		if (loadingModal) {
			loadingModal.updateDetail(`Data source: ${sourceDesc}`);
		}

		// Initialize all services in parallel for faster loading
		const services = [
			{ name: 'spells', init: () => spellService.initialize() },
			{ name: 'items', init: () => itemService.initialize() },
			{ name: 'classes', init: () => classService.initialize() },
			{ name: 'races', init: () => raceService.initialize() },
			{ name: 'backgrounds', init: () => backgroundService.initialize() },
			{ name: 'conditions', init: () => conditionService.initialize() },
			{ name: 'monsters', init: () => monsterService.initialize() },
			{ name: 'feats', init: () => featService.initialize() },
			{ name: 'skills', init: () => skillService.initialize() },
			{ name: 'actions', init: () => actionService.initialize() },
			{ name: 'deities', init: () => deityService.initialize() },
			{ name: 'variant rules', init: () => variantRuleService.initialize() },
			{ name: 'optional features', init: () => optionalFeatureService.initialize() },
		];

		// Load all services in parallel using Promise.allSettled
		const results = await Promise.allSettled(
			services.map(service => _loadDataWithErrorHandling(
				service.init(),
				service.name,
				loadingModal,
			)),
		);

		// Process results
		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			const service = services[i];

			if (result.status === 'fulfilled') {
				const loadResult = result.value;
				if (!loadResult?.ok) {
					failedServices.push(service.name);
					if (loadResult?.error) {
						errors.push(loadResult.error);
					} else {
						errors.push(new Error(`Failed to load ${service.name}`));
					}
				}
			} else {
				// Promise rejected
				failedServices.push(service.name);
				errors.push(result.reason || new Error(`Failed to load ${service.name}`));
			}
		}

		if (loadingModal) {
			if (failedServices.length > 0) {
				loadingModal.updateDetail(
					`Failed to load: ${failedServices.join(', ')}`,
				);
			} else {
				loadingModal.updateDetail('All game data loaded');
			}
		}
		return { success: failedServices.length === 0, errors, failedServices };
	} catch (error) {
		console.error('AppInitializer', 'Error during game data loading:', error);
		errors.push(error);
		return { success: false, errors, failedServices };
	}
}

async function _loadAllGameDataWithRetry() {
	let lastError = null;
	for (let attempt = 1; attempt <= MAX_DATA_LOAD_ATTEMPTS; attempt++) {
		const delayMs = _calculateExponentialBackoff(attempt);
		if (delayMs > 0) {
			console.debug(
				'AppInitializer',
				`Retry attempt ${attempt} in ${delayMs}ms...`,
			);
			await _sleep(delayMs);
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

		const loadResult = await _loadAllGameData(null);
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

// UI event handlers extracted to UIHandlersInitializer

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
		// Remove only AppInitializer's listeners to prevent duplicate listeners
		for (const [event, handler] of _appInitializerListeners) {
			eventBus.off(event, handler);
		}
		_appInitializerListeners.clear();
		// Clean up extracted UI handlers
		if (_uiHandlersCleanup) {
			try { _uiHandlersCleanup(); } catch { }
			_uiHandlersCleanup = null;
		}
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

				// Get data source info for display
				const dataSource = await window.app.getDataSource();
				const sourceType = dataSource?.type || 'unknown';
				const sourceValue = dataSource?.value || '';

				let sourceDesc = '';
				if (sourceType === 'local') {
					const parts = sourceValue.split(/[\\\\/]/);
					const folderName = parts[parts.length - 1] || parts[parts.length - 2] || 'local folder';
					sourceDesc = `local: ${folderName}`;
					loadingModal.updateDetail(`Checking ${sourceDesc} for changes...`);
				} else if (sourceType === 'url') {
					try {
						const url = new URL(sourceValue);
						sourceDesc = `remote: ${url.hostname}`;
						loadingModal.updateDetail(`Connecting to ${url.hostname}...`);
					} catch {
						sourceDesc = 'remote server';
						loadingModal.updateDetail('Connecting to remote server...');
					}
				}

				// Set up progress listener for download updates
				const progressListener = (progress) => {
					if (progress.status === 'start') {
						loadingModal.updateDetail(`Checking ${progress.total} files...`);
					} else if (progress.status === 'progress' && progress.file) {
						const fileName = progress.file.split('/').pop();
						// Show whether file is being downloaded or just verified
						if (progress.skipped) {
							loadingModal.updateDetail(`Verified: ${fileName} (${progress.completed}/${progress.total})`);
						} else {
							loadingModal.updateDetail(`Downloading: ${fileName} (${progress.completed}/${progress.total})`);
						}
					} else if (progress.status === 'complete') {
						if (progress.downloaded > 0) {
							loadingModal.updateDetail(`Downloaded ${progress.downloaded} file(s), ${progress.skipped || 0} unchanged`);
						} else {
							loadingModal.updateDetail('All files up to date');
						}
					}
				};

				const unsubscribe = window.app.onDataDownloadProgress(progressListener);

				try {
					const refreshResult = await window.app.refreshDataSource();

					// Clean up listener
					unsubscribe();

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
					// Clean up listener on error
					unsubscribe();
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
		loadingModal.updateDetail('');
		loadingModal.updateProgress(30);
		const dataLoadResult = await _loadAllGameData(loadingModal);
		AppState.setFailedServices(dataLoadResult.failedServices || []);
		_updateServiceFailureBanner(dataLoadResult.failedServices || []);
		if (dataLoadResult.failedServices?.length) {
			showNotification(
				`Some game data failed to load: ${dataLoadResult.failedServices.join(', ')}`,
				'warning',
			);
			addPersistentNotification(
				`Some game data failed to load: ${dataLoadResult.failedServices.join(', ')}`,
				'warning',
			);
		}
		if (!dataLoadResult.success) {
			result.errors.push(...dataLoadResult.errors);
		}

		// Step 2: Initialize core components
		loadingModal.updateMessage('Initializing components...');
		loadingModal.updateDetail('Setting up UI controllers...');
		loadingModal.updateProgress(70);
		const componentsResult = await _initializeCoreComponents();
		result.loadedComponents = componentsResult.loadedComponents;
		result.errors.push(...componentsResult.errors);

		// Step 3: Set up UI event handlers
		loadingModal.updateMessage('Setting up UI...');
		loadingModal.updateDetail('Registering event handlers...');
		loadingModal.updateProgress(90);
		try {
			_uiHandlersCleanup = setupUiEventHandlers();
		} catch (error) {
			console.error('AppInitializer', 'Error setting up UI event handlers:', error);
			result.errors.push(error);
		}

		// Set overall success based on whether any critical errors occurred
		result.success = result.errors.length === 0;

		// Hide loading modal before showing any notifications
		loadingModal.updateProgress(100);
		loadingModal.updateDetail('Ready');
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
