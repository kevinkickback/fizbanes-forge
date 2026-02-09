import { DataLoader } from '../lib/DataLoader.js';
import { ValidationError } from '../lib/Errors.js';
import TextProcessor from '../lib/TextProcessor.js';
import { skillIdentifierSchema, validateInput } from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

class SkillService extends BaseDataService {
	constructor() {
		super({ loggerScope: 'SkillService' });
		this._skillMap = null;
	}

	async initialize() {
		await this.initWithLoader(
			() => DataLoader.loadSkills(),
			{
				onLoaded: (data) => {
					this._skillMap = new Map();
					if (data?.skill && Array.isArray(data.skill)) {
						for (const skill of data.skill) {
							if (!skill.name) continue;
							const key = TextProcessor.normalizeForLookup(skill.name);
							this._skillMap.set(key, skill);
						}
					}
				},
				onError: () => {
					this._skillMap = new Map();
					return { skill: [] };
				},
			},
		);
		return true;
	}

	resetData() {
		super.resetData();
		this._skillMap = null;
	}

	getSkillsByAbility(abilityName) {
		const validated = validateInput(
			skillIdentifierSchema,
			{ abilityName },
			'Invalid ability name',
		);

		if (!this._data?.skill) return [];

		// Convert full ability name to 3-letter abbreviation used in JSON
		const abilityMap = {
			strength: 'str',
			dexterity: 'dex',
			constitution: 'con',
			intelligence: 'int',
			wisdom: 'wis',
			charisma: 'cha',
		};

		const normalizedName = validated.abilityName.toLowerCase().trim();

		// Validate ability is recognized
		if (!abilityMap[normalizedName] && !['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(normalizedName)) {
			throw new ValidationError('Invalid ability name', {
				abilityName: validated.abilityName,
				validOptions: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'str', 'dex', 'con', 'int', 'wis', 'cha'],
			});
		}

		const abilityAbbr = abilityMap[normalizedName] || normalizedName;

		return this._data.skill.filter((skill) => {
			if (!skill.ability) return false;

			// Handle both string and array formats for ability
			if (Array.isArray(skill.ability)) {
				return skill.ability.some(
					(a) => TextProcessor.normalizeForLookup(a) === abilityAbbr,
				);
			}

			return TextProcessor.normalizeForLookup(skill.ability) === abilityAbbr;
		});
	}
}

export const skillService = new SkillService();
