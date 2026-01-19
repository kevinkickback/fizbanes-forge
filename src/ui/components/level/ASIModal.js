/**
 * ASIModal - Ability Score Improvement Selection
 * 
 * Provides interface to choose ability score improvements:
 * - Increase one ability by 2, or
 * - Increase two abilities by 1 each
 */

import { DOMCleanup } from '../../../lib/DOMCleanup.js';

export class ASIModal {
    constructor(level, currentASI = {}) {
        this.level = level;
        this.currentASI = currentASI; // { str: 1, dex: 1 } or { str: 2 }
        this.modalEl = null;
        this.bootstrapModal = null;
        this._cleanup = DOMCleanup.create();
        this._resolve = null;
        this._result = null;
    }

    /**
     * Show the modal and return a promise with the result
     */
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
        if (this.bootstrapModal) {
            try {
                if (typeof this.bootstrapModal.dispose === 'function') {
                    this.bootstrapModal.dispose();
                }
            } catch (e) {
                console.debug('[ASIModal] Error disposing old modal:', e);
            }
        }

        // Create new instance
        this.bootstrapModal = new bootstrap.Modal(this.modalEl, {
            backdrop: 'static',
            keyboard: false
        });

        // Listen for modal hidden event
        this._cleanup.on(this.modalEl, 'hidden.bs.modal', () => {
            this._onModalHidden();
        });
    }

    _renderContent() {
        const body = document.getElementById('asiModalBody');
        if (!body) return;

        body.innerHTML = `
			<p class="mb-3">Increase one ability score by 2, or two ability scores by 1 each.</p>
			
			<div class="row g-2 mb-2">
				<div class="col-6">
					<label class="form-label small">First Ability</label>
					<select class="form-select form-select-sm" id="asiAbility1">
						<option value="">Select...</option>
						<option value="str">Strength</option>
						<option value="dex">Dexterity</option>
						<option value="con">Constitution</option>
						<option value="int">Intelligence</option>
						<option value="wis">Wisdom</option>
						<option value="cha">Charisma</option>
					</select>
				</div>
				<div class="col-6">
					<label class="form-label small">Increase</label>
					<select class="form-select form-select-sm" id="asiBonus1">
						<option value="2">+2</option>
						<option value="1">+1</option>
					</select>
				</div>
			</div>
			<div class="row g-2" id="asiSecondAbility" style="display: none;">
				<div class="col-6">
					<label class="form-label small">Second Ability</label>
					<select class="form-select form-select-sm" id="asiAbility2">
						<option value="">Select...</option>
						<option value="str">Strength</option>
						<option value="dex">Dexterity</option>
						<option value="con">Constitution</option>
						<option value="int">Intelligence</option>
						<option value="wis">Wisdom</option>
						<option value="cha">Charisma</option>
					</select>
				</div>
				<div class="col-6">
					<label class="form-label small">Increase</label>
					<input type="text" class="form-control form-control-sm" value="+1" disabled>
				</div>
			</div>
		`;

        // Pre-fill ASI values if they exist
        if (this.currentASI && Object.keys(this.currentASI).length > 0) {
            const abilities = Object.entries(this.currentASI);
            if (abilities.length > 0) {
                const [ability1, bonus1] = abilities[0];
                document.getElementById('asiAbility1').value = ability1;
                document.getElementById('asiBonus1').value = bonus1.toString();

                if (abilities.length > 1) {
                    const [ability2] = abilities[1];
                    document.getElementById('asiAbility2').value = ability2;
                    document.getElementById('asiSecondAbility').style.display = 'block';
                }
            }
        }
    }

    _attachListeners() {
        // Bonus dropdown - show/hide second ability
        const bonus1Select = document.getElementById('asiBonus1');
        const secondAbilityRow = document.getElementById('asiSecondAbility');

        if (bonus1Select && secondAbilityRow) {
            this._cleanup.on(bonus1Select, 'change', () => {
                secondAbilityRow.style.display = bonus1Select.value === '1' ? 'block' : 'none';
            });
        }

        // Apply button
        const applyButton = document.getElementById('asiApplyButton');
        if (applyButton) {
            this._cleanup.on(applyButton, 'click', () => {
                this._handleApply();
            });
        }
    }

    _handleApply() {
        // Validate ASI selection
        const ability1 = document.getElementById('asiAbility1')?.value;
        const bonus1 = parseInt(document.getElementById('asiBonus1')?.value || '2', 10);

        if (!ability1) {
            alert('Please select an ability to improve.');
            return;
        }

        const changedAbilities = {};
        changedAbilities[ability1] = bonus1;

        // Check for second ability if +1/+1
        if (bonus1 === 1) {
            const ability2 = document.getElementById('asiAbility2')?.value;
            if (!ability2) {
                alert('Please select a second ability for the +1 bonus.');
                return;
            }
            if (ability2 === ability1) {
                alert('Please select two different abilities.');
                return;
            }
            changedAbilities[ability2] = 1;
        }

        this._result = changedAbilities;

        // Close modal
        this.bootstrapModal.hide();
    }

    _onModalHidden() {
        this._cleanup.cleanup();

        // Resolve promise with result
        if (this._resolve) {
            this._resolve(this._result);
            this._resolve = null;
        }
    }

    hide() {
        if (this.bootstrapModal) {
            this.bootstrapModal.hide();
        }
    }
}
