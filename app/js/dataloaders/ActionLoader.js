/**
 * ActionLoader
 * Handles loading and caching of combat action data
 * 
 * @typedef {Object} RawAction
 * @property {string} name - Action name
 * @property {string} source - Source book
 * @property {number} page - Page number
 * @property {boolean} [srd] - Whether the action is in SRD
 * @property {boolean} [basicRules] - Whether the action is in Basic Rules
 * @property {Array<string>} [reprintedAs] - Reprinted versions
 * @property {Array<Object>} time - Action time details
 * @property {Array<Object>} entries - Action description entries
 * @property {string} [fromVariant] - Variant rule source
 * @property {Array<string>} [seeAlsoAction] - Related actions
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * Handles loading and caching of combat action data
 */
export class ActionLoader extends BaseLoader {
    /**
     * Creates a new ActionLoader instance
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
            actions: 'actions.json'
        };
    }

    //------------------------------------------------
    // Action Data Loading Methods
    //------------------------------------------------

    /**
     * Load all action data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<{action: Array<RawAction>}>} Raw action data
     * @throws {Error} If data loading fails
     */
    async loadActions(options = {}) {
        return this.getOrLoadData('actions', async () => {
            try {
                const actionData = await this.loadJsonFile(this._dataFiles.actions, {
                    ...options,
                    maxRetries: 3
                }).catch(error => {
                    console.error('Failed to load action data:', error);
                    throw new Error('Failed to load action data');
                });

                if (!actionData || !actionData.action) {
                    throw new Error('Invalid or empty action data');
                }

                const data = {
                    action: actionData.action || []
                };

                return data;
            } catch (error) {
                console.error('Error loading actions:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load actions in chunks for better performance
     * @param {number} chunkSize - Size of each chunk (defaults to 10)
     * @param {Object} options - Loading options
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {AsyncGenerator<{type: string, items: Array<RawAction>}>} Generator yielding chunks of action data
     * @throws {Error} If data loading fails
     */
    async *loadActionsInChunks(chunkSize = 10, options = {}) {
        try {
            const data = await this.loadActions(options);

            if (data.action && Array.isArray(data.action)) {
                for (let i = 0; i < data.action.length; i += chunkSize) {
                    yield {
                        type: 'action',
                        items: data.action.slice(i, i + chunkSize)
                    };
                }
            }
        } catch (error) {
            console.error('Error loading actions in chunks:', error);
            throw error;
        }
    }
} 