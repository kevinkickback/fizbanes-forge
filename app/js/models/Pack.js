/**
 * Pack.js
 * Model class for equipment packs
 */

import { Item } from './Item.js';

export class Pack extends Item {
    constructor(data) {
        super(data);
        this.type = 'pack';
        this.contents = data.contents || [];
        this.totalWeight = this.calculateTotalWeight();
        this.totalValue = this.calculateTotalValue();
    }

    calculateTotalWeight() {
        return this.contents.reduce((total, item) => {
            return total + (item.weight || 0) * (item.quantity || 1);
        }, 0);
    }

    calculateTotalValue() {
        return this.contents.reduce((total, item) => {
            const value = item.value || { amount: 0, coin: 'cp' };
            // Convert all values to copper pieces for calculation
            const inCopper = this.convertToCopperPieces(value);
            return total + inCopper * (item.quantity || 1);
        }, 0);
    }

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
     * Get the contents of the pack
     * @returns {Array} Array of pack contents with quantities
     */
    getContents() {
        return this.contents.map(item => ({
            ...item,
            quantity: item.quantity || 1
        }));
    }

    /**
     * Check if an item is part of this pack
     * @param {string} itemId - ID of the item to check
     * @returns {boolean} True if the item is in the pack
     */
    containsItem(itemId) {
        return this.contents.some(item => item.id === itemId);
    }

    /**
     * Get the quantity of a specific item in the pack
     * @param {string} itemId - ID of the item to check
     * @returns {number} Quantity of the item in the pack
     */
    getItemQuantity(itemId) {
        const item = this.contents.find(i => i.id === itemId);
        return item ? (item.quantity || 1) : 0;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            type: 'pack',
            contents: this.contents,
            totalWeight: this.totalWeight,
            totalValue: this.totalValue
        };
    }
} 