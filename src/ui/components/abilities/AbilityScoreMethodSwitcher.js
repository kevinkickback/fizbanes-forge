// View for ability score method selection using tabs (like class tabs).
import { CharacterManager } from '../../../app/CharacterManager.js';

import { abilityScoreService } from '../../../services/AbilityScoreService.js';

class MethodSwitcherView {
	constructor(container) {
		this._container = container;
		this._methodTabsContainer = document.getElementById('abilityMethodTabs');
		this._tabsList = document.getElementById('abilityMethodTabsList');
	}

	render(onMethodChange) {
		try {
			if (!this._tabsList) return;

			// Get the character and method directly
			const character = CharacterManager.getCurrentCharacter();
			if (!character) {
				return;
			}

			// Always use the method directly from character.variantRules
			const currentMethod =
				character.variantRules?.abilityScoreMethod || 'custom';

			// Create method tabs
			const methods = [
				{ id: 'pointBuy', label: 'Point Buy', icon: 'fa-calculator' },
				{ id: 'standardArray', label: 'Standard Array', icon: 'fa-list-ol' },
				{ id: 'custom', label: 'Custom', icon: 'fa-edit' },
			];

			this._tabsList.innerHTML = methods
				.map((method) => {
					const isActive = currentMethod === method.id;

					return `
					<button class="nav-link ${isActive ? 'active' : ''}" 
							data-method="${method.id}"
							type="button">
						<i class="fas ${method.icon} me-1"></i>
						${method.label}
					</button>
				`;
				})
				.join('');

			// Attach event listeners
			this._tabsList.querySelectorAll('.nav-link').forEach((tab) => {
				tab.addEventListener('click', (e) => {
					const method = e.currentTarget.getAttribute('data-method');
					if (method && method !== currentMethod) {
						// Update active state
						this._tabsList.querySelectorAll('.nav-link').forEach((t) => {
							t.classList.remove('active');
						});
						e.currentTarget.classList.add('active');

						// Trigger method change
						const event = { target: { value: method } };
						onMethodChange(event);
					}
				});
			});
		} catch (error) {
			console.error(
				'MethodSwitcher',
				'Error rendering ability score method tabs:',
				error,
			);
		}
	}

	_getMethodStatusText(method) {
		if (method === 'pointBuy') {
			const usedPoints = abilityScoreService.getUsedPoints();
			const remainingPoints = abilityScoreService.getRemainingPoints();
			const maxPoints = abilityScoreService.getMaxPoints();

			const status = remainingPoints < 0 ? 'danger' : '';
			return `<span class="${status}">${usedPoints}/${maxPoints}</span>`;
		} else if (method === 'standardArray') {
			const availableValues =
				abilityScoreService.getAvailableStandardArrayValues();
			const usedCount = 6 - availableValues.length;
			return `${usedCount}/6`;
		}
		return '';
	}

	updatePointBuyCounter() {
		// Update the separate point buy counter display
		const counterDisplay = document.getElementById('pointBuyDisplay');
		const counterContainer = document.getElementById('pointBuyCounter');

		if (counterDisplay && counterContainer) {
			const remainingPoints = abilityScoreService.getRemainingPoints();

			counterDisplay.textContent = `${remainingPoints}`;
		}
	}

	showPointBuyCounter() {
		const counterContainer = document.getElementById('pointBuyCounter');
		if (counterContainer) {
			counterContainer.style.display = 'block';
			this.updatePointBuyCounter();
		}
	}

	hidePointBuyCounter() {
		const counterContainer = document.getElementById('pointBuyCounter');
		if (counterContainer) {
			counterContainer.style.display = 'none';
		}
	}

	setContainer(container) {
		this._container = container;
		this._methodTabsContainer = document.getElementById('abilityMethodTabs');
		this._tabsList = document.getElementById('abilityMethodTabsList');
	}
}

let _instance = null;

MethodSwitcherView.getInstance = (container) => {
	if (!_instance) {
		_instance = new MethodSwitcherView(container);
	}
	return _instance;
};

export { MethodSwitcherView };
export const methodSwitcherView = MethodSwitcherView.getInstance;
