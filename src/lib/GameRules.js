// Centralized D&D 5e game rule constants that are not available in data JSON files.

/** Standard array for ability score generation */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/** Point buy budget */
export const POINT_BUY_BUDGET = 27;

/** Point buy cost per score value */
export const POINT_BUY_COSTS = new Map([
    [8, 0], [9, 1], [10, 2], [11, 3],
    [12, 4], [13, 5], [14, 7], [15, 9],
]);

/** Point buy score range */
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

/** Ability score bounds */
export const ABILITY_SCORE_MIN = 1;
export const ABILITY_SCORE_MAX = 20;
export const ABILITY_SCORE_ABSOLUTE_MAX = 30;

/** Equipment rules */
export const MAX_ATTUNEMENT_SLOTS = 3;
export const CARRY_CAPACITY_MULTIPLIER = 15;
export const LIGHT_ENCUMBRANCE_MULTIPLIER = 5;
export const HEAVY_ENCUMBRANCE_MULTIPLIER = 10;

/** Character file size limit (bytes) */
export const MAX_CHARACTER_SIZE = 10 * 1024 * 1024;

/** Portrait file size limit (bytes) */
export const MAX_PORTRAIT_SIZE = 5 * 1024 * 1024;

/** Default ASI levels fallback (used when class data unavailable) */
export const DEFAULT_ASI_LEVELS = [4, 8, 12, 16, 19];

/** Class-specific ASI level overrides */
export const CLASS_ASI_LEVELS = Object.freeze({
    Fighter: [4, 6, 8, 12, 14, 16, 19],
    Rogue: [4, 8, 10, 12, 16, 19],
});

export const PROFICIENCY_TYPES = Object.freeze({
    SKILLS: 'skills',
    SAVING_THROWS: 'savingThrows',
    WEAPONS: 'weapons',
    TOOLS: 'tools',
    ARMOR: 'armor',
    LANGUAGES: 'languages',
});

/** Default hit dice per class (fallback when class JSON lacks hd field) */
export const DEFAULT_HIT_DICE = Object.freeze({
    Barbarian: 'd12',
    Bard: 'd8',
    Cleric: 'd8',
    Druid: 'd8',
    Fighter: 'd10',
    Monk: 'd8',
    Paladin: 'd10',
    Ranger: 'd10',
    Rogue: 'd8',
    Sorcerer: 'd6',
    Warlock: 'd8',
    Wizard: 'd6',
});

/** Parse a hit dice string (e.g. "d8") into its numeric face value. Returns 8 as default. */
export function parseHitDice(hitDice) {
    const match = hitDice?.match(/d(\d+)/);
    return match ? parseInt(match[1], 10) : 8;
}
