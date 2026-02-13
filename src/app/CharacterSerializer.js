// Character serialization and deserialization utilities

import { Character } from './Character.js';

/**
 * Convert a Map to a plain object, handling Set values
 * @param {Map} map - The map to convert
 * @returns {Object} Plain object representation
 */
function mapToObject(map) {
	if (!map || typeof map !== 'object') return {};

	try {
		return Object.fromEntries(
			Array.from(map.entries()).map(([key, value]) => {
				// Convert Set values to arrays
				if (value instanceof Set) {
					return [key, Array.from(value)];
				}
				return [key, value];
			}),
		);
	} catch {
		return {}; // Return empty object on error
	}
}

/**
 * Safely convert various types to arrays
 * @param {*} arr - Value to convert
 * @returns {Array} Array representation
 */
function safeArray(arr) {
	if (!arr) return [];
	if (Array.isArray(arr)) return [...arr];
	if (arr instanceof Set) return Array.from(arr);
	return [];
}

/**
 * Serialize complex proficiency structure (skills, languages, tools)
 * @param {Object} optionalProficiencies - The character's optional proficiencies
 * @param {string} type - Proficiency type (skills, languages, tools)
 * @returns {Object} Serialized proficiency data
 */
function serializeComplexProficiency(optionalProficiencies, type) {
	if (!optionalProficiencies || !optionalProficiencies[type]) {
		return {
			allowed: 0,
			options: [],
			selected: [],
			race: { allowed: 0, options: [], selected: [] },
			class: { allowed: 0, options: [], selected: [] },
			background: { allowed: 0, options: [], selected: [] },
		};
	}

	const result = {
		allowed: optionalProficiencies[type].allowed || 0,
		options: safeArray(optionalProficiencies[type].options),
		selected: safeArray(optionalProficiencies[type].selected),
	};

	for (const source of ['race', 'class', 'background']) {
		if (optionalProficiencies[type][source]) {
			result[source] = {
				allowed: optionalProficiencies[type][source].allowed || 0,
				options: safeArray(optionalProficiencies[type][source].options),
				selected: safeArray(optionalProficiencies[type][source].selected),
			};
		} else {
			// Default empty structure
			result[source] = { allowed: 0, options: [], selected: [] };
		}
	}

	return result;
}

/**
 * Serialize a Character instance to a plain JSON-serializable object
 * @param {Character} character - The character to serialize
 * @returns {Object} Plain object ready for JSON.stringify
 */
export function serialize(character) {
	if (!character) return null;

	const serializedData = {
		id: character.id,
		name: character.name,
		portrait: character.portrait || '',
		allowedSources: Array.from(character.allowedSources || []),
		playerName: character.playerName,
		level: character.level,
		createdAt: character.createdAt,
		lastModified: new Date().toISOString(),
		height: character.height || '',
		weight: character.weight || '',
		gender: character.gender || '',
		age: character.age || '',
		skinColor: character.skinColor || '',
		eyeColor: character.eyeColor || '',
		hairColor: character.hairColor || '',
		alignment: character.alignment || '',
		deity: character.deity || '',
		additionalFeatures: character.additionalFeatures || '',
		backstory: character.backstory || '',
		alliesAndOrganizations: character.alliesAndOrganizations || {
			selectedAlly: '',
			customNotes: '',
		},

		abilityScores: { ...character.abilityScores },
		abilityBonuses: { ...character.abilityBonuses },

		race: character.race
			? {
				name: character.race.name || '',
				source: character.race.source || '',
				subrace: character.race.subrace || '',
				abilityChoices: Array.isArray(character.race.abilityChoices)
					? character.race.abilityChoices.map((choice) => ({ ...choice }))
					: [],
				abilityBonuses: character.race.abilityBonuses
					? { ...character.race.abilityBonuses }
					: undefined,
			}
			: { name: '', source: '', subrace: '', abilityChoices: [] },
		background: character.background
			? typeof character.background === 'object'
				? { ...character.background }
				: { name: character.background }
			: {},

		size: character.size || 'Medium',
		speed: character.speed
			? { ...character.speed }
			: { walk: 30, fly: 0, swim: 0, climb: 0, burrow: 0 },

		features: {
			darkvision: character.features?.darkvision || 0,
			resistances: Array.from(character.features?.resistances || []),
			traits: mapToObject(character.features?.traits),
		},

		proficiencies: {
			armor: safeArray(character.proficiencies?.armor),
			weapons: safeArray(character.proficiencies?.weapons),
			tools: safeArray(character.proficiencies?.tools),
			skills: safeArray(character.proficiencies?.skills),
			languages: safeArray(character.proficiencies?.languages),
			savingThrows: safeArray(character.proficiencies?.savingThrows),
		},

		proficiencySources: {
			armor: mapToObject(character.proficiencySources?.armor),
			weapons: mapToObject(character.proficiencySources?.weapons),
			tools: mapToObject(character.proficiencySources?.tools),
			skills: mapToObject(character.proficiencySources?.skills),
			languages: mapToObject(character.proficiencySources?.languages),
			savingThrows: mapToObject(character.proficiencySources?.savingThrows),
		},

		feats: Array.isArray(character.feats)
			? character.feats.map((feat) => ({
				name: feat?.name || '',
				source: feat?.source || 'Unknown',
			}))
			: [],
		featSources: mapToObject(character.featSources),
	};

	// Serialize optional proficiencies
	try {
		if (character.optionalProficiencies) {
			serializedData.optionalProficiencies = {
				// Simple types
				armor: character.optionalProficiencies.armor
					? {
						allowed: character.optionalProficiencies.armor.allowed || 0,
						selected: safeArray(
							character.optionalProficiencies.armor.selected,
						),
					}
					: { allowed: 0, selected: [] },

				weapons: character.optionalProficiencies.weapons
					? {
						allowed: character.optionalProficiencies.weapons.allowed || 0,
						selected: safeArray(
							character.optionalProficiencies.weapons.selected,
						),
					}
					: { allowed: 0, selected: [] },

				savingThrows: character.optionalProficiencies.savingThrows
					? {
						allowed:
							character.optionalProficiencies.savingThrows.allowed || 0,
						selected: safeArray(
							character.optionalProficiencies.savingThrows.selected,
						),
					}
					: { allowed: 0, selected: [] },

				// Complex types with source-specific details
				skills: serializeComplexProficiency(
					character.optionalProficiencies,
					'skills',
				),
				languages: serializeComplexProficiency(
					character.optionalProficiencies,
					'languages',
				),
				tools: serializeComplexProficiency(
					character.optionalProficiencies,
					'tools',
				),
			};
		}
	} catch {
		serializedData.optionalProficiencies = {
			armor: { allowed: 0, selected: [] },
			weapons: { allowed: 0, selected: [] },
			savingThrows: { allowed: 0, selected: [] },
			skills: { allowed: 0, options: [], selected: [] },
			languages: { allowed: 0, options: [], selected: [] },
			tools: { allowed: 0, options: [], selected: [] },
		};
	}

	// Add pendingAbilityChoices if they exist
	if (
		character.pendingAbilityChoices &&
		Array.isArray(character.pendingAbilityChoices)
	) {
		serializedData.pendingAbilityChoices = [...character.pendingAbilityChoices];
	} else {
		serializedData.pendingAbilityChoices = [];
	}

	// Add instrument choices if they exist
	if (
		character.instrumentChoices &&
		Array.isArray(character.instrumentChoices)
	) {
		serializedData.instrumentChoices = character.instrumentChoices.map(
			(slot) => ({
				key: slot.key,
				sourceLabel: slot.sourceLabel,
				slotIndex: slot.slotIndex,
				selection: slot.selection || null,
			}),
		);
	} else {
		serializedData.instrumentChoices = [];
	}

	// Add variant rules if they exist
	if (character.variantRules) {
		serializedData.variantRules = { ...character.variantRules };
	}

	// Add hit points
	serializedData.hitPoints = {
		current: character.hitPoints?.current || 0,
		max: character.hitPoints?.max || 0,
		temp: character.hitPoints?.temp || 0,
	};

	// Add inventory system
	serializedData.inventory = {
		items: (character.inventory?.items || []).map((item) => ({
			id: item.id,
			name: item.name,
			baseItemId: item.baseItemId,
			quantity: item.quantity || 1,
			equipped: item.equipped || false,
			attuned: item.attuned || false,
			cost: item.cost ? { ...item.cost } : null,
			weight: item.weight || 0,
			source: item.source || 'Unknown',
			type: item.type || null,
			weapon: item.weapon || false,
			armor: item.armor || false,
			shield: item.shield || false,
			reqAttune: item.reqAttune || false,
			metadata: item.metadata ? { ...item.metadata } : {},
		})),
		equipped: Array.isArray(character.inventory?.equipped)
			? [...character.inventory.equipped]
			: [],
		attuned: safeArray(character.inventory?.attuned),
		currency: {
			cp: character.inventory?.currency?.cp || 0,
			sp: character.inventory?.currency?.sp || 0,
			ep: character.inventory?.currency?.ep || 0,
			gp: character.inventory?.currency?.gp || 0,
			pp: character.inventory?.currency?.pp || 0,
		},
		weight: {
			current: character.inventory?.weight?.current || 0,
			capacity: character.inventory?.weight?.capacity || 0,
		},
	};

	// Add spellcasting system
	serializedData.spellcasting = {
		classes: character.spellcasting?.classes
			? { ...character.spellcasting.classes }
			: {},
		multiclass: character.spellcasting?.multiclass
			? { ...character.spellcasting.multiclass }
			: {
				isCastingMulticlass: false,
				combinedSlots: {},
			},
		other: {
			spellsKnown: safeArray(character.spellcasting?.other?.spellsKnown),
			itemSpells: safeArray(character.spellcasting?.other?.itemSpells),
		},
	};

	// Add progression system
	serializedData.progression = {
		classes: (character.progression?.classes || []).map((cls) => ({
			name: cls.name,
			levels: cls.levels,
			subclass: cls.subclass || '', // Always store as string
			subclassChoices: cls.subclassChoices ? { ...cls.subclassChoices } : {},
			hitDice: cls.hitDice,
			hitPoints: safeArray(cls.hitPoints),
			features: safeArray(cls.features),
			spellSlots: cls.spellSlots ? { ...cls.spellSlots } : {},
		})),
		experiencePoints: character.progression?.experiencePoints || 0,
		levelUps: (character.progression?.levelUps || []).map((levelUp) => ({
			fromLevel: levelUp.fromLevel,
			toLevel: levelUp.toLevel,
			appliedFeats: safeArray(levelUp.appliedFeats),
			appliedFeatures: safeArray(levelUp.appliedFeatures),
			changedAbilities: levelUp.changedAbilities
				? { ...levelUp.changedAbilities }
				: {},
			timestamp: levelUp.timestamp,
		})),
	};

	return serializedData;
}

/**
 * Deserialize plain object data into a Character instance
 * @param {Object} data - Plain object from JSON.parse
 * @returns {Character} Character instance
 */
export function deserialize(data) {
	if (!data) return null;
	return new Character(data);
}
