import { Item } from '../models/Item.js';
import { Weapon } from '../models/Weapon.js';
import { Armor } from '../models/Armor.js';

export class EquipmentService {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.cache = {
            items: null,
            magicItems: null,
            fluff: null
        };
    }

    async loadItems() {
        if (this.cache.items) return this.cache.items;

        try {
            // Load base items, items, magic items, and fluff data
            const [baseItems, items, magicItems, fluffData] = await Promise.all([
                this.dataLoader.loadJsonFile('items-base.json'),
                this.dataLoader.loadJsonFile('items.json'),
                this.dataLoader.loadJsonFile('magicvariants.json'),
                this.dataLoader.loadJsonFile('fluff-items.json').catch(() => ({}))
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

    async processItem(itemData, fluff = null) {
        // Add fluff data to item description if available
        if (fluff?.entries?.length) {
            itemData.description = await this.dataLoader.processText(fluff.entries[0]);
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

    async processMagicVariant(variant, fluff = null) {
        // Process magic item variants (e.g., +1 weapons, armor of resistance, etc.)
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

    async getItemById(id) {
        const items = await this.loadItems();
        return items.find(item => item.id === id) || null;
    }

    async getItemsByType(type) {
        const items = await this.loadItems();
        return items.filter(item => item.type === type);
    }

    async getWeapons() {
        return this.getItemsByType('weapon');
    }

    async getArmor() {
        return this.getItemsByType('armor');
    }

    async getMagicItems() {
        const items = await this.loadItems();
        return items.filter(item => item.rarity !== 'common' || item.attunement);
    }

    clearCache() {
        this.cache = {
            items: null,
            magicItems: null,
            fluff: null
        };
    }
} 