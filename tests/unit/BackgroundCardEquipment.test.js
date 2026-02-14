import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules that BackgroundCard imports
vi.mock('../../src/services/BackgroundService.js', () => ({
    backgroundService: {
        initialize: vi.fn().mockResolvedValue(undefined),
        getAllBackgrounds: vi.fn().mockReturnValue([]),
        selectBackground: vi.fn(),
    },
}));

vi.mock('../../src/services/SourceService.js', () => ({
    sourceService: {
        isSourceAllowed: vi.fn().mockReturnValue(true),
        getSourceName: vi.fn().mockReturnValue('PHB'),
    },
}));

vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

vi.mock('../../src/lib/TextProcessor.js', () => {
    const processor = {
        processElement: vi.fn().mockResolvedValue(undefined),
    };
    return {
        default: processor,
        textProcessor: processor,
    };
});

vi.mock('../../src/app/CharacterManager.js', () => ({
    CharacterManager: {
        getCurrentCharacter: vi.fn().mockReturnValue(null),
    },
}));

vi.mock('../../src/app/AppState.js', () => ({
    AppState: {
        getCurrentCharacter: vi.fn().mockReturnValue(null),
    },
}));

import { BackgroundCard } from '../../src/ui/components/background/BackgroundCard.js';

describe('BackgroundCard Equipment Choices', () => {
    let card;

    beforeEach(() => {
        vi.clearAllMocks();

        // Set up minimal DOM elements the constructor needs
        document.body.innerHTML = `
			<div id="backgroundChoicesPanel"></div>
			<div id="backgroundList"></div>
			<div id="backgroundInfoPanel"></div>
			<button id="backgroundInfoToggle"><i class="fas fa-chevron-right"></i></button>
			<input id="backgroundSearchInput" />
		`;

        card = new BackgroundCard();
    });

    describe('_getEquipmentChoices', () => {
        it('should return empty array when background has no equipment', () => {
            expect(card._getEquipmentChoices({})).toEqual([]);
            expect(card._getEquipmentChoices(null)).toEqual([]);
        });

        it('should return empty array when equipment has only fixed items', () => {
            const bg = {
                equipment: [{ _: ['dagger|phb', 'rope|phb'] }],
            };
            expect(card._getEquipmentChoices(bg)).toEqual([]);
        });

        it('should detect lowercase a/b choices', () => {
            const bg = {
                equipment: [
                    { _: ['rope|phb'] },
                    { a: [{ special: 'dice' }], b: [{ special: 'cards' }] },
                ],
            };
            const choices = card._getEquipmentChoices(bg);
            expect(choices).toHaveLength(1);
            expect(choices[0].keys).toEqual(['a', 'b']);
        });

        it('should detect uppercase A/B choices', () => {
            const bg = {
                equipment: [
                    { A: [{ item: 'book|xphb' }], B: [{ value: 5000 }] },
                ],
            };
            const choices = card._getEquipmentChoices(bg);
            expect(choices).toHaveLength(1);
            expect(choices[0].keys).toEqual(['A', 'B']);
        });

        it('should detect 3-way choices', () => {
            const bg = {
                equipment: [{
                    a: [{ special: 'jacket' }],
                    b: [{ special: 'cap' }],
                    c: [{ special: 'scarf' }],
                }],
            };
            const choices = card._getEquipmentChoices(bg);
            expect(choices).toHaveLength(1);
            expect(choices[0].keys).toEqual(['a', 'b', 'c']);
        });

        it('should detect 4-way choices', () => {
            const bg = {
                equipment: [{
                    a: [{ special: 'bottles', quantity: 10 }],
                    b: [{ special: 'weighted dice' }],
                    c: [{ special: 'marked cards' }],
                    d: [{ special: 'signet ring' }],
                }],
            };
            const choices = card._getEquipmentChoices(bg);
            expect(choices).toHaveLength(1);
            expect(choices[0].keys).toEqual(['a', 'b', 'c', 'd']);
        });

        it('should ignore entries with only a fixed key', () => {
            const bg = {
                equipment: [
                    { _: ['common clothes|phb'] },
                    { a: [{ item: 'sword|phb' }], b: [{ value: 2000 }] },
                ],
            };
            const choices = card._getEquipmentChoices(bg);
            expect(choices).toHaveLength(1);
            expect(choices[0].keys).toEqual(['a', 'b']);
        });
    });

    describe('_getEquipmentChoiceLabel', () => {
        it('should return "Unknown" for empty or invalid input', () => {
            expect(card._getEquipmentChoiceLabel([])).toBe('Unknown');
            expect(card._getEquipmentChoiceLabel(null)).toBe('Unknown');
        });

        it('should format pure GP value', () => {
            const items = [{ value: 5000 }];
            expect(card._getEquipmentChoiceLabel(items)).toBe('50 GP');
        });

        it('should format GP value correctly for various amounts', () => {
            expect(card._getEquipmentChoiceLabel([{ value: 800 }])).toBe('8 GP');
            expect(card._getEquipmentChoiceLabel([{ value: 100 }])).toBe('1 GP');
        });

        it('should format SP value when not evenly divisible by 100', () => {
            expect(card._getEquipmentChoiceLabel([{ value: 10 }])).toBe('1 SP');
            expect(card._getEquipmentChoiceLabel([{ value: 50 }])).toBe('5 SP');
        });

        it('should format CP value for very small amounts', () => {
            expect(card._getEquipmentChoiceLabel([{ value: 3 }])).toBe('3 CP');
        });

        it('should show item name for a single item with special', () => {
            const items = [{ special: 'set of weighted dice' }];
            expect(card._getEquipmentChoiceLabel(items)).toBe('set of weighted dice');
        });

        it('should show item name for a single item reference', () => {
            const items = [{ item: 'dagger|phb' }];
            expect(card._getEquipmentChoiceLabel(items)).toBe('dagger');
        });

        it('should return "Equipment Pack" for multiple items', () => {
            const items = [
                { item: 'book|xphb' },
                { item: 'parchment|xphb', quantity: 10 },
                { value: 800 },
            ];
            expect(card._getEquipmentChoiceLabel(items)).toBe('Equipment Pack');
        });

        it('should not treat item with value + item ref as pure currency', () => {
            // An item that has both value and item should NOT be treated as pure gold
            const items = [{ item: 'pouch|phb', containsValue: 1500 }];
            const label = card._getEquipmentChoiceLabel(items);
            expect(label).not.toBe('15 GP');
        });
    });

    describe('_formatCurrencyValue', () => {
        it('should format GP values', () => {
            expect(card._detailsView._formatCurrencyValue(5000)).toBe('50 GP');
            expect(card._detailsView._formatCurrencyValue(100)).toBe('1 GP');
            expect(card._detailsView._formatCurrencyValue(800)).toBe('8 GP');
        });

        it('should format SP values', () => {
            expect(card._detailsView._formatCurrencyValue(10)).toBe('1 SP');
            expect(card._detailsView._formatCurrencyValue(50)).toBe('5 SP');
        });

        it('should format CP values', () => {
            expect(card._detailsView._formatCurrencyValue(3)).toBe('3 CP');
            expect(card._detailsView._formatCurrencyValue(7)).toBe('7 CP');
        });
    });

    describe('BackgroundDetailsView _formatEquipment', () => {
        it('should return "None" when no equipment', () => {
            const result = card._detailsView._formatEquipment({});
            expect(result).toBe('None');
        });

        it('should format fixed equipment under "_" key', () => {
            const bg = { equipment: [{ _: ['dagger|phb', 'rope|phb'] }] };
            const result = card._detailsView._formatEquipment(bg);
            expect(result).toContain('dagger');
            expect(result).toContain('rope');
        });

        it('should format lowercase a/b choices', () => {
            const bg = {
                equipment: [{
                    a: [{ special: 'dice' }],
                    b: [{ special: 'cards' }],
                }],
            };
            const result = card._detailsView._formatEquipment(bg);
            expect(result).toContain('(a)');
            expect(result).toContain('(b)');
            expect(result).toContain('dice');
            expect(result).toContain('cards');
        });

        it('should format uppercase A/B choices', () => {
            const bg = {
                equipment: [{
                    A: [{ item: 'book|xphb' }],
                    B: [{ value: 5000 }],
                }],
            };
            const result = card._detailsView._formatEquipment(bg);
            expect(result).toContain('(A)');
            expect(result).toContain('(B)');
            expect(result).toContain('book');
            expect(result).toContain('50 GP');
        });

        it('should handle mixed fixed and choice entries', () => {
            const bg = {
                equipment: [
                    { _: ['common clothes|phb'] },
                    { a: [{ special: 'dice' }], b: [{ special: 'cards' }] },
                ],
            };
            const result = card._detailsView._formatEquipment(bg);
            expect(result).toContain('common clothes');
            expect(result).toContain('(a)');
            expect(result).toContain('dice');
        });

        it('should handle 4-way choices', () => {
            const bg = {
                equipment: [{
                    a: [{ special: 'bottles', quantity: 10 }],
                    b: [{ special: 'dice' }],
                    c: [{ special: 'cards' }],
                    d: [{ special: 'ring' }],
                }],
            };
            const result = card._detailsView._formatEquipment(bg);
            expect(result).toContain('(a)');
            expect(result).toContain('(b)');
            expect(result).toContain('(c)');
            expect(result).toContain('(d)');
        });
    });

    describe('BackgroundDetailsView _formatSingleEquipment', () => {
        it('should parse item name from string reference', () => {
            const result = card._detailsView._formatSingleEquipment('dagger|phb');
            expect(result).toBe('dagger');
        });

        it('should format standalone currency value', () => {
            expect(card._detailsView._formatSingleEquipment({ value: 5000 })).toBe('50 GP');
            expect(card._detailsView._formatSingleEquipment({ value: 800 })).toBe('8 GP');
            expect(card._detailsView._formatSingleEquipment({ value: 10 })).toBe('1 SP');
        });

        it('should format equipment type placeholders', () => {
            expect(card._detailsView._formatSingleEquipment({ equipmentType: 'toolArtisan' }))
                .toBe("Artisan's Tools (any)");
            expect(card._detailsView._formatSingleEquipment({ equipmentType: 'instrumentMusical' }))
                .toBe('Musical Instrument (any)');
            expect(card._detailsView._formatSingleEquipment({ equipmentType: 'setGaming' }))
                .toBe('Gaming Set (any)');
        });

        it('should format item with quantity', () => {
            const result = card._detailsView._formatSingleEquipment({ item: 'parchment|xphb', quantity: 10 });
            expect(result).toBe('10x parchment');
        });

        it('should prefer displayName over item ref', () => {
            const result = card._detailsView._formatSingleEquipment({
                item: 'book|phb',
                displayName: 'prayer book',
            });
            expect(result).toBe('prayer book');
        });

        it('should format special items', () => {
            const result = card._detailsView._formatSingleEquipment({ special: 'set of weighted dice' });
            expect(result).toBe('set of weighted dice');
        });

        it('should append contained gold amount', () => {
            const result = card._detailsView._formatSingleEquipment({
                item: 'pouch|phb',
                containsValue: 1500,
            });
            expect(result).toBe('pouch (containing 15 GP)');
        });
    });
});
