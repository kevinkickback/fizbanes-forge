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

        // Collect all selected abilities except the current one
        for (const [index, ability] of this.abilityChoices.entries()) {
            if (index !== currentChoiceIndex && ability) {
                selectedAbilities.add(ability);
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
        this.abilityChoices.clear();
    }

    /**
     * Get pending ability score choices
     * @returns {Array<Object>} Array of pending choices
     */
    getPendingChoices() {
        const character = characterHandler.currentCharacter;
        if (!character) {
            return [];
        }

        // Get all ability-related pending choices
        const pendingChoices = character.getPendingAbilityChoices().filter(choice => {
            return choice.type === 'ability';
        });

        return pendingChoices;
    }

    /**
     * Get ability score bonuses grouped by source
     */
    getBonusGroups() {
        const character = characterHandler.currentCharacter;
        if (!character) {
            return new Map();
        }

        const groups = new Map();

        // Group bonuses by source for each ability
        for (const ability of this.abilityScores) {
            const bonuses = character.abilityBonuses?.[ability] || [];
            if (bonuses.length === 0) continue;

            // Group by source
            for (const bonus of bonuses) {
                const source = bonus.source;
                if (!groups.has(source)) {
                    groups.set(source, new Map());
                }
                const sourceGroup = groups.get(source);
                sourceGroup.set(ability, bonus.value);
            }
        }

        return groups;
    }

    /**
     * Get the current ability score method
     * @returns {string} The current method ('pointbuy', 'standardarray', or 'custom')
     */
    getAbilityScoreMethod() {
        const character = characterHandler.currentCharacter;
        const method = character?.abilityScoreMethod || 'pointbuy';
        return method;
    }

    /**
     * Check if the current ability score method is Point Buy
     * @returns {boolean} Whether Point Buy is the current method
     */
    isPointBuy() {
        const result = this.getAbilityScoreMethod() === 'pointbuy';
        return result;
    }

    /**
     * Check if the current ability score method is Standard Array
     * @returns {boolean} Whether Standard Array is the current method
     */
    isStandardArray() {
        const result = this.getAbilityScoreMethod() === 'standardarray';
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

        // Initialize based on the method
        if (method === 'pointbuy') {
            // Default Point Buy values (all 8's)
            for (const ability of this.abilityScores) {
                character.abilityScores[ability] = 8;
            }
            this.usedPoints = 0;
        } else if (method === 'standardarray') {
            // Initialize with standard array values
            this.initializeStandardArrayAssignment();
        } else {
            // Custom: Just ensure all abilities have a valid value
            for (const ability of this.abilityScores) {
                if (!character.abilityScores[ability]) {
                    character.abilityScores[ability] = 10;
                }
            }
        }

        // Recalculate used points if using Point Buy
        if (method === 'pointbuy') {
            this.calculateUsedPoints();
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
        if (!character) return false;

        const method = this.getAbilityScoreMethod();
        const normalizedAbility = this._normalizeAbilityName(ability);
        if (!normalizedAbility) return false;

        // Get current value
        const currentValue = character.abilityScores[normalizedAbility] || 10;

        // Validate input
        if (value === undefined || value === null || Number.isNaN(value)) {
            console.warn(`Invalid value for ${ability}:`, value);
            return false;
        }

        // Different validation and handling based on the method
        if (method === 'pointbuy') {
            // Point Buy validation:
            // 1. Check if the change would exceed available points
            // 2. Check if the value is within allowed range (8-15)
            const currentCost = this.getPointCost(currentValue);
            const newCost = this.getPointCost(value);
            const pointChange = newCost - currentCost;
            const currentUsedPoints = this.calculateUsedPoints();

            if (currentUsedPoints + pointChange > this.maxPoints) {
                console.warn('Not enough points for this change, would exceed maximum');
                return false;
            }

            // Check if value is within allowed range (8-15)
            if (value < 8 || value > 15) {
                return false;
            }

            // Update the score
            character.abilityScores[normalizedAbility] = value;
            this.calculateUsedPoints();
        } else if (method === 'standardarray') {
            // Standard Array validation:
            // 1. Check if the value is in the standard array
            // 2. Handle assigning/swapping values

            // Remove current value from assigned values if it's part of standard array
            if (this.standardArray.includes(currentValue)) {
                this.assignedStandardValues.delete(currentValue);
            }

            // Validate input
            if (!this.standardArray.includes(value)) {
                console.warn("Invalid standard array value:", value);
                return false;
            }

            // If the value is already assigned to another ability, we need to swap
            if (this.assignedStandardValues.has(value)) {
                // Find which ability has this value
                let otherAbility = null;
                for (const ability of this.abilityScores) {
                    if (ability !== normalizedAbility && character.abilityScores[ability] === value) {
                        otherAbility = ability;
                        break;
                    }
                }

                if (otherAbility) {
                    // Swap the values
                    character.abilityScores[otherAbility] = currentValue;

                    // Update assigned values set
                    if (this.standardArray.includes(currentValue)) {
                        this.assignedStandardValues.add(currentValue);
                    }
                } else {
                    console.warn('Could not find ability with value', value);
                    return false;
                }
            }

            // Assign the value to the ability
            character.abilityScores[normalizedAbility] = value;
            this.assignedStandardValues.add(value);
        } else {
            // Custom validation
            // Allow any value within sane limits
            if (value < 1 || value > 30) {
                return false;
            }

            character.abilityScores[normalizedAbility] = value;
        }

        this._notifyAbilityScoresChanged();
        return true;
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
        if (!character || !this.isStandardArray()) return;

        // Clear and update the assigned values set
        this.assignedStandardValues.clear();

        for (const ability of this.abilityScores) {
            const value = character.abilityScores[ability];
            if (this.standardArray.includes(value)) {
                this.assignedStandardValues.add(value);
            }
        }

        console.debug('[AbilityScoreManager] Updated assigned standard array values:',
            Array.from(this.assignedStandardValues));
    }

    /**
     * Resets state for the currently selected ability score method
     * This should be called when a character is loaded to ensure UI elements reflect the correct method
     */
    resetAbilityScoreMethod(method) {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        // Set the new method
        character.abilityScoreMethod = method;

        // Reset appropriate things based on the method
        if (method === 'standardarray') {
            // Reset standard array
            this.assignedStandardValues.clear();
            const availableValues = [...this.standardArray];

            // Set each ability to the next available standard array value
            for (const ability of this.abilityScores) {
                // If we've used all standard array values, just use 10
                const value = availableValues.length > 0 ? availableValues.shift() : 10;
                character.abilityScores[ability] = value;

                // Add to assigned values if it's a real standard array value
                if (this.standardArray.includes(value)) {
                    this.assignedStandardValues.add(value);
                }
            }
        } else if (method === 'pointbuy') {
            // Reset point buy to all 8's
            for (const ability of this.abilityScores) {
                character.abilityScores[ability] = 8;
            }
            this.calculateUsedPoints();
        } else {
            // Custom method - keep existing values
        }

        this._notifyAbilityScoresChanged();
    }

    /**
     * Initialize standard array assignment for a new character
     * Distributes standard array values to abilities if none are assigned yet
     */
    initializeStandardArrayAssignment() {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        // Clear any existing assignments
        this.assignedStandardValues.clear();

        // Get our sorted array of standard values (highest first)
        const sortedValues = [...this.standardArray].sort((a, b) => b - a);

        // Set initial assignments - this is a very simplistic approach
        // These would be adjustable by the player later
        const assignments = [
            // Default is STR, DEX, CON, INT, WIS, CHA in that priority
            ['strength', sortedValues[0] || 10],     // Highest to STR
            ['dexterity', sortedValues[1] || 10],    // 2nd highest to DEX
            ['constitution', sortedValues[2] || 10], // 3rd highest to CON
            ['intelligence', sortedValues[3] || 10], // 4th highest to INT
            ['wisdom', sortedValues[4] || 10],       // 5th highest to WIS
            ['charisma', sortedValues[5] || 10]      // Lowest to CHA
        ];

        // Apply the assignments
        for (const [ability, value] of assignments) {
            character.abilityScores[ability] = value;
            this.assignedStandardValues.add(value);
        }
    }
}

export const abilityScoreManager = AbilityScoreManager.getInstance(); 