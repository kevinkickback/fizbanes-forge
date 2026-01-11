/** Standard proficiency options for D&D 5e character building. */

import { LANGUAGES_EXOTIC, LANGUAGES_STANDARD } from './5eToolsParser.js';

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

export const STANDARD_LANGUAGE_OPTIONS = Object.freeze([
	...LANGUAGES_STANDARD,
	...LANGUAGES_EXOTIC,
]);

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

export const MUSICAL_INSTRUMENTS = Object.freeze([
	'Bagpipes',
	'Drum',
	'Dulcimer',
	'Flute',
	'Lute',
	'Lyre',
	'Horn',
	'Pan flute',
	'Shawm',
	'Viol',
]);

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

export function isValidSkill(skillName) {
	return STANDARD_SKILL_OPTIONS.includes(skillName);
}

export function isValidTool(toolName) {
	return STANDARD_TOOL_OPTIONS.includes(toolName);
}

export function isValidLanguage(languageName) {
	return STANDARD_LANGUAGE_OPTIONS.includes(languageName);
}
