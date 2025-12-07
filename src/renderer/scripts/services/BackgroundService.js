/** @file Simplified background manager for selection and JSON access. */

import { AppState } from '../core/AppState.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { Logger } from '../infrastructure/Logger.js';
import { DataLoader } from '../utils/DataLoader.js';

/** Manages background selection and access to background data. */
class BackgroundService {
	/** Creates a new BackgroundManager instance. */
	constructor() {
		this._backgroundData = null;
		this._selectedBackground = null;
	}

	/**
	 * Initialize background data by loading from DataUtil
	 * @returns {Promise<boolean>} Promise resolving to true if initialization succeeded
	 */
	async initialize() {
		// Skip if already initialized
		if (this._backgroundData) {
			Logger.debug('BackgroundService', 'Already initialized');
			return true;
		}

		Logger.info('BackgroundService', 'Initializing background data');

		try {
			this._backgroundData = await DataLoader.loadBackgrounds();
			Logger.info('BackgroundService', 'Backgrounds loaded successfully', {
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
			Logger.error(
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
}

export const backgroundService = new BackgroundService();
