/**
 * Spell.js
 * Model class representing a spell in the D&D Character Creator
 */

/**
 * Represents a spell with its attributes and casting requirements
 */
export class Spell {
    /**
     * Creates a new Spell instance
     * @param {Object} data - Raw spell data
     */
    constructor(data) {
        /**
         * Unique identifier for the spell
         * @type {string}
         */
        this.id = data.id;

        /**
         * Name of the spell
         * @type {string}
         */
        this.name = data.name;

        /**
         * Source book for the spell
         * @type {string}
         */
        this.source = data.source;

        /**
         * Spell level (0 for cantrips)
         * @type {number}
         */
        this.level = data.level;

        /**
         * School of magic
         * @type {string}
         */
        this.school = data.school;

        /**
         * Casting time
         * @type {string}
         */
        this.time = data.time;

        /**
         * Spell range
         * @type {string}
         */
        this.range = data.range;

        /**
         * Components required (V, S, M)
         * @type {string}
         */
        this.components = data.components;

        /**
         * Spell duration
         * @type {string}
         */
        this.duration = data.duration;

        /**
         * Full spell description
         * @type {string}
         */
        this.description = data.description;

        /**
         * Classes that can use this spell
         * @type {Array<string>}
         */
        this.classes = data.classes || [];

        /**
         * Whether the spell can be cast as a ritual
         * @type {boolean}
         */
        this.ritual = data.ritual || false;

        /**
         * Whether the spell requires concentration
         * @type {boolean}
         */
        this.concentration = data.concentration || false;

        /**
         * Material components description
         * @type {string|null}
         */
        this.material = data.material || null;

        /**
         * Effects when cast at higher levels
         * @type {string|null}
         */
        this.higherLevels = data.higherLevels || null;
    }

    //-------------------------------------------------------------------------
    // Basic information getters
    //-------------------------------------------------------------------------

    /**
     * Gets the spell name
     * @returns {string} The spell name
     */
    getName() {
        return this.name;
    }

    /**
     * Gets the spell level
     * @returns {number} The spell level (0 for cantrips)
     */
    getLevel() {
        return this.level;
    }

    /**
     * Gets the school of magic
     * @returns {string} The spell's school of magic
     */
    getSchool() {
        return this.school;
    }

    /**
     * Gets the casting time
     * @returns {string} The spell's casting time
     */
    getCastingTime() {
        return this.time;
    }

    /**
     * Gets the spell range
     * @returns {string} The spell's range
     */
    getRange() {
        return this.range;
    }

    /**
     * Gets the spell components
     * @returns {string} The spell's components (V, S, M)
     */
    getComponents() {
        return this.components;
    }

    /**
     * Gets the spell duration
     * @returns {string} The spell's duration
     */
    getDuration() {
        return this.duration;
    }

    /**
     * Checks if the spell can be cast as a ritual
     * @returns {boolean} Whether the spell is a ritual
     */
    isRitual() {
        return this.ritual;
    }

    /**
     * Checks if the spell requires concentration
     * @returns {boolean} Whether the spell requires concentration
     */
    requiresConcentration() {
        return this.concentration;
    }

    /**
     * Gets the material components description
     * @returns {string|null} The material components or null if none
     */
    getMaterialComponents() {
        return this.material;
    }

    /**
     * Gets higher level casting effects
     * @returns {string|null} Description of higher level effects or null if none
     */
    getHigherLevelEffects() {
        return this.higherLevels;
    }

    /**
     * Checks if the spell is available to a specific class
     * @param {string} className - Name of the class to check
     * @returns {boolean} Whether the class can use this spell
     */
    isAvailableToClass(className) {
        return this.classes.includes(className);
    }

    /**
     * Gets all classes that can use this spell
     * @returns {Array<string>} Array of class names
     */
    getAvailableClasses() {
        return this.classes;
    }

    /**
     * Checks if the spell requires a verbal component
     * @returns {boolean} Whether verbal components are required
     */
    requiresVerbalComponent() {
        return this.components.includes('V');
    }

    /**
     * Checks if the spell requires a somatic component
     * @returns {boolean} Whether somatic components are required
     */
    requiresSomaticComponent() {
        return this.components.includes('S');
    }

    /**
     * Checks if the spell requires material components
     * @returns {boolean} Whether material components are required
     */
    requiresMaterialComponent() {
        return this.components.includes('M');
    }

    /**
     * Returns a string representation of the spell
     * @returns {string} String representation
     */
    toString() {
        return `${this.name} (Level ${this.level} ${this.school})`;
    }

    /**
     * Converts the spell to a JSON object
     * @returns {Object} JSON representation of the spell
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            source: this.source,
            level: this.level,
            school: this.school,
            time: this.time,
            range: this.range,
            components: this.components,
            duration: this.duration,
            description: this.description,
            classes: this.classes,
            ritual: this.ritual,
            concentration: this.concentration,
            material: this.material,
            higherLevels: this.higherLevels
        };
    }

    /**
     * Compares this spell with another
     * @param {Spell} other - Another spell to compare with
     * @returns {boolean} Whether the spells are equal
     */
    equals(other) {
        if (!(other instanceof Spell)) return false;
        return this.id === other.id && this.source === other.source;
    }

    /**
     * Checks if the spell is a cantrip
     * @returns {boolean} Whether the spell is a cantrip (level 0)
     */
    isCantrip() {
        return this.level === 0;
    }

    /**
     * Checks if the spell is of a specific level
     * @param {number} level - Level to check
     * @returns {boolean} Whether the spell is of the specified level
     */
    isSpellLevel(level) {
        return this.level === level;
    }
} 