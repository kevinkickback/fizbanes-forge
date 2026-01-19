/** Manages proficiencies and proficiency bonuses. */
import { ProficiencyCore } from '../app/Proficiency.js';
import { SKILL_TO_ABILITY } from '../lib/5eToolsParser.js';
import { DataLoader } from '../lib/DataLoader.js';
import DataNormalizer from '../lib/DataNormalizer.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import {
	STANDARD_LANGUAGE_OPTIONS,
	STANDARD_SKILL_OPTIONS,
	STANDARD_TOOL_OPTIONS,
} from '../lib/ProficiencyConstants.js';
import { itemService } from './ItemService.js';

export class ProficiencyService {
	constructor() {
		this._initialized = false;
		this._skills = null;
		this._tools = null;
		this._languages = null;
		this._skillData = null;
		this._languageData = null;
	}

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
			? this.calculateProficiencyBonus(character.getTotalLevel())
			: 0;

		return abilityMod + profBonus;
	}

	/**
	 * Formats a modifier value with a + or - sign.
	 * @deprecated Use getAbilityModifier from 5eToolsParser instead.
	 */
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

	/**
	 * Loads skill data from JSON file
	 * @private
	 */
	async _loadSkillData() {
		if (this._skillData) return this._skillData;

		try {
			const data = await DataLoader.loadJSON('skills.json');
			this._skillData = data?.skill || [];
			return this._skillData;
		} catch (error) {
			console.error('[ProficiencyService]', 'Failed to load skill data', error);
			this._skillData = [];
			return [];
		}
	}

	/**
	 * Loads language data from JSON file
	 * @private
	 */
	async _loadLanguageData() {
		if (this._languageData) return this._languageData;

		try {
			const data = await DataLoader.loadJSON('languages.json');
			this._languageData = data?.language || [];
			return this._languageData;
		} catch (error) {
			console.error('[ProficiencyService]', 'Failed to load language data', error);
			this._languageData = [];
			return [];
		}
	}

	/**
	 * Gets description for a skill
	 * @param {string} skillName - Name of the skill
	 * @returns {Promise<Object|null>} Object with name, ability, and description, or null if not found
	 */
	async getSkillDescription(skillName) {
		const skillData = await this._loadSkillData();
		if (!skillData || skillData.length === 0) return null;

		const normalizedSearch = DataNormalizer.normalizeForLookup(skillName);

		// Find the skill - prefer XPHB source (2024 rules), fallback to PHB
		let skill = skillData.find(s =>
			DataNormalizer.normalizeForLookup(s.name) === normalizedSearch &&
			s.source === 'XPHB'
		);

		if (!skill) {
			skill = skillData.find(s =>
				DataNormalizer.normalizeForLookup(s.name) === normalizedSearch &&
				s.source === 'PHB'
			);
		}

		if (!skill) {
			skill = skillData.find(s =>
				DataNormalizer.normalizeForLookup(s.name) === normalizedSearch
			);
		}

		if (!skill) return null;

		return {
			name: skill.name,
			ability: skill.ability,
			description: skill.entries?.join(' ') || 'No description available.',
			source: skill.source,
			page: skill.page
		};
	}

	/**
	 * Gets description for a language
	 * @param {string} languageName - Name of the language
	 * @returns {Promise<Object|null>} Object with name, type, script, speakers, and description, or null if not found
	 */
	async getLanguageDescription(languageName) {
		const languageData = await this._loadLanguageData();
		if (!languageData || languageData.length === 0) return null;

		const normalizedSearch = DataNormalizer.normalizeForLookup(languageName);

		// Find the language - prefer XPHB source, fallback to PHB, then any
		let language = languageData.find(l =>
			DataNormalizer.normalizeForLookup(l.name) === normalizedSearch &&
			l.source === 'XPHB'
		);

		if (!language) {
			language = languageData.find(l =>
				DataNormalizer.normalizeForLookup(l.name) === normalizedSearch &&
				l.source === 'PHB'
			);
		}

		if (!language) {
			language = languageData.find(l =>
				DataNormalizer.normalizeForLookup(l.name) === normalizedSearch
			);
		}

		if (!language) return null;

		return {
			name: language.name,
			type: language.type || 'standard',
			script: language.script,
			typicalSpeakers: language.typicalSpeakers || [],
			entries: language.entries || [],
			source: language.source,
			page: language.page
		};
	}

	/**
	 * Gets description for a tool proficiency
	 * @param {string} toolName - Name of the tool
	 * @returns {Promise<Object|null>} Object with name and description
	 */
	async getToolDescription(toolName) {
		const items = itemService.getAllItems();
		if (!items || items.length === 0) {
			console.warn('[ProficiencyService] No items available for tool lookup');
			return {
				name: toolName,
				description: `Proficiency with ${toolName.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`,
				type: 'tool'
			};
		}

		const normalizedSearch = DataNormalizer.normalizeForLookup(toolName);

		// Find the tool - prefer XPHB source, fallback to PHB
		let tool = items.find(item =>
			DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
			item.source === 'XPHB' &&
			(item.type === 'AT' || item.type?.includes('AT'))
		);

		if (!tool) {
			tool = items.find(item =>
				DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
				item.source === 'PHB' &&
				(item.type === 'AT' || item.type?.includes('AT'))
			);
		}

		if (!tool) {
			tool = items.find(item =>
				DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
				(item.type === 'AT' || item.type?.includes('AT'))
			);
		}

		if (!tool) {
			return {
				name: toolName,
				description: `Proficiency with ${toolName.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`,
				type: 'tool'
			};
		}

		// Extract text from entries - handle both string and object entries
		const extractText = (entry) => {
			if (typeof entry === 'string') return entry;
			if (entry.entries) return entry.entries.map(extractText).join(' ');
			if (entry.items) return entry.items.map(extractText).join(' ');
			return '';
		};

		let description = '';
		if (tool.entries && tool.entries.length > 0) {
			description = tool.entries.map(extractText).filter(Boolean).join(' ');
		} else if (tool.additionalEntries && tool.additionalEntries.length > 0) {
			description = tool.additionalEntries.map(extractText).filter(Boolean).join(' ');
		}

		if (!description) {
			description = `Proficiency with ${tool.name.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`;
		}

		return {
			name: tool.name,
			description,
			type: 'tool',
			source: tool.source,
			page: tool.page
		};
	}

	/**
	 * Gets description for armor proficiency
	 * @param {string} armorName - Name of the armor type
	 * @returns {Promise<Object|null>} Object with name and description
	 */
	async getArmorDescription(armorName) {
		const baseItems = itemService.getAllBaseItems();

		// Handle armor categories
		const armorCategories = {
			'Light Armor': 'LA',
			'Medium Armor': 'MA',
			'Heavy Armor': 'HA',
			'Shields': 'S'
		};

		const typeCode = armorCategories[armorName];

		if (typeCode) {
			// Return category description
			const examples = baseItems
				.filter(item => (item.type === typeCode || item.type === `${typeCode}|XPHB`) && item.armor)
				.slice(0, 3)
				.map(item => item.name);

			return {
				name: armorName,
				description: examples.length > 0
					? `You are proficient with ${armorName.toLowerCase()}. Examples include: ${examples.join(', ')}.`
					: `You are proficient with ${armorName.toLowerCase()}.`,
				type: 'armor'
			};
		}

		// Look for specific armor item
		const normalizedSearch = DataNormalizer.normalizeForLookup(armorName);
		let armor = baseItems.find(item =>
			DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
			item.armor &&
			item.source === 'XPHB'
		);

		if (!armor) {
			armor = baseItems.find(item =>
				DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
				item.armor
			);
		}

		if (!armor) {
			return {
				name: armorName,
				description: `You are proficient with ${armorName.toLowerCase()}.`,
				type: 'armor'
			};
		}

		return {
			name: armor.name,
			description: armor.entries?.join(' ') || `You are proficient with ${armor.name.toLowerCase()}.`,
			ac: armor.ac,
			weight: armor.weight,
			type: 'armor',
			source: armor.source,
			page: armor.page
		};
	}

	/**
	 * Gets description for weapon proficiency
	 * @param {string} weaponName - Name of the weapon type
	 * @returns {Promise<Object|null>} Object with name and description
	 */
	async getWeaponDescription(weaponName) {
		const baseItems = itemService.getAllBaseItems();

		// Handle weapon categories
		if (weaponName === 'Simple Weapons' || weaponName === 'Martial Weapons') {
			const category = weaponName === 'Simple Weapons' ? 'simple' : 'martial';
			const examples = baseItems
				.filter(item => item.weaponCategory === category && item.weapon)
				.slice(0, 5)
				.map(item => item.name);

			return {
				name: weaponName,
				description: examples.length > 0
					? `You are proficient with ${weaponName.toLowerCase()}. Examples include: ${examples.join(', ')}.`
					: `You are proficient with ${weaponName.toLowerCase()}.`,
				type: 'weapon'
			};
		}

		// Look for specific weapon
		const normalizedSearch = DataNormalizer.normalizeForLookup(weaponName);
		let weapon = baseItems.find(item =>
			DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
			item.weapon &&
			item.source === 'XPHB'
		);

		if (!weapon) {
			weapon = baseItems.find(item =>
				DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
				item.weapon
			);
		}

		if (!weapon) {
			return {
				name: weaponName,
				description: `You are proficient with ${weaponName.toLowerCase()}.`,
				type: 'weapon'
			};
		}

		const properties = [];
		if (weapon.dmg1) properties.push(`Damage: ${weapon.dmg1} ${weapon.dmgType}`);
		if (weapon.range) properties.push(`Range: ${weapon.range}`);
		if (weapon.weight) properties.push(`Weight: ${weapon.weight} lb.`);

		const description = weapon.entries?.join(' ') ||
			(properties.length > 0
				? `${weapon.name} (${properties.join(', ')})`
				: `You are proficient with ${weapon.name.toLowerCase()}.`);

		return {
			name: weapon.name,
			description,
			damage: weapon.dmg1,
			damageType: weapon.dmgType,
			weaponCategory: weapon.weaponCategory,
			type: 'weapon',
			source: weapon.source,
			page: weapon.page
		};
	}
}

/**
 * Export the singleton instance
 * @type {ProficiencyManager}
 */
export const proficiencyService = new ProficiencyService();
