// Modal wizard for character level progression and multiclass management.

import { AppState } from '../../../app/AppState.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { levelUpService } from '../../../services/LevelUpService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';

export class LevelUpModal {
    constructor() {
        this.modalEl = null;
        this.bootstrapModal = null;
        this.character = null;
        this.selectedClassName = null; // Track which class is being leveled
        this.ignoreMulticlassReqs = false; // Toggle for multiclass requirements
        this.currentStep = 0; // Track current wizard step
        this.pendingFeatSelection = false; // Track if feat selection is pending
        this.pendingSpellSelection = false; // Track if spell selection is pending
        this.sessionStartFeatures = []; // Features at session start for comparison
        this.sessionStartLevel = 1; // Level at session start
        this.sessionStartSpells = {}; // Spells known at session start by class
        this._isTemporarilyHidden = false; // Track if hidden for modal coordination
        this.spellSelectionModal = null; // Reuse spell selection modal instance for preserving selections

        // DOM cleanup manager
        this._cleanup = DOMCleanup.create();
    }

    async show() {
        try {
            this.modalEl = document.getElementById('levelUpModal');
            if (!this.modalEl) {
                console.error('LevelUpModal', 'modal element not found');
                showNotification('Could not open Level Up modal', 'error');
                return;
            }

            this.character = AppState.getCurrentCharacter();
            if (!this.character) {
                showNotification('No character loaded', 'error');
                return;
            }

            // Create fresh cleanup instance for this modal session
            this._cleanup = DOMCleanup.create();

            // Initialize Bootstrap modal once, using global fallback
            const bs = window.bootstrap || globalThis.bootstrap;
            if (!bs) {
                console.error('LevelUpModal', 'Bootstrap not found on window');
                showNotification('UI components failed to load. Please reload.', 'error');
                return;
            }

            // Dispose old Bootstrap instance if it exists
            if (this.bootstrapModal) {
                try {
                    this.bootstrapModal.dispose();
                } catch (e) {
                    console.warn('LevelUpModal', 'Error disposing old modal instance', e);
                }
                this.bootstrapModal = null;
            }

            // Create new Bootstrap modal instance
            this.bootstrapModal = new bs.Modal(this.modalEl, {
                backdrop: true,
                keyboard: true,
            });

            // Register cleanup handler for when modal is hidden
            this._cleanup.registerBootstrapModal(this.modalEl, this.bootstrapModal);
            this._cleanup.once(this.modalEl, 'hidden.bs.modal', () => this._onModalHidden());

            // Ensure progression exists
            levelUpService.initializeProgression(this.character);

            // Set initial selected class to first/primary class
            if (this.character.progression?.classes?.length > 0) {
                this.selectedClassName = this.character.progression.classes[0].name;
            }

            // Reset pending flags when opening modal (fresh session)
            this.pendingFeatSelection = false;
            this.pendingSpellSelection = false;

            // Capture session start state for comparison
            this.sessionStartLevel = this.character.level;
            this.sessionStartFeatures = [];
            this.sessionStartSpells = {}; // Capture spells at session start

            for (const classEntry of this.character.progression?.classes || []) {
                for (const feature of classEntry.features || []) {
                    this.sessionStartFeatures.push({
                        name: feature.name,
                        level: feature.level,
                        className: classEntry.name
                    });
                }
            }

            // Capture spells known at session start
            const spellcasting = this.character.spellcasting?.classes || {};
            for (const [className, classData] of Object.entries(spellcasting)) {
                this.sessionStartSpells[className] = {
                    known: Array.from(classData.spellsKnown || []),
                    prepared: Array.from(classData.spellsPrepared || []),
                    cantrips: Array.from(classData.cantrips || [])
                };
            }

            // Attach tracked event listeners
            this._attachEventListeners();

            // Initialize wizard
            this._initWizard();

            // Load features for all existing classes and render content
            await this._loadAllClassFeatures();
            await this._renderAll();

            // Show the modal after rendering
            this.bootstrapModal.show();
        } catch (err) {
            console.error('LevelUpModal', 'show() failed', err);
            showNotification('Failed to prepare Level Up modal', 'error');
        }
    }

    cleanup() {
        // No-op for now; we reuse instance
    }

    _attachEventListeners() {
        // Increase/decrease level buttons
        const increaseBtn = this.modalEl.querySelector('#levelUpIncreaseBtn');
        if (increaseBtn) {
            this._cleanup.on(increaseBtn, 'click', () => this._handleIncreaseLevel());
        }

        const decreaseBtn = this.modalEl.querySelector('#levelUpDecreaseBtn');
        if (decreaseBtn) {
            this._cleanup.on(decreaseBtn, 'click', () => this._handleDecreaseLevel());
        }

        // Add class button
        const addClassBtn = this.modalEl.querySelector('#levelUpAddClassBtn');
        if (addClassBtn) {
            this._cleanup.on(addClassBtn, 'click', () => this._handleAddClass());
        }

        // Recalc HP button
        const recalcHPBtn = this.modalEl.querySelector('#levelUpRecalcHPBtn');
        if (recalcHPBtn) {
            this._cleanup.on(recalcHPBtn, 'click', () => this._handleRecalcHP());
        }

        // Select feat button
        const selectFeatBtn = this.modalEl.querySelector('#levelUpSelectFeatBtn');
        if (selectFeatBtn) {
            this._cleanup.on(selectFeatBtn, 'click', () => this._handleSelectFeat());
        }

        // Select spell button
        const selectSpellBtn = this.modalEl.querySelector('#levelUpSelectSpellBtn');
        if (selectSpellBtn) {
            this._cleanup.on(selectSpellBtn, 'click', () => this._handleSelectSpell());
        }

        // Toggle multiclass requirements
        const toggleReqsBtn = this.modalEl.querySelector('#ignoreMulticlassReqsToggle');
        if (toggleReqsBtn) {
            this._cleanup.on(toggleReqsBtn, 'click', () => this._handleToggleRequirements());
        }

        // Re-render on character changes (track eventBus listener for cleanup)
        const rerender = async () => {
            this.character = AppState.getCurrentCharacter();
            await this._loadAllClassFeatures();
            await this._renderAll();
        };

        // Store handler reference and manually track for cleanup
        this._rerenderHandler = rerender;
        eventBus.on(EVENTS.CHARACTER_UPDATED, rerender);

        // Manually track this listener for cleanup (not a DOM listener so DOMCleanup can't track it directly)
        // We'll call eventBus.off in _onModalHidden
    }

    _initWizard() {
        // Reset to first step
        this.currentStep = 0;

        // Update step availability messaging
        this._updateStepAvailability();

        // Setup wizard navigation buttons
        const backBtn = this.modalEl.querySelector('#levelUpWizardBackBtn');
        const nextBtn = this.modalEl.querySelector('#levelUpWizardNextBtn');

        if (backBtn) {
            this._cleanup.on(backBtn, 'click', () => this._goStep(-1));
        }

        if (nextBtn) {
            this._cleanup.on(nextBtn, 'click', () => this._goStep(1));
        }

        // Setup stepper click navigation
        const stepperItems = this.modalEl.querySelectorAll('#levelUpStepper [data-step]');
        stepperItems.forEach(item => {
            this._cleanup.on(item, 'click', () => {
                const targetStep = Number.parseInt(item.getAttribute('data-step'), 10);
                if (!Number.isNaN(targetStep)) {
                    this.currentStep = targetStep;
                    this._updateStepper();
                    this._updateWizardButtons();
                }
            });
        });

        // Show first step
        this._updateStepper();
        this._updateWizardButtons();
    }

    _updateStepAvailability() {
        const featMsg = this.modalEl.querySelector('#levelUpFeatMessage');
        const featBtn = this.modalEl.querySelector('#levelUpSelectFeatBtn');
        const hasASI = levelUpService.hasASIAvailable(this.character);

        this.pendingFeatSelection = hasASI;

        if (featMsg) {
            featMsg.textContent = hasASI
                ? 'You have an Ability Score Improvement available. Choose ability increases or a feat.'
                : 'No feat or Ability Score Improvement choices at this level.';
        }

        if (featBtn) {
            featBtn.disabled = !hasASI;
            featBtn.classList.toggle('disabled', !hasASI);
        }

        const spellMsg = this.modalEl.querySelector('#levelUpSpellMessage');
        const spellBtn = this.modalEl.querySelector('#levelUpSelectSpellBtn');
        const pendingSpellSelections = this._getPendingSpellSelections();
        const newSpellAllowances = this._getNewSpellAllowances();
        const hasSpellcasting = Object.keys(this.character.spellcasting?.classes || {}).length > 0;

        this.pendingSpellSelection = pendingSpellSelections.length > 0;

        if (spellMsg) {
            if (!hasSpellcasting) {
                spellMsg.textContent = 'No spellcasting classes. Level up as a spellcaster to gain new spells.';
            } else if (newSpellAllowances.length > 0) {
                // Show new spell allowances in card format with icon next to each class
                const messageParts = [];
                let maxLevel = 0;

                for (const a of newSpellAllowances) {
                    const typeLabel = a.type === 'prepared' ? 'Prepare' : 'Learn';
                    const maxInClass = a.availableSpellLevels?.length > 0
                        ? Math.max(...a.availableSpellLevels)
                        : 0;
                    maxLevel = Math.max(maxLevel, maxInClass);
                    const levelLabel = this._getOrdinalLevel(maxInClass);

                    messageParts.push(`<div class="fw-bold"><i class="fas fa-scroll text-success me-2"></i>+${a.newAllowance} ${a.className} spells</div><div class="small text-muted ms-4">${typeLabel} up to ${levelLabel} level spells</div>`);
                }

                const totalNewSpells = newSpellAllowances.reduce((sum, a) => sum + a.newAllowance, 0);
                const maxLevelLabel = this._getOrdinalLevel(maxLevel);

                spellMsg.innerHTML = `${messageParts.join('<div class="mt-2"></div>')}<div class="border-top pt-2 mt-2"><div class="small"><strong>Total:</strong> ${totalNewSpells} new spell${totalNewSpells !== 1 ? 's' : ''}</div><div class="small"><strong>Max level:</strong> ${maxLevelLabel} level spells</div></div>`;
            } else if (this.pendingSpellSelection) {
                const summary = pendingSpellSelections
                    .map(sel => `${sel.className} (${sel.type === 'prepared' ? 'prepare' : 'learn'} ${sel.remaining})`)
                    .join(', ');
                spellMsg.textContent = `Complete your spell selection: ${summary}.`;
            } else {
                spellMsg.textContent = 'No new spells from this level-up. Use Spells page for general management.';
            }
        }

        if (spellBtn) {
            // Only enable if there are new allowances or pending selections from leveling
            const hasNewSpells = newSpellAllowances.length > 0 || pendingSpellSelections.length > 0;
            spellBtn.disabled = !hasNewSpells;
            spellBtn.classList.toggle('disabled', !hasNewSpells);
        }
    }

    _getPendingSpellSelections() {
        // Only count NEW spell allowances from leveling, not pre-existing unfilled slots
        // This prevents the button from being enabled when a character at level 1 has empty spell slots
        const newAllowances = this._getNewSpellAllowances();

        // Convert newAllowances to pending format
        return newAllowances.map(a => ({
            className: a.className,
            remaining: a.totalAvailable,
            type: a.type
        }));
    }

    /**
     * Get information about new spells available from level-up only
     * Returns details about new spell slots/cantrips that were NOT available at session start
     */
    _getNewSpellAllowances() {
        const allowances = [];
        const spellcastingClasses = this.character.spellcasting?.classes || {};

        console.debug('LevelUpModal', '_getNewSpellAllowances called', {
            sessionStartLevel: this.sessionStartLevel,
            currentLevel: this.character.level,
            spellcastingClasses: Object.keys(spellcastingClasses)
        });

        for (const [className, classData] of Object.entries(spellcastingClasses)) {
            const progressionEntry = this.character.progression?.classes?.find(c => c.name === className);
            const classLevel = progressionEntry?.level || classData.level || 0;
            const sessionStartLevel = this.sessionStartLevel;

            console.debug('LevelUpModal', `_getNewSpellAllowances checking ${className}`, {
                classLevel,
                sessionStartLevel,
                shouldSkip: classLevel <= sessionStartLevel
            });

            // Only show allowances if this level has new spell gains
            if (classLevel <= sessionStartLevel) continue;

            const info = spellSelectionService.getSpellLimitInfo(this.character, className, classLevel);
            if (!info.type) continue;

            // Get starting allowance at session start level
            const startInfo = spellSelectionService.getSpellLimitInfo(this.character, className, sessionStartLevel);
            const newAllowance = Math.max(0, info.limit - startInfo.limit);

            console.debug('LevelUpModal', `_getNewSpellAllowances ${className} allowance`, {
                newAllowance,
                currentLimit: info.limit,
                startLimit: startInfo.limit
            });

            if (newAllowance > 0) {
                // Get available spell levels from spell slots
                const spellSlots = classData.spellSlots || {};
                const availableLevels = Object.keys(spellSlots)
                    .map(lvl => parseInt(lvl, 10))
                    .filter(lvl => !Number.isNaN(lvl))
                    .sort((a, b) => a - b);

                allowances.push({
                    className,
                    type: info.type,
                    newAllowance,
                    levels: classLevel,
                    availableSpellLevels: availableLevels,
                    totalAvailable: Math.max(0, info.limit - info.current)
                });
            }
        }

        console.debug('LevelUpModal', '_getNewSpellAllowances result', { allowanceCount: allowances.length, allowances });
        return allowances;
    }

    /**
     * Check if character has the Spellcasting feature in any of their classes
     */
    _hasSpellcastingFeature() {
        // Check if character has any spellcasting classes initialized
        const spellcastingClasses = this.character.spellcasting?.classes || {};
        if (Object.keys(spellcastingClasses).length === 0) {
            return false;
        }

        // Check if any progression class has the "Spellcasting" feature
        const progressionClasses = this.character.progression?.classes || [];
        for (const classEntry of progressionClasses) {
            const features = classEntry.features || [];
            const hasSpellcastingFeature = features.some(f =>
                f.name === 'Spellcasting' ||
                f.name === 'Pact Magic' ||
                f.name?.toLowerCase().includes('spellcasting')
            );

            if (hasSpellcastingFeature) {
                return true;
            }
        }

        // Fallback: if spellcasting classes exist, assume they have the feature
        // This handles cases where features might not be populated yet
        return Object.keys(spellcastingClasses).length > 0;
    }

    _goStep(delta) {
        const totalSteps = this._getTotalSteps();
        this.currentStep = Math.max(0, Math.min(totalSteps - 1, this.currentStep + delta));
        this._updateStepper();
        this._updateWizardButtons();
    }

    _getTotalSteps() {
        const stepperItems = this.modalEl.querySelectorAll('#levelUpStepper [data-step]');
        return stepperItems.length || 5;
    }

    _updateStepper() {
        // Update stepper active state
        const stepperItems = this.modalEl.querySelectorAll('#levelUpStepper [data-step]');
        stepperItems.forEach(item => {
            const step = Number.parseInt(item.getAttribute('data-step'), 10);
            if (step === this.currentStep) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Show/hide form sections
        const sections = this.modalEl.querySelectorAll('.form-section[data-step]');
        sections.forEach(section => {
            const step = Number.parseInt(section.getAttribute('data-step'), 10);
            if (step === this.currentStep) {
                section.removeAttribute('hidden');
            } else {
                section.setAttribute('hidden', '');
            }
        });
    }

    _updateWizardButtons() {
        const backBtn = this.modalEl.querySelector('#levelUpWizardBackBtn');
        const nextBtn = this.modalEl.querySelector('#levelUpWizardNextBtn');
        const totalSteps = this._getTotalSteps();

        // Hide back button on first step
        if (backBtn) {
            backBtn.style.display = this.currentStep === 0 ? 'none' : 'inline-block';
        }

        // Hide next button on last step
        if (nextBtn) {
            nextBtn.style.display = this.currentStep === totalSteps - 1 ? 'none' : 'inline-block';
        }
    }

    _onModalHidden() {
        // Skip cleanup if this is a temporary hide (e.g., for spell/feat selection)
        if (this._isTemporarilyHidden) {
            console.debug('LevelUpModal', '_onModalHidden called but modal is temporarily hidden');
            return;
        }

        // Clean up all tracked DOM listeners and timers
        this._cleanup.cleanup();

        // Manually remove eventBus listener (not tracked by DOMCleanup)
        if (this._rerenderHandler) {
            eventBus.off(EVENTS.CHARACTER_UPDATED, this._rerenderHandler);
            this._rerenderHandler = null;
        }

        // Clean up any lingering backdrops
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.remove();
        }
        document.body.classList.remove('modal-open');
    }

    async _handleIncreaseLevel() {
        if (!this.character || !this.selectedClassName) {
            showNotification('Select a class to level up', 'warning');
            return;
        }

        // Find the selected class entry
        const classEntry = this.character.progression.classes.find(
            (c) => c.name === this.selectedClassName
        );
        if (!classEntry) {
            showNotification('Selected class not found', 'error');
            return;
        }

        // Increase class level and total level
        classEntry.level++;
        this.character.level++;

        // Load and apply new features for this level
        await this._loadFeaturesForClass(classEntry);

        levelUpService.updateSpellSlots(this.character);
        eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);
        await this._renderAll();
    }

    async _handleDecreaseLevel() {
        if (!this.character || !this.selectedClassName) {
            showNotification('Select a class to level down', 'warning');
            return;
        }

        // Find the selected class entry
        const classEntry = this.character.progression.classes.find(
            (c) => c.name === this.selectedClassName
        );
        if (!classEntry || classEntry.level <= 1) {
            showNotification('Cannot reduce class level below 1', 'warning');
            return;
        }

        const confirmed = confirm(`Decrease ${this.selectedClassName} level to ${classEntry.level - 1}?`);
        if (!confirmed) return;

        // Decrease class level and total level
        classEntry.level--;
        this.character.level--;

        // Remove features above new level
        classEntry.features = (classEntry.features || []).filter(
            (f) => f.level <= classEntry.level
        );

        levelUpService.updateSpellSlots(this.character);
        showNotification(`Leveled down ${this.selectedClassName} to ${classEntry.level}`, 'info');
        eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);
        await this._renderAll();
    }

    async _handleAddClass() {
        if (!this.character) return;
        const select = this.modalEl.querySelector('#levelUpClassSelect');
        const value = select?.value || '';
        if (!value) {
            showNotification('Select a class to add', 'warning');
            return;
        }
        const options = levelUpService.getMulticlassOptions(this.character, this.ignoreMulticlassReqs);
        const selectedOption = options.find((o) => o.name === value);
        if (!selectedOption) {
            showNotification('Selected class is unavailable', 'error');
            return;
        }
        if (!this.ignoreMulticlassReqs && !selectedOption.meetsRequirements) {
            showNotification('Ability scores do not meet the multiclass requirements. Toggle restrictions to override.', 'warning');
            return;
        }
        try {
            console.info('LevelUpModal', `Adding class: ${value}`);
            const classEntry = levelUpService.addClassLevel(this.character, value, 1);
            this.character.level++;

            // Load features for the new class
            if (classEntry) {
                await this._loadFeaturesForClass(classEntry);
            }

            levelUpService.updateSpellSlots(this.character);
            eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);

            // Reset selection and set new class as selected
            select.value = '';
            this.selectedClassName = value;
            await this._renderAll();
        } catch (err) {
            console.error('LevelUpModal', '_handleAddClass failed', err);
            showNotification(`Failed to add ${value}`, 'error');
        }
    }

    _handleRecalcHP() {
        if (!this.character) return;
        const maxHP = levelUpService.calculateMaxHitPoints(this.character);
        this.character.hitPoints = {
            ...this.character.hitPoints,
            max: maxHP,
            current: Math.min(this.character.hitPoints?.current || maxHP, maxHP),
        };
        eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);
    }

    async _handleSelectFeat() {
        try {
            // Mark that we're temporarily hiding for modal coordination
            this._isTemporarilyHidden = true;

            // Hide level up modal
            if (this.bootstrapModal) {
                this.bootstrapModal.hide();
            }

            // Lazy import to avoid circular deps
            const { FeatCard } = await import('../feats/Modal.js');
            const modal = new FeatCard();

            // Get the feat modal element
            const featModalEl = document.getElementById('featSelectionModal');
            if (!featModalEl) {
                showNotification('Feat selection modal not found', 'error');
                this._isTemporarilyHidden = false;
                return;
            }

            // Show modal and wait for it to close
            await modal.show();

            // Wait for modal to be hidden
            await new Promise((resolve) => {
                const handler = () => {
                    featModalEl.removeEventListener('hidden.bs.modal', handler);
                    resolve();
                };
                featModalEl.addEventListener('hidden.bs.modal', handler);
            });

            // Mark that we're no longer temporarily hidden
            this._isTemporarilyHidden = false;

            // When feat modal closes, show level up modal again
            if (this.bootstrapModal) {
                this.bootstrapModal.show();
            }
            // Refresh messaging and selections display
            this._updateStepAvailability();
            await this._renderAll();
        } catch (err) {
            console.error('LevelUpModal', '_handleSelectFeat failed', err);
            showNotification('Failed to open feat selection modal', 'error');

            // Mark that we're no longer temporarily hidden
            this._isTemporarilyHidden = false;

            // Re-show level up modal on error
            if (this.bootstrapModal) {
                this.bootstrapModal.show();
            }
        }
    }

    async _handleSelectSpell() {
        try {
            console.debug('LevelUpModal', '_handleSelectSpell starting');

            // Check if there are new spell allowances from level-up
            const newAllowances = this._getNewSpellAllowances();
            const pendingSelections = this._getPendingSpellSelections();

            if (newAllowances.length === 0 && pendingSelections.length === 0) {
                showNotification('No new spells available from this level-up', 'info');
                return;
            }

            // Mark that we're temporarily hiding for modal coordination
            this._isTemporarilyHidden = true;

            // Hide level up modal
            if (this.bootstrapModal) {
                console.debug('LevelUpModal', 'Hiding level up modal...');
                this.bootstrapModal.hide();
            }

            // Lazy import to avoid circular deps
            const { SpellSelectionModal } = await import('../spells/Modal.js');

            // Reuse spell selection modal if already created, otherwise create new
            if (!this.spellSelectionModal) {
                this.spellSelectionModal = new SpellSelectionModal({
                    newAllowances: newAllowances.length > 0 ? newAllowances : null,
                    selectedSpells: [] // Start with empty selections on first open
                });
            } else {
                // Reopen existing modal - preserve the selectedSpells from previous session
                this.spellSelectionModal.newAllowances = newAllowances.length > 0 ? newAllowances : null;
                // selectedSpells are already preserved in the instance
            }

            const modal = this.spellSelectionModal;

            // Show modal and wait for it to close
            const result = await modal.show();
            console.debug('LevelUpModal', 'Spell modal closed with result:', result);

            // Give time for backdrop to be removed and modal state to settle
            await new Promise(resolve => setTimeout(resolve, 200));

            // Mark that we're no longer temporarily hidden
            this._isTemporarilyHidden = false;

            // Ensure bootstrap modal instance still exists and is not disposed
            if (!this.bootstrapModal) {
                console.warn('LevelUpModal', 'Bootstrap modal was disposed, re-creating...');
                const bs = window.bootstrap || globalThis.bootstrap;
                if (bs) {
                    this.bootstrapModal = new bs.Modal(this.modalEl, {
                        backdrop: true,
                        keyboard: true,
                    });
                }
            }

            // When spell modal closes, show level up modal again
            console.debug('LevelUpModal', 'About to show level up modal, bootstrapModal:', !!this.bootstrapModal);
            if (this.bootstrapModal) {
                console.debug('LevelUpModal', 'Calling bootstrapModal.show()');
                this.bootstrapModal.show();
                console.debug('LevelUpModal', 'bootstrapModal.show() called');
            } else {
                console.error('LevelUpModal', 'bootstrapModal is null, cannot show!');
            }
            // Refresh messaging and selections display
            this._updateStepAvailability();
            await this._renderAll();
        } catch (err) {
            console.error('LevelUpModal', '_handleSelectSpell failed', err);
            showNotification('Failed to open spell selection modal', 'error');

            // Mark that we're no longer temporarily hidden
            this._isTemporarilyHidden = false;

            // Re-show level up modal on error
            if (this.bootstrapModal) {
                this.bootstrapModal.show();
            }
        }
    }

    _handleToggleRequirements() {
        // Toggle the restrictions flag
        this.ignoreMulticlassReqs = !this.ignoreMulticlassReqs;

        // Update button state
        const btn = this.modalEl.querySelector('#ignoreMulticlassReqsToggle');
        if (btn) {
            btn.setAttribute('data-restrictions', this.ignoreMulticlassReqs ? 'true' : 'false');
        }

        // Re-render the class select to apply new filter
        this._renderClassSelect();

        console.debug('LevelUpModal', `Multiclass requirements ${this.ignoreMulticlassReqs ? 'disabled' : 'enabled'}`);
    }

    async _renderAll() {
        this._renderOverview();
        await this._renderClassSelect();
        await this._renderNewFeatures();
        this._renderHP();
        this._renderCurrentClass();
        this._renderSelectedFeats();
        this._renderSelectedSpells();
        this._updateStepAvailability();
        this._updateWizardButtons();
    }

    _renderSelectedFeats() {
        const container = this.modalEl.querySelector('#levelUpFeatMessage')?.parentElement;
        if (!container) return;

        const feats = this.character?.feats || [];
        if (feats.length === 0) {
            // Message is set by _updateStepAvailability
            return;
        }

        // Show selected feats below the message
        const button = this.modalEl.querySelector('#levelUpSelectFeatBtn');
        if (!button) return;

        let html = '';
        if (feats.length > 0) {
            html += '<div class="mt-3">';
            html += '<p class="small text-muted mb-2"><i class="fas fa-check"></i> Selected Feats:</p>';
            html += '<div class="d-flex flex-wrap gap-2">';
            for (const feat of feats) {
                html += `<span class="badge bg-success">${feat.name || 'Unknown'}</span>`;
            }
            html += '</div></div>';
        }

        if (button.nextElementSibling?.classList.contains('mt-3')) {
            button.nextElementSibling.remove();
        }

        if (html) {
            const div = document.createElement('div');
            div.innerHTML = html;
            button.parentElement.appendChild(div.firstElementChild);
        }
    }

    _renderSelectedSpells() {
        const container = this.modalEl.querySelector('#levelUpSpellMessage')?.parentElement;
        if (!container) return;

        const button = this.modalEl.querySelector('#levelUpSelectSpellBtn');
        if (!button) return;

        // Collect all known spells for spellcasting classes
        const allKnownSpells = [];
        const spellcastingClasses = this.character.spellcasting?.classes || {};

        for (const classData of Object.values(spellcastingClasses)) {
            const spells = classData.spellsKnown || [];
            allKnownSpells.push(...spells);
        }

        let html = '';
        if (allKnownSpells.length > 0) {
            html += '<div class="mt-3">';
            html += '<p class="small text-muted mb-2"><i class="fas fa-check"></i> Selected Spells:</p>';
            html += '<div class="d-flex flex-wrap gap-2">';
            for (const spell of allKnownSpells.slice(0, 10)) {  // Show first 10
                html += `<span class="badge bg-info">${spell.name || 'Unknown'}</span>`;
            }
            if (allKnownSpells.length > 10) {
                html += `<span class="badge bg-secondary">+${allKnownSpells.length - 10} more</span>`;
            }
            html += '</div></div>';
        }

        if (button.nextElementSibling?.classList.contains('mt-3')) {
            button.nextElementSibling.remove();
        }

        if (html) {
            const div = document.createElement('div');
            div.innerHTML = html;
            button.parentElement.appendChild(div.firstElementChild);
        }
    }

    _renderOverview() {
        const total = this.modalEl.querySelector('#levelUpTotalLevel');
        const breakdown = this.modalEl.querySelector('#levelUpClassBreakdown');
        if (!total || !breakdown) return;
        total.textContent = this.character?.level || 1;
        if (this.character?.progression?.classes?.length) {
            let html = '<div class="d-flex flex-column gap-2">';
            for (const c of this.character.progression.classes) {
                const isSelected = c.name === this.selectedClassName;
                const cardClass = isSelected ? 'border-primary shadow-sm' : 'border-secondary';
                const bgClass = isSelected ? 'bg-primary bg-opacity-10' : '';
                html += `
                    <div class="class-selection-card d-flex justify-content-between align-items-center p-3 border-2 rounded ${cardClass} ${bgClass}" 
                         data-class-name="${c.name}" 
                         style="cursor: pointer; transition: all 0.2s ease;">
                        <div class="d-flex align-items-center gap-2">
                            ${isSelected ? '<i class="fas fa-check-circle text-primary fs-5"></i>' : '<i class="fas fa-circle text-muted opacity-25"></i>'}
                            <div>
                                <div class="fw-bold">${c.name}</div>
                                ${c.subclass ? `<div class="text-muted small">${c.subclass.name}</div>` : ''}
                            </div>
                        </div>
                        <div class="d-flex gap-2">
                            <span class="badge bg-primary fs-6">Level ${c.level}</span>
                            <span class="badge bg-secondary fs-6">${c.hitDice || ''}</span>
                        </div>
                    </div>`;
            }
            html += '</div>';
            breakdown.innerHTML = html;

            // Add click handlers for class selection
            const classCards = breakdown.querySelectorAll('[data-class-name]');
            classCards.forEach(card => {
                card.addEventListener('click', () => {
                    this.selectedClassName = card.getAttribute('data-class-name');
                    this._renderOverview();
                    this._renderCurrentClass();
                });
            });
        } else {
            breakdown.innerHTML = '<p class="text-muted">No classes selected.</p>';
        }
    }

    async _renderClassSelect() {
        const select = this.modalEl.querySelector('#levelUpClassSelect');
        if (!select) {
            console.warn('LevelUpModal', '_renderClassSelect: select element not found');
            return;
        }
        try {
            const options = levelUpService.getMulticlassOptions(this.character, this.ignoreMulticlassReqs);
            const prev = select.value;
            const optionHtml = options.map((o) => {
                const label = o.requirementText ? `${o.name} (${o.requirementText})` : o.name;
                // When ignoring requirements, don't disable any options
                const disabledAttr = (this.ignoreMulticlassReqs || o.meetsRequirements) ? '' : ' disabled';
                return `<option value="${o.name}"${disabledAttr}>${label}</option>`;
            }).join('');
            select.innerHTML = `<option value="">Select a class...</option>${optionHtml}`;
            if (options.some((o) => o.name === prev)) select.value = prev;
            console.debug('LevelUpModal', `Populated class select with ${options.length} options (requirements ${this.ignoreMulticlassReqs ? 'off' : 'on'})`);
        } catch (err) {
            console.error('LevelUpModal', '_renderClassSelect failed', err);
            select.innerHTML = '<option value="">Select a class...</option>';
        }
    }

    async _renderNewFeatures() {
        const list = this.modalEl.querySelector('#levelUpNewFeaturesList');
        if (!list) return;

        // Collect all current features
        const currentFeatures = [];
        for (const classEntry of this.character.progression.classes || []) {
            for (const f of classEntry.features || []) {
                currentFeatures.push({
                    name: f.name,
                    level: f.level || 1,
                    source: f.source,
                    description: f.description,
                    className: classEntry.name,
                });
            }
        }

        // Filter to only NEW features (not in sessionStartFeatures)
        const newFeatures = currentFeatures.filter(current => {
            return !this.sessionStartFeatures.some(start =>
                start.name === current.name &&
                start.level === current.level &&
                start.className === current.className
            );
        });

        if (!newFeatures.length) {
            list.innerHTML = '<p class="text-muted"><i class="fas fa-info-circle"></i> No new features gained in this session.</p>';
            return;
        }

        // Group features by level
        const byLevel = new Map();
        for (const feat of newFeatures) {
            const lvl = feat.level || 1;
            if (!byLevel.has(lvl)) byLevel.set(lvl, []);
            byLevel.get(lvl).push(feat);
        }

        // Sort levels ascending
        const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);
        let html = '';
        for (const lvl of sortedLevels) {
            const feats = byLevel.get(lvl);
            html += `<div class="mb-3">
                        <div class="d-flex align-items-center mb-2">
                            <span class="badge bg-success me-2">New</span>
                            <h6 class="mb-0">Level ${lvl}</h6>
                        </div>
                        <div class="row g-2">`;
            for (const feat of feats) {
                const tooltipContent = await this._featureEntriesToHtml(feat.description);
                const escapedContent = (tooltipContent || '').replace(/"/g, '&quot;');
                html += `
                    <div class="col-12 col-md-6 col-xl-4">
                        <div class="list-group-item d-flex justify-content-between align-items-center">
                                <span class="rd__hover-link" 
                                    data-hover-type="feature" 
                                    data-hover-name="${this._escapeHtml(feat.name)}" 
                                    data-hover-content="${escapedContent}">${feat.name}</span>
                            <span class="badge bg-secondary">${feat.className}</span>
                        </div>
                    </div>`;
            }
            html += `</div>
                    </div>`;
        }

        list.innerHTML = html;

        // Process element for custom tooltips
        try {
            await textProcessor.processElement(list);
        } catch (err) {
            console.warn('LevelUpModal', 'Failed to process tooltips', err);
        }
    }

    async _featureEntriesToHtml(entries) {
        if (!entries) return '';

        // If entries is already a string, process formatting/tags
        if (typeof entries === 'string') {
            return await textProcessor.processString(entries);
        }

        if (!Array.isArray(entries)) {
            return '';
        }

        let result = '';

        for (const entry of entries) {
            if (typeof entry === 'string') {
                const processed = await textProcessor.processString(entry);
                result += `<p>${processed}</p>`;
                continue;
            }

            if (Array.isArray(entry)) {
                result += await this._featureEntriesToHtml(entry);
                continue;
            }

            if (entry.entries) {
                result += await this._featureEntriesToHtml(entry.entries);
                continue;
            }

            if (entry.entry) {
                result += await this._featureEntriesToHtml(entry.entry);
                continue;
            }

            if (entry.name || entry.text) {
                const processed = await textProcessor.processString(entry.name || entry.text);
                result += `<p>${processed}</p>`;
            }
        }

        return result;
    }

    _entriesToPlainText(entries) {
        if (!entries) return '';
        const parts = [];
        const walk = (e) => {
            if (typeof e === 'string') { parts.push(e); return; }
            if (Array.isArray(e)) { e.forEach(walk); return; }
            if (e && typeof e === 'object') {
                if (e.entry) walk(e.entry);
                if (e.entries) walk(e.entries);
                if (e.name) parts.push(e.name);
                if (e.text) parts.push(e.text);
            }
        };
        walk(entries);
        return parts.join(' ').replace(/\s+/g, ' ').trim();
    }

    _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _renderHP() {
        const maxEl = this.modalEl.querySelector('#levelUpMaxHP');
        const brEl = this.modalEl.querySelector('#levelUpHPBreakdown');
        if (!maxEl || !brEl) {
            console.warn('LevelUpModal', '_renderHP: HP elements not found');
            return;
        }
        try {
            const maxHP = levelUpService.calculateMaxHitPoints(this.character);
            maxEl.textContent = maxHP || this.character.hitPoints?.max || 0;
            let breakdown = '';
            const classes = this.character.progression?.classes || [];
            if (classes.length > 0) {
                for (const c of classes) {
                    breakdown += `${c.name}: ${c.hitDice || 'd8'} × ${c.level}<br>`;
                }
            } else {
                breakdown += 'No classes yet<br>';
            }
            const conMod = this.character.getAbilityModifier?.('constitution') || 0;
            breakdown += `Constitution modifier: ${conMod >= 0 ? '+' : ''}${conMod} per level`;
            brEl.innerHTML = breakdown;
            console.debug('LevelUpModal', `Rendered HP: ${maxHP}`);
        } catch (err) {
            console.error('LevelUpModal', '_renderHP failed', err);
            maxEl.textContent = this.character.hitPoints?.max || 0;
            brEl.innerHTML = 'HP calculation unavailable';
        }
    }

    /**
     * Get spells that were added since session start
     * Compares current spell lists against sessionStartSpells captured at modal open
     */
    _getRecentlySelectedSpells() {
        const recentSpells = [];
        try {
            const classes = this.character.spellcasting?.classes || {};

            for (const [className, classData] of Object.entries(classes)) {
                // Get current spells
                const currentKnown = new Set(classData.spellsKnown || classData.known || []);
                const currentPrepared = new Set(classData.spellsPrepared || classData.prepared || []);
                const currentCantrips = new Set(classData.cantrips || []);

                // Get session start spells
                const sessionSpells = this.sessionStartSpells[className] || {};
                const startKnown = new Set(sessionSpells.known || []);
                const startPrepared = new Set(sessionSpells.prepared || []);
                const startCantrips = new Set(sessionSpells.cantrips || []);

                // Find newly added spells
                const addNewSpells = (currentSet, startSet) => {
                    for (const spellName of currentSet) {
                        if (!startSet.has(spellName)) {
                            recentSpells.push({ name: spellName, className });
                        }
                    }
                };

                addNewSpells(currentKnown, startKnown);
                addNewSpells(currentPrepared, startPrepared);
                addNewSpells(currentCantrips, startCantrips);
            }

            console.debug('LevelUpModal', `_getRecentlySelectedSpells: found ${recentSpells.length} new spells since session start`);
        } catch (err) {
            console.warn('LevelUpModal', '_getRecentlySelectedSpells failed', err);
        }

        return recentSpells;
    }

    _renderCurrentClass() {
        const currentClassEl = this.modalEl.querySelector('#levelUpCurrentClass');
        if (currentClassEl) {
            currentClassEl.textContent = this.selectedClassName || 'None';
        }
    }

    async _loadAllClassFeatures() {
        try {
            // Load features for all existing classes up to their current level
            const { classService } = await import('../../../services/ClassService.js');

            for (const classEntry of this.character.progression.classes || []) {
                await this._loadFeaturesForClass(classEntry, classService);
            }
        } catch (err) {
            console.error('LevelUpModal', '_loadAllClassFeatures failed', err);
            showNotification('Failed to load class features', 'error');
        }
    }

    async _loadFeaturesForClass(classEntry, classServiceInstance = null) {
        try {
            // Lazy import if not provided
            const classService = classServiceInstance || (await import('../../../services/ClassService.js')).classService;

            // Initialize features array if needed
            if (!classEntry.features) {
                classEntry.features = [];
            }

            // Use classService.getClassFeatures to get all features up to current level
            const features = classService.getClassFeatures(classEntry.name, classEntry.level);

            console.info('LevelUpModal', `Found ${features.length} features for ${classEntry.name} level ${classEntry.level}`);

            for (const feature of features) {
                const exists = classEntry.features.some(x => x.name === feature.name && x.level === feature.level);
                if (!exists) {
                    classEntry.features.push({
                        name: feature.name,
                        level: feature.level,
                        source: feature.source,
                        description: feature.entries
                    });
                }
            }

            // Load subclass features if applicable
            if (classEntry.subclass) {
                const subFeatures = classService.getSubclassFeatures(
                    classEntry.name,
                    classEntry.subclass.shortName || classEntry.subclass.name,
                    classEntry.level
                );

                console.info('LevelUpModal', `Found ${subFeatures.length} subclass features for ${classEntry.subclass?.name || classEntry.subclass}`);

                for (const feature of subFeatures) {
                    const exists = classEntry.features.some(x => x.name === feature.name && x.level === feature.level);
                    if (!exists) {
                        classEntry.features.push({
                            name: feature.name,
                            level: feature.level,
                            source: feature.source,
                            description: feature.entries
                        });
                    }
                }
            }

            console.info('LevelUpModal', `Total ${classEntry.features.length} features loaded for ${classEntry.name}`);
        } catch (err) {
            console.error('LevelUpModal', `_loadFeaturesForClass failed for ${classEntry?.name}`, err);
        }
    }

    /**
     * Convert a spell level number to an ordinal string (1 -> "1st", 2 -> "2nd", etc.)
     */
    _getOrdinalLevel(level) {
        if (level === 0) return 'cantrip';

        const j = level % 10;
        const k = level % 100;

        if (j === 1 && k !== 11) return `${level}st`;
        if (j === 2 && k !== 12) return `${level}nd`;
        if (j === 3 && k !== 13) return `${level}rd`;
        return `${level}th`;
    }
}
