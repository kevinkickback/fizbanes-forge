import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
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

        // Determine which classes gain new spells
        const spellcastingClasses = this._getSpellcastingClasses(leveledClasses);

        if (spellcastingClasses.length === 0) {
            return `
                <div class="step-3-spell-selection">
                    <h5 class="mb-3"><i class="fas fa-magic"></i> Spell Selection</h5>
                    <div class="alert alert-info mb-0">
                        <i class="fas fa-info-circle"></i>
                        No new spells available at this level for your selected classes.
                    </div>
                </div>
            `;
        }

        let html = `
            <div class="step-3-spell-selection">
                <h5 class="mb-3"><i class="fas fa-magic"></i> Spell Selection</h5>
                <div class="alert alert-info small mb-3">
                    <i class="fas fa-info-circle"></i>
                    Select new spells for each spellcasting class. Click "Select Spells" to open the spell browser.
                </div>
                <div class="spell-selection-container">
        `;

        // Render each spellcasting class section
        for (const classInfo of spellcastingClasses) {
            html += this._renderSpellcastingClass(classInfo);
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

        // Restore previously selected spells display
        const classSpellSections = contentArea.querySelectorAll('[data-spell-class]');
        classSpellSections.forEach((section) => {
            const className = section.dataset.spellClass;
            const level = section.dataset.spellLevel;
            const key = `${className}_${level}`;
            const selectedSpells = this.session.stepData.selectedSpells[key];

            if (selectedSpells && selectedSpells.length > 0) {
                const spellList = section.querySelector('[data-selected-spells]');
                if (spellList) {
                    spellList.innerHTML = selectedSpells
                        .map(spell => `<span class="badge bg-primary">${spell}</span>`)
                        .join(' ');
                }
            }
        });
    }

    /**
     * Get spellcasting classes that gain new spell slots at this level
     */
    _getSpellcastingClasses(leveledClasses) {
        const spellcastingClasses = [
            'Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard', 'Paladin', 'Ranger'
        ];

        return leveledClasses.filter(classInfo =>
            spellcastingClasses.includes(classInfo.name)
        );
    }

    /**
     * Render spell selection section for a single spellcasting class
     */
    _renderSpellcastingClass(classInfo) {
        const currentLevel = classInfo.oldLevel || 0;
        const spellSlots = this._calculateNewSpellSlots(classInfo.name, currentLevel, classInfo.newLevel);
        const key = `${classInfo.name}_${classInfo.newLevel}`;
        const selectedSpells = this.session.stepData.selectedSpells[key] || [];

        if (spellSlots.length === 0) {
            return `
                <div class="card mb-3 spell-class-card">
                    <div class="card-header bg-light border-bottom">
                        <h6 class="mb-0">
                            <i class="fas fa-book"></i>
                            ${classInfo.name}
                        </h6>
                        <small class="text-muted">No new spell slots available</small>
                    </div>
                </div>
            `;
        }

        return `
            <div class="card mb-3 spell-class-card" data-spell-class="${classInfo.name}" data-spell-level="${classInfo.newLevel}">
                <div class="card-header bg-light border-bottom">
                    <h6 class="mb-0">
                        <i class="fas fa-book"></i>
                        ${classInfo.name}
                    </h6>
                    <small class="text-muted">
                        Level ${classInfo.newLevel} • New slots: ${spellSlots.join(', ')}
                    </small>
                </div>
                <div class="card-body">
                    <div class="mb-2">
                        <strong>Selected Spells (${selectedSpells.length}):</strong>
                        <div data-selected-spells class="mt-2">
                            ${selectedSpells.length === 0
                ? '<span class="text-muted small">No spells selected yet</span>'
                : selectedSpells.map(spell => `<span class="badge bg-primary">${spell}</span>`).join(' ')
            }
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn btn-sm btn-primary mt-3"
                        data-open-spell-selector
                        data-class-name="${classInfo.name}"
                        data-level="${classInfo.newLevel}"
                    >
                        <i class="fas fa-search"></i>
                        ${selectedSpells.length === 0 ? 'Select Spells' : 'Edit Spells'}
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Calculate which spell levels have new slots available
     */
    _calculateNewSpellSlots(className, currentLevel, newLevel) {
        // This is a simplified implementation
        // In production, would check actual class spell slot progressions
        const slots = [];

        // Example: Wizards get new slots at certain levels
        if (className === 'Wizard') {
            // Wizards can prepare new spells at each level up
            if (newLevel > currentLevel) {
                slots.push(`${newLevel}th`);
            }
        } else if (className === 'Bard' || className === 'Cleric' || className === 'Sorcerer') {
            if (newLevel > currentLevel) {
                slots.push(`${newLevel}th`);
            }
        }

        return slots;
    }

    /**
     * Update spell selections from modal
     */
    updateSpellSelection(className, level, selectedSpells) {
        const key = `${className}_${level}`;
        this.session.stepData.selectedSpells[key] = selectedSpells;

        // Trigger re-render to display updated selections
        // In a full implementation, could emit event or call parent's re-render
        console.info('[Step3SpellSelection]', `Updated spell selection for ${key}:`, selectedSpells);
    }

    /**
     * Cleanup on modal close
     */
    dispose() {
        this._cleanup.cleanup();
    }
}
