/**
 * AbilityScoreManager.js
 * Manages ability score state and calculations
 */
import { characterHandler } from '../utils/characterHandler.js';

let instance = null;

export class AbilityScoreManager {
    constructor() {
        if (instance) {
            throw new Error('AbilityScoreManager is a singleton. Use AbilityScoreManager.getInstance() instead.');
        }
        instance = this;

        this.abilityScores = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        this.abilityChoices = new Map(); // Store current ability choices

        // Point Buy costs map - key is ability score, value is point cost
        this.pointBuyCosts = new Map([
            [8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]
        ]);

        // Standard Array values
        this.standardArray = [15, 14, 13, 12, 10, 8];

        // Track used points for Point Buy
        this.usedPoints = 0;
        this.maxPoints = 27;

        // Track assigned standard array values
        this.assignedStandardValues = new Set();

        // Listen for character changes
        document.addEventListener('characterChanged', () => {
            this._notifyAbilityScoresChanged();
        });
    }

    /**
     * Gets the singleton instance of AbilityScoreManager
     * @returns {AbilityScoreManager} The singleton instance
     * @static
     */
    static getInstance() {
        if (!instance) {
            instance = new AbilityScoreManager();
        }
        return instance;
    }

    /**
     * Normalize an ability name to match the internal format
     * @param {string} ability - The ability name to normalize
     * @returns {string} The normalized ability name
     * @private
     */
    _normalizeAbilityName(ability) {
        if (!ability) return '';

        // Convert to lowercase and handle common variations
        const normalized = ability.toLowerCase()
            .replace(/^str$/, 'strength')
            .replace(/^dex$/, 'dexterity')
            .replace(/^con$/, 'constitution')
            .replace(/^int$/, 'intelligence')
            .replace(/^wis$/, 'wisdom')
            .replace(/^cha$/, 'charisma');

        // Return the normalized name if it's a valid ability, otherwise return empty string
        return this.abilityScores.includes(normalized) ? normalized : '';
    }

    /**
     * Get all ability scores
     * @returns {Array<string>} Array of ability score names
     */
    getAllAbilities() {
        return this.abilityScores;
    }

    /**
     * Get the base score for an ability (without bonuses)
     * @param {string} ability - The ability to get the base score for
     * @returns {number} The base score
     */
    getBaseScore(ability) {
        const character = characterHandler.currentCharacter;
        if (!character) return 10;
        const normalizedAbility = this._normalizeAbilityName(ability);
        return character.abilityScores[normalizedAbility] || 10;
    }

    /**
     * Get the total score for an ability
     * @param {string} ability - The ability to get the score for
     * @returns {number} The total score
     */
    getTotalScore(ability) {
        const character = characterHandler.currentCharacter;
        if (!character) return 10;

        const normalizedAbility = this._normalizeAbilityName(ability);
        const base = this.getBaseScore(normalizedAbility);
        const bonuses = character.abilityBonuses[normalizedAbility] || [];
        return base + bonuses.reduce((sum, bonus) => sum + bonus.value, 0);
    }

    /**
     * Get the modifier for an ability score
     * @param {number} score - The ability score
     * @returns {string} The formatted modifier
     */
    getModifier(score) {
        const modifier = Math.floor((score - 10) / 2);
        return modifier >= 0 ? `+${modifier}` : `${modifier}`;
    }

    /**
     * Get available abilities for a choice
     * @param {number} currentChoiceIndex - The index of the current choice
     * @returns {Array<string>} Array of available ability names
     */
    getAvailableAbilities(currentChoiceIndex) {
        const allAbilities = [...this.abilityScores];
        const selectedAbilities = new Set();
        const character = characterHandler.currentCharacter;
        if (!character) return allAbilities;

        // Get all pending choices
        const pendingChoices = character.getPendingAbilityChoices().filter(choice => choice.type === 'ability');
        const currentChoice = pendingChoices[currentChoiceIndex];

        console.log(`[AbilityScoreManager] Getting available abilities for choice ${currentChoiceIndex}:`, currentChoice);

        // Collect all selected abilities except the current one
        for (const [index, ability] of this.abilityChoices.entries()) {
            if (index !== currentChoiceIndex && ability) {
                selectedAbilities.add(ability);
                console.log(`[AbilityScoreManager] Excluding already selected ability: ${ability} from choice ${index}`);
            }
        }

        // Get abilities that already have racial bonuses
        const abilitiesWithRacialBonuses = new Set();
        for (const ability of this.abilityScores) {
            const bonuses = character.abilityBonuses?.[ability] || [];
            for (const bonus of bonuses) {
                // Check if the bonus is from a racial source (Race, Subrace, but not Race Choice)
                if ((bonus.source === 'Race' || bonus.source === 'Subrace') && !bonus.source.includes('Choice')) {
                    abilitiesWithRacialBonuses.add(ability);
                    console.log(`[AbilityScoreManager] Excluding ability with racial bonus: ${ability}`);
                }
            }
        }

        // For choices with source restrictions, filter to only allowed abilities
        let availableAbilities = allAbilities;
        if (currentChoice?.choices && currentChoice.choices.length > 0) {
            availableAbilities = currentChoice.choices.map(a => {
                // Map abbreviated ability names to full names
                if (a === 'str') return 'strength';
                if (a === 'dex') return 'dexterity';
                if (a === 'con') return 'constitution';
                if (a === 'int') return 'intelligence';
                if (a === 'wis') return 'wisdom';
                if (a === 'cha') return 'charisma';
                return a;
            });
            console.log("[AbilityScoreManager] Choice limited to specific abilities:", availableAbilities);
        }

        // Return abilities that:
        // 1. Haven't been selected by other choices
        // 2. Don't already have racial bonuses
        // 3. Are in the allowed choices list for this choice
        return availableAbilities.filter(ability =>
            !selectedAbilities.has(ability) &&
            !abilitiesWithRacialBonuses.has(ability)
        );
    }

    /**
     * Handle an ability choice selection
     * @param {string} ability - The selected ability
     * @param {number} choiceIndex - The index of the choice
     * @param {number} bonus - The bonus amount
     * @param {string} source - The source of the bonus
     */
    handleAbilityChoice(ability, choiceIndex, bonus, source) {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        // Clear the specific choice's bonus
        character.clearAbilityBonuses(source);

        // Update stored choices
        if (ability) {
            this.abilityChoices.set(choiceIndex, ability);
            character.addAbilityBonus(ability, bonus, source);
        } else {
            this.abilityChoices.delete(choiceIndex);
        }

        // Notify listeners of the change
        this._notifyAbilityScoresChanged();
    }

    /**
     * Clear all stored ability choices
     * This should be called when changing races to prevent stale selections
     */
    clearStoredChoices() {
        console.log('[AbilityScoreManager] Clearing all stored ability choices');
        this.abilityChoices.clear();
    }

    /**
     * Get pending ability score choices
     * @returns {Array} Array of pending ability score choices
     */
    getPendingChoices() {
        const character = characterHandler.currentCharacter;
        console.log('[AbilityScoreManager] Getting pending choices for character:', character?.id);

        if (!character) {
            console.log('[AbilityScoreManager] No character found');
            return [];
        }

        const pendingChoices = character.getPendingAbilityChoices()
            .filter(choice => choice.type === 'ability');

        console.log('[AbilityScoreManager] Filtered pending choices:', pendingChoices);
        return pendingChoices;
    }

    /**
     * Get ability score bonuses grouped by source
     * @returns {Map<string, Array>} Map of bonuses grouped by source
     */
    getBonusGroups() {
        const character = characterHandler.currentCharacter;
        console.log('[AbilityScoreManager] Getting bonus groups for character:', character?.id);

        if (!character) {
            console.log('[AbilityScoreManager] No character found, returning empty map');
            return new Map();
        }

        // Group ability bonuses by source
        const bonusGroups = new Map();

        for (const ability of this.abilityScores) {
            const bonuses = character.abilityBonuses[ability] || [];

            if (bonuses.length > 0) {
                console.log(`[AbilityScoreManager] Found ${bonuses.length} bonuses for ${ability}:`, bonuses);
            }

            for (const bonus of bonuses) {
                if (!bonusGroups.has(bonus.source)) {
                    bonusGroups.set(bonus.source, []);
                }
                bonusGroups.get(bonus.source).push({
                    ability,
                    value: bonus.value,
                    isChoice: bonus.isChoice || false
                });
            }
        }

        if (bonusGroups.size > 0) {
            console.log('[AbilityScoreManager] Grouped bonuses by source:',
                Array.from(bonusGroups.entries()).map(([source, bonuses]) =>
                    `${source}: ${bonuses.length} bonuses`
                )
            );
        } else {
            console.log('[AbilityScoreManager] No bonus groups found');
        }

        return bonusGroups;
    }

    /**
     * Gets the character's ability score method
     * @returns {string} The ability score method ('pointBuy', 'standardArray', or 'custom')
     */
    getAbilityScoreMethod() {
        const character = characterHandler.currentCharacter;
        if (!character || !character.variantRules) return 'custom';
        const method = character.variantRules.abilityScoreMethod || 'custom';
        console.log('[AbilityScoreManager] Current ability score method:', method);
        return method;
    }

    /**
     * Checks if the current ability score method is Point Buy
     * @returns {boolean} True if using Point Buy
     */
    isPointBuy() {
        const method = this.getAbilityScoreMethod();
        const result = method === 'pointBuy';
        console.log('[AbilityScoreManager] isPointBuy check:', result);
        return result;
    }

    /**
     * Checks if the current ability score method is Standard Array
     * @returns {boolean} True if using Standard Array
     */
    isStandardArray() {
        const method = this.getAbilityScoreMethod();
        const result = method === 'standardArray';
        console.log('[AbilityScoreManager] isStandardArray check:', result);
        return result;
    }

    /**
     * Checks if the current ability score method is Custom
     * @returns {boolean} True if using Custom
     */
    isCustom() {
        return this.getAbilityScoreMethod() === 'custom';
    }

    /**
     * Gets the point cost for a specific ability score in Point Buy
     * @param {number} score - The ability score
     * @returns {number} The point cost, or -1 if invalid
     */
    getPointCost(score) {
        return this.pointBuyCosts.get(score) ?? -1;
    }

    /**
     * Calculates total points used in Point Buy
     * @returns {number} Total points used
     */
    calculateUsedPoints() {
        const character = characterHandler.currentCharacter;
        if (!character) return 0;

        let total = 0;
        for (const ability of this.abilityScores) {
            const baseScore = this.getBaseScore(ability);
            const cost = this.getPointCost(baseScore);
            if (cost >= 0) {
                total += cost;
            }
        }

        this.usedPoints = total;
        return total;
    }

    /**
     * Gets remaining points in Point Buy
     * @returns {number} Remaining points
     */
    getRemainingPoints() {
        return this.maxPoints - this.calculateUsedPoints();
    }

    /**
     * Initializes ability scores for a new character based on the selected method
     */
    initializeAbilityScores() {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        const method = this.getAbilityScoreMethod();
        console.log('[AbilityScoreManager] Initializing ability scores using method:', method);

        switch (method) {
            case 'pointBuy':
                // Default all scores to 8 (0 points)
                for (const ability of this.abilityScores) {
                    character.abilityScores[ability] = 8;
                }
                break;

            case 'standardArray':
                // Clear tracking of assigned values
                this.assignedStandardValues = new Set();
                // Immediately initialize the standard array
                this.initializeStandardArrayAssignment();
                break;

            default:
                // Default all scores to 8 for custom method as well
                for (const ability of this.abilityScores) {
                    character.abilityScores[ability] = 8;
                }
                break;
        }

        this._notifyAbilityScoresChanged();
    }

    /**
     * Update a base ability score
     * @param {string} ability - The ability to update
     * @param {number} value - The new value
     */
    updateBaseScore(ability, value) {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        const method = this.getAbilityScoreMethod();
        const currentValue = character.abilityScores[ability];

        console.log(`[AbilityScoreManager] Updating ${ability} from ${currentValue} to ${value} with method ${method}`);

        if (method === 'pointBuy') {
            // Check if the new value is valid for Point Buy
            if (value < 8 || value > 15) {
                const message = '[AbilityScoreManager] Invalid value for Point Buy';
                console.log(message, value);
                return;
            }

            // Calculate point change
            const currentCost = this.getPointCost(currentValue);
            const newCost = this.getPointCost(value);
            const pointChange = newCost - currentCost;

            // Calculate total used points
            const currentUsedPoints = this.calculateUsedPoints();

            console.log(`[AbilityScoreManager] Point Buy - Current cost: ${currentCost}, New cost: ${newCost}, Change: ${pointChange}, Total used: ${currentUsedPoints}/${this.maxPoints}`);

            // Check if we have enough points
            if (currentUsedPoints + pointChange > this.maxPoints) {
                console.log('[AbilityScoreManager] Not enough points for this change, would exceed maximum');
                return;
            }

            // Update the score
            character.abilityScores[ability] = value;

            // Recalculate used points
            this.calculateUsedPoints();

        } else if (method === 'standardArray') {
            // First, check if we're removing a value (setting to a non-standard array value)
            if (this.standardArray.includes(currentValue)) {
                this.assignedStandardValues.delete(currentValue);
                console.log(`[AbilityScoreManager] Standard Array - Removed ${currentValue} from assigned values`);
            }

            // Check if the new value is in the standard array
            if (!this.standardArray.includes(value)) {
                const message = '[AbilityScoreManager] Value is not in the standard array';
                console.log(message, value);
                return;
            }

            // Check if the value is already assigned to another ability
            if (this.assignedStandardValues.has(value) && character.abilityScores[ability] !== value) {
                // Find which ability currently has this value and swap it
                let otherAbility = null;
                for (const ab of this.abilityScores) {
                    if (ab !== ability && character.abilityScores[ab] === value) {
                        otherAbility = ab;
                        break;
                    }
                }

                if (otherAbility) {
                    console.log(`[AbilityScoreManager] Swapping ${value} from ${otherAbility} to ${ability}, and ${currentValue} to ${otherAbility}`);

                    // Swap the values between the two abilities
                    character.abilityScores[otherAbility] = currentValue;
                    character.abilityScores[ability] = value;

                    // The assigned values set doesn't change, just the assignments
                    if (this.standardArray.includes(currentValue)) {
                        this.assignedStandardValues.add(currentValue);
                    }
                    this.assignedStandardValues.add(value);

                    console.log('[AbilityScoreManager] Standard Array - After swap:',
                        Object.entries(character.abilityScores).map(([ab, val]) => `${ab}: ${val}`).join(', '));
                } else {
                    console.log('[AbilityScoreManager] Could not find ability with value', value);
                    return;
                }
            } else {
                // Update the score and track the assigned value
                character.abilityScores[ability] = value;
                this.assignedStandardValues.add(value);
                console.log('[AbilityScoreManager] Standard Array - Assigned value to ability:', value, ability);
                console.log('[AbilityScoreManager] Standard Array - Assigned values:', Array.from(this.assignedStandardValues));
            }

        } else {
            // For custom method, just enforce the normal limits (3-20)
            if (value >= 3 && value <= 20) {
                character.abilityScores[ability] = value;
            }
        }

        this._notifyAbilityScoresChanged();
    }

    /**
     * Notify listeners that ability scores have changed
     * @private
     */
    _notifyAbilityScoresChanged() {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        const event = new CustomEvent('abilityScoresChanged', {
            detail: { character }
        });
        document.dispatchEvent(event);
    }

    /**
     * Gets the remaining available standard array values
     * @returns {Array<number>} Array of available values
     */
    getAvailableStandardArrayValues() {
        return this.standardArray.filter(value => !this.assignedStandardValues.has(value));
    }

    /**
     * Updates the tracking of assigned standard array values based on current character
     */
    updateAssignedStandardArrayValues() {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        this.assignedStandardValues = new Set();
        for (const ability of this.abilityScores) {
            const value = character.abilityScores[ability];
            if (this.standardArray.includes(value)) {
                this.assignedStandardValues.add(value);
            }
        }

        console.log('[AbilityScoreManager] Updated assigned standard array values:',
            Array.from(this.assignedStandardValues));
        console.log('[AbilityScoreManager] Available standard array values:',
            this.getAvailableStandardArrayValues());
    }

    /**
     * Resets state for the currently selected ability score method
     * This should be called when a character is loaded to ensure UI elements reflect the correct method
     */
    resetAbilityScoreMethod() {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        const method = character.variantRules?.abilityScoreMethod;
        console.log('[AbilityScoreManager] Resetting for ability score method:', method);

        // Clear tracking data
        this.assignedStandardValues = new Set();
        this.usedPoints = 0;

        // Initialize based on method
        if (method === 'standardArray') {
            this.updateAssignedStandardArrayValues();

            // Check if all standard array values are assigned correctly
            const allValuesAssigned = this.standardArray.every(value =>
                Array.from(this.abilityScores).some(ability =>
                    character.abilityScores[ability] === value
                )
            );

            // If not all values are assigned correctly, do initial assignment
            if (!allValuesAssigned) {
                this.initializeStandardArrayAssignment();
            }

            console.log('[AbilityScoreManager] Reset standard array with values:',
                Array.from(this.assignedStandardValues));
        } else if (method === 'pointBuy') {
            const points = this.calculateUsedPoints();
            console.log('[AbilityScoreManager] Reset point buy with points:', points);
        }

        // Notify listeners of the reset
        this._notifyAbilityScoresChanged();
    }

    /**
     * Initialize standard array assignment for a new character
     * Distributes standard array values to abilities if none are assigned yet
     */
    initializeStandardArrayAssignment() {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        console.log('[AbilityScoreManager] Initializing standard array assignment');

        // Copy values to avoid modifying original array
        const valuesToAssign = [...this.standardArray];

        // Simple default assignment - sorted from highest to lowest values
        const defaultAssignment = {
            'strength': valuesToAssign[0],     // 15
            'dexterity': valuesToAssign[1],    // 14
            'constitution': valuesToAssign[2], // 13
            'wisdom': valuesToAssign[3],       // 12
            'intelligence': valuesToAssign[4], // 10
            'charisma': valuesToAssign[5]      // 8
        };

        // Apply the default assignment
        for (const [ability, value] of Object.entries(defaultAssignment)) {
            character.abilityScores[ability] = value;
            this.assignedStandardValues.add(value);
        }

        console.log('[AbilityScoreManager] Standard array initialized:',
            Object.entries(character.abilityScores).map(([ab, val]) => `${ab}: ${val}`).join(', '));

        // Make sure the change is reflected in the UI
        this._notifyAbilityScoresChanged();
    }
}

export const abilityScoreManager = AbilityScoreManager.getInstance(); 