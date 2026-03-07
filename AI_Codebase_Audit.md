# Fizbane's Forge — Independent Codebase Audit (Archived)

> **Note:** The actionable remediation plan derived from this audit is in [AI_Remediation_Plan.md](AI_Remediation_Plan.md).

**Date:** 2025-03-06  
**Scope:** Full codebase (134 source files, ~52,360 lines JS/CJS; 48 test files, ~11,896 lines)  
**Framework:** Electron 34 + Bootstrap 5, ESM (renderer), CJS (main/preload)  
**Auditor:** Automated analysis with manual file-level review

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
10. [Summary Scoreboard](#10-summary-scoreboard)

---

## 1. Executive Summary

Fizbane's Forge is a well-structured Electron application with **strong security hardening**, **excellent architecture documentation**, and **consistent patterns** across its service layer. The codebase demonstrates disciplined use of a centralized event bus, memory cleanup utilities, and a layered service architecture.

**Key Strengths:**
- Electron security best practices consistently applied (contextIsolation, sandbox, CSP, IPC whitelist)
- Clean service layer with BaseDataService pattern, input validation, and standardized error classes
- DOMCleanup utility rigorously used for memory management
- Comprehensive architecture documentation (~700 lines)
- 815 unit tests with clear naming conventions

**Key Concerns:**
- Monolithic UI components (ClassCard.js at 3,036 lines)
- Inline style manipulation violating declared CSP policy
- Inconsistent error handling patterns (throw vs. return vs. log)
- Missing input validation on settings values
- Several files exceed reasonable size bounds, increasing maintenance burden

**Overall Rating: 7.0/10** — Production-ready with targeted improvements needed.

---

## 2. Code Quality & Complexity

### 2.1 Monolithic Components

| File | Lines | Severity | Description |
|------|-------|----------|-------------|
| `src/ui/components/class/ClassCard.js` | 3,036 | **High** | Handles class selection, subclass picking, spell selection, ASI/feat choices, feature rendering, and hover panels all in one file. Contains 50+ methods with several exceeding 200 lines. |
| `src/ui/components/proficiencies/ProficiencyCard.js` | 1,584 | **High** | Manages all proficiency categories (skills, languages, tools, armor, weapons) in a single component. |
| `src/ui/components/race/RaceCard.js` | 970 | **Medium** | Race selection + trait display + subrace management combined. |
| `src/ui/components/background/BackgroundCard.js` | 924 | **Medium** | Background selection + equipment resolution + info panel. |
| `src/services/ProficiencyService.js` | ~600 | **Medium** | Manages skills, languages, tools, armor, weapons — violates Single Responsibility Principle. |
| `src/services/AbilityScoreService.js` | ~600 | **Medium** | Point buy, standard array, racial bonuses, and ability choice tracking in one service. |

**Suggested Improvement:** Extract `ClassCard.js` into at least 4 components: `ClassSelector`, `SubclassSelector`, `FeatureChoiceRenderer`, and `SpellSelectionCoordinator`. Split `ProficiencyService` into dedicated sub-modules per proficiency type.

### 2.2 Large Functions

| File | Function | Est. Lines | Severity |
|------|----------|------------|----------|
| `src/app/AppInitializer.js` | `initializeAll()` | ~300 | **High** |
| `src/ui/components/class/ClassCard.js` | `_renderClassChoices()` | ~400 | **High** |
| `src/ui/components/class/ClassCard.js` | `_getClassChoicesAtLevel()` | ~350 | **High** |
| `src/ui/components/class/ClassCard.js` | `_updateClassChoices()` | ~250 | **High** |
| `src/main/ipc/CharacterHandlers.js` | `CHARACTER_IMPORT` handler | ~150 | **Medium** |
| `src/main/Data.js` | `validateLocalDataFolder()` | ~110 | **Medium** |
| `src/app/Character.js` | constructor | ~150 | **Medium** |
| `src/app/CharacterSerializer.js` | `serialize()` | ~200 | **Medium** |

**Suggested Improvement:** Break `initializeAll()` into staged methods (`_loadCoreServices`, `_loadGameData`, `_initializeUI`). Decompose ClassCard's rendering into composable render functions.

### 2.3 Duplicated Logic

| Pattern | Locations | Severity |
|---------|-----------|----------|
| Prerequisite checking (level, ability, class, spellcasting) | `FeatService.isFeatValidForCharacter()`, `OptionalFeatureService.meetsPrerequisites()` | **Medium** |
| Feature choice detection via string parsing | `ClassService.getFeatureEntryChoices()`, `CharacterValidationService._checkFeatureChoice()` | **Medium** |
| Legacy data normalization | `BackgroundService`, `RaceService`, `ProficiencyService` | **Low** |
| Modal body/overflow reset | `AppInitializer`, `ModalCleanupUtility`, `SetupModals` (3 places) | **Low** |
| PDF field mapping (skill maps) | `FieldMapping.js` MPMB vs. WotC templates duplicate 18 skill entries | **Low** |

**Suggested Improvement:** Extract a shared `PrerequisiteValidator` utility. Centralize modal cleanup to `ModalCleanupUtility` only.

### 2.4 Hardcoded Constants Scattered Across Codebase

| Constant | Location(s) | Severity |
|----------|-------------|----------|
| Standard ability array `[15,14,13,12,10,8]` | `AbilityScoreService` | **Low** |
| Point buy range `[8-15]`, cost table | `AbilityScoreService` | **Low** |
| Spell slot progression table (20 rows) | `SpellSelectionService.getStandardSpellSlots()` | **Low** |
| Pact magic slot table (20 rows) | `SpellSelectionService._getPactMagicSlots()` | **Low** |
| `MAX_ATTUNEMENT_SLOTS = 3` | `EquipmentService` | **Low** |
| `CARRY_CAPACITY_MULTIPLIER = 15` | `EquipmentService` | **Low** |
| Banned sources `['MPMM', 'AAG', 'BGG', ...]` | `SourceService` | **Low** |
| Fallback ASI levels `[4, 8, 12, 16, 19]` | `LevelUpService` | **Low** |
| `MAX_CHARACTER_SIZE = 10MB` | `CharacterHandlers.js` | **Low** |

**Suggested Improvement:** Extract D&D game rule constants into a dedicated `src/lib/GameRules.js` module for centralized maintenance.

---

## 3. Architecture & Design

### 3.1 Layered Architecture — Well Implemented

The project follows a clear three-layer architecture:

```
Main Process (src/main/)     → Window lifecycle, IPC, file I/O, settings
    ↕ IPC Bridge (Preload.cjs)
Renderer Process
    ├─ Services (src/services/) → Data access, business logic, state
    ├─ App Layer (src/app/)     → App state, navigation, serialization
    └─ UI Layer (src/ui/)       → Components, rendering, styles
```

**Verdict:** Architecture is clean and well-documented. The separation of concerns is enforced by the Electron process boundary and consistently followed.

### 3.2 Service Layer Design

**Strengths:**
- `BaseDataService` provides consistent initialization, lookup maps, event cleanup, and deduplication of parallel init calls — used by 15 of 25 services.
- All 25 services export singletons, ensuring single data loads.
- 20/25 services use Zod schemas via `validateInput()` for parameter validation.
- Standardized error classes (`NotFoundError`, `ValidationError`, `DataError`) from `src/lib/Errors.js`.

**Weaknesses:**

| Issue | Severity | Description |
|-------|----------|-------------|
| Singleton testing difficulty | **Medium** | All services export singletons (`export const fooService = new FooService()`). Mocking requires `vi.mock()` module replacement rather than constructor injection. |
| No orchestration layer | **Medium** | Multi-service operations (level-up, character creation) are coordinated by UI components or standalone services with tight coupling. Consider a `CharacterBuildOrchestrator`. |
| Service coupling depth | **Medium** | `LevelUpService` → 3 services, `CharacterValidationService` → 3 services, `RehydrationService` → 3 services. No circular deps currently, but graph is dense. |
| Missing validation in orchestrators | **Low** | `CharacterValidationService`, `RehydrationService`, `ProgressionHistoryService` don't validate their `character` parameter. |

### 3.3 State Management

**AppState (`src/app/AppState.js`)** — Simple centralized state with EventBus broadcast on mutations. ~50 lines, clean.

**Concerns:**

| Issue | Severity | Description |
|-------|----------|-------------|
| No immutability enforcement | **Medium** | `AppState.getCurrentCharacter()` returns a mutable reference. External code can mutate without triggering events. |
| No transaction/rollback support | **Medium** | Multi-step operations (e.g., level-up: update class → update spells → update proficiencies) can leave partial state on failure. |
| Race condition risk | **Low** | `CharacterManager.isLoadingCharacter` flag has no timeout protection. A hung IPC call leaves the flag true permanently. |

### 3.4 Event System

`EventBus` wraps `EventEmitter3` with debug logging, leak detection, and event history. Events are string constants centralized in `src/lib/EventBus.js`.

**Concern:** No TypeScript or JSDoc-typed event catalog. Events are magic strings spread across the codebase. A central events registry with payload types would improve discoverability.

---

## 4. Workflow & Process Flaws

### 4.1 Error Handling Inconsistencies

The codebase uses **three different error patterns**, sometimes within the same module:

| Pattern | Used By | Issue |
|---------|---------|-------|
| Throw typed errors (`NotFoundError`, `ValidationError`) | Most services | Correct pattern |
| Return `{ success: false, error: string }` | IPC handlers, `CharacterImportService` | Breaks exception contract; callers must check `.success` |
| Log warning and continue silently | `CharacterValidationService`, `RehydrationService`, `ProficiencyService` | Masks failures; hard to debug |

**Severity:** **Medium**  
**Suggested Improvement:** Standardize on throwing errors in services; use structured responses only at the IPC boundary. Add middleware to convert service exceptions to IPC response objects.

### 4.2 IPC Channel Duplication

IPC channel names are defined in `src/main/ipc/channels.js` **and** hardcoded in `src/main/Preload.cjs`. A unit test verifies synchronization, but this is a maintenance risk.

**Severity:** **Medium**  
**Suggested Improvement:** Have `Preload.cjs` import from `channels.js` (requires CJS/ESM bridging), or generate one from the other in the build step.

### 4.3 Silent Failures in File Operations

| Handler | Issue | Severity |
|---------|-------|----------|
| `FILE_EXISTS` | Returns `{ exists: false }` on permission errors — indistinguishable from "not found" | **Low** |
| `DATA_FILE_EXISTS` | Same pattern | **Low** |
| `DATA_LOAD_JSON` | Catches read errors, returns structured error instead of propagating | **Low** |

### 4.4 Settings Value Validation Gap

`SettingsHandlers.js` validates setting **keys** against an `ALLOWED_KEYS` whitelist but does **not validate values**. The renderer can set `autoSaveInterval` to `-1`, `0`, or `999999` without checks.

**Severity:** **Medium**  
**Suggested Improvement:** Add value validation per key (ranges, enums) in the handler or delegate to `Settings.js` schema validation.

### 4.5 Schema Permissiveness

`CharacterSchema.js` uses `.passthrough()` on the Zod validation schema, which allows unknown properties to pass validation. This defeats part of the schema's purpose and could allow malformed data to persist.

Several properties use `z.unknown()` (e.g., `race`, `background`, `features`, `equipment`) — providing structure validation for the top level but no validation for nested data.

**Severity:** **Medium**  
**Suggested Improvement:** Remove `.passthrough()` and define stricter nested schemas, or use `.strict()` to reject unknown keys.

---

## 5. Security & Compliance

### 5.1 Electron Hardening — Excellent

| Control | Status | Notes |
|---------|--------|-------|
| `contextIsolation: true` | ✅ Applied | Renderer has no access to Node APIs |
| `nodeIntegration: false` | ✅ Applied | `require()` blocked in renderer |
| `sandbox: true` | ✅ Applied | Additional process isolation |
| Preload whitelist | ✅ Applied | Only explicit IPC methods exposed via `contextBridge` |
| Navigation blocked | ✅ Applied | `will-navigate` prevented; `setWindowOpenHandler` returns deny |
| No `remote` module | ✅ Confirmed | Not imported anywhere |
| No `eval()` or `new Function()` | ✅ Confirmed | Not found in codebase |
| No `webSecurity: false` | ✅ Confirmed | Default secure |

### 5.2 Content Security Policy

```html
default-src 'self';
script-src 'self' 'sha256-fL88hGdHNPru1EmXHDYzI3DSaRgYHHpdbj9zLhBV3Rs=';
style-src 'self';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self';
object-src 'none';
base-uri 'self'
```

**CSP Assessment:** Strong policy. `object-src 'none'` blocks plugins. No `unsafe-inline` or `unsafe-eval`. The one script hash is for an `<script type="importmap">` block (safe, no executable code).

### 5.3 CSP Violations — Inline Styles

The CSP declares `style-src 'self'` (no inline styles), but **32 instances of `.style.*` manipulation** exist in the codebase:

| File | Instances | Concern |
|------|-----------|---------|
| `src/ui/rendering/TooltipManager.js` | 5 | `.style.left`, `.style.top`, `.style.zIndex` — dynamic positioning |
| `src/app/pages/HomePageController.js` | 4 | `.style.display`, `.style.backgroundImage` |
| `src/app/pages/DetailsPageController.js` | 4 | `.style.backgroundImage` |
| `src/ui/components/setup/SetupDataConfiguration.js` | 4 | `.style.width` for progress bars |
| `src/ui/components/setup/SetupModals.js` | 3 | `.style.overflow`, `.style.width` |
| `src/lib/Notifications.js` | 2 | `.style.width` for progress bars |
| `src/lib/ModalCleanupUtility.js` | 2 | `.style.overflow`, `.style.paddingRight` |
| `src/app/AppInitializer.js` | 2 | `.style.overflow`, `.style.paddingRight` |
| `src/ui/components/selection/FilterBuilder.js` | 2 | `.style.cursor` |
| Other files | 4 | Various `.style.*` usage |

**Severity:** **Medium**  
**Note:** CSSOM (`.style.*` in JS) is technically separate from inline `style=""` attributes and is **not blocked by CSP `style-src`**. The CSP only blocks `<style>` elements and `style=""` attributes in HTML. So these are **not actual CSP violations** — but they bypass the utility-class pattern the project declares as a convention, and some (like `.style.display`) can conflict with `!important` in utility CSS classes.

**Suggested Improvement:** Replace `.style.display` usage with `classList.add/remove('u-hidden')`. For truly dynamic values (positions, progress widths, background images), CSSOM usage is acceptable. Document this distinction in conventions.

### 5.4 Path Traversal Protection

| Handler | Protection | Assessment |
|---------|------------|------------|
| `FileHandlers.js` | `resolveUnderAllowedRoots()` — whitelist of allowed directories | ✅ Strong |
| `CharacterHandlers.js` | `SAFE_ID_PATTERN` regex + `startsWith()` check | ✅ Strong |
| `DataHandlers.js` | `resolveSafePath()` strips prefix + `startsWith()` check | ⚠️ Adequate but doesn't check symlinks |
| `PdfHandlers.js` | `resolveTemplatePath()` + forced `.pdf` extension | ✅ Strong |

### 5.5 URL Handling

`shell.openExternal()` in `FileHandlers.js` validates URLs start with `http://` or `https://`, but does not restrict hostnames. A crafted URL like `http://localhost:9999/malicious` or `http://169.254.169.254/metadata` could be opened.

**Severity:** **Low** (requires user to trigger; Electron is a desktop app, not a web server)  
**Suggested Improvement:** Consider restricting to known domains or adding a user confirmation dialog.

### 5.6 File Size Validation

| Operation | Size Check | Issue |
|-----------|-----------|-------|
| Character import (`CHARACTER_IMPORT`) | `MAX_CHARACTER_SIZE` (10MB) checked **after** `JSON.parse()` | **Low** — the file is fully read and parsed before size is validated. Check `stat().size` before reading. |
| Portrait embedding (`embedPortraitData`) | No size limit | **Medium** — Could load an arbitrarily large file into memory. |
| PDF portrait embedding (`PdfExporter`) | No size limit | **Medium** — Same concern. |

### 5.7 Dependency Review

| Dependency | Version | Assessment |
|------------|---------|------------|
| `electron` | ^34.3.0 | Current major — ✅ |
| `bootstrap` | ^5.3.2 | Current — ✅ |
| `zod` | ^4.3.5 | Current — ✅ |
| `dotenv` | ^17.2.4 | Current — ✅ |
| `electron-store` | ^11.0.2 | Maintained — ✅ |
| `pdf-lib` | ^1.17.1 | Last GitHub release May 2023, low activity — ⚠️ Monitor |
| `pdfjs-dist` | ^4.10.38 | Mozilla-maintained, active — ✅ |
| `uuid` | ^9.0.1 | Current — ✅ |
| `eventemitter3` | ^5.0.4 | Stable, minimal — ✅ |

**No known CVEs** in the current dependency tree at time of audit.

---

## 6. Best Practices & Standards

### 6.1 Naming Conventions

| Area | Convention | Compliance |
|------|-----------|------------|
| Files | PascalCase for classes, camelCase for utilities | ✅ Consistent |
| Classes | PascalCase | ✅ Consistent |
| Methods | camelCase, `_` prefix for private | ✅ Consistent |
| Constants | UPPER_SNAKE_CASE | ✅ Consistent |
| Events | UPPER_SNAKE_CASE in EventBus | ✅ Consistent |
| CSS | BEM-like with `u-` prefix for utilities | ✅ Consistent |
| IPC Channels | `category:action` format | ✅ Consistent |

### 6.2 Module Organization

- **Services:** One service per file, singleton export, consistent `initialize()` → `getX()` → `dispose()` lifecycle — ✅ Good
- **Components:** Generally one component per file, but several are too large (see §2.1) — ⚠️ Needs splitting
- **Pages:** Controller per page with `BasePageController` abstract class — ✅ Good
- **IPC:** Handlers grouped by domain (Character, Data, File, Pdf, Settings) — ✅ Good

### 6.3 SOLID Principles Assessment

| Principle | Compliance | Notes |
|-----------|-----------|-------|
| **S** — Single Responsibility | ⚠️ Partial | `ClassCard.js` and `ProficiencyService.js` violate; most other modules comply |
| **O** — Open/Closed | ✅ Good | `BaseDataService` extensible; `BaseSelectorModal` pattern reusable |
| **L** — Liskov Substitution | ✅ Good | Service hierarchy respects contracts |
| **I** — Interface Segregation | ✅ Good | Services expose focused public APIs |
| **D** — Dependency Inversion | ⚠️ Partial | Singleton exports create tight coupling; no DI container |

### 6.4 DRY Principle

Moderate compliance. Main violations:
- Prerequisite checking duplicated across services (see §2.3)
- Modal body/overflow reset in 3 places
- PDF field mappings have duplicated skill entries for 2 templates
- Data format normalization repeated across 3 services

### 6.5 Code Formatting

Biome.js enforced with tabs, consistent rules. ESM for renderer, CJS for main/preload (Electron requirement). No formatting inconsistencies observed.

---

## 7. Performance & Scalability

### 7.1 Data Loading

`AppInitializer.initializeAll()` initializes 13 services. Most services use `Promise.allSettled()` for parallel data loading — ✅ Good.

**Concern:** Service initialization order is sequential in the initializer but data loading within services is parallel. Some services depend on others being loaded first (e.g., `FeatService` depends on `ClassService`), but this dependency is implicit rather than explicit.

**Severity:** **Low**  
**Suggested Improvement:** Document service initialization order; consider explicit dependency declaration.

### 7.2 Memory Patterns

| Pattern | Assessment |
|---------|------------|
| `BaseDataService` holds all loaded data in memory | ✅ Acceptable for game data sizes (~50MB JSON total) |
| `MonsterService` uses LRU cache (100 entries) | ✅ Good — prevents unbounded growth |
| `DataLoader` deduplicates concurrent requests | ✅ Good — prevents duplicate loads |
| `NavigationController` caches page templates indefinitely | ⚠️ Minor — templates never evicted, but count is bounded (7 pages) |
| `CharacterSerializer` creates intermediate objects | ⚠️ Minor — not streaming, but character data is small |

### 7.3 DOM Performance

| Pattern | Assessment |
|---------|------------|
| `TextProcessor` uses `requestAnimationFrame` batching | ✅ Good |
| `TextProcessor` uses `MutationObserver` for dynamic content | ✅ Good |
| `EventBus._checkForListenerLeaks()` runs on every registration | ⚠️ Minor — could debounce |
| `ClassCard` rebuilds large DOM trees on every choice change | ⚠️ Medium — consider diffing or virtual lists for large option sets |
| Tooltip positioning uses CSSOM (`.style.left/top`) | ✅ Acceptable for tooltip count |

### 7.4 No Identified N+1 or Unbounded Loop Issues

Service lookups use O(1) maps via `buildLookupMap()`. No database queries. File I/O is bounded by user-initiated actions.

---

## 8. Testing & Coverage

### 8.1 Test Inventory

| Category | Files | Tests | Lines |
|----------|-------|-------|-------|
| Unit (Vitest + jsdom) | 30 | 815 | ~10,500 |
| E2E (Playwright + Electron) | 18 | Variable | ~1,400 |
| **Total** | **48** | **815+** | **~11,896** |

**Test-to-Source Ratio:** ~0.23 (11,896 test lines / 52,360 source lines) — adequate for this project type.

### 8.2 Test Quality

**Strengths:**
- Consistent `should [action]` naming convention
- Proper use of `vi.mock()` for dependency isolation
- Both success and failure paths tested in `CharacterManager` tests
- Edge cases covered: null, undefined, empty strings, missing resources
- `DOMCleanup.test.js` properly mocks DOM APIs

**Weaknesses:**

| Issue | Severity | Description |
|-------|----------|-------------|
| Heavy mock coupling | **Medium** | `LevelUpService.test.js` has 6 `vi.mock()` calls. Changes to mock signatures require manual test updates. |
| No integration tests | **Medium** | Services are tested in isolation; no tests verify multi-service operations (e.g., full level-up flow). |
| IPC layer untested | **Medium** | `Preload.cjs` exposes 24 channels but no tests verify the preload/handler contract end-to-end. |
| `Settings.js` untested | **Medium** | 120+ lines of preference management and schema validation have no dedicated tests. |
| UI components largely untested | **Low** | `ClassCard.js` (3,036 lines) has no unit tests. UI testing relies on E2E only. |
| Default value brittleness | **Low** | `Character.test.js` asserts exact default values (e.g., ability scores = 10). Schema changes require test updates. |

### 8.3 Critical Untested Areas

1. **IPC contract verification** — Channel names in `Preload.cjs` must match `channels.js`; only one test checks this sync.
2. **Settings persistence** — `Settings.js` schema validation, fallback logic, and `clearInvalidConfig` behavior.
3. **Multi-service orchestration** — Character creation → race selection → class selection → equipment resolution flow.
4. **ClassCard rendering logic** — 3,036 lines of complex UI state management with no unit tests.
5. **PDF generation** — `PdfExporter.js` field mapping correctness for both MPMB and WotC templates.

### 8.4 Test Configuration

- `vitest.config.js`: jsdom environment, globals enabled, proper coverage exclusions — ✅ Sound
- `playwright.config.js`: 15s timeout, trace on retry, no parallel (correct for Electron) — ✅ Sound

---

## 9. Documentation

### 9.1 Architecture Documentation — Excellent

`docs/CODEBASE_ARCHITECTURE.md` (~700 lines) is comprehensive:
- Layered overview with startup sequence
- State & event flow documentation with code examples
- Error handling conventions with do's/don'ts
- Service breakdown and lifecycle documentation
- Character lifecycle (creation → loading → persistence)
- Navigation & page management
- UI component patterns and memory cleanup
- IPC boundaries
- Testing guidance

**Assessment:** Among the best architecture documentation seen for a project of this size. Clear, actionable, with correct/incorrect examples.

### 9.2 Test Documentation — Good

`tests/README.md` provides run commands, coverage overview, test writing guidelines, fixture usage, and debugging tips.

### 9.3 README — Adequate

User-facing README with feature list, screenshots, getting started guide, and data requirements. Clear about licensing (GPL-3.0).

### 9.4 Code Comments — Minimal but Appropriate

The codebase favors self-documenting code with minimal inline comments. Comments exist where logic is non-obvious (e.g., PDF template handling, D&D rule calculations). No excessive or outdated comments observed.

### 9.5 Documentation Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| No EventBus event catalog | **Medium** | Events are string constants, but no central reference lists all events with payload types. |
| Service initialization order undocumented | **Low** | `AppInitializer` loads services in a specific order, but dependencies aren't explicitly documented. |
| `IPC_CONTRACTS.md` exists but scope unclear | **Low** | Document exists in `docs/` but wasn't verified to be comprehensive. |
| No API reference for services | **Low** | Architecture doc describes patterns but not individual method signatures. |

---

## 10. Summary Scoreboard

| Dimension | Score | Key Factor |
|-----------|-------|-----------|
| **Security** | **8.5/10** | Excellent Electron hardening; minor gaps in file size validation and URL filtering |
| **Architecture** | **8.0/10** | Clean layered design; service layer well-patterned; singleton coupling is a trade-off |
| **Code Quality** | **6.0/10** | Monolithic components (ClassCard 3K lines) anchor this down; most other code is clean |
| **Error Handling** | **6.5/10** | Three inconsistent patterns; standardization needed |
| **Testing** | **7.0/10** | 815 tests with good quality; gaps in IPC, settings, UI components, and integration |
| **Performance** | **8.0/10** | Good caching, O(1) lookups, RAF batching; no major bottlenecks |
| **Documentation** | **8.5/10** | Outstanding architecture docs; minor gaps in event catalog and API reference |
| **Best Practices** | **7.5/10** | Good naming, formatting, module organization; DRY violations in a few areas |
| **Overall** | **7.0/10** | Solid foundation with targeted improvements needed |

---

## Appendix: Priority Improvement Roadmap

### 🔴 High Priority

1. **Split `ClassCard.js`** (3,036 lines) into 4+ focused components
2. **Add portrait/file size validation** before reading into memory in `CharacterHandlers.js` and `PdfExporter.js`
3. **Standardize error handling** — throw in services, structured responses only at IPC boundary
4. **Add settings value validation** in `SettingsHandlers.js` (ranges, enums)
5. **Remove `.passthrough()`** from `CharacterSchema.js` validation schema

### 🟠 Medium Priority

6. **Add integration tests** for multi-service workflows (level-up, character creation)
7. **Add IPC contract tests** verifying all 24 `Preload.cjs` channels
8. **Add `Settings.js` unit tests**
9. **Replace `.style.display` usage** with `classList` utility classes (`u-hidden`, `u-block`)
10. **Extract game rule constants** into `src/lib/GameRules.js`
11. **Split `ProficiencyService.js`** into sub-modules by proficiency type
12. **Extract `PrerequisiteValidator`** shared utility from `FeatService` and `OptionalFeatureService`

### 🟢 Low Priority

13. Centralize modal body/overflow cleanup to `ModalCleanupUtility` only
14. Add EventBus event catalog with payload types
15. Document service initialization order and implicit dependencies
16. Add timeout/cancellation support for loading flags (`isLoadingCharacter`)
17. Consider dependency injection for services to improve testability
18. Add PDF generation tests for field mapping correctness

---

*End of audit report.*
