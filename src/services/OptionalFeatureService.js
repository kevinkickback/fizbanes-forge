import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import { EVENTS } from '../lib/EventBus.js';
import { checkAllPrerequisites } from '../lib/PrerequisiteValidator.js';
import {
	optionalFeatureIdentifierSchema,
	optionalFeatureTypeSchema,
	validateInput,
} from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

class OptionalFeatureService extends BaseDataService {
	constructor() {
		super({
			loadEvent: EVENTS.DATA_LOADED,
			loggerScope: 'OptionalFeatureService',
		});
	}

	async initialize() {
		await this.initWithLoader(
			async () => {
				console.debug(
					'[OptionalFeatureService]',
					'Initializing optional feature data',
				);

				// Load main optionalfeatures data
				const optionalfeaturesData = await DataLoader.loadJSON(
					'optionalfeatures.json',
				);

				// Load fluff data
				const fluffData = await DataLoader.loadJSON(
					'fluff-optionalfeatures.json',
				);

				// Merge data
				const aggregated = {
					optionalfeature: optionalfeaturesData.optionalfeature || [],
					optionalfeatureFluff: fluffData.optionalfeatureFluff || [],
				};

				return aggregated;
			},
			{
				emitPayload: (data) => data?.optionalfeature || [],
			},
		);
	}

	getAllOptionalFeatures() {
		return this._data?.optionalfeature || [];
	}

	getFeaturesByType(featureTypes) {
		const validated = validateInput(
			optionalFeatureTypeSchema,
			featureTypes,
			'Invalid feature type',
		);

		const types = Array.isArray(validated) ? validated : [validated];
		return this.getAllOptionalFeatures().filter((feature) =>
			feature.featureType?.some((ft) => types.includes(ft)),
		);
	}

	meetsPrerequisites(feature, character, className = null) {
		return checkAllPrerequisites(feature, character, { className });
	}

	getFeatureByName(name, source = 'PHB') {
		const validated = validateInput(
			optionalFeatureIdentifierSchema,
			{ name, source },
			'Invalid optional feature identifier',
		);

		const features = this.getAllOptionalFeatures();
		const feature =
			features.find((f) => f.name === validated.name && f.source === validated.source) ||
			features.find((f) => f.name === validated.name);

		if (!feature) {
			throw new NotFoundError('Optional Feature', `${validated.name} (${validated.source})`);
		}

		return feature;
	}
}

// Export singleton instance
export const optionalFeatureService = new OptionalFeatureService();
