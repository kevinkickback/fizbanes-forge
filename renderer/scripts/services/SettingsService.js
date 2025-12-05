/**
 * SettingsService.js
 * Manages application settings and configuration
 */
import { Logger } from '../infrastructure/Logger.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
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
	 * Initializes event listeners for settings controls
	 * @private
	 */
	initializeEventListeners() {
		try {
			// Set up settings buttons
			const browseButton = document.getElementById('chooseFolderBtn');
			const resetButton = document.getElementById('resetFolderBtn');

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
