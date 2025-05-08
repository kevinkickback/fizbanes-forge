/**
 * RaceCard.js
 * Handles UI updates for race selection and displays race details.
 * 
 * @typedef {Object} Race
 * @property {string} name - Name of the race
 * @property {string} source - Source book of the race
 * @property {Array<Object>} entries - Race description entries
 * @property {Array<Object>} subraces - Available subraces
 * 
 * @typedef {Object} Subrace
 * @property {string} name - Name of the subrace
 * @property {string} source - Source book of the subrace
 * @property {Array<Object>} entries - Subrace description entries
 */

import { raceManager } from '../managers/RaceManager.js';
import { textProcessor } from '../utils/TextProcessor.js';
import { tooltipManager } from '../managers/TooltipManager.js';
import { characterHandler } from '../utils/characterHandler.js';
import { abilityScoreManager } from '../managers/AbilityScoreManager.js';

/**
 * Manages the race selection UI component and related functionality
 */
export class RaceCard {
    /**
     * Creates a new RaceCard instance
     */
    constructor() {
        /**
         * Reference to the race manager singleton
         * @type {RaceManager}
         * @private
         */
        this._raceManager = raceManager;

        /**
         * The main race selection dropdown element
         * @type {HTMLSelectElement}
         * @private
         */
        this._raceSelect = document.getElementById('raceSelect');

        /**
         * The subrace selection dropdown element
         * @type {HTMLSelectElement}
         * @private
         */
        this._subraceSelect = document.getElementById('subraceSelect');

        /**
         * The quick description element for displaying race summary
         * @type {HTMLElement}
         * @private
         */
        this._raceQuickDesc = document.getElementById('raceQuickDesc');

        /**
         * The container element for race details
         * @type {HTMLElement}
         * @private
         */
        this._raceDetails = document.getElementById('raceDetails');

        // Initialize the component
        this.initialize();
    }

    /**
     * Initializes the race card UI components and event listeners
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // Initialize required dependencies
            await this._raceManager.initialize();
            await textProcessor.initialize();
            tooltipManager.initialize();

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
        this._raceSelect.addEventListener('change', event => this._handleRaceChange(event));
        this._subraceSelect.addEventListener('change', event => this._handleSubraceChange(event));
        document.addEventListener('characterChanged', event => this._handleCharacterChanged(event));
    }

    /**
     * Loads and sets the saved race selection from the character data
     * @returns {Promise<void>}
     * @private
     */
    async _loadSavedRaceSelection() {
        try {
            // Populate race dropdown first
            this._populateRaceSelect();

            const character = characterHandler?.currentCharacter;
            if (!character?.race?.name || !character?.race?.source) {
                return; // No saved race to load
            }

            // Set the race selection if it exists in available options
            const raceValue = `${character.race.name}_${character.race.source}`;
            const raceExists = Array.from(this._raceSelect.options).some(option => option.value === raceValue);

            if (raceExists) {
                this._raceSelect.value = raceValue;
                this._raceSelect.dispatchEvent(new Event('change', { bubbles: true }));

                // Also set subrace if one was selected
                if (character.race.subrace) {
                    // Wait for subrace options to populate
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const subraceExists = Array.from(this._subraceSelect.options).some(option => option.value === character.race.subrace);

                    if (subraceExists) {
                        this._subraceSelect.value = character.race.subrace;
                        this._subraceSelect.dispatchEvent(new Event('change', { bubbles: true }));
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
     * @private
     */
    _populateRaceSelect() {
        this._raceSelect.innerHTML = '<option value="">Select a Race</option>';

        const races = this._raceManager.getAllRaces();
        if (!races || races.length === 0) {
            console.error('No races available to populate dropdown');
            return;
        }

        const currentCharacter = characterHandler.currentCharacter;
        const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
        const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

        // Filter races by allowed sources
        const filteredRaces = races.filter(race => {
            const raceSource = race.source?.toUpperCase();
            return upperAllowedSources.has(raceSource);
        });

        // Sort races by name
        filteredRaces.sort((a, b) => a.name.localeCompare(b.name));

        // Add options to select
        for (const race of filteredRaces) {
            const option = document.createElement('option');
            option.value = `${race.name}_${race.source}`;
            option.textContent = `${race.name} (${race.source})`;
            this._raceSelect.appendChild(option);
        }
    }

    /**
     * Populates the subrace selection dropdown based on the currently selected race
     * filtered by allowed sources
     * @param {Race} race - The selected race data
     * @private
     */
    _populateSubraceSelect(race) {
        this._subraceSelect.innerHTML = '<option value="">No Subraces</option>';
        this._subraceSelect.disabled = true;

        if (!race) {
            return;
        }

        if (!race.subraces || race.subraces.length === 0) {
            return;
        }

        const currentCharacter = characterHandler.currentCharacter;
        const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
        const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

        // Filter subraces by allowed sources and validate they have names
        const filteredSubraces = race.subraces.filter(subrace => {
            const subraceSource = subrace.source?.toUpperCase() || race.source.toUpperCase();
            return upperAllowedSources.has(subraceSource) && subrace.name && subrace.name.trim() !== '';
        });

        if (filteredSubraces.length === 0) {
            return;
        }

        // Sort subraces by name
        filteredSubraces.sort((a, b) => a.name.localeCompare(b.name));

        this._subraceSelect.innerHTML = '<option value="">Select Subrace</option>';
        this._subraceSelect.disabled = false;

        // Add options to select
        for (const subrace of filteredSubraces) {
            const option = document.createElement('option');
            option.value = subrace.name;
            option.textContent = subrace.name;
            this._subraceSelect.appendChild(option);
        }
    }

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
                this._populateSubraceSelect(null);
                return;
            }

            const raceData = this._raceManager.getRace(raceName, source);
            if (!raceData) {
                console.error(`Race not found: ${raceName} (${source})`);
                return;
            }

            // Set this race as the selected race in the race manager
            this._raceManager.selectRace(raceName, source);

            // Update the UI with the selected race data
            await this.updateQuickDescription(raceData);
            await this.updateRaceDetails(raceData);
            this._populateSubraceSelect(raceData);

            // Update character data
            this._updateCharacterRace(raceData);

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
            const raceValue = this._raceSelect.value;
            const [raceName, source] = raceValue.split('_');

            if (!raceName || !source) {
                return;
            }

            const raceData = this._raceManager.getRace(raceName, source);
            if (!raceData) {
                console.error(`Race not found: ${raceName} (${source})`);
                return;
            }

            let subraceData = null;
            if (subraceName) {
                subraceData = raceData.getSubrace(subraceName);
                // Also set the subrace in the race manager
                this._raceManager.selectSubrace(subraceName);
            }

            // Update the UI with the subrace data
            await this.updateRaceDetails(raceData, subraceData);

            // Update character data
            this._updateCharacterRace(raceData, subraceData);

        } catch (error) {
            console.error('Error handling subrace change:', error);
        }
    }

    /**
     * Handles character changed events
     * @param {Event} event - The character changed event
     * @returns {Promise<void>}
     * @private
     */
    async _handleCharacterChanged(event) {
        try {
            const character = event.detail?.character;
            if (!character) return;

            // Reload race selection to match character's race
            await this._loadSavedRaceSelection();

        } catch (error) {
            console.error('Error handling character changed event:', error);
        }
    }

    /**
     * Updates the quick description for the selected race
     * @param {Race} race - The race data
     * @returns {Promise<void>}
     */
    async updateQuickDescription(race) {
        if (!race) {
            this._raceQuickDesc.innerHTML = `
                <div class="placeholder-content">
                    <h5>Select a Race</h5>
                    <p>Choose a race to see details about their traits, abilities, and other characteristics.</p>
                </div>
            `;
            return;
        }

        // Get the description from the race entries
        // First look for any string entry, which is typically the description
        let description = '';

        // Try to get the first string entry which is a description
        if (race.entries && Array.isArray(race.entries)) {
            // Find the first string entry (typical race description)
            const firstStringEntry = race.entries.find(entry => typeof entry === 'string');
            if (firstStringEntry) {
                description = firstStringEntry;
            }
            // If no string entry, look for entries with type "entries" which may contain the description
            else {
                const entriesObj = race.entries.find(entry =>
                    entry && typeof entry === 'object' && entry.type === 'entries' && Array.isArray(entry.entries));

                if (entriesObj && entriesObj.entries.length > 0) {
                    const firstEntry = entriesObj.entries[0];
                    if (typeof firstEntry === 'string') {
                        description = firstEntry;
                    }
                }
            }
        }

        // Fallback if no description was found
        if (!description) {
            if (race.getDescription && typeof race.getDescription === 'function') {
                description = race.getDescription();
            } else {
                description = `${race.name} are a playable race in D&D.`;
            }
        }

        const processedDescription = await textProcessor.processString(description);

        this._raceQuickDesc.innerHTML = `
            <h5>${race.name}</h5>
            <p>${processedDescription}</p>
        `;
    }

    /**
     * Updates the display of race details for the selected race and subrace
     * @param {Race} race - The race data to display
     * @param {Subrace} subrace - The optional subrace data
     * @returns {Promise<void>}
     */
    async updateRaceDetails(race, subrace) {
        if (!race) {
            this.resetRaceDetails();
            return;
        }

        await this._updateAbilityScores(race, subrace);
        await this._updateSizeAndSpeed(race);
        await this._updateLanguages(race);
        await this._updateTraits(race, subrace);

        // Process the entire details container to resolve reference tags
        await textProcessor.processElement(this._raceDetails);
    }

    /**
     * Update ability scores section
     * @param {Race} race - Selected race
     * @param {Object} subrace - Selected subrace
     * @private
     */
    async _updateAbilityScores(race, subrace) {
        const abilitySection = this._raceDetails.querySelector('.detail-section:nth-child(1) ul');
        const abilityImprovements = this._raceManager.getFormattedAbilityImprovements(race, subrace).split('\n');
        abilitySection.innerHTML = abilityImprovements.map(improvement => `<li>${improvement}</li>`).join('');
    }

    /**
     * Update size and speed sections
     * @param {Race} race - Selected race
     * @private
     */
    async _updateSizeAndSpeed(race) {
        try {
            const sizeSection = this._raceDetails.querySelector('.detail-section:nth-child(2) ul');

            // Safely get size value
            let sizeValue = 'Medium';
            try {
                // Get size information, handling multiple sizes
                const sizeInfo = race.getSize();

                if (sizeInfo) {
                    if (sizeInfo.value?.includes(' or ')) {
                        // Handle multiple size options (e.g., "Medium or Small")
                        sizeValue = sizeInfo.value;
                    } else if (sizeInfo.value) {
                        // Single size value
                        sizeValue = sizeInfo.value;
                    } else if (sizeInfo.choices && Array.isArray(sizeInfo.choices) && sizeInfo.choices.length > 0) {
                        // Use choices if value is missing but choices exist
                        sizeValue = sizeInfo.choices.join(' or ');
                    }
                }
            } catch (e) {
                console.warn('Error getting race size:', e);
            }

            sizeSection.innerHTML = `<li>${sizeValue}</li>`;

            const speedSection = this._raceDetails.querySelector('.detail-section:nth-child(3) ul');
            const speeds = this._raceManager.getFormattedMovementSpeeds(race).split('\n');
            speedSection.innerHTML = speeds.map(speed => `<li>${speed}</li>`).join('') || '<li>None</li>';
        } catch (error) {
            console.error('Error updating size and speed:', error);

            // Set default values if there's an error
            const sizeSection = this._raceDetails.querySelector('.detail-section:nth-child(2) ul');
            sizeSection.innerHTML = '<li>Medium</li>';

            const speedSection = this._raceDetails.querySelector('.detail-section:nth-child(3) ul');
            speedSection.innerHTML = '<li>Walk: 30 ft.</li>';
        }
    }

    /**
     * Update languages section
     * @param {Race} race - Selected race
     * @private
     */
    async _updateLanguages(race) {
        const languageSection = this._raceDetails.querySelector('.detail-section:nth-child(4) ul');
        const languages = this._raceManager.getFormattedLanguages(race).split('\n');
        languageSection.innerHTML = languages.map(language => `<li>${language}</li>`).join('');
    }

    /**
     * Update traits section
     * @param {Race} race - Selected race
     * @param {Object} subrace - Selected subrace
     * @private
     */
    async _updateTraits(race, subrace) {
        const traitsSection = this._raceDetails.querySelector('.traits-section');
        const traits = this._raceManager.getCombinedTraits(race, subrace);

        if (traits.length > 0) {
            const processedTraits = await Promise.all(traits.map(async trait => {
                if (typeof trait === 'string') {
                    return await textProcessor.processString(trait);
                }
                const name = trait.name || trait.text;
                const description = trait.entries ?
                    await textProcessor.processString(Array.isArray(trait.entries) ? trait.entries.join('\n') : trait.entries) :
                    '';
                return `<span class="trait-tag" data-tooltip="${encodeURIComponent(description)}">${name}</span>`;
            }));

            traitsSection.innerHTML = `
                <h6>Traits</h6>
                <div class="traits-grid">
                    ${processedTraits.join('')}
                </div>
            `;
        } else {
            traitsSection.innerHTML = `
                <h6>Traits</h6>
                <div class="traits-grid">
                    <span class="trait-tag">No traits available</span>
                </div>
            `;
        }
    }

    /**
     * Reset the race details section to placeholder state
     */
    resetRaceDetails() {
        const sections = this._raceDetails.querySelectorAll('.detail-section ul');
        for (const section of sections) {
            section.innerHTML = '<li class="placeholder-text">—</li>';
        }
    }

    /**
     * Update character's race information
     * @param {Race} race - Selected race
     * @param {Subrace} subrace - Selected subrace
     * @private
     */
    _updateCharacterRace(race, subrace) {
        const character = characterHandler.currentCharacter;
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
     * Update character's proficiencies based on race and subrace
     * @param {Race} race - Selected race
     * @param {Subrace} subrace - Selected subrace
     * @private
     */
    _updateRaceProficiencies(race, subrace) {
        const character = characterHandler.currentCharacter;
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

        // Add language proficiencies
        if (race.languageProficiencies && Array.isArray(race.languageProficiencies)) {
            let languageCount = 0;
            let languageOptions = [];
            const specificLanguageChoices = new Set(); // Track specific options if choose.from is used

            for (const profObj of race.languageProficiencies) {
                for (const [key, value] of Object.entries(profObj)) {
                    // Handle fixed languages
                    if (value === true && key !== 'anyStandard' && key !== 'any' && key !== 'choose' && key !== 'other') {
                        const capitalizedLanguage = key.charAt(0).toUpperCase() + key.slice(1);
                        character.addProficiency('languages', capitalizedLanguage, 'Race');
                    }
                    // Handle race's unique language ('other')
                    else if (key === 'other' && value === true) {
                        // Add the race's name as a language, if not Common
                        if (race.name !== 'Common') {
                            character.addProficiency('languages', race.name, 'Race');
                        }
                    }
                    // Handle 'any'/'anyStandard' choices
                    else if ((key === 'anyStandard' || key === 'any') && typeof value === 'number' && value > 0) {
                        languageCount += value;
                        // Use a standard list if 'any' or 'anyStandard' is specified
                        // (We assume only one 'any'/'anyStandard' definition per race)
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
                        // Use for...of loop as preferred by linter
                        for (const lang of capitalizedOptions) {
                            specificLanguageChoices.add(lang);
                        }
                    }
                }
            }

            // If specific choices were found, use those as options, otherwise use the standard list if 'any' was chosen
            if (specificLanguageChoices.size > 0) {
                languageOptions = Array.from(specificLanguageChoices);
            }

            // Update optional proficiencies if choices were found
            if (languageCount > 0) {
                character.optionalProficiencies.languages.race.allowed = languageCount;
                character.optionalProficiencies.languages.race.options = languageOptions;

                // Restore valid selections
                character.optionalProficiencies.languages.race.selected = previousRaceLanguages.filter(
                    lang => languageOptions.includes(lang)
                );
            }
        }

        // Handle weapon proficiencies if available
        if (race.weaponProficiencies && Array.isArray(race.weaponProficiencies)) {
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

        // Handle tool proficiencies if available
        if (race.toolProficiencies && Array.isArray(race.toolProficiencies)) {
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

                    // Set standard tools as options
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

                    // Restore valid selections
                    character.optionalProficiencies.tools.race.selected = previousRaceTools.filter(
                        tool => character.optionalProficiencies.tools.race.options.includes(tool)
                    );
                }
            }
        }

        // Calculate race skill proficiency count and options
        let raceSkillCount = 0;
        let raceSkillOptions = [];

        // Handle skill proficiencies if available
        if (race.skillProficiencies && Array.isArray(race.skillProficiencies)) {
            for (const profObj of race.skillProficiencies) {
                // Handle "any" skill proficiency choice
                if (profObj.any) {
                    raceSkillCount += profObj.any;

                    // Add all skills as options for "any" choice
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

                    // Set available skill options if they exist in the race data
                    if (profObj.choose.from && Array.isArray(profObj.choose.from)) {
                        const capitalizedOptions = profObj.choose.from.map(skill => {
                            // Capitalize first letter to maintain consistency
                            return skill.charAt(0).toUpperCase() + skill.slice(1);
                        });
                        raceSkillOptions.push(...capitalizedOptions);
                    }
                }
            }
        }

        // Special case for Human Variant - always 1 skill of any choice
        if (race.name === "Human" && race.source === "PHB" && subrace && subrace.name === "Variant") {

            // Human Variant has 1 skill of any choice
            raceSkillCount = 1;

            // All skills are valid options
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

            // Restore any valid race selections
            character.optionalProficiencies.skills.race.selected = previousRaceSkills.filter(
                skill => raceSkillOptions.includes(skill)
            );
        }

        // Update combined options for all proficiency types
        this._updateCombinedProficiencyOptions(character);

        // Notify UI to update proficiencies
        document.dispatchEvent(new CustomEvent('proficiencyChanged'));
    }

    /**
     * Updates the combined proficiency options from race, class, and background
     * @param {Character} character - The character object
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

        // Update total allowed count for languages
        character.optionalProficiencies.languages.allowed = raceLanguageAllowed + classLanguageAllowed + backgroundLanguageAllowed;

        // Combine selected languages from all sources
        character.optionalProficiencies.languages.selected = [...new Set([...raceLanguageSelected, ...classLanguageSelected, ...backgroundLanguageSelected])];

        // For combined options, include language options from all sources
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

        // Update total allowed count for tools
        character.optionalProficiencies.tools.allowed = raceToolAllowed + classToolAllowed + backgroundToolAllowed;

        // Combine selected tools from all sources
        character.optionalProficiencies.tools.selected = [...new Set([...raceToolSelected, ...classToolSelected, ...backgroundToolSelected])];

        // For combined options, include tool options from all sources
        character.optionalProficiencies.tools.options = [...new Set([...raceToolOptions, ...classToolOptions, ...backgroundToolOptions])];

    }

    /**
     * Updates ability bonuses based on race and subrace
     * @param {Race} race - Selected race
     * @param {Object} subrace - Selected subrace
     * @private
     */
    _updateAbilityBonuses(race, subrace) {
        const character = characterHandler.currentCharacter;
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
            const fixedImprovements = this._raceManager.getFixedAbilityImprovements(race, subrace);

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
            const choices = this._raceManager.getAbilityScoreChoices();

            // If we have any choices, process them
            if (choices && choices.length > 0) {
                for (const choice of choices) {
                    if (!choice) continue;

                    // Add the ability choice directly to the character
                    character.addPendingAbilityChoice(choice);
                }
            }

            // Always dispatch event to ensure UI updates
            document.dispatchEvent(new CustomEvent('abilityScoresChanged', {
                detail: { character }
            }));
        } catch (error) {
            console.error('Error updating ability bonuses:', error);
        }
    }

    /**
     * Update character's traits based on race and subrace
     * @param {Race} race - Selected race
     * @param {Subrace} subrace - Selected subrace
     * @private
     */
    _updateRacialTraits(race, subrace) {
        const character = characterHandler.currentCharacter;
        if (!character || !race) return;

        try {
            // Update darkvision if applicable
            if (race.darkvision) {
                const darkvisionRange = typeof race.darkvision === 'number' ? race.darkvision : 60;
                character.features.darkvision = darkvisionRange;
            }

            // Add resistances if applicable
            if (race.resist) {
                const resistances = Array.isArray(race.resist) ? race.resist : [race.resist];
                for (const resistance of resistances) {
                    if (resistance) {
                        character.addResistance(resistance, 'Race');
                    }
                }
            }

            // Add traits (pass race and subrace directly)
            const traits = this._raceManager.getCombinedTraits(race, subrace);
            if (traits && traits.length > 0) {
                for (const trait of traits) {
                    if (!trait) continue;

                    // Handle different trait formats
                    if (typeof trait === 'string') {
                        character.addTrait(trait, trait, 'Race');
                    } else if (trait.name || trait.text) {
                        const name = trait.name || trait.text;
                        const description = trait.entries ?
                            (Array.isArray(trait.entries) ? trait.entries.join('\n') : trait.entries) :
                            name;
                        character.addTrait(name, description, 'Race');
                    }
                }
            }
        } catch (error) {
            console.error('Error updating racial traits:', error);
        }
    }

    /**
     * Updates the combined skill options from race, class, and background
     * @param {Character} character - The character object
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

        // Update total allowed count
        character.optionalProficiencies.skills.allowed = raceAllowed + classAllowed + backgroundAllowed;

        // Combine selected skills from all sources
        character.optionalProficiencies.skills.selected = [...new Set([...raceSelected, ...classSelected, ...backgroundSelected])];

        // For combined options, include options from all sources
        character.optionalProficiencies.skills.options = [...new Set([...raceOptions, ...classOptions, ...backgroundOptions])];
    }
}
