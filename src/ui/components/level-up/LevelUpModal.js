/**
 * LevelUpModal - Simplified level picker for character progression
 * 
 * Provides a simple interface to:
 * - Add levels to existing classes
 * - Add new multiclass
 * - Remove the last level
 * 
 * All changes apply immediately to the character (no session/staging).
 * Choices are made on the Build page after leveling up.
 */

import { AppState } from '../../../app/AppState.js';
import { Modal } from '../../../app/Modal.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { levelUpService } from '../../../services/LevelUpService.js';

export class LevelUpModal {
    constructor() {
        this.modalEl = null;
        this.bootstrapModal = null;
        this._cleanup = DOMCleanup.create();

        console.debug('[LevelUpModal]', 'Constructor initialized');
    }

    /**
     * Show the modal with current character progression.
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

            console.debug('[LevelUpModal]', 'Opening for character', character.name);

            // Get modal element
            this.modalEl = document.getElementById('levelUpModal');
            if (!this.modalEl) {
                console.error('[LevelUpModal]', 'Modal element #levelUpModal not found in DOM');
                showNotification('Could not open level up modal', 'error');
                return;
            }

            // Fresh cleanup instance
            this._cleanup = DOMCleanup.create();

            // Initialize Bootstrap modal
            this._initializeBootstrapModal();

            // Render the level picker
            await this._renderLevelPicker();

            // Show modal
            this.bootstrapModal.show();

        } catch (error) {
            console.error('[LevelUpModal]', 'Failed to show modal', error);
            showNotification('Failed to open level up modal', 'error');
        }
    }

    /**
     * Hide the modal.
     */
    async hide() {
        if (!this.bootstrapModal) return;
        this.bootstrapModal.hide();
    }

    /**
     * Clean up modal and listeners when hidden.
     */
    _onModalHidden() {
        console.debug('[LevelUpModal]', 'Modal hidden');
        this._cleanup.cleanup();
    }

    /**
     * Initialize Bootstrap modal instance.
     * @private
     */
    _initializeBootstrapModal() {
        // Dispose old instance if exists
        if (this.bootstrapModal) {
            try {
                if (typeof this.bootstrapModal.dispose === 'function') {
                    this.bootstrapModal.dispose();
                }
            } catch (e) {
                console.warn('[LevelUpModal]', 'Error disposing old modal', e);
            }
            this.bootstrapModal = null;
        }

        // Create new instance
        const bs = window.bootstrap || globalThis.bootstrap;
        if (!bs) {
            throw new Error('Bootstrap not found on window');
        }

        this.bootstrapModal = new bs.Modal(this.modalEl);

        // Register cleanup
        this._cleanup.registerBootstrapModal(this.modalEl, this.bootstrapModal);

        // Setup hide listener for cleanup
        this._cleanup.once(this.modalEl, 'hidden.bs.modal', () => this._onModalHidden());
    }

    /**
     * Render the level picker UI.
     * @private
     */
    async _renderLevelPicker() {
        const character = AppState.getCurrentCharacter();
        const contentArea = this.modalEl.querySelector('.modal-body');
        if (!contentArea) {
            console.warn('[LevelUpModal]', 'Modal body not found');
            return;
        }

        const totalLevel = levelUpService.getTotalLevel(character);
        const classes = character.progression?.classes || [];

        // Build class breakdown with cards in two columns
        let classBreakdown = '';
        if (classes.length > 0) {
            classBreakdown = '<div class="row g-3">';
            for (const cls of classes) {
                classBreakdown += `
                    <div class="col-6">
                        <div class="class-level-card h-100">
                            <div class="class-info">
                                <div>
                                    <div class="class-name">${cls.name}</div>
                                    <small class="text-muted">Class Level ${cls.levels || 0}</small>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-primary" data-add-level="${cls.name}">
                                <i class="fas fa-plus"></i> Add Level
                            </button>
                        </div>
                    </div>
                `;
            }
            classBreakdown += '</div>';
        }

        // Get multiclass options - check for ignore restrictions preference
        const ignoreRestrictions = this._ignoreRestrictions || false;
        const multiclassOptions = levelUpService.getMulticlassOptions(character, ignoreRestrictions);
        let multiclassSection = '';
        if (multiclassOptions.length > 0) {
            multiclassSection = `
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h6 class="mb-0"><i class="fas fa-users"></i> Add Class</h6>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="ignoreRestrictionsToggle" ${ignoreRestrictions ? 'checked' : ''}>
                            <label class="form-check-label" for="ignoreRestrictionsToggle">Ignore Restrictions</label>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="d-flex gap-2">
                            <select class="form-select" id="multiclassSelect">
                                <option value="">Choose a class...</option>
                                ${multiclassOptions.map(opt => `
                                    <option value="${opt.name}" ${!opt.meetsRequirements && !ignoreRestrictions ? 'disabled' : ''}>
                                        ${opt.name}${opt.requirementText ? ` (${opt.requirementText})` : ''}
                                    </option>
                                `).join('')}
                            </select>
                            <button class="btn btn-primary" id="addMulticlassBtn" style="white-space: nowrap;">
                                <i class="fas fa-plus"></i> Add Class
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        contentArea.innerHTML = `
            <div class="level-picker">
                <div class="card mb-3">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h6 class="mb-0"><i class="fas fa-scroll"></i> Your Classes</h6>
                        <div>
                            <small class="text-muted me-2">Character Level</small>
                            <span class="badge bg-primary">${totalLevel}</span>
                        </div>
                    </div>
                    <div class="card-body">
                        ${classBreakdown || '<p class="text-muted text-center mb-0">No classes yet</p>'}
                    </div>
                    ${classes.length > 0 ? `
                    <div class="card-footer text-center">
                        <button class="btn btn-outline-danger btn-sm" id="removeLastLevelBtn">
                            <i class="fas fa-minus"></i> Remove Last Level
                        </button>
                    </div>
                    ` : ''}
                </div>
                
                ${multiclassSection}
            </div>
        `;

        // Attach listeners
        this._attachLevelPickerListeners();
    }

    /**
     * Attach event listeners to level picker buttons.
     * @private
     */
    _attachLevelPickerListeners() {
        // Add level buttons for existing classes
        const addLevelButtons = this.modalEl.querySelectorAll('[data-add-level]');
        addLevelButtons.forEach(btn => {
            const className = btn.dataset.addLevel;
            this._cleanup.on(btn, 'click', async () => {
                await this._addClassLevel(className);
            });
        });

        // Ignore restrictions toggle
        const ignoreRestrictionsToggle = this.modalEl.querySelector('#ignoreRestrictionsToggle');
        if (ignoreRestrictionsToggle) {
            this._cleanup.on(ignoreRestrictionsToggle, 'change', () => {
                this._ignoreRestrictions = ignoreRestrictionsToggle.checked;
                this._renderLevelPicker(); // Re-render to update options
            });
        }

        // Add class button
        const addMulticlassBtn = this.modalEl.querySelector('#addMulticlassBtn');
        const multiclassSelect = this.modalEl.querySelector('#multiclassSelect');
        if (addMulticlassBtn && multiclassSelect) {
            this._cleanup.on(addMulticlassBtn, 'click', async () => {
                const className = multiclassSelect.value;
                if (!className) {
                    showNotification('Please select a class', 'warning');
                    return;
                }
                await this._addMulticlass(className);
            });
        }

        // Remove last level button
        const removeLastLevelBtn = this.modalEl.querySelector('#removeLastLevelBtn');
        if (removeLastLevelBtn) {
            this._cleanup.on(removeLastLevelBtn, 'click', async () => {
                await this._removeLastLevel();
            });
        }
    }

    /**
     * Add a level to an existing class.
     * @private
     */
    async _addClassLevel(className) {
        const character = AppState.getCurrentCharacter();
        if (!character) return;

        try {
            // Find the class in progression
            const classEntry = character.progression.classes.find(c => c.name === className);
            if (!classEntry) {
                showNotification(`Class ${className} not found`, 'error');
                return;
            }

            // Increment level
            const newLevel = (classEntry.levels || 0) + 1;
            levelUpService.addClassLevel(character, className, newLevel);

            // Update character and emit event
            AppState.setCurrentCharacter(character, { skipEvent: true });
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });

            showNotification(`Added level to ${className}!`, 'success');

            // Re-render picker
            await this._renderLevelPicker();

        } catch (error) {
            console.error('[LevelUpModal]', 'Failed to add level', error);
            showNotification(`Failed to add level: ${error.message}`, 'error');
        }
    }

    /**
     * Add a new multiclass.
     * @private
     */
    async _addMulticlass(className) {
        const character = AppState.getCurrentCharacter();
        if (!character) return;

        try {
            // Check multiclass requirements (unless ignoring restrictions)
            if (!this._ignoreRestrictions && !levelUpService.checkMulticlassRequirements(character, className)) {
                showNotification(`You don't meet the requirements for ${className}`, 'warning');
                return;
            }

            // Add the class at level 1
            levelUpService.addClassLevel(character, className, 1);

            // Create progression history entry to track when this class was added
            if (!character.progressionHistory) {
                character.progressionHistory = {};
            }
            if (!character.progressionHistory[className]) {
                character.progressionHistory[className] = {};
            }
            character.progressionHistory[className]['1'] = {
                choices: {},
                timestamp: new Date().toISOString(),
            };

            // Update character and emit event
            AppState.setCurrentCharacter(character, { skipEvent: true });
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
            eventBus.emit(EVENTS.MULTICLASS_ADDED, character, { name: className });

            showNotification(`Added ${className} class!`, 'success');

            // Re-render picker
            await this._renderLevelPicker();

        } catch (error) {
            console.error('[LevelUpModal]', 'Failed to add multiclass', error);
            showNotification(`Failed to add multiclass: ${error.message}`, 'error');
        }
    }

    /**
     * Remove the last level from the character.
     * @private
     */
    async _removeLastLevel() {
        const character = AppState.getCurrentCharacter();
        if (!character) return;

        // Show confirmation
        const modal = Modal.getInstance();
        const confirmed = await modal.showConfirmationModal({
            title: 'Remove Level',
            message: 'Are you sure you want to remove the last level? This cannot be undone.',
            confirmButtonText: 'Remove',
            cancelButtonText: 'Cancel',
            confirmButtonClass: 'btn-danger',
        });

        if (!confirmed) return;

        try {
            const classes = character.progression?.classes || [];
            if (classes.length === 0) {
                showNotification('No classes to remove', 'warning');
                return;
            }

            // Determine which class was added last by checking progression history timestamps
            let lastClassName = null;
            let lastTimestamp = null;
            let lastLevel = null;

            if (character.progressionHistory) {
                // Find the most recent timestamp across all classes
                for (const className of Object.keys(character.progressionHistory)) {
                    const classHistory = character.progressionHistory[className];
                    for (const level of Object.keys(classHistory)) {
                        const entry = classHistory[level];
                        if (entry.timestamp && (!lastTimestamp || entry.timestamp > lastTimestamp)) {
                            lastTimestamp = entry.timestamp;
                            lastClassName = className;
                            lastLevel = Number.parseInt(level, 10);
                        }
                    }
                }
            }

            // Fallback: if no progression history, find class with highest level
            if (!lastClassName) {
                let highestLevel = 0;
                for (const cls of classes) {
                    if ((cls.levels || 0) > highestLevel) {
                        highestLevel = cls.levels || 0;
                        lastClassName = cls.name;
                        lastLevel = cls.levels;
                    }
                }
            }

            if (!lastClassName) {
                showNotification('Could not determine last level', 'error');
                return;
            }

            const classEntry = classes.find(c => c.name === lastClassName);
            if (!classEntry) {
                showNotification('Class not found', 'error');
                return;
            }

            // Remove level from progression history if it exists
            if (character.progressionHistory?.[lastClassName]?.[lastLevel]) {
                delete character.progressionHistory[lastClassName][lastLevel];
                // Clean up empty class history
                if (Object.keys(character.progressionHistory[lastClassName]).length === 0) {
                    delete character.progressionHistory[lastClassName];
                }
            }

            // Remove level
            if (classEntry.levels <= 1) {
                // Remove entire class if at level 1
                levelUpService.removeClassLevel(character, lastClassName);
                eventBus.emit(EVENTS.MULTICLASS_REMOVED, character, classEntry);
                showNotification(`Removed ${lastClassName} class`, 'success');
            } else {
                // Just decrement level
                levelUpService.addClassLevel(character, lastClassName, classEntry.levels - 1);
                showNotification(`Removed level from ${lastClassName}`, 'success');
            }

            // Update character and emit event
            AppState.setCurrentCharacter(character, { skipEvent: true });
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });

            // Re-render picker
            await this._renderLevelPicker();

        } catch (error) {
            console.error('[LevelUpModal]', 'Failed to remove level', error);
            showNotification(`Failed to remove level: ${error.message}`, 'error');
        }
    }
}
