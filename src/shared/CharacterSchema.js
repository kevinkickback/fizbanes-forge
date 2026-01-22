/** Schema helpers for creating and validating character data. */

function validateCharacterData(character) {
    const errors = [];
    if (!character) {
        errors.push('Character object is required');
        return { valid: false, errors };
    }
    if (!character.id) errors.push('Missing character ID');
    if (!character.name || String(character.name).trim() === '')
        errors.push('Missing character name');
    // Note: level is calculated from progression.classes[], no validation needed
    if (
        !Array.isArray(character.allowedSources) &&
        !(character.allowedSources instanceof Set)
    ) {
        errors.push('allowedSources must be an array or Set');
    }
    if (!character.abilityScores || typeof character.abilityScores !== 'object') {
        errors.push('Missing or invalid abilityScores');
    } else {
        for (const ability of [
            'strength',
            'dexterity',
            'constitution',
            'intelligence',
            'wisdom',
            'charisma',
        ]) {
            if (typeof character.abilityScores[ability] !== 'number') {
                errors.push(`Missing or invalid ability score: ${ability}`);
            }
        }
    }
    if (!character.proficiencies || typeof character.proficiencies !== 'object') {
        errors.push('Missing or invalid proficiencies');
    }
    if (!character.hitPoints || typeof character.hitPoints !== 'object') {
        errors.push('Missing or invalid hitPoints');
    } else {
        if (typeof character.hitPoints.current !== 'number')
            errors.push('Missing or invalid hitPoints.current');
        if (typeof character.hitPoints.max !== 'number')
            errors.push('Missing or invalid hitPoints.max');
        if (typeof character.hitPoints.temp !== 'number')
            errors.push('Missing or invalid hitPoints.temp');
    }
    return { valid: errors.length === 0, errors };
}

export const CharacterSchema = {
    /**
     * Create a new character with default values.
     * @returns {object} New character object
     */
    create() {
        return {
            id: null,
            name: '',
            playerName: '',
            portrait: '',

            // Ability scores
            abilityScores: {
                strength: 10,
                dexterity: 10,
                constitution: 10,
                intelligence: 10,
                wisdom: 10,
                charisma: 10,
            },

            // Ability bonuses (tracked by source)
            abilityBonuses: {
                strength: [],
                dexterity: [],
                constitution: [],
                intelligence: [],
                wisdom: [],
                charisma: [],
            },

            // Pending ability score choices
            pendingAbilityChoices: [],

            // Character details
            // Note: class info stored in progression.classes[], no legacy class field
            race: {
                name: '',
                source: '',
                subrace: '',
                abilityChoices: [],
            },
            background: null,
            size: 'Medium',
            speed: {
                walk: 30,
                fly: 0,
                swim: 0,
                climb: 0,
                burrow: 0,
            },

            // Physical characteristics
            height: '',
            weight: '',
            gender: '',
            alignment: '',
            deity: '',
            backstory: '',

            // Features
            features: {
                darkvision: 0,
                resistances: [],
                traits: {},
            },

            // Feats
            feats: [],
            featSources: {},

            // Note: subclass is stored in progression.classes[].subclass, not at root level
            // Note: total level is calculated from progression.classes[].levels, no legacy level field
            proficiencies: {
                armor: [],
                weapons: [],
                tools: [],
                skills: [],
                languages: [],
                savingThrows: [],
            },

            // Proficiency sources (tracking where proficiencies came from)
            proficiencySources: {
                armor: {},
                weapons: {},
                tools: {},
                skills: {},
                languages: {},
                savingThrows: {},
            },

            // Optional proficiencies (choices during character creation)
            optionalProficiencies: {
                armor: { allowed: 0, selected: [] },
                weapons: { allowed: 0, selected: [] },
                savingThrows: { allowed: 0, selected: [] },
                skills: {
                    allowed: 0,
                    options: [],
                    selected: [],
                    race: { allowed: 0, options: [], selected: [] },
                    class: { allowed: 0, options: [], selected: [] },
                    background: { allowed: 0, options: [], selected: [] },
                },
                languages: {
                    allowed: 0,
                    options: [],
                    selected: [],
                    race: { allowed: 0, options: [], selected: [] },
                    class: { allowed: 0, options: [], selected: [] },
                    background: { allowed: 0, options: [], selected: [] },
                },
                tools: {
                    allowed: 0,
                    options: [],
                    selected: [],
                    race: { allowed: 0, options: [], selected: [] },
                    class: { allowed: 0, options: [], selected: [] },
                    background: { allowed: 0, options: [], selected: [] },
                },
            },

            // Pending choices (general)
            pendingChoices: {},

            // Instrument choices (for musical instruments)
            instrumentChoices: [],

            // Variant rules configuration
            variantRules: {
                feats: true,
                abilityScoreMethod: 'custom',
            },

            // Sources
            allowedSources: [], // Array of source book codes

            // Equipment (legacy)
            equipment: [],

            // Spells (legacy)
            spells: [],

            // Hit points
            hitPoints: {
                current: 0,
                max: 0,
                temp: 0,
            },

            // Inventory system
            inventory: {
                items: [],
                equipped: {
                    head: null,
                    body: null,
                    hands: [],
                    feet: null,
                    back: null,
                    neck: null,
                    wrists: [],
                    fingers: [],
                    waist: null,
                },
                attuned: [],
                weight: {
                    current: 0,
                    capacity: 0,
                },
            },

            // Spellcasting system
            spellcasting: {
                classes: {},
                multiclass: {
                    isCastingMulticlass: false,
                    combinedSlots: {},
                },
                other: {
                    spellsKnown: [],
                    itemSpells: [],
                },
            },

            // Progression system (per-class tracking)
            progression: {
                classes: [],
                experiencePoints: 0,
                levelUps: [],
            },

            // Progression history (user choices at each level: spells, feats, invocations, etc.)
            progressionHistory: {},

            // Notes
            notes: '',

            // Metadata
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
        };
    },

    /**
     * Validate character data structure.
     * @param {object} character - Character object to validate
     * @returns {object} Validation result { valid: boolean, errors: string[] }
     */
    validate(character) {
        const { valid: isValid, errors } = validateCharacterData(character);

        if (!isValid) {
            console.warn('CharacterSchema', 'Validation failed', {
                errors,
                characterId: character.id,
            });
        } else {
            console.debug('CharacterSchema', 'Validation passed', {
                characterId: character.id,
            });
        }

        return { valid: isValid, errors };
    },

    /**
     * Update the lastModified timestamp.
     * @param {object} character - Character object
     */
    touch(character) {
        character.lastModified = new Date().toISOString();
        console.debug('CharacterSchema', 'Character touched', { id: character.id });
    },
};
