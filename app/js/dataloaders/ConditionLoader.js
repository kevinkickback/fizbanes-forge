/**
 * ConditionLoader.js
 * Handles loading and caching of condition data
 * 
 * @typedef {Object} RawCondition
 * @property {string} name - Condition name
 * @property {string} [source] - Source book
 * @property {number} [page] - Page number
 * @property {Array<Object>} entries - Condition description entries
 */

import { BaseLoader } from './BaseLoader.js';

export class ConditionLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            conditions: 'conditionsdiseases.json'
        };
    }

    /**
     * Load all condition data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<{condition: Array<RawCondition>}>} Raw condition data
     */
    async loadConditions(options = {}) {
        return this.getOrLoadData('conditions', async () => {
            try {
                const conditionData = await this.loadJsonFile(this.dataFiles.conditions, {
                    ...options,
                    maxRetries: 3
                });

                const data = {
                    condition: conditionData.condition || []
                };

                console.debug(`Loaded ${data.condition.length} conditions`);
                return data;
            } catch (error) {
                console.error('Error loading conditions:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Get condition data by name
     * @param {string} name - Condition name
     * @param {Object} options - Loading options
     * @returns {Promise<RawCondition|null>} Raw condition data or null if not found
     */
    async getCondition(name, options = {}) {
        const cacheKey = `condition_${name.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadConditions(options);
            return data.condition.find(condition =>
                condition.name.toLowerCase() === name.toLowerCase()
            ) || null;
        }, options);
    }
} 