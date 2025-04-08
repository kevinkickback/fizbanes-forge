/**
 * SpellLoader
 * Handles loading and caching of spell data
 * 
 * @typedef {Object} RawSpell
 * @property {string} name - Spell name
 * @property {string} source - Source book (e.g., "PHB")
 * @property {number} page - Page number
 * @property {boolean} [srd] - Whether spell is in SRD
 * @property {boolean} [basicRules] - Whether spell is in Basic Rules
 * @property {Array<string>} [reprintedAs] - References to reprints
 * @property {number|string} level - Spell level (0-9)
 * @property {string} school - Magic school code (e.g., "C" for Conjuration)
 * @property {Array<Object>} time - Casting time details
 * @property {Object} range - Range information
 * @property {string} range.type - Range type (e.g., "point")
 * @property {Object} range.distance - Distance details
 * @property {Object} components - Spell components
 * @property {boolean} components.v - Verbal component
 * @property {boolean} components.s - Somatic component
 * @property {string} [components.m] - Material component description
 * @property {Array<Object>} duration - Duration details
 * @property {Array<string>} entries - Spell description text
 * @property {Object} [scalingLevelDice] - Scaling damage information
 * @property {Array<string>} [damageInflict] - Types of damage inflicted
 * @property {Array<string>} [savingThrow] - Required saving throws
 * @property {Array<string>} [miscTags] - Miscellaneous tags
 * @property {Array<string>} [areaTags] - Area of effect tags
 * @property {Object} [meta] - Metadata like ritual status
 * @property {Array<Object>} [entriesHigherLevel] - Higher level casting entries
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Spell name
 * @property {string} source - Source book
 * @property {Array<Object>} entries - Spell fluff entries
 * 
 * @typedef {Object} SpellData
 * @property {Array<RawSpell>} spell - Array of spells
 * @property {Array<RawFluff>} [spellFluff] - Array of spell fluff
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * Handles loading and caching of spell data
 */
export class SpellLoader extends BaseLoader {
    /**
     * Creates a new SpellLoader instance
     * @param {Object} [options={}] - Loader options
     */
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 200,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });

        /**
         * Base directory for spell data
         * @type {string}
         * @private
         */
        this._baseDir = 'spells';
    }

    //-------------------------------------------------------------------------
    // Index Loading Methods
    //-------------------------------------------------------------------------

    /**
     * Load spell index data
     * @param {Object} [options={}] - Loading options
     * @returns {Promise<Object>} Index data mapping sources to files
     * @private
     */
    async _loadIndex(options = {}) {
        return this.loadJsonFile(`${this._baseDir}/index.json`, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load fluff index data
     * @param {Object} [options={}] - Loading options
     * @returns {Promise<Object>} Index data mapping sources to fluff files
     * @private
     */
    async _loadFluffIndex(options = {}) {
        return this.loadJsonFile(`${this._baseDir}/fluff-index.json`, {
            ...options,
            maxRetries: 2
        }).catch(() => ({}));
    }

    //-------------------------------------------------------------------------
    // Spell Data Loading Methods
    //-------------------------------------------------------------------------

    /**
     * Load spell data from a source file
     * @param {string} filePath - Source file path
     * @param {Object} [options={}] - Loading options
     * @returns {Promise<Object>} Raw spell data from source
     * @private
     */
    async _loadSourceFile(filePath, options = {}) {
        return this.loadJsonFile(`${this._baseDir}/${filePath}`, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load spell fluff data from a source file
     * @param {string} filePath - Source file path
     * @param {Object} [options={}] - Loading options
     * @returns {Promise<Object>} Raw fluff data from source
     * @private
     */
    async _loadFluffFile(filePath, options = {}) {
        return this.loadJsonFile(`${this._baseDir}/${filePath}`, {
            ...options,
            maxRetries: 2
        }).catch(() => ({ spellFluff: [] }));
    }

    //-------------------------------------------------------------------------
    // Public API Methods
    //-------------------------------------------------------------------------

    /**
     * Load all spell data
     * @param {Object} [options={}] - Loading options
     * @returns {Promise<{spell: RawSpell[], spellFluff: RawFluff[]}>} Raw spell data
     */
    async loadSpells(options = {}) {
        return this.getOrLoadData('spells', async () => {
            try {
                // Load indexes
                const [index, fluffIndex] = await Promise.all([
                    this._loadIndex(options),
                    this._loadFluffIndex(options)
                ]);

                // Load all spell data files
                const spellPromises = Object.entries(index).map(([source, file]) =>
                    this._loadSourceFile(file, options)
                );

                // Load all fluff data files
                const fluffPromises = Object.entries(fluffIndex).map(([source, file]) =>
                    this._loadFluffFile(file, options)
                );

                // Wait for all data to load
                const [spellResults, fluffResults] = await Promise.all([
                    Promise.all(spellPromises),
                    Promise.all(fluffPromises)
                ]);

                // Combine all spell data
                const data = {
                    spell: [],
                    spellFluff: []
                };

                // Merge spell data
                for (const result of spellResults) {
                    if (result && Array.isArray(result.spell)) {
                        data.spell.push(...result.spell);
                    }
                }

                // Merge fluff data
                for (const result of fluffResults) {
                    if (result && Array.isArray(result.spellFluff)) {
                        data.spellFluff.push(...result.spellFluff);
                    }
                }

                if (!data.spell.length) {
                    throw new Error('No valid spell data loaded');
                }

                console.debug(`Loaded ${data.spell.length} spells`);
                return data;
            } catch (error) {
                console.error('Error loading spells:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load spells in chunks for better performance
     * @param {number} [chunkSize=20] - Size of each chunk
     * @param {Object} [options={}] - Loading options
     * @returns {AsyncGenerator<{type: string, items: RawSpell[]}>} Generator yielding chunks of spell data
     */
    async *loadSpellsInChunks(chunkSize = 20, options = {}) {
        const data = await this.loadSpells(options);

        if (data.spell && Array.isArray(data.spell)) {
            for (let i = 0; i < data.spell.length; i += chunkSize) {
                yield {
                    type: 'spell',
                    items: data.spell.slice(i, i + chunkSize)
                };
            }
        }
    }
} 