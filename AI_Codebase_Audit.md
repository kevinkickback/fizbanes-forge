# Codebase Audit — Fizbane's Forge

**Date:** 2026-03-07  
**Scope:** Full independent audit of all source, tests, configuration, and architecture  
**Stack:** Electron 34 · JavaScript (ES Modules) · Bootstrap 5 · Vitest · Playwright  
**Version Audited:** 0.3.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Code Quality & Complexity](#2-code-quality--complexity)
3. [Architecture & Design](#3-architecture--design)
4. [Workflow & Process Flaws](#4-workflow--process-flaws)
5. [Security & Compliance](#5-security--compliance)
6. [Best Practices & Standards](#6-best-practices--standards)
7. [Performance & Scalability](#7-performance--scalability)
8. [Testing & Coverage](#8-testing--coverage)
9. [Documentation](#9-documentation)

---

## 1. Executive Summary

Fizbane's Forge is a well-structured Electron application with a clear layered architecture (Main → Preload → Renderer), a robust service layer, and comprehensive Electron security hardening. The project demonstrates strong engineering discipline in several areas: context isolation, input validation schemas, standardized error classes, memory management via `DOMCleanup`, and a substantial test suite (815+ tests across 47 files).

However, the audit identified several categories of issues ranging from confirmed runtime bugs to architectural concerns that will compound as the project grows:

| Severity | Count | Summary |
|----------|-------|---------|
| **Critical** | 3 | Runtime bugs that cause incorrect behavior now |
| **High** | 8 | Security gaps, architectural violations, data integrity risks |
| **Medium** | 16 | Code quality issues, missing validation, complexity hotspots |
| **Low** | 12 | Style inconsistencies, minor improvements, documentation gaps |

**Top 3 areas requiring attention:**
1. Several confirmed runtime bugs (traits lookup, potential CSP violations)
2. Service layer complexity hotspots (3 services over 500 LOC each)
3. Test coverage gaps in 7+ services and all UI components

---

## 2. Code Quality & Complexity

### 2.1 Oversized Modules

Several modules significantly exceed reasonable single-responsibility budgets:

| File | LOC | Severity | Issue |
|------|-----|----------|-------|
| `src/services/SpellSelectionService.js` | 651 | **High** | Combines spell slot calculation, spell limit tracking, spell selection recording, and multiclass slot combination. Should be split into at least 3 focused modules (SlotCalculator, LimitManager, SelectionRecorder). |
| `src/services/ClassService.js` | 546 | **High** | Contains 5etools tag-stripping regex logic, hit dice parsing, feature choice extraction, and multiclass requirement parsing — mixing data access with parsing responsibilities. |
| `src/services/CharacterValidationService.js` | 525 | **High** | Validates class progression, spells, subclasses, feats, ASI choices, and generates summary reports — doing at least 4 distinct jobs. |
| `src/app/AppInitializer.js` | 504 | **Medium** | Handles data source validation, downloading, service initialization, UI bootstrapping, and debug setup. Mixed concerns make testing difficult. |
| `src/app/Character.js` | 494 | **Medium** | Mutable domain object with 50+ properties and behavioral methods spanning abilities, proficiencies, features, equipment, spellcasting, and appearance. Approaches "god object" territory. |
| `src/services/EquipmentService.js` | 484 | **Medium** | Single method `resolveBackgroundEquipment()` alone is 115 lines handling 4+ data types. |
| `src/app/CharacterSerializer.js` | 381 | **Medium** | Manual property-by-property serialization is repetitive and fragile — any new `Character` property requires a matching serializer update or data is silently lost on save/load round-trips. |

**Suggested improvement:** Extract focused sub-modules. For example, `SpellSelectionService` → `SpellSlotCalculator`, `SpellLimitService`, `SpellSelectionRecorder`. This reduces per-file cognitive load and improves testability.

### 2.2 Duplicated Logic

| Location | Description | Severity |
|----------|-------------|----------|
| `src/services/ClassService.js` | Hit dice parsing implemented twice: `_parseHitDice()` method AND inline regex in other methods. | **Medium** |
| `src/services/BackgroundService.js` | Three near-identical methods (`_normalizeSkillProficiencies`, `_normalizeToolProficiencies`, `_normalizeLanguageProficiencies`) with copy-pasted structure. Should be a single parameterized function. | **Medium** |
| `src/main/ipc/CharacterHandlers.js` + `FileHandlers.js` | Filename sanitization logic (removing non-alphanumeric characters) duplicated across handlers. | **Low** |
| `src/services/ItemService.js` | `getAllBaseItems()` and `getAllItems()` have nearly identical structure. | **Low** |
| `src/main/Preload.cjs` + `src/main/ipc/channels.js` | IPC channel name strings duplicated in both files. Although a sync test exists, inline duplication remains a maintenance risk. | **Low** |

### 2.3 Excessive Nesting & Complexity

| File | Function | Issue | Severity |
|------|----------|-------|----------|
| `src/services/ClassService.js` | `getFeatureEntryChoices()` | Performs 5etools DOM/data traversal with regex tag stripping — should delegate to `5eToolsRenderer.js` | **High** |
| `src/main/ipc/DataHandlers.js` | `refreshCurrentDataSource()` | 6 levels of nesting across ~110 lines | **Medium** |
| `src/services/SpellSelectionService.js` | `calculateSpellSlots()` | Pact magic vs standard casting mixed in a single branching method | **Medium** |
| `src/services/LevelUpService.js` | `checkMulticlassRequirements()` | OR/AND boolean logic mixing with unclear operator precedence | **Medium** |
| `src/services/CharacterValidationService.js` | `_parseChoiceCount()` | Multiple regex patterns that could match wrong counts in edge cases | **Low** |

### 2.4 Confirmed Runtime Bugs

| File | Line | Bug | Severity |
|------|------|-----|----------|
| `src/services/EquipmentService.js` | 297, 301 | **`character.traits?.includes('Powerful Build')` and `character.race?.traits?.includes('Powerful Build')` both fail.** `character.traits` does not exist (no such top-level property). `character.features.traits` is a `Map` (not an Array), so `.includes()` will throw `TypeError`. The correct check would be `character.features?.traits?.has('Powerful Build')`. Result: Powerful Build racial trait never applies to carry capacity. | **Critical** |
| `src/services/ClassService.js` | Various | `_resolveTableOptions()` strips 5etools tags using regex `/{@\w+\s+([^|}]+)[^}]*}/g` instead of using the existing `5eToolsRenderer.js` pipeline. This can produce incorrect output for nested or escaped tags. | **Medium** |
| `src/services/SpellSelectionService.js` | ~93 | `_hasRitualCasting()` contains a hardcoded class list. If new classes are added to the data source, this silently fails to grant ritual casting. | **Medium** |

---

## 3. Architecture & Design

### 3.1 Overall Architecture Assessment

The application follows a well-defined layered architecture:

```
Main Process (Node.js)
  ├── Main.js (lifecycle)
  ├── Window.js (BrowserWindow config)
  ├── Settings.js (electron-store preferences)
  ├── Data.js (data source management)
  └── ipc/ (handler registration)
       ↕ IPC via contextBridge
Renderer (Browser context)
  ├── AppInitializer.js (bootstrap)
  ├── AppState.js (shared state)
  ├── EventBus.js (pub/sub)
  ├── Services (data + operational)
  ├── Controllers (page lifecycle)
  └── UI Components (modals, cards)
```

**Strengths:**
- Clear separation between main and renderer processes
- Service layer enforces data access boundaries
- EventBus provides decoupled communication
- `DOMCleanup` provides systematic resource management
- `BaseSelectorModal` provides reusable modal infrastructure

**Weaknesses identified below.**

### 3.2 Data Normalization in Wrong Layer

| File | Issue | Severity |
|------|-------|----------|
| `src/services/BackgroundService.js` | `_normalizeBackgroundStructure()` performs data reshaping (legacy format conversion, proficiency normalization) inside the service layer. This should happen in `DataLoader` or a migration utility so that services receive pre-normalized data. | **Medium** |
| `src/services/ClassService.js` | Tag stripping and feature parsing duplicates logic that belongs in `5eToolsParser.js` or `5eToolsRenderer.js`. | **High** |

### 3.3 Mutable State Leaks

| File | Issue | Severity |
|------|-------|----------|
| `src/app/AppState.js` | `getState()` returns a direct reference to the internal state object. Callers can mutate state without triggering events: `AppState.getState().currentCharacter = null` bypasses all change detection. Should return a shallow copy or use `Object.freeze()`. | **Medium** |
| `src/app/Character.js` | Domain object is mutated in-place by multiple consumers (UI cards, services, controllers). While the architecture documents this pattern, it creates implicit coupling — any consumer can break invariants. | **Low** |

### 3.4 Dual Data Structures in ProficiencyService

`src/services/ProficiencyService.js` maintains proficiency data in two parallel structures: `character.proficiencies[type][]` (Array) and `character.proficiencySources[type]` (Map). These must be kept in sync manually. If they diverge, the UI will show stale or incorrect proficiency data.

**Severity:** High  
**Suggestion:** Consolidate to a single source-of-truth structure (e.g., the Map with derived arrays via getter).

### 3.5 Inconsistent Error Return Patterns

Three different error signaling strategies are used without clear rules for when to use which:

| Strategy | Used By | Pattern |
|----------|---------|---------|
| Throw custom errors | Most services (ClassService, SpellService, EquipmentService) | `throw new NotFoundError(...)` |
| Return error objects | CharacterImportService, IPC handlers | `{ success: false, error: string }` |
| Log and continue | CharacterValidationService, RehydrationService | `console.warn(...)` + partial results |

While each has valid use cases, the boundary rules are not documented. A developer adding a new service must guess which pattern applies.

**Severity:** Medium  
**Suggestion:** Document error strategy selection criteria (e.g., "Use throw for service-to-service; use return objects for IPC boundaries; use log-and-continue only for best-effort rehydration").

### 3.6 Hardcoded Game Data in Code

| File | Hardcoded Data | Risk | Severity |
|------|----------------|------|----------|
| `src/services/ClassService.js` | `defaultHitDice` fallback object for all classes | Breaks if new official classes are added to 5etools | **Medium** |
| `src/services/SpellSelectionService.js` | Full standard spell slot progression table (lines 260-280) | Duplicates PHB data; should be loaded from data files | **Medium** |
| `src/services/SpellSelectionService.js` | `_hasRitualCasting()` class list | Silently fails for new ritual-casting classes | **Medium** |
| `src/services/LevelUpService.js` | `DEFAULT_ASI_LEVELS` fallback | May not match all class progressions | **Low** |

---

## 4. Workflow & Process Flaws

### 4.1 Data Download Has No Timeout

`src/main/ipc/DataHandlers.js` initiates HTTP downloads for game data but implements no maximum timeout for individual file fetches or the overall download operation. On network failure or a slow/unresponsive server, the application will hang indefinitely.

**Severity:** High  
**Suggestion:** Add per-request timeouts (e.g., 30s) and an overall download timeout (e.g., 5 minutes).

### 4.2 DataHandlers Cache State Leak

`src/main/ipc/DataHandlers.js` tracks in-flight downloads in `state.loading[url]`. If a download fails, entries in this map may not be cleaned up, causing the URL to appear perpetually "loading" and preventing retry.

**Severity:** High  
**Suggestion:** Add `finally` cleanup block to remove `state.loading[url]` on both success and failure.

### 4.3 DataLoader Memory Leak

`src/lib/DataLoader.js` implements an in-memory JSON cache with no size limit or TTL. In a long-running session where the user reconfigures data sources multiple times, the cache can grow without bound. Additionally, `state.loading[url]` entries may not be deleted on fetch errors.

**Severity:** Medium  
**Suggestion:** Add a cache size limit (e.g., LRU with configurable max entries, similar to `MonsterService`'s approach) or clear the cache on data source change.

### 4.4 TextProcessor MutationObserver Never Disconnected

`src/lib/TextProcessor.js` creates a global `MutationObserver` that is never disconnected, even when the observed content is removed. While unlikely to cause issues in a single-page Electron app, this violates cleanup discipline and could cause subtle bugs during page transitions.

**Severity:** Low  
**Suggestion:** Add a `disconnect()` method and call it during page cleanup.

### 4.5 CharacterManager.updateCharacter() Lacks Validation

`src/app/CharacterManager.js` `updateCharacter()` applies key-value pairs to the character object without validating types or keys:

```javascript
for (const [key, value] of Object.entries(updates)) {
    character[key] = value; // No validation!
}
```

A call like `updateCharacter({ abilityScores: "invalid" })` would corrupt the character.

**Severity:** Medium  
**Suggestion:** Validate update keys against an allowlist or run schema validation after applying updates.

### 4.6 No Download Integrity Verification

`src/main/Data.js` downloads game data files from user-configured URLs but performs no integrity verification (checksums, signatures, or hash comparison). A MITM attacker on the network could inject malicious JSON payloads.

**Severity:** Medium  
**Suggestion:** Implement SHA256 checksum verification for downloaded files against a known manifest.

---

## 5. Security & Compliance

### 5.1 Electron Hardening — EXCELLENT

The application implements all recommended Electron security best practices:

| Control | Status | Location |
|---------|--------|----------|
| `contextIsolation: true` | ✅ Enabled | `src/main/Window.js` |
| `nodeIntegration: false` | ✅ Disabled | `src/main/Window.js` |
| `sandbox: true` | ✅ Enabled | `src/main/Window.js` |
| Navigation blocking | ✅ `will-navigate` blocked | `src/main/Window.js` |
| Popup blocking | ✅ `setWindowOpenHandler` denies | `src/main/Window.js` |
| Context bridge only | ✅ All IPC via `contextBridge` | `src/main/Preload.cjs` |
| IPC channel whitelist | ✅ Explicit channel definitions | `src/main/ipc/channels.js` |

### 5.2 Content Security Policy — STRONG (with minor violations)

CSP defined in `src/ui/index.html`:
```
default-src 'self';
script-src 'self' 'sha256-...';
style-src 'self';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
object-src 'none';
```

**Active CSP violations found in source code:**

| File | Line | Violation | Severity |
|------|------|-----------|----------|
| `src/app/pages/HomePageController.js` | 242, 245 | `el.style.backgroundImage = url(...)` — inline style assignment. While CSSOM (`.style.*`) is technically **not blocked** by `style-src 'self'` (CSP restricts `<style>` elements and `style=""` attributes, not CSSOM), this pattern circumvents the project's own stricter convention of avoiding `.style.*` for elements using utility classes. | **Low** |
| `src/app/pages/DetailsPageController.js` | 213, 249, 252, 271 | `el.style.backgroundImage = url(...)` — same pattern for ally/portrait images. | **Low** |

**Note:** The `.style.backgroundImage` usages are for dynamically setting user-provided portrait URLs. This is one of the project's documented exceptions ("For truly dynamic values, use CSSOM with a data-* attribute pattern"). However, the `data-*` attribute pattern mentioned in the convention is not actually used — the assignment is directly to `.style.backgroundImage`.

### 5.3 `openExternal()` URL Validation

`src/main/ipc/FileHandlers.js` validates that URLs start with `http://` or `https://` before calling `shell.openExternal()`. This correctly prevents `file://`, `javascript://`, and other dangerous schemes.

**Remaining risk:** No hostname restriction. URLs like `http://169.254.169.254/metadata` (cloud metadata endpoints) or `http://localhost:PORT` could be opened. In practice, this is low-risk since the user must trigger the action.

**Severity:** Low

### 5.4 DevTools Exposure in Debug Mode

`src/app/AppInitializer.js` exposes `window.__debug` with full EventBus access when `FF_DEBUG=true`. This includes the ability to emit arbitrary events, view event history, and access metrics. The guard correctly checks `window.FF_DEBUG === true` and removes the object when debug is disabled.

**Risk:** If `FF_DEBUG=true` is accidentally left in a `.env` file in a distributed build, internal state is exposed via DevTools. However, since `FF_DEVTOOLS` is a separate flag and DevTools are only opened programmatically, this risk is low in practice.

**Severity:** Low  
**Suggestion:** Add an `app.isPackaged` check in the main process to prevent debug mode in production builds regardless of `.env` settings.

### 5.5 IPC Handler Security — STRONG

| Handler File | Path Traversal Protection | Input Validation | Assessment |
|-------------|--------------------------|------------------|------------|
| CharacterHandlers.js | ✅ UUID whitelist regex + `path.resolve().startsWith()` | ✅ Schema validation, size limits | Strong |
| DataHandlers.js | ✅ `resolveSafePath()` with containment check | ✅ JSON-only restriction | Good (but complex) |
| FileHandlers.js | ✅ Three-tier allowlist roots | ✅ Extension whitelist, base64 validation | Excellent |
| PdfHandlers.js | ✅ Basename extraction + `.pdf` enforcement | ✅ Character data required | Strong |
| SettingsHandlers.js | N/A | ✅ Key allowlist + per-key type validators | Excellent |

### 5.6 Path Traversal in Settings

`src/main/Settings.js` stores `characterSavePath` without normalizing or validating that it doesn't escape expected directories. While the IPC handlers validate paths before operations, the setting itself accepts any string.

**Severity:** Low (mitigated by handler-level validation)

---

## 6. Best Practices & Standards

### 6.1 Naming Consistency

**Good patterns observed:**
- Services consistently use `PascalCase` class names with `Service` suffix
- Error classes follow `PascalCase` + `Error` suffix convention
- EventBus events use `UPPER_SNAKE_CASE` constants
- Test files use matching `*.test.js` names
- CSS uses `component-*`, `page-*`, `modal-*` prefixes

**Inconsistencies:**

| Issue | Location | Severity |
|-------|----------|----------|
| Module-level helper functions outside class | `src/services/RaceService.js` — 6 top-level helpers (`groupSubracesByRace`, `createRaceKey`, etc.) that should be private static methods | **Low** |
| Magic strings for proficiency types | `src/services/ProficiencyService.js` — `'skills'`, `'savingThrows'`, `'weapons'`, `'tools'`, `'armor'`, `'languages'` repeated throughout instead of using a constant enum | **Low** |
| Inconsistent null-vs-throw for missing resources | `BackgroundService.getBackground()` returns `null`; `ClassService.getClass()` throws `NotFoundError` | **Medium** |

### 6.2 File Organization

**Strengths:**
- Clear separation: `src/main/` (Node), `src/app/` (renderer core), `src/services/` (data layer), `src/lib/` (utilities), `src/ui/` (components + styles)
- 37 CSS files organized by component/page/modal category
- UI components grouped by feature domain (class/, race/, spells/, etc.)

**Concerns:**

| Issue | Severity |
|-------|----------|
| `src/app/pages/` controllers vs `src/ui/components/` — the boundary between "page controllers" and "UI components" is unclear. Both contain rendering logic and event handling. | **Low** |
| `src/lib/AbilityScoreUtils.js` contains D&D business logic (point buy costs, race ability parsing) that arguably belongs in `AbilityScoreService` or a shared rules module. | **Low** |

### 6.3 SOLID Principles Assessment

| Principle | Adherence | Notes |
|-----------|-----------|-------|
| **S**ingle Responsibility | ⚠️ Mixed | `SpellSelectionService`, `CharacterValidationService`, and `Character.js` violate SRP with multiple responsibilities per class. |
| **O**pen/Closed | ✅ Good | `BaseDataService` extension pattern, `BaseSelectorModal` configuration. Services are generally open for extension. |
| **L**iskov Substitution | ✅ Good | All services extending `BaseDataService` are substitutable. |
| **I**nterface Segregation | ⚠️ Partial | The `Character` class exposes ~50 properties to all consumers regardless of need. Services consume the full object when they only need a subset. |
| **D**ependency Inversion | ✅ Good | IPC handlers receive dependencies via constructor injection. Services depend on abstractions (EventBus, DataLoader). |

### 6.4 DRY Violations

| Location | Duplication | Severity |
|----------|-------------|----------|
| `BackgroundService.js` | Three proficiency normalization methods with identical structure | **Medium** |
| `ClassService.js` | Hit dice parsing in two separate code paths | **Medium** |
| `CharacterSerializer.js` | Property-by-property copy-paste serialization for 50+ fields | **Medium** |
| `CharacterHandlers.js` / `FileHandlers.js` | Filename sanitization regex duplicated | **Low** |

---

## 7. Performance & Scalability

### 7.1 Identified Performance Concerns

| File | Issue | Impact | Severity |
|------|-------|--------|----------|
| `src/services/CharacterValidationService.js` | `_checkSpellsFromData()` calls `spellService.getSpell()` individually for every spell in `spellsKnown`. For a high-level multiclass character with 30+ spells, this is O(n) individual lookups instead of a batch query. | Slow validation on spell-heavy characters | **Medium** |
| `src/services/SpellSelectionService.js` | `getAvailableSpellsForClass()` iterates ALL loaded spells and filters — O(n) where n = total spell count (hundreds). | Visible lag when opening spell selection modal | **Medium** |
| `src/app/pages/HomePageController.js` | Full DOM re-render on every sort or filter change. The entire character card list is rebuilt from scratch instead of using differential updates. | Jank with many saved characters | **Medium** |
| `src/services/EquipmentService.js` | `resolveBackgroundEquipment()` performs multiple `itemService.getItem()` lookups sequentially (4+ per background). | Slow background selection | **Low** |
| `src/lib/DataLoader.js` | No cache size limit — all loaded JSON stays in memory forever. A session that loads monster details, all spells, all items, etc. will accumulate significant memory. | Memory pressure in long sessions | **Medium** |

### 7.2 Positive Performance Patterns

| Pattern | Location | Notes |
|---------|----------|-------|
| LRU cache (max 100) | `MonsterService.js` | On-demand detail loading with eviction — good model for other large datasets |
| Promise deduplication | `BaseDataService.initWithLoader()` | Prevents duplicate data fetches during concurrent init |
| `requestAnimationFrame` batching | `TextProcessor.js` | Batches DOM processing to avoid layout thrashing |
| Lookup maps (O(1)) | All `BaseDataService` subclasses | Pre-computed Maps for name-based lookup |
| Notification debouncing | `Notifications.js` | 3-second deduplication window prevents toast spam |

### 7.3 Synchronous Blocking Risks

No significant synchronous blocking was found. All data loading uses async/await patterns. The application correctly uses `Promise.allSettled()` for parallel service initialization, allowing partial failures without blocking startup.

---

## 8. Testing & Coverage

### 8.1 Test Infrastructure

| Aspect | Details |
|--------|---------|
| **Unit Framework** | Vitest 2.1.9 + jsdom |
| **E2E Framework** | Playwright (Electron) |
| **Unit Test Count** | 815+ tests across 30 files |
| **E2E Test Count** | 17 spec files |
| **Naming Convention** | `should [action]` pattern — consistently applied |
| **Mocking** | `vi.fn()`, `vi.spyOn()`, `vi.clearAllMocks()` — clean patterns |
| **E2E Patterns** | `waitForSelector` over `waitForTimeout` — good stability |

### 8.2 Test Quality Assessment — GOOD

**Strengths:**
- Comprehensive happy-path and error-path testing
- Proper mock isolation with `beforeEach` cleanup
- Event emission verification via `vi.spyOn(eventBus, 'emit')`
- Structured helper functions (`createCharacterWithInventory()`, `createItemData()`)
- E2E tests use proper `finally` blocks for app cleanup
- E2E fixtures capture console output for debugging

**Weaknesses:**
- No snapshot tests for complex data structures (serialization output, validation reports)
- Limited boundary/edge-case testing in some services
- No mutation testing configured

### 8.3 Coverage Gaps

**Services WITHOUT unit tests (7 of 26):**

| Service | LOC | Risk Assessment |
|---------|-----|-----------------|
| `SettingsService.js` | 75 | Low risk (thin wrapper) |
| `SourceService.js` | 100+ | **Medium risk** — source filtering logic affects all data display |
| `MonsterService.js` | 100 | Low risk (LRU cache + simple lookup) |
| `AbilityScoreService.js` | 150 | **Medium risk** — ability score calculations are core game logic |
| `VariantRuleService.js` | 70 | Low risk (simple lookup) |
| `OptionalFeatureService.js` | 60 | Low risk (delegates to PrerequisiteValidator) |
| `ProficiencyDescriptionService.js` | 80 | Low risk (lookup + filter) |

**Other untested areas:**

| Area | File Count | Risk |
|------|------------|------|
| UI Components (cards, modals, views) | ~40 files | **High** — complex interactive logic untested |
| Page Controllers | 8 files | **Medium** — event handling and DOM coordination |
| `AppInitializer.js` | 1 file (504 LOC) | **Medium** — bootstrap sequence with many branches |
| `BaseSelectorModal.js` | 1 file (250+ LOC) | **Medium** — reusable foundation for all selection modals |
| `DataLoader.js` | 1 file | **Medium** — cache and loading deduplication logic |
| Main process files (Main.js, Window.js, Data.js) | 4 files | **Low** — covered by E2E tests indirectly |

### 8.4 E2E Coverage — COMPREHENSIVE

E2E tests cover all major user flows:
- ✅ App lifecycle (startup, shutdown)
- ✅ Character creation wizard (7 steps)
- ✅ Character persistence (save, load, delete)
- ✅ All page navigation
- ✅ Equipment, feats, spells management
- ✅ Level-up mechanics
- ✅ Theme settings
- ✅ Modal interaction patterns
- ✅ Notification system
- ✅ Home page sorting

### 8.5 Test Configuration

`vitest.config.js` correctly excludes `src/main/` (Node.js code) and `src/ui/` (DOM-heavy code) from unit test coverage reporting, focusing metrics on the testable service and lib layers.

---

## 9. Documentation

### 9.1 Architecture Documentation — EXCELLENT

`docs/CODEBASE_ARCHITECTURE.md` is a comprehensive 200+ line document covering:
- Layered overview with file references
- Startup sequence
- State and event flow with code examples (correct and incorrect patterns)
- Error handling strategy
- Service categories (data, operational, infrastructure)
- Character lifecycle
- Navigation and page system
- Feature crosswalk examples
- IPC boundaries
- Testing guidance
- Conventions and guardrails

This is significantly above average for a project of this size.

### 9.2 IPC Contract Documentation

`docs/IPC_CONTRACTS.md` documents all IPC channels, expected payloads, and return types — providing a clear API reference for main↔renderer communication.

### 9.3 Test Documentation

`tests/README.md` provides testing guidelines, naming conventions, and framework-specific patterns.

### 9.4 Documentation Gaps

| Gap | Severity |
|-----|----------|
| No API documentation for the service layer (method signatures, expected inputs, return types). Developers must read source code. | **Medium** |
| No contributor guide beyond the copilot instructions. Onboarding for human developers is undocumented. | **Low** |
| `src/services/SpellSelectionService.js` character.spellcasting data structure is deeply nested but has no schema documentation. The implicit contract is only discoverable by reading code. | **Medium** |
| Error strategy selection criteria (when to throw vs return error objects vs log-and-continue) not documented. | **Medium** |
| The `.env.example` file exists but is not referenced from the README. | **Low** |

### 9.5 Code Comments — APPROPRIATE

The codebase follows a good "comments only when non-obvious" discipline. Most code is self-documenting through clear naming. JSDoc is used sparingly for complex public APIs, which is correct — over-documentation would reduce maintainability.

---

## Appendix A: Full Issue Register

### Critical (Fix Now)

| # | File | Issue | Section |
|---|------|-------|---------|
| C1 | `src/services/EquipmentService.js:297,301` | `character.traits?.includes()` and `character.race?.traits?.includes()` — `traits` is a `Map` at `character.features.traits`, not an Array. `.includes()` will throw TypeError. Powerful Build never applies. | §2.4 |
| C2 | `src/main/ipc/DataHandlers.js` | Download cache entries (`state.loading[url]`) not cleaned up on network errors — causes permanent "loading" state preventing retry | §4.2 |
| C3 | `src/main/ipc/DataHandlers.js` | No timeout on HTTP downloads — app hangs indefinitely on network failure | §4.1 |

### High (Fix Soon)

| # | File | Issue | Section |
|---|------|-------|---------|
| H1 | `src/services/SpellSelectionService.js` | 651 LOC — combines 3 responsibilities; difficult to test and maintain | §2.1 |
| H2 | `src/services/ClassService.js` | Reimplements 5etools tag parsing with regex instead of using `5eToolsRenderer.js` | §2.3 |
| H3 | `src/services/ProficiencyService.js` | Dual data structures (Array + Map) require manual sync — data integrity risk | §3.4 |
| H4 | `src/services/CharacterValidationService.js` | 525 LOC — validates 7+ categories in a single class | §2.1 |
| H5 | `src/main/Data.js` | No integrity verification (checksums) on downloaded data files | §4.6 |
| H6 | `src/services/EquipmentService.js` | `resolveBackgroundEquipment()` at 115 lines handles 4+ data types in one method | §2.1 |
| H7 | 7 services | Missing unit tests for `SourceService`, `AbilityScoreService`, and 5 others | §8.3 |
| H8 | ~40 UI component files | No unit tests for any UI components (cards, modals, views) | §8.3 |

### Medium (Plan Fix)

| # | File | Issue | Section |
|---|------|-------|---------|
| M1 | `src/app/AppState.js` | `getState()` returns mutable reference — bypasses change detection | §3.3 |
| M2 | `src/app/CharacterManager.js` | `updateCharacter()` applies updates without validation | §4.5 |
| M3 | `src/services/BackgroundService.js` | Three near-identical proficiency normalization methods | §6.4 |
| M4 | `src/services/ClassService.js` | Hardcoded `defaultHitDice` fallback breaks with new classes | §3.6 |
| M5 | `src/services/SpellSelectionService.js` | Hardcoded standard spell slot progression table | §3.6 |
| M6 | `src/services/SpellSelectionService.js` | `_hasRitualCasting()` hardcoded class list | §3.6 |
| M7 | `src/services/ClassService.js` | Duplicated hit dice parsing in two code paths | §2.2 |
| M8 | `src/app/CharacterSerializer.js` | Manual property-by-property serialization — fragile and repetitive | §2.1 |
| M9 | `src/services/CharacterValidationService.js` | O(n) individual spell lookups instead of batch query | §7.1 |
| M10 | `src/services/SpellSelectionService.js` | O(n) spell iteration in `getAvailableSpellsForClass()` | §7.1 |
| M11 | `src/lib/DataLoader.js` | No cache size limit — unbounded memory growth | §7.1 |
| M12 | `src/app/pages/HomePageController.js` | Full DOM re-render on every sort/filter change | §7.1 |
| M13 | `src/services/BackgroundService.js` | `getBackground()` returns `null` while peers throw `NotFoundError` | §6.1 |
| M14 | Multiple services | Error strategy (throw vs return vs log-and-continue) not documented | §3.5 |
| M15 | Service layer | ~60-70% of public service methods lack `validateInput()` schema checks | §6.1 |
| M16 | `src/app/AppInitializer.js` | 504 LOC with mixed data/UI/debug concerns | §2.1 |

### Low (Improve When Convenient)

| # | File | Issue | Section |
|---|------|-------|---------|
| L1 | `src/services/RaceService.js` | 6 module-level helper functions should be private methods | §6.1 |
| L2 | `src/services/ProficiencyService.js` | Magic strings for proficiency types — should use constants | §6.1 |
| L3 | `src/main/Preload.cjs` + `channels.js` | IPC channel names duplicated in two files | §2.2 |
| L4 | `CharacterHandlers.js` + `FileHandlers.js` | Filename sanitization logic duplicated | §2.2 |
| L5 | `src/services/ItemService.js` | `getAllBaseItems()` / `getAllItems()` near-identical structure | §2.2 |
| L6 | `src/lib/TextProcessor.js` | Global MutationObserver never disconnected | §4.4 |
| L7 | `src/main/Window.js` | DevTools flag doesn't check `app.isPackaged` — could leak in production builds | §5.4 |
| L8 | `src/main/ipc/FileHandlers.js` | `openExternal()` accepts any HTTP URL without hostname restriction | §5.3 |
| L9 | `src/app/pages/HomePageController.js` | `.style.backgroundImage` usage without `data-*` attribute pattern | §5.2 |
| L10 | `src/app/pages/DetailsPageController.js` | `.style.backgroundImage` usage without `data-*` attribute pattern | §5.2 |
| L11 | No contributor guide | Human developer onboarding not documented | §9.4 |
| L12 | `src/services/SpellSelectionService.js` | Spellcasting data structure has no schema documentation | §9.4 |

---

## Appendix B: Metrics Summary

| Metric | Value |
|--------|-------|
| Total source files (src/) | ~110 |
| Total LOC (services) | ~4,574 |
| Total LOC (lib) | ~2,800 |
| Total LOC (app core) | ~2,200 |
| Total LOC (main process) | ~1,400 |
| Total CSS files | 37 |
| Total unit tests | 815+ |
| Total unit test files | 30 |
| Total E2E test files | 17 |
| Services with unit tests | 19/26 (73%) |
| Services without unit tests | 7 (27%) |
| UI components with unit tests | 2/~40 (5%) |
| Dependencies (runtime) | 5 |
| Dependencies (dev) | 7 |

---

*End of audit.*
