/** @file Controller for character level progression and multiclass management. */

import { AppState } from '../../core/AppState.js';
import { levelUpService } from '../../services/LevelUpService.js';
import { eventBus, EVENTS } from '../../utils/EventBus.js';
import { showNotification } from '../../utils/Notifications.js';
import { FeatSelectionModal } from '../feats/FeatSelectionModal.js';

/**
 * Manages the character level progression page.
 * Handles level ups, level downs, multiclassing, and feature tracking.
 */
export class LevelController {
    constructor() {
        this.character = null;
        this.featModal = null;
        this._eventHandlers = new Map();
    }

    /**
     * Initialize the level controller.
     * @returns {Promise<void>}
     */
    async init() {
        console.log('[LevelController]', 'Initializing');

        this.character = AppState.getCurrentCharacter();

        if (!this.character) {
            console.warn('[LevelController]', 'No character loaded');
            return;
        }

        // Initialize progression if needed
        levelUpService.initializeProgression(this.character);

        // Setup event listeners
        this._setupEventListeners();

        // Initial render
        await this._renderAll();

        console.log('[LevelController]', 'Initialized');
    }

    /**
     * Cleanup when navigating away from page.
     */
    cleanup() {
        console.log('[LevelController]', 'Cleaning up');
        this._removeEventListeners();
    }

    /**
     * Setup DOM event listeners.
     * @private
     */
    _setupEventListeners() {
        const increaseLevelBtn = document.getElementById('increaseLevelBtn');
        const decreaseLevelBtn = document.getElementById('decreaseLevelBtn');
        const addClassBtn = document.getElementById('addClassBtn');
        const recalculateHPBtn = document.getElementById('recalculateHPBtn');
        const selectFeatBtn = document.getElementById('selectFeatBtn');

        const handleIncreaseLevel = () => this._handleIncreaseLevel();
        const handleDecreaseLevel = () => this._handleDecreaseLevel();
        const handleAddClass = () => this._handleAddClass();
        const handleRecalculateHP = () => this._handleRecalculateHP();
        const handleSelectFeat = () => this._handleSelectFeat();
        const handleCharacterUpdated = () => this._handleCharacterUpdated();

        if (increaseLevelBtn) {
            increaseLevelBtn.addEventListener('click', handleIncreaseLevel);
            this._eventHandlers.set('increaseLevelBtn', {
                element: increaseLevelBtn,
                event: 'click',
                handler: handleIncreaseLevel,
            });
        }

        if (decreaseLevelBtn) {
            decreaseLevelBtn.addEventListener('click', handleDecreaseLevel);
            this._eventHandlers.set('decreaseLevelBtn', {
                element: decreaseLevelBtn,
                event: 'click',
                handler: handleDecreaseLevel,
            });
        }

        if (addClassBtn) {
            addClassBtn.addEventListener('click', handleAddClass);
            this._eventHandlers.set('addClassBtn', {
                element: addClassBtn,
                event: 'click',
                handler: handleAddClass,
            });
        }

        if (recalculateHPBtn) {
            recalculateHPBtn.addEventListener('click', handleRecalculateHP);
            this._eventHandlers.set('recalculateHPBtn', {
                element: recalculateHPBtn,
                event: 'click',
                handler: handleRecalculateHP,
            });
        }

        if (selectFeatBtn) {
            selectFeatBtn.addEventListener('click', handleSelectFeat);
            this._eventHandlers.set('selectFeatBtn', {
                element: selectFeatBtn,
                event: 'click',
                handler: handleSelectFeat,
            });
        }

        // Listen for character updates
        eventBus.on(EVENTS.CHARACTER_UPDATED, handleCharacterUpdated);
        this._eventHandlers.set('CHARACTER_UPDATED', {
            event: EVENTS.CHARACTER_UPDATED,
            handler: handleCharacterUpdated,
            isEventBus: true,
        });
    }

    /**
     * Remove event listeners.
     * @private
     */
    _removeEventListeners() {
        for (const [, { element, event, handler, isEventBus }] of this._eventHandlers) {
            if (isEventBus) {
                eventBus.off(event, handler);
            } else if (element) {
                element.removeEventListener(event, handler);
            }
        }
        this._eventHandlers.clear();
    }

    /**
     * Handle character updated event.
     * @private
     */
    async _handleCharacterUpdated() {
        this.character = AppState.getCurrentCharacter();
        await this._renderAll();
    }

    /**
     * Handle increase level button click.
     * @private
     */
    async _handleIncreaseLevel() {
        if (!this.character) {
            showNotification('No character loaded', 'error');
            return;
        }

        const success = levelUpService.increaseLevel(this.character);

        if (success) {
            // Check if ASI/feat is available at new level
            if (levelUpService.hasASIAvailable(this.character)) {
                showNotification(
                    `Leveled up to ${this.character.level}! Ability Score Improvement available`,
                    'success',
                );
            } else {
                showNotification(`Leveled up to ${this.character.level}!`, 'success');
            }

            // Apply any automatic features
            await this._applyLevelUpFeatures();

            // Update spell slots
            levelUpService.updateSpellSlots(this.character);

            eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);
        }
    }

    /**
     * Handle decrease level button click.
     * @private
     */
    async _handleDecreaseLevel() {
        if (!this.character) {
            showNotification('No character loaded', 'error');
            return;
        }

        // Confirm action
        const confirmed = confirm(
            `Are you sure you want to decrease level from ${this.character.level} to ${this.character.level - 1}?`,
        );

        if (!confirmed) return;

        const success = levelUpService.decreaseLevel(this.character);

        if (success) {
            showNotification(`Leveled down to ${this.character.level}`, 'info');

            // Remove features gained at higher level
            await this._removeLevelDownFeatures();

            // Update spell slots
            levelUpService.updateSpellSlots(this.character);

            eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);
        }
    }

    /**
     * Handle add multiclass button click.
     * @private
     */
    async _handleAddClass() {
        if (!this.character) {
            showNotification('No character loaded', 'error');
            return;
        }

        if (this.character.level >= 20) {
            showNotification('Character is at maximum level', 'warning');
            return;
        }

        // Get available classes
        const availableClasses = levelUpService.getAvailableClassesForMulticlass(
            this.character,
        );

        if (availableClasses.length === 0) {
            showNotification('All classes already selected', 'warning');
            return;
        }

        // Simple prompt for class selection (could be enhanced to a modal)
        const classOptions = availableClasses.join(', ');
        const selectedClass = prompt(
            `Select a class to multiclass into:\n${classOptions}`,
        );

        if (!selectedClass || !availableClasses.includes(selectedClass)) {
            return;
        }

        // Add class level
        levelUpService.addClassLevel(this.character, selectedClass, 1);

        // Increase total level
        levelUpService.increaseLevel(this.character);

        showNotification(`Added ${selectedClass} level 1`, 'success');

        eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);
    }

    /**
     * Handle recalculate HP button click.
     * @private
     */
    _handleRecalculateHP() {
        if (!this.character) {
            showNotification('No character loaded', 'error');
            return;
        }

        const maxHP = levelUpService.calculateMaxHitPoints(this.character);
        this.character.hitPoints = {
            ...this.character.hitPoints,
            max: maxHP,
            current: Math.min(this.character.hitPoints?.current || maxHP, maxHP),
        };

        showNotification(`Hit points recalculated: ${maxHP}`, 'success');

        eventBus.emit(EVENTS.CHARACTER_UPDATED, this.character);
    }

    /**
     * Handle select feat button click.
     * @private
     */
    async _handleSelectFeat() {
        if (!this.character) {
            showNotification('No character loaded', 'error');
            return;
        }

        if (!this.featModal) {
            this.featModal = new FeatSelectionModal();
        }

        await this.featModal.show();
    }

    /**
     * Apply features gained from leveling up.
     * @private
     */
    async _applyLevelUpFeatures() {
        if (!this.character || !this.character.progression) return;

        // Get features for each class at current level
        for (const classEntry of this.character.progression.classes) {
            const features = await levelUpService.getClassFeaturesForLevel(
                classEntry.name,
                classEntry.level,
            );

            // Add new features that aren't already tracked
            for (const feature of features) {
                const exists = classEntry.features.some((f) => f.name === feature.name);
                if (!exists) {
                    classEntry.features.push(feature);
                    console.log('[LevelController]', 'Added feature', feature.name);
                }
            }

            // Add subclass features if subclass is selected
            if (classEntry.subclass) {
                const subclassFeatures =
                    await levelUpService.getSubclassFeaturesForLevel(
                        classEntry.name,
                        classEntry.subclass.name,
                        classEntry.level,
                    );

                for (const feature of subclassFeatures) {
                    const exists = classEntry.features.some((f) => f.name === feature.name);
                    if (!exists) {
                        classEntry.features.push(feature);
                        console.log(
                            '[LevelController]',
                            'Added subclass feature',
                            feature.name,
                        );
                    }
                }
            }
        }
    }

    /**
     * Remove features when leveling down.
     * @private
     */
    async _removeLevelDownFeatures() {
        if (!this.character || !this.character.progression) return;

        // Remove features gained at levels higher than current
        for (const classEntry of this.character.progression.classes) {
            classEntry.features = classEntry.features.filter(
                (f) => f.level <= classEntry.level,
            );
        }
    }

    /**
     * Render all sections of the level page.
     * @private
     */
    async _renderAll() {
        await this._renderLevelOverview();
        await this._renderClassFeatures();
        this._renderHitPoints();
        this._renderASIAvailability();
        this._renderSpellSlots();
    }

    /**
     * Render level overview section.
     * @private
     */
    async _renderLevelOverview() {
        const totalLevelEl = document.getElementById('totalCharacterLevel');
        const classBreakdownEl = document.getElementById('classLevelBreakdown');

        if (!totalLevelEl || !classBreakdownEl) return;

        totalLevelEl.textContent = this.character?.level || 1;

        // Render class breakdown
        if (this.character?.progression?.classes?.length > 0) {
            let html = '<div class="d-flex flex-column gap-2">';

            for (const classEntry of this.character.progression.classes) {
                html += `
                    <div class="d-flex justify-content-between align-items-center p-2 border rounded">
                        <div>
                            <strong>${classEntry.name}</strong>
                            ${classEntry.subclass ? `<span class="text-muted">(${classEntry.subclass.name})</span>` : ''}
                        </div>
                        <div>
                            <span class="badge bg-primary">Level ${classEntry.level}</span>
                            <span class="badge bg-secondary">${classEntry.hitDice}</span>
                        </div>
                    </div>
                `;
            }

            html += '</div>';
            classBreakdownEl.innerHTML = html;
        } else {
            classBreakdownEl.innerHTML =
                '<p class="text-muted">No class selected. Choose a class on the Build page.</p>';
        }
    }

    /**
     * Render class features section.
     * @private
     */
    async _renderClassFeatures() {
        const container = document.getElementById('classFeaturesContainer');
        if (!container) return;

        if (!this.character?.progression?.classes?.length) {
            container.innerHTML = '<p class="text-muted">No classes selected.</p>';
            return;
        }

        let html = '';

        for (const classEntry of this.character.progression.classes) {
            html += `
                <div class="mb-3">
                    <h6 class="fw-bold">${classEntry.name} (Level ${classEntry.level})</h6>
            `;

            if (classEntry.features.length > 0) {
                html += '<ul class="list-group list-group-flush">';
                for (const feature of classEntry.features) {
                    html += `
                        <li class="list-group-item">
                            <strong>${feature.name}</strong>
                            ${feature.level ? `<span class="badge bg-secondary ms-2">Lv ${feature.level}</span>` : ''}
                        </li>
                    `;
                }
                html += '</ul>';
            } else {
                html += '<p class="text-muted">No features yet.</p>';
            }

            html += '</div>';
        }

        container.innerHTML = html;
    }

    /**
     * Render hit points section.
     * @private
     */
    _renderHitPoints() {
        const maxHPEl = document.getElementById('maxHitPoints');
        const hpBreakdownEl = document.getElementById('hpBreakdown');

        if (!maxHPEl || !hpBreakdownEl) return;

        const maxHP = levelUpService.calculateMaxHitPoints(this.character);

        maxHPEl.textContent = maxHP;

        // Build HP breakdown
        let breakdown = '';
        if (this.character?.progression?.classes?.length > 0) {
            for (const classEntry of this.character.progression.classes) {
                breakdown += `${classEntry.name}: ${classEntry.hitDice} × ${classEntry.level}<br>`;
            }
            const conMod = this.character.getAbilityModifier('constitution');
            breakdown += `Constitution modifier: ${conMod >= 0 ? '+' : ''}${conMod} per level`;
        }

        hpBreakdownEl.innerHTML = breakdown;
    }

    /**
     * Render ASI availability section.
     * @private
     */
    _renderASIAvailability() {
        const asiCard = document.getElementById('asiCard');
        if (!asiCard) return;

        const hasASI = levelUpService.hasASIAvailable(this.character);
        asiCard.style.display = hasASI ? 'block' : 'none';
    }

    /**
     * Render spell slots section.
     * @private
     */
    _renderSpellSlots() {
        const spellSlotsCard = document.getElementById('spellSlotsCard');
        const spellSlotsContainer = document.getElementById('spellSlotsContainer');

        if (!spellSlotsCard || !spellSlotsContainer) return;

        if (!this.character?.spellcasting?.classes) {
            spellSlotsCard.style.display = 'none';
            return;
        }

        spellSlotsCard.style.display = 'block';

        let html = '';

        for (const [className, classData] of Object.entries(
            this.character.spellcasting.classes,
        )) {
            if (classData.spellSlots && Object.keys(classData.spellSlots).length > 0) {
                html += `
                    <div class="mb-3">
                        <h6 class="fw-bold">${className}</h6>
                        <div class="d-flex gap-2 flex-wrap">
                `;

                for (const [level, slots] of Object.entries(classData.spellSlots)) {
                    html += `
                        <div class="badge bg-primary">
                            Lv ${level}: ${slots.current}/${slots.max}
                        </div>
                    `;
                }

                html += '</div></div>';
            }
        }

        spellSlotsContainer.innerHTML = html || '<p class="text-muted">No spell slots.</p>';
    }
}
