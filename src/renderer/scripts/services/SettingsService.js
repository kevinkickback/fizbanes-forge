/**
 * SettingsService.js
 * Manages application settings and configuration
 */
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { Logger } from '../infrastructure/Logger.js';
import { DataConfigurationModal } from '../modules/setup/DataConfigurationModal.js';
import { showNotification } from '../utils/Notifications.js';

/**
 * Manages application settings and configuration
 */
export class SettingsService {
	/**
	 * Creates a new SettingsService instance
	 * @private
	 */
	constructor() {
		/**
		 * Flag to track initialization state
		 * @type {boolean}
		 * @private
		 */
		this._initialized = false;
	}

	/**
	 * Initializes the settings manager
	 * @returns {Promise<void>}
	 */
	async initialize() {
		if (this._initialized) {
			Logger.debug('SettingsService', 'Already initialized');
			return;
		}

		try {
			Logger.info('SettingsService', 'Initializing settings manager');

			this._initialized = true;
			eventBus.emit(EVENTS.SERVICE_INITIALIZED, 'settings', this);
			Logger.info(
				'SettingsService',
				'Settings manager initialized successfully',
			);
		} catch (error) {
			Logger.error(
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

			// Set up event listeners for the page elements
			this.initializeEventListeners();
		} catch (error) {
			Logger.error(
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
			Logger.error(
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
			Logger.error(
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
			const validateButton = document.getElementById('validateDataSourceBtn');

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
						Logger.error('SettingsService', 'Error selecting folder', error);
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
						Logger.error('SettingsService', 'Error resetting save path', error);
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

						Logger.info(
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
							Logger.debug(
								'SettingsService',
								'Data source configuration cancelled by user',
							);
							return;
						}

						Logger.error(
							'SettingsService',
							'Error reconfiguring data source',
							error,
						);
						showNotification('Error reconfiguring data source', 'error');
					}
				});
			}

			// Data source validation
			if (validateButton) {
				validateButton.addEventListener('click', async () => {
					try {
						const config = await window.app.settings.getAll();
						const sourceType = config.dataSourceType;
						const sourceValue = config.dataSourceValue;

						if (!sourceType || !sourceValue) {
							showNotification('No data source configured', 'warning');
							return;
						}

						// Re-validate the current configuration
						const result = await window.app.validateDataSource({
							type: sourceType,
							value: sourceValue,
						});

						if (result.success) {
							showNotification('Data source validation passed!', 'success');
						} else {
							showNotification(`Validation failed: ${result.error}`, 'error');
						}
					} catch (error) {
						Logger.error(
							'SettingsService',
							'Error validating data source',
							error,
						);
						showNotification('Error validating data source', 'error');
					}
				});
			}
		} catch (error) {
			Logger.error(
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
