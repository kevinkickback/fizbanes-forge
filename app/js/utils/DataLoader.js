import { SourceManager } from '../managers/SourceManager.js';

/**
 * DataLoader.js
 * Core data loading functionality for the D&D Character Creator
 */

export class DataLoader {
    constructor() {
        this.dataCache = new Map();
        this.sourceManager = new SourceManager();
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

        try {
            const [raceData, fluffData] = await Promise.all([
                this.loadJsonFile('races.json'),
                this.loadJsonFile('fluff-races.json').catch(() => ({ raceFluff: [] }))
            ]);

            // Get allowed sources from current character or use defaults
            const allowedSources = window.currentCharacter?.getAllowedSources() ||
                new Set(['PHB', 'DMG', 'MM']);

            // Check if at least one PHB version is selected
            const hasPHB14 = allowedSources.has('PHB');
            const hasPHB24 = allowedSources.has('XPHB');

            if (!hasPHB14 && !hasPHB24) {
                console.error('At least one PHB version (PHB\'14 or PHB\'24) must be selected');
                window.showNotification('Please enable either PHB\'14 or PHB\'24 in source selection', 'warning');
                // Return only PHB races as a fallback
                raceData.race = raceData.race.filter(race =>
                    !race._abstract &&
                    (race.source === 'PHB' || race.source === 'XPHB')
                );
            } else {
                // Filter races by allowed sources before processing
                raceData.race = raceData.race.filter(race =>
                    !race._abstract && // Skip abstract races
                    allowedSources.has(race.source || 'PHB')
                );
            }

            const races = this.processRaceData(raceData, fluffData);

            // Further filter subraces by allowed sources
            for (const race of races) {
                if (race.subraces) {
                    race.subraces = race.subraces.filter(subrace =>
                        allowedSources.has(subrace.source || race.source || 'PHB')
                    );
                }
            }

            this.dataCache.set('races', races);
            return races;
        } catch (error) {
            console.error('Error loading races:', error);
            throw error;
        }
    }

    processRaceData(raceData, fluffData) {
        const processedRaces = [];

        for (const race of (raceData.race || [])) {
            // Skip abstract races
            if (race._abstract) continue;

            // Process base race
            const processedRace = this.createBaseRace(race, fluffData);

            // Process subraces, versions, and lineages
            const subraces = [];

            // Handle regular subraces
            if (race.subraces) {
                for (const subrace of race.subraces) {
                    if (!subrace._abstract) {  // Skip abstract subraces
                        const processed = this.processSubrace(subrace, processedRace);
                        if (processed) subraces.push(processed);
                    }
                }
            }

            // Handle versions
            if (race._versions) {
                for (const version of race._versions) {
                    if (!version._abstract) {  // Skip abstract versions
                        const processed = this.processSubrace(version, processedRace);
                        if (processed) subraces.push(processed);
                    }
                }
            }

            // Handle lineages
            if (race.lineages) {
                for (const lineage of race.lineages) {
                    if (!lineage._abstract) {  // Skip abstract lineages
                        const processed = this.processSubrace(lineage, processedRace);
                        if (processed) subraces.push(processed);
                    }
                }
            }

            processedRace.subraces = subraces;
            processedRaces.push(processedRace);
        }

        return processedRaces.sort((a, b) => a.name.localeCompare(b.name));
    }

    createBaseRace(race, fluffData) {
        const baseRace = {
            id: `${race.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(race.source || 'phb').toLowerCase()}`,
            name: race.name,
            source: race.source || 'PHB',
            size: Array.isArray(race.size) ? race.size : [race.size || 'M'],
            speed: typeof race.speed === 'number' ? { walk: race.speed } : race.speed,
            ability: race.ability || [],
            languages: race.languageProficiencies || [],
            resistances: [...(race.resist || []), ...(race.features?.resistances || [])],
            features: race.features || {},
            proficiencies: race.proficiencies || {},
            spells: race.additionalSpells || [],
            entries: race.entries || [],
            subraces: []
        };

        // Add fluff data if available
        const fluff = fluffData.raceFluff?.find(f =>
            f.name === race.name && f.source === race.source
        );
        if (fluff) {
            baseRace.fluff = fluff;
            if (fluff.images?.length > 0) {
                baseRace.imageUrl = fluff.images[0].href?.default;
            }
        }

        return baseRace;
    }

    processSubrace(subraceData, parentRace) {
        // Skip if no data or if it's an abstract implementation
        if (!subraceData || subraceData._abstract || !subraceData.name) {
            return null;
        }

        // Handle implementation references
        if (subraceData._implementations) {
            return null;  // Skip implementation definitions
        }

        const subrace = {
            id: `${subraceData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(subraceData.source || parentRace.source || 'phb').toLowerCase()}`,
            name: subraceData.name.replace(/^[^;]+;\s*/, ''),
            source: subraceData.source || parentRace.source || 'PHB',
            parentRace: parentRace.id,
            ability: subraceData.ability || [],
            features: subraceData.features || {},
            spells: subraceData.additionalSpells || [],
            entries: subraceData.entries || []
        };

        // Handle _mod entries if they exist (for _versions format)
        if (subraceData._mod?.entries) {
            if (subraceData._mod.entries.mode === 'replaceArr') {
                subrace.entries = subraceData._mod.entries.items;
            } else {
                subrace.entries = subraceData._mod.entries;
            }
        }

        return subrace;
    }

    async loadClasses() {
        if (this.dataCache.has('classes')) {
            return this.dataCache.get('classes');
        }

        try {
            const index = await this.loadJsonFile('class/index.json');
            const allowedSources = window.currentCharacter?.getAllowedSources() ||
                new Set(['PHB', 'DMG', 'MM']);

            const classPromises = Object.entries(index)
                .filter(([_, fileName]) => {
                    const source = fileName.split('.')[0].toUpperCase();
                    return allowedSources.has(source);
                })
                .map(async ([className, fileName]) => {
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

            const classes = (await Promise.all(classPromises)).flat();
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

    async loadBooks() {
        if (this.dataCache.has('books')) {
            return this.dataCache.get('books');
        }

        try {
            const data = await this.loadJsonFile('books.json');
            const books = data.book.map(book => ({
                ...book,
                id: book.id || `${book.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(book.source || 'phb').toLowerCase()}`,
                source: book.source || 'PHB'
            }));

            this.dataCache.set('books', books);
            return books;
        } catch (error) {
            console.error('Error loading books:', error);
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

            // Add event listener for character changes
            window.addEventListener('characterLoaded', () => {
                window.dndDataLoader.clearCache();
            });
        }
        return window.dndDataLoader;
    }

    // Remove this method as it's now handled by the clearCache method
    clearCacheOnSourceChange() {
        this.clearCache();
    }
}

// Initialize DataLoader when the module is loaded
DataLoader.initialize(); 