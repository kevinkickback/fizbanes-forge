/**
 * AbilityScoreManager.js
 * Manages ability score state and calculations
 */
import { eventEmitter } from '../utils/EventEmitter.js';
import { characterHandler } from '../utils/characterHandler.js';

/**
 * @typedef {Object} AbilityChoice
 * @property {string} ability - The ability name
 * @property {number} value - The bonus value
 */

/**
 * Manages D&D character ability scores
 */
class AbilityScoreManager {
    constructor() {
        this._allAbilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

        // Point buy costs for ability scores
        this._pointBuyCosts = new Map([
            [8, 0],
            [9, 1],
            [10, 2],
            [11, 3],
            [12, 4],
            [13, 5],
            [14, 7],
            [15, 9]
        ]);

        // Standard array values that can be assigned to abilities
        this._standardArrayValues = [15, 14, 13, 12, 10, 8];
        this._assignedStandardArrayValues = {};

        // Map to store ability choices
        this.abilityChoices = new Map();

        // Subscribe to character changes
        eventEmitter.on('character:changed', this._handleCharacterChanged.bind(this));
    }

    /**
     * Handler for character change events
     * @private
     */
    _handleCharacterChanged() {
        const character = characterHandler.getCurrentCharacter();
        if (!character) return;

        // Reset assigned values when character changes
        this._assignedStandardArrayValues = {};

        // Initialize any ability-related state for the new character
        this._notifyAbilityScoresChanged();
    }

    /**
     * Normalizes an ability name to lowercase
     * @param {string} abilityName - The ability name to normalize
     * @returns {string} - The normalized ability name
     */
    normalizeAbilityName(abilityName) {
        // Check if abilityName is a string before calling toLowerCase
        if (typeof abilityName !== 'string') {
            console.warn(`Expected string for ability name but got ${typeof abilityName}:`, abilityName);
            return '';
        }
        return abilityName ? abilityName.toLowerCase() : '';
    }

    /**
     * Gets a list of all abilities
     * @returns {string[]} - Array of ability names
     */
    getAllAbilities() {
        return [...this._allAbilities];
    }

    /**
     * Gets the base score for an ability
     * @param {string} ability - The ability name
     * @returns {number} - The base ability score
     */
    getBaseScore(ability) {
        const normalizedAbility = this.normalizeAbilityName(ability);
        const character = characterHandler.getCurrentCharacter();

        if (!character) return 8; // Default base score

        // Get the ability score from the character
        const abilityScore = character.abilityScores?.[normalizedAbility];

        // Handle both formats: direct number or object with score property
        if (abilityScore === undefined) {
            return 8;
        }

        if (typeof abilityScore === 'number') {
            return abilityScore;
        }

        if (abilityScore && typeof abilityScore.score === 'number') {
            return abilityScore.score;
        }

        return 8; // Default fallback
    }

    /**
     * Gets the total score for an ability including all bonuses
     * @param {string} ability - The ability name
     * @returns {number} - The total ability score
     */
    getTotalScore(ability) {
        const normalizedAbility = this.normalizeAbilityName(ability);
        const character = characterHandler.getCurrentCharacter();

        if (!character) return 8;

        // Start with base score
        let totalScore = this.getBaseScore(normalizedAbility);

        // Add racial bonuses
        if (character.race?.abilityBonuses && typeof character.race.abilityBonuses[normalizedAbility] === 'number') {
            totalScore += character.race.abilityBonuses[normalizedAbility];
        }

        // Add racial choice bonuses
        if (character.race?.abilityChoices) {
            for (const choice of character.race.abilityChoices) {
                if (choice.ability === normalizedAbility) {
                    totalScore += choice.value;
                }
            }
        }

        // Add class bonuses
        if (character.class?.abilityBonuses && typeof character.class.abilityBonuses[normalizedAbility] === 'number') {
            totalScore += character.class.abilityBonuses[normalizedAbility];
        }

        // Add all other ability bonuses from any source
        if (character.abilityBonuses && Array.isArray(character.abilityBonuses[normalizedAbility])) {
            const bonuses = character.abilityBonuses[normalizedAbility];
            for (const bonus of bonuses) {
                if (typeof bonus.value === 'number') {
                    totalScore += bonus.value;
                }
            }
        }

        return totalScore;
    }

    /**
     * Calculates the ability modifier based on the total score
     * @param {string} ability - The ability name
     * @returns {number} - The ability modifier
     */
    getModifier(ability) {
        const totalScore = this.getTotalScore(ability);
        return Math.floor((totalScore - 10) / 2);
    }

    /**
     * Gets modifier string (e.g., "+3" or "-1")
     * @param {string} ability - The ability name
     * @returns {string} - The formatted modifier string
     */
    getModifierString(ability) {
        const mod = this.getModifier(ability);
        return mod >= 0 ? `+${mod}` : `${mod}`;
    }

    /**
     * Updates the ability score for a character
     * @param {string} ability - The ability name
     * @param {number} score - The new score value
     */
    updateAbilityScore(ability, score) {
        const normalizedAbility = this.normalizeAbilityName(ability);
        const character = characterHandler.getCurrentCharacter();

        if (!character) {
            console.error('No character selected for ability score update');
            return;
        }

        // Initialize ability scores object if it doesn't exist
        if (!character.abilityScores) {
            character.abilityScores = {};
        }

        // Store directly as a number rather than as an object with score property
        character.abilityScores[normalizedAbility] = Number.parseInt(score, 10);

        // Notify listeners about the change
        this._notifyAbilityScoresChanged();
    }

    /**
     * Gets the point cost for a specific ability score
     * @param {number} score - The ability score
     * @returns {number|null} - The point cost or null if invalid
     */
    getPointCost(score) {
        return this._pointBuyCosts.get(score) ?? null;
    }

    /**
     * Gets an array of valid scores for point buy
     * @returns {number[]} - Array of valid scores
     */
    getValidPointBuyScores() {
        return Array.from(this._pointBuyCosts.keys()).sort((a, b) => a - b);
    }

    /**
     * Calculates total points used in point buy
     * @returns {number} - Total points used
     */
    getUsedPoints() {
        const character = characterHandler.getCurrentCharacter();
        if (!character) return 0;

        let totalUsed = 0;

        for (const ability of this._allAbilities) {
            const baseScore = this.getBaseScore(ability);
            const cost = this.getPointCost(baseScore) || 0;
            totalUsed += cost;
        }

        return totalUsed;
    }

    /**
     * Gets the maximum points allowed for point buy
     * @returns {number} - Maximum point buy points
     */
    getMaxPoints() {
        return 27; // Standard D&D 5e point buy limit
    }

    /**
     * Gets remaining points for point buy
     * @returns {number} - Remaining point buy points
     */
    getRemainingPoints() {
        return this.getMaxPoints() - this.getUsedPoints();
    }

    /**
     * Gets the standard array values
     * @returns {number[]} - The standard array values
     */
    getStandardArrayValues() {
        return [...this._standardArrayValues];
    }

    /**
     * Checks if a standard array value is already assigned
     * @param {number} value - The value to check
     * @returns {boolean} - True if already assigned
     */
    isStandardArrayValueAssigned(value) {
        return Object.values(this._assignedStandardArrayValues).includes(value);
    }

    /**
     * Assigns a standard array value to an ability
     * @param {string} ability - The ability name
     * @param {number} value - The standard array value
     * @returns {boolean} - True if assignment was successful
     */
    assignStandardArrayValue(ability, value) {
        const normalizedAbility = this.normalizeAbilityName(ability);

        // Check if the value is in the standard array
        if (!this._standardArrayValues.includes(value)) {
            console.error(`Value ${value} is not in the standard array`);
            return false;
        }

        // Check if this value is already assigned to another ability
        if (this.isStandardArrayValueAssigned(value) &&
            this._assignedStandardArrayValues[normalizedAbility] !== value) {
            console.error(`Value ${value} is already assigned to another ability`);
            return false;
        }

        // If this ability already has a value, remove it from assignedValues
        if (this._assignedStandardArrayValues[normalizedAbility]) {
            // No need to do anything, it will be overwritten
        }

        // Assign the value
        this._assignedStandardArrayValues[normalizedAbility] = value;

        // Update the ability score
        this.updateAbilityScore(normalizedAbility, value);

        return true;
    }

    /**
     * Updates the tracking of assigned standard array values based on current character
     */
    updateAssignedStandardArrayValues() {
        const character = characterHandler.getCurrentCharacter();
        if (!character) return;

        // Clear and update the assigned values set
        this._assignedStandardArrayValues = {};

        // Track which values from the standard array are being used
        for (const ability of this._allAbilities) {
            const value = character.abilityScores?.[ability];
            if (this._standardArrayValues.includes(value)) {
                this._assignedStandardArrayValues[ability] = value;
            }
        }

        // Debug the assigned values
        console.debug("Standard array assigned values:", this._assignedStandardArrayValues);
    }

    /**
     * Notify listeners that ability scores have changed
     * @private
     */
    _notifyAbilityScoresChanged() {
        const character = characterHandler.getCurrentCharacter();
        if (!character) return;

        const event = new CustomEvent('abilityScoresChanged', {
            detail: { character }
        });
        document.dispatchEvent(event);
    }

    /**
     * Sets ability score bonuses from racial choices
     * @param {AbilityChoice[]} choices - Array of ability choices
     */
    setRacialAbilityChoices(choices) {
        const character = characterHandler.getCurrentCharacter();
        if (!character?.race) {
            console.error('No character or race selected for ability choice');
            return;
        }

        // Save the choices to the character
        character.race.abilityChoices = choices;

        // Notify listeners about the change
        this._notifyAbilityScoresChanged();
    }

    /**
     * Get ability score bonuses grouped by source
     * @returns {Map<string, Map<string, number>>} Map of bonus groups by source
     */
    getBonusGroups() {
        const character = characterHandler.getCurrentCharacter();
        if (!character) {
            return new Map();
        }

        const groups = new Map();

        // Group bonuses by source for each ability
        for (const ability of this._allAbilities) {
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
     * Get pending ability score choices that need to be made
     * @returns {Array<Object>} Array of pending ability choices
     */
    getPendingChoices() {
        const character = characterHandler.getCurrentCharacter();
        if (!character || !character.getPendingAbilityChoices) {
            return [];
        }

        // Get all ability-related pending choices
        const pendingChoices = character.getPendingAbilityChoices().filter(choice => {
            return choice.type === 'ability';
        });

        // Ensure each choice has all required fields
        const formattedChoices = pendingChoices.map(choice => ({
            type: 'ability',
            amount: choice.amount || 1,
            count: choice.count || 1,
            choices: choice.choices || [],
            source: choice.source || 'Race Choice'
        }));

        console.debug('AbilityScoreManager.getPendingChoices:', formattedChoices);
        return formattedChoices;
    }

    /**
     * Get available abilities for a choice
     * @param {number} currentChoiceIndex - The index of the current choice
     * @returns {Array<string>} Array of available ability names
     */
    getAvailableAbilities(currentChoiceIndex) {
        const allAbilities = [...this._allAbilities];
        const selectedAbilities = new Set();
        const character = characterHandler.getCurrentCharacter();
        if (!character) return allAbilities;

        // Get all pending choices
        const pendingChoices = character.getPendingAbilityChoices?.() || [];
        const currentChoice = pendingChoices[currentChoiceIndex];

        // Collect all selected abilities except the current one
        for (const [index, ability] of this.abilityChoices.entries()) {
            if (index !== currentChoiceIndex && ability) {
                selectedAbilities.add(ability);
            }
        }

        // Get abilities that already have racial bonuses
        const abilitiesWithRacialBonuses = new Set();
        for (const ability of this._allAbilities) {
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
        // 2. Don't already have racial bonuses (if racial choice)
        // 3. Are in the allowed choices list for this choice
        return availableAbilities.filter(ability =>
            !selectedAbilities.has(ability) &&
            !(currentChoice?.source?.startsWith('Race') && abilitiesWithRacialBonuses.has(ability))
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
        const character = characterHandler.getCurrentCharacter();
        if (!character) return;

        // Clear the specific choice's bonus
        character.clearAbilityBonuses?.(source);

        // Update stored choices
        if (ability) {
            this.abilityChoices.set(choiceIndex, ability);
            character.addAbilityBonus?.(ability, bonus, source);
        } else {
            this.abilityChoices.delete(choiceIndex);
        }

        // Notify listeners of the change
        this._notifyAbilityScoresChanged();
    }

    /**
     * Gets the maximum allowed ability score
     * @returns {number} Maximum ability score
     */
    get maxScore() {
        return 20; // D&D 5e maximum ability score (without magical items)
    }

    /**
     * Gets the minimum allowed ability score
     * @returns {number} Minimum ability score
     */
    get minScore() {
        return 3; // D&D 5e minimum ability score
    }

    /**
     * Gets the maximum points for point buy
     * @returns {number} Maximum points
     */
    get maxPoints() {
        return 27; // Standard D&D 5e point buy limit
    }

    /**
     * Gets available standard array values (that aren't assigned)
     * @returns {Array<number>} Array of available values
     */
    getAvailableStandardArrayValues() {
        const allValues = [...this._standardArrayValues];
        const usedValues = Object.values(this._assignedStandardArrayValues);

        const availableValues = allValues.filter(value => !usedValues.includes(value));
        return availableValues;
    }

    /**
     * Gets the list of assigned standard array values
     * @returns {Array} Array of assigned values
     */
    get assignedStandardValues() {
        return Object.entries(this._assignedStandardArrayValues);
    }

    /**
     * Resets ability score method-specific state
     * Used when switching between ability score methods
     */
    resetAbilityScoreMethod() {
        const character = characterHandler.getCurrentCharacter();
        if (!character) return;

        // Initialize variant rules if needed
        if (!character.variantRules) {
            character.variantRules = {};
        }

        const method = character.variantRules.abilityScoreMethod;
        console.debug(`Resetting ability score method to: ${method}`);

        // Reset state based on the method
        if (method === 'standardArray') {
            // For standard array, reset assignments
            this._assignedStandardArrayValues = {};

            // Traditional D&D order assignment - always use this for consistency
            const traditionalOrder = {
                'strength': 15,      // STR: 15
                'dexterity': 14,     // DEX: 14
                'constitution': 13,  // CON: 13
                'intelligence': 12,  // INT: 12
                'wisdom': 10,        // WIS: 10
                'charisma': 8        // CHA: 8
            };

            console.debug('Applying traditional D&D ability score order');

            // Always apply the traditional order for consistency and predictability
            for (const [ability, value] of Object.entries(traditionalOrder)) {
                console.debug(`Setting ${ability} to ${value}`);

                // Update the character's ability score
                this.updateAbilityScore(ability, value);

                // Record the assignment
                this._assignedStandardArrayValues[ability] = value;
            }

            console.debug("Standard array assignments complete:", this._assignedStandardArrayValues);
        } else if (method === 'pointBuy') {
            // For point buy, ensure scores are within valid range (8-15)
            for (const ability of this._allAbilities) {
                const score = character.abilityScores?.[ability];

                // If score is out of range, set to default
                if (score < 8 || score > 15) {
                    this.updateAbilityScore(ability, 8);
                }
            }
        }

        // Notify listeners about the change
        this._notifyAbilityScoresChanged();
    }
}

// Create and export singleton instance
export const abilityScoreManager = new AbilityScoreManager(); 