/** Character model class with abilities, proficiencies, and features. */

import {
	DEFAULT_CHARACTER_SIZE,
	DEFAULT_CHARACTER_SPEED,
	getAbilityModNumber,
} from '../lib/5eToolsParser.js';
import { featService } from '../services/FeatService.js';
import { ProficiencyCore } from './Proficiency.js';

export class Character {
	constructor(data = {}) {
		this.id = data.id || null;
		this.name = data.name || '';
		this.playerName = data.playerName || '';

		this.race = data.race || {
			name: '',
			source: '',
			subrace: '',
			abilityChoices: [],
		};

		// Ensure abilityChoices exists on race even if loading from old data
		if (this.race && !Array.isArray(this.race.abilityChoices)) {
			this.race.abilityChoices = [];
		}

		this.class = data.class || {
			level: 1,
		};

		// Removed top-level subclass property; use class.subclass only
		this.background = data.background || '';
		this.level = data.level || 1;
		this.createdAt = data.createdAt || new Date().toISOString();
		this.lastModified = data.lastModified || new Date().toISOString();

		// Initialize allowed sources with PHB by default, or from data
		this.allowedSources = new Set(
			Array.isArray(data.allowedSources)
				? data.allowedSources
				: data.allowedSources instanceof Set
					? Array.from(data.allowedSources)
					: ['PHB'],
		);

		// Initialize ability scores
		this.abilityScores = data.abilityScores || {
			strength: 8,
			dexterity: 8,
			constitution: 8,
			intelligence: 8,
			wisdom: 8,
			charisma: 8,
		};

		// Initialize ability bonuses
		this.abilityBonuses = data.abilityBonuses || {
			strength: [],
			dexterity: [],
			constitution: [],
			intelligence: [],
			wisdom: [],
			charisma: [],
		};

		// Initialize pending ability choices
		this.pendingAbilityChoices = data.pendingAbilityChoices || [];

		// Initialize size and speed with semantic defaults
		this.size = data.size || DEFAULT_CHARACTER_SIZE;
		this.speed = data.speed || { ...DEFAULT_CHARACTER_SPEED };

		// Initialize features
		this.features = {
			darkvision: data.features?.darkvision || 0,
			resistances: new Set(data.features?.resistances || []),
			traits: new Map(
				data.features?.traits ? Object.entries(data.features.traits) : [],
			),
		};

		// Portrait (stored as data URL, file URL, or relative asset path)
		this.portrait = data.portrait || '';

		// Initialize feats and their sources
		this.feats = [];
		this.featSources = new Map();
		this.setFeats(data.feats || [], 'Imported');

		// Initialize proficiencies
		this.proficiencies = data.proficiencies || {
			armor: [],
			weapons: [],
			tools: [],
			skills: [],
			languages: [],
			savingThrows: [],
		};

		// Initialize proficiency sources
		this.proficiencySources = {
			armor: new Map(),
			weapons: new Map(),
			tools: new Map(),
			skills: new Map(),
			languages: new Map(),
			savingThrows: new Map(),
		};

		// Restore proficiency sources if available in the data
		if (data.proficiencySources) {
			for (const type in this.proficiencySources) {
				if (data.proficiencySources[type]) {
					// Handle serialized Map data
					if (typeof data.proficiencySources[type] === 'object') {
						for (const [key, sourceList] of Object.entries(
							data.proficiencySources[type],
						)) {
							// Convert the source list to a Set
							if (Array.isArray(sourceList)) {
								this.proficiencySources[type].set(key, new Set(sourceList));
							} else {
								this.proficiencySources[type].set(key, new Set([sourceList]));
							}
						}
					}
				}
			}
		}

		// Add structure for optional proficiencies
		this.optionalProficiencies = data.optionalProficiencies || {
			armor: { allowed: 0, selected: [] },
			weapons: { allowed: 0, selected: [] },
			savingThrows: { allowed: 0, selected: [] },
			skills: {
				allowed: 0,
				options: [],
				selected: [],
				race: {
					allowed: 0,
					options: [],
					selected: [],
				},
				class: {
					allowed: 0,
					options: [],
					selected: [],
				},
				background: {
					allowed: 0,
					options: [],
					selected: [],
				},
			},
			languages: {
				allowed: 0,
				options: [],
				selected: [],
				race: {
					allowed: 0,
					options: [],
					selected: [],
				},
				class: {
					allowed: 0,
					options: [],
					selected: [],
				},
				background: {
					allowed: 0,
					options: [],
					selected: [],
				},
			},
			tools: {
				allowed: 0,
				options: [],
				selected: [],
				race: {
					allowed: 0,
					options: [],
					selected: [],
				},
				class: {
					allowed: 0,
					options: [],
					selected: [],
				},
				background: {
					allowed: 0,
					options: [],
					selected: [],
				},
			},
		};

		this.pendingChoices = new Map(
			data.pendingChoices ? Object.entries(data.pendingChoices) : [],
		);
		this.height = data.height || '';
		this.weight = data.weight || '';
		this.gender = data.gender || '';
		this.backstory = data.backstory || '';

		// Initialize instrument choices for specific musical instruments
		this.instrumentChoices = data.instrumentChoices || [];

		this.equipment = data.equipment || {
			weapons: [],
			armor: [],
			items: [],
		};

		// Initialize hit points
		this.hitPoints = data.hitPoints || {
			current: 0,
			max: 0,
			temp: 0,
		};

		// Initialize variant rules with defaults or from data
		this.variantRules = data.variantRules || {
			feats: true,
			multiclassing: true,
			abilityScoreMethod: 'custom', // Options: 'custom', 'pointBuy', 'standardArray'
		};

		// Initialize inventory system
		this.inventory = data.inventory || {
			items: [], // Array of { id, name, baseItemId, quantity, equipped, attuned, cost, weight, source, metadata }
			equipped: {
				head: null,
				body: null,
				hands: [],
				feet: null,
				back: null,
				neck: null,
				wrists: [],
				fingers: [],
				waist: null,
			},
			attuned: [], // Array of item instance IDs
			weight: {
				current: 0,
				capacity: 0, // Calculated as strength * 15
			},
		};

		// Initialize spellcasting system (tracks spells by class)
		this.spellcasting = data.spellcasting || {
			classes: {}, // { "Wizard": { level, spellsKnown, spellsPrepared, spellSlots, ... }, ... }
			multiclass: {
				isCastingMulticlass: false,
				combinedSlots: {}, // Combined spell slots for multiclass
			},
			other: {
				spellsKnown: [], // From items, feats, etc.
				itemSpells: [],
			},
		};

		// Initialize character progression (tracks per-class levels and features)
		this.progression = data.progression || {
			classes: [], // Array of { name, levels, subclass, hitDice, hitPoints, features, spellSlots }
		};

		// Use ProficiencyCore to initialize proficiency structures
		ProficiencyCore.initializeProficiencyStructures(this);
	}

	getAbilityScore(ability) {
		return this.abilityScores[ability] || 0;
	}

	getAbilityModifier(ability) {
		const score = this.getAbilityScore(ability);
		return getAbilityModNumber(score);
	}

	addAbilityBonus(ability, value, source) {
		if (!ability) {
			console.warn(
				'Character',
				`Attempted to add ability bonus with undefined ability name (value: ${value}, source: ${source})`,
			);
			return;
		}

		// Normalize the ability name
		const normalizedAbility = ability
			.toLowerCase()
			.replace(/^str$/, 'strength')
			.replace(/^dex$/, 'dexterity')
			.replace(/^con$/, 'constitution')
			.replace(/^int$/, 'intelligence')
			.replace(/^wis$/, 'wisdom')
			.replace(/^cha$/, 'charisma');

		if (!this.abilityBonuses[normalizedAbility]) {
			this.abilityBonuses[normalizedAbility] = [];
		}

		// Check if a bonus from this source already exists
		const existingBonus = this.abilityBonuses[normalizedAbility].find(
			(bonus) => bonus.source === source,
		);
		if (existingBonus) {
			// Update existing bonus
			existingBonus.value = value;
		} else {
			// Add new bonus
			this.abilityBonuses[normalizedAbility].push({ value, source });
		}
	}

	removeAbilityBonus(ability, value, source) {
		const normalizedAbility = ability?.toLowerCase();
		if (!normalizedAbility || !this.abilityBonuses[normalizedAbility]) return;

		this.abilityBonuses[normalizedAbility] = this.abilityBonuses[
			normalizedAbility
		].filter((bonus) => !(bonus.value === value && bonus.source === source));
	}

	clearAbilityBonuses(source) {
		for (const ability in this.abilityBonuses) {
			this.abilityBonuses[ability] = this.abilityBonuses[ability].filter(
				(bonus) => bonus.source !== source,
			);
		}
	}

	clearAbilityBonusesByPrefix(prefix) {
		if (!prefix) return;
		const lowerCasePrefix = prefix.toLowerCase();
		for (const ability in this.abilityBonuses) {
			if (Array.isArray(this.abilityBonuses[ability])) {
				this.abilityBonuses[ability] = this.abilityBonuses[ability].filter(
					(bonus) =>
						!bonus.source ||
						!bonus.source.toLowerCase().startsWith(lowerCasePrefix),
				);
			}
		}
	}

	addPendingChoice(type, choice) {
		if (!this.pendingChoices.has(type)) {
			this.pendingChoices.set(type, []);
		}
		this.pendingChoices.get(type).push(choice);

		// Also add to ability choices if it's an ability choice
		if (type === 'ability') {
			this.pendingAbilityChoices.push(choice);
		}
	}

	getSimplePendingAbilityChoices() {
		return this.pendingAbilityChoices;
	}

	clearPendingAbilityChoices() {
		this.pendingAbilityChoices = [];
	}

	getPendingChoicesByType(type) {
		return this.pendingChoices.get(type) || [];
	}

	clearPendingChoicesByType(type) {
		if (type === 'ability') {
			// Clear ability choices array
			this.pendingAbilityChoices = [];
		} else if (type) {
			// Clear specific type from pendingChoices Map
			this.pendingChoices.delete(type);
		} else {
			// Clear all choices
			this.pendingChoices.clear();
			this.pendingAbilityChoices = [];
		}
	}

	addProficiency(type, proficiency, source) {
		return ProficiencyCore.addProficiency(this, type, proficiency, source);
	}

	removeProficienciesBySource(source) {
		return ProficiencyCore.removeProficienciesBySource(this, source);
	}

	setFeats(feats, defaultSource = 'Unknown') {
		this.feats = [];
		this.featSources = new Map();

		if (!Array.isArray(feats)) return;

		for (const feat of feats) {
			const name =
				typeof feat === 'string'
					? feat
					: feat?.name || feat?.id || feat?.feat || null;
			if (!name) continue;

			// Priority: use origin field (where feat came from in character), then fall back to 5etools source
			const sourceCandidate =
				typeof feat === 'object'
					? feat.origin ||
					feat.grantedBy ||
					feat.from ||
					feat.sourceType ||
					feat.source
					: null;
			const source = sourceCandidate || defaultSource;

			this.feats.push({ name, source });

			if (!this.featSources.has(name)) {
				this.featSources.set(name, new Set());
			}
			this.featSources.get(name).add(source);
		}
	}

	/**
	 * Returns how many feat choices the character is allowed to make.
	 * Currently supports Variant Human (PHB) and the level 4 ASI swap.
	 * @returns {{used:number,max:number,remaining:number,reasons:string[],blockedReason?:string}}
	 */
	getFeatAvailability() {
		return featService.calculateFeatAvailability(this);
	}

	addLanguage(language, source) {
		return this.addProficiency('languages', language, source);
	}

	removeLanguagesBySource(source) {
		return this.removeProficienciesBySource(source);
	}

	addResistance(resistance, _source) {
		this.features.resistances.add(resistance);
	}

	clearResistances(_source) {
		this.features.resistances.clear();
	}

	addTrait(name, description, source) {
		this.features.traits.set(name, { description, source });
	}

	clearTraits(source) {
		for (const [name, trait] of this.features.traits.entries()) {
			if (trait.source === source) {
				this.features.traits.delete(name);
			}
		}
	}

	addAllowedSource(source) {
		if (source) {
			this.allowedSources.add(source.toUpperCase());
		}
	}

	removeAllowedSource(source) {
		if (source) {
			this.allowedSources.delete(source.toUpperCase());
		}
	}

	isSourceAllowed(source) {
		const isAllowed = source
			? this.allowedSources.has(source.toUpperCase())
			: false;
		return isAllowed;
	}

	setAllowedSources(sources) {
		this.allowedSources = new Set(sources);
	}

	getAllowedSources() {
		return new Set(this.allowedSources);
	}

	static fromJSON(data) {
		return new Character(data);
	}

	toJSON() {
		console.log('[Character.toJSON] Called - optionalProficiencies.tools.class BEFORE serialization:',
			JSON.stringify(this.optionalProficiencies?.tools?.class || {}));

		// Helper function to safely convert a Map to an object
		const mapToObject = (map) => {
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
		};

		// Helper function to ensure arrays are safe for serialization
		const safeArray = (arr) => {
			if (!arr) return [];
			if (Array.isArray(arr)) return [...arr];
			if (arr instanceof Set) return Array.from(arr);
			return [];
		};

		// Create a clean object with just the data we need
		const serializedData = {
			id: this.id,
			name: this.name,
			portrait: this.portrait || '',
			allowedSources: Array.from(this.allowedSources || []),
			playerName: this.playerName,
			level: this.level,
			createdAt: this.createdAt,
			lastModified: new Date().toISOString(),
			height: this.height || '',
			weight: this.weight || '',
			gender: this.gender || '',
			backstory: this.backstory || '',

			// Ability scores and bonuses
			abilityScores: { ...this.abilityScores },
			abilityBonuses: { ...this.abilityBonuses },

			// Race, class, background
			race: this.race
				? { ...this.race }
				: { name: '', source: '', subrace: '' },
			class: this.class ? { ...this.class } : { level: 1 },
			subclass: this.subclass || '',
			background: this.background
				? typeof this.background === 'object'
					? { ...this.background }
					: { name: this.background }
				: {},

			// Size and speed
			size: this.size || DEFAULT_CHARACTER_SIZE,
			speed: this.speed ? { ...this.speed } : { ...DEFAULT_CHARACTER_SPEED },

			// Features and proficiencies
			features: {
				darkvision: this.features?.darkvision || 0,
				resistances: Array.from(this.features?.resistances || []),
				traits: mapToObject(this.features?.traits),
			},

			proficiencies: {
				armor: safeArray(this.proficiencies?.armor),
				weapons: safeArray(this.proficiencies?.weapons),
				tools: safeArray(this.proficiencies?.tools),
				skills: safeArray(this.proficiencies?.skills),
				languages: safeArray(this.proficiencies?.languages),
				savingThrows: safeArray(this.proficiencies?.savingThrows),
			},

			// Proficiency sources (convert Maps to serializable objects)
			proficiencySources: {
				armor: mapToObject(this.proficiencySources?.armor),
				weapons: mapToObject(this.proficiencySources?.weapons),
				tools: mapToObject(this.proficiencySources?.tools),
				skills: mapToObject(this.proficiencySources?.skills),
				languages: mapToObject(this.proficiencySources?.languages),
				savingThrows: mapToObject(this.proficiencySources?.savingThrows),
			},

			// Feats
			feats: Array.isArray(this.feats)
				? this.feats.map((feat) => ({
					name: feat?.name || '',
					source: feat?.source || 'Unknown',
				}))
				: [],
			featSources: mapToObject(this.featSources),
		};

		// Handle optional proficiencies separately with careful error handling
		try {
			if (this.optionalProficiencies) {
				serializedData.optionalProficiencies = {
					// Simple types
					armor: this.optionalProficiencies.armor
						? {
							allowed: this.optionalProficiencies.armor.allowed || 0,
							selected: safeArray(this.optionalProficiencies.armor.selected),
						}
						: { allowed: 0, selected: [] },

					weapons: this.optionalProficiencies.weapons
						? {
							allowed: this.optionalProficiencies.weapons.allowed || 0,
							selected: safeArray(
								this.optionalProficiencies.weapons.selected,
							),
						}
						: { allowed: 0, selected: [] },

					savingThrows: this.optionalProficiencies.savingThrows
						? {
							allowed: this.optionalProficiencies.savingThrows.allowed || 0,
							selected: safeArray(
								this.optionalProficiencies.savingThrows.selected,
							),
						}
						: { allowed: 0, selected: [] },

					// Complex types with source-specific details
					skills: this._serializeComplexProficiency('skills'),
					languages: this._serializeComplexProficiency('languages'),
					tools: this._serializeComplexProficiency('tools'),
				};

				console.log('[Character.toJSON] Serialized optionalProficiencies.tools.class:',
					JSON.stringify(serializedData.optionalProficiencies.tools.class));
			}
		} catch {
			// Provide empty default structure
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
			this.pendingAbilityChoices &&
			Array.isArray(this.pendingAbilityChoices)
		) {
			serializedData.pendingAbilityChoices = [...this.pendingAbilityChoices];
		} else {
			serializedData.pendingAbilityChoices = [];
		}

		// Add instrument choices if they exist
		if (
			this.instrumentChoices &&
			Array.isArray(this.instrumentChoices)
		) {
			serializedData.instrumentChoices = this.instrumentChoices.map((slot) => ({
				key: slot.key,
				sourceLabel: slot.sourceLabel,
				slotIndex: slot.slotIndex,
				selection: slot.selection || null,
			}));
		} else {
			serializedData.instrumentChoices = [];
		}

		// Add variant rules if they exist
		if (this.variantRules) {
			serializedData.variantRules = { ...this.variantRules };
		}

		// Add hit points
		serializedData.hitPoints = {
			current: this.hitPoints?.current || 0,
			max: this.hitPoints?.max || 0,
			temp: this.hitPoints?.temp || 0,
		};

		// Add inventory system
		serializedData.inventory = {
			items: (this.inventory?.items || []).map((item) => ({
				id: item.id,
				name: item.name,
				baseItemId: item.baseItemId,
				quantity: item.quantity || 1,
				equipped: item.equipped || false,
				attuned: item.attuned || false,
				cost: item.cost ? { ...item.cost } : null,
				weight: item.weight || 0,
				source: item.source || 'Unknown',
				metadata: item.metadata ? { ...item.metadata } : {},
			})),
			equipped: this.inventory?.equipped ? { ...this.inventory.equipped } : {},
			attuned: safeArray(this.inventory?.attuned),
			weight: {
				current: this.inventory?.weight?.current || 0,
				capacity: this.inventory?.weight?.capacity || 0,
			},
		};

		// Add spellcasting system
		serializedData.spellcasting = {
			classes: this.spellcasting?.classes ? { ...this.spellcasting.classes } : {},
			multiclass: this.spellcasting?.multiclass ? { ...this.spellcasting.multiclass } : {
				isCastingMulticlass: false,
				combinedSlots: {},
			},
			other: {
				spellsKnown: safeArray(this.spellcasting?.other?.spellsKnown),
				itemSpells: safeArray(this.spellcasting?.other?.itemSpells),
			},
		};

		// Add progression system
		serializedData.progression = {
			classes: (this.progression?.classes || []).map((cls) => ({
				name: cls.name,
				levels: cls.levels,  // Fixed: was "level", should be "levels" (plural)
				subclass: cls.subclass ? { ...cls.subclass } : null,
				hitDice: cls.hitDice,
				hitPoints: safeArray(cls.hitPoints),
				features: safeArray(cls.features),
				spellSlots: cls.spellSlots ? { ...cls.spellSlots } : {},
			})),
			experiencePoints: this.progression?.experiencePoints || 0,
			levelUps: (this.progression?.levelUps || []).map((levelUp) => ({
				fromLevel: levelUp.fromLevel,
				toLevel: levelUp.toLevel,
				appliedFeats: safeArray(levelUp.appliedFeats),
				appliedFeatures: safeArray(levelUp.appliedFeatures),
				changedAbilities: levelUp.changedAbilities ? { ...levelUp.changedAbilities } : {},
				timestamp: levelUp.timestamp,
			})),
		};

		return serializedData;
	}

	_serializeComplexProficiency(type) {
		// Helper function to ensure arrays are safe for serialization
		const safeArray = (arr) => {
			if (!arr) return [];
			if (Array.isArray(arr)) return [...arr];
			if (arr instanceof Set) return Array.from(arr);
			return [];
		};

		if (!this.optionalProficiencies || !this.optionalProficiencies[type]) {
			// Return default structure if missing
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
			allowed: this.optionalProficiencies[type].allowed || 0,
			options: safeArray(this.optionalProficiencies[type].options),
			selected: safeArray(this.optionalProficiencies[type].selected),
		};

		// Add source-specific details
		for (const source of ['race', 'class', 'background']) {
			if (this.optionalProficiencies[type][source]) {
				result[source] = {
					allowed: this.optionalProficiencies[type][source].allowed || 0,
					options: safeArray(this.optionalProficiencies[type][source].options),
					selected: safeArray(
						this.optionalProficiencies[type][source].selected,
					),
				};
			} else {
				// Default empty structure
				result[source] = { allowed: 0, options: [], selected: [] };
			}
		}

		return result;
	}

	addPendingAbilityChoice(choice) {
		this.pendingAbilityChoices.push(choice);
	}

	getPendingAbilityChoices() {
		return this.pendingAbilityChoices;
	}

	/**
	 * Clear all racial benefits, bonuses, and proficiencies
	 * Consolidates cleanup from race changes into a single call
	 * @returns {void}
	 */
	clearRacialBenefits() {
		// Clear ability bonuses from race/subrace
		this.clearAbilityBonuses('Race');
		this.clearAbilityBonuses('Subrace');
		this.clearAbilityBonusesByPrefix('Race');
		this.clearAbilityBonusesByPrefix('Subrace');

		// Clear the character's saved ability choices
		if (this.race) {
			this.race.abilityChoices = [];
		}

		// Clear all pending ability choices
		this.clearPendingChoicesByType('ability');

		// Clear all proficiencies from race and subrace
		this.removeProficienciesBySource('Race');
		this.removeProficienciesBySource('Subrace');

		// Clear all traits from race and subrace
		this.clearTraits('Race');
		this.clearTraits('Subrace');

		// Reset racial features
		this.features.darkvision = 0;
		this.features.resistances.clear();

		// Clear optional proficiencies for race
		if (this.optionalProficiencies) {
			// Clear race skills
			if (this.optionalProficiencies.skills?.race) {
				this.optionalProficiencies.skills.race.allowed = 0;
				this.optionalProficiencies.skills.race.options = [];
				this.optionalProficiencies.skills.race.selected = [];
			}

			// Clear race languages
			if (this.optionalProficiencies.languages?.race) {
				this.optionalProficiencies.languages.race.allowed = 0;
				this.optionalProficiencies.languages.race.options = [];
				this.optionalProficiencies.languages.race.selected = [];
			}

			// Clear race tools
			if (this.optionalProficiencies.tools?.race) {
				this.optionalProficiencies.tools.race.allowed = 0;
				this.optionalProficiencies.tools.race.options = [];
				this.optionalProficiencies.tools.race.selected = [];
			}
		}
	}
}

/**
 * Centralized utility to serialize a Character instance
 * Handles Sets/Maps and calls toJSON()
 * @param {Character} character
 * @returns {Object} Serialized character data
 */
export function serializeCharacter(character) {
	return character?.toJSON ? character.toJSON() : character;
}

/**
 * Centralized utility to deserialize character data
 * Handles Sets/Maps and calls Character.fromJSON()
 * @param {Object} data
 * @returns {Character}
 */
export function deserializeCharacter(data) {
	return Character.fromJSON(data);
}
