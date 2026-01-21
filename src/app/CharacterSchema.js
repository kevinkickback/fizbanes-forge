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
