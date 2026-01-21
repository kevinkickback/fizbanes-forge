import { DataLoader } from '../lib/DataLoader.js';
import DataNormalizer from '../lib/DataNormalizer.js';
import { BaseDataService } from './BaseDataService.js';

/** Manages monster/creature data and provides access to monsters. */
class MonsterService extends BaseDataService {
	constructor() {
		super({ loggerScope: 'MonsterService' });
		this._monsterMap = null; // Map for O(1) lookups by name (case-insensitive)
	}

	async initialize() {
		await this.initWithLoader(
			async () => {
				console.debug('[MonsterService]', 'Initializing monster data');
				return DataLoader.loadMonsters();
			},
			{
				onLoaded: (data) => {
					console.debug('[MonsterService]', 'Monsters loaded successfully', {
						count: data?.monster?.length,
					});
					this._monsterMap = this.buildLookupMap(data?.monster, { allowMultiple: true });
				},
				onError: () => {
					this._monsterMap = new Map();
					return { monster: [] };
				},
			},
		);

		return true;
	}

	/**
	 * Get all available monsters
	 * @returns {Array<Object>} Array of monster objects
	 */
	getAllMonsters() {
		return this._data?.monster || [];
	}

	/**
	 * Get a specific monster by name (case-insensitive)
	 * If multiple monsters with same name exist, returns the first one
	 * @param {string} monsterName - Monster name
	 * @returns {Object|null} Monster object or null if not found
	 */
	getMonster(monsterName) {
		return this.lookupByName(this._monsterMap, monsterName);
	}

	/**
	 * Get all monsters with a given name (handles name collisions)
	 * @param {string} monsterName - Monster name
	 * @returns {Array<Object>} Array of monster objects with that name
	 */
	getMonstersByName(monsterName) {
		if (!this._monsterMap || !monsterName) return [];
		const normalized = DataNormalizer.normalizeForLookup(monsterName);
		const result = this._monsterMap.get(normalized);
		return Array.isArray(result) ? result : (result ? [result] : []);
	}
}

export const monsterService = new MonsterService();
