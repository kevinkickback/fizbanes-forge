/**
 * Subclass.js
 * Model class representing a character subclass in the D&D Character Creator
 */

import { Class } from './Class.js';

/**
 * Represents a character subclass with features that extend a parent class
 * @extends Class
 */
export class Subclass extends Class {
    /**
     * Creates a new Subclass instance
     * @param {Object} data - Subclass data
     * @param {Class} parentClass - Parent class that this subclass extends
     */
    constructor(data, parentClass) {
        super(data);

        /**
         * Reference to the parent class
         * @type {Class}
         */
        this.parentClass = parentClass;

        /**
         * ID of the parent class
         * @type {string}
         */
        this.parentId = parentClass?.id;

        /**
         * Level at which this subclass becomes available
         * @type {number}
         */
        this.subclassLevel = data.subclassLevel || 1;

        /**
         * Additional spellcasting abilities provided by the subclass
         * @type {Object|null}
         */
        this.additionalSpellcasting = data.additionalSpellcasting || null;
    }

    //-------------------------------------------------------------------------
    // Overridden methods from parent class
    //-------------------------------------------------------------------------

    /**
     * Gets combined proficiencies from parent class and subclass
     * @returns {Object} Combined proficiencies
     * @override
     */
    getProficiencies() {
        const parentProficiencies = this.parentClass?.getProficiencies() || {};
        return { ...parentProficiencies, ...this.proficiencies };
    }

    /**
     * Gets features for a specific level, combining parent and subclass features
     * @param {number|null} level - Level to get features for, or null for all features
     * @returns {Array} Array of feature objects
     * @override
     */
    getFeatures(level = null) {
        const parentFeatures = this.parentClass?.getFeatures(level) || [];
        const subclassFeatures = super.getFeatures(level);

        if (level === null) {
            return [...parentFeatures, ...subclassFeatures];
        }

        // Only include subclass features if we're at or above the subclass level
        if (level >= this.subclassLevel) {
            return [...parentFeatures, ...subclassFeatures];
        }

        return parentFeatures;
    }

    /**
     * Gets combined spellcasting information from parent class and subclass
     * @returns {Object|null} Combined spellcasting information or null if not a spellcaster
     * @override
     */
    getSpellcasting() {
        const parentSpellcasting = this.parentClass?.getSpellcasting() || null;
        if (!parentSpellcasting) return this.additionalSpellcasting;

        if (!this.additionalSpellcasting) return parentSpellcasting;

        // Merge spellcasting data
        return {
            ...parentSpellcasting,
            additionalSpells: [
                ...(parentSpellcasting.additionalSpells || []),
                ...(this.additionalSpellcasting.additionalSpells || [])
            ],
            modifySpellList: this.additionalSpellcasting.modifySpellList || false
        };
    }

    /**
     * Gets combined multiclassing requirements from parent class and subclass
     * @returns {Object} Combined multiclassing requirements
     * @override
     */
    getMulticlassingRequirements() {
        const parentRequirements = this.parentClass?.getMulticlassingRequirements() || {};
        return { ...parentRequirements, ...this.multiclassing.requirements };
    }

    /**
     * Gets combined multiclassing proficiencies from parent class and subclass
     * @returns {Object} Combined multiclassing proficiencies
     * @override
     */
    getMulticlassingProficiencies() {
        const parentProficiencies = this.parentClass?.getMulticlassingProficiencies() || {};
        return { ...parentProficiencies, ...this.multiclassing.proficiencies };
    }

    //-------------------------------------------------------------------------
    // Subclass-specific methods
    //-------------------------------------------------------------------------

    /**
     * Gets the level at which this subclass becomes available
     * @returns {number} Subclass level (usually 1-3)
     */
    getSubclassLevel() {
        return this.subclassLevel;
    }

    /**
     * Checks if this subclass provides additional spellcasting
     * @returns {boolean} Whether the subclass has additional spellcasting
     */
    hasAdditionalSpellcasting() {
        return this.additionalSpellcasting !== null;
    }

    /**
     * Gets additional spells provided by the subclass at a specific level
     * @param {number} level - Character level to check
     * @returns {Array} Array of additional spells
     */
    getAdditionalSpells(level) {
        if (!this.additionalSpellcasting) return [];
        return this.additionalSpellcasting.spells?.[level] || [];
    }

    /**
     * Checks if a subclass feature is available at a given level
     * @param {string} featureName - Name of the feature to check
     * @param {number} level - Level to check
     * @returns {boolean} Whether the feature is available
     */
    hasSubclassFeatureAtLevel(featureName, level) {
        if (level < this.subclassLevel) return false;
        return super.hasFeatureAtLevel(featureName, level);
    }

    /**
     * Gets subclass-specific features for a level
     * @param {number|null} level - Level to get features for, or null for all features
     * @returns {Array} Array of subclass feature objects
     */
    getSubclassFeatures(level = null) {
        if (level !== null && level < this.subclassLevel) return [];
        return super.getFeatures(level);
    }

    //-------------------------------------------------------------------------
    // Utility methods
    //-------------------------------------------------------------------------

    /**
     * Returns a string representation of the subclass
     * @returns {string} String representation
     * @override
     */
    toString() {
        return `${this.name} (${this.parentClass?.name || 'Unknown'} subclass)`;
    }

    /**
     * Serializes the subclass to JSON
     * @returns {Object} JSON representation of the subclass
     * @override
     */
    toJSON() {
        return {
            ...super.toJSON(),
            parentId: this.parentId,
            subclassLevel: this.subclassLevel,
            additionalSpellcasting: this.additionalSpellcasting
        };
    }
} 