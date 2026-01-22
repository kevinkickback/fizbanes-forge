// Step 5: Ability Scores - score assignment based on method from step 1

import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { getRaceAbilityData } from '../../../services/AbilityScoreService.js';
import { raceService } from '../../../services/RaceService.js';

export class CharacterStepAbilityScores {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
        this._abilityChoiceData = null; // Store choice data for dropdowns
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
                    <div class="card-header">
                        <i class="fas fa-star"></i> Ability Scores
                    </div>
                    <div class="card-body">
                        ${method === 'pointBuy' ? this._renderPointBuyInfo() : ''}
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

    /**
     * Render ability score boxes.
     * @private
     */
    _renderAbilityScoreBoxes() {
        const abilities = [
            'strength',
            'dexterity',
            'constitution',
            'intelligence',
            'wisdom',
            'charisma',
        ];
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
                const modifier = this._formatModifier(
                    Math.floor((totalScore - 10) / 2),
                );

                return `
                <div class="ability-score-box" data-ability="${ability}">
                    <h6>${ability.toUpperCase()}</h6>
                    <div class="score">${totalScore}</div>
                    <div class="modifier">${modifier}</div>
                    ${racialBonus !== 0 ? `<div class="bonus ${racialBonus < 0 ? 'negative' : ''}" style="display: block;">${racialBonus >= 0 ? '+' : ''}${racialBonus}</div>` : '<div class="bonus" style="display: none;"></div>'}
                    <div class="ability-controls mt-2" id="controls-${ability}">
                        <!-- Controls will be added dynamically -->
                    </div>
                </div>
            `;
            })
            .join('');
    }

    /**
     * Render ability choice dropdowns.
     * @private
     */
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

            for (let i = 0; i < count; i++) {
                const savedChoice = savedChoices[choiceIndex];
                const selectedAbility = savedChoice?.ability || '';

                // Filter available options: exclude abilities selected in other dropdowns
                // but always include the currently selected ability for this dropdown
                const availableAbilities = choice.from.filter(
                    (ability) => ability === selectedAbility || !selectedAbilities.has(ability),
                );

                dropdownsHTML += `
                    <div class="ability-choice-dropdown flex-grow-1">
                        <label class="form-label">Racial Bonus ${i + 1}:</label>
                        <select class="form-select form-select-sm" data-choice-index="${choiceIndex}">
                            <option value="">Choose...</option>
                            ${availableAbilities
                        .map(
                            (ability) => `
                                <option value="${ability}" ${selectedAbility === ability ? 'selected' : ''}>
                                    +${amount} to ${ability.charAt(0).toUpperCase() + ability.slice(1)}
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
            <div class="racial-ability-choices mt-3 pt-3 border-top">
                <div class="d-flex gap-2 justify-content-center">
                    ${dropdownsHTML}
                </div>
            </div>
        `;
    }

    /**
     * Render point buy info section.
     * @private
     */
    _renderPointBuyInfo() {
        const pointsUsed = this._calculatePointsUsed();
        const pointsRemaining = 27 - pointsUsed;

        return `
            <div class="mb-3 d-flex justify-content-end">
                <div class="points-remaining-display px-3 py-2 rounded">
                    <strong>Points Remaining:</strong> ${pointsRemaining}
                </div>
            </div>
        `;
    }

    /**
     * Calculate points used in point buy.
     * @private
     */
    _calculatePointsUsed() {
        const pointCosts = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
        const abilities = [
            'strength',
            'dexterity',
            'constitution',
            'intelligence',
            'wisdom',
            'charisma',
        ];
        const stagedData = this.session.getStagedData();

        let total = 0;
        for (const ability of abilities) {
            const score = stagedData.abilityScores?.[ability] || 8;
            total += pointCosts[score] || 0;
        }

        return total;
    }

    /**
     * Get racial bonus for an ability.
     * @private
     */
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

    /**
     * Format modifier with sign.
     * @private
     */
    _formatModifier(modifier) {
        if (modifier >= 0) {
            return `+${modifier}`;
        }
        return `${modifier}`;
    }

    /**
     * Get method display name.
     * @private
     */
    _getMethodDisplayName(method) {
        const names = {
            pointBuy: 'Point Buy',
            standardArray: 'Standard Array',
            rolled: 'Rolled',
            custom: 'Custom',
        };
        return names[method] || 'Point Buy';
    }

    /**
     * Get method description.
     * @private
     */
    _getMethodDescription(method) {
        const descriptions = {
            pointBuy:
                ' - Assign ability scores using a pool of 27 points (8-15 range).',
            standardArray:
                ' - Assign these values to your abilities: 15, 14, 13, 12, 10, 8.',
            rolled: ' - You have rolled for your ability scores.',
            custom: ' - Enter your ability scores manually.',
        };
        return descriptions[method] || '';
    }

    /**
     * Attach event listeners after render.
     */
    async attachListeners() {
        console.debug('[Step5AbilityScores]', 'Attaching listeners');

        const stagedData = this.session.getStagedData();
        const method = stagedData.abilityScoreMethod || 'pointBuy';

        // Attach listeners for ability choice dropdowns (for variant races)
        this._attachChoiceDropdownListeners();

        // Add method-specific controls
        await this._addMethodControls(method);
    }

    /**
     * Attach listeners to ability choice dropdowns.
     * @private
     */
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

    /**
     * Re-render ability choice dropdowns to update available options.
     * @private
     */
    _rerenderChoices() {
        const choicesContainer = document.querySelector('.racial-ability-choices');
        if (!choicesContainer) return;

        choicesContainer.outerHTML = this._renderAbilityChoices();

        // Re-attach listeners to the newly rendered dropdowns
        this._attachChoiceDropdownListeners();
    }

    /**
     * Re-render ability scores after a choice changes.
     * @private
     */
    _rerenderAbilityScores() {
        const abilities = [
            'strength',
            'dexterity',
            'constitution',
            'intelligence',
            'wisdom',
            'charisma',
        ];

        // Update each ability score display
        for (const ability of abilities) {
            const box = document.querySelector(`[data-ability="${ability}"]`);
            if (!box) continue;

            const baseScore = this.session.getStagedData().abilityScores?.[ability] || 8;
            const racialBonus = this._getRacialBonus(ability);
            const totalScore = baseScore + racialBonus;
            const modifier = this._formatModifier(Math.floor((totalScore - 10) / 2));

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
                    bonusDisplay.style.display = 'block';
                    bonusDisplay.textContent = racialBonus >= 0 ? `+${racialBonus}` : `${racialBonus}`;
                    bonusDisplay.classList.toggle('negative', racialBonus < 0);
                } else {
                    bonusDisplay.style.display = 'none';
                }
            }
        }
    }

    /**
     * Add method-specific controls to ability boxes.
     * @private
     */
    async _addMethodControls(method) {
        const abilities = [
            'strength',
            'dexterity',
            'constitution',
            'intelligence',
            'wisdom',
            'charisma',
        ];

        const stagedData = this.session.getStagedData();

        // Initialize standard array values if method is standardArray and all values are at default
        if (method === 'standardArray') {
            const allEights = abilities.every(ability => stagedData.abilityScores?.[ability] === 8);
            if (allEights) {
                const standardValues = [15, 14, 13, 12, 10, 8];
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

    /**
     * Add point buy controls.
     * @private
     */
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

    /**
     * Add standard array controls.
     * @private
     */
    _addStandardArrayControls(container, ability) {
        const stagedData = this.session.getStagedData();
        const baseScore = stagedData.abilityScores?.[ability] || 8;
        const standardValues = [15, 14, 13, 12, 10, 8];

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

    /**
     * Add custom input controls.
     * @private
     */
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

    /**
     * Handle point buy increase.
     * @private
     */
    _handlePointBuyIncrease(ability) {
        const stagedData = this.session.getStagedData();
        const currentScore = stagedData.abilityScores?.[ability] || 8;
        if (currentScore >= 15) return;

        const pointsUsed = this._calculatePointsUsed();
        const pointCosts = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
        const nextCost = pointCosts[currentScore + 1] || 0;
        const currentCost = pointCosts[currentScore] || 0;
        const costDifference = nextCost - currentCost;

        if (pointsUsed + costDifference > 27) {
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

    /**
     * Handle point buy decrease.
     * @private
     */
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

    /**
     * Handle standard array change.
     * @private
     */
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

        const abilities = [
            'strength',
            'dexterity',
            'constitution',
            'intelligence',
            'wisdom',
            'charisma',
        ];

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

    /**
     * Refresh all standard array dropdowns to show correct available values.
     * @private
     */
    _refreshStandardArrayDropdowns() {
        const stagedData = this.session.getStagedData();
        const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

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

    /**
     * Handle custom input.
     * @private
     */
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

    /**
     * Refresh the display after score changes.
     * @private
     */
    async _refreshDisplay() {
        const stagedData = this.session.getStagedData();
        const abilities = [
            'strength',
            'dexterity',
            'constitution',
            'intelligence',
            'wisdom',
            'charisma',
        ];

        // Update each ability box
        for (const ability of abilities) {
            const box = document.querySelector(
                `.ability-score-box[data-ability="${ability}"]`,
            );
            if (!box) continue;

            const baseScore = stagedData.abilityScores?.[ability] || 8;
            const racialBonus = this._getRacialBonus(ability);
            const totalScore = baseScore + racialBonus;
            const modifier = this._formatModifier(Math.floor((totalScore - 10) / 2));

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
        const pointsDisplay = document.querySelector('.points-remaining-display');
        if (pointsDisplay) {
            const pointsUsed = this._calculatePointsUsed();
            const pointsRemaining = 27 - pointsUsed;
            pointsDisplay.innerHTML = `<strong>Points Remaining:</strong> ${pointsRemaining}`;
        }
    }

    /**
     * Validate step before proceeding.
     */
    async validate() {
        const stagedData = this.session.getStagedData();
        const method = stagedData.abilityScoreMethod || 'pointBuy';

        // For point buy, check if all points are used
        if (method === 'pointBuy') {
            const pointsUsed = this._calculatePointsUsed();
            if (pointsUsed > 27) {
                console.warn('[Step5AbilityScores]', 'Too many points used');
                return false;
            }
        }

        // For standard array, check if all values are assigned
        if (method === 'standardArray') {
            const abilities = [
                'strength',
                'dexterity',
                'constitution',
                'intelligence',
                'wisdom',
                'charisma',
            ];
            const stagedData = this.session.getStagedData();
            const assignedValues = abilities.map((a) => stagedData.abilityScores?.[a] || 8);
            const standardValues = [15, 14, 13, 12, 10, 8];

            // Check if all standard values are used
            const sortedAssigned = [...assignedValues].sort((a, b) => b - a);
            const sortedStandard = [...standardValues].sort((a, b) => b - a);

            if (JSON.stringify(sortedAssigned) !== JSON.stringify(sortedStandard)) {
                console.warn(
                    '[Step5AbilityScores]',
                    'Not all standard array values assigned',
                    { assignedValues, sortedAssigned, sortedStandard }
                );
                return false;
            }
        }

        return true;
    }

    /**
     * Save step data to session.
     */
    async save() {
        // Ability scores are managed by abilityScoreService and automatically
        // saved to the character, so nothing to do here
        console.debug('[Step5AbilityScores]', 'Ability scores saved');
    }

    /**
     * Cleanup when step is destroyed.
     */
    destroy() {
        this._cleanup.cleanup();
    }
}
