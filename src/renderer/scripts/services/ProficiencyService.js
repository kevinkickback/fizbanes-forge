/** Manages proficiencies and proficiency bonuses. */

import { ProficiencyCore } from '../core/Proficiency.js';
import { SKILL_TO_ABILITY } from '../utils/5eToolsParser.js';
import DataNormalizer from '../utils/DataNormalizer.js';
import { eventBus, EVENTS } from '../utils/EventBus.js';
import {
	STANDARD_LANGUAGE_OPTIONS,
	STANDARD_SKILL_OPTIONS,
	STANDARD_TOOL_OPTIONS,
} from '../utils/ProficiencyConstants.js';

/** Manages proficiencies and proficiency-related calculations. */
export class ProficiencyService {
	/** Creates a new ProficiencyManager instance. */
	constructor() {
		this._initialized = false;
		this._skills = null;
		this._tools = null;
		this._languages = null;
	}

	/**
	 * Initializes the proficiency manager
	 * @returns {Promise<void>}
	 */
	async initialize() {
		if (this._initialized) {
			console.debug('ProficiencyService', 'Already initialized');
			return;
		}

		try {
			console.info('[ProficiencyService]', 'Initializing proficiency manager');

			// Cache commonly used data
			this._skills = await this.getAvailableSkills();
			this._tools = await this.getAvailableTools();
			this._languages = await this.getAvailableLanguages();

			this._initialized = true;
			console.info(
				'[ProficiencyService]',
				'Proficiency manager initialized successfully',
				{
					skillCount: this._skills?.length,
					toolCount: this._tools?.length,
					languageCount: this._languages?.length,
				},
			);
			eventBus.emit(EVENTS.SERVICE_INITIALIZED, 'proficiency', this);
		} catch (error) {
			console.error(
				'ProficiencyService',
				'Failed to initialize proficiency manager',
				error,
			);
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

		return [...STANDARD_SKILL_OPTIONS];
	}

	/**
	 * Gets all available tools
	 * @returns {Promise<string[]>} List of all available tools
	 */
	async getAvailableTools() {
		if (this._tools) {
			return [...this._tools];
		}

		return [...STANDARD_TOOL_OPTIONS];
	}

	/**
	 * Gets all available languages
	 * @returns {Promise<string[]>} List of all available languages
	 */
	async getAvailableLanguages() {
		if (this._languages) {
			return [...this._languages];
		}

		return [...STANDARD_LANGUAGE_OPTIONS];
	}

	/**
	 * Gets the associated ability score for a skill
	 * @param {string} skill - Skill name
	 * @returns {string|null} The ability score associated with the skill, or null if invalid
	 */
	getSkillAbility(skill) {
		if (!skill) return null;
		const normalized = DataNormalizer.normalizeForLookup(skill);
		const abilityAbv = SKILL_TO_ABILITY[normalized];
		if (!abilityAbv) return null;

		// Map abbreviations to full names for compatibility
		const abvToFull = {
			str: 'strength',
			dex: 'dexterity',
			con: 'constitution',
			int: 'intelligence',
			wis: 'wisdom',
			cha: 'charisma',
		};
		return abvToFull[abilityAbv] || null;
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
		const profBonus = character.hasProficiency('skill', skill)
			? this.calculateProficiencyBonus(character.level)
			: 0;

		return abilityMod + profBonus;
	}

	/**
	 * Formats a modifier value with a + or - sign
	 * @param {number} value - The modifier value
	 * @returns {string} Formatted modifier string	 * @deprecated Consider using getAbilityModifier from 5eToolsParser for consistency	 */
	formatModifier(value) {
		return value >= 0 ? `+${value}` : value.toString();
	}

	/**
	 * Adds a proficiency to a character with source tracking
	 * Delegates to ProficiencyCore
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} proficiency - Proficiency name
	 * @param {string} source - Source granting the proficiency
	 * @returns {boolean} True if added successfully
	 */
	addProficiency(character, type, proficiency, source) {
		return ProficiencyCore.addProficiency(character, type, proficiency, source);
	}

	/**
	 * Removes proficiencies from a specific source
	 * Delegates to ProficiencyCore
	 * @param {Object} character - The character object
	 * @param {string} source - Source to remove proficiencies from
	 * @returns {Object} Object with arrays of removed proficiencies by type
	 */
	removeProficienciesBySource(character, source) {
		return ProficiencyCore.removeProficienciesBySource(character, source);
	}

	/**
	 * Sets up optional proficiency configuration for a source
	 * Delegates to ProficiencyCore
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} source - Source identifier ('race', 'class', 'background')
	 * @param {number} allowed - Number of proficiencies allowed
	 * @param {string[]} options - Available proficiency options
	 */
	setOptionalProficiencies(character, type, source, allowed, options) {
		return ProficiencyCore.setOptionalProficiencies(
			character,
			type,
			source,
			allowed,
			options,
		);
	}

	/**
	 * Clears optional proficiency configuration for a source
	 * Delegates to ProficiencyCore
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} source - Source identifier
	 */
	clearOptionalProficiencies(character, type, source) {
		return ProficiencyCore.clearOptionalProficiencies(character, type, source);
	}

	/**
	 * Gets available options for optional proficiency selection
	 * Delegates to ProficiencyCore
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} source - Source identifier
	 * @returns {string[]} Array of available proficiency names
	 */
	getAvailableOptionalProficiencies(character, type, source) {
		return ProficiencyCore.getAvailableOptionalProficiencies(
			character,
			type,
			source,
		);
	}

	/**
	 * Selects an optional proficiency for a character
	 * Delegates to ProficiencyCore
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} source - Source identifier
	 * @param {string} proficiency - The proficiency to select
	 * @returns {boolean} True if selection was successful
	 */
	selectOptionalProficiency(character, type, source, proficiency) {
		return ProficiencyCore.selectOptionalProficiency(
			character,
			type,
			source,
			proficiency,
		);
	}

	/**
	 * Deselects an optional proficiency
	 * Delegates to ProficiencyCore
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @param {string} source - Source identifier
	 * @param {string} proficiency - The proficiency to deselect
	 * @returns {boolean} True if deselection was successful
	 */
	deselectOptionalProficiency(character, type, source, proficiency) {
		return ProficiencyCore.deselectOptionalProficiency(
			character,
			type,
			source,
			proficiency,
		);
	}

	/**
	 * Gets all proficiencies of a type with their sources
	 * Delegates to ProficiencyCore
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type
	 * @returns {Array<{name: string, sources: Set<string>}>} Array of proficiencies with sources
	 */
	getProficienciesWithSources(character, type) {
		return ProficiencyCore.getProficienciesWithSources(character, type);
	}
}

/**
 * Export the singleton instance
 * @type {ProficiencyManager}
 */
export const proficiencyService = new ProficiencyService();
