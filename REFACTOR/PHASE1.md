# Phase 1: Enhanced Reference System

## Integration Notes

### 1. HTML Template Integration (index.html)
- **Action**: Modify existing templates
- **Files Affected**: `index.html`
  - Keep: Basic card structure in `buildPage` template
  - Keep: Form layout in `detailsPage` template
  - Modify: Race/Class/Background sections to use new EntityCard system
  - Remove: Duplicate card templates
  - Add: New tooltip container div in body

### 2. Character Management (character.js)
- **Action**: Hybrid approach - merge and enhance
- **Files Affected**: `character.js`
  - Keep: Character state management
  - Keep: Save/Load functionality
  - Keep: Event handling setup
  - Modify: `updateCharacterField` to use new reference system
  - Remove: Individual card creation functions
  - Add: New EntityCard system after existing character management code

### 3. Utility Functions (utils.js)
- **Action**: Enhance existing utilities
- **Files Affected**: `utils.js`
  - Keep: Basic utility functions
  - Keep: Notification system
  - Modify: Event handling to support tooltips
  - Add: New reference resolution functions after existing utilities
  - Add: New tooltip management system at end of file

### 4. CSS Integration (main.css)
- **Action**: Merge styles strategically
- **Files Affected**: `main.css`
  - Keep: Core variables and base styles
  - Keep: Layout and grid system
  - Keep: Basic card styles
  - Modify: Card variations to use new unified system
  - Remove: Duplicate card styles
  - Add: New EntityCard styles after existing card styles
  - Add: Tooltip styles at end of file

### 5. Data Loading System
- **Action**: Enhance existing system
- **Files Affected**: `data-loader.js`
  - Keep: Basic file loading functions
  - Keep: Cache management
  - Modify: Entity processing to use new unified system
  - Add: New reference resolution system
  - Add: New tooltip data processing

## Specific Integration Points

### EntityCard System
```javascript
// Replaces these existing functions in character.js:
// - createCharacterCard
// - createRaceCard
// - createClassCard
// - createBackgroundCard

class EntityCard {
    // New unified card system
}
```

### Reference Resolution
```javascript
// Enhances existing processText function in utils.js
// Adds new functionality while maintaining existing text processing
async function resolveJsonRef(ref) {
    // New reference resolution system
}
```

### Event Handling
```javascript
// Modifies existing event setup in utils.js
function setupEventHandlers() {
    // Enhanced event handling
}
```

### CSS Structure
```css
/* Merges with existing card styles in main.css */
.entity-card {
    /* New unified card styles */
}

/* Adds new tooltip styles */
.tooltip {
    /* New tooltip styles */
}
```

## Implementation Order
1. Add core data processing functions
2. Add unified UI components
3. Add unified CSS
4. Update reference resolution
5. Add tooltip system
6. Test core functionality
7. Test integration points

## Overview
Enhance the existing reference handling system in data-loader.js to better support 5e.tools references and tooltips, with unified data processing.

## Implementation Steps

### 1. Add Core Data Processing Functions
Add unified data processing functions to data-loader.js:

```javascript
// Core data processing function for all entity types
async function processEntityData(entity, type, fluff = null) {
    const processed = {
        id: entity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: entity.name,
        source: entity.source || 'PHB',
        page: entity.page,
        description: await processText(fluff?.entries?.[0] || ''),
        type: type
    };

    // Add type-specific processing
    switch(type) {
        case 'item':
            Object.assign(processed, {
                value: processValue(entity.value),
                weight: entity.weight || 0,
                properties: processProperties(entity.property),
                attunement: processAttunement(entity.reqAttune)
            });
            break;
        case 'pack':
            processed.contents = await processPackContents(entity.items);
            break;
        case 'background':
            processed.proficiencies = processProficiencies(entity);
            processed.characteristics = await processCharacteristics(entity);
            break;
        case 'feat':
            processed.prerequisite = entity.prerequisite ? await processText(entity.prerequisite) : null;
            processed.ability = processAbilityScoreIncrease(entity.ability);
            processed.repeatable = entity.repeatable || false;
            break;
        case 'optfeature':
            processed.prerequisite = entity.prerequisite ? await processText(entity.prerequisite) : null;
            processed.featureType = entity.featureType || 'Unknown';
            processed.className = entity.className || null;
            processed.level = entity.level || null;
            break;
        case 'class':
            Object.assign(processed, {
                hitDice: entity.hd?.number && entity.hd?.faces ? 
                    `${entity.hd.number}d${entity.hd.faces}` : 'd10',
                proficiencies: processProficiencies(entity),
                startingEquipment: processStartingEquipment(entity.startingEquipment),
                features: await processFeatures(entity.classFeatures),
                spellcasting: processSpellcasting(entity.spellcasting),
                subclasses: await Promise.all((entity.subclasses || []).map(async sc => 
                    processEntityData(sc, 'subclass', fluff?.subclasses?.find(f => 
                        f.name === sc.name && f.source === sc.source
                    ))
                ))
            });
            break;
        case 'subclass':
            Object.assign(processed, {
                features: await processFeatures(entity.subclassFeatures),
                spellcasting: processSpellcasting(entity.spellcasting)
            });
            break;
        case 'race':
            Object.assign(processed, {
                size: Array.isArray(entity.size) ? entity.size[0] : entity.size || 'M',
                speed: processSpeed(entity.speed),
                ability: processAbilityScoreIncrease(entity.ability),
                proficiencies: processProficiencies(entity),
                traits: await processTraits(entity.traits),
                features: {
                    darkvision: entity.darkvision || 0,
                    resistances: entity.resist || [],
                    additionalSpells: processSpells(entity.additionalSpells)
                },
                subraces: await Promise.all((entity.subraces || []).map(async sr => 
                    processEntityData(sr, 'subrace', fluff?.subraces?.find(f => 
                        f.name === sr.name && f.source === sr.source
                    ))
                ))
            });
            break;
        case 'subrace':
            Object.assign(processed, {
                parentRace: entity.parentRace,
                ability: processAbilityScoreIncrease(entity.ability),
                proficiencies: processProficiencies(entity),
                traits: await processTraits(entity.traits)
            });
            break;
    }

    return processed;
}

// Unified proficiency processing
function processProficiencies(entity) {
    return {
        skills: processSkillProficiencies(entity.skillProficiencies),
        tools: processToolProficiencies(entity.toolProficiencies),
        languages: processLanguageProficiencies(entity.languageProficiencies),
        weapons: entity.weaponProficiencies || [],
        armor: entity.armorProficiencies || []
    };
}

function processSkillProficiencies(proficiencies) {
    if (!proficiencies) return { fixed: [], choices: [] };

    return {
        fixed: Array.isArray(proficiencies) ? proficiencies : [],
        choices: proficiencies?.choose ? [{
            count: proficiencies.choose.count || 1,
            from: proficiencies.choose.from || []
        }] : []
    };
}

// Unified value processing
function processValue(value) {
    if (!value) return { amount: 0, coin: 'gp' };
    if (typeof value === 'number') return { amount: value, coin: 'gp' };
    
    const match = String(value).match(/(\d+)\s*([a-z]{2})/i);
    return match ? {
        amount: parseInt(match[1]),
        coin: match[2].toLowerCase()
    } : { amount: 0, coin: 'gp' };
}

// Unified property processing
function processProperties(properties) {
    if (!properties) return [];
    return Array.isArray(properties) ? properties : [properties];
}

// Unified ability score processing
function processAbilityScoreIncrease(ability) {
    if (!ability) return null;

    return ability.map(a => ({
        scores: a.improve?.map(i => i.abilityScore) || [],
        amount: a.improve?.[0]?.amount || 1,
        mode: a.mode || 'fixed'
    }));
}

// Add new processing functions
async function processFeatures(features) {
    if (!features) return [];
    
    return Promise.all(features.map(async level => ({
        level: level.level,
        features: await Promise.all(level.features.map(async feature => ({
            name: feature.name,
            description: await processText(feature.entries)
        })))
    })));
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

function processSpeed(speed) {
    if (typeof speed === 'number') return { walk: speed };
    if (!speed) return { walk: 30 };

    return Object.entries(speed).reduce((acc, [type, value]) => {
        acc[type] = value === true ? 30 : value;
        return acc;
    }, {});
}

async function processTraits(traits) {
    if (!traits) return [];

    return Promise.all(traits.map(async trait => ({
        name: trait.name,
        description: await processText(trait.entries)
    })));
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

// ... existing resolveJsonRef and other functions ...

async function resolveJsonRef(ref) {
    const match = ref.match(/{@(\w+)\s+([^}]+)}/);
    if (!match) return ref;

    const [fullMatch, tag, content] = match;
    const [name, source = 'PHB', ...rest] = content.split('|');

    // Check cache
    const cacheKey = `${tag}:${name}:${source}`;
    if (dataCache.itemRefs.has(cacheKey)) {
        return dataCache.itemRefs.get(cacheKey);
    }

    try {
        let entity = null;
        let tooltipData = null;

        // Load and process entity
    switch (tag) {
            case 'item':
            case 'equipment':
            case 'pack': {
                const items = await window.dndDataLoader.loadItems();
                entity = items.find(i => i.name.toLowerCase() === name.toLowerCase());
            break;
            }
            case 'background': {
                const backgrounds = await window.dndDataLoader.loadBackgrounds();
                entity = backgrounds.find(b => b.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'feat': {
                const feats = await window.dndDataLoader.loadFeats();
                entity = feats.find(f => f.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'optfeature': {
                const features = await window.dndDataLoader.loadOptionalFeatures();
                entity = features.find(f => f.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'class': {
                const classes = await window.dndDataLoader.loadClasses();
                entity = classes.find(c => c.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'subclass': {
                const classes = await window.dndDataLoader.loadClasses();
                for (const cls of classes) {
                    entity = cls.subclasses?.find(sc => sc.name.toLowerCase() === name.toLowerCase());
                    if (entity) break;
                }
                break;
            }
            case 'race': {
                const races = await window.dndDataLoader.loadRaces();
                entity = races.find(r => r.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'subrace': {
                const races = await window.dndDataLoader.loadRaces();
                for (const race of races) {
                    entity = race.subraces?.find(sr => sr.name.toLowerCase() === name.toLowerCase());
                    if (entity) break;
                }
                break;
            }
        }

        // Create tooltip if entity found
        if (entity) {
            tooltipData = {
                title: entity.name,
                description: entity.description,
                source: `${source}, page ${entity.page || '??'}`
            };

            // Add type-specific tooltip data
            switch (entity.type) {
        case 'item':
                case 'equipment':
                    tooltipData.properties = entity.properties;
                    tooltipData.value = entity.value;
                    break;
                case 'pack':
                    tooltipData.contents = entity.contents;
                    break;
                case 'feat':
                    tooltipData.prerequisite = entity.prerequisite;
                    tooltipData.ability = entity.ability;
                    break;
                case 'optfeature':
                    tooltipData.featureType = entity.featureType;
                    tooltipData.prerequisite = entity.prerequisite;
            break;
        case 'class':
                    tooltipData.hitDice = entity.hitDice;
                    tooltipData.spellcasting = entity.spellcasting?.ability;
                    break;
                case 'subclass':
                    tooltipData.parentClass = entity.parentClass;
                    tooltipData.spellcasting = entity.spellcasting?.ability;
            break;
        case 'race':
                    tooltipData.size = entity.size;
                    tooltipData.speed = entity.speed;
                    tooltipData.ability = entity.ability;
            break;
                case 'subrace':
                    tooltipData.parentRace = entity.parentRace;
                    tooltipData.ability = entity.ability;
            break;
            }
        }

        // Create tooltip element
        const result = tooltipData ? 
            createTooltipElement(tag, name, tooltipData) : 
            name;

        // Cache and return
        dataCache.itemRefs.set(cacheKey, result);
    return result;
    } catch (error) {
        console.warn(`Error resolving reference ${fullMatch}:`, error);
        return name;
    }
}

function createTooltipElement(type, text, data) {
    let tooltipContent = data.description || '';

    // Add type-specific content
    switch (type) {
        case 'item':
        case 'equipment':
            if (data.properties?.length > 0) {
                tooltipContent += `\n\nProperties: ${data.properties.map(p => 
                    typeof p === 'string' ? p : p.name
                ).join(', ')}`;
            }
            if (data.value) {
                tooltipContent += `\n\nValue: ${data.value.amount} ${data.value.coin}`;
            }
            break;
        case 'pack':
            if (data.contents?.length > 0) {
                tooltipContent += '\n\nContents:\n' + data.contents.map(item => 
                    `• ${item.quantity || 1}× ${item.name}`
                ).join('\n');
            }
            break;
        case 'feat':
            if (data.prerequisite) {
                tooltipContent += `\n\nPrerequisites: ${data.prerequisite}`;
            }
            if (data.ability) {
                tooltipContent += `\n\nAbility Score Improvement: ${data.ability}`;
            }
            break;
        case 'optfeature':
            if (data.featureType) {
                tooltipContent += `\n\nType: ${data.featureType}`;
            }
            if (data.prerequisite) {
                tooltipContent += `\n\nPrerequisites: ${data.prerequisite}`;
            }
            break;
        case 'class':
            tooltipContent += `\n\nHit Dice: ${data.hitDice}`;
            if (data.spellcasting) {
                tooltipContent += `\n\nSpellcasting Ability: ${data.spellcasting}`;
            }
            break;
        case 'subclass':
            if (data.parentClass) {
                tooltipContent += `\n\nClass: ${data.parentClass}`;
            }
            if (data.spellcasting) {
                tooltipContent += `\n\nSpellcasting Ability: ${data.spellcasting}`;
            }
            break;
        case 'race':
            tooltipContent += `\n\nSize: ${data.size}`;
            if (data.speed.walk) {
                tooltipContent += `\n\nSpeed: ${data.speed.walk} feet`;
            }
            if (data.ability) {
                tooltipContent += `\n\nAbility Score Increase: ${data.ability}`;
            }
            break;
        case 'subrace':
            if (data.parentRace) {
                tooltipContent += `\n\nRace: ${data.parentRace}`;
            }
            if (data.ability) {
                tooltipContent += `\n\nAbility Score Increase: ${data.ability}`;
            }
            break;
    }

    return `<span class="reference-link ${type}-reference" 
                  data-tooltip="${tooltipContent}"
                  data-source="${data.source || ''}">${text}</span>`;
}
```

### 2. Add Unified UI Components
Add shared UI components to utils.js:

```javascript
class EntityCard {
    constructor(container, entity, manager) {
        this.container = container;
        this.entity = entity;
        this.manager = manager;
    }

    render() {
        return `
            <div class="entity-card ${this.entity.type}-card" data-id="${this.entity.id}">
                <div class="card-header">
                    <h4>${this.entity.name}</h4>
                    ${this.renderHeaderExtras()}
                </div>
                <div class="card-body">
                    ${this.renderBody()}
                </div>
                <div class="card-footer">
                    ${this.renderFooter()}
                </div>
            </div>
        `;
    }

    renderHeaderExtras() {
        switch(this.entity.type) {
            case 'pack':
                return `<span class="quantity">×${this.entity.quantity}</span>`;
            case 'feat':
                return this.entity.count > 1 ? `<span class="count">×${this.entity.count}</span>` : '';
            default:
                return '';
        }
    }

    renderBody() {
        const description = this.entity.description ? 
            `<div class="description">${this.entity.description}</div>` : '';

        switch(this.entity.type) {
            case 'pack':
                return `
                    ${description}
                    <div class="pack-contents">
                        ${this.renderPackContents()}
                    </div>
                `;
            case 'feat':
                return `
                    ${description}
                    ${this.entity.prerequisite ? 
                        `<div class="prerequisite">Prerequisite: ${this.entity.prerequisite}</div>` : 
                        ''}
                    ${this.entity.ability ? this.renderAbilityScores() : ''}
                `;
            case 'class':
                return `
                    ${description}
                    <div class="class-details">
                        <p>Hit Dice: ${this.entity.hitDice}</p>
                        ${this.renderProficiencies(this.entity.proficiencies)}
                        ${this.renderFeatures(this.entity.features)}
                        ${this.entity.spellcasting ? this.renderSpellcasting(this.entity.spellcasting) : ''}
                    </div>
                `;
            case 'race':
                return `
                    ${description}
                    <div class="race-details">
                        <p>Size: ${this.entity.size}</p>
                        ${this.renderSpeed(this.entity.speed)}
                        ${this.renderAbilityScores(this.entity.ability)}
                        ${this.renderTraits(this.entity.traits)}
                        ${this.entity.features.darkvision ? `<p>Darkvision: ${this.entity.features.darkvision} feet</p>` : ''}
                    </div>
                `;
            default:
                return description;
        }
    }

    renderFooter() {
        return `
            <div class="actions">
                ${this.renderActions()}
            </div>
        `;
    }

    renderActions() {
        switch(this.entity.type) {
            case 'pack':
                return `
                    <button class="btn btn-sm btn-primary unpack-btn">Unpack</button>
                    <button class="btn btn-sm btn-danger remove-btn">Remove</button>
                `;
            case 'feat':
                return `
                    <button class="btn btn-sm btn-danger remove-btn">Remove</button>
                `;
            default:
                return '';
        }
    }

    renderSpeed(speed) {
        return `
            <div class="speed">
                ${Object.entries(speed).map(([type, value]) => 
                    `<p>${type.charAt(0).toUpperCase() + type.slice(1)} Speed: ${value} feet</p>`
                ).join('')}
            </div>
        `;
    }

    renderFeatures(features) {
        if (!features?.length) return '';

        return `
            <div class="features">
                <h5>Features</h5>
                ${features.map(level => `
                    <div class="feature-level">
                        <h6>Level ${level.level}</h6>
                        ${level.features.map(feature => `
                            <div class="feature">
                                <strong>${feature.name}:</strong>
                                <div class="feature-description">${feature.description}</div>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderSpellcasting(spellcasting) {
        return `
            <div class="spellcasting">
                <h5>Spellcasting</h5>
                <p>Ability: ${spellcasting.ability}</p>
                <p>Progression: ${spellcasting.progression}</p>
            </div>
        `;
    }

    renderTraits(traits) {
        if (!traits?.length) return '';

        return `
            <div class="traits">
                <h5>Traits</h5>
                ${traits.map(trait => `
                    <div class="trait">
                        <strong>${trait.name}:</strong>
                        <div class="trait-description">${trait.description}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}
```

### 3. Add Unified CSS
Add to main.css:

```css
/* Entity Cards */
.entity-card {
    background: var(--bg-secondary);
    border-radius: 0.25rem;
    padding: 1rem;
    margin-bottom: 1rem;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.card-body {
    margin: 0.5rem 0;
}

.card-footer {
    margin-top: 1rem;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}

/* Type-specific styles */
.pack-card .pack-contents {
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
}

.feat-card .prerequisite {
    font-style: italic;
    color: var(--text-muted);
    margin: 0.5rem 0;
}

/* Shared components */
.quantity,
.count {
    color: var(--text-muted);
    font-size: 0.9em;
}

.description {
    margin-bottom: 1rem;
}

.actions {
    display: flex;
    gap: 0.5rem;
}

/* Add to type-specific styles */
.class-card .class-details,
.race-card .race-details {
    padding: 0.5rem;
    background: var(--bg-tertiary);
    border-radius: 0.25rem;
    margin: 0.5rem 0;
}

.features,
.traits {
    margin-top: 1rem;
}

.feature-level,
.trait {
    margin-bottom: 1rem;
}

.feature-description,
.trait-description {
    margin-left: 1rem;
    margin-top: 0.25rem;
}

.spellcasting {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

/* Add to reference type-specific styles */
.class-reference {
    color: var(--color-class);
}

.race-reference {
    color: var(--color-race);
}

.subclass-reference {
    color: var(--color-subclass);
}

.subrace-reference {
    color: var(--color-subrace);
}
```

### 4. Update Reference Resolution
Update the existing resolveJsonRef function in data-loader.js:

```javascript
async function resolveJsonRef(ref) {
    const match = ref.match(/{@(\w+)\s+([^}]+)}/);
    if (!match) return ref;

    const [fullMatch, tag, content] = match;
    const [name, source = 'PHB', ...rest] = content.split('|');

    // Check cache
    const cacheKey = `${tag}:${name}:${source}`;
    if (dataCache.itemRefs.has(cacheKey)) {
        return dataCache.itemRefs.get(cacheKey);
    }

    try {
        let entity = null;
        let tooltipData = null;

        // Load and process entity
        switch (tag) {
            case 'item':
            case 'equipment':
            case 'pack': {
                const items = await window.dndDataLoader.loadItems();
                entity = items.find(i => i.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'background': {
                const backgrounds = await window.dndDataLoader.loadBackgrounds();
                entity = backgrounds.find(b => b.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'feat': {
                const feats = await window.dndDataLoader.loadFeats();
                entity = feats.find(f => f.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'optfeature': {
                const features = await window.dndDataLoader.loadOptionalFeatures();
                entity = features.find(f => f.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'class': {
                const classes = await window.dndDataLoader.loadClasses();
                entity = classes.find(c => c.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'subclass': {
                const classes = await window.dndDataLoader.loadClasses();
                for (const cls of classes) {
                    entity = cls.subclasses?.find(sc => sc.name.toLowerCase() === name.toLowerCase());
                    if (entity) break;
                }
                break;
            }
            case 'race': {
                const races = await window.dndDataLoader.loadRaces();
                entity = races.find(r => r.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'subrace': {
                const races = await window.dndDataLoader.loadRaces();
                for (const race of races) {
                    entity = race.subraces?.find(sr => sr.name.toLowerCase() === name.toLowerCase());
                    if (entity) break;
                }
                break;
            }
        }

        // Create tooltip if entity found
        if (entity) {
            tooltipData = {
                title: entity.name,
                description: entity.description,
                source: `${source}, page ${entity.page || '??'}`
            };

            // Add type-specific tooltip data
            switch (entity.type) {
                case 'item':
                case 'equipment':
                    tooltipData.properties = entity.properties;
                    tooltipData.value = entity.value;
                    break;
                case 'pack':
                    tooltipData.contents = entity.contents;
                    break;
                case 'feat':
                    tooltipData.prerequisite = entity.prerequisite;
                    tooltipData.ability = entity.ability;
                    break;
                case 'optfeature':
                    tooltipData.featureType = entity.featureType;
                    tooltipData.prerequisite = entity.prerequisite;
                    break;
                case 'class':
                    tooltipData.hitDice = entity.hitDice;
                    tooltipData.spellcasting = entity.spellcasting?.ability;
                    break;
                case 'subclass':
                    tooltipData.parentClass = entity.parentClass;
                    tooltipData.spellcasting = entity.spellcasting?.ability;
                    break;
                case 'race':
                    tooltipData.size = entity.size;
                    tooltipData.speed = entity.speed;
                    tooltipData.ability = entity.ability;
                    break;
                case 'subrace':
                    tooltipData.parentRace = entity.parentRace;
                    tooltipData.ability = entity.ability;
                    break;
            }
        }

        // Create tooltip element
        const result = tooltipData ? 
            createTooltipElement(tag, name, tooltipData) : 
            name;

        // Cache and return
        dataCache.itemRefs.set(cacheKey, result);
        return result;
    } catch (error) {
        console.warn(`Error resolving reference ${fullMatch}:`, error);
        return name;
    }
}

function createTooltipElement(type, text, data) {
    let tooltipContent = data.description || '';

    // Add type-specific content
    switch (type) {
        case 'item':
        case 'equipment':
            if (data.properties?.length > 0) {
                tooltipContent += `\n\nProperties: ${data.properties.map(p => 
                    typeof p === 'string' ? p : p.name
                ).join(', ')}`;
            }
            if (data.value) {
                tooltipContent += `\n\nValue: ${data.value.amount} ${data.value.coin}`;
            }
            break;
        case 'pack':
            if (data.contents?.length > 0) {
                tooltipContent += '\n\nContents:\n' + data.contents.map(item => 
                    `• ${item.quantity || 1}× ${item.name}`
                ).join('\n');
            }
            break;
        case 'feat':
            if (data.prerequisite) {
                tooltipContent += `\n\nPrerequisites: ${data.prerequisite}`;
            }
            if (data.ability) {
                tooltipContent += `\n\nAbility Score Improvement: ${data.ability}`;
            }
            break;
        case 'optfeature':
            if (data.featureType) {
                tooltipContent += `\n\nType: ${data.featureType}`;
            }
            if (data.prerequisite) {
                tooltipContent += `\n\nPrerequisites: ${data.prerequisite}`;
            }
            break;
        case 'class':
            tooltipContent += `\n\nHit Dice: ${data.hitDice}`;
            if (data.spellcasting) {
                tooltipContent += `\n\nSpellcasting Ability: ${data.spellcasting}`;
            }
            break;
        case 'subclass':
            if (data.parentClass) {
                tooltipContent += `\n\nClass: ${data.parentClass}`;
            }
            if (data.spellcasting) {
                tooltipContent += `\n\nSpellcasting Ability: ${data.spellcasting}`;
            }
            break;
        case 'race':
            tooltipContent += `\n\nSize: ${data.size}`;
            if (data.speed.walk) {
                tooltipContent += `\n\nSpeed: ${data.speed.walk} feet`;
            }
            if (data.ability) {
                tooltipContent += `\n\nAbility Score Increase: ${data.ability}`;
            }
            break;
        case 'subrace':
            if (data.parentRace) {
                tooltipContent += `\n\nRace: ${data.parentRace}`;
            }
            if (data.ability) {
                tooltipContent += `\n\nAbility Score Increase: ${data.ability}`;
            }
            break;
    }

    return `<span class="reference-link ${type}-reference" 
                  data-tooltip="${tooltipContent}"
                  data-source="${data.source || ''}">${text}</span>`;
}
```

### 5. Update Reference Resolution
Update the existing resolveJsonRef function in data-loader.js:

```javascript
async function resolveJsonRef(ref) {
    const match = ref.match(/{@(\w+)\s+([^}]+)}/);
    if (!match) return ref;

    const [fullMatch, tag, content] = match;
    const [name, source = 'PHB', ...rest] = content.split('|');

    // Check cache
    const cacheKey = `${tag}:${name}:${source}`;
    if (dataCache.itemRefs.has(cacheKey)) {
        return dataCache.itemRefs.get(cacheKey);
    }

    try {
        let entity = null;
        let tooltipData = null;

        // Load and process entity
        switch (tag) {
            case 'item':
            case 'equipment':
            case 'pack': {
                const items = await window.dndDataLoader.loadItems();
                entity = items.find(i => i.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'background': {
                const backgrounds = await window.dndDataLoader.loadBackgrounds();
                entity = backgrounds.find(b => b.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'feat': {
                const feats = await window.dndDataLoader.loadFeats();
                entity = feats.find(f => f.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'optfeature': {
                const features = await window.dndDataLoader.loadOptionalFeatures();
                entity = features.find(f => f.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'class': {
                const classes = await window.dndDataLoader.loadClasses();
                entity = classes.find(c => c.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'subclass': {
                const classes = await window.dndDataLoader.loadClasses();
                for (const cls of classes) {
                    entity = cls.subclasses?.find(sc => sc.name.toLowerCase() === name.toLowerCase());
                    if (entity) break;
                }
                break;
            }
            case 'race': {
                const races = await window.dndDataLoader.loadRaces();
                entity = races.find(r => r.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'subrace': {
                const races = await window.dndDataLoader.loadRaces();
                for (const race of races) {
                    entity = race.subraces?.find(sr => sr.name.toLowerCase() === name.toLowerCase());
                    if (entity) break;
                }
                break;
            }
        }

        // Create tooltip if entity found
        if (entity) {
            tooltipData = {
                title: entity.name,
                description: entity.description,
                source: `${source}, page ${entity.page || '??'}`
            };

            // Add type-specific tooltip data
            switch (entity.type) {
                case 'item':
                case 'equipment':
                    tooltipData.properties = entity.properties;
                    tooltipData.value = entity.value;
                    break;
                case 'pack':
                    tooltipData.contents = entity.contents;
                    break;
                case 'feat':
                    tooltipData.prerequisite = entity.prerequisite;
                    tooltipData.ability = entity.ability;
                    break;
                case 'optfeature':
                    tooltipData.featureType = entity.featureType;
                    tooltipData.prerequisite = entity.prerequisite;
                    break;
                case 'class':
                    tooltipData.hitDice = entity.hitDice;
                    tooltipData.spellcasting = entity.spellcasting?.ability;
                    break;
                case 'subclass':
                    tooltipData.parentClass = entity.parentClass;
                    tooltipData.spellcasting = entity.spellcasting?.ability;
                    break;
                case 'race':
                    tooltipData.size = entity.size;
                    tooltipData.speed = entity.speed;
                    tooltipData.ability = entity.ability;
                    break;
                case 'subrace':
                    tooltipData.parentRace = entity.parentRace;
                    tooltipData.ability = entity.ability;
                    break;
            }
        }

        // Create tooltip element
        const result = tooltipData ? 
            createTooltipElement(tag, name, tooltipData) : 
            name;

        // Cache and return
        dataCache.itemRefs.set(cacheKey, result);
        return result;
    } catch (error) {
        console.warn(`Error resolving reference ${fullMatch}:`, error);
        return name;
    }
}

function createTooltipElement(type, text, data) {
    let tooltipContent = data.description || '';

    // Add type-specific content
    switch (type) {
        case 'item':
        case 'equipment':
            if (data.properties?.length > 0) {
                tooltipContent += `\n\nProperties: ${data.properties.map(p => 
                    typeof p === 'string' ? p : p.name
                ).join(', ')}`;
            }
            if (data.value) {
                tooltipContent += `\n\nValue: ${data.value.amount} ${data.value.coin}`;
            }
            break;
        case 'pack':
            if (data.contents?.length > 0) {
                tooltipContent += '\n\nContents:\n' + data.contents.map(item => 
                    `• ${item.quantity || 1}× ${item.name}`
                ).join('\n');
            }
            break;
        case 'feat':
            if (data.prerequisite) {
                tooltipContent += `\n\nPrerequisites: ${data.prerequisite}`;
            }
            if (data.ability) {
                tooltipContent += `\n\nAbility Score Improvement: ${data.ability}`;
            }
            break;
        case 'optfeature':
            if (data.featureType) {
                tooltipContent += `\n\nType: ${data.featureType}`;
            }
            if (data.prerequisite) {
                tooltipContent += `\n\nPrerequisites: ${data.prerequisite}`;
            }
            break;
        case 'class':
            tooltipContent += `\n\nHit Dice: ${data.hitDice}`;
            if (data.spellcasting) {
                tooltipContent += `\n\nSpellcasting Ability: ${data.spellcasting}`;
            }
            break;
        case 'subclass':
            if (data.parentClass) {
                tooltipContent += `\n\nClass: ${data.parentClass}`;
            }
            if (data.spellcasting) {
                tooltipContent += `\n\nSpellcasting Ability: ${data.spellcasting}`;
            }
            break;
        case 'race':
            tooltipContent += `\n\nSize: ${data.size}`;
            if (data.speed.walk) {
                tooltipContent += `\n\nSpeed: ${data.speed.walk} feet`;
            }
            if (data.ability) {
                tooltipContent += `\n\nAbility Score Increase: ${data.ability}`;
            }
            break;
        case 'subrace':
            if (data.parentRace) {
                tooltipContent += `\n\nRace: ${data.parentRace}`;
            }
            if (data.ability) {
                tooltipContent += `\n\nAbility Score Increase: ${data.ability}`;
            }
            break;
    }

    return `<span class="reference-link ${type}-reference" 
                  data-tooltip="${tooltipContent}"
                  data-source="${data.source || ''}">${text}</span>`;
}
```

### 6. Add Event Handlers
Add tooltip event handlers to utils.js:

```javascript
function setupTooltips() {
    document.addEventListener('mouseover', handleTooltipMouseOver);
    document.addEventListener('mouseout', handleTooltipMouseOut);
}

function handleTooltipMouseOver(event) {
    const target = event.target.closest('[data-tooltip]');
    if (!target) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = target.dataset.tooltip;
    
    if (target.dataset.source) {
        const source = document.createElement('div');
        source.className = 'tooltip-source';
        source.textContent = target.dataset.source;
        tooltip.appendChild(source);
    }

    document.body.appendChild(tooltip);
    positionTooltip(tooltip, target);
}

function handleTooltipMouseOut(event) {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

function positionTooltip(tooltip, target) {
    const rect = target.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    tooltip.style.top = rect.top + scrollTop - tooltip.offsetHeight - 10 + 'px';
    tooltip.style.left = rect.left + scrollLeft + (rect.width - tooltip.offsetWidth) / 2 + 'px';
}
```

### 7. Add Additional CSS
Add tooltip styles to main.css:

```css
/* Tooltips */
.tooltip {
    position: absolute;
    z-index: 1000;
    background: var(--bg-tooltip);
    color: var(--text-primary);
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    max-width: 300px;
    font-size: 0.9em;
    line-height: 1.4;
    white-space: pre-wrap;
}

.tooltip-source {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.8em;
    color: var(--text-muted);
}

.reference-link {
    cursor: help;
    border-bottom: 1px dotted var(--text-muted);
}

/* Reference type-specific styles */
.item-reference {
    color: var(--color-item);
}

.pack-reference {
    color: var(--color-pack);
}

.feat-reference {
    color: var(--color-feat);
}

.optfeature-reference {
    color: var(--color-feature);
}
```

## Testing Steps
1. Test core data processing:
```javascript
// Test item processing
const itemData = await loadJsonFile('data/items-base.json');
const item = await processEntityData(itemData.baseitem[0], 'item');
console.log('Processed item:', item);

// Test class processing
const classData = await loadJsonFile('data/class/fighter.json');
const fighter = await processEntityData(classData, 'class');
console.log('Processed class:', fighter);

// Test race processing
const raceData = await loadJsonFile('data/races.json');
const elf = await processEntityData(raceData.race[0], 'race');
console.log('Processed race:', elf);
```

2. Test reference resolution:
```javascript
// Test various reference types
const itemRef = await resolveJsonRef('{@item Longsword|PHB}');
const classRef = await resolveJsonRef('{@class Fighter|PHB}');
const raceRef = await resolveJsonRef('{@race Elf|PHB}');
console.log('Resolved references:', { itemRef, classRef, raceRef });
```

3. Test UI components:
```javascript
// Test EntityCard with different types
const itemCard = new EntityCard(container, processedItem, itemManager);
const classCard = new EntityCard(container, processedClass, classManager);
const raceCard = new EntityCard(container, processedRace, raceManager);

container.innerHTML = `
    ${itemCard.render()}
    ${classCard.render()}
    ${raceCard.render()}
`;
```

4. Test tooltips:
```javascript
// Setup tooltips
setupTooltips();

// Add some references to test
document.body.innerHTML = `
    <p>Test item: ${await resolveJsonRef('{@item Longsword|PHB}')}</p>
    <p>Test class: ${await resolveJsonRef('{@class Fighter|PHB}')}</p>
    <p>Test race: ${await resolveJsonRef('{@race Elf|PHB}')}</p>
`;
```

## Implementation Order
1. Add core data processing functions
   - Base entity processing
   - Type-specific processors
   - Shared utility functions

2. Add unified UI components
   - EntityCard base class
   - Type-specific rendering
   - Shared component styles

3. Add unified CSS
   - Base card styles
   - Type-specific styles
   - Shared component styles

4. Update reference resolution
   - Enhanced resolveJsonRef
   - Type-specific tooltip data
   - Caching improvements

5. Add tooltip system
   - Event handlers
   - Tooltip positioning
   - Tooltip styles

6. Test core functionality
   - Data processing
   - Reference resolution
   - UI components
   - Tooltips

7. Test integration points
   - Cross-entity references
   - Nested entities (e.g., subclasses, subraces)
   - Complex tooltips
   - UI interactions