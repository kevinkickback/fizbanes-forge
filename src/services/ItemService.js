import { DataLoader } from '../lib/DataLoader.js';
import { EVENTS } from '../lib/EventBus.js';
import { BaseDataService } from './BaseDataService.js';
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
						'[ItemService]',
						'Failed to load items.json:',
						results[0].reason?.message,
					);
				}
				if (results[1].status === 'rejected') {
					console.warn(
						'[ItemService]',
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

	getAllItems() {
		return this._data?.item || [];
	}

	getAllBaseItems() {
		return this._data?.baseItem || [];
	}
}

export const itemService = new ItemService();
