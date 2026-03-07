# Fizbane's Forge — AI Remediation Plan

Actionable tasks derived from [AI_Codebase_Audit.md](AI_Codebase_Audit.md). Each task is self-contained, references exact files/lines, and is written for an AI agent to execute without ambiguity.

**Scope exclusion:** Tests are out of scope for this plan.

---

## Table of Contents

- [Phase 1 — Inline Style Violations](#phase-1--inline-style-violations)
- [Phase 2 — Hardcoded Constants → Data-Driven](#phase-2--hardcoded-constants--data-driven)
- [Phase 3 — Error Handling Standardization](#phase-3--error-handling-standardization)
- [Phase 4 — Settings Value Validation](#phase-4--settings-value-validation)
- [Phase 5 — Schema Strictness](#phase-5--schema-strictness)
- [Phase 6 — File Size Validation](#phase-6--file-size-validation)
- [Phase 7 — Prerequisite Logic Deduplication](#phase-7--prerequisite-logic-deduplication)
- [Phase 8 — Modal Cleanup Deduplication](#phase-8--modal-cleanup-deduplication)
- [Phase 9 — ProficiencyService Decomposition](#phase-9--proficiencyservice-decomposition)
- [Phase 10 — ClassCard Decomposition](#phase-10--classcard-decomposition)

---

## Phase 1 — Inline Style Violations

**Goal:** Replace `.style.display` and `.style.cursor` / `.style.whiteSpace` usage with CSS utility classes. Leave truly dynamic values (position, width %, backgroundImage) alone since CSSOM is not blocked by CSP — only document the convention.

### Task 1.1 — Replace `.style.display` with utility classes

These instances use `.style.display` to show/hide elements, which conflicts with `!important` in utility CSS classes and violates the project's convention.

**File: `src/app/pages/HomePageController.js`**
- **Line 169:** `topButtonRow.style.display = 'none'` → replace with `topButtonRow.classList.add('u-hidden')`
- **Line 176:** `topButtonRow.style.display = ''` → replace with `topButtonRow.classList.remove('u-hidden')`

**File: `src/app/pages/FeatsPageController.js`**
- **Line 132:** `selectionCounter.style.display = availability.max > 0 ? '' : 'none'` → replace with:
  ```javascript
  selectionCounter.classList.toggle('u-hidden', availability.max <= 0);
  ```

### Task 1.2 — Replace `.style.cursor` with CSS class

**File: `src/ui/components/feats/FeatSelectorModal.js`**
- **Line 261:** `header.style.cursor = 'pointer'` → replace with `header.classList.add('u-cursor-pointer')`

**File: `src/ui/components/selection/FilterBuilder.js`**
- **Line 32:** `header.style.cursor = 'pointer'` → replace with `header.classList.add('u-cursor-pointer')`
- **Line 170:** `header.style.cursor = 'pointer'` → replace with `header.classList.add('u-cursor-pointer')`

### Task 1.3 — Replace `.style.whiteSpace` with CSS class

**File: `src/ui/components/settings/SettingsCard.js`**
- **Line 103:** `dataSourceDisplay.style.whiteSpace = 'pre-line'` → Add a CSS utility class `u-pre-line` to `src/ui/styles/utilities.css`:
  ```css
  .u-pre-line { white-space: pre-line !important; }
  ```
  Then replace the JS line with: `dataSourceDisplay.classList.add('u-pre-line')`

### Task 1.4 — Document CSSOM convention for dynamic values

The following usages are **acceptable** because they set truly dynamic values that can't be predetermined with utility classes. No code changes needed — add a brief comment block at the top of each file.

**Acceptable CSSOM usage (no change needed):**
- `TooltipManager.js` — `.style.left`, `.style.top`, `.style.zIndex` (dynamic tooltip positioning)
- `HomePageController.js` — `.style.backgroundImage` (user-provided portrait URL)
- `DetailsPageController.js` — `.style.backgroundImage` (ally/portrait images)
- `Notifications.js` — `.style.width` (progress bar percentage)
- `SetupDataConfiguration.js` — `.style.width` (download progress bar percentage)
- `SetupModals.js` — `.style.width` (progress bar percentage)
- `AppInitializer.js` / `ModalCleanupUtility.js` / `SetupModals.js` — `.style.overflow` / `.style.paddingRight` (Bootstrap modal body reset — addressed in Phase 8)

---

## Phase 2 — Hardcoded Constants → Data-Driven

**Goal:** Replace hardcoded D&D rule constants with data sourced from existing JSON files where available. For constants that don't exist in the data, centralize them in a new `src/lib/GameRules.js` module.

### Task 2.1 — Create `src/lib/GameRules.js` for non-data constants

Create a new module exporting constants that **do not exist** in the JSON data files:

```javascript
// src/lib/GameRules.js
// Centralized D&D 5e game rule constants that are not available in data JSON files.

/** Standard array for ability score generation */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/** Point buy budget */
export const POINT_BUY_BUDGET = 27;

/** Point buy cost per score value */
export const POINT_BUY_COSTS = new Map([
    [8, 0], [9, 1], [10, 2], [11, 3],
    [12, 4], [13, 5], [14, 7], [15, 9],
]);

/** Point buy score range */
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

/** Ability score bounds */
export const ABILITY_SCORE_MIN = 1;
export const ABILITY_SCORE_MAX = 20;
export const ABILITY_SCORE_ABSOLUTE_MAX = 30;

/** Equipment rules */
export const MAX_ATTUNEMENT_SLOTS = 3;
export const CARRY_CAPACITY_MULTIPLIER = 15;
export const LIGHT_ENCUMBRANCE_MULTIPLIER = 5;
export const HEAVY_ENCUMBRANCE_MULTIPLIER = 10;

/** Character file size limit (bytes) */
export const MAX_CHARACTER_SIZE = 10 * 1024 * 1024;

/** Default ASI levels fallback (used when class data unavailable) */
export const DEFAULT_ASI_LEVELS = [4, 8, 12, 16, 19];
```

### Task 2.2 — Update `AbilityScoreService.js` and `AbilityScoreUtils.js`

Replace hardcoded ability constants with imports from `GameRules.js`:
- `src/lib/AbilityScoreUtils.js` — Replace local `STANDARD_ARRAY`, `POINT_BUY_COSTS`, and `POINT_BUY_BUDGET` definitions with imports from `GameRules.js`. Keep the re-exports if other files import them from `AbilityScoreUtils.js`.
- `src/services/AbilityScoreService.js` — Replace any local copies of these constants with imports from `GameRules.js` (either directly or via `AbilityScoreUtils.js`).

### Task 2.3 — Update `EquipmentService.js`

Replace hardcoded equipment constants:
- `src/services/EquipmentService.js` — Replace `this.MAX_ATTUNEMENT_SLOTS = 3`, `this.CARRY_CAPACITY_MULTIPLIER = 15`, etc. in the constructor with imports from `GameRules.js`. Use module-level constants instead of instance properties.

### Task 2.4 — Update `LevelUpService.js` fallback

- `src/services/LevelUpService.js` — In `_getASILevelsForClass()`, replace the hardcoded fallback `[4, 8, 12, 16, 19]` with `DEFAULT_ASI_LEVELS` from `GameRules.js`.

### Task 2.5 — Update `CharacterHandlers.js`

- `src/main/ipc/CharacterHandlers.js` — Replace `const MAX_CHARACTER_SIZE = 10 * 1024 * 1024` with an import from `GameRules.js`.

### Task 2.6 — Read spell slot tables from class JSON data

The spell slot progression tables (standard slots and pact magic) **exist** in the class JSON data at `class[].classTableGroups[].rowsSpellProgression`. However, `SpellSelectionService.js` hardcodes 20-row lookup tables.

**Action:** Modify `SpellSelectionService` to extract spell slot progression from class data loaded by `ClassService` instead of using hardcoded tables.

**Implementation approach:**
1. In `SpellSelectionService`, add a method `_getSpellSlotsFromClassData(className, level)` that:
   - Calls `classService.getClass(className)` to get the class definition
   - Reads `classTableGroups[].rowsSpellProgression[level - 1]` for standard casters
   - For Warlock/pact magic, reads from `classTableGroups[].rows[level - 1]` (columns for Spell Slots and Slot Level)
2. Replace `getStandardSpellSlots()` to use this data-driven approach, with the current hardcoded table as a **fallback** only if class data is unavailable.
3. Replace `_getPactMagicSlots()` similarly, reading Warlock table data.

**Key data paths in class JSON:**
- Standard caster: `class[0].classTableGroups[X].rowsSpellProgression` — array of 20 arrays, each containing slot counts by spell level
- Warlock pact magic: `class[0].classTableGroups[0].rows` — array of 20 arrays, column indices for Spell Slots (index 2) and Slot Level (index 3)

### Task 2.7 — Read ritual caster data from class JSON

The ritual casting flag is derivable from class data. Each class's spellcasting entry in the JSON includes a `ritualCasting` property.

**Action:** Update `SpellSelectionService._hasRitualCasting()`:
1. Replace the hardcoded `['Bard', 'Cleric', 'Druid', 'Wizard']` list with a call to `classService.getClass(className)`.
2. Check `classData.spellcastingAbility` (has spellcasting) and look for ritual casting information in the class features or `additionalSpells` data.
3. Keep the hardcoded list as a **fallback** if class data lookup fails.

---

## Phase 3 — Error Handling Standardization

**Goal:** Standardize services on the THROW pattern (already used by 7+ services). Reserve RETURN-object pattern for IPC boundary only. Document LOG pattern as intentional for resilient services.

### Task 3.1 — Classify services into tiers

**Tier 1 — THROW (no changes needed, already correct):**
`ActionService`, `BackgroundService`, `ConditionService`, `DeityService`, `EquipmentService`, `FeatService`, `SkillService`, `SpellSelectionService`

**Tier 2 — MIXED (need cleanup to prefer THROW):**
`ClassService`, `ItemService`, `LevelUpService`, `MonsterService`, `OptionalFeatureService`, `ProficiencyService`, `RaceService`

**Tier 3 — LOG-only (intentional resilience, document as acceptable):**
`CharacterValidationService`, `RehydrationService`, `ProgressionHistoryService`

**Tier 4 — RETURN-only (IPC-boundary pattern):**
`CharacterImportService` — This runs at the IPC boundary (import workflow). Its return-object pattern is acceptable because it communicates multi-step progress. Add a code comment documenting this is intentional.

### Task 3.2 — Clean up MIXED-pattern services

For each Tier 2 service, audit `console.warn()` calls that silently swallow errors and determine if they should throw instead.

**Rules for the AI agent:**
- `console.warn` during **data loading/initialization** (e.g., "failed to load optional file X") → **KEEP as warn** — partial data is OK during init.
- `console.warn` during **public method execution** with invalid inputs → **CHANGE to throw `ValidationError`** — callers should know the operation failed.
- `console.debug` for informational logging → **KEEP** — these are trace-level and harmless.

**Specific files to review and fix:**
- `src/services/ClassService.js` — Review `console.warn` at ~L65, L86. If these are "optional file didn't load" during init, keep as warn. If they indicate a user-facing operation failed, change to throw.
- `src/services/ProficiencyService.js` — Review `console.warn` at ~L185 in `setOptionalProficiencies()`. If this is called during normal operation with invalid args, change to throw `ValidationError`.
- `src/services/LevelUpService.js` — Review `console.warn` at ~L227, L272. If these are recoverable fallback situations (e.g., using default ASI levels), keep as warn.

### Task 3.3 — Add intentional-pattern comments to Tier 3 services

Add a class-level comment to each Tier 3 service explaining the LOG pattern is intentional:

```javascript
/**
 * Rehydrates character traits from source data on load/import.
 * 
 * Error strategy: LOG-and-continue. Failures are logged with console.debug
 * but never thrown, because rehydration is best-effort — missing source data
 * should not block character loading.
 */
```

Add similar comments to `CharacterValidationService` and `ProgressionHistoryService`.

### Task 3.4 — Add intentional-pattern comment to CharacterImportService

```javascript
/**
 * Handles character file import workflow.
 * 
 * Error strategy: RETURN-object. This service returns { success, error, step }
 * objects instead of throwing because it communicates multi-step progress
 * to the UI (read → validate → conflict-detect → resolve). This is intentional
 * at the IPC/workflow boundary.
 */
```

---

## Phase 4 — Settings Value Validation

**Goal:** Add value-range validation to `SettingsHandlers.js` so the renderer can't set invalid setting values.

### Task 4.1 — Add value validation to `src/main/ipc/SettingsHandlers.js`

After the `ALLOWED_KEYS` check in the `SETTINGS_SET_PATH` handler, add value validation:

```javascript
const VALUE_VALIDATORS = {
    theme: (v) => ['auto', 'light', 'dark'].includes(v),
    autoSave: (v) => typeof v === 'boolean',
    autoSaveInterval: (v) => Number.isInteger(v) && v >= 5000 && v <= 300000,
    dataSourceType: (v) => v === null || ['url', 'local'].includes(v),
    logLevel: (v) => ['debug', 'info', 'warn', 'error'].includes(v),
    // characterSavePath, dataSourceValue, dataSourceCachePath, 
    // lastOpenedCharacter: string validation only
    // windowBounds: object — validated by Settings.js schema
};

// Inside SETTINGS_SET_PATH handler, after ALLOWED_KEYS check:
const validator = VALUE_VALIDATORS[key];
if (validator && !validator(value)) {
    return { success: false, error: `Invalid value for setting '${key}'` };
}
```

---

## Phase 5 — Schema Strictness

**Goal:** Remove `.passthrough()` from `CharacterSchema.js` and tighten loose `z.unknown()` types where feasible.

### Task 5.1 — Remove `.passthrough()` from character validation schema

**File: `src/lib/CharacterSchema.js`**

Remove the `.passthrough()` call on the `characterValidationSchema`. This will cause the schema to strip unknown properties during validation, preventing malformed data from persisting.

**Before:**
```javascript
}).passthrough();
```

**After:**
```javascript
});
```

**Risk:** If any saved character files contain properties not in the schema, they will be stripped on next validation. To mitigate, run a search for any properties used on character objects that aren't in the schema and add them first.

### Task 5.2 — Tighten `z.unknown()` types incrementally

Replace the **highest-impact** `z.unknown()` usages with structured schemas. Do this incrementally — one property at a time — and verify nothing breaks:

**Priority targets:**
1. `race: z.unknown().nullable().optional()` → Define a race schema:
   ```javascript
   race: z.object({
       name: z.string(),
       source: z.string(),
       subrace: z.string().optional(),
       abilityChoices: z.array(z.unknown()).optional(),
   }).nullable().optional()
   ```
2. `background: z.unknown().nullable().optional()` → Define a background schema:
   ```javascript
   background: z.object({
       name: z.string(),
       source: z.string(),
   }).passthrough().nullable().optional()
   ```

Leave deeply nested properties (`features`, `equipment`, `spellcasting`) as `z.unknown()` for now — they have complex structures that vary significantly.

---

## Phase 6 — File Size Validation

**Goal:** Validate file sizes BEFORE reading content into memory for portrait and character import operations.

### Task 6.1 — Check file size before JSON parse in character import

**File: `src/main/ipc/CharacterHandlers.js`**

In the `CHARACTER_IMPORT` handler, before reading the file content, add a size check:

```javascript
const stats = await fs.stat(filePath);
if (stats.size > MAX_CHARACTER_SIZE) {
    return { success: false, error: `File exceeds maximum size of ${MAX_CHARACTER_SIZE / (1024 * 1024)}MB` };
}
// Then read and parse
const content = await fs.readFile(filePath, 'utf8');
```

### Task 6.2 — Add size limit to portrait embedding

**File: `src/main/ipc/CharacterHandlers.js`**

In the `embedPortraitData()` function, before `fs.readFile`:

```javascript
const MAX_PORTRAIT_SIZE = 5 * 1024 * 1024; // 5MB limit for portraits
const stats = await fs.stat(portraitPath);
if (stats.size > MAX_PORTRAIT_SIZE) {
    return { success: false, error: 'Portrait file exceeds 5MB size limit' };
}
```

Add `MAX_PORTRAIT_SIZE` to `src/lib/GameRules.js` as well.

### Task 6.3 — Add size limit to PDF portrait embedding

**File: `src/main/pdf/PdfExporter.js`**

In the portrait embedding function, add:

```javascript
const stats = await fs.stat(portraitPath);
if (stats.size > MAX_PORTRAIT_SIZE) {
    console.warn('[PdfExporter]', 'Portrait file exceeds size limit, skipping embed');
    return; // Skip portrait, don't crash
}
```

---

## Phase 7 — Prerequisite Logic Deduplication

**Goal:** Extract shared prerequisite checking logic from `FeatService` and `OptionalFeatureService` into a reusable utility.

### Task 7.1 — Create `src/lib/PrerequisiteValidator.js`

Create a utility that handles the common prerequisite checks shared between feats and optional features:

```javascript
// src/lib/PrerequisiteValidator.js
import { classService } from '../services/ClassService.js';

/**
 * Check if a character meets a single prerequisite condition.
 * Used by FeatService and OptionalFeatureService.
 * 
 * @param {Object} prereq - Single prerequisite object from 5etools data
 * @param {Object} character - Character object
 * @param {Object} [options] - Options like { ignoreRacePrereq, className }
 * @returns {{ met: boolean, reason?: string }}
 */
export function checkPrerequisite(prereq, character, options = {}) {
    if (!character) return { met: false, reason: 'No character' };

    // Level requirement
    if (prereq.level !== undefined) {
        let charLevel = character.getTotalLevel();
        if (options.className && character.progression?.classes) {
            const classEntry = character.progression.classes.find(
                (c) => c.name === options.className,
            );
            if (classEntry) charLevel = classEntry.levels || 1;
        }
        const requiredLevel = typeof prereq.level === 'object'
            ? prereq.level.level || 1
            : prereq.level;
        if (charLevel < requiredLevel) {
            return { met: false, reason: `Requires ${options.className || 'character'} level ${requiredLevel}` };
        }
    }

    // Ability score requirement
    if (Array.isArray(prereq.ability)) {
        const abilityScores = character.abilityScores || {};
        const meetsAbility = prereq.ability.some((abilityReq) => {
            if (typeof abilityReq === 'string') {
                return (abilityScores[abilityReq] || 0) >= 13;
            }
            if (typeof abilityReq === 'object' && abilityReq.ability) {
                return (abilityScores[abilityReq.ability] || 0) >= (abilityReq.score || 13);
            }
            return false;
        });
        if (!meetsAbility) {
            return { met: false, reason: 'Does not meet ability score requirement' };
        }
    }

    // Race requirement
    if (!options.ignoreRacePrereq && Array.isArray(prereq.race)) {
        const characterRace = character.race?.name?.toLowerCase() || '';
        const meetsRace = prereq.race.some((raceReq) => {
            const reqName = typeof raceReq === 'string' ? raceReq : raceReq.name;
            return reqName && characterRace === reqName.toLowerCase();
        });
        if (!meetsRace) {
            return { met: false, reason: 'Race requirement not met' };
        }
    }

    // Class requirement
    if (Array.isArray(prereq.class)) {
        const primaryClass = character.getPrimaryClass();
        const characterClass = primaryClass?.name?.toLowerCase() || '';
        const meetsClass = prereq.class.some((classReq) => {
            const reqName = typeof classReq === 'string' ? classReq : classReq.name;
            return reqName && characterClass === reqName.toLowerCase();
        });
        if (!meetsClass) {
            return { met: false, reason: 'Class requirement not met' };
        }
    }

    // Spellcasting requirement
    if (prereq.spellcasting === true) {
        const classes = character.progression?.classes || [];
        const hasSpellcasting = classes.some((cls) => {
            const classData = classService?.getClass?.(cls.name, cls.source);
            return classData?.spellcastingAbility;
        });
        if (!hasSpellcasting) {
            return { met: false, reason: 'Requires spellcasting ability' };
        }
    }

    // Spell known requirement
    if (prereq.spell) {
        const requiredSpells = Array.isArray(prereq.spell) ? prereq.spell : [prereq.spell];
        const missing = requiredSpells.filter((spellRef) => {
            const spellName = spellRef.split('#')[0].split('|')[0].toLowerCase();
            if (character.spellcasting?.classes) {
                for (const cs of Object.values(character.spellcasting.classes)) {
                    if (cs.spellsKnown?.some((s) => s.name.toLowerCase() === spellName)) return false;
                    if (cs.cantrips?.some((s) => s.name.toLowerCase() === spellName)) return false;
                    if (cs.preparedSpells?.some((s) => s.name.toLowerCase() === spellName)) return false;
                }
            }
            return true;
        });
        if (missing.length > 0) {
            const names = missing.map((r) => r.split('#')[0].split('|')[0]).join(', ');
            return { met: false, reason: `Requires spell: ${names}` };
        }
    }

    // Pact requirement
    if (prereq.pact) {
        const hasPact = character.features?.some((f) =>
            f.name?.toLowerCase().includes(prereq.pact.toLowerCase()),
        );
        if (!hasPact) {
            return { met: false, reason: `Requires ${prereq.pact}` };
        }
    }

    // Patron requirement
    if (prereq.patron) {
        const hasPatron = character.features?.some((f) =>
            f.name?.toLowerCase().includes(prereq.patron.toLowerCase()),
        );
        if (!hasPatron) {
            return { met: false, reason: `Requires patron: ${prereq.patron}` };
        }
    }

    return { met: true };
}

/**
 * Check all prerequisites on a feature/feat (AND logic).
 * Returns { met: boolean, reasons: string[] }
 */
export function checkAllPrerequisites(item, character, options = {}) {
    if (!item.prerequisite || !Array.isArray(item.prerequisite)) {
        return { met: true, reasons: [] };
    }
    const reasons = [];
    for (const prereq of item.prerequisite) {
        const result = checkPrerequisite(prereq, character, options);
        if (!result.met) reasons.push(result.reason);
    }
    return { met: reasons.length === 0, reasons };
}
```

### Task 7.2 — Refactor `FeatService.isFeatValidForCharacter()`

Replace `_validatePrerequisiteCondition()` in `src/services/FeatService.js` with calls to `checkAllPrerequisites()`:

```javascript
import { checkAllPrerequisites } from '../lib/PrerequisiteValidator.js';

isFeatValidForCharacter(feat, character, options = {}) {
    const result = checkAllPrerequisites(feat, character, options);
    return result.met;
}
```

Remove the private `_validatePrerequisiteCondition()` method entirely.

### Task 7.3 — Refactor `OptionalFeatureService.meetsPrerequisites()`

Replace the 100-line `meetsPrerequisites()` method in `src/services/OptionalFeatureService.js` with:

```javascript
import { checkAllPrerequisites } from '../lib/PrerequisiteValidator.js';

meetsPrerequisites(feature, character, className = null) {
    return checkAllPrerequisites(feature, character, { className });
}
```

---

## Phase 8 — Modal Cleanup Deduplication

**Goal:** Centralize the `document.body.style.overflow = ''` / `document.body.style.paddingRight = ''` pattern to `ModalCleanupUtility` only.

### Task 8.1 — Audit and remove duplicate modal body resets

The modal body reset pattern appears in 3 places:

1. **`src/lib/ModalCleanupUtility.js` (L36-37)** — This is the canonical location. **KEEP.**
2. **`src/app/AppInitializer.js` (L389-390)** — Duplicate. **Replace** with a call to `ModalCleanupUtility.cleanupModalState()` (or the static method that handles this).
3. **`src/ui/components/setup/SetupModals.js` (L25-26)** — Duplicate. **Replace** with a call to `ModalCleanupUtility.cleanupModalState()`.

**Implementation:**
- Read `ModalCleanupUtility.js` to find the exact exported function name that handles the body cleanup (there should be a static or exported function).
- Replace the inline `.style.overflow = ''` / `.style.paddingRight = ''` in AppInitializer and SetupModals with calls to that function.
- If no standalone function exists, extract one: `export function resetModalBodyState()` in `ModalCleanupUtility.js` and call it from all 3 locations.

---

## Phase 9 — ProficiencyService Decomposition

**Goal:** Split the 600+ line `ProficiencyService` into focused sub-modules while maintaining the same public API.

### Task 9.1 — Extract description methods into `src/services/ProficiencyDescriptionService.js`

Extract these methods from `ProficiencyService.js` into a new standalone service:
- `_loadSkillData()` / `getSkillDescription()`
- `_loadLanguageData()` / `getLanguageDescription()` / `getStandardLanguages()`
- `_loadBookData()` / `_findBookEntry()` / `getSavingThrowInfo()`
- `getToolDescription()`
- `getArmorDescription()`
- `getWeaponDescription()`
- `_getAllowedSourcesSet()` (shared utility, may need to stay or be passed as parameter)

**New service structure:**
```javascript
// src/services/ProficiencyDescriptionService.js
export class ProficiencyDescriptionService {
    constructor() {
        this._skillData = null;
        this._languageData = null;
        this._bookData = null;
    }
    
    async getSkillDescription(skillName) { ... }
    async getLanguageDescription(languageName) { ... }
    async getStandardLanguages() { ... }
    async getToolDescription(toolName) { ... }
    async getArmorDescription(armorName) { ... }
    async getWeaponDescription(weaponName) { ... }
    async getSavingThrowInfo(ability) { ... }
    
    dispose() { ... }
}

export const proficiencyDescriptionService = new ProficiencyDescriptionService();
```

**Update callers:** Search for all imports/usages of the moved methods. They are likely called from UI components like `ProficiencyCard.js`. Update those imports to use the new service.

### Task 9.2 — Slim down `ProficiencyService.js`

After extraction, `ProficiencyService.js` should contain only:
- Core proficiency management: `addProficiency()`, `removeProficienciesBySource()`, `getProficiencySources()`
- Optional proficiency management: `setOptionalProficiencies()`, `initializeProficiencyStructures()`, `_recalculateOptionalProficiencies()`, `_refundOptionalSkill()`, `_removeProficiencyFromSource()`
- `_findBySourcePriority()` (internal utility)

This should reduce `ProficiencyService.js` from ~600 to ~250 lines.

---

## Phase 10 — ClassCard Decomposition

**Goal:** Decompose the 3,036-line `ClassCard.js` into focused sub-components. Existing extractions (`ClassCardView`, `ClassDetailsView`, `SubclassPickerView`, modals) are already done. This phase targets the remaining monolith.

**Strategy:** Extract by domain. Each extraction creates a new file under `src/ui/components/class/` and the main `ClassCard` delegates to it.

### Task 10.1 — Extract `ClassChoiceInfoPanel.js` (~326 lines)

**Methods to extract (lines ~1889–2310):**
- `_setupChoiceHoverListeners()`
- `_showSubclassInfo(item)`
- `_showSpellSelectionInfo(item)`
- `_showFeatureInfo(item)`
- `_showASIInfo(item)`
- `_showPassiveFeatureInfo(item)`
- `_renderFeatureEntries(entries)`
- `_renderNoChoiceFeature(feature)`
- `_getFeatureDescription(feature)`
- `_getFeatureTypeName(type)`

**New class:**
```javascript
// src/ui/components/class/ClassChoiceInfoPanel.js
export class ClassChoiceInfoPanel {
    constructor(infoContainer, cleanup) { ... }
    setupHoverListeners(choicesContainer) { ... }
    async showSubclassInfo(item) { ... }
    async showSpellSelectionInfo(item) { ... }
    async showFeatureInfo(item) { ... }
    async showASIInfo(item) { ... }
    async showPassiveFeatureInfo(item) { ... }
    // ...private render helpers
}
```

**In `ClassCard.js`:** Replace all `_show*Info()` calls with `this._infoPanel.show*Info()`. Remove the extracted methods.

### Task 10.2 — Extract `ClassASIController.js` (~235 lines)

**Methods to extract (lines ~402–636 and ~1760–1870):**
- `_renderASISection(className)`
- `_attachASISectionListeners(classLevel)`
- `_handleASIApplication(classLevel)`
- `_renderASIChoice(choice, _className)`
- `_hideASISection()`
- `_getFeatureIcon(type)` (shared utility — could also go to a shared module)

**New class:**
```javascript
// src/ui/components/class/ClassASIController.js
export class ClassASIController {
    constructor(asiContainer, cleanup) { ... }
    renderSection(className) { ... }
    renderChoice(choice, className) { ... }
    hide() { ... }
    // ...private helpers
}
```

### Task 10.3 — Extract `ClassSpellNotificationController.js` (~200 lines)

**Methods to extract (lines ~637–963 and ~1709–1760):**
- `_renderSpellNotification(className)`
- `_getSpellChoicesForLevels(className, classLevel)`
- `_handleSpellSelection(className, level)` (opens modal)
- `updateSpellSelection(className, level, selectedSpells)`
- `_renderSpellChoice(choice, className)`
- `_hideSpellNotification()`

**New class:**
```javascript
// src/ui/components/class/ClassSpellNotificationController.js
export class ClassSpellNotificationController {
    constructor(spellContainer, cleanup, onSpellUpdate) { ... }
    render(className) { ... }
    async handleSelection(className, level) { ... }
    async updateSelection(className, level, selectedSpells) { ... }
    hide() { ... }
}
```

### Task 10.4 — Extract `ClassChoiceQueryService.js` (~260 lines)

**Methods to extract (lines ~1051–1310):**
- `_getClassChoicesAtLevel(className, level, subclassData)`
- `_getNoChoiceFeaturesAtLevel(className, level, classData)`
- `_getSubclassDescription(subclass)`

These are pure data query methods with no DOM interaction — they belong in a service-like utility, not a UI component.

**New module:**
```javascript
// src/ui/components/class/ClassChoiceQueryService.js
export class ClassChoiceQueryService {
    getChoicesAtLevel(className, level, subclassData) { ... }
    getNoChoiceFeaturesAtLevel(className, level, classData) { ... }
    getSubclassDescription(subclass) { ... }
}
```

### Task 10.5 — Extract `ClassChoiceRenderer.js` (~150 lines)

**Methods to extract (lines ~1347–1670):**
- `_renderClassChoices(className, choices, passiveFeatures)` — orchestrator
- `_renderFeatureChoice(choice, className)` — dispatcher
- `_renderSubclassChoice(choice, className)`
- `_renderSubclassFeatureChoice(choice, _className)`
- `_formatChoiceOptionLabel(opt, choice)`
- `_toChoiceKey(featureName)`
- `_toChoiceDefinition(raw)`

**New class:**
```javascript
// src/ui/components/class/ClassChoiceRenderer.js
export class ClassChoiceRenderer {
    constructor(choicesContainer, cleanup, delegates) { ... }
    async renderChoices(className, choices, passiveFeatures) { ... }
    // ...private render dispatch methods
}
```

The `delegates` parameter receives callbacks for opening modals, applying ASI, etc., decoupling this renderer from ClassCard directly.

### Task 10.6 — Slim `ClassCard.js` to orchestrator

After all extractions, `ClassCard.js` should contain only:
- Constructor: Create sub-controllers, wire DOM references
- `initialize()` / `cleanup()` lifecycle
- Class selection & tab management (~140 lines)
- `_updateClassChoices()` — delegates to sub-controllers
- `_loadSavedClassSelection()` / `_syncWithCharacterProgression()`
- Event listener setup / `_handleCharacterChanged()` / `_handleLevelUpComplete()`

**Target size:** ~400–500 lines (down from 3,036).

### Decomposition Order

Execute extractions in this order to minimize merge conflicts:
1. **Task 10.1** (InfoPanel) — most isolated, fewest dependencies on other ClassCard methods
2. **Task 10.4** (QueryService) — pure logic, no DOM
3. **Task 10.2** (ASIController) — self-contained UI block
4. **Task 10.3** (SpellNotificationController) — self-contained UI block
5. **Task 10.5** (ChoiceRenderer) — depends on the above being extracted first
6. **Task 10.6** (Slim orchestrator) — final cleanup

---

## Execution Notes for AI Agents

### General Rules
1. **Read before editing.** Always read the full file (or the relevant section ±50 lines) before making changes.
2. **One phase at a time.** Complete and verify each phase before starting the next.
3. **Preserve existing behavior.** These are refactors, not feature changes. No functional behavior should change.
4. **Follow existing conventions.** Match the codebase's naming (`camelCase` methods, `_` prefix for private, `PascalCase` classes), import style (ESM), and error patterns.
5. **Use DOMCleanup for any new DOM event listeners.** Follow the pattern at `this._cleanup.on(element, 'event', handler)`.
6. **Singleton exports for new services.** Follow the pattern: `export const fooService = new FooService()`.
7. **No new tests** — tests are out of scope for this plan.
8. **Do not refactor unrelated code.** Only touch what each task specifies.

### Verification After Each Phase
- Run `npm run check:lint` to verify no lint errors introduced.
- Run `npm start` to verify the app launches and basic navigation works.
- Check the browser console for new errors or warnings.

---

*End of remediation plan.*
