/** @file Manages character class selection and data access. */

import { AppState } from '../core/AppState.js';
import { DataLoader } from '../utils/DataLoader.js';
import { eventBus, EVENTS } from '../utils/EventBus.js';

/** Manages character class selection and provides access to class data. */
class ClassService {
	/** Creates a new ClassManager instance. */
	constructor() {
		this._classData = null;
		this._selectedClass = null;
		this._selectedSubclass = null;
	}

	/**
	 * Initialize class data by loading from DataLoader
	 * @returns {Promise<void>} Resolves when data is loaded
	 */
	async initialize() {
		// Check if already initialized
		const existingData = AppState.getLoadedData('classes');
		if (existingData) {
			console.debug('ClassService', 'Already initialized, using cached data');
			this._classData = existingData;
			return;
		}

		console.info('[ClassService]', 'Initializing class data');

		try {
			const index = await DataLoader.loadJSON('class/index.json');
			const fluffIndex = await DataLoader.loadJSON('class/fluff-index.json');

			// Load all class files with individual error handling
			const classFiles = Object.values(index);
			const allClasses = await Promise.allSettled(
				classFiles.map((file) => DataLoader.loadJSON(`class/${file}`)),
			);

			// Load all fluff files with individual error handling
			const fluffFiles = Object.values(fluffIndex);
			const allFluff = await Promise.allSettled(
				fluffFiles.map((file) => DataLoader.loadJSON(`class/${file}`)),
			);

			// Aggregate all classes and class features into single object, handling failures gracefully
			this._classData = {
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
						this._classData.class.push(...classData.class);
					}
					if (classData.classFeature && Array.isArray(classData.classFeature)) {
						this._classData.classFeature.push(...classData.classFeature);
					}
					if (classData.subclass && Array.isArray(classData.subclass)) {
						this._classData.subclass.push(...classData.subclass);
					}
					if (
						classData.subclassFeature &&
						Array.isArray(classData.subclassFeature)
					) {
						this._classData.subclassFeature.push(...classData.subclassFeature);
					}
				} else {
					console.warn('ClassService', 'Failed to load class file:', result.reason?.message);
				}
			}

			// Aggregate fluff data
			for (const result of allFluff) {
				if (result.status === 'fulfilled') {
					const fluffData = result.value;
					if (fluffData.classFluff && Array.isArray(fluffData.classFluff)) {
						this._classData.classFluff.push(...fluffData.classFluff);
					}
					if (fluffData.subclassFluff && Array.isArray(fluffData.subclassFluff)) {
						this._classData.subclassFluff.push(...fluffData.subclassFluff);
					}
				} else {
					console.warn('ClassService', 'Failed to load class fluff file:', result.reason?.message);
				}
			}

			console.info('[ClassService]', 'Class data loaded', {
				classes: this._classData.class.length,
				classFeatures: this._classData.classFeature.length,
				subclasses: this._classData.subclass.length,
				subclassFeatures: this._classData.subclassFeature.length,
			});

			// Store in AppState
			AppState.setLoadedData('classes', this._classData);

			// Emit event
			eventBus.emit(EVENTS.DATA_LOADED, 'classes', this._classData.class);

		} catch (error) {
			console.error('ClassService', 'Failed to initialize class data', error);
			this._classData = {
				class: [],
				classFeature: [],
				subclass: [],
				subclassFeature: [],
				classFluff: [],
				subclassFluff: [],
			};
			throw error;
		}
	}

	/**
	 * Get all available classes (returns raw JSON data)
	 * @returns {Array<Object>} Array of class objects from JSON
	 */
	getAllClasses() {
		return this._classData?.class || [];
	}

	/**
	 * Get a specific class by name and source (returns raw JSON data)
	 * @param {string} name - Class name
	 * @param {string} source - Source book
	 * @returns {Object|null} Class object from JSON or null if not found
	 */
	getClass(name, source = 'PHB') {
		if (!this._classData?.class) return null;

		return (
			this._classData.class.find(
				(c) => c.name === name && c.source === source,
			) || null
		);
	}

	/**
	 * Get class features for a specific class up to a given level
	 * @param {string} className - Name of the class
	 * @param {number} level - Character level
	 * @param {string} source - Source book
	 * @returns {Array<Object>} Array of class feature objects
	 */
	getClassFeatures(className, level, source = 'PHB') {
		if (!this._classData?.classFeature) return [];

		return this._classData.classFeature.filter(
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
		if (!this._classData?.subclass) return [];

		return this._classData.subclass.filter(
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
		if (!this._classData?.subclassFeature) return [];

		return this._classData.subclassFeature.filter(
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
		if (!this._classData?.classFluff) return null;

		return (
			this._classData.classFluff.find(
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
}

// Create and export singleton instance
export const classService = new ClassService();
