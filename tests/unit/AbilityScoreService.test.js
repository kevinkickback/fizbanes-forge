import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

vi.mock('../../src/app/CharacterManager.js', () => ({
    CharacterManager: {
        getCurrentCharacter: vi.fn(),
    },
}));

import { CharacterManager } from '../../src/app/CharacterManager.js';
import { abilityScoreService } from '../../src/services/AbilityScoreService.js';

describe('AbilityScoreService', () => {
    const mockCharacter = {
        abilityScores: {
            strength: 16,
            dexterity: 14,
            constitution: 12,
            intelligence: 10,
            wisdom: 8,
            charisma: 13,
        },
        race: {
            abilityBonuses: {
                strength: 2,
                constitution: 1,
            },
        },
        abilityBonuses: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        CharacterManager.getCurrentCharacter.mockReturnValue(mockCharacter);
        abilityScoreService._assignedStandardArrayValues = {};
        abilityScoreService.abilityChoices.clear();
    });

    describe('normalizeAbilityName', () => {
        it('should normalize abbreviation to full name', () => {
            expect(abilityScoreService.normalizeAbilityName('str')).toBe('strength');
        });

        it('should normalize full name', () => {
            expect(abilityScoreService.normalizeAbilityName('Strength')).toBe('strength');
        });

        it('should return empty string for non-string input', () => {
            expect(abilityScoreService.normalizeAbilityName(null)).toBe('');
            expect(abilityScoreService.normalizeAbilityName(123)).toBe('');
        });

        it('should return empty string for blank input', () => {
            expect(abilityScoreService.normalizeAbilityName('')).toBe('');
            expect(abilityScoreService.normalizeAbilityName('  ')).toBe('');
        });
    });

    describe('getAllAbilities', () => {
        it('should return all six ability abbreviations', () => {
            const abilities = abilityScoreService.getAllAbilities();
            expect(abilities).toHaveLength(6);
            expect(abilities).toContain('str');
            expect(abilities).toContain('dex');
            expect(abilities).toContain('cha');
        });

        it('should return a copy', () => {
            const a = abilityScoreService.getAllAbilities();
            const b = abilityScoreService.getAllAbilities();
            expect(a).not.toBe(b);
            expect(a).toEqual(b);
        });
    });

    describe('getBaseScore', () => {
        it('should return base score from character', () => {
            expect(abilityScoreService.getBaseScore('str')).toBe(16);
        });

        it('should return default 8 when no character', () => {
            CharacterManager.getCurrentCharacter.mockReturnValue(null);
            expect(abilityScoreService.getBaseScore('str')).toBe(8);
        });

        it('should return default 8 for missing ability', () => {
            const char = { abilityScores: {} };
            CharacterManager.getCurrentCharacter.mockReturnValue(char);
            expect(abilityScoreService.getBaseScore('str')).toBe(8);
        });
    });

    describe('getTotalScore', () => {
        it('should include racial bonuses', () => {
            // base 16 + racial 2 = 18
            expect(abilityScoreService.getTotalScore('str')).toBe(18);
        });

        it('should return base score when no bonuses', () => {
            // dex has base 14 and no racial bonus
            expect(abilityScoreService.getTotalScore('dex')).toBe(14);
        });

        it('should include ability bonuses from other sources', () => {
            const charWithBonuses = {
                ...mockCharacter,
                abilityBonuses: {
                    dexterity: [{ value: 1, source: 'ASI' }],
                },
            };
            CharacterManager.getCurrentCharacter.mockReturnValue(charWithBonuses);
            // base 14 + bonus 1 = 15
            expect(abilityScoreService.getTotalScore('dex')).toBe(15);
        });

        it('should return 8 when no character', () => {
            CharacterManager.getCurrentCharacter.mockReturnValue(null);
            expect(abilityScoreService.getTotalScore('str')).toBe(8);
        });
    });

    describe('getModifier', () => {
        it('should calculate correct modifier for score 18', () => {
            // str total = 18, modifier = +4
            expect(abilityScoreService.getModifier('str')).toBe(4);
        });

        it('should calculate correct modifier for score 8', () => {
            // wis base = 8, no bonus, modifier = -1
            expect(abilityScoreService.getModifier('wis')).toBe(-1);
        });

        it('should calculate correct modifier for score 10', () => {
            // int base = 10, modifier = 0
            expect(abilityScoreService.getModifier('int')).toBe(0);
        });
    });

    describe('getModifierString', () => {
        it('should return formatted positive modifier', () => {
            const str = abilityScoreService.getModifierString('str');
            expect(str).toContain('+');
        });

        it('should return formatted negative modifier', () => {
            const str = abilityScoreService.getModifierString('wis');
            expect(str).toContain('-');
        });
    });

    describe('updateAbilityScore', () => {
        it('should update ability score on character', () => {
            const char = { abilityScores: { strength: 10 } };
            CharacterManager.getCurrentCharacter.mockReturnValue(char);

            abilityScoreService.updateAbilityScore('str', 15);
            expect(char.abilityScores.strength).toBe(15);
        });

        it('should initialize abilityScores if missing', () => {
            const char = {};
            CharacterManager.getCurrentCharacter.mockReturnValue(char);

            abilityScoreService.updateAbilityScore('str', 12);
            expect(char.abilityScores).toBeDefined();
            expect(char.abilityScores.strength).toBe(12);
        });

        it('should not throw when no character selected', () => {
            CharacterManager.getCurrentCharacter.mockReturnValue(null);
            expect(() => abilityScoreService.updateAbilityScore('str', 10)).not.toThrow();
        });
    });

    describe('point buy', () => {
        it('should return valid point buy scores', () => {
            const scores = abilityScoreService.getValidPointBuyScores();
            expect(scores).toContain(8);
            expect(scores).toContain(15);
            expect(scores[0]).toBeLessThan(scores[scores.length - 1]);
        });

        it('should return point buy budget', () => {
            expect(abilityScoreService.getMaxPoints()).toBe(27);
        });

        it('should calculate used points', () => {
            const used = abilityScoreService.getUsedPoints();
            expect(typeof used).toBe('number');
        });

        it('should return point cost class', () => {
            expect(abilityScoreService.getPointCostClass(7)).toBe('high');
            expect(abilityScoreService.getPointCostClass(4)).toBe('medium');
            expect(abilityScoreService.getPointCostClass(1)).toBe('low');
        });
    });

    describe('standard array', () => {
        it('should return standard array values', () => {
            const values = abilityScoreService.getStandardArrayValues();
            expect(values).toEqual([15, 14, 13, 12, 10, 8]);
        });

        it('should track assigned standard array values', () => {
            abilityScoreService._assignedStandardArrayValues = { strength: 15 };
            expect(abilityScoreService.isStandardArrayValueAssigned(15)).toBe(true);
            expect(abilityScoreService.isStandardArrayValueAssigned(14)).toBe(false);
        });
    });
});
