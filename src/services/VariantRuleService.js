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

		console.debug('VariantRuleService', 'Initializing variant rule data');

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
		} catch {
			// Gracefully handle missing file - variant rules are optional
			console.warn(
				'[VariantRuleService]',
				'Variant rules unavailable, continuing without them',
			);
			this._variantRuleData = { variantrule: [] };
			this._variantRuleMap = new Map();
			return true;
		}
	}

	getAllVariantRules() {
		return this._variantRuleData?.variantrule || [];
	}

	/** Get a specific variant rule by name (case-insensitive). */
	getVariantRule(ruleName) {
		if (!this._variantRuleMap) return null;
		return (
			this._variantRuleMap.get(DataNormalizer.normalizeForLookup(ruleName)) ||
			null
		);
	}
}

export const variantRuleService = new VariantRuleService();
