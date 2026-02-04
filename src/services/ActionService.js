import { DataLoader } from '../lib/DataLoader.js';
import TextProcessor from '../lib/TextProcessor.js';
import { BaseDataService } from './BaseDataService.js';

class ActionService extends BaseDataService {
	constructor() {
		super({
			cacheKey: 'actions',
			loadEvent: 'actions:loaded',
			loggerScope: 'ActionService',
		});
		this._actionMap = null;
	}

	async initialize() {
		await this.initWithLoader(async () => DataLoader.loadJSON('actions.json'), {
			onLoaded: (data) => {
				this._actionMap = new Map();
				const actions = data?.action || [];
				if (Array.isArray(actions)) {
					for (const action of actions) {
						if (!action.name) continue;
						const key = TextProcessor.normalizeForLookup(action.name);
						this._actionMap.set(key, action);
					}
				}
			},
			emitPayload: (data) => data?.action || [],
			onError: () => {
				this._actionMap = new Map();
				return { action: [] };
			},
		});

		return true;
	}

	getAllActions() {
		return this._data?.action || [];
	}

	getAction(actionName) {
		if (!this._actionMap) return null;
		return (
			this._actionMap.get(TextProcessor.normalizeForLookup(actionName)) || null
		);
	}
}

export const actionService = new ActionService();
