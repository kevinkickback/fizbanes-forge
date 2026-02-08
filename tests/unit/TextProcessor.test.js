import { describe, expect, it } from 'vitest';
import TextProcessor from '../../src/lib/TextProcessor.js';

describe('TextProcessor', () => {
    describe('normalizeForLookup', () => {
        describe('Basic Functionality', () => {
            it('should convert uppercase to lowercase', () => {
                const result = TextProcessor.normalizeForLookup('HUMAN');
                expect(result).toBe('human');
            });

            it('should convert mixed case to lowercase', () => {
                const result = TextProcessor.normalizeForLookup('HuMaN');
                expect(result).toBe('human');
            });

            it('should handle already lowercase strings', () => {
                const result = TextProcessor.normalizeForLookup('human');
                expect(result).toBe('human');
            });

            it('should trim leading whitespace', () => {
                const result = TextProcessor.normalizeForLookup('   human');
                expect(result).toBe('human');
            });

            it('should trim trailing whitespace', () => {
                const result = TextProcessor.normalizeForLookup('human   ');
                expect(result).toBe('human');
            });

            it('should trim both leading and trailing whitespace', () => {
                const result = TextProcessor.normalizeForLookup('   human   ');
                expect(result).toBe('human');
            });

            it('should handle tabs and other whitespace', () => {
                const result = TextProcessor.normalizeForLookup('\t\nhuman\t\n');
                expect(result).toBe('human');
            });
        });

        describe('Multi-word Strings', () => {
            it('should handle multi-word strings', () => {
                const result = TextProcessor.normalizeForLookup('High Elf');
                expect(result).toBe('high elf');
            });

            it('should preserve internal whitespace', () => {
                const result = TextProcessor.normalizeForLookup('Greater Restoration');
                expect(result).toBe('greater restoration');
            });

            it('should normalize internal whitespace', () => {
                const result = TextProcessor.normalizeForLookup('High  Elf');
                expect(result).toBe('high  elf');
            });

            it('should handle three-word strings', () => {
                const result = TextProcessor.normalizeForLookup('Draconic Breath Weapon');
                expect(result).toBe('draconic breath weapon');
            });
        });

        describe('Special Characters', () => {
            it('should preserve hyphens', () => {
                const result = TextProcessor.normalizeForLookup('Half-Elf');
                expect(result).toBe('half-elf');
            });

            it('should preserve apostrophes', () => {
                const result = TextProcessor.normalizeForLookup("Bigby's Hand");
                expect(result).toBe("bigby's hand");
            });

            it('should preserve parentheses', () => {
                const result = TextProcessor.normalizeForLookup('Shield (Weapon)');
                expect(result).toBe('shield (weapon)');
            });

            it('should preserve commas', () => {
                const result = TextProcessor.normalizeForLookup('Smith, Weaponsmith');
                expect(result).toBe('smith, weaponsmith');
            });

            it('should preserve periods', () => {
                const result = TextProcessor.normalizeForLookup('Dr. Watson');
                expect(result).toBe('dr. watson');
            });

            it('should preserve slashes', () => {
                const result = TextProcessor.normalizeForLookup('AC/DC');
                expect(result).toBe('ac/dc');
            });

            it('should preserve underscores', () => {
                const result = TextProcessor.normalizeForLookup('snake_case');
                expect(result).toBe('snake_case');
            });

            it('should preserve ampersands', () => {
                const result = TextProcessor.normalizeForLookup('Dungeons & Dragons');
                expect(result).toBe('dungeons & dragons');
            });
        });

        describe('Numbers and Mixed Content', () => {
            it('should handle strings with numbers', () => {
                const result = TextProcessor.normalizeForLookup('Fireball 3rd Level');
                expect(result).toBe('fireball 3rd level');
            });

            it('should handle strings starting with numbers', () => {
                const result = TextProcessor.normalizeForLookup('5th Edition');
                expect(result).toBe('5th edition');
            });

            it('should handle only numbers', () => {
                const result = TextProcessor.normalizeForLookup('123');
                expect(result).toBe('123');
            });

            it('should handle alphanumeric with special chars', () => {
                const result = TextProcessor.normalizeForLookup('CR 1/2 Monster');
                expect(result).toBe('cr 1/2 monster');
            });
        });

        describe('Edge Cases', () => {
            it('should return empty string for null', () => {
                const result = TextProcessor.normalizeForLookup(null);
                expect(result).toBe('');
            });

            it('should return empty string for undefined', () => {
                const result = TextProcessor.normalizeForLookup(undefined);
                expect(result).toBe('');
            });

            it('should return empty string for empty string', () => {
                const result = TextProcessor.normalizeForLookup('');
                expect(result).toBe('');
            });

            it('should return empty string for whitespace-only string', () => {
                const result = TextProcessor.normalizeForLookup('   ');
                expect(result).toBe('');
            });

            it('should return empty string for tab-only string', () => {
                const result = TextProcessor.normalizeForLookup('\t\t');
                expect(result).toBe('');
            });

            it('should return empty string for newline-only string', () => {
                const result = TextProcessor.normalizeForLookup('\n\n');
                expect(result).toBe('');
            });

            it('should handle single character strings', () => {
                const result = TextProcessor.normalizeForLookup('A');
                expect(result).toBe('a');
            });

            it('should handle very long strings', () => {
                const longString = 'A'.repeat(1000);
                const result = TextProcessor.normalizeForLookup(longString);
                expect(result).toBe('a'.repeat(1000));
            });

            it('should return empty string for numbers', () => {
                const result = TextProcessor.normalizeForLookup(123);
                expect(result).toBe('');
            });

            it('should return empty string for objects', () => {
                const result = TextProcessor.normalizeForLookup({ name: 'Test' });
                expect(result).toBe('');
            });

            it('should return empty string for arrays', () => {
                const result = TextProcessor.normalizeForLookup(['Test']);
                expect(result).toBe('');
            });

            it('should return empty string for booleans', () => {
                const result = TextProcessor.normalizeForLookup(true);
                expect(result).toBe('');
            });
        });

        describe('Unicode and Special Encodings', () => {
            it('should handle unicode characters', () => {
                const result = TextProcessor.normalizeForLookup('Café');
                expect(result).toBe('café');
            });

            it('should handle emoji', () => {
                const result = TextProcessor.normalizeForLookup('Dragon 🐉');
                expect(result).toBe('dragon 🐉');
            });

            it('should handle accented characters', () => {
                const result = TextProcessor.normalizeForLookup('Résumé');
                expect(result).toBe('résumé');
            });

            it('should handle non-Latin scripts', () => {
                const result = TextProcessor.normalizeForLookup('火球術');
                expect(result).toBe('火球術');
            });

            it('should handle mixed scripts', () => {
                const result = TextProcessor.normalizeForLookup('Fireball 火球術');
                expect(result).toBe('fireball 火球術');
            });
        });

        describe('Real-world D&D Names', () => {
            it('should handle race names', () => {
                expect(TextProcessor.normalizeForLookup('Dragonborn')).toBe('dragonborn');
                expect(TextProcessor.normalizeForLookup('Half-Elf')).toBe('half-elf');
                expect(TextProcessor.normalizeForLookup('Half-Orc')).toBe('half-orc');
            });

            it('should handle class names', () => {
                expect(TextProcessor.normalizeForLookup('Barbarian')).toBe('barbarian');
                expect(TextProcessor.normalizeForLookup('Wizard')).toBe('wizard');
                expect(TextProcessor.normalizeForLookup('Fighter')).toBe('fighter');
            });

            it('should handle spell names', () => {
                expect(TextProcessor.normalizeForLookup('Magic Missile')).toBe(
                    'magic missile',
                );
                expect(TextProcessor.normalizeForLookup('Bigby\'s Hand')).toBe(
                    "bigby's hand",
                );
                expect(TextProcessor.normalizeForLookup('Fireball')).toBe('fireball');
            });

            it('should handle item names', () => {
                expect(TextProcessor.normalizeForLookup('Longsword')).toBe('longsword');
                expect(TextProcessor.normalizeForLookup('+1 Longsword')).toBe(
                    '+1 longsword',
                );
                expect(TextProcessor.normalizeForLookup('Shield of Missile Attraction')).toBe(
                    'shield of missile attraction',
                );
            });

            it('should handle feat names', () => {
                expect(TextProcessor.normalizeForLookup('Great Weapon Master')).toBe(
                    'great weapon master',
                );
                expect(TextProcessor.normalizeForLookup('Sharpshooter')).toBe(
                    'sharpshooter',
                );
            });

            it('should handle background names', () => {
                expect(TextProcessor.normalizeForLookup('Folk Hero')).toBe('folk hero');
                expect(TextProcessor.normalizeForLookup('Acolyte')).toBe('acolyte');
            });
        });

        describe('Consistency and Idempotency', () => {
            it('should be idempotent - normalizing twice gives same result', () => {
                const input = 'High Elf';
                const first = TextProcessor.normalizeForLookup(input);
                const second = TextProcessor.normalizeForLookup(first);
                expect(first).toBe(second);
            });

            it('should produce same result for equivalent inputs', () => {
                const result1 = TextProcessor.normalizeForLookup('  HIGH ELF  ');
                const result2 = TextProcessor.normalizeForLookup('high elf');
                const result3 = TextProcessor.normalizeForLookup('High Elf');
                expect(result1).toBe(result2);
                expect(result2).toBe(result3);
            });

            it('should handle repeated normalizations', () => {
                let result = 'DRAGONBORN';
                for (let i = 0; i < 10; i++) {
                    result = TextProcessor.normalizeForLookup(result);
                }
                expect(result).toBe('dragonborn');
            });
        });

        describe('Performance and Length', () => {
            it('should handle medium-length strings efficiently', () => {
                const input = 'This Is A Moderately Long D&D Item Name With Many Words';
                const result = TextProcessor.normalizeForLookup(input);
                expect(result).toBe(
                    'this is a moderately long d&d item name with many words',
                );
            });

            it('should handle strings with excessive whitespace', () => {
                const input = '   Many    Spaces    Between    Words   ';
                const result = TextProcessor.normalizeForLookup(input);
                expect(result).toBe('many    spaces    between    words');
            });
        });
    });
});
