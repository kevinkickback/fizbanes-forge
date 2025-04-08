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

/**
 * Manages the ability score UI component and related functionality
 */
export class AbilityScoreCard {
    /**
     * Creates a new AbilityScoreCard instance
     */
    constructor() {
        /**
         * Container element for ability score boxes
         * @type {HTMLElement}
         * @private
         */
        this._container = document.querySelector('.ability-score-container');

        /**
         * Container element for ability bonus notes
         * @type {HTMLElement}
         * @private
         */
        this._bonusesContainer = document.getElementById('abilityBonusesNotes');

        /**
         * Event listener for ability score changes
         * @type {Function}
         * @private
         */
        this._abilityScoresChangedListener = () => this.render();

        /**
         * Whether the ability score method has been initialized
         * @type {boolean}
         * @private
         */
        this._initializedMethod = false;

        /**
         * The last ability score method that was initialized
         * @type {string}
         * @private
         */
        this._lastInitializedMethod = '';

        // Initialize the component
        this.initialize();
    }

    //-------------------------------------------------------------------------
    // Initialization Methods
    //-------------------------------------------------------------------------

    /**
     * Initializes the ability score card by rendering content and setting up event listeners
     * @returns {void}
     */
    initialize() {
        try {
            // Add the custom CSS for the UI elements
            this._addStyles();

            // Set up event listeners before rendering
            this._setupEventListeners();

            // Force synchronization of the ability score manager with the current character
            this._syncWithCurrentCharacter();

            // Render initial state
            this.render();
        } catch (error) {
            console.error('Failed to initialize ability score card:', error);
        }
    }

    /**
     * Synchronizes the ability score manager with the current character
     * @private
     */
    _syncWithCurrentCharacter() {
        const character = characterHandler.getCurrentCharacter();
        if (!character) return;

        // Set default ability score method if not already set
        if (!character.variantRules) {
            character.variantRules = {};
        }

        if (!character.variantRules.abilityScoreMethod) {
            character.variantRules.abilityScoreMethod = 'custom';
        }

        // Force the abilityScoreManager to reset based on current character method
        abilityScoreManager.resetAbilityScoreMethod();

        // Update UI element to reflect current method
        const methodSelect = document.getElementById('abilityScoreMethod');
        if (methodSelect) {
            methodSelect.value = character.variantRules.abilityScoreMethod;
        }

        console.debug("Synchronized ability score manager with character using method:",
            character.variantRules.abilityScoreMethod);
    }

    /**
     * Sets up event listeners for ability score card interactions
     * @private
     */
    _setupEventListeners() {
        try {
            // Remove any existing listeners first to prevent duplicates
            document.removeEventListener('abilityScoresChanged', this._abilityScoresChangedListener);
            document.removeEventListener('characterChanged', this._handleCharacterChanged);

            // Listen for ability score changes events from various sources
            document.addEventListener('abilityScoresChanged', this._abilityScoresChangedListener);
            document.addEventListener('characterChanged', this._handleCharacterChanged.bind(this));

            // Handle method changes
            const methodSelect = document.getElementById('abilityScoreMethod');
            if (methodSelect) {
                methodSelect.removeEventListener('change', this._handleMethodChange);
                methodSelect.addEventListener('change', this._handleMethodChange.bind(this));
            }

            // Remove existing click handlers on the container to prevent duplicates
            if (this._container) {
                this._container.removeEventListener('click', this._handleContainerClicks);
                this._container.removeEventListener('change', this._handleContainerChanges);

                // Create bound handler references for delegation
                this._handleContainerClicks = this._handleContainerClickEvent.bind(this);
                this._handleContainerChanges = this._handleContainerChangeEvent.bind(this);

                // Use delegation for all clicks and changes within the container
                this._container.addEventListener('click', this._handleContainerClicks);
                this._container.addEventListener('change', this._handleContainerChanges);
            }

            // Custom inputs - use delegation rather than individual listeners
            this._debouncedCustomInput = this._debounce(this._handleCustomInput.bind(this), 300);

            // Listen for ability score changes
            this._container.addEventListener('change', (e) => {
                if (e.target.classList.contains('ability-choice-select')) {
                    const index = Number.parseInt(e.target.dataset.choiceIndex, 10);
                    const ability = e.target.value;
                    const bonus = Number.parseInt(e.target.dataset.bonus, 10);
                    const source = e.target.dataset.source;

                    console.debug('Ability choice selected:', {
                        index,
                        ability,
                        bonus,
                        source
                    });

                    if (ability) {
                        abilityScoreManager.handleAbilityChoice(ability, index, bonus, source);
                        this._updateAbilityScores();
                    }
                }
            });

            // Listen for race changes
            document.addEventListener('raceChanged', () => {
                this._updateAbilityScores();
            });

            // Listen for subrace changes
            document.addEventListener('subraceChanged', () => {
                this._updateAbilityScores();
            });
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    /**
     * Handles all click events within the ability score container (delegation)
     * @param {Event} event - The click event
     * @private
     */
    _handleContainerClickEvent(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const ability = button.dataset.ability;

        // Handle increase/decrease button clicks
        if (action === 'increase') {
            this._handlePointBuyIncrease(button);
        }
        else if (action === 'decrease') {
            this._handlePointBuyDecrease(button);
        }
        // Allow for other click handlers as needed
    }

    /**
     * Handles all change events within the ability score container (delegation)
     * @param {Event} event - The change event
     * @private
     */
    _handleContainerChangeEvent(event) {
        if (event.target.classList.contains('ability-choice-select')) {
            this._handleAbilityChoice(event);
        }
        else if (event.target.classList.contains('standard-array-select')) {
            this._handleStandardArraySelection(event);
        }
        else if (event.target.classList.contains('ability-custom-input')) {
            this._debouncedCustomInput(event);
        }
    }

    /**
     * Handles character change events
     * @param {Event} event - The character changed event
     * @private
     */
    _handleCharacterChanged(event) {
        const character = characterHandler.getCurrentCharacter();
        if (!character) return;

        console.debug("Character changed, syncing ability score manager");

        // Sync with current character first
        this._syncWithCurrentCharacter();

        // Then render the UI
        this.render();
    }

    /**
     * Handles method change events
     * @param {Event} event - The change event
     * @private
     */
    _handleMethodChange(event) {
        const method = event.target.value;
        const character = characterHandler.currentCharacter;
        if (!character) return;

        // Update character's variant rules
        if (!character.variantRules) {
            character.variantRules = {};
        }
        character.variantRules.abilityScoreMethod = method;

        // Reset method and render
        abilityScoreManager.resetAbilityScoreMethod();
        this.render();

        // Notify that ability scores have changed
        document.dispatchEvent(new CustomEvent('abilityScoresChanged', {
            detail: { character }
        }));
    }

    /**
     * Handles standard array selection change
     * @param {Event} event - The change event
     * @private
     */
    _handleStandardArraySelection(event) {
        const ability = event.target.dataset.ability;
        const newValue = Number.parseInt(event.target.value, 10);

        if (!ability || Number.isNaN(newValue)) {
            return;
        }

        console.debug(`Standard array selection: ${ability} = ${newValue}`);

        // Find if this value is already assigned to another ability
        const currentAbilityScore = abilityScoreManager.getBaseScore(ability);

        // Check all abilities to see if any have this value assigned
        let otherAbility = null;
        for (const checkAbility of abilityScoreManager.getAllAbilities()) {
            // Skip the current ability
            if (checkAbility === ability) {
                continue;
            }

            // Check if this ability has the value we want to assign
            if (abilityScoreManager.getBaseScore(checkAbility) === newValue) {
                otherAbility = checkAbility;
                break;
            }
        }

        // If value is already assigned to another ability, swap them
        if (otherAbility) {
            console.debug(`Swapping values: ${ability}=${newValue}, ${otherAbility}=${currentAbilityScore}`);
            abilityScoreManager.updateAbilityScore(otherAbility, currentAbilityScore);
        }

        // Update the current ability score with the new value
        abilityScoreManager.updateAbilityScore(ability, newValue);

        // Update all standard array dropdowns to reflect the new assignments
        this._updateAllStandardArrayOptions();
    }

    /**
     * Updates all standard array option dropdowns
     * @private
     */
    _updateAllStandardArrayOptions() {
        for (const ability of abilityScoreManager.getAllAbilities()) {
            const box = this._container.querySelector(`[data-ability="${ability}"]`);
            if (!box) continue;

            const select = box.querySelector('.standard-array-select');
            if (!select) continue;

            this._updateStandardArrayOptions(select, ability);
        }
    }

    /**
     * Updates options in a standard array select dropdown
     * @param {HTMLSelectElement} select - The select element to update
     * @param {string} ability - The ability name
     * @private
     */
    _updateStandardArrayOptions(select, ability) {
        const currentValue = abilityScoreManager.getBaseScore(ability);
        console.debug(`Updating standard array options for ${ability}, current value=${currentValue}`);

        // Clear all existing options
        select.innerHTML = '';

        // Add options for all standard array values
        for (const value of abilityScoreManager.getStandardArrayValues()) {
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

    /**
     * Handles increasing ability scores for point buy
     * @param {HTMLElement} btn - The button element
     * @private
     */
    _handlePointBuyIncrease(btn) {
        const ability = btn.dataset.ability;
        if (!ability) return;

        const character = characterHandler.getCurrentCharacter();
        if (!character) return;

        const currentScore = abilityScoreManager.getBaseScore(ability);
        const newScore = currentScore + 1;

        // Get the ability score box
        const box = this._container.querySelector(`[data-ability="${ability}"]`);
        if (!box) return;

        // Determine method
        const method = character.variantRules?.abilityScoreMethod || 'custom';
        const isPointBuy = method === 'pointBuy';

        // Apply different constraints based on the method
        if (isPointBuy) {
            // For point buy, enforce 8-15 range and check remaining points
            const currentCost = abilityScoreManager.getPointCost(currentScore) || 0;
            const newCost = abilityScoreManager.getPointCost(newScore) || 0;
            const costDifference = newCost - currentCost;
            const remainingPoints = abilityScoreManager.getRemainingPoints();

            // Check if score is at max or not enough points
            if (newScore > 15 || costDifference > remainingPoints) {
                // Flash the border to indicate limit reached
                box.classList.add('flash-border');
                setTimeout(() => {
                    box.classList.remove('flash-border');
                }, 500);
                return;
            }
        } else {
            // For other methods, enforce general max of 20
            if (newScore > 20) {
                // Flash the border to indicate limit reached
                box.classList.add('flash-border');
                setTimeout(() => {
                    box.classList.remove('flash-border');
                }, 500);
                return;
            }
        }

        // Update the score
        abilityScoreManager.updateAbilityScore(ability, newScore);

        // Only update points counter if using point buy (to reduce lag)
        if (isPointBuy) {
            this._updatePointBuyCounter();
        }

        // Update the UI to show the new score
        this._updateAbilityScoreValues();
    }

    /**
     * Handles decreasing ability scores for point buy
     * @param {HTMLElement} btn - The button element
     * @private
     */
    _handlePointBuyDecrease(btn) {
        const ability = btn.dataset.ability;
        if (!ability) return;

        const character = characterHandler.getCurrentCharacter();
        if (!character) return;

        const currentScore = abilityScoreManager.getBaseScore(ability);
        const newScore = currentScore - 1;

        // Get the ability score box
        const box = this._container.querySelector(`[data-ability="${ability}"]`);
        if (!box) return;

        // Determine method
        const method = character.variantRules?.abilityScoreMethod || 'custom';
        const isPointBuy = method === 'pointBuy';

        // Apply different constraints based on the method
        if (isPointBuy) {
            // For point buy, enforce 8-15 range
            if (newScore < 8) {
                // Flash the border to indicate limit reached
                box.classList.add('flash-border');
                setTimeout(() => {
                    box.classList.remove('flash-border');
                }, 500);
                return;
            }
        } else {
            // For other methods, enforce general min of 3
            if (newScore < 3) {
                // Flash the border to indicate limit reached
                box.classList.add('flash-border');
                setTimeout(() => {
                    box.classList.remove('flash-border');
                }, 500);
                return;
            }
        }

        // Update the score
        abilityScoreManager.updateAbilityScore(ability, newScore);

        // Only update points counter if using point buy (to reduce lag)
        if (isPointBuy) {
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
        const counter = this._container.querySelector('.point-buy-badge');
        if (!counter) return;

        const usedPoints = abilityScoreManager.getUsedPoints();
        const remainingPoints = abilityScoreManager.getRemainingPoints();
        const maxPoints = abilityScoreManager.getMaxPoints();

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
     * Handles custom ability score input
     * @param {Event} event - The input event
     * @private
     */
    _handleCustomInput(event) {
        const ability = event.target.dataset.ability;
        if (!ability) return;

        const newValue = Number.parseInt(event.target.value, 10);
        if (!Number.isNaN(newValue)) {
            abilityScoreManager.updateAbilityScore(ability, newValue);
            // No need to render here as it will cause input focus loss
            this._updateAbilityScoreValues();
        }
    }

    //-------------------------------------------------------------------------
    // Rendering Methods
    //-------------------------------------------------------------------------

    /**
     * Renders the entire ability score card, including scores, choices, and bonus notes
     * @returns {void}
     */
    render() {
        try {
            // Initialize scoring method system if needed
            this._initializeAbilityScoreMethod();

            // Make sure assigned standard array values are updated
            if (characterHandler.getCurrentCharacter()?.variantRules?.abilityScoreMethod === 'standardArray') {
                abilityScoreManager.updateAssignedStandardArrayValues();
            }

            // Render point buy info or standard array selection if needed
            this._renderAbilityScoreMethodInfo();

            // Render the ability score boxes
            this._renderAbilityScores();

            // Render any pending ability choices
            this._renderAbilityChoices();

            // Render bonus notes explaining where bonuses come from
            this._renderBonusNotes();
        } catch (error) {
            console.error('Error rendering ability score card:', error);
        }
    }

    /**
     * Updates the UI without full re-render
     * Useful for changes that should not disrupt user input
     * @returns {void}
     */
    update() {
        this._updateAbilityScoreValues();
        this._renderBonusNotes();
    }

    /**
     * Initialize ability scores based on the selected method when a character is first loaded
     * @private
     */
    _initializeAbilityScoreMethod() {
        const character = characterHandler.getCurrentCharacter();
        if (!character) return;

        // Only initialize if not already done for this method
        if (!this._initializedMethod || this._lastInitializedMethod !== character.variantRules?.abilityScoreMethod) {
            this._lastInitializedMethod = character.variantRules?.abilityScoreMethod || 'custom';
            this._initializedMethod = true;

            // Update UI element to reflect current method
            const methodSelect = document.getElementById('abilityScoreMethod');
            if (methodSelect) {
                methodSelect.value = this._lastInitializedMethod;
            }

            console.debug("Initializing ability score method:", this._lastInitializedMethod);

            // Ensure ability scores are properly initialized for the selected method
            abilityScoreManager.resetAbilityScoreMethod();

            // For standard array, make sure the assignments are tracked properly
            if (this._lastInitializedMethod === 'standardArray') {
                abilityScoreManager.updateAssignedStandardArrayValues();

                // Manually update all dropdowns to ensure they show correct values
                setTimeout(() => {
                    this._updateAllStandardArrayOptions();
                }, 100);
            }
        }
    }

    /**
     * Renders the ability score method information (Point Buy tracking or Standard Array options)
     * @private
     */
    _renderAbilityScoreMethodInfo() {
        try {
            // Remove existing info container if it exists
            let infoContainer = this._container.querySelector('.ability-score-method-info');
            if (infoContainer) {
                infoContainer.remove();
            }

            // Get the character and method directly
            const character = characterHandler.getCurrentCharacter();
            if (!character) {
                return;
            }

            // Always use the method directly from character.variantRules
            const methodFromCharacter = character.variantRules?.abilityScoreMethod || 'custom';
            const isPointBuy = methodFromCharacter === 'pointBuy';
            const isStandardArray = methodFromCharacter === 'standardArray';

            // Create a new container
            infoContainer = document.createElement('div');
            infoContainer.className = 'ability-score-method-info mb-3';

            // Populate based on current method
            if (isPointBuy) {
                const usedPoints = abilityScoreManager.getUsedPoints();
                const remainingPoints = abilityScoreManager.getRemainingPoints();
                const maxPoints = abilityScoreManager.getMaxPoints();

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
                const standardArray = abilityScoreManager.getStandardArrayValues();
                const usedCount = 6 - availableValues.length;

                infoContainer.innerHTML = `
                    <div class="d-flex justify-content-end mb-2">
                        <div class="point-buy-badge">
                            <span class="label">Standard Array</span>${usedCount}/6 assigned
                    </div>
                        </div>
                    <div class="d-flex justify-content-center mb-2">
                        <div class="standard-array-values">
                            ${standardArray.map(value =>
                    `<span class="standard-array-value ${availableValues.includes(value) ? 'available' : 'used'}">${value}</span>`
                ).join('')}
                    </div>
                </div>
            `;
            } else if (methodFromCharacter === 'custom') {
                infoContainer.innerHTML = `
                    <div class="alert alert-info mb-2 py-2 small">
                        <strong>Custom Scores:</strong> Enter your ability scores directly.
                    </div>
                `;
            }

            // Add the container only if we have content
            if (infoContainer.innerHTML.trim()) {
                this._container.prepend(infoContainer);
            }
        } catch (error) {
            console.error('Error rendering ability score method info:', error);
        }
    }

    /**
     * Renders the ability score boxes with their current values and modifiers
     * @private
     */
    _renderAbilityScores() {
        try {
            // Get the ability score method directly from character
            const character = characterHandler.getCurrentCharacter();
            if (!character) {
                return;
            }

            // Always get the method directly from character.variantRules to ensure consistency
            const methodFromCharacter = character.variantRules?.abilityScoreMethod || 'custom';

            const isStandardArray = methodFromCharacter === 'standardArray';
            const isPointBuy = methodFromCharacter === 'pointBuy';
            const isCustom = methodFromCharacter === 'custom';

            // Process each ability score
            for (const ability of abilityScoreManager.getAllAbilities()) {
                this._renderAbilityScoreBox(ability, isStandardArray, isPointBuy, isCustom);
            }
        } catch (error) {
            console.error('Error rendering ability scores:', error);
        }
    }

    /**
     * Renders a single ability score box
     * @param {string} ability - The ability name (str, dex, etc.)
     * @param {boolean} isStandardArray - Whether standard array method is being used
     * @param {boolean} isPointBuy - Whether point buy method is being used
     * @param {boolean} isCustom - Whether custom method is being used
     * @private
     */
    _renderAbilityScoreBox(ability, isStandardArray, isPointBuy, isCustom) {
        const box = this._container.querySelector(`[data-ability="${ability}"]`);
        if (!box) {
            return;
        }

        // Remove any existing buttons that might be in the HTML template
        const existingButtons = box.querySelectorAll('button');
        for (const button of existingButtons) {
            button.remove();
        }

        const baseScore = abilityScoreManager.getBaseScore(ability);
        const totalScore = abilityScoreManager.getTotalScore(ability);

        // Update score and modifier displays
        box.querySelector('.score').textContent = totalScore;
        box.querySelector('.modifier').textContent = abilityScoreManager.getModifierString(ability);

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
            this._renderStandardArrayControls(controlsContainer, ability, baseScore);
        } else if (isPointBuy) {
            this._renderPointBuyControls(controlsContainer, ability, baseScore);
        } else if (isCustom) {
            this._renderCustomControls(controlsContainer, ability, baseScore);
        }

        // Append the controls
        box.appendChild(controlsContainer);
    }

    /**
     * Renders the ability choice dropdowns for pending ability score choices
     * @private
     */
    _renderAbilityChoices() {
        const pendingChoices = abilityScoreManager.getPendingChoices();
        console.debug('Rendering ability choices:', pendingChoices);

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

        console.debug(`Creating dropdown for choice ${index}:`, {
            choice,
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
        let container = this._container.querySelector('.ability-choices-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'ability-choices-container';
            this._container.appendChild(container);
        }
        return container;
    }

    /**
     * Removes the choices container if it exists
     * @private
     */
    _removeChoicesContainer() {
        const container = this._container.querySelector('.ability-choices-container');
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
            dropdown.addEventListener('change', (e) => this._handleAbilityChoice(e));
        }
    }

    /**
     * Renders the bonus notes section that explains all active ability score bonuses
     * @private
     */
    _renderBonusNotes() {
        try {
            const bonusGroups = abilityScoreManager.getBonusGroups();
            if (bonusGroups.size === 0) {
                this._bonusesContainer.innerHTML = '<div class="text-muted">No ability score bonuses applied.</div>';
                return;
            }

            let bonusContent = '<h6 class="mb-2">Ability Score Bonuses</h6>';
            const raceBonuses = this._processRaceBonuses(bonusGroups);

            if (raceBonuses.length > 0) {
                bonusContent += this._createBonusNote('Race', raceBonuses.join(', '));
            }

            // Process remaining bonus groups
            for (const [source, bonusMap] of bonusGroups.entries()) {
                if (source.startsWith('Race')) continue; // Skip race bonuses as they're handled separately

                // Format the bonuses for this source
                const bonusText = [];
                for (const [ability, value] of bonusMap.entries()) {
                    bonusText.push(`${this._getAbilityAbbreviation(ability)} ${value >= 0 ? '+' : ''}${value}`);
                }

                bonusContent += this._createBonusNote(source, bonusText.join(', '));
            }

            this._bonusesContainer.innerHTML = bonusContent;

            // Process the bonuses container to resolve any reference tags
            if (textProcessor && typeof textProcessor.processElement === 'function') {
                textProcessor.processElement(this._bonusesContainer);
            }
        } catch (error) {
            console.error('Error rendering bonus notes:', error);
        }
    }

    /**
     * Processes race-related bonuses and formats them for display
     * @param {Map<string, Map<string, number>>} bonusGroups - Map of all bonus groups
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
        for (const [source, bonusMap] of raceBonuses.entries()) {
            if (source === 'Race' || source === 'Subrace') {
                // Convert Map entries to array of bonus objects
                for (const [ability, value] of bonusMap.entries()) {
                    fixedBonuses.push({ ability, value });
                }
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
        for (const [source, bonusMap] of raceBonuses.entries()) {
            if (source.includes('Choice')) {
                for (const [ability, value] of bonusMap.entries()) {
                    allRaceBonuses.push(
                        `${this._getAbilityAbbreviation(ability)} ${value >= 0 ? '+' : ''}${value} (choice)`
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
     * Handles the selection of an ability choice from a dropdown
     * @param {Event} event - The change event from the dropdown
     * @private
     */
    _handleAbilityChoice(event) {
        const select = event.target;
        const choiceIndex = Number.parseInt(select.dataset.choiceIndex, 10);
        const bonus = Number.parseInt(select.dataset.bonus, 10);
        const source = select.dataset.source;
        const selectedAbility = select.value;

        // Use the AbilityScoreManager to handle the choice
        abilityScoreManager.handleAbilityChoice(selectedAbility, choiceIndex, bonus, source);

        // Refresh the ability choices UI
        this._renderAbilityChoices();

        // Update all score display and bonus notes
        this._renderAbilityScores();
        this._renderBonusNotes();
    }

    /**
     * Updates only the ability score values without re-rendering the whole card
     * @private
     */
    _updateAbilityScoreValues() {
        const isPointBuy = characterHandler.currentCharacter?.variantRules?.abilityScoreMethod === 'pointBuy';

        for (const ability of abilityScoreManager.getAllAbilities()) {
            const box = this._container.querySelector(`[data-ability="${ability}"]`);
            if (!box) continue;

            const baseScore = abilityScoreManager.getBaseScore(ability);
            const totalScore = abilityScoreManager.getTotalScore(ability);

            // Update score and modifier displays
            box.querySelector('.score').textContent = totalScore;
            box.querySelector('.modifier').textContent = abilityScoreManager.getModifierString(ability);

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
                    const existingCosts = controlsContainer.querySelectorAll('.point-cost');
                    for (const cost of existingCosts) {
                        cost.remove();
                    }

                    // Get updated cost
                    const cost = abilityScoreManager.getPointCost(baseScore);

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
    _addStyles() {
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
            
            .standard-array-values {
                display: flex;
                justify-content: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .standard-array-value {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                font-weight: bold;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                transition: all 0.2s;
            }
            
            .standard-array-value.available {
                background-color: var(--accent-color, #007bff);
                color: white;
            }
            
            .standard-array-value.used {
                background-color: #dee2e6;
                color: #888;
                opacity: 0.6;
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
                flex-direction: column;
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
        if (this._abilityScoresChangedListener) {
            document.removeEventListener('abilityScoresChanged', this._abilityScoresChangedListener);
        }

        if (this._container && this._handleContainerClicks) {
            this._container.removeEventListener('click', this._handleContainerClicks);
        }

        if (this._container && this._handleContainerChanges) {
            this._container.removeEventListener('change', this._handleContainerChanges);
        }
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

        // Update the ability score manager based on the method
        if (method === 'standardArray') {
            abilityScoreManager.updateAssignedStandardArrayValues();
        } else if (method === 'pointBuy') {
            abilityScoreManager.getUsedPoints();
        }
    }

    /**
     * Renders standard array controls for an ability score
     * @param {HTMLElement} container - The container element
     * @param {string} ability - The ability name
     * @param {number} baseScore - The base score
     * @private
     */
    _renderStandardArrayControls(container, ability, baseScore) {
        // Clear any existing content in the container
        container.innerHTML = '';

        // Create the select dropdown
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm standard-array-select';
        select.dataset.ability = ability;

        // Update the options in the select to reflect current state
        this._updateStandardArrayOptions(select, ability);

        // Add change event listener
        select.addEventListener('change', this._handleStandardArraySelection.bind(this));

        // Add the select to the container
        container.appendChild(select);
    }

    /**
     * Renders point buy controls for an ability score
     * @param {HTMLElement} container - The container element
     * @param {string} ability - The ability name
     * @param {number} baseScore - The base score
     * @private
     */
    _renderPointBuyControls(container, ability, baseScore) {
        // Create button group for +/- controls
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'd-flex align-items-center justify-content-center';

        // Create decrease button using the requested format
        const decreaseBtn = document.createElement('button');
        decreaseBtn.className = 'btn btn-sm btn-light me-1';
        decreaseBtn.dataset.action = 'decrease';
        decreaseBtn.dataset.ability = ability;
        decreaseBtn.textContent = '-';
        // Don't disable buttons, we'll handle limits with border flashing
        // decreaseBtn.disabled = baseScore <= abilityScoreManager.minScore;

        // Create value display
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'mx-2 fw-bold';
        valueDisplay.textContent = baseScore;

        // Create increase button using the requested format
        const increaseBtn = document.createElement('button');
        increaseBtn.className = 'btn btn-sm btn-light';
        increaseBtn.dataset.action = 'increase';
        increaseBtn.dataset.ability = ability;
        increaseBtn.textContent = '+';
        // Don't disable buttons, we'll handle limits with border flashing
        // increaseBtn.disabled = baseScore >= 15 || abilityScoreManager.getRemainingPoints() <= 0;

        // Add cost indicator
        const cost = abilityScoreManager.getPointCost(baseScore);
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
     * @private
     */
    _renderCustomControls(container, ability, baseScore) {
        // Create number input for direct value entry
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-control form-control-sm ability-custom-input';
        input.min = abilityScoreManager.minScore;
        input.max = abilityScoreManager.maxScore;
        input.value = baseScore;
        input.dataset.ability = ability;

        // Add to container
        container.appendChild(input);
    }

    _updateAbilityScores() {
        try {
            // Get the current ability scores from the manager
            const scores = {};
            for (const ability of abilityScoreManager._allAbilities) {
                scores[ability] = abilityScoreManager.getTotalScore(ability);
            }

            console.debug('Updating ability scores:', scores);

            // Update each ability score box
            for (const [ability, score] of Object.entries(scores)) {
                const box = this._container.querySelector(`[data-ability="${ability}"]`);
                if (box) {
                    // Update the score display
                    const scoreElement = box.querySelector('.score');
                    if (scoreElement) {
                        scoreElement.textContent = score;
                    }

                    // Update the modifier
                    const modifierElement = box.querySelector('.modifier');
                    if (modifierElement) {
                        modifierElement.textContent = abilityScoreManager.getModifierString(ability);
                    }

                    // Update the bonus display
                    const bonusElement = box.querySelector('.bonus');
                    if (bonusElement) {
                        const baseScore = abilityScoreManager.getBaseScore(ability);
                        const totalBonus = score - baseScore;
                        if (totalBonus !== 0) {
                            bonusElement.textContent = `${totalBonus >= 0 ? '+' : ''}${totalBonus}`;
                            bonusElement.className = totalBonus >= 0 ? 'bonus' : 'bonus negative';
                            bonusElement.style.display = 'block';
                        } else {
                            bonusElement.textContent = '';
                            bonusElement.style.display = 'none';
                        }
                    }
                }
            }

            // Re-render ability choices
            this._renderAbilityChoices();

            // Dispatch event to notify other components
            document.dispatchEvent(new CustomEvent('abilityScoresUpdated', {
                detail: { scores }
            }));
        } catch (error) {
            console.error('Error updating ability scores:', error);
        }
    }
} 