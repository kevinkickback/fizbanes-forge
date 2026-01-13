/** Manages application settings and configuration. */
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { showNotification } from '../lib/Notifications.js';
import { DataConfigurationModal } from '../ui/components/setup/DataConfiguration.js';
import { RefreshProgressModal } from '../ui/components/setup/Modals.js';

/** Manages application settings and configuration. */
export class SettingsService {
	constructor() {
		this._initialized = false;
		this.autoUpdateData = false;
	}

	async initialize() {
		if (this._initialized) {
			console.debug('SettingsService', 'Already initialized');
			return;
		}

		try {
			console.info('SettingsService', 'Initializing settings manager');

			this._initialized = true;
			eventBus.emit(EVENTS.SERVICE_INITIALIZED, 'settings', this);
			console.info(
				'SettingsService',
				'Settings manager initialized successfully',
			);
		} catch (error) {
			console.error(
				'SettingsService',
				'Error initializing settings manager',
				error,
			);
			showNotification('Failed to initialize settings', 'danger');
			throw error;
		}
	}

	/**
	 * Initializes the settings page UI and event listeners
	 * Called when the settings page is loaded and rendered
	 * @returns {Promise<void>}
	 */
	async initializeSettingsPage() {
		try {
			// Update app data path display
			await this.updateAppDataPathDisplay();

			// Update data source display
			await this.updateDataSourceDisplay();

			// Load auto update setting and set checkbox
			const config = await window.app.settings.getAll();
			this.autoUpdateData = !!config.autoUpdateData;
			const autoUpdateCheckbox = document.getElementById(
				'autoUpdateDataCheckbox',
			);
			if (autoUpdateCheckbox) {
				autoUpdateCheckbox.checked = this.autoUpdateData;
			}

			// Set up event listeners for the page elements
			this.initializeEventListeners();
		} catch (error) {
			console.error(
				'SettingsService',
				'Error initializing settings page',
				error,
			);
			showNotification('Failed to initialize settings page', 'danger');
		}
	}

	/**
	 * Updates the app data path display and derived subpaths in the UI
	 * @returns {Promise<void>}
	 * @private
	 */
	async updateAppDataPathDisplay() {
		try {
			const charactersPreviewElement = document.getElementById('charactersPathPreview');
			const portraitsPreviewElement = document.getElementById('portraitsPathPreview');

			// Get the base app data path from character storage
			const characterPath = await window.characterStorage.getDefaultSavePath();

			if (characterPath && typeof characterPath === 'string') {
				// Derive base path from characters path (remove trailing /characters)
				const sep = characterPath.includes('\\') ? '\\' : '/';
				const idx = characterPath.lastIndexOf(sep);
				const basePath = idx > 0 ? characterPath.slice(0, idx) : characterPath;

				// Update derived paths preview
				if (charactersPreviewElement) {
					charactersPreviewElement.textContent = `${basePath}${sep}characters`;
				}
				if (portraitsPreviewElement) {
					portraitsPreviewElement.textContent = `${basePath}${sep}portraits`;
				}
			} else {
				if (charactersPreviewElement) charactersPreviewElement.textContent = 'Using default location';
				if (portraitsPreviewElement) portraitsPreviewElement.textContent = 'Using default location';
			}
		} catch (error) {
			console.error(
				'SettingsService',
				'Error updating app data path display',
				error,
			);
			showNotification('Error updating app data path display', 'error');
		}
	}

	/**
	 * Updates the data source display in the UI
	 * @returns {Promise<void>}
	 * @private
	 */
	async updateDataSourceDisplay() {
		try {
			const dataSourceDisplay = document.getElementById('dataSourceStatus');
			if (!dataSourceDisplay) return;

			// Get data source configuration from settings
			const config = await window.app.settings.getAll();
			const sourceType = config.dataSourceType;
			const sourceValue = config.dataSourceValue;

			if (!sourceType || !sourceValue) {
				dataSourceDisplay.innerHTML =
					'<strong>No data source configured</strong> - Click "Reconfigure" to set up.';
				return;
			}

			if (sourceType === 'url') {
				dataSourceDisplay.innerHTML = `
					<strong>Source Type:</strong> URL<br />
					<strong>URL:</strong> <code>${this._escapeHtml(sourceValue)}</code>
				`;
			} else if (sourceType === 'local') {
				dataSourceDisplay.innerHTML = `
					<strong>Source Type:</strong> Local Folder<br />
					<strong>Path:</strong> <code>${this._escapeHtml(sourceValue)}</code>
				`;
			}
		} catch (error) {
			console.error(
				'SettingsService',
				'Error updating data source display',
				error,
			);
			const dataSourceDisplay = document.getElementById('dataSourceStatus');
			if (dataSourceDisplay) {
				dataSourceDisplay.textContent =
					'Error loading data source configuration';
			}
		}
	}

	/**
	 * Escape HTML special characters for safe display
	 * @private
	 */
	_escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Initializes event listeners for settings controls
	 * @private
	 */
	initializeEventListeners() {
		try {
			// App data path controls
			const chooseAppDataButton = document.getElementById('chooseAppDataFolderBtn');
			const resetAppDataButton = document.getElementById('resetAppDataFolderBtn');
			const reconfigureButton = document.getElementById(
				'reconfigureDataSourceBtn',
			);
			const refreshButton = document.getElementById('refreshDataSourceBtn');
			const autoUpdateCheckbox = document.getElementById(
				'autoUpdateDataCheckbox',
			);
			// Auto update data checkbox
			if (autoUpdateCheckbox) {
				autoUpdateCheckbox.addEventListener('change', async (e) => {
					const checked = !!e.target.checked;
					this.autoUpdateData = checked;
					await window.app.settings.set('autoUpdateData', checked);
				});
			}

			// App data path browse
			if (chooseAppDataButton) {
				chooseAppDataButton.addEventListener('click', async () => {
					try {
						const result = await window.characterStorage.selectFolder();
						if (result.success) {
							// Set the base path; character storage will append /characters
							const sep = result.path.includes('\\') ? '\\' : '/';
							const charactersPath = `${result.path}${sep}characters`;

							const saveResult = await window.characterStorage.setSavePath(charactersPath);
							if (saveResult.success) {
								showNotification('App data path updated successfully', 'success');
								await this.updateAppDataPathDisplay();
								eventBus.emit(EVENTS.SETTINGS_SAVE_PATH_CHANGED, charactersPath);
							}
						}
					} catch (error) {
						console.error('SettingsService', 'Error selecting app data folder', error);
						showNotification('Error selecting app data folder', 'error');
					}
				});
			}

			// App data path reset
			if (resetAppDataButton) {
				resetAppDataButton.addEventListener('click', async () => {
					try {
						const saveResult = await window.characterStorage.setSavePath(null);
						if (saveResult.success) {
							showNotification('App data path reset successfully', 'success');
							await this.updateAppDataPathDisplay();
							eventBus.emit(EVENTS.SETTINGS_SAVE_PATH_RESET);
						}
					} catch (error) {
						console.error('SettingsService', 'Error resetting app data path', error);
						showNotification('Error resetting app data path', 'error');
					}
				});
			}

			// Data source reconfiguration
			if (reconfigureButton) {
				reconfigureButton.addEventListener('click', async () => {
					try {
						const modal = new DataConfigurationModal({ allowClose: true });
						const result = await modal.show();

						console.info(
							'SettingsService',
							'User reconfigured data source:',
							result.type,
						);
						showNotification('Data source updated successfully', 'success');
						await this.updateDataSourceDisplay();
						eventBus.emit(EVENTS.DATA_SOURCE_CHANGED, result);
					} catch (error) {
						// User closed modal without making changes - this is not an error
						if (error.message === 'Modal closed by user') {
							console.debug(
								'SettingsService',
								'Data source configuration cancelled by user',
							);
							return;
						}

						console.error(
							'SettingsService',
							'Error reconfiguring data source',
							error,
						);
						showNotification('Error reconfiguring data source', 'error');
					}
				});
			}

			// Data source refresh
			if (refreshButton) {
				refreshButton.addEventListener('click', async () => {
					let progressModal;
					let unsubscribe;
					try {
						const config = await window.app.settings.getAll();
						const sourceType = config.dataSourceType;
						const sourceValue = config.dataSourceValue;

						if (!sourceType || !sourceValue) {
							showNotification('No data source configured', 'warning');
							return;
						}

						progressModal = new RefreshProgressModal();
						progressModal.show();

						unsubscribe = window.app.onDataDownloadProgress((progress) => {
							let message = 'Checking for updates...';
							if (progress.status === 'start') {
								message = `Preparing to download ${progress.total} files...`;
							} else if (progress.status === 'progress') {
								message = `Downloaded: ${progress.file} (${progress.completed}/${progress.total})`;
							} else if (progress.status === 'complete') {
								message = `Complete! ${progress.completed} files updated, ${progress.skipped} unchanged.`;
							} else if (progress.status === 'error') {
								message = `Error: ${progress.error}`;
							}

							const percent =
								progress.total > 0
									? (progress.completed / progress.total) * 100
									: 0;
							progressModal.updateProgress(percent, message);
						});

						const result = await window.app.refreshDataSource();

						if (unsubscribe) unsubscribe();

						if (result.success) {
							progressModal.showCompletion(
								`Data source refreshed. ${result.downloaded} files updated, ${result.skipped} unchanged.`,
							);
						} else {
							progressModal.showCompletion(
								`Refresh failed: ${result.error || 'Unknown error'}`,
							);
						}
					} catch (error) {
						if (unsubscribe) unsubscribe();
						console.error(
							'SettingsService',
							'Error refreshing data source',
							error,
						);
						if (progressModal) {
							progressModal.showCompletion('Error refreshing data source');
						}
					}
				});
			}
		} catch (error) {
			console.error(
				'SettingsService',
				'Error initializing settings event listeners',
				error,
			);
			showNotification('Failed to initialize settings controls', 'danger');
		}
	}
}


export const settingsService = new SettingsService();
