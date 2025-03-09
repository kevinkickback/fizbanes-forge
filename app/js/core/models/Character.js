export class Character {
    constructor() {
        this.id = null;
        this.name = '';
        this.playerName = '';
        this.race = null; // Will be initialized as RaceManager instance

        this.class = '';
        this.subclass = '';
        this.background = '';
        this.level = 1;
        this.abilityScores = {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10
        };
        this.abilityBonuses = {
            strength: [],
            dexterity: [],
            constitution: [],
            intelligence: [],
            wisdom: [],
            charisma: []
        };
        this.size = 'M';
        this.speed = { walk: 30 };
        this.features = {
            darkvision: 0,
            resistances: new Set(),
            traits: new Map()  // Map of trait name to { description, source }
        };
        this.proficiencies = {
            armor: new Set(),
            weapons: new Set(),
            tools: new Set(),
            skills: new Set(),
            languages: new Set(['Common']) // Default language
        };
        this.proficiencySources = {
            armor: new Map(),
            weapons: new Map(),
            tools: new Map(),
            skills: new Map(),
            languages: new Map([['Common', new Set(['Default'])]])
        };
        this.height = '';
        this.weight = '';
        this.gender = '';
        this.backstory = '';
        this.equipment = {
            weapons: [],
            armor: [],
            items: []
        };
    }

    // Methods for ability scores
    getAbilityScore(ability) {
        const base = this.abilityScores[ability] || 10;
        const bonuses = this.abilityBonuses[ability] || [];
        return base + bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
    }

    addAbilityBonus(ability, value, source) {
        if (!this.abilityBonuses[ability]) {
            this.abilityBonuses[ability] = [];
        }
        this.abilityBonuses[ability].push({ value, source });
    }

    clearAbilityBonuses(source) {
        for (const ability in this.abilityBonuses) {
            this.abilityBonuses[ability] = this.abilityBonuses[ability].filter(
                bonus => bonus.source !== source
            );
        }
    }

    // Methods for proficiencies
    addProficiency(type, proficiency, source) {
        if (!this.proficiencies[type]) return;
        this.proficiencies[type].add(proficiency);
        if (!this.proficiencySources[type].has(proficiency)) {
            this.proficiencySources[type].set(proficiency, new Set());
        }
        this.proficiencySources[type].get(proficiency).add(source);
    }

    clearProficiencies(source) {
        for (const type in this.proficiencySources) {
            for (const [prof, sources] of this.proficiencySources[type]) {
                sources.delete(source);
                if (sources.size === 0) {
                    this.proficiencies[type].delete(prof);
                    this.proficiencySources[type].delete(prof);
                }
            }
        }
    }

    // Methods for removing proficiencies by source
    removeProficienciesBySource(source) {
        this.clearProficiencies(source);
    }

    // Methods for languages
    addLanguage(language, source) {
        this.addProficiency('languages', language, source);
    }

    clearLanguages(source) {
        this.clearProficiencies(source);
    }

    // Methods for languages
    removeLanguagesBySource(source) {
        this.clearProficiencies(source);
    }

    // Methods for resistances
    addResistance(resistance, source) {
        this.features.resistances.add(resistance);
    }

    clearResistances(source) {
        // For now, just clear all resistances when source is removed
        // TODO: Add source tracking for resistances
        this.features.resistances.clear();
    }

    // Methods for traits
    addTrait(name, description, source) {
        this.features.traits.set(name, { description, source });
    }

    clearTraits(source) {
        for (const [name, trait] of this.features.traits) {
            if (trait.source === source) {
                this.features.traits.delete(name);
            }
        }
    }

    // Static method to create a Character instance from JSON data
    static fromJSON(data) {
        const character = new Character();

        // Copy basic properties
        Object.assign(character, data);

        // Helper functions for safe conversion
        const toSet = (data) => new Set(Array.isArray(data) ? data : []);
        const toMap = (data, valueTransform = (v) => v) => {
            if (typeof data !== 'object' || data === null) return new Map();
            return new Map(
                Object.entries(data).map(([k, v]) => [k, valueTransform(v)])
            );
        };

        // Reconstruct complex objects
        character.features = {
            darkvision: data.features?.darkvision || 0,
            resistances: toSet(data.features?.resistances),
            traits: toMap(data.features?.traits)
        };

        character.proficiencies = {
            armor: toSet(data.proficiencies?.armor),
            weapons: toSet(data.proficiencies?.weapons),
            tools: toSet(data.proficiencies?.tools),
            skills: toSet(data.proficiencies?.skills),
            languages: toSet(data.proficiencies?.languages || ['Common'])
        };

        // Reconstruct proficiency sources with nested Sets
        character.proficiencySources = {
            armor: toMap(data.proficiencySources?.armor, sources => toSet(sources)),
            weapons: toMap(data.proficiencySources?.weapons, sources => toSet(sources)),
            tools: toMap(data.proficiencySources?.tools, sources => toSet(sources)),
            skills: toMap(data.proficiencySources?.skills, sources => toSet(sources)),
            languages: toMap(data.proficiencySources?.languages, sources => toSet(sources))
        };

        return character;
    }
} 