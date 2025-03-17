/**
 * ActionLoader.js
 * Handles loading and caching of action data
 * 
 * @typedef {Object} RawAction
 * @property {string} name - Action name
 * @property {string} [source] - Source book
 * @property {number} [page] - Page number
 * @property {string} [time] - Action time (e.g., "Action", "Bonus Action", "Reaction")
 * @property {Array<Object>} entries - Action description entries
 */

import { BaseLoader } from './BaseLoader.js';

export class ActionLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            actions: 'actions.json'
        };
    }

    /**
     * Load all action data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<{action: Array<RawAction>}>} Raw action data
     */
    async loadActions(options = {}) {
        return this.getOrLoadData('actions', async () => {
            try {
                const actionData = await this.loadJsonFile(this.dataFiles.actions, {
                    ...options,
                    maxRetries: 3
                });

                const data = {
                    action: actionData.action || []
                };

                console.log(`Loaded ${data.action.length} actions`);
                return data;
            } catch (error) {
                console.error('Error loading actions:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Get action data by name
     * @param {string} name - Action name
     * @param {Object} options - Loading options
     * @returns {Promise<RawAction|null>} Raw action data or null if not found
     */
    async getAction(name, options = {}) {
        const cacheKey = `action_${name.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadActions(options);
            return data.action.find(action =>
                action.name.toLowerCase() === name.toLowerCase()
            ) || null;
        }, options);
    }
} 