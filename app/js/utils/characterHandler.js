// Character handling utilities
import { Character } from '../models/Character.js';
import { showNotification } from './notifications.js';
import { navigation } from './navigation.js';

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
    equipment: []
};

export class CharacterHandler {
    constructor() {
        if (instance) {
            throw new Error('CharacterHandler is a singleton. Use CharacterHandler.getInstance() instead.');
        }
        instance = this;
    }

    initialize() {
        // Load existing characters
        this.loadCharacters();

        // Initialize event listeners
        this.initializeEventListeners();

        console.log('Character system initialized');
    }

    // Initialize event listeners for character-related buttons
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

    // Load and display characters
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
                if (!characterList.querySelector(`[data-character-id="${character.id}"]`)) {
                    const card = this.createCharacterCard(character);
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

    // Create a character card
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
                                <span>${new Date(character.lastModified).toLocaleDateString()}</span>
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

    // No Character Placeholder
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

    getUniqueCharacters(characters) {
        const uniqueMap = new Map(characters.map(char => [char.id, char]));
        return Array.from(uniqueMap.values()).sort((a, b) => {
            const dateA = new Date(a.lastModified || 0);
            const dateB = new Date(b.lastModified || 0);
            return dateB - dateA;
        });
    }

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

    // Character management methods
    async handleCharacterSelect(character) {
        try {
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
            showNotification('Error deleting character', 'danger');
        }
    }

    // Create a new character
    async createNewCharacter(e) {
        if (e) e.preventDefault();

        // Show the new character modal
        const modal = document.getElementById('newCharacterModal');
        if (modal) {
            const bootstrapModal = new bootstrap.Modal(modal);
            bootstrapModal.show();
        } else {
            console.error('New character modal not found');
            showNotification('Could not open new character form', 'danger');
        }
    }

    // Create a character from modal form
    async createCharacterFromModal() {
        try {
            const nameInput = document.getElementById('newCharacterName');
            const levelInput = document.getElementById('newCharacterLevel');

            if (!nameInput || !levelInput) {
                showNotification('Character creation form not found', 'danger');
                return;
            }

            const name = nameInput.value.trim();
            const level = Number.parseInt(levelInput.value, 10);

            if (!name) {
                showNotification('Please enter a character name', 'warning');
                return;
            }

            if (Number.isNaN(level) || level < 1 || level > 20) {
                showNotification('Level must be between 1 and 20', 'warning');
                return;
            }

            // Create a new character with form values
            const newCharacter = {
                id: crypto.randomUUID(),
                name: name,
                level: level,
                class: null,
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
                proficiencies: [],
                feats: [],
                spells: [],
                equipment: [],
                lastModified: new Date().toISOString()
            };

            // Save the new character
            const result = await window.characterStorage.saveCharacter(newCharacter);
            if (result.success) {
                // Close the modal
                const modal = document.getElementById('newCharacterModal');
                if (modal) {
                    const bootstrapModal = bootstrap.Modal.getInstance(modal);
                    if (bootstrapModal) {
                        bootstrapModal.hide();
                    }
                }

                // Clear form
                nameInput.value = '';
                levelInput.value = '1';

                showNotification('New character created successfully', 'success');
                // Reload the character list
                await this.loadCharacters();
                // Navigate to character builder
                navigation.loadPage('build');
            } else {
                showNotification('Failed to create new character', 'danger');
            }
        } catch (error) {
            console.error('Error creating new character:', error);
            showNotification('Error creating new character', 'danger');
        }
    }

    // Import a character from file
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

    static getInstance() {
        if (!instance) {
            instance = new CharacterHandler();
        }
        return instance;
    }
}

export const characterHandler = CharacterHandler.getInstance(); 