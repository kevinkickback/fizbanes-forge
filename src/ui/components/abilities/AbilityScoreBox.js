// View for rendering ability score boxes with scores, modifiers, and bonuses.
import { ABILITY_ABBREVIATIONS, attAbvToFull, getAbilityAbbrDisplay } from '../../../lib/5eToolsParser.js';
import { abilityScoreService } from '../../../services/AbilityScoreService.js';
import { methodControlsView } from './AbilityScoreMethodControls.js';

const ABILITIES = ABILITY_ABBREVIATIONS.map(a => attAbvToFull(a).toLowerCase());

class AbilityScoreBoxView {
	constructor(container) {
		this._container = container;
	}

	renderAllAbilityScores(
		isStandardArray,
		isPointBuy,
		isCustom,
	) {
		try {
			// Initialize ability labels from 5eTools utilities
			this._initializeAbilityLabels();

			// Process each ability score
			for (const ability of ABILITIES) {
				this.renderAbilityScoreBox(
					ability,
					isStandardArray,
					isPointBuy,
					isCustom,
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

	_updateBonusDisplay(bonusElement, totalBonus) {
		if (totalBonus !== 0) {
			bonusElement.textContent = `${totalBonus >= 0 ? '+' : ''}${totalBonus}`;
			bonusElement.className = totalBonus >= 0 ? 'bonus' : 'bonus negative';
			bonusElement.classList.remove('u-hidden');
		} else {
			bonusElement.textContent = '';
			bonusElement.classList.add('u-hidden');
		}
	}

	_initializeAbilityLabels() {
		// Populate ability label h6 elements with display-friendly abbreviations
		for (const ability of ABILITIES) {
			const box = this._container.querySelector(`[data-ability="${ability}"]`);
			if (!box) continue;

			const labelEl = box.querySelector('.ability-label');
			if (labelEl) {
				labelEl.textContent = getAbilityAbbrDisplay(ability).toUpperCase();
			}
		}
	}

	renderAbilityScoreBox(
		ability,
		isStandardArray,
		isPointBuy,
		isCustom,
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
		const existingControlDivs = box.querySelectorAll(
			'.mt-2, .ability-controls',
		);
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
		this._updateBonusDisplay(bonusDiv, totalBonus);

		// Create new controls container
		const controlsContainer = document.createElement('div');
		controlsContainer.className = 'ability-controls mt-2';

		// Add appropriate controls based on the ability score method
		if (isStandardArray) {
			methodControlsView.renderStandardArrayControls(
				controlsContainer,
				ability,
			);
		} else if (isPointBuy) {
			methodControlsView.renderPointBuyControls(
				controlsContainer,
				ability,
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

	updateAbilityScoreValues() {
		if (!this._container) {
			console.warn('[AbilityScoreBox]', 'No container set, skipping update');
			return;
		}

		// Check if boxes have been rendered
		const firstBox = this._container.querySelector('[data-ability]');
		if (!firstBox) {
			console.warn('[AbilityScoreBox]', 'Ability boxes not rendered yet, skipping update');
			return;
		}

		for (const ability of ABILITIES) {
			const box = this._container.querySelector(`[data-ability="${ability}"]`);
			if (!box) {
				console.warn('[AbilityScoreBox]', 'Box not found for ability:', ability);
				continue;
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
			this._updateBonusDisplay(bonusDiv, totalBonus);


		}
	}

	updateAllAbilityScores() {
		try {
			// Get the current ability scores from the manager
			const scores = {};
			for (const ability of ABILITIES) {
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
						this._updateBonusDisplay(bonusElement, totalBonus);
					}
				}
			}
		} catch (error) {
			console.error('[AbilityScoreBox]', 'Error updating ability scores:', error);
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
