# Phase 3: State Management - AppState

**Objective:** Create centralized state management with AppState.js.

**Duration:** Week 3 (8-10 hours)

**Files Created:** 2 files

**Files Modified:** All files that currently access state directly

**Dependencies:** Phase 1 (EventBus), Phase 2 (IPC handlers)

---

## Final Architecture Reference

```
app/js/application/
└── AppState.js                    (~300 lines) - Central state management

tests/unit/
└── AppState.spec.js               (~200 lines) - State tests
```

**Phase Outcomes:**
- Single source of truth for all application state
- All state changes emit events via EventBus
- No direct state mutation anywhere in codebase
- Predictable state updates

---

## Current State Problems

**Scattered State:**
- `CharacterLifecycle.js` - stores currentCharacter
- `Navigation.js` - stores currentPage
- Various services - cache data
- No coordination between components

**Solution:**
- AppState.js manages ALL application state
- Components read from AppState
- Components update via AppState.setState()
- EventBus emits state change events

---

## Step 1: Create AppState.js

Create `app/js/application/AppState.js`:

```javascript
/**
 * Central application state management.
 * 
 * ARCHITECTURE: Application Layer - Depends on Infrastructure
 * 
 * PURPOSE:
 * - Single source of truth for all app state
 * - Emit events on state changes
 * - Prevent direct state mutation
 * - Make state changes predictable
 * 
 * @module application/AppState
 */

import { Logger } from '../infrastructure/Logger.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';

class AppStateImpl {
  constructor() {
    this.state = {
      // Application
      isLoading: false,
      currentPage: 'home',
      
      // Character
      currentCharacter: null,
      characters: [],
      hasUnsavedChanges: false,
      
      // UI
      activeModal: null,
      notifications: [],
      
      // Settings
      settings: {
        characterSavePath: null,
        autoSave: true,
        logLevel: 'INFO'
      },
      
      // Data
      loadedData: {
        classes: null,
        races: null,
        backgrounds: null,
        spells: null,
        equipment: null,
        feats: null
      }
    };
    
    Logger.info('AppState', 'State initialized', this.state);
  }

  /**
   * Get entire state (readonly).
   * @returns {object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get specific state value.
   * @param {string} key - State key (supports dot notation)
   * @returns {*} State value
   */
  get(key) {
    const keys = key.split('.');
    let value = this.state;
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    Logger.debug('AppState', `Get: ${key}`, value);
    return value;
  }

  /**
   * Update state and emit events.
   * @param {object} updates - State updates
   */
  setState(updates) {
    Logger.debug('AppState', 'setState called', updates);
    
    const oldState = { ...this.state };
    
    // Merge updates
    this.state = {
      ...this.state,
      ...updates
    };
    
    // Emit global state changed event
    eventBus.emit(EVENTS.STATE_CHANGED, this.state, oldState);
    
    // Emit specific events for key changes
    Object.keys(updates).forEach(key => {
      if (oldState[key] !== updates[key]) {
        const eventName = `state:${key}:changed`;
        eventBus.emit(eventName, updates[key], oldState[key]);
        Logger.debug('AppState', `Emitted: ${eventName}`);
      }
    });
    
    Logger.info('AppState', 'State updated', { updates });
  }

  /**
   * Set current character.
   * @param {object|null} character - Character object or null
   */
  setCurrentCharacter(character) {
    Logger.info('AppState', 'Setting current character', { id: character?.id });
    this.setState({ currentCharacter: character });
    eventBus.emit(EVENTS.CHARACTER_SELECTED, character);
  }

  /**
   * Get current character.
   * @returns {object|null} Current character
   */
  getCurrentCharacter() {
    return this.state.currentCharacter;
  }

  /**
   * Mark character as having unsaved changes.
   * @param {boolean} hasChanges - Whether there are unsaved changes
   */
  setHasUnsavedChanges(hasChanges) {
    if (this.state.hasUnsavedChanges !== hasChanges) {
      Logger.info('AppState', 'Unsaved changes:', hasChanges);
      this.setState({ hasUnsavedChanges: hasChanges });
    }
  }

  /**
   * Set current page.
   * @param {string} page - Page identifier
   */
  setCurrentPage(page) {
    Logger.info('AppState', 'Setting current page:', page);
    this.setState({ currentPage: page });
    eventBus.emit(EVENTS.PAGE_CHANGED, page);
  }

  /**
   * Get current page.
   * @returns {string} Current page
   */
  getCurrentPage() {
    return this.state.currentPage;
  }

  /**
   * Set loading state.
   * @param {boolean} loading - Whether app is loading
   */
  setLoading(loading) {
    this.setState({ isLoading: loading });
  }

  /**
   * Set characters list.
   * @param {Array} characters - Array of characters
   */
  setCharacters(characters) {
    Logger.info('AppState', 'Setting characters list', { count: characters.length });
    this.setState({ characters });
  }

  /**
   * Get characters list.
   * @returns {Array} Characters array
   */
  getCharacters() {
    return this.state.characters;
  }

  /**
   * Set loaded data for a specific type.
   * @param {string} dataType - Type of data (classes, races, etc.)
   * @param {*} data - The data to store
   */
  setLoadedData(dataType, data) {
    Logger.info('AppState', `Setting loaded data: ${dataType}`);
    this.setState({
      loadedData: {
        ...this.state.loadedData,
        [dataType]: data
      }
    });
    eventBus.emit(EVENTS.DATA_LOADED, dataType, data);
  }

  /**
   * Get loaded data for a specific type.
   * @param {string} dataType - Type of data
   * @returns {*} The loaded data or null
   */
  getLoadedData(dataType) {
    return this.state.loadedData[dataType];
  }

  /**
   * Clear all state (reset to initial).
   */
  clear() {
    Logger.warn('AppState', 'Clearing all state');
    const initialState = new AppStateImpl().state;
    this.state = initialState;
    eventBus.emit(EVENTS.STATE_CHANGED, this.state, {});
  }
}

// Export singleton instance
export const AppState = new AppStateImpl();
```

---

## Step 2: Test AppState.js

Create `tests/unit/AppState.spec.js`:

```javascript
import { test, expect } from '@playwright/test';
import { AppState } from '../../app/js/application/AppState.js';
import { eventBus, EVENTS } from '../../app/js/infrastructure/EventBus.js';

test.describe('AppState - Basic Operations', () => {
  
  test.beforeEach(() => {
    AppState.clear();
    eventBus.clearAll();
  });

  test('should get entire state', () => {
    const state = AppState.getState();
    
    expect(state).toHaveProperty('currentCharacter');
    expect(state).toHaveProperty('currentPage');
    expect(state).toHaveProperty('isLoading');
  });

  test('should update state with setState', () => {
    AppState.setState({ currentPage: 'build' });
    
    expect(AppState.get('currentPage')).toBe('build');
  });

  test('should emit state changed event', () => {
    let eventEmitted = false;
    
    eventBus.once(EVENTS.STATE_CHANGED, () => {
      eventEmitted = true;
    });
    
    AppState.setState({ currentPage: 'equipment' });
    
    expect(eventEmitted).toBe(true);
  });

  test('should get nested state values', () => {
    AppState.setState({
      settings: { autoSave: false }
    });
    
    expect(AppState.get('settings.autoSave')).toBe(false);
  });
});

test.describe('AppState - Character Management', () => {
  
  test.beforeEach(() => {
    AppState.clear();
    eventBus.clearAll();
  });

  test('should set and get current character', () => {
    const character = { id: '123', name: 'Test' };
    
    AppState.setCurrentCharacter(character);
    
    expect(AppState.getCurrentCharacter()).toEqual(character);
  });

  test('should emit character selected event', () => {
    let selectedCharacter = null;
    
    eventBus.once(EVENTS.CHARACTER_SELECTED, (char) => {
      selectedCharacter = char;
    });
    
    const character = { id: '123', name: 'Test' };
    AppState.setCurrentCharacter(character);
    
    expect(selectedCharacter).toEqual(character);
  });

  test('should track unsaved changes', () => {
    AppState.setHasUnsavedChanges(true);
    expect(AppState.get('hasUnsavedChanges')).toBe(true);
    
    AppState.setHasUnsavedChanges(false);
    expect(AppState.get('hasUnsavedChanges')).toBe(false);
  });
});

test.describe('AppState - Page Navigation', () => {
  
  test.beforeEach(() => {
    AppState.clear();
    eventBus.clearAll();
  });

  test('should set and get current page', () => {
    AppState.setCurrentPage('equipment');
    expect(AppState.getCurrentPage()).toBe('equipment');
  });

  test('should emit page changed event', () => {
    let newPage = null;
    
    eventBus.once(EVENTS.PAGE_CHANGED, (page) => {
      newPage = page;
    });
    
    AppState.setCurrentPage('details');
    
    expect(newPage).toBe('details');
  });
});

test.describe('AppState - Data Management', () => {
  
  test.beforeEach(() => {
    AppState.clear();
    eventBus.clearAll();
  });

  test('should set and get loaded data', () => {
    const classes = [{ name: 'Fighter' }];
    
    AppState.setLoadedData('classes', classes);
    
    expect(AppState.getLoadedData('classes')).toEqual(classes);
  });

  test('should emit data loaded event', () => {
    let loadedType = null;
    let loadedData = null;
    
    eventBus.once(EVENTS.DATA_LOADED, (type, data) => {
      loadedType = type;
      loadedData = data;
    });
    
    const races = [{ name: 'Elf' }];
    AppState.setLoadedData('races', races);
    
    expect(loadedType).toBe('races');
    expect(loadedData).toEqual(races);
  });
});
```

---

## Step 3: Migration Guide

Update these files to use AppState:

### Files to Update:
1. `app/js/core/CharacterLifecycle.js` - Replace state storage
2. `app/js/core/Navigation.js` - Replace page tracking
3. `app/js/services/*.js` - Use AppState for data storage
4. `app/js/core/AppInitializer.js` - Initialize AppState

### Migration Pattern:

**Before:**
```javascript
class CharacterLifecycle {
  constructor() {
    this.currentCharacter = null;
  }
  
  selectCharacter(character) {
    this.currentCharacter = character;
  }
}
```

**After:**
```javascript
import { AppState } from '../application/AppState.js';

class CharacterLifecycle {
  selectCharacter(character) {
    AppState.setCurrentCharacter(character);
  }
  
  getCurrentCharacter() {
    return AppState.getCurrentCharacter();
  }
}
```

---

## Step 4: Run Tests

```powershell
npx playwright test tests/unit/AppState.spec.js
npm start  # Verify app still works
```

---

## Step 5: Git Checkpoint

```powershell
git add app/js/application/ tests/unit/AppState.spec.js
git commit -m "feat(state): add centralized AppState management

Phase 3 Complete - State Management

Files Created:
- app/js/application/AppState.js
- tests/unit/AppState.spec.js

All state now centralized with event-driven updates."

git push origin refactor
```

---

## Phase 3 Completion Checklist

- [ ] AppState.js created and tested
- [ ] All tests passing
- [ ] Migration guide reviewed
- [ ] Git commit created

**Next:** PHASE_4_BUSINESS_LOGIC.md