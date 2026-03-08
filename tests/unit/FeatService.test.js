import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { featService } from '../../src/services/FeatService.js';

const mockFeats = [
    {
        name: 'Alert',
        source: 'PHB',
        entries: ['You gain a +5 bonus to initiative.'],
    },
    {
        name: 'Great Weapon Master',
        source: 'PHB',
        entries: ['Heavy weapon attacks.'],
        prerequisite: [{ ability: [{ str: 13 }] }],
    },
    {
        name: 'Sharpshooter',
        source: 'PHB',
        entries: ['Ranged attack mastery.'],
    },
    {
        name: 'War Caster',
        source: 'PHB',
        entries: ['Spellcasting in combat.'],
        prerequisite: [{ spellcasting: true }],
    },
    {
        name: 'Tough',
        source: 'PHB',
        entries: ['Extra hit points.'],
    },
];

describe('FeatService', () => {
    beforeEach(async () => {
        featService._data = null;
        featService._initPromise = null;
        featService._featMap = null;
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadFeats').mockResolvedValue({ feat: mockFeats });

        await featService.initialize();
    });

    describe('initialize', () => {
        it('should load feats and build lookup map', () => {
            expect(featService.isInitialized()).toBe(true);
            expect(featService._featMap).toBeInstanceOf(Map);
            expect(featService._featMap.size).toBe(5);
        });

        it('should skip feats without names', async () => {
            featService._data = null;
            featService._initPromise = null;
            featService._featMap = null;

            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            vi.spyOn(DataLoader, 'loadFeats').mockResolvedValue({
                feat: [{ source: 'PHB' }, { name: 'Alert', source: 'PHB' }],
            });

            await featService.initialize();
            expect(featService._featMap.size).toBe(1);
        });
    });

    describe('resetData', () => {
        it('should clear data', () => {
            featService.resetData();
            expect(featService._data).toBeNull();
        });

        it('should reset via DATA_INVALIDATED event', () => {
            eventBus.emit(EVENTS.DATA_INVALIDATED);
            expect(featService._data).toBeNull();
        });
    });

    describe('getAllFeats', () => {
        it('should return all loaded feats', () => {
            expect(featService.getAllFeats()).toHaveLength(5);
        });

        it('should return empty array when data is null', () => {
            featService._data = null;
            expect(featService.getAllFeats()).toEqual([]);
        });
    });

    describe('getFeat', () => {
        it('should find feat by name', () => {
            const feat = featService.getFeat('Alert');
            expect(feat.name).toBe('Alert');
        });

        it('should find feat case-insensitively', () => {
            const feat = featService.getFeat('great weapon master');
            expect(feat.name).toBe('Great Weapon Master');
        });

        it('should throw NotFoundError for unknown feat', () => {
            expect(() => featService.getFeat('Nonexistent Feat')).toThrow(NotFoundError);
        });

        it('should throw NotFoundError when feat map is null', () => {
            featService._featMap = null;
            expect(() => featService.getFeat('Alert')).toThrow(NotFoundError);
        });

        it('should throw ValidationError for empty name', () => {
            expect(() => featService.getFeat('')).toThrow();
        });
    });

    describe('isFeatValidForCharacter', () => {
        it('should return true for feat with no prerequisites', () => {
            const alert = featService.getFeat('Alert');
            const character = {};
            expect(featService.isFeatValidForCharacter(alert, character)).toBe(true);
        });
    });
});
