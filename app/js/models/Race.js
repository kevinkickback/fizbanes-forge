/**
 * Race.js
 * Model class representing a playable race in the D&D Character Creator
 */

/**
 * Represents a playable race with its attributes, traits, and subraces
 */
export class Race {
    /**
     * Creates a new Race instance
     * @param {Object} data - Raw race data
     */
    constructor(data) {
        /**
         * Name of the race
         * @type {string}
         */
        this.name = data.name || '';

        /**
         * Source book for the race
         * @type {string}
         */
        this.source = data.source || 'PHB';

        /**
         * Page number in the source book
         * @type {number}
         */
        this.page = data.page;

        /**
         * Size information
         * @type {Object}
         */
        this.size = data.size || { value: 'Medium', choices: ['Medium'] };

        /**
         * Movement speeds
         * @type {Object}
         */
        this.speed = data.speed || { walk: 30 };

        /**
         * Ability score improvements
         * @type {Array}
         */
        this.ability = data.ability || [];

        /**
         * Age description
         * @type {string}
         */
        this.age = data.age;

        /**
         * Alignment tendencies
         * @type {string}
         */
        this.alignment = data.alignment;

        /**
         * Language proficiencies
         * @type {Array}
         */
        this.languageProficiencies = data.languageProficiencies || [];

        /**
         * Race description and traits
         * @type {Array}
         */
        this.entries = data.entries || [];

        /**
         * Subraces belonging to this race
         * @type {Array}
         */
        this.subraces = [];
    }

    //-------------------------------------------------------------------------
    // Subrace management
    //-------------------------------------------------------------------------

    /**
     * Add a subrace to this race
     * @param {Object} subraceData - Subrace data
     */
    addSubrace(subraceData) {
        this.subraces.push(subraceData);
    }

    /**
     * Get all subraces for this race
     * @returns {Array<Object>} Array of subrace objects
     */
    getSubraces() {
        return this.subraces;
    }

    /**
     * Get a specific subrace by name
     * @param {string} name - Name of the subrace to find
     * @returns {Object|null} The subrace object or null if not found
     */
    getSubrace(name) {
        return this.subraces.find(subrace => subrace.name === name) || null;
    }

    //-------------------------------------------------------------------------
    // Race descriptions and traits
    //-------------------------------------------------------------------------

    /**
     * Get the first description entry
     * @returns {string} The first description entry or empty string
     */
    getDescription() {
        return this.entries.find(entry => typeof entry === 'string') || '';
    }

    /**
     * Get all traits
     * @returns {Array} Array of trait objects
     */
    getTraits() {
        return this.entries.filter(entry => typeof entry === 'object');
    }

    //-------------------------------------------------------------------------
    // Race attributes
    //-------------------------------------------------------------------------

    /**
     * Get ability score improvements
     * @returns {Array} Array of ability score improvements
     */
    getAbilityImprovements() {
        return this.ability;
    }

    /**
     * Get movement speeds
     * @returns {Object} Object containing movement speeds
     */
    getSpeeds() {
        return this.speed;
    }

    /**
     * Get language proficiencies
     * @returns {Array} Array of language proficiencies
     */
    getLanguageProficiencies() {
        return this.languageProficiencies;
    }

    /**
     * Get size information
     * @returns {Object} Object containing size information
     */
    getSize() {
        // Ensure size is an object with a value property
        if (!this.size) {
            return { value: 'Medium', choices: ['Medium'] };
        }

        // Handle array format (common in the data)
        if (Array.isArray(this.size)) {
            const sizeCode = this.size[0] || 'M';
            const sizeValue = this._getSizeFromCode(sizeCode);
            return { value: sizeValue, choices: [sizeValue] };
        }

        // Handle string format
        if (typeof this.size === 'string') {
            return { value: this.size, choices: [this.size] };
        }

        // Handle missing value in object
        if (typeof this.size === 'object' && !this.size.value) {
            return { value: 'Medium', choices: ['Medium'] };
        }

        return this.size;
    }

    /**
     * Convert size code to full size name
     * @param {string} code - Size code (e.g., "M" for Medium)
     * @returns {string} Full size name
     * @private
     */
    _getSizeFromCode(code) {
        const sizeMap = {
            'T': 'Tiny',
            'S': 'Small',
            'M': 'Medium',
            'L': 'Large',
            'H': 'Huge',
            'G': 'Gargantuan'
        };

        return sizeMap[code] || 'Medium';
    }

    //-------------------------------------------------------------------------
    // Utility methods
    //-------------------------------------------------------------------------

    /**
     * Returns a string representation of the race
     * @returns {string} String representation
     */
    toString() {
        return `${this.name} (${this.source})`;
    }

    /**
     * Converts the race to a JSON object
     * @returns {Object} JSON representation of the race
     */
    toJSON() {
        return {
            name: this.name,
            source: this.source,
            page: this.page,
            size: this.size,
            speed: this.speed,
            ability: this.ability,
            age: this.age,
            alignment: this.alignment,
            languageProficiencies: this.languageProficiencies,
            entries: this.entries,
            subraces: this.subraces
        };
    }
}
