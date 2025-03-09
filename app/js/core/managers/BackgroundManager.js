/**
 * BackgroundManager.js
 * Manager class for handling character backgrounds
 */

import { Background } from '../models/Background.js';
import { CharacteristicManager } from './CharacteristicManager.js';

export class BackgroundManager {
    constructor(character) {
        this.character = character;
        this.selectedBackground = null;
        this.selectedVariant = null;
        this.characteristicManager = new CharacteristicManager(character);
        this.backgroundCache = new Map();
    }

    /**
     * Load all available backgrounds
     * @returns {Promise<Array>} Array of background data
     */
    async loadBackgrounds() {
        try {
            console.log('Loading backgrounds...');
            const backgroundData = await window.dndDataLoader.loadJsonFile('backgrounds.json');
            console.log('Loaded background data:', backgroundData);
            const fluffData = await window.dndDataLoader.loadJsonFile('fluff-backgrounds.json').catch(() => ({}));
            console.log('Loaded fluff data:', fluffData);

            // Process backgrounds
            const backgrounds = await Promise.all((backgroundData.background || []).map(async bg => {
                const fluff = fluffData.backgroundFluff?.find(f =>
                    f.name === bg.name && f.source === bg.source
                );

                // Create background data object
                const backgroundData = {
                    ...bg,
                    id: `${bg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(bg.source || 'phb').toLowerCase()}`,
                    source: bg.source || 'PHB',
                    fluff: fluff,
                    // Extract characteristics from the entries
                    characteristics: this.extractCharacteristics(bg.entries)
                };

                return backgroundData;
            }));

            console.log('Processed backgrounds:', backgrounds);
            return backgrounds;
        } catch (error) {
            console.error('Error loading backgrounds:', error);
            return [];
        }
    }

    /**
     * Extract characteristics from background entries
     * @param {Array} entries - Background entries
     * @returns {Object} Characteristics object
     */
    extractCharacteristics(entries) {
        const characteristics = {
            personalityTraits: [],
            ideals: [],
            bonds: [],
            flaws: []
        };

        // Find the "Suggested Characteristics" section
        const suggestedCharacteristics = entries?.find(entry =>
            entry.name === "Suggested Characteristics" && entry.type === "entries"
        );

        if (suggestedCharacteristics?.entries) {
            // Process each table in the entries
            suggestedCharacteristics.entries.forEach(entry => {
                if (entry.type === "table") {
                    const label = entry.colLabels[1].toLowerCase();
                    if (label === "personality trait") {
                        characteristics.personalityTraits = entry.rows.map(row => row[1]);
                    } else if (label === "ideal") {
                        characteristics.ideals = entry.rows.map(row => row[1]);
                    } else if (label === "bond") {
                        characteristics.bonds = entry.rows.map(row => row[1]);
                    } else if (label === "flaw") {
                        characteristics.flaws = entry.rows.map(row => row[1]);
                    }
                }
            });
        }

        return characteristics;
    }

    /**
     * Load a specific background by ID
     * @param {string} backgroundId - ID of the background to load
     * @returns {Promise<Background|null>} Background object or null if not found
     */
    async loadBackground(backgroundId) {
        if (this.backgroundCache.has(backgroundId)) {
            return this.backgroundCache.get(backgroundId);
        }

        try {
            const backgrounds = await this.loadBackgrounds();
            const background = backgrounds.find(b => b.id === backgroundId);

            if (!background) {
                console.warn(`Background not found: ${backgroundId}`);
                return null;
            }

            console.log('Creating background model with data:', background);
            const backgroundModel = new Background(background);
            this.backgroundCache.set(backgroundId, backgroundModel);
            return backgroundModel;
        } catch (error) {
            console.error('Error loading background:', error);
            return null;
        }
    }

    /**
     * Get all available backgrounds
     * @returns {Promise<Array>} Array of background summaries
     */
    async getAvailableBackgrounds() {
        try {
            const backgrounds = await this.loadBackgrounds();
            return backgrounds.map(b => ({
                id: b.id,
                name: b.name,
                source: b.source,
                hasVariants: (b.variants || []).length > 0
            }));
        } catch (error) {
            console.error('Error getting available backgrounds:', error);
            return [];
        }
    }

    /**
     * Get variants for a background
     * @param {string} backgroundId - ID of the background
     * @returns {Promise<Array>} Array of background variants
     */
    async getBackgroundVariants(backgroundId) {
        const background = await this.loadBackground(backgroundId);
        if (!background) return [];
        return background.getVariants();
    }

    /**
     * Set the character's background
     * @param {string} backgroundId - ID of the background
     * @param {string} variantName - Optional variant name
     * @returns {Promise<boolean>} True if background was set successfully
     */
    async setBackground(backgroundId, variantName = null) {
        try {
            // Clear existing background features
            this.clearBackground();

            // Load background data
            const background = await this.loadBackground(backgroundId);
            if (!background) {
                console.warn(`Failed to load background: ${backgroundId}`);
                return false;
            }

            // Set new background
            this.selectedBackground = background;

            // Set variant if specified
            if (variantName) {
                this.selectedVariant = background.getVariants().find(v => v.name === variantName);
            }

            // Apply proficiencies
            const proficiencies = this.selectedVariant?.proficiencies || background.proficiencies;
            await this.applyProficiencies(proficiencies);

            // Apply languages
            await this.applyLanguages(background.languages);

            // Add equipment
            if (background.equipment?.length > 0) {
                for (const item of background.equipment) {
                    await this.character.addItem(item.id, item.quantity || 1);
                }
            }

            // Add feature
            const feature = this.selectedVariant?.feature || background.feature;
            if (feature) {
                this.character.addFeature('background', feature.name, feature.description);
            }

            return true;
        } catch (error) {
            console.error('Error setting background:', error);
            return false;
        }
    }

    /**
     * Apply proficiencies from background
     * @param {Object} proficiencies - Proficiency data
     */
    async applyProficiencies(proficiencies) {
        if (!proficiencies) return;

        // Apply skill proficiencies
        if (proficiencies.skills?.fixed) {
            for (const skill of proficiencies.skills.fixed) {
                await this.character.addProficiency('skill', skill, 'Background');
            }
        }

        // Apply tool proficiencies
        if (proficiencies.tools?.fixed) {
            for (const tool of proficiencies.tools.fixed) {
                await this.character.addProficiency('tool', tool, 'Background');
            }
        }
    }

    /**
     * Apply languages from background
     * @param {Object} languages - Language data
     */
    async applyLanguages(languages) {
        if (!languages) return;

        // Apply fixed languages
        if (languages.fixed) {
            for (const language of languages.fixed) {
                await this.character.addLanguage(language, 'Background');
            }
        }
    }

    /**
     * Set a characteristic value
     * @param {string} type - Type of characteristic
     * @param {string} value - Characteristic value
     * @param {number} index - Index of the characteristic
     * @returns {boolean} True if characteristic was set successfully
     */
    setCharacteristic(type, value, index) {
        return this.characteristicManager.setCharacteristic(type, value, index);
    }

    /**
     * Get all characteristics
     * @returns {Object} Object containing all characteristics
     */
    getCharacteristics() {
        return this.characteristicManager.getAllCharacteristics();
    }

    /**
     * Clear the current background
     */
    clearBackground() {
        // Remove existing proficiencies from this source
        if (typeof this.character.removeProficienciesBySource === 'function') {
            this.character.removeProficienciesBySource('background');
        }

        // Remove languages
        if (typeof this.character.removeLanguagesBySource === 'function') {
            this.character.removeLanguagesBySource('background');
        }

        // Remove features
        if (typeof this.character.removeFeaturesBySource === 'function') {
            this.character.removeFeaturesBySource('background');
        }

        // Clear background-specific data
        this.character.background = '';
        this.character.backgroundVariant = '';
        this.character.backgroundCustomizations = {};

        // Clear characteristics
        if (this.characteristicManager) {
            this.characteristicManager.clearCharacteristics();
        }

        // Clear selected background and variant
        this.selectedBackground = null;
        this.selectedVariant = null;

        // Trigger any necessary UI updates
        if (typeof this.character.updateDisplay === 'function') {
            this.character.updateDisplay();
        }
    }

    /**
     * Get the current background
     * @returns {Background|null} Current background or null if none selected
     */
    getBackground() {
        return this.selectedBackground;
    }

    /**
     * Get the background feature
     * @returns {Object|null} Background feature or null if none selected
     */
    getBackgroundFeature() {
        if (!this.selectedBackground) return null;
        return this.selectedVariant?.feature || this.selectedBackground.feature;
    }

    /**
     * Get background proficiencies
     * @returns {Object|null} Background proficiencies or null if none selected
     */
    getProficiencies() {
        if (!this.selectedBackground) return null;
        return this.selectedVariant?.proficiencies || this.selectedBackground.proficiencies;
    }

    /**
     * Get background languages
     * @returns {Object|null} Background languages or null if none selected
     */
    getLanguages() {
        if (!this.selectedBackground) return null;
        return this.selectedBackground.languages;
    }

    /**
     * Get characteristic options for the current background
     * @returns {Promise<Object|null>} Characteristic options or null if none available
     */
    async getCharacteristicOptions() {
        if (!this.selectedBackground) return null;
        return this.characteristicManager.getCharacteristicOptions(this.selectedBackground.id);
    }

    /**
     * Clear the background cache
     */
    clearCache() {
        this.backgroundCache.clear();
    }
} 