/**
 * characterHandler.js
 * Manages D&D character creation, loading, saving, and deletion
 * 
 * @typedef {Object} DefaultCharacter
 * @property {string|null} id - The character's unique identifier
 * @property {string} name - The character's name
 * @property {number} level - The character's level
 * @property {Object} class - The character's class information
 * @property {number} class.level - The character's class level
 * @property {Object|null} race - The character's race information
 * @property {Object|null} background - The character's background information
 * @property {Object} abilityScores - The character's ability scores
 * @property {number} abilityScores.str - Strength score
 * @property {number} abilityScores.dex - Dexterity score
 * @property {number} abilityScores.con - Constitution score
 * @property {number} abilityScores.int - Intelligence score
 * @property {number} abilityScores.wis - Wisdom score
 * @property {number} abilityScores.cha - Charisma score
 * @property {Object} proficiencies - The character's proficiencies
 * @property {Array} feats - The character's feats
 * @property {Array} spells - The character's spells
 * @property {Array} equipment - The character's equipment
 * @property {string} lastModified - ISO timestamp of last modification
 * 
 * @typedef {Object} CharacterStorageResult
 * @property {boolean} success - Whether the operation was successful
 * @property {string} [message] - Optional message describing the result
 * @property {Error} [error] - Optional error if operation failed
 */

// Character handling utilities
import { Character } from '../models/Character.js';
import { showNotification } from './notifications.js';
import { navigation } from './navigation.js';
import { SourceCard } from '../ui/SourceCard.js';

let instance = null;

// Default character structure
const defaultCharacter = {
    id: null,
    name: '',
    level: 1,
    class: { level: 1 },
    race: null,
    background: null,
    abilityScores: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10
    },
    proficiencies: {},
    feats: [],
    spells: [],
    equipment: [],
    lastModified: new Date().toISOString()
};

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
        // Set up new character button
        const newCharacterBtn = document.getElementById('newCharacterBtn');
        if (newCharacterBtn) {
            // Remove any existing event listeners
            const newBtn = newCharacterBtn.cloneNode(true);
            newCharacterBtn.parentNode.replaceChild(newBtn, newCharacterBtn);

            // Add click handler
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.createNewCharacter(e);
            });
        }

        // Set up import character button
        const importCharacterBtn = document.getElementById('importCharacterBtn');
        if (importCharacterBtn) {
            // Remove any existing event listeners
            const newImportBtn = importCharacterBtn.cloneNode(true);
            importCharacterBtn.parentNode.replaceChild(newImportBtn, importCharacterBtn);

            // Add click handler
            newImportBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.handleCharacterImport();
            });
        }

        // Set up create character button in modal
        const createCharacterBtn = document.getElementById('createCharacterBtn');
        if (createCharacterBtn) {
            // Remove any existing event listeners
            const newCreateBtn = createCharacterBtn.cloneNode(true);
            createCharacterBtn.parentNode.replaceChild(newCreateBtn, createCharacterBtn);

            // Add click handler
            newCreateBtn.addEventListener('click', () => this.createCharacterFromModal());
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
            const characters = await window.characterStorage.loadCharacters();

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
                <div class="card character-card ${window.currentCharacter?.id === character.id ? 'selected' : ''}" 
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
                const characters = await window.characterStorage.loadCharacters();
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
            // Don't reload if it's the same character
            if (window.currentCharacter?.id === character.id) {
                return;
            }

            window.currentCharacter = Character.fromJSON(character);

            // Update active badge on all character cards
            const characterCards = document.querySelectorAll('.character-card');
            for (const card of characterCards) {
                const isSelected = card.dataset.characterId === character.id;
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

            // Dispatch character changed event
            document.dispatchEvent(new CustomEvent('characterChanged'));

        } catch (error) {
            console.error('Error selecting character:', error);
            showNotification('Error selecting character', 'danger');
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
            const result = await window.characterStorage.exportCharacter(characterId);
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
            const result = await window.characterStorage.deleteCharacter(characterId);

            // If the deleted character was the current character, clear it
            if (window.currentCharacter?.id === characterId) {
                window.currentCharacter = null;
                document.dispatchEvent(new CustomEvent('characterChanged'));
            }

            // Remove the character card from the UI
            const characterCard = document.querySelector(`[data-character-id="${characterId}"]`);
            if (characterCard) {
                characterCard.remove();
            }

            if (result.success) {
                showNotification('Character deleted successfully', 'success');
            } else {
                showNotification(result.message || 'Failed to delete character', 'danger');
            }

            // Reload the home page since the character list needs to be updated
            navigation.loadPage('home');

        } catch (error) {
            console.error('Error deleting character:', error);
            // Only show error notification if we haven't already shown one from the result.success check
            if (!document.querySelector('.notification-container .notification')) {
                showNotification('Error deleting character', 'danger');
            }
        }
    }

    /**
     * Handles the creation of a new character
     * @param {Event} e - The event that triggered character creation
     * @returns {Promise<void>}
     * @private
     */
    async createNewCharacter(e) {
        if (e) e.preventDefault();

        // Show the new character modal
        const modal = document.getElementById('newCharacterModal');
        if (modal) {
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();

            // Initialize source UI
            this.sourceCard.container = document.getElementById('sourceBookSelection');
            await this.sourceCard.initializeSourceSelection();
        } else {
            console.error('New character modal not found');
            showNotification('Could not open new character form', 'danger');
        }
    }

    /**
     * Creates a new character from the modal form data
     * @returns {Promise<void>}
     * @private
     */
    async createCharacterFromModal() {
        try {
            const form = document.getElementById('newCharacterForm');
            if (!form) {
                showNotification('Character creation form not found', 'danger');
                return;
            }

            // Trigger form validation
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const nameInput = document.getElementById('newCharacterName');
            const levelInput = document.getElementById('newCharacterLevel');
            const genderInput = document.getElementById('newCharacterGender');
            const featVariant = document.getElementById('featVariant');
            const multiclassVariant = document.getElementById('multiclassVariant');

            const name = nameInput.value.trim();
            const level = Number.parseInt(levelInput.value, 10);

            // Get selected sources from the existing SourceCard instance
            const selectedSources = new Set();

            // Get all selected toggles
            const selectedToggles = this.sourceCard.container.querySelectorAll('.source-toggle.selected');
            for (const toggle of selectedToggles) {
                selectedSources.add(toggle.getAttribute('data-source'));
            }

            // Validate source selection
            if (!this.sourceCard.validateSourceSelection(selectedSources)) {
                return;
            }

            // Generate a UUID for the new character
            const id = await window.characterStorage.generateUUID();

            // Create character with selected sources
            const character = {
                ...defaultCharacter,
                id: id,
                name: name,
                level: level,
                gender: genderInput.value,
                allowedSources: Array.from(selectedSources),
                variantRules: {
                    feats: featVariant.checked,
                    multiclassing: multiclassVariant.checked
                }
            };

            // Create character in storage
            const result = await window.characterStorage.saveCharacter(character);
            if (result.success) {
                // Close the modal
                const modal = document.getElementById('newCharacterModal');
                if (modal) {
                    const bootstrapModal = bootstrap.Modal.getInstance(modal);
                    if (bootstrapModal) {
                        // Move focus outside the modal before hiding it
                        const newCharacterBtn = document.getElementById('newCharacterBtn');
                        if (newCharacterBtn) {
                            newCharacterBtn.focus();
                        }
                        bootstrapModal.hide();
                    }
                }

                // Clear form
                form.reset();

                // Properly initialize and select the character
                await this.handleCharacterSelect(character);

                showNotification('New character created successfully', 'success');
                // Reload the character list
                await this.loadCharacters();
            } else {
                showNotification('Failed to create new character', 'danger');
            }
        } catch (error) {
            console.error('Error creating new character:', error);
            showNotification('Error creating new character', 'danger');
        }
    }

    /**
     * Handles the import of a character from a JSON file
     * @returns {Promise<void>}
     * @private
     */
    async handleCharacterImport() {
        try {
            const result = await window.characterStorage.importCharacter();
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