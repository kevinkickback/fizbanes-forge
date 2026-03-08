import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/ItemService.js', () => ({
    itemService: {
        getItem: vi.fn(),
    },
}));

import { backgroundEquipmentResolverService } from '../../src/services/BackgroundEquipmentResolverService.js';
import { itemService } from '../../src/services/ItemService.js';

describe('BackgroundEquipmentResolverService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        itemService.getItem.mockImplementation((name, source) => ({
            name,
            source: source || 'PHB',
            weight: 1,
        }));
    });

    describe('resolve', () => {
        it('should return empty items and currency for null background', () => {
            const result = backgroundEquipmentResolverService.resolve(null, {});
            expect(result.items).toEqual([]);
            expect(result.currency).toEqual({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
        });

        it('should return empty items for background without equipment', () => {
            const result = backgroundEquipmentResolverService.resolve({}, {});
            expect(result.items).toEqual([]);
        });

        it('should resolve fixed items from _ key', () => {
            const background = {
                equipment: [
                    { _: ['torch|phb'] },
                ],
            };

            const result = backgroundEquipmentResolverService.resolve(background, {});
            expect(result.items).toHaveLength(1);
            expect(result.items[0].name).toBe('torch');
            expect(result.items[0].quantity).toBe(1);
        });

        it('should resolve item choices based on equipmentChoices', () => {
            const background = {
                equipment: [
                    {
                        a: ['sword|phb'],
                        b: ['shield|phb'],
                    },
                ],
            };

            const result = backgroundEquipmentResolverService.resolve(background, { 0: 'a' });
            expect(result.items).toHaveLength(1);
            expect(result.items[0].name).toBe('sword');
        });

        it('should skip choices when no equipmentChoices provided', () => {
            const background = {
                equipment: [
                    {
                        a: ['sword|phb'],
                        b: ['shield|phb'],
                    },
                ],
            };

            const result = backgroundEquipmentResolverService.resolve(background, {});
            expect(result.items).toHaveLength(0);
        });
    });

    describe('_collectItems', () => {
        it('should resolve string entries (uid format)', () => {
            const items = [];
            const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

            backgroundEquipmentResolverService._collectItems(['rope|phb'], items, currency);

            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('rope');
        });

        it('should resolve currency entries', () => {
            const items = [];
            const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

            backgroundEquipmentResolverService._collectItems(
                [{ value: 1550 }], items, currency,
            );

            expect(currency.gp).toBe(15);
            expect(currency.sp).toBe(5);
            expect(currency.cp).toBe(0);
        });

        it('should resolve equipment type entries', () => {
            const items = [];
            const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

            backgroundEquipmentResolverService._collectItems(
                [{ equipmentType: 'toolArtisan' }], items, currency,
            );

            expect(items).toHaveLength(1);
            expect(items[0].name).toBe("Artisan's Tools (any)");
        });

        it('should resolve item entries with quantity', () => {
            const items = [];
            const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

            backgroundEquipmentResolverService._collectItems(
                [{ item: 'arrow|phb', quantity: 20 }], items, currency,
            );

            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('arrow');
            expect(items[0].quantity).toBe(20);
        });

        it('should resolve item entries with containsValue', () => {
            const items = [];
            const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

            backgroundEquipmentResolverService._collectItems(
                [{ item: 'pouch|phb', containsValue: 1000 }], items, currency,
            );

            expect(items).toHaveLength(1);
            expect(currency.gp).toBe(10);
        });

        it('should resolve special entries', () => {
            const items = [];
            const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

            backgroundEquipmentResolverService._collectItems(
                [{ special: 'A letter from a dead relative' }], items, currency,
            );

            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('A letter from a dead relative');
        });

        it('should fallback gracefully when itemService throws', () => {
            itemService.getItem.mockImplementation(() => { throw new Error('Not found'); });
            const items = [];
            const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

            backgroundEquipmentResolverService._collectItems(['unknown|phb'], items, currency);

            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('unknown');
            expect(items[0].weight).toBe(0);
        });

        it('should use displayName for item entries when provided', () => {
            const items = [];
            const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

            backgroundEquipmentResolverService._collectItems(
                [{ item: 'clothes, common|phb', displayName: 'Common Clothes' }], items, currency,
            );

            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('Common Clothes');
        });
    });

    describe('_copperToCurrency', () => {
        it('should convert 0 copper', () => {
            const result = backgroundEquipmentResolverService._copperToCurrency(0);
            expect(result).toEqual({ gp: 0, sp: 0, cp: 0 });
        });

        it('should convert exact gold amount', () => {
            const result = backgroundEquipmentResolverService._copperToCurrency(1500);
            expect(result).toEqual({ gp: 15, sp: 0, cp: 0 });
        });

        it('should convert mixed amounts', () => {
            const result = backgroundEquipmentResolverService._copperToCurrency(1234);
            expect(result).toEqual({ gp: 12, sp: 3, cp: 4 });
        });

        it('should handle sub-silver amounts', () => {
            const result = backgroundEquipmentResolverService._copperToCurrency(7);
            expect(result).toEqual({ gp: 0, sp: 0, cp: 7 });
        });
    });
});
