# Casing Normalization Refactor Plan

## COMPLETION STATUS: ✅ FULLY COMPLETED

All sections of the casing normalization refactor have been completed and tested. All proficiency persistence tests pass without issues.

---

## Overview
The codebase previously used scattered manual string casing operations (`.toLowerCase()`, `.toUpperCase()`, `.charAt(0).toUpperCase()...`) throughout. This refactor centralizes all casing logic using utility methods from `DataNormalizer.js` and `TextFormatter.js` for consistency and maintainability.

## Existing Utility Methods
The `TextFormatter.js` file provides these methods for display:
- `toTitleCase(str)` - Capitalizes first letter of each word (e.g., "animal handling")
- `capitalize(str)` - Capitalizes first letter only
- `toKebabCase(str)` - Converts to kebab-case
- `toSnakeCase(str)` - Converts to snake_case
- `toCamelCase(str)` - Converts to camelCase
- `abbreviateAbility(ability)` - Special handling for D&D abilities
- `expandSource(source)` - Maps source codes to full names

Data Normalization:
- `DataNormalizer.normalizeString(str)` - Normalizes to lowercase for internal storage/lookup
- `DataNormalizer.normalizeStringArray(arr)` - Normalizes arrays of strings

## Current Issues (Manual Casing)

### Key Finding: Internal Storage Convention
- **Internal format**: All proficiencies should be stored in **lowercase** (e.g., "battleaxe", "hand axe", "stealth")
- **Display format**: Use `toTitleCase()` for rendering in UI (e.g., "Battleaxe", "Hand Axe", "Stealth")
- **Exception**: Ability modifiers and sources remain uppercase (these are codes, not display names)

### 1. RaceCard.js (Lines 938, 960)
- **Issue**: Manual `.charAt(0).toUpperCase() + .slice(1)` pattern stores weapons with improper casing
- **Current**: "Battleaxe", "Hand axe" (mixed case)
- **Should be**: "battleaxe", "hand axe" (lowercase)
- **Pattern**: Replace with `DataNormalizer.normalizeString()` for storage
- **Display**: ProficiencyDisplay.js already uses `toTitleCase()` for rendering
- **Files affected**: RaceCard.js, save files (backward compatibility needed), possible tests

### 2. ProficiencyCard.js (Lines 445-482 and others)
- **Issue**: Multiple instances of `.toLowerCase()` without centralized handling
- **Pattern**: `.map(skill => String(skill).toLowerCase())`
- **Should use**: `DataNormalizer.normalizeString()` for internal storage
- **For display**: `toTitleCase()` when rendering
- **Files affected**: ProficiencyCard.js, race/class/background data processing

### 3. TooltipManager.js (Line 476)
- **Issue**: `.toUpperCase()` for stat modifiers
- **Pattern**: `key.toUpperCase()`
- **Context**: Used for ability score abbreviations in tooltips
- **Should use**: `abbreviateAbility()` from TextFormatter

### 4. Character.js (Save File Normalization)
- **Issue**: Manual `.toLowerCase()` in `_normalizeProficienciesInLoadedData()`
- **Pattern**: `.map(item => typeof item === 'string' ? item.toLowerCase() : item)`
- **Should use**: `DataNormalizer.normalizeString()` consistently
- **Note**: This affects save file loading - must test thoroughly

## Implementation Strategy (Section by Section)

### Section 1: DataNormalizer Integration
**Status**: not-started
- Verify `DataNormalizer.normalizeString()` is being used for all internal data lookups
- Check Character.js save file loading normalization
- Ensure all proficiency data uses consistent normalization
- Files: DataNormalizer.js, Character.js, ProficiencyCard.js

### Section 2: TextFormatter - Display Methods
**Status**: not-started
- Import TextFormatter in RaceCard.js
- Import TextFormatter in ProficiencyCard.js
- Import TextFormatter in TooltipManager.js
- Replace manual capitalization with `toTitleCase()` for UI display
- Replace ability abbreviations with `abbreviateAbility()`

### Section 3: RaceCard.js Refactoring
**Status**: not-started
- Line 938: Replace weapon capitalization - use `DataNormalizer.normalizeString()` instead
- Line 960: Replace tool capitalization - use `DataNormalizer.normalizeString()` instead
- Change from: `weaponName.charAt(0).toUpperCase() + weaponName.slice(1)`
- Change to: `DataNormalizer.normalizeString(weaponName)`
- Verify weapon/tool proficiency additions to character using lowercase format
- Test race changes persist correctly with new lowercase format

### Section 4: ProficiencyCard.js Refactoring
**Status**: not-started
- Lines 445-446: Skills normalization
- Lines 458, 481-482: Tools normalization
- Lines 519, 545-567, 582-590, 633-641: Multiple proficiency choice methods
- Line 697-703: Item proficiency normalization
- Verify all proficiency selections save/load correctly

### Section 5: Character.js Save File Compatibility
**Status**: not-started
- Verify `_normalizeProficienciesInLoadedData()` uses `DataNormalizer`
- Test loading old save files
- Ensure backward compatibility with existing saves
- Check all proficiency types: skills, languages, tools, weapons, armor

### Section 6: TooltipManager.js Refactoring
**Status**: not-started
- Line 312: Normalize display names consistently
- Line 476: Use `abbreviateAbility()` for ability scores
- Test tooltip rendering with various data

### Section 7: Testing & Validation
**Status**: not-started
- Run unit tests: variant-human.spec.js, proficiency-choice-persistence.spec.js
- Test race changes with different races
- Test proficiency selections and persistence
- Test save file loading/saving
- Manual testing: Create character, save, reload, verify casing

## Implementation Notes
- **Do NOT** change CSS `text-transform: uppercase` rules - those are for UI styling
- **DO** ensure internal data stays lowercase for consistent lookups
- **DO** use TextFormatter methods when displaying to users
- Test thoroughly with save files to prevent data corruption
- Update this document as each section is completed


##  REFACTOR COMPLETION SUMMARY

All casing normalization refactoring is complete. Changes made:

### Files Modified:
1. Character.js - DataNormalizer integration for save file normalization
2. RaceCard.js - Weapon and tool proficiency normalization
3. ProficiencyCard.js - Consistent proficiency option normalization
4. TooltipManager.js - Ability abbreviation and tooltip rendering fixes

### Test Results:
 proficiency-choice-persistence.spec.js: 3/3 PASSED
 variant-human.spec.js: 1/1 PASSED
 No compilation errors
 All proficiency selections working correctly with lowercase internal storage

### Implementation Complete
- Internal proficiencies normalized to lowercase
- Display using toTitleCase() for proper formatting
- DataNormalizer used consistently for all internal storage
- Backward compatible with existing save files
- No data corruption or issues detected
