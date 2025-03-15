/**
 * StartingEquipmentManager.js
 * Manager class for handling starting equipment
 */

import { StartingEquipment } from '../models/StartingEquipment.js';
import { InventoryManager } from './InventoryManager.js';
import { PackManager } from './PackManager.js';
import { characterInitializer } from '../utils/Initialize.js';
import { showNotification } from '../utils/notifications.js';

export class StartingEquipmentManager {
    constructor(character) {
        this.character = character;
        this.inventoryManager = character.inventoryManager || new InventoryManager(character);
        this.packManager = character.packManager || new PackManager(character);
        this.cache = {
            classEquipment: new Map(),
            backgroundEquipment: new Map()
        };
        this.dataLoader = characterInitializer.dataLoader;
        this.selectedEquipment = new Map();
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
            const startingEquipment = await this.getEquipmentChoices(classId);
            if (!startingEquipment) return false;

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
            const equipment = await this.getBackgroundEquipment(backgroundId);
            if (!equipment.length) return false;

            // Add each item from background
            for (const item of equipment) {
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
            // Check cache first
            if (this.cache.classEquipment.has(classId)) {
                return this.cache.classEquipment.get(classId);
            }

            const classes = await this.dataLoader.loadClasses();
            const classData = classes.find(c => c.id === classId);
            if (!classData?.startingEquipment) return null;

            const startingEquipment = new StartingEquipment(classData.startingEquipment);
            this.cache.classEquipment.set(classId, startingEquipment);
            return startingEquipment;
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
            // Check cache first
            if (this.cache.backgroundEquipment.has(backgroundId)) {
                return this.cache.backgroundEquipment.get(backgroundId);
            }

            const backgrounds = await this.dataLoader.loadBackgrounds();
            const background = backgrounds.find(b => b.id === backgroundId);
            const equipment = background?.startingEquipment || [];

            this.cache.backgroundEquipment.set(backgroundId, equipment);
            return equipment;
        } catch (error) {
            console.error('Error getting background equipment:', error);
            return [];
        }
    }

    /**
     * Calculate the total value of selected equipment in copper pieces
     * @param {string} classId - ID of the class
     * @param {Object} choices - Map of choice IDs to selected item IDs
     * @param {string} [backgroundId] - Optional background ID
     * @returns {Promise<number>} Total value in copper pieces
     */
    async getSelectedEquipmentValue(classId, choices, backgroundId = null) {
        try {
            let totalValue = 0;

            // Get class equipment value
            const startingEquipment = await this.getEquipmentChoices(classId);
            if (startingEquipment) {
                const items = startingEquipment.getSelectedItems(choices);
                for (const item of items) {
                    if (item.type === 'pack') {
                        const pack = await this.packManager.getPack(item.id);
                        totalValue += pack?.value || 0;
                    } else {
                        totalValue += (item.value || 0) * (item.quantity || 1);
                    }
                }
            }

            // Add background equipment value if provided
            if (backgroundId) {
                const backgroundItems = await this.getBackgroundEquipment(backgroundId);
                for (const item of backgroundItems) {
                    if (item.type === 'pack') {
                        const pack = await this.packManager.getPack(item.id);
                        totalValue += pack?.value || 0;
                    } else {
                        totalValue += (item.value || 0) * (item.quantity || 1);
                    }
                }
            }

            return totalValue;
        } catch (error) {
            console.error('Error calculating equipment value:', error);
            return 0;
        }
    }

    /**
     * Clear all starting equipment and caches
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

            // Clear caches
            this.cache.classEquipment.clear();
            this.cache.backgroundEquipment.clear();

            return true;
        } catch (error) {
            console.error('Error clearing starting equipment:', error);
            return false;
        }
    }

    async loadClassStartingEquipment() {
        try {
            const classes = await this.dataLoader.loadClasses();
            const classData = classes.find(c => c.id === this.character.class?.id);
            return classData?.startingEquipment || [];
        } catch (error) {
            console.error('Error loading class starting equipment:', error);
            return [];
        }
    }

    async loadBackgroundStartingEquipment() {
        try {
            const backgrounds = await this.dataLoader.loadBackgrounds();
            const backgroundData = backgrounds.find(b => b.id === this.character.background?.id);
            return backgroundData?.startingEquipment || [];
        } catch (error) {
            console.error('Error loading background starting equipment:', error);
            return [];
        }
    }

    async loadStartingEquipment() {
        try {
            const items = await this.dataLoader.loadItems();
            return items.filter(item => item.isStartingEquipment);
        } catch (error) {
            console.error('Error loading starting equipment:', error);
            showNotification('Error loading starting equipment', 'error');
            return [];
        }
    }
} 