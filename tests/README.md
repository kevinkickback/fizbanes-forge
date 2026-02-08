# Fizbane's Forge Test Suite

This directory contains both unit tests and end-to-end (E2E) tests for Fizbane's Forge.

## Test Structure

```
tests/
├── unit/                    # Unit tests (Vitest)
│   ├── EventBus.test.js
│   ├── DOMCleanup.test.js
│   ├── Character.test.js
│   ├── CharacterSerializer.test.js
│   └── 5eToolsParser.test.js
├── fixtures.js              # Playwright fixtures for E2E tests
└── !boilerplate.spec.js     # E2E test boilerplate
```

## Unit Tests

Unit tests focus on testing individual components, classes, and utilities in isolation. They use **Vitest** as the test runner.

### Running Unit Tests

```bash
# Run all unit tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI interface
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

The unit test suite currently covers:

- **EventBus** - Event system for cross-component communication
  - Event emission and handling
  - Once-only handlers
  - Event history tracking
  - Error handling
  - Listener management

- **DOMCleanup** - Memory management for DOM listeners and timers
  - Event listener tracking and cleanup
  - Timer management (setTimeout/setInterval)
  - Modal instance management
  - Proper cleanup behavior

- **Character** - Core character model
  - Constructor and initialization
  - Ability score management
  - Proficiency tracking
  - Feature management (traits, resistances)
  - Feats and sources
  - Allowed sources
  - Inventory and spellcasting

- **CharacterSerializer** - Serialization/deserialization
  - Round-trip serialization
  - Collection type conversions (Set ↔ Array, Map ↔ Object)
  - JSON compatibility
  - Edge cases and error handling

- **5eToolsParser** - D&D 5e data parsing utilities
  - HTML escaping
  - Ability score modifiers
  - Size abbreviations
  - Spell schools
  - Formatting functions

## E2E Tests

End-to-end tests use **Playwright** to test the full application workflow, including Electron main process and renderer interactions.

### Running E2E Tests

```bash
# Run E2E tests in headless mode
npm run test:e2e

# Run specific E2E test in headed mode (visible browser)
npx playwright test tests/your-test.spec.js --headed
```

### E2E Test Structure

E2E tests follow this pattern:

```javascript
import { _electron as electron } from '@playwright/test';
import { test } from './fixtures.js';

test('should perform action', async () => {
    test.setTimeout(60000);
    
    // Configuration is loaded from .env file automatically
    const electronApp = await electron.launch({
        args: ['.'],
    });
    
    const page = electronApp.windows()[0];
    await page.waitForLoadState('domcontentloaded');
    
    // Test interactions...
    
    await electronApp.close();
});
```

## Writing New Tests

### Unit Test Guidelines

1. **Test Isolation**: Each test should be independent
2. **Use beforeEach**: Reset state before each test
3. **Descriptive Names**: Use clear, action-oriented test names
4. **Arrange-Act-Assert**: Structure tests in three clear phases
5. **Mock External Dependencies**: Use `vi.fn()` for mocks
6. **Test Edge Cases**: Include boundary conditions and error cases

Example:
```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('MyComponent', () => {
    let component;

    beforeEach(() => {
        component = new MyComponent();
    });

    it('should initialize with default values', () => {
        expect(component.value).toBe(0);
    });

    it('should handle edge case', () => {
        expect(() => component.process(null)).not.toThrow();
    });
});
```

### E2E Test Guidelines

1. **Use Fixtures**: Import from `./fixtures.js` for console capture
2. **Set Timeouts**: Allow sufficient time for Electron startup
3. **Wait for Elements**: Use `waitForSelector()` over `waitForTimeout()`
4. **Clean Up**: Always close the app in a finally block
5. **Environment Variables**: Tests use `.env` file for configuration
   - Set `FF_DEBUG=true` for debug logging and cache bypass
   - Set `FF_USE_BUNDLED_DATA=true` to use `/src/data` instead of configured sources

## Test Configuration

- **Vitest Config**: `vitest.config.js` - Unit test configuration
- **Playwright Config**: `playwright.config.js` - E2E test configuration

## Coverage

Coverage reports are generated in the `coverage/` directory when running:

```bash
npm run test:coverage
```

View the HTML report by opening `coverage/index.html` in a browser.

## CI/CD Integration

Tests can be run in CI/CD pipelines:

```yaml
# Example GitHub Actions snippet
- name: Run unit tests
  run: npm test

- name: Run E2E tests
  run: npm run test:e2e
```

## Debugging Tests

### Debugging Unit Tests

```bash
# Run specific test file
npx vitest run tests/unit/EventBus.test.js

# Run tests matching a pattern
npx vitest run --grep "should emit and receive events"

# Use UI mode for interactive debugging
npm run test:ui
```

### Debugging E2E Tests

```bash
# Run in headed mode to see browser
npx playwright test tests/your-test.spec.js --headed

# Use debug mode
npx playwright test tests/your-test.spec.js --debug

# Generate trace for debugging
npx playwright test --trace on
```

## Best Practices

1. **Keep Tests Fast**: Unit tests should complete in milliseconds
2. **Test Behavior, Not Implementation**: Focus on what, not how
3. **One Assertion Per Test**: When possible, test one concept per test
4. **Clear Test Names**: The test name should describe the expected behavior
5. **Avoid Test Interdependence**: Tests should not rely on execution order
6. **Use Meaningful Test Data**: Avoid generic "foo" and "bar" values
7. **Test Error Paths**: Don't just test the happy path

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
