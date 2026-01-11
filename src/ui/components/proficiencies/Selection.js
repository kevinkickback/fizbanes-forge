// Handles proficiency selection/deselection with source-specific tracking

import DataNormalizer from '../../../lib/DataNormalizer.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';

export class ProficiencySelectionView {
	toggleOptionalProficiency(profItem, character) {
		if (!character) return false;

		const proficiency = profItem.dataset.proficiency;
		const profType = profItem.dataset.type;

		if (!proficiency || !profType) return false;

		let changed = false;

		try {
			if (profType === 'skills') {
				changed = this._toggleSkillProficiency(
					profItem,
					proficiency,
					character,
				);
			} else if (profType === 'languages') {
				changed = this._toggleLanguageProficiency(
					profItem,
					proficiency,
					character,
				);
			} else if (profType === 'tools') {
				changed = this._toggleToolProficiency(profItem, proficiency, character);
			} else {
				// Armor/Weapons (simple selection without source tracking)
				changed = this._toggleSimpleProficiency(
					profItem,
					proficiency,
					profType,
					character,
				);
			}
		} catch (error) {
			console.error(
				'ProficiencySelection',
				'Error toggling proficiency:',
				error,
			);
			return false;
		}

		// Emit event if proficiency was changed
		if (changed) {
			if (
				profItem.classList.contains('optional-selected') ||
				profItem.classList.contains('selected')
			) {
				eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_SELECTED, {
					type: profType,
					proficiency,
					character,
				});
			} else {
				eventBus.emit(EVENTS.PROFICIENCY_OPTIONAL_DESELECTED, {
					type: profType,
					proficiency,
					character,
				});
			}
		}

		return changed;
	}

	_toggleSkillProficiency(profItem, proficiency, character) {
		// Data is already normalized from DataLoader
		const skillOptions = character.optionalProficiencies.skills;
		const normalizedProficiency =
			DataNormalizer.normalizeForLookup(proficiency);

		// Get source options and check for 'any'
		const raceOptions = skillOptions.race?.options || [];
		const classOptions = skillOptions.class?.options || [];
		const backgroundOptions = skillOptions.background?.options || [];
		const normalizedRaceOptions = raceOptions.map((o) =>
			DataNormalizer.normalizeForLookup(o),
		);
		const normalizedClassOptions = classOptions.map((o) =>
			DataNormalizer.normalizeForLookup(o),
		);
		const normalizedBackgroundOptions = backgroundOptions.map((o) =>
			DataNormalizer.normalizeForLookup(o),
		);

		const raceAllowsAny = normalizedRaceOptions.includes('any');
		const classAllowsAny = normalizedClassOptions.includes('any');
		const backgroundAllowsAny = normalizedBackgroundOptions.includes('any');

		const isRaceOption =
			raceAllowsAny || normalizedRaceOptions.includes(normalizedProficiency);
		const isClassOption =
			classAllowsAny || normalizedClassOptions.includes(normalizedProficiency);
		const isBackgroundOption =
			backgroundAllowsAny ||
			normalizedBackgroundOptions.includes(normalizedProficiency);

		// Get current selections
		const raceSelected = skillOptions.race?.selected || [];
		const classSelected = skillOptions.class?.selected || [];
		const backgroundSelected = skillOptions.background?.selected || [];
		const combinedSelected = skillOptions.selected || [];

		// Handle deselection
		if (
			profItem.classList.contains('selected') ||
			profItem.classList.contains('optional-selected')
		) {
			return this._deselectSkill(
				profItem,
				proficiency,
				skillOptions,
				raceSelected,
				classSelected,
				backgroundSelected,
				combinedSelected,
				normalizedProficiency,
			);
		}
		// Handle selection
		else {
			return this._selectSkill(
				profItem,
				proficiency,
				skillOptions,
				isRaceOption,
				isClassOption,
				isBackgroundOption,
				raceAllowsAny,
				classAllowsAny,
				backgroundAllowsAny,
			);
		}
	}

	_deselectSkill(
		profItem,
		_proficiency,
		skillOptions,
		raceSelected,
		classSelected,
		backgroundSelected,
		combinedSelected,
		normalizedProficiency,
	) {
		let removedFromSource = false;
		const matches = (value) =>
			DataNormalizer.normalizeForLookup(value) === normalizedProficiency;

		// Remove from the appropriate source selection
		if (raceSelected.some(matches)) {
			skillOptions.race.selected = raceSelected.filter((p) => !matches(p));
			removedFromSource = true;
		}
		if (classSelected.some(matches)) {
			skillOptions.class.selected = classSelected.filter((p) => !matches(p));
			removedFromSource = true;
		}
		if (backgroundSelected.some(matches)) {
			skillOptions.background.selected = backgroundSelected.filter(
				(p) => !matches(p),
			);
			removedFromSource = true;
		}

		if (!removedFromSource) {
			console.warn(
				'ProficiencySelection',
				"Deselecting skill, but could not find it in any source's selected list.",
			);
		}

		// Update combined selection
		skillOptions.selected = combinedSelected.filter((p) => !matches(p));

		// Update UI
		this._updateItemUIForDeselection(profItem);

		return true;
	}

	_selectSkill(
		profItem,
		proficiency,
		skillOptions,
		isRaceOption,
		isClassOption,
		isBackgroundOption,
		raceAllowsAny,
		classAllowsAny,
		backgroundAllowsAny,
	) {
		const raceSelected = skillOptions.race?.selected || [];
		const classSelected = skillOptions.class?.selected || [];
		const backgroundSelected = skillOptions.background?.selected || [];

		const raceAllowed = skillOptions.race?.allowed || 0;
		const classAllowed = skillOptions.class?.allowed || 0;
		const backgroundAllowed = skillOptions.background?.allowed || 0;

		const raceSlotsAvailable = raceSelected.length < raceAllowed;
		const classSlotsAvailable = classSelected.length < classAllowed;
		const backgroundSlotsAvailable =
			backgroundSelected.length < backgroundAllowed;

		let assignedToSource = false;

		// 1. Prioritize sources offering the specific skill (NOT via 'any')
		if (!classAllowsAny && isClassOption && classSlotsAvailable) {
			skillOptions.class.selected.push(proficiency);
			assignedToSource = true;
		} else if (
			!assignedToSource &&
			!backgroundAllowsAny &&
			isBackgroundOption &&
			backgroundSlotsAvailable
		) {
			skillOptions.background.selected.push(proficiency);
			assignedToSource = true;
		} else if (
			!assignedToSource &&
			!raceAllowsAny &&
			isRaceOption &&
			raceSlotsAvailable
		) {
			skillOptions.race.selected.push(proficiency);
			assignedToSource = true;
		}

		// 2. If not assigned to a specific list, assign to highest priority 'any' source
		if (!assignedToSource) {
			if (classAllowsAny && classSlotsAvailable) {
				skillOptions.class.selected.push(proficiency);
				assignedToSource = true;
			} else if (backgroundAllowsAny && backgroundSlotsAvailable) {
				skillOptions.background.selected.push(proficiency);
				assignedToSource = true;
			} else if (raceAllowsAny && raceSlotsAvailable) {
				skillOptions.race.selected.push(proficiency);
				assignedToSource = true;
			}
		}

		// Update combined selection only if assigned to a source
		if (assignedToSource) {
			if (!skillOptions.selected.some((p) => p === proficiency)) {
				skillOptions.selected.push(proficiency);
			}

			// Update UI
			this._updateItemUIForSelection(profItem);
			return true;
		} else {
			console.warn(
				'ProficiencySelection',
				'Cannot select skill: no available slots or not allowed by source rules.',
			);
			return false;
		}
	}

	_toggleLanguageProficiency(profItem, proficiency, character) {
		// Data is already normalized from DataLoader
		const languageOptions = character.optionalProficiencies.languages;
		const normalizedProficiency =
			DataNormalizer.normalizeForLookup(proficiency);

		const raceOptions = languageOptions.race?.options || [];
		const classOptions = languageOptions.class?.options || [];
		const backgroundOptions = languageOptions.background?.options || [];
		const normalizedRaceOptions = raceOptions.map((o) =>
			DataNormalizer.normalizeForLookup(o),
		);
		const normalizedClassOptions = classOptions.map((o) =>
			DataNormalizer.normalizeForLookup(o),
		);
		const normalizedBackgroundOptions = backgroundOptions.map((o) =>
			DataNormalizer.normalizeForLookup(o),
		);

		const raceAllowsAny = normalizedRaceOptions.includes('any');
		const classAllowsAny = normalizedClassOptions.includes('any');
		const backgroundAllowsAny = normalizedBackgroundOptions.includes('any');

		const isRaceOption =
			raceAllowsAny || normalizedRaceOptions.includes(normalizedProficiency);
		const isClassOption =
			classAllowsAny || normalizedClassOptions.includes(normalizedProficiency);
		const isBackgroundOption =
			backgroundAllowsAny ||
			normalizedBackgroundOptions.includes(normalizedProficiency);

		const raceSelected = languageOptions.race?.selected || [];
		const classSelected = languageOptions.class?.selected || [];
		const backgroundSelected = languageOptions.background?.selected || [];
		const combinedSelected = languageOptions.selected || [];

		// Handle deselection
		if (
			profItem.classList.contains('selected') ||
			profItem.classList.contains('optional-selected')
		) {
			return this._deselectLanguage(
				profItem,
				proficiency,
				languageOptions,
				raceSelected,
				classSelected,
				backgroundSelected,
				combinedSelected,
				normalizedProficiency,
			);
		}
		// Handle selection
		else {
			return this._selectLanguage(
				profItem,
				proficiency,
				languageOptions,
				isRaceOption,
				isClassOption,
				isBackgroundOption,
				raceAllowsAny,
				classAllowsAny,
				backgroundAllowsAny,
			);
		}
	}

	_deselectLanguage(
		profItem,
		_proficiency,
		languageOptions,
		raceSelected,
		classSelected,
		backgroundSelected,
		combinedSelected,
		normalizedProficiency,
	) {
		let removedFromSource = false;
		const matches = (value) =>
			DataNormalizer.normalizeForLookup(value) === normalizedProficiency;

		if (raceSelected.some(matches)) {
			languageOptions.race.selected = raceSelected.filter((p) => !matches(p));
			removedFromSource = true;
		}
		if (classSelected.some(matches)) {
			languageOptions.class.selected = classSelected.filter((p) => !matches(p));
			removedFromSource = true;
		}
		if (backgroundSelected.some(matches)) {
			languageOptions.background.selected = backgroundSelected.filter(
				(p) => !matches(p),
			);
			removedFromSource = true;
		}

		if (!removedFromSource) {
			console.warn(
				'ProficiencySelection',
				"Deselecting language, but could not find it in any source's selected list.",
			);
		}

		languageOptions.selected = combinedSelected.filter((p) => !matches(p));
		this._updateItemUIForDeselection(profItem);
		return true;
	}

	_selectLanguage(
		profItem,
		proficiency,
		languageOptions,
		isRaceOption,
		isClassOption,
		isBackgroundOption,
		raceAllowsAny,
		classAllowsAny,
		backgroundAllowsAny,
	) {
		const raceSelected = languageOptions.race?.selected || [];
		const classSelected = languageOptions.class?.selected || [];
		const backgroundSelected = languageOptions.background?.selected || [];

		const raceAllowed = languageOptions.race?.allowed || 0;
		const classAllowed = languageOptions.class?.allowed || 0;
		const backgroundAllowed = languageOptions.background?.allowed || 0;

		const raceSlotsAvailable = raceSelected.length < raceAllowed;
		const classSlotsAvailable = classSelected.length < classAllowed;
		const backgroundSlotsAvailable =
			backgroundSelected.length < backgroundAllowed;

		let assignedToSource = false;

		// Prioritize specific lists first
		if (!classAllowsAny && isClassOption && classSlotsAvailable) {
			languageOptions.class.selected.push(proficiency);
			assignedToSource = true;
		} else if (
			!assignedToSource &&
			!backgroundAllowsAny &&
			isBackgroundOption &&
			backgroundSlotsAvailable
		) {
			languageOptions.background.selected.push(proficiency);
			assignedToSource = true;
		} else if (
			!assignedToSource &&
			!raceAllowsAny &&
			isRaceOption &&
			raceSlotsAvailable
		) {
			languageOptions.race.selected.push(proficiency);
			assignedToSource = true;
		}

		// Then try 'any' sources
		if (!assignedToSource) {
			if (classAllowsAny && classSlotsAvailable) {
				languageOptions.class.selected.push(proficiency);
				assignedToSource = true;
			} else if (backgroundAllowsAny && backgroundSlotsAvailable) {
				languageOptions.background.selected.push(proficiency);
				assignedToSource = true;
			} else if (raceAllowsAny && raceSlotsAvailable) {
				languageOptions.race.selected.push(proficiency);
				assignedToSource = true;
			}
		}

		if (assignedToSource) {
			if (!languageOptions.selected.some((p) => p === proficiency)) {
				languageOptions.selected.push(proficiency);
			}
			this._updateItemUIForSelection(profItem);
			return true;
		} else {
			console.warn(
				'ProficiencySelection',
				'Cannot select language: no available slots or not allowed by source rules.',
			);
			return false;
		}
	}

	_toggleToolProficiency(profItem, proficiency, character) {
		// Data is already normalized from DataLoader
		const toolOptions = character.optionalProficiencies.tools;
		const normalizedProficiency =
			DataNormalizer.normalizeForLookup(proficiency);

		const raceOptions = toolOptions.race?.options || [];
		const classOptions = toolOptions.class?.options || [];
		const backgroundOptions = toolOptions.background?.options || [];
		const normalizedRaceOptions = raceOptions.map((o) =>
			DataNormalizer.normalizeForLookup(o),
		);
		const normalizedClassOptions = classOptions.map((o) =>
			DataNormalizer.normalizeForLookup(o),
		);
		const normalizedBackgroundOptions = backgroundOptions.map((o) =>
			DataNormalizer.normalizeForLookup(o),
		);

		const raceAllowsAny = normalizedRaceOptions.includes('any');
		const classAllowsAny = normalizedClassOptions.includes('any');
		const backgroundAllowsAny = normalizedBackgroundOptions.includes('any');

		const isRaceOption =
			raceAllowsAny || normalizedRaceOptions.includes(normalizedProficiency);
		const isClassOption =
			classAllowsAny || normalizedClassOptions.includes(normalizedProficiency);
		const isBackgroundOption =
			backgroundAllowsAny ||
			normalizedBackgroundOptions.includes(normalizedProficiency);

		const raceSelected = toolOptions.race?.selected || [];
		const classSelected = toolOptions.class?.selected || [];
		const backgroundSelected = toolOptions.background?.selected || [];
		const combinedSelected = toolOptions.selected || [];

		// Handle deselection
		if (
			profItem.classList.contains('selected') ||
			profItem.classList.contains('optional-selected')
		) {
			return this._deselectTool(
				profItem,
				proficiency,
				toolOptions,
				raceSelected,
				classSelected,
				backgroundSelected,
				combinedSelected,
				normalizedProficiency,
			);
		}
		// Handle selection
		else {
			return this._selectTool(
				profItem,
				proficiency,
				toolOptions,
				isRaceOption,
				isClassOption,
				isBackgroundOption,
				raceAllowsAny,
				classAllowsAny,
				backgroundAllowsAny,
			);
		}
	}

	_deselectTool(
		profItem,
		_proficiency,
		toolOptions,
		raceSelected,
		classSelected,
		backgroundSelected,
		combinedSelected,
		normalizedProficiency,
	) {
		let removedFromSource = false;
		const matches = (value) =>
			DataNormalizer.normalizeForLookup(value) === normalizedProficiency;

		if (raceSelected.some(matches)) {
			toolOptions.race.selected = raceSelected.filter((p) => !matches(p));
			removedFromSource = true;
		}
		if (classSelected.some(matches)) {
			toolOptions.class.selected = classSelected.filter((p) => !matches(p));
			removedFromSource = true;
		}
		if (backgroundSelected.some(matches)) {
			toolOptions.background.selected = backgroundSelected.filter(
				(p) => !matches(p),
			);
			removedFromSource = true;
		}

		if (!removedFromSource) {
			console.warn(
				'ProficiencySelection',
				"Deselecting tool, but could not find it in any source's selected list.",
			);
		}

		toolOptions.selected = combinedSelected.filter((p) => !matches(p));
		this._updateItemUIForDeselection(profItem);
		return true;
	}

	_selectTool(
		profItem,
		proficiency,
		toolOptions,
		isRaceOption,
		isClassOption,
		isBackgroundOption,
		raceAllowsAny,
		classAllowsAny,
		backgroundAllowsAny,
	) {
		const raceSelected = toolOptions.race?.selected || [];
		const classSelected = toolOptions.class?.selected || [];
		const backgroundSelected = toolOptions.background?.selected || [];

		const raceAllowed = toolOptions.race?.allowed || 0;
		const classAllowed = toolOptions.class?.allowed || 0;
		const backgroundAllowed = toolOptions.background?.allowed || 0;

		const raceSlotsAvailable = raceSelected.length < raceAllowed;
		const classSlotsAvailable = classSelected.length < classAllowed;
		const backgroundSlotsAvailable =
			backgroundSelected.length < backgroundAllowed;

		let assignedToSource = false;

		// Prioritize specific lists first
		if (!classAllowsAny && isClassOption && classSlotsAvailable) {
			toolOptions.class.selected.push(proficiency);
			assignedToSource = true;
		} else if (
			!assignedToSource &&
			!backgroundAllowsAny &&
			isBackgroundOption &&
			backgroundSlotsAvailable
		) {
			toolOptions.background.selected.push(proficiency);
			assignedToSource = true;
		} else if (
			!assignedToSource &&
			!raceAllowsAny &&
			isRaceOption &&
			raceSlotsAvailable
		) {
			toolOptions.race.selected.push(proficiency);
			assignedToSource = true;
		}

		// Then try 'any' sources
		if (!assignedToSource) {
			if (classAllowsAny && classSlotsAvailable) {
				toolOptions.class.selected.push(proficiency);
				assignedToSource = true;
			} else if (backgroundAllowsAny && backgroundSlotsAvailable) {
				toolOptions.background.selected.push(proficiency);
				assignedToSource = true;
			} else if (raceAllowsAny && raceSlotsAvailable) {
				toolOptions.race.selected.push(proficiency);
				assignedToSource = true;
			}
		}

		if (assignedToSource) {
			if (!toolOptions.selected.some((p) => p === proficiency)) {
				toolOptions.selected.push(proficiency);
			}
			this._updateItemUIForSelection(profItem);
			return true;
		} else {
			console.warn(
				'ProficiencySelection',
				'Cannot select tool: no available slots or not allowed by source rules.',
			);
			return false;
		}
	}

	_toggleSimpleProficiency(profItem, proficiency, profType, character) {
		const selectedProfs =
			character.optionalProficiencies[profType]?.selected || [];
		const allowedCount =
			character.optionalProficiencies[profType]?.allowed || 0;

		if (
			profItem.classList.contains('selected') ||
			profItem.classList.contains('optional-selected')
		) {
			// Remove proficiency from selection
			character.optionalProficiencies[profType].selected = selectedProfs.filter(
				(p) => p !== proficiency,
			);
			this._updateItemUIForDeselection(profItem);
			return true;
		} else {
			// Check if we can add more proficiencies
			if (selectedProfs.length < allowedCount) {
				// Add proficiency to selection
				character.optionalProficiencies[profType].selected.push(proficiency);
				this._updateItemUIForSelection(profItem);
				return true;
			}
			return false;
		}
	}

	_updateItemUIForSelection(profItem) {
		profItem.classList.add('selected', 'optional-selected', 'proficient');
		const icon = profItem.querySelector('i.fas');
		if (icon) icon.classList.add('optional');
		if (!profItem.querySelector('.unselect-hint')) {
			const hint = document.createElement('span');
			hint.className = 'unselect-hint';
			hint.innerHTML = '<i class="fas fa-times"></i>';
			profItem.appendChild(hint);
		}
	}

	_updateItemUIForDeselection(profItem) {
		profItem.classList.remove('selected', 'optional-selected', 'proficient');
		const icon = profItem.querySelector('i.fas');
		if (icon) icon.classList.remove('optional');
		const unselectHint = profItem.querySelector('.unselect-hint');
		if (unselectHint) unselectHint.remove();
	}
}
