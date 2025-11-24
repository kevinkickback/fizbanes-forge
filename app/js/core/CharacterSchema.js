/**
 * Character data schema and validation.
 * 
 * ARCHITECTURE: Domain Layer - Pure business logic
 * 
 * PURPOSE:
 * - Define canonical character data structure
 * - Provide validation for character data
 * - Create new character instances
 * - No dependencies on infrastructure or application
 * 
 * @module domain/CharacterSchema
 */

import { Logger } from '../infrastructure/Logger.js';

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
                charisma: 10
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
                savingThrows: []
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
                temp: 0
            },

            // Notes
            notes: '',

            // Metadata
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
    },

    /**
     * Validate character data structure.
     * @param {object} character - Character object to validate
     * @returns {object} Validation result { valid: boolean, errors: string[] }
     */
    validate(character) {
        const errors = [];

        if (!character) {
            errors.push('Character object is required');
            return { valid: false, errors };
        }

        // Required fields
        if (!character.id) {
            errors.push('Missing character ID');
        }

        if (!character.name || character.name.trim() === '') {
            errors.push('Missing character name');
        }

        // Type checks
        if (typeof character.level !== 'number' || character.level < 1 || character.level > 20) {
            errors.push('Level must be a number between 1 and 20');
        }

        if (!Array.isArray(character.allowedSources)) {
            errors.push('allowedSources must be an array');
        }

        if (!character.abilityScores || typeof character.abilityScores !== 'object') {
            errors.push('Missing or invalid abilityScores');
        } else {
            const requiredAbilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
            for (const ability of requiredAbilities) {
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
            // Check for required hitPoints properties
            if (typeof character.hitPoints.current !== 'number') {
                errors.push('Missing or invalid hitPoints.current');
            }
            if (typeof character.hitPoints.max !== 'number') {
                errors.push('Missing or invalid hitPoints.max');
            }
            if (typeof character.hitPoints.temp !== 'number') {
                errors.push('Missing or invalid hitPoints.temp');
            }
        }

        const isValid = errors.length === 0;

        if (!isValid) {
            Logger.warn('CharacterSchema', 'Validation failed', { errors, characterId: character.id });
        } else {
            Logger.debug('CharacterSchema', 'Validation passed', { characterId: character.id });
        }

        return { valid: isValid, errors };
    },

    /**
     * Update the lastModified timestamp.
     * @param {object} character - Character object
     */
    touch(character) {
        character.lastModified = new Date().toISOString();
        Logger.debug('CharacterSchema', 'Character touched', { id: character.id });
    }
};
