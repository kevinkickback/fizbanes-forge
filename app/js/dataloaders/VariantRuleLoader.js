/**
 * VariantRuleLoader
 * Handles loading and caching of variant rules data
 * 
 * @typedef {Object} RawVariantRule
 * @property {string} name - Variant rule name
 * @property {string} source - Source book
 * @property {number} page - Page number
 * @property {string} [ruleType] - Type of rule (e.g., "O" for optional, "C" for core)
 * @property {boolean} [freeRules2024] - Whether rule is in the 2024 free rules
 * @property {string} [type] - Content type (e.g., "section")
 * @property {Array<Object>} entries - Rule description entries
 * 
 * @typedef {Object} VariantRuleData
 * @property {Array<RawVariantRule>} variantrule - Array of variant rules
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * Handles loading and caching of variant rules data
 */
export class VariantRuleLoader extends BaseLoader {
    /**
     * Creates a new VariantRuleLoader instance
     * @param {Object} options - Loader configuration options
     * @param {number} [options.maxCacheSize] - Maximum cache size (defaults to 50)
     * @param {number} [options.defaultExpiry] - Default cache expiry in ms (defaults to 1 hour)
     */
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this._dataFiles = {
            variantRules: 'variantrules.json'
        };
    }


    /**
     * Load all variant rule data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<{variantrule: Array<RawVariantRule>}>} Raw variant rule data
     * @throws {Error} If data loading fails
     */
    async loadVariantRules(options = {}) {
        return this.getOrLoadData('variantrules', async () => {
            try {
                const ruleData = await this.loadJsonFile(this._dataFiles.variantRules, {
                    ...options,
                    maxRetries: 3
                }).catch(error => {
                    console.error('Failed to load variant rule data:', error);
                    throw new Error('Failed to load variant rule data');
                });

                if (!ruleData || !ruleData.variantrule) {
                    throw new Error('Invalid or empty variant rule data');
                }

                const data = {
                    variantrule: ruleData.variantrule || []
                };


                return data;
            } catch (error) {
                console.error('Error loading variant rules:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load variant rules in chunks for better performance
     * @param {number} chunkSize - Size of each chunk (defaults to 10)
     * @param {Object} options - Loading options
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {AsyncGenerator<{type: string, items: Array<RawVariantRule>}>} Generator yielding chunks of variant rule data
     * @throws {Error} If data loading fails
     */
    async *loadVariantRulesInChunks(chunkSize = 10, options = {}) {
        try {
            const data = await this.loadVariantRules(options);

            if (data.variantrule && Array.isArray(data.variantrule)) {
                for (let i = 0; i < data.variantrule.length; i += chunkSize) {
                    yield {
                        type: 'variantrule',
                        items: data.variantrule.slice(i, i + chunkSize)
                    };
                }
            }
        } catch (error) {
            console.error('Error loading variant rules in chunks:', error);
            throw error;
        }
    }
} 