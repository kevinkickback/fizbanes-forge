/**
 * Step 5: Ability Scores
 * 
 * User assigns ability scores based on the method chosen in Step 1 (Rules).
 * Displays ability score boxes with bonuses from race and shows the method being used.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { abilityScoreService } from '../../../../services/AbilityScoreService.js';

export class Step5AbilityScores {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
    }

    /**
     * Render the step HTML.
     */
    async render() {
        const stagedData = this.session.getStagedData();
        const method = stagedData.abilityScoreMethod || 'pointBuy';

        return `
            <div class="step-5-ability-scores">
                <div class="card">
                    <div class="card-header">
                        <i class="fas fa-star"></i> Ability Scores
                    </div>
                    <div class="card-body">
                        <div class="ability-score-container">
                            <div class="ability-score-grid">
                                ${this._renderAbilityScoreBoxes()}
                            </div>
                        </div>
                        
                        ${method === 'pointBuy' ? this._renderPointBuyInfo() : ''}
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
        const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        const stagedData = this.session.getStagedData();

        // Initialize ability scores in staged data if not present
        if (!stagedData.abilityScores) {
            stagedData.abilityScores = {
                strength: 8, dexterity: 8, constitution: 8,
                intelligence: 8, wisdom: 8, charisma: 8
            };
        }

        return abilities.map(ability => {
            const baseScore = stagedData.abilityScores[ability] || 8;
            const racialBonus = this._getRacialBonus(ability);
            const totalScore = baseScore + racialBonus;
            const modifier = this._formatModifier(Math.floor((totalScore - 10) / 2));

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
        }).join('');
    }

    /**
     * Render point buy info section.
     * @private
     */
    _renderPointBuyInfo() {
        const pointsUsed = this._calculatePointsUsed();
        const pointsRemaining = 27 - pointsUsed;

        return `
            <div class="mt-3 p-3 bg-primary bg-opacity-10 border border-primary rounded">
                <div class="d-flex justify-content-between align-items-center">
                    <span><strong>Points Used:</strong></span>
                    <span class="badge bg-${pointsRemaining >= 0 ? 'primary' : 'danger'}">${pointsUsed} / 27</span>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <span><strong>Points Remaining:</strong></span>
                    <span class="badge bg-${pointsRemaining >= 0 ? 'success' : 'danger'}">${pointsRemaining}</span>
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
        const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
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

        if (!raceName) return 0;

        // Import race service and get race data
        // For now, return simple mapping - this should use raceService in production
        // Common racial bonuses (simplified)
        const raceBonuses = {
            'Dwarf': { constitution: 2 },
            'Elf': { dexterity: 2 },
            'Halfling': { dexterity: 2 },
            'Human': { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
            'Dragonborn': { strength: 2, charisma: 1 },
            'Gnome': { intelligence: 2 },
            'Half-Elf': { charisma: 2 },
            'Half-Orc': { strength: 2, constitution: 1 },
            'Tiefling': { charisma: 2, intelligence: 1 }
        };

        const bonuses = raceBonuses[raceName] || {};
        return bonuses[ability] || 0;
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
            custom: 'Custom'
        };
        return names[method] || 'Point Buy';
    }

    /**
     * Get method description.
     * @private
     */
    _getMethodDescription(method) {
        const descriptions = {
            pointBuy: ' - Assign ability scores using a pool of 27 points (8-15 range).',
            standardArray: ' - Assign these values to your abilities: 15, 14, 13, 12, 10, 8.',
            rolled: ' - You have rolled for your ability scores.',
            custom: ' - Enter your ability scores manually.'
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

        // Add method-specific controls
        await this._addMethodControls(method);
    }

    /**
     * Add method-specific controls to ability boxes.
     * @private
     */
    async _addMethodControls(method) {
        const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

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

        this._cleanup.on(decreaseBtn, 'click', () => this._handlePointBuyDecrease(ability));
        this._cleanup.on(increaseBtn, 'click', () => this._handlePointBuyIncrease(ability));

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

        // Add options
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select...';
        select.appendChild(placeholder);

        for (const value of standardValues) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            if (value === baseScore) {
                option.selected = true;
            }
            select.appendChild(option);
        }

        this._cleanup.on(select, 'change', (e) => this._handleStandardArrayChange(ability, e.target.value));

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

        this._cleanup.on(input, 'change', (e) => this._handleCustomInput(ability, e.target.value));

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
                strength: 8, dexterity: 8, constitution: 8,
                intelligence: 8, wisdom: 8, charisma: 8
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
                strength: 8, dexterity: 8, constitution: 8,
                intelligence: 8, wisdom: 8, charisma: 8
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
                strength: 8, dexterity: 8, constitution: 8,
                intelligence: 8, wisdom: 8, charisma: 8
            };
        }

        // Check if this value is already assigned
        const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        const currentScore = stagedData.abilityScores[ability];

        for (const checkAbility of abilities) {
            if (checkAbility === ability) continue;
            if (stagedData.abilityScores[checkAbility] === value) {
                // Swap values
                stagedData.abilityScores[checkAbility] = currentScore;
                break;
            }
        }

        stagedData.abilityScores[ability] = value;
        this._refreshDisplay();
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
                strength: 8, dexterity: 8, constitution: 8,
                intelligence: 8, wisdom: 8, charisma: 8
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
        const contentArea = document.querySelector('[data-step-content]');
        if (!contentArea) return;

        // Re-render the entire step
        const html = await this.render();
        contentArea.innerHTML = html;

        // Re-attach listeners
        await this.attachListeners(contentArea);
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
            const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
            const assignedValues = abilities.map(a => abilityScoreService.getBaseScore(a));
            const standardValues = [15, 14, 13, 12, 10, 8];

            // Check if all standard values are used
            const sortedAssigned = [...assignedValues].sort((a, b) => b - a);
            const sortedStandard = [...standardValues].sort((a, b) => b - a);

            if (JSON.stringify(sortedAssigned) !== JSON.stringify(sortedStandard)) {
                console.warn('[Step5AbilityScores]', 'Not all standard array values assigned');
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
