/**
 * Modal.js
 * Utility for managing modal dialogs for user interactions
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
 *
 * @typedef {Object} ConfirmationOptions
 * @property {string} title - The title of the confirmation dialog
 * @property {string} message - The message to display
 * @property {string} [confirmButtonText='Confirm'] - Text for the confirm button
 * @property {string} [cancelButtonText='Cancel'] - Text for the cancel button
 * @property {string} [confirmButtonClass='btn-primary'] - CSS class for the confirm button
 */

// Removed unused imports during cleanup
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { Logger } from '../infrastructure/Logger.js';
import { SourceCard } from '../modules/sources/SourceCard.js';
import { showNotification } from '../utils/Notifications.js';

/**
 * Singleton instance for Modal class
 * @type {Modal|null}
 * @private
 */
let _instance = null;

/**
 * Utility class for managing modal dialogs
 */
export class Modal {
	/**
	 * Initializes a new Modal instance
	 * @private
	 */
	constructor() {
		if (_instance) {
			throw new Error('Modal is a singleton. Use Modal.getInstance() instead.');
		}

		/**
		 * Source card for managing source book selection
		 * @type {SourceCard}
		 * @private
		 */
		this._sourceCard = new SourceCard();

		/**
		 * Event handlers for modal interactions
		 * @type {ModalEventHandlers}
		 * @private
		 */
		this._eventHandlers = {
			onShowModal: null,
			onCreateCharacter: null,
		};

		/**
		 * Flag to track if button listeners have been set up
		 * @type {boolean}
		 * @private
		 */
		this._buttonListenersSetup = false;

		_instance = this;
	}

	//-------------------------------------------------------------------------
	// Event Handling
	//-------------------------------------------------------------------------

	/**
	 * Sets up event listeners for modal interactions
	 * @param {ModalEventHandlers} handlers - Event handlers
	 */
	setupEventListeners(handlers = {}) {
		try {
			// Store event handlers
			this._eventHandlers = handlers;

			// Button listener setup is now deferred to ensureInitialized()
			// This is needed because Modal is instantiated before DOM is ready
		} catch (error) {
			Logger.error('Modal', 'Error setting up modal event listeners:', error);
		}
	}

	/**
	 * Ensures that button listeners have been set up
	 * Called when the home page initializes (guaranteed DOM is ready)
	 * @public
	 */
	ensureInitialized() {
		if (this._buttonListenersSetup) {
			return; // Already initialized
		}

		try {
			this._setupButtonEventListeners();
			this._buttonListenersSetup = true;
		} catch (error) {
			Logger.error(
				'Modal',
				'Error initializing Modal button listeners:',
				error,
			);
		}
	}

	/**
	 * Sets up button event listeners for the new character modal
	 * @private
	 */
	_setupButtonEventListeners() {
		// Set up new character button
		this._setupButtonEventListener('newCharacterBtn', (e) => {
			e.preventDefault();
			eventBus.emit(EVENTS.NEW_CHARACTER_MODAL_OPENED);
			if (this._eventHandlers.onShowModal) {
				this._eventHandlers.onShowModal(e);
			}
		});

		// Set up create character button in modal
		this._setupButtonEventListener('createCharacterBtn', () =>
			this._createCharacterFromModal(),
		);
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
			if (!button) {
				return;
			}

			const newButton = button.cloneNode(true);
			button.parentNode.replaceChild(newButton, button);
			newButton.addEventListener('click', handler);
		} catch (error) {
			Logger.error(
				'Modal',
				`Error setting up button listener for ${buttonId}:`,
				error,
			);
		}
	}

	//-------------------------------------------------------------------------
	// Character Creation Modal
	//-------------------------------------------------------------------------

	/**
	 * Shows the new character modal
	 * @param {Event} [e] - The event that triggered showing the modal
	 */
	async showNewCharacterModal(e) {
		try {
			if (e) e.preventDefault();

			const modal = document.getElementById('newCharacterModal');
			if (!modal) {
				Logger.error('Modal', 'New character modal not found in the DOM');
				showNotification('Could not open new character form', 'error');
				return;
			}

			const bootstrapModal = new bootstrap.Modal(modal);
			bootstrapModal.show();

			// Initialize source UI
			this._sourceCard.container = document.getElementById(
				'sourceBookSelection',
			);
			await this._sourceCard.initializeSourceSelection();
		} catch (error) {
			Logger.error('Modal', 'Error showing new character modal:', error);
			showNotification('Could not open new character form', 'error');
		}
	}

	/**
	 * Closes the new character modal and resets the form
	 * @private
	 */
	_closeNewCharacterModal() {
		try {
			const modal = document.getElementById('newCharacterModal');
			if (!modal) {
				return;
			}

			const bootstrapModal = bootstrap.Modal.getInstance(modal);
			if (bootstrapModal) {
				// Move focus outside the modal before hiding it
				const newCharacterBtn = document.getElementById('newCharacterBtn');
				if (newCharacterBtn) {
					newCharacterBtn.focus();
				}
				bootstrapModal.hide();
			}

			// Clear form
			const form = document.getElementById('newCharacterForm');
			if (form) {
				form.reset();
			}
		} catch (error) {
			Logger.error('Modal', 'Error closing new character modal:', error);
		}
	}

	/**
	 * Gets form data from the new character modal
	 * @returns {CharacterFormData|null} The form data or null if form is invalid
	 * @private
	 */
	_getFormData() {
		try {
			const form = document.getElementById('newCharacterForm');
			if (!form) {
				showNotification('Character creation form not found', 'error');
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
			const abilityScoreMethod = form.querySelector(
				'input[name="abilityScoreMethod"]:checked',
			);

			if (
				!nameInput ||
				!levelInput ||
				!genderInput ||
				!featVariant ||
				!multiclassVariant ||
				!abilityScoreMethod
			) {
				Logger.error('Modal', 'One or more form fields not found');
				showNotification('Missing fields in character creation form', 'error');
				return null;
			}

			return {
				name: nameInput.value.trim(),
				level: Number.parseInt(levelInput.value, 10),
				gender: genderInput.value,
				feats: featVariant.checked,
				multiclassing: multiclassVariant.checked,
				abilityScoreMethod: abilityScoreMethod.value,
			};
		} catch (error) {
			Logger.error('Modal', 'Error getting form data:', error);
			return null;
		}
	}

	/**
	 * Gets selected sources from the source card
	 * @returns {Set<string>} Set of selected source codes
	 * @private
	 */
	_getSelectedSources() {
		try {
			const selectedSources = new Set();
			if (!this._sourceCard.container) {
				Logger.error('Modal', 'Source card container not found');
				return selectedSources;
			}

			const selectedToggles = this._sourceCard.container.querySelectorAll(
				'.source-toggle.selected',
			);
			for (const toggle of selectedToggles) {
				const source = toggle.getAttribute('data-source')?.toUpperCase();
				if (source) {
					selectedSources.add(source);
				}
			}

			return selectedSources;
		} catch (error) {
			Logger.error('Modal', 'Error getting selected sources:', error);
			return new Set();
		}
	}

	/**
	 * Creates a new character from the modal form data
	 * @private
	 */
	async _createCharacterFromModal() {
		try {
			// Get form data
			const formData = this._getFormData();
			if (!formData) return;

			// Get selected sources
			const selectedSources = this._getSelectedSources();
			if (!this._sourceCard.validateSourceSelection(selectedSources)) {
				Logger.warn('Modal', 'Source selection validation failed');
				return;
			}

			// Import CharacterManager
			const { CharacterManager } = await import('./CharacterManager.js');

			// Create character using CharacterManager
			const createResult = await CharacterManager.createCharacter(
				formData.name,
			);

			if (!createResult.isOk()) {
				showNotification(
					`Failed to create character: ${createResult.error}`,
					'error',
				);
				return;
			}

			const character = createResult.value;

			// Update character with form data
			character.level = formData.level;
			character.gender = formData.gender;
			character.allowedSources = Array.from(selectedSources);
			character.variantRules = {
				feats: formData.feats,
				multiclassing: formData.multiclassing,
				abilityScoreMethod: formData.abilityScoreMethod,
			};

			// Save character
			const saveResult = await CharacterManager.saveCharacter();

			if (saveResult.isOk()) {
				// Close modal and reset form
				this._closeNewCharacterModal();

				// Call the onCreateCharacter callback if provided
				if (this._eventHandlers.onCreateCharacter) {
					await this._eventHandlers.onCreateCharacter(character);
				}

				// Reload the character list if needed
				await this._reloadCharacterList();

				showNotification('New character created successfully', 'success');
			} else {
				showNotification(
					`Failed to save character: ${saveResult.error}`,
					'error',
				);
			}
		} catch (error) {
			Logger.error('Modal', 'Error creating new character:', error);
			showNotification('Error creating new character', 'error');
		}
	}

	/**
	 * Reloads the character list if it exists
	 * @private
	 */
	async _reloadCharacterList() {
		try {
			const characterList = document.getElementById('characterList');
			if (characterList) {
				const { CharacterManager } = await import('./CharacterManager.js');
				await CharacterManager.loadCharacterList();
			}
		} catch (error) {
			Logger.error('Modal', 'Error reloading character list:', error);
		}
	}

	//-------------------------------------------------------------------------
	// Confirmation Dialog
	//-------------------------------------------------------------------------

	/**
	 * Shows a confirmation dialog with customizable options
	 * @param {ConfirmationOptions} options - Configuration options for the dialog
	 * @returns {Promise<boolean>} True if confirmed, false if cancelled
	 */
	async showConfirmationModal(options) {
		try {
			const {
				title,
				message,
				confirmButtonText = 'Confirm',
				cancelButtonText = 'Cancel',
				confirmButtonClass = 'btn-primary',
			} = options;

			if (!title || !message) {
				Logger.error(
					'Modal',
					'Missing required parameters for confirmation dialog',
				);
				return false;
			}

			// Get modal elements
			const modalElement = document.getElementById('confirmationModal');
			const titleElement = document.getElementById('confirmationModalLabel');
			const messageElement = document.getElementById('confirmationMessage');
			const confirmButton = document.getElementById('confirmButton');
			const cancelButton = modalElement?.querySelector('.btn-secondary');
			const closeButton = modalElement?.querySelector('.btn-close');

			if (
				!modalElement ||
				!titleElement ||
				!messageElement ||
				!confirmButton ||
				!cancelButton ||
				!closeButton
			) {
				Logger.error(
					'Modal',
					'One or more confirmation modal elements not found',
				);
				return false;
			}

			// Set content
			titleElement.textContent = title;
			messageElement.textContent = message;
			confirmButton.textContent = confirmButtonText;
			cancelButton.textContent = cancelButtonText;

			// Set button class
			confirmButton.className = `btn ${confirmButtonClass}`;

			// Create modal instance
			const modal = new bootstrap.Modal(modalElement);

			return new Promise((resolve) => {
				// Handle button clicks
				const handleConfirm = () => {
					cleanup();
					modal.hide();
					resolve(true);
				};

				const handleCancel = () => {
					cleanup();
					modal.hide();
					resolve(false);
				};

				const handleHidden = () => {
					cleanup();
					resolve(false);
				};

				// Clean up event listeners
				const cleanup = () => {
					confirmButton.removeEventListener('click', handleConfirm);
					cancelButton.removeEventListener('click', handleCancel);
					closeButton.removeEventListener('click', handleCancel);
					modalElement.removeEventListener('hidden.bs.modal', handleHidden);
				};

				// Add event listeners
				confirmButton.addEventListener('click', handleConfirm);
				cancelButton.addEventListener('click', handleCancel);
				closeButton.addEventListener('click', handleCancel);
				modalElement.addEventListener('hidden.bs.modal', handleHidden);

				// Show modal
				modal.show();
			});
		} catch (error) {
			Logger.error('Modal', 'Error showing confirmation dialog:', error);
			return false;
		}
	}

	/**
	 * Shows a modal for handling duplicate character ID during import
	 * @param {Object} options - Configuration options
	 * @param {string} options.characterName - Name of the character being imported
	 * @param {string} options.characterId - ID of the character that already exists
	 * @param {string} options.createdAt - Creation date of the existing character
	 * @param {string} options.lastModified - Last modified date of the existing character
	 * @returns {Promise<string>} Action chosen: 'overwrite', 'keepBoth', or 'cancel'
	 */
	async showDuplicateIdModal(options) {
		try {
			const { characterName, characterId, createdAt, lastModified } = options;

			if (!characterName || !characterId) {
				Logger.error(
					'Modal',
					'Missing required parameters for duplicate ID modal',
				);
				return 'cancel';
			}

			// Get modal elements
			const modalElement = document.getElementById('confirmationModal');
			const titleElement = document.getElementById('confirmationModalLabel');
			const messageElement = document.getElementById('confirmationMessage');
			const confirmButton = document.getElementById('confirmButton');
			const cancelButton = modalElement?.querySelector('.btn-secondary');
			const closeButton = modalElement?.querySelector('.btn-close');

			if (
				!modalElement ||
				!titleElement ||
				!messageElement ||
				!confirmButton ||
				!cancelButton ||
				!closeButton
			) {
				Logger.error('Modal', 'One or more modal elements not found');
				return 'cancel';
			}

			// Format the dates
			const createdDate = createdAt
				? new Date(createdAt).toLocaleDateString()
				: 'Unknown';
			const modifiedDate = lastModified
				? new Date(lastModified).toLocaleDateString()
				: 'Unknown';

			// Set content with icons
			titleElement.textContent = 'Character Already Exists';
			messageElement.innerHTML = `
                A character with this file ID already exists. What would you like to do?<br><br>
                <i class="fas fa-user" style="color: var(--accent-color);"></i>&nbsp;&nbsp;<strong style="color: var(--accent-color);">Character Name:</strong> ${characterName}<br>
                <i class="fas fa-fingerprint" style="color: var(--accent-color);"></i>&nbsp;&nbsp;<strong style="color: var(--accent-color);">File ID:</strong> ${characterId}<br>
                <i class="fas fa-clock" style="color: var(--accent-color);"></i>&nbsp;&nbsp;<strong style="color: var(--accent-color);">Date Created:</strong> ${createdDate}<br>
                <i class="fas fa-pen" style="color: var(--accent-color);"></i>&nbsp;&nbsp;<strong style="color: var(--accent-color);">Last Modified:</strong> ${modifiedDate}
            `;
			confirmButton.textContent = 'Overwrite';

			// Set button classes
			confirmButton.className = 'btn btn-danger';

			// Create a "Keep Both" button
			const keepBothButton = document.createElement('button');
			keepBothButton.type = 'button';
			keepBothButton.className = 'btn btn-secondary';
			keepBothButton.textContent = 'Keep Both';

			// Hide the cancel button
			cancelButton.style.display = 'none';

			// Insert the button where the cancel button was
			const buttonContainer = cancelButton.parentElement;
			buttonContainer.insertBefore(keepBothButton, cancelButton);

			// Create modal instance
			const modal = new bootstrap.Modal(modalElement);

			return new Promise((resolve) => {
				const handleOverwrite = () => {
					cleanup();
					modal.hide();
					resolve('overwrite');
				};

				const handleKeepBoth = () => {
					cleanup();
					modal.hide();
					resolve('keepBoth');
				};

				const handleCloseIcon = () => {
					cleanup();
					modal.hide();
					resolve('cancel');
				};

				const handleHidden = () => {
					cleanup();
					resolve('cancel');
				};

				const cleanup = () => {
					confirmButton.removeEventListener('click', handleOverwrite);
					keepBothButton.removeEventListener('click', handleKeepBoth);
					closeButton.removeEventListener('click', handleCloseIcon);
					modalElement.removeEventListener('hidden.bs.modal', handleHidden);
					keepBothButton.remove(); // Remove the temporary button
					cancelButton.style.display = 'block'; // Restore cancel button for future use
				};

				// Add event listeners
				confirmButton.addEventListener('click', handleOverwrite);
				keepBothButton.addEventListener('click', handleKeepBoth);
				closeButton.addEventListener('click', handleCloseIcon);
				modalElement.addEventListener('hidden.bs.modal', handleHidden);

				// Show modal
				modal.show();
			});
		} catch (error) {
			Logger.error('Modal', 'Error showing duplicate ID modal:', error);
			return 'cancel';
		}
	}

	/**
	 * Gets the singleton instance of Modal
	 * @returns {Modal} The singleton instance
	 * @static
	 */
	static getInstance() {
		if (!_instance) {
			_instance = new Modal();
		}
		return _instance;
	}
}

// Export a singleton instance
export const modal = Modal.getInstance();
