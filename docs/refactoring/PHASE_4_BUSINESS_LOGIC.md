# Phase 4: Business Logic Refactoring

**Objective:** Refactor Character.js, CharacterLifecycle.js, and all services.

**Duration:** Weeks 4-6 (20-24 hours)

**Files Created:** 19 files (10 domain/application + 9 service refactors)

**Files Modified:** Character.js, CharacterLifecycle.js, all service files

**Dependencies:** Phases 1-3

---

## Overview

Split large monolithic files:
- Character.js (711 lines) → 5 files (~150 each)
- CharacterLifecycle.js (836 lines) → 5 files (~150 each)
- Refactor 9 service files to use Logger, Result, AppState

---

## Step 1: Create CharacterSchema.js

Create `app/js/domain/CharacterSchema.js`:

```javascript
/**
 * Character data schema and validation.
 * 
 * @module domain/CharacterSchema
 */

import { Logger } from '../infrastructure/Logger.js';

export const CharacterSchema = {
  create() {
    return {
      id: null,
      name: '',
      level: 1,
      
      // Ability scores
      abilityScores: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
      },
      
      // Character details
      class: null,
      subclass: null,
      race: null,
      background: null,
      
      // Proficiencies (stored as arrays)
      proficiencies: {
        armor: [],
        weapons: [],
        tools: [],
        skills: [],
        languages: [],
        savingThrows: []
      },
      
      // Sources
      allowedSources: [], // Array of source book codes
      
      // Equipment
      equipment: [],
      
      // Spells
      spells: [],
      
      // Other
      hitPoints: {
        current: 0,
        max: 0,
        temp: 0
      },
      
      notes: '',
      
      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },
  
  validate(character) {
    const errors = [];
    
    if (!character.id) errors.push('Missing character ID');
    if (!character.name) errors.push('Missing character name');
    if (!Array.isArray(character.allowedSources)) {
      errors.push('allowedSources must be an array');
    }
    
    return { valid: errors.length === 0, errors };
  }
};
```

---

## Step 2: Create Domain Layer Files

Create these files following the pattern:

- `app/js/domain/Character.js` (simplified model)
- `app/js/domain/CharacterSerializer.js` (JSON conversion)
- `app/js/domain/ProficiencyManager.js` (proficiency calculations)
- `app/js/domain/AbilityManager.js` (ability score calculations)

---

## Step 3: Create Application Layer Files

Create these files:

- `app/js/application/CharacterManager.js` (lifecycle management)
- `app/js/application/CharacterLoader.js` (persistence)
- `app/js/application/CharacterImporter.js` (import/export)
- `app/js/application/ChangeTracker.js` (unsaved changes)

**Pattern Example (`CharacterManager.js`):**

```javascript
import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';
import { AppState } from './AppState.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';

class CharacterManagerImpl {
  async createCharacter(name) {
    Logger.info('CharacterManager', 'Creating character', { name });
    
    try {
      const character = CharacterSchema.create();
      character.id = await window.electron.generateUUID();
      character.name = name;
      
      AppState.setCurrentCharacter(character);
      eventBus.emit(EVENTS.CHARACTER_CREATED, character);
      
      return Result.ok(character);
    } catch (error) {
      Logger.error('CharacterManager', 'Create failed', error);
      return Result.err(error.message);
    }
  }
  
  async deleteCharacter(id) {
    Logger.info('CharacterManager', 'Deleting character', { id });
    
    try {
      const result = await window.electron.invoke('character:delete', id);
      
      if (!result.success) {
        return Result.err(result.error);
      }
      
      // Update state
      const characters = AppState.getCharacters().filter(c => c.id !== id);
      AppState.setCharacters(characters);
      
      if (AppState.getCurrentCharacter()?.id === id) {
        AppState.setCurrentCharacter(null);
      }
      
      eventBus.emit(EVENTS.CHARACTER_DELETED, id);
      return Result.ok(true);
    } catch (error) {
      Logger.error('CharacterManager', 'Delete failed', error);
      return Result.err(error.message);
    }
  }
}

export const CharacterManager = new CharacterManagerImpl();
```

---

## Step 4: Refactor Services

Update all 9 service files to use:
- Logger instead of console.log
- Result pattern instead of null returns
- AppState for data storage
- EventBus for data loaded events

**Before:**
```javascript
async loadClasses() {
  try {
    const data = await window.electron.loadJson('classes.json');
    console.log('Loaded classes:', data.length);
    return data;
  } catch (error) {
    console.error('Failed:', error);
    return null;
  }
}
```

**After:**
```javascript
import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';
import { AppState } from '../application/AppState.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';

async loadClasses() {
  Logger.debug('ClassService', 'Loading classes');
  
  try {
    const result = await window.electron.invoke('data:loadJson', 'classes.json');
    
    if (!result.success) {
      return Result.err(result.error);
    }
    
    const classes = result.data;
    Logger.info('ClassService', 'Classes loaded', { count: classes.length });
    
    AppState.setLoadedData('classes', classes);
    eventBus.emit(EVENTS.DATA_LOADED, 'classes', classes);
    
    return Result.ok(classes);
  } catch (error) {
    Logger.error('ClassService', 'Load failed', error);
    return Result.err(error.message);
  }
}
```

---

## Step 5: Update References

Update all files that import:
- `Character` from old location
- `CharacterLifecycle` methods
- Service methods

---

## Step 6: Test & Validate

```powershell
npx playwright test tests/unit/
npm start
```

---

## Step 7: Git Checkpoint

```powershell
git add app/js/domain/ app/js/application/ app/js/services/
git commit -m "refactor(business-logic): split Character and CharacterLifecycle

Phase 4 Complete - Business Logic Refactoring

Domain Layer Created:
- Character.js (simplified)
- CharacterSchema.js
- CharacterSerializer.js  
- ProficiencyManager.js
- AbilityManager.js

Application Layer Created:
- CharacterManager.js
- CharacterLoader.js
- CharacterImporter.js
- ChangeTracker.js

Services Refactored:
- All services now use Logger, Result, AppState
- Consistent error handling
- Event-driven data loading

Files Deleted:
- Old CharacterLifecycle.js (split into new files)"

git push origin refactor
```

---

## Phase 4 Completion Checklist

- [ ] All domain files created
- [ ] All application files created
- [ ] All services refactored
- [ ] Tests passing
- [ ] App functional

**Next:** PHASE_5_PRESENTATION.md