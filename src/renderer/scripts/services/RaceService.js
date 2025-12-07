/** Manages race data and operations for the character builder. */

import { AppState } from '../core/AppState.js';
import { DataLoader } from '../utils/DataLoader.js';
import { eventBus, EVENTS } from '../utils/EventBus.js';

/** Manages character race selection and provides access to race data. */
class RaceService {
	/** Initialize a new RaceManager. */
	constructor() {
		this._raceData = null;
		this._selectedRace = null;
		this._selectedSubrace = null;
		this._raceIndex = null; // keyed by race name + source
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
		const bundle = this._raceIndex?.get(this._raceKey(name, source));
		return bundle?.race || null;
	}

	/**
	 * Get subraces for a specific race
	 * @param {string} raceName - Name of the parent race
	 * @param {string} source - Source book
	 * @returns {Array<Object>} Array of subrace objects
	 */
	getSubraces(raceName, source = 'PHB') {
		const bundle = this._raceIndex?.get(this._raceKey(raceName, source));
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
		const bundle = this._raceIndex?.get(this._raceKey(raceName, source));
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
		const bundle = this._raceIndex?.get(this._raceKey(raceName, source));
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
		const bundle = this._raceIndex?.get(this._raceKey(raceName, source));
		return bundle?.baseSubrace || null;
	}

	_raceKey(name, source = 'PHB') {
		return `${name?.toLowerCase()}:${source}`;
	}

	_buildRaceIndex() {
		this._raceIndex = new Map();
		const races = this._raceData?.race || [];
		const subraceGroups = this._groupSubracesByRace(this._raceData?.subrace || []);

		for (const race of races) {
			if (!race?.name) continue;
			const raceSource = race.source || 'PHB';
			const key = this._raceKey(race.name, raceSource);

			const explicitSubraces = subraceGroups.get(key) || [];
			const derivedFromRace = this._deriveVersionSubracesFromRace(
				race,
				raceSource,
			);
			// Only derive versions from unnamed (base) subraces; named subraces are complete variants
			const baseSubraces = explicitSubraces.filter((sr) => !sr.name);
			const derivedFromSubrace = baseSubraces.flatMap((entry) =>
				this._deriveVersionSubracesFromSubraceEntry(
					entry,
					race.name,
					raceSource,
				),
			);

			const namedSubraces = explicitSubraces.filter((sr) => sr.name);
			const baseSubrace = baseSubraces[0] || null;

			const mergedSubraces = [
				...namedSubraces,
				...derivedFromRace,
				...derivedFromSubrace,
			];

			this._raceIndex.set(key, {
				race,
				subraces: mergedSubraces,
				baseSubrace,
			});
		}
	}

	_groupSubracesByRace(subraceArray) {
		const group = new Map();
		for (const subrace of subraceArray) {
			if (!subrace?.raceName) continue;
			const raceSource = subrace.raceSource || subrace.source || 'PHB';
			const key = this._raceKey(subrace.raceName, raceSource);
			if (!group.has(key)) group.set(key, []);
			group.get(key).push(subrace);
		}
		return group;
	}

	_deriveVersionSubracesFromRace(race, source) {
		if (!race?._versions) return [];
		const derived = [];
		for (const version of race._versions) {
			if (version._abstract && version._implementations) {
				const abstractTemplate = version._abstract;
				for (const impl of version._implementations) {
					if (impl._variables?.color) {
						derived.push({
							name: impl._variables.color,
							source,
							raceName: race.name,
							raceSource: source,
							_isVersion: true,
							_implementation: impl,
							_abstract: abstractTemplate,
						});
					}
				}
			} else {
				let variantName = version.name;
				if (variantName?.includes(';')) {
					variantName = variantName.split(';')[1].trim();
				}

				derived.push({
					name: variantName || version.name,
					source: version.source || source,
					raceName: race.name,
					raceSource: source,
					_isVersion: true,
					_versionData: version,
				});
			}
		}
		return derived;
	}

	_deriveVersionSubracesFromSubraceEntry(subraceEntry, raceName, raceSource) {
		const root = subraceEntry?._versions?.[0];
		if (!root?._implementations) return [];
		const abstractTemplate = root._abstract;
		return root._implementations
			.filter((impl) => impl._variables?.color)
			.map((impl) => ({
				name: impl._variables.color,
				source: subraceEntry.source || subraceEntry.raceSource || raceSource,
				raceName,
				raceSource,
				_isVersion: true,
				_implementation: impl,
				_abstract: abstractTemplate,
			}));
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
