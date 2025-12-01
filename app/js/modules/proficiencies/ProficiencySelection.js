/**
 * ProficiencySelectionView.js
 * Handles proficiency selection and deselection logic with source-specific tracking
 */

/**
 * View component for handling proficiency selection/deselection interactions
 */
export class ProficiencySelectionView {
	/**
	 * Toggle optional proficiency selection
	 * @param {HTMLElement} profItem - The proficiency item element
	 * @param {Character} character - The character object
	 * @returns {boolean} True if selection was changed
	 */
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
			console.error('Error toggling proficiency:', error);
			return false;
		}

		return changed;
	}

	/**
	 * Toggle skill proficiency with source-specific tracking
	 * @private
	 */
	_toggleSkillProficiency(profItem, proficiency, character) {
		const normalizedProf = proficiency.toLowerCase();
		const skillOptions = character.optionalProficiencies.skills;

		// Get source options and check for 'any'
		const raceOptions =
			skillOptions.race?.options?.map((o) => o.toLowerCase()) || [];
		const classOptions =
			skillOptions.class?.options?.map((o) => o.toLowerCase()) || [];
		const backgroundOptions =
			skillOptions.background?.options?.map((o) => o.toLowerCase()) || [];

		const raceAllowsAny = raceOptions.includes('any');
		const classAllowsAny = classOptions.includes('any');
		const backgroundAllowsAny = backgroundOptions.includes('any');

		const isRaceOption = raceAllowsAny || raceOptions.includes(normalizedProf);
		const isClassOption =
			classAllowsAny || classOptions.includes(normalizedProf);
		const isBackgroundOption =
			backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

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
				normalizedProf,
				skillOptions,
				raceSelected,
				classSelected,
				backgroundSelected,
				combinedSelected,
			);
		}
		// Handle selection
		else {
			return this._selectSkill(
				profItem,
				proficiency,
				normalizedProf,
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

	/**
	 * Deselect a skill proficiency
	 * @private
	 */
	_deselectSkill(
		profItem,
		_proficiency,
		normalizedProf,
		skillOptions,
		raceSelected,
		classSelected,
		backgroundSelected,
		combinedSelected,
	) {
		let removedFromSource = false;

		// Remove from the appropriate source selection
		if (raceSelected.some((p) => p.toLowerCase() === normalizedProf)) {
			skillOptions.race.selected = raceSelected.filter(
				(p) => p.toLowerCase() !== normalizedProf,
			);
			removedFromSource = true;
		}
		if (classSelected.some((p) => p.toLowerCase() === normalizedProf)) {
			skillOptions.class.selected = classSelected.filter(
				(p) => p.toLowerCase() !== normalizedProf,
			);
			removedFromSource = true;
		}
		if (backgroundSelected.some((p) => p.toLowerCase() === normalizedProf)) {
			skillOptions.background.selected = backgroundSelected.filter(
				(p) => p.toLowerCase() !== normalizedProf,
			);
			removedFromSource = true;
		}

		if (!removedFromSource) {
			console.warn(
				"Deselecting skill, but could not find it in any source's selected list.",
			);
		}

		// Update combined selection
		skillOptions.selected = combinedSelected.filter(
			(p) => p.toLowerCase() !== normalizedProf,
		);

		// Update UI
		this._updateItemUIForDeselection(profItem);

		return true;
	}

	/**
	 * Select a skill proficiency
	 * @private
	 */
	_selectSkill(
		profItem,
		proficiency,
		normalizedProf,
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
			if (
				!skillOptions.selected.some((p) => p.toLowerCase() === normalizedProf)
			) {
				skillOptions.selected.push(proficiency);
			}

			// Update UI
			this._updateItemUIForSelection(profItem);
			return true;
		} else {
			console.warn(
				'Could not assign skill to any source despite canAdd being true.',
			);
			return false;
		}
	}

	/**
	 * Toggle language proficiency with source-specific tracking
	 * @private
	 */
	_toggleLanguageProficiency(profItem, proficiency, character) {
		const normalizedProf = proficiency.toLowerCase();
		const languageOptions = character.optionalProficiencies.languages;

		const raceOptions =
			languageOptions.race?.options?.map((o) => o.toLowerCase()) || [];
		const classOptions =
			languageOptions.class?.options?.map((o) => o.toLowerCase()) || [];
		const backgroundOptions =
			languageOptions.background?.options?.map((o) => o.toLowerCase()) || [];

		const raceAllowsAny = raceOptions.includes('any');
		const classAllowsAny = classOptions.includes('any');
		const backgroundAllowsAny = backgroundOptions.includes('any');

		const isRaceOption = raceAllowsAny || raceOptions.includes(normalizedProf);
		const isClassOption =
			classAllowsAny || classOptions.includes(normalizedProf);
		const isBackgroundOption =
			backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

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
				normalizedProf,
				languageOptions,
				raceSelected,
				classSelected,
				backgroundSelected,
				combinedSelected,
			);
		}
		// Handle selection
		else {
			return this._selectLanguage(
				profItem,
				proficiency,
				normalizedProf,
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

	/**
	 * Deselect a language proficiency
	 * @private
	 */
	_deselectLanguage(
		profItem,
		_proficiency,
		normalizedProf,
		languageOptions,
		raceSelected,
		classSelected,
		backgroundSelected,
		combinedSelected,
	) {
		let removedFromSource = false;

		if (raceSelected.some((p) => p.toLowerCase() === normalizedProf)) {
			languageOptions.race.selected = raceSelected.filter(
				(p) => p.toLowerCase() !== normalizedProf,
			);
			removedFromSource = true;
		}
		if (classSelected.some((p) => p.toLowerCase() === normalizedProf)) {
			languageOptions.class.selected = classSelected.filter(
				(p) => p.toLowerCase() !== normalizedProf,
			);
			removedFromSource = true;
		}
		if (backgroundSelected.some((p) => p.toLowerCase() === normalizedProf)) {
			languageOptions.background.selected = backgroundSelected.filter(
				(p) => p.toLowerCase() !== normalizedProf,
			);
			removedFromSource = true;
		}

		if (!removedFromSource) {
			console.warn(
				"Deselecting language, but could not find it in any source's selected list.",
			);
		}

		languageOptions.selected = combinedSelected.filter(
			(p) => p.toLowerCase() !== normalizedProf,
		);
		this._updateItemUIForDeselection(profItem);
		return true;
	}

	/**
	 * Select a language proficiency
	 * @private
	 */
	_selectLanguage(
		profItem,
		proficiency,
		normalizedProf,
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
			if (
				!languageOptions.selected.some(
					(p) => p.toLowerCase() === normalizedProf,
				)
			) {
				languageOptions.selected.push(proficiency);
			}
			this._updateItemUIForSelection(profItem);
			return true;
		} else {
			console.warn(
				'Could not assign language to any source despite canAdd being true.',
			);
			return false;
		}
	}

	/**
	 * Toggle tool proficiency with source-specific tracking
	 * @private
	 */
	_toggleToolProficiency(profItem, proficiency, character) {
		const normalizedProf = proficiency.toLowerCase();
		const toolOptions = character.optionalProficiencies.tools;

		const raceOptions =
			toolOptions.race?.options?.map((o) => o.toLowerCase()) || [];
		const classOptions =
			toolOptions.class?.options?.map((o) => o.toLowerCase()) || [];
		const backgroundOptions =
			toolOptions.background?.options?.map((o) => o.toLowerCase()) || [];

		const raceAllowsAny = raceOptions.includes('any');
		const classAllowsAny = classOptions.includes('any');
		const backgroundAllowsAny = backgroundOptions.includes('any');

		const isRaceOption = raceAllowsAny || raceOptions.includes(normalizedProf);
		const isClassOption =
			classAllowsAny || classOptions.includes(normalizedProf);
		const isBackgroundOption =
			backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

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
				normalizedProf,
				toolOptions,
				raceSelected,
				classSelected,
				backgroundSelected,
				combinedSelected,
			);
		}
		// Handle selection
		else {
			return this._selectTool(
				profItem,
				proficiency,
				normalizedProf,
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

	/**
	 * Deselect a tool proficiency
	 * @private
	 */
	_deselectTool(
		profItem,
		_proficiency,
		normalizedProf,
		toolOptions,
		raceSelected,
		classSelected,
		backgroundSelected,
		combinedSelected,
	) {
		let removedFromSource = false;

		if (raceSelected.some((p) => p.toLowerCase() === normalizedProf)) {
			toolOptions.race.selected = raceSelected.filter(
				(p) => p.toLowerCase() !== normalizedProf,
			);
			removedFromSource = true;
		}
		if (classSelected.some((p) => p.toLowerCase() === normalizedProf)) {
			toolOptions.class.selected = classSelected.filter(
				(p) => p.toLowerCase() !== normalizedProf,
			);
			removedFromSource = true;
		}
		if (backgroundSelected.some((p) => p.toLowerCase() === normalizedProf)) {
			toolOptions.background.selected = backgroundSelected.filter(
				(p) => p.toLowerCase() !== normalizedProf,
			);
			removedFromSource = true;
		}

		if (!removedFromSource) {
			console.warn(
				"Deselecting tool, but could not find it in any source's selected list.",
			);
		}

		toolOptions.selected = combinedSelected.filter(
			(p) => p.toLowerCase() !== normalizedProf,
		);
		this._updateItemUIForDeselection(profItem);
		return true;
	}

	/**
	 * Select a tool proficiency
	 * @private
	 */
	_selectTool(
		profItem,
		proficiency,
		normalizedProf,
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
			if (
				!toolOptions.selected.some((p) => p.toLowerCase() === normalizedProf)
			) {
				toolOptions.selected.push(proficiency);
			}
			this._updateItemUIForSelection(profItem);
			return true;
		} else {
			console.warn(
				'Could not assign tool to any source despite canAdd being true.',
			);
			return false;
		}
	}

	/**
	 * Toggle simple proficiency (armor/weapons) without source tracking
	 * @private
	 */
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

	/**
	 * Update item UI for selection
	 * @private
	 */
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

	/**
	 * Update item UI for deselection
	 * @private
	 */
	_updateItemUIForDeselection(profItem) {
		profItem.classList.remove('selected', 'optional-selected', 'proficient');
		const icon = profItem.querySelector('i.fas');
		if (icon) icon.classList.remove('optional');
		const unselectHint = profItem.querySelector('.unselect-hint');
		if (unselectHint) unselectHint.remove();
	}
}
