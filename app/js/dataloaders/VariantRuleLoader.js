/**
 * VariantRuleLoader.js
 * Handles loading and caching of variant rule data
 */

import { BaseLoader } from './BaseLoader.js';

export class VariantRuleLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            variantRules: 'variantrules.json'
        };
    }

    /**
     * Load all variant rule data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<Object>} Raw variant rule data
     */
    async loadVariantRules(options = {}) {
        return this.getOrLoadData('variantRules', async () => {
            try {
                const data = await this.loadJsonFile(this.dataFiles.variantRules, {
                    ...options,
                    maxRetries: 3
                });

                console.log(`Loaded ${data.variantrule?.length || 0} variant rules`);
                return data;
            } catch (error) {
                console.error('Error loading variant rules:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load variant rules in chunks for better performance
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Array<Object>>} Generator yielding chunks of variant rule data
     */
    async *loadVariantRulesInChunks(chunkSize = 10, options = {}) {
        const data = await this.loadVariantRules(options);

        if (data.variantrule && Array.isArray(data.variantrule)) {
            for (let i = 0; i < data.variantrule.length; i += chunkSize) {
                yield data.variantrule.slice(i, i + chunkSize);
            }
        }
    }
} 