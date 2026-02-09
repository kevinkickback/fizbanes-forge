import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import TextProcessor from '../lib/TextProcessor.js';
import { actionIdentifierSchema, validateInput } from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

class ActionService extends BaseDataService {
	constructor() {
		super({
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
		const validated = validateInput(
			actionIdentifierSchema,
			{ name: actionName },
			'Invalid action identifier',
		);

		if (!this._actionMap) {
			throw new NotFoundError('Action', validated.name, {
				reason: 'Action data not initialized',
			});
		}

		const action = this._actionMap.get(TextProcessor.normalizeForLookup(validated.name));
		if (!action) {
			throw new NotFoundError('Action', validated.name);
		}

		return action;
	}
}

export const actionService = new ActionService();
