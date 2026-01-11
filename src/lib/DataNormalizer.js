/** DataNormalizer.js - Normalizes all game data for consistent internal storage. */

const DataNormalizer = {
	normalizeString(str) {
		if (!str || typeof str !== 'string') return '';
		return str.trim().toLowerCase();
	},

	normalizeForLookup(str) {
		if (!str || typeof str !== 'string') return '';
		return str.trim().toLowerCase();
	},

	normalizeStringArray(arr) {
		if (!Array.isArray(arr)) return [];
		return arr.map((item) => this.normalizeForLookup(item));
	},
};

export default DataNormalizer;
