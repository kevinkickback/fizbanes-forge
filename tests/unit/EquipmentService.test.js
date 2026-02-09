import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/lib/Errors.js';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/lib/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { equipmentService } from '../../src/services/EquipmentService.js';

function createCharacterWithInventory(overrides = {}) {
    return {
        id: 'char-test-1',
        abilityScores: { strength: 10 },
        inventory: {
            items: [],
            equipped: {
                head: null,
                body: null,
                hands: null,
                feet: null,
                back: null,
                neck: null,
                wrists: null,
                fingers: [],
                waist: null,
            },
            attuned: [],
            weight: { current: 0, capacity: 150 },
        },
        ...overrides,
    };
}

function createItemData(overrides = {}) {
    return {
        name: 'Longsword',
        source: 'PHB',
        weight: 3,
        cost: { quantity: 15, unit: 'gp' },
        ...overrides,
    };
}

describe('EquipmentService', () => {
    let character;
    let emitSpy;

    beforeEach(() => {
        character = createCharacterWithInventory();
        emitSpy = vi.spyOn(eventBus, 'emit');
        vi.clearAllMocks();
    });

    describe('addItem', () => {
        it('should add an item to inventory', () => {
            const item = equipmentService.addItem(character, createItemData());

            expect(item.name).toBe('Longsword');
            expect(item.quantity).toBe(1);
            expect(item.equipped).toBe(false);
            expect(item.attuned).toBe(false);
            expect(item.id).toMatch(/^item-/);
            expect(character.inventory.items).toHaveLength(1);
        });

        it('should emit ITEM_ADDED event', () => {
            const item = equipmentService.addItem(character, createItemData());
            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.ITEM_ADDED,
                character,
                item,
            );
        });

        it('should respect quantity parameter', () => {
            const item = equipmentService.addItem(
                character,
                createItemData(),
                5,
            );
            expect(item.quantity).toBe(5);
        });

        it('should set source metadata', () => {
            const item = equipmentService.addItem(
                character,
                createItemData(),
                1,
                'Shop',
            );
            expect(item.metadata.addedFrom).toBe('Shop');
        });

        it('should update inventory weight', () => {
            equipmentService.addItem(character, createItemData({ weight: 10 }));
            expect(character.inventory.weight.current).toBe(10);
        });

        it('should throw ValidationError for character without inventory', () => {
            const noInventory = { id: 'char-x' };
            expect(() =>
                equipmentService.addItem(noInventory, createItemData()),
            ).toThrow(ValidationError);
        });

        it('should throw ValidationError for missing item name', () => {
            expect(() =>
                equipmentService.addItem(character, { source: 'PHB' }),
            ).toThrow(ValidationError);
        });
    });

    describe('removeItem', () => {
        it('should remove an item from inventory', () => {
            const item = equipmentService.addItem(character, createItemData());
            vi.clearAllMocks();

            equipmentService.removeItem(character, item.id);

            expect(character.inventory.items).toHaveLength(0);
        });

        it('should emit ITEM_REMOVED event', () => {
            const item = equipmentService.addItem(character, createItemData());
            vi.clearAllMocks();

            equipmentService.removeItem(character, item.id);

            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.ITEM_REMOVED,
                character,
                expect.objectContaining({ name: 'Longsword' }),
            );
        });

        it('should reduce quantity instead of removing when quantity < item.quantity', () => {
            const item = equipmentService.addItem(
                character,
                createItemData(),
                5,
            );
            equipmentService.removeItem(character, item.id, 2);

            expect(character.inventory.items).toHaveLength(1);
            expect(character.inventory.items[0].quantity).toBe(3);
        });

        it('should throw NotFoundError for non-existent item', () => {
            expect(() =>
                equipmentService.removeItem(character, 'item-nonexistent'),
            ).toThrow(NotFoundError);
        });

        it('should throw ValidationError for character without inventory', () => {
            const noInventory = { id: 'x' };
            expect(() =>
                equipmentService.removeItem(noInventory, 'item-1'),
            ).toThrow(ValidationError);
        });
    });

    describe('unequipItem', () => {
        it('should unequip an item from a slot', () => {
            const item = equipmentService.addItem(character, createItemData());
            item.equipped = true;
            character.inventory.equipped.body = item.id;

            equipmentService.unequipItem(character, item.id);

            expect(item.equipped).toBe(false);
            expect(character.inventory.equipped.body).toBeNull();
        });

        it('should unequip from array slots like fingers', () => {
            const item = equipmentService.addItem(
                character,
                createItemData({ name: 'Ring of Protection' }),
            );
            item.equipped = true;
            character.inventory.equipped.fingers.push(item.id);

            equipmentService.unequipItem(character, item.id);

            expect(item.equipped).toBe(false);
            expect(character.inventory.equipped.fingers).toHaveLength(0);
        });

        it('should emit ITEM_UNEQUIPPED event', () => {
            const item = equipmentService.addItem(character, createItemData());
            item.equipped = true;
            character.inventory.equipped.body = item.id;
            vi.clearAllMocks();

            equipmentService.unequipItem(character, item.id);

            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.ITEM_UNEQUIPPED,
                character,
                expect.objectContaining({ name: 'Longsword' }),
                'body',
            );
        });

        it('should throw NotFoundError for item not in any slot', () => {
            const item = equipmentService.addItem(character, createItemData());
            expect(() =>
                equipmentService.unequipItem(character, item.id),
            ).toThrow(NotFoundError);
        });

        it('should throw ValidationError for character without inventory', () => {
            expect(() =>
                equipmentService.unequipItem({ id: 'x' }, 'item-1'),
            ).toThrow(ValidationError);
        });
    });

    describe('attuneItem', () => {
        it('should attune an item', () => {
            const item = equipmentService.addItem(character, createItemData());

            equipmentService.attuneItem(character, item.id);

            expect(item.attuned).toBe(true);
            expect(character.inventory.attuned).toContain(item.id);
        });

        it('should emit ITEM_ATTUNED event', () => {
            const item = equipmentService.addItem(character, createItemData());
            vi.clearAllMocks();

            equipmentService.attuneItem(character, item.id);

            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.ITEM_ATTUNED,
                character,
                expect.objectContaining({ name: 'Longsword' }),
            );
        });

        it('should not duplicate attunement if already attuned', () => {
            const item = equipmentService.addItem(character, createItemData());
            equipmentService.attuneItem(character, item.id);
            equipmentService.attuneItem(character, item.id);

            expect(
                character.inventory.attuned.filter((id) => id === item.id),
            ).toHaveLength(1);
        });

        it('should throw NotFoundError for non-existent item', () => {
            expect(() =>
                equipmentService.attuneItem(character, 'item-nonexistent'),
            ).toThrow(NotFoundError);
        });
    });

    describe('unattuneItem', () => {
        it('should remove attunement from an item', () => {
            const item = equipmentService.addItem(character, createItemData());
            equipmentService.attuneItem(character, item.id);

            equipmentService.unattuneItem(character, item.id);

            expect(item.attuned).toBe(false);
            expect(character.inventory.attuned).not.toContain(item.id);
        });

        it('should emit ITEM_UNATTUNED event', () => {
            const item = equipmentService.addItem(character, createItemData());
            equipmentService.attuneItem(character, item.id);
            vi.clearAllMocks();

            equipmentService.unattuneItem(character, item.id);

            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.ITEM_UNATTUNED,
                character,
                expect.objectContaining({ name: 'Longsword' }),
            );
        });

        it('should throw NotFoundError for non-attuned item', () => {
            const item = equipmentService.addItem(character, createItemData());
            expect(() =>
                equipmentService.unattuneItem(character, item.id),
            ).toThrow(NotFoundError);
        });
    });

    describe('calculateTotalWeight', () => {
        it('should sum item weights times quantities', () => {
            equipmentService.addItem(
                character,
                createItemData({ weight: 3 }),
                2,
            );
            equipmentService.addItem(
                character,
                createItemData({ name: 'Shield', weight: 6 }),
            );

            expect(equipmentService.calculateTotalWeight(character)).toBe(12);
        });

        it('should return 0 for character without inventory', () => {
            expect(equipmentService.calculateTotalWeight({})).toBe(0);
        });

        it('should return 0 for empty inventory', () => {
            expect(equipmentService.calculateTotalWeight(character)).toBe(0);
        });
    });

    describe('calculateCarryCapacity', () => {
        it('should calculate capacity as strength × 15', () => {
            character.abilityScores.strength = 16;
            expect(equipmentService.calculateCarryCapacity(character)).toBe(240);
        });

        it('should default to 10 strength', () => {
            character.abilityScores = {};
            expect(equipmentService.calculateCarryCapacity(character)).toBe(150);
        });

        it('should double capacity for Powerful Build trait', () => {
            character.abilityScores.strength = 10;
            character.traits = ['Powerful Build'];
            expect(equipmentService.calculateCarryCapacity(character)).toBe(300);
        });

        it('should double capacity for Powerful Build on race traits', () => {
            character.abilityScores.strength = 10;
            character.race = { traits: ['Powerful Build'] };
            expect(equipmentService.calculateCarryCapacity(character)).toBe(300);
        });
    });

    describe('getInventoryItems', () => {
        it('should return inventory items', () => {
            equipmentService.addItem(character, createItemData());
            expect(equipmentService.getInventoryItems(character)).toHaveLength(1);
        });

        it('should return empty array for character without inventory', () => {
            expect(equipmentService.getInventoryItems({})).toEqual([]);
        });
    });

    describe('getAttunedItems', () => {
        it('should return only attuned items', () => {
            const item1 = equipmentService.addItem(character, createItemData());
            equipmentService.addItem(
                character,
                createItemData({ name: 'Shield' }),
            );
            equipmentService.attuneItem(character, item1.id);

            const attuned = equipmentService.getAttunedItems(character);
            expect(attuned).toHaveLength(1);
            expect(attuned[0].name).toBe('Longsword');
        });

        it('should return empty array when none attuned', () => {
            expect(equipmentService.getAttunedItems(character)).toEqual([]);
        });

        it('should return empty array for character without inventory', () => {
            expect(equipmentService.getAttunedItems({})).toEqual([]);
        });
    });

    describe('findItemById', () => {
        it('should find an item by instance id', () => {
            const item = equipmentService.addItem(character, createItemData());
            expect(equipmentService.findItemById(character, item.id)).toBe(
                character.inventory.items[0],
            );
        });

        it('should return null for non-existent id', () => {
            expect(
                equipmentService.findItemById(character, 'item-missing'),
            ).toBeNull();
        });

        it('should return null for character without inventory', () => {
            expect(equipmentService.findItemById({}, 'item-1')).toBeNull();
        });
    });
});
