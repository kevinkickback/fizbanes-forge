import { eventBus, EVENTS } from '../lib/EventBus.js';
import { classService } from './ClassService.js';
import { spellService } from './SpellService.js';

class SpellSelectionService {
	constructor() {
		this.loggerScope = 'SpellSelectionService';
	}

	initializeSpellcastingForClass(character, className, classLevel) {
		if (!character.spellcasting) {
			character.spellcasting = {
				classes: {},
				multiclass: { isCastingMulticlass: false, combinedSlots: {} },
				other: { spellsKnown: [], itemSpells: [] },
			};
		}

		// Get class info to determine spellcasting ability, cantrips, etc.
		const classInfo = this._getClassSpellcastingInfo(className);

		if (!classInfo) {
			console.warn(
				`[${this.loggerScope}]`,
				`Class ${className} is not a spellcaster`,
			);
			return null;
		}

		// Initialize spellcasting for this class
		character.spellcasting.classes[className] = {
			level: classLevel,
			spellsKnown: [],
			spellsPrepared: [],
			spellSlots: this.calculateSpellSlots(className, classLevel),
			cantripsKnown: this._getCantripsKnown(className, classLevel),
			spellcastingAbility: classInfo.spellcastingAbility,
			ritualCasting: classInfo.ritualCasting || false,
		};

		console.debug(`[${this.loggerScope}]`, 'Initialized spellcasting for', {
			className,
			classLevel,
		});

		return character.spellcasting.classes[className];
	}

	_getClassSpellcastingInfo(className) {
		const classData = classService.getClass(className);
		if (!classData || !classData.spellcastingAbility) {
			return null;
		}

		// Map 5etools ability abbreviations to full names
		const abilityMap = {
			str: 'strength',
			dex: 'dexterity',
			con: 'constitution',
			int: 'intelligence',
			wis: 'wisdom',
			cha: 'charisma',
		};

		const ability =
			abilityMap[classData.spellcastingAbility] ||
			classData.spellcastingAbility;

		return {
			spellcastingAbility: ability,
			ritualCasting: this._hasRitualCasting(className),
			knownType: classData.preparedSpells ? 'prepared' : 'known',
			isWarlock: classData.casterProgression === 'pact',
			casterProgression: classData.casterProgression,
		};
	}

	_hasRitualCasting(className) {
		// Classes with ritual casting: Bard, Cleric, Druid, Wizard
		const ritualClasses = ['Bard', 'Cleric', 'Druid', 'Wizard'];
		return ritualClasses.includes(className);
	}

	_getCantripsKnown(className, level) {
		const classData = classService.getClass(className);
		if (!classData || !classData.cantripProgression) {
			return 0;
		}

		// Level 0 means no levels yet, so no cantrips
		if (level <= 0) {
			return 0;
		}

		// cantripProgression is 0-indexed in 5etools (starts at level 1)
		const index = Math.max(
			0,
			Math.min(level - 1, classData.cantripProgression.length - 1),
		);
		return classData.cantripProgression[index] || 0;
	}

	/** Spells known for classes with "known" type (Bard, Sorcerer, Warlock, Ranger). 
	 * For Wizard, returns total spellbook size (not spells per level).
	 */
	_getSpellsKnownLimit(className, level) {
		const classData = classService.getClass(className);
		if (!classData) return 0;

		// Check for spellsKnownProgression (Bard, Sorcerer, Warlock, Ranger)
		if (classData.spellsKnownProgression) {
			const index = Math.max(
				0,
				Math.min(level - 1, classData.spellsKnownProgression.length - 1),
			);
			return classData.spellsKnownProgression[index] || 0;
		}

		// Check for spellsKnownProgressionFixed (Wizard - learns X spells per level)
		// For Wizard, calculate total spellbook size = 6 at level 1, then +2 per level
		if (classData.spellsKnownProgressionFixed) {
			if (level <= 0) return 0;

			// Sum up spells learned from level 1 to current level
			let totalSpells = 0;
			for (let i = 0; i < Math.min(level, classData.spellsKnownProgressionFixed.length); i++) {
				totalSpells += classData.spellsKnownProgressionFixed[i] || 0;
			}
			return totalSpells;
		}

		return 0;
	}

	/** Get spells learned at a specific level (for Wizard spellbook progression). */
	_getSpellsLearnedAtLevel(className, level) {
		const classData = classService.getClass(className);
		if (!classData?.spellsKnownProgressionFixed) return 0;

		if (level <= 0 || level > classData.spellsKnownProgressionFixed.length) {
			return 0;
		}

		return classData.spellsKnownProgressionFixed[level - 1] || 0;
	}

	calculateSpellSlots(className, level) {
		const classData = classService.getClass(className);
		if (!classData || !classData.casterProgression) {
			return {};
		}

		const progression = classData.casterProgression;
		let casterLevel = level;

		// Calculate effective caster level based on progression type
		if (progression === '1/2') {
			casterLevel = Math.floor(level / 2);
		} else if (progression === '1/3') {
			casterLevel = Math.floor(level / 3);
		} else if (progression === 'pact') {
			// Warlock uses pact magic - special progression
			return this._getPactMagicSlots(level);
		}

		// Use standard spell slot table for full/half/third casters
		return this._getStandardSpellSlots(casterLevel);
	}

	_getStandardSpellSlots(casterLevel) {
		// Standard D&D 5e spell slot progression table
		const standardSlots = [
			[],
			[2],
			[3],
			[4, 2],
			[4, 3],
			[4, 3, 2],
			[4, 3, 3],
			[4, 3, 3, 1],
			[4, 3, 3, 2],
			[4, 3, 3, 3, 1],
			[4, 3, 3, 3, 2],
			[4, 3, 3, 3, 2, 1],
			[4, 3, 3, 3, 2, 1],
			[4, 3, 3, 3, 2, 1, 1],
			[4, 3, 3, 3, 2, 1, 1],
			[4, 3, 3, 3, 2, 1, 1, 1],
			[4, 3, 3, 3, 2, 1, 1, 1],
			[4, 3, 3, 3, 3, 1, 1, 1, 1],
			[4, 3, 3, 3, 3, 2, 1, 1, 1],
			[4, 3, 3, 3, 3, 2, 2, 1, 1],
		];

		if (casterLevel < 1 || casterLevel >= standardSlots.length) {
			return {};
		}

		const levelSlots = standardSlots[casterLevel] || [];
		const result = {};

		for (let spellLevel = 1; spellLevel <= 9; spellLevel++) {
			if (levelSlots[spellLevel - 1]) {
				result[spellLevel] = {
					max: levelSlots[spellLevel - 1],
					current: levelSlots[spellLevel - 1],
				};
			}
		}

		return result;
	}

	_getPactMagicSlots(level) {
		// Warlock pact magic progression
		const pactSlots = [
			[],
			[1],
			[2],
			[2],
			[2],
			[2],
			[2],
			[2],
			[2],
			[2],
			[2],
			[3],
			[3],
			[3],
			[3],
			[3],
			[3],
			[4],
			[4],
			[4],
			[4],
		];

		const pactSlotLevels = [
			0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
		];

		if (level < 1 || level > 20) {
			return {};
		}

		const slotCount = pactSlots[level] || 0;
		const slotLevel = pactSlotLevels[level] || 1;

		if (slotCount === 0) return {};

		return {
			[slotLevel]: {
				max: slotCount,
				current: slotCount,
				isPactMagic: true, // Mark as pact magic for UI differentiation
			},
		};
	}

	addKnownSpell(character, className, spellData) {
		if (!character.spellcasting?.classes?.[className]) {
			console.warn(`[${this.loggerScope}]`, 'Class not initialized', {
				className,
			});
			return false;
		}

		const classSpellcasting = character.spellcasting.classes[className];

		// Check if spell already known
		if (
			classSpellcasting.spellsKnown.some(
				(s) =>
					s.name === spellData.name && s.source === (spellData.source || 'PHB'),
			)
		) {
			console.warn(
				`[${this.loggerScope}]`,
				'Spell already known',
				spellData.name,
			);
			return false;
		}

		// Store full spell object
		classSpellcasting.spellsKnown.push(spellData);

		console.debug(`[${this.loggerScope}]`, 'Added known spell', {
			className,
			spell: spellData.name,
		});

		eventBus.emit(EVENTS.SPELL_ADDED, character, className, spellData);
		return true;
	}

	removeKnownSpell(character, className, spellName) {
		if (!character.spellcasting?.classes?.[className]) {
			console.warn(`[${this.loggerScope}]`, 'Class not initialized', {
				className,
			});
			return false;
		}

		const classSpellcasting = character.spellcasting.classes[className];
		const index = classSpellcasting.spellsKnown.findIndex(
			(s) => s.name === spellName,
		);

		if (index === -1) {
			console.warn(`[${this.loggerScope}]`, 'Spell not known', {
				className,
				spellName,
			});
			return false;
		}

		const removed = classSpellcasting.spellsKnown.splice(index, 1)[0];

		// Also remove from prepared if applicable
		const preparedIndex = classSpellcasting.spellsPrepared.findIndex(
			(s) => s.name === spellName,
		);
		if (preparedIndex !== -1) {
			classSpellcasting.spellsPrepared.splice(preparedIndex, 1);
		}

		console.debug(`[${this.loggerScope}]`, 'Removed known spell', {
			className,
			spell: spellName,
		});

		eventBus.emit(EVENTS.SPELL_REMOVED, character, className, removed);
		return true;
	}

	/** Prepare a spell (for Cleric, Wizard, Druid, Paladin). */
	prepareSpell(character, className, spellName) {
		if (!character.spellcasting?.classes?.[className]) {
			console.warn(`[${this.loggerScope}]`, 'Class not initialized', {
				className,
			});
			return false;
		}

		const classSpellcasting = character.spellcasting.classes[className];

		// Must be a known spell
		const knownSpell = classSpellcasting.spellsKnown.find(
			(s) => s.name === spellName,
		);
		if (!knownSpell) {
			console.warn(`[${this.loggerScope}]`, 'Spell not known', {
				className,
				spellName,
			});
			return false;
		}

		// Check if already prepared
		if (classSpellcasting.spellsPrepared.some((s) => s.name === spellName)) {
			console.warn(`[${this.loggerScope}]`, 'Spell already prepared', {
				className,
				spellName,
			});
			return false;
		}

		// Check prepared limit
		const preparedLimit = this._getPreparedSpellLimit(
			character,
			className,
			classSpellcasting.level,
		);
		if (classSpellcasting.spellsPrepared.length >= preparedLimit) {
			console.warn(`[${this.loggerScope}]`, 'Prepared spell limit reached', {
				className,
				limit: preparedLimit,
			});
			return false;
		}

		classSpellcasting.spellsPrepared.push({ ...knownSpell });

		console.debug(`[${this.loggerScope}]`, 'Prepared spell', {
			className,
			spell: spellName,
		});

		eventBus.emit(EVENTS.SPELL_PREPARED, character, className, knownSpell);
		return true;
	}

	unprepareSpell(character, className, spellName) {
		if (!character.spellcasting?.classes?.[className]) {
			console.warn(`[${this.loggerScope}]`, 'Class not initialized', {
				className,
			});
			return false;
		}

		const classSpellcasting = character.spellcasting.classes[className];
		const index = classSpellcasting.spellsPrepared.findIndex(
			(s) => s.name === spellName,
		);

		if (index === -1) {
			console.warn(`[${this.loggerScope}]`, 'Spell not prepared', {
				className,
				spellName,
			});
			return false;
		}

		const removed = classSpellcasting.spellsPrepared.splice(index, 1)[0];

		console.debug(`[${this.loggerScope}]`, 'Unprepared spell', {
			className,
			spell: spellName,
		});

		eventBus.emit(EVENTS.SPELL_UNPREPARED, character, className, removed);
		return true;
	}

	useSpellSlot(character, className, spellLevel) {
		if (!character.spellcasting?.classes?.[className]) {
			console.warn(`[${this.loggerScope}]`, 'Class not initialized', {
				className,
			});
			return false;
		}

		const slot =
			character.spellcasting.classes[className].spellSlots[spellLevel];

		if (!slot || slot.current <= 0) {
			console.warn(`[${this.loggerScope}]`, 'No spell slots available', {
				className,
				spellLevel,
			});
			return false;
		}

		slot.current--;

		console.debug(`[${this.loggerScope}]`, 'Used spell slot', {
			className,
			spellLevel,
			remaining: slot.current,
		});

		eventBus.emit(EVENTS.SPELL_SLOTS_USED, character, className, spellLevel);
		return true;
	}

	/** Restore spell slots (on long rest). */
	restoreSpellSlots(character, className = null) {
		if (!character.spellcasting?.classes) {
			console.warn(`[${this.loggerScope}]`, 'No spellcasting initialized');
			return false;
		}

		const classesToRestore = className
			? [className]
			: Object.keys(character.spellcasting.classes);

		for (const cls of classesToRestore) {
			const classSpellcasting = character.spellcasting.classes[cls];
			if (classSpellcasting?.spellSlots) {
				for (const level in classSpellcasting.spellSlots) {
					classSpellcasting.spellSlots[level].current =
						classSpellcasting.spellSlots[level].max;
				}
			}
		}

		console.debug(`[${this.loggerScope}]`, 'Restored spell slots', {
			classNames: classesToRestore,
		});

		eventBus.emit(EVENTS.SPELL_SLOTS_RESTORED, character, classesToRestore);
		return true;
	}

	/** Prepared spell limit: Level + spellcasting ability modifier. */
	_getPreparedSpellLimit(character, className, classLevel) {
		const classInfo = this._getClassSpellcastingInfo(className);
		if (!classInfo) return 0;

		const abilityMod = character.getAbilityModifier(
			classInfo.spellcastingAbility,
		);
		return Math.max(1, classLevel + abilityMod);
	}

	getAvailableSpellsForClass(className) {
		const allSpells = spellService.getAllSpells();

		// Filter by class availability
		return allSpells.filter((spell) => {
			if (!spell.classes) return false;
			const classes = Array.isArray(spell.classes)
				? spell.classes
				: [spell.classes];
			return classes.includes(className);
		});
	}

	/** Get spell limit info (known vs prepared) for a class. 
	 * For prepared casters (Wizard, Cleric, Druid, Paladin), returns both spellbook/known and prepared limits.
	 */
	getSpellLimitInfo(character, className, classLevel) {
		const classInfo = this._getClassSpellcastingInfo(className);
		if (!classInfo) return { type: null, limit: 0, current: 0 };

		const classSpellcasting = character.spellcasting?.classes?.[className];
		if (!classSpellcasting) return { type: null, limit: 0, current: 0 };

		if (classInfo.knownType === 'known') {
			// Classes with fixed spells known (Bard, Sorcerer, Warlock, Ranger)
			return {
				type: 'known',
				limit: this._getSpellsKnownLimit(className, classLevel),
				current: classSpellcasting.spellsKnown.length,
			};
		} else {
			// Classes that prepare spells (Wizard, Cleric, Druid, Paladin)
			return {
				type: 'prepared',
				spellbookLimit: this._getSpellsKnownLimit(className, classLevel), // Total spells known/in spellbook
				spellbookCurrent: classSpellcasting.spellsKnown.length,
				preparedLimit: this._getPreparedSpellLimit(character, className, classLevel), // Prepared from spellbook
				preparedCurrent: classSpellcasting.spellsPrepared.length,
				// For backwards compatibility
				limit: this._getPreparedSpellLimit(character, className, classLevel),
				current: classSpellcasting.spellsPrepared.length,
			};
		}
	}
}

// Export singleton
export const spellSelectionService = new SpellSelectionService();
