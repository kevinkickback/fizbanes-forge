/**
 * PrerequisiteManager.js
 * Manager for validating prerequisites for feats and features
 */

import { eventEmitter } from '../utils/EventEmitter.js';
import { characterInitializer } from '../utils/Initialize.js';

/**
 * Manages validation of prerequisites for feats, features, and other character options
 */
export class PrerequisiteManager {
    /**
     * Creates a new PrerequisiteManager instance
     * @private
     */
    constructor() {
        /**
         * Data loader for fetching prerequisite-related data
         * @type {DataLoader}
         * @private
         */
        this._dataLoader = characterInitializer.dataLoader;

        /**
         * Flag to track initialization state
         * @type {boolean}
         * @private
         */
        this._initialized = false;
    }

    /**
     * Initializes the prerequisite manager
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) {
            return;
        }

        try {
            console.debug('Initializing prerequisite manager');

            // Perform any necessary initialization

            this._initialized = true;
            eventEmitter.emit('prerequisiteManager:initialized', this);
        } catch (error) {
            console.error('Failed to initialize prerequisite manager:', error);
            throw error;
        }
    }

    /**
     * Checks if a character meets all prerequisites
     * @param {Character} character - Character to check
     * @param {Object} prerequisites - Prerequisites to validate
     * @returns {boolean} True if all prerequisites are met
     */
    checkPrerequisites(character, prerequisites) {
        if (!prerequisites) return true;

        try {
            // Check each type of prerequisite
            const result = this.checkAbilityPrerequisites(character, prerequisites.ability) &&
                this.checkProficiencyPrerequisites(character, prerequisites.proficiency) &&
                this.checkLevelPrerequisites(character, prerequisites.level) &&
                this.checkSpellcastingPrerequisites(character, prerequisites.spellcasting) &&
                this.checkFeatPrerequisites(character, prerequisites.feat) &&
                this.checkClassPrerequisites(character, prerequisites.class);

            return result;
        } catch (error) {
            console.error('Error checking prerequisites:', error);
            return false;
        }
    }

    /**
     * Checks ability score prerequisites
     * @param {Character} character - Character to check
     * @param {Object} abilityReqs - Ability score requirements
     * @returns {boolean} True if all ability score prerequisites are met
     * @private
     */
    checkAbilityPrerequisites(character, abilityReqs) {
        if (!abilityReqs) return true;

        for (const [ability, score] of Object.entries(abilityReqs)) {
            if (character.getAbilityScore(ability) < score) {
                return false;
            }
        }

        return true;
    }

    /**
     * Checks proficiency prerequisites
     * @param {Character} character - Character to check
     * @param {Array} proficiencyReqs - Proficiency requirements
     * @returns {boolean} True if all proficiency prerequisites are met
     * @private
     */
    checkProficiencyPrerequisites(character, proficiencyReqs) {
        if (!proficiencyReqs) return true;

        for (const prof of proficiencyReqs) {
            if (!character.hasProficiency(prof.type, prof.name)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Checks character level prerequisites
     * @param {Character} character - Character to check
     * @param {number} levelReq - Required level
     * @returns {boolean} True if the level prerequisite is met
     * @private
     */
    checkLevelPrerequisites(character, levelReq) {
        if (!levelReq) return true;
        return character.level >= levelReq;
    }

    /**
     * Checks spellcasting ability prerequisites
     * @param {Character} character - Character to check
     * @param {boolean} spellcastingReq - Whether spellcasting is required
     * @returns {boolean} True if the spellcasting prerequisite is met
     * @private
     */
    checkSpellcastingPrerequisites(character, spellcastingReq) {
        if (!spellcastingReq) return true;
        return character.hasSpellcasting;
    }

    /**
     * Checks feat prerequisites
     * @param {Character} character - Character to check
     * @param {string} featReq - Required feat
     * @returns {boolean} True if the feat prerequisite is met
     * @private
     */
    checkFeatPrerequisites(character, featReq) {
        if (!featReq) return true;
        return character.feats.hasFeat(featReq);
    }

    /**
     * Checks class prerequisites
     * @param {Character} character - Character to check
     * @param {string|Object} classReq - Class requirement
     * @returns {boolean} True if the class prerequisite is met
     * @private
     */
    checkClassPrerequisites(character, classReq) {
        if (!classReq) return true;

        if (typeof classReq === 'string') {
            return character.hasClass(classReq);
        }

        // Handle class with level requirement
        if (classReq.name && classReq.level) {
            const classLevel = character.getClassLevel(classReq.name);
            return classLevel >= classReq.level;
        }

        // Handle OR conditions
        if (classReq.or) {
            return classReq.or.some(req => this.checkClassPrerequisites(character, req));
        }

        // Handle AND conditions
        if (classReq.and) {
            return classReq.and.every(req => this.checkClassPrerequisites(character, req));
        }

        return false;
    }

    /**
     * Gets a list of prerequisites that a character fails to meet
     * @param {Character} character - Character to check
     * @param {Object} prerequisites - Prerequisites to validate
     * @returns {Array<string>} List of failed prerequisites
     */
    getFailedPrerequisites(character, prerequisites) {
        if (!prerequisites) return [];

        try {
            const failed = [];

            // Check ability scores
            if (prerequisites.ability) {
                for (const [ability, score] of Object.entries(prerequisites.ability)) {
                    if (character.getAbilityScore(ability) < score) {
                        failed.push(`${ability.charAt(0).toUpperCase() + ability.slice(1)} score of ${score}`);
                    }
                }
            }

            // Check proficiencies
            if (prerequisites.proficiency) {
                for (const prof of prerequisites.proficiency) {
                    if (!character.hasProficiency(prof.type, prof.name)) {
                        failed.push(`${prof.type} proficiency in ${prof.name}`);
                    }
                }
            }

            // Check level
            if (prerequisites.level && character.level < prerequisites.level) {
                failed.push(`Character level ${prerequisites.level}`);
            }

            // Check spellcasting
            if (prerequisites.spellcasting && !character.hasSpellcasting) {
                failed.push('Ability to cast at least one spell');
            }

            // Check feat
            if (prerequisites.feat && !character.feats.hasFeat(prerequisites.feat)) {
                failed.push(`${prerequisites.feat} feat`);
            }

            // Check class
            if (prerequisites.class) {
                const classReq = prerequisites.class;
                if (typeof classReq === 'string' && !character.hasClass(classReq)) {
                    failed.push(`${classReq} class`);
                } else if (classReq.name && classReq.level) {
                    const classLevel = character.getClassLevel(classReq.name);
                    if (classLevel < classReq.level) {
                        failed.push(`${classReq.name} level ${classReq.level}`);
                    }
                }
            }

            return failed;
        } catch (error) {
            console.error('Error getting failed prerequisites:', error);
            return ['Error checking prerequisites'];
        }
    }
}

/**
 * Export the singleton instance
 * @type {PrerequisiteManager}
 */
export const prerequisiteManager = new PrerequisiteManager(); 