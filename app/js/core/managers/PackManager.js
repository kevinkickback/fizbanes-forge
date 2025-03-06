/**
 * PackManager.js
 * Manager class for handling equipment packs
 */

import { Pack } from '../models/Pack.js';
import { InventoryManager } from './InventoryManager.js';

export class PackManager {
    constructor(character) {
        this.character = character;
        this.inventoryManager = character.inventoryManager || new InventoryManager(character);
    }

    /**
     * Add a pack to the inventory
     * @param {string} packId - ID of the pack to add
     * @returns {Promise<boolean>} True if the pack was added successfully
     */
    async addPack(packId) {
        try {
            const items = await window.dndDataLoader.loadItems();
            const packData = items.find(i => i.id === packId && i.type === 'pack');
            if (!packData) return false;

            const pack = new Pack(packData);
            return await this.inventoryManager.addItem(pack);
        } catch (error) {
            console.error('Error adding pack:', error);
            return false;
        }
    }

    /**
     * Unpack a pack into its individual items
     * @param {string} packId - ID of the pack to unpack
     * @returns {Promise<boolean>} True if the pack was unpacked successfully
     */
    async unpackPack(packId) {
        try {
            const pack = this.inventoryManager.getItem(packId);
            if (!pack || !(pack instanceof Pack)) return false;

            // Remove one instance of the pack
            await this.inventoryManager.removeItem(packId, 1);

            // Add all contents
            const contents = pack.getContents();
            for (const item of contents) {
                await this.inventoryManager.addItem(item, item.quantity);
            }

            return true;
        } catch (error) {
            console.error('Error unpacking pack:', error);
            return false;
        }
    }

    /**
     * Get all packs in the inventory
     * @returns {Array<Pack>} Array of packs
     */
    getPacks() {
        return this.inventoryManager.getAllItems()
            .filter(item => item instanceof Pack);
    }

    /**
     * Check if a pack exists in the inventory
     * @param {string} packId - ID of the pack to check
     * @returns {boolean} True if the pack exists
     */
    hasPack(packId) {
        return this.inventoryManager.hasItem(packId);
    }

    /**
     * Get the quantity of a pack in the inventory
     * @param {string} packId - ID of the pack to check
     * @returns {number} Quantity of the pack
     */
    getPackQuantity(packId) {
        return this.inventoryManager.getItemQuantity(packId);
    }

    /**
     * Remove a pack from the inventory
     * @param {string} packId - ID of the pack to remove
     * @param {number} quantity - Quantity to remove
     * @returns {boolean} True if the pack was removed successfully
     */
    removePack(packId, quantity = 1) {
        return this.inventoryManager.removeItem(packId, quantity);
    }

    /**
     * Get the total value of all packs in the inventory
     * @returns {number} Total value in copper pieces
     */
    getTotalPackValue() {
        return this.getPacks().reduce((total, pack) => {
            return total + pack.totalValue;
        }, 0);
    }

    /**
     * Get the total weight of all packs in the inventory
     * @returns {number} Total weight in pounds
     */
    getTotalPackWeight() {
        return this.getPacks().reduce((total, pack) => {
            return total + pack.totalWeight;
        }, 0);
    }
} 