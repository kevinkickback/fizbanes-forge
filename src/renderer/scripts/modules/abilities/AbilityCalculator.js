/** Pure ability-score calculations (modifiers, point buy totals, validation). */

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
