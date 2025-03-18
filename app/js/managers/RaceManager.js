/**
 * RaceManager.js
 * Manages race-related functionality for the D&D Character Creator
 * 
 * @typedef {Object} RaceData
 * @property {string} id - Unique identifier for the race
 * @property {string} name - Name of the race
 * @property {string} source - Source book (e.g., 'PHB', 'XPHB')
 * @property {Array} size - Array of possible sizes
 * @property {Object} speed - Movement speeds
 * @property {Array} ability - Ability score improvements
 * @property {Array} languages - Known languages
 * @property {Array} entries - Race description entries
 * @property {Array} subraces - Available subraces
 * 
 * @typedef {Object} SubraceData
 * @property {string} id - Unique identifier for the subrace
 * @property {string} name - Name of the subrace
 * @property {string} source - Source book
 * @property {Array} ability - Ability score improvements
 * @property {Array} entries - Subrace description entries
 * @property {string} parentRaceId - ID of the parent race
 */

import { Race } from '../models/Race.js';
import { Subrace } from '../models/Subrace.js';
import { RaceCard } from '../ui/RaceCard.js';
import { characterHandler } from '../utils/characterHandler.js';
import { dataLoader } from '../dataloaders/DataLoader.js';

export class RaceManager {
    // Default values matching DataLoader
    static DEFAULT_SIZE = ['M'];
    static DEFAULT_SPEED = { walk: 30 };
    static DEFAULT_ABILITY_SCORES = [];

    /**
     * Creates a new RaceManager instance
     * @param {Object} dataLoader - The DataLoader instance for loading race data
     */
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.selectedRace = null;
        this.selectedSubrace = null;
        this.abilityChoices = new Map();
        this.characterHandler = characterHandler;

        // Subscribe to character changes
        this.characterHandler.addCharacterListener(this.handleCharacterChange.bind(this));

        // Cache for race data
        this.raceCache = new Map();
        this.subraceCache = new Map();
    }

    /**
     * Handles character changes
     * @param {Character|null} character - The new character
     * @private
     */
    handleCharacterChange(character) {
        if (!character) {
            this.clearCache();
            return;
        }

        // Initialize race object if needed
        if (!character.race || typeof character.race === 'string') {
            character.race = {
                selectedRace: null,
                selectedSubrace: null
            };
        }
    }

    /**
     * Load a race by ID
     * @param {string} raceId - The ID of the race to load (format: "name_source" in lowercase)
     * @returns {Promise<Race|null>} The loaded race or null if not found
     */
    async loadRace(raceId) {
        try {
            if (!raceId) {
                console.warn('Attempted to load race with undefined ID');
                return null;
            }

            // Check cache first
            if (this.raceCache.has(raceId)) {
                return this.raceCache.get(raceId);
            }

            // Use RaceLoader's getRaceById method
            const raceData = await this.dataLoader.raceLoader.getRaceById(raceId);
            if (!raceData) {
                console.warn(`Race not found: ${raceId}`);
                return null;
            }

            // Create Race instance with proper ID format
            const race = new Race({
                ...raceData,
                id: raceId // Ensure the ID matches the format used by RaceLoader
            });
            this.raceCache.set(raceId, race);
            return race;
        } catch (error) {
            console.error('Error loading race:', error);
            return null;
        }
    }

    /**
     * Load a subrace by ID
     * @param {string} subraceId - The ID of the subrace to load
     * @param {string} parentRaceId - The ID of the parent race
     * @returns {Promise<Subrace|null>} The loaded subrace or null if not found
     */
    async loadSubrace(subraceId, parentRaceId) {
        try {
            // Check cache first
            const cacheKey = `${parentRaceId}:${subraceId}`;
            if (this.subraceCache.has(cacheKey)) {
                return this.subraceCache.get(cacheKey);
            }

            // Load parent race first
            const parentRace = await this.loadRace(parentRaceId);
            if (!parentRace) {
                console.warn(`Parent race not found: ${parentRaceId}`);
                return null;
            }

            // Get subrace data from RaceLoader
            const subraceData = await this.dataLoader.raceLoader.getSubraces(parentRaceId);
            const subrace = subraceData.find(s => {
                const source = (s.source || 'phb').toLowerCase();
                const name = (s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return `${name}_${source}` === subraceId.toLowerCase();
            });

            if (!subrace) {
                console.warn(`Subrace not found: ${subraceId}`);
                return null;
            }

            // Create Subrace instance
            const subraceInstance = new Subrace({
                ...subrace,
                id: subraceId,
                parentRaceId
            }, parentRace);

            this.subraceCache.set(cacheKey, subraceInstance);
            return subraceInstance;
        } catch (error) {
            console.error('Error loading subrace:', error);
            return null;
        }
    }

    /**
     * Load all available races
     * @returns {Promise<Race[]>} Array of available races
     */
    async getAvailableRaces() {
        try {
            const raceData = await this.dataLoader.raceLoader.loadRaces();
            if (!raceData || !raceData.race) {
                throw new Error('Failed to load race data');
            }

            const character = this.characterHandler.currentCharacter;
            if (!character) return [];

            // Filter races by allowed sources and create instances
            return raceData.race
                .filter(race => {
                    const source = race.source.toLowerCase();
                    return Array.from(character.allowedSources).some(allowedSource =>
                        allowedSource.toLowerCase() === source
                    );
                })
                .map(race => {
                    const source = race.source.toLowerCase();
                    const name = race.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const raceId = `${name}_${source}`;

                    return new Race({
                        ...race,
                        id: raceId
                    });
                });
        } catch (error) {
            console.error('Error getting available races:', error);
            return [];
        }
    }

    /**
     * Load all available subraces for a race
     * @param {string} raceId - The ID of the parent race
     * @returns {Promise<Subrace[]>} Array of available subraces
     */
    async getAvailableSubraces(raceId) {
        try {
            // Check cache first
            if (this.subraceCache.has(raceId)) {
                return this.subraceCache.get(raceId);
            }

            // Load parent race first
            const parentRace = await this.loadRace(raceId);
            if (!parentRace) {
                return [];
            }

            // Get subrace data from RaceLoader
            const subraceData = await this.dataLoader.raceLoader.getSubraces(raceId);
            if (!subraceData || subraceData.length === 0) {
                return [];
            }

            // Create subrace instances
            const subraces = subraceData.map(subrace => {
                const source = subrace.source.toLowerCase();
                const name = subrace.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const subraceId = `${name}_${source}`;

                return new Subrace({
                    ...subrace,
                    id: subraceId,
                    parentRaceId: raceId
                }, parentRace);
            });

            this.subraceCache.set(raceId, subraces);
            return subraces;
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
     * Set the character's race and subrace
     */
    async setRace(raceId, subraceId = null) {
        console.log(`[RaceManager] Setting race: ${raceId} subrace: ${subraceId}`);

        const character = this.characterHandler.currentCharacter;
        if (!character) return false;

        // Clear existing racial features
        this.clearRacialFeatures();

        if (!raceId) {
            character.race = null;
            return true;
        }

        try {
            // Load race data
            const race = await this.loadRace(raceId);
            if (!race) {
                console.error('Failed to load race:', raceId);
                return false;
            }

            // Initialize race object
            character.race = {
                selectedRace: race,
                selectedSubrace: null,
                abilityBonuses: {},
                traits: [],
                proficiencies: [],
                languages: [],
                speed: {},
                size: race.size,
                source: race.source
            };

            // Handle ability scores
            if (race.ability) {
                character.race.abilityBonuses = this.parseAbilityScores(race.ability);
            }

            // Handle subrace if specified
            if (subraceId && race.subraces) {
                const subrace = race.subraces.find(s => s.id === subraceId);
                if (subrace) {
                    character.race.selectedSubrace = subrace;

                    // Merge subrace ability scores with base race
                    if (subrace.ability) {
                        const subraceBonuses = this.parseAbilityScores(subrace.ability);
                        character.race.abilityBonuses = {
                            ...character.race.abilityBonuses,
                            ...subraceBonuses
                        };
                    }
                }
            }

            // Process racial features
            await this.processRacialFeatures(race);

            // Mark character as modified
            this.characterHandler.showUnsavedChanges();

            return true;
        } catch (error) {
            console.error('Error setting race:', error);
            return false;
        }
    }

    /**
     * Parse ability scores from race or subrace data
     */
    parseAbilityScores(ability) {
        if (!ability) return {};

        // Handle array format
        if (Array.isArray(ability)) {
            const bonuses = {};
            for (const score of ability) {
                if (typeof score === 'object') {
                    // Handle choice format
                    if (score.choose) {
                        // Store choice data for later processing
                        bonuses._choices = bonuses._choices || [];
                        bonuses._choices.push(score.choose);
                    }
                    // Handle fixed bonuses
                    else if (score.mode === 'fixed') {
                        for (const ability of score.scores) {
                            bonuses[ability.toLowerCase()] = score.amount;
                        }
                    }
                    // Handle direct bonuses
                    else {
                        for (const [ability, amount] of Object.entries(score)) {
                            if (typeof amount === 'number') {
                                bonuses[ability.toLowerCase()] = amount;
                            }
                        }
                    }
                }
            }
            return bonuses;
        }

        // Handle object format
        if (typeof ability === 'object') {
            const bonuses = {};
            for (const [ability, amount] of Object.entries(ability)) {
                if (typeof amount === 'number') {
                    bonuses[ability.toLowerCase()] = amount;
                }
            }
            return bonuses;
        }

        return {};
    }

    /**
     * Process racial features from race and subrace
     */
    async processRacialFeatures(race) {
        if (!race) return;

        // Process base race features
        if (race.entries) {
            for (const entry of race.entries) {
                if (entry.type === 'entries' && entry.name) {
                    this.characterHandler.currentCharacter.race.traits.push({
                        name: entry.name,
                        description: Array.isArray(entry.entries) ? entry.entries.join(' ') : entry.entries
                    });
                }
            }
        }

        // Process subrace features if present
        if (this.characterHandler.currentCharacter.race.selectedSubrace?.entries) {
            for (const entry of this.characterHandler.currentCharacter.race.selectedSubrace.entries) {
                if (entry.type === 'entries' && entry.name) {
                    this.characterHandler.currentCharacter.race.traits.push({
                        name: entry.name,
                        description: Array.isArray(entry.entries) ? entry.entries.join(' ') : entry.entries
                    });
                }
            }
        }

        // Process languages
        if (race.languages) {
            this.characterHandler.currentCharacter.race.languages = Array.isArray(race.languages)
                ? race.languages
                : [race.languages];
        }

        // Process speed
        if (race.speed) {
            this.characterHandler.currentCharacter.race.speed = typeof race.speed === 'number'
                ? { walk: race.speed }
                : race.speed;
        }
    }

    /**
     * Clears all racial features from the character
     */
    clearRacialFeatures() {
        console.log('[RaceManager] Clearing racial features');
        console.log('[RaceManager] Before clear - Ability bonuses:', this.characterHandler.currentCharacter.abilityBonuses);

        // Clear ability score increases
        this.characterHandler.currentCharacter.clearAbilityBonuses('Race');
        this.characterHandler.currentCharacter.clearAbilityBonuses('Subrace');

        console.log('[RaceManager] After clear - Ability bonuses:', this.characterHandler.currentCharacter.abilityBonuses);

        // Clear proficiencies
        this.characterHandler.currentCharacter.removeProficienciesBySource('Race');
        this.characterHandler.currentCharacter.removeProficienciesBySource('Subrace');

        // Clear languages
        this.characterHandler.currentCharacter.removeLanguagesBySource('Race');
        this.characterHandler.currentCharacter.removeLanguagesBySource('Subrace');

        // Reset to defaults
        this.characterHandler.currentCharacter.speed = { ...RaceManager.DEFAULT_SPEED };
        this.characterHandler.currentCharacter.size = RaceManager.DEFAULT_SIZE[0];
        this.characterHandler.currentCharacter.features.darkvision = 0;

        // Clear resistances
        this.characterHandler.currentCharacter.clearResistances('Race');
        this.characterHandler.currentCharacter.clearResistances('Subrace');

        // Clear traits
        this.characterHandler.currentCharacter.clearTraits('Race');
        this.characterHandler.currentCharacter.clearTraits('Subrace');

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
        this.characterHandler.currentCharacter.size = Array.isArray(race.size) ? race.size : [race.size || RaceManager.DEFAULT_SIZE[0]];

        // Apply speed
        this.characterHandler.currentCharacter.speed = race.speed || { ...RaceManager.DEFAULT_SPEED };

        // Clear previous ability bonuses from this source
        console.log(`[RaceManager] Before clearing ${source} ability bonuses:`, this.characterHandler.currentCharacter.abilityBonuses);
        this.characterHandler.currentCharacter.clearAbilityBonuses(source);
        console.log(`[RaceManager] After clearing ${source} ability bonuses:`, this.characterHandler.currentCharacter.abilityBonuses);

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
                            this.characterHandler.currentCharacter.addAbilityBonus(ability, value, source);
                        }
                    }

                    // Then handle any choices in the same object
                    if (abilityIncrease.choose || abilityIncrease.mode === 'choose') {
                        const choiceConfig = abilityIncrease.choose || abilityIncrease;
                        const count = choiceConfig.count || 1;
                        const amount = choiceConfig.amount || 1;

                        // For each count, add a separate choice
                        for (let i = 0; i < count; i++) {
                            this.characterHandler.currentCharacter.addPendingChoice('ability', {
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
                this.characterHandler.currentCharacter.features[key] = value;
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
                    this.characterHandler.currentCharacter.addResistance(resistanceValue.toLowerCase(), source);
                }
            }
        }

        // Apply entries as traits
        if (race.entries) {
            for (const entry of race.entries) {
                if (entry.type === 'entries' && entry.name) {
                    const description = Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries;
                    this.characterHandler.currentCharacter.addTrait(entry.name, description, source);
                }
            }
        }

        // Apply languages
        if (race.source === 'XPHB') {
            // XPHB races know Common and 2 normal languages of their choice
            this.characterHandler.currentCharacter.addLanguage('Common', source);
            this.characterHandler.currentCharacter.addPendingChoice('language', {
                source,
                type: 'languages',
                count: 2,
                from: 'normal',
                description: 'Choose two normal languages'
            });
        } else if (race.languages) {
            for (const language of race.languages) {
                this.characterHandler.currentCharacter.addLanguage(language, source);
            }
        }

        // Apply proficiencies
        if (race.proficiencies) {
            for (const [type, profs] of Object.entries(race.proficiencies)) {
                if (Array.isArray(profs)) {
                    for (const prof of profs) {
                        this.characterHandler.currentCharacter.addProficiency(type, prof, source);
                    }
                } else if (profs.choose) {
                    // Store proficiency choices for later
                    this.characterHandler.currentCharacter.addPendingChoice('proficiency', {
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
                if (this.characterHandler.currentCharacter.spells) {
                    await this.characterHandler.currentCharacter.spells.addSpell(spell.id || spell, source);
                }
            }
        }

        // Check for and handle ability score choices
        if (this.hasPendingChoices()) {
            const abilityScoreContainer = document.querySelector('.ability-score-container');
            if (abilityScoreContainer) {
                const raceUIInstance = new RaceCard(this.characterHandler.currentCharacter);
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
            this.characterHandler.currentCharacter.clearAbilityBonuses('Race Choice');

            // Apply new choices
            for (const [ability, value] of Object.entries(choices)) {
                this.characterHandler.currentCharacter.addAbilityBonus(ability, value, 'Race Choice');
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

// Create and export a singleton instance
export const raceManager = new RaceManager(dataLoader); 