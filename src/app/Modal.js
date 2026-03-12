import { DOMCleanup } from '../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';

import { initializeBootstrapModal } from '../lib/ModalCleanupUtility.js';
import { showNotification } from '../lib/Notifications.js';
import { AppState } from './AppState.js';

export class Modal {
	constructor() {
		this._eventHandlers = {
			onShowModal: null,
			onCreateCharacter: null,
		};
		this._cleanup = DOMCleanup.create();
		this._buttonListenersSetup = false;
	}

	setupEventListeners(handlers = {}) {
		try {
			this._eventHandlers = handlers;
		} catch (error) {
			console.error('[Modal]', 'Error setting up modal event listeners:', error);
		}
	}

	ensureInitialized() {
		try {
			this._cleanup.cleanup();
			this._setupButtonEventListeners();
			this._buttonListenersSetup = true;
		} catch (error) {
			console.error(
				'[Modal]',
				'Error initializing Modal button listeners:',
				error,
			);
		}
	}

	_setupButtonEventListeners() {
		const button = document.getElementById('newCharacterBtn');
		if (!button) return;

		const handler = (e) => {
			e.preventDefault();
			eventBus.emit(EVENTS.NEW_CHARACTER_MODAL_OPENED);
			if (this._eventHandlers.onShowModal) {
				this._eventHandlers.onShowModal(e);
			}
		};
		this._cleanup.on(button, 'click', handler);
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
			console.error('[Modal]', 'Error showing new character modal:', error);
			showNotification('Could not open new character form', 'error');
		}
	}

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
					'[Modal]',
					'Missing required parameters for confirmation dialog',
				);
				return false;
			}

			const elements = this._getModalElements();
			if (!elements) return false;

			const { modalElement, titleElement, messageElement, confirmButton, cancelButton, closeButton } = elements;

			titleElement.textContent = title;
			messageElement.textContent = message;
			confirmButton.textContent = confirmButtonText;
			cancelButton.textContent = cancelButtonText;
			confirmButton.className = `btn ${confirmButtonClass}`;

			return this._showPromiseModal({
				modalElement,
				buttons: [
					{ element: confirmButton, value: true },
					{ element: cancelButton, value: false },
					{ element: closeButton, value: false },
				],
				defaultValue: false,
			});
		} catch (error) {
			console.error('[Modal]', 'Error showing confirmation dialog:', error);
			return false;
		}
	}

	async showDuplicateIdModal(options) {
		try {
			const { characterName, characterId, createdAt, lastModified } = options;

			if (!characterName || !characterId) {
				console.error(
					'[Modal]',
					'Missing required parameters for duplicate ID modal',
				);
				return 'cancel';
			}

			const elements = this._getModalElements();
			if (!elements) return 'cancel';

			const { modalElement, titleElement, messageElement, confirmButton, cancelButton, closeButton } = elements;

			const createdDate = createdAt
				? new Date(createdAt).toLocaleDateString()
				: 'Unknown';
			const modifiedDate = lastModified
				? new Date(lastModified).toLocaleDateString()
				: 'Unknown';

			titleElement.textContent = 'Character Already Exists';
			messageElement.textContent = '';

			const intro = document.createTextNode('A character with this file ID already exists. What would you like to do?');
			messageElement.appendChild(intro);
			messageElement.appendChild(document.createElement('br'));
			messageElement.appendChild(document.createElement('br'));

			const fields = [
				{ icon: 'fa-user', label: 'Character Name:', value: characterName },
				{ icon: 'fa-fingerprint', label: 'File ID:', value: characterId },
				{ icon: 'fa-clock', label: 'Date Created:', value: createdDate },
				{ icon: 'fa-pen', label: 'Last Modified:', value: modifiedDate },
			];

			fields.forEach((field, index) => {
				const icon = document.createElement('i');
				icon.className = `fas ${field.icon} character-exists-icon`;
				messageElement.appendChild(icon);

				const nbsp = document.createTextNode('\u00A0\u00A0');
				messageElement.appendChild(nbsp);

				const strong = document.createElement('strong');
				strong.className = 'character-exists-label';
				strong.textContent = field.label;
				messageElement.appendChild(strong);

				const valueText = document.createTextNode(` ${field.value}`);
				messageElement.appendChild(valueText);

				if (index < fields.length - 1) {
					messageElement.appendChild(document.createElement('br'));
				}
			});
			confirmButton.textContent = 'Overwrite';
			confirmButton.className = 'btn btn-danger';

			const keepBothButton = document.createElement('button');
			keepBothButton.type = 'button';
			keepBothButton.className = 'btn btn-secondary';
			keepBothButton.textContent = 'Keep Both';

			cancelButton.classList.add('u-hidden');

			const buttonContainer = cancelButton.parentElement;
			buttonContainer.insertBefore(keepBothButton, cancelButton);

			return this._showPromiseModal({
				modalElement,
				buttons: [
					{ element: confirmButton, value: 'overwrite' },
					{ element: keepBothButton, value: 'keepBoth' },
					{ element: closeButton, value: 'cancel' },
				],
				defaultValue: 'cancel',
				onCleanup: () => {
					keepBothButton.remove();
					cancelButton.classList.remove('u-hidden');
				},
			});
		} catch (error) {
			console.error('[Modal]', 'Error showing duplicate ID modal:', error);
			return 'cancel';
		}
	}

	_getModalElements() {
		const modalElement = document.getElementById('confirmationModal');
		const titleElement = document.getElementById('confirmationModalLabel');
		const messageElement = document.getElementById('confirmationMessage');
		const confirmButton = document.getElementById('confirmButton');
		const cancelButton = modalElement?.querySelector('.btn-secondary');
		const closeButton = modalElement?.querySelector('.btn-close');

		if (!modalElement || !titleElement || !messageElement || !confirmButton || !cancelButton || !closeButton) {
			console.error('[Modal]', 'One or more modal elements not found');
			return null;
		}

		return { modalElement, titleElement, messageElement, confirmButton, cancelButton, closeButton };
	}

	_showPromiseModal({ modalElement, buttons, defaultValue, onCleanup }) {
		const bsModal = initializeBootstrapModal(modalElement);
		if (!bsModal) {
			console.error('[Modal]', 'Failed to initialize Bootstrap modal');
			return Promise.resolve(defaultValue);
		}

		const modalCleanup = DOMCleanup.create();

		return new Promise((resolve) => {
			let resolved = false;
			let resolveValue = defaultValue;

			for (const { element, value } of buttons) {
				modalCleanup.on(element, 'click', () => {
					resolveValue = value;
					bsModal.hide();
				});
			}

			modalCleanup.on(modalElement, 'hidden.bs.modal', () => {
				modalCleanup.cleanup();
				onCleanup?.();
				try {
					bsModal.dispose();
				} catch (e) {
					console.warn('[Modal]', 'Error disposing modal', e);
				}
				if (!resolved) {
					resolved = true;
					resolve(resolveValue);
				}
			});

			bsModal.show();
		});
	}

}

export const modal = new Modal();
