// Modal for ability score improvement selection (+2 to one or +1 to two abilities)

import { ABILITY_ABBREVIATIONS, attAbvToFull } from '../../../lib/5eToolsParser.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { disposeBootstrapModal, hideBootstrapModal, initializeBootstrapModal } from '../../../lib/ModalCleanupUtility.js';

export class ASIModal {
	constructor(level, currentASI = {}) {
		this.level = level;
		this.currentASI = currentASI; // { str: 1, dex: 1 } or { str: 2 }
		this.modalEl = null;
		this.bootstrapModal = null;
		this._cleanup = DOMCleanup.create();
		this._resolve = null;
		this._result = null;
		this._asiMode = 'plus2'; // 'plus2' or 'plus1'
		this._selectedAbilities = { ability1: '', ability2: '' };
	}

	async show() {
		return new Promise((resolve) => {
			this._resolve = resolve;
			this._render();
			this.bootstrapModal.show();
		});
	}

	_render() {
		// Get or create modal element
		this.modalEl = document.getElementById('asiModal');
		if (!this.modalEl) {
			this._createModalElement();
		}

		// Initialize Bootstrap modal
		this._initializeBootstrapModal();

		// Render content
		this._renderContent();

		// Attach listeners
		this._attachListeners();
	}

	_createModalElement() {
		const modalHTML = `
			<div class="modal fade" id="asiModal" tabindex="-1" aria-labelledby="asiModalLabel" aria-hidden="true">
				<div class="modal-dialog modal-dialog-centered">
					<div class="modal-content" style="background-color: var(--surface-color); border-color: var(--border-color);">
						<div class="modal-header" style="border-bottom-color: var(--border-color);">
							<h5 class="modal-title" id="asiModalLabel">Ability Score Improvement</h5>
							<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
						</div>
						<div class="modal-body" id="asiModalBody">
							<!-- Content will be rendered here -->
						</div>
						<div class="modal-footer" style="border-top-color: var(--border-color);">
							<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
							<button type="button" class="btn btn-primary" id="asiApplyButton">Apply</button>
						</div>
					</div>
				</div>
			</div>
		`;

		document.body.insertAdjacentHTML('beforeend', modalHTML);
		this.modalEl = document.getElementById('asiModal');
	}

	_initializeBootstrapModal() {
		// Dispose old instance if exists
		disposeBootstrapModal(this.bootstrapModal);
		this.bootstrapModal = null;

		// Create new instance using centralized utility
		this.bootstrapModal = initializeBootstrapModal(this.modalEl, {
			backdrop: 'static',
			keyboard: false,
		});

		// Listen for modal hidden event
		this._cleanup.on(this.modalEl, 'hidden.bs.modal', () => {
			this._onModalHidden();
		});
	}

	_renderContent() {
		const body = document.getElementById('asiModalBody');
		if (!body) return;

		// Determine mode from currentASI
		if (this.currentASI && Object.keys(this.currentASI).length > 0) {
			const abilities = Object.entries(this.currentASI);
			if (abilities.length === 1) {
				const [ability, bonus] = abilities[0];
				this._asiMode = bonus === 2 ? 'plus2' : 'plus1';
				this._selectedAbilities.ability1 = ability;
			} else if (abilities.length > 1) {
				this._asiMode = 'plus1';
				this._selectedAbilities.ability1 = abilities[0][0];
				this._selectedAbilities.ability2 = abilities[1][0];
			}
		}

		body.innerHTML = `
			<p class="mb-3 text-center">Choose how to improve your ability scores</p>
			
			<!-- ASI Mode Toggle -->
			<div class="d-flex justify-content-center mb-4">
				<div class="btn-group asi-mode-toggle" role="group">
					<input
						type="radio"
						class="btn-check"
						name="asi_mode"
						id="asi_plus2"
						value="plus2"
						${this._asiMode === 'plus2' ? 'checked' : ''}
					>
					<label class="btn btn-outline-primary" for="asi_plus2">
						+2 to one ability
					</label>

					<input
						type="radio"
						class="btn-check"
						name="asi_mode"
						id="asi_plus1"
						value="plus1"
						${this._asiMode === 'plus1' ? 'checked' : ''}
					>
					<label class="btn btn-outline-primary" for="asi_plus1">
						+1 to two abilities
					</label>
				</div>
			</div>

			<!-- Ability Score Boxes -->
			<div class="row g-2 justify-content-center" id="asiAbilityBoxes">
				${this._renderAbilityBoxes()}
			</div>

			<!-- Selection Summary -->
			<div class="mt-3" id="asiSelectionSummary">
				${this._renderSelectionSummary()}
			</div>
		`;
	}

	_renderAbilityBoxes() {
		return ABILITY_ABBREVIATIONS.map((ability) => {
			const isSelected =
				this._selectedAbilities.ability1 === ability ||
				this._selectedAbilities.ability2 === ability;
			const bonus = this._getAbilityBonus(ability);

			return `
                <div class="col-4 col-md-4">
                    <button
                        type="button"
                        class="btn w-100 ability-select-btn ${isSelected ? 'active' : ''}"
                        data-ability="${ability}"
                    >
                        <strong>${attAbvToFull(ability)}</strong>
                        <div class="bonus-display">
                            ${bonus ? `+${bonus}` : '\u00A0'}
                        </div>
                    </button>
                </div>
            `;
		}).join('');
	}

	_getAbilityBonus(ability) {
		if (this._selectedAbilities.ability1 === ability) {
			return this._asiMode === 'plus2' ? 2 : 1;
		}
		if (
			this._selectedAbilities.ability2 === ability &&
			this._asiMode === 'plus1'
		) {
			return 1;
		}
		return 0;
	}

	_renderSelectionSummary() {
		const { ability1, ability2 } = this._selectedAbilities;

		if (this._asiMode === 'plus2' && ability1) {
			return `
                <div class="alert alert-success mb-0">
                    <i class="fas fa-check me-2"></i>
                    <strong>Selected:</strong> ${attAbvToFull(ability1)} +2
                </div>
            `;
		} else if (this._asiMode === 'plus1' && ability1 && ability2) {
			return `
                <div class="alert alert-success mb-0">
                    <i class="fas fa-check me-2"></i>
                    <strong>Selected:</strong> ${attAbvToFull(ability1)} +1, ${attAbvToFull(ability2)} +1
                </div>
            `;
		} else if (this._asiMode === 'plus1' && ability1 && !ability2) {
			return `
                <div class="alert alert-info mb-0">
                    <i class="fas fa-info-circle me-2"></i>
                    Select a second ability for +1
                </div>
            `;
		} else {
			return `
                <div class="alert alert-info mb-0">
                    <i class="fas fa-info-circle me-2"></i>
                    Select ${this._asiMode === 'plus2' ? 'an ability' : 'two abilities'} to improve
                </div>
            `;
		}
	}

	_attachListeners() {
		// ASI mode toggle - re-render entire content to update toggle styles
		const modeToggles = this.modalEl.querySelectorAll('[name="asi_mode"]');
		modeToggles.forEach((toggle) => {
			this._cleanup.on(toggle, 'change', (e) => {
				this._asiMode = e.target.value;

				// Clear selections when switching modes
				this._selectedAbilities = { ability1: '', ability2: '' };

				// Re-render entire content to update toggle button styles
				this._renderContent();
				this._attachListeners();
			});
		});

		// Ability box clicks
		const abilityButtons = this.modalEl.querySelectorAll('[data-ability]');
		abilityButtons.forEach((btn) => {
			this._cleanup.on(btn, 'click', () => {
				const ability = btn.dataset.ability;
				this._handleAbilityClick(ability);
				this._updateDisplay();
			});
		});

		// Apply button
		const applyButton = document.getElementById('asiApplyButton');
		if (applyButton) {
			this._cleanup.on(applyButton, 'click', () => {
				this._handleApply();
			});
		}
	}

	_handleAbilityClick(ability) {
		const { ability1, ability2 } = this._selectedAbilities;

		if (this._asiMode === 'plus2') {
			// Simple toggle for +2 mode
			this._selectedAbilities.ability1 = ability1 === ability ? '' : ability;
			this._selectedAbilities.ability2 = '';
		} else {
			// +1/+1 mode - allow two different abilities
			if (ability1 === ability) {
				// Deselect first, move second to first if exists
				this._selectedAbilities.ability1 = ability2;
				this._selectedAbilities.ability2 = '';
			} else if (ability2 === ability) {
				// Deselect second
				this._selectedAbilities.ability2 = '';
			} else if (!ability1) {
				// First selection
				this._selectedAbilities.ability1 = ability;
			} else if (!ability2) {
				// Second selection (ensure different from first)
				if (ability !== ability1) {
					this._selectedAbilities.ability2 = ability;
				}
			} else {
				// Both slots filled, replace second with new selection
				this._selectedAbilities.ability2 = ability;
			}
		}
	}

	_updateDisplay() {
		// Update ability boxes
		const boxesContainer = document.getElementById('asiAbilityBoxes');
		if (boxesContainer) {
			boxesContainer.innerHTML = this._renderAbilityBoxes();

			// Re-attach click listeners for new boxes
			const abilityButtons = boxesContainer.querySelectorAll('[data-ability]');
			abilityButtons.forEach((btn) => {
				this._cleanup.on(btn, 'click', () => {
					const ability = btn.dataset.ability;
					this._handleAbilityClick(ability);
					this._updateDisplay();
				});
			});
		}

		// Update summary
		const summaryContainer = document.getElementById('asiSelectionSummary');
		if (summaryContainer) {
			summaryContainer.innerHTML = this._renderSelectionSummary();
		}
	}

	_handleApply() {
		const { ability1, ability2 } = this._selectedAbilities;

		// Validate selection
		if (this._asiMode === 'plus2' && !ability1) {
			alert('Please select an ability to improve by +2.');
			return;
		}

		if (this._asiMode === 'plus1') {
			if (!ability1 || !ability2) {
				alert('Please select two abilities to improve by +1 each.');
				return;
			}
			if (ability1 === ability2) {
				alert('Please select two different abilities.');
				return;
			}
		}

		// Build result
		const changedAbilities = {};
		if (this._asiMode === 'plus2') {
			changedAbilities[ability1] = 2;
		} else {
			changedAbilities[ability1] = 1;
			changedAbilities[ability2] = 1;
		}

		this._result = changedAbilities;

		// Close modal
		this.bootstrapModal.hide();
	}

	_onModalHidden() {
		this._cleanup.cleanup();
		disposeBootstrapModal(this.bootstrapModal);
		this.bootstrapModal = null;

		// Resolve promise with result
		if (this._resolve) {
			this._resolve(this._result);
			this._resolve = null;
		}
	}

	async hide() {
		if (!this.bootstrapModal) return;

		// Use centralized hide utility
		await hideBootstrapModal(this.bootstrapModal, this.modalEl);

		// Clean up component references
		this._cleanup.cleanup();
		this.bootstrapModal = null;
	}
}
