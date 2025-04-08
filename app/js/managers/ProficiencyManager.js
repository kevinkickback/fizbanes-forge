/**
 * ProficiencyManager.js
 * Manager for managing proficiencies and proficiency bonuses
 */

import { eventEmitter } from '../utils/EventEmitter.js';

/**
 * Manages proficiencies and proficiency-related calculations
 */
export class ProficiencyManager {
    /**
     * Creates a new ProficiencyManager instance
     * @private
     */
    constructor() {
        this._initialized = false;
        this._skills = null;
        this._tools = null;
        this._languages = null;
        this._skillAbilityMap = {
            'Acrobatics': 'dexterity',
            'Animal Handling': 'wisdom',
            'Arcana': 'intelligence',
            'Athletics': 'strength',
            'Deception': 'charisma',
            'History': 'intelligence',
            'Insight': 'wisdom',
            'Intimidation': 'charisma',
            'Investigation': 'intelligence',
            'Medicine': 'wisdom',
            'Nature': 'intelligence',
            'Perception': 'wisdom',
            'Performance': 'charisma',
            'Persuasion': 'charisma',
            'Religion': 'intelligence',
            'Sleight of Hand': 'dexterity',
            'Stealth': 'dexterity',
            'Survival': 'wisdom'
        };
    }

    /**
     * Initializes the proficiency manager
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) {
            return;
        }

        try {
            console.debug('Initializing proficiency manager');

            // Cache commonly used data
            this._skills = await this.getAvailableSkills();
            this._tools = await this.getAvailableTools();
            this._languages = await this.getAvailableLanguages();

            this._initialized = true;
            eventEmitter.emit('proficiencyManager:initialized', this);
        } catch (error) {
            console.error('Failed to initialize proficiency manager:', error);
            throw error;
        }
    }

    /**
     * Calculates the proficiency bonus based on character level
     * @param {number} level - Character level
     * @returns {number} Proficiency bonus
     */
    calculateProficiencyBonus(level) {
        return Math.floor((level - 1) / 4) + 2;
    }

    /**
     * Gets all available skills
     * @returns {Promise<string[]>} List of all available skills
     */
    async getAvailableSkills() {
        if (this._skills) {
            return [...this._skills];
        }

        return [
            'Acrobatics',
            'Animal Handling',
            'Arcana',
            'Athletics',
            'Deception',
            'History',
            'Insight',
            'Intimidation',
            'Investigation',
            'Medicine',
            'Nature',
            'Perception',
            'Performance',
            'Persuasion',
            'Religion',
            'Sleight of Hand',
            'Stealth',
            'Survival'
        ];
    }

    /**
     * Gets all available tools
     * @returns {Promise<string[]>} List of all available tools
     */
    async getAvailableTools() {
        if (this._tools) {
            return [...this._tools];
        }

        return [
            "Alchemist's supplies",
            "Brewer's supplies",
            "Calligrapher's supplies",
            "Carpenter's tools",
            "Cartographer's tools",
            "Cobbler's tools",
            "Cook's utensils",
            "Glassblower's tools",
            "Jeweler's tools",
            "Leatherworker's tools",
            "Mason's tools",
            "Painter's supplies",
            "Potter's tools",
            "Smith's tools",
            "Tinker's tools",
            "Weaver's tools",
            "Woodcarver's tools",
            "Disguise kit",
            "Forgery kit",
            "Gaming set",
            "Herbalism kit",
            "Musical instrument",
            "Navigator's tools",
            "Poisoner's kit",
            "Thieves' tools"
        ];
    }

    /**
     * Gets all available languages
     * @returns {Promise<string[]>} List of all available languages
     */
    async getAvailableLanguages() {
        if (this._languages) {
            return [...this._languages];
        }

        return [
            'Common',
            'Dwarvish',
            'Elvish',
            'Giant',
            'Gnomish',
            'Goblin',
            'Halfling',
            'Orc',
            'Abyssal',
            'Celestial',
            'Draconic',
            'Deep Speech',
            'Infernal',
            'Primordial',
            'Sylvan',
            'Undercommon'
        ];
    }

    /**
     * Gets the associated ability score for a skill
     * @param {string} skill - Skill name
     * @returns {string|null} The ability score associated with the skill, or null if invalid
     */
    getSkillAbility(skill) {
        return this._skillAbilityMap[skill] || null;
    }

    /**
     * Validates if a skill exists
     * @param {string} skill - Skill name to validate
     * @returns {boolean} True if the skill is valid
     */
    validateSkill(skill) {
        return this.getSkillAbility(skill) !== null;
    }

    /**
     * Validates if a tool exists
     * @param {string} tool - Tool name to validate
     * @returns {boolean} True if the tool is valid
     */
    async validateTool(tool) {
        const tools = await this.getAvailableTools();
        return tools.includes(tool);
    }

    /**
     * Validates if a language exists
     * @param {string} language - Language name to validate
     * @returns {boolean} True if the language is valid
     */
    async validateLanguage(language) {
        const languages = await this.getAvailableLanguages();
        return languages.includes(language);
    }

    /**
     * Calculates the skill modifier for a character
     * @param {Character} character - Character object
     * @param {string} skill - Skill name
     * @returns {number} The skill modifier
     */
    calculateSkillModifier(character, skill) {
        const ability = this.getSkillAbility(skill);
        if (!ability) return 0;

        const abilityMod = character.getAbilityModifier(ability);
        const profBonus = character.hasProficiency('skill', skill) ?
            this.calculateProficiencyBonus(character.level) : 0;

        return abilityMod + profBonus;
    }

    /**
     * Formats a modifier value with a + or - sign
     * @param {number} value - The modifier value
     * @returns {string} Formatted modifier string
     */
    formatModifier(value) {
        return value >= 0 ? `+${value}` : value.toString();
    }
}

/**
 * Export the singleton instance
 * @type {ProficiencyManager}
 */
export const proficiencyManager = new ProficiencyManager(); 