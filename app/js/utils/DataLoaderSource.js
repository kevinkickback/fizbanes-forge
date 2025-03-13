import { DataLoader } from './DataLoader.new.js';

/**
 * DataLoaderSource.js
 * Handles loading and processing of source books and content sources
 */
export class DataLoaderSource extends DataLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50, // Sources don't need large cache
            defaultExpiry: options.defaultExpiry || 7200000 // 2 hours, since source data changes infrequently
        });
        this.dataFiles = {
            sources: 'books.json'
        };
    }

    /**
     * Load all source data with improved caching and chunking
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Processed source data
     */
    async loadSources(options = {}) {
        return this.getOrLoadData('sources', async () => {
            try {
                const sourceData = await this.loadJsonFile(this.dataFiles.sources, {
                    ...options,
                    transform: data => this.processSourceData(data)
                });
                return sourceData;
            } catch (error) {
                console.error('Error loading sources:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load sources in chunks for better performance with large datasets
     * @param {number} chunkSize - Size of each chunk
     * @returns {AsyncGenerator<Object[]>} Generator yielding chunks of source data
     */
    async *loadSourcesInChunks(chunkSize = 20) {
        const data = await this.loadSources();
        if (data.sources && Array.isArray(data.sources)) {
            for (let i = 0; i < data.sources.length; i += chunkSize) {
                yield data.sources.slice(i, i + chunkSize);
            }
        }
    }

    /**
     * Process raw source data into standardized format
     * @private
     * @param {Object} sourceData - Raw source data
     * @returns {Object} Processed source data
     */
    processSourceData(sourceData) {
        const processedData = {
            sources: []
        };

        if (sourceData.source) {
            processedData.sources = sourceData.source.map(source => ({
                id: source.id?.toLowerCase(),
                name: source.name,
                abbreviation: source.abbreviation || source.id,
                group: source.group || 'official',
                date: this.processDate(source.date),
                version: source.version || '1.0',
                hasErrata: source.hasErrata || false,
                reprintedAs: source.reprintedAs || null,
                targetLanguage: source.targetLanguage || 'en',
                availability: this.processAvailability(source.availability),
                url: source.url || null,
                coverUrl: source.coverUrl || null,
                description: source.description || null,
                contents: this.processContents(source.contents),
                includesModules: source.includesModules || [],
                requirements: source.requirements || null,
                isLicensed: source.isLicensed || false,
                isDefault: source.isDefault || false,
                isSupplemental: source.isSupplemental || false,
                isThirdParty: source.isThirdParty || false,
                isHomebrew: source.isHomebrew || false,
                contributors: source.contributors || []
            }));

            // Sort sources by date, then name
            processedData.sources.sort((a, b) => {
                if (a.date?.published && b.date?.published) {
                    const dateCompare = new Date(b.date.published) - new Date(a.date.published);
                    if (dateCompare !== 0) return dateCompare;
                }
                return a.name.localeCompare(b.name);
            });
        }

        return processedData;
    }

    /**
     * Process publication date information
     * @private
     */
    processDate(date) {
        if (!date) return null;

        return {
            published: date.published || null,
            updated: date.updated || null,
            announced: date.announced || null,
            released: date.released || null
        };
    }

    /**
     * Process source availability information
     * @private
     */
    processAvailability(availability) {
        if (!availability) return { status: 'unknown' };

        return {
            status: availability.status || 'unknown',
            platform: availability.platform || 'all',
            isDigital: availability.isDigital ?? true,
            isPhysical: availability.isPhysical ?? true,
            price: this.processPrice(availability.price),
            url: availability.url || null
        };
    }

    /**
     * Process price information
     * @private
     */
    processPrice(price) {
        if (!price) return null;

        return {
            value: price.value || 0,
            currency: price.currency || 'USD',
            isSubscription: price.isSubscription || false,
            interval: price.interval || null
        };
    }

    /**
     * Process source contents
     * @private
     */
    processContents(contents) {
        if (!contents) return null;

        return {
            races: contents.races || [],
            classes: contents.classes || [],
            subclasses: contents.subclasses || [],
            backgrounds: contents.backgrounds || [],
            feats: contents.feats || [],
            spells: contents.spells || [],
            items: contents.items || [],
            monsters: contents.monsters || [],
            rules: contents.rules || [],
            optional: contents.optional || [],
            adventures: contents.adventures || []
        };
    }

    /**
     * Get source by ID with improved caching
     * @param {string} sourceId - Source identifier
     * @param {Object} options - Loading options
     * @returns {Promise<Object|null>} Source data or null if not found
     */
    async getSourceById(sourceId, options = {}) {
        const cacheKey = `source_${sourceId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSources();
            return data.sources.find(source => source.id === sourceId.toLowerCase()) || null;
        }, options);
    }

    /**
     * Get sources by group with improved caching
     * @param {string} group - Group name
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of sources in the specified group
     */
    async getSourcesByGroup(group, options = {}) {
        const cacheKey = `sources_group_${group}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSources();
            return data.sources.filter(source =>
                source.group.toLowerCase() === group.toLowerCase()
            );
        }, options);
    }

    /**
     * Get default sources with improved caching
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of default sources
     */
    async getDefaultSources(options = {}) {
        const cacheKey = 'sources_default';
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSources();
            return data.sources.filter(source => source.isDefault);
        }, options);
    }

    /**
     * Get sources by content type with improved caching
     * @param {string} contentType - Type of content to filter by
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of sources containing the specified content type
     */
    async getSourcesByContentType(contentType, options = {}) {
        const cacheKey = `sources_content_${contentType}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSources();
            return data.sources.filter(source =>
                source.contents?.[contentType]?.length > 0
            );
        }, options);
    }

    /**
     * Get sources by language with improved caching
     * @param {string} language - Language code
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of sources in the specified language
     */
    async getSourcesByLanguage(language, options = {}) {
        const cacheKey = `sources_lang_${language}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSources();
            return data.sources.filter(source =>
                source.targetLanguage === language
            );
        }, options);
    }

    /**
     * Get sources with errata with improved caching
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of sources that have errata
     */
    async getSourcesWithErrata(options = {}) {
        const cacheKey = 'sources_with_errata';
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSources();
            return data.sources.filter(source => source.hasErrata);
        }, options);
    }

    /**
     * Get sources by availability status
     * @param {string} status - Availability status
     * @returns {Promise<Array>} Array of sources with the specified availability status
     */
    async getSourcesByAvailability(status) {
        const data = await this.loadSources();
        return data.sources.filter(source =>
            source.availability.status.toLowerCase() === status.toLowerCase()
        );
    }

    /**
     * Get sources by platform
     * @param {string} platform - Platform name
     * @returns {Promise<Array>} Array of sources available on the specified platform
     */
    async getSourcesByPlatform(platform) {
        const data = await this.loadSources();
        return data.sources.filter(source =>
            source.availability.platform === 'all' ||
            source.availability.platform.toLowerCase() === platform.toLowerCase()
        );
    }

    /**
     * Check if a source is allowed
     * @param {string} sourceId - Source identifier
     * @returns {Promise<boolean>} Whether the source is allowed
     */
    async isSourceAllowed(sourceId) {
        const source = await this.getSourceById(sourceId);
        if (!source) return false;

        // Default sources are always allowed
        if (source.isDefault) return true;

        // Check if the source is enabled in user preferences
        // This would typically be implemented by the application
        return true; // Placeholder implementation
    }
} 