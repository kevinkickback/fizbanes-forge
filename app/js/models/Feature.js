/**
 * Feature.js
 * Model class representing a character feature in the D&D Character Creator
 */

/**
 * Represents a class feature or subclass feature with its attributes and requirements
 */
export class Feature {
    /**
     * Creates a new Feature instance
     * @param {Object} data - Raw feature data
     */
    constructor(data) {
        /**
         * Unique identifier for the feature
         * @type {string}
         */
        this.id = data.id;

        /**
         * Name of the feature
         * @type {string}
         */
        this.name = data.name;

        /**
         * Source book for the feature
         * @type {string}
         */
        this.source = data.source;

        /**
         * Class this feature belongs to
         * @type {string}
         */
        this.className = data.className;

        /**
         * Subclass this feature belongs to (if any)
         * @type {string|null}
         */
        this.subclassName = data.subclassName || null;

        /**
         * Character level required for the feature
         * @type {number}
         */
        this.level = data.level;

        /**
         * Feature description
         * @type {string}
         */
        this.description = data.description;

        /**
         * Type of feature (class or subclass)
         * @type {string}
         */
        this.type = data.type || 'class';  // 'class' or 'subclass'

        /**
         * Requirements to obtain the feature
         * @type {Object}
         */
        this.requirements = data.requirements || {};

        /**
         * Options or choices provided by this feature
         * @type {Array}
         */
        this.options = data.options || [];
    }

    /**
     * Gets the feature name
     * @returns {string} The feature name
     */
    getName() {
        return this.name;
    }

    /**
     * Gets the feature description
     * @returns {string} The feature description
     */
    getDescription() {
        return this.description;
    }

    /**
     * Gets the required character level
     * @returns {number} The level requirement
     */
    getLevel() {
        return this.level;
    }

    /**
     * Gets the feature type
     * @returns {string} The feature type (class or subclass)
     */
    getType() {
        return this.type;
    }

    /**
     * Checks if this is a class feature
     * @returns {boolean} Whether this is a class feature
     */
    isClassFeature() {
        return this.type === 'class';
    }

    /**
     * Checks if this is a subclass feature
     * @returns {boolean} Whether this is a subclass feature
     */
    isSubclassFeature() {
        return this.type === 'subclass';
    }

    /**
     * Checks if the feature has any requirements
     * @returns {boolean} Whether the feature has requirements
     */
    hasRequirements() {
        return Object.keys(this.requirements).length > 0;
    }

    /**
     * Gets all requirements for the feature
     * @returns {Object} The requirements object
     */
    getRequirements() {
        return this.requirements;
    }

    /**
     * Checks if a character meets all requirements for this feature
     * @param {Character} character - The character to check
     * @returns {boolean} Whether the character meets all requirements
     */
    meetsRequirements(character) {
        if (!this.hasRequirements()) return true;

        for (const [req, value] of Object.entries(this.requirements)) {
            switch (req) {
                case 'level':
                    if (character.level < value) return false;
                    break;
                case 'ability':
                    for (const [ability, score] of Object.entries(value)) {
                        if (character.getAbilityScore(ability) < score) return false;
                    }
                    break;
                case 'proficiency':
                    for (const prof of value) {
                        if (!character.hasProficiency(prof)) return false;
                    }
                    break;
                case 'feature':
                    if (!character.hasFeature(value)) return false;
                    break;
            }
        }
        return true;
    }

    /**
     * Checks if the feature has any options
     * @returns {boolean} Whether the feature has options
     */
    hasOptions() {
        return this.options.length > 0;
    }

    /**
     * Gets all options for this feature
     * @returns {Array} The options array
     */
    getOptions() {
        return this.options;
    }

    /**
     * Applies the feature to a character
     * @param {Character} character - The character to apply the feature to
     * @returns {Promise<boolean>} Whether the application was successful
     */
    async apply(character) {
        // Base implementation - override in specific feature types
        return true;
    }

    /**
     * Removes the feature from a character
     * @param {Character} character - The character to remove the feature from
     * @returns {Promise<boolean>} Whether the removal was successful
     */
    async remove(character) {
        // Base implementation - override in specific feature types
        return true;
    }

    /**
     * Returns a string representation of the feature
     * @returns {string} String representation
     */
    toString() {
        return `${this.name} (${this.className}${this.subclassName ? ` - ${this.subclassName}` : ''} ${this.level})`;
    }

    /**
     * Converts the feature to a JSON object
     * @returns {Object} JSON representation of the feature
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            source: this.source,
            className: this.className,
            subclassName: this.subclassName,
            level: this.level,
            description: this.description,
            type: this.type,
            requirements: this.requirements,
            options: this.options
        };
    }
} 