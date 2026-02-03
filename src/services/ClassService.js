import { DataLoader } from '../lib/DataLoader.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { BaseDataService } from './BaseDataService.js';
class ClassService extends BaseDataService {
	constructor() {
		super({ cacheKey: 'classes', loggerScope: 'ClassService' });
		this._selectedClass = null;
		this._selectedSubclass = null;
	}

	async initialize() {
		const TTL_24_HOURS = 24 * 60 * 60 * 1000;
		await this.initWithLoader(
			async () => {
				console.debug('ClassService', 'Initializing class data');
				const index = await DataLoader.loadJSON('class/index.json', {
					ttl: TTL_24_HOURS,
				});
				const fluffIndex = await DataLoader.loadJSON('class/fluff-index.json', {
					ttl: TTL_24_HOURS,
				});

				const classFiles = Object.values(index);
				const allClasses = await Promise.allSettled(
					classFiles.map((file) =>
						DataLoader.loadJSON(`class/${file}`, { ttl: TTL_24_HOURS }),
					),
				);

				const fluffFiles = Object.values(fluffIndex);
				const allFluff = await Promise.allSettled(
					fluffFiles.map((file) =>
						DataLoader.loadJSON(`class/${file}`, { ttl: TTL_24_HOURS }),
					),
				);

				const aggregated = {
					class: [],
					classFeature: [],
					subclass: [],
					subclassFeature: [],
					classFluff: [],
					subclassFluff: [],
				};

				for (const result of allClasses) {
					if (result.status === 'fulfilled') {
						const classData = result.value;
						if (classData.class && Array.isArray(classData.class)) {
							aggregated.class.push(...classData.class);
						}
						if (
							classData.classFeature &&
							Array.isArray(classData.classFeature)
						) {
							aggregated.classFeature.push(...classData.classFeature);
						}
						if (classData.subclass && Array.isArray(classData.subclass)) {
							aggregated.subclass.push(...classData.subclass);
						}
						if (
							classData.subclassFeature &&
							Array.isArray(classData.subclassFeature)
						) {
							aggregated.subclassFeature.push(...classData.subclassFeature);
						}
					} else {
						console.warn(
							'ClassService',
							'Failed to load class file:',
							result.reason?.message,
						);
					}
				}

				for (const result of allFluff) {
					if (result.status === 'fulfilled') {
						const fluffData = result.value;
						if (fluffData.classFluff && Array.isArray(fluffData.classFluff)) {
							aggregated.classFluff.push(...fluffData.classFluff);
						}
						if (
							fluffData.subclassFluff &&
							Array.isArray(fluffData.subclassFluff)
						) {
							aggregated.subclassFluff.push(...fluffData.subclassFluff);
						}
					} else {
						console.warn(
							'ClassService',
							'Failed to load class fluff file:',
							result.reason?.message,
						);
					}
				}

				return aggregated;
			},
			{
				onLoaded: (data, meta) => {
					const dataset = data || {
						class: [],
						classFeature: [],
						subclass: [],
						subclassFeature: [],
						classFluff: [],
						subclassFluff: [],
					};

					console.debug('ClassService', 'Class data loaded', {
						classes: dataset.class.length,
						classFeatures: dataset.classFeature.length,
						subclasses: dataset.subclass.length,
						subclassFeatures: dataset.subclassFeature.length,
						fromCache: meta?.fromCache || false,
					});
				},
				onError: () => ({
					class: [],
					classFeature: [],
					subclass: [],
					subclassFeature: [],
					classFluff: [],
					subclassFluff: [],
				}),
			},
		);
	}

	getAllClasses() {
		return this._data?.class || [];
	}

	/** Get a specific class by name and source. */
	getClass(name, source = 'PHB') {
		if (!this._data?.class) return null;

		// Try to find exact source match first
		const exactMatch = this._data.class.find(
			(c) => c.name === name && c.source === source,
		);
		if (exactMatch) {
			return exactMatch;
		}

		// Fall back to any source for the class (preference: PHB, then classic edition, then any)
		const byName = this._data.class.filter((c) => c.name === name);
		if (byName.length === 0) return null;

		// Return first matching class if exact source not found
		// Prefer classic/primary editions over newer ones
		return byName.find((c) => c.edition !== 'modern') || byName[0];
	}

	/** Get class features for a specific class up to a given level. */
	getClassFeatures(className, level, source = 'PHB') {
		if (!this._data?.classFeature) return [];

		return this._data.classFeature.filter(
			(feature) =>
				feature.className === className &&
				(feature.classSource === source || feature.source === source) &&
				feature.level <= level,
		);
	}

	/** Get all subclasses for a specific class. */
	getSubclasses(className, source = 'PHB') {
		if (!this._data?.subclass) return [];

		return this._data.subclass.filter(
			(sc) =>
				sc.className === className &&
				(sc.classSource === source || !sc.classSource),
		);
	}

	/** Get the hit die for a class from 5etools data. */
	getHitDie(className, source = 'PHB') {
		if (!this._data?.class) return 'd8';

		const classObj = this._data.class.find(
			(c) => c.name === className && (c.source === source || !source),
		);

		if (classObj?.hd) {
			// 5etools stores hit die as number (8, 10, 12) or full die string
			const hdValue = classObj.hd;
			if (typeof hdValue === 'number') {
				return `d${hdValue}`;
			}
			if (typeof hdValue === 'string') {
				// Already in 'd8' format
				return hdValue.startsWith('d') ? hdValue : `d${hdValue}`;
			}
		}

		// Fallback to defaults if not found in class data
		const defaultHitDice = {
			Barbarian: 'd12',
			Bard: 'd8',
			Cleric: 'd8',
			Druid: 'd8',
			Fighter: 'd10',
			Monk: 'd8',
			Paladin: 'd10',
			Ranger: 'd10',
			Rogue: 'd8',
			Sorcerer: 'd6',
			Warlock: 'd8',
			Wizard: 'd6',
		};

		return defaultHitDice[className] || 'd8';
	}

	/** Get a specific subclass by name. */
	getSubclass(className, subclassName, source = 'PHB') {
		const subclasses = this.getSubclasses(className, source);
		return (
			subclasses.find(
				(sc) => sc.name === subclassName || sc.shortName === subclassName,
			) || null
		);
	}

	/** Get subclass features for a specific subclass up to a given level. */
	getSubclassFeatures(className, subclassShortName, level, source = 'PHB') {
		if (!this._data?.subclassFeature) return [];

		return this._data.subclassFeature.filter(
			(feature) =>
				feature.className === className &&
				feature.subclassShortName === subclassShortName &&
				(feature.classSource === source || feature.source === source) &&
				feature.level <= level,
		);
	}

	/** Get fluff data for a class (descriptions and lore). */
	getClassFluff(className, source = 'PHB') {
		if (!this._data?.classFluff) return null;

		return (
			this._data.classFluff.find(
				(f) => f.name === className && f.source === source,
			) || null
		);
	}

	/** Select a class (updates selection state). */
	selectClass(className, source = 'PHB') {
		console.debug('ClassService', 'Selecting class', { className, source });

		this._selectedClass = this.getClass(className, source);
		this._selectedSubclass = null;

		if (this._selectedClass) {
			console.debug('ClassService', 'Class selected', { className, source });
			eventBus.emit(EVENTS.CLASS_SELECTED, this._selectedClass);
		} else {
			console.warn('ClassService', 'Class not found', { className, source });
		}

		return this._selectedClass;
	}

	/** Select a subclass for the currently selected class. */
	selectSubclass(subclassName) {
		if (!this._selectedClass) {
			console.warn('ClassService', 'Cannot select subclass: no class selected');
			return null;
		}

		console.debug('ClassService', 'Selecting subclass', { subclassName });

		this._selectedSubclass = this.getSubclass(
			this._selectedClass.name,
			subclassName,
			this._selectedClass.source,
		);

		if (this._selectedSubclass) {
			console.debug('ClassService', 'Subclass selected', { subclassName });
			eventBus.emit(EVENTS.SUBCLASS_SELECTED, this._selectedSubclass);
		} else {
			console.warn('ClassService', 'Subclass not found', { subclassName });
		}

		return this._selectedSubclass;
	}

	getSelectedClass() {
		return this._selectedClass;
	}

	getSelectedSubclass() {
		return this._selectedSubclass;
	}

	/** Get optional feature progression for a class. */
	getOptionalFeatureProgression(className, source = 'PHB') {
		const classData = this.getClass(className, source);
		return classData?.optionalfeatureProgression || null;
	}

	/** Get count of optional features available at a specific level. */
	getOptionalFeatureCountAtLevel(
		className,
		level,
		featureTypes,
		source = 'PHB',
	) {
		const progression = this.getOptionalFeatureProgression(className, source);
		if (!progression) return 0;

		// Find matching progression entry
		const entry = progression.find((p) =>
			p.featureType?.some((ft) => featureTypes.includes(ft)),
		);
		if (!entry) return 0;

		// Handle array-based progression (indexed by level-1)
		if (Array.isArray(entry.progression)) {
			return entry.progression[level - 1] || 0;
		}

		// Handle object-based progression (level as key)
		if (typeof entry.progression === 'object') {
			return entry.progression[level.toString()] || 0;
		}

		return 0;
	}

	/** Check if a new optional feature is gained at a specific level. */
	gainsOptionalFeatureAtLevel(
		className,
		currentLevel,
		newLevel,
		featureTypes,
		source = 'PHB',
	) {
		const countAtCurrent = this.getOptionalFeatureCountAtLevel(
			className,
			currentLevel,
			featureTypes,
			source,
		);
		const countAtNew = this.getOptionalFeatureCountAtLevel(
			className,
			newLevel,
			featureTypes,
			source,
		);
		return countAtNew > countAtCurrent;
	}

	/** Get the level at which a class gains its subclass. */
	getSubclassLevel(classData) {
		if (!classData?.classFeatures) return null;

		// Find the first classFeature with gainSubclassFeature flag
		for (const feature of classData.classFeatures) {
			if (feature.gainSubclassFeature === true) {
				// Parse level from classFeature string format: "Feature Name|ClassName||Level"
				const parts = feature.classFeature.split('|');
				const level = parseInt(parts[parts.length - 1], 10);
				return Number.isNaN(level) ? null : level;
			}
		}

		return null;
	}

	/** Get count from a progression array or object at a specific level. */
	getCountAtLevel(progression, level) {
		if (Array.isArray(progression)) {
			return progression[level - 1] || 0;
		}
		if (typeof progression === 'object') {
			return progression[level.toString()] || 0;
		}
		return 0;
	}

	/** Map feature type code to readable feature type name. */
	mapFeatureType(featureTypeCode) {
		const typeMap = {
			EI: 'invocation',
			MM: 'metamagic',
			'MV:B': 'maneuver',
			'FS:F': 'fighting-style',
			'FS:R': 'fighting-style',
			'FS:P': 'fighting-style',
			PB: 'patron',
		};
		return typeMap[featureTypeCode] || 'other';
	}
}

// Create and export singleton instance
export const classService = new ClassService();
