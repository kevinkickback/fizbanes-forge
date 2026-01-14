import { LevelUpSelector } from './LevelUpSelector.js';
import { SPELL_SCHOOL_NAMES } from '../../../lib/DnDConstants.js';
import { sourceService } from '../../../services/SourceService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { spellService } from '../../../services/SpellService.js';

/**
 * LevelUpSpellSelector
 * 
 * Spell-specific adapter for generic LevelUpSelector.
 * Wraps spell-specific configuration and data loading for the level-up wizard.
 * 
 * Features:
 * - Search and filter spells by name, school
 * - Enforce spell slot/known spell limits
 * - Display spell details with ritual/concentration badges
 * - Uses generic LevelUpSelector for consistent UX with other selectors
 */

export class LevelUpSpellSelector {
    constructor(session, parentStep, className, currentLevel) {
        this.session = session;
        this.parentStep = parentStep;
        this.className = className;
        this.currentLevel = currentLevel;

        // Service references
        this.spellService = spellService;
        this.spellSelectionService = spellSelectionService;

        // Spell limits
        this.maxSpells = 0;
        this.slotsByLevel = {}; // { 1: 2, 2: 2, 3: 1 }

        // Generic selector instance
        this._selector = null;
    }

    /**
     * Initialize and display the spell selector modal
     */
    async show() {
        try {
            // Load spell data
            const spellData = await this._loadSpellData();

            // Calculate limits
            this._calculateSpellLimits();

            // Create tab levels (0=cantrips, 1=1st level, 2=2nd level, etc.)
            const tabLevels = [];
            for (let i = 0; i < 10; i++) {
                if (i === 0) {
                    tabLevels.push({ label: 'Cantrips', value: 0 });
                } else {
                    const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
                    tabLevels.push({ label: `${ordinals[i]} Level`, value: i });
                }
            }

            // Create generic selector with spell-specific config
            this._selector = new LevelUpSelector({
                items: spellData,
                searchFields: ['name'],
                filterSets: { school: SPELL_SCHOOL_NAMES },
                multiSelect: true,
                maxSelections: this.maxSpells,
                tabLevels,
                itemRenderer: this._renderSpellItem.bind(this),
                onConfirm: this._onSpellsConfirmed.bind(this),
                modalTitle: `Select Spells - ${this.className} (Level ${this.currentLevel})`,
                context: {
                    className: this.className,
                    currentLevel: this.currentLevel
                }
            });

            // Show modal
            await this._selector.show();
        } catch (error) {
            console.error('[LevelUpSpellSelector]', 'Error showing spell selector:', error);
        }
    }

    /**
     * Load available spells for this class and level
     */
    async _loadSpellData() {
        // Get class spellcasting info
        const classInfo = this.spellSelectionService._getClassSpellcastingInfo(this.className);
        if (!classInfo) {
            throw new Error(`${this.className} is not a spellcaster`);
        }

        // Get all spells from SpellService
        const allSpells = this.spellService.getAllSpells();

        // Filter by class eligibility and allowed sources
        const availableSpells = allSpells.filter(spell => {
            // Check if spell is available for this class
            if (!this.spellService.isSpellAvailableForClass(spell, this.className)) {
                return false;
            }

            // Check if source is allowed
            if (!sourceService.isSourceAllowed(spell.source)) {
                return false;
            }

            return true;
        });

        // Sort by level, then name
        availableSpells.sort((a, b) => {
            if (a.level !== b.level) {
                return a.level - b.level;
            }
            return a.name.localeCompare(b.name);
        });

        console.info('[LevelUpSpellSelector]', `Loaded ${availableSpells.length} available spells for ${this.className}`);
        return availableSpells;
    }

    /**
     * Calculate spell slot and known spell limits
     */
    _calculateSpellLimits() {
        // Get spell slots for each level from class table
        const slotCounts = this.spellSelectionService.calculateSpellSlots(
            this.className,
            this.currentLevel
        );

        // slotCounts is typically { 1: [count, count], 2: [count, count], ... }
        // Convert to per-level known/prepared counts
        if (typeof slotCounts === 'object') {
            Object.entries(slotCounts).forEach(([level, slots]) => {
                // For most classes, known spells = available slots
                // For prepared spellcasters, prepared = spell slots
                if (Array.isArray(slots)) {
                    this.slotsByLevel[level] = slots[0]; // Use first value
                } else {
                    this.slotsByLevel[level] = slots;
                }
            });
        }

        // Total spells for display
        this.maxSpells = Object.values(this.slotsByLevel).reduce((a, b) => a + b, 0);
    }

    /**
     * Render a single spell item for the generic selector
     */
    _renderSpellItem(spell) {
        const ritualBadge = spell.ritual ? '<span class="badge bg-secondary ms-1">Ritual</span>' : '';
        const concentrationBadge = spell.concentration ? '<span class="badge bg-warning ms-1">Conc.</span>' : '';

        return `
            <div class="form-check selector-item-check mb-2">
                <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="spell_${spell.id}"
                    value="${spell.id}"
                    data-selector-item
                    name="selector_item"
                >
                <label class="form-check-label w-100" for="spell_${spell.id}">
                    <strong>${spell.name}</strong>
                    ${ritualBadge}
                    ${concentrationBadge}
                    <div class="small text-muted">${spell.school}</div>
                </label>
            </div>
        `;
    }

    /**
     * Handle spell selection confirmation
     */
    async _onSpellsConfirmed(selectedSpells) {
        // Update parent step
        this.parentStep?.updateSpellSelection?.(
            this.className,
            this.currentLevel,
            selectedSpells.map(s => s.name)
        );
    }

    /**
     * Cancel selection and cleanup
     */
    cancel() {
        if (this._selector) {
            this._selector.cancel();
        }
    }
}

