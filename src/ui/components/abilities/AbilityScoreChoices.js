// View for rendering ability choice dropdowns for race/class bonuses.
import { getAbilityAbbrDisplay } from '../../../lib/5eToolsParser.js';
import { abilityScoreService } from '../../../services/AbilityScoreService.js';

class AbilityChoicesView {
	constructor(container) {
		this._container = container;
	}

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

	_createAbilityChoicesContent(pendingChoices) {
		return `
            <div class="ability-choices-grid">
                ${pendingChoices.map((choice, index) => this._createChoiceDropdown(choice, index)).join('')}
            </div>
        `;
	}

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
                            ${getAbilityAbbrDisplay(ability)}
                        </option>
                    `,
				)
				.join('')}
                </select>
            </div>
        `;
	}

	_getOrCreateChoicesContainer() {
		let container = this._container.querySelector('.ability-choices-container');
		if (!container) {
			container = document.createElement('div');
			container.className = 'ability-choices-container';
			this._container.appendChild(container);
		}
		return container;
	}

	_removeChoicesContainer() {
		const container = this._container.querySelector(
			'.ability-choices-container',
		);
		if (container) {
			container.remove();
		}
	}

	_setupChoiceEventListeners(container, onAbilityChoice) {
		const dropdowns = container.querySelectorAll('.ability-choice-select');
		for (const dropdown of dropdowns) {
			dropdown.addEventListener('change', onAbilityChoice);
		}
	}

	setContainer(container) {
		this._container = container;
	}
}

let _instance = null;

AbilityChoicesView.getInstance = (container) => {
	if (!_instance) {
		_instance = new AbilityChoicesView(container);
	}
	return _instance;
};

export { AbilityChoicesView };
export const abilityChoicesView = AbilityChoicesView.getInstance;
