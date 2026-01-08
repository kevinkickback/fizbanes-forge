/** @file Manages character level progression, multiclass tracking, and feature application. */

import { eventBus, EVENTS } from '../utils/EventBus.js';
import { classService } from './ClassService.js';
import { spellSelectionService } from './SpellSelectionService.js';

/**
 * Manages character level progression, multiclass support, and class feature application.
 * Handles level-ups, feature progression, spell slot recalculation, and multiclass mechanics.
 */
class LevelUpService {
    constructor() {
        this.loggerScope = 'LevelUpService';

        // Levels where ability score improvements occur (shared across classes)
        this.ASI_LEVELS = [4, 8, 12, 16, 19];
    }

    /**
     * Initialize progression tracking for a character based on current class.
     * @param {Object} character - Character object
     * @returns {void}
     */
    initializeProgression(character) {
        if (!character.progression) {
            character.progression = {
                classes: [],
                experiencePoints: 0,
                levelUps: [],
            };
        }

        // If character has a class but no progression tracking, create entry
        if (character.class?.name && character.progression.classes.length === 0) {
            this.addClassLevel(character, character.class.name, character.level || 1);
        }
    }

    /**
     * Increase character's total level by 1.
     * @param {Object} character - Character object
     * @returns {boolean} True if successful
     */
    increaseLevel(character) {
        if (!character.level) character.level = 1;
        if (character.level >= 20) {
            console.warn(`[${this.loggerScope}]`, 'Character already at max level');
            return false;
        }

        const oldLevel = character.level;
        character.level++;

        // Increase primary class level if only one class
        if (character.progression.classes.length === 1) {
            character.progression.classes[0].level++;
        }

        const newLevel = character.level;

        console.info(`[${this.loggerScope}]`, 'Character leveled up', {
            from: oldLevel,
            to: newLevel,
        });

        eventBus.emit(EVENTS.CHARACTER_LEVEL_CHANGED, character, { from: oldLevel, to: newLevel });
        return true;
    }

    /**
     * Decrease character's total level by 1.
     * @param {Object} character - Character object
     * @returns {boolean} True if successful
     */
    decreaseLevel(character) {
        if (!character.level || character.level <= 1) {
            console.warn(`[${this.loggerScope}]`, 'Character already at minimum level');
            return false;
        }

        const oldLevel = character.level;
        character.level--;

        // Decrease primary class level if only one class
        if (character.progression.classes.length === 1) {
            character.progression.classes[0].level--;
        }

        const newLevel = character.level;

        console.info(`[${this.loggerScope}]`, 'Character leveled down', {
            from: oldLevel,
            to: newLevel,
        });

        eventBus.emit(EVENTS.CHARACTER_LEVEL_CHANGED, character, { from: oldLevel, to: newLevel });
        return true;
    }

    /**
     * Add or increase a class level for multiclassing.
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @param {number} level - Level in that class (default 1)
     * @returns {Object} Class progression entry or null
     */
    addClassLevel(character, className, level = 1) {
        if (!character.progression) {
            this.initializeProgression(character);
        }

        // Check if class already exists
        let classEntry = character.progression.classes.find(
            (c) => c.name === className,
        );

        if (classEntry) {
            classEntry.level = level;
            console.info(`[${this.loggerScope}]`, 'Updated class level', {
                className,
                level,
            });
            return classEntry;
        }

        // Create new class entry
        classEntry = {
            name: className,
            level,
            subclass: null,
            hitDice: this._getHitDiceForClass(className),
            hitPoints: [],
            features: [],
            spellSlots: {},
        };

        character.progression.classes.push(classEntry);

        // Initialize spellcasting for this class if applicable
        spellSelectionService.initializeSpellcastingForClass(character, className, level);

        console.info(`[${this.loggerScope}]`, 'Added class level', {
            className,
            level,
        });

        eventBus.emit(EVENTS.MULTICLASS_ADDED, character, classEntry);
        return classEntry;
    }

    /**
     * Remove or reduce a class level.
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @returns {boolean} True if successful
     */
    removeClassLevel(character, className) {
        if (!character.progression) return false;

        const index = character.progression.classes.findIndex(
            (c) => c.name === className,
        );

        if (index === -1) {
            console.warn(`[${this.loggerScope}]`, 'Class not found', { className });
            return false;
        }

        const removed = character.progression.classes.splice(index, 1)[0];

        console.info(`[${this.loggerScope}]`, 'Removed class level', { className });

        eventBus.emit(EVENTS.MULTICLASS_REMOVED, character, removed);
        return true;
    }

    /**
     * Get hit die for a class.
     * @param {string} className - Class name
     * @returns {string} Hit die (e.g., "d8", "d10")
     * @private
     */
    _getHitDiceForClass(className) {
        const hitDice = {
            'Barbarian': 'd12',
            'Bard': 'd8',
            'Cleric': 'd8',
            'Druid': 'd8',
            'Fighter': 'd10',
            'Monk': 'd8',
            'Paladin': 'd10',
            'Ranger': 'd10',
            'Rogue': 'd8',
            'Sorcerer': 'd6',
            'Warlock': 'd8',
            'Wizard': 'd6',
        };

        return hitDice[className] || 'd8'; // Default to d8
    }

    /**
     * Get class features available at a specific level.
     * @param {string} className - Class name
     * @param {number} level - Class level
     * @returns {Array} Array of feature objects
     */
    async getClassFeaturesForLevel(className, level) {
        try {
            const classData = await classService.getClass(className);
            if (!classData || !classData.classFeature) return [];

            return classData.classFeature
                .filter((feature) => {
                    // Match by class name and level
                    if (!feature.classSource || feature.classSource !== className) return false;
                    if (feature.level !== undefined && feature.level !== level) return false;
                    return true;
                })
                .map((feature) => ({
                    name: feature.name,
                    source: feature.source,
                    level: feature.level,
                    description: feature.entries,
                }));
        } catch (error) {
            console.error(`[${this.loggerScope}]`, 'Failed to load features', error);
            return [];
        }
    }

    /**
     * Get subclass features available at a specific level.
     * @param {string} className - Parent class name (e.g., "Cleric", "Rogue")
     * @param {string} subclassName - Subclass name or short name (e.g., "Life", "Thief")
     * @param {number} level - Class level
     * @returns {Array} Array of feature objects
     */
    async getSubclassFeaturesForLevel(className, subclassName, level) {
        try {
            // Get subclass features using ClassService's built-in method
            const features = classService.getSubclassFeatures(className, subclassName, level);

            return features.map((feature) => ({
                name: feature.name,
                source: feature.source,
                level: feature.level,
                description: feature.entries,
            }));
        } catch (error) {
            console.error(`[${this.loggerScope}]`, 'Failed to load subclass features', error);
            return [];
        }
    }

    /**
     * Get levels where this class gains ASI/feat options.
     * @returns {Array} Array of levels where ASI is available
     */
    getASILevels() {
        // Return standard D&D 5e ASI levels: 4, 8, 12, 16, 19
        return this.ASI_LEVELS;
    }

    /**
     * Check if a character has an ASI/feat option available at current level.
     * @param {Object} character - Character object
     * @returns {boolean} True if ASI is available
     */
    hasASIAvailable(character) {
        const currentLevel = character.level || 1;
        return this.ASI_LEVELS.includes(currentLevel);
    }

    /**
     * Record a level-up event with applied features and choices.
     * @param {Object} character - Character object
     * @param {number} fromLevel - Previous level
     * @param {number} toLevel - New level
     * @param {Object} changes - Changes applied { appliedFeats, appliedFeatures, changedAbilities }
     * @returns {void}
     */
    recordLevelUp(character, fromLevel, toLevel, changes = {}) {
        if (!character.progression) {
            character.progression = { classes: [], experiencePoints: 0, levelUps: [] };
        }

        const levelUpRecord = {
            fromLevel,
            toLevel,
            appliedFeats: changes.appliedFeats || [],
            appliedFeatures: changes.appliedFeatures || [],
            changedAbilities: changes.changedAbilities || {},
            timestamp: new Date().toISOString(),
        };

        character.progression.levelUps.push(levelUpRecord);

        console.info(`[${this.loggerScope}]`, 'Recorded level-up', levelUpRecord);
    }

    /**
     * Update spell slots for all classes based on current levels.
     * @param {Object} character - Character object
     * @returns {void}
     */
    updateSpellSlots(character) {
        if (!character.spellcasting || !character.progression) return;

        for (const classEntry of character.progression.classes) {
            if (character.spellcasting.classes[classEntry.name]) {
                const newSlots = spellSelectionService.calculateSpellSlots(
                    classEntry.name,
                    classEntry.level,
                );

                // Preserve current slot usage, update max
                const oldSlots = character.spellcasting.classes[classEntry.name].spellSlots;
                for (const level in newSlots) {
                    if (oldSlots[level]) {
                        newSlots[level].current = oldSlots[level].current;
                    }
                }

                character.spellcasting.classes[classEntry.name].spellSlots = newSlots;
            }
        }

        console.info(`[${this.loggerScope}]`, 'Updated spell slots');
    }

    /**
     * Calculate maximum hit points based on class levels, constitution, and level-ups.
     * @param {Object} character - Character object
     * @returns {number} Maximum hit points
     */
    calculateMaxHitPoints(character) {
        if (!character.progression || character.progression.classes.length === 0) {
            // Fallback: use level 1 class default
            const conMod = character.getAbilityModifier('constitution');
            return 8 + conMod; // Assuming d8 hit die default
        }

        let totalHP = 0;
        const conMod = character.getAbilityModifier('constitution');

        for (const classEntry of character.progression.classes) {
            // First level: full hit die
            const hitDiceValue = this._parseHitDice(classEntry.hitDice);
            totalHP += hitDiceValue;

            // Additional levels: average or rolled
            for (let i = 1; i < classEntry.level; i++) {
                const hpThisLevel = classEntry.hitPoints[i] || Math.ceil(hitDiceValue / 2);
                totalHP += hpThisLevel;
            }
        }

        // Apply CON modifier per level (minimum 1 per level)
        totalHP += Math.max(character.level || 1, (conMod * (character.level || 1)));

        return Math.max(1, totalHP);
    }

    /**
     * Parse a hit die string (e.g., "d8") to numeric value.
     * @param {string} hitDice - Hit die string
     * @returns {number} Numeric value
     * @private
     */
    _parseHitDice(hitDice) {
        const match = hitDice?.match(/d(\d+)/);
        return match ? parseInt(match[1], 10) : 8;
    }

    /**
     * D&D 5e multiclass ability score requirements.
     * @type {Object<string, Object>}
     */
    MULTICLASS_REQUIREMENTS = {
        'Barbarian': { strength: 13 },
        'Bard': { charisma: 13 },
        'Cleric': { wisdom: 13 },
        'Druid': { wisdom: 13 },
        'Fighter': { strength: 13, dexterity: 13 }, // Either STR or DEX
        'Monk': { dexterity: 13, wisdom: 13 },
        'Paladin': { strength: 13, charisma: 13 },
        'Ranger': { dexterity: 13, wisdom: 13 },
        'Rogue': { dexterity: 13 },
        'Sorcerer': { charisma: 13 },
        'Warlock': { charisma: 13 },
        'Wizard': { intelligence: 13 },
    };

    _ABILITY_ABBREVIATIONS = {
        strength: 'Str',
        dexterity: 'Dex',
        constitution: 'Con',
        intelligence: 'Int',
        wisdom: 'Wis',
        charisma: 'Cha',
    };

    _getAllClasses() {
        return ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
            'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'];
    }

    /**
     * Return a human-readable requirement string for a class (e.g., "Str 13 or Dex 13").
     * @param {string} className
     * @returns {string}
     */
    getRequirementText(className) {
        const req = this.MULTICLASS_REQUIREMENTS[className];
        if (!req) return '';

        // Fighter is special: either Str or Dex
        if (className === 'Fighter') {
            return `${this._ABILITY_ABBREVIATIONS.strength} 13 or ${this._ABILITY_ABBREVIATIONS.dexterity} 13`;
        }

        const parts = Object.entries(req).map(([ability, score]) => `${this._ABILITY_ABBREVIATIONS[ability] || ability} ${score}`);
        return parts.join(' & ');
    }

    /**
     * Check if a character meets multiclass requirements for a specific class.
     * @param {Object} character - Character object
     * @param {string} className - Class name to check
     * @returns {boolean} True if requirements are met
     */
    checkMulticlassRequirements(character, className) {
        const requirements = this.MULTICLASS_REQUIREMENTS[className];
        if (!requirements) {
            console.warn(`[${this.loggerScope}]`, `No requirements defined for class ${className}`);
            return true; // Unknown class, allow it
        }

        const getScore = (ability) => {
            if (typeof character.getAbilityScore === 'function') {
                return character.getAbilityScore(ability);
            }
            const raw = character.abilityScores?.[ability];
            return typeof raw === 'number' ? raw : 0;
        };

        // Check if character meets the requirements
        // For Fighter: Either STR >= 13 OR DEX >= 13
        if (className === 'Fighter') {
            const str = getScore('strength');
            const dex = getScore('dexterity');
            return str >= 13 || dex >= 13;
        }

        // For all other classes: ALL requirements must be met
        for (const [ability, minScore] of Object.entries(requirements)) {
            const score = getScore(ability);
            if (score < minScore) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get available classes for multiclassing based on character prerequisites.
     * @param {Object} character - Character object
     * @param {boolean} ignoreRequirements - If true, skip ability score checks
     * @returns {Array} Array of available class names
     */
    getAvailableClassesForMulticlass(character, ignoreRequirements = false) {
        const options = this.getMulticlassOptions(character, ignoreRequirements);
        return options.filter((opt) => opt.meetsRequirements).map((opt) => opt.name);
    }

    /**
     * Get multiclass options including requirement status and label text.
     * @param {Object} character
     * @param {boolean} ignoreRequirements
     * @returns {Array<{name: string, meetsRequirements: boolean, requirementText: string}>}
     */
    getMulticlassOptions(character, ignoreRequirements = false) {
        const allClasses = this._getAllClasses();
        const existingClasses = character.progression?.classes?.map((c) => c.name) || [];

        return allClasses
            .filter((cls) => !existingClasses.includes(cls))
            .map((cls) => {
                const meetsRequirements = ignoreRequirements
                    ? true
                    : this.checkMulticlassRequirements(character, cls);
                return {
                    name: cls,
                    meetsRequirements,
                    requirementText: this.getRequirementText(cls),
                };
            });
    }

    /**
     * Get multiclass spell slot combination rules.
     * Applies D&D 5e multiclass spellcasting rules if character is a spellcaster.
     * @param {Object} character - Character object
     * @returns {Object} Combined spell slots or empty if not applicable
     */
    calculateMulticlassSpellSlots(character) {
        if (!character.spellcasting?.classes || Object.keys(character.spellcasting.classes).length <= 1) {
            return {}; // Not multiclass casting
        }

        // Check if character is a full, half, or third caster
        const spellcastingClasses = Object.entries(character.spellcasting.classes).filter(
            ([_, classData]) => classData.spellSlots && Object.keys(classData.spellSlots).length > 0,
        );

        if (spellcastingClasses.length === 0) return {};

        // Combine spell slots per D&D 5e rules
        const combinedSlots = {};

        // For simplicity, combine available slots from all classes
        // In a full implementation, would follow half-caster / third-caster rules
        for (const [, classData] of spellcastingClasses) {
            for (const level in classData.spellSlots) {
                if (!combinedSlots[level]) {
                    combinedSlots[level] = { max: 0, current: 0 };
                }
                combinedSlots[level].max += classData.spellSlots[level].max;
                combinedSlots[level].current += classData.spellSlots[level].current;
            }
        }

        return combinedSlots;
    }
}

// Export singleton
export const levelUpService = new LevelUpService();
