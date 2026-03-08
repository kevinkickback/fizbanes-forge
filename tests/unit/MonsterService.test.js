import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';

vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { monsterService } from '../../src/services/MonsterService.js';

describe('MonsterService', () => {
    const mockIndex = {
        'goblin': 'bestiary-mm.json',
        'dragon-red-ancient': 'bestiary-mm.json',
        'beholder': 'bestiary-mm.json',
    };

    beforeEach(async () => {
        monsterService._data = null;
        monsterService._initPromise = null;
        monsterService._monsterIndex = null;
        monsterService._monsterSummary = [];
        monsterService._monsterDetailsCache.clear();
        monsterService._cacheAccessOrder = [];
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadJSON').mockResolvedValue(mockIndex);

        await monsterService.initialize();
    });

    describe('initialize', () => {
        it('should load monster index', () => {
            expect(monsterService.isInitialized()).toBe(true);
            expect(monsterService._monsterIndex).toEqual(mockIndex);
        });

        it('should build summary array from index', () => {
            const monsters = monsterService.getAllMonsters();
            expect(monsters).toHaveLength(3);
            expect(monsters[0]).toHaveProperty('id');
            expect(monsters[0]).toHaveProperty('file');
        });
    });

    describe('getAllMonsters', () => {
        it('should return all monster summaries', () => {
            const all = monsterService.getAllMonsters();
            expect(all).toHaveLength(3);
        });
    });

    describe('getMonsterDetails', () => {
        it('should load and cache monster details', async () => {
            const mockDetails = { monster: [{ name: 'Goblin', hp: { average: 7 } }] };
            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            DataLoader.loadJSON.mockResolvedValue(mockDetails);

            const details = await monsterService.getMonsterDetails('goblin');
            expect(details).toEqual(mockDetails);
            expect(monsterService._monsterDetailsCache.has('goblin')).toBe(true);
        });

        it('should return cached details on subsequent calls', async () => {
            const mockDetails = { monster: [{ name: 'Goblin' }] };
            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            DataLoader.loadJSON.mockResolvedValue(mockDetails);

            await monsterService.getMonsterDetails('goblin');
            const cachedResult = await monsterService.getMonsterDetails('goblin');
            expect(cachedResult).toEqual(mockDetails);
            // loadJSON called once for index + once for details = only 1 extra call
            expect(DataLoader.loadJSON).toHaveBeenCalledTimes(2);
        });

        it('should throw NotFoundError for missing monster ID', async () => {
            await expect(monsterService.getMonsterDetails('unicorn')).rejects.toThrow(NotFoundError);
        });

        it('should throw NotFoundError when index not initialized', async () => {
            monsterService._monsterIndex = null;
            await expect(monsterService.getMonsterDetails('goblin')).rejects.toThrow(NotFoundError);
        });

        it('should evict LRU entry when cache exceeds max size', async () => {
            monsterService._maxCacheSize = 3;
            const { DataLoader } = await import('../../src/lib/DataLoader.js');

            for (let i = 0; i < 4; i++) {
                const id = `monster-${i}`;
                monsterService._monsterIndex[id] = `file-${i}.json`;
                DataLoader.loadJSON.mockResolvedValueOnce({ name: `Monster ${i}` });
                await monsterService.getMonsterDetails(id);
            }

            // First entry should have been evicted
            expect(monsterService._monsterDetailsCache.has('monster-0')).toBe(false);
            expect(monsterService._monsterDetailsCache.size).toBe(3);
        });

        it('should update access order on cache hit', async () => {
            monsterService._maxCacheSize = 3;
            const { DataLoader } = await import('../../src/lib/DataLoader.js');

            // Add 3 entries
            for (let i = 0; i < 3; i++) {
                const id = `monster-${i}`;
                monsterService._monsterIndex[id] = `file-${i}.json`;
                DataLoader.loadJSON.mockResolvedValueOnce({ name: `Monster ${i}` });
                await monsterService.getMonsterDetails(id);
            }

            // Access monster-0 to move it to end
            await monsterService.getMonsterDetails('monster-0');

            // Add a 4th entry — should evict monster-1 (now LRU), not monster-0
            monsterService._monsterIndex['monster-3'] = 'file-3.json';
            DataLoader.loadJSON.mockResolvedValueOnce({ name: 'Monster 3' });
            await monsterService.getMonsterDetails('monster-3');

            expect(monsterService._monsterDetailsCache.has('monster-0')).toBe(true);
            expect(monsterService._monsterDetailsCache.has('monster-1')).toBe(false);
        });
    });

    describe('resetData', () => {
        it('should clear index, summary, and cache', () => {
            monsterService._monsterDetailsCache.set('test', { name: 'Test' });
            monsterService.resetData();
            expect(monsterService._monsterIndex).toBeNull();
            expect(monsterService._monsterSummary).toHaveLength(0);
            expect(monsterService._monsterDetailsCache.size).toBe(0);
        });
    });
});
