/**
 * ClassCardView.js
 * View component for displaying class selection and quick description.
 * Handles the main class dropdown and summary display.
 */

import { eventBus, EVENTS } from '../../utils/EventBus.js';

import { textProcessor } from '../../utils/TextProcessor.js';

/**
 * View for the class card's main display (dropdown + quick description)
 */
export class ClassCardView {
	/**
	 * Creates a new ClassCardView instance
	 */
	constructor() {
		/**
		 * The main class selection dropdown element
		 * @type {HTMLSelectElement}
		 * @private
		 */
		this._classSelect = document.getElementById('classSelect');

		/**
		 * The quick description element for displaying class summary
		 * @type {HTMLElement}
		 * @private
		 */
		this._classQuickDesc = document.getElementById('classQuickDesc');

		// Set up event listeners
		this._setupEventListeners();
	}

	//-------------------------------------------------------------------------
	// Event Setup
	//-------------------------------------------------------------------------

	/**
	 * Sets up event listeners for class selection changes
	 * @private
	 */
	_setupEventListeners() {
		if (this._classSelect) {
			this._classSelect.addEventListener('change', (event) => {
				const selectedValue = event.target.value;
				if (selectedValue) {
					const [className, source] = selectedValue.split('_');
					eventBus.emit(EVENTS.CLASS_SELECTED, {
						name: className,
						source: source,
						value: selectedValue,
					});
				}
			});
		}
	}

	//-------------------------------------------------------------------------
	// Public API
	//-------------------------------------------------------------------------

	/**
	 * Get the class select element
	 * @returns {HTMLSelectElement}
	 */
	getClassSelect() {
		return this._classSelect;
	}

	/**
	 * Get the currently selected class value
	 * @returns {string} Format: "ClassName_Source" or empty string
	 */
	getSelectedClassValue() {
		return this._classSelect.value;
	}

	/**
	 * Set the selected class value
	 * @param {string} value - Format: "ClassName_Source"
	 */
	setSelectedClassValue(value) {
		this._classSelect.value = value;
	}

	/**
	 * Populate the class selection dropdown
	 * @param {Array<Object>} classes - Array of class objects
	 */
	populateClassSelect(classes) {
		this._classSelect.innerHTML = '<option value="">Select a Class</option>';

		if (!classes || classes.length === 0) {
			console.error('ClassView', 'No classes provided to populate dropdown');
			return;
		}

		// Sort classes by name
		const sortedClasses = [...classes].sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		// Add options to select
		for (const classData of sortedClasses) {
			const option = document.createElement('option');
			option.value = `${classData.name}_${classData.source}`;
			option.textContent = `${classData.name} (${classData.source})`;
			this._classSelect.appendChild(option);
		}
	}

	/**
	 * Update the quick description for the selected class
	 * @param {Object} classData - The class data
	 * @param {Object|null} fluffData - The class fluff data
	 * @returns {Promise<void>}
	 */
	async updateQuickDescription(classData, fluffData = null) {
		if (!classData || !this._classQuickDesc) {
			return;
		}

		let description = '';

		// Extract description from fluff data
		if (fluffData?.entries) {
			// The fluff structure typically has:
			// - First 3 string entries: Story vignettes (skip these)
			// - 4th+ entries: Actual class description
			// We want to find the first descriptive paragraph that's not a story

			for (const entry of fluffData.entries) {
				if (entry.entries && Array.isArray(entry.entries)) {
					// Look through nested entries
					let foundDescription = false;
					for (let i = 0; i < entry.entries.length; i++) {
						const subEntry = entry.entries[i];
						if (typeof subEntry === 'string') {
							// Skip the first 3 story vignettes, get the 4th paragraph (index 3)
							if (i >= 3) {
								description = subEntry;
								foundDescription = true;
								break;
							}
						}
					}
					if (foundDescription) break;
				}
			}
		}

		// Fallback if no fluff found
		if (!description) {
			description =
				classData.description ||
				`${classData.name} class features and characteristics.`;
		}

		this._classQuickDesc.innerHTML = `
            <h5>${classData.name}</h5>
            <p>${description}</p>
        `;

		// Process reference tags in the description
		await textProcessor.processElement(this._classQuickDesc);
	}

	/**
	 * Reset quick description to placeholder state
	 */
	resetQuickDescription() {
		this._classQuickDesc.innerHTML = `
            <div class="placeholder-content">
                <h5>Select a Class</h5>
                <p>Choose a class to see details about their abilities, proficiencies, and other characteristics.</p>
            </div>
        `;
	}

	/**
	 * Check if a class option exists in the dropdown
	 * @param {string} classValue - Format: "ClassName_Source"
	 * @returns {boolean}
	 */
	hasClassOption(classValue) {
		return Array.from(this._classSelect.options).some(
			(option) => option.value === classValue,
		);
	}

	/**
	 * Trigger a change event on the class select
	 */
	triggerClassSelectChange() {
		this._classSelect.dispatchEvent(new Event('change', { bubbles: true }));
	}
}
