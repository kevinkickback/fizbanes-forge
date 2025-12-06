# AI Coding Instructions for Fizbane's Forge

> **Last updated:** December 2025  
> **Project:** D&D Character Creator (Electron + Renderer)

## Architecture Overview

This is an **Electron desktop application** with a strict **main process / renderer process separation**:

### Core Structure
- **Main Process** (`src/electron/`): Runs with Node.js full access, manages windows and IPC
  - `main.js`: Entry point - initializes managers and window
  - `WindowManager.js`: Creates/manages BrowserWindow, handles window state persistence
  - `PreferencesManager.js`: Stores user preferences via file-based JSON
  - `MainLogger.js`: Logging infrastructure (separate from renderer)
  - `ipc/`: IPC handler registry and domain-specific handlers (Character, Data, File, Settings)

- **Renderer Process** (`src/renderer/`): Runs in sandboxed BrowserWindow
  - `scripts/core/`: State management, routing, character data model
  - `scripts/services/`: Data service layer (RaceService, ClassService, etc.) - **singleton instances loaded once**
  - `scripts/modules/`: UI components for game entities (Race, Class, Background, etc.)
  - `scripts/utils/`: Helper utilities (Logger, DataLoader, TextProcessor, etc.)
  - `scripts/infrastructure/`: Cross-cutting concerns (EventBus, Logger)
  - `index.html`: Single-page app entry point with CSP-hardened headers

## Critical Architecture Patterns

### 1. **IPC Communication (Main ↔ Renderer)**
- **Pattern**: Strictly request-response via `ipcMain.handle()` / `ipcRenderer.invoke()`
- **Location**: `src/electron/ipc/handlers/` (CharacterHandlers, DataHandlers, FileHandlers, SettingsHandlers)
- **Example**: Character save validation runs in main process via:
  ```javascript
  // Renderer: invoke the handler
  const result = await window.characterStorage.saveCharacter(character);
  
  // Main: handle the request (ipc/handlers/CharacterHandlers.js)
  ipcMain.handle('character:save', (event, character) => {
    return validateAndSaveCharacter(character); // Returns success/error
  });
  ```
- **Key Rule**: Main process owns validation logic, file I/O, and security boundaries

### 2. **Service Layer Singleton Pattern**
- **All data services initialize once** during `AppInitializer._loadAllGameData()` (parallel Promise.all)
- **Location**: `src/renderer/scripts/services/`
- **Examples**: `raceService`, `classService`, `itemService`, `spellService`, `backgroundService`
- **Pattern**: Import singleton, don't instantiate - `import { raceService } from '../services/RaceService.js'`
- **Data source**: Services load from JSON via `DataLoader.load('races')` → reads from `src/data/` mounted by main IPC

### 3. **UI Component Hierarchy**
- **BaseCard** (`src/renderer/scripts/modules/BaseCard.js`): Base class for all entity cards
  - Handles: image display, description rendering, modal triggers
  - Subclasses: RaceCard, ClassCard, BackgroundCard, etc.
- **Pattern**: Card + View + Details + (optional) Picker for multi-selection
  - `RaceCard.js` (extends BaseCard) → `RaceView.js` (renders card list) → `RaceDetails.js` (expanded info)
  - Picker pattern (e.g., `SubracePicker.js`): Modal for selecting from variants

### 4. **Event Bus for Cross-Component Communication**
- **Location**: `src/renderer/scripts/infrastructure/EventBus.js`
- **Usage**: Components emit/listen to events instead of direct coupling
  - `eventBus.emit(EVENTS.CHARACTER_UPDATED, characterData)`
  - `eventBus.on(EVENTS.RACE_SELECTED, (race) => { /* update UI */ })`
- **Benefits**: Decouples character model changes from UI updates

### 5. **Character Data Model**
- **Core Class**: `Character` (`src/renderer/scripts/core/Character.js`)
- **Schema**: `CharacterSchema.js` - defines shape of character data
- **Validation**: `CharacterValidation.js` - ensures character integrity before save
- **Key Fields**: name, playerName, race (object), class (object with subclass), background, level, abilityScores, proficiencies, hitPoints
- **Note**: Subclass is nested in `character.class.subclass`, NOT at top level

## Developer Workflows

### Running & Debugging
```bash
npm start              # Launch app normally
npm run debug          # Launch with DevTools open (FF_DEBUG=true, sets Logger.enabled)
npm run format         # Apply Biome formatting
npm run lint           # Apply Biome linting + fix
npx playwright test    # Run E2E tests (Playwright + Electron)
```

### Data Folder Configuration
The app requires D&D 5e data files (races.json, classes.json, backgrounds.json, etc.). In production:
1. **First run**: If `src/data/` folder is empty or missing, the app shows a `DataConfigurationModal`
2. **User choice**: Provide either a URL (e.g., GitHub repo) or local folder path
3. **Validation**: Checks for required files before accepting
4. **Storage**: Configuration saved in PreferencesManager (`dataSourceType` and `dataSourceValue`)

Architecture:
- `DataConfigurationModal` (`src/renderer/scripts/modules/setup/DataConfigurationModal.js`) - UI for user input
- `DataFolderManager` (`src/electron/DataFolderManager.js`) - Validates local folders and URLs
- `AppInitializer._checkDataFolder()` - Runs before game data loads
- IPC handlers (`DATA_VALIDATE_SOURCE`, `DATA_CHECK_DEFAULT`) expose validation to renderer

### Adding a New Game Entity Type
1. Create JSON data file in `src/data/` (e.g., `feats.json`)
2. Create service: `src/renderer/scripts/services/FeatService.js` (copy ClassService pattern)
3. Register in `AppInitializer._loadAllGameData()` → add `featService.initialize()`
4. Create Card/View/Details modules in `src/renderer/scripts/modules/feats/`
5. Add IPC handler in `src/electron/ipc/handlers/DataHandlers.js` if special file I/O needed

## Project-Specific Conventions

### Naming
- **File naming**: PascalCase for classes, camelCase for utilities
  - Exception: All test files end in `.spec.js` (Playwright convention)
- **IPC channel names**: snake_case prefixed by domain
  - `character:save`, `data:load`, `file:export`, `settings:get`
- **Event names**: SCREAMING_SNAKE_CASE in EventBus
  - `CHARACTER_UPDATED`, `RACE_SELECTED`, `CLASS_LOADED`

### Logging
- **Always use** `Logger` (not `console.log`)
  - `Logger.info('ComponentName', 'Message', optionalData)`
  - `Logger.warn('ComponentName', 'Warning')`, etc.
- **Logger is infrastructure** - lives at `src/renderer/scripts/infrastructure/Logger.js`
- **Logger output** only enabled when `FF_DEBUG=true` (debug mode) or in tests
- **Main process logging**: Uses `MainLogger.info()` from `src/electron/MainLogger.js`

### Code Quality Standards
- **Biome linter/formatter** enforces:
  - Single quotes in JS
  - Tab indentation (not spaces)
  - No unused imports
- **No CommonJS** in renderer (only ES modules)
- **No Node.js APIs in renderer** - use IPC for file I/O, crypto, etc.
- **CSP enforced**: No inline scripts, data: URIs, or unsafe-eval

### Character Data Mutations
- **Always use** `CharacterManager` (`src/renderer/scripts/core/CharacterManager.js`) for updates
  - Pattern: `characterManager.updateCharacter({ race: newRace })`
  - This triggers validation, event emission, and automatic save
- **Never mutate** character object directly in components
- **Validation happens** in `CharacterValidation.js` before persistence

### Testing Approach
- **E2E only** - uses Playwright + Electron
  - Located: `tests/` directory (`.spec.js` files)
  - Strategy: Launch app, interact via `win.evaluate()` (expose APIs to renderer via preload)
  - Example: `character-validation.spec.js` tests IPC payload validation
- **Preload script** (`src/electron/preload.cjs`) exposes safe APIs to renderer tests

### Error Handling
- **Validation errors**: Caught in `CharacterValidation`, returned to caller
- **IPC failures**: Always return `{ success: false, error: '...' }` objects
- **Data load failures**: `AppInitializer` catches and logs, app continues with degraded state
- **UI feedback**: Use `showNotification()` from `src/renderer/scripts/utils/Notifications.js`

## Cross-Component Communication Patterns

### When to Use What
| Scenario | Pattern | Example |
|----------|---------|---------|
| Renderer → Main process | IPC `invoke()` | Saving character to disk |
| Component → Component (same page) | Event bus emit | Race selector → character model |
| Page navigation | `NavigationController` | Switch from Race page to Class page |
| Persistent storage | `Storage.save(key, value)` | Store unsaved draft |

### Async Data Loading
- Services are **async** by design
- Always `await service.initialize()` during app startup (done in `AppInitializer`)
- Component-level: Call `service.getData()` which returns already-cached data (synchronous)

## Key File Reference

| File | Purpose |
|------|---------|
| `src/renderer/scripts/core/AppInitializer.js` | Startup sequence, loads all data services |
| `src/renderer/scripts/core/Character.js` | Character model definition |
| `src/renderer/scripts/core/CharacterManager.js` | Character mutations with validation |
| `src/renderer/scripts/infrastructure/EventBus.js` | Pub/sub for component decoupling |
| `src/renderer/scripts/services/RaceService.js` | Template for data services |
| `src/renderer/scripts/modules/BaseCard.js` | Base class for all card UI components |
| `src/electron/ipc/IPCRegistry.js` | Central IPC handler registration |
| `src/electron/WindowManager.js` | Electron window lifecycle |
| `biome.json` | Code quality rules (formatting/linting) |

## Common Gotchas

1. **Subclass is nested**: Use `character.class.subclass`, NOT `character.subclass`
2. **Services are singletons**: Don't instantiate, import the singleton
3. **Logger is disabled by default**: Only shows logs in debug mode (`npm run debug`)
4. **IPC is async**: Always `await ipcRenderer.invoke()`, never `send()`
5. **Data files required**: `src/data/` files must exist at runtime or services fail silently
6. **CSP blocks inline execution**: Any dynamic script execution needs IPC workaround
7. **Tests are E2E only**: No unit tests; use Playwright + actual app
