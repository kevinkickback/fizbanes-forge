/**
 * helpers.js
 * Utility functions for common operations in the D&D Character Creator
 * 
 * @typedef {Object} AbilityScore
 * @property {number} score - The raw ability score value
 * @property {number} modifier - The calculated ability modifier
 * 
 * @typedef {Object} FormValidationResult
 * @property {boolean} isValid - Whether all required fields have values
 * @property {Array<string>} missingFields - List of field IDs that are missing values
 */

/**
 * tility functions for common operations
 */


/**
 * Formats an ability score with its modifier
 * @param {number} score - The raw ability score
 * @returns {string} The formatted ability score with modifier (e.g., "15 (+2)")
 */
export function formatAbilityScore(score) {
    const modifier = Math.floor((score - 10) / 2);
    return `${score} (${modifier >= 0 ? '+' : ''}${modifier})`;
}

/**
 * Capitalizes the first letter of a word and makes the rest lowercase
 * @param {string} word - The word to capitalize
 * @returns {string} The capitalized word
 */
export function capitalizeWord(word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Creates a deep clone of an object using JSON serialization
 * @param {Object} obj - The object to clone
 * @returns {Object} A deep clone of the input object
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Validates that all required form fields have values
 * @param {string[]} fields - Array of field IDs to validate
 * @returns {boolean} True if all fields have values, false otherwise
 */
export function validateRequiredFields(fields) {
    for (const field of fields) {
        const element = document.getElementById(field);
        if (!element || !element.value) {
            return false;
        }
    }
    return true;
} 