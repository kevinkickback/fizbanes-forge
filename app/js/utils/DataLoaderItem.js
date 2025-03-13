/**
 * DataLoaderItem.js
 * Handles loading and processing of all items, including equipment, weapons, armor, 
 * and magic items
 * 
 * @typedef {Object} ItemValue
 * @property {number} amount - The numerical value
 * @property {('cp'|'sp'|'ep'|'gp'|'pp')} coin - The coin type
 * 
 * @typedef {Object} ContainerCapacity
 * @property {('weight'|'volume')} type - The type of capacity
 * @property {number} amount - The capacity amount
 * @property {number} weightMultiplier - Weight multiplier for contents
 * 
 * @typedef {Object} DamageData
 * @property {number} diceCount - Number of dice
 * @property {number} diceValue - Dice value (d4, d6, etc)
 * @property {string} type - Damage type
 * @property {number} bonus - Damage bonus
 * 
 * @typedef {Object} RangeData
 * @property {number} normal - Normal range in feet
 * @property {number|null} long - Long range in feet
 * 
 * @typedef {Object} ArmorClass
 * @property {number} base - Base AC value
 * @property {boolean} dexBonus - Whether DEX bonus applies
 * @property {number|null} maxDexBonus - Maximum DEX bonus
 * @property {number} bonus - AC bonus
 * 
 * @typedef {Object} FluffData
 * @property {Array<Object>} entries - Descriptive entries
 * @property {Array<Object>} images - Associated images
 * 
 * @typedef {Object} ProcessedItem
 * @property {string} id - Unique identifier
 * @property {string} name - Item name
 * @property {string} source - Source book
 * @property {string} type - Item type
 * @property {string} rarity - Item rarity
 * @property {number} weight - Item weight
 * @property {ItemValue} value - Item value
 * @property {Array<Object>} entries - Description entries
 * @property {number} quantity - Item quantity
 * @property {Set<string>} properties - Item properties
 * @property {FluffData|null} fluff - Fluff data
 * 
 * @typedef {ProcessedItem} ProcessedWeapon
 * @property {string} weaponCategory - Weapon category
 * @property {DamageData} damage - Weapon damage
 * @property {string} damageType - Type of damage
 * @property {RangeData|null} range - Weapon range
 * @property {string|null} ammunition - Required ammunition
 * @property {Array<string>} special - Special properties
 * @property {DamageData|null} versatile - Versatile damage
 * @property {boolean} thrown - Is throwable
 * @property {number|null} reload - Reload time
 * @property {boolean} proficiencyRequired - Requires proficiency
 * 
 * @typedef {ProcessedItem} ProcessedArmor
 * @property {('light'|'medium'|'heavy'|'shield')} armorCategory - Armor category
 * @property {boolean} isShield - Is a shield
 * @property {ArmorClass} ac - Armor class data
 * @property {number|null} strength - Required strength
 * @property {boolean|null} stealth - Affects stealth
 * @property {boolean} proficiencyRequired - Requires proficiency
 * @property {boolean} dexBonus - Allows DEX bonus
 * @property {number|null} maxDexBonus - Maximum DEX bonus
 */

import { DataLoader } from './DataLoader.new.js';

/**
 * DataLoaderItem.js
 * Handles loading and processing of all items, including equipment, weapons, armor, 
 * and magic items
 */
export class DataLoaderItem extends DataLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 300,
            defaultExpiry: options.defaultExpiry || 3600000
        });
        this.dataFiles = {
            base: 'items-base.json',
            items: 'items.json',
            magicVariants: 'magicvariants.json',
            fluff: 'fluff-items.json'
        };

        // Source-specific flags for handling different editions
        this.sourceFlags = {
            XPHB: { isNewEdition: true },
            XDMG: { isNewEdition: true },
            PHB: { isClassic: true },
            DMG: { isClassic: true }
        };

        // Item type mappings for different sources
        this.typeMap = {
            // Classic types (PHB)
            'A': 'armor',
            'HA': 'armor',
            'MA': 'armor',
            'LA': 'armor',
            'S': 'armor',
            'W': 'weapon',
            'G': 'gear',
            'AT': 'artisan tool',
            'INS': 'instrument',
            'GS': 'gaming set',
            'P': 'potion',
            'SC': 'scroll',
            'WD': 'wand',
            'RD': 'rod',
            'RG': 'ring',
            'R': 'ring',
            'ST': 'staff',
            'M': 'mount',
            'V': 'vehicle',
            'T': 'tool',
            // New edition types (XPHB)
            'G|XPHB': 'gear',
            'A|XPHB': 'armor',
            'W|XPHB': 'weapon',
            'AT|XPHB': 'artisan tool',
            'INS|XPHB': 'instrument'
        };
    }

    /**
     * Load all item data with improved caching and chunking
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<{
     *   items: Array<ProcessedItem>,
     *   weapons: Array<ProcessedWeapon>,
     *   armor: Array<ProcessedArmor>,
     *   magicItems: Array<ProcessedItem>,
     *   baseItems: Array<ProcessedItem>,
     *   variants: Array<ProcessedItem>
     * }>} Processed item data
     */
    async loadItems(options = {}) {
        return this.getOrLoadData('items', async () => {
            try {
                console.log('Loading item data...');
                // Load all item data in parallel
                const [baseData, itemData, magicVariantData, fluffData] = await Promise.all([
                    this.loadJsonFile(this.dataFiles.base, {
                        ...options,
                        maxRetries: 3
                    }),
                    this.loadJsonFile(this.dataFiles.items, {
                        ...options,
                        maxRetries: 3
                    }),
                    this.loadJsonFile(this.dataFiles.magicVariants, {
                        ...options,
                        maxRetries: 3
                    }),
                    this.loadJsonFile(this.dataFiles.fluff, {
                        ...options,
                        maxRetries: 2
                    }).catch(() => ({ itemFluff: [] }))
                ]);

                console.log(`Loaded base items: ${baseData?.baseitem?.length || 0}, items: ${itemData?.item?.length || 0}, variants: ${magicVariantData?.magicvariant?.length || 0}`);

                const processed = this.processItemData(baseData, itemData, magicVariantData, fluffData);
                console.log(`Processed ${processed.items.length} items, ${processed.weapons.length} weapons, ${processed.armor.length} armor, ${processed.magicItems.length} magic items`);
                return processed;
            } catch (error) {
                console.error('Error loading items:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load items in chunks for better performance with large datasets
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @yields {Promise<Array<ProcessedItem>>} Generator yielding chunks of item data
     */
    async *loadItemsInChunks(chunkSize = 20, options = {}) {
        const data = await this.loadItems(options);

        // Yield basic items in chunks
        if (data.items && Array.isArray(data.items)) {
            for (let i = 0; i < data.items.length; i += chunkSize) {
                yield data.items.slice(i, i + chunkSize);
            }
        }

        // Yield weapons in chunks
        if (data.weapons && Array.isArray(data.weapons)) {
            for (let i = 0; i < data.weapons.length; i += chunkSize) {
                yield data.weapons.slice(i, i + chunkSize);
            }
        }

        // Yield armor in chunks
        if (data.armor && Array.isArray(data.armor)) {
            for (let i = 0; i < data.armor.length; i += chunkSize) {
                yield data.armor.slice(i, i + chunkSize);
            }
        }

        // Yield magic items in chunks
        if (data.magicItems && Array.isArray(data.magicItems)) {
            for (let i = 0; i < data.magicItems.length; i += chunkSize) {
                yield data.magicItems.slice(i, i + chunkSize);
            }
        }
    }

    /**
     * Process all item data
     * @param {Object} baseData - Base item data
     * @param {Object} itemData - Item data
     * @param {Object} magicVariantData - Magic variant data
     * @param {Object} fluffData - Item fluff data
     * @returns {Promise<{
     *   items: Array<ProcessedItem>,
     *   weapons: Array<ProcessedWeapon>,
     *   armor: Array<ProcessedArmor>,
     *   magicItems: Array<ProcessedItem>,
     *   baseItems: Array<ProcessedItem>,
     *   variants: Array<ProcessedItem>
     * }>} Processed item data
     */
    processItemData(baseData, itemData, magicVariantData, fluffData) {
        try {
            console.log('Processing item data...');
            const baseItems = new Map();
            const items = [];
            const weapons = [];
            const armor = [];
            const magicItems = [];

            // Get allowed sources
            const allowedSources = this.getAllowedSources();
            console.log(`Filtering items for sources: ${Array.from(allowedSources).join(', ')}`);

            // Process base items first
            if (baseData?.baseitem) {
                for (const baseItem of baseData.baseitem) {
                    try {
                        // Skip items from non-allowed sources
                        if (!allowedSources.has(baseItem.source)) {
                            continue;
                        }

                        const processedBase = this.processBasicItem(baseItem, fluffData);
                        if (processedBase) {
                            baseItems.set(processedBase.name.toLowerCase(), processedBase);
                        }
                    } catch (error) {
                        console.warn(`Error processing base item ${baseItem.name}:`, error);
                    }
                }
            }

            // Process magic variants
            const variants = new Map();
            if (magicVariantData?.magicvariant) {
                for (const variant of magicVariantData.magicvariant) {
                    try {
                        // Skip variants from non-allowed sources
                        if (!allowedSources.has(variant.source)) {
                            continue;
                        }

                        const processedVariant = this.processMagicVariant(variant);
                        if (processedVariant) {
                            variants.set(processedVariant.name.toLowerCase(), processedVariant);
                        }
                    } catch (error) {
                        console.warn(`Error processing magic variant ${variant.name}:`, error);
                    }
                }
            }

            // Process fluff data
            const fluffMap = new Map();
            if (fluffData?.itemFluff) {
                for (const fluff of fluffData.itemFluff) {
                    if (fluff.name && allowedSources.has(fluff.source)) {
                        fluffMap.set(fluff.name.toLowerCase(), fluff);
                    }
                }
            }

            // Process main items
            if (itemData?.item) {
                for (const item of itemData.item) {
                    try {
                        // Skip items that are clearly invalid
                        if (!item.name || typeof item.name !== 'string') {
                            console.warn('Skipping item with invalid name:', item);
                            continue;
                        }

                        // Skip items from non-allowed sources
                        if (!allowedSources.has(item.source)) {
                            continue;
                        }

                        // Handle source-specific processing based on flags
                        const sourceFlag = this.sourceFlags[item.source];
                        if (sourceFlag) {
                            // For new edition items, ensure we're using the correct type mapping
                            if (sourceFlag.isNewEdition && item.type) {
                                const newEditionType = `${item.type}|${item.source}`;
                                if (this.typeMap[newEditionType]) {
                                    item.type = newEditionType;
                                }
                            }
                        }

                        const processedItem = this.processBasicItem(item, fluffData);
                        if (!processedItem) continue;

                        // Add fluff data if available
                        const fluff = fluffMap.get(processedItem.name.toLowerCase());
                        if (fluff) {
                            processedItem.fluff = fluff;
                        }

                        // Add to appropriate categories based on determined type
                        const itemType = this.determineItemType(item);

                        // Add to general items list
                        items.push(processedItem);

                        // Categorize based on type
                        switch (itemType) {
                            case 'weapon':
                                weapons.push(processedItem);
                                break;
                            case 'armor':
                            case 'shield':
                                armor.push(processedItem);
                                break;
                        }

                        // Process as magic item if it has rarity or requires attunement
                        if (processedItem.rarity !== 'none' || processedItem.attunement) {
                            magicItems.push(processedItem);
                        }

                        // Apply magic variants if applicable
                        if (processedItem.baseItem) {
                            const baseItemName = processedItem.baseItem.toLowerCase();
                            const baseItem = baseItems.get(baseItemName);
                            if (baseItem) {
                                Object.assign(processedItem, {
                                    ...baseItem,
                                    ...processedItem
                                });
                            }
                        }
                    } catch (error) {
                        console.warn(`Error processing item ${item.name}:`, error);
                    }
                }
            }

            // Process base items into their categories as well
            for (const baseItem of baseItems.values()) {
                const itemType = this.determineItemType(baseItem);
                switch (itemType) {
                    case 'weapon':
                        if (!weapons.some(w => w.name === baseItem.name)) {
                            weapons.push(baseItem);
                        }
                        break;
                    case 'armor':
                    case 'shield':
                        if (!armor.some(a => a.name === baseItem.name)) {
                            armor.push(baseItem);
                        }
                        break;
                }
            }

            console.log('Item processing complete');
            return {
                items,
                weapons,
                armor,
                magicItems,
                baseItems: Array.from(baseItems.values()),
                variants: Array.from(variants.values())
            };
        } catch (error) {
            console.error('Error in processItemData:', error);
            throw error;
        }
    }

    /**
     * Process a basic item into standardized format
     * @param {Object} item - Raw item data
     * @param {Object} fluffData - Optional fluff data
     * @returns {ProcessedItem|null} Processed item data or null if invalid
     */
    processBasicItem(item, fluffData) {
        try {
            if (!item || !item.name) return null;

            const type = this.determineItemType(item);
            const fluff = this.processFluff(item.name, item.source, fluffData);

            // Process basic item properties first
            const processed = {
                name: item.name,
                source: item.source || 'PHB',
                page: item.page || 0,
                type: type, // Set the determined type
                rarity: item.rarity || 'none',
                weight: item.weight || 0,
                value: this.parseValue(item.value),
                entries: item.entries || [],
                properties: new Set(item.property || []),
                fluff: fluff
            };

            // Use specialized processors for specific types
            if (type === 'weapon') {
                return {
                    ...this.processWeapon(item),  // Remove fluffData parameter
                    type: type, // Ensure type is preserved
                    fluff: fluff // Ensure fluff is preserved
                };
            }
            if (type === 'armor' || type === 'shield') {
                return {
                    ...this.processArmor(item),  // Remove fluffData parameter
                    type: type, // Ensure type is preserved
                    fluff: fluff // Ensure fluff is preserved
                };
            }

            // Handle attunement
            if (item.reqAttune) {
                processed.attunement = typeof item.reqAttune === 'boolean' ? true : item.reqAttune;
            }

            // Process magic item properties
            if (item.tier || item.rarity !== 'none' || item.reqAttune) {
                Object.assign(processed, {
                    tier: item.tier || null,
                    charges: item.charges || null,
                    recharge: item.recharge || null
                });
            }

            // Process individual items if this is gear
            if (type === 'gear' && item.entries) {
                processed.containedItems = this.processContainedItems(item.entries, item);
            }

            return processed;
        } catch (error) {
            console.warn(`Error processing item ${item?.name}:`, error);
            return null;
        }
    }

    /**
     * Process individual items contained within an item's entries
     * @private
     * @param {Array} entries - The entries array from an item
     * @param {Object} item - The full item object
     * @returns {Array} Array of contained items with their quantities
     */
    processContainedItems(entries, item) {
        if (!entries || !Array.isArray(entries)) return [];

        const items = [];

        // First check for explicit packContents (old PHB structure)
        if (item.packContents && Array.isArray(item.packContents)) {
            for (const content of item.packContents) {
                if (typeof content === 'string') {
                    // Handle simple string entries like "backpack|phb"
                    const [name, source] = content.split('|');
                    items.push({
                        name: name,
                        source: source || 'PHB',
                        quantity: 1
                    });
                } else if (content.item) {
                    // Handle object entries with explicit item and quantity
                    const [name, source] = content.item.split('|');
                    items.push({
                        name: name,
                        source: source || 'PHB',
                        quantity: content.quantity || 1
                    });
                } else if (content.special) {
                    // Handle special entries (like "10 feet of string")
                    items.push({
                        name: content.special,
                        source: 'PHB',
                        quantity: 1,
                        special: true
                    });
                }
            }
            return items;
        }

        // Process entries for both old and new formats
        for (const entry of entries) {
            if (typeof entry === 'string') {
                // Try to extract item references from strings like "{@item itemname|source}"
                const itemMatches = entry.match(/{@item ([^}]+)}/g);
                if (itemMatches) {
                    for (const match of itemMatches) {
                        const itemParts = match.match(/{@item ([^|}]+)\|?([^}]*)}/);
                        if (itemParts) {
                            items.push({
                                name: itemParts[1],
                                source: itemParts[2] || 'PHB',
                                quantity: 1
                            });
                        }
                    }
                }
            } else if (entry.type === 'list' && Array.isArray(entry.items)) {
                // Process list items
                for (const listItem of entry.items) {
                    if (typeof listItem === 'string') {
                        // Try to extract item references and quantities
                        const itemMatch = listItem.match(/{@item ([^}]+)}/);
                        const quantityMatch = listItem.match(/(\d+)\s+/);

                        if (itemMatch) {
                            const itemParts = itemMatch[1].split('|');
                            items.push({
                                name: itemParts[0],
                                source: itemParts[1] || 'PHB',
                                quantity: quantityMatch ? Number.parseInt(quantityMatch[1], 10) : 1
                            });
                        }
                    }
                }
            }
        }

        return items;
    }

    /**
     * Determine the type of an item based on its properties
     * @param {Object} item - Raw item data
     * @returns {string} Item type
     */
    determineItemType(item) {
        if (!item?.type) return 'unknown';

        // Check explicit type first
        const [baseType, source] = item.type.toUpperCase().split('|');
        const typeKey = source ? `${baseType}|${source}` : baseType;

        // Check type map first
        if (this.typeMap[typeKey]) {
            return this.typeMap[typeKey];
        }

        // Core types fallback - order matters here
        switch (baseType) {
            case 'W':
            case 'M':
            case 'R':
                return 'weapon';
            case 'LA':
            case 'MA':
            case 'HA':
            case 'S':
            case 'A':
                return 'armor';
            case 'RG':
                return 'ring';
            case 'P':
                return 'potion';
            case 'G':
                return 'gear';
            case 'SC':
                return 'scroll';
            case 'WD':
                return 'wand';
            default:
                return 'item';
        }
    }

    /**
     * Parse item value to standardized format
     * @param {string|number|Object} value - Raw value
     * @returns {ItemValue} Parsed value
     */
    parseValue(value) {
        if (!value) return { amount: 0, coin: 'cp' };
        if (typeof value === 'number') return { amount: value, coin: 'cp' };
        if (typeof value === 'object') return { amount: value.amount || 0, coin: value.coin || 'cp' };

        try {
            const match = String(value).match(/(\d+)\s*([cgsp]p)/i);
            if (!match) return { amount: 0, coin: 'cp' };

            const [, amount, unit] = match;
            return {
                amount: Number.parseInt(amount),
                coin: unit.toLowerCase()
            };
        } catch (error) {
            console.warn('Error parsing item value:', error);
            return { amount: 0, coin: 'cp' };
        }
    }

    /**
     * Process weapon data
     * @private
     * @param {Object} weapon - Raw weapon data
     * @returns {ProcessedWeapon} Processed weapon data
     */
    processWeapon(weapon) {  // Remove fluffData parameter
        const itemId = weapon.id || weapon.name?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'unknown';

        return {
            id: itemId.toLowerCase(),
            name: weapon.name || 'Unknown Item',
            source: weapon.source || 'PHB',
            type: 'weapon',
            rarity: weapon.rarity || 'common',
            weight: weapon.weight || 0,
            value: this.parseValue(weapon.value),
            entries: weapon.entries || [],
            quantity: weapon.quantity || 1,
            properties: weapon.properties || [],
            requirements: weapon.requirements || null,
            weaponCategory: weapon.weaponCategory || 'simple',
            damage: this.processDamage(weapon.dmg1),
            damageType: weapon.dmgType || 'piercing',
            range: this.processRange(weapon.range),
            ammunition: weapon.ammo || null,
            special: weapon.special || [],
            versatile: this.processDamage(weapon.dmg2),
            thrown: weapon.property?.includes('thrown') || false,
            reload: weapon.reload || null,
            proficiencyRequired: weapon.proficiencyRequired || true
        };
    }

    /**
     * Process armor data
     * @private
     * @param {Object} armor - Raw armor data
     * @returns {ProcessedArmor} Processed armor data
     */
    processArmor(armor) {  // Remove fluffData parameter
        // Generate an ID if one is not provided
        const itemId = armor.id || armor.name?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'unknown';

        // Check if it's a shield first based on name or type
        const isShield = armor.type?.toUpperCase() === 'S' ||
            armor.name?.toLowerCase().includes('shield');

        // Get armor category using the dedicated method
        const armorCategory = this.determineArmorCategory(armor) || (isShield ? 'shield' : 'light');

        return {
            id: itemId.toLowerCase(),
            name: armor.name || 'Unknown Item',
            source: armor.source || 'PHB',
            type: 'armor',
            rarity: armor.rarity || 'common',
            weight: armor.weight || 0,
            value: this.processValue(armor.value),
            entries: armor.entries || [],
            quantity: armor.quantity || 1,
            containerCapacity: this.processContainerCapacity(armor.containerCapacity),
            properties: armor.properties || [],
            requirements: armor.requirements || null,
            armorCategory,
            isShield,
            ac: this.processArmorClass(armor.ac),
            strength: armor.strength || null,
            stealth: armor.stealth || null,
            proficiencyRequired: armor.proficiencyRequired || true,
            dexBonus: armor.dexBonus ?? true,
            maxDexBonus: armor.maxDexBonus || null
        };
    }

    /**
     * Determine armor category based on item properties
     * @private
     * @param {Object} armor - Raw armor data
     * @returns {('light'|'medium'|'heavy'|'shield'|null)} Armor category
     */
    determineArmorCategory(armor) {
        if (!armor) return null;

        // First check explicit type
        const type = armor.type?.toUpperCase();
        switch (type) {
            case 'HA': return 'heavy';
            case 'MA': return 'medium';
            case 'LA': return 'light';
            case 'S': return 'shield';
            case 'A': {
                // For generic armor type, try to determine from other properties
                if (armor.heavyArmor) return 'heavy';
                if (armor.mediumArmor) return 'medium';
                if (armor.lightArmor) return 'light';
                // Try to determine from AC and other characteristics
                const ac = armor.ac?.base || armor.ac || 10;
                const str = armor.strength || 0;
                if (ac >= 14 && str >= 15) return 'heavy';
                if (ac >= 12 && str >= 13) return 'medium';
                return 'light';
            }
            default:
                return null;
        }
    }

    /**
     * Process item value
     * @private
     * @param {string|number|Object} value - Raw value
     * @returns {ItemValue} Processed value
     */
    processValue(value) {
        if (!value) return { amount: 0, coin: 'cp' };
        if (typeof value === 'number') return { amount: value, coin: 'cp' };
        if (typeof value === 'object') return { amount: value.amount || 0, coin: value.coin || 'cp' };

        try {
            const match = String(value).match(/(\d+)\s*([cgsp]p)/i);
            if (!match) return { amount: 0, coin: 'cp' };

            const [, amount, unit] = match;
            return {
                amount: Number.parseInt(amount),
                coin: unit.toLowerCase()
            };
        } catch (error) {
            console.warn('Error parsing item value:', error);
            return { amount: 0, coin: 'cp' };
        }
    }

    /**
     * Process container capacity
     * @private
     * @param {Object} capacity - Raw capacity data
     * @returns {ContainerCapacity|null} Processed capacity data
     */
    processContainerCapacity(capacity) {
        if (!capacity) return null;

        return {
            type: capacity.type || 'weight',
            amount: capacity.amount || 0,
            weightMultiplier: capacity.weightMultiplier || 1
        };
    }

    /**
     * Process weapon damage
     * @private
     * @param {Object} damage - Raw damage data
     * @returns {DamageData|null} Processed damage data
     */
    processDamage(damage) {
        if (!damage) return null;

        return {
            diceCount: damage.diceCount || 1,
            diceValue: damage.diceValue || 4,
            type: damage.type || 'piercing',
            bonus: damage.bonus || 0
        };
    }

    /**
     * Process weapon range
     * @private
     * @param {Object} range - Raw range data
     * @returns {RangeData|null} Processed range data
     */
    processRange(range) {
        if (!range) return null;

        return {
            normal: range.normal || 5,
            long: range.long || null
        };
    }

    /**
     * Process armor class
     * @private
     * @param {number|Object} ac - Raw armor class data
     * @returns {ArmorClass} Processed armor class data
     */
    processArmorClass(ac) {
        if (!ac) return { base: 10 };
        if (typeof ac === 'number') return { base: ac };

        return {
            base: ac.base || 10,
            dexBonus: ac.dexBonus ?? true,
            maxDexBonus: ac.maxDexBonus || null,
            bonus: ac.bonus || 0
        };
    }

    /**
     * Process fluff data
     * @private
     * @param {string} name - Item name
     * @param {string} source - Item source
     * @param {Object} fluffData - Raw fluff data
     * @returns {FluffData|null} Processed fluff data
     */
    processFluff(name, source, fluffData) {
        if (!fluffData?.itemFluff || !Array.isArray(fluffData.itemFluff)) return null;

        const fluff = fluffData.itemFluff.find(f =>
            f.name === name &&
            f.source === source
        );

        if (!fluff) return null;

        return {
            entries: fluff.entries || [],
            images: fluff.images || []
        };
    }

    /**
     * Get item by ID with improved caching
     * @param {string} itemId - Item identifier
     * @param {Object} options - Loading options
     * @returns {Promise<ProcessedItem|null>} Item data or null if not found
     */
    async getItemById(itemId, options = {}) {
        const cacheKey = `item_${itemId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadItems();
            return data.items.find(item => item.id === itemId.toLowerCase()) ||
                data.weapons.find(item => item.id === itemId.toLowerCase()) ||
                data.armor.find(item => item.id === itemId.toLowerCase()) ||
                data.magicItems.find(item => item.id === itemId.toLowerCase()) ||
                null;
        }, options);
    }

    /**
     * Get items by type with improved caching
     * @param {string} type - Item type
     * @param {Object} options - Loading options
     * @returns {Promise<Array<ProcessedItem>>} Array of items of the specified type
     */
    async getItemsByType(type, options = {}) {
        const cacheKey = `items_type_${type}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadItems();
            const allItems = [
                ...data.items,
                ...data.weapons,
                ...data.armor,
                ...data.magicItems
            ];
            return allItems.filter(item =>
                item.type.toLowerCase() === type.toLowerCase()
            );
        }, options);
    }

    /**
     * Get items by value range with improved caching
     * @param {number} minValue - Minimum value in copper pieces
     * @param {number} maxValue - Maximum value in copper pieces
     * @param {Object} options - Loading options
     * @returns {Promise<Array<ProcessedItem>>} Array of items within the specified value range
     */
    async getItemsByValueRange(minValue, maxValue, options = {}) {
        const cacheKey = `items_value_${minValue}_${maxValue}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadItems();
            const allItems = [
                ...data.items,
                ...data.weapons,
                ...data.armor,
                ...data.magicItems
            ];
            return allItems.filter(item => {
                const value = this.convertToCopperPieces(item.value);
                return value >= minValue && value <= maxValue;
            });
        }, options);
    }

    /**
     * Convert item value to copper pieces
     * @private
     * @param {ItemValue} value - Item value object
     * @returns {number} Value in copper pieces
     */
    convertToCopperPieces(value) {
        const conversion = {
            'cp': 1,
            'sp': 10,
            'ep': 50,
            'gp': 100,
            'pp': 1000
        };

        return value.amount * (conversion[value.coin] || 1);
    }
} 