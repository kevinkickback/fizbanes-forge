# Comprehensive Refactor Plan

_Last updated: December 6, 2025_

## Overview
This plan addresses unnecessary complexity, best practices, and maintainability issues identified in the codebase. Each section includes a summary, impact, and actionable steps for improvement. Prioritization is based on expected impact and ease of implementation.

---

## 1. Electron Backend (`src/electron/`)

### 1.1 Overly Abstract Patterns
- **Issue:** Excessive use of getters/setters, custom event systems, and factories for simple configuration or file I/O.
- **Impact:** Harder to trace logic, increased cognitive load, slower onboarding.
- **Actions:**
  - Refactor managers (e.g., `DataFolderManager.js`, `PreferencesManager.js`) to use direct property access and simple functions.
  - Remove custom event systems unless essential; prefer Node.js `EventEmitter` if needed.
  - Eliminate factories unless supporting multiple interchangeable implementations.

### 1.2 Redundant Logic
- **Issue:** Multiple layers of logging wrappers (e.g., `MainLogger.js`).
- **Impact:** Slower debugging, harder to change logging behavior.
- **Actions:**
  - Consolidate logging into a single, well-documented logger (e.g., Winston, pino).
  - Remove unnecessary custom wrappers.

### 1.3 Unclear Control Flow
- **Issue:** Window creation and lifecycle events split across many helpers/callbacks.
- **Impact:** Harder to debug, increased onboarding time.
- **Actions:**
  - Centralize window creation and lifecycle management in one module.
  - Use clear, linear startup/shutdown sequences.

---

## 2. Data Layer (`src/data/`)

### 2.1 Inefficient Data Structures
- **Issue:** Loading all JSON files into memory at startup.
- **Impact:** Increased memory usage, slower startup.
- **Actions:**
  - Implement lazy-loading for data files; load only when needed.
  - Use streaming or chunked reads for very large files.

### 2.2 Redundant or Indirect Data Access
- **Issue:** Many small helpers wrapping basic file I/O.
- **Impact:** More code to maintain, harder to debug.
- **Actions:**
  - Consolidate helpers into a single utility module.
  - Use direct file access where possible.

---

## 3. Renderer Layer (`src/renderer/`)

### 3.1 Overly Abstract Patterns
- **Issue:** Excessive component wrappers, HOCs, or context providers for simple UI logic.
- **Impact:** Harder to follow UI logic, increased bundle size.
- **Actions:**
  - Refactor to use simple functional components.
  - Limit context/providers to truly global state.

### 3.2 Naming Quality
- **Issue:** Generic names for files/functions (e.g., `doAction`, `handleData`).
- **Impact:** Reduced clarity, increased risk of bugs.
- **Actions:**
  - Rename files and functions to be descriptive (e.g., `loadCharacterData`, `savePreferences`).

---

## 4. Error Handling Patterns

### 4.1 Inconsistent or Overly Complex Error Handling
- **Issue:** Scattered error handling, custom error types for simple cases, multiple error wrappers.
- **Impact:** Harder to trace errors, increased code size.
- **Actions:**
  - Use standard error types and centralized error handling (e.g., top-level try/catch).
  - Remove unnecessary custom error wrappers.

---

## 5. Testability

### 5.1 Indirect Control Flow
- **Issue:** Functions depend on global state, singletons, or hidden side effects.
- **Impact:** Lower test coverage, harder to refactor safely.
- **Actions:**
  - Pass dependencies explicitly to functions/modules.
  - Avoid global state; use dependency injection where appropriate.

---

## 6. Performance

### 6.1 Inefficient Algorithms
- **Issue:** Linear searches over large arrays for lookups.
- **Impact:** Slower performance for large datasets.
- **Actions:**
  - Refactor to use objects/maps for O(1) lookups.

---

## 7. Example Refactor Tasks

### 7.1 Simplify Data Access
- Replace multiple small wrappers with direct file access or a single utility.
- Example:
  ```js
  // Instead of:
  function getData(file) { ... }
  function getActions() { return getData('actions.json'); }
  // Use:
  const actions = JSON.parse(fs.readFileSync('actions.json', 'utf8'));
  ```

### 7.2 Centralize Window Management
- Move window creation logic to a single function/module with clear lifecycle handling.

### 7.3 Improve Naming
- Audit and rename generic functions/files for clarity.

### 7.4 Consolidate Error Handling
- Centralize error handling logic; remove redundant wrappers.

### 7.5 Refactor for Testability
- Pass dependencies explicitly; remove hidden side effects.

### 7.6 Optimize Data Lookups
- Use maps/objects for frequent lookups in large datasets.

---

## 8. Prioritization & Timeline

| Priority | Task                                      | Impact          |
|----------|-------------------------------------------|-----------------|
| High     | Centralize window management              | Readability     |
| High     | Simplify data access & lazy-load          | Performance     |
| High     | Consolidate error handling                | Debuggability   |
| Medium   | Refactor managers for directness          | Maintainability |
| Medium   | Improve naming throughout                 | Readability     |
| Medium   | Optimize data lookups                     | Performance     |
| Low      | Remove excessive UI wrappers              | Bundle size     |

---

## 9. Next Steps
1. Audit and refactor managers and helpers for directness.
2. Centralize window and error management.
3. Refactor data access for lazy loading and efficient lookups.
4. Improve naming for clarity and maintainability.
5. Review and simplify UI component structure.
6. Write/adjust tests to cover refactored code.

---

## 10. References
- [Node.js EventEmitter](https://nodejs.org/api/events.html)
- [Winston Logger](https://github.com/winstonjs/winston)
- [JavaScript Dependency Injection Patterns](https://www.digitalocean.com/community/tutorials/js-dependency-injection)

---

_This plan is intended to guide targeted, high-impact improvements. For code samples or detailed task breakdowns, see the relevant module or request further details._
