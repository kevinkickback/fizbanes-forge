/**
 * ConditionLoader
 * Handles loading and caching of condition data
 * 
 * @typedef {Object} RawCondition
 * @property {string} name - Condition name
 * @property {string} source - Source book
 * @property {number} page - Page number
 * @property {boolean} [srd] - Whether condition is in SRD
 * @property {boolean} [basicRules] - Whether condition is in Basic Rules
 * @property {Array<Object>} [otherSources] - Additional source references
 * @property {Array<string>} [reprintedAs] - Reprinted versions
 * @property {Array<Object>} entries - Condition description entries
 * @property {boolean} [hasFluffImages] - Whether condition has fluff images
 * @property {boolean} [freeRules2024] - Whether condition is in the 2024 free rules
 * @property {boolean} [isDisease] - Whether the condition is a disease
 * 
 * @typedef {Object} ConditionData
 * @property {Array<RawCondition>} condition - Array of conditions
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * Handles loading and caching of condition and disease data
 */
export class ConditionLoader extends BaseLoader {
    /**
     * Creates a new ConditionLoader instance
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
            conditions: 'conditionsdiseases.json'
        };
    }

    //------------------------------------------------
    // Condition Data Loading Methods
    //------------------------------------------------

    /**
     * Load all condition data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<{condition: Array<RawCondition>}>} Raw condition data
     * @throws {Error} If data loading fails
     */
    async loadConditions(options = {}) {
        return this.getOrLoadData('conditions', async () => {
            try {
                const conditionData = await this.loadJsonFile(this._dataFiles.conditions, {
                    ...options,
                    maxRetries: 3
                }).catch(error => {
                    console.error('Failed to load condition data:', error);
                    throw new Error('Failed to load condition data');
                });

                if (!conditionData || !conditionData.condition) {
                    throw new Error('Invalid or empty condition data');
                }

                const data = {
                    condition: conditionData.condition || []
                };

                return data;
            } catch (error) {
                console.error('Error loading conditions:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load conditions in chunks for better performance
     * @param {number} chunkSize - Size of each chunk (defaults to 10)
     * @param {Object} options - Loading options
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {AsyncGenerator<{type: string, items: Array<RawCondition>}>} Generator yielding chunks of condition data
     * @throws {Error} If data loading fails
     */
    async *loadConditionsInChunks(chunkSize = 10, options = {}) {
        try {
            const data = await this.loadConditions(options);

            if (data.condition && Array.isArray(data.condition)) {
                for (let i = 0; i < data.condition.length; i += chunkSize) {
                    yield {
                        type: 'condition',
                        items: data.condition.slice(i, i + chunkSize)
                    };
                }
            }
        } catch (error) {
            console.error('Error loading conditions in chunks:', error);
            throw error;
        }
    }
} 