/**
 * BaseLoader.js
 * Base class for all data loaders with improved caching and lazy loading
 * 
 * @typedef {Object} CacheEntry
 * @property {any} data - The cached data
 * @property {number} timestamp - When the entry was last accessed
 * @property {number} expiry - When the entry should expire
 * 
 * @typedef {Object} LoadOptions
 * @property {number} [maxRetries=3] - Maximum number of retries for failed loads
 * @property {number} [cacheExpiry=3600000] - Cache expiry in milliseconds (default 1 hour)
 * @property {boolean} [forceRefresh] - Force a cache refresh
 */

export class BaseLoader {
    /**
     * @param {Object} options
     * @param {number} [options.maxCacheSize=100] - Maximum number of entries in cache
     * @param {number} [options.defaultExpiry=3600000] - Default cache expiry in milliseconds
     */
    constructor(options = {}) {
        /**
         * Cache for loaded data
         * @type {Map<string, CacheEntry>}
         * @private
         */
        this._dataCache = new Map();

        /**
         * Pending load operations
         * @type {Map<string, Promise<any>>}
         * @private
         */
        this._pendingLoads = new Map();

        /**
         * Maximum number of entries to keep in cache
         * @type {number}
         * @private
         */
        this._maxCacheSize = options.maxCacheSize || 100;

        /**
         * Default expiry time for cache entries in milliseconds
         * @type {number}
         * @private
         */
        this._defaultExpiry = options.defaultExpiry || 3600000; // 1 hour

        /**
         * Retry delays in milliseconds
         * @type {number[]}
         * @private
         */
        this._retryDelays = [1000, 3000, 5000]; // Retry delays in milliseconds
    }

    //-------------------------------------------------------------------------
    // Data Loading Methods
    //-------------------------------------------------------------------------

    /**
     * Load a JSON file with retry support
     * @param {string} path - Path to the JSON file
     * @param {LoadOptions} [options] - Loading options
     * @returns {Promise<any>} Parsed JSON data
     */
    async loadJsonFile(path, options = {}) {
        const { maxRetries = 3 } = options;

        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(`data/${path}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    await this._delay(this._retryDelays[attempt]);
                }
            }
        }
        throw lastError;
    }

    /**
     * Get data from cache or load it
     * @param {string} key - Cache key
     * @param {Function} loadFn - Function to load data if not cached
     * @param {LoadOptions} [options] - Loading options
     * @returns {Promise<any>} Cached or loaded data
     */
    async getOrLoadData(key, loadFn, options = {}) {
        const { cacheExpiry = this._defaultExpiry, forceRefresh = false } = options;

        // Check cache and expiry if not forcing refresh
        if (!forceRefresh) {
            const cached = this._dataCache.get(key);
            if (cached && Date.now() < cached.expiry) {
                cached.timestamp = Date.now();
                return cached.data;
            }
        }

        // Check pending loads
        if (this._pendingLoads.has(key)) {
            return this._pendingLoads.get(key);
        }

        // Load the data
        const loadPromise = loadFn().then(data => {
            this._setCacheEntry(key, data, cacheExpiry);
            this._pendingLoads.delete(key);
            return data;
        }).catch(error => {
            this._pendingLoads.delete(key);
            throw error;
        });

        this._pendingLoads.set(key, loadPromise);
        return loadPromise;
    }

    /**
     * Set a cache entry with LRU eviction
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     * @param {number} expiry - Expiry time in milliseconds
     * @private
     */
    _setCacheEntry(key, data, expiry) {
        if (this._dataCache.size >= this._maxCacheSize) {
            let oldestKey = null;
            let oldestTime = Number.POSITIVE_INFINITY;

            for (const [k, entry] of this._dataCache) {
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = k;
                }
            }

            if (oldestKey) {
                this._dataCache.delete(oldestKey);
            }
        }

        this._dataCache.set(key, {
            data,
            timestamp: Date.now(),
            expiry: Date.now() + expiry
        });
    }

    /**
     * Clear the cache for specific keys or all data
     * @param {string[]} [keys] - Optional array of keys to clear
     */
    clearCache(keys) {
        if (keys) {
            for (const key of keys) {
                this._dataCache.delete(key);
                this._pendingLoads.delete(key);
            }
        } else {
            this._dataCache.clear();
            this._pendingLoads.clear();
        }
    }

    /**
     * Delay helper for retry mechanism
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>} Promise that resolves after the delay
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
} 