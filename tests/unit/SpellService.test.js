import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { spellService } from '../../src/services/SpellService.js';

const mockSpells = [
    { name: 'Fireball', source: 'PHB', level: 3, school: 'V' },
    { name: 'Magic Missile', source: 'PHB', level: 1, school: 'V' },
    { name: 'Shield', source: 'PHB', level: 1, school: 'A' },
    { name: 'Counterspell', source: 'PHB', level: 3, school: 'A' },
    { name: 'Eldritch Blast', source: 'PHB', level: 0, school: 'V' },
    { name: 'Fireball', source: 'XPHB', level: 3, school: 'V' },
];

const mockClassLookup = {
    phb: {
        fireball: {
            class: { phb: { Wizard: true, Sorcerer: true } },
        },
        'magic missile': {
            class: { phb: { Wizard: true } },
        },
        shield: {
            class: { phb: { Wizard: true, Sorcerer: true } },
        },
        counterspell: {
            class: { phb: { Wizard: true, Sorcerer: true, Warlock: true } },
        },
        'eldritch blast': {
            class: { phb: { Warlock: true } },
        },
    },
};

describe('SpellService', () => {
    beforeEach(async () => {
        spellService._data = null;
        spellService._initPromise = null;
        spellService._spellLookupMap = null;
        spellService._spellClassLookup = null;
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadJSON').mockImplementation((file) => {
            if (file === 'spells/index.json') {
                return Promise.resolve({ PHB: 'spells-phb.json' });
            }
            if (file === 'generated/gendata-spell-source-lookup.json') {
                return Promise.resolve(mockClassLookup);
            }
            if (file === 'spells/spells-phb.json') {
                return Promise.resolve({ spell: mockSpells });
            }
            return Promise.resolve({});
        });

        await spellService.initialize();
    });

    describe('initialize', () => {
        it('should load spells and build lookup maps', () => {
            expect(spellService.isInitialized()).toBe(true);
            expect(spellService._spellLookupMap).toBeInstanceOf(Map);
            expect(spellService._spellClassLookup).not.toBeNull();
        });

        it('should handle failed spell file loads gracefully', async () => {
            spellService._data = null;
            spellService._initPromise = null;
            spellService._spellLookupMap = null;
            spellService._spellClassLookup = null;

            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            vi.spyOn(DataLoader, 'loadJSON').mockImplementation((file) => {
                if (file === 'spells/index.json') {
                    return Promise.resolve({ PHB: 'spells-phb.json' });
                }
                if (file === 'generated/gendata-spell-source-lookup.json') {
                    return Promise.resolve({});
                }
                if (file === 'spells/spells-phb.json') {
                    return Promise.reject(new Error('File corrupted'));
                }
                return Promise.resolve({});
            });

            await spellService.initialize();
            expect(spellService.isInitialized()).toBe(true);
            expect(spellService.getAllSpells()).toEqual([]);
        });
    });

    describe('resetData', () => {
        it('should clear data and lookup maps', () => {
            spellService.resetData();
            expect(spellService._data).toBeNull();
            expect(spellService._spellLookupMap).toBeNull();
            expect(spellService._spellClassLookup).toBeNull();
        });

        it('should reset via DATA_INVALIDATED event', () => {
            eventBus.emit(EVENTS.DATA_INVALIDATED);
            expect(spellService._data).toBeNull();
            expect(spellService._spellLookupMap).toBeNull();
        });
    });

    describe('getAllSpells', () => {
        it('should return all loaded spells', () => {
            expect(spellService.getAllSpells()).toHaveLength(6);
        });

        it('should return empty array when data is null', () => {
            spellService._data = null;
            expect(spellService.getAllSpells()).toEqual([]);
        });
    });

    describe('getSpell', () => {
        it('should find spell by name', () => {
            const spell = spellService.getSpell('Fireball');
            expect(spell.name).toBe('Fireball');
        });

        it('should find spell with explicit source', () => {
            const spell = spellService.getSpell('Fireball', 'XPHB');
            expect(spell.source).toBe('XPHB');
        });

        it('should throw NotFoundError for unknown spell', () => {
            expect(() => spellService.getSpell('Wish')).toThrow(NotFoundError);
        });

        it('should throw ValidationError for empty name', () => {
            expect(() => spellService.getSpell('')).toThrow();
        });
    });

    describe('getSpells', () => {
        it('should return map of name to spell', () => {
            const results = spellService.getSpells(['Fireball', 'Shield']);
            expect(results).toBeInstanceOf(Map);
            expect(results.get('Fireball')).not.toBeNull();
            expect(results.get('Shield')).not.toBeNull();
        });

        it('should return null for unknown spells', () => {
            const results = spellService.getSpells(['Fireball', 'Wish']);
            expect(results.get('Fireball')).not.toBeNull();
            expect(results.get('Wish')).toBeNull();
        });

        it('should return empty map for non-array input', () => {
            const results = spellService.getSpells(null);
            expect(results).toBeInstanceOf(Map);
            expect(results.size).toBe(0);
        });
    });

    describe('isSpellAvailableForClass', () => {
        it('should return true for valid class-spell combinations', () => {
            const fireball = spellService.getSpell('Fireball');
            expect(spellService.isSpellAvailableForClass(fireball, 'Wizard')).toBe(true);
            expect(spellService.isSpellAvailableForClass(fireball, 'Sorcerer')).toBe(true);
        });

        it('should return false for invalid class-spell combinations', () => {
            const fireball = spellService.getSpell('Fireball');
            expect(spellService.isSpellAvailableForClass(fireball, 'Cleric')).toBe(false);
        });

        it('should return false for spell without name or source', () => {
            expect(spellService.isSpellAvailableForClass({}, 'Wizard')).toBe(false);
            expect(spellService.isSpellAvailableForClass(null, 'Wizard')).toBe(false);
        });

        it('should return false when class lookup is null', () => {
            spellService._spellClassLookup = null;
            const fireball = { name: 'Fireball', source: 'PHB' };
            expect(spellService.isSpellAvailableForClass(fireball, 'Wizard')).toBe(false);
        });

        it('should check Warlock-specific spells', () => {
            const blast = spellService.getSpell('Eldritch Blast');
            expect(spellService.isSpellAvailableForClass(blast, 'Warlock')).toBe(true);
            expect(spellService.isSpellAvailableForClass(blast, 'Wizard')).toBe(false);
        });
    });
});
