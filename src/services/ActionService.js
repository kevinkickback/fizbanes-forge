import { DataLoader } from '../lib/DataLoader.js';
import DataNormalizer from '../lib/DataNormalizer.js';
import { BaseDataService } from './BaseDataService.js';

/** Manages action data and provides access to actions. */
class ActionService extends BaseDataService {
	constructor() {
		super({
			cacheKey: 'actions',
			loggerScope: 'ActionService',
			eventKey: 'ACTIONS_LOADED',
			dataKey: 'action',
		});
		this._actionMap = null; // Map for O(1) lookups by name (case-insensitive)
	}

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

	getAllActions() {
		return this._data?.action || [];
	}

	/** Get a specific action by name (case-insensitive). */
	getAction(actionName) {
		if (!this._actionMap) return null;
		return (
			this._actionMap.get(DataNormalizer.normalizeForLookup(actionName)) || null
		);
	}
}

export const actionService = new ActionService();
