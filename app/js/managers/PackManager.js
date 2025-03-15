/**
 * PackManager.js
 * Manager class for handling equipment packs
 */

import { Pack } from '../models/Pack.js';
import { InventoryManager } from './InventoryManager.js';
import { characterInitializer } from '../utils/Initialize.js';

export class PackManager {
    constructor(character) {
        this.character = character;
        this.inventoryManager = character.inventoryManager || new InventoryManager(character);
        this.dataLoader = characterInitializer.dataLoader;
        this.packs = new Map();
        this.cache = new Map(); // Cache for loaded packs
    }

    /**
     * Load all available packs
     * @returns {Promise<Array<Pack>>} Array of available packs
     */
    async loadPacks() {
        try {
            const items = await this.dataLoader.loadItems();
            return items.filter(item => item.type === 'pack');
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
     * Add a pack to the inventory
     * @param {string} packId - ID of the pack to add
     * @returns {Promise<boolean>} True if the pack was added successfully
     */
    async addPack(packId) {
        try {
            const pack = await this.getPack(packId);
            if (!pack) return false;

            return await this.inventoryManager.addItem(pack);
        } catch (error) {
            console.error('Error adding pack:', error);
            return false;
        }
    }

    /**
     * Unpack a pack into its individual items
     * @param {string} packId - ID of the pack to unpack
     * @returns {Promise<boolean>} True if the pack was unpacked successfully
     */
    async unpackPack(packId) {
        try {
            const pack = this.inventoryManager.getItem(packId);
            if (!pack || !(pack instanceof Pack)) return false;

            // Remove one instance of the pack
            await this.inventoryManager.removeItem(packId, 1);

            // Add all contents
            const contents = pack.getContents();
            for (const item of contents) {
                await this.inventoryManager.addItem(item, item.quantity);
            }

            return true;
        } catch (error) {
            console.error('Error unpacking pack:', error);
            return false;
        }
    }

    /**
     * Get all packs in the inventory
     * @returns {Array<Pack>} Array of packs
     */
    getPacks() {
        return this.inventoryManager.getAllItems()
            .filter(item => item instanceof Pack);
    }

    /**
     * Check if a pack exists in the inventory
     * @param {string} packId - ID of the pack to check
     * @returns {boolean} True if the pack exists
     */
    hasPack(packId) {
        return this.inventoryManager.hasItem(packId);
    }

    /**
     * Get the quantity of a pack in the inventory
     * @param {string} packId - ID of the pack to check
     * @returns {number} Quantity of the pack
     */
    getPackQuantity(packId) {
        return this.inventoryManager.getItemQuantity(packId);
    }

    /**
     * Remove a pack from the inventory
     * @param {string} packId - ID of the pack to remove
     * @param {number} quantity - Quantity to remove
     * @returns {boolean} True if the pack was removed successfully
     */
    removePack(packId, quantity = 1) {
        return this.inventoryManager.removeItem(packId, quantity);
    }

    /**
     * Get the total value of all packs in the inventory
     * @returns {number} Total value in copper pieces
     */
    getTotalPackValue() {
        return this.getPacks().reduce((total, pack) => {
            return total + pack.totalValue;
        }, 0);
    }

    /**
     * Get the total weight of all packs in the inventory
     * @returns {number} Total weight in pounds
     */
    getTotalPackWeight() {
        return this.getPacks().reduce((total, pack) => {
            return total + pack.totalWeight;
        }, 0);
    }

    /**
     * Clear the pack cache
     */
    clearCache() {
        this.cache.clear();
    }

    async getPackContents(packId) {
        try {
            const items = await this.dataLoader.loadItems();
            const pack = items.find(item => item.id === packId);
            return pack?.contents || [];
        } catch (error) {
            console.error('Error getting pack contents:', error);
            return [];
        }
    }
} 