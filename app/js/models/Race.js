export class Race {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.source = data.source;
        this.size = data.size;
        this.speed = data.speed;
        this.abilityScores = data.abilityScores || {};
        this.traits = data.traits || [];
        this.languages = data.languages || [];
        this.resistances = data.resistances || [];
        this.features = data.features || {};
        this.subraces = data.subraces || [];
        this.proficiencies = data.proficiencies || {};
    }

    // Getters for race properties
    getAbilityScores() {
        return this.abilityScores;
    }

    getTraits() {
        return this.traits;
    }

    getLanguages() {
        return this.languages;
    }

    getResistances() {
        return this.resistances;
    }

    getFeatures() {
        return this.features;
    }

    getSubraces() {
        return this.subraces;
    }

    getProficiencies() {
        return this.proficiencies;
    }
} 