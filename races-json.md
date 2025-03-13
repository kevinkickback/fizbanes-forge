### Base Implementation
- Uses separate entries for base race and subraces
- Subraces are individual objects that reference the parent race
- Structure:
  ```json
  {
    "name": "Subrace Name",
    "source": "PHB",
    "raceName": "Parent Race",
    "raceSource": "PHB",
    "ability": [
      {
        "specific_ability": number
      }
    ],
    "entries": [...],
    "hasFluff": true
  }
  ```

### Key Features
1. **Direct Reference System**
   - Subraces explicitly reference parent race
   - Uses `raceName` and `raceSource` fields
   - Inherits base race traits automatically

2. **Ability Score Handling**
   - Subrace provides additional ability score increases
   - Stacks with parent race bonuses
   - Fixed values for each ability score

3. **Trait Implementation**
   - Adds subrace-specific traits through `entries` array
   - Maintains separate trait lists from parent race
   - No override mechanism for parent traits

## XPHB Structure
```markdown
### Base Implementation
- Uses a lineage-based system
- Integrates subraces as "lineages" within the main race entry
- Structure:
  ```json
  {
    "name": "Race Name",
    "source": "XPHB",
    "_versions": [
      {
        "name": "Race; Lineage Name",
        "source": "XPHB",
        "_mod": {
          "entries": {
            "mode": "replaceArr",
            "replace": "LineageFeature",
            "items": {...}
          }
        }
      }
    ]
  }
  ```

### Key Features
1. **Lineage System**
   - Uses `_versions` array for different subraces
   - Modular design with `_mod` system
   - Allows for dynamic trait modification

2. **Ability Score Handling**
   - More flexible ability score system
   - Often allows choice of ability scores
   - Uses variant rules for customization

3. **Trait Implementation**
   - Uses replacement and modification system
   - Can override or modify parent traits
   - Includes level-based progression

## Comparison of Implementation Methods

### 1. Data Organization
- **PHB**: Flat structure with separate entries
- **XPHB**: Nested structure with versions and modifications
- **Evolution**: XPHB shows more sophisticated data organization

### 2. Flexibility
- **PHB**: Fixed traits and abilities
- **XPHB**: Modular system with customization options
- **Benefit**: XPHB allows easier updates and modifications

### 3. Feature Inheritance
- **PHB**: Simple inheritance from parent race
- **XPHB**: Complex modification system with explicit overrides
- **Impact**: XPHB provides more control over inherited features

### 4. Level Progression
- **PHB**: Static features
- **XPHB**: Supports level-based feature progression
- **Advantage**: XPHB better supports character development

## Other Source Implementations

### MPMM (Monsters of the Multiverse)
- Follows XPHB's lineage-based approach
- Adds additional modernization
- Includes backward compatibility

### VGM (Volo's Guide to Monsters)
- Hybrid approach between PHB and XPHB
- Maintains PHB's separate entry system
- Includes some modular features

### DMG (Dungeon Master's Guide)
- Uses PHB's basic structure
- Simpler implementation
- Focus on customization guidelines

## Technical Notes

1. **Migration Considerations**
   - Many PHB subraces include `reprintedAs` references to XPHB
   - XPHB structure supports easier updates
   - Better handles modern D&D design philosophy

2. **Compatibility**
   - PHB structure remains supported
   - XPHB provides backward compatibility
   - Modern sources tend to use XPHB approach

3. **Data Management**
   - XPHB requires more complex parsing
   - Better supports digital tools
   - More efficient for updates and modifications

Would you like me to elaborate on any specific aspect of these implementations?

You have a great understanding. With this knowledge please adjust (fix) the @DataLoader.js  /  @RaceManager.js  / @RaceUI.js  logic to properly add the correct sub races to the parent race. It currently works with the XPHB format but does not really work with old PHB format. 
--------------------------------------------------------------------------------------------

Based on the data, here are the official PHB (Player's Handbook) elf subraces:
High Elf
Ability Score Increase: Intelligence +1
Extra Language
Cantrip from wizard spell list
Elf Weapon Training (proficiency with longsword, shortsword, shortbow, and longbow)
Wood Elf
Ability Score Increase: Wisdom +1
Fleet of Foot (35 ft. walking speed)
Mask of the Wild (can hide in natural phenomena)
Elf Weapon Training (proficiency with longsword, shortsword, shortbow, and longbow)
Dark Elf (Drow)
Ability Score Increase: Charisma +1
Superior Darkvision (120 ft.)
Sunlight Sensitivity
Drow Magic (dancing lights cantrip, faerie fire and darkness spells)
Drow Weapon Training (proficiency with rapiers, shortswords, and hand crossbows)
All PHB elf subraces share these base elf traits:
Ability Score Increase: Dexterity +2
Age: Mature at 100, live to ~750 years
Size: Medium (5-6 feet tall)
Base Speed: 30 feet
Darkvision: 60 feet
Keen Senses (Perception proficiency)
Fey Ancestry (advantage vs. charm, immune to sleep magic)
Trance (4-hour meditation instead of sleep)
Languages: Common and Elvish
Note: While other elf subraces exist in other sourcebooks (like Eladrin in the DMG, Sea Elves in MTF, etc.), these three are the official PHB subraces.