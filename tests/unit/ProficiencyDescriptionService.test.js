import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

vi.mock('../../src/services/ItemService.js', () => ({
    itemService: {
        getAllItems: vi.fn().mockReturnValue([]),
        getAllBaseItems: vi.fn().mockReturnValue([]),
    },
}));

vi.mock('../../src/services/SkillService.js', () => ({
    skillService: {
        getSkillData: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('../../src/services/SourceService.js', () => ({
    sourceService: {
        getAllowedSources: vi.fn().mockReturnValue(['PHB', 'XPHB']),
    },
}));

import { proficiencyDescriptionService } from '../../src/services/ProficiencyDescriptionService.js';
import { skillService } from '../../src/services/SkillService.js';

describe('ProficiencyDescriptionService', () => {
    const mockSkillData = [
        { name: 'Athletics', ability: 'str', source: 'PHB', entries: ['Climb, jump, swim.'], page: 175 },
        { name: 'Athletics', ability: 'str', source: 'XPHB', entries: ['Updated athletics.'], page: 200 },
        { name: 'Stealth', ability: 'dex', source: 'PHB', entries: ['Sneak around.'], page: 177 },
    ];

    const mockLanguageData = {
        language: [
            { name: 'Common', source: 'PHB', type: 'standard' },
            { name: 'Elvish', source: 'PHB', type: 'standard' },
            { name: 'Common', source: 'XPHB', type: 'standard' },
            { name: 'Abyssal', source: 'PHB', type: 'exotic' },
            { name: 'Druidic', source: 'PHB', type: 'secret' },
        ],
    };

    beforeEach(() => {
        proficiencyDescriptionService.resetData();
        vi.clearAllMocks();
    });

    describe('dispose / resetData', () => {
        it('should clear all cached data', () => {
            proficiencyDescriptionService._skillData = [{ name: 'Test' }];
            proficiencyDescriptionService._languageData = [{ name: 'Test' }];
            proficiencyDescriptionService._bookData = { test: true };

            proficiencyDescriptionService.dispose();

            expect(proficiencyDescriptionService._skillData).toBeNull();
            expect(proficiencyDescriptionService._languageData).toBeNull();
            expect(proficiencyDescriptionService._bookData).toBeNull();
        });
    });

    describe('getSkillDescription', () => {
        it('should return skill description with source priority (XPHB over PHB)', async () => {
            skillService.getSkillData.mockResolvedValue(mockSkillData);

            const result = await proficiencyDescriptionService.getSkillDescription('Athletics');
            expect(result).not.toBeNull();
            expect(result.name).toBe('Athletics');
            expect(result.source).toBe('XPHB');
            expect(result.description).toEqual(['Updated athletics.']);
        });

        it('should fall back to PHB when XPHB not available', async () => {
            skillService.getSkillData.mockResolvedValue(mockSkillData);

            const stealth = await proficiencyDescriptionService.getSkillDescription('Stealth');
            expect(stealth).not.toBeNull();
            expect(stealth.source).toBe('PHB');
        });

        it('should return null for unknown skill', async () => {
            skillService.getSkillData.mockResolvedValue(mockSkillData);

            const result = await proficiencyDescriptionService.getSkillDescription('Nonexistent');
            expect(result).toBeNull();
        });

        it('should cache skill data after first load', async () => {
            skillService.getSkillData.mockResolvedValue(mockSkillData);

            await proficiencyDescriptionService.getSkillDescription('Athletics');
            await proficiencyDescriptionService.getSkillDescription('Stealth');

            expect(skillService.getSkillData).toHaveBeenCalledTimes(1);
        });
    });

    describe('getStandardLanguages', () => {
        it('should return standard and exotic languages sorted', async () => {
            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            vi.spyOn(DataLoader, 'loadJSON').mockResolvedValue(mockLanguageData);

            const languages = await proficiencyDescriptionService.getStandardLanguages();
            expect(languages).toContain('Common');
            expect(languages).toContain('Elvish');
            expect(languages).toContain('Abyssal');
            // Secret languages should be excluded
            expect(languages).not.toContain('Druidic');
            // Should be sorted
            expect(languages).toEqual([...languages].sort());
        });

        it('should prefer XPHB version when both exist', async () => {
            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            vi.spyOn(DataLoader, 'loadJSON').mockResolvedValue(mockLanguageData);

            const languages = await proficiencyDescriptionService.getStandardLanguages();
            // "Common" should appear only once despite two source entries
            const commonCount = languages.filter(l => l === 'Common').length;
            expect(commonCount).toBe(1);
        });
    });

    describe('getLanguageDescription', () => {
        it('should return language description', async () => {
            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            vi.spyOn(DataLoader, 'loadJSON').mockResolvedValue(mockLanguageData);

            const result = await proficiencyDescriptionService.getLanguageDescription('Common');
            expect(result).not.toBeNull();
            expect(result.name).toBe('Common');
        });

        it('should return null for unknown language', async () => {
            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            vi.spyOn(DataLoader, 'loadJSON').mockResolvedValue(mockLanguageData);

            const result = await proficiencyDescriptionService.getLanguageDescription('Klingon');
            expect(result).toBeNull();
        });
    });
});
