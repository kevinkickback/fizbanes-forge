/**
 * PackService.js
 * Service class for handling pack-related operations
 */

import { Pack } from '../models/Pack.js';

export class PackService {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.cache = new Map();
    }

    /**
     * Load all available packs
     * @returns {Promise<Array<Pack>>} Array of available packs
     */
    async loadPacks() {
        try {
            const items = await this.dataLoader.loadItems();
            const packs = items.filter(item => item.type === 'pack')
                .map(packData => new Pack(packData));
            return packs;
        } catch (error) {
            console.error('Error loading packs:', error);
            return [];
        }
    }

    /**
     * Get a specific pack by ID
     * @param {string} packId - ID of the pack to get
     * @returns {Promise<Pack|null>} Pack object or null if not found
     */
    async getPack(packId) {
        try {
            // Check cache first
            if (this.cache.has(packId)) {
                return this.cache.get(packId);
            }

            const items = await this.dataLoader.loadItems();
            const packData = items.find(item => item.id === packId && item.type === 'pack');
            if (!packData) return null;

            const pack = new Pack(packData);
            this.cache.set(packId, pack);
            return pack;
        } catch (error) {
            console.error('Error getting pack:', error);
            return null;
        }
    }

    /**
     * Get all packs that contain a specific item
     * @param {string} itemId - ID of the item to search for
     * @returns {Promise<Array<Pack>>} Array of packs containing the item
     */
    async getPacksContainingItem(itemId) {
        try {
            const packs = await this.loadPacks();
            return packs.filter(pack => pack.containsItem(itemId));
        } catch (error) {
            console.error('Error searching packs:', error);
            return [];
        }
    }

    /**
     * Get packs within a specific price range
     * @param {number} minPrice - Minimum price in copper pieces
     * @param {number} maxPrice - Maximum price in copper pieces
     * @returns {Promise<Array<Pack>>} Array of packs within the price range
     */
    async getPacksByPriceRange(minPrice, maxPrice) {
        try {
            const packs = await this.loadPacks();
            return packs.filter(pack => {
                const value = pack.totalValue;
                return value >= minPrice && value <= maxPrice;
            });
        } catch (error) {
            console.error('Error filtering packs by price:', error);
            return [];
        }
    }

    /**
     * Get packs by type or category
     * @param {string} category - Category to filter by
     * @returns {Promise<Array<Pack>>} Array of packs in the category
     */
    async getPacksByCategory(category) {
        try {
            const packs = await this.loadPacks();
            return packs.filter(pack => pack.category === category);
        } catch (error) {
            console.error('Error filtering packs by category:', error);
            return [];
        }
    }

    /**
     * Get the most cost-effective pack for a set of items
     * @param {Array<string>} itemIds - Array of item IDs needed
     * @returns {Promise<Pack|null>} Most cost-effective pack or null if none found
     */
    async findBestPackForItems(itemIds) {
        try {
            const packs = await this.loadPacks();
            let bestPack = null;
            let bestValue = Number.POSITIVE_INFINITY;

            for (const pack of packs) {
                // Count how many needed items are in this pack
                const containedItems = itemIds.filter(id => pack.containsItem(id));
                if (containedItems.length === 0) continue;

                // Calculate value per needed item
                const valuePerItem = pack.totalValue / containedItems.length;
                if (valuePerItem < bestValue) {
                    bestValue = valuePerItem;
                    bestPack = pack;
                }
            }

            return bestPack;
        } catch (error) {
            console.error('Error finding best pack:', error);
            return null;
        }
    }

    /**
     * Clear the pack cache
     */
    clearCache() {
        this.cache.clear();
    }
} 