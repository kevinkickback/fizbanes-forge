/** @file Condition service for managing conditions data. */

import { Logger } from '../infrastructure/Logger.js';
import { DataLoader } from '../utils/DataLoader.js';

/** Manages condition data and provides access to conditions. */
class ConditionService {
/** Initialize a new ConditionService instance. */
constructor() {
this._conditionData = null;
this._conditionMap = null; // Map for O(1) lookups by name (case-insensitive)
}

/**
 * Initialize condition data by loading from DataLoader
 * @returns {Promise<boolean>} True if initialization succeeded
 */
async initialize() {
// Skip if already initialized
if (this._conditionData) {
Logger.debug('ConditionService', 'Already initialized');
return true;
}

Logger.info('ConditionService', 'Initializing condition data');

try {
this._conditionData = await DataLoader.loadConditions();
Logger.info('ConditionService', 'Conditions loaded successfully', {
count: this._conditionData.condition?.length,
});

// Build lookup map for O(1) access by name (case-insensitive)
this._conditionMap = new Map();
if (this._conditionData.condition && Array.isArray(this._conditionData.condition)) {
for (const condition of this._conditionData.condition) {
if (!condition.name) continue;
const key = condition.name.toLowerCase();
this._conditionMap.set(key, condition);
}
}

return true;
} catch (error) {
Logger.error('ConditionService', 'Failed to initialize condition data', error);
return false;
}
}

/**
 * Get all available conditions
 * @returns {Array<Object>} Array of condition objects
 */
getAllConditions() {
return this._conditionData?.condition || [];
}

/**
 * Get a specific condition by name (case-insensitive)
 * @param {string} conditionName - Condition name
 * @returns {Object|null} Condition object or null if not found
 */
getCondition(conditionName) {
if (!this._conditionMap) return null;
return this._conditionMap.get(conditionName.toLowerCase()) || null;
}
}

export const conditionService = new ConditionService();
