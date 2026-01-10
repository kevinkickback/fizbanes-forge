/** @file Manages character inventory, equipment slots, attunement, and encumbrance. */

import { eventBus, EVENTS } from '../lib/EventBus.js';
import { BaseDataService } from './BaseDataService.js';

/**
 * Manages character equipment, inventory, and attunement.
 * Handles equipping, unequipping, attuning items, and encumbrance calculations.
 */
class EquipmentService extends BaseDataService {
    /**
     * Creates a new EquipmentService instance.
     */
    constructor() {
        super({
            cacheKey: null,
            loggerScope: 'EquipmentService',
        });

        // Valid equipment slots for character equipping
        this.validSlots = {
            head: 'Head (Helm, Crown)',
            body: 'Body (Armor)',
            hands: 'Hands (Gloves)',
            feet: 'Feet (Boots)',
            back: 'Back (Cloak, Cape)',
            neck: 'Neck (Amulet, Pendant)',
            wrists: 'Wrists (Bracers)',
            fingers: 'Fingers (Rings)',
            waist: 'Waist (Belt, Girdle)',
        };

        // Max attuned items (3 by default, can be increased by features)
        this.MAX_ATTUNEMENT_SLOTS = 3;

        // D&D 5e carrying capacity constants (PHB p.176)
        // Capacity = Strength × CARRY_CAPACITY_MULTIPLIER
        this.CARRY_CAPACITY_MULTIPLIER = 15;
        // Light encumbrance threshold = Strength × LIGHT_ENCUMBRANCE_MULTIPLIER
        this.LIGHT_ENCUMBRANCE_MULTIPLIER = 5;
        // Heavy encumbrance threshold = Strength × HEAVY_ENCUMBRANCE_MULTIPLIER
        this.HEAVY_ENCUMBRANCE_MULTIPLIER = 10;
    }

    /**
     * Generate a unique instance ID for an item in inventory.
     * @returns {string} Unique ID
     * @private
     */
    _generateItemInstanceId() {
        return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add an item to character's inventory.
     * @param {Object} character - Character object
     * @param {Object} itemData - Item data from ItemService
     * @param {number} quantity - Number of items to add
     * @param {string} source - Source of the item (e.g., "Starting Equipment", "Manual", "Equipment Pack")
     * @returns {Object} Added item instance
     */
    addItem(character, itemData, quantity = 1, source = 'Manual') {
        if (!character.inventory) {
            console.warn('[EquipmentService]', 'Character missing inventory');
            return null;
        }

        if (!itemData || !itemData.name) {
            console.warn('[EquipmentService]', 'Invalid item data');
            return null;
        }

        try {
            const itemInstance = {
                id: this._generateItemInstanceId(),
                name: itemData.name,
                baseItemId: itemData.id || itemData.name,
                quantity: Math.max(1, quantity),
                equipped: false,
                attuned: false,
                cost: itemData.cost ? { ...itemData.cost } : null,
                weight: itemData.weight || 0,
                source: itemData.source || 'Unknown',
                metadata: {
                    addedAt: new Date().toISOString(),
                    addedFrom: source,
                },
            };

            character.inventory.items.push(itemInstance);
            this._updateInventoryWeight(character);

            console.info('[EquipmentService]', 'Item added', {
                itemName: itemInstance.name,
                quantity: itemInstance.quantity,
            });

            eventBus.emit(EVENTS.ITEM_ADDED, character, itemInstance);
            return itemInstance;
        } catch (error) {
            console.error('[EquipmentService]', 'Failed to add item', error);
            return null;
        }
    }

    /**
     * Remove an item from character's inventory.
     * @param {Object} character - Character object
     * @param {string} itemInstanceId - Instance ID of item to remove
     * @param {number} quantity - Number of items to remove
     * @returns {boolean} True if successful
     */
    removeItem(character, itemInstanceId, quantity = 1) {
        if (!character.inventory) return false;

        const itemIndex = character.inventory.items.findIndex(
            (item) => item.id === itemInstanceId,
        );

        if (itemIndex === -1) {
            console.warn('[EquipmentService]', 'Item not found', { itemInstanceId });
            return false;
        }

        const item = character.inventory.items[itemIndex];

        // If removing all quantity, delete the item entirely
        if (quantity >= item.quantity) {
            // Unequip if needed
            if (item.equipped) {
                this.unequipItem(character, itemInstanceId);
            }

            // Unatune if needed
            if (item.attuned) {
                this.unattueItem(character, itemInstanceId);
            }

            character.inventory.items.splice(itemIndex, 1);
        } else {
            // Reduce quantity
            item.quantity -= quantity;
        }

        this._updateInventoryWeight(character);

        console.info('[EquipmentService]', 'Item removed', {
            itemName: item.name,
            quantityRemoved: Math.min(quantity, item.quantity + quantity),
        });

        eventBus.emit(EVENTS.ITEM_REMOVED, character, item);
        return true;
    }

    /**
     * Equip an item to a specific slot.
     * @param {Object} character - Character object
     * @param {string} itemInstanceId - Instance ID of item
     * @param {string} slot - Slot to equip to (e.g., 'body', 'hands')
     * @returns {boolean} True if successful
     */
    equipItem(character, itemInstanceId, slot) {
        if (!character.inventory || !this.validSlots[slot]) {
            console.warn('[EquipmentService]', 'Invalid slot', { slot });
            return false;
        }

        const item = character.inventory.items.find(
            (i) => i.id === itemInstanceId,
        );

        if (!item) {
            console.warn('[EquipmentService]', 'Item not found', { itemInstanceId });
            return false;
        }

        // Check if slot can hold multiple items (array) or single item
        const isArraySlot = Array.isArray(character.inventory.equipped[slot]);

        // Unequip from old slot if single-item slot
        if (!isArraySlot && character.inventory.equipped[slot]) {
            this.unequipItem(character, character.inventory.equipped[slot]);
        }

        // Equip to new slot
        if (isArraySlot) {
            if (!character.inventory.equipped[slot].includes(itemInstanceId)) {
                character.inventory.equipped[slot].push(itemInstanceId);
            }
        } else {
            character.inventory.equipped[slot] = itemInstanceId;
        }

        item.equipped = true;

        console.info('[EquipmentService]', 'Item equipped', {
            itemName: item.name,
            slot,
        });

        eventBus.emit(EVENTS.ITEM_EQUIPPED, character, item, slot);
        return true;
    }

    /**
     * Unequip an item from its slot.
     * @param {Object} character - Character object
     * @param {string} itemInstanceId - Instance ID of item
     * @returns {boolean} True if successful
     */
    unequipItem(character, itemInstanceId) {
        if (!character.inventory) return false;

        let slot = null;
        let found = false;

        // Search all slots for the item
        for (const [slotName, slotContent] of Object.entries(
            character.inventory.equipped,
        )) {
            if (Array.isArray(slotContent)) {
                const index = slotContent.indexOf(itemInstanceId);
                if (index !== -1) {
                    slotContent.splice(index, 1);
                    slot = slotName;
                    found = true;
                    break;
                }
            } else if (slotContent === itemInstanceId) {
                character.inventory.equipped[slotName] = null;
                slot = slotName;
                found = true;
                break;
            }
        }

        if (found) {
            const item = character.inventory.items.find(
                (i) => i.id === itemInstanceId,
            );
            if (item) {
                item.equipped = false;

                console.info('[EquipmentService]', 'Item unequipped', {
                    itemName: item.name,
                    slot,
                });

                eventBus.emit(EVENTS.ITEM_UNEQUIPPED, character, item, slot);
            }
            return true;
        }

        console.warn('[EquipmentService]', 'Item not found in equipped slots', {
            itemInstanceId,
        });
        return false;
    }

    /**
     * Attune an item.
     * @param {Object} character - Character object
     * @param {string} itemInstanceId - Instance ID of item
     * @returns {boolean} True if successful
     */
    attuneItem(character, itemInstanceId) {
        if (!character.inventory) return false;

        const item = character.inventory.items.find(
            (i) => i.id === itemInstanceId,
        );

        if (!item) {
            console.warn('[EquipmentService]', 'Item not found', { itemInstanceId });
            return false;
        }

        // Check attunement slots
        if (!this.canAttune(character)) {
            console.warn('[EquipmentService]', 'No attunement slots available');
            return false;
        }

        if (!character.inventory.attuned.includes(itemInstanceId)) {
            character.inventory.attuned.push(itemInstanceId);
        }

        item.attuned = true;

        console.info('[EquipmentService]', 'Item attuned', {
            itemName: item.name,
            attunedCount: character.inventory.attuned.length,
        });

        eventBus.emit(EVENTS.ITEM_ATTUNED, character, item);
        return true;
    }

    /**
     * Unattune an item.
     * @param {Object} character - Character object
     * @param {string} itemInstanceId - Instance ID of item
     * @returns {boolean} True if successful
     */
    unattueItem(character, itemInstanceId) {
        if (!character.inventory) return false;

        const index = character.inventory.attuned.indexOf(itemInstanceId);

        if (index === -1) {
            console.warn('[EquipmentService]', 'Item not attuned', { itemInstanceId });
            return false;
        }

        character.inventory.attuned.splice(index, 1);

        const item = character.inventory.items.find(
            (i) => i.id === itemInstanceId,
        );

        if (item) {
            item.attuned = false;

            console.info('[EquipmentService]', 'Item unattuned', {
                itemName: item.name,
                attunedCount: character.inventory.attuned.length,
            });

            eventBus.emit(EVENTS.ITEM_UNATTUNED, character, item);
        }

        return true;
    }

    /**
     * Check if character can attune more items.
     * @param {Object} character - Character object
     * @returns {boolean} True if character has attunement slots available
     */
    canAttune(character) {
        if (!character.inventory) return false;
        const attunedCount = character.inventory.attuned.length;
        return attunedCount < this.MAX_ATTUNEMENT_SLOTS;
    }

    /**
     * Get remaining attunement slots.
     * @param {Object} character - Character object
     * @returns {number} Number of available slots
     */
    getRemainingAttunementSlots(character) {
        if (!character.inventory) return 0;
        return this.MAX_ATTUNEMENT_SLOTS - character.inventory.attuned.length;
    }

    /**
     * Calculate total weight of inventory.
     * @param {Object} character - Character object
     * @returns {number} Total weight in pounds
     */
    calculateTotalWeight(character) {
        if (!character.inventory) return 0;

        return character.inventory.items.reduce((total, item) => {
            return total + (item.weight * item.quantity);
        }, 0);
    }

    /**
     * Check if character has a feature that modifies carry capacity.
     * Examples: Powerful Build (races/features that double carry capacity)
     * @param {Object} character - Character object
     * @returns {number} Multiplier for carry capacity (1.0 = normal, 2.0 = double, etc.)
     * @private
     */
    _getCarryCapacityModifier(character) {
        // Check for Powerful Build feature or trait
        // This would need to be extended if more features modify carry capacity
        if (character.traits?.includes('Powerful Build')) {
            return 2;
        }

        // Check race/class features for capacity modifiers
        // (Would be populated from feature data if available)
        if (character.race?.traits?.includes('Powerful Build')) {
            return 2;
        }

        return 1; // Default: no modifier
    }

    /**
     * Calculate character's carry capacity.
     * Based on D&D 5e rules (PHB p.176): Capacity = Strength × 15 lbs
     * Supports feature modifiers (e.g., Powerful Build doubles capacity)
     * @param {Object} character - Character object
     * @returns {number} Carry capacity in pounds
     */
    calculateCarryCapacity(character) {
        const strength = character.abilityScores?.strength || 10;
        const baseCapacity = strength * this.CARRY_CAPACITY_MULTIPLIER;
        const modifier = this._getCarryCapacityModifier(character);
        return Math.floor(baseCapacity * modifier);
    }

    /**
     * Check if character is overencumbered.
     * Based on D&D 5e rules (PHB p.176):
     * - Lightly Encumbered at 5 × STR (speed reduced by 10 ft)
     * - Heavily Encumbered at 10 × STR (speed reduced by 20 ft, disadvantage on attacks/ability checks)
     * @param {Object} character - Character object
     * @returns {Object} { encumbered: boolean, heavilyEncumbered: boolean, total: number, capacity: number }
     */
    checkEncumbrance(character) {
        const total = this.calculateTotalWeight(character);
        const capacity = this.calculateCarryCapacity(character);
        const strength = character.abilityScores?.strength || 10;
        const lightEncumbrance = strength * this.LIGHT_ENCUMBRANCE_MULTIPLIER;
        const heavyEncumbrance = strength * this.HEAVY_ENCUMBRANCE_MULTIPLIER;

        return {
            total,
            capacity,
            encumbered: total > lightEncumbrance && total <= heavyEncumbrance,
            heavilyEncumbered: total > heavyEncumbrance,
        };
    }

    /**
     * Update inventory weight calculations.
     * @param {Object} character - Character object
     * @private
     */
    _updateInventoryWeight(character) {
        if (!character.inventory) return;

        character.inventory.weight.current = this.calculateTotalWeight(character);
        character.inventory.weight.capacity = this.calculateCarryCapacity(character);

        const encumbrance = this.checkEncumbrance(character);
        if (encumbrance.encumbered || encumbrance.heavilyEncumbered) {
            eventBus.emit(EVENTS.ENCUMBRANCE_CHANGED, character, encumbrance);
        }
    }

    /**
     * Get all items in inventory.
     * @param {Object} character - Character object
     * @returns {Array} Array of items
     */
    getInventoryItems(character) {
        return character.inventory?.items || [];
    }

    /**
     * Get equipped items for a specific slot (or all if no slot specified).
     * @param {Object} character - Character object
     * @param {string} slot - Optional slot name
     * @returns {Array} Array of equipped item instances or IDs
     */
    getEquippedItems(character, slot = null) {
        if (!character.inventory) return [];

        if (slot) {
            const equipped = character.inventory.equipped[slot];
            if (!equipped) return [];
            return Array.isArray(equipped) ? equipped : [equipped];
        }

        // Return all equipped items
        const allEquipped = [];
        for (const slotContent of Object.values(character.inventory.equipped)) {
            if (slotContent) {
                if (Array.isArray(slotContent)) {
                    allEquipped.push(...slotContent);
                } else {
                    allEquipped.push(slotContent);
                }
            }
        }
        return allEquipped;
    }

    /**
     * Get attuned items.
     * @param {Object} character - Character object
     * @returns {Array} Array of attuned item instances
     */
    getAttunedItems(character) {
        if (!character.inventory) return [];

        return character.inventory.items.filter((item) =>
            character.inventory.attuned.includes(item.id),
        );
    }

    /**
     * Find an item by instance ID.
     * @param {Object} character - Character object
     * @param {string} itemInstanceId - Item instance ID
     * @returns {Object|null} Item instance or null
     */
    findItemById(character, itemInstanceId) {
        return character.inventory?.items.find(
            (item) => item.id === itemInstanceId,
        ) || null;
    }
}

// Export singleton
export const equipmentService = new EquipmentService();
