# Current State Analysis

**Purpose:** Document the current codebase state, identify issues, and map files to their refactoring phases.

---

## Current File Structure

```
app/
├── main.js (768 lines) ⚠️ MONOLITH - Phase 2
├── preload.js (security layer) ✅ KEEP AS-IS
├── index.html (1052 lines) ⚠️ TOO LARGE - Phase 5
└── js/
    ├── core/ (7 files)
    │   ├── AppInitializer.js ✅ REFACTOR - Phase 3
    │   ├── Character.js (711 lines) ⚠️ MONOLITH - Phase 4
    │   ├── CharacterLifecycle.js (836 lines) ⚠️ MONOLITH - Phase 4
    │   ├── Navigation.js (692 lines) ⚠️ MONOLITH - Phase 5
    │   ├── Modal.js ✅ KEEP AS-IS
    │   ├── Proficiency.js ✅ KEEP AS-IS
    │   └── Storage.js ✅ REFACTOR - Phase 3
    ├── services/ (9 files) ✅ REFACTOR - Phase 4
    ├── modules/ (card components) ✅ KEEP AS-IS
    └── utils/ (10 files) ✅ KEEP AS-IS
```

---

## Critical Issues

### 1. Monolithic Files

| File | Lines | Issues | Target | Phase |
|------|-------|--------|--------|-------|
| main.js | 768 | All IPC handlers in one file | Split into 9 files (~100 each) | 2 |
| CharacterLifecycle.js | 836 | Multiple responsibilities | Split into 5 files (~150 each) | 4 |
| Navigation.js | 692 | UI + routing + templates | Split into 5 files (~150 each) | 5 |
| Character.js | 711 | Model + logic + serialization | Split into 5 files (~150 each) | 4 |
| index.html | 1052 | All page templates embedded | Extract 8 templates (~130 each) | 5 |

### 2. Inconsistent State Management

**Problem:** State is scattered across multiple files

Current state locations:
- `CharacterLifecycle.js` - currentCharacter
- `Navigation.js` - currentPage
- `Storage.js` - localStorage access
- Various services - cached data

**Solution (Phase 3):** Single `AppState.js` with all application state

### 3. Circular Dependencies

**Problem:** Services ↔ CharacterLifecycle ↔ Core

Current circular refs:
```
CharacterLifecycle.js
    ↓ imports
RaceService.js
    ↓ imports
FilterEngine.js
    ↓ imports
CharacterLifecycle.js  ← CIRCULAR!
```

**Solution (Phase 4):** Introduce application layer to break cycles

### 4. Inconsistent Error Handling

**Problem:** Three different error patterns used

Pattern 1: `return { success: false, error: '...' }`
Pattern 2: `throw new Error('...')`
Pattern 3: `return null` (error implied)

**Solution (Phase 1):** Result<T, E> pattern everywhere

### 5. No Logging Strategy

**Problem:** console.log statements everywhere (200+)

**Solution (Phase 1):** Centralized Logger with levels

### 6. Data Structure Inconsistency

**Problem:** allowedSources uses Set, Array, OR Object depending on context

Current inconsistency:
```javascript
// Sometimes a Set
character.allowedSources = new Set(['PHB', 'DMG']);

// Sometimes an Array
character.allowedSources = ['PHB', 'DMG'];

// Sometimes an Object
character.allowedSources = { PHB: true, DMG: true };
```

**Solution (Phase 4):** CharacterSchema enforces structure

### 7. No Test Coverage

**Problem:** Zero tests (test files exist but don't test refactored code)

**Solution (Phase 6):** Comprehensive test suite

---

## File-by-File Refactoring Plan

### Phase 1: Foundation (No Existing Files Modified)

**New Files Created:**
- `app/js/infrastructure/Logger.js`
- `app/js/infrastructure/Result.js`
- `app/js/infrastructure/EventBus.js`
- `tests/unit/Logger.spec.js`
- `tests/unit/Result.spec.js`
- `tests/unit/EventBus.spec.js`

**Existing Files Modified:** None

---

### Phase 2: Main Process Refactoring

**File: `app/main.js` (768 lines → ~200 lines)**

Current responsibilities (TOO MANY):
- Window management
- Preferences management
- Character IPC handlers
- File IPC handlers
- Settings IPC handlers
- Data IPC handlers
- Utility IPC handlers

**Transformation:**

1. **Extract WindowManager** → `app/electron/WindowManager.js`
   - Window creation
   - Window lifecycle
   - Window events

2. **Extract PreferencesManager** → `app/electron/PreferencesManager.js`
   - Preferences storage
   - Preferences retrieval
   - Preferences validation

3. **Extract IPC Handlers** → `app/electron/ipc/handlers/*.js`
   - CharacterHandlers.js (save, load, delete, import, export)
   - FileHandlers.js (file selection, JSON reading)
   - SettingsHandlers.js (path management)
   - DataHandlers.js (D&D data loading)

4. **Create IPC Registry** → `app/electron/ipc/IPCRegistry.js`
   - Central handler registration
   - Handler lifecycle

5. **Create Channel Constants** → `app/electron/ipc/channels.js`
   - All IPC channel names
   - Prevents typos

**New main.js Structure (~200 lines):**
```javascript
// Imports
const { app, BrowserWindow, ipcMain } = require('electron');
const { WindowManager } = require('./electron/WindowManager');
const { PreferencesManager } = require('./electron/PreferencesManager');
const { IPCRegistry } = require('./electron/ipc/IPCRegistry');

// Managers
let windowManager;
let preferencesManager;
let ipcRegistry;

// App lifecycle
app.whenReady().then(() => {
  preferencesManager = new PreferencesManager(app);
  windowManager = new WindowManager(__dirname);
  ipcRegistry = new IPCRegistry(ipcMain, preferencesManager);
  ipcRegistry.registerAll();
  windowManager.createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

**Validation:**
- [ ] main.js is under 250 lines
- [ ] All IPC handlers work
- [ ] App starts correctly
- [ ] All file operations work

---

### Phase 3: State Management

**File: `app/js/core/AppInitializer.js`**

Current: Initializes app, scattered state initialization

**Transformation:**
1. Refactor to use AppState for initialization
2. Add Logger for initialization steps
3. Use Result pattern for initialization errors
4. Add EventBus for initialization events

**Changes:**
- Replace direct state access with AppState
- Add error handling with Result
- Add logging for each step

**File: `app/js/core/Storage.js`**

Current: localStorage wrapper

**Transformation:**
1. Add Logger for storage operations
2. Use Result pattern for storage errors
3. Remove direct state mutation
4. Use AppState for state updates

**Changes:**
- Add Logger.debug for reads
- Add Logger.info for writes
- Return Result<T, E> instead of throwing
- Emit events on storage changes

**New Files Created:**
- `app/js/application/AppState.js` - Central state management
- `tests/unit/AppState.spec.js` - State management tests

**Validation:**
- [ ] AppState manages all application state
- [ ] No direct state access in services
- [ ] State changes emit events
- [ ] Tests pass

---

### Phase 4: Business Logic Refactoring

**File: `app/js/core/CharacterLifecycle.js` (836 lines → DELETE)**

Current responsibilities (TOO MANY):
- Character selection
- Character creation
- Character deletion
- Character loading
- Character saving
- Character import/export
- UI updates
- Event handling
- Modal management
- Change tracking

**Transformation: Split into 5 files**

1. **CharacterManager.js** (150 lines)
   - Character selection
   - Character creation
   - Character deletion
   - Uses: AppState, Logger, Result, EventBus

2. **CharacterLoader.js** (150 lines)
   - Character loading from disk
   - Character saving to disk
   - File path resolution
   - Uses: IPC, Logger, Result, CharacterSerializer

3. **CharacterImporter.js** (150 lines)
   - Import from various formats
   - Export to various formats
   - Format validation
   - Uses: Logger, Result, CharacterSerializer

4. **ChangeTracker.js** (100 lines)
   - Tracks unsaved changes
   - Prevents data loss
   - Prompts before navigation
   - Uses: AppState, EventBus, Logger

5. **AppState.js** (already created in Phase 3)
   - Stores currentCharacter
   - Emits character:changed events

**Migration Steps:**
1. Create new files with new patterns
2. Update references one by one
3. Test each update
4. Delete CharacterLifecycle.js when all refs migrated

**File: `app/js/core/Character.js` (711 lines → 300 lines)**

Current: Model + calculations + serialization + validation

**Transformation: Split into 5 files**

1. **Character.js** (300 lines - SIMPLIFIED)
   - Pure data model
   - Basic getters/setters
   - Uses: CharacterSchema

2. **CharacterSchema.js** (150 lines - NEW)
   - Schema definition
   - Default values
   - Validation rules
   - Serialization helpers

3. **CharacterSerializer.js** (100 lines - NEW)
   - JSON serialization
   - JSON deserialization
   - Set/Map handling
   - Migration logic

4. **ProficiencyManager.js** (150 lines - NEW)
   - Proficiency calculations
   - Bonus tracking
   - Source tracking

5. **AbilityManager.js** (150 lines - NEW)
   - Ability score calculations
   - Modifier calculations
   - Bonus tracking

**Migration Steps:**
1. Create CharacterSchema first
2. Create serializer
3. Extract managers
4. Simplify Character.js
5. Update all imports

**Files: `app/js/services/*.js` (9 files)**

Current: Inconsistent patterns

**Transformation: Standardize all services**

Changes to EVERY service:
1. Add Logger import and usage
2. Change error returns to Result pattern
3. Remove direct state access, use AppState
4. Add EventBus events for data loaded
5. Add JSDoc comments

Services to update:
- ClassService.js
- RaceService.js
- BackgroundService.js
- SpellService.js
- EquipmentService.js
- FeatService.js
- OptionalFeatureService.js
- DataLoader.js
- FilterEngine.js

**Template for Service Refactoring:**

```javascript
// OLD PATTERN
async loadClasses() {
  try {
    const data = await window.electron.loadJson('classes.json');
    console.log('Loaded classes:', data.length);
    return data;
  } catch (error) {
    console.error('Failed to load classes:', error);
    return null;  // ← Inconsistent error handling
  }
}

// NEW PATTERN
import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';

async loadClasses() {
  try {
    Logger.debug('ClassService', 'Loading classes');
    
    const data = await window.electron.loadJson('classes.json');
    
    Logger.info('ClassService', 'Classes loaded', { count: data.length });
    eventBus.emit(EVENTS.DATA_LOADED, 'classes', data);
    
    return Result.ok(data);
  } catch (error) {
    Logger.error('ClassService', 'Failed to load classes', error);
    return Result.err(error.message);
  }
}
```

**Validation:**
- [ ] All services use Logger
- [ ] All services return Result
- [ ] All services emit events
- [ ] No direct state access
- [ ] All tests pass

---

### Phase 5: Presentation Layer

**File: `app/js/core/Navigation.js` (692 lines → DELETE)**

Current responsibilities (TOO MANY):
- Route management
- Page loading
- Template management
- Component lifecycle
- Event handling
- State synchronization

**Transformation: Split into 5 files**

1. **Router.js** (150 lines)
   - Route registration
   - Route navigation
   - Route guards (requiresCharacter)
   - Uses: AppState, EventBus, Logger

2. **PageLoader.js** (150 lines)
   - Page template loading
   - Content area updates
   - Loading states
   - Uses: TemplateLoader, Logger

3. **NavigationController.js** (150 lines)
   - Navigation coordination
   - Nav button updates
   - Page transitions
   - Uses: Router, PageLoader, AppState

4. **ComponentRegistry.js** (100 lines)
   - Component registration
   - Component lifecycle
   - Component cleanup

5. **TemplateLoader.js** (100 lines)
   - HTML template loading
   - Template caching
   - Template compilation

**File: `app/index.html` (1052 lines → 200 lines)**

Current: All page templates embedded in one file

**Transformation: Extract templates**

1. **Keep in index.html** (~200 lines)
   - Basic shell structure
   - Navigation bar
   - Content area
   - Script includes

2. **Extract to templates/pages/**
   - home.html (150 lines)
   - build.html (200 lines)
   - equipment.html (150 lines)
   - details.html (150 lines)
   - settings.html (100 lines)

3. **Extract to templates/modals/**
   - newCharacter.html (100 lines)
   - confirmation.html (50 lines)
   - sourceSelection.html (80 lines)

**Migration Steps:**
1. Create templates directory
2. Extract one template at a time
3. Update PageLoader to load templates
4. Test each page works
5. Remove template from index.html
6. Repeat for all templates

**Validation:**
- [ ] index.html is under 250 lines
- [ ] All templates load correctly
- [ ] Navigation works
- [ ] All pages display correctly

---

### Phase 6: Testing & Documentation

**No major refactoring, just additions:**

**Add Tests:**
- Unit tests for all Phase 1-5 code
- Integration tests for workflows
- E2E tests for full scenarios

**Add Documentation:**
- JSDoc for all files
- README updates
- Architecture diagrams

**Files NOT Modified in Any Phase:**

These files are good as-is:
- `app/preload.js` - Security boundary is correct
- `app/js/core/Modal.js` - Well structured
- `app/js/core/Proficiency.js` - Focused responsibility
- `app/js/modules/*.js` - Card components are fine
- `app/js/utils/*.js` - Utility functions are fine
- `app/css/*.css` - Styles unchanged
- `app/data/*.json` - Data files unchanged
- `app/assets/*` - Assets unchanged

---

## Summary Table: Files by Phase

| File | Current Lines | Action | Phase | New Location | New Lines |
|------|---------------|--------|-------|--------------|-----------|
| main.js | 768 | Split | 2 | electron/ (9 files) | ~100 each |
| CharacterLifecycle.js | 836 | Split | 4 | application/ (5 files) | ~150 each |
| Character.js | 711 | Split | 4 | domain/ (5 files) | ~150 each |
| Navigation.js | 692 | Split | 5 | presentation/ (5 files) | ~150 each |
| index.html | 1052 | Extract | 5 | templates/ (9 files) | ~130 each |
| AppInitializer.js | ~200 | Refactor | 3 | core/ (same) | ~200 |
| Storage.js | ~150 | Refactor | 3 | core/ (same) | ~150 |
| 9 service files | ~150 each | Refactor | 4 | services/ (same) | ~150 each |

**Total Files Created:** ~50  
**Total Files Modified:** ~20  
**Total Files Deleted:** 4 (merged into new files)
