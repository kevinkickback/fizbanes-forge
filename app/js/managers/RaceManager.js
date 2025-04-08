/**
 * RaceManager.js
 * Manages race data transformation and state
 */
import { Race } from '../models/Race.js';
import { dataLoader } from '../dataloaders/DataLoader.js';
import { abilityScoreManager } from './AbilityScoreManager.js';
import { eventEmitter } from '../utils/EventEmitter.js';

/**
 * Manages race data processing, selection, and related functionality
 */
class RaceManager {
    /**
     * Initialize a new RaceManager
     */
    constructor() {
        this._races = new Map();
        this._selectedRace = null;
        this._selectedSubrace = null;
        this._selectedVariant = null;
    }

    /**
     * Initialize race data
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            const raceData = await dataLoader.loadRaces();
            this._processRaceData(raceData);
            eventEmitter.emit('races:loaded', Array.from(this._races.values()));
        } catch (error) {
            console.error('Failed to initialize race data:', error);
            throw error;
        }
    }

    /**
     * Process raw race data
     * @param {Object} data - Raw race data
     * @private
     */
    _processRaceData(data) {
        if (!data || !data.race) {
            console.warn('No race data to process');
            return;
        }

        // Clear existing data
        this._races.clear();

        // Process each race
        for (const raceItem of data.race) {
            try {
                const raceId = this._generateRaceId(raceItem);

                // Find associated race fluff
                const fluff = data.fluff?.find(f =>
                    f.name === raceItem.name && f.source === raceItem.source
                );

                // Find subraces for this race (if any)
                const subraces = [];

                // Only process subraces if they exist
                if (Array.isArray(data.subrace)) {
                    // Filter for matching subraces
                    for (const sub of data.subrace) {
                        if (sub &&
                            sub.raceName === raceItem.name &&
                            (sub.raceSource === raceItem.source || !sub.raceSource)) {
                            subraces.push(sub);
                        }
                    }
                }

                // Filter and map subraces
                const processedSubraces = subraces.length > 0
                    ? subraces
                        .filter(sub => sub?.name) // Use optional chaining
                        .map(sub => ({
                            ...sub,
                            id: this._generateSubraceId(sub)
                        }))
                    : [];

                // Create enriched race object
                const enrichedRace = {
                    ...raceItem,
                    id: raceId,
                    fluff: fluff || null,
                    subraces: processedSubraces
                };

                this._races.set(raceId, enrichedRace);
            } catch (error) {
                console.error(`Error processing race ${raceItem.name}:`, error);
            }
        }
    }

    /**
     * Generates a unique race ID
     * @param {Object} raceItem - Race data object
     * @returns {string} Unique race identifier
     * @private
     */
    _generateRaceId(raceItem) {
        // Format: "race-name_source" - keep original case and don't modify name format
        return `${raceItem.name}_${raceItem.source || 'PHB'}`;
    }

    /**
     * Generates a unique subrace ID
     * @param {Object} subrace - Subrace data object
     * @returns {string} Unique subrace identifier
     * @private
     */
    _generateSubraceId(subrace) {
        if (!subrace || !subrace.raceName || !subrace.name) {
            console.warn('Incomplete subrace data', subrace);
            // Generate a fallback ID using available data
            const raceName = subrace?.raceName || 'unknown';
            const subraceName = subrace?.name || 'unknown';
            const source = subrace?.source || 'phb';
            return `${raceName.toLowerCase().replace(/\s+/g, '-')}_${subraceName.toLowerCase().replace(/\s+/g, '-')}_${source.toLowerCase()}`;
        }

        // Normal case when all data is present
        const raceName = subrace.raceName.toLowerCase().replace(/\s+/g, '-');
        const subraceName = subrace.name.toLowerCase().replace(/\s+/g, '-');
        const source = (subrace.source || 'phb').toLowerCase();

        return `${raceName}_${subraceName}_${source}`;
    }

    /**
     * Get all available races
     * @returns {Array<Race>} Array of Race objects
     */
    getAllRaces() {
        return Array.from(this._races.values());
    }

    /**
     * Get race by name and source
     * @param {string} name - Race name
     * @param {string} source - Race source
     * @returns {Race|null} Race object or null if not found
     */
    getRace(name, source = 'PHB') {
        // The key in the map is formatted as "Race Name_SOURCE"
        const raceId = `${name}_${source}`;
        const raceData = this._races.get(raceId);

        if (!raceData) {
            return null;
        }

        // Create a Race instance with the race data
        const race = new Race(raceData);

        // Add subraces to the Race instance
        if (raceData.subraces && raceData.subraces.length > 0) {
            for (const subrace of raceData.subraces) {
                race.addSubrace(subrace);
            }
        }

        return race;
    }

    /**
     * Select a race
     * @param {string} raceName - Name of the race to select
     * @param {string} source - Source of the race
     * @returns {Race|null} Selected race or null if not found
     */
    selectRace(raceName, source = 'PHB') {
        this._selectedRace = this.getRace(raceName, source);
        this._selectedSubrace = null;
        this._selectedVariant = null;
        this._clearAbilityChoiceSelections();

        eventEmitter.emit('race:selected', this._selectedRace);
        return this._selectedRace;
    }

    /**
     * Select a subrace
     * @param {string} subraceName - Name of the subrace to select
     * @returns {Object|null} Selected subrace or null if not found
     */
    selectSubrace(subraceName) {
        if (!this._selectedRace) return null;

        this._selectedSubrace = this._selectedRace.getSubrace(subraceName);
        this._selectedVariant = null;
        this._clearAbilityChoiceSelections();

        eventEmitter.emit('subrace:selected', this._selectedSubrace);
        return this._selectedSubrace;
    }

    /**
     * Get currently selected race
     * @returns {Race|null} Currently selected race
     */
    getSelectedRace() {
        return this._selectedRace;
    }

    /**
     * Get currently selected subrace
     * @returns {Object|null} Currently selected subrace
     */
    getSelectedSubrace() {
        return this._selectedSubrace;
    }

    /**
     * Get the currently selected variant
     * @returns {Object|null} The selected variant or null if none selected
     */
    getSelectedVariant() {
        return this._selectedVariant;
    }

    /**
     * Get combined ability score improvements from race and subrace
     * @returns {Array} Combined ability score improvements
     */
    getCombinedAbilityImprovements() {
        const improvements = [];

        if (this._selectedRace) {
            improvements.push(...this._selectedRace.getAbilityImprovements());
        }

        if (this._selectedSubrace) {
            improvements.push(...(this._selectedSubrace.ability || []));
        }

        return improvements;
    }

    /**
     * Get formatted ability score improvements
     * @param {Race} [race=null] - Race to get ability score improvements for (defaults to selected race)
     * @param {Object} [subrace=null] - Subrace to get ability score improvements for (defaults to selected subrace) 
     * @returns {string} Formatted ability score improvements
     */
    getFormattedAbilityImprovements(race = null, subrace = null) {
        // Use provided race/subrace or fall back to selected ones
        const raceToUse = race || this._selectedRace;
        const subraceToUse = subrace || this._selectedSubrace;

        if (!raceToUse) return 'None';

        // Special case for Human (PHB)
        if (raceToUse.name === 'Human' && raceToUse.source === 'PHB' && !subraceToUse) {
            return '+1 all ability scores';
        }

        try {
            // Get improvements from provided race and subrace
            const improvements = [];

            // Safely get race ability improvements
            if (raceToUse.getAbilityImprovements && typeof raceToUse.getAbilityImprovements === 'function') {
                const raceImprovements = raceToUse.getAbilityImprovements() || [];
                improvements.push(...this._normalizeAbilityImprovements(raceImprovements));
            }

            // Add subrace ability improvements if they exist - using optional chaining
            if (subraceToUse?.ability) {
                const subraceImprovements = Array.isArray(subraceToUse.ability) ?
                    subraceToUse.ability : [subraceToUse.ability];
                improvements.push(...this._normalizeAbilityImprovements(subraceImprovements));
            }

            if (!improvements || improvements.length === 0) {
                return 'None';
            }

            // Process improvements and separate fixed improvements to display one per line
            const choiceImprovements = [];
            const fixedImprovements = [];

            for (const improvement of improvements) {
                // Skip invalid improvements
                if (!improvement) continue;

                if (improvement.isChoice) {
                    // Handle choice improvements
                    if (improvement.choices && Array.isArray(improvement.choices)) {
                        // Format choice improvements
                        const formattedChoices = improvement.choices.map(ability =>
                            this._getAbilityAbbreviation(ability).toUpperCase()
                        ).join(', ');

                        const count = improvement.count || 1;
                        const amount = improvement.amount || 1;

                        choiceImprovements.push(`Choose ${count} from: ${formattedChoices} (+${amount})`);
                    }
                } else if (improvement.ability) {
                    // Handle fixed improvements
                    const amount = improvement.amount || 1;
                    fixedImprovements.push(`${this._getAbilityAbbreviation(improvement.ability).toUpperCase()} +${amount}`);
                }
            }

            // Combine with line breaks between fixed improvements
            const result = [...fixedImprovements, ...choiceImprovements].join('\n');
            return result || 'None';
        } catch (error) {
            console.error('Error formatting ability improvements:', error);
            return 'Error retrieving ability score improvements';
        }
    }

    /**
     * Normalize ability improvement data from various formats
     * @param {Array|Object} abilityData - Ability score data in various formats
     * @returns {Array} Array of normalized ability score improvements
     * @private
     */
    _normalizeAbilityImprovements(abilityData) {
        // Based on old parseAbility from old_raceManager.js
        const improvements = [];

        // Handle edge case where ability is empty or undefined
        if (!abilityData) {
            return [];
        }

        // Handle array format
        if (Array.isArray(abilityData)) {
            for (const entry of abilityData) {
                if (typeof entry === 'object' && !Array.isArray(entry)) {
                    // Check for objects with choose option
                    if (entry.choose && entry.from) {
                        // Process the choice component
                        improvements.push({
                            isChoice: true,
                            count: entry.choose || 1,
                            amount: entry.amount || 1,
                            choices: Array.isArray(entry.from) ?
                                entry.from.map(a => typeof a === 'string' ? a.toLowerCase() : a) :
                                []
                        });
                    } else if (entry.choose?.from) {
                        // Handle nested choose format
                        improvements.push({
                            isChoice: true,
                            count: entry.choose.count || 1,
                            amount: entry.choose.amount || 1,
                            choices: Array.isArray(entry.choose.from) ?
                                entry.choose.from.map(a => typeof a === 'string' ? a.toLowerCase() : a) :
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
            // Handle choice component if present
            if (abilityData.from) {
                improvements.push({
                    isChoice: true,
                    count: abilityData.choose || 1,
                    amount: abilityData.amount || 1,
                    choices: Array.isArray(abilityData.from) ?
                        abilityData.from.map(a => typeof a === 'string' ? a.toLowerCase() : a) :
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

        return improvements;
    }

    /**
     * Convert ability name to standard abbreviation
     * @param {string} ability - The ability name
     * @returns {string} The abbreviated ability name
     * @private
     */
    _getAbilityAbbreviation(ability) {
        // Handle undefined or null ability names
        if (!ability) {
            console.warn('Undefined ability name encountered');
            return 'UNK';
        }

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
     * @param {Race} [race=null] - Race to get speeds for (defaults to selected race)
     * @returns {string} Formatted movement speeds
     */
    getFormattedMovementSpeeds(race = null) {
        const raceToUse = race || this._selectedRace;
        if (!raceToUse) return 'None';

        try {
            const speeds = [];
            // Safely get speeds using the getSpeeds method if available, or directly access the speed property
            const speedData = (raceToUse.getSpeeds && typeof raceToUse.getSpeeds === 'function')
                ? raceToUse.getSpeeds()
                : (raceToUse.speed || { walk: 30 });

            if (!speedData || Object.keys(speedData).length === 0) {
                return 'Walk: 30 ft.';  // Default if no speeds are found
            }

            for (const [type, speed] of Object.entries(speedData)) {
                if (speed && typeof speed === 'number') {
                    speeds.push(`${type.charAt(0).toUpperCase() + type.slice(1)}: ${speed} ft.`);
                }
            }

            return speeds.length > 0 ? speeds.join('\n') : 'Walk: 30 ft.';
        } catch (error) {
            console.error('Error formatting movement speeds:', error);
            return 'Error retrieving movement speeds';
        }
    }

    /**
     * Get formatted languages
     * @param {Race} [race=null] - Race to get languages for (defaults to selected race)
     * @returns {string} Formatted languages
     */
    getFormattedLanguages(race = null) {
        const raceToUse = race || this._selectedRace;
        if (!raceToUse) return 'None';

        try {
            // For XPHB races, always return Common and 2 Standard
            if (raceToUse.source === 'XPHB') {
                return 'Common\nChoose 2 standard languages';
            }

            const languages = new Set(['Common']); // Always include Common

            // Safely get language proficiencies
            const proficiencies = (raceToUse.getLanguageProficiencies && typeof raceToUse.getLanguageProficiencies === 'function')
                ? raceToUse.getLanguageProficiencies()
                : (raceToUse.languageProficiencies || []);

            if (!proficiencies || proficiencies.length === 0) {
                return 'Common';
            }

            for (const proficiency of proficiencies) {
                if (!proficiency) continue;

                // Handle standard languages
                for (const [language, value] of Object.entries(proficiency)) {
                    if (value === true && language && language !== 'anyStandard' && language !== 'anyExotic') {
                        languages.add(language.charAt(0).toUpperCase() + language.slice(1));
                    }
                }

                // Handle "anyStandard" choice
                if (proficiency.anyStandard) {
                    languages.add(`Choose ${proficiency.anyStandard} standard languages`);
                }

                // Handle "anyExotic" choice
                if (proficiency.anyExotic) {
                    languages.add(`Choose ${proficiency.anyExotic} exotic languages`);
                }
            }

            return Array.from(languages).join('\n') || 'Common';
        } catch (error) {
            console.error('Error formatting languages:', error);
            return 'Common';
        }
    }

    /**
     * Get ability score choices from race and subrace
     * @returns {Array} Array of ability score choices
     */
    getAbilityScoreChoices() {
        const choices = [];

        if (this._selectedRace) {
            // Special handling for Half-Elf (PHB)
            if (this._selectedRace.name === 'Half-Elf' && this._selectedRace.source === 'PHB') {
                // Half-Elf gets +2 Charisma and +1 to two other abilities
                return [
                    {
                        type: 'ability',
                        amount: 1,
                        count: 1,
                        choices: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom'],
                        source: 'Race Choice 1'
                    },
                    {
                        type: 'ability',
                        amount: 1,
                        count: 1,
                        choices: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom'],
                        source: 'Race Choice 2'
                    }
                ];
            }

            // Get choices from main race
            const raceChoices = this._selectedRace.getAbilityImprovements()
                .filter(improvement => improvement.isChoice)
                .flatMap(improvement => {
                    // For each choice count requested, create separate choice objects
                    const sourceChoices = [];
                    const count = improvement.count || 1;

                    // Always create individual choice objects, even for multi-select choices
                    for (let i = 0; i < count; i++) {
                        sourceChoices.push({
                            type: 'ability',
                            amount: improvement.amount || 1,
                            count: 1, // Always 1 for individual dropdowns
                            choices: improvement.choices || [],
                            source: `Race Choice ${i + 1}` // Differentiate sources
                        });
                    }

                    return sourceChoices;
                });

            choices.push(...raceChoices);

            // Get choices from subrace if selected
            if (this._selectedSubrace) {
                const subraceChoices = (this._selectedSubrace.ability || [])
                    .filter(improvement => improvement.isChoice)
                    .flatMap(improvement => {
                        // For each choice count requested, create separate choice objects
                        const sourceChoices = [];
                        const count = improvement.count || 1;

                        // Always create individual choice objects
                        for (let i = 0; i < count; i++) {
                            sourceChoices.push({
                                type: 'ability',
                                amount: improvement.amount || 1,
                                count: 1, // Always 1 for individual dropdowns
                                choices: improvement.choices || [],
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
     * Get available races, optionally filtered by source
     * @param {boolean} filterBySource - Whether to filter by allowed sources
     * @returns {Array<Race>} Array of available races
     */
    getAvailableRaces(filterBySource = true) {
        const races = this._races || [];

        if (filterBySource) {
            // TODO: Implement source filtering based on user preferences
            // For now, return all races
        }

        return Array.from(races.values());
    }

    /**
     * Clear ability choice selections
     * This should be called when changing races to prevent stale selections
     * @private
     */
    _clearAbilityChoiceSelections() {
        try {
            // Reset ability choice selections
            abilityScoreManager.setRacialAbilityChoices([]);
        } catch (error) {
            console.error('Error clearing ability choice selections:', error);
        }
    }

    /**
     * Process race options for a specific race
     * @param {Object} raceData - Race data to process
     * @private
     */
    _processRaceOptions(raceData) {
        // TODO: Implement processing of race options
    }

    /**
     * Get fixed ability improvements from race and subrace
     * @param {Race} [race=null] - Race to get fixed improvements for (defaults to selected race)
     * @param {Object} [subrace=null] - Subrace to get fixed improvements for (defaults to selected subrace)
     * @returns {Array} Array of fixed ability improvements
     */
    getFixedAbilityImprovements(race, subrace) {
        const raceToUse = race || this._selectedRace;
        const subraceToUse = subrace || this._selectedSubrace;

        if (!raceToUse) return [];

        try {
            // Special case for Human (PHB)
            if (raceToUse.name === 'Human' && raceToUse.source === 'PHB' && !subraceToUse) {
                const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
                return abilities.map(ability => ({
                    ability,
                    amount: 1,
                    source: 'Race'
                }));
            }

            // Get fixed improvements from main race
            let raceImprovements = [];

            if (raceToUse.getAbilityImprovements && typeof raceToUse.getAbilityImprovements === 'function') {
                // Get all ability improvements (fixed and choice)
                const allImprovements = this._normalizeAbilityImprovements(raceToUse.getAbilityImprovements() || []);

                // Filter to only fixed (non-choice) improvements
                raceImprovements = allImprovements
                    .filter(improvement => improvement && !improvement.isChoice && improvement.ability)
                    .map(improvement => ({
                        ability: improvement.ability,
                        value: improvement.amount || 1,
                        source: 'Race'
                    }));
            }

            // Get fixed improvements from subrace if selected
            let subraceImprovements = [];
            if (subraceToUse) {
                // Check if subrace has ability property
                if (subraceToUse.ability) {
                    // Get all subrace ability improvements
                    const allSubraceImprovements = this._normalizeAbilityImprovements(
                        Array.isArray(subraceToUse.ability) ? subraceToUse.ability : [subraceToUse.ability]
                    );

                    // Filter to only fixed (non-choice) improvements
                    subraceImprovements = allSubraceImprovements
                        .filter(improvement => improvement && !improvement.isChoice && improvement.ability)
                        .map(improvement => ({
                            ability: improvement.ability,
                            value: improvement.amount || 1,
                            source: 'Subrace'
                        }));
                }
            }

            // Return combined improvements from race and subrace
            return [...raceImprovements, ...subraceImprovements];

        } catch (error) {
            console.error('Error getting fixed ability improvements:', error);
            return [];
        }
    }

    /**
     * Get combined traits from race and subrace
     * @param {Race} [race=null] - Race to get traits for (defaults to selected race)
     * @param {Object} [subrace=null] - Subrace to get traits for (defaults to selected subrace)
     * @returns {Array} Array of combined traits
     */
    getCombinedTraits(race = null, subrace = null) {
        const raceToUse = race || this._selectedRace;
        const subraceToUse = subrace || this._selectedSubrace;
        const traits = [];

        try {
            if (raceToUse) {
                // Safely get traits from the race
                let raceTraits = [];
                if (raceToUse.getTraits && typeof raceToUse.getTraits === 'function') {
                    raceTraits = raceToUse.getTraits() || [];
                } else if (raceToUse.entries && Array.isArray(raceToUse.entries)) {
                    // If getTraits doesn't exist, try to get traits from entries
                    raceTraits = raceToUse.entries.filter(entry => typeof entry === 'object') || [];
                }

                // Filter out traits that are displayed elsewhere
                const filteredTraits = raceTraits.filter(trait => {
                    if (!trait) return false;
                    const name = trait?.name?.toLowerCase() || '';
                    return !name.includes('age') && !name.includes('speed') &&
                        !name.includes('size') && !name.includes('ability score');
                });

                traits.push(...filteredTraits);
            }

            if (subraceToUse) {
                // Get traits from subrace entries
                const subraceEntries = subraceToUse.entries || [];

                // Filter out traits that are displayed elsewhere
                const filteredSubraceTraits = subraceEntries.filter(trait => {
                    if (!trait) return false;
                    const name = trait?.name?.toLowerCase() || '';
                    return !name.includes('age') && !name.includes('speed') &&
                        !name.includes('size') && !name.includes('ability score');
                });

                traits.push(...filteredSubraceTraits);
            }

            return traits;
        } catch (error) {
            console.error('Error getting combined traits:', error);
            return [];
        }
    }
}

export const raceManager = new RaceManager();
