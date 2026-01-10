# Copilot Instructions for Fizbane's Forge

## Project Overview
- **Fizbane's Forge** is an Electron-based D&D character creator.
- The project uses a modular architecture with a strict separation between:
  - **Electron main process** (`src/main/`)
  - **Renderer (frontend)** (`src/ui/`, `src/app/`, `src/services/`)
- All D&D data (items, spells, classes, races, backgrounds, etc.) is sourced from **5etools-style JSON files** located in `src/data/`.
- Data source configuration is required on first launch.
- The renderer is a single-page application with dynamic page loading and a custom event bus for inter-component communication.

## Data Source & 5etools Integration (IMPORTANT)
- The codebase is built around **5etools web app JSON schemas and conventions**.
- **Before implementing any new parsing, normalization, or rendering logic for 5e data**:
  1. Search the existing codebase for equivalent functionality.
  2. If not found locally, reference the official 5etools source code:
     - Repository: https://github.com/5etools-mirror-3/5etools-src
- Prefer **copying and adapting existing 5etools logic** over writing custom implementations.
- Primary helper locations already included in this project:
  - `src/lib/5eToolsParser.js`
  - `src/lib/5eToolsRenderer.js`
- If functionality exists in those files, **reuse it directly** or extend it minimally.
- New helper logic should only be added when:
  - No equivalent logic exists locally or upstream in 5etools.
  - The behavior is specific to Fizbane’s Forge and cannot reasonably be shared.

## Key Architectural Patterns
- **Main Process**
  - Entry point: `src/main/Main.js`
  - Responsible for window lifecycle, preferences, file system access, and IPC registration.
  - IPC handlers live in `src/main/ipc/handlers/`.

- **Renderer & Application Logic**
  - Bootstrapped by `src/app/AppInitializer.js`.
  - Loads all data and services in parallel before initializing UI and event handlers.
  - All data access must go through a **service layer** (e.g., `RaceService`, `ClassService`, `ActionService`).

- **Event Bus**
  - Located at `src/lib/EventBus.js`.
  - Provides pub/sub messaging for decoupled communication.
  - Examples: `CHARACTER_UPDATED`, `CHARACTER_SAVED`, `PAGE_CHANGED`.

- **State Management**
  - Global UI and character state is managed via `AppState`.
  - Cross-component updates must use `AppState` and/or EventBus events.
  - UI code must never mutate shared state directly.

## Developer Workflows
- **Start app**: `npm start`
- **Debug mode**: `npm run debug`
  - Enables debug UI
  - Loads default data
- **Build distributable**: `npm run dist` (electron-builder)
- **Format / lint**: `npm run format`, `npm run lint` (Biome)
- **Tests**: Playwright E2E tests in `tests/`
- **Assets setup**: `npm run setup`

## Project-Specific Conventions
- **Module system**
  - Use ES modules everywhere.
  - CommonJS is allowed only where Electron requires it (see `biome.json` overrides).

- **Data loading**
  - UI code must never read JSON files directly.
  - All game data access must go through the service layer.
  - Services are responsible for parsing, indexing, filtering, and caching.

- **UI state & events**
  - Use `AppState` for persistent/shared state.
  - Use the EventBus for all cross-component communication.
  - Unsaved changes are tracked via `CHARACTER_UPDATED` / `CHARACTER_SAVED`.

- **Bootstrap Components**
  - Use **Bootstrap 5** components exclusively for UI primitives (modals, tabs, tooltips, progress bars).
  - Modals:
    - Must be defined in `src/ui/index.html`.
    - Must be controlled via Bootstrap’s JS API (`new bootstrap.Modal()`).
    - Always reuse modal instances; do not recreate them per show/hide.

- **Debug UI**
  - Elements with `.debug-only` are visible only when `FF_DEBUG=true`.

- **CSS & Theming**
  - All themeable values (colors, spacing, shadows, overlays, etc.) must use CSS variables.
  - Variables are defined in `src/ui/styles/` under `:root`.
  - Never hardcode colors (hex, rgb, rgba) in CSS rules.
  - If a variable does not exist, add it to `:root` in the appropriate section.

- **Parsing Helpers**
  - Shared D&D parsing helpers live in:
    - `src/lib/5eToolsParser.js`
    - `src/lib/5eToolsRenderer.js`
  - Always check these files before creating new parsing or formatting helpers.

## Integration Points
- **IPC**
  - All main ↔ renderer communication must go through IPC handlers.
  - Handlers are registered in `src/main/ipc/handlers/`.

- **External dependencies**
  - Uses `5etools-utils`, `bootstrap`, `fontawesome`, and Playwright.

## Common Extension Patterns
- **Adding a new D&D entity type**
  1. Add JSON data to `src/data/`
  2. Implement or extend a service in `src/services/`
  3. Reuse existing 5etools parsing helpers where possible
  4. Register the service in `AppInitializer.js`

- **Adding a new UI page**
  1. Add page files to `src/ui/pages/`
  2. Update navigation and routing
  3. Register the page with the router/event system

## Key Files & Directories
- `src/main/Main.js` – Electron entry point
- `src/app/AppInitializer.js` – Application bootstrap
- `src/lib/EventBus.js` – Event system
- `src/lib/5eToolsParser.js` – Shared 5e parsing helpers
- `src/lib/5eToolsRenderer.js` – 5etools rendering utilities
- `src/services/` – All service layer implementations
- `src/data/` – All D&D JSON data
- `src/ui/` – UI layer (HTML, CSS, pages, components)
- `tests/` – Playwright E2E tests

---

**General Rule for AI Agents:**  
When in doubt, follow existing patterns, reuse 5etools logic where available, prefer services over UI logic, and avoid introducing parallel implementations for the same D&D rules or data structures.
