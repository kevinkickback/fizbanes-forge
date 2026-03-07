import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/lib/Errors.js';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

// Mock ItemService so resolveBackgroundEquipment tests control lookup results
vi.mock('../../src/services/ItemService.js', () => ({
    itemService: {
        getItem: vi.fn(),
    },
}));

import { equipmentService } from '../../src/services/EquipmentService.js';
import { itemService } from '../../src/services/ItemService.js';

function createCharacterWithInventory(overrides = {}) {
    return {
        id: 'char-test-1',
        abilityScores: { strength: 10 },
        inventory: {
            items: [],
            equipped: [],
            attuned: [],
            currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
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

    describe('equipItem', () => {
        it('should equip an item', () => {
            const item = equipmentService.addItem(
                character,
                createItemData({ weapon: true }),
            );

            equipmentService.equipItem(character, item.id);

            expect(item.equipped).toBe(true);
            expect(character.inventory.equipped).toContain(item.id);
        });

        it('should emit ITEM_EQUIPPED event', () => {
            const item = equipmentService.addItem(
                character,
                createItemData({ weapon: true }),
            );
            vi.clearAllMocks();

            equipmentService.equipItem(character, item.id);

            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.ITEM_EQUIPPED,
                character,
                expect.objectContaining({ name: 'Longsword' }),
            );
        });

        it('should not duplicate if already equipped', () => {
            const item = equipmentService.addItem(
                character,
                createItemData({ weapon: true }),
            );
            equipmentService.equipItem(character, item.id);
            equipmentService.equipItem(character, item.id);

            expect(
                character.inventory.equipped.filter((id) => id === item.id),
            ).toHaveLength(1);
        });

        it('should prevent equipping two armors', () => {
            const armor1 = equipmentService.addItem(
                character,
                createItemData({ name: 'Chain Mail', type: 'HA', armor: true }),
            );
            equipmentService.equipItem(character, armor1.id);

            const armor2 = equipmentService.addItem(
                character,
                createItemData({ name: 'Plate Armor', type: 'HA', armor: true }),
            );

            expect(() =>
                equipmentService.equipItem(character, armor2.id),
            ).toThrow(ValidationError);
        });

        it('should prevent equipping two shields', () => {
            const shield1 = equipmentService.addItem(
                character,
                createItemData({ name: 'Shield', type: 'S', weight: 6 }),
            );
            equipmentService.equipItem(character, shield1.id);

            const shield2 = equipmentService.addItem(
                character,
                createItemData({ name: 'Shield +1', type: 'S', weight: 6 }),
            );

            expect(() =>
                equipmentService.equipItem(character, shield2.id),
            ).toThrow(ValidationError);
        });

        it('should allow equipping armor and shield together', () => {
            const armor = equipmentService.addItem(
                character,
                createItemData({ name: 'Chain Mail', type: 'HA', armor: true }),
            );
            const shield = equipmentService.addItem(
                character,
                createItemData({ name: 'Shield', type: 'S', weight: 6 }),
            );

            equipmentService.equipItem(character, armor.id);
            equipmentService.equipItem(character, shield.id);

            expect(armor.equipped).toBe(true);
            expect(shield.equipped).toBe(true);
        });

        it('should allow equipping multiple weapons', () => {
            const weapon1 = equipmentService.addItem(
                character,
                createItemData({ name: 'Longsword', weapon: true }),
            );
            const weapon2 = equipmentService.addItem(
                character,
                createItemData({ name: 'Shortsword', weapon: true }),
            );

            equipmentService.equipItem(character, weapon1.id);
            equipmentService.equipItem(character, weapon2.id);

            expect(weapon1.equipped).toBe(true);
            expect(weapon2.equipped).toBe(true);
        });

        it('should throw NotFoundError for non-existent item', () => {
            expect(() =>
                equipmentService.equipItem(character, 'item-nonexistent'),
            ).toThrow(NotFoundError);
        });

        it('should throw ValidationError for character without inventory', () => {
            expect(() =>
                equipmentService.equipItem({ id: 'x' }, 'item-1'),
            ).toThrow(ValidationError);
        });
    });

    describe('unequipItem', () => {
        it('should unequip an item', () => {
            const item = equipmentService.addItem(
                character,
                createItemData({ weapon: true }),
            );
            equipmentService.equipItem(character, item.id);

            equipmentService.unequipItem(character, item.id);

            expect(item.equipped).toBe(false);
            expect(character.inventory.equipped).not.toContain(item.id);
        });

        it('should emit ITEM_UNEQUIPPED event', () => {
            const item = equipmentService.addItem(
                character,
                createItemData({ weapon: true }),
            );
            equipmentService.equipItem(character, item.id);
            vi.clearAllMocks();

            equipmentService.unequipItem(character, item.id);

            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.ITEM_UNEQUIPPED,
                character,
                expect.objectContaining({ name: 'Longsword' }),
            );
        });

        it('should throw NotFoundError for item not equipped', () => {
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

    describe('removeItemsBySource', () => {
        it('should remove all items with matching addedFrom source', () => {
            equipmentService.addItem(character, createItemData(), 1, 'Background');
            equipmentService.addItem(character, createItemData({ name: 'Shield' }), 1, 'Background');
            vi.clearAllMocks();

            const removed = equipmentService.removeItemsBySource(character, 'Background');

            expect(character.inventory.items).toHaveLength(0);
            expect(removed).toHaveLength(2);
        });

        it('should not remove items from a different source', () => {
            equipmentService.addItem(character, createItemData(), 1, 'Background');
            equipmentService.addItem(character, createItemData({ name: 'Dagger' }), 1, 'Manual');

            equipmentService.removeItemsBySource(character, 'Background');

            expect(character.inventory.items).toHaveLength(1);
            expect(character.inventory.items[0].metadata.addedFrom).toBe('Manual');
        });

        it('should unequip items before removal', () => {
            const item = equipmentService.addItem(character, createItemData({ weapon: true }), 1, 'Background');
            equipmentService.equipItem(character, item.id);
            expect(character.inventory.equipped).toContain(item.id);

            equipmentService.removeItemsBySource(character, 'Background');

            expect(character.inventory.equipped).not.toContain(item.id);
            expect(character.inventory.items).toHaveLength(0);
        });

        it('should unattune items before removal', () => {
            const item = equipmentService.addItem(character, createItemData({ reqAttune: true }), 1, 'Background');
            character.inventory.attuned.push(item.id);
            item.attuned = true;

            equipmentService.removeItemsBySource(character, 'Background');

            expect(character.inventory.attuned).not.toContain(item.id);
            expect(character.inventory.items).toHaveLength(0);
        });

        it('should update inventory weight after removal', () => {
            equipmentService.addItem(character, createItemData({ weight: 5 }), 1, 'Background');
            expect(character.inventory.weight.current).toBe(5);

            equipmentService.removeItemsBySource(character, 'Background');

            expect(character.inventory.weight.current).toBe(0);
        });

        it('should emit INVENTORY_UPDATED event', () => {
            equipmentService.addItem(character, createItemData(), 1, 'Background');
            vi.clearAllMocks();

            equipmentService.removeItemsBySource(character, 'Background');

            expect(emitSpy).toHaveBeenCalledWith(EVENTS.INVENTORY_UPDATED, character);
        });

        it('should return empty array when no items match', () => {
            equipmentService.addItem(character, createItemData(), 1, 'Manual');

            const removed = equipmentService.removeItemsBySource(character, 'Background');

            expect(removed).toEqual([]);
        });

        it('should return empty array for character without inventory', () => {
            const noInventory = { id: 'x' };
            const removed = equipmentService.removeItemsBySource(noInventory, 'Background');
            expect(removed).toEqual([]);
        });

        it('should throw ValidationError for null character', () => {
            expect(() => equipmentService.removeItemsBySource(null, 'Background')).toThrow(ValidationError);
        });

        it('should throw ValidationError for empty source string', () => {
            expect(() => equipmentService.removeItemsBySource(character, '')).toThrow(ValidationError);
        });
    });

    describe('addCurrency', () => {
        it('should add currency to inventory', () => {
            equipmentService.addCurrency(character, { gp: 10, sp: 5 });

            expect(character.inventory.currency.gp).toBe(10);
            expect(character.inventory.currency.sp).toBe(5);
        });

        it('should accumulate currency across multiple calls', () => {
            equipmentService.addCurrency(character, { gp: 10 });
            equipmentService.addCurrency(character, { gp: 5, cp: 3 });

            expect(character.inventory.currency.gp).toBe(15);
            expect(character.inventory.currency.cp).toBe(3);
        });

        it('should ignore undefined denominations', () => {
            equipmentService.addCurrency(character, { gp: 7 });

            expect(character.inventory.currency.sp).toBe(0);
            expect(character.inventory.currency.cp).toBe(0);
        });

        it('should emit INVENTORY_UPDATED event', () => {
            equipmentService.addCurrency(character, { gp: 1 });

            expect(emitSpy).toHaveBeenCalledWith(EVENTS.INVENTORY_UPDATED, character);
        });

        it('should throw ValidationError for character without inventory currency', () => {
            expect(() =>
                equipmentService.addCurrency({ id: 'x' }, { gp: 1 }),
            ).toThrow(ValidationError);
        });
    });

    describe('resolveBackgroundEquipment', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should resolve string item refs via itemService', () => {
            itemService.getItem.mockReturnValue({ name: 'Dagger', source: 'XPHB', weight: 1 });

            const { items } = equipmentService.resolveBackgroundEquipment(
                { equipment: [{ _: ['dagger|xphb'] }] },
                null,
            );

            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('Dagger');
            expect(itemService.getItem).toHaveBeenCalledWith('dagger', 'xphb');
        });

        it('should fall back to placeholder when itemService throws NotFoundError', () => {
            itemService.getItem.mockImplementation(() => {
                throw new NotFoundError('Item', 'unknown|phb');
            });

            const { items } = equipmentService.resolveBackgroundEquipment(
                { equipment: [{ _: ['unknown|phb'] }] },
                null,
            );

            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('unknown');
            expect(items[0].weight).toBe(0);
        });

        it('should convert currency values (value field) to currency object', () => {
            const { items, currency } = equipmentService.resolveBackgroundEquipment(
                { equipment: [{ _: [{ value: 5000 }] }] },
                null,
            );

            expect(items).toHaveLength(0);
            expect(currency.gp).toBe(50);
        });

        it('should convert partial copper value correctly', () => {
            const { currency } = equipmentService.resolveBackgroundEquipment(
                { equipment: [{ _: [{ value: 1600 }] }] },
                null,
            );

            expect(currency.gp).toBe(16);
        });

        it('should resolve item ref objects with quantity', () => {
            itemService.getItem.mockReturnValue({ name: 'Book', source: 'PHB', weight: 5 });

            const { items } = equipmentService.resolveBackgroundEquipment(
                { equipment: [{ _: [{ item: 'book|phb', quantity: 2 }] }] },
                null,
            );

            expect(items[0].quantity).toBe(2);
        });

        it('should add containsValue from item ref as currency', () => {
            itemService.getItem.mockReturnValue({ name: 'Pouch', source: 'PHB', weight: 1 });

            const { currency } = equipmentService.resolveBackgroundEquipment(
                { equipment: [{ _: [{ item: 'pouch|phb', containsValue: 1500 }] }] },
                null,
            );

            expect(currency.gp).toBe(15);
        });

        it('should resolve special items as placeholders', () => {
            const { items } = equipmentService.resolveBackgroundEquipment(
                { equipment: [{ _: [{ special: 'incense sticks', quantity: 5 }] }] },
                null,
            );

            expect(items[0].name).toBe('incense sticks');
            expect(items[0].quantity).toBe(5);
            expect(items[0].weight).toBe(0);
        });

        it('should resolve equipmentType items as display name placeholders', () => {
            const { items } = equipmentService.resolveBackgroundEquipment(
                { equipment: [{ _: [{ equipmentType: 'toolArtisan' }] }] },
                null,
            );

            expect(items[0].name).toBe("Artisan's Tools (any)");
        });

        it('should include fixed _ items always', () => {
            itemService.getItem.mockReturnValue({ name: 'Dagger', source: 'PHB', weight: 1 });

            const { items } = equipmentService.resolveBackgroundEquipment(
                { equipment: [{ _: ['dagger|phb'], a: [], b: [] }] },
                { 0: 'a' },
            );

            expect(items.some((i) => i.name === 'Dagger')).toBe(true);
        });

        it('should include items from the selected choice key', () => {
            itemService.getItem
                .mockReturnValueOnce({ name: 'Prayer Book', source: 'PHB', weight: 1 })
                .mockReturnValueOnce({ name: 'Pouch', source: 'PHB', weight: 1 });

            const bg = {
                equipment: [
                    { _: [{ item: 'pouch|phb' }] },
                    { a: [{ item: 'prayer book|phb' }], b: [{ special: 'prayer wheel' }] },
                ],
            };

            const { items } = equipmentService.resolveBackgroundEquipment(bg, { 0: 'a' });

            expect(items.some((i) => i.name === 'Prayer Book')).toBe(true);
            expect(items.every((i) => i.name !== 'prayer wheel')).toBe(true);
        });

        it('should resolve choice items from a separate equipment entry (Acolyte-style)', () => {
            itemService.getItem
                .mockReturnValueOnce({ name: 'Holy Symbol', source: 'PHB', weight: 1 })
                .mockReturnValueOnce({ name: 'Prayer Book', source: 'PHB', weight: 5 });

            const bg = {
                equipment: [
                    { _: [{ item: 'holy symbol|phb' }] },
                    { a: [{ item: 'prayer book|phb' }], b: [{ special: 'prayer wheel' }] },
                ],
            };

            const { items } = equipmentService.resolveBackgroundEquipment(bg, { 0: 'a' });

            expect(items.some(i => i.name === 'Holy Symbol')).toBe(true);
            expect(items.some(i => i.name === 'Prayer Book')).toBe(true);
        });

        it('should resolve choice b from a separate equipment entry', () => {
            itemService.getItem
                .mockReturnValueOnce({ name: 'Holy Symbol', source: 'PHB', weight: 1 });

            const bg = {
                equipment: [
                    { _: [{ item: 'holy symbol|phb' }] },
                    { a: [{ item: 'prayer book|phb' }], b: [{ special: 'prayer wheel' }] },
                ],
            };

            const { items } = equipmentService.resolveBackgroundEquipment(bg, { 0: 'b' });

            expect(items.some(i => i.name === 'Holy Symbol')).toBe(true);
            expect(items.some(i => i.name === 'prayer wheel')).toBe(true);
            expect(items.every(i => i.name !== 'Prayer Book')).toBe(true);
        });

        it('should return empty results for background with no equipment', () => {
            const { items, currency } = equipmentService.resolveBackgroundEquipment({}, null);

            expect(items).toHaveLength(0);
            expect(currency.gp).toBe(0);
        });
    });

    describe('applyBackgroundEquipment', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            itemService.getItem.mockReturnValue({ name: 'Dagger', source: 'PHB', weight: 1 });
        });

        it('should add items from background to inventory', () => {
            character.background = { name: 'Test', source: 'PHB' };

            equipmentService.applyBackgroundEquipment(
                character,
                { equipment: [{ _: ['dagger|phb'] }] },
                null,
            );

            expect(character.inventory.items).toHaveLength(1);
            expect(character.inventory.items[0].metadata.addedFrom).toBe('Background');
        });

        it('should remove previous background items when called again', () => {
            character.background = { name: 'Test', source: 'PHB' };

            equipmentService.applyBackgroundEquipment(
                character,
                { equipment: [{ _: ['dagger|phb'] }] },
                null,
            );
            expect(character.inventory.items).toHaveLength(1);

            itemService.getItem.mockReturnValue({ name: 'Shield', source: 'PHB', weight: 6 });
            equipmentService.applyBackgroundEquipment(
                character,
                { equipment: [{ _: ['shield|phb'] }] },
                null,
            );

            expect(character.inventory.items).toHaveLength(1);
            expect(character.inventory.items[0].name).toBe('Shield');
        });

        it('should add currency from background', () => {
            character.background = { name: 'Test', source: 'PHB' };

            equipmentService.applyBackgroundEquipment(
                character,
                { equipment: [{ _: [{ value: 5000 }] }] },
                null,
            );

            expect(character.inventory.currency.gp).toBe(50);
        });

        it('should subtract previous background currency when switching', () => {
            character.background = { name: 'Test', source: 'PHB' };

            equipmentService.applyBackgroundEquipment(
                character,
                { equipment: [{ _: [{ value: 5000 }] }] },
                null,
            );
            expect(character.inventory.currency.gp).toBe(50);

            equipmentService.applyBackgroundEquipment(
                character,
                { equipment: [{ _: [{ value: 1000 }] }] },
                null,
            );

            expect(character.inventory.currency.gp).toBe(10);
        });

        it('should track addedCurrency on character.background', () => {
            character.background = { name: 'Test', source: 'PHB' };

            equipmentService.applyBackgroundEquipment(
                character,
                { equipment: [{ _: [{ value: 5000 }] }] },
                null,
            );

            expect(character.background.addedCurrency).toEqual(
                expect.objectContaining({ gp: 50 }),
            );
        });

        it('should handle null background (clear only)', () => {
            character.background = { name: 'Test', source: 'PHB' };
            equipmentService.addItem(character, createItemData(), 1, 'Background');

            equipmentService.applyBackgroundEquipment(character, null, null);

            expect(character.inventory.items).toHaveLength(0);
        });

        it('should not affect manually added items', () => {
            character.background = { name: 'Test', source: 'PHB' };
            equipmentService.addItem(character, createItemData({ name: 'Manual Sword' }), 1, 'Manual');

            equipmentService.applyBackgroundEquipment(
                character,
                { equipment: [{ _: ['dagger|phb'] }] },
                null,
            );

            expect(character.inventory.items).toHaveLength(2);
            expect(character.inventory.items.some((i) => i.name === 'Manual Sword')).toBe(true);
        });

        it('should do nothing for null character', () => {
            expect(() =>
                equipmentService.applyBackgroundEquipment(null, {}, null),
            ).not.toThrow();
        });
    });

    describe('addItem ac field', () => {
        it('should store ac value from armor item data', () => {
            const item = equipmentService.addItem(
                character,
                createItemData({ name: 'Chain Mail', type: 'HA', armor: true, ac: 16 }),
            );
            expect(item.ac).toBe(16);
        });

        it('should default ac to 0 for non-armor items', () => {
            const item = equipmentService.addItem(character, createItemData());
            expect(item.ac).toBe(0);
        });

        it('should store ac for shields', () => {
            const item = equipmentService.addItem(
                character,
                createItemData({ name: 'Shield', type: 'S', ac: 2 }),
            );
            expect(item.ac).toBe(2);
        });
    });

    describe('computeArmorClass', () => {
        it('should return 10 + DEX mod when unarmored', () => {
            character.abilityScores.dexterity = 14; // +2 mod
            expect(equipmentService.computeArmorClass(character)).toBe(12);
        });

        it('should return 10 when DEX is 10 and unarmored', () => {
            character.abilityScores.dexterity = 10;
            expect(equipmentService.computeArmorClass(character)).toBe(10);
        });

        it('should handle negative DEX modifier when unarmored', () => {
            character.abilityScores.dexterity = 8; // -1 mod
            expect(equipmentService.computeArmorClass(character)).toBe(9);
        });

        it('should add full DEX mod for light armor', () => {
            character.abilityScores.dexterity = 16; // +3 mod
            const armor = equipmentService.addItem(
                character,
                createItemData({ name: 'Leather Armor', type: 'LA', armor: true, ac: 11 }),
            );
            equipmentService.equipItem(character, armor.id);
            expect(equipmentService.computeArmorClass(character)).toBe(14); // 11 + 3
        });

        it('should cap DEX mod at +2 for medium armor', () => {
            character.abilityScores.dexterity = 18; // +4 mod
            const armor = equipmentService.addItem(
                character,
                createItemData({ name: 'Chain Shirt', type: 'MA', armor: true, ac: 13 }),
            );
            equipmentService.equipItem(character, armor.id);
            expect(equipmentService.computeArmorClass(character)).toBe(15); // 13 + 2 (capped)
        });

        it('should apply full DEX mod up to cap for medium armor', () => {
            character.abilityScores.dexterity = 12; // +1 mod
            const armor = equipmentService.addItem(
                character,
                createItemData({ name: 'Scale Mail', type: 'MA', armor: true, ac: 14 }),
            );
            equipmentService.equipItem(character, armor.id);
            expect(equipmentService.computeArmorClass(character)).toBe(15); // 14 + 1
        });

        it('should use flat AC for heavy armor (no DEX bonus)', () => {
            character.abilityScores.dexterity = 18; // +4 mod — should be ignored
            const armor = equipmentService.addItem(
                character,
                createItemData({ name: 'Chain Mail', type: 'HA', armor: true, ac: 16 }),
            );
            equipmentService.equipItem(character, armor.id);
            expect(equipmentService.computeArmorClass(character)).toBe(16);
        });

        it('should add shield bonus on top of heavy armor', () => {
            character.abilityScores.dexterity = 10;
            const armor = equipmentService.addItem(
                character,
                createItemData({ name: 'Plate Armor', type: 'HA', armor: true, ac: 18 }),
            );
            const shield = equipmentService.addItem(
                character,
                createItemData({ name: 'Shield', type: 'S', ac: 2 }),
            );
            equipmentService.equipItem(character, armor.id);
            equipmentService.equipItem(character, shield.id);
            expect(equipmentService.computeArmorClass(character)).toBe(20); // 18 + 2
        });

        it('should add shield bonus on top of light armor', () => {
            character.abilityScores.dexterity = 14; // +2
            const armor = equipmentService.addItem(
                character,
                createItemData({ name: 'Leather Armor', type: 'LA', armor: true, ac: 11 }),
            );
            const shield = equipmentService.addItem(
                character,
                createItemData({ name: 'Shield', type: 'S', ac: 2 }),
            );
            equipmentService.equipItem(character, armor.id);
            equipmentService.equipItem(character, shield.id);
            expect(equipmentService.computeArmorClass(character)).toBe(15); // 11 + 2 + 2
        });

        it('should add shield bonus to unarmored AC', () => {
            character.abilityScores.dexterity = 14; // +2
            const shield = equipmentService.addItem(
                character,
                createItemData({ name: 'Shield', type: 'S', ac: 2 }),
            );
            equipmentService.equipItem(character, shield.id);
            expect(equipmentService.computeArmorClass(character)).toBe(14); // 10 + 2 + 2
        });

        it('should default shield ac to 2 when not stored', () => {
            character.abilityScores.dexterity = 10;
            const shield = equipmentService.addItem(
                character,
                createItemData({ name: 'Shield', type: 'S' }), // no ac on source item
            );
            equipmentService.equipItem(character, shield.id);
            expect(equipmentService.computeArmorClass(character)).toBe(12); // 10 + 0(DEX) + 2(default shield)
        });

        it('should not count unequipped armor', () => {
            character.abilityScores.dexterity = 10;
            equipmentService.addItem(
                character,
                createItemData({ name: 'Chain Mail', type: 'HA', armor: true, ac: 16 }),
            );
            // Item added but NOT equipped
            expect(equipmentService.computeArmorClass(character)).toBe(10);
        });

        it('should return 10 when inventory is empty', () => {
            character.abilityScores.dexterity = 10;
            expect(equipmentService.computeArmorClass(character)).toBe(10);
        });

        it('should default to 10 DEX when abilityScores missing', () => {
            const char = { inventory: { items: [], equipped: [], attuned: [], currency: {}, weight: { current: 0, capacity: 150 } } };
            expect(equipmentService.computeArmorClass(char)).toBe(10);
        });
    });
});
