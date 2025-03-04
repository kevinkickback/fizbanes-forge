# Phase 3: Class System Integration

## Overview
Enhance class data loading and processing to work with the existing infrastructure and reference system.

## Implementation Steps

### 1. Enhance Class Data Loading
Update the existing loadClasses function in data-loader.js:

```javascript
// Enhance existing loadClasses function
async function loadClasses() {
    if (dataCache.classes) {
        return dataCache.classes;
    }

    try {
        // Load main class data and fluff
        const classData = await loadJsonFile('data/classes.json');
        const fluffData = await loadJsonFile('data/fluff-classes.json').catch(() => ({}));

        // Process each class
        const processedClasses = await Promise.all((classData.class || []).map(async classItem => {
            // Get fluff data for this class
            const fluff = fluffData.classFluff?.find(f => 
                f.name === classItem.name && f.source === classItem.source
            );
            
            return processClassData(classItem, fluff);
        }));

        // Cache and return
        dataCache.classes = processedClasses;
        return processedClasses;
    } catch (error) {
        console.error('Error loading class data:', error);
        throw error;
    }
}

// Add helper function for processing class data
async function processClassData(classItem, fluff = null) {
    // Process basic properties
    const processed = {
        id: classItem.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: classItem.name,
        source: classItem.source || 'PHB',
        page: classItem.page,
        hitDice: classItem.hd?.number && classItem.hd?.faces ? 
            `${classItem.hd.number}d${classItem.hd.faces}` : 'd10',
        description: await processText(fluff?.entries?.[0] || ''),
        proficiencies: processProficiencies(classItem),
        startingEquipment: processStartingEquipment(classItem.startingEquipment),
        multiclassing: processMulticlassing(classItem.multiclassing),
        features: [],
        spellcasting: processSpellcasting(classItem.spellcasting),
        subclasses: []
    };

    // Process class features
    if (classItem.classFeatures) {
        processed.features = await Promise.all(classItem.classFeatures.map(async level => {
            return {
                level: level.level,
                features: await Promise.all(level.features.map(async feature => ({
                    name: feature.name,
                    description: await processText(feature.entries)
                })))
            };
        }));
    }

    // Process subclasses
    if (classItem.subclasses?.length > 0) {
        processed.subclasses = await Promise.all(
            classItem.subclasses.map(async subclass => {
                const subclassFluff = fluff?.subclasses?.find(f => 
                    f.name === subclass.name && f.source === subclass.source
                );
                return processSubclassData(subclass, subclassFluff);
            })
        );
    }

    return processed;
}

// Helper functions for class data processing
function processProficiencies(classItem) {
    return {
        armor: classItem.proficiency?.armor || [],
        weapons: classItem.proficiency?.weapons || [],
        tools: classItem.proficiency?.tools || [],
        savingThrows: classItem.proficiency?.savingThrows || [],
        skills: {
            choices: classItem.proficiency?.skills?.choose || 0,
            from: classItem.proficiency?.skills?.from || []
        }
    };
}

function processStartingEquipment(equipment) {
    if (!equipment) return { default: [], choices: [] };

    return {
        default: equipment.default || [],
        choices: equipment.choices?.map(choice => ({
            count: choice.count || 1,
            items: choice.items || []
        })) || []
    };
}

function processMulticlassing(multiclassing) {
    if (!multiclassing) return null;

    return {
        requirements: multiclassing.requirements || {},
        proficiencies: {
            armor: multiclassing.proficiencies?.armor || [],
            weapons: multiclassing.proficiencies?.weapons || [],
            tools: multiclassing.proficiencies?.tools || [],
            skills: multiclassing.proficiencies?.skills || []
        }
    };
}

function processSpellcasting(spellcasting) {
    if (!spellcasting) return null;

    return {
        ability: spellcasting.ability,
        progression: spellcasting.progression || 'full',
        cantripProgression: spellcasting.cantripProgression || [0, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        spellsKnownProgression: spellcasting.spellsKnownProgression || null,
        spellsKnownProgressionFixed: spellcasting.spellsKnownProgressionFixed || false,
        spellsKnownProgressionType: spellcasting.spellsKnownProgressionType || null
    };
}

async function processSubclassData(subclass, fluff = null) {
    return {
        id: subclass.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: subclass.name,
        source: subclass.source || 'PHB',
        description: await processText(fluff?.entries?.[0] || ''),
        features: await Promise.all((subclass.subclassFeatures || []).map(async level => ({
            level: level.level,
            features: await Promise.all(level.features.map(async feature => ({
                name: feature.name,
                description: await processText(feature.entries)
            })))
        })))
    };
}
```

### 2. Update Character Class Management
Enhance the existing class management in character.js:

```javascript
// Add to character.js
async function updateClassDetails(className, level = 1, subclassName = null) {
    // Clear existing class features at this level
    clearClassFeatures(level);
    
    // Get class data
    const classes = await window.dndDataLoader.loadClasses();
    const classData = classes.find(c => c.id === className);
    if (!classData) return;

    // Get subclass data if applicable and at appropriate level
    let subclassData = null;
    if (subclassName && classData.subclasses && level >= 3) {
        subclassData = classData.subclasses.find(sc => sc.id === subclassName);
    }

    // Apply proficiencies if this is the first level in this class
    if (level === 1) {
        applyClassProficiencies(classData.proficiencies);
    } else if (level === 1 && classData.multiclassing) {
        applyMulticlassProficiencies(classData.multiclassing.proficiencies);
    }

    // Apply features for this level
    const levelFeatures = classData.features.find(f => f.level === level);
    if (levelFeatures) {
        for (const feature of levelFeatures.features) {
            addClassFeature(feature.name, await processText(feature.description), level);
        }
    }

    // Apply subclass features if applicable
    if (subclassData) {
        const subclassFeatures = subclassData.features.find(f => f.level === level);
        if (subclassFeatures) {
            for (const feature of subclassFeatures.features) {
                addClassFeature(feature.name, await processText(feature.description), level, true);
            }
        }
    }

    // Update spellcasting if applicable
    if (classData.spellcasting) {
        updateSpellcasting(classData.spellcasting, level);
    }

    // Update character sheet
    updateCharacterSheet();
}

// Helper functions for class management
function applyClassProficiencies(proficiencies) {
    // Add armor proficiencies
    for (const armor of proficiencies.armor) {
        addProficiency('armor', armor, 'Class');
    }

    // Add weapon proficiencies
    for (const weapon of proficiencies.weapons) {
        addProficiency('weapon', weapon, 'Class');
    }

    // Add tool proficiencies
    for (const tool of proficiencies.tools) {
        addProficiency('tool', tool, 'Class');
    }

    // Add saving throw proficiencies
    for (const save of proficiencies.savingThrows) {
        addSavingThrowProficiency(save);
    }

    // Store skill choices for UI
    if (proficiencies.skills.choices > 0) {
        currentCharacter.pendingSkillChoices = {
            count: proficiencies.skills.choices,
            from: proficiencies.skills.from
        };
    }
}

function applyMulticlassProficiencies(proficiencies) {
    // Similar to applyClassProficiencies but with multiclass restrictions
    for (const type in proficiencies) {
        for (const prof of proficiencies[type]) {
            addProficiency(type, prof, 'Multiclass');
        }
    }
}

function updateSpellcasting(spellcasting, level) {
    // Update spellcasting ability
    if (!currentCharacter.spellcasting.ability) {
        currentCharacter.spellcasting.ability = spellcasting.ability;
    }

    // Update cantrips known
    currentCharacter.spellcasting.cantripsKnown = 
        spellcasting.cantripProgression[level - 1];

    // Update spells known if applicable
    if (spellcasting.spellsKnownProgression) {
        currentCharacter.spellcasting.spellsKnown = 
            spellcasting.spellsKnownProgression[level - 1];
    }

    // Update spell slots based on progression type
    updateSpellSlots(spellcasting.progression, level);
}
```

### 3. Update Class UI
Enhance the existing class UI components:

```javascript
// Add to character.js
async function displayClassDetails(className, level = 1, subclassName = null) {
    const container = document.getElementById('classDetails');
    if (!container) return;

    // Get class data
    const classes = await window.dndDataLoader.loadClasses();
    const classData = classes.find(c => c.id === className);
    if (!classData) return;

    // Get subclass data if applicable
    let subclassData = null;
    if (subclassName && classData.subclasses) {
        subclassData = classData.subclasses.find(sc => sc.id === subclassName);
    }

    // Create HTML
    let html = `
        <div class="class-details-grid">
            <div class="detail-section">
                <h6>Description</h6>
                <p>${await processText(classData.description)}</p>
            </div>
            
            <div class="detail-section">
                <h6>Hit Points</h6>
                <p>Hit Dice: ${classData.hitDice}</p>
            </div>

            <div class="detail-section">
                <h6>Proficiencies</h6>
                ${displayProficiencies(classData.proficiencies)}
            </div>

            <div class="detail-section">
                <h6>Features</h6>
                ${await displayFeatures(classData.features, level)}
            </div>

            ${classData.spellcasting ? `
                <div class="detail-section">
                    <h6>Spellcasting</h6>
                    ${displaySpellcasting(classData.spellcasting, level)}
                </div>
            ` : ''}

            ${subclassData ? `
                <div class="detail-section">
                    <h6>${subclassData.name}</h6>
                    <p>${await processText(subclassData.description)}</p>
                    ${await displayFeatures(subclassData.features, level)}
                </div>
            ` : ''}
        </div>
    `;

    container.innerHTML = html;
}

// Helper functions for UI display
function displayProficiencies(proficiencies) {
    let html = '<ul>';

    if (proficiencies.armor.length > 0) {
        html += `<li><strong>Armor:</strong> ${proficiencies.armor.join(', ')}</li>`;
    }

    if (proficiencies.weapons.length > 0) {
        html += `<li><strong>Weapons:</strong> ${proficiencies.weapons.join(', ')}</li>`;
    }

    if (proficiencies.tools.length > 0) {
        html += `<li><strong>Tools:</strong> ${proficiencies.tools.join(', ')}</li>`;
    }

    if (proficiencies.savingThrows.length > 0) {
        html += `<li><strong>Saving Throws:</strong> ${proficiencies.savingThrows.join(', ')}</li>`;
    }

    if (proficiencies.skills.choices > 0) {
        html += `
            <li>
                <strong>Skills:</strong> Choose ${proficiencies.skills.choices} from 
                ${proficiencies.skills.from.join(', ')}
            </li>
        `;
    }

    html += '</ul>';
    return html;
}

async function displayFeatures(features, level) {
    let html = '<ul class="feature-list">';
    
    for (const levelFeatures of features) {
        if (levelFeatures.level <= level) {
            for (const feature of levelFeatures.features) {
                html += `
                    <li>
                        <strong>${feature.name} (Level ${levelFeatures.level}):</strong>
                        <div class="feature-description">
                            ${await processText(feature.description)}
                        </div>
                    </li>
                `;
            }
        }
    }

    html += '</ul>';
    return html;
}

function displaySpellcasting(spellcasting, level) {
    let html = `
        <ul>
            <li><strong>Spellcasting Ability:</strong> ${spellcasting.ability}</li>
            <li><strong>Cantrips Known:</strong> ${spellcasting.cantripProgression[level - 1]}</li>
    `;

    if (spellcasting.spellsKnownProgression) {
        html += `
            <li><strong>Spells Known:</strong> ${spellcasting.spellsKnownProgression[level - 1]}</li>
        `;
    }

    html += '</ul>';
    return html;
}
```

## Testing Steps
1. Test class data loading:
```javascript
const classes = await window.dndDataLoader.loadClasses();
console.log('Loaded classes:', classes);
```

2. Test class selection:
```javascript
await updateClassDetails('fighter', 1);
console.log('Character after class update:', currentCharacter);
```

3. Test UI display:
```javascript
await displayClassDetails('wizard', 3, 'school-of-evocation');
```

## Implementation Order
1. Enhance class data loading
2. Update character class management
3. Enhance class UI components
4. Test with various classes and subclasses