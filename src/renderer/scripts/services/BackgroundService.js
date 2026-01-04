/** @file Simplified background manager for selection and JSON access. */

import { AppState } from '../core/AppState.js';
import { DataLoader } from '../utils/DataLoader.js';
import { eventBus, EVENTS } from '../utils/EventBus.js';

/** Manages background selection and access to background data. */
class BackgroundService {
	/** Creates a new BackgroundManager instance. */
	constructor() {
		this._backgroundData = null;
		this._selectedBackground = null;
	}

	/**
	 * Initialize background data by loading from DataUtil
	 * Normalizes legacy proficiency structure to 5etools format
	 * @returns {Promise<boolean>} Promise resolving to true if initialization succeeded
	 */
	async initialize() {
		// Skip if already initialized
		if (this._backgroundData) {
			console.debug('BackgroundService', 'Already initialized');
			return true;
		}

		console.info('[BackgroundService]', 'Initializing background data');

		try {
			this._backgroundData = await DataLoader.loadBackgrounds();

			// Normalize all backgrounds from legacy to 5etools format
			if (this._backgroundData.background) {
				this._backgroundData.background = this._backgroundData.background.map(
					(bg) => this._normalizeBackgroundStructure(bg),
				);
			}

			console.info('[BackgroundService]', 'Backgrounds loaded and normalized', {
				count: this._backgroundData.background?.length,
			});
			AppState.setLoadedData('backgrounds', this._backgroundData.background);
			eventBus.emit(
				EVENTS.DATA_LOADED,
				'backgrounds',
				this._backgroundData.background,
			);
			return true;
		} catch (error) {
			console.error(
				'BackgroundService',
				'Failed to initialize background data',
				error,
			);
			return false;
		}
	}

	/**
	 * Get all available backgrounds (returns raw JSON data)
	 * @returns {Array<Object>} Array of background objects from JSON
	 */
	getAllBackgrounds() {
		return this._backgroundData?.background || [];
	}

	/**
	 * Get a specific background by name and source (returns raw JSON data)
	 * @param {string} name - Background name
	 * @param {string} source - Source book
	 * @returns {Object|null} Background object from JSON or null if not found
	 */
	getBackground(name, source = 'PHB') {
		if (!this._backgroundData?.background) return null;

		return (
			this._backgroundData.background.find(
				(bg) => bg.name === name && bg.source === source,
			) || null
		);
	}

	/**
	 * Get fluff data for a background (for descriptions and lore)
	 * @param {string} backgroundName - Name of the background
	 * @param {string} source - Source book
	 * @returns {Object|null} Background fluff object or null if not found
	 */
	getBackgroundFluff(backgroundName, source = 'PHB') {
		if (!this._backgroundData?.fluff) return null;

		return (
			this._backgroundData.fluff.find(
				(f) => f.name === backgroundName && f.source === source,
			) || null
		);
	}

	/**
	 * Select a background (updates selection state)
	 * @param {string} backgroundName - Name of the background to select
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

	/**
	 * Get the currently selected background
	 * @returns {Object|null} Currently selected background
	 */
	getSelectedBackground() {
		return this._selectedBackground;
	}

	/**
	 * Clear the currently selected background
	 */
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
