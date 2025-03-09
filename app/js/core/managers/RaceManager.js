/**
 * RaceManager.js
 * Manages race-related functionality for the D&D Character Creator
 */

import { TextProcessor } from '../utils/TextProcessor.js';
import { Race } from '../models/Race.js';
import { Subrace } from '../models/Subrace.js';

export class RaceManager {
    constructor(character) {
        this.character = character;
        this.selectedRace = null;
        this.selectedSubrace = null;
        this.abilityChoices = new Map();
        this.textProcessor = new TextProcessor();

        // Cache for race data
        this.raceCache = new Map();
        this.subraceCache = new Map();
    }

    /**
     * Load a race by ID
     * @param {string} raceId - The ID of the race to load
     * @returns {Promise<Race>} - The loaded race
     */
    async loadRace(raceId) {
        // Check cache first
        if (this.raceCache.has(raceId)) {
            return this.raceCache.get(raceId);
        }

        // Load race data
        const races = await window.dndDataLoader.loadRaces();
        const raceData = races.find(r => r.id === raceId);

        if (!raceData) {
            throw new Error(`Race not found: ${raceId}`);
        }

        // Create race instance
        const race = new Race(raceData);
        this.raceCache.set(raceId, race);
        return race;
    }

    /**
     * Load a subrace by ID
     * @param {string} subraceId - The ID of the subrace to load
     * @param {string} parentRaceId - The ID of the parent race
     * @returns {Promise<Subrace>} - The loaded subrace
     */
    async loadSubrace(subraceId, parentRaceId) {
        // Check cache first
        const cacheKey = `${parentRaceId}:${subraceId}`;
        if (this.subraceCache.has(cacheKey)) {
            return this.subraceCache.get(cacheKey);
        }

        // Load parent race first
        const parentRace = await this.loadRace(parentRaceId);
        const subraceData = parentRace.subraces.find(s => s.id === subraceId);

        if (!subraceData) {
            throw new Error(`Subrace not found: ${subraceId}`);
        }

        // Create subrace instance
        const subrace = new Subrace(subraceData, parentRace);
        this.subraceCache.set(cacheKey, subrace);
        return subrace;
    }

    /**
     * Get all available races
     * @returns {Promise<Race[]>} - Array of available races
     */
    async getAvailableRaces() {
        const races = await window.dndDataLoader.loadRaces();
        return races.map(raceData => new Race(raceData));
    }

    /**
     * Get all available subraces for a race
     * @param {string} raceId - The ID of the parent race
     * @returns {Promise<Subrace[]>} - Array of available subraces
     */
    async getAvailableSubraces(raceId) {
        try {
            const race = await this.loadRace(raceId);
            if (!race || !race.subraces || race.subraces.length === 0) {
                return [];
            }
            return race.subraces.map(subraceData => new Subrace(subraceData, race));
        } catch (error) {
            console.error(`Error getting subraces for race ${raceId}:`, error);
            return [];
        }
    }

    /**
     * Clear the race and subrace cache
     */
    clearCache() {
        this.raceCache.clear();
        this.subraceCache.clear();
    }

    /**
     * Sets the character's race and applies racial features
     * @param {string} raceId - The ID of the race to set
     * @param {string} subraceId - Optional ID of the subrace to set
     * @returns {Promise<boolean>} - True if race was set successfully
     */
    async setRace(raceId, subraceId = null) {
        try {
            // Clear existing racial features
            this.clearRacialFeatures();

            if (!raceId) {
                this.selectedRace = null;
                this.selectedSubrace = null;
                return true;
            }

            // Load race data
            const races = await window.dndDataLoader.loadRaces();
            const race = races.find(r => r.id === raceId);

            if (!race) {
                console.warn(`Race not found: ${raceId}`);
                return false;
            }

            // Set new race
            this.selectedRace = race;

            // Apply racial features
            await this.applyRaceFeatures(race, 'Race');

            // Handle subrace if specified
            if (subraceId && race.subraces) {
                const subrace = race.subraces.find(sr => sr.id === subraceId);
                if (subrace) {
                    this.selectedSubrace = subrace;
                    await this.applyRaceFeatures(subrace, 'Subrace');
                }
            } else {
                this.selectedSubrace = null;
            }

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
        this.character.removeProficienciesBySource('Race');
        this.character.removeProficienciesBySource('Subrace');

        // Clear languages
        this.character.removeLanguagesBySource('Race');
        this.character.removeLanguagesBySource('Subrace');

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
     * Applies racial features from the selected race and subrace
     */
    async applyRacialFeatures() {
        if (!this.selectedRace) return;

        // Apply race features
        await this.applyRaceFeatures(this.selectedRace, 'Race');

        // Apply subrace features if selected
        if (this.selectedSubrace) {
            await this.applyRaceFeatures(this.selectedSubrace, 'Subrace');
        }
    }

    /**
     * Applies features from a race or subrace
     * @param {Object} race - The race or subrace object
     * @param {string} source - The source of the features (Race or Subrace)
     */
    async applyRaceFeatures(race, source) {
        // Apply size
        if (race.size) {
            if (Array.isArray(race.size)) {
                this.character.size = race.size[0]; // Use first size option
            } else if (typeof race.size === 'string') {
                this.character.size = race.size;
            }
        }

        // Apply speed
        if (race.speed) {
            if (typeof race.speed === 'number') {
                // Handle case where speed is just a number (walking speed)
                this.character.speed = { walk: race.speed };
            } else if (typeof race.speed === 'object') {
                // Handle case where speed is an object with different movement types
                // Make sure we start with a clean speed object
                this.character.speed = {};
                for (const [type, value] of Object.entries(race.speed)) {
                    if (typeof value === 'number') {
                        this.character.speed[type] = value;
                    } else if (typeof value === 'object' && value.number) {
                        this.character.speed[type] = value.number;
                    }
                }
            }
        }

        // Apply ability score increases
        if (race.ability && Array.isArray(race.ability)) {
            console.log(`Applying ability scores for ${race.name} (${source}):`, race.ability);
            for (const abilityIncrease of race.ability) {
                console.log('Processing ability increase:', abilityIncrease);
                if (abilityIncrease.mode === 'fixed') {
                    // Handle new format with mode and scores array
                    for (const ability of abilityIncrease.scores) {
                        console.log(`Adding fixed ability bonus: ${ability} +${abilityIncrease.amount}`);
                        this.character.addAbilityBonus(ability, abilityIncrease.amount, source);
                    }
                } else if (abilityIncrease.mode === 'choose') {
                    // Store choice information for later
                    this.abilityChoices.set(source, {
                        count: abilityIncrease.count,
                        from: abilityIncrease.from,
                        amount: abilityIncrease.amount
                    });
                } else {
                    // Handle old format with direct ability mappings
                    for (const [ability, amount] of Object.entries(abilityIncrease)) {
                        const abilityLower = ability.toLowerCase();
                        if (abilityLower !== 'choose' && typeof amount === 'number') {
                            console.log(`Adding ability bonus: ${abilityLower} +${amount}`);
                            this.character.addAbilityBonus(abilityLower, amount, source);
                        }
                    }
                }
            }
        }

        // Apply languages
        if (race.languageProficiencies) {
            if (Array.isArray(race.languageProficiencies)) {
                // Handle array format
                for (const langEntry of race.languageProficiencies) {
                    if (typeof langEntry === 'string') {
                        // Direct string format
                        this.character.addLanguage(langEntry.charAt(0).toUpperCase() + langEntry.slice(1), source);
                    } else if (typeof langEntry === 'object') {
                        // Object format within array
                        for (const [lang, hasProf] of Object.entries(langEntry)) {
                            if (hasProf === true) {
                                this.character.addLanguage(lang.charAt(0).toUpperCase() + lang.slice(1), source);
                            }
                        }
                    }
                }
            } else if (typeof race.languageProficiencies === 'object') {
                // Handle direct object format
                for (const [lang, hasProf] of Object.entries(race.languageProficiencies)) {
                    if (hasProf === true) {
                        this.character.addLanguage(lang.charAt(0).toUpperCase() + lang.slice(1), source);
                    }
                }
            }
        }

        // Apply darkvision
        if (race.features?.darkvision) {
            this.character.features.darkvision = race.features.darkvision;
        } else if (race.darkvision) {
            this.character.features.darkvision = race.darkvision;
        }

        // Apply resistances
        if (race.features?.resistances) {
            for (const resistance of race.features.resistances) {
                this.character.addResistance(resistance.toLowerCase(), source);
            }
        } else if (race.resist) {
            for (const resistance of race.resist) {
                this.character.addResistance(resistance.toLowerCase(), source);
            }
        }

        // Apply traits
        if (race.entries) {
            for (const entry of race.entries) {
                if (entry.type === 'entries' && entry.name) {
                    let description;
                    if (Array.isArray(entry.entries)) {
                        description = entry.entries.map(e => {
                            if (typeof e === 'string') return e;
                            if (typeof e === 'object' && e.type === 'list') {
                                return e.items.map(item => `• ${item}`).join('\n');
                            }
                            return JSON.stringify(e);
                        }).join('\n');
                    } else {
                        description = entry.entries;
                    }
                    this.character.addTrait(entry.name, description, source);
                }
            }
        }
    }

    /**
     * Makes ability score choices for the race/subrace
     * @param {Object} choices - Map of ability scores to increase
     * @returns {boolean} - True if choices were applied successfully
     */
    applyAbilityChoices(choices) {
        try {
            if (!this.selectedRace) return false;

            // Clear previous choices
            this.character.clearAbilityBonuses('Race Choice');

            // Apply new choices
            for (const [ability, value] of Object.entries(choices)) {
                this.character.addAbilityBonus(ability, value, 'Race Choice');
            }

            return true;
        } catch (error) {
            console.error('Error applying ability choices:', error);
            return false;
        }
    }

    /**
     * Gets the currently selected race name
     * @returns {string|null} - The name of the selected race, or null if none selected
     */
    getCurrentRaceName() {
        return this.selectedRace?.name || null;
    }

    /**
     * Checks if there are pending ability score choices
     * @returns {boolean} - True if there are pending choices
     */
    hasPendingChoices() {
        if (!this.selectedRace) return false;

        // Check race ability choices
        if (this.selectedRace.ability) {
            for (const abilityIncrease of this.selectedRace.ability) {
                if (abilityIncrease.choose) return true;
            }
        }

        // Check subrace ability choices
        if (this.selectedSubrace?.ability) {
            for (const abilityIncrease of this.selectedSubrace.ability) {
                if (abilityIncrease.choose) return true;
            }
        }

        return false;
    }
} 