export class Race {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.source = data.source;
        this.size = data.size;
        this.speed = data.speed;
        this.ability = data.ability || [];
        this.languages = data.languages || [];
        this.resistances = data.resistances || [];
        this.features = data.features || {};
        this.proficiencies = data.proficiencies || {};
        this.spells = data.spells || [];
        this.entries = data.entries || [];
        this.subraces = data.subraces || [];
        this.fluff = data.fluff;
        this.imageUrl = data.imageUrl;
    }

    // Getters for race properties
    getAbilityScores() {
        return this.ability;
    }

    getEntries() {
        return this.entries;
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

    getSpells() {
        return this.spells;
    }

    getFluff() {
        return this.fluff;
    }

    getImageUrl() {
        return this.imageUrl;
    }
} 