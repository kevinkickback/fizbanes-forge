/**
 * Race.js
 * Pure data model for representing a D&D race
 */
export class Race {
    constructor(data) {
        // Core properties
        this.name = data.name || '';
        this.source = data.source || 'PHB';
        this.page = data.page;

        // Basic attributes
        this.size = data.size || { value: 'Medium', choices: ['Medium'] };
        this.speed = data.speed || { walk: 30 };
        this.ability = data.ability || [];
        this.age = data.age;
        this.alignment = data.alignment;

        // Proficiencies and features
        this.languageProficiencies = data.languageProficiencies || [];
        this.entries = data.entries || [];

        // Relationships
        this.subraces = [];
    }

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
        return this.size;
    }
}
