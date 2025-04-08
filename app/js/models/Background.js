/**
 * Background.js
 * Model class representing a character background in the D&D Character Creator
 */

/**
 * Represents a character background with its proficiencies, languages, and features
 */
export class Background {
    /**
     * Creates a new Background instance
     * @param {Object} data - Background data
     */
    constructor(data = {}) {
        /**
         * Unique identifier for the background
         * @type {string}
         */
        this.id = data.id || `${data.name}_${data.source || 'PHB'}`;

        /**
         * Name of the background
         * @type {string}
         */
        this.name = data.name || '';

        /**
         * Source book for the background
         * @type {string}
         */
        this.source = data.source || 'PHB';

        /**
         * Background description
         * @type {string}
         */
        this.description = data.description || '';

        /**
         * Proficiencies granted by this background
         * @type {Object}
         */
        this.proficiencies = {
            skills: {
                fixed: (data.proficiencies?.skills?.fixed || []).slice(),
                choices: data.proficiencies?.skills?.choices || { count: 0, from: [] }
            },
            tools: {
                fixed: (data.proficiencies?.tools?.fixed || []).slice(),
                choices: data.proficiencies?.tools?.choices || { count: 0, from: [] }
            }
        };

        /**
         * Languages granted by this background
         * @type {Object}
         */
        this.languages = {
            fixed: (data.languages?.fixed || []).slice(),
            choices: data.languages?.choices || { count: 0, from: [] }
        };

        /**
         * Starting equipment provided by this background
         * @type {Array}
         */
        this.equipment = Array.isArray(data.equipment) ? data.equipment.slice() : [];

        /**
         * Special feature granted by this background
         * @type {Object}
         */
        this.feature = data.feature || { name: '', description: '' };

        /**
         * Character characteristics tables (personality, ideals, bonds, flaws)
         * @type {Object}
         */
        this.characteristics = data.characteristics || {
            personalityTraits: [],
            ideals: [],
            bonds: [],
            flaws: []
        };

        /**
         * Alternative variants of this background
         * @type {Array}
         */
        this.variants = data.variants || [];

        /**
         * URL to an image representing this background
         * @type {string}
         */
        this.imageUrl = data.imageUrl || '';
    }

    //-------------------------------------------------------------------------
    // Factory methods
    //-------------------------------------------------------------------------

    /**
     * Creates a new Background instance from processed background data
     * @param {Object} backgroundData - Processed background data from BackgroundManager
     * @returns {Background} A new Background instance
     * @static
     */
    static fromProcessedData(backgroundData) {
        return new Background(backgroundData);
    }

    //-------------------------------------------------------------------------
    // Choice availability
    //-------------------------------------------------------------------------

    /**
     * Checks if this background has any proficiency choices
     * @returns {boolean} Whether the background has skill or tool choices
     */
    hasProficiencyChoice() {
        const skillChoices = this.proficiencies?.skills?.choices?.count || 0;
        const toolChoices = this.proficiencies?.tools?.choices?.count || 0;
        return skillChoices > 0 || toolChoices > 0;
    }

    /**
     * Checks if this background has any language choices
     * @returns {boolean} Whether the background has language choices
     */
    hasLanguageChoice() {
        return (this.languages?.choices?.count || 0) > 0;
    }

    //-------------------------------------------------------------------------
    // Fixed proficiencies and languages
    //-------------------------------------------------------------------------

    /**
     * Gets the fixed proficiencies for this background
     * @returns {Object} Object containing skill and tool fixed proficiencies
     */
    getFixedProficiencies() {
        // Normalize skill names to ensure consistent capitalization
        const normalizedSkills = (this.proficiencies?.skills?.fixed || []).map(skill => {
            // Convert lowercase "sleight of hand" to "Sleight of Hand"
            if (skill.toLowerCase() === 'sleight of hand') {
                return 'Sleight of Hand';
            }

            // Make sure first letter is capitalized
            return skill.charAt(0).toUpperCase() + skill.slice(1);
        });

        const result = {
            skills: normalizedSkills,
            tools: this.proficiencies?.tools?.fixed || []
        };

        return result;
    }

    /**
     * Gets the fixed languages for this background
     * @returns {Array} Array of fixed languages
     */
    getFixedLanguages() {
        return this.languages?.fixed || [];
    }

    //-------------------------------------------------------------------------
    // Features and characteristics
    //-------------------------------------------------------------------------

    /**
     * Gets available variants for this background
     * @returns {Array} Array of variant objects
     */
    getVariants() {
        return this.variants || [];
    }

    /**
     * Gets the feature for this background
     * @returns {Object} The background feature with name and description
     */
    getFeature() {
        return this.feature || { name: '', description: '' };
    }

    /**
     * Gets the characteristics for this background
     * @returns {Object} Object containing personality traits, ideals, bonds, and flaws
     */
    getCharacteristics() {
        return this.characteristics || {
            personalityTraits: [],
            ideals: [],
            bonds: [],
            flaws: []
        };
    }

    /**
     * Gets the description of this background
     * @returns {string} The background description
     */
    getDescription() {
        return this.description || '';
    }

    //-------------------------------------------------------------------------
    // Utility methods
    //-------------------------------------------------------------------------

    /**
     * Serializes the background to JSON
     * @returns {Object} JSON representation of the background
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            source: this.source,
            description: this.description,
            proficiencies: this.proficiencies,
            languages: this.languages,
            equipment: this.equipment,
            feature: this.feature,
            characteristics: this.characteristics,
            variants: this.variants,
            imageUrl: this.imageUrl
        };
    }

    /**
     * Returns a string representation of the background
     * @returns {string} String representation
     */
    toString() {
        return `${this.name} (${this.source})`;
    }
} 