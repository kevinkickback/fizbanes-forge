/**
 * PageHandler.js
 * Handles page-specific initialization after pages are loaded
 */

import { Logger } from '../infrastructure/Logger.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { CharacterManager } from './CharacterManager.js';
import { AppState } from './AppState.js';
import { Modal } from './Modal.js';
import { settingsService } from '../services/SettingsService.js';
import { showNotification } from '../utils/Notifications.js';
import { RaceCard } from '../modules/race/RaceCard.js';
import { ClassCard } from '../modules/class/ClassCard.js';
import { BackgroundCard } from '../modules/background/BackgroundCard.js';
import { AbilityScoreCard } from '../modules/abilities/AbilityScoreCard.js';
import { ProficiencyCard } from '../modules/proficiencies/ProficiencyCard.js';

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
            // Clean up home page listeners when leaving home
            if (pageName !== 'home' && this._homeCharacterSelectedHandler) {
                eventBus.off(EVENTS.CHARACTER_SELECTED, this._homeCharacterSelectedHandler);
                this._homeCharacterSelectedHandler = null;
            }

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
                case 'details':
                    await this.initializeDetailsPage();
                    break;
                case 'equipment':
                    await this.initializeEquipmentPage();
                    break;
                case 'preview':
                    await this.initializePreviewPage();
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

            // Listen for character selection to update the active badge in real-time
            // Remove any existing listener to avoid duplicates
            eventBus.off(EVENTS.CHARACTER_SELECTED, this._homeCharacterSelectedHandler);

            // Store the handler so we can remove it later
            this._homeCharacterSelectedHandler = async () => {
                const reloadResult = await CharacterManager.loadCharacterList();
                if (reloadResult.isOk()) {
                    await this.renderCharacterList(reloadResult.value);
                }
            };

            eventBus.on(EVENTS.CHARACTER_SELECTED, this._homeCharacterSelectedHandler);

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
            this.showEmptyState(characterList);
            // Hide the top row with New Character button when there are no characters
            const topButtonRow = document.querySelector('.row.mb-4');
            if (topButtonRow) {
                topButtonRow.style.display = 'none';
            }
            return;
        }

        // Show the top row with New Character button when there are characters
        const topButtonRow = document.querySelector('.row.mb-4');
        if (topButtonRow) {
            topButtonRow.style.display = '';
        }

        // Get the currently active character ID
        const currentCharacter = AppState.getCurrentCharacter();
        const activeCharacterId = currentCharacter?.id;

        characterList.innerHTML = characters.map(character => {
            const isActive = character.id === activeCharacterId;
            const characterClass = character.class?.name || 'No Class';
            const characterRace = character.race?.name || 'No Race';
            const characterLevel = character.level || character.class?.level || 1;
            const lastModified = character.lastModified ? new Date(character.lastModified).toLocaleDateString() : 'Unknown';

            return `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card character-card ${isActive ? 'selected' : ''}" data-character-id="${character.id}">
                        <div class="active-profile-badge">Active Character</div>
                        <div class="card-body">
                            <div class="character-info">
                                <h5 class="card-title">${character.name || 'Unnamed Character'}</h5>
                                <div class="character-details">
                                    <div class="detail-item">
                                        <i class="fas fa-crown me-2"></i>
                                        <span>Level ${characterLevel}</span>
                                    </div>
                                    <div class="detail-item">
                                        <i class="fas fa-user me-2"></i>
                                        <span>${characterRace}</span>
                                    </div>
                                    <div class="detail-item">
                                        <i class="fas fa-hat-wizard me-2"></i>
                                        <span>${characterClass}</span>
                                    </div>
                                </div>
                                <div class="last-modified">
                                    <i class="fas fa-clock me-2"></i>
                                    <span>Last modified: ${lastModified}</span>
                                </div>
                            </div>
                            <div class="card-actions mt-3">
                                <button class="btn btn-lg btn-outline-secondary export-character" 
                                        data-character-id="${character.id}" 
                                        title="Export Character">
                                    <i class="fas fa-file-export"></i>
                                </button>
                                <button class="btn btn-lg btn-outline-danger delete-character" 
                                        data-character-id="${character.id}" 
                                        title="Delete Character">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Setup event listeners for character cards
        this.setupCharacterCardListeners(characterList);

        Logger.info('PageHandler', 'Character list rendered', { count: characters.length });
    }

    /**
     * Setup event listeners for character card actions
     * @param {HTMLElement} container - The container with character cards
     */
    setupCharacterCardListeners(container) {
        if (!container) return;

        // Handle character card clicks to load the character
        container.addEventListener('click', async (e) => {
            const card = e.target.closest('.character-card');
            if (!card) return;

            // Don't load if clicking on action buttons
            if (e.target.closest('.card-actions')) return;

            const characterId = card.dataset.characterId;
            if (characterId) {
                Logger.debug('PageHandler', `[${new Date().toISOString()}] Character card clicked: ${characterId}`);
                const result = await CharacterManager.loadCharacter(characterId);
                if (result.isOk()) {
                    Logger.info('PageHandler', `✓ Character loaded from card: ${characterId}`, {
                        character: result.value?.name
                    });
                    showNotification('Character loaded successfully', 'success');

                    // Check floating bar state AFTER load
                    const floatingBar = document.querySelector('.floating-actions');
                    const floatingBarVisible = floatingBar ? window.getComputedStyle(floatingBar).display !== 'none' : false;
                    Logger.debug('PageHandler', `After character load - floating bar visible: ${floatingBarVisible}`, {
                        dataCurrentPage: document.body.getAttribute('data-current-page')
                    });

                    // Navigate to build page
                    Logger.debug('PageHandler', 'Emitting PAGE_CHANGED event to "build"');
                    eventBus.emit(EVENTS.PAGE_CHANGED, 'build');
                } else {
                    Logger.error('PageHandler', 'Failed to load character', { id: characterId, error: result.error });
                    showNotification('Failed to load character', 'error');
                }
            }
        });

        // Handle export button clicks
        container.addEventListener('click', async (e) => {
            const exportBtn = e.target.closest('.export-character');
            if (!exportBtn) return;

            e.stopPropagation();
            const characterId = exportBtn.dataset.characterId;
            if (characterId) {
                // TODO: Implement export functionality
                showNotification('Export functionality coming soon', 'info');
            }
        });

        // Handle delete button clicks
        container.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-character');
            if (!deleteBtn) return;

            e.stopPropagation();
            const characterId = deleteBtn.dataset.characterId;
            if (characterId) {
                const modal = Modal.getInstance();
                const confirmed = await modal.showConfirmationModal({
                    title: 'Delete Character',
                    message: 'Are you sure you want to delete this character? This cannot be undone.',
                    confirmButtonText: 'Delete',
                    confirmButtonClass: 'btn-danger'
                });

                if (confirmed) {
                    const result = await CharacterManager.deleteCharacter(characterId);
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
            }
        });
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
     * Show the empty state when no characters exist
     * @param {HTMLElement} container - The container element to show empty state in
     */
    showEmptyState(container) {
        if (!container) return;

        container.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="height: calc(100vh - 200px);">
                <div class="empty-state text-center">
                    <i class="fas fa-users fa-5x mb-4 text-muted"></i>
                    <h2 class="mb-3">No Characters</h2>
                    <p class="lead">Create or import a character to get started!</p>
                    <div class="d-flex justify-content-center gap-2">
                        <button id="welcomeCreateCharacterBtn" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Create Character
                        </button>
                        <button id="emptyStateImportBtn" class="btn btn-secondary">
                            <i class="fas fa-file-import"></i> Import Character
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add event listener to the Create Character button
        const createBtn = container.querySelector('#welcomeCreateCharacterBtn');
        if (createBtn) {
            createBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const modal = Modal.getInstance();
                await modal.showNewCharacterModal(e);
            });
        }

        // Add event listener to the Import Character button
        const importBtn = container.querySelector('#emptyStateImportBtn');
        if (importBtn) {
            importBtn.addEventListener('click', async () => {
                await this.handleImportCharacter();
            });
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
            // Initialize all build page cards
            // These components will handle populating dropdowns and fields based on character data
            new RaceCard();
            new ClassCard();
            new BackgroundCard();

            // AbilityScoreCard and ProficiencyCard require explicit initialize() call
            const abilityScoreCard = new AbilityScoreCard();
            await abilityScoreCard.initialize();

            const proficiencyCard = new ProficiencyCard();
            await proficiencyCard.initialize();

            Logger.info('PageHandler', 'Build page cards initialized');
        } catch (error) {
            Logger.error('PageHandler', 'Error initializing build page', error);
            showNotification('Error initializing build page', 'error');
        }
    }

    /**
     * Initialize the details page
     */
    async initializeDetailsPage() {
        Logger.info('PageHandler', 'Initializing details page');

        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                Logger.warn('PageHandler', 'No character loaded for details page');
                return;
            }

            // Populate character info fields
            const characterNameInput = document.getElementById('characterName');
            const playerNameInput = document.getElementById('playerName');
            const heightInput = document.getElementById('height');
            const weightInput = document.getElementById('weight');
            const genderInput = document.getElementById('gender');
            const backstoryTextarea = document.getElementById('backstory');

            if (characterNameInput) characterNameInput.value = character.name || '';
            if (playerNameInput) playerNameInput.value = character.playerName || '';
            if (heightInput) heightInput.value = character.height || '';
            if (weightInput) weightInput.value = character.weight || '';
            if (genderInput) genderInput.value = character.gender || '';
            if (backstoryTextarea) backstoryTextarea.value = character.backstory || '';

            // Set up form change listeners for unsaved changes detection
            this._setupDetailsPageFormListeners();

            Logger.info('PageHandler', 'Details page populated with character data');
        } catch (error) {
            Logger.error('PageHandler', 'Error initializing details page', error);
            showNotification('Error loading details page', 'error');
        }
    }

    /**
     * Set up event listeners for form fields on the details page
     * @private
     */
    _setupDetailsPageFormListeners() {
        const detailsFields = [
            'characterName',
            'playerName',
            'height',
            'weight',
            'gender',
            'backstory'
        ];

        detailsFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Use input event for real-time change detection
                field.addEventListener('input', () => {
                    Logger.debug('PageHandler', `Form field changed (${fieldId}), emitting CHARACTER_UPDATED`);
                    // Emit CHARACTER_UPDATED event for form input changes
                    eventBus.emit(EVENTS.CHARACTER_UPDATED, { character: AppState.getCurrentCharacter() });
                });
            }
        });
    }

    /**
     * Initialize the equipment page
     */
    async initializeEquipmentPage() {
        Logger.info('PageHandler', 'Initializing equipment page');

        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                Logger.warn('PageHandler', 'No character loaded for equipment page');
                return;
            }

            // Equipment page components can be initialized here
            // For now, just log that the page is ready
            Logger.info('PageHandler', 'Equipment page initialized');
        } catch (error) {
            Logger.error('PageHandler', 'Error initializing equipment page', error);
            showNotification('Error loading equipment page', 'error');
        }
    }

    /**
     * Initialize the preview page
     */
    async initializePreviewPage() {
        Logger.info('PageHandler', 'Initializing preview page');

        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                Logger.warn('PageHandler', 'No character loaded for preview page');
                return;
            }

            // Preview page components can be initialized here
            // For now, just log that the page is ready
            Logger.info('PageHandler', 'Preview page initialized');
        } catch (error) {
            Logger.error('PageHandler', 'Error initializing preview page', error);
            showNotification('Error loading preview page', 'error');
        }
    }
}

// Export singleton instance
export const PageHandler = new PageHandlerImpl();
