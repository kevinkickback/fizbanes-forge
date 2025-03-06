// Character state
const currentCharacter = {
    id: null,
    name: '',
    playerName: '',
    race: null, // Will be initialized as RaceManager instance
    class: '',
    subclass: '',
    background: '',
    level: 1,
    abilityScores: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
    },
    abilityBonuses: {
        strength: [],
        dexterity: [],
        constitution: [],
        intelligence: [],
        wisdom: [],
        charisma: []
    },
    size: 'M',
    speed: { walk: 30 },
    features: {
        darkvision: 0,
        resistances: new Set(),
        traits: new Map()  // Map of trait name to { description, source }
    },
    proficiencies: {
        armor: new Set(),
        weapons: new Set(),
        tools: new Set(),
        skills: new Set(),
        languages: new Set(['Common']) // Default language
    },
    proficiencySources: {
        armor: new Map(),
        weapons: new Map(),
        tools: new Map(),
        skills: new Map(),
        languages: new Map([['Common', new Set(['Default'])]])
    },
    height: '',
    weight: '',
    gender: '',
    backstory: '',
    equipment: {
        weapons: [],
        armor: [],
        items: []
    },

    // Methods for ability scores
    getAbilityScore(ability) {
        const base = this.abilityScores[ability] || 10;
        const bonuses = this.abilityBonuses[ability] || [];
        return base + bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
    },

    addAbilityBonus(ability, value, source) {
        if (!this.abilityBonuses[ability]) {
            this.abilityBonuses[ability] = [];
        }
        this.abilityBonuses[ability].push({ value, source });
    },

    clearAbilityBonuses(source) {
        for (const ability in this.abilityBonuses) {
            this.abilityBonuses[ability] = this.abilityBonuses[ability].filter(
                bonus => bonus.source !== source
            );
        }
    },

    // Methods for proficiencies
    addProficiency(type, proficiency, source) {
        if (!this.proficiencies[type]) return;
        this.proficiencies[type].add(proficiency);
        if (!this.proficiencySources[type].has(proficiency)) {
            this.proficiencySources[type].set(proficiency, new Set());
        }
        this.proficiencySources[type].get(proficiency).add(source);
    },

    clearProficiencies(source) {
        for (const type in this.proficiencySources) {
            for (const [prof, sources] of this.proficiencySources[type]) {
                sources.delete(source);
                if (sources.size === 0) {
                    this.proficiencies[type].delete(prof);
                    this.proficiencySources[type].delete(prof);
                }
            }
        }
    },

    // Methods for languages
    addLanguage(language, source) {
        this.addProficiency('languages', language, source);
    },

    clearLanguages(source) {
        this.clearProficiencies(source);
    },

    // Methods for resistances
    addResistance(resistance, source) {
        this.features.resistances.add(resistance);
    },

    clearResistances(source) {
        // For now, just clear all resistances when source is removed
        // TODO: Add source tracking for resistances
        this.features.resistances.clear();
    },

    // Methods for traits
    addTrait(name, description, source) {
        this.features.traits.set(name, { description, source });
    },

    clearTraits(source) {
        for (const [name, trait] of this.features.traits) {
            if (trait.source === source) {
                this.features.traits.delete(name);
            }
        }
    }
};

// Initialize RaceManager
currentCharacter.race = new RaceManager(currentCharacter);

// Track if there are unsaved changes
const hasUnsavedChanges = {
    value: false
};

// Make currentCharacter available globally
window.currentCharacter = currentCharacter;

// Import core utilities
import { EntityCard } from './core/ui/EntityCard.js';
import { tooltipManager } from './core/ui/TooltipManager.js';
import { ReferenceResolver } from './core/utils/ReferenceResolver.js';
import { TextProcessor } from './core/utils/TextProcessor.js';

// Import services
import { RaceService } from './core/services/RaceService.js';
import { ClassService } from './core/services/ClassService.js';
import { SpellcastingService } from './core/services/SpellcastingService.js';
import { PackService } from './core/services/PackService.js';
import { EquipmentChoiceService } from './core/services/EquipmentChoiceService.js';

// Import models
import { Race } from './core/models/Race.js';
import { Subrace } from './core/models/Subrace.js';
import { Class } from './core/models/Class.js';
import { Subclass } from './core/models/Subclass.js';
import { Feature } from './core/models/Feature.js';
import { Spell } from './core/models/Spell.js';

// Initialize core systems
const dataLoader = new DataLoader();
const referenceResolver = new ReferenceResolver(dataLoader);
const textProcessor = new TextProcessor(referenceResolver);

// Initialize services
const raceService = new RaceService(dataLoader);
const classService = new ClassService(dataLoader);
const spellcastingService = new SpellcastingService(dataLoader);
const packService = new PackService(window.dndDataLoader);
const equipmentChoiceService = new EquipmentChoiceService(window.dndDataLoader);

// Import managers
import { PackManager } from './core/managers/PackManager.js';
import { StartingEquipmentManager } from './core/managers/StartingEquipmentManager.js';

// Initialize managers
currentCharacter.packManager = new PackManager(currentCharacter);
currentCharacter.startingEquipmentManager = new StartingEquipmentManager(currentCharacter);

// Forward existing functions to new implementations
function createCard(data) {
    return new NewEntityCard(data).render();
}

function setupTooltips() {
    return tooltipManager.initialize();
}

async function processText(text) {
    return await textProcessor.processText(text);
}

async function resolveReference(ref) {
    return await referenceResolver.resolveRef(ref);
}

// Forward existing spell-related functions to new implementations
async function loadSpell(spellId) {
    return await spellcastingService.loadSpell(spellId);
}

async function getSpellsForClass(classId, level = null) {
    return await spellcastingService.getSpellsForClass(classId, level);
}

async function getSpellsForSubclass(classId, subclassId, level = null) {
    return await spellcastingService.getSpellsForSubclass(classId, subclassId, level);
}

async function validateSpellForClass(spellId, classId, level) {
    return await spellcastingService.validateSpellForClass(spellId, classId, level);
}

async function validateSpellComponents(spellId, hasComponent) {
    return await spellcastingService.validateSpellComponents(spellId, hasComponent);
}

async function validateConcentration(spellId, activeSpells) {
    return await spellcastingService.validateConcentration(spellId, activeSpells);
}

function calculateSpellSlots(classLevel, spellcastingType = 'full') {
    // Forward to SpellcastingService
    return window.spellcastingService.calculateSpellSlots(classLevel, spellcastingType);
}

// Make core systems available globally
window.dndDataLoader = dataLoader;
window.dndReferenceResolver = referenceResolver;
window.dndTextProcessor = textProcessor;
window.raceService = raceService;
window.classService = classService;
window.spellcastingService = spellcastingService;

// Initialize managers
window.raceManager = new RaceManager(currentCharacter);

// Forward existing race-related functions to new implementations
async function loadRaces() {
    return await raceService.getAvailableRaces();
}

async function loadSubraces(raceId) {
    return await raceService.getAvailableSubraces(raceId);
}

async function getRace(raceId) {
    return await raceService.loadRace(raceId);
}

async function getSubrace(subraceId, parentRaceId) {
    return await raceService.loadSubrace(subraceId, parentRaceId);
}

// Forward existing functions to new implementations
async function addPack(packId) {
    return await currentCharacter.packManager.addPack(packId);
}

function unpackPack(packId) {
    return currentCharacter.packManager.unpackPack(packId);
}

async function applyStartingEquipment(classId, choices, backgroundId = null) {
    return await currentCharacter.startingEquipmentManager.applyStartingEquipment(classId, choices, backgroundId);
}

async function getStartingEquipmentChoices(classId) {
    return await currentCharacter.startingEquipmentManager.getEquipmentChoices(classId);
}

async function getBackgroundEquipment(backgroundId) {
    return await currentCharacter.startingEquipmentManager.getBackgroundEquipment(backgroundId);
}

// Initialize the application
async function initializeCharacterApp() {
    // Load existing characters
    await loadCharacters();

    // Event Listeners
    const newCharacterBtn = document.getElementById('newCharacterBtn');
    if (newCharacterBtn) {
        newCharacterBtn.addEventListener('click', createNewCharacter);
    }

    const createCharacterBtn = document.getElementById('createCharacterBtn');
    if (createCharacterBtn) {
        createCharacterBtn.addEventListener('click', createCharacterFromModal);
    }

    // Add form submission handler for the new character modal
    const newCharacterForm = document.getElementById('newCharacterForm');
    if (newCharacterForm) {
        newCharacterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            createCharacterFromModal();
        });
    }

    const importCharacterBtn = document.getElementById('importCharacterBtn');
    if (importCharacterBtn) {
        importCharacterBtn.addEventListener('click', importCharacter);
    }

    const downloadPDFBtn = document.getElementById('downloadPDF');
    if (downloadPDFBtn) {
        downloadPDFBtn.addEventListener('click', generateCharacterSheet);
    }

    // Form input listeners
    setupFormListeners();
}

// Wait for DOM and electron to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if electron is available
    if (window.electron) {
        initializeCharacterApp();
    } else {
        console.error('Electron not available');
    }
});

// Setup form listeners
function setupFormListeners() {
    document.addEventListener('change', (e) => {
        const target = e.target;
        // Remove race, class, and their sub-selects from the general change listener
        if (target.matches('#characterName, #playerName, #height, #weight, #gender, #backstory, #backgroundSelect')) {
            updateCharacterField(e);
        }
    });
}

// Initialize build page
async function initializeBuildPage() {
    await initializeRaceSelection();
    await populateSelects();
    await calculateBonusesAndProficiencies();
    setupAbilityScores();
    setupProficiencies();
    setupOptionalProficiencies();

    if (currentCharacter.id) {
        await populateForm(currentCharacter);
    } else {
        // Initialize with empty race details to ensure consistent layout
        await updateRaceDisplay();
        // Initialize with empty class details to ensure consistent layout
        await updateClassDetails('', '');
        // Initialize with empty background details to ensure consistent layout
        await updateBackgroundDetails('');
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

    const backgroundImage = document.getElementById('backgroundImage');
    const backgroundQuickDesc = document.getElementById('backgroundQuickDesc');
    const backgroundDetails = document.getElementById('backgroundDetails');

    // Set content for race
    if (raceImage && raceQuickDesc && raceDetails) {
        if (currentCharacter.race) {
            // If a race is selected, update race details
            updateRaceDetails(currentCharacter.race, currentCharacter.subrace);
        } else {
            // Otherwise, set placeholder content
            setRacePlaceholderContent(raceImage, raceQuickDesc, raceDetails);
        }
    }

    // Set content for class
    if (classImage && classQuickDesc && classDetails) {
        if (currentCharacter.class) {
            // If a class is selected, update class details
            updateClassDetails(currentCharacter.class, currentCharacter.subclass);
        } else {
            // Otherwise, set placeholder content
            setClassPlaceholderContent(classImage, classQuickDesc, classDetails);
        }
    }

    // Set content for background
    if (backgroundImage && backgroundQuickDesc && backgroundDetails) {
        if (currentCharacter.background) {
            // If a background is selected, update background details
            updateBackgroundDetails(currentCharacter.background);
        } else {
            // Otherwise, set placeholder content
            setBackgroundPlaceholderContent(backgroundImage, backgroundQuickDesc, backgroundDetails);
        }
    }
}

// Initialize equipment page
async function initializeEquipmentPage() {
    if (!window.currentCharacter) return;

    // Initialize equipment sections
    const sections = {
        inventory: document.createElement('div'),
        equipped: document.createElement('div'),
        attuned: document.createElement('div')
    };

    sections.inventory.id = 'inventorySection';
    sections.equipped.id = 'equippedSection';
    sections.attuned.id = 'attunedSection';

    // Create tabs for different sections
    const tabContainer = document.createElement('div');
    tabContainer.className = 'nav nav-tabs mb-3';
    tabContainer.innerHTML = `
        <button class="nav-link active" data-bs-toggle="tab" data-section="inventory">Inventory</button>
        <button class="nav-link" data-bs-toggle="tab" data-section="equipped">Equipped</button>
        <button class="nav-link" data-bs-toggle="tab" data-section="attuned">Attuned</button>
    `;

    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'tab-content';

    // Add sections to content container
    for (const section of Object.values(sections)) {
        section.className = 'equipment-grid tab-pane fade';
        contentContainer.appendChild(section);
    }
    sections.inventory.classList.add('show', 'active');

    // Get the equipment page container
    const container = document.querySelector('#pageContent');
    if (!container) return;

    // Clear and set up the page
    container.innerHTML = '';
    container.appendChild(tabContainer);
    container.appendChild(contentContainer);

    // Set up event listeners
    setupEquipmentEventListeners();

    // Update the equipment display
    await updateEquipmentSections(sections);
}

// Update equipment sections with current items
async function updateEquipmentSections(sections) {
    if (!window.currentCharacter?.equipmentManager) return;

    const manager = window.currentCharacter.equipmentManager;

    // Update inventory section
    sections.inventory.innerHTML = '';
    for (const item of manager.inventory.values()) {
        sections.inventory.appendChild(createItemCard(item));
    }

    // Update equipped section
    sections.equipped.innerHTML = '';
    for (const item of manager.getEquippedItems()) {
        sections.equipped.appendChild(createItemCard(item));
    }

    // Update attuned section
    sections.attuned.innerHTML = '';
    for (const item of manager.getAttunedItems()) {
        sections.attuned.appendChild(createItemCard(item));
    }
}

// Create an item card with actions
function createItemCard(item, showActions = true) {
    const card = document.createElement('div');
    card.className = `item-card card ${item.equipped ? 'equipped' : ''} ${item.attuned ? 'attuned' : ''}`;
    card.dataset.itemId = item.id;

    // Card header with name and quantity
    const header = document.createElement('div');
    header.className = 'card-header d-flex justify-content-between align-items-center';
    header.innerHTML = `
        <h5 class="mb-0">${item.name}</h5>
        ${item.quantity > 1 ? `<span class="quantity">${item.quantity}</span>` : ''}
    `;
    card.appendChild(header);

    // Card body with item details
    const body = document.createElement('div');
    body.className = 'card-body';

    // Basic properties
    let details = `
        <p>${item.description}</p>
        <div class="properties">
            <p><strong>Type:</strong> ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</p>
            <p><strong>Value:</strong> ${item.getFormattedValue()}</p>
            <p><strong>Weight:</strong> ${item.weight} lb.</p>
    `;

    // Add weapon-specific properties
    if (item.type === 'weapon') {
        details += `
            <p><strong>Damage:</strong> ${item.getDamageFormula()} ${item.damageType}</p>
            <p><strong>Range:</strong> ${item.getRangeDescription()}</p>
        `;
        if (item.versatile) {
            details += `<p><strong>Versatile:</strong> ${item.getVersatileDamageFormula()}</p>`;
        }
    }

    // Add armor-specific properties
    if (item.type === 'armor') {
        details += `
            <p><strong>Armor Class:</strong> ${item.getACString()}</p>
            <p><strong>Type:</strong> ${item.getArmorTypeDescription()}</p>
        `;
    }

    // Add properties list
    if (item.properties.length > 0) {
        details += `<p><strong>Properties:</strong> ${item.properties.join(', ')}</p>`;
    }

    body.innerHTML = details;
    card.appendChild(body);

    // Add action buttons if requested
    if (showActions) {
        const footer = document.createElement('div');
        footer.className = 'card-footer';

        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group';

        // Equipment button
        if (item.canBeEquipped()) {
            const equipBtn = document.createElement('button');
            equipBtn.className = `btn btn-sm ${item.equipped ? 'btn-secondary equipped' : 'btn-primary'}`;
            equipBtn.textContent = item.equipped ? 'Unequip' : 'Equip';
            equipBtn.onclick = () => item.equipped ?
                window.currentCharacter.equipmentManager.unequipItem(item.id) :
                window.currentCharacter.equipmentManager.equipItem(item.id);
            btnGroup.appendChild(equipBtn);
        }

        // Attunement button
        if (item.canBeAttuned()) {
            const attuneBtn = document.createElement('button');
            attuneBtn.className = `btn btn-sm ${item.attuned ? 'btn-secondary attuned' : 'btn-primary'}`;
            attuneBtn.textContent = item.attuned ? 'Unattune' : 'Attune';
            attuneBtn.onclick = () => item.attuned ?
                window.currentCharacter.equipmentManager.unattuneItem(item.id) :
                window.currentCharacter.equipmentManager.attuneItem(item.id);
            btnGroup.appendChild(attuneBtn);
        }

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm btn-danger';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => window.currentCharacter.equipmentManager.removeItem(item.id, 1);
        btnGroup.appendChild(removeBtn);

        footer.appendChild(btnGroup);
        card.appendChild(footer);
    }

    return card;
}

// Set up equipment page event listeners
function setupEquipmentEventListeners() {
    // Tab switching
    const tabs = document.querySelectorAll('.nav-link[data-section]');

    for (const tab of tabs) {
        tab.addEventListener('click', (e) => {
            // Remove active class from all tabs and sections
            for (const t of tabs) {
                t.classList.remove('active');
            }
            for (const s of document.querySelectorAll('.tab-pane')) {
                s.classList.remove('show', 'active');
            }

            // Add active class to clicked tab and its section
            const section = e.target.dataset.section;
            e.target.classList.add('active');
            document.getElementById(`${section}Section`).classList.add('show', 'active');
        });
    }

    // Update UI after equipment changes
    const observer = new MutationObserver(() => {
        const sections = {
            inventory: document.getElementById('inventorySection'),
            equipped: document.getElementById('equippedSection'),
            attuned: document.getElementById('attunedSection')
        };
        if (Object.values(sections).every(Boolean)) {
            updateEquipmentSections(sections);
        }
    });

    observer.observe(document.querySelector('#pageContent'), {
        childList: true,
        subtree: true
    });
}

// Update class details
async function updateClassDetails(characterClass, subclass) {
    console.log('updateClassDetails called with class:', characterClass, 'subclass:', subclass);

    const classDetails = document.getElementById('classDetails');
    const classImage = document.getElementById('classImage');
    const classQuickDesc = document.getElementById('classQuickDesc');

    if (!classDetails || !classImage || !classQuickDesc) {
        console.error('Class detail elements not found');
        return;
    }

    if (!characterClass) {
        console.log('No class selected, showing default content');
        // Set placeholder image and content
        setClassPlaceholderContent(classImage, classQuickDesc, classDetails);
        return;
    }

    // Get class data
    const classes = await window.dndDataLoader.getClasses();
    const classData = classes.find(c => c.id === characterClass);

    if (!classData) {
        console.log('No class data found, showing default content');
        // Set placeholder image and content
        setClassPlaceholderContent(classImage, classQuickDesc, classDetails);
        return;
    }

    console.log('Class data found:', classData);

    // Get subclass data if available
    let subclassData = null;
    if (subclass && classData.subclasses) {
        subclassData = classData.subclasses.find(sc => sc.id === subclass);
        console.log('Subclass data found:', subclassData);
    }

    // Update class image
    if (classData.imageUrl) {
        console.log('Setting class image from URL:', classData.imageUrl);
        // Create the image element without inline event handlers
        classImage.innerHTML = `<img src="${classData.imageUrl}" alt="${classData.name}" class="class-image-element">`;

        // Add error handler after the image is added to the DOM
        const imgElement = classImage.querySelector('.class-image-element');
        if (imgElement) {
            imgElement.addEventListener('error', function () {
                this.style.display = 'none';
                classImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
            });
        }
    } else {
        console.log('No image URL found, using placeholder');
        classImage.innerHTML = `<i class="fas fa-user-circle placeholder-icon"></i>`;
    }

    // Update quick description
    const descriptionHTML = `<div>${subclassData ? subclassData.description || classData.quickDesc : classData.quickDesc || ''}</div>`;
    classQuickDesc.innerHTML = descriptionHTML;

    // Update detailed information
    classDetails.innerHTML = `
        <div class="class-details-grid">
            <div class="detail-section">
                <h6>Hit Die</h6>
                <p>${classData.hitDie || 'd8'}</p>
            </div>
            <div class="detail-section">
                <h6>Primary Ability</h6>
                <p>${classData.primaryAbility || '—'}</p>
            </div>
            <div class="detail-section">
                <h6>Saving Throw Proficiencies</h6>
                <ul class="mb-0">
                    ${classData.proficiencies?.savingThrows?.length > 0 ?
            classData.proficiencies.savingThrows.map(save => `<li>${save}</li>`).join('') :
            '<li>—</li>'}
                </ul>
            </div>
            <div class="detail-section">
                <h6>Armor Proficiencies</h6>
                <ul class="mb-0">
                    ${classData.proficiencies?.armor?.length > 0 ?
            classData.proficiencies.armor.map(armor => `<li>${armor}</li>`).join('') :
            '<li>—</li>'}
                </ul>
            </div>
            <div class="detail-section">
                <h6>Weapon Proficiencies</h6>
                <ul class="mb-0">
                    ${classData.proficiencies?.weapons?.length > 0 ?
            classData.proficiencies.weapons.map(weapon => `<li>${weapon}</li>`).join('') :
            '<li>—</li>'}
                </ul>
            </div>
            <div class="detail-section">
                <h6>Tool Proficiencies</h6>
                <ul class="mb-0">
                    ${classData.proficiencies?.tools?.length > 0 ?
            classData.proficiencies.tools.map(tool => `<li>${tool}</li>`).join('') :
            '<li>—</li>'}
                </ul>
            </div>
        </div>`;

    // Recalculate bonuses and proficiencies
    calculateBonusesAndProficiencies();
    setupAbilityScores();
    setupProficiencies();
}

// Helper function to set placeholder content for class
function setClassPlaceholderContent(classImage, classQuickDesc, classDetails) {
    console.log('Setting class placeholder content');

    // Set placeholder image
    classImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';

    // Set placeholder quick description
    classQuickDesc.innerHTML = `
        <div class="placeholder-content">
            <h5>Select a Class</h5>
            <p>Choose a class to see details about their abilities, proficiencies, and other characteristics.</p>
        </div>`;

    // Set placeholder details
    classDetails.innerHTML = `
        <div class="class-details-grid">
            <div class="detail-section">
                <h6>Hit Die</h6>
                <p class="placeholder-text">—</p>
            </div>
            <div class="detail-section">
                <h6>Primary Ability</h6>
                <p class="placeholder-text">—</p>
            </div>
            <div class="detail-section">
                <h6>Saving Throw Proficiencies</h6>
                <ul class="mb-0">
                    <li class="placeholder-text">—</li>
                </ul>
            </div>
            <div class="detail-section">
                <h6>Armor Proficiencies</h6>
                <ul class="mb-0">
                    <li class="placeholder-text">—</li>
                </ul>
            </div>
            <div class="detail-section">
                <h6>Weapon Proficiencies</h6>
                <ul class="mb-0">
                    <li class="placeholder-text">—</li>
                </ul>
            </div>
            <div class="detail-section">
                <h6>Tool Proficiencies</h6>
                <ul class="mb-0">
                    <li class="placeholder-text">—</li>
                </ul>
            </div>
        </div>`;
}

/**
 * Manages race-related functionality for a character
 */
// RaceManager class is defined in race-manager.js

/**
 * Initialize race selection
 */
async function initializeRaceSelection() {
    const raceSelect = document.getElementById('raceSelect');
    const subraceSelect = document.getElementById('subraceSelect');

    if (!raceSelect || !subraceSelect) return;

    try {
        // Load races
        const races = await window.dndDataLoader.loadRaces();

        // Populate race select
        raceSelect.innerHTML = `
        <option value="">Choose a race...</option>
            ${races.map(race => `
            <option value="${race.id}">${race.name}</option>
        `).join('')
            }
    `;

        // Handle race selection
        raceSelect.addEventListener('change', async () => {
            const raceId = raceSelect.value;

            // Clear subrace selection
            subraceSelect.innerHTML = '<option value="">Choose a subrace...</option>';
            subraceSelect.disabled = true;

            if (!raceId) {
                // Clear race selection
                await currentCharacter.race.setRace(null);
                updateRaceDisplay();
                return;
            }

            // Get selected race
            const race = races.find(r => r.id === raceId);
            if (!race) return;

            // Update subrace options if available
            if (race.subraces?.length > 0) {
                subraceSelect.innerHTML = `
        <option value="">Choose a subrace...</option>
            ${race.subraces.map(subrace => `
                    <option value="${subrace.id}">${subrace.name}</option>
                `).join('')
                    }
    `;
                subraceSelect.disabled = false;
            }

            // Set race
            await currentCharacter.race.setRace(raceId);
            updateRaceDisplay();

            // Show ability score choices if any
            checkRaceAbilityChoices();
        });

        // Handle subrace selection
        subraceSelect.addEventListener('change', async () => {
            const raceId = raceSelect.value;
            const subraceId = subraceSelect.value;

            if (!raceId) return;

            // Set race with subrace
            await currentCharacter.race.setRace(raceId, subraceId);
            updateRaceDisplay();

            // Show ability score choices if any
            checkRaceAbilityChoices();
        });

        // Initialize with current race if any
        if (currentCharacter.race.selectedRace) {
            const race = races.find(r => r.id === currentCharacter.race.selectedRace.id);
            if (race) {
                raceSelect.value = race.id;

                if (race.subraces?.length > 0) {
                    subraceSelect.innerHTML = `
        <option value="">Choose a subrace...</option>
            ${race.subraces.map(subrace => `
                        <option value="${subrace.id}">${subrace.name}</option>
                    `).join('')
                        }
    `;
                    subraceSelect.disabled = false;

                    if (currentCharacter.race.selectedSubrace) {
                        subraceSelect.value = currentCharacter.race.selectedSubrace.id;
                    }
                }
            }
            updateRaceDisplay();
        }
    } catch (error) {
        console.error('Error initializing race selection:', error);
        window.showNotification('Error loading races', 'danger');
    }
}

/**
 * Update race display
 */
async function updateRaceDisplay() {
    const raceDetails = document.getElementById('raceDetails');
    const raceQuickDesc = document.getElementById('raceQuickDesc');

    if (!raceDetails || !raceQuickDesc) return;

    try {
        const race = currentCharacter.race.selectedRace;
        if (!race) {
            raceDetails.innerHTML = '<p class="text-muted">No race selected</p>';
            raceQuickDesc.innerHTML = '';
            return;
        }

        // Update quick description
        raceQuickDesc.innerHTML = `
        <h6>Quick Info</h6>
            <p>${race.description || 'No description available.'}</p>
    `;

        // Create race card
        const card = new EntityCard(raceDetails, race, currentCharacter.race);
        raceDetails.innerHTML = card.render();

        // Show subrace details if selected
        if (currentCharacter.race.selectedSubrace) {
            const subraceCard = new EntityCard(
                raceDetails,
                currentCharacter.race.selectedSubrace,
                currentCharacter.race
            );
            raceDetails.innerHTML += subraceCard.render();
        }
    } catch (error) {
        console.error('Error updating race display:', error);
        window.showNotification('Error displaying race details', 'danger');
    }
}

/**
 * Check for and handle race ability score choices
 */
function checkRaceAbilityChoices() {
    if (!currentCharacter.race.hasPendingChoices()) return;

    const choices = currentCharacter.race.getPendingChoices();
    for (const [source, choice] of Object.entries(choices)) {
        showAbilityChoiceDialog(choice, source);
    }
}

/**
 * Show dialog for ability score choices
 */
function showAbilityChoiceDialog(choice, source) {
    // Create modal dynamically
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'abilityChoiceModal';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Choose Ability Scores</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Choose ${choice.count} abilities to increase by ${choice.amount}:</p>
                    <form id="abilityChoiceForm">
                        ${choice.from.map(ability => `
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" 
                                name="ability" value="${ability}" id="ability_${ability}">
                            <label class="form-check-label" for="ability_${ability}">
                                ${ability}
                            </label>
                        </div>
                    `).join('')}
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" id="confirmAbilityChoices">
                        Confirm
                    </button>
                </div>
            </div>
        </div>`;

    // Add modal to document
    document.body.appendChild(modal);

    // Initialize Bootstrap modal
    const modalInstance = new bootstrap.Modal(modal);

    // Handle form submission
    const form = modal.querySelector('#abilityChoiceForm');
    const confirmBtn = modal.querySelector('#confirmAbilityChoices');

    confirmBtn.addEventListener('click', () => {
        const selected = Array.from(form.querySelectorAll('input:checked'))
            .map(input => input.value);

        if (selected.length !== choice.count) {
            window.showNotification(
                `Please select exactly ${choice.count} abilities`,
                'warning'
            );
            return;
        }

        // Create choices object
        const choices = {};
        for (const ability of selected) {
            choices[ability] = choice.amount;
        }

        // Apply choices
        if (currentCharacter.race.applyAbilityChoices(choices, source)) {
            modalInstance.hide();
            modal.addEventListener('hidden.bs.modal', () => {
                modal.remove();
            });
        }
    });

    // Show modal
    modalInstance.show();
}

// Import class manager
import { ClassManager } from './core/managers/ClassManager.js';
import { SpellManager } from './core/managers/SpellManager.js';
import { EquipmentManager } from './core/managers/EquipmentManager.js';
import { EquipmentService } from './core/services/EquipmentService.js';

// Initialize managers
currentCharacter.class = new ClassManager(currentCharacter);
currentCharacter.spells = new SpellManager(currentCharacter);
currentCharacter.equipment = new EquipmentManager(currentCharacter);

// Initialize equipment service
window.equipmentService = new EquipmentService(window.dndDataLoader);

// Equipment management forwarding functions
async function addItem(itemId, quantity = 1) {
    if (!currentCharacter.equipment) {
        currentCharacter.equipment = new EquipmentManager(currentCharacter);
    }
    return await currentCharacter.equipment.addItem(itemId, quantity);
}

function removeItem(itemId, quantity = 1) {
    if (!currentCharacter.equipment) return false;
    return currentCharacter.equipment.removeItem(itemId, quantity);
}

function equipItem(itemId, slot = null) {
    if (!currentCharacter.equipment) return false;
    return currentCharacter.equipment.equipItem(itemId, slot);
}

function unequipItem(itemId) {
    if (!currentCharacter.equipment) return false;
    return currentCharacter.equipment.unequipItem(itemId);
}

function attuneItem(itemId) {
    if (!currentCharacter.equipment) return false;
    return currentCharacter.equipment.attuneItem(itemId);
}

function unattuneItem(itemId) {
    if (!currentCharacter.equipment) return false;
    return currentCharacter.equipment.unattuneItem(itemId);
}

function getEquippedItems() {
    if (!currentCharacter.equipment) return [];
    return currentCharacter.equipment.getEquippedItems();
}

function getAttunedItems() {
    if (!currentCharacter.equipment) return [];
    return currentCharacter.equipment.getAttunedItems();
}

function getInventoryWeight() {
    if (!currentCharacter.equipment) return 0;
    return currentCharacter.equipment.getInventoryWeight();
}

// Make equipment functions available globally
Object.assign(window, {
    addItem,
    removeItem,
    equipItem,
    unequipItem,
    attuneItem,
    unattuneItem,
    getEquippedItems,
    getAttunedItems,
    getInventoryWeight
});

// Initialize tooltips
tooltipManager.initialize();

// Make services available globally
window.packService = packService;
window.equipmentChoiceService = equipmentChoiceService;