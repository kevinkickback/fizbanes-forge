/**
 * SettingsManager.js
 * Manages application settings and configuration
 */
import { showNotification } from '../utils/notifications.js';
import { storage } from '../utils/Storage.js';
import { eventEmitter } from '../utils/EventEmitter.js';

/**
 * Manages application settings and configuration
 */
export class SettingsManager {
    /**
     * Creates a new SettingsManager instance
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
            return;
        }

        try {
            console.debug('Initializing settings manager');

            // Update save path display
            await this.updateSavePathDisplay();

            // Set up event listeners
            this.initializeEventListeners();

            this._initialized = true;
            eventEmitter.emit('settingsManager:initialized', this);
        } catch (error) {
            console.error('Error initializing settings manager:', error);
            showNotification('Failed to initialize settings', 'danger');
            throw error;
        }
    }

    /**
     * Updates the save path display in the UI
     * @returns {Promise<void>}
     * @private
     */
    async updateSavePathDisplay() {
        try {
            const saveLocationElement = document.getElementById('currentSaveLocation');
            if (saveLocationElement) {
                // Get the current save path from the main process
                const currentPath = await window.characterStorage.getDefaultSavePath();
                saveLocationElement.textContent = currentPath || 'Using default save location';
            }
        } catch (error) {
            console.error('Error updating save path display:', error);
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
                            const saveResult = await window.characterStorage.setSavePath(result.path);
                            if (saveResult.success) {
                                showNotification('Save path updated successfully', 'success');
                                await this.updateSavePathDisplay();
                                eventEmitter.emit('settings:savePathChanged', result.path);
                            }
                        }
                    } catch (error) {
                        console.error('Error selecting folder:', error);
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
                            eventEmitter.emit('settings:savePathReset');
                        }
                    } catch (error) {
                        console.error('Error resetting save path:', error);
                        showNotification('Error resetting save path', 'error');
                    }
                });
            }
        } catch (error) {
            console.error('Error initializing settings event listeners:', error);
            showNotification('Failed to initialize settings controls', 'danger');
        }
    }
}

/**
 * Export the singleton instance
 * @type {SettingsManager}
 */
export const settingsManager = new SettingsManager(); 