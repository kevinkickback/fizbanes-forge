import { describe, expect, it } from 'vitest';
import {
    EDITION_MODES,
    editionSetToMode,
    filterByEdition,
    hasConflictingSources,
    inheritReprintDescriptions,
} from '../../src/ui/components/selection/EditionFilter.js';

describe('EditionFilter', () => {
    describe('hasConflictingSources', () => {
        it('should return true when both PHB and XPHB are allowed', () => {
            expect(hasConflictingSources(['PHB', 'XPHB'])).toBe(true);
        });

        it('should return true when both DMG and XDMG are allowed', () => {
            expect(hasConflictingSources(['DMG', 'XDMG'])).toBe(true);
        });

        it('should return true when both MM and XMM are allowed', () => {
            expect(hasConflictingSources(['MM', 'XMM'])).toBe(true);
        });

        it('should return true when any one conflicting pair exists among many sources', () => {
            expect(hasConflictingSources(['TCE', 'XGE', 'PHB', 'XPHB'])).toBe(true);
        });

        it('should return false when no conflicting pairs exist', () => {
            expect(hasConflictingSources(['PHB', 'TCE', 'XGE'])).toBe(false);
        });

        it('should return false when only one side of a pair is allowed', () => {
            expect(hasConflictingSources(['XPHB', 'XDMG'])).toBe(false);
        });

        it('should return false for empty sources', () => {
            expect(hasConflictingSources([])).toBe(false);
        });

        it('should be case-insensitive', () => {
            expect(hasConflictingSources(['phb', 'xphb'])).toBe(true);
        });
    });

    describe('editionSetToMode', () => {
        it('should return LATEST when only 2024 is checked', () => {
            expect(editionSetToMode(new Set(['2024']))).toBe(EDITION_MODES.LATEST);
        });

        it('should return CLASSIC when only 2014 is checked', () => {
            expect(editionSetToMode(new Set(['2014']))).toBe(EDITION_MODES.CLASSIC);
        });

        it('should return ALL when both are checked', () => {
            expect(editionSetToMode(new Set(['2024', '2014']))).toBe(EDITION_MODES.ALL);
        });

        it('should return ALL when neither is checked', () => {
            expect(editionSetToMode(new Set())).toBe(EDITION_MODES.ALL);
        });
    });

    describe('filterByEdition', () => {
        const items = [
            { name: 'Fireball', source: 'PHB' },
            { name: 'Fireball', source: 'XPHB' },
            { name: 'Shield', source: 'PHB' },
            { name: 'Shield', source: 'XPHB' },
            { name: 'Silvery Barbs', source: 'SCC' },
        ];
        const allowedSources = ['PHB', 'XPHB', 'SCC'];

        describe('ALL mode', () => {
            it('should return all items unchanged', () => {
                const result = filterByEdition(items, EDITION_MODES.ALL, allowedSources);
                expect(result).toEqual(items);
            });
        });

        describe('LATEST mode', () => {
            it('should hide classic entries when their 2024 source is allowed', () => {
                const result = filterByEdition(items, EDITION_MODES.LATEST, allowedSources);
                expect(result).toEqual([
                    { name: 'Fireball', source: 'XPHB' },
                    { name: 'Shield', source: 'XPHB' },
                    { name: 'Silvery Barbs', source: 'SCC' },
                ]);
            });

            it('should keep classic entries when their 2024 source is not allowed', () => {
                const onlyClassic = ['PHB', 'SCC'];
                const result = filterByEdition(items, EDITION_MODES.LATEST, onlyClassic);
                expect(result).toEqual(items);
            });
        });

        describe('CLASSIC mode', () => {
            it('should hide 2024 entries when their classic source is allowed', () => {
                const result = filterByEdition(items, EDITION_MODES.CLASSIC, allowedSources);
                expect(result).toEqual([
                    { name: 'Fireball', source: 'PHB' },
                    { name: 'Shield', source: 'PHB' },
                    { name: 'Silvery Barbs', source: 'SCC' },
                ]);
            });

            it('should keep 2024 entries when their classic source is not allowed', () => {
                const onlyModern = ['XPHB', 'SCC'];
                const result = filterByEdition(items, EDITION_MODES.CLASSIC, onlyModern);
                expect(result).toEqual(items);
            });
        });

        describe('Edge cases', () => {
            it('should return null/undefined input as-is in ALL mode', () => {
                expect(filterByEdition(null, EDITION_MODES.ALL, allowedSources)).toBeNull();
            });

            it('should return null/undefined input as-is in LATEST mode', () => {
                expect(filterByEdition(null, EDITION_MODES.LATEST, allowedSources)).toBeNull();
            });

            it('should handle empty array', () => {
                expect(filterByEdition([], EDITION_MODES.LATEST, allowedSources)).toEqual([]);
            });

            it('should always include items from non-paired sources', () => {
                const nonPairedItems = [
                    { name: 'Spell A', source: 'TCE' },
                    { name: 'Spell B', source: 'XGE' },
                ];
                const result = filterByEdition(nonPairedItems, EDITION_MODES.LATEST, ['TCE', 'XGE']);
                expect(result).toEqual(nonPairedItems);
            });

            it('should handle items with missing source', () => {
                const noSourceItems = [{ name: 'Unknown' }];
                const result = filterByEdition(noSourceItems, EDITION_MODES.LATEST, allowedSources);
                expect(result).toEqual(noSourceItems);
            });

            it('should handle DMG/XDMG pair in LATEST mode', () => {
                const dmgItems = [
                    { name: 'Holy Avenger', source: 'DMG' },
                    { name: 'Holy Avenger', source: 'XDMG' },
                ];
                const result = filterByEdition(dmgItems, EDITION_MODES.LATEST, ['DMG', 'XDMG']);
                expect(result).toEqual([{ name: 'Holy Avenger', source: 'XDMG' }]);
            });

            it('should handle unknown mode by returning all items', () => {
                const result = filterByEdition(items, 'unknown', allowedSources);
                expect(result).toEqual(items);
            });
        });
    });

    describe('inheritReprintDescriptions', () => {
        it('should copy entries from classic to reprint that lacks entries', () => {
            const items = [
                { name: 'Padded Armor', source: 'PHB', entries: ['Light armor.'], reprintedAs: ['Padded Armor|XPHB'] },
                { name: 'Padded Armor', source: 'XPHB' },
            ];
            inheritReprintDescriptions(items);
            expect(items[1].entries).toEqual(['Light armor.']);
        });

        it('should not overwrite existing entries on the reprint', () => {
            const items = [
                { name: 'Shield', source: 'PHB', entries: ['Old text.'], reprintedAs: ['Shield|XPHB'] },
                { name: 'Shield', source: 'XPHB', entries: ['New text.'] },
            ];
            inheritReprintDescriptions(items);
            expect(items[1].entries).toEqual(['New text.']);
        });

        it('should handle empty entries array as missing', () => {
            const items = [
                { name: 'Longsword', source: 'PHB', entries: ['A versatile weapon.'], reprintedAs: ['Longsword|XPHB'] },
                { name: 'Longsword', source: 'XPHB', entries: [] },
            ];
            inheritReprintDescriptions(items);
            expect(items[1].entries).toEqual(['A versatile weapon.']);
        });

        it('should return null/undefined input unchanged', () => {
            expect(inheritReprintDescriptions(null)).toBeNull();
            expect(inheritReprintDescriptions([])).toEqual([]);
        });

        it('should not affect items without reprintedAs references', () => {
            const items = [
                { name: 'Spell A', source: 'TCE', entries: ['Desc.'] },
                { name: 'Spell B', source: 'XGE' },
            ];
            inheritReprintDescriptions(items);
            expect(items[1].entries).toBeUndefined();
        });

        it('should handle object-style reprintedAs with uid property', () => {
            const items = [
                { name: 'Net', source: 'PHB', entries: ['A thrown weapon.'], reprintedAs: [{ uid: 'Net|XPHB', tag: 'item' }] },
                { name: 'Net', source: 'XPHB' },
            ];
            inheritReprintDescriptions(items);
            expect(items[1].entries).toEqual(['A thrown weapon.']);
        });
    });
});
