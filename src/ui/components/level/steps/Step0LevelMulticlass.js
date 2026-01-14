/**
 * Step 0: Level & Multiclass
 * 
 * User selects which classes to level up and optionally adds new classes.
 * Supports multiclass leveling in a single session.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { levelUpService } from '../../../../services/LevelUpService.js';

export class Step0LevelMulticlass {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
        this.selectedClassName = null;
        this.ignoreMulticlassReqs = false; // Default: enforce requirements
    }

    /**
     * Render the step HTML.
     * Returns HTML string (not inserted into DOM yet).
     */
    async render() {
        const classes = this.session.stagedChanges.progression?.classes || [];
        const totalLevel = this.session.stagedChanges.level || 1;

        // Get available classes for multiclass
        const availableClasses = this._getAvailableClasses();

        let html = `
            <div class="step-0-level-multiclass">
                <h5 class="mb-3"><i class="fas fa-level-up-alt"></i> Level & Multiclass</h5>

                <!-- Class Breakdown -->
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-users"></i> Your Classes</h6>
                    </div>
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <p class="text-muted small mb-0">
                                <i class="fas fa-hand-pointer"></i> Click a class to select it for leveling
                            </p>
                            <span class="badge bg-primary fs-6">
                                Total Level: <strong>${totalLevel}</strong>
                            </span>
                        </div>

                        <div class="row" id="classBreakdown">
        `;

        // Render each class card
        classes.forEach((classInfo, index) => {
            const levelLabel = classInfo.levels === 1 ? 'level' : 'levels';
            const isSelected = this.selectedClassName === classInfo.name;
            const selectedClass = isSelected ? 'border-primary bg-light' : '';

            html += `
                <div class="col-md-6 mb-2">
                    <div class="card class-card cursor-pointer ${selectedClass}" 
                         data-class-index="${index}" 
                         data-class-name="${classInfo.name}">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-1">${classInfo.name}</h6>
                                    <small class="text-muted">${classInfo.levels} ${levelLabel}</small>
                                </div>
                                <div class="text-end">
                                    <button class="btn btn-sm btn-outline-primary level-up-btn" 
                                            data-class-index="${index}" 
                                            title="Level up ${classInfo.name}">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                        </div>
                    </div>
                </div>

                <!-- Add Multiclass -->
                <div class="card mb-3">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h6 class="mb-0"><i class="fas fa-user-plus"></i> Add Multiclass (Optional)</h6>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="ignoreMulticlassReqs" ${this.ignoreMulticlassReqs ? 'checked' : ''}>
                            <label class="form-check-label small" for="ignoreMulticlassReqs" title="Toggle to ignore ability score requirements for multiclassing">
                                Ignore Requirements
                            </label>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="input-group">
                            <select class="form-select" id="multiclassSelect">
                                <option value="">Select a class...</option>
        `;

        // Render available classes dropdown with requirements
        availableClasses.forEach(option => {
            const disabled = !option.meetsRequirements && !this.ignoreMulticlassReqs ? 'disabled' : '';
            const reqText = !option.meetsRequirements && !this.ignoreMulticlassReqs ? ` (${option.requirementText})` : '';
            html += `<option value="${option.name}" ${disabled}>${option.name}${reqText}</option>`;
        });

        html += `
                            </select>
                            <button class="btn btn-outline-primary" id="addMulticlassBtn" type="button">
                                <i class="fas fa-plus"></i> Add Class
                            </button>
                        </div>
                        ${!this.ignoreMulticlassReqs && availableClasses.some(o => !o.meetsRequirements) ?
                '<small class="text-muted d-block mt-2"><i class="fas fa-info-circle"></i> Some classes require minimum ability scores</small>' :
                '<small class="text-muted d-block mt-2">Add a new class at level 1 for multiclassing.</small>'
            }
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Attach event listeners to rendered content.
     * Called after HTML is inserted into DOM.
     */
    attachListeners(contentArea) {
        console.debug('[Step0]', 'Attaching listeners');

        // Class card selection
        const classCards = contentArea.querySelectorAll('.class-card');
        classCards.forEach(card => {
            this._cleanup.on(card, 'click', (e) => {
                if (e.target.closest('.level-up-btn')) return; // Don't select if clicking level-up button

                // Remove selection from all cards
                for (const c of classCards) {
                    c.classList.remove('border-primary', 'bg-light');
                }
                card.classList.add('border-primary', 'bg-light');
                this.selectedClassName = card.dataset.className;
                console.debug('[Step0]', 'Selected class:', this.selectedClassName);
            });
        });

        // Level Up button
        const levelUpBtns = contentArea.querySelectorAll('.level-up-btn');
        levelUpBtns.forEach(btn => {
            this._cleanup.on(btn, 'click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.classIndex, 10);
                this._handleLevelUp(index);
            });
        });

        // Add Multiclass button
        const addMulticlassBtn = contentArea.querySelector('#addMulticlassBtn');
        if (addMulticlassBtn) {
            this._cleanup.on(addMulticlassBtn, 'click', () => this._handleAddMulticlass(contentArea));
        }

        // Restriction toggle
        const toggleReqs = contentArea.querySelector('#ignoreMulticlassReqs');
        if (toggleReqs) {
            this._cleanup.on(toggleReqs, 'change', () => {
                this.ignoreMulticlassReqs = toggleReqs.checked;
                // Update dropdown options without re-rendering entire step
                this._updateMulticlassDropdown(contentArea);
            });
        }
    }

    /**
     * Update the multiclass dropdown options based on current restriction setting.
     * @private
     */
    _updateMulticlassDropdown(contentArea) {
        const select = contentArea.querySelector('#multiclassSelect');
        if (!select) return;

        // Save current selection
        const currentValue = select.value;

        // Get updated options
        const availableClasses = this._getAvailableClasses();

        // Rebuild options (keep first empty option)
        select.innerHTML = '<option value="">Select a class...</option>';

        availableClasses.forEach(option => {
            const disabled = !option.meetsRequirements && !this.ignoreMulticlassReqs ? 'disabled' : '';
            const reqText = !option.meetsRequirements && !this.ignoreMulticlassReqs ? ` (${option.requirementText})` : '';
            const optionElement = document.createElement('option');
            optionElement.value = option.name;
            optionElement.textContent = `${option.name}${reqText}`;
            if (disabled) optionElement.disabled = true;
            select.appendChild(optionElement);
        });

        // Restore selection if still valid
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue && !opt.disabled)) {
            select.value = currentValue;
        }

        // Update helper text
        const helperText = contentArea.querySelector('.text-muted.d-block.mt-2');
        if (helperText) {
            if (!this.ignoreMulticlassReqs && availableClasses.some(o => !o.meetsRequirements)) {
                helperText.innerHTML = '<i class="fas fa-info-circle"></i> Some classes require minimum ability scores';
            } else {
                helperText.textContent = 'Add a new class at level 1 for multiclassing.';
            }
        }

        console.debug('[Step0]', 'Multiclass dropdown updated', {
            ignoreReqs: this.ignoreMulticlassReqs,
            availableCount: availableClasses.length
        });
    }

    /**
     * Handle level up for a class.
     * @private
     */
    _handleLevelUp(classIndex) {
        const classes = this.session.stagedChanges.progression?.classes || [];
        if (!classes || !classes[classIndex]) return;

        const classInfo = classes[classIndex];
        const newLevel = (classInfo.levels || 1) + 1;

        if (newLevel > 20) {
            alert('Maximum level is 20');
            return;
        }

        // Update staged changes
        classInfo.levels = newLevel;

        // Update total level
        const totalLevel = classes.reduce((sum, c) => sum + (c.levels || 1), 0);
        this.session.stagedChanges.level = totalLevel;

        console.debug('[Step0]', `Leveled ${classInfo.name} to ${newLevel}`, {
            totalLevel,
        });

        // Update DOM without full re-render
        this._updateClassLevelDisplay(classIndex, newLevel, totalLevel);
    }

    /**
     * Update the DOM to reflect level changes without full re-render.
     * @private
     */
    _updateClassLevelDisplay(classIndex, newLevel, totalLevel) {
        // Update the class card level text
        const classCard = document.querySelector(`.class-card[data-class-index="${classIndex}"]`);
        if (classCard) {
            const levelLabel = newLevel === 1 ? 'level' : 'levels';
            const levelText = classCard.querySelector('.text-muted');
            if (levelText) {
                levelText.textContent = `${newLevel} ${levelLabel}`;
            }
        }

        // Update total level badge
        const totalLevelBadge = document.querySelector('.badge.bg-primary strong');
        if (totalLevelBadge) {
            totalLevelBadge.textContent = totalLevel;
        }
    }

    /**
     * Refresh Step 0 by re-rendering it (used for major changes like adding multiclass).
     * @private
     */
    _refreshStep() {
        this.modal._renderStep(0);
    }

    /**
     * Handle adding a new multiclass.
     * @private
     */
    async _handleAddMulticlass(contentArea) {
        const select = contentArea.querySelector('#multiclassSelect');
        const className = select.value;

        if (!className) {
            alert('Please select a class');
            return;
        }

        // Check if already has this class
        const classes = this.session.stagedChanges.progression?.classes || [];
        if (classes.some(c => c.name === className)) {
            alert(`Already has ${className}`);
            return;
        }

        // Check requirements if not ignoring
        if (!this.ignoreMulticlassReqs) {
            const meetsReqs = levelUpService.checkMulticlassRequirements(this.session.originalCharacter, className);
            if (!meetsReqs) {
                alert(`Ability scores do not meet the multiclass requirements for ${className}. Toggle "Ignore Requirements" to override.`);
                return;
            }
        }

        // Add new class at level 1
        classes.push({
            name: className,
            levels: 1,
            subclass: null,
        });

        // Update total level
        const totalLevel = classes.reduce((sum, c) => sum + (c.levels || 1), 0);
        this.session.stagedChanges.level = totalLevel;

        console.debug('[Step0]', `Added ${className}`, { totalLevel });

        // Reset dropdown
        select.value = '';

        // Re-render Step 0 to show changes
        this._refreshStep();
    }

    /**
     * Get list of available classes for multiclassing.
     * @private
     */
    _getAvailableClasses() {
        // Use original character for requirement checking
        return levelUpService.getMulticlassOptions(
            this.session.originalCharacter,
            this.ignoreMulticlassReqs
        );
    }
}
