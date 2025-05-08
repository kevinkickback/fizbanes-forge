/**
 * ItemLoader
 * Handles loading and caching of item data
 * 
 * @typedef {Object} RawItem
 * @property {string} name - Item name
 * @property {string} source - Source book
 * @property {number} page - Page number
 * @property {boolean} [srd] - Whether item is in SRD
 * @property {boolean} [basicRules] - Whether item is in Basic Rules
 * @property {Array<string>} [reprintedAs] - Reprinted versions
 * @property {string} [edition] - Edition (e.g., "classic", "one")
 * @property {string} type - Item type
 * @property {string} rarity - Item rarity
 * @property {number} [weight] - Item weight
 * @property {number} [value] - Item value in copper pieces
 * @property {string} [valueRarity] - Value rarity category
 * @property {string} [tier] - Item tier
 * @property {Object} [weaponCategory] - Weapon category details
 * @property {Array<string>} [property] - Item properties
 * @property {Array<Object>} [entries] - Item description entries
 * @property {boolean} [weapon] - Whether item is a weapon
 * @property {boolean} [armor] - Whether item is armor
 * @property {boolean} [ammo] - Whether item is ammunition
 * 
 * @typedef {Object} RawBaseItem
 * @property {string} name - Base item name
 * @property {string} source - Source book
 * @property {number} page - Page number
 * @property {string} type - Base item type
 * @property {string} rarity - Item rarity
 * @property {number} [weight] - Item weight
 * @property {number} [value] - Item value in copper pieces
 * @property {boolean} [weapon] - Whether item is a weapon
 * @property {boolean} [armor] - Whether item is armor
 * @property {Array<string>} [property] - Item properties
 * @property {Array<Object>} [entries] - Item description entries
 * 
 * @typedef {Object} RawMagicVariant
 * @property {string} name - Magic item variant name
 * @property {string} source - Source book
 * @property {string} type - Magic item type
 * @property {string} [edition] - Edition (e.g., "classic", "one")
 * @property {Array<Object>} [requires] - Required base items
 * @property {Array<Object>} [entries] - Variant description entries
 * @property {Object} [inherits] - Properties inherited from base item
 * @property {Object} [excludes] - Items excluded from this variant
 * 
 * @typedef {Object} RawFluff
 * @property {string} name - Item name
 * @property {string} source - Source book
 * @property {Array<Object>} [images] - Item images
 * @property {Object} [_copy] - Copy source for fluff
 * 
 * @typedef {Object} ItemData
 * @property {Array<RawItem>} item - Array of items
 * @property {Array<RawBaseItem>} baseitem - Array of base items
 * @property {Array<RawMagicVariant>} magicvariant - Array of magic variants
 * @property {Array<RawFluff>} itemFluff - Array of item fluff
 */

import { BaseLoader } from './BaseLoader.js';

/**
 * Handles loading and caching of item data
 */
export class ItemLoader extends BaseLoader {
    /**
     * Creates a new ItemLoader instance
     * @param {Object} [options={}] - Loader options
     */
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 300,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });

        /**
         * Paths to item data files
         * @type {Object}
         * @private
         */
        this._dataFiles = {
            base: 'items-base.json',
            items: 'items.json',
            magicVariants: 'magicvariants.json',
            fluff: 'fluff-items.json'
        };
    }

    //-------------------------------------------------------------------------
    // Item Data Loading Methods
    //-------------------------------------------------------------------------

    /**
     * Load all item data
     * @param {Object} [options={}] - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<ItemData>} Raw item data
     */
    async loadItems(options = {}) {
        return this.getOrLoadData('items', async () => {
            try {
                const [baseData, itemData, variantData, fluffData] = await Promise.all([
                    this.loadJsonFile(this._dataFiles.base, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load base item data:', error);
                        throw new Error('Failed to load base item data');
                    }),
                    this.loadJsonFile(this._dataFiles.items, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load item data:', error);
                        throw new Error('Failed to load item data');
                    }),
                    this.loadJsonFile(this._dataFiles.magicVariants, {
                        ...options,
                        maxRetries: 3
                    }).catch(() => ({ magicvariant: [] })),
                    this.loadJsonFile(this._dataFiles.fluff, {
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

                return data;
            } catch (error) {
                console.error('Error loading items:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load items in chunks for better performance
     * @param {number} [chunkSize=20] - Size of each chunk
     * @param {Object} [options={}] - Loading options
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

    //-------------------------------------------------------------------------
    // Item Retrieval Methods
    //-------------------------------------------------------------------------

    /**
     * Get a specific item by name and source
     * @param {string} name - Item name
     * @param {string} [source='PHB'] - Source book
     * @returns {Promise<RawItem|null>} Raw item data or null if not found
     */
    async getItem(name, source = 'PHB') {
        const data = await this.loadItems();

        return data.item.find(item =>
            item.name.toLowerCase() === name.toLowerCase() &&
            (item.source === source || !source)
        ) || null;
    }

    /**
     * Get raw base item data by name
     * @param {string} name - Base item name
     * @param {string} [source='PHB'] - Source book
     * @returns {Promise<RawBaseItem|null>} Raw base item data or null if not found
     */
    async getBaseItem(name, source = 'PHB') {
        const data = await this.loadItems();

        return data.baseitem.find(item =>
            item.name.toLowerCase() === name.toLowerCase() &&
            (item.source === source || !source)
        ) || null;
    }

    /**
     * Get raw magic variant data by name
     * @param {string} name - Variant name
     * @param {string} [source='DMG'] - Source book
     * @returns {Promise<RawMagicVariant|null>} Raw magic variant data or null if not found
     */
    async getMagicVariant(name, source = 'DMG') {
        const data = await this.loadItems();

        return data.magicvariant.find(variant =>
            variant.name.toLowerCase() === name.toLowerCase() &&
            (variant.source === source || !source)
        ) || null;
    }

    /**
     * Get raw fluff data for an item
     * @param {string} itemName - Item name
     * @param {string} [source='PHB'] - Source book
     * @returns {Promise<RawFluff|null>} Raw fluff data or null if not found
     */
    async getItemFluff(itemName, source = 'PHB') {
        const data = await this.loadItems();

        return data.fluff.find(f =>
            f.name.toLowerCase() === itemName.toLowerCase() &&
            (f.source === source || !source)
        ) || null;
    }
} 