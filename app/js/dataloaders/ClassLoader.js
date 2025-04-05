/**
 * ClassLoader.js
 * Handles loading and caching of class data
 * 
 * @typedef {Object} RawClass
 * @property {string} name - Class name
 * @property {string} [source] - Source book
 * @property {number} [page] - Page number
 * @property {boolean} [srd] - Whether it's in the SRD
 * @property {boolean} [basicRules] - Whether it's in the Basic Rules
 * @property {Object} hd - Hit die information
 * @property {number} hd.number - Number of dice
 * @property {number} hd.faces - Number of faces on the die
 * @property {Array<string>} [proficiency] - Proficiency bonus progression
 * @property {Object} [spellcasting] - Spellcasting information
 * @property {Array<Object>} [startingProficiencies] - Starting proficiencies
 * @property {Array<Object>} [startingEquipment] - Starting equipment
 * @property {Object} [multiclassing] - Multiclassing requirements
 * @property {Array<Object>} [classFeatures] - Class features
 * @property {string} [subclassTitle] - Title for subclasses
 * 
 * @typedef {Object} RawSubclass
 * @property {string} name - Subclass name
 * @property {string} [shortName] - Short display name
 * @property {string} [source] - Source book
 * @property {string} className - Parent class name
 * @property {string} [classSource] - Parent class source
 * @property {number} [page] - Page number
 * @property {Object} [spellcasting] - Spellcasting information
 * @property {Object} [additionalSpells] - Additional spells granted
 * @property {Array<Object>} [features] - Subclass features
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Class name
 * @property {string} [source] - Source book
 * @property {Array<Object>} entries - Descriptive entries
 * 
 * @typedef {Object} ClassData
 * @property {Array<RawClass>} class - Array of classes
 * @property {Array<RawSubclass>} subclass - Array of subclasses
 * @property {Array<RawFluff>} fluff - Array of class fluff data
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * ClassLoader.js
 * Handles loading and caching of class data
 */
export class ClassLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 100,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            index: 'class/index.json',
            fluffIndex: 'class/fluff-index.json'
        };
    }

    /**
     * Load class index data
     * @private
     */
    async loadClassIndex(options = {}) {
        return this.loadJsonFile(this.dataFiles.index, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load fluff index data
     * @private
     */
    async loadFluffIndex(options = {}) {
        return this.loadJsonFile(this.dataFiles.fluffIndex, {
            ...options,
            maxRetries: 2
        }).catch(() => ({}));
    }

    /**
     * Load individual class data
     * @private
     */
    async loadClassData(classKey, options = {}) {
        const index = await this.loadClassIndex(options);
        if (!index[classKey]) return null;

        return this.loadJsonFile(`class/${index[classKey]}`, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load individual class fluff data
     * @private
     */
    async loadClassFluff(classKey, options = {}) {
        const fluffIndex = await this.loadFluffIndex(options);
        if (!fluffIndex[classKey]) return null;

        const fluffData = await this.loadJsonFile(`class/${fluffIndex[classKey]}`, {
            ...options,
            maxRetries: 2
        }).catch(() => null);

        return fluffData?.classFluff?.[0] || null;
    }

    /**
     * Load all class data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<ClassData>} Raw class data
     */
    async loadClasses(options = {}) {
        return this.getOrLoadData('classes', async () => {
            try {
                const index = await this.loadClassIndex(options);
                const classKeys = Object.keys(index);

                // Load all class data in parallel
                const classDataPromises = classKeys.map(key =>
                    this.loadClassData(key, options)
                );
                const fluffDataPromises = classKeys.map(key =>
                    this.loadClassFluff(key, options)
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

                console.debug(`Loaded ${data.class.length} classes, ${data.subclass.length} subclasses, and ${data.fluff.length} fluff entries`);
                return data;
            } catch (error) {
                console.error('Error loading classes:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load classes in chunks for better performance
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
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

    /**
     * Get raw class data by ID
     * @param {string} classId - Class identifier (format: "name_source" in lowercase)
     * @param {Object} options - Loading options
     * @returns {Promise<RawClass|null>} Raw class data or null if not found
     */
    async getClassById(classId, options = {}) {
        const cacheKey = `class_${classId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadClasses(options);
            return data.class.find(cls => {
                const source = (cls.source || 'phb').toLowerCase();
                const name = cls.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return `${name}_${source}` === classId.toLowerCase();
            }) || null;
        }, options);
    }

    /**
     * Get raw subclass data for a class
     * @param {string} classId - Class identifier (format: "name_source" in lowercase)
     * @param {Object} options - Loading options
     * @returns {Promise<Array<RawSubclass>>} Array of raw subclass data
     */
    async getSubclasses(classId, options = {}) {
        const cacheKey = `subclasses_${classId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadClasses(options);
            const cls = await this.getClassById(classId);
            if (!cls) return [];

            return data.subclass.filter(sub =>
                sub.className === cls.name &&
                (sub.classSource || 'phb').toLowerCase() === (cls.source || 'phb').toLowerCase()
            );
        }, options);
    }

    /**
     * Get raw fluff data for a class
     * @param {string} className - Class name
     * @param {string} source - Source book
     * @param {Object} options - Loading options
     * @returns {Promise<RawFluff|null>} Raw fluff data or null if not found
     */
    async getClassFluff(className, source, options = {}) {
        const cacheKey = `fluff_${className}_${source}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadClasses(options);
            const fluff = data.fluff.find(f =>
                f.name.toLowerCase() === className.toLowerCase() &&
                (f.source?.toLowerCase() === source.toLowerCase() || (!f.source && source.toLowerCase() === 'phb'))
            );
            if (!fluff) {
                console.log(`No fluff found for class ${className} from source ${source}`);
            }
            return fluff || null;
        }, options);
    }
} 