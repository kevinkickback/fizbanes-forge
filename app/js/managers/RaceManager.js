/**
 * RaceManager.js
 * Manages race-related functionality for the D&D Character Creator
 */

import { TextProcessor } from '../utils/TextProcessor.js';
import { Race } from '../models/Race.js';
import { Subrace } from '../models/Subrace.js';

export class RaceManager {
    // Default values matching DataLoader
    static DEFAULT_SIZE = ['M'];
    static DEFAULT_SPEED = { walk: 30 };
    static DEFAULT_ABILITY_SCORES = [];

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

            // Mark changes as unsaved
            if (window.markUnsavedChanges) {
                window.markUnsavedChanges();
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

        // Reset to defaults
        this.character.speed = { ...RaceManager.DEFAULT_SPEED };
        this.character.size = RaceManager.DEFAULT_SIZE[0];
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
        if (!race) return;

        // Apply size (use first size if multiple options are available)
        const size = Array.isArray(race.size) ? race.size[0] : (race.size || RaceManager.DEFAULT_SIZE[0]);
        this.character.size = size;

        // Apply speed (handle normalized speed object)
        if (race.speed) {
            const normalizedSpeed = typeof race.speed === 'number'
                ? { walk: race.speed }
                : Object.entries(race.speed).reduce((acc, [type, value]) => {
                    acc[type] = typeof value === 'number' ? value : (value.number || 0);
                    return acc;
                }, {});
            this.character.speed = normalizedSpeed;
        } else {
            this.character.speed = { ...RaceManager.DEFAULT_SPEED };
        }

        // Apply ability score increases
        if (race.ability && Array.isArray(race.ability)) {
            for (const abilityIncrease of race.ability) {
                if (abilityIncrease.mode === 'fixed') {
                    // Handle fixed ability scores
                    for (const ability of abilityIncrease.scores) {
                        this.character.addAbilityBonus(ability, abilityIncrease.amount, source);
                    }
                } else if (abilityIncrease.mode === 'choose') {
                    // Store choice configuration
                    this.abilityChoices.set(source, {
                        count: abilityIncrease.count || 1,
                        from: abilityIncrease.from || [],
                        amount: abilityIncrease.amount || 1
                    });
                } else {
                    // Handle legacy format
                    for (const [ability, amount] of Object.entries(abilityIncrease)) {
                        if (ability !== 'choose' && typeof amount === 'number') {
                            this.character.addAbilityBonus(ability.toLowerCase(), amount, source);
                        }
                    }
                }
            }
        }

        // Apply darkvision
        if (race.features?.darkvision || race.darkvision) {
            this.character.features.darkvision = race.features?.darkvision || race.darkvision || 0;
        }

        // Apply resistances (handle both features.resistances and resist arrays)
        const resistances = [
            ...(race.features?.resistances || []),
            ...(race.resist || [])
        ];

        for (const resistance of resistances) {
            if (typeof resistance === 'string') {
                this.character.addResistance(resistance.toLowerCase(), source);
            } else if (resistance.choose) {
                // Store resistance choices for later
                this.character.addPendingChoice('resistance', {
                    source,
                    count: resistance.choose.count || 1,
                    from: resistance.choose.from || []
                });
            } else {
                const resistanceStr = resistance.name || resistance.type;
                if (resistanceStr) {
                    this.character.addResistance(resistanceStr.toLowerCase(), source);
                }
            }
        }

        // Apply traits
        if (race.traits) {
            for (const trait of race.traits) {
                this.character.addTrait(trait.name, trait.description, source);
            }
        }

        // Apply languages
        if (race.languages) {
            for (const language of race.languages) {
                this.character.addLanguage(language, source);
            }
        }

        // Apply proficiencies
        if (race.proficiencies) {
            for (const [type, profs] of Object.entries(race.proficiencies)) {
                if (Array.isArray(profs)) {
                    for (const prof of profs) {
                        this.character.addProficiency(type, prof, source);
                    }
                } else if (profs.choose) {
                    // Store proficiency choices for later
                    this.character.addPendingChoice('proficiency', {
                        source,
                        type,
                        count: profs.choose.count || 1,
                        from: profs.choose.from || []
                    });
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
     * Checks if there are pending ability score choices
     * @returns {boolean} - True if there are pending choices
     */
    hasPendingChoices() {
        return this.abilityChoices.size > 0;
    }

    /**
     * Gets any pending ability score choices
     * @returns {Map<string, Object>} - Map of source to choice configuration
     */
    getPendingChoices() {
        return this.abilityChoices;
    }

    /**
     * Gets the currently selected race name
     * @returns {string|null} - The name of the selected race, or null if none selected
     */
    getCurrentRaceName() {
        return this.selectedRace?.name || null;
    }
} 