/**
 * RaceLoader.js
 * Handles loading and caching of race data
 * 
 * @typedef {Object} RawRace
 * @property {string} name - Race name
 * @property {string} [source] - Source book
 * @property {number} [page] - Page number
 * @property {Object|string} size - Size information
 * @property {Object|number} speed - Movement speeds
 * @property {Array} [ability] - Ability score improvements
 * @property {Object} [age] - Age information
 * @property {string} [alignment] - Typical alignment
 * @property {Object} [languages] - Language proficiencies
 * @property {Array} [entries] - Race description entries
 * 
 * @typedef {Object} RawSubrace
 * @property {string} name - Subrace name
 * @property {string} raceName - Parent race name
 * @property {string} [source] - Source book
 * @property {Array} [ability] - Ability score improvements
 * @property {Array} [entries] - Subrace description entries
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Race name
 * @property {string} [source] - Source book
 * @property {Array} entries - Descriptive entries
 * 
 * @typedef {Object} RaceData
 * @property {Array<RawRace>} race - Array of races
 * @property {Array<RawSubrace>} subrace - Array of subraces
 * @property {Array<RawFluff>} fluff - Array of race fluff data
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * RaceLoader.js
 * Handles loading and caching of race data
 */
export class RaceLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            races: 'races.json',
            fluff: 'fluff-races.json'
        };
    }

    /**
     * Load all race data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<RaceData>} Raw race data
     */
    async loadRaces(options = {}) {
        const cacheKey = 'races_all';
        return this.getOrLoadData(cacheKey, async () => {
            try {
                console.log('Loading race data...');
                const [raceData, fluffData] = await Promise.all([
                    this.loadJsonFile(this.dataFiles.races, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load race data:', error);
                        throw new Error('Failed to load race data');
                    }),
                    this.loadJsonFile(this.dataFiles.fluff, {
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

                console.log(`Loaded ${filteredData.race.length} races and ${filteredData.subrace.length} subraces`);
                return filteredData;
            } catch (error) {
                console.error('Error loading races:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load races in chunks for better performance with large datasets
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @yields {Promise<Array<RawRace|RawSubrace>>} Generator yielding chunks of raw race data
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

    /**
     * Get raw race data by ID
     * @param {string} raceId - Race identifier (format: "name_source" in lowercase)
     * @param {Object} options - Loading options
     * @returns {Promise<RawRace|null>} Raw race data or null if not found
     */
    async getRaceById(raceId, options = {}) {
        const cacheKey = `race_${raceId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadRaces(options);
            return data.race.find(r => {
                const source = (r.source || 'phb').toLowerCase();
                const name = (r.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return `${name}_${source}` === raceId.toLowerCase();
            }) || null;
        }, options);
    }

    /**
     * Get raw subrace data for a race
     * @param {string} raceId - Race identifier (format: "name_source" in lowercase)
     * @param {Object} options - Loading options
     * @returns {Promise<Array<RawSubrace>>} Array of raw subrace data
     */
    async getSubraces(raceId, options = {}) {
        const cacheKey = `subraces_${raceId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadRaces();
            const race = await this.getRaceById(raceId);
            if (!race) return [];

            return data.subrace.filter(sub =>
                sub.raceName === race.name &&
                (sub.source || 'phb').toLowerCase() === (race.source || 'phb').toLowerCase()
            );
        }, options);
    }

    /**
     * Get raw fluff data for a race
     * @param {string} raceName - Race name
     * @param {string} source - Source book
     * @param {Object} options - Loading options
     * @returns {Promise<RawFluff|null>} Raw fluff data or null if not found
     */
    async getRaceFluff(raceName, source, options = {}) {
        const cacheKey = `fluff_${raceName}_${source}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadRaces(options);
            return data.fluff.find(f =>
                f.name === raceName &&
                (f.source === source || !f.source)
            ) || null;
        }, options);
    }
} 