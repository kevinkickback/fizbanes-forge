/** Manages application settings and configuration. */
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { showNotification } from '../lib/Notifications.js';
import { DataConfigurationModal } from '../ui/components/setup/DataConfiguration.js';
import { RefreshProgressModal } from '../ui/components/setup/Modals.js';

/** Manages application settings and configuration. */
export class SettingsService {
	/** Creates a new SettingsService instance. */
	constructor() {
		/**
		 * Flag to track initialization state
		 * @type {boolean}
		 * @private
		 */
		this._initialized = false;
		/**
		 * Cached auto update setting
		 * @type {boolean}
		 */
		this.autoUpdateData = false;
	}

	/**
	 * Initializes the settings manager
	 * @returns {Promise<void>}
	 */
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
			// Update save path display
			await this.updateSavePathDisplay();

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
	 * Updates the save path display in the UI
	 * @returns {Promise<void>}
	 * @private
	 */
	async updateSavePathDisplay() {
		try {
			const saveLocationElement = document.getElementById(
				'currentSaveLocation',
			);
			if (saveLocationElement) {
				// Get the current save path from the main process
				const currentPath = await window.characterStorage.getDefaultSavePath();
				saveLocationElement.textContent =
					currentPath || 'Using default save location';
			}
		} catch (error) {
			console.error(
				'SettingsService',
				'Error updating save path display',
				error,
			);
			showNotification('Error updating save path display', 'error');
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
			// Set up settings buttons
			const browseButton = document.getElementById('chooseFolderBtn');
			const resetButton = document.getElementById('resetFolderBtn');
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
					showNotification('Auto update data setting saved', 'success');
				});
			}

			if (browseButton) {
				browseButton.addEventListener('click', async () => {
					try {
						// These operations need to interact with the file system via IPC
						const result = await window.characterStorage.selectFolder();
						if (result.success) {
							const saveResult = await window.characterStorage.setSavePath(
								result.path,
							);
							if (saveResult.success) {
								showNotification('Save path updated successfully', 'success');
								await this.updateSavePathDisplay();
								eventBus.emit(EVENTS.SETTINGS_SAVE_PATH_CHANGED, result.path);
							}
						}
					} catch (error) {
						console.error('SettingsService', 'Error selecting folder', error);
						showNotification('Error selecting folder', 'error');
					}
				});
			}

			if (resetButton) {
				resetButton.addEventListener('click', async () => {
					try {
						// This needs to interact with the file system via IPC
						const saveResult = await window.characterStorage.setSavePath(null);
						if (saveResult.success) {
							showNotification('Save path reset successfully', 'success');
							await this.updateSavePathDisplay();
							eventBus.emit(EVENTS.SETTINGS_SAVE_PATH_RESET);
						}
					} catch (error) {
						console.error(
							'SettingsService',
							'Error resetting save path',
							error,
						);
						showNotification('Error resetting save path', 'error');
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

/**
 * Export the singleton instance
 * @type {SettingsService}
 */
export const settingsService = new SettingsService();
