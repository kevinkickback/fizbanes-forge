## Refactoring — AI Agent Action Plan

**Last Updated:** November 23, 2025

---

This file records the verification I ran across the `docs/refactoring` documents and the repository, and provides a concrete, prioritized action plan for AI agents to finish the remaining work so the documentation matches reality and the new architecture is fully integrated.

**Quick summary of verification findings:**
- **Infrastructure (Phase 1):** Implementations exist under `app/js/infrastructure/` and unit tests present and passing.
- **IPC (Phase 2):** IPC files exist under `app/electron/` and `app/electron/ipc/` per docs; main process is modularized.
- **State (Phase 3):** `app/js/application/AppState.js` exists but not fully adopted everywhere.
- **Business Logic (Phase 4):** `CharacterManager.js` and `CharacterSchema.js` exist but many modules still import legacy `app/js/core/CharacterLifecycle.js`.
- **Presentation (Phase 5):** `Router.js`, `PageLoader.js`, `NavigationController.js` exist; however `app/index.html` still contains page templates and the runtime entry `js/core/AppInitializer.js` initializes legacy modules alongside new ones.
- **Testing (Phase 6):** Unit tests run (observed 89 passing); E2E test files are described in docs but not all exist under `tests/e2e`.

**High-level conclusion:**
The repository contains the new modular files and many tests, but the runtime still uses legacy monolithic code in `app/js/core/` (notably `CharacterLifecycle.js` and `Navigation.js`). The documentation often claims phases are "complete" while the repository shows a mix of completed creation and incomplete integration. The required next steps are integration and migration tasks.

---

**Action plan — prioritized, step-by-step for AI agents**

1) Preparation and safety checks (5–10 minutes)
- **Goal:** Ensure environment is clean and reproducible before changes.
- **Commands (PowerShell):**
```
Get-Location
git branch --show-current
git status --porcelain
npx playwright --version
```
- **Expected:** branch `refactor`, working tree clean or only docs changes.

2) Create a small checkpoint branch (5 minutes)
- **Goal:** Work in an isolated feature branch for safe changes.
- **Commands:**
```
git checkout -b refactor/integrate-new-architecture
```

3) Integrate new presentation & application modules into runtime (30–90 minutes)
- **Goal:** Make `AppInitializer` prefer new modules and wire them up so new architecture becomes active (while keeping controlled fallbacks).
- **Files to modify:** `app/js/core/AppInitializer.js` (update imports and initialization order)
- **Steps:**
  - Replace legacy-first initialization by importing and initializing new `NavigationController`, `Router`, `PageLoader`, and `AppState` before or alongside legacy modules in a clearly marked migration block.
  - Add feature-flag style switches (temporary) so we can enable/disable new modules at runtime for testing.
  - Add logging statements showing whether new or legacy subsystems are initialized.
- **Validation:** `npm start` (or app launch), and verify no runtime errors and that new modules' `Logger.info` messages appear in logs.

4) Migrate high-impact modules from legacy `CharacterLifecycle` to `CharacterManager` (2–4 hours, iterative)
- **Goal:** Replace imports of `app/js/core/CharacterLifecycle.js` with `app/js/application/CharacterManager.js` in a safe, test-driven manner.
- **Priority list (order):**
  1. UI Card modules used heavily in pages (`RaceCard.js`, `ClassCard.js`, `BackgroundCard.js`, `AbilityScoreCard.js`, `ProficiencyCard.js`, `ClassDetails.js`)
  2. Services that rely on lifecycle behavior (`AbilityScoreService.js`, `MethodSwitcher.js`)
  3. Remaining core modules (`Navigation.js`, `Modal.js`) — defer if complex.
- **Steps per file:**
  - Update the import to `CharacterManager`.
  - Replace direct calls to legacy API with `CharacterManager` equivalents. If an API missing, adapt `CharacterManager` with a small shim and tests.
  - Run unit tests: `npx playwright test tests/unit --grep <related-test>` or full unit suite.
  - Commit with message: `refactor(migration): <file> -> use CharacterManager`.
- **Validation:** Unit tests for the modified module pass and the app behavior is unchanged.

5) Replace `utils/EventBus` usage across services (2–3 hours)
- **Goal:** Ensure all services use `app/js/infrastructure/EventBus.js` (the documented, tested EventBus) and `Logger`, `Result`, `AppState` patterns.
- **Detection:** Search for `../utils/EventBus.js` imports and `console.log`/`console.warn`/`console.error` uses.
- **Files likely needing changes:** `RaceService.js`, `SpellService.js`, `SettingsService.js`, `ItemService.js`, `ProficiencyService.js`, `BackgroundService.js`, `AbilityScoreService.js`, `SourceService.js`.
- **Steps:**
  - Replace `eventEmitter` import with `import { eventBus, EVENTS } from '../infrastructure/EventBus.js';`.
  - Replace `console.*` with `Logger.*` and return `Result.ok` / `Result.err` as appropriate.
  - Add unit tests where missing or update existing tests.
- **Validation:** Unit tests pass, and event names emitted match `EVENTS` constants.

6) Extract templates from `app/index.html` into `app/templates/pages/` and update `PageLoader` (2–3 hours)
- **Goal:** Move large inline `<template>` nodes into separate HTML files and have `PageLoader` load them via fetch or local file read.
- **Steps:**
  - Create `app/templates/pages/{home,build,equipment,details,settings,tooltipTest}.html` copying the content of corresponding `<template id="...">` nodes.
  - Update `app/index.html` to remove page template content (keep containers: `#pageContent` etc.).
  - Update `app/js/presentation/PageLoader.js` to fetch templates from `templates/pages/<name>` (ensure correct base path in Electron context). If fetch is problematic in Electron, use a small helper that reads files via IPC to main process.
  - Update tests and `Router` templates references if necessary.
- **Validation:** Load pages in the running app and confirm identical rendering. Run relevant E2E tests (or manual checks).

7) Create or enable E2E tests described in `PHASE_6_TESTING.md` (3–6 hours)
- **Goal:** Ensure E2E test coverage matches docs.
- **Steps:**
  - Create `tests/e2e/` files from `PHASE_6_TESTING.md` (app-startup.spec.js, navigation.spec.js, character-creation.spec.js, settings.spec.js, character-lifecycle.spec.js).
  - Run E2E: `npx playwright test tests/e2e`.
  - Fix app code or tests as needed until stable.
- **Validation:** E2E tests pass in local environment; CI-ready commands added to `package.json` if missing.

8) Verify and adjust file structure to match documented architecture (2–4 hours)
- **Goal:** Ensure all files are in the correct directories as specified in the phase documents and ARCHITECTURE.md.
- **Detection:** Compare actual file locations with the documented structure in `docs/refactoring/ARCHITECTURE.md` and phase docs.
- **Common issues to check:**
  - Files that should be in `app/js/domain/` but are in `app/js/core/`
  - Files that should be in `app/js/application/` but are elsewhere
  - Legacy utility files (e.g., `app/js/utils/EventBus.js`) that duplicate infrastructure layer
  - Any services not in `app/js/services/`
- **Steps:**
  - Create a checklist of files to move based on target architecture
  - For each file to move:
    - Use `git mv <old-path> <new-path>` to preserve history
    - Search for all imports of that file: `grep -r "from.*<filename>" app/`
    - Update all import paths in affected files
    - Run unit tests after each move: `npx playwright test tests/unit`
  - Update any documentation references to old paths
- **Validation:** 
  - All tests pass after moves
  - `git status` shows moves (not deletes + adds)
  - No broken imports remain
- **Example moves:**
  ```
  git mv app/js/utils/EventBus.js app/js/utils/EventBus.legacy.js  # Mark as legacy
  # Update imports in any files still using it to use infrastructure/EventBus.js instead
  ```

9) Clean up and remove legacy/unused files (1–3 hours)
- **Goal:** After all tests pass and migration is complete, remove obsolete files.
- **Safety check:** Run full test suite before any deletions: `npx playwright test`
- **Files to remove (after confirming no imports):**
  - `app/js/core/Navigation.js` (692 lines) - replaced by NavigationController + Router + PageLoader
  - `app/js/core/CharacterLifecycle.js` (836 lines) - replaced by CharacterManager + CharacterSchema
  - `app/js/utils/EventBus.js` - replaced by `app/js/infrastructure/EventBus.js`
  - Any other duplicate or unused utility files discovered during migration
- **Steps:**
  - For each file to remove:
    - Verify no imports exist: `grep -r "from.*<filename>" app/ tests/`
    - Add to a deprecation list with rationale
    - Delete the file: `git rm <file>`
    - Run all tests: `npx playwright test`
    - If tests fail, investigate and fix before proceeding
  - Commit with detailed message listing removed files and their replacements
- **Commit message template:** 
  ```
  chore(refactor): remove legacy files after migration
  
  Removed files:
  - app/js/core/Navigation.js → replaced by NavigationController + Router + PageLoader
  - app/js/core/CharacterLifecycle.js → replaced by CharacterManager + CharacterSchema
  - app/js/utils/EventBus.js → replaced by infrastructure/EventBus.js
  
  All tests passing: 89/89
  ```

10) Documentation updates and final STATUS.md sync (30–60 minutes)
- **Goal:** Make `docs/refactoring/STATUS.md` and phase documents truthful and self-consistent.
- **Steps:**
  - For each phase doc (PHASE_2..PHASE_6), update the "Completed" checkboxes only after the corresponding integration and validation steps are done.
  - Add a short migration log to `MIGRATION_STATUS.md` and `REFACTORING_COMPLETE.md` describing what changed.
  - Update `ARCHITECTURE.md` if any file locations differ from documentation
  - List removed files and their replacements in a migration summary
  - Commit messages: `docs(refactor): update PHASE_X status and validation results`.

---

**Validation commands (copyable, PowerShell):**
```
# Run unit tests
npx playwright test tests/unit

# Run e2e (after added)
npx playwright test tests/e2e

# Launch app for manual validation
npm start

# Git checkpoint example
git add -A
git commit -m "refactor(integration): integrate new architecture - AppInitializer, Presentation, AppState"
git push origin refactor/integrate-new-architecture
```

---

**Estimated effort (conservative):**
- Integrate presentation and AppInitializer: 0.5–1.5 hours
- Migrate core UI card modules (6): 2–4 hours
- Replace EventBus + service refactors (9 services): 2–4 hours
- Template extraction: 2–3 hours
- E2E tests: 3–6 hours
- Restructure files to match architecture: 2–4 hours
- Remove legacy files after validation: 1–3 hours
- Documentation and cleanup: 1–2 hours

Total estimate: 12–27 hours (can be parallelized across multiple AI agents).

---

If you want, I can start by implementing step 3 (patch `AppInitializer.js` to initialize new presentation modules under a migration flag) and then migrate one high-impact card module (e.g., `RaceCard.js`) as a worked example. Tell me which step to start or approve the plan and I will begin.
