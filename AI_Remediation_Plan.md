# Fizbane's Forge — Remediation & Architecture Plan

**Source:** `AI_Codebase_Audit.md` + focused architecture re-audit
**Target Audience:** AI coding agent
**Date:** March 6, 2026

---

## How To Use This Document

This plan is divided into **phases of work**, ordered by priority. Each phase contains **discrete tasks**. Each task is self-contained: it states what to change, where, why, and what the acceptance criteria are.

**Rules for the agent:**
- Complete tasks in order within each phase. Do not jump phases.
- After each task, run `npm test` to verify nothing broke.
- Do not refactor, rename, or reformat anything not listed in the task.
- If a task says "move selectors", that means cut from the source file and paste into the target file — do not leave duplicates.
- Preserve all existing visual behavior. These are structural changes, not redesigns.

---

## Phase 1 — CSS Architecture: Eliminate Double-Loading & Junk Drawer

**Goal:** Establish a single clear CSS loading strategy and clean up `main.css`.

### Task 1.1 — Fix CSS double-loading in `index.html`

**Problem:** `src/ui/index.html` directly loads 5 CSS files that are ALSO `@import`ed inside `main.css`, causing the browser to parse them twice.

| File | Loaded in `index.html` | Also `@import`ed in `main.css` |
|------|----------------------|-------------------------------|
| `themes.css` | Line 31 `<link>` | Line 6 `@import` |
| `titlebar.css` | Line 32 `<link>` | Line 9 `@import` |
| `modals.css` | Line 34 `<link>` | Line 21 `@import` |
| `utilities.css` | Line 35 `<link>` | Line 12 `@import` |
| `fontawesome/css/all.min.css` | Line 30 `<link>` | Line 3 `@import` |

Additionally, `page-preview.css` and `page-details.css` are loaded via `<link>` in `index.html` but NOT via `@import` in `main.css` — inconsistent with all other page CSS files.

**Fix:** Use `main.css` as the single orchestrator. Remove the duplicate `<link>` tags from `index.html`. Add `page-preview.css` and `page-details.css` to `main.css`'s `@import` list so all page CSS is loaded consistently.

**File:** `src/ui/index.html`
**Action:** Remove these lines:
```html
<link rel="stylesheet" href="assets/fontawesome/css/all.min.css" />
<link rel="stylesheet" href="styles/themes.css" />
<link rel="stylesheet" href="styles/titlebar.css" />
<link rel="stylesheet" href="styles/modals.css" />
<link rel="stylesheet" href="styles/utilities.css" />
<link rel="stylesheet" href="styles/page-preview.css" />
<link rel="stylesheet" href="styles/page-details.css" />
```
Keep only:
```html
<link rel="stylesheet" href="styles/main.css" />
```

**File:** `src/ui/styles/main.css`
**Action:** Add these two imports to the `/* Pages */` section:
```css
@import url("./page-preview.css");
@import url("./page-details.css");
```

**Acceptance:** Only one `<link>` for `main.css` in `index.html`. All 28 other CSS files loaded via `@import` inside `main.css`. No visual changes.

---

### Task 1.2 — Extract inline styles from `main.css` into proper files

**Problem:** `main.css` serves two roles — import orchestrator AND a dumping ground for ~300 lines of global styles (cards, equipment items, alerts, responsive rules, scrollbar overrides, ID-specific form styles). This makes it a "junk drawer."

**Fix:** Split `main.css` into two files:
1. `main.css` — ONLY `@import` statements. Nothing else.
2. `global.css` — All the inline global styles currently living in `main.css` (everything after the last `@import`).

**Actions:**
1. Create `src/ui/styles/global.css` containing everything from `main.css` line 42 onward (starting at the `@media (min-width: 1280px)` responsive overrides, through body, cards, equipment items, alerts, reference links, text overrides, responsive rules, scrollbar overrides, and the `#saveFolderPath`/`#chooseFolderBtn` rules).
2. In `main.css`, remove all non-import content and add `@import url("./global.css");` after the Core Styles imports (before Form & Input Components).

**Result after this task — `main.css` should be ONLY imports:**
```css
/* Import External CSS */
@import url("../assets/bootstrap/dist/css/bootstrap.min.css");
@import url("../assets/fontawesome/css/all.min.css");

/* Core Styles */
@import url("./themes.css");
@import url("./core-variables.css");
@import url("./core-layout.css");
@import url("./titlebar.css");
@import url("./scrollbars.css");
@import url("./animations.css");
@import url("./utilities.css");
@import url("./notification.css");
@import url("./tooltip.css");
@import url("./global.css");

/* Form & Input Components */
@import url("./buttons.css");
@import url("./forms.css");

/* Modals */
@import url("./modals.css");
@import url("./modal-setup.css");
@import url("./modal-selection-item.css");

/* Reusable Components */
@import url("./component-character-card.css");
@import url("./component-ability-scores.css");
@import url("./component-split-pane.css");
@import url("./component-proficiency.css");

/* Pages */
@import url("./page-build-race.css");
@import url("./page-build-class.css");
@import url("./page-build-background.css");
@import url("./page-build-ability-scores.css");
@import url("./page-build-proficiencies.css");
@import url("./page-feats.css");
@import url("./page-spells.css");
@import url("./page-equipment.css");
@import url("./page-preview.css");
@import url("./page-details.css");
```

**Acceptance:** `main.css` contains zero non-import CSS rules. `global.css` contains all the global styles. No visual changes. `npm test` passes.

---

### Task 1.3 — Merge dead/trivial CSS files

**Problem:** Three CSS files are too trivial to justify separate files.

| File | Lines | Content |
|------|-------|---------|
| `page-build-ability-scores.css` | 8 | Only viewport height |
| `page-build-proficiencies.css` | 11 | Only viewport height |
| `modal-selection-item.css` | 37 | `.item-card` styles duplicated in `modals.css` |

**Fix:**
1. Move the contents of `page-build-ability-scores.css` and `page-build-proficiencies.css` into `global.css` (they set viewport heights for template pages — a global concern).
2. Check whether selectors in `modal-selection-item.css` are still referenced in the HTML/JS. If they are also fully defined in `modals.css`, delete `modal-selection-item.css`. If they provide unique styles, merge them into `modals.css`.
3. Remove the `@import` lines for deleted files from `main.css`.

**Acceptance:** Three fewer CSS files. Same visual behavior. E2E tests pass.

---

### Task 1.4 — Merge `modal-setup.css` into `modals.css`

**Problem:** `modal-setup.css` is 39 lines of data-download progress bar styling. It is only used during the setup wizard, which lives inside a modal. It does not justify a separate file.

**Fix:** Append the contents of `modal-setup.css` to the end of `modals.css` under a clear comment header `/* ===== Setup / Data Configuration ===== */`. Delete `modal-setup.css`. Remove its `@import` from `main.css`.

**Acceptance:** One fewer CSS file. Setup wizard renders identically.

---

## Phase 2 — CSS Architecture: Eliminate Style Leakage

**Goal:** Page CSS files (`page-*.css`) should contain ONLY layout and positioning rules specific to that page. They must NOT define new component styles (buttons, form controls, badges, cards, tags) — those belong in component CSS files.

**The rule:** If a selector in a `page-*.css` file introduces styling for a reusable element (button, form control, badge, tag, card) that isn't purely a layout/positioning override scoped to that page, it must be moved to the appropriate component file.

### Task 2.1 — Audit and fix `page-build-class.css` (worst offender)

**Problem:** `page-build-class.css` (582 lines) defines new styles for generic component selectors that should not live in a page file:

| Selector | Problem | Move to |
|----------|---------|---------|
| `.btn-sm` (padding/font override) | Button variant styling | `buttons.css` — only if not already defined. If already defined, determine whether this is an override scoped to the build page or a new style. If scoped, prefix with `.class-selection .btn-sm`. If new, move. |
| `.form-control`, `.form-select` (color overrides) | Redefines form colors | Remove if identical to `forms.css`. If different, scope them under a page container: `.class-selection .form-control`. |
| `.form-label` | Redefines label styling | Same approach as above. |
| `.proficiency-item` | Duplicates `component-proficiency.css` | Remove if identical. If different, scope under `.class-selection .proficiency-item`. |
| `.source-toggle` | New component not in any component file | Move to `forms.css` or create a shared location visible to both page and modal contexts. |
| `.trait-tag`, `.feature-tag` | Generic tag components | See Task 2.5. |
| `.detail-section` | Shared between race and class pages | See Task 2.5. |

**Approach for each selector:**
1. Compare the selector's properties in `page-build-class.css` against the same selector in its canonical file (e.g., `forms.css`, `buttons.css`, `component-proficiency.css`).
2. If properties are **identical** → delete from page file (redundant).
3. If properties are **purely additive layout** (margin, padding, width, grid placement) → keep in page file but scope under the page's root container selector.
4. If properties define **new visual styling** (colors, borders, shadows, font) → move to the component file.

**Acceptance:** `page-build-class.css` contains only selectors prefixed with `.class-selection` or class-page-specific layout selectors. No bare `.form-control`, `.btn-sm`, etc.

---

### Task 2.2 — Audit and fix `page-build-race.css`

**Same approach as Task 2.1.** Key selectors to evaluate:

| Selector | Move to |
|----------|---------|
| `.form-select` override | Scope or remove |
| `.proficiency-item` | Remove if same as `component-proficiency.css` |
| `.detail-section` | See Task 2.5 |
| `.trait-tag` | See Task 2.5 |

**Acceptance:** Same criteria as Task 2.1.

---

### Task 2.3 — Audit and fix `page-details.css`

Key selectors to evaluate:

| Selector | Move to |
|----------|---------|
| `.form-control`, `.form-select` overrides | Scope under `.details-page` or remove |
| `.form-group` | Scope or move to `forms.css` |
| `.card-body` modifications | Scope under page container |

**Acceptance:** Same criteria as Task 2.1.

---

### Task 2.4 — Audit and fix `page-spells.css`

| Selector | Move to |
|----------|---------|
| `.btn-spell-remove` | Move to `buttons.css` as a named variant |

**Acceptance:** `page-spells.css` contains no bare button definitions.

---

### Task 2.5 — Extract shared selectors used across multiple page files

**Problem:** Several selectors are defined identically in multiple page files:

| Selector | Defined in |
|----------|-----------|
| `.trait-tag` | `page-build-background.css`, `page-build-race.css` |
| `.feature-tag` | `page-build-background.css`, `page-build-class.css` |
| `.detail-section` | `page-build-class.css`, `page-build-race.css` |
| `.source-toggle` | `page-build-class.css`, `modals.css` |

**Fix:** For each duplicated selector:
1. Compare definitions across files. Take the more complete version.
2. Move the canonical definition into one of:
   - An existing component file where it logically fits (e.g., `component-split-pane.css` for `.detail-section` if it's part of the split layout).
   - A new component file if none fits. Suggested: `component-tags.css` for `.trait-tag` and `.feature-tag`.
3. Delete the duplicate definitions from all page files.
4. If the new file is created, add its `@import` to `main.css` under `/* Reusable Components */`.

**Acceptance:** Each selector exists in exactly one file. No duplicate definitions.

---

## Phase 3 — CSS Architecture: Centralize Scattered Concerns

### Task 3.1 — Centralize z-index values

**Problem:** z-index values are hardcoded across multiple files with no central scale:
- `modals.css`: various values around 1050–1070
- `notification.css`: 11000
- `tooltip.css`: 9999

**Fix:** Add a z-index scale to `core-variables.css`:
```css
--z-dropdown: 1020;
--z-sticky: 1030;
--z-modal-backdrop: 1040;
--z-modal: 1050;
--z-tooltip: 9999;
--z-notification: 11000;
```

Then replace all hardcoded z-index values in `modals.css`, `notification.css`, and `tooltip.css` with `var(--z-*)` references.

**Acceptance:** No hardcoded z-index numeric values outside `core-variables.css`. All files use CSS variables.

---

### Task 3.2 — Centralize badge styles

**Problem:** Badge styles are fragmented across 5+ files with no canonical source.

**Fix:** Create `src/ui/styles/component-badge.css`. Audit all badge selectors across the codebase:
- `modals.css` — `.badge.source-badge`, review badges
- `component-proficiency.css` — `#proficienciesAccordion .badge`
- `component-character-card.css` — `.character-card .badge.bg-accent`
- `page-spells.css` — `.slot-badge`

Move shared/generic badge styling into the new file. Leave context-specific badge overrides (scoped under their parent selectors) in their original files.

Add `@import url("./component-badge.css");` to `main.css` under `/* Reusable Components */`.

**Acceptance:** Generic badge appearance defined once. Context-specific overrides remain scoped.

---

### Task 3.3 — Reduce `!important` usage

**Problem:** ~20+ `!important` declarations, primarily in `buttons.css` (active states, focus outlines), `modals.css` (form overrides), and `global.css` (text-muted overrides).

**Fix:** For each `!important`:
1. Determine if it's fighting Bootstrap specificity. If so, increase selector specificity instead (e.g., `body .text-muted` instead of `.text-muted !important`).
2. If it's fighting another custom rule, fix the cascade order or specificity.
3. Only `!important` that should remain: utility classes in `utilities.css` (this is the standard convention — utilities are meant to win).

**Acceptance:** `!important` usage reduced to utilities.css and cases with a clear documented reason.

---

### Task 3.4 — Hardcoded color values

**Problem:** Several files use hardcoded hex/rgb values instead of CSS variables:
- `global.css` (formerly in main.css): `#ffffff`, `#b0b0b0` in `.equipment-item` styles
- Scattered `rgba()` values for shadows

**Fix:** Replace hardcoded color values with existing CSS variables or add new variables to `core-variables.css` if no suitable variable exists. Do NOT change visual appearance — match the existing color to the closest variable or define a new one.

**Acceptance:** Zero hardcoded hex/rgb/rgba color values outside of `themes.css` and `core-variables.css` (where they are defined).

---

### Task 3.5 — Scrollbar styles defined twice

**Problem:** `scrollbars.css` defines webkit scrollbar styles. `global.css` (formerly main.css lines ~307-322) also defines `::-webkit-scrollbar*` styles. They may conflict.

**Fix:** Compare both. Keep the version in `scrollbars.css` as canonical. Remove the duplicate from `global.css`.

**Acceptance:** Scrollbar styles defined in exactly one file.

---

## Phase 4 — CSS Architecture: The `modals.css` Decomposition

**Goal:** Reduce `modals.css` from 2,128 lines to ~800-1,000 by extracting component-scoped styles.

### Task 4.1 — Analyze `modals.css` for extractable blocks

**Action (read-only):** Read `modals.css` fully and identify self-contained blocks that correspond to specific UI components rather than modal infrastructure. Document each block with its line range and proposed destination file.

Expected extractable blocks:
- Character creation wizard step styles
- Spell selection modal styles
- Equipment selection styles
- ASI (Ability Score Improvement) modal styles
- Level-up modal styles
- Item card/selection styles

Do NOT extract yet — just document the plan.

---

### Task 4.2 — Extract blocks per the plan from 4.1

For each block identified in 4.1:
1. If a corresponding component CSS file already exists (e.g., `component-ability-scores.css`), move the styles there.
2. If no file exists, decide whether the block is large enough (50+ lines) to justify a new file. If yes, create it.
3. Update `main.css` imports if new files are created.
4. Test visually that all modals still render correctly.

**Acceptance:** `modals.css` ≤ 1,200 lines. All extracted styles are in component files. E2E tests pass.

---

## Phase 5 — JS Architecture: Singleton & Pattern Consistency

### Task 5.1 — Standardize singleton export pattern in `src/app/`

**Problem:** 7 singletons in `src/app/` use two different patterns:

| Pattern A (4 files) | Pattern B (3 files) |
|---------------------|---------------------|
| `class XImpl { ... }` | `class X { ... }` |
| `export const X = new XImpl();` | `export const x = new X();` |
| PascalCase export | camelCase export |

Services (`src/services/`) consistently use: `export const xService = new XService();` (camelCase, no Impl).

**Fix:** Standardize `src/app/` to match the service pattern — no `Impl` suffix, camelCase exports:
- `AppState.js`: Keep `AppState` PascalCase (it's effectively a global namespace used everywhere — renaming it would be too disruptive). No change.
- `Modal.js`: Already `export const modal = ...`. No change.
- `ThemeManager.js`: Already `export const themeManager = ...`. No change.
- `TitlebarController.js`: Already `export const titlebarController = ...`. No change.
- `CharacterManager.js`: Rename class from `CharacterManagerImpl` to `CharacterManager`. BUT the export `CharacterManager` is PascalCase and widely imported. Changing the export name would require updating every import across the codebase. **Decision: Remove the `Impl` suffix from the internal class name only. Keep the export name as-is to avoid a disruptive rename.** Same for `NavigationController`, `PageHandler`.

**Specific changes:**
1. `CharacterManager.js`: Rename `class CharacterManagerImpl` → `class CharacterManagerInternal` or simply remove `Impl` if the export shadows the class name (check if this causes conflicts — in JS, the exported const shadows the class in module scope, so `class CharacterManager { } export const CharacterManager = ...` is a conflict). If so, use a `_` prefix: `class _CharacterManager`.
2. `NavigationController.js`: Same approach for `RouterImpl`, `PageLoaderImpl`, `NavigationControllerImpl`.
3. `PageHandler.js`: Same for `PageHandlerImpl`.

**Acceptance:** No `Impl` suffixed class names in the codebase. All tests pass.

---

### Task 5.2 — Standardize `BasePageController` to use `DOMCleanup`

**Problem:** `BasePageController.js` (23 lines) uses raw `EventBus.on()`/`EventBus.off()` for listener tracking. All UI components in `src/ui/components/` use `DOMCleanup`. This inconsistency means page controllers manage cleanup differently from the components they contain.

**Fix:** Refactor `BasePageController` to use `DOMCleanup.create()`:
1. Import `DOMCleanup` from `src/lib/DOMCleanup.js`.
2. In constructor/initialize, create `this._cleanup = DOMCleanup.create()`.
3. Replace `_trackListener(event, handler)` with `this._cleanup.onEvent(event, handler)`.
4. Replace the manual `cleanup()` loop with `this._cleanup.cleanup()`.
5. Update all subclasses if they call `_trackListener` directly.

**Acceptance:** `BasePageController` and all page controllers use `DOMCleanup` for event tracking. Tests pass.

---

## Phase 6 — JS Architecture: Fix Critical Workflow Bugs

### Task 6.1 — Fix `isLoadingCharacter` not reset on error

**File:** `src/app/CharacterManager.js` — `loadCharacter()` method.

**Problem:** `AppState.setState({ isLoadingCharacter: true })` is set but the `finally` block that resets it may not execute in all error paths, or the state may already have been consumed by UI code that sees `isLoadingCharacter: true` permanently.

**Fix:** Ensure `AppState.setState({ isLoadingCharacter: false })` is in the `finally` block and confirm it executes for all code paths. Verify the `finally` block exists and covers `return`, `throw`, and normal flow.

**Acceptance:** Write a unit test that verifies `isLoadingCharacter` is `false` after a failed load.

---

### Task 6.2 — Fix silent error swallowing

**Files & locations:**

1. `src/app/AppInitializer.js` — Find the empty `catch (error) { }` block (around the backdrop cleanup). Replace with `console.warn('[AppInitializer]', 'Backdrop cleanup failed:', error);`.

2. `src/app/CharacterSerializer.js` — Find the `catch` block that returns a default empty structure during proficiency serialization. Replace with logging: `console.warn('[CharacterSerializer]', 'Proficiency serialization failed:', error);` before returning the default.

**Acceptance:** No empty `catch {}` blocks anywhere in `src/app/`. Grep for `catch.*\{[\s]*\}` should return zero results.

---

### Task 6.3 — Fix save transaction integrity

**File:** `src/app/CharacterManager.js` — `saveCharacter()` method.

**Problem:** `CharacterSchema.touch()` mutates the character timestamp before the IPC save call. If the save fails, the timestamp is wrong.

**Fix:** Save the original `lastModified` value before calling `touch()`. In the `catch` block, restore the original value:
```javascript
const originalTimestamp = character.lastModified;
try {
    CharacterSchema.touch(character);
    // ... save ...
} catch (error) {
    character.lastModified = originalTimestamp;
    throw error;
}
```

**Acceptance:** If `saveCharacter()` throws, the character's `lastModified` is unchanged.

---

## Phase 7 — JS Architecture: Fix Memory Leaks

### Task 7.1 — Fix `NavigationController` document listener leak

**File:** `src/app/NavigationController.js`

**Problem:** A click listener is attached to `document` but never cleaned up.

**Fix:** Track the listener reference and remove it in the cleanup/dispose path of the navigation controller.

**Acceptance:** No stacking of document-level click listeners on repeated navigation initialization. Verify by adding a test or logging.

---

### Task 7.2 — Fix `HomePageController` listener and tooltip leaks

**File:** `src/app/pages/HomePageController.js`

**Problem:**
1. Event listeners added to the character list container on every `_renderCharacterList()` call without removing old ones.
2. Bootstrap tooltips created but never disposed on re-render.

**Fix:**
1. Before adding new container listeners, remove old ones (or use `DOMCleanup` to track them and clean up before re-render).
2. Before re-rendering the character list, dispose all existing Bootstrap tooltip instances: query all `[data-bs-toggle="tooltip"]` elements, get their tooltip instances, and call `.dispose()`.

**Acceptance:** Memory profiling shows no growing tooltip or listener count after 10 re-renders.

---

### Task 7.3 — Add `DataLoader` cache eviction

**File:** `src/lib/DataLoader.js`

**Problem:** `state.cache` grows unbounded.

**Fix:** Add a `clearCache()` export function that empties `state.cache`. Wire it to the `EVENTS.DATA_INVALIDATED` event in `AppInitializer.js` or wherever data refresh is triggered. Do NOT implement a complex LRU — a full clear on data invalidation is sufficient for a desktop app.

```javascript
export function clearCache() {
    state.cache = {};
    console.debug('[DataLoader]', 'Cache cleared');
}
```

**Acceptance:** `clearCache()` exists and is called when data source changes.

---

## Phase 8 — Security Fixes

### Task 8.1 — Replace `innerHTML` with safe DOM construction

**Files:**
1. `src/app/Modal.js` — `showDuplicateIdModal()` at the `messageElement.innerHTML = ...` assignment.
2. `src/app/pages/HomePageController.js` — character card template rendering.

**Fix for Modal.js:** Replace the innerHTML template with DOM node construction:
```javascript
// Instead of messageElement.innerHTML = `...${characterName}...`
messageElement.textContent = '';
// Build nodes programmatically using document.createElement + textContent
```

**Fix for HomePageController.js:** For the character card template, the character name and class/race labels should be set via `textContent` on individual elements after the template is inserted, rather than interpolated into the HTML string.

**Acceptance:** Grep for `innerHTML.*\$\{` in `src/app/` returns zero results. (Note: `innerHTML` with static strings like `'<option>None</option>'` is fine.)

---

### Task 8.2 — Add JSON size limit to IPC handlers

**Files:** `src/main/ipc/CharacterHandlers.js`, `src/main/ipc/DataHandlers.js`

**Fix:** Before `JSON.parse(characterData)`, check the byte length:
```javascript
const MAX_CHARACTER_SIZE = 10 * 1024 * 1024; // 10MB
if (typeof characterData === 'string' && Buffer.byteLength(characterData) > MAX_CHARACTER_SIZE) {
    return { success: false, error: 'Character data exceeds maximum size limit' };
}
```

Apply similar checks in `DataHandlers.js` for any user-supplied JSON payloads.

**Acceptance:** Oversized payloads are rejected with a clear error. Normal payloads continue to work.

---

## Phase 9 — Testing Gaps (High-Priority Services)

### Task 9.1 — Create unit tests for `ClassService`

**File to create:** `tests/unit/ClassService.test.js`

**Coverage targets:**
- Class loading and caching
- Subclass resolution
- Feature extraction (including pipe-delimited parsing)
- Spell slot calculation for classes
- Error cases (missing class, invalid source)

Follow existing test patterns from `tests/unit/BackgroundService.test.js` or `tests/unit/RaceService.test.js`.

---

### Task 9.2 — Create unit tests for `SpellService`

**File to create:** `tests/unit/SpellService.test.js`

**Coverage targets:**
- Spell lookup by name/source
- Spell filtering by class, level, school
- Class spell list loading
- Error cases

---

### Task 9.3 — Create unit tests for `CharacterValidationService`

**File to create:** `tests/unit/CharacterValidationService.test.js`

**Coverage targets:**
- Valid character passes validation
- Invalid characters fail with descriptive errors
- Edge cases (missing fields, wrong types, empty arrays)

---

### Task 9.4 — Create unit tests for `CharacterImportService`

**File to create:** `tests/unit/CharacterImportService.test.js`

**Coverage targets:**
- Clean import (no conflicts)
- Duplicate ID detection
- Conflict resolution (overwrite, keep both, cancel)

---

### Task 9.5 — Create unit tests for `FeatService`

**File to create:** `tests/unit/FeatService.test.js`

**Coverage targets:**
- Feat loading and lookup
- Source filtering
- Error cases

---

## Phase 10 — Map/Object Type Safety

### Task 10.1 — Document Map vs Object usage in Character

**Action (read-only first):** Audit `Character.js` constructor and identify every property that uses `Map` or `Set` at runtime. Cross-reference with `CharacterSerializer.js` to confirm which lose their type on round-trip.

Make a list:
- Property name
- Runtime type (Map/Set/Array/Object)
- Serialized type
- Deserialized type (what `new Character(data)` receives)
- Is there a mismatch?

---

### Task 10.2 — Fix Map/Object round-trip in `RehydrationService`

Based on findings from 10.1, ensure `RehydrationService.rehydrate()` (or `Character` constructor) properly converts plain objects back to Maps and arrays back to Sets where the runtime code expects them.

**Fix:** In the `Character` constructor, add conversion logic for affected properties:
```javascript
// Example for proficiencySources
if (data.proficiencySources && !(data.proficiencySources instanceof Map)) {
    this.proficiencySources = new Map(
        Object.entries(data.proficiencySources).map(([k, v]) => [k, new Map(Object.entries(v))])
    );
} else {
    this.proficiencySources = data.proficiencySources || new Map();
}
```

Apply the same pattern for each Map/Set property.

**Acceptance:** A character can be serialized, saved, loaded, deserialized, and all Map/Set operations still work. Write a test that does a full round-trip.

---

## Phase Summary

| Phase | Tasks | Focus | Risk |
|-------|-------|-------|------|
| 1 | 1.1–1.4 | CSS loading & junk drawer cleanup | Low — structural moves only |
| 2 | 2.1–2.5 | CSS style leakage elimination | Medium — must verify visual parity |
| 3 | 3.1–3.5 | CSS centralization (z-index, badges, !important, colors) | Low |
| 4 | 4.1–4.2 | modals.css decomposition | Medium — large file, careful extraction |
| 5 | 5.1–5.2 | JS singleton & DOMCleanup consistency | Low |
| 6 | 6.1–6.3 | Critical workflow bug fixes | Medium — state management edge cases |
| 7 | 7.1–7.3 | Memory leak fixes | Medium |
| 8 | 8.1–8.2 | Security hardening | Low |
| 9 | 9.1–9.5 | Test coverage for critical services | Low — additive only |
| 10 | 10.1–10.2 | Map/Object type safety | High — serialization changes |
