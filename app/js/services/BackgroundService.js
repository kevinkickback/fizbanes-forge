/**
 * @file BackgroundManager.js
 * Simplified manager for character background selection and data access.
 * Works directly with JSON data from DataUtil - no unnecessary transformations.
 */

import { DataLoader } from '../utils/DataLoader.js';
import { eventEmitter } from '../utils/EventBus.js';

/**
 * Manages character background selection and provides access to background data
 */
class BackgroundService {
    /**
     * Creates a new BackgroundManager instance
     */
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
            return true;
        }

        try {
            this._backgroundData = await DataLoader.loadBackgrounds();
            eventEmitter.emit('backgrounds:loaded', this._backgroundData.background);
            return true;
        } catch (error) {
            console.error('Failed to initialize background data:', error);
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

        return this._backgroundData.background.find(bg =>
            bg.name === name && bg.source === source
        ) || null;
    }

    /**
     * Get fluff data for a background (for descriptions and lore)
     * @param {string} backgroundName - Name of the background
     * @param {string} source - Source book
     * @returns {Object|null} Background fluff object or null if not found
     */
    getBackgroundFluff(backgroundName, source = 'PHB') {
        if (!this._backgroundData?.fluff) return null;

        return this._backgroundData.fluff.find(f =>
            f.name === backgroundName && f.source === source
        ) || null;
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
            eventEmitter.emit('background:selected', this._selectedBackground);
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
        eventEmitter.emit('background:cleared');
    }
}

export const backgroundService = new BackgroundService();

