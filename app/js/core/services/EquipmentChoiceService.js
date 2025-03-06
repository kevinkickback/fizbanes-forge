/**
 * EquipmentChoiceService.js
 * Service class for handling equipment choice operations
 */

import { StartingEquipment } from '../models/StartingEquipment.js';

export class EquipmentChoiceService {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.cache = new Map();
    }

    /**
     * Get starting equipment choices for a class
     * @param {string} classId - ID of the class
     * @returns {Promise<StartingEquipment|null>} Starting equipment choices or null if not found
     */
    async getClassStartingEquipment(classId) {
        try {
            // Check cache first
            if (this.cache.has(classId)) {
                return this.cache.get(classId);
            }

            const classes = await this.dataLoader.loadClasses();
            const classData = classes.find(c => c.id === classId);
            if (!classData?.startingEquipment) return null;

            const startingEquipment = new StartingEquipment(classData.startingEquipment);
            this.cache.set(classId, startingEquipment);
            return startingEquipment;
        } catch (error) {
            console.error('Error getting starting equipment:', error);
            return null;
        }
    }

    /**
     * Get background starting equipment
     * @param {string} backgroundId - ID of the background
     * @returns {Promise<Array>} Array of background equipment items
     */
    async getBackgroundStartingEquipment(backgroundId) {
        try {
            const backgrounds = await this.dataLoader.loadBackgrounds();
            const background = backgrounds.find(b => b.id === backgroundId);
            return background?.startingEquipment || [];
        } catch (error) {
            console.error('Error getting background equipment:', error);
            return [];
        }
    }

    /**
     * Validate equipment choices for a class
     * @param {string} classId - ID of the class
     * @param {Object} choices - Map of choice IDs to selected item IDs
     * @returns {Promise<boolean>} True if choices are valid
     */
    async validateEquipmentChoices(classId, choices) {
        try {
            const startingEquipment = await this.getClassStartingEquipment(classId);
            if (!startingEquipment) return false;

            return startingEquipment.validateChoices(choices);
        } catch (error) {
            console.error('Error validating equipment choices:', error);
            return false;
        }
    }

    /**
     * Get all items that would be granted by a set of choices
     * @param {string} classId - ID of the class
     * @param {Object} choices - Map of choice IDs to selected item IDs
     * @param {string} [backgroundId] - Optional background ID
     * @returns {Promise<Array>} Array of items with quantities
     */
    async getSelectedEquipment(classId, choices, backgroundId = null) {
        try {
            const items = [];

            // Get class starting equipment
            const startingEquipment = await this.getClassStartingEquipment(classId);
            if (startingEquipment) {
                items.push(...startingEquipment.getSelectedItems(choices));
            }

            // Get background equipment if provided
            if (backgroundId) {
                const backgroundItems = await this.getBackgroundStartingEquipment(backgroundId);
                items.push(...backgroundItems);
            }

            return items;
        } catch (error) {
            console.error('Error getting selected equipment:', error);
            return [];
        }
    }

    /**
     * Get available choices for a specific choice ID
     * @param {string} classId - ID of the class
     * @param {string} choiceId - ID of the choice
     * @returns {Promise<Array>} Array of available items for the choice
     */
    async getAvailableChoices(classId, choiceId) {
        try {
            const startingEquipment = await this.getClassStartingEquipment(classId);
            if (!startingEquipment) return [];

            return startingEquipment.getChoiceItems(choiceId);
        } catch (error) {
            console.error('Error getting available choices:', error);
            return [];
        }
    }

    /**
     * Get the total value of selected equipment
     * @param {string} classId - ID of the class
     * @param {Object} choices - Map of choice IDs to selected item IDs
     * @param {string} [backgroundId] - Optional background ID
     * @returns {Promise<number>} Total value in copper pieces
     */
    async getSelectedEquipmentValue(classId, choices, backgroundId = null) {
        try {
            const items = await this.getSelectedEquipment(classId, choices, backgroundId);
            return items.reduce((total, item) => {
                const value = item.value || { amount: 0, coin: 'cp' };
                const inCopper = this.convertToCopperPieces(value);
                return total + inCopper * (item.quantity || 1);
            }, 0);
        } catch (error) {
            console.error('Error calculating equipment value:', error);
            return 0;
        }
    }

    /**
     * Convert a value to copper pieces
     * @private
     */
    convertToCopperPieces(value) {
        const rates = {
            'cp': 1,
            'sp': 10,
            'ep': 50,
            'gp': 100,
            'pp': 1000
        };
        return value.amount * (rates[value.coin] || 1);
    }

    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
    }
} 