/**
 * LevelUpModal - Main wizard controller for character level-up flow
 * 
 * Orchestrates a 5-step wizard:
 * 0. Level & Multiclass - Select which classes to level
 * 1. Class Features - Review and select class features
 * 2. ASI/Feat Selection - Choose ability improvements or feats
 * 3. Spell Selection - Select new spells for spellcasting classes
 * 4. Summary - Review all changes before applying
 * 
 * All changes are staged in a LevelUpSession and only applied on confirmation.
 */

import { AppState } from '../../../app/AppState.js';
import { LevelUpSession } from '../../../app/LevelUpSession.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';

export class LevelUpModal {
    constructor() {
        this.modalEl = null;
        this.bootstrapModal = null;
        this.session = null;
        this._cleanup = DOMCleanup.create();

        // Step components (lazy loaded)
        this._stepComponents = {};

        console.debug('[LevelUpModal]', 'Constructor initialized');
    }

    /**
     * Show the modal and initialize the wizard.
     * Creates a new LevelUpSession and starts at step 0.
     */
    async show() {
        try {
            const character = AppState.getCurrentCharacter();
            if (!character) {
                showNotification('No character selected', 'error');
                return;
            }

            if (!character.progression?.classes || character.progression.classes.length === 0) {
                showNotification('Character must have at least one class', 'error');
                return;
            }

            console.info('[LevelUpModal]', 'Opening for character', character.name);

            // Get modal element
            this.modalEl = document.getElementById('levelUpModal');
            if (!this.modalEl) {
                console.error('[LevelUpModal]', 'Modal element #levelUpModal not found in DOM');
                showNotification('Could not open level up modal', 'error');
                return;
            }

            // Create new session
            this.session = new LevelUpSession(character);

            // Fresh cleanup instance
            this._cleanup = DOMCleanup.create();

            // Initialize Bootstrap modal
            this._initializeBootstrapModal();

            // Render step 0
            await this._renderStep(0);

            // Show modal
            this.bootstrapModal.show();

        } catch (error) {
            console.error('[LevelUpModal]', 'Failed to show modal', error);
            showNotification('Failed to open level up modal', 'error');
        }
    }

    /**
     * Hide the modal without applying changes.
     * Shows confirmation if user has made changes.
     */
    async hide() {
        if (!this.session) return;

        const summary = this.session.getChangeSummary();
        const hasChanges = summary.totalLevelChange !== 0 ||
            summary.leveledClasses.length > 0 ||
            Object.keys(summary.changedAbilities).length > 0;

        if (hasChanges) {
            const confirmed = await this._showConfirmation(
                'Unsaved Changes',
                'You have unsaved changes. Are you sure you want to exit?'
            );
            if (!confirmed) return;
        }

        this.session.discard();
        if (this.bootstrapModal) {
            this.bootstrapModal.hide();
        }
    }

    /**
     * Move to the next step.
     */
    async nextStep() {
        if (!this.session) return;

        const currentStep = this.session.currentStep;

        // Validate current step
        if (!this.session.canGoToStep(currentStep + 1)) {
            showNotification('Please complete this step before proceeding', 'warning');
            return;
        }

        this.session.nextStep();
        await this._renderStep(this.session.currentStep);
    }

    /**
     * Move to the previous step.
     */
    async previousStep() {
        if (!this.session) return;

        if (!this.session.previousStep()) {
            console.warn('[LevelUpModal]', 'Cannot go back from step 0');
            return;
        }

        await this._renderStep(this.session.currentStep);
    }

    /**
     * Jump to a specific step (for stepper navigation).
     */
    async jumpToStep(stepNumber) {
        if (!this.session) return;

        if (!this.session.jumpToStep(stepNumber)) {
            showNotification('Cannot jump to that step', 'warning');
            return;
        }

        await this._renderStep(stepNumber);
    }

    /**
     * Confirm and apply all staged changes to the character.
     */
    async confirm() {
        if (!this.session) return;

        try {
            console.info('[LevelUpModal]', 'Confirming changes...');

            // Apply staged changes to character
            const updatedCharacter = await this.session.applyChanges();

            // Emit event for other UI components to update
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { character: updatedCharacter });

            // Optional: Emit level-up specific event
            eventBus.emit('LEVEL_UP_COMPLETE', {
                character: updatedCharacter,
                changes: this.session.getChangeSummary(),
            });

            // Close modal
            if (this.bootstrapModal) {
                this.bootstrapModal.hide();
            }

            // Show success notification
            showNotification('Character leveled up successfully!', 'success');

            console.info('[LevelUpModal]', 'Changes applied and modal closed');

        } catch (error) {
            console.error('[LevelUpModal]', 'Failed to apply changes', error);
            showNotification(`Failed to apply changes: ${error.message}`, 'error');
        }
    }

    /**
     * Clean up modal and listeners when hidden.
     */
    _onModalHidden() {
        console.debug('[LevelUpModal]', 'Modal hidden');
        this._cleanup.cleanup();
        this.session = null;
    }

    /**
     * Initialize Bootstrap modal instance.
     * @private
     */
    _initializeBootstrapModal() {
        // Dispose old instance if exists
        try {
            this.bootstrapModal?.dispose?.();
        } catch (e) {
            console.warn('[LevelUpModal]', 'Error disposing old modal', e);
        }

        // Create new instance
        const bs = window.bootstrap || globalThis.bootstrap;
        if (!bs) {
            throw new Error('Bootstrap not found on window');
        }

        this.bootstrapModal = new bs.Modal(this.modalEl, {
            backdrop: 'static', // Don't close on background click
            keyboard: false,    // Don't close on Escape
        });

        // Register cleanup
        this._cleanup.registerBootstrapModal(this.modalEl, this.bootstrapModal);

        // Setup hide listener
        this._cleanup.once(this.modalEl, 'hidden.bs.modal', () => this._onModalHidden());

        // Attach button listeners
        this._attachButtonListeners();
    }

    /**
     * Attach event listeners to modal buttons.
     * @private
     */
    _attachButtonListeners() {
        const backBtn = this.modalEl.querySelector('[data-action="back"]');
        const nextBtn = this.modalEl.querySelector('[data-action="next"]');
        const confirmBtn = this.modalEl.querySelector('[data-action="confirm"]');

        if (backBtn) {
            this._cleanup.on(backBtn, 'click', () => this.previousStep());
        }

        if (nextBtn) {
            this._cleanup.on(nextBtn, 'click', () => this.nextStep());
        }

        if (confirmBtn) {
            this._cleanup.on(confirmBtn, 'click', () => this.confirm());
        }

        console.debug('[LevelUpModal]', 'Button listeners attached');
    }

    /**
     * Render a specific step.
     * Lazy-loads the step component and renders it.
     * @private
     */
    async _renderStep(stepNumber) {
        try {
            const contentArea = this.modalEl.querySelector('.modal-body [data-step-content]');
            if (!contentArea) {
                console.warn('[LevelUpModal]', 'Step content area not found');
                return;
            }

            // Clear previous step content
            contentArea.innerHTML = '';

            console.debug('[LevelUpModal]', 'Rendering step', stepNumber);

            // Load and render appropriate step
            switch (stepNumber) {
                case 0:
                    await this._renderStep0LevelMulticlass(contentArea);
                    break;
                case 1:
                    await this._renderStep1ClassFeatures(contentArea);
                    break;
                case 2:
                    await this._renderStep2ASIFeat(contentArea);
                    break;
                case 3:
                    await this._renderStep3SpellSelection(contentArea);
                    break;
                case 4:
                    await this._renderStep4Summary(contentArea);
                    break;
            }

            // Update stepper
            this._updateStepper(stepNumber);

            // Update button states
            this._updateButtons(stepNumber);

        } catch (error) {
            console.error('[LevelUpModal]', 'Failed to render step', stepNumber, error);
            showNotification(`Failed to render step ${stepNumber}`, 'error');
        }
    }

    /**
     * Render Step 0: Level & Multiclass
     * @private
     */
    async _renderStep0LevelMulticlass(contentArea) {
        const { Step0LevelMulticlass } = await import('./steps/Step0LevelMulticlass.js');
        const step = new Step0LevelMulticlass(this.session, this);
        const html = await step.render();
        contentArea.innerHTML = html;
        step.attachListeners(contentArea);
    }

    /**
     * Render Step 1: Class Features
     * @private
     */
    async _renderStep1ClassFeatures(contentArea) {
        const { Step1ClassFeatures } = await import('./steps/Step1ClassFeatures.js');
        const step = new Step1ClassFeatures(this.session, this);
        const html = await step.render();
        contentArea.innerHTML = html;
        step.attachListeners(contentArea);
    }

    /**
     * Render Step 2: ASI/Feat
     * @private
     */
    async _renderStep2ASIFeat(contentArea) {
        const { Step2ASIFeat } = await import('./steps/Step2ASIFeat.js');
        const step = new Step2ASIFeat(this.session, this);
        const html = await step.render();
        contentArea.innerHTML = html;
        step.attachListeners(contentArea);
    }

    /**
     * Render Step 3: Spell Selection
     * @private
     */
    async _renderStep3SpellSelection(contentArea) {
        const { Step3SpellSelection } = await import('./steps/Step3SpellSelection.js');
        const step = new Step3SpellSelection(this.session, this);
        const html = await step.render();
        contentArea.innerHTML = html;
        step.attachListeners(contentArea);
    }

    /**
     * Render Step 4: Summary
     * @private
     */
    async _renderStep4Summary(contentArea) {
        const { Step4Summary } = await import('./steps/Step4Summary.js');
        const step = new Step4Summary(this.session, this);
        const html = await step.render();
        contentArea.innerHTML = html;
        step.attachListeners(contentArea);
    }

    /**
     * Update the stepper to highlight current step.
     * @private
     */
    _updateStepper(stepNumber) {
        const stepItems = this.modalEl.querySelectorAll('[data-step]');
        stepItems.forEach((item, index) => {
            if (index === stepNumber) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * Update button states based on current step.
     * @private
     */
    _updateButtons(stepNumber) {
        const backBtn = this.modalEl.querySelector('[data-action="back"]');
        const nextBtn = this.modalEl.querySelector('[data-action="next"]');
        const confirmBtn = this.modalEl.querySelector('[data-action="confirm"]');

        if (backBtn) {
            backBtn.disabled = stepNumber === 0;
        }

        if (nextBtn) {
            nextBtn.style.display = stepNumber < 4 ? 'block' : 'none';
        }

        if (confirmBtn) {
            confirmBtn.style.display = stepNumber === 4 ? 'block' : 'none';
        }
    }

    /**
     * Show a confirmation dialog.
     * @private
     */
    async _showConfirmation(title, message) {
        return new Promise((resolve) => {
            // TODO: Replace with actual modal or dialog
            const label = title ? `${title}: ${message}` : message;
            const confirmed = confirm(label);
            resolve(confirmed);
        });
    }
}
