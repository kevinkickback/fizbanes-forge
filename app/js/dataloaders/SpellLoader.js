/**
 * SpellLoader.js
 * Handles loading and caching of spell data
 * 
 * @typedef {Object} RawSpell
 * @property {string} name - Name of the spell
 * @property {string} source - Source book identifier
 * @property {number} level - Spell level
 * @property {Object} school - School of magic
 * @property {Object} range - Range and targeting information
 * @property {Object} components - Spell components
 * @property {Array<Object>} duration - Duration details
 * @property {Array<Object>} entries - Description entries
 * @property {Object} classes - Classes that can cast the spell
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * SpellLoader.js
 * Handles loading and caching of spell data
 */
export class SpellLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 200,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.baseDir = 'spells';
    }

    /**
     * Load spell index data
     * @private
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Index data mapping sources to files
     */
    async loadIndex(options = {}) {
        return this.loadJsonFile(`${this.baseDir}/index.json`, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load fluff index data
     * @private
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Index data mapping sources to fluff files
     */
    async loadFluffIndex(options = {}) {
        return this.loadJsonFile(`${this.baseDir}/fluff-index.json`, {
            ...options,
            maxRetries: 2
        }).catch(() => ({}));
    }

    /**
     * Load spell data from a source file
     * @private
     * @param {string} filePath - Source file path
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Raw spell data from source
     */
    async loadSourceFile(filePath, options = {}) {
        return this.loadJsonFile(`${this.baseDir}/${filePath}`, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load spell fluff data from a source file
     * @private
     * @param {string} filePath - Source file path
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Raw fluff data from source
     */
    async loadFluffFile(filePath, options = {}) {
        return this.loadJsonFile(`${this.baseDir}/${filePath}`, {
            ...options,
            maxRetries: 2
        }).catch(() => ({ spellFluff: [] }));
    }

    /**
     * Load all spell data
     * @param {Object} options - Loading options
     * @returns {Promise<{spell: RawSpell[], spellFluff: RawFluff[]}>} Raw spell data
     */
    async loadSpells(options = {}) {
        return this.getOrLoadData('spells', async () => {
            try {

                // Load indexes
                const [index, fluffIndex] = await Promise.all([
                    this.loadIndex(options),
                    this.loadFluffIndex(options)
                ]);

                // Load all spell data files
                const spellPromises = Object.entries(index).map(([source, file]) =>
                    this.loadSourceFile(file, options)
                );

                // Load all fluff data files
                const fluffPromises = Object.entries(fluffIndex).map(([source, file]) =>
                    this.loadFluffFile(file, options)
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
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
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

    /**
     * Get spell by ID
     * @param {string} spellId - Spell identifier (format: "name_source" in lowercase)
     * @param {Object} options - Loading options
     * @returns {Promise<RawSpell|null>} Raw spell data or null if not found
     */
    async getSpellById(spellId, options = {}) {
        const cacheKey = `spell_${spellId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSpells(options);
            return data.spell.find(s => {
                const source = (s.source || 'phb').toLowerCase();
                const name = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return `${name}_${source}` === spellId.toLowerCase();
            }) || null;
        }, options);
    }

    /**
     * Get spell fluff data
     * @param {string} name - Spell name
     * @param {string} source - Source book
     * @param {Object} options - Loading options
     * @returns {Promise<RawFluff|null>} Raw fluff data or null if not found
     */
    async getSpellFluff(name, source, options = {}) {
        const cacheKey = `spell_fluff_${name}_${source}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSpells(options);
            return data.spellFluff.find(f =>
                f.name === name &&
                (f.source || 'phb').toLowerCase() === source.toLowerCase()
            ) || null;
        }, options);
    }
} 