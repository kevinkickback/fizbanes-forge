/** Manages race data and operations for the character builder. */
import { DataLoader } from '../lib/DataLoader.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import {
	STANDARD_LANGUAGE_OPTIONS,
	STANDARD_SKILL_OPTIONS,
	STANDARD_TOOL_OPTIONS,
} from '../lib/ProficiencyConstants.js';
import { BaseDataService } from './BaseDataService.js';

function groupSubracesByRace(subraceArray) {
	const groups = new Map();

	for (const subrace of subraceArray) {
		if (!subrace?.raceName) continue;

		const raceSource = subrace.raceSource || subrace.source || 'PHB';
		const key = createRaceKey(subrace.raceName, raceSource);

		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key).push(subrace);
	}

	return groups;
}

function deriveVersionSubracesFromRace(race, source) {
	if (!race?._versions) return [];

	const derived = [];

	for (const version of race._versions) {
		if (version._abstract && version._implementations) {
			derived.push(
				...deriveFromAbstractImplementation(
					version._abstract,
					version._implementations,
					race.name,
					source,
				),
			);
		} else {
			derived.push(deriveFromSimpleVersion(version, race.name, source));
		}
	}

	return derived;
}

function deriveVersionSubracesFromSubraceEntry(
	subraceEntry,
	raceName,
	raceSource,
) {
	const firstVersion = subraceEntry?._versions?.[0];
	if (!firstVersion?._implementations) return [];

	return deriveFromAbstractImplementation(
		firstVersion._abstract,
		firstVersion._implementations,
		raceName,
		subraceEntry.source || subraceEntry.raceSource || raceSource,
	);
}

function createRaceKey(name, source = 'PHB') {
	return `${name?.toLowerCase()}:${source}`;
}

function buildRaceBundle(race, explicitSubraces, raceSource) {
	const namedSubraces = explicitSubraces.filter((sr) => sr.name);
	const baseSubraces = explicitSubraces.filter((sr) => !sr.name);

	const derivedFromRace = deriveVersionSubracesFromRace(race, raceSource);

	const derivedFromSubrace = baseSubraces.flatMap((entry) =>
		deriveVersionSubracesFromSubraceEntry(entry, race.name, raceSource),
	);

	const allSubraces = [
		...namedSubraces,
		...derivedFromRace,
		...derivedFromSubrace,
	];

	return {
		race,
		subraces: allSubraces,
		baseSubrace: baseSubraces[0] || null,
	};
}

function deriveFromAbstractImplementation(
	abstractTemplate,
	implementations,
	raceName,
	source,
) {
	return implementations
		.filter((impl) => impl._variables?.color)
		.map((impl) => ({
			name: impl._variables.color,
			source,
			raceName,
			raceSource: source,
			_isVersion: true,
			_implementation: impl,
			_abstract: abstractTemplate,
		}));
}

function deriveFromSimpleVersion(version, raceName, source) {
	let variantName = version.name;

	if (variantName?.includes(';')) {
		variantName = variantName.split(';')[1].trim();
	}

	return {
		name: variantName || version.name,
		source: version.source || source,
		raceName,
		raceSource: source,
		_isVersion: true,
		_versionData: version,
	};
}

/**
 * Service for managing character race selection and race data access.
 * Provides O(1) lookup performance for races via an internal index.
 */
class RaceService extends BaseDataService {
	constructor() {
		super({ cacheKey: 'races', loggerScope: 'RaceService' });
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
		await this.initWithLoader(
			async () => {
				console.info('[RaceService]', 'Initializing race data');
				const races = await DataLoader.loadRaces();
				if (!races) throw new Error('Race data is null or undefined');

				try {
					const fluffData = await DataLoader.loadRaceFluff();
					if (fluffData?.raceFluff) {
						races.raceFluff = fluffData.raceFluff;
					}
				} catch (fluffError) {
					console.warn(
						'RaceService',
						'Failed to load race fluff data',
						fluffError,
					);
					races.raceFluff = [];
				}

				return races;
			},
			{
				onLoaded: (data, meta) => {
					this._buildRaceIndex(data);
					console.info('[RaceService]', 'Races loaded successfully', {
						count: data?.race?.length,
						fromCache: meta?.fromCache || false,
					});
				},
				onError: () => ({ race: [], subrace: [], raceFluff: [] }),
			},
		);
	}

	/**
	 * Get all available races (returns raw JSON data)
	 * @returns {Array<Object>} Array of race objects from JSON
	 */
	getAllRaces() {
		return this._data?.race || [];
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
	_buildRaceIndex(data = this._data) {
		console.debug('[RaceService]', 'Building race index');

		this._raceIndex = new Map();
		const races = data?.race || [];
		const subraceGroups = groupSubracesByRace(data?.subrace || []);

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
					explicit: explicitSubraces.map((s) => s.name),
					all: bundle.subraces.map((s) => s.name),
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
		if (!this._data?.raceFluff) return null;

		return (
			this._data.raceFluff.find(
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

	/**
	 * Get standard skill proficiency options
	 * @returns {Array<string>} Array of all standard skill names
	 */
	getStandardSkillOptions() {
		return STANDARD_SKILL_OPTIONS;
	}

	/**
	 * Get standard tool proficiency options
	 * @returns {Array<string>} Array of all standard tool names
	 */
	getStandardToolOptions() {
		return STANDARD_TOOL_OPTIONS;
	}

	/**
	 * Get standard language proficiency options
	 * @returns {Array<string>} Array of all standard language names
	 */
	getStandardLanguageOptions() {
		return STANDARD_LANGUAGE_OPTIONS;
	}
}

export const raceService = new RaceService();
