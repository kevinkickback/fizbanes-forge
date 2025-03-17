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
 * 
 * @typedef {Object} CacheStats
 * @property {number} totalEntries - Total number of entries in cache
 * @property {number} expiredEntries - Number of expired entries
 * @property {number} pendingLoads - Number of pending load operations
 * @property {number} averageAge - Average age of cache entries in milliseconds
 */

export class BaseLoader {
    /**
     * @param {Object} options
     * @param {number} [options.maxCacheSize=100] - Maximum number of entries in cache
     * @param {number} [options.defaultExpiry=3600000] - Default cache expiry in milliseconds
     */
    constructor(options = {}) {
        this.dataCache = new Map();
        this.pendingLoads = new Map();
        this.maxCacheSize = options.maxCacheSize || 100;
        this.defaultExpiry = options.defaultExpiry || 3600000; // 1 hour
        this.retryDelays = [1000, 3000, 5000]; // Retry delays in milliseconds
    }

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
                    await this.delay(this.retryDelays[attempt]);
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
        const { cacheExpiry = this.defaultExpiry, forceRefresh = false } = options;

        // Check cache and expiry if not forcing refresh
        if (!forceRefresh) {
            const cached = this.dataCache.get(key);
            if (cached && Date.now() < cached.expiry) {
                cached.timestamp = Date.now();
                return cached.data;
            }
        }

        // Check pending loads
        if (this.pendingLoads.has(key)) {
            return this.pendingLoads.get(key);
        }

        // Load the data
        const loadPromise = loadFn().then(data => {
            this.setCacheEntry(key, data, cacheExpiry);
            this.pendingLoads.delete(key);
            return data;
        }).catch(error => {
            this.pendingLoads.delete(key);
            throw error;
        });

        this.pendingLoads.set(key, loadPromise);
        return loadPromise;
    }

    /**
     * Set a cache entry with LRU eviction
     * @private
     */
    setCacheEntry(key, data, expiry) {
        if (this.dataCache.size >= this.maxCacheSize) {
            let oldestKey = null;
            let oldestTime = Number.POSITIVE_INFINITY;

            for (const [k, entry] of this.dataCache) {
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = k;
                }
            }

            if (oldestKey) {
                this.dataCache.delete(oldestKey);
            }
        }

        this.dataCache.set(key, {
            data,
            timestamp: Date.now(),
            expiry: Date.now() + expiry
        });
    }

    /**
     * Clear expired cache entries
     * @private
     */
    clearExpiredCache() {
        const now = Date.now();
        for (const [key, entry] of this.dataCache) {
            if (now >= entry.expiry) {
                this.dataCache.delete(key);
            }
        }
    }

    /**
     * Clear the cache for specific keys or all data
     * @param {string[]} [keys] - Optional array of keys to clear
     */
    clearCache(keys) {
        if (keys) {
            for (const key of keys) {
                this.dataCache.delete(key);
                this.pendingLoads.delete(key);
            }
        } else {
            this.dataCache.clear();
            this.pendingLoads.clear();
        }
    }

    /**
     * Check if data exists in cache and is not expired
     * @param {string} key - Cache key to check
     * @returns {boolean} True if data is cached and valid
     */
    isCached(key) {
        const entry = this.dataCache.get(key);
        return entry && Date.now() < entry.expiry;
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        const now = Date.now();
        const stats = {
            totalEntries: this.dataCache.size,
            expiredEntries: 0,
            pendingLoads: this.pendingLoads.size,
            averageAge: 0
        };

        let totalAge = 0;
        for (const entry of this.dataCache.values()) {
            if (now >= entry.expiry) {
                stats.expiredEntries++;
            }
            totalAge += now - entry.timestamp;
        }

        if (stats.totalEntries > 0) {
            stats.averageAge = totalAge / stats.totalEntries;
        }

        return stats;
    }

    /**
     * Delay helper for retry mechanism
     * @private
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
} 