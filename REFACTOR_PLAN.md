

### Current Findings (2025-12-10 audit)
- **Loaders keep original casing**: `DataLoader` no longer normalizes names on ingestion. Remaining name-mutating helpers live in `DataNormalizer` but are no longer invoked on load.
- **Comparison logic is hand-rolled**: `ProficiencyCore`, `ProficiencyCalculator`, and parts of `ProficiencyCard` compare via `toLowerCase()` without a shared helper; this risks divergence and keeps leaking lowercase strings into state.
- **UI casing mostly OK**: `RaceDetails`, `ClassDetails`, and `BackgroundDetails` already render JSON strings as-is. The remaining display-side transform is `ProficiencyDisplay.getTypeLabel()` fallback (`charAt(0).toUpperCase()` for unknown types).
- **Choice builders now preserve casing**: Race/Class/Background choice flows keep JSON casing and normalize only for comparisons.
- **Legacy save migration removed**: `_migrateLegacySaveFile` dropped; no backward compatibility layer remains.

### Updated Execution Plan (actionable steps)
1) **Stop destroying casing at ingestion** ✅
- `DataLoader` no longer normalizes items/skills/actions/feats/conditions/optional features/rewards/vehicles/objects. Remaining mutating helpers in `DataNormalizer` still need cleanup.

2) **Normalize only at comparison points** 🔄
- Done: `ProficiencyCalculator`, `ProficiencyCard`, `ProficiencyCore` comparisons use `normalizeForLookup`; `ProficiencyDisplay` fallback removed.
- Services updated: `ActionService`, `AbilityScoreService`, `ConditionService`, `FeatService`, `ItemService`, `MonsterService`, `ProficiencyService`, `SkillService`, `SpellService`, `VariantRuleService` use `normalizeForLookup` for map keys/lookups.
- Pending: audit `ReferenceResolver`/other stragglers; clean remaining mutating helpers in `DataNormalizer`; consider Source keyword search normalization only if needed.

3) **Leave display strings untouched** ✅
- `ProficiencyDisplay` shows raw type strings; details views already pass through JSON.

4) **Remove legacy save compatibility** ✅
- `_migrateLegacySaveFile` removed from `Character`.

5) **Race/Class/Background ingestion and choice builders** ✅
- `src/renderer/scripts/modules/race/RaceCard.js`
	- Language handling preserves casing; comparisons use `normalizeForLookup` and options dedupe by normalized key.
- `src/renderer/scripts/modules/class/ClassCard.js`
	- `_normalizeSkillName` removed; skill options use JSON casing directly.
- `src/renderer/scripts/modules/background/BackgroundCard.js`
	- Language comparisons normalized; options and storage keep JSON casing with normalized dedupe/restore logic.

---
7) **Normalization utility** ✅
- `normalizeForLookup` added to `DataNormalizer`; adoption in services/race/class/background flows pending.
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

### 5) Race/Class/Background ingestion and choice builders (done)
- `src/renderer/scripts/modules/race/RaceCard.js`: casing preserved; comparisons use `normalizeForLookup`; options deduped by normalized key.
- `src/renderer/scripts/modules/class/ClassCard.js`: `_normalizeSkillName` removed; skill options rely on JSON casing.
- `src/renderer/scripts/modules/background/BackgroundCard.js`: language comparisons normalized; options/restore keep original casing.

### 6) Details views (display-only)
- `RaceDetails.js`, `ClassDetails.js`, `BackgroundDetails.js`
	- Verify all outputs already use JSON strings untouched; no further action unless any lingering `.toUpperCase()`/`.charAt(0)` remain (remove if found).

### 7) Normalization utility
- Add/standardize a single helper: `normalizeForLookup(str)` in `DataNormalizer` (trim + lowercase + collapse double apostrophes if needed). All code should import and use this for comparisons.

### 8) Save/load behavior
- `Character.js`
	- Confirm no legacy migration remains; do not add any new compatibility paths. Saves should persist the stored (display) casing; comparisons remain case-insensitive via `normalizeForLookup`.

### 9) Remove deprecated/dead code
- Delete legacy casing helpers/migrations (`_migrateLegacySaveFile`, any `_normalize*LoadedData` shims) and any unused `toTitleCase`/recasing utilities that were only needed for lowercased storage.
- Remove unused normalization branches in `DataNormalizer` that mutate names once comparison-time normalization is in place.
- Strip redundant recasing maps (e.g., `_normalizeSkillName`) once display strings come straight from JSON.
- Clean CSS selectors/utility classes that are no longer referenced after text-transform removals (verify before delete).

### 10) CSS text-transform sanity check
- Audit UI elements that render dynamic proficiency/type names to ensure CSS `text-transform: uppercase` isn’t applied where original casing must be preserved (notably entries in `src/renderer/styles/main.css` and `tooltip.css`). Remove or scope transforms if they touch proficiency/language/skill labels.

### 11) Tests to update/add
- Add unit coverage for mixed-case proficiency add/remove/merge and for services lookups with mismatched casing.
- Update any fixtures that assumed lowercased storage.
- Run existing Playwright specs for proficiencies and save/load flows; add assertions that display casing matches JSON (e.g., “Sleight of Hand”, “Deep Speech”).

5) **Testing checklist (update after changes)**
- Unit: add/adjust tests for mixed-casing inputs in proficiency add/remove, merging, and lookup (e.g., `"animal handling"` vs `"Animal Handling"`).
- Integration/manual: load legacy saves with lowercase proficiencies, ensure UI shows proper casing and no duplicates; add proficiencies via race/class/background choices in differing input casing and verify stored/displayed casing matches JSON.
- Regression: rerun existing Playwright/Smoke tests for proficiency flows and save/load.