# Architecture Migration Plan

Goal: separate Electron (main/preload/ipc) from renderer, co-locate related files, and trim folder sprawl while staying close to the example in `changes.md` when it helps maintainability.

## Guiding Principles
- Keep main/preload/ipc isolated from renderer code; renderer stays browser-only with contextBridge APIs.
- Co-locate page HTML/JS/CSS; avoid scattering per-feature logic across distant folders.
- Prefer incremental moves with working checkpoints; update imports as files move.
- Minimize churn: only move data/assets when a clear benefit exists.

## Target Shape (adapted from `changes.md`)
```
electron/
  main.js            # entry (was app/main.js)
  preload.js         # bridge (was app/preload.cjs)
  ipc/
    character.js
    settings.js
    fileSystem.js
    dataLoader.js
  rules/
    dataloader.js
    data/            # keep existing JSON; move only if needed

renderer/
  index.html
  styles/
  scripts/
    app.js           # bootstraps AppInitializer
    router.js
    utils/
      dom.js
      validators.js
      calculators.js
      filters.js
    state/
      character.js
      storage.js
      rules.js
    pages/
      home/{home.html, home.js}
      build/{build.html, build.js, sections/...}
      details/{details.html, details.js}
      magic/{magic.html, magic.js}
      settings/{settings.html, settings.js}
```

## Phased Plan

### Phase 0 — Baseline & Safety
- Confirm current entry points and CSP: `package.json main`, `BrowserWindow` preload/path, CSP in `index.html`.
- Run existing Playwright tests to capture baseline failures.

### Phase 1 — Extract Electron Layer ✅ COMPLETED
- ✅ Created `electron/` and moved `app/main.js`, `app/preload.cjs`, `app/electron/**` into it.
- ✅ Updated `package.json main` to `"./electron/main.js"`.
- ✅ Refactored `WindowManager` to accept `{rendererPath, preloadPath}` paths object.
- ✅ Updated `IPCRegistry` to accept `dataPath` for `DataHandlers`.
- ✅ Verified app starts, IPC channels register, character/data handlers work (smoke test passed).

### Phase 2 — Establish Renderer Root ✅ COMPLETED
- ✅ Created `renderer/` and moved `app/index.html`, `app/css → renderer/styles`, `app/assets` under it.
- ✅ Adjusted `BrowserWindow.loadFile` to `renderer/index.html` (via updated `WindowManager`).
- ✅ Fixed stylesheet paths in HTML: `css/ → styles/`.
- ✅ Updated `biome.json` to exclude `renderer/assets` vendor files from linting.
- ✅ Verified UI loads and no CSP console errors (smoke test passed).

### Phase 3 — Co-locate Pages ✅ COMPLETED (Partial)
- ⚠️ Pages remain in `renderer/pages/` (flat structure, not nested per-page folders yet).
- ✅ `PageLoader` base path already points to correct location; navigation works (verified in smoke test).
- Future refinement: If desired, can nest pages as `renderer/pages/<page>/<page>.html` with section subfolders.

### Phase 4 — Renderer Modules Simplification ✅ COMPLETED
- ✅ Moved all of `app/js/**` to `renderer/scripts/` (preserving subfolder structure: core, infrastructure, modules, services, utils).
- ✅ Updated `renderer/index.html` script src to `scripts/core/AppInitializer.js`.
- ✅ Updated `electron/ipc/handlers/CharacterHandlers.js` import path to `../../../renderer/scripts/core/characterValidation.js`.
- ✅ Updated `biome.json` linter config to reference `renderer/scripts/**` (removed obsolete `app/js/**` refs).
- ✅ Removed empty `app/js/` folder.
- ✅ Verified all internal renderer imports use preserved relative paths (`../infrastructure/`, `../services/`, `../utils/`).
- ✅ Smoke test passed: app launches, AppInitializer loads from new path, IPC handlers work, pages load.
- ✅ Lint passes: 89 files checked in 73ms.

### Phase 5 — Data/Rules Boundary (optional)
- If desired, move JSON under `electron/rules/data` and expose reads via IPC `dataLoader.js`; update renderer `DataLoader` base URLs.
- Only do this if hiding filesystem access or shrinking renderer surface is a priority; otherwise leave data in place.

### Phase 6 — Cleanup & Tests
- [ ] Run Playwright test suite; update selectors if page paths changed (likely minimal since pages still in same relative location).
- [ ] Remove obsolete `app/css`, `app/assets` folders (already moved to renderer).
- [ ] Verify `app/` now contains only `data/` folder; no orphaned files remain.
- [ ] Update README.md and docs to reflect new `electron/` and `renderer/` structure.
- [ ] Optional: rename pages to nested structure if desired (e.g., `renderer/pages/build/build.html`), then update `PageLoader` base paths.

## Risks & Mitigations
- Path churn without bundler: ✅ Mitigated—moves done incrementally with smoke tests; relative paths preserve internal import chains.
- CSP/script path breakage: ✅ Mitigated—no CSP errors after Phase 2 renderer setup; checked devtools during smoke tests.
- Preload conversion: ✅ Not needed—`preload.cjs` remains CJS; Electron supports both ESM and CJS.

## Definition of Done (Status)
- ✅ Main/preload/ipc isolated under `electron/`; renderer code has no direct Node/Electron access.
- ✅ Renderer assets/pages under `renderer/` root; navigation works; smoke test confirmed.
- ✅ Renderer JS moved to `renderer/scripts/` with preserved folder structure; all imports valid.
- ⏳ Playwright tests updated and passing (Phase 6 pending).
- ⏳ Docs updated to reflect new structure (Phase 6 pending).

## Summary of Changes (Phases 1-4 Completed)

**File Movements:**
- `app/main.js` → `electron/main.js`
- `app/preload.cjs` → `electron/preload.cjs`
- `app/electron/**` → `electron/**`
- `app/index.html` → `renderer/index.html`
- `app/css/**` → `renderer/styles/**`
- `app/assets/**` → `renderer/assets/**`
- `app/pages/**` → `renderer/pages/**`
- `app/js/**` → `renderer/scripts/**` (preserving internal structure: core/, infrastructure/, modules/, services/, utils/)
- Empty folder removed: `app/js/`

**Import Path Updates:**
- `package.json`: `"main": "./electron/main.js"`
- `renderer/index.html`: stylesheet `styles/`, script `scripts/core/AppInitializer.js`
- `electron/main.js`: all imports adjusted for new folder structure
- `electron/ipc/handlers/CharacterHandlers.js`: validation import `../../../renderer/scripts/core/characterValidation.js`
- `biome.json`: removed old `app/js/**`, `app/css/**` refs; updated to `renderer/scripts/**`, `renderer/pages/**`

**Verification:**
- Smoke test (npm start): ✅ App launches, all managers initialize, IPC handlers register, data loads (56 JSON files), 4 saved characters found.
- Lint: ✅ 89 files checked, no errors.
- Internal imports: ✅ All relative paths preserved (e.g., utils/Logger.js → ../infrastructure/Logger.js still valid).
- CSP: ✅ No console errors.
