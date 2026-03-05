import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ClassService before importing SpellSelectionService
vi.mock('../../src/services/ClassService.js', () => ({
    classService: {
        getClass: vi.fn(),
    },
}));

// Mock SpellService
vi.mock('../../src/services/SpellService.js', () => ({
    spellService: {
        getSpell: vi.fn(),
        getSpellsByClass: vi.fn(() => []),
    },
}));

// Mock EventBus
vi.mock('../../src/lib/EventBus.js', () => ({
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    EVENTS: {
        SPELL_ADDED: 'spell:added',
        SPELL_REMOVED: 'spell:removed',
        SPELL_PREPARED: 'spell:prepared',
        SPELL_UNPREPARED: 'spell:unprepared',
    },
}));

// Mock ValidationSchemas
vi.mock('../../src/lib/ValidationSchemas.js', () => ({
    addSpellArgsSchema: { parse: vi.fn((v) => v) },
    removeSpellArgsSchema: { parse: vi.fn((v) => v) },
    validateInput: vi.fn((_schema, data) => data),
}));

import { classService } from '../../src/services/ClassService.js';
import { spellSelectionService } from '../../src/services/SpellSelectionService.js';

describe('SpellSelectionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isSpellcastingClass', () => {
        it('should return true for a class with spellcasting ability', () => {
            classService.getClass.mockReturnValue({
                name: 'Wizard',
                spellcastingAbility: 'int',
            });

            expect(spellSelectionService.isSpellcastingClass('Wizard')).toBe(true);
        });

        it('should return false for a class without spellcasting ability', () => {
            classService.getClass.mockReturnValue({
                name: 'Fighter',
                spellcastingAbility: null,
            });

            expect(spellSelectionService.isSpellcastingClass('Fighter')).toBe(false);
        });

        it('should return false when class is not found', () => {
            classService.getClass.mockImplementation(() => {
                throw new Error('Class not found');
            });

            expect(spellSelectionService.isSpellcastingClass('Nonexistent')).toBe(false);
        });

        it('should return false for Bonus pseudo-class', () => {
            classService.getClass.mockImplementation(() => {
                throw new Error('Class not found');
            });

            expect(spellSelectionService.isSpellcastingClass('Bonus')).toBe(false);
        });

        it('should return false when getClass returns null', () => {
            classService.getClass.mockReturnValue(null);

            expect(spellSelectionService.isSpellcastingClass('Unknown')).toBe(false);
        });
    });

    describe('ensureBonusBucket', () => {
        it('should create spellcasting structure when it does not exist', () => {
            const character = {};

            const result = spellSelectionService.ensureBonusBucket(character);

            expect(character.spellcasting).toBeDefined();
            expect(character.spellcasting.classes).toBeDefined();
            expect(character.spellcasting.classes.Bonus).toBeDefined();
            expect(result).toBe(character.spellcasting.classes.Bonus);
        });

        it('should create Bonus bucket on existing spellcasting structure', () => {
            const character = {
                spellcasting: {
                    classes: {
                        Wizard: { level: 3, spellsKnown: [] },
                    },
                    multiclass: { isCastingMulticlass: false, combinedSlots: {} },
                    other: { spellsKnown: [], itemSpells: [] },
                },
            };

            const result = spellSelectionService.ensureBonusBucket(character);

            expect(character.spellcasting.classes.Bonus).toBeDefined();
            expect(character.spellcasting.classes.Wizard).toBeDefined();
            expect(result).toBe(character.spellcasting.classes.Bonus);
        });

        it('should not overwrite existing Bonus bucket', () => {
            const existingBonus = {
                level: 0,
                spellsKnown: [{ name: 'Magic Missile' }],
                spellsPrepared: [],
                spellSlots: {},
                cantripsKnown: 0,
                spellcastingAbility: null,
                ritualCasting: false,
            };

            const character = {
                spellcasting: {
                    classes: { Bonus: existingBonus },
                    multiclass: { isCastingMulticlass: false, combinedSlots: {} },
                    other: { spellsKnown: [], itemSpells: [] },
                },
            };

            const result = spellSelectionService.ensureBonusBucket(character);

            expect(result).toBe(existingBonus);
            expect(result.spellsKnown).toHaveLength(1);
            expect(result.spellsKnown[0].name).toBe('Magic Missile');
        });

        it('should return Bonus bucket with correct default shape', () => {
            const character = {};
            const result = spellSelectionService.ensureBonusBucket(character);

            expect(result).toEqual({
                level: 0,
                spellsKnown: [],
                spellsPrepared: [],
                spellSlots: {},
                cantripsKnown: 0,
                spellcastingAbility: null,
                ritualCasting: false,
            });
        });

        it('should initialize multiclass and other structures when creating from scratch', () => {
            const character = {};
            spellSelectionService.ensureBonusBucket(character);

            expect(character.spellcasting.multiclass).toEqual({
                isCastingMulticlass: false,
                combinedSlots: {},
            });
            expect(character.spellcasting.other).toEqual({
                spellsKnown: [],
                itemSpells: [],
            });
        });
    });

    describe('_getPreparedSpellLimit', () => {
        function makeCharacter(intScore) {
            return {
                getAbilityModifier: (ability) => {
                    if (ability === 'intelligence') return Math.floor((intScore - 10) / 2);
                    return 0;
                },
            };
        }

        beforeEach(() => {
            classService.getClass.mockReturnValue({
                name: 'Wizard',
                spellcastingAbility: 'int',
                preparedSpells: true,
            });
        });

        it('should return level + INT modifier for a Level 2 Wizard with INT 14 (+2)', () => {
            const character = makeCharacter(14);
            expect(spellSelectionService._getPreparedSpellLimit(character, 'Wizard', 2)).toBe(4);
        });

        it('should return level + INT modifier for a Level 2 Wizard with INT 13 (+1)', () => {
            const character = makeCharacter(13);
            expect(spellSelectionService._getPreparedSpellLimit(character, 'Wizard', 2)).toBe(3);
        });

        it('should return minimum of 1 for a Level 1 Wizard with INT 8 (-1)', () => {
            const character = makeCharacter(8);
            expect(spellSelectionService._getPreparedSpellLimit(character, 'Wizard', 1)).toBe(1);
        });

        it('should return 8 for a Level 5 Cleric with WIS 16 (+3)', () => {
            classService.getClass.mockReturnValue({
                name: 'Cleric',
                spellcastingAbility: 'wis',
                preparedSpells: true,
            });
            const character = {
                getAbilityModifier: (ability) => (ability === 'wisdom' ? 3 : 0),
            };
            expect(spellSelectionService._getPreparedSpellLimit(character, 'Cleric', 5)).toBe(8);
        });

        it('should return 0 for a non-spellcasting class', () => {
            classService.getClass.mockReturnValue({ name: 'Fighter' }); // no spellcastingAbility
            const character = makeCharacter(14);
            expect(spellSelectionService._getPreparedSpellLimit(character, 'Fighter', 5)).toBe(0);
        });
    });

    describe('prepareSpell', () => {
        function makeCharacter(intScore, classLevel) {
            return {
                id: 'test-char',
                getAbilityModifier: (ability) => {
                    if (ability === 'intelligence') return Math.floor((intScore - 10) / 2);
                    return 0;
                },
                progression: {
                    classes: [{ name: 'Wizard', levels: classLevel }],
                },
                spellcasting: {
                    classes: {
                        Wizard: {
                            level: 1, // intentionally stale — progression.classes[].levels is the truth
                            spellsKnown: [
                                { name: 'Magic Missile', level: 1, source: 'PHB' },
                                { name: 'Shield', level: 1, source: 'PHB' },
                                { name: 'Misty Step', level: 2, source: 'PHB' },
                                { name: 'Fireball', level: 3, source: 'PHB' },
                                { name: 'Mage Armor', level: 1, source: 'PHB' },
                            ],
                            spellsPrepared: [],
                        },
                    },
                },
            };
        }

        beforeEach(() => {
            classService.getClass.mockReturnValue({
                name: 'Wizard',
                spellcastingAbility: 'int',
                preparedSpells: true,
            });
        });

        it('should prepare a spell when under the limit', () => {
            // Level 2 Wizard, INT 14 (+2) → limit = 4
            const character = makeCharacter(14, 2);
            expect(() =>
                spellSelectionService.prepareSpell(character, 'Wizard', 'Magic Missile'),
            ).not.toThrow();
            expect(character.spellcasting.classes.Wizard.spellsPrepared).toHaveLength(1);
        });

        it('should use progression.classes[].levels (not spellcasting.classes[].level) for the limit', () => {
            // spellcasting.classes.Wizard.level is stale at 1 → limit would be 1+2=3
            // progression.classes[].levels is 2 → correct limit is 2+2=4
            const character = makeCharacter(14, 2);
            spellSelectionService.prepareSpell(character, 'Wizard', 'Magic Missile');
            spellSelectionService.prepareSpell(character, 'Wizard', 'Shield');
            spellSelectionService.prepareSpell(character, 'Wizard', 'Mage Armor');
            // With stale level=1 and INT+2, limit would be 3 and the 4th prepare would throw.
            // With correct level=2 and INT+2, limit is 4 — should succeed.
            expect(() =>
                spellSelectionService.prepareSpell(character, 'Wizard', 'Misty Step'),
            ).not.toThrow();
            expect(character.spellcasting.classes.Wizard.spellsPrepared).toHaveLength(4);
        });

        it('should throw ValidationError when prepared limit is reached', () => {
            // Level 2, INT 10 (+0) → limit = 2
            const character = makeCharacter(10, 2);
            spellSelectionService.prepareSpell(character, 'Wizard', 'Magic Missile');
            spellSelectionService.prepareSpell(character, 'Wizard', 'Shield');
            expect(() =>
                spellSelectionService.prepareSpell(character, 'Wizard', 'Mage Armor'),
            ).toThrow();
        });
    });
});
