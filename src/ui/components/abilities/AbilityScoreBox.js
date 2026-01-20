// View for rendering ability score boxes with scores, modifiers, and bonuses.
import { abilityScoreService } from '../../../services/AbilityScoreService.js';
import { methodControlsView } from './AbilityScoreMethodControls.js';

class AbilityScoreBoxView {
	constructor(container) {
		this._container = container;
	}

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
			console.error(
				'AbilityScoreBox',
				'Error rendering ability scores:',
				error,
			);
		}
	}

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

		// Remove all existing control elements (buttons, selects, inputs, spans, divs)
		// This ensures clean slate when switching between methods
		const existingButtons = box.querySelectorAll('button');
		for (const button of existingButtons) {
			button.remove();
		}

		// Remove any select dropdowns from standard array
		const existingSelects = box.querySelectorAll('select');
		for (const select of existingSelects) {
			select.remove();
		}

		// Remove any input elements from custom method
		const existingInputs = box.querySelectorAll('input[type="number"]');
		for (const input of existingInputs) {
			input.remove();
		}

		// Remove any spans that might be value displays from previous renders
		const existingSpans = box.querySelectorAll('span:not(.bonus)');
		for (const span of existingSpans) {
			span.remove();
		}

		// Remove any divs with mt-2 or ability-controls classes
		const existingControlDivs = box.querySelectorAll('.mt-2, .ability-controls');
		for (const div of existingControlDivs) {
			div.remove();
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

	flashBorder(ability) {
		const box = this._container.querySelector(`[data-ability="${ability}"]`);
		if (!box) return;

		box.classList.add('flash-border');
		setTimeout(() => {
			box.classList.remove('flash-border');
		}, 500);
	}

	setContainer(container) {
		this._container = container;
	}
}

let _instance = null;

AbilityScoreBoxView.getInstance = (container) => {
	if (!_instance) {
		_instance = new AbilityScoreBoxView(container);
	}
	return _instance;
};

export { AbilityScoreBoxView };
export const abilityScoreBoxView = AbilityScoreBoxView.getInstance;
