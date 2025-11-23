# Target Architecture - Final State

**Purpose:** This document defines the FINAL architecture after all refactoring is complete. Use this as the reference for all decisions.

---

## Complete File Structure

```
fizbanes-forge/
│
├── app/
│   ├── main.js                           # Main process entry (200 lines)
│   ├── preload.js                        # Security boundary (unchanged)
│   ├── index.html                        # Shell HTML (200 lines)
│   │
│   ├── electron/                         # MAIN PROCESS ONLY (Node.js access)
│   │   ├── WindowManager.js              # Window lifecycle management
│   │   ├── PreferencesManager.js         # App preferences storage
│   │   │
│   │   └── ipc/                          # IPC Communication Layer
│   │       ├── IPCRegistry.js            # Central handler registration
│   │       ├── channels.js               # IPC channel constants
│   │       │
│   │       └── handlers/                 # IPC Handler Modules
│   │           ├── CharacterHandlers.js  # Character CRUD operations
│   │           ├── FileHandlers.js       # File system operations
│   │           ├── SettingsHandlers.js   # Settings management
│   │           └── DataHandlers.js       # Data file loading
│   │
│   ├── js/                               # RENDERER PROCESS (sandboxed)
│   │   │
│   │   ├── infrastructure/               # Low-Level Utilities
│   │   │   ├── Logger.js                 # Centralized logging (Phase 1)
│   │   │   ├── Result.js                 # Error handling pattern (Phase 1)
│   │   │   └── EventBus.js               # Event system (Phase 1)
│   │   │
│   │   ├── domain/                       # Business Models
│   │   │   ├── Character.js              # Character entity (Phase 4)
│   │   │   ├── CharacterSchema.js        # Data schema definition (Phase 4)
│   │   │   ├── CharacterSerializer.js    # JSON serialization (Phase 4)
│   │   │   ├── ProficiencyManager.js     # Proficiency calculations (Phase 4)
│   │   │   └── AbilityManager.js         # Ability score calculations (Phase 4)
│   │   │
│   │   ├── application/                  # Business Logic
│   │   │   ├── AppState.js               # Central state management (Phase 3)
│   │   │   ├── CharacterManager.js       # Character lifecycle (Phase 4)
│   │   │   ├── CharacterLoader.js        # Character persistence (Phase 4)
│   │   │   ├── CharacterImporter.js      # Import/export (Phase 4)
│   │   │   └── ChangeTracker.js          # Unsaved changes (Phase 4)
│   │   │
│   │   ├── presentation/                 # UI Logic
│   │   │   ├── Router.js                 # Client-side routing (Phase 5)
│   │   │   ├── PageLoader.js             # Page template loading (Phase 5)
│   │   │   ├── NavigationController.js   # Navigation coordination (Phase 5)
│   │   │   ├── ComponentRegistry.js      # UI component lifecycle (Phase 5)
│   │   │   └── TemplateLoader.js         # HTML template loading (Phase 5)
│   │   │
│   │   ├── services/                     # Data Access Layer
│   │   │   ├── ClassService.js           # D&D class data (Phase 4 - refactor)
│   │   │   ├── RaceService.js            # D&D race data (Phase 4 - refactor)
│   │   │   ├── BackgroundService.js      # D&D background (Phase 4 - refactor)
│   │   │   ├── SpellService.js           # D&D spell data (Phase 4 - refactor)
│   │   │   ├── EquipmentService.js       # D&D equipment (Phase 4 - refactor)
│   │   │   ├── FeatService.js            # D&D feat data (Phase 4 - refactor)
│   │   │   ├── OptionalFeatureService.js # Optional features (Phase 4 - refactor)
│   │   │   ├── DataLoader.js             # Base data loading (Phase 4 - refactor)
│   │   │   └── FilterEngine.js           # Source filtering (Phase 4 - refactor)
│   │   │
│   │   ├── core/                         # Core Systems
│   │   │   ├── AppInitializer.js         # App initialization (Phase 3 - refactor)
│   │   │   ├── Modal.js                  # Modal dialogs (unchanged)
│   │   │   ├── Proficiency.js            # Proficiency system (unchanged)
│   │   │   └── Storage.js                # LocalStorage wrapper (Phase 3 - refactor)
│   │   │
│   │   ├── modules/                      # UI Components (mostly unchanged)
│   │   │   ├── AbilityScoreCard.js
│   │   │   ├── ClassCard.js
│   │   │   ├── RaceCard.js
│   │   │   ├── ProficiencyCard.js
│   │   │   └── ...
│   │   │
│   │   └── utils/                        # Helper Functions (mostly unchanged)
│   │       ├── Calculations.js
│   │       ├── Validators.js
│   │       ├── Formatters.js
│   │       ├── DiceRoller.js
│   │       ├── Notifications.js
│   │       └── ...
│   │
│   ├── templates/                        # HTML Templates (Phase 5)
│   │   ├── pages/
│   │   │   ├── home.html
│   │   │   ├── build.html
│   │   │   ├── equipment.html
│   │   │   ├── details.html
│   │   │   └── settings.html
│   │   │
│   │   └── modals/
│   │       ├── newCharacter.html
│   │       ├── confirmation.html
│   │       └── sourceSelection.html
│   │
│   ├── css/                              # Stylesheets (unchanged)
│   ├── data/                             # Static D&D Data (unchanged)
│   └── assets/                           # Static Assets (unchanged)
│
├── tests/
│   ├── unit/                             # Unit tests (Phases 1-4)
│   ├── integration/                      # Integration tests (Phases 4-5)
│   └── e2e/                              # End-to-end tests (Phase 6)
│
├── docs/
│   └── refactoring/                      # This guide
│
└── [config files]                        # package.json, playwright.config.js, etc.
```

---

## Layer Responsibilities

### Infrastructure Layer (`app/js/infrastructure/`)
**Created in:** Phase 1  
**Purpose:** Foundation utilities used by all other layers  
**Dependencies:** None (no dependencies on other app code)

Files:
- `Logger.js` - Centralized logging with DEBUG/INFO/WARN/ERROR levels
- `Result.js` - Type-safe error handling pattern
- `EventBus.js` - Decoupled event communication

**Key Rule:** Infrastructure code cannot depend on domain, application, or presentation code.

### Domain Layer (`app/js/domain/`)
**Created in:** Phase 4  
**Purpose:** Pure business models and logic  
**Dependencies:** Infrastructure only

Files:
- `Character.js` - Character entity (simplified to ~300 lines)
- `CharacterSchema.js` - Schema definition and validation
- `CharacterSerializer.js` - JSON conversion logic
- `ProficiencyManager.js` - Proficiency calculations
- `AbilityManager.js` - Ability score calculations

**Key Rule:** Domain code has no UI dependencies, no IPC calls, no service calls.

### Application Layer (`app/js/application/`)
**Created in:** Phases 3-4  
**Purpose:** Orchestrates business logic, manages state  
**Dependencies:** Infrastructure, Domain

Files:
- `AppState.js` - Single source of truth for application state
- `CharacterManager.js` - Character lifecycle (create, select, delete)
- `CharacterLoader.js` - Character persistence operations
- `CharacterImporter.js` - Import/export functionality
- `ChangeTracker.js` - Tracks unsaved changes

**Key Rule:** Application layer coordinates between domain models and services.

### Presentation Layer (`app/js/presentation/`)
**Created in:** Phase 5  
**Purpose:** UI logic, routing, template management  
**Dependencies:** Infrastructure, Application

Files:
- `Router.js` - Client-side routing
- `PageLoader.js` - Page template loading
- `NavigationController.js` - Navigation coordination
- `ComponentRegistry.js` - UI component lifecycle
- `TemplateLoader.js` - HTML template caching

**Key Rule:** Presentation layer handles all DOM manipulation.

### Service Layer (`app/js/services/`)
**Refactored in:** Phase 4  
**Purpose:** Data access via IPC to main process  
**Dependencies:** Infrastructure

**Changes:**
- Add Logger for all operations
- Use Result pattern for error handling
- Remove direct state access (use AppState)

### Main Process (`app/electron/`)
**Refactored in:** Phase 2  
**Purpose:** Node.js functionality, file system, IPC handlers  
**Dependencies:** None (Node.js only)

**Changes:**
- Split main.js from 768 lines to ~200 lines
- Extract IPC handlers to separate files
- Create WindowManager, PreferencesManager
- Organize by responsibility

---

## Data Flow

```
USER ACTION (click, input)
         ↓
PRESENTATION LAYER (Router, PageLoader)
         ↓
APPLICATION LAYER (CharacterManager, AppState)
         ↓
DOMAIN LAYER (Character, CharacterSchema)
         ↓
SERVICE LAYER (ClassService, RaceService)
         ↓
[IPC BRIDGE via preload.js]
         ↓
MAIN PROCESS (IPC Handlers)
         ↓
FILE SYSTEM / DISK
```

**Events flow up:**
```
FILE LOADED
    ↓ (IPC Response)
SERVICE LAYER (emits 'data:loaded')
    ↓ (EventBus)
APPLICATION LAYER (updates AppState)
    ↓ (emits 'state:changed')
PRESENTATION LAYER (updates UI)
```

---

## File Size Targets

After refactoring:

| Current File | Lines | Target File(s) | Lines Each |
|--------------|-------|----------------|------------|
| main.js | 768 | main.js + 8 handler files | ~100 each |
| CharacterLifecycle.js | 836 | 5 application layer files | ~150 each |
| Navigation.js | 692 | 4 presentation layer files | ~150 each |
| Character.js | 711 | 5 domain layer files | ~150 each |
| index.html | 1052 | index.html + 8 templates | ~130 each |

**Target:** No file over 400 lines

---

## Module Dependencies (Final)

```
infrastructure/
    ↓ (uses)
domain/
    ↓ (uses)
application/  ←→  services/
    ↓ (uses)
presentation/
```

**Key Rules:**
1. Dependencies flow downward only (no circular refs)
2. Infrastructure has no dependencies
3. Domain depends only on infrastructure
4. Application coordinates domain + services
5. Presentation depends on application

---

## State Management

**Single Source of Truth:** `AppState.js`

All state lives in AppState:
```javascript
{
  currentCharacter: Character | null,
  currentPage: string,
  isLoading: boolean,
  hasUnsavedChanges: boolean,
  characters: Character[],
  settings: Object
}
```

**State Changes:**
1. UI action triggers application layer method
2. Application layer updates AppState
3. AppState emits 'stateChanged' event
4. UI components listen and update

**No direct state mutation** - always use `AppState.setState()`

---

## IPC Communication

**Channels defined in:** `app/electron/ipc/channels.js`

```javascript
IPC_CHANNELS = {
  CHARACTER_SAVE: 'character:save',
  CHARACTER_LOAD: 'character:load',
  FILE_READ_JSON: 'file:readJson',
  SETTINGS_GET_PATH: 'settings:getPath',
  // ... all channels
}
```

**Pattern:**
```javascript
// Renderer (service layer)
const result = await window.electron.invoke(IPC_CHANNELS.CHARACTER_SAVE, data);

// Main process (handler)
ipcMain.handle(IPC_CHANNELS.CHARACTER_SAVE, (event, data) => {
  // File system operations
  return { success: true, path: '...' };
});
```

---

## Error Handling

**Pattern:** Result<T, E>

All operations that can fail return Result:

```javascript
// Success
return Result.ok(character);

// Failure
return Result.err('Character not found');

// Usage
const result = await loadCharacter(id);
if (result.isOk()) {
  const character = result.value;
} else {
  Logger.error('Load', 'Failed', result.error);
}
```

**No more:**
- `return { success: false, error: '...' }`
- `return null` (error implied)
- Inconsistent error patterns

---

## Logging Strategy

**Pattern:** Logger with categories

```javascript
// Replace all console.log with:
Logger.debug('ComponentName', 'Detailed info', data);
Logger.info('ComponentName', 'General info', data);
Logger.warn('ComponentName', 'Warning message', data);
Logger.error('ComponentName', 'Error occurred', error);
```

**Log Levels:**
- DEBUG: Detailed diagnostic (development only)
- INFO: General informational (default)
- WARN: Recoverable issues
- ERROR: Failures that need attention

---

## Testing Strategy

### Unit Tests (Phases 1-4)
**Location:** `tests/unit/`  
**Target:** Pure functions, no dependencies

Examples:
- Logger functionality
- Result pattern operations
- Domain calculations
- Schema validation

### Integration Tests (Phases 4-5)
**Location:** `tests/integration/`  
**Target:** Multiple modules working together

Examples:
- Character save/load workflow
- IPC communication
- State synchronization

### E2E Tests (Phase 6)
**Location:** `tests/e2e/`  
**Target:** Full application workflows

Examples:
- Character creation flow
- Navigation between pages
- Equipment management
- Settings changes

**Goal:** 70%+ test coverage

---

## Key Architectural Decisions

### 1. Why Layered Architecture?
- Clear separation of concerns
- Testable components
- Easy to understand
- Scales with complexity

### 2. Why Result Pattern?
- Explicit error handling
- Type-safe without TypeScript
- No hidden exceptions
- Consistent API

### 3. Why EventBus?
- Decoupled communication
- No circular dependencies
- Easy to add listeners
- Debuggable event flow

### 4. Why Split Files?
- Single Responsibility Principle
- Easier to test
- Easier to understand
- Easier to modify

### 5. Why AppState Singleton?
- Single source of truth
- Predictable state updates
- Easy to debug
- Event-driven UI updates

---

## Anti-Patterns to Avoid

❌ **Don't:**
- Put Node.js code in renderer process
- Mutate state directly (bypass AppState)
- Create circular dependencies
- Mix concerns in one file
- Use console.log (use Logger)
- Return inconsistent error types

✅ **Do:**
- Keep IPC handlers in main process
- Update state through AppState.setState()
- Follow dependency flow
- One responsibility per file
- Use Logger with categories
- Use Result pattern consistently

---

## Migration Path

Each file in the current codebase will be:

1. **Split** (if too large)
2. **Refactored** (if using old patterns)
3. **Moved** (if in wrong layer)
4. **Tested** (add tests)
5. **Documented** (add JSDoc)

See individual phase documents for specific file transformation plans.
