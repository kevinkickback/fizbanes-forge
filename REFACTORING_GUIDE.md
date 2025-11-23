# Fizbane's Forge: Strategic Refactoring Guide

**Date:** November 21, 2025  
**Current State:** Functional but architecturally inconsistent  
**Goal:** Clean, maintainable, testable architecture without frameworks

---

## Executive Summary

Your codebase demonstrates strong modern JavaScript practices but suffers from architectural inconsistency due to multiple refactoring attempts. This guide provides a phased approach to consolidate these efforts into a cohesive architecture suitable for a vanilla JavaScript Electron application.

**Estimated Timeline:** 8-12 weeks (part-time)  
**Risk Level:** Medium (incremental approach minimizes breaking changes)  
**Expected Outcome:** Professional-grade, maintainable codebase

**Key Constraints:**
- **Sandboxed Renderer:** Node.js modules must remain in main.js (main process only)
- **Testing Framework:** Playwright (already configured) for end-to-end testing

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Recommended Architecture](#recommended-architecture)
3. [Phase 1: Foundation (Weeks 1-2)](#phase-1-foundation)
4. [Phase 2: Core Refactoring (Weeks 3-6)](#phase-2-core-refactoring)
5. [Phase 3: Polish & Testing (Weeks 7-10)](#phase-3-polish--testing)
6. [Phase 4: Optional Enhancements (Weeks 11-12)](#phase-4-optional-enhancements)
7. [Code Standards & Conventions](#code-standards--conventions)

---

## Current Architecture Analysis

### What Exists Today

```
app/
├── main.js (768 lines) ⚠️ MONOLITH
├── preload.js (security layer) ✅
├── index.html (1052 lines) ⚠️ TEMPLATE OVERLOAD
└── js/
    ├── core/ (7 files)
    │   ├── AppInitializer.js ✅
    │   ├── Character.js (711 lines) ⚠️
    │   ├── CharacterLifecycle.js (836 lines) ⚠️ MONOLITH
    │   ├── Navigation.js (692 lines) ⚠️
    │   ├── Modal.js ✅
    │   ├── Proficiency.js ✅
    │   └── Storage.js ✅
    ├── services/ (9 files) ✅ WELL-STRUCTURED
    ├── modules/ (card components) ✅ GOOD PATTERN
    └── utils/ (10 files) ✅ CLEAN
```

### Critical Issues

1. **Monolithic Files:** main.js, CharacterLifecycle.js, Navigation.js, Character.js
2. **Inconsistent State Management:** Multiple singletons holding state independently
3. **Circular Dependencies:** Services ↔ CharacterLifecycle ↔ Core
4. **Data Structure Inconsistency:** `allowedSources` uses Set/Array/Object interchangeably
5. **No Logging Strategy:** console.log pollution throughout
6. **Zero Test Coverage:** No testing infrastructure
7. **Error Handling Chaos:** Three different error return patterns

---

## Recommended Architecture

### Architectural Pattern: Layered + Event-Driven

For a vanilla JavaScript Electron app without frameworks, use a **modified Clean Architecture** approach:

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (UI Components, Pages, Templates)      │
│         [RENDERER PROCESS]              │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Application Layer (Core)           │
│  (State Management, Business Logic)     │
│         [RENDERER PROCESS]              │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│        Service Layer                    │
│  (Data Access via IPC)                  │
│         [RENDERER PROCESS]              │
└────────────┬────────────────────────────┘
             │ (IPC Communication)
┌────────────▼────────────────────────────┐
│       Infrastructure Layer              │
│  (IPC Handlers, File System, Storage)   │
│          [MAIN PROCESS]                 │
└─────────────────────────────────────────┘
```

**CRITICAL: Sandboxed Renderer Architecture**
- All Node.js modules (fs, path, etc.) MUST stay in main.js (main process)
- Renderer process communicates via IPC through preload.js
- No direct file system access from renderer
- Use contextBridge for secure IPC communication

### Key Principles

1. **Unidirectional Data Flow:** State flows down, events flow up
2. **Single Responsibility:** Each module has ONE job
3. **Dependency Inversion:** Depend on abstractions, not concretions
4. **Event-Driven Communication:** Loose coupling via EventBus
5. **Immutable State:** Never mutate state directly

---

## Phase 1: Foundation

**Duration:** Weeks 1-2  
**Goal:** Establish infrastructure without breaking existing functionality

### 1.1 Create Logging Service

**File:** `app/js/infrastructure/Logger.js`

**Note:** This Logger is for the renderer process only. The main process should use its own simple console logging or a separate logger since it has access to Node.js fs module for file logging.

```javascript
/**
 * Centralized logging service with configurable levels (Renderer Process)
 */
export class Logger {
    static LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        OFF: 4
    };

    static #currentLevel = Logger.LEVELS.INFO;
    static #logToFile = false;

    static setLevel(level) {
        this.#currentLevel = level;
    }

    static enableFileLogging() {
        this.#logToFile = true;
    }

    static #log(level, category, message, data = null) {
        if (this.#currentLevel > level) return;

        const timestamp = new Date().toISOString();
        const levelName = Object.keys(this.LEVELS).find(
            key => this.LEVELS[key] === level
        );
        
        const logMessage = `[${timestamp}] [${levelName}] [${category}] ${message}`;
        
        switch (level) {
            case Logger.LEVELS.DEBUG:
                console.debug(logMessage, data || '');
                break;
            case Logger.LEVELS.INFO:
                console.info(logMessage, data || '');
                break;
            case Logger.LEVELS.WARN:
                console.warn(logMessage, data || '');
                break;
            case Logger.LEVELS.ERROR:
                console.error(logMessage, data || '');
                break;
        }

        // TODO: Implement file logging in Phase 3
    }

    static debug(category, message, data) {
        this.#log(Logger.LEVELS.DEBUG, category, message, data);
    }

    static info(category, message, data) {
        this.#log(Logger.LEVELS.INFO, category, message, data);
    }

    static warn(category, message, data) {
        this.#log(Logger.LEVELS.WARN, category, message, data);
    }

    static error(category, message, data) {
        this.#log(Logger.LEVELS.ERROR, category, message, data);
    }
}

// Usage example:
// Logger.debug('CharacterStorage', 'Starting save', { id: character.id });
```

**Action Items:**
- [ ] Create `app/js/infrastructure/` directory
- [ ] Implement Logger.js
- [ ] Replace all console.log with Logger in ONE file (test file)
- [ ] Verify logging works
- [ ] Create script to batch-replace console.log across codebase

### 1.2 Standardize Error Handling

**File:** `app/js/infrastructure/Result.js`

```javascript
/**
 * Result type for consistent error handling
 * Based on Rust's Result<T, E> pattern
 */
export class Result {
    constructor(isSuccess, value, error = null) {
        this.success = isSuccess;
        this.value = value;
        this.error = error;
    }

    static ok(value) {
        return new Result(true, value, null);
    }

    static err(error) {
        return new Result(false, null, error);
    }

    isOk() {
        return this.success;
    }

    isErr() {
        return !this.success;
    }

    unwrap() {
        if (this.isErr()) {
            throw new Error(`Called unwrap on an Error: ${this.error}`);
        }
        return this.value;
    }

    unwrapOr(defaultValue) {
        return this.isOk() ? this.value : defaultValue;
    }

    map(fn) {
        return this.isOk() ? Result.ok(fn(this.value)) : this;
    }

    mapErr(fn) {
        return this.isErr() ? Result.err(fn(this.error)) : this;
    }
}

// Usage:
// const result = await characterService.save(character);
// if (result.isOk()) {
//     Logger.info('Save', 'Character saved', result.value);
// } else {
//     Logger.error('Save', 'Failed to save', result.error);
// }
```

**Action Items:**
- [ ] Create Result.js
- [ ] Update Storage.js to use Result pattern
- [ ] Document pattern in code standards
- [ ] Gradually migrate other services

### 1.3 Standardize Data Structures

**Decision Matrix:**

| Structure | Use Set | Use Array | Use Object |
|-----------|---------|-----------|------------|
| `allowedSources` | ✅ YES | No | No |
| `proficiencies.skills` | No | ✅ YES | No |
| `abilityScores` | No | No | ✅ YES |
| `features.resistances` | ✅ YES | No | No |

**File:** `app/js/core/CharacterSchema.js`

```javascript
/**
 * Defines the canonical character data schema
 * All character data MUST conform to this structure
 */
export class CharacterSchema {
    /**
     * Creates a new character with default values
     */
    static createDefault() {
        return {
            // Core Identity
            id: null,
            name: '',
            playerName: '',
            level: 1,
            
            // Race
            race: {
                name: '',
                source: '',
                subrace: ''
            },
            
            // Class
            class: {
                name: '',
                source: '',
                level: 1
            },
            subclass: '',
            background: '',
            
            // Sources: ALWAYS a Set, serialize to Array
            allowedSources: new Set(['PHB']),
            
            // Ability Scores: ALWAYS an object with numeric values
            abilityScores: {
                strength: 8,
                dexterity: 8,
                constitution: 8,
                intelligence: 8,
                wisdom: 8,
                charisma: 8
            },
            
            // Ability Bonuses: ALWAYS arrays of objects
            abilityBonuses: {
                strength: [],
                dexterity: [],
                constitution: [],
                intelligence: [],
                wisdom: [],
                charisma: []
            },
            
            // Features
            features: {
                darkvision: 0,
                resistances: new Set(), // ALWAYS a Set
                traits: new Map() // ALWAYS a Map
            },
            
            // Proficiencies: ALWAYS arrays
            proficiencies: {
                armor: [],
                weapons: [],
                tools: [],
                skills: [],
                languages: [],
                savingThrows: []
            },
            
            // Metadata
            lastModified: new Date().toISOString()
        };
    }

    /**
     * Validates a character object
     */
    static validate(character) {
        // Type checking
        if (!(character.allowedSources instanceof Set)) {
            return Result.err('allowedSources must be a Set');
        }
        
        if (!(character.features.resistances instanceof Set)) {
            return Result.err('features.resistances must be a Set');
        }
        
        // Add more validation as needed
        
        return Result.ok(true);
    }

    /**
     * Converts character to JSON-serializable format
     */
    static toJSON(character) {
        return {
            ...character,
            allowedSources: Array.from(character.allowedSources),
            features: {
                ...character.features,
                resistances: Array.from(character.features.resistances),
                traits: Object.fromEntries(character.features.traits)
            }
        };
    }

    /**
     * Restores character from JSON
     */
    static fromJSON(json) {
        return {
            ...json,
            allowedSources: new Set(json.allowedSources || ['PHB']),
            features: {
                ...json.features,
                resistances: new Set(json.features?.resistances || []),
                traits: new Map(Object.entries(json.features?.traits || {}))
            }
        };
    }
}
```

**Action Items:**
- [ ] Create CharacterSchema.js
- [ ] Update Character.js to use schema
- [ ] Update all services to respect schema
- [ ] Add schema validation on character load/save

---

## Phase 2: Core Refactoring

**Duration:** Weeks 3-6  
**Goal:** Break up monolithic files into focused modules

### 2.1 Split main.js (768 lines → ~200 lines)

**New Structure:**

```
app/
├── main.js (entry point only)
└── electron/
    ├── WindowManager.js
    ├── PreferencesManager.js
    └── ipc/
        ├── IPCRegistry.js
        ├── handlers/
        │   ├── CharacterHandlers.js
        │   ├── FileHandlers.js
        │   ├── SettingsHandlers.js
        │   └── DataHandlers.js
        └── channels.js (IPC channel constants)
```

**File:** `app/electron/ipc/channels.js`

```javascript
/**
 * Centralized IPC channel definitions
 * Prevents typos and makes channels discoverable
 */
export const IPC_CHANNELS = {
    // Character Operations
    CHARACTER_SAVE: 'character:save',
    CHARACTER_LOAD: 'character:load',
    CHARACTER_DELETE: 'character:delete',
    CHARACTER_IMPORT: 'character:import',
    CHARACTER_EXPORT: 'character:export',
    
    // File Operations
    FILE_SELECT_FOLDER: 'file:selectFolder',
    FILE_READ_JSON: 'file:readJson',
    FILE_LOAD_JSON: 'file:loadJson',
    
    // Settings
    SETTINGS_GET_PATH: 'settings:getPath',
    SETTINGS_SET_PATH: 'settings:setPath',
    
    // Utility
    UTIL_GENERATE_UUID: 'util:generateUUID',
    UTIL_GET_APP_DATA_PATH: 'util:getAppDataPath'
};
```

**File:** `app/electron/ipc/handlers/CharacterHandlers.js`

**CRITICAL:** This file runs in the main process and has full Node.js access. All file system operations MUST happen here, not in the renderer.

```javascript
import { IPC_CHANNELS } from '../channels.js';
import fs from 'node:fs';
import path from 'node:path';

// Note: Cannot import renderer-only modules here
// Use simple console logging or create a separate main process logger

/**
 * Handles all character-related IPC operations
 * This runs in the MAIN PROCESS with full Node.js access
 */
export class CharacterHandlers {
    constructor(preferencesManager) {
        this.preferencesManager = preferencesManager;
    }

    /**
     * Registers all character handlers with IPC
     */
    register(ipcMain) {
        ipcMain.handle(
            IPC_CHANNELS.CHARACTER_SAVE,
            (event, data) => this.handleSave(data)
        );
        
        ipcMain.handle(
            IPC_CHANNELS.CHARACTER_LOAD,
            () => this.handleLoad()
        );
        
        ipcMain.handle(
            IPC_CHANNELS.CHARACTER_DELETE,
            (event, id) => this.handleDelete(id)
        );
        
        // ... other handlers
    }

    /**
     * Saves a character to disk
     */
    async handleSave(serializedCharacter) {
        try {
            const character = JSON.parse(serializedCharacter);
            
            // Get save path
            const savePath = this.preferencesManager.getCharacterPath();
            
            // Ensure directory exists
            if (!fs.existsSync(savePath)) {
                fs.mkdirSync(savePath, { recursive: true });
            }

            // Find or create file path
            const filePath = await this._resolveFilePath(savePath, character);

            // Add metadata
            character.lastModified = new Date().toISOString();

            // Write file
            fs.writeFileSync(filePath, JSON.stringify(character, null, 2));
            
            console.log(`[Main] Character saved: ${character.name} -> ${filePath}`);

            return { success: true, path: filePath };
        } catch (error) {
            console.error('[Main] Failed to save character:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Loads all characters from disk
     */
    async handleLoad() {
        try {
            const savePath = this.preferencesManager.getCharacterPath();
            
            if (!fs.existsSync(savePath)) {
                return { success: true, characters: [] };
            }

            const files = fs.readdirSync(savePath)
                .filter(file => file.endsWith('.ffp'));

            const characters = [];
            
            for (const file of files) {
                try {
                    const filePath = path.join(savePath, file);
                    const data = fs.readFileSync(filePath, 'utf8');
                    const character = JSON.parse(data);
                    characters.push(character);
                } catch (err) {
                    console.warn(`[Main] Failed to load ${file}:`, err);
                }
            }

            console.log(`[Main] Loaded ${characters.length} characters`);
            return { success: true, characters };
        } catch (error) {
            console.error('[Main] Failed to load characters:', error);
            return { success: false, error: error.message };
        }
    }

    // ... other methods
}
```

**File:** `app/electron/ipc/IPCRegistry.js`

```javascript
import { CharacterHandlers } from './handlers/CharacterHandlers.js';
import { FileHandlers } from './handlers/FileHandlers.js';
import { SettingsHandlers } from './handlers/SettingsHandlers.js';

/**
 * Central registry for all IPC handlers
 */
export class IPCRegistry {
    constructor(ipcMain, preferencesManager) {
        this.ipcMain = ipcMain;
        this.preferencesManager = preferencesManager;
        this.handlers = [];
    }

    /**
     * Registers all IPC handlers
     */
    registerAll() {
        // Character handlers
        const characterHandlers = new CharacterHandlers(this.preferencesManager);
        characterHandlers.register(this.ipcMain);
        this.handlers.push(characterHandlers);

        // File handlers
        const fileHandlers = new FileHandlers(this.preferencesManager);
        fileHandlers.register(this.ipcMain);
        this.handlers.push(fileHandlers);

        // Settings handlers
        const settingsHandlers = new SettingsHandlers(this.preferencesManager);
        settingsHandlers.register(this.ipcMain);
        this.handlers.push(settingsHandlers);
    }
}
```

**Updated main.js:**

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { WindowManager } = require('./electron/WindowManager.js');
const { PreferencesManager } = require('./electron/PreferencesManager.js');
const { IPCRegistry } = require('./electron/ipc/IPCRegistry.js');

let windowManager;
let preferencesManager;
let ipcRegistry;

app.whenReady().then(() => {
    // Initialize managers
    preferencesManager = new PreferencesManager(app);
    windowManager = new WindowManager(path.join(__dirname, 'index.html'));
    
    // Register IPC handlers
    ipcRegistry = new IPCRegistry(
        require('electron').ipcMain,
        preferencesManager
    );
    ipcRegistry.registerAll();

    // Create main window
    windowManager.createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            windowManager.createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
```

**Action Items:**
- [ ] Create electron/ directory structure
- [ ] Implement IPCRegistry and channel constants
- [ ] Extract CharacterHandlers (test first!)
- [ ] Extract FileHandlers
- [ ] Extract SettingsHandlers
- [ ] Update main.js to use new structure
- [ ] Test thoroughly before committing

### 2.2 Split CharacterLifecycle.js (836 lines → ~150 lines each)

**Current Responsibilities (Too Many!):**
- Character selection/creation
- Character loading/saving
- Import/export
- UI updates
- Event handling
- Modal management
- Change tracking

**New Structure:**

```
app/js/application/
├── CharacterManager.js      (selection, creation, deletion)
├── CharacterLoader.js        (loading, saving)
├── CharacterImporter.js      (import/export)
├── ChangeTracker.js          (unsaved changes)
└── AppState.js               (centralized state)
```

**File:** `app/js/application/AppState.js`

```javascript
import { EventEmitter } from '../utils/EventBus.js';
import { Logger } from '../infrastructure/Logger.js';

/**
 * Centralized application state management
 * Single source of truth for app state
 */
export class AppState extends EventEmitter {
    #state = {
        // Current character
        currentCharacter: null,
        
        // Navigation
        currentPage: 'home',
        
        // UI State
        isLoading: false,
        hasUnsavedChanges: false,
        
        // Available data
        characters: [],
        
        // Settings
        settings: {}
    };

    /**
     * Gets the current state (read-only)
     */
    getState() {
        return { ...this.#state };
    }

    /**
     * Gets a specific state value
     */
    get(key) {
        return this.#state[key];
    }

    /**
     * Updates state and notifies listeners
     */
    setState(updates) {
        const oldState = { ...this.#state };
        this.#state = { ...this.#state, ...updates };
        
        Logger.debug('AppState', 'State updated', {
            changed: Object.keys(updates)
        });

        // Emit general state change
        this.emit('stateChanged', this.#state, oldState);

        // Emit specific change events
        for (const key of Object.keys(updates)) {
            if (oldState[key] !== this.#state[key]) {
                this.emit(`${key}Changed`, this.#state[key], oldState[key]);
            }
        }
    }

    /**
     * Sets the current character
     */
    setCharacter(character) {
        this.setState({
            currentCharacter: character,
            hasUnsavedChanges: false
        });
    }

    /**
     * Gets the current character
     */
    getCharacter() {
        return this.#state.currentCharacter;
    }

    /**
     * Marks state as having unsaved changes
     */
    markDirty() {
        if (!this.#state.hasUnsavedChanges) {
            this.setState({ hasUnsavedChanges: true });
        }
    }

    /**
     * Clears unsaved changes flag
     */
    markClean() {
        if (this.#state.hasUnsavedChanges) {
            this.setState({ hasUnsavedChanges: false });
        }
    }

    /**
     * Navigates to a new page
     */
    navigateTo(page) {
        this.setState({ currentPage: page });
    }
}

// Export singleton instance
export const appState = new AppState();
```

**File:** `app/js/application/CharacterManager.js`

```javascript
import { appState } from './AppState.js';
import { Logger } from '../infrastructure/Logger.js';
import { Character } from '../core/Character.js';
import { showNotification } from '../utils/Notifications.js';

/**
 * Manages character lifecycle (create, select, delete)
 */
export class CharacterManager {
    /**
     * Creates a new character
     */
    async createCharacter(characterData) {
        try {
            Logger.info('CharacterManager', 'Creating new character', {
                name: characterData.name
            });

            // Create character instance
            const character = new Character(characterData);

            // Generate UUID if not provided
            if (!character.id) {
                character.id = await window.electron.generateUUID();
            }

            // Set as current character
            appState.setCharacter(character);

            // Notify
            showNotification(`Created character: ${character.name}`, 'success');

            return Result.ok(character);
        } catch (error) {
            Logger.error('CharacterManager', 'Failed to create character', error);
            return Result.err(error.message);
        }
    }

    /**
     * Selects an existing character
     */
    selectCharacter(character) {
        Logger.info('CharacterManager', 'Selecting character', {
            id: character.id,
            name: character.name
        });

        appState.setCharacter(character);
    }

    /**
     * Deletes a character
     */
    async deleteCharacter(characterId) {
        try {
            Logger.info('CharacterManager', 'Deleting character', { id: characterId });

            // Delete from storage
            const result = await window.characterStorage.deleteCharacter(characterId);

            if (!result.success) {
                throw new Error(result.error);
            }

            // Update state
            const characters = appState.get('characters')
                .filter(c => c.id !== characterId);
            appState.setState({ characters });

            // Clear current character if it was deleted
            if (appState.getCharacter()?.id === characterId) {
                appState.setCharacter(null);
            }

            showNotification('Character deleted', 'success');
            return Result.ok(true);
        } catch (error) {
            Logger.error('CharacterManager', 'Failed to delete character', error);
            showNotification('Failed to delete character', 'error');
            return Result.err(error.message);
        }
    }
}

// Export singleton
export const characterManager = new CharacterManager();
```

**Action Items:**
- [ ] Create application/ directory
- [ ] Implement AppState (test state management!)
- [ ] Implement CharacterManager
- [ ] Implement CharacterLoader
- [ ] Implement ChangeTracker
- [ ] Update CharacterLifecycle to delegate to new classes
- [ ] Update all references to use appState instead of direct access
- [ ] Remove old CharacterLifecycle after migration

### 2.3 Split Navigation.js (692 lines → ~200 lines each)

**New Structure:**

```
app/js/presentation/
├── Router.js              (route management)
├── PageLoader.js          (template loading)
├── ComponentRegistry.js   (UI component lifecycle)
└── NavigationController.js (ties it together)
```

**File:** `app/js/presentation/Router.js`

```javascript
import { appState } from '../application/AppState.js';
import { Logger } from '../infrastructure/Logger.js';

/**
 * Handles routing and navigation
 */
export class Router {
    #routes = new Map();
    #currentRoute = null;

    /**
     * Registers a route
     */
    register(path, config) {
        this.#routes.set(path, {
            template: config.template,
            requiresCharacter: config.requiresCharacter || false,
            onEnter: config.onEnter || (() => {}),
            onLeave: config.onLeave || (() => {})
        });
    }

    /**
     * Navigates to a route
     */
    async navigate(path) {
        const route = this.#routes.get(path);
        
        if (!route) {
            Logger.error('Router', `Route not found: ${path}`);
            return false;
        }

        // Check if character is required
        if (route.requiresCharacter && !appState.getCharacter()) {
            Logger.warn('Router', 'Route requires character', { path });
            showNotification('Please select or create a character first', 'warning');
            return false;
        }

        // Call onLeave for current route
        if (this.#currentRoute) {
            const currentRoute = this.#routes.get(this.#currentRoute);
            await currentRoute.onLeave();
        }

        // Call onEnter for new route
        await route.onEnter();

        // Update state
        this.#currentRoute = path;
        appState.navigateTo(path);

        Logger.debug('Router', 'Navigated to route', { path });
        return true;
    }

    /**
     * Gets the current route
     */
    getCurrentRoute() {
        return this.#currentRoute;
    }
}

// Export singleton
export const router = new Router();

// Register routes
router.register('home', {
    template: 'homePage',
    requiresCharacter: false
});

router.register('build', {
    template: 'buildPage',
    requiresCharacter: true,
    onEnter: async () => {
        // Initialize build page components
    }
});

router.register('equipment', {
    template: 'equipmentPage',
    requiresCharacter: true
});

router.register('details', {
    template: 'detailsPage',
    requiresCharacter: true
});

router.register('settings', {
    template: 'settingsPage',
    requiresCharacter: false
});
```

**Action Items:**
- [ ] Create presentation/ directory
- [ ] Implement Router
- [ ] Implement PageLoader
- [ ] Implement ComponentRegistry
- [ ] Update Navigation to use new structure
- [ ] Test navigation thoroughly

### 2.4 Refactor Character.js (711 lines → ~300 lines)

**Extract to separate files:**

```
app/js/domain/
├── Character.js              (core model - 300 lines)
├── CharacterSerializer.js    (serialization logic)
├── ProficiencyManager.js     (proficiency tracking)
└── AbilityManager.js         (ability score logic)
```

**File:** `app/js/domain/Character.js` (simplified)

```javascript
import { CharacterSchema } from '../core/CharacterSchema.js';

/**
 * Character domain model
 * Pure data with minimal logic
 */
export class Character {
    constructor(data = {}) {
        // Use schema for defaults
        const defaults = CharacterSchema.createDefault();
        
        // Merge with provided data
        Object.assign(this, defaults, data);
        
        // Restore complex types
        if (data.allowedSources) {
            this.allowedSources = new Set(
                Array.isArray(data.allowedSources)
                    ? data.allowedSources
                    : ['PHB']
            );
        }
    }

    // Simple getters/setters only
    // No complex business logic
}
```

**Action Items:**
- [ ] Create domain/ directory
- [ ] Extract CharacterSerializer
- [ ] Extract ProficiencyManager
- [ ] Simplify Character.js
- [ ] Update all references

---

## Phase 3: Polish & Testing

**Duration:** Weeks 7-10  
**Goal:** Production-ready quality

### 3.1 Implement Testing Infrastructure

**Testing Strategy:**

Your project already uses **Playwright** for end-to-end testing. This is the right choice for Electron apps with sandboxed renderers.

**File:** `playwright.config.js` (already exists)

```javascript
// Configure Playwright for Electron testing
module.exports = {
    testDir: './tests',
    testMatch: '**/*.spec.js',
    timeout: 30000,
    use: {
        // Electron-specific configuration
    }
};
```

**Test Structure:**

```
tests/
├── character-creation.spec.js
├── character-save-load.spec.js
├── navigation.spec.js
├── equipment.spec.js
└── settings.spec.js
```

**Note:** Since the renderer is sandboxed, unit tests for individual modules are limited. Focus on:
1. End-to-end tests with Playwright (full app testing)
2. Main process unit tests (can use Node.js test runners)
3. Renderer logic tests (pure functions without Node dependencies)

**Example Test:**

```javascript
// tests/character-creation.spec.js
const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

test.describe('Character Creation', () => {
    let electronApp;
    let window;

    test.beforeEach(async () => {
        electronApp = await electron.launch({ args: ['./app/main.js'] });
        window = await electronApp.firstWindow();
    });

    test.afterEach(async () => {
        await electronApp.close();
    });

    test('creates a new character', async () => {
        // Click new character button
        await window.click('#new-character-btn');
        
        // Fill in character details
        await window.fill('#character-name', 'Test Character');
        await window.selectOption('#race-select', 'Human');
        
        // Save character
        await window.click('#save-btn');
        
        // Verify character appears in list
        const characterName = await window.textContent('.character-card .name');
        expect(characterName).toBe('Test Character');
    });

    test('navigates between pages', async () => {
        await window.click('#build-tab');
        const pageTitle = await window.textContent('#page-title');
        expect(pageTitle).toContain('Build');
    });
});
```

**Action Items:**
- [ ] Review existing Playwright configuration
- [ ] Create comprehensive E2E test suite
- [ ] Write tests for character creation workflow
- [ ] Write tests for save/load functionality
- [ ] Write tests for navigation between pages
- [ ] Write tests for equipment management
- [ ] Write tests for settings/preferences
- [ ] Run tests: `npx playwright test`
- [ ] Run tests with UI: `npx playwright test --ui`

### 3.2 Extract HTML Templates

**Current:** 1052-line index.html  
**Target:** ~200 lines with external templates

**New Structure:**

```
app/templates/
├── home.html
├── build.html
├── equipment.html
├── details.html
├── settings.html
└── modals/
    ├── newCharacter.html
    └── confirmation.html
```

**File:** `app/js/presentation/TemplateLoader.js`

```javascript
/**
 * Loads HTML templates dynamically
 */
export class TemplateLoader {
    #cache = new Map();

    async load(templateName) {
        if (this.#cache.has(templateName)) {
            return this.#cache.get(templateName);
        }

        const response = await fetch(`templates/${templateName}.html`);
        const html = await response.text();
        
        this.#cache.set(templateName, html);
        return html;
    }

    clearCache() {
        this.#cache.clear();
    }
}
```

**Action Items:**
- [ ] Create templates/ directory
- [ ] Extract each page template
- [ ] Implement TemplateLoader
- [ ] Update PageLoader to use TemplateLoader
- [ ] Test template loading

### 3.3 Add ESLint Configuration

**File:** `.eslintrc.json`

```json
{
    "env": {
        "browser": true,
        "es2021": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "rules": {
        "no-console": ["warn", {
            "allow": ["error", "warn"]
        }],
        "no-unused-vars": ["error", {
            "argsIgnorePattern": "^_"
        }],
        "prefer-const": "error",
        "no-var": "error",
        "eqeqeq": ["error", "always"],
        "curly": ["error", "all"],
        "brace-style": ["error", "1tbs"]
    }
}
```

**Action Items:**
- [ ] Install ESLint
- [ ] Configure rules
- [ ] Fix all linting errors
- [ ] Add to pre-commit hooks

---

## Phase 4: Optional Enhancements

**Duration:** Weeks 11-12  
**Goal:** Modern tooling and DX improvements

### 4.1 Consider TypeScript Migration

**Benefits:**
- Type safety
- Better IDE support
- Catch errors at compile time
- Self-documenting code

**Approach:**
- Rename .js → .ts gradually
- Start with domain layer
- Add type definitions
- Use strict mode

### 4.2 Add Build Pipeline

**Tools:**
- Vite (fast bundling)
- esbuild (fast compilation)
- electron-builder (already have it)

**Benefits:**
- Code splitting
- Tree shaking
- Minification
- Source maps

### 4.3 Add Hot Reload for Development

**File:** `package.json`

```json
{
    "scripts": {
        "start": "electron .",
        "dev": "electronmon .",
        "test": "jest",
        "test:watch": "jest --watch",
        "lint": "eslint app/js",
        "lint:fix": "eslint app/js --fix"
    }
}
```

---

## Code Standards & Conventions

### File Organization

```
app/
├── electron/               # Electron main process
│   ├── WindowManager.js
│   ├── PreferencesManager.js
│   └── ipc/
├── js/
│   ├── infrastructure/     # Low-level utilities
│   │   ├── Logger.js
│   │   └── Result.js
│   ├── domain/            # Business models
│   │   ├── Character.js
│   │   └── CharacterSchema.js
│   ├── application/       # Business logic
│   │   ├── AppState.js
│   │   └── CharacterManager.js
│   ├── presentation/      # UI logic
│   │   ├── Router.js
│   │   └── PageLoader.js
│   ├── services/          # External data access
│   │   ├── ClassService.js
│   │   └── RaceService.js
│   └── utils/             # Helpers
└── templates/             # HTML templates
```

### Naming Conventions

```javascript
// Classes: PascalCase
class CharacterManager {}

// Files: Match class name
// CharacterManager.js

// Constants: SCREAMING_SNAKE_CASE
const MAX_LEVEL = 20;

// Functions/Methods: camelCase
function calculateModifier() {}

// Private fields: # prefix
#privateField = null;

// Boolean: is/has prefix
isValid, hasChanges

// Event handlers: handle prefix
handleCharacterChange()
```

### Import Order

```javascript
// 1. Node built-ins
import fs from 'node:fs';
import path from 'node:path';

// 2. External packages
import { app, BrowserWindow } from 'electron';

// 3. Internal - infrastructure
import { Logger } from '../infrastructure/Logger.js';

// 4. Internal - application
import { appState } from '../application/AppState.js';

// 5. Internal - domain
import { Character } from '../domain/Character.js';

// 6. Internal - utils
import { formatDate } from '../utils/DateFormatter.js';
```

### JSDoc Standards

```javascript
/**
 * Brief description of the function
 * 
 * Longer description if needed, explaining
 * what the function does and why.
 * 
 * @param {string} name - Parameter description
 * @param {Object} options - Options object
 * @param {boolean} options.force - Force flag
 * @returns {Promise<Result<Character, Error>>} Result object
 * @throws {ValidationError} When validation fails
 * 
 * @example
 * const result = await createCharacter('Gandalf', { force: true });
 * if (result.isOk()) {
 *     console.log('Created:', result.value);
 * }
 */
async function createCharacter(name, options = {}) {
    // ...
}
```

### Error Handling Pattern

```javascript
// Use Result type for expected errors
async function loadCharacter(id) {
    try {
        const data = await storage.load(id);
        return Result.ok(data);
    } catch (error) {
        Logger.error('CharacterLoad', 'Failed to load', error);
        return Result.err(error.message);
    }
}

// Throw for unexpected errors
function calculateDamage(roll) {
    if (typeof roll !== 'number') {
        throw new TypeError('Roll must be a number');
    }
    return roll + modifier;
}
```

### Logging Levels

```javascript
// DEBUG: Detailed diagnostic information
Logger.debug('DataLoader', 'Cache hit', { key: 'races' });

// INFO: General informational messages
Logger.info('CharacterSave', 'Character saved', { id: '123' });

// WARN: Warning messages for recoverable issues
Logger.warn('CharacterLoad', 'Missing field', { field: 'race' });

// ERROR: Error messages for failures
Logger.error('CharacterSave', 'Failed to save', error);
```

---

## Migration Checklist

### Pre-Migration
- [ ] Create feature branch: `refactor/phase-1`
- [ ] Backup current codebase
- [ ] Document current functionality
- [ ] Verify Playwright tests run: `npx playwright test`
- [ ] Review preload.js security boundary
- [ ] Confirm Node.js modules are only in main process

### Phase 1 Checklist
- [ ] Create infrastructure/ directory
- [ ] Implement Logger.js
- [ ] Implement Result.js
- [ ] Create CharacterSchema.js
- [ ] Replace console.log in one file (test)
- [ ] Replace console.log everywhere
- [ ] Update one service to use Result
- [ ] Commit and test thoroughly

### Phase 2 Checklist
- [ ] Create electron/ directory structure
- [ ] Extract IPC handlers
- [ ] Test IPC thoroughly
- [ ] Create application/ directory
- [ ] Implement AppState
- [ ] Implement CharacterManager
- [ ] Create presentation/ directory
- [ ] Implement Router
- [ ] Create domain/ directory
- [ ] Refactor Character.js
- [ ] Commit and test thoroughly

### Phase 3 Checklist
- [ ] Write comprehensive Playwright E2E tests
- [ ] Cover all major user workflows
- [ ] Test IPC communication thoroughly
- [ ] Extract HTML templates
- [ ] Install ESLint
- [ ] Fix all linting errors
- [ ] Commit and test thoroughly

### Phase 4 Checklist (Optional)
- [ ] Evaluate TypeScript
- [ ] Set up build pipeline
- [ ] Add hot reload
- [ ] Commit and test thoroughly

---

## Success Metrics

### Code Quality
- [ ] All files under 400 lines
- [ ] Test coverage > 70%
- [ ] Zero ESLint errors
- [ ] Zero console.log statements
- [ ] Consistent error handling

### Architecture
- [ ] Clear separation of concerns
- [ ] No circular dependencies
- [ ] Single source of truth (AppState)
- [ ] Consistent data structures
- [ ] Proper abstraction layers

### Developer Experience
- [ ] Fast iteration (hot reload)
- [ ] Clear file organization
- [ ] Good error messages
- [ ] Comprehensive logging
- [ ] Easy to onboard new developers

---

## Conclusion

This refactoring will transform your codebase from "functional but messy" to "professional and maintainable." The phased approach minimizes risk while delivering incremental value.

**Key Takeaways:**
1. Don't rewrite from scratch - refactor incrementally
2. Test at every step
3. Commit frequently
4. Each phase should leave the code in a working state
5. Prioritize infrastructure (logging, error handling) first

**Estimated Effort:**
- Phase 1: 20 hours
- Phase 2: 40 hours  
- Phase 3: 30 hours
- Phase 4: 20 hours
- **Total: 110 hours (3 months part-time)**

Good luck with the refactoring! This is a worthwhile investment that will pay dividends in maintainability and feature velocity.
