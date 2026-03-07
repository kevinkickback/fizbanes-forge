import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import { EVENTS } from '../lib/EventBus.js';
import { checkAllPrerequisites } from '../lib/PrerequisiteValidator.js';
import TextProcessor from '../lib/TextProcessor.js';
import { featIdentifierSchema, validateInput } from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

class FeatService extends BaseDataService {
	constructor() {
		super({
			loadEvent: EVENTS.DATA_LOADED,
			loggerScope: 'FeatService',
		});
		this._featMap = null; // Map for O(1) lookups by name (case-insensitive)
	}

	async initialize() {
		return this.initWithLoader(() => DataLoader.loadFeats(), {
			onLoaded: (data) => {
				// Build lookup map for O(1) access by name (case-insensitive)
				this._featMap = new Map();
				if (data?.feat && Array.isArray(data.feat)) {
					for (const feat of data.feat) {
						if (!feat.name) continue;
						const key = TextProcessor.normalizeForLookup(feat.name);
						this._featMap.set(key, feat);
					}
				}
			},
			emitPayload: (data) => ['feats', data?.feat || []],
		});
	}

	getAllFeats() {
		return this._data?.feat || [];
	}

	getFeat(featName, source = 'PHB') {
		const validated = validateInput(
			featIdentifierSchema,
			{ name: featName, source },
			'Invalid feat identifier',
		);

		if (!this._featMap) {
			throw new NotFoundError('Feat', `${validated.name} (${validated.source})`);
		}

		const feat = this._featMap.get(
			TextProcessor.normalizeForLookup(validated.name),
		);

		if (!feat) {
			throw new NotFoundError('Feat', `${validated.name} (${validated.source})`);
		}

		return feat;
	}

	isFeatValidForCharacter(feat, character, options = {}) {
		return checkAllPrerequisites(feat, character, options).met;
	}
}

export const featService = new FeatService();
