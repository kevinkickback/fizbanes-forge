import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import { monsterIdentifierSchema, validateInput } from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

/** Manages monster/creature data and provides access to monsters. */
class MonsterService extends BaseDataService {
	constructor() {
		super({ loggerScope: 'MonsterService' });
		this._monsterIndex = null; // { id: file }
		this._monsterSummary = []; // [{ name, source, ... }]
		this._monsterDetailsCache = new Map(); // id -> details (LRU cache)
		this._cacheAccessOrder = []; // Track access order for LRU eviction
		this._maxCacheSize = 100; // Maximum cache entries
	}

	async initialize() {
		await this.initWithLoader(
			async () => {
				const index = await DataLoader.loadJSON('bestiary/index.json');
				return index || {};
			},
			{
				onLoaded: (data) => {
					this._monsterIndex = data;
					this._monsterSummary = Object.entries(data).map(([id, file]) => ({ id, file }));
					console.debug('[MonsterService]', `Loaded monster index with ${this._monsterSummary.length} entries`);
				},
				onError: () => {
					this._monsterIndex = {};
					this._monsterSummary = [];
					return {};
				},
			},
		);
		return true;
	}

	resetData() {
		super.resetData();
		this._monsterIndex = null;
		this._monsterSummary = [];
		this._monsterDetailsCache.clear();
		this._cacheAccessOrder = [];
	}

	/**
	 * Returns summary info for all monsters (id, file, optionally name/source if available)
	 */
	getAllMonsters() {
		return this._monsterSummary;
	}

	/**
	 * Loads monster details by id (from index) on demand, caches result
	 * @param {string} id - Monster ID (key from index)
	 * @returns {Promise<Object>} Monster details object
	 */
	async getMonsterDetails(id) {
		const validated = validateInput(
			monsterIdentifierSchema,
			{ id },
			'Invalid monster identifier',
		);

		if (!this._monsterIndex) {
			throw new NotFoundError('Monster', validated.id, {
				reason: 'Monster index not initialized',
			});
		}

		if (this._monsterDetailsCache.has(validated.id)) {
			// Move to end (most recently used)
			this._updateCacheAccess(validated.id);
			return this._monsterDetailsCache.get(validated.id);
		}

		const file = this._monsterIndex[validated.id];
		if (!file) {
			throw new NotFoundError('Monster', validated.id, {
				reason: 'Monster ID not found in index',
			});
		}

		try {
			const details = await DataLoader.loadJSON(`bestiary/${file}`);
			this._addToCache(validated.id, details);
			return details;
		} catch (err) {
			console.error('[MonsterService]', `Failed to load monster details for ${validated.id}:`, err);
			throw new NotFoundError('Monster', validated.id, {
				reason: 'Failed to load monster data file',
				error: err.message,
			});
		}
	}

	_addToCache(id, details) {
		// Evict least recently used if cache is full
		if (this._monsterDetailsCache.size >= this._maxCacheSize) {
			const lruId = this._cacheAccessOrder.shift();
			this._monsterDetailsCache.delete(lruId);
			console.debug('[MonsterService]', `Evicted LRU entry: ${lruId}`);
		}

		this._monsterDetailsCache.set(id, details);
		this._cacheAccessOrder.push(id);
	}

	_updateCacheAccess(id) {
		// Remove from current position and add to end (most recent)
		const index = this._cacheAccessOrder.indexOf(id);
		if (index > -1) {
			this._cacheAccessOrder.splice(index, 1);
		}
		this._cacheAccessOrder.push(id);
	}

	// Deprecated: getMonster/getMonstersByName now require details to be loaded on demand
	// Use getAllMonsters() for summary, getMonsterDetails(id) for details
}

export const monsterService = new MonsterService();
