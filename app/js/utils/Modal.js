/**
 * Modal.js
 * Modal dialogs for character creation / deletion
 * 
 * @typedef {Object} ModalEventHandlers
 * @property {Function} onShowModal - Handler for when the modal is shown
 * @property {Function} onCreateCharacter - Handler for when a character is created
 * 
 * @typedef {Object} CharacterFormData
 * @property {string} name - The character's name
 * @property {number} level - The character's level
 * @property {string} gender - The character's gender
 * @property {boolean} feats - Whether feats are enabled
 * @property {boolean} multiclassing - Whether multiclassing is enabled
 * @property {string} abilityScoreMethod - The method for generating ability scores
 * @property {Set<string>} allowedSources - Set of allowed source books
 * @property {Object} variantRules - Character variant rules
 * @property {boolean} variantRules.feats - Whether feats are enabled
 * @property {boolean} variantRules.multiclassing - Whether multiclassing is enabled
 * @property {string} variantRules.abilityScoreMethod - The method for generating ability scores
 */

import { Character } from '../models/Character.js';
import { storage } from './Storage.js';
import { showNotification } from './notifications.js';
import { SourceCard } from '../ui/SourceCard.js';

let instance = null;

/**
 * Utility class for managing the character creation modal
 */
export class Modal {
    /**
     * Initializes a new Modal instance
     * @private
     */
    constructor() {
        if (instance) {
            throw new Error('Modal is a singleton. Use Modal.getInstance() instead.');
        }
        instance = this;
        this.sourceCard = new SourceCard();
        this.eventHandlers = {
            onShowModal: null,
            onCreateCharacter: null
        };
    }

    /**
     * Sets up event listeners for the modal
     * @param {ModalEventHandlers} handlers - Event handlers
     */
    setupEventListeners(handlers = {}) {
        // Store event handlers
        this.eventHandlers = handlers;

        // Set up new character button
        this.setupButtonEventListener('newCharacterBtn', (e) => {
            e.preventDefault();
            if (this.eventHandlers.onShowModal) {
                this.eventHandlers.onShowModal(e);
            }
        });

        // Set up create character button in modal
        this.setupButtonEventListener('createCharacterBtn', () => this.createCharacterFromModal());
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
     * Shows the new character modal
     * @param {Event} e - The event that triggered showing the modal
     */
    async showNewCharacterModal(e) {
        if (e) e.preventDefault();

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
     * Closes the new character modal and resets the form
     * @private
     */
    closeNewCharacterModal() {
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
        const form = document.getElementById('newCharacterForm');
        if (form) {
            form.reset();
        }
    }

    /**
     * Gets form data from the new character modal
     * @returns {CharacterFormData|null} The form data or null if form is invalid
     * @private
     */
    getFormData() {
        const form = document.getElementById('newCharacterForm');
        if (!form) {
            showNotification('Character creation form not found', 'danger');
            return null;
        }

        // Trigger form validation
        if (!form.checkValidity()) {
            form.reportValidity();
            return null;
        }

        const nameInput = document.getElementById('newCharacterName');
        const levelInput = document.getElementById('newCharacterLevel');
        const genderInput = document.getElementById('newCharacterGender');
        const featVariant = document.getElementById('featVariant');
        const multiclassVariant = document.getElementById('multiclassVariant');

        return {
            name: nameInput.value.trim(),
            level: Number.parseInt(levelInput.value, 10),
            gender: genderInput.value,
            feats: featVariant.checked,
            multiclassing: multiclassVariant.checked,
            abilityScoreMethod: form.querySelector('input[name="abilityScoreMethod"]:checked').value
        };
    }

    /**
     * Gets selected sources from the source card
     * @returns {Set<string>} Set of selected source codes
     * @private
     */
    getSelectedSources() {
        const selectedSources = new Set();
        const selectedToggles = this.sourceCard.container.querySelectorAll('.source-toggle.selected');

        for (const toggle of selectedToggles) {
            const source = toggle.getAttribute('data-source').toUpperCase();
            selectedSources.add(source);
        }

        return selectedSources;
    }

    /**
     * Creates a new character from the modal form data
     */
    async createCharacterFromModal() {
        try {
            console.debug('[Modal] Starting character creation from modal');

            // Get form data
            const formData = this.getFormData();
            if (!formData) return;

            // Get selected sources
            const selectedSources = this.getSelectedSources();
            if (!this.sourceCard.validateSourceSelection(selectedSources)) {
                console.warn('[Modal] Source selection validation failed');
                return;
            }

            // Generate a UUID for the new character
            const id = await storage.generateUUID();

            // Create a new Character instance
            const character = new Character();
            character.id = id;
            character.name = formData.name;
            character.level = formData.level;
            character.gender = formData.gender;
            character.allowedSources = selectedSources;
            character.variantRules = {
                feats: formData.feats,
                multiclassing: formData.multiclassing,
                abilityScoreMethod: formData.abilityScoreMethod
            };

            console.debug('[Modal] Character before save:', {
                id: character.id,
                name: character.name,
                allowedSources: Array.from(character.allowedSources),
                variantRules: character.variantRules
            });

            // Create character in storage
            const result = await storage.saveCharacter(character);

            if (result.success) {
                // Close modal and reset form
                this.closeNewCharacterModal();

                // Call the onCreateCharacter callback if provided
                if (this.eventHandlers.onCreateCharacter) {
                    await this.eventHandlers.onCreateCharacter(character);
                }

                // Reload the character list
                const characterList = document.getElementById('characterList');
                if (characterList) {
                    const characterHandler = (await import('./characterHandler.js')).characterHandler;
                    await characterHandler.loadCharacters();
                }

                showNotification('New character created successfully', 'success');
            } else {
                showNotification('Failed to create new character', 'danger');
            }
        } catch (error) {
            console.error('Error creating new character:', error);
            showNotification('Error creating new character', 'danger');
        }
    }

    /**
     * Shows a confirmation dialog with the given title and message
     * @param {string} title - The title of the confirmation dialog
     * @param {string} message - The message to display
     * @returns {Promise<boolean>} True if confirmed, false if cancelled
     */
    async showConfirmationDialog(title, message) {
        return new Promise((resolve) => {
            // Get modal elements
            const modalElement = document.getElementById('confirmationModal');
            const titleElement = document.getElementById('confirmationModalLabel');
            const messageElement = document.getElementById('confirmationMessage');
            const confirmButton = document.getElementById('confirmButton');
            const closeButton = modalElement.querySelector('.btn-close');
            const cancelButton = modalElement.querySelector('.btn-secondary');

            // Set content
            titleElement.textContent = title;
            messageElement.textContent = message;

            // Create modal instance
            const modal = new bootstrap.Modal(modalElement);

            // Handle button clicks
            const handleConfirm = () => {
                modal.hide();
                resolve(true);
            };

            const handleCancel = () => {
                modal.hide();
                resolve(false);
            };

            // Add event listeners
            confirmButton.addEventListener('click', handleConfirm);
            closeButton.addEventListener('click', handleCancel);
            cancelButton.addEventListener('click', handleCancel);

            // Handle modal hidden event
            modalElement.addEventListener('hidden.bs.modal', () => {
                // Clean up event listeners
                confirmButton.removeEventListener('click', handleConfirm);
                closeButton.removeEventListener('click', handleCancel);
                cancelButton.removeEventListener('click', handleCancel);
                modalElement.removeEventListener('hidden.bs.modal', handleCancel);
            });

            // Show modal
            modal.show();
        });
    }

    /**
     * Gets the singleton instance of Modal
     * @returns {Modal} The singleton instance
     * @static
     */
    static getInstance() {
        if (!instance) {
            instance = new Modal();
        }
        return instance;
    }
}

export const modal = Modal.getInstance(); 