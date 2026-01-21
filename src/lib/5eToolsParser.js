/** Selected utility functions extracted from 5etools for parsing D&D data. */

const SIZE_ABV_TO_FULL = {
	F: 'Fine',
	D: 'Diminutive',
	T: 'Tiny',
	S: 'Small',
	M: 'Medium',
	L: 'Large',
	H: 'Huge',
	G: 'Gargantuan',
	C: 'Colossal',
	V: 'Varies',
};

const ATB_ABV_TO_FULL = {
	str: 'Strength',
	dex: 'Dexterity',
	con: 'Constitution',
	int: 'Intelligence',
	wis: 'Wisdom',
	cha: 'Charisma',
};

export const ABILITY_NAMES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

const SPELL_SCHOOLS = {
	A: 'Abjuration',
	C: 'Conjuration',
	D: 'Divination',
	E: 'Enchantment',
	I: 'Illusion',
	N: 'Necromancy',
	T: 'Transmutation',
	V: 'Evocation',
};

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

const SPEED_MODES = ['walk', 'burrow', 'climb', 'fly', 'swim'];

const SKILL_TO_ABILITY = {
	acrobatics: 'dex',
	'animal handling': 'wis',
	arcana: 'int',
	athletics: 'str',
	deception: 'cha',
	history: 'int',
	insight: 'wis',
	intimidation: 'cha',
	investigation: 'int',
	medicine: 'wis',
	nature: 'int',
	perception: 'wis',
	performance: 'cha',
	persuasion: 'cha',
	religion: 'int',
	'sleight of hand': 'dex',
	stealth: 'dex',
	survival: 'wis',
};

const LANGUAGES_STANDARD = [
	'Common',
	'Dwarvish',
	'Elvish',
	'Giant',
	'Gnomish',
	'Goblin',
	'Halfling',
	'Orc',
];

const LANGUAGES_EXOTIC = [
	'Abyssal',
	'Celestial',
	'Draconic',
	'Deep Speech',
	'Infernal',
	'Primordial',
	'Sylvan',
	'Undercommon',
];

const LANGUAGES_SECRET = ['Druidic', "Thieves' Cant"];

/** Default character size (Medium). */
export const DEFAULT_CHARACTER_SIZE = ['M'];

/** Default character speed (30 ft. walking). */
export const DEFAULT_CHARACTER_SPEED = { walk: 30 };

const DEFAULT_SOURCE = 'PHB';

const SOURCES = {
	PHB: 'PHB',
	XPHB: 'XPHB',
	DMG: 'DMG',
	XDMG: 'XDMG',
	MM: 'MM',
	XMM: 'XMM',
	SCAG: 'SCAG',
	XGE: 'XGE',
	TCE: 'TCE',
	VRGR: 'VRGR',
	MPMM: 'MPMM',
};

const SOURCE_TO_FULL = {
	PHB: "Player's Handbook (2014)",
	XPHB: "Player's Handbook (2024)",
	DMG: "Dungeon Master's Guide (2014)",
	XDMG: "Dungeon Master's Guide (2024)",
	MM: 'Monster Manual (2014)',
	XMM: 'Monster Manual (2024)',
	SCAG: "Sword Coast Adventurer's Guide",
	XGE: "Xanathar's Guide to Everything",
	TCE: "Tasha's Cauldron of Everything",
	VRGR: "Van Richten's Guide to Ravenloft",
	MPMM: 'Mordenkainen Presents: Monsters of the Multiverse',
};

const SOURCE_TO_ABV = {
	PHB: 'PHB',
	XPHB: "PHB'24",
	DMG: 'DMG',
	XDMG: "DMG'24",
	MM: 'MM',
	XMM: "MM'24",
	SCAG: 'SCAG',
	XGE: 'XGE',
	TCE: 'TCE',
	VRGR: 'VRGR',
	MPMM: 'MPMM',
};

export function sizeAbvToFull(abv) {
	if (!abv) return '';
	return SIZE_ABV_TO_FULL[abv] || abv;
}

export function getAbilityModNumber(abilityScore) {
	return Math.floor((abilityScore - 10) / 2);
}

export function getAbilityModifier(abilityScore) {
	let modifier = getAbilityModNumber(abilityScore);
	if (modifier >= 0) modifier = `+${modifier}`;
	return `${modifier}`;
}

export function formatModifierNumber(modifier) {
	if (typeof modifier !== 'number' || Number.isNaN(modifier)) {
		return '+0';
	}
	if (modifier >= 0) {
		return `+${modifier}`;
	}
	return `${modifier}`;
}

export function attAbvToFull(abv) {
	if (!abv) return '';
	return ATB_ABV_TO_FULL[abv.toLowerCase()] || abv;
}

export function getSchoolName(code) {
	return SPELL_SCHOOLS[code] || code;
}

/** Convert array of ability abbreviations to choice text (e.g., "Strength or Dexterity modifier (your choice)"). */
export function attrChooseToFull(attList) {
	if (!attList || !Array.isArray(attList) || attList.length === 0) {
		return '';
	}

	if (attList.length === 1) {
		const fullName = attAbvToFull(attList[0]);
		return `${fullName}${attList[0] === 'spellcasting' ? ' ability' : ''} modifier`;
	}

	const attsTemp = attList.map((att) => attAbvToFull(att));
	return `${attsTemp.join(' or ')} modifier (your choice)`;
}

/** Format speed data to string (e.g., "30 ft., fly 60 ft."). */
export function getSpeedString(ent) {
	// Handle simple number
	if (typeof ent === 'number') {
		return `${ent} ft.`;
	}

	// Handle object with speed property
	const speed = ent?.speed;
	if (!speed) return '—';

	// Handle simple speed number
	if (typeof speed === 'number') {
		return `${speed} ft.`;
	}

	// Handle complex speed object
	if (typeof speed === 'object') {
		const stack = [];
		const unit = 'ft.';

		// Process each speed mode
		SPEED_MODES.filter((mode) => speed[mode] !== undefined).forEach((mode) => {
			const modeSpeed = speed[mode];

			// Skip if explicitly hidden
			if (speed.hidden?.includes(mode)) return;

			// Skip walk speed of 0 if requested
			if (mode === 'walk' && modeSpeed === 0) return;

			const speedName = mode === 'walk' ? '' : `${mode} `;

			if (typeof modeSpeed === 'number' || modeSpeed === true) {
				const val = modeSpeed === true ? 0 : modeSpeed;
				if (val === 0 && mode !== 'walk') {
					stack.push(`${speedName}equal to your walking speed`);
				} else {
					stack.push(`${speedName}${val} ${unit}`);
				}
			} else if (typeof modeSpeed === 'object') {
				const num = modeSpeed.number || 0;
				const condition = modeSpeed.condition ? ` ${modeSpeed.condition}` : '';
				stack.push(`${speedName}${num} ${unit}${condition}`);
			}
		});

		// Handle "choose" speeds
		if (speed.choose && !speed.hidden?.includes('choose')) {
			const fromModes = speed.choose.from
				.sort()
				.map((prop) => (prop === 'walk' ? '' : prop))
				.filter(Boolean)
				.join(' or ');
			stack.push(
				`${fromModes} ${speed.choose.amount} ${unit}${speed.choose.note ? ` ${speed.choose.note}` : ''}`,
			);
		}

		const result = stack.join(', ');
		return result + (speed.note ? ` ${speed.note}` : '');
	}

	return '—';
}

export function monTypeToFullObj(type) {
	const out = {
		types: [],
		tags: [],
		asText: '',
		asTextShort: '',
	};

	if (type == null) return out;

	// Simple string type (e.g., "humanoid")
	if (typeof type === 'string') {
		out.types = [type];
		out.asText = capitalize(type);
		out.asTextShort = out.asText;
		return out;
	}

	// Complex type object
	if (type.type) {
		if (type.type.choose) {
			out.types = type.type.choose;
		} else {
			out.types = [type.type];
		}
	}

	// Handle swarm
	if (type.swarmSize) {
		out.tags.push('swarm');
		const sizeText = sizeAbvToFull(type.swarmSize);
		const typeText = out.types
			.map((t) => pluralize(capitalize(t)))
			.join(' or ');
		out.asText = `swarm of ${sizeText} ${typeText}`;
		out.asTextShort = out.asText;
		return out;
	}

	// Handle tags
	if (type.tags?.length) {
		out.tags = type.tags;
		const tagText = type.tags.map(capitalize).join(', ');
		out.asText = `${out.types.map(capitalize).join(' or ')} (${tagText})`;
	} else {
		out.asText = out.types.map(capitalize).join(' or ');
	}

	out.asTextShort = out.asText;
	return out;
}

function capitalize(str) {
	if (!str) return '';
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function toTitleCase(str) {
	if (typeof str !== 'string' || str.length === 0) {
		return '';
	}
	return str
		.toLowerCase()
		.split(' ')
		.map((word) => capitalize(word))
		.join(' ');
}

export function toSentenceCase(str) {
	if (typeof str !== 'string' || str.length === 0) {
		return '';
	}
	return str.charAt(0).toUpperCase() + str.slice(1);
}

function pluralize(str) {
	if (!str) return '';
	// Simple rules for common D&D types
	if (str.endsWith('s')) return str;
	if (str.endsWith('y')) return `${str.slice(0, -1)}ies`;
	return `${str}s`;
}

export function alignmentAbvToFull(alignment) {
	if (!alignment) return null;

	const ALIGNMENT_MAP = {
		L: 'lawful',
		N: 'neutral',
		NX: 'neutral (law/chaos axis)',
		NY: 'neutral (good/evil axis)',
		C: 'chaotic',
		G: 'good',
		E: 'evil',
		U: 'unaligned',
		A: 'any alignment',
	};

	if (typeof alignment === 'object') {
		if (alignment.special != null) return alignment.special;
		// Handle complex alignment with chance
		const alignText = alignment.alignment
			? alignment.alignment
				.map((a) => ALIGNMENT_MAP[a.toUpperCase()] || a)
				.join(' ')
			: '';
		const chanceText = alignment.chance ? ` (${alignment.chance}%)` : '';
		const noteText = alignment.note ? ` (${alignment.note})` : '';
		return `${alignText}${chanceText}${noteText}`;
	}

	return ALIGNMENT_MAP[alignment.toUpperCase()] || alignment;
}

export function getOrdinalForm(i) {
	i = Number(i);
	if (Number.isNaN(i)) return '';
	const j = i % 10;
	const k = i % 100;
	if (j === 1 && k !== 11) return `${i}st`;
	if (j === 2 && k !== 12) return `${i}nd`;
	if (j === 3 && k !== 13) return `${i}rd`;
	return `${i}th`;
}

export function fullAbilityToAbbr(ability) {
	if (!ability) return '';
	const abilityLower = ability.toLowerCase();
	const FULL_TO_ABV = {
		strength: 'str',
		dexterity: 'dex',
		constitution: 'con',
		intelligence: 'int',
		wisdom: 'wis',
		charisma: 'cha',
	};
	return FULL_TO_ABV[abilityLower] || abilityLower.substring(0, 3);
}

export function levelToProficiencyBonus(level) {
	return Math.ceil(level / 4) + 1;
}

export function skillToAbility(skill) {
	return SKILL_TO_ABILITY[skill.toLowerCase()] || null;
}

export function abilityToSkills(ability) {
	const abilityLower = ability.toLowerCase();
	return Object.entries(SKILL_TO_ABILITY)
		.filter(([, abilityAbv]) => abilityAbv === abilityLower)
		.map(([skill]) => skill);
}

export function packUid(entity) {
	if (!entity?.name || !entity?.source) return '';
	return `${entity.name.toLowerCase().trim()}|${entity.source.toLowerCase().trim()}`;
}

export function unpackUid(uid) {
	if (!uid || typeof uid !== 'string') return { name: '', source: '' };
	const [name, source] = uid.split('|');
	return { name: name?.trim() || '', source: source?.trim() || '' };
}

export function sourceToFull(source) {
	if (!source) return '';
	const sourceUpper = source.toUpperCase();
	return SOURCE_TO_FULL[sourceUpper] || source;
}

export function sourceToAbv(source) {
	if (!source) return '';
	const sourceUpper = source.toUpperCase();
	return SOURCE_TO_ABV[sourceUpper] || source;
}

export function isOneDnD(source) {
	if (!source) return false;
	const sourceUpper = source.toUpperCase();
	return sourceUpper.startsWith('X'); // XPHB, XDMG, XMM
}

export function numberToWords(num, opts = {}) {
	if (Number.isNaN(num)) return '';

	const ones = [
		'',
		'one',
		'two',
		'three',
		'four',
		'five',
		'six',
		'seven',
		'eight',
		'nine',
	];
	const tens = [
		'',
		'',
		'twenty',
		'thirty',
		'forty',
		'fifty',
		'sixty',
		'seventy',
		'eighty',
		'ninety',
	];
	const teens = [
		'ten',
		'eleven',
		'twelve',
		'thirteen',
		'fourteen',
		'fifteen',
		'sixteen',
		'seventeen',
		'eighteen',
		'nineteen',
	];

	if (opts.isOrdinal) {
		const ordinals = {
			one: 'first',
			two: 'second',
			three: 'third',
			five: 'fifth',
			eight: 'eighth',
			nine: 'ninth',
			twelve: 'twelfth',
		};
		const text = numberToWords(num);
		const words = text.split(' ');
		const lastWord = words[words.length - 1];

		if (Object.hasOwn(ordinals, lastWord)) {
			words[words.length - 1] = ordinals[lastWord];
			return words.join(' ');
		}
		if (lastWord.endsWith('y')) {
			words[words.length - 1] = `${lastWord.slice(0, -1)}ieth`;
			return words.join(' ');
		}
		return `${text}th`;
	}

	if (num < 10) return ones[num];
	if (num < 20) return teens[num - 10];
	if (num < 100) {
		const ten = Math.floor(num / 10);
		const one = num % 10;
		return `${tens[ten]}${one > 0 ? `-${ones[one]}` : ''}`;
	}

	return String(num);
}

export function numberToVulgarFraction(num) {
	const fractions = {
		0.125: '⅛',
		0.25: '¼',
		0.333: '⅓',
		0.5: '½',
		0.666: '⅔',
		0.75: '¾',
	};
	const rounded = Math.round(num * 1000) / 1000;
	return fractions[rounded] || String(num);
}

export function parseAbilityImprovements(improvementArray) {
	if (!Array.isArray(improvementArray)) {
		return { fixed: {}, choices: [] };
	}

	const fixed = {};
	const choices = [];

	for (const improvement of improvementArray) {
		if (improvement.choose) {
			// This is a choice
			choices.push({
				options: improvement.choose.from || [],
				count: improvement.choose.count || 1,
				amount: improvement.choose.amount || 1,
			});
		} else {
			// Fixed bonuses
			for (const [ability, value] of Object.entries(improvement)) {
				if (ability !== 'choose') {
					fixed[ability] = (fixed[ability] || 0) + value;
				}
			}
		}
	}

	return { fixed, choices };
}

export function formatAbilityImprovements(parsed) {
	const parts = [];

	// Add fixed bonuses
	for (const [ability, value] of Object.entries(parsed.fixed)) {
		const fullName = attAbvToFull(ability);
		parts.push(`${fullName} +${value}`);
	}

	// Add choices
	for (const choice of parsed.choices) {
		const options = choice.options.map((a) => attAbvToFull(a)).join(', ');
		const amount = choice.amount;
		const count = choice.count;
		parts.push(
			`choose ${count > 1 ? `${numberToWords(count)} from ` : ''}${options} +${amount}`,
		);
	}

	return parts.join(', ');
}

export function ascSort(a, b) {
	if (a === b) return 0;
	return a < b ? -1 : 1;
}

export function ascSortLower(a, b) {
	return ascSort(String(a).toLowerCase(), String(b).toLowerCase());
}

export function ascSortByProp(prop) {
	return (a, b) => ascSort(a[prop], b[prop]);
}

export function ascSortByPropLower(prop) {
	return (a, b) => ascSortLower(a[prop], b[prop]);
}

// Export additional constants for external use
export {
	DEFAULT_SOURCE,
	LANGUAGES_EXOTIC,
	LANGUAGES_SECRET,
	LANGUAGES_STANDARD,
	SIZE_ABV_TO_FULL,
	SKILL_TO_ABILITY, SOURCES, SOURCE_TO_ABV,
	SOURCE_TO_FULL, SPEED_MODES
};

export default {
	sizeAbvToFull,
	getAbilityModNumber,
	getAbilityModifier,
	formatModifierNumber,
	attAbvToFull,
	attrChooseToFull,
	getSpeedString,
	monTypeToFullObj,
	alignmentAbvToFull,
	getOrdinalForm,
	fullAbilityToAbbr,
	levelToProficiencyBonus,
	skillToAbility,
	abilityToSkills,
	packUid,
	unpackUid,
	sourceToFull,
	sourceToAbv,
	isOneDnD,
	numberToWords,
	numberToVulgarFraction,
	parseAbilityImprovements,
	formatAbilityImprovements,
	toTitleCase,
	toSentenceCase,
	ascSort,
	ascSortLower,
	ascSortByProp,
	ascSortByPropLower,
};
