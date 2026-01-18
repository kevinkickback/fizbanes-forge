# Level-Up Refactor: Modal → Build Page

## Objective
Refactor level-up flow from 5-step modal wizard to:
- **Modal**: Level/class picker only ([src/ui/components/level/Modal.js](src/ui/components/level/Modal.js))
- **Build Page**: All choice UI (subclass, ASI, feats, spells, class features) ([src/ui/pages/build.html](src/ui/pages/build.html))

## Technical Problems (Current Implementation)
1. **Modal complexity**: [src/ui/components/level/Modal.js](src/ui/components/level/Modal.js) (454 lines) orchestrates 5 wizard steps
2. **Transactional state**: [src/app/LevelUpSession.js](src/app/LevelUpSession.js) (554 lines) manages staged changes
3. **Memory leaks**: Bootstrap modal instances + EventBus listeners require manual cleanup via [src/lib/DOMCleanup.js](src/lib/DOMCleanup.js)
4. **Hidden state**: Choices not visible after modal closes; requires modal reopen to review
5. **Test failures**: Timing-dependent modal tests (see [tests/level-up-modal-reopen.spec.js](tests/level-up-modal-reopen.spec.js), [tests/level-up-spell-selection-persistence.spec.js](tests/level-up-spell-selection-persistence.spec.js))
6. **Interrupted workflow**: Modal blocks interaction with character sheet during multi-step process

## Proposed Architecture

### Phase 1: Simplified Modal
**File**: [src/ui/components/level/Modal.js](src/ui/components/level/Modal.js)
**Dependencies**: [src/services/LevelUpService.js](src/services/LevelUpService.js), [src/lib/EventBus.js](src/lib/EventBus.js), [src/app/AppState.js](src/app/AppState.js)

**Current**: 5-step wizard (Step0_Level → Step1_Features → Step2_ASI → Step3_Spells → Step4_Summary)
**Target**: Single-step picker

**Implementation Requirements**:
- Display current level and class breakdown from `character.progression.classes`
- Buttons: "Add Level to [Class]" or "Add New Class"
- "Remove Last Level" button with confirmation dialog
- Call `LevelUpService.canMulticlass(character, newClassName)` before allowing multiclass
- On confirm:
  1. Call `LevelUpService.addClassLevel(character, className, level)`
  2. Emit `EventBus.EVENTS.CHARACTER_UPDATED`
  3. Bootstrap modal instance `.hide()` to close
- **CRITICAL**: Remove all `LevelUpSession` usage - changes apply immediately to character object
- **Cleanup**: Use `DOMCleanup.create()` for all DOM listeners; dispose Bootstrap modal before re-init

**Code Reduction**: 454 lines → ~100 lines (78% reduction)
**Files to Delete**: [src/app/LevelUpSession.js](src/app/LevelUpSession.js), [src/ui/components/level/steps/](src/ui/components/level/steps/) (all step files)

---

### Phase 2: Build Page Choice Sections
**Files**: [src/ui/pages/build.html](src/ui/pages/build.html), existing pages (spells, feats)

**Strategy**: Leverage existing dedicated pages where they exist, integrate class-specific choices into class card.

#### A. Subclass Selection (Class Card)
**Location**: [src/ui/pages/build.html](src/ui/pages/build.html) class card section
**Dependencies**: [src/services/ClassService.js](src/services/ClassService.js), [src/services/CharacterValidationService.js](src/services/CharacterValidationService.js)

**Implementation**:
- Call `ClassService.getSubclassLevel(className)` to detect when subclass choice is available
- Render dropdown next to class dropdown when `character.progression.classes[className].level >= subclassLevel && !character.progression.classes[className].subclass`
- Load subclass options via `ClassService.getSubclasses(className)`
- On selection:
  1. Update `character.progression.classes[className].subclass = selectedSubclass`
  2. Call `ClassService.getSubclassFeatures(className, subclass, level)` to populate features
  3. Emit `EventBus.EVENTS.CHARACTER_UPDATED`
- Display Bootstrap badge on class card header: "Choose Subclass" when `subclass === null`
- Render subclass feature preview in card body using [src/lib/5eToolsRenderer.js](src/lib/5eToolsRenderer.js)

#### B. Class Features with Choices (Class Card)
**Location**: [src/ui/pages/build.html](src/ui/pages/build.html) class card section (new expandable accordion)
**Dependencies**: [src/services/CharacterValidationService.js](src/services/CharacterValidationService.js), [src/services/ClassService.js](src/services/ClassService.js)
**Code Reuse**: Adapt logic from [src/ui/components/level/steps/Step1_Features.js](src/ui/components/level/steps/Step1_Features.js)

**Feature Types**:
- Fighting Style (Fighter/Paladin/Ranger) - single select
- Metamagic Options (Sorcerer) - multi-select with count limit
- Warlock Invocations - multi-select with prerequisite checks
- Pact Boon - single select
- Totem Spirit, etc. - single select

**Implementation**:
- Call `CharacterValidationService.getMissingChoicesForClass(character, className)` to detect pending features
- Render Bootstrap accordion with one section per feature type
- Badge count on class card header: `pendingFeatures.length` (e.g., "2 pending choices")
- On selection:
  1. Update `character.progression.classes[className].features[featureName] = selectedOption(s)`
  2. Validate prerequisites for Invocations using `ClassService.validateInvocationPrerequisites()`
  3. Emit `EventBus.EVENTS.CHARACTER_UPDATED`
- Render descriptions using [src/lib/5eToolsRenderer.js](src/lib/5eToolsRenderer.js)
- **CRITICAL**: Reuse existing feature rendering logic from Step1_Features.js instead of reimplementing

#### C. Ability Score Improvements / Feats
**Location**: Split implementation between class card ([src/ui/pages/build.html](src/ui/pages/build.html)) and existing feat section
**Dependencies**: [src/services/LevelUpService.js](src/services/LevelUpService.js), [src/services/FeatService.js](src/services/FeatService.js)
**Cross-reference**: See [LEVEL_UP_UI_DECISIONS.md](LEVEL_UP_UI_DECISIONS.md) for rationale

**ASI Choice (Class Card)**:
- Trigger: Display when `LevelUpService.getASILevels(className).includes(character.progression.classes[className].level)`
- ASI levels: Fighter (4,6,8,12,14,16,19), Others (4,8,12,16,19)
- Badge on class card header: "Choose ASI or Feat"
- UI: Radio buttons with two options
  - Option 1: "Standard ASI (+2 to one ability, or +1 to two abilities)"
    - Render inline ability score dropdowns (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma)
    - On selection: Update `character.abilityScoreImprovements.push({level, class, type: 'asi', abilities: [{ability, bonus}]})`
  - Option 2: "Take a Feat instead"
    - Show button: "Browse Feats ↓" that scrolls to feat section ([src/ui/pages/build.html](src/ui/pages/build.html) line ~397)
    - Set flag: `character.pendingFeatFromASI = {level, class}`
- Emit `EventBus.EVENTS.CHARACTER_UPDATED` after selection

**Feat Selection (Existing)**:
- Location: [src/ui/pages/build.html](src/ui/pages/build.html#L397-423) (already implemented)
- Enhancement: Add badge when `character.pendingFeatFromASI` exists: "1 available feat from ASI"
- On feat selection from ASI:
  1. Add to `character.feats.push({name, source: 'ASI', level, class})`
  2. Clear `character.pendingFeatFromASI`
  3. Emit `EventBus.EVENTS.CHARACTER_UPDATED`
- Display counter: "ASI Feats: 2 | Bonus Feats: 1"
- **CRITICAL**: Do not duplicate feat UI; reuse existing feat card component

#### D. Spell Selection (Dedicated Spells Page)
**Location**: [src/ui/pages/spells.html](src/ui/pages/spells.html) (existing implementation)
**Dependencies**: [src/services/SpellService.js](src/services/SpellService.js), [src/services/SpellSelectionService.js](src/services/SpellSelectionService.js), [src/app/NavigationController.js](src/app/NavigationController.js)
**Cross-reference**: See [LEVEL_UP_UI_DECISIONS.md](LEVEL_UP_UI_DECISIONS.md) for UI decision rationale
**Architecture Reference**: See [CODEBASE_ARCHITECTURE.md](CODEBASE_ARCHITECTURE.md) feature crosswalk for spell interaction patterns

**Build Page Indicator (Class Card)**:
- Trigger: Call `SpellSelectionService.getPendingSpellChoices(character)` to detect unallocated spells
- Display Bootstrap alert box with:
  - Text: "You gained access to new spells. Visit the Spells page to choose them."
  - Button: "Go to Spells →" calls `NavigationController.navigate('spells')`
  - Summary: "Available: X [ClassName] spells (levels Y-Z)"
- Badge on class card header: "Choose X spells"
- **CRITICAL**: Do not implement inline spell picker; spells page handles all spell UI

**Spells Page Enhancement**:
- Add prominent alert at top when `pendingSpellChoices.length > 0`
- Badge in navigation: Call `NavigationController.setBadge('spells', pendingCount)` to show "Spells (2 pending)"
- On spell selection:
  1. Update `character.spellcasting.classes[className].spells.known.push(spellName)` OR `prepared` array
  2. Emit `EventBus.EVENTS.CHARACTER_UPDATED`
- Use existing spell filtering, card rendering, and prepared/known logic
- **Rationale**: Spell selection complexity (filtering by class/level/school, prepared vs known, ritual casting, cantrip distinction) requires dedicated page; inline picker would bloat build page and duplicate existing UI

**Event Flow** (Technical Sequence):
1. User clicks "Add Level" → Modal calls `LevelUpService.addClassLevel()` → Emits `EventBus.EVENTS.CHARACTER_UPDATED` → Modal closes
2. Build page class card listens to `CHARACTER_UPDATED` event:
   ```javascript
   eventBus.on(EVENTS.CHARACTER_UPDATED, () => {
       const validation = CharacterValidationService.validateCharacter(character);
       this.renderPendingChoices(validation.missingChoices);
   });
   ```
3. For each missing choice in `validation.missingChoices`, render UI:
   - Subclass: `if (!class.subclass && class.level >= subclassLevel)` → render dropdown
   - Class features: `if (validation.missingChoices.features.length)` → render accordion sections
   - ASI: `if (ASILevels.includes(class.level) && !hasASIForLevel)` → render radio buttons
   - Spells: `if (pendingSpellChoices.length)` → render alert with "Go to Spells →" button
4. User makes choice (each triggers immediate character update):
   - Subclass: `character.progression.classes[].subclass = value` → Emit `CHARACTER_UPDATED`
   - Class features: `character.progression.classes[].features[] = value` → Emit `CHARACTER_UPDATED`
   - ASI (standard): `character.abilityScoreImprovements.push()` → Emit `CHARACTER_UPDATED`
   - ASI (feat): `element.scrollIntoView()` to feat section (same page)
   - Spells: `NavigationController.navigate('spells')` → Use existing spells page
5. `CHARACTER_UPDATED` triggers re-validation → `CharacterValidationService.validateCharacter()` → Badges/sections update
6. `NavigationController` updates navigation badges:
   - `setBadge('build', validation.missingChoices.total)` → "Build (3)"
   - `setBadge('spells', pendingSpellChoices.length)` → "Spells (2)"
7. Auto-save triggers on `CHARACTER_UPDATED` (existing behavior from [src/app/AppInitializer.js](src/app/AppInitializer.js))

---

### Phase 3: Service Layer Updates

#### LevelUpService Simplification
**File**: [src/services/LevelUpService.js](src/services/LevelUpService.js)

**Remove**:
- Wizard-specific step logic
- LevelUpSession dependencies
- Transactional state management

**Keep/Enhance**:
- `addClassLevel(character, className, level)`
- `removeClassLevel(character, className)`
- `canMulticlass(character, newClassName)` - prerequisite checks
- `getPendingChoicesForLevel(character, className, level)` - NEW
  - Returns array of required choices (ASI, features, spells, etc.)
  - Used by build page to show pending items

#### CharacterValidationService Enhancement
**File**: [src/services/CharacterValidationService.js](src/services/CharacterValidationService.js)

**Current**: Returns validation report with missing items by category

**Enhance**:
- `getPendingChoicesSummary(character)` - NEW
  - Returns user-friendly summary: "3 ASI choices, 2 spell selections, 1 fighting style"
- `getMissingChoicesForClass(character, className)` - NEW
  - Scoped validation for single class (used by build page sections)

---

### Phase 4: Migration & Cleanup

#### Files to Archive/Remove
- [src/app/LevelUpSession.js](src/app/LevelUpSession.js) (554 lines) → remove entirely
- [src/ui/components/level/steps/](src/ui/components/level/steps/) → remove wizard step components
  - Step0_Level.js
  - Step1_Features.js
  - Step2_ASI.js
  - Step3_Spells.js
  - Step4_Summary.js

#### Files to Update/Create
- [src/ui/components/level/Modal.js](src/ui/components/level/Modal.js) - simplify to picker (~75% reduction)
- [src/ui/pages/build.html](src/ui/pages/build.html) - enhance class card with choice sections
- [src/ui/components/class/ClassCard.js](src/ui/components/class/ClassCard.js) (NEW or enhance existing) - orchestrate class card logic, adapt wizard step logic
- [src/services/LevelUpService.js](src/services/LevelUpService.js) - remove session logic, add pending choice detection
- [src/app/TitlebarController.js](src/app/TitlebarController.js) - update level-up button handler
- [src/app/NavigationController.js](src/app/NavigationController.js) - add badge support for pending choices
- [src/ui/pages/spells.html](src/ui/pages/spells.html) - enhance to highlight pending spell choices
- Existing feat card logic - no changes needed, just wire ASI → feat flow

#### Event Changes
**Remove**:
- `LEVEL_UP_COMPLETE` (modal-specific)
- Wizard step events

**Keep**:
- `CHARACTER_UPDATED` (main coordination event)
- `MULTICLASS_ADDED`/`MULTICLASS_REMOVED`

---

### Phase 5: Testing Strategy

#### Unit Tests
- `LevelUpService.addClassLevel()` - prerequisite validation
- `LevelUpService.removeClassLevel()` - state cleanup
- `CharacterValidationService.getPendingChoicesSummary()` - accurate counts

#### Integration Tests (Playwright)
**New test**: `level-up-build-page-flow.spec.js`
- Create level 1 Fighter
- Click "Add Level" in modal
- Verify modal closes immediately
- Verify build page shows "Choose Fighting Style" badge
- Expand fighting style section
- Select "Archery"
- Verify badge disappears
- Level to 3 → verify "Choose Subclass" appears
- Select "Champion"
- Verify subclass applied

**Update existing tests**:
- `level-up-modal-reopen.spec.js` - simplify (no session state)
- `level-up-spell-selection-persistence.spec.js` - move logic to build page test
- `level-up-asi-feat-implementation.spec.js` - move logic to build page test

---

## Data Flow Comparison

### Current (Modal Wizard)
```
User clicks "Level Up" 
→ Modal shows with LevelUpSession 
→ User goes through 5 steps:
   Step 0: Level & Multiclass
   Step 1: Class Features (fighting style, etc.)
   Step 2: ASI/Feats
   Step 3: Spell Selection
   Step 4: Summary
→ All choices staged in session 
→ User confirms 
→ Session applies changes to character 
→ CHARACTER_UPDATED emitted 
→ Modal closes
```

### Proposed (Build Page + Dedicated Pages)
```
User clicks "Add Level" in modal
→ Modal validates prerequisites
→ LevelUpService.addClassLevel()
→ CHARACTER_UPDATED emitted
→ Modal closes immediately

Build page reacts:
→ CharacterValidationService detects pending choices
→ Class card shows badges + expandable sections:
   - Subclass dropdown (if level requirement met)
   - ASI choice: standard or feat
   - Class features: fighting style, metamagic, etc.
   - Spell notification: "Go to Spells" button

User makes choices:
→ Subclass: select from dropdown → CHARACTER_UPDATED
→ ASI (standard): choose +2/+1 → CHARACTER_UPDATED
→ ASI (feat): click "Choose Feat" → scrolls to feat section → select feat → CHARACTER_UPDATED
→ Class features: expand section → select option → CHARACTER_UPDATED
→ Spells: click "Go to Spells" → NavigationController.navigate('spells') → use existing spell page

Each choice:
→ Updates character directly (no session)
→ Emits CHARACTER_UPDATED
→ Validation re-runs
→ Badges/sections update
→ Auto-save triggers
```

---

## Benefits

### User Experience
- **Context-appropriate UI**: Choices appear where they make sense
  - Class-specific choices in class card
  - Complex spell management on dedicated page
  - Feat browsing in existing feat section
- **Natural navigation flow**: Clear links/buttons guide users to the right page
- **No duplication**: Single source of truth for spells and feats
- **Progressive disclosure**: Badges show what needs attention, sections expand when relevant
- **Persistent context**: Can review/change choices anytime without wizard interruption
- **Flexible workflow**: Complete choices in any order, across multiple sessions

### Developer Experience
- **75% code reduction** in modal (454 → ~100 lines)
- **Reuse existing pages**: No need to rebuild spell/feat UI
- **Adapt existing logic**: Much of current Step1_Features.js can move to class card component
- **Simpler testing**: Stable selectors, no modal timing, existing pages already work
- **Clear separation**: Level picker, class card, spells page, feats section each own their domain
- **EventBus-driven**: `CHARACTER_UPDATED` coordinates everything

### Maintainability
- **No session state**: Direct character updates, no transaction layer
- **Existing validation service**: CharacterValidationService already detects pending choices
- **Single responsibility**: Each component does one thing well
- **Clear data flow**: service → validation → UI → service
- **Fewer abstractions**: Direct navigation instead of wizard steps

---

## Implementation Checklist

### Step 1: Prep (Non-Breaking)
- [ ] Add `LevelUpService.getPendingChoicesForLevel()`
- [ ] Add `CharacterValidationService.getPendingChoicesSummary()`
- [ ] Create build page section HTML stubs
- [ ] Write unit tests for new service methods

### Step 2: Build Page Sections
- [ ] **Class Card Enhancements**:
  - [ ] Add subclass dropdown (appears at appropriate level)
  - [ ] Add ASI choice section (radio: standard ASI vs feat)
  - [ ] Add inline ability score adjustment UI (for standard ASI)
  - [ ] Add class feature choice sections (fighting style, metamagic, invocations, etc.)
  - [ ] Add spell notification with "Go to Spells" button
  - [ ] Add badges for pending choices on card header
  - [ ] Wire sections to `CHARACTER_UPDATED` event
  - [ ] **Adapt existing wizard logic**: Port Step1_Features.js logic to class card component
- [ ] **Spells Page Enhancements**:
  - [ ] Add prominent "Pending Choices" section at top
  - [ ] Show available spell picks per class
  - [ ] Add badge to navigation: "Spells (2 pending)"
- [ ] **Feat Section**:
  - [ ] No changes needed to existing feat card
  - [ ] Verify ASI → feat navigation flow works
  - [ ] Update counter to show ASI-granted vs bonus feats
- [ ] **Navigation**:
  - [ ] Add badge support to NavigationController
  - [ ] Show pending counts: "Build (3)", "Spells (2)"

### Step 3: Simplify Modal (Breaking)
- [ ] Replace wizard UI with simple picker
- [ ] Remove LevelUpSession usage
- [ ] Call LevelUpService directly
- [ ] Remove wizard step components
- [ ] Update modal tests

### Step 4: Cleanup
- [ ] Delete LevelUpSession.js
- [ ] Delete wizard step files
- [ ] Remove session-related service methods
- [ ] Update documentation
- [ ] Update copilot-instructions.md

### Step 5: Testing
- [ ] **Class Card Integration Tests**:
  - [ ] Subclass selection on build page
  - [ ] ASI standard choice on build page
  - [ ] ASI → feat navigation flow
  - [ ] Class feature choices (fighting style, metamagic, etc.)
- [ ] **Cross-Page Navigation Tests**:
  - [ ] Level up → spell notification → spells page → spell selection
  - [ ] ASI feat choice → feat section → feat selection
  - [ ] Navigation badges update correctly
- [ ] Write new integration test: `level-up-build-page-flow.spec.js`
  - [ ] Create level 1 Fighter
  - [ ] Click "Add Level" in modal
  - [ ] Verify modal closes immediately
  - [ ] Verify build page shows "Choose Fighting Style" badge
  - [ ] Expand fighting style section
  - [ ] Select "Archery"
  - [ ] Verify badge disappears
  - [ ] Level to 3 → verify "Choose Subclass" appears
  - [ ] Select "Champion"
  - [ ] Verify subclass applied
- [ ] Update existing modal tests (remove wizard complexity)
- [ ] Update/remove wizard step tests
- [ ] Manual QA: level 1-20 progression
- [ ] Manual QA: multiclass scenarios
- [ ] Manual QA: spell selection flow (Fighter → Wizard multiclass)
- [ ] Verify no memory leaks (DevTools profiling)

---

## Risks & Mitigations

**Risk**: Users expect wizard flow
- *Mitigation*: Guided badges/tooltips on build page, progressive disclosure, clear "Go to Spells/Feats" navigation

**Risk**: Complex spell/feat UI doesn't fit in build page
- *Mitigation*: Use dedicated pages (already implemented), provide clear navigation with badges

**Risk**: Users lose context switching between pages
- *Mitigation*: Navigation badges show pending counts, notifications link back to build page

**Risk**: Complex multiclass scenarios break
- *Mitigation*: Extensive testing, reuse existing service validation

**Risk**: Large refactor introduces bugs
- *Mitigation*: Phased rollout, feature flag for old modal if needed, adapt existing tested logic

**Risk**: Lost work if user doesn't complete choices
- *Mitigation*: Auto-save already exists, CharacterValidationService tracks pending items, choices can be completed anytime

---

## Timeline Estimate
- **Phase 1** (Modal simplification): 2-3 hours
- **Phase 2** (Build page + class card): 6-8 hours
  - Class card component: 3-4 hours (adapting existing wizard logic)
  - Spells page enhancements: 1-2 hours
  - Navigation badges: 1-2 hours
- **Phase 3** (Service updates): 3-4 hours
- **Phase 4** (Migration/cleanup): 2-3 hours
- **Phase 5** (Testing): 4-6 hours
- **Total**: 17-24 hours

**Note**: Reusing existing pages (spells, feats) and adapting wizard step logic reduces implementation time significantly.

---

## Implementation Order (Critical Path)

**Phase 1** (Non-breaking prep):
1. Add service methods: `LevelUpService.getPendingChoicesForLevel()`, `CharacterValidationService.getPendingChoicesSummary()`, `CharacterValidationService.getMissingChoicesForClass()`
2. Write unit tests for new methods
3. Create HTML stubs in [src/ui/pages/build.html](src/ui/pages/build.html) for class card sections (hidden by default)

**Phase 2** (Build page implementation):
1. Class card subclass dropdown (detects level requirement, renders options)
2. Class card ASI section (radio buttons, inline ability dropdowns, feat navigation)
3. Class card class features accordion (adapt Step1_Features.js logic)
4. Class card spell notification (alert with \"Go to Spells\" button)
5. Spells page pending choices alert
6. Navigation badge support (`NavigationController.setBadge()`)
7. EventBus listener for `CHARACTER_UPDATED` in class card

**Phase 3** (Breaking changes):
1. Simplify modal to single-step picker (remove wizard)
2. Remove all `LevelUpSession` usage from modal
3. Delete [src/app/LevelUpSession.js](src/app/LevelUpSession.js)
4. Delete [src/ui/components/level/steps/](src/ui/components/level/steps/) directory

**Phase 4** (Testing & validation):
1. Update modal tests (remove wizard complexity)
2. Write new integration tests: `level-up-build-page-flow.spec.js`
3. Update existing tests to use build page flow
4. Manual QA: level 1-20 progression, multiclass scenarios

## Key Data Structures

**Character Progression**:
```javascript
character.progression.classes[className] = {
    level: 1,
    subclass: null, // or subclass name
    features: {
        "Fighting Style": "Archery",
        "Metamagic": ["Quickened Spell", "Twinned Spell"]
    }
}
```

**Ability Score Improvements**:
```javascript
character.abilityScoreImprovements = [
    {level: 4, class: "Fighter", type: "asi", abilities: [{ability: "Strength", bonus: 2}]},
    {level: 8, class: "Fighter", type: "asi", abilities: [{ability: "Strength", bonus: 1}, {ability: "Constitution", bonus: 1}]}
]
```

**Feats**:
```javascript
character.feats = [
    {name: "Great Weapon Master", source: "ASI", level: 4, class: "Fighter"},
    {name: "Lucky", source: "Bonus", level: 1, class: "Fighter"}
]
```

**Pending Feat Flag**:
```javascript
character.pendingFeatFromASI = {level: 4, class: "Fighter"}
// Cleared after feat selection
```

## Critical Integration Points

**EventBus Events** (from [src/lib/EventBus.js](src/lib/EventBus.js)):
- `EVENTS.CHARACTER_UPDATED` - Primary coordination event after any character change
- `EVENTS.MULTICLASS_ADDED` - Emitted when new class added
- `EVENTS.MULTICLASS_REMOVED` - Emitted when class removed
- `EVENTS.PAGE_CHANGED` - Emitted by NavigationController on route change
- `EVENTS.PAGE_LOADED` - Emitted after page content rendered

**Service Dependencies**:
- [src/services/LevelUpService.js](src/services/LevelUpService.js) - Level manipulation, ASI level detection, multiclass validation
- [src/services/CharacterValidationService.js](src/services/CharacterValidationService.js) - Pending choice detection, validation reports
- [src/services/ClassService.js](src/services/ClassService.js) - Class data, subclass info, feature lookups
- [src/services/SpellSelectionService.js](src/services/SpellSelectionService.js) - Spell choice tracking, class spellcasting setup
- [src/services/FeatService.js](src/services/FeatService.js) - Feat data, prerequisite validation

**Cleanup Requirements** (from [.github/copilot-instructions.md](.github/copilot-instructions.md)):
- Modal: Use `DOMCleanup.create()` for all DOM listeners; dispose Bootstrap modal instance before re-init
- EventBus: Manually track and remove listeners with `eventBus.off()`
- No unmanaged listeners allowed (causes memory leaks)

## References
- Current modal: [src/ui/components/level/Modal.js](src/ui/components/level/Modal.js)
- Current session: [src/app/LevelUpSession.js](src/app/LevelUpSession.js)
- Service layer: [src/services/LevelUpService.js](src/services/LevelUpService.js)
- Validation: [src/services/CharacterValidationService.js](src/services/CharacterValidationService.js)
- Build page: [src/ui/pages/build.html](src/ui/pages/build.html)
- Architecture: [docs/CODEBASE_ARCHITECTURE.md](docs/CODEBASE_ARCHITECTURE.md)
- UI Decisions: [docs/LEVEL_UP_UI_DECISIONS.md](docs/LEVEL_UP_UI_DECISIONS.md)
- Tests: [tests/level-up-*.spec.js](tests/)
- 5etools helpers: [src/lib/5eToolsParser.js](src/lib/5eToolsParser.js), [src/lib/5eToolsRenderer.js](src/lib/5eToolsRenderer.js)
