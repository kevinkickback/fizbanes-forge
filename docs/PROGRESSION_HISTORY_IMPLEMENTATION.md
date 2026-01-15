# Progression History Implementation - Option B

**Status**: In Progress
**Last Updated**: January 14, 2026
**Purpose**: Enable class level removal with proper benefit cleanup for Level-Up Modal and Build Page

---

## Overview

Implement a progression history tracking system that records user choices at each class level, enabling:
- Level removal with automatic benefit cleanup
- Choice modification on Build Page
- Full backwards-compatible tracking of character progression

---

## Implementation Plan

### Phase 1: Foundation (Reusable for Build Page)
**Status**: ✅ COMPLETE

- [x] Create `ProgressionHistoryService.js` - Core, agnostic history manager
- [x] Extend `CharacterSchema.js` - Add progressionHistory field
- [x] Update `Character.js` serialization (no changes needed - plain object serializes automatically)

**Files Created**:
- `src/services/ProgressionHistoryService.js` ✅

**Files Modified**:
- `src/app/CharacterSchema.js` ✅
- `src/app/Character.js` (no changes needed - serializes automatically)

---

### Phase 2: Recording Choices in Level-Up Session
**Status**: Not Started

- [ ] Extend `LevelUpSession.js` - Track user choices during session
- [ ] Update `Step2ASIFeat.js` - Record ASI/feat choices
- [ ] Update `Step3SpellSelection.js` - Record spell selections
- [ ] Update `Step1ClassFeatures.js` - Record feature selections
- [ ] Update `LevelUpModal.js` - Save recorded choices on confirm

**Files to Modify**:
- `src/app/LevelUpSession.js`
- `src/ui/components/level/steps/Step1ClassFeatures.js`
- `src/ui/components/level/steps/Step2ASIFeat.js`
- `src/ui/components/level/steps/Step3SpellSelection.js`
- `src/ui/components/level/Modal.js`

---

### Phase 3: Remove Button UI & Logic
**Status**: Not Started

- [ ] Add "-" button to `Step0LevelMulticlass.js`
- [ ] Implement removal handler in `LevelUpService.js`
- [ ] Recalculate character stats after removal
- [ ] Test removal across multiclass scenarios

**Files to Modify**:
- `src/ui/components/level/steps/Step0LevelMulticlass.js`
- `src/services/LevelUpService.js`

---

### Phase 4: Polish & Integration
**Status**: Not Started

- [ ] Test multiclass scenarios
- [ ] Validate stat recalculation
- [ ] Add safety checks (can't go below level 1)
- [ ] Document Build Page integration points

---

## Schema Design

### progressionHistory Structure
```javascript
progressionHistory: {
  'Fighter': { 
    1: { choices: {...}, timestamp: null },
    2: { choices: {...}, timestamp: null },
    5: { choices: {...}, timestamp: null }
  },
  'Rogue': { 
    1: { choices: {...}, timestamp: null },
    3: { choices: {...}, timestamp: null }
  }
}
```

### Choice Recording Format
```javascript
{
  features: [],              // IDs of chosen features
  spells: [],                // Names/IDs of chosen spells
  fightingStyle: 'Archery',  // Mutually exclusive choices
  eldritchInvocations: [],   // Invocation choices
  expertiseChoices: [],      // Rogue expertise choices
  asi: null,                 // ASI selection (if applicable)
  featChoice: null,          // Feat choice (if applicable)
  // ... any other user-prompted choice
}
```

---

## Key Design Decisions

1. **What to Record**:
   - All user-choice driven selections (spells, fighting styles, invocations, features)
   - Static benefits are NOT recorded; recalculated from ClassService/5etools JSON

2. **What to Recalculate** (on level removal):
   - Hit points (from hit die + CON modifier)
   - Proficiencies (from class progression data)
   - Base features (from ClassService progression)
   - Spell slots (from spellcasting progression)

3. **Schema Format**:
   - Nested by class name, then level number
   - Favors clarity and easy querying by class/level

4. **Backwards Compatibility**:
   - Not required; new characters will have progressionHistory from start
   - Existing characters get progressionHistory on first level-up

5. **Build Page Integration**:
   - ProgressionHistoryService is completely agnostic to UI context
   - Both Level-Up Modal and Build Page can use same API

---

## ProgressionHistoryService API

### Core Methods

**`recordChoices(character, className, level, choices)`**
- Store what was chosen at a specific level
- Creates/updates progressionHistory entry

**`getChoices(character, className, level)`**
- Retrieve recorded choices for a specific level
- Returns choice object or null if not found

**`removeChoices(character, className, level)`**
- Remove a level's recorded choices
- Used when removing a class level

**`getChoicesByRange(character, className, fromLevel, toLevel)`**
- Get all choices within a level range for a class
- Useful for querying progression

**`getClassLevelHistory(character, className)`**
- Get entire history for a class (all levels)

**`clearClassHistory(character, className)`**
- Wipe all progression history for a class

---

## Integration Touchpoints

### Level-Up Modal
1. As user makes choices in steps, LevelUpSession tracks them
2. On confirm, Modal calls `ProgressionHistoryService.recordChoices()`
3. Character is saved with updated progressionHistory

### Remove Button (Phase 3)
1. User clicks "-" on class card
2. Handler calls `LevelUpService.removeLevelBenefits()`
3. Removes recorded choices via `ProgressionHistoryService`
4. Recalculates static benefits from ClassService
5. Updates progressionHistory

### Build Page (Future)
1. Shows current progression history for each class
2. Allows modification of past choices
3. Updates progressionHistory on changes
4. Re-records modified choices

---

## Testing Checklist

- [ ] Single-class level removal works
- [ ] Multiclass level removal for specific class works
- [ ] Cannot remove level 1
- [ ] HP recalculated correctly after removal
- [ ] Spell lists updated correctly
- [ ] Feat/ASI choices removed
- [ ] Proficiencies recalculated
- [ ] Progression history persists to disk
- [ ] Existing saved characters can still be opened

---

## Next Steps

1. ✅ Create this documentation
2. → Create ProgressionHistoryService.js (Phase 1)
3. Extend CharacterSchema.js (Phase 1)
4. Update Character.js (Phase 1)
5. Integrate with level-up modal (Phase 2)
6. Implement remove button (Phase 3)
7. Polish & test (Phase 4)

---

## Notes

- Consider lazy initialization of progressionHistory for existing characters
- Error handling for missing choices (shouldn't happen but be defensive)
- Timestamp tracking optional but useful for debugging/audit trail
