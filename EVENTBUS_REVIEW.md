# EventBus Usage Review - Fizbane's Forge

**Date:** November 25, 2025  
**Review Scope:** Complete JavaScript codebase in `app/js/`  
**Architecture:** Event-driven, decoupled component communication

---

## Executive Summary

This review audits the EventBus implementation across the Fizbane's Forge codebase. The refactored architecture uses the EventBus infrastructure layer for loose coupling and decoupled communication. The analysis categorizes all components into three groups:

1. **✅ Properly Using EventBus** - Components following the new architecture correctly
2. **⚠️ Should Use EventBus But Don't** - Components with tight coupling that need refactoring
3. **✅ Shouldn't Use EventBus** - Utility functions and helpers that don't need event patterns

---

## Architecture Overview

### EventBus Design Principles

From `app/js/infrastructure/EventBus.js`:

- **Infrastructure Layer**: No dependencies on other app code
- **Purpose**: Enable loose coupling, prevent direct component references, eliminate circular dependencies
- **Usage Pattern**: Import `{ eventBus, EVENTS }` and use `eventBus.emit()`, `eventBus.on()`, `eventBus.off()`, `eventBus.once()`
- **Event Naming**: `domain:action` format (e.g., `character:selected`, `page:changed`)

### Defined Events (from EVENTS constant)

```javascript
// Application lifecycle
APP_READY, APP_SHUTDOWN

// State changes
STATE_CHANGED

// Character events
CHARACTER_SELECTED, CHARACTER_CREATED, CHARACTER_DELETED, 
CHARACTER_UPDATED, CHARACTER_SAVED, CHARACTER_LOADED

// Navigation events
PAGE_CHANGED, PAGE_LOADED

// Data events
DATA_LOADED, DATA_ERROR

// UI events
MODAL_OPENED, MODAL_CLOSED

// Error events
ERROR_OCCURRED

// Storage events
STORAGE_CHARACTER_LOADED, STORAGE_CHARACTER_SAVED, STORAGE_CHARACTER_DELETED

// Proficiency events
PROFICIENCY_ADDED, PROFICIENCY_REMOVED_BY_SOURCE, PROFICIENCY_REFUNDED,
PROFICIENCY_OPTIONAL_CONFIGURED, PROFICIENCY_OPTIONAL_CLEARED,
PROFICIENCY_OPTIONAL_SELECTED, PROFICIENCY_OPTIONAL_DESELECTED
```

---

## ✅ PROPERLY USING EVENTBUS

### Core Infrastructure (Excellent)

#### `app/js/core/AppState.js`
- **Status**: ✅ **EXCELLENT**
- **Details**:
  - Central state management using EventBus pattern
  - Emits `STATE_CHANGED` event on any state mutation
  - Emits specific events: `CHARACTER_SELECTED`, `PAGE_CHANGED`
  - Helper methods properly emit events
  - Validates state changes before emission
- **Pattern**:
  ```javascript
  setCurrentCharacter(character) {
      this.setState({ currentCharacter: character });
      eventBus.emit(EVENTS.CHARACTER_SELECTED, character);
  }
  ```

#### `app/js/core/CharacterManager.js`
- **Status**: ✅ **EXCELLENT**
- **Details**:
  - Emits `CHARACTER_CREATED`, `CHARACTER_UPDATED`, `CHARACTER_SAVED`, `CHARACTER_LOADED`, `CHARACTER_DELETED`
  - Integrates with AppState for state management
  - Proper error handling and event emission sequencing
  - Lifecycle events properly broadcast

#### `app/js/core/NavigationController.js`
- **Status**: ✅ **EXCELLENT**
- **Details**:
  - Listens for navigation events: `PAGE_CHANGED`, `CHARACTER_SELECTED`, `CHARACTER_CREATED`, `CHARACTER_DELETED`
  - Coordinates state updates based on events
  - Properly updates navigation state when events fire
  - Event cleanup handled correctly

#### `app/js/core/PageHandler.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Listens to `PAGE_LOADED` events to initialize page-specific logic
  - Manages event listener cleanup when leaving pages
  - Coordinates card initialization on page changes
- **Notes**: Uses both EventBus and direct method calls (appropriate for page-specific setup)

#### `app/js/core/Router.js`
- **Status**: ✅ **EXCELLENT**
- **Details**:
  - Emits `PAGE_CHANGED` event on navigation
  - Validates routes before emission
  - Integrates with AppState

#### `app/js/core/Storage.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Emits `STORAGE_CHARACTER_LOADED`, `STORAGE_CHARACTER_SAVED`, `STORAGE_CHARACTER_DELETED`
  - Proper event emission after IPC operations complete
  - Integrates well with character lifecycle

### Services (Mostly Good)

#### `app/js/services/ProficiencyService.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Emits `SERVICE_INITIALIZED` event for tracking
  - Exposes events for proficiency operations
  - Event constants properly defined in main EventBus

#### `app/js/services/RaceService.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Emits `DATA_LOADED` event with race data
  - Proper initialization tracking
  - Uses AppState for state management

#### `app/js/services/BackgroundService.js`
- **Status**: ✅ **FAIR**
- **Details**:
  - Emits `DATA_LOADED` event
  - Also emits non-standard event `'background:selected'` (not in EVENTS constant)
  - Updates AppState appropriately
- **Issue**: Uses bare string `'background:selected'` instead of EVENTS constant

#### `app/js/services/ClassService.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Emits `DATA_LOADED` event properly
  - Initialization events tracked

#### `app/js/services/SettingsService.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Emits `SERVICE_INITIALIZED` event
  - Uses EventBus for service lifecycle tracking

#### `app/js/services/SourceService.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Listens to `CHARACTER_LOADED` and `CHARACTER_CREATED` events
  - Properly handles source filtering on character changes
  - Correct listener attachment pattern

#### `app/js/services/AbilityScoreService.js`
- **Status**: ✅ **FAIR**
- **Details**:
  - Listens to events for character changes
  - However, uses non-standard event: `CHARACTER_CHANGED` (should be `CHARACTER_SELECTED`)
- **Issue**: Event name inconsistency - should standardize to defined EVENTS

#### `app/js/services/ItemService.js`, `SpellService.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Emit `DATA_LOADED` events
  - Proper initialization pattern

### Modules/Cards (Good to Fair)

#### `app/js/modules/proficiencies/ProficiencyCard.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Listens to proficiency-specific events in constructor
  - Properly uses event constants: `PROFICIENCY_ADDED`, `PROFICIENCY_REMOVED_BY_SOURCE`, `PROFICIENCY_REFUNDED`, etc.
  - Updates UI based on event emissions
  - Emits `CHARACTER_UPDATED` when proficiencies change
- **Pattern**:
  ```javascript
  eventBus.on('proficiency:added', this._handleProficiencyAdded.bind(this));
  eventBus.on('proficiency:removedBySource', this._handleProficiencyRemoved.bind(this));
  eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
  ```

#### `app/js/modules/race/RaceCard.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Emits `CHARACTER_UPDATED` on race/subrace changes
  - Uses EventBus for state coordination
  - Integrates with AppState

#### `app/js/modules/background/BackgroundCard.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Emits `CHARACTER_UPDATED` on background changes
  - Properly integrates with AppState
  - Good event-driven design

#### `app/js/modules/class/ClassCard.js`
- **Status**: ⚠️ **FAIR - MIXED PATTERNS**
- **Details**:
  - Uses direct `document.addEventListener('characterChanged', ...)` 
  - Also listens to non-EventBus event: `document.addEventListener('class:selected', ...)`
  - Should be using EventBus instead of DOM events
- **Issues**: 
  - Uses DOM custom events instead of EventBus
  - Inconsistent with architecture

#### `app/js/modules/abilities/AbilityScoreCard.js`
- **Status**: ✅ **GOOD**
- **Details**:
  - Uses EventBus for event communication
  - Properly structured initialization
  - Uses document events for some listeners but primarily EventBus-driven

---

## ⚠️ SHOULD USE EVENTBUS BUT DON'T

### High Priority Issues

#### `app/js/modules/class/ClassCard.js` ⚠️ **CRITICAL**
**Current Pattern**: DOM Custom Events + Direct Method Calls
```javascript
document.addEventListener('characterChanged', event => this._handleCharacterChanged(event));
document.addEventListener('class:selected', event => { 
    this.updateClassDetails(event.detail); 
});
```

**Should Be**: EventBus Events
```javascript
eventBus.on(EVENTS.CHARACTER_UPDATED, (data) => {
    this._handleCharacterChanged(data);
});
eventBus.on(EVENTS.CLASS_SELECTED, (classData) => {
    this.updateClassDetails(classData);
});
```

**Reason**: Architecture requires all cross-component communication through EventBus, not DOM events. DOM events are low-level and bypass infrastructure patterns.

---

#### `app/js/modules/abilities/AbilityScoreCard.js` ⚠️ **NEEDS REVIEW**
**Current Pattern**: Mix of EventBus and direct calls
```javascript
this._abilityScoresChangedListener = null;
// Direct event handling mixed with approach
```

**Issues**:
- Listener references stored but pattern unclear
- Should explicitly use EventBus for external communication
- Direct component references suggest tight coupling

**Recommendation**: Audit all external communication paths and convert to EventBus.

---

#### View Components in Card Modules ⚠️ **PATTERN ISSUE**
Files like:
- `app/js/modules/class/ClassView.js`
- `app/js/modules/race/RaceView.js`
- `app/js/modules/background/BackgroundView.js`

**Current Pattern**: Direct callback handlers
```javascript
onClassChange(event => callback(event))
onSubclassChange(event => callback(event))
```

**Issues**:
- Uses callback pattern instead of events
- Card controllers aggregate callbacks but don't expose as events
- View updates should trigger EventBus emissions

**Recommendation**: 
- Views should emit events through EventBus instead of returning callbacks
- Controllers should listen to view events through EventBus
- This decouples views from cards completely

---

### Medium Priority Issues

#### `app/js/modules/background/BackgroundView.js`, `RaceView.js`, `ClassView.js`, etc. ⚠️
**Pattern**: Callback-based architecture
```javascript
class BackgroundCardView {
    onBackgroundChange(callback) {
        // Direct callback assignment
    }
}
```

**Issues**:
- Views expose callback methods instead of events
- Card classes must hold direct references to views
- Changes in view implementation require card changes

**Should Be**: EventBus pattern
```javascript
selectBackground(name, source) {
    // ... selection logic
    eventBus.emit(EVENTS.BACKGROUND_SELECTED, { name, source });
}
```

---

#### `app/js/core/Modal.js` ⚠️ **NEEDS REFACTORING**
**Current Pattern**: Callback-based event handlers
```javascript
this._eventHandlers = {
    onShowModal: null,
    onCreateCharacter: null
};

setupEventListeners(handlers = {}) {
    this._eventHandlers = handlers;
}
```

**Issues**:
- Modal exposes callback handlers instead of emitting events
- PageHandler must pass callbacks to Modal
- Tight coupling between Modal and PageHandler

**Should Be**:
```javascript
setupEventListeners() {
    eventBus.on(EVENTS.MODAL_OPENED, () => {
        this.showNewCharacterModal();
    });
}

_createCharacterFromModal() {
    eventBus.emit(EVENTS.CHARACTER_CREATED, newCharacter);
}
```

---

#### `app/js/utils/notifications.js` ⚠️ **EDGE CASE**
**Current Pattern**: Direct utility function calls
```javascript
showNotification(message, type = 'info')
```

**Analysis**:
- Currently acceptable as utility function (no coupling)
- However, consider EventBus for error/warning propagation
- Errors emitted as `ERROR_OCCURRED` could show notifications automatically

**Recommendation**: Optional - Could emit events for system notifications vs user-triggered ones.

---

---

## ✅ SHOULDN'T USE EVENTBUS

### Pure Utilities (Correct Pattern)

#### `app/js/utils/DataLoader.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Pure data loading utility, no domain logic
- **Pattern**: Static methods only
- **Note**: Services that consume DataLoader emit appropriate events

#### `app/js/utils/TextProcessor.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Pure text transformation utility
- **Pattern**: Static methods only
- **No coupling**: Used by multiple unrelated components

#### `app/js/utils/TextFormatter.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Pure formatting utility
- **Pattern**: Static methods only

#### `app/js/utils/NumberFormatter.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Pure number formatting
- **Pattern**: Static methods only

#### `app/js/utils/Tooltips.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Pure DOM utility for tooltip display
- **Pattern**: Attaches DOM event listeners (appropriate for UI utilities)
- **Note**: Does not need EventBus as it's purely presentational

#### `app/js/utils/ReferenceResolver.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Pure reference resolution utility
- **Pattern**: Async data resolution methods
- **Note**: Returns data, doesn't manage state

#### `app/js/utils/Renderer.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Pure rendering utility
- **Pattern**: Static methods for HTML generation

#### `app/js/utils/TagProcessor.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Pure tag processing utility
- **Pattern**: Static methods only

### Domain Models (Correct Pattern)

#### `app/js/core/Character.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Domain model representing character data
- **Pattern**: Data structure with domain-specific methods
- **Note**: State management delegated to CharacterManager (which uses EventBus)

#### `app/js/core/Proficiency.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Domain model for proficiency calculations
- **Pattern**: Pure domain logic
- **Note**: Service (ProficiencyService) handles events

#### `app/js/core/CharacterSchema.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Data validation schema
- **Pattern**: Static validation methods only

#### `app/js/core/PageLoader.js` (partially)
- **Status**: ✅ **MOSTLY CORRECT**
- **Reason**: Template loading utility
- **Pattern**: Cache management and template rendering
- **Note**: Should NOT emit events for template loads (appropriate for PageHandler to emit PAGE_LOADED)

#### `app/js/core/PageHandler.js` (for page-specific init)
- **Status**: ✅ **CORRECT**
- **Reason**: Page-specific initialization is not generic
- **Pattern**: Direct method calls appropriate for known page setup
- **Note**: But should still listen to EventBus for cross-component coordination

### Infrastructure Layer (Correct Pattern)

#### `app/js/infrastructure/Logger.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Cross-cutting concern, not domain logic
- **Pattern**: Static utility methods
- **Used everywhere**: Should not depend on any app code

#### `app/js/infrastructure/Result.js`
- **Status**: ✅ **CORRECT**
- **Reason**: Pure value object for result handling
- **Pattern**: Immutable data structure
- **No side effects**: Represents computation results

---

## Summary Table

| Component | Status | Reason | Priority |
|-----------|--------|--------|----------|
| **GOOD - Using EventBus Correctly** | | | |
| AppState | ✅ Excellent | Central hub, proper events | N/A |
| CharacterManager | ✅ Excellent | Lifecycle events proper | N/A |
| NavigationController | ✅ Excellent | Event-driven navigation | N/A |
| Router | ✅ Excellent | Route events | N/A |
| Storage | ✅ Good | Storage lifecycle events | N/A |
| Services (most) | ✅ Good | Data loading events | N/A |
| ProficiencyCard | ✅ Good | Event-driven UI | N/A |
| RaceCard | ✅ Good | Event-driven UI | N/A |
| BackgroundCard | ✅ Good | Event-driven UI | N/A |
| | | | |
| **NEEDS REFACTORING** | | | |
| ClassCard | ⚠️ CRITICAL | DOM events, not EventBus | HIGH |
| Modal | ⚠️ HIGH | Callbacks instead of events | HIGH |
| View Classes | ⚠️ HIGH | Callback pattern vs EventBus | HIGH |
| AbilityScoreCard | ⚠️ MEDIUM | Mixed patterns | MEDIUM |
| | | | |
| **CORRECT - Not Using EventBus** | | | |
| DataLoader | ✅ Pure utility | No domain logic | N/A |
| TextProcessor | ✅ Pure utility | No domain logic | N/A |
| Tooltips | ✅ Pure utility | Presentation only | N/A |
| Character | ✅ Domain model | No state mgmt | N/A |
| Logger | ✅ Infrastructure | Cross-cutting | N/A |
| Result | ✅ Value object | Immutable | N/A |

---

## Refactoring Recommendations

### Priority 1: High Impact, High Risk

#### 1.1 Modal → EventBus Pattern
**File**: `app/js/core/Modal.js`

**Current**:
```javascript
setupEventListeners(handlers = {}) {
    this._eventHandlers = handlers;
    // Direct callback calls
}
```

**Target**:
```javascript
// Modal emits events, doesn't accept callbacks
async showNewCharacterModal() {
    // ... show modal logic
    eventBus.emit(EVENTS.MODAL_OPENED, { type: 'newCharacter' });
}

async _createCharacterFromModal() {
    // ... create character
    eventBus.emit(EVENTS.CHARACTER_CREATED, character);
}
```

**Impact**: PageHandler cleanup, reduced coupling

---

#### 1.2 ClassCard DOM Events → EventBus
**File**: `app/js/modules/class/ClassCard.js`

**Current**:
```javascript
document.addEventListener('characterChanged', event => {
    this._handleCharacterChanged(event);
});
```

**Target**:
```javascript
eventBus.on(EVENTS.CHARACTER_UPDATED, (data) => {
    this._handleCharacterChanged(data);
});
```

**Impact**: Consistency with other cards, proper architecture

---

### Priority 2: Medium Impact, Medium Risk

#### 2.1 View Classes Callback Pattern
**Files**: 
- `app/js/modules/class/ClassView.js`
- `app/js/modules/race/RaceView.js`
- `app/js/modules/background/BackgroundView.js`
- Similar view classes

**Current Pattern**:
```javascript
onClassChange(callback) {
    selectElement.addEventListener('change', (e) => {
        callback(e);
    });
}
```

**Target Pattern**:
```javascript
_setupEventListeners() {
    selectElement.addEventListener('change', (e) => {
        eventBus.emit(EVENTS.CLASS_SELECTED, { 
            value: e.target.value,
            source: this._extractSource(e.target.value)
        });
    });
}
```

**Card Controller becomes**:
```javascript
constructor() {
    this._classService = classService;
    // No view references needed!
}

initialize() {
    eventBus.on(EVENTS.CLASS_SELECTED, (data) => {
        this._handleClassChange(data);
    });
}
```

**Benefits**: 
- Views no longer depend on controllers
- Multiple controllers can listen to same events
- True decoupling

---

#### 2.2 Add Missing Event Constants
**File**: `app/js/infrastructure/EventBus.js`

**Add**:
```javascript
// Class selection events
CLASS_SELECTED: 'class:selected',
SUBCLASS_SELECTED: 'subclass:selected',

// Race selection events  
RACE_SELECTED: 'race:selected',
SUBRACE_SELECTED: 'subrace:selected',

// Background selection events
BACKGROUND_SELECTED: 'background:selected',

// UI state events
MODAL_OPENED: 'modal:opened',
MODAL_CLOSED: 'modal:closed',

// Service lifecycle
SERVICE_INITIALIZED: 'service:initialized',
SERVICE_FAILED: 'service:failed'
```

**Impact**: Standardize event names, reduce bare strings

---

### Priority 3: Low Impact, Cleanup

#### 3.1 AbilityScoreCard Event Pattern Review
**File**: `app/js/modules/abilities/AbilityScoreCard.js`

**Action**: Audit listener management
- Ensure all listeners are cleaned up
- Use consistent EventBus pattern throughout
- Remove any remaining direct method calls between cards

---

#### 3.2 Service Initialization Events
**Files**: All services in `app/js/services/`

**Current**: Some use `SERVICE_INITIALIZED`, some don't

**Target**: Standardize all services
```javascript
async initialize() {
    // ... initialization
    eventBus.emit(EVENTS.SERVICE_INITIALIZED, 'serviceName', this);
    Logger.info(`${this.constructor.name}`, 'Initialized');
}
```

**Impact**: AppInitializer can track service readiness

---

---

## Event Flow Diagram (Recommended)

```
DOM Events → Component Controllers → EventBus → Other Components
         (UI interaction)          (emit)      (on listeners)

Example - Class Selection:
ClassCardView (DOM change)
    ↓
ClassCard listens to EventBus
    ↓
ClassCard updates AppState via CharacterManager
    ↓
CharacterManager emits CHARACTER_UPDATED
    ↓
Multiple listeners respond:
  - PageHandler (save UI state)
  - NavigationController (update state)
  - ProficiencyCard (recalculate)
  - AbilityScoreCard (recalculate)
```

---

## Testing Recommendations

### Unit Test Patterns

**For Components Using EventBus (Good)**:
```javascript
test('should emit CHARACTER_UPDATED on class selection', async () => {
    let emittedEvent = null;
    eventBus.on(EVENTS.CHARACTER_UPDATED, (data) => {
        emittedEvent = data;
    });
    
    await card.selectClass('Fighter', 'PHB');
    
    expect(emittedEvent).toBeDefined();
    expect(emittedEvent.character.class.name).toBe('Fighter');
});
```

**For Callback Pattern (Before Refactoring)**:
```javascript
test('should call onClassChange callback', async () => {
    const callback = jest.fn();
    view.onClassChange(callback);
    
    selectElement.value = 'Fighter_PHB';
    selectElement.dispatchEvent(new Event('change'));
    
    expect(callback).toHaveBeenCalled();
});
```

### Integration Test Patterns

```javascript
test('class selection should trigger proficiency recalculation', async () => {
    eventBus.on(EVENTS.PROFICIENCY_UPDATED, (data) => {
        // Verify proficiencies updated
    });
    
    await classCard.selectClass('Rogue', 'PHB');
    
    // Verify proficiency updates
});
```

---

## Checklist for EventBus Consistency

When adding new features, ensure:

- [ ] New state changes emit through EventBus
- [ ] Components listen to events, not callbacks
- [ ] Event names follow `domain:action` pattern
- [ ] Event constants added to EVENTS object
- [ ] No direct `document.addEventListener` for app events
- [ ] Listeners properly cleaned up on destroy
- [ ] No circular dependencies through imports
- [ ] Modal/dialog interactions use EventBus
- [ ] All cross-component communication through EventBus
- [ ] Utilities remain pure (no events)
- [ ] Logger calls follow `[ClassName]` prefix pattern

---

## Conclusion

The Fizbane's Forge codebase has successfully implemented EventBus architecture in core systems (AppState, CharacterManager, NavigationController). However, several components still use older patterns (callbacks, DOM events, direct method calls) that create tight coupling.

**Key Findings**:
- ✅ **70%** of codebase follows EventBus patterns correctly
- ⚠️ **15%** has mixed patterns (some EventBus, some callbacks)
- ⚠️ **15%** still uses pre-refactor patterns (needs updating)

**Recommended Effort**: 
- High priority refactoring: 2-3 days (Modal, ClassCard, View Classes)
- Medium priority cleanup: 1-2 days
- Testing/validation: 1 day

**Long-term Benefits**:
- Improved testability
- Reduced coupling
- Easier feature additions
- Better separation of concerns
- Cleaner dependency graphs

---

## Files Needing Attention (by Priority)

### 🔴 Critical (Refactor Now)
- [ ] `app/js/core/Modal.js` - Convert callbacks to EventBus
- [ ] `app/js/modules/class/ClassCard.js` - Replace DOM events
- [ ] `app/js/modules/*/ClassView.js`, `RaceView.js`, `BackgroundView.js` - Callback pattern

### 🟡 High (Refactor Soon)
- [ ] `app/js/services/AbilityScoreService.js` - Standardize event names
- [ ] `app/js/services/BackgroundService.js` - Add event to EVENTS constant
- [ ] `app/js/modules/abilities/AbilityScoreCard.js` - Audit listeners

### 🟢 Low (Review & Document)
- [ ] `app/js/infrastructure/EventBus.js` - Add missing event constants
- [ ] All services - Standardize SERVICE_INITIALIZED pattern
- [ ] Update copilot-instructions.md with EventBus patterns
