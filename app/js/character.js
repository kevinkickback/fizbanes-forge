// Remove UUID require and use window.electron
// const { v4: uuidv4 } = require('uuid');

// Character state
let currentCharacter = {
    id: null,
    name: '',
    playerName: '',
    race: '',
    subrace: '',
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
        strength: 0,
        dexterity: 0,
        constitution: 0,
        intelligence: 0,
        wisdom: 0,
        charisma: 0
    },
    bonusSources: [],
    proficiencies: {
        skills: [],
        tools: [],
        languages: ['Common'], // Default language
        armor: [],
        weapons: ['Simple Weapons'], // Default simple weapons proficiency
        savingThrows: []
    },
    proficiencySources: [
        {
            type: 'languages',
            proficiency: 'Common',
            source: 'Default'
        },
        {
            type: 'weapons',
            proficiency: 'Simple Weapons',
            source: 'Default'
        }
    ],
    optionalProficiencies: {
        skills: { allowed: 0, selected: [] },
        languages: { allowed: 0, selected: [] },
        tools: { allowed: 0, selected: [] },
        armor: { allowed: 0, selected: [] },
        weapons: { allowed: 0, selected: [] }
    },
    savedOptionalProficiencies: null,
    height: '',
    weight: '',
    gender: '',
    backstory: '',
    equipment: {
        weapons: [],
        armor: [],
        items: []
    },
    racialTraits: [],
    features: {
        darkvision: 0,
        speed: 30,
        spells: []
    }
};

// Track if there are unsaved changes
const hasUnsavedChanges = {
    value: false
};

// Make currentCharacter available globally
window.currentCharacter = currentCharacter;

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
    await populateSelects();
    await calculateBonusesAndProficiencies();
    setupAbilityScores();
    setupProficiencies();

    // Initialize skeleton details for race, class, and background
    initializeSkeletonDetails();

    // Add direct event listener for race select
    const raceSelect = document.getElementById('raceSelect');
    if (raceSelect) {
        // Remove any existing event listeners by cloning the element
        const oldElement = raceSelect;
        const newElement = oldElement.cloneNode(true);
        oldElement.parentNode.replaceChild(newElement, oldElement);

        newElement.addEventListener('change', async function () {
            const selectedRace = this.value;
            currentCharacter.race = selectedRace;
            currentCharacter.subrace = ''; // Reset subrace when race changes

            // Update the subrace dropdown
            await populateSubraces(selectedRace);

            // Update race details
            await updateRaceDetails(selectedRace, currentCharacter.subrace);

            // Recalculate bonuses and update displays
            await calculateBonusesAndProficiencies();
            setupAbilityScores();
            setupProficiencies();

            // Show unsaved changes indicator
            showUnsavedChangesIndicator();
        });
    }

    // We don't need to add a direct event listener for subrace select anymore
    // as it's now handled in the populateSubraces function

    // Add direct event listener for class select
    const classSelect = document.getElementById('classSelect');
    if (classSelect) {
        classSelect.addEventListener('change', async function () {
            const selectedClass = this.value;
            currentCharacter.class = selectedClass;
            currentCharacter.subclass = ''; // Reset subclass when class changes

            // Update the subclass dropdown
            await populateSubclasses(selectedClass);

            // Update class details
            await updateClassDetails(selectedClass, '');

            // Recalculate optional proficiencies and update proficiency display
            await calculateOptionalProficiencies();
            setupProficiencies();

            // Show unsaved changes indicator
            showUnsavedChangesIndicator();
        });
    }

    // Add direct event listener for subclass select
    const subclassSelect = document.getElementById('subclassSelect');
    if (subclassSelect) {
        subclassSelect.addEventListener('change', async function () {
            const selectedSubclass = this.value;
            currentCharacter.subclass = selectedSubclass;

            // Update class details with subclass
            await updateClassDetails(currentCharacter.class, selectedSubclass);

            // Recalculate bonuses and update displays
            await calculateBonusesAndProficiencies();
            setupAbilityScores();
            setupProficiencies();

            // Show unsaved changes indicator
            showUnsavedChangesIndicator();
        });
    }

    // Add direct event listener for background select
    const backgroundSelect = document.getElementById('backgroundSelect');
    if (backgroundSelect) {
        backgroundSelect.addEventListener('change', async function () {
            const selectedBackground = this.value;
            currentCharacter.background = selectedBackground;

            // Update background details
            await updateBackgroundDetails(selectedBackground);

            // Recalculate optional proficiencies and update proficiency display
            await calculateOptionalProficiencies();
            setupProficiencies();

            // Do not save automatically
        });
    }

    if (currentCharacter.id) {
        await populateForm(currentCharacter);
    } else {
        // Initialize with empty race details to ensure consistent layout
        await updateRaceDetails('', '');
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
    const weaponsList = document.getElementById('weaponsList');
    const armorList = document.getElementById('armorList');

    if (weaponsList && armorList) {
        try {
            // Load items data
            const itemsData = await window.dndDataLoader.loadItems();

            // Get weapons and armor from the items data
            const weapons = Object.values(itemsData.base.item || {})
                .filter(item => item.type === 'M' || item.type === 'R') // Melee or Ranged weapons
                .map(weapon => ({
                    id: weapon.name.toLowerCase().replace(/\s+/g, '-'),
                    name: weapon.name,
                    damage: weapon.dmg1 || '—',
                    damageType: weapon.dmgType || '—',
                    properties: weapon.property || []
                }));

            const armors = Object.values(itemsData.base.item || {})
                .filter(item => item.type === 'LA' || item.type === 'MA' || item.type === 'HA' || item.type === 'S') // Light, Medium, Heavy Armor or Shield
                .map(armor => ({
                    id: armor.name.toLowerCase().replace(/\s+/g, '-'),
                    name: armor.name,
                    ac: armor.ac ? (armor.type === 'S' ? `+${armor.ac}` : armor.ac.toString()) : '—',
                    type: armor.type === 'LA' ? 'Light' :
                        armor.type === 'MA' ? 'Medium' :
                            armor.type === 'HA' ? 'Heavy' :
                                armor.type === 'S' ? 'Shield' : '—'
                }));

            // Populate weapons list
            weaponsList.innerHTML = weapons.map(weapon => `
                <div class="equipment-item" data-type="weapons" data-item-id="${weapon.id}">
                    <div>
                        <strong>${weapon.name}</strong>
                        <div class="text-muted small">Damage: ${weapon.damage} ${weapon.damageType}</div>
                    </div>
                    <button class="btn btn-sm btn-outline-primary toggle-equipment" data-type="weapons" data-item-id="${weapon.id}">
                        ${currentCharacter.equipment.weapons.includes(weapon.id) ? 'Remove' : 'Add'}
                    </button>
                </div>
            `).join('');

            // Populate armor list
            armorList.innerHTML = armors.map(armor => `
                <div class="equipment-item" data-type="armor" data-item-id="${armor.id}">
                    <div>
                        <strong>${armor.name}</strong>
                        <div class="text-muted small">AC: ${armor.ac} (${armor.type})</div>
                    </div>
                    <button class="btn btn-sm btn-outline-primary toggle-equipment" data-type="armor" data-item-id="${armor.id}">
                        ${currentCharacter.equipment.armor.includes(armor.id) ? 'Remove' : 'Add'}
                    </button>
                </div>
            `).join('');

            // Add event listeners for equipment toggle buttons
            const toggleButtons = document.querySelectorAll('.toggle-equipment');
            for (const button of toggleButtons) {
                button.addEventListener('click', function () {
                    const type = this.getAttribute('data-type');
                    const itemId = this.getAttribute('data-item-id');
                    toggleEquipment(type, itemId);
                });
            }
        } catch (error) {
            console.error('Error loading equipment data:', error);
            weaponsList.innerHTML = '<div class="alert alert-danger">Error loading weapons data</div>';
            armorList.innerHTML = '<div class="alert alert-danger">Error loading armor data</div>';
        }
    }
}

// Initialize details page
function initializeDetailsPage() {
    if (currentCharacter.id) {
        // Populate the form with current character data
        populateForm(currentCharacter);

        // Add event listeners to form fields
        const detailsFields = ['characterName', 'playerName', 'height', 'weight', 'gender', 'backstory'];
        for (const fieldId of detailsFields) {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', updateCharacterField);
            }
        }
    }
}

// Initialize preview page
function initializePreviewPage() {
    if (currentCharacter.id) {
        generatePreview();
    }
}

// Populate select elements with D&D data
async function populateSelects() {
    console.log('Populating select elements with D&D data...');
    try {
        // Load race, class, and background data
        console.log('Loading race data...');
        const races = await window.dndDataLoader.getRaces();
        console.log(`Loaded ${races.length} races`);

        console.log('Loading class data...');
        const classes = await window.dndDataLoader.getClasses();
        console.log(`Loaded ${classes.length} classes`);

        console.log('Loading background data...');
        const backgrounds = await window.dndDataLoader.getBackgrounds();
        console.log(`Loaded ${backgrounds.length} backgrounds`);

        // Populate race select
        const raceSelect = document.getElementById('raceSelect');
        if (raceSelect) {
            console.log('Populating race select...');
            raceSelect.innerHTML = `<option value="">Select Race</option>${races.map(race =>
                `<option value="${race.id}" ${currentCharacter.race === race.id ? 'selected' : ''}>${race.name}</option>`
            ).join('')}`;
            console.log('Race select populated');
        } else {
            console.warn('Race select element not found');
        }

        // Populate subrace select if race is selected
        if (currentCharacter.race) {
            console.log(`Populating subraces for ${currentCharacter.race}...`);
            await populateSubraces(currentCharacter.race);
        }

        // Populate class select
        const classSelect = document.getElementById('classSelect');
        if (classSelect) {
            console.log('Populating class select...');
            classSelect.innerHTML = `<option value="">Select Class</option>${classes.map(cls =>
                `<option value="${cls.id}" ${currentCharacter.class === cls.id ? 'selected' : ''}>${cls.name}</option>`
            ).join('')}`;
            console.log('Class select populated');
        } else {
            console.warn('Class select element not found');
        }

        // Populate subclass select if class is selected
        if (currentCharacter.class) {
            console.log(`Populating subclasses for ${currentCharacter.class}...`);
            await populateSubclasses(currentCharacter.class);
        }

        // Populate background select
        const backgroundSelect = document.getElementById('backgroundSelect');
        if (backgroundSelect) {
            console.log('Populating background select...');
            backgroundSelect.innerHTML = `<option value="">Select Background</option>${backgrounds.map(bg =>
                `<option value="${bg.id}" ${currentCharacter.background === bg.id ? 'selected' : ''}>${bg.name}</option>`
            ).join('')}`;
            console.log('Background select populated');
        } else {
            console.warn('Background select element not found');
        }

        console.log('All select elements populated successfully');
    } catch (error) {
        console.error('Error populating select elements:', error);
    }
}

// Populate subraces based on selected race
async function populateSubraces(race) {
    const subraceSelect = document.getElementById('subraceSelect');
    if (!subraceSelect) {
        console.error('Subrace select element not found');
        return;
    }

    // Clear existing options
    subraceSelect.innerHTML = '';

    // Get race data
    const races = await window.dndDataLoader.getRaces();
    const raceData = races.find(r => r.id === race);

    if (!raceData) {
        console.error('Race data not found for:', race);
        subraceSelect.disabled = true;
        subraceSelect.innerHTML = '<option value="">Select Race First</option>';
        return;
    }

    // Check if race has variants (subraces/lineages/legacies)
    if (raceData.subraces && raceData.subraces.length > 0) {
        // Enable the subrace select
        subraceSelect.disabled = false;

        // Add a "Base Race" option
        const baseOption = document.createElement('option');
        baseOption.value = race;
        baseOption.textContent = `Base ${raceData.name}`;
        subraceSelect.appendChild(baseOption);

        // Add all variants directly to the select
        for (const variant of raceData.subraces) {
            const option = document.createElement('option');
            option.value = variant.id;
            option.textContent = variant.name;
            subraceSelect.appendChild(option);
        }

        // Select the first option by default if no subrace is currently selected
        if (!currentCharacter.subrace) {
            // Temporarily remove the change event listener to prevent multiple calls
            const oldElement = subraceSelect;
            const newElement = oldElement.cloneNode(true);
            oldElement.parentNode.replaceChild(newElement, oldElement);

            // Set the value and update the character's subrace
            const firstVariant = raceData.subraces[0];
            newElement.value = firstVariant.id;
            currentCharacter.subrace = firstVariant.id;

            // Update race details with the selected subrace
            updateRaceDetails(race, currentCharacter.subrace);

            // Recalculate bonuses and update ability scores
            calculateBonusesAndProficiencies();
            setupAbilityScores();
            setupProficiencies();

            // Re-add the event listener
            newElement.addEventListener('change', function () {
                const selectedSubrace = this.value;
                currentCharacter.subrace = selectedSubrace;
                updateRaceDetails(currentCharacter.race, selectedSubrace);
                calculateBonusesAndProficiencies();
                setupAbilityScores();
                setupProficiencies();
                showUnsavedChangesIndicator();
            });
        } else {
            // Restore previously selected subrace
            subraceSelect.value = currentCharacter.subrace;
        }
    } else {
        // No variants available
        subraceSelect.disabled = true;
        const option = document.createElement('option');
        option.value = race;
        option.textContent = 'No variants available';
        subraceSelect.appendChild(option);
    }
}

// Populate subclasses based on selected class
async function populateSubclasses(characterClass) {
    const subclassSelect = document.getElementById('subclassSelect');
    if (subclassSelect) {
        subclassSelect.innerHTML = '';

        // Get class data
        const classes = await window.dndDataLoader.getClasses();
        const classData = classes.find(c => c.id === characterClass);

        if (characterClass && classData && classData.subclasses && classData.subclasses.length > 0) {
            // Enable the subclass select
            subclassSelect.disabled = false;

            // Add subclass options
            const subclasses = classData.subclasses;

            // If there are subclasses, add them to the dropdown
            if (subclasses.length > 0) {
                let firstOption = null;

                for (const subclass of subclasses) {
                    const option = document.createElement('option');
                    option.value = subclass.id;
                    option.textContent = subclass.name;
                    subclassSelect.appendChild(option);

                    if (!firstOption) {
                        firstOption = subclass.id;
                    }
                }

                // Select the first option by default
                if (firstOption) {
                    subclassSelect.value = firstOption;

                    // Update the character's subclass
                    currentCharacter.subclass = firstOption;

                    // Update class details with the selected subclass
                    updateClassDetails(characterClass, firstOption);

                    // Recalculate bonuses and proficiencies
                    calculateBonusesAndProficiencies();
                    setupProficiencies();

                    // Dispatch change event to update character data
                    subclassSelect.dispatchEvent(new Event('change'));
                }
            } else {
                // No subclasses available
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No subclasses available';
                subclassSelect.appendChild(option);
                subclassSelect.disabled = true;
            }
        } else {
            // Disable the subclass select if no class is selected
            subclassSelect.disabled = true;
            subclassSelect.innerHTML = '<option value="">Select Class First</option>';
        }
    }
}

// Calculate ability score bonuses and proficiencies from race, class, and background
async function calculateBonusesAndProficiencies() {
    // Reset bonuses and proficiencies
    currentCharacter.abilityBonuses = {
        strength: 0,
        dexterity: 0,
        constitution: 0,
        intelligence: 0,
        wisdom: 0,
        charisma: 0
    };
    currentCharacter.bonusSources = [];

    currentCharacter.proficiencies = {
        skills: [],
        tools: [],
        languages: ['Common'], // Default language
        armor: [],
        weapons: ['Simple Weapons'], // Default simple weapons proficiency
        savingThrows: []
    };
    currentCharacter.proficiencySources = [
        {
            type: 'languages',
            proficiency: 'Common',
            source: 'Default'
        },
        {
            type: 'weapons',
            proficiency: 'Simple Weapons',
            source: 'Default'
        }
    ];

    // Initialize racial traits and features
    if (!currentCharacter.racialTraits) {
        currentCharacter.racialTraits = [];
    }

    if (!currentCharacter.features) {
        currentCharacter.features = {
            darkvision: 0,
            speed: 30,
            spells: []
        };
    } else {
        // Reset features
        currentCharacter.features.darkvision = 0;
        currentCharacter.features.speed = 30;
        currentCharacter.features.spells = [];
    }

    // Load data
    const races = await window.dndDataLoader.getRaces();
    const classes = await window.dndDataLoader.getClasses();
    const backgrounds = await window.dndDataLoader.getBackgrounds();

    // Process race bonuses and proficiencies
    if (currentCharacter.race) {
        const raceData = races.find(r => r.id === currentCharacter.race);
        if (raceData) {
            const isHuman = currentCharacter.race === 'human';
            const hasSubrace = currentCharacter.subrace && raceData.subraces && raceData.subraces.some(sr => sr.id === currentCharacter.subrace);
            const subraceData = hasSubrace ? raceData.subraces.find(sr => sr.id === currentCharacter.subrace) : null;

            // For humans, we'll handle ability score increases differently based on subrace
            if (!isHuman && raceData.ability) {
                // Process race ability score increases
                for (const [ability, value] of Object.entries(raceData.ability)) {
                    if (ability && value) {
                        const abilityKey = ability.toLowerCase();
                        if (Object.prototype.hasOwnProperty.call(currentCharacter.abilityBonuses, abilityKey)) {
                            currentCharacter.abilityBonuses[abilityKey] += value;
                            currentCharacter.bonusSources.push({
                                ability: abilityKey,
                                bonus: value,
                                source: `${raceData.name} race`
                            });
                        }
                    }
                }
            }

            // Process languages
            if (raceData.languages && raceData.languages.length > 0) {
                for (const language of raceData.languages) {
                    addProficiency('languages', language, `${raceData.name} race`);
                }
            }

            // Process base race traits
            if (raceData.traits && raceData.traits.length > 0) {
                for (const trait of raceData.traits) {
                    // Add to racial traits list
                    currentCharacter.racialTraits.push({
                        name: trait.name,
                        description: trait.description,
                        source: `${raceData.name} race`
                    });

                    // Process special traits
                    processSpecialTrait(trait, raceData.name);
                }
            }

            // Set base movement speed
            if (raceData.speed) {
                currentCharacter.features.speed = raceData.speed;
            }

            // Process subrace bonuses if applicable
            if (subraceData) {
                // For humans, explicitly process the subrace ability score increases
                if (isHuman && subraceData.ability) {
                    for (const [ability, value] of Object.entries(subraceData.ability)) {
                        if (ability && value) {
                            const abilityKey = ability.toLowerCase();
                            if (Object.prototype.hasOwnProperty.call(currentCharacter.abilityBonuses, abilityKey)) {
                                currentCharacter.abilityBonuses[abilityKey] += value;
                                currentCharacter.bonusSources.push({
                                    ability: abilityKey,
                                    bonus: value,
                                    source: `${subraceData.name} subrace`
                                });
                            }
                        }
                    }
                } else if (subraceData.ability) {
                    // For non-humans, process as normal
                    for (const [ability, value] of Object.entries(subraceData.ability)) {
                        if (ability && value) {
                            const abilityKey = ability.toLowerCase();
                            if (Object.prototype.hasOwnProperty.call(currentCharacter.abilityBonuses, abilityKey)) {
                                currentCharacter.abilityBonuses[abilityKey] += value;
                                currentCharacter.bonusSources.push({
                                    ability: abilityKey,
                                    bonus: value,
                                    source: `${subraceData.name} subrace`
                                });
                            }
                        }
                    }
                }

                // Process subrace traits
                if (subraceData.traits && subraceData.traits.length > 0) {
                    for (const trait of subraceData.traits) {
                        // Add to racial traits list
                        currentCharacter.racialTraits.push({
                            name: trait.name,
                            description: trait.description,
                            source: `${subraceData.name} subrace`
                        });

                        // Process special traits
                        processSpecialTrait(trait, subraceData.name);
                    }
                }

                // Override speed if subrace has a specific speed
                if (subraceData.speed) {
                    currentCharacter.features.speed = subraceData.speed;
                }
            }
        }
    }

    // Process class proficiencies
    if (currentCharacter.class) {
        const classData = classes.find(c => c.id === currentCharacter.class);
        if (classData) {
            const className = classData.name;

            // Saving throws
            if (classData.proficiencies?.savingThrows?.length > 0) {
                for (const save of classData.proficiencies.savingThrows) {
                    addProficiency('savingThrows', save, `${className} class`);
                }
            }

            // Armor proficiencies
            if (classData.proficiencies?.armor?.length > 0) {
                for (const armor of classData.proficiencies.armor) {
                    addProficiency('armor', armor, `${className} class`);
                }
            }

            // Weapon proficiencies
            if (classData.proficiencies?.weapons?.length > 0) {
                for (const weapon of classData.proficiencies.weapons) {
                    addProficiency('weapons', weapon, `${className} class`);
                }
            }

            // Skill proficiencies
            if (classData.proficiencies?.skills?.length > 0) {
                for (const skill of classData.proficiencies.skills) {
                    if (typeof skill === 'string') {
                        addProficiency('skills', skill, `${className} class`);
                    } else if (skill.choose) {
                        // Handle skill choices
                        currentCharacter.optionalProficiencies.skills.allowed = skill.choose;
                        currentCharacter.optionalProficiencies.skills.from = skill.from;
                    }
                }
            }

            // Process subclass bonuses if applicable
            if (currentCharacter.subclass) {
                const subclassData = classData.subclasses.find(sc => sc.id === currentCharacter.subclass);
                if (subclassData) {
                    // Add any subclass-specific proficiencies here if needed
                }
            }
        }
    }

    // Process background proficiencies
    if (currentCharacter.background) {
        const backgroundData = backgrounds.find(bg => bg.id === currentCharacter.background);
        if (backgroundData) {
            const bgName = backgroundData.name;

            // Skill proficiencies
            if (backgroundData.skillProficiencies && backgroundData.skillProficiencies.length > 0) {
                for (const skill of backgroundData.skillProficiencies) {
                    addProficiency('skills', skill, `${bgName} background`);
                }
            }

            // Tool proficiencies
            if (backgroundData.toolProficiencies && backgroundData.toolProficiencies.length > 0) {
                for (const tool of backgroundData.toolProficiencies) {
                    addProficiency('tools', tool, `${bgName} background`);
                }
            }

            // Languages
            if (backgroundData.languages && backgroundData.languages.length > 0) {
                for (const language of backgroundData.languages) {
                    addProficiency('languages', language, `${bgName} background`);
                }
            }
        }
    }

    // Add optional proficiencies that the user has selected
    addOptionalProficiencies();

    // Update the UI with the new proficiencies
    updateAbilityBonusesNotes();
    updateProficiencyNotes();
}

// Process special traits like darkvision, skill proficiencies, etc.
function processSpecialTrait(trait, sourceName) {
    // Process darkvision
    if (trait.name === 'Darkvision') {
        currentCharacter.features.darkvision = 60;
    } else if (trait.name === 'Superior Darkvision') {
        currentCharacter.features.darkvision = 120;
    }

    // Process skill proficiencies
    if (trait.name === 'Keen Senses') {
        addProficiency('skills', 'Perception', sourceName);
    }

    // Process weapon proficiencies
    if (trait.name === 'Dwarven Combat Training') {
        addProficiency('weapons', 'Battleaxe', sourceName);
        addProficiency('weapons', 'Handaxe', sourceName);
        addProficiency('weapons', 'Light Hammer', sourceName);
        addProficiency('weapons', 'Warhammer', sourceName);
    }

    // Process armor proficiencies
    if (trait.name === 'Dwarven Armor Training') {
        addProficiency('armor', 'Light Armor', sourceName);
        addProficiency('armor', 'Medium Armor', sourceName);
    }
}

// Add optional proficiencies that the user has selected
function addOptionalProficiencies() {
    if (currentCharacter.optionalProficiencies) {
        const types = ['skills', 'languages', 'tools', 'armor', 'weapons'];

        for (const type of types) {
            if (currentCharacter.optionalProficiencies[type]?.selected) {
                for (const prof of currentCharacter.optionalProficiencies[type].selected) {
                    // Only add if not already proficient
                    if (!currentCharacter.proficiencies[type].includes(prof)) {
                        addProficiency(type, prof, 'Optional selection');
                    }
                }
            }
        }
    }
}

// Process ability score increase text and update bonuses
function processAbilityScoreIncrease(increaseText, source) {
    // Special case for standard human
    if (increaseText === 'All ability scores increase by 1') {
        // Add +1 to all ability scores
        for (const ability of ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']) {
            currentCharacter.abilityBonuses[ability] += 1;
        }

        // Add a single source entry for all abilities
        currentCharacter.bonusSources.push({
            ability: 'all',
            bonus: 1,
            source: source
        });
        return;
    }

    // Special case for variant human - this will be handled in the UI to let the user choose
    if (increaseText === 'Two different ability scores of your choice increase by 1') {
        // This is handled separately in the UI
        // We'll add a note to the ability bonuses notes section
        return;
    }

    // Parse ability score increases like "Strength +2, Charisma +1"
    const increases = increaseText.split(',').map(item => item.trim());

    for (const increase of increases) {
        const match = increase.match(/(\w+)\s*\+(\d+)/i);
        if (match) {
            const ability = match[1].toLowerCase();
            const bonus = Number.parseInt(match[2], 10);

            // Map ability name to our property names
            const abilityMap = {
                'strength': 'strength',
                'str': 'strength',
                'dexterity': 'dexterity',
                'dex': 'dexterity',
                'constitution': 'constitution',
                'con': 'constitution',
                'intelligence': 'intelligence',
                'int': 'intelligence',
                'wisdom': 'wisdom',
                'wis': 'wisdom',
                'charisma': 'charisma',
                'cha': 'charisma'
            };

            const abilityKey = abilityMap[ability];
            if (abilityKey && Object.prototype.hasOwnProperty.call(currentCharacter.abilityBonuses, abilityKey)) {
                currentCharacter.abilityBonuses[abilityKey] += bonus;
                currentCharacter.bonusSources.push({
                    ability: abilityKey,
                    bonus: bonus,
                    source: source
                });
            }
        }
    }
}

// Add a proficiency with its source
function addProficiency(type, proficiency, source) {
    if (!currentCharacter.proficiencies[type].includes(proficiency)) {
        currentCharacter.proficiencies[type].push(proficiency);
        currentCharacter.proficiencySources.push({
            type: type,
            proficiency: proficiency,
            source: source
        });
    }
}

// Update ability bonuses notes in the UI
function updateAbilityBonusesNotes() {
    const notesContainer = document.getElementById('abilityBonusesNotes');
    if (!notesContainer) return;

    // Check if we need to show ability score choice UI
    const hasAbilityChoices = checkForAbilityChoices();

    if (currentCharacter.bonusSources.length === 0 && !hasAbilityChoices) {
        notesContainer.innerHTML = '<p>No ability score bonuses applied.</p>';
        return;
    }

    let notesHTML = '<p><strong>Ability Score Bonuses:</strong></p>';

    // Add ability score choice UI if needed
    if (hasAbilityChoices) {
        renderAbilityChoiceUI(notesHTML, notesContainer);
        return; // renderAbilityChoiceUI handles the rest of the UI
    }

    // Show existing bonuses
    for (const source of currentCharacter.bonusSources) {
        // Special handling for "all" ability bonus
        if (source.ability === 'all') {
            notesHTML += `<div class="bonus-note">+${source.bonus} to all ability scores from ${source.source}</div>`;
        } else {
            const abilityName = source.ability.charAt(0).toUpperCase() + source.ability.slice(1);
            notesHTML += `<div class="bonus-note">+${source.bonus} ${abilityName} from ${source.source}</div>`;
        }
    }

    notesContainer.innerHTML = notesHTML;
}

// Check if the current character has ability choices to make
function checkForAbilityChoices() {
    // Variant Human case
    if (currentCharacter.race === 'human' && currentCharacter.subrace === 'variant') {
        return {
            type: 'variant_human',
            source: 'Variant Human subrace',
            maxSelections: 2,
            bonusValue: 1,
            description: 'As a Variant Human, you can choose two different ability scores to increase by 1:'
        };
    }

    // Add other race/class ability choice cases here
    // Example:
    // if (currentCharacter.race === 'half-elf') {
    //     return {
    //         type: 'half_elf',
    //         source: 'Half-Elf race',
    //         maxSelections: 2,
    //         bonusValue: 1,
    //         description: 'As a Half-Elf, you can choose two different ability scores to increase by 1:'
    //     };
    // }

    // No ability choices needed
    return null;
}

// Render the ability choice UI based on the character's race/class
function renderAbilityChoiceUI(initialHTML, notesContainer) {
    const abilityChoiceConfig = checkForAbilityChoices();
    if (!abilityChoiceConfig) return false;

    // Get currently selected abilities and their bonus values
    const selectedAbilities = currentCharacter.abilityChoices?.[abilityChoiceConfig.type] || [];

    let updatedHTML = `${initialHTML}
        <div class="ability-choices mb-3">
            <p>${abilityChoiceConfig.description}</p>
            <div class="ability-choice-container" id="abilityChoiceContainer" 
                 data-choice-type="${abilityChoiceConfig.type}" 
                 data-max-selections="${abilityChoiceConfig.maxSelections}"
                 data-bonus-value="${abilityChoiceConfig.bonusValue}"
                 data-source="${abilityChoiceConfig.source}">`;

    // Create checkboxes for each ability
    const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
    for (const ability of abilities) {
        const abilityName = ability.charAt(0).toUpperCase() + ability.slice(1);
        const isChecked = selectedAbilities.includes(ability);

        updatedHTML += `
            <div class="form-check form-check-inline">
                <input class="form-check-input ability-choice" type="checkbox" 
                    id="choice-${ability}" value="${ability}" data-ability="${ability}"
                    ${isChecked ? 'checked' : ''} 
                    ${selectedAbilities.length >= abilityChoiceConfig.maxSelections && !isChecked ? 'disabled' : ''}>
                <label class="form-check-label" for="choice-${ability}">${abilityName}</label>
            </div>`;
    }

    updatedHTML += `
            </div>
            <small class="text-muted">Select exactly ${abilityChoiceConfig.maxSelections} different abilities.</small>
        </div>`;

    // Show existing bonuses
    for (const source of currentCharacter.bonusSources) {
        // Skip the bonuses from the current ability choice as they're shown in the UI above
        if (source.source === abilityChoiceConfig.source) continue;

        // Special handling for "all" ability bonus
        if (source.ability === 'all') {
            updatedHTML += `<div class="bonus-note">+${source.bonus} to all ability scores from ${source.source}</div>`;
        } else {
            const abilityName = source.ability.charAt(0).toUpperCase() + source.ability.slice(1);
            updatedHTML += `<div class="bonus-note">+${source.bonus} ${abilityName} from ${source.source}</div>`;
        }
    }

    notesContainer.innerHTML = updatedHTML;

    // Setup event listeners for ability choice checkboxes
    setupAbilityChoiceListeners();

    return true;
}

// Setup event listeners for ability choice checkboxes
function setupAbilityChoiceListeners() {
    console.log("Setting up ability choice listeners");
    const checkboxes = document.querySelectorAll('.ability-choice');
    console.log(`Found ${checkboxes.length} ability choice checkboxes`);

    for (const checkbox of checkboxes) {
        // Remove any existing listeners to prevent duplicates
        checkbox.removeEventListener('change', handleAbilityChoiceChange);
        // Add the event listener
        checkbox.addEventListener('change', handleAbilityChoiceChange);
        console.log(`Added listener to checkbox for ${checkbox.getAttribute('data-ability')}`);
    }
}

// Handle ability choice checkbox changes
function handleAbilityChoiceChange(event) {
    const container = document.getElementById('abilityChoiceContainer');
    if (!container) return;

    const choiceType = container.getAttribute('data-choice-type');
    const maxSelections = Number.parseInt(container.getAttribute('data-max-selections'), 10);
    const bonusValue = Number.parseInt(container.getAttribute('data-bonus-value'), 10);
    const source = container.getAttribute('data-source');

    const checkboxes = document.querySelectorAll('.ability-choice');
    const selectedAbilities = [];

    for (const cb of checkboxes) {
        if (cb.checked) {
            selectedAbilities.push(cb.getAttribute('data-ability'));
        }
    }

    // Limit to maxSelections
    if (selectedAbilities.length > maxSelections) {
        event.target.checked = false;
        return;
    }

    // Enable/disable checkboxes based on selection count
    for (const cb of checkboxes) {
        if (!cb.checked) {
            cb.disabled = selectedAbilities.length >= maxSelections;
        }
    }

    // Initialize abilityChoices if it doesn't exist
    if (!currentCharacter.abilityChoices) {
        currentCharacter.abilityChoices = {};
    }

    // Save the selections
    currentCharacter.abilityChoices[choiceType] = selectedAbilities;

    console.log(`Selected abilities for ${choiceType}:`, selectedAbilities);

    // Update ability bonuses
    updateAbilityChoiceBonuses(choiceType, selectedAbilities, source, bonusValue);

    // Show unsaved changes indicator
    showUnsavedChangesIndicator();
}

// Update ability bonuses based on selected abilities
function updateAbilityChoiceBonuses(choiceType, selectedAbilities, source, bonusValue) {
    console.log(`Updating ${choiceType} bonuses with:`, selectedAbilities);

    // First, remove any existing bonuses from this source
    currentCharacter.bonusSources = currentCharacter.bonusSources.filter(
        existingSource => existingSource.source !== source
    );

    // Reset all ability bonuses to 0
    for (const ability in currentCharacter.abilityBonuses) {
        currentCharacter.abilityBonuses[ability] = 0;
    }

    // Recalculate all bonuses from remaining sources
    for (const bonusSource of currentCharacter.bonusSources) {
        if (bonusSource.ability === 'all') {
            // Handle the "all" ability bonus
            for (const ability in currentCharacter.abilityBonuses) {
                currentCharacter.abilityBonuses[ability] += bonusSource.bonus;
            }
        } else {
            currentCharacter.abilityBonuses[bonusSource.ability] += bonusSource.bonus;
        }
    }

    // Add new bonuses from the selected abilities
    for (const ability of selectedAbilities) {
        currentCharacter.abilityBonuses[ability] += bonusValue;
        currentCharacter.bonusSources.push({
            ability: ability,
            bonus: bonusValue,
            source: source
        });
    }

    console.log("Updated ability bonuses:", currentCharacter.abilityBonuses);

    // Update the ability scores display directly without recreating the UI
    updateAbilityScoreDisplay();
}

// Helper function to update ability score display without recreating the UI
function updateAbilityScoreDisplay() {
    const abilities = [
        { short: 'str', long: 'strength' },
        { short: 'dex', long: 'dexterity' },
        { short: 'con', long: 'constitution' },
        { short: 'int', long: 'intelligence' },
        { short: 'wis', long: 'wisdom' },
        { short: 'cha', long: 'charisma' }
    ];

    for (const ability of abilities) {
        const baseScore = currentCharacter.abilityScores[ability.long];
        const bonus = currentCharacter.abilityBonuses[ability.long];
        const totalScore = baseScore + bonus;

        // Update score and modifier elements if they exist
        const scoreElement = document.getElementById(`${ability.short}Score`);
        const modElement = document.getElementById(`${ability.short}Mod`);

        if (scoreElement) {
            scoreElement.textContent = totalScore;
        }

        if (modElement) {
            modElement.textContent = getModifierString(totalScore);
        }

        // Update or create bonus indicator
        const abilityBox = document.querySelector(`.ability-score-box[data-ability="${ability.short}"]`);
        if (abilityBox) {
            // Remove existing bonus indicator if any
            const existingBonus = abilityBox.querySelector('.bonus');
            if (existingBonus) {
                existingBonus.remove();
            }

            // Add new bonus indicator if needed
            if (bonus !== 0) {
                const bonusElement = document.createElement('div');
                bonusElement.className = `bonus ${bonus < 0 ? 'negative' : ''}`;
                bonusElement.textContent = `${bonus > 0 ? '+' : ''}${bonus}`;
                abilityBox.insertBefore(bonusElement, abilityBox.firstChild);
            }
        }
    }
}

// Update proficiency notes in the UI
function updateProficiencyNotes() {
    const notesContainer = document.getElementById('proficiencyNotes');
    if (!notesContainer) return;

    if (currentCharacter.proficiencySources.length === 0) {
        notesContainer.innerHTML = '<p>No proficiencies applied.</p>';
        return;
    }

    // Group proficiencies by source
    const sourceGroups = {};

    for (const source of currentCharacter.proficiencySources) {
        if (!sourceGroups[source.source]) {
            sourceGroups[source.source] = [];
        }
        sourceGroups[source.source].push({
            type: source.type,
            proficiency: source.proficiency
        });
    }

    let notesHTML = '<p><strong>Proficiency Sources:</strong></p>';

    for (const source in sourceGroups) {
        notesHTML += `<div class="proficiency-note"><strong>${source}:</strong> `;

        const profsByType = {};
        for (const prof of sourceGroups[source]) {
            if (!profsByType[prof.type]) {
                profsByType[prof.type] = [];
            }
            profsByType[prof.type].push(prof.proficiency);
        }

        const typeLabels = {
            'skills': 'Skills',
            'tools': 'Tools',
            'languages': 'Languages',
            'armor': 'Armor',
            'weapons': 'Weapons',
            'savingThrows': 'Saving Throws'
        };

        const profStrings = [];
        for (const type in profsByType) {
            profStrings.push(`${typeLabels[type]}: ${profsByType[type].join(', ')}`);
        }

        notesHTML += profStrings.join('; ');
        notesHTML += '</div>';
    }

    notesContainer.innerHTML = notesHTML;
}

// Setup ability score controls
function setupAbilityScores() {
    const abilities = [
        { short: 'str', long: 'strength' },
        { short: 'dex', long: 'dexterity' },
        { short: 'con', long: 'constitution' },
        { short: 'int', long: 'intelligence' },
        { short: 'wis', long: 'wisdom' },
        { short: 'cha', long: 'charisma' }
    ];

    const container = document.querySelector('.ability-score-container');
    if (container) {
        container.innerHTML = abilities.map(ability => {
            const baseScore = currentCharacter.abilityScores[ability.long];
            const bonus = currentCharacter.abilityBonuses[ability.long];
            const totalScore = baseScore + bonus;
            const bonusDisplay = bonus !== 0 ? `<div class="bonus ${bonus < 0 ? 'negative' : ''}">${bonus > 0 ? '+' : ''}${bonus}</div>` : '';

            return `
                <div class="ability-score-box" data-ability="${ability.short}">
                    ${bonusDisplay}
                    <h6>${ability.long.charAt(0).toUpperCase() + ability.long.slice(1)}</h6>
                    <div class="score" id="${ability.short}Score">${totalScore}</div>
                    <div class="modifier" id="${ability.short}Mod">${getModifierString(totalScore)}</div>
                    <div class="mt-2">
                        <button type="button" class="btn btn-sm btn-secondary decrease-ability" data-ability="${ability.short}">-</button>
                        <button type="button" class="btn btn-sm btn-secondary increase-ability" data-ability="${ability.short}">+</button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for ability score adjustment buttons
        const increaseButtons = container.querySelectorAll('.increase-ability');
        const decreaseButtons = container.querySelectorAll('.decrease-ability');

        for (const button of increaseButtons) {
            button.addEventListener('click', function () {
                const ability = this.getAttribute('data-ability');
                adjustScore(ability, 1);
            });
        }

        for (const button of decreaseButtons) {
            button.addEventListener('click', function () {
                const ability = this.getAttribute('data-ability');
                adjustScore(ability, -1);
            });
        }
    }

    // Also update the ability scores in any existing DOM elements
    for (const ability of abilities) {
        const scoreElement = document.getElementById(`${ability.short}Score`);
        const modElement = document.getElementById(`${ability.short}Mod`);

        if (scoreElement && modElement) {
            const baseScore = currentCharacter.abilityScores[ability.long];
            const bonus = currentCharacter.abilityBonuses[ability.long];
            const totalScore = baseScore + bonus;

            scoreElement.textContent = totalScore;
            modElement.textContent = getModifierString(totalScore);

            // Update bonus display if it exists
            const abilityBox = scoreElement.closest('.ability-score-box');
            if (abilityBox) {
                let bonusElement = abilityBox.querySelector('.bonus');

                if (bonus !== 0) {
                    const bonusText = `${bonus > 0 ? '+' : ''}${bonus}`;
                    if (bonusElement) {
                        bonusElement.textContent = bonusText;
                        bonusElement.className = `bonus ${bonus < 0 ? 'negative' : ''}`;
                    } else {
                        // Create bonus element if it doesn't exist
                        bonusElement = document.createElement('div');
                        bonusElement.className = `bonus ${bonus < 0 ? 'negative' : ''}`;
                        bonusElement.textContent = bonusText;
                        abilityBox.insertBefore(bonusElement, abilityBox.firstChild);
                    }
                } else if (bonusElement) {
                    // Remove bonus element if bonus is 0
                    bonusElement.remove();
                }
            }
        }
    }
}

// Setup proficiencies display
function setupProficiencies() {
    const container = document.querySelector('.proficiency-container');
    if (!container) return;

    // Track optional proficiency selections
    if (!currentCharacter.optionalProficiencies) {
        currentCharacter.optionalProficiencies = {
            skills: { allowed: 0, selected: [] },
            languages: { allowed: 0, selected: [] },
            tools: { allowed: 0, selected: [] },
            armor: { allowed: 0, selected: [] },
            weapons: { allowed: 0, selected: [] }
        };
    }

    // Calculate optional proficiencies allowed from race, class, and background
    calculateOptionalProficiencies();

    // Define all available skills
    const allSkills = [
        'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
        'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
        'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
        'Sleight of Hand', 'Stealth', 'Survival'
    ];

    // Define all available languages
    const allLanguages = [
        'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin',
        'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic',
        'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'
    ];

    // Define all available tools
    const allTools = [
        'Alchemist\'s supplies', 'Brewer\'s supplies', 'Calligrapher\'s supplies',
        'Carpenter\'s tools', 'Cartographer\'s tools', 'Cobbler\'s tools',
        'Cook\'s utensils', 'Glassblower\'s tools', 'Jeweler\'s tools',
        'Leatherworker\'s tools', 'Mason\'s tools', 'Painter\'s supplies',
        'Potter\'s tools', 'Smith\'s tools', 'Tinker\'s tools',
        'Weaver\'s tools', 'Woodcarver\'s tools', 'Disguise kit',
        'Forgery kit', 'Herbalism kit', 'Navigator\'s tools',
        'Poisoner\'s kit', 'Thieves\' tools', 'Dice set',
        'Dragonchess set', 'Playing card set', 'Musical instrument'
    ];

    // Define all available armor types
    const allArmorTypes = [
        'Light armor', 'Medium armor', 'Heavy armor', 'Shields'
    ];

    // Define all available weapon types
    const allWeaponTypes = [
        'Simple Weapons', 'Martial Weapons', 'Crossbows', 'Longswords',
        'Rapiers', 'Shortswords', 'Hand Crossbows'
    ];

    // Create HTML for skills
    let skillsHTML = '<div class="proficiency-section">';

    // Add selection counter if there are optional skills to select
    if (currentCharacter.optionalProficiencies.skills.allowed > 0) {
        const selected = currentCharacter.optionalProficiencies.skills.selected.length;
        const allowed = currentCharacter.optionalProficiencies.skills.allowed;
        skillsHTML += `<h6 class="mb-2">Skills <span class="selection-counter">(${selected}/${allowed} skills selected)</span></h6>`;
    } else {
        skillsHTML += '<h6 class="mb-2">Skills</h6>';
    }

    skillsHTML += '<div class="proficiency-grid">';

    for (const skill of allSkills) {
        const isProficient = currentCharacter.proficiencies.skills.includes(skill);
        const isOptionallySelected = currentCharacter.optionalProficiencies.skills.selected.includes(skill);
        const canSelect = currentCharacter.optionalProficiencies.skills.allowed > currentCharacter.optionalProficiencies.skills.selected.length && !isProficient && !isOptionallySelected;
        const isOptional = canSelect || isOptionallySelected;

        skillsHTML += `
            <div class="proficiency-item ${isProficient ? 'proficient' : ''} ${isOptionallySelected ? 'proficient optional-selected' : ''} ${canSelect || isOptionallySelected ? 'selectable' : ''}"
                 data-proficiency="${skill}"
                 data-type="skills">
                <i class="fas ${isProficient ? 'fa-check-circle' : isOptionallySelected ? 'fa-check-circle optional' : 'fa-circle'} ${isOptional ? 'optional' : ''}"></i>
                ${skill}
                ${isOptionallySelected ? '' : ''}
            </div>
        `;
    }

    skillsHTML += '</div></div>';

    // Create HTML for saving throws
    const allAbilities = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];

    let savesHTML = '<div class="proficiency-section">';
    savesHTML += '<h6 class="mb-2">Saving Throws</h6>';
    savesHTML += '<div class="proficiency-grid">';

    for (const ability of allAbilities) {
        const isProficient = currentCharacter.proficiencies.savingThrows.includes(ability);
        savesHTML += `
            <div class="proficiency-item ${isProficient ? 'proficient' : ''}">
                <i class="fas ${isProficient ? 'fa-check-circle' : 'fa-circle'}"></i>
                ${ability}
            </div>
        `;
    }

    savesHTML += '</div></div>';

    // Create HTML for languages
    let languagesHTML = '<div class="proficiency-section">';

    // Add selection counter if there are optional languages to select
    if (currentCharacter.optionalProficiencies.languages.allowed > 0) {
        const selected = currentCharacter.optionalProficiencies.languages.selected.length;
        const allowed = currentCharacter.optionalProficiencies.languages.allowed;
        languagesHTML += `<h6 class="mb-2">Languages <span class="selection-counter">(${selected}/${allowed} languages selected)</span></h6>`;
    } else {
        languagesHTML += '<h6 class="mb-2">Languages</h6>';
    }

    languagesHTML += '<div class="proficiency-grid">';

    for (const language of allLanguages) {
        const isProficient = currentCharacter.proficiencies.languages.includes(language);
        const isOptionallySelected = currentCharacter.optionalProficiencies.languages.selected.includes(language);
        const canSelect = currentCharacter.optionalProficiencies.languages.allowed > currentCharacter.optionalProficiencies.languages.selected.length && !isProficient && !isOptionallySelected;
        const isOptional = canSelect || isOptionallySelected;

        languagesHTML += `
            <div class="proficiency-item ${isProficient ? 'proficient' : ''} ${isOptionallySelected ? 'proficient optional-selected' : ''} ${canSelect || isOptionallySelected ? 'selectable' : ''}"
                 data-proficiency="${language}"
                 data-type="languages">
                <i class="fas fa-comment ${isOptional ? 'optional' : ''}"></i>
                ${language}
                ${isOptionallySelected ? '' : ''}
            </div>
        `;
    }

    languagesHTML += '</div></div>';

    // Create HTML for tools
    let toolsHTML = '<div class="proficiency-section">';

    // Add selection counter if there are optional tools to select
    if (currentCharacter.optionalProficiencies.tools.allowed > 0) {
        const selected = currentCharacter.optionalProficiencies.tools.selected.length;
        const allowed = currentCharacter.optionalProficiencies.tools.allowed;
        toolsHTML += `<h6 class="mb-2">Tools <span class="selection-counter">(${selected}/${allowed} tools selected)</span></h6>`;
    } else {
        toolsHTML += '<h6 class="mb-2">Tools</h6>';
    }

    toolsHTML += '<div class="proficiency-grid">';

    for (const tool of allTools) {
        const isProficient = currentCharacter.proficiencies.tools.includes(tool);
        const isOptionallySelected = currentCharacter.optionalProficiencies.tools.selected.includes(tool);
        const canSelect = currentCharacter.optionalProficiencies.tools.allowed > currentCharacter.optionalProficiencies.tools.selected.length && !isProficient && !isOptionallySelected;
        const isOptional = canSelect || isOptionallySelected;

        // Escape single quotes in the tool name for the data attribute
        const escapedTool = tool.replace(/'/g, "&apos;");

        toolsHTML += `
            <div class="proficiency-item ${isProficient ? 'proficient' : ''} ${isOptionallySelected ? 'proficient optional-selected' : ''} ${canSelect || isOptionallySelected ? 'selectable' : ''}"
                 data-proficiency="${escapedTool}"
                 data-type="tools">
                <i class="fas fa-tools ${isOptional ? 'optional' : ''}"></i>
                ${tool}
                ${isOptionallySelected ? '' : ''}
            </div>
        `;
    }

    toolsHTML += '</div></div>';

    // Create HTML for armor
    let armorHTML = '<div class="proficiency-section">';

    // Add selection counter if there are optional armor to select
    if (currentCharacter.optionalProficiencies.armor.allowed > 0) {
        const selected = currentCharacter.optionalProficiencies.armor.selected.length;
        const allowed = currentCharacter.optionalProficiencies.armor.allowed;
        armorHTML += `<h6 class="mb-2">Armor <span class="selection-counter">(${selected}/${allowed} armor types selected)</span></h6>`;
    } else {
        armorHTML += '<h6 class="mb-2">Armor</h6>';
    }

    armorHTML += '<div class="proficiency-grid">';

    for (const armor of allArmorTypes) {
        const isProficient = currentCharacter.proficiencies.armor.includes(armor);
        const isOptionallySelected = currentCharacter.optionalProficiencies.armor.selected.includes(armor);
        const canSelect = currentCharacter.optionalProficiencies.armor.allowed > currentCharacter.optionalProficiencies.armor.selected.length && !isProficient && !isOptionallySelected;
        const isOptional = canSelect || isOptionallySelected;

        armorHTML += `
            <div class="proficiency-item ${isProficient ? 'proficient' : ''} ${isOptionallySelected ? 'proficient optional-selected' : ''} ${canSelect || isOptionallySelected ? 'selectable' : ''}"
                 data-proficiency="${armor}"
                 data-type="armor">
                <i class="fas fa-shield-alt ${isOptional ? 'optional' : ''}"></i>
                ${armor}
                ${isOptionallySelected ? '' : ''}
            </div>
        `;
    }

    armorHTML += '</div></div>';

    // Create HTML for weapons
    let weaponsHTML = '<div class="proficiency-section">';

    // Add selection counter if there are optional weapons to select
    if (currentCharacter.optionalProficiencies.weapons.allowed > 0) {
        const selected = currentCharacter.optionalProficiencies.weapons.selected.length;
        const allowed = currentCharacter.optionalProficiencies.weapons.allowed;
        weaponsHTML += `<h6 class="mb-2">Weapons <span class="selection-counter">(${selected}/${allowed} weapon types selected)</span></h6>`;
    } else {
        weaponsHTML += '<h6 class="mb-2">Weapons</h6>';
    }

    weaponsHTML += '<div class="proficiency-grid">';

    for (const weapon of allWeaponTypes) {
        const isProficient = currentCharacter.proficiencies.weapons.includes(weapon);
        const isOptionallySelected = currentCharacter.optionalProficiencies.weapons.selected.includes(weapon);
        const canSelect = currentCharacter.optionalProficiencies.weapons.allowed > currentCharacter.optionalProficiencies.weapons.selected.length && !isProficient && !isOptionallySelected;
        const isOptional = canSelect || isOptionallySelected;

        weaponsHTML += `
            <div class="proficiency-item ${isProficient ? 'proficient' : ''} ${isOptionallySelected ? 'proficient optional-selected' : ''} ${canSelect || isOptionallySelected ? 'selectable' : ''}"
                 data-proficiency="${weapon}"
                 data-type="weapons">
                <i class="fas fa-gavel ${isOptional ? 'optional' : ''}"></i>
                ${weapon}
                ${isOptionallySelected ? '' : ''}
            </div>
        `;
    }

    weaponsHTML += '</div></div>';

    // Combine all sections
    container.innerHTML = skillsHTML + savesHTML + languagesHTML + toolsHTML + armorHTML + weaponsHTML;

    // Add event listeners for proficiency items
    const proficiencyItems = container.querySelectorAll('.proficiency-item.selectable');
    for (const item of proficiencyItems) {
        item.addEventListener('click', function () {
            const type = this.getAttribute('data-type');
            const proficiency = this.getAttribute('data-proficiency');
            toggleOptionalProficiency(type, proficiency);
        });
    }
}

// Calculate optional proficiencies
async function calculateOptionalProficiencies() {
    // Reset optional proficiencies
    currentCharacter.optionalProficiencies = {
        skills: { allowed: 0, selected: [], from: [] },
        languages: { allowed: 0, selected: [], from: [] },
        tools: { allowed: 0, selected: [], from: [] },
        armor: { allowed: 0, selected: [], from: [] },
        weapons: { allowed: 0, selected: [], from: [] }
    };

    // Load data
    const races = await window.dndDataLoader.getRaces();
    const classes = await window.dndDataLoader.getClasses();
    const backgrounds = await window.dndDataLoader.getBackgrounds();

    // Process race optional proficiencies
    if (currentCharacter.race) {
        const raceData = races.find(r => r.id === currentCharacter.race);
        if (raceData) {
            // Process optional proficiencies from race
            // This is a placeholder for future implementation
        }
    }

    // Process class optional proficiencies
    if (currentCharacter.class) {
        const classData = classes.find(c => c.id === currentCharacter.class);
        if (classData?.proficiencies?.skills) {
            // Process skill choices
            for (const skill of classData.proficiencies.skills) {
                if (typeof skill === 'object' && skill.choose) {
                    currentCharacter.optionalProficiencies.skills.allowed = skill.choose;
                    currentCharacter.optionalProficiencies.skills.from = skill.from || [];
                }
            }
        }
    }

    // Process background optional proficiencies
    if (currentCharacter.background) {
        const backgroundData = backgrounds.find(bg => bg.id === currentCharacter.background);
        if (backgroundData) {
            // Process optional proficiencies from background
            // This is a placeholder for future implementation
        }
    }

    // Restore any previously selected optional proficiencies
    if (currentCharacter.savedOptionalProficiencies) {
        for (const type in currentCharacter.savedOptionalProficiencies) {
            if (currentCharacter.optionalProficiencies[type]) {
                currentCharacter.optionalProficiencies[type].selected =
                    currentCharacter.savedOptionalProficiencies[type].selected || [];
            }
        }
    }

    // Update the UI with the new optional proficiencies
    setupOptionalProficiencies();
}

// Toggle optional proficiency selection
function toggleOptionalProficiency(type, proficiency) {
    // Decode any HTML entities that might be in the proficiency name
    const decodedProficiency = proficiency.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

    // Check if this proficiency is already selected
    const isSelected = currentCharacter.optionalProficiencies[type].selected.includes(decodedProficiency);

    if (isSelected) {
        // If already selected, remove it (unselect)
        currentCharacter.optionalProficiencies[type].selected =
            currentCharacter.optionalProficiencies[type].selected.filter(p => p !== decodedProficiency);
    } else {
        // Check if we've reached the maximum allowed selections
        if (currentCharacter.optionalProficiencies[type].selected.length >= currentCharacter.optionalProficiencies[type].allowed) {
            console.log(`You can only select ${currentCharacter.optionalProficiencies[type].allowed} ${type}.`);
            return;
        }

        // If not selected and we haven't reached the limit, add it
        currentCharacter.optionalProficiencies[type].selected.push(decodedProficiency);
    }

    // Save the optional proficiencies to the character
    currentCharacter.savedOptionalProficiencies = currentCharacter.optionalProficiencies;

    // Update the UI
    setupProficiencies();
    // Do not save automatically
}

// Adjust ability score
function adjustScore(ability, change) {
    const abilityMap = {
        str: 'strength',
        dex: 'dexterity',
        con: 'constitution',
        int: 'intelligence',
        wis: 'wisdom',
        cha: 'charisma'
    };

    const abilityKey = abilityMap[ability];
    if (!abilityKey) return;

    const currentScore = currentCharacter.abilityScores[abilityKey];
    const bonus = currentCharacter.abilityBonuses[abilityKey];

    // Calculate new score, ensuring it doesn't go below 3 or above 18
    // Also ensure that with racial bonuses, the score doesn't go below 3
    const minBaseScore = Math.max(3, 3 - bonus);
    const newScore = Math.max(minBaseScore, Math.min(18, currentScore + change));

    // Update character state
    currentCharacter.abilityScores[abilityKey] = newScore;

    // Update UI
    setupAbilityScores();
    // Do not save automatically
}

// Get modifier string
function getModifierString(score) {
    const modifier = Math.floor((score - 10) / 2);
    return modifier >= 0 ? `+${modifier}` : modifier.toString();
}

// Toggle equipment
function toggleEquipment(type, itemId) {
    const equipment = currentCharacter.equipment[type];
    const index = equipment.indexOf(itemId);

    if (index === -1) {
        equipment.push(itemId);
    } else {
        equipment.splice(index, 1);
    }

    // Do not save automatically
    initializeEquipmentPage();
}

// Load existing characters
async function loadCharacters() {
    try {
        // Show loading indicator
        const characterList = document.getElementById('characterList');
        if (!characterList) return;

        characterList.innerHTML = '<div class="col-12 text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';

        // Load all character files (.ffp) using the characterStorage API
        const characters = await window.characterStorage.loadCharacters();

        // Clear the character list
        characterList.innerHTML = '';

        // Add a header for characters if any exist
        if (characters && characters.length > 0) {
            const header = document.createElement('div');
            header.className = 'col-12 mb-3';
            header.innerHTML = '<h3>Characters</h3>';
            characterList.appendChild(header);

            // Create a row for character cards
            const row = document.createElement('div');
            row.className = 'row';
            characterList.appendChild(row);

            // Create all character cards in parallel
            const characterCardPromises = characters.map(async character => {
                // Ensure character has required properties
                if (!character.lastModified) {
                    character.lastModified = new Date().toISOString();
                }

                return {
                    character,
                    card: await createCharacterCard(character)
                };
            });

            // Wait for all character cards to be created
            const characterCards = await Promise.all(characterCardPromises);

            // Add all character cards to the row
            for (const { character, card } of characterCards) {
                row.appendChild(card);

                // If this character is the currently selected one, mark it as selected
                if (currentCharacter && currentCharacter.id === character.id) {
                    const cardElement = card.querySelector('.character-card');
                    if (cardElement) {
                        cardElement.classList.add('selected');
                    }
                }
            }
        } else {
            // Show a message if no characters exist
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'col-12 text-center mt-4';
            emptyMessage.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    No characters found. Create a new character to get started.
                </div>
            `;
            characterList.appendChild(emptyMessage);
        }
    } catch (error) {
        console.error('Error loading characters:', error);

        // Show error message
        const characterList = document.getElementById('characterList');
        if (characterList) {
            characterList.innerHTML = `
                <div class="col-12 text-center mt-4">
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        Error loading characters: ${error.message || 'Unknown error'}
                    </div>
                </div>
            `;
        }
    }
}

// Make loadCharacters available globally
window.loadCharacters = loadCharacters;

// Create a new character
function createNewCharacter() {
    // Show the new character modal
    const modalElement = document.getElementById('newCharacterModal');
    if (!modalElement) {
        console.error('New character modal not found');
        return;
    }

    try {
        // Clear previous values
        const nameInput = document.getElementById('newCharacterName');
        if (nameInput) nameInput.value = '';

        // Reset checkboxes
        document.getElementById('source5e2014').checked = true;
        document.getElementById('source5e2024').checked = false;
        document.getElementById('sourceHomebrew').checked = false;

        // Show the modal
        let modal;

        // Check if Bootstrap is properly loaded
        if (typeof bootstrap !== 'undefined') {
            // Use Bootstrap's Modal constructor
            modal = new bootstrap.Modal(modalElement);
            modal.show();
            console.log('Modal opened using Bootstrap');
        } else {
            // Fallback method if Bootstrap is not available
            console.warn('Bootstrap not available, using fallback modal display');
            modalElement.classList.add('show');
            modalElement.style.display = 'block';

            // Create backdrop manually
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop show';
            document.body.appendChild(backdrop);

            // Add event listener to close button
            const closeBtn = modalElement.querySelector('.btn-close, [data-bs-dismiss="modal"]');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modalElement.classList.remove('show');
                    modalElement.style.display = 'none';
                    backdrop.remove();
                });
            }
        }

        console.log('New character modal opened');
    } catch (error) {
        console.error('Error opening new character modal:', error);
        showNotification('Error opening character creation form', 'danger');
    }
}

// Create character from modal data
async function createCharacterFromModal() {
    try {
        const nameInput = document.getElementById('newCharacterName');

        if (!nameInput) {
            console.error('Character creation form inputs not found');
            return;
        }

        const name = nameInput.value.trim();
        const playerName = ''; // Default to empty string since we don't have a player name field

        // Validate required fields
        if (!name) {
            // Use the global showNotification function if available, otherwise use a local version
            if (window.showNotification) {
                window.showNotification('Character name is required', 'danger');
            } else if (typeof showNotification === 'function') {
                showNotification('Character name is required', 'danger');
            } else {
                console.error('Character name is required');
            }
            return;
        }

        // Generate a UUID for the new character
        const id = await window.electron.generateUUID();

        // Create a new character object
        const newCharacter = {
            id,
            name,
            playerName,
            race: '',
            subrace: '',
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
                strength: 0,
                dexterity: 0,
                constitution: 0,
                intelligence: 0,
                wisdom: 0,
                charisma: 0
            },
            bonusSources: [],
            proficiencies: {
                skills: [],
                tools: [],
                languages: ['Common'], // Default language
                armor: [],
                weapons: ['Simple Weapons'], // Default simple weapons proficiency
                savingThrows: []
            },
            proficiencySources: [
                {
                    type: 'languages',
                    proficiency: 'Common',
                    source: 'Default'
                },
                {
                    type: 'weapons',
                    proficiency: 'Simple Weapons',
                    source: 'Default'
                }
            ],
            optionalProficiencies: {
                skills: { allowed: 0, selected: [] },
                languages: { allowed: 0, selected: [] },
                tools: { allowed: 0, selected: [] },
                armor: { allowed: 0, selected: [] },
                weapons: { allowed: 0, selected: [] }
            },
            savedOptionalProficiencies: null,
            height: '',
            weight: '',
            gender: '',
            backstory: '',
            equipment: {
                weapons: ['dagger'], // Default simple weapon
                armor: [],
                items: []
            },
            lastModified: new Date().toISOString()
        };

        // Save the new character
        const result = await window.characterStorage.saveCharacter(newCharacter);

        if (result.success) {
            // Set as current character
            currentCharacter = { ...newCharacter };

            // Update the global currentCharacter
            window.currentCharacter = currentCharacter;

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('newCharacterModal'));
            if (modal) {
                modal.hide();
            } else {
                // Try alternative method to close the modal if bootstrap instance is not found
                const modalElement = document.getElementById('newCharacterModal');
                if (modalElement && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const newModal = new bootstrap.Modal(modalElement);
                    newModal.hide();
                }
            }

            // Reset the form
            const form = document.getElementById('newCharacterForm');
            if (form) {
                form.reset();
            }

            // Update navigation state
            if (window.updateNavigation) {
                window.updateNavigation();
            }

            // Reload the character list
            loadCharacters();

            // Show success notification
            if (window.showNotification) {
                window.showNotification('Character created successfully', 'success');
            } else if (typeof showNotification === 'function') {
                showNotification('Character created successfully', 'success');
            } else {
                console.log('Character created successfully');
            }
        } else {
            if (window.showNotification) {
                window.showNotification('Failed to create character', 'danger');
            } else if (typeof showNotification === 'function') {
                showNotification('Failed to create character', 'danger');
            } else {
                console.error('Failed to create character');
            }
        }
    } catch (error) {
        console.error('Error creating character:', error);
        if (window.showNotification) {
            window.showNotification('Error creating character', 'danger');
        } else if (typeof showNotification === 'function') {
            showNotification('Error creating character', 'danger');
        } else {
            console.error('Error creating character');
        }
    }
}

// Create character card element
async function createCharacterCard(character) {
    const col = document.createElement('div');
    col.className = 'col-md-4 mb-4';

    // Get race and subrace names
    let raceName = 'Not selected';
    let className = 'Not selected';

    try {
        // Load race data
        if (character.race) {
            const races = await window.dndDataLoader.getRaces();
            const race = races.find(r => r.index === character.race);
            raceName = race ? race.name : 'Unknown';

            if (character.subrace && race && race.subraces) {
                const subrace = race.subraces.find(sr => sr.index === character.subrace);
                if (subrace) {
                    raceName += ` (${subrace.name})`;
                }
            }
        }

        // Load class data
        if (character.class) {
            const classes = await window.dndDataLoader.getClasses();
            const classData = classes.find(c => c.index === character.class);
            className = classData ? classData.name : 'Unknown';

            if (character.subclass && classData && classData.subclasses) {
                const subclass = classData.subclasses.find(sc => sc.index === character.subclass);
                if (subclass) {
                    className += ` (${subclass.name})`;
                }
            }
        }
    } catch (error) {
        console.error('Error loading race/class data for character card:', error);
    }

    // Format last modified date if available
    let lastModifiedText = 'Never';
    if (character.lastModified) {
        const lastModDate = new Date(character.lastModified);
        lastModifiedText = `${lastModDate.toLocaleDateString()} ${lastModDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Create the card HTML
    col.innerHTML = `
        <div class="card character-card" data-character-id="${character.id}">
            <div class="active-profile-badge">Selected</div>
            <div class="card-body">
                <h5 class="card-title">${character.name || 'Unnamed Character'}</h5>
                <div class="character-info">
                    <p class="mb-1"><strong>Race:</strong> ${raceName}</p>
                    <p class="mb-1"><strong>Class:</strong> ${className}</p>
                    <p class="mb-1"><strong>Level:</strong> ${character.level || 1}</p>
                </div>
                <div class="mt-3">
                    <button class="btn btn-success btn-sm me-2 export-character" data-character-id="${character.id}">
                        <i class="fas fa-file-export"></i>
                    </button>
                    <button class="btn btn-danger btn-sm delete-character" data-character-id="${character.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <small class="text-muted last-modified"><i class="fas fa-clock me-1"></i>Last modified: ${lastModifiedText}</small>
            </div>
        </div>
    `;

    // Make the entire card clickable to select the character
    const card = col.querySelector('.character-card');
    if (card) {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on the export or delete buttons
            if (!e.target.closest('.export-character') && !e.target.closest('.delete-character')) {
                selectCharacter(character.id);
            }
        });
    }

    const exportButton = col.querySelector('.export-character');
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            exportCharacter(character.id);
        });
    }

    const deleteButton = col.querySelector('.delete-character');
    if (deleteButton) {
        deleteButton.addEventListener('click', () => {
            deleteCharacter(character.id);
        });
    }

    return col;
}

// Load character for editing
async function loadCharacter(id) {
    try {
        const characters = await window.characterStorage.loadCharacters();
        const character = characters.find(c => c.id === id);
        if (character) {
            return character;
        }
        return null;
    } catch (error) {
        console.error('Error loading character:', error);
        return null;
    }
}

// Select a character
async function selectCharacter(id) {
    try {
        // Check if there are unsaved changes
        if (hasUnsavedChanges.value && currentCharacter.id) {
            const confirmSwitch = confirm('You have unsaved changes. Do you want to switch characters without saving?');
            if (!confirmSwitch) {
                return;
            }
        }

        // Load the character data
        const character = await loadCharacter(id);
        if (!character) {
            showNotification('Failed to load character', 'danger');
            return;
        }

        // Update the current character
        Object.assign(currentCharacter, character);

        // Update UI to show the selected character
        const characterCards = document.querySelectorAll('.character-card');
        for (const card of characterCards) {
            card.classList.remove('selected');
            if (card.dataset.characterId === id) {
                card.classList.add('selected');
            }
        }

        // Hide unsaved changes indicator
        hideUnsavedChangesIndicator();

        // Update navigation to enable character-specific pages
        if (window.updateNavigation) {
            window.updateNavigation();
        }
    } catch (error) {
        console.error('Error selecting character:', error);
        showNotification('Error loading character', 'danger');
    }
}

// Delete character
async function deleteCharacter(id) {
    try {
        if (confirm('Are you sure you want to delete this character?')) {
            const result = await window.characterStorage.deleteCharacter(id);

            if (result.success) {
                // If the deleted character was the current one, reset currentCharacter
                if (currentCharacter && currentCharacter.id === id) {
                    currentCharacter = {
                        id: null,
                        name: '',
                        // ... other default properties
                    };

                    // Update the global currentCharacter
                    window.currentCharacter = currentCharacter;

                    // Update navigation state
                    if (window.updateNavigation) {
                        window.updateNavigation();
                    }

                    // Navigate back to home page
                    window.app.loadPage('home');
                } else {
                    // Just reload the character list
                    loadCharacters();
                }

                window.showNotification('Character deleted successfully', 'success');
            } else {
                window.showNotification('Failed to delete character', 'danger');
            }
        }
    } catch (error) {
        console.error('Error deleting character:', error);
        window.showNotification('Error deleting character', 'danger');
    }
}

// Update character field
function updateCharacterField(event) {
    const field = event.target.id;
    const value = event.target.value;

    switch (field) {
        case 'characterName':
            currentCharacter.name = value;
            break;
        case 'playerName':
            currentCharacter.playerName = value;
            break;
        case 'height':
            currentCharacter.height = value;
            break;
        case 'weight':
            currentCharacter.weight = value;
            break;
        case 'gender':
            currentCharacter.gender = value;
            break;
        case 'backstory':
            currentCharacter.backstory = value;
            break;
        // Race and subrace changes are now handled by direct event listeners
        case 'backgroundSelect':
            currentCharacter.background = value;
            updateBackgroundDetails(value);
            break;
    }

    // Show unsaved changes indicator
    showUnsavedChangesIndicator();
}

// Save character
async function saveCharacter() {
    try {
        // Add lastModified timestamp before saving
        currentCharacter.lastModified = new Date().toISOString();

        await window.characterStorage.saveCharacter(currentCharacter);
        showNotification('Character saved successfully!', 'success');

        // Hide unsaved changes indicator
        hideUnsavedChangesIndicator();

        // Refresh the character list to show updated data
        loadCharacters();
    } catch (error) {
        console.error('Error saving character:', error);
        showNotification('Error saving character', 'danger');
    }
}

// Generate character sheet PDF
async function generateCharacterSheet() {
    try {
        const result = await window.characterStorage.generatePDF(currentCharacter);
        if (result.success) {
            // Handle PDF generation success
            console.log('PDF generated successfully');
        } else {
            console.error('Error generating PDF:', result.error);
        }
    } catch (error) {
        console.error('Error generating character sheet:', error);
    }
}

// Populate form with character data
async function populateForm(character) {
    // Set basic fields
    const characterNameField = document.getElementById('characterName');
    const playerNameField = document.getElementById('playerName');
    const heightField = document.getElementById('height');
    const weightField = document.getElementById('weight');
    const genderField = document.getElementById('gender');
    const backstoryField = document.getElementById('backstory');

    if (characterNameField) characterNameField.value = character.name || '';
    if (playerNameField) playerNameField.value = character.playerName || '';
    if (heightField) heightField.value = character.height || '';
    if (weightField) weightField.value = character.weight || '';
    if (genderField) genderField.value = character.gender || '';
    if (backstoryField) backstoryField.value = character.backstory || '';

    // Set race, subrace, class, subclass, and background
    const raceSelect = document.getElementById('raceSelect');
    const subraceSelect = document.getElementById('subraceSelect');
    const classSelect = document.getElementById('classSelect');
    const subclassSelect = document.getElementById('subclassSelect');
    const backgroundSelect = document.getElementById('backgroundSelect');

    // Populate selects first
    await populateSelects();

    // Set selected values
    if (raceSelect && character.race) {
        raceSelect.value = character.race;
        await populateSubraces(character.race);
    }

    if (subraceSelect && character.subrace) {
        subraceSelect.value = character.subrace;
    }

    if (classSelect && character.class) {
        classSelect.value = character.class;
        await populateSubclasses(character.class);
    }

    if (subclassSelect && character.subclass) {
        subclassSelect.value = character.subclass;
    }

    if (backgroundSelect && character.background) {
        backgroundSelect.value = character.background;
    }

    // Update details
    if (character.race) {
        await updateRaceDetails(character.race, character.subrace);
    }

    if (character.class) {
        await updateClassDetails(character.class, character.subclass);
    }

    if (character.background) {
        await updateBackgroundDetails(character.background);
    }

    // Set ability scores
    for (const ability in character.abilityScores) {
        const abilityInput = document.getElementById(`${ability}Score`);
        if (abilityInput) {
            abilityInput.value = character.abilityScores[ability];
        }
    }

    // Restore saved optional proficiencies
    currentCharacter.savedOptionalProficiencies = character.optionalProficiencies;

    // Calculate bonuses and proficiencies
    await calculateBonusesAndProficiencies();
    await calculateOptionalProficiencies();
    setupAbilityScores();
    setupProficiencies();

    // Update equipment
    if (character.equipment) {
        currentCharacter.equipment = character.equipment;
    }
}

// Format ability score increase text
function formatAbilityScoreIncrease(ability) {
    if (!ability) return '';

    // Handle array format (from the JSON data)
    if (Array.isArray(ability)) {
        return ability.map(abilityObj => {
            const increases = [];
            for (const [stat, value] of Object.entries(abilityObj)) {
                increases.push(`${stat.toUpperCase()} +${value}`);
            }
            return increases.join(', ');
        }).join('; ');
    }

    // Handle object format
    if (typeof ability === 'object') {
        const increases = [];
        for (const [stat, value] of Object.entries(ability)) {
            increases.push(`${stat.toUpperCase()} +${value}`);
        }
        return increases.join(', ');
    }

    return String(ability);
}

// Update details functions
async function updateRaceDetails(race, subrace) {
    console.log('updateRaceDetails called with race:', race, 'subrace:', subrace);

    const raceDetails = document.getElementById('raceDetails');
    const raceImage = document.getElementById('raceImage');
    const raceQuickDesc = document.getElementById('raceQuickDesc');

    if (!raceDetails || !raceImage || !raceQuickDesc) {
        console.error('Race detail elements not found');
        return;
    }

    if (!race) {
        console.log('No race selected, showing default content');
        // Set placeholder image and content
        setRacePlaceholderContent(raceImage, raceQuickDesc, raceDetails);
        return;
    }

    // Get race data
    const races = await window.dndDataLoader.getRaces();
    const raceData = races.find(r => r.id === race);

    if (!raceData) {
        console.log('No race data found, showing default content');
        // Set placeholder image and content
        setRacePlaceholderContent(raceImage, raceQuickDesc, raceDetails);
        return;
    }

    console.log('Race data found:', raceData);

    // Get subrace data if available
    let subraceData = null;
    if (subrace && raceData.subraces) {
        subraceData = raceData.subraces.find(sr => sr.id === subrace);
        console.log('Subrace data found:', subraceData);
    }

    // Update race image
    if (raceData.imageUrl) {
        console.log('Setting race image from URL:', raceData.imageUrl);
        // Create the image element without inline event handlers
        raceImage.innerHTML = `<img src="${raceData.imageUrl}" alt="${raceData.name}" class="race-image-element">`;

        // Add error handler after the image is added to the DOM
        const imgElement = raceImage.querySelector('.race-image-element');
        if (imgElement) {
            imgElement.addEventListener('error', function () {
                this.style.display = 'none';
                raceImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
            });
        }
    } else {
        console.log('No image URL found, using placeholder');
        raceImage.innerHTML = `<i class="fas fa-user-circle placeholder-icon"></i>`;
    }

    // Update quick description
    if (raceData.description) {
        // Use the pre-processed description from the race data
        raceQuickDesc.innerHTML = `<div>${raceData.description}</div>`;
    } else {
        // Extract description from entries if available (fallback)
        let description = '';
        if (raceData.entries) {
            // Find entries that might contain descriptions
            const descEntries = raceData.entries.filter(entry =>
                entry.type === 'entries' &&
                (!entry.name || entry.name.toLowerCase().includes('description'))
            );

            if (descEntries.length > 0) {
                // Use the first matching entry's content
                const descEntry = descEntries[0];
                if (Array.isArray(descEntry.entries)) {
                    description = descEntry.entries.join(' ');
                } else if (typeof descEntry.entries === 'string') {
                    description = descEntry.entries;
                }
            }
        }

        // Fallback to quickDesc if available
        if (!description && raceData.quickDesc) {
            description = raceData.quickDesc;
        }

        // If still no description, use a generic one
        if (!description) {
            description = `The ${raceData.name} race is one of the playable races in D&D.`;
        }

        raceQuickDesc.innerHTML = `<div>${description}</div>`;
    }

    // Extract traits from entries
    let traits = [...(raceData.traits || [])];

    // Add subrace traits if available
    if (subraceData?.traits) {
        traits = [...traits, ...subraceData.traits];
    }

    // If no traits are available, try to extract them from entries (fallback)
    if (traits.length === 0 && raceData.entries) {
        traits = raceData.entries
            .filter(entry => entry.type === 'entries' && entry.name && !entry.name.toLowerCase().includes('description'))
            .map(entry => ({
                name: entry.name,
                description: Array.isArray(entry.entries) ? entry.entries.join(' ') : entry.entries
            }));
    }

    // Add traits from the traits property if available
    if (raceData.traits && Array.isArray(raceData.traits)) {
        traits = [...traits, ...raceData.traits];
    }

    // Format ability score increase
    let abilityScoreIncrease = '';
    if (raceData.ability) {
        abilityScoreIncrease = formatAbilityScoreIncrease(raceData.ability);
    }

    // Add subrace ability score increase if applicable
    if (subraceData?.ability) {
        const subraceAbilityText = formatAbilityScoreIncrease(subraceData.ability);
        abilityScoreIncrease = abilityScoreIncrease ?
            `${abilityScoreIncrease}, ${subraceAbilityText}` :
            subraceAbilityText;
    }

    // Extract languages from languageProficiencies
    let languages = [];
    if (raceData.languageProficiencies && Array.isArray(raceData.languageProficiencies)) {
        languages = raceData.languageProficiencies.flatMap(langObj => {
            if (!langObj) return [];
            return Object.keys(langObj).map(lang =>
                lang.charAt(0).toUpperCase() + lang.slice(1)
            );
        });
    }

    // Use languages property if available
    if (raceData.languages && Array.isArray(raceData.languages)) {
        languages = [...languages, ...raceData.languages];
    }

    // Format speed
    let speedText = '30 ft.';
    if (typeof raceData.speed === 'number') {
        speedText = `${raceData.speed} ft.`;
    } else if (typeof raceData.speed === 'object') {
        const speeds = [];
        for (const [type, value] of Object.entries(raceData.speed)) {
            speeds.push(`${type} ${value} ft.`);
        }
        speedText = speeds.join(', ');
    }

    // Format size
    let sizeText = 'Medium';
    if (Array.isArray(raceData.size)) {
        sizeText = raceData.size.join(', ');
    } else if (raceData.size) {
        sizeText = raceData.size;
    }

    // Update detailed information
    raceDetails.innerHTML = `
        <div class="race-details-grid">
            <div class="detail-section">
                <h6>Ability Score Increase</h6>
                <p>${abilityScoreIncrease || '—'}</p>
            </div>
            <div class="detail-section">
                <h6>Age</h6>
                <p>${raceData.age || '—'}</p>
            </div>
            <div class="detail-section">
                <h6>Size</h6>
                <p>${sizeText}</p>
            </div>
            <div class="detail-section">
                <h6>Speed</h6>
                <p>${speedText}</p>
            </div>
            <div class="detail-section">
                <h6>Languages</h6>
                <ul class="mb-0">
                    ${languages.length > 0 ?
            languages.map(lang => `<li>${lang}</li>`).join('') :
            '<li>—</li>'}
                </ul>
            </div>
            <div class="detail-section">
                <h6>Racial Traits</h6>
                <ul class="mb-0">
                    ${traits.length > 0 ?
            traits.map(trait => {
                // Check if trait is an object with name and description
                if (trait && typeof trait === 'object' && trait.name) {
                    return `<li title="${trait.description || ''}">${trait.name}</li>`;
                }
                // Fallback for old format traits
                return `<li>${trait}</li>`;
            }).join('') :
            '<li>—</li>'}
                </ul>
            </div>
        </div>
    `;

    // Recalculate bonuses and proficiencies
    calculateBonusesAndProficiencies();
    setupAbilityScores();
    setupProficiencies();
}

async function updateBackgroundDetails(background) {
    const backgroundDetails = document.getElementById('backgroundDetails');
    const backgroundQuickDesc = document.getElementById('backgroundQuickDesc');
    const backgroundImage = document.getElementById('backgroundImage');

    if (!backgroundDetails) {
        console.error('Background details element not found');
        return;
    }

    if (!background) {
        // Set placeholder content
        setBackgroundPlaceholderContent(backgroundImage, backgroundQuickDesc, backgroundDetails);
        return;
    }

    // Get background data
    const backgrounds = await window.dndDataLoader.getBackgrounds();
    const backgroundData = backgrounds.find(bg => bg.id === background);

    if (!backgroundData) {
        // Set placeholder content
        setBackgroundPlaceholderContent(backgroundImage, backgroundQuickDesc, backgroundDetails);
        return;
    }

    // Update background image
    if (backgroundImage) {
        if (backgroundData.imageUrl) {
            // Create the image element without inline event handlers
            backgroundImage.innerHTML = `<img src="${backgroundData.imageUrl}" alt="${backgroundData.name}" class="background-image-element">`;

            // Add error handler after the image is added to the DOM
            const imgElement = backgroundImage.querySelector('.background-image-element');
            if (imgElement) {
                imgElement.addEventListener('error', function () {
                    this.style.display = 'none';
                    backgroundImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
                });
            }
        } else {
            backgroundImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
        }
    }

    // Update quick description
    if (backgroundQuickDesc) {
        backgroundQuickDesc.innerHTML = `<div>${backgroundData.description || ''}</div>`;
    }

    // Build detailed background information
    let detailsHTML = '<div class="race-details-grid">';

    // Skill proficiencies
    detailsHTML += `
        <div class="detail-section">
            <h6>Skill Proficiencies</h6>
            <ul>
                ${backgroundData.skillProficiencies?.length > 0 ?
            backgroundData.skillProficiencies.map(skill => `<li>${skill}</li>`).join('') :
            '<li>—</li>'}
            </ul>
        </div>
    `;

    // Tool proficiencies
    detailsHTML += `
        <div class="detail-section">
            <h6>Tool Proficiencies</h6>
            <ul>
                ${backgroundData.toolProficiencies?.length > 0 ?
            backgroundData.toolProficiencies.map(tool => `<li>${tool}</li>`).join('') :
            '<li>—</li>'}
            </ul>
        </div>
    `;

    // Languages
    detailsHTML += `
        <div class="detail-section">
            <h6>Languages</h6>
            <ul>
                ${backgroundData.languages?.length > 0 ?
            backgroundData.languages.map(language => `<li>${language}</li>`).join('') :
            '<li>—</li>'}
            </ul>
        </div>
    `;

    // Equipment
    detailsHTML += `
        <div class="detail-section">
            <h6>Equipment</h6>
            <ul>
                ${backgroundData.equipment?.length > 0 ?
            backgroundData.equipment.map(item => `<li>${item}</li>`).join('') :
            '<li>—</li>'}
            </ul>
        </div>
    `;

    // Features
    detailsHTML += `
        <div class="detail-section">
            <h6>Features</h6>
            <ul>
                ${backgroundData.features?.length > 0 ?
            backgroundData.features.map(feature => `<li title="${feature.description || ''}">${feature.name}</li>`).join('') :
            '<li>—</li>'}
            </ul>
        </div>
    `;

    // Close the grid
    detailsHTML += '</div>';

    // Set the HTML
    backgroundDetails.innerHTML = detailsHTML;
}

// Helper function to set placeholder content for background details
function setBackgroundPlaceholderContent(backgroundImage, backgroundQuickDesc, backgroundDetails) {
    // Set placeholder image
    if (backgroundImage) {
        backgroundImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';
    }

    // Set placeholder description
    if (backgroundQuickDesc) {
        backgroundQuickDesc.innerHTML = '<div>Choose a background to view its features, proficiencies, and other characteristics.</div>';
    }

    // Set placeholder details
    if (backgroundDetails) {
        backgroundDetails.innerHTML = `
            <div class="race-details-grid">
                <div class="detail-section">
                    <h6>Skill Proficiencies</h6>
                    <ul>
                        <li>—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Tool Proficiencies</h6>
                    <ul>
                        <li>—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Languages</h6>
                    <ul>
                        <li>—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Equipment</h6>
                    <ul>
                        <li>—</li>
                    </ul>
                </div>
                <div class="detail-section">
                    <h6>Features</h6>
                    <ul>
                        <li>—</li>
                    </ul>
                </div>
            </div>
        `;
    }
}

// Export character to file
async function exportCharacter(id) {
    try {
        const result = await window.characterStorage.exportCharacter(id);

        if (result.success) {
            showNotification('Character exported successfully', 'success');
        } else {
            showNotification(`Failed to export character: ${result.message}`, 'danger');
        }
    } catch (error) {
        console.error('Error exporting character:', error);
        showNotification('Error exporting character', 'danger');
    }
}

// Import character
async function importCharacter() {
    try {
        const result = await window.characterStorage.importCharacter();
        if (result.success) {
            if (result.importCount > 1) {
                showNotification(`Successfully imported ${result.importCount} characters`, 'success');
            } else {
                showNotification('Character imported successfully', 'success');
            }

            // If there were any failed imports, show a warning
            if (result.failedCount > 0) {
                const failedMessage = `${result.failedCount} file(s) could not be imported`;
                showNotification(failedMessage, 'warning');
                console.warn('Failed imports:', result.failedImports);
            }

            loadCharacters();
        } else if (!result.canceled) {
            showNotification(result.message || 'Failed to import character(s)', 'danger');
        }
    } catch (error) {
        console.error('Error importing character:', error);
        showNotification('Error importing character(s)', 'danger');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    notificationContainer.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

// Make character functions available globally
window.loadCharacters = loadCharacters;
window.createNewCharacter = createNewCharacter;
window.importCharacter = importCharacter;
window.initializeBuildPage = initializeBuildPage;
window.initializeEquipmentPage = initializeEquipmentPage;
window.initializeDetailsPage = initializeDetailsPage;
window.initializePreviewPage = initializePreviewPage;
window.adjustScore = adjustScore;
window.toggleEquipment = toggleEquipment;
window.loadCharacter = loadCharacter;
window.selectCharacter = selectCharacter;
window.deleteCharacter = deleteCharacter;
window.exportCharacter = exportCharacter;
window.generateCharacterSheet = generateCharacterSheet;
window.toggleOptionalProficiency = toggleOptionalProficiency;

// Function to show unsaved changes indicator
function showUnsavedChangesIndicator() {
    hasUnsavedChanges.value = true;
    const indicator = document.getElementById('unsavedChangesIndicator');
    if (indicator) {
        indicator.style.display = 'inline-block';
    }
}

// Function to hide unsaved changes indicator
function hideUnsavedChangesIndicator() {
    hasUnsavedChanges.value = false;
    const indicator = document.getElementById('unsavedChangesIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// Update ability bonuses based on selected abilities (generic version)
function updateAbilityBonuses(selectedAbilities, source, bonusValue = 1) {
    // First, remove any existing bonuses from this source
    currentCharacter.bonusSources = currentCharacter.bonusSources.filter(
        existingSource => existingSource.source !== source
    );

    // Reset all ability bonuses
    for (const ability in currentCharacter.abilityBonuses) {
        currentCharacter.abilityBonuses[ability] = 0;
    }

    // Recalculate all bonuses from remaining sources
    for (const bonusSource of currentCharacter.bonusSources) {
        if (bonusSource.ability === 'all') {
            // Handle the "all" ability bonus
            for (const ability in currentCharacter.abilityBonuses) {
                currentCharacter.abilityBonuses[ability] += bonusSource.bonus;
            }
        } else {
            currentCharacter.abilityBonuses[bonusSource.ability] += bonusSource.bonus;
        }
    }

    // Add new ability bonuses
    for (const ability of selectedAbilities) {
        currentCharacter.abilityBonuses[ability] += bonusValue;
        currentCharacter.bonusSources.push({
            ability: ability,
            bonus: bonusValue,
            source: source
        });
    }

    // Refresh the ability scores display to show the updated bonuses
    setupAbilityScores();

    // Update race/class details to reflect the changes
    if (source.includes('race') || source.includes('subrace')) {
        updateRaceDetails(currentCharacter.race, currentCharacter.subrace);
    } else if (source.includes('class') || source.includes('subclass')) {
        updateClassDetails(currentCharacter.class, currentCharacter.subclass);
    }
}

// Setup optional proficiencies UI
function setupOptionalProficiencies() {
    // This function would update the UI to show optional proficiency choices
    // For now, it's a placeholder for future implementation
    console.log('Optional proficiencies updated:', currentCharacter.optionalProficiencies);
}

// Helper function to set placeholder content for race
function setRacePlaceholderContent(raceImage, raceQuickDesc, raceDetails) {
    console.log('Setting race placeholder content');

    // Set placeholder image
    raceImage.innerHTML = '<i class="fas fa-user-circle placeholder-icon"></i>';

    // Set placeholder quick description
    raceQuickDesc.innerHTML = `
        <div class="placeholder-content">
            <h5>Select a Race</h5>
            <p>Choose a race to see details about their abilities, traits, and other characteristics.</p>
        </div>
    `;

    // Set placeholder details
    raceDetails.innerHTML = `
        <div class="race-details-grid">
            <div class="detail-section">
                <h6>Ability Score Increase</h6>
                <p class="placeholder-text">—</p>
            </div>
            <div class="detail-section">
                <h6>Age</h6>
                <p class="placeholder-text">—</p>
            </div>
            <div class="detail-section">
                <h6>Size</h6>
                <p class="placeholder-text">—</p>
            </div>
            <div class="detail-section">
                <h6>Speed</h6>
                <p class="placeholder-text">—</p>
            </div>
            <div class="detail-section">
                <h6>Languages</h6>
                <ul class="mb-0">
                    <li class="placeholder-text">—</li>
                </ul>
            </div>
            <div class="detail-section">
                <h6>Traits</h6>
                <ul class="mb-0">
                    <li class="placeholder-text">—</li>
                </ul>
            </div>
        </div>
    `;
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
        </div>
    `;

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
        </div>
    `;

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
        </div>
    `;
}
