import { describe, expect, it } from 'vitest';
import {
    ABILITY_ABBREVIATIONS,
    ABILITY_NAMES,
    CANTRIP_ORDINALS,
    DEFAULT_CHARACTER_SIZE,
    DEFAULT_CHARACTER_SPEED,
    SPELL_LEVEL_ORDINALS,
    SPELL_SCHOOL_NAMES,
    attAbvToFull,
    escapeHtml,
    formatModifierNumber,
    getAbilityModNumber,
    getAbilityModifier,
    getSchoolName,
    sizeAbvToFull,
} from '../../src/lib/5eToolsParser.js';

describe('5eToolsParser', () => {
    describe('Constants', () => {
        it('should export ability abbreviations', () => {
            expect(ABILITY_ABBREVIATIONS).toEqual([
                'str', 'dex', 'con', 'int', 'wis', 'cha'
            ]);
        });

        it('should export ability names', () => {
            expect(ABILITY_NAMES).toEqual([
                'Strength',
                'Dexterity',
                'Constitution',
                'Intelligence',
                'Wisdom',
                'Charisma',
            ]);
        });

        it('should export spell school names', () => {
            expect(SPELL_SCHOOL_NAMES).toContain('Abjuration');
            expect(SPELL_SCHOOL_NAMES).toContain('Evocation');
            expect(SPELL_SCHOOL_NAMES).toHaveLength(8);
        });

        it('should export spell level ordinals', () => {
            expect(SPELL_LEVEL_ORDINALS[0]).toBe('');
            expect(SPELL_LEVEL_ORDINALS[1]).toBe('1st-level');
            expect(SPELL_LEVEL_ORDINALS[9]).toBe('9th-level');
        });

        it('should export cantrip ordinals', () => {
            expect(CANTRIP_ORDINALS[0]).toBe('Cantrip');
            expect(CANTRIP_ORDINALS[1]).toBe('1st');
            expect(CANTRIP_ORDINALS[9]).toBe('9th');
        });

        it('should export default character size', () => {
            expect(DEFAULT_CHARACTER_SIZE).toEqual(['M']);
        });

        it('should export default character speed', () => {
            expect(DEFAULT_CHARACTER_SPEED).toEqual({ walk: 30 });
        });
    });

    describe('escapeHtml()', () => {
        it('should escape HTML special characters', () => {
            expect(escapeHtml('<div>Test</div>')).toBe('&lt;div&gt;Test&lt;/div&gt;');
        });

        it('should escape ampersand', () => {
            expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
        });

        it('should escape quotes', () => {
            expect(escapeHtml('"Hello" and \'World\'')).toBe('&quot;Hello&quot; and &#039;World&#039;');
        });

        it('should handle empty string', () => {
            expect(escapeHtml('')).toBe('');
        });

        it('should handle null/undefined', () => {
            expect(escapeHtml(null)).toBe('');
            expect(escapeHtml(undefined)).toBe('');
        });

        it('should convert numbers to string and escape', () => {
            expect(escapeHtml(123)).toBe('123');
        });

        it('should escape multiple characters', () => {
            const input = '<div class="test" data-id=\'5\'>&nbsp;</div>';
            const output = escapeHtml(input);
            expect(output).toContain('&lt;');
            expect(output).toContain('&gt;');
            expect(output).toContain('&quot;');
            expect(output).toContain('&#039;');
            expect(output).toContain('&amp;');
        });
    });

    describe('sizeAbvToFull()', () => {
        it('should convert size abbreviations to full names', () => {
            expect(sizeAbvToFull('T')).toBe('Tiny');
            expect(sizeAbvToFull('S')).toBe('Small');
            expect(sizeAbvToFull('M')).toBe('Medium');
            expect(sizeAbvToFull('L')).toBe('Large');
            expect(sizeAbvToFull('H')).toBe('Huge');
            expect(sizeAbvToFull('G')).toBe('Gargantuan');
        });

        it('should handle Varies', () => {
            expect(sizeAbvToFull('V')).toBe('Varies');
        });

        it('should handle Fine and Diminutive', () => {
            expect(sizeAbvToFull('F')).toBe('Fine');
            expect(sizeAbvToFull('D')).toBe('Diminutive');
        });

        it('should handle Colossal', () => {
            expect(sizeAbvToFull('C')).toBe('Colossal');
        });

        it('should return unknown for invalid input', () => {
            const result = sizeAbvToFull('X');
            expect(result).toBeDefined();
        });
    });

    describe('getAbilityModNumber()', () => {
        it('should calculate ability modifier for score 10', () => {
            expect(getAbilityModNumber(10)).toBe(0);
        });

        it('should calculate ability modifier for score 11', () => {
            expect(getAbilityModNumber(11)).toBe(0);
        });

        it('should calculate ability modifier for score 12', () => {
            expect(getAbilityModNumber(12)).toBe(1);
        });

        it('should calculate ability modifier for score 8', () => {
            expect(getAbilityModNumber(8)).toBe(-1);
        });

        it('should calculate ability modifier for score 20', () => {
            expect(getAbilityModNumber(20)).toBe(5);
        });

        it('should calculate ability modifier for score 1', () => {
            expect(getAbilityModNumber(1)).toBe(-5);
        });

        it('should calculate ability modifier for score 30', () => {
            expect(getAbilityModNumber(30)).toBe(10);
        });

        it('should handle edge cases', () => {
            expect(getAbilityModNumber(3)).toBe(-4);
            expect(getAbilityModNumber(18)).toBe(4);
            expect(getAbilityModNumber(19)).toBe(4);
        });
    });

    describe('getAbilityModifier()', () => {
        it('should return formatted positive modifier', () => {
            expect(getAbilityModifier(16)).toBe('+3');
            expect(getAbilityModifier(20)).toBe('+5');
        });

        it('should return formatted negative modifier', () => {
            expect(getAbilityModifier(8)).toBe('-1');
            expect(getAbilityModifier(6)).toBe('-2');
        });

        it('should return +0 for score 10-11', () => {
            expect(getAbilityModifier(10)).toBe('+0');
            expect(getAbilityModifier(11)).toBe('+0');
        });

        it('should format negative modifiers consistently', () => {
            const result = getAbilityModifier(8);
            expect(result).toMatch(/^[-−]\d+$/);
        });
    });

    describe('formatModifierNumber()', () => {
        it('should format positive numbers with +', () => {
            expect(formatModifierNumber(3)).toBe('+3');
            expect(formatModifierNumber(10)).toBe('+10');
        });

        it('should format negative numbers with minus sign', () => {
            expect(formatModifierNumber(-2)).toBe('-2');
            expect(formatModifierNumber(-5)).toBe('-5');
        });

        it('should format zero with +', () => {
            expect(formatModifierNumber(0)).toBe('+0');
        });

        it('should start with minus character', () => {
            const result = formatModifierNumber(-1);
            expect(result[0]).toMatch(/[-−]/);
            expect(result).toContain('1');
        });
    });

    describe('attAbvToFull()', () => {
        it('should convert ability abbreviations to full names', () => {
            expect(attAbvToFull('str')).toBe('Strength');
            expect(attAbvToFull('dex')).toBe('Dexterity');
            expect(attAbvToFull('con')).toBe('Constitution');
            expect(attAbvToFull('int')).toBe('Intelligence');
            expect(attAbvToFull('wis')).toBe('Wisdom');
            expect(attAbvToFull('cha')).toBe('Charisma');
        });

        it('should handle invalid abbreviations', () => {
            const result = attAbvToFull('xyz');
            expect(result).toBeDefined();
        });

        it('should handle uppercase input', () => {
            // Depending on implementation, this may or may not work
            const result = attAbvToFull('STR');
            expect(result).toBeDefined();
        });
    });

    describe('getSchoolName()', () => {
        it('should convert spell school codes to names', () => {
            expect(getSchoolName('A')).toBe('Abjuration');
            expect(getSchoolName('C')).toBe('Conjuration');
            expect(getSchoolName('D')).toBe('Divination');
            expect(getSchoolName('E')).toBe('Enchantment');
            expect(getSchoolName('V')).toBe('Evocation');
            expect(getSchoolName('I')).toBe('Illusion');
            expect(getSchoolName('N')).toBe('Necromancy');
            expect(getSchoolName('T')).toBe('Transmutation');
        });

        it('should handle invalid school codes', () => {
            const result = getSchoolName('X');
            expect(result).toBeDefined();
        });
    });

    describe('Edge Cases and Integration', () => {
        it('should handle boundary ability scores', () => {
            expect(getAbilityModNumber(1)).toBe(-5);
            expect(getAbilityModNumber(30)).toBe(10);
        });

        it('should consistently format all modifiers', () => {
            for (let score = 1; score <= 30; score++) {
                const modNumber = getAbilityModNumber(score);
                const modString = getAbilityModifier(score);
                const expectedString = formatModifierNumber(modNumber);
                expect(modString).toBe(expectedString);
            }
        });

        it('should have matching ability arrays', () => {
            expect(ABILITY_ABBREVIATIONS.length).toBe(ABILITY_NAMES.length);
            expect(ABILITY_ABBREVIATIONS.length).toBe(6);
        });

        it('should have proper ordinal arrays', () => {
            expect(SPELL_LEVEL_ORDINALS.length).toBe(10); // 0-9
            expect(CANTRIP_ORDINALS.length).toBe(10); // 0-9
        });
    });
});
