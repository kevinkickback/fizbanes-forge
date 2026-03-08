# Remediation Action Plan — Fizbane's Forge

**Created:** 2026-03-07  
**Based on:** [AI_Codebase_Audit.md](AI_Codebase_Audit.md)  
**Approach:** Phased delivery — fix what's broken first, then harden, then improve

---

## Phasing Strategy

The plan is organized into four phases, ordered by blast radius and risk:

| Phase | Focus | Goal | Est. Scope |
|-------|-------|------|------------|
| **Phase 1** | Critical bugs & security | Stop active defects and close security gaps | 5 tasks |
| **Phase 2** | Stability & data integrity | Prevent data loss and resource leaks | 7 tasks |
| **Phase 3** | Architecture & code quality | Reduce complexity and improve maintainability | 8 tasks |
| **Phase 4** | Testing, performance & docs | Increase confidence and fill coverage gaps | 7 tasks |

Each task includes the audit reference, affected files, acceptance criteria, and implementation guidance.

---

## Phase 1 — Critical Bugs & Security Fixes

> **Goal:** Eliminate runtime bugs and close security gaps that affect users now.

---

### Task 1.1 — Fix Powerful Build Carry Capacity Bug

**Audit Ref:** C1 (§2.4)  
**Severity:** Critical  
**Files:** `src/services/EquipmentService.js`

**Problem:**  
`_getCarryCapacityModifier()` checks `character.traits?.includes('Powerful Build')` and `character.race?.traits?.includes('Powerful Build')`. Neither works:
- `character.traits` does not exist as a top-level property
- `character.features.traits` is a `Map`, which has `.has()` not `.includes()`

Powerful Build never applies to carry capacity.

**Fix:**
```javascript
_getCarryCapacityModifier(character) {
    if (character.features?.traits?.has('Powerful Build')) {
        return 2;
    }
    return 1;
}
```

**Acceptance Criteria:**
- [ ] `_getCarryCapacityModifier()` returns 2 when character has Powerful Build trait
- [ ] Unit test added covering: with trait → 2, without trait → 1
- [ ] Existing `EquipmentService` tests still pass

---

### Task 1.2 — Add Download Timeout to DataHandlers

**Audit Ref:** C3 (§4.1)  
**Severity:** Critical  
**Files:** `src/main/ipc/DataHandlers.js`, `src/main/Data.js`

**Problem:**  
HTTP downloads for game data have no timeout. On network failure or an unresponsive server the app hangs indefinitely with no way for the user to recover.

**Fix:**
- Add a per-request timeout (30 seconds) to individual file fetches
- Add an overall download timeout (5 minutes) for the full download operation
- On timeout, abort the request and return a clear error to the renderer

**Implementation Notes:**
- Use `AbortController` with `setTimeout` for fetch timeouts
- Store the controller so it can be cancelled on user-initiated abort
- Return `{ success: false, error: 'Download timed out' }` to renderer

**Acceptance Criteria:**
- [ ] Individual file fetches time out after 30 seconds
- [ ] Overall download operation times out after 5 minutes
- [ ] User sees a clear error notification on timeout
- [ ] Timed-out downloads can be retried

---

### Task 1.3 — Fix DataHandlers Cache State Leak

**Audit Ref:** C2 (§4.2)  
**Severity:** Critical  
**Files:** `src/main/ipc/DataHandlers.js`

**Problem:**  
`state.loading[url]` entries are not cleaned up on download failure. Failed URLs become permanently "loading", preventing retry.

**Fix:**
- Wrap download logic in `try/finally` and delete `state.loading[url]` in the `finally` block

**Acceptance Criteria:**
- [ ] `state.loading[url]` is removed after both success and failure
- [ ] A previously-failed URL can be retried successfully
- [ ] No stale entries accumulate in `state.loading`

---

### Task 1.4 — Add `app.isPackaged` Guard for Debug Mode

**Audit Ref:** §5.4  
**Severity:** High  
**Files:** `src/main/Main.js`

**Problem:**  
If `FF_DEBUG=true` is accidentally left in a `.env` file in a distributed build, `window.__debug` exposes EventBus internals. While DevTools require a separate flag, defense-in-depth is warranted.

**Fix:**
- In the main process, force `FF_DEBUG=false` when `app.isPackaged === true`
- Log a warning if the .env file had debug enabled in a packaged build

```javascript
if (app.isPackaged && process.env.FF_DEBUG === 'true') {
    console.warn('[Main] FF_DEBUG forced off in packaged build');
    process.env.FF_DEBUG = 'false';
}
```

**Acceptance Criteria:**
- [ ] `FF_DEBUG` is forced to `false` in packaged builds
- [ ] Warning logged when overridden
- [ ] `window.__debug` never exists in production

---

### Task 1.5 — Add `app.isPackaged` Guard for DevTools

**Audit Ref:** §5.4  
**Severity:** High  
**Files:** `src/main/Window.js`

**Problem:**  
DevTools can be opened in production if `FF_DEVTOOLS` env var is misconfigured.

**Fix:**
- Only allow DevTools when `!app.isPackaged` regardless of env var

```javascript
if (!app.isPackaged && (debugMode || enableDevTools)) {
    win.webContents.openDevTools();
}
```

**Acceptance Criteria:**
- [ ] DevTools never open in packaged builds
- [ ] DevTools still work in development when `FF_DEVTOOLS=true`

---

## Phase 2 — Stability & Data Integrity

> **Goal:** Prevent data corruption, memory leaks, and silent failures.

---

### Task 2.1 — Fix DataLoader Loading State Leak

**Audit Ref:** §4.3  
**Severity:** Medium  
**Files:** `src/lib/DataLoader.js`

**Problem:**  
`state.loading[url]` entries may not be deleted on fetch errors, causing subsequent loads for the same URL to hang.

**Fix:**
- Add `finally` block in `loadJSON()` to delete `state.loading[url]`
- Mirror the same pattern already used in `BaseDataService.initWithLoader()`

**Acceptance Criteria:**
- [ ] On fetch error, the loading entry is cleaned up
- [ ] Subsequent attempts to load the same URL are not blocked
- [ ] Unit test covers fetch failure + retry scenario

---

### Task 2.2 — Add Validation to `CharacterManager.updateCharacter()`

**Audit Ref:** §4.5, M2  
**Severity:** Medium  
**Files:** `src/app/CharacterManager.js`

**Problem:**  
`updateCharacter()` applies arbitrary key-value pairs to the character without checking keys or types. Mis-typed calls can silently corrupt character state.

**Fix:**
- Define an allowlist of updatable keys (e.g., `name`, `playerName`, `portrait`, `appearance.*`)
- Reject keys not in the allowlist with a `ValidationError`
- Run existing schema validation after applying updates

```javascript
const ALLOWED_UPDATE_KEYS = new Set(['name', 'playerName', 'portrait', ...]);

updateCharacter(updates) {
    for (const key of Object.keys(updates)) {
        if (!ALLOWED_UPDATE_KEYS.has(key)) {
            throw new ValidationError(`Invalid update key: ${key}`);
        }
    }
    // ...apply updates
}
```

**Acceptance Criteria:**
- [ ] Unknown keys throw `ValidationError`
- [ ] Valid keys apply correctly
- [ ] Unit tests cover valid updates, invalid key rejection

---

### Task 2.3 — Protect AppState from Direct Mutation

**Audit Ref:** §3.3, M1  
**Severity:** Medium  
**Files:** `src/app/AppState.js`

**Problem:**  
`getState()` returns a direct reference to the internal state object. Callers can bypass change detection: `AppState.getState().currentCharacter = null`.

**Fix:**
- Return a shallow copy from `getState()`: `return { ...this.state }`
- This preserves object references for nested values (Character is still the live object) but prevents top-level property reassignment

**Acceptance Criteria:**
- [ ] `getState()` returns a new object each call
- [ ] Mutating the returned object does not affect internal state
- [ ] Existing code using `getState()` still works (read-only access unchanged)
- [ ] Unit test verifies mutation isolation

---

### Task 2.4 — Add DataLoader Cache Bounds

**Audit Ref:** §7.1, M11  
**Severity:** Medium  
**Files:** `src/lib/DataLoader.js`

**Problem:**  
In-memory JSON cache has no size limit. Long sessions accumulate all loaded JSON indefinitely.

**Fix:**
- Adopt an LRU strategy similar to `MonsterService` (max 200 entries)
- Clear the entire cache on `DATA_INVALIDATED` events (already partially done)

**Acceptance Criteria:**
- [ ] Cache never exceeds configured max size
- [ ] Eviction of least-recently-used entries
- [ ] Data invalidation clears cache completely

---

### Task 2.5 — Consolidate ProficiencyService Data Structures

**Audit Ref:** §3.4, H3  
**Severity:** High  
**Files:** `src/services/ProficiencyService.js`, `src/app/Character.js`

**Problem:**  
Proficiency data lives in two parallel structures (`character.proficiencies[type][]` and `character.proficiencySources[type]` Map). Manual sync is fragile and error-prone.

**Fix:**
- Make `proficiencySources` (Map) the single source of truth
- Derive `proficiencies[type]` arrays from the Map via a getter or computed method
- Update all consumers to use the derived arrays

**Implementation Notes:**
This is a significant refactor. Core approach:
1. Add a `getProficienciesByType(type)` method to `Character` that derives from the Map
2. Change `ProficiencyService` to only write to the Map
3. Update consumers one at a time, keeping the old array available for backward compatibility during migration
4. Remove the array once all consumers use the derived getter

**Acceptance Criteria:**
- [ ] Single source of truth for proficiency data
- [ ] No possibility of array/Map desync
- [ ] All existing proficiency tests pass
- [ ] New test verifies derived arrays match Map contents

---

### Task 2.6 — Standardize Missing-Resource Error Pattern

**Audit Ref:** §3.5, §6.1, M13  
**Severity:** Medium  
**Files:** `src/services/BackgroundService.js` and any other service returning `null` for missing resources

**Problem:**  
`BackgroundService.getBackground()` returns `null` on missing backgrounds while `ClassService.getClass()`, `SpellService.getSpell()`, etc. throw `NotFoundError`. This inconsistency forces callers to handle two patterns.

**Fix:**
- All `get*()` methods in services should throw `NotFoundError` for missing resources
- Add to architecture docs: "Services throw `NotFoundError` for missing single-entity lookups. `null` return is only used for optional relationships (e.g., subrace on a race that has none)."
- Update affected callers to use try/catch

**Acceptance Criteria:**
- [ ] `BackgroundService.getBackground()` throws `NotFoundError` when background not found
- [ ] Any other services returning `null` for lookups are updated
- [ ] Architecture docs updated with error pattern guidelines
- [ ] Callers updated to handle the throw

---

### Task 2.7 — Document Error Strategy Selection Criteria

**Audit Ref:** §3.5, M14  
**Severity:** Medium  
**Files:** `docs/CODEBASE_ARCHITECTURE.md`

**Problem:**  
Three error strategies (throw, return object, log-and-continue) are used without documented selection criteria.

**Fix:**  
Add an "Error Strategy Guide" section to the architecture docs:

```markdown
## Error Strategy Guide

| Context | Strategy | Example |
|---------|----------|---------|
| Service-to-service calls | Throw custom error | `throw new NotFoundError(...)` |
| IPC boundaries (main↔renderer) | Return result object | `{ success: false, error: '...' }` |
| Best-effort operations (rehydration, validation) | Log and continue | `console.warn(...)` + partial results |
| User input validation | Throw ValidationError | `validateInput(schema, data)` |
```

**Acceptance Criteria:**
- [ ] Error strategy table added to architecture docs
- [ ] Each strategy has clear selection criteria and examples

---

## Phase 3 — Architecture & Code Quality

> **Goal:** Reduce complexity, eliminate duplication, and align with project conventions.

---

### Task 3.1 — Extract Spell Slot Calculation from SpellSelectionService

**Audit Ref:** §2.1, H1  
**Severity:** High  
**Files:** `src/services/SpellSelectionService.js` → new `src/services/SpellSlotCalculator.js`

**Problem:**  
`SpellSelectionService.js` (651 LOC) combines slot calculation, limit tracking, and selection recording.

**Fix:**
- Extract spell slot calculation logic into `SpellSlotCalculator.js`:
  - `calculateSpellSlots()`
  - `calculateMulticlassSpellSlots()`
  - `_getSpellSlotsFromClassData()`
  - `_getPactMagicSlotsFromData()`
  - The hardcoded `standardSlots` table
- `SpellSelectionService` imports and delegates to `SpellSlotCalculator`
- No public API changes — existing callers remain untouched

**Acceptance Criteria:**
- [ ] `SpellSlotCalculator.js` contains all slot calculation logic
- [ ] `SpellSelectionService` delegates to calculator
- [ ] All existing `SpellSelectionService` tests pass unchanged
- [ ] New unit tests added for `SpellSlotCalculator` in isolation

---

### Task 3.2 — Move Tag Stripping from ClassService to 5eToolsRenderer

**Audit Ref:** §2.3, §3.2, H2  
**Severity:** High  
**Files:** `src/services/ClassService.js`, `src/lib/5eToolsRenderer.js`

**Problem:**  
`ClassService._resolveTableOptions()` and `getFeatureEntryChoices()` implement custom regex tag stripping (`/{@\w+\s+([^|}]+)[^}]*}/g`) instead of using the existing `5eToolsRenderer.js` pipeline. This produces incorrect output for nested or escaped tags and duplicates logic.

**Fix:**
- Add a `stripTags(text)` utility to `5eToolsRenderer.js` (or expose the existing rendering pipeline as plain text)
- Replace regex tag stripping in `ClassService` with calls to `5eToolsRenderer.stripTags()`
- If `5eToolsRenderer` already has equivalent functionality, use it directly

**Acceptance Criteria:**
- [ ] No regex-based tag stripping in `ClassService`
- [ ] `5eToolsRenderer` exports a reusable `stripTags()` function
- [ ] All existing class feature rendering tests pass
- [ ] New test for `stripTags()` with nested/escaped tags

---

### Task 3.3 — Deduplicate BackgroundService Proficiency Normalization

**Audit Ref:** §2.2, §6.4, M3  
**Severity:** Medium  
**Files:** `src/services/BackgroundService.js`

**Problem:**  
Three near-identical methods: `_normalizeSkillProficiencies()`, `_normalizeToolProficiencies()`, `_normalizeLanguageProficiencies()`.

**Fix:**
- Replace with a single `_normalizeProficiencies(rawData, type)` method
- Pass the proficiency type as a parameter to handle any type-specific differences

```javascript
_normalizeProficiencies(rawData, type) {
    // Single implementation handling skills, tools, or languages
}
```

**Acceptance Criteria:**
- [ ] Single normalization method replaces three copies
- [ ] All `BackgroundService` tests pass
- [ ] Behavior is identical to the original three methods

---

### Task 3.4 — Consolidate Hit Dice Parsing in ClassService

**Audit Ref:** §2.2, M7  
**Severity:** Medium  
**Files:** `src/services/ClassService.js`

**Problem:**  
Hit dice parsing is implemented in both `_parseHitDice()` and inline regex in other methods.

**Fix:**
- Ensure all hit dice parsing routes through `_parseHitDice()`
- Remove inline regex duplicates
- Move the hardcoded `defaultHitDice` fallback table to a data file or constant module

**Acceptance Criteria:**
- [ ] Single code path for hit dice parsing
- [ ] `defaultHitDice` fallback is either loaded from data or clearly documented as a constant
- [ ] Unit tests cover parsing of all standard formats (`d6`, `d8`, `d10`, `d12`)

---

### Task 3.5 — Extract Data-Driven Ritual Casting and Spell Slots

**Audit Ref:** §3.6, M5, M6  
**Severity:** Medium  
**Files:** `src/services/SpellSelectionService.js`

**Problem:**  
- `_hasRitualCasting()` uses a hardcoded class list — breaks silently for new classes
- Standard spell slot progression table is hardcoded in code

**Fix:**
- Move the `_hasRitualCasting()` check to be data-driven: look for a `ritualCasting` property in class data from the JSON source
- Move the standard spell slot table to a data file or derive it from class data at initialization

**Acceptance Criteria:**
- [ ] Ritual casting is determined from class data, not a hardcoded list
- [ ] Standard spell slot table is loaded from data or clearly isolated as a migration constant
- [ ] New classes with ritual casting are detected automatically

---

### Task 3.6 — Break Down CharacterValidationService

**Audit Ref:** §2.1, H4  
**Severity:** High  
**Files:** `src/services/CharacterValidationService.js`

**Problem:**  
525 LOC validating 7+ categories in a single class.

**Fix:**
- Extract validation by category into focused helper modules:
  - `SpellValidator` — spell count, cantrip count, spell level validity
  - `ProgressionValidator` — subclass selection, ASI choices, feature selections
  - `EquipmentValidator` — (if applicable, or keep inline)
- `CharacterValidationService` orchestrates validators and builds the summary report
- Each validator is independently testable

**Acceptance Criteria:**
- [ ] `CharacterValidationService` delegates to focused validators
- [ ] Each validator has its own unit tests
- [ ] Validation report format is unchanged
- [ ] Existing tests pass

---

### Task 3.7 — Extract `resolveBackgroundEquipment()` from EquipmentService

**Audit Ref:** §2.1, H6  
**Severity:** Medium  
**Files:** `src/services/EquipmentService.js`

**Problem:**  
Single method is 115 lines handling 4+ data types (item refs, currency, equipment types, special items).

**Fix:**
- Extract into a focused `BackgroundEquipmentResolver` helper
- `EquipmentService` calls the resolver for background equipment operations
- Each data type handler becomes a named sub-method in the resolver

**Acceptance Criteria:**
- [ ] `resolveBackgroundEquipment()` delegates to focused handler methods
- [ ] No single method exceeds ~40 lines
- [ ] All existing equipment tests pass

---

### Task 3.8 — Define Proficiency Type Constants

**Audit Ref:** §6.1, L2  
**Severity:** Low  
**Files:** `src/services/ProficiencyService.js`, `src/lib/GameRules.js` or new constants file

**Problem:**  
Magic strings `'skills'`, `'savingThrows'`, `'weapons'`, `'tools'`, `'armor'`, `'languages'` repeated throughout ProficiencyService.

**Fix:**
- Define `PROFICIENCY_TYPES` constant object in `GameRules.js`:
```javascript
export const PROFICIENCY_TYPES = Object.freeze({
    SKILLS: 'skills',
    SAVING_THROWS: 'savingThrows',
    WEAPONS: 'weapons',
    TOOLS: 'tools',
    ARMOR: 'armor',
    LANGUAGES: 'languages',
});
```
- Replace all string literals in `ProficiencyService` with constant references

**Acceptance Criteria:**
- [ ] No magic strings for proficiency types in `ProficiencyService`
- [ ] Constants are importable from `GameRules.js`
- [ ] All proficiency tests pass

---

## Phase 4 — Testing, Performance & Documentation

> **Goal:** Fill coverage gaps, resolve performance concerns, and improve developer experience.

---

### Task 4.1 — Add Unit Tests for Untested Services

**Audit Ref:** §8.3, H7  
**Severity:** High  
**Files:** New test files in `tests/unit/`

**Coverage targets (ordered by risk):**

| Service | Priority | Key Test Scenarios |
|---------|----------|-------------------|
| `SourceService.js` | **High** | Source filtering by player options, allowed source expansion, banned source detection, character change handling |
| `AbilityScoreService.js` | **High** | Ability normalization, total score with bonuses, modifier calculation, racial ability choices |
| `MonsterService.js` | Medium | LRU cache eviction at max size, lazy loading, cache hits vs misses |
| `OptionalFeatureService.js` | Medium | Feature filtering by type, prerequisite checking delegation |
| `ProficiencyDescriptionService.js` | Medium | Source priority ordering (XPHB > PHB > others), lazy loading |
| `VariantRuleService.js` | Low | Lookup, missing rule error |
| `SettingsService.js` | Low | Get/set settings round-trip, initialization |

**Acceptance Criteria:**
- [ ] Test file created for each service
- [ ] Minimum 5 tests per service (happy path + error cases)
- [ ] `npm test` passes with all new tests
- [ ] Follow existing "should [action]" naming convention

---

### Task 4.2 — Add Unit Tests for DataLoader

**Audit Ref:** §8.3  
**Severity:** Medium  
**Files:** New `tests/unit/DataLoader.test.js`

**Key Test Scenarios:**
- Cache hit returns stored data without re-fetching
- Cache miss triggers `window.data.loadJSON()`
- Concurrent requests for same URL deduplicate
- Fetch failure cleans up loading state (after Task 2.1 fix)
- Cache invalidation clears all entries
- Cache bounds enforce LRU eviction (after Task 2.4)

**Acceptance Criteria:**
- [ ] ≥8 tests covering cache, deduplication, and error scenarios
- [ ] Mocks for `window.data.loadJSON`

---

### Task 4.3 — Add Unit Tests for BaseSelectorModal

**Audit Ref:** §8.3  
**Severity:** Medium  
**Files:** New `tests/unit/BaseSelectorModal.test.js`

**Key Test Scenarios:**
- Modal creation with default config
- Search filtering updates visible items
- Pagination renders correct page
- Single vs multiple selection mode behavior
- Selection limit enforcement
- `cleanup()` disposes all tracked resources
- Description fetching and caching

**Acceptance Criteria:**
- [ ] ≥10 tests covering core modal functionality
- [ ] Bootstrap modal properly mocked

---

### Task 4.4 — Optimize Spell Validation Performance

**Audit Ref:** §7.1, M9, M10  
**Severity:** Medium  
**Files:** `src/services/CharacterValidationService.js`, `src/services/SpellSelectionService.js`

**Problem:**  
- `_checkSpellsFromData()` calls `spellService.getSpell()` individually per spell (O(n))
- `getAvailableSpellsForClass()` iterates all spells on every call (O(n))

**Fix:**
- Add a batch method `spellService.getSpells(nameSourcePairs)` that returns all matches in a single pass
- Pre-compute class-to-spell mappings at initialization (already partially done via `_spellClassLookup`)
- Cache `getAvailableSpellsForClass()` results, invalidating on class/level change

**Acceptance Criteria:**
- [ ] Spell validation uses batch lookups
- [ ] Available spells are cached per class/level
- [ ] No functional changes to validation results

---

### Task 4.5 — Optimize HomePageController Re-rendering

**Audit Ref:** §7.1, M12  
**Severity:** Medium  
**Files:** `src/app/pages/HomePageController.js`

**Problem:**  
Full DOM rebuild of all character cards on every sort or filter change.

**Fix:**
- For sort changes: operate on existing DOM nodes by reordering them (DOM reorder is O(n) but avoids destroy/recreate)
- For filter changes: toggle visibility classes (`u-hidden`) on existing cards rather than rebuilding
- Only rebuild cards when the character list itself changes (add/delete/load)

**Acceptance Criteria:**
- [ ] Sorting reorders existing DOM nodes
- [ ] Filtering toggles visibility classes
- [ ] Card creation only happens on character list changes
- [ ] No perceived jank with 20+ characters

---

### Task 4.6 — Add Spellcasting Data Structure Schema Docs

**Audit Ref:** §9.4, L12  
**Severity:** Medium  
**Files:** `docs/CODEBASE_ARCHITECTURE.md`

**Problem:**  
`character.spellcasting` is deeply nested but has no schema documentation. Developers must read `SpellSelectionService` source code to understand the structure.

**Fix:**  
Add a "Spellcasting Data Model" section to the architecture docs:

```markdown
## Spellcasting Data Model

character.spellcasting = {
    classes: {
        [className]: {
            isKnownCaster: boolean,
            isPreparedCaster: boolean,
            isPactMagic: boolean,
            cantripsKnown: string[],
            spellsKnown: string[],
            preparedSpells: string[],
            spellSlots: {
                [level]: { current: number, max: number }
            }
        }
    }
}
```

**Acceptance Criteria:**
- [ ] Spellcasting structure documented with all fields and types
- [ ] Examples of known vs prepared caster structures
- [ ] Pact magic slot structure documented separately

---

### Task 4.7 — Add Error Strategy Section to Architecture Docs

**Audit Ref:** §3.5, §9.4  
**Severity:** Medium  
**Files:** `docs/CODEBASE_ARCHITECTURE.md`

**Problem:**  
Error strategy selection criteria (throw vs return vs log-and-continue) are not documented.

**Note:** This is the documentation component of Task 2.7. If Task 2.7 is completed, this is already done.

---

## Priority & Dependency Map

```
Phase 1 (Critical — do first, no dependencies)
├── 1.1  Fix Powerful Build bug
├── 1.2  Add download timeout
├── 1.3  Fix cache state leak
├── 1.4  Guard debug mode in production
└── 1.5  Guard DevTools in production

Phase 2 (Stability — after Phase 1)
├── 2.1  Fix DataLoader loading leak
├── 2.2  Validate CharacterManager updates
├── 2.3  Protect AppState from mutation
├── 2.4  Bound DataLoader cache                ← after 2.1
├── 2.5  Consolidate proficiency structures     ← largest refactor, can start in parallel
├── 2.6  Standardize missing-resource errors    ← after 2.7 (docs first)
└── 2.7  Document error strategy

Phase 3 (Architecture — after Phase 2)
├── 3.1  Extract SpellSlotCalculator            ← independent
├── 3.2  Move tag stripping to 5eToolsRenderer  ← independent
├── 3.3  Deduplicate background proficiencies   ← independent
├── 3.4  Consolidate hit dice parsing           ← independent
├── 3.5  Data-driven ritual casting / slots     ← after 3.1
├── 3.6  Break down CharacterValidationService  ← independent
├── 3.7  Extract BackgroundEquipmentResolver    ← independent
└── 3.8  Define proficiency type constants      ← before or with 2.5

Phase 4 (Testing & Polish — can start during Phase 3)
├── 4.1  Unit tests for 7 untested services     ← independent
├── 4.2  Unit tests for DataLoader              ← after 2.1, 2.4
├── 4.3  Unit tests for BaseSelectorModal       ← independent
├── 4.4  Optimize spell validation performance  ← after 3.1, 3.6
├── 4.5  Optimize HomePageController rendering  ← independent
├── 4.6  Spellcasting data model docs           ← after 3.1, 3.5
└── 4.7  Error strategy docs                    ← same as 2.7
```

---

## Items Explicitly Deferred

These audit findings are acknowledged but intentionally not prioritized in this plan:

| Issue | Reason for Deferral |
|-------|-------------------|
| **Character.js god object (M16)** | Splitting a 50-property mutable domain object is a major refactor with high regression risk. Address incrementally as services are refactored in Phase 3. |
| **CharacterSerializer manual serialization (M8)** | Current approach works correctly. Automate only if Character.js is refactored (Phase 3+). |
| **AppInitializer 504 LOC (M16)** | Initialization is correct; splitting adds risk for minimal benefit since it runs once and is covered by E2E tests. |
| **UI component unit tests (H8)** | 40+ files with DOM-heavy logic. Add incrementally as components are touched during Phases 2-3. |
| **IPC channel duplication (L3)** | Sync test already exists; risk is low. |
| **TextProcessor MutationObserver (L6)** | Single-page app lifetime makes cleanup unnecessary in practice. |
| **openExternal hostname restriction (L8)** | User-triggered action with http/https validation. Risk is negligible. |
| **RaceService module-level helpers (L1)** | Cosmetic; does not affect correctness or testability. |

---

## Validation Checklist

After completing each phase, verify:

- [ ] `npm test` — all unit tests pass
- [ ] `npm run test:e2e` — all E2E tests pass
- [ ] `npm run check:lint` — no new linting errors
- [ ] Manual smoke test: create character → set race with Powerful Build → verify carry capacity (Phase 1)
- [ ] Manual smoke test: reconfigure data source → cancel mid-download → retry (Phase 1)
- [ ] `npm run test:coverage` — coverage trending upward (Phase 4)

---

*End of action plan.*
