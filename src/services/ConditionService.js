import { DataLoader } from '../lib/DataLoader.js';

class ConditionService {
	constructor() {
		this._conditionData = null;
	}

	async initialize() {
		if (this._conditionData) {
			return true;
		}

		try {
			this._conditionData = await DataLoader.loadConditions();
			return true;
		} catch (error) {
			console.error(
				'[ConditionService]',
				'Failed to initialize condition data',
				error,
			);
			return false;
		}
	}
}

export const conditionService = new ConditionService();
