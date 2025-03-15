/**
 * DeityLoader.js
 * Handles loading and caching of deity data
 * 
 * @typedef {Object} RawDeity
 * @property {string} name - Name of the deity
 * @property {string} source - Source book identifier
 * @property {number} [page] - Page number in source book
 * @property {string} [pantheon] - Pantheon the deity belongs to
 * @property {Array<string>} [alignment] - Deity's alignments
 * @property {Array<string>} [domains] - Divine domains
 * @property {string} [symbol] - Holy symbol description
 * @property {Array<string>} [altNames] - Alternative names
 * @property {string} [gender] - Deity's gender
 * @property {string} [rank] - Divine rank or status
 * @property {Object} [relationships] - Relationships with other deities
 * @property {Array<string>} [worshipers] - Types of worshipers
 * @property {Object} [customProperties] - Source-specific custom properties
 * 
 * @typedef {Object} DeityData
 * @property {Array<RawDeity>} deity - Array of raw deity data
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * DeityLoader.js
 * Handles loading and caching of deity data
 */
export class DeityLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 100,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            deities: 'deities.json'
        };
    }

    /**
     * Load all deity data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<DeityData>} Raw deity data
     */
    async loadDeities(options = {}) {
        return this.getOrLoadData('deities', async () => {
            try {
                const deityData = await this.loadJsonFile(this.dataFiles.deities, {
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

                console.log(`Loaded ${data.deity.length} deities`);
                return data;
            } catch (error) {
                console.error('Error loading deities:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load deities in chunks for better performance
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Array<RawDeity>>} Generator yielding chunks of raw deity data
     */
    async *loadDeitiesInChunks(chunkSize = 10, options = {}) {
        const data = await this.loadDeities(options);

        if (data.deity && Array.isArray(data.deity)) {
            for (let i = 0; i < data.deity.length; i += chunkSize) {
                yield data.deity.slice(i, i + chunkSize);
            }
        }
    }

    /**
     * Get raw deity data by ID
     * @param {string} deityId - Deity identifier (format: "name_source" in lowercase)
     * @param {Object} options - Loading options
     * @returns {Promise<RawDeity|null>} Raw deity data or null if not found
     */
    async getDeityById(deityId, options = {}) {
        const cacheKey = `deity_${deityId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadDeities(options);
            return data.deity.find(d => {
                const source = (d.source || 'phb').toLowerCase();
                const name = d.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return `${name}_${source}` === deityId.toLowerCase();
            }) || null;
        }, options);
    }
} 