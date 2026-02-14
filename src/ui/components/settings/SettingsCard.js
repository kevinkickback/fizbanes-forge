/**
 * SettingsCard - UI component for the settings page
 * Handles all DOM manipulation and user interactions for settings
 */

import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { DataConfigurationModal } from '../setup/SetupDataConfiguration.js';
import { RefreshProgressModal } from '../setup/SetupModals.js';

export class SettingsCard {
    constructor() {
        this._cleanup = DOMCleanup.create();
        this._initialized = false;
        this.autoUpdateData = false;
    }

    async initialize() {
        if (this._initialized) return;

        try {
            // Update app data path display
            await this._updateAppDataPathDisplay();

            // Update data source display
            await this._updateDataSourceDisplay();

            // Load auto update setting and set checkbox
            const config = await window.app.settings.getAll();
            this.autoUpdateData = !!config.autoUpdateData;
            const autoUpdateCheckbox = document.getElementById('autoUpdateDataCheckbox');
            if (autoUpdateCheckbox) {
                autoUpdateCheckbox.checked = this.autoUpdateData;
            }

            // Set up event listeners for the page elements
            this._initializeEventListeners();

            this._initialized = true;
        } catch (error) {
            console.error('[SettingsCard]', 'Error initializing', error);
            showNotification('Failed to initialize settings page', 'danger');
        }
    }

    async _updateAppDataPathDisplay() {
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
                if (charactersPreviewElement) {
                    charactersPreviewElement.textContent = 'Using default location';
                }
                if (portraitsPreviewElement) {
                    portraitsPreviewElement.textContent = 'Using default location';
                }
            }
        } catch (error) {
            console.error('[SettingsCard]', 'Error updating app data path display', error);
            showNotification('Error updating app data path display', 'error');
        }
    }

    async _updateDataSourceDisplay() {
        try {
            const dataSourceDisplay = document.getElementById('dataSourceStatus');
            if (!dataSourceDisplay) return;

            // Get data source configuration from settings
            const config = await window.app.settings.getAll();
            const sourceType = config.dataSourceType;
            const sourceValue = config.dataSourceValue;

            if (!sourceType || !sourceValue) {
                dataSourceDisplay.textContent =
                    'No data source configured - Click "Reconfigure" to set up.';
                return;
            }

            // Use textContent for better security, build string instead of HTML
            if (sourceType === 'url') {
                dataSourceDisplay.textContent = `Source Type: URL\nURL: ${sourceValue}`;
            } else if (sourceType === 'local') {
                dataSourceDisplay.textContent = `Source Type: Local Folder\nPath: ${sourceValue}`;
                dataSourceDisplay.style.whiteSpace = 'pre-line';
            }
        } catch (error) {
            console.error('[SettingsCard]', 'Error updating data source display', error);
            const dataSourceDisplay = document.getElementById('dataSourceStatus');
            if (dataSourceDisplay) {
                dataSourceDisplay.textContent = 'Error loading data source configuration';
            }
        }
    }

    _initializeEventListeners() {
        try {
            // App data path controls
            const chooseAppDataButton = document.getElementById('chooseAppDataFolderBtn');
            const resetAppDataButton = document.getElementById('resetAppDataFolderBtn');
            const reconfigureButton = document.getElementById('reconfigureDataSourceBtn');
            const refreshButton = document.getElementById('refreshDataSourceBtn');
            const autoUpdateCheckbox = document.getElementById('autoUpdateDataCheckbox');

            // Auto update data checkbox
            if (autoUpdateCheckbox) {
                this._cleanup.on(autoUpdateCheckbox, 'change', async (e) => {
                    const checked = !!e.target.checked;
                    this.autoUpdateData = checked;
                    await window.app.settings.set('autoUpdateData', checked);
                });
            }

            // App data path browse
            if (chooseAppDataButton) {
                this._cleanup.on(chooseAppDataButton, 'click', async () => {
                    try {
                        const result = await window.app.selectFolder();
                        if (result.success) {
                            // Set the base path; character storage will append /characters
                            const sep = result.path.includes('\\') ? '\\' : '/';
                            const charactersPath = `${result.path}${sep}characters`;

                            const saveResult =
                                await window.characterStorage.setSavePath(charactersPath);
                            if (saveResult.success) {
                                showNotification('App data path updated successfully', 'success');
                                await this._updateAppDataPathDisplay();
                                eventBus.emit(EVENTS.SETTINGS_SAVE_PATH_CHANGED, charactersPath);
                            }
                        }
                    } catch (error) {
                        console.error('[SettingsCard]', 'Error selecting app data folder', error);
                        showNotification('Error selecting app data folder', 'error');
                    }
                });
            }

            // App data path reset
            if (resetAppDataButton) {
                this._cleanup.on(resetAppDataButton, 'click', async () => {
                    try {
                        const saveResult = await window.characterStorage.setSavePath(null);
                        if (saveResult.success) {
                            showNotification('App data path reset successfully', 'success');
                            await this._updateAppDataPathDisplay();
                            eventBus.emit(EVENTS.SETTINGS_SAVE_PATH_RESET);
                        }
                    } catch (error) {
                        console.error('[SettingsCard]', 'Error resetting app data path', error);
                        showNotification('Error resetting app data path', 'error');
                    }
                });
            }

            // Data source reconfiguration
            if (reconfigureButton) {
                this._cleanup.on(reconfigureButton, 'click', async () => {
                    try {
                        const modal = new DataConfigurationModal({ allowClose: true });
                        const result = await modal.show();

                        await this._updateDataSourceDisplay();
                        eventBus.emit(EVENTS.DATA_SOURCE_CHANGED, result);
                    } catch (error) {
                        if (error.message === 'Modal closed by user') return;

                        console.error('[SettingsCard]', 'Error reconfiguring data source', error);
                        showNotification('Error reconfiguring data source', 'error');
                    }
                });
            }

            // Data source refresh
            if (refreshButton) {
                this._cleanup.on(refreshButton, 'click', async () => {
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
                        console.error('[SettingsCard]', 'Error refreshing data source', error);
                        showNotification('Error refreshing data source', 'error');

                        if (unsubscribe) unsubscribe();
                        if (progressModal) progressModal.hide();
                    }
                });
            }
        } catch (error) {
            console.error('[SettingsCard]', 'Error initializing event listeners', error);
        }
    }

    cleanup() {
        this._cleanup.cleanup();
        this._initialized = false;
    }
}
