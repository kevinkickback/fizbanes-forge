import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/lib/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { BaseDataService } from '../../src/services/BaseDataService.js';

describe('BaseDataService', () => {
    let service;

    beforeEach(() => {
        service = new BaseDataService({ loggerScope: 'TestService' });
        vi.clearAllMocks();
    });

    afterEach(() => {
        service.dispose();
    });

    describe('constructor', () => {
        it('should initialize with null data and no init promise', () => {
            expect(service.isInitialized()).toBe(false);
            expect(service._data).toBeNull();
            expect(service._initPromise).toBeNull();
        });

        it('should accept loadEvent and loggerScope options', () => {
            const s = new BaseDataService({
                loadEvent: 'test:loaded',
                loggerScope: 'MyService',
            });
            expect(s._loadEvent).toBe('test:loaded');
            expect(s._loggerScope).toBe('MyService');
            s.dispose();
        });

        it('should default loggerScope to DataService', () => {
            const s = new BaseDataService();
            expect(s._loggerScope).toBe('DataService');
            s.dispose();
        });
    });

    describe('isInitialized', () => {
        it('should return false when data is null', () => {
            expect(service.isInitialized()).toBe(false);
        });

        it('should return true when data is set', () => {
            service.setData({ items: [] });
            expect(service.isInitialized()).toBe(true);
        });
    });

    describe('setData', () => {
        it('should store data and return it', () => {
            const data = { items: [1, 2, 3] };
            const result = service.setData(data);
            expect(result).toBe(data);
            expect(service._data).toBe(data);
        });
    });

    describe('resetData', () => {
        it('should clear data and init promise', () => {
            service.setData({ test: true });
            service._initPromise = Promise.resolve();

            service.resetData();

            expect(service._data).toBeNull();
            expect(service._initPromise).toBeNull();
        });

        it('should reset when DATA_INVALIDATED event is emitted', () => {
            service.setData({ test: true });

            eventBus.emit(EVENTS.DATA_INVALIDATED);

            expect(service._data).toBeNull();
        });
    });

    describe('initWithLoader', () => {
        it('should load data and mark as initialized', async () => {
            const mockData = { items: ['sword', 'shield'] };
            const loader = vi.fn().mockResolvedValue(mockData);

            await service.initWithLoader(loader);

            expect(loader).toHaveBeenCalledOnce();
            expect(service.isInitialized()).toBe(true);
            expect(service._data).toEqual(mockData);
        });

        it('should return cached data on subsequent calls', async () => {
            const mockData = { items: [] };
            const loader = vi.fn().mockResolvedValue(mockData);

            await service.initWithLoader(loader);
            await service.initWithLoader(loader);

            expect(loader).toHaveBeenCalledOnce();
        });

        it('should call onLoaded callback after loading', async () => {
            const mockData = { feats: [] };
            const onLoaded = vi.fn();

            await service.initWithLoader(() => Promise.resolve(mockData), {
                onLoaded,
            });

            expect(onLoaded).toHaveBeenCalledWith(mockData, { fromCache: false });
        });

        it('should emit load event with emitPayload', async () => {
            const s = new BaseDataService({
                loadEvent: 'test:loaded',
                loggerScope: 'EmitTest',
            });
            const emitSpy = vi.spyOn(eventBus, 'emit');
            const mockData = { items: [1, 2] };

            await s.initWithLoader(() => Promise.resolve(mockData), {
                emitPayload: (data) => data.items,
            });

            // emitLoaded receives [1, 2] — since it's an array, it spreads: emit('test:loaded', 1, 2)
            expect(emitSpy).toHaveBeenCalledWith('test:loaded', 1, 2);
            s.dispose();
        });

        it('should use onError fallback when loader fails', async () => {
            const fallback = { items: [] };
            const onError = vi.fn().mockReturnValue(fallback);

            await service.initWithLoader(
                () => Promise.reject(new Error('Network failure')),
                { onError },
            );

            expect(onError).toHaveBeenCalled();
            expect(service._data).toEqual(fallback);
        });

        it('should throw when loader fails and no onError', async () => {
            await expect(
                service.initWithLoader(() =>
                    Promise.reject(new Error('Network failure')),
                ),
            ).rejects.toThrow('Network failure');

            expect(service.isInitialized()).toBe(false);
        });

        it('should deduplicate concurrent calls', async () => {
            let resolveLoader;
            const loaderPromise = new Promise((r) => {
                resolveLoader = r;
            });
            const loader = vi.fn().mockReturnValue(loaderPromise);

            const p1 = service.initWithLoader(loader);
            const p2 = service.initWithLoader(loader);

            resolveLoader({ data: true });

            const [r1, r2] = await Promise.all([p1, p2]);
            expect(r1).toEqual({ data: true });
            expect(r2).toEqual({ data: true });
            expect(loader).toHaveBeenCalledOnce();
        });
    });

    describe('buildLookupMap', () => {
        it('should build a map keyed by normalized name', () => {
            const items = [
                { name: 'Longsword', source: 'PHB' },
                { name: 'Shield', source: 'PHB' },
            ];
            const map = service.buildLookupMap(items);
            expect(map.size).toBe(2);
            expect(map.get('longsword')).toEqual(items[0]);
        });

        it('should skip items without a name', () => {
            const items = [{ source: 'PHB' }, { name: 'Shield', source: 'PHB' }];
            const map = service.buildLookupMap(items);
            expect(map.size).toBe(1);
        });

        it('should return empty map for empty input', () => {
            const map = service.buildLookupMap([]);
            expect(map.size).toBe(0);
        });

        it('should support allowMultiple option', () => {
            const items = [
                { name: 'Shield', source: 'PHB' },
                { name: 'Shield', source: 'XGE' },
            ];
            const map = service.buildLookupMap(items, { allowMultiple: true });
            expect(map.get('shield')).toHaveLength(2);
        });
    });

    describe('lookupByNameAndSource', () => {
        it('should find item by name', () => {
            const map = new Map([['longsword', { name: 'Longsword', source: 'PHB' }]]);
            const result = service.lookupByNameAndSource(map, 'Longsword');
            expect(result.name).toBe('Longsword');
        });

        it('should return null for missing item', () => {
            const map = new Map();
            expect(service.lookupByNameAndSource(map, 'Nonexistent')).toBeNull();
        });

        it('should return null for null map', () => {
            expect(service.lookupByNameAndSource(null, 'Sword')).toBeNull();
        });

        it('should return null for null name', () => {
            const map = new Map();
            expect(service.lookupByNameAndSource(map, null)).toBeNull();
        });

        it('should prefer exact source match from array', () => {
            const items = [
                { name: 'Shield', source: 'PHB' },
                { name: 'Shield', source: 'XGE' },
            ];
            const map = new Map([['shield', items]]);
            const result = service.lookupByNameAndSource(map, 'Shield', 'XGE');
            expect(result.source).toBe('XGE');
        });
    });

    describe('dispose', () => {
        it('should clear data and event listeners', () => {
            service.setData({ test: true });

            service.dispose();

            expect(service._data).toBeNull();
            expect(service._eventListeners).toEqual([]);
        });

        it('should stop responding to DATA_INVALIDATED after dispose', () => {
            service.setData({ test: true });
            service.dispose();

            // Set data again after dispose
            service.setData({ new: true });
            eventBus.emit(EVENTS.DATA_INVALIDATED);

            // Should NOT be reset since listener was removed
            expect(service._data).toEqual({ new: true });
        });
    });
});
