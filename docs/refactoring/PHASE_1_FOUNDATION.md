# Phase 1: Foundation - Infrastructure Layer

**Objective:** Create the foundational infrastructure components that will be used throughout all subsequent phases.

**Duration:** Week 1 (8-12 hours)

**Files Created:** 6 files (3 implementation + 3 test files)

**Files Modified:** None

**Dependencies:** None - This is the first phase

---

## Final Architecture Reference

After completing this phase, you will have:

```
app/js/infrastructure/
├── Logger.js          (~220 lines) - Centralized logging system
├── Result.js          (~100 lines) - Type-safe error handling
└── EventBus.js        (~140 lines) - Event communication system

tests/unit/
├── Logger.spec.js     (~200 lines) - Logger tests
├── Result.spec.js     (~150 lines) - Result pattern tests
└── EventBus.spec.js   (~180 lines) - EventBus tests
```

**Phase Outcomes:**
- All future code will use Logger instead of console.log
- All future functions will return Result<T, E> instead of inconsistent error patterns
- All future components will communicate via EventBus instead of tight coupling

---

## Phase Overview

This phase establishes core infrastructure utilities:

1. **Logger.js** - Centralized logging with DEBUG/INFO/WARN/ERROR levels
2. **Result.js** - Type-safe error handling pattern (like Rust's Result<T, E>)
3. **EventBus.js** - Decoupled event communication

**Why Start Here:**
- Zero dependencies on existing code
- Every subsequent phase uses these utilities
- Tests validate immediately
- Foundation prevents future rework

---

## Prerequisites Validation

Run these commands before starting:

```powershell
# 1. Verify correct directory
Get-Location  # Must show: C:\Users\K\Workbench\Dev\Electron\fizbanes-forge

# 2. Verify correct branch
git branch --show-current  # Must show: refactor

# 3. Check working directory is clean
git status  # Must show "working tree clean" or only docs/ changes

# 4. Verify Playwright installed
npx playwright --version  # Must show version 1.x.x
```

**If ANY check fails, STOP and fix it before continuing.**

---

## Step 1: Create Logger.js

**Objective:** Replace all console.log with centralized Logger.

**Time Estimate:** 1-2 hours

**File Location:** `app/js/infrastructure/Logger.js`

**Purpose:** Provides consistent logging with filterable levels. Used by all future code.

### 1.1: Create Directory

```powershell
New-Item -ItemType Directory -Path "app/js/infrastructure" -Force
```

**Expected Output:** 
```
Directory: C:\Users\K\Workbench\Dev\Electron\fizbanes-forge\app\js

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----
d-----        11/23/2025  12:00 PM                infrastructure
```

**Validation:**
- [ ] Directory exists
- [ ] No errors shown

### 1.2: Create Logger.js

Create file `app/js/infrastructure/Logger.js` with this COMPLETE code:

```javascript
/**
 * Centralized logging system with configurable log levels.
 * 
 * ARCHITECTURE: Infrastructure Layer - No dependencies on other app code
 * 
 * PURPOSE:
 * - Replaces all console.log statements
 * - Provides filterable log levels (DEBUG, INFO, WARN, ERROR)
 * - Stores log history for debugging
 * - Consistent format across entire application
 * 
 * USAGE EXAMPLES:
 *   import { Logger } from '../infrastructure/Logger.js';
 *   
 *   Logger.debug('ComponentName', 'Detailed diagnostic info', { data });
 *   Logger.info('ComponentName', 'General informational message');
 *   Logger.warn('ComponentName', 'Warning message', { context });
 *   Logger.error('ComponentName', 'Error occurred', error);
 * 
 * CONFIGURATION:
 *   Logger.setLevel('DEBUG')  // Show all logs
 *   Logger.setLevel('INFO')   // Show INFO, WARN, ERROR (default)
 *   Logger.setLevel('WARN')   // Show WARN, ERROR only
 *   Logger.setLevel('ERROR')  // Show ERROR only
 *   Logger.setEnabled(false)  // Disable all logging
 * 
 * LOG HISTORY:
 *   const history = Logger.getHistory();           // Get all logs
 *   const errors = Logger.getHistory('ERROR');     // Get only errors
 *   Logger.clearHistory();                         // Clear log history
 * 
 * @module infrastructure/Logger
 */

export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class LoggerImpl {
  constructor() {
    this.currentLevel = LOG_LEVELS.INFO;
    this.enabled = true;
    this.history = [];
    this.maxHistorySize = 1000;
  }

  setLevel(level) {
    const upperLevel = level.toUpperCase();
    if (LOG_LEVELS.hasOwnProperty(upperLevel)) {
      this.currentLevel = LOG_LEVELS[upperLevel];
    } else {
      console.warn(`[Logger] Invalid log level: ${level}. Using INFO.`);
      this.currentLevel = LOG_LEVELS.INFO;
    }
  }

  getLevel() {
    return Object.keys(LOG_LEVELS).find(
      key => LOG_LEVELS[key] === this.currentLevel
    );
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  shouldLog(level) {
    return this.enabled && level >= this.currentLevel;
  }

  formatLog(level, category, message, data) {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data
    };
  }

  addToHistory(logEntry) {
    this.history.push(logEntry);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  getHistory(filterLevel) {
    if (!filterLevel) {
      return [...this.history];
    }
    return this.history.filter(entry => entry.level === filterLevel);
  }

  clearHistory() {
    this.history = [];
  }

  debug(category, message, data = null) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    
    const logEntry = this.formatLog('DEBUG', category, message, data);
    this.addToHistory(logEntry);
    
    console.debug(`[DEBUG] [${category}] ${message}`, data !== null ? data : '');
  }

  info(category, message, data = null) {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    
    const logEntry = this.formatLog('INFO', category, message, data);
    this.addToHistory(logEntry);
    
    console.info(`[INFO] [${category}] ${message}`, data !== null ? data : '');
  }

  warn(category, message, data = null) {
    if (!this.shouldLog(LOG_LEVELS.WARN)) return;
    
    const logEntry = this.formatLog('WARN', category, message, data);
    this.addToHistory(logEntry);
    
    console.warn(`[WARN] [${category}] ${message}`, data !== null ? data : '');
  }

  error(category, message, error = null) {
    if (!this.shouldLog(LOG_LEVELS.ERROR)) return;
    
    const logEntry = this.formatLog('ERROR', category, message, error);
    this.addToHistory(logEntry);
    
    console.error(`[ERROR] [${category}] ${message}`, error !== null ? error : '');
  }
}

export const Logger = new LoggerImpl();
```

**Validation:**
- [ ] File created at `app/js/infrastructure/Logger.js`
- [ ] File is approximately 220 lines
- [ ] No syntax errors: `npx biome check app/js/infrastructure/Logger.js`

---

## Step 2: Test Logger.js

**Objective:** Validate Logger functionality with comprehensive tests.

**Time Estimate:** 30 minutes

### 2.1: Create Test Directory

```powershell
New-Item -ItemType Directory -Path "tests/unit" -Force
```

### 2.2: Create Logger Test File

Create file `tests/unit/Logger.spec.js` with this COMPLETE code:

```javascript
import { test, expect } from '@playwright/test';
import { Logger, LOG_LEVELS } from '../../app/js/infrastructure/Logger.js';

test.describe('Logger - Basic Functionality', () => {
  
  test.beforeEach(() => {
    Logger.clearHistory();
    Logger.setLevel('DEBUG');
    Logger.setEnabled(true);
  });

  test('should log debug messages when level is DEBUG', () => {
    Logger.debug('TestCategory', 'Debug message', { test: true });
    
    const history = Logger.getHistory();
    
    expect(history).toHaveLength(1);
    expect(history[0].level).toBe('DEBUG');
    expect(history[0].category).toBe('TestCategory');
    expect(history[0].message).toBe('Debug message');
    expect(history[0].data).toEqual({ test: true });
    expect(history[0].timestamp).toBeTruthy();
  });

  test('should not log debug messages when level is INFO', () => {
    Logger.setLevel('INFO');
    Logger.debug('TestCategory', 'Debug message');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(0);
  });

  test('should log info messages when level is INFO', () => {
    Logger.setLevel('INFO');
    Logger.info('TestCategory', 'Info message');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].level).toBe('INFO');
  });

  test('should log warn messages at all levels except ERROR only', () => {
    Logger.setLevel('WARN');
    Logger.warn('TestCategory', 'Warning message');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].level).toBe('WARN');
  });

  test('should log error messages at all levels', () => {
    Logger.setLevel('ERROR');
    Logger.error('TestCategory', 'Error message', new Error('Test error'));
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].level).toBe('ERROR');
  });
});

test.describe('Logger - Level Management', () => {
  
  test.beforeEach(() => {
    Logger.clearHistory();
    Logger.setLevel('DEBUG');
  });

  test('should set and get log level', () => {
    Logger.setLevel('WARN');
    expect(Logger.getLevel()).toBe('WARN');
  });

  test('should handle invalid log level gracefully', () => {
    Logger.setLevel('INVALID');
    expect(Logger.getLevel()).toBe('INFO'); // Falls back to INFO
  });

  test('should respect log level hierarchy', () => {
    Logger.setLevel('WARN');
    
    Logger.debug('Test', 'Debug');
    Logger.info('Test', 'Info');
    Logger.warn('Test', 'Warn');
    Logger.error('Test', 'Error');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(2); // Only WARN and ERROR
    expect(history[0].level).toBe('WARN');
    expect(history[1].level).toBe('ERROR');
  });
});

test.describe('Logger - History Management', () => {
  
  test.beforeEach(() => {
    Logger.clearHistory();
    Logger.setLevel('DEBUG');
  });

  test('should filter history by log level', () => {
    Logger.debug('Test', 'Debug');
    Logger.info('Test', 'Info');
    Logger.warn('Test', 'Warn');
    Logger.error('Test', 'Error');
    
    const errorLogs = Logger.getHistory('ERROR');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].level).toBe('ERROR');
    
    const warnLogs = Logger.getHistory('WARN');
    expect(warnLogs).toHaveLength(1);
    expect(warnLogs[0].level).toBe('WARN');
  });

  test('should return all logs when no filter specified', () => {
    Logger.debug('Test', 'Debug');
    Logger.info('Test', 'Info');
    
    const allLogs = Logger.getHistory();
    expect(allLogs).toHaveLength(2);
  });

  test('should clear history', () => {
    Logger.info('Test', 'Message 1');
    Logger.info('Test', 'Message 2');
    
    expect(Logger.getHistory()).toHaveLength(2);
    
    Logger.clearHistory();
    expect(Logger.getHistory()).toHaveLength(0);
  });

  test('should respect max history size', () => {
    const originalMax = Logger.maxHistorySize;
    Logger.maxHistorySize = 3;
    
    Logger.info('Test', 'Message 1');
    Logger.info('Test', 'Message 2');
    Logger.info('Test', 'Message 3');
    Logger.info('Test', 'Message 4');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].message).toBe('Message 2'); // First message dropped
    expect(history[2].message).toBe('Message 4');
    
    Logger.maxHistorySize = originalMax;
  });
});

test.describe('Logger - Enable/Disable', () => {
  
  test.beforeEach(() => {
    Logger.clearHistory();
    Logger.setLevel('DEBUG');
  });

  test('should disable all logging when setEnabled(false)', () => {
    Logger.setEnabled(false);
    
    Logger.debug('Test', 'Debug');
    Logger.info('Test', 'Info');
    Logger.warn('Test', 'Warn');
    Logger.error('Test', 'Error');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(0);
  });

  test('should re-enable logging when setEnabled(true)', () => {
    Logger.setEnabled(false);
    Logger.info('Test', 'Should not log');
    
    Logger.setEnabled(true);
    Logger.info('Test', 'Should log');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].message).toBe('Should log');
  });
});
```

### 2.3: Run Logger Tests

```powershell
npx playwright test tests/unit/Logger.spec.js
```

**Expected Output:**
```
Running 14 tests using 1 worker
  14 passed (2.5s)
```

**Validation:**
- [ ] All 14 tests pass
- [ ] No test failures or errors
- [ ] Test report shows 100% pass rate

---

## Step 3: Create Result.js

**Objective:** Implement type-safe error handling pattern.

**Time Estimate:** 1 hour

**File Location:** `app/js/infrastructure/Result.js`

**Purpose:** Provides consistent error handling to replace null returns, exceptions, and inconsistent error objects.

### 3.1: Create Result.js

Create file `app/js/infrastructure/Result.js` with this COMPLETE code:

```javascript
/**
 * Result type for type-safe error handling.
 * 
 * ARCHITECTURE: Infrastructure Layer - No dependencies on other app code
 * 
 * PURPOSE:
 * - Replaces inconsistent error handling (null returns, exceptions, error objects)
 * - Makes errors explicit and type-safe
 * - Forces error handling at call site
 * - Similar to Rust's Result<T, E> or Haskell's Either
 * 
 * USAGE EXAMPLES:
 *   import { Result } from '../infrastructure/Result.js';
 *   
 *   // Success case
 *   function loadUser(id) {
 *     const user = { id, name: 'John' };
 *     return Result.ok(user);
 *   }
 *   
 *   // Error case
 *   function loadUser(id) {
 *     return Result.err('User not found');
 *   }
 *   
 *   // Usage
 *   const result = loadUser(123);
 *   if (result.isOk()) {
 *     console.log(result.value);
 *   } else {
 *     console.error(result.error);
 *   }
 *   
 *   // Chaining with map
 *   const name = result
 *     .map(user => user.name)
 *     .unwrapOr('Unknown');
 * 
 * @module infrastructure/Result
 */

class Result {
  constructor(isSuccess, value, error) {
    this._isSuccess = isSuccess;
    this._value = value;
    this._error = error;
  }

  /**
   * Create a successful Result.
   * @param {*} value - The success value
   * @returns {Result} Result containing the value
   */
  static ok(value) {
    return new Result(true, value, null);
  }

  /**
   * Create a failed Result.
   * @param {*} error - The error value
   * @returns {Result} Result containing the error
   */
  static err(error) {
    return new Result(false, null, error);
  }

  /**
   * Check if Result is successful.
   * @returns {boolean} True if successful
   */
  isOk() {
    return this._isSuccess;
  }

  /**
   * Check if Result is an error.
   * @returns {boolean} True if error
   */
  isErr() {
    return !this._isSuccess;
  }

  /**
   * Get the success value.
   * @returns {*} The value if successful
   * @throws {Error} If Result is an error
   */
  get value() {
    if (this._isSuccess) {
      return this._value;
    }
    throw new Error('Cannot get value from error Result');
  }

  /**
   * Get the error value.
   * @returns {*} The error if failed
   * @throws {Error} If Result is successful
   */
  get error() {
    if (!this._isSuccess) {
      return this._error;
    }
    throw new Error('Cannot get error from successful Result');
  }

  /**
   * Map a function over the success value.
   * @param {Function} fn - Function to apply to value
   * @returns {Result} New Result with mapped value or original error
   */
  map(fn) {
    if (this._isSuccess) {
      try {
        return Result.ok(fn(this._value));
      } catch (error) {
        return Result.err(error.message);
      }
    }
    return this;
  }

  /**
   * Map a function over the error value.
   * @param {Function} fn - Function to apply to error
   * @returns {Result} New Result with mapped error or original value
   */
  mapErr(fn) {
    if (!this._isSuccess) {
      return Result.err(fn(this._error));
    }
    return this;
  }

  /**
   * Chain Result-returning operations.
   * @param {Function} fn - Function that returns a Result
   * @returns {Result} Result from fn or original error
   */
  andThen(fn) {
    if (this._isSuccess) {
      return fn(this._value);
    }
    return this;
  }

  /**
   * Get value or return default.
   * @param {*} defaultValue - Value to return if error
   * @returns {*} Value if successful, defaultValue if error
   */
  unwrapOr(defaultValue) {
    return this._isSuccess ? this._value : defaultValue;
  }

  /**
   * Get value or compute default from error.
   * @param {Function} fn - Function to compute default from error
   * @returns {*} Value if successful, fn(error) if error
   */
  unwrapOrElse(fn) {
    return this._isSuccess ? this._value : fn(this._error);
  }

  /**
   * Match on Result and execute corresponding function.
   * @param {Object} pattern - Object with ok and err functions
   * @returns {*} Result of matched function
   */
  match(pattern) {
    if (this._isSuccess) {
      return pattern.ok(this._value);
    }
    return pattern.err(this._error);
  }
}

export { Result };
```

**Validation:**
- [ ] File created at `app/js/infrastructure/Result.js`
- [ ] File is approximately 180 lines
- [ ] No syntax errors: `npx biome check app/js/infrastructure/Result.js`

---

## Step 4: Test Result.js

**Objective:** Validate Result pattern functionality.

**Time Estimate:** 30 minutes

### 4.1: Create Result Test File

Create file `tests/unit/Result.spec.js` with this COMPLETE code:

```javascript
import { test, expect } from '@playwright/test';
import { Result } from '../../app/js/infrastructure/Result.js';

test.describe('Result - Success Cases', () => {
  
  test('should create successful Result with ok()', () => {
    const result = Result.ok({ data: 'test' });
    
    expect(result.isOk()).toBe(true);
    expect(result.isErr()).toBe(false);
    expect(result.value).toEqual({ data: 'test' });
  });

  test('should create successful Result with primitive value', () => {
    const result = Result.ok(42);
    
    expect(result.isOk()).toBe(true);
    expect(result.value).toBe(42);
  });

  test('should create successful Result with null value', () => {
    const result = Result.ok(null);
    
    expect(result.isOk()).toBe(true);
    expect(result.value).toBe(null);
  });

  test('should map over successful Result', () => {
    const result = Result.ok(5);
    const mapped = result.map(x => x * 2);
    
    expect(mapped.isOk()).toBe(true);
    expect(mapped.value).toBe(10);
  });

  test('should chain map operations', () => {
    const result = Result.ok(3)
      .map(x => x * 2)
      .map(x => x + 1)
      .map(x => x.toString());
    
    expect(result.isOk()).toBe(true);
    expect(result.value).toBe('7');
  });

  test('should unwrapOr return value for successful Result', () => {
    const result = Result.ok('success');
    expect(result.unwrapOr('default')).toBe('success');
  });

  test('should unwrapOrElse return value for successful Result', () => {
    const result = Result.ok('success');
    expect(result.unwrapOrElse(() => 'default')).toBe('success');
  });

  test('should andThen chain Result-returning operations', () => {
    const result = Result.ok(5)
      .andThen(x => Result.ok(x * 2))
      .andThen(x => Result.ok(x + 1));
    
    expect(result.isOk()).toBe(true);
    expect(result.value).toBe(11);
  });

  test('should match execute ok branch', () => {
    const result = Result.ok(42);
    const matched = result.match({
      ok: (val) => `Success: ${val}`,
      err: (err) => `Error: ${err}`
    });
    
    expect(matched).toBe('Success: 42');
  });
});

test.describe('Result - Error Cases', () => {
  
  test('should create error Result with err()', () => {
    const result = Result.err('Something went wrong');
    
    expect(result.isErr()).toBe(true);
    expect(result.isOk()).toBe(false);
    expect(result.error).toBe('Something went wrong');
  });

  test('should create error Result with error object', () => {
    const errorObj = new Error('Test error');
    const result = Result.err(errorObj);
    
    expect(result.isErr()).toBe(true);
    expect(result.error).toBe(errorObj);
  });

  test('should not map over error Result', () => {
    const result = Result.err('error');
    const mapped = result.map(x => x * 2);
    
    expect(mapped.isErr()).toBe(true);
    expect(mapped.error).toBe('error');
  });

  test('should unwrapOr return default for error Result', () => {
    const result = Result.err('error');
    expect(result.unwrapOr('default')).toBe('default');
  });

  test('should unwrapOrElse compute default for error Result', () => {
    const result = Result.err('error');
    expect(result.unwrapOrElse(err => `Failed: ${err}`)).toBe('Failed: error');
  });

  test('should handle errors with mapErr()', () => {
    const result = Result.err('Original error');
    const mapped = result.mapErr(e => `Wrapped: ${e}`);
    
    expect(mapped.isErr()).toBe(true);
    expect(mapped.error).toBe('Wrapped: Original error');
  });

  test('should not andThen on error Result', () => {
    const result = Result.err('error')
      .andThen(x => Result.ok(x * 2));
    
    expect(result.isErr()).toBe(true);
    expect(result.error).toBe('error');
  });

  test('should match execute err branch', () => {
    const result = Result.err('failure');
    const matched = result.match({
      ok: (val) => `Success: ${val}`,
      err: (err) => `Error: ${err}`
    });
    
    expect(matched).toBe('Error: failure');
  });

  test('should throw when accessing value on error Result', () => {
    const result = Result.err('error');
    expect(() => result.value).toThrow('Cannot get value from error Result');
  });

  test('should throw when accessing error on success Result', () => {
    const result = Result.ok('success');
    expect(() => result.error).toThrow('Cannot get error from successful Result');
  });
});

test.describe('Result - Edge Cases', () => {
  
  test('should handle map function that throws', () => {
    const result = Result.ok(5);
    const mapped = result.map(x => {
      throw new Error('Map failed');
    });
    
    expect(mapped.isErr()).toBe(true);
    expect(mapped.error).toBe('Map failed');
  });

  test('should handle andThen that returns error', () => {
    const result = Result.ok(5)
      .andThen(x => Result.err('Processing failed'));
    
    expect(result.isErr()).toBe(true);
    expect(result.error).toBe('Processing failed');
  });

  test('should preserve error through map chain', () => {
    const result = Result.err('initial error')
      .map(x => x * 2)
      .map(x => x + 1);
    
    expect(result.isErr()).toBe(true);
    expect(result.error).toBe('initial error');
  });
});
```

### 4.2: Run Result Tests

```powershell
npx playwright test tests/unit/Result.spec.js
```

**Expected Output:**
```
Running 23 tests using 1 worker
  23 passed (3.0s)
```

**Validation:**
- [ ] All 23 tests pass
- [ ] No test failures or errors
- [ ] Test report shows 100% pass rate

---

## Step 5: Create EventBus.js

**Objective:** Implement decoupled event communication system.

**Time Estimate:** 1 hour

**File Location:** `app/js/infrastructure/EventBus.js`

**Purpose:** Enables loose coupling between components through event-driven communication.

### 5.1: Create EventBus.js

Create file `app/js/infrastructure/EventBus.js` with this COMPLETE code:

```javascript
/**
 * Event bus for decoupled component communication.
 * 
 * ARCHITECTURE: Infrastructure Layer - No dependencies on other app code
 * 
 * PURPOSE:
 * - Enables loose coupling between components
 * - Components don't need direct references to each other
 * - Easy to add/remove event listeners
 * - Prevents circular dependencies
 * 
 * USAGE EXAMPLES:
 *   import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
 *   
 *   // Component A - Emit event
 *   eventBus.emit(EVENTS.CHARACTER_SELECTED, character);
 *   
 *   // Component B - Listen for event
 *   eventBus.on(EVENTS.CHARACTER_SELECTED, (character) => {
 *     console.log('Character changed:', character);
 *   });
 *   
 *   // Component B - Cleanup
 *   eventBus.off(EVENTS.CHARACTER_SELECTED, handlerFunction);
 *   
 *   // One-time listener
 *   eventBus.once(EVENTS.APP_READY, () => {
 *     console.log('App is ready!');
 *   });
 * 
 * @module infrastructure/EventBus
 */

import { Logger } from './Logger.js';

/**
 * Standard event names used throughout the application.
 * Add new events here as needed.
 */
export const EVENTS = {
  // Application lifecycle
  APP_READY: 'app:ready',
  APP_SHUTDOWN: 'app:shutdown',
  
  // State changes
  STATE_CHANGED: 'state:changed',
  
  // Character events
  CHARACTER_SELECTED: 'character:selected',
  CHARACTER_CREATED: 'character:created',
  CHARACTER_DELETED: 'character:deleted',
  CHARACTER_UPDATED: 'character:updated',
  CHARACTER_SAVED: 'character:saved',
  CHARACTER_LOADED: 'character:loaded',
  
  // Navigation events
  PAGE_CHANGED: 'page:changed',
  PAGE_LOADED: 'page:loaded',
  
  // Data events
  DATA_LOADED: 'data:loaded',
  DATA_ERROR: 'data:error',
  
  // UI events
  MODAL_OPENED: 'modal:opened',
  MODAL_CLOSED: 'modal:closed',
  
  // Error events
  ERROR_OCCURRED: 'error:occurred'
};

class EventBusImpl {
  constructor() {
    this.listeners = new Map();
    this.onceListeners = new Map();
  }

  /**
   * Register an event listener.
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  on(event, handler) {
    if (typeof handler !== 'function') {
      Logger.error('EventBus', 'Handler must be a function', { event });
      return;
    }

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event).push(handler);
    Logger.debug('EventBus', 'Listener registered', { event, totalListeners: this.listeners.get(event).length });
  }

  /**
   * Register a one-time event listener.
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   */
  once(event, handler) {
    if (typeof handler !== 'function') {
      Logger.error('EventBus', 'Handler must be a function', { event });
      return;
    }

    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, []);
    }

    this.onceListeners.get(event).push(handler);
    Logger.debug('EventBus', 'One-time listener registered', { event });
  }

  /**
   * Remove an event listener.
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function to remove
   */
  off(event, handler) {
    if (this.listeners.has(event)) {
      const handlers = this.listeners.get(event);
      const index = handlers.indexOf(handler);
      
      if (index !== -1) {
        handlers.splice(index, 1);
        Logger.debug('EventBus', 'Listener removed', { event, remainingListeners: handlers.length });
        
        if (handlers.length === 0) {
          this.listeners.delete(event);
        }
      }
    }
  }

  /**
   * Emit an event with optional data.
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to handlers
   */
  emit(event, ...args) {
    Logger.debug('EventBus', 'Event emitted', { event, argsCount: args.length });

    // Handle regular listeners
    if (this.listeners.has(event)) {
      const handlers = [...this.listeners.get(event)];
      
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          Logger.error('EventBus', 'Error in event handler', { event, error });
        }
      }
    }

    // Handle once listeners
    if (this.onceListeners.has(event)) {
      const handlers = [...this.onceListeners.get(event)];
      this.onceListeners.delete(event);
      
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          Logger.error('EventBus', 'Error in once handler', { event, error });
        }
      }
    }
  }

  /**
   * Remove all listeners for a specific event.
   * @param {string} event - Event name
   */
  clearEvent(event) {
    this.listeners.delete(event);
    this.onceListeners.delete(event);
    Logger.debug('EventBus', 'Event cleared', { event });
  }

  /**
   * Remove all listeners for all events.
   */
  clearAll() {
    this.listeners.clear();
    this.onceListeners.clear();
    Logger.debug('EventBus', 'All events cleared');
  }

  /**
   * Get count of listeners for an event.
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    const regularCount = this.listeners.has(event) ? this.listeners.get(event).length : 0;
    const onceCount = this.onceListeners.has(event) ? this.onceListeners.get(event).length : 0;
    return regularCount + onceCount;
  }

  /**
   * Get all registered event names.
   * @returns {string[]} Array of event names
   */
  eventNames() {
    const regular = Array.from(this.listeners.keys());
    const once = Array.from(this.onceListeners.keys());
    return [...new Set([...regular, ...once])];
  }
}

export const eventBus = new EventBusImpl();
export { EventBusImpl };
```

**Validation:**
- [ ] File created at `app/js/infrastructure/EventBus.js`
- [ ] File is approximately 200 lines
- [ ] No syntax errors: `npx biome check app/js/infrastructure/EventBus.js`

---

## Step 6: Test EventBus.js

**Objective:** Validate EventBus functionality.

**Time Estimate:** 45 minutes

### 6.1: Create EventBus Test File

Create file `tests/unit/EventBus.spec.js` with this COMPLETE code:

```javascript
import { test, expect } from '@playwright/test';
import { EventBusImpl, EVENTS } from '../../app/js/infrastructure/EventBus.js';

test.describe('EventBus - Event Emission and Listening', () => {
  
  let eventBus;

  test.beforeEach(() => {
    eventBus = new EventBusImpl();
  });

  test('should emit and receive events', () => {
    let received = null;
    
    eventBus.on('test:event', (data) => {
      received = data;
    });
    
    eventBus.emit('test:event', { value: 'test' });
    
    expect(received).toEqual({ value: 'test' });
  });

  test('should support multiple listeners for same event', () => {
    const results = [];
    
    eventBus.on('test:event', (data) => results.push(`listener1: ${data}`));
    eventBus.on('test:event', (data) => results.push(`listener2: ${data}`));
    
    eventBus.emit('test:event', 'hello');
    
    expect(results).toEqual(['listener1: hello', 'listener2: hello']);
  });

  test('should pass multiple arguments to listeners', () => {
    let arg1, arg2, arg3;
    
    eventBus.on('test:event', (a, b, c) => {
      arg1 = a;
      arg2 = b;
      arg3 = c;
    });
    
    eventBus.emit('test:event', 'first', 'second', 'third');
    
    expect(arg1).toBe('first');
    expect(arg2).toBe('second');
    expect(arg3).toBe('third');
  });

  test('should not call listener if event not emitted', () => {
    let called = false;
    
    eventBus.on('test:event', () => {
      called = true;
    });
    
    eventBus.emit('other:event');
    
    expect(called).toBe(false);
  });
});

test.describe('EventBus - Listener Removal', () => {
  
  let eventBus;

  test.beforeEach(() => {
    eventBus = new EventBusImpl();
  });

  test('should remove listener with off()', () => {
    let count = 0;
    const listener = () => count++;
    
    eventBus.on('test:event', listener);
    eventBus.emit('test:event');
    expect(count).toBe(1);
    
    eventBus.off('test:event', listener);
    eventBus.emit('test:event');
    expect(count).toBe(1); // Not called again
  });

  test('should only remove specified listener', () => {
    let count1 = 0;
    let count2 = 0;
    const listener1 = () => count1++;
    const listener2 = () => count2++;
    
    eventBus.on('test:event', listener1);
    eventBus.on('test:event', listener2);
    
    eventBus.off('test:event', listener1);
    eventBus.emit('test:event');
    
    expect(count1).toBe(0);
    expect(count2).toBe(1);
  });

  test('should clear all listeners for an event', () => {
    let count1 = 0;
    let count2 = 0;
    
    eventBus.on('test:event', () => count1++);
    eventBus.on('test:event', () => count2++);
    
    eventBus.clearEvent('test:event');
    eventBus.emit('test:event');
    
    expect(count1).toBe(0);
    expect(count2).toBe(0);
  });

  test('should clear all listeners for all events', () => {
    let count1 = 0;
    let count2 = 0;
    
    eventBus.on('event1', () => count1++);
    eventBus.on('event2', () => count2++);
    
    eventBus.clearAll();
    eventBus.emit('event1');
    eventBus.emit('event2');
    
    expect(count1).toBe(0);
    expect(count2).toBe(0);
  });
});

test.describe('EventBus - One-Time Listeners', () => {
  
  let eventBus;

  test.beforeEach(() => {
    eventBus = new EventBusImpl();
  });

  test('should support once() for one-time listeners', () => {
    let count = 0;
    
    eventBus.once('test:event', () => count++);
    
    eventBus.emit('test:event');
    eventBus.emit('test:event');
    eventBus.emit('test:event');
    
    expect(count).toBe(1); // Only called once
  });

  test('should support multiple once listeners', () => {
    let count1 = 0;
    let count2 = 0;
    
    eventBus.once('test:event', () => count1++);
    eventBus.once('test:event', () => count2++);
    
    eventBus.emit('test:event');
    
    expect(count1).toBe(1);
    expect(count2).toBe(1);
    
    eventBus.emit('test:event');
    
    expect(count1).toBe(1); // Still 1
    expect(count2).toBe(1); // Still 1
  });

  test('should mix regular and once listeners', () => {
    let regularCount = 0;
    let onceCount = 0;
    
    eventBus.on('test:event', () => regularCount++);
    eventBus.once('test:event', () => onceCount++);
    
    eventBus.emit('test:event');
    eventBus.emit('test:event');
    
    expect(regularCount).toBe(2);
    expect(onceCount).toBe(1);
  });
});

test.describe('EventBus - Error Handling', () => {
  
  let eventBus;

  test.beforeEach(() => {
    eventBus = new EventBusImpl();
  });

  test('should continue executing listeners if one throws', () => {
    let count = 0;
    
    eventBus.on('test:event', () => {
      throw new Error('Handler error');
    });
    eventBus.on('test:event', () => count++);
    
    eventBus.emit('test:event');
    
    expect(count).toBe(1); // Second listener still executed
  });

  test('should not add non-function handlers', () => {
    eventBus.on('test:event', 'not a function');
    
    expect(eventBus.listenerCount('test:event')).toBe(0);
  });
});

test.describe('EventBus - Introspection', () => {
  
  let eventBus;

  test.beforeEach(() => {
    eventBus = new EventBusImpl();
  });

  test('should count listeners for an event', () => {
    eventBus.on('test:event', () => {});
    eventBus.on('test:event', () => {});
    eventBus.once('test:event', () => {});
    
    expect(eventBus.listenerCount('test:event')).toBe(3);
  });

  test('should return 0 for events with no listeners', () => {
    expect(eventBus.listenerCount('nonexistent:event')).toBe(0);
  });

  test('should list all registered event names', () => {
    eventBus.on('event1', () => {});
    eventBus.on('event2', () => {});
    eventBus.once('event3', () => {});
    
    const names = eventBus.eventNames();
    
    expect(names).toContain('event1');
    expect(names).toContain('event2');
    expect(names).toContain('event3');
    expect(names.length).toBe(3);
  });

  test('should return empty array when no events registered', () => {
    const names = eventBus.eventNames();
    expect(names).toEqual([]);
  });
});

test.describe('EventBus - Predefined Events', () => {
  
  test('should have standard event constants', () => {
    expect(EVENTS.APP_READY).toBe('app:ready');
    expect(EVENTS.CHARACTER_SELECTED).toBe('character:selected');
    expect(EVENTS.PAGE_CHANGED).toBe('page:changed');
    expect(EVENTS.STATE_CHANGED).toBe('state:changed');
  });

  test('should use predefined events', () => {
    const eventBus = new EventBusImpl();
    let received = false;
    
    eventBus.on(EVENTS.APP_READY, () => {
      received = true;
    });
    
    eventBus.emit(EVENTS.APP_READY);
    
    expect(received).toBe(true);
  });
});
```

### 6.2: Run EventBus Tests

```powershell
npx playwright test tests/unit/EventBus.spec.js
```

**Expected Output:**
```
Running 22 tests using 1 worker
  22 passed (3.5s)
```

**Validation:**
- [ ] All 22 tests pass
- [ ] No test failures or errors
- [ ] Test report shows 100% pass rate

---

## Step 7: Integration Testing

**Objective:** Verify all three utilities work together.

**Time Estimate:** 30 minutes

### 7.1: Run All Unit Tests

```powershell
npx playwright test tests/unit/
```

**Expected Output:**
```
Running 59 tests using 1 worker
  59 passed (5.0s)
```

**Validation:**
- [ ] All 59 tests pass (14 Logger + 23 Result + 22 EventBus)
- [ ] No test failures
- [ ] No errors in test output

### 7.2: Verify Application Launches

```powershell
npm start
```

**Expected Behavior:**
- [ ] Application launches without errors
- [ ] No console errors in DevTools
- [ ] Application functions normally (home page displays)

**Close application after verification.**

### 7.3: Check File Structure

```powershell
tree app/js/infrastructure /F
tree tests/unit /F
```

**Expected Output:**
```
app/js/infrastructure
├── EventBus.js
├── Logger.js
└── Result.js

tests/unit
├── EventBus.spec.js
├── Logger.spec.js
└── Result.spec.js
```

**Validation:**
- [ ] All 3 infrastructure files exist
- [ ] All 3 test files exist
- [ ] No extra files in directories

---

## Step 8: Git Checkpoint

**Objective:** Commit Phase 1 completion.

**Time Estimate:** 5 minutes

### 8.1: Review Changes

```powershell
git status
git diff app/js/infrastructure/
git diff tests/unit/
```

**Validation:**
- [ ] Only infrastructure and test files shown
- [ ] No unintended file modifications
- [ ] Changes look correct

### 8.2: Stage and Commit

```powershell
git add app/js/infrastructure/
git add tests/unit/
git commit -m "feat(infrastructure): add Logger, Result, and EventBus utilities

Phase 1 Complete - Foundation Infrastructure Layer

Files Created:
- app/js/infrastructure/Logger.js - Centralized logging system
- app/js/infrastructure/Result.js - Type-safe error handling
- app/js/infrastructure/EventBus.js - Event communication system
- tests/unit/Logger.spec.js - Logger tests (14 tests)
- tests/unit/Result.spec.js - Result tests (23 tests)
- tests/unit/EventBus.spec.js - EventBus tests (22 tests)

All 59 tests passing.
Application launches successfully.

These utilities will be used throughout all subsequent phases."
```

### 8.3: Push to Remote

```powershell
git push origin refactor
```

**Validation:**
- [ ] Commit created successfully
- [ ] Pushed to remote without errors
- [ ] Commit visible on GitHub

---

## Phase 1 Completion Checklist

### Files Created
- [ ] `app/js/infrastructure/Logger.js` (~220 lines)
- [ ] `app/js/infrastructure/Result.js` (~180 lines)
- [ ] `app/js/infrastructure/EventBus.js` (~200 lines)
- [ ] `tests/unit/Logger.spec.js` (~200 lines, 14 tests)
- [ ] `tests/unit/Result.spec.js` (~220 lines, 23 tests)
- [ ] `tests/unit/EventBus.spec.js` (~240 lines, 22 tests)

### Tests Passing
- [ ] All Logger tests pass (14/14)
- [ ] All Result tests pass (23/23)
- [ ] All EventBus tests pass (22/22)
- [ ] Total: 59/59 tests passing

### Validation
- [ ] No syntax errors in any file
- [ ] Application launches without errors
- [ ] No console errors in DevTools
- [ ] All files follow CODE_STANDARDS.md patterns
- [ ] Git commit created and pushed

### Architecture Compliance
- [ ] Infrastructure layer has no dependencies on app code
- [ ] All files have complete JSDoc documentation
- [ ] All files follow naming conventions
- [ ] All files under 400 lines
- [ ] No circular dependencies

### Ready for Next Phase
- [ ] Phase 1 is 100% complete
- [ ] All checkboxes above are checked
- [ ] README.md in next phase (PHASE_2_IPC.md)

---

## Next Steps

**Phase 1 Complete! ✅**

You have successfully created the foundation infrastructure layer. These utilities will be used throughout all remaining phases.

**Next Phase:** PHASE_2_IPC.md - Main Process Refactoring

```powershell
Get-Content docs/refactoring/PHASE_2_IPC.md
```

---

## Troubleshooting

### Tests Failing

**Problem:** Some tests fail after creating files.

**Solution:**
1. Check file paths match exactly
2. Verify no typos in code
3. Run `npx biome check` on each file
4. Review test output for specific errors
5. Compare your code with the provided code line-by-line

### Application Won't Launch

**Problem:** `npm start` fails or shows errors.

**Solution:**
1. Infrastructure files should NOT break existing functionality
2. Check for syntax errors: `npx biome check app/js/infrastructure/`
3. Check DevTools console for specific errors
4. Revert last commit if needed: `git reset --hard HEAD~1`

### Import Errors

**Problem:** "Cannot find module" errors.

**Solution:**
1. Verify file paths are correct
2. Check file extensions include `.js`
3. Ensure files are saved
4. Check no typos in file names

---

**Phase 1 Duration:** 4-6 hours  
**Phase 1 Status:** Complete when all checkboxes checked  
**Document Version:** 1.0
