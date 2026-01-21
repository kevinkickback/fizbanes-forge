# Fizbane's Forge Codebase Audit Report
**Date:** January 20, 2026  
**Auditor:** AI Assistant (Deep Methodical Analysis)  
**Scope:** Complete architectural and code quality review

---

## 1. EXECUTIVE SUMMARY

### Overall Health Assessment

**Rating: Good with Areas for Improvement (7/10)**

Fizbane's Forge demonstrates a **well-structured Electron application** with clear architectural boundaries and consistent patterns. The codebase shows evidence of careful design, particularly in:
- **Process isolation** via preload bridge
- **Event-driven architecture** using EventBus
- **Service-layer abstraction** for data access
- **Memory management utilities** (DOMCleanup)

However, the audit identified several areas requiring attention:
- **Event suppression complexity** creates fragile temporal coupling
- **Duplicate business logic** across IPC handlers and services
- **Inconsistent cleanup patterns** in some UI components
- **Over-defensive validation** in multiple layers
- **Limited error recovery** in critical paths

### Major Strengths

1. **Excellent Preload Security**
   - Hardcoded IPC channel names prevent injection
   - Proper use of `contextBridge` with no Node.js leakage
   - Clear API surface for renderer processes

2. **Event-Driven Design**
   - Centralized EventBus with named constants (EVENTS)
   - Decoupled components communicate via events
   - Clear separation between state changes and UI updates

3. **BaseDataService Pattern**
   - Consistent initialization across 13+ services
   - AppState caching reduces redundant loads
   - Proper error handling with fallbacks

4. **Character Validation**
   - Schema-driven validation in both main and renderer
   - Prevents corrupt data from persisting
   - Clear validation error messages

### Major Risks

1. **Temporal Event Suppression (HIGH RISK)**
   - AppInitializer uses time-based suppression windows
   - Creates race conditions between page loads and updates
   - Difficult to reason about, hard to debug

2. **Modal Instance Management (MEDIUM RISK)**
   - Bootstrap modals created without consistent disposal
   - Some modals lack DOMCleanup integration
   - Potential memory leaks from stacked instances

3. **Validation Duplication (MEDIUM RISK)**
   - CharacterSchema.validate() called in main AND renderer
   - Business logic duplicated in IPC handlers
   - Increases maintenance burden, risk of drift

4. **Data Load Error Handling (MEDIUM RISK)**
   - Retry logic with fixed backoff, no exponential strategy
   - User-facing modals block initialization on error
   - Limited recovery from partial load failures

---

## 2. ARCHITECTURAL FINDINGS

### 2.1 Intended Architecture

The application follows a **three-layer Electron architecture**:

```
┌─────────────────────────────────────────┐
│   Main Process (src/main/)              │
│   - Window lifecycle                    │
│   - File system access                  │
│   - IPC handler registration            │
│   - Preferences management              │
└──────────────┬──────────────────────────┘
               │ IPC Bridge
┌──────────────▼──────────────────────────┐
│   Preload (src/main/Preload.cjs)        │
│   - contextBridge exposure              │
│   - IPC channel whitelisting            │
│   - Security boundary enforcement       │
└──────────────┬──────────────────────────┘
               │ window.* APIs
┌──────────────▼──────────────────────────┐
│   Renderer (src/app/, src/ui/)          │
│   - AppInitializer (boot sequence)      │
│   - Services (data access)              │
│   - Components (UI logic)               │
│   - AppState + EventBus (state mgmt)    │
└─────────────────────────────────────────┘
```

**Key Principles (from documentation):**
- Renderer never accesses filesystem directly
- All data flows through services, not direct JSON reads
- UI components listen to EventBus, not directly mutate state
- Bootstrap modals defined in HTML, not created dynamically

### 2.2 Architecture Adherence (GOOD)

**✓ Process Boundaries Respected**

The preload bridge is **correctly implemented**:
- `Preload.cjs` uses `contextBridge.exposeInMainWorld()` properly
- IPC channels hardcoded in both preload and main (synchronized)
- No direct Node.js access from renderer
- Window APIs expose only safe, filtered IPC wrappers

**Evidence:**
```javascript
// Preload.cjs lines 36-42
contextBridge.exposeInMainWorld('app', {
    getUserDataPath: async () => await ipcRenderer.invoke(IPC_CHANNELS.UTIL_GET_USER_DATA),
    selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_FOLDER),
    getDataSource: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_GET_SOURCE),
    // ... safe wrappers only
});
```

**✓ Service Layer Enforced**

UI components consistently use services instead of direct data access:
- `SpellService`, `ClassService`, `RaceService` etc. all extend `BaseDataService`
- Services use `DataLoader.loadJSON()` which delegates to IPC
- No direct file reads observed in renderer code

**✓ Event-Driven State Updates**

AppState properly emits events for all mutations:
```javascript
// AppState.js lines 66-73
setState(updates) {
    this.state = { ...this.state, ...updates };
    eventBus.emit(EVENTS.STATE_CHANGED, this.state, oldState);
    
    Object.keys(updates).forEach((key) => {
        if (oldState[key] !== updates[key]) {
            eventBus.emit(`state:${key}:changed`, updates[key], oldState[key]);
        }
    });
}
```

### 2.3 Boundary Violations (MINOR)

**⚠ Business Logic in Main Process**

CharacterHandlers.js duplicates validation logic that exists in renderer:

```javascript
// CharacterHandlers.js lines 14-27
const validation = CharacterSchema.validate(character);
if (!validation.valid) {
    return {
        success: false,
        error: `Invalid character data: ${validation.errors.join(', ')}`,
    };
}
```

This same validation occurs in `CharacterManager.saveCharacter()`. While defense-in-depth is good, **the validation schema is imported from `src/app/CharacterSchema.js`** - a renderer file.

**Impact:** Main process depends on renderer code, violating separation of concerns.

**⚠ Preload as Feature Surface**

Preload.cjs exposes **19+ distinct APIs** across multiple namespaces (`app`, `data`, `characterStorage`). While not a security issue, this creates a large attack surface for IPC communication.

**Evidence:**
- `window.app.*` - 7 methods
- `window.data.*` - 1 method  
- `window.characterStorage.*` - 11 methods

**⚠ Data Download Progress Event**

DataHandlers.js sends progress events during downloads:
```javascript
// DataHandlers.js lines 68-74
const sendDownloadProgress = (event, status, data = {}) => {
    if (event?.sender) {
        event.sender.send(IPC_CHANNELS.DATA_DOWNLOAD_PROGRESS, { status, ...data });
    }
};
```

This is **push-based IPC** (main → renderer) rather than the typical pull model. While valid, it's inconsistent with the rest of the architecture.

### 2.4 Architectural Drift (MINIMAL)

**Debug Mode Bypass**

Main.js and DataHandlers.js contain debug-specific paths:
```javascript
// DataHandlers.js lines 15-18
const DEV_DATA_PATH = DEBUG_MODE
    ? path.resolve(__dirname, '..', '..', '..', 'src', 'data')
    : null;
```

This hardcoded path bypasses the normal data source configuration. While acceptable for development, it creates a **shadow architecture** that differs from production.

**Recommendation:** Consider environment-based configuration files instead of code branches.

---

## 3. CODE QUALITY FINDINGS

### 3.1 Dead Code (NONE FOUND)

No significant dead code detected. The codebase appears actively maintained with recent commits addressing bugs and features.

### 3.2 Duplicate Logic (MODERATE ISSUE)

**CharacterSchema Import in Main Process**

`CharacterHandlers.js` imports and uses `CharacterSchema` from the renderer:
```javascript
// CharacterHandlers.js line 9
import { CharacterSchema } from '../../app/CharacterSchema.js';
```

This creates **bidirectional dependency** between main and renderer. If CharacterSchema becomes renderer-specific (e.g., uses DOM APIs), the main process will break.

**Validation Occurs in Three Places:**
1. `CharacterManager.saveCharacter()` - before IPC call
2. `CharacterHandlers.js` - in IPC handler  
3. `CharacterSchema.validate()` - shared utility

**Hit Dice Lookup Duplication**

LevelUpService contains hardcoded hit dice:
```javascript
// LevelUpService.js lines 128-141
_getHitDiceForClass(className) {
    const hitDice = {
        'Barbarian': 'd12',
        'Bard': 'd8',
        'Cleric': 'd8',
        // ... 12 classes
    };
    return hitDice[className] || 'd8';
}
```

This data **already exists in class JSON files** loaded by ClassService. Duplication creates drift risk.

**Spell Lookup Logic**

`SpellService.getSpell()` performs multi-step fallback:
```javascript
// SpellService.js lines 90-105
getSpell(name, source = 'PHB') {
    const spell = this._spellLookupMap.get(DataNormalizer.normalizeForLookup(name));
    
    if (spell && spell.source === source) return spell;
    
    // Fallback to linear search if source doesn't match
    if (spell && spell.source !== source && this._data?.spell) {
        return this._data.spell.find((s) => s.name === name && s.source === source) || spell;
    }
    
    return spell || null;
}
```

This logic is **duplicated conceptually** in ItemService, MonsterService, and other services. Each implements its own variant of "lookup by name, fallback by source."

### 3.3 Legacy Code (MINOR)

**Comments Reference Removed Fields**

CharacterSchema.js contains comments about removed fields:
```javascript
// CharacterSchema.js lines 72-74
// Note: class info stored in progression.classes[], no legacy class field
// Note: subclass is stored in progression.classes[].subclass, not at root level
// Note: total level is calculated from progression.classes[].levels, no legacy level field
```

These comments suggest the schema evolved but still references old structures. Good for context, but implies the codebase migrated architectures.

**Defensive Null Checks**

Multiple services check for `this._data?.spell` repeatedly:
```javascript
// SpellService.js - pattern repeated 4+ times
if (!this._data?.spell) return [];
```

This suggests historical null/undefined issues. Modern code could assert initialization state instead.

### 3.4 Overly Complex Areas (HIGH COMPLEXITY)

**AppInitializer Event Suppression**

Lines 379-429 implement temporal event suppression:
```javascript
// AppInitializer.js lines 379-429
let _suppressUntil = 0;
const SuppressWindowMs = 150;

function suppressTemporary() {
    _suppressUntil = Date.now() + SuppressWindowMs;
}

eventBus.on(EVENTS.CHARACTER_UPDATED, () => {
    const now = Date.now();
    if (now < _suppressUntil) {
        console.debug('Ignored CHARACTER_UPDATED due to suppression');
        return;
    }
    AppState.setHasUnsavedChanges(true);
});
```

**Why This Is Complex:**
1. **Temporal coupling**: Event handling depends on wall-clock time
2. **Global mutable state**: `_suppressUntil` is closure-scoped but acts globally
3. **Race conditions**: Page loads that exceed 150ms will leak events
4. **Hard to test**: Requires clock mocking or delays
5. **Fragile**: Adding async operations changes timing assumptions

**Alternative:** Use explicit state flags (e.g., `isLoadingCharacter`) instead of time windows.

**DataLoader Dual-Path Loading**

DataLoader.loadJSON() has two completely different code paths:
```javascript
// DataLoader.js lines 73-110
if (window.data && window.data.loadJSON) {
    // Path 1: Electron IPC
    const result = await window.data.loadJSON(url);
    if (result.success) {
        data = result.data;
    } else {
        throw new Error(result.error || `Failed to load ${url}`);
    }
} else {
    // Path 2: Fetch fallback
    const fullUrl = url.startsWith('http') || url.startsWith('file://') ? url : `/${url}`;
    const response = await fetch(fullUrl);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    data = await response.json();
}
```

**Issues:**
- Error handling differs between paths
- Testing must cover both
- Unclear when fetch path is actually used (development only?)
- URL construction logic differs

**Character Import Workflow**

CharacterHandlers.js `CHARACTER_IMPORT` handler spans 100+ lines with nested conditionals:
1. Check if file selected, else show dialog
2. Validate file extension
3. Parse JSON
4. Validate against schema
5. Check for duplicate ID
6. Read existing character if duplicate
7. Return conflict modal data
8. Wait for user choice
9. Process choice (overwrite/keepBoth/cancel)
10. Write to filesystem

This is **procedural transaction logic** that belongs in a service, not an IPC handler.

### 3.5 Error Handling Patterns

**Inconsistent Error Propagation**

Some functions throw, others return `{success, error}`:
```javascript
// CharacterManager throws
async saveCharacter() {
    if (!character) {
        throw new Error('No character selected');
    }
}

// IPC handlers return error objects
ipcMain.handle(IPC_CHANNELS.CHARACTER_SAVE, async (_event, characterData) => {
    try {
        // ...
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

This is actually **correct** - IPC handlers cannot throw across process boundaries. However, it means callers must handle both patterns.

**Silent Failures in Service Initialization**

BaseDataService.initWithLoader() catches errors and logs them:
```javascript
// BaseDataService.js lines 95-98
} catch (error) {
    console.error(`[${this._loggerScope}]`, 'Initialization failed', error);
    if (onError) {
        const fallback = onError(error);
```

Services that fail to load return empty arrays/objects and continue. This prevents app crashes but **silently degrades functionality**. Users may not realize data is missing.

**Retry Logic Without Exponential Backoff**

AppInitializer retries data loads with fixed delays:
```javascript
// AppInitializer.js lines 195-198
for (let attempt = 1; attempt <= MAX_DATA_LOAD_ATTEMPTS; attempt++) {
    if (attempt > 1) {
        await _sleep(DATA_LOAD_BACKOFF_MS * (attempt - 1)); // Linear backoff
    }
}
```

This is `350ms * (attempt - 1)`, which is linear, not exponential. For transient network issues, exponential backoff is more effective.

---

## 4. FUNCTION-LEVEL OBSERVATIONS

### 4.1 Critical Functions Analyzed

**AppInitializer._setupUiEventHandlers()** (Lines 337-515)
- **What it does:** Wires save button, level-up button, manages unsaved change indicators
- **Actual behavior:** Creates temporal event suppression system to prevent spurious CHARACTER_UPDATED events
- **Hidden dependencies:** Relies on EVENT emission order and timing
- **Side effects:** Modifies global closure state (`_suppressUntil`)
- **Fragility:** Breaking when async operations change page load timing

**Analysis:**
This function does **3 distinct jobs**:
1. Save button wiring (lines 403-450)
2. Unsaved change indicator logic (lines 344-406)  
3. Level-up modal wiring (lines 454-515)

The temporal suppression (lines 379-406) creates **temporal coupling**:
```javascript
let _suppressUntil = 0;
const SuppressWindowMs = 150;

eventBus.on(EVENTS.CHARACTER_UPDATED, () => {
    const now = Date.now();
    if (now < _suppressUntil) {
        console.debug('Ignored CHARACTER_UPDATED due to suppression');
        return;
    }
    AppState.setHasUnsavedChanges(true);
});
```

**Problems:**
- Magic number (150ms) has no justification
- Race condition if page load takes >150ms
- Global mutable state in closure
- Difficult to test without clock injection

**Better approach:** Explicit state flag `isLoadingPage` checked before setting unsaved changes.

---

**DataLoader.loadJSON()** (Lines 58-130)
- **What it does:** Loads JSON via IPC or fetch, with in-memory and localStorage caching
- **Actual behavior:** Dual-path loading with different error semantics
- **Hidden dependencies:** Assumes `window.data.loadJSON` exists in Electron context
- **Side effects:** Mutates `state.cache`, writes to localStorage
- **Assumptions:** localStorage is available and functional

**Analysis:**
This function handles:
1. Memory cache check (lines 68-69)
2. Persisted cache check (lines 71-75)
3. Deduplication of concurrent requests (lines 76)
4. Electron IPC loading (lines 82-95)
5. Fetch fallback (lines 96-107)
6. Hash generation for cache validation (lines 108)
7. Cache persistence (lines 110)

**Evidence of complexity:**
- 7 distinct responsibilities
- Two completely different code paths (IPC vs fetch)
- Error handling differs between paths
- URL construction logic varies

**The fetch path is questionable:**
```javascript
const fullUrl = url.startsWith('http') || url.startsWith('file://') ? url : `/${url}`;
```

This suggests the fetch path is for **browser testing** or **web deployment**, but the codebase is Electron-only. This path may never execute in production.

**Hidden assumption:** The function assumes it's safe to cache indefinitely. There's no cache invalidation or TTL.

---

**CharacterHandlers - CHARACTER_IMPORT** (Lines 144-273)
- **What it does:** Imports a character file with conflict resolution
- **Actual behavior:** 100+ line procedural transaction with 3 dialog interactions
- **Hidden dependencies:** Requires user interaction via dialogs
- **Side effects:** Reads/writes filesystem, mutates main window state
- **Control flow:** Deep nesting with early returns

**Analysis:**
This IPC handler performs a **complex workflow** that should be a service:

**Steps:**
1. Lines 151-172: File selection dialog if no file provided
2. Lines 174-179: File extension validation
3. Lines 181-191: JSON parsing with error handling
4. Lines 193-200: Schema validation
5. Lines 208-235: Duplicate ID detection and conflict preparation
6. Lines 246-256: User choice processing (overwrite/keepBoth/cancel)
7. Lines 258-262: File write operation

**The nested structure:**
```javascript
if (!sourceFilePath) {
    // 20 lines of dialog logic
    if (result.canceled) return;
    
    if (!sourceFilePath.endsWith('.ffp')) {
        // Error return
    }
    
    try {
        // Parse JSON
    } catch {
        // Error return
    }
    
    const validation = CharacterSchema.validate(character);
    if (!validation.valid) {
        // Error return
    }
    
    try {
        // Check for duplicate
        // 30 lines of conflict handling
    } catch {
        // Ignore, proceed
    }
}

// More logic...
```

**Problems:**
- Difficult to unit test (requires mock dialogs and filesystem)
- Business logic mixed with IPC concerns
- Error handling inconsistent (some throw, some return)
- No transaction safety (partial writes possible)

**This belongs in:** `CharacterImportService` that IPC handler delegates to.

---

**AppState.setState()** (Lines 58-76)
- **What it does:** Updates state and emits events
- **Actual behavior:** Shallow merge with event emission per changed key
- **Side effects:** Emits multiple EventBus events
- **Assumption:** All state updates are shallow (no deep merging)

**Analysis:**
This is actually **well-designed**:
```javascript
setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    eventBus.emit(EVENTS.STATE_CHANGED, this.state, oldState);
    
    Object.keys(updates).forEach((key) => {
        if (oldState[key] !== updates[key]) {
            eventBus.emit(`state:${key}:changed`, updates[key], oldState[key]);
        }
    });
}
```

**Strength:** Emits both global and specific events, enabling fine-grained listeners.

**Potential issue:** Shallow comparison `oldState[key] !== updates[key]` won't detect deep object changes. If someone mutates `character.spells` array, no event fires.

**Recommendation:** Document that state updates require new object references (immutable pattern).

---

**BaseDataService.initWithLoader()** (Lines 76-115)
- **What it does:** Standardized initialization with cache check, loading, and event emission
- **Actual behavior:** Template method pattern with callbacks
- **Dependencies:** AppState for caching, EventBus for events
- **Error handling:** Try/catch with optional error handler callback

**Analysis:**
This is **excellent abstraction**:
```javascript
async initWithLoader(loaderFn, { onLoaded, emitPayload, onError } = {}) {
    if (this.isInitialized()) return this._data;
    
    const cached = this.hydrateFromCache();
    if (cached) {
        if (onLoaded) onLoaded(cached, { fromCache: true });
        return cached;
    }
    
    try {
        const data = await loaderFn();
        this.setData(data);
        if (onLoaded) onLoaded(data, { fromCache: false });
        return data;
    } catch (error) {
        if (onError) {
            const fallback = onError(error);
            this.setData(fallback);
        }
    }
}
```

**Strengths:**
- Single responsibility (initialization flow)
- Consistent across all services
- Proper cache integration
- Configurable error recovery

**Minor issue:** If `onError` returns `undefined`, the service remains uninitialized (`this._data = undefined`), but `isInitialized()` only checks `Boolean(this._data)`, so empty object returns true but undefined returns false. This inconsistency could cause re-initialization loops.

---

### 4.2 Functions Doing Multiple Jobs

1. **AppInitializer._setupUiEventHandlers()**: Save button + unsaved indicator + level-up + suppression
2. **DataLoader.loadJSON()**: Memory cache + persisted cache + IPC + fetch + deduplication + hashing
3. **CharacterHandlers.CHARACTER_IMPORT**: File dialog + parsing + validation + conflict resolution + writing
4. **AppInitializer._loadAllGameData()**: Progress updates + service initialization + error aggregation

**Pattern:** Infrastructure code tends to accumulate responsibilities over time.

### 4.3 Unnecessarily Complex Control Flow

**AppInitializer._loadAllGameDataWithRetry()** (Lines 195-235)
- Nested retry loop with validation check per attempt
- Returns after prompting user to fix data source
- User modal blocks entire initialization

**Flow:**
```
for attempt 1 to MAX_ATTEMPTS:
    validate data source
    if invalid and last attempt:
        show error modal
        prompt user to fix
        return failure
    if invalid:
        show warning
        continue
    
    load data
    if success:
        return success
    if failure and last attempt:
        show error modal
        prompt user to fix
        return failure
    if failure:
        show warning
        continue
```

**Issues:**
- User interaction in retry loop blocks all retries
- No distinction between recoverable and unrecoverable errors
- Modal shown twice in worst case (validation failed + load failed)

---

## 5. REFACTORING OPPORTUNITIES

### 5.1 High-Priority Refactorings

#### **Remove Temporal Event Suppression**

**Current State:** AppInitializer uses time-based suppression to prevent spurious CHARACTER_UPDATED events.

**Problem:** Race conditions, hard to test, fragile.

**Solution:** Replace with explicit state flags:

```javascript
// Add to AppState
this.state = {
    // ...existing
    isLoadingCharacter: false,
    isNavigating: false,
};

// In CHARACTER_UPDATED handler
eventBus.on(EVENTS.CHARACTER_UPDATED, () => {
    if (AppState.get('isLoadingCharacter') || AppState.get('isNavigating')) {
        return; // Explicit suppression, no timing
    }
    AppState.setHasUnsavedChanges(true);
});

// In navigation/load flows
AppState.setState({ isNavigating: true });
// ... perform navigation
AppState.setState({ isNavigating: false });
```

**Benefits:**
- No race conditions
- Testable without clock mocking
- Self-documenting (state flags explain why)
- No magic numbers

**Tradeoffs:** Requires discipline to set/unset flags correctly.

**Estimated Effort:** 2-3 hours

---

#### **Extract CharacterSchema to Shared Module**

**Current State:** `src/app/CharacterSchema.js` imported by both renderer and main process.

**Problem:** Main process depends on renderer code.

**Solution:** Move to `src/shared/CharacterSchema.js`:

```
src/
  shared/           (NEW)
    CharacterSchema.js
    ValidationRules.js
  main/
    ipc/
      CharacterHandlers.js  (import from shared/)
  app/
    CharacterManager.js     (import from shared/)
```

**Implementation:**
1. Create `src/shared/` directory
2. Move CharacterSchema.js
3. Update imports in both main and renderer
4. Document shared modules in architecture guide

**Benefits:**
- Clear separation of concerns
- Main process no longer depends on renderer
- Shared code explicitly marked

**Tradeoffs:** One more directory to manage.

**Estimated Effort:** 1 hour

---

#### **Unify Lookup Logic Across Services**

**Current State:** Each service (Spell, Item, Monster) implements own lookup-by-name-and-source logic.

**Problem:** Code duplication, inconsistent fallback behavior.

**Solution:** Create `DataLookupMixin` or base method:

```javascript
// In BaseDataService or new DataLookupHelper
buildLookupMap(items, nameKey = 'name') {
    const map = new Map();
    for (const item of items) {
        if (!item?.[nameKey]) continue;
        const key = DataNormalizer.normalizeForLookup(item[nameKey]);
        map.set(key, item);
    }
    return map;
}

lookupByNameAndSource(lookupMap, allItems, name, source = 'PHB') {
    const normalized = DataNormalizer.normalizeForLookup(name);
    const item = lookupMap.get(normalized);
    
    // Exact source match
    if (item?.source === source) return item;
    
    // Source mismatch - search all items
    if (item && allItems) {
        return allItems.find(i => i.name === name && i.source === source) || item;
    }
    
    return item || null;
}
```

**Usage:**
```javascript
// In SpellService
getSpell(name, source = 'PHB') {
    return this.lookupByNameAndSource(this._spellLookupMap, this._data?.spell, name, source);
}
```

**Benefits:**
- Single implementation to maintain
- Consistent behavior across services
- Easier to optimize (e.g., add source-specific maps)

**Estimated Effort:** 3-4 hours

---

#### **Extract Character Import to Service**

**Current State:** CHARACTER_IMPORT handler is 100+ lines in CharacterHandlers.js.

**Problem:** Untestable, procedural, mixes IPC concerns with business logic.

**Solution:** Create `CharacterImportService`:

```javascript
// src/services/CharacterImportService.js
export class CharacterImportService {
    async importFromFile(filePath) {
        // Parse, validate, return character data
    }
    
    async checkForConflicts(character, savePath) {
        // Return conflict info or null
    }
    
    async resolveConflict(character, action) {
        // Handle overwrite/keepBoth logic
    }
}
```

IPC handler becomes thin coordinator:
```javascript
ipcMain.handle(IPC_CHANNELS.CHARACTER_IMPORT, async (_event, userChoice) => {
    const service = new CharacterImportService();
    
    try {
        if (!userChoice?.sourceFilePath) {
            // Show file dialog, return for user choice
        }
        
        const character = await service.importFromFile(userChoice.sourceFilePath);
        const conflict = await service.checkForConflicts(character, savePath);
        
        if (conflict && !userChoice.action) {
            return conflict; // Prompt user
        }
        
        return await service.resolveConflict(character, userChoice.action);
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

**Benefits:**
- Testable service logic
- IPC handler thin and focused
- Reusable for drag-drop import

**Estimated Effort:** 4-5 hours

---

### 5.2 Medium-Priority Refactorings

#### **Add Cache Invalidation to DataLoader**

**Current:** localStorage cache persists indefinitely with hash validation.

**Recommendation:** Add TTL or version-based invalidation:

```javascript
_setPersistedEntry(url, data, hash) {
    const persisted = _loadPersistedCache();
    persisted[url] = {
        data,
        hash,
        timestamp: Date.now(),
        version: APP_DATA_VERSION, // from package.json or config
    };
    _savePersistedCache();
}

_getPersistedEntry(url) {
    const persisted = _loadPersistedCache();
    const entry = persisted?.[url];
    
    if (!entry) return null;
    
    // Check version
    if (entry.version !== APP_DATA_VERSION) {
        delete persisted[url];
        return null;
    }
    
    // Check TTL (e.g., 7 days)
    const age = Date.now() - entry.timestamp;
    if (age > 7 * 24 * 60 * 60 * 1000) {
        delete persisted[url];
        return null;
    }
    
    return entry;
}
```

**Benefits:**
- Prevents stale data issues
- Automatic cleanup on version changes
- TTL prevents localStorage bloat

**Estimated Effort:** 2 hours

---

#### **Split AppInitializer._setupUiEventHandlers()**

**Current:** 180-line function with 3 responsibilities.

**Recommendation:** Extract to separate functions:

```javascript
_setupSaveButton() {
    const saveButton = document.getElementById('saveCharacter');
    // ... save logic only
}

_setupUnsavedChangeIndicators() {
    const PagesShowUnsaved = new Set(['build', 'details']);
    // ... indicator logic only
}

_setupLevelUpButton() {
    const levelUpBtn = document.getElementById('openLevelUpModalBtn');
    // ... level-up logic only
}

_setupUiEventHandlers() {
    this._setupSaveButton();
    this._setupUnsavedChangeIndicators();
    this._setupLevelUpButton();
}
```

**Benefits:**
- Each function single-purpose
- Easier to test individually
- Clearer separation

**Estimated Effort:** 1-2 hours

---

#### **Use Exponential Backoff for Retries**

**Current:** Linear backoff `350ms * (attempt - 1)`

**Recommendation:**
```javascript
const BASE_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 4000;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
        const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt - 2), MAX_BACKOFF_MS);
        await _sleep(backoff);
    }
    // ... load logic
}
```

Backoff sequence: 0ms, 250ms, 500ms, 1000ms, 2000ms, 4000ms

**Benefits:**
- Better for transient failures
- Industry standard pattern
- Configurable with constants

**Estimated Effort:** 30 minutes

---

### 5.3 Low-Priority (Nice-to-Have)

#### **Centralize Hit Dice Data**

Move hardcoded hit dice from LevelUpService to ClassService (already has class JSON data).

**Estimated Effort:** 1 hour

#### **Remove Fetch Fallback from DataLoader**

If Electron-only, remove the fetch path entirely. Simplifies code and error handling.

**Estimated Effort:** 1 hour

#### **Add Deep Equality Check to AppState.setState()**

Use a library like `fast-deep-equal` to detect deep object changes, or document immutability requirement.

**Estimated Effort:** 2 hours

---

### 5.4 Refactoring ROI Analysis

| Refactoring | Risk Reduction | Maintainability Gain | Effort | Priority |
|-------------|----------------|---------------------|--------|----------|
| Remove temporal suppression | HIGH | HIGH | 2-3h | 🔴 Critical |
| Extract CharacterSchema | MEDIUM | HIGH | 1h | 🟠 High |
| Unify lookup logic | LOW | HIGH | 3-4h | 🟠 High |
| Extract import service | MEDIUM | HIGH | 4-5h | 🟠 High |
| Add cache invalidation | MEDIUM | MEDIUM | 2h | 🟡 Medium |
| Split setupUiEventHandlers | LOW | MEDIUM | 1-2h | 🟡 Medium |
| Exponential backoff | LOW | LOW | 30m | 🟢 Low |

**Recommendation:** Focus on temporal suppression removal first - it's the highest risk area.

---

## 6. RISK ASSESSMENT

### 6.1 Security Risks

#### **LOW RISK: Preload Bridge Properly Secured**

The preload script uses `contextBridge` correctly and exposes only safe, whitelisted APIs. No direct Node.js access from renderer.

**Evidence:**
- No `nodeIntegration: true` in BrowserWindow config
- `contextIsolation` enabled (Electron default)
- All IPC calls go through explicit channel handlers

**Recommendation:** Maintain current security posture. Consider periodic security audits as Electron evolves.

---

#### **LOW RISK: Input Validation Before IPC**

Character data validated in both renderer and main process:
- Renderer validates before save (prevents bad IPC calls)
- Main validates before write (defense-in-depth)

**Recommendation:** Keep double validation for defense-in-depth, but extract schema to shared module to prevent drift.

---

### 6.2 Data Integrity Risks

#### **MEDIUM RISK: Silent Service Initialization Failures**

Services that fail to load return empty data and log errors but don't prevent app startup.

**Scenario:**
1. Network issue prevents spell data from loading
2. SpellService returns `{ spell: [] }`
3. App continues, users see no spells
4. No warning modal shown

**Impact:** Users don't realize critical data is missing. They may create incomplete characters.

**Mitigation:**
- Show persistent warning banner if any service fails
- Prevent character creation until core services load
- Add "Reload Data" button in settings

---

#### **MEDIUM RISK: No Transaction Safety in Character Import**

CharacterHandlers.js writes character files without transaction safety:
```javascript
await fs.writeFile(targetFilePath, JSON.stringify(character, null, 2));
```

If write fails mid-operation, file may be corrupted or incomplete.

**Impact:** User could lose character data.

**Mitigation:**
- Write to temp file first, then rename (atomic on most filesystems)
- Add `.writeFile.tmp` extension during write
- Rename on success, cleanup temp on failure

**Example:**
```javascript
const tempPath = `${targetFilePath}.tmp`;
await fs.writeFile(tempPath, JSON.stringify(character, null, 2));
await fs.rename(tempPath, targetFilePath); // Atomic
```

---

#### **HIGH RISK: Temporal Event Suppression Creates Race Conditions**

The 150ms suppression window in AppInitializer is fragile:

**Failure Scenario:**
1. User loads character (suppression window starts)
2. Page rendering takes 200ms due to large character
3. Rendering triggers CHARACTER_UPDATED event
4. Suppression window already expired (150ms < 200ms)
5. Unsaved changes flag set incorrectly
6. User prompted to save immediately after load

**Evidence:** Magic number with no justification, synchronous timing assumptions in async environment.

**Impact:** False positives on unsaved changes, user confusion, data loss if users ignore prompts.

**Mitigation:** Replace with explicit state flags (see Section 5.1).

---

### 6.3 Memory Leak Risks

#### **MEDIUM RISK: Inconsistent Bootstrap Modal Cleanup**

Some modals use DOMCleanup, others don't:

**Good Example (UniversalSelectionModal):**
```javascript
this._cleanup.registerBootstrapModal(this.modal, this.bootstrapModal);
```

**Questionable Example (SetupModals.js):**
```javascript
this.bootstrapModal = new bootstrap.Modal(this.modal, { backdrop: false });
// No cleanup registration observed
```

**Impact:** Modal instances accumulate in memory. After 10+ character creations, dozens of modal instances may exist.

**Evidence:** SetupModals.js lines 49, 149 create modals without disposal.

**Mitigation:**
- Audit all modal creation sites
- Enforce DOMCleanup.registerBootstrapModal() usage
- Add linting rule or runtime check

---

#### **LOW RISK: EventBus Listeners Not Auto-Cleaned**

EventBus requires manual `off()` calls:
```javascript
// Components must track handlers
this._handler = () => { /* ... */ };
eventBus.on(EVENTS.SPELL_ADDED, this._handler);

// On teardown
eventBus.off(EVENTS.SPELL_ADDED, this._handler);
```

**Risk:** Components that forget to clean up accumulate listeners.

**Evidence:** SourceCard.js properly cleans up (line 206), but pattern is manual.

**Impact:** Minor - most components are singletons (don't teardown often).

**Mitigation:**
- Document cleanup requirement in EventBus
- Consider auto-cleanup via weak references (advanced)
- Add EventBus.offAll(component) helper

---

### 6.4 Maintenance Risks

#### **MEDIUM RISK: Validation Logic Duplicated**

CharacterSchema.validate() called in multiple places:
- CharacterManager.saveCharacter()
- CharacterHandlers.CHARACTER_SAVE
- CharacterHandlers.CHARACTER_IMPORT

Changes to schema require updating 3+ locations.

**Impact:** Schema drift, inconsistent validation, missed edge cases.

**Mitigation:** Extract schema to `src/shared/` (see Section 5.1).

---

#### **MEDIUM RISK: Hit Dice Hardcoded in LevelUpService**

Class hit dice duplicated in code instead of using ClassService data.

**Impact:** New classes (homebrew, future editions) require code changes instead of JSON updates.

**Mitigation:** Read hit dice from class JSON via ClassService.

---

#### **LOW RISK: Debug Mode Path Divergence**

`FF_DEBUG=true` uses hardcoded `src/data` path:
```javascript
const DEV_DATA_PATH = DEBUG_MODE
    ? path.resolve(__dirname, '..', '..', '..', 'src', 'data')
    : null;
```

Developers and users run different code paths.

**Impact:** Bugs may only manifest in production.

**Mitigation:** Use same data loading path in both modes, just different sources.

---

### 6.5 Bug Likelihood Assessment

| Risk Area | Likelihood | Severity | Detection Difficulty | Overall Risk |
|-----------|------------|----------|---------------------|--------------|
| Temporal suppression race | HIGH | MEDIUM | HIGH (intermittent) | 🔴 HIGH |
| Modal memory leaks | MEDIUM | LOW | MEDIUM | 🟠 MEDIUM |
| Service init failures | MEDIUM | HIGH | LOW (silent) | 🟠 MEDIUM |
| Character import corruption | LOW | HIGH | LOW (filesystem errors rare) | 🟡 MEDIUM |
| EventBus listener leaks | LOW | LOW | HIGH (gradual) | 🟢 LOW |
| Schema validation drift | MEDIUM | MEDIUM | MEDIUM | 🟠 MEDIUM |

---

### 6.6 Risk Mitigation Priorities

**Immediate (This Sprint):**
1. ✅ Replace temporal suppression with state flags
2. ✅ Audit modal creation for missing DOMCleanup
3. ✅ Add warning banner for service load failures

**Short-Term (Next Sprint):**
4. Extract CharacterSchema to shared module
5. Add transaction safety to character file writes
6. Document EventBus cleanup requirements

**Long-Term (Next Quarter):**
7. Implement cache invalidation strategy
8. Add automated memory leak tests
9. Unify lookup logic across services

---

## 7. CONCLUSION

### Overall Assessment: **7/10 (Good)**

Fizbane's Forge demonstrates **solid architectural foundations** with clear separation of concerns, proper Electron security practices, and consistent patterns. The EventBus + AppState design is well-suited to the domain.

### Critical Issues to Address:

1. **Temporal event suppression** - highest priority, most fragile
2. **Modal cleanup inconsistency** - memory leak potential
3. **Silent service failures** - user experience risk

### Strengths to Preserve:

1. **BaseDataService pattern** - excellent abstraction
2. **Preload security** - no changes needed
3. **EventBus architecture** - enables decoupled components
4. **DOMCleanup utility** - good memory management tool

### Long-Term Health:

The codebase shows signs of **thoughtful evolution** with architectural documentation, cleanup patterns, and consistent conventions. With focused refactoring on the temporal suppression and validation duplication, this codebase can maintain high quality as features grow.

**Recommended Next Steps:**
1. Implement temporal suppression refactoring (Section 5.1)
2. Audit all Bootstrap modal creation sites
3. Add service load failure warnings
4. Extract CharacterSchema to shared module
5. Document immutability requirements for AppState

---

**End of Audit Report**
