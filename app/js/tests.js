// Import required modules
import { EntityCard } from './core/ui/EntityCard.js';
import { RaceManager } from './core/managers/RaceManager.js';
import { ClassService } from './core/services/ClassService.js';
import { SpellcastingService } from './core/services/SpellcastingService.js';
import { DataLoader } from './core/data/DataLoader.js';

// Initialize services
const dataLoader = new DataLoader();
const classService = new ClassService(dataLoader);
const spellcastingService = new SpellcastingService(dataLoader);

/**
 * tests.js
 * Test functions for the D&D Character Creator
 */

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
    testEntityCard: async () => {
        try {
            // Test race card
            const raceData = {
                type: 'race',
                id: 'test-race',
                name: 'Test Race',
                description: 'A test race description',
                size: 'M',
                speed: { walk: 30 },
                ability: [{
                    mode: 'fixed',
                    scores: ['Strength', 'Dexterity'],
                    amount: 2
                }],
                traits: [{
                    name: 'Test Trait',
                    description: 'A test trait description'
                }],
                features: {
                    darkvision: 60
                }
            };

            const container = document.getElementById('testResults');
            // Use EntityCard class directly
            const raceCard = new EntityCard(container, raceData, null);
            container.innerHTML = raceCard.render();

            return {
                success: true,
                message: 'EntityCard test completed successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `EntityCard test failed: ${error.message}`
            };
        }
    },

    // Test reference resolution
    testReferenceResolution: async () => {
        try {
            const testRefs = [
                '{@item longsword|PHB}',
                '{@spell fireball|PHB}',
                '{@class fighter|PHB}',
                '{@race elf|PHB}'
            ];

            // Use mock resolveJsonRef if real one is not available
            const resolveRef = window.dndDataLoader?.resolveJsonRef || phase1Tests.mockData.resolveJsonRef;

            const results = await Promise.all(testRefs.map(async ref => {
                const resolved = await resolveRef(ref);
                return { ref, resolved };
            }));

            const container = document.getElementById('testResults');
            const resultsList = results.map(({ ref, resolved }) => {
                const li = document.createElement('li');
                const refStrong = document.createElement('strong');
                refStrong.textContent = 'Original: ';
                const resolvedStrong = document.createElement('strong');
                resolvedStrong.textContent = 'Resolved: ';

                li.appendChild(refStrong);
                li.appendChild(document.createTextNode(ref));
                li.appendChild(document.createElement('br'));
                li.appendChild(resolvedStrong);
                li.appendChild(document.createTextNode(resolved));

                return li;
            });

            const section = document.createElement('div');
            section.className = 'test-section';

            const heading = document.createElement('h4');
            heading.textContent = 'Reference Resolution Test Results:';
            section.appendChild(heading);

            const ul = document.createElement('ul');
            for (const li of resultsList) {
                ul.appendChild(li);
            }
            section.appendChild(ul);

            container.innerHTML = '';
            container.appendChild(section);

            return {
                success: true,
                message: 'Reference resolution test completed successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Reference resolution test failed: ${error.message}`
            };
        }
    },

    // Test tooltip system
    testTooltips: () => {
        try {
            // Create a basic tooltip setup if not available
            if (!window.utils?.setupTooltips) {
                window.utils = window.utils || {};
                window.utils.setupTooltips = () => {
                    const tooltipContainer = document.getElementById('tooltipContainer') ||
                        (() => {
                            const container = document.createElement('div');
                            container.id = 'tooltipContainer';
                            container.className = 'tooltip-container';
                            document.body.appendChild(container);
                            return container;
                        })();

                    // Add basic tooltip functionality
                    document.addEventListener('mouseover', (e) => {
                        const target = e.target.closest('[data-tooltip]');
                        if (!target) return;

                        const tooltip = document.createElement('div');
                        tooltip.className = 'tooltip';
                        tooltip.innerHTML = target.dataset.tooltip;
                        tooltipContainer.appendChild(tooltip);

                        const rect = target.getBoundingClientRect();
                        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
                        tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;
                        tooltip.classList.add('show');
                    });

                    document.addEventListener('mouseout', (e) => {
                        const tooltip = tooltipContainer.querySelector('.tooltip');
                        if (tooltip) tooltip.remove();
                    });
                };
            }

            const container = document.getElementById('testResults');

            const section = document.createElement('div');
            section.className = 'test-section';

            const heading = document.createElement('h4');
            heading.textContent = 'Tooltip Test:';
            section.appendChild(heading);

            const para = document.createElement('p');
            para.textContent = 'Hover over these elements to test tooltips:';
            section.appendChild(para);

            const tooltipElements = document.createElement('div');
            tooltipElements.className = 'tooltip-test-elements';

            const createTooltipSpan = (className, tooltip, text) => {
                const span = document.createElement('span');
                span.className = `reference-link ${className}`;
                span.setAttribute('data-tooltip', tooltip);
                span.textContent = text;
                return span;
            };

            tooltipElements.appendChild(
                createTooltipSpan(
                    'item-reference',
                    'Test item tooltip with a longer description to test wrapping',
                    'Item Reference'
                )
            );

            tooltipElements.appendChild(
                createTooltipSpan(
                    'spell-reference',
                    'Test spell tooltip with multiple lines\nLine 2\nLine 3',
                    'Spell Reference'
                )
            );

            const classRef = createTooltipSpan(
                'class-reference',
                'Test class tooltip with title and source',
                'Class Reference'
            );

            tooltipElements.appendChild(classRef);
            section.appendChild(tooltipElements);

            container.innerHTML = '';
            container.appendChild(section);

            // Initialize tooltip system
            window.utils.setupTooltips();

            return {
                success: true,
                message: 'Tooltip test elements created successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Tooltip test failed: ${error.message}`
            };
        }
    },

    // Run all Phase 1 tests
    runAll: async () => {
        const container = document.getElementById('testResults');
        const heading = document.createElement('h3');
        heading.textContent = 'Running Phase 1 Tests...';
        container.innerHTML = '';
        container.appendChild(heading);

        const results = [];

        // Run EntityCard test
        const cardResult = await phase1Tests.testEntityCard();
        results.push({ name: 'EntityCard', ...cardResult });

        // Run reference resolution test
        const refResult = await phase1Tests.testReferenceResolution();
        results.push({ name: 'Reference Resolution', ...refResult });

        // Run tooltip test
        const tooltipResult = phase1Tests.testTooltips();
        results.push({ name: 'Tooltips', ...tooltipResult });

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

// Phase 3 Tests
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

// Add Phase 3 to test runner
async function runTests() {
    await testPhase1();
    await testPhase2();
    await testPhase3();
}

// Export test functions to make them available globally
window.phase1Tests = phase1Tests;
window.phase2Tests = phase2Tests;
window.phase3Tests = phase3Tests;

// Add Phase 3 tests to the global test object
window.tests = window.tests || {};
window.tests.phase3 = phase3Tests;

// Export test functions and initialize function
window.tests = {
    phase1: phase1Tests,
    phase2: phase2Tests,
    phase3: phase3Tests,
    initialize: initializeTests,
    runAllPhases: async () => {
        const results = [];

        // Run Phase 1 tests
        console.log('Running Phase 1 tests...');
        const phase1Results = await window.tests.phase1.runAll();
        results.push(...phase1Results.map(r => ({ phase: 1, ...r })));

        // Run Phase 2 tests
        console.log('Running Phase 2 tests...');
        const phase2Results = await window.tests.phase2.runAll();
        results.push(...phase2Results.map(r => ({ phase: 2, ...r })));

        // Run Phase 3 tests
        console.log('Running Phase 3 tests...');
        const phase3Results = await window.tests.phase3.runAll();
        results.push(...phase3Results.map(r => ({ phase: 3, ...r })));

        return results;
    }
};

// Single export statement for ES modules
export { phase1Tests, phase2Tests, phase3Tests };

// Initialize test event listeners
function initializeTests() {
    document.addEventListener('click', async (e) => {
        const testButton = e.target.closest('[data-test]');
        if (!testButton) return;

        const testName = testButton.getAttribute('data-test');
        const resultsContainer = document.getElementById('testResults');
        if (!resultsContainer) return;

        try {
            let results = [];

            switch (testName) {
                // Phase 1 tests
                case 'entityCard':
                    results = [await window.tests.phase1.testEntityCard()];
                    break;
                case 'references':
                    results = [await window.tests.phase1.testReferenceResolution()];
                    break;
                case 'tooltips':
                    results = [await window.tests.phase1.testTooltips()];
                    break;
                case 'runAll':
                    results = await window.tests.phase1.runAll();
                    break;

                // Phase 2 tests
                case 'raceManager':
                    results = [await window.tests.phase2.testRaceManager()];
                    break;
                case 'raceData':
                    results = [await window.tests.phase2.testRaceData()];
                    break;
                case 'raceFeatures':
                    results = [await window.tests.phase2.testRaceFeatures()];
                    break;
                case 'abilityChoices':
                    results = [await window.tests.phase2.testAbilityChoices()];
                    break;
                case 'runAllPhase2':
                    results = await window.tests.phase2.runAll();
                    break;

                // Phase 3 tests
                case 'classLoading':
                    results = [await phase3Tests.testClassLoading()];
                    break;
                case 'subclassLoading':
                    results = [await phase3Tests.testSubclassLoading()];
                    break;
                case 'spellcasting':
                    results = [await phase3Tests.testSpellcasting()];
                    break;
                case 'runAllPhase3':
                    results = await phase3Tests.runAll();
                    break;

                // Run all phases
                case 'runAllPhases':
                    results = await window.tests.runAllPhases();
                    break;
            }

            // Display results
            displayTestResults(results, resultsContainer);
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
    });
}

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