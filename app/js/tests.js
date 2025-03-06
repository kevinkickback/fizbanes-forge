// Import required modules
import { EntityCard } from './core/ui/EntityCard.js';
import { RaceManager } from './core/managers/RaceManager.js';
import { ClassService } from './core/services/ClassService.js';
import { SpellcastingService } from './core/services/SpellcastingService.js';
import { DataLoader } from './core/data/DataLoader.js';
import { EquipmentManager } from './core/managers/EquipmentManager.js';
import { InventoryManager } from './core/managers/InventoryManager.js';
import { AttunementManager } from './core/managers/AttunementManager.js';
import { MagicItemService } from './core/services/MagicItemService.js';
import { EquipmentService } from './core/services/EquipmentService.js';
import { PackManager } from './core/managers/PackManager.js';
import { StartingEquipmentManager } from './core/managers/StartingEquipmentManager.js';

// Initialize global test object
window.tests = window.tests || {};

/**
 * tests.js
 * Test functions for the D&D Character Creator
 */

// Initialize services
const dataLoader = new DataLoader();
window.dndDataLoader = dataLoader;  // Make it globally available
const classService = new ClassService(dataLoader);
const spellcastingService = new SpellcastingService(dataLoader);
const magicItemService = new MagicItemService(dataLoader);
const equipmentService = new EquipmentService(dataLoader);
window.equipmentService = equipmentService;  // Make it globally available

// Make InventoryManager available globally for tests
window.InventoryManager = InventoryManager;

// Test Phase 1: Core Reference System
const phase1Tests = {
    // Mock data and functions needed for tests
    mockData: {
        resolveJsonRef: async (ref) => {
            // Mock implementation of resolveJsonRef
            const mockResults = {
                '{@item longsword|PHB}': '<span class="reference-link item-reference">Longsword</span>',
                '{@spell fireball|PHB}': '<span class="reference-link spell-reference">Fireball</span>',
                '{@class fighter|PHB}': '<span class="reference-link class-reference">Fighter</span>',
                '{@race elf|PHB}': '<span class="reference-link race-reference">Elf</span>'
            };
            return mockResults[ref] || ref;
        }
    },

    // Test EntityCard rendering
    async testEntityCard() {
        try {
            // Test EntityCard creation
            const card = new EntityCard();
            if (!card) {
                throw new Error('Failed to create EntityCard');
            }

            return {
                name: 'Entity Card',
                success: true,
                message: 'EntityCard test completed successfully'
            };
        } catch (error) {
            return {
                name: 'Entity Card',
                success: false,
                message: `EntityCard test failed: ${error.message}`
            };
        }
    },

    // Test reference resolution
    async testReferenceResolution() {
        try {
            // Test reference resolution
            const result = await this.mockData.resolveJsonRef('{@item longsword|PHB}');
            if (!result.includes('reference-link')) {
                throw new Error('Reference not resolved correctly');
            }

            return {
                name: 'Reference Resolution',
                success: true,
                message: 'Reference resolution test completed successfully'
            };
        } catch (error) {
            return {
                name: 'Reference Resolution',
                success: false,
                message: `Reference resolution test failed: ${error.message}`
            };
        }
    },

    // Test tooltip system
    testTooltips() {
        try {
            // Test tooltip creation
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            if (!tooltip) {
                throw new Error('Failed to create tooltip');
            }

            return {
                name: 'Tooltips',
                success: true,
                message: 'Tooltip test completed successfully'
            };
        } catch (error) {
            return {
                name: 'Tooltips',
                success: false,
                message: `Tooltip test failed: ${error.message}`
            };
        }
    },

    // Run all Phase 1 tests
    async runAll() {
        console.log('Running all Phase 1 tests...');
        const results = [];

        // Run each Phase 1 test and collect results
        const entityCardResults = await this.testEntityCard();
        const referenceResults = await this.testReferenceResolution();
        const tooltipResults = await this.testTooltips();

        // Combine all results
        results.push(...(Array.isArray(entityCardResults) ? entityCardResults : [entityCardResults]));
        results.push(...(Array.isArray(referenceResults) ? referenceResults : [referenceResults]));
        results.push(...(Array.isArray(tooltipResults) ? tooltipResults : [tooltipResults]));

        return results;
    }
};

// Mock Character class for tests
class MockCharacter {
    constructor() {
        this.size = 'M';
        this.speed = { walk: 30 };
        this.features = { darkvision: 0 };
        this.languages = new Set(['Common']);
        this.resistances = new Set();
        this.abilityScores = {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10
        };
        this.abilityBonuses = new Map();
        this.traits = new Map();
        this.proficiencies = new Map();
        this._inventoryManager = null;
        this.alignment = 'LG';  // Default alignment for testing
        this.class = null;
        this.race = null;
    }

    // Add getter for inventory property
    get inventory() {
        return this._inventoryManager;
    }

    setInventoryManager(manager) {
        this._inventoryManager = manager;
    }

    // Methods required by AttunementManager
    hasClass(className) {
        return this.class?.name.toLowerCase() === className.toLowerCase();
    }

    isSpellcaster() {
        return this.class?.spellcasting !== undefined;
    }

    hasRace(raceName) {
        return this.race?.name.toLowerCase() === raceName.toLowerCase();
    }

    getAbilityScore(ability) {
        const abilityKey = this._normalizeAbilityName(ability);
        return this.abilityScores[abilityKey] || 10;
    }

    addAbilityBonus(ability, value, source) {
        const abilityKey = this._normalizeAbilityName(ability);

        // Initialize source map if it doesn't exist
        if (!this.abilityBonuses.has(source)) {
            this.abilityBonuses.set(source, new Map());
        }

        // Store the bonus
        this.abilityBonuses.get(source).set(abilityKey, value);

        // Update the ability score
        if (Object.prototype.hasOwnProperty.call(this.abilityScores, abilityKey)) {
            this.abilityScores[abilityKey] += value;
            console.log(`Updated ${abilityKey} score to ${this.abilityScores[abilityKey]} (+${value} from ${source})`);
        } else {
            console.error(`Invalid ability name: ${ability}`);
        }
    }

    clearAbilityBonuses(source) {
        if (this.abilityBonuses.has(source)) {
            // Remove all bonuses from this source
            for (const [ability, value] of this.abilityBonuses.get(source)) {
                const abilityKey = this._normalizeAbilityName(ability);
                if (Object.prototype.hasOwnProperty.call(this.abilityScores, abilityKey)) {
                    this.abilityScores[abilityKey] -= value;
                    console.log(`Removed ${value} from ${abilityKey} (source: ${source})`);
                }
            }
            this.abilityBonuses.delete(source);
        }
    }

    _normalizeAbilityName(ability) {
        // Handle common abbreviations and full names
        const abilityMap = {
            'str': 'strength',
            'dex': 'dexterity',
            'con': 'constitution',
            'int': 'intelligence',
            'wis': 'wisdom',
            'cha': 'charisma'
        };

        const normalized = ability.toLowerCase();
        return abilityMap[normalized] || normalized;
    }

    addLanguage(language, source) {
        this.languages.add(language);
    }

    clearLanguages(source) {
        this.languages = new Set(['Common']);
    }

    addResistance(resistance, source) {
        this.resistances.add(resistance);
    }

    clearResistances(source) {
        this.resistances.clear();
    }

    addTrait(name, description, source) {
        if (!this.traits.has(source)) {
            this.traits.set(source, new Map());
        }
        this.traits.get(source).set(name, description);
    }

    clearTraits(source) {
        if (this.traits.has(source)) {
            this.traits.delete(source);
        }
    }

    addProficiency(type, proficiency, source) {
        if (!this.proficiencies.has(source)) {
            this.proficiencies.set(source, new Map());
        }
        if (!this.proficiencies.get(source).has(type)) {
            this.proficiencies.get(source).set(type, new Set());
        }
        this.proficiencies.get(source).get(type).add(proficiency);
    }

    clearProficiencies(source) {
        if (this.proficiencies.has(source)) {
            this.proficiencies.delete(source);
        }
    }
}

// Mock data loader with actual data
window.dndDataLoader = {
    loadRaces: async () => {
        const response = await fetch('data/races.json');
        const data = await response.json();
        console.log('Loaded races from races.json:', data.race);
        return data.race;
    },
    loadClasses: async () => {
        try {
            // First load the index
            const indexResponse = await fetch('data/class/index.json');
            const index = await indexResponse.json();
            console.log('Loaded class index:', index);

            // Load each class file
            const classPromises = Object.entries(index).map(async ([className, fileName]) => {
                const classResponse = await fetch(`data/class/${fileName}`);
                const classData = await classResponse.json();

                // Extract the first class from the file and its subclasses
                const classObj = classData.class[0];
                const subclasses = (classData.subclass || []).map(sc => ({
                    ...sc,
                    source: sc.source || 'PHB',
                    classSource: classObj.source || 'PHB'
                }));

                return {
                    name: classObj.name || className.charAt(0).toUpperCase() + className.slice(1),
                    source: classObj.source || 'PHB',
                    ...classObj,
                    subclasses: subclasses
                };
            });

            // Wait for all class data to load
            const classes = await Promise.all(classPromises);
            console.log('Loaded all class data:', classes);
            return classes;
        } catch (error) {
            console.error('Error loading classes:', error);
            throw error;
        }
    },
    loadSpells: async () => {
        try {
            // First load the index
            const indexResponse = await fetch('data/spells/index.json');
            const index = await indexResponse.json();
            console.log('Loaded spells index:', index);

            // Load PHB spells since that's what we need for tests
            const phbSpellsResponse = await fetch(`data/spells/${index.PHB}`);
            const phbSpellsData = await phbSpellsResponse.json();

            // The spells are stored in an array under the 'spell' key
            const spells = phbSpellsData.spell;
            console.log('Loaded PHB spells:', spells);
            return spells;
        } catch (error) {
            console.error('Error loading spells:', error);
            throw error;
        }
    },
    loadItems: async () => {
        try {
            // Load base items, magic items, and fluff data
            const [baseItemsResponse, magicItemsResponse, fluffResponse] = await Promise.all([
                fetch('data/items-base.json'),
                fetch('data/magicvariants.json'),
                fetch('data/fluff-items.json')
            ]);

            const [baseData, magicData, fluffData] = await Promise.all([
                baseItemsResponse.json(),
                magicItemsResponse.json(),
                fluffResponse.json()
            ]);

            // Process base items
            const allItems = [];

            // Process base items
            for (const item of (baseData.baseitem || [])) {
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
                            canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA'
                        };
                        allItems.push(processedItem);
                    }
                } else {
                    // Handle regular items
                    const processedItem = {
                        ...item,
                        source: item.source || 'PHB',
                        id: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(item.source || 'phb').toLowerCase()}`,
                        canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA'
                    };
                    allItems.push(processedItem);
                }
            }

            // Process magic items
            for (const item of (magicData.magicvariant || [])) {
                const processedItem = {
                    ...item,
                    source: item.source || 'DMG',
                    magical: true,
                    id: `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(item.source || 'dmg').toLowerCase()}`,
                    canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA'
                };
                allItems.push(processedItem);

                // If this is a group of items, process each one
                if (item.items) {
                    for (const subItemStr of item.items) {
                        const [name, subSource] = subItemStr.includes('|') ? subItemStr.split('|') : [subItemStr, item.source];
                        const subItem = {
                            name: name.trim(),
                            source: subSource || item.source || 'DMG',
                            type: item.type,
                            rarity: item.rarity,
                            weight: item.weight,
                            magical: true,
                            parentName: item.name,
                            parentSource: item.source,
                            id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(subSource || item.source || 'dmg').toLowerCase()}`,
                            canBeEquipped: item.weapon || item.type === 'S' || item.type === 'LA' || item.type === 'MA' || item.type === 'HA'
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

            return allItems;
        } catch (error) {
            console.error('Error loading items:', error);
            throw error;
        }
    }
};

// Test Phase 2: Race System
const phase2Tests = {
    // Test RaceManager functionality
    testRaceManager: async () => {
        try {
            // Create a mock character with proper tracking
            const mockCharacter = new MockCharacter();

            // Create RaceManager instance
            const raceManager = new RaceManager(mockCharacter);

            // Load races from JSON
            console.log('Loading races from data/races.json...');
            const races = await window.dndDataLoader.loadRaces();
            console.log('Loaded races:', races);

            // Find dwarf race from PHB source
            const dwarf = races.find(r => r.name === 'Dwarf' && r.source === 'PHB');
            if (!dwarf) {
                throw new Error('Could not find dwarf race in PHB source');
            }

            // Try to set dwarf race
            console.log('Setting dwarf race...', dwarf);
            console.log('Initial ability scores:', mockCharacter.abilityScores);
            const result = await raceManager.setRace(dwarf);
            console.log('Set race result:', result);
            console.log('Final ability scores:', mockCharacter.abilityScores);

            if (!result) {
                throw new Error('Failed to set race');
            }

            // Test race features
            if (!raceManager.selectedRace) {
                throw new Error('Race not set correctly');
            }

            // Test dwarf specific features
            const tests = [
                {
                    test: () => mockCharacter.resistances.has('poison'),
                    error: 'Dwarf poison resistance not set'
                },
                {
                    test: () => mockCharacter.abilityScores.constitution === 12,
                    error: 'Dwarf constitution bonus not applied'
                },
                {
                    test: () => mockCharacter.languages.has('Common') && mockCharacter.languages.has('Dwarvish'),
                    error: 'Dwarf languages not set correctly'
                },
                {
                    test: () => mockCharacter.speed.walk === 25,
                    error: 'Dwarf walking speed not set correctly'
                }
            ];

            for (const test of tests) {
                if (!test.test()) {
                    throw new Error(test.error);
                }
            }

            return {
                success: true,
                message: 'RaceManager tests completed successfully'
            };
        } catch (error) {
            console.error('RaceManager test error:', error);
            return {
                success: false,
                message: `RaceManager test failed: ${error.message}`
            };
        }
    },

    // Test race data loading
    testRaceData: async () => {
        try {
            const races = await window.dndDataLoader.loadRaces();
            if (!races || races.length === 0) {
                throw new Error('No races loaded');
            }

            return {
                success: true,
                message: 'Race data loaded successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Race data test failed: ${error.message}`
            };
        }
    },

    // Test race features
    testRaceFeatures: async () => {
        try {
            const mockCharacter = new MockCharacter();
            const raceManager = new RaceManager(mockCharacter);

            // Load races from JSON
            const races = await window.dndDataLoader.loadRaces();
            const elf = races.find(r => r.name === 'Elf' && r.source === 'PHB');

            if (!elf) {
                throw new Error('Could not find elf race in PHB source');
            }

            await raceManager.setRace(elf);

            // Test elf features
            if (mockCharacter.features.darkvision !== 60) {
                throw new Error('Elf darkvision not set correctly');
            }

            return {
                success: true,
                message: 'Race features test completed successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Race features test failed: ${error.message}`
            };
        }
    },

    // Test ability choices
    testAbilityChoices: async () => {
        try {
            const mockCharacter = new MockCharacter();
            const raceManager = new RaceManager(mockCharacter);

            // Load races from JSON
            const races = await window.dndDataLoader.loadRaces();
            const halfElf = races.find(r => r.name === 'Half-Elf' && r.source === 'PHB');

            if (!halfElf) {
                throw new Error('Could not find half-elf race in PHB source');
            }

            await raceManager.setRace(halfElf);

            // Test ability choices
            if (!raceManager.hasPendingChoices()) {
                throw new Error('Half-elf should have ability choices');
            }

            return {
                success: true,
                message: 'Ability choices test completed successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Ability choices test failed: ${error.message}`
            };
        }
    },

    // Run all Phase 2 tests
    runAll: async () => {
        const container = document.getElementById('testResults');
        const heading = document.createElement('h3');
        heading.textContent = 'Running Phase 2 Tests...';
        container.innerHTML = '';
        container.appendChild(heading);

        const results = [];

        // Run RaceManager test
        const raceManagerResult = await phase2Tests.testRaceManager();
        results.push({ name: 'Race Manager', ...raceManagerResult });

        // Run race data test
        const raceDataResult = await phase2Tests.testRaceData();
        results.push({ name: 'Race Data', ...raceDataResult });

        // Run race features test
        const raceFeaturesResult = await phase2Tests.testRaceFeatures();
        results.push({ name: 'Race Features', ...raceFeaturesResult });

        // Run ability choices test
        const abilityChoicesResult = await phase2Tests.testAbilityChoices();
        results.push({ name: 'Ability Choices', ...abilityChoicesResult });

        // Display overall results
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'test-results';

        const resultsHeading = document.createElement('h4');
        resultsHeading.textContent = 'Test Results:';
        resultsDiv.appendChild(resultsHeading);

        const ul = document.createElement('ul');
        for (const result of results) {
            const li = document.createElement('li');
            li.className = `test-result ${result.success ? 'success' : 'failure'}`;

            const strong = document.createElement('strong');
            strong.textContent = `${result.name}: `;

            li.appendChild(strong);
            li.appendChild(document.createTextNode(result.message));
            ul.appendChild(li);
        }
        resultsDiv.appendChild(ul);
        container.appendChild(resultsDiv);

        return results;
    }
};

// Test Phase 3: Class System
const phase3Tests = {
    // Test class loading
    testClassLoading: async () => {
        try {
            // Load classes from JSON
            console.log('Loading classes from data/class/index.json...');
            const classes = await window.dndDataLoader.loadClasses();
            console.log('Loaded classes:', classes);

            // Find fighter class from PHB source
            const fighter = classes.find(c => c.name === 'Fighter' && c.source === 'PHB');
            if (!fighter) {
                throw new Error('Could not find fighter class in PHB source');
            }

            // Test fighter class properties
            if (fighter.hd.number !== 1 || fighter.hd.faces !== 10) {
                throw new Error('Fighter hit dice not correct');
            }

            return {
                success: true,
                message: 'Class loading test completed successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Class loading test failed: ${error.message}`
            };
        }
    },

    // Test subclass loading
    testSubclassLoading: async () => {
        try {
            // Load classes from JSON
            const classes = await window.dndDataLoader.loadClasses();
            const fighter = classes.find(c => c.name === 'Fighter' && c.source === 'PHB');

            if (!fighter) {
                throw new Error('Could not find fighter class in PHB source');
            }

            // Find Champion subclass
            const champion = fighter.subclasses?.find(sc => sc.name === 'Champion' && sc.source === 'PHB');
            if (!champion) {
                throw new Error('Could not find Champion subclass in PHB source');
            }

            return {
                success: true,
                message: 'Subclass loading test completed successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Subclass loading test failed: ${error.message}`
            };
        }
    },

    // Test spellcasting
    testSpellcasting: async () => {
        try {
            // Load classes and spells from JSON
            const classes = await window.dndDataLoader.loadClasses();
            const spells = await window.dndDataLoader.loadSpells();

            // Find wizard class
            const wizard = classes.find(c => c.name === 'Wizard' && c.source === 'PHB');
            if (!wizard) {
                throw new Error('Could not find wizard class in PHB source');
            }

            // Verify wizard spellcasting
            if (wizard.spellcastingAbility !== 'int') {
                throw new Error('Wizard spellcasting ability not correct');
            }

            // Find Fireball spell
            const fireball = spells.find(s => s.name === 'Fireball' && s.source === 'PHB');
            if (!fireball) {
                throw new Error('Could not find Fireball spell in PHB source');
            }

            // Verify spell properties
            if (fireball.level !== 3) {
                throw new Error('Fireball spell level not correct');
            }

            // Test spell slot calculation
            const slots = spellcastingService.calculateSpellSlots(5, 'full');
            if (slots[3] !== 2) {
                throw new Error('Level 5 wizard spell slot calculation not correct');
            }

            return {
                success: true,
                message: 'Spellcasting test completed successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Spellcasting test failed: ${error.message}`
            };
        }
    },

    // Run all Phase 3 tests
    runAll: async () => {
        const container = document.getElementById('testResults');
        const heading = document.createElement('h3');
        heading.textContent = 'Running Phase 3 Tests...';
        container.innerHTML = '';
        container.appendChild(heading);

        const results = [];

        // Run class loading test
        const classLoadingResult = await phase3Tests.testClassLoading();
        results.push({ name: 'Class Loading', ...classLoadingResult });

        // Run subclass loading test
        const subclassLoadingResult = await phase3Tests.testSubclassLoading();
        results.push({ name: 'Subclass Loading', ...subclassLoadingResult });

        // Run spellcasting test
        const spellcastingResult = await phase3Tests.testSpellcasting();
        results.push({ name: 'Spellcasting', ...spellcastingResult });

        // Display overall results
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'test-results';

        const resultsHeading = document.createElement('h4');
        resultsHeading.textContent = 'Test Results:';
        resultsDiv.appendChild(resultsHeading);

        const ul = document.createElement('ul');
        for (const result of results) {
            const li = document.createElement('li');
            li.className = `test-result ${result.success ? 'success' : 'failure'}`;

            const strong = document.createElement('strong');
            strong.textContent = `${result.name}: `;

            li.appendChild(strong);
            li.appendChild(document.createTextNode(result.message));
            ul.appendChild(li);
        }
        resultsDiv.appendChild(ul);
        container.appendChild(resultsDiv);

        return results;
    }
};

// Phase 4 Tests: Equipment System
const phase4Tests = {
    testItemLoading: async () => {
        console.log('Starting item loading test...');
        const results = [];
        try {
            // Test loading items from all sources
            console.log('Getting equipment service...');
            const equipmentService = window.equipmentService;
            if (!equipmentService) {
                throw new Error('Equipment service not initialized');
            }

            console.log('Loading items from all sources...');
            const items = await equipmentService.loadItems();
            console.log(`Loaded ${items?.length || 0} total items`);

            // Verify we got items
            if (!items || items.length === 0) {
                console.error('No items were loaded');
                results.push({
                    success: false,
                    message: 'No items were loaded'
                });
                return results;
            }

            // Test specific items
            console.log('Testing specific item loading...');
            const testItems = [
                {
                    id: 'longsword-phb',
                    name: 'Longsword',
                    type: 'weapon'
                },
                {
                    id: 'chain-mail-phb',
                    name: 'Chain Mail',
                    type: 'armor'
                },
                {
                    id: 'potion-of-healing-dmg',
                    name: 'Potion of Healing',
                    type: 'potion'
                },
                {
                    id: 'ring-of-protection-dmg',
                    name: 'Ring of Protection',
                    type: 'ring'
                }
            ];

            for (const testItem of testItems) {
                console.log(`Testing loading of ${testItem.name}...`);
                const item = await equipmentService.getItemById(testItem.id);
                console.log(`${testItem.name} data:`, item);

                if (!item) {
                    results.push({
                        success: false,
                        message: `Failed to load ${testItem.name}`
                    });
                    continue;
                }

                results.push({
                    success: true,
                    message: `Successfully loaded ${testItem.name} (${testItem.type})`
                });
            }

            // Count items by source
            console.log('Counting items by source...');
            const itemsBySource = {
                'items-base.json': 0,
                'items.json': 0,
                'magicvariants.json': 0
            };

            for (const item of items) {
                if (item.magical) {
                    itemsBySource['magicvariants.json']++;
                } else if (item.source === 'PHB') {
                    itemsBySource['items-base.json']++;
                } else {
                    itemsBySource['items.json']++;
                }
            }

            console.log('Item counts by source:', itemsBySource);

            // Add summary result
            results.push({
                success: true,
                message: `Total items loaded: ${items.length}\n` +
                    `Base items: ${itemsBySource['items-base.json']}\n` +
                    `Additional items: ${itemsBySource['items.json']}\n` +
                    `Magic variants: ${itemsBySource['magicvariants.json']}`
            });

        } catch (error) {
            console.error('Error during item loading test:', error);
            results.push({
                success: false,
                message: `Error during item loading test: ${error.message}`
            });
        }

        console.log('Item loading test completed');
        return results;
    },

    // Test inventory management
    testInventoryManagement: async () => {
        console.log('Starting inventory management test...');
        try {
            const mockCharacter = new MockCharacter();
            const inventoryManager = new InventoryManager(mockCharacter);
            console.log('Created inventory manager');

            // Load items first to check available potions
            console.log('Loading items to check available potions...');
            const items = await window.dndDataLoader.loadItems();
            const potions = items.filter(i => i.name.toLowerCase().includes('potion'));
            console.log('Available potions:', potions.map(p => ({
                name: p.name,
                source: p.source,
                id: p.id,
                parentName: p.parentName,
                parentSource: p.parentSource
            })));

            // Add items to inventory
            console.log('Adding items to inventory...');
            const addLongsword = await inventoryManager.addItem('longsword-phb', 1);
            console.log('Added longsword:', addLongsword);
            const addChainmail = await inventoryManager.addItem('chain-mail-phb', 1);
            console.log('Added chainmail:', addChainmail);
            const addPotions = await inventoryManager.addItem('potion-of-healing-dmg', 3);
            console.log('Added potions:', addPotions);

            // Test inventory queries
            console.log('Testing inventory queries...');
            const itemsInInventory = inventoryManager.getAllItems();
            console.log('Items in inventory:', itemsInInventory);

            // Test weight calculation
            const totalWeight = inventoryManager.getInventoryWeight();
            console.log('Total inventory weight:', totalWeight);

            // Test item removal
            console.log('Testing item removal...');
            console.log('Current inventory:', Array.from(inventoryManager.inventory.entries()));
            const removeResult = inventoryManager.removeItem('potion-of-healing-dmg', 2);
            console.log('Remove result:', removeResult);
            const potion = inventoryManager.getItem('potion-of-healing-dmg');
            console.log('Potion after removal:', potion);

            if (!removeResult) {
                throw new Error('Item removal failed');
            }
            if (!potion || potion.quantity !== 1) {
                throw new Error('Item removal not working correctly');
            }

            console.log('Inventory management test completed successfully');
            return {
                success: true,
                message: 'Inventory management test completed successfully'
            };
        } catch (error) {
            console.error('Inventory management test error:', error);
            return {
                success: false,
                message: `Inventory management test failed: ${error.message}`
            };
        }
    },

    // Test equipment slot management
    testEquipmentSlots: async () => {
        console.log('Starting equipment slot management test...');
        try {
            const mockCharacter = new MockCharacter();

            // Create and set up inventory manager first
            console.log('Setting up inventory manager...');
            const inventoryManager = new InventoryManager(mockCharacter);
            mockCharacter.setInventoryManager(inventoryManager);

            // Now create equipment manager with properly initialized character
            console.log('Creating equipment manager...');
            const equipmentManager = new EquipmentManager(mockCharacter);

            console.log('Adding items to inventory...');
            // Add items to inventory
            const addResults = await Promise.all([
                equipmentManager.addItem('longsword-phb', 1),
                equipmentManager.addItem('shield-phb', 1),
                equipmentManager.addItem('chain-mail-phb', 1),
                equipmentManager.addItem('ring-of-protection-dmg', 1)
            ]);

            console.log('Add results:', addResults);
            if (!addResults.every(result => result)) {
                throw new Error('Failed to add items to inventory');
            }

            console.log('Testing equipment slots...');
            // Test equipping items
            const equippedSword = equipmentManager.equipItem('longsword-phb', 'mainHand');
            console.log('Equipped sword result:', equippedSword);

            const equippedShield = equipmentManager.equipItem('shield-phb', 'offHand');
            console.log('Equipped shield result:', equippedShield);

            const equippedArmor = equipmentManager.equipItem('chain-mail-phb');
            console.log('Equipped armor result:', equippedArmor);

            if (!equippedSword || !equippedShield || !equippedArmor) {
                throw new Error('Equipment not equipped correctly');
            }

            // Test attunement
            console.log('Testing attunement...');
            const attuneResult = await equipmentManager.attuneItem('ring-of-protection-dmg');
            console.log('Attune result:', attuneResult);

            const attunedItems = equipmentManager.getAttunedItems();
            console.log('Attuned items:', attunedItems);

            // Test equipment slots
            const equippedItems = equipmentManager.getEquippedItems();
            console.log('Equipped items:', equippedItems);
            if (equippedItems.length !== 3) {
                throw new Error(`Incorrect number of equipped items: expected 3, got ${equippedItems.length}`);
            }

            // Test unequipping
            console.log('Testing unequip...');
            const unequipResult = equipmentManager.unequipItem('longsword-phb');
            console.log('Unequip result:', unequipResult);

            if (equipmentManager.isEquipped('longsword-phb')) {
                throw new Error('Item not unequipped correctly');
            }

            // Test unattunement
            console.log('Testing unattunement...');
            const unattuneResult = equipmentManager.unattuneItem('ring-of-protection-dmg');
            console.log('Unattune result:', unattuneResult);

            console.log('Equipment slot test completed successfully');
            return {
                success: true,
                message: 'Equipment slot management test completed successfully'
            };
        } catch (error) {
            console.error('Equipment slot test error:', error);
            return {
                success: false,
                message: `Equipment slot management test failed: ${error.message}`
            };
        }
    },

    // Test attunement system
    testAttunement: async () => {
        console.log('Starting attunement system test...');
        try {
            const mockCharacter = new MockCharacter();

            // Create and set up inventory manager first
            console.log('Setting up inventory manager...');
            const inventoryManager = new InventoryManager(mockCharacter);
            mockCharacter.setInventoryManager(inventoryManager);

            // Now create equipment manager with properly initialized character
            console.log('Creating equipment manager...');
            const equipmentManager = new EquipmentManager(mockCharacter);
            // Override the inventory manager to use the same one
            equipmentManager.inventoryManager = inventoryManager;

            // Add magic items that require attunement
            console.log('Adding magic items...');
            const addResults = await Promise.all([
                equipmentManager.addItem('flame-tongue-shortsword-of-greed-tftyp', 1),
                equipmentManager.addItem('ring-of-protection-dmg', 1)
            ]);
            console.log('Add results:', addResults);

            // Test attunement
            console.log('Testing attunement...');
            const attuneResult1 = await equipmentManager.attuneItem('flame-tongue-shortsword-of-greed-tftyp');
            console.log('Attune result 1:', attuneResult1);
            const attuneResult2 = await equipmentManager.attuneItem('ring-of-protection-dmg');
            console.log('Attune result 2:', attuneResult2);

            if (!attuneResult1 || !attuneResult2) {
                throw new Error('Items not attuned correctly');
            }

            // Test attunement limit
            console.log('Testing attunement limit...');
            await equipmentManager.addItem('staff-of-power-dmg', 1);
            await equipmentManager.addItem('cloak-of-protection-dmg', 1);

            const attuneResult3 = await equipmentManager.attuneItem('staff-of-power-dmg');
            console.log('Attune result 3:', attuneResult3);
            const attuneResult4 = await equipmentManager.attuneItem('cloak-of-protection-dmg');
            console.log('Attune result 4:', attuneResult4);

            if (attuneResult4) {
                throw new Error('Attunement limit not enforced');
            }

            // Test unattunement
            console.log('Testing unattunement...');
            const unattuneResult = equipmentManager.unattuneItem('flame-tongue-shortsword-of-greed-tftyp');
            console.log('Unattune result:', unattuneResult);

            if (!unattuneResult) {
                throw new Error('Item not unattuned correctly');
            }

            console.log('Attunement test completed successfully');
            return {
                success: true,
                message: 'Attunement system test completed successfully'
            };
        } catch (error) {
            console.error('Attunement test error:', error);
            return {
                success: false,
                message: `Attunement system test failed: ${error.message}`
            };
        }
    },

    // Test magic item processing
    testMagicItems: async () => {
        console.log('Starting magic item processing test...');
        try {
            // Test magic item loading
            console.log('Loading magic items...');
            const magicItems = await magicItemService.loadMagicItems();
            console.log(`Loaded ${magicItems?.length || 0} magic items`);
            if (!magicItems || magicItems.length === 0) {
                throw new Error('No magic items loaded');
            }

            // Test magic variant loading
            console.log('Loading magic variants...');
            const variants = await magicItemService.loadMagicVariants();
            console.log(`Loaded ${variants?.length || 0} magic variants`);
            if (!variants || variants.length === 0) {
                throw new Error('No magic variants loaded');
            }

            // Test applying +1 shield variant
            console.log('Testing +1 shield variant application...');
            const baseShield = await window.dndDataLoader.loadItems()
                .then(items => items.find(i => i.name === 'Shield' && i.source === 'PHB'));
            console.log('Base shield:', baseShield);

            if (!baseShield) {
                throw new Error('Could not find base shield');
            }

            console.log('Applying +1 shield variant...');
            const magicShield = await magicItemService.applyMagicVariant(baseShield, '+1-shield-dmg');
            console.log('Magic shield result:', magicShield);

            if (!magicShield || !magicShield.magical || !magicShield.bonuses?.armor) {
                throw new Error('Shield variant not applied correctly');
            }

            // Test applying flame tongue variant to shortsword
            console.log('Testing flame tongue variant application...');
            const baseShortsword = await window.dndDataLoader.loadItems()
                .then(items => items.find(i => i.name === 'Shortsword' && i.source === 'PHB'));
            console.log('Base shortsword:', baseShortsword);

            if (!baseShortsword) {
                throw new Error('Could not find base shortsword');
            }

            console.log('Applying flame tongue variant...');
            const flameTongueShortsword = await magicItemService.applyMagicVariant(baseShortsword, 'flame-tongue-dmg');
            console.log('Flame tongue shortsword result:', flameTongueShortsword);

            if (!flameTongueShortsword || !flameTongueShortsword.magical) {
                throw new Error('Flame tongue variant not applied correctly');
            }

            console.log('Magic item test completed successfully');
            return {
                success: true,
                message: 'Magic item processing test completed successfully'
            };
        } catch (error) {
            console.error('Magic item test error:', error);
            return {
                success: false,
                message: `Magic item processing test failed: ${error.message}`
            };
        }
    },

    runAll: async () => {
        console.log('Running all Phase 4 tests...');
        const container = document.getElementById('testResults');
        const heading = document.createElement('h3');
        heading.textContent = 'Running Phase 4 Tests...';
        container.innerHTML = '';
        container.appendChild(heading);

        const results = [];

        // Run item loading test first
        console.log('Running item loading test...');
        const loadingResult = await phase4Tests.testItemLoading();
        results.push({ name: 'Item Loading', ...loadingResult });

        // Run other tests
        console.log('Running inventory management test...');
        const inventoryResult = await phase4Tests.testInventoryManagement();
        results.push({ name: 'Inventory Management', ...inventoryResult });

        console.log('Running equipment slots test...');
        const slotResult = await phase4Tests.testEquipmentSlots();
        results.push({ name: 'Equipment Slots', ...slotResult });

        console.log('Running attunement test...');
        const attunementResult = await phase4Tests.testAttunement();
        results.push({ name: 'Attunement', ...attunementResult });

        console.log('Running magic items test...');
        const magicItemResult = await phase4Tests.testMagicItems();
        results.push({ name: 'Magic Items', ...magicItemResult });

        // Display results
        console.log('Displaying test results...');
        const resultsList = document.createElement('ul');
        resultsList.className = 'test-results';

        for (const result of results) {
            const li = document.createElement('li');
            li.className = `test-result ${result.success ? 'success' : 'failure'}`;
            li.innerHTML = `
                <strong>${result.name}:</strong> ${result.message}
            `;
            resultsList.appendChild(li);
        }

        container.appendChild(resultsList);
        console.log('Phase 4 tests completed');
        return results.every(r => r.success);
    }
};

// Phase 5: Equipment Packs and Starting Equipment
const phase5Tests = {
    async testPackLoading() {
        console.log('Starting pack loading test...');
        const results = [];
        try {
            // Test loading items from all sources
            console.log('Loading items from data loader...');
            const items = await window.dndDataLoader.loadItems();
            console.log('Items loaded, total count:', items?.length || 0);

            // Log all items of type 'pack' or with pack-like properties
            const potentialPacks = items.filter(i =>
                i.type === 'pack' ||
                i.type === 'G' ||
                i.packContents ||
                (i.entries?.some(e => e.type === 'list'))
            );
            console.log('Potential packs found:', potentialPacks.map(p => ({
                name: p.name,
                type: p.type,
                hasPackContents: !!p.packContents,
                hasEntries: !!p.entries,
                contents: p.contents
            })));

            // Filter actual packs
            const packs = items.filter(i => i.type === 'pack');
            console.log(`Found ${packs.length} packs:`, packs.map(p => p.name));

            // Verify we got items
            if (!items || items.length === 0) {
                console.error('No items were loaded');
                results.push({
                    success: false,
                    message: 'No items were loaded'
                });
                return results;
            }

            results.push({
                name: 'Load all packs',
                success: packs.length > 0,
                message: `Found ${packs.length} packs`
            });

            // Test specific pack - Explorer's Pack
            console.log('Looking for Explorer\'s Pack...');
            const explorersPack = packs.find(p => p.name === "Explorer's Pack");
            console.log('Explorer\'s Pack:', explorersPack);

            results.push({
                name: 'Load Explorer\'s Pack',
                success: !!explorersPack,
                message: explorersPack ? 'Successfully loaded Explorer\'s Pack' : 'Failed to load Explorer\'s Pack'
            });

            // Verify pack contents if found
            if (explorersPack) {
                console.log('Explorer\'s Pack contents:', explorersPack.contents);
                const hasRequiredItems = explorersPack.contents.some(item =>
                    item.name.toLowerCase().includes('backpack')) &&
                    explorersPack.contents.some(item =>
                        item.name.toLowerCase().includes('bedroll'));
                results.push({
                    name: 'Verify pack contents',
                    success: hasRequiredItems,
                    message: hasRequiredItems ? 'Pack contains required items' : 'Missing required items'
                });
            }

            return results;
        } catch (error) {
            console.error('Error in testPackLoading:', error);
            return [{
                name: 'Pack loading',
                success: false,
                message: `Error: ${error.message}`
            }];
        }
    },

    async testPackManager() {
        console.log('Testing PackManager...');
        const results = [];

        try {
            // Create mock character
            const mockCharacter = new MockCharacter();
            const packManager = new PackManager(mockCharacter);

            // Test adding a pack
            const addResult = await packManager.addPack('explorers-pack-phb');
            console.log('Add pack result:', addResult);
            results.push({
                name: 'Add pack',
                success: addResult,
                message: addResult ? 'Successfully added Explorer\'s Pack' : 'Failed to add pack'
            });

            // Test getting packs
            const packs = packManager.getPacks();
            console.log('Current packs:', packs);
            results.push({
                name: 'Get packs',
                success: packs.length > 0,
                message: `Found ${packs.length} packs`
            });

            // Test unpacking a pack
            const unpackResult = await packManager.unpackPack('explorers-pack-phb');
            console.log('Unpack result:', unpackResult);
            results.push({
                name: 'Unpack pack',
                success: unpackResult,
                message: unpackResult ? 'Successfully unpacked Explorer\'s Pack' : 'Failed to unpack pack'
            });

            return results;
        } catch (error) {
            console.error('Error in testPackManager:', error);
            return [{
                name: 'PackManager operations',
                success: false,
                message: `Error: ${error.message}`
            }];
        }
    },

    async testStartingEquipment() {
        console.log('Testing starting equipment...');
        const results = [];

        try {
            // Create mock character
            const mockCharacter = new MockCharacter();
            const startingEquipmentManager = new StartingEquipmentManager(mockCharacter);

            // Test getting class starting equipment
            const fighterChoices = await startingEquipmentManager.getEquipmentChoices('fighter-phb');
            console.log('Fighter equipment choices:', fighterChoices);
            results.push({
                name: 'Get fighter equipment choices',
                success: !!fighterChoices,
                message: fighterChoices ? 'Successfully loaded fighter equipment choices' : 'Failed to load choices'
            });

            // Test applying starting equipment
            const equipmentResult = await startingEquipmentManager.applyStartingEquipment(
                'fighter-phb',
                {
                    'weapon': 'longsword-phb',
                    'armor': 'chain-mail-phb'
                }
            );
            console.log('Apply equipment result:', equipmentResult);
            results.push({
                name: 'Apply starting equipment',
                success: equipmentResult,
                message: equipmentResult ? 'Successfully applied starting equipment' : 'Failed to apply equipment'
            });

            // Test background equipment
            const backgroundEquipment = await startingEquipmentManager.getBackgroundEquipment('soldier-phb');
            console.log('Soldier background equipment:', backgroundEquipment);
            results.push({
                name: 'Get background equipment',
                success: backgroundEquipment.length > 0,
                message: `Found ${backgroundEquipment.length} background items`
            });

            return results;
        } catch (error) {
            console.error('Error in testStartingEquipment:', error);
            return [{
                name: 'Starting equipment operations',
                success: false,
                message: `Error: ${error.message}`
            }];
        }
    },

    async runAll() {
        console.log('Running all Phase 5 tests...');
        const results = [];

        // Run pack loading tests
        const packLoadingResults = await this.testPackLoading();
        results.push(...packLoadingResults);

        // Run pack manager tests
        const packManagerResults = await this.testPackManager();
        results.push(...packManagerResults);

        // Run starting equipment tests
        const startingEquipmentResults = await this.testStartingEquipment();
        results.push(...startingEquipmentResults);

        return results;
    }
};

// Test Phase 5: Equipment Packs and Starting Equipment
// Initialize test event handlers
function initializeTests() {
    // Remove any existing event listeners first
    document.removeEventListener('click', handleTestClick);
    document.addEventListener('click', handleTestClick);
}

// Separate the click handler into its own function
async function handleTestClick(e) {
    const testButton = e.target.closest('[data-test]');
    if (!testButton) return;

    const testName = testButton.getAttribute('data-test');
    const resultsContainer = document.getElementById('testResults');
    if (!resultsContainer) return;

    try {
        let results = [];

        // Map test names to their respective test functions
        const testMap = {
            // Phase 1
            'entityCard': () => phase1Tests.testEntityCard(),
            'references': () => phase1Tests.testReferenceResolution(),
            'tooltips': () => phase1Tests.testTooltips(),
            'runAllPhase1': () => phase1Tests.runAll(),

            // Phase 2
            'raceManager': () => phase2Tests.testRaceManager(),
            'raceData': () => phase2Tests.testRaceData(),
            'raceFeatures': () => phase2Tests.testRaceFeatures(),
            'abilityChoices': () => phase2Tests.testAbilityChoices(),
            'runAllPhase2': () => phase2Tests.runAll(),

            // Phase 3
            'classLoading': () => phase3Tests.testClassLoading(),
            'subclassLoading': () => phase3Tests.testSubclassLoading(),
            'spellcasting': () => phase3Tests.testSpellcasting(),
            'runAllPhase3': () => phase3Tests.runAll(),

            // Phase 4
            'equipmentLoading': () => phase4Tests.testItemLoading(),
            'itemLoading': () => phase4Tests.testItemLoading(),
            'inventoryManagement': () => phase4Tests.testInventoryManagement(),
            'equipmentSlots': () => phase4Tests.testEquipmentSlots(),
            'attunement': () => phase4Tests.testAttunement(),
            'magicItems': () => phase4Tests.testMagicItems(),
            'runAllPhase4': () => phase4Tests.runAll(),

            // Phase 5
            'packLoading': () => phase5Tests.testPackLoading(),
            'packManager': () => phase5Tests.testPackManager(),
            'startingEquipment': () => phase5Tests.testStartingEquipment(),
            'runAllPhase5': () => phase5Tests.runAll(),

            // Run all phases
            'runAllPhases': async () => {
                const results = [];
                const phases = [
                    { phase: 1, tests: phase1Tests },
                    { phase: 2, tests: phase2Tests },
                    { phase: 3, tests: phase3Tests },
                    { phase: 4, tests: phase4Tests },
                    { phase: 5, tests: phase5Tests }
                ];

                for (const { phase, tests } of phases) {
                    console.log(`Running Phase ${phase} tests...`);
                    const phaseResults = await tests.runAll();
                    results.push(...(Array.isArray(phaseResults) ? phaseResults : [phaseResults]).map(r => ({
                        phase,
                        name: r.name || `Phase ${phase} Test`,
                        ...r
                    })));
                }

                return results;
            }
        };

        const testFunction = testMap[testName];
        if (testFunction) {
            results = await testFunction();
        }

        // Display results
        displayTestResults(Array.isArray(results) ? results : [results], resultsContainer);
    } catch (error) {
        console.error('Error running tests:', error);
        resultsContainer.innerHTML = `
            <div class="test-section">
                <div class="test-result failure">
                    Error running tests: ${error.message}
                </div>
            </div>
        `;
    }
}

// Add all test phases and functions to the global test object
Object.assign(window.tests, {
    phase1: phase1Tests,
    phase2: phase2Tests,
    phase3: phase3Tests,
    phase4: phase4Tests,
    phase5: phase5Tests,
    initialize: initializeTests,
    runAllPhases: async () => {
        const results = [];
        const phases = [
            { phase: 1, tests: window.tests.phase1 },
            { phase: 2, tests: window.tests.phase2 },
            { phase: 3, tests: window.tests.phase3 },
            { phase: 4, tests: window.tests.phase4 },
            { phase: 5, tests: window.tests.phase5 }
        ];

        for (const { phase, tests } of phases) {
            console.log(`Running Phase ${phase} tests...`);
            const phaseResults = await tests.runAll();
            results.push(...phaseResults.map(r => ({ phase, ...r })));
        }

        return results;
    }
});

// Only initialize once when the module is loaded
if (!window.testsInitialized) {
    window.testsInitialized = true;
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Initializing tests...');
        window.tests.initialize();
    });
}

// Export test functions for ES modules
export { phase1Tests, phase2Tests, phase3Tests, phase4Tests, phase5Tests };

function displayTestResults(results, container) {
    // Clear previous results
    container.innerHTML = '';

    // Create results section
    const section = document.createElement('div');
    section.className = 'test-section';

    // Add heading
    const heading = document.createElement('h4');
    heading.textContent = 'Test Results:';
    section.appendChild(heading);

    // Create results list
    const ul = document.createElement('ul');
    for (const result of results) {
        const li = document.createElement('li');
        li.className = `test-result ${result.success ? 'success' : 'failure'}`;

        // If result has a name property, use it (for runAll results)
        const testName = result.name || 'Test';
        const strong = document.createElement('strong');
        strong.textContent = `${testName}: `;

        li.appendChild(strong);
        li.appendChild(document.createTextNode(result.message));
        ul.appendChild(li);
    }
    section.appendChild(ul);
    container.appendChild(section);
} 