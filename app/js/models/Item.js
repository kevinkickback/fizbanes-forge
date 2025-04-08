/**
 * Item.js
 * Model class representing an item or equipment in the D&D Character Creator
 */

import { TextProcessor } from '../utils/TextProcessor.js';

/**
 * Represents an item, weapon, armor, or other equipment
 */
export class Item {
    /**
     * Creates a new Item instance
     * @param {Object} data - Raw item data
     */
    constructor(data) {
        /**
         * Unique identifier for the item
         * @type {string}
         */
        this.id = `${data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(data.source || 'phb').toLowerCase()}` || '';

        /**
         * Name of the item
         * @type {string}
         */
        this.name = data.name || '';

        /**
         * Source book for the item
         * @type {string}
         */
        this.source = data.source || 'PHB';

        /**
         * Page number in the source book
         * @type {number}
         */
        this.page = data.page || 0;

        /**
         * Type of item (weapon, armor, etc.)
         * @type {string}
         */
        this.type = this.constructor.getItemType(data);

        /**
         * Rarity of the item
         * @type {string}
         */
        this.rarity = data.rarity || 'common';

        /**
         * Value in copper pieces
         * @type {number}
         */
        this.value = this.constructor.processValue(data.value);

        /**
         * Weight in pounds
         * @type {number}
         */
        this.weight = data.weight || 0;

        /**
         * Item description
         * @type {string}
         */
        this.description = '';

        /**
         * Special properties of the item
         * @type {Array}
         */
        this.properties = this.constructor.processProperties(data.property);

        /**
         * Attunement requirements
         * @type {boolean|string}
         */
        this.attunement = this.constructor.processAttunement(data.reqAttune);

        /**
         * Quantity of the item
         * @type {number}
         */
        this.quantity = data.quantity || 1;

        /**
         * Whether the item is currently equipped
         * @type {boolean}
         */
        this.equipped = false;

        /**
         * Whether the item is currently attuned
         * @type {boolean}
         */
        this.attuned = false;

        // Process the entries asynchronously if they exist
        if (data.entries) {
            this.processDescription(data.entries);
        } else if (data.description) {
            this.description = data.description;
        }
    }

    //-------------------------------------------------------------------------
    // Data processing methods
    //-------------------------------------------------------------------------

    /**
     * Process entries into a description string
     * @param {Array} entries - The entries array from the data
     * @returns {Promise<void>}
     */
    async processDescription(entries) {
        if (!entries) return;

        try {
            const textProcessor = new TextProcessor();
            this.description = await textProcessor.processEntries(entries);
        } catch (error) {
            console.error('Error processing item description:', error);
            this.description = Array.isArray(entries)
                ? entries.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('\n')
                : JSON.stringify(entries);
        }
    }

    /**
     * Determines the item type from its data
     * @param {Object} data - Raw item data
     * @returns {string} Item type
     * @static
     */
    static getItemType(data) {
        if (data.weapon || data.weaponCategory) return 'weapon';
        if (data.armor) return 'armor';
        if (data.containerCapacity) return 'container';
        if (data.ammoType) return 'ammunition';
        if (data.type === 'P') return 'potion';
        if (data.type === 'SC') return 'scroll';
        if (data.type === 'WD') return 'wand';
        if (data.type === 'RD') return 'rod';
        if (data.type === 'RG') return 'ring';
        if (data.type === 'G') return 'gear';
        return 'item';
    }

    /**
     * Processes the value string into a standardized copper piece value
     * @param {string|number} value - Raw value string
     * @returns {number} Value in copper pieces
     * @static
     */
    static processValue(value) {
        if (!value) return 0;
        const match = String(value).match(/(\d+)\s*([cgsp]p)/i);
        if (!match) return 0;

        const amount = Number.parseInt(match[1]);
        const currency = match[2].toLowerCase();

        // Convert to copper pieces for standardization
        switch (currency) {
            case 'cp': return amount;
            case 'sp': return amount * 10;
            case 'gp': return amount * 100;
            case 'pp': return amount * 1000;
            default: return 0;
        }
    }

    /**
     * Processes item properties into an array
     * @param {string|Array} properties - Raw properties data
     * @returns {Array} Standardized properties array
     * @static
     */
    static processProperties(properties) {
        if (!properties) return [];
        return Array.isArray(properties) ? properties : [properties];
    }

    /**
     * Processes attunement requirements
     * @param {boolean|string} reqAttune - Raw attunement requirement
     * @returns {boolean|string} Standardized attunement value
     * @static
     */
    static processAttunement(reqAttune) {
        if (!reqAttune) return false;
        if (reqAttune === true) return true;
        if (typeof reqAttune === 'string') return reqAttune;
        return false;
    }

    //-------------------------------------------------------------------------
    // Equipment state methods
    //-------------------------------------------------------------------------

    /**
     * Equips the item if possible
     * @returns {boolean} Whether the equip was successful
     */
    equip() {
        if (this.canBeEquipped()) {
            this.equipped = true;
            return true;
        }
        return false;
    }

    /**
     * Unequips the item
     * @returns {boolean} Whether the unequip was successful
     */
    unequip() {
        this.equipped = false;
        return true;
    }

    /**
     * Attunes to the item if possible
     * @returns {boolean} Whether the attunement was successful
     */
    attune() {
        if (this.canBeAttuned() && !this.attuned) {
            this.attuned = true;
            return true;
        }
        return false;
    }

    /**
     * Removes attunement from the item
     * @returns {boolean} Whether the unattunement was successful
     */
    unattune() {
        if (this.attuned) {
            this.attuned = false;
            return true;
        }
        return false;
    }

    //-------------------------------------------------------------------------
    // Query methods
    //-------------------------------------------------------------------------

    /**
     * Checks if the item can be equipped
     * @returns {boolean} Whether the item can be equipped
     */
    canBeEquipped() {
        return ['weapon', 'armor', 'shield', 'ammunition'].includes(this.type);
    }

    /**
     * Checks if the item can be attuned
     * @returns {boolean} Whether the item can be attuned
     */
    canBeAttuned() {
        return this.attunement !== false;
    }

    //-------------------------------------------------------------------------
    // Inventory management methods
    //-------------------------------------------------------------------------

    /**
     * Adds or removes quantity of the item
     * @param {number} amount - Amount to add (or negative to remove)
     * @returns {number} New quantity
     */
    addQuantity(amount) {
        this.quantity = Math.max(0, this.quantity + amount);
        return this.quantity;
    }

    //-------------------------------------------------------------------------
    // Value formatting methods
    //-------------------------------------------------------------------------

    /**
     * Gets the item's value in gold pieces
     * @returns {number} Value in gold pieces
     */
    getValueInGold() {
        return this.value / 100;
    }

    /**
     * Gets a formatted string representation of the item's value
     * @returns {string} Formatted value string
     */
    getFormattedValue() {
        if (this.value === 0) return '0 cp';
        if (this.value >= 1000) return `${this.value / 1000} pp`;
        if (this.value >= 100) return `${this.value / 100} gp`;
        if (this.value >= 10) return `${this.value / 10} sp`;
        return `${this.value} cp`;
    }

    //-------------------------------------------------------------------------
    // Utility methods
    //-------------------------------------------------------------------------

    /**
     * Converts the item to a JSON object
     * @returns {Object} JSON representation of the item
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            source: this.source,
            page: this.page,
            type: this.type,
            rarity: this.rarity,
            value: this.value,
            weight: this.weight,
            description: this.description,
            properties: this.properties,
            attunement: this.attunement,
            quantity: this.quantity,
            equipped: this.equipped,
            attuned: this.attuned
        };
    }

    /**
     * Returns a string representation of the item
     * @returns {string} String representation
     */
    toString() {
        return `${this.name} (${this.rarity} ${this.type})`;
    }
} 