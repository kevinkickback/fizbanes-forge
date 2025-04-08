/**
 * Pack.js
 * Model class representing an equipment pack in the D&D Character Creator
 */

import { Item } from './Item.js';

/**
 * Represents an equipment pack containing multiple items
 * @extends Item
 */
export class Pack extends Item {
    /**
     * Creates a new Pack instance
     * @param {Object} data - Raw pack data
     */
    constructor(data) {
        super(data);

        /**
         * Pack type identifier
         * @type {string}
         */
        this.type = 'pack';

        /**
         * Items contained in the pack
         * @type {Array}
         */
        this.contents = data.contents || [];

        /**
         * Total weight of all items in the pack
         * @type {number}
         */
        this.totalWeight = this.calculateTotalWeight();

        /**
         * Total value of all items in the pack (in copper pieces)
         * @type {number}
         */
        this.totalValue = this.calculateTotalValue();
    }

    //-------------------------------------------------------------------------
    // Calculation methods
    //-------------------------------------------------------------------------

    /**
     * Calculates the total weight of all items in the pack
     * @returns {number} Total weight in pounds
     * @private
     */
    calculateTotalWeight() {
        return this.contents.reduce((total, item) => {
            return total + (item.weight || 0) * (item.quantity || 1);
        }, 0);
    }

    /**
     * Calculates the total value of all items in the pack
     * @returns {number} Total value in copper pieces
     * @private
     */
    calculateTotalValue() {
        return this.contents.reduce((total, item) => {
            const value = item.value || { amount: 0, coin: 'cp' };
            // Convert all values to copper pieces for calculation
            const inCopper = this.convertToCopperPieces(value);
            return total + inCopper * (item.quantity || 1);
        }, 0);
    }

    /**
     * Converts a currency value to copper pieces
     * @param {Object} value - Value object with amount and coin type
     * @returns {number} Value in copper pieces
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

    //-------------------------------------------------------------------------
    // Content access methods
    //-------------------------------------------------------------------------

    /**
     * Gets the contents of the pack
     * @returns {Array} Array of pack contents with quantities
     */
    getContents() {
        return this.contents.map(item => ({
            ...item,
            quantity: item.quantity || 1
        }));
    }

    /**
     * Checks if an item is part of this pack
     * @param {string} itemId - ID of the item to check
     * @returns {boolean} Whether the item is in the pack
     */
    containsItem(itemId) {
        return this.contents.some(item => item.id === itemId);
    }

    /**
     * Gets the quantity of a specific item in the pack
     * @param {string} itemId - ID of the item to check
     * @returns {number} Quantity of the item in the pack
     */
    getItemQuantity(itemId) {
        const item = this.contents.find(i => i.id === itemId);
        return item ? (item.quantity || 1) : 0;
    }

    //-------------------------------------------------------------------------
    // Utility methods
    //-------------------------------------------------------------------------

    /**
     * Converts the pack to a JSON object
     * @returns {Object} JSON representation of the pack
     * @override
     */
    toJSON() {
        return {
            ...super.toJSON(),
            type: 'pack',
            contents: this.contents,
            totalWeight: this.totalWeight,
            totalValue: this.totalValue
        };
    }

    /**
     * Returns a string representation of the pack
     * @returns {string} String representation
     * @override
     */
    toString() {
        return `${this.name} (Pack with ${this.contents.length} items)`;
    }
} 