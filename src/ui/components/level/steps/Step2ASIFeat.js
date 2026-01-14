import { ABILITY_NAMES } from '../../../../lib/5eToolsParser.js';
import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { featService } from '../../../../services/FeatService.js';
import { levelUpService } from '../../../../services/LevelUpService.js';
import { sourceService } from '../../../../services/SourceService.js';

/**
 * Step 2: ASI/Feat Selection
 * 
 * Choose ability score improvements or feats for any ASI slots available.
 * Handles ability score selections, feat choices, and half-feats.
 */

export class Step2ASIFeat {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();

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
                    <h5 class="mb-3"><i class="fas fa-trophy"></i> Ability Score Improvements & Feats</h5>
                    <div class="alert alert-info mb-0">
                        <i class="fas fa-info-circle"></i>
                        No ability score improvements or feats available at this level.
                    </div>
                </div>
            `;
        }

        let html = `
            <div class="step-2-asi-feat">
                <h5 class="mb-3"><i class="fas fa-trophy"></i> Ability Score Improvements & Feats</h5>
                <div class="alert alert-info small mb-3">
                    <i class="fas fa-info-circle"></i>
                    Choose to increase ability scores or select a feat for each available ASI slot.
                </div>
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
        // Handle ASI choice mode selection (improvement vs feat)
        const modeToggle = contentArea.querySelectorAll('[data-asi-mode-toggle]');
        modeToggle.forEach((toggle) => {
            this._cleanup.on(toggle, 'change', (e) => {
                const slotIndex = e.target.dataset.asiSlotIndex;
                const mode = e.target.value;

                // Update UI visibility
                const slotCard = contentArea.querySelector(`[data-asi-slot="${slotIndex}"]`);
                const improvementOptions = slotCard.querySelector('[data-improvement-options]');
                const featOptions = slotCard.querySelector('[data-feat-options]');

                if (mode === 'improvement') {
                    improvementOptions?.classList.remove('d-none');
                    featOptions?.classList.add('d-none');
                } else {
                    improvementOptions?.classList.add('d-none');
                    featOptions?.classList.remove('d-none');
                }

                // Store selection
                this.session.stepData.asiChoices[slotIndex] = { mode, value: null };
            });
        });

        // Handle ability score improvements
        const improvementBtns = contentArea.querySelectorAll('[data-ability-improve]');
        improvementBtns.forEach((btn) => {
            this._cleanup.on(btn, 'click', () => {
                const slotIndex = btn.dataset.asiSlotIndex;
                const ability = btn.dataset.ability;
                const slotCard = contentArea.querySelector(`[data-asi-slot="${slotIndex}"]`);

                // Visual feedback
                slotCard.querySelectorAll('[data-ability-improve]').forEach((b) => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');

                // Store selection
                if (!this.session.stepData.asiChoices[slotIndex]) {
                    this.session.stepData.asiChoices[slotIndex] = { mode: 'improvement' };
                }
                this.session.stepData.asiChoices[slotIndex].value = ability;
            });
        });

        // Handle feat selection
        const featRadios = contentArea.querySelectorAll('input[type="radio"][data-feat-select]');
        featRadios.forEach((radio) => {
            this._cleanup.on(radio, 'change', (e) => {
                const slotIndex = e.target.dataset.asiSlotIndex;
                const featId = e.target.value;

                // Store selection
                if (!this.session.stepData.asiChoices[slotIndex]) {
                    this.session.stepData.asiChoices[slotIndex] = { mode: 'feat' };
                }
                this.session.stepData.asiChoices[slotIndex].value = featId;
            });
        });

        // Restore previous selections
        Object.entries(this.session.stepData.asiChoices).forEach(([slotIndex, choice]) => {
            const slotCard = contentArea.querySelector(`[data-asi-slot="${slotIndex}"]`);
            if (!slotCard) return;

            const modeRadio = slotCard.querySelector(
                `input[type="radio"][value="${choice.mode}"]`
            );
            if (modeRadio) {
                modeRadio.click();

                if (choice.mode === 'improvement' && choice.value) {
                    const btn = slotCard.querySelector(
                        `[data-ability-improve="${choice.value}"]`
                    );
                    if (btn) btn.click();
                } else if (choice.mode === 'feat' && choice.value) {
                    const radio = slotCard.querySelector(
                        `input[value="${choice.value}"]`
                    );
                    if (radio) radio.checked = true;
                }
            }
        });
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
            <div class="card mb-3 asi-slot-card" data-asi-slot="${index}">
                <div class="card-header">
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
                    <div class="btn-group w-100 mb-3" role="group">
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
                        <label class="btn btn-outline-primary" for="asi_improvement_${index}">
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
                        <label class="btn btn-outline-success" for="asi_feat_${index}">
                            <i class="fas fa-scroll"></i> Select Feat
                        </label>
                    </div>

                    <!-- Ability Score Improvements -->
                    <div data-improvement-options class="${selectedMode === 'feat' ? 'd-none' : ''}">
                        <div class="row g-2">
                            ${ABILITY_NAMES
                .map(ability => {
                    const abbr = ability.substring(0, 3).toUpperCase();
                    const isSelected = choice?.mode === 'improvement' && choice?.value === ability;
                    return `
                                        <div class="col-6 col-md-4">
                                            <button 
                                                type="button"
                                                class="btn btn-outline-secondary w-100 ${isSelected ? 'active' : ''}"
                                                data-ability-improve="${ability}"
                                                data-asi-slot-index="${index}"
                                            >
                                                <strong>${abbr}</strong>
                                                <div class="small">${ability}</div>
                                                <div class="small">+2</div>
                                            </button>
                                        </div>
                                    `;
                }).join('')}
                        </div>
                    </div>

                    <!-- Feat Selection -->
                    <div data-feat-options class="${selectedMode === 'feat' ? '' : 'd-none'}">
                        <div class="feat-list">
                            <p class="text-muted small mb-2">Select a feat (placeholder options shown):</p>
                            ${this._renderFeatOptions(index, choice?.value)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render available feats for selection
     */
    _renderFeatOptions(slotIndex, selectedFeat) {
        // Load all feats from FeatService and filter by allowed sources
        const allFeats = featService.getAllFeats();
        const availableFeats = allFeats.filter(feat =>
            sourceService.isSourceAllowed(feat.source)
        );

        // Sort alphabetically by name
        availableFeats.sort((a, b) => a.name.localeCompare(b.name));

        return availableFeats.map(feat => {
            // Create safe ID from feat name
            const featId = feat.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

            // Get first entry as short description (if available)
            const description = Array.isArray(feat.entries) && feat.entries.length > 0
                ? (typeof feat.entries[0] === 'string' ? feat.entries[0] : 'See feat details')
                : 'See feat details';

            return `
            <div class="form-check feat-option mb-2">
                <input 
                    class="form-check-input" 
                    type="radio" 
                    name="feat_${slotIndex}"
                    id="feat_${slotIndex}_${featId}"
                    value="${this._escapeHtml(feat.name)}"
                    data-feat-select
                    data-asi-slot-index="${slotIndex}"
                    ${selectedFeat === feat.name ? 'checked' : ''}
                >
                <label class="form-check-label" for="feat_${slotIndex}_${featId}">
                    <strong>${this._escapeHtml(feat.name)}</strong>
                    <div class="small text-muted">${this._escapeHtml(description.substring(0, 100))}${description.length > 100 ? '...' : ''}</div>
                </label>
            </div>
        `;
        }).join('');
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
