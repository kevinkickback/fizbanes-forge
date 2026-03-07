// Pure data query methods for class choice logic (no DOM interaction)

import { CharacterManager } from '../../../app/CharacterManager.js';
import { levelUpService } from '../../../services/LevelUpService.js';
import { optionalFeatureService } from '../../../services/OptionalFeatureService.js';
import { sourceService } from '../../../services/SourceService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';

export class ClassChoiceQueryService {
	constructor(classService) {
		this._classService = classService;
	}

	getNoChoiceFeaturesAtLevel(className, level, classData) {
		const classSource = classData?.source || 'PHB';
		const classFeatureRefs = classData?.classFeatures || [];

		const choiceFeatureNames = new Set();

		const asiLevels = levelUpService._getASILevelsForClass(className);
		if (asiLevels.includes(level)) {
			choiceFeatureNames.add('Ability Score Improvement');
		}

		for (const ref of classFeatureRefs) {
			if (typeof ref === 'object' && ref.gainSubclassFeature) {
				const parts = ref.classFeature.split('|');
				const featureLevel = parseInt(parts[parts.length - 1], 10);
				if (featureLevel === level) {
					choiceFeatureNames.add(parts[0]);
				}
			}
		}

		const progressions = classData?.optionalfeatureProgression || [];
		for (const progression of progressions) {
			const count = this._classService.getCountAtLevel(
				progression.progression,
				level,
			);
			const prevCount =
				level > 1
					? this._classService.getCountAtLevel(
							progression.progression,
							level - 1,
						)
					: 0;
			if (count - prevCount > 0) {
				choiceFeatureNames.add(progression.name);
			}
		}

		const allFeaturesUpToLevel = this._classService.getClassFeatures(
			className,
			level,
			classSource,
		);
		const featuresAtLevel = allFeaturesUpToLevel.filter(
			(f) => f.level === level,
		);

		const passiveFeatures = featuresAtLevel.filter((f) => {
			if (choiceFeatureNames.has(f.name)) return false;
			if (
				f.entries?.some(
					(e) =>
						typeof e === 'object' &&
						(e.type === 'options' || e.type === 'refOptionalfeature'),
				)
			) {
				return false;
			}
			return true;
		});

		return passiveFeatures.map((f) => ({
			name: f.name,
			entries: f.entries,
			level: f.level,
			source: f.source,
			page: f.page,
			className: f.className,
		}));
	}

	async getChoicesAtLevel(className, level, subclassData = null) {
		const choices = [];
		const character = CharacterManager.getCurrentCharacter();

		const classData = this._classService.getClass(className);
		if (!classData) return choices;

		const subclassLevel = this._classService.getSubclassLevel(classData);
		const effectiveSubclassLevel = subclassLevel !== null ? subclassLevel : 3;

		if (level === effectiveSubclassLevel) {
			const availableSubclasses = this._classService
				.getSubclasses(className, classData.source)
				.filter((sc) => {
					const subclassSource =
						sc.subclassSource || sc.source || sc.classSource;
					return sourceService.isSourceAllowed(subclassSource);
				})
				.map((sc) => {
					let entries = [];
					if (sc.subclassFeatures && sc.subclassFeatures.length > 0) {
						const firstFeatureRef = sc.subclassFeatures[0];
						if (typeof firstFeatureRef === 'string') {
							const features = this._classService.getSubclassFeatures(
								sc.className,
								sc.shortName,
								1,
								sc.source || 'PHB',
							);
							const firstFeature = features.find((f) => f.level === 1);
							entries = firstFeature?.entries || [];
						} else {
							entries = firstFeatureRef?.entries || [];
						}
					}

					return {
						id: `${sc.name}_${sc.subclassSource || sc.source || sc.classSource}`,
						name: sc.name,
						source: sc.subclassSource || sc.source || sc.classSource,
						description: this.getSubclassDescription(sc),
						entries,
						shortName: sc.shortName,
					};
				});

			if (availableSubclasses.length > 0) {
				choices.push({
					id: `${className.toLowerCase()}_subclass_${level}`,
					name: 'Subclass Selection',
					type: 'subclass',
					options: availableSubclasses,
					required: true,
					count: 1,
					level,
				});
			}
		}

		if (subclassData) {
			const progressionClass = character.progression?.classes?.find(
				(c) => c.name === className,
			);
			const featureChoiceDefs = this._getSubclassFeatureChoicesAtLevel(
				className,
				subclassData.shortName,
				level,
				progressionClass?.source,
			);

			for (const fc of featureChoiceDefs) {
				const currentChoice = progressionClass?.subclassChoices?.[fc.choiceKey];

				choices.push({
					id: `${className.toLowerCase()}_${fc.choiceKey}_${level}`,
					name: fc.label,
					type: 'subclass-feature-choice',
					level,
					choiceKey: fc.choiceKey,
					choiceType: fc.choiceType,
					options: fc.options,
					colLabels: fc.colLabels,
					icon: fc.icon || 'fas fa-star',
					currentValue: currentChoice?.value || null,
					featureChoiceDefinition: fc,
				});
			}
		}

		const progressions = classData.optionalfeatureProgression || [];
		for (const progression of progressions) {
			const count = this._classService.getCountAtLevel(
				progression.progression,
				level,
			);
			const prevCount =
				level > 1
					? this._classService.getCountAtLevel(
							progression.progression,
							level - 1,
						)
					: 0;
			const newCount = count - prevCount;

			if (newCount > 0) {
				const featureTypes = progression.featureType || [];
				const options = optionalFeatureService
					.getFeaturesByType(featureTypes)
					.filter((opt) => sourceService.isSourceAllowed(opt.source))
					.map((opt) => ({
						id: `${opt.name}_${opt.source}`,
						name: opt.name,
						source: opt.source,
						description: this.getFeatureDescription(opt),
						entries: opt.entries,
					}));

				if (options.length > 0) {
					choices.push({
						id: `${className.toLowerCase()}_${progression.name.toLowerCase().replace(/\s+/g, '_')}_${level}`,
						name: progression.name,
						type: this._classService.mapFeatureType(featureTypes[0]),
						options,
						required: true,
						count: newCount,
						level,
					});
				}
			}
		}

		if (subclassData?.optionalfeatureProgression) {
			for (const progression of subclassData.optionalfeatureProgression) {
				const count = this._classService.getCountAtLevel(
					progression.progression,
					level,
				);
				const prevCount =
					level > 1
						? this._classService.getCountAtLevel(
								progression.progression,
								level - 1,
							)
						: 0;
				const newCount = count - prevCount;

				if (newCount > 0) {
					const featureTypes = progression.featureType || [];
					const options = optionalFeatureService
						.getFeaturesByType(featureTypes)
						.filter((opt) => sourceService.isSourceAllowed(opt.source))
						.map((opt) => ({
							id: `${opt.name}_${opt.source}`,
							name: opt.name,
							source: opt.source,
							description: this.getFeatureDescription(opt),
							entries: opt.entries,
						}));

					if (options.length > 0) {
						choices.push({
							id: `${className.toLowerCase()}_${subclassData.shortName.toLowerCase()}_${progression.name.toLowerCase().replace(/\s+/g, '_')}_${level}`,
							name: progression.name,
							type: this._classService.mapFeatureType(featureTypes[0]),
							options,
							required: true,
							count: newCount,
							level,
						});
					}
				}
			}
		}

		if (character && classData?.spellcastingAbility) {
			const progressionClass = character.progression?.classes?.find(
				(c) => c.name === className,
			);
			const classLevel = progressionClass?.levels || 0;

			const spellChoices = this.getSpellChoicesForLevels(className, classLevel);

			for (const spellChoice of spellChoices) {
				if (
					spellChoice.level === level &&
					(spellChoice.cantrips > 0 || spellChoice.spells > 0)
				) {
					choices.push({
						id: `${className.toLowerCase()}_spell_selection_${spellChoice.level}`,
						name: 'Spell Selection',
						type: 'spell',
						required: true,
						count: spellChoice.cantrips + spellChoice.spells,
						level: spellChoice.level,
						spellData: spellChoice,
					});
				}
			}
		}

		const asiLevels = levelUpService._getASILevelsForClass(className);
		if (asiLevels.includes(level)) {
			const levelUps = character.progression?.levelUps || [];
			const asiUsed = levelUps.some((lu) => {
				const isThisLevel = lu.toLevel === level;
				const hasChanges =
					(lu.changedAbilities &&
						Object.keys(lu.changedAbilities).length > 0) ||
					(lu.appliedFeats && lu.appliedFeats.length > 0);
				return isThisLevel && hasChanges;
			});

			choices.push({
				id: `${className.toLowerCase()}_asi_${level}`,
				name: 'Ability Score Improvement',
				type: 'asi',
				required: true,
				count: 1,
				level,
				asiUsed,
			});
		}

		choices.sort((a, b) => a.level - b.level);

		return choices;
	}

	getFeatureDescription(feature) {
		if (!feature.entries) return '';
		const firstEntry = feature.entries.find((e) => typeof e === 'string');
		if (firstEntry) {
			return `${firstEntry.replace(/\{@[^}]+\}/g, '').substring(0, 150)}...`;
		}
		return '';
	}

	getSubclassDescription(subclass) {
		if (!subclass.subclassFeatures || subclass.subclassFeatures.length === 0)
			return '';

		const firstFeatureRef = subclass.subclassFeatures[0];
		let firstFeature = firstFeatureRef;

		if (typeof firstFeatureRef === 'string') {
			const features = this._classService.getSubclassFeatures(
				subclass.className,
				subclass.shortName,
				1,
				subclass.source || 'PHB',
			);
			firstFeature = features.find((f) => f.level === 1);
		}

		if (firstFeature?.entries) {
			const firstEntry = firstFeature.entries.find(
				(e) => typeof e === 'string',
			);
			if (firstEntry) {
				return `${firstEntry.replace(/\{@[^}]+\}/g, '').substring(0, 150)}...`;
			}
		}
		return '';
	}

	getSpellChoicesForLevels(className, classLevel) {
		const classData = this._classService.getClass(className);
		if (!classData) return [];

		const choices = [];

		for (let level = 1; level <= classLevel; level++) {
			const cantripsAtLevel = spellSelectionService.getCantripsKnown(
				className,
				level,
			);
			const cantripsAtPrevLevel =
				level > 1
					? spellSelectionService.getCantripsKnown(className, level - 1)
					: 0;
			const newCantrips = cantripsAtLevel - cantripsAtPrevLevel;

			let newSpells = 0;

			if (classData.spellsKnownProgressionFixed) {
				const index = Math.max(
					0,
					Math.min(level - 1, classData.spellsKnownProgressionFixed.length - 1),
				);
				newSpells = classData.spellsKnownProgressionFixed[index] || 0;
			} else if (classData.spellsKnownProgression) {
				const spellsAtLevel = spellSelectionService.getSpellsKnownLimit(
					className,
					level,
				);
				const spellsAtPrevLevel =
					level > 1
						? spellSelectionService.getSpellsKnownLimit(className, level - 1)
						: 0;
				newSpells = spellsAtLevel - spellsAtPrevLevel;
			}

			if (newCantrips > 0 || newSpells > 0) {
				choices.push({
					level,
					cantrips: newCantrips,
					spells: newSpells,
					maxSpellLevel: this._classService.getMaxSpellLevel(className, level),
				});
			}
		}

		return choices;
	}

	_toChoiceKey(featureName) {
		return featureName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_|_$/g, '');
	}

	_toChoiceDefinition(raw) {
		const choiceKey = this._toChoiceKey(raw.featureName);

		const options = raw.options.map((opt) => ({
			value: opt.value,
			label: opt.label || opt.value,
			entries: opt.entries || [],
			source: opt.source || '',
			...(opt.metadata || {}),
		}));

		return {
			featureName: raw.featureName,
			level: raw.level,
			label: raw.caption || raw.featureName,
			choiceKey,
			choiceType: raw.type,
			count: raw.count || 1,
			colLabels: raw.colLabels || null,
			icon: 'fas fa-list',
			options,
		};
	}

	_resolveSubclassSource(className, subclassShortName) {
		try {
			const sc = this._classService.getSubclass(className, subclassShortName);
			return sc?.subclassSource || sc?.source || sc?.classSource || 'PHB';
		} catch {
			return 'PHB';
		}
	}

	getSubclassFeatureChoices(
		className,
		subclassShortName,
		maxLevel = 20,
		source,
	) {
		const resolvedSource =
			source || this._resolveSubclassSource(className, subclassShortName);
		const raw = this._classService.getSubclassFeatureChoices(
			className,
			subclassShortName,
			maxLevel,
			resolvedSource,
		);
		return raw.map((r) => this._toChoiceDefinition(r));
	}

	_getSubclassFeatureChoicesAtLevel(
		className,
		subclassShortName,
		level,
		source,
	) {
		return this.getSubclassFeatureChoices(
			className,
			subclassShortName,
			level,
			source,
		).filter((c) => c.level === level);
	}

	formatChoiceOptionLabel(opt, choice) {
		if (choice.choiceType === 'table' && choice.colLabels?.length >= 2) {
			const extras = choice.colLabels
				.slice(1)
				.map((col) => {
					const key = col.toLowerCase().replace(/\s+/g, '_');
					return opt[key] || '';
				})
				.filter(Boolean);
			if (extras.length > 0) {
				return `${opt.label} \u2014 ${extras.join(', ')}`;
			}
		}
		return opt.label;
	}
}
