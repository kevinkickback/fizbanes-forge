import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/lib/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { deityService } from '../../src/services/DeityService.js';

describe('DeityService', () => {
    const mockDeities = [
        { name: 'Tymora', alignment: ['C', 'G'], source: 'PHB' },
        { name: 'Mystra', alignment: ['N', 'G'], source: 'PHB' },
        { name: 'Bane', alignment: ['L', 'E'], source: 'PHB' },
        { name: 'Lathander', alignment: ['N', 'G'], source: 'PHB' },
    ];

    beforeEach(async () => {
        deityService._data = null;
        deityService._initPromise = null;
        deityService.deities = [];
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadJSON').mockResolvedValue({
            deity: mockDeities,
        });

        await deityService.initialize();
    });

    describe('initialize', () => {
        it('should load deities', () => {
            expect(deityService.deities).toHaveLength(4);
        });
    });

    describe('getDeityNames', () => {
        it('should return sorted unique deity names', () => {
            const names = deityService.getDeityNames();
            expect(names).toEqual(['Bane', 'Lathander', 'Mystra', 'Tymora']);
        });

        it('should deduplicate names', () => {
            deityService.deities = [
                { name: 'Tymora', source: 'PHB' },
                { name: 'Tymora', source: 'SCAG' },
            ];
            expect(deityService.getDeityNames()).toEqual(['Tymora']);
        });

        it('should skip deities without a name', () => {
            deityService.deities = [
                { name: 'Tymora' },
                { alignment: ['N'] },
            ];
            expect(deityService.getDeityNames()).toEqual(['Tymora']);
        });
    });

    describe('getDeity', () => {
        it('should find deity by name', () => {
            const deity = deityService.getDeity('Tymora');
            expect(deity.name).toBe('Tymora');
        });

        it('should find deity case-insensitively', () => {
            const deity = deityService.getDeity('tymora');
            expect(deity.name).toBe('Tymora');
        });

        it('should throw NotFoundError for non-existent deity', () => {
            expect(() => deityService.getDeity('Zeus')).toThrow(NotFoundError);
        });

        it('should throw ValidationError for empty name', () => {
            expect(() => deityService.getDeity('')).toThrow();
        });
    });
});
