import { capitalize } from '../lib/5eToolsParser.js';
import { DataLoader } from '../lib/DataLoader.js';
import { NotFoundError } from '../lib/Errors.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { backgroundIdentifierSchema, validateInput } from '../lib/ValidationSchemas.js';
import { BaseDataService } from './BaseDataService.js';

class BackgroundService extends BaseDataService {
	constructor() {
		super({
			loadEvent: EVENTS.DATA_LOADED,
			loggerScope: 'BackgroundService',
		});
		this._selectedBackground = null;
	}

	async initialize() {
		return this.initWithLoader(
			async () => {
				const data = await DataLoader.loadBackgrounds();
				if (data?.background) {
					return {
						...data,
						background: data.background.map((bg) =>
							this._normalizeBackgroundStructure(bg),
						),
					};
				}
				return data;
			},
			{
				onLoaded: () => { },
				emitPayload: (data) => ['backgrounds', data?.background || []],
			},
		);
	}

	getAllBackgrounds() {
		return this._data?.background || [];
	}

	getBackground(name, source = 'PHB') {
		const validated = validateInput(
			backgroundIdentifierSchema,
			{ name, source },
			'Invalid background identifier',
		);

		if (!this._data?.background) {
			throw new NotFoundError(
				'Background',
				`${validated.name} (${validated.source})`,
			);
		}

		const background = this._data.background.find(
			(bg) => bg.name === validated.name && bg.source === validated.source,
		);

		if (!background) {
			throw new NotFoundError(
				'Background',
				`${validated.name} (${validated.source})`,
			);
		}

		return background;
	}

	selectBackground(backgroundName, source = 'PHB') {
		this._selectedBackground = this.getBackground(backgroundName, source);

		if (this._selectedBackground) {
			eventBus.emit(EVENTS.BACKGROUND_SELECTED, this._selectedBackground);
		}

		return this._selectedBackground;
	}

	_normalizeBackgroundStructure(background) {
		if (background.proficiencies && !background.skillProficiencies) {
			return background;
		}

		const normalized = { ...background };

		if (
			background.skillProficiencies ||
			background.toolProficiencies ||
			background.languageProficiencies
		) {
			normalized.proficiencies = {
				skills: this._normalizeProficiencies(
					background.skillProficiencies,
					'skill',
				),
				tools: this._normalizeProficiencies(background.toolProficiencies, 'tool'),
				languages: this._normalizeProficiencies(
					background.languageProficiencies,
					'language',
				),
			};
		}

		// Map startingEquipment to equipment for BackgroundDetails rendering
		if (background.startingEquipment && !normalized.equipment) {
			normalized.equipment = background.startingEquipment;
		}

		return normalized;
	}

	_normalizeProficiencies(rawData, type) {
		if (!rawData) return [];

		const normalized = [];

		for (const entry of rawData) {
			for (const [key, value] of Object.entries(entry)) {
				const keyLower = key.toLowerCase();

				if (keyLower === 'choose' && value) {
					normalized.push({ choose: value });
				} else if (
					type === 'language' &&
					(keyLower === 'any' || keyLower === 'anystandard') &&
					typeof value === 'number'
				) {
					normalized.push({
						choose: { count: value, type: keyLower },
					});
				} else if (value === true) {
					const name = type === 'skill' ? this._normalizeSkillName(key) : key;
					normalized.push({ [type]: name });
				}
			}
		}

		return normalized;
	}

	_normalizeSkillName(skillKey) {
		if (!skillKey) return '';
		return capitalize(skillKey);
	}
}

export const backgroundService = new BackgroundService();
