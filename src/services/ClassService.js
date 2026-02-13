import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import {
	classIdentifierSchema,
	subclassIdentifierSchema,
	validateInput,
} from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';
class ClassService extends BaseDataService {
	constructor() {
		super({ loggerScope: 'ClassService' });
	}

	async initialize() {
		await this.initWithLoader(
			async () => {
				const index = await DataLoader.loadJSON('class/index.json');
				const fluffIndex = await DataLoader.loadJSON('class/fluff-index.json');

				const classFiles = Object.values(index);
				const allClasses = await Promise.allSettled(
					classFiles.map((file) =>
						DataLoader.loadJSON(`class/${file}`),
					),
				);

				const fluffFiles = Object.values(fluffIndex);
				const allFluff = await Promise.allSettled(
					fluffFiles.map((file) =>
						DataLoader.loadJSON(`class/${file}`),
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

					console.debug('[ClassService]', 'Class data loaded', {
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
		const validated = validateInput(
			classIdentifierSchema,
			{ name, source },
			'Invalid class identifier',
		);

		if (!this._data?.class) {
			throw new NotFoundError('Class', `${validated.name} (${validated.source})`);
		}

		// Try to find exact source match first
		const exactMatch = this._data.class.find(
			(c) => c.name === validated.name && c.source === validated.source,
		);
		if (exactMatch) {
			return exactMatch;
		}

		// Fall back to any source for the class (preference: PHB, then classic edition, then any)
		const byName = this._data.class.filter((c) => c.name === validated.name);
		if (byName.length === 0) {
			throw new NotFoundError('Class', `${validated.name} (${validated.source})`);
		}

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

	/** Alias for getClass() for backward compatibility */
	getClassByName(className, source = 'PHB') {
		return this.getClass(className, source);
	}

	/** Get a specific subclass by name. */
	getSubclass(className, subclassName, source = 'PHB') {
		const validated = validateInput(
			subclassIdentifierSchema,
			{ className, subclassName, source },
			'Invalid subclass identifier',
		);

		const subclasses = this.getSubclasses(
			validated.className,
			validated.source,
		);

		const subclass = subclasses.find(
			(sc) =>
				sc.name === validated.subclassName ||
				sc.shortName === validated.subclassName,
		);

		if (!subclass) {
			throw new NotFoundError(
				'Subclass',
				`${validated.subclassName} for ${validated.className} (${validated.source})`,
			);
		}

		return subclass;
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

	/**
	 * Extract nested user choices from a feature's entries.
	 * Detects two 5etools patterns:
	 *  1. `type: "options"` blocks (with refSubclassFeature or inline entries)
	 *  2. `type: "table"` blocks in text that says "choose" (e.g. Dragon Ancestor)
	 *
	 * @param {Object} feature - A classFeature or subclassFeature object
	 * @returns {Array<Object>} Array of choice descriptors, empty if none found
	 */
	getFeatureEntryChoices(feature) {
		if (!feature?.entries || !Array.isArray(feature.entries)) return [];

		const choices = [];

		for (const entry of feature.entries) {
			if (typeof entry !== 'object' || entry === null) continue;

			// Pattern 1: type:"options" blocks
			if (entry.type === 'options' && Array.isArray(entry.entries)) {
				const options = this._resolveOptionsEntries(
					entry.entries,
					feature,
				);
				if (options.length > 0) {
					choices.push({
						type: 'options',
						featureName: feature.name,
						level: feature.level,
						count: entry.count || 1,
						options,
					});
				}
			}

			// Pattern 2: type:"table" in a feature whose text says "choose"
			// Exclude random roll tables (first column has dice notation like {@dice d100})
			if (entry.type === 'table' && Array.isArray(entry.rows)) {
				const hasChooseText = feature.entries.some(
					(e) =>
						typeof e === 'string' &&
						/\bchoose\b/i.test(e),
				);
				const firstColLabel = entry.colLabels?.[0] || '';
				const isRandomTable = /\{@dice\s+/i.test(firstColLabel);

				if (hasChooseText && !isRandomTable && entry.colLabels?.length >= 2) {
					const tableOptions = this._resolveTableOptions(entry);
					if (tableOptions.length > 0) {
						choices.push({
							type: 'table',
							featureName: feature.name,
							level: feature.level,
							caption: entry.caption || feature.name,
							colLabels: entry.colLabels,
							count: 1,
							options: tableOptions,
						});
					}
				}
			}
		}

		return choices;
	}

	/**
	 * Resolve options entries — handles refSubclassFeature refs and inline entries.
	 * @private
	 */
	_resolveOptionsEntries(entries, parentFeature) {
		const options = [];

		for (const opt of entries) {
			if (opt.type === 'refSubclassFeature' && opt.subclassFeature) {
				// Parse ref string: "Name|Class|ClassSource|Subclass|SubclassSource|Level"
				const resolved = this._resolveSubclassFeatureRef(
					opt.subclassFeature,
				);
				if (resolved) {
					options.push(resolved);
				}
			} else if (opt.type === 'refClassFeature' && opt.classFeature) {
				const resolved = this._resolveClassFeatureRef(opt.classFeature);
				if (resolved) {
					options.push(resolved);
				}
			} else if (opt.type === 'entries' && opt.name) {
				// Inline named entry (e.g. The Third Eye options)
				options.push({
					value: opt.name,
					label: opt.name,
					entries: opt.entries || [],
					source: parentFeature.source,
				});
			}
		}

		return options;
	}

	/**
	 * Resolve a subclassFeature ref string into a named option.
	 * Format: "FeatureName|ClassName|ClassSource|SubclassShortName|SubclassSource|Level|FeatureSource?"
	 * @private
	 */
	_resolveSubclassFeatureRef(refString) {
		const parts = refString.split('|');
		if (parts.length < 4) return null;

		const featureName = parts[0];
		const className = parts[1];
		const classSource = parts[2] || 'PHB';
		const subclassShortName = parts[3];
		const subclassSource = parts[4] || '';
		const levelStr = parts[5];
		const featureSource = parts[6] || '';

		// Look up the actual feature data
		const level = parseInt(levelStr, 10) || 0;
		const features = (this._data?.subclassFeature || []).filter(
			(f) =>
				f.name === featureName &&
				f.className === className &&
				f.subclassShortName === subclassShortName &&
				f.level === level,
		);

		// Prefer matching source, fall back to first
		const feature =
			features.find(
				(f) =>
					f.source === (featureSource || subclassSource || classSource),
			) || features[0];

		return {
			value: featureName,
			label: featureName,
			entries: feature?.entries || [],
			source: feature?.source || featureSource || classSource,
		};
	}

	/**
	 * Resolve a classFeature ref string into a named option.
	 * @private
	 */
	_resolveClassFeatureRef(refString) {
		const parts = refString.split('|');
		if (parts.length < 2) return null;

		const featureName = parts[0];
		const className = parts[1];

		const features = (this._data?.classFeature || []).filter(
			(f) => f.name === featureName && f.className === className,
		);
		const feature = features[0];

		return {
			value: featureName,
			label: featureName,
			entries: feature?.entries || [],
			source: feature?.source || 'PHB',
		};
	}

	/**
	 * Convert a 5etools table entry into selectable options.
	 * Each row becomes an option; columns beyond the first are stored as metadata.
	 * @private
	 */
	_resolveTableOptions(tableEntry) {
		if (!tableEntry.rows || !tableEntry.colLabels) return [];

		const labels = tableEntry.colLabels;

		return tableEntry.rows.map((row) => {
			const value = this._stripTags(String(row[0] || ''));
			const metadata = {};
			for (let i = 1; i < labels.length; i++) {
				const colKey = labels[i].toLowerCase().replace(/\s+/g, '_');
				metadata[colKey] = this._stripTags(String(row[i] || ''));
			}
			return {
				value,
				label: value,
				metadata,
			};
		});
	}

	/**
	 * Strip 5etools {@tags} from a string, keeping the display text.
	 * @private
	 */
	_stripTags(text) {
		return text.replace(/\{@\w+\s+([^|}]+)[^}]*\}/g, '$1');
	}

	/**
	 * Get all nested feature choices for a given subclass up to a level.
	 * Scans every subclass feature's entries for options/table choice patterns.
	 *
	 * @param {string} className
	 * @param {string} subclassShortName
	 * @param {number} maxLevel
	 * @param {string} source
	 * @returns {Array<Object>} Array of choice descriptors with featureName, level, options, etc.
	 */
	getSubclassFeatureChoices(className, subclassShortName, maxLevel, source = 'PHB') {
		const features = this.getSubclassFeatures(
			className,
			subclassShortName,
			maxLevel,
			source,
		);

		const allChoices = [];
		for (const feature of features) {
			const featureChoices = this.getFeatureEntryChoices(feature);
			allChoices.push(...featureChoices);
		}

		return allChoices;
	}

	/**
	 * Get nested feature choices for a specific subclass at exactly one level.
	 */
	getSubclassFeatureChoicesAtLevel(className, subclassShortName, level, source = 'PHB') {
		return this.getSubclassFeatureChoices(
			className,
			subclassShortName,
			level,
			source,
		).filter((c) => c.level === level);
	}
}

// Create and export singleton instance
export const classService = new ClassService();
