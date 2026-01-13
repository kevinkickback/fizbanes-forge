# Copilot Instructions for Fizbane's Forge

This file defines **hard, non-negotiable rules and patterns** that AI assistance must follow.
When generating or modifying code, **these rules take precedence over convenience or creativity**.

---

## 🚫 Non-Negotiables (Read First)

1. **Do not bypass the service layer**
   - UI code must never load, parse, or read JSON directly.
   - All D&D data access goes through services in `src/services/`.

2. **Do not reimplement 5etools logic**
   - Always search the local codebase first.
   - If not found, reference the official 5etools source.
   - Prefer copying/adapting proven 5etools logic over inventing new logic.

3. **Do not create dynamic Bootstrap modals**
   - All modals must be defined in `src/ui/index.html`.
   - Modal instances must be reused and properly disposed.

4. **Do not attach unmanaged listeners**
   - DOM listeners must use `DOMCleanup`.
   - EventBus listeners must be manually tracked and removed.
   - Failure to clean up listeners is a bug.

5. **Do not mutate shared state directly**
   - Shared state updates must go through `AppState` and/or EventBus events.

6. **Do not introduce parallel implementations**
   - If functionality already exists (locally or in 5etools), reuse or minimally extend it.

---

## Project Overview (Context)

- **Fizbane's Forge** is an Electron-based D&D character creator.
- Architecture is strictly separated:
  - **Electron main process**: `src/main/`
  - **Renderer / UI**: `src/ui/`, `src/app/`, `src/services/`
- All D&D content is sourced from **5etools-style JSON** in `src/data/`.
- Renderer is a single-page application with dynamic page loading and a custom EventBus.

---

## 5etools Integration (Critical)

- The codebase follows **5etools JSON schemas and conventions**.
- Before implementing any new parsing or rendering logic:
  1. Search the local codebase.
  2. If not found, reference the official 5etools source:
     - Repository: https://github.com/5etools-mirror-3/5etools-src
- Prefer **reuse and adaptation**, not custom logic.

### Primary helper files
- `src/lib/5eToolsParser.js`
- `src/lib/5eToolsRenderer.js`

Add new helpers **only if**:
- No equivalent logic exists locally or upstream.
- The behavior is specific to Fizbane’s Forge.

---

## Architecture Rules

### Main Process
- Entry point: `src/main/Main.js`
- Responsibilities:
  - Window lifecycle
  - Preferences
  - File system access
  - IPC registration
- IPC handlers live in `src/main/ipc/handlers/`

### Renderer & App Initialization
- Bootstrapped by `src/app/AppInitializer.js`
- Data and services load **before** UI initialization.
- UI must never directly access data sources.

---

## State & Events

### EventBus
- Location: `src/lib/EventBus.js`
- Used for all cross-component communication.
- Example events:
  - `CHARACTER_UPDATED`
  - `CHARACTER_SAVED`
  - `PAGE_CHANGED`

### State Management
- Shared state lives in `AppState`.
- UI code must never mutate shared state directly.
- Use EventBus and/or AppState APIs for updates.

---

## UI & Bootstrap Rules

- Use **Bootstrap 5 only** for UI primitives.
- Modals:
  - Must be defined in `src/ui/index.html`
  - Controlled via Bootstrap JS API
  - Must be reused, not recreated
  - Must be disposed before re-instantiation

---

## CSS & Theming Rules

- All themeable values must use CSS variables.
- Variables are defined under `:root` in `src/ui/styles/`.
- Never hardcode colors (hex, rgb, rgba).
- Add new variables to `:root` if needed.

---

## Memory Management & Cleanup (Critical)

### DOMCleanup
- Utility: `src/lib/DOMCleanup.js`
- Required for all modal and card components.

#### Modal components
1. Create cleanup instance in constructor: `this._cleanup = DOMCleanup.create()`
2. Dispose old Bootstrap instance before creating a new one
3. Attach all DOM listeners using `this._cleanup.on()`
4. On modal close, call `this._cleanup.cleanup()`

#### Card components
1. Create cleanup instance in constructor
2. Store EventBus handler references
3. Manually remove EventBus listeners with `eventBus.off()`
4. Call `this._cleanup.cleanup()` on teardown

- EventBus listeners are **not auto-tracked**
- Bootstrap modals must always be disposed to prevent leaks

Reference:
- `CLEANUP_EXTENSION_SUMMARY.md`
- `CLEANUP_QUICK_REFERENCE.md`

---

## IPC Rules

- All main ↔ renderer communication must use IPC.
- Handlers are registered in `src/main/ipc/handlers/`.

---

## Playwright Testing

- Framework: **Playwright** with **Electron** support
- Test directory: `tests/`
- Config: `playwright.config.js`
- Run: `npx playwright test [--headed]`

### Test Structure
```javascript
import { _electron as electron, expect, test } from '@playwright/test';

test('should do something', async () => {
    test.setTimeout(120000); // Electron tests need more time
    
    const electronApp = await electron.launch({
        args: ['.'],
        env: {
            ...process.env,
            FF_DEBUG: 'true',
            FF_ALLOW_DEFAULT_DATA: 'true',
        },
    });
    
    try {
        // Get main window (exclude devtools)
        let page = electronApp.windows()
            .find((win) => !win.url().startsWith('devtools://'));
        if (!page) {
            page = await electronApp.waitForEvent('window',
                (win) => !win.url().startsWith('devtools://'));
        }
        
        // Capture errors for debugging
        page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));
        
        // Wait for app load
        await page.waitForSelector('#pageContent', { timeout: 60000 });
        
        // Test interactions
        await page.locator('#buttonId').click();
        await expect(page.locator('#element')).toBeVisible();
        
    } finally {
        await electronApp.close();
    }
});
```

### Key Patterns
- Use `test.setTimeout(120000)` for Electron
- Prefer `waitForSelector()` over `waitForTimeout()`
- Capture console output for debugging
- Always `close()` app in finally block
- Use `[data-*]` selectors when possible
- See `tests/` for examples

---

## AI Agent Rule of Thumb

When uncertain:
- Follow existing patterns
- Reuse 5etools logic
- Prefer services over UI logic
- Avoid parallel implementations
