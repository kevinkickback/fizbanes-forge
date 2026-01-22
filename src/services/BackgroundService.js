import { DataLoader } from '../lib/DataLoader.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { BaseDataService } from './BaseDataService.js';

class BackgroundService extends BaseDataService {
	constructor() {
		super({
			cacheKey: 'backgrounds',
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
				onLoaded: (data) => {
					console.debug(
						'[BackgroundService]',
						'Backgrounds loaded and normalized',
						{
							count: data?.background?.length,
						},
					);
				},
				emitPayload: (data) => ['backgrounds', data?.background || []],
			},
		);
	}

	/** @returns {Array<Object>} Array of background objects from JSON */
	getAllBackgrounds() {
		return this._data?.background || [];
	}

	/** @param {string} name - Background name
	 * @param {string} source - Source book
	 * @returns {Object|null} Background object from JSON or null if not found
	 */
	getBackground(name, source = 'PHB') {
		if (!this._data?.background) return null;

		return (
			this._data.background.find(
				(bg) => bg.name === name && bg.source === source,
			) || null
		);
	}

	/** @param {string} backgroundName - Name of the background
	 * @param {string} source - Source book
	 * @returns {Object|null} Background fluff object or null if not found
	 */
	getBackgroundFluff(backgroundName, source = 'PHB') {
		if (!this._data?.fluff) return null;

		return (
			this._data.fluff.find(
				(f) => f.name === backgroundName && f.source === source,
			) || null
		);
	}

	/** @param {string} backgroundName - Name of the background to select
	 * @param {string} source - Source of the background
	 * @returns {Object|null} The selected background or null if not found
	 */
	selectBackground(backgroundName, source = 'PHB') {
		this._selectedBackground = this.getBackground(backgroundName, source);

		if (this._selectedBackground) {
			eventBus.emit(EVENTS.BACKGROUND_SELECTED, this._selectedBackground);
		}

		return this._selectedBackground;
	}

	/** @returns {Object|null} Currently selected background */
	getSelectedBackground() {
		return this._selectedBackground;
	}

	/** Clear the currently selected background */
	clearSelection() {
		this._selectedBackground = null;
		eventBus.emit('background:cleared');
	}

	/**
	 * Normalize background from legacy proficiency structure to 5etools format.
	 * Converts skillProficiencies/toolProficiencies/languageProficiencies to
	 * proficiencies.{skills, tools, languages}
	 * @private
	 * @param {Object} background - Background data to normalize
	 * @returns {Object} Normalized background object
	 */
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

	/**
	 * Normalize skill proficiencies from legacy object format to 5etools array format
	 * @private
	 * @param {Array<Object>} skillProfs - Legacy skill proficiencies [{skill1: true, choose: {...}}]
	 * @returns {Array<Object>} Normalized skills [{skill: "Acrobatics"}, {skill: "Animal Handling"}, ...]
	 */
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

	/**
	 * Normalize tool proficiencies from legacy object format to 5etools array format
	 * @private
	 * @param {Array<Object>} toolProfs - Legacy tool proficiencies [{tool1: true, choose: {...}}]
	 * @returns {Array<Object>} Normalized tools
	 */
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

	/**
	 * Normalize language proficiencies from legacy object format to 5etools array format
	 * @private
	 * @param {Array<Object>} langProfs - Legacy language proficiencies [{language1: true, choose: {...}}]
	 * @returns {Array<Object>} Normalized languages
	 */
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

	/**
	 * Convert skill abbreviations to proper names
	 * @private
	 * @param {string} skillKey - Skill key (e.g., "acrobatics" or "Acrobatics")
	 * @returns {string} Proper skill name
	 */
	_normalizeSkillName(skillKey) {
		// Simple capitalization for now, could map specific abbreviations if needed
		if (!skillKey) return '';
		return skillKey.charAt(0).toUpperCase() + skillKey.slice(1).toLowerCase();
	}
}

export const backgroundService = new BackgroundService();
