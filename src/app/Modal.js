import { eventBus, EVENTS } from '../lib/EventBus.js';

import { DOMCleanup } from '../lib/DOMCleanup.js';
import { initializeBootstrapModal } from '../lib/ModalCleanupUtility.js';
import { showNotification } from '../lib/Notifications.js';
import { AppState } from './AppState.js';

let _instance = null;

export class Modal {
	constructor() {
		if (_instance) {
			throw new Error('Modal is a singleton. Use Modal.getInstance() instead.');
		}

		this._eventHandlers = {
			onShowModal: null,
			onCreateCharacter: null,
		};
		this._buttonListenersSetup = false;

		// DOM cleanup manager for this modal instance
		this._cleanup = DOMCleanup.create();

		_instance = this;
	}

	setupEventListeners(handlers = {}) {
		try {
			this._eventHandlers = handlers;
		} catch (error) {
			console.error('Modal', 'Error setting up modal event listeners:', error);
		}
	}

	ensureInitialized() {
		try {
			this._setupButtonEventListeners();
			this._buttonListenersSetup = true;
		} catch (error) {
			console.error(
				'Modal',
				'Error initializing Modal button listeners:',
				error,
			);
		}
	}

	_setupButtonEventListeners() {
		// Set up new character button
		this._setupButtonEventListener('newCharacterBtn', (e) => {
			e.preventDefault();
			eventBus.emit(EVENTS.NEW_CHARACTER_MODAL_OPENED);
			if (this._eventHandlers.onShowModal) {
				this._eventHandlers.onShowModal(e);
			}
		});
	}

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
			console.error(
				'Modal',
				`Error setting up button listener for ${buttonId}:`,
				error,
			);
		}
	}

	async showNewCharacterModal(e) {
		try {
			if (e) e.preventDefault();

			const failedServices = AppState.getFailedServices();
			if (Array.isArray(failedServices) && failedServices.length > 0) {
				const message = `Cannot create characters until data loads (${failedServices.join(', ')}).`;
				showNotification(message, 'error');
				return;
			}

			const { CharacterCreationModal } = await import(
				'../ui/components/character/CharacterCreationModal.js'
			);
			const characterCreationModal = new CharacterCreationModal();
			await characterCreationModal.show();
		} catch (error) {
			console.error('Modal', 'Error showing new character modal:', error);
			showNotification('Could not open new character form', 'error');
		}
	}

	/** Shows a confirmation dialog. Returns true if confirmed. */
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
				console.error(
					'Modal',
					'Missing required parameters for confirmation dialog',
				);
				return false;
			}

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
				console.error(
					'Modal',
					'One or more confirmation modal elements not found',
				);
				return false;
			}

			titleElement.textContent = title;
			messageElement.textContent = message;
			confirmButton.textContent = confirmButtonText;
			cancelButton.textContent = cancelButtonText;

			confirmButton.className = `btn ${confirmButtonClass}`;

			// Use safe modal initialization to prevent backdrop stacking
			const modal = initializeBootstrapModal(modalElement);
			if (!modal) {
				console.error('Modal', 'Failed to initialize confirmation modal');
				return false;
			}

			return new Promise((resolve) => {
				let resolved = false;
				let resolveValue = false;

				const handleConfirm = () => {
					resolveValue = true;
					modal.hide();
				};

				const handleCancel = () => {
					resolveValue = false;
					modal.hide();
				};

				const handleHidden = () => {
					cleanup();
					if (!resolved) {
						resolved = true;
						resolve(resolveValue);
					}
				};

				const cleanup = () => {
					confirmButton.removeEventListener('click', handleConfirm);
					cancelButton.removeEventListener('click', handleCancel);
					closeButton.removeEventListener('click', handleCancel);
					modalElement.removeEventListener('hidden.bs.modal', handleHidden);
					// Dispose modal instance to clean up backdrops
					try {
						modal.dispose();
					} catch (e) {
						console.warn('Modal', 'Error disposing confirmation modal', e);
					}
				};

				confirmButton.addEventListener('click', handleConfirm);
				cancelButton.addEventListener('click', handleCancel);
				closeButton.addEventListener('click', handleCancel);
				modalElement.addEventListener('hidden.bs.modal', handleHidden);

				modal.show();
			});
		} catch (error) {
			console.error('Modal', 'Error showing confirmation dialog:', error);
			return false;
		}
	}

	/** Shows modal for handling duplicate character ID during import. Returns 'overwrite', 'keepBoth', or 'cancel'. */
	async showDuplicateIdModal(options) {
		try {
			const { characterName, characterId, createdAt, lastModified } = options;

			if (!characterName || !characterId) {
				console.error(
					'Modal',
					'Missing required parameters for duplicate ID modal',
				);
				return 'cancel';
			}

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
				console.error('Modal', 'One or more modal elements not found');
				return 'cancel';
			}

			const createdDate = createdAt
				? new Date(createdAt).toLocaleDateString()
				: 'Unknown';
			const modifiedDate = lastModified
				? new Date(lastModified).toLocaleDateString()
				: 'Unknown';

			titleElement.textContent = 'Character Already Exists';
			messageElement.innerHTML = `
                A character with this file ID already exists. What would you like to do?<br><br>
                <i class="fas fa-user character-exists-icon"></i>&nbsp;&nbsp;<strong class="character-exists-label">Character Name:</strong> ${characterName}<br>
                <i class="fas fa-fingerprint character-exists-icon"></i>&nbsp;&nbsp;<strong class="character-exists-label">File ID:</strong> ${characterId}<br>
                <i class="fas fa-clock character-exists-icon"></i>&nbsp;&nbsp;<strong class="character-exists-label">Date Created:</strong> ${createdDate}<br>
                <i class="fas fa-pen character-exists-icon"></i>&nbsp;&nbsp;<strong class="character-exists-label">Last Modified:</strong> ${modifiedDate}
            `;
			confirmButton.textContent = 'Overwrite';

			confirmButton.className = 'btn btn-danger';

			const keepBothButton = document.createElement('button');
			keepBothButton.type = 'button';
			keepBothButton.className = 'btn btn-secondary';
			keepBothButton.textContent = 'Keep Both';

			cancelButton.style.display = 'none';

			const buttonContainer = cancelButton.parentElement;
			buttonContainer.insertBefore(keepBothButton, cancelButton);

			// Use safe modal initialization to prevent backdrop stacking
			const modal = initializeBootstrapModal(modalElement);
			if (!modal) {
				console.error('Modal', 'Failed to initialize duplicate ID modal');
				return 'cancel';
			}

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
					// Dispose modal instance to clean up backdrops
					try {
						modal.dispose();
					} catch (e) {
						console.warn('Modal', 'Error disposing duplicate ID modal', e);
					}
				};

				confirmButton.addEventListener('click', handleOverwrite);
				keepBothButton.addEventListener('click', handleKeepBoth);
				closeButton.addEventListener('click', handleCloseIcon);
				modalElement.addEventListener('hidden.bs.modal', handleHidden);

				modal.show();
			});
		} catch (error) {
			console.error('Modal', 'Error showing duplicate ID modal:', error);
			return 'cancel';
		}
	}

	static getInstance() {
		if (!_instance) {
			_instance = new Modal();
		}
		return _instance;
	}
}

// Export a singleton instance
export const modal = Modal.getInstance();
