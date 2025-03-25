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

export class RaceCard {
    constructor() {
        this.raceManager = raceManager;
        this.raceSelect = document.getElementById('raceSelect');
        this.subraceSelect = document.getElementById('subraceSelect');
        this.raceQuickDesc = document.getElementById('raceQuickDesc');
        this.raceDetails = document.getElementById('raceDetails');

        this.initialize();
    }

    /**
     * Initialize the race card
     */
    async initialize() {
        try {
            await this.raceManager.initialize();
            await textProcessor.initialize();
            tooltipManager.initialize();
            this.setupEventListeners();
            await this.loadSavedRaceSelection();
        } catch (error) {
            console.error('Failed to initialize race card:', error);
        }
    }

    /**
     * Load and set the saved race selection
     */
    async loadSavedRaceSelection() {
        try {
            this.populateRaceSelect();

            const character = characterHandler?.currentCharacter;
            if (character?.race?.name && character?.race?.source) {
                const raceValue = `${character.race.name}_${character.race.source}`;
                const raceExists = Array.from(this.raceSelect.options).some(option => option.value === raceValue);

                if (raceExists) {
                    this.raceSelect.value = raceValue;
                    this.raceSelect.dispatchEvent(new Event('change', { bubbles: true }));

                    if (character.race.subrace) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        const subraceExists = Array.from(this.subraceSelect.options).some(option => option.value === character.race.subrace);
                        if (subraceExists) {
                            this.subraceSelect.value = character.race.subrace;
                            this.subraceSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                } else {
                    console.warn(`Saved race "${raceValue}" not found in available options. Character might use a source that's not currently allowed.`);
                }
            }
        } catch (error) {
            console.error('Error loading saved race selection:', error);
        }
    }

    /**
     * Populate the race select dropdown
     */
    populateRaceSelect() {
        console.log('[RaceCard] Populating race select dropdown');
        this.raceSelect.innerHTML = '<option value="">Select a Race</option>';

        const races = this.raceManager.getAllRaces();
        const currentCharacter = characterHandler.currentCharacter;
        const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
        const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

        const filteredRaces = races.filter(race => {
            const raceSource = race.source?.toUpperCase();
            return upperAllowedSources.has(raceSource);
        });

        for (const race of filteredRaces) {
            const option = document.createElement('option');
            option.value = `${race.name}_${race.source}`;
            option.textContent = `${race.name} (${race.source})`;
            this.raceSelect.appendChild(option);
        }
    }

    /**
     * Populate the subrace select dropdown
     * @param {Race} race - Selected race
     */
    populateSubraceSelect(race) {
        console.log('[RaceCard] Populating subrace select for race:', race?.name);

        if (!race) {
            this.subraceSelect.innerHTML = '<option value="">No Subraces</option>';
            this.subraceSelect.disabled = true;
            return;
        }

        const currentCharacter = characterHandler.currentCharacter;
        const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
        const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

        if (!race.subraces || race.subraces.length === 0) {
            this.subraceSelect.innerHTML = '<option value="">No Subraces</option>';
            this.subraceSelect.disabled = true;
            return;
        }

        const filteredSubraces = race.subraces.filter(subrace => {
            const subraceSource = subrace.source?.toUpperCase() || race.source.toUpperCase();
            return upperAllowedSources.has(subraceSource) && subrace.name && subrace.name.trim() !== '';
        });

        if (filteredSubraces.length === 0) {
            this.subraceSelect.innerHTML = '<option value="">No Subraces</option>';
            this.subraceSelect.disabled = true;
            return;
        }

        this.subraceSelect.innerHTML = '<option value="">Select Subrace</option>';
        this.subraceSelect.disabled = false;
        for (const subrace of filteredSubraces) {
            const option = document.createElement('option');
            option.value = subrace.name;
            option.textContent = subrace.name;
            this.subraceSelect.appendChild(option);
        }
    }

    /**
     * Update the race quick description
     * @param {Race} race - Selected race
     */
    async updateQuickDescription(race) {
        if (!race) {
            this.raceQuickDesc.innerHTML = `
                <div class="placeholder-content">
                    <h5>Select a Race</h5>
                    <p>Choose a race to see details about their traits, abilities, and other characteristics.</p>
                </div>
            `;
            return;
        }

        const firstEntry = race.entries.find(entry => typeof entry === 'string');
        const description = firstEntry || 'No description available.';
        const processedDescription = await textProcessor.processString(description);

        this.raceQuickDesc.innerHTML = `
            <h5>${race.name}</h5>
            <p>${processedDescription}</p>
        `;
    }

    /**
     * Update the race details section
     * @param {Race} race - Selected race
     * @param {Subrace} subrace - Selected subrace
     */
    async updateRaceDetails(race, subrace) {
        if (!race) {
            this.resetRaceDetails();
            return;
        }

        await this._updateAbilityScores(race);
        await this._updateSizeAndSpeed(race);
        await this._updateLanguages(race);
        await this._updateTraits(race);

        // Process the entire details container to resolve reference tags
        await textProcessor.processElement(this.raceDetails);
    }

    /**
     * Update ability scores section
     * @param {Race} race - Selected race
     * @private
     */
    async _updateAbilityScores(race) {
        const abilitySection = this.raceDetails.querySelector('.detail-section:nth-child(1) ul');
        const abilityImprovements = this.raceManager.getFormattedAbilityImprovements().split('\n');
        abilitySection.innerHTML = abilityImprovements.map(improvement => `<li>${improvement}</li>`).join('');
    }

    /**
     * Update size and speed sections
     * @param {Race} race - Selected race
     * @private
     */
    async _updateSizeAndSpeed(race) {
        const sizeSection = this.raceDetails.querySelector('.detail-section:nth-child(2) ul');
        sizeSection.innerHTML = `<li>${race.getSize().value}</li>`;

        const speedSection = this.raceDetails.querySelector('.detail-section:nth-child(3) ul');
        const speeds = this.raceManager.getFormattedMovementSpeeds().split('\n');
        speedSection.innerHTML = speeds.map(speed => `<li>${speed}</li>`).join('') || '<li>None</li>';
    }

    /**
     * Update languages section
     * @param {Race} race - Selected race
     * @private
     */
    async _updateLanguages(race) {
        const languageSection = this.raceDetails.querySelector('.detail-section:nth-child(4) ul');
        const languages = this.raceManager.getFormattedLanguages().split('\n');
        languageSection.innerHTML = languages.map(language => `<li>${language}</li>`).join('');
    }

    /**
     * Update traits section
     * @param {Race} race - Selected race
     * @private
     */
    async _updateTraits(race) {
        const traitsSection = this.raceDetails.querySelector('.traits-section');
        const traits = this.raceManager.getCombinedTraits();

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
        const sections = this.raceDetails.querySelectorAll('.detail-section ul');
        for (const section of sections) {
            section.innerHTML = '<li class="placeholder-text">—</li>';
        }
    }

    /**
     * Setup event listeners for race selection
     */
    setupEventListeners() {
        this.raceSelect.addEventListener('change', this._handleRaceChange.bind(this));
        this.subraceSelect.addEventListener('change', this._handleSubraceChange.bind(this));
    }

    /**
     * Handle race selection change
     * @param {Event} event - The change event
     * @private
     */
    async _handleRaceChange(event) {
        const [raceName, source] = event.target.value.split('_');
        const race = this.raceManager.selectRace(raceName, source);

        this.populateSubraceSelect(race);
        await this.updateQuickDescription(race);
        await this.updateRaceDetails(race, null);

        this._updateCharacterRace(race, null);
    }

    /**
     * Handle subrace selection change
     * @param {Event} event - The change event
     * @private
     */
    async _handleSubraceChange(event) {
        const subraceName = event.target.value;
        const subrace = this.raceManager.selectSubrace(subraceName);
        const race = this.raceManager.getSelectedRace();

        await this.updateRaceDetails(race, subrace);
        this._updateCharacterRace(race, subrace);
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

        // Check if race has changed
        const hasChanged = !race ?
            (character.race?.name || character.race?.source) :
            (character.race?.name !== race.name ||
                character.race?.source !== race.source ||
                character.race?.subrace !== (subrace?.name || ''));

        if (hasChanged) {
            console.log(`[RaceCard] Race changed from ${character.race?.name || 'none'} to ${race?.name || 'none'}`);

            // Clear previous race proficiencies, ability bonuses, and traits
            character.removeProficienciesBySource('Race');
            character.clearAbilityBonuses('Race');
            character.clearTraits('Race');

            // Remove subrace proficiencies, ability bonuses, and traits
            character.removeProficienciesBySource('Subrace');
            character.clearAbilityBonuses('Subrace');
            character.clearTraits('Subrace');

            // Notify UI to clear optional proficiencies from race
            document.dispatchEvent(new CustomEvent('proficienciesRemoved', {
                detail: { source: 'Race' }
            }));

            if (!race) {
                // Clear race
                character.race = {
                    name: '',
                    source: '',
                    subrace: ''
                };

                // Clear racial traits
                character.features.darkvision = 0;
                character.features.resistances.clear();
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

                // Update ability scores
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

            // Trigger an event to update the UI
            document.dispatchEvent(new CustomEvent('raceChanged', { detail: { race, subrace } }));
            document.dispatchEvent(new CustomEvent('characterChanged'));
            document.dispatchEvent(new CustomEvent('abilityScoresChanged', { detail: { character } }));

            // Clear pending ability choices from race
            character.clearPendingChoicesByType('ability');
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

        console.log(`[RaceCard] Adding proficiencies for ${race.name}${subrace ? ` (${subrace.name})` : ''}`);

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
        if (race.languages) {
            // Handle fixed languages
            for (const [language, value] of Object.entries(race.languages)) {
                if (value === true && language !== 'anyStandard' && language !== 'any') {
                    const capitalizedLanguage = language.charAt(0).toUpperCase() + language.slice(1);
                    character.addProficiency('languages', capitalizedLanguage, 'Race');
                    console.log(`[RaceCard] Added language: ${capitalizedLanguage}`);
                }
            }

            // Handle any language choices
            if ((race.languages.anyStandard && race.languages.anyStandard > 0) ||
                (race.languages.any && race.languages.any > 0)) {
                const languageCount = race.languages.anyStandard || race.languages.any || 0;
                const languageOptions = [
                    'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin',
                    'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic',
                    'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'
                ];

                character.optionalProficiencies.languages.race.allowed = languageCount;
                character.optionalProficiencies.languages.race.options = languageOptions;

                // Restore valid selections
                character.optionalProficiencies.languages.race.selected = previousRaceLanguages.filter(
                    lang => languageOptions.includes(lang)
                );

                console.log(`[RaceCard] Added ${languageCount} language choices`);
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
                        console.log(`[RaceCard] Added weapon proficiency: ${capitalizedWeapon}`);
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
                        console.log(`[RaceCard] Added tool proficiency: ${capitalizedTool}`);
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

                    console.log(`[RaceCard] Added ${profObj.any} tool choices`);
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
                    console.log(`[RaceCard] Adding "any" skill choice for ${race.name}: allowed=${profObj.any}`);
                    continue;
                }

                // Handle fixed skill proficiencies
                for (const [skill, hasProf] of Object.entries(profObj)) {
                    if (hasProf === true && skill !== 'choose') {
                        const capitalizedSkill = skill.charAt(0).toUpperCase() + skill.slice(1);
                        character.addProficiency('skills', capitalizedSkill, 'Race');
                        console.log(`[RaceCard] Added skill proficiency: ${capitalizedSkill}`);
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
                        console.log(`[RaceCard] Adding specific skill options for race: ${capitalizedOptions.join(', ')}`);
                    }
                }
            }
        }

        // Special case for Human Variant - always 1 skill of any choice
        if (race.name === "Human" && race.source === "PHB" && subrace && subrace.name === "Variant") {
            console.log('[RaceCard] Setting up Human Variant skill proficiency');

            // Human Variant has 1 skill of any choice
            raceSkillCount = 1;

            // All skills are valid options
            raceSkillOptions = [
                'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
                'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
                'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
                'Sleight of Hand', 'Stealth', 'Survival'
            ];

            console.log('[RaceCard] Human Variant skill options set:', raceSkillOptions);
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

        console.log('[RaceCard] Updated combined language options:', {
            raceLanguageOptions,
            classLanguageOptions,
            backgroundLanguageOptions,
            combinedOptions: character.optionalProficiencies.languages.options,
            allowed: character.optionalProficiencies.languages.allowed,
            selected: character.optionalProficiencies.languages.selected
        });

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

        console.log('[RaceCard] Updated combined tool options:', {
            raceToolOptions,
            classToolOptions,
            backgroundToolOptions,
            combinedOptions: character.optionalProficiencies.tools.options,
            allowed: character.optionalProficiencies.tools.allowed,
            selected: character.optionalProficiencies.tools.selected
        });
    }

    /**
     * Update character's ability bonuses based on race and subrace
     * @param {Race} race - Selected race
     * @param {Subrace} subrace - Selected subrace
     * @private
     */
    _updateAbilityBonuses(race, subrace) {
        const character = characterHandler.currentCharacter;
        if (!character || !race) return;

        console.log(`[RaceCard] Adding ability bonuses for ${race.name}${subrace ? ` (${subrace.name})` : ''}`);

        // Clear existing ability bonuses from race and subrace
        character.clearAbilityBonuses('Race');
        character.clearAbilityBonuses('Subrace');
        character.clearPendingAbilityChoices();

        // Add fixed ability improvements
        const fixedImprovements = this.raceManager.getFixedAbilityImprovements();
        for (const improvement of fixedImprovements) {
            // Always apply race improvements
            if (improvement.source === 'Race') {
                character.addAbilityBonus(improvement.ability, improvement.value, improvement.source);
            }
            // Apply subrace improvements if there is a subrace
            if (subrace && improvement.source === 'Subrace') {
                character.addAbilityBonus(improvement.ability, improvement.value, improvement.source);
            }
        }

        // Add ability score choices
        const choices = this.raceManager.getAbilityScoreChoices();
        for (const choice of choices) {
            // Always apply race choices
            if (choice.source.startsWith('Race Choice')) {
                character.addPendingAbilityChoice(choice);
            }
            // Apply subrace choices if there is a subrace
            if (subrace && choice.source.startsWith('Subrace Choice')) {
                character.addPendingAbilityChoice(choice);
            }
        }

        // Notify ability score card to update
        document.dispatchEvent(new CustomEvent('abilityScoresChanged', {
            detail: { character }
        }));
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

        console.log(`[RaceCard] Adding traits for ${race.name}${subrace ? ` (${subrace.name})` : ''}`);

        // Update darkvision if applicable
        if (race.darkvision) {
            const darkvisionRange = typeof race.darkvision === 'number' ? race.darkvision : 60;
            character.features.darkvision = darkvisionRange;
            console.log(`[RaceCard] Added darkvision with range ${darkvisionRange}`);
        }

        // Add resistances if applicable
        if (race.resist) {
            const resistances = Array.isArray(race.resist) ? race.resist : [race.resist];
            for (const resistance of resistances) {
                character.addResistance(resistance, 'Race');
                console.log(`[RaceCard] Added resistance: ${resistance}`);
            }
        }

        // Add traits
        const traits = this.raceManager.getCombinedTraits();
        if (traits && traits.length > 0) {
            for (const trait of traits) {
                // Handle different trait formats
                if (typeof trait === 'string') {
                    character.addTrait(trait, trait, 'Race');
                    console.log(`[RaceCard] Added trait: ${trait}`);
                } else if (trait.name || trait.text) {
                    const name = trait.name || trait.text;
                    const description = trait.entries ?
                        (Array.isArray(trait.entries) ? trait.entries.join('\n') : trait.entries) :
                        name;
                    character.addTrait(name, description, 'Race');
                    console.log(`[RaceCard] Added trait: ${name}`);
                }
            }
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

        console.log('[RaceCard] Updated combined skill options:', {
            raceOptions,
            classOptions,
            backgroundOptions,
            combinedOptions: character.optionalProficiencies.skills.options,
            raceAllowed,
            classAllowed,
            backgroundAllowed,
            combinedAllowed: character.optionalProficiencies.skills.allowed,
            raceSelected,
            classSelected,
            backgroundSelected,
            combinedSelected: character.optionalProficiencies.skills.selected
        });
    }
}
