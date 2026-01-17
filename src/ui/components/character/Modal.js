/**
 * CharacterCreationModal - Main wizard controller for character creation flow
 * 
 * Orchestrates a 5-step wizard:
 * 0. Basics - Name, gender, level, portrait
 * 1. Rules - Ability score method, variant rules, source selection
 * 2. Race - Select character race
 * 3. Class - Select character class
 * 4. Review - Review all settings and create character
 * 
 * All data is staged in a CharacterCreationSession and only applied on confirmation.
 */

import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { CharacterCreationSession } from './CharacterCreationSession.js';

export class CharacterCreationModal {
    constructor() {
        this.modalEl = null;
        this.bootstrapModal = null;
        this.session = null;
        this._cleanup = DOMCleanup.create();

        // Step components (lazy loaded)
        this._stepComponents = {};

        console.debug('[CharacterCreationModal]', 'Constructor initialized');
    }

    /**
     * Show the modal and initialize the wizard.
     * Creates a new CharacterCreationSession and starts at step 0.
     */
    async show() {
        try {
            console.info('[CharacterCreationModal]', 'Opening character creation wizard');

            // Get modal element
            this.modalEl = document.getElementById('newCharacterModal');
            if (!this.modalEl) {
                console.error('[CharacterCreationModal]', 'Modal element #newCharacterModal not found in DOM');
                showNotification('Could not open character creation form', 'error');
                return;
            }

            // Create new session
            this.session = new CharacterCreationSession();

            // Fresh cleanup instance
            this._cleanup = DOMCleanup.create();

            // Initialize Bootstrap modal
            this._initializeBootstrapModal();

            // Render step 0
            await this._renderStep(0);

            // Attach navigation button listeners after render
            this._attachNavigationListeners();

            // Show modal
            this.bootstrapModal.show();

        } catch (error) {
            console.error('[CharacterCreationModal]', 'Failed to show modal', error);
            showNotification('Failed to open character creation form', 'error');
        }
    }

    /**
     * Hide the modal without creating character.
     * Confirmation is handled automatically by the hide.bs.modal event.
     */
    async hide() {
        if (!this.bootstrapModal) return;
        this.bootstrapModal.hide();
    }

    /**
     * Move to the next step.
     */
    async nextStep() {
        if (!this.session) return;

        const currentStep = this.session.currentStep;

        // Validate current step before proceeding
        if (!await this._validateStep(currentStep)) {
            return;
        }

        // Save current step data
        await this._saveStepData(currentStep);

        // If on last step, create character
        if (currentStep === 3) {
            await this._createCharacter();
            return;
        }

        // Move to next step
        this.session.currentStep = currentStep + 1;
        await this._renderStep(this.session.currentStep);
    }

    /**
     * Move to the previous step.
     */
    async backStep() {
        if (!this.session) return;

        const currentStep = this.session.currentStep;
        if (currentStep === 0) return;

        // Save current step data
        await this._saveStepData(currentStep);

        // Move to previous step
        this.session.currentStep = currentStep - 1;
        await this._renderStep(this.session.currentStep);
    }

    /**
     * Initialize Bootstrap modal instance and event handlers.
     * @private
     */
    _initializeBootstrapModal() {
        // Dispose old modal instance if exists
        const existing = bootstrap.Modal.getInstance(this.modalEl);
        if (existing) {
            try {
                existing.dispose();
            } catch (e) {
                console.warn('[CharacterCreationModal]', 'Error disposing existing modal', e);
            }
        }

        // Create new Bootstrap modal instance
        this.bootstrapModal = new bootstrap.Modal(this.modalEl, {
            backdrop: 'static',
            keyboard: false,
        });

        // Handle modal hidden event
        this._cleanup.once(this.modalEl, 'hidden.bs.modal', () => {
            this._onModalHidden();
        });
    }

    /**
     * Attach navigation button listeners.
     * @private
     */
    _attachNavigationListeners() {
        const backBtn = this.modalEl.querySelector('#wizardBackBtn');
        const nextBtn = this.modalEl.querySelector('#wizardNextBtn');

        if (backBtn) {
            this._cleanup.on(backBtn, 'click', () => this.backStep());
        }

        if (nextBtn) {
            this._cleanup.on(nextBtn, 'click', () => this.nextStep());
        }

        // Handle keyboard shortcuts
        this._cleanup.on(document, 'keydown', (e) => {
            if (!this.modalEl || !this.modalEl.classList.contains('show')) return;

            if (e.key === 'ArrowLeft') {
                this.backStep();
            } else if (e.key === 'ArrowRight') {
                this.nextStep();
            }
        });
    }

    /**
     * Render a specific step.
     * @private
     */
    async _renderStep(stepIndex) {
        try {
            console.debug('[CharacterCreationModal]', 'Rendering step', stepIndex);

            // Get content area
            const contentArea = this.modalEl.querySelector('[data-step-content]');
            if (!contentArea) {
                console.error('[CharacterCreationModal]', 'Content area not found');
                return;
            }

            // Load step component if not already loaded
            if (!this._stepComponents[stepIndex]) {
                this._stepComponents[stepIndex] = await this._loadStepComponent(stepIndex);
            }

            const step = this._stepComponents[stepIndex];
            if (!step) {
                console.error('[CharacterCreationModal]', 'Step component not found for index', stepIndex);
                return;
            }

            // Render step HTML
            const html = await step.render();
            contentArea.innerHTML = html;

            // Attach event listeners
            if (step.attachListeners) {
                step.attachListeners(contentArea);
            }

            // Update stepper UI
            this._updateStepper();

            // Update navigation buttons
            this._updateNavigationButtons();

        } catch (error) {
            console.error('[CharacterCreationModal]', 'Failed to render step', stepIndex, error);
            showNotification('Failed to load step', 'error');
        }
    }

    /**
     * Load a step component dynamically.
     * @private
     */
    async _loadStepComponent(stepIndex) {
        try {
            let StepClass;

            switch (stepIndex) {
                case 0: {
                    const { Step0Basics } = await import('./steps/Step0Basics.js');
                    StepClass = Step0Basics;
                    break;
                }
                case 1: {
                    const { Step1Rules } = await import('./steps/Step1Rules.js');
                    StepClass = Step1Rules;
                    break;
                }
                case 2: {
                    const { Step2Race } = await import('./steps/Step2Race.js');
                    StepClass = Step2Race;
                    break;
                }
                case 3: {
                    const { Step3Class } = await import('./steps/Step3Class.js');
                    StepClass = Step3Class;
                    break;
                }
                case 4: {
                    const { Step4Review } = await import('./steps/Step4Review.js');
                    StepClass = Step4Review;
                    break;
                }
                default:
                    throw new Error(`Invalid step index: ${stepIndex}`);
            }

            return new StepClass(this.session, this);

        } catch (error) {
            console.error('[CharacterCreationModal]', 'Failed to load step component', stepIndex, error);
            return null;
        }
    }

    /**
     * Validate current step data.
     * @private
     */
    async _validateStep(stepIndex) {
        const step = this._stepComponents[stepIndex];
        if (!step) return true;

        // Use step's validate method if available
        if (step.validate) {
            return await step.validate();
        }

        // Fallback to session validation
        return this.session.validateCurrentStep();
    }

    /**
     * Save current step data to session.
     * @private
     */
    async _saveStepData(stepIndex) {
        const step = this._stepComponents[stepIndex];
        if (!step || !step.save) return;

        try {
            await step.save();
        } catch (error) {
            console.error('[CharacterCreationModal]', 'Failed to save step data', stepIndex, error);
        }
    }

    /**
     * Update the stepper UI to show current step.
     * @private
     */
    _updateStepper() {
        const stepperItems = this.modalEl.querySelectorAll('#newCharacterStepper .list-group-item');
        const currentStep = this.session?.currentStep || 0;

        stepperItems.forEach((item, index) => {
            if (index === currentStep) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /**
     * Update navigation button states and labels.
     * @private
     */
    _updateNavigationButtons() {
        const backBtn = this.modalEl.querySelector('#wizardBackBtn');
        const nextBtn = this.modalEl.querySelector('#wizardNextBtn');
        const currentStep = this.session?.currentStep || 0;

        if (backBtn) {
            backBtn.disabled = currentStep === 0;
        }

        if (nextBtn) {
            if (currentStep === 3) {
                // Final step - show Create button
                nextBtn.textContent = 'Create';
                nextBtn.classList.remove('btn-primary');
                nextBtn.classList.add('btn-success');
            } else {
                // Intermediate step - show Next button
                nextBtn.textContent = 'Next';
                nextBtn.classList.remove('btn-success');
                nextBtn.classList.add('btn-primary');
            }
        }
    }

    /**
     * Create the character from staged data.
     * @private
     */
    async _createCharacter() {
        try {
            const stagedData = this.session.getStagedData();

            // Import CharacterManager
            const { CharacterManager } = await import('../../../app/CharacterManager.js');

            // Create character
            const character = await CharacterManager.createCharacter(stagedData.name);

            // Apply staged data
            character.level = stagedData.level;
            character.gender = stagedData.gender;
            character.portrait = stagedData.portrait || 'assets/images/characters/placeholder_char_card.webp';
            character.allowedSources = stagedData.allowedSources;
            character.variantRules = stagedData.variantRules;

            // Apply race selection
            if (stagedData.race) {
                character.race = {
                    name: stagedData.race.name,
                    source: stagedData.race.source,
                    subrace: stagedData.race.subrace || ''
                };
            }

            // Apply class selection
            if (stagedData.class) {
                character.class = {
                    name: stagedData.class.name,
                    source: stagedData.class.source,
                    level: stagedData.level || 1
                };
                if (stagedData.class.subclass) {
                    character.subclass = stagedData.class.subclass;
                }
            }

            // Update SourceService
            const { sourceService } = await import('../../../services/SourceService.js');
            sourceService.allowedSources = new Set(stagedData.allowedSources);
            eventBus.emit('sources:allowed-changed', stagedData.allowedSources);

            // Save character
            await CharacterManager.saveCharacter();

            // Close modal
            this.bootstrapModal.hide();

            // Emit event
            eventBus.emit(EVENTS.CHARACTER_CREATED, character);

            showNotification('New character created successfully', 'success');

        } catch (error) {
            console.error('[CharacterCreationModal]', 'Failed to create character', error);
            showNotification('Error creating new character', 'error');
        }
    }

    /**
     * Handle modal hidden event - cleanup.
     * @private
     */
    _onModalHidden() {
        console.debug('[CharacterCreationModal]', 'Modal hidden, cleaning up');

        // Cleanup all step components
        for (const step of Object.values(this._stepComponents)) {
            if (step._cleanup) {
                step._cleanup.cleanup();
            }
        }
        this._stepComponents = {};

        // Cleanup modal
        this._cleanup.cleanup();

        // Reset session
        if (this.session) {
            this.session.reset();
            this.session = null;
        }

        // Dispose Bootstrap modal
        if (this.bootstrapModal) {
            try {
                this.bootstrapModal.dispose();
            } catch (e) {
                console.warn('[CharacterCreationModal]', 'Error disposing modal', e);
            }
            this.bootstrapModal = null;
        }

        eventBus.emit(EVENTS.NEW_CHARACTER_MODAL_CLOSED);
    }
}
