/** @file Monster service for managing monster/creature data. */

import { Logger } from '../infrastructure/Logger.js';
import { DataLoader } from '../utils/DataLoader.js';

/** Manages monster/creature data and provides access to monsters. */
class MonsterService {
/** Initialize a new MonsterService instance. */
constructor() {
this._monsterData = null;
this._monsterMap = null; // Map for O(1) lookups by name (case-insensitive)
}

/**
 * Initialize monster data by loading from DataLoader
 * @returns {Promise<boolean>} True if initialization succeeded
 */
async initialize() {
// Skip if already initialized
if (this._monsterData) {
Logger.debug('MonsterService', 'Already initialized');
return true;
}

Logger.info('MonsterService', 'Initializing monster data');

try {
this._monsterData = await DataLoader.loadMonsters();
Logger.info('MonsterService', 'Monsters loaded successfully', {
count: this._monsterData.monster?.length,
});

// Build lookup map for O(1) access by name (case-insensitive)
this._monsterMap = new Map();
if (this._monsterData.monster && Array.isArray(this._monsterData.monster)) {
for (const monster of this._monsterData.monster) {
if (!monster.name) continue;
const key = monster.name.toLowerCase();
// Store with source for disambiguation if needed
if (!this._monsterMap.has(key)) {
this._monsterMap.set(key, []);
}
this._monsterMap.get(key).push(monster);
}
}

return true;
} catch (error) {
Logger.error('MonsterService', 'Failed to initialize monster data', error);
return false;
}
}

/**
 * Get all available monsters
 * @returns {Array<Object>} Array of monster objects
 */
getAllMonsters() {
return this._monsterData?.monster || [];
}

/**
 * Get a specific monster by name (case-insensitive)
 * If multiple monsters with same name exist, returns the first one
 * @param {string} monsterName - Monster name
 * @returns {Object|null} Monster object or null if not found
 */
getMonster(monsterName) {
if (!this._monsterMap) return null;
const monsters = this._monsterMap.get(monsterName.toLowerCase());
return monsters && monsters.length > 0 ? monsters[0] : null;
}

/**
 * Get all monsters with a given name (handles name collisions)
 * @param {string} monsterName - Monster name
 * @returns {Array<Object>} Array of monster objects with that name
 */
getMonstersByName(monsterName) {
if (!this._monsterMap) return [];
return this._monsterMap.get(monsterName.toLowerCase()) || [];
}
}

export const monsterService = new MonsterService();
