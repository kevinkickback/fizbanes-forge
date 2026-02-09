import { eventBus, EVENTS } from '../lib/EventBus.js';
import {
	addClassLevelArgsSchema,
	removeClassLevelArgsSchema,
	validateInput,
} from '../lib/ValidationSchemas.js';
import { classService } from './ClassService.js';
import { sourceService } from './SourceService.js';
import { spellSelectionService } from './SpellSelectionService.js';

class LevelUpService {
	constructor() {
		this.loggerScope = 'LevelUpService';
	}

	initializeProgression(character) {
		if (!character.progression) {
			character.progression = {
				classes: [],
				experiencePoints: 0,
				levelUps: [],
			};
		}
		// Note: progression.classes is the single source of truth
		// No legacy character.class field to sync
	}

	/** Total level from progression.classes[]. */
	getTotalLevel(character) {
		if (
			!character?.progression?.classes ||
			character.progression.classes.length === 0
		) {
			return 1;
		}
		return character.progression.classes.reduce(
			(sum, c) => sum + (c.levels || 0),
			0,
		);
	}

	addClassLevel(character, className, level = 1, source = 'PHB') {
		const validated = validateInput(
			addClassLevelArgsSchema,
			{ character, className, level, source },
			'Invalid parameters for addClassLevel',
		);

		const { character: char, className: cls, level: lvl, source: src } = validated;

		if (!char.progression) {
			this.initializeProgression(char);
		}

		// Check if class already exists
		let classEntry = char.progression.classes.find(
			(c) => c.name === cls,
		);

		if (classEntry) {
			classEntry.levels = lvl;
			// Update source if provided and currently missing
			if (src && !classEntry.source) {
				classEntry.source = src;
			}
			return classEntry;
		}

		// Create new class entry
		classEntry = {
			name: cls,
			source: src,
			levels: lvl,
			hitPoints: [],
			features: [],
			spellSlots: {},
		};

		char.progression.classes.push(classEntry);

		// Initialize spellcasting for this class if applicable
		spellSelectionService.initializeSpellcastingForClass(
			char,
			cls,
			lvl,
		);

		eventBus.emit(EVENTS.MULTICLASS_ADDED, char, classEntry);
		return classEntry;
	}

	removeClassLevel(character, className) {
		const validated = validateInput(
			removeClassLevelArgsSchema,
			{ character, className },
			'Invalid parameters for removeClassLevel',
		);

		const { character: char, className: cls } = validated;

		if (!char.progression) return false;

		const index = char.progression.classes.findIndex(
			(c) => c.name === cls,
		);

		if (index === -1) {
			console.warn(`[${this.loggerScope}]`, 'Class not found', { className: cls });
			return false;
		}

		const removed = char.progression.classes.splice(index, 1)[0];

		eventBus.emit(EVENTS.MULTICLASS_REMOVED, char, removed);
		return true;
	}

	_getHitDiceForClass(className) {
		return classService.getHitDie(className);
	}

	_getASILevelsForClass(className) {
		const classData = classService.getClass(className);
		if (!classData?.classFeatures) {
			// Fallback to standard ASI levels if no class data found
			return [4, 8, 12, 16, 19];
		}

		const asiLevels = new Set();
		const features = classData.classFeatures;

		// Parse classFeatures array looking for "Ability Score Improvement" features
		for (const feature of features) {
			let featureName = '';
			let featureLevel = null;

			// Feature can be a string like "Ability Score Improvement|Fighter||4"
			// or an object with "classFeature" property
			if (typeof feature === 'string') {
				const parts = feature.split('|');
				featureName = parts[0];
				// Last non-empty part is typically the level
				for (let i = parts.length - 1; i >= 0; i--) {
					if (parts[i] && Number.isNaN(Number(parts[i])) === false) {
						featureLevel = parseInt(parts[i], 10);
						break;
					}
				}
			} else if (feature && typeof feature === 'object') {
				// Skip object-based features for now (usually subclass features)
				continue;
			}

			// Check if this is an ASI feature
			if (
				featureName.includes('Ability Score Improvement') &&
				featureLevel !== null
			) {
				asiLevels.add(featureLevel);
			}
		}

		// If we found ASI levels in the JSON, return them sorted
		if (asiLevels.size > 0) {
			return Array.from(asiLevels).sort((a, b) => a - b);
		}

		// Fallback to standard ASI levels
		return [4, 8, 12, 16, 19];
	}

	recordLevelUp(character, fromLevel, toLevel, changes = {}) {
		if (!character.progression) {
			character.progression = {
				classes: [],
				experiencePoints: 0,
				levelUps: [],
			};
		}

		const levelUpRecord = {
			fromLevel,
			toLevel,
			appliedFeats: changes.appliedFeats || [],
			appliedFeatures: changes.appliedFeatures || [],
			changedAbilities: changes.changedAbilities || {},
			timestamp: new Date().toISOString(),
		};

		character.progression.levelUps.push(levelUpRecord);
	}

	updateSpellSlots(character) {
		if (!character.spellcasting || !character.progression) return;

		for (const classEntry of character.progression.classes) {
			if (character.spellcasting.classes[classEntry.name]) {
				const newSlots = spellSelectionService.calculateSpellSlots(
					classEntry.name,
					classEntry.level,
				);

				// Preserve current slot usage, update max
				const oldSlots =
					character.spellcasting.classes[classEntry.name].spellSlots;
				for (const level in newSlots) {
					if (oldSlots[level]) {
						newSlots[level].current = oldSlots[level].current;
					}
				}

				character.spellcasting.classes[classEntry.name].spellSlots = newSlots;
			}
		}

		console.debug(`[${this.loggerScope}]`, 'Updated spell slots');
	}

	calculateMaxHitPoints(character) {
		if (!character.progression || character.progression.classes.length === 0) {
			// Fallback: use level 1 class default
			const conMod = character.getAbilityModifier('constitution');
			return 8 + conMod; // Assuming d8 hit die default
		}

		let totalHP = 0;
		const conMod = character.getAbilityModifier('constitution');

		for (const classEntry of character.progression.classes) {
			// First level: full hit die
			const hitDiceValue = this._parseHitDice(classEntry.hitDice);
			totalHP += hitDiceValue;

			// Additional levels: average or rolled
			for (let i = 1; i < classEntry.level; i++) {
				const hpThisLevel =
					classEntry.hitPoints[i] || Math.ceil(hitDiceValue / 2);
				totalHP += hpThisLevel;
			}
		}

		// Apply CON modifier per level (minimum 1 per level)
		const totalLevel = this.getTotalLevel(character);
		totalHP += Math.max(totalLevel, conMod * totalLevel);

		return Math.max(1, totalHP);
	}

	_parseHitDice(hitDice) {
		const match = hitDice?.match(/d(\d+)/);
		return match ? parseInt(match[1], 10) : 8;
	}

	_mapAbilityAbbreviation(abbr) {
		const abilityMap = {
			str: 'strength',
			dex: 'dexterity',
			con: 'constitution',
			int: 'intelligence',
			wis: 'wisdom',
			cha: 'charisma',
		};
		return abilityMap[abbr] || abbr;
	}

	checkMulticlassRequirements(character, className) {
		const classData = classService.getClass(className);
		if (!classData?.multiclassing?.requirements) {
			console.warn(
				`[${this.loggerScope}]`,
				`No multiclass requirements for class ${className}`,
			);
			return true;
		}

		const requirements = classData.multiclassing.requirements;

		const getScore = (ability) => {
			if (typeof character.getAbilityScore === 'function') {
				return character.getAbilityScore(ability);
			}
			const raw = character.abilityScores?.[ability];
			return typeof raw === 'number' ? raw : 0;
		};

		// Handle OR requirements (e.g., Fighter: Str 13 OR Dex 13)
		if (requirements.or && Array.isArray(requirements.or)) {
			// Flatten all OR requirements into a single list of alternatives
			for (const orGroup of requirements.or) {
				for (const [abbr, minScore] of Object.entries(orGroup)) {
					const fullName = this._mapAbilityAbbreviation(abbr);
					const score = getScore(fullName);
					if (score >= minScore) {
						return true; // Need ANY one requirement
					}
				}
			}
			return false;
		}

		// Handle regular AND requirements
		for (const [abbr, minScore] of Object.entries(requirements)) {
			const fullName = this._mapAbilityAbbreviation(abbr);
			const score = getScore(fullName);
			if (score < minScore) {
				return false;
			}
		}

		return true;
	}

	getMulticlassOptions(character, ignoreRequirements = false) {
		const allClasses = classService.getAllClasses();
		const existingClasses =
			character.progression?.classes?.map((c) => c.name) || [];

		const uniqueNames = new Set();
		const filtered = [];

		for (const cls of allClasses) {
			if (cls.isSidekick) continue;
			if (!sourceService.isSourceAllowed(cls.source)) continue;
			if (existingClasses.includes(cls.name)) continue;
			if (uniqueNames.has(cls.name)) continue;

			uniqueNames.add(cls.name);
			filtered.push(cls.name);
		}

		return filtered
			.sort()
			.map((cls) => {
				const classData = classService.getClass(cls);
				const meetsRequirements =
					ignoreRequirements ||
					this.checkMulticlassRequirements(character, cls);

				let requirementText = '';
				if (classData?.multiclassing?.requirements) {
					const reqs = classData.multiclassing.requirements;

					if (reqs.or) {
						// OR requirements: flatten and join with 'or'
						const alternatives = [];
						for (const group of reqs.or) {
							for (const [abbr, score] of Object.entries(group)) {
								alternatives.push(`${abbr.toUpperCase()} ${score}`);
							}
						}
						requirementText = alternatives.join(' or ');
					} else {
						// AND requirements
						requirementText = Object.entries(reqs)
							.map(([abbr, score]) => `${abbr.toUpperCase()} ${score}`)
							.join(', ');
					}
				}

				return {
					name: cls,
					meetsRequirements,
					requirementText,
				};
			});
	}

	/** Combine spell slots per D&D 5e multiclass rules. */
	calculateMulticlassSpellSlots(character) {
		if (
			!character.progression?.classes ||
			character.progression.classes.length <= 1
		) {
			return {}; // Not multiclassing
		}

		let totalCasterLevel = 0;
		const warlockLevels = [];

		// Calculate combined caster level per D&D 5e rules
		for (const classEntry of character.progression.classes) {
			const classData = classService.getClass(classEntry.name);
			if (!classData || !classData.casterProgression) {
				continue; // Non-spellcaster
			}

			const levels = classEntry.levels || 0;

			const progression = classData.casterProgression;

			if (progression === 'pact') {
				// Warlock pact magic doesn't combine - track separately
				warlockLevels.push(levels);
			} else if (progression === 'full') {
				// Full casters contribute full level
				totalCasterLevel += levels;
			} else if (progression === '1/2') {
				// Half casters contribute half level (rounded down)
				totalCasterLevel += Math.floor(levels / 2);
			} else if (progression === '1/3') {
				// Third casters contribute third level (rounded down)
				totalCasterLevel += Math.floor(levels / 3);
			}
		}

		// Get spell slots based on total caster level
		const combinedSlots =
			spellSelectionService._getStandardSpellSlots(totalCasterLevel);

		// Note: Warlock pact magic slots remain separate and are tracked per-class
		// They don't combine with standard spellcasting spell slots

		return combinedSlots;
	}
}

export const levelUpService = new LevelUpService();
