import { z } from 'zod';

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

/**
 * Create a ValidationError from zod errors
 */
export class ValidationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
    }
}
