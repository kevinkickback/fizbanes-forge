# Phase 5: Equipment Pack and Starting Equipment Integration

## Overview
Enhance equipment pack and starting equipment handling using the unified data processing system.

## Integration Notes

### 1. HTML Template Integration (index.html)
- **Action**: Modify existing equipment pack templates
- **Files Affected**: `index.html`
  - Keep: Basic pack display structure
  - Keep: Starting equipment selection
  - Modify: Pack details to use EntityCard
  - Remove: Duplicate pack templates
  - Add: Pack contents visualization
  - Add: Starting equipment choice UI

### 2. Character Management (character.js)
- **Action**: Hybrid approach - merge and enhance
- **Files Affected**: `character.js`
  - Keep: Basic pack handling
  - Keep: Starting equipment tracking
  - Modify: Pack management to use new system
  - Remove: Old pack card creation
  - Add: New pack management class
  - Add: Starting equipment integration

### 3. Utility Functions (utils.js)
- **Action**: Enhance existing utilities
- **Files Affected**: `utils.js`
  - Keep: Pack-related helper functions
  - Keep: Equipment choice utilities
  - Modify: Pack data processing to use unified system
  - Add: New pack-specific reference functions
  - Add: Pack tooltip enhancements
  - Add: Starting equipment utilities

### 4. CSS Integration (main.css)
- **Action**: Merge styles strategically
- **Files Affected**: `main.css`
  - Keep: Basic pack card styles
  - Keep: Equipment choice grid
  - Modify: Pack details to use unified system
  - Remove: Duplicate pack-specific styles
  - Add: New pack EntityCard styles
  - Add: Starting equipment choice styles
  - Add: Pack contents visualization styles

### 5. Data Loading System
- **Action**: Enhance existing system
- **Files Affected**: `data-loader.js`
  - Keep: Basic pack loading
  - Keep: Pack cache management
  - Modify: Pack processing to use unified system
  - Add: Starting equipment data processing
  - Add: Equipment choice handling
  - Add: Pack contents integration

## Specific Integration Points

### Pack Management System
```javascript
// Replaces these existing functions in character.js:
// - updatePacks 
// - updateStartingEquipment
// - displayPackDetails

class PackManager {
    // New unified pack management system
}
```

### Pack Data Processing
```javascript
// Enhances existing processPack function in utils.js
// Adds new functionality while maintaining existing processing
async function processPackData(pack, fluff) {
    // New pack processing system
}
```

### Event Handling
```javascript
// Modifies existing pack event setup in utils.js
function setupPackEventHandlers() {
    // Enhanced pack event handling
}
```

### CSS Structure
```css
/* Merges with existing pack styles in main.css */
.pack-card {
    /* New unified pack styles */
}

/* Adds new starting equipment styles */
.starting-equipment {
    /* New starting equipment styles */
}

/* Adds pack contents styles */
.pack-contents {
    /* New pack contents styles */
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
│   │   │   ├── PackManager.js
│   │   │   └── StartingEquipmentManager.js
│   │   ├── models/            # Data models
│   │   │   ├── Pack.js
│   │   │   └── StartingEquipment.js
│   │   └── services/          # Business logic
│   │       ├── PackService.js
│   │       └── EquipmentChoiceService.js
│   └── character.js           # Existing file (will gradually migrate)
```

### Migration Steps
1. Create the pack-specific directory structure
2. Move pack management to `core/managers/PackManager.js`
3. Move starting equipment to `core/managers/StartingEquipmentManager.js`
4. Create pack-related models in `core/models/`
5. Move pack-specific business logic to services

### Compatibility Layer
In `character.js`, add forwarding functions to maintain backward compatibility:
```javascript
// Import new modules
import { PackManager } from './core/managers/PackManager.js';
import { StartingEquipmentManager } from './core/managers/StartingEquipmentManager.js';
// ... other imports

// Initialize managers
const packManager = new PackManager(currentCharacter);
const startingEquipmentManager = new StartingEquipmentManager(currentCharacter);

// Forward existing functions to new implementations
async function addPack(packId) {
    return await packManager.addPack(packId);
}

function applyStartingEquipment(classId, choices) {
    return startingEquipmentManager.applyStartingEquipment(classId, choices);
}

function unpackBundle(packId) {
    return packManager.unpack(packId);
}
// ... other forwarding functions
```

### Testing Strategy
1. Write tests for new pack management modules
2. Ensure existing pack functionality works through compatibility layer
3. Add new tests for enhanced pack features
4. Verify no regressions in existing pack functionality

## Implementation Steps

### 1. Update Equipment Pack Loading
Update the existing loadItems function in data-loader.js:

```javascript
// Add to loadItems function after processing base items and magic variants
const packs = baseItems.itemPack || [];
const processedPacks = await Promise.all(packs.map(async pack => {
    const fluff = fluffData.itemFluff?.find(f => 
        f.name === pack.name && f.source === pack.source
    );
    return processEntityData(pack, 'pack', fluff);
}));

// Add processed packs to items cache
dataCache.items = [...processedItems, ...processedPacks];
```

### 2. Update Equipment Manager
Add pack handling to the existing EquipmentManager class:

```javascript
// Add to EquipmentManager class
async function addPack(packId) {
    try {
        const items = await window.dndDataLoader.loadItems();
        const pack = items.find(i => i.id === packId && i.type === 'pack');
        if (!pack) return false;

        // Add all pack contents
        for (const item of pack.contents) {
            const itemData = items.find(i => i.name === item.name);
            if (itemData) {
                await this.addItem(itemData.id, item.quantity);
            }
        }

        return true;
    } catch (error) {
        console.error('Error adding pack:', error);
        return false;
    }
}

async function addStartingEquipment(classId, background = null, choices = {}) {
    try {
        // Get class data
        const classes = await window.dndDataLoader.loadClasses();
        const classData = classes.find(c => c.id === classId);
        if (!classData) return false;

        // Add default equipment
        for (const item of classData.startingEquipment.default) {
            await this.addItem(item.id, item.quantity || 1);
        }

        // Handle equipment choices
        for (const [choiceId, selection] of Object.entries(choices)) {
            const choice = classData.startingEquipment.choices.find(c => c.id === choiceId);
            if (choice && choice.items.includes(selection)) {
                await this.addItem(selection, 1);
            }
        }

        // Add background equipment if provided
        if (background) {
            const backgrounds = await window.dndDataLoader.loadBackgrounds();
            const backgroundData = backgrounds.find(b => b.id === background);
            if (backgroundData?.startingEquipment) {
                for (const item of backgroundData.startingEquipment) {
                    await this.addItem(item.id, item.quantity || 1);
                }
            }
        }

        return true;
    } catch (error) {
        console.error('Error adding starting equipment:', error);
        return false;
    }
}
```

### 3. Update Equipment UI
Update the existing EquipmentUI class to use EntityCard:

```javascript
// Update EquipmentUI class
async function renderPacks() {
    const packs = Array.from(this.manager.inventory.values())
        .filter(({ item }) => item.type === 'pack');

    const packsList = document.createElement('div');
    packsList.className = 'equipment-section';
    packsList.innerHTML = `
        <h3>Equipment Packs</h3>
        <div class="equipment-grid">
            ${packs.map(pack => new EntityCard(this.container, pack.item, this.manager).render()).join('')}
        </div>
    `;

    this.container.appendChild(packsList);
    this.attachPackListeners();
}

attachPackListeners() {
    this.container.querySelectorAll('.pack-card').forEach(card => {
        const itemId = card.dataset.id;
        
        card.querySelector('.unpack-btn')?.addEventListener('click', async () => {
            await this.manager.addPack(itemId);
            await this.manager.removeItem(itemId, 1);
            this.render();
        });

        card.querySelector('.remove-btn')?.addEventListener('click', () => {
            this.manager.removeItem(itemId, 1);
            this.render();
        });
    });
}
```

### 4. Add Starting Equipment Selection UI
Create a new component for starting equipment selection:

```javascript
class StartingEquipmentUI {
    constructor(container, equipmentManager) {
        this.container = container;
        this.manager = equipmentManager;
        this.choices = new Map();
    }

    async initialize(classId, background = null) {
        this.container.innerHTML = `
            <div class="starting-equipment">
                <h3>Starting Equipment</h3>
                <div class="equipment-choices"></div>
                <div class="equipment-preview"></div>
                <div class="equipment-actions">
                    <button class="btn btn-primary" id="confirmEquipment">
                        Confirm Equipment
                    </button>
                </div>
            </div>
        `;

        await this.loadChoices(classId, background);
        this.attachListeners();
    }

    async loadChoices(classId, background) {
        const classes = await window.dndDataLoader.loadClasses();
        const classData = classes.find(c => c.id === classId);
        if (!classData?.startingEquipment) return;

        const choicesContainer = this.container.querySelector('.equipment-choices');
        choicesContainer.innerHTML = classData.startingEquipment.choices.map(choice => `
            <div class="equipment-choice" data-choice-id="${choice.id}">
                <h4>Choose one:</h4>
                <div class="choice-options">
                    ${choice.items.map(item => `
                        <label class="choice-option">
                            <input type="radio" name="choice-${choice.id}" value="${item.id}">
                            <span>${item.name}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Add background equipment if provided
        if (background) {
            const backgrounds = await window.dndDataLoader.loadBackgrounds();
            const backgroundData = backgrounds.find(b => b.id === background);
            if (backgroundData?.startingEquipment) {
                const backgroundSection = document.createElement('div');
                backgroundSection.className = 'background-equipment';
                backgroundSection.innerHTML = `
                    <h4>Background Equipment</h4>
                    <ul>
                        ${backgroundData.startingEquipment.map(item => 
                            `<li>${item.quantity || 1}× ${item.name}</li>`
                        ).join('')}
                    </ul>
                `;
                choicesContainer.appendChild(backgroundSection);
            }
        }
    }

    attachListeners() {
        // Handle equipment choices
        this.container.querySelectorAll('.equipment-choice').forEach(choice => {
            const choiceId = choice.dataset.choiceId;
            choice.querySelectorAll('input[type="radio"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    if (radio.checked) {
                        this.choices.set(choiceId, radio.value);
                        this.updatePreview();
                    }
                });
            });
        });

        // Handle confirmation
        this.container.querySelector('#confirmEquipment')?.addEventListener('click', async () => {
            await this.manager.addStartingEquipment(
                this.classId,
                this.background,
                Object.fromEntries(this.choices)
            );
            this.container.dispatchEvent(new CustomEvent('equipmentConfirmed'));
        });
    }

    async updatePreview() {
        const previewContainer = this.container.querySelector('.equipment-preview');
        const items = await window.dndDataLoader.loadItems();

        let html = '<h4>Selected Equipment:</h4><ul>';
        
        // Add default equipment
        const classes = await window.dndDataLoader.loadClasses();
        const classData = classes.find(c => c.id === this.classId);
        if (classData?.startingEquipment?.default) {
            for (const item of classData.startingEquipment.default) {
                html += `<li>${item.quantity || 1}× ${item.name}</li>`;
            }
        }

        // Add chosen equipment
        for (const [choiceId, itemId] of this.choices) {
            const item = items.find(i => i.id === itemId);
            if (item) {
                html += `<li>1× ${item.name}</li>`;
            }
        }

        html += '</ul>';
        previewContainer.innerHTML = html;
    }
}
```

## Testing Steps
1. Test pack loading:
```javascript
const items = await window.dndDataLoader.loadItems();
const packs = items.filter(i => i.type === 'pack');
console.log('Available packs:', packs);
```

2. Test pack management:
```javascript
const manager = character.equipment;
await manager.addPack('explorers-pack');
console.log('Inventory after adding pack:', manager.inventory);
```

3. Test starting equipment:
```javascript
await manager.addStartingEquipment('fighter', 'soldier', {
    'weapon': 'longsword',
    'armor': 'chain-mail'
});
```

## Implementation Order
1. Update equipment data loading to use unified system
2. Update equipment management with pack handling
3. Update UI components to use EntityCard
4. Add starting equipment functionality
5. Test with various equipment configurations