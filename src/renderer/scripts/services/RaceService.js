/** Manages race data and operations for the character builder. */

import { AppState } from '../core/AppState.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { Logger } from '../infrastructure/Logger.js';
import { DataLoader } from '../utils/DataLoader.js';

/** Manages character race selection and provides access to race data. */
class RaceService {
	/** Initialize a new RaceManager. */
	constructor() {
		this._raceData = null;
		this._selectedRace = null;
		this._selectedSubrace = null;
		this._raceLookupMap = null; // Map for O(1) lookups by name
		this._subraceLookupMap = null; // Map for O(1) lookups by subrace name
	}

	/**
	 * Initialize race data by loading from DataUtil
	 * @returns {Promise<void>}
	 */
	async initialize() {
		// Skip if already initialized
		if (this._raceData) {
			Logger.debug('RaceService', 'Already initialized');
			return;
		}

		Logger.info('RaceService', 'Initializing race data');

		try {
			// Load race data
			this._raceData = await DataLoader.loadRaces();

			// Ensure data is valid before processing
			if (!this._raceData) {
				throw new Error('Race data is null or undefined');
			}

			// Load race fluff data
			try {
				const fluffData = await DataLoader.loadRaceFluff();
				if (fluffData?.raceFluff) {
					this._raceData.raceFluff = fluffData.raceFluff;
				}
			} catch (fluffError) {
				Logger.warn(
					'RaceService',
					'Failed to load race fluff data',
					fluffError,
				);
				this._raceData.raceFluff = [];
			}

			// Build lookup maps for O(1) access
			this._raceLookupMap = new Map();
			if (this._raceData.race) {
				for (const race of this._raceData.race) {
					// Skip races with missing names
					if (!race.name) continue;
					const key = `${race.name.toLowerCase()}:${race.source}`;
					this._raceLookupMap.set(key, race);
				}
			}

			this._subraceLookupMap = new Map();
			if (this._raceData.subrace) {
				for (const subrace of this._raceData.subrace) {
					// Skip subraces with missing names
					if (!subrace.name) continue;
					const key = `${subrace.name.toLowerCase()}:${subrace.source}`;
					this._subraceLookupMap.set(key, subrace);
				}
			}

			Logger.info('RaceService', 'Races loaded successfully', {
				count: this._raceData.race?.length,
			});
			AppState.setLoadedData('races', this._raceData.race);
			eventBus.emit(EVENTS.DATA_LOADED, 'races', this._raceData.race);
		} catch (error) {
			Logger.error('RaceService', 'Failed to initialize race data', error);
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
		if (!this._raceLookupMap) return null;

		// O(1) lookup
		const key = `${name.toLowerCase()}:${source}`;
		return this._raceLookupMap.get(key) || null;
	}

	/**
	 * Get subraces for a specific race
	 * @param {string} raceName - Name of the parent race
	 * @param {string} source - Source book
	 * @returns {Array<Object>} Array of subrace objects
	 */
	getSubraces(raceName, source = 'PHB') {
		const subraces = [];

		if (this._raceData?.subrace) {
			// Get all subraces for this race, matching by raceName
			// Filter by raceSource to get the correct parent race variant
			const raceSubraces = this._raceData.subrace.filter(
				(sr) =>
					sr.raceName === raceName &&
					(sr.raceSource === source || !sr.raceSource),
			);
			subraces.push(...raceSubraces);
		}

		// Check if the race itself has _versions (like XPHB Elf lineages, XPHB Tiefling legacies, XPHB Dragonborn colors)
		const mainRace = this.getRace(raceName, source);
		if (mainRace?._versions) {
			for (const version of mainRace._versions) {
				// Check if this is an _abstract/_implementations structure (like XPHB Dragonborn)
				if (version._abstract && version._implementations) {
					const abstractTemplate = version._abstract;
					for (const impl of version._implementations) {
						if (impl._variables?.color) {
							// Create a pseudo-subrace entry for each color
							subraces.push({
								name: impl._variables.color,
								source: source,
								raceName: raceName,
								raceSource: source,
								_isVersion: true,
								_implementation: impl,
								_abstract: abstractTemplate,
							});
						}
					}
				} else {
					// Regular version with a name (like XPHB Elf lineages)
					// Extract the variant name from the full version name
					// e.g., "Elf; Drow Lineage" -> "Drow Lineage"
					// e.g., "Tiefling; Abyssal Legacy" -> "Abyssal Legacy"
					let variantName = version.name;
					if (variantName?.includes(';')) {
						variantName = variantName.split(';')[1].trim();
					}

					subraces.push({
						name: variantName || version.name,
						source: version.source || source,
						raceName: raceName,
						raceSource: source,
						_isVersion: true,
						_versionData: version,
					});
				}
			}
		}

		// Check if the race has _versions in subrace array (like PHB Dragonborn colors)
		const subraceEntry = this._raceData?.subrace?.find(
			(sr) =>
				sr.raceName === raceName &&
				(sr.raceSource === source || !sr.raceSource) &&
				sr._versions,
		);

		if (subraceEntry?._versions?.[0]?._implementations) {
			// Generate subrace-like entries from _versions with _implementations
			const implementations = subraceEntry._versions[0]._implementations;
			const abstractTemplate = subraceEntry._versions[0]._abstract;

			for (const impl of implementations) {
				if (impl._variables?.color) {
					// Create a pseudo-subrace entry for each color
					subraces.push({
						name: impl._variables.color,
						source: subraceEntry.source,
						raceName: raceName,
						raceSource: source,
						_isVersion: true,
						_implementation: impl,
						_abstract: abstractTemplate,
					});
				}
			}
		}

		return subraces;
	}

	/**
	 * Check if a subrace is required for a given race
	 * A subrace is required if the race has NO entry without a name (no base race option)
	 * @param {string} raceName - Name of the race
	 * @param {string} source - Source book
	 * @returns {boolean} True if subrace selection is required, false if optional
	 */
	isSubraceRequired(raceName, source = 'PHB') {
		if (!this._raceData?.subrace) return false;

		// Find if there's a base subrace entry (without a name) for this race
		const baseSubraceEntry = this._raceData.subrace.find(
			(sr) =>
				sr.raceName === raceName &&
				(sr.raceSource === source || !sr.raceSource) &&
				!sr.name, // No name = base race entry
		);

		// If there's NO base entry with no name, it means subraces are required
		// If there IS a base entry, subraces are optional
		return !baseSubraceEntry;
	}

	/**
	 * Get a specific subrace by name
	 * @param {string} raceName - Name of the parent race
	 * @param {string} subraceName - Name of the subrace
	 * @param {string} source - Source book
	 * @returns {Object|null} Subrace object or null if not found
	 */
	getSubrace(raceName, subraceName, source = 'PHB') {
		const subraces = this.getSubraces(raceName, source);
		return subraces.find((sr) => sr.name === subraceName) || null;
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
