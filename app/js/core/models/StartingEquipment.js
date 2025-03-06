/**
 * StartingEquipment.js
 * Model class for starting equipment choices
 */

export class StartingEquipment {
    constructor(data) {
        this.id = data.id;
        this.source = data.source || 'PHB';
        this.defaultItems = data.default || [];
        this.choices = this.processChoices(data.choices || []);
    }

    /**
     * Process equipment choices into a standardized format
     * @param {Array} choices - Raw equipment choices data
     * @returns {Array} Processed equipment choices
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

    /**
     * Validate a set of equipment choices
     * @param {Object} selections - Map of choice IDs to selected item IDs
     * @returns {boolean} True if the selections are valid
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

    toJSON() {
        return {
            id: this.id,
            source: this.source,
            defaultItems: this.defaultItems,
            choices: this.choices
        };
    }
} 