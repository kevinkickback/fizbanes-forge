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

### 2.2 Duplicate or Overlapping Files — ✅ Resolved

All four duplicate/overlapping file pairs have been consolidated:

| File A | File B | Resolution |
|--------|--------|------------|
| `RaceDetailsView.js` | `RaceDetailsPanel.js` | **Deleted** `RaceDetailsPanel.js` — unused 345-line duplicate (identical class name, never imported). `RaceDetailsView.js` is the sole implementation. |
| `CharacterStepAbilityScores.js` | `AbilityScoreUtils.js` | **Imports consolidated.** Removed local `POINT_COSTS`, `STANDARD_ARRAY` constants and `_calculatePointsUsed()` reimplementation. Now imports `calculatePointBuyTotal`, `getPointBuyCost`, `POINT_BUY_BUDGET`, `STANDARD_ARRAY` from `AbilityScoreService.js` (which re-exports from `AbilityScoreUtils.js`). All hardcoded `27` budget values replaced with `POINT_BUY_BUDGET`. |
| `CharacterStepBackground.js` | `BackgroundDetailsView.js` | **Delegates formatting.** Removed 6 duplicated methods (`_formatSkillProficiencies`, `_formatToolProficiencies`, `_formatLanguages`, `_formatEquipmentList`, `_formatSingleEquipment`, partial `_formatEquipment`). Step now instantiates `BackgroundDetailsView` and delegates calls. Equipment uses the richer `unpackUid`/currency/`equipmentType` parsing from `BackgroundDetailsView`. `_extractFeature` delegates but returns full (non-truncated) description. |
| `CharacterStepReview.js` | `ClassService.getHitDie()` | **Uses service.** Replaced 12-entry hardcoded `hitDice` map with `classService.getHitDie(className, source)`. New classes added to 5etools data are now automatically supported. |

### 2.3 Layer Violations (Files in Wrong Directory) — ✅ Resolved

All three files moved to their correct architectural layers:

| File | Old Location | New Location | Imports Updated |
|------|-------------|--------------|:---------------:|
| `StatBlockRenderer.js` | `src/lib/` | `src/ui/rendering/` | 3 internal (services + lib paths) |
| `TooltipManager.js` | `src/lib/` | `src/ui/rendering/` | 14 internal (12 services + 2 lib paths), 1 external (`TextProcessor.js`), 10 test mocks |
| `NotificationCenter.js` | `src/lib/` | `src/ui/components/` | 3 internal (lib paths), 1 external (`AppInitializer.js`) |

Created `src/ui/rendering/` directory for rendering utilities that depend on services. The lib → service dependency inversion no longer exists — these files are now in the UI layer where service imports are architecturally correct.

### 2.4 IPC Layer Issues ✅ Resolved

**Resolved:** Removed 20 dead placeholder channels (Equipment 8, Spell 7, Progression 5) and 2 handler-less portrait channels (`PORTRAITS_GET_DIRECTORY`, `PORTRAITS_SET_DIRECTORY`) from `channels.js`. Removed corresponding placeholder documentation sections from `IPC_CONTRACTS.md`. Removed duplicate `selectFolder` from `window.characterStorage` in `Preload.cjs` — `SettingsCard.js` now uses `window.app.selectFolder()`. Updated `IpcChannels.test.js` to remove `EQUIPMENT_`, `SPELL_`, `PROGRESSION_` from group assertion. Kept `FILE_READ_JSON`, `FILE_WRITE_JSON`, `FILE_EXISTS`, `UTIL_GET_APP_PATH` as intentional handler-only (no preload) channels.

---

## Section 3: Data Flow & Transformation Layers

### 3.1 DataLoader: Justified Two-Layer Cache

```
IPC/Disk → DataLoader.cache (by filename) → BaseDataService._data (processed per-service)
```

This works well. Layer 1 (`DataLoader.cache`) deduplicates raw JSON fetches. Layer 2 (`BaseDataService._data`) holds service-processed data (lookup maps, indexes). Both layers invalidate correctly on `DATA_INVALIDATED`.

**Minor waste:** DataLoader exports 12 convenience methods (`loadSkills()`, `loadRaces()`, etc.) that are thin wrappers over `loadJSON(filename)`. Some services use them; others call `loadJSON()` directly. The convenience methods add no logic and could be removed.

### 3.2 Character Serialization: Asymmetric Complexity ✅ Resolved

| Direction | Complexity | Where |
|-----------|-----------|-------|
| Serialize (Character → JSON) | 372 lines — property-by-property Map/Set/Array conversion | `CharacterSerializer.serialize()` |
| Deserialize (JSON → Character) | 1 line — `new Character(data)` | `CharacterSerializer.deserialize()` |

All deserialization logic lives in `Character`'s constructor (~260 lines). The `deserialize()` function is a trivial delegation but is well-tested and provides a null guard — it stays in `CharacterSerializer.js`.

**Resolved:** Removed dead `deserializeCharacter()` re-export from `Character.js` — it was never imported anywhere. `CharacterSerializer.deserialize()` remains as the canonical entry point (used by 11 tests).

### 3.3 Rehydration: Necessary but Overlapping — No Action

`RehydrationService.rehydrate()` restores runtime-computed data (racial traits, class features, spellcasting entries, background feature descriptions) from the game data services after loading a character from disk. This is conceptually correct — the character JSON stores references (race name + source), and rehydration resolves them to full data.

However, the `Character` constructor already initializes traits, resistances, and darkvision from the saved data. Then `rehydrate()` may re-add some of the same data. The boundary between "what's restored from JSON" and "what's rehydrated from services" is not clearly defined. A character with saved traits gets those traits from the constructor, potentially gets them cleared and re-added by rehydration, creating subtle ordering dependencies.

**No action:** Fixing this requires a medium-effort refactor (Character constructor should only set structural properties, RehydrationService should own all game-data-derived state) with regression risk in the character loading → rehydration → UI rendering pipeline. Not worth the risk for a design smell with no current bugs.

### 3.4 Redundant `updateCharacter()` Round-Trip — No Action

```
updateCharacter(updates):
  Character → serializeCharacter() → plain object → { ...spread updates } → new Character() → AppState
```

This full serialize→reconstruct cycle exists to ensure a clean merge. But since callers already mutate the Character directly (Section 1.1), this "immutable update" serves no purpose for its only consumer (the save handler). The save handler reads DOM fields and passes them as `updates` — a simple `Object.assign(character, updates)` or setter calls would achieve the same result without the round-trip.

---

## Section 4: Helpers & Utilities

### 4.1 Duplicate Utility Logic ✅ Resolved

| Duplicate | Status | Resolution |
|-----------|--------|------------|
| `_getSchoolName()` — spell school abbreviation map | ✅ Fixed | StatBlockRenderer now imports `getSchoolName` from `5eToolsParser.js` |
| `_getMaxSpellLevel()` | ✅ Fixed | Extracted to `ClassService.getMaxSpellLevel()`. Both `ClassCard` and `ClassSpellSelectorModal` delegate to it. |
| Collapse-toggle with `localStorage` | ✅ Fixed | Extracted `renderCollapsibleSection()` + `attachCollapseToggle()` into `src/ui/components/CollapsibleSection.js`. Both consumers refactored. |
| Point buy costs / standard array constants | ✅ Fixed | Consolidated into `AbilityScoreUtils.js` (done in section 2.2) |
| Source-prioritized lookup (XPHB → PHB → any) | ✅ Fixed | Extracted `_findBySourcePriority()` helper in `ProficiencyService`. All 3 methods refactored. |
| Dynamic `import('./SourceService.js')` | ✅ Fixed | Single cached dynamic import via `_getAllowedSourcesSet()` in `ProficiencyService` (4 calls → 1 cached). |
| `_renderEntries()` (ProficiencyCard vs StatBlockRenderer) | — No action | Different tag resolution strategies (raw HTML vs `processString`) and structural handling make merging impractical without adding more complexity than it saves. |

### 4.2 Dead Code in Lib — ✅ Resolved

**5eToolsParser.js:** Removed `default` export object (~30 lines). Deleted 19 dead exported functions (`attrChooseToFull`, `monTypeToFullObj`, `alignmentAbvToFull`, `skillToAbility`, `abilityToSkills`, `packUid`, `sourceToFull`, `sourceToAbv`, `isOneDnD`, `numberToVulgarFraction`, `parseAbilityImprovements`, `formatAbilityImprovements`, `ascSortByProp`, `ascSortByPropLower`, `getAlignmentLabel`, `getAlignmentValue`, `isValidSkill`, `isValidTool`, `isValidLanguage`). Removed `export` from `ascSort` (internal-only). Removed dead helper `pluralize`. Cleaned re-export block from 10 constants to 1 (`DEFAULT_SOURCE`). Net: ~200 lines removed.

**DataLoader.js:** Deleted 5 dead functions (`setBaseUrl`, `clearCacheForUrl`, `invalidateAllCache`, `getCacheStats`; `clearCache` kept as private). Removed `version` state field. Removed `dataLoader` alias export and 16 dead named exports — only `DataLoader` remains exported. Net: ~50 lines removed.

**StatBlockRenderer.js:** Removed `export` from `formatPrerequisite` (internal-only). Deleted `_formatPrerequisite` wrapper, updated 2 call sites to use `formatPrerequisite` directly.

### 4.3 Bugs Found — ✅ Resolved

| Bug | Location | Fix |
|-----|----------|-----|
| `renderString()` called but never defined/imported | `StatBlockRenderer.js` L272 | Replaced with `Renderer5etools.processString()` (already imported and used elsewhere in the file) |
| `_copyTooltipContent()` called but never defined | `TooltipManager.js` L309 | Added `_copyTooltipContent()` implementation — extracts `.tooltip-content` text and writes to clipboard via `navigator.clipboard.writeText()` |

---

## Section 5: Cross-Domain Duplication

### 5.1 Event Listener Cleanup — Four Patterns — ✅ Resolved

Converged UI components and initializers onto `DOMCleanup.onEvent()`:

| File | Before | After |
|------|--------|-------|
| RaceCard | Custom `onEventBus()` + `_eventHandlers` map + `_cleanupEventBusListeners()` | `this._cleanup.onEvent()` — removed ~35 lines |
| BackgroundCard | Same custom pattern | Same migration — removed ~35 lines |
| ProficiencyCard | Same custom pattern + dead `_setupContainerClickListeners()` | Same migration — removed ~45 lines |
| ClassCard | Manual handler refs + `eventBus.on/off` pairs | `this._cleanup.onEvent()` — removed ~20 lines |
| AbilityScoreCard | Mixed: manual `eventBus.on/off` for 2 listeners + `_cleanup.onEvent` for 1 | All 3 via `_cleanup.onEvent()` — removed handler refs and guard-check cleanup |
| UIHandlersInitializer | `addListener()` + `listeners` Map + manual `eventBus.off` loop | `cleanup.onEvent()` — removed Map and manual cleanup; dropped `eventBus` import |
| AppInitializer | `_appInitializerListeners` Map + `eventBus.on/off` | Module-level `DOMCleanup` (`_appCleanup`) — removed Map and manual cleanup; dropped `eventBus` import |

`BasePageController._trackListener()` left as-is — page controllers are EventBus-only (no DOM cleanup needed), and the pattern is functionally equivalent. Service-layer `_trackListener()` addressed in section 5.3.

### 5.2 Singleton Patterns — Three Approaches — ✅ Resolved

Converged all singletons onto the dominant module-level `new` + named export pattern:

| File | Before | After |
|------|--------|-------|
| Modal.js | Constructor-throws-on-second + `getInstance()` + `export const modal` | Removed constructor guard and `getInstance()`; `export const modal = new Modal()` |
| AbilityScoreCard.js | `getInstance()` bolted on + `export const abilityScoreCard` | Removed `getInstance()`; `export const abilityScoreCard = new AbilityScoreCard()` |
| AbilityScoreMethodControls.js | `getInstance()` bolted on + `export const methodControlsView` | Removed `getInstance()`; `export const methodControlsView = new MethodControlsView()` |
| NotificationCenter.js | `getNotificationCenter()` factory function | Removed factory; `export const notificationCenter = new NotificationCenter()` |

Callers updated to import the named export instead of calling `getInstance()`:
- HomePageController: `import { modal }` (was `import { Modal }` + 4× `Modal.getInstance()`)
- LevelUpModal: `import { modal }` (was `import { Modal }` + `Modal.getInstance()`)
- AppInitializer: `import { modal }` + `import { notificationCenter }` (was class imports + factory calls)
- BuildPageController: `import { abilityScoreCard }` (was `import { AbilityScoreCard }` + `AbilityScoreCard.getInstance()`)

### 5.3 AbilityScoreService and ProficiencyService — Manual Baseclass Re-implementation — ✅ Resolved

Both services now extend `BaseDataService`, inheriting `_trackListener()`, `dispose()`, `_eventListeners[]`, and `DATA_INVALIDATED` subscription:

| Service | Changes |
|---------|---------|
| AbilityScoreService | Extends `BaseDataService({ loggerScope: 'AbilityScoreService' })`. Removed manual `_trackListener()`, `dispose()`, and `_eventListeners` field (~20 lines). |
| ProficiencyService | Extends `BaseDataService({ loggerScope: 'ProficiencyService' })`. Removed manual `_trackListener()`, `_eventListeners` field, and explicit `DATA_INVALIDATED` subscription (~15 lines). Overrides `dispose()` and `resetData()` to also clear `_skillData`, `_languageData`, `_bookData`. |
| ProficiencyService (skill data) | Replaced independent `DataLoader.loadJSON('skills.json')` with `skillService.getSkillData()` — skills.json is now loaded once via SkillService's cache. |
| SkillService | Added `getSkillData()` method — lazy-initializes and returns the raw skill array. |

### 5.4 Cross-Service Encapsulation Violations — ✅ Resolved

Renamed three private methods to public on `SpellSelectionService`:

| Method | Callers Updated |
|--------|----------------|
| `_getCantripsKnown` → `getCantripsKnown` | SpellSelectionService (internal ×1), CharacterValidationService, ClassCard (×2), ClassSpellSelectorModal (×2) |
| `_getSpellsKnownLimit` → `getSpellsKnownLimit` | SpellSelectionService (internal ×2), CharacterValidationService, ClassCard (×2), ClassSpellSelectorModal (×2) |
| `_getStandardSpellSlots` → `getStandardSpellSlots` | SpellSelectionService (internal ×1), LevelUpService |

---

## Section 6: Architectural Consistency

### 6.1 State Update Patterns — No Action

| Pattern | Where | Consistent? |
|---------|-------|:-----------:|
| `AppState.setState()` | AppInitializer, CharacterManager | Yes |
| `AppState.setCurrentCharacter()` | CharacterManager, LevelUpModal, build page cards | Yes |
| Direct `character.property = value` | CharacterCreationModal, RaceCard, ClassCard, BackgroundCard, LevelUpModal | **No** — bypasses abstraction |
| `CharacterManager.updateCharacter()` | UIHandlersInitializer only | Underused |

Observation only — `updateCharacter()` is a thin wrapper (`character[key] = value` + unsaved flag + event). Enforcing it everywhere would be a large refactor with marginal safety benefit.

### 6.2 Error Handling Patterns — ✅ Resolved (alert() calls)

Replaced 3 `alert()` calls in `AbilityScoreSelectorModal.js` with `showNotification(..., 'warning')`. Added `import { showNotification }` from `Notifications.js`.

Remaining observations (not actionable as bugs):
- `ProficiencyService` description methods return `null` — acceptable for optional data lookups.
- `SourceService` — no direct UI notification calls found (audit finding was stale).
- `CharacterImportService` `{ error: string }` — acceptable for main-process context.

### 6.3 IPC Dependency Injection — No Action (Already Clean)

On investigation, both original findings are already resolved:
- `FileHandlers` receives `preferencesManager` via DI (no direct import from Settings.js).
- `PdfHandlers` has no dead `_preferencesManager` parameter — signature is `registerPdfHandlers(windowManager)` only.

### 6.4 CSP Inline Style Violations — ✅ Resolved

Fixed `CharacterStepAbilityScores.js`: replaced `bonusDisplay.style.display = 'block'/'none'` with `classList.remove/add('u-hidden')`.

Remaining `.style.*` usages reviewed and confirmed as legitimate CSSOM (dynamic values):
- `AppInitializer` + `ModalCleanupUtility`: `body.style.overflow/paddingRight = ''` — clearing Bootstrap's own inline styles
- `Notifications.js`: `progressBar.style.width` — dynamic computed percentage
- `TooltipManager`: `style.left/top/zIndex` — dynamic tooltip positioning and stacking

---
