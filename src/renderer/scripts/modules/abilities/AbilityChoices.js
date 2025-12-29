/** View for rendering ability choice dropdowns for race/class bonuses. */

import { abilityScoreService } from '../../services/AbilityScoreService.js';
import { abbreviateAbility } from '../../utils/TextFormatter.js';

/** View for rendering ability choice dropdowns. */
class AbilityChoicesView {
	/**
	 * Creates a new AbilityChoicesView
	 * @param {HTMLElement} container - The main ability score container
	 */
	constructor(container) {
		this._container = container;
	}

	/**
	 * Renders the ability choice dropdowns for pending ability score choices
	 * @param {Function} onAbilityChoice - Callback for ability choice events
	 */
	render(onAbilityChoice) {
		const pendingChoices = abilityScoreService.getPendingChoices();

		if (pendingChoices.length === 0) {
			this._removeChoicesContainer();
			return;
		}

		const choicesContainer = this._getOrCreateChoicesContainer();
		choicesContainer.innerHTML =
			this._createAbilityChoicesContent(pendingChoices);
		this._setupChoiceEventListeners(choicesContainer, onAbilityChoice);
	}

	/**
	 * Creates the HTML content for ability choice dropdowns
	 * @param {Array<AbilityChoice>} pendingChoices - Array of pending ability choices
	 * @returns {string} HTML content for the choices
	 * @private
	 */
	_createAbilityChoicesContent(pendingChoices) {
		return `
            <div class="ability-choices-grid">
                ${pendingChoices.map((choice, index) => this._createChoiceDropdown(choice, index)).join('')}
            </div>
        `;
	}

	/**
	 * Creates a single ability choice dropdown
	 * @param {AbilityChoice} choice - The ability choice object
	 * @param {number} index - The index of the choice
	 * @returns {string} HTML content for the dropdown
	 * @private
	 */
	_createChoiceDropdown(choice, index) {
		const availableAbilities = abilityScoreService.getAvailableAbilities(index);
		const selectedAbility = abilityScoreService.abilityChoices.get(index);

		return `
            <div class="ability-choice-group">
                <label class="form-label">+${choice.amount} bonus (${choice.source.replace(/\s+\d+$/, '')})</label>
                <select class="form-select form-select-sm ability-choice-select" 
                    data-choice-index="${index}" 
                    data-bonus="${choice.amount}" 
                    data-source="${choice.source}">
                    <option value="">Choose...</option>
                    ${availableAbilities
											.map(
												(ability) => `
                        <option value="${ability}" ${selectedAbility === ability ? 'selected' : ''}>
                            ${abbreviateAbility(ability)}
                        </option>
                    `,
											)
											.join('')}
                </select>
            </div>
        `;
	}

	/**
	 * Gets or creates the choices container element
	 * @returns {HTMLElement} The choices container element
	 * @private
	 */
	_getOrCreateChoicesContainer() {
		let container = this._container.querySelector('.ability-choices-container');
		if (!container) {
			container = document.createElement('div');
			container.className = 'ability-choices-container';
			this._container.appendChild(container);
		}
		return container;
	}

	/**
	 * Removes the choices container if it exists
	 * @private
	 */
	_removeChoicesContainer() {
		const container = this._container.querySelector(
			'.ability-choices-container',
		);
		if (container) {
			container.remove();
		}
	}

	/**
	 * Sets up event listeners for ability choice dropdowns
	 * @param {HTMLElement} container - The container with the dropdowns
	 * @param {Function} onAbilityChoice - Callback for ability choice events
	 * @private
	 */
	_setupChoiceEventListeners(container, onAbilityChoice) {
		const dropdowns = container.querySelectorAll('.ability-choice-select');
		for (const dropdown of dropdowns) {
			dropdown.addEventListener('change', onAbilityChoice);
		}
	}

	/**
	 * Updates the container reference for the view
	 * @param {HTMLElement} container - The new container element
	 */
	setContainer(container) {
		this._container = container;
	}
}

let _instance = null;

/**
 * Singleton accessor for AbilityChoicesView
 */
AbilityChoicesView.getInstance = (container) => {
	if (!_instance) {
		_instance = new AbilityChoicesView(container);
	}
	return _instance;
};

export { AbilityChoicesView };
export const abilityChoicesView = AbilityChoicesView.getInstance;
