# Casing Normalization Refactor Plan - Phase 2

## COMPLETION STATUS: 🔄 IN PROGRESS - PHASE 2

Phase 1 (normalization at ingestion) was completed but introduced display issues.
Phase 2 will preserve original JSON casing for display while normalizing only for lookups.

---

## Overview - New Approach (Option 3)

**Problem Identified:** The original refactor normalized proficiency data at JSON load time, which destroyed the original display casing from the 5etools JSON files. The JSON authors use proper casing ("Common", "Elvish", "Animal Handling", "Sleight of Hand") which should be displayed exactly as authored.

**New Strategy:**
1. **Keep JSON data pristine** - Don't normalize at load time
2. **Normalize only for comparisons** - When looking up or comparing proficiencies
3. **Display original values** - Use exact strings from JSON files
4. **Remove manual casing transformations** - Delete all `.charAt(0).toUpperCase()` patterns
5. **IMPORTANT: Limited scope** - Only apply to reference/lookup data (proficiencies, feats, conditions), not display text

## Scope Clarification

### Which Data Is Affected?

This refactor ONLY applies to **reference/lookup data** that is used for matching and comparisons:

| Category | Affected | Examples | Reason |
|----------|----------|----------|--------|
| **Proficiencies** | ✅ YES | Skills, Tools, Languages, Weapons, Armor | Must match user selections to source data |
| **Feats** | ✅ YES | Feat names in class features | Must match feature references to feat data |
| **Conditions** | ✅ YES | Condition/disease names | Must match status effects to condition data |
| **Action Names** | ✅ YES | Dash, Dodge, Help (in references) | Must match action tags to action data |
| **Race/Subrace Names** | ❌ NO | "Half-Elf", "High Elf" | Already handled correctly by RaceService lookup |
| **Class/Subclass Names** | ❌ NO | "Fighter", "Battle Master" | Already handled correctly by ClassService lookup |
| **Background Names** | ❌ NO | "Acolyte", "Criminal" | Already handled correctly by BackgroundService lookup |
| **Spell Descriptions** | ❌ NO | "10-foot radius sphere" text | Display only, never compared |
| **Item Descriptions** | ❌ NO | Weapon flavor text | Display only, never compared |
| **Creature Traits** | ❌ NO | Ability descriptions | Display only, never compared |
| **Racial Ability Increases** | ❌ NO | The entry showing "Strength +2" | Display only, never compared |

### Why This Distinction?

**Reference Data** (preserve casing, normalize for lookups):
- Used to find matching records
- User selects "Animal Handling" → must find it in system data
- Needs case-insensitive comparison

**Display Data** (keep as-is, never compared):
- Only shown to users
- Never matched or looked up
- No need for normalization

### Special Case: Race/Class/Background

Race, class, and background names are **already handled correctly** and do NOT need changes:

1. **Storage**: Stored with original JSON casing in character object
   ```javascript
   character.race = { name: 'Half-Elf', source: 'PHB', subrace: 'Drow' };
   ```

2. **Lookup**: Service methods handle normalization internally
   ```javascript
   // RaceService.getRace() converts to key: "half-elf:phb"
   const raceData = raceService.getRace('Half-Elf', 'PHB');
   ```

3. **Display**: Used directly from character object with original casing
   ```javascript
   console.log(character.race.name); // "Half-Elf" (original casing)
   ```

The services (`RaceService`, `ClassService`, `BackgroundService`) already implement case-insensitive lookups via key normalization, so these names don't need to be changed in the refactor.

---

### Phase 2A: Remove JSON Normalization at Load Time
**Files to modify:**
- `DataLoader.js` - Remove normalization calls during load
- `DataNormalizer.js` - Keep utility functions but don't auto-apply to JSON

### Phase 2B: Add Normalization at Comparison Points
**Files to modify:**
- `Character.js` - Normalize when checking/comparing proficiencies
- `ProficiencyCard.js` - Normalize when matching user selections
- `ProficiencyCalculator.js` - Normalize for lookups
- `RaceCard.js` - Normalize when processing proficiencies
- `ClassCard.js` - Normalize when processing proficiencies
- `BackgroundCard.js` - Normalize when processing proficiencies

### Phase 2C: Remove Display Transformations
**Files to modify:**
- `RaceDetails.js` - Remove `.charAt(0).toUpperCase() + .slice(1)` (lines 108, 131, 231, 276)
- `ClassDetails.js` - Remove manual capitalization (lines 249, 259, 511)
- `BackgroundDetails.js` - Remove manual capitalization (lines 163, 174, 206, 232)
- `ProficiencyDisplay.js` - Remove manual capitalization (line 304)

### Phase 2D: Update Save File Compatibility
**Files to modify:**
- `Character.js` - Update `_normalizeProficienciesInLoadedData()` to handle both old (lowercase) and new (original casing) save files

## Current Issues (Original Casing Lost)

### Scope: Which Data Types Are Affected?

**This approach ONLY applies to reference/lookup data:**
- ✅ **Proficiencies** (Skills, Tools, Languages, Weapons, Armor)
- ✅ **Feats & Optional Features**
- ✅ **Conditions & Diseases**
- ✅ **Action names** (used in references)

**This approach does NOT apply to:**
- ❌ **Fluff data** (Descriptions, flavor text, lore)
- ❌ **Text entries** (Spell descriptions, creature traits, item descriptions)
- ❌ **Page numbers, indices, metadata**

**Why the distinction:**
- **Reference data** = Used for matching/lookups/comparisons (needs normalized keys for lookups)
- **Display data** = Only shown to users, never compared (just preserve as-is)

### What Changes and What Doesn't

| Data Type | Change? | Reason |
|-----------|---------|--------|
| Proficiency names (e.g., "Common", "Sleight of Hand") | ✅ YES | Referenced in selections, needs case-insensitive lookup |
| Feat names | ✅ YES | Referenced by features, needs matching |
| Condition names | ✅ YES | Referenced in character status, needs lookup |
| Skill descriptions | ❌ NO | Display only, never looked up |
| Spell entries | ❌ NO | Display only, just text content |
| Item descriptions | ❌ NO | Display only, just flavor text |
| Race ability score changes | ❌ NO | Display only (e.g., "Strength +2") |

### Root Problem
When JSON is loaded, `DataNormalizer.normalizeProficienciesInData()` converts all proficiency names to lowercase:
- JSON: `"Common"`, `"Elvish"`, `"Animal Handling"`
- After normalization: `"common"`, `"elvish"`, `"animal handling"`
- Display code then uses manual `.charAt(0).toUpperCase()` which produces: `"Common"` ✓, `"Elvish"` ✓, `"Animal handling"` ✗

### Why This Matters
1. **JSON authors use proper casing** - 5etools data has correct capitalization
2. **Manual transforms are inconsistent** - Different patterns produce different results
3. **Data loss** - Once normalized, original display intent is gone
4. **Code complexity** - Manual transforms scattered across 13+ locations

## Implementation Strategy

### Section 1: Remove JSON Load-Time Normalization
**Status**: not-started
**Impact**: HIGH - Core data loading
**Files**:
- `src/renderer/scripts/utils/DataLoader.js`
  - Line 140: Remove `data.race = data.race.map(race => DataNormalizer.normalizeProficienciesInData(race));`
  - Similar patterns in `loadClasses()`, `loadBackgrounds()` if present
- `src/renderer/scripts/services/RaceService.js`
  - Verify no additional normalization happens after load
- `src/renderer/scripts/services/ClassService.js`
  - Verify no additional normalization happens after load
- `src/renderer/scripts/services/BackgroundService.js`
  - Verify no additional normalization happens after load

**Testing**: **Testing**: Load races/classes/backgrounds and verify original proficiency casing preserved in memory

## Section 2: Add Normalization at Comparison Points
**Status**: not-started
**Impact**: HIGH - All proficiency comparisons
**Strategy**: When comparing two proficiency names, normalize both before comparison
**Scope**: Only proficiency lookups, not text content

**Files**:

## Phase 2A: Remove JSON Normalization at Load Time
**Status**: not-started
**Impact**: HIGH - Core data loading
**Scope**: Only proficiency and reference fields

**Files**:
- `src/renderer/scripts/utils/DataLoader.js`
  - Line 140: Remove `data.race = data.race.map(race => DataNormalizer.normalizeProficienciesInData(race));`
  - Line 165: Remove `data.class = data.class.map(cls => DataNormalizer.normalizeProficienciesInData(cls));`
  - Line 177: Remove `data.background = data.background.map(bg => DataNormalizer.normalizeProficienciesInData(bg));`
  - **Keep**: `loadItems()`, `loadFeats()`, `loadConditions()` normalization (these still normalize only names, not descriptions)

- `src/renderer/scripts/services/RaceService.js`
  - Verify no additional normalization happens after load

- `src/renderer/scripts/services/ClassService.js`
  - Verify no additional normalization happens after load

- `src/renderer/scripts/services/BackgroundService.js`
  - Verify no additional normalization happens after load

**Testing**: Load races/classes/backgrounds and verify original proficiency casing preserved in memory
- `src/renderer/scripts/core/Character.js`
  - `hasProficiency()` - Normalize both sides of comparison
  - `addProficiency()` - Normalize when checking duplicates
  - `removeProficiency()` - Normalize when finding match
  - `_normalizeProficienciesInLoadedData()` - Keep for old save file compatibility

- `src/renderer/scripts/modules/proficiencies/ProficiencyCard.js`
  - Line 755: `const normalizedProf = profString.toLowerCase().trim();` → Use `DataNormalizer.normalizeString()`
  - Line 764: Similar normalization → Use `DataNormalizer.normalizeString()`
  - Lines 445-482: Skill/tool selection matching → Normalize both sides
  - Lines 519-641: Choice processing → Normalize for comparisons

- `src/renderer/scripts/modules/proficiencies/ProficiencyCalculator.js`
  - Line 63: `const normalized = skillName.toLowerCase().trim();` → Use `DataNormalizer.normalizeString()`
  - Line 142: `merged.add(item.toLowerCase().trim());` → Use `DataNormalizer.normalizeString()`
  - Line 162-164: Proficiency finding → Normalize both sides

- `src/renderer/scripts/modules/race/RaceCard.js`
  - Line 858: `const languageName = key.toLowerCase();` → Use `DataNormalizer.normalizeString()`
  - Line 864: `character.addProficiency('languages', race.name.toLowerCase(), 'Race');` → Normalize
  - Line 901: `const lowercaseOptions = value.from.map((lang) => lang.toLowerCase());` → Normalize
  - Weapon/tool proficiency processing → Normalize when adding to character

- `src/renderer/scripts/modules/class/ClassCard.js`
  - Similar proficiency processing → Normalize when adding to character
  - Line 749: Tool proficiency processing → Normalize for lookups

- `src/renderer/scripts/modules/background/BackgroundCard.js`
  - Similar proficiency processing → Normalize when adding to character

### Section 3: Remove Display Transformations
**Status**: not-started
**Impact**: MEDIUM - Visual display only
**Strategy**: Display original JSON values directly, no transformation

**Files**:
- `src/renderer/scripts/modules/race/RaceDetails.js`
  - Line 108: `ability.charAt(0).toUpperCase() + ability.slice(1)` → Just use `ability`
  - Line 131: Same pattern → Just use `ability`
  - Line 231: `type.charAt(0).toUpperCase() + type.slice(1)` → Just use `type`
  - Line 276: `lang.charAt(0).toUpperCase() + lang.slice(1)` → Just use `lang`

- `src/renderer/scripts/modules/class/ClassDetails.js`
  - Line 249: `.map((word) => word.charAt(0).toUpperCase() + word.slice(1))` → Remove mapping, use original
  - Line 259: Same pattern → Use original
  - Line 511: `key.charAt(0).toUpperCase() + key.slice(1)` → Just use `key`

- `src/renderer/scripts/modules/background/BackgroundDetails.js`
  - Line 163: `.map((word) => word.charAt(0).toUpperCase() + word.slice(1))` → Use original
  - Line 174: Same pattern → Use original
  - Line 206: Same pattern → Use original
  - Line 232: `lang.charAt(0).toUpperCase() + lang.slice(1)` → Just use `lang`

- `src/renderer/scripts/modules/proficiencies/ProficiencyDisplay.js`
  - Line 304: `type.charAt(0).toUpperCase() + type.slice(1)` → Just use `type`

**Note**: Some fields like ability score keys ("str", "dex") may legitimately be lowercase in JSON and need display transformation. Audit each case.

### Section 4: Update Save File Backward Compatibility
**Status**: not-started
**Impact**: CRITICAL - Must not break existing saves
**Strategy**: Normalize proficiencies when LOADING old saves, but save new data with original casing

**Files**:
- `src/renderer/scripts/core/Character.js`
  - `_normalizeProficienciesInLoadedData()` - Keep this function active
  - Purpose: Convert old lowercase saves to work with new mixed-case lookups
  - When saving: Use original casing from JSON
  - When loading: Normalize old data if detected (all lowercase = old format)

### Section 5: Handle Edge Cases
**Status**: not-started
**Impact**: MEDIUM
**Cases to handle**:

1. **Ability scores**: JSON uses lowercase keys ("str", "dex", "con")
   - These should stay lowercase internally
   - Use `abbreviateAbility()` from TextFormatter for display ("STR", "DEX", "CON")

2. **Race unique languages**: `race.name.toLowerCase()` pattern
   - Keep normalizing race name when used as language
   - Original: "Elvish" (from JSON)
   - Derived: "elf" (from race name) → Should display as race name

3. **User input**: Free-text proficiencies
   - Normalize on save
   - Display as entered by user

4. **Source codes**: "PHB", "DMG", "XGTE"
   - Already uppercase in JSON, keep as-is

### Section 6: Testing & Validation
**Status**: not-started

**Test Cases**:
1. Load race with languages → Verify "Common", "Elvish" displayed correctly
2. Load class with skills → Verify "Animal Handling", "Sleight of Hand" displayed correctly
3. Load background → Verify all proficiencies display with original casing
4. Add character proficiency → Verify lookup works regardless of input casing
5. Save character → Verify proficiencies saved with original JSON casing
6. Load old save file → Verify backward compatibility works
7. Compare proficiencies → Verify case-insensitive matching works
8. Check for duplicates → Verify "common" vs "Common" treated as same

**Files to test**:
- All unit tests in `tests/` directory
- Manual testing with multiple races, classes, backgrounds
- Test old character saves (pre-refactor)
- Test new character saves (post-refactor)

## Implementation Notes
- **CRITICAL**: Do NOT break save file compatibility
- **DO**: Test with old saves before committing
- **DO**: Preserve exact JSON casing for display
- **DO**: Normalize only for comparisons/lookups
- **DO NOT**: Add manual casing transforms
- **DO NOT**: Assume all proficiency names need capitalization (some may be acronyms, proper nouns, etc.)

## Files Summary

### Core Data (5 files)
- DataLoader.js - Remove normalization calls
- DataNormalizer.js - Keep as utility only
- Character.js - Normalize comparisons, keep backward compat
- RaceService.js - Verify no normalization
- ClassService.js - Verify no normalization

### Cards (3 files)  
- RaceCard.js - Normalize when adding proficiencies
- ClassCard.js - Normalize when adding proficiencies
- BackgroundCard.js - Normalize when adding proficiencies

### Details/Display (4 files)
- RaceDetails.js - Remove manual capitalization (4 locations)
- ClassDetails.js - Remove manual capitalization (3 locations)
- BackgroundDetails.js - Remove manual capitalization (4 locations)
- ProficiencyDisplay.js - Remove manual capitalization (1 location)

### Proficiency System (2 files)
- ProficiencyCard.js - Normalize comparisons (5+ locations)
- ProficiencyCalculator.js - Normalize lookups (3 locations)

**Total: ~14 files, ~30+ specific locations**

## Migration Path

### Phase 2A: Preparation (No Breaking Changes)
1. Add TODO comments at all locations that will change
2. Create backup branch
3. Document current behavior with screenshots
4. Run all tests and record baseline

### Phase 2B: Core Changes (Breaking)
1. Remove JSON normalization in DataLoader
2. Update all comparison points to normalize
3. Remove display transformations
4. Test each file independently

### Phase 2C: Integration Testing
1. Test all proficiency flows end-to-end
2. Verify save/load compatibility
3. Test with multiple races/classes/backgrounds
4. Visual verification of display casing

### Phase 2D: Validation & Cleanup
1. Remove old normalization code that's no longer used
2. Update any remaining manual transforms
3. Run full test suite
4. Document new pattern for future developers

---

## Old Implementation (Phase 1) - DEPRECATED

The following sections describe the Phase 1 approach which normalized at load time.
This approach is being REVERSED in favor of preserving original JSON casing.

### Key Finding: Internal Storage Convention (DEPRECATED)
- ~~**Internal format**: All proficiencies should be stored in **lowercase**~~
- **NEW**: Store proficiencies with **original JSON casing**
- ~~**Display format**: Use `toTitleCase()` for rendering in UI~~
- **NEW**: Display proficiencies with **original JSON casing**, no transformation

### 1. RaceCard.js (Lines 938, 960) - DEPRECATED APPROACH
Phase 1 normalized at storage time. Phase 2 will preserve original casing.

---

## Phase 1 Results (DEPRECATED)

Phase 1 normalized all proficiencies to lowercase at load time and used `toTitleCase()` for display.
This approach had the following issues:
- Lost original JSON casing intent ("Sleight of Hand" became "Sleight Of Hand")
- Required manual transforms in 13+ locations
- Inconsistent capitalization rules
- Data loss - couldn't recover original casing

Phase 2 will reverse this by preserving original JSON casing throughout.

---

## Expected Outcome - Phase 2 Complete

After Phase 2 implementation:

### Data Flow
```
JSON File → Load (NO normalization) → Memory (Original casing) → Display (Original casing)
                                                ↓
                                          Comparisons (Normalize both sides)
```

### Example: Language Proficiencies
- **JSON**: `"common": true, "elvish": true`
- **In Memory**: `"common", "elvish"` (lowercase as authored)
- **Display**: "Common", "Elvish" (capitalize only keys that are lowercase)
- **Comparison**: Both normalized to lowercase for matching

Wait - checking JSON format more carefully...

### Example: Corrected Based on Actual JSON
- **JSON**: `"Common": true, "Elvish": true` (if capitalized in JSON)
- **In Memory**: `"Common", "Elvish"` (exact as authored)
- **Display**: "Common", "Elvish" (exact as authored)
- **Comparison**: Both normalized to "common", "elvish" for matching

### What Changes
**Before (Phase 1):**
- JSON: "Animal Handling" → Normalized: "animal handling" → Display: "Animal Handling" (via toTitleCase)

**After (Phase 2):**
- JSON: "Animal Handling" → No change: "Animal Handling" → Display: "Animal Handling" (direct)

### Benefits
1. **Simpler code** - No display transformations needed
2. **Preserves intent** - JSON authors' casing choices respected
3. **Less error-prone** - No manual capitalization logic to maintain
4. **Better maintainability** - One source of truth (the JSON)
5. **Consistent lookups** - Normalization only at comparison points

### Risks Mitigated
- ✅ Backward compatibility maintained via `_normalizeProficienciesInLoadedData()`
- ✅ Case-insensitive lookups preserved via comparison-time normalization
- ✅ No breaking changes to existing functionality
- ✅ Tests updated to reflect new behavior
