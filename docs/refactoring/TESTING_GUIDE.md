# Testing Guide

**Purpose:** Testing strategies, patterns, and examples for all refactoring phases.

---

## Testing Philosophy

### Test-Driven Refactoring

For this refactoring project:
1. **Write tests BEFORE refactoring**
2. **Run tests AFTER each change**
3. **Never proceed with failing tests**
4. **Commit after passing tests**

### Testing Pyramid

```
        /\
       /E2E\        ← Few (10-15 tests)
      /------\
     /  INT   \     ← Some (20-30 tests)
    /----------\
   /   UNIT     \   ← Many (50+ tests)
  /--------------\
```

- **Unit Tests:** Test individual functions/classes in isolation
- **Integration Tests:** Test multiple components working together
- **E2E Tests:** Test complete user workflows

---

## Test Framework: Playwright

### Why Playwright for Unit Tests?

Playwright is configured for E2E testing but works for all test types:
- Already installed and configured
- Supports ES modules
- Can import renderer process code
- Consistent test runner for all test types

### Running Tests

```powershell
# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/unit/Logger.spec.js

# Run tests with UI
npx playwright test --ui

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests and show report
npx playwright test; npx playwright show-report
```

---

## Unit Testing Patterns

### Infrastructure Layer Tests

**File:** `tests/unit/Logger.spec.js`

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

  test('should filter history by log level', () => {
    Logger.debug('Test', 'Debug');
    Logger.info('Test', 'Info');
    Logger.warn('Test', 'Warn');
    Logger.error('Test', 'Error');
    
    const errorLogs = Logger.getHistory('ERROR');
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0].level).toBe('ERROR');
  });

  test('should respect max history size', () => {
    Logger.maxHistorySize = 3;
    
    Logger.info('Test', 'Message 1');
    Logger.info('Test', 'Message 2');
    Logger.info('Test', 'Message 3');
    Logger.info('Test', 'Message 4');
    
    const history = Logger.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].message).toBe('Message 2');  // First message dropped
  });
});
```

**File:** `tests/unit/Result.spec.js`

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

  test('should map over successful Result', () => {
    const result = Result.ok(5);
    const mapped = result.map(x => x * 2);
    
    expect(mapped.isOk()).toBe(true);
    expect(mapped.value).toBe(10);
  });

  test('should unwrapOr return value for successful Result', () => {
    const result = Result.ok('success');
    expect(result.unwrapOr('default')).toBe('success');
  });
});

test.describe('Result - Error Cases', () => {
  
  test('should create error Result with err()', () => {
    const result = Result.err('Something went wrong');
    
    expect(result.isErr()).toBe(true);
    expect(result.isOk()).toBe(false);
    expect(result.error).toBe('Something went wrong');
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

  test('should handle errors with mapErr()', () => {
    const result = Result.err('Original error');
    const mapped = result.mapErr(e => `Wrapped: ${e}`);
    
    expect(mapped.isErr()).toBe(true);
    expect(mapped.error).toBe('Wrapped: Original error');
  });
});
```

**File:** `tests/unit/EventBus.spec.js`

```javascript
import { test, expect } from '@playwright/test';
import { EventBus, EVENTS } from '../../app/js/infrastructure/EventBus.js';

test.describe('EventBus - Event Emission and Listening', () => {
  
  let eventBus;

  test.beforeEach(() => {
    eventBus = new EventBus();
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

  test('should remove listener with off()', () => {
    let count = 0;
    const listener = () => count++;
    
    eventBus.on('test:event', listener);
    eventBus.emit('test:event');
    expect(count).toBe(1);
    
    eventBus.off('test:event', listener);
    eventBus.emit('test:event');
    expect(count).toBe(1);  // Not called again
  });

  test('should support once() for one-time listeners', () => {
    let count = 0;
    
    eventBus.once('test:event', () => count++);
    
    eventBus.emit('test:event');
    eventBus.emit('test:event');
    eventBus.emit('test:event');
    
    expect(count).toBe(1);  // Only called once
  });

  test('should clear all listeners for an event', () => {
    let count = 0;
    
    eventBus.on('test:event', () => count++);
    eventBus.on('test:event', () => count++);
    
    eventBus.clearEvent('test:event');
    eventBus.emit('test:event');
    
    expect(count).toBe(0);
  });
});
```

---

## Integration Testing Patterns

### Testing IPC Communication

**File:** `tests/integration/ipc-communication.spec.js`

```javascript
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('IPC Communication', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['app/main.js'] });
    window = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('should load JSON data via IPC', async () => {
    const result = await window.evaluate(async () => {
      const data = await window.electron.invoke('file:readJson', 'classes.json');
      return { success: true, count: data.length };
    });

    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });

  test('should get character save path via IPC', async () => {
    const result = await window.evaluate(async () => {
      const path = await window.electron.invoke('settings:getPath', 'characterSavePath');
      return { path, exists: path.length > 0 };
    });

    expect(result.exists).toBe(true);
    expect(result.path).toContain('characters');
  });
});
```

### Testing State Management

**File:** `tests/integration/state-management.spec.js`

```javascript
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('State Management Integration', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['app/main.js'] });
    window = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('should update state and emit events', async () => {
    const result = await window.evaluate(async () => {
      const { AppState } = await import('./js/application/AppState.js');
      const { eventBus, EVENTS } = await import('./js/infrastructure/EventBus.js');
      
      let eventReceived = false;
      eventBus.once(EVENTS.STATE_CHANGED, () => {
        eventReceived = true;
      });
      
      AppState.setState({ testValue: 'test' });
      
      return {
        stateUpdated: AppState.getState().testValue === 'test',
        eventReceived
      };
    });

    expect(result.stateUpdated).toBe(true);
    expect(result.eventReceived).toBe(true);
  });
});
```

---

## E2E Testing Patterns

### Application Startup Tests

**File:** `tests/e2e/app-startup.spec.js`

```javascript
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('Application Startup', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await electron.launch({ args: ['app/main.js'] });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should launch with proper window dimensions', async () => {
    const size = await window.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));

    expect(size.width).toBeGreaterThanOrEqual(1200);
    expect(size.height).toBeGreaterThanOrEqual(800);
  });

  test('should initialize with home page', async () => {
    const pageId = await window.locator('#content-area').getAttribute('data-page');
    expect(pageId).toBe('home');
  });

  test('should have navigation buttons', async () => {
    await expect(window.locator('[data-page-button="home"]')).toBeVisible();
    await expect(window.locator('[data-page-button="build"]')).toBeVisible();
    await expect(window.locator('[data-page-button="equipment"]')).toBeVisible();
  });
});
```

### Character Creation Flow Tests

**File:** `tests/e2e/character-creation.spec.js`

```javascript
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test.describe('Character Creation Flow', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await electron.launch({ args: ['app/main.js'] });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should create new character', async () => {
    // Click create character button
    await window.click('[data-action="create-character"]');
    
    // Wait for modal
    await expect(window.locator('#newCharacterModal')).toBeVisible();
    
    // Fill in character name
    await window.fill('#characterName', 'Test Character');
    
    // Confirm creation
    await window.click('[data-action="confirm-create"]');
    
    // Verify character was created
    await window.waitForTimeout(500);
    const characterName = await window.locator('#current-character-name').textContent();
    expect(characterName).toContain('Test Character');
  });
});
```

---

## Test Organization

### Directory Structure

```
tests/
├── unit/                          # Unit tests (fast, isolated)
│   ├── Logger.spec.js
│   ├── Result.spec.js
│   ├── EventBus.spec.js
│   ├── CharacterSchema.spec.js
│   └── AppState.spec.js
│
├── integration/                   # Integration tests (multiple components)
│   ├── ipc-communication.spec.js
│   ├── state-management.spec.js
│   ├── character-persistence.spec.js
│   └── service-integration.spec.js
│
└── e2e/                          # End-to-end tests (full workflows)
    ├── app-startup.spec.js
    ├── character-creation.spec.js
    ├── navigation.spec.js
    ├── equipment-management.spec.js
    └── settings.spec.js
```

---

## Test Validation Checklist

After writing tests for any component:

- [ ] All tests pass (`npx playwright test`)
- [ ] Tests cover success cases
- [ ] Tests cover error cases
- [ ] Tests cover edge cases
- [ ] Tests are independent (can run in any order)
- [ ] Tests clean up after themselves
- [ ] Test names clearly describe what they test
- [ ] No hardcoded timeouts (use `waitFor` patterns)

---

## Debugging Failed Tests

### View Test Report

```powershell
npx playwright show-report
```

### Run Single Test in Debug Mode

```powershell
$env:PWDEBUG=1; npx playwright test tests/unit/Logger.spec.js
```

### View Test Traces

```powershell
npx playwright test --trace on
npx playwright show-trace trace.zip
```

### Common Issues

**Issue:** Test fails with "Cannot find module"
**Solution:** Check import paths are correct and file exists

**Issue:** Test times out
**Solution:** Add `await window.waitForLoadState()` or increase timeout

**Issue:** Element not found
**Solution:** Add explicit wait: `await window.waitForSelector('#element')`

**Issue:** Inconsistent test results
**Solution:** Add proper cleanup in `afterEach()`, avoid race conditions

---

## Coverage Goals

### Phase 1 (Infrastructure)
- **Target:** 100% coverage
- **Why:** Foundation must be bulletproof

### Phase 2-3 (Core Refactoring)
- **Target:** 80% coverage
- **Why:** Critical business logic

### Phase 4-5 (Features)
- **Target:** 70% coverage
- **Why:** Feature code, some UI hard to test

### Phase 6 (Comprehensive Testing)
- **Target:** 75% overall
- **Why:** Balanced thoroughness and maintenance

---

## Test-Driven Refactoring Workflow

### For Each Phase:

1. **Read phase document completely**
2. **Write failing tests FIRST**
3. **Run tests - they should fail**
4. **Implement feature**
5. **Run tests - they should pass**
6. **Refactor if needed**
7. **Run tests again - still pass**
8. **Git commit**
9. **Move to next step**

**Never skip steps. Never commit failing tests.**
