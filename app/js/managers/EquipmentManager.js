import { InventoryManager } from './InventoryManager.js';
import { AttunementManager } from './AttunementManager.js';
import { Item } from '../models/Item.js';
import { Weapon } from '../models/Weapon.js';
import { Armor } from '../models/Armor.js';

export class EquipmentManager {
    constructor(character) {
        this.character = character;
        this.equipped = new Map();
        this.inventoryManager = new InventoryManager(character, this);
        this.attunementManager = new AttunementManager(character);
        this.cache = {
            items: null,
            magicItems: null,
            fluff: null
        };
    }

    /**
     * Load all available items
     * @returns {Promise<Array>} Array of processed items
     */
    async loadItems() {
        if (this.cache.items) return this.cache.items;

        try {
            // Load base items, items, magic items, and fluff data
            const [baseItems, items, magicItems, fluffData] = await Promise.all([
                window.dndDataLoader.loadJsonFile('items-base.json'),
                window.dndDataLoader.loadJsonFile('items.json'),
                window.dndDataLoader.loadJsonFile('magicvariants.json'),
                window.dndDataLoader.loadJsonFile('fluff-items.json').catch(() => ({}))
            ]);

            const allItems = [];

            // Process base items
            if (baseItems.baseitem) {
                for (const item of baseItems.baseitem) {
                    const processedItem = await this.processItem(item, fluffData);
                    allItems.push(processedItem);
                }
            }

            // Process items from items.json
            if (items.item) {
                for (const item of items.item) {
                    const processedItem = await this.processItem(item, fluffData);
                    allItems.push(processedItem);
                }
            }

            // Process magic variants
            if (magicItems.magicvariant) {
                for (const variant of magicItems.magicvariant) {
                    const processedVariant = await this.processItem(variant, fluffData);
                    processedVariant.magical = true;
                    allItems.push(processedVariant);
                }
            }

            // Cache and return processed items
            this.cache.items = allItems;
            return allItems;
        } catch (error) {
            console.error('Error loading items:', error);
            throw error;
        }
    }

    /**
     * Process raw item data into an Item instance
     * @param {Object} itemData - Raw item data
     * @param {Object} fluff - Optional fluff data
     * @returns {Item} Processed item instance
     */
    async processItem(itemData, fluff = null) {
        // Add fluff data to item description if available
        if (fluff?.entries?.length) {
            itemData.description = await window.dndTextProcessor.processText(fluff.entries[0]);
        }

        // Create appropriate item type based on data
        if (itemData.weapon || itemData.weaponCategory) {
            return new Weapon(itemData);
        }
        if (itemData.armor) {
            return new Armor(itemData);
        }
        return new Item(itemData);
    }

    /**
     * Process magic item variants
     * @param {Object} variant - Magic item variant data
     * @param {Object} fluff - Optional fluff data
     * @returns {Promise<Item|null>} Processed magic item or null if invalid
     */
    async processMagicVariant(variant, fluff = null) {
        try {
            const baseItem = variant.requires?.[0];
            if (!baseItem) return null;

            // Load base item data
            const items = await this.loadItems();
            const base = items.find(i =>
                i.name.toLowerCase() === baseItem.name.toLowerCase() &&
                (!baseItem.source || i.source === baseItem.source)
            );

            if (!base) return null;

            // Create new item data by merging base and variant
            const mergedData = {
                ...base.toJSON(),
                name: variant.name,
                source: variant.source || base.source,
                rarity: variant.rarity || base.rarity,
                value: variant.value || base.value,
                description: fluff?.entries?.[0] || variant.entries?.[0] || base.description,
                attunement: variant.reqAttune || base.attunement
            };

            // Add variant-specific modifications
            if (variant.bonusAc) {
                mergedData.baseAC = (mergedData.baseAC || 10) + variant.bonusAc;
            }
            if (variant.bonusWeapon) {
                if (mergedData.damage) {
                    mergedData.damage.modifier = (mergedData.damage.modifier || 0) + variant.bonusWeapon;
                }
                if (mergedData.versatile) {
                    mergedData.versatile.modifier = (mergedData.versatile.modifier || 0) + variant.bonusWeapon;
                }
            }

            // Create appropriate item type
            return this.processItem(mergedData, fluff);
        } catch (error) {
            console.error('Error processing magic variant:', error);
            return null;
        }
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

    /**
     * Get an item by its ID
     * @param {string} id - Item ID
     * @returns {Promise<Item|null>} Item or null if not found
     */
    async getItemById(id) {
        const items = await this.loadItems();
        return items.find(item => item.id === id) || null;
    }

    /**
     * Get items by type
     * @param {string} type - Item type
     * @returns {Promise<Array>} Array of items of the specified type
     */
    async getItemsByType(type) {
        const items = await this.loadItems();
        return items.filter(item => item.type === type);
    }

    /**
     * Get all weapons
     * @returns {Promise<Array>} Array of weapons
     */
    async getWeapons() {
        return this.getItemsByType('weapon');
    }

    /**
     * Get all armor
     * @returns {Promise<Array>} Array of armor
     */
    async getArmor() {
        return this.getItemsByType('armor');
    }

    /**
     * Get all magic items
     * @returns {Promise<Array>} Array of magic items
     */
    async getMagicItems() {
        const items = await this.loadItems();
        return items.filter(item => item.rarity !== 'common' || item.attunement);
    }

    /**
     * Clear the item cache
     */
    clearCache() {
        this.cache = {
            items: null,
            magicItems: null,
            fluff: null
        };
    }
} 