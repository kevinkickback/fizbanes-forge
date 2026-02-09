import { DataLoader } from '../lib/DataLoader.js';
import { ValidationError } from '../lib/Errors.js';
import TextProcessor from '../lib/TextProcessor.js';
import { skillIdentifierSchema, validateInput } from '../lib/ValidationSchemas.js';
class SkillService {
	constructor() {
		this._skillData = null;
		this._skillMap = null;
	}

	async initialize() {
		if (this._skillData) return true;

		try {
			this._skillData = await DataLoader.loadSkills();

			this._skillMap = new Map();
			if (this._skillData.skill && Array.isArray(this._skillData.skill)) {
				for (const skill of this._skillData.skill) {
					if (!skill.name) continue;
					const key = TextProcessor.normalizeForLookup(skill.name);
					this._skillMap.set(key, skill);
				}
			}

			return true;
		} catch (error) {
			console.error('[SkillService]', 'Failed to initialize skill data', error);
			return false;
		}
	}

	getSkillsByAbility(abilityName) {
		const validated = validateInput(
			skillIdentifierSchema,
			{ abilityName },
			'Invalid ability name',
		);

		if (!this._skillData?.skill) return [];

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

		return this._skillData.skill.filter((skill) => {
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
