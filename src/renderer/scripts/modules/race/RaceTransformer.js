/** Transforms race data for display, handling versions, subraces, and implementations. */

/**
 * Checks if a race has subraces
 * @param {Object} race - The race data
 * @returns {boolean} True if race has subraces
 */
export function hasSubraces(race) {
	return race && Array.isArray(race.subraces) && race.subraces.length > 0;
}

/**
 * Checks if a race has versions (_copy property)
 * @param {Object} race - The race data
 * @returns {boolean} True if race has versions
 */
export function hasVersions(race) {
	return race?._copy && Array.isArray(race._copy.versions);
}

/**
 * Extracts base race name from a versioned race
 * @param {Object} race - The race data
 * @returns {string} Base race name
 */
export function getBaseRaceName(race) {
	if (!race) return '';

	// If it has a _copy property, use the name from there
	if (race._copy?.name) {
		return race._copy.name;
	}

	return race.name || '';
}

/**
 * Gets all versions of a race
 * @param {Object} race - The race data
 * @returns {Array<Object>} Array of version objects
 */
export function getVersions(race) {
	if (!hasVersions(race)) {
		return [];
	}

	return race._copy.versions || [];
}

/**
 * Finds a specific version by its version name
 * @param {Object} race - The race data
 * @param {string} versionName - The version name to find
 * @returns {Object|null} The version object or null
 */
export function findVersion(race, versionName) {
	const versions = getVersions(race);
	return versions.find((v) => v._version === versionName) || null;
}

/**
 * Transforms a race with _version into its actual implementation
 * Applies version-specific overrides to the base race data
 * @param {Object} race - The base race data
 * @param {string} versionName - The version to apply
 * @returns {Object} Transformed race data
 */
export function applyVersion(race, versionName) {
	if (!race) return null;

	const version = findVersion(race, versionName);
	if (!version) {
		return race;
	}

	// Create a deep copy of the base race
	const transformed = JSON.parse(JSON.stringify(race));

	// Apply version overrides
	if (version._mod) {
		const mods = version._mod;

		// Handle ability score modifications
		if (mods.ability) {
			transformed.ability = mergeAbilityScores(
				transformed.ability,
				mods.ability,
			);
		}

		// Handle trait modifications
		if (mods.entries) {
			transformed.entries = applyEntryMods(
				transformed.entries || [],
				mods.entries,
			);
		}

		// Handle other property overrides
		for (const [key, value] of Object.entries(mods)) {
			if (key !== 'ability' && key !== 'entries' && key !== '_') {
				transformed[key] = value;
			}
		}
	}

	// Set the version name
	transformed._appliedVersion = versionName;

	return transformed;
}

/**
 * Merges ability score bonuses from version
 * @param {Array} baseAbility - Base ability array
 * @param {Array} modAbility - Modified ability array
 * @returns {Array} Merged ability scores
 */
function mergeAbilityScores(baseAbility, modAbility) {
	if (!modAbility) return baseAbility;
	if (!baseAbility) return modAbility;

	// For now, replace entirely - could be more sophisticated
	return modAbility;
}

/**
 * Applies entry modifications (add, remove, replace)
 * @param {Array} baseEntries - Base entries array
 * @param {Object} modEntries - Modification instructions
 * @returns {Array} Modified entries
 */
function applyEntryMods(baseEntries, modEntries) {
	let entries = [...baseEntries];

	if (modEntries.remove) {
		// Remove entries by index
		entries = entries.filter((_, idx) => !modEntries.remove.includes(idx));
	}

	if (modEntries.replace) {
		// Replace specific entries
		for (const [idx, replacement] of Object.entries(modEntries.replace)) {
			entries[idx] = replacement;
		}
	}

	if (modEntries.add) {
		// Add new entries
		entries = [...entries, ...modEntries.add];
	}

	return entries;
}

/**
 * Gets ability score bonuses from a race
 * @param {Object} race - The race data
 * @returns {Object} Object mapping ability names to bonuses
 */
export function getAbilityBonuses(race) {
	if (!race || !race.ability) {
		return {};
	}

	const bonuses = {};

	for (const abilityEntry of race.ability) {
		// Handle choose-any format
		if (abilityEntry.choose) {
			// This needs to be handled by the UI for user choice
			continue;
		}

		// Handle direct ability bonuses
		for (const [ability, value] of Object.entries(abilityEntry)) {
			if (ability !== 'choose' && typeof value === 'number') {
				bonuses[ability] = (bonuses[ability] || 0) + value;
			}
		}
	}

	return bonuses;
}

/**
 * Checks if race has flexible ability score increases
 * @param {Object} race - The race data
 * @returns {boolean} True if race has choose-any ability bonuses
 */
export function hasFlexibleAbilities(race) {
	if (!race || !race.ability) {
		return false;
	}

	return race.ability.some((entry) => entry.choose);
}

/**
 * Gets the number of flexible ability choices
 * @param {Object} race - The race data
 * @returns {number} Number of flexible ability score increases
 */
export function getFlexibleAbilityCount(race) {
	if (!race || !race.ability) {
		return 0;
	}

	let count = 0;
	for (const entry of race.ability) {
		if (entry.choose?.count) {
			count += entry.choose.count;
		}
	}

	return count;
}

/**
 * Gets speed values from race
 * @param {Object} race - The race data
 * @returns {Object} Speed object with walk, fly, swim, climb, burrow
 */
export function getSpeed(race) {
	if (!race || !race.speed) {
		return { walk: 30 };
	}

	// Handle simple number format
	if (typeof race.speed === 'number') {
		return { walk: race.speed };
	}

	// Handle object format
	if (typeof race.speed === 'object') {
		return { ...race.speed };
	}

	return { walk: 30 };
}

/**
 * Extracts language proficiencies from race
 * @param {Object} race - The race data
 * @returns {Array<string>} Array of language names
 */
export function getLanguages(race) {
	if (!race || !race.languageProficiencies) {
		return [];
	}

	const languages = [];

	for (const langEntry of race.languageProficiencies) {
		// Handle direct language specification (keys are normalized to lowercase)
		if (langEntry.common) languages.push('Common');
		if (langEntry.dwarvish) languages.push('Dwarvish');
		if (langEntry.elvish) languages.push('Elvish');
		if (langEntry.giant) languages.push('Giant');
		if (langEntry.gnomish) languages.push('Gnomish');
		if (langEntry.goblin) languages.push('Goblin');
		if (langEntry.halfling) languages.push('Halfling');
		if (langEntry.orc) languages.push('Orc');

		// Handle any-language choices (check both anyStandard and anystandard)
		const anyStandardCount =
			langEntry.anyStandard || langEntry.anystandard || 0;
		if (anyStandardCount > 0) {
			languages.push(`Any Standard (${anyStandardCount})`);
		}
	}

	return languages;
}

/**
 * Gets size of the race
 * @param {Object} race - The race data
 * @returns {string} Size category (Small, Medium, etc.)
 */
export function getSize(race) {
	if (!race || !race.size) {
		return 'Medium';
	}

	// Handle array format (some races can be multiple sizes)
	if (Array.isArray(race.size)) {
		return race.size[0] || 'Medium';
	}

	return race.size;
}

/**
 * Checks if race has darkvision
 * @param {Object} race - The race data
 * @returns {number} Darkvision range in feet, or 0 if none
 */
export function getDarkvision(race) {
	if (!race || !race.darkvision) {
		return 0;
	}

	return race.darkvision || 0;
}
