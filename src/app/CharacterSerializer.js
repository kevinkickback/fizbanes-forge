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
	} catch (error) {
		console.warn('[CharacterSerializer]', 'Map serialization failed:', error);
		return {};
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

	return {
		..._serializeIdentity(character),
		..._serializeAbilities(character),
		..._serializeRaceAndBackground(character),
		..._serializeFeatures(character),
		..._serializeProficiencies(character),
		..._serializeOptionalProficiencies(character),
		pendingAbilityChoices: Array.isArray(character.pendingAbilityChoices)
			? [...character.pendingAbilityChoices]
			: [],
		instrumentChoices: Array.isArray(character.instrumentChoices)
			? character.instrumentChoices.map((slot) => ({
				key: slot.key,
				sourceLabel: slot.sourceLabel,
				slotIndex: slot.slotIndex,
				selection: slot.selection || null,
			}))
			: [],
		variantRules: character.variantRules ? { ...character.variantRules } : undefined,
		hitPoints: {
			current: character.hitPoints?.current || 0,
			max: character.hitPoints?.max || 0,
			temp: character.hitPoints?.temp || 0,
		},
		..._serializeInventory(character),
		..._serializeSpellcasting(character),
		..._serializeProgression(character),
	};
}

function _serializeIdentity(character) {
	return {
		id: character.id,
		name: character.name,
		portrait: character.portrait || '',
		embeddedPortrait: character.embeddedPortrait || null,
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
		personalityTraits: character.personalityTraits || '',
		ideals: character.ideals || '',
		bonds: character.bonds || '',
		flaws: character.flaws || '',
		experience: character.experience || '',
		backstory: character.backstory || '',
		alliesAndOrganizations: character.alliesAndOrganizations || {
			selectedAlly: '',
			customNotes: '',
		},
	};
}

function _serializeAbilities(character) {
	return {
		abilityScores: { ...character.abilityScores },
		abilityBonuses: { ...character.abilityBonuses },
	};
}

function _serializeRaceAndBackground(character) {
	return {
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
		backgroundFeature: character.backgroundFeature || '',
		size: character.size || 'Medium',
		speed: character.speed
			? { ...character.speed }
			: { walk: 30, fly: 0, swim: 0, climb: 0, burrow: 0 },
	};
}

function _serializeFeatures(character) {
	return {
		features: {
			darkvision: character.features?.darkvision || 0,
			resistances: Array.from(character.features?.resistances || []),
			traits: mapToObject(character.features?.traits),
		},
		feats: Array.isArray(character.feats)
			? character.feats.map((feat) => ({
				name: feat?.name || '',
				source: feat?.source || 'Unknown',
			}))
			: [],
		featSources: mapToObject(character.featSources),
	};
}

function _serializeProficiencies(character) {
	return {
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
	};
}

function _serializeOptionalProficiencies(character) {
	try {
		if (!character.optionalProficiencies) return {};
		return {
			optionalProficiencies: {
				armor: character.optionalProficiencies.armor
					? {
						allowed: character.optionalProficiencies.armor.allowed || 0,
						selected: safeArray(character.optionalProficiencies.armor.selected),
					}
					: { allowed: 0, selected: [] },
				weapons: character.optionalProficiencies.weapons
					? {
						allowed: character.optionalProficiencies.weapons.allowed || 0,
						selected: safeArray(character.optionalProficiencies.weapons.selected),
					}
					: { allowed: 0, selected: [] },
				savingThrows: character.optionalProficiencies.savingThrows
					? {
						allowed: character.optionalProficiencies.savingThrows.allowed || 0,
						selected: safeArray(character.optionalProficiencies.savingThrows.selected),
					}
					: { allowed: 0, selected: [] },
				skills: serializeComplexProficiency(character.optionalProficiencies, 'skills'),
				languages: serializeComplexProficiency(character.optionalProficiencies, 'languages'),
				tools: serializeComplexProficiency(character.optionalProficiencies, 'tools'),
			},
		};
	} catch (error) {
		console.warn('[CharacterSerializer]', 'Proficiency serialization failed:', error);
		return {
			optionalProficiencies: {
				armor: { allowed: 0, selected: [] },
				weapons: { allowed: 0, selected: [] },
				savingThrows: { allowed: 0, selected: [] },
				skills: { allowed: 0, options: [], selected: [] },
				languages: { allowed: 0, options: [], selected: [] },
				tools: { allowed: 0, options: [], selected: [] },
			},
		};
	}
}

function _serializeInventory(character) {
	return {
		inventory: {
			items: (character.inventory?.items || []).map((item) => ({
				id: item.id,
				name: item.name,
				baseItemId: item.baseItemId,
				quantity: item.quantity || 1,
				equipped: item.equipped || false,
				attuned: item.attuned || false,
				cost: item.cost ? { ...item.cost } : null,
				weight: item.weight || 0,
				ac: item.ac || 0,
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
		},
	};
}

function _serializeSpellcasting(character) {
	return {
		spellcasting: {
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
		},
	};
}

function _serializeProgression(character) {
	return {
		progression: {
			classes: (character.progression?.classes || []).map((cls) => ({
				name: cls.name,
				levels: cls.levels,
				subclass: cls.subclass || '',
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
		},
		progressionHistory: character.progressionHistory
			? JSON.parse(JSON.stringify(character.progressionHistory))
			: {},
	};
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
