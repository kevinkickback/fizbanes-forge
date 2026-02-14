# Codebase Workflow Audit

**Date:** 2025-02-13  
**Scope:** Full codebase — `src/app/`, `src/services/`, `src/lib/`, `src/main/`, `src/ui/`  
**Method:** End-to-end workflow tracing, cross-domain dependency analysis, pattern consistency review

---

## Executive Summary

The codebase has a well-defined architectural vision: Electron main ↔ preload ↔ renderer with clear IPC boundaries, an EventBus-driven component system, layered services, and a BaseDataService pattern for data loading. The foundational plumbing — `DOMCleanup`, `EventBus`, `BaseDataService`, `BaseSelectorModal`, `DataLoader`, error classes, validation schemas — is solid.

However, organic growth has introduced systemic issues that compound across workflows:

1. **Three competing event systems** — EventBus, DOM CustomEvents, and setTimeout-delayed events coexist on the build page, creating untraceable data flow.
2. **Character mutation bypasses its own abstractions** — `CharacterManager.updateCharacter()` exists but most callers mutate the Character directly, defeating AppState's change detection.
3. **Redundant serialization and validation cycles** — Save and create workflows perform 2–3x more serialization and validation passes than necessary.
4. **Load-all-to-find-one** — Loading a single character reads every character file from disk.
5. **Service layer inconsistencies** — Two services re-implement `BaseDataService` patterns manually; one lib file imports 12 services (inverting the dependency direction); private methods are called across service boundaries.
6. **Oversized UI components** — Several files exceed 1,500 lines and embed multiple classes, with duplicated logic across character creation steps and build page cards.

None of these are blocking defects — the application works. But they create compounding maintenance cost and make the system harder to reason about as it grows.

---

## System Workflow Map

### Architecture Layers

```
┌──────────────────────────────────────────────────────────────┐
│  MAIN PROCESS                                                │
│  Main.js → Window.js → Settings.js → Data.js                 │
│  IPC Handlers: Character, Data, File, Settings, PDF          │
│  PDF: PdfExporter.js, FieldMapping.js                        │
└───────────────┬──────────────────────────────────────────────┘
                │ IPC (via channels.js)
┌───────────────▼──────────────────────────────────────────────┐
│  PRELOAD BRIDGE (Preload.cjs)                                │
│  window.characterStorage, window.app, window.data            │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│  RENDERER                                                    │
│                                                              │
│  ┌─ App Layer ────────────────────────────────────────────┐  │
│  │ AppInitializer → AppState → CharacterManager           │  │
│  │ NavigationController → PageHandler → Page controllers  │  │
│  │ ThemeManager, TitlebarController, Modal                │  │
│  │ Character, CharacterSerializer, UIHandlersInitializer  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Service Layer ────────────────────────────────────────┐  │
│  │ 14 BaseDataService services (Race, Class, Spell, ...)  │  │
│  │ 6 stateless operation services (LevelUp, Equipment...) │  │
│  │ 2 manual-tracking services (AbilityScore, Proficiency) │  │
│  │ 1 main-process service (CharacterImport)               │  │
│  │ 1 IPC bridge service (Settings)                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Lib/Infrastructure ──────────────────────────────────┐   │
│  │ EventBus, DataLoader, DOMCleanup, Errors              │   │
│  │ ValidationSchemas, CharacterSchema, Notifications     │   │
│  │ 5eToolsParser, 5eToolsRenderer, TextProcessor         │   │
│  │ StatBlockRenderer*, TooltipManager*                   │   │
│  │ (* these import services — inverted dependency)       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ UI Components (43 files, ~20K lines) ────────────────┐  │
│  │ Build cards: Race, Class, Background, AbilityScore,   │  │
│  │             Proficiency                                │  │
│  │ Modals: BaseSelectorModal + 7 selector modals         │  │
│  │         6 standalone Bootstrap modals                  │  │
│  │ Managers: Equipment, Spells                           │  │
│  │ Wizard: CharacterCreation (7 steps)                   │  │
│  │ Other: Settings, Sources, Level-up, Preview           │  │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Critical Workflows

| Workflow | Hops | Key Concern |
|----------|:----:|-------------|
| Character Creation | 9 files, 5 transformations | Triple validation, double `CHARACTER_CREATED` emit, direct mutation after creation |
| Character Save | 7 files, 3 serializations | Double `touch()`, serialize→reconstruct→serialize round-trip, DOM scraping |
| Character Load | 10 files, 4 transformations | Loads ALL characters to find one |
| Race Selection | 8+ files, 8 events | Three event systems, `setTimeout`-based ordering |
| Level Up | 7 files | Duplicate event emissions, UI manages domain data |
| Data Loading | 5 files per service | Clean — two-layer caching works well |

---

## Section 1: High-Level Workflow Findings

### 1.1 Character Mutation: Bypassed Abstractions — ✅ RESOLVED

**Resolved.** `updateCharacter()` simplified to apply updates in-place on the live Character instance. Architecture doc updated to formalize Character as a mutable domain object. Callers mutate then notify via `AppState.setCurrentCharacter()` + `CHARACTER_UPDATED` event.

### 1.2 Redundant Serialization and Validation — ✅ RESOLVED

**Resolved by 1.1 fix.** The `updateCharacter()` simplification eliminated the redundant `serializeCharacter()`, `new Character()` reconstruction, and duplicate `CharacterSchema.touch()` calls. The save workflow now does:

| Step | Operation | Necessary? |
|------|-----------|:----------:|
| 1 | `CharacterSchema.touch()` in `saveCharacter()` | Yes |
| 2 | `CharacterSchema.validate()` in `saveCharacter()` | Yes |
| 3 | `serializeCharacter()` in `saveCharacter()` | Yes |
| 4 | `CharacterSchema.validate()` in CharacterHandlers (main) | Yes (defense-in-depth) |
| 5 | `JSON.stringify()` in CharacterHandlers | Yes |

The `createCharacter()` validation (after `CharacterSchema.create()`) was retained — it's cheap and catches invalid user input (e.g., empty name).

### 1.3 Load-All-to-Find-One ✅ RESOLVED

Added a `CHARACTER_LOAD` IPC channel (`character:load`) that reads a single `.ffp` file by ID. `CharacterManager.loadCharacter(id)` now calls `window.characterStorage.loadCharacter(id)` instead of loading all characters and filtering. Changes: `channels.js`, `CharacterHandlers.js`, `Preload.cjs`, `CharacterManager.js`.

### 1.4 Three Event Systems on the Build Page ✅ RESOLVED

**Phase 1:** Removed 4 orphaned DOM events (zero behavioral change):
- `proficienciesRemoved` — dispatched in RaceCard, ClassCard, BackgroundCard, never listened to. Removed all 3 dispatches.
- `classChanged` — dispatched in ClassCard, never listened to. Removed.
- `updateUI` — dispatched in RaceCard, never listened to. Removed.
- `subraceChanged` — listened in AbilityScoreCard, never dispatched. Removed listener.

**Phase 2:** Replaced all remaining DOM CustomEvents and `setTimeout` delays with a `BuildPageController` orchestrator pattern:
- Removed all DOM `dispatchEvent(new CustomEvent(...))` calls for `raceChanged`, `characterChanged`, `abilityScoresChanged`, `proficiencyChanged` from RaceCard, ClassCard, BackgroundCard, AbilityScoreCard.
- Removed all DOM event listeners (`this._cleanup.on(document, ...)`) for these events from AbilityScoreCard and ProficiencyCard.
- Removed all `setTimeout` wrappers (100ms/150ms timing hacks).
- Source cards (RaceCard, ClassCard, BackgroundCard) now call `this.onBuildChange?.(source)` where source is one of: `'race'`, `'race-proficiency'`, `'class'`, `'class-proficiency'`, `'background'`.
- Target cards (AbilityScoreCard, ProficiencyCard) expose public methods: `refreshForRaceChange()`, `refreshForCharacterChange()`, `refreshForProficiencyChange()`.
- `BuildPageController._coordinateUpdate(source)` wires it all together — sets `onBuildChange` callbacks on source cards and calls the correct sequence of target card methods per source type.
- Orphaned `abilityScoresChanged` DOM dispatches replaced with `eventBus.emit(EVENTS.ABILITY_SCORES_CHANGED)`.
- Build page now uses only **one** event system (EventBus) plus direct orchestration — zero DOM CustomEvents remain.

### 1.5 Duplicate Event Emissions ✅ RESOLVED

Removed 3 redundant UI-side event emissions. The service layer already emits these events; the UI was emitting them a second time:
- `CHARACTER_CREATED` — removed from `CharacterCreationModal._createCharacter()` (service emits via `CharacterManager.createCharacter()`)
- `MULTICLASS_ADDED` — removed from `LevelUpModal._addMulticlass()` (service emits via `LevelUpService.addClassLevel()`)
- `MULTICLASS_REMOVED` — removed from `LevelUpModal._removeLastLevel()` (service emits via `LevelUpService.removeClassLevel()`)

### 1.6 HomePageController Reacts to Events While Off-Screen ✅ VERIFIED — NOT AN ISSUE

Verified that all 3 EventBus listeners in `HomePageController` use `_trackListener()`, and `BasePageController.cleanup()` properly removes them via `eventBus.off()`. `PageHandler.handlePageLoaded()` calls `cleanup()` on the previous controller before creating a new one. DOM listeners are on page-local elements that get replaced on navigation. The `modal.setupEventListeners()` only stores callback refs (no EventBus registration). No fix needed.

---

## Section 2: Domain Structure & File Organization

### 2.1 Files That Should Be Split — ✅ Resolved

All recommended file splits have been completed:

| Original File | Extracted | New File(s) |
|---------------|-----------|-------------|
| `ClassCard.js` (4,056→3,522) | `ClassDetailsView`, `ClassCardView`, `SubclassPickerView` | `src/ui/components/class/ClassDetailsView.js`, `ClassCardView.js`, `SubclassPickerView.js` |
| `ProficiencyCard.js` (1,947→1,880) | `InstrumentChoicesView` | `src/ui/components/proficiencies/InstrumentChoicesView.js` |
| `RaceCard.js` (1,628→1,158) | `RaceDetailsView` + `DEFAULT_SPEED` | `src/ui/components/race/RaceDetailsView.js` |
| `BackgroundCard.js` (1,349→1,103) | `BackgroundDetailsView` | `src/ui/components/background/BackgroundDetailsView.js` |
| `AbilityScoreService.js` (985→643) | ~360 lines of pure helpers + constants | `src/lib/AbilityScoreUtils.js` (re-exported from service for backwards compat) |
| `FeatSelectorModal.js` (564→404) | `FeatListView`, `FeatSourcesView` | `src/ui/components/feats/FeatListView.js`, `FeatSourcesView.js` |
| `ProficiencyService.js` | N/A — already single-class, no split needed | — |

### 2.2 Duplicate or Overlapping Files

| File A | File B | Issue |
|--------|--------|-------|
| `RaceCard.js` (internal `RaceDetailsView`) | `RaceDetailsPanel.js` | Two classes with overlapping trait/size/speed/language formatting. Consolidate to one. |
| `CharacterStepAbilityScores.js` | `AbilityScoreCard.js` + `AbilityScoreService.js` | Creation step re-implements point buy, standard array, and custom score logic with its own constants (`POINT_COSTS`, `STANDARD_ARRAY`). Should import from service. |
| `CharacterStepBackground.js` | `BackgroundCard.BackgroundDetailsView` | Duplicated proficiency/equipment formatting logic. |
| `CharacterStepReview.js` | `ClassService` | Hardcoded `hitDice` map (`{ Barbarian: 12, Fighter: 10, ... }`) instead of using `ClassService.getHitDie()`. |

### 2.3 Layer Violations (Files in Wrong Directory)

| File | Current | Should Be | Reason |
|------|---------|-----------|--------|
| `StatBlockRenderer.js` | `src/lib/` | `src/ui/` or `src/ui/rendering/` | Imports `AbilityScoreService` — a lib file depending on a service inverts the architecture |
| `TooltipManager.js` | `src/lib/` | `src/ui/` or `src/ui/rendering/` | Imports 12 services, full DOM management |
| `NotificationCenter.js` | `src/lib/` | `src/ui/components/` | UI modal component managing DOM |

### 2.4 IPC Layer Issues

**37 channels defined, 28 have handlers, 24 are exposed in preload:**

| Status | Count | Details |
|--------|:-----:|---------|
| Fully functional | 24 | Character (6), Data (6), Settings (3), File (3), Portrait (2), PDF (3), Utility (1) |
| Handler exists, not exposed in preload | 4 | `FILE_READ_JSON`, `FILE_WRITE_JSON`, `FILE_EXISTS`, `UTIL_GET_APP_PATH` |
| Channel defined, no handler | 2 | `PORTRAITS_GET_DIRECTORY`, `PORTRAITS_SET_DIRECTORY` |
| Channel defined, handler files deleted | 20 | Equipment (8), Spell (7), Progression (5) |

The 20 placeholder channels (Equipment, Spell, Progression) reference handler files that no longer exist. `IPC_CONTRACTS.md` still documents them as "placeholder" handlers — but the actual handler files have been deleted. These channels and their documentation should be cleaned up.

**Preload drift:** `Preload.cjs` defines its own `IPC_CHANNELS` object (cannot import ESM `channels.js` in CommonJS). A referenced sync test file (`IpcChannels.test.js`) does not exist, so there is no automated guard against the two channel lists drifting.

**Duplicate exposure:** `window.characterStorage.selectFolder()` and `window.app.selectFolder()` both invoke the same `FILE_SELECT_FOLDER` channel.

---

## Section 3: Data Flow & Transformation Layers

### 3.1 DataLoader: Justified Two-Layer Cache

```
IPC/Disk → DataLoader.cache (by filename) → BaseDataService._data (processed per-service)
```

This works well. Layer 1 (`DataLoader.cache`) deduplicates raw JSON fetches. Layer 2 (`BaseDataService._data`) holds service-processed data (lookup maps, indexes). Both layers invalidate correctly on `DATA_INVALIDATED`.

**Minor waste:** DataLoader exports 12 convenience methods (`loadSkills()`, `loadRaces()`, etc.) that are thin wrappers over `loadJSON(filename)`. Some services use them; others call `loadJSON()` directly. The convenience methods add no logic and could be removed.

### 3.2 Character Serialization: Asymmetric Complexity

| Direction | Complexity | Where |
|-----------|-----------|-------|
| Serialize (Character → JSON) | 372 lines — property-by-property Map/Set/Array conversion | `CharacterSerializer.serialize()` |
| Deserialize (JSON → Character) | 1 line — `new Character(data)` | `CharacterSerializer.deserialize()` |

All deserialization logic lives in `Character`'s constructor (~260 lines). The `deserialize()` function is a trivial delegation that could be inlined. The asymmetry isn't harmful but is worth knowing — `CharacterSerializer.js` could be renamed to `characterSerialize.js` (single export) since the "deserialize" half has no logic.

### 3.3 Rehydration: Necessary but Overlapping

`RehydrationService.rehydrate()` restores runtime-computed data (racial traits, class features, spellcasting entries, background feature descriptions) from the game data services after loading a character from disk. This is conceptually correct — the character JSON stores references (race name + source), and rehydration resolves them to full data.

However, the `Character` constructor already initializes traits, resistances, and darkvision from the saved data. Then `rehydrate()` may re-add some of the same data. The boundary between "what's restored from JSON" and "what's rehydrated from services" is not clearly defined. A character with saved traits gets those traits from the constructor, potentially gets them cleared and re-added by rehydration, creating subtle ordering dependencies.

### 3.4 Redundant `updateCharacter()` Round-Trip

```
updateCharacter(updates):
  Character → serializeCharacter() → plain object → { ...spread updates } → new Character() → AppState
```

This full serialize→reconstruct cycle exists to ensure a clean merge. But since callers already mutate the Character directly (Section 1.1), this "immutable update" serves no purpose for its only consumer (the save handler). The save handler reads DOM fields and passes them as `updates` — a simple `Object.assign(character, updates)` or setter calls would achieve the same result without the round-trip.

---

## Section 4: Helpers & Utilities

### 4.1 Duplicate Utility Logic

| Duplicate | Location A | Location B | Fix |
|-----------|-----------|-----------|-----|
| `_getSchoolName()` — spell school abbreviation map | `StatBlockRenderer.js` (private) | `5eToolsParser.js` (`getSchoolName`) | Import from `5eToolsParser` |
| `_getMaxSpellLevel()` | `ClassCard.js` | `ClassSpellSelectorModal.js` | Extract to `ClassService` or a shared utility |
| Collapse-toggle with `localStorage` | `AbilityScoreBonusNotes.js` | `ProficiencyNotes.js` | Extract `CollapsibleNotesView` base |
| Point buy costs / standard array constants | `AbilityScoreService.js` | `CharacterStepAbilityScores.js` | Single source of truth in service |
| Source-prioritized lookup (XPHB → PHB → any) | `ProficiencyService` (×5 methods) | — | Extract shared `findBySourcePriority()` helper |
| Dynamic `import('./SourceService.js')` | `ProficiencyService` (×3 methods) | — | Import once, cache the module |
| `_renderEntries()` (5etools JSON → HTML) | `ProficiencyCard.js` | `5eToolsRenderer.js` (lib) | Use the lib function |

### 4.2 Dead Code in Lib

**5eToolsParser.js:** ~20 named exports are never imported by any source file. The `default` export object is also never imported.

**DataLoader.js:** 12 convenience loaders (`loadSkills`, `loadRaces`, etc.) are exported but only a few are used. `clearCacheForUrl`, `invalidateAllCache`, `getCacheStats` are exported but never imported.

**StatBlockRenderer.js:** `formatPrerequisite` is exported but never imported externally. `_formatPrerequisite` is a pointless one-line wrapper.

### 4.3 Bugs Found

| Bug | Location | Impact |
|-----|----------|--------|
| `renderString()` called but never defined/imported | `StatBlockRenderer.js` L272 | `ReferenceError` when rendering a class tooltip with string-type first entry |
| `_copyTooltipContent()` called but never defined | `TooltipManager.js` L309 | `ReferenceError` on Ctrl+C inside tooltip with no selection |

---

## Section 5: Cross-Domain Duplication

### 5.1 Event Listener Cleanup — Four Patterns

| Pattern | Used By | Description |
|---------|---------|-------------|
| `_cleanup.onEvent()` (DOMCleanup) | AbilityScoreCard, ThemeManager | Auto-tracked, auto-cleaned — **preferred** |
| `onEventBus()` helper + `_eventHandlers` map | BackgroundCard, RaceCard, ProficiencyCard | Custom re-implementation of the above |
| `_trackListener()` (BasePageController) | Page controllers | Stores refs, cleans in `cleanup()` |
| Manual `eventBus.off()` arrays | ClassCard, EquipmentManager, UIHandlersInitializer | Manual tracking and removal |

These should converge on `_cleanup.onEvent()` as the single pattern.

### 5.2 Singleton Patterns — Three Approaches

| Pattern | Used By |
|---------|---------|
| Module-level `new` + named export | `AppState`, `CharacterManager`, `EventBus`, `DataLoader`, `ThemeManager`, `TitlebarController` |
| `getInstance()` factory + named export | AbilityScore sub-views, `NotificationCenter` |
| Constructor-throws-on-second-instance | `Modal` |

The first pattern is the simplest and dominant; the others add no meaningful benefit.

### 5.3 AbilityScoreService and ProficiencyService — Manual Baseclass Re-implementation

Both `AbilityScoreService` and `ProficiencyService` manually implement `_trackListener()`, `dispose()`, and `_eventListeners[]` — the exact same listener lifecycle management that `BaseDataService` provides. Neither extends `BaseDataService`.

`ProficiencyService` also independently loads `skills.json` via its own `_loadSkillData()` method, while `SkillService` loads the same file through `BaseDataService.initWithLoader()`. This means `skills.json` is loaded and cached twice in two separate caching systems.

### 5.4 Cross-Service Encapsulation Violations

Three services call private (`_`-prefixed) methods on `SpellSelectionService`:

| Caller | Private Method Called |
|--------|---------------------|
| `CharacterValidationService` | `_getSpellsKnownLimit()`, `_getCantripsKnown()` |
| `LevelUpService` | `_getStandardSpellSlots()` |

These methods are part of the public contract in practice and should be renamed without the `_` prefix.

---

## Section 6: Architectural Consistency

### 6.1 State Update Patterns

| Pattern | Where | Consistent? |
|---------|-------|:-----------:|
| `AppState.setState()` | AppInitializer, CharacterManager | Yes |
| `AppState.setCurrentCharacter()` | CharacterManager, LevelUpModal, build page cards | Yes |
| Direct `character.property = value` | CharacterCreationModal, RaceCard, ClassCard, BackgroundCard, LevelUpModal | **No** — bypasses abstraction |
| `CharacterManager.updateCharacter()` | UIHandlersInitializer only | Underused |

### 6.2 Error Handling Patterns

| Pattern | Where | Consistent? |
|---------|-------|:-----------:|
| Throw `NotFoundError`/`ValidationError` | Most services (14 of 24) | Mostly |
| Return `null` or fallback string | `ProficiencyService` description methods | **No** — should throw `NotFoundError` |
| Return `{ error: string }` objects | `CharacterImportService` | Acceptable (main-process context) |
| Show notification directly | `SourceService` | **No** — service shouldn't own UI notifications |
| `alert()` | `ClassCard`, `AbilityScoreSelectorModal` | **No** — should use `Notifications` |

### 6.3 IPC Dependency Injection

| Handler File | Injection Style | Consistent? |
|-------------|----------------|:-----------:|
| CharacterHandlers | `preferencesManager` object (9 functions, only 1 used) | Over-injected |
| DataHandlers | `{ get, set, app }` from preferences | Clean |
| SettingsHandlers | `{ get, set, getAll }` from preferences | Clean |
| FileHandlers | Imports `getCharacterSavePath` directly from `Settings.js` | **Inconsistent** — breaks DI pattern |
| PdfHandlers | Accepts `_preferencesManager` but never uses it | Dead parameter |

### 6.4 CSP Inline Style Violations

Per project rules: no `.style.*` for visibility — use `classList.add/remove('u-hidden')`.

| Violation | Location |
|-----------|----------|
| `el.style.display` | `AbilityScoreBox`, `AppInitializer` (modal cleanup), `ModalCleanupUtility` |
| `el.style.opacity` | `BaseSelectorModal` |
| `bonusDisplay.style.display` | `CharacterStepAbilityScores` |
| `progressBar.style.width` | `Notifications.js` |
| `container.style.*` (display, zIndex, left, top, transform) | `TooltipManager` |

The `TooltipManager` positioning requires dynamic values (CSSOM is appropriate for `left`/`top`), but `style.display` and `style.zIndex` should use utility classes.

---

## Section 7: Simplification Opportunities

### 7.1 Collapse `updateCharacter()` Round-Trip

**Current:** `serialize → merge → reconstruct`  
**Proposed:** Apply updates directly to the Character instance via setters or `Object.assign`. Remove the serialize→reconstruct cycle from `updateCharacter()`.  
**Risk:** Low — no other caller depends on the reconstruct behavior.

### 7.2 Add Single-Character Load IPC

**Current:** `loadCharacter(id)` → loads ALL files → finds one  
**Proposed:** Add `CHARACTER_LOAD` handler that reads `{id}.ffp` directly. Keep `CHARACTER_LIST` for the home page.  
**Risk:** Low — additive change, no existing behavior removed.

### 7.3 Unify Build Page Events to EventBus

**Current:** 7+ DOM CustomEvents + `setTimeout` delays + EventBus events  
**Proposed:** Replace all DOM CustomEvents with granular EventBus events. Use `BuildPageController` as an orchestration coordinator that sequences updates when needed, removing `setTimeout` hacks.  
**Risk:** Medium — requires touching RaceCard, ClassCard, BackgroundCard, AbilityScoreCard, ProficiencyCard simultaneously. Recommend migration one card at a time.

### 7.4 Remove Duplicate Event Emissions

**Current:** `CHARACTER_CREATED`, `MULTICLASS_ADDED`, `MULTICLASS_REMOVED` emitted in both service and UI  
**Proposed:** Remove UI-side emissions; services own event emission.  
**Risk:** Low — verify no UI listener depends on the UI-side emission specifically.

### 7.5 Consolidate Listener Cleanup Pattern

**Current:** Four different patterns (Section 5.1)  
**Proposed:** Standardize on `_cleanup.onEvent()` (DOMCleanup). Cards and page controllers already have `_cleanup` instances; sub-views should receive their parent's `_cleanup` instance via constructor.  
**Risk:** Low — incremental migration.

### 7.6 Extract AbilityScoreService Helpers

**Current:** 985-line service with ~300 lines of pure functions and constants  
**Proposed:** Move pure functions (`getAbilityData`, `getRaceAbilityData`, `getFixedAbilities`, `getAbilityChoices`, etc.) and constants (`POINT_BUY_COSTS`, `STANDARD_ARRAY`, `POINT_BUY_BUDGET`) to `src/lib/AbilityScoreUtils.js`. Service imports from there. `CharacterStepAbilityScores` imports from there instead of re-defining its own copies.  
**Risk:** Low — pure extraction, no behavior change.

### 7.7 ProficiencyService: Use SkillService for Skill Data

**Current:** `ProficiencyService._loadSkillData()` loads `skills.json` independently; `SkillService` also loads it.  
**Proposed:** `ProficiencyService` imports `SkillService` and calls `skillService.getAllSkills()`.  
**Risk:** Low — both are already initialized at startup.

### 7.8 Move StatBlockRenderer and TooltipManager to UI Layer

**Current:** Both in `src/lib/` but import services (breaking lib → service direction)  
**Proposed:** Move to `src/ui/rendering/` or `src/ui/utils/`.  
**Risk:** Low — updates import paths only.

### 7.9 Clean Up IPC Placeholder Channels

**Current:** 20 channels defined for Equipment/Spell/Progression with no handler files  
**Proposed:** Remove the channel definitions. Re-add when the features are implemented.  
**Risk:** None — channels are unused.

### 7.10 Split Oversized UI Components

**Current:** `ClassCard.js` (4,056 lines), `ProficiencyCard.js` (1,947), `RaceCard.js` (1,628)  
**Proposed:** Extract embedded view classes into separate files.  
**Risk:** Low-medium — requires careful import wiring but no behavior change.

---

## Risk Assessment

| Change | Impact | Risk | Complexity | Dependencies |
|--------|:------:|:----:|:----------:|:------------:|
| Add single-character load IPC | High (perf) | Low | Low | New handler + preload + CharacterManager |
| Remove duplicate event emissions | Medium | Low | Low | Verify listener dependencies |
| Clean up IPC placeholder channels | Low | None | Trivial | `channels.js` only |
| Extract AbilityScoreService helpers | Medium | Low | Low | New file + import updates |
| Collapse `updateCharacter()` round-trip | Medium | Low | Low | `CharacterManager.js` only |
| Consolidate listener cleanup pattern | Medium | Low | Medium | Incremental across all components |
| Unify build page to EventBus | High (maint.) | Medium | High | RaceCard, ClassCard, BackgroundCard, AbilityScoreCard, ProficiencyCard, BuildPageController |
| Split ClassCard.js | Medium | Low-Med | Medium | Extract 3 classes + update imports |
| Move StatBlockRenderer/TooltipManager | Low | Low | Low | Import path updates |
| ProficiencyService use SkillService | Low | Low | Low | Import + method call change |
| Fix `renderString` bug | Low | Low | Trivial | 1 line in StatBlockRenderer |
| Fix `_copyTooltipContent` bug | Low | Low | Trivial | Implement or remove call |

---

## Prioritized Recommendations

### High Impact

| # | Recommendation | Section | Effort |
|:-:|---------------|:-------:|:------:|
| 1 | **Add single-character load IPC handler** — eliminate load-all-to-find-one | 1.3 | Small |
| 2 | **Unify build page events to EventBus** — eliminate DOM CustomEvents and setTimeout hacks | 1.4 | Large |
| 3 | **Remove duplicate event emissions** — `CHARACTER_CREATED`, `MULTICLASS_ADDED/REMOVED` | 1.5 | Small |
| 4 | **Collapse `updateCharacter()` round-trip** — eliminate unnecessary serialize→reconstruct | 1.2, 3.4 | Small |

### Medium Impact

| # | Recommendation | Section | Effort |
|:-:|---------------|:-------:|:------:|
| 5 | ~~**Split `ClassCard.js`** (4,056 lines) into constituent views~~ ✅ | 2.1 | Medium |
| 6 | ~~**Extract AbilityScoreService helpers** to `lib/AbilityScoreUtils.js`, consolidate duplicated constants~~ ✅ | 4.1, 7.6 | Small |
| 7 | **Consolidate event listener cleanup** on `_cleanup.onEvent()` pattern | 5.1 | Medium |
| 8 | **Make `SpellSelectionService` private methods public** — they are called by 2 other services | 5.4 | Trivial |
| 9 | **Fix CharacterManager.saveCharacter() double `touch()`** — remove the one in `updateCharacter()` | 1.2 | Trivial |
| 10 | **ProficiencyService: consolidate source-prioritized lookup** into shared helper | 4.1 | Small |
| 11 | **ProficiencyService: use SkillService** instead of loading skills.json independently | 5.3 | Small |

### Low Impact

| # | Recommendation | Section | Effort |
|:-:|---------------|:-------:|:------:|
| 12 | **Clean up 20 IPC placeholder channels** and update IPC_CONTRACTS.md | 2.4 | Trivial |
| 13 | **Move StatBlockRenderer and TooltipManager** out of `src/lib/` | 2.3 | Small |
| 14 | **Fix two bugs:** `renderString` in StatBlockRenderer, `_copyTooltipContent` in TooltipManager | 4.3 | Trivial |
| 15 | **Remove dead code:** unused DataLoader convenience methods, unused Parser exports, unused Settings functions | 4.2 | Small |
| 16 | **Consolidate duplicate UI logic:** collapse-toggle pattern, background proficiency formatting, hit dice map | 5.2, 4.1 | Small |
| 17 | **Fix CSP violations:** replace `el.style.display` with `u-hidden` class in 5 locations | 6.4 | Small |
| 18 | **Standardize IPC handler DI pattern:** `FileHandlers` should receive deps via injection like other handlers | 6.3 | Trivial |
| 19 | **Remove `selectFolder` duplicate exposure** from preload | 2.4 | Trivial |
| 20 | **Replace `alert()` calls** with `Notifications` service | 6.2 | Trivial |

---

## Appendix: Codebase Metrics

| Layer | Files | Lines (approx.) |
|-------|------:|----------------:|
| `src/app/` (incl. pages) | 19 | ~3,500 |
| `src/services/` | 25 | ~7,500 |
| `src/lib/` | 14 | ~5,350 |
| `src/main/` (incl. ipc, pdf) | 14 | ~3,650 |
| `src/ui/components/` | 43 | ~20,350 |
| **Total** | **115** | **~40,350** |

| Category | Count |
|----------|------:|
| EventBus events defined | ~63 |
| IPC channels defined | 37 |
| Services (total) | 25 |
| BaseDataService services | 14 |
| Stateless services | 6 |
| Modals (BaseSelectorModal) | 7 |
| Modals (standalone Bootstrap) | 6 |
| Unit tests | 509 |
