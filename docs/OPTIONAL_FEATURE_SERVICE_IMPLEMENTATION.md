# Optional Feature Service Implementation

## Summary
Implemented comprehensive class feature selection logic for the level-up modal, including metamagic, fighting styles, eldritch invocations, and maneuvers. This replaces the mock data placeholder with real 5etools data.

## What Was Done

### 1. Created OptionalFeatureService (`src/services/OptionalFeatureService.js`)
- **Purpose**: Service layer for managing optional class features (metamagic, maneuvers, invocations, fighting styles, etc.)
- **Data Source**: Loads from `src/data/optionalfeatures.json` (5etools standard format)
- **Key Methods**:
  - `getMetamagicOptions()` - Sorcerer metamagic choices
  - `getManeuvers()` - Battle Master maneuvers  
  - `getEldritchInvocations()` - Warlock invocations
  - `getFightingStyles(className)` - Fighting styles for Fighter/Ranger/Paladin
  - `getPactBoons()` - Warlock pact boons
  - `getArtificerInfusions()` - Artificer infusions
  - `getFeaturesByType(types)` - Generic query by feature type codes
  - `meetsPrerequisites(feature, character)` - Prerequisite checking (basic implementation)

### 2. Updated Step1ClassFeatures (`src/ui/components/level/steps/Step1ClassFeatures.js`)
- **Before**: Used mock data in `_getFeatureOptions()` method
- **After**: 
  - Queries real optional feature data via `optionalFeatureService`
  - Applies source filtering (respects character's enabled sourcebooks)
  - Maps feature types to appropriate service methods:
    - `metamagic` → getMetamagicOptions()
    - `maneuver` → getManeuvers()
    - `invocation` → getEldritchInvocations()
    - `fighting-style` → getFightingStyles(className)
    - `patron` → getPactBoons()
  - Extracts and formats descriptions from 5etools entries
  - Returns UI-friendly option structure

### 3. Integrated into AppInitializer (`src/app/AppInitializer.js`)
- Added `optionalFeatureService` to parallel data loading
- Loads alongside other game data services (spells, items, classes, etc.)
- Ensures service is initialized before UI components need it

## Feature Type Codes (from optionalfeatures.json)
- **EI**: Eldritch Invocations (Warlock)
- **MM**: Metamagic (Sorcerer)
- **MV:B**: Maneuvers - Battle Master (Fighter)
- **FS:F**: Fighting Style - Fighter
- **FS:R**: Fighting Style - Ranger
- **FS:P**: Fighting Style - Paladin
- **FS:B**: Fighting Style - General
- **AI**: Artificer Infusions
- **PB**: Pact Boon (Warlock)
- **AS**: Arcane Shot (Arcane Archer)
- **ED**: Elemental Discipline (Monk)
- **RN**: Rune (Rune Knight)
- **RP**: Rune Priest

## Architecture Decision
Following the project's architecture rules:
- ✅ **Service layer for data access** - Created OptionalFeatureService instead of loading JSON directly in UI
- ✅ **Reuse 5etools structure** - Uses existing optionalfeatures.json without custom parsing
- ✅ **Source filtering** - Applies sourceService.isSourceAllowed() consistently
- ✅ **Shared logic placement** - Service can be reused by ClassCard or other components (not just level-up modal)

## Testing Recommendations
1. Create a Sorcerer and level up to 3 (Metamagic selection)
2. Create a Fighter and level up to 3 (Battle Master with Maneuvers)
3. Create a Warlock and level up to 2 (Eldritch Invocations)
4. Create a Fighter/Ranger/Paladin and verify Fighting Style selection
5. Test with different enabled source books (PHB only vs PHB+XGE+TCE)
6. Verify source filtering excludes options from disabled books

## Future Enhancements
- **Prerequisite checking**: Currently basic; could be enhanced to check:
  - Spell prerequisites for invocations
  - Pact boon requirements
  - Character level requirements
- **Feature replacement**: Some classes allow swapping features at level-up
- **Feature descriptions**: Could render full 5etools entries with tags parsed
- **Repeatable features**: Some invocations can be taken multiple times (e.g., Agonizing Blast 2024)

## Related Files
- Service: `src/services/OptionalFeatureService.js` (NEW)
- Consumer: `src/ui/components/level/steps/Step1ClassFeatures.js` (UPDATED)
- Bootstrap: `src/app/AppInitializer.js` (UPDATED)
- Data: `src/data/optionalfeatures.json` (existing 5etools file)

## No Breaking Changes
- Existing subclass selection logic unchanged
- Mock data replaced with real data, but UI structure remains the same
- Backward compatible with existing LevelUpSession data format
