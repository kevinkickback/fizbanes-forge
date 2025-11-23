# Code Standards & Conventions

**Purpose:** Define coding standards for consistent implementation across all phases.

---

## File Organization

### Module Structure

Every JavaScript file follows this structure:

```javascript
/**
 * Brief description of what this module does.
 * 
 * ARCHITECTURE: [Layer Name] - Dependencies on [layers]
 * 
 * PURPOSE:
 * - Bullet point list of responsibilities
 * 
 * USAGE:
 *   Code examples showing how to use this module
 * 
 * @module [layer]/[ModuleName]
 */

// 1. Imports (grouped by layer)
import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';

// 2. Constants
const CONSTANT_NAME = 'value';

// 3. Class/Implementation
class ClassName {
  // implementation
}

// 4. Exports
export { ClassName };
export default ClassName;
```

---

## Naming Conventions

### Files
- **PascalCase** for classes: `CharacterManager.js`, `AppState.js`
- **camelCase** for utilities: `validators.js`, `formatters.js`
- **kebab-case** for pages: `character-sheet.html`

### Variables
- **camelCase** for variables and functions: `currentCharacter`, `loadCharacter()`
- **PascalCase** for classes and constructors: `Character`, `EventBus`
- **UPPER_SNAKE_CASE** for constants: `LOG_LEVELS`, `IPC_CHANNELS`

### Functions
- Use descriptive verb-noun pairs: `loadCharacter()`, `saveSettings()`, `validateInput()`
- Boolean functions start with `is`, `has`, `should`: `isValid()`, `hasChanges()`, `shouldSave()`

---

## Error Handling Pattern

### Always Use Result Pattern

**Never** do this:
```javascript
function loadCharacter(id) {
  if (!id) return null;  // ❌ Ambiguous
  if (error) throw new Error('Failed');  // ❌ Uncaught exceptions
  return { success: false, error: 'msg' };  // ❌ Inconsistent
}
```

**Always** do this:
```javascript
import { Result } from '../infrastructure/Result.js';
import { Logger } from '../infrastructure/Logger.js';

function loadCharacter(id) {
  Logger.debug('CharacterLoader', 'Loading character', { id });
  
  if (!id) {
    Logger.warn('CharacterLoader', 'Invalid ID provided');
    return Result.err('Character ID is required');
  }
  
  try {
    const character = /* load logic */;
    Logger.info('CharacterLoader', 'Character loaded', { id });
    return Result.ok(character);
  } catch (error) {
    Logger.error('CharacterLoader', 'Failed to load character', error);
    return Result.err(error.message);
  }
}

// Usage
const result = loadCharacter('123');
if (result.isOk()) {
  const character = result.value;
} else {
  console.error(result.error);
}
```

---

## Logging Pattern

### Always Use Logger, Never console.log

**Log Levels:**
- `DEBUG`: Detailed diagnostic info (development only)
- `INFO`: General informational messages  
- `WARN`: Potentially harmful situations
- `ERROR`: Error events

**Pattern:**
```javascript
import { Logger } from '../infrastructure/Logger.js';

class MyComponent {
  doSomething() {
    Logger.debug('MyComponent', 'Starting operation', { params });
    
    try {
      Logger.info('MyComponent', 'Operation successful');
      return Result.ok(data);
    } catch (error) {
      Logger.error('MyComponent', 'Operation failed', error);
      return Result.err(error.message);
    }
  }
}
```

---

## Event Communication Pattern

### Use EventBus for Decoupling

**Pattern:**
```javascript
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';

// Component A (emits event)
class CharacterManager {
  selectCharacter(character) {
    this.current = character;
    eventBus.emit(EVENTS.CHARACTER_SELECTED, character);
  }
}

// Component B (listens for event)
class CharacterDisplay {
  constructor() {
    eventBus.on(EVENTS.CHARACTER_SELECTED, this.onCharacterSelected.bind(this));
  }
  
  onCharacterSelected(character) {
    this.render(character);
  }
  
  destroy() {
    eventBus.off(EVENTS.CHARACTER_SELECTED, this.onCharacterSelected);
  }
}
```

---

## State Management Pattern

### Single Source of Truth: AppState

**Never** store state in individual components. **Always** use AppState.

**Bad:**
```javascript
// ❌ State scattered across files
class CharacterLifecycle {
  constructor() {
    this.currentCharacter = null;  // ❌ Local state
  }
}

class Navigation {
  constructor() {
    this.currentPage = 'home';  // ❌ Local state
  }
}
```

**Good:**
```javascript
// ✅ Central state management
import { AppState } from '../application/AppState.js';

class CharacterManager {
  selectCharacter(character) {
    AppState.setState({ currentCharacter: character });
  }
  
  getCurrentCharacter() {
    return AppState.getState().currentCharacter;
  }
}
```

---

## Async/Await Pattern

**Always:**
- Use `async/await` instead of `.then()` chains
- Handle errors with try/catch
- Return Result for consistent error handling

```javascript
async loadCharacter(id) {
  Logger.debug('CharacterLoader', 'Loading character', { id });
  
  try {
    const data = await window.electron.invoke('character:load', id);
    Logger.info('CharacterLoader', 'Character loaded successfully');
    return Result.ok(data);
  } catch (error) {
    Logger.error('CharacterLoader', 'Failed to load character', error);
    return Result.err(error.message);
  }
}
```

---

## JSDoc Comments

### Every Function Needs Documentation

```javascript
/**
 * Load a character from disk by ID.
 * 
 * @param {string} id - Character ID to load
 * @returns {Promise<Result<Character, string>>} Result containing character or error
 * 
 * @example
 *   const result = await loadCharacter('abc-123');
 *   if (result.isOk()) {
 *     console.log(result.value);
 *   }
 */
async loadCharacter(id) {
  // implementation
}
```

---

## Import Order

```javascript
// 1. Infrastructure (no dependencies)
import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';

// 2. Domain (depends on infrastructure)
import { Character } from '../domain/Character.js';
import { CharacterSchema } from '../domain/CharacterSchema.js';

// 3. Application (depends on infrastructure + domain)
import { AppState } from '../application/AppState.js';
import { CharacterManager } from '../application/CharacterManager.js';

// 4. Services (depends on infrastructure)
import { ClassService } from '../services/ClassService.js';

// 5. Current layer utilities
import { validateInput } from './validators.js';
```

---

## File Size Limits

- **Target:** 150-300 lines per file
- **Maximum:** 400 lines per file
- **If exceeded:** Split into multiple files by responsibility

---

## Testing Patterns

### Unit Test Structure

```javascript
import { test, expect } from '@playwright/test';
import { Logger, LOG_LEVELS } from '../app/js/infrastructure/Logger.js';

test.describe('Logger', () => {
  test.beforeEach(() => {
    Logger.clearHistory();
    Logger.setLevel('DEBUG');
  });

  test('should log debug messages', () => {
    Logger.debug('TestCategory', 'Test message', { data: 'value' });
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].level).toBe('DEBUG');
    expect(history[0].category).toBe('TestCategory');
    expect(history[0].message).toBe('Test message');
  });
});
```

---

## Git Commit Messages

### Format

```
type(scope): brief description

Detailed explanation if needed

- Bullet points for key changes
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Adding tests
- `docs`: Documentation changes
- `chore`: Build/config changes

### Examples

```
feat(infrastructure): add Logger utility

- Centralized logging with DEBUG/INFO/WARN/ERROR levels
- Log history storage for debugging
- Replaces all console.log statements

Files created:
- app/js/infrastructure/Logger.js
- tests/unit/Logger.spec.js
```

```
refactor(services): update ClassService to use Result pattern

- Replace null returns with Result.err()
- Add Logger for all operations
- Remove direct state access

Modified:
- app/js/services/ClassService.js
```

---

## Architecture Layer Rules

### Infrastructure Layer
- **NO** dependencies on other app code
- **Only** pure utilities
- Examples: Logger, Result, EventBus

### Domain Layer
- **Depends on:** Infrastructure only
- **NO** UI code, **NO** IPC calls, **NO** services
- Examples: Character, CharacterSchema

### Application Layer
- **Depends on:** Infrastructure, Domain
- **Coordinates** business logic
- Examples: AppState, CharacterManager

### Service Layer
- **Depends on:** Infrastructure
- **Handles** IPC communication
- Examples: ClassService, RaceService

### Presentation Layer
- **Depends on:** Infrastructure, Application
- **Handles** all DOM manipulation
- Examples: Router, PageLoader

**Rule:** Dependencies flow downward only. No circular dependencies.

---

## IPC Communication Pattern

### Renderer Process (Service Layer)

```javascript
import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';
import { IPC_CHANNELS } from '../constants/channels.js';

class CharacterService {
  async saveCharacter(character) {
    Logger.debug('CharacterService', 'Saving character', { id: character.id });
    
    try {
      const result = await window.electron.invoke(
        IPC_CHANNELS.CHARACTER_SAVE,
        character
      );
      
      Logger.info('CharacterService', 'Character saved', { path: result.path });
      return Result.ok(result);
    } catch (error) {
      Logger.error('CharacterService', 'Failed to save character', error);
      return Result.err(error.message);
    }
  }
}
```

### Main Process (Handler)

```javascript
// app/electron/ipc/handlers/CharacterHandlers.js
const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');

function registerCharacterHandlers(preferencesManager) {
  ipcMain.handle('character:save', async (event, character) => {
    try {
      const savePath = preferencesManager.get('characterSavePath');
      const filePath = path.join(savePath, `${character.id}.json`);
      
      await fs.writeFile(filePath, JSON.stringify(character, null, 2));
      
      return { success: true, path: filePath };
    } catch (error) {
      console.error('[CharacterHandlers] Save failed:', error);
      throw error;
    }
  });
}

module.exports = { registerCharacterHandlers };
```

---

## Anti-Patterns to Avoid

### ❌ Don't

```javascript
// Direct state mutation
this.currentCharacter = newCharacter;

// Inconsistent error handling
if (error) return null;
if (error) throw new Error();
if (error) return { success: false };

// console.log everywhere
console.log('Debug info');

// Circular dependencies
import { A } from './A.js';  // A imports B, B imports A

// Giant files
// CharacterLifecycle.js (836 lines) ❌

// Mixed concerns
class CharacterManager {
  loadCharacter() { }
  renderUI() { }  // ❌ Mixing concerns
}
```

### ✅ Do

```javascript
// Central state management
AppState.setState({ currentCharacter: newCharacter });

// Consistent error handling
return Result.ok(data);
return Result.err('Error message');

// Proper logging
Logger.info('Component', 'Message', data);

// Clean dependencies
// Infrastructure ← Domain ← Application ← Presentation

// Focused files
// CharacterManager.js (150 lines) ✅
// CharacterLoader.js (150 lines) ✅

// Single responsibility
class CharacterManager {
  loadCharacter() { }  // Business logic only
}

class CharacterView {
  render() { }  // UI only
}
```
