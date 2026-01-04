# Copilot Instructions for Fizbane's Forge

## Project Overview
- **Fizbane's Forge** is an Electron-based D&D character creator. It uses a modular architecture with clear separation between the Electron main process (`src/electron/`) and the renderer (frontend, `src/renderer/`).
- All D&D data (items, spells, classes, etc.) is loaded from JSON files in `src/data/` at startup. Data source configuration is required on first launch.
- The renderer is a single-page app with dynamic page loading and a custom event bus for inter-component communication.

## Key Architectural Patterns
- **Main Process**: Entry point is `src/electron/Main.js`. Registers IPC handlers for data, file, settings, and character operations. Preferences and window state are managed here.
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
- **Bootstrap Components**: Use Bootstrap 5 components (modals, tabs, progress bars, etc.) instead of custom implementations. Modal elements should be defined in `index.html` and controlled via Bootstrap's JavaScript API (`new bootstrap.Modal()`, `.show()`, `.hide()`). Always reuse Bootstrap modal instances rather than creating new ones on each show.
- **CSS Variables for Theming**: All colors, shadows, spacing, and other themeable properties must use CSS variables defined in `src/renderer/styles/main.css` (in the `:root` section). Never hardcode color values (hex, rgba, etc.) in CSS rules. When adding new styles, check if an appropriate variable exists; if not, add it to `:root` with other variables of its category (e.g., proficiency colors, overlay colors, etc.). This ensures the entire theme can be changed by modifying variables in one place.
- **Parsing Helpers**: Shared D&D parsing helpers live in `src/renderer/scripts/utils/5eToolsParser.js`; check there before adding new helper functions to avoid duplicating existing utilities.

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
- `src/electron/Main.js` – Electron entry, IPC setup
- `src/renderer/scripts/core/AppInitializer.js` – Renderer bootstrap
- `src/renderer/utils/EventBus.js` – Event system
- `src/data/` – All D&D data
- `tests/` – Playwright E2E tests

---
For more, see code comments in the above files. When in doubt, follow the service/event-driven patterns and avoid direct data access in UI code.
