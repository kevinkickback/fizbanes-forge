# Copilot Instructions for Fizbane's Forge

## Project Overview
- **Fizbane's Forge** is an Electron-based D&D character creator. It uses a modular architecture with clear separation between the Electron main process (`src/electron/`) and the renderer (frontend, `src/renderer/`).
- All D&D data (items, spells, classes, etc.) is loaded from JSON files in `src/data/` at startup. Data source configuration is required on first launch.
- The renderer is a single-page app with dynamic page loading and a custom event bus for inter-component communication.

## Key Architectural Patterns
- **Main Process**: Entry point is `src/electron/main.js`. Registers IPC handlers for data, file, settings, and character operations. Preferences and window state are managed here.
- **Renderer**: Bootstrapped by `src/renderer/scripts/core/AppInitializer.js`. Loads all data/services in parallel, then initializes UI and event handlers. Uses a service layer (e.g., `ActionService`, `RaceService`) for all data access.
- **Event Bus**: `src/renderer/utils/EventBus.js` provides a pub/sub system for decoupled communication (e.g., `CHARACTER_UPDATED`, `PAGE_CHANGED`).
- **UI**: Main HTML is `src/renderer/index.html`. Pages and modals are loaded dynamically. State is managed via `AppState`.

## Developer Workflows
- **Start app**: `npm start` (runs Electron)
- **Debug mode**: `npm run debug` (enables debug UI and default data)
- **Build distributable**: `npm run dist` (uses `electron-builder`)
- **Format/lint**: `npm run format` / `npm run lint` (uses Biome)
- **Tests**: Playwright E2E tests in `tests/` (`npx playwright test`)
- **Assets setup**: `npm run setup` (downloads/installs required assets)

## Project-Specific Conventions
- **Module system**: Use ES modules everywhere except where Electron requires CommonJS (see `biome.json` overrides).
- **Data loading**: All game data must be loaded via the service layer, never directly from JSON in UI code.
- **UI state**: Use `AppState` and the event bus for all cross-component state changes.
- **Debug UI**: Elements with `.debug-only` are only visible in debug mode (`FF_DEBUG=true`).
- **Unsaved changes**: Managed via `AppState` and `CHARACTER_UPDATED`/`CHARACTER_SAVED` events.

## Integration Points
- **IPC**: All main/renderer communication is via IPC handlers registered in `src/electron/ipc/handlers/`.
- **External dependencies**: Uses `5etools-utils`, `bootstrap`, `fontawesome`, and Playwright for testing.

## Examples
- To add a new data type (e.g., new D&D entity):
  1. Add JSON to `src/data/`
  2. Create a service in `src/renderer/scripts/services/`
  3. Register/init in `AppInitializer.js`
- To add a new UI page: Add to `src/renderer/pages/`, update navigation, and register with the router.

## Key Files/Directories
- `src/electron/main.js` – Electron entry, IPC setup
- `src/renderer/scripts/core/AppInitializer.js` – Renderer bootstrap
- `src/renderer/utils/EventBus.js` – Event system
- `src/data/` – All D&D data
- `tests/` – Playwright E2E tests

---
For more, see code comments in the above files. When in doubt, follow the service/event-driven patterns and avoid direct data access in UI code.
