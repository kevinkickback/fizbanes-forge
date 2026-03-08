import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';

vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { variantRuleService } from '../../src/services/VariantRuleService.js';

describe('VariantRuleService', () => {
    const mockRules = {
        variantrule: [
            { name: 'Encumbrance', source: 'PHB', entries: ['Encumbrance rules...'] },
            { name: 'Multiclassing', source: 'PHB', entries: ['Multiclassing rules...'] },
            { name: 'Flanking', source: 'DMG', entries: ['Flanking rules...'] },
        ],
    };

    beforeEach(async () => {
        variantRuleService._data = null;
        variantRuleService._initPromise = null;
        variantRuleService._variantRuleMap = null;
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadVariantRules').mockResolvedValue(mockRules);

        await variantRuleService.initialize();
    });

    describe('initialize', () => {
        it('should load variant rules and build lookup map', () => {
            expect(variantRuleService.isInitialized()).toBe(true);
            expect(variantRuleService._variantRuleMap.size).toBe(3);
        });

        it('should handle missing variantrule array gracefully', async () => {
            variantRuleService._data = null;
            variantRuleService._initPromise = null;
            variantRuleService._variantRuleMap = null;

            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            vi.spyOn(DataLoader, 'loadVariantRules').mockResolvedValue({});

            await variantRuleService.initialize();
            expect(variantRuleService._variantRuleMap.size).toBe(0);
        });
    });

    describe('getVariantRule', () => {
        it('should return a rule by name', () => {
            const rule = variantRuleService.getVariantRule('Encumbrance');
            expect(rule.name).toBe('Encumbrance');
            expect(rule.source).toBe('PHB');
        });

        it('should find rules case-insensitively', () => {
            const rule = variantRuleService.getVariantRule('encumbrance');
            expect(rule.name).toBe('Encumbrance');
        });

        it('should throw NotFoundError for missing rule', () => {
            expect(() => variantRuleService.getVariantRule('Nonexistent')).toThrow(NotFoundError);
        });

        it('should throw NotFoundError when data not initialized', () => {
            variantRuleService._variantRuleMap = null;
            expect(() => variantRuleService.getVariantRule('Encumbrance')).toThrow(NotFoundError);
        });
    });

    describe('resetData', () => {
        it('should clear the lookup map', () => {
            variantRuleService.resetData();
            expect(variantRuleService._variantRuleMap).toBeNull();
        });
    });
});
