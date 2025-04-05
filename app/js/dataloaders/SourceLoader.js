import { BaseLoader } from './BaseLoader.js';

/**
 * SourceLoader.js
 * Handles loading and caching of source book data
 * 
 * @typedef {Object} RawSource
 * @property {string} id - Source identifier
 * @property {string} name - Source name
 * @property {string} abbreviation - Source abbreviation
 * @property {string} group - Source group
 * @property {string} version - Source version
 * @property {boolean} hasErrata - Whether the source has errata
 * @property {string} targetLanguage - Source language
 * @property {string|null} url - Source URL
 * @property {string|null} description - Source description
 * @property {Object|null} contents - Source contents
 * @property {boolean} isDefault - Whether source is default
 */

export class SourceLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 7200000 // 2 hours
        });
    }

    /**
     * Load all source data
     * @param {Object} options - Loading options
     * @returns {Promise<{source: RawSource[]}>} Raw source data
     */
    async loadSources(options = {}) {
        return this.getOrLoadData('sources', async () => {
            try {
                // Note: BaseLoader's loadJsonFile already prepends 'data/' to the path
                const data = await this.loadJsonFile('books.json', {
                    ...options,
                    maxRetries: 3
                });

                if (!data?.book?.length) {
                    throw new Error('No valid source data loaded');
                }

                // Transform book data into source format
                const sources = data.book.map(book => ({
                    id: book.id,
                    name: book.name,
                    abbreviation: book.id,
                    isCore: book.isCore || false,
                    group: book.group,
                    version: book.version,
                    hasErrata: book.hasErrata || false,
                    targetLanguage: book.targetLanguage || 'en',
                    url: book.url || null,
                    description: book.description || null,
                    contents: book.contents || null,
                    isDefault: book.isDefault || false
                }));

                console.debug(`Loaded ${sources.length} sources`);
                return { source: sources };
            } catch (error) {
                console.error('Error loading sources:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load sources in chunks for better performance
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<{type: string, items: RawSource[]}>} Generator yielding chunks of source data
     */
    async *loadSourcesInChunks(chunkSize = 20, options = {}) {
        const data = await this.loadSources(options);

        if (data.source && Array.isArray(data.source)) {
            for (let i = 0; i < data.source.length; i += chunkSize) {
                yield {
                    type: 'source',
                    items: data.source.slice(i, i + chunkSize)
                };
            }
        }
    }

    /**
     * Get source by ID
     * @param {string} sourceId - Source identifier
     * @param {Object} options - Loading options
     * @returns {Promise<RawSource|null>} Raw source data or null if not found
     */
    async getSourceById(sourceId, options = {}) {
        const cacheKey = `source_${sourceId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSources(options);
            return data.source.find(s => s.id?.toLowerCase() === sourceId.toLowerCase()) || null;
        }, options);
    }
} 