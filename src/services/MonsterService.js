/** @file Monster service for managing monster/creature data. */

import { DataLoader } from '../lib/DataLoader.js';
import DataNormalizer from '../lib/DataNormalizer.js';
import { BaseDataService } from './BaseDataService.js';

/** Manages monster/creature data and provides access to monsters. */
class MonsterService extends BaseDataService {
	/** Initialize a new MonsterService instance. */
	constructor() {
		super({ loggerScope: 'MonsterService' });
		this._monsterMap = null; // Map for O(1) lookups by name (case-insensitive)
	}

	/**
	 * Initialize monster data by loading from DataLoader
	 * @returns {Promise<boolean>} True if initialization succeeded
	 */
	async initialize() {
		await this.initWithLoader(
			async () => {
				console.info('[MonsterService]', 'Initializing monster data');
				return DataLoader.loadMonsters();
			},
			{
				onLoaded: (data) => {
					console.info('[MonsterService]', 'Monsters loaded successfully', {
						count: data?.monster?.length,
					});
					this._monsterMap = this._buildMonsterMap(data?.monster);
				},
				onError: () => {
					this._monsterMap = new Map();
					return { monster: [] };
				},
			},
		);

		return true;
	}

	_buildMonsterMap(monsters = []) {
		const map = new Map();
		for (const monster of monsters) {
			if (!monster?.name) continue;
			const key = DataNormalizer.normalizeForLookup(monster.name);
			if (!map.has(key)) map.set(key, []);
			map.get(key).push(monster);
		}
		return map;
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
		if (!this._monsterMap) return null;
		const monsters = this._monsterMap.get(
			DataNormalizer.normalizeForLookup(monsterName),
		);
		return monsters && monsters.length > 0 ? monsters[0] : null;
	}

	/**
	 * Get all monsters with a given name (handles name collisions)
	 * @param {string} monsterName - Monster name
	 * @returns {Array<Object>} Array of monster objects with that name
	 */
	getMonstersByName(monsterName) {
		if (!this._monsterMap) return [];
		return (
			this._monsterMap.get(DataNormalizer.normalizeForLookup(monsterName)) || []
		);
	}
}

export const monsterService = new MonsterService();
