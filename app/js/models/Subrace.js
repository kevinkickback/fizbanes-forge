import { Race } from './Race.js';

export class Subrace extends Race {
    constructor(data, parentRace) {
        super(data);
        this.parentRace = parentRace;
        this.parentId = parentRace?.id;
    }

    // Override getters to merge with parent race data
    getAbilityScores() {
        const parentScores = this.parentRace?.getAbilityScores() || {};
        return { ...parentScores, ...this.abilityScores };
    }

    getTraits() {
        const parentTraits = this.parentRace?.getTraits() || [];
        return [...parentTraits, ...this.traits];
    }

    getLanguages() {
        const parentLanguages = this.parentRace?.getLanguages() || [];
        return [...parentLanguages, ...this.languages];
    }

    getResistances() {
        const parentResistances = this.parentRace?.getResistances() || [];
        return [...parentResistances, ...this.resistances];
    }

    getFeatures() {
        const parentFeatures = this.parentRace?.getFeatures() || {};
        return { ...parentFeatures, ...this.features };
    }

    getProficiencies() {
        const parentProficiencies = this.parentRace?.getProficiencies() || {};
        const mergedProficiencies = { ...parentProficiencies };

        // Merge each proficiency type
        Object.entries(this.proficiencies).forEach(([type, profs]) => {
            mergedProficiencies[type] = [
                ...(mergedProficiencies[type] || []),
                ...profs
            ];
        });

        return mergedProficiencies;
    }
} 