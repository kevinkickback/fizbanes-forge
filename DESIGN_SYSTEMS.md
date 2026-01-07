# Items, Spells, and Level-Up Systems Design

## Overview

This document describes the design and architecture for three interconnected systems in Fizbane's Forge:
1. **Items/Equipment System** - Character inventory, equipment slots, attunement tracking
2. **Spells System** - Spell selection, known/prepared spells, spell slots, multiclass handling
3. **Level-Up & Multiclass Logic** - Character progression, ASIs, features, multiclass tracking

All systems follow existing architectural patterns (BaseDataService, event bus, modals, etc.) and integrate cleanly with Race/Class/Background/Feat logic.

---

## 1. Items/Equipment System

### 1.1 Data Model

#### Character Inventory Structure
```javascript
character.inventory = {
  items: [
    {
      id: "unique-instance-id",
      name: "Longsword",
      baseItemId: "base-id", // Reference to base item
      quantity: 1,
      equipped: true,
      attuned: false,
      cost: { quantity: 15, unit: "gp" },
      weight: 3,
      source: "PHB",
      metadata: {
        addedAt: "2025-01-07T...",
        addedFrom: "Starting Equipment" // or "Manual", "Equipment Pack", etc.
      }
    }
  ],
  equipped: {
    head: null,
    body: "unique-instance-id", // Reference to item instance
    hands: ["id1", "id2"],
    feet: null,
    back: null,
    // ... etc for all slots
  },
  attuned: [
    "unique-instance-id",
    // Max 3 items (3+ for certain features)
  ],
  weight: {
    current: 45,
    capacity: 150, // Based on strength
  }
}
```

#### ItemService Enhancements
- Load from `items.json` and `items-base.json` (already implemented)
- Add methods:
  - `getItemsByFilter(filters)` - Filter by rarity, type, cost range, weapon/armor category
  - `getStartingEquipmentPacks()` - Get equipment packs from class data
  - `calculateCarryCapacity(strength)` - STR × 15 lbs
  - `getWeaponProperties(item)` - Parse weapon properties (finesse, versatile, etc.)
  - `getArmorAC(item)` - Get AC value from armor

### 1.2 Equipment Service Layer

**File:** `src/renderer/scripts/services/EquipmentService.js`

```javascript
class EquipmentService {
  // Equip/Unequip Logic
  async equipItem(character, itemInstanceId, slot)
  async unequipItem(character, itemInstanceId)
  
  // Attunement Logic
  async attuneItem(character, itemInstanceId)
  async unattueItem(character, itemInstanceId)
  validateAttunementRequirement(item) // Check if item requires attunement
  canAttune(character) // Check if character has attunement slots available
  
  // Inventory Operations
  async addItem(character, itemData, quantity, source)
  async removeItem(character, itemInstanceId, quantity)
  async updateItemQuantity(character, itemInstanceId, quantity)
  
  // Calculations
  calculateTotalWeight(character)
  calculateCarryCapacity(character)
  isOverEncumbered(character)
  
  // Validation
  validateEquipment(character) // Check all constraints
  isValidSlot(equipment, slot) // Check if item can equip to slot
}
```

### 1.3 UI Components

#### Equipment Page (`equipment.html` - already partial)
- **Starting Equipment Section**: Auto-populate from class, allow customization
- **Inventory List**: Show all items with quantities, weights
- **Equipment Slots**: Visual representation of equipped items
- **Attuned Items**: Show attuned items, track 3-item limit
- **Add Item Button**: Open ItemSelectionModal

#### ItemSelectionModal
**File:** `src/renderer/scripts/modules/items/ItemSelectionModal.js`

Pattern follows `FeatSelectionModal`:
- Search bar with real-time filtering
- Filters panel:
  - **Rarity**: Common, Uncommon, Rare, Very Rare, Legendary, Artifact
  - **Item Type**: Weapon, Armor, Wondrous Item, Potion, Scroll, etc.
  - **Price Range**: Slider for cost (0-10,000+ gp)
  - **Category**: For weapons (melee, ranged), armor (light, medium, heavy)
- Quantity selector
- Preview of item properties
- Add/Cancel buttons
- Emit `ITEM_ADDED` event on confirmation

### 1.4 Event Bus Events
```javascript
EVENTS.ITEM_ADDED: 'item:added'
EVENTS.ITEM_REMOVED: 'item:removed'
EVENTS.ITEM_EQUIPPED: 'item:equipped'
EVENTS.ITEM_UNEQUIPPED: 'item:unequipped'
EVENTS.ITEM_ATTUNED: 'item:attuned'
EVENTS.ITEM_UNATTUNED: 'item:unattuned'
EVENTS.INVENTORY_UPDATED: 'inventory:updated'
EVENTS.ENCUMBRANCE_CHANGED: 'encumbrance:changed'
```

### 1.5 IPC Handlers
**File:** `src/electron/ipc/handlers/EquipmentHandlers.js`

- `equipment:add-item` - Add item to character
- `equipment:remove-item` - Remove item
- `equipment:equip-item` - Equip item to slot
- `equipment:unequip-item` - Unequip item
- `equipment:attune-item` - Attune item
- `equipment:unattune-item` - Unattune item

---

## 2. Spells System

### 2.1 Data Model

#### Character Spells Structure
```javascript
character.spellcasting = {
  // Track by class to support multiclass
  classes: {
    "Wizard": {
      level: 3,
      spellsKnown: [{ name: "Magic Missile", source: "PHB" }],
      spellsPrepared: [{ name: "Magic Missile", source: "PHB" }],
      spellSlots: {
        // Populated based on level + modifiers
        1: { max: 4, current: 4 },
        2: { max: 2, current: 1 },
      },
      cantripsKnown: 3,
      spellcastingAbility: "intelligence", // Or wisdom, charisma
      ritualCasting: false,
      spellSaveDC: 14,
      spellAttackBonus: 4,
    }
  },
  // Multiclass: track combined spell slots
  multiclass: {
    isCastingMulticlass: false,
    combinedSlots: { 1: 4, 2: 3 }, // Combined level-based slots
  },
  // Other sources (items, feats)
  other: {
    spellsKnown: [],
    itemSpells: [], // From items/wands/etc
  }
}
```

#### SpellService Enhancements
- Load from spell data files (already implemented)
- Add methods:
  - `getSpellsByClass(className)` - Get spells available to class
  - `getSpellsByLevel(level)` - Filter spells by level
  - `getSpellsBySchool(school)` - Filter by school of magic
  - `getCantrips()` - Filter cantrips (level 0)
  - `getSpellsByFilters(filters)` - Combined filter method
  - `isRitualCastable(spell)` - Check ritual property
  - `requiresConcentration(spell)` - Parse concentration requirement
  - `getSpellSlots(character, classLevel)` - Calculate spell slots per class/level
  - `calculateSpellSaveDC(character, classInfo)` - DC = 8 + prof + ability mod
  - `calculateSpellAttackBonus(character, classInfo)` - Bonus = prof + ability mod

### 2.2 Spell Selection Service

**File:** `src/renderer/scripts/services/SpellSelectionService.js`

```javascript
class SpellSelectionService {
  // Get available spells for character's classes
  getAvailableSpells(character)
  
  // Known vs Prepared
  addKnownSpell(character, classLevel, spellData)
  removeKnownSpell(character, classLevel, spellName)
  prepareSpell(character, classLevel, spellName)
  unprepareSpell(character, classLevel, spellName)
  
  // Spell slots
  getSpellSlots(character, classLevel) // Return { 1: {max, current}, 2: ... }
  useSpellSlot(character, classLevel, level)
  restoreSpellSlots(character, classLevel) // On short/long rest
  
  // Validation
  canAddSpell(character, classLevel, spell) // Check prerequisites, known limit
  canPrepareSpell(character, classLevel, spell) // Prepared limit = level + ability mod
  
  // Multiclass support
  calculateMulticlassSlots(character) // Combine slots per D&D rules
}
```

### 2.3 UI Components

#### Spells Page
**File:** `src/renderer/pages/spells.html`

- **Cantrips Section**: List by class
- **Spell Levels 1-9**: By class, show prepared vs known
- **Spell Slots Display**: Current vs maximum per level
- **Known Spells**: Show count, button to add
- **Prepared Spells**: Show count, button to prepare/unprepare
- **Add Spell Button**: Open SpellSelectionModal

#### SpellSelectionModal
**File:** `src/renderer/scripts/modules/spells/SpellSelectionModal.js`

Pattern follows `FeatSelectionModal`:
- Search bar with real-time filtering
- Filters panel:
  - **Spell Level**: Cantrip, 1-9
  - **School**: Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation
  - **Casting Class**: Wizard, Cleric, Bard, Paladin, Ranger, Sorcerer, Druid, Warlock
  - **Ritual Only**: Yes/No
  - **Concentration**: Yes/No
- Filter by character's class/level availability
- Show spell details (casting time, range, components, description)
- Add button (validates prerequisites and limits)
- Cancel button
- Emit `SPELL_ADDED` event on confirmation

### 2.4 Event Bus Events
```javascript
EVENTS.SPELL_ADDED: 'spell:added'
EVENTS.SPELL_REMOVED: 'spell:removed'
EVENTS.SPELL_PREPARED: 'spell:prepared'
EVENTS.SPELL_UNPREPARED: 'spell:unprepared'
EVENTS.SPELL_SLOTS_USED: 'spell-slots:used'
EVENTS.SPELL_SLOTS_RESTORED: 'spell-slots:restored'
EVENTS.SPELLS_UPDATED: 'spells:updated'
```

### 2.5 IPC Handlers
**File:** `src/electron/ipc/handlers/SpellHandlers.js`

- `spells:add-spell` - Add spell to known list
- `spells:remove-spell` - Remove spell
- `spells:prepare-spell` - Prepare spell (if applicable)
- `spells:unprepare-spell` - Unprepare spell
- `spells:use-slot` - Use spell slot
- `spells:restore-slots` - Restore spell slots on rest

---

## 3. Level-Up & Multiclass Logic

### 3.1 Data Model

#### Character Level Structure
```javascript
character.level = 3; // Total character level

character.progression = {
  classes: [
    {
      name: "Wizard",
      level: 2,
      subclass: { name: "Evocation", source: "PHB" },
      hitDice: "d6",
      hitPoints: [6, 5], // Per level (rolled or avg)
      features: [
        { name: "Arcane Recovery", source: "Class", level: 1 },
        { name: "Evocation Savant", source: "Subclass", level: 2 },
      ]
    },
    {
      name: "Rogue",
      level: 1,
      subclass: null,
      hitDice: "d8",
      hitPoints: [6],
      features: []
    }
  ],
  experiencePoints: 0,
  levelUps: [
    {
      fromLevel: 1,
      toLevel: 2,
      appliedFeats: ["Polearm Master"],
      appliedFeatures: ["Arcane Recovery"],
      changedAbilities: {}, // Any ability score changes
      timestamp: "2025-01-07T..."
    }
  ]
}
```

#### Character Schema Changes
- Change `level` to track total character level
- Add `progression` object to track per-class levels and features
- Add `experiencePoints` (optional, for D&D 5e progression)

### 3.2 Level-Up Service

**File:** `src/renderer/scripts/services/LevelUpService.js`

```javascript
class LevelUpService {
  // Level management
  async increaseLevel(character) // Increment total level
  async decreaseLevel(character) // Decrement total level
  
  // Multiclass
  async addClassLevel(character, className, level) // Add new class or increase existing
  async removeClassLevel(character, className)
  async getAvailableClassesForMulticlass(character)
  
  // Features & Progression
  async getClassFeaturesForLevel(className, level)
  async getSubclassFeaturesForLevel(subclassName, level)
  async getASILevels(className) // Levels where ASI/feat is available
  
  // Spell Progression
  async updateSpellSlots(character) // Recalculate based on new levels
  async updateKnownCantrips(character)
  
  // Hit Points
  async calculateMaxHitPoints(character) // Based on all class levels
  async rollHitDice(character, diceType) // Roll and add HP
  
  // Validation
  isValidMulticlass(character, newClass) // Check feat/spell requirements
  getMulticlassRestrictions(character) // Return any applicable restrictions
}
```

### 3.3 UI Components

#### Level-Up Page
**File:** `src/renderer/pages/levelup.html`

Sections:
- **Current Level**: Display total and per-class breakdown
- **Level Control**: +/- buttons to change level
- **Class Selection** (if multiclass): Select which class to level
- **Features Gained**: List new features at this level
- **ASI/Feat Selection**: If applicable level, allow feat/ability choice
- **Spell Updates**: Show new spell slots, cantrips
- **Hit Points**: Show HP calculation and allow rolling/manual entry
- **Apply/Cancel**: Confirm or revert changes

#### Level-Up Modal (Alternative)
**File:** `src/renderer/scripts/modules/levelup/LevelUpModal.js`

Alternative to page for in-context leveling:
- Wizard for multi-step progression
- Step 1: Confirm level change
- Step 2: Apply features
- Step 3: Apply ASI/feat selection (if applicable)
- Step 4: Update spells and slots
- Step 5: Review and confirm

### 3.4 Integration with Existing Systems

#### Feat System Integration
- On level-up, determine ASI/feat availability
- Integrate with existing `FeatSelectionModal` for ASI selection
- Track feat sources: "Class ASI at level X", "Variant Human", "Feat choice"

#### Class/Subclass Integration
- Load features from class/subclass data
- Apply features automatically on level-up
- Update proficiencies and abilities based on features

#### Ability Score Integration
- Apply ASIs at level 4, 8, 12, 16, 19
- Support ability score increases from feats (e.g., +2 Dexterity)
- Track ability score sources

#### Spell System Integration
- Update available spell slots based on class levels
- Recalculate known/prepared spells
- Handle multiclass spell slot combination

### 3.5 Event Bus Events
```javascript
EVENTS.CHARACTER_LEVELED_UP: 'character:leveledUp'
EVENTS.CHARACTER_LEVELED_DOWN: 'character:leveledDown'
EVENTS.CHARACTER_LEVEL_CHANGED: 'character:levelChanged'
EVENTS.MULTICLASS_ADDED: 'multiclass:added'
EVENTS.MULTICLASS_REMOVED: 'multiclass:removed'
EVENTS.FEATURES_ADDED: 'features:added'
EVENTS.FEATURES_REMOVED: 'features:removed'
```

### 3.6 IPC Handlers
**File:** `src/electron/ipc/handlers/ProgressionHandlers.js`

- `progression:level-up` - Increase character level
- `progression:level-down` - Decrease character level
- `progression:add-class` - Add multiclass
- `progression:remove-class` - Remove class level
- `progression:get-features` - Get available features at level
- `progression:apply-asi` - Apply ability score increase
- `progression:get-class-features` - Get class features by level

---

## 4. Integration Requirements

### 4.1 Character State Management
- All changes must update `character` object and emit `CHARACTER_UPDATED` event
- Save to storage via `CharacterManager.saveCharacter()`
- Track `hasUnsavedChanges` in `AppState`

### 4.2 Service Initialization
Update `AppInitializer.js`:
- Initialize `EquipmentService`, `SpellSelectionService`, `LevelUpService`
- Load data sources in parallel with existing services
- Emit appropriate load events

### 4.3 Navigation Integration
- Add pages to `NavigationController`
- Update build.html or create separate pages for equipment, spells, levelup
- Ensure proper page loading and unloading

### 4.4 Avoiding Breakage
- Character schema must support old/new data formats
- Add migrations if needed for existing characters
- All new properties should have sensible defaults
- Do not remove existing functionality

### 4.5 Class/Subclass Feature Integration
- Load features from class/subclass data when available
- Populate character.progression automatically on creation
- Support late binding of features (in case class is changed)

### 4.6 Proficiency System Integration
- Level-up may grant new proficiencies
- Use existing `ProficiencyCore` and proficiency tracking
- Emit proficiency change events

---

## 5. Data Flow Examples

### 5.1 Adding an Item
```
User → ItemSelectionModal → Add Item
  ↓
EquipmentService.addItem()
  ↓
character.inventory.items.push(newItem)
character.inventory.weight.current += itemWeight
  ↓
eventBus.emit(EVENTS.ITEM_ADDED, character, item)
  ↓
CharacterManager.saveCharacter()
  ↓
Equipment page updates to show new item
```

### 5.2 Leveling Up from 2 to 3
```
User → LevelUp Page → Select Level 3
  ↓
LevelUpService.increaseLevel()
  ↓
character.level = 3
character.class.level = 3
character.progression.classes[0].level = 3
  ↓
Determine features at level 3 → Load from ClassService
character.progression.classes[0].features += newFeatures
  ↓
Check for ASI at level 3 → None for most classes
  ↓
Update spell slots via SpellSelectionService
  ↓
eventBus.emit(EVENTS.CHARACTER_LEVEL_CHANGED, character, { from: 2, to: 3 })
eventBus.emit(EVENTS.FEATURES_ADDED, character, newFeatures)
  ↓
CharacterManager.saveCharacter()
  ↓
UI updates to show new level, features, spell slots
```

### 5.3 Selecting a Spell
```
User → Spells Page → Add Spell
  ↓
SpellSelectionModal → Search & Filter → Select "Magic Missile"
  ↓
Validate: Can this character know this spell?
  → Check class list, level availability, prerequisites
  ↓
character.spellcasting.classes["Wizard"].spellsKnown.push(spell)
  ↓
eventBus.emit(EVENTS.SPELL_ADDED, character, spell)
  ↓
CharacterManager.saveCharacter()
  ↓
Spells page updates
```

---

## 6. Implementation Checklist

### Phase 1: Core Models & Services
- [ ] Extend `Character.js` with inventory, spellcasting, progression
- [ ] Update `CharacterSchema.js` with new properties
- [ ] Create `EquipmentService.js`
- [ ] Enhance `SpellService.js` and create `SpellSelectionService.js`
- [ ] Create `LevelUpService.js`

### Phase 2: Modals & UI
- [ ] Create `ItemSelectionModal.js`
- [ ] Create `SpellSelectionModal.js`
- [ ] Create equipment.html page (enhance existing)
- [ ] Create spells.html page
- [ ] Create levelup.html page (or modal alternative)

### Phase 3: Integration
- [ ] Add IPC handlers for all operations
- [ ] Update `AppInitializer.js` to init new services
- [ ] Update `NavigationController` with new pages
- [ ] Update `EventBus.EVENTS` with new events
- [ ] Wire event listeners in pages/modals

### Phase 4: Testing
- [ ] Test item add/remove/equip/attune
- [ ] Test spell selection with multiclass scenarios
- [ ] Test level-up with feature/ASI application
- [ ] Test backward compatibility with existing characters
- [ ] E2E tests for full workflows

---

## 7. Code Quality Guidelines

### Naming Conventions
- Services: `*Service.js` (e.g., `EquipmentService.js`)
- Modals: `*Modal.js` (e.g., `ItemSelectionModal.js`)
- Pages: lowercase with hyphens (e.g., `equipment.html`)
- Events: `SCREAMING_SNAKE_CASE` (e.g., `ITEM_ADDED`)

### Error Handling
- All async operations should have try/catch
- Log errors with `console.error` and scope
- Emit error events for UI notification
- Return null/empty on failure, not throw (where appropriate)

### Documentation
- JSDoc comments on all public methods
- Clear parameter types and return values
- Comment complex logic (D&D rules especially)
- Update DESIGN_SYSTEMS.md as implementation progresses

### Performance
- Use O(1) lookups with maps (like ItemService)
- Batch operations where possible
- Cache frequently accessed data
- Avoid redundant calculations
