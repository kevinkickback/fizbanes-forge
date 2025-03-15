import { characterInitializer } from './Initialize.js';
import { FeatManager } from '../managers/FeatManager.js';

/**
 * DataLoader.js
 * Core data loading functionality for the D&D Character Creator
 */

export class DataLoader {
    constructor(electron) {
        this.electron = electron;
        this.sourceManager = null;
        this.itemManager = null;
        this.raceManager = null;
        this.classManager = null;
        this.backgroundManager = null;
        this.spellManager = null;
        this.featManager = null;
        this.deityManager = null;
        this.featureManager = null;
        this.dataCache = new Map();
    }

    // Initialize the data loader
    static async initialize(electron) {
        const loader = new DataLoader(electron);
        await loader.loadData();

        // Listen for character loaded event to clear cache
        document.addEventListener('characterLoaded', () => {
            loader.clearCache();
        });

        return loader;
    }

    // Clear cache
    clearCache() {
        this.itemManager = null;
        this.raceManager = null;
        this.classManager = null;
        this.backgroundManager = null;
        this.spellManager = null;
        this.featManager = null;
        this.deityManager = null;
        this.featureManager = null;
        this.dataCache.clear();
    }

    // Load all data
    async loadData() {
        try {
            // Load items data
            const itemsData = await this.electron.ipc.invoke('read-json-file', 'data/items.json');
            const magicItemsData = await this.electron.ipc.invoke('read-json-file', 'data/magic-items.json').catch(() => ({}));

            // Merge regular items and magic items
            const allItems = {
                ...itemsData,
                ...magicItemsData
            };

            // Initialize item manager
            this.itemManager = {
                items: allItems,
                getItem: (id) => allItems[id],
                getAllItems: () => Object.values(allItems),
                searchItems: (query) => {
                    const searchTerm = query.toLowerCase();
                    return Object.values(allItems).filter(item =>
                        item.name.toLowerCase().includes(searchTerm) ||
                        item.type.toLowerCase().includes(searchTerm)
                    );
                }
            };

            // Load races data
            const raceData = await this.electron.ipc.invoke('read-json-file', 'data/races.json');

            // Initialize race manager
            this.raceManager = {
                races: raceData,
                getRace: (id) => raceData[id],
                getAllRaces: () => Object.values(raceData),
                searchRaces: (query) => {
                    const searchTerm = query.toLowerCase();
                    return Object.values(raceData).filter(race =>
                        race.name.toLowerCase().includes(searchTerm)
                    );
                }
            };

            // Initialize source manager
            this.sourceManager = {
                sources: new Set(),
                addSource: (source) => this.sourceManager.sources.add(source),
                removeSource: (source) => this.sourceManager.sources.delete(source),
                hasSource: (source) => this.sourceManager.sources.has(source),
                getAllSources: () => Array.from(this.sourceManager.sources),
                setAllowedSources: (sources) => {
                    this.sourceManager.sources.clear();
                    for (const source of sources) {
                        this.sourceManager.sources.add(source);
                    }
                }
            };

            // Get allowed sources from character or use defaults
            const allowedSources = characterInitializer.currentCharacter?.getAllowedSources() ||
                new Set(['PHB', 'DMG', 'MM', 'XGE', 'TCE', 'SCAG']);

            // Set initial allowed sources
            this.sourceManager.setAllowedSources(allowedSources);

            // Initialize feat manager
            this.featManager = new FeatManager(characterInitializer.currentCharacter);

            // Load spells data
            const spellsData = await this.electron.ipc.invoke('read-json-file', 'data/spells.json');

            // Initialize spell manager
            this.spellManager = {
                spells: spellsData,
                getSpell: (id) => spellsData[id],
                getAllSpells: () => Object.values(spellsData),
                searchSpells: (query) => {
                    const searchTerm = query.toLowerCase();
                    return Object.values(spellsData).filter(spell =>
                        spell.name.toLowerCase().includes(searchTerm) ||
                        spell.school.toLowerCase().includes(searchTerm)
                    );
                }
            };

            return this;
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    // Get item manager
    getItemManager() {
        return this.itemManager;
    }

    // Get race manager
    getRaceManager() {
        return this.raceManager;
    }

    // Get source manager
    getSourceManager() {
        return this.sourceManager;
    }

    // Get spell manager
    getSpellManager() {
        return this.spellManager;
    }

    // Get feat manager
    getFeatManager() {
        return this.featManager;
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
            const itemsData = await this.electron.ipc.invoke('read-json-file', 'data/items.json');
            const magicItemsData = await this.electron.ipc.invoke('read-json-file', 'data/magic-items.json').catch(() => ({}));

            // Process regular items
            const processedItems = this.processItems(itemsData?.item || []);

            // Process magic items
            const processedMagicItems = this.processMagicItems(magicItemsData?.magicItem || []);

            // Cache and return processed items
            const allItems = [...processedItems, ...processedMagicItems];
            this.dataCache.set('items', allItems);
            return allItems;
        } catch (error) {
            console.warn('Error loading items:', error);
            return []; // Return empty array instead of throwing
        }
    }

    // Process regular items
    processItems(itemsData) {
        const processedItems = [];
        for (const item of itemsData) {
            // Process item data...
            processedItems.push(item);
        }
        return processedItems;
    }

    // Process magic items
    processMagicItems(magicItemsData) {
        const processedItems = [];
        for (const item of magicItemsData) {
            try {
                // Process magic item data...
                processedItems.push(item);
            } catch (err) {
                console.warn('Unexpected item format in magic variants:', item);
            }
        }
        return processedItems;
    }

    async loadRaces() {
        if (this.dataCache.has('races')) {
            return this.dataCache.get('races');
        }

        try {
            // Validate source selection
            if (!this.sourceManager.hasPhbSource()) {
                console.warn('At least one PHB version (PHB\'14 or PHB\'24) must be selected');
                return [];
            }

            const raceData = await this.electron.ipc.invoke('read-json-file', 'data/races.json');
            // Extract races array from the data structure and ensure it exists
            const races = raceData?.race || [];

            // Process each race to ensure consistent structure
            const processedRaces = races.map(race => ({
                ...race,
                id: `${race.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(race.source || 'phb').toLowerCase()}`,
                source: race.source || 'PHB'
            }));

            this.dataCache.set('races', processedRaces);
            return processedRaces;
        } catch (error) {
            console.warn('Error loading races:', error);
            return []; // Return empty array instead of throwing
        }
    }

    async loadClasses() {
        if (this.dataCache.has('classes')) {
            return this.dataCache.get('classes');
        }

        try {
            const index = await this.loadJsonFile('class/index.json');
            const allowedSources = characterInitializer.currentCharacter?.getAllowedSources() ||
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
        const featManager = new FeatManager(characterInitializer.currentCharacter);
        const feats = await featManager.loadFeats();
        this.dataCache.set('feats', feats);
        return feats;
    }

    async loadOptionalFeatures() {
        if (this.dataCache.has('optionalFeatures')) {
            return this.dataCache.get('optionalFeatures');
        }

        // Use FeatManager instead of FeatService
        const featManager = new FeatManager(characterInitializer.currentCharacter);
        const features = await featManager.loadOptionalFeatures();
        this.dataCache.set('optionalFeatures', features);
        return features;
    }

    async loadSpells() {
        if (this.dataCache.has('spells')) {
            return this.dataCache.get('spells');
        }

        try {
            const spellsData = await this.electron.ipc.invoke('read-json-file', 'data/spells.json')
                .catch(() => ({ spell: [] })); // Provide default empty structure if file not found

            // Extract spells array and ensure consistent structure
            const processedSpells = (spellsData?.spell || []).map(spell => ({
                ...spell,
                id: `${spell.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(spell.source || 'phb').toLowerCase()}`,
                source: spell.source || 'PHB'
            }));

            this.dataCache.set('spells', processedSpells);
            return processedSpells;
        } catch (error) {
            console.warn('Error loading spells:', error);
            return []; // Return empty array instead of throwing
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
} 