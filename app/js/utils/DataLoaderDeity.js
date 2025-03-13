import { DataLoader } from './DataLoader.new.js';

/**
 * DataLoaderDeity.js
 * Handles loading and processing of deity data with source-specific handling
 */
export class DataLoaderDeity extends DataLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 100,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            deities: 'deities.json'
        };

        // Known valid domains from PHB and other sources
        this.validDomains = new Set([
            'Arcana', 'Death', 'Forge', 'Grave', 'Knowledge', 'Life',
            'Light', 'Nature', 'Order', 'Tempest', 'Trickery', 'War',
            'Peace', 'Twilight'
        ]);

        // Valid alignments
        this.validAlignments = new Set([
            'L', 'N', 'C', 'G', 'E',
            'LG', 'LN', 'LE', 'NG', 'N', 'NE', 'CG', 'CN', 'CE'
        ]);

        // Source-specific processing flags
        this.sourceFlags = {
            MTF: { hasDetailedEntries: true, hasCategory: true, hasProvince: true },
            SCAG: { hasTitle: true, hasBasicInfo: true },
            PHB: { hasBasicInfo: true }
        };
    }

    /**
     * Load all deity data with improved caching and chunking
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Processed deity data
     */
    async loadDeities(options = {}) {
        return this.getOrLoadData('deities', async () => {
            try {
                const deityData = await this.loadJsonFile(this.dataFiles.deities, {
                    ...options,
                    maxRetries: 3
                });
                return this.processDeityData(deityData);
            } catch (error) {
                console.error('Error loading deities:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load deities in chunks for better performance with large datasets
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Object[]>} Generator yielding chunks of deity data
     */
    async *loadDeitiesInChunks(chunkSize = 10, options = {}) {
        const data = await this.loadDeities(options);

        if (data.deities && Array.isArray(data.deities)) {
            for (let i = 0; i < data.deities.length; i += chunkSize) {
                yield data.deities.slice(i, i + chunkSize);
            }
        }
    }

    /**
     * Process deity data into standardized format with source-specific handling
     * @private
     */
    processDeityData(deityData) {
        const processedData = {
            deities: []
        };

        // Filter by allowed sources
        const allowedSources = this.getAllowedSources();

        if (deityData.deity) {
            processedData.deities = deityData.deity
                .filter(deity => allowedSources.has(deity.source))
                .map(deity => this.processSourceSpecificDeity(deity));

            // Merge duplicate deities from different sources
            processedData.deities = this.mergeDuplicateDeities(processedData.deities);

            // Sort deities by name, then source
            processedData.deities.sort((a, b) => {
                const nameCompare = a.name.localeCompare(b.name);
                if (nameCompare !== 0) return nameCompare;
                return a.source.localeCompare(b.source);
            });
        }

        return processedData;
    }

    /**
     * Process individual deity based on source
     * @private
     */
    processSourceSpecificDeity(deity) {
        const sourceFlags = this.sourceFlags[deity.source] || { hasBasicInfo: true };

        const processed = {
            id: `${deity.name.toLowerCase()}_${deity.source.toLowerCase()}`,
            name: deity.name,
            source: deity.source,
            page: deity.page || null,
            pantheon: this.standardizePantheon(deity.pantheon),
            alignment: this.processAlignment(deity.alignment),
            domains: this.processDomains(deity.domains),
            symbol: this.standardizeSymbol(deity.symbol)
        };

        // Add source-specific fields
        if (sourceFlags.hasDetailedEntries) {
            processed.entries = deity.entries || [];
            processed.province = deity.province || null;
            processed.category = deity.category || null;
        }

        if (sourceFlags.hasTitle) {
            processed.title = deity.title || null;
        }

        // Optional fields that might exist in any source
        if (deity.altNames) processed.altNames = deity.altNames;
        if (deity.gender) processed.gender = this.standardizeGender(deity.gender);
        if (deity.rank) processed.rank = deity.rank;
        if (deity.relationships) processed.relationships = this.processRelationships(deity.relationships);
        if (deity.worshipers) processed.worshipers = this.standardizeWorshipers(deity.worshipers);
        if (deity.customProperties) processed.customProperties = deity.customProperties;

        return processed;
    }

    /**
     * Merge duplicate deities from different sources
     * @private
     */
    mergeDuplicateDeities(deities) {
        const deityMap = new Map();

        for (const deity of deities) {
            const key = deity.name.toLowerCase();
            if (!deityMap.has(key)) {
                deityMap.set(key, deity);
                continue;
            }

            const existing = deityMap.get(key);
            // Merge properties, preferring more detailed sources
            const merged = this.mergeDeityProperties(existing, deity);
            deityMap.set(key, merged);
        }

        return Array.from(deityMap.values());
    }

    /**
     * Merge properties of two deity entries
     * @private
     */
    mergeDeityProperties(deity1, deity2) {
        // Prefer the entry from the source with more detailed information
        const primary = this.sourceFlags[deity1.source]?.hasDetailedEntries ? deity1 : deity2;
        const secondary = primary === deity1 ? deity2 : deity1;

        return {
            ...secondary,
            ...primary,
            // Merge arrays and objects
            domains: [...new Set([...primary.domains || [], ...secondary.domains || []])],
            altNames: [...new Set([...primary.altNames || [], ...secondary.altNames || []])],
            relationships: this.mergeRelationships(primary.relationships, secondary.relationships),
            customProperties: { ...secondary.customProperties, ...primary.customProperties }
        };
    }

    /**
     * Process deity alignment with validation
     * @private
     */
    processAlignment(alignment) {
        if (!alignment) return ['N'];
        const alignments = Array.isArray(alignment) ? alignment : [alignment];
        return alignments.filter(a => this.validAlignments.has(a));
    }

    /**
     * Process deity domains with validation
     * @private
     */
    processDomains(domains) {
        if (!domains) return [];
        return domains.filter(domain => this.validDomains.has(domain));
    }

    /**
     * Process deity relationships
     * @private
     */
    processRelationships(relationships) {
        if (!relationships) return null;

        return {
            allies: this.standardizeRelationshipList(relationships.allies),
            enemies: this.standardizeRelationshipList(relationships.enemies),
            family: this.standardizeRelationshipList(relationships.family),
            other: this.standardizeRelationshipList(relationships.other)
        };
    }

    /**
     * Standardize relationship list
     * @private
     */
    standardizeRelationshipList(list) {
        if (!list) return [];
        return Array.isArray(list) ? list : [list];
    }

    /**
     * Standardize pantheon name
     * @private
     */
    standardizePantheon(pantheon) {
        if (!pantheon) return null;
        // Capitalize first letter of each word
        return pantheon.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Standardize symbol format
     * @private
     */
    standardizeSymbol(symbol) {
        if (!symbol) return null;
        // Standardize common variations
        return symbol.replace(/point-down/i, 'point down')
            .replace(/point-up/i, 'point up');
    }

    /**
     * Standardize gender format
     * @private
     */
    standardizeGender(gender) {
        if (!gender) return null;
        const normalized = gender.toLowerCase();
        return ['male', 'female', 'none', 'varies'].includes(normalized) ? normalized : null;
    }

    /**
     * Standardize worshipers list
     * @private
     */
    standardizeWorshipers(worshipers) {
        if (!worshipers) return [];
        return Array.isArray(worshipers) ? worshipers : [worshipers];
    }

    /**
     * Merge relationships from two deity entries
     * @private
     */
    mergeRelationships(rel1, rel2) {
        if (!rel1 && !rel2) return null;
        if (!rel1) return rel2;
        if (!rel2) return rel1;

        return {
            allies: [...new Set([...rel1.allies || [], ...rel2.allies || []])],
            enemies: [...new Set([...rel1.enemies || [], ...rel2.enemies || []])],
            family: [...new Set([...rel1.family || [], ...rel2.family || []])],
            other: [...new Set([...rel1.other || [], ...rel2.other || []])]
        };
    }

    /**
     * Get deity by name and source with improved caching
     * @param {string} name - Deity name
     * @param {string} source - Source book
     * @param {Object} options - Loading options
     * @returns {Promise<Object|null>} Deity data or null if not found
     */
    async getDeityByNameAndSource(name, source, options = {}) {
        const cacheKey = `deity_${name.toLowerCase()}_${source.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadDeities();
            return data.deities.find(deity =>
                deity.name.toLowerCase() === name.toLowerCase() &&
                deity.source.toLowerCase() === source.toLowerCase()
            ) || null;
        }, options);
    }

    /**
     * Get deities by pantheon with improved caching
     * @param {string} pantheon - Pantheon name
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of deities in the specified pantheon
     */
    async getDeitiesByPantheon(pantheon, options = {}) {
        const cacheKey = `deities_pantheon_${pantheon.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadDeities();
            return data.deities.filter(deity =>
                deity.pantheon?.toLowerCase() === pantheon.toLowerCase()
            );
        }, options);
    }

    /**
     * Get deities by domain with improved caching
     * @param {string} domain - Divine domain
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of deities with the specified domain
     */
    async getDeitiesByDomain(domain, options = {}) {
        const cacheKey = `deities_domain_${domain.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadDeities();
            return data.deities.filter(deity =>
                deity.domains?.some(d => d.toLowerCase() === domain.toLowerCase())
            );
        }, options);
    }

    /**
     * Get deities by alignment with improved caching
     * @param {string} alignment - Alignment code (e.g., 'LG', 'N', 'CE')
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of deities with the specified alignment
     */
    async getDeitiesByAlignment(alignment, options = {}) {
        const cacheKey = `deities_alignment_${alignment.toUpperCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadDeities();
            return data.deities.filter(deity =>
                deity.alignment?.includes(alignment.toUpperCase())
            );
        }, options);
    }

    /**
     * Get deities by category with improved caching
     * @param {string} category - Deity category
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of deities in the specified category
     */
    async getDeitiesByCategory(category, options = {}) {
        const cacheKey = `deities_category_${category.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadDeities();
            return data.deities.filter(deity =>
                deity.category?.toLowerCase() === category.toLowerCase()
            );
        }, options);
    }

    /**
     * Get deities by source with improved caching
     * @param {string} source - Source book
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of deities from the specified source
     */
    async getDeitiesBySource(source, options = {}) {
        const cacheKey = `deities_source_${source.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadDeities();
            return data.deities.filter(deity =>
                deity.source.toLowerCase() === source.toLowerCase()
            );
        }, options);
    }

    /**
     * Search deities by name with improved caching
     * @param {string} searchTerm - Search term
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of deities matching the search term
     */
    async searchDeitiesByName(searchTerm, options = {}) {
        const cacheKey = `deities_search_${searchTerm.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadDeities();
            const term = searchTerm.toLowerCase();
            return data.deities.filter(deity =>
                deity.name.toLowerCase().includes(term) ||
                deity.altNames?.some(name => name.toLowerCase().includes(term))
            );
        }, options);
    }

    /**
     * Get deities by worshiper type with improved caching
     * @param {string} worshiperType - Type of worshiper
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of deities worshiped by the specified type
     */
    async getDeitiesByWorshiperType(worshiperType, options = {}) {
        const cacheKey = `deities_worshiper_${worshiperType.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadDeities();
            return data.deities.filter(deity =>
                deity.worshipers?.some(w => w.toLowerCase().includes(worshiperType.toLowerCase()))
            );
        }, options);
    }

    /**
     * Get deities by rank with improved caching
     * @param {string} rank - Deity rank
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of deities of the specified rank
     */
    async getDeitiesByRank(rank, options = {}) {
        const cacheKey = `deities_rank_${rank.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadDeities();
            return data.deities.filter(deity =>
                deity.rank?.toLowerCase() === rank.toLowerCase()
            );
        }, options);
    }
} 