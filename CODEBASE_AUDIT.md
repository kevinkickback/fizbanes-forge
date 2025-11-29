**Codebase Audit — Unused / Old Code & Cleanup Recommendations**

Date: 2025-11-29

This document records findings from a quick audit of the repository focusing on leftover/legacy code, likely refactor artifacts, architecture inconsistencies, and high-value cleanup tasks.

**Summary**:
- **High priority**: remove `debug.log` from the repo and add to `.gitignore`; set `DEBUG_MODE` defaults and standardize logging in main process.
- **Medium priority**: deprecations and legacy DOM event usage in renderer modules — migrate to `EventBus` then remove legacy shims.
- **Low priority / housekeeping**: remove or update outdated `REFACTORED` comments, tighten `preload` surface area, and consider lazy-loading large data JSON bundles.

**High Priority Items**
- `debug.log` (repo root): file should not be checked in — it contains runtime logs. Delete the file and add `debug.log` to `.gitignore`.
- `app/main.js`: `DEBUG_MODE` is hard-coded `true`. Change to read from an environment variable or preferences and default to `false`. Also replace `console.log` with a central logger for the main process (there is a `Logger` in the renderer — create/extend a main-process logger or add an adapter).
- Main-process console logging: many files under `app/electron` use `console.log`/`console.error`. Standardize on a small `MainLogger` module or reuse an existing logger so logs are consistent and configurable (levels, file output, toggle for debug).

**Candidates for Removal / Refactor (review before deleting)**
- `app/js/core/Modal.js`: method `showConfirmationDialog(...)` is marked `@deprecated` and simply delegates to `showConfirmationModal`. No references found outside the module — safe to remove after a final scan. (Search token: `showConfirmationDialog`.)
- Deprecated / legacy DOM event shims: several modules still dispatch/listen to Custom DOM events (e.g., `proficiencyChanged`). Modules observed:
  - `app/js/modules/proficiencies/ProficiencyCard.js` (listens for `proficiencyChanged`)
  - `app/js/modules/race/RaceCard.js` (dispatches `proficiencyChanged`)
  - `app/js/modules/class/ClassCard.js` (dispatches)
  - `app/js/modules/background/BackgroundCard.js` (dispatches)
  Plan: migrate all to `eventBus` usage and then remove DOM event support from `ProficiencyCard.js` and others.

**Architecture / Security & Consistency Issues**
- `app/preload.js` surface:
  - The `electron` namespace exposes `ipc` helpers (`send`, `on`, `invoke`) that allow arbitrary channels. The project's security guidance (preload only expose minimal APIs) advises keeping the surface minimal and explicit. Consider exposing only the whitelisted channels or a limited `invoke` wrapper that validates channel names.
  - `electron.loadJSON` (alias to `data:loadJson`) and `characterStorage.*` are acceptable, but document the allowed channels and inputs, or restrict the `ipc` methods.
- Inconsistent use of `Logger` vs `console`:
  - Renderer uses `Logger` (`app/js/infrastructure/Logger.js`), main process uses `console.log`. Standardize and provide a small wrapper so both processes produce consistent logs.
- Data loading behavior:
  - `DataHandlers` logs show many large JSON loads at startup (see `debug.log`). Consider lazy-loading large data files or moving to an indexed approach (load only indexes at start, load detail files on-demand) to reduce startup time and memory.

**Vendor / Third-party Files**
- `app/assets/bootstrap/...` contains vendor code with `@deprecated` compatibility bits — keep as-is (vendor). Do not attempt to remove these lines; they are intentionally present for backward compatibility.

**Minor Cleanup / Cosmetic**
- Remove or update `REFACTORED: Phase X` comments in `app/main.js`, `app/js/services/ClassService.js`, etc., if they no longer add useful context. Large inline history comments are noise once refactor is complete.
- Normalize log prefixes: some modules log `"[WindowManager] ..."` while others use `Logger.info('Router', ...)`. If you adopt a `MainLogger`, follow the same prefix pattern.
- Check for stray development-only defaults (e.g., sample `characterSavePath` saved in preferences during testing) — these appear in `debug.log` but might be coming from local preferences; ensure no test data or user-local paths are accidentally checked in.

**Suggested Immediate Changes (concrete PR)**
1. Remove `debug.log` and add to `.gitignore`.
2. Update `app/main.js`:
   - set `const DEBUG_MODE = process.env.FF_DEBUG === 'true' || false;`
   - replace `console.log` with `MainLogger` or `require('../js/infrastructure/Logger')` adapter.
3. In `app/preload.js` restrict `electron.ipc` namespace:
   - replace generic `ipc.on`/`ipc.send` with explicit functions for allowed channels or a validated `invoke(channel, args)` that only permits channels from `app/electron/ipc/channels.js`.
4. Prepare a migration PR to:
   - replace DOM CustomEvent-based module communication with `eventBus` for `proficiencyChanged` and similar events; then remove legacy listeners.
5. Remove `Modal.showConfirmationDialog` if no external references remain.

**Files / Places to Inspect Before Deleting**
- `debug.log` — remove from repo
- `app/js/core/Modal.js` — deprecated method
- `app/js/modules/proficiencies/*`, `app/js/modules/race/*`, `app/js/modules/class/*`, `app/js/modules/background/*` — DOM event usage
- `app/main.js`, `app/electron/*` — logger standardization and DEBUG_MODE
- `app/preload.js` — tighten IPC surface

**Notes on Testing & Rollout**
- Make the logging changes behind feature flags or config so you can toggle without breaking developer workflows.
- For event migration, perform the changes in two steps: (A) add EventBus emits in the producers, (B) switch consumers to EventBus, and (C) remove DOM events. Keep both paths active with warnings for one release, then remove legacy code.
- After removing `debug.log`, run `git status` to confirm no other runtime artifacts remain.

**Final Recommendations / Next Steps**
- Create small PRs for each bullet above (1–2 changes per PR). Start with the `debug.log/.gitignore` and `DEBUG_MODE` fix + logger adapter for highest immediate value.
- Add an `MAINTENANCE.md` checklist to capture these cross-cutting cleanup items and their owners/priorities.

If you want, I can open PR patches for the highest-priority items: delete `debug.log` + add `.gitignore` entry, change `DEBUG_MODE` usage in `app/main.js`, and add a small `MainLogger` adapter that wraps `console` (quick, safe). Tell me which subset you want me to implement and I'll apply the patches.
