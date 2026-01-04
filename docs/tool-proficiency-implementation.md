# Tool Proficiency Implementation

**Date:** January 4, 2026  
**Status:** ✅ Complete (with bugfix applied)

## Overview

This document details the implementation status of tool proficiency tracking, selection, and visual feedback in the Fizbane's Forge character creator, including a critical bugfix for class-based tool choices.

## Bug Discovery & Fix

### Issue Identified
During testing, it was discovered that:
- ✅ Charlatan background's fixed tool proficiencies (Disguise kit, Forgery kit) worked correctly
- ❌ Bard class's tool **choices** (choose 3 musical instruments) were **not** being set up for selection
- ❌ Visual indicators were not displaying for tools (original issue, now fixed)

### Root Cause
The `ClassCard._updateProficiencies()` method was only processing the `startingProficiencies.tools` field (which contains display text like "three {@item musical instrument|PHB|musical instruments} of your choice"), but was **not** processing the separate `startingProficiencies.toolProficiencies` field which contains the actual choice logic (e.g., `{"anyMusicalInstrument": 3}`).

### Solution Implemented
Added `_processClassToolProficiencies()` method to ClassCard that:
1. Processes the `toolProficiencies` field separately
2. Handles `anyMusicalInstrument` special case for Bard
3. Handles general `any` tool choices
4. Handles `choose.from` specific tool lists
5. Sets up `character.optionalProficiencies.tools.class` with appropriate allowed/options/selected values

**Files Modified:**
- `ClassCard.js` - Added tool proficiency choice processing

## Background

The proficiency card on the build page displays character proficiencies based on race, class, and background selections. Each proficiency category (skills, languages, tools, armor, weapons) supports both default (granted) and optional (choice) values. While skills and languages had complete working tracking and visual feedback, tools were missing source-specific visual indicators.

## Implementation Status

### ✅ Complete Features

#### 1. **Tool Options Display**
- **Location:** [`ProficiencyConstants.js`](../src/renderer/scripts/utils/ProficiencyConstants.js)
- **Status:** Working
- **Details:** 24 standard D&D 5e tool options are defined and displayed:
  - 17 Artisan's tools (Alchemist's supplies, Brewer's supplies, Calligrapher's supplies, Carpenter's tools, Cartographer's tools, Cobbler's tools, Cook's utensils, Glassblower's tools, Jeweler's tools, Leatherworker's tools, Mason's tools, Painter's supplies, Potter's tools, Smith's tools, Tinker's tools, Weaver's tools, Woodcarver's tools)
  - 5 Kits (Disguise kit, Forgery kit, Herbalism kit, Poisoner's kit, Thieves' tools)
  - Navigator's tools
  - Musical instrument

#### 2. **Source-Specific Tracking**
- **Location:** [`ProficiencyCard.js`](../src/renderer/scripts/modules/proficiencies/ProficiencyCard.js)
- **Status:** Working
- **Details:** Tools maintain separate tracking for each source:
  ```javascript
  character.optionalProficiencies.tools = {
      allowed: 0,                    // Combined/legacy allowed count
      options: [],                   // Combined/legacy options list
      selected: [],                  // Combined selection list
      race: {
          allowed: 0,                // Race-specific slot count
          options: [],               // Race-specific tool options
          selected: []               // Race-specific selections
      },
      class: {
          allowed: 0,
          options: [],
          selected: []
      },
      background: {
          allowed: 0,
          options: [],
          selected: []
      }
  }
  ```

#### 3. **Selection/Deselection Logic**
- **Location:** [`ProficiencySelection.js`](../src/renderer/scripts/modules/proficiencies/ProficiencySelection.js)
- **Status:** Working
- **Methods:**
  - `_toggleToolProficiency()` - Main toggle handler
  - `_selectTool()` - Adds tool to appropriate source with prioritization
  - `_deselectTool()` - Removes tool from correct source
- **Logic Flow:**
  1. Prioritizes specific tool lists over "any" tool options
  2. Assigns to class → background → race order for specific lists
  3. Falls back to "any" sources if tool not in specific lists
  4. Updates both source-specific and combined selection arrays
  5. Validates slot availability per source

#### 4. **Availability Checking**
- **Location:** [`ProficiencyCard.js`](../src/renderer/scripts/modules/proficiencies/ProficiencyCard.js) (lines 631-676)
- **Status:** Working
- **Details:** `_isProficiencyAvailable()` method checks:
  - Whether tool is already granted by a fixed source
  - Available slots per source (race/class/background)
  - Whether tool is in source's options list or allowed via "any"
  - Current selection count vs. allowed count per source

#### 5. **Cleanup on Source Changes**
- **Location:** [`ProficiencyCard.js`](../src/renderer/scripts/modules/proficiencies/ProficiencyCard.js) (lines 832-899)
- **Status:** Working
- **Details:** `_cleanupSourceSpecificProficiencies()` is called when race/class/background changes and:
  - Removes tools from optional selections if they become granted by a fixed source
  - Ensures no source has more selections than allowed slots
  - Updates the combined selection list to reflect all source changes
  - Emits `CHARACTER_UPDATED` event when changes are detected
- **Triggered By:**
  - `RACE_CHANGED` event (line 351)
  - `CLASS_CHANGED` event (line 351)
  - `BACKGROUND_CHANGED` event (line 374)
  - `PROFICIENCY_CHANGED` event (line 386)

#### 6. **Source-Specific Visual Indicators** ✨ NEW
- **Location:** [`ProficiencyDisplay.js`](../src/renderer/scripts/modules/proficiencies/ProficiencyDisplay.js) (line 158)
- **Status:** ✅ Implemented (January 4, 2026)
- **Details:** Tools now receive source-specific CSS classes when selectable:
  - `race-only` - Tool option only available from race
  - `class-only` - Tool option only available from class
  - `background-only` - Tool option only available from background
- **Visual Effect:** Colored borders indicate which source provides each tool option
- **Implementation:** Added `type === 'tools'` condition to existing `_addSourceSpecificClasses()` logic

## Code Changes

### Modified Files

#### 1. `src/renderer/scripts/modules/proficiencies/ProficiencyDisplay.js`

**Change 1:** Fixed slot availability calculation for source-tracked proficiencies

```javascript
// Before: Only checked legacy 'allowed' field
const optionalAllowed = character?.optionalProficiencies?.[type]?.allowed || 0;
const combinedSlotsAvailable = optionalAllowed > 0 && selectedCount < optionalAllowed;

// After: Sums up source-specific slots for skills/languages/tools
let optionalAllowed = character?.optionalProficiencies?.[type]?.allowed || 0;
if (type === 'skills' || type === 'languages' || type === 'tools') {
    const raceAllowed = character?.optionalProficiencies?.[type]?.race?.allowed || 0;
    const classAllowed = character?.optionalProficiencies?.[type]?.class?.allowed || 0;
    const backgroundAllowed = character?.optionalProficiencies?.[type]?.background?.allowed || 0;
    if (raceAllowed > 0 || classAllowed > 0 || backgroundAllowed > 0) {
        optionalAllowed = raceAllowed + classAllowed + backgroundAllowed;
    }
}
const combinedSlotsAvailable = optionalAllowed > 0 && selectedCount < optionalAllowed;
```

**Change 2:** Removed source-specific colored borders

```javascript
// Removed: Source-specific CSS classes for race-only, class-only, background-only
// Only two visual states remain: default (granted) and selected (optional choice)
```

**Impact:** 
- Tools (and skills/languages) now correctly show as selectable when sources provide choices
- Visual design is consistent - only default (granted) vs selected (optional) states
- No colored borders to indicate which source provides an option (simplified UX)

#### 2. `src/renderer/scripts/modules/class/ClassCard.js` 🐛 BUGFIX

**Change 1:** Modified `_updateProficiencies()` to skip display strings and call new processing method

```javascript
// Add tool proficiencies (fixed proficiencies from tools field)
const toolProficiencies = this._getToolProficiencies(classData);
if (toolProficiencies && toolProficiencies.length > 0) {
    for (const tool of toolProficiencies) {
        // Skip display strings like "Choose X tools"
        if (!tool.toLowerCase().startsWith('choose')) {
            character.addProficiency('tools', tool, 'Class');
        }
    }
}

// Handle tool proficiency choices (from toolProficiencies field)
this._processClassToolProficiencies(classData, character);
```

**Change 2:** Added new `_processClassToolProficiencies()` method

```javascript
/**
 * Process tool proficiency choices from class data
 * Handles special fields like anyMusicalInstrument for Bard
 * @param {Object} classData - Class JSON object
 * @param {Object} character - Character object
 * @private
 */
_processClassToolProficiencies(classData, character) {
    const toolProfs = classData?.startingProficiencies?.toolProficiencies;
    if (!toolProfs || !Array.isArray(toolProfs)) return;

    for (const profObj of toolProfs) {
        // Handle "any musical instrument" choice (e.g., Bard with anyMusicalInstrument: 3)
        if (profObj.anyMusicalInstrument) {
            const count = profObj.anyMusicalInstrument;
            character.optionalProficiencies.tools.class.allowed = count;
            character.optionalProficiencies.tools.class.options = ['Musical instrument'];
            character.optionalProficiencies.tools.class.selected = [];
            return; // Bard only has musical instruments, no other tool options
        }

        // Handle "any" tool proficiency choice
        if (profObj.any && profObj.any > 0) {
            character.optionalProficiencies.tools.class.allowed = profObj.any;
            character.optionalProficiencies.tools.class.options = ['any'];
            character.optionalProficiencies.tools.class.selected = [];
        }

        // Handle choose from specific list
        if (profObj.choose) {
            const count = profObj.choose.count || 1;
            const options = profObj.choose.from || [];
            character.optionalProficiencies.tools.class.allowed = count;
            character.optionalProficiencies.tools.class.options = options;
            character.optionalProficiencies.tools.class.selected = [];
        }
    }
}
```

**Impact:** Bard and other classes with tool choices now properly set up optional tool proficiency selections. The tools section will show:
- "Musical instrument" as selectable (3 times for Bard)
- Appropriate colored border indicating it's a class-only option
- Selection counter showing progress (e.g., "Tools (1/3 selected)")

## Code Changes (Summary)

The source-specific colors are defined in [`main.css`](../src/renderer/styles/main.css) and can be customized:

```css
:root {
    --race-only-color: #4a9eff;      /* Blue for race-only options */
    --class-only-color: #ff6b6b;     /* Red for class-only options */
    --background-only-color: #51cf66; /* Green for background-only options */
}
```

## Testing Scenarios

To verify tool proficiency implementation:

1. **Display Test:**
   - Navigate to Build page
   - Verify all 24 tool options are displayed in the Tools section
   - All tools should be in disabled state (grayed out) by default

2. **Source Selection Test:**
   - Select a race with tool proficiency options (e.g., Mountain Dwarf with Smith's tools)
   - Verify granted tools show as proficient (highlighted, not selectable)
   - Select a race with tool choice (e.g., Half-Elf with "any" tool)
   - Verify selectable tools show as clickable (no special color, just hover state)
   - **Select Bard class** ✨
   - **Verify "Musical instrument" appears as selectable (clickable, not disabled)**
   - **Verify selection counter shows "Tools (0/3 selected)"**
   - **Click "Musical instrument" three times to select all 3 slots**
   - **Verify each selection shows as highlighted with "selected" styling**

3. **Source Change Test:**
   - Select a background with tool choice (e.g., Guild Artisan with artisan's tools choice)
   - Select a tool (e.g., Smith's tools)
   - Change to a different background without tool choices
   - Verify selected tool is removed from selection
   - Verify combined selection list is updated

4. **Multiple Sources Test:**
   - Select race with 1 tool choice
   - Select class with tool proficiencies (e.g., Rogue with Thieves' tools)
   - Select background with 1 tool choice
   - Verify each source tracks selections independently
   - Verify selection counter shows correct count
   - Verify tools available from multiple sources don't show source-specific border

5. **"Any" Tool Test:**
   - Select options that grant "choose any tool"
   - Verify all 24 tools become selectable
   - Verify selection respects per-source slot limits
   - Verify changing source removes "any" selections from that source

## Known Limitations

None identified. Tool proficiency implementation is feature-complete and consistent with skills and languages.

**Note:** Musical instrument is treated as a single tool option. In D&D 5e, there are many specific instruments (lute, flute, drum, etc.), but the current implementation treats them as one generic "Musical instrument" proficiency.

## Future Enhancements

Potential improvements for consideration:

1. **Musical Instrument Variants:** Expand "Musical instrument" into specific instruments (lute, flute, drum, etc.)
2. **Gaming Sets:** Add gaming set proficiencies (dice set, playing card set, dragonchess set, etc.) per D&D rules
3. **Vehicle Proficiencies:** Add land vehicles and water vehicles as separate tool categories
4. **Tool Tooltips:** Add hover tooltips describing what each tool is used for

## Related Files

- [`ClassCard.js`](../src/renderer/scripts/modules/class/ClassCard.js) - Main controller, **now processes toolProficiencies field** 🐛
- [`ProficiencyCard.js`](../src/renderer/scripts/modules/proficiencies/ProficiencyCard.js) - Main controller
- [`ProficiencyDisplay.js`](../src/renderer/scripts/modules/proficiencies/ProficiencyDisplay.js) - View/rendering logic, **now includes tools in source-specific styling** ✨
- [`ProficiencySelection.js`](../src/renderer/scripts/modules/proficiencies/ProficiencySelection.js) - Selection handling
- [`ProficiencyConstants.js`](../src/renderer/scripts/utils/ProficiencyConstants.js) - Standard tool list
- [`ProficiencyService.js`](../src/renderer/scripts/services/ProficiencyService.js) - Service layer
- [`main.css`](../src/renderer/styles/main.css) - CSS variables for theming

## References

- [D&D 5e Tool Proficiencies (5etools)](https://5e.tools/items.html#alchemist's%20supplies_phb)
- [Bard Class (PHB)](https://5e.tools/classes.html#bard_phb) - Example of `anyMusicalInstrument` field
- [Project Architecture](../.github/copilot-instructions.md)
