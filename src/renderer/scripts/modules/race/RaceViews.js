/** View components for race selection: main dropdown, quick description, and subrace picker. */

import { eventBus, EVENTS } from '../../utils/EventBus.js';
import { textProcessor } from '../../utils/TextProcessor.js';

//=============================================================================
// Race Card View - Main race dropdown and quick description
//=============================================================================

/** View for the race card's main display (dropdown + quick description). */
export class RaceCardView {
    /**
     * Creates a new RaceCardView instance
     */
    constructor() {
        /**
         * The main race selection dropdown element
         * @type {HTMLSelectElement}
         * @private
         */
        this._raceSelect = document.getElementById('raceSelect');

        /**
         * The quick description element for displaying race summary
         * @type {HTMLElement}
         * @private
         */
        this._raceQuickDesc = document.getElementById('raceQuickDesc');

        // Set up event listeners
        this._setupEventListeners();
    }

    //-------------------------------------------------------------------------
    // Event Setup
    //-------------------------------------------------------------------------

    /**
     * Sets up event listeners for race selection changes
     * @private
     */
    _setupEventListeners() {
        if (this._raceSelect) {
            this._raceSelect.addEventListener('change', (event) => {
                const selectedValue = event.target.value;
                if (selectedValue) {
                    const [raceName, source] = selectedValue.split('_');
                    eventBus.emit(EVENTS.RACE_SELECTED, {
                        name: raceName,
                        source,
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
     * Get the race select element
     * @returns {HTMLSelectElement}
     */
    getRaceSelect() {
        return this._raceSelect;
    }

    /**
     * Get the currently selected race value
     * @returns {string} Format: "RaceName_Source" or empty string
     */
    getSelectedRaceValue() {
        return this._raceSelect.value;
    }

    /**
     * Set the selected race value
     * @param {string} value - Format: "RaceName_Source"
     */
    setSelectedRaceValue(value) {
        this._raceSelect.value = value;
    }

    /**
     * Populate the race selection dropdown
     * @param {Array<Object>} races - Array of race objects
     */
    populateRaceSelect(races) {
        this._raceSelect.innerHTML = '<option value="">Select a Race</option>';

        if (!races || races.length === 0) {
            console.error('RaceView', 'No races provided to populate dropdown');
            return;
        }

        // Sort races by name
        const sortedRaces = [...races].sort((a, b) => a.name.localeCompare(b.name));

        // Add options to select
        for (const race of sortedRaces) {
            const option = document.createElement('option');
            option.value = `${race.name}_${race.source}`;
            option.textContent = `${race.name} (${race.source})`;
            this._raceSelect.appendChild(option);
        }
    }

    /**
     * Update the quick description for the selected race
     * @param {Object} race - The race data
     * @param {Object|null} fluffData - The race fluff data
     * @returns {Promise<void>}
     */
    async updateQuickDescription(race, fluffData = null) {
        if (!race) {
            this.resetQuickDescription();
            return;
        }

        let description = '';

        // Extract description from fluff data
        if (fluffData?.entries) {
            // Race fluff has a deeply nested structure:
            // entries[0].entries[0].entries[0] is usually the first descriptive paragraph
            const traverseEntries = (entries) => {
                if (!Array.isArray(entries)) return null;

                for (const entry of entries) {
                    if (typeof entry === 'string') {
                        return entry;
                    } else if (entry?.entries) {
                        const result = traverseEntries(entry.entries);
                        if (result) return result;
                    }
                }
                return null;
            };

            description = traverseEntries(fluffData.entries);
        }

        // Fallback if no fluff found
        if (!description) {
            description = `${race.name} are a playable race in D&D.`;
        }

        const processedDescription = await textProcessor.processString(description);

        this._raceQuickDesc.innerHTML = `
            <h5>${race.name}</h5>
            <p>${processedDescription}</p>
        `;
    }

    /**
     * Reset quick description to placeholder state
     */
    resetQuickDescription() {
        this._raceQuickDesc.innerHTML = `
            <div class="placeholder-content">
                <h5>Select a Race</h5>
                <p>Choose a race to see details about their traits, abilities, and other characteristics.</p>
            </div>
        `;
    }

    /**
     * Check if a race option exists in the dropdown
     * @param {string} raceValue - Format: "RaceName_Source"
     * @returns {boolean}
     */
    hasRaceOption(raceValue) {
        return Array.from(this._raceSelect.options).some(
            (option) => option.value === raceValue,
        );
    }

    /**
     * Trigger a change event on the race select
     */
    triggerRaceSelectChange() {
        this._raceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

//=============================================================================
// Subrace Picker View - Subrace dropdown
//=============================================================================

/** View for the subrace selection dropdown. */
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
                // Emit event for both named subraces and standard (empty value)
                eventBus.emit(EVENTS.SUBRACE_SELECTED, {
                    name: selectedValue,
                    value: selectedValue,
                });
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
     * @param {boolean} isRequired - Whether subrace selection is required
     */
    populateSubraceSelect(subraces, isRequired = false) {
        this._subraceSelect.innerHTML = '<option value="">No Subraces</option>';
        this._subraceSelect.disabled = true;

        if (!subraces || subraces.length === 0) {
            return;
        }

        // Filter out subraces without names
        const namedSubraces = subraces.filter(
            (sr) => sr.name && sr.name.trim() !== '',
        );

        if (namedSubraces.length === 0) {
            return;
        }

        // Sort subraces by name
        const sortedSubraces = [...namedSubraces].sort((a, b) =>
            a.name.localeCompare(b.name),
        );

        // If subraces are optional, show "Standard" option as the default
        if (!isRequired) {
            this._subraceSelect.innerHTML = '<option value="">Standard</option>';
        } else {
            // If required, don't show a placeholder option
            this._subraceSelect.innerHTML = '';
        }

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
        return Array.from(this._subraceSelect.options).some(
            (option) => option.value === subraceName,
        );
    }

    /**
     * Trigger a change event on the subrace select
     */
    triggerSubraceSelectChange() {
        this._subraceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
