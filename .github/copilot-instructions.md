## Fizbane's Forge – AI Coding Agent Guide

Concise, actionable instructions for AI agents to work productively in this Electron D&D character creator. Focus on real, discoverable patterns—do not invent new architecture.

### 1. Architecture Overview
- **Main process**: Entry at `app/main.js`, delegates to `WindowManager`, `PreferencesManager`, and `IPCRegistry` for modularity. Avoid monolithic logic.
- **Renderer**: Served from `app/index.html` with strict isolation (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`). All privileged actions go through preload + IPC.
- **Preload**: `app/preload.js` exposes two namespaces: `electron` (generic IPC/invoke/utilities) and `characterStorage` (CRUD, import/export). Keep surface minimal; add only when necessary.
- **Domain data**: All D&D rules/items/classes/spells live in `app/data/**` (JSON format, not in repo) and are loaded via IPC (`data:loadJson`). Never access filesystem directly from renderer.

### 2. IPC & Preload Patterns
- **Channel naming**: Always `domain:action` (e.g., `character:save`, `file:open`, `settings:getPath`). Lowercase, noun domain, verb action.
- **Channel constants**: Defined in `app/electron/ipc/channels.js` as `IPC_CHANNELS` object. Use constants, never string literals.
- **Registration**: All IPC channels registered in `app/electron/ipc/IPCRegistry.js` via handler modules in `app/electron/ipc/handlers/`. New domains: create `handlers/<Domain>Handlers.js`, export `register<Domain>Handlers(prefsManager, windowManager)`, and call in `IPCRegistry.registerAll()`.
- **Exposure**: IPC functions must be exposed through `app/preload.js`, grouped under existing namespaces or new ones if needed. Never expose directly from renderer.
- **Example flow**: Renderer calls `window.electron.invoke('character:save', data)` → routed to handler in `CharacterHandlers.js` → returns result to renderer.

### 3. Window & Preferences Management
- **WindowManager** (`app/electron/WindowManager.js`): Handles window lifecycle, DevTools (guarded by `FF_DEBUG` env var), and persists bounds via `PreferencesManager.setWindowBounds(bounds)`. Debug mode enabled via `npm run start:debug` or `FF_DEBUG=true`.
- **PreferencesManager** (`app/electron/PreferencesManager.js`): Stores JSON in userData (`preferences.json`). Add new keys by extending `defaults` object and implementing dedicated getters/setters (e.g., `getWindowBounds()`, `setCharacterSavePath(path)`). Always use `set(key, value)` to save; never write file directly.
- **Default preference keys**: `characterSavePath`, `lastOpenedCharacter`, `windowBounds`, `theme`, `logLevel`, `autoSave`, `autoSaveInterval`.

### 4. State & Event System (Renderer)
- **AppState** (`app/js/core/AppState.js`): Global state management. Use `AppState.getState()`, `AppState.setState(partial)`, `AppState.get('key.path')`, and domain helpers (e.g., `setCurrentCharacter()`). `setState()` emits `STATE_CHANGED` globally and `state:<key>:changed` for each modified key—only when value actually changes.
- **EventBus** (`app/js/infrastructure/EventBus.js`): Export `eventBus` singleton and `EVENTS` constants. Standard events include `APP_READY`, `CHARACTER_SELECTED`, `PAGE_CHANGED`, `STATE_CHANGED`, `PROFICIENCY_ADDED`, etc. Always add new events to `EVENTS` object. EventBus methods: `on(event, handler)`, `once(event, handler)`, `off(event, handler)`, `emit(event, ...args)`, `clearEvent(event)`, `clearAll()`, `listenerCount(event)`, `eventNames()`. Handlers are wrapped in try-catch; exceptions won't crash the bus.
- **Event emission pattern**: State changes emit both generic and specific events. Example: `AppState.setCurrentCharacter()` emits `CHARACTER_SELECTED` and `state:currentCharacter:changed`.

### 5. Testing Workflow
- **Test framework**: Playwright (`@playwright/test`) for both unit and E2E tests. No npm `test` script; run with:
  ```pwsh
  npx playwright test tests/unit
  npx playwright test tests/e2e
  ```
- **Test structure**: Tests live directly in `tests/` directory (e.g., `ability-score-card.spec.js`, `unsaved-changes.spec.js`). Use `_electron: electron` from `@playwright/test` to launch app.
- **Test patterns**: Always clear state/event bus in `beforeEach`. Assert both emission and non-emission of events. Use `getMainWindow(app)` helper to select non-DevTools window. Replicate these patterns for new logic.
- **Config**: See `playwright.config.js` for timeout and reporter settings.

### 6. Build & Run
- **Dev**: `npm start` launches Electron (`electron .`). Debug mode: `npm run start:debug` (sets `FF_DEBUG=true`, opens DevTools).
- **Setup**: `npm install` runs postinstall hook: `electron-builder install-app-deps && node setup-assets.js` (copies Bootstrap/FontAwesome to `app/assets/`).
- **Packaging**: `npm run pack` (unpacked dir build), `npm run dist` (distributables). Respect `build` config in `package.json` for icons, license, targets (macOS dmg, Windows portable, Linux appImage).
- **Code quality**: `npm run format` (Biome auto-fix), `npm run lint` (Biome lint fix), `npm run check:format`, `npm run check:lint`.

### 7. Logging & Style
- **Main process logs**: Use `MainLogger` (`app/electron/MainLogger.js`) with format `MainLogger.info('ComponentName', 'message', data)`. Logs to console with `[ComponentName]` prefix.
- **Renderer logs**: Use `Logger` (`app/js/infrastructure/Logger.js`) with similar pattern: `Logger.info('ComponentName', 'message', data)`.
- **Domain boundaries**: Main process in `app/electron/**`, renderer in `app/js/**` (organized as `core/`, `services/`, `infrastructure/`, `modules/`, `utils/`), static data in `app/data/**`. Never bypass abstraction layers—extend them.

### 8. Adding Features
- **New settings**: Add to `PreferencesManager.defaults`, provide getter/setter methods, update preload if renderer needs access.
- **New IPC channel**: Add constant to `channels.js`, implement handler in `handlers/<Domain>Handlers.js`, register in `IPCRegistry.registerAll()`, expose via preload namespace.
- **New state keys**: Initialize in `AppState` constructor defaults, emit events only on actual change, add tests for state transitions.
- **New events**: Add to `EVENTS` object in `EventBus.js`, emit via `eventBus.emit(EVENTS.XYZ, ...)`, test emission/non-emission in Playwright tests.

### 9. Security
- Always maintain `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in window webPreferences.
- Never expose raw Node.js APIs (`fs`, `path`, `child_process`) to renderer—wrap via IPC and validate inputs.
- Validate file paths/inputs in IPC handlers (see `CharacterHandlers.validateCharacter()` for validation pattern). Never write to arbitrary paths.
- Character files saved using UUID-only filenames to avoid path traversal issues.

### 10. What NOT To Do
- Never read/write preferences file directly (use `PreferencesManager.get()`/`set()`).
- Never introduce Node APIs to renderer except via preload bridge.
- Never couple renderer modules directly to Electron main process objects.
- Never mutate `AppState.state` directly—always use `setState()` to ensure events fire.
- Never use string literals for IPC channels—use `IPC_CHANNELS` constants.

### 11. Code Organization
- **Renderer structure**: `app/js/core/` (Character, AppState, Router, etc.), `app/js/services/` (SpellService, RaceService, etc.), `app/js/infrastructure/` (EventBus, Logger), `app/js/modules/` (UI components), `app/js/utils/` (helpers).
- **Main process structure**: `app/electron/` (WindowManager, PreferencesManager, MainLogger), `app/electron/ipc/` (IPCRegistry, channels, handlers/).
- **Pages**: HTML pages in `app/pages/` (build.html, details.html, equipment.html, preview.html, settings.html).

### 12. PR Checklist
- IPC channel named `domain:action` and added to `IPC_CHANNELS` in `channels.js`.
- Logs use `[ComponentName]` prefix via `MainLogger`/`Logger`.
- State change emits events only on mutation.
- Tests for new events/IPC/state transitions.
- No security regressions (renderer isolation preserved).
- Biome format/lint passes (`npm run check:format && npm run check:lint`).

---
**Feedback requested:** Indicate any unclear or missing sections so instructions can be refined for future AI agents.
