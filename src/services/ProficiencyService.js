import { toSentenceCase } from '../lib/5eToolsParser.js';
import { DataLoader } from '../lib/DataLoader.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import TextProcessor from '../lib/TextProcessor.js';
import {
	addProficiencyArgsSchema,
	removeProficienciesBySourceArgsSchema,
	validateInput
} from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';
import { itemService } from './ItemService.js';
import { skillService } from './SkillService.js';

export class ProficiencyService extends BaseDataService {
	constructor() {
		super({ loggerScope: 'ProficiencyService' });

		this._skillData = null;
		this._languageData = null;
		this._bookData = null;
		this._sourceServiceModule = null;
	}

	dispose() {
		super.dispose();
		this._skillData = null;
		this._languageData = null;
		this._bookData = null;
	}

	resetData() {
		super.resetData();
		this._skillData = null;
		this._languageData = null;
		this._bookData = null;
	}

	async _getAllowedSourcesSet() {
		if (!this._sourceServiceModule) {
			this._sourceServiceModule = await import('./SourceService.js');
		}
		return new Set(
			this._sourceServiceModule.sourceService
				.getAllowedSources()
				.map((s) => s.toUpperCase()),
		);
	}

	_findBySourcePriority(items, matchFn, allowedSources) {
		if (allowedSources.has('XPHB')) {
			const result = items.find(
				(item) => matchFn(item) && item.source === 'XPHB',
			);
			if (result) return result;
		}
		if (allowedSources.has('PHB')) {
			const result = items.find(
				(item) => matchFn(item) && item.source === 'PHB',
			);
			if (result) return result;
		}
		return (
			items.find(
				(item) =>
					matchFn(item) &&
					allowedSources.has(item.source?.toUpperCase()),
			) || null
		);
	}



	/**
	 * Adds a proficiency to a character
	 * @param {Object} character - The character object
	 * @param {string} type - Proficiency type (armor, weapons, tools, skills, languages, savingThrows)
	 * @param {string} proficiency - The proficiency name
	 * @param {string} source - The source of the proficiency
	 * @returns {boolean} Whether the proficiency was newly added
	 */
	addProficiency(character, type, proficiency, source) {
		const validated = validateInput(
			addProficiencyArgsSchema,
			{ character, type, proficiency, source },
			'Invalid parameters for addProficiency'
		);

		const { character: char, type: profType, proficiency: profName, source: profSource } = validated;

		if (!char.proficiencies) char.proficiencies = {};
		if (!char.proficiencies[profType]) char.proficiencies[profType] = [];
		if (!char.proficiencySources) char.proficiencySources = {};
		if (!char.proficiencySources[profType])
			char.proficiencySources[profType] = new Map();

		const normalizedTarget = TextProcessor.normalizeForLookup(profName);
		const existingProf = char.proficiencies[profType].find(
			(p) => TextProcessor.normalizeForLookup(p) === normalizedTarget,
		);

		const wasNew = !existingProf;
		if (wasNew) {
			char.proficiencies[profType].push(profName);
		}

		const trackKey = existingProf || profName;
		if (!char.proficiencySources[profType].has(trackKey)) {
			char.proficiencySources[profType].set(trackKey, new Set());
		}
		char.proficiencySources[profType].get(trackKey).add(profSource);

		if (profType === 'skills' && !profSource.includes('Choice')) {
			this._refundOptionalSkill(char, profName, profSource);
		}

		eventBus.emit(EVENTS.PROFICIENCY_ADDED, {
			type: profType,
			proficiency: profName,
			source: profSource,
			character: char,
		});

		return wasNew;
	}

	/**
	 * Removes all proficiencies from a character that came from a specific source
	 * @param {Object} character - The character object
	 * @param {string} source - The source to remove proficiencies from
	 * @returns {Object} Object with arrays of removed proficiencies by type
	 */
	removeProficienciesBySource(character, source) {
		const validated = validateInput(
			removeProficienciesBySourceArgsSchema,
			{ character, source },
			'Invalid parameters for removeProficienciesBySource'
		);

		const { character: char, source: profSource } = validated;
		const removed = {};

		if (!char.proficiencySources) {
			return removed;
		}

		for (const type in char.proficiencySources) {
			removed[type] = [];

			for (const [proficiency, sources] of char.proficiencySources[
				type
			].entries()) {
				if (sources.has(profSource)) {
					sources.delete(profSource);
					removed[type].push(proficiency);

					if (sources.size === 0) {
						char.proficiencySources[type].delete(proficiency);

						if (char.proficiencies[type]) {
							const index = char.proficiencies[type].indexOf(proficiency);
							if (index !== -1) {
								char.proficiencies[type].splice(index, 1);
							}
						}
					}
				}
			}
		}

		eventBus.emit(EVENTS.PROFICIENCY_REMOVED_BY_SOURCE, {
			source: profSource,
			removed,
			character: char,
		});

		return removed;
	}

	getProficiencySources(character, type, proficiency) {
		return character?.proficiencySources?.[type]?.get(proficiency) || new Set();
	}

	setOptionalProficiencies(character, type, source, allowed, options) {
		if (!character || !type || !source) {
			console.warn('[ProficiencyService]', 'Invalid parameters for setOptionalProficiencies');
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

		const sourceKey = TextProcessor.normalizeForLookup(source);
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

		const normalizedProf = TextProcessor.normalizeForLookup(proficiency);
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
				(s) => TextProcessor.normalizeForLookup(s) === normalizedProf,
			);

			if (matchingProf) {
				const index = config.selected.indexOf(matchingProf);
				config.selected.splice(index, 1);

				this._removeProficiencyFromSource(
					character,
					'skills',
					matchingProf,
					`${toSentenceCase(source)} Choice`,
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

		const targetLower = TextProcessor.normalizeForLookup(proficiency);
		let foundProf = null;

		for (const [key] of character.proficiencySources[type]) {
			if (TextProcessor.normalizeForLookup(key) === targetLower) {
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
					(p) => TextProcessor.normalizeForLookup(p) === targetLower,
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
			this._skillData = await skillService.getSkillData();
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

		const normalizedSearch = TextProcessor.normalizeForLookup(skillName);
		const allowedSources = await this._getAllowedSourcesSet();

		const skill = this._findBySourcePriority(
			skillData,
			(s) => TextProcessor.normalizeForLookup(s.name) === normalizedSearch,
			allowedSources,
		);

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

	async getStandardLanguages() {
		const languageData = await this._loadLanguageData();
		if (!languageData || languageData.length === 0) return [];

		const allowedSources = await this._getAllowedSourcesSet();

		// Get unique language names from allowed sources, prioritizing XPHB then PHB
		const languageMap = new Map();

		for (const lang of languageData) {
			if (!allowedSources.has(lang.source?.toUpperCase())) continue;
			if (lang.type !== 'standard' && lang.type !== 'exotic') continue;

			const normalizedName = TextProcessor.normalizeForLookup(lang.name);

			if (!languageMap.has(normalizedName)) {
				languageMap.set(normalizedName, lang.name);
			} else if (lang.source === 'XPHB') {
				// Prefer XPHB version
				languageMap.set(normalizedName, lang.name);
			}
		}

		return Array.from(languageMap.values()).sort();
	}

	async getLanguageDescription(languageName) {
		const languageData = await this._loadLanguageData();
		if (!languageData || languageData.length === 0) return null;

		const normalizedSearch = TextProcessor.normalizeForLookup(languageName);
		const allowedSources = await this._getAllowedSourcesSet();

		const language = this._findBySourcePriority(
			languageData,
			(l) => TextProcessor.normalizeForLookup(l.name) === normalizedSearch,
			allowedSources,
		);

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
			console.warn('[ProficiencyService]', 'No items available for tool lookup');
			return {
				name: toolName,
				description: `Proficiency with ${toolName.toLowerCase()} allows you to add your proficiency bonus to any ability checks made using these tools.`,
				type: 'tool',
			};
		}

		const normalizedSearch = TextProcessor.normalizeForLookup(toolName);
		const allowedSources = await this._getAllowedSourcesSet();

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

		const tool = this._findBySourcePriority(
			items,
			(item) =>
				TextProcessor.normalizeForLookup(item.name) === normalizedSearch &&
				isToolType(item.type),
			allowedSources,
		);

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
			const bookData = await this._loadBookData();
			const categoryInfo = bookData ? this._findBookEntry(bookData.data, armorName) : null;

			// Get examples from items
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
		const normalizedSearch = TextProcessor.normalizeForLookup(armorName);
		let armor = baseItems.find(
			(item) =>
				TextProcessor.normalizeForLookup(item.name) === normalizedSearch &&
				item.armor &&
				item.source === 'XPHB',
		);

		if (!armor) {
			armor = baseItems.find(
				(item) =>
					TextProcessor.normalizeForLookup(item.name) === normalizedSearch &&
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
			const bookData = await this._loadBookData();
			const weaponProfEntry = bookData ? this._findBookEntry(bookData.data, 'Weapon Proficiency') : null;
			const categoryInfo = weaponProfEntry ? {
				name: weaponName,
				entries: weaponProfEntry.entries || [],
				source: 'PHB',
				page: weaponProfEntry.page,
			} : null;

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
		const normalizedSearch = TextProcessor.normalizeForLookup(weaponName);
		let weapon = baseItems.find(
			(item) =>
				TextProcessor.normalizeForLookup(item.name) === normalizedSearch &&
				item.weapon &&
				item.source === 'XPHB',
		);

		if (!weapon) {
			weapon = baseItems.find(
				(item) =>
					TextProcessor.normalizeForLookup(item.name) === normalizedSearch &&
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
			console.error('[ProficiencyService]', 'Failed to load book data', error);
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
