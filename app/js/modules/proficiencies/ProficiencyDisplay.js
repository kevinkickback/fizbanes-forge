/**
 * ProficiencyDisplayView.js
 * Handles rendering and display of proficiency containers and items
 */

/**
 * View component for rendering proficiency lists and items
 */
export class ProficiencyDisplayView {
	constructor() {
		this._proficiencyTypes = [
			'skills',
			'savingThrows',
			'languages',
			'tools',
			'armor',
			'weapons',
		];
	}

	/**
	 * Render all proficiency containers with available options
	 * @param {Object} containers - DOM element references for proficiency containers
	 * @param {Character} character - The character object
	 * @param {Array} availableOptionsMap - Map of type to available options
	 * @param {Object} defaultProficiencies - Default proficiencies for all characters
	 * @param {Function} isGrantedBySource - Function to check if proficiency is granted
	 * @param {Function} isProficiencyAvailable - Function to check if proficiency is available
	 * @param {Function} getIconForType - Function to get icon for proficiency type
	 * @param {ProficiencyService} proficiencyManager - Proficiency service instance
	 */
	renderContainers(
		containers,
		character,
		availableOptionsMap,
		defaultProficiencies,
		isGrantedBySource,
		isProficiencyAvailable,
		getIconForType,
		proficiencyManager,
	) {
		if (!character) return;

		for (const type of this._proficiencyTypes) {
			const container = containers[type];
			if (!container) continue;

			const availableOptions = availableOptionsMap[type] || [];

			// Check combined slot availability BEFORE the loop
			const optionalAllowed =
				character?.optionalProficiencies?.[type]?.allowed || 0;
			const selectedCount =
				character?.optionalProficiencies?.[type]?.selected?.length || 0;
			const combinedSlotsAvailable =
				optionalAllowed > 0 && selectedCount < optionalAllowed;

			// Handle selection counter in section header
			this._updateSelectionCounter(
				container,
				type,
				selectedCount,
				optionalAllowed,
			);

			// Build the container content
			const containerHtml = this._buildContainerHtml(
				type,
				availableOptions,
				character,
				defaultProficiencies,
				isGrantedBySource,
				isProficiencyAvailable,
				combinedSlotsAvailable,
				getIconForType,
				proficiencyManager,
			);

			container.innerHTML = containerHtml;
		}
	}

	/**
	 * Update selection counter in section header
	 * @param {HTMLElement} container - The proficiency container
	 * @param {string} type - Proficiency type
	 * @param {number} selectedCount - Number of selected proficiencies
	 * @param {number} optionalAllowed - Number of proficiencies allowed
	 * @private
	 */
	_updateSelectionCounter(container, type, selectedCount, optionalAllowed) {
		const header = container
			.closest('.proficiency-section')
			?.querySelector('h6');
		if (header && type !== 'savingThrows') {
			if (optionalAllowed > 0) {
				let counterElem = header.querySelector('.selection-counter');
				if (!counterElem) {
					counterElem = document.createElement('span');
					counterElem.className = 'selection-counter';
					header.appendChild(counterElem);
				}
				counterElem.textContent = ` (${selectedCount}/${optionalAllowed} selected)`;
			} else if (header.querySelector('.selection-counter')) {
				header.querySelector('.selection-counter').remove();
			}
		}
	}

	/**
	 * Build HTML for a proficiency container
	 * @private
	 */
	_buildContainerHtml(
		type,
		availableOptions,
		character,
		defaultProficiencies,
		isGrantedBySource,
		isProficiencyAvailable,
		combinedSlotsAvailable,
		getIconForType,
		proficiencyManager,
	) {
		let containerHtml = '';

		for (const item of availableOptions) {
			// Check if this proficiency is already selected (part of combined list)
			const isOptionallySelected =
				character?.optionalProficiencies?.[type]?.selected?.includes(item) ||
				false;

			// Check if this is a default proficiency (always selected)
			const isDefault = defaultProficiencies[type]?.includes(item);

			// Check if this proficiency is granted by a fixed source like race/background/class feature
			const isGranted = isGrantedBySource(type, item);

			// Check if this proficiency *could* be selected based on its source/options/source-slots
			const isPotentiallySelectable = isProficiencyAvailable(type, item);

			// Determine UI state and classes
			const cssClasses = ['proficiency-item'];

			if (isDefault || isGranted) {
				cssClasses.push('proficient', 'default');
			} else if (isOptionallySelected) {
				cssClasses.push('proficient', 'selected', 'optional-selected');
			} else if (combinedSlotsAvailable && isPotentiallySelectable) {
				cssClasses.push('selectable');
			} else {
				cssClasses.push('disabled');
			}

			// Add source-specific classes ONLY if it's visually selectable
			if (
				cssClasses.includes('selectable') &&
				(type === 'skills' || type === 'languages')
			) {
				this._addSourceSpecificClasses(cssClasses, type, item, character);
			}

			// Build the item HTML
			containerHtml += this._buildItemHtml(
				cssClasses,
				item,
				type,
				isOptionallySelected,
				getIconForType,
				proficiencyManager,
			);
		}

		return containerHtml;
	}

	/**
	 * Add source-specific CSS classes (race-only, class-only, background-only)
	 * @private
	 */
	_addSourceSpecificClasses(cssClasses, type, item, character) {
		const raceOptions =
			character.optionalProficiencies?.[type]?.race?.options || [];
		const classOptions =
			character.optionalProficiencies?.[type]?.class?.options || [];
		const backgroundOptions =
			character.optionalProficiencies?.[type]?.background?.options || [];

		const normalizedItem = typeof item === 'string' ? item : String(item);

		const inRace = raceOptions.includes(normalizedItem);
		const inClass = classOptions.includes(normalizedItem);
		const inBackground = backgroundOptions.includes(normalizedItem);

		if (inRace && !inClass && !inBackground) {
			cssClasses.push('race-only');
		} else if (!inRace && inClass && !inBackground) {
			cssClasses.push('class-only');
		} else if (!inRace && !inClass && inBackground) {
			cssClasses.push('background-only');
		}
	}

	/**
	 * Build HTML for a single proficiency item
	 * @private
	 */
	_buildItemHtml(
		cssClasses,
		item,
		type,
		isOptionallySelected,
		getIconForType,
		proficiencyManager,
	) {
		const iconClass = getIconForType(type);
		const optionalClass = isOptionallySelected ? 'optional' : '';
		const abilityDisplay =
			type === 'skills'
				? `<span class="ability">(${proficiencyManager.getSkillAbility(item)})</span>`
				: '';
		const unselectHint = isOptionallySelected
			? '<span class="unselect-hint"><i class="fas fa-times"></i></span>'
			: '';

		return (
			`<div class="${cssClasses.join(' ')}" data-proficiency="${item}" data-type="${type}">` +
			`<i class="fas ${iconClass} ${optionalClass}"></i>${item}` +
			abilityDisplay +
			unselectHint +
			'</div>'
		);
	}

	/**
	 * Update all selection counters
	 * @param {Object} containers - DOM element references for proficiency containers
	 * @param {Character} character - The character object
	 */
	updateSelectionCounters(containers, character) {
		for (const type of this._proficiencyTypes) {
			const container = containers[type];
			if (!container) continue;

			const header = container
				.closest('.proficiency-section')
				?.querySelector('h6');
			const counter = header?.querySelector('.selection-counter');
			if (!counter) continue;

			const allowed = character?.optionalProficiencies?.[type]?.allowed || 0;
			const selected =
				character?.optionalProficiencies?.[type]?.selected?.length || 0;
			counter.textContent = ` (${selected}/${allowed} selected)`;
		}
	}

	/**
	 * Get the appropriate icon class for a proficiency type
	 * @param {string} type - Proficiency type
	 * @returns {string} Font Awesome icon class
	 */
	getIconForType(type) {
		switch (type) {
			case 'skills':
				return 'fa-check-circle';
			case 'savingThrows':
				return 'fa-dice-d20';
			case 'tools':
				return 'fa-tools';
			case 'weapons':
				return 'fa-gavel';
			case 'armor':
				return 'fa-shield-alt';
			case 'languages':
				return 'fa-comment';
			default:
				return 'fa-circle';
		}
	}

	/**
	 * Get the label for a proficiency type
	 * @param {string} type - Proficiency type
	 * @returns {string} User-friendly label
	 */
	getTypeLabel(type) {
		switch (type) {
			case 'skills':
				return 'Skills';
			case 'savingThrows':
				return 'Saving Throws';
			case 'languages':
				return 'Languages';
			case 'tools':
				return 'Tools';
			case 'armor':
				return 'Armor';
			case 'weapons':
				return 'Weapons';
			default:
				return type.charAt(0).toUpperCase() + type.slice(1);
		}
	}
}
