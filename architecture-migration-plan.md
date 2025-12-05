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

### Phase 1 — Extract Electron Layer
- Create `electron/` and move `app/main.js`, `app/preload.cjs`, `app/electron/**` into it; rename preload to `.js` (convert to ESM or keep CJS consistently).
- Update `package.json main` and builder icon paths; update `WindowManager` preload path and `loadFile` root.
- Keep IPC handlers grouped under `electron/ipc`; keep logging/preferences managers alongside.
- Verify app starts and IPC channels work (character save/load, data load).

### Phase 2 — Establish Renderer Root
- Create `renderer/` and move `app/index.html`, `app/css`, `app/assets` (or symlink/config) under it.
- Adjust `BrowserWindow.loadFile` to `renderer/index.html`; fix stylesheet/script paths and CSP if needed.
- Move entry script to `renderer/scripts/app.js` (wrapper that calls current `AppInitializer`).
- Smoke test UI load and CSP console output.

### Phase 3 — Co-locate Pages
- For each page (home, build, equipment, details, magic, settings), move HTML into `renderer/pages/<page>/<page>.html` and page scripts beside it.
- Update `PageLoader` base path and `Router` templates accordingly; ensure dynamic imports work without bundler.
- Move build subsections into `renderer/pages/build/sections` to mirror `changes.md`.
- After each page move, manually verify navigation and Playwright specs that cover it; fix selectors if paths change.

### Phase 4 — Renderer Modules Simplification
- Collapse `app/js/core`, `services`, `utils` into `renderer/scripts` subfolders (`utils`, `state`, `services`), updating relative imports.
- Keep `DataLoader` renderer wrapper, but ensure it only calls IPC-backed `dataLoader` to stay secure.
- Trim unused folders; document new import roots (e.g., `./utils/Logger.js`).

### Phase 5 — Data/Rules Boundary (optional)
- If desired, move JSON under `electron/rules/data` and expose reads via IPC `dataLoader.js`; update renderer `DataLoader` base URLs.
- Only do this if hiding filesystem access or shrinking renderer surface is a priority; otherwise leave data in place.

### Phase 6 — Cleanup & Tests
- Update test fixtures/paths for new page locations; run Playwright suite.
- Remove obsolete folders under `app/`; update docs/README to reflect new structure.

## Risks & Mitigations
- Path churn without bundler: move incrementally, update imports per move, run smoke tests per page.
- CSP/script path breakage: after moving index and pages, check devtools for blocked resources.
- Preload conversion: if switching to ESM, adjust `contextBridge` exports and ensure Electron version supports it.

## Definition of Done
- Main/preload/ipc isolated under `electron/`; renderer code has no direct Node/Electron access.
- Renderer assets/pages co-located; navigation works; tests updated.
- Imports are consistent; no orphaned `app/js` or `app/css` remains.