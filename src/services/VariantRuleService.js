import { DataLoader } from '../lib/DataLoader.js';
import DataNormalizer from '../lib/DataNormalizer.js';
class VariantRuleService {
	constructor() {
		this._variantRuleData = null;
		this._variantRuleMap = null; // Map for O(1) lookups by name (case-insensitive)
	}

	async initialize() {
		// Skip if already initialized
		if (this._variantRuleData) {
			console.debug('VariantRuleService', 'Already initialized');
			return true;
		}

		console.debug('[VariantRuleService]', 'Initializing variant rule data');

		try {
			this._variantRuleData = await DataLoader.loadVariantRules();
			console.debug(
				'[VariantRuleService]',
				'Variant rules loaded successfully',
				{
					count: this._variantRuleData.variantrule?.length,
				},
			);

			// Build lookup map for O(1) access by name (case-insensitive)
			this._variantRuleMap = new Map();
			if (
				this._variantRuleData.variantrule &&
				Array.isArray(this._variantRuleData.variantrule)
			) {
				for (const rule of this._variantRuleData.variantrule) {
					if (!rule.name) continue;
					const key = DataNormalizer.normalizeForLookup(rule.name);
					this._variantRuleMap.set(key, rule);
				}
			}

			return true;
		} catch (error) {
			console.error(
				'VariantRuleService',
				'Failed to initialize variant rule data',
				error,
			);
			return false;
		}
	}

	/**
	 * Get all available variant rules
	 * @returns {Array<Object>} Array of variant rule objects
	 */
	getAllVariantRules() {
		return this._variantRuleData?.variantrule || [];
	}

	/**
	 * Get a specific variant rule by name (case-insensitive)
	 * @param {string} ruleName - Variant rule name
	 * @returns {Object|null} Variant rule object or null if not found
	 */
	getVariantRule(ruleName) {
		if (!this._variantRuleMap) return null;
		return (
			this._variantRuleMap.get(DataNormalizer.normalizeForLookup(ruleName)) ||
			null
		);
	}
}

export const variantRuleService = new VariantRuleService();
