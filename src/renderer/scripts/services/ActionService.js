/** @file Action service for managing action data. */

import { DataLoader } from '../utils/DataLoader.js';
import DataNormalizer from '../utils/DataNormalizer.js';
import { BaseDataService } from './BaseDataService.js';

/** Manages action data and provides access to actions. */
class ActionService extends BaseDataService {
	/** Initialize a new ActionService instance. */
	constructor() {
		super({
			cacheKey: 'actions',
			loggerScope: 'ActionService',
			eventKey: 'ACTIONS_LOADED',
			dataKey: 'action',
		});
		this._actionMap = null; // Map for O(1) lookups by name (case-insensitive)
	}

	/**
	 * Initialize action data by loading from DataLoader
	 * @returns {Promise<boolean>} True if initialization succeeded
	 */
	async initialize() {
		await this.initWithLoader(
			async () => DataLoader.loadJSON('actions.json'),
			{
				onLoaded: (data) => {
					// Build lookup map for O(1) access by name (case-insensitive)
					this._actionMap = new Map();
					const actions = data?.action || [];
					if (Array.isArray(actions)) {
						for (const action of actions) {
							if (!action.name) continue;
							const key = DataNormalizer.normalizeForLookup(action.name);
							this._actionMap.set(key, action);
						}
					}
				},
				emitPayload: (data) => data?.action || [],
				onError: () => {
					this._actionMap = new Map();
					return { action: [] };
				},
			},
		);

		return true;
	}

	/**
	 * Get all available actions
	 * @returns {Array<Object>} Array of action objects
	 */
	getAllActions() {
		return this._data?.action || [];
	}

	/**
	 * Get a specific action by name (case-insensitive)
	 * @param {string} actionName - Action name
	 * @returns {Object|null} Action object or null if not found
	 */
	getAction(actionName) {
		if (!this._actionMap) return null;
		return (
			this._actionMap.get(DataNormalizer.normalizeForLookup(actionName)) || null
		);
	}
}

export const actionService = new ActionService();
