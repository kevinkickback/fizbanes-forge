/**
 * RaceCardView.js
 * View component for displaying race selection and quick description.
 * Handles the main race dropdown and summary display.
 */

import { eventBus, EVENTS } from '../../infrastructure/EventBus.js';
import { Logger } from '../../infrastructure/Logger.js';
import { textProcessor } from '../../utils/TextProcessor.js';

/**
 * View for the race card's main display (dropdown + quick description)
 */
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
			Logger.error('RaceView', 'No races provided to populate dropdown');
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
