import {
	DEFAULT_CHARACTER_SIZE,
	DEFAULT_CHARACTER_SPEED,
	getAbilityModNumber,
} from '../lib/5eToolsParser.js';
import { proficiencyService } from '../services/ProficiencyService.js';
import * as CharacterSerializer from './CharacterSerializer.js';

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

		if (this.race && !Array.isArray(this.race.abilityChoices)) {
			if (
				this.race.abilityChoices &&
				typeof this.race.abilityChoices === 'object'
			) {
				const entries = Object.entries(this.race.abilityChoices).sort(
					([a], [b]) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
				);
				this.race.abilityChoices = entries
					.map(([, choice]) => choice)
					.filter(Boolean);
			} else {
				this.race.abilityChoices = [];
			}
		}

		this.background = data.background || '';
		this.backgroundFeature = data.backgroundFeature || '';
		this.createdAt = data.createdAt || new Date().toISOString();
		this.lastModified = data.lastModified || new Date().toISOString();

		this.allowedSources = new Set(
			Array.isArray(data.allowedSources)
				? data.allowedSources
				: data.allowedSources instanceof Set
					? Array.from(data.allowedSources)
					: ['PHB'],
		);

		this.abilityScores = data.abilityScores || {
			strength: 8,
			dexterity: 8,
			constitution: 8,
			intelligence: 8,
			wisdom: 8,
			charisma: 8,
		};

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
		this.age = data.age || '';
		this.skinColor = data.skinColor || '';
		this.eyeColor = data.eyeColor || '';
		this.hairColor = data.hairColor || '';
		this.alignment = data.alignment || '';
		this.deity = data.deity || '';
		this.additionalFeatures = data.additionalFeatures || '';
		this.personalityTraits = data.personalityTraits || '';
		this.ideals = data.ideals || '';
		this.bonds = data.bonds || '';
		this.flaws = data.flaws || '';
		this.experience = data.experience || '';
		this.backstory = data.backstory || '';
		this.alliesAndOrganizations = data.alliesAndOrganizations || {
			selectedAlly: '',
			customNotes: '',
		};

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
			items: [],
			equipped: [],
			attuned: [],
			currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
			weight: {
				current: 0,
				capacity: 0,
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

		this.progressionHistory = data.progressionHistory || {};

		proficiencyService.initializeProficiencyStructures(this);
	}

	getAbilityScore(ability) {
		const baseScore = this.abilityScores[ability] || 0;
		const bonuses = this.abilityBonuses[ability] || [];
		const totalBonus = bonuses.reduce((sum, bonus) => sum + (bonus.value || 0), 0);
		return baseScore + totalBonus;
	}

	getAbilityModifier(ability) {
		const score = this.getAbilityScore(ability);
		return getAbilityModNumber(score);
	}

	addAbilityBonus(ability, value, source) {
		if (!ability) {
			console.warn(
				'[Character]',
				`Attempted to add ability bonus with undefined ability (value: ${value}, source: ${source})`,
			);
			return;
		}

		const normalizedAbility = this._normalizeAbility(ability);

		if (!this.abilityBonuses[normalizedAbility]) {
			this.abilityBonuses[normalizedAbility] = [];
		}

		const existingBonus = this.abilityBonuses[normalizedAbility].find(
			(bonus) => bonus.source === source,
		);
		if (existingBonus) {
			existingBonus.value = value;
		} else {
			this.abilityBonuses[normalizedAbility].push({ value, source });
		}
	}

	_normalizeAbility(ability) {
		return ability
			.toLowerCase()
			.replace(/^str$/, 'strength')
			.replace(/^dex$/, 'dexterity')
			.replace(/^con$/, 'constitution')
			.replace(/^int$/, 'intelligence')
			.replace(/^wis$/, 'wisdom')
			.replace(/^cha$/, 'charisma');
	}

	removeAbilityBonus(ability, value, source) {
		if (!ability) return;

		const normalizedAbility = this._normalizeAbility(ability);
		if (!this.abilityBonuses[normalizedAbility]) return;

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

	addPendingAbilityChoice(choice) {
		this.pendingAbilityChoices.push(choice);
	}

	getPendingAbilityChoices() {
		return this.pendingAbilityChoices;
	}

	clearPendingAbilityChoices() {
		this.pendingAbilityChoices = [];
	}

	addProficiency(type, proficiency, source) {
		return proficiencyService.addProficiency(this, type, proficiency, source);
	}

	removeProficienciesBySource(source) {
		return proficiencyService.removeProficienciesBySource(this, source);
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

	addResistance(resistance) {
		this.features.resistances.add(resistance);
	}

	removeResistance(resistance) {
		this.features.resistances.delete(resistance);
	}

	clearResistances() {
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
		return source ? this.allowedSources.has(source.toUpperCase()) : false;
	}

	setAllowedSources(sources) {
		this.allowedSources = new Set(sources);
	}

	getAllowedSources() {
		return new Set(this.allowedSources);
	}

	toJSON() {
		return CharacterSerializer.serialize(this);
	}

	clearRacialBenefits() {
		this.clearAbilityBonuses('Race');
		this.clearAbilityBonuses('Subrace');
		this.clearAbilityBonusesByPrefix('Race');
		this.clearAbilityBonusesByPrefix('Subrace');

		if (this.race) {
			this.race.abilityChoices = [];
		}

		this.clearPendingAbilityChoices();

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

	getTotalLevel() {
		if (!this.progression?.classes || this.progression.classes.length === 0) {
			return 1;
		}
		return this.progression.classes.reduce(
			(sum, c) => sum + (c.levels || 0),
			0,
		);
	}

	getPrimaryClass() {
		if (!this.progression?.classes || this.progression.classes.length === 0) {
			return null;
		}
		return this.progression.classes[0];
	}

	getClassEntry(className) {
		if (!this.progression?.classes) {
			return null;
		}
		return this.progression.classes.find((c) => c.name === className) || null;
	}

	hasClass(className) {
		return this.getClassEntry(className) !== null;
	}

	/**
	 * Calculate feat availability based on ASI choices and race
	 * @returns {Object} { used, max, remaining, reasons, blockedReason }
	 */
	getFeatAvailability() {
		const reasons = [];
		let maxFeats = 0;

		// Count ASI opportunities (available feat slots from level-ups)
		const _totalLevel = this.getTotalLevel();
		if (this.progression?.classes) {
			for (const classEntry of this.progression.classes) {
				const className = classEntry.name;
				const classLevel = classEntry.levels || 0;

				// Determine ASI levels for this class
				let asiLevels = [4, 8, 12, 16, 19]; // Standard
				if (className === 'Fighter') {
					asiLevels = [4, 6, 8, 12, 14, 16, 19];
				} else if (className === 'Rogue') {
					asiLevels = [4, 8, 10, 12, 16, 19];
				}

				// Count ASI opportunities for this class
				const asiCount = asiLevels.filter((level) => level <= classLevel).length;
				maxFeats += asiCount;

				if (asiCount > 0) {
					reasons.push(
						`${className}: ${asiCount} ASI choice${asiCount > 1 ? 's' : ''}`,
					);
				}
			}
		}

		// Check for Variant Human feat
		const raceName = this.race?.name?.toLowerCase() || '';
		if (raceName.includes('variant') && raceName.includes('human')) {
			maxFeats += 1;
			reasons.push('Variant Human');
		}

		// Count currently selected feats
		const usedFeats = this.feats?.length || 0;
		const remaining = Math.max(0, maxFeats - usedFeats);

		return {
			used: usedFeats,
			max: maxFeats,
			remaining,
			reasons,
			blockedReason:
				maxFeats === 0
					? 'No feat selections available. Choose Variant Human or reach level 4.'
					: null,
		};
	}
}

export function serializeCharacter(character) {
	return CharacterSerializer.serialize(character);
}
