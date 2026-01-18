/** Manages character level progression, multiclass tracking, and feature application. */
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { classService } from './ClassService.js';
import { sourceService } from './SourceService.js';
import { spellSelectionService } from './SpellSelectionService.js';

class LevelUpService {
    constructor() {
        this.loggerScope = 'LevelUpService';
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
        // Note: progression.classes is the single source of truth
        // No legacy character.class field to sync
    }

    /**
     * Get total character level (calculated from progression.classes[])
     * @param {Object} character - Character object
     * @returns {number} Total character level
     */
    getTotalLevel(character) {
        if (!character?.progression?.classes || character.progression.classes.length === 0) {
            return 1;
        }
        return character.progression.classes.reduce((sum, c) => sum + (c.levels || 0), 0);
    }

    /**
     * Add or increase a class level for multiclassing.
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @param {number} level - Level in that class (default 1)
     * @returns {Object} Class progression entry or null
     */
    addClassLevel(character, className, level = 1, source = 'PHB') {
        if (!character.progression) {
            this.initializeProgression(character);
        }

        // Check if class already exists
        let classEntry = character.progression.classes.find(
            (c) => c.name === className,
        );

        if (classEntry) {
            classEntry.levels = level;
            // Update source if provided and currently missing
            if (source && !classEntry.source) {
                classEntry.source = source;
            }
            console.info(`[${this.loggerScope}]`, 'Updated class level', {
                className,
                level,
            });
            return classEntry;
        }

        // Create new class entry
        classEntry = {
            name: className,
            source,
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
    getClassFeaturesForLevel(className, level) {
        try {
            // Use ClassService's built-in getClassFeatures which properly handles filtering
            const features = classService.getClassFeatures(className, level);

            return features.map((feature) => ({
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
     * Get ASI levels for a specific class by parsing class features from JSON.
     * @param {string} className - Name of the class
     * @returns {Array<number>} Array of levels where ASI is available
     * @private
     */
    _getASILevelsForClass(className) {
        const classData = classService.getClass(className);
        if (!classData?.classFeatures) {
            // Fallback to standard ASI levels if no class data found
            return [4, 8, 12, 16, 19];
        }

        const asiLevels = new Set();
        const features = classData.classFeatures;

        // Parse classFeatures array looking for "Ability Score Improvement" features
        for (const feature of features) {
            let featureName = '';
            let featureLevel = null;

            // Feature can be a string like "Ability Score Improvement|Fighter||4"
            // or an object with "classFeature" property
            if (typeof feature === 'string') {
                const parts = feature.split('|');
                featureName = parts[0];
                // Last non-empty part is typically the level
                for (let i = parts.length - 1; i >= 0; i--) {
                    if (parts[i] && Number.isNaN(Number(parts[i])) === false) {
                        featureLevel = parseInt(parts[i], 10);
                        break;
                    }
                }
            } else if (feature && typeof feature === 'object') {
                // Skip object-based features for now (usually subclass features)
                continue;
            }

            // Check if this is an ASI feature
            if (featureName.includes('Ability Score Improvement') && featureLevel !== null) {
                asiLevels.add(featureLevel);
            }
        }

        // If we found ASI levels in the JSON, return them sorted
        if (asiLevels.size > 0) {
            return Array.from(asiLevels).sort((a, b) => a - b);
        }

        // Fallback to standard ASI levels
        return [4, 8, 12, 16, 19];
    }

    /**
     * Get combined ASI levels for a multiclass character.
     * Returns unique levels where ANY of the character's classes gains an ASI.
     * @param {Object} character - Character object
     * @returns {Array<number>} Array of levels where ASI is available
     */
    getASILevels(character) {
        if (!character?.progression?.classes || character.progression.classes.length === 0) {
            // No classes yet, return standard
            return [4, 8, 12, 16, 19];
        }

        // Collect all ASI levels from all classes
        const allASILevels = new Set();
        for (const classEntry of character.progression.classes) {
            const asiLevels = this._getASILevelsForClass(classEntry.name);
            for (const level of asiLevels) {
                allASILevels.add(level);
            }
        }

        return Array.from(allASILevels).sort((a, b) => a - b);
    }

    /**
     * Check if a character has an ASI/feat option available at current level.
     * @param {Object} character - Character object
     * @returns {boolean} True if ASI is available at current level
     */
    hasASIAvailable(character) {
        const currentLevel = this.getTotalLevel(character);
        const asiLevels = this.getASILevels(character);
        return asiLevels.includes(currentLevel);
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
        const totalLevel = this.getTotalLevel(character);
        totalHP += Math.max(totalLevel, (conMod * totalLevel));

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
     * Map 5etools ability abbreviations to full names.
     * @param {string} abbr - Ability abbreviation
     * @returns {string} Full ability name
     * @private
     */
    _mapAbilityAbbreviation(abbr) {
        const abilityMap = {
            'str': 'strength',
            'dex': 'dexterity',
            'con': 'constitution',
            'int': 'intelligence',
            'wis': 'wisdom',
            'cha': 'charisma'
        };
        return abilityMap[abbr] || abbr;
    }

    /**
     * Get abbreviated ability name for display.
     * @param {string} ability - Full ability name
     * @returns {string} Abbreviated name
     * @private
     */
    _getAbilityAbbreviation(ability) {
        const abbreviations = {
            strength: 'Str',
            dexterity: 'Dex',
            constitution: 'Con',
            intelligence: 'Int',
            wisdom: 'Wis',
            charisma: 'Cha',
        };
        return abbreviations[ability] || ability;
    }

    /**
     * Get all available classes from JSON data.
     * @returns {Array<string>} Array of unique class names
     * @private
     */
    _getAllClasses() {
        const classes = classService.getAllClasses();
        // Filter by allowed sources and avoid duplicates
        // Also exclude sidekick classes
        const uniqueNames = new Set();
        const result = [];

        for (const cls of classes) {
            // Skip sidekick classes (Spellcaster Sidekick, Warrior Sidekick, etc.)
            if (cls.isSidekick) {
                continue;
            }

            // Check if source is allowed
            if (!sourceService.isSourceAllowed(cls.source)) {
                continue;
            }

            // Keep one version per class name (prefer non-reprinted versions)
            if (!uniqueNames.has(cls.name)) {
                uniqueNames.add(cls.name);
                result.push(cls.name);
            }
        }

        return result.sort();
    }

    /**
     * Return a human-readable requirement string for a class from JSON data.
     * @param {string} className
     * @returns {string}
     */
    getRequirementText(className) {
        const classData = classService.getClass(className);
        if (!classData?.multiclassing?.requirements) {
            return '';
        }

        const req = classData.multiclassing.requirements;

        // Handle OR requirements (e.g., Fighter: Str 13 or Dex 13)
        if (req.or && Array.isArray(req.or)) {
            const orParts = [];
            for (const orGroup of req.or) {
                const abilities = Object.entries(orGroup)
                    .map(([abbr, score]) => {
                        const fullName = this._mapAbilityAbbreviation(abbr);
                        return `${this._getAbilityAbbreviation(fullName)} ${score}`;
                    });
                orParts.push(abilities.join(' & '));
            }
            return orParts.join(' or ');
        }

        // Handle regular AND requirements
        const parts = Object.entries(req)
            .map(([abbr, score]) => {
                const fullName = this._mapAbilityAbbreviation(abbr);
                return `${this._getAbilityAbbreviation(fullName)} ${score}`;
            });
        return parts.join(' & ');
    }

    /**
     * Check if a character meets multiclass requirements for a specific class from JSON data.
     * @param {Object} character - Character object
     * @param {string} className - Class name to check
     * @returns {boolean} True if requirements are met
     */
    checkMulticlassRequirements(character, className) {
        const classData = classService.getClass(className);
        if (!classData?.multiclassing?.requirements) {
            console.warn(`[${this.loggerScope}]`, `No multiclass requirements for class ${className}`);
            return true; // No requirements, allow it
        }

        const requirements = classData.multiclassing.requirements;

        const getScore = (ability) => {
            if (typeof character.getAbilityScore === 'function') {
                return character.getAbilityScore(ability);
            }
            const raw = character.abilityScores?.[ability];
            return typeof raw === 'number' ? raw : 0;
        };

        // Handle OR requirements (e.g., Fighter: Str 13 OR Dex 13)
        if (requirements.or && Array.isArray(requirements.or)) {
            for (const orGroup of requirements.or) {
                // Check if ALL requirements in this OR group are met
                const allMet = Object.entries(orGroup).every(([abbr, minScore]) => {
                    const fullName = this._mapAbilityAbbreviation(abbr);
                    const score = getScore(fullName);
                    return score >= minScore;
                });
                if (allMet) {
                    return true; // At least one OR group satisfied
                }
            }
            return false; // No OR groups satisfied
        }

        // Handle regular AND requirements
        for (const [abbr, minScore] of Object.entries(requirements)) {
            const fullName = this._mapAbilityAbbreviation(abbr);
            const score = getScore(fullName);
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
     * @param {boolean} ignoreRequirements - If true, all classes meet requirements
     * @returns {Array<{name: string, meetsRequirements: boolean, requirementText: string}>}
     */
    getMulticlassOptions(character, ignoreRequirements = false) {
        const allClasses = this._getAllClasses();
        const existingClasses = character.progression?.classes?.map((c) => c.name) || [];

        return allClasses
            .filter((cls) => !existingClasses.includes(cls))
            .map((cls) => {
                // When ignoring requirements, mark all as meeting requirements
                const meetsRequirements = ignoreRequirements || this.checkMulticlassRequirements(character, cls);
                return {
                    name: cls,
                    meetsRequirements,
                    requirementText: this.getRequirementText(cls),
                };
            });
    }

    /**
     * Get multiclass spell slot combination rules.
     * Applies D&D 5e multiclass spellcasting rules properly.
     * @param {Object} character - Character object
     * @returns {Object} Combined spell slots or empty if not applicable
     */
    calculateMulticlassSpellSlots(character) {
        if (!character.progression?.classes || character.progression.classes.length <= 1) {
            return {}; // Not multiclassing
        }

        let totalCasterLevel = 0;
        const warlockLevels = [];

        // Calculate combined caster level per D&D 5e rules
        for (const classEntry of character.progression.classes) {
            const classData = classService.getClass(classEntry.name);
            if (!classData || !classData.casterProgression) {
                continue; // Non-spellcaster
            }

            const progression = classData.casterProgression;

            if (progression === 'pact') {
                // Warlock pact magic doesn't combine - track separately
                warlockLevels.push(classEntry.level);
            } else if (progression === 'full') {
                // Full casters contribute full level
                totalCasterLevel += classEntry.level;
            } else if (progression === '1/2') {
                // Half casters contribute half level (rounded down)
                totalCasterLevel += Math.floor(classEntry.level / 2);
            } else if (progression === '1/3') {
                // Third casters contribute third level (rounded down)
                totalCasterLevel += Math.floor(classEntry.level / 3);
            }
        }

        // Get spell slots based on total caster level
        const combinedSlots = spellSelectionService._getStandardSpellSlots(totalCasterLevel);

        // Note: Warlock pact magic slots remain separate and are tracked per-class
        // They don't combine with standard spellcasting spell slots

        return combinedSlots;
    }

    /**
     * Get pending choices for a specific level-up.
     * Used by build page to detect what choices are needed after leveling up.
     * @param {Object} character - Character object
     * @param {string} className - Class name
     * @param {number} level - Level to check
     * @returns {Object} Pending choices object with categories
     */
    getPendingChoicesForLevel(character, className, level) {
        const choices = {
            subclass: null,
            asi: null,
            features: [],
            spells: null,
        };

        const classData = classService.getClass(className);
        if (!classData) return choices;

        const classEntry = character.progression?.classes?.find(c => c.name === className);
        if (!classEntry) return choices;

        // Check subclass requirement
        const subclassLevel = classData.subclassTitle?.level || 3;
        if (level >= subclassLevel && !classEntry.subclass) {
            choices.subclass = {
                level: subclassLevel,
                required: true,
            };
        }

        // Check ASI availability
        const asiLevels = this._getASILevelsForClass(className);
        if (asiLevels.includes(level)) {
            // Check if ASI was already used at this level
            const levelUps = character.progression?.levelUps || [];
            const asiUsed = levelUps.some(lu => {
                const isThisLevel = lu.toLevel === level;
                const hasChanges = (lu.changedAbilities && Object.keys(lu.changedAbilities).length > 0) ||
                                 (lu.appliedFeats && lu.appliedFeats.length > 0);
                return isThisLevel && hasChanges;
            });

            if (!asiUsed) {
                choices.asi = {
                    level,
                    available: true,
                };
            }
        }

        // Check class features with choices
        const features = classService.getClassFeatures(className, level, classData.source || 'PHB');
        for (const feature of features) {
            const featureName = feature.name || '';
            const hasChoice = featureName.includes('Fighting Style') ||
                            featureName.includes('Metamagic') ||
                            featureName.includes('Eldritch Invocations') ||
                            featureName.includes('Pact Boon');

            if (hasChoice && feature.level === level) {
                choices.features.push({
                    name: featureName,
                    level: feature.level,
                    type: this._detectFeatureType(featureName),
                });
            }
        }

        // Check spell availability (if spellcaster)
        if (classData.spellcastingAbility) {
            const spellInfo = spellSelectionService.getPendingSpellChoices?.(character) || [];
            const classSpellInfo = spellInfo.find(s => s.class === className);
            if (classSpellInfo) {
                choices.spells = classSpellInfo;
            }
        }

        return choices;
    }

    /**
     * Detect feature type from name
     * @private
     */
    _detectFeatureType(featureName) {
        if (featureName.includes('Fighting Style')) return 'fightingStyle';
        if (featureName.includes('Metamagic')) return 'metamagic';
        if (featureName.includes('Eldritch Invocations')) return 'invocations';
        if (featureName.includes('Pact Boon')) return 'pactBoon';
        return 'other';
    }
}

// Export singleton
export const levelUpService = new LevelUpService();
