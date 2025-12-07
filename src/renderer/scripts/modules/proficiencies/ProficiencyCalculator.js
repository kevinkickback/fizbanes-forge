/** Pure proficiency bonus and modifier calculations. */

/**
 * Skill to ability mapping
 */
export const SKILL_ABILITIES = {
	acrobatics: 'dexterity',
	'animal handling': 'wisdom',
	arcana: 'intelligence',
	athletics: 'strength',
	deception: 'charisma',
	history: 'intelligence',
	insight: 'wisdom',
	intimidation: 'charisma',
	investigation: 'intelligence',
	medicine: 'wisdom',
	nature: 'intelligence',
	perception: 'wisdom',
	performance: 'charisma',
	persuasion: 'charisma',
	religion: 'intelligence',
	'sleight of hand': 'dexterity',
	stealth: 'dexterity',
	survival: 'wisdom',
};

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
 * Calculates proficiency bonus based on character level
 * @param {number} level - Character level (1-20)
 * @returns {number} Proficiency bonus (2-6)
 */
export function calculateProficiencyBonus(level) {
	if (typeof level !== 'number' || level < 1) {
		return 2;
	}

	if (level >= 17) return 6;
	if (level >= 13) return 5;
	if (level >= 9) return 4;
	if (level >= 5) return 3;
	return 2;
}

/**
 * Gets the ability associated with a skill
 * @param {string} skillName - The skill name
 * @returns {string|null} The ability name or null if not found
 */
export function getSkillAbility(skillName) {
	if (!skillName) return null;
	const normalized = skillName.toLowerCase().trim();
	return SKILL_ABILITIES[normalized] || null;
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
 */
export function formatModifier(modifier) {
	if (typeof modifier !== 'number' || Number.isNaN(modifier)) {
		return '+0';
	}

	if (modifier >= 0) {
		return `+${modifier}`;
	}

	return `${modifier}`;
}

/**
 * Merges multiple proficiency lists, removing duplicates
 * @param {...Array<string>} proficiencyLists - Multiple arrays of proficiencies
 * @returns {Array<string>} Merged list without duplicates
 */
export function mergeProficiencies(...proficiencyLists) {
	const merged = new Set();

	for (const list of proficiencyLists) {
		if (Array.isArray(list)) {
			for (const item of list) {
				if (item && typeof item === 'string') {
					merged.add(item.toLowerCase().trim());
				}
			}
		}
	}

	return Array.from(merged).sort();
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

	const normalized = proficiency.toLowerCase().trim();
	return proficiencies.some(
		(p) => p && typeof p === 'string' && p.toLowerCase().trim() === normalized,
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

