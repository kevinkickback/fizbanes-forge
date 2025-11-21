/**
 * ClassFeatureResolver.js
 * Resolves class features by level and handles subclass features
 */

/**
 * Gets all class features up to a specific level
 * @param {Object} classData - The class data
 * @param {number} level - Character level
 * @returns {Array<Object>} Array of features available at this level
 */
export function getFeaturesAtLevel(classData, level) {
    if (!classData || !classData.classFeatures) {
        return [];
    }

    const features = [];

    for (const feature of classData.classFeatures) {
        if (feature.level && feature.level <= level) {
            features.push(feature);
        }
    }

    return features;
}

/**
 * Gets features gained at a specific level (not cumulative)
 * @param {Object} classData - The class data
 * @param {number} level - Character level
 * @returns {Array<Object>} Array of features gained at exactly this level
 */
export function getNewFeaturesAtLevel(classData, level) {
    if (!classData || !classData.classFeatures) {
        return [];
    }

    return classData.classFeatures.filter(feature => feature.level === level);
}

/**
 * Gets subclass features up to a specific level
 * @param {Object} subclass - The subclass data
 * @param {number} level - Character level
 * @returns {Array<Object>} Array of subclass features
 */
export function getSubclassFeaturesAtLevel(subclass, level) {
    if (!subclass || !subclass.subclassFeatures) {
        return [];
    }

    const features = [];

    for (const feature of subclass.subclassFeatures) {
        if (feature.level && feature.level <= level) {
            features.push(feature);
        }
    }

    return features;
}

/**
 * Gets the spell slots for a class at a specific level
 * @param {Object} classData - The class data
 * @param {number} level - Character level
 * @returns {Object|null} Spell slot progression for this level
 */
export function getSpellSlotsAtLevel(classData, level) {
    if (!classData || !classData.casterProgression) {
        return null;
    }

    const progression = classData.casterProgression;

    // Handle full caster (1:1 ratio)
    if (progression === 'full') {
        return getFullCasterSlots(level);
    }

    // Handle half caster (2:1 ratio)
    if (progression === '1/2') {
        return getHalfCasterSlots(level);
    }

    // Handle third caster (3:1 ratio) - Eldritch Knight, Arcane Trickster
    if (progression === '1/3') {
        return getThirdCasterSlots(level);
    }

    // Handle Warlock pact magic
    if (progression === 'pact') {
        return getPactMagicSlots(level);
    }

    return null;
}

/**
 * Full caster spell slot progression
 * @param {number} level - Character level
 * @returns {Array<number>} Spell slots by level [1st, 2nd, 3rd, ...]
 */
function getFullCasterSlots(level) {
    const slots = [
        [2, 0, 0, 0, 0, 0, 0, 0, 0],  // Level 1
        [3, 0, 0, 0, 0, 0, 0, 0, 0],  // Level 2
        [4, 2, 0, 0, 0, 0, 0, 0, 0],  // Level 3
        [4, 3, 0, 0, 0, 0, 0, 0, 0],  // Level 4
        [4, 3, 2, 0, 0, 0, 0, 0, 0],  // Level 5
        [4, 3, 3, 0, 0, 0, 0, 0, 0],  // Level 6
        [4, 3, 3, 1, 0, 0, 0, 0, 0],  // Level 7
        [4, 3, 3, 2, 0, 0, 0, 0, 0],  // Level 8
        [4, 3, 3, 3, 1, 0, 0, 0, 0],  // Level 9
        [4, 3, 3, 3, 2, 0, 0, 0, 0],  // Level 10
        [4, 3, 3, 3, 2, 1, 0, 0, 0],  // Level 11
        [4, 3, 3, 3, 2, 1, 0, 0, 0],  // Level 12
        [4, 3, 3, 3, 2, 1, 1, 0, 0],  // Level 13
        [4, 3, 3, 3, 2, 1, 1, 0, 0],  // Level 14
        [4, 3, 3, 3, 2, 1, 1, 1, 0],  // Level 15
        [4, 3, 3, 3, 2, 1, 1, 1, 0],  // Level 16
        [4, 3, 3, 3, 2, 1, 1, 1, 1],  // Level 17
        [4, 3, 3, 3, 3, 1, 1, 1, 1],  // Level 18
        [4, 3, 3, 3, 3, 2, 1, 1, 1],  // Level 19
        [4, 3, 3, 3, 3, 2, 2, 1, 1],  // Level 20
    ];

    return slots[level - 1] || [0, 0, 0, 0, 0, 0, 0, 0, 0];
}

/**
 * Half caster spell slot progression (Paladin, Ranger)
 * @param {number} level - Character level
 * @returns {Array<number>} Spell slots by level
 */
function getHalfCasterSlots(level) {
    if (level < 2) return [0, 0, 0, 0, 0];

    const effectiveLevel = Math.ceil(level / 2);
    const fullSlots = getFullCasterSlots(effectiveLevel);

    // Half casters only go up to 5th level spells
    return fullSlots.slice(0, 5);
}

/**
 * Third caster spell slot progression (Eldritch Knight, Arcane Trickster)
 * @param {number} level - Character level
 * @returns {Array<number>} Spell slots by level
 */
function getThirdCasterSlots(level) {
    if (level < 3) return [0, 0, 0, 0];

    const effectiveLevel = Math.ceil(level / 3);
    const fullSlots = getFullCasterSlots(effectiveLevel);

    // Third casters only go up to 4th level spells
    return fullSlots.slice(0, 4);
}

/**
 * Warlock pact magic slot progression
 * @param {number} level - Character level
 * @returns {Object} Pact magic slots with count and level
 */
function getPactMagicSlots(level) {
    const slots = [
        { count: 1, level: 1 },   // Level 1
        { count: 2, level: 1 },   // Level 2
        { count: 2, level: 2 },   // Level 3
        { count: 2, level: 2 },   // Level 4
        { count: 2, level: 3 },   // Level 5
        { count: 2, level: 3 },   // Level 6
        { count: 2, level: 4 },   // Level 7
        { count: 2, level: 4 },   // Level 8
        { count: 2, level: 5 },   // Level 9
        { count: 2, level: 5 },   // Level 10
        { count: 3, level: 5 },   // Level 11+
    ];

    const index = Math.min(level - 1, 10);
    return slots[index] || { count: 0, level: 0 };
}

/**
 * Gets proficiency bonus at a specific level
 * @param {number} level - Character level
 * @returns {number} Proficiency bonus
 */
export function getProficiencyBonusAtLevel(level) {
    if (level >= 17) return 6;
    if (level >= 13) return 5;
    if (level >= 9) return 4;
    if (level >= 5) return 3;
    return 2;
}

/**
 * Determines when a subclass is chosen for a class
 * @param {Object} classData - The class data
 * @returns {number} Level when subclass is chosen
 */
export function getSubclassLevel(classData) {
    if (!classData || !classData.subclassTitle) {
        return 1;
    }

    // Most classes get subclass at level 3
    // Some exceptions: Cleric and Warlock at 1, Sorcerer and Wizard at 1 (sometimes)
    const earlySubclasses = ['Cleric', 'Warlock', 'Sorcerer'];

    if (earlySubclasses.includes(classData.name)) {
        return 1;
    }

    return 3;
}

/**
 * Gets the ability score improvement levels for a class
 * @param {Object} classData - The class data
 * @returns {Array<number>} Levels when ASIs are gained
 */
export function getASILevels(classData) {
    // Standard ASI progression for most classes
    const standardASI = [4, 8, 12, 16, 19];

    // Fighter gets extra ASIs
    if (classData?.name === 'Fighter') {
        return [4, 6, 8, 12, 14, 16, 19];
    }

    // Rogue gets extra ASI
    if (classData?.name === 'Rogue') {
        return [4, 8, 10, 12, 16, 19];
    }

    return standardASI;
}

/**
 * Checks if a level grants an ASI
 * @param {Object} classData - The class data
 * @param {number} level - Character level to check
 * @returns {boolean} True if this level grants an ASI
 */
export function isASILevel(classData, level) {
    const asiLevels = getASILevels(classData);
    return asiLevels.includes(level);
}

/**
 * Gets cantrips known at a level
 * @param {Object} classData - The class data
 * @param {number} level - Character level
 * @returns {number} Number of cantrips known
 */
export function getCantripsKnown(classData, level) {
    if (!classData || !classData.cantripProgression) {
        return 0;
    }

    const progression = classData.cantripProgression[level - 1];
    return progression || 0;
}

/**
 * Gets spells known at a level (for non-prepared casters)
 * @param {Object} classData - The class data
 * @param {number} level - Character level
 * @returns {number} Number of spells known
 */
export function getSpellsKnown(classData, level) {
    if (!classData || !classData.spellsKnownProgression) {
        return 0;
    }

    const progression = classData.spellsKnownProgression[level - 1];
    return progression || 0;
}
