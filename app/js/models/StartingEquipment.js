/**
 * StartingEquipment.js
 * Model class representing starting equipment options in the D&D Character Creator
 */

/**
 * Represents the starting equipment options for a class or background
 */
export class StartingEquipment {
    /**
     * Creates a new StartingEquipment instance
     * @param {Object} data - Raw starting equipment data
     */
    constructor(data) {
        /**
         * Unique identifier for the starting equipment set
         * @type {string}
         */
        this.id = data.id;

        /**
         * Source book for the equipment
         * @type {string}
         */
        this.source = data.source || 'PHB';

        /**
         * Default items that are always provided
         * @type {Array}
         */
        this.defaultItems = data.default || [];

        /**
         * Equipment choices that can be made
         * @type {Array}
         */
        this.choices = this.processChoices(data.choices || []);
    }

    //-------------------------------------------------------------------------
    // Data processing methods
    //-------------------------------------------------------------------------

    /**
     * Process equipment choices into a standardized format
     * @param {Array} choices - Raw equipment choices data
     * @returns {Array} Processed equipment choices
     * @private
     */
    processChoices(choices) {
        return choices.map((choice, index) => ({
            id: choice.id || `choice-${index}`,
            count: choice.count || 1,
            items: choice.items.map(item => ({
                id: item.id || item,
                name: item.name || item,
                quantity: item.quantity || 1
            })),
            type: choice.type || 'single', // single, multiple, or all
            description: choice.description || ''
        }));
    }

    //-------------------------------------------------------------------------
    // Validation methods
    //-------------------------------------------------------------------------

    /**
     * Validate a set of equipment choices
     * @param {Object} selections - Map of choice IDs to selected item IDs
     * @returns {boolean} Whether the selections are valid
     */
    validateChoices(selections) {
        for (const choice of this.choices) {
            const selection = selections[choice.id];

            // Check if required choice is missing
            if (!selection) return false;

            // For single choices, verify the selection is in the available items
            if (choice.type === 'single') {
                if (!choice.items.some(item => item.id === selection)) {
                    return false;
                }
            }
            // For multiple choices, verify each selection is valid
            else if (choice.type === 'multiple') {
                const selections = Array.isArray(selection) ? selection : [selection];
                if (selections.length !== choice.count) return false;
                if (!selections.every(sel => choice.items.some(item => item.id === sel))) {
                    return false;
                }
            }
        }
        return true;
    }

    //-------------------------------------------------------------------------
    // Item retrieval methods
    //-------------------------------------------------------------------------

    /**
     * Get all items that would be granted by a set of choices
     * @param {Object} selections - Map of choice IDs to selected item IDs
     * @returns {Array} Array of items with quantities
     */
    getSelectedItems(selections) {
        const items = [...this.defaultItems];

        for (const choice of this.choices) {
            const selection = selections[choice.id];
            if (!selection) continue;

            if (choice.type === 'single') {
                const item = choice.items.find(i => i.id === selection);
                if (item) items.push(item);
            }
            else if (choice.type === 'multiple') {
                const selections = Array.isArray(selection) ? selection : [selection];
                for (const sel of selections) {
                    const item = choice.items.find(i => i.id === sel);
                    if (item) items.push(item);
                }
            }
        }

        return items;
    }

    //-------------------------------------------------------------------------
    // Choice retrieval methods
    //-------------------------------------------------------------------------

    /**
     * Get a specific choice by ID
     * @param {string} choiceId - ID of the choice to get
     * @returns {Object|null} The choice object or null if not found
     */
    getChoice(choiceId) {
        return this.choices.find(c => c.id === choiceId) || null;
    }

    /**
     * Get all available items for a specific choice
     * @param {string} choiceId - ID of the choice
     * @returns {Array} Array of available items for the choice
     */
    getChoiceItems(choiceId) {
        const choice = this.getChoice(choiceId);
        return choice ? choice.items : [];
    }

    //-------------------------------------------------------------------------
    // Utility methods
    //-------------------------------------------------------------------------

    /**
     * Returns a string representation of the starting equipment
     * @returns {string} String representation
     */
    toString() {
        return `Starting Equipment (${this.choices.length} choices)`;
    }

    /**
     * Converts the starting equipment to a JSON object
     * @returns {Object} JSON representation of the starting equipment
     */
    toJSON() {
        return {
            id: this.id,
            source: this.source,
            defaultItems: this.defaultItems,
            choices: this.choices
        };
    }
} 