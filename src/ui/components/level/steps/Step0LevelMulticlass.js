/**
 * Step 0: Level & Multiclass
 * 
 * User selects which classes to level up and optionally adds new classes.
 * Supports multiclass leveling in a single session.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { classService } from '../../../../services/ClassService.js';

export class Step0LevelMulticlass {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
        this.selectedClassName = null;
    }

    /**
     * Render the step HTML.
     * Returns HTML string (not inserted into DOM yet).
     */
    async render() {
        const classes = this.session.stagedChanges.classes || [];
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
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-user-plus"></i> Add Multiclass (Optional)</h6>
                    </div>
                    <div class="card-body">
                        <div class="input-group">
                            <select class="form-select" id="multiclassSelect">
                                <option value="">Select a class...</option>
        `;

        // Render available classes dropdown
        availableClasses.forEach(className => {
            html += `<option value="${className}">${className}</option>`;
        });

        html += `
                            </select>
                            <button class="btn btn-outline-primary" id="addMulticlassBtn" type="button">
                                <i class="fas fa-plus"></i> Add Class
                            </button>
                        </div>
                        <small class="text-muted d-block mt-2">
                            Add a new class at level 1 for multiclassing.
                        </small>
                    </div>
                </div>

                <!-- Summary -->
                <div class="alert alert-info mb-0">
                    <i class="fas fa-info-circle"></i>
                    You can level multiple classes in a single session. Select a class and click 
                    <strong>+</strong> to level it up.
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

                classCards.forEach(c => c.classList.remove('border-primary', 'bg-light'));
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
                const index = parseInt(btn.dataset.classIndex);
                this._handleLevelUp(index);
            });
        });

        // Add Multiclass button
        const addMulticlassBtn = contentArea.querySelector('#addMulticlassBtn');
        if (addMulticlassBtn) {
            this._cleanup.on(addMulticlassBtn, 'click', () => this._handleAddMulticlass(contentArea));
        }
    }

    /**
     * Handle level up for a class.
     * @private
     */
    _handleLevelUp(classIndex) {
        const classes = this.session.stagedChanges.classes;
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

        // Re-render to show changes
        this.modal.nextStep();
        this.modal.previousStep();
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
        const classes = this.session.stagedChanges.classes;
        if (classes.some(c => c.name === className)) {
            alert(`Already has ${className}`);
            return;
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

        // Re-render
        this.modal.nextStep();
        this.modal.previousStep();
    }

    /**
     * Get list of available classes for multiclassing.
     * @private
     */
    _getAvailableClasses() {
        const allClasses = classService.getAllClasses();
        const currentClassNames = this.session.stagedChanges.classes.map(c => c.name);
        return allClasses.filter(c => !currentClassNames.includes(c.name)).map(c => c.name);
    }
}
