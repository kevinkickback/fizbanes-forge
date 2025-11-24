/**
 * PageHandler.js
 * Handles page-specific initialization after pages are loaded
 */

import { Logger } from '../infrastructure/Logger.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { CharacterManager } from './CharacterManager.js';
import { Modal } from './Modal.js';
import { settingsService } from '../services/SettingsService.js';
import { showNotification } from '../utils/Notifications.js';

class PageHandlerImpl {
    constructor() {
        this.isInitialized = false;
    }

    /**
     * Initialize the page handler to listen for page load events
     */
    initialize() {
        if (this.isInitialized) {
            Logger.warn('PageHandler', 'Already initialized');
            return;
        }

        // Listen for page loaded events
        eventBus.on(EVENTS.PAGE_LOADED, (pageName) => {
            this.handlePageLoaded(pageName);
        });

        this.isInitialized = true;
        Logger.info('PageHandler', 'Initialized successfully');
    }

    /**
     * Handle a page being loaded
     * @param {string} pageName - Name of the page that was loaded
     */
    async handlePageLoaded(pageName) {
        Logger.info('PageHandler', 'Handling page loaded', { pageName });

        try {
            switch (pageName) {
                case 'home':
                    await this.initializeHomePage();
                    break;
                case 'settings':
                    await this.initializeSettingsPage();
                    break;
                case 'build':
                    await this.initializeBuildPage();
                    break;
                default:
                    Logger.debug('PageHandler', 'No special initialization for page', { pageName });
            }
        } catch (error) {
            Logger.error('PageHandler', 'Error initializing page', { pageName, error });
        }
    }

    /**
     * Initialize the home page
     */
    async initializeHomePage() {
        Logger.info('PageHandler', 'Initializing home page');

        try {
            // Load character list
            const result = await CharacterManager.loadCharacterList();

            if (result.isOk()) {
                const characters = result.value;
                await this.renderCharacterList(characters);
            } else {
                Logger.error('PageHandler', 'Failed to load character list', result.error);
                showNotification('Failed to load characters', 'error');
            }

            // Setup Modal event listeners for New Character and Import buttons
            const modal = Modal.getInstance();
            modal.setupEventListeners({
                onShowModal: async (e) => {
                    await modal.showNewCharacterModal(e);
                },
                onCreateCharacter: async (character) => {
                    Logger.info('PageHandler', 'Character created', { id: character.id });
                    // Reload the character list
                    const reloadResult = await CharacterManager.loadCharacterList();
                    if (reloadResult.isOk()) {
                        await this.renderCharacterList(reloadResult.value);
                    }
                }
            });

            // Setup import character button
            const importButton = document.getElementById('importCharacterBtn');
            if (importButton) {
                // Remove any existing listeners
                const newImportButton = importButton.cloneNode(true);
                importButton.parentNode.replaceChild(newImportButton, importButton);

                newImportButton.addEventListener('click', async () => {
                    await this.handleImportCharacter();
                });
            }

        } catch (error) {
            Logger.error('PageHandler', 'Error initializing home page', error);
            showNotification('Error loading home page', 'error');
        }
    }

    /**
     * Render the character list on the home page
     * @param {Array} characters - Array of character objects
     */
    async renderCharacterList(characters) {
        const characterList = document.getElementById('characterList');

        if (!characterList) {
            Logger.warn('PageHandler', 'Character list element not found');
            return;
        }

        if (characters.length === 0) {
            characterList.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        No characters found. Click "New Character" to create one!
                    </div>
                </div>
            `;
            return;
        }

        characterList.innerHTML = characters.map(character => `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card character-card" data-character-id="${character.id}">
                    <div class="card-body">
                        <h5 class="card-title">${character.name || 'Unnamed Character'}</h5>
                        ${character.class ? `<p class="card-text">
                            <strong>Class:</strong> ${character.class.name || 'None'} ${character.class.level || 1}
                        </p>` : ''}
                        ${character.race ? `<p class="card-text">
                            <strong>Race:</strong> ${character.race.name || 'None'}
                        </p>` : ''}
                        <div class="d-flex gap-2 mt-3">
                            <button class="btn btn-primary btn-sm flex-grow-1" onclick="window.loadCharacter('${character.id}')">
                                <i class="fas fa-folder-open"></i> Load
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="window.deleteCharacter('${character.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Setup global functions for character actions
        window.loadCharacter = async (id) => {
            const result = await CharacterManager.loadCharacter(id);
            if (result.isOk()) {
                showNotification('Character loaded successfully', 'success');
                // Navigate to build page
                eventBus.emit(EVENTS.PAGE_CHANGED, 'build');
            } else {
                showNotification('Failed to load character', 'error');
            }
        };

        window.deleteCharacter = async (id) => {
            const modal = Modal.getInstance();
            const confirmed = await modal.showConfirmationModal({
                title: 'Delete Character',
                message: 'Are you sure you want to delete this character? This cannot be undone.',
                confirmButtonText: 'Delete',
                confirmButtonClass: 'btn-danger'
            });

            if (confirmed) {
                const result = await CharacterManager.deleteCharacter(id);
                if (result.isOk()) {
                    showNotification('Character deleted successfully', 'success');
                    // Reload character list
                    const reloadResult = await CharacterManager.loadCharacterList();
                    if (reloadResult.isOk()) {
                        await this.renderCharacterList(reloadResult.value);
                    }
                } else {
                    showNotification('Failed to delete character', 'error');
                }
            }
        };

        Logger.info('PageHandler', 'Character list rendered', { count: characters.length });
    }

    /**
     * Handle import character button click
     */
    async handleImportCharacter() {
        try {
            Logger.info('PageHandler', 'Importing character');

            const result = await window.characterStorage.importCharacter();

            if (result.success && result.character) {
                showNotification('Character imported successfully', 'success');

                // Reload character list
                const reloadResult = await CharacterManager.loadCharacterList();
                if (reloadResult.isOk()) {
                    await this.renderCharacterList(reloadResult.value);
                }
            } else if (result.canceled) {
                Logger.info('PageHandler', 'Import canceled');
            } else {
                showNotification('Failed to import character', 'error');
            }
        } catch (error) {
            Logger.error('PageHandler', 'Error importing character', error);
            showNotification('Error importing character', 'error');
        }
    }

    /**
     * Initialize the settings page
     */
    async initializeSettingsPage() {
        Logger.info('PageHandler', 'Initializing settings page');

        try {
            await settingsService.initializeSettingsPage();
        } catch (error) {
            Logger.error('PageHandler', 'Error initializing settings page', error);
            showNotification('Error loading settings page', 'error');
        }
    }

    /**
     * Initialize the build page
     */
    async initializeBuildPage() {
        Logger.info('PageHandler', 'Initializing build page');

        try {
            // Build page initialization is handled by individual card components
            // which listen for page load and character change events
            Logger.debug('PageHandler', 'Build page initialized');
        } catch (error) {
            Logger.error('PageHandler', 'Error initializing build page', error);
        }
    }
}

// Export singleton instance
export const PageHandler = new PageHandlerImpl();
