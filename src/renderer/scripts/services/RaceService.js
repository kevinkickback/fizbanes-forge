/**
 * Manages race data and operations for the character builder.
 * 
 * This service handles:
 * - Loading and caching race and subrace data
 * - Building an optimized lookup index for O(1) race access
 * - Managing race/subrace selection state
 * - Deriving variant subraces (e.g., Dragonborn colors)
 * 
 * The race data structure follows 5etools format with support for:
 * - Base races (e.g., "Elf", "Dwarf")
 * - Named subraces (e.g., "High Elf", "Wood Elf")
 * - Base/unnamed subraces (generic race data without subrace name)
 * - Version variants using abstract/implementation patterns
 */

import { AppState } from '../core/AppState.js';
import { DataLoader } from '../utils/DataLoader.js';
import { eventBus, EVENTS } from '../utils/EventBus.js';
import {
	buildRaceBundle,
	createRaceKey,
	groupSubracesByRace,
} from '../utils/RaceDataUtils.js';

/**
 * Service for managing character race selection and race data access.
 * Provides O(1) lookup performance for races via an internal index.
 */
class RaceService {
	constructor() {
		this._raceData = null;
		this._selectedRace = null;
		this._selectedSubrace = null;
		/** @type {Map<string, {race: Object, subraces: Array, baseSubrace: Object|null}>} */
		this._raceIndex = null;
	}

	/**
	 * Initialize race data by loading from DataUtil
	 * @returns {Promise<void>}
	 */
	async initialize() {
		// Skip if already initialized
		if (this._raceData) {
			console.debug('RaceService', 'Already initialized');
			return;
		}

		console.info('[RaceService]', 'Initializing race data');

		try {
			this._raceData = await DataLoader.loadRaces();
			if (!this._raceData) throw new Error('Race data is null or undefined');

			try {
				const fluffData = await DataLoader.loadRaceFluff();
				if (fluffData?.raceFluff) {
					this._raceData.raceFluff = fluffData.raceFluff;
				}
			} catch (fluffError) {
				console.warn(
					'RaceService',
					'Failed to load race fluff data',
					fluffError,
				);
				this._raceData.raceFluff = [];
			}

			this._buildRaceIndex();

			console.info('[RaceService]', 'Races loaded successfully', {
				count: this._raceData.race?.length,
			});
			AppState.setLoadedData('races', this._raceData.race);
			eventBus.emit(EVENTS.DATA_LOADED, 'races', this._raceData.race);
		} catch (error) {
			console.error('RaceService', 'Failed to initialize race data', error);
			throw error;
		}
	}

	/**
	 * Get all available races (returns raw JSON data)
	 * @returns {Array<Object>} Array of race objects from JSON
	 */
	getAllRaces() {
		return this._raceData?.race || [];
	}

	/**
	 * Get race by name and source (returns raw JSON data)
	 * @param {string} name - Race name
	 * @param {string} source - Race source
	 * @returns {Object|null} Race object from JSON or null if not found
	 */
	getRace(name, source = 'PHB') {
		const bundle = this._raceIndex?.get(createRaceKey(name, source));
		return bundle?.race || null;
	}

	/**
	 * Get subraces for a specific race
	 * @param {string} raceName - Name of the parent race
	 * @param {string} source - Source book
	 * @returns {Array<Object>} Array of subrace objects
	 */
	getSubraces(raceName, source = 'PHB') {
		const bundle = this._raceIndex?.get(createRaceKey(raceName, source));
		return bundle?.subraces || [];
	}

	/**
	 * Check if a subrace is required for a given race
	 * A subrace is required if the race has NO entry without a name (no base race option)
	 * @param {string} raceName - Name of the race
	 * @param {string} source - Source book
	 * @returns {boolean} True if subrace selection is required, false if optional
	 */
	isSubraceRequired(raceName, source = 'PHB') {
		const bundle = this._raceIndex?.get(createRaceKey(raceName, source));
		return bundle ? !bundle.baseSubrace : false;
	}

	/**
	 * Get a specific subrace by name
	 * @param {string} raceName - Name of the parent race
	 * @param {string} subraceName - Name of the subrace
	 * @param {string} source - Source book
	 * @returns {Object|null} Subrace object or null if not found
	 */
	getSubrace(raceName, subraceName, source = 'PHB') {
		const bundle = this._raceIndex?.get(createRaceKey(raceName, source));
		if (!bundle) return null;
		return bundle.subraces.find((sr) => sr.name === subraceName) || null;
	}

	/**
	 * Get the base (unnamed) subrace for a race, if it exists
	 * @param {string} raceName - Name of the parent race
	 * @param {string} source - Source book
	 * @returns {Object|null} Base subrace object or null if not found
	 */
	getBaseSubrace(raceName, source = 'PHB') {
		const bundle = this._raceIndex?.get(createRaceKey(raceName, source));
		return bundle?.baseSubrace || null;
	}

	/**
	 * Builds an optimized lookup index for fast race access.
	 * 
	 * The index structure is:
	 * Map<"racename:source", {
	 *   race: Object,           // The base race data
	 *   subraces: Array,        // All subraces (named + derived variants)
	 *   baseSubrace: Object     // The unnamed/base subrace if it exists
	 * }>
	 * 
	 * This consolidates:
	 * - Named subraces from the subrace data array
	 * - Derived variant subraces from race._versions
	 * - Derived variant subraces from base subrace._versions
	 * 
	 * @private
	 */
	_buildRaceIndex() {
		console.debug('[RaceService]', 'Building race index');

		this._raceIndex = new Map();
		const races = this._raceData?.race || [];
		const subraceGroups = groupSubracesByRace(this._raceData?.subrace || []);

		for (const race of races) {
			if (!race?.name) continue;

			const raceSource = race.source || 'PHB';
			const key = createRaceKey(race.name, raceSource);
			const explicitSubraces = subraceGroups.get(key) || [];

			const bundle = buildRaceBundle(race, explicitSubraces, raceSource);
			this._raceIndex.set(key, bundle);

			// Debug logging for Human race
			if (race.name === 'Human') {
				console.info('[RaceService]', `Human (${raceSource}) subraces:`, {
					explicit: explicitSubraces.map(s => s.name),
					all: bundle.subraces.map(s => s.name),
					baseSubrace: bundle.baseSubrace?.name,
				});
			}
		}

		console.debug('[RaceService]', `Indexed ${this._raceIndex.size} races`);
	}

	/**
	 * Get fluff data for a race (for descriptions and lore)
	 * @param {string} raceName - Name of the race
	 * @param {string} source - Source book
	 * @returns {Object|null} Race fluff object or null if not found
	 */
	getRaceFluff(raceName, source = 'PHB') {
		if (!this._raceData?.raceFluff) return null;

		return (
			this._raceData.raceFluff.find(
				(f) => f.name === raceName && f.source === source,
			) || null
		);
	}

	/**
	 * Select a race (updates selection state)
	 * @param {string} raceName - Name of the race to select
	 * @param {string} source - Source of the race
	 * @returns {Object|null} Selected race or null if not found
	 */
	selectRace(raceName, source = 'PHB') {
		this._selectedRace = this.getRace(raceName, source);
		this._selectedSubrace = null;

		if (this._selectedRace) {
			eventBus.emit(EVENTS.RACE_SELECTED, this._selectedRace);
		}

		return this._selectedRace;
	}

	/**
	 * Select a subrace for the currently selected race
	 * @param {string} subraceName - Name of the subrace to select
	 * @returns {Object|null} Selected subrace or null if not found
	 */
	selectSubrace(subraceName) {
		if (!this._selectedRace) return null;

		this._selectedSubrace = this.getSubrace(
			this._selectedRace.name,
			subraceName,
			this._selectedRace.source,
		);

		if (this._selectedSubrace) {
			eventBus.emit(EVENTS.SUBRACE_SELECTED, this._selectedSubrace);
		}

		return this._selectedSubrace;
	}

	/**
	 * Get currently selected race
	 * @returns {Object|null} Currently selected race
	 */
	getSelectedRace() {
		return this._selectedRace;
	}

	/**
	 * Get currently selected subrace
	 * @returns {Object|null} Currently selected subrace
	 */
	getSelectedSubrace() {
		return this._selectedSubrace;
	}
}

export const raceService = new RaceService();
