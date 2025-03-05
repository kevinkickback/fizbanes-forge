/**
 * race-manager.js
 * Manages race-related functionality for the D&D Character Creator
 */

class RaceManager {
    constructor(character) {
        this.character = character;
        this.selectedRace = null;
        this.selectedSubrace = null;
        this.abilityChoices = new Map();
    }

    /**
     * Sets the character's race and applies racial features
     * @param {string} raceId - The ID of the race to set
     * @param {string} subraceId - Optional ID of the subrace to set
     * @returns {Promise<boolean>} - True if race was set successfully
     */
    async setRace(raceId, subraceId = null) {
        try {
            // Load races data
            const races = await window.dndDataLoader.loadRaces();
            const race = races.find(r => r.id === raceId);
            if (!race) {
                throw new Error(`Race ${raceId} not found`);
            }

            // Clear existing racial features
            this.clearRacialFeatures();

            // Set new race
            this.selectedRace = race;

            // Handle subrace if specified
            if (subraceId && race.subraces) {
                const subrace = race.subraces.find(sr => sr.id === subraceId);
                if (subrace) {
                    this.selectedSubrace = subrace;
                }
            } else {
                this.selectedSubrace = null;
            }

            // Apply racial features
            await this.applyRacialFeatures();

            // Update character sheet
            if (window.updateCharacterSheet) {
                window.updateCharacterSheet();
            }

            return true;
        } catch (error) {
            console.error('Error setting race:', error);
            window.showNotification(`Error setting race: ${error.message}`, 'danger');
            return false;
        }
    }

    /**
     * Clears all racial features from the character
     */
    clearRacialFeatures() {
        // Clear ability score increases
        this.character.clearAbilityBonuses('Race');
        this.character.clearAbilityBonuses('Subrace');

        // Clear proficiencies
        this.character.clearProficiencies('Race');
        this.character.clearProficiencies('Subrace');

        // Clear languages
        this.character.clearLanguages('Race');
        this.character.clearLanguages('Subrace');

        // Clear speed
        this.character.speed = { walk: 30 };

        // Clear size
        this.character.size = 'M';

        // Clear darkvision
        this.character.features.darkvision = 0;

        // Clear resistances
        this.character.clearResistances('Race');
        this.character.clearResistances('Subrace');

        // Clear traits
        this.character.clearTraits('Race');
        this.character.clearTraits('Subrace');

        // Clear ability choices
        this.abilityChoices.clear();
    }

    /**
     * Applies racial features to the character
     */
    async applyRacialFeatures() {
        if (!this.selectedRace) return;

        // Apply base race features
        await this.applyRaceFeatures(this.selectedRace, 'Race');

        // Apply subrace features if any
        if (this.selectedSubrace) {
            await this.applyRaceFeatures(this.selectedSubrace, 'Subrace');
        }
    }

    /**
     * Applies features from a race or subrace
     * @param {Object} race - The race or subrace object
     * @param {string} source - The source of the features ('Race' or 'Subrace')
     */
    async applyRaceFeatures(race, source) {
        // Apply size
        if (race.size) {
            this.character.size = race.size;
        }

        // Apply speed
        if (race.speed) {
            Object.assign(this.character.speed, race.speed);
        }

        // Apply ability scores
        if (race.ability) {
            for (const ability of race.ability) {
                if (ability.mode === 'fixed') {
                    // Apply fixed ability score increases
                    for (const score of ability.scores) {
                        this.character.addAbilityBonus(score, ability.amount, source);
                    }
                } else if (ability.mode === 'choose') {
                    // Store ability choices for UI
                    this.abilityChoices.set(source, {
                        count: ability.count || 1,
                        amount: ability.amount || 1,
                        from: ability.from || []
                    });
                }
            }
        }

        // Apply proficiencies
        if (race.proficiencies) {
            for (const [type, profs] of Object.entries(race.proficiencies)) {
                for (const prof of profs) {
                    this.character.addProficiency(type, prof, source);
                }
            }
        }

        // Apply languages
        if (race.languages) {
            for (const language of race.languages) {
                this.character.addLanguage(language, source);
            }
        }

        // Apply darkvision
        if (race.features?.darkvision) {
            this.character.features.darkvision = Math.max(
                this.character.features.darkvision,
                race.features.darkvision
            );
        }

        // Apply resistances
        if (race.features?.resistances) {
            for (const resistance of race.features.resistances) {
                this.character.addResistance(resistance, source);
            }
        }

        // Apply traits
        if (race.traits) {
            for (const trait of race.traits) {
                this.character.addTrait(trait.name, await processText(trait.description), source);
            }
        }
    }

    /**
     * Makes ability score choices for the race/subrace
     * @param {Object} choices - Map of ability scores to their bonuses
     * @param {string} source - The source of the choices ('Race' or 'Subrace')
     * @returns {boolean} - True if choices were applied successfully
     */
    applyAbilityChoices(choices, source) {
        const availableChoice = this.abilityChoices.get(source);
        if (!availableChoice) return false;

        // Validate choices
        const selectedCount = Object.keys(choices).length;
        if (selectedCount !== availableChoice.count) {
            window.showNotification(
                `Please select exactly ${availableChoice.count} abilities`,
                'warning'
            );
            return false;
        }

        // Validate each choice
        for (const ability of Object.keys(choices)) {
            if (!availableChoice.from.includes(ability)) {
                window.showNotification(
                    `Invalid ability choice: ${ability}`,
                    'danger'
                );
                return false;
            }
        }

        // Apply choices
        for (const [ability, bonus] of Object.entries(choices)) {
            this.character.addAbilityBonus(ability, bonus, source);
        }

        // Clear the choice
        this.abilityChoices.delete(source);

        // Update character sheet
        if (window.updateCharacterSheet) {
            window.updateCharacterSheet();
        }

        return true;
    }

    /**
     * Gets the currently selected race name
     * @returns {string} The race name or 'None'
     */
    getCurrentRaceName() {
        if (!this.selectedRace) return 'None';
        return this.selectedSubrace ?
            `${this.selectedRace.name} (${this.selectedSubrace.name})` :
            this.selectedRace.name;
    }

    /**
     * Checks if there are pending ability score choices
     * @returns {boolean} True if there are pending choices
     */
    hasPendingChoices() {
        return this.abilityChoices.size > 0;
    }

    /**
     * Gets pending ability score choices
     * @returns {Object} Map of sources to their ability choices
     */
    getPendingChoices() {
        return Object.fromEntries(this.abilityChoices);
    }
}

// Export the RaceManager class
window.RaceManager = RaceManager; 