# Level-Up UI Architecture Decisions

## Technical Decision Matrix

This document records architectural decisions for the level-up refactor. Use this as a reference when implementing UI components.

**Implementation Rule**: When modifying level-up UI, consult this document first to ensure component placement aligns with architectural decisions.

---

## Component Location Matrix

| Choice Type | Location | File Path | Rationale |
|-------------|----------|-----------|-----------||
| **Level/Class Selection** | Simplified Modal | [src/ui/components/level/Modal.js](src/ui/components/level/Modal.js) | Core level-up action, modal signals important action with validation point |
| **Subclass** | Class Card (Build Page) | [src/ui/pages/build.html](src/ui/pages/build.html) | Class-specific, contextual alongside class info, single dropdown (not complex) |
| **ASI (Standard)** | Class Card (Build Page) | [src/ui/pages/build.html](src/ui/pages/build.html) | Quick selection, inline ability dropdowns, minimal UI (2 dropdowns max) |
| **ASI (Feat)** | Navigate to Feat Section | [src/ui/pages/build.html#L397](src/ui/pages/build.html#L397) | Complex feat browsing with prerequisites, descriptions, search/filter; existing implementation |
| **Class Features** | Class Card (Build Page) | [src/ui/pages/build.html](src/ui/pages/build.html) | Class-specific (fighting style, metamagic, invocations); reuse logic from [Step1_Features.js](src/ui/components/level/steps/Step1_Features.js) |
| **Spell Selection** | Dedicated Spells Page | [src/ui/pages/spells.html](src/ui/pages/spells.html) | Complex filtering (class/level/school), prepared vs known, ritual casting, cantrips; dedicated page prevents UI bloat |
| **Feats (General)** | Existing Feat Section (Build Page) | [src/ui/pages/build.html#L397-423](src/ui/pages/build.html#L397-423) | Already implemented, reuse existing UI, single source of truth |

---

## Detailed Rationale

### Modal (Level/Class Selection)
**Technical Constraints**:
- Must call `LevelUpService.canMulticlass()` before allowing multiclass
- Must dispose Bootstrap modal instance on close (memory leak prevention)
- Must emit `EventBus.EVENTS.CHARACTER_UPDATED` after level add
- Must not use `LevelUpSession` (removed in refactor)
**Validation Point**: Prerequisite checks (ability scores, multiclass rules) before character mutation

### Subclass (Class Card)
**Implementation Requirements**:
- Appears when `character.progression.classes[className].level >= ClassService.getSubclassLevel(className)`
- Single dropdown: load options via `ClassService.getSubclasses(className)`
- Update `character.progression.classes[className].subclass` on selection
- Render preview using [src/lib/5eToolsRenderer.js](src/lib/5eToolsRenderer.js)
**Complexity Justification**: Single dropdown, does not require dedicated page

### ASI Split (Class Card + Feat Section)
**Standard ASI (Inline)**:
- Two dropdowns maximum: +2 to one ability OR +1 to two abilities
- Update `character.abilityScoreImprovements.push({level, class, type: 'asi', abilities})`
- Minimal UI complexity justifies inline placement

**Feat Selection (Dedicated Section)**:
- 50+ feats with descriptions, prerequisites, racial requirements
- Requires search/filter UI
- Already implemented at [src/ui/pages/build.html#L397-423](src/ui/pages/build.html#L397-423)
- **CRITICAL**: Do not duplicate feat UI; scroll to existing section via `element.scrollIntoView()`

**Navigation**: "Browse Feats ↓" button sets `character.pendingFeatFromASI` flag and scrolls to feat section

### Spells (Dedicated Page)
**Complexity Factors**:
- Filtering: by class, level (0-9), school (8 types), source
- Casting types: prepared vs known, ritual, cantrips vs leveled
- Multi-class spellcasting: separate spell lists per class
- Spell slot calculation: full caster, half caster, third caster, pact magic
- Description rendering: complex entries with higher-level effects

**Technical Justification**:
- Existing implementation at [src/ui/pages/spells.html](src/ui/pages/spells.html) already handles complexity
- Inline picker would require duplicating ~500 lines of spell filtering/rendering logic
- Build page UI would become unwieldy (too many controls)

**Navigation Pattern**: Badge + "Go to Spells →" button (calls `NavigationController.navigate('spells')`)
**Architecture Reference**: See [CODEBASE_ARCHITECTURE.md](CODEBASE_ARCHITECTURE.md) spell interaction feature crosswalk

### Class Features (Class Card)
**Feature Types with UI Requirements**:
- Fighting Style: single select dropdown (5-8 options)
- Metamagic: multi-select with limit (choose 2 from 8)
- Invocations: multi-select with prerequisites (level, pact, spells known)
- Pact Boon: single select dropdown (3 options)

**Code Reuse Pattern**:
- Adapt feature rendering from [src/ui/components/level/steps/Step1_Features.js](src/ui/components/level/steps/Step1_Features.js)
- Call `CharacterValidationService.getMissingChoicesForClass()` to detect pending
- Render Bootstrap accordion (one section per feature type)
- Use [src/lib/5eToolsRenderer.js](src/lib/5eToolsRenderer.js) for descriptions

**Placement Rationale**: Class-specific, moderate complexity (more than dropdown, less than full page)

---

## Technical Navigation Sequence

```
Modal: Level Up
  ↓ User clicks "Add Level to [Class]"
  ↓ LevelUpService.addClassLevel(character, className, level)
  ↓ Emit CHARACTER_UPDATED
  ↓ Modal.hide()
  ↓
Build Page - Class Card (EventBus listener)
  ↓ CharacterValidationService.validateCharacter()
  ↓ Render pending choices:
  ├─ Subclass dropdown → select → update character.progression.classes[].subclass → emit CHARACTER_UPDATED
  ├─ ASI choice → standard → ability dropdowns → update character.abilityScoreImprovements → emit CHARACTER_UPDATED
  ├─ ASI choice → feat → set character.pendingFeatFromASI → element.scrollIntoView(feat section)
  ├─ Class features → expand accordion → select → update character.progression.classes[].features → emit CHARACTER_UPDATED
  └─ Spells → click "Go to Spells →" → NavigationController.navigate('spells')

Spells Page (if navigated from build page)
  ↓ Display pending spell choices alert
  ↓ User selects spells via existing spell picker
  ↓ Update character.spellcasting.classes[className].spells.known (or prepared)
  ↓ Emit CHARACTER_UPDATED
  ↓ "Back to Build" link → NavigationController.navigate('build')

Feat Section (if scrolled from ASI choice)
  ↓ Display "1 available feat from ASI" badge
  ↓ User clicks "Add Feat" → existing feat modal
  ↓ Update character.feats.push({name, source: 'ASI', level, class})
  ↓ Clear character.pendingFeatFromASI
  ↓ Emit CHARACTER_UPDATED
```

---

## Code Reuse Matrix

| Component | Current Location | Reuse Pattern | Technical Notes |
|-----------|------------------|---------------|------------------|
| Spell Page UI | [src/ui/pages/spells.html](src/ui/pages/spells.html) | Navigation via `NavigationController.navigate('spells')` | Do not duplicate spell picker logic; use existing page |
| Feat Card | [src/ui/pages/build.html#L397](src/ui/pages/build.html#L397) | Scroll via `element.scrollIntoView()` + `character.pendingFeatFromASI` flag | Single source of truth for feats (ASI + bonus) |
| Class Feature Logic | [src/ui/components/level/steps/Step1_Features.js](src/ui/components/level/steps/Step1_Features.js) | Adapt rendering logic to class card accordion sections | Port option rendering, prerequisite checks, multi-select logic |
| Validation Service | [src/services/CharacterValidationService.js](src/services/CharacterValidationService.js) | Call `validateCharacter()` and `getMissingChoicesForClass()` | Use for pending choice detection in EventBus listener |

---

## Anti-Patterns (Do Not Implement)

### ❌ Do Not: Duplicate Spell Picker Inline
**Problem**: Spell selection requires ~500 lines of filtering/rendering logic  
**Correct Pattern**: Navigate to existing spells page via `NavigationController.navigate('spells')`

### ❌ Do Not: Create New Feat Modal
**Problem**: Feat UI already exists at [src/ui/pages/build.html#L397-423](src/ui/pages/build.html#L397-423)  
**Correct Pattern**: Scroll to existing feat section via `element.scrollIntoView()`

### ❌ Do Not: Implement All Choices in Modal
**Problem**: Creates wizard fatigue, memory leaks, hidden state, test timing issues  
**Correct Pattern**: Modal for level/class only; build page for all choices

### ❌ Do Not: Bypass Validation Service
**Problem**: Pending choices won't be detected correctly  
**Correct Pattern**: Always call `CharacterValidationService.validateCharacter()` after `CHARACTER_UPDATED`

---

## Implementation Checklist

When implementing level-up UI changes, verify:
- [ ] Subclass dropdown appears only when `level >= subclassLevel && !subclass`
- [ ] ASI section appears only at ASI levels (Fighter: 4,6,8,12,14,16,19; Others: 4,8,12,16,19)
- [ ] Class features use `CharacterValidationService.getMissingChoicesForClass()`
- [ ] Spell notification links to existing spells page (no inline picker)
- [ ] Feat selection scrolls to existing feat section (no new feat UI)
- [ ] All choices emit `EventBus.EVENTS.CHARACTER_UPDATED` after update
- [ ] EventBus listeners are removed on cleanup (`eventBus.off()`)
- [ ] Modal uses `DOMCleanup.create()` for DOM listeners
- [ ] Bootstrap modal instance is disposed before re-init
- [ ] Navigation badges update via `NavigationController.setBadge()`

---

## References
- Main refactor plan: [LEVEL_UP_REFACTOR_PLAN.md](LEVEL_UP_REFACTOR_PLAN.md)
- Architecture: [CODEBASE_ARCHITECTURE.md](CODEBASE_ARCHITECTURE.md)
- Copilot instructions: [../.github/copilot-instructions.md](../.github/copilot-instructions.md)
- Existing spells page: [src/ui/pages/spells.html](src/ui/pages/spells.html)
- Existing feat section: [src/ui/pages/build.html#L397-423](src/ui/pages/build.html#L397-423)
- Class card location: [src/ui/pages/build.html](src/ui/pages/build.html)
- Modal to simplify: [src/ui/components/level/Modal.js](src/ui/components/level/Modal.js)
- Step logic to reuse: [src/ui/components/level/steps/Step1_Features.js](src/ui/components/level/steps/Step1_Features.js)
