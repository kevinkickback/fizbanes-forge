import {
	DEFAULT_CHARACTER_SIZE,
	DEFAULT_CHARACTER_SPEED,
	getAbilityModNumber,
} from '../lib/5eToolsParser.js';
import { featService } from '../services/FeatService.js';
import * as CharacterSerializer from './CharacterSerializer.js';
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

		this.background = data.background || '';
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

		this.size = data.size || DEFAULT_CHARACTER_SIZE;
		this.speed = data.speed || { ...DEFAULT_CHARACTER_SPEED };

		this.features = {
			darkvision: data.features?.darkvision || 0,
			resistances: new Set(data.features?.resistances || []),
			traits: new Map(
				data.features?.traits ? Object.entries(data.features.traits) : [],
			),
		};

		this.portrait = data.portrait || '';

		this.feats = [];
		this.featSources = new Map();
		this.setFeats(data.feats || [], 'Imported');

		this.proficiencies = data.proficiencies || {
			armor: [],
			weapons: [],
			tools: [],
			skills: [],
			languages: [],
			savingThrows: [],
		};

		this.proficiencySources = {
			armor: new Map(),
			weapons: new Map(),
			tools: new Map(),
			skills: new Map(),
			languages: new Map(),
			savingThrows: new Map(),
		};

		if (data.proficiencySources) {
			for (const type in this.proficiencySources) {
				if (data.proficiencySources[type]) {
					if (typeof data.proficiencySources[type] === 'object') {
						for (const [key, sourceList] of Object.entries(
							data.proficiencySources[type],
						)) {
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
		this.alignment = data.alignment || '';
		this.deity = data.deity || '';
		this.backstory = data.backstory || '';

		this.instrumentChoices = data.instrumentChoices || [];

		this.equipment = data.equipment || {
			weapons: [],
			armor: [],
			items: [],
		};

		this.hitPoints = data.hitPoints || {
			current: 0,
			max: 0,
			temp: 0,
		};

		this.variantRules = data.variantRules || {
			variantfeat: false,
			abilityScoreMethod: 'custom',
		};

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

		this.spellcasting = data.spellcasting || {
			classes: {},
			multiclass: {
				isCastingMulticlass: false,
				combinedSlots: {},
			},
			other: {
				spellsKnown: [],
				itemSpells: [],
			},
		};

		this.progression = data.progression || {
			classes: [],
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

	/** @returns {{used:number,max:number,remaining:number,reasons:string[],blockedReason?:string}} */
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
		return CharacterSerializer.serialize(this);
	}

	addPendingAbilityChoice(choice) {
		this.pendingAbilityChoices.push(choice);
	}

	getPendingAbilityChoices() {
		return this.pendingAbilityChoices;
	}

	/** Clear all racial benefits, bonuses, and proficiencies. */
	clearRacialBenefits() {
		this.clearAbilityBonuses('Race');
		this.clearAbilityBonuses('Subrace');
		this.clearAbilityBonusesByPrefix('Race');
		this.clearAbilityBonusesByPrefix('Subrace');

		if (this.race) {
			this.race.abilityChoices = [];
		}

		this.clearPendingChoicesByType('ability');

		this.removeProficienciesBySource('Race');
		this.removeProficienciesBySource('Subrace');

		this.clearTraits('Race');
		this.clearTraits('Subrace');

		this.features.darkvision = 0;
		this.features.resistances.clear();

		if (this.optionalProficiencies) {
			if (this.optionalProficiencies.skills?.race) {
				this.optionalProficiencies.skills.race.allowed = 0;
				this.optionalProficiencies.skills.race.options = [];
				this.optionalProficiencies.skills.race.selected = [];
			}

			if (this.optionalProficiencies.languages?.race) {
				this.optionalProficiencies.languages.race.allowed = 0;
				this.optionalProficiencies.languages.race.options = [];
				this.optionalProficiencies.languages.race.selected = [];
			}

			if (this.optionalProficiencies.tools?.race) {
				this.optionalProficiencies.tools.race.allowed = 0;
				this.optionalProficiencies.tools.race.options = [];
				this.optionalProficiencies.tools.race.selected = [];
			}
		}
	}

	/** @returns {number} Sum of all class levels */
	getTotalLevel() {
		if (!this.progression?.classes || this.progression.classes.length === 0) {
			return 1;
		}
		return this.progression.classes.reduce((sum, c) => sum + (c.levels || 0), 0);
	}

	/** @returns {Object|null} First class in progression or null */
	getPrimaryClass() {
		if (!this.progression?.classes || this.progression.classes.length === 0) {
			return null;
		}
		return this.progression.classes[0];
	}

	/** @returns {Object|null} Class entry by name or null */
	getClassEntry(className) {
		if (!this.progression?.classes) {
			return null;
		}
		return this.progression.classes.find(c => c.name === className) || null;
	}

	/** @returns {boolean} True if character has the specified class */
	hasClass(className) {
		return this.getClassEntry(className) !== null;
	}
}

/** Serialize a Character instance for storage. */
export function serializeCharacter(character) {
	return CharacterSerializer.serialize(character);
}

/** Deserialize character data into a Character instance. */
export function deserializeCharacter(data) {
	return CharacterSerializer.deserialize(data);
}
