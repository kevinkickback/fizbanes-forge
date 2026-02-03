import { DataLoader } from '../lib/DataLoader.js';
import { BaseDataService } from './BaseDataService.js';

/** Manages monster/creature data and provides access to monsters. */
class MonsterService extends BaseDataService {
	constructor() {
		super({ loggerScope: 'MonsterService' });
		this._monsterIndex = null; // { id: file }
		this._monsterSummary = []; // [{ name, source, ... }]
		this._monsterDetailsCache = new Map(); // id -> details
	}

	async initialize() {
		// Only load the index file at startup
		const index = await DataLoader.loadJSON('bestiary/index.json');
		this._monsterIndex = index || {};
		// Optionally, load a summary file if available, else build summary from index
		// For now, just build a summary with ids and file names
		this._monsterSummary = Object.entries(this._monsterIndex).map(([id, file]) => ({ id, file }));
		console.debug('MonsterService', `Loaded monster index with ${this._monsterSummary.length} entries`);
		return true;
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
	 * @returns {Promise<Object|null>} Monster details object
	 */
	async getMonsterDetails(id) {
		if (!id || !this._monsterIndex) return null;
		if (this._monsterDetailsCache.has(id)) {
			return this._monsterDetailsCache.get(id);
		}
		const file = this._monsterIndex[id];
		if (!file) return null;
		try {
			const details = await DataLoader.loadJSON(`bestiary/${file}`);
			this._monsterDetailsCache.set(id, details);
			return details;
		} catch (err) {
			console.error('MonsterService', `Failed to load monster details for ${id}:`, err);
			return null;
		}
	}

	// Deprecated: getMonster/getMonstersByName now require details to be loaded on demand
	// Use getAllMonsters() for summary, getMonsterDetails(id) for details
}

export const monsterService = new MonsterService();
