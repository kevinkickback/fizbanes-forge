/** Domain schema helpers for creating and validating character data. */

import { validate as validateCharacter } from './CharacterValidation.js';

export const CharacterSchema = {
	/**
	 * Create a new character with default values.
	 * @returns {object} New character object
	 */
	create() {
		return {
			id: null,
			name: '',
			level: 1,

			// Ability scores
			abilityScores: {
				strength: 10,
				dexterity: 10,
				constitution: 10,
				intelligence: 10,
				wisdom: 10,
				charisma: 10,
			},

			// Character details
			class: null,
			subclass: null,
			race: null,
			background: null,

			// Proficiencies (stored as arrays)
			proficiencies: {
				armor: [],
				weapons: [],
				tools: [],
				skills: [],
				languages: [],
				savingThrows: [],
			},

			// Sources
			allowedSources: [], // Array of source book codes

			// Equipment
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
		const { valid: isValid, errors } = validateCharacter(character);

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
