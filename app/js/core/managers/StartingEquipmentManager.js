/**
 * StartingEquipmentManager.js
 * Manager class for handling starting equipment
 */

import { StartingEquipment } from '../models/StartingEquipment.js';
import { InventoryManager } from './InventoryManager.js';
import { PackManager } from './PackManager.js';

export class StartingEquipmentManager {
    constructor(character) {
        this.character = character;
        this.inventoryManager = character.inventoryManager || new InventoryManager(character);
        this.packManager = character.packManager || new PackManager(character);
    }

    /**
     * Apply starting equipment for a class and background
     * @param {string} classId - ID of the class
     * @param {Object} choices - Map of choice IDs to selected item IDs
     * @param {string} [backgroundId] - Optional background ID
     * @returns {Promise<boolean>} True if equipment was applied successfully
     */
    async applyStartingEquipment(classId, choices, backgroundId = null) {
        try {
            // Get class data
            const classes = await window.dndDataLoader.loadClasses();
            const classData = classes.find(c => c.id === classId);
            if (!classData?.startingEquipment) return false;

            // Create StartingEquipment instance
            const startingEquipment = new StartingEquipment(classData.startingEquipment);

            // Validate choices
            if (!startingEquipment.validateChoices(choices)) {
                console.error('Invalid equipment choices');
                return false;
            }

            // Get all items to add
            const items = startingEquipment.getSelectedItems(choices);

            // Add each item
            for (const item of items) {
                if (item.type === 'pack') {
                    await this.packManager.addPack(item.id);
                } else {
                    await this.inventoryManager.addItem(item, item.quantity);
                }
            }

            // Add background equipment if provided
            if (backgroundId) {
                await this.applyBackgroundEquipment(backgroundId);
            }

            return true;
        } catch (error) {
            console.error('Error applying starting equipment:', error);
            return false;
        }
    }

    /**
     * Apply background equipment
     * @param {string} backgroundId - ID of the background
     * @returns {Promise<boolean>} True if equipment was applied successfully
     */
    async applyBackgroundEquipment(backgroundId) {
        try {
            const backgrounds = await window.dndDataLoader.loadBackgrounds();
            const background = backgrounds.find(b => b.id === backgroundId);
            if (!background?.startingEquipment) return false;

            // Add each item from background
            for (const item of background.startingEquipment) {
                if (item.type === 'pack') {
                    await this.packManager.addPack(item.id);
                } else {
                    await this.inventoryManager.addItem(item, item.quantity);
                }
            }

            return true;
        } catch (error) {
            console.error('Error applying background equipment:', error);
            return false;
        }
    }

    /**
     * Get available equipment choices for a class
     * @param {string} classId - ID of the class
     * @returns {Promise<Object|null>} StartingEquipment object or null if not found
     */
    async getEquipmentChoices(classId) {
        try {
            const classes = await window.dndDataLoader.loadClasses();
            const classData = classes.find(c => c.id === classId);
            if (!classData?.startingEquipment) return null;

            return new StartingEquipment(classData.startingEquipment);
        } catch (error) {
            console.error('Error getting equipment choices:', error);
            return null;
        }
    }

    /**
     * Get background equipment
     * @param {string} backgroundId - ID of the background
     * @returns {Promise<Array>} Array of background equipment items
     */
    async getBackgroundEquipment(backgroundId) {
        try {
            const backgrounds = await window.dndDataLoader.loadBackgrounds();
            const background = backgrounds.find(b => b.id === backgroundId);
            return background?.startingEquipment || [];
        } catch (error) {
            console.error('Error getting background equipment:', error);
            return [];
        }
    }

    /**
     * Clear all starting equipment
     * @returns {Promise<boolean>} True if equipment was cleared successfully
     */
    async clearStartingEquipment() {
        try {
            // Get all items that were added as starting equipment
            const startingItems = this.inventoryManager.getAllItems()
                .filter(item => item.source === 'starting');

            // Remove each item
            for (const item of startingItems) {
                await this.inventoryManager.removeItem(item.id);
            }

            return true;
        } catch (error) {
            console.error('Error clearing starting equipment:', error);
            return false;
        }
    }
} 