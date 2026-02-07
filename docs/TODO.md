# Fizbane's Forge — TODO

---

## 1. Show Current Ability Scores in ASI Choices

**Scope:** Only `src/ui/components/class-progression/ASIModal.js` and its rendering methods. No other modals or components.

**Problem:** When a player reaches an ASI level and opens the ASI modal, they only see the bonus being applied (e.g. `+2`) but not their current score. They have to remember or navigate back to check what their Strength is before deciding where to allocate points.

**Goal:** Display the current total score next to each ability button, and preview what the score will become if selected (e.g. `Strength: 14 → 16`).

### File to Modify

| File | Purpose |
|---|---|
| `src/ui/components/class-progression/ASIModal.js` | Renders the 6 ability buttons and handles ASI selection |

### Do NOT Modify
- `src/services/AbilityScoreService.js` — only import and call it, don't change it.
- Any other modal, card, or component.

### Key Context

**ASIModal.js structure:**
- Class: `ASIModal` (line 7)
- Constructor takes `(level, currentASI = {})` — currently has NO reference to ability score data (line 8)
- `_renderAbilityBoxes()` (line 155) iterates `ABILITY_ABBREVIATIONS` (6 abilities: str, dex, con, int, wis, cha) and renders a button for each with just the ability name and bonus display
- `_getAbilityBonus(ability)` (line 174) returns 0, 1, or 2 based on current selection state
- `_updateDisplay()` (line 300) re-renders ability boxes and summary when user clicks — this is where the preview must update
- Two ASI modes: `plus2` (one ability +2) and `plus1` (two abilities +1 each)

**AbilityScoreService API (import from `src/services/AbilityScoreService.js`):**
- `import { abilityScoreService } from '../../../services/AbilityScoreService.js'`
- `abilityScoreService.getTotalScore(ability)` — returns the fully computed score (base + racial + all bonuses) as a number
- `abilityScoreService.getModifierString(ability)` — returns modifier string like `"+2"` or `"-1"`
- The service reads from the current character in AppState, so it always reflects the latest state

### Step-by-Step Implementation

#### Step 1: Add import
At the top of `ASIModal.js` (after the existing imports around line 5), add:
```js
import { abilityScoreService } from '../../../services/AbilityScoreService.js';
```

#### Step 2: Update `_renderAbilityBoxes()` (line ~155)
Currently each button renders:
```html
<strong>Strength</strong>
<div class="bonus-display">+2</div>   <!-- or non-breaking space if unselected -->
```

Change to show current score and a preview of the new score when selected:
```js
_renderAbilityBoxes() {
    return ABILITY_ABBREVIATIONS.map((ability) => {
        const isSelected = this._selectedAbilities.ability1 === ability
            || this._selectedAbilities.ability2 === ability;
        const bonus = this._getAbilityBonus(ability);
        const currentScore = abilityScoreService.getTotalScore(ability);
        const hasScore = typeof currentScore === 'number' && !isNaN(currentScore);
        const scoreDisplay = hasScore ? currentScore : '—';
        const previewDisplay = (hasScore && bonus)
            ? `<span class="text-success">→ ${currentScore + bonus}</span>`
            : '';

        return `
            <div class="col-4 col-md-4">
                <button type="button"
                    class="btn w-100 ability-select-btn ${isSelected ? 'active' : ''}"
                    data-ability="${ability}">
                    <strong>${attAbvToFull(ability)}</strong>
                    <div class="small text-muted">${scoreDisplay}</div>
                    <div class="bonus-display">
                        ${bonus ? `+${bonus} ${previewDisplay}` : '\u00A0'}
                    </div>
                </button>
            </div>
        `;
    }).join('');
}
```

Key points:
- `currentScore` comes from `abilityScoreService.getTotalScore()` which includes racial/all bonuses
- When no score data exists (e.g. during creation before scores are set), show `—`
- Preview line (`→ 16`) only appears when the ability has a bonus applied
- The `_updateDisplay()` method already re-renders boxes on every click (line 300), so previews update automatically as the user toggles selections

#### Step 3: Update selection summary (optional enhancement)
In `_renderSelectionSummary()` (line ~186), the success alert currently shows e.g. `Strength +2`. Optionally enhance to show `Strength 14 → 16` using the same `abilityScoreService.getTotalScore()` call. This is a nice-to-have, not required.

### What NOT to Do
- Do NOT pass ability scores through the constructor — use the service singleton directly.
- Do NOT modify `AbilityScoreService.js`.
- Do NOT change how `_handleAbilityClick()` or `_handleApply()` work — only the display is changing.
- Do NOT modify any styling in CSS files — the `small text-muted` and `text-success` Bootstrap utility classes are sufficient.

### Testing
- Create a character with ability scores assigned, level them to an ASI level (4, 8, 12, etc.), and open the ASI modal.
- Verify each ability button shows the current total score (e.g. `Strength 14`).
- Click an ability in +2 mode — verify the preview shows `+2 → 16`.
- Switch to +1/+1 mode and select two abilities — verify both show `+1 → 15` (or whatever the math yields).
- Toggle selections — verify previews update immediately on all 6 buttons.
- Verify scores reflect racial bonuses and other modifiers, not just base scores.
- If a character has no ability scores set yet, verify `—` appears instead of `NaN` or `undefined`.

---

## 2. Show Unavailable Class Feature Options as Greyed Out (Instead of Hidden)

**Scope:** This applies **only** to `ClassFeatureSelector.js` — the modal used for class feature choices like Eldritch Invocations (`EI`), Metamagic (`MM`), Fighting Styles (`FS`), Artificer Infusions (`AI`), Battle Maneuvers (`MV:B`), and Monk Maneuvers (`MV:M`). It does **NOT** apply to subclass selection, spell selection (`ClassSpellSelector`), feat/ASI selection (`ClassFeatSelector`), or any other selection modal.

**Problem:** `ClassFeatureSelector.js` currently **hides** options the character doesn't qualify for by returning `false` from the `matchItem` callback (line ~152). This means players never see locked options and don't know what exists or what they need to unlock them. A generic `prerequisiteNote` banner tries to explain, but it's vague (e.g. "Only fighting styles you qualify for are shown.").

**Goal:** Always show all class feature options in the list. Grey out (block) those the character doesn't qualify for. When a greyed-out option is clicked, show a notification explaining the specific unmet prerequisites. Remove the generic banner.

### Files to Modify

| File | Purpose |
|---|---|
| `src/services/OptionalFeatureService.js` | Change `meetsPrerequisites()` to return `{ met, reasons[] }` |
| `src/ui/components/class-progression/ClassFeatureSelector.js` | Move prereq check from `matchItem` → `canSelectItem`; use reasons in `onSelectBlocked` |

### Do NOT Modify
- `src/ui/components/selection/UniversalSelectionModal.js` — already has full support for `canSelectItem`, `onSelectBlocked`, `.blocked` CSS class, and `opacity: 0.6` rendering. No changes needed.
- `ClassSpellSelector.js`, `ClassFeatSelector.js`, `FeatSelectionModal.js`, subclass selection, or any other modal.

### Step-by-Step Implementation

#### Step 1: Enhance `OptionalFeatureService.meetsPrerequisites()`

Current signature (line 55 of `OptionalFeatureService.js`):
```js
meetsPrerequisites(feature, character, className = null) → boolean
```

Change to return `{ met: boolean, reasons: string[] }`. The method currently checks 4 prerequisite types in a `for` loop over `feature.prerequisite[]`:
- `prereq.level` — class level requirement
- `prereq.spell` — required known spells
- `prereq.pact` — Pact Boon requirement (e.g. Pact of the Blade)
- `prereq.patron` — Patron requirement

For each failed check, instead of `return false`, push a human-readable reason string to a `reasons` array and continue. At the end, return `{ met: reasons.length === 0, reasons }`.

Example reasons:
- Level: `"Requires ${className} level ${requiredLevel}"`
- Spell: `"Requires spell: ${spellName}"`
- Pact: `"Requires ${prereq.pact}"`
- Patron: `"Requires patron: ${prereq.patron}"`

#### Step 2: Update `ClassFeatureSelector.show()` in `ClassFeatureSelector.js`

**2a. Update `prerequisiteChecker` (around line 107):**
Change it to call the updated `meetsPrerequisites()` and return the full result object instead of just a boolean:
```js
const prerequisiteChecker = (feature) => {
    if (!feature.prerequisite) return { met: true, reasons: [] };
    // ...existing character.features swap logic stays the same...
    const result = optionalFeatureService.meetsPrerequisites(feature, character, this.className);
    // ...restore character.features...
    return result;
};
```

**2b. Remove prerequisite check from `matchItem` (around line 152):**
Delete the line `if (!prerequisiteChecker(item)) return false;` from the `matchItem` callback. `matchItem` should only handle search term filtering:
```js
matchItem: (item, state) => {
    if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        return item.name?.toLowerCase().includes(term) || item.source?.toLowerCase().includes(term);
    }
    return true;
},
```

**2c. Update `canSelectItem` (around line 159):**
Add the prerequisite check. The item should be blocked if it fails prerequisites OR if the selection cap is reached:
```js
canSelectItem: (item, state) => {
    const prereqResult = prerequisiteChecker(item);
    if (!prereqResult.met) return false;
    const isAtCap = this.maxSelections !== null && state.selectedIds.size >= this.maxSelections;
    return !isAtCap;
},
```

**2d. Update `onSelectBlocked` (around line 164):**
Differentiate between "blocked by prerequisites" and "blocked by selection cap":
```js
onSelectBlocked: (item) => {
    const prereqResult = prerequisiteChecker(item);
    if (!prereqResult.met) {
        showNotification(prereqResult.reasons.join('. '), 'info');
    } else {
        const label = this._getFeatureTypeName();
        showNotification(`${label} selection limit reached. Deselect a choice to add another.`, 'warning');
    }
},
```

**2e. Remove `prerequisiteNote`:**  
Delete the `prerequisiteNote: this._getPrerequisiteNote(),` line from the config object (around line 148). This removes the generic blue info banner since items now self-document their availability through the greyed-out treatment and click notifications. Optionally delete the `_getPrerequisiteNote()` method entirely if no other code references it.

### What NOT to Do
- Do NOT modify `UniversalSelectionModal.js` — it already handles `.blocked` rendering, click prevention, and `onSelectBlocked` callbacks correctly.
- Do NOT change how subclass selection, spell selection, or feat selection modals work.
- Do NOT add tooltips or extra CSS — the existing `opacity: 0.6` + `.blocked` class treatment in `UniversalSelectionModal` is sufficient.
- Do NOT break the existing `meetsPrerequisites()` return contract for any other callers — check if any other code calls `meetsPrerequisites()` and expects a boolean. If so, those call sites need to be updated to check `.met` on the returned object, or add a convenience wrapper.

### Verifying Other Callers
Before changing the return type of `meetsPrerequisites()`, search the codebase for all call sites:
```
grep -r "meetsPrerequisites" src/
```
Update any callers that expect a boolean to use `.met` instead. The only known caller is `ClassFeatureSelector.js` but verify this.

### Testing
- Open Eldritch Invocation selection at level 2 with no Pact Boon — verify invocations requiring a pact boon appear greyed out (opacity 0.6) but still visible in the list.
- Click a greyed-out invocation — verify a notification appears with the specific reason (e.g. "Requires Pact of the Blade").
- Verify invocations with level prerequisites show the appropriate level reason.
- Verify the generic blue info banner is gone.
- Open Fighting Style, Metamagic, and Artificer Infusion selectors — verify the same greyed-out behavior works for all `ClassFeatureSelector` feature types.
- Open subclass selection, spell selection, and feat selection modals — verify they are **unchanged** (no greyed-out items, no behavior differences).

---

## 3. Refresh Home Page Character Card After Level-Up

**Scope:** Only `src/app/PageHandler.js`, specifically the `initializeHomePage()` method. No other files.

**Problem:** When on the home page and using the level-up modal, the character card continues to show the old level and class info. The user must navigate away and back to see the updated card.

**Goal:** The home page character card grid should automatically refresh when a character is updated (leveled up, multiclassed, etc.).

### File to Modify

| File | Purpose |
|---|---|
| `src/app/PageHandler.js` | Add `CHARACTER_UPDATED` listener in `initializeHomePage()` |

### Do NOT Modify
- `src/ui/components/level-up/LevelUpModal.js` — it already emits `EVENTS.CHARACTER_UPDATED` correctly after level changes.
- `src/lib/EventBus.js` — the `CHARACTER_UPDATED` event is already defined.
- Any other page initializer or component.

### Key Context

**`PageHandler.initializeHomePage()`** (line ~117 of `PageHandler.js`):
- Already sets up two EventBus listeners with the exact pattern to follow:
  1. `CHARACTER_SELECTED` handler (line ~159–166): stored as `this._homeCharacterSelectedHandler`, removed with `eventBus.off()` before re-adding
  2. `CHARACTER_CREATED` handler (line ~173–180): stored as `this._homeCharacterCreatedHandler`, reloads character list and re-renders
- `renderCharacterList(characters)` renders the card grid into `#characterList`
- `updateCharacterCardSelection(characterId)` (line ~193) applies `.selected` class to the active card
- `CharacterManager.loadCharacterList()` reloads from storage

### Step-by-Step Implementation

#### Step 1: Add `CHARACTER_UPDATED` handler (inside `initializeHomePage()`)

Add the following block **after** the `CHARACTER_CREATED` handler block (after line ~180) and **before** the closing `catch`. Follow the exact same pattern as the existing handlers:

```js
// Remove old handler if it exists before adding new one
if (this._homeCharacterUpdatedHandler) {
    eventBus.off(EVENTS.CHARACTER_UPDATED, this._homeCharacterUpdatedHandler);
}

this._homeCharacterUpdatedHandler = async () => {
    const reloadCharacters = await CharacterManager.loadCharacterList();
    await this.renderCharacterList(reloadCharacters);
    // Preserve selection state after re-render
    const currentCharacter = CharacterManager.getCurrentCharacter();
    if (currentCharacter?.id) {
        this.updateCharacterCardSelection(currentCharacter.id);
    }
};

eventBus.on(EVENTS.CHARACTER_UPDATED, this._homeCharacterUpdatedHandler);
```

Key points:
- Remove old handler first (prevents stacking if `initializeHomePage()` is called multiple times)
- After re-render, call `updateCharacterCardSelection()` to preserve the `.selected` visual state on the active card
- Uses `CharacterManager.getCurrentCharacter()` which is already imported in PageHandler

#### Step 2: Verify `EVENTS` import

Check that `EVENTS` from `EventBus.js` is already imported at the top of `PageHandler.js`. It should be — the file already uses `EVENTS.CHARACTER_SELECTED` and `EVENTS.CHARACTER_CREATED`. If not, add:
```js
import { eventBus, EVENTS } from '../lib/EventBus.js';
```

### What NOT to Do
- Do NOT add debouncing — the level-up modal emits `CHARACTER_UPDATED` only once on completion, not during intermediate steps.
- Do NOT modify `LevelUpModal.js` — it already emits the correct event.
- Do NOT add new events to `EventBus.js` — `CHARACTER_UPDATED` already exists and is the correct event to listen for.
- Do NOT add cleanup logic on page navigation — the `if (this._homeCharacterUpdatedHandler)` guard at the top of the block handles re-initialization. The EventBus handler will be garbage-collected when PageHandler is re-initialized on next navigation to home.

### Testing
- On the home page, select a character and open the level-up modal.
- Add a level → confirm the level-up → verify the card immediately reflects the new level/class without navigating away.
- Verify the card remains visually selected (has `.selected` class) after the refresh.
- Navigate to another page and back to home — verify the card shows correct info (not doubled or stale).
- Create a new character → verify the existing `CHARACTER_CREATED` handler still works (the new handler should not interfere).

---

## 4. Emit `CHARACTER_UPDATED` on Subrace Change

**Scope:** Only `src/ui/components/race/RaceCard.js`. No other files.

**Problem:** On the build page, changing the subrace dropdown within the race card calls `_updateCharacterRace()` which dispatches DOM `CustomEvent`s but does **not** emit `EVENTS.CHARACTER_UPDATED` through the EventBus. This means the unsaved changes indicator doesn't activate, and other components (like the ability score card) don't know to refresh.

**Goal:** Changing a subrace should emit `CHARACTER_UPDATED` via EventBus so the unsaved changes indicator appears and dependent components (ability scores, proficiencies) react.

### File to Modify

| File | Purpose |
|---|---|
| `src/ui/components/race/RaceCard.js` | Add `CHARACTER_UPDATED` emit at end of `_updateCharacterRace()` |

### Do NOT Modify
- `src/lib/EventBus.js` — `CHARACTER_UPDATED` and `SUBRACE_SELECTED` are already defined.
- Any other component, service, or page.

### Key Context

**How race selection currently works in `RaceCard.js`:**

1. **Race item click handler** (around line 340–378): When a user clicks a race in the list, this handler:
   - Calls `this._updateCharacterRace(race, subraceData)` to update character data
   - Then explicitly emits `eventBus.emit(EVENTS.CHARACTER_UPDATED, { character: ... })` at line 375
   - This works correctly — the unsaved indicator activates on race selection

2. **Subrace dropdown change handler** (around line 290–310): When a user changes the subrace dropdown, this handler:
   - Calls `this._updateCharacterRace(race, subraceData)` to update character data
   - Does **NOT** emit `CHARACTER_UPDATED` — this is the bug

3. **`_updateCharacterRace()`** (line ~675): Performs thorough cleanup and update of race data, then dispatches DOM `CustomEvent`s (`raceChanged`, `characterChanged`, `abilityScoresChanged`, `updateUI`). These are DOM events, NOT EventBus events — they only reach DOM listeners, not the app-wide EventBus system that the unsaved indicator and other components listen to.

### Step-by-Step Implementation

#### Option A (Preferred): Move the emit INTO `_updateCharacterRace()`

This is cleaner because it ensures every code path that changes the race emits the event. Add the following at the **very end** of the `if (hasChanged)` block in `_updateCharacterRace()`, after the `setTimeout` block that dispatches `characterChanged`/`abilityScoresChanged`/`updateUI` (around line 780):

```js
// Notify EventBus so unsaved indicator and cross-component listeners react
eventBus.emit(EVENTS.CHARACTER_UPDATED, {
    character: CharacterManager.getCurrentCharacter(),
});
```

Then **remove** the duplicate emit from the race item click handler (line ~375), since `_updateCharacterRace()` now handles it. This prevents double-emission.

#### Option B (Simpler but less clean): Add emit to subrace handler only

In the subrace dropdown `change` handler (around line 290–310), add the emit after the `_updateCharacterRace()` call:
```js
this._updateCharacterRace(race, subraceData);
eventBus.emit(EVENTS.CHARACTER_UPDATED, {
    character: CharacterManager.getCurrentCharacter(),
});
```
This leaves the race click handler emit intact (line 375) and adds a parallel one for subrace changes. Simpler but creates two separate emit sites.

#### Verification: No duplicate emissions

If using Option A, verify with:
```
grep -n "CHARACTER_UPDATED" src/ui/components/race/RaceCard.js
```
Should find exactly ONE emit (inside `_updateCharacterRace()`). If using Option B, should find exactly TWO (one in click handler, one in dropdown handler).

Also verify that `eventBus` and `EVENTS` are already imported at the top of `RaceCard.js`. They should be — the file already uses `eventBus.emit(EVENTS.CHARACTER_UPDATED, ...)` in the click handler (line 375).

### What NOT to Do
- Do NOT emit `SUBRACE_SELECTED` — it's defined but unused, and emitting it would require consumers to be added. Defer this.
- Do NOT change the DOM `CustomEvent` dispatches (`raceChanged`, `characterChanged`, etc.) — they serve different purposes for DOM-level listeners.
- Do NOT modify EventBus.js or any other file.

### Testing
- On the build page, select a race with subraces (e.g. Elf).
- Change the subrace dropdown (e.g. High Elf → Wood Elf) — verify the unsaved changes indicator (dot/asterisk in titlebar) appears immediately.
- Verify ability score bonuses update if the subrace has different racial modifiers.
- Save the character — verify the indicator clears.
- Select a different race entirely (not just subrace) — verify the unsaved indicator still works as before (no regression).
- Verify no double-emission: check the browser console for duplicate `CHARACTER_UPDATED` events (should only fire once per race/subrace change).

---

## 5. Standardize File/Folder Naming and Architecture

**Scope:** File and class renames across `src/ui/components/`, plus import updates in all consuming files and documentation updates in `docs/` and `.github/`.

**Problem:** File naming conventions across `src/ui/components/` are inconsistent. Modal files use a mix of `*SelectionModal`, `*Selector`, and `*Modal` suffixes. Card files sometimes include `Selection` in the name. The base modal is called `UniversalSelectionModal` which doesn't communicate its role as a base class.

**Goal:** Establish and apply a consistent naming convention:
- **Selector modals:** `[Domain]SelectorModal.js` — modal that lets the user pick something
- **Cards:** `[Domain]Card.js` — build page section component
- **Base classes:** `Base[Purpose].js` — shared infrastructure

### Rename Table

All paths relative to `src/ui/components/`.

| # | Current File | New File | Current Class | New Class |
|---|---|---|---|---|
| 1 | `selection/UniversalSelectionModal.js` | `selection/BaseSelectorModal.js` | `UniversalSelectionModal` | `BaseSelectorModal` |
| 2 | `feats/FeatSelectionModal.js` | `feats/FeatSelectorModal.js` | `FeatSelectionModal` | `FeatSelectorModal` |
| 3 | `equipment/EquipmentSelectionModal.js` | `equipment/ItemSelectorModal.js` | `EquipmentSelectionModal` | `ItemSelectorModal` |
| 4 | `spells/SpellSelectionModal.js` | `spells/SpellSelectorModal.js` | `SpellSelectionModal` | `SpellSelectorModal` |
| 5 | `spells/PreparedSpellSelectionModal.js` | `spells/PreparedSpellSelectorModal.js` | `PreparedSpellSelectionModal` | `PreparedSpellSelectorModal` |
| 6 | `class-progression/ASIModal.js` | `class-progression/AbilityScoreSelectorModal.js` | `ASIModal` | `AbilityScoreSelectorModal` |
| 7 | `class-progression/ClassFeatureSelector.js` | `class-progression/ClassFeatureSelectorModal.js` | `ClassFeatureSelector` | `ClassFeatureSelectorModal` |
| 8 | `class-progression/ClassFeatSelector.js` | `class-progression/ClassFeatSelectorModal.js` | `ClassFeatSelector` | `ClassFeatSelectorModal` |
| 9 | `class-progression/ClassSpellSelector.js` | `class-progression/ClassSpellSelectorModal.js` | `ClassSpellSelector` | `ClassSpellSelectorModal` |
| 10 | `class/ClassSelectionCard.js` | `class/ClassCard.js` | `ClassCard` (already) | `ClassCard` (no change) |

### Complete Reference Map (All Files That Need Import/Reference Updates)

For each renamed file, here are ALL files that import or reference it. Update every one.

#### Rename #1: `UniversalSelectionModal` → `BaseSelectorModal`
**Also exports:** `formatCounter`, `formatCategoryCounters` — these named exports must continue to work from the new file.

| Consumer File | What to Update |
|---|---|
| `src/ui/components/feats/FeatSelectionModal.js` (line ~12) | Import path + class name |
| `src/ui/components/spells/SpellSelectionModal.js` (line ~12-14) | Import path + class name + `formatCategoryCounters` |
| `src/ui/components/spells/PreparedSpellSelectionModal.js` (line ~9) | Import path + class name + `formatCategoryCounters` |
| `src/ui/components/equipment/EquipmentSelectionModal.js` (line ~8) | Import path + class name |
| `src/ui/components/class-progression/ClassSpellSelector.js` (line ~12-13) | Import path + class name + `formatCategoryCounters` |
| `src/ui/components/class-progression/ClassFeatureSelector.js` (line ~8-10) | Import path + class name + `formatCounter` |
| `src/ui/components/class-progression/ClassFeatSelector.js` (line ~7-9) | Import path + class name |
| `src/ui/styles/modals.css` (line ~217, ~2434) | CSS selector `#universalSelectionModal` — only change if the JS `modalId` changes |
| `.github/copilot-instructions.md` (lines ~20-21, ~107) | Documentation references |
| `docs/CODEBASE_ARCHITECTURE.md` (line ~167) | Documentation references |

**Inside the file itself:** Update class name on line 26, and log tags `[UniversalSelectionModal]` on lines ~198, ~204, ~240 to `[BaseSelectorModal]`.

#### Rename #2: `FeatSelectionModal` → `FeatSelectorModal`
| Consumer File | What to Update |
|---|---|
| `src/app/PageHandler.js` (line ~12-14) | Import path + class name |
| `src/app/PageHandler.js` (line ~811) | `new FeatSelectionModal()` → `new FeatSelectorModal()` |
| `src/ui/styles/modals.css` (line ~1487, ~1500) | CSS `#featSelectionModal` — only change if modalId changes |

**Inside the file itself:** Update class name on line 14, log tags on lines ~66, ~239, ~411.

#### Rename #3: `EquipmentSelectionModal` → `ItemSelectorModal`
| Consumer File | What to Update |
|---|---|
| `src/ui/components/equipment/EquipmentManager.js` (line ~8) | Import path + class name |
| `src/ui/components/equipment/EquipmentManager.js` (line ~13) | Property name `this.equipmentSelectionModal` → `this.itemSelectorModal` |
| `src/ui/components/equipment/EquipmentManager.js` (lines ~284-288) | All references to the property |
| `src/ui/styles/modals.css` (lines ~209, ~1510-1522) | CSS `#equipmentSelectionModal` — only change if modalId changes |

**Inside the file itself:** Update class name on line 10, modalId string on line ~38, log tag on line ~349.

#### Rename #4: `SpellSelectionModal` → `SpellSelectorModal`
| Consumer File | What to Update |
|---|---|
| `src/ui/components/spells/SpellManager.js` (line ~9) | Import path + class name |
| `src/ui/components/spells/SpellManager.js` (lines ~14, ~382-393) | Property name + instantiation |
| `src/ui/styles/modals.css` (lines ~201, ~1301-1308, ~2689-2704) | CSS selectors |

**Inside the file itself:** Update class name on line 16, DOM id strings on lines ~60, ~149.

#### Rename #5: `PreparedSpellSelectionModal` → `PreparedSpellSelectorModal`
| Consumer File | What to Update |
|---|---|
| `src/ui/components/spells/SpellManager.js` (line ~8) | Import path + class name |
| `src/ui/components/spells/SpellManager.js` (lines ~15, ~420-427) | Property name + instantiation |

**Inside the file itself:** Update class name on line 11, DOM id strings on lines ~58, ~124.

#### Rename #6: `ASIModal` → `AbilityScoreSelectorModal`
| Consumer File | What to Update |
|---|---|
| `src/ui/components/class/ClassSelectionCard.js` (lines ~2220-2221) | Dynamic import path + comment |
| `src/ui/components/class/ClassSelectionCard.js` (line ~2235) | `new ASIModal(…)` → `new AbilityScoreSelectorModal(…)` |

**Inside the file itself:** Update class name on line 7, DOM id strings `asiModal`/`asiModalLabel`/`asiModalBody` on lines ~30, ~47, ~51, ~54, ~67, ~88 (keep DOM ids as-is to avoid CSS breakage, OR update them too and update any CSS targeting `#asiModal`).

#### Rename #7: `ClassFeatureSelector` → `ClassFeatureSelectorModal`
| Consumer File | What to Update |
|---|---|
| `src/ui/components/class/ClassSelectionCard.js` (line ~24) | Import path + class name |
| `src/ui/components/class/ClassSelectionCard.js` (lines ~2350, ~2441) | `new ClassFeatureSelector(…)` → `new ClassFeatureSelectorModal(…)` |

**Inside the file itself:** Update class name on line 12, fix mismatched log tag `[LevelUpFeatureSelector]` on line ~194 to `[ClassFeatureSelectorModal]`.

#### Rename #8: `ClassFeatSelector` → `ClassFeatSelectorModal`
| Consumer File | What to Update |
|---|---|
| `src/ui/components/class/ClassSelectionCard.js` (lines ~2168-2169) | Dynamic import path |
| `src/ui/components/class/ClassSelectionCard.js` (line ~2186) | `new ClassFeatSelector(…)` → `new ClassFeatSelectorModal(…)` |

**Inside the file itself:** Update class name on line 13, fix mismatched log tag `[LevelUpFeatSelector]` on line ~194 to `[ClassFeatSelectorModal]`.

#### Rename #9: `ClassSpellSelector` → `ClassSpellSelectorModal`
| Consumer File | What to Update |
|---|---|
| `src/ui/components/class/ClassSelectionCard.js` (line ~25) | Import path + class name |
| `src/ui/components/class/ClassSelectionCard.js` (line ~916) | `new ClassSpellSelector(…)` → `new ClassSpellSelectorModal(…)` |

**Inside the file itself:** Update class name on line 15, fix mismatched log tag `[LevelUpSpellSelector]` on line ~360 to `[ClassSpellSelectorModal]`.

#### Rename #10: `ClassSelectionCard.js` → `ClassCard.js` (file only)
The class is already named `ClassCard` (line 27), so only the file needs renaming.

| Consumer File | What to Update |
|---|---|
| `src/app/PageHandler.js` (line ~9) | Import path only (class name `ClassCard` stays the same) |
| `src/ui/components/proficiencies/ProficiencyCard.js` (line ~520) | Comment reference |

### Step-by-Step Implementation

**Execute in this exact order to avoid broken intermediate states:**

#### Phase 1: Rename base class first
1. Rename file `UniversalSelectionModal.js` → `BaseSelectorModal.js`
2. Update class name and log tags inside the file
3. Update ALL 7 consumer imports listed above for Rename #1

#### Phase 2: Rename leaf modals (order doesn't matter within this phase)
4. Rename each of #2 through #9 — for each one:
   a. Rename the file (e.g. `mv FeatSelectionModal.js FeatSelectorModal.js`)
   b. Update the class name inside the file
   c. Update log tags inside the file
   d. Update all consumer imports listed in the reference map above

#### Phase 3: Rename card file
5. Rename `ClassSelectionCard.js` → `ClassCard.js`
6. Update import path in `PageHandler.js`

#### Phase 4: Update documentation
7. Update `docs/CODEBASE_ARCHITECTURE.md` — search and replace all old names
8. Update `.github/copilot-instructions.md` — replace `UniversalSelectionModal` with `BaseSelectorModal`
9. Update `docs/TODO.md` — update any references in other TODO items

#### Phase 5: Verify
10. Run verification grep to catch any remaining references:
```bash
grep -rn "UniversalSelectionModal\|FeatSelectionModal\|EquipmentSelectionModal\|SpellSelectionModal\|PreparedSpellSelectionModal\|ASIModal\|ClassFeatureSelector[^M]\|ClassFeatSelector[^M]\|ClassSpellSelector[^M]\|ClassSelectionCard" src/ docs/ .github/
```
(The `[^M]` prevents matching the new `*SelectorModal` names.)

11. Run `npx playwright test` to catch any runtime breakage.

### What NOT to Do
- Do NOT change any business logic, event handling, or rendering — this is a pure rename refactor.
- Do NOT rename CSS `id` selectors in `modals.css` unless you also update the corresponding `modalId` strings in JS. The `modalId` values (e.g. `universalSelectionModal`, `featSelectionModal`) are runtime DOM ids — renaming them requires updating both JS and CSS in lockstep. It's safer to leave them as-is for now.
- Do NOT rename `FilterBuilder.js`, `ClassSwitcher.js`, or any service files — those are already consistently named.
- Do NOT rename `CharacterCreationModal.js` or `LevelUpModal.js` — these are not selector modals and follow a different naming pattern.
- Do NOT move files between folders — only rename within the same folder.

### Risk Mitigation
- This is a high-touch refactor affecting ~15+ files. Do it in a **single commit** to keep git history clean.
- After each phase, verify the app still loads by running `npm run debug`.
- If any grep results remain after Phase 5, fix them before committing.