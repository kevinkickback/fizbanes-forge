/**
 * SubclassPickerView.js
 * View component for subclass selection dropdown.
 */

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
        this._subclassSelect.innerHTML = '<option value="">Select a Subclass</option>';
        this._subclassSelect.disabled = true;

        if (!subclasses || subclasses.length === 0) {
            return;
        }

        // Sort subclasses by name
        const sortedSubclasses = [...subclasses].sort((a, b) => a.name.localeCompare(b.name));

        // Add options to select
        for (const subclass of sortedSubclasses) {
            const option = document.createElement('option');
            option.value = subclass.name;
            option.textContent = `${subclass.name} (${subclass.source})`;
            this._subclassSelect.appendChild(option);
        }

        this._subclassSelect.disabled = false;
    }

    /**
     * Clear and disable the subclass select
     */
    reset() {
        this._subclassSelect.innerHTML = '<option value="">Select a Subclass</option>';
        this._subclassSelect.disabled = true;
    }

    /**
     * Check if a subclass option exists in the dropdown
     * @param {string} subclassName - Subclass name
     * @returns {boolean}
     */
    hasSubclassOption(subclassName) {
        return Array.from(this._subclassSelect.options).some(option => option.value === subclassName);
    }

    /**
     * Trigger a change event on the subclass select
     */
    triggerSubclassSelectChange() {
        this._subclassSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Add event listener to subclass select
     * @param {Function} handler - Event handler function
     */
    onSubclassChange(handler) {
        this._subclassSelect.addEventListener('change', handler);
    }
}
