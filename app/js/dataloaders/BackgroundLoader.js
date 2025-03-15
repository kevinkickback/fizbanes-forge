/**
 * BackgroundLoader.js
 * Handles loading and caching of background data
 * 
 * @typedef {Object} RawBackground
 * @property {string} name - Background name
 * @property {string} [source] - Source book
 * @property {number} [page] - Page number
 * @property {Array<Object>} [entries] - Background description entries
 * @property {Object} [proficiencies] - Background proficiencies
 * @property {Array<Object>} [startingEquipment] - Starting equipment
 * @property {Array<Object>} [feature] - Background features
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Background name
 * @property {string} [source] - Source book
 * @property {Array<Object>} entries - Descriptive entries
 * 
 * @typedef {Object} BackgroundData
 * @property {Array<RawBackground>} background - Array of backgrounds
 * @property {Array<RawFluff>} fluff - Array of background fluff data
 */

import { BaseLoader } from './BaseLoader.js';

export class BackgroundLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            backgrounds: 'backgrounds.json',
            fluff: 'fluff-backgrounds.json'
        };
    }

    /**
     * Load all background data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<BackgroundData>} Raw background data
     */
    async loadBackgrounds(options = {}) {
        return this.getOrLoadData('backgrounds', async () => {
            try {
                const [backgroundData, fluffData] = await Promise.all([
                    this.loadJsonFile(this.dataFiles.backgrounds, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load background data:', error);
                        throw new Error('Failed to load background data');
                    }),
                    this.loadJsonFile(this.dataFiles.fluff, {
                        ...options,
                        maxRetries: 2
                    }).catch(() => ({ backgroundFluff: [] }))
                ]);

                if (!backgroundData || !backgroundData.background) {
                    throw new Error('Invalid or empty background data');
                }

                const data = {
                    background: backgroundData.background,
                    fluff: fluffData.backgroundFluff || []
                };

                console.log(`Loaded ${data.background.length} backgrounds`);
                return data;
            } catch (error) {
                console.error('Error loading backgrounds:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load backgrounds in chunks for better performance
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Array<RawBackground>>} Generator yielding chunks of raw background data
     */
    async *loadBackgroundsInChunks(chunkSize = 5, options = {}) {
        const data = await this.loadBackgrounds(options);

        if (data.background && Array.isArray(data.background)) {
            for (let i = 0; i < data.background.length; i += chunkSize) {
                yield data.background.slice(i, i + chunkSize);
            }
        }
    }

    /**
     * Get raw background data by ID
     * @param {string} backgroundId - Background identifier (format: "name_source" in lowercase)
     * @param {Object} options - Loading options
     * @returns {Promise<RawBackground|null>} Raw background data or null if not found
     */
    async getBackgroundById(backgroundId, options = {}) {
        const cacheKey = `background_${backgroundId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadBackgrounds(options);
            return data.background.find(bg => {
                const source = (bg.source || 'phb').toLowerCase();
                const name = bg.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return `${name}_${source}` === backgroundId.toLowerCase();
            }) || null;
        }, options);
    }

    /**
     * Get raw fluff data for a background
     * @param {string} backgroundName - Background name
     * @param {string} source - Source book
     * @param {Object} options - Loading options
     * @returns {Promise<RawFluff|null>} Raw fluff data or null if not found
     */
    async getBackgroundFluff(backgroundName, source, options = {}) {
        const cacheKey = `fluff_${backgroundName}_${source}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadBackgrounds(options);
            return data.fluff.find(f =>
                f.name === backgroundName &&
                (f.source === source || !f.source)
            ) || null;
        }, options);
    }
} 