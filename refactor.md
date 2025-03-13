# Refactoring Guide

This document outlines groups of related files that need to be considered together during refactoring due to their tight coupling and interdependencies.

## 1. Core Character System
These files form the foundation of the character system and need to be refactored together:
- `app/js/models/Character.js` - Core character model
- `app/js/utils/Initialize.js` - Character initialization and manager setup
- `app/js/utils.js` - Shared utilities and character-related functions

## 2. Race Management System
These files handle race-related functionality and must be refactored as a unit:
- `app/js/managers/RaceManager.js` - Race management logic
- `app/js/ui/RaceUI.js` - Race-related UI components
- `app/js/models/Race.js` - Race data model
- `app/js/models/Subrace.js` - Subrace data model
- `app/js/utils/DataLoader.js` - Race data loading functionality

## 3. Class Management System
These files handle class-related functionality:
- `app/js/managers/ClassManager.js` - Class management logic
- `app/js/ui/ClassUI.js` - Class-related UI components
- `app/js/models/Class.js` - Class data model
- `app/js/models/Subclass.js` - Subclass data model
- `app/js/utils/DataLoader.js` - Class data loading functionality

## 4. Background and Characteristics System
These files manage character backgrounds and traits:
- `app/js/managers/BackgroundManager.js` - Background management
- `app/js/managers/CharacteristicManager.js` - Characteristic management
- `app/js/ui/BackgroundUI.js` - Background UI components
- `app/js/models/Characteristic.js` - Characteristic data model
- `app/js/utils/DataLoader.js` - Background data loading

## 5. Equipment and Items System
These files handle equipment and inventory:
- `app/js/managers/EquipmentManager.js` - Equipment management
- `app/js/managers/PackManager.js` - Starting equipment packs
- `app/js/managers/StartingEquipmentManager.js` - Starting equipment logic
- `app/js/ui/EquipmentUI.js` - Equipment UI components
- `app/js/utils/DataLoader.js` - Equipment data loading

## 6. Ability Scores and Proficiencies System
These files manage ability scores and proficiencies:
- `app/js/ui/AbilityScoreUI.js` - Ability score UI
- `app/js/managers/ProficiencyManager.js` - Proficiency management
- `app/js/ui/ProficiencyUI.js` - Proficiency UI components

## 7. Spells and Features System
These files handle spells and character features:
- `app/js/managers/SpellManager.js` - Spell management
- `app/js/managers/FeatManager.js` - Feat management
- `app/js/managers/OptionalFeatureManager.js` - Optional feature management
- `app/js/utils/DataLoader.js` - Spell and feature data loading

## 8. Data Management and Source Control
These files handle data loading and source book management:
- `app/js/utils/DataLoader.js` - Core data loading functionality
- `app/js/managers/SourceManager.js` - Source book management
- `app/js/ui/SourceUI.js` - Source selection UI
- `app/js/utils/ReferenceResolver.js` - Data reference resolution
- `app/js/utils/TextProcessor.js` - Text processing utilities

## Refactoring Priorities

1. **Data Loading Consolidation**
   - The `DataLoader.js` file is involved in multiple systems and needs to be refactored first
   - Consider splitting into domain-specific loaders
   - Implement proper caching and lazy loading

2. **Manager-UI Decoupling**
   - Reduce direct dependencies between UI and manager classes
   - Implement proper event system for updates
   - Consider implementing a proper state management system

3. **Model Standardization**
   - Standardize model classes (Race, Class, Background, etc.)
   - Implement consistent serialization/deserialization
   - Remove duplicate code in model handling

4. **Legacy Code Removal**
   - Update all references to use new character system
   - Clean up deprecated functions and properties

5. **Error Handling and Validation**
   - Implement consistent error handling across all systems
   - Add proper validation for data loading and processing
   - Improve error reporting and recovery

## Notes
- Many files have circular dependencies that need to be resolved
- The `DataLoader.js` file is too large and handles too many responsibilities
- UI components are tightly coupled with their respective managers
- Error handling is inconsistent across different modules
- Some legacy code remains from previous refactoring attempts


