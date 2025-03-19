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
     * Update character's race and subrace information
     * @param {Race} race - Selected race
     * @param {Subrace} subrace - Selected subrace
     * @private
     */
    _updateCharacterRace(race, subrace) {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        const currentRace = this.raceSelect.value.split('_');
        const savedRace = character.race || {};
        const savedSubrace = savedRace.subrace || '';

        const hasChanged = !currentRace[0] ?
            (savedRace.name || savedRace.source) :
            (savedRace.name !== currentRace[0] || savedRace.source !== currentRace[1] || savedSubrace !== (subrace?.name || ''));

        if (hasChanged) {
            characterHandler.showUnsavedChanges();
        } else {
            characterHandler.hideUnsavedChanges();
        }

        this._updateAbilityBonuses(race, subrace);
    }

    /**
     * Update character's ability bonuses based on race and subrace
     * @param {Race} race - Selected race
     * @param {Subrace} subrace - Selected subrace
     * @private
     */
    _updateAbilityBonuses(race, subrace) {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        // Clear previous bonuses
        character.clearAbilityBonuses('Race');
        character.clearAbilityBonuses('Race Choice');
        character.clearAbilityBonuses('Subrace');
        character.clearAbilityBonuses('Subrace Choice');

        if (!race) return;

        // Add fixed ability improvements
        const fixedImprovements = this.raceManager.getFixedAbilityImprovements();
        for (const improvement of fixedImprovements) {
            if (!subrace || improvement.source !== 'Subrace') {
                character.addAbilityBonus(improvement.ability, improvement.value, improvement.source);
            }
        }

        // Add ability score choices
        const choices = this.raceManager.getAbilityScoreChoices();
        for (const choice of choices) {
            if (!subrace || choice.source !== 'Subrace Choice') {
                character.addPendingAbilityChoice(choice);
            }
        }

        // Notify ability score card to update
        document.dispatchEvent(new CustomEvent('abilityScoresChanged', {
            detail: { character }
        }));
    }
}
