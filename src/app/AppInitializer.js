import { DataLoader } from '../lib/DataLoader.js';
import { DataError } from '../lib/Errors.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { cleanupOrphanedBackdrops } from '../lib/ModalCleanupUtility.js';
import { getNotificationCenter } from '../lib/NotificationCenter.js';
import {
	addPersistentNotification,
	showNotification,
} from '../lib/Notifications.js';
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
import { DataConfigurationModal } from '../ui/components/setup/SetupDataConfiguration.js';
import { LoadingModal } from '../ui/components/setup/SetupModals.js';
import { AppState } from './AppState.js';
import { Modal } from './Modal.js';
import { NavigationController } from './NavigationController.js';
import { PageHandler } from './PageHandler.js';
import { themeManager } from './ThemeManager.js';
import { titlebarController } from './TitlebarController.js';
import { setupUiEventHandlers } from './UIHandlersInitializer.js';

if (!window.FF_DEBUG) {
	console.debug = () => { };
}

let _isInitialized = false;
let _isInitializing = false;
let _uiHandlersCleanup = null;
const _appInitializerListeners = new Map();

function _getDataSourceDescription(type, value) {
	if (type === 'local') {
		const parts = value.split(/[\\/]/);
		const folderName =
			parts[parts.length - 1] || parts[parts.length - 2] || 'local folder';
		return `local: ${folderName}`;
	}
	if (type === 'url') {
		try {
			const url = new URL(value);
			return `remote: ${url.hostname}`;
		} catch {
			return 'remote server';
		}
	}
	return type;
}

function _updateServiceFailureBanner(failedServices = []) {
	const banner = document.getElementById('serviceFailureBanner');
	const list = document.getElementById('serviceFailureList');
	const reloadButton = document.getElementById('serviceReloadButton');

	if (!banner || !list) return;

	const hasFailures =
		Array.isArray(failedServices) && failedServices.length > 0;

	if (!hasFailures) {
		banner.classList.add('u-hidden');
		banner.setAttribute('aria-hidden', 'true');
		list.textContent = '';
		return;
	}

	list.textContent = `Failed to load: ${failedServices.join(', ')}`;
	banner.classList.remove('u-hidden');
	banner.setAttribute('aria-hidden', 'false');

	if (reloadButton && !reloadButton.dataset.bound) {
		reloadButton.dataset.bound = 'true';
		reloadButton.addEventListener('click', () => window.location.reload());
	}
}

async function _loadDataWithErrorHandling(promise, component) {
	try {
		await promise;
		return { ok: true, error: null };
	} catch (error) {
		console.warn('[AppInitializer]', `Failed to load ${component}:`, error);
		return { ok: false, error };
	}
}

async function _checkDataFolder() {
	try {
		const saved = await window.app.getDataSource();
		if (saved?.success && saved.type && saved.value) {
			console.debug('[AppInitializer]', 'Using data source:', saved.type);
			return true;
		}

		console.warn(
			'[AppInitializer]',
			'No data source configured, showing configuration modal',
		);

		const modal = new DataConfigurationModal();
		const result = await modal.show();

		console.debug('[AppInitializer]', 'User configured data source:', result.type);
		return true;
	} catch (error) {
		console.error('[AppInitializer]', 'Error checking data folder:', error);
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
		`Data source error: ${errorMessage || 'Unknown issue'}. Please reconfigure.`,
		'error',
	);

	try {
		const modal = new DataConfigurationModal({ allowClose: true });
		await modal.show();
	} catch (error) {
		console.warn('[AppInitializer]', 'User dismissed data source fix modal', error);
		throw error;
	}
}

async function _loadAllGameData(loadingModal) {
	const errors = [];
	const failedServices = [];

	try {
		const dataSource = await window.app.getDataSource();
		const sourceDesc = _getDataSourceDescription(
			dataSource?.type || 'unknown',
			dataSource?.value || '',
		);

		if (loadingModal) {
			loadingModal.updateDetail(`Data source: ${sourceDesc}`);
			loadingModal.updateDetail('Loading game data...');
		}

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
			{
				name: 'optional features',
				init: () => optionalFeatureService.initialize(),
			},
		];

		const results = await Promise.allSettled(
			services.map((service) =>
				_loadDataWithErrorHandling(service.init(), service.name),
			),
		);

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
				failedServices.push(service.name);
				errors.push(
					result.reason || new Error(`Failed to load ${service.name}`),
				);
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
		console.error('[AppInitializer]', 'Error during game data loading:', error);
		errors.push(error);
		return { success: false, errors, failedServices };
	}
}

async function _initializeComponent(name, initFunction) {
	try {
		await initFunction();
		return { success: true, error: null };
	} catch (error) {
		console.error('[AppInitializer]', `Error initializing ${name}:`, error);
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
			{ name: 'modal', init: () => Modal.getInstance().ensureInitialized() },
		];

		for (const component of components) {
			const initResult = await _initializeComponent(
				component.name,
				component.init,
			);

			if (initResult.success) {
				result.loadedComponents.push(component.name);
				console.debug('[AppInitializer]', `✓ ${component.name} initialized`);
			} else {
				result.errors.push(initResult.error);
				console.error(
					'[AppInitializer]',
					`✗ ${component.name} failed`,
					initResult.error,
				);
			}
		}

		result.success = result.errors.length === 0;

		console.debug('[AppInitializer]', 'Core components initialized', {
			success: result.success,
			loaded: result.loadedComponents.length,
			errors: result.errors.length,
		});

		return result;
	} catch (error) {
		console.error(
			'[AppInitializer]',
			'Unexpected error during core component initialization:',
			error,
		);
		result.success = false;
		result.errors.push(error);
		return result;
	}
}

export async function initializeAll() {
	if (_isInitializing) {
		console.warn('[AppInitializer]', 'Initialization already in progress');
		return { success: false, errors: ['Initialization already in progress'] };
	}

	if (_isInitialized) {
		console.info('[AppInitializer]', 'Already initialized, cleaning up for reload');
		for (const [event, handler] of _appInitializerListeners) {
			eventBus.off(event, handler);
		}
		_appInitializerListeners.clear();
		if (_uiHandlersCleanup) {
			try {
				_uiHandlersCleanup();
			} catch { }
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

	if (window.FF_DEBUG === true) {
		document.body.classList.add('debug-mode');

		// Expose debug utilities to DevTools console
		window.__debug = {
			eventBus,
			history: (eventName = null) => eventBus.getHistory(eventName),
			metrics: (eventName = null) => eventBus.getMetrics(eventName),
			clearHistory: () => eventBus.clearHistory(),
			clearMetrics: () => eventBus.clearMetrics(),
			enable: () => eventBus.enableDebugMode(),
			disable: () => eventBus.disableDebugMode(),
		};
		console.log('[AppInitializer] Debug utilities available via window.__debug');
	} else {
		document.body.classList.remove('debug-mode');
		delete window.__debug;
	}

	try {
		themeManager.init(eventBus);
		result.loadedComponents.push('ThemeManager');
	} catch (error) {
		console.warn('[AppInitializer]', 'Failed to initialize theme manager', error);
		result.errors.push(error);
	}

	const existingModal = document.getElementById('loadingModal');
	if (existingModal) {
		existingModal.classList.remove('show');
		existingModal.style.display = 'none';
		existingModal.setAttribute('aria-hidden', 'true');
		existingModal.removeAttribute('aria-modal');
	}

	try {
		cleanupOrphanedBackdrops();
	} catch (error) {
		console.warn('[AppInitializer]', 'Error cleaning up backdrops', error);
	}

	const existingBackdrops = document.querySelectorAll('.modal-backdrop');
	for (const backdrop of existingBackdrops) {
		backdrop.remove();
	}
	document.body.classList.remove('modal-open');
	document.body.style.overflow = '';
	document.body.style.paddingRight = '';

	const loadingModal = new LoadingModal();
	loadingModal.show();

	let isGameDataLoading = false;
	const getLoadLabel = (url = '') => {
		const normalized = String(url).toLowerCase();
		if (!normalized) return null;
		if (normalized.includes('spells/')) return 'spells';
		if (normalized.includes('items')) return 'items';
		if (normalized.includes('class/')) return 'classes';
		if (normalized.includes('races')) return 'races';
		if (normalized.includes('backgrounds')) return 'backgrounds';
		if (normalized.includes('conditionsdiseases')) return 'conditions';
		if (normalized.includes('bestiary')) return 'monsters';
		if (normalized.includes('feats')) return 'feats';
		if (normalized.includes('skills')) return 'skills';
		if (normalized.includes('actions')) return 'actions';
		if (normalized.includes('deities')) return 'deities';
		if (normalized.includes('variantrules')) return 'variant rules';
		if (normalized.includes('optionalfeatures')) return 'optional features';
		return null;
	};

	const onDataFileLoading = (payload = {}) => {
		if (!loadingModal || !isGameDataLoading || !payload.url) return;
		const label = getLoadLabel(payload.url);
		if (label) {
			loadingModal.updateDetail(`Loading ${label}...`);
		}
	};
	eventBus.on(EVENTS.DATA_FILE_LOADING, onDataFileLoading);
	_appInitializerListeners.set(EVENTS.DATA_FILE_LOADING, onDataFileLoading);

	try {
		loadingModal.updateDetail('Checking data files...');
		loadingModal.updateProgress(5);

		const saved = await window.app.getDataSource();
		if (!saved?.success || !saved.type || !saved.value) {
			loadingModal.hide();
		}

		const dataReady = await _checkDataFolder();
		if (!dataReady) {
			throw new DataError('Data folder not configured');
		}

		if (!saved?.success || !saved.type || !saved.value) {
			loadingModal.show();
		}

		const config = await window.app.settings.getAll();
		const cachePath = config.dataSourceCachePath;
		const hasCache =
			config.dataSourceType === 'local' ||
			(config.dataSourceType === 'url' && cachePath);

		console.debug('[AppInitializer]', 'Data source check:', {
			type: config.dataSourceType,
			value: config.dataSourceValue,
			hasCache,
			cachePath,
		});

		if (!hasCache && config.dataSourceType === 'url') {
			console.info('[AppInitializer]', 'Remote source with no cache, downloading');
			loadingModal.updateProgress(15);
			loadingModal.updateDetail('Connecting to remote server...');

			const progressListener = (progress) => {
				if (progress.status === 'start') {
					loadingModal.updateDetail(`Downloading ${progress.total} files...`);
				} else if (progress.status === 'progress' && progress.file) {
					const fileName = progress.file.split('/').pop();
					loadingModal.updateDetail(
						`Downloading: ${fileName} (${progress.completed}/${progress.total})`,
					);
				} else if (progress.status === 'complete') {
					loadingModal.updateDetail(
						`Downloaded ${progress.downloaded} file(s)`,
					);
				}
			};

			const unsubscribe = window.app.onDataDownloadProgress(progressListener);

			try {
				const refreshResult = await window.app.refreshDataSource();
				if (!refreshResult?.success) {
					throw new DataError(refreshResult?.error || 'Failed to download data');
				}
			} catch (error) {
				console.error('[AppInitializer]', 'Failed to download data:', error);
				showNotification(`Failed to download data: ${error.message}`, 'error');
				throw error;
			} finally {
				unsubscribe?.();
			}
		}

		if (hasCache && !window.FF_DEBUG) {
			const autoUpdate = !!config.autoUpdateData;
			const shouldRefresh = autoUpdate;

			console.debug('[AppInitializer]', 'Cache check:', {
				hasCache,
				autoUpdate,
				shouldRefresh,
			});

			if (shouldRefresh) {
				console.debug('[AppInitializer]', 'Calling refreshDataSource');
				loadingModal.updateProgress(15);

				const dataSource = await window.app.getDataSource();
				const sourceDesc = _getDataSourceDescription(
					dataSource?.type || 'unknown',
					dataSource?.value || '',
				);

				if (dataSource?.type === 'local') {
					loadingModal.updateDetail(`Checking ${sourceDesc} for changes...`);
				} else if (dataSource?.type === 'url') {
					loadingModal.updateDetail(
						autoUpdate
							? `Connecting to ${sourceDesc.replace('remote: ', '')}...`
							: `Downloading from ${sourceDesc.replace('remote: ', '')}...`,
					);
				}

				const progressListener = (progress) => {
					if (progress.status === 'start') {
						loadingModal.updateDetail(`Checking ${progress.total} files...`);
					} else if (progress.status === 'progress' && progress.file) {
						const fileName = progress.file.split('/').pop();
						if (progress.skipped) {
							loadingModal.updateDetail(
								`Verified: ${fileName} (${progress.completed}/${progress.total})`,
							);
						} else {
							loadingModal.updateDetail(
								`Downloading: ${fileName} (${progress.completed}/${progress.total})`,
							);
						}
					} else if (progress.status === 'complete') {
						if (progress.downloaded > 0) {
							loadingModal.updateDetail(
								`Downloaded ${progress.downloaded} file(s), ${progress.skipped || 0} unchanged`,
							);
						} else {
							loadingModal.updateDetail('All files up to date');
						}
					}
				};

				const unsubscribe = window.app.onDataDownloadProgress(progressListener);

				try {
					console.debug('[AppInitializer]', 'Calling refreshDataSource');
					const refreshResult = await window.app.refreshDataSource();
					console.debug('[AppInitializer]', 'refreshDataSource result:', refreshResult);

					unsubscribe();

					if (!refreshResult?.success) {
						console.warn(
							'[AppInitializer]',
							`Data source update failed: ${refreshResult?.error || 'Unknown error'}`,
						);
						await _promptDataSourceFix(
							refreshResult?.error || 'Data source is invalid',
						);
						throw new DataError('Data source update failed');
					} else {
						DataLoader.resetAll();
						console.debug('[AppInitializer]', 'Checked/updated data source');
					}
				} catch (error) {
					unsubscribe();
					console.warn('[AppInitializer]', 'Data source update failed', error);
				}
			} else {
				console.debug('[AppInitializer]', 'Skipping data source refresh');
			}
		}

		loadingModal.updateProgress(30);
		isGameDataLoading = true;
		const dataLoadResult = await _loadAllGameData(loadingModal);
		isGameDataLoading = false;

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

		loadingModal.updateDetail('Setting up UI controllers...');
		loadingModal.updateProgress(70);
		const componentsResult = await _initializeCoreComponents();
		result.loadedComponents = componentsResult.loadedComponents;
		result.errors.push(...componentsResult.errors);

		loadingModal.updateDetail('Registering event handlers...');
		loadingModal.updateProgress(99);
		try {
			_uiHandlersCleanup = setupUiEventHandlers();
		} catch (error) {
			console.error('[AppInitializer]', 'Error setting up UI handlers:', error);
			result.errors.push(error);
		}

		result.success = result.errors.length === 0;

		loadingModal.updateProgress(100);
		loadingModal.updateDetail('Ready');

		// Wait a brief moment before hiding, then await the hide
		await new Promise(resolve => setTimeout(resolve, 200));
		await loadingModal.hide();

		if (!result.success) {
			console.warn('[AppInitializer]', 'Initialized with errors:', result.errors);
		}

		_isInitializing = false;
		_isInitialized = true;
		console.debug('[AppInitializer]', 'Initialization complete');

		return result;
	} catch (error) {
		loadingModal.hide();
		_isInitializing = false;
		console.error('[AppInitializer]', 'Fatal initialization error:', error);
		result.success = false;
		result.errors.push(error);
		throw error;
	}
}

document.addEventListener('DOMContentLoaded', () => {
	initializeAll().catch((error) => {
		console.error('[AppInitializer]', 'Error during initialization:', error);
	});
});
