# Refactor Progress (as of 2025-12-07)

The following improvements have been completed:

- WindowManager, PreferencesManager, and DataFolderManager refactored to plain modules with exported functions (no unnecessary classes).
- IPC handler registration is now direct in main.js; IPCRegistry.js is obsolete.
- Error handling in DataFolderManager.js and FileHandlers.js is now consistent and always logs errors.
- Unused indirection, boilerplate, and dead code have been removed from the Electron backend.
- Renderer: TooltipManager flattened to a plain module; singleton usage removed; hover metadata normalized for both `.rd__hover-link` and `.reference-link`; tooltip formatting restored; tooltip test page CSS paths fixed.
- **Renderer Utilities:** ReferenceResolver and DataLoader are plain modules with exported functions (no classes).

**Currently in Progress:**
- ~~Refactoring TagProcessor from class to plain module~~ ✅ **COMPLETED**
  - Converted TagProcessor from class with static methods to plain module with exported functions
  - Replaced singleton pattern with direct function exports (escapeHtml, splitTagByPipe, processTag, renderString, registerHandler)
  - Added missing `damage` and `scaledamage` tag handlers
  - Maintained backward compatibility with getStringRenderer() function
  - TextProcessor already uses renderString; no additional changes needed
- ~~Refactoring StatBlockRenderer from class to plain module~~ ✅ **COMPLETED**
  - Converted StatBlockRenderer from class with static methods to plain module with exported functions
  - Exported 14 render functions: renderSpell, renderItem, renderRace, renderClass, renderFeat, renderBackground, renderCondition, renderSkill, renderAction, renderOptionalFeature, renderReward, renderTrap, renderVehicle, renderObject
  - Converted 8 static helper methods to private functions (prefixed with _)
  - Updated TooltipManager to import individual render functions
  - Fixed renderer.render() calls to use renderString() in _renderEntries()
  - **All Playwright tests passing** (4/4 ✅)

**Next recommended areas:**
- Optimize remaining data access patterns (skills, actions, optional features, rewards, traps, vehicles - less frequently accessed).
- Refactor TextProcessor to align with new plain module patterns (if applicable - currently stateful singleton).
- Review and expand test coverage for renderer utilities and data services.
- Add additional Playwright integration checks for end-to-end refactor validation.
- Performance optimization: Consider lazy loading for less-frequently used services.
- Consider implementing a ServiceLocator or centralized service initialization pattern.

---
title: Refactor Plan for Fizbanes Forge
date: 2025-12-06
---

# Refactor Plan: Fizbanes Forge

## Overview

This document provides a comprehensive review of the codebase, focusing on unnecessary complexity, best practices, and actionable simplifications. Each section highlights high-impact improvements, with explanations, impact, and concrete recommendations.

---

## Table of Contents

1. [General Observations](#general-observations)
2. [Electron Backend (src/electron)](#electron-backend)
3. [Renderer & Utilities (src/renderer/scripts/utils)](#renderer--utilities)
4. [Shared Patterns & Data](#shared-patterns--data)
5. [Summary Table of Issues](#summary-table-of-issues)
6. [Appendix: Example Refactors](#appendix-example-refactors)

---

## General Observations

- **Strengths:**
  - Modular structure, clear separation between Electron and renderer.
  - Use of ES modules and modern JS features.
  - Good use of logging and IPC patterns.
- **Areas for Improvement:**
  - Overuse of manager/wrapper/helper classes.
  - Redundant or indirect control flow, especially in data and window management.
  - Some inefficient or verbose data handling.
  - Inconsistent naming and error handling.
  - Testability could be improved by reducing coupling and indirection.

---

## Electron Backend

### 1. Over-Abstraction: Manager Classes

| File/Class                | Problem Summary | Impact | Recommendation |
|---------------------------|-----------------|--------|----------------|
| WindowManager, PreferencesManager, DataFolderManager | Multiple single-responsibility classes with thin logic, often just wrapping Electron APIs or simple file ops. | Adds indirection, makes tracing logic harder, increases boilerplate. | Collapse into fewer, more focused modules. Expose simple functions for common tasks. |

**Example:**
```js
// Instead of:
const winMgr = new WindowManager();
winMgr.createMainWindow();

// Prefer:
import { createMainWindow } from './window.js';
createMainWindow();
```

### 2. Redundant IPC Handler Registration

| File | Problem Summary | Impact | Recommendation |
|------|-----------------|--------|----------------|
| ipc/IPCRegistry.js, handlers/*Handlers.js | Each handler is registered via a registry class, but most handlers are simple and could be registered directly. | Unnecessary indirection, harder to trace IPC flow. | Register IPC handlers directly in main.js or a single setup file. |

### 3. Error Handling

| File | Problem Summary | Impact | Recommendation |
|------|-----------------|--------|----------------|
| DataFolderManager.js, FileHandlers.js | Inconsistent error handling, sometimes logs, sometimes swallows errors. | Debugging and reliability issues. | Standardize error handling: always log and propagate or handle gracefully. |

### 4. Data Access Patterns

| File | Problem Summary | Impact | Recommendation |
|------|-----------------|--------|----------------|
| DataFolderManager.js | Multiple async wrappers for file/network ops, some with unnecessary Promises. | Adds complexity, risk of unhandled rejections. | Use async/await directly, avoid wrapping in new Promise unless needed. |

---

## Renderer & Utilities

### 1. Excessive Helper/Manager Classes

| File/Class | Problem Summary | Impact | Recommendation |
|------------|-----------------|--------|----------------|
| TooltipManager, ReferenceResolver, DataLoader, StatBlockRenderer, TagProcessor | Many classes act as singletons or static utility containers, with indirect access patterns (e.g., getInstance, getXManager). | Increases indirection, makes testing and tracing harder. | Use plain modules with exported functions or simple objects. Only use classes for true stateful or extensible logic. (**Done:** TooltipManager flattened; update usages/imports to new API.) |

**Example:**
```js
// Instead of:
const tooltipMgr = TooltipManager.getInstance();
tooltipMgr.show(...);

// Prefer:
import * as tooltip from './tooltip.js';
tooltip.show(...);
```

### 2. Indirect Data Flow

| File | Problem Summary | Impact | Recommendation |
|------|-----------------|--------|----------------|
| ReferenceResolver.js, DataLoader.js | Data is often loaded via chained manager/service/helper calls. | Harder to follow, debug, and test. | Flatten data flow: pass data directly, avoid unnecessary layers. |

### 3. Inefficient Data Handling

| File | Problem Summary | Impact | Recommendation |
|------|-----------------|--------|----------------|
| DataLoader.js, StatBlockRenderer.js | Some data is loaded or transformed multiple times, or via repeated file reads. | Performance hit, especially on large data sets. | Cache results where possible, avoid redundant reads. |

### 4. Naming and Cohesion

| File | Problem Summary | Impact | Recommendation |
|------|-----------------|--------|----------------|
| TagProcessor.js, TooltipManager.js | Some class/function names are generic or misleading (e.g., "Manager" for stateless helpers). | Reduces clarity, increases onboarding time. | Use descriptive, specific names (e.g., Tooltip, TagParser). (**Done:** TooltipManager flattened; consider renaming file to `tooltip.js` later.) |

---

## Shared Patterns & Data

### 1. Data File Access

| Area | Problem Summary | Impact | Recommendation |
|------|-----------------|--------|----------------|
| src/data | Data is accessed via file paths and manual fs calls, sometimes repeated. | Risk of inconsistency, hard to refactor. | Centralize data access in a single module, use caching. |

### 2. Testability

| Area | Problem Summary | Impact | Recommendation |
|------|-----------------|--------|----------------|
| Electron, Renderer | Many modules are tightly coupled to Electron or DOM APIs. | Hard to unit test, requires integration tests. | Use dependency injection or pass dependencies as arguments for easier mocking. |

---

## Summary Table of Issues

| Area | Issue | Impact | Recommendation |
|------|-------|--------|----------------|
| Electron | Overuse of manager/wrapper classes | Readability, maintainability | Collapse/flatten, use plain modules |
| Electron | Redundant IPC registry | Indirection, traceability | Register handlers directly |
| Electron | Inconsistent error handling | Debugging, reliability | Standardize/log/propagate |
| Renderer | Excessive helpers/singletons | Indirection, testability | Use plain modules/functions |
| Renderer | Indirect data flow | Debugging, performance | Flatten, pass data directly |
| Renderer | Inefficient data handling | Performance | Cache, avoid redundant reads |
| Shared | Data access scattered | Consistency, maintainability | Centralize, cache |
| Shared | Tight coupling to platform | Testability | Use DI, pass dependencies |

---

## Appendix: Example Refactors

### 1. Flattening Manager Classes

**Before:**
```js
export class PreferencesManager {
  get(key) { ... }
  set(key, value) { ... }
}
const prefs = new PreferencesManager();
prefs.get('theme');
```

**After:**
```js
// preferences.js
let store = {};
export function getPreference(key) { return store[key]; }
export function setPreference(key, value) { store[key] = value; }
// Usage:
import { getPreference } from './preferences.js';
getPreference('theme');
```

### 2. Direct IPC Handler Registration

**Before:**
```js
class IPCRegistry {
  register() {
    registerCharacterHandlers(...);
    registerDataHandlers(...);
  }
}
```

**After:**
```js
// main.js
import { registerCharacterHandlers } from './handlers/CharacterHandlers.js';
registerCharacterHandlers(...);
```

### 3. Improving Error Handling

**Before:**
```js
try { ... } catch (e) { /* sometimes logs, sometimes not */ }
```

**After:**
```js
try { ... } catch (e) {
  logger.error('ModuleName', e);
  throw e; // or handle gracefully
}
```

### 4. Flattening Data Flow

**Before:**
```js
const data = await DataLoader.getInstance().loadJSON(url);
```

**After:**
```js
import { loadJSON } from './dataLoader.js';
const data = await loadJSON(url);
```

---

## Next Steps


**Progress Checklist:**

- [x] Prioritize high-impact refactors (manager flattening, error handling, data access centralization).
- [x] Refactor incrementally, running tests after each change (Electron backend complete).
- [x] Update documentation and onboarding guides to reflect simplifications (this plan updated).
- [x] Flatten TooltipManager to a plain module; normalize hover metadata; restore tooltip rendering; fix tooltip test page CSS paths.
- [x] Confirmed ReferenceResolver and DataLoader are plain modules with exported functions (no classes).
- [x] Expanded Playwright integration test coverage for tooltip system (4 new test scenarios).
- [x] Complete TagProcessor refactoring to plain module.
  - ✅ Converted from class to plain module with exported functions
  - ✅ All tag handlers working with module-level state
  - ✅ Backward compatibility maintained via getStringRenderer()
  - ✅ Added damage and scaledamage handlers
- [x] Complete StatBlockRenderer refactoring to plain module.
  - ✅ Converted from class to plain module with exported functions (14 render + 8 private functions)
  - ✅ All Playwright tests passing (4/4)
  - ✅ Fixed undefined renderer variable in _renderEntries()
  - ✅ Updated TooltipManager to use new function imports
- [x] Optimize data access patterns in ReferenceResolver (use service instances instead of repeated DataLoader calls).
  - ✅ Created ConditionService for O(1) cached lookups
  - ✅ Created MonsterService for O(1) cached lookups with collision handling
  - ✅ Created FeatService for O(1) cached lookups
  - ✅ Updated ReferenceResolver to use new services
  - ✅ Eliminated repeated DataLoader calls for conditions, monsters, and feats
  - ✅ All tests passing (4/4)
- [ ] Refactor TextProcessor to align with new plain module patterns (if stateless patterns apply).
- [ ] Review and expand test coverage for renderer utilities and data gateway.
- [ ] Add additional Playwright integration checks for end-to-end refactor validation.

---

**This plan is intended as a living document. Update as improvements are made.**