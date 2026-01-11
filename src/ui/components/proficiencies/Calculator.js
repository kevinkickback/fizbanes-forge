// Pure proficiency bonus and modifier calculations

import {
	SKILL_TO_ABILITY,
	ascSortLower,
	attAbvToFull,
	formatModifierNumber,
} from '../../../lib/5eToolsParser.js';
import DataNormalizer from '../../../lib/DataNormalizer.js';

export const SAVING_THROW_ABILITIES = {
	strength: 'strength',
	dexterity: 'dexterity',
	constitution: 'constitution',
	intelligence: 'intelligence',
	wisdom: 'wisdom',
	charisma: 'charisma',
};

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

export function formatModifier(modifier) {
	// Use 5eToolsParser helper for consistent formatting
	return formatModifierNumber(modifier);
}

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
