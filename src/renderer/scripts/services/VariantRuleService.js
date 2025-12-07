/** @file Variant Rule service for managing variant rule data. */

import { DataLoader } from '../utils/DataLoader.js';

/** Manages variant rule data and provides access to variant rules. */
class VariantRuleService {
    /** Initialize a new VariantRuleService instance. */
    constructor() {
        this._variantRuleData = null;
        this._variantRuleMap = null; // Map for O(1) lookups by name (case-insensitive)
    }

    /**
     * Initialize variant rule data by loading from DataLoader
     * @returns {Promise<boolean>} True if initialization succeeded
     */
    async initialize() {
        // Skip if already initialized
        if (this._variantRuleData) {
            console.debug('VariantRuleService', 'Already initialized');
            return true;
        }

        console.info('[VariantRuleService]', 'Initializing variant rule data');

        try {
            this._variantRuleData = await DataLoader.loadVariantRules();
            console.info('[VariantRuleService]', 'Variant rules loaded successfully', {
                count: this._variantRuleData.variantrule?.length,
            });

            // Build lookup map for O(1) access by name (case-insensitive)
            this._variantRuleMap = new Map();
            if (this._variantRuleData.variantrule && Array.isArray(this._variantRuleData.variantrule)) {
                for (const rule of this._variantRuleData.variantrule) {
                    if (!rule.name) continue;
                    const key = rule.name.toLowerCase();
                    this._variantRuleMap.set(key, rule);
                }
            }

            return true;
        } catch (error) {
            console.error('VariantRuleService', 'Failed to initialize variant rule data', error);
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
        return this._variantRuleMap.get(ruleName.toLowerCase()) || null;
    }
}

export const variantRuleService = new VariantRuleService();
