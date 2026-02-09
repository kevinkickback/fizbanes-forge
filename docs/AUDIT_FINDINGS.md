# Audit Findings - February 8, 2026

This document tracks issues discovered during the comprehensive codebase audit and their remediation status.

---

## Fix Now (High-Impact, Violate Own Rules)

### 1. Move SettingsService DOM logic out of service layer — **HIGH PRIORITY**
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Location:** [src/services/SettingsService.js](../src/services/SettingsService.js)  
**Issue:** SettingsService directly manipulated DOM (~10 `document.getElementById`, 4 `innerHTML`, raw `addEventListener`). Violated non-negotiables: services must not touch DOM, and DOM listeners must use `DOMCleanup`.  
**Solution:** Created [SettingsCard](../src/ui/components/settings/SettingsCard.js) UI component with all DOM logic. SettingsService now only handles data operations. All DOM listeners use `DOMCleanup.on()`.

### 2. Replace CustomEvent with EventBus — **HIGH PRIORITY**
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Location:** [src/services/AbilityScoreService.js:284](../src/services/AbilityScoreService.js#L284), [src/lib/EventBus.js](../src/lib/EventBus.js)  
**Issue:** Dispatched `CustomEvent` on `document`, bypassing EventBus entirely. Created parallel, untraceable communication channel.  
**Solution:** Added `ABILITY_SCORES_CHANGED` event to EventBus. Updated AbilityScoreService and AbilityScoreCard to use `eventBus.emit()` and `eventBus.on()`.  
**Note:** Other UI components (RaceCard, ClassCard) still dispatch this CustomEvent - these should be migrated in a future update.

### 3. Fix OptionalFeatureService super() call — **HIGH PRIORITY**
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Location:** [src/services/OptionalFeatureService.js:12](../src/services/OptionalFeatureService.js#L12)  
**Issue:** Passed string `'optionalfeatures'` to `super()` instead of options object. BaseDataService expected `{ loadEvent, loggerScope }`. Both params became `undefined`, disabling events and logging.  
**Solution:** Changed to `super({ loadEvent: EVENTS.DATA_LOADED, loggerScope: 'OptionalFeatureService' })`.  
**Note:** Original fix also included `cacheKey`, which was later removed as part of Finding #7b.

### 4. Stub IPC handlers are non-functional — **HIGH PRIORITY**
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Location:** [src/main/Main.js](../src/main/Main.js)  
**Issue:** 20+ registered IPC channels always returned `{ success: false, error: "not implemented" }`. Any renderer code calling these got silent failures.  
**Solution:** Deleted stub handler files (`EquipmentHandlers.js`, `SpellHandlers.js`, `ProgressionHandlers.js`) from `src/main/ipc/`. Removed imports and registration calls from Main.js. Decision: Renderer services already handle equipment, spells, and progression — IPC handlers were architectural duplication.

### 5. CODEBASE_ARCHITECTURE.md is inaccurate re: Immer — **HIGH PRIORITY**
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Location:** [docs/CODEBASE_ARCHITECTURE.md](../docs/CODEBASE_ARCHITECTURE.md)  
**Issue:** Docs extensively described Immer's `produce()` and `setAutoFreeze`, but AppState.js doesn't use Immer at all — just shallow spread `{ ...this.state, ...updates }`. Misleading for contributors.  
**Solution:** Rewrote CODEBASE_ARCHITECTURE.md to accurately describe shallow-copy pattern, documented nested mutation risks, corrected all examples. ARCHITECTURE_DECISIONS.md merged into CODEBASE_ARCHITECTURE.md and deleted.

---

## Fix Soon (Consistency, Reliability)

### 6. Standardize error handling across services
**Status:** 🟡 PARTIAL COMPLETION - February 8, 2026  
**Issue:** 12 services throw typed errors, 12 use different patterns (return null/false, return `{error}`, console.error only).  
**Solution:** All services must throw typed errors from `Errors.js` per architecture rules.

**✅ COMPLETED MIGRATIONS (3 services):**
1. **EquipmentService** - COMPLETE Migration
   - Migrated 5 methods: `addItem`, `removeItem`, `unequipItem`, `attuneItem`, `unattuneItem`
   - Now throws `ValidationError` (missing inventory) and `NotFoundError` (missing items)
   - Eliminated all `console.warn + return null/false` patterns

2. **LevelUpService** - COMPLETE Migration  
   - Migrated `removeClassLevel` method
   - Now throws `ValidationError` (missing progression) and `NotFoundError` (class not found)
   - Multiclass operations now have proper error feedback

3. **SpellSelectionService** - COMPLETE Migration (7 methods)
   - Migrated: `initializeSpellcastingForClass`, `addKnownSpell`, `removeKnownSpell`, `prepareSpell`, `unprepareSpell`, `useSpellSlot`, `restoreSpellSlots`
   - Now throws `ValidationError` (uninitialized spellcasting, duplicates, limits) and `NotFoundError` (missing spells)
   - Eliminated all `console.warn + return false` patterns

**✅ SERVICES CONFIRMED COMPLIANT (no changes needed):**
- **ProgressionHistoryService** - Getter methods appropriately return null/false/{}/[] for "no data" cases
- **SourceService** - Already re-throws errors in onError callback, console.error used only for diagnostics
- **SettingsService** - Already throws `ServiceError` on initialization failure (migrated in Fix Now #1)

**⏸️ DEFERRED (Complex/Requires Coordination):**
- **ProficiencyService** (852 lines) - Extensive validation logic across multiple methods
- **AbilityScoreService** (983 lines) - Complex calculation methods with nested error paths  
- **CharacterImportService** - Returns `{error}` objects, requires IPC handler updates for proper error propagation

**Summary:**  
- **3 services fully migrated** (EquipmentService, LevelUpService, SpellSelectionService)
- **3 services confirmed compliant** (ProgressionHistoryService, SourceService, SettingsService)
- **3 services deferred** due to complexity/scope (ProficiencyService, AbilityScoreService, CharacterImportService)
- **13 services already compliant** from initial audit (ActionService, BackgroundService, ClassService, etc.)

**Impact:** Critical user-facing services now provide clear, catchable errors instead of silent failures. Character operations (equipment, leveling, spellcasting) have consistent error handling.

**Remaining Effort:** Deferred services estimated at 6-8 hours for complete migration.

### 7. Remove DataLoader localStorage persistence
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Location:** [src/lib/DataLoader.js](../src/lib/DataLoader.js)  
**Issue:** Stored 20-50MB JSON in localStorage (5-10MB quota). No quota management, synchronous serialization on every save.  
**Solution:** Removed localStorage persistence entirely. Data loads from disk via IPC on each session and caches in-memory for same-session reuse.

**Changes Made:**
- Removed `state.persisted`, `PERSIST_KEY`, and `state.ttl`
- Removed functions: `_loadPersistedCache()`, `_savePersistedCache()`, `_hashData()`, `_getPersistedEntry()`, `_isCacheEntryValid()`, `_setPersistedEntry()`
- Removed functions: `setTTL()`, `getCacheSettings()`
- Simplified `loadJSON()` to only use in-memory cache
- Simplified `clearCache()` and `clearCacheForUrl()` to only clear in-memory state
- Enhanced `getCacheStats()` to show size in both bytes and MB

**Result:** 
- Eliminated localStorage quota errors (DOMException)
- Removed synchronous serialization blocking main thread
- Simplified architecture: disk → IPC → in-memory cache
- Code reduced from 466 to 174 lines (-63%)
- Data still loads fast from disk with modern SSDs + IPC
- In-memory cache provides same-session performance

### 7a. Unify cache invalidation across all layers
**Status:** ✅ **COMPLETED** - February 9, 2026  
**Issue:** After auto-update, `DataLoader.clearCache()` only cleared the DataLoader in-memory cache (L1). Services still held stale data in `this._data` (L2) and `AppState.loadedData` (L3), and `isInitialized()` returned true — so services never re-fetched.
**Solution:**
- Added `DATA_INVALIDATED` event to EventBus
- Added `resetData()` method to BaseDataService that clears `_data` on `DATA_INVALIDATED`
- Added `resetData()` overrides in services with auxiliary state (SpellService, ItemService, RaceService, MonsterService, SkillService, VariantRuleService)
- Added `DataLoader.resetAll()` that clears L1 cache + emits `DATA_INVALIDATED`
- Changed AppInitializer to call `resetAll()` instead of `clearCache()` after auto-update

### 7b. Remove redundant AppState.loadedData cache layer
**Status:** ✅ **COMPLETED** - February 9, 2026  
**Issue:** `AppState.loadedData` (L3) duplicated `BaseDataService._data` (L2) for all singleton services. Added memory overhead, stale-data risk, and confusing initial shape (`spells`, `equipment` keys never written to).
**Solution:**
- Removed `loadedData` from AppState initial state
- Removed `setLoadedData()` and `getLoadedData()` methods from AppState
- Removed `hydrateFromCache()` from BaseDataService
- Removed `cacheKey` parameter from BaseDataService constructor
- Removed `cacheKey` from all 8 services that passed it
- Removed `AppState.setLoadedData` calls from RaceService tests

### 7c. Remove dead TTL parameters
**Status:** ✅ **COMPLETED** - February 9, 2026  
**Issue:** 11 `{ ttl: 24 * 60 * 60 * 1000 }` options passed to `DataLoader.loadJSON()` that were silently ignored after localStorage removal. Misleading for developers.
**Solution:**
- Removed `ttl` parameter from `DataLoader.loadJSON()` signature
- Removed TTL constants and options from SpellService (3 calls), ClassService (4 calls), ItemService (2 calls), OptionalFeatureService (2 calls)

### 7d. Standardize service data patterns
**Status:** ✅ **COMPLETED** - February 9, 2026  
**Issue:** 4 services bypassed BaseDataService: SkillService and ConditionService didn't extend it, MonsterService extended but never called `initWithLoader()`.
**Solution:**
- Migrated SkillService to extend BaseDataService with `initWithLoader`
- Migrated ConditionService to extend BaseDataService with `initWithLoader`
- Refactored MonsterService to properly use `initWithLoader` and `setData`
- All three now participate in `DATA_INVALIDATED` cache clearing

### 7e. Handle partial download failures
**Status:** ✅ **COMPLETED** - February 9, 2026  
**Issue:** `downloadDataFromUrl()` returned `{ success: true }` even when core required files failed to download. Silent data gaps possible.
**Solution:** Now checks failed files against `CORE_REQUIRED_FILES` and returns `{ success: false, criticalFailures }` if any core file failed. Non-critical failures (fluff, optional bestiary) still succeed with a warning.

### 8. Pin Electron versions in package.json
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Location:** [package.json](../package.json)  
**Issue:** `electron: "latest"` and `electron-builder: "latest"` can break builds with surprise updates.  
**Solution:** Pinned `electron: "^34.3.0"`, `electron-builder: "^25.1.8"`, `electronmon: "^2.0.3"` based on currently installed versions.

### 9. Replace Math.random() with crypto.randomUUID()
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Location:** [src/services/EquipmentService.js:31](../src/services/EquipmentService.js#L31)  
**Issue:** Uses `Math.random().toString(36).substr(2, 9)` — deprecated `.substr()`, not cryptographically secure.  
**Solution:** Replaced with `crypto.randomUUID()` (Web Crypto API). Now generates item IDs as `` item-${crypto.randomUUID()} ``.

---

## Plan For (Maintainability, Scale)

### 10. Break up PageHandler into per-page controllers
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Location:** [src/app/PageHandler.js](../src/app/PageHandler.js)  
**Issue:** Monolithic switch statement for all pages, directly instantiates all UI components.  
**Solution:** Created [BasePageController](../src/app/pages/BasePageController.js) base class with `_trackListener()`/`cleanup()` lifecycle methods. Extracted 8 per-page controllers into `src/app/pages/`: HomePageController, BuildPageController, DetailsPageController, FeatsPageController, EquipmentPageController, SpellsPageController, SettingsPageController, PreviewPageController. PageHandler rewritten as a thin orchestrator (~70 lines) with a `PAGE_CONTROLLERS` map — calls `cleanup()` on the active controller before switching pages.  
**Result:** PageHandler reduced from 830 lines to ~70. Each page owns its listeners and component lifecycle. EventBus listeners are auto-cleaned on page transitions via `_trackListener()`.

### 11. Expand test coverage
**Status:** � PARTIAL COMPLETION - February 8, 2026  
**Current:** 679 tests (679 passing), 23 files  
**Target:** At least 50% of services, critical UI components, IPC handlers.

**✅ COMPLETED:**
- **BaseDataService.test.js** — 22 tests covering constructor, initialization, data caching, initWithLoader (success/error/fallback/deduplication), buildLookupMap, lookupByNameAndSource, dispose, and DATA_INVALIDATED listener
- **EquipmentService.test.js** — 39 tests covering addItem, removeItem, unequipItem, attuneItem, unattuneItem, calculateTotalWeight, calculateCarryCapacity (including Powerful Build), getInventoryItems, getAttunedItems, findItemById, event emissions, and error handling
- **ProgressionHistoryService.test.js** — 27 tests covering all 12 methods: ensureInitialized, recordChoices, getChoices, removeChoices, getChoicesByRange, getClassLevelHistory, getClassesWithHistory, hasClassHistory, getHighestRecordedLevel, clearClassHistory, clearAllHistory, clearFeatureTypesFromClass, getSummary
- **ConditionService.test.js** — 8 tests covering initialize, getAllConditions, getCondition (case-insensitive, not found, validation)
- **DeityService.test.js** — 9 tests covering initialize, getDeityNames (sorted, deduplicated, skip unnamed), getDeity (case-insensitive, not found, validation)
- **ActionService.test.js** — 10 tests covering initialize (including error fallback), getAllActions, getAction (case-insensitive, not found, uninitialized map, validation)
- **SkillService.test.js** — 11 tests covering initialize, resetData (direct + DATA_INVALIDATED), getSkillsByAbility (full name, abbreviation, case-insensitive, empty result, validation)
- **ItemService.test.js** — 13 tests covering initialize (including partial file failure), resetData, getAllItems, getAllBaseItems, getItem (regular items, base item fallback, explicit source, not found, validation)
- **BackgroundService.test.js** — 18 tests covering initialize, getAllBackgrounds, getBackground, selectBackground, normalization of legacy skill/tool/language proficiency formats, startingEquipment mapping
- **IpcChannels.test.js** — 3 tests verifying channels.js and Preload.cjs channel definitions stay in sync
- **EventBusDebug.test.js** — Fixed pre-existing failure (leak detection threshold)

**Bug surfaced during testing:**
- `removeItemArgsSchema` used a typed `z.object()` for character that stripped `weight`, `equipped`, `attuned` properties — causing `_updateInventoryWeight()` to fail. Fixed to use `z.any().refine()` consistent with other service schemas.

**⏸️ REMAINING:**
- Service tests: AbilityScoreService, SpellSelectionService, LevelUpService, CharacterValidationService, ClassService, SourceService, FeatService, OptionalFeatureService, SpellService, MonsterService, SettingsService, CharacterImportService, VariantRuleService
- UI component tests
- Additional IPC handler tests

### 12. Eliminate IPC channel duplication
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Location:** [src/main/ipc/channels.js](../src/main/ipc/channels.js), [src/main/Preload.cjs](../src/main/Preload.cjs)  
**Issue:** Channel names manually duplicated with "must stay in sync" comment.  
**Solution:** [channels.js](../src/main/ipc/channels.js) is now the single source of truth for all IPC channel names. Preload.cjs must inline its own copy due to Electron's sandbox restriction (sandboxed preload scripts cannot `require()` non-built-in modules). [IpcChannels.test.js](../tests/unit/IpcChannels.test.js) parses both files as text and asserts that every channel in Preload.cjs matches channels.js — catching any drift automatically.  
**Note:** The original plan (shared `.cjs` file) was not viable because Electron's sandboxed preload blocks external `require()`. The sync-verification test is the pragmatic alternative.

### 13. Add service dispose() pattern
**Status:** ✅ **COMPLETED** - February 8, 2026  
**Issue:** EventBus listeners registered in service constructors have no cleanup path.  
**Solution:** Added `_trackListener(event, handler)` and `dispose()` to [BaseDataService](../src/services/BaseDataService.js). `_trackListener()` registers the listener via `eventBus.on()` and stores the reference in `_eventListeners[]`. `dispose()` calls `eventBus.off()` for all tracked listeners, then clears `_data` and `_initPromise`. All BaseDataService subclasses inherit this automatically.

**Services with manual tracking (not BaseDataService subclasses):**
- **AbilityScoreService** — Added own `_eventListeners`, `_trackListener()`, `dispose()` (mirrors BaseDataService pattern)
- **ProficiencyService** — Added own `_eventListeners`, `_trackListener()`, `dispose()`

**Also applied to:**
- **SourceService** — `_setupEventListeners()` now uses `_trackListener()` for CHARACTER_LOADED, CHARACTER_CREATED, CHARACTER_SELECTED
- **BasePageController** — Page controllers use the same `_trackListener()`/`cleanup()` pattern for automatic EventBus listener cleanup on page transitions

### 14. Extract Character constructor into builder/factory
**Status:** 🔵 Future  
**Location:** [src/app/Character.js](../src/app/Character.js) (200+ line constructor)  
**Issue:** Complex default-value construction makes Character hard to test/extend.  
**Solution:** CharacterBuilder pattern or factory function for modular construction.

---

## Additional Findings (Not Prioritized Yet)

- **AbilityScoreService is 821 lines:** Extract helper functions
- **AppInitializer is 567 lines:** Extract data source logic
- ~~**DeityService dual stores:** Data in both `_data` and `deities` risks desync~~ — **Resolved:** DeityService only uses `this.deities`; no `_data` property exists
- **Sync FS in Settings.js:** `fs.existsSync`/`mkdirSync` block main process event loop
- **Memory:** TextProcessor's global MutationObserver on `document.body` with `subtree: true`
- **Security:** `innerHTML` used ~161 times across UI components (low risk due to CSP, but worth sanitizing)
