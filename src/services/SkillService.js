import { DataLoader } from '../lib/DataLoader.js';
import DataNormalizer from '../lib/DataNormalizer.js';

/** Manages skill data and provides access to skills. */
class SkillService {
	constructor() {
		this._skillData = null;
		this._skillMap = null; // Map for O(1) lookups by name (case-insensitive)
	}

	async initialize() {
		// Skip if already initialized
		if (this._skillData) {
			console.debug('[SkillService]', 'Already initialized');
			return true;
		}

		console.info('[SkillService]', 'Initializing skill data');
		try {
			this._skillData = await DataLoader.loadSkills();
			console.info('[SkillService]', 'Skills loaded successfully', {
				count: this._skillData.skill?.length,
			});

			// Build lookup map for O(1) access by name (case-insensitive)
			this._skillMap = new Map();
			if (this._skillData.skill && Array.isArray(this._skillData.skill)) {
				for (const skill of this._skillData.skill) {
					if (!skill.name) continue;
					const key = DataNormalizer.normalizeForLookup(skill.name);
					this._skillMap.set(key, skill);
				}
			}

			return true;
		} catch (error) {
			console.error('[SkillService]', 'Failed to initialize skill data', error);
			return false;
		}
	}

	/**
	 * Get all available skills
	 * @returns {Array<Object>} Array of skill objects
	 */
	getAllSkills() {
		return this._skillData?.skill || [];
	}

	/**
	 * Get a specific skill by name (case-insensitive)
	 * @param {string} skillName - Skill name
	 * @returns {Object|null} Skill object or null if not found
	 */
	getSkill(skillName) {
		if (!this._skillMap) return null;
		return (
			this._skillMap.get(DataNormalizer.normalizeForLookup(skillName)) || null
		);
	}

	/**
	 * Get all skills that use a specific ability score
	 * @param {string} abilityName - The ability name (e.g., 'strength', 'dexterity')
	 * @returns {Array<Object>} Array of skill objects that use this ability
	 */
	getSkillsByAbility(abilityName) {
		if (!this._skillData?.skill) return [];

		// Convert full ability name to 3-letter abbreviation used in JSON
		const abilityMap = {
			strength: 'str',
			dexterity: 'dex',
			constitution: 'con',
			intelligence: 'int',
			wisdom: 'wis',
			charisma: 'cha'
		};

		const normalizedName = abilityName.toLowerCase().trim();
		const abilityAbbr = abilityMap[normalizedName] || normalizedName;

		return this._skillData.skill.filter(skill => {
			if (!skill.ability) return false;

			// Handle both string and array formats for ability
			if (Array.isArray(skill.ability)) {
				return skill.ability.some(a =>
					DataNormalizer.normalizeForLookup(a) === abilityAbbr
				);
			}

			return DataNormalizer.normalizeForLookup(skill.ability) === abilityAbbr;
		});
	}
}

export const skillService = new SkillService();
