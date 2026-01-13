# Level Up Modal Rework - Implementation Plan

**Document Version:** 1.1  
**Status:** In Progress - Phase 1 Complete, Phase 2 Starting  
**Date:** January 13, 2026

**Progress:**
- ✅ Phase 1: Foundation (LevelUpSession, Modal skeleton, Step 0, Step 4)
- 🟡 Phase 2: Class Features (In Progress)
- ⬜ Phase 3: Spells & ASI
- ⬜ Phase 4: Testing & Cleanup

---

## Overview

Completely rework the Level Up Modal with a **staged changes** architecture. All modifications are collected during the wizard flow and only applied to the character when the user confirms. This provides a clean separation between user choices and data mutations.

### Key Architectural Change

**Before:** Changes applied immediately at each step → risk of partial state if user exits  
**After:** All changes staged in `LevelUpSession` → applied atomically on final confirm

---

## Core Architecture

### 1. LevelUpSession Class

**Location:** `src/app/LevelUpSession.js` (new)

**Purpose:** Encapsulates all state for a single level-up wizard flow. Acts as a transaction-like system.

```javascript
class LevelUpSession {
    constructor(character) {
        this.originalCharacter = character;  // Reference to current character
        this.stagedChanges = {};             // All modifications staged here
        
        // Initialize staged structure matching character schema
        this.stagedChanges.level = character.level;
        this.stagedChanges.progression = JSON.parse(JSON.stringify(character.progression || {}));
        this.stagedChanges.classes = JSON.parse(JSON.stringify(character.classes || []));
        this.stagedChanges.spellcasting = JSON.parse(JSON.stringify(character.spellcasting || {}));
        this.stagedChanges.feats = JSON.parse(JSON.stringify(character.feats || []));
        this.stagedChanges.abilities = JSON.parse(JSON.stringify(character.abilities || {}));
        // ... other relevant fields
        
        this.currentStep = 0;
        this.stepData = {};  // Per-step metadata (e.g., selected feats pending confirmation)
    }
    
    /**
     * Get a property from staged changes (fallback to original if not modified)
     */
    get(path) {
        // Navigate stagedChanges using dot notation
    }
    
    /**
     * Set a property in staged changes
     */
    set(path, value) {
        // Navigate and update stagedChanges using dot notation
    }
    
    /**
     * Apply all staged changes to the original character
     */
    applyChanges() {
        // Deep merge stagedChanges into originalCharacter
        // Emit CHARACTER_UPDATED event
        // Trigger UI refresh
    }
    
    /**
     * Reset to initial state (for cancel flow)
     */
    discard() {
        this.stagedChanges = JSON.parse(JSON.stringify(this._initialState));
    }
    
    /**
     * Get summary of changes for step 5 review
     */
    getChangeSummary() {
        // Return { added, removed, modified } for each category
    }
}
```

---

## Step-by-Step Breakdown

### Step 0: Level & Multiclass

**Purpose:** Select which class(es) to level up, optionally add new classes.

**User Interactions:**
- Display current classes with level counts
- Show available classes in dropdown (with restrictions badge)
- Toggle multiclass restrictions (ability score requirements)
- "Add Class" button → adds new class at level 1
- "Level Up" button → increases selected class level by 1
- Can level multiple classes in same session

**Staged Data:**
```javascript
stagedChanges.progression.classes = [
    { name: "Fighter", levels: 3 },
    { name: "Rogue", levels: 2 }  // New multiclass
]
stagedChanges.level = 5;  // Total level
```

**Validation:**
- At least one class must exist
- Total level ≤ 20
- If adding class, check multiclass requirements (unless toggled)

**UI Behavior:**
- "Next" button enabled only if changes made OR user confirms "no changes"
- Shows "You can level multiple classes. Select a class and click Level Up."

---

### Step 1: Class Features

**Purpose:** Review and interact with features gained at this level for each class.

**User Interactions:**
- List features gained at each new level per class
- **Interactive selections** for optional features:
  - Sorcerer Metamagic → select options
  - Battle Master Maneuvers → select options
  - Eldritch Invocations → select options
  - Champion Fighting Style (if applicable) → select
  - Etc.
- Display read-only features (e.g., "Extra Attack gained")

**Staged Data:**
```javascript
stepData.selectedFeatures = {
    "Fighter": ["Extra Attack"],
    "Sorcerer": { "Metamagic": ["Twinned Spell", "Subtle Spell"] }
}
```

**Handling "Nothing to Do":**
- If no features at current level(s), show:
  - ✓ "No class features gained at this level"
  - Still allow "Next" → don't skip step
  - Button states: "Back" disabled (first step), "Next" enabled

**Validation:**
- All required feature selections completed
- No validation errors from selections

**UI Behavior:**
- Features displayed as expandable cards per class
- Selection modals/dropdowns inline within card
- Clear visual distinction between required/optional
- "Confirm selections" banner at bottom

---

### Step 2: ASI/Feat Selection

**Purpose:** Assign Ability Score Increases and choose feat/ASI.

**User Interactions:**
- Calculate ASI triggers from level-up (Fighter at 4,8,12,16,19)
- Display available ASI slots
- For each slot:
  - Ability Score buttons (6) → click to +2
  - **OR** "Choose Feat" button
- If feat chosen, mini-modal/popover to select feat
- Show current feat list as reference

**Staged Data:**
```javascript
stepData.asiChoices = [
    { type: "asi", abilities: { strength: 2 } },  // +2 STR
    { type: "feat", featName: "Great Weapon Master" }
]
```

**Handling "Nothing to Do":**
- If no ASIs at current level(s):
  - ✓ "No ability score improvements available at this level"
  - Still proceed to step 3
  - Button: "Next" enabled

**Validation:**
- All ASI slots filled
- All feat selections valid

**UI Behavior:**
- ASI slots shown as accordion/cards
- Clear visual: "Select ability OR choose feat"
- Feat preview on hover

---

### Step 3: Spell Selection

**Purpose:** Select new spells for spellcasting classes.

**User Interactions:**
- Calculate new spell allowances from level-up(s)
- For each allowance:
  - Click "Select Spells" → opens **LevelUpSpellSelector** (focused spell selection UI)
  - Modal shows remaining slots and selected spells
  - Return selections to wizard
- Display selected spells in summary

**Staged Data:**
```javascript
stagedChanges.spellcasting = {
    classes: {
        "Wizard": {
            spellsKnown: [...existingSpells, ...newlySelected],
            spellSlots: { /* updated */ }
        }
    }
}
```

**Handling "Nothing to Do":**
- If no new spell slots at current level(s):
  - ✓ "No new spells available at this level"
  - Still proceed to step 4
  - Button: "Next" enabled

**LevelUpSpellSelector (~450 lines):**

A focused, simplified spell selection component designed specifically for level-up context. Key features:

1. **Spell List:**
   - Filtered by: class (if restrictions enabled), available spell levels from allowances
   - Sorted: cantrips first, then by level, then alphabetically
   - Shows: spell name, level, school, concentration badge, ritual badge

2. **Search:**
   - Simple real-time search by spell name and description
   - Debounced for performance

3. **Restrictions Toggle:**
   - "Allow spells from other classes" toggle
   - When enabled, shows spells outside normal class list
   - Useful for multiclass or homebrew scenarios

4. **Selection:**
   - Click spell card to select/deselect
   - Visual feedback (highlight, checkbox)
   - Progress counter: "X/Y spells selected"
   - "Confirm" button enabled only when selection complete

5. **Integration:**
   - Accepts: `className`, `allowances`, `character`
   - Returns: array of selected spell objects
   - Callback pattern for staged changes: `onConfirm(selectedSpells)`

**Why LevelUpSpellSelector vs SpellSelectionModal:**
- ✅ ~450 lines (focused) vs 917 lines (feature-rich)
- ✅ Only relevant filters for level-up context
- ✅ No virtual scrolling/pagination complexity
- ✅ No description caching system
- ✅ Simpler event handling
- ✅ Cleaner code, easier to maintain
- ✅ Keeps SpellSelectionModal intact for other uses (spell management, inventory)

**Validation:**
- All required spell selections completed
- Spell counts match allowances

**UI Behavior:**
- Progress indicator: "X/Y spells selected"
- Each class spell selection separate modal call
- "Confirm" button enabled only when all spells selected
- "Cancel" button restores previous selections

---

### Step 4: Summary

**Purpose:** Review all staged changes before applying.

**User Interactions:**
- Display all changes:
  - Level progression
  - New features
  - ASI/Feat choices
  - Spell selections
- "Back" button → return to any previous step to edit
- "Confirm" button → apply all changes
- "Cancel" button (if not on first step) → show confirmation dialog

**Staged Data:**
- Read from `LevelUpSession.getChangeSummary()`

**UI Behavior:**
- Organized by category
- Each section collapsible
- Visual distinction: added/changed/removed
- "Back" returns to last step or allows selecting specific step?
  - **Recommendation:** Click on step number in stepper to jump back
  - Revalidate that step before allowing forward progress

**Confirm Flow:**
1. Call `session.applyChanges()`
2. Character object updated with all staged changes
3. Emit `CHARACTER_UPDATED` event
4. Trigger UI refresh (character sheet, spells, etc.)
5. Save character to storage (IPC call)
6. Close modal
7. Show success notification

**Cancel Flow:**
1. Show confirmation: "Are you sure? All unsaved changes will be lost."
2. If confirmed → discard session, close modal
3. If cancelled → return to current step

---

## Navigation & Step Flow

### Rules

✅ **Always In Order:**
- Step 0 → 1 → 2 → 3 → 4 (no skipping)
- "Next" advances to next step
- "Back" returns to previous step

✅ **Back from Summary (Step 4):**
- Can click stepper to jump to any previous step
- Revalidate that step's data on arrival
- Proceed normally

✅ **First Step (Step 0):**
- "Back" button disabled
- "Next" enabled only if changes made or user confirms no changes

✅ **"Nothing to Do" Steps:**
- Show message but don't allow skipping
- "Next" button enabled to proceed
- Visual: slightly different styling (info banner)

### Button States

| Step | Back | Next | Status |
|------|------|------|--------|
| 0 | Disabled | Enabled if changes | Level & Multiclass |
| 1+ | Enabled | Enabled if valid | Proceed to next |
| 4 | Enabled | "Confirm" instead | Review & Apply |

---

## State Management Flow

### Initialization

```javascript
// From modal.show()
const session = new LevelUpSession(character);
modal.session = session;  // Store in modal instance
```

### During Wizard

```javascript
// Step 0: User levels Fighter
session.set('progression.classes[0].levels', 4);

// Step 1: User selects Metamagic
session.stepData.selectedFeatures = { ... };

// Step 2: User chooses +2 STR
session.stepData.asiChoices = [{ type: "asi", abilities: { strength: 2 } }];

// Step 3: User selects spells
session.set('spellcasting.classes.Wizard.spellsKnown', [...]);

// Step 4: User reviews and confirms
session.applyChanges();
```

### After Confirm

```javascript
// In newLevelUpModal.js
await session.applyChanges();

// Emit event
eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });

// Save to storage
await ipc.invoke('saveCharacter', character);

// UI updates automatically via CHARACTER_UPDATED listeners
```

---

## UI Component Structure

### New/Modified Components

```
src/app/
  └── LevelUpSession.js            (NEW - State container for staged changes)

src/ui/components/level/
  ├── Modal.js                     (REWRITE - Main wizard)
  ├── steps/
  │   ├── Step0LevelMulticlass.js  (NEW)
  │   ├── Step1ClassFeatures.js    (NEW - with interactive selections)
  │   ├── Step2ASIFeat.js          (NEW)
  │   ├── Step3SpellSelection.js   (NEW - orchestrates LevelUpSpellSelector)
  │   └── Step4Summary.js          (NEW)
  ├── FeatureSelector.js           (NEW - reusable for Metamagic, Maneuvers, etc.)
  └── LevelUpSpellSelector.js      (NEW - Focused spell selection for level-up)

src/ui/components/spells/
  └── Modal.js                     (CLEANUP - Remove level-up specific logic)
```

### HTML Structure

- Keep existing `#levelUpModal` skeleton
- Simplify content areas to step containers
- Each step loads dynamically or shown/hidden

---

## Integration with Services

### LevelUpService

- Already has `increaseLevel()`, `addClassLevel()`, etc.
- **Update:** Modify to work with staged session rather than direct mutation
- Or keep as-is and call from `session.applyChanges()`

### SpellSelectionService

- Already used by spell management
- **No changes needed** - just ensure new spell selections propagate correctly

### SpellSelectionModal Cleanup

**Current Issue:**
The existing `SpellSelectionModal` (917 lines) has embedded level-up specific logic:
- `newAllowances` parameter for spell selection limits
- `_renderSpellSelectionIndicator()` method
- `_preserveSelections` flag and snapshot logic for level-up persistence
- Exception handling for level-up modal coordination
- `allowClose` parameter for level-up restrictions

**Cleanup Plan:**
1. **Remove** level-up specific parameters from constructor:
   - ✗ `newAllowances` 
   - ✗ `allowClose` (use default behavior)
   - ✗ `selectedSpells` preservation logic for level-up

2. **Remove** methods:
   - ✗ `_renderSpellSelectionIndicator()`
   - ✗ Level-up specific limit checking logic

3. **Remove** state tracking:
   - ✗ `_preserveSelections` flag
   - ✗ `_spellSelectionLimit` field
   - ✗ Level-up session specific comments

4. **Simplify:**
   - Level-up context now handled via `LevelUpSpellSelector`
   - SpellSelectionModal returns to pure spell management duties
   - Remove all `console.debug()` entries mentioning "level-up"
   - Remove try-catch blocks specific to level-up coordination

5. **Result:**
   - Cleaner, focused SpellSelectionModal (~800-850 lines)
   - Better separation of concerns
   - Easier maintenance
   - No functional change for spell management UI

### EventBus

- **CHARACTER_UPDATED:** Emit after `applyChanges()` with changed character
- **LEVEL_UP_MODAL_CLOSED:** New event if needed for analytics

---

## Multi-Class Leveling Flow

### How Multiple Classes Work in One Session

**Scenario:** Character is Fighter 4 / Rogue 2. User wants to level both to Fighter 5 / Rogue 3.

**Step 0 Flow:**
1. Display both classes: Fighter (4), Rogue (2)
2. User selects Fighter, clicks "Level Up" → Fighter becomes 5 in staged state
3. User selects Rogue, clicks "Level Up" → Rogue becomes 3 in staged state
4. Total level automatically updates: 6 → 7
5. User confirms, proceeds to Step 1

**Step 1 (Features) Flow:**
- Determine new features for **each class**:
  - Fighter 4→5: Extra Attack (already has), possibly Fighting Style choice
  - Rogue 2→3: Expertise increase (feature selection needed)
- Display features organized **by class**
- User makes selections for each class that has features
- If both classes have features, both sections must be completed

**Step 2 (ASI/Feat) Flow:**
- **Per-class ASI triggers:**
  - Fighter gets ASI at 4, 8, 12, 16, 19 (leveling 4→5 doesn't trigger if at 5)
  - Rogue gets ASI at 4, 8, 12, 16, 19
- Calculate if **either** class triggers ASI from this level-up
- Example: If this is Fighter's first level AND triggers ASI, or Rogue's first level AND triggers ASI
- Result: Possible 0, 1, or 2 ASI slots depending on which classes triggered

**Step 3 (Spells) Flow:**
- **Per-class spell allowances:**
  - Fighter (not a spellcaster): No spell selection
  - Rogue (not a spellcaster): No spell selection
  - If one/both were spellcasters (e.g., Fighter/Cleric):
    - Calculate new spells for each spellcasting class
    - Open LevelUpSpellSelector for each
    - Track selections separately in `stagedChanges.spellcasting.classes`

**Important Notes:**
- Each class's features, ASIs, and spells are **independent**
- Total level = sum of all class levels
- Proficiency bonus recalculates based on total level (not per-class)
- HP calculation happens **once at the end** (not per-class)

---

## Data Loading & Class Progression Logic

### Data Sources

1. **5etools Class Data** (`src/data/classes.json`, `src/data/fluff-classes.json`)
   - Class definitions with class features at each level
   - Subclass information
   - Spellcasting info (ability, progression type)

2. **ClassService** (`src/services/ClassService.js`)
   - `getClass(className)` → Full class definition
   - `getClassFeatures(className, level)` → Features at specific level
   - `getSubclassFeatures(subclassName, level)` → Subclass features
   - Caches class data after first load

3. **LevelUpService** (`src/services/LevelUpService.js`)
   - `getNewFeatures(character, className, fromLevel, toLevel)` → Features gained in range
   - `getASIAtLevel(className, level)` → Whether class gets ASI at level
   - `getNewSpellAllowance(className, fromLevel, toLevel)` → Spell slots/cantrips gained

### How Features Are Determined

**Example: Sorcerer leveling 2→3**

```javascript
// Step 1: Load class definition
const classData = classService.getClass('Sorcerer');

// classData.classFeatures = [
//   { name: "Spellcasting", level: 1 },
//   { name: "Sorcerous Origin", level: 1 },
//   { name: "Font of Magic", level: 2 },
//   { name: "Metamagic", level: 3, choices: [...] },  // ← User levels into this
//   ...
// ]

// Step 2: Filter features for level range [2, 3]
const newFeatures = classData.classFeatures.filter(f => f.level >= 2 && f.level <= 3);

// Result: [Font of Magic (already known), Metamagic (new)]

// Step 3: Determine which are interactive
const interactiveFeatures = newFeatures.filter(f => f.choices && f.choices.length > 0);
// Result: [Metamagic (needs user choice)]

// Step 4: Display in Step 1, user selects Metamagic options
```

### Subclass Features

- If character has a subclass, load its features similarly
- **Subclass features appear alongside class features** in Step 1
- Organized by: "Class Features" section and "Subclass Features" section
- Follow same interactive selection logic

### Multiclass Considerations

- Each class has **independent feature progression**
- No feature stacking/conflicts (handled by 5e rules)
- Character must have minimum ability scores for multiclass (unless toggled)

---

## Stat Recalculation on Confirm

### What Recalculates

When `session.applyChanges()` is called, the following are recalculated **automatically**:

1. **Proficiency Bonus**
   - Based on total character level
   - Updates in `character.proficiencyBonus`

2. **Hit Points (HP)**
   - Recalculate based on:
     - New level for each class
     - Constitution modifier
     - Class hit die
     - Multiclass HP formula if applicable
   - Updates `character.hitPoints.current` (if first level-up of that class, add full hit die)
   - Updates `character.hitPoints.max`

3. **Spell Slots** (if spellcasting)
   - Recalculate based on new class levels
   - Account for multiclass spell slot sharing
   - Updates `character.spellcasting.classes[className].spellSlots`

4. **Cantrips Known**
   - If spellcasting class gains cantrips at level, add to selection
   - Updates `character.spellcasting.classes[className].cantripsKnown`

5. **Skill Proficiencies** (if applicable)
   - Some classes gain proficiencies at specific levels
   - Already tracked in feature selection

### Where This Happens

```javascript
// In LevelUpSession.applyChanges()
applyChanges() {
    // 1. Merge staged changes into character
    Object.assign(this.originalCharacter, this.stagedChanges);
    
    // 2. Recalculate derived stats
    this._recalculateProficiencyBonus();
    this._recalculateHP();
    this._recalculateSpellSlots();
    
    // 3. Validate character integrity
    this._validateCharacter();
    
    // 4. Emit events
    eventBus.emit(EVENTS.CHARACTER_UPDATED, { character: this.originalCharacter });
    eventBus.emit(EVENTS.LEVEL_UP_COMPLETE, { 
        character: this.originalCharacter,
        changes: this.getChangeSummary()
    });
    
    // 5. Save to storage (via IPC)
    ipc.invoke('saveCharacter', this.originalCharacter);
}
```

---

## Events & UI Refresh

### Events Emitted

1. **CHARACTER_UPDATED** (existing)
   - Emitted after `applyChanges()`
   - Payload: `{ character }`
   - Listeners: Character sheet, spells panel, abilities panel, etc.
   - **Result:** All character UI updates automatically

2. **LEVEL_UP_COMPLETE** (new, optional)
   - Emitted after CHARACTER_UPDATED
   - Payload: `{ character, changes: { leveledClasses, newFeatures, newASIs, newSpells } }`
   - Listeners: Analytics, notifications, character history
   - **Result:** Can track/log level-up events

### What UI Updates Automatically

When CHARACTER_UPDATED is emitted:
- ✅ Character sheet (total level, class levels)
- ✅ Ability scores (if ASI was chosen)
- ✅ Hit points (recalculated)
- ✅ Proficiency bonus (if visible)
- ✅ Spells known (if spells were added)
- ✅ Features display (if present)
- ✅ Skills/saves (if proficiencies changed)

### Character Sheet Refresh Strategy

```javascript
// In character sheet component
eventBus.on(EVENTS.CHARACTER_UPDATED, ({ character }) => {
    this.character = character;
    this.render();  // Re-render character sheet
});

// This single listener handles ALL updates from level-up
// No need for level-up specific refresh logic
```

---

## Error Handling & Validation

### Per Step

- **Step 0:** Must have ≥1 class, level ≤ 20
- **Step 1:** All required features selected
- **Step 2:** All ASI slots filled
- **Step 3:** All spell slots filled
- **Step 4:** Everything valid (re-validate)

### On Confirm (Pre-Apply Validation)

Before applying changes:
1. **Validate state integrity:**
   - Total level ≤ 20
   - All classes have valid levels
   - All ASI/Feat selections valid
   - All spell selections complete

2. **Validate character doesn't break:**
   - HP > 0
   - Required spells exist
   - Features are defined

3. **If validation fails:**
   - Show error modal with details
   - Return to problematic step
   - Never partially apply changes

### Data Loading Failures

- If ClassService fails to load class data:
  - Show error: "Could not load class features"
  - Provide "Retry" button
  - Don't allow proceed without data

### Apply Failures

- If `applyChanges()` throws error:
  - Log error
  - Show: "Failed to apply changes. Please try again."
  - Don't close modal
  - Character remains unchanged

### Rollback Strategy

- **Before apply:** Snapshot current character state
- **If apply fails:** Restore from snapshot (discards all staged changes)
- **Prevents:** Partial/corrupted character state

### On Cancel

- Offer confirmation dialog: "Are you sure? All unsaved changes will be lost."
- If confirmed:
  - Discard session
  - Close modal
  - Character unchanged
- If cancelled:
  - Return to current step
  - Continue wizard

---

## Testing Strategy

### Unit Tests

- `LevelUpSession.js` → state get/set, applyChanges logic
- Each step validator → ensure validation rules work
- Change summary generator → verify summary accuracy

### Integration Tests

- Existing tests should continue to work
- New tests for staged flow:
  - Create session, level multiple classes, confirm
  - Modify spell selection, go back and change, confirm
  - Verify character state after confirm matches expected
  - Test cancel flow → verify no changes applied

### E2E Tests (Playwright)

- Full wizard flow: 0→1→2→3→4→Confirm
- Back navigation: confirm selections persist
- Cancel flow: changes discarded
- "Nothing to do" steps: verify message shows

---

## Implementation Phases

### Phase 1: Foundation
1. Create `LevelUpSession` class
2. Rewrite main `Modal.js` to use session
3. Implement step 0 (Level & Multiclass)
4. Implement step 4 (Summary with back navigation)

### Phase 2: Feature Interaction
5. Implement step 1 (Class Features with interactive selections)
6. Create `FeatureSelector.js` component
7. Integrate with Metamagic, Maneuvers, etc.

### Phase 3: Abilities & Spells
8. Implement step 2 (ASI/Feat)
9. Create `LevelUpSpellSelector` component
10. Implement step 3 (Spell Selection orchestration)

### Phase 4: Cleanup & Testing
11. Clean up `SpellSelectionModal` to remove level-up logic
12. Unit tests
13. Integration tests
14. E2E tests
15. Bug fixes & refinement

---

## File Changes & Cleanup Plan

Once new modal fully tested and working:

### Deletions
1. Delete old `src/ui/components/level/Modal.js` (1195 lines)
2. Delete old level-up modal tests from `tests/`

### Modifications
1. Clean up `src/ui/components/spells/Modal.js`:
   - Remove `newAllowances`, `allowClose`, `selectedSpells` parameters
   - Remove `_renderSpellSelectionIndicator()` method
   - Remove `_preserveSelections` and level-up coordination logic
   - Remove all level-up related console logs and comments
   - Result: ~800-850 lines (cleaner)

### Keeps
1. `LevelUpService.js` - can keep as-is or refactor later
2. `SpellSelectionService.js` - no changes needed
3. All existing spell management UI untouched

---

## Migration Checklist

- [ ] LevelUpSession class created
- [ ] Modal.js rewritten with session integration
- [ ] Step 0 implemented
- [ ] Step 1 implemented
- [ ] Step 2 implemented
- [ ] LevelUpSpellSelector created
- [ ] Step 3 implemented
- [ ] Step 4 implemented
- [ ] FeatureSelector component created
- [ ] Confirm flow wires up CharacterManager/IPC
- [ ] Cancel flow works with confirmation
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Old level-up Modal.js removed
- [ ] SpellSelectionModal cleaned up
- [ ] Documentation updated

---

## Key Design Principles

1. **Staged, not live** — No changes to character until confirm
2. **Always in order** — No skipping steps, clear progression
3. **Interactive** — User chooses metamagic, maneuvers, ASIs, feats, spells
4. **Atomic** — All changes applied together or not at all
5. **Reusable** — FeatureSelector, step components usable elsewhere
6. **Testable** — LevelUpSession isolated from UI for unit testing
7. **Recoverable** — Users can go back and edit any previous step

---

## Appendix: Example Session Flow

```javascript
// User opens level-up modal
const session = new LevelUpSession(character);

// Step 0: Levels Fighter from 4→5
session.set('progression.classes.0.levels', 5);
session.set('level', 5);

// Step 1: Selects Extra Attack (auto) + no choices
// (No action needed, feature auto-applied in staged state)

// Step 2: ASI → +2 to Strength
session.stepData.asiChoices.push({ type: "asi", abilities: { strength: 2 } });

// Step 3: No new spells (Fighter isn't a spellcaster)
// Message shown: "No new spells available"

// Step 4: Review
// User sees: "Total level increased 4→5", "+2 Strength", no spell changes

// Confirm
session.applyChanges();
// Character now: level=5, strength+=2, progression updated

// UI updates via CHARACTER_UPDATED event
// Modal closes
```

---
