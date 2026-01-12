/**
 * Modal utility for user interactions and character creation flows.
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

import { eventBus, EVENTS } from '../lib/EventBus.js';

import { showNotification } from '../lib/Notifications.js';
import { SourceCard } from '../ui/components/sources/Card.js';

let _instance = null;

export class Modal {
	constructor() {
		if (_instance) {
			throw new Error('Modal is a singleton. Use Modal.getInstance() instead.');
		}

		this._sourceCard = new SourceCard();
		this._eventHandlers = {
			onShowModal: null,
			onCreateCharacter: null,
		};
		this._buttonListenersSetup = false;

		_instance = this;
	}

	//-------------------------------------------------------------------------
	// Event Handling
	//-------------------------------------------------------------------------

	setupEventListeners(handlers = {}) {
		try {
			// Store event handlers
			this._eventHandlers = handlers;

			// Button listener setup is now deferred to ensureInitialized()
			// This is needed because Modal is instantiated before DOM is ready
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

		// Set up create character button in modal
		this._setupButtonEventListener('createCharacterBtn', () =>
			this._createCharacterFromModal(),
		);
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

	//-------------------------------------------------------------------------
	// Character Creation Modal
	//-------------------------------------------------------------------------

	async showNewCharacterModal(e) {
		try {
			if (e) e.preventDefault();

			const modal = document.getElementById('newCharacterModal');
			if (!modal) {
				console.error('Modal', 'New character modal not found in the DOM');
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

			// Initialize wizard controls
			this._initWizard();

			// Initialize portrait selector
			this._initPortraitSelector();
		} catch (error) {
			console.error('Modal', 'Error showing new character modal:', error);
			showNotification('Could not open new character form', 'error');
		}
	}

	_initWizard() {
		try {
			const sections = Array.from(
				document.querySelectorAll('#newCharacterForm .form-section'),
			);
			const stepperItems = Array.from(
				document.querySelectorAll('#newCharacterStepper .list-group-item'),
			);
			const backBtn = document.getElementById('wizardBackBtn');
			const nextBtn = document.getElementById('wizardNextBtn');

			this._wizard = {
				sections,
				stepperItems,
				backBtn,
				nextBtn,
				current: 0,
				last: sections.length - 1,
			};

			// Reset hidden state and show first step
			for (const s of sections) {
				s.hidden = s.getAttribute('data-step') !== '0';
			}
			this._updateStepper();
			this._updateWizardButtons();
			// Progress bar removed

			// Remove existing listeners by cloning (consistent with project pattern)
			if (backBtn?.parentNode) {
				const newBack = backBtn.cloneNode(true);
				backBtn.parentNode.replaceChild(newBack, backBtn);
				newBack.addEventListener('click', () => this._goStep(-1));
				this._wizard.backBtn = newBack;
			}

			if (nextBtn?.parentNode) {
				const newNext = nextBtn.cloneNode(true);
				nextBtn.parentNode.replaceChild(newNext, nextBtn);
				newNext.addEventListener('click', () => this._goStep(1));
				this._wizard.nextBtn = newNext;
			}

			// Keyboard shortcuts (Left/Right)
			this._wizardKeyHandler = (ev) => {
				const modalEl = document.getElementById('newCharacterModal');
				if (!modalEl || !modalEl.classList.contains('show')) return;
				if (ev.key === 'ArrowLeft') {
					this._goStep(-1);
				} else if (ev.key === 'ArrowRight') {
					this._goStep(1);
				}
			};
			document.addEventListener('keydown', this._wizardKeyHandler);

			// Clean up on hide
			const modalEl = document.getElementById('newCharacterModal');
			if (modalEl) {
				modalEl.addEventListener('hidden.bs.modal', () => {
					document.removeEventListener('keydown', this._wizardKeyHandler);
				});
			}

			// Sync gender segmented control to hidden input

		} catch (error) {
			console.error('Modal', 'Error initializing wizard', error);
		}
	}

	_goStep(delta) {
		try {
			if (!this._wizard) return;
			const next = this._wizard.current + delta;
			if (next < 0 || next > this._wizard.last) return;

			// Validate when moving forward
			if (delta > 0 && !this._validateCurrentStep()) {
				return;
			}

			this._wizard.current = next;
			for (const s of this._wizard.sections) {
				const isCurrent = Number(s.getAttribute('data-step')) === next;
				s.hidden = !isCurrent;
			}
			this._updateStepper();
			this._updateWizardButtons();
			// Progress bar removed

			// Populate review step
			if (this._wizard.current === this._wizard.last) {
				this._populateReview();
			}
		} catch (error) {
			console.error('Modal', 'Error changing wizard step', error);
		}
	}

	_updateStepper() {
		try {
			if (!this._wizard) return;
			for (const item of this._wizard.stepperItems) {
				const step = Number(item.getAttribute('data-step'));
				item.classList.toggle('active', step === this._wizard.current);
			}
		} catch (error) {
			console.error('Modal', 'Error updating stepper', error);
		}
	}

	_updateWizardButtons() {
		try {
			if (!this._wizard) return;
			const { backBtn, nextBtn, current, last } = this._wizard;
			if (backBtn) backBtn.disabled = current === 0;
			if (nextBtn) {
				// Rebind handler by cloning to avoid duplicate listeners
				const newNext = nextBtn.cloneNode(true);
				nextBtn.parentNode.replaceChild(newNext, nextBtn);
				this._wizard.nextBtn = newNext;
				if (current === last) {
					newNext.textContent = 'Create';
					newNext.classList.remove('btn-primary');
					newNext.classList.add('btn-success');
					newNext.addEventListener('click', () => this._createCharacterFromModal());
				} else {
					newNext.textContent = 'Next';
					newNext.classList.remove('btn-success');
					newNext.classList.add('btn-primary');
					newNext.addEventListener('click', () => this._goStep(1));
				}
			}
		} catch (error) {
			console.error('Modal', 'Error updating wizard buttons', error);
		}
	}

	// Progress bar removed

	_validateCurrentStep() {
		try {
			if (!this._wizard) return false;
			const step = this._wizard.current;
			const form = document.getElementById('newCharacterForm');
			if (!form) return false;

			if (step === 0) {
				// Basic validation: standard HTML5 validity covers required fields
				if (!form.checkValidity()) {
					form.reportValidity();
					return false;
				}
				return true;
			}

			if (step === 2) {
				// Validate source selection via SourceCard
				const selectedSources = this._getSelectedSources();
				return this._sourceCard.validateSourceSelection(selectedSources);
			}

			return true;
		} catch (error) {
			console.error('Modal', 'Error validating current step', error);
			return false;
		}
	}

	_populateReview() {
		try {
			const list = document.getElementById('newCharacterReviewList');
			if (!list) return;
			const data = this._getFormData();
			const sources = Array.from(this._getSelectedSources());
			const sourceBadges = sources
				.map((s) => `<span class="badge source-badge">${s}</span>`)
				.join(' ');

			// Get portrait for preview
			const portraitSrc = this._selectedPortrait?.value || 'assets/images/characters/placeholder_char_card.webp';

			list.innerHTML = `
				<div class="review-portrait-preview">
					<img src="${portraitSrc}" alt="Character portrait" />
					<span class="portrait-label">Selected Portrait</span>
				</div>
				<li><strong>Name:</strong> ${data?.name || ''}</li>
				<li><strong>Level:</strong> ${data?.level || ''}</li>
				<li><strong>Gender:</strong> ${data?.gender || ''}</li>
				<li><strong>Ability Scores:</strong> ${data?.abilityScoreMethod || ''}</li>
				<li><strong>Feats:</strong> ${data?.feats ? 'Enabled' : 'Disabled'}</li>
				<li><strong>Multiclassing:</strong> ${data?.multiclassing ? 'Enabled' : 'Disabled'}</li>
				<li><strong>Sources:</strong> ${sourceBadges || '<span class="text-muted">None</span>'}</li>
			`;
			const hint = document.getElementById('reviewValidationHint');
			if (hint) {
				const isValid = this._sourceCard.validateSourceSelection(new Set(sources));
				hint.textContent = isValid
					? 'Sources valid'
					: 'Select at least one Player\'s Handbook (2014 or 2024).';
				hint.className = isValid ? 'text-success' : 'text-danger';
			}
		} catch (error) {
			console.error('Modal', 'Error populating review', error);
		}
	}

	// Portrait image selection setup (default images + upload)
	_initPortraitSelector() {
		try {
			const grid = document.getElementById('portraitImageGrid');
			const previewImg = document.getElementById('portraitPreviewImg');
			const uploadInput = document.getElementById('portraitUploadInput');
			if (!grid || !previewImg) return;

			// Default images available under assets/images/characters
			const defaults = [
				'assets/images/characters/placeholder_char_card1.webp',
				'assets/images/characters/placeholder_char_card2.webp',
				'assets/images/characters/placeholder_char_card3.webp',
				'assets/images/characters/placeholder_char_card4.webp',
				'assets/images/characters/placeholder_char_card5.webp',
				'assets/images/characters/placeholder_char_card6.webp',
				'assets/images/characters/placeholder_char_card7.webp',
				'assets/images/characters/placeholder_char_card8.webp',
				'assets/images/characters/placeholder_char_card9.webp',
				'assets/images/characters/placeholder_char_card10.webp',
				'assets/images/characters/placeholder_char_card11.webp',
			];

			// Clear and populate grid buttons
			grid.innerHTML = '';
			let firstBtn = null;
			for (const src of defaults) {
				const btn = document.createElement('button');
				btn.type = 'button';
				btn.className = 'portrait-icon-btn';
				btn.innerHTML = `<img src="${src}" alt="Portrait option" />`;
				btn.setAttribute('data-src', src);
				btn.addEventListener('click', () => {
					this._selectedPortrait = { type: 'asset', value: src };
					previewImg.src = src;
					const all = grid.querySelectorAll('.portrait-icon-btn');
					for (const el of all) el.classList.remove('selected');
					btn.classList.add('selected');
				});
				grid.appendChild(btn);
				if (!firstBtn) firstBtn = btn;
			}

			// Auto-select first portrait by default
			if (firstBtn) {
				firstBtn.click();
			}

			// Load additional portraits from app data path (portraits subfolder)
			(async () => {
				try {
					// Get the base app data path from character storage
					const characterPath = await window.characterStorage?.getDefaultSavePath();
					if (characterPath && typeof characterPath === 'string') {
						// Derive portraits path: sibling to characters folder
						const sep = characterPath.includes('\\') ? '\\' : '/';
						const idx = characterPath.lastIndexOf(sep);
						const basePath = idx > 0 ? characterPath.slice(0, idx) : characterPath;
						const portraitsPath = `${basePath}${sep}portraits`;

						const result = await window.app?.listPortraits?.(portraitsPath);
						if (result?.success && Array.isArray(result.files)) {
							for (const filePath of result.files) {
								const fileSrc = filePath.startsWith('file://')
									? filePath
									: `file://${filePath.replace(/\\/g, '/')}`;
								const btn = document.createElement('button');
								btn.type = 'button';
								btn.className = 'portrait-icon-btn';
								btn.innerHTML = `<img src="${fileSrc}" alt="Portrait option" />`;
								btn.setAttribute('data-src', fileSrc);
								btn.addEventListener('click', () => {
									this._selectedPortrait = { type: 'file', value: fileSrc };
									previewImg.src = fileSrc;
									const all = grid.querySelectorAll('.portrait-icon-btn');
									for (const el of all) el.classList.remove('selected');
									btn.classList.add('selected');
								});

								grid.appendChild(btn);
							}
						}
					}
				} catch (e) {
					console.warn('Modal', 'Failed loading user portraits', e);
				}
			})();

			// Append upload icon tile at the end of the grid
			const uploadTile = document.createElement('button');
			uploadTile.type = 'button';
			uploadTile.className = 'portrait-icon-btn upload';
			uploadTile.setAttribute('aria-label', 'Upload portrait');
			uploadTile.innerHTML = '<i class="fas fa-upload" aria-hidden="true"></i>';
			uploadTile.addEventListener('click', () => {
				if (uploadInput) {
					uploadInput.click();
				}
			});
			grid.appendChild(uploadTile);

			// Handle uploads as data URLs for CSP compatibility
			if (uploadInput) {
				uploadInput.addEventListener('change', (ev) => {
					const file = ev.target.files?.[0];
					if (!file) return;
					const reader = new FileReader();
					reader.onload = () => {
						const dataUrl = reader.result;
						if (typeof dataUrl === 'string') {
							this._selectedPortrait = { type: 'data', value: dataUrl };
							previewImg.src = dataUrl;
							// Clear selection highlight
							const all = grid.querySelectorAll('.portrait-icon-btn');
							for (const el of all) el.classList.remove('selected');
							// No selection class for upload tile; it acts as trigger
						}
					};
					reader.readAsDataURL(file);
				});
			}
		} catch (error) {
			console.error('Modal', 'Error initializing portrait selector', error);
		}
	}

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

				// Emit closed event for listeners
				eventBus.emit(EVENTS.NEW_CHARACTER_MODAL_CLOSED);
			}

			// Clear form
			const form = document.getElementById('newCharacterForm');
			if (form) {
				form.reset();
			}
		} catch (error) {
			console.error('Modal', 'Error closing new character modal:', error);
		}
	}

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
				console.error('Modal', 'One or more form fields not found');
				showNotification('Missing fields in character creation form', 'error');
				return null;
			}

			return {
				name: nameInput.value.trim(),
				level: Number.parseInt(levelInput.value, 10),
				gender: genderInput.value,
				portrait: this._selectedPortrait?.value || 'assets/images/characters/placeholder_char_card.webp',
				feats: featVariant.checked,
				multiclassing: multiclassVariant.checked,
				abilityScoreMethod: abilityScoreMethod.value,
			};
		} catch (error) {
			console.error('Modal', 'Error getting form data:', error);
			return null;
		}
	}

	_getSelectedSources() {
		try {
			const selectedSources = new Set();
			if (!this._sourceCard.container) {
				console.error('Modal', 'Source card container not found');
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
			console.error('Modal', 'Error getting selected sources:', error);
			return new Set();
		}
	}

	async _createCharacterFromModal() {
		try {
			// Get form data
			const formData = this._getFormData();
			if (!formData) return;

			// Get selected sources
			const selectedSources = this._getSelectedSources();
			if (!this._sourceCard.validateSourceSelection(selectedSources)) {
				console.warn('Modal', 'Source selection validation failed');
				return;
			}

			// Import CharacterManager
			const { CharacterManager } = await import('./CharacterManager.js');

			// Create character using CharacterManager
			const character = await CharacterManager.createCharacter(formData.name);

			// Update character with form data
			character.level = formData.level;
			character.gender = formData.gender;
			character.allowedSources = Array.from(selectedSources);
			character.variantRules = {
				feats: formData.feats,
				multiclassing: formData.multiclassing,
				abilityScoreMethod: formData.abilityScoreMethod,
			};
			character.portrait = formData.portrait;

			// Update SourceService with the selected sources so dropdowns populate correctly
			const { sourceService } = await import('../services/SourceService.js');
			sourceService.allowedSources = new Set(selectedSources);

			// Emit the event to trigger dropdown repopulation
			eventBus.emit(
				'sources:allowed-changed',
				Array.from(sourceService.allowedSources),
			);

			// Save character
			await CharacterManager.saveCharacter();

			// Close modal and reset form
			this._closeNewCharacterModal();

			// Call the onCreateCharacter callback if provided
			if (this._eventHandlers.onCreateCharacter) {
				await this._eventHandlers.onCreateCharacter(character);
			}

			// Reload the character list if needed
			await this._reloadCharacterList();

			showNotification('New character created successfully', 'success');
		} catch (error) {
			console.error('Modal', 'Error creating new character:', error);
			showNotification('Error creating new character', 'error');
		}
	}

	async _reloadCharacterList() {
		try {
			const characterList = document.getElementById('characterList');
			if (characterList) {
				const { CharacterManager } = await import('./CharacterManager.js');
				await CharacterManager.loadCharacterList();
			}
		} catch (error) {
			console.error('Modal', 'Error reloading character list:', error);
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
				console.error(
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
				console.error(
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
			console.error('Modal', 'Error showing confirmation dialog:', error);
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
				console.error(
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
				console.error('Modal', 'One or more modal elements not found');
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
                <i class="fas fa-user character-exists-icon"></i>&nbsp;&nbsp;<strong class="character-exists-label">Character Name:</strong> ${characterName}<br>
                <i class="fas fa-fingerprint character-exists-icon"></i>&nbsp;&nbsp;<strong class="character-exists-label">File ID:</strong> ${characterId}<br>
                <i class="fas fa-clock character-exists-icon"></i>&nbsp;&nbsp;<strong class="character-exists-label">Date Created:</strong> ${createdDate}<br>
                <i class="fas fa-pen character-exists-icon"></i>&nbsp;&nbsp;<strong class="character-exists-label">Last Modified:</strong> ${modifiedDate}
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
