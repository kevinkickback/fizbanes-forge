/** Domain schema helpers for creating and validating character data. */

/**
 * Lightweight character validation function.
 * @param {object} character - Character payload to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result with errors
 * @private
 */
function validateCharacterData(character) {
	const errors = [];
	if (!character) {
		errors.push('Character object is required');
		return { valid: false, errors };
	}
	if (!character.id) errors.push('Missing character ID');
	if (!character.name || String(character.name).trim() === '')
		errors.push('Missing character name');
	if (
		typeof character.level !== 'number' ||
		character.level < 1 ||
		character.level > 20
	) {
		errors.push('Level must be a number between 1 and 20');
	}
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
