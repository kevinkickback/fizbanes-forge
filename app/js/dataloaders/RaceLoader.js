/**
 * RaceLoader
 * Handles loading and caching of race data
 * 
 * @typedef {Object} RawRace
 * @property {string} name - Race name
 * @property {string} source - Source book
 * @property {number} page - Page number
 * @property {Array<string>} [otherSources] - Additional source references
 * @property {Array<string>} [reprintedAs] - Reprinted versions
 * @property {Array<string>} size - Size categories (e.g., ["M"])
 * @property {Object} speed - Movement speeds
 * @property {number} [speed.walk] - Walking speed
 * @property {number} [speed.fly] - Flying speed
 * @property {boolean} [speed.fly] - Whether race can fly
 * @property {Array<Object>} ability - Ability score adjustments
 * @property {Object} [age] - Age information
 * @property {number} [age.mature] - Age of maturity
 * @property {number} [age.max] - Maximum age
 * @property {Array<string>} [traitTags] - Trait tags
 * @property {Array<Object>} [languageProficiencies] - Language proficiencies
 * @property {Object} [soundClip] - Sound clip information
 * @property {Array<Object>} entries - Race description entries
 * @property {boolean} [hasFluff] - Whether race has fluff text
 * @property {boolean} [hasFluffImages] - Whether race has fluff images
 * @property {Array<Object>} [additionalSpells] - Additional spells granted
 * 
 * @typedef {Object} RawSubrace
 * @property {string} name - Subrace name
 * @property {string} source - Source book
 * @property {string} raceName - Parent race name
 * @property {string} raceSource - Parent race source
 * @property {Object} [ability] - Ability score adjustments
 * @property {Array<Object>} entries - Subrace description entries
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Race name
 * @property {string} source - Source book
 * @property {Array<Object>} entries - Race fluff entries
 * @property {Array<Object>} [images] - Race images
 * 
 * @typedef {Object} RaceData
 * @property {Array<RawRace>} race - Array of races
 * @property {Array<RawSubrace>} subrace - Array of subraces
 * @property {Array<RawFluff>} raceFluff - Array of race fluff data
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * Handles loading and caching of race data
 */
export class RaceLoader extends BaseLoader {
    /**
     * Creates a new RaceLoader instance
     * @param {Object} [options={}] - Loader options
     */
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });

        /**
         * Paths to race data files
         * @type {Object}
         * @private
         */
        this._dataFiles = {
            races: 'races.json',
            fluff: 'fluff-races.json'
        };
    }

    //-------------------------------------------------------------------------
    // Race Data Loading Methods
    //-------------------------------------------------------------------------

    /**
     * Load all race data
     * @param {Object} [options={}] - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<RaceData>} Raw race data
     */
    async loadRaces(options = {}) {
        return this.getOrLoadData('races_all', async () => {
            try {
                const [raceData, fluffData] = await Promise.all([
                    this.loadJsonFile(this._dataFiles.races, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load race data:', error);
                        throw new Error('Failed to load race data');
                    }),
                    this.loadJsonFile(this._dataFiles.fluff, {
                        ...options,
                        maxRetries: 2
                    }).catch(() => ({ raceFluff: [] }))
                ]);

                if (!raceData || !raceData.race) {
                    throw new Error('Invalid or empty race data');
                }

                const filteredData = {
                    race: raceData.race,
                    subrace: raceData.subrace || [],
                    fluff: fluffData.raceFluff || []
                };

                console.debug(`Loaded ${filteredData.race.length} races and ${filteredData.subrace.length} subraces`);
                return filteredData;
            } catch (error) {
                console.error('Error loading races:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load races in chunks for better performance with large datasets
     * @param {number} [chunkSize=10] - Size of each chunk
     * @param {Object} [options={}] - Loading options
     * @returns {AsyncGenerator<Array<RawRace|RawSubrace>>} Generator yielding chunks of raw race data
     */
    async *loadRacesInChunks(chunkSize = 10, options = {}) {
        const data = await this.loadRaces(options);

        // Yield races in chunks
        if (data.race && Array.isArray(data.race)) {
            for (let i = 0; i < data.race.length; i += chunkSize) {
                yield data.race.slice(i, i + chunkSize);
            }
        }

        // Yield subraces in chunks
        if (data.subrace && Array.isArray(data.subrace)) {
            for (let i = 0; i < data.subrace.length; i += chunkSize) {
                yield data.subrace.slice(i, i + chunkSize);
            }
        }
    }
} 