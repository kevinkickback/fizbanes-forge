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
			console.debug('[ProficiencyService]', 'Initializing proficiency manager');

			// Cache commonly used data
			this._skills = await this.getAvailableSkills();
			this._tools = await this.getAvailableTools();
			this._languages = await this.getAvailableLanguages();

			this._initialized = true;
			console.debug(
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

	calculateProficiencyBonus(level) {
		return Math.floor((level - 1) / 4) + 2;
	}

	async getAvailableSkills() {
		if (this._skills) {
			return [...this._skills];
		}

		return [...STANDARD_SKILL_OPTIONS];
	}

	async getAvailableTools() {
		if (this._tools) {
			return [...this._tools];
		}

		return [...STANDARD_TOOL_OPTIONS];
	}

	async getAvailableLanguages() {
		if (this._languages) {
			return [...this._languages];
		}

		return [...STANDARD_LANGUAGE_OPTIONS];
	}

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

	validateSkill(skill) {
		return this.getSkillAbility(skill) !== null;
	}

	async validateTool(tool) {
		const tools = await this.getAvailableTools();
		return tools.includes(tool);
	}

	async validateLanguage(language) {
		const languages = await this.getAvailableLanguages();
		return languages.includes(language);
	}

	calculateSkillModifier(character, skill) {
		const ability = this.getSkillAbility(skill);
		if (!ability) return 0;

		const abilityMod = character.getAbilityModifier(ability);
		const profBonus = character.hasProficiency('skill', skill)
			? this.calculateProficiencyBonus(character.getTotalLevel())
			: 0;

		return abilityMod + profBonus;
	}

	/** @deprecated Use getAbilityModifier from 5eToolsParser instead. */
	formatModifier(value) {
		return value >= 0 ? `+${value}` : value.toString();
	}

	addProficiency(character, type, proficiency, source) {
		if (!character || !type || !proficiency || !source) {
			console.warn('[ProficiencyCore]', 'Invalid parameters for addProficiency:', {
				type,
				proficiency,
				source,
			});
			return false;
		}

		if (!character.proficiencies) character.proficiencies = {};
		if (!character.proficiencies[type]) character.proficiencies[type] = [];
		if (!character.proficiencySources) character.proficiencySources = {};
		if (!character.proficiencySources[type])
			character.proficiencySources[type] = new Map();

		const normalizedTarget = DataNormalizer.normalizeForLookup(proficiency);
		const existingProf = character.proficiencies[type].find(
			(p) => DataNormalizer.normalizeForLookup(p) === normalizedTarget,
		);

		const wasNew = !existingProf;
		if (wasNew) {
			character.proficiencies[type].push(proficiency);
		}

		const trackKey = existingProf || proficiency;
		if (!character.proficiencySources[type].has(trackKey)) {
			character.proficiencySources[type].set(trackKey, new Set());
		}
		character.proficiencySources[type].get(trackKey).add(source);

		if (type === 'skills' && !source.includes('Choice')) {
			this._refundOptionalSkill(character, proficiency, source);
		}

		eventBus.emit(EVENTS.PROFICIENCY_ADDED, {
			type,
			proficiency,
			source,
			character,
		});

		return wasNew;
	}

	removeProficienciesBySource(character, source) {
		if (!character || !source) {
			console.warn('[ProficiencyCore]', 'Invalid parameters for removeProficienciesBySource');
			return {};
		}

		const removed = {};

		if (!character.proficiencySources) {
			return removed;
		}

		for (const type in character.proficiencySources) {
			removed[type] = [];

			for (const [proficiency, sources] of character.proficiencySources[
				type
			].entries()) {
				if (sources.has(source)) {
					sources.delete(source);
					removed[type].push(proficiency);

					if (sources.size === 0) {
						character.proficiencySources[type].delete(proficiency);

						if (character.proficiencies[type]) {
							const index = character.proficiencies[type].indexOf(proficiency);
							if (index > -1) {
								character.proficiencies[type].splice(index, 1);
							}
						}
					}
				}
			}
		}

		eventBus.emit(EVENTS.PROFICIENCY_REMOVED_BY_SOURCE, {
			source,
			removed,
			character,
		});

		return removed;
	}

	hasProficiency(character, type, proficiency) {
		if (!character?.proficiencies?.[type]) return false;

		const normalizedTarget = DataNormalizer.normalizeForLookup(proficiency);
		return character.proficiencies[type].some(
			(p) => DataNormalizer.normalizeForLookup(p) === normalizedTarget,
		);
	}

	getProficiencySources(character, type, proficiency) {
		return character?.proficiencySources?.[type]?.get(proficiency) || new Set();
	}

	getProficienciesWithSources(character, type) {
		if (!character?.proficiencies?.[type]) {
			return [];
		}

		return character.proficiencies[type].map((proficiency) => ({
			name: proficiency,
			sources: this.getProficiencySources(
				character,
				type,
				proficiency,
			),
		}));
	}

	setOptionalProficiencies(character, type, source, allowed, options) {
		if (!character || !type || !source) {
			console.warn('[ProficiencyCore]', 'Invalid parameters for setOptionalProficiencies');
			return;
		}

		if (!character.optionalProficiencies) {
			character.optionalProficiencies = {};
		}
		if (!character.optionalProficiencies[type]) {
			character.optionalProficiencies[type] = {
				allowed: 0,
				options: [],
				selected: [],
				race: { allowed: 0, options: [], selected: [] },
				class: { allowed: 0, options: [], selected: [] },
				background: { allowed: 0, options: [], selected: [] },
			};
		}

		const sourceKey = DataNormalizer.normalizeForLookup(source);
		if (!character.optionalProficiencies[type][sourceKey]) {
			character.optionalProficiencies[type][sourceKey] = {
				allowed: 0,
				options: [],
				selected: [],
			};
		}

		character.optionalProficiencies[type][sourceKey].allowed = allowed;
		character.optionalProficiencies[type][sourceKey].options = [...options];

		this._recalculateOptionalProficiencies(character, type);

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_CONFIGURED, {
			type,
			source: sourceKey,
			allowed,
			options,
			character,
		});
	}

	clearOptionalProficiencies(character, type, source) {
		if (!character?.optionalProficiencies?.[type]) {
			return;
		}

		const sourceKey = DataNormalizer.normalizeForLookup(source);
		if (character.optionalProficiencies[type][sourceKey]) {
			const selected =
				character.optionalProficiencies[type][sourceKey].selected || [];
			for (const _proficiency of selected) {
				this.removeProficienciesBySource(
					character,
					`${source} Choice`,
				);
			}

			character.optionalProficiencies[type][sourceKey] = {
				allowed: 0,
				options: [],
				selected: [],
			};

			this._recalculateOptionalProficiencies(character, type);
		}

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_CLEARED, {
			type,
			source: sourceKey,
			character,
		});
	}

	selectOptionalProficiency(character, type, source, proficiency) {
		if (!character?.optionalProficiencies?.[type]) {
			console.warn('[ProficiencyCore]', 'Optional proficiencies not initialized for type:', type);
			return false;
		}

		const sourceKey = DataNormalizer.normalizeForLookup(source);
		const config = character.optionalProficiencies[type][sourceKey];

		if (!config) {
			console.warn('[ProficiencyCore]', 'No optional proficiency configuration for source:', source);
			return false;
		}

		if (config.selected.includes(proficiency)) {
			return false;
		}

		if (config.selected.length >= config.allowed) {
			console.warn(
				'[ProficiencyCore]',
				'Maximum optional proficiencies already selected for',
				source,
			);
			return false;
		}

		if (!config.options.includes(proficiency)) {
			console.warn('[ProficiencyCore]', 'Proficiency not in available options:', proficiency);
			return false;
		}

		config.selected.push(proficiency);

		this.addProficiency(
			character,
			type,
			proficiency,
			`${source} Choice`,
		);

		this._recalculateOptionalProficiencies(character, type);

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_SELECTED, {
			type,
			source: sourceKey,
			proficiency,
			character,
		});

		return true;
	}

	deselectOptionalProficiency(character, type, source, proficiency) {
		if (!character?.optionalProficiencies?.[type]) {
			return false;
		}

		const sourceKey = DataNormalizer.normalizeForLookup(source);
		const config = character.optionalProficiencies[type][sourceKey];

		if (!config) {
			return false;
		}

		const index = config.selected.indexOf(proficiency);
		if (index === -1) {
			return false;
		}

		config.selected.splice(index, 1);

		this._removeProficiencyFromSource(
			character,
			type,
			proficiency,
			`${source} Choice`,
		);

		this._recalculateOptionalProficiencies(character, type);

		eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_DESELECTED, {
			type,
			source: sourceKey,
			proficiency,
			character,
		});

		return true;
	}

	getAvailableOptionalProficiencies(character, type, source) {
		const sourceKey = DataNormalizer.normalizeForLookup(source);
		const config = character?.optionalProficiencies?.[type]?.[sourceKey];

		if (!config) {
			return [];
		}

		return config.options.filter((option) => {
			if (config.selected.includes(option)) {
				return false;
			}

			const sources = this.getProficiencySources(
				character,
				type,
				option,
			);
			const hasNonChoiceSources = Array.from(sources).some(
				(s) => !s.includes('Choice'),
			);

			return !hasNonChoiceSources;
		});
	}

	initializeProficiencyStructures(character) {
		if (!character) {
			return;
		}

		const types = [
			'skills',
			'savingThrows',
			'languages',
			'tools',
			'armor',
			'weapons',
		];

		if (!character.proficiencies) {
			character.proficiencies = {};
		}
		for (const type of types) {
			if (!character.proficiencies[type]) {
				character.proficiencies[type] = [];
			}
		}

		if (!character.proficiencySources) {
			character.proficiencySources = {};
		}
		for (const type of types) {
			if (!character.proficiencySources[type]) {
				character.proficiencySources[type] = new Map();
			}
		}

		if (!character.optionalProficiencies) {
			character.optionalProficiencies = {};
		}

		const optionalTypes = ['skills', 'languages', 'tools'];
		for (const type of optionalTypes) {
			if (!character.optionalProficiencies[type]) {
				character.optionalProficiencies[type] = {
					allowed: 0,
					options: [],
					selected: [],
					race: { allowed: 0, options: [], selected: [] },
					class: { allowed: 0, options: [], selected: [] },
					background: { allowed: 0, options: [], selected: [] },
				};
			} else {
				const prof = character.optionalProficiencies[type];
				if (prof.allowed === undefined) prof.allowed = 0;
				if (!prof.options) prof.options = [];
				if (!prof.selected) prof.selected = [];

				for (const source of ['race', 'class', 'background']) {
					if (!prof[source]) {
						prof[source] = { allowed: 0, options: [], selected: [] };
					} else {
						if (prof[source].allowed === undefined) prof[source].allowed = 0;
						if (!prof[source].options) prof[source].options = [];
						if (!prof[source].selected) prof[source].selected = [];
					}
				}
			}
		}

		if (character.proficiencies.languages.length === 0) {
			this.addProficiency(
				character,
				'languages',
				'Common',
				'Default',
			);
		}
	}

	_recalculateOptionalProficiencies(character, type) {
		if (!character?.optionalProficiencies?.[type]) {
			return;
		}

		const config = character.optionalProficiencies[type];
		const sources = ['race', 'class', 'background'];

		config.allowed = sources.reduce((sum, source) => {
			return sum + (config[source]?.allowed || 0);
		}, 0);

		const allOptions = new Set();
		for (const source of sources) {
			if (config[source]?.options) {
				for (const opt of config[source].options) {
					allOptions.add(opt);
				}
			}
		}
		config.options = Array.from(allOptions);

		const allSelected = new Set();
		for (const source of sources) {
			if (config[source]?.selected) {
				for (const sel of config[source].selected) {
					allSelected.add(sel);
				}
			}
		}
		config.selected = Array.from(allSelected);
	}

	_refundOptionalSkill(character, proficiency, newSource) {
		if (!character?.optionalProficiencies?.skills) {
			return;
		}

		const normalizedProf = DataNormalizer.normalizeForLookup(proficiency);
		const sources = ['race', 'class', 'background'];
		let refunded = false;

		for (const source of sources) {
			if (
				(source === 'race' && newSource === 'Race') ||
				(source === 'class' && newSource === 'Class') ||
				(source === 'background' && newSource === 'Background')
			) {
				continue;
			}

			const config = character.optionalProficiencies.skills[source];
			if (!config?.selected) {
				continue;
			}

			const matchingProf = config.selected.find(
				(s) => DataNormalizer.normalizeForLookup(s) === normalizedProf,
			);

			if (matchingProf) {
				const index = config.selected.indexOf(matchingProf);
				config.selected.splice(index, 1);

				this._removeProficiencyFromSource(
					character,
					'skills',
					matchingProf,
					`${source.charAt(0).toUpperCase() + source.slice(1)} Choice`,
				);

				refunded = true;
			}
		}

		if (refunded) {
			this._recalculateOptionalProficiencies(character, 'skills');

			eventBus.emit(EVENTS.PROFICIENCY_REFUNDED, {
				type: 'skills',
				proficiency,
				character,
			});
		}
	}

	_removeProficiencyFromSource(character, type, proficiency, source) {
		if (!character?.proficiencySources?.[type]) {
			return;
		}

		const targetLower = DataNormalizer.normalizeForLookup(proficiency);
		let foundProf = null;

		for (const [key] of character.proficiencySources[type]) {
			if (DataNormalizer.normalizeForLookup(key) === targetLower) {
				foundProf = key;
				break;
			}
		}

		if (!foundProf) {
			return;
		}

		const sources = character.proficiencySources[type].get(foundProf);
		if (!sources) {
			return;
		}

		sources.delete(source);

		if (sources.size === 0) {
			character.proficiencySources[type].delete(foundProf);

			if (character.proficiencies[type]) {
				const index = character.proficiencies[type].findIndex(
					(p) => DataNormalizer.normalizeForLookup(p) === targetLower,
				);
				if (index > -1) {
					character.proficiencies[type].splice(index, 1);
				}
			}
		}
	}

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

	async _loadLanguageData() {
		if (this._languageData) return this._languageData;

		try {
			const data = await DataLoader.loadJSON('languages.json');
			this._languageData = data?.language || [];
			return this._languageData;
		} catch (error) {
			console.error(
				'[ProficiencyService]',
				'Failed to load language data',
				error,
			);
			this._languageData = [];
			return [];
		}
	}

	async getSkillDescription(skillName) {
		const skillData = await this._loadSkillData();
		if (!skillData || skillData.length === 0) return null;

		const normalizedSearch = DataNormalizer.normalizeForLookup(skillName);

		// Import sourceService dynamically to avoid circular dependency
		const { sourceService } = await import('./SourceService.js');
		const allowedSources = new Set(
			sourceService.getAllowedSources().map((s) => s.toUpperCase()),
		);

		// Find the skill - prioritize allowed sources
		let skill = null;

		// First try XPHB if allowed
		if (allowedSources.has('XPHB')) {
			skill = skillData.find(
				(s) =>
					DataNormalizer.normalizeForLookup(s.name) === normalizedSearch &&
					s.source === 'XPHB',
			);
		}

		// Then try PHB if allowed and not found
		if (!skill && allowedSources.has('PHB')) {
			skill = skillData.find(
				(s) =>
					DataNormalizer.normalizeForLookup(s.name) === normalizedSearch &&
					s.source === 'PHB',
			);
		}

		// Finally try any allowed source
		if (!skill) {
			skill = skillData.find(
				(s) =>
					DataNormalizer.normalizeForLookup(s.name) === normalizedSearch &&
					allowedSources.has(s.source?.toUpperCase()),
			);
		}

		if (!skill) return null;

		// Return entries as array so textProcessor can handle tags properly
		return {
			name: skill.name,
			ability: skill.ability,
			description: skill.entries || [],
			source: skill.source,
			page: skill.page,
		};
	}

	async getLanguageDescription(languageName) {
		const languageData = await this._loadLanguageData();
		if (!languageData || languageData.length === 0) return null;

		const normalizedSearch = DataNormalizer.normalizeForLookup(languageName);

		// Import sourceService dynamically to avoid circular dependency
		const { sourceService } = await import('./SourceService.js');
		const allowedSources = new Set(
			sourceService.getAllowedSources().map((s) => s.toUpperCase()),
		);

		// Find the language - prioritize allowed sources
		let language = null;

		// First try XPHB if allowed
		if (allowedSources.has('XPHB')) {
			language = languageData.find(
				(l) =>
					DataNormalizer.normalizeForLookup(l.name) === normalizedSearch &&
					l.source === 'XPHB',
			);
		}

		// Then try PHB if allowed and not found
		if (!language && allowedSources.has('PHB')) {
			language = languageData.find(
				(l) =>
					DataNormalizer.normalizeForLookup(l.name) === normalizedSearch &&
					l.source === 'PHB',
			);
		}

		// Finally try any allowed source
		if (!language) {
			language = languageData.find(
				(l) =>
					DataNormalizer.normalizeForLookup(l.name) === normalizedSearch &&
					allowedSources.has(l.source?.toUpperCase()),
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
			page: language.page,
		};
	}

	async getToolDescription(toolName) {
		const items = itemService.getAllItems();
		if (!items || items.length === 0) {
			console.warn('[ProficiencyService] No items available for tool lookup');
			return {
				name: toolName,
				description: `Proficiency with ${toolName.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`,
				type: 'tool',
			};
		}

		const normalizedSearch = DataNormalizer.normalizeForLookup(toolName);

		// Import sourceService dynamically to avoid circular dependency
		const { sourceService } = await import('./SourceService.js');
		const allowedSources = new Set(
			sourceService.getAllowedSources().map((s) => s.toUpperCase()),
		);

		// Helper to check if item is a tool (AT=Artisan Tools, T=Tools, GS=Gaming Set, INS=Instrument)
		const isToolType = (type) => {
			if (!type) return false;
			const typeStr = String(type);
			return (
				typeStr === 'AT' ||
				typeStr === 'T' ||
				typeStr === 'GS' ||
				typeStr === 'INS' ||
				typeStr.includes('AT') ||
				typeStr.includes('T|') ||
				typeStr.includes('GS') ||
				typeStr.includes('INS')
			);
		};

		// Find the tool - prioritize allowed sources
		let tool = null;

		// First try XPHB if allowed
		if (allowedSources.has('XPHB')) {
			tool = items.find(
				(item) =>
					DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
					item.source === 'XPHB' &&
					isToolType(item.type),
			);
		}

		// Then try PHB if allowed and not found
		if (!tool && allowedSources.has('PHB')) {
			tool = items.find(
				(item) =>
					DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
					item.source === 'PHB' &&
					isToolType(item.type),
			);
		}

		// Finally try any allowed source
		if (!tool) {
			tool = items.find(
				(item) =>
					DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
					allowedSources.has(item.source?.toUpperCase()) &&
					isToolType(item.type),
			);
		}

		if (!tool) {
			return {
				name: toolName,
				description: [
					`Proficiency with ${toolName.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`,
				],
				type: 'tool',
			};
		}

		// Return raw entries so textProcessor can handle tags properly
		let description = tool.entries || tool.additionalEntries || [];

		if (!description || description.length === 0) {
			description = [
				`Proficiency with ${tool.name.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`,
			];
		}

		return {
			name: tool.name,
			description,
			type: 'tool',
			source: tool.source,
			page: tool.page,
		};
	}

	async getArmorDescription(armorName) {
		const baseItems = itemService.getAllBaseItems();

		// Handle armor categories
		const armorCategories = {
			'Light Armor': 'LA',
			'Medium Armor': 'MA',
			'Heavy Armor': 'HA',
			Shields: 'S',
		};

		const typeCode = armorCategories[armorName];

		if (typeCode) {
			// Get category info from PHB book
			const categoryInfo = await this.getArmorCategoryInfo(armorName);

			// Return category description with book reference
			const examples = baseItems
				.filter(
					(item) =>
						(item.type === typeCode || item.type === `${typeCode}|XPHB`) &&
						item.armor,
				)
				.slice(0, 3)
				.map((item) => item.name);

			return {
				name: armorName,
				description:
					categoryInfo?.entries ||
					(examples.length > 0
						? `You are proficient with ${armorName.toLowerCase()}. Examples include: ${examples.join(', ')}.`
						: `You are proficient with ${armorName.toLowerCase()}.`),
				type: 'armor',
				source: categoryInfo?.source,
				page: categoryInfo?.page,
			};
		}

		// Look for specific armor item
		const normalizedSearch = DataNormalizer.normalizeForLookup(armorName);
		let armor = baseItems.find(
			(item) =>
				DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
				item.armor &&
				item.source === 'XPHB',
		);

		if (!armor) {
			armor = baseItems.find(
				(item) =>
					DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
					item.armor,
			);
		}

		if (!armor) {
			return {
				name: armorName,
				description: `You are proficient with ${armorName.toLowerCase()}.`,
				type: 'armor',
			};
		}

		return {
			name: armor.name,
			description:
				armor.entries?.join(' ') ||
				`You are proficient with ${armor.name.toLowerCase()}.`,
			ac: armor.ac,
			weight: armor.weight,
			type: 'armor',
			source: armor.source,
			page: armor.page,
		};
	}

	async getWeaponDescription(weaponName) {
		const baseItems = itemService.getAllBaseItems();

		// Handle weapon categories
		if (weaponName === 'Simple Weapons' || weaponName === 'Martial Weapons') {
			// Get category info from PHB book
			const categoryInfo = await this.getWeaponCategoryInfo(weaponName);

			const category = weaponName === 'Simple Weapons' ? 'simple' : 'martial';
			const examples = baseItems
				.filter((item) => item.weaponCategory === category && item.weapon)
				.slice(0, 5)
				.map((item) => item.name);

			return {
				name: weaponName,
				description:
					categoryInfo?.entries ||
					(examples.length > 0
						? `You are proficient with ${weaponName.toLowerCase()}. Examples include: ${examples.join(', ')}.`
						: `You are proficient with ${weaponName.toLowerCase()}.`),
				type: 'weapon',
				source: categoryInfo?.source,
				page: categoryInfo?.page,
			};
		}

		// Look for specific weapon
		const normalizedSearch = DataNormalizer.normalizeForLookup(weaponName);
		let weapon = baseItems.find(
			(item) =>
				DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
				item.weapon &&
				item.source === 'XPHB',
		);

		if (!weapon) {
			weapon = baseItems.find(
				(item) =>
					DataNormalizer.normalizeForLookup(item.name) === normalizedSearch &&
					item.weapon,
			);
		}

		if (!weapon) {
			return {
				name: weaponName,
				description: `You are proficient with ${weaponName.toLowerCase()}.`,
				type: 'weapon',
			};
		}

		const properties = [];
		if (weapon.dmg1)
			properties.push(`Damage: ${weapon.dmg1} ${weapon.dmgType}`);
		if (weapon.range) properties.push(`Range: ${weapon.range}`);
		if (weapon.weight) properties.push(`Weight: ${weapon.weight} lb.`);

		const description =
			weapon.entries?.join(' ') ||
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
			page: weapon.page,
		};
	}

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

	async getArmorCategoryInfo(categoryName) {
		const bookData = await this._loadBookData();
		if (!bookData) return null;

		const entry = this._findBookEntry(bookData.data, categoryName);
		if (!entry) return null;

		return {
			name: entry.name,
			entries: entry.entries || [],
			source: 'PHB',
			page: entry.page,
		};
	}

	async getWeaponCategoryInfo(categoryName) {
		const bookData = await this._loadBookData();
		if (!bookData) return null;

		// Weapon proficiency section contains the category info
		const weaponProfEntry = this._findBookEntry(
			bookData.data,
			'Weapon Proficiency',
		);
		if (!weaponProfEntry) return null;

		return {
			name: categoryName,
			entries: weaponProfEntry.entries || [],
			source: 'PHB',
			page: weaponProfEntry.page,
		};
	}

	async getSavingThrowInfo() {
		const bookData = await this._loadBookData();
		if (!bookData) return null;

		const entry = this._findBookEntry(bookData.data, 'Saving Throws');
		if (!entry) return null;

		return {
			name: entry.name,
			entries: entry.entries || [],
			source: 'PHB',
			page: entry.page,
		};
	}
}

export const proficiencyService = new ProficiencyService();
