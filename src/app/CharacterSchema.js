import { z } from 'zod';

// Zod schemas for character validation - designed to be lenient for backwards compatibility
const AbilityScoresSchema = z.object({
	strength: z.number(),
	dexterity: z.number(),
	constitution: z.number(),
	intelligence: z.number(),
	wisdom: z.number(),
	charisma: z.number(),
});

const HitPointsSchema = z.object({
	current: z.number(),
	max: z.number(),
	temp: z.number(),
});

const ProficienciesSchema = z.object({
	armor: z.array(z.any()).optional().default([]),
	weapons: z.array(z.any()).optional().default([]),
	tools: z.array(z.any()).optional().default([]),
	skills: z.array(z.any()).optional().default([]),
	languages: z.array(z.any()).optional().default([]),
	savingThrows: z.array(z.any()).optional().default([]),
}).passthrough(); // Allow additional properties

const EquippedSchema = z.object({
	head: z.any().nullable().optional().default(null),
	body: z.any().nullable().optional().default(null),
	hands: z.array(z.any()).optional().default([]),
	feet: z.any().nullable().optional().default(null),
	back: z.any().nullable().optional().default(null),
	neck: z.any().nullable().optional().default(null),
	wrists: z.array(z.any()).optional().default([]),
	fingers: z.array(z.any()).optional().default([]),
	waist: z.any().nullable().optional().default(null),
}).passthrough();

const InventorySchema = z.object({
	items: z.array(z.any()).optional().default([]),
	equipped: EquippedSchema.optional(),
	attuned: z.array(z.any()).optional().default([]),
	weight: z.object({
		current: z.number().optional().default(0),
		capacity: z.number().optional().default(0),
	}).optional(),
}).passthrough();

const SpellcastingSchema = z.object({
	classes: z.record(z.any()).optional().default({}),
	multiclass: z.object({
		isCastingMulticlass: z.boolean().optional().default(false),
		combinedSlots: z.record(z.any()).optional().default({}),
	}).optional(),
	other: z.object({
		spellsKnown: z.array(z.any()).optional().default([]),
		itemSpells: z.array(z.any()).optional().default([]),
	}).optional(),
}).passthrough();

const ProgressionSchema = z.object({
	classes: z.array(z.any()).optional().default([]),
	experiencePoints: z.number().optional().default(0),
	levelUps: z.array(z.any()).optional().default([]),
}).passthrough();

// Main character validation schema (for saved characters with assigned IDs)
// Uses passthrough() to allow additional properties for forward compatibility
const CharacterDataSchema = z.object({
	id: z.string().min(1, 'Missing character ID'),
	name: z.string().min(1, 'Missing character name'),
	portrait: z.string().optional().default(''),
	abilityScores: AbilityScoresSchema,
	race: z.any().nullable().optional().default(null),
	background: z.any().nullable().optional().default(null),
	proficiencies: ProficienciesSchema.optional(),
	allowedSources: z.union([z.array(z.any()), z.instanceof(Set)]).optional().default([]),
	equipment: z.array(z.any()).optional().default([]),
	spells: z.array(z.any()).optional().default([]),
	hitPoints: HitPointsSchema,
	inventory: InventorySchema.optional(),
	spellcasting: SpellcastingSchema.optional(),
	progression: ProgressionSchema.optional(),
	progressionHistory: z.record(z.any()).optional().default({}),
	notes: z.string().optional().default(''),
	createdAt: z.string().optional().default(''),
	lastModified: z.string().optional().default(''),
}).passthrough(); // Allow additional properties for forward compatibility

// Export schemas for advanced usage (type inference, partial validation, etc.)
export const CharacterSchemas = {
	AbilityScores: AbilityScoresSchema,
	HitPoints: HitPointsSchema,
	Proficiencies: ProficienciesSchema,
	Inventory: InventorySchema,
	Spellcasting: SpellcastingSchema,
	Progression: ProgressionSchema,
	CharacterData: CharacterDataSchema,
};

function validateCharacterData(character) {
	if (!character) {
		return { valid: false, errors: ['Character object is required'] };
	}

	const result = CharacterDataSchema.safeParse(character);

	if (result.success) {
		return { valid: true, errors: [] };
	}

	// Convert Zod errors to simple string array for backwards compatibility
	const errors = result.error.issues.map((issue) => {
		const path = issue.path.join('.');
		return path ? `${path}: ${issue.message}` : issue.message;
	});

	return { valid: false, errors };
}

export const CharacterSchema = {
	/** Create a new character with default values. */
	create() {
		return {
			id: null,
			name: '',
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

			race: null,
			background: null,
			proficiencies: {
				armor: [],
				weapons: [],
				tools: [],
				skills: [],
				languages: [],
				savingThrows: [],
			},

			allowedSources: [],

			equipment: [],

			// Spells
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

			progression: {
				classes: [],
				experiencePoints: 0,
				levelUps: [],
			},

			progressionHistory: {},

			notes: '',

			createdAt: new Date().toISOString(),
			lastModified: new Date().toISOString(),
		};
	},

	/** Validate character data structure. */
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

	/** Update the lastModified timestamp. */
	touch(character) {
		character.lastModified = new Date().toISOString();
		console.debug('CharacterSchema', 'Character touched', { id: character.id });
	},
};
