/**
 * ItemLoader.js    
 * Handles loading and caching of item data
 * 
 * @typedef {Object} RawItem
 * @property {string} name - Item name
 * @property {string} [source] - Source book
 * @property {number} [page] - Page number
 * @property {string} [type] - Item type
 * @property {string} [rarity] - Item rarity
 * @property {number} [weight] - Item weight
 * @property {number} [value] - Item value
 * @property {Array<Object>} [entries] - Item description entries
 * @property {Array<Object>} [property] - Item properties
 * @property {string} [reqAttune] - Attunement requirements
 * 
 * @typedef {Object} RawBaseItem
 * @property {string} name - Base item name
 * @property {string} [source] - Source book
 * @property {string} [type] - Item type
 * @property {Array<Object>} [entries] - Item description entries
 * 
 * @typedef {Object} RawMagicVariant
 * @property {string} name - Variant name
 * @property {string} [source] - Source book
 * @property {string} [type] - Variant type
 * @property {Array<Object>} [entries] - Variant description entries
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Item name
 * @property {string} [source] - Source book
 * @property {Array<Object>} entries - Descriptive entries
 * 
 * @typedef {Object} ItemData
 * @property {Array<RawItem>} item - Array of items
 * @property {Array<RawBaseItem>} baseitem - Array of base items
 * @property {Array<RawMagicVariant>} magicvariant - Array of magic variants
 * @property {Array<RawFluff>} fluff - Array of item fluff data
 */

import { BaseLoader } from './BaseLoader.js';

export class ItemLoader extends BaseLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 300,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            base: 'items-base.json',
            items: 'items.json',
            magicVariants: 'magicvariants.json',
            fluff: 'fluff-items.json'
        };
    }

    /**
     * Load all item data
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<ItemData>} Raw item data
     */
    async loadItems(options = {}) {
        return this.getOrLoadData('items', async () => {
            try {
                const [baseData, itemData, variantData, fluffData] = await Promise.all([
                    this.loadJsonFile(this.dataFiles.base, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load base item data:', error);
                        throw new Error('Failed to load base item data');
                    }),
                    this.loadJsonFile(this.dataFiles.items, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load item data:', error);
                        throw new Error('Failed to load item data');
                    }),
                    this.loadJsonFile(this.dataFiles.magicVariants, {
                        ...options,
                        maxRetries: 3
                    }).catch(() => ({ magicvariant: [] })),
                    this.loadJsonFile(this.dataFiles.fluff, {
                        ...options,
                        maxRetries: 2
                    }).catch(() => ({ itemFluff: [] }))
                ]);

                const data = {
                    baseitem: baseData.baseitem || [],
                    item: itemData.item || [],
                    magicvariant: variantData.magicvariant || [],
                    fluff: fluffData.itemFluff || []
                };

                console.debug(`Loaded ${data.item.length} items, ${data.baseitem.length} base items, and ${data.magicvariant.length} variants`);
                return data;
            } catch (error) {
                console.error('Error loading items:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load items in chunks for better performance
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Array<RawItem>>} Generator yielding chunks of raw item data
     */
    async *loadItemsInChunks(chunkSize = 20, options = {}) {
        const data = await this.loadItems(options);

        if (data.item && Array.isArray(data.item)) {
            for (let i = 0; i < data.item.length; i += chunkSize) {
                yield data.item.slice(i, i + chunkSize);
            }
        }
    }

    /**
     * Get raw item data by ID
     * @param {string} itemId - Item identifier (format: "name_source" in lowercase)
     * @param {Object} options - Loading options
     * @returns {Promise<RawItem|null>} Raw item data or null if not found
     */
    async getItemById(itemId, options = {}) {
        const cacheKey = `item_${itemId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadItems(options);
            return data.item.find(item => {
                const source = (item.source || 'phb').toLowerCase();
                const name = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                return `${name}_${source}` === itemId.toLowerCase();
            }) || null;
        }, options);
    }

    /**
     * Get raw base item data by name
     * @param {string} name - Base item name
     * @param {Object} options - Loading options
     * @returns {Promise<RawBaseItem|null>} Raw base item data or null if not found
     */
    async getBaseItem(name, options = {}) {
        const cacheKey = `baseitem_${name.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadItems();
            return data.baseitem.find(item =>
                item.name.toLowerCase() === name.toLowerCase()
            ) || null;
        }, options);
    }

    /**
     * Get raw magic variant data by name
     * @param {string} name - Variant name
     * @param {Object} options - Loading options
     * @returns {Promise<RawMagicVariant|null>} Raw magic variant data or null if not found
     */
    async getMagicVariant(name, options = {}) {
        const cacheKey = `variant_${name.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadItems();
            return data.magicvariant.find(variant =>
                variant.name.toLowerCase() === name.toLowerCase()
            ) || null;
        }, options);
    }

    /**
     * Get raw fluff data for an item
     * @param {string} itemName - Item name
     * @param {string} source - Source book
     * @param {Object} options - Loading options
     * @returns {Promise<RawFluff|null>} Raw fluff data or null if not found
     */
    async getItemFluff(itemName, source, options = {}) {
        const cacheKey = `fluff_${itemName}_${source}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadItems();
            return data.fluff.find(f =>
                f.name === itemName &&
                (f.source === source || !f.source)
            ) || null;
        }, options);
    }
} 