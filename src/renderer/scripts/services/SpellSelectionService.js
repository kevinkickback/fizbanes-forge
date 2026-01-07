/** @file Manages spell selection, known/prepared spells, and spell slots for characters. */

import { eventBus, EVENTS } from '../utils/EventBus.js';
import { spellService } from './SpellService.js';

/**
 * Manages character spellcasting, including known/prepared spells and spell slots.
 * Handles multiclass spell slot calculations and class-specific spell restrictions.
 */
class SpellSelectionService {
    constructor() {
        this.loggerScope = 'SpellSelectionService';
    }

    /**
     * Initialize spellcasting for a character by class.
     * Called when character is created or class is selected.
     * @param {Object} character - Character object
     * @param {string} className - Name of the class
     * @param {number} classLevel - Level in that class
     * @returns {Object} Initialized spellcasting data for the class
     */
    initializeSpellcastingForClass(character, className, classLevel) {
        if (!character.spellcasting) {
            character.spellcasting = {
                classes: {},
                multiclass: { isCastingMulticlass: false, combinedSlots: {} },
                other: { spellsKnown: [], itemSpells: [] },
            };
        }

        // Get class info to determine spellcasting ability, cantrips, etc.
        const classInfo = this._getClassSpellcastingInfo(className);

        if (!classInfo) {
            console.warn(`[${this.loggerScope}]`, `Class ${className} is not a spellcaster`);
            return null;
        }

        // Initialize spellcasting for this class
        character.spellcasting.classes[className] = {
            level: classLevel,
            spellsKnown: [],
            spellsPrepared: [],
            spellSlots: this.calculateSpellSlots(className, classLevel),
            cantripsKnown: this._getCantripsKnown(className, classLevel),
            spellcastingAbility: classInfo.spellcastingAbility,
            ritualCasting: classInfo.ritualCasting || false,
        };

        console.info(`[${this.loggerScope}]`, 'Initialized spellcasting for', {
            className,
            classLevel,
        });

        return character.spellcasting.classes[className];
    }

    /**
     * Get class spellcasting info (ability, ritual casting, etc.).
     * @param {string} className - Name of the class
     * @returns {Object|null} Class spellcasting info or null if not a spellcaster
     * @private
     */
    _getClassSpellcastingInfo(className) {
        // Map of spellcasting classes to their abilities
        const spellcasters = {
            'Bard': {
                spellcastingAbility: 'charisma',
                ritualCasting: true,
                knownType: 'known', // Bards know spells
            },
            'Cleric': {
                spellcastingAbility: 'wisdom',
                ritualCasting: true,
                knownType: 'prepared', // Clerics prepare spells
            },
            'Druid': {
                spellcastingAbility: 'wisdom',
                ritualCasting: true,
                knownType: 'prepared',
            },
            'Paladin': {
                spellcastingAbility: 'charisma',
                ritualCasting: false,
                knownType: 'prepared',
            },
            'Ranger': {
                spellcastingAbility: 'wisdom',
                ritualCasting: false,
                knownType: 'known',
            },
            'Sorcerer': {
                spellcastingAbility: 'charisma',
                ritualCasting: false,
                knownType: 'known',
            },
            'Warlock': {
                spellcastingAbility: 'charisma',
                ritualCasting: false,
                knownType: 'known',
                isWarlock: true, // Special pact magic slots
            },
            'Wizard': {
                spellcastingAbility: 'intelligence',
                ritualCasting: true,
                knownType: 'prepared',
            },
        };

        return spellcasters[className] || null;
    }

    /**
     * Get number of cantrips known at a given level for a class.
     * @param {string} className - Class name
     * @param {number} level - Class level
     * @returns {number} Number of cantrips known
     * @private
     */
    _getCantripsKnown(className, level) {
        const cantrips = {
            'Bard': [0, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
            'Cleric': [0, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
            'Druid': [0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
            'Sorcerer': [0, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
            'Warlock': [0, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
            'Wizard': [0, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        };

        const levelArray = cantrips[className];
        if (!levelArray) return 0;

        return levelArray[Math.min(level, 19)]; // Cap at level 20
    }

    /**
     * Get number of spells known at a given level for a class.
     * Only applies to classes with "known" type (Bard, Sorcerer, Warlock, Ranger).
     * Classes that prepare spells (Cleric, Druid, Paladin, Wizard) use _getPreparedSpellLimit instead.
     * @param {string} className - Class name
     * @param {number} level - Class level
     * @returns {number} Number of spells known (or 0 if not applicable)
     * @private
     */
    _getSpellsKnownLimit(className, level) {
        const spellsKnown = {
            'Bard': [0, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22, 22],
            'Sorcerer': [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
            'Warlock': [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
            'Ranger': [0, 0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
        };

        const levelArray = spellsKnown[className];
        if (!levelArray) return 0;

        return levelArray[Math.min(level, 20)]; // Cap at level 20
    }

    /**
     * Calculate spell slots for a class at a given level.
     * @param {string} className - Class name
     * @param {number} level - Class level (1-20)
     * @returns {Object} Spell slots { 1: { max: n, current: n }, 2: ... 9: ... }
     */
    calculateSpellSlots(className, level) {
        // Spell slots per level per class
        const slots = {
            'Bard': [
                [],
                [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1],
                [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1],
                [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
                [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
                [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
                [4, 3, 3, 3, 3, 2, 1, 1, 1],
            ],
            'Cleric': [
                [],
                [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1],
                [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1],
                [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
                [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
                [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
                [4, 3, 3, 3, 3, 2, 2, 1, 1],
            ],
            'Druid': [
                [],
                [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1],
                [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1],
                [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
                [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
                [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
                [4, 3, 3, 3, 3, 2, 2, 1, 1],
            ],
            'Paladin': [
                [],
                [], [], [], [2], [3], [3], [4], [4], [4, 2], [4, 2], [4, 2],
                [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3],
                [4, 3, 3],
            ],
            'Ranger': [
                [],
                [], [2], [2], [3], [3], [3], [4], [4], [4, 2], [4, 2], [4, 2],
                [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3],
                [4, 3, 3],
            ],
            'Sorcerer': [
                [],
                [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1],
                [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1],
                [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
                [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
                [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
                [4, 3, 3, 3, 3, 2, 2, 1, 1],
            ],
            'Warlock': [
                [],
                [1], [1], [2], [2], [3], [3], [4], [4], [5], [5], [6],
                [6], [7], [7], [8], [8], [9], [9], [10],
            ],
            'Wizard': [
                [],
                [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1],
                [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1],
                [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
                [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
                [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
                [4, 3, 3, 3, 3, 2, 2, 1, 1],
            ],
        };

        const classSlots = slots[className];
        if (!classSlots || level < 1 || level > 20) {
            return {};
        }

        const levelSlots = classSlots[level] || [];
        const result = {};

        for (let spellLevel = 1; spellLevel <= 9; spellLevel++) {
            if (levelSlots[spellLevel - 1]) {
                result[spellLevel] = {
                    max: levelSlots[spellLevel - 1],
                    current: levelSlots[spellLevel - 1],
                };
            }
        }

        return result;
    }

    /**
     * Add a spell to character's known spells for a class.
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @param {Object} spellData - Spell data from SpellService
     * @returns {boolean} True if successful
     */
    addKnownSpell(character, className, spellData) {
        if (!character.spellcasting?.classes?.[className]) {
            console.warn(`[${this.loggerScope}]`, 'Class not initialized', { className });
            return false;
        }

        const classSpellcasting = character.spellcasting.classes[className];

        // Check if spell already known
        if (classSpellcasting.spellsKnown.some(
            (s) => s.name === spellData.name && s.source === (spellData.source || 'PHB'),
        )) {
            console.warn(`[${this.loggerScope}]`, 'Spell already known', spellData.name);
            return false;
        }

        // Store full spell object
        classSpellcasting.spellsKnown.push(spellData);

        console.info(`[${this.loggerScope}]`, 'Added known spell', {
            className,
            spell: spellData.name,
        });

        eventBus.emit(EVENTS.SPELL_ADDED, character, className, spellData);
        return true;
    }

    /**
     * Remove a spell from character's known spells for a class.
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @param {string} spellName - Spell name
     * @returns {boolean} True if successful
     */
    removeKnownSpell(character, className, spellName) {
        if (!character.spellcasting?.classes?.[className]) {
            console.warn(`[${this.loggerScope}]`, 'Class not initialized', { className });
            return false;
        }

        const classSpellcasting = character.spellcasting.classes[className];
        const index = classSpellcasting.spellsKnown.findIndex(
            (s) => s.name === spellName,
        );

        if (index === -1) {
            console.warn(`[${this.loggerScope}]`, 'Spell not known', { className, spellName });
            return false;
        }

        const removed = classSpellcasting.spellsKnown.splice(index, 1)[0];

        // Also remove from prepared if applicable
        const preparedIndex = classSpellcasting.spellsPrepared.findIndex(
            (s) => s.name === spellName,
        );
        if (preparedIndex !== -1) {
            classSpellcasting.spellsPrepared.splice(preparedIndex, 1);
        }

        console.info(`[${this.loggerScope}]`, 'Removed known spell', {
            className,
            spell: spellName,
        });

        eventBus.emit(EVENTS.SPELL_REMOVED, character, className, removed);
        return true;
    }

    /**
     * Prepare a spell (for Cleric, Wizard, Druid, Paladin).
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @param {string} spellName - Spell name to prepare
     * @returns {boolean} True if successful
     */
    prepareSpell(character, className, spellName) {
        if (!character.spellcasting?.classes?.[className]) {
            console.warn(`[${this.loggerScope}]`, 'Class not initialized', { className });
            return false;
        }

        const classSpellcasting = character.spellcasting.classes[className];

        // Must be a known spell
        const knownSpell = classSpellcasting.spellsKnown.find(
            (s) => s.name === spellName,
        );
        if (!knownSpell) {
            console.warn(`[${this.loggerScope}]`, 'Spell not known', { className, spellName });
            return false;
        }

        // Check if already prepared
        if (classSpellcasting.spellsPrepared.some((s) => s.name === spellName)) {
            console.warn(`[${this.loggerScope}]`, 'Spell already prepared', { className, spellName });
            return false;
        }

        // Check prepared limit
        const preparedLimit = this._getPreparedSpellLimit(
            character,
            className,
            classSpellcasting.level,
        );
        if (classSpellcasting.spellsPrepared.length >= preparedLimit) {
            console.warn(`[${this.loggerScope}]`, 'Prepared spell limit reached', {
                className,
                limit: preparedLimit,
            });
            return false;
        }

        classSpellcasting.spellsPrepared.push({ ...knownSpell });

        console.info(`[${this.loggerScope}]`, 'Prepared spell', {
            className,
            spell: spellName,
        });

        eventBus.emit(EVENTS.SPELL_PREPARED, character, className, knownSpell);
        return true;
    }

    /**
     * Unprepare a spell.
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @param {string} spellName - Spell name
     * @returns {boolean} True if successful
     */
    unprepareSpell(character, className, spellName) {
        if (!character.spellcasting?.classes?.[className]) {
            console.warn(`[${this.loggerScope}]`, 'Class not initialized', { className });
            return false;
        }

        const classSpellcasting = character.spellcasting.classes[className];
        const index = classSpellcasting.spellsPrepared.findIndex(
            (s) => s.name === spellName,
        );

        if (index === -1) {
            console.warn(`[${this.loggerScope}]`, 'Spell not prepared', { className, spellName });
            return false;
        }

        const removed = classSpellcasting.spellsPrepared.splice(index, 1)[0];

        console.info(`[${this.loggerScope}]`, 'Unprepared spell', {
            className,
            spell: spellName,
        });

        eventBus.emit(EVENTS.SPELL_UNPREPARED, character, className, removed);
        return true;
    }

    /**
     * Use a spell slot (reduce current by 1).
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @param {number} spellLevel - Spell level (1-9)
     * @returns {boolean} True if successful
     */
    useSpellSlot(character, className, spellLevel) {
        if (!character.spellcasting?.classes?.[className]) {
            console.warn(`[${this.loggerScope}]`, 'Class not initialized', { className });
            return false;
        }

        const slot = character.spellcasting.classes[className].spellSlots[spellLevel];

        if (!slot || slot.current <= 0) {
            console.warn(`[${this.loggerScope}]`, 'No spell slots available', {
                className,
                spellLevel,
            });
            return false;
        }

        slot.current--;

        console.info(`[${this.loggerScope}]`, 'Used spell slot', {
            className,
            spellLevel,
            remaining: slot.current,
        });

        eventBus.emit(EVENTS.SPELL_SLOTS_USED, character, className, spellLevel);
        return true;
    }

    /**
     * Restore spell slots (on long rest).
     * @param {Object} character - Character object
     * @param {string} className - Class name (or null for all)
     * @returns {boolean} True if successful
     */
    restoreSpellSlots(character, className = null) {
        if (!character.spellcasting?.classes) {
            console.warn(`[${this.loggerScope}]`, 'No spellcasting initialized');
            return false;
        }

        const classesToRestore = className
            ? [className]
            : Object.keys(character.spellcasting.classes);

        for (const cls of classesToRestore) {
            const classSpellcasting = character.spellcasting.classes[cls];
            if (classSpellcasting?.spellSlots) {
                for (const level in classSpellcasting.spellSlots) {
                    classSpellcasting.spellSlots[level].current =
                        classSpellcasting.spellSlots[level].max;
                }
            }
        }

        console.info(`[${this.loggerScope}]`, 'Restored spell slots', { classNames: classesToRestore });

        eventBus.emit(EVENTS.SPELL_SLOTS_RESTORED, character, classesToRestore);
        return true;
    }

    /**
     * Get prepared spell limit for a class.
     * Formula: Level + spellcasting ability modifier
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @param {number} classLevel - Class level
     * @returns {number} Maximum prepared spells
     * @private
     */
    _getPreparedSpellLimit(character, className, classLevel) {
        const classInfo = this._getClassSpellcastingInfo(className);
        if (!classInfo) return 0;

        const abilityMod = character.getAbilityModifier(classInfo.spellcastingAbility);
        return Math.max(1, classLevel + abilityMod);
    }

    /**
     * Get all available spells for a class.
     * @param {string} className - Class name
     * @returns {Array} Array of available spells
     */
    getAvailableSpellsForClass(className) {
        const allSpells = spellService.getAllSpells();

        // Filter by class availability
        return allSpells.filter((spell) => {
            if (!spell.classes) return false;
            const classes = Array.isArray(spell.classes) ? spell.classes : [spell.classes];
            return classes.includes(className);
        });
    }

    /**
     * Get spell limit info for a class.
     * Returns different info depending on whether the class uses "known" or "prepared" spells.
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @param {number} classLevel - Class level
     * @returns {Object} { type: 'known'|'prepared', limit: number, current: number }
     */
    getSpellLimitInfo(character, className, classLevel) {
        const classInfo = this._getClassSpellcastingInfo(className);
        if (!classInfo) return { type: null, limit: 0, current: 0 };

        const classSpellcasting = character.spellcasting?.classes?.[className];
        if (!classSpellcasting) return { type: null, limit: 0, current: 0 };

        if (classInfo.knownType === 'known') {
            // Classes with fixed spells known
            return {
                type: 'known',
                limit: this._getSpellsKnownLimit(className, classLevel),
                current: classSpellcasting.spellsKnown.length,
            };
        } else {
            // Classes that prepare spells
            return {
                type: 'prepared',
                limit: this._getPreparedSpellLimit(character, className, classLevel),
                current: classSpellcasting.spellsPrepared.length,
            };
        }
    }
}

// Export singleton
export const spellSelectionService = new SpellSelectionService();
