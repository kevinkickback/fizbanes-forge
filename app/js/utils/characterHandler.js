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
import { SourceCard } from '../ui/SourceCard.js';
import { storage } from './Storage.js';
import { modal } from './Modal.js';
import { eventEmitter } from './EventEmitter.js';

/**
 * Class responsible for managing D&D characters including creation, loading, saving, and deletion
 */
class CharacterHandler {
    /**
     * Initializes a new CharacterHandler instance
     * @private
     */
    constructor() {
        /**
         * Reference to the source card UI component
         * @type {SourceCard}
         * @private
         */
        this._sourceCard = new SourceCard();

        /**
         * Currently active character
         * @type {Character|null}
         * @private
         */
        this._currentCharacter = null;

        /**
         * Flag to track unsaved changes
         * @type {boolean}
         * @private
         */
        this._hasUnsavedChanges = false;
    }

    /**
     * Gets the current character
     * @returns {Character|null} The current character or null if none selected
     */
    get currentCharacter() {
        return this._currentCharacter;
    }

    /**
     * Gets the currently selected character
     * @returns {Object|null} The current character or null if none is selected
     */
    getCurrentCharacter() {
        return this.currentCharacter;
    }

    /**
     * Sets the current character and notifies listeners
     * @param {Character|null} character - The character to set as current
     * @private
     */
    set currentCharacter(character) {
        this._currentCharacter = character;
        this._hasUnsavedChanges = false;

        try {
            // Initialize ability scores based on the selected method
            if (character?.variantRules?.abilityScoreMethod) {
                // Handle async import with promise
                import('../managers/AbilityScoreManager.js').then(({ abilityScoreManager }) => {
                    abilityScoreManager.updateAssignedStandardArrayValues();
                }).catch(err => {
                    console.error('Error initializing ability scores:', err);
                });
            }

            // Notify listeners of the character change
            this._notifyCharacterChanged();
        } catch (error) {
            console.error('Error setting current character:', error);
        }
    }

    /**
     * Initializes the character handler and loads existing characters
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // Load existing characters
            await this.loadCharacters();

            // Initialize event listeners
            this._initializeEventListeners();

        } catch (error) {
            console.error('Error initializing character handler:', error);
        }
    }

    /**
     * Initializes event listeners for character-related actions
     * Public method that can be called from other modules
     */
    initializeEventListeners() {
        this._initializeEventListeners();
    }

    /**
     * Sets up event listeners for character-related actions
     * @private
     */
    _initializeEventListeners() {
        try {
            // Set up modal-related event listeners using the Modal utility
            modal.setupEventListeners({
                onShowModal: (e) => modal?.showNewCharacterModal(e),
                onCreateCharacter: (character) => this.handleCharacterSelect(character)
            });

            // Set up button event listeners
            this._setupButtonEventListener('importCharacterBtn', async (e) => {
                e.preventDefault();
                await this.handleCharacterImport();
            });

            this._setupButtonEventListener('saveCharacter', async () => {
                await this.saveCharacterDetails();
            });
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    /**
     * Sets up an event listener for a button, replacing any existing listeners
     * @param {string} buttonId - The ID of the button element
     * @param {Function} handler - The event handler function
     * @private
     */
    _setupButtonEventListener(buttonId, handler) {
        try {
            const button = document.getElementById(buttonId);
            if (button) {
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                newButton.addEventListener('click', handler);
            }
        } catch (error) {
            console.error(`Error setting up button listener for ${buttonId}:`, error);
        }
    }

    /**
     * Notifies all listeners of character changes
     * @private
     */
    _notifyCharacterChanged() {
        try {
            // Emit character:changed event for all listeners
            eventEmitter.emit('character:changed', this._currentCharacter);

            // Legacy DOM event for backward compatibility
            document.dispatchEvent(new CustomEvent('characterChanged', {
                detail: { character: this._currentCharacter }
            }));
        } catch (error) {
            console.error('Error notifying character changed:', error);
        }
    }

    /**
     * Loads all characters from storage
     * @returns {Promise<void>}
     */
    async loadCharacters() {
        try {
            // Get the container for character cards
            const container = document.getElementById('characterList');
            if (!container) {
                return;
            }

            // Clear existing cards
            container.innerHTML = '';

            // Load characters from storage
            const characters = await storage.getCharacters();
            if (!characters || characters.length === 0) {
                this._showEmptyState(container);
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

            // Filter to unique characters by ID
            const uniqueCharacters = this._getUniqueCharacters(characters);

            // Create a card for each character
            for (const character of uniqueCharacters) {
                const cardHtml = this._createCharacterCard(character);
                container.insertAdjacentHTML('beforeend', cardHtml);
            }

            // Set up event listeners for the character cards
            this._setupCharacterCardListeners(container);

        } catch (error) {
            console.error('Error loading characters:', error);
            showNotification('Failed to load characters', 'error');
        }
    }

    /**
     * Removes duplicate characters by ID
     * @param {Array<Object>} characters - Array of character objects
     * @returns {Array<Object>} Array with unique characters
     * @private
     */
    _getUniqueCharacters(characters) {
        // Use a Map to keep only the last version of each character ID
        const uniqueMap = new Map();
        for (const character of characters) {
            if (character?.id) {
                uniqueMap.set(character.id, character);
            }
        }
        return Array.from(uniqueMap.values());
    }

    /**
     * Creates a character card element
     * @param {Object} character - Character data
     * @returns {string} The HTML string for the character card
     * @private
     */
    _createCharacterCard(character) {
        if (!character) return '';

        const isActive = this._currentCharacter?.id === character.id;
        const characterClass = character.class?.name || 'No Class';
        const characterRace = character.race?.name || 'No Race';
        const characterLevel = character.level || character.class?.level || 1;
        const lastModified = character.lastModified ? new Date(character.lastModified).toLocaleDateString() : 'Unknown';

        return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card character-card ${isActive ? 'selected' : ''}" 
                     data-character-id="${character.id}">
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
     * Shows empty state message when no characters are available
     * @param {HTMLElement} container - The container element
     * @private
     */
    _showEmptyState(container) {
        if (!container) return;

        container.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="height: calc(100vh - 200px);">
                <div class="empty-state text-center">
                    <i class="fas fa-users fa-5x mb-4 text-muted"></i>
                    <h2 class="mb-3">No Characters</h2>
                    <p class="lead">Create or import a character to get started!</p>
                    <div class="d-flex justify-content-center gap-2">
                        <button id="createCharacterBtn" class="btn btn-primary">
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
        const createBtn = container.querySelector('#createCharacterBtn');
        if (createBtn) {
            createBtn.addEventListener('click', (e) => {
                modal.showNewCharacterModal(e);
            });
        }

        // Add event listener to the Import Character button
        const importBtn = container.querySelector('#emptyStateImportBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.handleCharacterImport();
            });
        }
    }

    /**
     * Sets up event listeners for character cards
     * @param {HTMLElement} container - The container with character cards
     * @private
     */
    _setupCharacterCardListeners(container) {
        if (!container) return;

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
                await this.handleCharacterSelect(characterId);
            }
        });
    }

    /**
     * Gets all character detail fields from the UI
     * @returns {Object} Object containing all character detail fields
     * @private
     */
    _getCharacterDetailFields() {
        return {
            name: document.getElementById('characterName')?.value || '',
            playerName: document.getElementById('playerName')?.value || '',
            height: document.getElementById('height')?.value || '',
            weight: document.getElementById('weight')?.value || '',
            eyes: document.getElementById('eyes')?.value || '',
            skin: document.getElementById('skin')?.value || '',
            hair: document.getElementById('hair')?.value || '',
            gender: document.getElementById('gender')?.value || '',
            appearance: document.getElementById('appearance')?.value || '',
            backstory: document.getElementById('backstory')?.value || '',
            notes: document.getElementById('notes')?.value || ''
        };
    }

    /**
     * Updates character details from the UI form
     * @param {boolean} isSaving - Whether this is being called during a save operation
     * @returns {boolean} True if updates were applied
     */
    updateCharacterDetails(isSaving = false) {
        try {
            if (!this._currentCharacter) {
                return false;
            }

            // Get all form fields
            const fields = this._getCharacterDetailFields();

            // Check if there are any changes
            let hasChanges = false;
            for (const [key, value] of Object.entries(fields)) {
                if (this._currentCharacter[key] !== value) {
                    this._currentCharacter[key] = value;
                    hasChanges = true;
                }
            }

            if (hasChanges && !isSaving) {
                this.showUnsavedChanges();
                eventEmitter.emit('character:detailsUpdated', this._currentCharacter);
            }

            // Also update the character card in the UI if the name changed
            if (this._currentCharacter.name !== fields.name) {
                this._currentCharacter.name = fields.name;
                this.updateCharacterCard(this._currentCharacter);
            }

            return hasChanges;
        } catch (error) {
            console.error('Error updating character details:', error);
            return false;
        }
    }

    /**
     * Saves the character details to storage
     * @returns {Promise<boolean>} True if the save was successful
     */
    async saveCharacterDetails() {
        try {
            if (!this._currentCharacter) {
                showNotification('No character to save', 'error');
                return false;
            }

            // Update the character with the latest form values
            this.updateCharacterDetails(true);

            // Set last modified timestamp
            this._currentCharacter.lastModified = new Date().toISOString();

            // Save to storage
            const success = await storage.saveCharacter(this._currentCharacter);

            if (success) {
                showNotification('Character saved successfully', 'success');
                this.clearUnsavedChanges();
                eventEmitter.emit('character:saved', this._currentCharacter);
                return true;
            }

            showNotification('Failed to save character', 'error');
            return false;
        } catch (error) {
            console.error('Error saving character details:', error);
            showNotification(`Error saving character: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Updates UI to show the character has unsaved changes
     */
    showUnsavedChanges() {
        try {
            this._hasUnsavedChanges = true;
            const indicator = document.getElementById('unsavedChangesIndicator');
            if (indicator) {
                indicator.style.display = 'inline-block';
            }

            const saveBtn = document.getElementById('saveCharacter');
            if (saveBtn) {
                saveBtn.classList.add('btn-warning');
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save*';
            }
        } catch (error) {
            console.error('Error showing unsaved changes:', error);
        }
    }

    /**
     * Updates UI to clear unsaved changes indicator
     */
    clearUnsavedChanges() {
        try {
            this._hasUnsavedChanges = false;
            const indicator = document.getElementById('unsavedChangesIndicator');
            if (indicator) {
                indicator.style.display = 'none';
            }

            const saveBtn = document.getElementById('saveCharacter');
            if (saveBtn) {
                saveBtn.classList.remove('btn-warning');
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
            }
        } catch (error) {
            console.error('Error clearing unsaved changes:', error);
        }
    }

    /**
     * Updates the character card in the UI with new data
     * @param {Character} character - The character to update
     */
    updateCharacterCard(character) {
        try {
            if (!character) return;

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

                const classDisplay = characterCard.querySelector('.detail-item:nth-child(3) span');
                if (classDisplay && character.class) {
                    classDisplay.textContent = character.class.name || 'No Class';
                }

                const levelDisplay = characterCard.querySelector('.detail-item:nth-child(1) span');
                if (levelDisplay) {
                    levelDisplay.textContent = `Level ${character.level || character.class?.level || 1}`;
                }
            }
        } catch (error) {
            console.error('Error updating character card:', error);
        }
    }

    /**
     * Updates the UI to reflect the current character selection
     * @param {string} characterId - ID of the selected character
     */
    updateCharacterSelectionUI(characterId) {
        try {
            // Update active badge on all character cards
            const characterCards = document.querySelectorAll('.character-card');
            for (const card of characterCards) {
                const isSelected = card.dataset.characterId === characterId;
                card.classList.toggle('selected', isSelected);
            }

            // Enable navigation buttons for character pages
            const navLinks = document.querySelectorAll('.nav-link');
            for (const link of navLinks) {
                const page = link.getAttribute('data-page');
                if (['build', 'equipment', 'details'].includes(page)) {
                    link.classList.remove('disabled');
                }
            }
        } catch (error) {
            console.error('Error updating character selection UI:', error);
        }
    }


    /**
     * Handles character selection
     * @param {string|Object} characterIdOrObject - Character ID or Character object
     * @returns {Promise<void>}
     */
    async handleCharacterSelect(characterIdOrObject) {
        try {
            let selectedCharacter;

            // Check if this is an ID or already a character object
            if (typeof characterIdOrObject === 'string') {
                // Load character from storage by ID
                selectedCharacter = await storage.getCharacter(characterIdOrObject);
            } else if (characterIdOrObject?.id) {
                // Use provided character object
                selectedCharacter = characterIdOrObject;
            }

            if (!selectedCharacter) {
                console.error('Character not found or invalid', characterIdOrObject);
                showNotification('Character not found', 'error');
                return;
            }

            // Convert to Character instance if it's just a data object
            if (!(selectedCharacter instanceof Character)) {
                selectedCharacter = new Character(selectedCharacter);
            }

            if (!selectedCharacter.id) {
                console.error('Character missing ID after initialization');
                showNotification('Invalid character data', 'error');
                return;
            }

            // Set as current character
            this.currentCharacter = selectedCharacter;

            // Update UI to show this character is selected
            this.updateCharacterSelectionUI(selectedCharacter.id);

        } catch (error) {
            console.error('Error selecting character:', error);
            showNotification('Error selecting character', 'error');
        }
    }

    /**
     * Handles character export to JSON file
     * @param {string} characterId - ID of the character to export
     * @returns {Promise<void>}
     */
    async handleCharacterExport(characterId) {
        try {
            // Get character data
            const character = await storage.getCharacter(characterId);
            if (!character) {
                showNotification('Character not found', 'error');
                return;
            }

            // Create a download link for the character JSON
            const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${character.name || 'character'}.json`;
            a.click();
            URL.revokeObjectURL(url);

            showNotification('Character exported successfully', 'success');
            eventEmitter.emit('character:exported', character);
        } catch (error) {
            console.error('Error exporting character:', error);
            showNotification('Error exporting character', 'error');
        }
    }

    /**
     * Handles character deletion
     * @param {string} characterId - ID of the character to delete
     * @returns {Promise<void>}
     */
    async handleCharacterDelete(characterId) {
        try {
            // Show confirmation dialog
            const confirmed = await modal.showConfirmationModal({
                title: 'Delete Character',
                message: 'Are you sure you want to delete this character? This action cannot be undone.',
                confirmButtonText: 'Delete',
                cancelButtonText: 'Cancel',
                confirmButtonClass: 'btn-danger'
            });

            if (!confirmed) {
                return;
            }

            // Delete the character from storage
            const success = await storage.deleteCharacter(characterId);
            if (!success) {
                showNotification('Failed to delete character', 'error');
                return;
            }

            // If the deleted character was the current one, clear it
            if (this._currentCharacter?.id === characterId) {
                this.currentCharacter = null;
            }

            // Remove the character card from the UI
            const cardElement = document.querySelector(`[data-character-id="${characterId}"]`);
            if (cardElement) {
                const characterCard = cardElement.closest('.col-md-6');
                if (characterCard) {
                    characterCard.remove();
                }
            }

            // If no characters left, show empty state
            const container = document.getElementById('characterList');
            if (container && !container.querySelector('.character-card')) {
                this._showEmptyState(container);
            }

            showNotification('Character deleted successfully', 'success');
            eventEmitter.emit('character:deleted', characterId);
        } catch (error) {
            console.error('Error deleting character:', error);
            showNotification('Error deleting character', 'error');
        }
    }

    /**
     * Handles character import from JSON file
     * @returns {Promise<void>}
     */
    async handleCharacterImport() {
        try {
            // Create a file input element
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';

            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    // Read the file
                    const text = await file.text();
                    const characterData = JSON.parse(text);

                    // Validate the character data
                    if (!characterData.id || !characterData.name) {
                        showNotification('Invalid character data', 'error');
                        return;
                    }

                    // Create a Character instance
                    const character = new Character(characterData);

                    // Save to storage
                    const success = await storage.saveCharacter(character);
                    if (!success) {
                        showNotification('Failed to import character', 'error');
                        return;
                    }

                    // Reload characters list
                    await this.loadCharacters();

                    // Select the imported character
                    await this.handleCharacterSelect(character.id);

                    showNotification('Character imported successfully', 'success');
                    eventEmitter.emit('character:imported', character);
                } catch (error) {
                    console.error('Error processing character import:', error);
                    showNotification('Error importing character: Invalid format', 'error');
                }
            });

            // Trigger the file dialog
            fileInput.click();
        } catch (error) {
            console.error('Error initiating character import:', error);
            showNotification('Error importing character', 'error');
        }
    }

    /**
     * Populates the details form fields with the current character's data
     */
    populateDetailsForm() {
        if (!this._currentCharacter) return;
        const fieldMap = {
            characterName: 'name',
            playerName: 'playerName',
            height: 'height',
            weight: 'weight',
            eyes: 'eyes',
            skin: 'skin',
            hair: 'hair',
            gender: 'gender',
            appearance: 'appearance',
            backstory: 'backstory',
            notes: 'notes'
        };
        for (const [fieldId, propName] of Object.entries(fieldMap)) {
            const el = document.getElementById(fieldId);
            if (el) {
                el.value = this._currentCharacter[propName] || '';
            }
        }
        eventEmitter.emit('character:formPopulated', this._currentCharacter);
    }
}

// Add event-driven notifications for character actions
eventEmitter.on('character:saved', (character) => {
    showNotification('Character saved successfully', 'success');
});
eventEmitter.on('character:deleted', (characterId) => {
    showNotification('Character deleted successfully', 'success');
});
eventEmitter.on('character:imported', (character) => {
    showNotification('Character imported successfully', 'success');
});
eventEmitter.on('character:exported', (character) => {
    showNotification('Character exported successfully', 'success');
});

// Export a singleton instance
export const characterHandler = new CharacterHandler();