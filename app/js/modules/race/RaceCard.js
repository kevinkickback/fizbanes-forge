/**
 * RaceCard.js
 * Controller for the race selection UI component.
 * Coordinates between views and manages race/subrace selection logic.
 */

import { raceService } from '../../services/RaceService.js';
import { eventBus, EVENTS } from '../../infrastructure/EventBus.js';
import { AppState } from '../../core/AppState.js';
import { CharacterManager } from '../../core/CharacterManager.js';
import { RaceCardView } from './RaceView.js';
import { SubracePickerView } from './SubracePicker.js';
import { RaceDetailsView } from './RaceDetails.js';

/**
 * Controller for race selection and display
 */
export class RaceCard {
    /**
     * Creates a new RaceCard instance
     */
    constructor() {
        /**
         * Reference to the race service
         * @type {RaceService}
         * @private
         */
        this._raceService = raceService;

        /**
         * View for race selection and quick description
         * @type {RaceCardView}
         * @private
         */
        this._cardView = new RaceCardView();

        /**
         * View for subrace selection
         * @type {SubracePickerView}
         * @private
         */
        this._subraceView = new SubracePickerView();

        /**
         * View for race details display
         * @type {RaceDetailsView}
         * @private
         */
        this._detailsView = new RaceDetailsView();

        // Initialize the component
        this.initialize();
    }

    //-------------------------------------------------------------------------
    // Initialization Methods
    //-------------------------------------------------------------------------

    /**
     * Initializes the race card UI components and event listeners
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // Initialize required dependencies
            await this._raceService.initialize();

            // Set up event listeners
            this._setupEventListeners();

            // Load saved race selection from character data
            await this._loadSavedRaceSelection();
        } catch (error) {
            console.error('Failed to initialize race card:', error);
        }
    }

    /**
     * Sets up event listeners for race and subrace selection changes
     * @private
     */
    _setupEventListeners() {
        // Listen to view events via EventBus instead of callbacks
        eventBus.on(EVENTS.RACE_SELECTED, (raceData) => {
            this._handleRaceChange({ target: { value: raceData.value } });
        });
        eventBus.on(EVENTS.SUBRACE_SELECTED, (subraceData) => {
            this._handleSubraceChange({ target: { value: subraceData.value } });
        });

        // Listen for character selection changes (when new character is loaded)
        eventBus.on(EVENTS.CHARACTER_SELECTED, () => {
            this._handleCharacterChanged();
        });
    }

    //-------------------------------------------------------------------------
    // Data Loading Methods
    //-------------------------------------------------------------------------

    /**
     * Loads and sets the saved race selection from the character data
     * @returns {Promise<void>}
     * @private
     */
    async _loadSavedRaceSelection() {
        try {
            // Populate race dropdown first
            await this._populateRaceSelect();

            const character = AppState.getCurrentCharacter();
            if (!character?.race?.name || !character?.race?.source) {
                return; // No saved race to load
            }

            // Set the race selection if it exists in available options
            const raceValue = `${character.race.name}_${character.race.source}`;

            if (this._cardView.hasRaceOption(raceValue)) {
                this._cardView.setSelectedRaceValue(raceValue);
                // Update UI from character data (skip unsaved event)
                await this._handleRaceChange({ target: { value: raceValue } }, true);

                // Also set subrace if one was selected
                if (character.race.subrace) {
                    // Wait for subrace options to populate
                    await new Promise(resolve => setTimeout(resolve, 100));

                    if (this._subraceView.hasSubraceOption(character.race.subrace)) {
                        this._subraceView.setSelectedSubraceValue(character.race.subrace);
                        // Optionally, update UI for subrace as well
                        // await this._handleSubraceChange({ target: { value: character.race.subrace } }, true);
                    }
                }
            } else {
                console.warn(`Saved race "${raceValue}" not found in available options. Character might use a source that's not currently allowed.`);
            }
        } catch (error) {
            console.error('Error loading saved race selection:', error);
        }
    }

    /**
     * Populates the race selection dropdown with all available races
     * filtered by allowed sources
     * @returns {Promise<void>}
     * @private
     */
    async _populateRaceSelect() {
        try {
            const races = this._raceService.getAllRaces();
            if (!races || races.length === 0) {
                console.error('No races available to populate dropdown');
                return;
            }

            const currentCharacter = CharacterManager.getCurrentCharacter();
            const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
            const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

            // Filter races by allowed sources
            const filteredRaces = races.filter(race => {
                const raceSource = race.source?.toUpperCase();
                return upperAllowedSources.has(raceSource);
            });

            if (filteredRaces.length === 0) {
                console.error('No races available after source filtering');
                return;
            }

            // Populate view
            this._cardView.populateRaceSelect(filteredRaces);
        } catch (error) {
            console.error('Error populating race dropdown:', error);
        }
    }

    /**
     * Populates the subrace selection dropdown based on the currently selected race
     * filtered by allowed sources
     * @param {Object} race - The selected race data
     * @returns {Promise<void>}
     * @private
     */
    async _populateSubraceSelect(race) {
        if (!race) {
            this._subraceView.reset();
            return;
        }

        try {
            // Get subraces from service
            const subraces = this._raceService.getSubraces(race.name, race.source);

            if (!subraces || subraces.length === 0) {
                this._subraceView.reset();
                return;
            }

            const currentCharacter = CharacterManager.getCurrentCharacter();
            const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
            const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

            // Filter subraces by allowed sources and validate they have names
            const filteredSubraces = subraces.filter(subrace => {
                const subraceSource = subrace.source?.toUpperCase() || race.source.toUpperCase();
                return upperAllowedSources.has(subraceSource) && subrace.name && subrace.name.trim() !== '';
            });

            // Populate view
            this._subraceView.populateSubraceSelect(filteredSubraces);
        } catch (error) {
            console.error('Error loading subraces for dropdown:', error);
        }
    }

    //-------------------------------------------------------------------------
    // Event Handlers
    //-------------------------------------------------------------------------

    /**
     * Handles race selection change events
     * @param {Event} event - The change event
     * @returns {Promise<void>}
     * @private
     */
    async _handleRaceChange(event) {
        try {
            const [raceName, source] = event.target.value.split('_');

            if (!raceName || !source) {
                this.resetRaceDetails();
                await this._populateSubraceSelect(null);
                return;
            }

            const raceData = this._raceService.getRace(raceName, source);
            if (!raceData) {
                console.error(`Race not found: ${raceName} (${source})`);
                return;
            }

            // Check if there's a nameless subrace (base variant like Human PHB)
            const namelessSubrace = this._getNamelessSubrace(raceName, source);

            // Get fluff data for quick description
            const fluffData = this._raceService.getRaceFluff(raceData.name, raceData.source);

            // Update the UI with the selected race data
            await this._cardView.updateQuickDescription(raceData, fluffData);
            await this._detailsView.updateAllDetails(raceData, namelessSubrace);
            await this._populateSubraceSelect(raceData);

            // Update character data
            this._updateCharacterRace(raceData, namelessSubrace);

            // Emit event to notify about character update (unsaved changes)
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { character: CharacterManager.getCurrentCharacter() });

        } catch (error) {
            console.error('Error handling race change:', error);
        }
    }

    /**
     * Handles subrace selection change events
     * @param {Event} event - The change event
     * @returns {Promise<void>}
     * @private
     */
    async _handleSubraceChange(event) {
        try {
            const subraceName = event.target.value;
            const raceValue = this._cardView.getSelectedRaceValue();
            const [raceName, source] = raceValue.split('_');

            if (!raceName || !source) {
                return;
            }

            const raceData = this._raceService.getRace(raceName, source);
            if (!raceData) {
                console.error(`Race not found: ${raceName} (${source})`);
                return;
            }

            let subraceData = null;
            if (subraceName) {
                subraceData = this._raceService.getSubrace(raceName, subraceName, source);
            } else {
                // If no subrace selected, check for nameless base variant
                subraceData = this._getNamelessSubrace(raceName, source);
            }

            // Update the UI with the subrace data
            await this._detailsView.updateAllDetails(raceData, subraceData);

            // Update character data
            this._updateCharacterRace(raceData, subraceData);

            // Emit event to notify about character update (unsaved changes)
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { character: CharacterManager.getCurrentCharacter() });

        } catch (error) {
            console.error('Error handling subrace change:', error);
        }
    }

    /**
     * Handles character selection change events
     * @returns {Promise<void>}
     * @private
     */
    async _handleCharacterChanged() {
        try {
            // Reload race selection to match character's race
            await this._loadSavedRaceSelection();

        } catch (error) {
            console.error('Error handling character changed event:', error);
        }
    }

    //-------------------------------------------------------------------------
    // UI Update Methods
    //-------------------------------------------------------------------------

    /**
     * Reset race details to placeholder state
     */
    resetRaceDetails() {
        this._cardView.resetQuickDescription();
        this._detailsView.resetAllDetails();
    }

    /**
     * Updates the display of race details for the selected race
     * @param {Object} raceData - The race data to display
     * @returns {Promise<void>}
     */
    async updateRaceDetails(raceData) {
        if (!raceData) {
            this.resetRaceDetails();
            return;
        }

        // Get fluff data for quick description
        const fluffData = this._raceService.getRaceFluff(raceData.name, raceData.source);

        // Update the UI with the selected race data
        await this._cardView.updateQuickDescription(raceData, fluffData);

        // Check if there's a nameless subrace (base variant like Human PHB)
        const namelessSubrace = this._getNamelessSubrace(raceData.name, raceData.source);

        await this._detailsView.updateAllDetails(raceData, namelessSubrace);
        await this._populateSubraceSelect(raceData);
    }

    /**
     * Get nameless subrace data (base variant like Human PHB)
     * @param {string} raceName - Name of the race
     * @param {string} source - Source of the race
     * @returns {Object|null} Nameless subrace data or null
     * @private
     */
    _getNamelessSubrace(raceName, source) {
        const subraces = this._raceService.getSubraces(raceName, source);
        // Find a subrace entry with no name - this is the base variant
        return subraces.find(sr => !sr.name || sr.name.trim() === '') || null;
    }

    //-------------------------------------------------------------------------
    // Character Data Management
    //-------------------------------------------------------------------------

    /**
     * Update character's race information
     * @param {Object} race - Selected race
     * @param {Object} subrace - Selected subrace
     * @private
     */
    _updateCharacterRace(race, subrace) {
        const character = CharacterManager.getCurrentCharacter();
        if (!character) return;

        // We want to do a more thorough cleanup, so always treat as changed
        const forceCleanup = true;

        // Check if race has changed
        const hasChanged = forceCleanup ||
            (character.race?.name !== race?.name ||
                character.race?.source !== race?.source ||
                character.race?.subrace !== (subrace?.name || ''));

        if (hasChanged) {
            // Perform thorough cleanup of all race-related benefits

            // Clear all ability bonuses from race and subrace
            character.clearAbilityBonuses('Race');
            character.clearAbilityBonuses('Subrace');

            // Clear bonuses added from previous racial choices
            character.clearAbilityBonusesByPrefix('Race Choice');

            // Clear the AbilityScoreManager's stored choices
            if (window.abilityScoreManager) {
                window.abilityScoreManager.clearStoredChoices();
            }

            // Clear all pending ability choices (configurations)
            character.clearPendingChoicesByType('ability');

            // Clear all proficiencies from race and subrace
            character.removeProficienciesBySource('Race');
            character.removeProficienciesBySource('Subrace');

            // Clear all traits from race and subrace
            character.clearTraits('Race');
            character.clearTraits('Subrace');

            // Reset racial features
            character.features.darkvision = 0;
            character.features.resistances.clear();

            // Clear optional proficiencies for race
            if (character.optionalProficiencies) {
                // Clear race skills
                if (character.optionalProficiencies.skills?.race) {
                    character.optionalProficiencies.skills.race.allowed = 0;
                    character.optionalProficiencies.skills.race.options = [];
                    character.optionalProficiencies.skills.race.selected = [];
                }

                // Clear race languages
                if (character.optionalProficiencies.languages?.race) {
                    character.optionalProficiencies.languages.race.allowed = 0;
                    character.optionalProficiencies.languages.race.options = [];
                    character.optionalProficiencies.languages.race.selected = [];
                }

                // Clear race tools
                if (character.optionalProficiencies.tools?.race) {
                    character.optionalProficiencies.tools.race.allowed = 0;
                    character.optionalProficiencies.tools.race.options = [];
                    character.optionalProficiencies.tools.race.selected = [];
                }
            }

            // Notify UI to clear optional proficiencies from race and trigger full UI refresh
            document.dispatchEvent(new CustomEvent('proficienciesRemoved', {
                detail: { source: 'Race', triggerRefresh: true }
            }));

            // Reset cached selected ability score choices
            try {
                window.abilityScoreManager?.setRacialAbilityChoices([]);
            } catch (e) {
                console.error('Error clearing ability score choices:', e);
            }

            if (!race) {
                // Clear race
                character.race = {
                    name: '',
                    source: '',
                    subrace: ''
                };
            } else {
                // Set race
                character.race = {
                    name: race.name,
                    source: race.source,
                    subrace: subrace?.name || ''
                };

                // Update character size and speed
                character.size = race.size;
                character.speed = { ...race.speed };

                // Update ability scores and get new choices
                this._updateAbilityBonuses(race, subrace);

                // Add traits
                this._updateRacialTraits(race, subrace);

                // Add proficiencies
                this._updateRaceProficiencies(race, subrace);

                // Force a refresh after a short delay to ensure everything is updated
                setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('proficiencyChanged', {
                        detail: { triggerCleanup: true, forcedRefresh: true }
                    }));
                }, 100);
            }

            // Trigger events to update the UI with longer delays to ensure complete refresh
            document.dispatchEvent(new CustomEvent('raceChanged', { detail: { race, subrace } }));

            setTimeout(() => {
                document.dispatchEvent(new CustomEvent('characterChanged'));
                document.dispatchEvent(new CustomEvent('abilityScoresChanged', { detail: { character } }));

                // Additional refresh for UI components
                document.dispatchEvent(new CustomEvent('updateUI', { detail: { fullRefresh: true } }));
            }, 150);
        }
    }

    /**
     * Updates ability bonuses based on race and subrace
     * @param {Object} race - Selected race
     * @param {Object} subrace - Selected subrace
     * @private
     */
    _updateAbilityBonuses(race, subrace) {
        const character = CharacterManager.getCurrentCharacter();
        if (!character || !race) return;

        // Clear existing ability bonuses from race and subrace
        character.clearAbilityBonuses('Race');
        character.clearAbilityBonuses('Subrace');
        character.clearPendingAbilityChoices();

        try {
            // Special handling for Half-Elf (PHB)
            if (race.name === 'Half-Elf' && race.source === 'PHB') {
                // Add fixed +2 Charisma bonus
                character.addAbilityBonus('charisma', 2, 'Race');
            }

            // Add fixed ability improvements (passing race and subrace directly)
            const fixedImprovements = this._getFixedAbilityImprovements(race, subrace);

            for (const improvement of fixedImprovements) {
                if (!improvement || !improvement.ability) {
                    console.warn('Invalid ability improvement:', improvement);
                    continue;
                }

                // Skip Half-Elf's Charisma bonus as it's already handled
                if (race.name === 'Half-Elf' && race.source === 'PHB' &&
                    improvement.ability === 'charisma' && improvement.source === 'Race') {
                    continue;
                }

                // Apply race improvements
                if (improvement.source === 'Race') {
                    character.addAbilityBonus(improvement.ability, improvement.value || improvement.amount || 1, improvement.source);
                }
                // Apply subrace improvements
                else if (improvement.source === 'Subrace') {
                    character.addAbilityBonus(improvement.ability, improvement.value || improvement.amount || 1, improvement.source);
                }
            }

            // Add ability score choices
            const choices = this._getAbilityScoreChoices(race, subrace);

            // If we have any choices, process them
            if (choices && choices.length > 0) {
                for (const choice of choices) {
                    character.addPendingAbilityChoice({
                        count: choice.count,
                        amount: choice.amount,
                        from: choice.from,
                        source: choice.source
                    });
                }
            }
        } catch (error) {
            console.error('Error updating ability bonuses:', error);
        }

        // Notify of changes
        document.dispatchEvent(new CustomEvent('abilityScoresChanged', { detail: { character } }));
    }

    /**
     * Updates racial traits based on race and subrace
     * @param {Object} race - Selected race
     * @param {Object} subrace - Selected subrace
     * @private
     */
    _updateRacialTraits(race, subrace) {
        const character = CharacterManager.getCurrentCharacter();
        if (!character || !race) return;

        // Clear existing racial traits
        character.clearTraits('Race');
        if (subrace) {
            character.clearTraits('Subrace');
        }

        // Add race traits
        if (race.entries && Array.isArray(race.entries)) {
            for (const entry of race.entries) {
                if (entry.type === 'entries' && entry.name) {
                    character.addTrait(entry.name, entry, 'Race');
                }
            }
        }

        // Add subrace traits
        if (subrace?.entries && Array.isArray(subrace.entries)) {
            for (const entry of subrace.entries) {
                if (entry.type === 'entries' && entry.name) {
                    character.addTrait(entry.name, entry, 'Subrace');
                }
            }
        }
    }

    /**
     * Update character's proficiencies based on race and subrace
     * @param {Object} race - Selected race
     * @param {Object} subrace - Selected subrace
     * @private
     */
    _updateRaceProficiencies(race, subrace) {
        const character = CharacterManager.getCurrentCharacter();
        if (!character || !race) return;

        // Store previously selected proficiencies to restore valid ones later
        const previousRaceSkills = character.optionalProficiencies.skills.race?.selected || [];
        const previousRaceLanguages = character.optionalProficiencies.languages.race?.selected || [];
        const previousRaceTools = character.optionalProficiencies.tools.race?.selected || [];

        // Reset race proficiency options
        character.optionalProficiencies.skills.race.allowed = 0;
        character.optionalProficiencies.skills.race.options = [];
        character.optionalProficiencies.skills.race.selected = [];

        character.optionalProficiencies.languages.race.allowed = 0;
        character.optionalProficiencies.languages.race.options = [];
        character.optionalProficiencies.languages.race.selected = [];

        character.optionalProficiencies.tools.race.allowed = 0;
        character.optionalProficiencies.tools.race.options = [];
        character.optionalProficiencies.tools.race.selected = [];

        // Process language proficiencies
        this._processLanguageProficiencies(race, character, previousRaceLanguages);

        // Process weapon proficiencies
        this._processWeaponProficiencies(race, character);

        // Process tool proficiencies
        this._processToolProficiencies(race, character, previousRaceTools);

        // Process skill proficiencies
        this._processSkillProficiencies(race, subrace, character, previousRaceSkills);

        // Update combined options for all proficiency types
        this._updateCombinedProficiencyOptions(character);

        // Notify UI to update proficiencies
        document.dispatchEvent(new CustomEvent('proficiencyChanged'));
    }

    /**
     * Process language proficiencies from race data
     * @param {Object} race - Race data
     * @param {Object} character - Character object
     * @param {Array} previousSelections - Previously selected languages
     * @private
     */
    _processLanguageProficiencies(race, character, previousSelections) {
        if (!race.languageProficiencies || !Array.isArray(race.languageProficiencies)) return;

        let languageCount = 0;
        let languageOptions = [];
        const specificLanguageChoices = new Set();

        for (const profObj of race.languageProficiencies) {
            for (const [key, value] of Object.entries(profObj)) {
                // Handle fixed languages
                if (value === true && key !== 'anyStandard' && key !== 'any' && key !== 'choose' && key !== 'other') {
                    const capitalizedLanguage = key.charAt(0).toUpperCase() + key.slice(1);
                    character.addProficiency('languages', capitalizedLanguage, 'Race');
                }
                // Handle race's unique language ('other')
                else if (key === 'other' && value === true) {
                    if (race.name !== 'Common') {
                        character.addProficiency('languages', race.name, 'Race');
                    }
                }
                // Handle 'any'/'anyStandard' choices
                else if ((key === 'anyStandard' || key === 'any') && typeof value === 'number' && value > 0) {
                    languageCount += value;
                    languageOptions = [
                        'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin',
                        'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic',
                        'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'
                    ];
                }
                // Handle specific 'choose' lists
                else if (key === 'choose' && typeof value === 'object' && value.from && value.count > 0) {
                    languageCount += value.count;
                    const capitalizedOptions = value.from.map(lang => lang.charAt(0).toUpperCase() + lang.slice(1));
                    for (const lang of capitalizedOptions) {
                        specificLanguageChoices.add(lang);
                    }
                }
            }
        }

        // If specific choices were found, use those as options
        if (specificLanguageChoices.size > 0) {
            languageOptions = Array.from(specificLanguageChoices);
        }

        // Update optional proficiencies if choices were found
        if (languageCount > 0) {
            character.optionalProficiencies.languages.race.allowed = languageCount;
            character.optionalProficiencies.languages.race.options = languageOptions;
            character.optionalProficiencies.languages.race.selected = previousSelections.filter(
                lang => languageOptions.includes(lang)
            );
        }
    }

    /**
     * Process weapon proficiencies from race data
     * @param {Object} race - Race data
     * @param {Object} character - Character object
     * @private
     */
    _processWeaponProficiencies(race, character) {
        if (!race.weaponProficiencies || !Array.isArray(race.weaponProficiencies)) return;

        for (const profObj of race.weaponProficiencies) {
            for (const [weapon, hasProf] of Object.entries(profObj)) {
                if (hasProf === true) {
                    // Extract the weapon name without the source
                    const weaponName = weapon.split('|')[0];
                    const capitalizedWeapon = weaponName.charAt(0).toUpperCase() + weaponName.slice(1);
                    character.addProficiency('weapons', capitalizedWeapon, 'Race');
                }
            }
        }
    }

    /**
     * Process tool proficiencies from race data
     * @param {Object} race - Race data
     * @param {Object} character - Character object
     * @param {Array} previousSelections - Previously selected tools
     * @private
     */
    _processToolProficiencies(race, character, previousSelections) {
        if (!race.toolProficiencies || !Array.isArray(race.toolProficiencies)) return;

        for (const profObj of race.toolProficiencies) {
            // Handle fixed tool proficiencies
            for (const [tool, hasProf] of Object.entries(profObj)) {
                if (hasProf === true && tool !== 'any') {
                    const capitalizedTool = tool.charAt(0).toUpperCase() + tool.slice(1);
                    character.addProficiency('tools', capitalizedTool, 'Race');
                }
            }

            // Handle "any" tool proficiency choice
            if (profObj.any && profObj.any > 0) {
                character.optionalProficiencies.tools.race.allowed = profObj.any;
                character.optionalProficiencies.tools.race.options = [
                    'Alchemist\'s supplies', 'Brewer\'s supplies', 'Calligrapher\'s supplies',
                    'Carpenter\'s tools', 'Cartographer\'s tools', 'Cobbler\'s tools',
                    'Cook\'s utensils', 'Glassblower\'s tools', 'Jeweler\'s tools',
                    'Leatherworker\'s tools', 'Mason\'s tools', 'Painter\'s supplies',
                    'Potter\'s tools', 'Smith\'s tools', 'Tinker\'s tools',
                    'Weaver\'s tools', 'Woodcarver\'s tools', 'Disguise kit',
                    'Forgery kit', 'Herbalism kit', 'Navigator\'s tools',
                    'Poisoner\'s kit', 'Thieves\' tools', 'Musical instrument'
                ];
                character.optionalProficiencies.tools.race.selected = previousSelections.filter(
                    tool => character.optionalProficiencies.tools.race.options.includes(tool)
                );
            }
        }
    }

    /**
     * Process skill proficiencies from race data
     * @param {Object} race - Race data
     * @param {Object} subrace - Subrace data
     * @param {Object} character - Character object
     * @param {Array} previousSelections - Previously selected skills
     * @private
     */
    _processSkillProficiencies(race, subrace, character, previousSelections) {
        let raceSkillCount = 0;
        let raceSkillOptions = [];

        // Handle skill proficiencies if available
        if (race.skillProficiencies && Array.isArray(race.skillProficiencies)) {
            for (const profObj of race.skillProficiencies) {
                // Handle "any" skill proficiency choice
                if (profObj.any) {
                    raceSkillCount += profObj.any;
                    raceSkillOptions = [
                        'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
                        'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
                        'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
                        'Sleight of Hand', 'Stealth', 'Survival'
                    ];
                    continue;
                }

                // Handle fixed skill proficiencies
                for (const [skill, hasProf] of Object.entries(profObj)) {
                    if (hasProf === true && skill !== 'choose') {
                        const capitalizedSkill = skill.charAt(0).toUpperCase() + skill.slice(1);
                        character.addProficiency('skills', capitalizedSkill, 'Race');
                    }
                }

                // Handle skill choices with specific options
                if (profObj.choose && profObj.choose.count > 0) {
                    raceSkillCount += profObj.choose.count;
                    if (profObj.choose.from && Array.isArray(profObj.choose.from)) {
                        const capitalizedOptions = profObj.choose.from.map(skill => {
                            return skill.charAt(0).toUpperCase() + skill.slice(1);
                        });
                        raceSkillOptions.push(...capitalizedOptions);
                    }
                }
            }
        }

        // Special case for Human Variant - always 1 skill of any choice
        if (race.name === "Human" && race.source === "PHB" && subrace && subrace.name === "Variant") {
            raceSkillCount = 1;
            raceSkillOptions = [
                'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
                'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
                'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
                'Sleight of Hand', 'Stealth', 'Survival'
            ];
        }

        // Update race-specific skill options and count
        if (raceSkillCount > 0) {
            character.optionalProficiencies.skills.race.allowed = raceSkillCount;
            character.optionalProficiencies.skills.race.options = raceSkillOptions;
            character.optionalProficiencies.skills.race.selected = previousSelections.filter(
                skill => raceSkillOptions.includes(skill)
            );
        }
    }

    /**
     * Updates the combined proficiency options from race, class, and background
     * @param {Object} character - The character object
     * @private
     */
    _updateCombinedProficiencyOptions(character) {
        if (!character) return;

        // Update skill options
        this._updateCombinedSkillOptions(character);

        // Update language options
        const raceLanguageAllowed = character.optionalProficiencies.languages.race?.allowed || 0;
        const classLanguageAllowed = character.optionalProficiencies.languages.class?.allowed || 0;
        const backgroundLanguageAllowed = character.optionalProficiencies.languages.background?.allowed || 0;

        const raceLanguageOptions = character.optionalProficiencies.languages.race?.options || [];
        const classLanguageOptions = character.optionalProficiencies.languages.class?.options || [];
        const backgroundLanguageOptions = character.optionalProficiencies.languages.background?.options || [];

        const raceLanguageSelected = character.optionalProficiencies.languages.race?.selected || [];
        const classLanguageSelected = character.optionalProficiencies.languages.class?.selected || [];
        const backgroundLanguageSelected = character.optionalProficiencies.languages.background?.selected || [];

        character.optionalProficiencies.languages.allowed = raceLanguageAllowed + classLanguageAllowed + backgroundLanguageAllowed;
        character.optionalProficiencies.languages.selected = [...new Set([...raceLanguageSelected, ...classLanguageSelected, ...backgroundLanguageSelected])];
        character.optionalProficiencies.languages.options = [...new Set([...raceLanguageOptions, ...classLanguageOptions, ...backgroundLanguageOptions])];

        // Update tool options
        const raceToolAllowed = character.optionalProficiencies.tools.race?.allowed || 0;
        const classToolAllowed = character.optionalProficiencies.tools.class?.allowed || 0;
        const backgroundToolAllowed = character.optionalProficiencies.tools.background?.allowed || 0;

        const raceToolOptions = character.optionalProficiencies.tools.race?.options || [];
        const classToolOptions = character.optionalProficiencies.tools.class?.options || [];
        const backgroundToolOptions = character.optionalProficiencies.tools.background?.options || [];

        const raceToolSelected = character.optionalProficiencies.tools.race?.selected || [];
        const classToolSelected = character.optionalProficiencies.tools.class?.selected || [];
        const backgroundToolSelected = character.optionalProficiencies.tools.background?.selected || [];

        character.optionalProficiencies.tools.allowed = raceToolAllowed + classToolAllowed + backgroundToolAllowed;
        character.optionalProficiencies.tools.selected = [...new Set([...raceToolSelected, ...classToolSelected, ...backgroundToolSelected])];
        character.optionalProficiencies.tools.options = [...new Set([...raceToolOptions, ...classToolOptions, ...backgroundToolOptions])];
    }

    /**
     * Updates the combined skill options from race, class, and background
     * @param {Object} character - The character object
     * @private
     */
    _updateCombinedSkillOptions(character) {
        if (!character) return;

        const raceAllowed = character.optionalProficiencies.skills.race?.allowed || 0;
        const classAllowed = character.optionalProficiencies.skills.class?.allowed || 0;
        const backgroundAllowed = character.optionalProficiencies.skills.background?.allowed || 0;

        const raceOptions = character.optionalProficiencies.skills.race?.options || [];
        const classOptions = character.optionalProficiencies.skills.class?.options || [];
        const backgroundOptions = character.optionalProficiencies.skills.background?.options || [];

        const raceSelected = character.optionalProficiencies.skills.race?.selected || [];
        const classSelected = character.optionalProficiencies.skills.class?.selected || [];
        const backgroundSelected = character.optionalProficiencies.skills.background?.selected || [];

        character.optionalProficiencies.skills.allowed = raceAllowed + classAllowed + backgroundAllowed;
        character.optionalProficiencies.skills.selected = [...new Set([...raceSelected, ...classSelected, ...backgroundSelected])];
        character.optionalProficiencies.skills.options = [...new Set([...raceOptions, ...classOptions, ...backgroundOptions])];
    }

    //-------------------------------------------------------------------------
    // Data Extraction Helper Methods
    //-------------------------------------------------------------------------

    /**
     * Get fixed ability improvements from race and subrace data
     * @param {Object} race - Race JSON object
     * @param {Object} subrace - Subrace JSON object (optional)
     * @returns {Array} Array of improvement objects {ability, value, source}
     * @private
     */
    _getFixedAbilityImprovements(race, subrace) {
        const improvements = [];

        // Process race abilities
        if (race?.ability) {
            for (const abilityEntry of race.ability) {
                if (!abilityEntry.choose) {
                    for (const [ability, bonus] of Object.entries(abilityEntry)) {
                        if (bonus && typeof bonus === 'number') {
                            improvements.push({
                                ability: ability,
                                value: bonus,
                                amount: bonus,
                                source: 'Race'
                            });
                        }
                    }
                }
            }
        }

        // Process subrace abilities
        if (subrace?.ability) {
            for (const abilityEntry of subrace.ability) {
                if (!abilityEntry.choose) {
                    for (const [ability, bonus] of Object.entries(abilityEntry)) {
                        if (bonus && typeof bonus === 'number') {
                            improvements.push({
                                ability: ability,
                                value: bonus,
                                amount: bonus,
                                source: 'Subrace'
                            });
                        }
                    }
                }
            }
        }

        return improvements;
    }

    /**
     * Get ability score choices from race and subrace data
     * @param {Object} race - Race data
     * @param {Object} subrace - Subrace data
     * @returns {Array} Array of choice objects
     * @private
     */
    _getAbilityScoreChoices(race, subrace) {
        const choices = [];

        // Process race ability choices
        if (race?.ability) {
            for (const abilityEntry of race.ability) {
                if (abilityEntry.choose) {
                    choices.push({
                        count: abilityEntry.choose.count || 1,
                        amount: abilityEntry.choose.amount || 1,
                        from: abilityEntry.choose.from || ['str', 'dex', 'con', 'int', 'wis', 'cha'],
                        source: 'Race'
                    });
                }
            }
        }

        // Process subrace ability choices
        if (subrace?.ability) {
            for (const abilityEntry of subrace.ability) {
                if (abilityEntry.choose) {
                    choices.push({
                        count: abilityEntry.choose.count || 1,
                        amount: abilityEntry.choose.amount || 1,
                        from: abilityEntry.choose.from || ['str', 'dex', 'con', 'int', 'wis', 'cha'],
                        source: 'Subrace'
                    });
                }
            }
        }

        return choices;
    }
}
