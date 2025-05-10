/**
 * BackgroundLoader
 * Handles loading and caching of background data
 * 
 * @typedef {Object} RawBackground
 * @property {string} name - Background name
 * @property {string} source - Source book
 * @property {number} page - Page number
 * @property {boolean} [srd] - Whether background is in SRD
 * @property {boolean} [basicRules] - Whether background is in Basic Rules
 * @property {Array<string>} [reprintedAs] - Reprinted versions
 * @property {Array<Object>} [skillProficiencies] - Skill proficiencies
 * @property {Array<Object>} [languageProficiencies] - Language proficiencies
 * @property {Array<Object>} [startingEquipment] - Starting equipment
 * @property {Array<Object>} entries - Background description entries
 * @property {boolean} [hasFluff] - Whether background has fluff text
 * @property {boolean} [hasFluffImages] - Whether background has fluff images
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Background name
 * @property {string} source - Source book
 * @property {Array<Object>} entries - Background fluff entries
 * @property {Array<Object>} [images] - Background images
 * 
 * @typedef {Object} BackgroundData
 * @property {Array<RawBackground>} background - Array of backgrounds
 * @property {Array<RawFluff>} backgroundFluff - Array of background fluff
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * Handles loading and caching of background data
 */
export class BackgroundLoader extends BaseLoader {
    /**
     * Creates a new BackgroundLoader instance
     * @param {Object} [options={}] - Loader options
     */
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });

        /**
         * Paths to background data files
         * @type {Object}
         * @private
         */
        this._dataFiles = {
            backgrounds: 'backgrounds.json',
            fluff: 'fluff-backgrounds.json'
        };
    }

    /**
     * Load all background data
     * @param {Object} [options={}] - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<BackgroundData>} Raw background data
     */
    async loadBackgrounds(options = {}) {
        return this.getOrLoadData('backgrounds', async () => {
            try {
                const [backgroundData, fluffData] = await Promise.all([
                    this.loadJsonFile(this._dataFiles.backgrounds, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load background data:', error);
                        throw new Error('Failed to load background data');
                    }),
                    this.loadJsonFile(this._dataFiles.fluff, {
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

                return data;
            } catch (error) {
                console.error('Error loading backgrounds:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load backgrounds in chunks for better performance
     * @param {number} [chunkSize=5] - Size of each chunk
     * @param {Object} [options={}] - Loading options
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
     * Get a specific background by name and source
     * @param {string} name - Background name
     * @param {string} [source='PHB'] - Source book
     * @returns {Promise<RawBackground|null>} Raw background data or null if not found
     */
    async getBackground(name, source = 'PHB') {
        const data = await this.loadBackgrounds();

        return data.background.find(bg =>
            bg.name.toLowerCase() === name.toLowerCase() &&
            (bg.source === source || !source)
        ) || null;
    }

    /**
     * Get raw fluff data for a background
     * @param {string} backgroundName - Background name
     * @param {string} [source='PHB'] - Source book
     * @returns {Promise<RawFluff|null>} Raw fluff data or null if not found
     */
    async getBackgroundFluff(backgroundName, source = 'PHB') {
        const data = await this.loadBackgrounds();

        return data.fluff.find(f =>
            f.name.toLowerCase() === backgroundName.toLowerCase() &&
            (f.source === source || !source)
        ) || null;
    }
} 