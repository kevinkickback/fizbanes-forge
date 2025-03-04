# Character Creator Refactor

## Overview
This refactor aims to enhance the D&D 5e character creator by implementing a unified data processing system and improving cross-component integration. The refactor is organized into seven phases, each building upon the previous ones to create a cohesive and maintainable codebase.

## How to Use This Refactor Guide

### Getting Started
1. Each phase is documented in its own markdown file (PHASE1.md through PHASE7.md)
2. Each phase file contains:
   - Overview of the phase's goals
   - Integration notes for existing files
   - Implementation steps with code examples
   - Testing procedures
   - Implementation order

### Implementation Process
1. **Read Through All Phases First**
   - Understand the complete picture before starting
   - Note dependencies between phases
   - Identify potential challenges

2. **Follow Phase Order**
   - Start with Phase 1 (Core Reference System)
   - Complete each phase before moving to the next
   - Verify integration points between phases

3. **For Each Phase**
   - Review the Integration Notes section
   - Back up affected files
   - Follow the Implementation Steps in order
   - Run the provided tests
   - Verify functionality before proceeding

4. **Testing Between Phases**
   - Run the test suite after each phase
   - Verify integration with previous phases
   - Document any deviations or improvements

### File Structure
```
REFACTOR/
├── README.md           # This guide
├── PHASE1.md          # Core Reference System
├── PHASE2.md          # Race System
├── PHASE3.md          # Class System
├── PHASE4.md          # Equipment System
├── PHASE5.md          # Equipment Packs
├── PHASE6.md          # Backgrounds
└── PHASE7.md          # Feats
```

## Phase Structure

### Phase 1: Core Reference System
**Goal**: Establish the foundation for all other phases
- Unified data processing system
- Reference resolution system
- EntityCard UI component system
- Tooltip system
- CSS framework

**Key Files**:
- `data-loader.js`
- `utils.js`
- `character.js`
- `main.css`

### Phase 2: Race System
**Goal**: Implement race and subrace handling
- Race data processing
- Subrace integration
- Ability score management
- Racial features

**Key Files**:
- Race-related JSON files
- Race UI components
- Character race management

### Phase 3: Class System
**Goal**: Implement class and subclass handling
- Class data processing
- Subclass integration
- Feature progression
- Spellcasting system

**Key Files**:
- Class-related JSON files
- Class UI components
- Character class management

### Phase 4: Equipment System
**Goal**: Implement equipment and item handling
- Item data processing
- Equipment management
- Magic item integration
- Attunement system

**Key Files**:
- Item-related JSON files
- Equipment UI components
- Inventory management

### Phase 5: Equipment Packs
**Goal**: Enhance equipment system with packs
- Pack data processing
- Starting equipment
- Bundle management
- Equipment choices

**Key Files**:
- Pack-related JSON files
- Pack UI components
- Starting equipment UI

### Phase 6: Background System
**Goal**: Implement background handling
- Background data processing
- Proficiency system
- Characteristic management
- Feature integration

**Key Files**:
- Background-related JSON files
- Background UI components
- Proficiency management

### Phase 7: Feat System
**Goal**: Implement feat and optional feature handling
- Feat data processing
- Optional feature integration
- Prerequisite validation
- Feature management

**Key Files**:
- Feat-related JSON files
- Feat UI components
- Feature management

## Integration Points

### HTML Integration
- Each phase includes specific changes to `index.html`
- Templates are updated progressively
- Components use unified EntityCard system

### JavaScript Integration
- Unified data loading through `data-loader.js`
- Consistent state management in `character.js`
- Shared utilities in `utils.js`
- Event handling standardization

### CSS Integration
- Unified styling system
- Component-specific styles
- Shared variables and utilities
- Responsive design support

## Data Files
- Primary data in `app/data/` directory
- Reference implementation in `app/5etools/`
- JSON format following 5e.tools structure
- Fluff content in separate files

## Best Practices

### Code Organization
1. Keep related code together
2. Use consistent naming conventions
3. Document complex logic
4. Add error handling

### Testing
1. Test each component individually
2. Verify integration points
3. Test edge cases
4. Document test cases

### Performance
1. Implement caching
2. Lazy load data
3. Batch UI updates
4. Monitor memory usage

### Error Handling
1. Validate input data
2. Provide user feedback
3. Log errors appropriately
4. Implement recovery strategies

## Troubleshooting

### Common Issues
1. **Cache Invalidation**
   - Clear cache when updating data
   - Verify cache contents
   - Check cache expiration

2. **State Management**
   - Monitor state changes
   - Debug race conditions
   - Verify data consistency

3. **UI Updates**
   - Check event handlers
   - Verify DOM updates
   - Test responsive behavior

### Debug Tools
1. Browser Developer Tools
2. VS Code Debugger
3. Console logging
4. Performance profiler

## Contributing
1. Follow the established patterns
2. Document changes
3. Add tests
4. Update integration notes

## Future Considerations
1. Add support for homebrew content
2. Implement data migration tools
3. Add advanced validation
4. Enhance performance monitoring

## Notes
1. JSON data files are in `app/data/` folder
2. 5e.tools reference implementation in `app/5etools/`
3. Follow phase order for best results
4. Test thoroughly between phases
5. Document any deviations

## Known Integration Challenges

1. **State Management**
   - Multiple managers updating shared state
   - Race conditions in updates
   - Cache invalidation

2. **Performance**
   - Large JSON file loading
   - Deep reference resolution
   - UI update batching

3. **Data Consistency**
   - Cross-entity validation
   - Prerequisite checking
   - Feature stacking

4. **Error Handling**
   - Failed operations
   - Invalid references
   - State recovery

## Implementation Notes

1. All JSON data files are located in `app/data/` folder
2. Reference implementation can be found in `app/5etools/`
3. Each phase builds upon the core system in Phase 1
4. Integration tests should be added for each phase
5. Performance monitoring should be implemented

### NOTES
1. the .json files being used by this app can be found in app/data/ folder
2. The entire 5e.tools web app which this new implimentation is based off of can 
   be found in app/5etools folder for reference.

### IF YOU UNDERSTAND AND ARE READY TO START THE UPGRADE/REFACTOR PLEAESE RESPOND WITH "I UNDERSTAND THE ASSIGNMENT". 