import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';

vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

vi.mock('../../src/lib/PrerequisiteValidator.js', () => ({
    checkAllPrerequisites: vi.fn(),
}));

import { checkAllPrerequisites } from '../../src/lib/PrerequisiteValidator.js';
import { optionalFeatureService } from '../../src/services/OptionalFeatureService.js';

describe('OptionalFeatureService', () => {
    const mockFeatures = {
        optionalfeature: [
            { name: 'Agonizing Blast', source: 'PHB', featureType: ['EI'] },
            { name: 'Repelling Blast', source: 'PHB', featureType: ['EI'] },
            { name: 'Fighting Style: Archery', source: 'PHB', featureType: ['FS:F', 'FS:R'] },
            { name: 'Metamagic - Careful Spell', source: 'PHB', featureType: ['MM'] },
        ],
        optionalfeatureFluff: [],
    };

    beforeEach(async () => {
        optionalFeatureService._data = null;
        optionalFeatureService._initPromise = null;
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadJSON')
            .mockResolvedValueOnce({ optionalfeature: mockFeatures.optionalfeature })
            .mockResolvedValueOnce({ optionalfeatureFluff: [] });

        await optionalFeatureService.initialize();
    });

    describe('initialize', () => {
        it('should load optional features', () => {
            expect(optionalFeatureService.isInitialized()).toBe(true);
        });
    });

    describe('getAllOptionalFeatures', () => {
        it('should return all optional features', () => {
            const features = optionalFeatureService.getAllOptionalFeatures();
            expect(features).toHaveLength(4);
        });

        it('should return empty array when data not loaded', () => {
            optionalFeatureService._data = null;
            const features = optionalFeatureService.getAllOptionalFeatures();
            expect(features).toEqual([]);
        });
    });

    describe('getFeaturesByType', () => {
        it('should filter features by single type', () => {
            const eldritch = optionalFeatureService.getFeaturesByType('EI');
            expect(eldritch).toHaveLength(2);
            expect(eldritch[0].name).toBe('Agonizing Blast');
        });

        it('should filter features by array of types', () => {
            const fighting = optionalFeatureService.getFeaturesByType(['FS:F']);
            expect(fighting).toHaveLength(1);
            expect(fighting[0].name).toBe('Fighting Style: Archery');
        });

        it('should return empty array when no features match', () => {
            const result = optionalFeatureService.getFeaturesByType('NONEXISTENT');
            expect(result).toEqual([]);
        });
    });

    describe('meetsPrerequisites', () => {
        it('should delegate to PrerequisiteValidator', () => {
            const feature = mockFeatures.optionalfeature[0];
            const character = { name: 'Test' };
            checkAllPrerequisites.mockReturnValue(true);

            const result = optionalFeatureService.meetsPrerequisites(feature, character, 'Warlock');
            expect(checkAllPrerequisites).toHaveBeenCalledWith(feature, character, { className: 'Warlock' });
            expect(result).toBe(true);
        });
    });

    describe('getFeatureByName', () => {
        it('should find a feature by name and source', () => {
            const feature = optionalFeatureService.getFeatureByName('Agonizing Blast', 'PHB');
            expect(feature.name).toBe('Agonizing Blast');
        });

        it('should find a feature by name only when source not matched', () => {
            const feature = optionalFeatureService.getFeatureByName('Agonizing Blast', 'XGE');
            expect(feature.name).toBe('Agonizing Blast');
        });

        it('should throw NotFoundError for missing feature', () => {
            expect(() => optionalFeatureService.getFeatureByName('Nonexistent')).toThrow(NotFoundError);
        });
    });
});
