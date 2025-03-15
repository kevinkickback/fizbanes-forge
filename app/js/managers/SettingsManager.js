// Settings management utilities
import { showNotification } from '../utils/notifications.js';

let instance = null;

export class SettingsManager {
    constructor() {
        if (instance) {
            throw new Error('SettingsManager is a singleton. Use SettingsManager.getInstance() instead.');
        }
        instance = this;
    }

    async updateSavePathDisplay() {
        try {
            // Get paths
            const appDataPath = await window.electron.app.getPath("userData");
            const defaultPath = await window.electron.ipc.invoke('get-default-save-path');

            // Set up save path display
            const savePathElement = document.getElementById('currentSaveLocation');
            if (savePathElement) {
                savePathElement.textContent = defaultPath || appDataPath;
            }
        } catch (error) {
            console.error('Error updating save path display:', error);
            showNotification('Failed to update save path display', 'danger');
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

    static getInstance() {
        if (!instance) {
            instance = new SettingsManager();
        }
        return instance;
    }
}

export const settingsManager = SettingsManager.getInstance(); 