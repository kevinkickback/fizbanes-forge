import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { itemService } from '../../src/services/ItemService.js';

describe('ItemService', () => {
    const mockItems = [
        { name: 'Longsword', source: 'PHB', weight: 3, type: 'M' },
        { name: 'Shield', source: 'PHB', weight: 6, type: 'S' },
        { name: 'Potion of Healing', source: 'PHB', weight: 0.5, type: 'P' },
        { name: 'Bag of Holding', source: 'DMG', weight: 15, rarity: 'uncommon' },
    ];

    const mockBaseItems = [
        { name: 'Leather Armor', source: 'PHB', type: 'LA', weight: 10 },
        { name: 'Chain Mail', source: 'PHB', type: 'HA', weight: 55 },
    ];

    beforeEach(async () => {
        itemService._data = null;
        itemService._initPromise = null;
        itemService._itemLookupMap = null;
        itemService._baseItemLookupMap = null;
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadJSON').mockImplementation((file) => {
            if (file === 'items.json') {
                return Promise.resolve({ item: mockItems });
            }
            if (file === 'items-base.json') {
                return Promise.resolve({ baseitem: mockBaseItems });
            }
            return Promise.resolve({});
        });

        await itemService.initialize();
    });

    describe('initialize', () => {
        it('should load items and build lookup maps', () => {
            expect(itemService.isInitialized()).toBe(true);
            expect(itemService._itemLookupMap).toBeInstanceOf(Map);
            expect(itemService._baseItemLookupMap).toBeInstanceOf(Map);
        });

        it('should recover when items.json fails', async () => {
            itemService._data = null;
            itemService._initPromise = null;
            itemService._itemLookupMap = null;
            itemService._baseItemLookupMap = null;

            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            vi.spyOn(DataLoader, 'loadJSON').mockImplementation((file) => {
                if (file === 'items.json') {
                    return Promise.reject(new Error('File not found'));
                }
                return Promise.resolve({ baseitem: mockBaseItems });
            });

            await itemService.initialize();

            // Should still have base items
            expect(itemService.getAllItems()).toEqual([]);
            expect(itemService.getAllBaseItems()).toHaveLength(2);
        });
    });

    describe('resetData', () => {
        it('should clear data and lookup maps', () => {
            itemService.resetData();

            expect(itemService._data).toBeNull();
            expect(itemService._itemLookupMap).toBeNull();
            expect(itemService._baseItemLookupMap).toBeNull();
        });

        it('should reset via DATA_INVALIDATED event', () => {
            eventBus.emit(EVENTS.DATA_INVALIDATED);

            expect(itemService._data).toBeNull();
            expect(itemService._itemLookupMap).toBeNull();
        });
    });

    describe('getAllItems', () => {
        it('should return all items', () => {
            expect(itemService.getAllItems()).toHaveLength(4);
        });

        it('should return empty array when data is null', () => {
            itemService._data = null;
            expect(itemService.getAllItems()).toEqual([]);
        });
    });

    describe('getAllBaseItems', () => {
        it('should return all base items', () => {
            expect(itemService.getAllBaseItems()).toHaveLength(2);
        });

        it('should return empty array when data is null', () => {
            itemService._data = null;
            expect(itemService.getAllBaseItems()).toEqual([]);
        });
    });

    describe('getItem', () => {
        it('should find item by name', () => {
            const item = itemService.getItem('Longsword');
            expect(item.name).toBe('Longsword');
        });

        it('should find item with explicit source', () => {
            const item = itemService.getItem('Bag of Holding', 'DMG');
            expect(item.name).toBe('Bag of Holding');
            expect(item.source).toBe('DMG');
        });

        it('should fall back to base items when regular item not found', () => {
            const armor = itemService.getItem('Leather Armor');
            expect(armor.name).toBe('Leather Armor');
            expect(armor.type).toBe('LA');
        });

        it('should throw NotFoundError for non-existent item', () => {
            expect(() => itemService.getItem('Vorpal Sword')).toThrow(
                NotFoundError,
            );
        });

        it('should throw ValidationError for empty name', () => {
            expect(() => itemService.getItem('')).toThrow();
        });
    });
});
