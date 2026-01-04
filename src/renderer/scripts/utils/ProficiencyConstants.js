/**
 * Standard proficiency options for D&D 5e character building.
 *
 * These constants represent the core proficiency options available in the game,
 * matching the 5etools JSON data format. They are used across multiple services
 * for validation, display, and selection UI.
 *
 * @module ProficiencyConstants
 */

import { LANGUAGES_EXOTIC, LANGUAGES_STANDARD } from './5eToolsParser.js';

/**
 * Standard skill proficiency options (matching 5etools JSON format).
 * These are the 18 core D&D 5e skills tied to ability scores.
 *
 * @type {ReadonlyArray<string>}
 * @constant
 */
export const STANDARD_SKILL_OPTIONS = Object.freeze([
	'Acrobatics',
	'Animal Handling',
	'Arcana',
	'Athletics',
	'Deception',
	'History',
	'Insight',
	'Intimidation',
	'Investigation',
	'Medicine',
	'Nature',
	'Perception',
	'Performance',
	'Persuasion',
	'Religion',
	'Sleight of Hand',
	'Stealth',
	'Survival',
]);

/**
 * Standard language proficiency options (matching 5etools JSON format).
 * These are the core D&D 5e languages available to player characters.
 * Imported from 5eToolsParser for canonical language list.
 *
 * @type {ReadonlyArray<string>}
 * @constant
 */
export const STANDARD_LANGUAGE_OPTIONS = Object.freeze([
	...LANGUAGES_STANDARD,
	...LANGUAGES_EXOTIC,
]);

/**
 * Standard tool proficiency options (matching 5etools JSON format).
 * These are the 24 core D&D 5e tools, kits, and artisan's tools available.
 *
 * @type {ReadonlyArray<string>}
 * @constant
 */
export const STANDARD_TOOL_OPTIONS = Object.freeze([
	"Alchemist's supplies",
	"Brewer's supplies",
	"Calligrapher's supplies",
	"Carpenter's tools",
	"Cartographer's tools",
	"Cobbler's tools",
	"Cook's utensils",
	"Glassblower's tools",
	"Jeweler's tools",
	"Leatherworker's tools",
	"Mason's tools",
	"Painter's supplies",
	"Potter's tools",
	"Smith's tools",
	"Tinker's tools",
	"Weaver's tools",
	"Woodcarver's tools",
	'Disguise kit',
	'Forgery kit',
	'Herbalism kit',
	"Navigator's tools",
	"Poisoner's kit",
	"Thieves' tools",
	'Musical instrument',
]);

/**
 * List of all artisan's tools in D&D 5e
 * This is a subset of STANDARD_TOOL_OPTIONS used when a class/race/background
 * grants "any artisan's tools" as a choice
 */
export const ARTISAN_TOOLS = Object.freeze([
	"Alchemist's supplies",
	"Brewer's supplies",
	"Calligrapher's supplies",
	"Carpenter's tools",
	"Cartographer's tools",
	"Cobbler's tools",
	"Cook's utensils",
	"Glassblower's tools",
	"Jeweler's tools",
	"Leatherworker's tools",
	"Mason's tools",
	"Painter's supplies",
	"Potter's tools",
	"Smith's tools",
	"Tinker's tools",
	"Weaver's tools",
	"Woodcarver's tools",
]);

/**
 * Validates if a skill name is a standard D&D 5e skill.
 *
 * @param {string} skillName - The skill name to validate
 * @returns {boolean} True if the skill is in the standard list
 *
 * @example
 * isValidSkill('Acrobatics'); // true
 * isValidSkill('Cooking'); // false
 */
export function isValidSkill(skillName) {
	return STANDARD_SKILL_OPTIONS.includes(skillName);
}

/**
 * Validates if a tool name is a standard D&D 5e tool.
 *
 * @param {string} toolName - The tool name to validate
 * @returns {boolean} True if the tool is in the standard list
 *
 * @example
 * isValidTool("Smith's tools"); // true
 * isValidTool("Magic wand"); // false
 */
export function isValidTool(toolName) {
	return STANDARD_TOOL_OPTIONS.includes(toolName);
}

/**
 * Validates if a language name is a standard D&D 5e language.
 *
 * @param {string} languageName - The language name to validate
 * @returns {boolean} True if the language is in the standard list
 *
 * @example
 * isValidLanguage('Elvish'); // true
 * isValidLanguage('Klingon'); // false
 */
export function isValidLanguage(languageName) {
	return STANDARD_LANGUAGE_OPTIONS.includes(languageName);
}
