/**
 * SettingsManager.js
 * Manages application settings and configuration
 */
import { showNotification } from '../utils/notifications.js';
import { storage } from '../utils/Storage.js';

export class SettingsManager {
    constructor() {
        this.initialize();
    }

    async initialize() {
        try {
            console.log('Initializing settings manager');

            // Update save path display
            await this.updateSavePathDisplay();

            // Set up event listeners
            this.initializeEventListeners();
        } catch (error) {
            console.error('Error initializing settings manager:', error);
            showNotification('Failed to initialize settings', 'danger');
        }
    }

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

export const settingsManager = new SettingsManager(); 