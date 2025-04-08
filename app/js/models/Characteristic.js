/**
 * Characteristic.js
 * Model class representing a character's personality characteristics in the D&D Character Creator
 */

/**
 * Represents a character's personality trait, ideal, bond, or flaw
 */
export class Characteristic {
    /**
     * Creates a new Characteristic instance
     * @param {Object} data - Raw characteristic data
     */
    constructor(data) {
        /**
         * Type of characteristic (personalityTrait, ideal, bond, flaw)
         * @type {string}
         */
        this.type = data.type;

        /**
         * Text content of the characteristic
         * @type {string}
         */
        this.value = data.value;

        /**
         * Source of the characteristic
         * @type {string}
         */
        this.source = data.source || 'Background';

        /**
         * Original index in the background's characteristic list
         * @type {number}
         */
        this.index = data.index;
    }

    //-------------------------------------------------------------------------
    // Factory methods
    //-------------------------------------------------------------------------

    /**
     * Creates a new Characteristic from a background
     * @param {string} type - Type of characteristic
     * @param {string} value - Text content
     * @param {number} index - Index in the background list
     * @returns {Characteristic} New Characteristic instance
     * @static
     */
    static fromBackground(type, value, index) {
        return new Characteristic({
            type,
            value,
            source: 'Background',
            index
        });
    }

    //-------------------------------------------------------------------------
    // Utility methods
    //-------------------------------------------------------------------------

    /**
     * Converts the characteristic to a JSON object
     * @returns {Object} JSON representation of the characteristic
     */
    toJSON() {
        return {
            type: this.type,
            value: this.value,
            source: this.source,
            index: this.index
        };
    }

    /**
     * Returns a string representation of the characteristic
     * @returns {string} String representation
     */
    toString() {
        const typeDisplay = {
            personalityTrait: 'Personality Trait',
            ideal: 'Ideal',
            bond: 'Bond',
            flaw: 'Flaw'
        };

        return `${typeDisplay[this.type] || this.type}: ${this.value}`;
    }
} 