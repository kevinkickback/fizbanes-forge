# Code Cleanup Guide

This document tracks code that can be safely removed after each phase of the refactor is completed and verified working.

## Phase 1 Cleanup

### In `character.js`

1. **Card Creation Functions**
   - Remove `createCharacterCard` - replaced by `EntityCard` class
   - Remove `createRaceCard` - replaced by `EntityCard` class
   - Remove `createClassCard` - replaced by `EntityCard` class
   - Remove `createBackgroundCard` - replaced by `EntityCard` class

2. **Individual Card Templates**
   - Remove any duplicate card template strings in favor of the unified `EntityCard` rendering

### In `data-loader.js`

1. **Old Reference Processing**
   - Remove old `processText` function - replaced by enhanced version with unified reference handling
   - Remove individual reference processing functions in favor of the unified `resolveJsonRef` system

2. **Individual Entity Processing**
   - Remove individual entity processing functions in favor of the unified `processEntityData` function
   - This includes separate processors for races, classes, items, etc.

### In `utils.js`

1. **Old Tooltip System**
   - Remove any old tooltip initialization code
   - Remove old tooltip event handlers
   - Remove old tooltip positioning code

2. **Old Card Utilities**
   - Remove any helper functions specifically for old card creation
   - Remove any duplicate card styling utilities

### In `main.css`

1. **Old Card Styles**
   - Remove individual card style blocks that are now handled by `.entity-card`
   - Remove duplicate card header/body/footer styles
   - Remove old card-specific animations or transitions

2. **Old Tooltip Styles**
   - Remove any old tooltip-related CSS classes
   - Remove old tooltip positioning styles
   - Remove old tooltip animation classes

### Notes
- Before removing any code, verify that:
  1. All tests for Phase 1 pass
  2. The new implementations fully cover the old functionality
  3. No other parts of the application depend on the old code
  4. All features using the new system work as expected

- Keep any code that:
  1. Is still being used by unrefactored parts of the application
  2. Provides backward compatibility that might be needed
  3. Contains important comments or documentation that should be preserved

### Verification Steps
1. Run all Phase 1 tests
2. Test all UI components that used the old card system
3. Verify tooltip functionality across all reference types
4. Check that all entity types render correctly with the new system
5. Verify that no console errors appear after cleanup 

## Phase 2 Cleanup

### In `character.js`

1. **Race Management Functions**
   - Remove `setRace` - replaced by `RaceManager.setRace`
   - Remove `setSubrace` - replaced by `RaceManager.setRace` with subrace parameter
   - Remove direct race feature application code - now handled by `RaceManager`
   - Remove race-specific ability score modification code
   - Remove direct race data access - now handled through `RaceService`
   - Remove race caching logic - now handled by `RaceService`

2. **Race Data Processing**
   - Remove old race data validation code
   - Remove race-specific trait processing
   - Remove direct race feature application logic
   - Remove direct subrace handling code - now in `Subrace` class

3. **New Module Integration**
   - Verify all imports from `core/models/Race.js`
   - Verify all imports from `core/models/Subrace.js`
   - Verify all imports from `core/services/RaceService.js`
   - Check all forwarding functions are properly implemented

### In `data-loader.js`

1. **Race Data Loading**
   - Remove old race data loading functions - now in `RaceService`
   - Remove race-specific data processing - now in `Race` and `Subrace` models
   - Remove individual race feature processors
   - Remove race caching logic - now in `RaceService`

2. **Race Feature Processing**
   - Remove individual race trait processors - now in `Race` model
   - Remove race ability score processors - now in `Race` model
   - Remove race language processors - now in `Race` model
   - Remove subrace merging logic - now in `Subrace` model

### In `utils.js`

1. **Race-Related Utilities**
   - Remove old race validation functions
   - Remove race-specific helper functions
   - Remove deprecated race feature processing utilities
   - Remove any race-specific caching utilities

### In HTML Templates

1. **Race Selection UI**
   - Remove old race selection event handlers
   - Remove deprecated race UI update functions
   - Clean up unused race-related data attributes
   - Update to use new Race model methods

### Parallel Structure Verification

1. **New Module Structure**
   - Verify `core/models/Race.js` implementation
   - Verify `core/models/Subrace.js` implementation
   - Verify `core/services/RaceService.js` implementation
   - Check all module exports and imports

2. **Compatibility Layer**
   - Verify all forwarding functions in `character.js`
   - Test backward compatibility with existing code
   - Check global namespace pollution
   - Verify race service initialization

### Notes
- Before removing any code, verify that:
  1. All tests for Phase 2 pass
  2. The RaceManager fully handles all race-related functionality
  3. Race selection and feature application work correctly
  4. Ability score choices are properly handled
  5. The new Race and Subrace models work as expected
  6. RaceService properly manages race data and caching

- Keep any code that:
  1. Is still being used by unrefactored parts of the application
  2. Provides backward compatibility for other features
  3. Contains important documentation about race mechanics
  4. Is required for the parallel structure strategy

### Verification Steps
1. Run all Phase 2 tests
2. Test race selection UI functionality
3. Verify subrace selection and feature application
4. Check ability score modifications
5. Verify race feature application
6. Test race-specific traits and abilities
7. Ensure no console errors after cleanup
8. Verify all new module imports work
9. Test RaceService caching
10. Verify Race and Subrace model functionality

## Phase 3 Cleanup

### In `character.js`

1. **Class Management Functions**
   - Remove `setClass` - replaced by `ClassManager.setClass`
   - Remove `setSubclass` - replaced by `ClassManager.setSubclass`
   - Remove direct class feature application code - now handled by `ClassManager`
   - Remove class-specific spellcasting code - now handled by `SpellManager`
   - Remove direct class data access - now handled through `ClassService`
   - Remove class caching logic - now handled by `ClassService`

2. **Class Data Processing**
   - Remove old class data validation code
   - Remove class-specific feature processing
   - Remove direct class feature application logic
   - Remove direct subclass handling code - now in `Subclass` class
   - Remove spell slot calculation code - now in `SpellcastingService`

3. **New Module Integration**
   - Verify all imports from `core/models/Class.js`
   - Verify all imports from `core/models/Subclass.js`
   - Verify all imports from `core/services/ClassService.js`
   - Verify all imports from `core/services/SpellcastingService.js`
   - Check all forwarding functions are properly implemented

### In `data-loader.js`

1. **Class Data Loading**
   - Remove old class data loading functions - now in `ClassService`
   - Remove class-specific data processing - now in `Class` and `Subclass` models
   - Remove individual class feature processors
   - Remove class caching logic - now in `ClassService`
   - Remove spell data loading - now in `SpellcastingService`

2. **Class Feature Processing**
   - Remove individual class feature processors - now in `Class` model
   - Remove class spellcasting processors - now in `SpellcastingService`
   - Remove subclass merging logic - now in `Subclass` model
   - Remove spell preparation logic - now in `SpellcastingService`

### In `utils.js`

1. **Class-Related Utilities**
   - Remove old class validation functions
   - Remove class-specific helper functions
   - Remove deprecated class feature processing utilities
   - Remove any class-specific caching utilities
   - Remove spell slot calculation utilities

### In HTML Templates

1. **Class Selection UI**
   - Remove old class selection event handlers
   - Remove deprecated class UI update functions
   - Clean up unused class-related data attributes
   - Update to use new Class model methods
   - Remove old spellcasting UI code

### Notes
- Before removing any code, verify that:
  1. All tests for Phase 3 pass
  2. The ClassManager fully handles all class-related functionality
  3. Class selection and feature application work correctly
  4. Spellcasting mechanics work as expected
  5. The new Class and Subclass models work as expected
  6. ClassService properly manages class data and caching

- Keep any code that:
  1. Is still being used by unrefactored parts of the application
  2. Provides backward compatibility for other features
  3. Contains important documentation about class mechanics
  4. Is required for the parallel structure strategy

### Verification Steps
1. Run all Phase 3 tests
2. Test class selection UI functionality
3. Verify subclass selection and feature application
4. Check spellcasting functionality
5. Verify class feature application
6. Test class-specific abilities
7. Ensure no console errors after cleanup
8. Verify all new module imports work
9. Test ClassService caching
10. Verify Class and Subclass model functionality
11. Test spell preparation and casting
12. Verify multiclass functionality

## Parallel Structure Strategy

### Overview
Due to the size of `character.js` and its central role in the PHASE documents, we will implement a parallel structure strategy:

1. **New Directory Structure**
   ```
   app/js/
   ├── character.js (original - kept for PHASE compatibility)
   └── core/
       ├── managers/              # Manager classes
       │   ├── RaceManager.js
       │   ├── ClassManager.js
       │   ├── BackgroundManager.js
       │   ├── EquipmentManager.js
       │   ├── InventoryManager.js
       │   ├── SpellManager.js
       │   ├── FeatureManager.js
       │   ├── PackManager.js
       │   ├── StartingEquipmentManager.js
       │   ├── AttunementManager.js
       │   ├── CharacteristicManager.js
       │   ├── FeatManager.js
       │   ├── OptionalFeatureManager.js
       │   └── CharacterManager.js
       ├── models/               # Data models
       │   ├── Race.js
       │   ├── Subrace.js
       │   ├── Class.js
       │   ├── Subclass.js
       │   ├── Background.js
       │   ├── Characteristic.js
       │   ├── Item.js
       │   ├── Weapon.js
       │   ├── Armor.js
       │   ├── Pack.js
       │   ├── StartingEquipment.js
       │   ├── Feature.js
       │   ├── Spell.js
       │   ├── Feat.js
       │   └── OptionalFeature.js
       ├── services/            # Business logic
       │   ├── RaceService.js
       │   ├── ClassService.js
       │   ├── BackgroundService.js
       │   ├── EquipmentService.js
       │   ├── MagicItemService.js
       │   ├── PackService.js
       │   ├── EquipmentChoiceService.js
       │   ├── SpellcastingService.js
       │   ├── FeatService.js
       │   ├── PrerequisiteService.js
       │   └── ProficiencyService.js
       ├── ui/                  # UI components
       │   ├── EntityCard.js
       │   ├── CharacterCard.js
       │   ├── TooltipManager.js
       │   └── components/
       │       ├── RaceUI.js
       │       ├── ClassUI.js
       │       └── BackgroundUI.js
       ├── data/                # Core data and state
       │   ├── DataLoader.js
       │   ├── CharacterState.js
       │   └── ValidationRules.js
       └── utils/               # Utility functions
           ├── ReferenceResolver.js
           ├── TextProcessor.js
           ├── AbilityScores.js
           ├── Proficiencies.js
           └── Features.js
   ```

2. **Implementation Strategy**
   - Create the new structure alongside existing code
   - Move code piece by piece as each PHASE is completed
   - Update imports in new files to point to original `character.js` until migration is complete
   - Add compatibility layer in `character.js` to forward calls to new structure

3. **Migration Process**
   - After each PHASE completion:
     1. Move the newly refactored code to its proper place in the new structure
     2. Add forwarding in `character.js` to the new location
     3. Update the CLEANUP.md with new file locations
   - Keep `character.js` as the main entry point until all PHASEs are complete

4. **Documentation**
   - Add comments in `character.js` indicating which sections have been moved
   - Update JSDoc comments to indicate deprecated sections
   - Maintain a mapping of old functions to new locations

### Benefits
1. Maintains compatibility with PHASE documents
2. Allows gradual migration of code
3. Provides better organization for new features
4. Reduces risk of breaking existing functionality

### Example Migration Pattern
```javascript
// In character.js
// @deprecated - Moved to core/managers/RaceManager.js
function setRace(raceId, subraceId) {
    return require('./core/managers/RaceManager').setRace(raceId, subraceId);
}

// In core/managers/RaceManager.js
export function setRace(raceId, subraceId) {
    // New implementation
}
```

### Verification Steps for Each Migration
1. Run tests for the current PHASE
2. Verify forwarding functions work correctly
3. Check for circular dependencies
4. Ensure documentation is updated
5. Verify no regression in existing functionality

### Final Cleanup
After all PHASEs are complete:
1. Remove forwarding functions from `character.js`
2. Update all direct references to use new structure
3. Archive original `character.js` for reference
4. Update build process to use new structure 

## Phase 4 Cleanup

### In `character.js`

1. **Equipment Management Functions**
   - Remove `addItem` - replaced by `EquipmentManager.addItem`
   - Remove `removeItem` - replaced by `EquipmentManager.removeItem`
   - Remove `equipItem` - replaced by `EquipmentManager.equipItem`
   - Remove `unequipItem` - replaced by `EquipmentManager.unequipItem`
   - Remove `attuneItem` - replaced by `AttunementManager.attuneItem`
   - Remove `unattuneItem` - replaced by `AttunementManager.unattuneItem`
   - Remove `getEquippedItems` - replaced by `EquipmentManager.getEquippedItems`
   - Remove `getAttunedItems` - replaced by `AttunementManager.getAttunedItems`
   - Remove `getInventoryWeight` - replaced by `InventoryManager.getInventoryWeight`

2. **Equipment Data Processing**
   - Remove old equipment data validation code
   - Remove equipment-specific feature processing
   - Remove direct equipment feature application logic
   - Remove equipment caching logic - now handled by `EquipmentService`
   - Remove magic item processing - now handled by `MagicItemService`

3. **New Module Integration**
   - Verify all imports from `core/managers/EquipmentManager.js`
   - Verify all imports from `core/managers/InventoryManager.js`
   - Verify all imports from `core/managers/AttunementManager.js`
   - Verify all imports from `core/services/EquipmentService.js`
   - Verify all imports from `core/services/MagicItemService.js`
   - Check all forwarding functions are properly implemented

### In `data-loader.js`

1. **Equipment Data Loading**
   - Remove old equipment data loading functions - now in `EquipmentService`
   - Remove equipment-specific data processing - now in `Item` models
   - Remove individual equipment feature processors
   - Remove equipment caching logic - now in `EquipmentService`
   - Remove magic item loading - now in `MagicItemService`

2. **Equipment Feature Processing**
   - Remove individual equipment feature processors - now in `Item` models
   - Remove equipment property processors - now in `Item` models
   - Remove magic item processors - now in `MagicItemService`
   - Remove attunement logic - now in `AttunementManager`

### In `utils.js`

1. **Equipment-Related Utilities**
   - Remove old equipment validation functions
   - Remove equipment-specific helper functions
   - Remove deprecated equipment feature processing utilities
   - Remove any equipment-specific caching utilities
   - Remove magic item utilities

### In HTML Templates

1. **Equipment Selection UI**
   - Remove old equipment selection event handlers
   - Remove deprecated equipment UI update functions
   - Clean up unused equipment-related data attributes
   - Update to use new Equipment model methods
   - Remove old magic item UI code

### Notes
- Before removing any code, verify that:
  1. All tests for Phase 4 pass
  2. The EquipmentManager fully handles all equipment-related functionality
  3. Equipment selection and feature application work correctly
  4. Magic item mechanics work as expected
  5. The new Item models work as expected
  6. EquipmentService properly manages equipment data and caching

- Keep any code that:
  1. Is still being used by unrefactored parts of the application
  2. Provides backward compatibility for other features
  3. Contains important documentation about equipment mechanics
  4. Is required for the parallel structure strategy

### Verification Steps
1. Run all Phase 4 tests
2. Test equipment selection UI functionality
3. Verify equipment slot management
4. Check magic item functionality
5. Verify equipment feature application
6. Test equipment-specific abilities
7. Ensure no console errors after cleanup
8. Verify all new module imports work
9. Test EquipmentService caching
10. Verify Item model functionality
11. Test attunement system
12. Verify inventory management

### Parallel Structure Strategy
1. **New Module Structure**
   - Verify `core/managers/EquipmentManager.js` implementation
   - Verify `core/managers/InventoryManager.js` implementation
   - Verify `core/managers/AttunementManager.js` implementation
   - Verify `core/services/EquipmentService.js` implementation
   - Verify `core/services/MagicItemService.js` implementation
   - Verify `core/models/Item.js` implementation
   - Verify `core/models/Weapon.js` implementation
   - Verify `core/models/Armor.js` implementation

2. **Compatibility Layer**
   - Verify all forwarding functions in `character.js`
   - Test backward compatibility with existing code
   - Check global namespace pollution
   - Verify equipment service initialization

### Testing Strategy
1. Write tests for new equipment management modules
2. Ensure existing equipment functionality works through compatibility layer
3. Add new tests for enhanced equipment features
4. Verify no regressions in existing equipment functionality 