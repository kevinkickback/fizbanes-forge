import { BaseLoader } from './BaseLoader.js';

/**
 * SourceLoader
 * Handles loading and caching of source book data
 * 
 * @typedef {Object} RawSource
 * @property {string} id - Source identifier
 * @property {string} name - Source name
 * @property {string} abbreviation - Source abbreviation
 * @property {string} group - Source group
 * @property {boolean} isCore - Whether the source is a core rulebook
 * @property {string} version - Source version
 * @property {boolean} hasErrata - Whether the source has errata
 * @property {string} targetLanguage - Source language
 * @property {boolean} isDefault - Whether source is default
 */

/**
 * Handles loading and caching of source book data
 */
export class SourceLoader extends BaseLoader {
    /**
     * Creates a new SourceLoader instance
     * @param {Object} options - Loader configuration options
     * @param {number} [options.maxCacheSize] - Maximum cache size (defaults to 50)
     * @param {number} [options.defaultExpiry] - Default cache expiry in ms (defaults to 2 hours)
     */
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
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<{source: RawSource[]}>} Raw source data
     * @throws {Error} If data loading fails
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

                return { source: sources };
            } catch (error) {
                console.error('Error loading sources:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load sources in chunks for better performance
     * @param {number} chunkSize - Size of each chunk (defaults to 20)
     * @param {Object} options - Loading options
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {AsyncGenerator<{type: string, items: RawSource[]}>} Generator yielding chunks of source data
     * @throws {Error} If data loading fails
     */
    async *loadSourcesInChunks(chunkSize = 20, options = {}) {
        try {
            const data = await this.loadSources(options);

            if (data.source && Array.isArray(data.source)) {
                for (let i = 0; i < data.source.length; i += chunkSize) {
                    yield {
                        type: 'source',
                        items: data.source.slice(i, i + chunkSize)
                    };
                }
            }
        } catch (error) {
            console.error('Error loading sources in chunks:', error);
            throw error;
        }
    }
} 