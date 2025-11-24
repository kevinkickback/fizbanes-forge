# Fizbanes Forge - Test Suite Organization

## Test Organization

### Unit Tests (5 files, ~52 tests)
These test core infrastructure and utilities that everything depends on:

- **AppState.spec.js** - State management, event emission, data storage
- **EventBus.spec.js** - Event system and pub/sub functionality  
- **Logger.spec.js** - Logging levels, message formatting, history
- **Result.spec.js** - Result wrapper for error handling
- **Migration.spec.js** - Character data migrations

### E2E Tests (2 files, ~16 tests)
These test major app workflows and functionality:

#### app.spec.js
Focus: Core app functionality, data loading, navigation
- **App startup**: Launches correctly, loads home page
- **Navigation**: UI has navigation buttons, pages can be switched
- **Data loading**: Races, classes, backgrounds load from JSON files without errors
- **Settings**: Settings page accessible
- **Error handling**: No critical console errors

#### character-workflow.spec.js
Focus: Character CRUD operations and persistence
- **Character creation**: New character workflow
- **Character list**: Home page displays character list
- **Character persistence**: Save/load operations through IPC
- **Build page**: Accessible and loads with/without character
- **Navigation state**: Buttons enable/disable based on character selection
- **Error recovery**: App handles missing data gracefully

## Test Coverage Areas

### ✅ Data Loading
- JSON files (races, classes, backgrounds, etc.) load correctly
- Data validation and error handling
- Caching and performance

### ✅ Navigation  
- All pages accessible
- Page transitions work
- UI state updates correctly

### ✅ Character Management
- Character creation
- Character loading from storage
- Character saving
- Character deletion
- IPC communication for file operations

### ✅ Settings
- Settings page loads
- Save path configuration
- Preferences persistence

### ✅ Core Infrastructure
- State management (AppState)
- Event system (EventBus)
- Logging system
- Result/Error handling

## Test Statistics
- **Total Tests**: ~104
- **Unit Tests**: ~52
- **E2E Tests**: ~16
- **Pass Rate**: 100%

## Running Tests

```bash
# Run all tests
npx playwright test

# Run only unit tests
npx playwright test tests/unit

# Run only e2e tests
npx playwright test tests/e2e

# Run specific test file
npx playwright test tests/e2e/app.spec.js

# Run with debug mode
npx playwright test --debug
```

## Test Philosophy

Tests focus on **functionality** rather than implementation details:
- Does data load correctly?
- Can users navigate?
- Can users create/save/load characters?
- Does the app handle errors?
- Are settings persistent?

Tests avoid:
- Testing internal state mutations in isolation
- Testing implementation details of components
- Brittle DOM selectors and timing issues
- Tests that replicate each other

## Future Test Additions

Tests should be added for:
- Character data validation edge cases
- Complex character workflows (multi-page)
- Concurrent operations
- Import/export functionality
- Data integrity after updates
