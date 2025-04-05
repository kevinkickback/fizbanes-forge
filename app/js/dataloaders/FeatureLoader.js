/**
 * FeatureLoader.js
 * Handles loading and caching of feature data
 * 
 * @typedef {Object} RawFeat
 * @property {string} name - Name of the feat
 * @property {string} source - Source book identifier
 * @property {number} [page] - Page number in source book
 * @property {string} [category] - Feat category
 * @property {Array<Object>} [prerequisite] - Prerequisites for the feat
 * @property {boolean} [repeatable] - Whether the feat can be taken multiple times
 * @property {Array<Object>} entries - Description entries
 * @property {Object} [ability] - Ability score improvements
 * @property {Object} [additionalSpells] - Additional spells granted
 * @property {Object} [proficiencies] - Granted proficiencies
 * @property {Array<Object>} [features] - Additional features
 * 
 * @typedef {Object} RawOptionalFeature
 * @property {string} name - Name of the optional feature
 * @property {string} source - Source book identifier
 * @property {number} [page] - Page number in source book
 * @property {Array<string>} featureType - Types of the feature
 * @property {Array<Object>} [prerequisite] - Prerequisites for the feature
 * @property {Array<Object>} entries - Description entries
 * @property {Object} [consumes] - Resource consumption details
 * @property {Object} [resource] - Resource usage details
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Name of the feature
 * @property {string} source - Source book identifier
 * @property {Array<Object>} entries - Descriptive entries
 * @property {Array<Object>} [images] - Associated images
 * 
 * @typedef {Object} FeatureData
 * @property {Array<RawFeat>} feat - Array of raw feat data
 * @property {Array<RawOptionalFeature>} optionalfeature - Array of raw optional feature data
 * @property {Array<RawFluff>} [featFluff] - Array of feat fluff data
 * @property {Array<RawFluff>} [optionalfeatureFluff] - Array of optional feature fluff data
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * FeatureLoader.js
 * Handles loading and caching of feature data
 */
export class FeatureLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 200,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            feats: 'feats.json',
            optionalFeatures: 'optionalfeatures.json',
            featFluff: 'fluff-feats.json',
            optionalFluff: 'fluff-optionalfeatures.json'
        };
    }

    /**
     * Load all feature data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<FeatureData>} Raw feature data
     */
    async loadFeatures(options = {}) {
        return this.getOrLoadData('features', async () => {
            try {
                const [featData, optionalFeatureData, featFluffData, optionalFluffData] = await Promise.all([
                    this.loadJsonFile(this.dataFiles.feats, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load feat data:', error);
                        throw new Error('Failed to load feat data');
                    }),
                    this.loadJsonFile(this.dataFiles.optionalFeatures, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load optional feature data:', error);
                        throw new Error('Failed to load optional feature data');
                    }),
                    this.loadJsonFile(this.dataFiles.featFluff, {
                        ...options,
                        maxRetries: 2
                    }).catch(() => ({ featFluff: [] })),
                    this.loadJsonFile(this.dataFiles.optionalFluff, {
                        ...options,
                        maxRetries: 2
                    }).catch(() => ({ optionalfeatureFluff: [] }))
                ]);

                if (!featData || !featData.feat) {
                    throw new Error('Invalid or empty feat data');
                }

                if (!optionalFeatureData || !optionalFeatureData.optionalfeature) {
                    throw new Error('Invalid or empty optional feature data');
                }

                const data = {
                    feat: featData.feat,
                    optionalfeature: optionalFeatureData.optionalfeature,
                    featFluff: featFluffData.featFluff || [],
                    optionalfeatureFluff: optionalFluffData.optionalfeatureFluff || []
                };

                console.debug(`Loaded ${data.feat.length} feats and ${data.optionalfeature.length} optional features`);
                return data;
            } catch (error) {
                console.error('Error loading features:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load features in chunks for better performance
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Object[]>} Generator yielding chunks of feature data
     */
    async *loadFeaturesInChunks(chunkSize = 20, options = {}) {
        const data = await this.loadFeatures(options);

        // Yield feat chunks
        if (data.feat && Array.isArray(data.feat)) {
            for (let i = 0; i < data.feat.length; i += chunkSize) {
                yield {
                    type: 'feat',
                    items: data.feat.slice(i, i + chunkSize)
                };
            }
        }

        // Yield optional feature chunks
        if (data.optionalfeature && Array.isArray(data.optionalfeature)) {
            for (let i = 0; i < data.optionalfeature.length; i += chunkSize) {
                yield {
                    type: 'optionalfeature',
                    items: data.optionalfeature.slice(i, i + chunkSize)
                };
            }
        }
    }

    /**
     * Get feat by ID
     * @param {string} featId - Feat identifier (format: "name_source" in lowercase)
     * @param {Object} options - Loading options
     * @returns {Promise<RawFeat|null>} Raw feat data or null if not found
     */
    async getFeatById(featId, options = {}) {
        const cacheKey = `feat_${featId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            return data.feat.find(f => {
                const source = (f.source || 'phb').toLowerCase();
                const name = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return `${name}_${source}` === featId.toLowerCase();
            }) || null;
        }, options);
    }

    /**
     * Get optional feature by ID
     * @param {string} featureId - Optional feature identifier (format: "name_source" in lowercase)
     * @param {Object} options - Loading options
     * @returns {Promise<RawOptionalFeature|null>} Raw optional feature data or null if not found
     */
    async getOptionalFeatureById(featureId, options = {}) {
        const cacheKey = `optionalfeature_${featureId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            return data.optionalfeature.find(f => {
                const source = (f.source || 'phb').toLowerCase();
                const name = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return `${name}_${source}` === featureId.toLowerCase();
            }) || null;
        }, options);
    }

    /**
     * Get feat fluff data
     * @param {string} name - Feat name
     * @param {string} source - Source book
     * @param {Object} options - Loading options
     * @returns {Promise<RawFluff|null>} Raw fluff data or null if not found
     */
    async getFeatFluff(name, source, options = {}) {
        const cacheKey = `feat_fluff_${name}_${source}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            return data.featFluff.find(f =>
                f.name === name &&
                (f.source || 'phb').toLowerCase() === source.toLowerCase()
            ) || null;
        }, options);
    }

    /**
     * Get optional feature fluff data
     * @param {string} name - Optional feature name
     * @param {string} source - Source book
     * @param {Object} options - Loading options
     * @returns {Promise<RawFluff|null>} Raw fluff data or null if not found
     */
    async getOptionalFeatureFluff(name, source, options = {}) {
        const cacheKey = `optionalfeature_fluff_${name}_${source}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            return data.optionalfeatureFluff.find(f =>
                f.name === name &&
                (f.source || 'phb').toLowerCase() === source.toLowerCase()
            ) || null;
        }, options);
    }
} 