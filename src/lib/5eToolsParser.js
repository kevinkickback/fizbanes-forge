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

export const ABILITY_ABBREVIATIONS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ABILITY_NAMES = [
	'Strength',
	'Dexterity',
	'Constitution',
	'Intelligence',
	'Wisdom',
	'Charisma',
];

export function escapeHtml(text) {
	if (!text) return '';
	const str = String(text);
	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	};
	return str.replace(/[&<>"']/g, (m) => map[m]);
}

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

export const SPELL_LEVEL_ORDINALS = [
	'',
	'1st-level',
	'2nd-level',
	'3rd-level',
	'4th-level',
	'5th-level',
	'6th-level',
	'7th-level',
	'8th-level',
	'9th-level',
];

export const CANTRIP_ORDINALS = [
	'Cantrip',
	'1st',
	'2nd',
	'3rd',
	'4th',
	'5th',
	'6th',
	'7th',
	'8th',
	'9th',
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

export const ALIGNMENTS = [
	{ value: 'LG', label: 'Lawful Good' },
	{ value: 'NG', label: 'Neutral Good' },
	{ value: 'CG', label: 'Chaotic Good' },
	{ value: 'LN', label: 'Lawful Neutral' },
	{ value: 'N', label: 'True Neutral' },
	{ value: 'CN', label: 'Chaotic Neutral' },
	{ value: 'LE', label: 'Lawful Evil' },
	{ value: 'NE', label: 'Neutral Evil' },
	{ value: 'CE', label: 'Chaotic Evil' },
	{ value: 'U', label: 'Unaligned' },
	{ value: 'A', label: 'Any alignment' },
];

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

export const DEFAULT_CHARACTER_SIZE = ['M'];

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

export function attAbvToLower(abv) {
	return attAbvToFull(abv).toLowerCase();
}

export function getSchoolName(code) {
	return SPELL_SCHOOLS[code] || code;
}

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

export function capitalize(str) {
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

export function getAbilityAbbrDisplay(abilityNameOrAbbr) {
	if (!abilityNameOrAbbr) return '';
	const abbr = fullAbilityToAbbr(abilityNameOrAbbr);
	return abbr.charAt(0).toUpperCase() + abbr.slice(1);
}

export function levelToProficiencyBonus(level) {
	return Math.ceil(level / 4) + 1;
}

export function unpackUid(uid) {
	if (!uid || typeof uid !== 'string') return { name: '', source: '' };
	const [name, source] = uid.split('|');
	return { name: name?.trim() || '', source: source?.trim() || '' };
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

function ascSort(a, b) {
	if (a === b) return 0;
	return a < b ? -1 : 1;
}

export function ascSortLower(a, b) {
	return ascSort(String(a).toLowerCase(), String(b).toLowerCase());
}

// Export additional constants for external use
export {
	DEFAULT_SOURCE,
	SIZE_ABV_TO_FULL
};

/**
 * Process 5etools entries array into HTML text
 * @param {Object} item - Item with entries property (feat, feature, spell, etc.)
 * @returns {Promise<string>} Processed description HTML
 */
export async function renderEntriesToText(item) {
	const { textProcessor } = await import('./TextProcessor.js');
	const parts = [];

	/**
	 * Recursively process an entry and its children
	 * @param {*} entry - Entry to process (string, object, or array)
	 */
	const processEntry = async (entry) => {
		// Handle string entries
		if (typeof entry === 'string') {
			parts.push(await textProcessor.processString(entry));
			return;
		}

		// Handle array entries
		if (Array.isArray(entry)) {
			for (const subEntry of entry) {
				await processEntry(subEntry);
			}
			return;
		}

		// Handle object entries
		if (typeof entry === 'object' && entry !== null) {
			// Skip reference entries (they don't contain display text)
			if (
				entry.type === 'refSubclassFeature' ||
				entry.type === 'refClassFeature' ||
				entry.type === 'refOptionalfeature'
			) {
				return;
			}

			// Skip table entries (too complex for brief descriptions)
			if (entry.type === 'table') {
				return;
			}

			// Process nested entries recursively
			if (Array.isArray(entry.entries)) {
				for (const subEntry of entry.entries) {
					await processEntry(subEntry);
				}
			}

			// Process items in lists
			if (Array.isArray(entry.items)) {
				for (const item of entry.items) {
					await processEntry(item);
				}
			}
		}
	};

	// Process the main entries
	if (Array.isArray(item.entries)) {
		for (const entry of item.entries) {
			await processEntry(entry);
		}
	} else if (typeof item.entries === 'string') {
		parts.push(await textProcessor.processString(item.entries));
	}

	return parts.length
		? parts.join(' ')
		: '<span class="text-muted small">No description available.</span>';
}
