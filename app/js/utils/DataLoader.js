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
                            source: subSource || item.source,
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
                        type: item.type,
                        canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA',
                        attunement: item.reqAttune || false
                    };
                    allItems.push(processedItem);
                }
            }

            // Process items from items.json
            console.log('Processing items from items.json...');
            for (const item of (items.item || [])) {
                // Note: Pack processing is now handled by PackManager
                // See managers/PackManager.js
                const processedItem = {
                    ...item,
                    source: item.source || 'PHB',
                    id: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(item.source || 'phb').toLowerCase()}`,
                    type: item.type,
                    canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA',
                    attunement: item.reqAttune || false,
                    magical: item.rarity !== undefined && item.rarity !== 'none' && item.rarity !== 'unknown',
                    value: item.value || 0,
                    weight: item.weight || 0
                };
                allItems.push(processedItem);
            }

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

            // Note: Standard packs are now handled by PackService
            // See services/PackService.js for implementation

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

    async processRaceData(raceData, fluffData) {
        try {
            const processedRaces = [];
            const playerSources = ['PHB', 'VGM', 'MTF', 'TCE', 'MPMM', 'VRGR', 'ERLW', 'SCAG', 'XPHB']; // Added XPHB

            // Process each race
            for (const race of (raceData.race || [])) {
                // Skip NPC races
                if (race.traitTags?.includes('NPC Race')) continue;

                // Skip races not from player sourcebooks
                if (!playerSources.includes(race.source?.toUpperCase())) continue;

                // Create base race object
                const processedRace = {
                    id: `${race.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(race.source || 'phb').toLowerCase()}`,
                    name: race.name,
                    source: race.source || 'PHB',
                    size: race.size || ['M'],
                    speed: race.speed || { walk: 30 },
                    ability: race.ability || [],
                    entries: race.entries || [],
                    languageProficiencies: race.languageProficiencies || [],
                    darkvision: race.darkvision || 0,
                    resist: race.resist || [],
                    subraces: []
                };

                // Add fluff data if available
                const fluff = fluffData.raceFluff?.find(f =>
                    f.name === race.name &&
                    f.source === race.source
                );
                if (fluff) {
                    processedRace.fluff = fluff;
                }

                // Process traditional subraces if they exist
                if (race.subraces) {
                    for (const subrace of race.subraces) {
                        if (subrace.traitTags?.includes('NPC Race')) continue;
                        if (!playerSources.includes(subrace.source?.toUpperCase())) continue;

                        processedRace.subraces.push(this.processSubrace(subrace, processedRace));
                    }
                }

                // Process _versions (alternative format for subraces/variants)
                if (race._versions) {
                    for (const version of race._versions) {
                        if (version.traitTags?.includes('NPC Race')) continue;
                        if (!playerSources.includes(version.source?.toUpperCase())) continue;

                        // Create subrace from version
                        const subraceData = {
                            id: `${version.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(version.source || race.source || 'phb').toLowerCase()}`,
                            name: version.name.replace(/^[^;]+;\s*/, ''), // Remove parent race name if present
                            source: version.source || race.source || 'PHB',
                            ability: version.ability || [],
                            entries: [],
                            parentRace: processedRace.id,
                            darkvision: version.darkvision || race.darkvision || 0,
                            additionalSpells: version.additionalSpells || []
                        };

                        // Handle _mod entries if they exist
                        if (version._mod?.entries) {
                            if (version._mod.entries.mode === 'replaceArr') {
                                subraceData.entries = [version._mod.entries.items];
                            } else {
                                subraceData.entries = version._mod.entries;
                            }
                        }

                        processedRace.subraces.push(subraceData);
                    }
                }

                // Process lineages if they exist (some races use this format)
                if (race.lineages) {
                    for (const lineage of race.lineages) {
                        if (lineage.traitTags?.includes('NPC Race')) continue;
                        if (!playerSources.includes(lineage.source?.toUpperCase())) continue;

                        const subraceData = {
                            id: `${lineage.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(lineage.source || race.source || 'phb').toLowerCase()}`,
                            name: lineage.name,
                            source: lineage.source || race.source || 'PHB',
                            ability: lineage.ability || [],
                            entries: lineage.entries || [],
                            parentRace: processedRace.id,
                            darkvision: lineage.darkvision || race.darkvision || 0,
                            additionalSpells: lineage.additionalSpells || []
                        };

                        processedRace.subraces.push(subraceData);
                    }
                }

                processedRaces.push(processedRace);
            }

            // Sort races alphabetically
            processedRaces.sort((a, b) => a.name.localeCompare(b.name));

            console.log('Processed races:', processedRaces);
            return processedRaces;
        } catch (error) {
            console.error('Error processing race data:', error);
            throw error;
        }
    }

    // Helper method to process a subrace
    processSubrace(subraceData, parentRace) {
        return {
            id: `${subraceData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(subraceData.source || parentRace.source || 'phb').toLowerCase()}`,
            name: subraceData.name,
            source: subraceData.source || parentRace.source || 'PHB',
            ability: subraceData.ability || [],
            entries: subraceData.entries || [],
            parentRace: parentRace.id,
            darkvision: subraceData.darkvision || parentRace.darkvision || 0,
            additionalSpells: subraceData.additionalSpells || []
        };
    }

    async loadClasses() {
        if (this.dataCache.has('classes')) {
            return this.dataCache.get('classes');
        }

        try {
            // First load the index
            const index = await this.loadJsonFile('class/index.json');
            console.log('Loaded class index:', index);

            // Load each class file
            const classPromises = Object.entries(index).map(async ([className, fileName]) => {
                const classData = await this.loadJsonFile(`class/${fileName}`);
                const fluffData = await this.loadJsonFile(`class/fluff-${fileName}`).catch(() => ({}));

                // Extract the first class from the file and its subclasses
                const classObj = classData.class[0];
                const classId = `${classObj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${classObj.source || 'phb'}`;

                const subclasses = (classData.subclass || []).map(sc => ({
                    ...sc,
                    source: sc.source || 'PHB',
                    classSource: classObj.source || 'PHB',
                    id: `${sc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${sc.source || 'phb'}`,
                    classId: classId
                }));

                // Add fluff data if available
                const xphbFluff = fluffData.classFluff?.find(f => f.source === 'XPHB' && f.name === classObj.name);
                const phbFluff = fluffData.classFluff?.find(f => f.source === 'PHB' && f.name === classObj.name);
                const fluff = xphbFluff || phbFluff;

                // Create both PHB and XPHB versions if XPHB fluff exists
                const classes = [];

                // Add original PHB version
                classes.push({
                    id: classId,
                    name: classObj.name,
                    source: classObj.source || 'PHB',
                    ...classObj,
                    fluff: phbFluff || {},
                    entries: classObj.entries || [],
                    subclasses
                });

                // Add XPHB version if it has fluff
                if (xphbFluff) {
                    classes.push({
                        id: `${classObj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-xphb`,
                        name: classObj.name,
                        source: 'XPHB',
                        ...classObj,
                        fluff: xphbFluff,
                        entries: classObj.entries || [],
                        subclasses
                    });
                }

                return classes;
            });

            // Wait for all class data to load and flatten the array
            const classes = (await Promise.all(classPromises)).flat();
            console.log('Loaded all class data:', classes);

            // Cache and return the classes
            this.dataCache.set('classes', classes);
            return classes;
        } catch (error) {
            console.error('Error loading classes:', error);
            throw error;
        }
    }

    /**
     * Load a specific class by ID
     * @param {string} classId - The ID of the class to load
     * @returns {Promise<Object|null>} The class data or null if not found
     */
    async loadClass(classId) {
        try {
            const classes = await this.loadClasses();
            return classes.find(cls => cls.id === classId) || null;
        } catch (error) {
            console.error('Error loading specific class:', error);
            throw error;
        }
    }

    /**
     * Load a specific subclass by class ID and subclass ID
     * @param {string} classId - The ID of the parent class
     * @param {string} subclassId - The ID of the subclass to load
     * @returns {Promise<Object|null>} The subclass data or null if not found
     */
    async loadSubclass(classId, subclassId) {
        try {
            const parentClass = await this.loadClass(classId);
            if (!parentClass || !parentClass.subclasses) return null;
            return parentClass.subclasses.find(sc => sc.id === subclassId) || null;
        } catch (error) {
            console.error('Error loading specific subclass:', error);
            throw error;
        }
    }

    async loadFeats() {
        if (this.dataCache.has('feats')) {
            return this.dataCache.get('feats');
        }

        // Use FeatManager instead of FeatService
        const featManager = new FeatManager(window.currentCharacter);
        const feats = await featManager.loadFeats();
        this.dataCache.set('feats', feats);
        return feats;
    }

    async loadOptionalFeatures() {
        if (this.dataCache.has('optionalFeatures')) {
            return this.dataCache.get('optionalFeatures');
        }

        // Use FeatManager instead of FeatService
        const featManager = new FeatManager(window.currentCharacter);
        const features = await featManager.loadOptionalFeatures();
        this.dataCache.set('optionalFeatures', features);
        return features;
    }

    async loadSpells() {
        if (this.dataCache.has('spells')) {
            return this.dataCache.get('spells');
        }

        try {
            // First load the index
            const index = await this.loadJsonFile('spells/index.json');
            console.log('Loaded spells index:', index);

            // Load PHB spells (core spells)
            const phbSpellsResponse = await this.loadJsonFile(`spells/${index.PHB}`);
            const spells = phbSpellsResponse.spell.map(spell => ({
                ...spell,
                id: `${spell.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(spell.source || 'phb').toLowerCase()}`,
                source: spell.source || 'PHB',
                description: Array.isArray(spell.entries) ? spell.entries.join('\n') : spell.entries?.[0] || '',
                time: spell.time || [{ number: 1, unit: 'action' }],
                range: spell.range || { type: 'point', distance: { type: 'self' } },
                components: spell.components || {},
                duration: spell.duration || [{ type: 'instant' }],
                classes: spell.classes?.fromClassList?.map(c => c.name) || []
            }));

            // Cache and return
            this.dataCache.set('spells', spells);
            return spells;
        } catch (error) {
            console.error('Error loading spells:', error);
            throw error;
        }
    }

    async loadConditions() {
        if (this.dataCache.has('conditions')) {
            return this.dataCache.get('conditions');
        }

        try {
            const data = await this.loadJsonFile('conditionsdiseases.json');
            const conditions = data.condition.map(condition => ({
                ...condition,
                id: `${condition.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(condition.source || 'phb').toLowerCase()}`,
                source: condition.source || 'PHB'
            }));

            this.dataCache.set('conditions', conditions);
            return conditions;
        } catch (error) {
            console.error('Error loading conditions:', error);
            throw error;
        }
    }

    async loadActions() {
        if (this.dataCache.has('actions')) {
            return this.dataCache.get('actions');
        }

        try {
            const data = await this.loadJsonFile('actions.json');
            const actions = data.action.map(action => ({
                ...action,
                id: `${action.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(action.source || 'phb').toLowerCase()}`,
                source: action.source || 'PHB'
            }));

            this.dataCache.set('actions', actions);
            return actions;
        } catch (error) {
            console.error('Error loading actions:', error);
            throw error;
        }
    }

    async loadObjects() {
        if (this.dataCache.has('objects')) {
            return this.dataCache.get('objects');
        }

        try {
            const data = await this.loadJsonFile('objects.json');
            const objects = data.object.map(object => ({
                ...object,
                id: `${object.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(object.source || 'phb').toLowerCase()}`,
                source: object.source || 'PHB'
            }));

            this.dataCache.set('objects', objects);
            return objects;
        } catch (error) {
            console.error('Error loading objects:', error);
            throw error;
        }
    }

    async loadVariantRules() {
        if (this.dataCache.has('variantRules')) {
            return this.dataCache.get('variantRules');
        }

        try {
            const data = await this.loadJsonFile('variantrules.json');
            const rules = data.variantrule.map(rule => ({
                ...rule,
                id: `${rule.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(rule.source || 'phb').toLowerCase()}`,
                source: rule.source || 'PHB'
            }));

            this.dataCache.set('variantRules', rules);
            return rules;
        } catch (error) {
            console.error('Error loading variant rules:', error);
            throw error;
        }
    }

    clearCache() {
        this.dataCache.clear();
    }

    // Initialize the DataLoader and make it available globally
    static initialize() {
        if (!window.DataLoader) {
            window.DataLoader = DataLoader;
        }
        if (!window.dndDataLoader) {
            window.dndDataLoader = new DataLoader();
        }
        return window.dndDataLoader;
    }
}

// Initialize DataLoader when the module is loaded
DataLoader.initialize(); 