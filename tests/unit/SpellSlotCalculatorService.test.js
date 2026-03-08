import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/ClassService.js', () => ({
    classService: {
        getClass: vi.fn(),
    },
}));

import { classService } from '../../src/services/ClassService.js';
import { spellSlotCalculatorService } from '../../src/services/SpellSlotCalculatorService.js';

describe('SpellSlotCalculatorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('calculateSpellSlots', () => {
        it('should return empty object for non-caster class', () => {
            classService.getClass.mockReturnValue({ name: 'Fighter' });
            expect(spellSlotCalculatorService.calculateSpellSlots('Fighter', 5)).toEqual({});
        });

        it('should return empty object for unknown class', () => {
            classService.getClass.mockReturnValue(null);
            expect(spellSlotCalculatorService.calculateSpellSlots('Unknown', 1)).toEqual({});
        });

        it('should use data-driven slots from classTableGroups', () => {
            classService.getClass.mockReturnValue({
                name: 'Wizard',
                casterProgression: 'full',
                classTableGroups: [{ rowsSpellProgression: [[2], [3], [4, 2]] }],
            });
            const slots = spellSlotCalculatorService.calculateSpellSlots('Wizard', 3);
            expect(slots).toEqual({
                1: { max: 4, current: 4 },
                2: { max: 2, current: 2 },
            });
        });

        it('should fall back to standard slots for full caster without classTableGroups', () => {
            classService.getClass.mockReturnValue({
                name: 'Wizard',
                casterProgression: 'full',
            });
            const slots = spellSlotCalculatorService.calculateSpellSlots('Wizard', 1);
            expect(slots).toEqual({ 1: { max: 2, current: 2 } });
        });

        it('should calculate half-caster slots', () => {
            classService.getClass.mockReturnValue({
                name: 'Paladin',
                casterProgression: '1/2',
            });
            // Level 4 paladin = caster level 2
            const slots = spellSlotCalculatorService.calculateSpellSlots('Paladin', 4);
            expect(slots).toEqual({ 1: { max: 3, current: 3 } });
        });

        it('should calculate third-caster slots', () => {
            classService.getClass.mockReturnValue({
                name: 'Eldritch Knight',
                casterProgression: '1/3',
            });
            // Level 3 EK = caster level 1
            const slots = spellSlotCalculatorService.calculateSpellSlots('Eldritch Knight', 3);
            expect(slots).toEqual({ 1: { max: 2, current: 2 } });
        });

        it('should return pact magic slots for warlock', () => {
            classService.getClass.mockReturnValue({
                name: 'Warlock',
                casterProgression: 'pact',
            });
            const slots = spellSlotCalculatorService.calculateSpellSlots('Warlock', 5);
            expect(slots[3]).toEqual({ max: [2], current: [2], isPactMagic: true });
        });

        it('should use pact magic from data when classTableGroups present', () => {
            classService.getClass.mockReturnValue({
                name: 'Warlock',
                casterProgression: 'pact',
                classTableGroups: [{
                    rows: [
                        [0, 0, 1, '{@filter 1st|spells|level=1|class=Warlock}'],
                        [0, 0, 2, '{@filter 1st|spells|level=1|class=Warlock}'],
                    ],
                }],
            });
            const slots = spellSlotCalculatorService.calculateSpellSlots('Warlock', 2);
            expect(slots).toEqual({
                1: { max: 2, current: 2, isPactMagic: true },
            });
        });
    });

    describe('getStandardSpellSlots', () => {
        it('should return empty for caster level 0', () => {
            expect(spellSlotCalculatorService.getStandardSpellSlots(0)).toEqual({});
        });

        it('should return correct slots for caster level 1', () => {
            expect(spellSlotCalculatorService.getStandardSpellSlots(1)).toEqual({
                1: { max: 2, current: 2 },
            });
        });

        it('should return correct slots for caster level 5', () => {
            const slots = spellSlotCalculatorService.getStandardSpellSlots(5);
            expect(slots[1]).toEqual({ max: 4, current: 4 });
            expect(slots[2]).toEqual({ max: 3, current: 3 });
            expect(slots[3]).toEqual({ max: 2, current: 2 });
        });

        it('should return correct slots for caster level 20 (max)', () => {
            const slots = spellSlotCalculatorService.getStandardSpellSlots(19);
            expect(slots[9]).toEqual({ max: 1, current: 1 });
        });

        it('should return empty for invalid caster levels', () => {
            expect(spellSlotCalculatorService.getStandardSpellSlots(-1)).toEqual({});
            expect(spellSlotCalculatorService.getStandardSpellSlots(21)).toEqual({});
        });
    });
});
