import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../../src/lib/Errors.js';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/lib/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { skillService } from '../../src/services/SkillService.js';

describe('SkillService', () => {
    const mockSkills = [
        { name: 'Acrobatics', ability: 'dex', source: 'PHB' },
        { name: 'Athletics', ability: 'str', source: 'PHB' },
        { name: 'Arcana', ability: 'int', source: 'PHB' },
        { name: 'Deception', ability: 'cha', source: 'PHB' },
        { name: 'Insight', ability: 'wis', source: 'PHB' },
        { name: 'Perception', ability: 'wis', source: 'PHB' },
        { name: 'Stealth', ability: 'dex', source: 'PHB' },
    ];

    beforeEach(async () => {
        skillService._data = null;
        skillService._initPromise = null;
        skillService._skillMap = null;
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadSkills').mockResolvedValue({
            skill: mockSkills,
        });

        await skillService.initialize();
    });

    describe('initialize', () => {
        it('should load skills and build lookup map', () => {
            expect(skillService.isInitialized()).toBe(true);
            expect(skillService._skillMap).toBeInstanceOf(Map);
            expect(skillService._skillMap.size).toBe(7);
        });
    });

    describe('resetData', () => {
        it('should clear data and skill map', () => {
            skillService.resetData();

            expect(skillService._data).toBeNull();
            expect(skillService._skillMap).toBeNull();
        });

        it('should reset via DATA_INVALIDATED event', () => {
            eventBus.emit(EVENTS.DATA_INVALIDATED);

            expect(skillService._data).toBeNull();
            expect(skillService._skillMap).toBeNull();
        });
    });

    describe('getSkillsByAbility', () => {
        it('should return skills for a full ability name', () => {
            const skills = skillService.getSkillsByAbility('dexterity');
            expect(skills).toHaveLength(2);
            expect(skills.map((s) => s.name)).toContain('Acrobatics');
            expect(skills.map((s) => s.name)).toContain('Stealth');
        });

        it('should return skills for an abbreviated ability name', () => {
            const skills = skillService.getSkillsByAbility('wis');
            expect(skills).toHaveLength(2);
            expect(skills.map((s) => s.name)).toContain('Insight');
            expect(skills.map((s) => s.name)).toContain('Perception');
        });

        it('should return skills case-insensitively', () => {
            const skills = skillService.getSkillsByAbility('Strength');
            expect(skills).toHaveLength(1);
            expect(skills[0].name).toBe('Athletics');
        });

        it('should return empty array for ability with no skills', () => {
            const skills = skillService.getSkillsByAbility('constitution');
            expect(skills).toEqual([]);
        });

        it('should throw ValidationError for invalid ability name', () => {
            expect(() => skillService.getSkillsByAbility('luck')).toThrow(
                ValidationError,
            );
        });

        it('should throw for empty ability name', () => {
            expect(() => skillService.getSkillsByAbility('')).toThrow();
        });

        it('should return empty array when data is null', () => {
            skillService._data = null;
            expect(skillService.getSkillsByAbility('dexterity')).toEqual([]);
        });
    });
});
