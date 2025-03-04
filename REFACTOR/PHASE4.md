# Phase 4: Equipment System Integration

## Overview
Enhance equipment data loading and processing to work with the existing infrastructure and reference system, utilizing the 5e.tools item data format.

## Integration Notes

### 1. HTML Template Integration (index.html)
- **Action**: Modify existing equipment templates
- **Files Affected**: `index.html`
  - Keep: Basic inventory display
  - Keep: Equipment filtering system
  - Modify: Equipment details to use EntityCard
  - Remove: Duplicate equipment templates
  - Add: Magic item attunement UI
  - Add: Equipment slot visualization

### 2. Character Management (character.js)
- **Action**: Hybrid approach - merge and enhance
- **Files Affected**: `character.js`
  - Keep: Basic inventory state
  - Keep: Equipment slot tracking
  - Modify: Equipment update functions to use new system
  - Remove: Old equipment card creation
  - Add: New equipment management class
  - Add: Attunement system integration

### 3. Utility Functions (utils.js)
- **Action**: Enhance existing utilities
- **Files Affected**: `utils.js`
  - Keep: Equipment-related helper functions
  - Keep: Weight calculation utilities
  - Modify: Equipment data processing to use unified system
  - Add: New equipment-specific reference functions
  - Add: Equipment tooltip enhancements
  - Add: Magic item utilities

### 4. CSS Integration (main.css)
- **Action**: Merge styles strategically
- **Files Affected**: `main.css`
  - Keep: Basic equipment card styles
  - Keep: Inventory grid system
  - Modify: Equipment details to use unified system
  - Remove: Duplicate equipment-specific styles
  - Add: New equipment EntityCard styles
  - Add: Magic item-specific styles
  - Add: Equipment slot visualization styles

### 5. Data Loading System
- **Action**: Enhance existing system
- **Files Affected**: `data-loader.js`
  - Keep: Basic item loading
  - Keep: Equipment cache management
  - Modify: Equipment processing to use unified system
  - Add: Magic variant processing
  - Add: Equipment pack handling
  - Add: Magic item data integration

## Specific Integration Points

### Equipment Management System
```javascript
// Replaces these existing functions in character.js:
// - updateInventory
// - updateEquippedItems
// - displayEquipmentDetails

class EquipmentManager {
    // New unified equipment management system
}
```

### Equipment Data Processing
```javascript
// Enhances existing processItem function in utils.js
// Adds new functionality while maintaining existing processing
async function processItemData(item, fluff) {
    // New equipment processing system
}
```

### Event Handling
```javascript
// Modifies existing equipment event setup in utils.js
function setupEquipmentEventHandlers() {
    // Enhanced equipment event handling
}
```

### CSS Structure
```css
/* Merges with existing equipment styles in main.css */
.equipment-card {
    /* New unified equipment styles */
}

/* Adds new magic item styles */
.magic-item {
    /* New magic item styles */
}

/* Adds equipment slot styles */
.equipment-slot {
    /* New equipment slot styles */
}
```

## Implementation Steps

### 1. Enhance Equipment Data Loading
Update the existing loadItems function in data-loader.js:

```javascript
// Enhance existing loadItems function
async function loadItems() {
    if (dataCache.items) {
        return dataCache.items;
    }

    try {
        // Load main item data and fluff
        const baseItems = await loadJsonFile('data/items-base.json');
        const magicItems = await loadJsonFile('data/magicvariants.json');
        const fluffData = await loadJsonFile('data/fluff-items.json').catch(() => ({}));

        // Process items
        const processedItems = await Promise.all([
            // Process base items
            ...(baseItems.baseitem || []).map(async item => {
                const fluff = fluffData.itemFluff?.find(f => 
                    f.name === item.name && f.source === item.source
                );
                return processItemData(item, fluff);
            }),
            // Process magic variants
            ...(magicItems.magicvariant || []).map(async variant => {
                const fluff = fluffData.itemFluff?.find(f => 
                    f.name === variant.name && f.source === variant.source
                );
                return processMagicVariant(variant, fluff);
            })
        ]);

        // Cache and return
        dataCache.items = processedItems;
        return processedItems;
    } catch (error) {
        console.error('Error loading item data:', error);
        throw error;
    }
}

// Add helper function for processing item data
async function processItemData(item, fluff = null) {
    // Process basic properties
    const processed = {
        id: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: item.name,
        source: item.source || 'PHB',
        page: item.page,
        type: getItemType(item),
        rarity: item.rarity || 'common',
        value: processValue(item.value),
        weight: item.weight || 0,
        description: await processText(fluff?.entries?.[0] || ''),
        properties: processProperties(item.property),
        attunement: processAttunement(item.reqAttune)
    };

    // Add type-specific properties
    switch (processed.type) {
        case 'weapon':
            Object.assign(processed, processWeapon(item));
            break;
        case 'armor':
            Object.assign(processed, processArmor(item));
            break;
        case 'ammunition':
            Object.assign(processed, processAmmunition(item));
            break;
    }

    return processed;
}

// Helper functions for item processing
function getItemType(item) {
    if (item.weaponCategory) return 'weapon';
    if (item.armorCategory) return 'armor';
    if (item.ammunition) return 'ammunition';
    return item.type || 'other';
}

function processValue(value) {
    if (!value) return { amount: 0, coin: 'gp' };
    if (typeof value === 'number') return { amount: value, coin: 'gp' };
    
    const match = String(value).match(/(\d+)\s*([a-z]{2})/i);
    return match ? {
        amount: parseInt(match[1]),
        coin: match[2].toLowerCase()
    } : { amount: 0, coin: 'gp' };
}

function processProperties(properties) {
    if (!properties) return [];
    return Array.isArray(properties) ? properties : [properties];
}

function processAttunement(reqAttune) {
    if (!reqAttune) return false;
    if (reqAttune === true) return true;
    return {
        required: true,
        by: typeof reqAttune === 'string' ? reqAttune : null
    };
}

function processWeapon(item) {
    return {
        category: item.weaponCategory || 'simple',
        damage: {
            dice: processDamageDice(item.dmg1),
            type: item.dmgType || 'bludgeoning'
        },
        range: processRange(item.range),
        properties: processWeaponProperties(item.property),
        ammunition: item.ammoType || null,
        versatile: processDamageDice(item.dmg2)
    };
}

function processArmor(item) {
    return {
        category: item.armorCategory || 'light',
        ac: item.ac || 10,
        strength: item.strength || null,
        stealth: item.stealth || false,
        dexBonus: !item.armorCategory || item.armorCategory !== 'heavy'
    };
}

function processAmmunition(item) {
    return {
        type: item.ammoType || 'arrow',
        damage: item.dmg1 ? {
            dice: processDamageDice(item.dmg1),
            type: item.dmgType
        } : null
    };
}

function processDamageDice(damage) {
    if (!damage) return null;
    const match = String(damage).match(/(\d+)d(\d+)/);
    return match ? {
        number: parseInt(match[1]),
        faces: parseInt(match[2])
    } : null;
}

function processRange(range) {
    if (!range) return null;
    if (typeof range === 'number') return { normal: range, long: null };
    const [normal, long] = String(range).split('/').map(r => parseInt(r));
    return { normal, long: long || null };
}

function processWeaponProperties(properties) {
    const standardProps = processProperties(properties);
    return standardProps.map(prop => {
        if (typeof prop === 'string') {
            const [name, detail] = prop.split('|');
            return { name, detail };
        }
        return prop;
    });
}

function processMagicVariant(variant, fluff = null) {
    return {
        ...processItemData(variant),
        inherits: variant.inherits || null,
        requires: variant.requires || [],
        bonuses: {
            weapon: variant.bonusWeapon || null,
            armor: variant.bonusAc || null,
            spells: variant.bonusSpellAttack || null
        }
    };
}
```

### 2. Update Equipment Management
Enhance the existing equipment management in character.js:

```javascript
// Add to character.js
class EquipmentManager {
    constructor(character) {
        this.character = character;
        this.inventory = new Map();
        this.equipped = new Map();
        this.attunedItems = new Set();
        this.maxAttuned = 3;
    }

    async addItem(itemId, quantity = 1) {
        try {
            const items = await window.dndDataLoader.loadItems();
            const item = items.find(i => i.id === itemId);
            if (!item) return false;

            const inventoryItem = this.inventory.get(itemId) || {
                item,
                quantity: 0,
                equipped: false,
                slot: null
            };

            inventoryItem.quantity += quantity;
            this.inventory.set(itemId, inventoryItem);
            
            return true;
        } catch (error) {
            console.error('Error adding item:', error);
            return false;
        }
    }

    removeItem(itemId, quantity = 1) {
        const inventoryItem = this.inventory.get(itemId);
        if (!inventoryItem) return false;

        inventoryItem.quantity -= quantity;
        if (inventoryItem.quantity <= 0) {
            if (inventoryItem.equipped) {
                this.unequipItem(itemId);
            }
            this.inventory.delete(itemId);
        } else {
            this.inventory.set(itemId, inventoryItem);
        }

        return true;
    }

    async equipItem(itemId, slot = null) {
        const inventoryItem = this.inventory.get(itemId);
        if (!inventoryItem || inventoryItem.quantity < 1) return false;

        try {
            // Check if item can be equipped
            if (!this.canEquipItem(inventoryItem.item)) {
                return false;
            }

            // Handle attunement
            if (inventoryItem.item.attunement && !this.attunedItems.has(itemId)) {
                if (this.attunedItems.size >= this.maxAttuned) {
                    return false;
                }
                this.attunedItems.add(itemId);
            }

            // Handle slot management
            if (slot) {
                const currentEquipped = this.equipped.get(slot);
                if (currentEquipped) {
                    await this.unequipItem(currentEquipped.item.id);
                }
            }

            // Mark as equipped
            inventoryItem.equipped = true;
            inventoryItem.slot = slot;
            if (slot) {
                this.equipped.set(slot, inventoryItem);
            }

            // Apply item effects
            await this.applyItemEffects(inventoryItem.item);

            return true;
        } catch (error) {
            console.error('Error equipping item:', error);
            return false;
        }
    }

    async unequipItem(itemId) {
        const inventoryItem = this.inventory.get(itemId);
        if (!inventoryItem || !inventoryItem.equipped) return false;

        try {
            // Remove from equipped slot
            if (inventoryItem.slot) {
                this.equipped.delete(inventoryItem.slot);
            }

            // Mark as unequipped
            inventoryItem.equipped = false;
            inventoryItem.slot = null;

            // Remove item effects
            await this.removeItemEffects(inventoryItem.item);

            return true;
        } catch (error) {
            console.error('Error unequipping item:', error);
            return false;
        }
    }

    canEquipItem(item) {
        // Check proficiency requirements
        if (item.type === 'weapon' && !this.character.hasProficiency('weapon', item.category)) {
            return false;
        }
        if (item.type === 'armor' && !this.character.hasProficiency('armor', item.category)) {
            return false;
        }

        // Check strength requirements for armor
        if (item.type === 'armor' && item.strength && 
            this.character.getAbilityScore('strength') < item.strength) {
            return false;
        }

        return true;
    }

    async applyItemEffects(item) {
        // Apply bonuses
        if (item.bonuses) {
            if (item.bonuses.armor) {
                this.character.addBonus('ac', item.bonuses.armor, item.name);
            }
            if (item.bonuses.weapon) {
                this.character.addBonus('attack', item.bonuses.weapon, item.name);
                this.character.addBonus('damage', item.bonuses.weapon, item.name);
            }
        }

        // Apply special properties
        for (const property of item.properties) {
            await this.applyItemProperty(property);
        }
    }

    async removeItemEffects(item) {
        // Remove bonuses
        if (item.bonuses) {
            if (item.bonuses.armor) {
                this.character.removeBonus('ac', item.name);
            }
            if (item.bonuses.weapon) {
                this.character.removeBonus('attack', item.name);
                this.character.removeBonus('damage', item.name);
            }
        }

        // Remove special properties
        for (const property of item.properties) {
            await this.removeItemProperty(property);
        }
    }

    getEquippedItems() {
        return Array.from(this.equipped.values());
    }

    calculateWeight() {
        return Array.from(this.inventory.values())
            .reduce((total, { item, quantity }) => {
                return total + (item.weight || 0) * quantity;
            }, 0);
    }
}
```

### 3. Update Equipment UI
Enhance the existing equipment UI components:

```javascript
// Add to character.js
class EquipmentUI {
    constructor(container, equipmentManager) {
        this.container = container;
        this.manager = equipmentManager;
        this.initialize();
    }

    initialize() {
        // Use existing equipment page template from index.html
        const template = document.getElementById('equipmentPage');
        this.container.innerHTML = template.innerHTML;
        
        this.weaponsList = this.container.querySelector('#weaponsList');
        this.armorList = this.container.querySelector('#armorList');
        
        this.render();
    }

    async render() {
        await this.renderWeapons();
        await this.renderArmor();
    }

    async renderWeapons() {
        const weapons = Array.from(this.manager.inventory.values())
            .filter(({ item }) => item.type === 'weapon');

        this.weaponsList.innerHTML = weapons.map(weapon => 
            this.createWeaponCard(weapon)
        ).join('');

        this.attachWeaponListeners();
    }

    async renderArmor() {
        const armor = Array.from(this.manager.inventory.values())
            .filter(({ item }) => item.type === 'armor');

        this.armorList.innerHTML = armor.map(armor => 
            this.createArmorCard(armor)
        ).join('');

        this.attachArmorListeners();
    }

    createWeaponCard({ item, quantity, equipped }) {
        return `
            <div class="equipment-card ${equipped ? 'equipped' : ''}" data-item-id="${item.id}">
                <div class="equipment-header">
                    <h4>${item.name}</h4>
                    <span class="quantity">×${quantity}</span>
                </div>
                <div class="equipment-body">
                    <div class="weapon-properties">
                        <p>Damage: ${this.formatDamage(item.damage)}</p>
                        ${item.range ? `<p>Range: ${this.formatRange(item.range)}</p>` : ''}
                        ${item.properties.length > 0 ? 
                            `<p>Properties: ${item.properties.map(p => p.name).join(', ')}</p>` : 
                            ''}
                    </div>
                </div>
                <div class="equipment-footer">
                    <button class="btn btn-sm btn-primary equip-btn">
                        ${equipped ? 'Unequip' : 'Equip'}
                    </button>
                    <button class="btn btn-sm btn-danger remove-btn">Remove</button>
                </div>
            </div>
        `;
    }

    createArmorCard({ item, quantity, equipped }) {
        return `
            <div class="equipment-card ${equipped ? 'equipped' : ''}" data-item-id="${item.id}">
                <div class="equipment-header">
                    <h4>${item.name}</h4>
                    <span class="quantity">×${quantity}</span>
                </div>
                <div class="equipment-body">
                    <div class="armor-properties">
                        <p>AC: ${item.ac}</p>
                        ${item.strength ? `<p>Strength Required: ${item.strength}</p>` : ''}
                        ${item.stealth ? '<p>Disadvantage on Stealth</p>' : ''}
                    </div>
                </div>
                <div class="equipment-footer">
                    <button class="btn btn-sm btn-primary equip-btn">
                        ${equipped ? 'Unequip' : 'Equip'}
                    </button>
                    <button class="btn btn-sm btn-danger remove-btn">Remove</button>
                </div>
            </div>
        `;
    }

    formatDamage(damage) {
        if (!damage) return '—';
        return `${damage.dice.number}d${damage.dice.faces} ${damage.type}`;
    }

    formatRange(range) {
        if (!range) return '—';
        return range.long ? 
            `${range.normal}/${range.long} ft.` : 
            `${range.normal} ft.`;
    }

    attachWeaponListeners() {
        this.weaponsList.querySelectorAll('.equipment-card').forEach(card => {
            this.attachCardListeners(card);
        });
    }

    attachArmorListeners() {
        this.armorList.querySelectorAll('.equipment-card').forEach(card => {
            this.attachCardListeners(card);
        });
    }

    attachCardListeners(card) {
        const itemId = card.dataset.itemId;
        
        card.querySelector('.equip-btn').addEventListener('click', async () => {
            const item = this.manager.inventory.get(itemId);
            if (item.equipped) {
                await this.manager.unequipItem(itemId);
            } else {
                await this.manager.equipItem(itemId);
            }
            this.render();
        });

        card.querySelector('.remove-btn').addEventListener('click', () => {
            this.manager.removeItem(itemId, 1);
            this.render();
        });
    }
}
```

## Testing Steps
1. Test equipment data loading:
```javascript
const items = await window.dndDataLoader.loadItems();
console.log('Loaded items:', items);
```

2. Test equipment management:
```javascript
const manager = character.equipment;
await manager.addItem('longsword');
await manager.equipItem('longsword');
console.log('Equipped items:', manager.getEquippedItems());
```

3. Test UI display:
```javascript
const ui = new EquipmentUI(document.getElementById('equipmentPage'), manager);
```

## Implementation Order
1. Enhance equipment data loading
2. Update equipment management
3. Enhance equipment UI components
4. Test with various items and equipment types
7. Add error handling and validation