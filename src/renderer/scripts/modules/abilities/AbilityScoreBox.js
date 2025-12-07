/** View for rendering ability score boxes with scores, modifiers, and bonuses. */


import { abilityScoreService } from '../../services/AbilityScoreService.js';
import { methodControlsView } from './MethodControls.js';

/** View for rendering ability score boxes. */
class AbilityScoreBoxView {
	/**
	 * Creates a new AbilityScoreBoxView
	 * @param {HTMLElement} container - The main ability score container
	 */
	constructor(container) {
		this._container = container;
	}

	/**
	 * Renders all ability score boxes
	 * @param {boolean} isStandardArray - Whether standard array method is being used
	 * @param {boolean} isPointBuy - Whether point buy method is being used
	 * @param {boolean} isCustom - Whether custom method is being used
	 * @param {Function} onStandardArrayChange - Callback for standard array changes
	 */
	renderAllAbilityScores(
		isStandardArray,
		isPointBuy,
		isCustom,
		onStandardArrayChange,
	) {
		try {
			// Process each ability score
			for (const ability of abilityScoreService.getAllAbilities()) {
				this.renderAbilityScoreBox(
					ability,
					isStandardArray,
					isPointBuy,
					isCustom,
					onStandardArrayChange,
				);
			}
		} catch (error) {
			console.error('AbilityScoreBox', 'Error rendering ability scores:', error);
		}
	}

	/**
	 * Renders a single ability score box
	 * @param {string} ability - The ability name (str, dex, etc.)
	 * @param {boolean} isStandardArray - Whether standard array method is being used
	 * @param {boolean} isPointBuy - Whether point buy method is being used
	 * @param {boolean} isCustom - Whether custom method is being used
	 * @param {Function} onStandardArrayChange - Callback for standard array changes
	 */
	renderAbilityScoreBox(
		ability,
		isStandardArray,
		isPointBuy,
		isCustom,
		onStandardArrayChange,
	) {
		const box = this._container.querySelector(`[data-ability="${ability}"]`);
		if (!box) {
			return;
		}

		// Remove any existing buttons that might be in the HTML template
		const existingButtons = box.querySelectorAll('button');
		for (const button of existingButtons) {
			button.remove();
		}

		const baseScore = abilityScoreService.getBaseScore(ability);
		const totalScore = abilityScoreService.getTotalScore(ability);

		// Update score and modifier displays
		box.querySelector('.score').textContent = totalScore;
		box.querySelector('.modifier').textContent =
			abilityScoreService.getModifierString(ability);

		// Update bonus display
		const bonusDiv = box.querySelector('.bonus');
		const totalBonus = totalScore - baseScore;

		if (totalBonus !== 0) {
			bonusDiv.textContent = `${totalBonus >= 0 ? '+' : ''}${totalBonus}`;
			bonusDiv.className = totalBonus >= 0 ? 'bonus' : 'bonus negative';
			bonusDiv.style.display = 'block';
		} else {
			bonusDiv.textContent = '';
			bonusDiv.style.display = 'none';
		}

		// Remove any existing method-specific controls
		const existingControlsContainer = box.querySelector('.ability-controls');
		if (existingControlsContainer) {
			existingControlsContainer.remove();
		}

		// Create new controls container
		const controlsContainer = document.createElement('div');
		controlsContainer.className = 'ability-controls mt-2';

		// Add appropriate controls based on the ability score method
		if (isStandardArray) {
			methodControlsView.renderStandardArrayControls(
				controlsContainer,
				ability,
				baseScore,
				onStandardArrayChange,
			);
		} else if (isPointBuy) {
			methodControlsView.renderPointBuyControls(
				controlsContainer,
				ability,
				baseScore,
			);
		} else if (isCustom) {
			methodControlsView.renderCustomControls(
				controlsContainer,
				ability,
				baseScore,
			);
		}

		// Append the controls
		box.appendChild(controlsContainer);
	}

	/**
	 * Updates only the ability score values without re-rendering the whole card
	 * @param {boolean} isPointBuy - Whether point buy method is active
	 */
	updateAbilityScoreValues(isPointBuy) {
		for (const ability of abilityScoreService.getAllAbilities()) {
			const box = this._container.querySelector(`[data-ability="${ability}"]`);
			if (!box) continue;

			const baseScore = abilityScoreService.getBaseScore(ability);
			const totalScore = abilityScoreService.getTotalScore(ability);

			// Update score and modifier displays
			box.querySelector('.score').textContent = totalScore;
			box.querySelector('.modifier').textContent =
				abilityScoreService.getModifierString(ability);

			// Update bonus display
			const bonusDiv = box.querySelector('.bonus');
			const totalBonus = totalScore - baseScore;

			if (totalBonus !== 0) {
				bonusDiv.textContent = `${totalBonus >= 0 ? '+' : ''}${totalBonus}`;
				bonusDiv.className = totalBonus >= 0 ? 'bonus' : 'bonus negative';
				bonusDiv.style.display = 'block';
			} else {
				bonusDiv.textContent = '';
				bonusDiv.style.display = 'none';
			}

			// Update point cost indicator if this is point buy method
			if (isPointBuy) {
				const controlsContainer = box.querySelector('.ability-controls');
				if (controlsContainer) {
					// First remove any existing cost indicators
					const existingCosts =
						controlsContainer.querySelectorAll('.point-cost');
					for (const cost of existingCosts) {
						cost.remove();
					}

					// Get updated cost
					const cost = abilityScoreService.getPointCost(baseScore);

					// Determine cost level for styling
					let costClass = 'low';
					if (cost >= 7) {
						costClass = 'high';
					} else if (cost >= 4) {
						costClass = 'medium';
					}

					// Add updated cost indicator
					const costIndicator = document.createElement('div');
					costIndicator.className = `point-cost ${costClass}`;
					costIndicator.textContent = `${cost} pts`;
					controlsContainer.appendChild(costIndicator);
				}
			}
		}
	}

	/**
	 * Updates all ability score displays including scores, modifiers, and bonus display
	 */
	updateAllAbilityScores() {
		try {
			// Get the current ability scores from the manager
			const scores = {};
			for (const ability of abilityScoreService._allAbilities) {
				scores[ability] = abilityScoreService.getTotalScore(ability);
			}

			// Update each ability score box
			for (const [ability, score] of Object.entries(scores)) {
				const box = this._container.querySelector(
					`[data-ability="${ability}"]`,
				);
				if (box) {
					// Update the score display
					const scoreElement = box.querySelector('.score');
					if (scoreElement) {
						scoreElement.textContent = score;
					}

					// Update the modifier
					const modifierElement = box.querySelector('.modifier');
					if (modifierElement) {
						modifierElement.textContent =
							abilityScoreService.getModifierString(ability);
					}

					// Update the bonus display
					const bonusElement = box.querySelector('.bonus');
					if (bonusElement) {
						const baseScore = abilityScoreService.getBaseScore(ability);
						const totalBonus = score - baseScore;
						if (totalBonus !== 0) {
							bonusElement.textContent = `${totalBonus >= 0 ? '+' : ''}${totalBonus}`;
							bonusElement.className =
								totalBonus >= 0 ? 'bonus' : 'bonus negative';
							bonusElement.style.display = 'block';
						} else {
							bonusElement.textContent = '';
							bonusElement.style.display = 'none';
						}
					}
				}
			}
		} catch (error) {
			console.error('AbilityScoreBox', 'Error updating ability scores:', error);
		}
	}

	/**
	 * Adds a flash border animation to an ability box
	 * @param {string} ability - The ability name
	 */
	flashBorder(ability) {
		const box = this._container.querySelector(`[data-ability="${ability}"]`);
		if (!box) return;

		box.classList.add('flash-border');
		setTimeout(() => {
			box.classList.remove('flash-border');
		}, 500);
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
 * Singleton accessor for AbilityScoreBoxView
 */
AbilityScoreBoxView.getInstance = (container) => {
	if (!_instance) {
		_instance = new AbilityScoreBoxView(container);
	}
	return _instance;
};

export { AbilityScoreBoxView };
export const abilityScoreBoxView = AbilityScoreBoxView.getInstance;
