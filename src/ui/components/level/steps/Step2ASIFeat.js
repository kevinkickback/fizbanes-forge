import { ABILITY_NAMES } from '../../../../lib/5eToolsParser.js';
import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { featService } from '../../../../services/FeatService.js';
import { levelUpService } from '../../../../services/LevelUpService.js';
import { LevelUpFeatSelector } from '../LevelUpFeatSelector.js';

/**
 * Step 2: ASI/Feat Selection
 * 
 * Choose ability score improvements or feats for any ASI slots available.
 * Handles ability score selections (+2/+0 or +1/+1), feat choices, and half-feats.
 */

export class Step2ASIFeat {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
        this._featSelector = null;

        // Initialize step data if not present
        if (!this.session.stepData.asiChoices) {
            this.session.stepData.asiChoices = {};
        }
    }

    async render() {
        // Get leveled classes from change summary
        const summary = this.session.getChangeSummary();
        const leveledClasses = summary.leveledClasses.map(lc => ({
            name: lc.name,
            newLevel: lc.to,
            oldLevel: lc.from
        }));

        // Calculate total ASI slots available
        const asiSlots = await this._calculateASISlots(leveledClasses);

        if (asiSlots.length === 0) {
            return `
                <div class="step-2-asi-feat">
                    <div class="alert alert-info mb-0">
                        <i class="fas fa-info-circle"></i>
                        No ability score improvements or feats available at this level.
                    </div>
                </div>
            `;
        }

        let html = `
            <div class="step-2-asi-feat">
                <div class="asi-slots">
        `;

        // Render each ASI slot
        asiSlots.forEach((slot, index) => {
            html += this._renderASISlot(slot, index);
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    attachListeners(contentArea) {
        // 1. Handle ASI/Feat mode toggle (improvement vs feat)
        const modeToggles = contentArea.querySelectorAll('[data-asi-mode-toggle]');
        modeToggles.forEach((toggle) => {
            this._cleanup.on(toggle, 'change', (e) => {
                const slotIndex = e.target.dataset.asiSlotIndex;
                const mode = e.target.value;

                // Update UI visibility
                const slotCard = contentArea.querySelector(`[data-asi-slot="${slotIndex}"]`);
                const improvementOptions = slotCard?.querySelector('[data-improvement-options]');
                const featOptions = slotCard?.querySelector('[data-feat-options]');

                if (mode === 'improvement') {
                    improvementOptions?.classList.remove('d-none');
                    featOptions?.classList.add('d-none');

                    // Clear feat selection: re-render feat options to show "Select a Feat" button
                    if (featOptions) {
                        featOptions.innerHTML = this._renderFeatOptions(slotIndex, null);
                    }
                } else {
                    improvementOptions?.classList.add('d-none');
                    featOptions?.classList.remove('d-none');

                    // Clear ASI selections: remove active states
                    slotCard?.querySelectorAll('[data-ability-plus2]').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    slotCard?.querySelectorAll('[data-ability-plus1]').forEach(btn => {
                        btn.classList.remove('active');
                    });
                }

                // Clear and reset choice for this slot when switching modes
                this.session.stepData.asiChoices[slotIndex] = {
                    mode,
                    // Clear all other properties to prevent applying both ASI and Feat
                    asiMode: mode === 'improvement' ? 'plus2' : undefined,
                    ability1: '',
                    ability2: '',
                    feat: undefined
                };

                // Re-attach feat button listeners if we switched to feat mode
                if (mode === 'feat' && featOptions) {
                    const featButton = featOptions.querySelector('[data-select-feat]');
                    if (featButton) {
                        this._cleanup.on(featButton, 'click', async () => {
                            const currentFeat = this.session.stepData.asiChoices[slotIndex]?.feat;
                            this._featSelector = new LevelUpFeatSelector(this.session, this);
                            await this._featSelector.show(currentFeat ? { name: currentFeat } : null);
                        });
                    }
                }
            });
        });

        // 2. Handle ASI points mode (+2 vs +1/+1)
        const pointsToggles = contentArea.querySelectorAll('[data-asi-points-toggle]');
        pointsToggles.forEach((toggle) => {
            this._cleanup.on(toggle, 'change', (e) => {
                const slotIndex = e.target.dataset.asiSlotIndex;
                const asiMode = e.target.value; // 'plus2' or 'plus1plus1'

                // Update UI visibility
                const slotCard = contentArea.querySelector(`[data-asi-slot="${slotIndex}"]`);
                const plus2Options = slotCard?.querySelector('[data-plus2-options]');
                const plus1plus1Options = slotCard?.querySelector('[data-plus1plus1-options]');

                if (asiMode === 'plus2') {
                    plus2Options?.classList.remove('d-none');
                    plus1plus1Options?.classList.add('d-none');
                } else {
                    plus2Options?.classList.add('d-none');
                    plus1plus1Options?.classList.remove('d-none');
                }

                // Initialize/update choice
                if (!this.session.stepData.asiChoices[slotIndex]) {
                    this.session.stepData.asiChoices[slotIndex] = { mode: 'improvement' };
                }
                this.session.stepData.asiChoices[slotIndex].asiMode = asiMode;

                // Clear previous ability selections when switching modes
                this.session.stepData.asiChoices[slotIndex].ability1 = '';
                this.session.stepData.asiChoices[slotIndex].ability2 = '';

                // Clear active states
                slotCard?.querySelectorAll('[data-ability-plus2]').forEach(btn => {
                    btn.classList.remove('active');
                });
                slotCard?.querySelectorAll('[data-ability-plus1]').forEach(btn => {
                    btn.classList.remove('active');
                });
            });
        });

        // 3. Handle +2 ability buttons
        const plus2Buttons = contentArea.querySelectorAll('[data-ability-plus2]');
        plus2Buttons.forEach((btn) => {
            this._cleanup.on(btn, 'click', () => {
                const slotIndex = btn.dataset.asiSlotIndex;
                const ability = btn.dataset.abilityPlus2;
                const slotCard = contentArea.querySelector(`[data-asi-slot="${slotIndex}"]`);

                // Visual feedback
                slotCard?.querySelectorAll('[data-ability-plus2]').forEach((b) => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');

                // Store selection
                if (!this.session.stepData.asiChoices[slotIndex]) {
                    this.session.stepData.asiChoices[slotIndex] = { mode: 'improvement', asiMode: 'plus2' };
                }
                this.session.stepData.asiChoices[slotIndex].ability1 = ability;
                this.session.stepData.asiChoices[slotIndex].ability2 = '';

                // Record in progression history
                const className = slotCard?.dataset.className;
                const level = slotCard?.dataset.level ? parseInt(slotCard.dataset.level, 10) : null;
                if (className && level !== null) {
                    this.session.recordChoices(className, level, {
                        asi: {
                            type: 'ability-improvement',
                            mode: 'plus2',
                            abilities: [ability]
                        }
                    });
                }
            });
        });

        // 4. Handle +1/+1 ability buttons (allow two selections)
        const plus1Buttons = contentArea.querySelectorAll('[data-ability-plus1]');
        plus1Buttons.forEach((btn) => {
            this._cleanup.on(btn, 'click', () => {
                const slotIndex = btn.dataset.asiSlotIndex;
                const ability = btn.dataset.abilityPlus1;
                const slotCard = contentArea.querySelector(`[data-asi-slot="${slotIndex}"]`);

                if (!this.session.stepData.asiChoices[slotIndex]) {
                    this.session.stepData.asiChoices[slotIndex] = { mode: 'improvement', asiMode: 'plus1plus1' };
                }

                const currentAbility1 = this.session.stepData.asiChoices[slotIndex].ability1;
                const currentAbility2 = this.session.stepData.asiChoices[slotIndex].ability2;

                // Toggle logic: clicking same button deselects it
                if (currentAbility1 === ability) {
                    // Deselect first, move second to first if exists
                    this.session.stepData.asiChoices[slotIndex].ability1 = currentAbility2;
                    this.session.stepData.asiChoices[slotIndex].ability2 = '';
                } else if (currentAbility2 === ability) {
                    // Deselect second
                    this.session.stepData.asiChoices[slotIndex].ability2 = '';
                } else if (!currentAbility1) {
                    // First selection
                    this.session.stepData.asiChoices[slotIndex].ability1 = ability;
                } else if (!currentAbility2) {
                    // Second selection (ensure different from first)
                    if (ability !== currentAbility1) {
                        this.session.stepData.asiChoices[slotIndex].ability2 = ability;
                    }
                } else {
                    // Both slots filled, replace second with new selection
                    this.session.stepData.asiChoices[slotIndex].ability2 = ability;
                }

                // Update visual states
                const newAbility1 = this.session.stepData.asiChoices[slotIndex].ability1;
                const newAbility2 = this.session.stepData.asiChoices[slotIndex].ability2;

                slotCard?.querySelectorAll('[data-ability-plus1]').forEach((b) => {
                    const btnAbility = b.dataset.abilityPlus1;
                    if (btnAbility === newAbility1 || btnAbility === newAbility2) {
                        b.classList.add('active');
                    } else {
                        b.classList.remove('active');
                    }
                });

                // Record if both selections are made
                if (newAbility1 && newAbility2 && newAbility1 !== newAbility2) {
                    const className = slotCard?.dataset.className;
                    const level = slotCard?.dataset.level ? parseInt(slotCard.dataset.level, 10) : null;
                    if (className && level !== null) {
                        this.session.recordChoices(className, level, {
                            asi: {
                                type: 'ability-improvement',
                                mode: 'plus1plus1',
                                abilities: [newAbility1, newAbility2]
                            }
                        });
                    }
                }
            });
        });

        // 5. Handle feat selection button
        const featButtons = contentArea.querySelectorAll('[data-select-feat]');
        featButtons.forEach((btn) => {
            this._cleanup.on(btn, 'click', async () => {
                const slotIndex = btn.dataset.asiSlotIndex;
                const currentFeat = this.session.stepData.asiChoices[slotIndex]?.feat;

                // Create feat selector
                this._featSelector = new LevelUpFeatSelector(this.session, this);

                // Show modal with current selection
                await this._featSelector.show(currentFeat ? { name: currentFeat } : null);
            });
        });
    }

    /**
     * Called by LevelUpFeatSelector when a feat is confirmed
     */
    updateFeatSelection(featName) {
        // Find the active slot (the one that just opened the feat selector)
        const activeSlotIndex = this._findActiveFeatSlot();

        if (activeSlotIndex !== null) {
            if (!this.session.stepData.asiChoices[activeSlotIndex]) {
                this.session.stepData.asiChoices[activeSlotIndex] = { mode: 'feat' };
            }
            this.session.stepData.asiChoices[activeSlotIndex].feat = featName;

            // Record in progression history
            const slotCard = document.querySelector(`[data-asi-slot="${activeSlotIndex}"]`);
            const className = slotCard?.dataset.className;
            const level = slotCard?.dataset.level ? parseInt(slotCard.dataset.level, 10) : null;
            if (className && level !== null) {
                this.session.recordChoices(className, level, {
                    asi: {
                        type: 'feat-choice',
                        feat: featName
                    }
                });
            }

            // Re-render the step to show the selected feat
            this._reRenderStep();
        }
    }

    /**
     * Find which ASI slot is currently in feat mode (for feat selector callback)
     */
    _findActiveFeatSlot() {
        for (const [index, choice] of Object.entries(this.session.stepData.asiChoices)) {
            if (choice.mode === 'feat') {
                return index;
            }
        }
        return null;
    }

    /**
     * Re-render the current step (called after feat selection)
     */
    async _reRenderStep() {
        const contentArea = document.querySelector('#levelUpModal .modal-body [data-step-content]');
        if (contentArea) {
            // Dispose old listeners
            this.dispose();

            // Re-render
            const html = await this.render();
            contentArea.innerHTML = html;

            // Re-attach listeners
            this.attachListeners(contentArea);
        }
    }

    /**
     * Calculate ASI slots available at this level
     */
    async _calculateASISlots(leveledClasses) {
        const slots = [];

        for (const classInfo of leveledClasses) {
            // Get ASI levels from levelUpService (handles special cases like Fighter)
            const asiLevels = levelUpService._getASILevelsForClass(classInfo.name);
            const currentLevel = classInfo.oldLevel || 0;

            for (let level = currentLevel + 1; level <= classInfo.newLevel; level++) {
                if (asiLevels.includes(level)) {
                    slots.push({
                        class: classInfo.name,
                        level,
                        slotId: `${classInfo.name}_${level}`,
                        feat: false // Can choose feat instead of ASI at this point
                    });
                }
            }
        }

        return slots;
    }

    /**
     * Render a single ASI slot choice
     */
    _renderASISlot(slot, index) {
        const choice = this.session.stepData.asiChoices[index];
        const selectedMode = choice?.mode || 'improvement';

        return `
            <div class="card mb-3 asi-slot-card" data-asi-slot="${index}" data-class-name="${slot.class}" data-level="${slot.level}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="fas fa-star"></i>
                        Ability Score Improvement / Feat
                    </h6>
                    <small class="text-muted">
                        ${slot.class} • Level ${slot.level}
                    </small>
                </div>
                <div class="card-body">
                    <!-- Mode Selection -->
                    <div class="btn-group d-flex w-100 mb-3" role="group">
                        <input 
                            type="radio" 
                            class="btn-check" 
                            name="asi_mode_${index}"
                            id="asi_improvement_${index}"
                            value="improvement"
                            data-asi-mode-toggle
                            data-asi-slot-index="${index}"
                            ${selectedMode === 'improvement' ? 'checked' : ''}
                        >
                        <label class="btn btn-outline-secondary w-50" for="asi_improvement_${index}">
                            <i class="fas fa-plus"></i> Ability Improvement
                        </label>

                        <input 
                            type="radio" 
                            class="btn-check" 
                            name="asi_mode_${index}"
                            id="asi_feat_${index}"
                            value="feat"
                            data-asi-mode-toggle
                            data-asi-slot-index="${index}"
                            ${selectedMode === 'feat' ? 'checked' : ''}
                        >
                        <label class="btn btn-outline-secondary w-50" for="asi_feat_${index}">
                            <i class="fas fa-scroll"></i> Select Feat
                        </label>
                    </div>

                    <!-- Ability Score Improvements -->
                    <div data-improvement-options class="${selectedMode === 'feat' ? 'd-none' : ''}">
                        ${this._renderASIOptions(index, choice)}
                    </div>

                    <!-- Feat Selection -->
                    <div data-feat-options class="${selectedMode === 'feat' ? '' : 'd-none'}">
                        ${this._renderFeatOptions(index, choice)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render ASI options (+2 to one or +1 to two)
     */
    _renderASIOptions(slotIndex, choice) {
        const asiMode = choice?.asiMode || 'plus2'; // 'plus2' or 'plus1plus1'
        const ability1 = choice?.ability1 || '';
        const ability2 = choice?.ability2 || '';

        return `
            <!-- ASI Mode Selection -->
            <div class="btn-group d-flex w-100 mb-3" role="group">
                <input 
                    type="radio" 
                    class="btn-check" 
                    name="asi_points_${slotIndex}"
                    id="asi_plus2_${slotIndex}"
                    value="plus2"
                    data-asi-points-toggle
                    data-asi-slot-index="${slotIndex}"
                    ${asiMode === 'plus2' ? 'checked' : ''}
                >
                <label class="btn btn-outline-secondary btn-sm w-50" for="asi_plus2_${slotIndex}">
                    +2 to one ability
                </label>

                <input 
                    type="radio" 
                    class="btn-check" 
                    name="asi_points_${slotIndex}"
                    id="asi_plus1plus1_${slotIndex}"
                    value="plus1plus1"
                    data-asi-points-toggle
                    data-asi-slot-index="${slotIndex}"
                    ${asiMode === 'plus1plus1' ? 'checked' : ''}
                >
                <label class="btn btn-outline-secondary btn-sm w-50" for="asi_plus1plus1_${slotIndex}">
                    +1 to two abilities
                </label>
            </div>

            <!-- +2 to One Ability -->
            <div data-plus2-options class="${asiMode === 'plus1plus1' ? 'd-none' : ''}">
                <label class="form-label small text-muted">Choose one ability to increase by +2:</label>
                <div class="row g-2">
                    ${ABILITY_NAMES.map(ability => {
            const abbr = ability.substring(0, 3).toUpperCase();
            const isSelected = asiMode === 'plus2' && ability1 === ability;
            return `
                            <div class="col-6 col-md-4">
                                <button 
                                    type="button"
                                    class="btn btn-outline-secondary w-100 ${isSelected ? 'active' : ''}"
                                    data-ability-plus2="${ability}"
                                    data-asi-slot-index="${slotIndex}"
                                >
                                    <strong>${abbr}</strong>
                                    <div class="small">${ability}</div>
                                    <div class="small text-primary">+2</div>
                                </button>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>

            <!-- +1 to Two Abilities -->
            <div data-plus1plus1-options class="${asiMode === 'plus2' ? 'd-none' : ''}">
                <label class="form-label small text-muted">Choose two different abilities to increase by +1 each:</label>
                <div class="row g-2 mb-2">
                    ${ABILITY_NAMES.map(ability => {
            const abbr = ability.substring(0, 3).toUpperCase();
            const isFirst = asiMode === 'plus1plus1' && ability1 === ability;
            const isSecond = asiMode === 'plus1plus1' && ability2 === ability;
            const isSelected = isFirst || isSecond;
            return `
                            <div class="col-6 col-md-4">
                                <button 
                                    type="button"
                                    class="btn btn-outline-secondary w-100 ${isSelected ? 'active' : ''}"
                                    data-ability-plus1="${ability}"
                                    data-asi-slot-index="${slotIndex}"
                                >
                                    <strong>${abbr}</strong>
                                    <div class="small">${ability}</div>
                                    <div class="small text-success">+1</div>
                                </button>
                            </div>
                        `;
        }).join('')}
                </div>
                ${asiMode === 'plus1plus1' && ability1 && ability2 ?
                `<div class="alert alert-success small py-2 mb-0">
                        <i class="fas fa-check"></i> ${ability1} +1, ${ability2} +1
                    </div>` :
                asiMode === 'plus1plus1' ?
                    `<div class="alert alert-info small py-2 mb-0">
                            <i class="fas fa-info-circle"></i> Select two different abilities
                        </div>` : ''
            }
            </div>

            ${this._renderASISelectionSummary(slotIndex, choice)}
        `;
    }

    /**
     * Render the selected ASI summary
     */
    _renderASISelectionSummary(_slotIndex, choice) {
        if (choice?.mode !== 'improvement') return '';

        const asiMode = choice?.asiMode || 'plus2';
        const ability1 = choice?.ability1;
        const ability2 = choice?.ability2;

        if (asiMode === 'plus2' && ability1) {
            return `
                <div class="mt-3 p-2 bg-light rounded" data-asi-summary>
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>Selected:</strong> ${ability1} +2
                        </div>
                    </div>
                </div>
            `;
        } else if (asiMode === 'plus1plus1' && ability1 && ability2) {
            return `
                <div class="mt-3 p-2 bg-light rounded" data-asi-summary>
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>Selected:</strong> ${ability1} +1, ${ability2} +1
                        </div>
                    </div>
                </div>
            `;
        }

        return '';
    }

    /**
     * Render feat selection button and display
     */
    _renderFeatOptions(slotIndex, choice) {
        const selectedFeat = choice?.feat;
        const feat = selectedFeat ? featService.getFeat(selectedFeat) : null;

        if (feat) {
            // Show selected feat with edit button
            const description = Array.isArray(feat.entries) && feat.entries.length > 0
                ? (typeof feat.entries[0] === 'string' ? feat.entries[0] : 'See feat details')
                : 'See feat details';

            return `
                <div class="selected-feat-display">
                    <div class="card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <h6 class="mb-1">${this._escapeHtml(feat.name)}</h6>
                                    <p class="small text-muted mb-0">${this._escapeHtml(description.substring(0, 150))}${description.length > 150 ? '...' : ''}</p>
                                </div>
                            </div>
                            <button 
                                type="button" 
                                class="btn btn-sm btn-outline-primary w-100"
                                data-select-feat
                                data-asi-slot-index="${slotIndex}"
                            >
                                <i class="fas fa-edit"></i> Change Feat
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Show select feat button
            return `
                <div class="text-center">
                    <button 
                        type="button" 
                        class="btn btn-primary"
                        data-select-feat
                        data-asi-slot-index="${slotIndex}"
                    >
                        <i class="fas fa-scroll"></i> Select a Feat
                    </button>
                    <p class="text-muted small mt-2 mb-0">Browse and choose from available feats</p>
                </div>
            `;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Cleanup on modal close
     */
    dispose() {
        this._cleanup.cleanup();
    }
}
