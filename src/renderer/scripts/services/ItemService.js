/** Manages item data and operations for the character builder. */

import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { Logger } from '../infrastructure/Logger.js';
import { DataLoader } from '../utils/DataLoader.js';

/** Manages item data and provides access to items. */
class ItemService {
	/** Initialize a new ItemManager. */
	constructor() {
		this._itemData = null;
		this._itemLookupMap = null; // Map for O(1) item lookups
		this._baseItemLookupMap = null; // Map for O(1) base item lookups
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
			// Load both items and base items with individual error handling
			const results = await Promise.allSettled([
				DataLoader.loadJSON('items.json'),
				DataLoader.loadJSON('items-base.json'),
			]);

			// Extract results gracefully
			const items = results[0].status === 'fulfilled' ? results[0].value : { item: [] };
			const baseItems = results[1].status === 'fulfilled' ? results[1].value : { baseitem: [] };

			// Log any failures
			if (results[0].status === 'rejected') {
				Logger.warn('ItemService', 'Failed to load items.json:', results[0].reason?.message);
			}
			if (results[1].status === 'rejected') {
				Logger.warn('ItemService', 'Failed to load items-base.json:', results[1].reason?.message);
			}

			// Merge items with base items
			this._itemData = {
				...items,
				baseItem: baseItems.baseitem || [],
			};

			// Build lookup maps for O(1) access
			this._itemLookupMap = new Map();
			for (const item of this._itemData.item || []) {
				const key = item.name.toLowerCase();
				this._itemLookupMap.set(key, item);
			}

			this._baseItemLookupMap = new Map();
			for (const baseItem of this._itemData.baseItem || []) {
				const key = baseItem.name.toLowerCase();
				this._baseItemLookupMap.set(key, baseItem);
			}

			eventBus.emit(EVENTS.ITEMS_LOADED, this._itemData.item);
			return true;
		} catch (error) {
			Logger.error('ItemService', 'Failed to initialize item data:', error);
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
		if (!this._itemLookupMap) return null;

		// O(1) lookup by name (case-insensitive)
		const item = this._itemLookupMap.get(name.toLowerCase());

		// Verify source if found
		if (item && item.source === source) {
			return item;
		}

		// Fall back to linear search if exact source needed
		if (item && item.source !== source && this._itemData?.item) {
			return this._itemData.item.find(
				(i) => i.name === name && i.source === source
			) || item;
		}

		return item || null;
	}

	/**
	 * Get a specific base item by name
	 * @param {string} name - Base item name
	 * @param {string} source - Source book
	 * @returns {Object|null} Base item object or null if not found
	 */
	getBaseItem(name, source = 'PHB') {
		if (!this._baseItemLookupMap) return null;

		// O(1) lookup by name (case-insensitive)
		const baseItem = this._baseItemLookupMap.get(name.toLowerCase());

		// Verify source if found
		if (baseItem && baseItem.source === source) {
			return baseItem;
		}

		// Fall back to linear search if exact source needed
		if (baseItem && baseItem.source !== source && this._itemData?.baseItem) {
			return this._itemData.baseItem.find(
				(bi) => bi.name === name && bi.source === source
			) || baseItem;
		}

		return baseItem || null;
	}

	/**
	 * Get items by type
	 * @param {string} type - Item type (e.g., 'W' for weapon, 'A' for armor)
	 * @returns {Array<Object>} Array of item objects
	 */
	getItemsByType(type) {
		const items = [];

		if (this._itemData?.item) {
			items.push(...this._itemData.item.filter((i) => i.type === type));
		}

		if (this._itemData?.baseItem) {
			items.push(...this._itemData.baseItem.filter((bi) => bi.type === type));
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

		return this._itemData.item.filter(
			(i) => i.rarity && i.rarity.toLowerCase() === rarity.toLowerCase(),
		);
	}
}

/**
 * Global ItemManager instance
 */
export const itemService = new ItemService();
