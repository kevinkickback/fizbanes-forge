/**
 * NumberFormatter.js
 * Utility functions for formatting numbers in D&D context
 */

/**
 * Formats a number with proper sign (+/-) for display
 * @param {number} value - The number to format
 * @returns {string} Formatted string (e.g., "+2", "-1", "+0")
 */
export function formatModifier(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '+0';
    }

    if (value >= 0) {
        return `+${value}`;
    }

    return `${value}`;
}

/**
 * Formats dice notation (e.g., "1d8", "2d6+3")
 * @param {number} count - Number of dice
 * @param {number} sides - Number of sides per die
 * @param {number} [modifier=0] - Fixed modifier to add
 * @returns {string} Formatted dice notation
 */
export function formatDice(count, sides, modifier = 0) {
    if (typeof count !== 'number' || typeof sides !== 'number') {
        return '';
    }

    let result = `${count}d${sides}`;

    if (modifier !== 0) {
        result += formatModifier(modifier);
    }

    return result;
}

/**
 * Parses dice notation string into components
 * @param {string} diceString - Dice notation (e.g., "2d6+3", "1d8")
 * @returns {Object} Object with count, sides, and modifier
 */
export function parseDice(diceString) {
    if (typeof diceString !== 'string') {
        return { count: 0, sides: 0, modifier: 0 };
    }

    const match = diceString.match(/(\d+)d(\d+)([+-]\d+)?/i);

    if (!match) {
        return { count: 0, sides: 0, modifier: 0 };
    }

    return {
        count: parseInt(match[1], 10),
        sides: parseInt(match[2], 10),
        modifier: match[3] ? parseInt(match[3], 10) : 0
    };
}

/**
 * Formats a number as an ordinal (1st, 2nd, 3rd, etc.)
 * @param {number} num - The number to format
 * @returns {string} Ordinal string
 */
export function formatOrdinal(num) {
    if (typeof num !== 'number' || isNaN(num)) {
        return '';
    }

    const suffixes = ['th', 'st', 'nd', 'rd'];
    const value = num % 100;

    const suffix = suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];

    return `${num}${suffix}`;
}

/**
 * Formats a distance in feet
 * @param {number} feet - Distance in feet
 * @returns {string} Formatted distance (e.g., "30 ft.", "60 feet")
 */
export function formatDistance(feet) {
    if (typeof feet !== 'number' || isNaN(feet)) {
        return '0 ft.';
    }

    return `${feet} ft.`;
}

/**
 * Formats a weight in pounds
 * @param {number} pounds - Weight in pounds
 * @returns {string} Formatted weight (e.g., "150 lb.", "10 lbs.")
 */
export function formatWeight(pounds) {
    if (typeof pounds !== 'number' || isNaN(pounds)) {
        return '0 lb.';
    }

    return pounds === 1 ? `${pounds} lb.` : `${pounds} lbs.`;
}

/**
 * Formats currency in gold pieces
 * @param {number} gp - Amount in gold pieces
 * @returns {string} Formatted currency (e.g., "100 gp", "5 gp")
 */
export function formatGold(gp) {
    if (typeof gp !== 'number' || isNaN(gp)) {
        return '0 gp';
    }

    return `${gp} gp`;
}

/**
 * Formats a range (e.g., weapon range)
 * @param {number} normal - Normal range
 * @param {number} [long] - Long range (optional)
 * @returns {string} Formatted range (e.g., "30 ft.", "100/400 ft.")
 */
export function formatRange(normal, long) {
    if (typeof normal !== 'number' || isNaN(normal)) {
        return '';
    }

    if (long && typeof long === 'number') {
        return `${normal}/${long} ft.`;
    }

    return `${normal} ft.`;
}

/**
 * Formats a level range (e.g., "1st-5th level")
 * @param {number} min - Minimum level
 * @param {number} max - Maximum level
 * @returns {string} Formatted level range
 */
export function formatLevelRange(min, max) {
    if (min === max) {
        return `${formatOrdinal(min)} level`;
    }

    return `${formatOrdinal(min)}-${formatOrdinal(max)} level`;
}

/**
 * Formats a proficiency bonus
 * @param {number} level - Character level
 * @returns {string} Formatted proficiency bonus (e.g., "+2", "+6")
 */
export function formatProficiencyBonus(level) {
    if (typeof level !== 'number' || level < 1) {
        return '+2';
    }

    const bonus = Math.ceil(level / 4) + 1;
    return formatModifier(bonus);
}

/**
 * Formats a percentage
 * @param {number} value - The value (0-1 or 0-100)
 * @param {boolean} [isDecimal=true] - Whether input is decimal (0-1) or percentage (0-100)
 * @returns {string} Formatted percentage (e.g., "50%")
 */
export function formatPercentage(value, isDecimal = true) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0%';
    }

    const percent = isDecimal ? value * 100 : value;
    return `${Math.round(percent)}%`;
}

/**
 * Formats a number with thousand separators
 * @param {number} value - The number to format
 * @returns {string} Formatted number (e.g., "1,000", "10,000")
 */
export function formatWithCommas(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        return '0';
    }

    return value.toLocaleString('en-US');
}

/**
 * Calculates average damage from dice notation
 * @param {number} count - Number of dice
 * @param {number} sides - Number of sides per die
 * @param {number} [modifier=0] - Fixed modifier
 * @returns {number} Average damage
 */
export function calculateAverageDamage(count, sides, modifier = 0) {
    if (typeof count !== 'number' || typeof sides !== 'number') {
        return 0;
    }

    const diceAverage = count * ((sides + 1) / 2);
    return Math.floor(diceAverage + (modifier || 0));
}

/**
 * Formats damage with average in parentheses
 * @param {number} count - Number of dice
 * @param {number} sides - Number of sides per die
 * @param {number} [modifier=0] - Fixed modifier
 * @returns {string} Formatted damage (e.g., "1d8+3 (7)", "2d6 (7)")
 */
export function formatDamageWithAverage(count, sides, modifier = 0) {
    const dice = formatDice(count, sides, modifier);
    const average = calculateAverageDamage(count, sides, modifier);
    return `${dice} (${average})`;
}
