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
     * Update a base ability score
     * @param {string} ability - The ability to update
     * @param {number} value - The new value
     */
    updateBaseScore(ability, value) {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        // Base score cannot exceed 20 or go below 3
        if (value >= 3 && value <= 20) {
            character.abilityScores[ability] = value;
            this._notifyAbilityScoresChanged();
        }
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
}

export const abilityScoreManager = AbilityScoreManager.getInstance(); 