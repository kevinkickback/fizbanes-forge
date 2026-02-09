import { z } from 'zod';
import { ValidationError } from './Errors.js';

/**
 * Common validation schemas for use across services
 */

// Source book identifiers (e.g., "PHB", "XGE")
export const sourceSchema = z.string().min(1).toUpperCase();

// Entity name validation
export const nameSchema = z.string().min(1);

// Optional source with default
export const optionalSourceSchema = z
    .string()
    .min(1)
    .toUpperCase()
    .default('PHB');

// Race service schemas
export const raceIdentifierSchema = z.object({
    name: nameSchema,
    source: optionalSourceSchema,
});

export const subraceIdentifierSchema = z.object({
    raceName: nameSchema,
    subraceName: nameSchema,
    source: optionalSourceSchema,
    raceSource: optionalSourceSchema,
});

// Class service schemas
export const classIdentifierSchema = z.object({
    name: nameSchema,
    source: optionalSourceSchema,
});

export const subclassIdentifierSchema = z.object({
    className: nameSchema,
    subclassName: nameSchema,
    classSource: optionalSourceSchema,
    subclassShortName: z.string().optional(),
    source: optionalSourceSchema,
});

// Background service schemas
export const backgroundIdentifierSchema = z.object({
    name: nameSchema,
    source: optionalSourceSchema,
});

// Spell service schemas
export const spellIdentifierSchema = z.object({
    name: nameSchema,
    source: optionalSourceSchema,
});

export const spellFilterSchema = z.object({
    level: z.number().int().min(0).max(9).optional(),
    school: z.string().optional(),
    classes: z.array(z.string()).optional(),
    source: sourceSchema.optional(),
});

// Item service schemas
export const itemIdentifierSchema = z.object({
    name: nameSchema,
    source: optionalSourceSchema,
});

export const itemFilterSchema = z.object({
    type: z.string().optional(),
    rarity: z.string().optional(),
    source: sourceSchema.optional(),
    attunement: z.boolean().optional(),
});

// Feat service schemas
export const featIdentifierSchema = z.object({
    name: nameSchema,
    source: optionalSourceSchema,
});

// Proficiency schemas
export const proficiencyTypeSchema = z.enum([
    'armor',
    'weapons',
    'tools',
    'skills',
    'languages',
    'savingThrows',
]);

export const addProficiencySchema = z.object({
    type: proficiencyTypeSchema,
    proficiency: z.string().min(1),
    source: z.string().min(1),
});

// Ability score schemas
export const abilitySchema = z.enum([
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
    'str',
    'dex',
    'con',
    'int',
    'wis',
    'cha',
]);

export const abilityScoresSchema = z.object({
    strength: z.number().int().min(1).max(30),
    dexterity: z.number().int().min(1).max(30),
    constitution: z.number().int().min(1).max(30),
    intelligence: z.number().int().min(1).max(30),
    wisdom: z.number().int().min(1).max(30),
    charisma: z.number().int().min(1).max(30),
});

export const abilityBonusSchema = z.object({
    ability: abilitySchema,
    value: z.number().int(),
    source: z.string().min(1),
});

// Character level schemas
export const levelSchema = z.number().int().min(1).max(20);

// Source filter array
export const sourceArraySchema = z.array(sourceSchema);

// Deity service schemas
export const deityIdentifierSchema = z.object({
    name: nameSchema,
});

// Monster service schemas
export const monsterIdentifierSchema = z.object({
    id: z.string().min(1),
});

// Skill service schemas
export const skillIdentifierSchema = z.object({
    abilityName: z.string().min(1),
});

// Condition service schemas
export const conditionIdentifierSchema = z.object({
    name: nameSchema,
});

// Action service schemas
export const actionIdentifierSchema = z.object({
    name: nameSchema,
});

// Optional feature service schemas
export const optionalFeatureIdentifierSchema = z.object({
    name: nameSchema,
    source: optionalSourceSchema,
});

export const optionalFeatureTypeSchema = z.union([
    z.string().min(1),
    z.array(z.string().min(1)),
]);

// Variant rule service schemas
export const variantRuleIdentifierSchema = z.object({
    name: nameSchema,
});

// ProficiencyService schemas
export const addProficiencyArgsSchema = z.object({
    character: z.any().refine(
        (val) => val && typeof val === 'object',
        { message: 'Character must be an object' }
    ),
    type: proficiencyTypeSchema,
    proficiency: z.string().min(1, 'Proficiency name is required'),
    source: z.string().min(1, 'Source is required'),
});

export const removeProficienciesBySourceArgsSchema = z.object({
    character: z.any().refine(
        (val) => val && typeof val === 'object',
        { message: 'Character must be an object' }
    ),
    source: z.string().min(1, 'Source is required'),
});

// AbilityScoreService schemas
export const abilityNameSchema = z.enum([
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
    'str',
    'dex',
    'con',
    'int',
    'wis',
    'cha',
]);

export const updateAbilityScoreArgsSchema = z.object({
    ability: z.string().min(1, 'Ability name is required'),
    score: z.coerce.number().int().min(1).max(30, 'Ability score must be between 1 and 30'),
});

export const handleAbilityChoiceArgsSchema = z.object({
    ability: z.string().min(1, 'Ability name is required'),
    choiceIndex: z.number().int().min(0),
    bonus: z.number().int(),
    source: z.string().min(1, 'Source is required'),
});

// LevelUpService schemas
export const addClassLevelArgsSchema = z.object({
    character: z.any().refine(
        (val) => val && typeof val === 'object',
        { message: 'Character must be an object' }
    ),
    className: z.string().min(1, 'Class name is required'),
    level: z.number().int().min(1).max(20).default(1),
    source: optionalSourceSchema,
});

export const removeClassLevelArgsSchema = z.object({
    character: z.any().refine(
        (val) => val && typeof val === 'object',
        { message: 'Character must be an object' }
    ),
    className: z.string().min(1, 'Class name is required'),
});

// EquipmentService schemas
export const addItemArgsSchema = z.object({
    character: z.any().refine(
        (val) => val && typeof val === 'object',
        { message: 'Character must be an object' }
    ),
    itemData: z.object({
        name: z.string().min(1, 'Item name is required'),
        id: z.string().optional(),
        source: z.string().optional(),
        cost: z.unknown().optional(),
        weight: z.number().optional(),
    }).passthrough(),
    quantity: z.number().int().min(1).default(1),
    source: z.string().default('Manual'),
});

export const removeItemArgsSchema = z.object({
    character: z.object({
        inventory: z.object({
            items: z.array(z.unknown()).optional(),
        }).optional(),
    }),
    itemInstanceId: z.string().min(1, 'Item instance ID is required'),
    quantity: z.number().int().min(1).default(1),
});

// SpellSelectionService schemas
export const addSpellArgsSchema = z.object({
    character: z.any().refine(
        (val) => val && typeof val === 'object',
        { message: 'Character must be an object' }
    ),
    className: z.string().min(1, 'Class name is required'),
    spellData: z.object({
        name: z.string().min(1, 'Spell name is required'),
        level: z.number().int().min(0).max(9),
    }).passthrough(),
});

export const removeSpellArgsSchema = z.object({
    character: z.any().refine(
        (val) => val && typeof val === 'object',
        { message: 'Character must be an object' }
    ),
    className: z.string().min(1, 'Class name is required'),
    spellName: z.string().min(1, 'Spell name is required'),
});

// SourceService schemas
export const sourceIdentifierSchema = z.string().min(1, 'Source identifier is required');

/**
 * Helper to validate and transform input
 */
export function validateInput(schema, input, errorMessage = 'Invalid input') {
    const result = schema.safeParse(input);
    if (!result.success) {
        const details = {
            input,
            errors: result.error.errors,
        };
        throw new ValidationError(errorMessage, details);
    }
    return result.data;
}
