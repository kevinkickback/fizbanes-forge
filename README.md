# Fizbane's Forge

A comprehensive Dungeons & Dragons character creator application built with Electron.

## Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```
   npm install
   ```
   This will automatically:
   - Install all npm packages
   - Set up Electron app dependencies
   - Copy Bootstrap and FontAwesome assets to app/assets/

## Required Data Files

This application requires D&D 5e data files (JSON format) to be placed in the `app/data/` directory. These files are **not included** in the repository due to size and licensing considerations.

### Data File Structure

The `app/data/` directory should contain:
- Character classes (`class/`)
- Spells (`spells/`)
- Items and equipment (`items.json`, `items-base.json`)
- Races (`races.json`)
- Backgrounds (`backgrounds.json`)
- And other game data files

**Note:** You must provide your own D&D 5e data files or use data from officially licensed sources.

## Development

### Running the Application

```bash
npm start
```

### Running in Debug Mode

```bash
npm run start:debug
```

### Code Quality

- **Format code:** `npm run format`
- **Lint code:** `npm run lint`
- **Check formatting:** `npm run check:format`
- **Check linting:** `npm run check:lint`

### Running Tests

All tests use Playwright for end-to-end testing with the Electron app:

```bash
npx playwright test
```

This will run all specs in the `tests/` directory, including:
- `ability-score-card.spec.js` - Ability score selection and navigation
- `build-unsaved.spec.js` - Unsaved changes persistence on build page
- `character-validation.spec.js` - IPC character save validation
- `csp.spec.js` - Content Security Policy enforcement
- `preferences.spec.js` - Preferences manager (validated get/set)
- `preload-hardening.spec.js` - Preload API security and functionality
- `unsaved-changes.spec.js` - Unsaved changes indicator across pages


## Building

### Development Build (unpacked)

```bash
npm run pack
```

### Production Build

```bash
npm run dist
```

This will create distributable packages for your platform in the `dist/` directory.

## Project Structure

After the architecture migration (Phases 1-4), the project is now organized as follows:

```
fizbanes-forge/
 electron/               # Main process (Node.js + Electron APIs)
   main.js              # Electron entry point
   preload.cjs          # Context bridge to expose IPC APIs to renderer
   MainLogger.js        # Centralized logging for main process
   PreferencesManager.js # Persistent user preferences (window bounds, theme, paths)
   WindowManager.js     # BrowserWindow lifecycle management
   ipc/                 # IPC handler modules
     channels.js        # IPC channel name constants
     IPCRegistry.js     # Central handler registration
     handlers/
       CharacterHandlers.js     # Character save/load/import/export
       FileHandlers.js          # File system operations
       SettingsHandlers.js      # Settings IPC
       DataHandlers.js          # 5eTools data file loading

 renderer/              # Renderer process (browser-only, no Node.js APIs)
   index.html           # Application entry point
   styles/              # Application stylesheets (main, modal, notification, tooltip)
   assets/              # Static vendor assets (Bootstrap, FontAwesome, images)
   pages/               # HTML page templates (home, build, details, equipment, settings, preview)
   scripts/             # Renderer JavaScript modules
     core/              # Core application logic (AppInitializer, Router, PageLoader, Character management, etc.)
     infrastructure/    # Base utilities (EventBus, Logger, Result types)
     modules/           # Feature-specific UI components (AbilityScoreCard, ClassCard, RaceCard, etc.)
     services/          # Data aggregation services (ClassService, RaceService, SpellService, ItemService, etc.)
     utils/             # Utility functions (DataLoader, TextProcessor, Tooltips, notifications, formatters, etc.)

 app/                   # Game data (5eTools JSON files)
   data/
     spells/
     class/
     bestiary/
     ...other D&D 5e data files

 tests/                 # Playwright test specs
 package.json
 README.md
 architecture-migration-plan.md  # Detailed migration history and status
```

### Architecture Principles

- **Electron separation:** Main process code isolated in `electron/` with no direct access to renderer code
- **Renderer isolation:** Renderer process in `renderer/` contains only browser-safe code; communicates with main via IPC
- **Co-located resources:** Each page lives in `renderer/pages/` with its HTML; related JavaScript in `renderer/scripts/`
- **Service layer:** Data aggregation handled by `renderer/scripts/services/` which call IPC endpoints via `DataLoader`
- **Module structure preserved:** `renderer/scripts/` maintains internal folder structure (core, infrastructure, modules, services, utils) for maintainability

## License

GPL-3.0-or-later

## Notes

- This is a **local-only** repository (no remote Git repository)
- Third-party assets (Bootstrap, FontAwesome) are installed via npm and copied during installation
- Large data files are excluded from version control
