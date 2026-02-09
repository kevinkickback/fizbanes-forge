import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/lib/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { backgroundService } from '../../src/services/BackgroundService.js';

describe('BackgroundService', () => {
    const mockBackgrounds = [
        {
            name: 'Acolyte',
            source: 'PHB',
            skillProficiencies: [{ insight: true, religion: true }],
            languageProficiencies: [{ anyStandard: 2 }],
        },
        {
            name: 'Criminal',
            source: 'PHB',
            skillProficiencies: [{ deception: true, stealth: true }],
            toolProficiencies: [{ "thieves' tools": true }],
        },
        {
            name: 'Noble',
            source: 'PHB',
            skillProficiencies: [{ history: true, persuasion: true }],
            toolProficiencies: [{ choose: { from: ['gaming set'], count: 1 } }],
            languageProficiencies: [{ any: 1 }],
        },
        {
            name: 'Sage',
            source: 'PHB',
            proficiencies: {
                skills: [{ skill: 'Arcana' }, { skill: 'History' }],
                tools: [],
                languages: [{ choose: { count: 2, type: 'anyStandard' } }],
            },
        },
    ];

    beforeEach(async () => {
        backgroundService._data = null;
        backgroundService._initPromise = null;
        backgroundService._selectedBackground = null;
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadBackgrounds').mockResolvedValue({
            background: mockBackgrounds,
        });

        await backgroundService.initialize();
    });

    describe('initialize', () => {
        it('should load backgrounds', () => {
            expect(backgroundService.isInitialized()).toBe(true);
        });

        it('should normalize backgrounds during load', () => {
            const criminal = backgroundService.getBackground('Criminal');
            // Should have normalized proficiencies structure
            expect(criminal.proficiencies).toBeDefined();
            expect(criminal.proficiencies.skills).toBeInstanceOf(Array);
        });
    });

    describe('getAllBackgrounds', () => {
        it('should return all backgrounds', () => {
            expect(backgroundService.getAllBackgrounds()).toHaveLength(4);
        });

        it('should return empty array when data is null', () => {
            backgroundService._data = null;
            expect(backgroundService.getAllBackgrounds()).toEqual([]);
        });
    });

    describe('getBackground', () => {
        it('should find background by name', () => {
            const bg = backgroundService.getBackground('Acolyte');
            expect(bg.name).toBe('Acolyte');
        });

        it('should find background by name and source', () => {
            const bg = backgroundService.getBackground('Noble', 'PHB');
            expect(bg.name).toBe('Noble');
        });

        it('should throw NotFoundError for non-existent background', () => {
            expect(() =>
                backgroundService.getBackground('Hermit'),
            ).toThrow(NotFoundError);
        });

        it('should throw NotFoundError when data is not loaded', () => {
            backgroundService._data = null;
            expect(() =>
                backgroundService.getBackground('Acolyte'),
            ).toThrow(NotFoundError);
        });

        it('should throw ValidationError for empty name', () => {
            expect(() => backgroundService.getBackground('')).toThrow();
        });
    });

    describe('selectBackground', () => {
        it('should select a background and emit event', () => {
            const emitSpy = vi.spyOn(eventBus, 'emit');

            const result = backgroundService.selectBackground('Acolyte');

            expect(result.name).toBe('Acolyte');
            expect(backgroundService._selectedBackground.name).toBe('Acolyte');
            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.BACKGROUND_SELECTED,
                expect.objectContaining({ name: 'Acolyte' }),
            );
        });

        it('should throw NotFoundError for non-existent background', () => {
            expect(() =>
                backgroundService.selectBackground('Hermit'),
            ).toThrow(NotFoundError);
        });
    });

    describe('_normalizeBackgroundStructure', () => {
        it('should not modify already-normalized backgrounds', () => {
            const bg = {
                name: 'Sage',
                proficiencies: {
                    skills: [{ skill: 'Arcana' }],
                    tools: [],
                    languages: [],
                },
            };
            const result = backgroundService._normalizeBackgroundStructure(bg);
            expect(result.proficiencies.skills).toEqual([{ skill: 'Arcana' }]);
        });

        it('should normalize skill proficiencies from legacy format', () => {
            const bg = {
                name: 'Criminal',
                skillProficiencies: [{ deception: true, stealth: true }],
            };
            const result = backgroundService._normalizeBackgroundStructure(bg);
            expect(result.proficiencies.skills).toHaveLength(2);
        });

        it('should normalize tool proficiencies from legacy format', () => {
            const bg = {
                name: 'Criminal',
                toolProficiencies: [{ "thieves' tools": true }],
            };
            const result = backgroundService._normalizeBackgroundStructure(bg);
            expect(result.proficiencies.tools).toHaveLength(1);
            expect(result.proficiencies.tools[0].tool).toBe("thieves' tools");
        });

        it('should normalize language proficiencies with any/anyStandard', () => {
            const bg = {
                name: 'Acolyte',
                languageProficiencies: [{ anyStandard: 2 }],
            };
            const result = backgroundService._normalizeBackgroundStructure(bg);
            expect(result.proficiencies.languages).toHaveLength(1);
            expect(result.proficiencies.languages[0].choose.count).toBe(2);
        });

        it('should normalize language proficiencies with named languages', () => {
            const bg = {
                name: 'Test',
                languageProficiencies: [{ Elvish: true }],
            };
            const result = backgroundService._normalizeBackgroundStructure(bg);
            expect(result.proficiencies.languages).toHaveLength(1);
            expect(result.proficiencies.languages[0].language).toBe('Elvish');
        });

        it('should map startingEquipment to equipment', () => {
            const bg = {
                name: 'Test',
                startingEquipment: [{ a: ['rope'] }],
            };
            const result = backgroundService._normalizeBackgroundStructure(bg);
            expect(result.equipment).toEqual([{ a: ['rope'] }]);
        });
    });

    describe('_normalizeSkillName', () => {
        it('should capitalize first letter', () => {
            expect(backgroundService._normalizeSkillName('athletics')).toBe(
                'Athletics',
            );
        });

        it('should handle empty string', () => {
            expect(backgroundService._normalizeSkillName('')).toBe('');
        });
    });
});
