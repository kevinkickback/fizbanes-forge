/**
 * ItemManager.js
 * Manages item data and operations for the character builder
 */

import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';
import { AppState } from '../core/AppState.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { DataLoader } from '../utils/DataLoader.js';

/**
 * Manages item data and provides access to items
 */
class ItemService {
    /**
     * Initialize a new ItemManager
     */
    constructor() {
        this._itemData = null;
    }

    /**
     * Initialize item data by loading from DataLoader
     * @returns {Promise<boolean>} True if initialization succeeded
     */
    async initialize() {
        // Skip if already initialized
        if (this._itemData) {
            return true;
        }

        try {
            // Load both items and base items
            const [items, baseItems] = await Promise.all([
                DataLoader.loadJSON('data/items.json'),
                DataLoader.loadJSON('data/items-base.json')
            ]);

            // Merge items with base items
            this._itemData = {
                ...items,
                baseItem: baseItems.baseitem || []
            };

            eventBus.emit(EVENTS.ITEMS_LOADED, this._itemData.item);
            return true;
        } catch (error) {
            console.error('Failed to initialize item data:', error);
            this._itemData = { item: [], baseItem: [] };
            return false;
        }
    }

    /**
     * Get all available items
     * @returns {Array<Object>} Array of item objects
     */
    getAllItems() {
        return this._itemData?.item || [];
    }

    /**
     * Get all base items (weapons, armor, etc.)
     * @returns {Array<Object>} Array of base item objects
     */
    getAllBaseItems() {
        return this._itemData?.baseItem || [];
    }

    /**
     * Get a specific item by name and source
     * @param {string} name - Item name
     * @param {string} source - Source book
     * @returns {Object|null} Item object or null if not found
     */
    getItem(name, source = 'DMG') {
        if (!this._itemData?.item) return null;

        return this._itemData.item.find(i =>
            i.name === name && i.source === source
        ) || null;
    }

    /**
     * Get a specific base item by name
     * @param {string} name - Base item name
     * @param {string} source - Source book
     * @returns {Object|null} Base item object or null if not found
     */
    getBaseItem(name, source = 'PHB') {
        if (!this._itemData?.baseItem) return null;

        return this._itemData.baseItem.find(bi =>
            bi.name === name && bi.source === source
        ) || null;
    }

    /**
     * Get items by type
     * @param {string} type - Item type (e.g., 'W' for weapon, 'A' for armor)
     * @returns {Array<Object>} Array of item objects
     */
    getItemsByType(type) {
        const items = [];

        if (this._itemData?.item) {
            items.push(...this._itemData.item.filter(i => i.type === type));
        }

        if (this._itemData?.baseItem) {
            items.push(...this._itemData.baseItem.filter(bi => bi.type === type));
        }

        return items;
    }

    /**
     * Get items by rarity
     * @param {string} rarity - Item rarity (e.g., 'common', 'uncommon', 'rare')
     * @returns {Array<Object>} Array of item objects
     */
    getItemsByRarity(rarity) {
        if (!this._itemData?.item) return [];

        return this._itemData.item.filter(i =>
            i.rarity && i.rarity.toLowerCase() === rarity.toLowerCase()
        );
    }
}

/**
 * Global ItemManager instance
 */
export const itemService = new ItemService();
