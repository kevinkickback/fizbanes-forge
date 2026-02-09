# E2E Test Plan — Fizbane's Forge

> Tracks planned, in-progress, and completed Playwright E2E tests.
> Run all: `npm run test:e2e` | Headed: `npx playwright test <file> --headed`

---

## Conventions

- Files live in `tests/e2e/` and match `*.spec.js`
- Import `{ test, expect }` from `../fixtures.js` (captures console/errors)
- Launch Electron with `electron.launch({ args: ['.'] })`
- Wait for `#pageContent` after `domcontentloaded` to confirm app ready
- Always close `electronApp` in a `finally` block
- Prefer `waitForSelector()` over `waitForTimeout()`
- Use `data-*` attribute selectors where available

---

## Progress Key

| Symbol | Meaning |
|--------|---------|
| :white_check_mark: | Done — test file merged and passing |
| :construction: | In progress — test file exists, not yet passing |
| :clipboard: | Planned — not yet started |

---

## 1. Application Lifecycle

**File:** `tests/e2e/app-lifecycle.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 1.1 | App launches and renderer window opens | :white_check_mark: |
| 1.2 | Loading modal appears during initialization | :white_check_mark: |
| 1.3 | Loading modal dismisses after services load | :white_check_mark: |
| 1.4 | Home page renders by default after startup | :white_check_mark: |
| 1.5 | Titlebar displays "Fizbane's Forge" branding | :white_check_mark: |
| 1.6 | Titlebar shows "No Character Loaded" initially | :white_check_mark: |
| 1.7 | No console errors during clean startup | :white_check_mark: |

---

## 2. Navigation

**File:** `tests/e2e/navigation.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 2.1 | Home nav button is active on startup | :white_check_mark: |
| 2.2 | Clicking Settings navigates to settings page | :white_check_mark: |
| 2.3 | Character-required pages (Build, Feats, Spells, Equipment, Details) are blocked without a character | :white_check_mark: |
| 2.4 | Character-required pages become accessible after character creation | :white_check_mark: |
| 2.5 | Active nav button updates on page change | :white_check_mark: |
| 2.6 | Build sub-nav items (Race, Class, Background, Ability Scores, Proficiencies) scroll to sections | :white_check_mark: |

---

## 3. Theme & Settings

**File:** `tests/e2e/theme-settings.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 3.1 | Theme toggle button switches between light and dark mode | :white_check_mark: |
| 3.2 | Theme persists across navigation (stays dark after page change) | :white_check_mark: |
| 3.3 | Settings page renders with expected controls | :white_check_mark: |

---

## 4. Character Creation (New Character Wizard)

**File:** `tests/e2e/character-creation.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 4.1 | "New Character" button opens the creation modal | :white_check_mark: |
| 4.2 | Wizard stepper shows all 7 steps (Basics → Review) | :white_check_mark: |
| 4.3 | Step 0 (Basics): can enter character name | :white_check_mark: |
| 4.4 | Step 1 (Rules): source selector is functional | :white_check_mark: |
| 4.5 | Step 2 (Race): race selector lists races and allows selection | :white_check_mark: |
| 4.6 | Step 3 (Class): class selector lists classes and allows selection | :white_check_mark: |
| 4.7 | Step 4 (Background): background selector lists options | :white_check_mark: |
| 4.8 | Step 5 (Ability Scores): score entry/assignment works | :white_check_mark: |
| 4.9 | Step 6 (Review): summary shows selected choices | :white_check_mark: |
| 4.10 | Back button returns to previous step | :white_check_mark: |
| 4.11 | Completing the wizard creates a character and navigates to Build | :white_check_mark: |
| 4.12 | Cancelling the wizard returns to Home with no character created | :white_check_mark: |
| 4.13 | Titlebar updates with character name after creation | :white_check_mark: |

---

## 5. Character Persistence (Save / Load / Delete)

**File:** `tests/e2e/character-persistence.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 5.1 | Save button exists and reflects saved state after creation | :white_check_mark: |
| 5.2 | Saved character appears in Home character list on relaunch | :clipboard: |
| 5.3 | Character card in Home shows name, race, class, level | :white_check_mark: |
| 5.4 | Clicking a character card loads that character | :white_check_mark: |
| 5.5 | Deleting a character removes it from the list | :white_check_mark: |
| 5.6 | Delete confirmation modal appears before deletion | :white_check_mark: |
| 5.7 | Unsaved changes indicator appears after modifying character | :clipboard: |

---

## 6. Build Page (Character Sheet)

**File:** `tests/e2e/build-page.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 6.1 | Build page renders all sections (Race, Class, Background, Ability Scores, Proficiencies) | :white_check_mark: |
| 6.2 | Race section displays selected race info | :white_check_mark: |
| 6.3 | Class section displays selected class info | :white_check_mark: |
| 6.4 | Background section displays selected background | :white_check_mark: |
| 6.5 | Ability scores section displays current scores | :white_check_mark: |
| 6.6 | Proficiencies section lists granted proficiencies | :white_check_mark: |

---

## 7. Feats Page

**File:** `tests/e2e/feats-page.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 7.1 | Feats page renders with feat list and controls | :white_check_mark: |
| 7.2 | Add feat shows warning when no feat slots available | :white_check_mark: |
| 7.3 | Feat selector modal opens when feat slots available (levels up to 4) | :white_check_mark: |
| 7.4 | Selecting a feat adds it to the list | :white_check_mark: |

---

## 8. Spells Page

**File:** `tests/e2e/spells-page.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 8.1 | Spells page renders for a character | :white_check_mark: |
| 8.2 | Spell list shows content or empty state | :white_check_mark: |
| 8.3 | Spell selector modal opens and lists spells | :white_check_mark: |
| 8.4 | Spellcasting info displays casting stats | :white_check_mark: |

---

## 9. Equipment Page

**File:** `tests/e2e/equipment-page.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 9.1 | Equipment page renders for a character | :white_check_mark: |
| 9.2 | Item selector modal opens and lists items | :white_check_mark: |
| 9.3 | Adding an item updates inventory display | :white_check_mark: |
| 9.4 | Removing an item updates inventory display | :white_check_mark: |

---

## 10. Details Page

**File:** `tests/e2e/details-page.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 10.1 | Details page renders with character info fields | :white_check_mark: |
| 10.2 | Editing fields updates character state | :white_check_mark: |

---

## 11. Level Up

**File:** `tests/e2e/level-up.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 11.1 | Level Up button visible in titlebar when character loaded | :white_check_mark: |
| 11.2 | Clicking Level Up opens the level-up modal | :white_check_mark: |
| 11.3 | Level-up modal shows class selection for multiclass option | :white_check_mark: |
| 11.4 | Completing level-up increments character level | :white_check_mark: |
| 11.5 | Level-up grants expected features (HP, spell slots, etc.) | :clipboard: |

---

## 12. Character Import

**File:** `tests/e2e/character-import.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 12.1 | Import button exists on Home page | :clipboard: |
| 12.2 | Import dialog accepts a valid character JSON file | :clipboard: |
| 12.3 | Imported character appears in character list | :clipboard: |

---

## 13. Notification System

**File:** `tests/e2e/notifications.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 13.1 | Notification center button opens the modal | :white_check_mark: |
| 13.2 | Toast appears on character save | :white_check_mark: |
| 13.3 | Clear notifications button empties the list | :white_check_mark: |

---

## 14. Error Handling & Edge Cases

**File:** `tests/e2e/error-handling.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 14.1 | Service failure banner shows when a service fails to load | :clipboard: |
| 14.2 | App remains usable after non-critical service failure | :clipboard: |
| 14.3 | Navigating to an invalid route shows error state | :clipboard: |

---

## 15. Sorting & Filtering (Home)

**File:** `tests/e2e/home-sorting.spec.js`

| # | Test case | Status |
|---|-----------|--------|
| 15.1 | Sort select is visible with all expected options | :white_check_mark: |
| 15.2 | Changing sort option updates the select value | :white_check_mark: |

---

## Implementation Priority

Tests are ordered by priority. Start from the top — each group builds on the previous.

1. **App Lifecycle** (1.x) — confirms app boots; gates everything else
2. **Navigation** (2.x) — confirms routing works
3. **Character Creation** (4.x) — core wizard flow, creates test data for later tests
4. **Character Persistence** (5.x) — save/load/delete round-trip
5. **Build Page** (6.x) — primary character sheet
6. **Level Up** (11.x) — progression flow
7. **Feats / Spells / Equipment / Details** (7–10.x) — secondary pages
8. **Theme & Settings** (3.x) — lower risk
9. **Notifications / Errors / Sorting** (13–15.x) — polish

---

## Notes

- All tests run against `FF_USE_BUNDLED_DATA=true` (bundled `src/data/`) to avoid external dependencies.
- Set `FF_DEBUG=true` in `.env` for richer console output during test debugging.
- Character files created during tests should be cleaned up in `afterAll` or `finally` blocks.
- The boilerplate in `tests/!boilerplate.spec.js` provides the standard Electron launch pattern.
