## Fizbane's Forge – AI Coding Agent Guide

Concise, actionable instructions for AI agents to work productively in this Electron codebase. Focus on real, discoverable patterns—do not invent new architecture.

### 1. Architecture Overview
- **Main process**: Entry at `app/main.js`, delegates to `WindowManager`, `PreferencesManager`, and `IPCRegistry` for modularity. Avoid monolithic logic.
- **Renderer**: Served from `app/index.html` with strict isolation (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`). All privileged actions go through preload + IPC.
- **Preload**: `app/preload.js` exposes only two namespaces: `electron` (generic IPC/invoke/utilities) and `characterStorage` (CRUD, import/export). Keep surface minimal; add only when necessary.
- **Domain data**: All rules/items/etc. live in `app/data/**` and are loaded via IPC (`data:loadJson`). Never access filesystem directly from renderer.

### 2. IPC & Preload Patterns
- **Channel naming**: Always `domain:action` (e.g., `character:save`, `file:open`, `settings:getPath`). Lowercase, noun domain, verb action.
- **Registration**: All IPC channels registered in `app/electron/ipc/IPCRegistry.js` via handler modules in `app/electron/ipc/handlers/`. New domains: create `handlers/<Domain>Handlers.js`, export `register<Domain>Handlers`, and call in `IPCRegistry.registerAll()`.
- **Exposure**: IPC functions must be exposed through preload, grouped under existing namespaces or new ones if needed. Never expose directly from renderer.

### 3. Window & Preferences Management
- **WindowManager**: Handles window lifecycle, DevTools (guarded by `debugMode`), and persists bounds via `PreferencesManager.setWindowBounds(bounds)`.
- **PreferencesManager**: Stores JSON in userData (`preferences.json`). Add new keys by extending `defaults` and implementing dedicated get/set helpers. Always use `set()` to save; never write file directly.
- **Default keys**: `characterSavePath`, `lastOpenedCharacter`, `windowBounds`, `theme`, `logLevel`, `autoSave`, `autoSaveInterval`.

### 4. State & Event System (Renderer)
- **AppState**: Global state via `app/js/core/AppState.js`. Use `getState()`, `setState(partial)`, `get(path)`, and domain helpers. Only emit change events when value actually changes.
- **EventBus**: Standard events in `EventBus.js` (`app:ready`, `character:selected`, `page:changed`, `state:changed`). Add new events to `EVENTS` export and test in `tests/unit/*`. EventBus methods: `on`, `once`, `off`, `clearEvent`, `clearAll`, `listenerCount`, `eventNames`. Handlers must be resilient to exceptions.

### 5. Testing Workflow
- **Unit tests**: Use Playwright (`@playwright/test`) for all logic, including non-browser. No npm `test` script; run with:
  ```pwsh
  npx playwright test tests/unit
  npx playwright test tests/e2e
  ```
- **Patterns**: Always clear state/event bus in `beforeEach`. Assert both emission and non-emission. Replicate these patterns for new logic.

### 6. Build & Run
- **Dev**: `npm start` launches Electron (`electron .`).
- **Packaging**: `npm run pack` (dir build), `npm run dist` (distributables). Respect `build` config in `package.json` for icons, license, targets.
- **Native deps**: Postinstall runs `electron-builder install-app-deps`.

### 7. Logging & Style
- **Log prefix**: `[ComponentName] message` (e.g., `[WindowManager]`, `[App]`).
- **Domain boundaries**: Main process in `app/electron/**`, renderer in `app/js/**`, static data in `app/data/**`. Never bypass abstraction layers—extend them.

### 8. Adding Features
- **Settings**: Add to `defaults`, provide getter/setter, update preload if needed.
- **IPC**: Implement handler, register in `IPCRegistry`, expose via preload.
- **State keys**: Initialize in `AppState` defaults, emit events only on change, add tests.
- **Events**: Add to `EVENTS`, emit via `eventBus.emit(EVENTS.XYZ, ...)`, test emission/non-emission.

### 9. Security
- Always maintain `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Never expose raw `fs` or privileged APIs—wrap via IPC and validate inputs.
- Validate file paths/inputs in IPC handlers. Never write to arbitrary paths.

### 10. What NOT To Do
- Never read/write preferences file directly (use `set`/`get`).
- Never introduce Node APIs to renderer except via preload.
- Never couple renderer modules directly to Electron main process objects.

### 11. PR Checklist
- IPC channel named `domain:action`.
- Logs use `[Module]` prefix.
- State change emits only on mutation.
- Tests for new events/IPC/state.
- No security regressions (renderer isolation preserved).

---
**Feedback requested:** Indicate any unclear or missing sections so instructions can be refined for future AI agents.
