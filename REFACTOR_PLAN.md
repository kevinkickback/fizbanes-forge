# Casing logic issue - COMPREHENSIVE REFACTOR PLAN

## Executive Summary

**RECOMMENDATION: Normalize ALL data at DataLoader import level, not at service/UI layer.**

Current problems:
- Casing logic scattered across components (RaceCard, BackgroundCard, ClassCard, ProficiencySelection, etc.)
- Multiple `.toLowerCase()` normalization happening at different points
- Save files contain mixed casing (both normalized and display-formatted data)
- Brittle: If JSON data format changes, app breaks unless we fix multiple places
- **No single source of truth for data normalization**

Better approach:
- Normalize all game data ONCE at DataLoader import (skills, languages, items, actions, etc.)
- Services work with normalized data (lowercase, no spaces)
- UI layer formats for display using TextFormatter
- Save files store canonical lowercase format
- One point of maintenance if JSON format changes

## Solution: Align with Existing Architecture
Based on the codebase patterns, here's the best approach that:

- Creates minimal new files (1 DataNormalizer utility module)
- Normalizes JSON data at import time (DataLoader level)
- Follows existing service patterns (like SkillService, ActionService)
- Backwards compatible with existing saves (migration on load)

### Key Architectural Patterns Observed

- **Service Layer with Case-Insensitive Maps** - Services like SkillService, ActionService, ConditionService build lookup maps with `.toLowerCase()` keys
- **Centralized Utilities** - TextFormatter.js handles display formatting (toTitleCase, capitalize, etc.)
- **Single Responsibility** - DataLoader loads, Services manage, Views display, Controllers coordinate
- **Data Flow**: DataLoader → Services (with normalized data) → UI (with formatted output)
- **Serialization**: Character.toJSON() saves proficiencies as arrays with exact values

### Current Problems

1. **Scattered Normalization** - Multiple places do `.toLowerCase()`:
   - RaceCard capitalizes skills on line ~1043
   - ProficiencySelection does `.toLowerCase()` for lookups
   - ProficiencyDisplay has inconsistent casing
   - Save files store whatever casing was used (mixed)

2. **Save File Issue** - Current serialization (Character.toJSON()) stores proficiencies as-is:
   ```javascript
   proficiencies: {
     skills: ['Acrobatics', 'animal handling', 'ARCANA']  // Mixed casing!
   }
   ```
   This happens because capitalization is done at display time, not normalization time.

3. **Data Format Vulnerability** - If JSON changes, we must update:
   - RaceCard.js, BackgroundCard.js, ClassCard.js
   - ProficiencyService.js
   - ProficiencySelection.js
   - Any place that manually normalizes

## The Solution: DataLoader-Level Normalization

### Phase 1: Create DataNormalizer Utility

```javascript
// src/renderer/scripts/utils/DataNormalizer.js

/**
 * Normalizes all game data for consistent internal storage
 * Data comes in various formats from JSON files
 * This module ensures everything is lowercase and consistent
 */

const DataNormalizer = {
	/**
	 * Normalize a single string (skill, language, item, action, etc.)
	 * - Trim whitespace
	 * - Convert to lowercase
	 * - Do NOT remove spaces (keep "animal handling" not "animalhandling")
	 * @param {string} str - String to normalize
	 * @returns {string} Normalized string
	 */
	normalizeString(str) {
		if (!str || typeof str !== 'string') return '';
		return str.trim().toLowerCase();
	},

	/**
	 * Normalize an array of strings
	 * @param {Array<string>} arr - Array of strings
	 * @returns {Array<string>} Array with normalized strings
	 */
	normalizeStringArray(arr) {
		if (!Array.isArray(arr)) return [];
		return arr.map(item => this.normalizeString(item));
	},

	/**
	 * Normalize skill names in skill objects (from skills.json)
	 * @param {Array<Object>} skills - Skills array from JSON
	 * @returns {Array<Object>} Skills with normalized names
	 */
	normalizeSkills(skills) {
		if (!Array.isArray(skills)) return [];
		return skills.map(skill => ({
			...skill,
			name: this.normalizeString(skill.name)
		}));
	},

	/**
	 * Normalize action names (from actions.json)
	 * @param {Array<Object>} actions - Actions array from JSON
	 * @returns {Array<Object>} Actions with normalized names
	 */
	normalizeActions(actions) {
		if (!Array.isArray(actions)) return [];
		return actions.map(action => ({
			...action,
			name: this.normalizeString(action.name)
		}));
	},

	/**
	 * Normalize language names (from languages.json)
	 * @param {Array<Object>} languages - Languages array from JSON
	 * @returns {Array<Object>} Languages with normalized names
	 */
	normalizeLanguages(languages) {
		if (!Array.isArray(languages)) return [];
		return languages.map(lang => ({
			...lang,
			name: this.normalizeString(lang.name)
		}));
	},

	/**
	 * Normalize object/item names
	 * @param {Array<Object>} objects - Objects array from JSON
	 * @returns {Array<Object>} Objects with normalized names
	 */
	normalizeObjects(objects) {
		if (!Array.isArray(objects)) return [];
		return objects.map(obj => ({
			...obj,
			name: this.normalizeString(obj.name)
		}));
	},

	/**
	 * Normalize trap/hazard names
	 * @param {Array<Object>} trapsHazards - Traps/hazards array from JSON
	 * @returns {Array<Object>} Traps/hazards with normalized names
	 */
	normalizeTrapsHazards(trapsHazards) {
		if (!Array.isArray(trapsHazards)) return [];
		return trapsHazards.map(item => ({
			...item,
			name: this.normalizeString(item.name)
		}));
	},

	/**
	 * Normalize item names
	 * @param {Array<Object>} items - Items array from JSON
	 * @returns {Array<Object>} Items with normalized names
	 */
	normalizeItems(items) {
		if (!Array.isArray(items)) return [];
		return items.map(item => ({
			...item,
			name: this.normalizeString(item.name)
		}));
	},

	/**
	 * Normalize proficiency names in race/class/background data
	 * Handles: skillProficiencies, toolProficiencies, weaponProficiencies, armorProficiencies, languageProficiencies
	 * @param {Object} data - Race/class/background data object
	 * @returns {Object} Data with normalized proficiency fields
	 */
	normalizeProficienciesInData(data) {
		if (!data || typeof data !== 'object') return data;

		const normalized = { ...data };

		// Normalize proficiency field names and values
		if (normalized.skillProficiencies && Array.isArray(normalized.skillProficiencies)) {
			normalized.skillProficiencies = normalized.skillProficiencies.map(prof => {
				if (typeof prof === 'string') {
					return this.normalizeString(prof);
				}
				// Handle object format with properties
				if (prof.any) return prof; // "any" skill choice
				const result = {};
				for (const [key, value] of Object.entries(prof)) {
					result[this.normalizeString(key)] = value;
				}
				return result;
			});
		}

		if (normalized.toolProficiencies && Array.isArray(normalized.toolProficiencies)) {
			normalized.toolProficiencies = this.normalizeStringArray(normalized.toolProficiencies);
		}

		if (normalized.weaponProficiencies && Array.isArray(normalized.weaponProficiencies)) {
			normalized.weaponProficiencies = this.normalizeStringArray(normalized.weaponProficiencies);
		}

		if (normalized.armorProficiencies && Array.isArray(normalized.armorProficiencies)) {
			normalized.armorProficiencies = this.normalizeStringArray(normalized.armorProficiencies);
		}

		if (normalized.languageProficiencies && Array.isArray(normalized.languageProficiencies)) {
			normalized.languageProficiencies = this.normalizeStringArray(normalized.languageProficiencies);
		}

		return normalized;
	}
};

export default DataNormalizer;
```

### Phase 2: Update DataLoader to Use Normalizer

```javascript
// In DataLoader.js - add normalization after each load

import DataNormalizer from './DataNormalizer.js';

async function loadSkills() {
	const data = await loadJSON(`${state.baseUrl}skills.json`);
	if (data.skill) {
		data.skill = DataNormalizer.normalizeSkills(data.skill);
	}
	return data;
}

async function loadActions() {
	const data = await loadJSON(`${state.baseUrl}actions.json`);
	if (data.action) {
		data.action = DataNormalizer.normalizeActions(data.action);
	}
	return data;
}

async function loadLanguages() {
	const data = await loadJSON(`${state.baseUrl}languages.json`);
	if (data.language) {
		data.language = DataNormalizer.normalizeLanguages(data.language);
	}
	return data;
}

async function loadObjects() {
	const data = await loadJSON(`${state.baseUrl}objects.json`);
	if (data.object) {
		data.object = DataNormalizer.normalizeObjects(data.object);
	}
	return data;
}

async function loadTrapsHazards() {
	const data = await loadJSON(`${state.baseUrl}trapshazards.json`);
	if (data.trapHazard) {
		data.trapHazard = DataNormalizer.normalizeTrapsHazards(data.trapHazard);
	}
	return data;
}

async function loadItems() {
	const data = await loadJSON(`${state.baseUrl}items.json`);
	if (data.item) {
		data.item = DataNormalizer.normalizeItems(data.item);
	}
	return data;
}

async function loadRaces() {
	const data = await loadJSON(`${state.baseUrl}races.json`);
	if (data.race && Array.isArray(data.race)) {
		data.race = data.race.map(race => DataNormalizer.normalizeProficienciesInData(race));
	}
	return data;
}

async function loadBackgrounds() {
	const data = await loadJSON(`${state.baseUrl}backgrounds.json`);
	if (data.background && Array.isArray(data.background)) {
		data.background = data.background.map(bg => DataNormalizer.normalizeProficienciesInData(bg));
	}
	return data;
}

async function loadClasses(className = 'Fighter') {
	const data = await loadJSON(`${state.baseUrl}class/class-${className.toLowerCase()}.json`);
	if (data.class && Array.isArray(data.class)) {
		data.class = data.class.map(cls => DataNormalizer.normalizeProficienciesInData(cls));
	}
	return data;
}
```

### Phase 3: Update Services - Remove Normalize Helpers

SkillService, ActionService already correctly do `.toLowerCase()` on lookups. They need no changes.
ProficiencyService needs simplification:

```javascript
// In ProficiencyService.js - SIMPLIFIED

constructor() {
	this._initialized = false;
	this._skills = null;
	this._tools = null;
	this._languages = null;
	// Map now matches DataLoader normalized format (lowercase, spaces intact)
	this._skillAbilityMap = new Map([
		['acrobatics', 'dexterity'],
		['animal handling', 'wisdom'],  // WITH spaces, as it comes from JSON
		['arcana', 'intelligence'],
		['athletics', 'strength'],
		// ... etc
	]);
}

// NO special normalization method needed!
// Just use exact lowercase values
getSkillAbility(skill) {
	if (!skill) return null;
	// Data is already normalized from DataLoader
	return this._skillAbilityMap.get(skill.toLowerCase()) || null;
}

async getAvailableSkills() {
	if (this._skills) return [...this._skills];
	return [
		'acrobatics',
		'animal handling',  // As it comes from normalized JSON
		'arcana',
		// ... etc
	];
}
```

### Phase 4: Update UI Components

#### RaceCard.js - Remove capitalization

```javascript
// BEFORE: _processSkillProficiencies had this
const capitalizedSkill = skill.charAt(0).toUpperCase() + skill.slice(1);

// AFTER: Just use the skill as-is (already normalized from JSON)
const skillOption = skill; // That's it!
```

#### ProficiencyDisplay.js - Format only for display

```javascript
import { toTitleCase } from '../../utils/TextFormatter.js';

_buildItemHtml(cssClasses, item, type, ...) {
	// Data is stored lowercase internally
	// Format ONLY for display
	const displayName = type === 'skills' ? toTitleCase(item) : item;
	
	// Store original normalized value in data attribute
	return `<div class="${cssClasses.join(' ')}" 
	            data-proficiency="${item}" 
	            data-type="${type}">
	          <i class="${iconClass}"></i>${displayName}
	          ${abilityText}
	        </div>`;
}
```

#### ProficiencySelection.js - Use normalized data directly

```javascript
// BEFORE: Mixed case comparisons with manual .toLowerCase()
const normalizedProf = proficiency.toLowerCase();
const raceOptions = skillOptions.race?.options || [];
const isRaceOption = raceOptions.includes(normalizedProf);

// AFTER: Data is already normalized
const raceOptions = skillOptions.race?.options || [];
const isRaceOption = raceOptions.includes(proficiency);
```

### Phase 5: Save File Migration & Compatibility

Current saves have mixed casing. Need migration:

```javascript
// In Character.js constructor - add migration logic

if (data.proficiencies?.skills) {
	// Migrate old saves: normalize any mixed-case skills
	data.proficiencies.skills = data.proficiencies.skills.map(skill => 
		typeof skill === 'string' ? skill.toLowerCase() : skill
	);
}

if (data.optionalProficiencies?.skills?.selected) {
	data.optionalProficiencies.skills.selected = data.optionalProficiencies.skills.selected.map(
		skill => typeof skill === 'string' ? skill.toLowerCase() : skill
	);
}

// Similar for languages, tools, etc.
```

## Summary of Changes

| Phase | File | Change | Impact | Lines |
|-------|------|--------|--------|-------|
| 1 | DataNormalizer.js (NEW) | Central normalization logic | One source of truth | ~250 |
| 2 | DataLoader.js | Add normalizer calls to load methods | Normalize at import | ~+40 |
| 3 | ProficiencyService.js | Simplify maps, remove normalize helper | Simpler code | ~-20 |
| 3 | SkillService.js | No changes | Already correct | 0 |
| 3 | ActionService.js | No changes | Already correct | 0 |
| 4 | RaceCard.js | Remove skill capitalization | ~-15 |
| 4 | BackgroundCard.js | Remove skill capitalization | ~-10 |
| 4 | ClassCard.js | Remove skill capitalization | ~-10 |
| 4 | ProficiencyDisplay.js | Add toTitleCase for display | ~+5 |
| 4 | ProficiencySelection.js | Remove manual .toLowerCase() | ~-30 |
| 5 | Character.js | Add migration for old saves | Backward compatible | ~+30 |
| **Total** | **~11 file edits + 1 new file** | **~175 net lines** | **Single source of truth** | |

## Why This Approach Works Better

✅ **Single Source of Truth** - All normalization happens ONE place (DataLoader)  
✅ **Data Format Resilience** - If JSON changes format, fix it in DataNormalizer only  
✅ **Backward Compatible** - Migration code handles old saves  
✅ **Clean Saves** - New saves always have normalized lowercase proficiencies  
✅ **Consistent Pattern** - Services work with normalized data throughout  
✅ **No New Files Really** - Just 1 utility, used by DataLoader  
✅ **Separation of Concerns** - Storage (lowercase) vs Display (formatted)  
✅ **Future-Proof** - Easy to add normalizers for new data types (feats, spells, etc.)

## Affected Save Format

Before:
```json
{
  "proficiencies": {
    "skills": ["Acrobatics", "animal handling", "ARCANA"]  // Mixed!
  },
  "optionalProficiencies": {
    "skills": {
      "selected": ["Deception", "perception"]  // Mixed!
    }
  }
}
```

After (new saves):
```json
{
  "proficiencies": {
    "skills": ["acrobatics", "animal handling", "arcana"]  // Consistent!
  },
  "optionalProficiencies": {
    "skills": {
      "selected": ["deception", "perception"]  // Consistent!
    }
  }
}
```

Old saves are automatically migrated on load.