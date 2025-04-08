/**
 * DeityLoader
 * Handles loading and caching of deity data
 * 
 * @typedef {Object} RawDeity
 * @property {string} name - Deity name
 * @property {string} source - Source book identifier
 * @property {number} [page] - Page number
 * @property {string} [pantheon] - Pantheon the deity belongs to
 * @property {Array<string>} [alignment] - Deity's alignments
 * @property {Array<string>} [domains] - Divine domains
 * @property {string} [symbol] - Holy symbol description
 * 
 * @typedef {Object} DeityData
 * @property {Array<RawDeity>} deity - Array of raw deity data
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * Handles loading and caching of deity data
 */
export class DeityLoader extends BaseLoader {
    /**
     * Creates a new DeityLoader instance
     * @param {Object} options - Loader configuration options
     * @param {number} [options.maxCacheSize] - Maximum cache size (defaults to 100)
     * @param {number} [options.defaultExpiry] - Default cache expiry in ms (defaults to 1 hour)
     */
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 100,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this._dataFiles = {
            deities: 'deities.json'
        };
    }

    //------------------------------------------------
    // Deity Data Loading Methods
    //------------------------------------------------

    /**
     * Load all deity data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<DeityData>} Raw deity data
     * @throws {Error} If data loading fails
     */
    async loadDeities(options = {}) {
        return this.getOrLoadData('deities', async () => {
            try {
                console.debug('Loading deity data...');
                const deityData = await this.loadJsonFile(this._dataFiles.deities, {
                    ...options,
                    maxRetries: 3
                }).catch(error => {
                    console.error('Failed to load deity data:', error);
                    throw new Error('Failed to load deity data');
                });

                if (!deityData || !deityData.deity) {
                    throw new Error('Invalid or empty deity data');
                }

                const data = {
                    deity: deityData.deity || []
                };

                console.debug(`Loaded ${data.deity.length} deities`);
                return data;
            } catch (error) {
                console.error('Error loading deities:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load deities in chunks for better performance
     * @param {number} chunkSize - Size of each chunk (defaults to 10)
     * @param {Object} options - Loading options
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {AsyncGenerator<Array<RawDeity>>} Generator yielding chunks of raw deity data
     * @throws {Error} If data loading fails
     */
    async *loadDeitiesInChunks(chunkSize = 10, options = {}) {
        try {
            const data = await this.loadDeities(options);

            if (data.deity && Array.isArray(data.deity)) {
                for (let i = 0; i < data.deity.length; i += chunkSize) {
                    yield data.deity.slice(i, i + chunkSize);
                }
            }
        } catch (error) {
            console.error('Error loading deities in chunks:', error);
            throw error;
        }
    }
} 