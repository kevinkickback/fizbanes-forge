import { DataLoader } from '../lib/DataLoader.js';
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

class RaceService extends BaseDataService {
	constructor() {
		super({ cacheKey: 'races', loggerScope: 'RaceService' });
		/** @type {Map<string, {race: Object, subraces: Array, baseSubrace: Object|null}>} */
		this._raceIndex = null;
	}

	async initialize() {
		await this.initWithLoader(
			async () => {
				const races = await DataLoader.loadRaces();
				if (!races) throw new Error('Race data is null or undefined');

				try {
					const fluffData = await DataLoader.loadRaceFluff();
					if (fluffData?.raceFluff) {
						races.raceFluff = fluffData.raceFluff;
					}
				} catch (fluffError) {
					console.warn(
						'[RaceService]',
						'Failed to load race fluff data',
						fluffError,
					);
					races.raceFluff = [];
				}

				return races;
			},
			{
				onLoaded: (data) => {
					this._buildRaceIndex(data);
				},
				onError: () => ({ race: [], subrace: [], raceFluff: [] }),
			},
		);
	}

	getAllRaces() {
		return this._data?.race || [];
	}

	getRace(name, source = 'PHB') {
		const bundle = this._raceIndex?.get(createRaceKey(name, source));
		return bundle?.race || null;
	}

	getSubraces(raceName, source = 'PHB') {
		const bundle = this._raceIndex?.get(createRaceKey(raceName, source));
		return bundle?.subraces || [];
	}

	/**
	 * Check if a subrace is required for a given race
	 * A subrace is required if the race has named subraces BUT no base/unnamed subrace option
	 * (i.e., you MUST pick a specific subrace, not "Standard")
	 * @param {string} raceName - Name of the race
	 * @param {string} source - Source book
	 * @returns {boolean} True if subrace selection is required, false if optional or no subraces exist
	 */
	isSubraceRequired(raceName, source = 'PHB') {
		const bundle = this._raceIndex?.get(createRaceKey(raceName, source));
		if (!bundle) return false;

		// Subrace is required only if:
		// 1. There are subraces available (length > 0)
		// 2. There is no base/unnamed subrace option (baseSubrace is null)
		return bundle.subraces.length > 0 && !bundle.baseSubrace;
	}

	getSubrace(raceName, subraceName, source = 'PHB') {
		const bundle = this._raceIndex?.get(createRaceKey(raceName, source));
		if (!bundle) return null;
		return bundle.subraces.find((sr) => sr.name === subraceName) || null;
	}

	getBaseSubrace(raceName, source = 'PHB') {
		const bundle = this._raceIndex?.get(createRaceKey(raceName, source));
		return bundle?.baseSubrace || null;
	}

	_buildRaceIndex(data = this._data) {
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
		}
	}

	getRaceFluff(raceName, source = 'PHB') {
		if (!this._data?.raceFluff) return null;

		return (
			this._data.raceFluff.find(
				(f) => f.name === raceName && f.source === source,
			) || null
		);
	}
}

export const raceService = new RaceService();
