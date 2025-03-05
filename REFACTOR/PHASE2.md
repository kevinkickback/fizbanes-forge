# Phase 2: Race System Integration

## Overview
Enhance race data loading and processing to work with the existing infrastructure and reference system.

## Integration Notes

### 1. HTML Template Integration (index.html)
- **Action**: Modify existing race templates
- **Files Affected**: `index.html`
  - Keep: Basic race selection form
  - Keep: Race variant handling
  - Modify: Race details section to use EntityCard
  - Remove: Duplicate race templates
  - Add: Subrace selection components

### 2. Character Management (character.js)
- **Action**: Hybrid approach - merge and enhance
- **Files Affected**: `character.js`
  - Keep: Basic race state management
  - Keep: Race selection event handlers
  - Modify: Race update functions to use new system
  - Remove: Old race card creation
  - Add: New race management class after character state

### 3. Utility Functions (utils.js)
- **Action**: Enhance existing utilities
- **Files Affected**: `utils.js`
  - Keep: Race-related helper functions
  - Keep: Race validation functions
  - Modify: Race data processing to use unified system
  - Add: New race-specific reference functions
  - Add: Race tooltip enhancements

### 4. CSS Integration (main.css)
- **Action**: Merge styles strategically
- **Files Affected**: `main.css`
  - Keep: Basic race card styles
  - Keep: Race selection form styles
  - Modify: Race details to use unified system
  - Remove: Duplicate race-specific styles
  - Add: New race EntityCard styles
  - Add: Subrace-specific styles

### 5. Data Loading System
- **Action**: Enhance existing system
- **Files Affected**: `data-loader.js`
  - Keep: Basic race loading
  - Keep: Race cache management
  - Modify: Race processing to use unified system
  - Add: Subrace data processing
  - Add: Race-specific tooltip data

## Specific Integration Points

### Race Management System
```javascript
class RaceManager {
    // New unified race management system
}
```

### Race Data Processing
```javascript
// Enhances existing processRace function in utils.js
// Adds new functionality while maintaining existing processing
async function processRaceData(race, fluff) {
    // New race processing system
}
```

### Event Handling
```javascript
// Modifies existing race event setup in utils.js
function setupRaceEventHandlers() {
    // Enhanced race event handling
}
```

### CSS Structure
```css
/* Merges with existing race styles in main.css */
.race-card {
    /* New unified race styles */
}

/* Adds new subrace styles */
.subrace-section {
    /* New subrace styles */
}
```

## Parallel Structure Strategy

### Directory Structure
For this phase, implement the following directory structure alongside the existing files:
```
app/
├── js/
│   ├── core/
│   │   ├── managers/           # Manager classes
│   │   │   ├── RaceManager.js
│   │   │   └── AbilityManager.js
│   │   ├── models/            # Data models
│   │   │   ├── Race.js
│   │   │   └── Subrace.js
│   │   └── services/          # Business logic
│   │       └── RaceService.js
│   └── character.js           # Existing file (will gradually migrate)
```

### Migration Steps
1. Create the race-specific directory structure
2. Move race management to `core/managers/RaceManager.js`
3. Move ability score management to `core/managers/AbilityManager.js`
4. Create race models in `core/models/`
5. Move race-specific business logic to `core/services/RaceService.js`

### Compatibility Layer
In `character.js`, add forwarding functions to maintain backward compatibility:
```javascript
// Import new modules
import { RaceManager } from './core/managers/RaceManager.js';
import { AbilityManager } from './core/managers/AbilityManager.js';
// ... other imports

// Initialize managers
const raceManager = new RaceManager(currentCharacter);
const abilityManager = new AbilityManager(currentCharacter);

// Forward existing functions to new implementations
async function updateRaceDetails(race, subrace) {
    return await raceManager.setRace(race, subrace);
}

function checkRaceAbilityChoices() {
    return raceManager.checkPendingChoices();
}
// ... other forwarding functions
```

### Testing Strategy
1. Write tests for new race management modules
2. Ensure existing race functionality works through compatibility layer
3. Add new tests for enhanced race features
4. Verify no regressions in existing race functionality

## Implementation Steps

### 1. Enhance Race Data Loading
Update the existing loadRaces function in data-loader.js:

```javascript
// Enhance existing loadRaces function
async function loadRaces() {
    if (dataCache.races) {
        return dataCache.races;
    }

    try {
        // Load main race data and fluff
        const raceData = await loadJsonFile('data/races.json');
        const fluffData = await loadJsonFile('data/fluff-races.json').catch(() => ({}));

        // Process each race
        const processedRaces = await Promise.all((raceData.race || []).map(async race => {
            // Get fluff data for this race
        const fluff = fluffData.raceFluff?.find(f => 
                f.name === race.name && f.source === race.source
            );
            
            return processRaceData(race, fluff);
        }));

        // Cache and return
        dataCache.races = processedRaces;
        return processedRaces;
    } catch (error) {
        console.error('Error loading race data:', error);
        throw error;
    }
}

// Add helper function for processing race data
async function processRaceData(race, fluff = null) {
    // Process basic properties
    const processed = {
        id: race.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: race.name,
        source: race.source || 'PHB',
        page: race.page,
        size: Array.isArray(race.size) ? race.size[0] : race.size || 'M',
        speed: processSpeed(race.speed),
        description: await processText(fluff?.entries?.[0] || ''),
        traits: [],
        abilityScores: processAbilityScores(race.ability),
        languages: processLanguages(race.languageProficiencies),
        proficiencies: processProficiencies(race),
        features: {
        darkvision: race.darkvision || 0,
        resistances: race.resist || [],
            additionalSpells: processSpells(race.additionalSpells)
        }
    };

    // Process traits
    if (race.entries) {
        for (const entry of race.entries) {
            if (entry.type === 'entries' && entry.name) {
                processed.traits.push({
                    name: entry.name,
                    description: await processText(entry.entries)
                });
            }
        }
    }

    // Process subraces if any
    if (race.subraces?.length > 0) {
        processed.subraces = await Promise.all(
            race.subraces.map(async subrace => {
                const subraceFluff = fluff?.subraces?.find(f => 
                    f.name === subrace.name && f.source === subrace.source
                );
                return processRaceData({
                    ...subrace,
                    source: subrace.source || race.source
                }, subraceFluff);
            })
        );
    }

    return processed;
}

// Helper functions using existing infrastructure
function processSpeed(speed) {
    if (typeof speed === 'number') return { walk: speed };
    if (!speed) return { walk: 30 };

    return Object.entries(speed).reduce((acc, [type, value]) => {
        acc[type] = value === true ? 30 : value;
        return acc;
    }, {});
}

function processAbilityScores(ability) {
    if (!ability) return { fixed: {}, choices: [] };

    const result = {
        fixed: {
            strength: 0,
            dexterity: 0,
            constitution: 0,
            intelligence: 0,
            wisdom: 0,
            charisma: 0
        },
        choices: []
    };

    if (Array.isArray(ability)) {
        ability.forEach(option => {
            if (option.choose) {
                result.choices.push({
                    count: option.choose.count || 1,
                    from: option.choose.from || [],
                    amount: option.choose.amount || 1
                });
            } else {
                // Process fixed ability scores
                for (const [key, value] of Object.entries(option)) {
                    const abilityKey = key.toLowerCase();
                    if (result.fixed.hasOwnProperty(abilityKey)) {
                        result.fixed[abilityKey] += value;
                    }
                }
            }
        });
    }

    return result;
}

function processLanguages(languageProficiencies) {
    const languages = new Set(['Common']);
    
    if (languageProficiencies) {
        languageProficiencies.forEach(prof => {
            Object.entries(prof).forEach(([lang, hasProf]) => {
                if (hasProf === true) {
                    languages.add(lang.charAt(0).toUpperCase() + lang.slice(1));
                }
            });
        });
    }

    return Array.from(languages);
}

function processProficiencies(race) {
    return {
        weapons: race.weaponProficiencies || [],
        armor: race.armorProficiencies || [],
        tools: race.toolProficiencies || [],
        skills: race.skillProficiencies || []
    };
}

function processSpells(spells) {
    if (!spells) return [];

    return spells.map(spell => ({
        ability: spell.ability,
        innate: Object.entries(spell.innate || {}).map(([level, spellData]) => {
            if (typeof spellData === 'object') {
                return Object.entries(spellData).map(([uses, spellList]) => ({
                    level: parseInt(level),
                    uses: uses === 'will' ? -1 : parseInt(uses),
                    spells: spellList
                }));
            }
            return {
                level: parseInt(level),
                uses: -1,
                spells: spellData
            };
        }).flat()
    }));
}
```

### 2. Update Character Race Management
Enhance the existing race management in character.js:

```javascript
// Add to character.js
async function updateRaceDetails(race, subrace = null) {
    // Clear existing racial bonuses
    clearRacialBonuses();
    
    // Get race data
    const races = await window.dndDataLoader.loadRaces();
    const raceData = races.find(r => r.id === race);
    if (!raceData) return;

    // Get subrace data if applicable
    let subraceData = null;
    if (subrace && raceData.subraces) {
        subraceData = raceData.subraces.find(sr => sr.id === subrace);
    }

    // Apply ability scores
    applyAbilityScores(raceData.abilityScores);
    if (subraceData) {
        applyAbilityScores(subraceData.abilityScores);
    }

    // Apply speed
    Object.assign(currentCharacter.speed, raceData.speed);
    if (subraceData?.speed) {
        Object.assign(currentCharacter.speed, subraceData.speed);
    }

    // Apply traits
    for (const trait of raceData.traits) {
        addTrait(trait.name, await processText(trait.description));
    }
    if (subraceData) {
        for (const trait of subraceData.traits) {
            addTrait(trait.name, await processText(trait.description));
        }
    }

    // Apply languages
    for (const language of raceData.languages) {
        addLanguage(language);
    }

    // Apply proficiencies
    for (const type in raceData.proficiencies) {
        for (const prof of raceData.proficiencies[type]) {
            addProficiency(type, prof, `${raceData.name} race`);
        }
    }

    // Apply features
    if (raceData.features.darkvision) {
        currentCharacter.features.darkvision = Math.max(
            currentCharacter.features.darkvision,
            raceData.features.darkvision
        );
    }
    
    for (const resistance of raceData.features.resistances) {
        addResistance(resistance);
    }

    // Apply spells
    for (const spellBlock of raceData.features.additionalSpells) {
        addRacialSpells(spellBlock);
    }

    // Update character sheet
    updateCharacterSheet();
}

// Helper function for applying ability scores
function applyAbilityScores(abilityScores) {
    // Apply fixed scores
    for (const [ability, value] of Object.entries(abilityScores.fixed)) {
        if (value !== 0) {
            currentCharacter.abilityBonuses[ability] += value;
            currentCharacter.bonusSources.push({
                ability,
                bonus: value,
                source: 'Race'
            });
        }
    }

    // Store choices for UI
    if (abilityScores.choices.length > 0) {
        currentCharacter.pendingAbilityChoices = abilityScores.choices;
    }
}
```

### 3. Update Race UI
Enhance the existing race UI components:

```javascript
// Add to character.js
async function displayRaceDetails(race, subrace = null) {
    const container = document.getElementById('raceDetails');
    if (!container) return;

    // Get race data
    const races = await window.dndDataLoader.loadRaces();
    const raceData = races.find(r => r.id === race);
    if (!raceData) return;

    // Get subrace data if applicable
    let subraceData = null;
    if (subrace && raceData.subraces) {
        subraceData = raceData.subraces.find(sr => sr.id === subrace);
    }

    // Create HTML
    let html = `
        <div class="race-details-grid">
            <div class="detail-section">
                <h6>Description</h6>
                <p>${await processText(raceData.description)}</p>
            </div>
            
            <div class="detail-section">
                <h6>Ability Score Increase</h6>
                ${displayAbilityScores(raceData.abilityScores, subraceData?.abilityScores)}
            </div>

            <div class="detail-section">
                <h6>Size</h6>
                <p>${raceData.size}</p>
            </div>

            <div class="detail-section">
                <h6>Speed</h6>
                ${displaySpeed(raceData.speed, subraceData?.speed)}
            </div>

            <div class="detail-section">
                <h6>Languages</h6>
                <ul>
                    ${raceData.languages.map(lang => `<li>${lang}</li>`).join('')}
                </ul>
            </div>

            <div class="detail-section">
                <h6>Traits</h6>
                ${displayTraits(raceData.traits, subraceData?.traits)}
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Helper functions for UI display
function displayAbilityScores(mainScores, subraceScores = null) {
    let html = '<ul>';

    // Display fixed scores
    for (const [ability, value] of Object.entries(mainScores.fixed)) {
        if (value !== 0) {
            html += `<li>${ability.charAt(0).toUpperCase() + ability.slice(1)} +${value}</li>`;
        }
    }

    // Display choices
    for (const choice of mainScores.choices) {
        html += `<li>Choose ${choice.count} different abilities to increase by ${choice.amount}:</li>`;
        html += `<li class="ml-3">${choice.from.join(', ')}</li>`;
    }

    // Display subrace scores if any
    if (subraceScores) {
        for (const [ability, value] of Object.entries(subraceScores.fixed)) {
            if (value !== 0) {
                html += `<li>${ability.charAt(0).toUpperCase() + ability.slice(1)} +${value} (Subrace)</li>`;
            }
        }
    }

    html += '</ul>';
    return html;
}

function displaySpeed(mainSpeed, subraceSpeed = null) {
    const speeds = { ...mainSpeed, ...(subraceSpeed || {}) };
    return Object.entries(speeds)
        .map(([type, value]) => `${type.charAt(0).toUpperCase() + type.slice(1)}: ${value} feet`)
        .join('<br>');
}

function displayTraits(mainTraits, subraceTraits = []) {
    let html = '<ul>';
    
    for (const trait of mainTraits) {
        html += `
            <li>
                <strong>${trait.name}:</strong>
                <div class="trait-description">${trait.description}</div>
            </li>
        `;
    }

    if (subraceTraits?.length > 0) {
        html += '<li><strong>Subrace Traits:</strong></li>';
        for (const trait of subraceTraits) {
            html += `
                <li class="ml-3">
                    <strong>${trait.name}:</strong>
                    <div class="trait-description">${trait.description}</div>
                </li>
            `;
        }
    }

    html += '</ul>';
    return html;
}
```

## Testing Steps
1. Test race data loading:
```javascript
const races = await window.dndDataLoader.loadRaces();
console.log('Loaded races:', races);
```

2. Test race selection:
```javascript
await updateRaceDetails('elf');
console.log('Character after race update:', currentCharacter);
```

3. Test UI display:
```javascript
await displayRaceDetails('elf', 'high-elf');
```

## Implementation Order
1. Enhance race data loading
2. Update character race management
3. Enhance race UI components
4. Test with various races and subraces
7. Add error handling and validation