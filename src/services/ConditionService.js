import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import TextProcessor from '../lib/TextProcessor.js';
import { conditionIdentifierSchema, validateInput } from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

class ConditionService extends BaseDataService {
	constructor() {
		super({ loggerScope: 'ConditionService' });
	}

	async initialize() {
		await this.initWithLoader(
			() => DataLoader.loadConditions(),
			{
				onError: () => ({ condition: [], disease: [] }),
			},
		);
		return true;
	}

	/** Get all conditions */
	getAllConditions() {
		return this._data?.condition || [];
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
