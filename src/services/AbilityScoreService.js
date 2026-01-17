import { CharacterManager } from '../app/CharacterManager.js';
import { attAbvToFull, getAbilityModNumber, numberToWords } from '../lib/5eToolsParser.js';
import DataNormalizer from '../lib/DataNormalizer.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';

/** Manages D&D character ability scores. */
class AbilityScoreService {
	constructor() {
		this._allAbilities = [
			'strength',
			'dexterity',
			'constitution',
			'intelligence',
			'wisdom',
			'charisma',
		];

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

	/**
	 * Handler for character change events
	 * @private
	 */
	_handleCharacterChanged() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Reset assigned values when character changes
		this._assignedStandardArrayValues = {};

		// Rehydrate stored racial ability choices into the manager/map
		if (Array.isArray(character.race?.abilityChoices)) {
			this.setRacialAbilityChoices(character.race.abilityChoices);
		}

		// Initialize any ability-related state for the new character
		this._notifyAbilityScoresChanged();
	}

	/**
	 * Normalizes an ability name to lowercase
	 * @param {string} abilityName - The ability name to normalize
	 * @returns {string} - The normalized ability name
	 */
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

	/**
	 * Gets a list of all abilities
	 * @returns {string[]} - Array of ability names
	 */
	getAllAbilities() {
		return [...this._allAbilities];
	}

	/**
	 * Gets the base score for an ability
	 * @param {string} ability - The ability name
	 * @returns {number} - The base ability score
	 */
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

	/**
	 * Gets the total score for an ability including all bonuses
	 * @param {string} ability - The ability name
	 * @returns {number} - The total ability score
	 */
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

	/**
	 * Calculates the ability modifier based on the total score
	 * @param {string} ability - The ability name
	 * @returns {number} - The ability modifier
	 */
	getModifier(ability) {
		const totalScore = this.getTotalScore(ability);
		return getAbilityModNumber(totalScore);
	}

	/**
	 * Gets modifier string (e.g., "+3" or "-1")
	 * @param {string} ability - The ability name
	 * @returns {string} - The formatted modifier string
	 */
	getModifierString(ability) {
		const mod = this.getModifier(ability);
		return formatModifier(mod);
	}

	/**
	 * Updates the ability score for a character
	 * @param {string} ability - The ability name
	 * @param {number} score - The new score value
	 */
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

	/**
	 * Gets the point cost for a specific ability score
	 * @param {number} score - The ability score
	 * @returns {number|null} - The point cost or null if invalid
	 */
	getPointCost(score) {
		const cost = getPointBuyCost(score);
		return cost > 0 || score === 8 ? cost : null;
	}

	/**
	 * Gets an array of valid scores for point buy
	 * @returns {number[]} - Array of valid scores
	 */
	getValidPointBuyScores() {
		return Array.from(this._pointBuyCosts.keys()).sort((a, b) => a - b);
	}

	/**
	 * Calculates total points used in point buy
	 * @returns {number} - Total points used
	 */
	getUsedPoints() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return 0;

		const scores = {};
		for (const ability of this._allAbilities) {
			scores[ability] = this.getBaseScore(ability);
		}

		return calculatePointBuyTotal(scores);
	}

	/**
	 * Gets the maximum points allowed for point buy
	 * @returns {number} - Maximum point buy points
	 */
	getMaxPoints() {
		return POINT_BUY_BUDGET;
	}

	/**
	 * Gets remaining points for point buy
	 * @returns {number} - Remaining point buy points
	 */
	getRemainingPoints() {
		return this.getMaxPoints() - this.getUsedPoints();
	}

	/**
	 * Gets the standard array values
	 * @returns {number[]} - The standard array values
	 */
	getStandardArrayValues() {
		return [...this._standardArrayValues];
	}

	/**
	 * Checks if a standard array value is already assigned
	 * @param {number} value - The value to check
	 * @returns {boolean} - True if already assigned
	 */
	isStandardArrayValueAssigned(value) {
		return Object.values(this._assignedStandardArrayValues).includes(value);
	}

	/**
	 * Assigns a standard array value to an ability
	 * @param {string} ability - The ability name
	 * @param {number} value - The standard array value
	 * @returns {boolean} - True if assignment was successful
	 */
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

	/**
	 * Updates the tracking of assigned standard array values based on current character
	 */
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

	/**
	 * Notify listeners that ability scores have changed
	 * @private
	 */
	_notifyAbilityScoresChanged() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const event = new CustomEvent('abilityScoresChanged', {
			detail: { character },
		});
		document.dispatchEvent(event);
	}

	/**
	 * Sets ability score bonuses from racial choices
	 * @param {AbilityChoice[]} choices - Array of ability choices
	 */
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

	/**
	 * Clears the manager's stored ability choices.
	 */
	clearStoredChoices() {
		this.abilityChoices.clear();
	}

	/**
	 * Get ability score bonuses grouped by source
	 * @returns {Map<string, Map<string, number>>} Map of bonus groups by source
	 */
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

	/**
	 * Get pending ability score choices that need to be made
	 * @returns {Array<Object>} Array of pending ability choices
	 */
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
			choices: choice.choices || [],
			source: choice.source || 'Race Choice',
		}));

		return formattedChoices;
	}

	/**
	 * Get available abilities for a choice
	 * @param {number} currentChoiceIndex - The index of the current choice
	 * @returns {Array<string>} Array of available ability names
	 */
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

	/**
	 * Handle an ability choice selection
	 * @param {string} ability - The selected ability
	 * @param {number} choiceIndex - The index of the choice
	 * @param {number} bonus - The bonus amount
	 * @param {string} source - The source of the bonus
	 */
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

	/**
	 * Gets the maximum allowed ability score
	 * @returns {number} Maximum ability score
	 */
	get maxScore() {
		return 20; // D&D 5e maximum ability score (without magical items)
	}

	/**
	 * Gets the minimum allowed ability score
	 * @returns {number} Minimum ability score
	 */
	get minScore() {
		return 3; // D&D 5e minimum ability score
	}

	/**
	 * Gets the maximum points for point buy
	 * @returns {number} Maximum points
	 */
	get maxPoints() {
		return 27; // Standard D&D 5e point buy limit
	}

	/**
	 * Gets available standard array values (that aren't assigned)
	 * @returns {Array<number>} Array of available values
	 */
	getAvailableStandardArrayValues() {
		const allValues = [...this._standardArrayValues];
		const usedValues = Object.values(this._assignedStandardArrayValues);

		const availableValues = allValues.filter(
			(value) => !usedValues.includes(value),
		);
		return availableValues;
	}

	/**
	 * Gets the list of assigned standard array values
	 * @returns {Array} Array of assigned values
	 */
	get assignedStandardValues() {
		return Object.entries(this._assignedStandardArrayValues);
	}

	/**
	 * Resets ability score method-specific state
	 * Used when switching between ability score methods
	 */
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

/**
 * Formats an ability modifier with proper sign
 * @param {number} modifier - The modifier value
 * @returns {string} Formatted modifier (e.g., "+2", "-1", "+0")
 */
export function formatModifier(modifier) {
	if (typeof modifier !== 'number' || Number.isNaN(modifier)) {
		return '+0';
	}
	if (modifier >= 0) {
		return `+${modifier}`;
	}
	return `${modifier}`;
}

/**
 * Point buy cost mapping for ability scores (8-15)
 */
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

/**
 * Standard array values available for assignment
 */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/**
 * Default starting point buy budget
 */
export const POINT_BUY_BUDGET = 27;

/**
 * Gets the point buy cost for a given ability score
 * @param {number} score - The ability score
 * @returns {number} The point cost (0 if invalid)
 */
export function getPointBuyCost(score) {
	return POINT_BUY_COSTS.get(score) || 0;
}

/**
 * Calculates total points spent in point buy system
 * @param {Object<string, number>} scores - Object mapping ability names to scores
 * @returns {number} Total points spent
 */
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

/**
 * Calculates remaining points in point buy system
 * @param {Object<string, number>} scores - Object mapping ability names to scores
 * @param {number} [budget=27] - Total point budget
 * @returns {number} Remaining points
 */
export function calculateRemainingPoints(scores, budget = POINT_BUY_BUDGET) {
	return budget - calculatePointBuyTotal(scores);
}

/**
 * Validates if a point buy score change is allowed
 * @param {Object<string, number>} currentScores - Current ability scores
 * @param {string} ability - Ability to change
 * @param {number} newScore - New score value
 * @param {number} [budget=27] - Total point budget
 * @returns {boolean} True if the change is valid
 */
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

/**
 * Validates standard array assignment
 * @param {Object<string, number>} assignments - Object mapping abilities to standard array values
 * @returns {Object} Validation result with isValid and errors
 */
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

/**
 * Calculates total ability score including racial bonuses
 * @param {number} baseScore - Base ability score
 * @param {number} racialBonus - Racial bonus to the ability
 * @returns {number} Total ability score
 */
export function calculateTotalAbilityScore(baseScore, racialBonus = 0) {
	return (baseScore || 0) + (racialBonus || 0);
}

//=============================================================================
// Helper Functions from AbilityScoreUtils.js
//=============================================================================

/**
 * Helper: Convert ability abbreviation to lowercase full name
 * @private
 */
function normalizeAbilityNameHelper(abb) {
	// attAbvToFull returns capitalized names (e.g., 'Strength')
	// We need lowercase for internal storage (e.g., 'strength')
	const fullName = attAbvToFull(abb);
	return fullName ? fullName.toLowerCase() : abb;
}

/**
 * Parse race/subrace ability data into fixed bonuses and choices
 *
 * @param {Object} race - Race data object
 * @param {Object} subrace - Subrace data object (optional)
 * @returns {object} Parsed ability score data
 *
 * Returns: {
 *   fixed: Array<{ ability, value, source }>,  // Fixed racial bonuses
 *   choices: Array<{ count, amount, from, source }>  // Ability score choices
 * }
 */
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
					from: (entry.choose.from || ABILITIES).map(normalizeAbilityNameHelper),
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
					from: (entry.choose.from || ABILITIES).map(normalizeAbilityNameHelper),
					source: 'subrace',
				});
			}
		}
	}

	return { fixed, choices };
}

/**
 * Parse ability score data from a race/subrace ability array
 *
 * @param {Array} abilityArray - The ability array from race data
 * @param {object} options - Parsing options
 * @param {boolean} options.isOnlyShort - Return only short form
 * @param {boolean} options.isCurrentLineage - Is this a Tasha's lineage
 * @returns {object} Parsed ability score data
 *
 * Returns: {
 *   asText: string,           // Full text: "Your Charisma score increases by 2..."
 *   asTextShort: string,      // Short text: "Cha +2, choose two +1"
 *   asCollection: Array<object> // Structured data for programmatic use
 * }
 */
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

/**
 * Process a "choose" ability entry (e.g., Variant Human's "+1 to two different abilities")
 * @private
 */
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
			textShort = `${from.map((a) => capitalizeFirst(a)).join('/')} +${amount}`;
		}
	} else {
		// Choose multiple abilities
		if (from.length === ABILITIES.length) {
			text = `increase ${numberToWords(count)} ability ${count === 1 ? 'score' : 'scores'} of your choice by ${amount}`;
			textShort = `choose ${numberToWords(count)} +${amount}`;
		} else {
			const abilities = from.map(attAbvToFull).join(', ');
			text = `increase ${numberToWords(count)} of the following by ${amount}: ${abilities}`;
			textShort = `choose ${numberToWords(count)} from ${from.map((a) => capitalizeFirst(a)).join('/')} +${amount}`;
		}
	}

	return {
		data: { from, count, amount },
		text,
		textShort,
	};
}

/**
 * Process fixed ability scores (e.g., "str: 2, dex: 1")
 * @private
 */
function processFixed(abilityEntry) {
	const fixed = {};
	const parts = [];
	const shortParts = [];

	for (const ability of ABILITIES) {
		if (abilityEntry[ability]) {
			const value = abilityEntry[ability];
			fixed[ability] = value;
			parts.push(`your ${attAbvToFull(ability)} score increases by ${value}`);
			shortParts.push(`${capitalizeFirst(ability)} +${value}`);
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

/**
 * Get only the fixed ability improvements (no choices)
 * Useful for character sheets and validation
 *
 * @param {Array} abilityArray - The ability array from race data
 * @returns {object} Object with fixed ability scores (e.g., {str: 2, cha: 1})
 */
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

/**
 * Get ability score choices (for UI selection)
 *
 * @param {Array} abilityArray - The ability array from race data
 * @returns {Array<object>} Array of choice objects
 *
 * Each choice object: {
 *   from: string[],      // Array of ability abbreviations to choose from
 *   count: number,       // How many to choose
 *   amount: number,      // How much to increase by
 *   weighted: object     // Optional weighted choices
 * }
 */
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

/**
 * Validate ability score selections against race requirements
 *
 * @param {Array} abilityArray - The ability array from race data
 * @param {object} selections - User's ability score selections
 * @returns {object} Validation result
 *
 * Returns: {
 *   valid: boolean,
 *   errors: string[],
 *   final: object  // Final ability score improvements
 * }
 */
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

/**
 * Helper: Capitalize first letter of a string
 * @private
 */
function capitalizeFirst(str) {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1);
}


// Create and export singleton instance
export const abilityScoreService = new AbilityScoreService();
