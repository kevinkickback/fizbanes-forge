# Fizbane's Forge Code Audit Results

**Audit Date:** January 21, 2026  
**Scope:** Full source tree (`src/app`, `src/lib`, `src/services`, `src/main`, `src/shared`)

---

## 1. Executive Summary

### Overall Health: **Good with Minor Issues**

**Strengths:**
- Clean separation between Electron main process and renderer
- Consistent service layer pattern via `BaseDataService`
- Well-defined EventBus with typed event constants
- DOMCleanup utility properly manages listeners
- Immutability guidance documented in architecture

**Major Risks:**
- State mutation patterns not enforced (documentation only)
- EventBus listeners not auto-tracked (manual cleanup required)
- Some services bypass `BaseDataService` pattern
- Circular initialization dependencies possible during startup

---

## 2. Files Reviewed

### Core Application (`src/app/`)
- [AppInitializer.js](../src/app/AppInitializer.js) (673 lines)
- [AppState.js](../src/app/AppState.js) (156 lines)
- [Character.js](../src/app/Character.js) (836 lines)
- [CharacterManager.js](../src/app/CharacterManager.js) (250 lines)
- [NavigationController.js](../src/app/NavigationController.js) (663 lines)
- [PageHandler.js](../src/app/PageHandler.js) (953 lines)
- [Proficiency.js](../src/app/Proficiency.js) (529 lines)
- [Modal.js](../src/app/Modal.js) (306 lines)
- [ThemeManager.js](../src/app/ThemeManager.js) (75 lines)
- [TitlebarController.js](../src/app/TitlebarController.js) (108 lines)
- [UIHandlersInitializer.js](../src/app/UIHandlersInitializer.js) (174 lines)

### Library (`src/lib/`)
- [EventBus.js](../src/lib/EventBus.js) (230 lines)
- [DataLoader.js](../src/lib/DataLoader.js) (428 lines)
- [DOMCleanup.js](../src/lib/DOMCleanup.js) (165 lines)
- [DataNormalizer.js](../src/lib/DataNormalizer.js) (21 lines)
- [TextProcessor.js](../src/lib/TextProcessor.js) (302 lines)

### Services (`src/services/`)
- [BaseDataService.js](../src/services/BaseDataService.js) (167 lines)
- [SpellService.js](../src/services/SpellService.js) (125 lines)
- [ClassService.js](../src/services/ClassService.js) (373 lines)
- [LevelUpService.js](../src/services/LevelUpService.js) (566 lines)
- [FeatService.js](../src/services/FeatService.js) (280 lines)
- [RaceService.js](../src/services/RaceService.js) (307 lines)
- [ItemService.js](../src/services/ItemService.js) (122 lines)
- [EquipmentService.js](../src/services/EquipmentService.js) (404 lines)
- [SpellSelectionService.js](../src/services/SpellSelectionService.js) (443 lines)
- [BackgroundService.js](../src/services/BackgroundService.js) (262 lines)
- [SettingsService.js](../src/services/SettingsService.js) (323 lines)
- [SourceService.js](../src/services/SourceService.js) (382 lines)

### Main Process (`src/main/`)
- [Main.js](../src/main/Main.js) (100 lines)
- [Preload.cjs](../src/main/Preload.cjs) (95 lines)
- [ipc/DataHandlers.js](../src/main/ipc/DataHandlers.js) (496 lines)
- [ipc/CharacterHandlers.js](../src/main/ipc/CharacterHandlers.js) (280 lines)

### Shared (`src/shared/`)
- [CharacterSchema.js](../src/shared/CharacterSchema.js) (178 lines)

---

## 3. Code Quality Findings

### 3.1 State Management

#### Finding: AppState Mutation Not Enforced
**Files:** [AppState.js](../src/app/AppState.js), [Character.js](../src/app/Character.js)  
**Severity:** Medium

**Observed Behavior:**
- `AppState` documents immutability requirements but doesn't enforce them
- `getState()` returns a shallow copy, but nested objects remain mutable
- `getCurrentCharacter()` returns direct reference to character object

```javascript
// AppState.js:54
getCurrentCharacter() {
    return this.state.currentCharacter;  // Direct reference, mutable
}
```

**Risk:** Consumers can mutate `currentCharacter` directly, bypassing change detection.

**Recommendation:** Return deep-frozen copies or use getter proxies for critical state.

---

### 3.2 EventBus Listener Management

#### Finding: EventBus Listeners Require Manual Cleanup
**Files:** [EventBus.js](../src/lib/EventBus.js), [TitlebarController.js](../src/app/TitlebarController.js)  
**Severity:** Medium

**Observed Behavior:**
- `TitlebarController.setupEventListeners()` registers 5 EventBus listeners
- No cleanup mechanism exists in `TitlebarController`
- If controller is re-instantiated, duplicate listeners accumulate

```javascript
// TitlebarController.js:17-45
setupEventListeners() {
    eventBus.on(EVENTS.CHARACTER_SELECTED, () => { ... });
    eventBus.on(EVENTS.CHARACTER_UPDATED, () => { ... });
    eventBus.on(EVENTS.CHARACTER_SAVED, () => { ... });
    eventBus.on(EVENTS.PAGE_CHANGED, () => { ... });
    eventBus.on('state:hasUnsavedChanges:changed', () => { ... });
    // No references stored, no cleanup
}
```

**Risk:** Memory leaks and duplicate event handling on hot reload.

**Recommendation:** Store handler references and provide `destroy()` method.

---

### 3.3 Service Initialization Inconsistency

#### Finding: Not All Services Extend BaseDataService
**Files:** [FeatService.js](../src/services/FeatService.js), [BackgroundService.js](../src/services/BackgroundService.js)  
**Severity:** Low

**Observed Behavior:**
- `FeatService` and `BackgroundService` do not extend `BaseDataService`
- They implement their own initialization and caching logic
- Pattern divergence reduces maintainability

```javascript
// FeatService.js:5-8
class FeatService {
    constructor() {
        this._featData = null;
        this._featMap = null;
    }
    // Does not use initWithLoader() pattern
}
```

**Recommendation:** Migrate to `BaseDataService` for consistency.

---

### 3.4 Character.js Complexity

#### Finding: Character Class Has Too Many Responsibilities  
**File:** [Character.js](../src/app/Character.js) (836 lines)  
**Severity:** Medium

**Observed Behavior:**
- Handles ability scores, proficiencies, feats, inventory, spellcasting, progression
- Contains serialization logic (`toJSON`, `_serializeComplexProficiency`)
- Mixes domain logic with data transformation

**Multi-responsibility examples:**
- `addAbilityBonus()` - domain logic
- `toJSON()` - serialization (180+ lines)
- `clearRacialBenefits()` - orchestration across multiple subsystems

**Recommendation:** Extract serialization to separate module; consider splitting proficiency/spell/inventory into composition classes.

---

## 4. Function-Level Observations

### 4.1 AppInitializer.initializeAll()
**File:** [AppInitializer.js#L391-L673](../src/app/AppInitializer.js)

| Aspect | Observation |
|--------|-------------|
| **Behavior** | Orchestrates full app startup: theme, data validation, service loading, component init, UI handlers |
| **Inputs** | `_options` (unused) |
| **Outputs** | `{ success, loadedComponents, errors }` |
| **Side Effects** | Mutates `_isInitialized`, `_isInitializing`, DOM, AppState |
| **Hidden Dependencies** | `window.app`, `window.bootstrap`, `DataLoader`, 13 services |
| **Ordering Assumptions** | Theme before modal cleanup; data before components; components before UI handlers |

**Fragility:** Function is 280+ lines with nested try/catch. Error in one phase doesn't cleanly abort others.

---

### 4.2 CharacterManager.updateCharacter()
**File:** [CharacterManager.js#L197-L219](../src/app/CharacterManager.js)

| Aspect | Observation |
|--------|-------------|
| **Behavior** | Merges updates into current character, creates new instance, emits event |
| **Inputs** | `updates` object with partial character data |
| **Side Effects** | Mutates AppState, emits `CHARACTER_UPDATED` |

```javascript
updateCharacter(updates) {
    const character = AppState.getCurrentCharacter();
    const baseData = serializeCharacter(character);
    const mergedData = { ...baseData, ...updates };
    const updatedCharacter = new Character(mergedData);
    // ...
}
```

**Issue:** Shallow merge - nested object updates require full object replacement by caller.

---

### 4.3 LevelUpService.checkMulticlassRequirements()
**File:** [LevelUpService.js#L355-L413](../src/services/LevelUpService.js)

| Aspect | Observation |
|--------|-------------|
| **Behavior** | Validates character meets ability score requirements for multiclassing |
| **Inputs** | `character`, `className` |
| **Outputs** | `boolean` |
| **Hidden Dependencies** | `classService.getClass()` |

**Good pattern:** Handles both AND and OR requirement structures from 5etools data.

---

### 4.4 ProficiencyCore.addProficiency()
**File:** [Proficiency.js#L12-L54](../src/app/Proficiency.js)

| Aspect | Observation |
|--------|-------------|
| **Behavior** | Adds proficiency with source tracking, handles duplicates |
| **Side Effects** | Mutates character object directly, emits event, may trigger refund |

**Concern:** Directly mutates `character.proficiencies` and `character.proficiencySources` - doesn't go through AppState.

---

### 4.5 DataLoader.loadJSON()
**File:** [DataLoader.js#L88-L147](../src/lib/DataLoader.js)

| Aspect | Observation |
|--------|-------------|
| **Behavior** | Loads JSON via IPC with multi-layer caching (memory + localStorage) |
| **Caching** | TTL-based with version invalidation |
| **Error Handling** | Cleans up loading state on failure |

**Good pattern:** Deduplicates concurrent requests via `state.loading[url]` promise tracking.

---

## 5. Refactoring Opportunities

### 5.1 Extract Character Serialization
**File:** [Character.js](../src/app/Character.js)  
**Effort:** Medium  
**Risk:** Low

**Current:** `toJSON()` is 180+ lines embedded in Character class.

**Proposed:** Create `CharacterSerializer.js` with:
- `serialize(character)` 
- `deserialize(data)`
- Helper methods for complex fields

**Tradeoff:** Adds one file but significantly improves Character.js readability.

---

### 5.2 Standardize Service Base Class Usage
**Files:** `FeatService.js`, `BackgroundService.js`, `SourceService.js`  
**Effort:** Low  
**Risk:** Low

**Current:** These services implement their own caching/init patterns.

**Proposed:** Extend `BaseDataService` and use `initWithLoader()`.

**Tradeoff:** Minor refactor, improves consistency and reduces duplicate code.

---

### 5.3 Add EventBus Listener Tracking to DOMCleanup
**Files:** [DOMCleanup.js](../src/lib/DOMCleanup.js), [EventBus.js](../src/lib/EventBus.js)  
**Effort:** Low  
**Risk:** Low

**Current:** DOMCleanup tracks DOM listeners but not EventBus listeners.

**Proposed:** Add `onEvent(event, handler)` and `offEvent()` methods to DOMCleanup that wrap EventBus registration.

```javascript
// Proposed addition to DOMCleanup
onEvent(event, handler) {
    eventBus.on(event, handler);
    this._eventListeners.push({ event, handler });
}
```

**Tradeoff:** Small API addition, prevents common memory leak pattern.

---

### 5.4 Split PageHandler by Page Type
**File:** [PageHandler.js](../src/app/PageHandler.js) (953 lines)  
**Effort:** High  
**Risk:** Medium

**Current:** Single file handles all page initializations with large switch statement.

**Proposed:** Create page-specific handlers:
- `HomePageHandler.js`
- `BuildPageHandler.js`
- `SettingsPageHandler.js`
- etc.

**Tradeoff:** More files but better separation of concerns. Risk of breaking page transitions during refactor.

---

## 6. Risk Assessment

### Critical Risks
None identified.

### High Risks
| Risk | Location | Mitigation |
|------|----------|------------|
| State mutation bypassing events | AppState consumers | Document pattern; consider freezing returned objects |

### Medium Risks
| Risk | Location | Mitigation |
|------|----------|------------|
| EventBus listener leaks | TitlebarController, ThemeManager | Add cleanup methods; extend DOMCleanup |
| Character.js complexity | Character class | Extract serialization; split concerns |
| Service init ordering | AppInitializer | Document dependencies; add health checks |

### Low Risks
| Risk | Location | Mitigation |
|------|----------|------------|
| Inconsistent service patterns | FeatService, BackgroundService | Migrate to BaseDataService |
| DataNormalizer too simple | DataNormalizer.js | Acceptable - YAGNI principle |

---

## 7. Positive Patterns Observed

1. **IPC Boundary Enforcement** - Preload.cjs properly whitelists channels; renderer never accesses fs directly.

2. **BaseDataService Pattern** - Services that use it get consistent caching, error handling, and event emission.

3. **DOMCleanup Utility** - Properly manages DOM listeners and Bootstrap modal lifecycle.

4. **Typed Event Constants** - EVENTS object in EventBus prevents typo-based bugs.

5. **Atomic File Writes** - CharacterHandlers uses temp file + rename for safe saves.

6. **Loading State Deduplication** - DataLoader prevents concurrent duplicate requests.

7. **Schema Validation** - CharacterSchema validates before save/load operations.

---

## 8. Items Not Audited (Out of Scope)

- UI components (`src/ui/components/`) - Not reviewed in detail
- CSS/styling files
- Test coverage analysis
- Performance profiling
- Security audit of IPC channels

---

## Audit Completion Status

**Status:** Complete for scoped files  
**Reviewer confidence:** High for core app/lib/services; Medium for main process (less time spent)

---

*End of Audit Report*
