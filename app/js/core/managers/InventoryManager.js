export class InventoryManager {
    constructor(character, parent) {
        this.character = character;
        this.inventory = new Map();
        this.parent = parent; // Reference to parent EquipmentManager
    }

    /**
     * Add an item to the inventory
     * @param {string} itemId - The ID of the item to add
     * @param {number} quantity - The quantity to add
     * @returns {boolean} - Whether the item was successfully added
     */
    async addItem(itemId, quantity = 1) {
        try {
            // Load items if not already loaded
            const items = await this.parent.loadItems();
            if (!items || items.length === 0) {
                console.error('No items loaded');
                return false;
            }

            // Try to find the item in this order:
            // 1. Direct ID match
            // 2. Group ID match
            // 3. Name match (case-insensitive)
            let item = items.find(i => i.id.toLowerCase() === itemId.toLowerCase()) ||
                items.find(i => i.groupId?.toLowerCase() === itemId.toLowerCase()) ||
                items.find(i => i.name.toLowerCase() === itemId.toLowerCase());

            if (!item) {
                console.error(`Item not found: ${itemId}`);
                console.log('Available items:', items.map(i => ({
                    id: i.id,
                    groupId: i.groupId,
                    name: i.name,
                    type: i.type
                })));
                return false;
            }

            // For grouped items (like potions), prefer the latest version if available
            if (item.groupId) {
                const groupItems = items.filter(i => i.groupId === item.groupId);
                if (groupItems.length > 1) {
                    // Prefer XDMG/XPHB version over DMG/PHB version
                    const xVersion = groupItems.find(i => i.source.startsWith('X'));
                    if (xVersion) {
                        item = xVersion;
                    }
                }
            }

            // Update inventory
            const currentQuantity = this.inventory.get(item.id)?.quantity || 0;
            this.inventory.set(item.id, {
                item: item,
                quantity: currentQuantity + quantity
            });

            return true;
        } catch (error) {
            console.error('Error adding item:', error);
            return false;
        }
    }

    /**
     * Remove an item from the inventory
     * @param {string} itemId - The ID of the item to remove
     * @param {number} quantity - The quantity to remove
     * @returns {boolean} - Whether the item was successfully removed
     */
    removeItem(itemId, quantity = 1) {
        // Try direct ID first
        let inventoryItem = this.inventory.get(itemId);
        let actualItemId = itemId;

        // If not found, try to find by group ID
        if (!inventoryItem) {
            const [item] = Array.from(this.inventory.values())
                .filter(({ item }) => item.groupId?.toLowerCase() === itemId.toLowerCase());
            if (item) {
                inventoryItem = item;
                actualItemId = item.item.id;
            }
        }

        if (!inventoryItem || inventoryItem.quantity < quantity) {
            console.error(`Cannot remove ${quantity} of item ${itemId} - not enough in inventory`);
            return false;
        }

        if (inventoryItem.quantity === quantity) {
            this.inventory.delete(actualItemId);
        } else {
            this.inventory.set(actualItemId, {
                item: inventoryItem.item,
                quantity: inventoryItem.quantity - quantity
            });
        }

        return true;
    }

    /**
     * Get an item from the inventory
     * @param {string} itemId - The ID of the item to get
     * @returns {Object|null} - The item and its quantity, or null if not found
     */
    getItem(itemId) {
        // Try direct ID first
        let inventoryItem = this.inventory.get(itemId);

        // If not found, try to find by group ID
        if (!inventoryItem) {
            const [item] = Array.from(this.inventory.values())
                .filter(({ item }) => item.groupId?.toLowerCase() === itemId.toLowerCase());
            if (item) {
                inventoryItem = item;
            }
        }

        return inventoryItem || null;
    }

    /**
     * Check if an item is in the inventory
     * @param {string} itemId - The ID of the item to check
     * @returns {boolean} - Whether the item is in the inventory
     */
    hasItem(itemId) {
        return this.getItem(itemId) !== null;
    }

    /**
     * Get all items in the inventory
     * @returns {Array} - Array of items and their quantities
     */
    getAllItems() {
        return Array.from(this.inventory.values());
    }

    /**
     * Calculate the total weight of the inventory
     * @returns {number} - The total weight
     */
    getInventoryWeight() {
        return Array.from(this.inventory.values())
            .reduce((total, { item, quantity }) => total + (item.weight * quantity), 0);
    }

    clear() {
        this.inventory.clear();
    }

    async fromJSON(data) {
        this.clear();
        if (data?.inventory) {
            for (const itemData of data.inventory) {
                await this.addItem(itemData.id, itemData.quantity);
            }
        }
    }

    toJSON() {
        return {
            inventory: Array.from(this.inventory.entries()).map(([id, data]) => ({
                id,
                quantity: data.quantity
            }))
        };
    }
} 