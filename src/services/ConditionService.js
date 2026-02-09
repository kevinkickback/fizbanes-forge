import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import TextProcessor from '../lib/TextProcessor.js';
import { conditionIdentifierSchema, validateInput } from '../lib/ValidationSchemas.js';

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

	/** Get all conditions */
	getAllConditions() {
		return this._conditionData?.condition || [];
	}

	/** Get condition by name with validation */
	getCondition(name) {
		const validated = validateInput(
			conditionIdentifierSchema,
			{ name },
			'Invalid condition identifier',
		);

		const conditions = this.getAllConditions();
		const condition = conditions.find(
			(c) => TextProcessor.normalizeForLookup(c.name) === TextProcessor.normalizeForLookup(validated.name),
		);

		if (!condition) {
			throw new NotFoundError('Condition', validated.name);
		}

		return condition;
	}
}

export const conditionService = new ConditionService();
