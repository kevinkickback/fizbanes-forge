const DataNormalizer = {
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
