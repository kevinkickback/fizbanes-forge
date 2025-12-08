# Proficiency Loading Bug

## Root Cause

When a character is loaded with saved optional proficiencies (skills, languages, tools):

- The top-level `character.optionalProficiencies.skills.selected` array is correctly restored from saved data
- BUT the source-specific arrays (`skills.race.selected`, `skills.class.selected`, `skills.background.selected`) start empty
- When RaceCard, ClassCard, or BackgroundCard initialize, they reconstruct the top-level selected arrays from the source-specific ones
- Since source arrays are empty, this wipes out the saved selections, leaving `selected = []`

## The Fix

Modify the reconstruction logic in three files:

- **RaceCard.js**: `_updateCombinedProficiencyOptions()` and `_updateCombinedSkillOptions()`
- **ClassCard.js**: `_updateCombinedSkillOptions()`
- **BackgroundCard.js**: `_updateCombinedSkillOptions()` and `_updateCombinedLanguageOptions()`

Key changes: Instead of blindly reconstructing from source-specific arrays:

```javascript
// OLD - loses saved selections
character.optionalProficiencies.skills.selected = [
    ...new Set([...raceSelected, ...classSelected, ...backgroundSelected])
];

// NEW - preserves existing selections if source arrays are empty
const sourceSelections = [...raceSelected, ...classSelected, ...backgroundSelected];
character.optionalProficiencies.skills.selected =
    sourceSelections.length > 0
        ? [...new Set(sourceSelections)]
        : existingSkillSelections; // Keep saved data if sources are empty
```
---


# Casing logic issue

## Solution: Align with Existing Architecture
Based on the codebase patterns, here's the best approach that:

- Creates minimal new files (maybe just 1 utility file if needed)
- Accepts JSON data as-is (no data modifications)
- Follows existing service patterns (like SkillService, ActionService)
- No backwards compatibility needed

### Key Architectural Patterns Observed

- **Service Layer with Case-Insensitive Maps** - Services like SkillService, ActionService, ConditionService all use Map with `.toLowerCase()` keys for O(1) lookups
- **Centralized Utilities** - TextFormatter.js handles display formatting
- **Single Responsibility** - Services manage data, Views handle display, Controllers coordinate
- **Normalization at Boundaries** - Data adapters in RaceCard, ClassCard, BackgroundCard

## The Solution

### 1. Update ProficiencyService (Main Fix)

Make it normalize skill names consistently like other services:

```javascript
// In ProficiencyService.js constructor
this._skillAbilityMap = new Map([
  ['acrobatics', 'dexterity'],
  ['animalhandling', 'wisdom'],  // No spaces in keys
  ['arcana', 'intelligence'],
  ['athletics', 'strength'],
  // ... etc
]);

// Normalization helper (private method)
_normalizeSkillKey(skill) {
  if (!skill) return '';
  return String(skill).toLowerCase().replace(/\s+/g, '');  // Remove spaces
}

// Updated getSkillAbility
getSkillAbility(skill) {
  const key = this._normalizeSkillKey(skill);
  return this._skillAbilityMap.get(key) || null;
}

// Updated getAvailableSkills - return lowercase for internal use
async getAvailableSkills() {
  if (this._skills) return [...this._skills];
  
  return [
    'acrobatics',
    'animal handling',  // Keep spaces for display
    'arcana',
    // ... etc - matches JSON source format
  ];
}
```

### 2. Update Data Processing (RaceCard, ClassCard, BackgroundCard)

Normalize at the point where JSON data enters the system:

```javascript
// In RaceCard._processSkillProficiencies
const capitalizedOptions = profObj.choose.from.map(skill => {
  // Keep original casing from JSON for internal storage
  return skill;  // DON'T capitalize - store as-is from JSON
});
```

Remove all these capitalizations:

- RaceCard.js line ~1043: Remove `skill.charAt(0).toUpperCase() + skill.slice(1)`
- BackgroundCard.js line ~163: Similar capitalization removal

### 3. Update ProficiencySelection.js

Remove ALL `.toLowerCase()` normalization - just use exact values:

```javascript
// Remove normalizedProf variables entirely
_toggleSkillProficiency(profItem, proficiency, character) {
  const skillOptions = character.optionalProficiencies.skills;
  
  // Use proficiency directly - no normalization
  const raceOptions = skillOptions.race?.options || [];
  const classOptions = skillOptions.class?.options || [];
  // ... etc
  
  // Direct comparisons
  const isRaceOption = raceAllowsAny || raceOptions.includes(proficiency);
  // ... etc
}
```

### 4. Update ProficiencyDisplay.js

Add display formatting using existing TextFormatter:

```javascript
import { toTitleCase } from '../../utils/TextFormatter.js';

_buildItemHtml(cssClasses, item, type, ...) {
  // Format for display ONLY
  const displayName = type === 'skills' ? toTitleCase(item) : item;
  
  // Store original value in data attribute
  return `<div class="${cssClasses.join(' ')}" 
              data-proficiency="${item}" 
              data-type="${type}">
            <i class="${iconClass}"></i>${displayName}
            ${abilityText}
          </div>`;
}
```

### 5. Update ProficiencyCalculator.js (Optional)

Already has SKILL_ABILITIES with lowercase keys - just update the helper:

```javascript
export function getSkillAbility(skillName) {
  if (!skillName) return null;
  const normalized = skillName.toLowerCase().trim().replace(/\s+/g, '');
  return SKILL_ABILITIES[normalized] || null;
}
```

## Summary of Changes

| File | Change | Lines |
|------|--------|-------|
| ProficiencyService.js | Convert map to case-insensitive, add normalize helper | ~30 |
| ProficiencySelection.js | Remove all `.toLowerCase()` calls | ~-50 |
| ProficiencyDisplay.js | Add toTitleCase for display | ~5 |
| RaceCard.js | Remove skill capitalization in processing | ~-10 |
| BackgroundCard.js | Remove skill capitalization | ~-5 |
| Proficiency.js (Core) | Update exact match comparisons | ~-5 |
| ProficiencyCalculator.js | Update normalize to remove spaces | ~5 |
| **Total** | **~7 file edits, 0 new files needed** | |

## Why This Works

✅ **Minimal Changes** - Uses existing patterns from other services  
✅ **No New Files** - Leverages existing TextFormatter.js  
✅ **Accepts JSON As-Is** - Skills stored as they come from data files (lowercase)  
✅ **Consistent Pattern** - Matches SkillService, ActionService, etc.  
✅ **No Breaking Changes** - New saves start clean  
✅ **Separation of Concerns** - Storage (lowercase) vs Display (Title Case)  

This follows the exact same pattern as `SkillService.getSkill(skillName)` which does:

```javascript
getSkill(skillName) {
  return this._skillMap.get(skillName.toLowerCase()) || null;
}
```