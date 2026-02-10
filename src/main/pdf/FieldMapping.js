import path from 'node:path';
import { MainLogger } from '../Logger.js';

// ── Shared Constants ──────────────────────────────────────────────────────────

const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const ABILITY_ABBR = { strength: 'Str', dexterity: 'Dex', constitution: 'Con', intelligence: 'Int', wisdom: 'Wis', charisma: 'Cha' };

const SKILL_ABILITY_MAP = {
    'Acrobatics': 'dexterity',
    'Animal Handling': 'wisdom',
    'Arcana': 'intelligence',
    'Athletics': 'strength',
    'Deception': 'charisma',
    'History': 'intelligence',
    'Insight': 'wisdom',
    'Intimidation': 'charisma',
    'Investigation': 'intelligence',
    'Medicine': 'wisdom',
    'Nature': 'intelligence',
    'Perception': 'wisdom',
    'Performance': 'charisma',
    'Persuasion': 'charisma',
    'Religion': 'intelligence',
    'Sleight of Hand': 'dexterity',
    'Stealth': 'dexterity',
    'Survival': 'wisdom',
};

// ── 2014 MPMB Character Sheet Field Maps ──────────────────────────────────────

const MPMB_SKILL_FIELD_MAP = {
    'Acrobatics': { modifier: 'Acr', proficiency: 'Acr Prof' },
    'Animal Handling': { modifier: 'Ani', proficiency: 'Ani Prof' },
    'Arcana': { modifier: 'Arc', proficiency: 'Arc Prof' },
    'Athletics': { modifier: 'Ath', proficiency: 'Ath Prof' },
    'Deception': { modifier: 'Dec', proficiency: 'Dec Prof' },
    'History': { modifier: 'His', proficiency: 'His Prof' },
    'Insight': { modifier: 'Ins', proficiency: 'Ins Prof' },
    'Intimidation': { modifier: 'Inti', proficiency: 'Inti Prof' },
    'Investigation': { modifier: 'Inv', proficiency: 'Inv Prof' },
    'Medicine': { modifier: 'Med', proficiency: 'Med Prof' },
    'Nature': { modifier: 'Nat', proficiency: 'Nat Prof' },
    'Perception': { modifier: 'Perc', proficiency: 'Perc Prof' },
    'Performance': { modifier: 'Perf', proficiency: 'Perf Prof' },
    'Persuasion': { modifier: 'Pers', proficiency: 'Pers Prof' },
    'Religion': { modifier: 'Rel', proficiency: 'Rel Prof' },
    'Sleight of Hand': { modifier: 'Sle', proficiency: 'Sle Prof' },
    'Stealth': { modifier: 'Ste', proficiency: 'Ste Prof' },
    'Survival': { modifier: 'Sur', proficiency: 'Sur Prof' },
};

const MPMB_SAVE_FIELD_MAP = {
    strength: { modifier: 'Str ST Mod', proficiency: 'Str ST Prof' },
    dexterity: { modifier: 'Dex ST Mod', proficiency: 'Dex ST Prof' },
    constitution: { modifier: 'Con ST Mod', proficiency: 'Con ST Prof' },
    intelligence: { modifier: 'Int ST Mod', proficiency: 'Int ST Prof' },
    wisdom: { modifier: 'Wis ST Mod', proficiency: 'Wis ST Prof' },
    charisma: { modifier: 'Cha ST Mod', proficiency: 'Cha ST Prof' },
};

// ── 2024 WotC Character Sheet Field Maps ──────────────────────────────────────
// Generic Text_N / Checkbox_N fields mapped via positional analysis.

const WOTC_2024_SKILL_FIELD_MAP = {
    'Acrobatics': { modifier: 'Text_31', proficiency: 'Checkbox_31' },
    'Animal Handling': { modifier: 'Text_32', proficiency: 'Checkbox_19' },
    'Arcana': { modifier: 'Text_33', proficiency: 'Checkbox_20' },
    'Athletics': { modifier: 'Text_34', proficiency: 'Checkbox_21' },
    'Deception': { modifier: 'Text_35', proficiency: 'Checkbox_22' },
    'History': { modifier: 'Text_36', proficiency: 'Checkbox_23' },
    'Insight': { modifier: 'Text_47', proficiency: 'Checkbox_30' },
    'Intimidation': { modifier: 'Text_37', proficiency: 'Checkbox_14' },
    'Investigation': { modifier: 'Text_38', proficiency: 'Checkbox_15' },
    'Medicine': { modifier: 'Text_39', proficiency: 'Checkbox_16' },
    'Nature': { modifier: 'Text_40', proficiency: 'Checkbox_17' },
    'Perception': { modifier: 'Text_41', proficiency: 'Checkbox_18' },
    'Performance': { modifier: 'Text_42', proficiency: 'Checkbox_24' },
    'Persuasion': { modifier: 'Text_43', proficiency: 'Checkbox_25' },
    'Religion': { modifier: 'Text_44', proficiency: 'Checkbox_26' },
    'Sleight of Hand': { modifier: 'Text_45', proficiency: 'Checkbox_27' },
    'Stealth': { modifier: 'Text_46', proficiency: 'Checkbox_28' },
    'Survival': { modifier: 'Text_52', proficiency: 'Checkbox_29' },
};

const WOTC_2024_SAVE_FIELD_MAP = {
    strength: { modifier: 'Text_54', proficiency: 'Checkbox_8' },
    dexterity: { modifier: 'Text_53', proficiency: 'Checkbox_9' },
    constitution: { modifier: 'Text_51', proficiency: 'Checkbox_10' },
    intelligence: { modifier: 'Text_48', proficiency: 'Checkbox_11' },
    wisdom: { modifier: 'Text_49', proficiency: 'Checkbox_12' },
    charisma: { modifier: 'Text_50', proficiency: 'Checkbox_13' },
};

// ── Template Detection ─────────────────────────────────────────────────────────

function detectTemplate(templatePath) {
    if (!templatePath) return '2014';
    const filename = path.basename(templatePath).toLowerCase();
    if (filename.includes('2024')) return '2024';
    return '2014';
}

/**
 * Calculate the ability modifier for a given score.
 * @param {number} score - The ability score
 * @returns {number} The modifier
 */
export function calcModifier(score) {
    return Math.floor((score - 10) / 2);
}

/**
 * Format a modifier with a leading sign (e.g. "+2", "-1", "+0").
 * @param {number} mod
 * @returns {string}
 */
export function formatModifier(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Compute the total ability score from base + bonuses.
 * @param {Object} characterData - Serialized character JSON
 * @param {string} ability - Ability name (lowercase)
 * @returns {number}
 */
export function getFinalAbilityScore(characterData, ability) {
    const base = characterData.abilityScores?.[ability] || 0;
    const bonuses = characterData.abilityBonuses?.[ability] || [];
    const totalBonus = bonuses.reduce((sum, b) => sum + (b.value || 0), 0);
    return base + totalBonus;
}

/**
 * Calculate proficiency bonus from total character level.
 * @param {Object} characterData
 * @returns {number}
 */
export function getProficiencyBonus(characterData) {
    const totalLevel = getTotalLevel(characterData);
    return Math.floor((totalLevel - 1) / 4) + 2;
}

/**
 * Calculate total character level from progression classes.
 * @param {Object} characterData
 * @returns {number}
 */
export function getTotalLevel(characterData) {
    const classes = characterData.progression?.classes;
    if (!Array.isArray(classes) || classes.length === 0) return 1;
    return classes.reduce((sum, c) => sum + (c.levels || 0), 0) || 1;
}

/**
 * Format class/level string (e.g. "Fighter 5 / Wizard 3").
 * @param {Object} characterData
 * @returns {string}
 */
export function formatClassLevel(characterData) {
    const classes = characterData.progression?.classes;
    if (!Array.isArray(classes) || classes.length === 0) return '';
    return classes
        .filter(c => c.name)
        .map(c => {
            let entry = c.name;
            if (c.levels) entry += ` ${c.levels}`;
            if (c.subclass) entry += ` (${c.subclass})`;
            return entry;
        })
        .join(' / ');
}

function formatHitDice(characterData) {
    const classes = characterData.progression?.classes;
    if (!Array.isArray(classes) || classes.length === 0) return '';
    return classes
        .filter(c => c.name && c.levels)
        .map(c => `${c.levels}d${c.hitDice || 8}`)
        .join(' / ');
}

function formatRace(characterData) {
    const race = characterData.race;
    if (!race) return '';
    const parts = [];
    if (race.subrace) parts.push(race.subrace);
    if (race.name) parts.push(race.name);
    return parts.join(' ');
}

function formatBackground(characterData) {
    const bg = characterData.background;
    if (!bg) return '';
    if (typeof bg === 'string') return bg;
    return bg.name || '';
}

function formatAllProficiencies(characterData) {
    const profs = characterData.proficiencies;
    if (!profs) return '';
    const sections = [];
    if (profs.armor?.length) sections.push(`Armor: ${profs.armor.join(', ')}`);
    if (profs.weapons?.length) sections.push(`Weapons: ${profs.weapons.join(', ')}`);
    if (profs.tools?.length) sections.push(`Tools: ${profs.tools.join(', ')}`);
    if (profs.languages?.length) sections.push(`Languages: ${profs.languages.join(', ')}`);
    return sections.join('\n');
}

function formatFeaturesAndTraits(characterData) {
    const parts = [];
    const features = characterData.features;
    if (features?.darkvision) parts.push(`Darkvision ${features.darkvision} ft.`);
    if (features?.resistances?.length) {
        parts.push(`Resistances: ${features.resistances.join(', ')}`);
    }
    if (features?.traits && typeof features.traits === 'object') {
        for (const [name, data] of Object.entries(features.traits)) {
            const desc = typeof data === 'object' ? data.description : data;
            parts.push(desc ? `${name}: ${desc}` : name);
        }
    }
    if (characterData.feats?.length) {
        for (const feat of characterData.feats) {
            const name = typeof feat === 'string' ? feat : feat?.name;
            if (name) parts.push(name);
        }
    }
    return parts.join('\n');
}

function formatEquipment(characterData) {
    const items = characterData.inventory?.items;
    if (!Array.isArray(items) || items.length === 0) return '';
    return items
        .map(item => {
            const qty = item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : '';
            return `${item.name || 'Unknown'}${qty}`;
        })
        .join('\n');
}

// ── Hit Die Defaults ──────────────────────────────────────────────────────────

const CLASS_HIT_DICE = {
    barbarian: 12, bard: 8, cleric: 8, druid: 8, fighter: 10,
    monk: 8, paladin: 10, ranger: 10, rogue: 8,
    sorcerer: 6, warlock: 8, wizard: 6,
};

function getClassHitDie(cls) {
    if (cls.hitDice) return cls.hitDice;
    return CLASS_HIT_DICE[cls.name?.toLowerCase()] || 8;
}

/**
 * Compute max HP from class progression when hitPoints.max is 0.
 * Level 1: full hit die + CON mod. Subsequent: average hit die + CON mod.
 */
function computeFallbackMaxHP(characterData, conMod) {
    const classes = characterData.progression?.classes;
    if (!Array.isArray(classes) || classes.length === 0) return 0;

    let hp = 0;
    let isFirstLevel = true;
    for (const cls of classes) {
        const hitDie = getClassHitDie(cls);
        const levels = cls.levels || 0;
        for (let i = 0; i < levels; i++) {
            if (isFirstLevel) {
                hp += hitDie + conMod;
                isFirstLevel = false;
            } else {
                hp += Math.floor(hitDie / 2) + 1 + conMod;
            }
        }
    }
    return Math.max(hp, 1);
}

// ── Skill Proficiency Collection ──────────────────────────────────────────────

function collectAllSkillProficiencies(characterData) {
    const skills = new Set();

    // Main proficiency list
    const mainSkills = characterData.proficiencies?.skills || [];
    for (const s of mainSkills) skills.add(s.toLowerCase());

    // Optional proficiency selections (class/race/background skill choices)
    const optSkills = characterData.optionalProficiencies?.skills;
    if (optSkills) {
        for (const s of optSkills.selected || []) skills.add(s.toLowerCase());
        for (const source of ['race', 'class', 'background']) {
            for (const s of optSkills[source]?.selected || []) skills.add(s.toLowerCase());
        }
    }

    return skills;
}

// ── Shared Value Computation ──────────────────────────────────────────────────

function computeCharacterValues(characterData) {
    const scores = {};
    const modifiers = {};
    for (const ability of ABILITIES) {
        const score = getFinalAbilityScore(characterData, ability);
        const mod = calcModifier(score);
        scores[ability] = score;
        modifiers[ability] = mod;
    }

    const profBonus = getProficiencyBonus(characterData);
    const totalLevel = getTotalLevel(characterData);
    const savingThrowProfs = characterData.proficiencies?.savingThrows || [];
    const allSkillProfs = collectAllSkillProficiencies(characterData);

    const saveValues = {};
    for (const ability of ABILITIES) {
        const isProficient = savingThrowProfs.some(
            s => s.toLowerCase() === ability.toLowerCase() ||
                s.toLowerCase() === ABILITY_ABBR[ability].toLowerCase()
        );
        saveValues[ability] = {
            mod: modifiers[ability] + (isProficient ? profBonus : 0),
            proficient: isProficient,
        };
    }

    const skillValues = {};
    for (const [skillName, baseAbility] of Object.entries(SKILL_ABILITY_MAP)) {
        const isProficient = allSkillProfs.has(skillName.toLowerCase());
        skillValues[skillName] = {
            mod: modifiers[baseAbility] + (isProficient ? profBonus : 0),
            proficient: isProficient,
        };
    }

    const perceptionProf = allSkillProfs.has('perception');
    const passivePerception = 10 + modifiers.wisdom + (perceptionProf ? profBonus : 0);

    // Compute max HP fallback when saved value is 0
    let hpMax = characterData.hitPoints?.max ?? 0;
    if (hpMax === 0) {
        hpMax = computeFallbackMaxHP(characterData, modifiers.constitution);
    }

    return {
        scores, modifiers, profBonus, totalLevel, hpMax,
        saveValues, skillValues, passivePerception,
        classLevel: formatClassLevel(characterData),
        race: formatRace(characterData),
        background: formatBackground(characterData),
        hitDice: formatHitDice(characterData),
        features: formatFeaturesAndTraits(characterData),
        proficiencies: formatAllProficiencies(characterData),
        equipment: formatEquipment(characterData),
    };
}

// ── 2014 MPMB Template Builder ────────────────────────────────────────────────

function buildFieldMap2014(characterData, values) {
    const textFields = {};
    const checkboxFields = {};

    // --- Identity ---
    textFields['PC Name'] = characterData.name || '';
    textFields['Player Name'] = characterData.playerName || '';
    textFields['Class and Levels'] = values.classLevel;
    textFields['Character Level'] = String(values.totalLevel);
    textFields.Race = values.race;
    textFields.Background = values.background;

    // --- Ability Scores & Modifiers ---
    for (const ability of ABILITIES) {
        const abbr = ABILITY_ABBR[ability];
        textFields[abbr] = String(values.scores[ability]);
        textFields[`${abbr} Mod`] = formatModifier(values.modifiers[ability]);
    }

    // --- Proficiency Bonus ---
    textFields['Proficiency Bonus'] = formatModifier(values.profBonus);

    // --- Saving Throws ---
    for (const ability of ABILITIES) {
        const save = MPMB_SAVE_FIELD_MAP[ability];
        textFields[save.modifier] = formatModifier(values.saveValues[ability].mod);
        checkboxFields[save.proficiency] = values.saveValues[ability].proficient;
    }

    // --- Skills ---
    for (const [skillName, mapping] of Object.entries(MPMB_SKILL_FIELD_MAP)) {
        const skill = values.skillValues[skillName];
        textFields[mapping.modifier] = formatModifier(skill.mod);
        checkboxFields[mapping.proficiency] = skill.proficient;
    }

    // --- Passive Perception ---
    textFields['Passive Perception'] = String(values.passivePerception);

    // --- Combat ---
    textFields['Initiative bonus'] = formatModifier(values.modifiers.dexterity);
    textFields.Speed = characterData.speed?.walk ? `${characterData.speed.walk} ft` : '30 ft';

    // --- Armor Class ---
    // Basic AC: 10 + DEX mod (unarmored). TODO: factor in equipped armor/shields.
    const baseAC = 10 + values.modifiers.dexterity;
    textFields.AC = String(baseAC);

    // --- Hit Points ---
    textFields['HP Max'] = values.hpMax ? String(values.hpMax) : '';
    textFields['HP Current'] = String(characterData.hitPoints?.current ?? '');
    textFields['HP Temp'] = String(characterData.hitPoints?.temp ?? '');

    // --- Hit Dice ---
    textFields['HD1 Level'] = String(values.totalLevel);
    const classes = characterData.progression?.classes;
    if (Array.isArray(classes) && classes.length > 0) {
        textFields['HD1 Die'] = `d${classes[0].hitDice || 8}`;
        if (classes.length > 1 && classes[1].name) {
            textFields['HD2 Level'] = String(classes[1].levels || 0);
            textFields['HD2 Die'] = `d${classes[1].hitDice || 6}`;
        }
        if (classes.length > 2 && classes[2].name) {
            textFields['HD3 Level'] = String(classes[2].levels || 0);
            textFields['HD3 Die'] = `d${classes[2].hitDice || 6}`;
        }
    }

    // --- Character Details ---
    textFields.Sex = characterData.gender || '';
    textFields.Height = characterData.height || '';
    textFields.Weight = characterData.weight || '';
    textFields['Faith/Deity'] = characterData.deity || '';
    textFields.Background_History = characterData.backstory || '';
    textFields['Class Features'] = values.features;
    textFields.MoreProficiencies = values.proficiencies;

    // --- Armor Proficiency Checkboxes ---
    const armorProfs = characterData.proficiencies?.armor || [];
    const armorLower = armorProfs.map(a => a.toLowerCase());
    checkboxFields['Proficiency Armor Light'] = armorLower.some(a => a.includes('light'));
    checkboxFields['Proficiency Armor Medium'] = armorLower.some(a => a.includes('medium'));
    checkboxFields['Proficiency Armor Heavy'] = armorLower.some(a => a.includes('heavy'));
    checkboxFields['Proficiency Shields'] = armorLower.some(a => a.includes('shield'));

    // --- Weapon Proficiency Checkboxes ---
    const weaponProfs = characterData.proficiencies?.weapons || [];
    const weaponLower = weaponProfs.map(w => w.toLowerCase());
    checkboxFields['Proficiency Weapon Simple'] = weaponLower.some(w => w.includes('simple'));
    checkboxFields['Proficiency Weapon Martial'] = weaponLower.some(w => w.includes('martial'));
    const otherWeapons = weaponProfs.filter(w => {
        const l = w.toLowerCase();
        return !l.includes('simple') && !l.includes('martial');
    });
    checkboxFields['Proficiency Weapon Other'] = otherWeapons.length > 0;
    if (otherWeapons.length > 0) {
        textFields['Proficiency Weapon Other Description'] = otherWeapons.join(', ');
    }

    MainLogger.debug('FieldMapping', `Built 2014 MPMB field map: ${Object.keys(textFields).length} text, ${Object.keys(checkboxFields).length} checkbox`);
    return { textFields, checkboxFields };
}

// ── 2024 WotC Template Builder ────────────────────────────────────────────────

function buildFieldMap2024(characterData, values) {
    const textFields = {};
    const checkboxFields = {};

    // --- Identity (header) ---
    textFields.Text_1 = characterData.name || '';
    textFields.Text_2 = values.classLevel;
    textFields.Text_3 = values.race;
    textFields.Text_4 = values.background;
    textFields.Text_5 = characterData.playerName || '';

    // --- Ability Scores ---
    // Left column: STR, DEX, CON
    textFields.Text_22 = String(values.scores.strength);
    textFields.Text_25 = formatModifier(values.modifiers.strength);
    textFields.Text_23 = String(values.scores.dexterity);
    textFields.Text_26 = formatModifier(values.modifiers.dexterity);
    textFields.Text_24 = String(values.scores.constitution);
    textFields.Text_27 = formatModifier(values.modifiers.constitution);
    // Right column: INT, WIS, CHA
    textFields.Text_15 = String(values.scores.intelligence);
    textFields.Text_30 = formatModifier(values.modifiers.intelligence);
    textFields.Text_20 = String(values.scores.wisdom);
    textFields.Text_28 = formatModifier(values.modifiers.wisdom);
    textFields.Text_21 = String(values.scores.charisma);
    textFields.Text_29 = formatModifier(values.modifiers.charisma);

    // --- Combat Stats (header right) ---
    textFields.Text_14 = '';  // AC
    textFields.Text_7 = formatModifier(values.profBonus);
    textFields.Text_8 = formatModifier(values.modifiers.dexterity);  // Initiative
    textFields.Text_9 = characterData.speed?.walk ? `${characterData.speed.walk} ft` : '30 ft';
    textFields.Text_10 = values.hpMax ? String(values.hpMax) : '';
    textFields.Text_11 = String(characterData.hitPoints?.current ?? '');
    textFields.Text_12 = String(characterData.hitPoints?.temp ?? '');

    // --- Saving Throws ---
    for (const ability of ABILITIES) {
        const save = WOTC_2024_SAVE_FIELD_MAP[ability];
        textFields[save.modifier] = formatModifier(values.saveValues[ability].mod);
        checkboxFields[save.proficiency] = values.saveValues[ability].proficient;
    }

    // --- Skills ---
    for (const [skillName, mapping] of Object.entries(WOTC_2024_SKILL_FIELD_MAP)) {
        const skill = values.skillValues[skillName];
        textFields[mapping.modifier] = formatModifier(skill.mod);
        checkboxFields[mapping.proficiency] = skill.proficient;
    }

    // --- Large text areas (page 1 bottom) ---
    textFields.Text_55 = values.proficiencies;
    textFields.Text_57 = values.features;
    textFields.Text_59 = values.equipment;
    textFields.Text_60 = characterData.backstory || '';

    MainLogger.debug('FieldMapping', `Built 2024 WotC field map: ${Object.keys(textFields).length} text, ${Object.keys(checkboxFields).length} checkbox`);
    return { textFields, checkboxFields };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a flat dictionary mapping PDF field names to their values.
 * Selects the appropriate field name mapping based on the template.
 *
 * @param {Object} characterData - Serialized character JSON (from .ffp file)
 * @param {string} [templatePath] - Path to the PDF template (used to detect mapping)
 * @returns {{ textFields: Object<string, string>, checkboxFields: Object<string, boolean> }}
 */
export function buildFieldMap(characterData, templatePath) {
    const template = detectTemplate(templatePath);
    const values = computeCharacterValues(characterData);

    if (template === '2024') {
        return buildFieldMap2024(characterData, values);
    }
    return buildFieldMap2014(characterData, values);
}
