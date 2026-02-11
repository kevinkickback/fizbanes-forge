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
    EVENTS: { SPELL_ADDED: 'spell:added', SPELL_REMOVED: 'spell:removed' },
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
});
