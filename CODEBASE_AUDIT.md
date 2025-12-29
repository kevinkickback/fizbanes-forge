# Fizbane's Forge Codebase Audit

_Last reviewed: December 29, 2025_

---

## 1. Uniformity and Consistency

### Issues Identified
- **Mixed Module Systems**: ES modules are used in most places, but some Electron-specific files use CommonJS. This is necessary for Electron, but ensure the boundary is clear and documented.
- **Service Layer Patterns**: Some services follow different initialization and data access patterns. For example, not all services are registered or initialized in the same way in `AppInitializer.js`.
- **Naming Conventions**: File and variable naming is mostly consistent, but some files (e.g., `MainLogger.js` vs. `PreferencesManager.js`) use different naming patterns for similar roles.
- **Event Bus Usage**: Event names and payload structures are not always standardized (e.g., `CHARACTER_UPDATED` vs. `PAGE_CHANGED`).

### Recommendations
- Document and enforce a single service registration/init pattern.
- Standardize event names and payloads (e.g., use `snake_case` or `UPPER_CASE` consistently).
- Adopt a single naming convention for files and classes (e.g., `PascalCase` for classes, `camelCase` for variables).
- Add a project-wide style guide or expand `biome.json` rules.

---

## 2. Best Practices

### Issues Identified
- **Direct Data Access**: Some UI code may access JSON data directly instead of via the service layer, risking tight coupling.
- **Error Handling**: Error handling is inconsistent, especially in async operations and IPC communication.
- **Async Initialization**: Some async initializations are not properly awaited, risking race conditions.

### Recommendations
- Enforce all data access through the service layer.
- Standardize error handling and always handle async errors.
- Ensure all async initializations are awaited before UI loads.

---

## 3. Streamlining and Simplicity

### Issues Identified
- **Redundant Logic**: Some services and utility functions duplicate logic (e.g., data loading, event emission).
- **Over-Engineering**: The event bus is sometimes used for simple state changes that could be handled locally.
- **Dead Code**: Some legacy or debug-only code is present but not clearly marked or separated.

### Recommendations
- Refactor duplicated logic into shared utilities.
- Use the event bus only for true cross-component communication.
- Remove dead/legacy/debug code.
