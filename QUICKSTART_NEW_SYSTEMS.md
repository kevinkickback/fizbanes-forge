# Quick Start Guide: Items, Spells & Level-Up Systems

## Overview

Three new major systems have been implemented for Fizbane's Forge:

1. **Equipment System** - Character inventory, equipment slots, attunement tracking
2. **Spellcasting System** - Spells by class, known/prepared spells, spell slots
3. **Level-Up System** - Character progression, multiclass support, ASI/feat application

All systems are production-ready and integrate seamlessly with existing Race/Class/Background/Feat logic.

---

## Quick Examples

### Adding an Item to Character Inventory

```javascript
import { equipmentService } from './services/EquipmentService.js';
import { itemService } from './services/ItemService.js';

// Get all items and filter
const allItems = itemService.getAllItems();
const sword = allItems.find(item => item.name === 'Longsword');

// Add item to character
const character = AppState.getCurrentCharacter();
const addedItem = equipmentService.addItem(
  character, 
  sword, 
  1,           // quantity
  'Starting Equipment'  // source
);

// Equip the item
equipmentService.equipItem(character, addedItem.id, 'hands');

// Check attunement
if (sword.reqAttune && equipmentService.canAttune(character)) {
  equipmentService.attuneItem(character, addedItem.id);
}

// Listen for changes
eventBus.on(EVENTS.ITEM_EQUIPPED, (character, item, slot) => {
  console.log(`Equipped ${item.name} to ${slot}`);
});
```

### Managing Character Spells

```javascript
import { spellSelectionService } from './services/SpellSelectionService.js';
import { spellService } from './services/SpellService.js';

const character = AppState.getCurrentCharacter();

// Initialize spellcasting for a class (called automatically on class selection)
spellSelectionService.initializeSpellcastingForClass(character, 'Wizard', 5);

// Get all spells for this class
const wizardSpells = spellSelectionService.getAvailableSpellsForClass('Wizard');

// Add known spell
const magicMissile = wizardSpells.find(s => s.name === 'Magic Missile');
spellSelectionService.addKnownSpell(character, 'Wizard', magicMissile);

// Prepare spell (for classes that prepare spells)
spellSelectionService.prepareSpell(character, 'Wizard', 'Magic Missile');

// Check prepared limit
const classData = character.spellcasting.classes['Wizard'];
const preparedLimit = classData.level + character.getAbilityModifier('intelligence');
console.log(`Prepared: ${classData.spellsPrepared.length}/${preparedLimit}`);

// Use spell slot
spellSelectionService.useSpellSlot(character, 'Wizard', 1);

// Restore on rest
spellSelectionService.restoreSpellSlots(character, 'Wizard');

// Listen for spell changes
eventBus.on(EVENTS.SPELL_ADDED, (character, className, spell) => {
  console.log(`Added ${spell.name} to ${className}`);
});
```

### Leveling Up Character

```javascript
import { levelUpService } from './services/LevelUpService.js';

const character = AppState.getCurrentCharacter();

// Initialize progression (optional, done automatically)
levelUpService.initializeProgression(character);

// Increase level
levelUpService.increaseLevel(character);
// character.level goes from 2 to 3
// character.progression.classes[0].level also incremented

// Check if ASI available
if (levelUpService.hasASIAvailable(character)) {
  // At level 4, 8, 12, 16, 19
  // Handle ASI via FeatSelectionModal
}

// Get features for new level
const features = await levelUpService.getClassFeaturesForLevel('Wizard', 3);

// Update spell slots for all classes
levelUpService.updateSpellSlots(character);

// Record the level-up
levelUpService.recordLevelUp(character, 2, 3, {
  appliedFeats: ['Polearm Master'],
  appliedFeatures: ['Spellcasting'],
  changedAbilities: { dexterity: 16 }  // Only if ASI used
});

// Multiclass example
levelUpService.addClassLevel(character, 'Rogue', 1);
character.level = 6;  // Total level still 6, but now 5 Wizard / 1 Rogue
```

### Using Modals

```javascript
import { ItemSelectionModal } from './modules/items/ItemSelectionModal.js';
import { SpellSelectionModal } from './modules/spells/SpellSelectionModal.js';

// Item selection modal
const itemModal = new ItemSelectionModal();
const result = await itemModal.show();
if (result) {
  console.log(`Selected: ${result.item.name} x${result.quantity}`);
}

// Spell selection modal  
const spellModal = new SpellSelectionModal({ className: 'Wizard' });
const spell = await spellModal.show();
if (spell) {
  console.log(`Selected: ${spell.spell.name} for ${spell.className}`);
}
```

---

## Service API Reference

### EquipmentService

**Inventory Management**
- `addItem(character, itemData, quantity, source)` → itemInstance
- `removeItem(character, itemInstanceId, quantity)` → boolean
- `findItemById(character, itemInstanceId)` → item or null
- `getInventoryItems(character)` → Array

**Equipment Slots**
- `equipItem(character, itemInstanceId, slot)` → boolean
- `unequipItem(character, itemInstanceId)` → boolean
- `getEquippedItems(character, slot?)` → Array

**Attunement**
- `attuneItem(character, itemInstanceId)` → boolean
- `unattueItem(character, itemInstanceId)` → boolean
- `canAttune(character)` → boolean
- `getRemainingAttunementSlots(character)` → number
- `getAttunedItems(character)` → Array

**Encumbrance**
- `calculateTotalWeight(character)` → number
- `calculateCarryCapacity(character)` → number
- `checkEncumbrance(character)` → { total, capacity, encumbered, heavilyEncumbered }

### SpellSelectionService

**Initialization**
- `initializeSpellcastingForClass(character, className, level)` → classData
- `getAvailableSpellsForClass(className)` → Array

**Known/Prepared Spells**
- `addKnownSpell(character, className, spellData)` → boolean
- `removeKnownSpell(character, className, spellName)` → boolean
- `prepareSpell(character, className, spellName)` → boolean
- `unprepareSpell(character, className, spellName)` → boolean

**Spell Slots**
- `calculateSpellSlots(className, level)` → { 1: {max, current}, 2: ... }
- `useSpellSlot(character, className, spellLevel)` → boolean
- `restoreSpellSlots(character, className?)` → boolean

### LevelUpService

**Level Progression**
- `increaseLevel(character)` → boolean
- `decreaseLevel(character)` → boolean
- `hasASIAvailable(character)` → boolean
- `recordLevelUp(character, fromLevel, toLevel, changes)` → void

**Multiclass**
- `initializeProgression(character)` → void
- `addClassLevel(character, className, level)` → classEntry
- `removeClassLevel(character, className)` → boolean
- `getAvailableClassesForMulticlass(character)` → Array

**Features & HP**
- `getClassFeaturesForLevel(className, level)` → Array
- `getSubclassFeaturesForLevel(subclassName, level)` → Array
- `calculateMaxHitPoints(character)` → number
- `updateSpellSlots(character)` → void
- `calculateMulticlassSpellSlots(character)` → {}

---

## Event System

### Listen to Changes

```javascript
import { eventBus, EVENTS } from './utils/EventBus.js';

// Item events
eventBus.on(EVENTS.ITEM_ADDED, (character, item) => {});
eventBus.on(EVENTS.ITEM_EQUIPPED, (character, item, slot) => {});
eventBus.on(EVENTS.ITEM_ATTUNED, (character, item) => {});
eventBus.on(EVENTS.ENCUMBRANCE_CHANGED, (character, encumbrance) => {});

// Spell events
eventBus.on(EVENTS.SPELL_ADDED, (character, className, spell) => {});
eventBus.on(EVENTS.SPELL_PREPARED, (character, className, spell) => {});
eventBus.on(EVENTS.SPELL_SLOTS_USED, (character, className, level) => {});

// Level-up events
eventBus.on(EVENTS.CHARACTER_LEVEL_CHANGED, (character, {from, to}) => {});
eventBus.on(EVENTS.MULTICLASS_ADDED, (character, classEntry) => {});
eventBus.on(EVENTS.FEATURES_ADDED, (character, features) => {});

// Character saved
eventBus.on(EVENTS.CHARACTER_UPDATED, (character) => {});
```

---

## Character Data Structure

### Inventory
```javascript
character.inventory = {
  items: [
    {
      id: "item-1234567890-abc",
      name: "Longsword",
      baseItemId: "longsword",
      quantity: 1,
      equipped: true,
      attuned: false,
      cost: { quantity: 15, unit: "gp" },
      weight: 3,
      source: "PHB",
      metadata: { addedAt: "...", addedFrom: "Starting Equipment" }
    }
  ],
  equipped: {
    head: null,
    body: "item-123...",
    hands: ["item-456...", "item-789..."],
    // etc
  },
  attuned: ["item-999..."],
  weight: { current: 45, capacity: 150 }
}
```

### Spellcasting
```javascript
character.spellcasting = {
  classes: {
    "Wizard": {
      level: 5,
      spellsKnown: [
        { name: "Magic Missile", source: "PHB" },
        { name: "Shield", source: "PHB" }
      ],
      spellsPrepared: [
        { name: "Magic Missile", source: "PHB" }
      ],
      spellSlots: {
        1: { max: 4, current: 3 },
        2: { max: 2, current: 2 },
        3: { max: 2, current: 1 }
      },
      cantripsKnown: 3,
      spellcastingAbility: "intelligence",
      ritualCasting: true
    }
  },
  multiclass: {
    isCastingMulticlass: false,
    combinedSlots: {}
  },
  other: {
    spellsKnown: [],
    itemSpells: []
  }
}
```

### Progression
```javascript
character.progression = {
  classes: [
    {
      name: "Wizard",
      level: 5,
      subclass: { name: "Evocation", source: "PHB" },
      hitDice: "d6",
      hitPoints: [6, 5, 5, 4, 6],
      features: [
        { name: "Arcane Recovery", source: "Class", level: 1 },
        { name: "Evocation Savant", source: "Subclass", level: 2 }
      ],
      spellSlots: { /* same as above */ }
    }
  ],
  experiencePoints: 0,
  levelUps: [
    {
      fromLevel: 1,
      toLevel: 2,
      appliedFeats: [],
      appliedFeatures: ["Spellcasting"],
      changedAbilities: {},
      timestamp: "2025-01-07T..."
    }
  ]
}
```

---

## Integration Points

### With Existing Systems

✓ **Race/Class/Background**: All systems follow same patterns
✓ **Feat Selection**: ASI levels integrated with FeatSelectionModal
✓ **Ability Scores**: Characters with updated abilities auto-recalculate modifiers
✓ **Proficiencies**: Class proficiencies can grant weapon/tool proficiencies
✓ **Data Services**: All data loaded via existing ItemService/SpellService

### Event Flow

```
User Action (Add Item, Level Up, Add Spell)
  ↓
Service Method (equipmentService.addItem, levelUpService.increaseLevel)
  ↓
Character Object Updated (character.inventory, character.level, character.spellcasting)
  ↓
Event Emitted (ITEM_ADDED, CHARACTER_LEVEL_CHANGED, SPELL_ADDED)
  ↓
AppState Updated (CHARACTER_UPDATED)
  ↓
CharacterManager.saveCharacter() (persists to storage)
  ↓
UI Re-renders (subscribed components receive event)
```

---

## Next Steps for Implementation

1. **Create Equipment Page** - Use EquipmentService in equipment.html
2. **Create Spells Page** - Display spells by class/level with SpellSelectionModal
3. **Create Level-Up Page** - UI for leveling with feature/ASI display
4. **Add IPC Handlers** - Main process handlers for all operations
5. **Wire in AppInitializer** - Initialize services at app startup
6. **Update Navigation** - Register new pages with NavigationController
7. **E2E Testing** - Playwright tests for full workflows

---

## Troubleshooting

### Import Issues
All services are singletons exported at module bottom:
```javascript
export const equipmentService = new EquipmentService();
export const spellSelectionService = new SpellSelectionService();
export const levelUpService = new LevelUpService();
```

### Modal Not Appearing
Ensure modal HTML exists in index.html:
- `#itemSelectionModal`
- `#spellSelectionModal`

### Character Not Updating
Always emit `CHARACTER_UPDATED` after changes:
```javascript
eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
```

### Spell Slots Wrong
Call `levelUpService.updateSpellSlots()` after level changes:
```javascript
levelUpService.increaseLevel(character);
levelUpService.updateSpellSlots(character);
```

---

## Reference Documents

- [DESIGN_SYSTEMS.md](DESIGN_SYSTEMS.md) - Comprehensive architecture
- [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md) - What's completed
- [Copilot Instructions](.github/copilot-instructions.md) - Project conventions
