import { SPELL_SCHOOL_NAMES } from '../../../lib/5eToolsParser.js';
import { showNotification } from '../../../lib/Notifications.js';
import { classService } from '../../../services/ClassService.js';
import { sourceService } from '../../../services/SourceService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { spellService } from '../../../services/SpellService.js';
import { LevelUpSelector } from './LevelUpSelector.js';

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
        this.maxCantrips = 0;
        this.slotsByLevel = {}; // { 1: 2, 2: 2, 3: 1 }

        // Generic selector instance
        this._selector = null;
    }

    /**
     * Initialize and display the spell selector modal
     */
    async show() {
        try {
            // Calculate limits first (before loading spell data)
            this._calculateSpellLimits();

            // Load spell data
            const spellData = await this._loadSpellData();

            // Get previously selected spells for this class and level
            const key = `${this.className}_${this.currentLevel}`;
            const previousSelections = this.session.stepData.selectedSpells[key] || [];

            console.log('[LevelUpSpellSelector]', 'Loading previous selections:', {
                key,
                previousSelections,
                sessionStepData: this.session.stepData,
                spellDataCount: spellData.length
            });

            // Find the actual spell objects from spellData for previous selections
            const initialSelections = previousSelections.map(prevSpell => {
                const spellName = typeof prevSpell === 'string' ? prevSpell : prevSpell.name;
                const foundSpell = spellData.find(spell => spell.name === spellName);
                if (!foundSpell) {
                    console.warn('[LevelUpSpellSelector]', 'Could not find spell in spellData:', spellName);
                }
                return foundSpell;
            }).filter(Boolean); // Filter out any not found

            console.log('[LevelUpSpellSelector]', 'Initial selections resolved:', {
                initialSelections: initialSelections.map(s => s.name)
            });

            // Get the maximum spell level available at this character level
            const maxSpellLevel = this._getMaxSpellLevel(this.className, this.currentLevel);

            // Create tab levels - only show tabs for spell levels that are available
            const tabLevels = [];
            const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

            // Always include cantrips if there are any in the spell list
            if (spellData.some(spell => spell.level === 0)) {
                tabLevels.push({ label: 'Cantrips', value: 0 });
            }

            // Only include tabs up to the maximum spell level available
            for (let i = 1; i <= Math.min(maxSpellLevel, 9); i++) {
                // Only add tab if there are spells of this level in the available list
                if (spellData.some(spell => spell.level === i)) {
                    tabLevels.push({ label: `${ordinals[i]} Level`, value: i });
                }
            }

            // Build modal title with cantrip and spell counts
            let modalTitle = `Select Spells - ${this.className} (Level ${this.currentLevel})`;
            if (this.maxCantrips > 0 && this.maxSpells > 0) {
                const maxSpellLevel = this._getMaxSpellLevel(this.className, this.currentLevel);
                const ordinals = ['', '1st-level', '2nd-level', '3rd-level', '4th-level', '5th-level', '6th-level', '7th-level', '8th-level', '9th-level'];
                modalTitle = `Learn ${this.maxCantrips} cantrip${this.maxCantrips !== 1 ? 's' : ''}, ${this.maxSpells} ${ordinals[maxSpellLevel] || 'level'} spell${this.maxSpells !== 1 ? 's' : ''}`;
            } else if (this.maxCantrips > 0) {
                modalTitle = `Learn ${this.maxCantrips} cantrip${this.maxCantrips !== 1 ? 's' : ''}`;
            } else if (this.maxSpells > 0) {
                const maxSpellLevel = this._getMaxSpellLevel(this.className, this.currentLevel);
                const ordinals = ['', '1st-level', '2nd-level', '3rd-level', '4th-level', '5th-level', '6th-level', '7th-level', '8th-level', '9th-level'];
                modalTitle = `Learn ${this.maxSpells} ${ordinals[maxSpellLevel] || 'level'} spell${this.maxSpells !== 1 ? 's' : ''}`;
            }

            // Create generic selector with spell-specific config
            this._selector = new LevelUpSelector({
                items: spellData,
                searchFields: ['name'],
                filterSets: { school: SPELL_SCHOOL_NAMES },
                multiSelect: true,
                maxSelections: this.maxSpells + this.maxCantrips, // Total selections allowed
                initialSelections,
                tabLevels,
                itemRenderer: this._renderSpellItem.bind(this),
                onConfirm: this._onSpellsConfirmed.bind(this),
                modalTitle,
                validationFn: (_selectedIds, selectedItems) => {
                    // Separate cantrips from leveled spells
                    const selectedCantrips = selectedItems.filter(spell => spell.level === 0);
                    const selectedLeveledSpells = selectedItems.filter(spell => spell.level > 0);

                    // Validate cantrips (allow partial selection, enforce max)
                    if (this.maxCantrips > 0 && selectedCantrips.length > this.maxCantrips) {
                        return {
                            isValid: false,
                            message: `You cannot select more than ${this.maxCantrips} cantrip${this.maxCantrips !== 1 ? 's' : ''}.`
                        };
                    }

                    // Validate leveled spells (allow partial selection, enforce max)
                    if (this.maxSpells > 0 && selectedLeveledSpells.length > this.maxSpells) {
                        return {
                            isValid: false,
                            message: `You cannot select more than ${this.maxSpells} spell${this.maxSpells !== 1 ? 's' : ''}.`
                        };
                    }

                    // Allow confirmation even with partial selection (0 is also valid)
                    return { isValid: true };
                },
                customCountFn: (selectedItems) => {
                    const selectedCantrips = selectedItems.filter(spell => spell.level === 0);
                    const selectedLeveledSpells = selectedItems.filter(spell => spell.level > 0);

                    const badges = [];
                    if (this.maxCantrips > 0) {
                        const cantripClass = selectedCantrips.length === this.maxCantrips ? 'bg-success' :
                            selectedCantrips.length > this.maxCantrips ? 'bg-danger' : 'bg-info';
                        badges.push(`<span class="badge ${cantripClass} me-1">${selectedCantrips.length} / ${this.maxCantrips} Cantrips</span>`);
                    }
                    if (this.maxSpells > 0) {
                        const spellClass = selectedLeveledSpells.length === this.maxSpells ? 'bg-success' :
                            selectedLeveledSpells.length > this.maxSpells ? 'bg-danger' : 'bg-info';
                        badges.push(`<span class="badge ${spellClass}">${selectedLeveledSpells.length} / ${this.maxSpells} Spells</span>`);
                    }
                    return badges.join('');
                },
                selectionLimitFn: (item, selectedItems) => {
                    const isCantrip = item.level === 0;
                    const selectedCantrips = selectedItems.filter(spell => spell.level === 0);
                    const selectedLeveledSpells = selectedItems.filter(spell => spell.level > 0);

                    if (isCantrip && this.maxCantrips > 0 && selectedCantrips.length >= this.maxCantrips) {
                        showNotification(`Maximum ${this.maxCantrips} cantrip${this.maxCantrips !== 1 ? 's' : ''} can be selected`, 'warning');
                        return false;
                    }

                    if (!isCantrip && this.maxSpells > 0 && selectedLeveledSpells.length >= this.maxSpells) {
                        showNotification(`Maximum ${this.maxSpells} spell${this.maxSpells !== 1 ? 's' : ''} can be selected`, 'warning');
                        return false;
                    }

                    return true;
                },
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

        // Calculate maximum spell level available at this character level
        const maxSpellLevel = this._getMaxSpellLevel(this.className, this.currentLevel);

        // Collect already-known spells from character and session (across ALL classes)
        const alreadyKnown = new Set();

        // 1. Spells from original character's spellcasting data (check all classes)
        const allClassSpells = this.session.originalCharacter?.spellcasting?.classes;
        if (allClassSpells) {
            Object.values(allClassSpells).forEach(classData => {
                // Add cantrips
                if (classData.cantrips) {
                    classData.cantrips.forEach(spell => {
                        const spellName = typeof spell === 'string' ? spell : spell.name;
                        if (spellName) alreadyKnown.add(spellName);
                    });
                }
                // Add known spells
                if (classData.spellsKnown) {
                    classData.spellsKnown.forEach(spell => {
                        const spellName = typeof spell === 'string' ? spell : spell.name;
                        if (spellName) alreadyKnown.add(spellName);
                    });
                }
            });
        }

        // 2. Spells from current session's selections (check all classes)
        if (this.session.stepData?.selectedSpells) {
            const currentKey = `${this.className}_${this.currentLevel}`;

            Object.entries(this.session.stepData.selectedSpells).forEach(([key, spells]) => {
                // Skip the current level being edited (so user can modify their current selection)
                if (key === currentKey) {
                    return;
                }

                // Check spells from ALL classes (not just the current one)
                spells.forEach(spell => {
                    const spellName = typeof spell === 'string' ? spell : spell.name;
                    if (spellName) alreadyKnown.add(spellName);
                });
            });
        }

        // 3. Spells from progression history at OTHER levels (but same class)
        if (this.session.originalCharacter?.progression?.spellSelections) {
            const progressionClass = this.session.originalCharacter.progression?.classes?.find(c => c.name === this.className);
            const classLevel = progressionClass?.levels || 0;

            for (let lvl = 1; lvl <= classLevel; lvl++) {
                // Skip the current level being edited
                if (lvl === this.currentLevel) {
                    continue;
                }

                const sessionKey = `${this.className}_${lvl}`;
                const levelSpells = this.session.originalCharacter.progression.spellSelections[sessionKey] || [];

                levelSpells.forEach(spell => {
                    const spellName = typeof spell === 'string' ? spell : spell.name;
                    if (spellName) alreadyKnown.add(spellName);
                });
            }
        }

        console.log('[LevelUpSpellSelector] Already known spells:', Array.from(alreadyKnown));

        // Get all spells from SpellService
        const allSpells = this.spellService.getAllSpells();

        // Get current level's selections to include them even if "already known"
        const currentKey = `${this.className}_${this.currentLevel}`;
        const currentLevelSelections = new Set();
        if (this.session.stepData?.selectedSpells?.[currentKey]) {
            this.session.stepData.selectedSpells[currentKey].forEach(spell => {
                const spellName = typeof spell === 'string' ? spell : spell.name;
                if (spellName) currentLevelSelections.add(spellName);
            });
        }

        // Filter by class eligibility, spell level, allowed sources, and exclude already known
        const availableSpells = allSpells.filter(spell => {
            // Check if spell is available for this class
            if (!this.spellService.isSpellAvailableForClass(spell, this.className)) {
                return false;
            }

            // Check if spell level is available at this character level
            if (spell.level > maxSpellLevel) {
                return false;
            }

            // Exclude cantrips if no cantrips are gained at this level
            if (spell.level === 0 && this.maxCantrips === 0) {
                return false;
            }

            // Exclude leveled spells if no spells are gained at this level
            if (spell.level > 0 && this.maxSpells === 0) {
                return false;
            }

            // Check if source is allowed
            if (!sourceService.isSourceAllowed(spell.source)) {
                return false;
            }

            // Include spells selected for this level, even if already known
            if (currentLevelSelections.has(spell.name)) {
                return true;
            }

            // Exclude spells already known (from other levels/classes)
            if (alreadyKnown.has(spell.name)) {
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

        console.info('[LevelUpSpellSelector]', `Loaded ${availableSpells.length} available spells for ${this.className} at level ${this.currentLevel} (max spell level: ${maxSpellLevel})`);
        return availableSpells;
    }

    /**
     * Get spell level ordinal based on maximum available spell level
     */
    _getLevelOrdinal() {
        const maxSpellLevel = this._getMaxSpellLevel(this.className, this.currentLevel);
        const ordinals = ['', '1st-level', '2nd-level', '3rd-level', '4th-level', '5th-level', '6th-level', '7th-level', '8th-level', '9th-level'];
        return ordinals[maxSpellLevel] || 'level';
    }

    /**
     * Get the maximum spell level available for a class at a given level
     */
    _getMaxSpellLevel(className, characterLevel) {
        const classData = this.spellSelectionService._getClassSpellcastingInfo(className);
        if (!classData) return 0;

        // Get the class data from classService to check caster progression
        const classInfo = classService.getClass(className);
        const progression = classInfo?.casterProgression;

        let casterLevel = characterLevel;

        // Calculate effective caster level based on progression type
        if (progression === '1/2') {
            casterLevel = Math.floor(characterLevel / 2);
        } else if (progression === '1/3') {
            casterLevel = Math.floor(characterLevel / 3);
        } else if (progression === 'pact') {
            // Warlock uses pact magic - special progression
            // Warlocks gain spell levels: 1st at level 1, 2nd at level 3, 3rd at level 5, 4th at level 7, 5th at level 9
            if (characterLevel >= 9) return 5;
            if (characterLevel >= 7) return 4;
            if (characterLevel >= 5) return 3;
            if (characterLevel >= 3) return 2;
            return 1;
        }

        // Standard spell level progression for full/half/third casters
        // Level 1-2: 1st level spells
        // Level 3-4: 2nd level spells
        // Level 5-6: 3rd level spells
        // Level 7-8: 4th level spells
        // Level 9-10: 5th level spells
        // Level 11-12: 6th level spells
        // Level 13-14: 7th level spells
        // Level 15-16: 8th level spells
        // Level 17+: 9th level spells
        if (casterLevel >= 17) return 9;
        if (casterLevel >= 15) return 8;
        if (casterLevel >= 13) return 7;
        if (casterLevel >= 11) return 6;
        if (casterLevel >= 9) return 5;
        if (casterLevel >= 7) return 4;
        if (casterLevel >= 5) return 3;
        if (casterLevel >= 3) return 2;
        if (casterLevel >= 1) return 1;
        return 0;
    }

    /**
     * Calculate spell slot and known spell limits
     */
    _calculateSpellLimits() {
        const classData = this.spellSelectionService._getClassSpellcastingInfo(this.className);
        if (!classData) {
            this.maxSpells = 0;
            this.maxCantrips = 0;
            return;
        }

        // Calculate spells to learn at this specific level
        const previousLevel = this.currentLevel - 1;

        // Calculate cantrips
        const previousCantrips = this.spellSelectionService._getCantripsKnown(this.className, previousLevel);
        const currentCantrips = this.spellSelectionService._getCantripsKnown(this.className, this.currentLevel);
        this.maxCantrips = currentCantrips - previousCantrips;

        // Get spells known at previous level and current level
        const previousSpellsKnown = this.spellSelectionService._getSpellsKnownLimit(this.className, previousLevel);
        const currentSpellsKnown = this.spellSelectionService._getSpellsKnownLimit(this.className, this.currentLevel);

        // Calculate new spells = difference between levels
        const newSpells = currentSpellsKnown - previousSpellsKnown;

        // For Warlock and other classes with fixed spells per level
        if (this.className === 'Warlock') {
            // Warlocks learn 1 spell per level (except level 1 which gives 2)
            this.maxSpells = this.currentLevel === 1 ? 2 : 1;
        } else if (['Wizard', 'Sorcerer', 'Bard', 'Ranger'].includes(this.className)) {
            // These classes have spellsKnownProgression or learn a fixed number per level
            this.maxSpells = newSpells > 0 ? newSpells : 2; // Default to 2 if progression not found
        } else if (['Cleric', 'Druid', 'Paladin'].includes(this.className)) {
            // These classes prepare spells - allow selecting all available spells up to their limit
            this.maxSpells = currentSpellsKnown;
        } else {
            // Default: use the difference in spells known
            this.maxSpells = newSpells > 0 ? newSpells : 0;
        }

        console.log('[LevelUpSpellSelector]', `Spell limit for ${this.className} level ${this.currentLevel}:`, {
            previousCantrips,
            currentCantrips,
            newCantrips: this.maxCantrips,
            previousSpellsKnown,
            currentSpellsKnown,
            newSpells,
            maxSpells: this.maxSpells
        });
    }

    /**
     * Render a single spell item for the generic selector
     */
    _renderSpellItem(spell) {
        const isSelected = this._selector.selectedItems.some(s => this._selector._itemKey(s) === this._selector._itemKey(spell));
        const selectedClass = isSelected ? 'selected' : '';
        const itemKey = this._selector._itemKey(spell);

        // Use cached description or placeholder
        const description = this._selector.descriptionCache.has(itemKey)
            ? this._selector.descriptionCache.get(itemKey)
            : '<span class="text-muted small">Loading description...</span>';

        // Build spell-specific metadata for header
        let metadataHtml = '';
        if (spell.level !== undefined) {
            const levelText = spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`;
            metadataHtml += `<span class="badge bg-primary me-2">${levelText}</span>`;
        }
        if (spell.school) {
            // Convert abbreviated school to full name
            const schoolNames = {
                A: 'Abjuration', C: 'Conjuration', D: 'Divination',
                E: 'Enchantment', I: 'Illusion', N: 'Necromancy',
                T: 'Transmutation', V: 'Evocation'
            };
            const schoolName = schoolNames[spell.school] || spell.school;
            metadataHtml += `<span class="badge bg-info me-2">${schoolName}</span>`;
        }
        if (spell.ritual) {
            metadataHtml += '<span class="badge bg-secondary me-2">Ritual</span>';
        }
        if (spell.concentration) {
            metadataHtml += '<span class="badge bg-warning me-2">Conc.</span>';
        }

        // Format spell stats (Casting Time, Range, Duration, Components)
        const castingTime = spell.time?.[0]
            ? `${spell.time[0].number || ''} ${spell.time[0].unit || ''}`.trim()
            : 'Unknown';
        const range = spell.range?.distance?.amount
            ? `${spell.range.distance.amount} ${spell.range.distance.type}`
            : spell.range?.type || 'Unknown';
        const duration = spell.duration?.[0]?.duration
            ? `${spell.duration[0].duration.amount || ''} ${spell.duration[0].duration.type || ''}`.trim()
            : spell.duration?.[0]?.type || 'Unknown';

        // Format components
        const components = [];
        if (spell.components?.v) components.push('V');
        if (spell.components?.s) components.push('S');
        if (spell.components?.m) components.push('M');
        const componentsStr = components.join(', ') || 'None';
        const materialDesc = spell.components?.m?.text || spell.components?.m || '';

        return `
            <div class="spell-card selector-card ${selectedClass}" data-item-id="${itemKey}" data-selector-item-card>
                <div class="spell-card-header">
                    <div>
                        <strong>${spell.name}</strong>
                    </div>
                    <div>${metadataHtml}</div>
                </div>
                <div class="spell-card-body">
                    <div class="spell-stats">
                        <div class="spell-stat-row">
                            <div class="spell-stat">
                                <strong>Casting Time:</strong> ${castingTime}
                            </div>
                            <div class="spell-stat">
                                <strong>Range:</strong> ${range}
                            </div>
                        </div>
                        <div class="spell-stat-row">
                            <div class="spell-stat">
                                <strong>Duration:</strong> ${duration}
                            </div>
                            <div class="spell-stat">
                                <strong>Components:</strong> ${componentsStr}
                                ${materialDesc ? `<br><span class="text-muted small">(${materialDesc})</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="spell-description selector-description">
                        ${description}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Handle spell selection confirmation
     */
    async _onSpellsConfirmed(selectedSpells) {
        // Update parent step with full spell objects (not just names)
        if (this.parentStep?.updateSpellSelection) {
            await this.parentStep.updateSpellSelection(
                this.className,
                this.currentLevel,
                selectedSpells
            );
        }
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
