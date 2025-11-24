## Fizbane's Forge – AI Coding Assistant Guide

Concise, project-specific instructions to help AI agents work productively. Focus on existing patterns; do not invent new architecture without need.

### 1. Big Picture Architecture
- Electron app: main process entry `app/main.js` delegates to `WindowManager`, `PreferencesManager`, `IPCRegistry` (composition over monolith).
- Renderer served from `app/index.html` with isolated context (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`). All privileged operations must go through preload + IPC.
- Preload script (`app/preload.js`) exposes two namespaces: `electron` (generic invoke + utility functions) and `characterStorage` (CRUD + export/import). Keep exposure minimal—add new surface only when necessary.
- Domain data (rules, items, etc.) lives in `app/data/**` consumed via IPC data handlers (`data:loadJson`). Avoid direct FS access from renderer.

### 2. IPC & Preload Patterns
- Channel naming: `domain:action` (e.g. `character:save`, `file:open`, `settings:getPath`, `data:loadJson`). Follow lowercase, noun domain, verb action.
- Central registration in `app/electron/ipc/IPCRegistry.js` via domain-specific handler modules under `app/electron/ipc/handlers/`. When adding a new domain, create `handlers/<Domain>Handlers.js` exporting `register<Domain>Handlers` then call it inside `IPCRegistry.registerAll()`.
- Expose new IPC functions through `preload.js`—never directly from renderer. Group under existing namespaces or create a new namespaced object to limit surface area.

### 3. Window & Preferences Management
- `WindowManager` handles lifecycle, DevTools (guarded by `debugMode`), and persists bounds via `PreferencesManager.setWindowBounds(bounds)` on close. Modify window behavior through `WindowManager` methods (do not access `BrowserWindow` directly from outside).
- `PreferencesManager` stores JSON in userData (`preferences.json`). Add new preferences by extending `defaults` and implementing dedicated get/set helpers if they have logic (e.g. `getCharacterSavePath`). Always call `savePreferences()` indirectly via `set()`; do not write the file manually.
- Default preference keys: `characterSavePath`, `lastOpenedCharacter`, `windowBounds`, `theme`, `logLevel`, `autoSave`, `autoSaveInterval`.

### 4. State & Event System (Renderer)
- Global UI/application state via `AppState` (in `app/js/core/AppState.js` referenced by tests). Operations: `getState()`, `setState(partial)`, `get(path)`, domain helpers (`setCurrentCharacter`, `setCurrentPage`, etc.).
- Event emission pattern: Emit change events only when value actually changes (tests assert no event on idempotent sets). Mirror pattern for new state keys.
- Standard events constants (see `EventBus.js`): `app:ready`, `character:selected`, `page:changed`, `state:changed`. New events: add to `EVENTS` export and test under `tests/unit/*`.
- EventBus methods: `on`, `once`, `off`, `clearEvent`, `clearAll`, `listenerCount`, `eventNames`. Keep handlers resilient—exceptions in one listener must not block others.

### 5. Testing Approach
- Unit-style tests use Playwright test runner (`@playwright/test`) even for non-browser logic. No npm `test` script currently; run via:
  ```pwsh
  npx playwright test tests/unit
  npx playwright test tests/e2e
  ```
- Patterns: Clear state/event bus in `beforeEach`; assert emission + non-emission. When adding new logic, replicate these patterns (avoid brittle timing-based tests).

### 6. Build & Run Workflow
- Dev run: `npm start` → launches Electron (`electron .`).
- Packaging: `npm run pack` (dir build), `npm run dist` (full distributables). Respect existing `build` config in `package.json` for icons, license, and targets.
- Postinstall runs `electron-builder install-app-deps`—if adding native deps, rely on this.

### 7. Logging & Style Conventions
- Log prefix pattern: `[ComponentName] descriptive message` (e.g. `[WindowManager]`, `[App]`, `[PreferencesManager]`). Maintain consistency when introducing new modules.
- Prefer clear domain boundaries: keep main-process concerns in `app/electron/**`; renderer logic in `app/js/**`; static data in `app/data/**`.
- Do not bypass `WindowManager` / `PreferencesManager` / IPC abstraction layers—extend them instead.

### 8. Adding Features Safely
- New persisted setting: add to `defaults`, provide getter/setter, update any preload exposure if needed for renderer consumption.
- New IPC capability: implement handlers file, register in `IPCRegistry`, expose through preload with minimal surface.
- New state key: initialize in `AppState` defaults, ensure events fire only on change, add targeted tests.
- New event: add constant in `EVENTS`, emit via `eventBus.emit(EVENTS.XYZ, ...)`, create unit tests for emission and non-emission semantics.

### 9. Security Considerations
- Maintain `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Do not expose raw `fs` or other privileged APIs directly—wrap via IPC with validation.
- Validate file paths / inputs in IPC handlers (pattern implied—add explicit checks when extending). Avoid blindly writing to arbitrary paths.

### 10. What NOT To Do
- Do not read/write preference file directly (use `set` / `get`).
- Do not emit events redundantly for unchanged values.
- Do not introduce Node APIs to renderer without preload exposure.
- Do not couple renderer modules directly to Electron main process objects.

### 11. Quick Checklist Before PR / Change
- IPC channel named `domain:action`.
- Logs use `[Module]` prefix.
- State change emits only on actual mutation.
- Tests added for new events/IPC/state pathways.
- No security regressions (renderer isolation preserved).

Request feedback: Please indicate any unclear section or missing domain so instructions can be refined.
