import { CharacterManager } from '../app/CharacterManager.js';
import {
	ABILITY_ABBREVIATIONS,
	attAbvToFull,
	formatModifierNumber,
	getAbilityModNumber,
} from '../lib/5eToolsParser.js';
import {
	calculatePointBuyTotal,
	getPointBuyCost,
	POINT_BUY_BUDGET,
} from '../lib/AbilityScoreUtils.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { POINT_BUY_COSTS, STANDARD_ARRAY } from '../lib/GameRules.js';
import TextProcessor from '../lib/TextProcessor.js';
import {
	handleAbilityChoiceArgsSchema,
	updateAbilityScoreArgsSchema,
	validateInput,
} from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

class AbilityScoreService extends BaseDataService {
	constructor() {
		super({ loggerScope: 'AbilityScoreService' });

		// Use canonical lowercase abbreviations (str, dex, con, int, wis, cha) from 5eToolsParser
		this._allAbilities = [...ABILITY_ABBREVIATIONS];

		this._pointBuyCosts = POINT_BUY_COSTS;

		this._standardArrayValues = [...STANDARD_ARRAY];
		this._assignedStandardArrayValues = {};

		this.abilityChoices = new Map();

		this._handleCharacterChangedBound = this._handleCharacterChanged.bind(this);
		this._trackListener(EVENTS.CHARACTER_SELECTED, this._handleCharacterChangedBound);
	}

	_handleCharacterChanged() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		this._assignedStandardArrayValues = {};

		const abilityChoices = Array.isArray(character.race?.abilityChoices)
			? character.race.abilityChoices
			: character.race?.abilityChoices &&
				typeof character.race.abilityChoices === 'object'
				? Object.entries(character.race.abilityChoices)
					.sort(([a], [b]) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
					.map(([, choice]) => choice)
					.filter(Boolean)
				: [];

		if (abilityChoices.length > 0) {
			this.setRacialAbilityChoices(abilityChoices);
		}

		this._notifyAbilityScoresChanged();
	}

	normalizeAbilityName(abilityName) {
		if (typeof abilityName !== 'string') {
			console.warn(
				'[AbilityScoreService]',
				`Expected string for ability name but got ${typeof abilityName}`,
				{ abilityName },
			);
			return '';
		}

		const trimmedName = abilityName.trim();
		if (!trimmedName) return '';

		const fullName = attAbvToFull(trimmedName);
		return TextProcessor.normalizeForLookup(fullName);
	}

	getAllAbilities() {
		return [...this._allAbilities];
	}

	getBaseScore(ability) {
		const normalizedAbility = this.normalizeAbilityName(ability);
		const character = CharacterManager.getCurrentCharacter();

		if (!character) return 8;

		const abilityScore = character.abilityScores?.[normalizedAbility];

		// Handle both formats: direct number or object with score property
		if (abilityScore === undefined) {
			return 8;
		}

		if (typeof abilityScore === 'number') {
			return abilityScore;
		}

		if (abilityScore && typeof abilityScore.score === 'number') {
			return abilityScore.score;
		}

		return 8;
	}

	getTotalScore(ability) {
		const normalizedAbility = this.normalizeAbilityName(ability);
		const character = CharacterManager.getCurrentCharacter();

		if (!character) return 8;

		let totalScore = this.getBaseScore(normalizedAbility);

		if (
			character.race?.abilityBonuses &&
			typeof character.race.abilityBonuses[normalizedAbility] === 'number'
		) {
			totalScore += character.race.abilityBonuses[normalizedAbility];
		}

		if (
			character.abilityBonuses &&
			Array.isArray(character.abilityBonuses[normalizedAbility])
		) {
			const bonuses = character.abilityBonuses[normalizedAbility];
			for (const bonus of bonuses) {
				if (typeof bonus.value === 'number') {
					totalScore += bonus.value;
				}
			}
		}
		return totalScore;
	}

	getModifier(ability) {
		const totalScore = this.getTotalScore(ability);
		return getAbilityModNumber(totalScore);
	}

	getModifierString(ability) {
		const mod = this.getModifier(ability);
		return formatModifierNumber(mod);
	}

	updateAbilityScore(ability, score) {
		const validated = validateInput(
			updateAbilityScoreArgsSchema,
			{ ability, score },
			'Invalid parameters for updateAbilityScore',
		);

		const normalizedAbility = this.normalizeAbilityName(validated.ability);
		const character = CharacterManager.getCurrentCharacter();

		if (!character) {
			console.error(
				'[AbilityScoreService]',
				'No character selected for ability score update',
			);
			return;
		}

		if (!character.abilityScores) {
			character.abilityScores = {};
		}

		// Store directly as a number rather than as an object with score property
		character.abilityScores[normalizedAbility] = validated.score;

		this._notifyAbilityScoresChanged();
	}

	getPointCost(score) {
		const cost = getPointBuyCost(score);
		return cost > 0 || score === 8 ? cost : null;
	}

	getPointCostClass(cost) {
		if (cost >= 7) return 'high';
		if (cost >= 4) return 'medium';
		return 'low';
	}

	getValidPointBuyScores() {
		return Array.from(this._pointBuyCosts.keys()).sort((a, b) => a - b);
	}

	getUsedPoints() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return 0;

		const scores = {};
		for (const ability of this._allAbilities) {
			scores[ability] = this.getBaseScore(ability);
		}

		return calculatePointBuyTotal(scores);
	}

	getMaxPoints() {
		return POINT_BUY_BUDGET;
	}

	getRemainingPoints() {
		return this.getMaxPoints() - this.getUsedPoints();
	}

	getStandardArrayValues() {
		return [...this._standardArrayValues];
	}

	isStandardArrayValueAssigned(value) {
		return Object.values(this._assignedStandardArrayValues).includes(value);
	}

	assignStandardArrayValue(ability, value) {
		const normalizedAbility = this.normalizeAbilityName(ability);

		if (!this._standardArrayValues.includes(value)) {
			console.error(
				'[AbilityScoreService]',
				`Value ${value} is not in the standard array`,
			);
			return false;
		}

		if (
			this.isStandardArrayValueAssigned(value) &&
			this._assignedStandardArrayValues[normalizedAbility] !== value
		) {
			console.error(
				'[AbilityScoreService]',
				`Value ${value} is already assigned to another ability`,
			);
			return false;
		}

		this._assignedStandardArrayValues[normalizedAbility] = value;

		this.updateAbilityScore(normalizedAbility, value);

		return true;
	}

	updateAssignedStandardArrayValues() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		this._assignedStandardArrayValues = {};

		for (const ability of this._allAbilities) {
			const value = character.abilityScores?.[ability];
			if (this._standardArrayValues.includes(value)) {
				this._assignedStandardArrayValues[ability] = value;
			}
		}
	}

	_notifyAbilityScoresChanged() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		eventBus.emit(EVENTS.ABILITY_SCORES_CHANGED, { character });
	}

	setRacialAbilityChoices(choices) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character?.race) {
			console.error(
				'[AbilityScoreService]',
				'No character or race selected for ability choice',
			);
			return;
		}

		this.abilityChoices.clear();
		const normalizedChoices = Array.isArray(choices)
			? choices.filter(Boolean).map((choice, index) => {
				const ability = this.normalizeAbilityName(
					choice.ability || choice.abilityScore,
				);
				const value = Number.isFinite(choice.value)
					? choice.value
					: Number.isFinite(choice.amount)
						? choice.amount
						: 1;
				const source = choice.source?.includes('Choice')
					? choice.source
					: `${choice.source || 'Race'} Choice`;
				return {
					ability,
					value,
					source,
					index: Number.isFinite(choice.index) ? choice.index : index,
				};
			})
			: [];

		character.race.abilityChoices = normalizedChoices;

		for (const choice of normalizedChoices) {
			if (!choice.ability) continue;
			this.abilityChoices.set(choice.index, choice.ability);
			character.addAbilityBonus?.(choice.ability, choice.value, choice.source);
		}

		this._notifyAbilityScoresChanged();
	}

	clearStoredChoices() {
		this.abilityChoices.clear();
	}

	getBonusGroups() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) {
			return new Map();
		}

		const groups = new Map();

		for (const ability of this._allAbilities) {
			const fullName = attAbvToFull(ability).toLowerCase();
			const bonuses = character.abilityBonuses?.[fullName] || [];
			if (bonuses.length === 0) continue;

			for (const bonus of bonuses) {
				const source = bonus.source;
				if (!groups.has(source)) {
					groups.set(source, new Map());
				}
				const sourceGroup = groups.get(source);
				sourceGroup.set(ability, bonus.value);
			}
		}

		return groups;
	}

	getPendingChoices() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character || !character.getPendingAbilityChoices) {
			return [];
		}

		const pendingChoices = character
			.getPendingAbilityChoices()
			.filter((choice) => {
				return choice.type === 'ability';
			});

		const formattedChoices = pendingChoices.map((choice) => ({
			type: 'ability',
			amount: choice.amount || 1,
			count: choice.count || 1,
			choices: choice.choices || choice.from || [],
			source: choice.source || 'Race Choice',
		}));

		return formattedChoices;
	}

	getAvailableAbilities(currentChoiceIndex) {
		const allAbilities = [...this._allAbilities];
		const selectedAbilities = new Set();
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return allAbilities;

		const pendingChoices = character.getPendingAbilityChoices?.() || [];
		const currentChoice = pendingChoices[currentChoiceIndex];

		for (const [index, ability] of this.abilityChoices.entries()) {
			if (index !== currentChoiceIndex && ability) {
				selectedAbilities.add(ability);
			}
		}

		const abilitiesWithRacialBonuses = new Set();
		for (const ability of this._allAbilities) {
			const bonuses = character.abilityBonuses?.[ability] || [];
			for (const bonus of bonuses) {
				// Check if the bonus is from a racial source (Race, Subrace, but not Race Choice)
				if (
					(bonus.source === 'Race' || bonus.source === 'Subrace') &&
					!bonus.source.includes('Choice')
				) {
					abilitiesWithRacialBonuses.add(ability);
				}
			}
		}

		let availableAbilities = allAbilities;
		if (currentChoice?.choices && currentChoice.choices.length > 0) {
			availableAbilities = currentChoice.choices.map((a) => {
				const fullName = attAbvToFull(a);
				return fullName ? fullName.toLowerCase() : a;
			});
		}

		// Filter to abilities not already selected and not having racial bonuses
		return availableAbilities.filter(
			(ability) =>
				!selectedAbilities.has(ability) &&
				!(
					currentChoice?.source?.startsWith('Race') &&
					abilitiesWithRacialBonuses.has(ability)
				),
		);
	}

	handleAbilityChoice(ability, choiceIndex, bonus, source) {
		const validated = validateInput(
			handleAbilityChoiceArgsSchema,
			{ ability, choiceIndex, bonus, source },
			'Invalid parameters for handleAbilityChoice',
		);

		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		ability = validated.ability;
		choiceIndex = validated.choiceIndex;
		bonus = validated.bonus;
		source = validated.source;

		const previousAbility = this.abilityChoices.get(choiceIndex);
		if (previousAbility) {
			character.removeAbilityBonus?.(previousAbility, bonus, source);
		}

		if (ability) {
			const normalizedSource = source?.includes('Choice')
				? source
				: `${source || 'Race'} Choice`;
			this.abilityChoices.set(choiceIndex, ability);
			character.addAbilityBonus?.(ability, bonus, normalizedSource);
		} else {
			this.abilityChoices.delete(choiceIndex);
		}

		if (character.race) {
			if (!Array.isArray(character.race.abilityChoices)) {
				character.race.abilityChoices = [];
			}

			const normalizedSource = source?.includes('Choice')
				? source
				: `${source || 'Race'} Choice`;

			if (ability) {
				character.race.abilityChoices[choiceIndex] = {
					ability,
					value: bonus,
					source: normalizedSource,
					index: choiceIndex,
				};
			} else {
				character.race.abilityChoices[choiceIndex] = null;
			}

			character.race.abilityChoices =
				character.race.abilityChoices.filter(Boolean);
		}

		this._notifyAbilityScoresChanged();
	}

	get maxScore() {
		return 20; // D&D 5e maximum ability score (without magical items)
	}

	get minScore() {
		return 3; // D&D 5e minimum ability score
	}

	get maxPoints() {
		return 27; // Standard D&D 5e point buy limit
	}

	getAvailableStandardArrayValues() {
		const allValues = [...this._standardArrayValues];
		const usedValues = Object.values(this._assignedStandardArrayValues);

		const availableValues = allValues.filter(
			(value) => !usedValues.includes(value),
		);
		return availableValues;
	}

	get assignedStandardValues() {
		return Object.entries(this._assignedStandardArrayValues);
	}

	resetAbilityScoreMethod() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Initialize variant rules if needed
		if (!character.variantRules) {
			character.variantRules = {};
		}

		const method = character.variantRules.abilityScoreMethod;

		if (method === 'standardArray') {
			this._assignedStandardArrayValues = {};

			const traditionalOrder = {
				strength: 15, // STR: 15
				dexterity: 14, // DEX: 14
				constitution: 13, // CON: 13
				intelligence: 12, // INT: 12
				wisdom: 10, // WIS: 10
				charisma: 8, // CHA: 8
			};

			for (const [ability, value] of Object.entries(traditionalOrder)) {
				this.updateAbilityScore(ability, value);
				this._assignedStandardArrayValues[ability] = value;
			}
		} else if (method === 'pointBuy') {
			for (const ability of this._allAbilities) {
				const score = character.abilityScores?.[ability];

				if (score < 8 || score > 15) {
					this.updateAbilityScore(ability, 8);
				}
			}
		}

		this._notifyAbilityScoresChanged();
	}

	getRacialBonus(ability, raceData, subraceData, abilityChoices = []) {
		const normalizedAbility = this.normalizeAbilityName(ability);
		const shortName = normalizedAbility.substring(0, 3);

		const abilityArray = [
			...(raceData?.ability || []),
			...(subraceData?.ability || []),
		];

		if (abilityArray.length === 0 && abilityChoices.length === 0) return 0;

		let bonus = 0;
		for (const abilityEntry of abilityArray) {
			if (!abilityEntry) continue;

			if (typeof abilityEntry === 'object') {
				if (abilityEntry[shortName]) {
					bonus += abilityEntry[shortName];
				}
			}
		}

		for (const choice of abilityChoices) {
			if (choice && choice.ability === normalizedAbility) {
				bonus += choice.amount || 1;
			}
		}

		return bonus;
	}
}

// Re-export helpers from AbilityScoreUtils for backwards compatibility
export {
	calculatePointBuyTotal,
	formatModifier,
	getAbilityChoices,
	getAbilityData,
	getFixedAbilities,
	getPointBuyCost,
	getRaceAbilityData,
	POINT_BUY_BUDGET,
	STANDARD_ARRAY,
	validateAbilitySelections
} from '../lib/AbilityScoreUtils.js';

export const abilityScoreService = new AbilityScoreService();
