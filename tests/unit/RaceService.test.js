import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/lib/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { raceService } from '../../src/services/RaceService.js';

describe('RaceService', () => {
    // Mock race data with various scenarios
    const mockRaces = [
        {
            name: 'Human',
            source: 'PHB',
            ability: [{ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }],
        },
        {
            name: 'Elf',
            source: 'PHB',
            ability: [{ dex: 2 }],
        },
        {
            name: 'Dragonborn',
            source: 'PHB',
            ability: [{ str: 2, cha: 1 }],
            _versions: [
                {
                    name: 'Chromatic Dragonborn',
                    source: 'FTD',
                },
                {
                    name: 'Metallic Dragonborn',
                    source: 'FTD',
                },
            ],
        },
        {
            name: 'Gem Dragonborn',
            source: 'FTD',
            _versions: [
                {
                    _abstract: { color: 'Amethyst' },
                    _implementations: [
                        { _variables: { color: 'Amethyst' } },
                        { _variables: { color: 'Crystal' } },
                        { _variables: { color: 'Emerald' } },
                    ],
                },
            ],
        },
    ];

    const mockSubraces = [
        {
            name: 'High Elf',
            raceName: 'Elf',
            raceSource: 'PHB',
            source: 'PHB',
            ability: [{ int: 1 }],
        },
        {
            name: 'Wood Elf',
            raceName: 'Elf',
            raceSource: 'PHB',
            source: 'PHB',
            ability: [{ wis: 1 }],
        },
        {
            name: 'Drow',
            raceName: 'Elf',
            raceSource: 'PHB',
            source: 'PHB',
            ability: [{ cha: 1 }],
        },
        // Base subrace (no name field)
        {
            raceName: 'Dragonborn',
            raceSource: 'PHB',
            source: 'PHB',
            ability: [],
        },
    ];

    const mockFluff = [
        {
            name: 'Human',
            source: 'PHB',
            entries: ['Humans are the most adaptable people.'],
        },
        {
            name: 'Elf',
            source: 'PHB',
            entries: ['Elves are a magical people.'],
        },
    ];

    beforeEach(() => {
        // Reset the service state
        raceService._data = null;
        raceService._raceIndex = null;
        raceService._isInitialized = false;
        raceService._initPromise = null;
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with race data', async () => {
            // Mock DataLoader
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: mockFluff,
            });

            await raceService.initialize();

            expect(raceService._data).toBeDefined();
            expect(raceService._data.race).toHaveLength(4);
            expect(raceService._raceIndex).toBeInstanceOf(Map);
            expect(raceService._raceIndex.size).toBeGreaterThan(0);
        });

        it('should use fallback data if race data is null', async () => {
            const { AppState } = await import('../../src/app/AppState.js');
            AppState.setLoadedData('races', null); // Clear cached races

            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue(null);

            // Service handles error with fallback data
            await raceService.initialize();

            expect(raceService._data).toBeDefined();
            expect(raceService._data.race).toEqual([]);
            expect(raceService._data.subrace).toEqual([]);
        });

        it('should handle missing fluff data gracefully', async () => {
            const { AppState } = await import('../../src/app/AppState.js');
            AppState.setLoadedData('races', null); // Clear cached races

            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockRejectedValue(
                new Error('Fluff not found'),
            );

            await raceService.initialize();

            expect(raceService._data.raceFluff).toEqual([]);
        });

        it('should build race index on initialization', async () => {
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });

            await raceService.initialize();

            expect(raceService._raceIndex.has('human:PHB')).toBe(true);
            expect(raceService._raceIndex.has('elf:PHB')).toBe(true);
        });
    });

    describe('getAllRaces', () => {
        beforeEach(async () => {
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            await raceService.initialize();
        });

        it('should return all races', () => {
            const races = raceService.getAllRaces();

            expect(races).toHaveLength(4);
            expect(races[0].name).toBe('Human');
        });

        it('should return empty array if no races', () => {
            raceService._data = { race: [] };
            const races = raceService.getAllRaces();

            expect(races).toEqual([]);
        });
    });

    describe('getRace', () => {
        beforeEach(async () => {
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            await raceService.initialize();
        });

        it('should retrieve a race by name and source', () => {
            const race = raceService.getRace('Human', 'PHB');

            expect(race.name).toBe('Human');
            expect(race.source).toBe('PHB');
        });

        it('should default source to PHB', () => {
            const race = raceService.getRace('Human');

            expect(race.name).toBe('Human');
        });

        it('should normalize input (case-insensitive)', () => {
            const race = raceService.getRace('human', 'phb');

            expect(race.name).toBe('Human');
        });

        it('should throw NotFoundError if race does not exist', () => {
            expect(() => raceService.getRace('Orc', 'PHB')).toThrow(NotFoundError);
        });

        it('should throw ValidationError for invalid name', () => {
            expect(() => raceService.getRace('', 'PHB')).toThrow();
        });

        it('should throw ValidationError for null name', () => {
            expect(() => raceService.getRace(null, 'PHB')).toThrow();
        });
    });

    describe('getSubraces', () => {
        beforeEach(async () => {
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            await raceService.initialize();
        });

        it('should return subraces for Elf', () => {
            const subraces = raceService.getSubraces('Elf', 'PHB');

            expect(subraces).toHaveLength(3);
            expect(subraces.map((sr) => sr.name)).toContain('High Elf');
            expect(subraces.map((sr) => sr.name)).toContain('Wood Elf');
        });

        it('should return empty array if no subraces', () => {
            const subraces = raceService.getSubraces('Human', 'PHB');

            expect(subraces).toEqual([]);
        });

        it('should include derived version subraces', () => {
            const subraces = raceService.getSubraces('Gem Dragonborn', 'FTD');

            expect(subraces.length).toBeGreaterThan(0);
            expect(subraces.some((sr) => sr._isVersion)).toBe(true);
        });
    });

    describe('getSubrace', () => {
        beforeEach(async () => {
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            await raceService.initialize();
        });

        it('should retrieve a specific subrace', () => {
            const subrace = raceService.getSubrace('Elf', 'High Elf', 'PHB');

            expect(subrace.name).toBe('High Elf');
            expect(subrace.raceName).toBe('Elf');
        });

        it('should throw NotFoundError if race does not exist', () => {
            expect(() => raceService.getSubrace('Orc', 'Mountain Orc', 'PHB')).toThrow(
                NotFoundError,
            );
        });

        it('should throw NotFoundError if subrace does not exist', () => {
            expect(() => raceService.getSubrace('Elf', 'Sea Elf', 'PHB')).toThrow(
                NotFoundError,
            );
        });

        it('should throw ValidationError for invalid raceName', () => {
            expect(() => raceService.getSubrace('', 'High Elf', 'PHB')).toThrow();
        });

        it('should throw ValidationError for invalid subraceName', () => {
            expect(() => raceService.getSubrace('Elf', '', 'PHB')).toThrow();
        });
    });

    describe('getBaseSubrace', () => {
        beforeEach(async () => {
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            await raceService.initialize();
        });

        it('should return base subrace for Dragonborn', () => {
            const baseSubrace = raceService.getBaseSubrace('Dragonborn', 'PHB');

            expect(baseSubrace).not.toBeNull();
            expect(baseSubrace.raceName).toBe('Dragonborn');
            expect(baseSubrace.name).toBeUndefined(); // Base subrace has no name
        });

        it('should return null if no base subrace exists', () => {
            const baseSubrace = raceService.getBaseSubrace('Elf', 'PHB');

            expect(baseSubrace).toBeNull();
        });

        it('should throw NotFoundError if race does not exist', () => {
            expect(() => raceService.getBaseSubrace('Orc', 'PHB')).toThrow(
                NotFoundError,
            );
        });

        it('should throw ValidationError for invalid name', () => {
            expect(() => raceService.getBaseSubrace('', 'PHB')).toThrow();
        });
    });

    describe('isSubraceRequired', () => {
        beforeEach(async () => {
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            await raceService.initialize();
        });

        it('should return true for Elf (has subraces, no base)', () => {
            const required = raceService.isSubraceRequired('Elf', 'PHB');

            expect(required).toBe(true);
        });

        it('should return false for Dragonborn (has base subrace)', () => {
            const required = raceService.isSubraceRequired('Dragonborn', 'PHB');

            expect(required).toBe(false);
        });

        it('should return false for Human (no subraces)', () => {
            const required = raceService.isSubraceRequired('Human', 'PHB');

            expect(required).toBe(false);
        });

        it('should return false if race does not exist', () => {
            const required = raceService.isSubraceRequired('Orc', 'PHB');

            expect(required).toBe(false);
        });
    });

    describe('getRaceFluff', () => {
        beforeEach(async () => {
            const { AppState } = await import('../../src/app/AppState.js');
            AppState.setLoadedData('races', null);

            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: mockFluff,
            });
            raceService._data = null;
            raceService._initPromise = null;
            await raceService.initialize();
        });

        it('should return fluff for Human', () => {
            const fluff = raceService.getRaceFluff('Human', 'PHB');

            expect(fluff).toBeDefined();
            expect(fluff.name).toBe('Human');
            expect(fluff.entries).toContain('Humans are the most adaptable people.');
        });

        it('should return null if fluff does not exist', () => {
            const fluff = raceService.getRaceFluff('Dragonborn', 'PHB');

            expect(fluff).toBeNull();
        });

        it('should return null if no fluff data loaded', () => {
            raceService._data.raceFluff = null;
            const fluff = raceService.getRaceFluff('Human', 'PHB');

            expect(fluff).toBeNull();
        });

        it('should throw ValidationError for invalid name', () => {
            expect(() => raceService.getRaceFluff('', 'PHB')).toThrow();
        });
    });

    describe('Version Derivation', () => {
        beforeEach(async () => {
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            await raceService.initialize();
        });

        it('should derive subraces from simple _versions', () => {
            const subraces = raceService.getSubraces('Dragonborn', 'PHB');

            const versions = subraces.filter((sr) => sr._isVersion);
            expect(versions.length).toBeGreaterThan(0);
        });

        it('should derive subraces from abstract implementations', () => {
            const subraces = raceService.getSubraces('Gem Dragonborn', 'FTD');

            expect(subraces.some((sr) => sr.name === 'Amethyst')).toBe(true);
            expect(subraces.some((sr) => sr.name === 'Crystal')).toBe(true);
            expect(subraces.some((sr) => sr.name === 'Emerald')).toBe(true);
        });

        it('should set _isVersion flag on derived subraces', () => {
            const subraces = raceService.getSubraces('Gem Dragonborn', 'FTD');

            for (const subrace of subraces) {
                expect(subrace._isVersion).toBe(true);
            }
        });

        it('should include _implementation and _abstract in derived subraces', () => {
            const subraces = raceService.getSubraces('Gem Dragonborn', 'FTD');
            const amethyst = subraces.find((sr) => sr.name === 'Amethyst');

            expect(amethyst._implementation).toBeDefined();
            expect(amethyst._abstract).toBeDefined();
        });
    });

    describe('Source Handling', () => {
        beforeEach(async () => {
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: mockRaces,
                subrace: mockSubraces,
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            await raceService.initialize();
        });

        it('should normalize source to uppercase', () => {
            const race = raceService.getRace('Human', 'phb');

            expect(race.source).toBe('PHB');
        });

        it('should default source to PHB', () => {
            const race = raceService.getRace('Human');

            expect(race.source).toBe('PHB');
        });

        it('should handle different sources correctly', () => {
            const race = raceService.getRace('Gem Dragonborn', 'FTD');

            expect(race.source).toBe('FTD');
        });
    });

    describe('Edge Cases', () => {
        it('should handle races with no subraces', async () => {
            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: [{ name: 'Human', source: 'PHB' }],
                subrace: [],
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            await raceService.initialize();

            const subraces = raceService.getSubraces('Human', 'PHB');

            expect(subraces).toEqual([]);
        });

        it('should handle subraces without raceName', async () => {
            const { AppState } = await import('../../src/app/AppState.js');
            AppState.setLoadedData('races', null); // Clear cached races

            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.clearAllMocks();
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: [{ name: 'Elf', source: 'PHB' }],
                subrace: [{ name: 'Orphan Subrace', source: 'PHB' }], // No raceName
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            raceService._data = null;
            raceService._initPromise = null;
            await raceService.initialize();

            const subraces = raceService.getSubraces('Elf', 'PHB');

            expect(subraces).toEqual([]); // Subraces without raceName are ignored
        });

        it('should handle races without names', async () => {
            const { AppState } = await import('../../src/app/AppState.js');
            AppState.setLoadedData('races', null); // Clear cached races

            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.clearAllMocks();
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: [{ source: 'PHB' }], // No name
                subrace: [],
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            raceService._data = null;
            raceService._initPromise = null;
            await raceService.initialize();

            expect(raceService._raceIndex.size).toBe(0);
        });

        it('should handle multiple subraces with same name', async () => {
            const { AppState } = await import('../../src/app/AppState.js');
            AppState.setLoadedData('races', null); // Clear cached races

            const originalLoader = await import('../../src/lib/DataLoader.js');
            vi.clearAllMocks();
            vi.spyOn(originalLoader.DataLoader, 'loadRaces').mockResolvedValue({
                race: [{ name: 'Elf', source: 'PHB' }],
                subrace: [
                    { name: 'High Elf', raceName: 'Elf', source: 'PHB' },
                    { name: 'High Elf', raceName: 'Elf', source: 'PHB' }, // Duplicate
                ],
            });
            vi.spyOn(originalLoader.DataLoader, 'loadRaceFluff').mockResolvedValue({
                raceFluff: [],
            });
            raceService._data = null;
            raceService._initPromise = null;
            await raceService.initialize();

            const subraces = raceService.getSubraces('Elf', 'PHB');

            expect(subraces).toHaveLength(2); // Both are stored
        });
    });
});
