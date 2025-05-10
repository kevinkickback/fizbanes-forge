/**
 * FeatureLoader
 * Handles loading and caching of feature data for feats and optional features
 * 
 * @typedef {Object} RawFeat
 * @property {string} name - Feat name
 * @property {string} source - Source book
 * @property {number} [page] - Page number
 * @property {Array<Object>} [prerequisite] - Prerequisites for the feat
 * @property {boolean} [repeatable] - Whether the feat can be taken multiple times
 * @property {Array<Object>} entries - Description entries
 * 
 * @typedef {Object} RawOptionalFeature
 * @property {string} name - Optional feature name
 * @property {string} source - Source book
 * @property {Array<string>} featureType - Types of the feature
 * @property {Array<Object>} [prerequisite] - Prerequisites for the feature
 * @property {Array<Object>} entries - Description entries
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Feature name
 * @property {string} source - Source book
 * @property {Array<Object>} entries - Descriptive entries
 * 
 * @typedef {Object} FeatureData
 * @property {Array<RawFeat>} feat - Array of feat data
 * @property {Array<RawOptionalFeature>} optionalfeature - Array of optional feature data
 * @property {Array<RawFluff>} [featFluff] - Array of feat fluff data
 * @property {Array<RawFluff>} [optionalfeatureFluff] - Array of optional feature fluff data
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * Handles loading and caching of feature data (feats and optional features)
 */
export class FeatureLoader extends BaseLoader {
    /**
     * Creates a new FeatureLoader instance
     * @param {Object} options - Loader configuration options
     * @param {number} [options.maxCacheSize] - Maximum cache size (defaults to 200)
     * @param {number} [options.defaultExpiry] - Default cache expiry in ms (defaults to 1 hour)
     */
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 200,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this._dataFiles = {
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
     * @throws {Error} If data loading fails
     */
    async loadFeatures(options = {}) {
        return this.getOrLoadData('features', async () => {
            try {
                const [featData, optionalFeatureData, featFluffData, optionalFluffData] = await Promise.all([
                    this.loadJsonFile(this._dataFiles.feats, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load feat data:', error);
                        throw new Error('Failed to load feat data');
                    }),
                    this.loadJsonFile(this._dataFiles.optionalFeatures, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load optional feature data:', error);
                        throw new Error('Failed to load optional feature data');
                    }),
                    this.loadJsonFile(this._dataFiles.featFluff, {
                        ...options,
                        maxRetries: 2
                    }).catch(() => ({ featFluff: [] })),
                    this.loadJsonFile(this._dataFiles.optionalFluff, {
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

                return data;
            } catch (error) {
                console.error('Error loading features:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load features in chunks for better performance
     * @param {number} chunkSize - Size of each chunk (defaults to 20)
     * @param {Object} options - Loading options
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {AsyncGenerator<Object[]>} Generator yielding chunks of feature data
     * @throws {Error} If data loading fails
     */
    async *loadFeaturesInChunks(chunkSize = 20, options = {}) {
        try {
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
        } catch (error) {
            console.error('Error loading features in chunks:', error);
            throw error;
        }
    }
} 