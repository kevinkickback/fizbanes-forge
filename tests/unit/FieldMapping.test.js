import { describe, expect, it, vi } from 'vitest';

// Mock MainLogger since it uses Node's util module
vi.mock('../../src/main/Logger.js', () => ({
    MainLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import {
    buildFieldMap,
    calcModifier,
    formatClassLevel,
    formatModifier,
    getFinalAbilityScore,
    getProficiencyBonus,
    getTotalLevel,
} from '../../src/main/pdf/FieldMapping.js';

// --- Helpers ---

function makeCharacter(overrides = {}) {
    return {
        name: 'Tordek',
        playerName: 'Alice',
        race: { name: 'Dwarf', subrace: 'Hill', source: 'PHB' },
        background: { name: 'Soldier' },
        alignment: 'Lawful Good',
        abilityScores: {
            strength: 16,
            dexterity: 12,
            constitution: 14,
            intelligence: 10,
            wisdom: 13,
            charisma: 8,
        },
        abilityBonuses: {
            strength: [],
            dexterity: [],
            constitution: [{ value: 2, source: 'Race' }],
            intelligence: [],
            wisdom: [{ value: 1, source: 'Race' }],
            charisma: [],
        },
        progression: {
            classes: [{ name: 'Fighter', levels: 5, hitDice: 10, subclass: 'Champion' }],
        },
        hitPoints: { current: 44, max: 44, temp: 0 },
        proficiencies: {
            armor: ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'],
            weapons: ['Simple Weapons', 'Martial Weapons'],
            tools: [],
            skills: ['Athletics', 'Intimidation'],
            languages: ['Common', 'Dwarvish'],
            savingThrows: ['Strength', 'Constitution'],
        },
        feats: [{ name: 'Great Weapon Master', source: 'PHB' }],
        features: {
            darkvision: 60,
            resistances: ['Poison'],
            traits: { 'Dwarven Resilience': { description: 'Advantage vs poison', source: 'Race' } },
        },
        speed: { walk: 25, fly: 0, swim: 0, climb: 0, burrow: 0 },
        height: '4\'5"',
        weight: '160 lbs',
        backstory: 'A battle-hardened warrior from the mountains.',
        portrait: '',
        inventory: {
            items: [
                { name: 'Greataxe', quantity: 1 },
                { name: 'Handaxe', quantity: 2 },
                { name: 'Explorer\'s Pack', quantity: 1 },
            ],
        },
        ...overrides,
    };
}

// --- Unit tests ---

describe('FieldMapping', () => {
    describe('calcModifier', () => {
        it('should return correct modifier for score 10', () => {
            expect(calcModifier(10)).toBe(0);
        });

        it('should return correct modifier for score 16', () => {
            expect(calcModifier(16)).toBe(3);
        });

        it('should return correct modifier for score 8', () => {
            expect(calcModifier(8)).toBe(-1);
        });

        it('should return correct modifier for score 1', () => {
            expect(calcModifier(1)).toBe(-5);
        });

        it('should return correct modifier for score 20', () => {
            expect(calcModifier(20)).toBe(5);
        });

        it('should return correct modifier for odd scores', () => {
            expect(calcModifier(11)).toBe(0);
            expect(calcModifier(13)).toBe(1);
            expect(calcModifier(15)).toBe(2);
        });
    });

    describe('formatModifier', () => {
        it('should format positive modifier with plus sign', () => {
            expect(formatModifier(3)).toBe('+3');
        });

        it('should format negative modifier with minus sign', () => {
            expect(formatModifier(-1)).toBe('-1');
        });

        it('should format zero with plus sign', () => {
            expect(formatModifier(0)).toBe('+0');
        });
    });

    describe('getFinalAbilityScore', () => {
        it('should return base score when no bonuses', () => {
            const char = makeCharacter();
            expect(getFinalAbilityScore(char, 'strength')).toBe(16);
        });

        it('should sum base score with bonuses', () => {
            const char = makeCharacter();
            expect(getFinalAbilityScore(char, 'constitution')).toBe(16); // 14 + 2
        });

        it('should handle multiple bonuses', () => {
            const char = makeCharacter({
                abilityBonuses: {
                    ...makeCharacter().abilityBonuses,
                    strength: [{ value: 1, source: 'Race' }, { value: 1, source: 'Feat' }],
                },
            });
            expect(getFinalAbilityScore(char, 'strength')).toBe(18); // 16 + 1 + 1
        });

        it('should return 0 for missing ability', () => {
            expect(getFinalAbilityScore({}, 'strength')).toBe(0);
        });
    });

    describe('getTotalLevel', () => {
        it('should return total level from single class', () => {
            const char = makeCharacter();
            expect(getTotalLevel(char)).toBe(5);
        });

        it('should return total level from multiclass', () => {
            const char = makeCharacter({
                progression: {
                    classes: [
                        { name: 'Fighter', levels: 5, hitDice: 10 },
                        { name: 'Wizard', levels: 3, hitDice: 6 },
                    ],
                },
            });
            expect(getTotalLevel(char)).toBe(8);
        });

        it('should return 1 when no classes', () => {
            expect(getTotalLevel({})).toBe(1);
            expect(getTotalLevel({ progression: { classes: [] } })).toBe(1);
        });
    });

    describe('getProficiencyBonus', () => {
        it('should return +2 for level 1', () => {
            const char = makeCharacter({ progression: { classes: [{ name: 'Fighter', levels: 1 }] } });
            expect(getProficiencyBonus(char)).toBe(2);
        });

        it('should return +3 for level 5', () => {
            const char = makeCharacter();
            expect(getProficiencyBonus(char)).toBe(3);
        });

        it('should return +4 for level 9', () => {
            const char = makeCharacter({ progression: { classes: [{ name: 'Fighter', levels: 9 }] } });
            expect(getProficiencyBonus(char)).toBe(4);
        });

        it('should return +6 for level 17', () => {
            const char = makeCharacter({ progression: { classes: [{ name: 'Fighter', levels: 17 }] } });
            expect(getProficiencyBonus(char)).toBe(6);
        });
    });

    describe('formatClassLevel', () => {
        it('should format single class', () => {
            const char = makeCharacter();
            expect(formatClassLevel(char)).toBe('Fighter 5 (Champion)');
        });

        it('should format multiclass', () => {
            const char = makeCharacter({
                progression: {
                    classes: [
                        { name: 'Fighter', levels: 5, hitDice: 10, subclass: 'Champion' },
                        { name: 'Wizard', levels: 3, hitDice: 6 },
                    ],
                },
            });
            expect(formatClassLevel(char)).toBe('Fighter 5 (Champion) / Wizard 3');
        });

        it('should return empty string for no classes', () => {
            expect(formatClassLevel({})).toBe('');
        });
    });

    describe('buildFieldMap', () => {
        it('should include character name fields', () => {
            const char = makeCharacter();
            const { textFields } = buildFieldMap(char);
            expect(textFields['PC Name']).toBe('Tordek');
        });

        it('should include player name', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            expect(textFields['Player Name']).toBe('Alice');
        });

        it('should format race with subrace', () => {
            const char = makeCharacter();
            const { textFields } = buildFieldMap(char);
            expect(textFields.Race).toBe('Hill Dwarf');
            expect(textFields['Class and Levels']).toBe('Fighter 5 (Champion)');
        });

        it('should compute ability scores with bonuses', () => {
            const char = makeCharacter();
            const { textFields } = buildFieldMap(char);
            // Constitution: 14 + 2 = 16
            expect(textFields.Con).toBe('16');
            expect(textFields['Con Mod']).toBe('+3');
            // Wisdom: 13 + 1 = 14
            expect(textFields.Wis).toBe('14');
            expect(textFields['Wis Mod']).toBe('+2');
        });

        it('should compute proficiency bonus', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            // Level 5 → +3
            expect(textFields['Proficiency Bonus']).toBe('+3');
        });

        it('should mark proficient saving throws', () => {
            const { textFields, checkboxFields } = buildFieldMap(makeCharacter());
            // STR save: +3 mod + 3 prof = +6
            expect(textFields['Str ST Mod']).toBe('+6');
            expect(checkboxFields['Str ST Prof']).toBe(true);
            // CON save: +3 mod + 3 prof = +6
            expect(textFields['Con ST Mod']).toBe('+6');
            expect(checkboxFields['Con ST Prof']).toBe(true);
            // DEX save (not proficient): +1 mod
            expect(textFields['Dex ST Mod']).toBe('+1');
            expect(checkboxFields['Dex ST Prof']).toBe(false);
        });

        it('should mark proficient skills', () => {
            const { textFields, checkboxFields } = buildFieldMap(makeCharacter());
            // Athletics (proficient): STR +3 + prof +3 = +6
            expect(textFields.Ath).toBe('+6');
            expect(checkboxFields['Ath Prof']).toBe(true);
            // Intimidation (proficient): CHA -1 + prof +3 = +2
            expect(textFields.Inti).toBe('+2');
            expect(checkboxFields['Inti Prof']).toBe(true);
            // Stealth (not proficient): DEX +1
            expect(textFields.Ste).toBe('+1');
            expect(checkboxFields['Ste Prof']).toBe(false);
        });

        it('should compute passive perception', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            // WIS +2, not proficient in Perception → 10 + 2 = 12
            expect(textFields['Passive Perception']).toBe('12');
        });

        it('should compute passive perception with proficiency', () => {
            const char = makeCharacter({
                proficiencies: {
                    ...makeCharacter().proficiencies,
                    skills: ['Athletics', 'Intimidation', 'Perception'],
                },
            });
            const { textFields } = buildFieldMap(char);
            // WIS +2, proficient → 10 + 2 + 3 = 15
            expect(textFields['Passive Perception']).toBe('15');
        });

        it('should include hit points', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            expect(textFields['HP Max']).toBe('44');
            expect(textFields['HP Current']).toBe('44');
        });

        it('should preserve 0 hit point values', () => {
            const char = makeCharacter({ hitPoints: { current: 0, max: 10, temp: 0 } });
            const { textFields } = buildFieldMap(char);
            expect(textFields['HP Max']).toBe('10');
            expect(textFields['HP Current']).toBe('0');
            expect(textFields['HP Temp']).toBe('0');
        });

        it('should compute basic armor class', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            // DEX 12 → +1 mod → AC 11
            expect(textFields.AC).toBe('11');
        });

        it('should include race in field map', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            expect(textFields.Race).toBe('Hill Dwarf');
        });

        it('should include background in field map', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            expect(textFields.Background).toBe('Soldier');
        });

        it('should include armor proficiency checkboxes', () => {
            const { checkboxFields } = buildFieldMap(makeCharacter());
            expect(checkboxFields['Proficiency Armor Light']).toBe(true);
            expect(checkboxFields['Proficiency Armor Medium']).toBe(true);
            expect(checkboxFields['Proficiency Armor Heavy']).toBe(true);
            expect(checkboxFields['Proficiency Shields']).toBe(true);
        });

        it('should include weapon proficiency checkboxes', () => {
            const { checkboxFields } = buildFieldMap(makeCharacter());
            expect(checkboxFields['Proficiency Weapon Simple']).toBe(true);
            expect(checkboxFields['Proficiency Weapon Martial']).toBe(true);
        });

        it('should compute fallback max HP when stored value is 0', () => {
            const char = makeCharacter({
                hitPoints: { current: 0, max: 0, temp: 0 },
                progression: { classes: [{ name: 'Barbarian', levels: 1 }] },
                abilityScores: { strength: 10, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
                abilityBonuses: { strength: [], dexterity: [], constitution: [], intelligence: [], wisdom: [], charisma: [] },
            });
            const { textFields } = buildFieldMap(char);
            // Barbarian d12, level 1: 12 + CON mod(+2) = 14
            expect(textFields['HP Max']).toBe('14');
        });

        it('should compute fallback max HP for multiple levels', () => {
            const char = makeCharacter({
                hitPoints: { current: 0, max: 0, temp: 0 },
                progression: { classes: [{ name: 'Fighter', levels: 3 }] },
                abilityScores: { strength: 10, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
                abilityBonuses: { strength: [], dexterity: [], constitution: [], intelligence: [], wisdom: [], charisma: [] },
            });
            const { textFields } = buildFieldMap(char);
            // Fighter d10: level 1 = 10+2, levels 2-3 = (5+1+2)*2 = 16 → total 28
            expect(textFields['HP Max']).toBe('28');
        });

        it('should resolve hit die from class name when hitDice property absent', () => {
            const char = makeCharacter({
                hitPoints: { current: 0, max: 0, temp: 0 },
                progression: { classes: [{ name: 'Wizard', levels: 1 }] },
                abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
                abilityBonuses: { strength: [], dexterity: [], constitution: [], intelligence: [], wisdom: [], charisma: [] },
            });
            const { textFields } = buildFieldMap(char);
            // Wizard d6, CON mod 0: 6 + 0 = 6
            expect(textFields['HP Max']).toBe('6');
        });

        it('should merge skills from optionalProficiencies', () => {
            const char = makeCharacter({
                proficiencies: {
                    ...makeCharacter().proficiencies,
                    skills: ['Deception', 'Sleight of hand'],
                },
                optionalProficiencies: {
                    skills: {
                        class: { selected: ['Athletics', 'Survival'] },
                    },
                },
            });
            const { checkboxFields, textFields } = buildFieldMap(char);
            // Background skills
            expect(checkboxFields['Dec Prof']).toBe(true);
            expect(checkboxFields['Sle Prof']).toBe(true);
            // Class-selected skills
            expect(checkboxFields['Ath Prof']).toBe(true);
            expect(checkboxFields['Sur Prof']).toBe(true);
            // Non-proficient skill
            expect(checkboxFields['Arc Prof']).toBe(false);
        });

        it('should fill fields for a Tiefling Barbarian with 0 HP', () => {
            const char = {
                name: 'TestChar',
                playerName: 'Player1',
                race: { name: 'Tiefling', source: 'PHB', subrace: '' },
                background: { name: 'Charlatan', source: 'PHB' },
                alignment: 'Chaotic Neutral',
                abilityScores: { strength: 15, dexterity: 14, constitution: 14, intelligence: 8, wisdom: 12, charisma: 10 },
                abilityBonuses: { strength: [], dexterity: [], constitution: [], intelligence: [{ value: 1, source: 'Race' }], wisdom: [], charisma: [{ value: 2, source: 'Race' }] },
                progression: { classes: [{ name: 'Barbarian', levels: 1, subclass: '', hitPoints: [], features: [], spellSlots: {} }] },
                hitPoints: { current: 0, max: 0, temp: 0 },
                proficiencies: {
                    armor: ['Light Armor', 'Medium Armor', 'Shields'],
                    weapons: ['Simple Weapons', 'Martial Weapons'],
                    tools: [],
                    skills: ['Deception', 'Sleight of hand'],
                    languages: ['Common', 'Infernal'],
                    savingThrows: ['Strength', 'Constitution'],
                },
                optionalProficiencies: {
                    skills: {
                        selected: [],
                        class: { choices: 2, options: [], selected: ['Athletics', 'Survival'] },
                        race: { choices: 0, options: [], selected: [] },
                        background: { choices: 0, options: [], selected: [] },
                    },
                },
                feats: [],
                features: { darkvision: 60, resistances: ['Fire'], traits: {} },
                speed: { walk: 30, fly: 0, swim: 0, climb: 0, burrow: 0 },
            };
            const { textFields, checkboxFields } = buildFieldMap(char);

            expect(textFields['PC Name']).toBe('TestChar');
            expect(textFields['Player Name']).toBe('Player1');
            expect(textFields.Race).toBe('Tiefling');
            expect(textFields.Background).toBe('Charlatan');

            // HP fallback: Barbarian d12, CON 14 (+2) → 12 + 2 = 14
            expect(textFields['HP Max']).toBe('14');

            // Saving throws: STR +2 mod + 2 prof = +4, CON +2 mod + 2 prof = +4
            expect(checkboxFields['Str ST Prof']).toBe(true);
            expect(checkboxFields['Con ST Prof']).toBe(true);

            // Skills from both sources
            expect(checkboxFields['Dec Prof']).toBe(true);   // background: Deception
            expect(checkboxFields['Sle Prof']).toBe(true);   // background: Sleight of hand
            expect(checkboxFields['Ath Prof']).toBe(true);   // class: Athletics
            expect(checkboxFields['Sur Prof']).toBe(true);   // class: Survival
            expect(checkboxFields['Arc Prof']).toBe(false);  // not proficient

            // Armor/weapon proficiencies
            expect(checkboxFields['Proficiency Armor Light']).toBe(true);
            expect(checkboxFields['Proficiency Armor Medium']).toBe(true);
            expect(checkboxFields['Proficiency Armor Heavy']).toBe(false);
            expect(checkboxFields['Proficiency Shields']).toBe(true);
        });

        it('should include speed', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            expect(textFields.Speed).toBe('25 ft');
        });

        it('should include physical details', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            expect(textFields.Height).toBe('4\'5"');
            expect(textFields.Weight).toBe('160 lbs');
        });

        it('should include backstory', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            expect(textFields.Background_History).toBe('A battle-hardened warrior from the mountains.');
        });

        it('should handle empty character gracefully', () => {
            const { textFields, checkboxFields } = buildFieldMap({});
            expect(textFields['PC Name']).toBe('');
            expect(Object.keys(textFields).length).toBeGreaterThan(0);
            expect(Object.keys(checkboxFields).length).toBeGreaterThan(0);
        });

        it('should include features and traits', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            const features = textFields['Class Features'];
            expect(features).toContain('Darkvision 60 ft.');
            expect(features).toContain('Poison');
            expect(features).toContain('Dwarven Resilience');
            expect(features).toContain('Great Weapon Master');
        });

        it('should format proficiencies listing', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            expect(textFields.MoreProficiencies).toContain('Armor:');
            expect(textFields.MoreProficiencies).toContain('Languages:');
        });

        it('should format hit dice per class', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            expect(textFields['HD1 Level']).toBe('5');
            expect(textFields['HD1 Die']).toBe('d10');
        });

        it('should format multiclass hit dice', () => {
            const char = makeCharacter({
                progression: {
                    classes: [
                        { name: 'Fighter', levels: 5, hitDice: 10 },
                        { name: 'Wizard', levels: 3, hitDice: 6 },
                    ],
                },
            });
            const { textFields } = buildFieldMap(char);
            expect(textFields['HD1 Level']).toBe('8');
            expect(textFields['HD1 Die']).toBe('d10');
            expect(textFields['HD2 Level']).toBe('3');
            expect(textFields['HD2 Die']).toBe('d6');
        });

        it('should select 2024 template when path contains 2024', () => {
            const char = makeCharacter();
            const { textFields } = buildFieldMap(char, '/assets/pdf/2024_CharacterSheet.pdf');
            expect(textFields.Text_1).toBe('Tordek');
            expect(textFields.Text_2).toBe('Fighter 5 (Champion)');
            expect(textFields.Text_3).toBe('Hill Dwarf');
        });

        it('should select 2014 template by default', () => {
            const char = makeCharacter();
            const { textFields } = buildFieldMap(char);
            expect(textFields['PC Name']).toBe('Tordek');
            expect(textFields['Class and Levels']).toBe('Fighter 5 (Champion)');
        });

        it('should include character level', () => {
            const { textFields } = buildFieldMap(makeCharacter());
            expect(textFields['Character Level']).toBe('5');
        });
    });
});
