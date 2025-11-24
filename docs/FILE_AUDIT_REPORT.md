# File Location Audit Report

**Date:** November 23, 2025  
**Purpose:** Analyze current file organization and propose improvements  
**Total Files:** 60 JavaScript files across 8 directories

---

## Executive Summary

**Current Structure:** 5-layer architecture with 8 directories
- Infrastructure (3 files, 546 lines) ✅ Good
- Domain (1 file, 148 lines) ⚠️ Could be consolidated
- Application (2 files, 489 lines) ⚠️ Could be consolidated
- Presentation (3 files, 551 lines) ⚠️ Could be consolidated
- Core (5 files, 2,252 lines) ⚠️ Mixed purposes
- Services (9 files, 2,429 lines) ✅ Good
- Modules (28 files, 9,410 lines) ✅ Good
- Utils (9 files, 3,075 lines) ⚠️ Contains a service

**Key Findings:**
1. **Domain/Application/Presentation** layers have very few files (1-3 each) - could be consolidated into `core/`
2. **core/Character.js** (710 lines) is unused - possible legacy code
3. **utils/DataLoader.js** is actually a service (used by 6 services) - should move to `services/`
4. Current structure has unnecessary complexity for a single-developer Electron app

---

## Directory Analysis

### ✅ infrastructure/ (3 files, 546 lines)
**Purpose:** Foundation utilities used everywhere  
**Status:** ✅ Correctly organized, widely used

| File | Lines | Status | Used By |
|------|-------|--------|---------|
| Logger.js | 139 | ✅ Correct | 15+ files |
| Result.js | 178 | ✅ Correct | 10+ files |
| EventBus.js | 229 | ✅ Correct | 10+ files |

**Recommendation:** Keep as-is. These are true infrastructure components.

---

### ⚠️ domain/ (1 file, 148 lines)
**Purpose:** Pure business models  
**Status:** ⚠️ Under-utilized - only 1 file

| File | Lines | Status | Recommendation |
|------|-------|--------|----------------|
| CharacterSchema.js | 148 | ⚠️ Lonely | Move to `core/` or `character/` |

**Analysis:**
- Currently imports: `Logger` from infrastructure
- Used by: `CharacterManager` only
- Domain layer with 1 file is over-engineering for this app
- Would fit better in `core/` alongside CharacterManager

**Recommendation:** Move to `core/CharacterSchema.js` or create `character/CharacterSchema.js`

---

### ⚠️ application/ (2 files, 489 lines)
**Purpose:** Business logic orchestration  
**Status:** ⚠️ Small layer, could be consolidated

| File | Lines | Status | Recommendation |
|------|-------|--------|----------------|
| AppState.js | 219 | ⚠️ Could move | Move to `core/` |
| CharacterManager.js | 270 | ⚠️ Could move | Move to `core/` or `character/` |

**Analysis:**
- AppState is central to the app - belongs in `core/`
- CharacterManager orchestrates character operations
- Only 2 files in this layer - not enough to justify separate directory

**Recommendation:** 
- Option A: Move both to `core/`
- Option B: Create `character/` folder with CharacterManager + CharacterSchema

---

### ⚠️ presentation/ (3 files, 551 lines)
**Purpose:** UI logic and routing  
**Status:** ⚠️ Small layer, could be consolidated

| File | Lines | Status | Recommendation |
|------|-------|--------|----------------|
| Router.js | 162 | ⚠️ Could move | Move to `core/` or `navigation/` |
| PageLoader.js | 165 | ⚠️ Could move | Move to `core/` or `navigation/` |
| NavigationController.js | 224 | ⚠️ Could move | Move to `core/` or `navigation/` |

**Analysis:**
- All three work together for navigation/routing
- Small, cohesive group
- Could be in `core/` or a dedicated `navigation/` folder

**Recommendation:**
- Option A: Move all to `core/navigation/` subfolder
- Option B: Move all to `core/` with Navigation prefix
- Option C: Create `navigation/` top-level folder

---

### ⚠️ core/ (5 files, 2,252 lines)
**Purpose:** Core systems  
**Status:** ⚠️ Mixed purposes, one unused file

| File | Lines | Status | Recommendation |
|------|-------|--------|----------------|
| AppInitializer.js | 288 | ✅ Correct | Keep |
| Character.js | 710 | ✅ USED | Keep - entity class |

**Analysis:**
- **Character.js (710 lines):** ✅ USED by Modal.js for character creation
  - Has detailed character entity class with methods
  - Different from CharacterSchema.js (data structure) - both are needed
  - CharacterSchema defines structure, Character is the entity implementation
  - Used: `new Character()` in Modal.js line 285
| Modal.js | 461 | ✅ Correct | Keep |
| Proficiency.js | 586 | ✅ Correct | Keep |
| Storage.js | 207 | ✅ Correct | Keep |

**Analysis:**
- **Character.js (710 lines):** NOT IMPORTED ANYWHERE! Potential legacy code
  - Has detailed character entity class
  - Conflicts with CharacterSchema.js in domain/
  - Should be deleted or moved to archive if truly unused
  
- **AppInitializer, Modal, Proficiency, Storage:** All correctly placed and used

**Recommendation:**
1. ✅ Character.js is USED - keep it
2. This is a good place to consolidate domain/application/presentation files
3. Character.js is the entity implementation, CharacterSchema is the data structure

---

### ✅ services/ (9 files, 2,429 lines)
**Purpose:** Data access layer  
**Status:** ✅ Well organized

| File | Lines | Status |
|------|-------|--------|
| AbilityScoreService.js | 612 | ✅ Correct |
| BackgroundService.js | 119 | ✅ Correct |
| ClassService.js | 288 | ✅ Correct |
| ItemService.js | 135 | ✅ Correct |
| ProficiencyService.js | 351 | ✅ Correct |
| RaceService.js | 258 | ✅ Correct |
| SettingsService.js | 146 | ✅ Correct |
| SourceService.js | 406 | ✅ Correct |
| SpellService.js | 114 | ✅ Correct |

**Recommendation:** Keep as-is. Well organized by domain.

---

### ✅ modules/ (28 files, 9,410 lines)
**Purpose:** UI components  
**Status:** ✅ Well organized by feature

**Subfolders:**
- `abilities/` - 8 files, 1,947 lines
- `background/` - 3 files, 1,120 lines
- `class/` - 6 files, 2,567 lines
- `proficiencies/` - 5 files, 1,783 lines
- `race/` - 5 files, 2,645 lines
- `sources/` - 2 files, 427 lines

**Analysis:** Clean feature-based organization. BaseCard.js is a good shared base class.

**Recommendation:** Keep as-is. This is well done.

---

### ⚠️ utils/ (9 files, 3,075 lines)
**Purpose:** Helper functions  
**Status:** ⚠️ Contains one service that should move

| File | Lines | Status | Recommendation |
|------|-------|--------|----------------|
| DataLoader.js | 307 | ⚠️ Misplaced | Move to `services/` |
| notifications.js | 109 | ✅ Correct | Keep |
| NumberFormatter.js | 225 | ✅ Correct | Keep |
| ReferenceResolver.js | 313 | ✅ Correct | Keep |
| Renderer.js | 451 | ✅ Correct | Keep |
| TagProcessor.js | 315 | ✅ Correct | Keep |
| TextFormatter.js | 337 | ✅ Correct | Keep |
| TextProcessor.js | 367 | ✅ Correct | Keep |
| Tooltips.js | 651 | ✅ Correct | Keep |

**Analysis:**
- **DataLoader.js:** Used by 6 services for data loading - this is service-like behavior
  - Imports: None (pure utility)
  - Used by: ClassService, RaceService, BackgroundService, ItemService, SpellService, SourceService
  - Should be in `services/` or could stay as shared utility

**Recommendation:** 
- Option A: Move to `services/DataLoaderService.js`
- Option B: Keep in `utils/` since it's used by multiple services (shared infrastructure)

---

## Proposed Reorganization

### Option 1: Simplified 5-Folder Structure (Recommended)

```
app/js/
├── infrastructure/     (Keep: Logger, Result, EventBus)
├── core/              (Consolidate: AppState, CharacterManager, CharacterSchema, Router, PageLoader, NavigationController + existing core files)
├── services/          (Keep + add DataLoader)
├── modules/           (Keep as-is)
└── utils/             (Keep remaining utilities)
```

**Changes:**
- Move `domain/CharacterSchema.js` → `core/CharacterSchema.js`
- Move `application/AppState.js` → `core/AppState.js`
- Move `application/CharacterManager.js` → `core/CharacterManager.js`
- Move `presentation/*` → `core/Router.js`, `core/PageLoader.js`, `core/NavigationController.js`
- Move `utils/DataLoader.js` → `services/DataLoaderService.js`
- Delete `core/Character.js` (if truly unused)
- Remove empty `domain/`, `application/`, `presentation/` directories

**Benefits:**
- Clearer mental model (infrastructure, core, services, modules, utils)
- Less ceremony for single-developer project
- All core business logic in one place
- True utilities separated from services

---

### Option 2: Feature-Based Structure

```
app/js/
├── infrastructure/     (Keep: Logger, Result, EventBus)
├── core/              (Keep: AppInitializer, Modal, Proficiency, Storage, AppState)
├── character/         (New: CharacterManager, CharacterSchema)
├── navigation/        (New: Router, PageLoader, NavigationController)
├── services/          (Keep + add DataLoader)
├── modules/           (Keep as-is)
└── utils/             (Keep remaining utilities)
```

**Benefits:**
- Clear feature boundaries
- Easy to find character-related code
- Navigation isolated

**Drawbacks:**
- More folders
- character/ and navigation/ would have only 2-3 files each

---

### Option 3: Minimal Change (Keep 3 Layers)

```
app/js/
├── infrastructure/     (Keep: Logger, Result, EventBus)
├── core/              (Merge: AppState, CharacterManager, CharacterSchema, Router, PageLoader, NavigationController + existing)
├── services/          (Keep + add DataLoader)
├── modules/           (Keep as-is)
└── utils/             (Keep remaining utilities)
```

**Benefits:**
- Simplest change
- Only 4 top-level folders
- All application/domain/presentation logic in core/

**Drawbacks:**
- core/ might become large (but still organized)

---

## Action Items

### Immediate (Can do now)
1. ✅ **Investigate core/Character.js** - Is it used? Should it be deleted?
   - Grep for imports: `grep -r "from.*Character\.js" app/`
   - If unused, delete to remove 710 lines of dead code

2. ✅ **Move utils/DataLoader.js** - Move to services/
   - Update 6 service imports
   - Run tests to verify

### Phase 1: Consolidate Layers (2-3 hours)
3. ✅ Move domain/CharacterSchema.js → core/
4. ✅ Move application/AppState.js → core/
5. ✅ Move application/CharacterManager.js → core/
6. ✅ Move presentation/* → core/
7. ✅ Update all imports
8. ✅ Run tests: `npx playwright test tests/unit`
9. ✅ Update ARCHITECTURE.md
10. ✅ Remove empty directories
11. ✅ Git commit

### Phase 2: Documentation (30 minutes)
12. ✅ Update README.md with new structure
13. ✅ Update TODO.md to mark this complete
14. ✅ Update CODE_STANDARDS.md if needed

---

## Import Impact Analysis

**Files that will need import updates:**

### If moving domain/CharacterSchema.js → core/
- `application/CharacterManager.js` (1 import)

### If moving application/AppState.js → core/
- `application/CharacterManager.js` (1 import)
- `presentation/Router.js` (1 import)
- `presentation/NavigationController.js` (1 import)
- `services/ClassService.js` (1 import)
- ~4 files total

### If moving application/CharacterManager.js → core/
- `core/AppInitializer.js` (1 import)
- `modules/race/RaceCard.js` (1 import)
- `modules/class/ClassCard.js` (1 import)
- `modules/background/BackgroundCard.js` (1 import)
- `modules/abilities/AbilityScoreCard.js` (1 import)
- `modules/proficiencies/ProficiencyCard.js` (1 import)
- `modules/class/ClassDetails.js` (1 import)
- `modules/abilities/MethodSwitcher.js` (1 import)
- `services/AbilityScoreService.js` (1 import)
- ~9 files total

### If moving presentation/* → core/
- `core/AppInitializer.js` (3 imports)
- ~1 file total

### If moving utils/DataLoader.js → services/
- `services/ClassService.js` (1 import)
- `services/RaceService.js` (1 import)
- `services/BackgroundService.js` (1 import)
- `services/ItemService.js` (1 import)
- `services/SpellService.js` (1 import)
- `services/SourceService.js` (1 import)
- ~6 files total

**Total files to update:** ~20 files (very manageable with search/replace)

---

## Risk Assessment

**Low Risk:**
- All changes are simple file moves
- Import path updates are mechanical
- 88 unit tests will catch any breakage
- Application remains functional throughout
- Can be done in small increments
- Git tracks file moves, preserving history

**Mitigation:**
- Use `git mv` to preserve history
- Update one directory at a time
- Run tests after each change
- Commit after each successful move

---

## Recommendation

**Proceed with Option 1: Simplified 5-Folder Structure**

**Rationale:**
1. **Pragmatic for scale:** Single developer, ~60 files - don't need 8 directories
2. **Clearer mental model:** infrastructure → core → services → modules → utils
3. **Reduces ceremony:** No more hunting through domain/application/presentation for 1-3 files
4. **Maintains clarity:** Each directory still has clear purpose
5. **Easy to execute:** ~20 files to update, well-tested, low risk

**Next Step:** Start with investigation of core/Character.js, then proceed with reorganization.
