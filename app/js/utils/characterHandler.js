/**
 * characterHandler.js
 * Handles data for D&D character profiles
 * 
 * @typedef {Object} CharacterCard
 * @property {string} id - The character's unique identifier
 * @property {string} name - The character's name
 * @property {number} level - The character's level
 * @property {Object} race - The character's race information
 * @property {string} race.name - The race name
 * @property {string} race.source - The source book
 * @property {string} race.subrace - The subrace name
 * @property {Object} class - The character's class information
 * @property {string} class.name - The class name
 * @property {number} class.level - The class level
 * @property {string} lastModified - ISO timestamp of last modification
 * @property {string} playerName - The player's name
 * @property {string} height - The character's height
 * @property {string} weight - The character's weight
 * @property {string} gender - The character's gender
 * @property {string} backstory - The character's backstory
 */

// Character handling utilities
import { Character } from '../models/Character.js';
import { showNotification } from './notifications.js';
import { navigation } from './navigation.js';
import { SourceCard } from '../ui/SourceCard.js';
import { SourceManager } from '../managers/SourceManager.js';
import { AbilityScoreCard } from '../ui/AbilityScoreCard.js';
import { storage } from './Storage.js';
import { modal } from './Modal.js';

let instance = null;

/**
 * Class responsible for managing D&D characters including creation, loading, saving, and deletion
 */
export class CharacterHandler {
    /**
     * Initializes a new CharacterHandler instance
     * @private
     */
    constructor() {
        if (instance) {
            throw new Error('CharacterHandler is a singleton. Use CharacterHandler.getInstance() instead.');
        }
        instance = this;
        this.sourceCard = new SourceCard();
        this._currentCharacter = null;
        this._characterListeners = new Set();

        // Initialize managers
        this.sourceManager = new SourceManager();
        this.sourceManager.setCharacterHandler(this);  // Set this handler after initialization
    }

    /**
     * Gets the current character
     * @returns {Character|null} The current character or null if none selected
     */
    get currentCharacter() {
        return this._currentCharacter;
    }

    /**
     * Sets the current character and notifies listeners
     * @param {Character|null} character - The character to set as current
     * @private
     */
    set currentCharacter(character) {
        this._currentCharacter = character;

        // Initialize ability scores based on the selected method
        if (character?.variantRules?.abilityScoreMethod) {
            // Handle async import with promise
            import('../managers/AbilityScoreManager.js').then(({ abilityScoreManager }) => {
                abilityScoreManager.updateAssignedStandardArrayValues();
            }).catch(err => {
                console.error('[CharacterHandler] Error initializing ability scores:', err);
            });
        }

        // Notify listeners of the character change
        this._notifyCharacterChanged();
    }

    /**
     * Adds a listener for character changes
     * @param {Function} listener - The listener function to add
     */
    addCharacterListener(listener) {
        this._characterListeners.add(listener);
    }

    /**
     * Removes a listener for character changes
     * @param {Function} listener - The listener function to remove
     */
    removeCharacterListener(listener) {
        this._characterListeners.delete(listener);
    }

    /**
     * Notifies all listeners of character changes
     * @private
     */
    _notifyCharacterChanged() {
        const event = new CustomEvent('characterChanged', {
            detail: { character: this.currentCharacter }
        });
        document.dispatchEvent(event);

        // Also notify registered listeners
        for (const listener of this._characterListeners) {
            try {
                listener(this.currentCharacter);
            } catch (error) {
                console.error('Error in character change listener:', error);
            }
        }
    }

    /**
     * Initializes the character handler and loads existing characters
     * @returns {Promise<void>}
     */
    initialize() {
        // Load existing characters
        this.loadCharacters();

        // Initialize event listeners
        this.initializeEventListeners();

        console.log('Character Handler initialized');
    }

    /**
     * Sets up event listeners for character-related actions
     * @private
     */
    initializeEventListeners() {
        // Set up modal-related event listeners using the Modal utility
        modal.setupEventListeners({
            onShowModal: (e) => modal.showNewCharacterModal(e),
            onCreateCharacter: (character) => this.handleCharacterSelect(character)
        });

        // Set up button event listeners
        this.setupButtonEventListener('importCharacterBtn', async (e) => {
            e.preventDefault();
            await this.handleCharacterImport();
        });

        this.setupButtonEventListener('saveCharacter', async () => {
            await this.saveCharacterDetails();
        });
    }

    /**
     * Sets up an event listener for a button, replacing any existing listeners
     * @param {string} buttonId - The ID of the button element
     * @param {Function} handler - The event handler function
     * @private
     */
    setupButtonEventListener(buttonId, handler) {
        const button = document.getElementById(buttonId);
        if (button) {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', handler);
        }
    }

    /**
     * Updates the UI to reflect the current character selection
     * @private
     */
    updateCharacterSelectionUI(characterId) {
        // Update active badge on all character cards
        const characterCards = document.querySelectorAll('.character-card');
        for (const card of characterCards) {
            const isSelected = card.dataset.characterId === characterId;
            card.classList.toggle('selected', isSelected);
            const badge = card.querySelector('.active-profile-badge');
            if (badge) {
                badge.style.display = isSelected ? 'block' : 'none';
            }
        }

        // Enable navigation buttons for character pages
        const navLinks = document.querySelectorAll('.nav-link');
        for (const link of navLinks) {
            const page = link.getAttribute('data-page');
            if (['build', 'equipment', 'details'].includes(page)) {
                link.classList.remove('disabled');
            }
        }
    }

    /**
     * Updates the character card in the UI with new data
     * @param {Character} character - The character to update
     * @private
     */
    updateCharacterCard(character) {
        const characterCard = document.querySelector(`[data-character-id="${character.id}"]`);
        if (characterCard) {
            const cardTitle = characterCard.querySelector('.card-title');
            if (cardTitle) {
                cardTitle.textContent = character.name || 'Unnamed Character';
            }

            const raceDisplay = characterCard.querySelector('.detail-item:nth-child(2) span');
            if (raceDisplay && character.race) {
                raceDisplay.textContent = character.race.name || 'No Race';
            }
        }
    }

    /**
     * Gets all character detail fields from the UI
     * @returns {Object} Object containing all character detail fields
     * @private
     */
    getCharacterDetailFields() {
        return {
            characterName: document.getElementById('characterName'),
            playerName: document.getElementById('playerName'),
            height: document.getElementById('height'),
            weight: document.getElementById('weight'),
            gender: document.getElementById('gender'),
            backstory: document.getElementById('backstory'),
            raceSelect: document.getElementById('raceSelect'),
            subraceSelect: document.getElementById('subraceSelect'),
            classSelect: document.getElementById('classSelect'),
            subclassSelect: document.getElementById('subclassSelect'),
            backgroundSelect: document.getElementById('backgroundSelect'),
            variantSelect: document.getElementById('variantSelect')
        };
    }

    /**
     * Updates character details from UI fields
     * @param {boolean} isSaving - Whether this is being called from saveCharacterDetails
     * @private
     */
    updateCharacterDetails(isSaving = false) {
        if (!this.currentCharacter) return;

        const fields = this.getCharacterDetailFields();

        if (isSaving) {
            // Update character data from fields
            if (fields.characterName) this.currentCharacter.name = fields.characterName.value || '';
            if (fields.playerName) this.currentCharacter.playerName = fields.playerName.value || '';
            if (fields.height) this.currentCharacter.height = fields.height.value || '';
            if (fields.weight) this.currentCharacter.weight = fields.weight.value || '';
            if (fields.gender) this.currentCharacter.gender = fields.gender.value || '';
            if (fields.backstory) this.currentCharacter.backstory = fields.backstory.value || '';

            // Update race information if available
            if (fields.raceSelect?.value) {
                const [raceName, source] = fields.raceSelect.value.split('_');
                this.currentCharacter.race = {
                    ...this.currentCharacter.race,
                    name: raceName,
                    source: source
                };
            }
            if (fields.subraceSelect?.value) {
                this.currentCharacter.race.subrace = fields.subraceSelect.value;
            }

            // Update class information if available
            if (fields.classSelect?.value) {
                const [className, source] = fields.classSelect.value.split('_');
                this.currentCharacter.class = {
                    ...this.currentCharacter.class,
                    name: className,
                    source: source
                };
            }
            if (fields.subclassSelect?.value) {
                this.currentCharacter.class.subclass = fields.subclassSelect.value;
            }

            // Update background information if available
            if (fields.backgroundSelect?.value) {
                const [backgroundName, source] = fields.backgroundSelect.value.split('_');
                this.currentCharacter.background = {
                    ...this.currentCharacter.background,
                    name: backgroundName,
                    source: source
                };
            }
            if (fields.variantSelect?.value) {
                this.currentCharacter.background.variant = fields.variantSelect.value;
            }

            // Mark as having unsaved changes
            this.showUnsavedChanges();
        } else {
            // Update UI fields from character data
            if (fields.characterName) fields.characterName.value = this.currentCharacter.name || '';
            if (fields.playerName) fields.playerName.value = this.currentCharacter.playerName || '';
            if (fields.height) fields.height.value = this.currentCharacter.height || '';
            if (fields.weight) fields.weight.value = this.currentCharacter.weight || '';
            if (fields.gender) fields.gender.value = this.currentCharacter.gender || '';
            if (fields.backstory) fields.backstory.value = this.currentCharacter.backstory || '';
        }
    }

    /**
     * Loads all saved characters from storage
     * @returns {Promise<void>}
     * @private
     */
    async loadCharacters() {
        const characterList = document.getElementById('characterList');
        if (!characterList) return;

        try {
            // Clear existing list
            characterList.innerHTML = '';

            // Load characters from storage
            const characters = await storage.loadCharacters();

            if (!characters || characters.length === 0) {
                this.showEmptyState(characterList);
                return;
            }

            // Sort and deduplicate characters
            const uniqueCharacters = this.getUniqueCharacters(characters);

            // Create character cards
            for (const character of uniqueCharacters) {
                // Skip if card already exists and character hasn't changed
                const existingCard = characterList.querySelector(`[data-character-id="${character.id}"]`);
                if (existingCard) {
                    const lastModified = existingCard.querySelector('.last-modified span')?.textContent;
                    const newLastModified = new Date(character.lastModified).toLocaleDateString();
                    if (lastModified === newLastModified) {
                        continue;
                    }
                }

                const card = this.createCharacterCard(character);
                if (existingCard) {
                    existingCard.replaceWith(card);
                } else {
                    characterList.insertAdjacentHTML('beforeend', card);
                }
            }

            // Add event listeners to buttons
            this.setupCharacterCardListeners(characterList);

        } catch (error) {
            console.error('Error loading characters:', error);
            showNotification('Error loading characters', 'danger');
        }
    }

    /**
     * Creates a card element for displaying a character
     * @param {Character} character - The character to create a card for
     * @returns {HTMLElement} The created character card element
     * @private
     */
    createCharacterCard(character) {
        return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card character-card ${this.currentCharacter?.id === character.id ? 'selected' : ''}" 
                     data-character-id="${character.id}">
                    <div class="active-profile-badge">Active Character</div>
                    <div class="card-body">
                        <div class="character-info">
                            <h5 class="card-title">${character.name || 'Unnamed Character'}</h5>
                            <div class="character-details">
                                <div class="detail-item">
                                    <i class="fas fa-crown me-2"></i>
                                    <span>${character.level ? `Level ${character.level}` : 'Level 1'}</span>
                                </div>
                                <div class="detail-item">
                                    <i class="fas fa-user me-2"></i>
                                    <span>${character.race?.name || 'No Race'}</span>
                                </div>
                                <div class="detail-item">
                                    <i class="fas fa-hat-wizard me-2"></i>
                                    <span>${character.class?.name || 'No Class'}</span>
                                </div>
                            </div>
                            <div class="last-modified">
                                <i class="fas fa-clock me-2"></i>
                                <span>Last modified: ${new Date(character.lastModified).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div class="card-actions mt-3">
                            <button class="btn btn-lg btn-outline-secondary export-character" title="Export Character">
                                <i class="fas fa-file-export"></i>
                            </button>
                            <button class="btn btn-lg btn-outline-danger delete-character" title="Delete Character">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Shows the empty state message when no characters exist
     * @param {HTMLElement} container - The container to show the empty state in
     * @private
     */
    showEmptyState(container) {
        container.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="height: calc(100vh - 200px);">
                <div class="empty-state text-center">
                    <i class="fas fa-users fa-5x mb-4 text-muted"></i>
                    <h2 class="mb-3">No Characters Yet</h2>
                    <p class="lead">Create a new character to get started!</p>
                </div>
            </div>
        `;
    }

    /**
     * Filters out duplicate characters based on ID
     * @param {Array<Character>} characters - Array of characters to filter
     * @returns {Array<Character>} Array of unique characters
     * @private
     */
    getUniqueCharacters(characters) {
        const uniqueMap = new Map(characters.map(char => [char.id, char]));
        return Array.from(uniqueMap.values()).sort((a, b) => {
            const dateA = new Date(a.lastModified || 0);
            const dateB = new Date(b.lastModified || 0);
            return dateB - dateA;
        });
    }

    /**
     * Sets up event listeners for character card interactions
     * @param {HTMLElement} container - The container containing character cards
     * @private
     */
    setupCharacterCardListeners(container) {
        container.addEventListener('click', async (e) => {
            const card = e.target.closest('.character-card');
            if (!card) return;

            const characterId = card.dataset.characterId;
            if (!characterId) return;

            // Handle export button click
            if (e.target.closest('.export-character')) {
                e.preventDefault();
                await this.handleCharacterExport(characterId);
                return;
            }

            // Handle delete button click
            if (e.target.closest('.delete-character')) {
                e.preventDefault();
                await this.handleCharacterDelete(characterId);
                return;
            }

            // If not clicking a button, select the character
            if (!e.target.closest('button')) {
                // Get all characters and find the one we want
                const characters = await storage.loadCharacters();
                const character = characters.find(char => char.id === characterId);
                if (character) {
                    await this.handleCharacterSelect(character);
                }
            }
        });
    }

    /**
     * Handles the selection of a character
     * @param {Character} character - The selected character
     * @returns {Promise<void>}
     * @private
     */
    async handleCharacterSelect(character) {
        try {
            console.log('[CharacterHandler] Selecting character:', character?.id, 'with sources:', character?.allowedSources);
            console.log('[CharacterHandler] Character variant rules:', character?.variantRules);

            // Don't reload if it's the same character
            if (this.currentCharacter?.id === character.id) {
                console.log('[CharacterHandler] Same character already selected, skipping');
                return;
            }

            // Convert character data to a Character object
            this.currentCharacter = Character.fromJSON(character);
            console.log('[CharacterHandler] Character selected, allowed sources:',
                Array.from(this.currentCharacter.allowedSources));

            // Log the ability score method
            const abilityScoreMethod = this.currentCharacter.variantRules?.abilityScoreMethod || 'custom';
            console.log('[CharacterHandler] Ability score method:', abilityScoreMethod);

            // Update UI to reflect selection
            this.updateCharacterSelectionUI(character.id);

            // Initialize ability scores based on the selected method if available
            try {
                const abilityScoreManagerModule = await import('../managers/AbilityScoreManager.js');
                const abilityScoreManager = abilityScoreManagerModule.abilityScoreManager;

                if (!abilityScoreManager) {
                    throw new Error('abilityScoreManager is undefined after import');
                }

                // Reset the ability score manager with the current character's settings
                abilityScoreManager.resetAbilityScoreMethod();

                console.log('[CharacterHandler] Ability score method initialized:',
                    this.currentCharacter.variantRules?.abilityScoreMethod);
            } catch (e) {
                console.error('[CharacterHandler] Error initializing ability scores:', e);
            }

            // Populate the details page if we're on it
            await this.populateDetailsPage();

            // Re-initialize ability score card if we're on the build page
            if (document.querySelector('.ability-score-container')) {
                const container = document.querySelector('.ability-score-container');
                const existingCard = container.__card;
                if (existingCard) {
                    existingCard.remove();
                }

                // Dynamically import and initialize the AbilityScoreCard
                const { AbilityScoreCard } = await import('../ui/AbilityScoreCard.js');
                const abilityScoreCard = new AbilityScoreCard();
                container.__card = abilityScoreCard;
                abilityScoreCard.initialize();
            }

            // Hide unsaved changes icon when selecting a character
            this.hideUnsavedChanges();

            console.log('[CharacterHandler] Character selection complete');

        } catch (error) {
            console.error('[CharacterHandler] Error selecting character:', error);
            showNotification(`Error selecting character: ${error.message}`, 'error');
        }
    }

    /**
     * Populates the details page with the current character's information
     * @returns {Promise<void>}
     * @private
     */
    async populateDetailsPage() {
        this.updateCharacterDetails(false);
    }

    /**
     * Saves the current character's details
     * @returns {Promise<void>}
     * @private
     */
    async saveCharacterDetails() {
        if (!this.currentCharacter) return;

        try {
            // Save changes from current page before saving to storage
            if (navigation && typeof navigation._saveCurrentPageChanges === 'function') {
                navigation._saveCurrentPageChanges();
            }

            this.currentCharacter.lastModified = new Date().toISOString();

            // Save to storage
            const result = await storage.saveCharacter(this.currentCharacter);

            if (!result.success) {
                throw new Error(result.message || 'Failed to save character');
            }

            // Update the character card
            this.updateCharacterCard(this.currentCharacter);

            // Hide unsaved changes indicator
            this.hideUnsavedChanges();

            showNotification('Character details saved', 'success');
        } catch (error) {
            console.error('Error saving character details:', error);
            showNotification('Error saving character details', 'danger');
        }
    }

    /**
     * Handles the export of a character to a JSON file
     * @param {string} characterId - The ID of the character to export
     * @returns {Promise<void>}
     * @private
     */
    async handleCharacterExport(characterId) {
        try {
            const result = await storage.exportCharacter(characterId);
            if (result.success) {
                showNotification('Character exported successfully', 'success');
            } else {
                showNotification(result.message || 'Failed to export character', 'danger');
            }
        } catch (error) {
            console.error('Error exporting character:', error);
            showNotification('Error exporting character', 'danger');
        }
    }

    /**
     * Handles the deletion of a character
     * @param {string} characterId - The ID of the character to delete
     * @returns {Promise<void>}
     * @private
     */
    async handleCharacterDelete(characterId) {
        try {
            // Get character name for confirmation dialog
            const characters = await storage.loadCharacters();
            const character = characters.find(char => char.id === characterId);
            const characterName = character?.name || 'Unnamed Character';

            // Show confirmation dialog
            const confirmed = await modal.showConfirmationDialog(
                'Delete Character',
                `Are you sure you want to delete "${characterName}"? This action cannot be undone.`
            );

            if (!confirmed) {
                return; // User cancelled the deletion
            }

            const result = await storage.deleteCharacter(characterId);

            // If the deleted character was the current character, clear it
            if (this.currentCharacter?.id === characterId) {
                this.currentCharacter = null;
            }

            // Remove the character card from the UI
            const characterCard = document.querySelector(`[data-character-id="${characterId}"]`);
            if (characterCard) {
                characterCard.remove();
            }

            // Show appropriate notification based on result
            if (result.success) {
                showNotification('Character deleted successfully', 'success');
                // Reload the home page since the character list needs to be updated
                navigation.loadPage('home');
            } else {
                throw new Error(result.message || 'Failed to delete character');
            }

        } catch (error) {
            console.error('Error deleting character:', error);
            showNotification(error.message || 'Error deleting character', 'danger');
        }
    }

    /**
     * Handles the import of a character from a JSON file
     * @returns {Promise<void>}
     * @private
     */
    async handleCharacterImport() {
        try {
            const result = await storage.importCharacter();
            if (result.success) {
                showNotification('Character imported successfully', 'success');
                // Reload the character list to show the imported character
                await this.loadCharacters();
            } else {
                showNotification(result.message || 'Failed to import character', 'danger');
            }
        } catch (error) {
            console.error('Error importing character:', error);
            showNotification('Error importing character', 'danger');
        }
    }

    /**
     * Shows the unsaved changes indicator
     * @public
     */
    showUnsavedChanges() {
        const indicator = document.getElementById('unsavedChangesIndicator');
        if (indicator) {
            indicator.style.display = 'inline-block';
        }
    }

    /**
     * Hides the unsaved changes indicator
     * @public
     */
    hideUnsavedChanges() {
        const indicator = document.getElementById('unsavedChangesIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    /**
     * Gets the singleton instance of CharacterHandler
     * @returns {CharacterHandler} The singleton instance
     * @static
     */
    static getInstance() {
        if (!instance) {
            instance = new CharacterHandler();
        }
        return instance;
    }
}

export const characterHandler = CharacterHandler.getInstance(); 