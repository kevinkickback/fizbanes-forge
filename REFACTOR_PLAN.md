

### Current Findings (2025-12-10 audit)
- **Loaders are still lowercasing reference data**: `DataLoader` calls `DataNormalizer.normalizeSkills/actions/items/...`, which currently lowercases the `name` field. `SkillService` then exposes already-lowercased names to the UI; same pattern for feats/conditions/items, so original casing is already lost at ingestion.
- **Comparison logic is hand-rolled**: `ProficiencyCore`, `ProficiencyCalculator`, and parts of `ProficiencyCard` compare via `toLowerCase()` without a shared helper; this risks divergence and keeps leaking lowercase strings into state.
- **UI casing mostly OK**: `RaceDetails`, `ClassDetails`, and `BackgroundDetails` already render JSON strings as-is. The remaining display-side transform is `ProficiencyDisplay.getTypeLabel()` fallback (`charAt(0).toUpperCase()` for unknown types).
- **Choice builders still downcase**: `RaceCard` lowercases language option lists; `ClassCard` re-capitalizes skills via a local map; `BackgroundCard` passes JSON strings as-is but uses lowercase for some comparisons. These mutate casing instead of normalizing only when comparing.
- **Legacy save migration should be removed**: `_migrateLegacySaveFile` and any other compatibility shims keep old lowercase data flowing; requirement is now to drop backward compatibility entirely.

### Updated Execution Plan (actionable steps)
1) **Stop destroying casing at ingestion**
- Update `DataNormalizer.normalize*` helpers to **preserve `name`** and instead add `normalizedName` (or return a `{ name, normalizedName }` copy). Do not mutate `name` to lowercase.
- In `DataLoader`, keep passthrough JSON for proficiencies/skills/actions/feats/conditions/items; only attach normalized helpers, never overwrite display strings.
- In services that build lookup maps (`SkillService`, `ActionService`, `FeatService`, `ConditionService`, `ItemService`, `ProficiencyService` if it ever loads from data), use `DataNormalizer.normalizeString(name)` for keys but keep the original name in stored records.

2) **Normalize only at comparison points**
- Centralize comparison via `DataNormalizer.normalizeString()` (or a tiny `normalizeForLookup`) and reuse everywhere: `ProficiencyCore` (add/remove/has), `ProficiencyCard` (`_isGrantedBySource`, selection checks), `ProficiencyCalculator` (`mergeProficiencies`, `hasProficiency`, skill ability lookups), `RaceCard`/`ClassCard`/`BackgroundCard` when checking duplicates or matching options, and `Character` helpers.
- Ensure merging/dedup routines **return display strings** (first-seen casing) while using normalized keys for equality.

3) **Leave display strings untouched**
- Remove the fallback capitalization in `ProficiencyDisplay.getTypeLabel` (return the raw `type` for unknowns).
- Re-verify `RaceDetails`, `ClassDetails`, `BackgroundDetails` continue to pass through JSON text unchanged (already good per audit).

4) **Remove legacy save compatibility**
- Delete `_migrateLegacySaveFile` and any migration helpers; cease normalizing legacy lowercase saves. Future saves/loads assume canonical casing from JSON. If old saves are encountered, they will display as-is (even if lowercased).

---

## In-Depth Audit and Per-File TODOs (exact edits to apply)

### 1) Data ingestion must keep original casing
- `src/renderer/scripts/utils/DataLoader.js`
	- Stop invoking `DataNormalizer.normalizeSkills/Actions/Items/Feats/Conditions/OptionalFeatures/Rewards/Vehicles/Objects` on load; return JSON as-is.
	- Keep `loadClasses`/`loadSpells` path logic; no name mutations.
- `src/renderer/scripts/utils/DataNormalizer.js`
	- Replace mutations of `name` with additive fields (e.g., `normalizedName = normalizeString(name)`).
	- For proficiency-related helpers (`normalizeProficienciesInData`), stop lowercasing keys/values; instead, attach normalized helper fields or provide a pure `normalizeForLookup(str)` utility used at comparison time.

### 2) Services should build lookup maps using normalized keys but preserve display names
- `SkillService`, `ActionService`, `FeatService`, `ConditionService`, `ItemService`, `ProficiencyService`, `VariantRuleService`, `SpellService`, `MonsterService`, `AbilityScoreService`, `ReferenceResolver`:
	- When building Maps, use `normalizeForLookup(name)` for the key; store full record with original `name` untouched.
	- Where comparisons currently use `toLowerCase()`, swap to shared `normalizeForLookup`.
	- Ensure getters return original-cased names/records (no `toLowerCase()` before returning).

### 3) Core proficiency logic centralizes normalization
- `src/renderer/scripts/core/Proficiency.js`
	- Introduce a `normalizeForLookup` import (from DataNormalizer) and use it for all equality checks (add, has, remove, source tracking).
	- Deduplicate while retaining first-seen casing for storage; sources Map keys should use stored display casing.
- `src/renderer/scripts/modules/proficiencies/ProficiencyCalculator.js`
	- Replace all `toLowerCase().trim()` with `normalizeForLookup`.
	- `mergeProficiencies` should normalize only for set membership but keep/display original casing (store the first encountered display string against the normalized key).
	- `getSkillAbility` normalization should rely on shared helper.

### 4) Proficiency UI flows: normalize when comparing, not when storing
- `src/renderer/scripts/modules/proficiencies/ProficiencyCard.js`
	- `_isGrantedBySource` and all selection guards: normalize via helper, not manual `toLowerCase`.
	- Choice resolution blocks (skills/tools/languages) should keep option strings as provided by services/JSON; only normalize when checking membership/duplicates.
- `src/renderer/scripts/modules/proficiencies/ProficiencyDisplay.js`
	- For unknown types, stop title-casing fallback; display raw type string.

### 5) Race/Class/Background ingestion and choice builders
- `src/renderer/scripts/modules/race/RaceCard.js`
	- Remove lowercasing of language options (`keyLower` usage should be for comparison only); keep added proficiencies in original casing.
	- When handling `choose.from`, do not downcase the array; compare via `normalizeForLookup`.
- `src/renderer/scripts/modules/class/ClassCard.js`
	- Drop `_normalizeSkillName` recasing map; rely on original JSON casing for display/options.
	- When adding proficiencies, normalize only for comparison/dup checks.
- `src/renderer/scripts/modules/background/BackgroundCard.js`
	- Ensure `langLower` and similar are used solely for comparison; preserve original strings in options and adds.

### 6) Details views (display-only)
- `RaceDetails.js`, `ClassDetails.js`, `BackgroundDetails.js`
	- Verify all outputs already use JSON strings untouched; no further action unless any lingering `.toUpperCase()`/`.charAt(0)` remain (remove if found).

### 7) Normalization utility
- Add/standardize a single helper: `normalizeForLookup(str)` in `DataNormalizer` (trim + lowercase + collapse double apostrophes if needed). All code should import and use this for comparisons.

### 8) Save/load behavior
- `Character.js`
	- Confirm no legacy migration remains; do not add any new compatibility paths. Saves should persist the stored (display) casing; comparisons remain case-insensitive via `normalizeForLookup`.

### 9) CSS text-transform sanity check
- Audit UI elements that render dynamic proficiency/type names to ensure CSS `text-transform: uppercase` isn’t applied where original casing must be preserved (notably entries in `src/renderer/styles/main.css` and `tooltip.css`). Remove or scope transforms if they touch proficiency/language/skill labels.

### 10) Tests to update/add
- Add unit coverage for mixed-case proficiency add/remove/merge and for services lookups with mismatched casing.
- Update any fixtures that assumed lowercased storage.
- Run existing Playwright specs for proficiencies and save/load flows; add assertions that display casing matches JSON (e.g., “Sleight of Hand”, “Deep Speech”).

5) **Testing checklist (update after changes)**
- Unit: add/adjust tests for mixed-casing inputs in proficiency add/remove, merging, and lookup (e.g., `"animal handling"` vs `"Animal Handling"`).
- Integration/manual: load legacy saves with lowercase proficiencies, ensure UI shows proper casing and no duplicates; add proficiencies via race/class/background choices in differing input casing and verify stored/displayed casing matches JSON.
- Regression: rerun existing Playwright/Smoke tests for proficiency flows and save/load.