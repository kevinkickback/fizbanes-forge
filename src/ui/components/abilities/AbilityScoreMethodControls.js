// View for rendering method-specific controls (standard array, point buy, custom).
import { abilityScoreService } from '../../../services/AbilityScoreService.js';

class MethodControlsView {
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

	renderPointBuyControls(container, ability, baseScore) {
		// Create button group for +/- controls
		const buttonGroup = document.createElement('div');
		buttonGroup.className =
			'd-flex align-items-center justify-content-center gap-1';

		// Create decrease button
		const decreaseBtn = document.createElement('button');
		decreaseBtn.className = 'btn btn-sm btn-light';
		decreaseBtn.dataset.action = 'decrease';
		decreaseBtn.dataset.ability = ability;
		decreaseBtn.textContent = '-';

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

		// Assemble the controls - no value display between buttons
		buttonGroup.appendChild(decreaseBtn);
		buttonGroup.appendChild(increaseBtn);

		container.appendChild(buttonGroup);
		container.appendChild(costIndicator);
	}

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

MethodControlsView.getInstance = () => {
	if (!_instance) {
		_instance = new MethodControlsView();
	}
	return _instance;
};

export { MethodControlsView };
export const methodControlsView = MethodControlsView.getInstance();
