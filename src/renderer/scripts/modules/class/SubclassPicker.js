/**
 * SubclassPickerView.js
 * View component for subclass selection dropdown.
 */

import { eventBus, EVENTS } from '../../infrastructure/EventBus.js';

/**
 * View for the subclass selection dropdown
 */
export class SubclassPickerView {
	/**
	 * Creates a new SubclassPickerView instance
	 */
	constructor() {
		/**
		 * The subclass selection dropdown element
		 * @type {HTMLSelectElement}
		 * @private
		 */
		this._subclassSelect = document.getElementById('subclassSelect');

		// Set up event listeners
		this._setupEventListeners();
	}

	//-------------------------------------------------------------------------
	// Event Setup
	//-------------------------------------------------------------------------

	/**
	 * Sets up event listeners for subclass selection changes
	 * @private
	 */
	_setupEventListeners() {
		if (this._subclassSelect) {
			this._subclassSelect.addEventListener('change', (event) => {
				const selectedValue = event.target.value;
				if (selectedValue) {
					eventBus.emit(EVENTS.SUBCLASS_SELECTED, {
						name: selectedValue,
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
	 * Get the subclass select element
	 * @returns {HTMLSelectElement}
	 */
	getSubclassSelect() {
		return this._subclassSelect;
	}

	/**
	 * Get the currently selected subclass value
	 * @returns {string} Subclass name or empty string
	 */
	getSelectedSubclassValue() {
		return this._subclassSelect.value;
	}

	/**
	 * Set the selected subclass value
	 * @param {string} value - Subclass name
	 */
	setSelectedSubclassValue(value) {
		this._subclassSelect.value = value;
	}

	/**
	 * Populate the subclass selection dropdown
	 * @param {Array<Object>} subclasses - Array of subclass objects
	 */
	populateSubclassSelect(subclasses) {
		this._subclassSelect.innerHTML =
			'<option value="">Select a Subclass</option>';
		this._subclassSelect.disabled = true;

		if (!subclasses || subclasses.length === 0) {
			return;
		}

		// Sort subclasses by name
		const sortedSubclasses = [...subclasses].sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		// Add options to select
		for (const subclass of sortedSubclasses) {
			const option = document.createElement('option');
			option.value = subclass.name;
			const src =
				subclass.subclassSource ||
				subclass.source ||
				subclass.classSource ||
				'';
			option.textContent = src ? `${subclass.name} (${src})` : subclass.name;
			this._subclassSelect.appendChild(option);
		}

		this._subclassSelect.disabled = false;
	}

	/**
	 * Clear and disable the subclass select
	 */
	reset() {
		this._subclassSelect.innerHTML =
			'<option value="">Select a Subclass</option>';
		this._subclassSelect.disabled = true;
	}

	/**
	 * Check if a subclass option exists in the dropdown
	 * @param {string} subclassName - Subclass name
	 * @returns {boolean}
	 */
	hasSubclassOption(subclassName) {
		return Array.from(this._subclassSelect.options).some(
			(option) => option.value === subclassName,
		);
	}

	/**
	 * Trigger a change event on the subclass select
	 */
	triggerSubclassSelectChange() {
		this._subclassSelect.dispatchEvent(new Event('change', { bubbles: true }));
	}
}
