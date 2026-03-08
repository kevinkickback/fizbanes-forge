import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock EventBus before importing DataLoader
vi.mock('../../src/lib/EventBus.js', () => {
    const listeners = {};
    return {
        eventBus: {
            emit: vi.fn((event, data) => {
                if (listeners[event]) {
                    listeners[event].forEach((fn) => { fn(data); });
                }
            }),
            on: vi.fn((event, fn) => {
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(fn);
            }),
            off: vi.fn(),
        },
        EVENTS: {
            DATA_FILE_LOADING: 'DATA_FILE_LOADING',
            DATA_INVALIDATED: 'DATA_INVALIDATED',
        },
    };
});

const { DataLoader } = await import('../../src/lib/DataLoader.js');
const { eventBus, EVENTS } = await import('../../src/lib/EventBus.js');

describe('DataLoader', () => {
    let mockLoadJSON;

    beforeEach(() => {
        DataLoader.clearCache();
        vi.clearAllMocks();

        mockLoadJSON = vi.fn().mockResolvedValue({
            success: true,
            data: { test: 'data' },
        });

        vi.stubGlobal('window', {
            data: { loadJSON: mockLoadJSON },
        });
    });

    describe('loadJSON', () => {
        it('should load data via window.data.loadJSON on cache miss', async () => {
            const result = await DataLoader.loadJSON('skills.json');

            expect(result).toEqual({ test: 'data' });
            expect(mockLoadJSON).toHaveBeenCalledWith('skills.json');
        });

        it('should return cached data without re-fetching on cache hit', async () => {
            await DataLoader.loadJSON('skills.json');
            const result = await DataLoader.loadJSON('skills.json');

            expect(result).toEqual({ test: 'data' });
            expect(mockLoadJSON).toHaveBeenCalledTimes(1);
        });

        it('should deduplicate concurrent requests for the same URL', async () => {
            const [r1, r2, r3] = await Promise.all([
                DataLoader.loadJSON('races.json'),
                DataLoader.loadJSON('races.json'),
                DataLoader.loadJSON('races.json'),
            ]);

            expect(r1).toEqual({ test: 'data' });
            expect(r2).toEqual({ test: 'data' });
            expect(r3).toEqual({ test: 'data' });
            expect(mockLoadJSON).toHaveBeenCalledTimes(1);
        });

        it('should clean up loading state on fetch failure', async () => {
            mockLoadJSON.mockResolvedValueOnce({
                success: false,
                error: 'File not found',
            });

            await expect(DataLoader.loadJSON('missing.json')).rejects.toThrow(
                'File not found',
            );

            // A subsequent attempt should call loadJSON again (not stuck in loading)
            mockLoadJSON.mockResolvedValueOnce({
                success: true,
                data: { recovered: true },
            });
            const result = await DataLoader.loadJSON('missing.json');
            expect(result).toEqual({ recovered: true });
            expect(mockLoadJSON).toHaveBeenCalledTimes(2);
        });

        it('should clean up loading state when IPC throws', async () => {
            mockLoadJSON.mockRejectedValueOnce(new Error('IPC crash'));

            await expect(DataLoader.loadJSON('crash.json')).rejects.toThrow(
                'IPC crash',
            );

            // Retry should work
            mockLoadJSON.mockResolvedValueOnce({
                success: true,
                data: { ok: true },
            });
            const result = await DataLoader.loadJSON('crash.json');
            expect(result).toEqual({ ok: true });
        });

        it('should emit DATA_FILE_LOADING event on cache miss', async () => {
            await DataLoader.loadJSON('feats.json');

            expect(eventBus.emit).toHaveBeenCalledWith(EVENTS.DATA_FILE_LOADING, {
                url: 'feats.json',
            });
        });

        it('should throw DataError when window.data.loadJSON is not available', async () => {
            vi.stubGlobal('window', {});

            await expect(DataLoader.loadJSON('test.json')).rejects.toThrow(
                'window.data.loadJSON not available',
            );
        });
    });

    describe('LRU cache eviction', () => {
        it('should evict least recently used entry when cache is full', async () => {
            // Fill cache to MAX_CACHE_SIZE (200)
            for (let i = 0; i < 200; i++) {
                mockLoadJSON.mockResolvedValueOnce({
                    success: true,
                    data: { id: i },
                });
                await DataLoader.loadJSON(`file${i}.json`);
            }

            // Access file0 to move it to MRU
            const cached = await DataLoader.loadJSON('file0.json');
            expect(cached).toEqual({ id: 0 });

            // Add one more entry — should evict file1 (LRU), not file0
            mockLoadJSON.mockResolvedValueOnce({
                success: true,
                data: { id: 'new' },
            });
            await DataLoader.loadJSON('new-file.json');

            // file1 should be evicted, requiring a new fetch
            mockLoadJSON.mockResolvedValueOnce({
                success: true,
                data: { id: 'reloaded-1' },
            });
            const reloaded = await DataLoader.loadJSON('file1.json');
            expect(reloaded).toEqual({ id: 'reloaded-1' });

            // file0 should still be cached (was accessed recently)
            const callsBefore = mockLoadJSON.mock.calls.length;
            const stillCached = await DataLoader.loadJSON('file0.json');
            expect(stillCached).toEqual({ id: 0 });
            expect(mockLoadJSON.mock.calls.length).toBe(callsBefore);
        });
    });

    describe('clearCache', () => {
        it('should clear all cached entries', async () => {
            await DataLoader.loadJSON('skills.json');
            expect(mockLoadJSON).toHaveBeenCalledTimes(1);

            DataLoader.clearCache();

            await DataLoader.loadJSON('skills.json');
            expect(mockLoadJSON).toHaveBeenCalledTimes(2);
        });
    });

    describe('resetAll', () => {
        it('should emit DATA_INVALIDATED event', () => {
            DataLoader.resetAll();
            expect(eventBus.emit).toHaveBeenCalledWith(EVENTS.DATA_INVALIDATED);
        });
    });

    describe('convenience loaders', () => {
        it('should load skills via loadSkills', async () => {
            mockLoadJSON.mockResolvedValueOnce({
                success: true,
                data: { skill: [] },
            });
            const result = await DataLoader.loadSkills();
            expect(result).toEqual({ skill: [] });
            expect(mockLoadJSON).toHaveBeenCalledWith('skills.json');
        });

        it('should load races via loadRaces', async () => {
            mockLoadJSON.mockResolvedValueOnce({
                success: true,
                data: { race: [] },
            });
            const result = await DataLoader.loadRaces();
            expect(result).toEqual({ race: [] });
            expect(mockLoadJSON).toHaveBeenCalledWith('races.json');
        });

        it('should load backgrounds via loadBackgrounds', async () => {
            mockLoadJSON.mockResolvedValueOnce({
                success: true,
                data: { background: [] },
            });
            const result = await DataLoader.loadBackgrounds();
            expect(result).toEqual({ background: [] });
            expect(mockLoadJSON).toHaveBeenCalledWith('backgrounds.json');
        });
    });

    describe('loadSources', () => {
        it('should return fallback on failure', async () => {
            mockLoadJSON.mockRejectedValueOnce(new Error('not found'));
            const result = await DataLoader.loadSources();
            expect(result).toEqual({ source: [] });
        });
    });
});
