# Phase 2: Main Process Refactoring - IPC Layer

**Objective:** Refactor main.js from 768 lines into modular IPC handlers and managers.

**Duration:** Week 2 (12-16 hours)

**Files Created:** 9 files

**Files Modified:** 2 files (main.js, preload.js)

**Dependencies:** Phase 1 (Logger, Result, EventBus)

---

## Final Architecture Reference

After completing this phase, you will have:

```
app/
├── main.js                                    (~200 lines) - Entry point only
├── preload.js                                 (~80 lines) - Security boundary
│
└── electron/
    ├── WindowManager.js                       (~150 lines) - Window lifecycle
    ├── PreferencesManager.js                  (~180 lines) - User preferences
    │
    └── ipc/
        ├── IPCRegistry.js                     (~120 lines) - Handler registration
        ├── channels.js                        (~80 lines) - Channel constants
        │
        └── handlers/
            ├── CharacterHandlers.js           (~200 lines) - Character CRUD
            ├── FileHandlers.js                (~150 lines) - File operations
            ├── SettingsHandlers.js            (~120 lines) - Settings management
            └── DataHandlers.js                (~100 lines) - Data loading
```

**Phase Outcomes:**
- main.js reduced from 768 lines to ~200 lines
- All IPC handlers organized by responsibility
- Clear separation between window management, preferences, and IPC
- All Node.js file system operations isolated in main process

---

## Phase Overview

This phase splits the monolithic main.js into focused modules:

1. **WindowManager.js** - BrowserWindow creation and lifecycle
2. **PreferencesManager.js** - User preferences storage and retrieval
3. **IPC Handlers** - Split by domain (Character, File, Settings, Data)
4. **IPCRegistry.js** - Central registration of all IPC handlers
5. **channels.js** - IPC channel name constants

**Why This Phase:**
- main.js is 768 lines (too large)
- All IPC handlers mixed together (hard to maintain)
- Window management mixed with business logic
- Preferences scattered throughout file
- Setting up proper IPC architecture for future phases

---

## Prerequisites Validation

Run these commands before starting:

```powershell
# 1. Verify Phase 1 is complete
Test-Path app/js/infrastructure/Logger.js  # Must return True
Test-Path app/js/infrastructure/Result.js  # Must return True
Test-Path app/js/infrastructure/EventBus.js  # Must return True

# 2. Verify Phase 1 tests pass
npx playwright test tests/unit/  # Must show 59 passed

# 3. Verify correct branch
git branch --show-current  # Must show: refactor

# 4. Check working directory
git status  # Should show clean or only docs changes
```

**If ANY check fails, STOP. Complete Phase 1 first or fix issues.**

---

## Current main.js Analysis

Before refactoring, understand what main.js currently does:

**Line Count:** 768 lines

**Responsibilities (TOO MANY):**
- Electron app lifecycle (ready, quit, activate)
- BrowserWindow creation and management
- Preferences storage (electron-store)
- Character IPC handlers (save, load, delete, import, export)
- File IPC handlers (file selection, JSON reading)
- Settings IPC handlers (path management)
- Data IPC handlers (D&D data loading)
- Utility IPC handlers (path joins, etc.)

**Problems:**
- Single file doing 8 different things
- Hard to test individual responsibilities
- Hard to find specific IPC handlers
- Mixing Node.js code with Electron code
- No consistent error handling

**Solution:**
- Extract each responsibility into its own file
- Group IPC handlers by domain
- Use consistent patterns across all handlers
- Make testing easier

---

## Step 1: Create channels.js

**Objective:** Define all IPC channel names in one place.

**Time Estimate:** 30 minutes

**Why First:** All other files will reference these constants.

### 1.1: Create IPC Directory Structure

```powershell
New-Item -ItemType Directory -Path "app/electron/ipc/handlers" -Force
```

### 1.2: Create channels.js

Create file `app/electron/ipc/channels.js` with this COMPLETE code:

```javascript
/**
 * IPC Channel name constants.
 * 
 * ARCHITECTURE: Main Process - Shared Constants
 * 
 * PURPOSE:
 * - Single source of truth for all IPC channel names
 * - Prevents typos in channel names
 * - Makes it easy to see all available IPC operations
 * - Used by both main process handlers and preload script
 * 
 * USAGE:
 *   const { IPC_CHANNELS } = require('./ipc/channels');
 *   ipcMain.handle(IPC_CHANNELS.CHARACTER_SAVE, async (event, data) => {});
 * 
 * @module electron/ipc/channels
 */

const IPC_CHANNELS = {
  // Character operations
  CHARACTER_SAVE: 'character:save',
  CHARACTER_LOAD: 'character:load',
  CHARACTER_DELETE: 'character:delete',
  CHARACTER_LIST: 'character:list',
  CHARACTER_IMPORT: 'character:import',
  CHARACTER_EXPORT: 'character:export',
  
  // File operations
  FILE_SELECT: 'file:select',
  FILE_READ_JSON: 'file:readJson',
  FILE_WRITE_JSON: 'file:writeJson',
  FILE_EXISTS: 'file:exists',
  FILE_DELETE: 'file:delete',
  
  // Settings operations
  SETTINGS_GET_PATH: 'settings:getPath',
  SETTINGS_SET_PATH: 'settings:setPath',
  SETTINGS_GET_ALL: 'settings:getAll',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET: 'settings:get',
  
  // Data operations (D&D data files)
  DATA_LOAD_CLASSES: 'data:loadClasses',
  DATA_LOAD_RACES: 'data:loadRaces',
  DATA_LOAD_BACKGROUNDS: 'data:loadBackgrounds',
  DATA_LOAD_SPELLS: 'data:loadSpells',
  DATA_LOAD_EQUIPMENT: 'data:loadEquipment',
  DATA_LOAD_FEATS: 'data:loadFeats',
  DATA_LOAD_JSON: 'data:loadJson',
  
  // Utility operations
  UTIL_PATH_JOIN: 'util:pathJoin',
  UTIL_GET_APP_PATH: 'util:getAppPath',
  UTIL_GET_USER_DATA: 'util:getUserData'
};

module.exports = { IPC_CHANNELS };
```

**Validation:**
- [ ] File created at `app/electron/ipc/channels.js`
- [ ] File contains all channel definitions
- [ ] No syntax errors

---

## Step 2: Create PreferencesManager.js

**Objective:** Extract preferences management from main.js.

**Time Estimate:** 1 hour

### 2.1: Create PreferencesManager.js

Create file `app/electron/PreferencesManager.js` with this COMPLETE code:

```javascript
/**
 * Manages application preferences using electron-store.
 * 
 * ARCHITECTURE: Main Process - User Preferences
 * 
 * PURPOSE:
 * - Centralized preferences storage and retrieval
 * - Default values for all preferences
 * - Type-safe preference access
 * - Preference validation
 * 
 * USAGE:
 *   const prefs = new PreferencesManager(app);
 *   const savePath = prefs.get('characterSavePath');
 *   prefs.set('characterSavePath', '/new/path');
 * 
 * @module electron/PreferencesManager
 */

const Store = require('electron-store');
const path = require('path');

class PreferencesManager {
  constructor(app) {
    this.app = app;
    
    // Initialize electron-store with schema
    this.store = new Store({
      schema: {
        characterSavePath: {
          type: 'string',
          default: path.join(app.getPath('documents'), 'Fizbanes Forge', 'characters')
        },
        lastOpenedCharacter: {
          type: ['string', 'null'],
          default: null
        },
        windowBounds: {
          type: 'object',
          properties: {
            width: { type: 'number', default: 1200 },
            height: { type: 'number', default: 800 },
            x: { type: ['number', 'null'], default: null },
            y: { type: ['number', 'null'], default: null }
          },
          default: { width: 1200, height: 800, x: null, y: null }
        },
        theme: {
          type: 'string',
          enum: ['light', 'dark', 'auto'],
          default: 'auto'
        },
        logLevel: {
          type: 'string',
          enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
          default: 'INFO'
        },
        autoSave: {
          type: 'boolean',
          default: true
        },
        autoSaveInterval: {
          type: 'number',
          minimum: 30,
          maximum: 600,
          default: 60
        }
      }
    });

    console.log('[PreferencesManager] Initialized with store:', this.store.path);
  }

  /**
   * Get a preference value.
   * @param {string} key - Preference key
   * @param {*} defaultValue - Optional default if key not found
   * @returns {*} Preference value
   */
  get(key, defaultValue = undefined) {
    const value = this.store.get(key, defaultValue);
    console.log(`[PreferencesManager] Get: ${key} =`, value);
    return value;
  }

  /**
   * Set a preference value.
   * @param {string} key - Preference key
   * @param {*} value - Value to set
   */
  set(key, value) {
    console.log(`[PreferencesManager] Set: ${key} =`, value);
    this.store.set(key, value);
  }

  /**
   * Delete a preference.
   * @param {string} key - Preference key
   */
  delete(key) {
    console.log(`[PreferencesManager] Delete: ${key}`);
    this.store.delete(key);
  }

  /**
   * Check if a preference exists.
   * @param {string} key - Preference key
   * @returns {boolean} True if preference exists
   */
  has(key) {
    return this.store.has(key);
  }

  /**
   * Get all preferences.
   * @returns {object} All preferences
   */
  getAll() {
    return this.store.store;
  }

  /**
   * Clear all preferences (reset to defaults).
   */
  clear() {
    console.log('[PreferencesManager] Clearing all preferences');
    this.store.clear();
  }

  /**
   * Get the character save path, ensuring it exists.
   * @returns {string} Character save path
   */
  getCharacterSavePath() {
    const fs = require('fs');
    const savePath = this.get('characterSavePath');
    
    // Ensure directory exists
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
      console.log('[PreferencesManager] Created character save directory:', savePath);
    }
    
    return savePath;
  }

  /**
   * Get window bounds with fallback to defaults.
   * @returns {object} Window bounds {width, height, x, y}
   */
  getWindowBounds() {
    return this.get('windowBounds', { width: 1200, height: 800, x: null, y: null });
  }

  /**
   * Save window bounds.
   * @param {object} bounds - Window bounds {width, height, x, y}
   */
  setWindowBounds(bounds) {
    this.set('windowBounds', bounds);
  }

  /**
   * Get the last opened character path.
   * @returns {string|null} Last character path or null
   */
  getLastOpenedCharacter() {
    return this.get('lastOpenedCharacter');
  }

  /**
   * Set the last opened character path.
   * @param {string|null} characterPath - Character file path
   */
  setLastOpenedCharacter(characterPath) {
    this.set('lastOpenedCharacter', characterPath);
  }
}

module.exports = { PreferencesManager };
```

**Validation:**
- [ ] File created at `app/electron/PreferencesManager.js`
- [ ] File is approximately 180 lines
- [ ] No syntax errors

---

## Step 3: Create WindowManager.js

**Objective:** Extract window management from main.js.

**Time Estimate:** 1 hour

### 3.1: Create WindowManager.js

Create file `app/electron/WindowManager.js` with this COMPLETE code:

```javascript
/**
 * Manages Electron BrowserWindow lifecycle.
 * 
 * ARCHITECTURE: Main Process - Window Management
 * 
 * PURPOSE:
 * - Create and configure main window
 * - Handle window events (close, resize, move)
 * - Save/restore window state
 * - Manage window lifecycle
 * 
 * USAGE:
 *   const wm = new WindowManager(preferencesManager, __dirname);
 *   const mainWindow = wm.createMainWindow();
 * 
 * @module electron/WindowManager
 */

const { BrowserWindow } = require('electron');
const path = require('path');

class WindowManager {
  constructor(preferencesManager, appPath) {
    this.preferencesManager = preferencesManager;
    this.appPath = appPath;
    this.mainWindow = null;
  }

  /**
   * Create the main application window.
   * @returns {BrowserWindow} The created window
   */
  createMainWindow() {
    console.log('[WindowManager] Creating main window');

    // Get saved window bounds
    const bounds = this.preferencesManager.getWindowBounds();

    // Create window with saved bounds
    this.mainWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        preload: path.join(this.appPath, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      },
      show: false // Don't show until ready
    });

    // Load the app
    this.mainWindow.loadFile(path.join(this.appPath, 'index.html'));

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      console.log('[WindowManager] Window ready to show');
      this.mainWindow.show();
    });

    // Setup window event handlers
    this.setupWindowEvents();

    console.log('[WindowManager] Main window created');
    return this.mainWindow;
  }

  /**
   * Setup window event handlers.
   * @private
   */
  setupWindowEvents() {
    // Save window bounds on close
    this.mainWindow.on('close', () => {
      const bounds = this.mainWindow.getBounds();
      this.preferencesManager.setWindowBounds(bounds);
      console.log('[WindowManager] Window bounds saved:', bounds);
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      console.log('[WindowManager] Window closed');
      this.mainWindow = null;
    });

    // Optional: Log window events for debugging
    this.mainWindow.on('resize', () => {
      // Don't log every resize, too noisy
    });

    this.mainWindow.on('move', () => {
      // Don't log every move, too noisy
    });

    this.mainWindow.on('focus', () => {
      console.log('[WindowManager] Window focused');
    });

    this.mainWindow.on('blur', () => {
      console.log('[WindowManager] Window blurred');
    });
  }

  /**
   * Get the main window instance.
   * @returns {BrowserWindow|null} Main window or null
   */
  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * Check if main window exists and is not destroyed.
   * @returns {boolean} True if window exists
   */
  hasWindow() {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed();
  }

  /**
   * Close the main window.
   */
  closeWindow() {
    if (this.hasWindow()) {
      console.log('[WindowManager] Closing window');
      this.mainWindow.close();
    }
  }

  /**
   * Minimize the main window.
   */
  minimizeWindow() {
    if (this.hasWindow()) {
      this.mainWindow.minimize();
    }
  }

  /**
   * Maximize the main window.
   */
  maximizeWindow() {
    if (this.hasWindow()) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    }
  }

  /**
   * Open DevTools.
   */
  openDevTools() {
    if (this.hasWindow()) {
      this.mainWindow.webContents.openDevTools();
    }
  }
}

module.exports = { WindowManager };
```

**Validation:**
- [ ] File created at `app/electron/WindowManager.js`
- [ ] File is approximately 150 lines
- [ ] No syntax errors

---

## Step 4: Create CharacterHandlers.js

**Objective:** Extract all character-related IPC handlers.

**Time Estimate:** 1.5 hours

### 4.1: Read Current Character Handlers

Current handlers in main.js (lines 114-453):
- `saveCharacter` - Save character to disk
- `loadCharacters` - Load all characters
- `deleteCharacter` - Delete character file
- `generatePDF` - Export character to PDF
- `exportCharacter` - Export character to .ffp
- `importCharacter` - Import character from file
- `generateUUID` - Generate character ID

### 4.2: Create CharacterHandlers.js

Create file `app/electron/ipc/handlers/CharacterHandlers.js`:

```javascript
/**
 * IPC handlers for character operations.
 * 
 * @module electron/ipc/handlers/CharacterHandlers
 */

const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument } = require('pdf-lib');
const { IPC_CHANNELS } = require('../channels');

function registerCharacterHandlers(preferencesManager, windowManager) {
  console.log('[CharacterHandlers] Registering character handlers');

  // Save character
  ipcMain.handle(IPC_CHANNELS.CHARACTER_SAVE, async (event, serializedCharacter) => {
    try {
      console.log('[CharacterHandlers] Saving character:', serializedCharacter.id);
      
      const savePath = preferencesManager.getCharacterSavePath();
      const filePath = path.join(savePath, `${serializedCharacter.id}.ffp`);
      
      await fs.writeFile(filePath, JSON.stringify(serializedCharacter, null, 2));
      
      console.log('[CharacterHandlers] Character saved:', filePath);
      return { success: true, path: filePath };
    } catch (error) {
      console.error('[CharacterHandlers] Save failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Load all characters
  ipcMain.handle(IPC_CHANNELS.CHARACTER_LIST, async () => {
    try {
      const savePath = preferencesManager.getCharacterSavePath();
      console.log('[CharacterHandlers] Loading characters from:', savePath);
      
      const files = await fs.readdir(savePath);
      const ffpFiles = files.filter(file => file.endsWith('.ffp'));
      
      const characters = [];
      for (const file of ffpFiles) {
        try {
          const filePath = path.join(savePath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const character = JSON.parse(content);
          characters.push(character);
        } catch (error) {
          console.error(`[CharacterHandlers] Error loading ${file}:`, error);
        }
      }
      
      console.log('[CharacterHandlers] Loaded characters:', characters.length);
      return { success: true, characters };
    } catch (error) {
      console.error('[CharacterHandlers] Load failed:', error);
      return { success: false, error: error.message, characters: [] };
    }
  });

  // Delete character
  ipcMain.handle(IPC_CHANNELS.CHARACTER_DELETE, async (event, id) => {
    try {
      console.log('[CharacterHandlers] Deleting character:', id);
      
      const savePath = preferencesManager.getCharacterSavePath();
      const filePath = path.join(savePath, `${id}.ffp`);
      
      await fs.unlink(filePath);
      
      console.log('[CharacterHandlers] Character deleted:', filePath);
      return { success: true };
    } catch (error) {
      console.error('[CharacterHandlers] Delete failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Export character
  ipcMain.handle(IPC_CHANNELS.CHARACTER_EXPORT, async (event, id) => {
    try {
      console.log('[CharacterHandlers] Exporting character:', id);
      
      const savePath = preferencesManager.getCharacterSavePath();
      const sourceFilePath = path.join(savePath, `${id}.ffp`);
      
      const result = await dialog.showSaveDialog({
        title: 'Export Character',
        defaultPath: `character-${id}.ffp`,
        filters: [{ name: 'Fizbane Character', extensions: ['ffp'] }]
      });
      
      if (result.canceled) {
        return { success: false, canceled: true };
      }
      
      await fs.copyFile(sourceFilePath, result.filePath);
      
      console.log('[CharacterHandlers] Character exported to:', result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      console.error('[CharacterHandlers] Export failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Import character
  ipcMain.handle(IPC_CHANNELS.CHARACTER_IMPORT, async () => {
    try {
      console.log('[CharacterHandlers] Importing character');
      
      const result = await dialog.showOpenDialog({
        title: 'Import Character',
        filters: [{ name: 'Fizbane Character', extensions: ['ffp'] }],
        properties: ['openFile']
      });
      
      if (result.canceled) {
        return { success: false, canceled: true };
      }
      
      const sourceFilePath = result.filePaths[0];
      const content = await fs.readFile(sourceFilePath, 'utf8');
      const character = JSON.parse(content);
      
      // Generate new ID for imported character
      character.id = uuidv4();
      
      const savePath = preferencesManager.getCharacterSavePath();
      const targetFilePath = path.join(savePath, `${character.id}.ffp`);
      
      await fs.writeFile(targetFilePath, JSON.stringify(character, null, 2));
      
      console.log('[CharacterHandlers] Character imported:', character.id);
      return { success: true, character };
    } catch (error) {
      console.error('[CharacterHandlers] Import failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Generate UUID
  ipcMain.handle(IPC_CHANNELS.CHARACTER_GENERATE_UUID, () => {
    return uuidv4();
  });

  console.log('[CharacterHandlers] All character handlers registered');
}

module.exports = { registerCharacterHandlers };
```

**Validation:**
- [ ] File created at `app/electron/ipc/handlers/CharacterHandlers.js`
- [ ] File is approximately 180 lines
- [ ] No syntax errors

---

## Step 5: Create FileHandlers.js

**Objective:** Extract file operation IPC handlers.

**Time Estimate:** 45 minutes

Create file `app/electron/ipc/handlers/FileHandlers.js`:

```javascript
/**
 * IPC handlers for file operations.
 * 
 * @module electron/ipc/handlers/FileHandlers
 */

const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { IPC_CHANNELS } = require('../channels');

function registerFileHandlers() {
  console.log('[FileHandlers] Registering file handlers');

  // Select folder
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_FOLDER, async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
      });
      
      if (result.canceled) {
        return { success: false, canceled: true };
      }
      
      return { success: true, path: result.filePaths[0] };
    } catch (error) {
      console.error('[FileHandlers] Select folder failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Read JSON file
  ipcMain.handle(IPC_CHANNELS.FILE_READ_JSON, async (event, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      return { success: true, data };
    } catch (error) {
      console.error('[FileHandlers] Read JSON failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Write JSON file
  ipcMain.handle(IPC_CHANNELS.FILE_WRITE_JSON, async (event, filePath, data) => {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return { success: true };
    } catch (error) {
      console.error('[FileHandlers] Write JSON failed:', error);
      return { success: false, error: error.message };
    }
  });

  // Check if file exists
  ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (event, filePath) => {
    try {
      await fs.access(filePath);
      return { success: true, exists: true };
    } catch {
      return { success: true, exists: false };
    }
  });

  // Open file with default application
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (event, filePath) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (error) {
      console.error('[FileHandlers] Open file failed:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[FileHandlers] All file handlers registered');
}

module.exports = { registerFileHandlers };
```

**Validation:**
- [ ] File created
- [ ] No syntax errors

---

## Step 6: Create SettingsHandlers.js & DataHandlers.js

Create `app/electron/ipc/handlers/SettingsHandlers.js`:

```javascript
const { ipcMain, app } = require('electron');
const { IPC_CHANNELS } = require('../channels');

function registerSettingsHandlers(preferencesManager) {
  console.log('[SettingsHandlers] Registering settings handlers');

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_PATH, (event, key) => {
    return preferencesManager.get(key);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_PATH, (event, key, value) => {
    preferencesManager.set(key, value);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, () => {
    return preferencesManager.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.UTIL_GET_APP_PATH, () => {
    return app.getAppPath();
  });

  ipcMain.handle(IPC_CHANNELS.UTIL_GET_USER_DATA, () => {
    return app.getPath('userData');
  });

  console.log('[SettingsHandlers] All settings handlers registered');
}

module.exports = { registerSettingsHandlers };
```

Create `app/electron/ipc/handlers/DataHandlers.js`:

```javascript
const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { IPC_CHANNELS } = require('../channels');

function registerDataHandlers(appPath) {
  console.log('[DataHandlers] Registering data handlers');

  ipcMain.handle(IPC_CHANNELS.DATA_LOAD_JSON, async (event, fileName) => {
    try {
      const filePath = path.join(appPath, 'data', fileName);
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      return { success: true, data };
    } catch (error) {
      console.error('[DataHandlers] Load JSON failed:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[DataHandlers] All data handlers registered');
}

module.exports = { registerDataHandlers };
```

---

## Step 7: Create IPCRegistry.js

Create `app/electron/ipc/IPCRegistry.js`:

```javascript
const { registerCharacterHandlers } = require('./handlers/CharacterHandlers');
const { registerFileHandlers } = require('./handlers/FileHandlers');
const { registerSettingsHandlers } = require('./handlers/SettingsHandlers');
const { registerDataHandlers } = require('./handlers/DataHandlers');

class IPCRegistry {
  constructor(preferencesManager, windowManager, appPath) {
    this.preferencesManager = preferencesManager;
    this.windowManager = windowManager;
    this.appPath = appPath;
  }

  registerAll() {
    console.log('[IPCRegistry] Registering all IPC handlers');
    
    registerCharacterHandlers(this.preferencesManager, this.windowManager);
    registerFileHandlers();
    registerSettingsHandlers(this.preferencesManager);
    registerDataHandlers(this.appPath);
    
    console.log('[IPCRegistry] All IPC handlers registered');
  }
}

module.exports = { IPCRegistry };
```

---

## Step 8: Refactor main.js

Replace `app/main.js` content with:

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { WindowManager } = require('./electron/WindowManager');
const { PreferencesManager } = require('./electron/PreferencesManager');
const { IPCRegistry } = require('./electron/ipc/IPCRegistry');

let windowManager;
let preferencesManager;
let ipcRegistry;

app.whenReady().then(() => {
  console.log('[App] Application ready');
  
  // Initialize managers
  preferencesManager = new PreferencesManager(app);
  windowManager = new WindowManager(preferencesManager, __dirname);
  ipcRegistry = new IPCRegistry(preferencesManager, windowManager, __dirname);
  
  // Register all IPC handlers
  ipcRegistry.registerAll();
  
  // Create main window
  windowManager.createMainWindow();
  
  console.log('[App] Application initialized');
});

app.on('window-all-closed', () => {
  console.log('[App] All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('[App] Application activated');
  if (!windowManager.hasWindow()) {
    windowManager.createMainWindow();
  }
});

app.on('before-quit', () => {
  console.log('[App] Application quitting');
});
```

---

## Step 9: Update preload.js

Update channel references in `app/preload.js` to use new channel names from channels.js.

---

## Step 10: Test & Validate

```powershell
npm start
```

**Validation:**
- [ ] Application launches
- [ ] No IPC errors
- [ ] Character operations work
- [ ] File operations work
- [ ] Settings operations work

---

## Step 11: Git Checkpoint

```powershell
git add app/electron/ app/main.js app/preload.js
git commit -m "refactor(main): split main.js into modular IPC handlers

Phase 2 Complete - Main Process Refactoring

Files Created:
- app/electron/WindowManager.js
- app/electron/PreferencesManager.js
- app/electron/ipc/IPCRegistry.js
- app/electron/ipc/channels.js
- app/electron/ipc/handlers/CharacterHandlers.js
- app/electron/ipc/handlers/FileHandlers.js
- app/electron/ipc/handlers/SettingsHandlers.js
- app/electron/ipc/handlers/DataHandlers.js

Files Modified:
- app/main.js (reduced from 768 to ~200 lines)
- app/preload.js (updated channel references)

Application tested and functioning correctly."

git push origin refactor
```

---

## Phase 2 Completion Checklist

- [ ] All handler files created
- [ ] main.js reduced to ~200 lines
- [ ] Application launches successfully
- [ ] All IPC operations work
- [ ] Git commit created and pushed

**Next:** PHASE_3_STATE.md