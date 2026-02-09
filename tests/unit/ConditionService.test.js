import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/lib/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { conditionService } from '../../src/services/ConditionService.js';

describe('ConditionService', () => {
    const mockConditions = [
        { name: 'Blinded', source: 'PHB', entries: ['A blinded creature...'] },
        { name: 'Charmed', source: 'PHB', entries: ['A charmed creature...'] },
        { name: 'Deafened', source: 'PHB', entries: ['A deafened creature...'] },
    ];

    const mockDiseases = [
        { name: 'Cackle Fever', source: 'DMG', entries: ['...'] },
    ];

    beforeEach(async () => {
        conditionService._data = null;
        conditionService._initPromise = null;
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadConditions').mockResolvedValue({
            condition: mockConditions,
            disease: mockDiseases,
        });

        await conditionService.initialize();
    });

    describe('initialize', () => {
        it('should load conditions and diseases', () => {
            expect(conditionService.isInitialized()).toBe(true);
        });
    });

    describe('getAllConditions', () => {
        it('should return all conditions', () => {
            const conditions = conditionService.getAllConditions();
            expect(conditions).toHaveLength(3);
            expect(conditions[0].name).toBe('Blinded');
        });

        it('should return empty array when data is null', () => {
            conditionService._data = null;
            expect(conditionService.getAllConditions()).toEqual([]);
        });
    });

    describe('getCondition', () => {
        it('should find condition by name', () => {
            const condition = conditionService.getCondition('Blinded');
            expect(condition.name).toBe('Blinded');
        });

        it('should find condition case-insensitively', () => {
            const condition = conditionService.getCondition('blinded');
            expect(condition.name).toBe('Blinded');
        });

        it('should throw NotFoundError for non-existent condition', () => {
            expect(() => conditionService.getCondition('Invisible')).toThrow(
                NotFoundError,
            );
        });

        it('should throw ValidationError for empty name', () => {
            expect(() => conditionService.getCondition('')).toThrow();
        });
    });
});
