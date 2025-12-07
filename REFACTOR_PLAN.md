# Refactor Plan

## Table of Contents

1. [Overview](#overview)
2. [Summary Table of Issues](#summary-table-of-issues)
3. [Detailed Findings & Recommendations](#detailed-findings--recommendations)
    - [Redundant Ability Abbreviation Logic](#redundant-ability-abbreviation-logic)
    - [Result and Logger Patterns](#result-and-logger-patterns)
    - [Renderer and ContentRenderer Complexity](#renderer-and-contentrenderer-complexity)
    - [Race Data Handling](#race-data-handling)
    - [Formatting and Utility Functions](#formatting-and-utility-functions)
    - [Error Handling Patterns](#error-handling-patterns)
    - [State Reset Logic](#state-reset-logic)
    - [General Naming and Cohesion](#general-naming-and-cohesion)
4. [Best Practice Evaluation](#best-practice-evaluation)
5. [Appendix: Example Improvements](#appendix-example-improvements)

---

## Overview

This document identifies areas of unnecessary complexity, redundancy, and indirect control flow in the codebase. Each issue includes a summary, impact, and actionable refactor strategy.

---

## Summary Table of Issues

| Area/Module                | Problem Summary                                 | Impact                | Recommended Fix                |
|----------------------------|-------------------------------------------------|-----------------------|-------------------------------|
| Ability Abbreviation       | Duplicate logic in multiple modules             | Maintainability       | Centralize in utility         |
| Result/Logger Patterns     | Overly abstract, custom implementations         | Readability, Overhead | Use standard/error objects     |
| ContentRenderer            | Overly recursive, indirect plugin system        | Complexity            | Simplify, document, modularize|
| Race Data Handling         | Multiple lookup maps, indirect subrace logic    | Indirection           | Streamline data access        |
| Formatting Utilities       | Some redundant/overlapping helpers              | Maintainability       | Consolidate, document         |
| Error Handling             | Inconsistent, sometimes silent                  | Debuggability         | Standardize, propagate errors |
| State Reset                | Re-instantiates class for reset                 | Performance, Clarity  | Use initial state snapshot    |
| Naming/Cohesion            | Some unclear or generic names                   | Readability           | Rename for intent             |

---

## Detailed Findings & Recommendations

### 1. Redundant Ability Abbreviation Logic ✅ COMPLETED

**Problem:**  
The logic for converting ability names to abbreviations (e.g., "strength" → "STR") is duplicated in at least three places:
- `TextFormatter.js` (`abbreviateAbility`)
- `AbilityChoices.js` (`_getAbilityAbbreviation`)
- `BonusNotes.js` (`_getAbilityAbbreviation`)

**Impact:**  
- Increases maintenance cost (bug fixes/updates must be made in multiple places)
- Risk of inconsistency

**Resolution:**  
- Enhanced `TextFormatter.abbreviateAbility` to handle already-abbreviated inputs (STR, DEX, etc.)
- Removed duplicate `_getAbilityAbbreviation` methods from both `AbilityChoices.js` and `BonusNotes.js`
- Updated all usages to import and use the centralized utility function
- Reduced codebase by ~60 lines of duplicate code

**Changes Made:**
```js
// Enhanced TextFormatter.js to handle both full names and abbreviations
export function abbreviateAbility(ability) {
  const abilityLower = ability.toLowerCase();
  const abbr = {
    strength: 'STR', dexterity: 'DEX', constitution: 'CON',
    intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA',
    str: 'STR', dex: 'DEX', con: 'CON',
    int: 'INT', wis: 'WIS', cha: 'CHA',
  };
  return abbr[abilityLower] || ability.substring(0, 3).toUpperCase();
}

// Updated AbilityChoices.js and BonusNotes.js
import { abbreviateAbility } from '../../utils/TextFormatter.js';
// All uses of this._getAbilityAbbreviation replaced with abbreviateAbility
```

---

### 2. Result and Logger Patterns ✅ COMPLETED (Logger Replacement)

**Problem:**  
- Custom `Result` and `Logger` classes are implemented with features (e.g., chaining, history, FF_DEBUG gating) that may be overkill for the app's needs.
- `Result` pattern is used where simple try/catch or error returns would suffice.
- Custom renderer `Logger` duplicates functionality already available in Chrome DevTools (timestamps, levels, file source, filtering).

**Impact:**  
- Adds abstraction and indirection, making debugging and onboarding harder.
- Custom error handling can obscure stack traces and error sources.
- Renderer logger adds overhead when DevTools already provides superior capabilities.

**Recommended Fix:**  
- **Result Pattern:** Use standard JavaScript `Error` objects and try/catch for error handling unless explicit monadic chaining is required.
- **Renderer Logger:** Remove custom `Logger` from renderer and replace with native `console` methods: ✅ COMPLETED
  - Removed all Logger imports from 50+ renderer files
  - Replaced all `Logger.info()` → `console.info('[ModuleName]', ...)` calls
  - Replaced all `Logger.warn()` → `console.warn('[ModuleName]', ...)`
  - Replaced all `Logger.error()` → `console.error('[ModuleName]', ...)`
  - Replaced all `Logger.debug()` → `console.debug('[ModuleName]', ...)`
  - Main process keeps `MainLogger` in electron main process (no DevTools available there)

**Changes Made:**
- Service files (15): Removed Logger imports and replaced all 80+ method calls
- Utility files (6): Removed Logger imports and replaced all method calls (TooltipManager, DataLoader, ReferenceResolver, TextProcessor, TagProcessor, etc.)
- Core files: Replaced all Logger calls (Router, EventBus, etc.)
- Module files (16+): Replaced all Logger calls across race, class, background, proficiency, sources modules
- All 50+ renderer files now use native console methods with standardized bracketed naming: `console.method('[ServiceName]', message, data)`

**Example:**
```js
// Old code
Logger.info('ClassService', 'Loading class data', { count });

// New code
console.info('[ClassService]', 'Loading class data', { count });

// Instead of Result.ok()/Result.err()
try {
  const data = await fetchData();
  // ...
} catch (e) {
  // handle error
}
```

**Benefits:**
- Eliminated 50+ Logger imports across renderer codebase
- Replaced 100+ Logger method calls with console equivalents
- Native console is faster and has no abstraction overhead
- Better stack traces and source mapping
- Familiar API for all developers
- DevTools filtering/searching is more powerful than custom history
- All renderer files compile without errors ✅

---

### 3. Renderer and ContentRenderer Complexity

**Problem:**  
- The `Renderer` class in `ContentRenderer.js` is highly recursive, with a plugin system and dynamic type dispatch.
- The control flow is indirect, and the plugin system is under-documented.

**Impact:**  
- Hard to follow, debug, and extend.
- New contributors may struggle to add new entry types or understand rendering flow.

**Recommended Fix:**  
- Add clear documentation and diagrams for the rendering flow.
- Consider breaking up the renderer into smaller, type-specific modules.
- If the plugin system is not widely used, remove or simplify it.

**Example:**
- Split `_rendererMap` into separate files per entry type.
- Document the expected entry structure and rendering process.

---

### 4. Race Data Handling

**Problem:**  
- Multiple lookup maps and subrace extraction logic in `RaceService.js` are complex and sometimes redundant.
- Indirect handling of subrace variants and versions.

**Impact:**  
- Increases cognitive load and risk of bugs.
- Makes it harder to add new race data or debug issues.

**Recommended Fix:**  
- Consolidate lookup logic into a single, well-documented function.
- Use clear data models for races and subraces.
- Avoid unnecessary abstraction (e.g., only use maps where O(1) lookup is critical).

---

### 5. Formatting and Utility Functions

**Problem:**  
- Some formatting helpers (e.g., for dice, modifiers, joining arrays) are scattered and sometimes overlap in functionality.

**Impact:**  
- Redundant code, harder to maintain.

**Recommended Fix:**  
- Consolidate all formatting helpers into a single module.
- Add JSDoc comments and usage examples.

---

### 6. Error Handling Patterns

**Problem:**  
- Some modules (e.g., `AppInitializer.js`, `ReferenceResolver.js`) catch errors and return null or error objects, sometimes logging, sometimes not.

**Impact:**  
- Inconsistent error handling makes debugging harder.
- Silent failures can mask real issues.

**Recommended Fix:**  
- Standardize error handling: always log errors, and propagate them unless there’s a clear reason to swallow.
- Use a consistent error reporting strategy (e.g., always return an error object or always throw).

---

### 7. State Reset Logic

**Problem:**  
- `AppStateImpl.clear()` re-instantiates the class to reset state.

**Impact:**  
- Inefficient and can lead to subtle bugs if constructor logic changes.

**Recommended Fix:**  
- Store an initial state snapshot and reset to it, rather than re-instantiating.

**Example:**
```js
class AppStateImpl {
  constructor() {
    this.initialState = { ...defaultState };
    this.state = { ...this.initialState };
  }
  clear() {
    this.state = { ...this.initialState };
  }
}
```

---

### 8. General Naming and Cohesion

**Problem:**  
- Some class and method names are generic (e.g., `Manager`, `Service`, `Impl`), and responsibilities are sometimes blurred.

**Impact:**  
- Reduces clarity and discoverability.

**Recommended Fix:**  
- Use more descriptive names (e.g., `RaceDataService` instead of `RaceService` if it only handles data).
- Ensure each module/class has a single, clear responsibility.

---

## Best Practice Evaluation

| Practice                        | Adherence | Notes/Recommendations                                 |
|----------------------------------|-----------|-------------------------------------------------------|
| Readability & Maintainability    | Medium    | Improve by reducing duplication and clarifying flow   |
| Naming Quality                   | Medium    | Use more descriptive, intent-revealing names          |
| Cohesion & Separation of Concerns| Medium    | Some modules/classes do too much                      |
| Error Handling                   | Low-Med   | Standardize and propagate errors                      |
| Testability                      | Medium    | Utilities are testable, but indirect logic hinders    |
| Use of Language/Framework        | Good      | Modern JS features used, but avoid over-abstraction   |
| Performance                      | Good      | Lookup maps are efficient, but avoid premature opt.   |

---

## Appendix: Example Improvements

### Centralizing Ability Abbreviation

**Before:**
```js
// In multiple files
_getAbilityAbbreviation(ability) { ... }
```
**After:**
```js
// In TextFormatter.js
export function abbreviateAbility(ability) { ... }
// In all modules
import { abbreviateAbility } from '../utils/TextFormatter.js';
```

### Simplifying Result/Error Handling

**Before:**
```js
const result = Result.ok(data).andThen(...).unwrapOr(defaultValue);
```
**After:**
```js
try {
  const data = await fetchData();
  // ...
} catch (e) {
  // handle error
}
```

---

# Next Steps

- Prioritize centralizing utility logic and standardizing error handling.
- Refactor renderer and data services for clarity and maintainability.
- Review naming and module responsibilities for improved cohesion.

---

**This plan is intended as a living document. Update as improvements are made.**

---
