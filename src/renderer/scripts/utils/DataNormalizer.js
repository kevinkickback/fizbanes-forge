/** DataNormalizer.js - Normalizes all game data for consistent internal storage. */

/**
 * Centralizes data normalization to ensure consistency across the app.
 * All game data (skills, languages, items, proficiencies, etc.) are normalized
 * to lowercase with spaces preserved to enable case-insensitive lookups.
 *
 * This module is the single source of truth for normalization logic.
 * If JSON data formats change, updates only need to happen here.
 */

const DataNormalizer = {
	/**
	 * Normalize a single string (skill, language, item, action, etc.)
	 * - Trim whitespace
	 * - Convert to lowercase
	 * - Do NOT remove spaces (keep "animal handling" not "animalhandling")
	 * @param {string} str - String to normalize
	 * @returns {string} Normalized string
	 */
	normalizeString(str) {
		if (!str || typeof str !== 'string') return '';
		return str.trim().toLowerCase();
	},

	/**
	 * Normalize a string for lookups without altering display casing elsewhere.
	 * @param {string} str
	 * @returns {string}
	 */
	normalizeForLookup(str) {
		if (!str || typeof str !== 'string') return '';
		return str.trim().toLowerCase();
	},

	/**
	 * Normalize an array of strings
	 * @param {Array<string>} arr - Array of strings
	 * @returns {Array<string>} Array with normalized strings
	 */
	normalizeStringArray(arr) {
		if (!Array.isArray(arr)) return [];
		return arr.map((item) => this.normalizeForLookup(item));
	},
};

export default DataNormalizer;

//=============================================================================
// Asset Validator - Checks for required assets
//=============================================================================

const REQUIRED_ASSETS = [
	'assets/bootstrap/dist/css/bootstrap.min.css',
	'assets/fontawesome/css/all.min.css',
	'assets/fontawesome/webfonts/fa-solid-900.woff2',
];

/**
 * Validates that required assets are present
 * @returns {string[]} Array of missing asset paths (empty if all found)
 */
export function validateAssets() {
	const missing = [];
	REQUIRED_ASSETS.forEach((relPath) => {
		const url = relPath;
		const req = new XMLHttpRequest();
		req.open('HEAD', url, false); // synchronous for startup check
		req.send();
		if (req.status !== 200) {
			missing.push(relPath);
		}
	});
	if (missing.length > 0) {
		console.warn('Missing required assets:', missing);
		if (window.FF_DEBUG) {
			alert(`Missing required assets: ${missing.join(', ')}`);
		}
	}
	return missing;
}
