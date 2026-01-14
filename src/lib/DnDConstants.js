/**
 * D&D Core Constants
 * 
 * Core D&D game constants that are universal and unchanging.
 * These are not data-driven but rather fundamental to the game rules.
 */

/**
 * Ability score names and abbreviations
 */
export const ABILITIES = {
    STR: { abbr: 'str', full: 'Strength', display: 'STR' },
    DEX: { abbr: 'dex', full: 'Dexterity', display: 'DEX' },
    CON: { abbr: 'con', full: 'Constitution', display: 'CON' },
    INT: { abbr: 'int', full: 'Intelligence', display: 'INT' },
    WIS: { abbr: 'wis', full: 'Wisdom', display: 'WIS' },
    CHA: { abbr: 'cha', full: 'Charisma', display: 'CHA' },
};

/**
 * Ordered list of ability abbreviations
 */
export const ABILITY_LIST = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/**
 * Ordered list of full ability names
 */
export const ABILITY_NAMES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

/**
 * Magic school abbreviations to full names
 * Follows 5etools conventions
 */
export const SPELL_SCHOOLS = {
    A: 'Abjuration',
    C: 'Conjuration',
    D: 'Divination',
    E: 'Enchantment',
    I: 'Illusion',
    N: 'Necromancy',
    T: 'Transmutation',
    V: 'Evocation',
};

/**
 * Ordered list of spell school names
 */
export const SPELL_SCHOOL_NAMES = [
    'Abjuration',
    'Conjuration',
    'Divination',
    'Enchantment',
    'Evocation',
    'Illusion',
    'Necromancy',
    'Transmutation',
];

/**
 * Get full school name from abbreviation
 * @param {string} code - School abbreviation (A, C, D, E, I, N, T, V)
 * @returns {string} Full school name
 */
export function getSchoolName(code) {
    return SPELL_SCHOOLS[code] || code;
}

/**
 * Get ability full name from abbreviation
 * @param {string} abbr - Ability abbreviation (str, dex, con, etc.)
 * @returns {string} Full ability name
 */
export function getAbilityName(abbr) {
    const abilityEntry = Object.values(ABILITIES).find(a => a.abbr === abbr);
    return abilityEntry?.full || abbr;
}
