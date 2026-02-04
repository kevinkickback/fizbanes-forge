import { DataLoader } from '../lib/DataLoader.js';
import { EVENTS } from '../lib/EventBus.js';
import TextProcessor from '../lib/TextProcessor.js';
import { BaseDataService } from './BaseDataService.js';
import { classService } from './ClassService.js';

class FeatService extends BaseDataService {
	constructor() {
		super({
			cacheKey: 'feats',
			loadEvent: EVENTS.DATA_LOADED,
			loggerScope: 'FeatService',
		});
		this._featMap = null; // Map for O(1) lookups by name (case-insensitive)
	}

	async initialize() {
		return this.initWithLoader(() => DataLoader.loadFeats(), {
			onLoaded: (data) => {
				// Build lookup map for O(1) access by name (case-insensitive)
				this._featMap = new Map();
				if (data?.feat && Array.isArray(data.feat)) {
					for (const feat of data.feat) {
						if (!feat.name) continue;
						const key = TextProcessor.normalizeForLookup(feat.name);
						this._featMap.set(key, feat);
					}
				}
			},
			emitPayload: (data) => ['feats', data?.feat || []],
		});
	}

	getAllFeats() {
		return this._data?.feat || [];
	}

	getFeat(featName) {
		if (!this._featMap) return null;
		return (
			this._featMap.get(TextProcessor.normalizeForLookup(featName)) || null
		);
	}

	isFeatValidForCharacter(feat, character, options = {}) {
		if (!feat.prerequisite || !Array.isArray(feat.prerequisite)) {
			return true;
		}

		// All prerequisite conditions must be met (AND logic)
		return feat.prerequisite.every((prereq) =>
			this._validatePrerequisiteCondition(prereq, character, options),
		);
	}

	/**
	 * Validate a single prerequisite condition
	 * @private
	 */
	_validatePrerequisiteCondition(prereq, character, options = {}) {
		if (!character) return false;

		// Level requirement
		if (prereq.level !== undefined) {
			const characterLevel = character.getTotalLevel();
			if (characterLevel < prereq.level) return false;
		}

		// Ability score requirement
		if (Array.isArray(prereq.ability)) {
			const abilityScores = character.abilityScores || {};
			const meetsAbilityRequirement = prereq.ability.some((abilityReq) => {
				if (typeof abilityReq === 'string') {
					const score = abilityScores[abilityReq] || 0;
					return score >= 13;
				} else if (typeof abilityReq === 'object' && abilityReq.ability) {
					const score = abilityScores[abilityReq.ability] || 0;
					const minScore = abilityReq.score || 13;
					return score >= minScore;
				}
				return false;
			});
			if (!meetsAbilityRequirement) return false;
		}

		// Race requirement
		if (!options.ignoreRacePrereq && Array.isArray(prereq.race)) {
			const characterRace = character.race?.name?.toLowerCase() || '';
			const meetsRaceRequirement = prereq.race.some((raceReq) => {
				if (typeof raceReq === 'string') {
					return characterRace === raceReq.toLowerCase();
				} else if (typeof raceReq === 'object' && raceReq.name) {
					return characterRace === raceReq.name.toLowerCase();
				}
				return false;
			});
			if (!meetsRaceRequirement) return false;
		}

		// Class requirement
		if (Array.isArray(prereq.class)) {
			const primaryClass = character.getPrimaryClass();
			const characterClass = primaryClass?.name?.toLowerCase() || '';
			const meetsClassRequirement = prereq.class.some((classReq) => {
				if (typeof classReq === 'string') {
					return characterClass === classReq.toLowerCase();
				} else if (typeof classReq === 'object' && classReq.name) {
					return characterClass === classReq.name.toLowerCase();
				}
				return false;
			});
			if (!meetsClassRequirement) return false;
		}

		// Spellcasting requirement
		if (prereq.spellcasting === true) {
			const classes = character.progression?.classes || [];
			const hasSpellcasting = classes.some((cls) => {
				const classData = classService?.getClass?.(cls.name, cls.source);
				return classData?.spellcastingAbility;
			});
			if (!hasSpellcasting) return false;
		}

		return true;
	}
}

export const featService = new FeatService();
