/**
 * DataLoader.js
 * Core data loading functionality for the D&D Character Creator
 */

export class DataLoader {
    constructor() {
        this.dataCache = new Map();
    }

    async loadJsonFile(path) {
        try {
            // Remove data/ prefix if it exists in the path
            const response = await fetch(`data/${path}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error loading JSON file ${path}:`, error);
            throw error;
        }
    }

    async loadItems() {
        if (this.dataCache.has('items')) {
            return this.dataCache.get('items');
        }

        try {
            // Load base items, items, magic items, and fluff data
            const [baseItems, items, magicItems, fluffData] = await Promise.all([
                this.loadJsonFile('items-base.json'),
                this.loadJsonFile('items.json'),
                this.loadJsonFile('magicvariants.json'),
                this.loadJsonFile('fluff-items.json').catch(() => ({}))
            ]);

            // Process base items
            const allItems = [];

            // Process base items
            for (const item of (baseItems.baseitem || [])) {
                if (item.items) {
                    // Handle item groups (like Potions of Healing)
                    for (const subItemStr of item.items) {
                        // Split subitem into name and source if specified
                        const [name, subSource] = subItemStr.includes('|') ? subItemStr.split('|') : [subItemStr, item.source];
                        const processedItem = {
                            name: name.trim(),
                            source: subSource || item.source || 'PHB',
                            type: item.type,
                            rarity: item.rarity,
                            weight: item.weight,
                            parentName: item.name,
                            parentSource: item.source,
                            id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(subSource || item.source || 'phb').toLowerCase()}`,
                            canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA',
                            attunement: item.reqAttune || false
                        };
                        allItems.push(processedItem);
                    }
                } else {
                    // Handle regular items
                    const processedItem = {
                        ...item,
                        source: item.source || 'PHB',
                        id: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(item.source || 'phb').toLowerCase()}`,
                        canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA',
                        attunement: item.reqAttune || false
                    };
                    allItems.push(processedItem);
                }
            }

            // Process items from items.json
            console.log('Processing items from items.json...');
            for (const item of (items.item || [])) {
                // Check if this is a pack - look for packContents or entries that indicate a pack
                const isPack = item.packContents ||
                    (item.type === 'G' && item.entries?.some(e => e.type === 'list')) ||
                    item.containerCapacity;

                // Process pack contents if available
                let contents = [];
                if (isPack) {
                    console.log(`Processing pack: ${item.name}`);
                    if (item.packContents) {
                        console.log('Using packContents');
                        contents = item.packContents.map(content => {
                            if (typeof content === 'string') {
                                // Handle simple string format "itemname|source"
                                const [itemName] = content.split('|');
                                return {
                                    name: itemName,
                                    quantity: 1
                                };
                            }
                            // Handle object format { item: "itemname|source", quantity: X }
                            if (content.item) {
                                const [itemName] = content.item.split('|');
                                return {
                                    name: itemName,
                                    quantity: content.quantity || 1
                                };
                            }
                            return {
                                name: content.name || 'Unknown Item',
                                quantity: content.quantity || 1
                            };
                        });
                    } else if (item.entries) {
                        console.log('Using entries list');
                        // Try to extract contents from entries list
                        const listEntry = item.entries.find(e => e.type === 'list');
                        if (listEntry?.items) {
                            contents = listEntry.items.map(entry => {
                                // Handle reference format "{@item itemname|source}"
                                const match = entry.match(/{@item ([^|}]+)/);
                                const name = match ? match[1] : entry;
                                return {
                                    name,
                                    quantity: 1
                                };
                            });
                        }
                    }
                }

                const processedItem = {
                    ...item,
                    source: item.source || 'PHB',
                    id: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(item.source || 'phb').toLowerCase()}`,
                    type: isPack ? 'pack' : item.type,
                    canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA',
                    attunement: item.reqAttune || false,
                    magical: item.rarity !== undefined && item.rarity !== 'none' && item.rarity !== 'unknown',
                    contents: isPack ? contents : undefined,
                    value: item.value || 0,
                    weight: item.weight || 0
                };
                allItems.push(processedItem);
            }

            // Log summary of processed items
            const packs = allItems.filter(item => item.type === 'pack');
            console.log(`Processed ${allItems.length} total items, including ${packs.length} packs`);
            console.log('Found packs:', packs.map(p => p.name));

            // Process magic items
            console.log('Processing magic items...');
            for (const item of (magicItems.magicvariant || [])) {
                const processedItem = {
                    ...item,
                    source: item.source || 'DMG',  // Keep DMG as default for magic items
                    magical: true,
                    id: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(item.source || 'dmg').toLowerCase()}`,
                    canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA',
                    attunement: item.reqAttune || false
                };
                allItems.push(processedItem);

                // If this is a group of items, process each one
                if (item.items) {
                    for (const subItemStr of item.items) {
                        if (typeof subItemStr !== 'string') {
                            console.warn('Unexpected item format in magic variants:', subItemStr);
                            continue;
                        }
                        const [name, subSource] = subItemStr.includes('|') ? subItemStr.split('|') : [subItemStr, item.source];
                        const subItem = {
                            name: name.trim(),
                            source: subSource || item.source || 'DMG',  // Keep DMG as default for magic items
                            type: item.type,
                            rarity: item.rarity,
                            weight: item.weight,
                            magical: true,
                            parentName: item.name,
                            parentSource: item.source,
                            id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(subSource || item.source || 'dmg').toLowerCase()}`,
                            canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA',
                            attunement: item.reqAttune || false
                        };
                        allItems.push(subItem);
                    }
                }
            }

            // Add fluff data where available
            for (const item of allItems) {
                const fluff = fluffData.itemFluff?.find(f =>
                    f.name === (item.parentName || item.name) &&
                    f.source === (item.parentSource || item.source)
                );
                if (fluff) {
                    item.fluff = fluff;
                }
            }

            // Process standard packs if not already present
            const standardPacks = [
                {
                    name: "Explorer's Pack",
                    source: "PHB",
                    type: "pack",
                    id: "explorers-pack-phb",
                    contents: [
                        { name: "Backpack", quantity: 1 },
                        { name: "Bedroll", quantity: 1 },
                        { name: "Mess kit", quantity: 1 },
                        { name: "Tinderbox", quantity: 1 },
                        { name: "Torch", quantity: 10 },
                        { name: "Ration", quantity: 10 },
                        { name: "Waterskin", quantity: 1 },
                        { name: "Rope, hempen (50 feet)", quantity: 1 }
                    ]
                },
                {
                    name: "Dungeoneer's Pack",
                    source: "PHB",
                    type: "pack",
                    id: "dungeoneers-pack-phb",
                    contents: [
                        { name: "Backpack", quantity: 1 },
                        { name: "Crowbar", quantity: 1 },
                        { name: "Hammer", quantity: 1 },
                        { name: "Piton", quantity: 10 },
                        { name: "Torch", quantity: 10 },
                        { name: "Tinderbox", quantity: 1 },
                        { name: "Ration", quantity: 10 },
                        { name: "Waterskin", quantity: 1 },
                        { name: "Rope, hempen (50 feet)", quantity: 1 }
                    ]
                }
            ];

            // Add standard packs if they don't already exist
            for (const pack of standardPacks) {
                if (!allItems.some(item => item.id === pack.id)) {
                    allItems.push(pack);
                }
            }

            // Cache and return processed items
            this.dataCache.set('items', allItems);
            return allItems;
        } catch (error) {
            console.error('Error loading items:', error);
            throw error;
        }
    }

    async loadRaces() {
        if (this.dataCache.has('races')) {
            return this.dataCache.get('races');
        }

        const raceData = await this.loadJsonFile('races.json');
        const fluffData = await this.loadJsonFile('fluff-races.json').catch(() => ({}));

        // Process and cache races
        const races = await this.processRaceData(raceData, fluffData);
        this.dataCache.set('races', races);
        return races;
    }

    async loadClasses() {
        if (this.dataCache.has('classes')) {
            return this.dataCache.get('classes');
        }

        const classData = await this.loadJsonFile('classes.json');
        const fluffData = await this.loadJsonFile('fluff-classes.json').catch(() => ({}));

        // Process and cache classes
        const classes = await this.processClassData(classData, fluffData);
        this.dataCache.set('classes', classes);
        return classes;
    }

    async loadBackgrounds() {
        if (this.dataCache.has('backgrounds')) {
            return this.dataCache.get('backgrounds');
        }

        const backgroundData = await this.loadJsonFile('backgrounds.json');
        const fluffData = await this.loadJsonFile('fluff-backgrounds.json').catch(() => ({}));

        // Process and cache backgrounds
        const backgrounds = await this.processBackgroundData(backgroundData, fluffData);
        this.dataCache.set('backgrounds', backgrounds);
        return backgrounds;
    }

    clearCache() {
        this.dataCache.clear();
    }
} 