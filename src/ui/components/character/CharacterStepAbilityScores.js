// Step 5: Ability Scores - score assignment based on method from step 1

import {
	ABILITY_NAMES,
	formatModifierNumber,
	getAbilityAbbrDisplay,
	getAbilityModNumber,
} from '../../../lib/5eToolsParser.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import {
	calculatePointBuyTotal,
	getPointBuyCost,
	getRaceAbilityData,
	POINT_BUY_BUDGET,
	STANDARD_ARRAY,
} from '../../../services/AbilityScoreService.js';
import { raceService } from '../../../services/RaceService.js';

const ABILITIES = ABILITY_NAMES.map(n => n.toLowerCase());

export class CharacterStepAbilityScores {
	static ABILITIES = ABILITIES;
	static STANDARD_ARRAY = STANDARD_ARRAY;

	constructor(session, modal) {
		this.session = session;
		this.modal = modal;
		this._cleanup = DOMCleanup.create();
		this._abilityChoiceData = null;
	}

	async render() {
		const stagedData = this.session.getStagedData();
		const method = stagedData.abilityScoreMethod || 'pointBuy';

		// Get race ability data for choices
		const raceName = stagedData.race?.name;
		const raceSource = stagedData.race?.source;
		const subraceName = stagedData.race?.subrace;

		if (raceName && raceSource) {
			const race = raceService.getRace(raceName, raceSource);
			const subrace = subraceName
				? raceService.getSubrace(raceName, subraceName, raceSource)
				: null;
			this._abilityChoiceData = getRaceAbilityData(race, subrace);
		} else {
			this._abilityChoiceData = { fixed: [], choices: [] };
		}

		return `
			<div class="step-5-ability-scores">
				<div class="card">
					<div class="card-header d-flex justify-content-between align-items-center">
						<div>
							<i class="fas fa-star"></i> Ability Scores
						</div>
						${method === 'pointBuy' ? `<div class="points-remaining-display-header">
							<strong>Points Remaining:</strong> ${POINT_BUY_BUDGET - this._calculatePointsUsed()}
						</div>` : ''}
					</div>
                    <div class="card-body">
                        <div class="ability-score-container">
                            <div class="ability-score-grid">
                                ${this._renderAbilityScoreBoxes()}
                            </div>
                        </div>
                        ${this._abilityChoiceData.choices.length > 0 ? this._renderAbilityChoices() : ''}
                    </div>
                </div>
            </div>
        `;
	}

	_renderAbilityScoreBoxes() {
		const abilities = CharacterStepAbilityScores.ABILITIES;
		const stagedData = this.session.getStagedData();

		// Initialize ability scores in staged data if not present (basic initialization only)
		if (!stagedData.abilityScores) {
			stagedData.abilityScores = {
				strength: 8,
				dexterity: 8,
				constitution: 8,
				intelligence: 8,
				wisdom: 8,
				charisma: 8,
			};
		}

		return abilities
			.map((ability) => {
				const baseScore = stagedData.abilityScores[ability] || 8;
				const racialBonus = this._getRacialBonus(ability);
				const totalScore = baseScore + racialBonus;
				const modifier = formatModifierNumber(
					getAbilityModNumber(totalScore),
				);

				return `
                <div class="ability-score-box" data-ability="${ability}">
                    <h6>${ability.toUpperCase()}</h6>
                    <div class="score">${totalScore}</div>
                    <div class="modifier">${modifier}</div>
                    ${racialBonus !== 0 ? `<div class="bonus ${racialBonus < 0 ? 'negative' : ''} u-block">${racialBonus >= 0 ? '+' : ''}${racialBonus}</div>` : '<div class="bonus u-hidden"></div>'}
                    <div class="ability-controls mt-2" id="controls-${ability}">
                        <!-- Controls will be added dynamically -->
                    </div>
                </div>
            `;
			})
			.join('');
	}

	_renderAbilityChoices() {
		if (!this._abilityChoiceData || !this._abilityChoiceData.choices.length) {
			return '';
		}

		const stagedData = this.session.getStagedData();
		const savedChoices = stagedData.race?.abilityChoices || [];

		// Collect all currently selected abilities (to exclude from other dropdowns)
		const selectedAbilities = new Set();
		for (const choice of savedChoices) {
			if (choice?.ability) {
				selectedAbilities.add(choice.ability);
			}
		}

		let dropdownsHTML = '';
		let choiceIndex = 0;

		for (const choice of this._abilityChoiceData.choices) {
			const count = choice.count || 1;
			const amount = choice.amount || 1;
			const source = choice.source || 'Race';

			for (let i = 0; i < count; i++) {
				const savedChoice = savedChoices[choiceIndex];
				const selectedAbility = savedChoice?.ability || '';

				// Filter available options: exclude abilities selected in other dropdowns
				// but always include the currently selected ability for this dropdown
				const availableAbilities = choice.from.filter(
					(ability) =>
						ability === selectedAbility || !selectedAbilities.has(ability),
				);

				dropdownsHTML += `
				<div class="ability-choice-dropdown">
                        <label class="form-label">+${amount} bonus (${source})</label>
                        <select class="form-select form-select-sm" data-choice-index="${choiceIndex}">
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
				choiceIndex++;
			}
		}

		return `
			<div class="racial-ability-choices">
				<div class="d-flex gap-3 justify-content-center">
					${dropdownsHTML}
				</div>
			</div>
		`;
	}

	_calculatePointsUsed() {
		const stagedData = this.session.getStagedData();
		return calculatePointBuyTotal(stagedData.abilityScores);
	}

	_getRacialBonus(ability) {
		const stagedData = this.session.getStagedData();
		const raceName = stagedData.race?.name;
		const raceSource = stagedData.race?.source;
		const subraceName = stagedData.race?.subrace;

		if (!raceName || !raceSource) return 0;

		// Get race and subrace data from service
		const race = raceService.getRace(raceName, raceSource);
		if (!race) return 0;

		let subrace = null;
		if (subraceName) {
			subrace = raceService.getSubrace(raceName, subraceName, raceSource);
		} else {
			// Get base (unnamed) subrace if no explicit subrace selected
			// This handles races like Human where ability bonuses are stored in the base subrace
			subrace = raceService.getBaseSubrace(raceName, raceSource);
		}

		// Parse ability increases from race and subrace
		const abilityArray = [
			...(race?.ability || []),
			...(subrace?.ability || []),
		];

		if (abilityArray.length === 0) return 0;

		// Calculate bonus for this specific ability
		let bonus = 0;
		for (const abilityEntry of abilityArray) {
			if (!abilityEntry) continue;

			// Handle different ability entry formats
			if (typeof abilityEntry === 'object') {
				// Direct ability mapping: { str: 2, dex: 1 }
				const shortName = ability.substring(0, 3);
				if (abilityEntry[shortName]) {
					bonus += abilityEntry[shortName];
				}
			}
		}

		// Add bonuses from racial ability choices (e.g., Variant Human)
		const savedChoices = stagedData.race?.abilityChoices || [];
		for (const choice of savedChoices) {
			if (choice && choice.ability === ability) {
				bonus += choice.amount || 1;
			}
		}

		return bonus;
	}

	_formatModifier(modifier) {
		return formatModifierNumber(modifier);
	}

	async attachListeners() {

		const stagedData = this.session.getStagedData();
		const method = stagedData.abilityScoreMethod || 'pointBuy';

		// Attach listeners for ability choice dropdowns (for variant races)
		this._attachChoiceDropdownListeners();

		// Add method-specific controls
		await this._addMethodControls(method);
	}

	_attachChoiceDropdownListeners() {
		const dropdowns = document.querySelectorAll('[data-choice-index]');
		for (const dropdown of dropdowns) {
			this._cleanup.on(dropdown, 'change', (event) => {
				const choiceIndex = parseInt(event.target.dataset.choiceIndex, 10);
				const selectedAbility = event.target.value;

				const stagedData = this.session.getStagedData();
				if (!stagedData.race) {
					console.warn('[Step5AbilityScores]', 'No race selected');
					return;
				}

				// Initialize abilityChoices array if not present
				if (!stagedData.race.abilityChoices) {
					stagedData.race.abilityChoices = [];
				}

				// Ensure array is large enough
				while (stagedData.race.abilityChoices.length <= choiceIndex) {
					stagedData.race.abilityChoices.push(null);
				}

				// Update the choice
				if (selectedAbility) {
					stagedData.race.abilityChoices[choiceIndex] = {
						ability: selectedAbility,
						amount: this._abilityChoiceData.choices[choiceIndex]?.amount || 1,
					};
				} else {
					stagedData.race.abilityChoices[choiceIndex] = null;
				}

				// Re-render ability choices to update available options (exclude selected abilities)
				this._rerenderChoices();

				// Re-render ability scores to update bonuses
				this._rerenderAbilityScores();
			});
		}
	}

	_rerenderChoices() {
		const choicesContainer = document.querySelector('.racial-ability-choices');
		if (!choicesContainer) return;

		choicesContainer.outerHTML = this._renderAbilityChoices();

		// Re-attach listeners to the newly rendered dropdowns
		this._attachChoiceDropdownListeners();
	}

	_rerenderAbilityScores() {
		const abilities = CharacterStepAbilityScores.ABILITIES;

		// Update each ability score display
		for (const ability of abilities) {
			const box = document.querySelector(`[data-ability="${ability}"]`);
			if (!box) continue;

			const baseScore =
				this.session.getStagedData().abilityScores?.[ability] || 8;
			const racialBonus = this._getRacialBonus(ability);
			const totalScore = baseScore + racialBonus;
			const modifier = this._formatModifier(getAbilityModNumber(totalScore));

			// Update the score display
			const scoreDisplay = box.querySelector('.score');
			if (scoreDisplay) {
				scoreDisplay.textContent = totalScore;
			}

			// Update the modifier display
			const modifierDisplay = box.querySelector('.modifier');
			if (modifierDisplay) {
				modifierDisplay.textContent = modifier;
			}

			// Update the bonus display
			const bonusDisplay = box.querySelector('.bonus');
			if (bonusDisplay) {
				if (racialBonus !== 0) {
					bonusDisplay.classList.remove('u-hidden');
					bonusDisplay.textContent =
						racialBonus >= 0 ? `+${racialBonus}` : `${racialBonus}`;
					bonusDisplay.classList.toggle('negative', racialBonus < 0);
				} else {
					bonusDisplay.classList.add('u-hidden');
				}
			}
		}
	}

	async _addMethodControls(method) {
		const abilities = CharacterStepAbilityScores.ABILITIES;

		const stagedData = this.session.getStagedData();

		if (method === 'standardArray') {
			const allEights = abilities.every(
				(ability) => stagedData.abilityScores?.[ability] === 8,
			);
			if (allEights) {
				const standardValues = CharacterStepAbilityScores.STANDARD_ARRAY;
				stagedData.abilityScores.strength = standardValues[0];
				stagedData.abilityScores.dexterity = standardValues[1];
				stagedData.abilityScores.constitution = standardValues[2];
				stagedData.abilityScores.intelligence = standardValues[3];
				stagedData.abilityScores.wisdom = standardValues[4];
				stagedData.abilityScores.charisma = standardValues[5];
			}
		}

		for (const ability of abilities) {
			const controlsContainer = document.getElementById(`controls-${ability}`);
			if (!controlsContainer) continue;

			if (method === 'pointBuy') {
				this._addPointBuyControls(controlsContainer, ability);
			} else if (method === 'standardArray') {
				this._addStandardArrayControls(controlsContainer, ability);
			} else if (method === 'custom') {
				this._addCustomControls(controlsContainer, ability);
			}
		}

		// Refresh display after adding all controls to show correct initial values
		this._refreshDisplay();
	}

	_addPointBuyControls(container, ability) {
		const stagedData = this.session.getStagedData();
		const baseScore = stagedData.abilityScores?.[ability] || 8;

		const decreaseBtn = document.createElement('button');
		decreaseBtn.className = 'btn btn-sm btn-light me-1';
		decreaseBtn.textContent = '-';
		decreaseBtn.disabled = baseScore <= 8;

		const increaseBtn = document.createElement('button');
		increaseBtn.className = 'btn btn-sm btn-light';
		increaseBtn.textContent = '+';
		increaseBtn.disabled = baseScore >= 15;

		this._cleanup.on(decreaseBtn, 'click', () =>
			this._handlePointBuyDecrease(ability),
		);
		this._cleanup.on(increaseBtn, 'click', () =>
			this._handlePointBuyIncrease(ability),
		);

		container.appendChild(decreaseBtn);
		container.appendChild(increaseBtn);
	}

	_addStandardArrayControls(container, ability) {
		const stagedData = this.session.getStagedData();
		const baseScore = stagedData.abilityScores?.[ability] || 8;
		const standardValues = CharacterStepAbilityScores.STANDARD_ARRAY;

		const select = document.createElement('select');
		select.className = 'form-select form-select-sm';
		select.dataset.ability = ability;

		// Show ALL standard array values to allow swapping
		for (const value of standardValues) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = value;
			if (value === baseScore) {
				option.selected = true;
			}
			select.appendChild(option);
		}

		this._cleanup.on(select, 'change', (e) =>
			this._handleStandardArrayChange(ability, e.target.value),
		);

		container.appendChild(select);
	}

	_addCustomControls(container, ability) {
		const stagedData = this.session.getStagedData();
		const baseScore = stagedData.abilityScores?.[ability] || 8;

		const input = document.createElement('input');
		input.type = 'number';
		input.className = 'form-control form-control-sm';
		input.min = 3;
		input.max = 20;
		input.value = baseScore;

		this._cleanup.on(input, 'change', (e) =>
			this._handleCustomInput(ability, e.target.value),
		);

		container.appendChild(input);
	}

	_handlePointBuyIncrease(ability) {
		const stagedData = this.session.getStagedData();
		const currentScore = stagedData.abilityScores?.[ability] || 8;
		if (currentScore >= 15) return;

		const pointsUsed = this._calculatePointsUsed();
		const nextCost = getPointBuyCost(currentScore + 1);
		const currentCost = getPointBuyCost(currentScore);
		const costDifference = nextCost - currentCost;

		if (pointsUsed + costDifference > POINT_BUY_BUDGET) {
			console.warn('[Step5AbilityScores]', 'Not enough points remaining');
			return;
		}

		// Update staged data
		if (!stagedData.abilityScores) {
			stagedData.abilityScores = {
				strength: 8,
				dexterity: 8,
				constitution: 8,
				intelligence: 8,
				wisdom: 8,
				charisma: 8,
			};
		}
		stagedData.abilityScores[ability] = currentScore + 1;
		this._refreshDisplay();
	}

	_handlePointBuyDecrease(ability) {
		const stagedData = this.session.getStagedData();
		const currentScore = stagedData.abilityScores?.[ability] || 8;
		if (currentScore <= 8) return;

		// Update staged data
		if (!stagedData.abilityScores) {
			stagedData.abilityScores = {
				strength: 8,
				dexterity: 8,
				constitution: 8,
				intelligence: 8,
				wisdom: 8,
				charisma: 8,
			};
		}
		stagedData.abilityScores[ability] = currentScore - 1;
		this._refreshDisplay();
	}

	_handleStandardArrayChange(ability, newValue) {
		const value = Number.parseInt(newValue, 10);
		if (Number.isNaN(value)) return;

		const stagedData = this.session.getStagedData();
		if (!stagedData.abilityScores) {
			stagedData.abilityScores = {
				strength: 8,
				dexterity: 8,
				constitution: 8,
				intelligence: 8,
				wisdom: 8,
				charisma: 8,
			};
		}

		const abilities = CharacterStepAbilityScores.ABILITIES;

		// Get the current score for the ability being changed
		const currentAbilityScore = stagedData.abilityScores[ability];

		// Find if the new value is already assigned to another ability
		let otherAbility = null;
		for (const checkAbility of abilities) {
			if (checkAbility === ability) continue;
			if (stagedData.abilityScores[checkAbility] === value) {
				otherAbility = checkAbility;
				break;
			}
		}

		// If value is already assigned to another ability, swap them
		if (otherAbility) {
			stagedData.abilityScores[otherAbility] = currentAbilityScore;
		}

		// Update the current ability score with the new value
		stagedData.abilityScores[ability] = value;

		// Refresh all standard array dropdowns to reflect new availability
		this._refreshStandardArrayDropdowns();

		// Refresh the display to show updated scores
		this._refreshDisplay();
	}

	_refreshStandardArrayDropdowns() {
		const stagedData = this.session.getStagedData();
		const abilities = CharacterStepAbilityScores.ABILITIES;

		// Update each dropdown to reflect current value
		for (const ability of abilities) {
			const controlsContainer = document.getElementById(`controls-${ability}`);
			if (!controlsContainer) continue;

			const select = controlsContainer.querySelector('select');
			if (!select) continue;

			const currentValue = stagedData.abilityScores?.[ability] || 8;
			select.value = currentValue;
		}
	}

	_handleCustomInput(ability, newValue) {
		const value = Number.parseInt(newValue, 10);
		if (Number.isNaN(value)) return;

		const stagedData = this.session.getStagedData();
		if (!stagedData.abilityScores) {
			stagedData.abilityScores = {
				strength: 8,
				dexterity: 8,
				constitution: 8,
				intelligence: 8,
				wisdom: 8,
				charisma: 8,
			};
		}

		const clampedValue = Math.max(3, Math.min(20, value));
		stagedData.abilityScores[ability] = clampedValue;
		this._refreshDisplay();
	}

	async _refreshDisplay() {
		const stagedData = this.session.getStagedData();
		const abilities = CharacterStepAbilityScores.ABILITIES;

		// Update each ability box
		for (const ability of abilities) {
			const box = document.querySelector(
				`.ability-score-box[data-ability="${ability}"]`,
			);
			if (!box) continue;

			const baseScore = stagedData.abilityScores?.[ability] || 8;
			const racialBonus = this._getRacialBonus(ability);
			const totalScore = baseScore + racialBonus;
			const modifier = this._formatModifier(getAbilityModNumber(totalScore));

			// Update displayed values
			const scoreEl = box.querySelector('.score');
			const modifierEl = box.querySelector('.modifier');
			if (scoreEl) scoreEl.textContent = totalScore;
			if (modifierEl) modifierEl.textContent = modifier;

			// Update button states for point buy
			const method = stagedData.abilityScoreMethod || 'pointBuy';
			if (method === 'pointBuy') {
				const controls = box.querySelector('.ability-controls');
				if (controls) {
					const decreaseBtn = controls.querySelector('button:first-child');
					const increaseBtn = controls.querySelector('button:last-child');
					if (decreaseBtn) decreaseBtn.disabled = baseScore <= 8;
					if (increaseBtn) increaseBtn.disabled = baseScore >= 15;
				}
			}
		}

		// Update point buy info if visible
		const pointsDisplay = document.querySelector(
			'.points-remaining-display-header',
		);
		if (pointsDisplay) {
			const pointsUsed = this._calculatePointsUsed();
			const pointsRemaining = POINT_BUY_BUDGET - pointsUsed;
			pointsDisplay.innerHTML = `<strong>Points Remaining:</strong> ${pointsRemaining}`;
		}
	}

	async validate() {
		const stagedData = this.session.getStagedData();
		const method = stagedData.abilityScoreMethod || 'pointBuy';

		if (method === 'pointBuy') {
			const pointsUsed = this._calculatePointsUsed();
			if (pointsUsed > POINT_BUY_BUDGET) {
				console.warn('[Step5AbilityScores]', 'Too many points used');
				return false;
			}
		}

		if (method === 'standardArray') {
			const abilities = CharacterStepAbilityScores.ABILITIES;
			const stagedData = this.session.getStagedData();
			const assignedValues = abilities.map(
				(a) => stagedData.abilityScores?.[a] || 8,
			);
			const standardValues = CharacterStepAbilityScores.STANDARD_ARRAY;

			// Check if all standard values are used
			const sortedAssigned = [...assignedValues].sort((a, b) => b - a);
			const sortedStandard = [...standardValues].sort((a, b) => b - a);

			if (JSON.stringify(sortedAssigned) !== JSON.stringify(sortedStandard)) {
				console.warn(
					'[Step5AbilityScores]',
					'Not all standard array values assigned',
					{ assignedValues, sortedAssigned, sortedStandard },
				);
				return false;
			}
		}

		return true;
	}

	async save() {
		// No action needed - scores are saved in session
	}

	destroy() {
		this._cleanup.cleanup();
	}
}
