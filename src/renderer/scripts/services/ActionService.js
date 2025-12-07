/** @file Action service for managing action data. */

import { Logger } from '../infrastructure/Logger.js';
import { DataLoader } from '../utils/DataLoader.js';

/** Manages action data and provides access to actions. */
class ActionService {
/** Initialize a new ActionService instance. */
constructor() {
this._actionData = null;
this._actionMap = null; // Map for O(1) lookups by name (case-insensitive)
}

/**
 * Initialize action data by loading from DataLoader
 * @returns {Promise<boolean>} True if initialization succeeded
 */
async initialize() {
// Skip if already initialized
if (this._actionData) {
Logger.debug('ActionService', 'Already initialized');
return true;
}

Logger.info('ActionService', 'Initializing action data');

try {
this._actionData = await DataLoader.loadActions();
Logger.info('ActionService', 'Actions loaded successfully', {
count: this._actionData.action?.length,
});

// Build lookup map for O(1) access by name (case-insensitive)
this._actionMap = new Map();
if (this._actionData.action && Array.isArray(this._actionData.action)) {
for (const action of this._actionData.action) {
if (!action.name) continue;
const key = action.name.toLowerCase();
this._actionMap.set(key, action);
}
}

return true;
} catch (error) {
Logger.error('ActionService', 'Failed to initialize action data', error);
return false;
}
}

/**
 * Get all available actions
 * @returns {Array<Object>} Array of action objects
 */
getAllActions() {
return this._actionData?.action || [];
}

/**
 * Get a specific action by name (case-insensitive)
 * @param {string} actionName - Action name
 * @returns {Object|null} Action object or null if not found
 */
getAction(actionName) {
if (!this._actionMap) return null;
return this._actionMap.get(actionName.toLowerCase()) || null;
}
}

export const actionService = new ActionService();
