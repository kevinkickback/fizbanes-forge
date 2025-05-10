/**
 * ClassLoader.js
 * Handles loading and caching of class data
 * 
 * @typedef {Object} RawClass
 * @property {string} name - Class name
 * @property {string} source - Source book
 * @property {number} page - Page number
 * @property {boolean} [srd] - Whether class is in SRD
 * @property {Array<string>} [reprintedAs] - Reprinted versions
 * @property {string} [edition] - Edition (e.g., "classic", "one")
 * @property {Object} hd - Hit die information
 * @property {number} hd.number - Number of dice
 * @property {number} hd.faces - Number of faces on the die
 * @property {Array<string>} proficiency - Saving throw proficiencies
 * @property {Object} startingProficiencies - Starting proficiencies
 * @property {Array<string>} [startingProficiencies.armor] - Armor proficiencies
 * @property {Array<string>} [startingProficiencies.weapons] - Weapon proficiencies
 * @property {Array<Object>} [startingProficiencies.skills] - Skill proficiencies
 * @property {Object} startingEquipment - Starting equipment
 * @property {Object} multiclassing - Multiclassing requirements and proficiencies
 * @property {Array<Object>} [classFeatures] - Class features
 * @property {Array<Object>} [classTableGroups] - Class table information
 * 
 * @typedef {Object} RawSubclass
 * @property {string} name - Subclass name
 * @property {string} source - Source book
 * @property {string} className - Parent class name
 * @property {string} [classSource] - Parent class source
 * @property {number} page - Page number
 * @property {string} [shortName] - Short display name
 * @property {Array<Object>} [features] - Subclass features
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Class name
 * @property {string} source - Source book
 * @property {Array<Object>} entries - Class fluff entries
 * @property {Array<Object>} [images] - Class images
 * 
 * @typedef {Object} ClassData
 * @property {Array<RawClass>} class - Array of classes
 * @property {Array<RawSubclass>} subclass - Array of subclasses
 * @property {Array<RawFluff>} classFluff - Array of class fluff data
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * Handles loading and caching of class data
 */
export class ClassLoader extends BaseLoader {
    /**
     * Creates a new ClassLoader instance
     * @param {Object} [options={}] - Loader options
     */
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 100,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });

        /**
         * Data file paths for class data
         * @type {Object}
         * @private
         */
        this._dataFiles = {
            index: 'class/index.json',
            fluffIndex: 'class/fluff-index.json'
        };
    }

    //-------------------------------------------------------------------------
    // Index Loading Methods
    //-------------------------------------------------------------------------

    /**
     * Load class index data
     * @param {Object} [options={}] - Loading options
     * @returns {Promise<Object>} Class index data
     * @private
     */
    async _loadClassIndex(options = {}) {
        return this.loadJsonFile(this._dataFiles.index, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load fluff index data
     * @param {Object} [options={}] - Loading options
     * @returns {Promise<Object>} Fluff index data or empty object if not found
     * @private
     */
    async _loadFluffIndex(options = {}) {
        return this.loadJsonFile(this._dataFiles.fluffIndex, {
            ...options,
            maxRetries: 2
        }).catch(() => ({}));
    }

    //-------------------------------------------------------------------------
    // Class Data Loading Methods
    //-------------------------------------------------------------------------

    /**
     * Load individual class data
     * @param {string} classKey - The class key in the index
     * @param {Object} [options={}] - Loading options
     * @returns {Promise<Object|null>} Class data or null if not found
     * @private
     */
    async _loadClassData(classKey, options = {}) {
        const index = await this._loadClassIndex(options);
        if (!index[classKey]) return null;

        return this.loadJsonFile(`class/${index[classKey]}`, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load individual class fluff data
     * @param {string} classKey - The class key in the fluff index
     * @param {Object} [options={}] - Loading options
     * @returns {Promise<Object|null>} Fluff data or null if not found
     * @private
     */
    async _loadClassFluff(classKey, options = {}) {
        const fluffIndex = await this._loadFluffIndex(options);
        if (!fluffIndex[classKey]) return null;

        const fluffData = await this.loadJsonFile(`class/${fluffIndex[classKey]}`, {
            ...options,
            maxRetries: 2
        }).catch(() => null);

        return fluffData?.classFluff?.[0] || null;
    }

    /**
     * Load all class data
     * @param {Object} [options={}] - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<ClassData>} Raw class data
     */
    async loadClasses(options = {}) {
        return this.getOrLoadData('classes', async () => {
            try {
                const index = await this._loadClassIndex(options);
                const classKeys = Object.keys(index);

                // Load all class data in parallel
                const classDataPromises = classKeys.map(key =>
                    this._loadClassData(key, options)
                );
                const fluffDataPromises = classKeys.map(key =>
                    this._loadClassFluff(key, options)
                );

                const [classDataResults, fluffDataResults] = await Promise.all([
                    Promise.all(classDataPromises),
                    Promise.all(fluffDataPromises)
                ]);

                // Combine the data
                const data = {
                    class: [],
                    subclass: [],
                    fluff: []
                };

                // Process class data
                classDataResults.forEach((classData, index) => {
                    if (!classData) return;

                    if (classData.class) {
                        data.class.push(...classData.class);
                    }
                    if (classData.subclass) {
                        data.subclass.push(...classData.subclass);
                    }

                    // Associate classFeature array with its class
                    if (classData.classFeature && Array.isArray(classData.classFeature) && classData.class && classData.class.length > 0) {
                        // Find the main class
                        const mainClass = classData.class.find(c => c.name && c.source === 'PHB');
                        if (mainClass) {
                            mainClass.classFeature = classData.classFeature;
                        }
                    }
                });

                // Add fluff data
                for (const fluff of fluffDataResults) {
                    if (fluff) {
                        data.fluff.push(fluff);
                    }
                }

                return data;
            } catch (error) {
                console.error('Error loading classes:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load classes in chunks for better performance
     * @param {number} [chunkSize=5] - Size of each chunk
     * @param {Object} [options={}] - Loading options
     * @returns {AsyncGenerator<Array<RawClass|RawSubclass>>} Generator yielding chunks of raw class data
     */
    async *loadClassesInChunks(chunkSize = 5, options = {}) {
        const data = await this.loadClasses(options);

        // Yield classes in chunks
        if (data.class && Array.isArray(data.class)) {
            for (let i = 0; i < data.class.length; i += chunkSize) {
                yield data.class.slice(i, i + chunkSize);
            }
        }

        // Yield subclasses in chunks
        if (data.subclass && Array.isArray(data.subclass)) {
            for (let i = 0; i < data.subclass.length; i += chunkSize) {
                yield data.subclass.slice(i, i + chunkSize);
            }
        }
    }
} 