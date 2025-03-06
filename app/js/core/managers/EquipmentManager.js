import { InventoryManager } from './InventoryManager.js';
import { AttunementManager } from './AttunementManager.js';

export class EquipmentManager {
    constructor(character) {
        this.character = character;
        this.equipped = new Map();
        this.inventoryManager = new InventoryManager(character);
        this.attunementManager = new AttunementManager(character);
    }

    async addItem(itemId, quantity = 1) {
        return await this.inventoryManager.addItem(itemId, quantity);
    }

    removeItem(itemId, quantity = 1) {
        // If equipped, unequip first
        if (this.isEquipped(itemId)) {
            this.unequipItem(itemId);
        }

        // If attuned, unattune first
        if (this.attunementManager.isAttuned(itemId)) {
            this.unattuneItem(itemId);
        }

        return this.inventoryManager.removeItem(itemId, quantity);
    }

    equipItem(itemId, slotHint = null) {
        const item = this.inventoryManager.getItem(itemId);
        if (!item || !item.item.canBeEquipped) return false;

        // Determine the appropriate slot based on item type and current equipment
        const equipSlot = this.determineEquipmentSlot(item.item, slotHint);
        if (!equipSlot) return false;

        // Unequip any items in the target slot
        if (this.equipped.has(equipSlot)) {
            this.unequipItem(this.equipped.get(equipSlot).id);
        }

        // For two-handed weapons, also unequip the other hand
        if (item.item.type === 'weapon' && item.item.twoHanded) {
            const otherHand = equipSlot === 'mainHand' ? 'offHand' : 'mainHand';
            if (this.equipped.has(otherHand)) {
                this.unequipItem(this.equipped.get(otherHand).id);
            }
        }

        this.equipped.set(equipSlot, item);
        return true;
    }

    determineEquipmentSlot(item, slotHint) {
        // For armor, use the armor category as the slot
        if (item.type === 'armor') {
            return item.category || item.armorCategory || 'armor';
        }

        // For weapons and shields
        if (item.type === 'weapon' || item.type === 'shield') {
            // If it's two-handed, it must go in the main hand
            if (item.twoHanded) {
                return 'mainHand';
            }

            // If a specific slot was requested and it's available (or will be after unequipping)
            if (slotHint === 'mainHand' || slotHint === 'offHand') {
                return slotHint;
            }

            // Auto-select an available hand
            if (!this.equipped.has('mainHand')) return 'mainHand';
            if (!this.equipped.has('offHand')) return 'offHand';
            return null; // No available slots
        }

        // For other equipment types, use the item type as the slot
        return item.type;
    }

    unequipItem(itemId) {
        // Find and remove from equipped slots
        for (const [slot, equippedItem] of this.equipped.entries()) {
            if (equippedItem.item.id === itemId) {
                this.equipped.delete(slot);
                return true;
            }
        }

        return false;
    }

    isEquipped(itemId) {
        for (const [_, equippedItem] of this.equipped.entries()) {
            if (equippedItem.item.id === itemId) {
                return true;
            }
        }
        return false;
    }

    async attuneItem(itemId) {
        return await this.attunementManager.attuneItem(itemId);
    }

    unattuneItem(itemId) {
        return this.attunementManager.unattuneItem(itemId);
    }

    getEquippedItems() {
        return Array.from(this.equipped.values());
    }

    getAttunedItems() {
        return this.attunementManager.getAttunedItems();
    }

    getInventoryWeight() {
        return this.inventoryManager.getInventoryWeight();
    }

    toJSON() {
        return {
            inventory: this.inventoryManager.toJSON(),
            equipped: Array.from(this.equipped.entries()).map(([slot, item]) => ({
                slot,
                itemId: item.item.id
            })),
            attuned: this.attunementManager.toJSON()
        };
    }

    async fromJSON(data) {
        // Clear current state
        this.equipped.clear();

        // Load inventory and attuned items
        await this.inventoryManager.fromJSON(data.inventory);
        await this.attunementManager.fromJSON(data.attuned);

        // Load equipped items
        if (data?.equipped) {
            for (const equip of data.equipped) {
                this.equipItem(equip.itemId, equip.slot);
            }
        }
    }
} 