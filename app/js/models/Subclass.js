import { Class } from './Class.js';

export class Subclass extends Class {
    constructor(data, parentClass) {
        super(data);
        this.parentClass = parentClass;
        this.parentId = parentClass?.id;
        this.subclassLevel = data.subclassLevel || 1;
        this.additionalSpellcasting = data.additionalSpellcasting || null;
    }

    // Override getters to merge with parent class data
    getProficiencies() {
        const parentProficiencies = this.parentClass?.getProficiencies() || {};
        return { ...parentProficiencies, ...this.proficiencies };
    }

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

    // Override multiclassing methods to include parent requirements
    getMulticlassingRequirements() {
        const parentRequirements = this.parentClass?.getMulticlassingRequirements() || {};
        return { ...parentRequirements, ...this.multiclassing.requirements };
    }

    getMulticlassingProficiencies() {
        const parentProficiencies = this.parentClass?.getMulticlassingProficiencies() || {};
        return { ...parentProficiencies, ...this.multiclassing.proficiencies };
    }

    // Subclass-specific methods
    getSubclassLevel() {
        return this.subclassLevel;
    }

    hasAdditionalSpellcasting() {
        return this.additionalSpellcasting !== null;
    }

    getAdditionalSpells(level) {
        if (!this.additionalSpellcasting) return [];
        return this.additionalSpellcasting.spells?.[level] || [];
    }

    // Feature management specific to subclass
    hasSubclassFeatureAtLevel(featureName, level) {
        if (level < this.subclassLevel) return false;
        return super.hasFeatureAtLevel(featureName, level);
    }

    getSubclassFeatures(level = null) {
        if (level !== null && level < this.subclassLevel) return [];
        return super.getFeatures(level);
    }
} 