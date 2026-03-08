import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { sourceService } from '../../src/services/SourceService.js';

describe('SourceService', () => {
    const mockSourceData = {
        book: [
            {
                id: 'PHB',
                name: "Player's Handbook",
                abbreviation: 'PHB',
                isCore: true,
                group: 'core',
                contents: [{ name: 'Races', headers: [] }],
            },
            {
                id: 'XPHB',
                name: "Player's Handbook (2024)",
                abbreviation: 'XPHB',
                isCore: true,
                group: 'core',
                contents: [{ name: 'Classes', headers: [] }],
            },
            {
                id: 'XGE',
                name: "Xanathar's Guide to Everything",
                abbreviation: 'XGE',
                isCore: false,
                group: 'supplement',
                contents: [{ name: 'Subclasses', headers: [] }],
            },
            {
                id: 'MPMM',
                name: 'Monsters of the Multiverse',
                abbreviation: 'MPMM',
                isCore: false,
                group: 'supplement',
                contents: [{ name: 'Races', headers: [] }],
            },
            {
                id: 'DMG',
                name: "Dungeon Master's Guide",
                abbreviation: 'DMG',
                isCore: true,
                group: 'core',
                contents: [{ name: 'Treasure Tables', headers: [] }],
            },
        ],
    };

    beforeEach(async () => {
        sourceService._data = null;
        sourceService._initPromise = null;
        sourceService.availableSources.clear();
        sourceService.coreSources.clear();
        sourceService.allowedSources = new Set(['PHB']);
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadSources').mockResolvedValue(mockSourceData);

        await sourceService.initialize();
    });

    describe('initialize', () => {
        it('should load and filter sources with player options', () => {
            expect(sourceService.isInitialized()).toBe(true);
            // PHB, XPHB, XGE have player options; DMG does not
            const available = sourceService.getAvailableSources();
            expect(available).toContain('PHB');
            expect(available).toContain('XPHB');
            expect(available).toContain('XGE');
            expect(available).not.toContain('DMG');
        });

        it('should filter out banned sources', () => {
            const available = sourceService.getAvailableSources();
            expect(available).not.toContain('MPMM');
        });

        it('should identify core sources', () => {
            expect(sourceService.isCoreSource('PHB')).toBe(true);
            expect(sourceService.isCoreSource('XPHB')).toBe(true);
            expect(sourceService.isCoreSource('XGE')).toBe(false);
        });
    });

    describe('isBannedSource', () => {
        it('should detect banned sources', () => {
            expect(sourceService.isBannedSource('MPMM')).toBe(true);
            expect(sourceService.isBannedSource('AAG')).toBe(true);
        });

        it('should be case-insensitive', () => {
            expect(sourceService.isBannedSource('mpmm')).toBe(true);
        });

        it('should return false for non-banned sources', () => {
            expect(sourceService.isBannedSource('PHB')).toBe(false);
        });
    });

    describe('isValidSource', () => {
        it('should return true for available sources', () => {
            expect(sourceService.isValidSource('PHB')).toBe(true);
        });

        it('should return false for unavailable sources', () => {
            expect(sourceService.isValidSource('NONEXISTENT')).toBe(false);
        });
    });

    describe('isSourceAllowed / getAllowedSources', () => {
        it('should default to PHB allowed', () => {
            expect(sourceService.isSourceAllowed('PHB')).toBe(true);
        });

        it('should return false for non-allowed sources', () => {
            expect(sourceService.isSourceAllowed('XGE')).toBe(false);
        });

        it('should normalize source variants', () => {
            expect(sourceService.isSourceAllowed('PHB-2014')).toBe(true);
        });
    });

    describe('addAllowedSource / removeAllowedSource', () => {
        it('should add a valid source to allowed set', () => {
            const added = sourceService.addAllowedSource('XGE');
            expect(added).toBe(true);
            expect(sourceService.isSourceAllowed('XGE')).toBe(true);
        });

        it('should return false when adding invalid source', () => {
            const added = sourceService.addAllowedSource('NONEXISTENT');
            expect(added).toBe(false);
        });

        it('should return false when adding duplicate source', () => {
            sourceService.addAllowedSource('XGE');
            const added = sourceService.addAllowedSource('XGE');
            expect(added).toBe(false);
        });

        it('should remove a non-PHB allowed source', () => {
            sourceService.addAllowedSource('XGE');
            const removed = sourceService.removeAllowedSource('XGE');
            expect(removed).toBe(true);
            expect(sourceService.isSourceAllowed('XGE')).toBe(false);
        });

        it('should not allow removing PHB', () => {
            const removed = sourceService.removeAllowedSource('PHB');
            expect(removed).toBe(false);
            expect(sourceService.isSourceAllowed('PHB')).toBe(true);
        });
    });

    describe('resetAllowedSources', () => {
        it('should reset to PHB only', () => {
            sourceService.addAllowedSource('XGE');
            sourceService.resetAllowedSources();
            expect(sourceService.isSourceAllowed('XGE')).toBe(false);
            expect(sourceService.isSourceAllowed('PHB')).toBe(true);
        });
    });

    describe('formatSourceName', () => {
        it('should return full name for known sources', () => {
            expect(sourceService.formatSourceName('PHB')).toBe("Player's Handbook");
        });

        it('should fall back to abbreviation map for unloaded sources', () => {
            expect(sourceService.formatSourceName('DMG')).toBe("Dungeon Master's Guide");
        });

        it('should return formatted abbreviation for unknown sources', () => {
            const result = sourceService.formatSourceName('UNKNOWN');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });
});
