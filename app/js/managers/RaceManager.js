/**
 * RaceManager.js
 * Manages race-related functionality for the D&D Character Creator
 */

import { TextProcessor } from '../utils/TextProcessor.js';
import { Race } from '../models/Race.js';
import { Subrace } from '../models/Subrace.js';
import { AbilityScoreUI } from '../ui/AbilityScoreUI.js';
import { RaceUI } from '../ui/RaceUI.js';

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
            const races = await window.dndDataLoader.loadRaces();
            const race = races.find(r => r.id === raceId);

            if (!race || !race.subraces || race.subraces.length === 0) {
                return [];
            }

            return race.subraces.map(subrace => ({
                id: subrace.id || `${race.id}-${subrace.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: subrace.name,
                source: subrace.source || race.source,
                ability: subrace.ability || [],
                entries: subrace.entries || [],
                parentRace: race
            }));
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
            console.log('[RaceManager] Setting race:', raceId, 'subrace:', subraceId);

            // Clear existing racial features
            this.clearRacialFeatures();
            console.log('[RaceManager] Cleared racial features');

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

            console.log('[RaceManager] Found race data:', race);
            console.log('[RaceManager] Race ability scores:', race.ability);

            // Set new race
            this.selectedRace = race;

            // Apply racial features
            await this.applyRaceFeatures(race, 'Race');

            // Handle subrace if provided
            if (subraceId) {
                const subraces = await this.getAvailableSubraces(raceId);
                const subrace = subraces.find(s => s.id === subraceId);

                if (subrace) {
                    console.log('[RaceManager] Found subrace data:', subrace);
                    console.log('[RaceManager] Subrace ability scores:', subrace.ability);
                    this.selectedSubrace = subrace;
                    await this.applyRaceFeatures(subrace, 'Subrace');
                } else {
                    console.warn(`Subrace not found: ${subraceId}`);
                    this.selectedSubrace = null;
                }
            } else {
                this.selectedSubrace = null;
            }

            // Update UI components
            const abilityScoreUI = document.querySelector('.ability-score-container');
            console.log('[RaceManager] Found ability score container:', !!abilityScoreUI);
            if (abilityScoreUI) {
                console.log('[RaceManager] Current ability scores:', this.character.abilityScores);
                console.log('[RaceManager] Current ability bonuses:', this.character.abilityBonuses);
                const abilityScoreComponent = new AbilityScoreUI(this.character);
                abilityScoreComponent.update();
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
        console.log('[RaceManager] Clearing racial features');
        console.log('[RaceManager] Before clear - Ability bonuses:', this.character.abilityBonuses);

        // Clear ability score increases
        this.character.clearAbilityBonuses('Race');
        this.character.clearAbilityBonuses('Subrace');

        console.log('[RaceManager] After clear - Ability bonuses:', this.character.abilityBonuses);

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

        console.log(`[RaceManager] Applying ${source} features for ${race.name}`);
        console.log(`[RaceManager] ${source} ability scores:`, race.ability);

        // Apply size - keep array if multiple sizes are available
        this.character.size = Array.isArray(race.size) ? race.size : [race.size || RaceManager.DEFAULT_SIZE[0]];

        // Apply speed
        this.character.speed = race.speed || { ...RaceManager.DEFAULT_SPEED };

        // Clear previous ability bonuses from this source
        console.log(`[RaceManager] Before clearing ${source} ability bonuses:`, this.character.abilityBonuses);
        this.character.clearAbilityBonuses(source);
        console.log(`[RaceManager] After clearing ${source} ability bonuses:`, this.character.abilityBonuses);

        // Apply ability score increases
        if (race.ability && Array.isArray(race.ability)) {
            console.log(`[RaceManager] Processing ability increases for ${source}:`, race.ability);

            for (const abilityIncrease of race.ability) {
                if (typeof abilityIncrease === 'object') {
                    // First apply any fixed bonuses in the object
                    const abilityMap = {
                        'str': 'strength',
                        'dex': 'dexterity',
                        'con': 'constitution',
                        'int': 'intelligence',
                        'wis': 'wisdom',
                        'cha': 'charisma'
                    };

                    for (const [shortName, value] of Object.entries(abilityIncrease)) {
                        if (typeof value === 'number') {
                            const ability = abilityMap[shortName] || shortName;
                            this.character.addAbilityBonus(ability, value, source);
                        }
                    }

                    // Then handle any choices in the same object
                    if (abilityIncrease.choose || abilityIncrease.mode === 'choose') {
                        const choiceConfig = abilityIncrease.choose || abilityIncrease;
                        const count = choiceConfig.count || 1;
                        const amount = choiceConfig.amount || 1;

                        // For each count, add a separate choice
                        for (let i = 0; i < count; i++) {
                            this.character.addPendingChoice('ability', {
                                source: `${source} Choice ${i + 1}`,
                                type: 'ability',
                                count: 1, // Each choice is individual
                                from: choiceConfig.from.map(shortName => abilityMap[shortName] || shortName),
                                amount
                            });
                        }
                    }
                }
            }
        }

        // Apply features
        if (race.features) {
            for (const [key, value] of Object.entries(race.features)) {
                this.character.features[key] = value;
            }
        }

        // Apply resistances
        if (race.resistances) {
            for (const resistance of race.resistances) {
                // Handle both string and object resistances
                const resistanceValue = typeof resistance === 'string' ?
                    resistance :
                    (resistance.resist || resistance.name || resistance.type);

                if (resistanceValue) {
                    this.character.addResistance(resistanceValue.toLowerCase(), source);
                }
            }
        }

        // Apply entries as traits
        if (race.entries) {
            for (const entry of race.entries) {
                if (entry.type === 'entries' && entry.name) {
                    const description = Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries;
                    this.character.addTrait(entry.name, description, source);
                }
            }
        }

        // Apply languages
        if (race.source === 'XPHB') {
            // XPHB races know Common and 2 normal languages of their choice
            this.character.addLanguage('Common', source);
            this.character.addPendingChoice('language', {
                source,
                type: 'languages',
                count: 2,
                from: 'normal',
                description: 'Choose two normal languages'
            });
        } else if (race.languages) {
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

        // Apply spells
        if (race.spells) {
            for (const spell of race.spells) {
                if (this.character.spells) {
                    await this.character.spells.addSpell(spell.id || spell, source);
                }
            }
        }

        // Check for and handle ability score choices
        if (this.hasPendingChoices()) {
            const abilityScoreContainer = document.querySelector('.ability-score-container');
            if (abilityScoreContainer) {
                const raceUIInstance = new RaceUI(this.character);
                raceUIInstance.checkRaceAbilityChoices();
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