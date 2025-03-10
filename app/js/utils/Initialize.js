// Import Character model
import { Character } from '../models/Character.js';

// Import utilities and services
import { DataLoader } from './DataLoader.js';
import { EntityCard } from '../ui/EntityCard.js';
import { ReferenceResolver } from './ReferenceResolver.js';
import { TextProcessor } from './TextProcessor.js';
import { ClassManager } from '../managers/ClassManager.js';
import { setupFormListeners, updateCharacterField, markUnsavedChanges, clearUnsavedChanges } from '../utils.js';

// Import UI components
import { RaceUI } from '../ui/RaceUI.js';
import { ClassUI } from '../ui/ClassUI.js';
import { EquipmentUI } from '../ui/EquipmentUI.js';
import { BackgroundUI } from '../ui/BackgroundUI.js';
import { AbilityScoreUI } from '../ui/AbilityScoreUI.js';

// Import managers
import { tooltipManager } from '../managers/TooltipManager.js';
import { PrerequisiteManager } from '../managers/PrerequisiteManager.js';
import { ProficiencyManager } from '../managers/ProficiencyManager.js';
import { RaceManager } from '../managers/RaceManager.js';
import { SpellManager } from '../managers/SpellManager.js';
import { EquipmentManager } from '../managers/EquipmentManager.js';
import { BackgroundManager } from '../managers/BackgroundManager.js';
import { CharacteristicManager } from '../managers/CharacteristicManager.js';
import { FeatManager } from '../managers/FeatManager.js';
import { OptionalFeatureManager } from '../managers/OptionalFeatureManager.js';
import { PackManager } from '../managers/PackManager.js';
import { StartingEquipmentManager } from '../managers/StartingEquipmentManager.js';

// Initialize character state
window.currentCharacter = new Character();

// Initialize managers for character
const raceManager = new RaceManager(window.currentCharacter);
const backgroundManager = new BackgroundManager(window.currentCharacter);
window.currentCharacter.race = raceManager;
window.currentCharacter.background = backgroundManager;

// Initialize UI components
const raceUI = new RaceUI(window.currentCharacter);
const classUI = new ClassUI(window.currentCharacter);
const equipmentUI = new EquipmentUI(window.currentCharacter);
const abilityScoreUI = new AbilityScoreUI(window.currentCharacter);

// Initialize core systems
const dataLoader = window.dndDataLoader || new DataLoader();
const referenceResolver = new ReferenceResolver(dataLoader);
const textProcessor = new TextProcessor(referenceResolver);

// Make core systems available globally
window.dndDataLoader = dataLoader;
window.dndReferenceResolver = referenceResolver;
window.dndTextProcessor = textProcessor;

// Initialize managers
const classManager = new ClassManager(window.currentCharacter);
const proficiencyService = new ProficiencyManager(dataLoader);
const prerequisiteService = new PrerequisiteManager(dataLoader);

// Make managers available globally
window.RaceManager = RaceManager;
window.ClassManager = ClassManager;
window.SpellManager = SpellManager;
window.EquipmentManager = EquipmentManager;
window.BackgroundManager = BackgroundManager;
window.CharacteristicManager = CharacteristicManager;
window.FeatManager = FeatManager;
window.OptionalFeatureManager = OptionalFeatureManager;
window.PackManager = PackManager;
window.StartingEquipmentManager = StartingEquipmentManager;

// Make services available globally
window.classManager = classManager;
window.prerequisiteService = prerequisiteService;
window.proficiencyService = proficiencyService;

// Initialize tooltips
tooltipManager.initialize();

// Initialize the application
async function initializeCharacterApp() {
    console.log('initializeCharacterApp called');

    // Load existing characters
    await loadCharacters();

    // Event Listeners
    const newCharacterBtn = document.getElementById('newCharacterBtn');
    console.log('Found newCharacterBtn:', !!newCharacterBtn);
    if (newCharacterBtn) {
        console.log('Setting up newCharacterBtn click handler');
        // Remove any existing event listeners
        const newBtn = newCharacterBtn.cloneNode(true);
        newCharacterBtn.parentNode.replaceChild(newBtn, newCharacterBtn);

        // Add click handler
        newBtn.addEventListener('click', (e) => {
            console.log('newCharacterBtn clicked');
            e.preventDefault();
            createNewCharacter();
        });
    }

    const createCharacterBtn = document.getElementById('createCharacterBtn');
    console.log('Found createCharacterBtn:', !!createCharacterBtn);
    if (createCharacterBtn) {
        // Remove any existing event listeners
        createCharacterBtn.replaceWith(createCharacterBtn.cloneNode(true));
        // Get fresh reference after cloning
        const newCreateBtn = document.getElementById('createCharacterBtn');
        console.log('Found cloned createCharacterBtn:', !!newCreateBtn);
        newCreateBtn.addEventListener('click', () => {
            console.log('createCharacterBtn clicked');
            createCharacterFromModal();
        });
    }

    const importCharacterBtn = document.getElementById('importCharacterBtn');
    if (importCharacterBtn) {
        // Remove any existing event listeners
        importCharacterBtn.replaceWith(importCharacterBtn.cloneNode(true));
        // Get fresh reference after cloning
        const newImportBtn = document.getElementById('importCharacterBtn');
        newImportBtn.addEventListener('click', importCharacter);
    }

    // Form input listeners
    setupFormListeners();
}

// Initialize build page
async function initializeBuildPage() {
    await raceUI.initializeRaceSelection();
    await classUI.initializeClassSelection();

    // Initialize ability scores
    if (window.currentCharacter) {
        const abilityScoreUI = new AbilityScoreUI(window.currentCharacter);
        abilityScoreUI.update();
    }

    setupProficiencies();
    setupOptionalProficiencies();

    // Initialize background UI
    const backgroundContainer = document.querySelector('.card-body.background-card-body');
    if (backgroundContainer) {
        new BackgroundUI(backgroundContainer, window.currentCharacter.background);
    }

    if (window.currentCharacter.id) {
        await populateForm(window.currentCharacter);
    } else {
        await raceUI.updateRaceDisplay();
        await classUI.updateClassDetails('', '');
    }
}

// Initialize skeleton details for race, class, and background
function initializeSkeletonDetails() {
    console.log('Initializing skeleton details');

    // Get detail elements
    const raceImage = document.getElementById('raceImage');
    const raceQuickDesc = document.getElementById('raceQuickDesc');
    const raceDetails = document.getElementById('raceDetails');

    const classImage = document.getElementById('classImage');
    const classQuickDesc = document.getElementById('classQuickDesc');
    const classDetails = document.getElementById('classDetails');

    // Set content for race
    if (raceImage && raceQuickDesc && raceDetails) {
        if (window.currentCharacter.race) {
            raceUI.updateRaceDisplay();
        } else {
            raceUI.setRacePlaceholderContent(raceImage, raceQuickDesc, raceDetails);
        }
    }

    // Set content for class
    if (classImage && classQuickDesc && classDetails) {
        if (window.currentCharacter.class) {
            classUI.updateClassDetails(window.currentCharacter.class, window.currentCharacter.subclass);
        } else {
            classUI.setClassPlaceholderContent(classImage, classQuickDesc, classDetails);
        }
    }

    // Background details are handled by BackgroundUI
    const backgroundContainer = document.querySelector('.background-section');
    if (backgroundContainer) {
        new BackgroundUI(backgroundContainer, window.currentCharacter.background);
    }
}

// Initialize details page
async function initializeDetailsPage() {
    console.log('Initializing details page');

    // Get form elements
    const characterNameInput = document.getElementById('characterName');
    const playerNameInput = document.getElementById('playerName');
    const heightInput = document.getElementById('height');
    const weightInput = document.getElementById('weight');
    const genderInput = document.getElementById('gender');

    if (!window.currentCharacter) {
        console.error('No character selected');
        return;
    }

    console.log('Current character:', window.currentCharacter);

    // Populate form fields with character data
    if (characterNameInput) {
        console.log('Setting character name:', window.currentCharacter.name);
        characterNameInput.value = window.currentCharacter.name || '';
    }
    if (playerNameInput) {
        console.log('Setting player name:', window.currentCharacter.playerName);
        playerNameInput.value = window.currentCharacter.playerName || '';
    }
    if (heightInput) {
        console.log('Setting height:', window.currentCharacter.height);
        heightInput.value = window.currentCharacter.height || '';
    }
    if (weightInput) {
        console.log('Setting weight:', window.currentCharacter.weight);
        weightInput.value = window.currentCharacter.weight || '';
    }
    if (genderInput) {
        console.log('Setting gender:', window.currentCharacter.gender);
        genderInput.value = window.currentCharacter.gender || '';
    }

    // Setup form listeners if not already set
    setupFormListeners();
}

// Initialize equipment page
async function initializeEquipmentPage() {
    await equipmentUI.initializeEquipmentPage();
}

// Initialize spellcasting page
async function initializeSpellcastingPage() {
    if (!window.currentCharacter?.spells) return;

    const container = document.querySelector('#pageContent');
    if (!container) return;

    // Clear container
    container.innerHTML = '';

    // Create spell list sections
    const sections = {
        cantrips: createSpellSection('Cantrips', 0),
        level1: createSpellSection('1st Level', 1),
        level2: createSpellSection('2nd Level', 2),
        level3: createSpellSection('3rd Level', 3),
        level4: createSpellSection('4th Level', 4),
        level5: createSpellSection('5th Level', 5),
        level6: createSpellSection('6th Level', 6),
        level7: createSpellSection('7th Level', 7),
        level8: createSpellSection('8th Level', 8),
        level9: createSpellSection('9th Level', 9)
    };

    // Add sections to container
    for (const section of Object.values(sections)) {
        container.appendChild(section);
    }

    // Update spell lists
    await updateSpellLists(sections);
}

// Create a spell list section
function createSpellSection(title, level) {
    const section = document.createElement('div');
    section.className = 'spell-section mb-4';
    section.innerHTML = `
        <h3 class="spell-level-title">${title}</h3>
        <div class="spell-list" data-spell-level="${level}"></div>
    `;
    return section;
}

// Update spell lists with current spells
async function updateSpellLists(sections) {
    if (!window.currentCharacter?.spells) return;

    // Get all spells for the character's class
    const classSpells = await window.currentCharacter.spellManager.getSpellsForClass(
        window.currentCharacter.class.id,
        window.currentCharacter.level
    );

    // Add subclass spells if applicable
    if (window.currentCharacter.subclass) {
        const subclassSpells = await window.currentCharacter.spellManager.getSpellsForSubclass(
            window.currentCharacter.class.id,
            window.currentCharacter.subclass.id,
            window.currentCharacter.level
        );
        classSpells.push(...subclassSpells);
    }

    // Sort spells by level and update sections
    for (const spell of classSpells) {
        const section = sections[spell.level === 0 ? 'cantrips' : `level${spell.level}`];
        if (section) {
            const spellList = section.querySelector('.spell-list');
            spellList.appendChild(new EntityCard(spell).render());
        }
    }
}

// Import character
async function importCharacter() {
    try {
        const result = await window.characterStorage.importCharacter();

        if (result.success) {
            // If characters were imported successfully
            if (result.characters && result.characters.length > 0) {
                let message = `Successfully imported ${result.importCount} character`;
                if (result.importCount > 1) message += 's';
                if (result.failedCount > 0) {
                    message += `. ${result.failedCount} import${result.failedCount > 1 ? 's' : ''} failed.`;
                }
                window.showNotification(message, 'success');

                // Reload the character list
                await window.loadCharacters();
            }
        } else {
            // If import failed
            let errorMessage = result.message || 'Failed to import character(s)';
            if (result.failedImports) {
                errorMessage += '\nDetails:\n' + result.failedImports.map(f =>
                    `${f.file}: ${f.reason}`
                ).join('\n');
            }
            window.showNotification(errorMessage, 'danger');
        }
    } catch (error) {
        console.error('Error importing character:', error);
        window.showNotification('Error importing character', 'danger');
    }
}

// Load and display character list
async function loadCharacters() {
    const characterList = document.getElementById('characterList');
    if (!characterList) return;

    try {
        // Clear existing list
        characterList.innerHTML = '';

        // Load characters from storage
        const characters = await window.characterStorage.loadCharacters();

        if (characters.length === 0) {
            // Show empty state
            characterList.innerHTML = `
                <div class="col-12 text-center">
                    <div class="empty-state">
                        <i class="fas fa-users fa-3x mb-3"></i>
                        <h3>No Characters Yet</h3>
                        <p>Create a new character to get started!</p>
                    </div>
                </div>
            `;
            return;
        }

        // Sort characters by last modified date and deduplicate by ID
        const uniqueCharacters = Array.from(new Map(characters.map(char => [char.id, char])).values());
        uniqueCharacters.sort((a, b) => {
            const dateA = new Date(a.lastModified || 0);
            const dateB = new Date(b.lastModified || 0);
            return dateB - dateA;
        });

        // Create character cards
        for (const character of uniqueCharacters) {
            // Skip if a card for this character already exists
            if (characterList.querySelector(`[data-character-id="${character.id}"]`)) {
                continue;
            }

            const card = document.createElement('div');
            card.className = 'col-md-4 col-lg-3 mb-4';
            card.innerHTML = `
                <div class="card character-card ${window.currentCharacter?.id === character.id ? 'selected' : ''}" data-character-id="${character.id}">
                    <div class="active-profile-badge">Active Profile</div>
                    <div class="card-body">
                        <h5 class="card-title">${character.name}</h5>
                        <p class="card-text">
                            ${character.race?.name || ''} ${character.class?.name || ''}
                            ${character.level ? `(Level ${character.level})` : ''}
                        </p>
                        <p class="card-text">
                            <small class="text-muted">Last modified: ${new Date(character.lastModified).toLocaleDateString()}</small>
                        </p>
                    </div>
                    <div class="card-footer">
                        <div class="btn-group w-100">
                            <button class="btn btn-secondary export-character" title="Export Character">
                                <i class="fas fa-file-export"></i>
                            </button>
                            <button class="btn btn-danger delete-character" title="Delete Character">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Add event listeners
            const characterCard = card.querySelector('.character-card');
            const exportBtn = card.querySelector('.export-character');
            const deleteBtn = card.querySelector('.delete-character');

            // Add click handler to the entire card for selection
            characterCard?.addEventListener('click', (e) => {
                // Don't trigger if clicking buttons
                if (!e.target.closest('.btn-group')) {
                    // Load character using the new fromJSON method
                    window.currentCharacter = Character.fromJSON(character);

                    // Initialize managers for the loaded character
                    window.currentCharacter.race = new RaceManager(window.currentCharacter);
                    window.currentCharacter.class = new ClassManager(window.currentCharacter);
                    window.currentCharacter.background = new BackgroundManager(window.currentCharacter);
                    window.currentCharacter.characteristics = new CharacteristicManager(window.currentCharacter);
                    window.currentCharacter.equipment = new EquipmentManager(window.currentCharacter);
                    window.currentCharacter.spells = new SpellManager(window.currentCharacter);
                    window.currentCharacter.feats = new FeatManager(window.currentCharacter);
                    window.currentCharacter.optionalFeatures = new OptionalFeatureManager(window.currentCharacter);
                    window.currentCharacter.packManager = new PackManager(window.currentCharacter);
                    window.currentCharacter.startingEquipmentManager = new StartingEquipmentManager(window.currentCharacter);

                    // Initialize ability scores UI
                    const abilityScoreUI = new AbilityScoreUI(window.currentCharacter);
                    abilityScoreUI.update();

                    // Initialize proficiencies
                    setupProficiencies();
                    setupOptionalProficiencies();

                    // Update character card selection state
                    document.querySelectorAll('.character-card').forEach(card => {
                        card.classList.toggle('selected', card.dataset.characterId === character.id);
                    });

                    // Update navigation state
                    updateNavigation();

                    // Initialize details page for the selected character
                    initializeDetailsPage();

                    // Clear any unsaved changes indicator
                    clearUnsavedChanges();

                    window.showNotification(`Selected character: ${character.name}`, 'success');
                }
            });

            exportBtn?.addEventListener('click', async () => {
                try {
                    const result = await window.characterStorage.exportCharacter(character.id);
                    if (result.success) {
                        window.showNotification('Character exported successfully', 'success');
                    } else {
                        window.showNotification(result.message || 'Failed to export character', 'danger');
                    }
                } catch (error) {
                    console.error('Error exporting character:', error);
                    window.showNotification('Error exporting character', 'danger');
                }
            });

            deleteBtn?.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this character?')) {
                    try {
                        const result = await window.characterStorage.deleteCharacter(character.id);
                        if (result.success) {
                            window.showNotification('Character deleted successfully', 'success');
                            // If the deleted character was selected, clear the selection
                            if (window.currentCharacter?.id === character.id) {
                                window.currentCharacter = null;
                                updateNavigation();
                            }
                            await loadCharacters(); // Reload the list
                        } else {
                            window.showNotification(result.message || 'Failed to delete character', 'danger');
                        }
                    } catch (error) {
                        console.error('Error deleting character:', error);
                        window.showNotification('Error deleting character', 'danger');
                    }
                }
            });

            characterList.appendChild(card);
        }
    } catch (error) {
        console.error('Error loading characters:', error);
        window.showNotification('Error loading characters', 'danger');
    }
}

// Create a new character
function createNewCharacter() {
    console.log('createNewCharacter called');
    const modalElement = document.getElementById('newCharacterModal');
    console.log('Found modal element:', !!modalElement);
    const modal = new bootstrap.Modal(modalElement);
    console.log('Created modal instance');
    modal.show();
}

// Create a new character from modal input
async function createCharacterFromModal() {
    const nameInput = document.getElementById('newCharacterName');
    if (!nameInput?.value) {
        window.showNotification('Please enter a character name', 'warning');
        return;
    }

    // Create a new character
    const character = new Character();
    character.id = crypto.randomUUID();
    character.name = nameInput.value;
    character.lastModified = new Date().toISOString();

    // Initialize default ability scores
    character.abilityScores = {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
    };

    // Save the new character first
    try {
        console.log('Attempting to save character...');
        const saveResult = await window.characterStorage.saveCharacter(character);
        console.log('Save result:', saveResult);

        if (!saveResult.success) {
            throw new Error(saveResult.message || 'Failed to save character');
        }

        // Only initialize the current character and managers after successful save
        window.currentCharacter = character;

        // Initialize managers
        window.currentCharacter.race = new RaceManager(window.currentCharacter);
        window.currentCharacter.class = new ClassManager(window.currentCharacter);
        window.currentCharacter.background = new BackgroundManager(window.currentCharacter);
        window.currentCharacter.characteristics = new CharacteristicManager(window.currentCharacter);
        window.currentCharacter.equipment = new EquipmentManager(window.currentCharacter);
        window.currentCharacter.spells = new SpellManager(window.currentCharacter);
        window.currentCharacter.feats = new FeatManager(window.currentCharacter);
        window.currentCharacter.optionalFeatures = new OptionalFeatureManager(window.currentCharacter);
        window.currentCharacter.packManager = new PackManager(window.currentCharacter);
        window.currentCharacter.startingEquipmentManager = new StartingEquipmentManager(window.currentCharacter);

        // Initialize ability scores UI
        const abilityScoreUI = new AbilityScoreUI(window.currentCharacter);
        abilityScoreUI.update();

        console.log('Initialized managers');

        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('newCharacterModal'));
        if (modal) {
            modal.hide();
        }

        // Reset the form
        nameInput.value = '';

        window.showNotification('Character created successfully', 'success');

        // Reload the character list and update UI state
        console.log('Reloading character list...');
        await loadCharacters();

        // Update character card selection state
        document.querySelectorAll('.character-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.characterId === window.currentCharacter.id);
        });

        // Update navigation state
        updateNavigation();
    } catch (error) {
        console.error('Error saving new character:', error);
        console.error('Error details:', error.stack);
        window.showNotification('Error creating character: ' + error.message, 'danger');
    }
}

// Make functions available globally
window.loadCharacters = loadCharacters;
window.initializeCharacterApp = initializeCharacterApp;
window.createNewCharacter = createNewCharacter;
window.markUnsavedChanges = markUnsavedChanges;
window.clearUnsavedChanges = clearUnsavedChanges;
window.initializeDetailsPage = initializeDetailsPage;
window.initializeBuildPage = initializeBuildPage;
window.initializeEquipmentPage = initializeEquipmentPage;
window.initializeSpellcastingPage = initializeSpellcastingPage;