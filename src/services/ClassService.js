/** Manages character class selection and data access. */
import { DataLoader } from '../lib/DataLoader.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { BaseDataService } from './BaseDataService.js';

/** Manages character class selection and provides access to class data. */
class ClassService extends BaseDataService {
	constructor() {
		super({ cacheKey: 'classes', loggerScope: 'ClassService' });
		this._selectedClass = null;
		this._selectedSubclass = null;
	}

	async initialize() {
		await this.initWithLoader(
			async () => {
				console.info('[ClassService]', 'Initializing class data');
				const index = await DataLoader.loadJSON('class/index.json');
				const fluffIndex = await DataLoader.loadJSON('class/fluff-index.json');

				const classFiles = Object.values(index);
				const allClasses = await Promise.allSettled(
					classFiles.map((file) => DataLoader.loadJSON(`class/${file}`)),
				);

				const fluffFiles = Object.values(fluffIndex);
				const allFluff = await Promise.allSettled(
					fluffFiles.map((file) => DataLoader.loadJSON(`class/${file}`)),
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

					console.info('[ClassService]', 'Class data loaded', {
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

	/**
	 * Get all available classes (returns raw JSON data)
	 * @returns {Array<Object>} Array of class objects from JSON
	 */
	getAllClasses() {
		return this._data?.class || [];
	}

	/**
	 * Get a specific class by name and source (returns raw JSON data)
	 * @param {string} name - Class name
	 * @param {string} source - Source book
	 * @returns {Object|null} Class object from JSON or null if not found
	 */
	getClass(name, source = 'PHB') {
		if (!this._data?.class) return null;

		// Try to find exact source match first
		const exactMatch = this._data.class.find((c) => c.name === name && c.source === source);
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

	/**
	 * Get class features for a specific class up to a given level
	 * @param {string} className - Name of the class
	 * @param {number} level - Character level
	 * @param {string} source - Source book
	 * @returns {Array<Object>} Array of class feature objects
	 */
	getClassFeatures(className, level, source = 'PHB') {
		if (!this._data?.classFeature) return [];

		return this._data.classFeature.filter(
			(feature) =>
				feature.className === className &&
				(feature.classSource === source || feature.source === source) &&
				feature.level <= level,
		);
	}

	/**
	 * Get all subclasses for a specific class
	 * @param {string} className - Name of the parent class
	 * @param {string} source - Source book
	 * @returns {Array<Object>} Array of subclass objects
	 */
	getSubclasses(className, source = 'PHB') {
		if (!this._data?.subclass) return [];

		return this._data.subclass.filter(
			(sc) =>
				sc.className === className &&
				(sc.classSource === source || !sc.classSource),
		);
	}

	/**
	 * Get a specific subclass by name
	 * @param {string} className - Name of the parent class
	 * @param {string} subclassName - Name or short name of the subclass
	 * @param {string} source - Source book
	 * @returns {Object|null} Subclass object or null if not found
	 */
	getSubclass(className, subclassName, source = 'PHB') {
		const subclasses = this.getSubclasses(className, source);
		return (
			subclasses.find(
				(sc) => sc.name === subclassName || sc.shortName === subclassName,
			) || null
		);
	}

	/**
	 * Get subclass features for a specific subclass up to a given level
	 * @param {string} className - Name of the parent class
	 * @param {string} subclassShortName - Short name of the subclass
	 * @param {number} level - Character level
	 * @param {string} source - Source book
	 * @returns {Array<Object>} Array of subclass feature objects
	 */
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

	/**
	 * Get fluff data for a class (for descriptions and lore)
	 * @param {string} className - Name of the class
	 * @param {string} source - Source book
	 * @returns {Object|null} Class fluff object or null if not found
	 */
	getClassFluff(className, source = 'PHB') {
		if (!this._data?.classFluff) return null;

		return (
			this._data.classFluff.find(
				(f) => f.name === className && f.source === source,
			) || null
		);
	}

	/**
	 * Select a class (updates selection state)
	 * @param {string} className - Name of the class to select
	 * @param {string} source - Source of the class
	 * @returns {Object|null} The selected class or null if not found
	 */
	selectClass(className, source = 'PHB') {
		console.debug('ClassService', 'Selecting class', { className, source });

		this._selectedClass = this.getClass(className, source);
		this._selectedSubclass = null;

		if (this._selectedClass) {
			console.info('[ClassService]', 'Class selected', { className, source });
			eventBus.emit(EVENTS.CLASS_SELECTED, this._selectedClass);
		} else {
			console.warn('ClassService', 'Class not found', { className, source });
		}

		return this._selectedClass;
	}

	/**
	 * Select a subclass for the currently selected class
	 * @param {string} subclassName - Name or short name of the subclass to select
	 * @returns {Object|null} The selected subclass or null if not found
	 */
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
			console.info('[ClassService]', 'Subclass selected', { subclassName });
			eventBus.emit(EVENTS.SUBCLASS_SELECTED, this._selectedSubclass);
		} else {
			console.warn('ClassService', 'Subclass not found', { subclassName });
		}

		return this._selectedSubclass;
	}

	/**
	 * Get the currently selected class
	 * @returns {Object|null} Currently selected class
	 */
	getSelectedClass() {
		return this._selectedClass;
	}

	/**
	 * Get the currently selected subclass
	 * @returns {Object|null} Currently selected subclass
	 */
	getSelectedSubclass() {
		return this._selectedSubclass;
	}

	/**
	 * Get optional feature progression for a class
	 * @param {string} className - Name of the class
	 * @param {string} source - Source book
	 * @returns {Array<Object>|null} Optional feature progression array or null
	 */
	getOptionalFeatureProgression(className, source = 'PHB') {
		const classData = this.getClass(className, source);
		return classData?.optionalfeatureProgression || null;
	}

	/**
	 * Get count of optional features available at a specific level
	 * @param {string} className - Name of the class
	 * @param {number} level - Character level (1-20)
	 * @param {Array<string>} featureTypes - Feature type codes to check (e.g., ['EI'], ['MM'])
	 * @param {string} source - Source book
	 * @returns {number} Number of features available at this level (0 if none or new ones)
	 */
	getOptionalFeatureCountAtLevel(className, level, featureTypes, source = 'PHB') {
		const progression = this.getOptionalFeatureProgression(className, source);
		if (!progression) return 0;

		// Find matching progression entry
		const entry = progression.find(p => 
			p.featureType?.some(ft => featureTypes.includes(ft))
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

	/**
	 * Check if a new optional feature is gained at a specific level
	 * @param {string} className - Name of the class
	 * @param {number} currentLevel - Previous level
	 * @param {number} newLevel - New level
	 * @param {Array<string>} featureTypes - Feature type codes
	 * @param {string} source - Source book
	 * @returns {boolean} True if new feature(s) gained
	 */
	gainsOptionalFeatureAtLevel(className, currentLevel, newLevel, featureTypes, source = 'PHB') {
		const countAtCurrent = this.getOptionalFeatureCountAtLevel(className, currentLevel, featureTypes, source);
		const countAtNew = this.getOptionalFeatureCountAtLevel(className, newLevel, featureTypes, source);
		return countAtNew > countAtCurrent;
	}
}

// Create and export singleton instance
export const classService = new ClassService();
