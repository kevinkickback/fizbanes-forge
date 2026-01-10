/** @file Feat service for managing feat data. */

import { DataLoader } from '../lib/DataLoader.js';
import DataNormalizer from '../lib/DataNormalizer.js';
import { classService } from './ClassService.js';
import { raceService } from './RaceService.js';

/** Manages feat data and provides access to feats. */
class FeatService {
	/** Initialize a new FeatService instance. */
	constructor() {
		this._featData = null;
		this._featMap = null; // Map for O(1) lookups by name (case-insensitive)
	}

	/**
	 * Initialize feat data by loading from DataLoader
	 * @returns {Promise<boolean>} True if initialization succeeded
	 */
	async initialize() {
		// Skip if already initialized
		if (this._featData) {
			console.debug('FeatService', 'Already initialized');
			return true;
		}

		console.info('[FeatService]', 'Initializing feat data');

		try {
			this._featData = await DataLoader.loadFeats();
			console.info('[FeatService]', 'Feats loaded successfully', {
				count: this._featData.feat?.length,
			});

			// Build lookup map for O(1) access by name (case-insensitive)
			this._featMap = new Map();
			if (this._featData.feat && Array.isArray(this._featData.feat)) {
				for (const feat of this._featData.feat) {
					if (!feat.name) continue;
					const key = DataNormalizer.normalizeForLookup(feat.name);
					this._featMap.set(key, feat);
				}
			}

			return true;
		} catch (error) {
			console.error('[FeatService]', 'Failed to initialize feat data', error);
			return false;
		}
	}

	/**
	 * Get all available feats
	 * @returns {Array<Object>} Array of feat objects
	 */
	getAllFeats() {
		return this._featData?.feat || [];
	}

	/**
	 * Get a specific feat by name (case-insensitive)
	 * @param {string} featName - Feat name
	 * @returns {Object|null} Feat object or null if not found
	 */
	getFeat(featName) {
		if (!this._featMap) return null;
		return (
			this._featMap.get(DataNormalizer.normalizeForLookup(featName)) || null
		);
	}

	/**
	 * Calculate how many feats a character may select based on race/subrace data
	 * and class Ability Score Improvement (ASI) features. Mirrors 5etools data.
	 * @param {import('../core/Character.js').Character|null} character
	 * @returns {{used:number,max:number,remaining:number,reasons:string[],blockedReason?:string}}
	 */
	calculateFeatAvailability(character) {
		const fallback = {
			used: 0,
			max: 0,
			remaining: 0,
			reasons: [],
			blockedReason: 'No character loaded.',
		};

		if (!character) return fallback;

		const used = Array.isArray(character.feats) ? character.feats.length : 0;

		// Respect optional rule toggle; default to enabled if unspecified
		if (character.variantRules?.feats === false) {
			return {
				used,
				max: 0,
				remaining: 0,
				reasons: [],
				blockedReason: 'Feats are disabled by variant rules.',
			};
		}

		let max = 0;
		const reasons = [];

		const raceSlots = this._getRaceGrantedFeatSlots(character);
		max += raceSlots.slots;
		reasons.push(...raceSlots.reasons);

		const classSlots = this._getClassFeatSlots(character);
		max += classSlots.slots;
		reasons.push(...classSlots.reasons);

		return {
			used,
			max,
			remaining: Math.max(0, max - used),
			reasons,
			blockedReason:
				max === 0
					? 'No feat selections available for this character.'
					: undefined,
		};
	}

	_getRaceGrantedFeatSlots(character) {
		let slots = 0;
		const reasons = [];

		const raceName = character.race?.name;
		const raceSource = character.race?.source || 'PHB';
		const subraceName = character.race?.subrace || '';

		const raceData = raceName
			? raceService.getRace(raceName, raceSource)
			: null;
		const subraceData =
			raceName && subraceName
				? raceService.getSubrace(raceName, subraceName, raceSource)
				: null;

		const collect = (featArr, label) => {
			if (!Array.isArray(featArr)) return;
			for (const entry of featArr) {
				const count = this._extractFeatCount(entry);
				if (count > 0) {
					slots += count;
					reasons.push(`Race: ${label}`);
				}
			}
		};

		collect(raceData?.feats, raceData?.name || raceName || 'Race');
		collect(subraceData?.feats, 'Subrace');

		return { slots, reasons };
	}

	_getClassFeatSlots(character) {
		let slots = 0;
		const reasons = [];

		const className = character.class?.name;
		const classSource = character.class?.source || 'PHB';
		const level = Number(character.class?.level || character.level || 1);

		if (!className || !Number.isFinite(level)) return { slots, reasons };

		const features = classService.getClassFeatures(
			className,
			level,
			classSource,
		);
		for (const feature of features) {
			const name = feature?.name || '';
			const isASI = name.toLowerCase() === 'ability score improvement';
			if (isASI) {
				slots += 1;
				reasons.push(
					`Class ASI at level ${feature.level ?? '?'} (${className})`,
				);
			}
		}

		return { slots, reasons };
	}

	_extractFeatCount(featEntry) {
		if (!featEntry) return 0;
		if (typeof featEntry.any === 'number') return featEntry.any;
		if (typeof featEntry.anyFromCategory?.count === 'number')
			return featEntry.anyFromCategory.count;
		if (typeof featEntry.choose?.count === 'number')
			return featEntry.choose.count;
		return 0;
	}
}

export const featService = new FeatService();
