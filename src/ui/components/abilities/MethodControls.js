/** View for rendering method-specific controls (standard array, point buy, custom). */

import { abilityScoreService } from '../../../services/AbilityScoreService.js';

/** View for rendering ability score input controls based on the selected method. */
class MethodControlsView {
	/**
	 * Renders standard array controls for an ability score
	 * @param {HTMLElement} container - The container element
	 * @param {string} ability - The ability name
	 * @param {number} _baseScore - The base score
	 * @param {Function} onStandardArrayChange - Callback for standard array changes
	 */
	renderStandardArrayControls(
		container,
		ability,
		_baseScore,
		onStandardArrayChange,
	) {
		// Clear any existing content in the container
		container.innerHTML = '';

		// Create the select dropdown
		const select = document.createElement('select');
		select.className = 'form-select form-select-sm standard-array-select';
		select.dataset.ability = ability;

		// Update the options in the select to reflect current state
		this.updateStandardArrayOptions(select, ability);

		// Add change event listener
		select.addEventListener('change', onStandardArrayChange);

		// Add the select to the container
		container.appendChild(select);
	}

	/**
	 * Renders point buy controls for an ability score
	 * @param {HTMLElement} container - The container element
	 * @param {string} ability - The ability name
	 * @param {number} baseScore - The base score
	 */
	renderPointBuyControls(container, ability, baseScore) {
		// Create button group for +/- controls
		const buttonGroup = document.createElement('div');
		buttonGroup.className = 'd-flex align-items-center justify-content-center';

		// Create decrease button
		const decreaseBtn = document.createElement('button');
		decreaseBtn.className = 'btn btn-sm btn-light me-1';
		decreaseBtn.dataset.action = 'decrease';
		decreaseBtn.dataset.ability = ability;
		decreaseBtn.textContent = '-';

		// Create value display
		const valueDisplay = document.createElement('span');
		valueDisplay.className = 'mx-2 fw-bold';
		valueDisplay.textContent = baseScore;

		// Create increase button
		const increaseBtn = document.createElement('button');
		increaseBtn.className = 'btn btn-sm btn-light';
		increaseBtn.dataset.action = 'increase';
		increaseBtn.dataset.ability = ability;
		increaseBtn.textContent = '+';

		// Add cost indicator
		const cost = abilityScoreService.getPointCost(baseScore);
		let costClass = 'low';
		if (cost >= 7) {
			costClass = 'high';
		} else if (cost >= 4) {
			costClass = 'medium';
		}

		const costIndicator = document.createElement('div');
		costIndicator.className = `point-cost ${costClass}`;
		costIndicator.textContent = `${cost} pts`;

		// Assemble the controls
		buttonGroup.appendChild(decreaseBtn);
		buttonGroup.appendChild(valueDisplay);
		buttonGroup.appendChild(increaseBtn);

		container.appendChild(buttonGroup);
		container.appendChild(costIndicator);
	}

	/**
	 * Renders custom controls for an ability score
	 * @param {HTMLElement} container - The container element
	 * @param {string} ability - The ability name
	 * @param {number} baseScore - The base score
	 */
	renderCustomControls(container, ability, baseScore) {
		// Create number input for direct value entry
		const input = document.createElement('input');
		input.type = 'number';
		input.className = 'form-control form-control-sm ability-custom-input';
		input.min = abilityScoreService.minScore;
		input.max = abilityScoreService.maxScore;
		input.value = baseScore;
		input.dataset.ability = ability;

		// Add to container
		container.appendChild(input);
	}

	/**
	 * Updates options in a standard array select dropdown
	 * @param {HTMLSelectElement} select - The select element to update
	 * @param {string} ability - The ability name
	 */
	updateStandardArrayOptions(select, ability) {
		const currentValue = abilityScoreService.getBaseScore(ability);

		// Clear all existing options
		select.innerHTML = '';

		// Add options for all standard array values
		for (const value of abilityScoreService.getStandardArrayValues()) {
			const option = document.createElement('option');
			option.value = String(value);
			option.textContent = String(value);

			// Never disable options - allow selection of any value
			option.disabled = false;

			// Set as selected if it matches the current value
			if (Number(value) === Number(currentValue)) {
				option.selected = true;
			}

			select.appendChild(option);
		}

		// Force the select value to match the current value
		select.value = String(currentValue);
	}
}

let _instance = null;

/**
 * Singleton accessor for MethodControlsView
 */
MethodControlsView.getInstance = () => {
	if (!_instance) {
		_instance = new MethodControlsView();
	}
	return _instance;
};

export { MethodControlsView };
export const methodControlsView = MethodControlsView.getInstance();
