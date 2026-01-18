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

            console.info('[LevelUpModal]', 'Opening for character', character.name);

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

        // Build class breakdown
        let classBreakdown = '';
        for (const cls of classes) {
            classBreakdown += `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <strong>${cls.name}</strong>
                        <span class="badge bg-secondary ms-2">Level ${cls.levels || 0}</span>
                    </div>
                    <button class="btn btn-sm btn-primary" data-add-level="${cls.name}">
                        <i class="fas fa-plus"></i> Add Level
                    </button>
                </div>
            `;
        }

        // Get multiclass options
        const multiclassOptions = levelUpService.getMulticlassOptions(character);
        let multiclassSection = '';
        if (multiclassOptions.length > 0) {
            multiclassSection = `
                <div class="mt-4">
                    <h6>Add Multiclass</h6>
                    <select class="form-select" id="multiclassSelect">
                        <option value="">Choose a class...</option>
                        ${multiclassOptions.map(opt => `
                            <option value="${opt.name}" ${!opt.meetsRequirements ? 'disabled' : ''}>
                                ${opt.name} ${!opt.meetsRequirements ? '(Requirements not met)' : ''}
                            </option>
                        `).join('')}
                    </select>
                    <button class="btn btn-secondary mt-2" id="addMulticlassBtn">
                        <i class="fas fa-plus"></i> Add Multiclass
                    </button>
                </div>
            `;
        }

        contentArea.innerHTML = `
            <div class="level-picker">
                <div class="mb-3">
                    <h5>Current Level: ${totalLevel}</h5>
                </div>
                
                <div class="mb-4">
                    <h6>Your Classes</h6>
                    ${classBreakdown}
                </div>
                
                ${multiclassSection}
                
                <div class="mt-4">
                    <button class="btn btn-outline-danger btn-sm" id="removeLastLevelBtn" ${classes.length === 0 ? 'disabled' : ''}>
                        <i class="fas fa-minus"></i> Remove Last Level
                    </button>
                </div>
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

        // Add multiclass button
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
            // Check multiclass requirements
            if (!levelUpService.canMulticlass(character, className)) {
                showNotification(`You don't meet the requirements for ${className}`, 'warning');
                return;
            }

            // Add the class at level 1
            levelUpService.addClassLevel(character, className, 1);

            // Update character and emit event
            AppState.setCurrentCharacter(character, { skipEvent: true });
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
            eventBus.emit(EVENTS.MULTICLASS_ADDED, character, { name: className });

            showNotification(`Added ${className} multiclass!`, 'success');

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

            // Find the last class leveled (highest level)
            let lastClass = null;
            let highestLevel = 0;
            for (const cls of classes) {
                if ((cls.levels || 0) > highestLevel) {
                    highestLevel = cls.levels || 0;
                    lastClass = cls;
                }
            }

            if (!lastClass) {
                showNotification('Could not determine last level', 'error');
                return;
            }

            // Remove level
            if (lastClass.levels <= 1) {
                // Remove entire class if at level 1
                levelUpService.removeClassLevel(character, lastClass.name);
                eventBus.emit(EVENTS.MULTICLASS_REMOVED, character, lastClass);
            } else {
                // Just decrement level
                levelUpService.addClassLevel(character, lastClass.name, lastClass.levels - 1);
            }

            // Update character and emit event
            AppState.setCurrentCharacter(character, { skipEvent: true });
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });

            showNotification(`Removed level from ${lastClass.name}`, 'success');

            // Re-render picker
            await this._renderLevelPicker();

        } catch (error) {
            console.error('[LevelUpModal]', 'Failed to remove level', error);
            showNotification(`Failed to remove level: ${error.message}`, 'error');
        }
    }
}
