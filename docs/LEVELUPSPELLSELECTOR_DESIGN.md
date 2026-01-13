# LevelUpSpellSelector Design

**Purpose:** Focused spell selection modal for level-up wizard. Replaces inline spell selection with a dedicated, searchable interface.

**Status:** Design Complete, Implementation Ready

---

## Architecture

### Location
`src/ui/components/level/LevelUpSpellSelector.js`

### Responsibilities
1. Display available spells for a class at the current level
2. Filter/search spells by name, level, or school
3. Show spell restrictions (prepared vs known, ritual casting)
4. Manage selection state
5. Return selections to parent (Step3SpellSelection)
6. Enforce spell slot/known limits

### Component Pattern
```javascript
export class LevelUpSpellSelector {
    constructor(session, parentStep, className, currentLevel) {
        this.session = session;
        this.parentStep = parentStep;
        this.className = className;
        this.currentLevel = currentLevel;
        
        // Modal state
        this._modal = null;
        this._cleanup = DOMCleanup.create();
        
        // Selection state
        this.selectedSpells = [];
        this.maxSpells = 0;  // Based on class/level
    }
    
    async show() {
        // Initialize modal UI
        // Load spells
        // Attach listeners
        // Show modal
    }
    
    async _loadAvailableSpells() {
        // Query SpellService for eligible spells
    }
    
    async confirm() {
        // Validate selections
        // Return to parent
        // Close modal
    }
}
```

---

## Data Flow

```
Step3 Button Click
    ↓
LevelUpSpellSelector.show()
    ↓
Load available spells via SpellService
    ↓
Render spell list with filters
    ↓
User selects spells
    ↓
Confirm button
    ↓
Validate selections
    ↓
parentStep.updateSpellSelection(spells)
    ↓
Update session state
    ↓
Close modal & reload Step3
```

---

## UI Structure

### Modal Layout
```
┌─────────────────────────────────────────┐
│ Spell Selection - Wizard (Level 5)     │ X
├─────────────────────────────────────────┤
│ [Search] [Filter ▼] [Clear]            │
├─────────────────────────────────────────┤
│ Spell Type: Cantrip │ 1st Level │ ▶    │
├─────────────────────────────────────────┤
│ ☐ Acid Splash (Evocation) - damage     │
│ ☐ Fire Bolt (Evocation) - damage       │
│ ☐ Mage Hand (Transmutation) - utility  │
│ ... (paginated or scrolled)            │
├─────────────────────────────────────────┤
│ Selected: 2/3 cantrips                 │
├─────────────────────────────────────────┤
│ [Cancel] [Confirm]                     │
└─────────────────────────────────────────┘
```

### Sections
1. **Search/Filter Bar** - Quick search, school filter, prepared toggle
2. **Spell Level Tabs** - Switch between cantrips, 1st level, 2nd level, etc.
3. **Spell List** - Checkbox list with name, school, type
4. **Selection Counter** - Show current/max selections
5. **Action Buttons** - Cancel and Confirm

---

## Features

### 1. Search
- Fuzzy search by spell name
- Real-time filtering as user types
- Clear button to reset

### 2. Filtering
- **School Filter:** Abjuration, Conjuration, Divination, etc.
- **Spell Type Toggle:** Show/hide rituals, concentration spells
- **Prepared Toggle:** For classes with prepared spells

### 3. Spell Display
- Name (with link to spell details - future)
- School/Type
- Casting time
- Description snippet or hover tooltip

### 4. Restrictions
- **Spell Slots:** Enforce max selections per level
- **Known Spells:** For classes that know spells
- **Prepared Spells:** For classes that prepare spells
- **Class Restriction:** Only eligible spells shown

### 5. Selection Limits
- **Cantrips:** Often no limit (shows current count)
- **1st+ Level:** Based on class/level progression
- **Visual Feedback:** Counter shows "2/4 selected"

---

## Data Sources

### From SpellService
- `getEligibleSpells(className, spellLevel)`
- `getSpellDetails(spellId)`
- Includes: name, school, type, ritual-capable, concentration

### From LevelUpService / SpellSelectionService
- `getNewSpellSlots(className, level)` → How many 1st, 2nd, etc. level spells can be known
- `calculateMaxKnownSpells(className, level)` → Total spells known

### From Character Data
- `character.spellcasting.classes[className].spellsKnown`
- `character.spellcasting.classes[className].spellsPrepared`

---

## Implementation Steps

1. **Create LevelUpSpellSelector.js** (~450 lines)
   - Constructor with session/parent/class/level params
   - `show()` method for modal display
   - `_loadAvailableSpells()` with SpellService queries
   - `_renderSpellList()` with tabs and filters
   - Event listeners for selection and search

2. **Integrate with Step3SpellSelection**
   - Import LevelUpSpellSelector
   - Open on button click: `new LevelUpSpellSelector(session, this, className, level).show()`
   - Implement `updateSpellSelection()` callback
   - Update session.stepData.selectedSpells

3. **Bootstrap Modal Setup**
   - Add modal to index.html (if not present)
   - Use Bootstrap JS API for show/hide
   - Proper disposal in `dispose()` method

4. **State Management**
   - Store selections in `session.stepData.selectedSpells[key]`
   - Restore on modal reopen
   - Discard on cancel

---

## Testing Strategy

### Unit Tests
- Load available spells for each class
- Filter operations (search, school, type)
- Selection limit enforcement
- State persistence

### Integration Tests
- Open from Step3 button
- Select spells
- Return to Step3 with updated display
- Multiclass: Same modal for multiple classes

### E2E Tests
- Full wizard with spell selection
- Verify spells appear on character sheet post-apply

---

## Code Template Structure

```javascript
import { SpellService } from '../../../../services/SpellService.js';
import { SpellSelectionService } from '../../../../services/SpellSelectionService.js';
import { DOMCleanup } from '../../../../lib/DOMCleanup.js';

export class LevelUpSpellSelector {
    constructor(session, parentStep, className, currentLevel) {
        // Props
        // Modal state
        // DOMCleanup
        // Services
    }
    
    // Public Methods
    async show() { }
    async confirm() { }
    cancel() { }
    
    // Private Methods
    async _loadAvailableSpells() { }
    _renderSpellList() { }
    _attachListeners() { }
    _validateSelections() { }
    _enforceSelectionLimits() { }
    _updateSearchResults() { }
    dispose() { }
}
```

---

## Integration Points

### Step3SpellSelection
```javascript
this._cleanup.on(spellButton, 'click', async () => {
    const selector = new LevelUpSpellSelector(
        this.session, 
        this, 
        className, 
        level
    );
    await selector.show();
});
```

### Session State
```javascript
this.session.stepData.selectedSpells[key] = [
    { id: 'acid_splash', name: 'Acid Splash' },
    { id: 'fire_bolt', name: 'Fire Bolt' }
];
```

### Event Flow
1. User clicks "Select Spells" button in Step3
2. LevelUpSpellSelector instantiates and opens
3. User selects spells
4. Confirm → calls `parentStep.updateSpellSelection(spells)`
5. Step3 updates UI with selected spells
6. Modal closes, selector disposed
7. User continues wizard

---

## Performance Considerations

- Lazy load spell data on modal open (not at Step3 render)
- Cache spell list for duration of modal session
- Debounce search input (100ms)
- Paginate large spell lists (show 10 at a time)
- Reuse modal element if already in DOM

---

## Future Enhancements

- [ ] Spell details sidebar (hover or click)
- [ ] Favorites system for quick selection
- [ ] Spell comparison view
- [ ] "Auto-select recommended" button
- [ ] Multiclass spell pool viewer
- [ ] Ritual spell highlighting
