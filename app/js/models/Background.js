/**
 * Background.js
 * Model class for character backgrounds
 */

export class Background {
    /**
     * Creates a new Background instance
     * @param {Object} data - Background data
     */
    constructor(data = {}) {
        this.id = data.id || `${data.name}_${data.source || 'PHB'}`;
        this.name = data.name || '';
        this.source = data.source || 'PHB';
        this.description = data.description || '';

        // Ensure proficiencies has the correct structure
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

        // Ensure languages has the correct structure
        this.languages = {
            fixed: (data.languages?.fixed || []).slice(),
            choices: data.languages?.choices || { count: 0, from: [] }
        };

        this.equipment = Array.isArray(data.equipment) ? data.equipment.slice() : [];
        this.feature = data.feature || { name: '', description: '' };
        this.characteristics = data.characteristics || {
            personalityTraits: [],
            ideals: [],
            bonds: [],
            flaws: []
        };
        this.variants = data.variants || [];
        this.imageUrl = data.imageUrl || '';

    }

    /**
     * Creates a new Background instance from processed background data
     * @param {Object} backgroundData - Processed background data from BackgroundManager
     * @returns {Background} A new Background instance
     */
    static fromProcessedData(backgroundData) {
        return new Background(backgroundData);
    }

    /**
     * Returns whether this background has any proficiency choices
     * @returns {boolean} True if the background has skill or tool choices
     */
    hasProficiencyChoice() {
        const skillChoices = this.proficiencies?.skills?.choices?.count || 0;
        const toolChoices = this.proficiencies?.tools?.choices?.count || 0;
        return skillChoices > 0 || toolChoices > 0;
    }

    /**
     * Returns whether this background has any language choices
     * @returns {boolean} True if the background has language choices
     */
    hasLanguageChoice() {
        return (this.languages?.choices?.count || 0) > 0;
    }

    /**
     * Gets the fixed proficiencies for this background
     * @returns {Object} Object containing skill and tool fixed proficiencies
     */
    getFixedProficiencies() {
        console.log(`Getting fixed proficiencies for ${this.name}:`, this.proficiencies);

        const result = {
            skills: this.proficiencies?.skills?.fixed || [],
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

    /**
     * Gets available variants for this background
     * @returns {Array} Array of variant objects
     */
    getVariants() {
        return this.variants || [];
    }

    /**
     * Gets the feature for this background
     * @returns {Object} The background feature
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
        // For debugging
        return this.description || '';
    }

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
            variants: this.variants
        };
    }
} 