/** Manages item data and operations for the character builder. */
import { DataLoader } from '../lib/DataLoader.js';
import DataNormalizer from '../lib/DataNormalizer.js';
import { EVENTS } from '../lib/EventBus.js';
import { BaseDataService } from './BaseDataService.js';

/** Manages item data and provides access to items. */
class ItemService extends BaseDataService {
	constructor() {
		super({ loadEvent: EVENTS.ITEMS_LOADED, loggerScope: 'ItemService' });
		this._itemLookupMap = null; // Map for O(1) item lookups
		this._baseItemLookupMap = null; // Map for O(1) base item lookups
	}

	async initialize() {
		await this.initWithLoader(
			async () => {
				const results = await Promise.allSettled([
					DataLoader.loadJSON('items.json', { ttl: 24 * 60 * 60 * 1000 }),
					DataLoader.loadJSON('items-base.json', { ttl: 24 * 60 * 60 * 1000 }),
				]);

				const items =
					results[0].status === 'fulfilled' ? results[0].value : { item: [] };
				const baseItems =
					results[1].status === 'fulfilled'
						? results[1].value
						: { baseitem: [] };

				if (results[0].status === 'rejected') {
					console.warn(
						'ItemService',
						'Failed to load items.json:',
						results[0].reason?.message,
					);
				}
				if (results[1].status === 'rejected') {
					console.warn(
						'ItemService',
						'Failed to load items-base.json:',
						results[1].reason?.message,
					);
				}

				return {
					...items,
					baseItem: baseItems.baseitem || [],
				};
			},
			{
				onLoaded: (data) => {
					const merged = data || { item: [], baseItem: [] };
					this._itemLookupMap = this.buildLookupMap(merged.item);
					this._baseItemLookupMap = this.buildLookupMap(merged.baseItem);
				},
				emitPayload: (data) => data?.item || [],
				onError: () => {
					this._itemLookupMap = new Map();
					this._baseItemLookupMap = new Map();
					return { item: [], baseItem: [] };
				},
			},
		);

		return true;
	}

	/**
	 * Get all available items
	 * @returns {Array<Object>} Array of item objects
	 */
	getAllItems() {
		return this._data?.item || [];
	}

	/**
	 * Get all base items (weapons, armor, etc.)
	 * @returns {Array<Object>} Array of base item objects
	 */
	getAllBaseItems() {
		return this._data?.baseItem || [];
	}

	/**
	 * Get a specific item by name and source
	 * @param {string} name - Item name
	 * @param {string} source - Source book
	 * @returns {Object|null} Item object or null if not found
	 */
	getItem(name, source = 'DMG') {
		return this.lookupByNameAndSource(this._itemLookupMap, name, source);
	}

	/**
	 * Get a specific base item by name
	 * @param {string} name - Base item name
	 * @param {string} source - Source book
	 * @returns {Object|null} Base item object or null if not found
	 */
	getBaseItem(name, source = 'PHB') {
		return this.lookupByNameAndSource(this._baseItemLookupMap, name, source);
	}

	/**
	 * Get items by type
	 * @param {string} type - Item type (e.g., 'W' for weapon, 'A' for armor)
	 * @returns {Array<Object>} Array of item objects
	 */
	getItemsByType(type) {
		const items = [];

		if (this._data?.item) {
			items.push(...this._data.item.filter((i) => i.type === type));
		}

		if (this._data?.baseItem) {
			items.push(...this._data.baseItem.filter((bi) => bi.type === type));
		}

		return items;
	}

	/**
	 * Get items by rarity
	 * @param {string} rarity - Item rarity (e.g., 'common', 'uncommon', 'rare')
	 * @returns {Array<Object>} Array of item objects
	 */
	getItemsByRarity(rarity) {
		if (!this._data?.item) return [];

		const target = DataNormalizer.normalizeForLookup(rarity);
		return this._data.item.filter(
			(i) => i.rarity && DataNormalizer.normalizeForLookup(i.rarity) === target,
		);
	}
}

/**
 * Global ItemManager instance
 */
export const itemService = new ItemService();
