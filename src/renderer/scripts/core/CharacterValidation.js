/**
 * CharacterValidation.js
 * Shared ESM character validation for renderer and main processes
 * Provides centralized validation rules for character data integrity
 */

// Shared ESM character validation for renderer and main
export function validate(character) {
    const errors = [];
    if (!character) {
        errors.push('Character object is required');
        return { valid: false, errors };
    }
    if (!character.id) errors.push('Missing character ID');
    if (!character.name || String(character.name).trim() === '') errors.push('Missing character name');
    if (typeof character.level !== 'number' || character.level < 1 || character.level > 20) {
        errors.push('Level must be a number between 1 and 20');
    }
    if (!Array.isArray(character.allowedSources) && !(character.allowedSources instanceof Set)) {
        errors.push('allowedSources must be an array or Set');
    }
    if (!character.abilityScores || typeof character.abilityScores !== 'object') {
        errors.push('Missing or invalid abilityScores');
    } else {
        for (const ability of ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']) {
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
        if (typeof character.hitPoints.current !== 'number') errors.push('Missing or invalid hitPoints.current');
        if (typeof character.hitPoints.max !== 'number') errors.push('Missing or invalid hitPoints.max');
        if (typeof character.hitPoints.temp !== 'number') errors.push('Missing or invalid hitPoints.temp');
    }
    return { valid: errors.length === 0, errors };
}
