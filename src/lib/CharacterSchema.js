/** Schema helpers for creating and validating character data using Zod. */
import { z } from 'zod';

// Character validation schema - validates structure without providing defaults  
const characterValidationSchema = z.object({
    id: z.string().nullable(),
    name: z.string().min(1, 'Character name is required'),
    playerName: z.string().optional(),
    portrait: z.string().optional(),

    abilityScores: z.object({
        strength: z.number().int().min(1).max(30),
        dexterity: z.number().int().min(1).max(30),
        constitution: z.number().int().min(1).max(30),
        intelligence: z.number().int().min(1).max(30),
        wisdom: z.number().int().min(1).max(30),
        charisma: z.number().int().min(1).max(30),
    }),

    abilityBonuses: z.record(z.string(), z.array(z.unknown())).optional(),
    pendingAbilityChoices: z.array(z.unknown()).optional(),

    race: z.unknown().nullable().optional(),
    background: z.unknown().nullable().optional(),
    size: z.union([z.string(), z.array(z.unknown())]).optional(),
    speed: z.record(z.string(), z.number()).optional(),

    height: z.string().optional(),
    weight: z.string().optional(),
    gender: z.string().optional(),
    age: z.string().optional(),
    eyeColor: z.string().optional(),
    skinColor: z.string().optional(),
    hairColor: z.string().optional(),
    alignment: z.string().optional(),
    deity: z.string().optional(),
    backstory: z.string().optional(),
    additionalFeatures: z.string().optional(),
    personalityTraits: z.string().optional(),
    ideals: z.string().optional(),
    bonds: z.string().optional(),
    flaws: z.string().optional(),
    experience: z.string().optional(),
    alliesAndOrganizations: z.object({
        selectedAlly: z.string().optional(),
        customNotes: z.string().optional(),
    }).optional(),

    features: z.record(z.string(), z.unknown()).optional(),
    feats: z.array(z.unknown()).optional(),
    featSources: z.union([z.record(z.string(), z.unknown()), z.instanceof(Map)]).optional(),

    proficiencies: z.record(z.string(), z.array(z.string())).optional(),
    proficiencySources: z.record(z.string(), z.unknown()).optional(),
    optionalProficiencies: z.record(z.string(), z.unknown()).optional(),

    pendingChoices: z.union([z.record(z.string(), z.unknown()), z.instanceof(Map)]).optional(),
    instrumentChoices: z.array(z.unknown()).optional(),

    variantRules: z.record(z.string(), z.unknown()).optional(),
    allowedSources: z.union([z.array(z.string()), z.instanceof(Set)]).optional(),

    equipment: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
    spells: z.array(z.unknown()).optional(),

    hitPoints: z.object({
        current: z.number(),
        max: z.number(),
        temp: z.number(),
    }),

    inventory: z.record(z.string(), z.unknown()).optional(),
    spellcasting: z.record(z.string(), z.unknown()).optional(),
    progression: z.record(z.string(), z.unknown()).optional(),
    progressionHistory: z.record(z.string(), z.unknown()).optional(),

    notes: z.string().optional(),
    createdAt: z.string().optional(),
    lastModified: z.string().optional(),
}).passthrough();



export const CharacterSchema = {
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
            age: '',
            eyeColor: '',
            skinColor: '',
            hairColor: '',
            alignment: '',
            deity: '',
            backstory: '',
            additionalFeatures: '',
            personalityTraits: '',
            ideals: '',
            bonds: '',
            flaws: '',
            experience: '',
            alliesAndOrganizations: {
                selectedAlly: '',
                customNotes: '',
            },

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
                equipped: [],
                attuned: [],
                currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
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
     * Validates a character object using Zod schema
     * @param {Object} character - Character object to validate
     * @returns {{ valid: boolean, errors: string[] }} Validation result
     */
    validate(character) {
        const result = characterValidationSchema.safeParse(character);

        if (!result.success) {
            const errors = result.error?.issues ?
                result.error.issues.map(err =>
                    `${err.path.join('.')}: ${err.message}`
                ) :
                ['Validation failed'];

            console.warn('[CharacterSchema]', 'Validation failed:', {
                errors,
                characterId: character?.id,
            });

            return { valid: false, errors };
        }

        return { valid: true, errors: [] };
    },

    /**
     * Parses and validates a character object, returning the validated data
     * @param {Object} character - Character object to parse
     * @returns {Object} Validated and transformed character data
     * @throws {Error} If validation fails
     */
    parse(character) {
        try {
            return characterValidationSchema.parse(character);
        } catch (error) {
            console.error('[CharacterSchema]', 'Parse failed:', {
                error: error.message,
                characterId: character?.id,
            });
            throw error;
        }
    },

    /**
     * Gets the Zod schema for external use
     * @returns {z.ZodObject} The character validation schema
     */
    getSchema() {
        return characterValidationSchema;
    },

    touch(character) {
        character.lastModified = new Date().toISOString();
    },
};
