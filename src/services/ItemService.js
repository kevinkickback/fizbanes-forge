import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import { EVENTS } from '../lib/EventBus.js';
import { itemIdentifierSchema, validateInput } from '../lib/ValidationSchemas.js';
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
					DataLoader.loadJSON('items.json'),
					DataLoader.loadJSON('items-base.json'),
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

	resetData() {
		super.resetData();
		this._itemLookupMap = null;
		this._baseItemLookupMap = null;
	}

	getAllItems() {
		return this._data?.item || [];
	}

	getAllBaseItems() {
		return this._data?.baseItem || [];
	}

	getItem(name, source = 'PHB') {
		const validated = validateInput(
			itemIdentifierSchema,
			{ name, source },
			'Invalid item identifier',
		);

		// Try regular items first
		const item = this.lookupByNameAndSource(
			this._itemLookupMap,
			validated.name,
			validated.source,
		);
		if (item) return item;

		// Fall back to base items (armor, weapons, etc.)
		const baseItem = this.lookupByNameAndSource(
			this._baseItemLookupMap,
			validated.name,
			validated.source,
		);

		if (!baseItem) {
			throw new NotFoundError(
				'Item',
				`${validated.name} (${validated.source})`,
			);
		}

		return baseItem;
	}
}

export const itemService = new ItemService();
