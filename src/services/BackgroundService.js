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
				// Normalize all backgrounds from legacy to 5etools format before caching
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
		// If already normalized or no proficiencies, return as-is
		if (background.proficiencies && !background.skillProficiencies) {
			return background;
		}

		// Create normalized proficiencies structure
		const normalized = { ...background };

		if (
			background.skillProficiencies ||
			background.toolProficiencies ||
			background.languageProficiencies
		) {
			normalized.proficiencies = {
				skills: this._normalizeSkillProficiencies(
					background.skillProficiencies,
				),
				tools: this._normalizeToolProficiencies(background.toolProficiencies),
				languages: this._normalizeLanguageProficiencies(
					background.languageProficiencies,
				),
			};
		}

		// Map startingEquipment to equipment for BackgroundDetails rendering
		if (background.startingEquipment && !normalized.equipment) {
			normalized.equipment = background.startingEquipment;
		}

		return normalized;
	}

	_normalizeSkillProficiencies(skillProfs) {
		if (!skillProfs) return [];

		const normalized = [];

		// Iterate through each skill proficiency object
		for (const skillEntry of skillProfs) {
			for (const [key, value] of Object.entries(skillEntry)) {
				// Skip the 'choose' property
				if (key === 'choose') {
					if (value) {
						// Handle proficiency choice
						normalized.push({
							choose: value,
						});
					}
				} else if (value === true) {
					// Convert skill name to proper format (handle abbreviations)
					normalized.push({
						skill: this._normalizeSkillName(key),
					});
				}
			}
		}

		return normalized;
	}

	_normalizeToolProficiencies(toolProfs) {
		if (!toolProfs) return [];

		const normalized = [];

		for (const toolEntry of toolProfs) {
			for (const [key, value] of Object.entries(toolEntry)) {
				if (key === 'choose') {
					if (value) {
						normalized.push({
							choose: value,
						});
					}
				} else if (value === true) {
					normalized.push({
						tool: key,
					});
				}
			}
		}

		return normalized;
	}

	_normalizeLanguageProficiencies(langProfs) {
		if (!langProfs) return [];

		const normalized = [];

		for (const langEntry of langProfs) {
			for (const [key, value] of Object.entries(langEntry)) {
				const keyLower = key.toLowerCase();

				if (keyLower === 'choose' && value) {
					normalized.push({ choose: value });
				} else if (
					(keyLower === 'any' || keyLower === 'anystandard') &&
					typeof value === 'number'
				) {
					normalized.push({
						choose: {
							count: value,
							type: keyLower,
						},
					});
				} else if (value === true) {
					normalized.push({ language: key });
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
