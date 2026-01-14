<!-- Architecture map for cross-file awareness; keep comments to clarify intent. -->
# Fizbane's Forge Architecture Map

<!-- High-level layer diagram helps readers place new work correctly. -->
## Layered Overview
- **Main process**: [src/main/Main.js](src/main/Main.js) boots Electron, registers IPC handlers (see [src/main/ipc](src/main/ipc)) and opens the renderer window. It never touches renderer state directly; all interactions flow through IPC and preload bridges.
- **Preload bridge**: [src/main/preload.cjs](src/main/preload.cjs) (loaded by Main) exposes safe `window.*` APIs (e.g., `window.characterStorage`, `window.app`) consumed by renderer managers/services. Renderer files must treat these as the sole gateway to filesystem and OS.
- **Renderer boot**: [src/app/AppInitializer.js](src/app/AppInitializer.js) coordinates data-source validation, service initialization, core controllers, and notification setup before UI rendering. It is the first renderer entry point after preload.
- **State & events**: [src/app/AppState.js](src/app/AppState.js) holds shared state and emits change events through [src/lib/EventBus.js](src/lib/EventBus.js). UI and services observe events instead of mutating shared objects directly.
- **Data services**: Files in [src/services](src/services) load 5etools-style JSON via [src/lib/DataLoader.js](src/lib/DataLoader.js), normalize it, cache through AppState, and emit load events. UI must call services instead of fetching JSON directly.
- **UI layer**: [src/app/NavigationController.js](src/app/NavigationController.js), [src/app/PageHandler.js](src/app/PageHandler.js), titlebar/theme managers, and components under [src/ui](src/ui) render pages and modals. They listen to EventBus and AppState; they do not talk to the filesystem.

<!-- Sequence section shows how layers interact over time. -->
## Startup Sequence (renderer)
- Renderer boot begins when Main creates the BrowserWindow and preload wires IPC APIs.
- [AppInitializer](src/app/AppInitializer.js) validates the data source (via `window.app` IPC), then loads services in parallel (spell, item, class, race, background, condition, monster, feat, skill, action, variant rules) using each service’s `initialize()`.
- Core controllers initialized in order: text processor, titlebar, [PageHandler](src/app/PageHandler.js), [NavigationController](src/app/NavigationController.js), settings service, notification center. Failures are logged but do not block other initializations.
- UI event handlers inside AppInitializer subscribe to EventBus (e.g., `CHARACTER_UPDATED`, `CHARACTER_SAVED`, `PAGE_CHANGED`) to manage unsaved-change indicators and save actions, keeping state updates centralized through AppState.

<!-- State/events describe cross-cutting dependencies. -->
## State and Event Flow
- [AppState](src/app/AppState.js) is the single source of truth for renderer-wide flags (page, loading, character, settings cache). It emits `state:*:changed` plus `STATE_CHANGED` on every update.
- [EventBus](src/lib/EventBus.js) defines canonical event names (navigation, character lifecycle, data loads, proficiency/spell/item actions). Anything emitting cross-component signals should use these constants instead of ad-hoc strings.
- Common patterns: services emit `DATA_LOADED` variants; Navigation emits `PAGE_CHANGED`/`PAGE_LOADED`; Character flows emit `CHARACTER_SELECTED`/`CHARACTER_UPDATED`/`CHARACTER_SAVED`. UI controllers listen and react, keeping coupling loose.

<!-- Services section clarifies data responsibilities and avoidance of direct file reads. -->
## Data Services (renderer)
- All services extend or follow [BaseDataService](src/services/BaseDataService.js), which provides AppState-backed caching and optional EventBus emissions. They must call `initWithLoader` to respect cache and error handling.
- Example: [SpellService](src/services/SpellService.js) loads the spell index and individual spell JSON files through [DataLoader](src/lib/DataLoader.js), builds lookup maps, caches via AppState, and emits `SPELLS_LOADED`. It never fetches JSON directly in UI code.
- Other domain services (Action, Background, Class, Condition, Feat, Item, Monster, Race, Skill, VariantRule, Equipment, LevelUp, Proficiency, SpellSelection, Settings, Source) follow the same pattern: renderer asks the service → service uses DataLoader and normalizers → service caches to AppState → service emits load events.
- When introducing new data flows, reuse existing services or extend them; do not bypass the service layer or directly parse JSON from UI components.

<!-- Character section shows IPC + state touch points. -->
## Character Lifecycle
- [CharacterManager](src/app/CharacterManager.js) orchestrates create/load/save/delete via IPC bridges exposed by preload (`window.characterStorage`). It never accesses the filesystem directly.
- [CharacterSchema](src/app/CharacterSchema.js) validates and stamps character data; [Character](src/app/Character.js) wraps domain behaviors; `serializeCharacter` prepares data for persistence. CharacterManager touches AppState for selection and unsaved flags, then emits EventBus events (created, selected, saved, deleted).
- Auto-save/save-button flows: AppInitializer wires the save button to `CharacterManager.saveCharacter()`; Titlebar/UI listen for `CHARACTER_SAVED` and `CHARACTER_UPDATED` to update indicators.

<!-- Navigation clarifies template ↔ controller relationships. -->
## Navigation and Pages
- [NavigationController](src/app/NavigationController.js) owns the Router and PageLoader. It registers routes (home, build, equipment, spells, details, settings, preview) and enforces character requirements before navigation.
- Page templates live under [src/ui/pages](src/ui/pages) and are fetched/rendered by PageLoader; they are not directly imported. Route changes update AppState’s `currentPage` and emit `PAGE_CHANGED`, then PageHandler and page-specific scripts react on `PAGE_LOADED` to hydrate content.
- Build-page subnavigation uses `data-section` buttons; NavigationController manages section observers and scroll state, listening to `CHARACTER_SELECTED` and creation/deletion events to enable/disable routes.

<!-- UI infrastructure guidance to avoid leaks and duplicate implementations. -->
## UI Components, Modals, and Cleanup
- All modals are defined in [src/ui/index.html](src/ui/index.html) and controlled via Bootstrap instances. Do not create modals dynamically in JS; reuse defined DOM nodes.
- DOM listeners must be registered via [src/lib/DOMCleanup.js](src/lib/DOMCleanup.js) in modal/card components to ensure proper teardown. EventBus listeners are manual: store references and call `eventBus.off` on teardown.
- Theme/title handling: [ThemeManager](src/app/ThemeManager.js) and [TitlebarController](src/app/TitlebarController.js) react to AppState and EventBus signals to toggle classes, titles, and unsaved indicators.

<!-- Feature crosswalks make related files obvious even without imports. -->
## Feature Crosswalk Examples
- **Level-up flow**: [src/ui/components/level/Modal.js](src/ui/components/level/Modal.js) drives the wizard but relies on [src/app/LevelUpSession.js](src/app/LevelUpSession.js) for staging, [src/services/LevelUpService.js](src/services/LevelUpService.js) for progression math (levels, hit dice, ASI checks, multiclass validation, spell slot updates), [src/services/SpellSelectionService.js](src/services/SpellSelectionService.js) for class spellcasting setup, [src/services/ClassService.js](src/services/ClassService.js) for class data, and [src/services/FeatService.js](src/services/FeatService.js) for ASI/feat options. Changes in any step should keep these collaborators in sync and emit `CHARACTER_UPDATED` via EventBus after apply.
- **Character persistence**: UI save buttons and auto-save flows should route through [src/app/CharacterManager.js](src/app/CharacterManager.js) which calls preload IPC (`window.characterStorage`) and uses [src/app/CharacterSchema.js](src/app/CharacterSchema.js) validation plus `serializeCharacter` from [src/app/Character.js](src/app/Character.js). Direct filesystem access is not allowed.
- **Spell interactions**: Any UI consuming spells should go through [src/services/SpellService.js](src/services/SpellService.js) for lookups and class availability, and through [src/services/SpellSelectionService.js](src/services/SpellSelectionService.js) when choosing or preparing spells during level-up or class changes.
- **Inventory/equipment**: Equipment UI should use [src/services/EquipmentService.js](src/services/EquipmentService.js) and [src/services/ItemService.js](src/services/ItemService.js) for data, and emit inventory events from [src/lib/EventBus.js](src/lib/EventBus.js) instead of mutating character state directly.

<!-- IPC section shows renderer↔main touchpoints. -->
## IPC Boundaries (main ⇄ renderer)
- Main registers handlers in [src/main/ipc](src/main/ipc) (CharacterHandlers, DataHandlers, EquipmentHandlers, FileHandlers, ProgressionHandlers, SettingsHandlers, SpellHandlers). Renderer calls them only through preload-exposed APIs (`window.app`, `window.characterStorage`, etc.).
- Preferences and window state are stored via [src/main/Settings.js](src/main/Settings.js) and surfaced to renderer through IPC—never mutate them directly in renderer code.
- File system and OS dialogs are main-only responsibilities; renderer delegates through handlers to keep the sandbox safe.

<!-- Testing section points to integration coverage for new work. -->
## Tests and Debugging Hooks
- Playwright integration tests live in [tests](tests) and assume EventBus/AppState-driven flows (e.g., navigation, character creation, level-up). Use selectors with `data-*` where possible.
- When adding features, prefer emitting existing events so tests remain stable (e.g., use `EVENTS.PAGE_LOADED` for page readiness instead of new polling loops).

<!-- Conventions keep consistency with 5etools data and project rules. -->
## Conventions and Guardrails
- Use 5etools parsing/rendering helpers in [src/lib/5eToolsParser.js](src/lib/5eToolsParser.js) and [src/lib/5eToolsRenderer.js](src/lib/5eToolsRenderer.js) instead of reimplementing rules logic.
- Themeable values should rely on CSS variables under [src/ui/styles](src/ui/styles); avoid hardcoded colors.
- Shared state mutations go through AppState and EventBus; do not mutate global objects directly.
- Prefer extending existing controllers/services over parallel implementations; consult 5etools upstream if behavior is unclear.