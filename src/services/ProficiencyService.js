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

		// Import sourceService dynamically to avoid circular dependency
		const { sourceService } = await import('./SourceService.js');
		const allowedSources = new Set(sourceService.getAllowedSources().map(s => s.toUpperCase()));

		// Find the skill - prioritize allowed sources
		let skill = null;

		// First try XPHB if allowed
		if (allowedSources.has('XPHB')) {
			skill = skillData.find(s =>
				DataNormalizer.normalizeForLookup(s.name) === normalizedSearch &&
				s.source === 'XPHB'
			);
		}

		// Then try PHB if allowed and not found
		if (!skill && allowedSources.has('PHB')) {
			skill = skillData.find(s =>
				DataNormalizer.normalizeForLookup(s.name) === normalizedSearch &&
				s.source === 'PHB'
			);
		}

		// Finally try any allowed source
		if (!skill) {
			skill = skillData.find(s =>
				DataNormalizer.normalizeForLookup(s.name) === normalizedSearch &&
				allowedSources.has(s.source?.toUpperCase())
			);
		}

		if (!skill) return null;

		// Return entries as array so textProcessor can handle tags properly
		return {
			name: skill.name,
			ability: skill.ability,
			description: skill.entries || [],
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

		// Import sourceService dynamically to avoid circular dependency
		const { sourceService } = await import('./SourceService.js');
		const allowedSources = new Set(sourceService.getAllowedSources().map(s => s.toUpperCase()));

		// Find the language - prioritize allowed sources
		let language = null;

		// First try XPHB if allowed
		if (allowedSources.has('XPHB')) {
			language = languageData.find(l =>
				DataNormalizer.normalizeForLookup(l.name) === normalizedSearch &&
				l.source === 'XPHB'
			);
		}

		// Then try PHB if allowed and not found
		if (!language && allowedSources.has('PHB')) {
			language = languageData.find(l =>
				DataNormalizer.normalizeForLookup(l.name) === normalizedSearch &&
				l.source === 'PHB'
			);
		}

		// Finally try any allowed source
		if (!language) {
			language = languageData.find(l =>
				DataNormalizer.normalizeForLookup(l.name) === normalizedSearch &&
				allowedSources.has(l.source?.toUpperCase())
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

		// Import sourceService dynamically to avoid circular dependency
		const { sourceService } = await import('./SourceService.js');
		const allowedSources = new Set(sourceService.getAllowedSources().map(s => s.toUpperCase()));

		// Helper to check if item is a tool (AT=Artisan Tools, T=Tools, GS=Gaming Set, INS=Instrument)
		const isToolType = (type) => {
			if (!type) return false;
			const typeStr = String(type);
			return typeStr === 'AT' || typeStr === 'T' || typeStr === 'GS' || typeStr === 'INS' ||
				typeStr.includes('AT') || typeStr.includes('T|') || typeStr.includes('GS') || typeStr.includes('INS');
		};

		// Find the tool - prioritize allowed sources
		let tool = null;

		// First try XPHB if allowed
		if (allowedSources.has('XPHB')) {
			tool = items.find(item =>
				DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
				item.source === 'XPHB' &&
				isToolType(item.type)
			);
		}

		// Then try PHB if allowed and not found
		if (!tool && allowedSources.has('PHB')) {
			tool = items.find(item =>
				DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
				item.source === 'PHB' &&
				isToolType(item.type)
			);
		}

		// Finally try any allowed source
		if (!tool) {
			tool = items.find(item =>
				DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
				allowedSources.has(item.source?.toUpperCase()) &&
				isToolType(item.type)
			);
		}

		if (!tool) {
			return {
				name: toolName,
				description: [`Proficiency with ${toolName.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`],
				type: 'tool'
			};
		}

		// Return raw entries so textProcessor can handle tags properly
		let description = tool.entries || tool.additionalEntries || [];

		if (!description || description.length === 0) {
			description = [`Proficiency with ${tool.name.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`];
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
	 * @returns {Promise<Object|null>} Object with name, description, source, and page
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
			// Get category info from PHB book
			const categoryInfo = await this.getArmorCategoryInfo(armorName);

			// Return category description with book reference
			const examples = baseItems
				.filter(item => (item.type === typeCode || item.type === `${typeCode}|XPHB`) && item.armor)
				.slice(0, 3)
				.map(item => item.name);

			return {
				name: armorName,
				description: categoryInfo?.entries || (examples.length > 0
					? `You are proficient with ${armorName.toLowerCase()}. Examples include: ${examples.join(', ')}.`
					: `You are proficient with ${armorName.toLowerCase()}.`),
				type: 'armor',
				source: categoryInfo?.source,
				page: categoryInfo?.page
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
	 * @returns {Promise<Object|null>} Object with name, description, source, and page
	 */
	async getWeaponDescription(weaponName) {
		const baseItems = itemService.getAllBaseItems();

		// Handle weapon categories
		if (weaponName === 'Simple Weapons' || weaponName === 'Martial Weapons') {
			// Get category info from PHB book
			const categoryInfo = await this.getWeaponCategoryInfo(weaponName);

			const category = weaponName === 'Simple Weapons' ? 'simple' : 'martial';
			const examples = baseItems
				.filter(item => item.weaponCategory === category && item.weapon)
				.slice(0, 5)
				.map(item => item.name);

			return {
				name: weaponName,
				description: categoryInfo?.entries || (examples.length > 0
					? `You are proficient with ${weaponName.toLowerCase()}. Examples include: ${examples.join(', ')}.`
					: `You are proficient with ${weaponName.toLowerCase()}.`),
				type: 'weapon',
				source: categoryInfo?.source,
				page: categoryInfo?.page
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

	/**
	 * Load and cache PHB book data for proficiency categories
	 * @returns {Promise<Object>} Book data
	 */
	async _loadBookData() {
		if (this._bookData) {
			return this._bookData;
		}

		try {
			const bookData = await DataLoader.loadJSON('book/book-phb.json');
			// Book structure is { "data": [...] } not { "book": [...] }
			this._bookData = bookData || null;
			return this._bookData;
		} catch (error) {
			console.error('ProficiencyService', 'Failed to load book data', error);
			return null;
		}
	}

	/**
	 * Find book entry by name (searches recursively through nested entries)
	 * @param {Array} entries - Array of book entries to search
	 * @param {string} name - Name to search for
	 * @returns {Object|null} Found entry or null
	 */
	_findBookEntry(entries, name) {
		if (!entries || !Array.isArray(entries)) return null;

		for (const entry of entries) {
			if (entry.name === name) {
				return entry;
			}
			if (entry.entries) {
				const found = this._findBookEntry(entry.entries, name);
				if (found) return found;
			}
		}
		return null;
	}

	/**
	 * Gets armor category information from PHB
	 * @param {string} categoryName - Category name (e.g., "Light Armor", "Medium Armor")
	 * @returns {Promise<Object|null>} Category info with entries, source, and page
	 */
	async getArmorCategoryInfo(categoryName) {
		const bookData = await this._loadBookData();
		if (!bookData) return null;

		const entry = this._findBookEntry(bookData.data, categoryName);
		if (!entry) return null;

		return {
			name: entry.name,
			entries: entry.entries || [],
			source: 'PHB',
			page: entry.page
		};
	}

	/**
	 * Gets weapon category information from PHB
	 * @param {string} categoryName - Category name (e.g., "Simple Weapons", "Martial Weapons")
	 * @returns {Promise<Object|null>} Category info with entries, source, and page
	 */
	async getWeaponCategoryInfo(categoryName) {
		const bookData = await this._loadBookData();
		if (!bookData) return null;

		// Weapon proficiency section contains the category info
		const weaponProfEntry = this._findBookEntry(bookData.data, 'Weapon Proficiency');
		if (!weaponProfEntry) return null;

		return {
			name: categoryName,
			entries: weaponProfEntry.entries || [],
			source: 'PHB',
			page: weaponProfEntry.page
		};
	}

	/**
	 * Gets saving throw information from PHB
	 * @returns {Promise<Object|null>} Saving throw info with entries, source, and page
	 */
	async getSavingThrowInfo() {
		const bookData = await this._loadBookData();
		if (!bookData) return null;

		const entry = this._findBookEntry(bookData.data, 'Saving Throws');
		if (!entry) return null;

		return {
			name: entry.name,
			entries: entry.entries || [],
			source: 'PHB',
			page: entry.page
		};
	}
}

/**
 * Export the singleton instance
 * @type {ProficiencyManager}
 */
export const proficiencyService = new ProficiencyService();
