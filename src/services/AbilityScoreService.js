import { CharacterManager } from '../app/CharacterManager.js';
import {
	ABILITY_ABBREVIATIONS,
	attAbvToFull,
	getAbilityModNumber,
	numberToWords,
} from '../lib/5eToolsParser.js';
import DataNormalizer from '../lib/DataNormalizer.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';

/** Manages D&D character ability scores. */
class AbilityScoreService {
	constructor() {
		// Use canonical lowercase abbreviations (str, dex, con, int, wis, cha) from 5eToolsParser
		this._allAbilities = [...ABILITY_ABBREVIATIONS];

		// Point buy costs for ability scores
		this._pointBuyCosts = new Map([
			[8, 0],
			[9, 1],
			[10, 2],
			[11, 3],
			[12, 4],
			[13, 5],
			[14, 7],
			[15, 9],
		]);

		// Standard array values that can be assigned to abilities
		this._standardArrayValues = [15, 14, 13, 12, 10, 8];
		this._assignedStandardArrayValues = {};

		// Map to store ability choices
		this.abilityChoices = new Map();

		// Subscribe to character selection (when a character is loaded or selected)
		eventBus.on(
			EVENTS.CHARACTER_SELECTED,
			this._handleCharacterChanged.bind(this),
		);
	}

	_handleCharacterChanged() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Reset assigned values when character changes
		this._assignedStandardArrayValues = {};

		// Rehydrate stored racial ability choices into the manager/map
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

		// Initialize any ability-related state for the new character
		this._notifyAbilityScoresChanged();
	}

	normalizeAbilityName(abilityName) {
		if (typeof abilityName !== 'string') {
			console.warn(
				'AbilityScoreService',
				`Expected string for ability name but got ${typeof abilityName}`,
				{ abilityName },
			);
			return '';
		}
		return abilityName ? DataNormalizer.normalizeForLookup(abilityName) : '';
	}

	getAllAbilities() {
		return [...this._allAbilities];
	}

	getBaseScore(ability) {
		const normalizedAbility = this.normalizeAbilityName(ability);
		const character = CharacterManager.getCurrentCharacter();

		if (!character) return 8; // Default base score

		// Get the ability score from the character
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

		return 8; // Default fallback
	}

	getTotalScore(ability) {
		const normalizedAbility = this.normalizeAbilityName(ability);
		const character = CharacterManager.getCurrentCharacter();

		if (!character) return 8;

		// Start with base score
		let totalScore = this.getBaseScore(normalizedAbility);

		// Add racial bonuses
		if (
			character.race?.abilityBonuses &&
			typeof character.race.abilityBonuses[normalizedAbility] === 'number'
		) {
			totalScore += character.race.abilityBonuses[normalizedAbility];
		}

		// Add class bonuses
		// Note: ability bonuses are stored in character.abilityBonuses, not in class object

		// Add all other ability bonuses from any source
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
		return formatModifier(mod);
	}

	updateAbilityScore(ability, score) {
		const normalizedAbility = this.normalizeAbilityName(ability);
		const character = CharacterManager.getCurrentCharacter();

		if (!character) {
			console.error(
				'AbilityScoreService',
				'No character selected for ability score update',
			);
			return;
		}

		// Initialize ability scores object if it doesn't exist
		if (!character.abilityScores) {
			character.abilityScores = {};
		}

		// Store directly as a number rather than as an object with score property
		character.abilityScores[normalizedAbility] = Number.parseInt(score, 10);

		// Notify listeners about the change
		this._notifyAbilityScoresChanged();
	}

	getPointCost(score) {
		const cost = getPointBuyCost(score);
		return cost > 0 || score === 8 ? cost : null;
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

		// Check if the value is in the standard array
		if (!this._standardArrayValues.includes(value)) {
			console.error(
				'AbilityScoreService',
				`Value ${value} is not in the standard array`,
			);
			return false;
		}

		// Check if this value is already assigned to another ability
		if (
			this.isStandardArrayValueAssigned(value) &&
			this._assignedStandardArrayValues[normalizedAbility] !== value
		) {
			console.error(
				'AbilityScoreService',
				`Value ${value} is already assigned to another ability`,
			);
			return false;
		}

		// If this ability already has a value, remove it from assignedValues
		if (this._assignedStandardArrayValues[normalizedAbility]) {
			// No need to do anything, it will be overwritten
		}

		// Assign the value
		this._assignedStandardArrayValues[normalizedAbility] = value;

		// Update the ability score
		this.updateAbilityScore(normalizedAbility, value);

		return true;
	}

	updateAssignedStandardArrayValues() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Clear and update the assigned values set
		this._assignedStandardArrayValues = {};

		// Track which values from the standard array are being used
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

		const event = new CustomEvent('abilityScoresChanged', {
			detail: { character },
		});
		document.dispatchEvent(event);
	}

	setRacialAbilityChoices(choices) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character?.race) {
			console.error(
				'AbilityScoreService',
				'No character or race selected for ability choice',
			);
			return;
		}

		// Normalize incoming choices and clear current state
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

		// Persist normalized choices on the character
		character.race.abilityChoices = normalizedChoices;

		// Re-apply bonuses and cached selections from the saved choices
		for (const choice of normalizedChoices) {
			if (!choice.ability) continue;
			this.abilityChoices.set(choice.index, choice.ability);
			character.addAbilityBonus?.(choice.ability, choice.value, choice.source);
		}

		// Notify listeners about the change
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

		// Group bonuses by source for each ability
		for (const ability of this._allAbilities) {
			const bonuses = character.abilityBonuses?.[ability] || [];
			if (bonuses.length === 0) continue;

			// Group by source
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

		// Get all ability-related pending choices
		const pendingChoices = character
			.getPendingAbilityChoices()
			.filter((choice) => {
				return choice.type === 'ability';
			});

		// Ensure each choice has all required fields
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

		// Get all pending choices
		const pendingChoices = character.getPendingAbilityChoices?.() || [];
		const currentChoice = pendingChoices[currentChoiceIndex];

		// Collect all selected abilities except the current one
		for (const [index, ability] of this.abilityChoices.entries()) {
			if (index !== currentChoiceIndex && ability) {
				selectedAbilities.add(ability);
			}
		}

		// Get abilities that already have racial bonuses
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

		// For choices with source restrictions, filter to only allowed abilities
		let availableAbilities = allAbilities;
		if (currentChoice?.choices && currentChoice.choices.length > 0) {
			availableAbilities = currentChoice.choices.map((a) => {
				// Convert abbreviated ability names to full lowercase names
				const fullName = attAbvToFull(a);
				return fullName ? fullName.toLowerCase() : a;
			});
		}

		// Return abilities that:
		// 1. Haven't been selected by other choices
		// 2. Don't already have racial bonuses (if racial choice)
		// 3. Are in the allowed choices list for this choice
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
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Clear the previous ability bonus for this specific choice index
		const previousAbility = this.abilityChoices.get(choiceIndex);
		if (previousAbility) {
			character.removeAbilityBonus?.(previousAbility, bonus, source);
		}

		// Update stored choices
		if (ability) {
			const normalizedSource = source?.includes('Choice')
				? source
				: `${source || 'Race'} Choice`;
			this.abilityChoices.set(choiceIndex, ability);
			character.addAbilityBonus?.(ability, bonus, normalizedSource);
		} else {
			this.abilityChoices.delete(choiceIndex);
		}

		// Persist the selection on the character for reloads
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

			// Remove any empty slots to keep the array compact
			character.race.abilityChoices =
				character.race.abilityChoices.filter(Boolean);
		}

		// Notify listeners of the change
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

	/** Resets ability score method-specific state when switching methods. */
	resetAbilityScoreMethod() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Initialize variant rules if needed
		if (!character.variantRules) {
			character.variantRules = {};
		}

		const method = character.variantRules.abilityScoreMethod;

		// Reset state based on the method
		if (method === 'standardArray') {
			// For standard array, reset assignments
			this._assignedStandardArrayValues = {};

			// Traditional D&D order assignment - always use this for consistency
			const traditionalOrder = {
				strength: 15, // STR: 15
				dexterity: 14, // DEX: 14
				constitution: 13, // CON: 13
				intelligence: 12, // INT: 12
				wisdom: 10, // WIS: 10
				charisma: 8, // CHA: 8
			};

			// Always apply the traditional order for consistency and predictability
			for (const [ability, value] of Object.entries(traditionalOrder)) {
				// Update the character's ability score
				this.updateAbilityScore(ability, value);

				// Record the assignment
				this._assignedStandardArrayValues[ability] = value;
			}
		} else if (method === 'pointBuy') {
			// For point buy, ensure scores are within valid range (8-15)
			for (const ability of this._allAbilities) {
				const score = character.abilityScores?.[ability];

				// If score is out of range, set to default
				if (score < 8 || score > 15) {
					this.updateAbilityScore(ability, 8);
				}
			}
		}

		// Notify listeners about the change
		this._notifyAbilityScoresChanged();
	}
}

//=============================================================================
// Helper Functions from AbilityCalculator.js
//=============================================================================

/** All ability score abbreviations in order */
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Formats an ability modifier with proper sign (e.g., "+2", "-1"). */
export function formatModifier(modifier) {
	if (typeof modifier !== 'number' || Number.isNaN(modifier)) {
		return '+0';
	}
	if (modifier >= 0) {
		return `+${modifier}`;
	}
	return `${modifier}`;
}

const POINT_BUY_COSTS = new Map([
	[8, 0],
	[9, 1],
	[10, 2],
	[11, 3],
	[12, 4],
	[13, 5],
	[14, 7],
	[15, 9],
]);

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_BUDGET = 27;

export function getPointBuyCost(score) {
	return POINT_BUY_COSTS.get(score) || 0;
}

export function calculatePointBuyTotal(scores) {
	if (!scores || typeof scores !== 'object') {
		return 0;
	}

	let total = 0;
	for (const score of Object.values(scores)) {
		if (typeof score === 'number') {
			total += getPointBuyCost(score);
		}
	}
	return total;
}

export function calculateRemainingPoints(scores, budget = POINT_BUY_BUDGET) {
	return budget - calculatePointBuyTotal(scores);
}

export function validatePointBuyChange(
	currentScores,
	ability,
	newScore,
	budget = POINT_BUY_BUDGET,
) {
	// Score must be in valid range
	if (newScore < 8 || newScore > 15) {
		return false;
	}

	// Calculate what the total would be with the new score
	const testScores = { ...currentScores, [ability]: newScore };
	const totalCost = calculatePointBuyTotal(testScores);

	return totalCost <= budget;
}

export function validateStandardArray(assignments) {
	const result = {
		isValid: true,
		errors: [],
	};

	if (!assignments || typeof assignments !== 'object') {
		result.isValid = false;
		result.errors.push('Invalid assignments object');
		return result;
	}

	const usedValues = new Set();
	const assignedValues = Object.values(assignments).filter(
		(v) => v !== null && v !== undefined,
	);

	// Check for duplicate values
	for (const value of assignedValues) {
		if (usedValues.has(value)) {
			result.isValid = false;
			result.errors.push(`Value ${value} assigned to multiple abilities`);
		}
		usedValues.add(value);
	}

	// Check if all values are from the standard array
	for (const value of assignedValues) {
		if (!STANDARD_ARRAY.includes(value)) {
			result.isValid = false;
			result.errors.push(`Value ${value} is not in the standard array`);
		}
	}

	return result;
}

export function calculateTotalAbilityScore(baseScore, racialBonus = 0) {
	return (baseScore || 0) + (racialBonus || 0);
}

//=============================================================================
// Helper Functions from AbilityScoreUtils.js
//=============================================================================

function normalizeAbilityNameHelper(abb) {
	// attAbvToFull returns capitalized names (e.g., 'Strength')
	// We need lowercase for internal storage (e.g., 'strength')
	const fullName = attAbvToFull(abb);
	return fullName ? fullName.toLowerCase() : abb;
}

/** Parse race/subrace ability data into fixed bonuses and choices. */
export function getRaceAbilityData(race, subrace) {
	const fixed = [];
	const choices = [];

	// Process race abilities
	if (race?.ability && Array.isArray(race.ability)) {
		for (const entry of race.ability) {
			// Fixed bonuses
			for (const ability of ABILITIES) {
				if (entry[ability] && !entry.choose) {
					fixed.push({
						ability: normalizeAbilityNameHelper(ability),
						value: entry[ability],
						source: 'race',
					});
				}
			}

			// Ability choices
			if (entry.choose) {
				choices.push({
					count: entry.choose.count || 1,
					amount: entry.choose.amount || 1,
					from: (entry.choose.from || ABILITIES).map(
						normalizeAbilityNameHelper,
					),
					source: 'race',
				});
			}
		}
	}

	// Process subrace abilities
	if (subrace?.ability && Array.isArray(subrace.ability)) {
		for (const entry of subrace.ability) {
			// Fixed bonuses
			for (const ability of ABILITIES) {
				if (entry[ability] && !entry.choose) {
					fixed.push({
						ability: normalizeAbilityNameHelper(ability),
						value: entry[ability],
						source: 'subrace',
					});
				}
			}

			// Ability choices
			if (entry.choose) {
				choices.push({
					count: entry.choose.count || 1,
					amount: entry.choose.amount || 1,
					from: (entry.choose.from || ABILITIES).map(
						normalizeAbilityNameHelper,
					),
					source: 'subrace',
				});
			}
		}
	}

	return { fixed, choices };
}

/** Parse ability array into text and structured data. */
export function getAbilityData(abilityArray, options = {}) {
	const { isOnlyShort = false, isCurrentLineage = false } = options;

	if (
		!abilityArray ||
		!Array.isArray(abilityArray) ||
		abilityArray.length === 0
	) {
		return {
			asText: '',
			asTextShort: '',
			asCollection: [],
		};
	}

	const asCollection = [];
	const asTextParts = [];
	const asTextShortParts = [];

	// Process each ability entry
	for (const abilityEntry of abilityArray) {
		// Handle "choose" entries (e.g., Variant Human, Half-Elf)
		if (abilityEntry.choose) {
			const processed = processChoose(abilityEntry.choose);
			asCollection.push({ choose: processed.data });
			asTextParts.push(processed.text);
			asTextShortParts.push(processed.textShort);
			continue;
		}

		// Handle fixed ability scores
		const fixed = processFixed(abilityEntry);
		if (fixed.data) {
			asCollection.push(fixed.data);
			if (fixed.text) asTextParts.push(fixed.text);
			if (fixed.textShort) asTextShortParts.push(fixed.textShort);
		}
	}

	// Handle lineage special case (Tasha's Custom Lineage)
	if (isCurrentLineage && asCollection.length === 0) {
		return {
			asText: 'Choose one ability score. That score increases by 2.',
			asTextShort: 'Choose one +2',
			asCollection: [{ choose: { from: ABILITIES, count: 1, amount: 2 } }],
		};
	}

	// Combine parts
	const asText =
		asTextParts.length > 0 ? `${capitalizeFirst(asTextParts.join(', '))}.` : '';
	const asTextShort = asTextShortParts.join(', ');

	return {
		asText: isOnlyShort ? '' : asText,
		asTextShort,
		asCollection,
	};
}

function processChoose(choose) {
	const amount = choose.amount || 1;
	const count = choose.count || 1;
	const weighted = choose.weighted;

	// Handle weighted choices (rare)
	if (weighted) {
		const weights = Object.entries(weighted.weights).map(
			([ability, value]) => `${attAbvToFull(ability)} +${value}`,
		);
		return {
			data: { choose: { weighted: weighted.weights, from: choose.from } },
			text: `increase ${weights.join(' or ')}`,
			textShort: weights.join(' or '),
		};
	}

	// Handle standard choices
	const from = choose.from || ABILITIES;

	// Build text description
	let text;
	let textShort;

	if (count === 1) {
		// Choose one ability
		if (from.length === ABILITIES.length) {
			text = `increase one ability score of your choice by ${amount}`;
			textShort = `choose one +${amount}`;
		} else {
			const abilities = from.map(attAbvToFull).join(' or ');
			text = `increase your ${abilities} score by ${amount}`;
			// Use full name format: "Strength or Dexterity +2"
			const fullNames = from.map(attAbvToFull).join(' or ');
			textShort = `${fullNames} +${amount}`;
		}
	} else {
		// Choose multiple abilities
		if (from.length === ABILITIES.length) {
			text = `increase ${numberToWords(count)} ability ${count === 1 ? 'score' : 'scores'} of your choice by ${amount}`;
			textShort = `choose ${numberToWords(count)} +${amount}`;
		} else {
			const abilities = from.map(attAbvToFull).join(', ');
			text = `increase ${numberToWords(count)} of the following by ${amount}: ${abilities}`;
			// Use full name format for choices
			const fullNames = from.map(attAbvToFull).join(', ');
			textShort = `choose ${numberToWords(count)} from ${fullNames} +${amount}`;
		}
	}

	return {
		data: { from, count, amount },
		text,
		textShort,
	};
}

function processFixed(abilityEntry) {
	const fixed = {};
	const parts = [];
	const shortParts = [];

	for (const ability of ABILITIES) {
		if (abilityEntry[ability]) {
			const value = abilityEntry[ability];
			fixed[ability] = value;
			parts.push(`your ${attAbvToFull(ability)} score increases by ${value}`);
			// Use full name format for display: "Strength +2"
			shortParts.push(`${attAbvToFull(ability)} +${value}`);
		}
	}

	if (parts.length === 0) {
		return { data: null, text: '', textShort: '' };
	}

	return {
		data: fixed,
		text: parts.join(', and '),
		textShort: shortParts.join(', '),
	};
}

/** Get only the fixed ability improvements (no choices). */
export function getFixedAbilities(abilityArray) {
	if (!abilityArray || !Array.isArray(abilityArray)) {
		return {};
	}

	const fixed = {};

	for (const entry of abilityArray) {
		// Skip choose entries
		if (entry.choose) continue;

		// Collect fixed scores
		for (const ability of ABILITIES) {
			if (entry[ability]) {
				fixed[ability] = (fixed[ability] || 0) + entry[ability];
			}
		}
	}

	return fixed;
}

/** Get ability score choices for UI selection. */
export function getAbilityChoices(abilityArray) {
	if (!abilityArray || !Array.isArray(abilityArray)) {
		return [];
	}

	const choices = [];

	for (const entry of abilityArray) {
		if (entry.choose) {
			const choose = entry.choose;
			choices.push({
				from: choose.from || ABILITIES,
				count: choose.count || 1,
				amount: choose.amount || 1,
				weighted: choose.weighted,
			});
		}
	}

	return choices;
}

/** Validate ability score selections against race requirements. */
export function validateAbilitySelections(abilityArray, selections) {
	const errors = [];
	const final = { ...getFixedAbilities(abilityArray) };
	const choices = getAbilityChoices(abilityArray);

	// No choices to validate
	if (choices.length === 0) {
		return { valid: true, errors: [], final };
	}

	// Validate each choice
	for (let i = 0; i < choices.length; i++) {
		const choice = choices[i];
		const selected = selections[`choice_${i}`] || [];

		// Check count
		if (selected.length !== choice.count) {
			errors.push(
				`Must select exactly ${choice.count} ${choice.count === 1 ? 'ability' : 'abilities'} for choice ${i + 1}`,
			);
			continue;
		}

		// Check valid abilities
		const invalid = selected.filter(
			(ability) => !choice.from.includes(ability),
		);
		if (invalid.length > 0) {
			errors.push(`Invalid ability selection: ${invalid.join(', ')}`);
			continue;
		}

		// Check duplicates within this choice
		const unique = new Set(selected);
		if (unique.size !== selected.length) {
			errors.push(`Cannot select the same ability twice in choice ${i + 1}`);
			continue;
		}

		// Apply selections
		for (const ability of selected) {
			if (choice.weighted) {
				final[ability] =
					(final[ability] || 0) + choice.weighted.weights[ability];
			} else {
				final[ability] = (final[ability] || 0) + choice.amount;
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		final,
	};
}

function capitalizeFirst(str) {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1);
}

// Create and export singleton instance
export const abilityScoreService = new AbilityScoreService();
