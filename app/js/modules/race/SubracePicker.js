/**
 * SubracePickerView.js
 * View component for subrace selection dropdown.
 */

import { eventBus, EVENTS } from '../../infrastructure/EventBus.js';

/**
 * View for the subrace selection dropdown
 */
export class SubracePickerView {
    /**
     * Creates a new SubracePickerView instance
     */
    constructor() {
        /**
         * The subrace selection dropdown element
         * @type {HTMLSelectElement}
         * @private
         */
        this._subraceSelect = document.getElementById('subraceSelect');

        // Set up event listeners
        this._setupEventListeners();
    }

    //-------------------------------------------------------------------------
    // Event Setup
    //-------------------------------------------------------------------------

    /**
     * Sets up event listeners for subrace selection changes
     * @private
     */
    _setupEventListeners() {
        if (this._subraceSelect) {
            this._subraceSelect.addEventListener('change', (event) => {
                const selectedValue = event.target.value;
                if (selectedValue) {
                    eventBus.emit(EVENTS.SUBRACE_SELECTED, {
                        name: selectedValue,
                        value: selectedValue
                    });
                }
            });
        }
    }

    //-------------------------------------------------------------------------
    // Public API
    //-------------------------------------------------------------------------

    /**
     * Get the subrace select element
     * @returns {HTMLSelectElement}
     */
    getSubraceSelect() {
        return this._subraceSelect;
    }

    /**
     * Get the currently selected subrace value
     * @returns {string} Subrace name or empty string
     */
    getSelectedSubraceValue() {
        return this._subraceSelect.value;
    }

    /**
     * Set the selected subrace value
     * @param {string} value - Subrace name
     */
    setSelectedSubraceValue(value) {
        this._subraceSelect.value = value;
    }

    /**
     * Populate the subrace selection dropdown
     * @param {Array<Object>} subraces - Array of subrace objects
     */
    populateSubraceSelect(subraces) {
        this._subraceSelect.innerHTML = '<option value="">No Subraces</option>';
        this._subraceSelect.disabled = true;

        if (!subraces || subraces.length === 0) {
            return;
        }

        // Filter out subraces without names
        const namedSubraces = subraces.filter(sr => sr.name && sr.name.trim() !== '');

        if (namedSubraces.length === 0) {
            return;
        }

        // Sort subraces by name
        const sortedSubraces = [...namedSubraces].sort((a, b) => a.name.localeCompare(b.name));

        this._subraceSelect.innerHTML = '<option value="">Select Subrace</option>';
        this._subraceSelect.disabled = false;

        // Add options to select
        for (const subrace of sortedSubraces) {
            const option = document.createElement('option');
            option.value = subrace.name;
            option.textContent = subrace.name;
            this._subraceSelect.appendChild(option);
        }
    }

    /**
     * Clear and disable the subrace select
     */
    reset() {
        this._subraceSelect.innerHTML = '<option value="">No Subraces</option>';
        this._subraceSelect.disabled = true;
    }

    /**
     * Check if a subrace option exists in the dropdown
     * @param {string} subraceName - Subrace name
     * @returns {boolean}
     */
    hasSubraceOption(subraceName) {
        return Array.from(this._subraceSelect.options).some(option => option.value === subraceName);
    }

    /**
     * Trigger a change event on the subrace select
     */
    triggerSubraceSelectChange() {
        this._subraceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
