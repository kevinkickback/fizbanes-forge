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
	 * Normalize an array of strings
	 * @param {Array<string>} arr - Array of strings
	 * @returns {Array<string>} Array with normalized strings
	 */
	normalizeStringArray(arr) {
		if (!Array.isArray(arr)) return [];
		return arr.map(item => this.normalizeString(item));
	},

	/**
	 * Normalize skill names in skill objects (from skills.json)
	 * @param {Array<Object>} skills - Skills array from JSON
	 * @returns {Array<Object>} Skills with normalized names
	 */
	normalizeSkills(skills) {
		if (!Array.isArray(skills)) return [];
		return skills.map(skill => ({
			...skill,
			name: this.normalizeString(skill.name),
		}));
	},

	/**
	 * Normalize action names (from actions.json)
	 * @param {Array<Object>} actions - Actions array from JSON
	 * @returns {Array<Object>} Actions with normalized names
	 */
	normalizeActions(actions) {
		if (!Array.isArray(actions)) return [];
		return actions.map(action => ({
			...action,
			name: this.normalizeString(action.name),
		}));
	},

	/**
	 * Normalize language names (from languages.json)
	 * @param {Array<Object>} languages - Languages array from JSON
	 * @returns {Array<Object>} Languages with normalized names
	 */
	normalizeLanguages(languages) {
		if (!Array.isArray(languages)) return [];
		return languages.map(lang => ({
			...lang,
			name: this.normalizeString(lang.name),
		}));
	},

	/**
	 * Normalize condition names (from conditions.json)
	 * @param {Array<Object>} conditions - Conditions array from JSON
	 * @returns {Array<Object>} Conditions with normalized names
	 */
	normalizeConditions(conditions) {
		if (!Array.isArray(conditions)) return [];
		return conditions.map(condition => ({
			...condition,
			name: this.normalizeString(condition.name),
		}));
	},

	/**
	 * Normalize object/item names
	 * @param {Array<Object>} objects - Objects array from JSON
	 * @returns {Array<Object>} Objects with normalized names
	 */
	normalizeObjects(objects) {
		if (!Array.isArray(objects)) return [];
		return objects.map(obj => ({
			...obj,
			name: this.normalizeString(obj.name),
		}));
	},

	/**
	 * Normalize trap/hazard names
	 * @param {Array<Object>} trapsHazards - Traps/hazards array from JSON
	 * @returns {Array<Object>} Traps/hazards with normalized names
	 */
	normalizeTrapsHazards(trapsHazards) {
		if (!Array.isArray(trapsHazards)) return [];
		return trapsHazards.map(item => ({
			...item,
			name: this.normalizeString(item.name),
		}));
	},

	/**
	 * Normalize item names
	 * @param {Array<Object>} items - Items array from JSON
	 * @returns {Array<Object>} Items with normalized names
	 */
	normalizeItems(items) {
		if (!Array.isArray(items)) return [];
		return items.map(item => ({
			...item,
			name: this.normalizeString(item.name),
		}));
	},

	/**
	 * Normalize base item names
	 * @param {Array<Object>} baseItems - Base items array from JSON
	 * @returns {Array<Object>} Base items with normalized names
	 */
	normalizeBaseItems(baseItems) {
		if (!Array.isArray(baseItems)) return [];
		return baseItems.map(item => ({
			...item,
			name: this.normalizeString(item.name),
		}));
	},

	/**
	 * Normalize feat names
	 * @param {Array<Object>} feats - Feats array from JSON
	 * @returns {Array<Object>} Feats with normalized names
	 */
	normalizeFeats(feats) {
		if (!Array.isArray(feats)) return [];
		return feats.map(feat => ({
			...feat,
			name: this.normalizeString(feat.name),
		}));
	},

	/**
	 * Normalize optional feature names
	 * @param {Array<Object>} features - Optional features array from JSON
	 * @returns {Array<Object>} Features with normalized names
	 */
	normalizeOptionalFeatures(features) {
		if (!Array.isArray(features)) return [];
		return features.map(feature => ({
			...feature,
			name: this.normalizeString(feature.name),
		}));
	},

	/**
	 * Normalize reward names
	 * @param {Array<Object>} rewards - Rewards array from JSON
	 * @returns {Array<Object>} Rewards with normalized names
	 */
	normalizeRewards(rewards) {
		if (!Array.isArray(rewards)) return [];
		return rewards.map(reward => ({
			...reward,
			name: this.normalizeString(reward.name),
		}));
	},

	/**
	 * Normalize vehicle names
	 * @param {Array<Object>} vehicles - Vehicles array from JSON
	 * @returns {Array<Object>} Vehicles with normalized names
	 */
	normalizeVehicles(vehicles) {
		if (!Array.isArray(vehicles)) return [];
		return vehicles.map(vehicle => ({
			...vehicle,
			name: this.normalizeString(vehicle.name),
		}));
	},

	/**
	 * Normalize proficiency names in race/class/background data
	 * Handles: skillProficiencies, toolProficiencies, weaponProficiencies,
	 * armorProficiencies, languageProficiencies
	 * @param {Object} data - Race/class/background data object
	 * @returns {Object} Data with normalized proficiency fields
	 */
	normalizeProficienciesInData(data) {
		if (!data || typeof data !== 'object') return data;

		const normalized = { ...data };

		// Normalize proficiency field names and values
		if (normalized.skillProficiencies && Array.isArray(normalized.skillProficiencies)) {
			normalized.skillProficiencies = normalized.skillProficiencies.map(prof => {
				if (typeof prof === 'string') {
					return this.normalizeString(prof);
				}
				// Handle object format with properties
				if (prof.any) return prof; // "any" skill choice - keep as-is
				const result = {};
				for (const [key, value] of Object.entries(prof)) {
					result[this.normalizeString(key)] = value;
				}
				return result;
			});
		}

		if (normalized.toolProficiencies && Array.isArray(normalized.toolProficiencies)) {
			normalized.toolProficiencies = this.normalizeStringArray(normalized.toolProficiencies);
		}

		if (normalized.weaponProficiencies && Array.isArray(normalized.weaponProficiencies)) {
			normalized.weaponProficiencies = this.normalizeStringArray(normalized.weaponProficiencies);
		}

		if (normalized.armorProficiencies && Array.isArray(normalized.armorProficiencies)) {
			normalized.armorProficiencies = this.normalizeStringArray(normalized.armorProficiencies);
		}

		if (normalized.languageProficiencies && Array.isArray(normalized.languageProficiencies)) {
			normalized.languageProficiencies = this.normalizeStringArray(normalized.languageProficiencies);
		}

		return normalized;
	},
};

export default DataNormalizer;
