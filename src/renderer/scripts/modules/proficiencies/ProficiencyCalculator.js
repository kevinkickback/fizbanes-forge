/** Pure proficiency bonus and modifier calculations. */
import {
	SKILL_TO_ABILITY,
	ascSortLower,
	attAbvToFull,
	formatModifierNumber,
} from '../../utils/5eToolsParser.js';
import DataNormalizer from '../utils/DataNormalizer.js';

/**
 * Saving throw to ability mapping
 */
export const SAVING_THROW_ABILITIES = {
	strength: 'strength',
	dexterity: 'dexterity',
	constitution: 'constitution',
	intelligence: 'intelligence',
	wisdom: 'wisdom',
	charisma: 'charisma',
};

/**
 * Gets the ability associated with a skill
 * @param {string} skillName - The skill name
 * @returns {string|null} The ability name or null if not found
 */
export function getSkillAbility(skillName) {
	if (!skillName) return null;
	const normalized = DataNormalizer.normalizeForLookup(skillName);
	// SKILL_TO_ABILITY uses lowercase ability abbreviations (str, dex, etc.)
	// Convert to full names for compatibility
	const abilityAbv = SKILL_TO_ABILITY[normalized];
	if (!abilityAbv) return null;

	// Use 5eToolsParser helper to convert abbreviation to full name
	// attAbvToFull returns capitalized names (e.g., 'Strength'); convert to lowercase for internal use
	return attAbvToFull(abilityAbv).toLowerCase();
}

/**
 * Calculates skill modifier with proficiency and expertise
 * @param {number} abilityModifier - The ability modifier for the skill
 * @param {number} proficiencyBonus - Character's proficiency bonus
 * @param {boolean} isProficient - Whether proficient in the skill
 * @param {boolean} hasExpertise - Whether has expertise in the skill
 * @returns {number} The total skill modifier
 */
export function calculateSkillModifier(
	abilityModifier,
	proficiencyBonus,
	isProficient = false,
	hasExpertise = false,
) {
	let modifier = abilityModifier || 0;

	if (hasExpertise) {
		modifier += proficiencyBonus * 2;
	} else if (isProficient) {
		modifier += proficiencyBonus;
	}

	return modifier;
}

/**
 * Calculates saving throw modifier
 * @param {number} abilityModifier - The ability modifier for the save
 * @param {number} proficiencyBonus - Character's proficiency bonus
 * @param {boolean} isProficient - Whether proficient in the saving throw
 * @returns {number} The total saving throw modifier
 */
export function calculateSavingThrowModifier(
	abilityModifier,
	proficiencyBonus,
	isProficient = false,
) {
	let modifier = abilityModifier || 0;

	if (isProficient) {
		modifier += proficiencyBonus;
	}

	return modifier;
}

/**
 * Formats a modifier value with proper sign
 * @param {number} modifier - The modifier value
 * @returns {string} Formatted string (e.g., "+3", "-1", "+0")
 * @deprecated Use formatModifierNumber from 5eToolsParser for consistency
 */
export function formatModifier(modifier) {
	// Use 5eToolsParser helper for consistent formatting
	return formatModifierNumber(modifier);
}

/**
 * Merges multiple proficiency lists, removing duplicates
 * @param {...Array<string>} proficiencyLists - Multiple arrays of proficiencies
 * @returns {Array<string>} Merged list without duplicates
 */
export function mergeProficiencies(...proficiencyLists) {
	const merged = new Map();

	for (const list of proficiencyLists) {
		if (!Array.isArray(list)) continue;
		for (const item of list) {
			if (!item || typeof item !== 'string') continue;
			const key = DataNormalizer.normalizeForLookup(item);
			if (!merged.has(key)) {
				merged.set(key, item);
			}
		}
	}

	// Use 5eToolsParser sorting helper for consistent ordering
	return Array.from(merged.values()).sort(ascSortLower);
}

/**
 * Checks if a proficiency list contains a specific proficiency
 * @param {Array<string>} proficiencies - List of proficiencies
 * @param {string} proficiency - Proficiency to check for
 * @returns {boolean} True if proficiency exists in list
 */
export function hasProficiency(proficiencies, proficiency) {
	if (!Array.isArray(proficiencies) || !proficiency) {
		return false;
	}

	const normalized = DataNormalizer.normalizeForLookup(proficiency);
	return proficiencies.some(
		(p) =>
			p &&
			typeof p === 'string' &&
			DataNormalizer.normalizeForLookup(p) === normalized,
	);
}

/**
 * Calculates passive perception score
 * @param {number} wisdomModifier - Wisdom ability modifier
 * @param {number} proficiencyBonus - Character's proficiency bonus
 * @param {boolean} isProficient - Whether proficient in Perception
 * @param {boolean} hasExpertise - Whether has expertise in Perception
 * @returns {number} Passive perception score
 */
export function calculatePassivePerception(
	wisdomModifier,
	proficiencyBonus,
	isProficient = false,
	hasExpertise = false,
) {
	const perceptionModifier = calculateSkillModifier(
		wisdomModifier,
		proficiencyBonus,
		isProficient,
		hasExpertise,
	);
	return 10 + perceptionModifier;
}

/**
 * Calculates passive investigation score
 * @param {number} intelligenceModifier - Intelligence ability modifier
 * @param {number} proficiencyBonus - Character's proficiency bonus
 * @param {boolean} isProficient - Whether proficient in Investigation
 * @param {boolean} hasExpertise - Whether has expertise in Investigation
 * @returns {number} Passive investigation score
 */
export function calculatePassiveInvestigation(
	intelligenceModifier,
	proficiencyBonus,
	isProficient = false,
	hasExpertise = false,
) {
	const investigationModifier = calculateSkillModifier(
		intelligenceModifier,
		proficiencyBonus,
		isProficient,
		hasExpertise,
	);
	return 10 + investigationModifier;
}

/**
 * Calculates passive insight score
 * @param {number} wisdomModifier - Wisdom ability modifier
 * @param {number} proficiencyBonus - Character's proficiency bonus
 * @param {boolean} isProficient - Whether proficient in Insight
 * @param {boolean} hasExpertise - Whether has expertise in Insight
 * @returns {number} Passive insight score
 */
export function calculatePassiveInsight(
	wisdomModifier,
	proficiencyBonus,
	isProficient = false,
	hasExpertise = false,
) {
	const insightModifier = calculateSkillModifier(
		wisdomModifier,
		proficiencyBonus,
		isProficient,
		hasExpertise,
	);
	return 10 + insightModifier;
}
