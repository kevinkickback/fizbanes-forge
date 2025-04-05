/**
 * RaceManager.js
 * Manages race data transformation and state
 */
import { Race } from '../models/Race.js';
import { dataLoader } from '../dataloaders/DataLoader.js';
import { abilityScoreManager } from './AbilityScoreManager.js';

let instance = null;

export class RaceManager {
    constructor() {
        if (instance) {
            throw new Error('RaceManager is a singleton. Use RaceManager.getInstance() instead.');
        }
        instance = this;

        this.races = new Map();
        this.selectedRace = null;
        this.selectedSubrace = null;
        this.selectedVariant = null;
    }

    /**
     * Gets the singleton instance of RaceManager
     * @returns {RaceManager} The singleton instance
     * @static
     */
    static getInstance() {
        if (!instance) {
            instance = new RaceManager();
        }
        return instance;
    }

    /**
     * Initialize race data
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            const raceData = await dataLoader.loadRaces();
            this.processRaceData(raceData);
        } catch (error) {
            console.error('Failed to initialize race data:', error);
            throw error;
        }
    }

    /**
     * Process raw race data into Race objects
     * @param {Object} raceData - Raw race data from loader
     */
    processRaceData(raceData) {
        // Process main races
        for (const rawRace of raceData.race) {
            // Create the main race with processed data
            const processedRace = this.processRawRace(rawRace);
            this.races.set(`${processedRace.name}_${processedRace.source}`, processedRace);

            // Handle reprinted races
            if (rawRace.reprintedAs) {
                for (const reprinted of rawRace.reprintedAs) {
                    const [name, source] = reprinted.split('|');
                    const reprintedRace = this.processRawRace({
                        ...rawRace,
                        name: name,
                        source: source,
                        languageProficiencies: source === 'XPHB' ?
                            [{ common: true, anyStandard: 2 }] :
                            (rawRace.languageProficiencies || [{ common: true }])
                    });
                    this.races.set(`${reprintedRace.name}_${reprintedRace.source}`, reprintedRace);
                }
            }
        }

        // Process subraces
        for (const rawSubrace of raceData.subrace) {
            const parentRace = this.races.get(`${rawSubrace.raceName}_${rawSubrace.raceSource || 'PHB'}`);
            if (parentRace) {
                parentRace.addSubrace(this.processRawSubrace(rawSubrace));
            }
        }
    }

    /**
     * Process raw race data into standardized format
     * @param {Object} rawRace - Raw race data
     * @returns {Race} Processed Race object
     */
    processRawRace(rawRace) {
        return new Race({
            ...rawRace,
            size: this.parseSize(rawRace.size),
            speed: this.parseSpeed(rawRace.speed),
            ability: this.parseAbility(rawRace.ability)
        });
    }

    /**
     * Process raw subrace data into standardized format
     * @param {Object} rawSubrace - Raw subrace data
     * @returns {Object} Processed subrace object
     */
    processRawSubrace(rawSubrace) {
        return {
            ...rawSubrace,
            ability: this.parseAbility(rawSubrace.ability)
        };
    }

    /**
     * Parse size data from various formats
     * @param {Object|string|Array} sizeData - Size information
     * @returns {Object} Parsed size data with standardized format
     */
    parseSize(sizeData) {
        // Handle array format (e.g., ["M"] or ["S", "M"])
        if (Array.isArray(sizeData)) {
            return {
                value: sizeData.map(s => this.standardizeSize(s)).join(' or '),
                choices: sizeData.map(s => this.standardizeSize(s))
            };
        }

        // Handle string format (e.g., "Medium")
        if (typeof sizeData === 'string') {
            return {
                value: this.standardizeSize(sizeData),
                choices: [this.standardizeSize(sizeData)]
            };
        }

        // Handle object format (e.g., { value: "Medium" })
        if (typeof sizeData === 'object' && sizeData !== null) {
            return {
                value: this.standardizeSize(sizeData.value || 'Medium'),
                choices: [this.standardizeSize(sizeData.value || 'Medium')]
            };
        }

        // Default to Medium if no size is specified
        return {
            value: 'Medium',
            choices: ['Medium']
        };
    }

    /**
     * Standardize size abbreviation to full name
     * @param {string} size - Size abbreviation or name
     * @returns {string} Standardized size name
     */
    standardizeSize(size) {
        const sizeMap = {
            'T': 'Tiny',
            'S': 'Small',
            'M': 'Medium',
            'L': 'Large',
            'H': 'Huge',
            'G': 'Gargantuan'
        };
        return sizeMap[size.toUpperCase()] || size;
    }

    /**
     * Parse speed data from various formats
     * @param {Object|number} speedData - Speed information
     * @returns {Object} Parsed speed data
     */
    parseSpeed(speedData) {
        if (typeof speedData === 'number') {
            return { walk: speedData };
        }
        return speedData || { walk: 30 };
    }

    /**
     * Parse ability score improvements from race data
     * @param {Object} abilityData - Ability score data
     * @returns {Array} Array of ability score improvements
     */
    parseAbility(abilityData) {

        // Handle edge case where ability is empty or undefined
        if (!abilityData) {
            return [];
        }

        // Handle array format
        if (Array.isArray(abilityData)) {
            const improvements = [];

            for (const entry of abilityData) {
                if (typeof entry === 'object' && !Array.isArray(entry)) {
                    // Check for mixed case - object with both fixed bonuses and choose option
                    if (entry.choose && entry.from) {
                        // Process the choice component
                        improvements.push({
                            isChoice: true,
                            count: entry.choose || 1,
                            amount: entry.amount || 1,
                            choices: Array.isArray(entry.from) ?
                                entry.from.map(a => a.toLowerCase()) :
                                []
                        });
                    } else if (entry.choose?.from) {
                        // Handle nested choose format
                        improvements.push({
                            isChoice: true,
                            count: entry.choose.count || 1,
                            amount: entry.choose.amount || 1,
                            choices: Array.isArray(entry.choose.from) ?
                                entry.choose.from.map(a => a.toLowerCase()) :
                                []
                        });

                        // Also process any fixed bonuses in the same object
                        for (const [key, value] of Object.entries(entry)) {
                            if (key !== 'choose' && typeof value === 'number') {
                                improvements.push({
                                    ability: key.toLowerCase(),
                                    amount: value,
                                    isChoice: false
                                });
                            }
                        }
                    } else {
                        // Handle simple object with ability scores only
                        for (const [key, value] of Object.entries(entry)) {
                            if (key !== 'choose' && typeof value === 'number') {
                                improvements.push({
                                    ability: key.toLowerCase(),
                                    amount: value,
                                    isChoice: false
                                });
                            }
                        }
                    }
                } else if (typeof entry === 'string') {
                    // Parse string format like "dexterity +2"
                    const parts = entry.split(/\s+/);
                    if (parts.length >= 2) {
                        const ability = parts[0].toLowerCase();
                        const amountStr = parts[1].replace(/^[+]/, '');
                        const amount = Number.parseInt(amountStr, 10) || 1;
                        improvements.push({
                            ability,
                            amount,
                            isChoice: false
                        });
                    }
                }
            }

            return improvements;
        }

        // Handle object format (not in an array)
        if (typeof abilityData === 'object' && !Array.isArray(abilityData)) {
            const improvements = [];

            // Handle choice component if present
            if (abilityData.from) {
                improvements.push({
                    isChoice: true,
                    count: abilityData.choose || 1,
                    amount: abilityData.amount || 1,
                    choices: Array.isArray(abilityData.from) ?
                        abilityData.from.map(a => a.toLowerCase()) :
                        []
                });
            }

            // Handle fixed components
            for (const [key, value] of Object.entries(abilityData)) {
                if (key !== 'from' && key !== 'choose' && key !== 'amount' && typeof value === 'number') {
                    improvements.push({
                        ability: key.toLowerCase(),
                        amount: value,
                        isChoice: false
                    });
                }
            }

            return improvements;
        }

        // Handle simple string format
        if (typeof abilityData === 'string') {
            const parts = abilityData.split(/\s+/);
            if (parts.length >= 2) {
                const ability = parts[0].toLowerCase();
                const amountStr = parts[1].replace(/^[+]/, '');
                const amount = Number.parseInt(amountStr, 10) || 1;
                return [{
                    ability,
                    amount,
                    isChoice: false
                }];
            }
        }

        return [];
    }

    /**
     * Get all available races
     * @returns {Array<Race>} Array of Race objects
     */
    getAllRaces() {
        return Array.from(this.races.values());
    }

    /**
     * Get race by name and source
     * @param {string} name - Race name
     * @param {string} source - Race source
     * @returns {Race|null} Race object or null if not found
     */
    getRace(name, source = 'PHB') {
        return this.races.get(`${name}_${source}`) || null;
    }

    /**
     * Select a race
     * @param {string} raceName - Name of the race to select
     * @param {string} source - Source of the race
     * @returns {Race|null} Selected race or null if not found
     */
    selectRace(raceName, source = 'PHB') {
        this.selectedRace = this.getRace(raceName, source);
        this.selectedSubrace = null;
        this.selectedVariant = null;
        this.clearAbilityChoiceSelections();
        return this.selectedRace;
    }

    /**
     * Select a subrace
     * @param {string} subraceName - Name of the subrace to select
     * @returns {Object|null} Selected subrace or null if not found
     */
    selectSubrace(subraceName) {
        if (!this.selectedRace) return null;

        this.selectedSubrace = this.selectedRace.getSubrace(subraceName);
        this.selectedVariant = null;
        this.clearAbilityChoiceSelections();
        return this.selectedSubrace;
    }

    /**
     * Get currently selected race
     * @returns {Race|null} Currently selected race
     */
    getSelectedRace() {
        return this.selectedRace;
    }

    /**
     * Get currently selected subrace
     * @returns {Object|null} Currently selected subrace
     */
    getSelectedSubrace() {
        return this.selectedSubrace;
    }

    /**
     * Get the currently selected variant
     * @returns {Object|null} The selected variant or null if none selected
     */
    getSelectedVariant() {
        return this.selectedVariant;
    }

    /**
     * Get combined ability score improvements from race and subrace
     * @returns {Array} Combined ability score improvements
     */
    getCombinedAbilityImprovements() {
        const improvements = [];

        if (this.selectedRace) {
            improvements.push(...this.selectedRace.getAbilityImprovements());
        }

        if (this.selectedSubrace) {
            improvements.push(...(this.selectedSubrace.ability || []));
        }

        return improvements;
    }

    /**
     * Get formatted ability score improvements
     * @returns {string} Formatted ability score improvements
     */
    getFormattedAbilityImprovements() {
        // Special case for Human (PHB)
        if (this.selectedRace?.name === 'Human' && this.selectedRace?.source === 'PHB' && !this.selectedSubrace) {
            return '+1 all ability scores';
        }

        const improvements = this.getCombinedAbilityImprovements();
        if (!improvements || improvements.length === 0) {
            return 'None';
        }

        // Process improvements and separate fixed improvements to display one per line
        const choiceImprovements = [];
        const fixedImprovements = [];

        for (const improvement of improvements) {
            if (improvement.isChoice) {
                // Format choice improvements
                const formattedChoices = improvement.choices.map(ability =>
                    this._getAbilityAbbreviation(ability).toUpperCase()
                ).join(', ');
                choiceImprovements.push(`Choose ${improvement.count} from: ${formattedChoices} (+${improvement.amount})`);
            } else {
                // Format fixed improvements with uppercase abbreviations - one per entry
                fixedImprovements.push(`${this._getAbilityAbbreviation(improvement.ability).toUpperCase()} +${improvement.amount}`);
            }
        }

        // Combine with line breaks between fixed improvements
        return [...fixedImprovements, ...choiceImprovements].join('\n');
    }

    /**
     * Convert ability name to standard abbreviation
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

    /**
     * Get formatted movement speeds
     * @returns {string} Formatted movement speeds
     */
    getFormattedMovementSpeeds() {
        if (!this.selectedRace) return 'None';
        const speeds = [];
        const speedData = this.selectedRace.getSpeeds();

        for (const [type, speed] of Object.entries(speedData)) {
            speeds.push(`${type.charAt(0).toUpperCase() + type.slice(1)}: ${speed} ft.`);
        }
        return speeds.join('\n');
    }

    /**
     * Get formatted languages
     * @returns {string} Formatted languages
     */
    getFormattedLanguages() {
        if (!this.selectedRace) return 'None';

        // For XPHB races, always return Common and 2 Standard
        if (this.selectedRace.source === 'XPHB') {
            return 'Common\nChoose 2 standard languages';
        }

        const languages = new Set(['Common']); // Always include Common
        const proficiencies = this.selectedRace.getLanguageProficiencies();

        if (!proficiencies || proficiencies.length === 0) {
            return 'Common';
        }

        for (const proficiency of proficiencies) {
            // Handle standard languages
            for (const [language, value] of Object.entries(proficiency)) {
                if (value === true) {
                    languages.add(language.charAt(0).toUpperCase() + language.slice(1));
                }
            }

            // Handle "anyStandard" choice
            if (proficiency.anyStandard) {
                languages.add(`Choose ${proficiency.anyStandard} standard language${proficiency.anyStandard > 1 ? 's' : ''}`);
            }

            // Handle "other" choice
            if (proficiency.other) {
                languages.add('Choose 1 other language');
            }
        }

        return Array.from(languages).join('\n');
    }

    /**
     * Get ability score choices from race and subrace
     * @returns {Array} Array of ability score choices with source information
     */
    getAbilityScoreChoices() {
        const choices = [];

        if (this.selectedRace) {
            // Get choices from main race
            const raceChoices = this.selectedRace.getAbilityImprovements()
                .filter(improvement => improvement.isChoice)
                .flatMap(improvement => {
                    // For each choice count requested, create separate choice objects
                    const sourceChoices = [];
                    const count = improvement.count || 1;

                    // Always create individual choice objects, even for multi-select choices
                    for (let i = 0; i < count; i++) {
                        sourceChoices.push({
                            type: 'ability',
                            amount: improvement.amount,
                            count: 1, // Always 1 for individual dropdowns
                            choices: improvement.choices,
                            source: `Race Choice ${i + 1}` // Differentiate sources
                        });
                    }

                    return sourceChoices;
                });
            choices.push(...raceChoices);

            // Get choices from subrace if selected
            if (this.selectedSubrace) {
                const subraceChoices = (this.selectedSubrace.ability || [])
                    .filter(improvement => improvement.isChoice)
                    .flatMap(improvement => {
                        // For each choice count requested, create separate choice objects
                        const sourceChoices = [];
                        const count = improvement.count || 1;

                        // Always create individual choice objects
                        for (let i = 0; i < count; i++) {
                            sourceChoices.push({
                                type: 'ability',
                                amount: improvement.amount,
                                count: 1, // Always 1 for individual dropdowns
                                choices: improvement.choices,
                                source: `Subrace Choice ${i + 1}` // Differentiate sources
                            });
                        }

                        return sourceChoices;
                    });
                choices.push(...subraceChoices);
            }
        }

        console.debug('[RaceManager] Ability score choices:', choices);
        return choices;
    }

    /**
     * Get available races based on allowed sources
     * @param {boolean} filterBySource - Whether to filter by source
     * @returns {Array<Object>} Array of available races
     */
    getAvailableRaces(filterBySource = true) {
        let races = this.races || [];

        if (filterBySource) {
            const allowedSources = this.sourceManager.getAllowedSources();

            // Make sure source names are uppercase for comparison
            const upperAllowedSources = new Set(Array.from(allowedSources).map(s => s.toUpperCase()));

            races = races.filter(race => {
                const raceSource = race.source?.toUpperCase();
                return upperAllowedSources.has(raceSource);
            });
        }

        return races;
    }

    /**
     * Clear any stored ability choice selections
     * This should be called when changing races to prevent stale selections
     */
    clearAbilityChoiceSelections() {

        try {
            if (abilityScoreManager && typeof abilityScoreManager.clearStoredChoices === 'function') {
                abilityScoreManager.clearStoredChoices();
            } else {
                console.warn('[RaceManager] Could not access abilityScoreManager to clear choices');
            }
        } catch (error) {
            console.error('[RaceManager] Error accessing abilityScoreManager:', error);
        }
    }

    /**
     * Process race options to extract ability improvements
     * @param {Object} raceData - Raw race data to process
     */
    processRaceOptions(raceData) {
        // Implementation of processRaceOptions method
    }

    /**
     * Get fixed ability score improvements from race and subrace
     * @returns {Array} Array of fixed ability score improvements
     */
    getFixedAbilityImprovements() {
        const improvements = [];

        // Special case for Human (PHB)
        if (this.selectedRace?.name === 'Human' && this.selectedRace?.source === 'PHB' && !this.selectedSubrace) {
            const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
            return abilities.map(ability => ({
                ability: ability.toLowerCase(),
                value: 1,
                source: 'Race'
            }));
        }

        if (this.selectedRace) {
            // Get fixed improvements from main race
            const raceImprovements = this.selectedRace.getAbilityImprovements()
                .filter(improvement => !improvement.isChoice)
                .map(improvement => ({
                    ability: improvement.ability.toLowerCase(),
                    value: improvement.amount,
                    source: 'Race'
                }));
            improvements.push(...raceImprovements);

            // Get fixed improvements from subrace if selected
            if (this.selectedSubrace) {
                const subraceImprovements = (this.selectedSubrace.ability || [])
                    .filter(improvement => !improvement.isChoice)
                    .map(improvement => ({
                        ability: improvement.ability.toLowerCase(),
                        value: improvement.amount,
                        source: 'Subrace'
                    }));
                improvements.push(...subraceImprovements);
            }
        }

        return improvements;
    }

    /**
     * Get combined traits from race and subrace
     * @returns {Array} Combined traits
     */
    getCombinedTraits() {
        const traits = [];

        if (this.selectedRace) {
            // Filter out traits that are displayed elsewhere
            const filteredTraits = this.selectedRace.getTraits().filter(trait => {
                const name = trait.name?.toLowerCase() || '';
                return !name.includes('age') && !name.includes('speed') &&
                    !name.includes('language') && !name.includes('size');
            });
            traits.push(...filteredTraits);
        }

        if (this.selectedSubrace) {
            // Filter out traits that are displayed elsewhere
            const filteredSubraceTraits = (this.selectedSubrace.entries || []).filter(trait => {
                const name = trait.name?.toLowerCase() || '';
                return !name.includes('age') && !name.includes('speed') &&
                    !name.includes('language') && !name.includes('size');
            });
            traits.push(...filteredSubraceTraits);
        }

        return traits;
    }
}

export const raceManager = RaceManager.getInstance();
