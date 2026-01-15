import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { classService } from '../../../../services/ClassService.js';
import { LevelUpSpellSelector } from '../LevelUpSpellSelector.js';

/**
 * Step 3: Spell Selection
 * 
 * Select new spells for spellcasting classes via the LevelUpSpellSelector.
 * Orchestrates spell modal interactions while maintaining session state.
 */

export class Step3SpellSelection {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
        this._spellSelector = null; // Will be instantiated when needed

        // Initialize step data if not present
        if (!this.session.stepData.selectedSpells) {
            this.session.stepData.selectedSpells = {};
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

        // Expand into individual levels and group by class
        const levelsByClass = {};
        for (const classInfo of leveledClasses) {
            const classData = classService.getClass(classInfo.name);
            // Only expand for spellcasting classes
            if (classData?.casterProgression) {
                if (!levelsByClass[classInfo.name]) {
                    levelsByClass[classInfo.name] = {
                        className: classInfo.name,
                        minLevel: classInfo.oldLevel + 1,
                        maxLevel: classInfo.newLevel,
                        levels: []
                    };
                }

                for (let level = classInfo.oldLevel + 1; level <= classInfo.newLevel; level++) {
                    levelsByClass[classInfo.name].levels.push({
                        level,
                        oldLevel: level - 1
                    });
                }
            }
        }

        if (Object.keys(levelsByClass).length === 0) {
            return `
                <div class="step-3-spell-selection">
                    <div class="alert alert-info mb-0">
                        <i class="fas fa-info-circle"></i>
                        No new spells available at this level for your selected classes.
                    </div>
                </div>
            `;
        }

        let html = `
            <div class="step-3-spell-selection">
                <div class="spell-selection-container">
        `;

        const classGroups = Object.values(levelsByClass);

        // If only one class, render spell levels individually without grouping
        if (classGroups.length === 1) {
            const singleClass = classGroups[0];
            for (const levelInfo of singleClass.levels) {
                html += this._renderIndividualSpellLevel(singleClass.className, levelInfo, singleClass.maxLevel);
            }
        } else {
            // Multiple classes: render one card per class
            for (const classGroup of classGroups) {
                html += this._renderSpellcastingClass(classGroup);
            }
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }

    attachListeners(contentArea) {
        // Handle spell selection button clicks
        const spellButtons = contentArea.querySelectorAll('[data-open-spell-selector]');
        spellButtons.forEach((btn) => {
            this._cleanup.on(btn, 'click', async () => {
                const className = btn.dataset.className;
                const level = parseInt(btn.dataset.level, 10);

                // Open LevelUpSpellSelector modal
                const selector = new LevelUpSpellSelector(this.session, this, className, level);
                try {
                    await selector.show();
                } catch (error) {
                    console.error('[Step3SpellSelection]', 'Error opening spell selector:', error);
                    alert(`Failed to open spell selector: ${error.message}`);
                }
            });
        });
    }

    /**
     * Get spellcasting classes that gain new spell slots at this level
     */
    _getSpellcastingClasses(leveledClasses) {
        // Check if class has casterProgression field in JSON data
        // Values: 'full', 'pact', '1/2', '1/3', or undefined for non-casters
        return leveledClasses.filter(classInfo => {
            const classData = classService.getClass(classInfo.name);
            return classData?.casterProgression !== undefined;
        });
    }

    /**
     * Render an individual spell level card (for single-class scenarios)
     */
    _renderIndividualSpellLevel(className, levelInfo, maxLevel) {
        const key = `${className}_${levelInfo.level}`;
        const spellSlots = this._calculateNewSpellSlots(className, levelInfo.oldLevel, levelInfo.level, maxLevel);
        const selectedSpells = this.session.stepData.selectedSpells[key] || [];

        if (spellSlots.length === 0) return '';

        return `
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="fas fa-book"></i>
                        ${className} Level ${levelInfo.level}
                    </h6>
                    <small class="text-muted">
                        ${spellSlots.join(', ')}
                    </small>
                </div>
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            ${selectedSpells.length > 0
                ? `<strong>Selected Spells:</strong>
                                   <div class="mt-2">
                                       ${selectedSpells.map(spell => {
                    const spellName = typeof spell === 'string' ? spell : spell.name;
                    return `<span class="badge bg-primary me-1">${spellName}</span>`;
                }).join('')}
                                   </div>`
                : '<span class="text-muted">No spells selected yet</span>'
            }
                        </div>
                        <button 
                            type="button" 
                            class="btn btn-sm btn-primary"
                            data-open-spell-selector
                            data-class-name="${className}"
                            data-level="${levelInfo.level}">
                            <i class="fas fa-search"></i>
                            Learn Spells
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render spell selection section for a single spellcasting class (with multiple levels)
     */
    _renderSpellcastingClass(classGroup) {
        const { className, minLevel, maxLevel, levels } = classGroup;

        // Collect all selected spells across all levels for this class
        const allSelectedSpells = [];
        for (const levelInfo of levels) {
            const key = `${className}_${levelInfo.level}`;
            const selectedSpells = this.session.stepData.selectedSpells[key] || [];
            allSelectedSpells.push(...selectedSpells);
        }

        // Build level range display
        const levelRange = minLevel === maxLevel ? `Level ${minLevel}` : `Level ${minLevel}-${maxLevel}`;

        return `
            <div class="card mb-3 spell-class-card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0">
                        <i class="fas fa-book"></i>
                        ${className}
                    </h6>
                    <small class="text-muted">
                        ${levelRange}
                    </small>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <strong>Selected Spells:</strong>
                        <div data-class-selected-spells="${className}" class="mt-2">
                            ${allSelectedSpells.length === 0
                ? '<span class="text-muted small">No spells selected yet</span>'
                : allSelectedSpells.map(spell => {
                    const spellName = typeof spell === 'string' ? spell : spell.name;
                    return `<span class="badge bg-primary me-1">${spellName}</span>`;
                }).join('')
            }
                        </div>
                    </div>
                    
                    ${levels.map(levelInfo => {
                const key = `${className}_${levelInfo.level}`;
                // Pass maxLevel for Warlock pact slot calculation
                const spellSlots = this._calculateNewSpellSlots(className, levelInfo.oldLevel, levelInfo.level, maxLevel);
                const selectedSpells = this.session.stepData.selectedSpells[key] || [];

                if (spellSlots.length === 0) return '';

                return `
                            <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded" 
                                 style="border-color: color-mix(in srgb, var(--accent-color) 18%, var(--secondary-color)) !important;"
                                 data-spell-class="${className}" 
                                 data-spell-level="${levelInfo.level}">
                                <div>
                                    <strong>${className} Level ${levelInfo.level}</strong>
                                    <span class="text-muted small ms-2">— ${spellSlots.join(', ')}</span>
                                    ${selectedSpells.length > 0 ? `<span class="badge ms-2" style="background-color: var(--accent-color);">${selectedSpells.length} selected</span>` : ''}
                                </div>
                                <button 
                                    type="button" 
                                    class="btn btn-sm btn-primary"
                                    data-open-spell-selector
                                    data-class-name="${className}"
                                    data-level="${levelInfo.level}">
                                    <i class="fas fa-search"></i>
                                    Learn Spells
                                </button>
                            </div>
                        `;
            }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Calculate which spell levels have new slots available and how many spells to learn
     * @param {string} className - The class name
     * @param {number} _currentLevel - Previous level (unused but kept for consistency)
     * @param {number} newLevel - The level being gained
     * @param {number} maxLevel - The maximum level being reached in this session (for Warlock pact magic)
     */
    _calculateNewSpellSlots(className, currentLevel, newLevel, maxLevel = newLevel) {
        // This is a simplified implementation
        const slots = [];
        const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '6th', '9th'];

        // Get class data to check for cantrip progression
        const classData = classService.getClass(className);
        const previousLevel = currentLevel || 0;

        // Calculate NEW cantrips gained at this level
        let newCantrips = 0;
        if (classData?.cantripProgression) {
            const prevIndex = Math.max(0, Math.min(previousLevel - 1, classData.cantripProgression.length - 1));
            const currIndex = Math.max(0, Math.min(newLevel - 1, classData.cantripProgression.length - 1));
            const prevCantrips = previousLevel > 0 ? (classData.cantripProgression[prevIndex] || 0) : 0;
            const currCantrips = classData.cantripProgression[currIndex] || 0;
            newCantrips = currCantrips - prevCantrips;
        }

        // Warlock uses pact magic - different progression
        if (className === 'Warlock') {
            // Warlocks learn 1 spell per level (except level 1 which gives 2)
            const spellCount = newLevel === 1 ? 2 : 1;
            // Use maxLevel for pact slot calculation since all pact slots are cast at the same level
            const slotLevel = Math.min(Math.ceil(maxLevel / 2), 5);

            const parts = [];
            if (newCantrips > 0) {
                parts.push(`${newCantrips} cantrip${newCantrips !== 1 ? 's' : ''}`);
            }
            parts.push(`${spellCount} spell${spellCount > 1 ? 's' : ''} (${ordinals[slotLevel].toLowerCase()}-level)`);
            slots.push(`Learn ${parts.join(', ')}`);
            return slots;
        }

        // Full casters (Bard, Cleric, Druid, Sorcerer, Wizard)
        if (['Wizard', 'Bard', 'Sorcerer'].includes(className)) {
            // These classes learn 2 spells per level (Wizard/Sorcerer)
            // Bard also learns spells
            const spellLevel = Math.ceil(newLevel / 2);
            if (spellLevel <= 9) {
                const spellCount = 2;
                const parts = [];
                if (newCantrips > 0) {
                    parts.push(`${newCantrips} cantrip${newCantrips !== 1 ? 's' : ''}`);
                }
                parts.push(`${spellCount} spell${spellCount > 1 ? 's' : ''} (${ordinals[spellLevel].toLowerCase()}-level)`);
                slots.push(`Learn ${parts.join(', ')}`);
            }
        } else if (['Cleric', 'Druid'].includes(className)) {
            // Clerics and Druids prepare spells, not learn them
            const spellLevel = Math.ceil(newLevel / 2);
            if (spellLevel <= 9) {
                const parts = [];
                if (newCantrips > 0) {
                    parts.push(`${newCantrips} cantrip${newCantrips !== 1 ? 's' : ''}`);
                }
                if (parts.length > 0) {
                    slots.push(`Learn ${parts.join(', ')}, prepare spells (${ordinals[spellLevel].toLowerCase()}-level)`);
                } else {
                    slots.push(`Prepare Spells (${ordinals[spellLevel].toLowerCase()}-level)`);
                }
            }
        }

        // Half casters (Paladin, Ranger)
        if (['Paladin', 'Ranger'].includes(className)) {
            if (newLevel >= 2) {
                const spellLevel = Math.ceil((newLevel - 1) / 4);
                if (spellLevel <= 5) {
                    slots.push(`Prepare Spells (${ordinals[spellLevel].toLowerCase()}-level)`);
                }
            }
        }

        return slots;
    }

    /**
     * Update spell selections from modal
     */
    async updateSpellSelection(className, level, selectedSpells) {
        const key = `${className}_${level}`;
        this.session.stepData.selectedSpells[key] = selectedSpells;

        console.info('[Step3SpellSelection]', `Updated spell selection for ${key}:`, selectedSpells);

        // Record spell selection in progression history
        this.session.recordChoices(className, level, {
            spells: {
                selected: selectedSpells.map(spell => {
                    if (typeof spell === 'string') {
                        return { name: spell };
                    }
                    return {
                        id: spell.id,
                        name: spell.name
                    };
                })
            }
        });

        // Re-render the step to update display (handles both single and multiple class layouts)
        console.log('[Step3SpellSelection] Attempting to re-render step...');
        const contentArea = document.querySelector('[data-step-content]');
        if (!contentArea) {
            console.error('[Step3SpellSelection] Content area not found!');
            return;
        }

        console.log('[Step3SpellSelection] Content area found, calling render()...');
        const html = await this.render();
        console.log('[Step3SpellSelection] Render complete, updating innerHTML...');
        contentArea.innerHTML = html;
        console.log('[Step3SpellSelection] Re-attaching listeners...');
        this.attachListeners(contentArea);
        console.log('[Step3SpellSelection] Re-render complete!');
    }

    /**
     * Cleanup on modal close
     */
    dispose() {
        this._cleanup.cleanup();
    }
}
