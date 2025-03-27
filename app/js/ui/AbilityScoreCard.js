/**
 * AbilityScoreCard.js
 * Handles UI updates for ability scores, including rendering ability score boxes,
 * managing ability choice dropdowns, and displaying bonus notes.
 * 
 * @typedef {Object} AbilityChoice
 * @property {string} source - Source of the ability choice (e.g., "Race", "Background")
 * @property {number} amount - Amount of the bonus to apply
 * @property {boolean} [isChoice] - Whether this is a choice-based bonus
 * 
 * @typedef {Object} BonusGroup
 * @property {string} ability - The ability name
 * @property {number} value - The bonus value
 * @property {string} source - Source of the bonus
 * @property {boolean} [isChoice] - Whether this is a choice-based bonus
 * 
 * @typedef {Object} AbilityScoreBox
 * @property {HTMLElement} score - Element displaying the ability score
 * @property {HTMLElement} modifier - Element displaying the ability modifier
 * @property {HTMLElement} bonus - Element displaying any bonus
 */

import { abilityScoreManager } from '../managers/AbilityScoreManager.js';
import { characterHandler } from '../utils/characterHandler.js';
import { textProcessor } from '../utils/TextProcessor.js';

export class AbilityScoreCard {
    /**
     * Creates a new AbilityScoreCard instance
     * @constructor
     */
    constructor() {
        this.container = document.querySelector('.ability-score-container');
        this.bonusesContainer = document.getElementById('abilityBonusesNotes');
        this.abilityScoresChangedListener = () => this.render();
        this.initialize();
    }

    /**
     * Initializes the ability score card by rendering content and setting up event listeners
     */
    initialize() {
        console.log('[AbilityScoreCard] Initializing');

        // Add the custom CSS for the new UI elements
        this.addStyles();

        // Force synchronization of the ability score manager with the current character first
        const character = characterHandler.currentCharacter;
        if (character) {
            // Force the abilityScoreManager to sync with current character method
            if (character.variantRules?.abilityScoreMethod === 'standardArray') {
                abilityScoreManager.updateAssignedStandardArrayValues();
            } else if (character.variantRules?.abilityScoreMethod === 'pointBuy') {
                abilityScoreManager.calculateUsedPoints();
            }
        }

        this.render();
        this.setupEventListeners();
    }

    /**
     * Renders the entire ability score card, including scores, choices, and bonus notes
     */
    render() {
        console.log('[AbilityScoreCard] Rendering ability score card');

        if (!this.container) {
            console.log('[AbilityScoreCard] Container not found, skipping render');
            return;
        }

        // Initialize scoring method system if needed
        this._initializeAbilityScoreMethod();

        // Render point buy info or standard array selection if needed
        this._renderAbilityScoreMethodInfo();

        this._renderAbilityScores();
        this._renderAbilityChoices();
        this._renderBonusNotes();
    }

    /**
     * Initialize ability scores based on the selected method when a character is first loaded
     * @private
     */
    _initializeAbilityScoreMethod() {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        // Log the current ability score method for debugging
        console.log('[AbilityScoreCard] Character variant rules:', character.variantRules);
        console.log('[AbilityScoreCard] Current ability score method:', character.variantRules?.abilityScoreMethod);

        // Only reset ability score method when actually needed (e.g., on first load)
        // This prevents constant resets that trigger abilityScoresChanged events
        if (!this.initializedMethod || this.lastInitializedMethod !== character.variantRules?.abilityScoreMethod) {
            this.lastInitializedMethod = character.variantRules?.abilityScoreMethod;
            this.initializedMethod = true;
            abilityScoreManager.resetAbilityScoreMethod();
        }
    }

    /**
     * Renders the ability score method information (Point Buy tracking or Standard Array options)
     * @private
     */
    _renderAbilityScoreMethodInfo() {
        // Remove existing info container if it exists
        let infoContainer = this.container.querySelector('.ability-score-method-info');
        if (infoContainer) {
            infoContainer.remove();
        }

        // Get the character and method directly
        const character = characterHandler.currentCharacter;
        if (!character) {
            console.log('[AbilityScoreCard] No character found for method info');
            return;
        }

        // Always use the method directly from character.variantRules
        const methodFromCharacter = character.variantRules?.abilityScoreMethod || 'custom';
        const isPointBuy = methodFromCharacter === 'pointBuy';
        const isStandardArray = methodFromCharacter === 'standardArray';

        console.log('[AbilityScoreCard] Rendering method info:', {
            isPointBuy,
            isStandardArray,
            method: methodFromCharacter
        });

        // Create a new container
        infoContainer = document.createElement('div');
        infoContainer.className = 'ability-score-method-info mb-3';

        // Populate based on current method
        if (isPointBuy) {
            const usedPoints = abilityScoreManager.calculateUsedPoints();
            const remainingPoints = abilityScoreManager.getRemainingPoints();
            const maxPoints = abilityScoreManager.maxPoints;

            console.log('[AbilityScoreCard] Point Buy:', { usedPoints, remainingPoints, maxPoints });

            infoContainer.innerHTML = `
                <div class="d-flex justify-content-end mb-2">
                    <div class="point-buy-badge">
                        <span class="label">Point Buy</span>${usedPoints}/${maxPoints} 
                        (<strong>${remainingPoints}</strong> remaining)
                    </div>
                </div>
            `;
        } else if (isStandardArray) {
            // Get the available values
            const availableValues = abilityScoreManager.getAvailableStandardArrayValues();
            const assignedValues = Array.from(abilityScoreManager.assignedStandardValues);

            console.log('[AbilityScoreCard] Standard Array:', {
                availableValues,
                assignedValues
            });

            infoContainer.innerHTML = `
                <div class="card">
                    <div class="card-header py-2">
                        <h6 class="mb-0">Standard Array (15, 14, 13, 12, 10, 8)</h6>
                    </div>
                    <div>
                        <div class="alert alert-info mb-2 py-1 small">
                            Select which ability gets which value from the dropdown menus below each ability score.
                        </div>
                    </div>
                </div>
            `;
        }

        // Add the container only if we have content
        if (infoContainer.innerHTML.trim()) {
            this.container.prepend(infoContainer);
        }
    }

    /**
     * Renders the ability score boxes with their current values and modifiers
     * @private
     */
    _renderAbilityScores() {
        console.log('[AbilityScoreCard] Rendering ability scores');

        // Get the ability score method directly from character
        const character = characterHandler.currentCharacter;
        if (!character) {
            console.log('[AbilityScoreCard] No character found, using default rendering');
            return;
        }

        // Always get the method directly from character.variantRules to ensure consistency
        const methodFromCharacter = character.variantRules?.abilityScoreMethod || 'custom';
        console.log('[AbilityScoreCard] Method from character:', methodFromCharacter);

        const isStandardArray = methodFromCharacter === 'standardArray';
        const isPointBuy = methodFromCharacter === 'pointBuy';

        console.log('[AbilityScoreCard] Using methods:', { isStandardArray, isPointBuy });

        // Process each ability score
        for (const ability of abilityScoreManager.getAllAbilities()) {
            const box = this.container.querySelector(`[data-ability="${ability}"]`);
            if (!box) {
                console.log(`[AbilityScoreCard] Box for ${ability} not found, skipping`);
                continue;
            }

            const baseScore = abilityScoreManager.getBaseScore(ability);
            const totalScore = abilityScoreManager.getTotalScore(ability);

            console.log(`[AbilityScoreCard] Updating ${ability}: base=${baseScore}, total=${totalScore}, method=${methodFromCharacter}`);

            // Update score and modifier displays
            box.querySelector('.score').textContent = totalScore;
            box.querySelector('.modifier').textContent = abilityScoreManager.getModifier(totalScore);

            // Update bonus display
            const bonusDiv = box.querySelector('.bonus');
            bonusDiv.innerHTML = this.renderBonus(ability);

            // Remove any existing original buttons that were in HTML
            const existingButtonsContainer = box.querySelector('.ability-controls, .mt-2');
            if (existingButtonsContainer) {
                existingButtonsContainer.remove();
            }

            // Create new controls container
            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'ability-controls mt-2';
            box.appendChild(controlsContainer);

            // Add appropriate controls based on the ability score method
            if (isStandardArray) {
                console.log(`[AbilityScoreCard] Adding standard array dropdown for ${ability}`);

                // Update the standard array tracking before rendering
                abilityScoreManager.updateAssignedStandardArrayValues();

                // For Standard Array, show a dropdown selector
                const allStandardArrayValues = [...abilityScoreManager.standardArray];

                // Sort values in descending order
                allStandardArrayValues.sort((a, b) => b - a);

                console.log(`[AbilityScoreCard] Standard Array dropdown for ${ability}:`, {
                    baseScore,
                    allValues: allStandardArrayValues,
                    assignedValues: Array.from(abilityScoreManager.assignedStandardValues)
                });

                // Create the dropdown
                const select = document.createElement('select');
                select.className = 'form-select form-select-sm standard-array-select text-center';
                select.dataset.ability = ability;

                // Add value options directly - show all standard array values
                for (const value of allStandardArrayValues) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = `${value}`;
                    option.selected = (baseScore === value);

                    select.appendChild(option);
                }

                // Add the dropdown to the controls container
                controlsContainer.appendChild(select);

                // Add event listener for selection changes
                select.addEventListener('change', (e) => {
                    const newValue = Number.parseInt(e.target.value, 10);
                    if (!Number.isNaN(newValue)) {
                        console.log(`[AbilityScoreCard] Standard Array selection changed for ${ability}: ${newValue}`);
                        abilityScoreManager.updateBaseScore(ability, newValue);
                    }
                });

                // Remove any cost indicators that might exist
                const standardArrayCostIndicators = box.querySelectorAll('.point-cost');
                for (const indicator of standardArrayCostIndicators) {
                    indicator.remove();
                }
            } else {
                // For Point Buy or Custom methods, add +/- buttons
                console.log(`[AbilityScoreCard] Adding +/- buttons for ${ability}`);

                // Create decrease button
                const decreaseBtn = document.createElement('button');
                decreaseBtn.className = 'btn btn-sm btn-light me-1';
                decreaseBtn.dataset.action = 'decrease';
                decreaseBtn.dataset.ability = ability;
                decreaseBtn.textContent = '-';
                controlsContainer.appendChild(decreaseBtn);

                // Create increase button
                const increaseBtn = document.createElement('button');
                increaseBtn.className = 'btn btn-sm btn-light';
                increaseBtn.dataset.action = 'increase';
                increaseBtn.dataset.ability = ability;
                increaseBtn.textContent = '+';
                controlsContainer.appendChild(increaseBtn);

                // Remove any existing cost indicators first
                const existingCostIndicators = box.querySelectorAll('.point-cost');
                for (const indicator of existingCostIndicators) {
                    indicator.remove();
                }

                // For point buy, add the cost indicator
                if (isPointBuy) {
                    // Log available costs
                    console.log('[AbilityScoreCard] PointBuyCosts map:',
                        Array.from(abilityScoreManager.pointBuyCosts.entries()));

                    const cost = abilityScoreManager.getPointCost(baseScore);
                    console.log(`[AbilityScoreCard] Point cost for ${ability} (score ${baseScore}): ${cost}`);

                    // Determine cost level for styling
                    let costClass = 'low';
                    if (cost >= 7) {
                        costClass = 'high';
                    } else if (cost >= 4) {
                        costClass = 'medium';
                    }

                    // Add cost indicator to controls container instead of box
                    const costIndicator = document.createElement('div');
                    costIndicator.className = `point-cost ${costClass}`;
                    costIndicator.textContent = `${cost} pts`;
                    controlsContainer.appendChild(costIndicator);
                }
            }
        }
    }

    /**
     * Renders the ability choice dropdowns for pending ability score choices
     * @private
     */
    _renderAbilityChoices() {
        const pendingChoices = abilityScoreManager.getPendingChoices();
        console.log('[AbilityScoreCard] Pending ability choices:', pendingChoices);

        if (pendingChoices.length === 0) {
            this._removeChoicesContainer();
            return;
        }

        const choicesContainer = this._getOrCreateChoicesContainer();
        choicesContainer.innerHTML = this._createAbilityChoicesContent(pendingChoices);
        this._setupChoiceEventListeners(choicesContainer);
    }

    /**
     * Creates the HTML content for ability choice dropdowns
     * @param {Array<AbilityChoice>} pendingChoices - Array of pending ability choices
     * @returns {string} HTML content for the choices
     * @private
     */
    _createAbilityChoicesContent(pendingChoices) {
        return `
            <div class="ability-choices-grid">
                ${pendingChoices.map((choice, index) => this._createChoiceDropdown(choice, index)).join('')}
            </div>
        `;
    }

    /**
     * Creates a single ability choice dropdown
     * @param {AbilityChoice} choice - The ability choice object
     * @param {number} index - The index of the choice
     * @returns {string} HTML content for the dropdown
     * @private
     */
    _createChoiceDropdown(choice, index) {
        const availableAbilities = abilityScoreManager.getAvailableAbilities(index);
        const selectedAbility = abilityScoreManager.abilityChoices.get(index);

        console.log(`[AbilityScoreCard] Creating dropdown for choice ${index}:`, {
            source: choice.source,
            amount: choice.amount,
            availableAbilities,
            selectedAbility
        });

        return `
            <div class="ability-choice-group">
                <label class="form-label">+${choice.amount} bonus (${choice.source.replace(/\s+\d+$/, '')})</label>
                <select class="form-select form-select-sm ability-choice-select" 
                    data-choice-index="${index}" 
                    data-bonus="${choice.amount}" 
                    data-source="${choice.source}">
                    <option value="">Choose...</option>
                    ${availableAbilities.map(ability => `
                        <option value="${ability}" ${selectedAbility === ability ? 'selected' : ''}>
                            ${this._getAbilityAbbreviation(ability)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    /**
     * Gets or creates the choices container element
     * @returns {HTMLElement} The choices container element
     * @private
     */
    _getOrCreateChoicesContainer() {
        let container = this.container.querySelector('.ability-choices-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'ability-choices-container';
            this.container.appendChild(container);
        }
        return container;
    }

    /**
     * Removes the choices container if it exists
     * @private
     */
    _removeChoicesContainer() {
        const container = this.container.querySelector('.ability-choices-container');
        if (container) {
            container.remove();
        }
    }

    /**
     * Sets up event listeners for ability choice dropdowns
     * @param {HTMLElement} container - The container with the dropdowns
     * @private
     */
    _setupChoiceEventListeners(container) {
        const dropdowns = container.querySelectorAll('.ability-choice-select');
        for (const dropdown of dropdowns) {
            dropdown.addEventListener('change', (e) => this.handleAbilityChoice(e));
        }
    }

    /**
     * Renders the bonus notes section that explains all active ability score bonuses
     * @private
     */
    _renderBonusNotes() {
        const bonusGroups = abilityScoreManager.getBonusGroups();
        console.log('[AbilityScoreCard] Bonus groups:', Array.from(bonusGroups.entries()));

        if (bonusGroups.size === 0) {
            this.bonusesContainer.innerHTML = '<div class="text-muted">No ability score bonuses applied.</div>';
            return;
        }

        let bonusContent = '<h6 class="mb-2">Ability Score Bonuses</h6>';
        const raceBonuses = this._processRaceBonuses(bonusGroups);

        if (raceBonuses.length > 0) {
            bonusContent += this._createBonusNote('Race', raceBonuses.join(', '));
        }

        // Process remaining bonus groups
        for (const [source, bonusList] of bonusGroups.entries()) {
            if (source.startsWith('Race')) continue; // Skip race bonuses as they're handled separately

            const bonusText = bonusList.map(b =>
                `${this._getAbilityAbbreviation(b.ability)} ${b.value >= 0 ? '+' : ''}${b.value}`
            ).join(', ');
            bonusContent += this._createBonusNote(source, bonusText);
        }

        this.bonusesContainer.innerHTML = bonusContent;

        // Process the bonuses container to resolve any reference tags
        textProcessor.processElement(this.bonusesContainer);
    }

    /**
     * Processes race-related bonuses and formats them for display
     * @param {Map<string, Array<BonusGroup>>} bonusGroups - Map of all bonus groups
     * @returns {Array<string>} Array of formatted race bonus strings
     * @private
     */
    _processRaceBonuses(bonusGroups) {
        const raceRelatedSources = ['Race', 'Subrace', 'Race Choice 1', 'Race Choice 2', 'Race Choice 3', 'Subrace Choice 1', 'Subrace Choice 2', 'Subrace Choice 3'];
        const raceBonuses = new Map();
        const allRaceBonuses = [];

        // Collect race-related bonuses
        for (const source of raceRelatedSources) {
            if (bonusGroups.has(source)) {
                raceBonuses.set(source, bonusGroups.get(source));
                bonusGroups.delete(source);
            }
        }

        // Process all fixed race and subrace bonuses together
        const fixedBonuses = [];
        for (const [source, bonusList] of raceBonuses.entries()) {
            if (source === 'Race' || source === 'Subrace') {
                const bonuses = bonusList.filter(b => !b.isChoice);
                fixedBonuses.push(...bonuses);
            }
        }

        // Format all fixed bonuses into a single line
        if (fixedBonuses.length > 0) {
            const formattedBonuses = fixedBonuses.map(bonus =>
                `${this._getAbilityAbbreviation(bonus.ability)} ${bonus.value >= 0 ? '+' : ''}${bonus.value}`
            ).join(', ');
            allRaceBonuses.push(formattedBonuses);
        }

        // Process choice bonuses separately
        for (const [source, bonusList] of raceBonuses.entries()) {
            if (source.includes('Choice')) {
                for (const bonus of bonusList) {
                    allRaceBonuses.push(
                        `${this._getAbilityAbbreviation(bonus.ability)} ${bonus.value >= 0 ? '+' : ''}${bonus.value} (choice)`
                    );
                }
            }
        }

        return allRaceBonuses;
    }

    /**
     * Creates a bonus note HTML element
     * @param {string} source - The source of the bonus
     * @param {string} content - The bonus content
     * @returns {string} HTML for the bonus note
     * @private
     */
    _createBonusNote(source, content) {
        return `<div class="bonus-note">
            <strong>${source}</strong>: ${content}
        </div>`;
    }

    /**
     * Renders the bonus display for a specific ability
     * @param {string} ability - The ability name
     * @returns {string} HTML for the bonus display
     */
    renderBonus(ability) {
        const score = abilityScoreManager.getTotalScore(ability);
        const baseScore = abilityScoreManager.getBaseScore(ability);
        const totalBonus = score - baseScore;

        if (totalBonus === 0) return '';

        const bonusClass = totalBonus >= 0 ? 'bonus' : 'bonus negative';
        return `<div class="${bonusClass}">${totalBonus >= 0 ? '+' : ''}${totalBonus}</div>`;
    }

    /**
     * Handles the selection of an ability choice from a dropdown
     * @param {Event} event - The change event from the dropdown
     */
    handleAbilityChoice(event) {
        const select = event.target;
        const choiceIndex = Number.parseInt(select.dataset.choiceIndex, 10);
        const bonus = Number.parseInt(select.dataset.bonus, 10);
        const source = select.dataset.source;
        const selectedAbility = select.value;

        abilityScoreManager.handleAbilityChoice(selectedAbility, choiceIndex, bonus, source);
    }

    /**
     * Handles clicks on ability score buttons for increasing/decreasing scores
     * @param {Event} event - The click event
     * @private
     */
    _handleAbilityScoreClick(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const ability = button.dataset.ability;

        if (!ability) return;

        console.log(`[AbilityScoreCard] Button clicked: ${action} for ${ability}`);

        const currentScore = abilityScoreManager.getBaseScore(ability);
        let newScore = currentScore;

        if (action === 'increase') {
            newScore = currentScore + 1;
        } else if (action === 'decrease') {
            newScore = currentScore - 1;
        }

        // Get the ability score box
        const box = this.container.querySelector(`[data-ability="${ability}"]`);
        if (!box) return;

        // Check for limits and flash border if needed
        const isPointBuy = characterHandler.currentCharacter?.variantRules?.abilityScoreMethod === 'pointBuy';
        if (newScore === currentScore ||
            (isPointBuy && ((newScore > 15 && action === 'increase') || (newScore < 8 && action === 'decrease'))) ||
            (newScore > 20 && action === 'increase') ||
            (newScore < 3 && action === 'decrease')) {

            // Flash the border to indicate limit reached
            box.classList.add('flash-border');
            setTimeout(() => {
                box.classList.remove('flash-border');
            }, 500);

            return;
        }

        console.log(`[AbilityScoreCard] Updating score from ${currentScore} to ${newScore}`);

        // Update the score
        abilityScoreManager.updateBaseScore(ability, newScore);

        // Only update points counter if using point buy (to reduce lag)
        const character = characterHandler.currentCharacter;
        if (character?.variantRules?.abilityScoreMethod === 'pointBuy') {
            // Just update the points counter instead of re-rendering everything
            this._updatePointBuyCounter();
        }

        // Update the UI to show the new score
        this._updateAbilityScoreValues();
    }

    /**
     * Updates only the point buy counter display without re-rendering everything
     * @private
     */
    _updatePointBuyCounter() {
        const counter = this.container.querySelector('.point-buy-badge');
        if (!counter) return;

        const usedPoints = abilityScoreManager.calculateUsedPoints();
        const remainingPoints = abilityScoreManager.getRemainingPoints();
        const maxPoints = abilityScoreManager.maxPoints;

        counter.innerHTML = `<span class="label">Point Buy</span>${usedPoints}/${maxPoints} 
                           (<strong>${remainingPoints}</strong> remaining)`;

        // Apply danger color only if over the limit
        if (remainingPoints < 0) {
            counter.classList.add('danger');
        } else {
            counter.classList.remove('danger');
        }
    }

    /**
     * Sets up event listeners for the ability score card
     */
    setupEventListeners() {
        console.log('[AbilityScoreCard] Setting up event listeners');

        // Add the custom CSS for the new UI elements
        this.addStyles();

        // Remove existing listeners first (to prevent duplicates)
        document.removeEventListener('abilityScoresChanged', this.abilityScoresChangedListener);

        // Remove any existing click listener to prevent duplicate handling
        if (this.container) {
            // Instead of replacing the entire container, just remove the click event
            if (this.clickHandler) {
                this.container.removeEventListener('click', this.clickHandler);
            }

            // Create a bound reference to the handler that we can store for later removal
            this.clickHandler = this._handleAbilityScoreClick.bind(this);
            this.container.addEventListener('click', this.clickHandler);
        }

        // Create debounced render function to prevent too many updates
        this.debouncedRender = this._debounce(() => {
            // Don't trigger a full re-render in the event handler to avoid loops
            this._updateAbilityScoreValues();
            this._renderAbilityChoices();
            this._renderBonusNotes();
        }, 30); // 30ms debounce

        // Store a reference to the listener for later removal
        this.abilityScoresChangedListener = (event) => {
            console.log('[AbilityScoreCard] Received abilityScoresChanged event:', event.detail);

            // Use targeted updates when possible instead of full re-renders
            const character = characterHandler.currentCharacter;
            const methodFromCharacter = character?.variantRules?.abilityScoreMethod;

            if (methodFromCharacter === 'pointBuy') {
                // For point buy, just update the counter and the specific ability score
                this._updatePointBuyCounter();
                this._updateAbilityScoreValues();
            } else {
                // For other methods, use the debounced targeted updates
                this.debouncedRender();
            }
        };

        // Add the listener
        document.addEventListener('abilityScoresChanged', this.abilityScoresChangedListener);

        console.log('[AbilityScoreCard] Event listeners set up successfully');
    }

    /**
     * Updates only the ability score values without re-rendering the whole card
     * @private
     */
    _updateAbilityScoreValues() {
        const isPointBuy = characterHandler.currentCharacter?.variantRules?.abilityScoreMethod === 'pointBuy';

        for (const ability of abilityScoreManager.getAllAbilities()) {
            const box = this.container.querySelector(`[data-ability="${ability}"]`);
            if (!box) continue;

            const baseScore = abilityScoreManager.getBaseScore(ability);
            const totalScore = abilityScoreManager.getTotalScore(ability);

            // Update score and modifier displays
            box.querySelector('.score').textContent = totalScore;
            box.querySelector('.modifier').textContent = abilityScoreManager.getModifier(totalScore);

            // Update bonus display
            const bonusDiv = box.querySelector('.bonus');
            bonusDiv.innerHTML = this.renderBonus(ability);

            // Update point cost indicator if this is point buy method
            if (isPointBuy) {
                const controlsContainer = box.querySelector('.ability-controls');
                if (controlsContainer) {
                    // First remove any existing cost indicators
                    const existingCosts = controlsContainer.querySelectorAll('.point-cost');
                    for (const cost of existingCosts) {
                        cost.remove();
                    }

                    // Get updated cost
                    const cost = abilityScoreManager.getPointCost(baseScore);
                    console.log(`[AbilityScoreCard] Updating point cost for ${ability} (score ${baseScore}): ${cost}`);

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
     * Simple debounce function for limiting function call frequency
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     * @private
     */
    _debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Converts an ability name to its standard abbreviation
     * @param {string} ability - The ability name
     * @returns {string} The abbreviated ability name
     * @private
     */
    _getAbilityAbbreviation(ability) {
        const abilityLower = ability.toLowerCase();
        switch (abilityLower) {
            case 'strength': return 'STR';
            case 'dexterity': return 'DEX';
            case 'constitution': return 'CON';
            case 'intelligence': return 'INT';
            case 'wisdom': return 'WIS';
            case 'charisma': return 'CHA';
            case 'str': return 'STR';
            case 'dex': return 'DEX';
            case 'con': return 'CON';
            case 'int': return 'INT';
            case 'wis': return 'WIS';
            case 'cha': return 'CHA';
            default: return ability.toUpperCase();
        }
    }

    // Add this CSS to the document
    addStyles() {
        const style = document.createElement('style');
        style.id = 'ability-score-methods-styles';

        style.textContent = `
            .ability-score-method-info {
                margin-bottom: 12px;
            }
            
            .ability-score-method-info .card {
                background-color: var(--card-bg-color, #f8f9fa);
                border-color: var(--border-color, #dee2e6);
                border-radius: var(--border-radius, 4px);
            }
            
            .point-buy-counter {
                font-size: 0.9em;
                font-weight: 600;
                color: var(--accent-color);
                box-shadow: var(--card-shadow, 0 1px 3px rgba(0,0,0,0.1));
            }
            
            .text-accent {
                color: var(--accent-color) !important;
            }
            
            .ability-value-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 34px;
                height: 34px;
                border-radius: 50%;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .ability-value-badge.available {
                background-color: #e9ecef;
                color: #212529;
            }
            
            .ability-value-badge.used {
                background-color: #dee2e6;
                color: #888;
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            .ability-value-badge.selected {
                background-color: #007bff;
                color: #fff;
                transform: scale(1.1);
            }
            
            .ability-value-badge:hover:not(.used) {
                background-color: #ced4da;
            }
            
            .standard-array-target {
                transition: all 0.2s;
            }
            
            .standard-array-target:hover {
                background-color: rgba(0, 123, 255, 0.1);
                transform: scale(1.02);
            }
            
            .point-cost {
                font-size: 11px;
                font-weight: 600;
                margin-left: 8px;
                padding: 2px 6px;
                border-radius: 4px;
                display: inline-block;
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
            }
            
            .point-cost.low {
                color: #0d6efd;
            }
            
            .point-cost.medium {
                color: #fd7e14;
            }
            
            .point-cost.high {
                color: #dc3545;
            }
            
            .ability-controls {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .standard-array-select {
                width: 100%;
                max-width: 120px;
                margin: 0 auto;
            }
            
            .point-buy-badge {
                font-size: 0.85em;
                font-weight: 600;
                color: var(--accent-color);
                background-color: #f8f9fa;
                padding: 0.3rem 0.7rem;
                border-radius: 0.5rem;
                display: inline-block;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                border: 1px solid #dee2e6;
            }
            
            .point-buy-badge .label {
                color: white;
                background-color: var(--accent-color);
                padding: 0.15rem 0.4rem;
                border-radius: 0.3rem;
                margin-right: 0.3rem;
            }
            
            .point-buy-badge.danger {
                background-color: var(--danger-color, #dc3545);
                color: white;
            }
            
            @keyframes flashBorder {
                0% { border-color: var(--border-color, #dee2e6); }
                50% { border-color: var(--accent-color); }
                100% { border-color: var(--border-color, #dee2e6); }
            }
            
            .ability-score-box.flash-border {
                animation: flashBorder 0.5s ease;
            }
        `;

        // Only add if not already present
        if (!document.getElementById('ability-score-methods-styles')) {
            document.head.appendChild(style);
        }
    }

    /**
     * Removes event listeners when the card is destroyed
     */
    remove() {
        if (this.abilityScoresChangedListener) {
            document.removeEventListener('abilityScoresChanged', this.abilityScoresChangedListener);
        }

        if (this.container && this.clickHandler) {
            this.container.removeEventListener('click', this.clickHandler);
        }
    }

    /**
     * Updates the ability score card display
     */
    update() {
        this.render();
    }

    /**
     * Initializes ability scores for a newly loaded character
     * This should be called when a character is first loaded
     * @param {Character} character - The character to initialize ability scores for
     * @static
     */
    static initializeForCharacter(character) {
        if (!character) return;

        // Get the ability score method from the character
        const method = character.variantRules?.abilityScoreMethod || 'custom';
        console.log('[AbilityScoreCard] Initializing for character with method:', method);

        // Update the ability score manager based on the method
        if (method === 'standardArray') {
            abilityScoreManager.updateAssignedStandardArrayValues();
        } else if (method === 'pointBuy') {
            abilityScoreManager.calculateUsedPoints();
        }
    }
} 