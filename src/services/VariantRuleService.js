import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import TextProcessor from '../lib/TextProcessor.js';
import { validateInput, variantRuleIdentifierSchema } from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

class VariantRuleService extends BaseDataService {
	constructor() {
		super({ loggerScope: 'VariantRuleService' });
		this._variantRuleMap = null;
	}

	resetData() {
		super.resetData();
		this._variantRuleMap = null;
	}

	async initialize() {
		await this.initWithLoader(
			async () => {
				const data = await DataLoader.loadVariantRules();
				return data;
			},
			{
				onLoaded: (data) => {
					// Build lookup map for O(1) access by name (case-insensitive)
					this._variantRuleMap = new Map();
					if (data.variantrule && Array.isArray(data.variantrule)) {
						for (const rule of data.variantrule) {
							if (!rule.name) continue;
							const key = TextProcessor.normalizeForLookup(rule.name);
							this._variantRuleMap.set(key, rule);
						}
					}
				},
				onError: () => {
					console.warn(
						'[VariantRuleService]',
						'Variant rules unavailable, continuing without them',
					);
					this._variantRuleMap = new Map();
					return { variantrule: [] };
				},
			},
		);

		return true;
	}

	getVariantRule(ruleName) {
		const validated = validateInput(
			variantRuleIdentifierSchema,
			{ name: ruleName },
			'Invalid variant rule identifier',
		);

		if (!this._variantRuleMap) {
			throw new NotFoundError('Variant Rule', validated.name, {
				reason: 'Variant rule data not initialized',
			});
		}

		const rule = this._variantRuleMap.get(TextProcessor.normalizeForLookup(validated.name));
		if (!rule) {
			throw new NotFoundError('Variant Rule', validated.name);
		}

		return rule;
	}
}

export const variantRuleService = new VariantRuleService();
