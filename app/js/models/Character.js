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
        this.allowedSources = new Set(); // Initialize empty, don't add core books by default
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

    // Methods for source management
    addAllowedSource(source) {
        if (source) {
            this.allowedSources.add(source.toUpperCase());
        }
    }

    removeAllowedSource(source) {
        if (source) {
            this.allowedSources.delete(source.toUpperCase());
        }
    }

    isSourceAllowed(source) {
        return source ? this.allowedSources.has(source.toUpperCase()) : false;
    }

    setAllowedSources(sources) {
        console.log('[Sources] Character sources updated:', Array.from(sources));
        this.allowedSources = new Set(sources);
    }

    getAllowedSources() {
        return new Set(this.allowedSources);
    }

    // Static method to create a Character instance from JSON data
    static fromJSON(data) {
        const character = new Character();

        // Copy basic properties
        character.id = data.id;
        character.name = data.name;
        character.playerName = data.playerName;
        character.level = data.level;
        character.lastModified = data.lastModified;
        character.height = data.height;
        character.weight = data.weight;
        character.gender = data.gender;
        character.backstory = data.backstory;

        // Set allowed sources from data
        if (data.allowedSources) {
            const sourcesArray = Array.isArray(data.allowedSources) ? data.allowedSources : Array.from(data.allowedSources);
            character.allowedSources = new Set(sourcesArray);
            console.log('[Sources] Character loaded with sources:', Array.from(character.allowedSources));
        }

        // Copy ability scores and bonuses
        character.abilityScores = { ...data.abilityScores };
        character.abilityBonuses = { ...data.abilityBonuses };

        // Copy size and speed
        character.size = data.size;
        character.speed = { ...data.speed };

        // Copy features
        character.features = {
            darkvision: data.features?.darkvision || 0,
            resistances: new Set(Array.isArray(data.features?.resistances) ? data.features.resistances : []),
            traits: new Map(Object.entries(data.features?.traits || {}))
        };

        // Copy proficiencies - ensure we're creating Sets from arrays
        character.proficiencies = {
            armor: new Set(Array.isArray(data.proficiencies?.armor) ? data.proficiencies.armor : []),
            weapons: new Set(Array.isArray(data.proficiencies?.weapons) ? data.proficiencies.weapons : []),
            tools: new Set(Array.isArray(data.proficiencies?.tools) ? data.proficiencies.tools : []),
            skills: new Set(Array.isArray(data.proficiencies?.skills) ? data.proficiencies.skills : []),
            languages: new Set(Array.isArray(data.proficiencies?.languages) ? data.proficiencies.languages : ['Common'])
        };

        // Copy proficiency sources - ensure we're creating Maps from entries
        character.proficiencySources = {
            armor: new Map(Object.entries(data.proficiencySources?.armor || {})),
            weapons: new Map(Object.entries(data.proficiencySources?.weapons || {})),
            tools: new Map(Object.entries(data.proficiencySources?.tools || {})),
            skills: new Map(Object.entries(data.proficiencySources?.skills || {})),
            languages: new Map(Object.entries(data.proficiencySources?.languages || {}))
        };

        // Copy equipment
        character.equipment = {
            weapons: Array.isArray(data.equipment?.weapons) ? data.equipment.weapons : [],
            armor: Array.isArray(data.equipment?.armor) ? data.equipment.armor : [],
            items: Array.isArray(data.equipment?.items) ? data.equipment.items : []
        };

        // Store race, class, and background IDs
        character.race = data.race || '';
        character.subrace = data.subrace || '';
        character.class = data.class || '';
        character.subclass = data.subclass || '';
        character.background = data.background || '';

        return character;
    }

    // Add toJSON method to ensure sources are saved
    toJSON() {
        // Create a clean object without circular references
        const cleanObject = {
            id: this.id,
            name: this.name,
            playerName: this.playerName,
            level: this.level,
            // Convert Set to Array while preserving all sources
            allowedSources: Array.from(this.allowedSources),
            abilityScores: { ...this.abilityScores },
            abilityBonuses: { ...this.abilityBonuses },
            size: this.size,
            speed: { ...this.speed },
            features: {
                darkvision: this.features.darkvision,
                resistances: Array.from(this.features.resistances),
                traits: Object.fromEntries(this.features.traits)
            },
            proficiencies: {
                armor: Array.from(this.proficiencies.armor),
                weapons: Array.from(this.proficiencies.weapons),
                tools: Array.from(this.proficiencies.tools),
                skills: Array.from(this.proficiencies.skills),
                languages: Array.from(this.proficiencies.languages)
            },
            proficiencySources: Object.fromEntries(
                Object.entries(this.proficiencySources).map(([type, sources]) => [
                    type,
                    Object.fromEntries(Array.from(sources).map(([key, value]) => [
                        key,
                        Array.from(value)
                    ]))
                ])
            ),
            height: this.height,
            weight: this.weight,
            gender: this.gender,
            backstory: this.backstory,
            equipment: {
                weapons: Array.isArray(this.equipment.weapons) ? [...this.equipment.weapons] : [],
                armor: Array.isArray(this.equipment.armor) ? [...this.equipment.armor] : [],
                items: Array.isArray(this.equipment.items) ? [...this.equipment.items] : []
            },
            // Store manager data safely
            race: this.race?.selectedRace?.id || '',
            subrace: this.race?.selectedSubrace?.id || '',
            class: this.class?.selectedClass?.id || '',
            subclass: this.class?.selectedSubclass?.id || '',
            background: this.background?.selectedBackground?.id || '',
            // Store additional manager data without circular references
            characteristics: this.characteristics ? {
                personalityTrait: this.characteristics.getCharacteristic('personalityTrait'),
                ideal: this.characteristics.getCharacteristic('ideal'),
                bond: this.characteristics.getCharacteristic('bond'),
                flaw: this.characteristics.getCharacteristic('flaw')
            } : {},
            spells: this.spells ? {
                known: Array.from(this.spells.knownSpells?.keys() || []),
                prepared: Array.from(this.spells.preparedSpells || []),
                slots: { ...this.spells.spellSlots },
                slotsUsed: { ...this.spells.slotsUsed }
            } : {},
            feats: this.feats ? {
                selected: Array.from(this.feats.feats?.keys() || []),
                optional: Array.from(this.feats.optionalFeatures?.keys() || [])
            } : {},
            optionalFeatures: this.optionalFeatures ? {
                selected: Array.from(this.optionalFeatures.features?.keys() || [])
            } : {},
            lastModified: new Date().toISOString()
        };

        return cleanObject;
    }
} 