# Architecture Decisions

This document explains key architectural decisions in Fizbane's Forge.

## State Management Strategy

### Immutability Approach

**Decision:** Use **mutable architecture** with direct character object mutations, with Immer only for global AppState.

**Rationale:**
- Character objects are large, deeply nested structures with Maps and Sets
- Frequent mutations during character creation and leveling
- Immer overhead unnecessary for single-user desktop application
- Direct mutations provide better performance and simpler debugging

**Implementation:**
- ✅ `AppState` uses Immer's `produce()` for all state updates
- ✅ Character objects are mutated directly by services
- ✅ EventBus notifies components of changes
- ✅ CharacterManager handles save/load with proper serialization

**Trade-offs:**
- ❌ No automatic undo/redo (would need custom implementation)
- ❌ No time-travel debugging
- ✅ Simpler code, better performance
- ✅ Easier to work with Map/Set data structures

### Example Patterns

```javascript
// ✅ CORRECT: AppState with Immer
AppState.setState({ currentCharacter: character });

// ✅ CORRECT: Direct character mutation
character.race = { name: 'Elf', source: 'PHB' };
character.proficiencies.skills.push('Perception');
eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });

// ❌ AVOID: Unnecessary Immer wrapping for character
const newChar = produce(character, draft => {
    draft.race = { name: 'Elf' }; // Unnecessary overhead
});
```

### When to Use Immer

| Use Case | Use Immer? | Reason |
|----------|------------|--------|
| AppState updates | ✅ Yes | Global state, infrequent updates |
| Character mutations | ❌ No | Frequent updates, mutable by design |
| Service internal state | ❌ No | Performance-critical |
| Modal state | ❌ No | Short-lived, local state |

---

## Validation Strategy

### Zod for All Input Validation

**Decision:** Use Zod for runtime validation of all user inputs and external data.

**Implementation:**
- ✅ `CharacterSchema` uses Zod for character validation
- ✅ `ValidationSchemas.js` provides reusable Zod schemas
- ✅ Services validate inputs with `validateInput()` helper
- ✅ Throws `ValidationError` with detailed context

**Coverage (as of Feb 2026):**
- ✅ CharacterSchema (complete)
- ✅ Service input schemas (11/24 services)
- 🔄 ProficiencyService (in progress)
- ⏳ AbilityScoreService (planned)
- ⏳ LevelUpService (planned)
- ⏳ EquipmentService (planned)

### Example Usage

```javascript
import { validateInput, addProficiencyArgsSchema } from '../lib/ValidationSchemas.js';

addProficiency(character, type, proficiency, source) {
    const validated = validateInput(
        addProficiencyArgsSchema,
        { character, type, proficiency, source },
        'Invalid parameters for addProficiency'
    );
    
    // validated.character, validated.type, etc. are now type-safe
    // Will throw ValidationError if invalid
}
```

---

## Event-Driven Architecture

### EventBus for All Cross-Component Communication

**Decision:** Use EventEmitter3-based EventBus for all inter-component communication.

**Implementation:**
- ✅ Centralized `EVENTS` constant with all event names
- ✅ Services emit events after state changes
- ✅ UI components listen to events and update
- ✅ DOMCleanup handles listener removal for DOM components
- ✅ Manual cleanup required for EventBus listeners in cards

**Event Naming Convention:**
- Format: `RESOURCE:ACTION` (e.g., `CHARACTER_UPDATED`)
- Use past tense for completed actions
- Standardized constants in `EVENTS` object

**Best Practices:**
```javascript
// ✅ CORRECT: Use EVENTS constant
eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
eventBus.on(EVENTS.CHARACTER_SELECTED, handler);

// ❌ AVOID: Magic strings
eventBus.emit('character:updated', character);
```

---

## Error Handling

### Standardized Error Classes

**Decision:** Use specific error types from `lib/Errors.js` for all service errors.

**Error Types:**
- `ValidationError` - Invalid inputs (from Zod validation)
- `NotFoundError` - Resource not found
- `DataError` - Data loading/saving failures
- `ServiceError` - Service initialization failures

**Benefits:**
- Type-safe error handling
- Consistent error messages
- Better debugging context
- Easier error recovery

```javascript
import { NotFoundError, ValidationError } from '../lib/Errors.js';

// ✅ CORRECT
throw new NotFoundError('Race', raceName, { source });

// ❌ AVOID
throw new Error(`Race ${raceName} not found`);
```

---

## Future Considerations

### Potential Immer Adoption for Character State

If undo/redo functionality is required in the future:

1. Wrap character updates in Immer's `produce()`
2. Store history of character states
3. Implement undo/redo with state snapshots

**Estimated effort:** 2-3 days
**Benefits:** Time-travel debugging, undo/redo
**Costs:** Performance overhead, increased complexity

### TypeScript Migration

Full TypeScript migration would provide:
- Compile-time type checking
- Better IDE support
- Automatic type inference from Zod schemas

**Status:** Not currently planned
**Blockers:** Large codebase, Electron setup complexity
