/**
 * ProficiencyCard.js
 * UI component that manages the display and interaction of character proficiencies.
 * Handles all proficiency types: skills, saving throws, languages, tools, armor, and weapons.
 */

import { textProcessor } from '../utils/TextProcessor.js';
import { dataLoader } from '../dataloaders/DataLoader.js';
import { characterHandler } from '../utils/characterHandler.js';
import { ProficiencyManager } from '../managers/ProficiencyManager.js';

/**
 * Manages the proficiency card UI component and related functionality
 */
export class ProficiencyCard {
    /**
     * Creates a new ProficiencyCard instance
     */
    constructor() {
        this.character = null;
        this.proficiencyManager = new ProficiencyManager(dataLoader);
        this.proficiencyTypes = ['skills', 'savingThrows', 'languages', 'tools', 'armor', 'weapons'];

        // Define default proficiencies that all characters have
        this.defaultProficiencies = {
            languages: ['Common'],
            weapons: [],
            armor: [],
            tools: [],
            skills: [],
            savingThrows: []
        };

        // DOM element references
        this.proficiencyContainers = {};
        this.proficiencyNotesContainer = null;
    }

    /**
     * Initialize the proficiency card UI and data
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log('[ProficiencyCard] Initializing');

        // Get the current character
        this.character = characterHandler.currentCharacter;
        if (!this.character) {
            console.error('[ProficiencyCard] No active character found');
            return;
        }

        // Initialize DOM element references
        for (const type of this.proficiencyTypes) {
            const containerId = `${type}Container`;
            this.proficiencyContainers[type] = document.getElementById(containerId);

            if (!this.proficiencyContainers[type]) {
                console.warn(`[ProficiencyCard] Container for ${type} not found: #${containerId}`);
            }
        }

        this.proficiencyNotesContainer = document.getElementById('proficiencyNotes');

        // Set up event listeners
        this.setupEventListeners();

        // Initialize character proficiency structures if needed
        this.initializeCharacterProficiencies();

        // Populate UI elements
        await this.populateProficiencyContainers();

        // Update notes display
        this.updateProficiencyNotes();
    }

    /**
     * Initialize character proficiency structures if they don't exist
     * @private
     */
    initializeCharacterProficiencies() {
        if (!this.character) return;

        // Initialize proficiencies object if it doesn't exist
        if (!this.character.proficiencies) {
            this.character.proficiencies = {};
        }

        // Initialize proficiency sources object if it doesn't exist
        if (!this.character.proficiencySources) {
            this.character.proficiencySources = {};
        }

        // Initialize optional proficiencies object if it doesn't exist
        if (!this.character.optionalProficiencies) {
            this.character.optionalProficiencies = {};
        }

        // Initialize each proficiency type as an array
        for (const type of this.proficiencyTypes) {
            // Regular proficiencies
            if (!Array.isArray(this.character.proficiencies[type])) {
                this.character.proficiencies[type] = [];
            }

            // Proficiency sources
            if (!this.character.proficiencySources[type]) {
                this.character.proficiencySources[type] = new Map();
            }

            // Optional proficiencies
            if (!this.character.optionalProficiencies[type]) {
                this.character.optionalProficiencies[type] = {
                    allowed: 0,
                    selected: []
                };
            }

            // For skills and languages, ensure we have all the nested structures
            if (type === 'skills' || type === 'languages') {
                // Make sure top level options array exists
                if (!this.character.optionalProficiencies[type].options) {
                    this.character.optionalProficiencies[type].options = [];
                }

                // Initialize race, class, and background structures
                const sources = ['race', 'class', 'background'];
                for (const source of sources) {
                    if (!this.character.optionalProficiencies[type][source]) {
                        this.character.optionalProficiencies[type][source] = {
                            allowed: 0,
                            options: [],
                            selected: []
                        };
                    } else {
                        // Ensure all properties exist if the object itself does
                        if (typeof this.character.optionalProficiencies[type][source].allowed === 'undefined') {
                            this.character.optionalProficiencies[type][source].allowed = 0;
                        }
                        if (!Array.isArray(this.character.optionalProficiencies[type][source].options)) {
                            this.character.optionalProficiencies[type][source].options = [];
                        }
                        if (!Array.isArray(this.character.optionalProficiencies[type][source].selected)) {
                            this.character.optionalProficiencies[type][source].selected = [];
                        }
                    }
                }

                // Log the state for debugging
                if (type === 'languages') {
                    console.log('[ProficiencyCard] Initialized language structures:', {
                        background: this.character.optionalProficiencies.languages.background,
                        backgroundOptions: this.character.optionalProficiencies.languages.background.options,
                        combined: this.character.optionalProficiencies.languages
                    });
                }
            }
        }

        // Add default proficiencies if not already present
        for (const [type, defaults] of Object.entries(this.defaultProficiencies)) {
            for (const prof of defaults) {
                if (!this.character.proficiencies[type].includes(prof)) {
                    this.character.addProficiency(type, prof, 'Default');
                }
            }
        }
    }

    /**
     * Set up event listeners for proficiency containers
     * @private
     */
    setupEventListeners() {
        for (const type of this.proficiencyTypes) {
            const container = this.proficiencyContainers[type];
            if (!container) continue;

            container.addEventListener('click', (e) => {
                const item = e.target.closest('.proficiency-item');
                if (!item) return;

                const proficiency = item.dataset.proficiency;
                const typeAttr = item.dataset.type || type;

                // Only toggle if it's selectable or optionally selected
                // Do not allow toggling default or granted proficiencies
                const isSelectable = item.classList.contains('selectable');
                const isOptionalSelected = item.classList.contains('optional-selected');
                const isDefault = item.classList.contains('default');

                if ((isSelectable || isOptionalSelected) && !isDefault) {
                    this.toggleOptionalProficiency(item);
                }
            });
        }

        // Listen for character changes
        document.addEventListener('characterChanged', this.handleCharacterChanged.bind(this));

        // Listen for proficiency-specific events from the character handler
        document.addEventListener('proficiencyAdded', this.handleProficiencyChanged.bind(this));
        document.addEventListener('proficienciesRemoved', this.handleProficiencyChanged.bind(this));

        // Add listeners to character handler static methods for proficiency changes
        if (!characterHandler._hasAddedProficiencyEventListeners) {
            // Set up a method to dispatch events when proficiencies are added
            const originalAddProficiency = characterHandler.currentCharacter.addProficiency;
            characterHandler.currentCharacter.addProficiency = function (type, proficiency, source) {
                // Call the original method to add the proficiency
                originalAddProficiency.call(this, type, proficiency, source);

                // Dispatch an event that a proficiency was added
                document.dispatchEvent(new CustomEvent('proficiencyAdded', {
                    detail: {
                        character: this,
                        type: type,
                        proficiency: proficiency,
                        source: source
                    }
                }));
            };

            // Set up a method to dispatch events when proficiencies are removed by source
            const originalRemoveBySource = characterHandler.currentCharacter.removeProficienciesBySource;
            characterHandler.currentCharacter.removeProficienciesBySource = function (source) {
                // Call the original method to remove proficiencies
                originalRemoveBySource.call(this, source);

                // Dispatch an event that proficiencies were removed
                document.dispatchEvent(new CustomEvent('proficienciesRemoved', {
                    detail: {
                        character: this,
                        source: source
                    }
                }));
            };

            // Mark that we've set up these listeners to avoid duplicate setup
            characterHandler._hasAddedProficiencyEventListeners = true;
        }
    }

    /**
     * Handle character change events
     * @private
     */
    handleCharacterChanged() {
        this.character = characterHandler.currentCharacter;

        if (this.character) {
            // Add proficiency event listeners to the new character
            if (!characterHandler._hasAddedProficiencyEventListeners) {
                this.setupEventListeners();
            }

            this.initializeCharacterProficiencies();
            this.cleanupOptionalProficiencies();
            this.populateProficiencyContainers();
            this.updateProficiencyNotes();
        }
    }

    /**
     * Handle proficiency changed event
     * @param {Event} event - Event object
     */
    handleProficiencyChanged(event) {
        if (!this.character) return;

        console.log('[ProficiencyCard] Proficiency changed event received', {
            type: event.type,
            detail: event.detail,
            currentSkillOptions: this.character.optionalProficiencies?.skills?.options || [],
            skillsAllowed: this.character.optionalProficiencies?.skills?.allowed || 0,
            skillsSelected: this.character.optionalProficiencies?.skills?.selected || []
        });

        try {
            // If this is a proficiency removal event, clean up optional proficiencies
            if (event.type === 'proficienciesRemoved') {
                const source = event.detail?.source;
                if (source) {
                    console.log(`[ProficiencyCard] Handling proficienciesRemoved event for source: ${source}`);
                    this.clearOptionalProficienciesBySource(source);
                }
            }

            // If a skill was refunded, show a notification
            if (event.detail?.refundedSkill) {
                const skill = event.detail.refundedSkill;
                console.log(`[ProficiencyCard] Skill ${skill} was automatically granted and has been refunded. User can select a different skill.`);
                this._showRefundNotification(skill);
            }

            // If event detail includes triggerCleanup flag, first clean up any proficiencies
            // that might have become fixed
            if (event.detail?.triggerCleanup) {
                console.log('[ProficiencyCard] Trigger cleanup requested, cleaning optional proficiencies');
                this.cleanupOptionalProficiencies();
            }

            // If a forced refresh was requested, recalculate everything
            if (event.detail?.forcedRefresh) {
                console.log('[ProficiencyCard] Forced refresh requested, updating combined skill options');
                this._updateCombinedSkillOptions();
            }

            // Update proficiency containers
            this.populateProficiencyContainers();
            this.updateProficiencyNotes();
        } catch (error) {
            console.error('Error handling proficiency changed event:', error);
        }
    }

    /**
     * Show a notification when a skill has been refunded
     * @param {string} skill - The skill that was refunded
     * @private
     */
    _showRefundNotification(skill) {
        console.log(`[ProficiencyCard] Skill ${skill} was automatically granted and has been refunded. User can select a different skill.`);

        // We don't need animations or visual notifications as requested by the user
        // Just make sure we refresh the display
        this.populateProficiencyContainers();
    }

    /**
     * Clear optional proficiencies from a specific source
     * @param {string} source - The source to clear (Race, Class, Background)
     */
    clearOptionalProficienciesBySource(source) {
        if (!this.character) return;

        console.log(`[ProficiencyCard] Clearing optional proficiencies for ${source}`);

        // Handle each source type specifically
        if (source === 'Race' || source === 'Subrace') {
            // Clear race optional proficiencies
            // For skills, only clear race skill options and selections
            if (this.character.optionalProficiencies.skills) {
                console.log('[ProficiencyCard] Clearing race skill proficiencies');

                // Reset race skill options and selections
                this.character.optionalProficiencies.skills.race.allowed = 0;
                this.character.optionalProficiencies.skills.race.options = [];
                this.character.optionalProficiencies.skills.race.selected = [];

                // Update combined options
                this._updateCombinedSkillOptions();
            }

            // Reset languages
            if (this.character.optionalProficiencies.languages) {
                this.character.optionalProficiencies.languages.allowed = 0;
                this.character.optionalProficiencies.languages.selected = [];
            }
        }
        else if (source === 'Class' || source === 'Subclass') {
            // Clear class optional proficiencies
            // For skills, only clear class skill options
            if (this.character.optionalProficiencies.skills) {
                console.log('[ProficiencyCard] Clearing class skill proficiencies');

                // Reset class skill options and selections
                this.character.optionalProficiencies.skills.class.allowed = 0;
                this.character.optionalProficiencies.skills.class.options = [];
                this.character.optionalProficiencies.skills.class.selected = [];

                // Update combined options
                this._updateCombinedSkillOptions();
            }

            // Reset tools
            if (this.character.optionalProficiencies.tools) {
                this.character.optionalProficiencies.tools.allowed = 0;
                this.character.optionalProficiencies.tools.selected = [];
            }

            // Clear armor and weapon choices too
            if (this.character.optionalProficiencies.armor) {
                this.character.optionalProficiencies.armor.allowed = 0;
                this.character.optionalProficiencies.armor.selected = [];
            }

            if (this.character.optionalProficiencies.weapons) {
                this.character.optionalProficiencies.weapons.allowed = 0;
                this.character.optionalProficiencies.weapons.selected = [];
            }
        }
        else if (source === 'Background') {
            // Clear background optional proficiencies
            // For skills, only clear background skill choices
            if (this.character.optionalProficiencies.skills) {
                console.log('[ProficiencyCard] Clearing background skill proficiencies');

                // Reset background skill options
                this.character.optionalProficiencies.skills.background.allowed = 0;
                this.character.optionalProficiencies.skills.background.options = [];
                this.character.optionalProficiencies.skills.background.selected = [];

                // Update combined options
                this._updateCombinedSkillOptions();
            }

            // Clear tool and language choices
            for (const type of ['languages', 'tools']) {
                if (this.character.optionalProficiencies[type]) {
                    this.character.optionalProficiencies[type].allowed = 0;
                    this.character.optionalProficiencies[type].selected = [];
                }
            }
        }

        // Mark unsaved changes
        this.markUnsavedChanges();
    }

    /**
     * Updates the combined skill options from race, class, and background
     * @private
     */
    _updateCombinedSkillOptions() {
        if (!this.character) return;

        const raceAllowed = this.character.optionalProficiencies.skills.race?.allowed || 0;
        const classAllowed = this.character.optionalProficiencies.skills.class?.allowed || 0;
        const backgroundAllowed = this.character.optionalProficiencies.skills.background?.allowed || 0;

        const raceOptions = this.character.optionalProficiencies.skills.race?.options || [];
        const classOptions = this.character.optionalProficiencies.skills.class?.options || [];
        const backgroundOptions = this.character.optionalProficiencies.skills.background?.options || [];

        const raceSelected = this.character.optionalProficiencies.skills.race?.selected || [];
        const classSelected = this.character.optionalProficiencies.skills.class?.selected || [];
        const backgroundSelected = this.character.optionalProficiencies.skills.background?.selected || [];

        // Update total allowed count
        this.character.optionalProficiencies.skills.allowed = raceAllowed + classAllowed + backgroundAllowed;

        // Combine selected skills from all sources
        this.character.optionalProficiencies.skills.selected =
            [...new Set([...raceSelected, ...classSelected, ...backgroundSelected])];

        // For combined options, include options from all sources
        this.character.optionalProficiencies.skills.options =
            [...new Set([...raceOptions, ...classOptions, ...backgroundOptions])];

        console.log('[ProficiencyCard] Updated combined skill options:', {
            raceOptions,
            classOptions,
            backgroundOptions,
            combinedOptions: this.character.optionalProficiencies.skills.options,
            raceAllowed,
            classAllowed,
            backgroundAllowed,
            combinedAllowed: this.character.optionalProficiencies.skills.allowed,
            raceSelected,
            classSelected,
            backgroundSelected,
            combinedSelected: this.character.optionalProficiencies.skills.selected
        });
    }

    /**
     * Populate the proficiency containers with available options
     * @returns {Promise<void>}
     */
    async populateProficiencyContainers() {
        if (!this.character) return;

        for (const type of this.proficiencyTypes) {
            const container = this.proficiencyContainers[type];
            if (!container) continue;

            // Get available options for this proficiency type
            const availableOptions = await this.getAvailableOptions(type);

            // Debug logging for skill options
            if (type === 'weapons' || type === 'armor') {
                console.log(`[ProficiencyCard] Current ${type} proficiencies:`, this.character.proficiencies[type]);
                if (this.character.proficiencySources[type]) {
                    console.log(`[ProficiencyCard] Current ${type} sources:`,
                        Array.from(this.character.proficiencySources[type].entries()).map(([prof, sources]) =>
                            `${prof}: [${Array.from(sources).join(', ')}]`
                        ).join(', ')
                    );
                }
            }

            // Handle selection counter in section header
            const header = container.closest('.proficiency-section')?.querySelector('h6');
            if (header && type !== 'savingThrows') {
                const optionalCount = this.character?.optionalProficiencies?.[type]?.allowed || 0;
                if (optionalCount > 0) {
                    const selectedCount = this.character?.optionalProficiencies?.[type]?.selected?.length || 0;
                    if (!header.querySelector('.selection-counter')) {
                        const counter = document.createElement('span');
                        counter.className = 'selection-counter';
                        header.appendChild(counter);
                    }
                    header.querySelector('.selection-counter').textContent = ` (${selectedCount}/${optionalCount} selected)`;
                } else if (header.querySelector('.selection-counter')) {
                    header.querySelector('.selection-counter').remove();
                }
            }

            // Build the container content
            let containerHtml = '';
            for (const item of availableOptions) {
                // Check if this proficiency is already selected
                const isProficient = this.character.proficiencies[type].includes(item);

                // Check if this is an optionally selected proficiency
                const isOptionallySelected = this.character?.optionalProficiencies?.[type]?.selected?.includes(item) || false;

                // Check if this is a default proficiency (always selected)
                const isDefault = this.defaultProficiencies[type]?.includes(item);

                // Check if this proficiency is granted by a source like race/background
                const isGranted = this.isGrantedBySource(type, item);

                // Directly use isProficiencyAvailable method to determine if this item is selectable
                let canSelect = false;

                // Special handling for languages and skills - use our isProficiencyAvailable method
                if (type === 'languages' || type === 'skills') {
                    canSelect = this.isProficiencyAvailable(type, item) && !isDefault && !isGranted && !isOptionallySelected;

                    // For debugging languages
                    if (type === 'languages' && ['Dwarvish', 'Elvish', 'Common', 'Abyssal', 'Celestial'].includes(item)) {
                        // Check background language options in detail
                        const bgOptions = this.character.optionalProficiencies?.languages?.background?.options || [];
                        const bgAllowed = this.character.optionalProficiencies?.languages?.background?.allowed || 0;
                        const isBackgroundOption = bgOptions.includes(item);
                        const bgSelected = this.character.optionalProficiencies?.languages?.background?.selected || [];
                        const bgSlotsFull = bgSelected.length >= bgAllowed;

                        console.log('[ProficiencyCard] DETAILED Language debug:', {
                            language: item,
                            inBgOptions: isBackgroundOption,
                            bgOptions,
                            isDefault,
                            isGranted,
                            isOptionallySelected,
                            canSelect,
                            bgAllowed,
                            bgSelected,
                            bgSlotsFull,
                            isProficiencyAvailable: this.isProficiencyAvailable('languages', item)
                        });
                    }
                } else {
                    // For other types, just check if there are slots available
                    canSelect = this.isProficiencyAvailable(type, item) && !isDefault && !isGranted && !isOptionallySelected;
                }

                // Build CSS classes for the proficiency item
                const cssClasses = ['proficiency-item'];

                // Apply classes based on the proficiency status
                // Use the same style for all provided proficiencies 
                // (both default and granted should look the same)
                if (isDefault) {
                    cssClasses.push('proficient', 'default');
                } else if (isGranted) {
                    cssClasses.push('proficient', 'default'); // Use default style for granted proficiencies
                } else if (isOptionallySelected) {
                    cssClasses.push('proficient', 'selected', 'optional-selected');
                }

                if (canSelect) {
                    cssClasses.push('selectable');

                    // Add special classes for race, class, and background options
                    if (type === 'skills' || type === 'languages') {
                        const raceOptions = this.character.optionalProficiencies?.[type]?.race?.options || [];
                        const classOptions = this.character.optionalProficiencies?.[type]?.class?.options || [];
                        const backgroundOptions = this.character.optionalProficiencies?.[type]?.background?.options || [];

                        if (raceOptions.includes(item) && !classOptions.includes(item) && !backgroundOptions.includes(item)) {
                            cssClasses.push('race-only');
                        }
                        else if (!raceOptions.includes(item) && classOptions.includes(item) && !backgroundOptions.includes(item)) {
                            cssClasses.push('class-only');
                        }
                        else if (!raceOptions.includes(item) && !classOptions.includes(item) && backgroundOptions.includes(item)) {
                            cssClasses.push('background-only');
                        }
                    }
                }

                if (!canSelect && !isProficient && !isDefault && !isGranted && !isOptionallySelected) {
                    cssClasses.push('disabled');
                }

                containerHtml += `
                    <div class="${cssClasses.join(' ')}"
                         data-proficiency="${item}"
                         data-type="${type}">
                        <i class="fas ${this.getIconForType(type)} ${isOptionallySelected ? 'optional' : ''}"></i>
                        ${item}
                        ${type === 'skills' ? `<span class="ability">(${this.proficiencyManager.getSkillAbility(item)})</span>` : ''}
                        ${isOptionallySelected ? '<span class="unselect-hint"><i class="fas fa-times"></i></span>' : ''}
                    </div>
                `;
            }

            container.innerHTML = containerHtml;
        }
    }

    /**
     * Get available options for a proficiency type
     * @param {string} type - The proficiency type
     * @returns {Promise<string[]>} Array of available options
     * @private
     */
    async getAvailableOptions(type) {
        console.log(`[ProficiencyCard] Getting available options for ${type}`);

        // Check character proficiencies to debug
        if (type === 'weapons' || type === 'armor') {
            console.log(`[ProficiencyCard] Current ${type} proficiencies:`, this.character.proficiencies[type]);
            if (this.character.proficiencySources[type]) {
                console.log(`[ProficiencyCard] Current ${type} sources:`,
                    Array.from(this.character.proficiencySources[type].entries()).map(([prof, sources]) =>
                        `${prof}: [${Array.from(sources).join(', ')}]`
                    ).join(', ')
                );
            }
        }

        switch (type) {
            case 'skills':
                return this.proficiencyManager.getAvailableSkills();
            case 'savingThrows':
                return ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
            case 'languages': {
                // Make sure to log the language options
                const availableLanguages = [
                    'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin',
                    'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic',
                    'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'
                ];

                // Check if we have languages in background options and log them
                if (this.character?.optionalProficiencies?.languages?.background?.options) {
                    console.log('[ProficiencyCard] Background language options:',
                        this.character.optionalProficiencies.languages.background.options);
                    console.log('[ProficiencyCard] Background language allowed:',
                        this.character.optionalProficiencies.languages.background.allowed);
                }

                return availableLanguages;
            }
            case 'tools':
                return this.proficiencyManager.getAvailableTools();
            case 'armor':
                // Ensure we match exactly what is used in the Character.addProficiency calls
                // Known issue: ClassCard.js adds 'light', 'medium', 'shield' but we expect 'Light Armor', etc.
                return ['light', 'medium', 'heavy', 'shield'];
            case 'weapons':
                // Ensure we match exactly what is used in the Character.addProficiency calls
                // Known issue: ClassCard.js adds 'simple', 'martial', etc. but we expect 'Simple Weapons', etc.
                return ['simple', 'martial', 'crossbows', 'longswords',
                    'rapiers', 'shortswords', 'hand crossbows'];
            default:
                return [];
        }
    }

    /**
     * Check if a proficiency can be selected by the user
     * @param {string} type - Proficiency type
     * @param {string} proficiency - Proficiency name
     * @returns {boolean} Whether the proficiency can be selected
     */
    isProficiencyAvailable(type, proficiency) {
        if (!this.character) return false;

        // Default proficiencies are always selected but not selectable
        if (this.defaultProficiencies[type]?.includes(proficiency)) {
            return false;
        }

        // If proficiency is granted by class/race/background, it's not selectable
        if (this.isGrantedBySource(type, proficiency)) {
            return false;
        }

        // Check if there are optional proficiencies of this type allowed
        const optionalAllowed = this.character.optionalProficiencies?.[type]?.allowed || 0;
        if (optionalAllowed <= 0) {
            return false;
        }

        // Check if all slots are already filled
        const selectedCount = this.character.optionalProficiencies?.[type]?.selected?.length || 0;
        if (selectedCount >= optionalAllowed) {
            return false;
        }

        // Special handling for languages
        if (type === 'languages') {
            // Get the options and allowed counts from background
            const backgroundOptions = this.character.optionalProficiencies.languages.background?.options || [];
            const backgroundAllowed = this.character.optionalProficiencies.languages.background?.allowed || 0;
            const backgroundSelected = this.character.optionalProficiencies.languages.background?.selected || [];

            // Special case: If background options contains 'Any', it means any language can be selected
            const backgroundAllowsAny = backgroundOptions.includes('Any');

            // Check if this language is in the background options and there are slots available
            // OR if background allows any language and there are slots available
            if ((backgroundAllowsAny || backgroundOptions.includes(proficiency)) &&
                backgroundSelected.length < backgroundAllowed) {
                // Skip if it's Common (default language) or already granted
                if (proficiency === 'Common' || this.isGrantedBySource('languages', proficiency)) {
                    return false;
                }
                return true;
            }

            // Also check race and class options
            const raceOptions = this.character.optionalProficiencies.languages.race?.options || [];
            const raceAllowed = this.character.optionalProficiencies.languages.race?.allowed || 0;
            const raceSelected = this.character.optionalProficiencies.languages.race?.selected || [];

            const raceAllowsAny = raceOptions.includes('Any');

            if ((raceAllowsAny || raceOptions.includes(proficiency)) &&
                raceSelected.length < raceAllowed) {
                return true;
            }

            const classOptions = this.character.optionalProficiencies.languages.class?.options || [];
            const classAllowed = this.character.optionalProficiencies.languages.class?.allowed || 0;
            const classSelected = this.character.optionalProficiencies.languages.class?.selected || [];

            const classAllowsAny = classOptions.includes('Any');

            if ((classAllowsAny || classOptions.includes(proficiency)) &&
                classSelected.length < classAllowed) {
                return true;
            }

            // If it's not in any of the option lists or all slots are filled, it's not available
            return false;
        }

        // For skills and languages, check if the item is in either race, class, or background options
        if (type === 'skills') {
            const raceOptions = this.character.optionalProficiencies[type].race?.options || [];
            const classOptions = this.character.optionalProficiencies[type].class?.options || [];
            const backgroundOptions = this.character.optionalProficiencies[type].background?.options || [];
            const raceAllowed = this.character.optionalProficiencies[type].race?.allowed || 0;
            const classAllowed = this.character.optionalProficiencies[type].class?.allowed || 0;
            const backgroundAllowed = this.character.optionalProficiencies[type].background?.allowed || 0;

            // If we have race options and race slots available
            if (raceOptions.length > 0 && raceAllowed > 0) {
                // Is this a race option?
                const isRaceOption = raceOptions.includes(proficiency);
                // Are race slots filled?
                const raceSelected = this.character.optionalProficiencies[type].race?.selected || [];
                const raceSlotsFull = raceSelected.length >= raceAllowed;

                if (isRaceOption && !raceSlotsFull) {
                    return true;
                }
            }

            // If we have class options and class slots available
            if (classOptions.length > 0 && classAllowed > 0) {
                // Is this a class option?
                const isClassOption = classOptions.includes(proficiency);
                // Are class slots filled?
                const classSelected = this.character.optionalProficiencies[type].class?.selected || [];
                const classSlotsFull = classSelected.length >= classAllowed;

                if (isClassOption && !classSlotsFull) {
                    return true;
                }
            }

            // If we have background options and background slots available
            if (backgroundOptions.length > 0 && backgroundAllowed > 0) {
                // Is this a background option?
                const isBackgroundOption = backgroundOptions.includes(proficiency);
                // Are background slots filled?
                const backgroundSelected = this.character.optionalProficiencies[type].background?.selected || [];
                const backgroundSlotsFull = backgroundSelected.length >= backgroundAllowed;

                if (isBackgroundOption && !backgroundSlotsFull) {
                    return true;
                }
            }

            // If none of the above conditions are met, the proficiency is not available
            return false;
        }

        // For other types, just check if there are slots available
        return this.character.optionalProficiencies?.[type]?.allowed > 0 &&
            this.character.optionalProficiencies?.[type]?.selected?.length < this.character.optionalProficiencies?.[type]?.allowed;
    }

    /**
     * Get the appropriate icon class for a proficiency type
     * @param {string} type - Proficiency type
     * @returns {string} Font Awesome icon class
     * @private
     */
    getIconForType(type) {
        switch (type) {
            case 'skills':
                return 'fa-check-circle';
            case 'savingThrows':
                return 'fa-dice-d20';
            case 'tools':
                return 'fa-tools';
            case 'weapons':
                return 'fa-gavel';
            case 'armor':
                return 'fa-shield-alt';
            case 'languages':
                return 'fa-comment';
            default:
                return 'fa-circle';
        }
    }

    /**
     * Get the label for a proficiency type
     * @param {string} type - Proficiency type
     * @returns {string} User-friendly label
     * @private
     */
    getTypeLabel(type) {
        switch (type) {
            case 'skills':
                return 'Skills';
            case 'savingThrows':
                return 'Saving Throws';
            case 'languages':
                return 'Languages';
            case 'tools':
                return 'Tools';
            case 'armor':
                return 'Armor';
            case 'weapons':
                return 'Weapons';
            default:
                return type.charAt(0).toUpperCase() + type.slice(1);
        }
    }

    /**
     * Toggle optional proficiency selection
     * @param {HTMLElement} profItem - The proficiency item element
     */
    toggleOptionalProficiency(profItem) {
        if (!this.character) return;

        const proficiency = profItem.dataset.proficiency;
        const profType = profItem.dataset.type;

        if (!proficiency || !profType) return;

        try {
            if (profType === 'skills') {
                // Determine if the proficiency is part of race, class, or background options
                const isRaceOption = this.character.optionalProficiencies.skills.race?.options?.includes(proficiency);
                const isClassOption = this.character.optionalProficiencies.skills.class?.options?.includes(proficiency);
                const isBackgroundOption = this.character.optionalProficiencies.skills.background?.options?.includes(proficiency);

                console.log(`[ProficiencyCard] Toggle skill ${proficiency}:`, {
                    isRaceOption,
                    isClassOption,
                    isBackgroundOption,
                    raceAllowed: this.character.optionalProficiencies.skills.race?.allowed || 0,
                    classAllowed: this.character.optionalProficiencies.skills.class?.allowed || 0,
                    backgroundAllowed: this.character.optionalProficiencies.skills.background?.allowed || 0,
                    raceSelected: this.character.optionalProficiencies.skills.race?.selected || [],
                    classSelected: this.character.optionalProficiencies.skills.class?.selected || [],
                    backgroundSelected: this.character.optionalProficiencies.skills.background?.selected || []
                });

                // Handle selection or deselection
                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    // Remove from the appropriate source selection
                    if (isRaceOption && this.character.optionalProficiencies.skills.race?.selected?.includes(proficiency)) {
                        this.character.optionalProficiencies.skills.race.selected =
                            this.character.optionalProficiencies.skills.race.selected.filter(p => p !== proficiency);
                        console.log(`[ProficiencyCard] Removed ${proficiency} from race selections`);
                    } else if (isClassOption && this.character.optionalProficiencies.skills.class?.selected?.includes(proficiency)) {
                        this.character.optionalProficiencies.skills.class.selected =
                            this.character.optionalProficiencies.skills.class.selected.filter(p => p !== proficiency);
                        console.log(`[ProficiencyCard] Removed ${proficiency} from class selections`);
                    } else if (isBackgroundOption && this.character.optionalProficiencies.skills.background?.selected?.includes(proficiency)) {
                        this.character.optionalProficiencies.skills.background.selected =
                            this.character.optionalProficiencies.skills.background.selected.filter(p => p !== proficiency);
                        console.log(`[ProficiencyCard] Removed ${proficiency} from background selections`);
                    }

                    // Update combined selection
                    this.character.optionalProficiencies.skills.selected =
                        this.character.optionalProficiencies.skills.selected.filter(p => p !== proficiency);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected');
                    const icon = profItem.querySelector('.proficiency-icon');
                    if (icon) {
                        icon.textContent = 'radio_button_unchecked';
                    }
                } else {
                    // Check if we can add the proficiency based on available slots
                    const canAdd = (
                        (isRaceOption && (this.character.optionalProficiencies.skills.race?.selected?.length || 0) < (this.character.optionalProficiencies.skills.race?.allowed || 0)) ||
                        (isClassOption && (this.character.optionalProficiencies.skills.class?.selected?.length || 0) < (this.character.optionalProficiencies.skills.class?.allowed || 0)) ||
                        (isBackgroundOption && (this.character.optionalProficiencies.skills.background?.selected?.length || 0) < (this.character.optionalProficiencies.skills.background?.allowed || 0))
                    );

                    if (canAdd) {
                        // Check if this skill is ONLY available in one source
                        // This helps us prioritize restricted sources over general ones
                        if (isRaceOption && !isClassOption && !isBackgroundOption &&
                            (this.character.optionalProficiencies.skills.race?.selected?.length || 0) < (this.character.optionalProficiencies.skills.race?.allowed || 0)) {
                            // Only in race options
                            this.character.optionalProficiencies.skills.race.selected.push(proficiency);
                            console.log(`[ProficiencyCard] Added ${proficiency} to race selections (exclusive)`);
                        }
                        else if (!isRaceOption && isClassOption && !isBackgroundOption &&
                            (this.character.optionalProficiencies.skills.class?.selected?.length || 0) < (this.character.optionalProficiencies.skills.class?.allowed || 0)) {
                            // Only in class options
                            this.character.optionalProficiencies.skills.class.selected.push(proficiency);
                            console.log(`[ProficiencyCard] Added ${proficiency} to class selections (exclusive)`);
                        }
                        else if (!isRaceOption && !isClassOption && isBackgroundOption &&
                            (this.character.optionalProficiencies.skills.background?.selected?.length || 0) < (this.character.optionalProficiencies.skills.background?.allowed || 0)) {
                            // Only in background options
                            this.character.optionalProficiencies.skills.background.selected.push(proficiency);
                            console.log(`[ProficiencyCard] Added ${proficiency} to background selections (exclusive)`);
                        }
                        else {
                            // Appears in multiple sources - prioritize based on which is MOST restrictive
                            // Class and background lists are usually more restricted than race

                            // 1. Check if race allows "any" skill (large options list - standard skills)
                            const raceAllowsAny = isRaceOption &&
                                (this.character.optionalProficiencies.skills.race?.options?.length || 0) > 10 &&
                                (this.character.optionalProficiencies.skills.race?.selected?.length || 0) < (this.character.optionalProficiencies.skills.race?.allowed || 0);

                            // 2. Check if class has available slots with restricted options
                            const classIsRestricted = isClassOption &&
                                (this.character.optionalProficiencies.skills.class?.options?.length || 0) < 10 &&
                                (this.character.optionalProficiencies.skills.class?.selected?.length || 0) < (this.character.optionalProficiencies.skills.class?.allowed || 0);

                            // 3. Check if background has available slots with restricted options
                            const bgIsRestricted = isBackgroundOption &&
                                (this.character.optionalProficiencies.skills.background?.options?.length || 0) < 10 &&
                                (this.character.optionalProficiencies.skills.background?.selected?.length || 0) < (this.character.optionalProficiencies.skills.background?.allowed || 0);

                            if (classIsRestricted) {
                                // Prioritize class if it's restricted
                                this.character.optionalProficiencies.skills.class.selected.push(proficiency);
                                console.log(`[ProficiencyCard] Added ${proficiency} to class selections (prioritized)`);
                            }
                            else if (bgIsRestricted) {
                                // Next prioritize background if it's restricted
                                this.character.optionalProficiencies.skills.background.selected.push(proficiency);
                                console.log(`[ProficiencyCard] Added ${proficiency} to background selections (prioritized)`);
                            }
                            else if (raceAllowsAny) {
                                // If race allows any skill, use that
                                this.character.optionalProficiencies.skills.race.selected.push(proficiency);
                                console.log(`[ProficiencyCard] Added ${proficiency} to race selections (any skill)`);
                            }
                            else {
                                // Default priority: class > background > race
                                if (isClassOption && (this.character.optionalProficiencies.skills.class?.selected?.length || 0) < (this.character.optionalProficiencies.skills.class?.allowed || 0)) {
                                    this.character.optionalProficiencies.skills.class.selected.push(proficiency);
                                    console.log(`[ProficiencyCard] Added ${proficiency} to class selections (default)`);
                                } else if (isBackgroundOption && (this.character.optionalProficiencies.skills.background?.selected?.length || 0) < (this.character.optionalProficiencies.skills.background?.allowed || 0)) {
                                    this.character.optionalProficiencies.skills.background.selected.push(proficiency);
                                    console.log(`[ProficiencyCard] Added ${proficiency} to background selections (default)`);
                                } else if (isRaceOption && (this.character.optionalProficiencies.skills.race?.selected?.length || 0) < (this.character.optionalProficiencies.skills.race?.allowed || 0)) {
                                    this.character.optionalProficiencies.skills.race.selected.push(proficiency);
                                    console.log(`[ProficiencyCard] Added ${proficiency} to race selections (default)`);
                                }
                            }
                        }

                        // Update combined selection
                        if (!this.character.optionalProficiencies.skills.selected.includes(proficiency)) {
                            this.character.optionalProficiencies.skills.selected.push(proficiency);
                        }

                        // Update UI
                        profItem.classList.add('selected', 'optional-selected');
                        const icon = profItem.querySelector('.proficiency-icon');
                        if (icon) {
                            icon.textContent = 'radio_button_checked';
                        }
                    } else {
                        console.log(`[ProficiencyCard] Cannot add ${proficiency} - no slots available`);
                    }
                }
            } else if (profType === 'languages') {
                // Determine if the language is part of race, class, or background options
                const isRaceOption = this.character.optionalProficiencies.languages.race?.options?.includes(proficiency) ||
                    this.character.optionalProficiencies.languages.race?.options?.includes('Any');
                const isClassOption = this.character.optionalProficiencies.languages.class?.options?.includes(proficiency) ||
                    this.character.optionalProficiencies.languages.class?.options?.includes('Any');
                const isBackgroundOption = this.character.optionalProficiencies.languages.background?.options?.includes(proficiency) ||
                    this.character.optionalProficiencies.languages.background?.options?.includes('Any');

                console.log(`[ProficiencyCard] Toggle language ${proficiency}:`, {
                    isRaceOption,
                    isClassOption,
                    isBackgroundOption,
                    raceAllowed: this.character.optionalProficiencies.languages.race?.allowed || 0,
                    classAllowed: this.character.optionalProficiencies.languages.class?.allowed || 0,
                    backgroundAllowed: this.character.optionalProficiencies.languages.background?.allowed || 0,
                    raceOptions: this.character.optionalProficiencies.languages.race?.options || [],
                    classOptions: this.character.optionalProficiencies.languages.class?.options || [],
                    backgroundOptions: this.character.optionalProficiencies.languages.background?.options || [],
                    raceSelected: this.character.optionalProficiencies.languages.race?.selected || [],
                    classSelected: this.character.optionalProficiencies.languages.class?.selected || [],
                    backgroundSelected: this.character.optionalProficiencies.languages.background?.selected || []
                });

                // Handle selection or deselection
                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    // Remove from the appropriate source selection
                    if (isRaceOption && this.character.optionalProficiencies.languages.race?.selected?.includes(proficiency)) {
                        this.character.optionalProficiencies.languages.race.selected =
                            this.character.optionalProficiencies.languages.race.selected.filter(p => p !== proficiency);
                        console.log(`[ProficiencyCard] Removed ${proficiency} from race language selections`);
                    } else if (isClassOption && this.character.optionalProficiencies.languages.class?.selected?.includes(proficiency)) {
                        this.character.optionalProficiencies.languages.class.selected =
                            this.character.optionalProficiencies.languages.class.selected.filter(p => p !== proficiency);
                        console.log(`[ProficiencyCard] Removed ${proficiency} from class language selections`);
                    } else if (isBackgroundOption && this.character.optionalProficiencies.languages.background?.selected?.includes(proficiency)) {
                        this.character.optionalProficiencies.languages.background.selected =
                            this.character.optionalProficiencies.languages.background.selected.filter(p => p !== proficiency);
                        console.log(`[ProficiencyCard] Removed ${proficiency} from background language selections`);
                    }

                    // Update combined selection
                    this.character.optionalProficiencies.languages.selected =
                        this.character.optionalProficiencies.languages.selected.filter(p => p !== proficiency);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected');
                    const icon = profItem.querySelector('.proficiency-icon');
                    if (icon) {
                        icon.textContent = 'radio_button_unchecked';
                    }
                } else {
                    // Check if we can add the language based on available slots
                    const canAdd = (
                        (isRaceOption && (this.character.optionalProficiencies.languages.race?.selected?.length || 0) < (this.character.optionalProficiencies.languages.race?.allowed || 0)) ||
                        (isClassOption && (this.character.optionalProficiencies.languages.class?.selected?.length || 0) < (this.character.optionalProficiencies.languages.class?.allowed || 0)) ||
                        (isBackgroundOption && (this.character.optionalProficiencies.languages.background?.selected?.length || 0) < (this.character.optionalProficiencies.languages.background?.allowed || 0))
                    );

                    if (canAdd) {
                        // Check if this language is ONLY available in one source
                        // This helps us prioritize restricted sources over general ones
                        if (isRaceOption && !isClassOption && !isBackgroundOption &&
                            (this.character.optionalProficiencies.languages.race?.selected?.length || 0) < (this.character.optionalProficiencies.languages.race?.allowed || 0)) {
                            // Only in race options
                            this.character.optionalProficiencies.languages.race.selected.push(proficiency);
                            console.log(`[ProficiencyCard] Added ${proficiency} to race language selections (exclusive)`);
                        }
                        else if (!isRaceOption && isClassOption && !isBackgroundOption &&
                            (this.character.optionalProficiencies.languages.class?.selected?.length || 0) < (this.character.optionalProficiencies.languages.class?.allowed || 0)) {
                            // Only in class options
                            this.character.optionalProficiencies.languages.class.selected.push(proficiency);
                            console.log(`[ProficiencyCard] Added ${proficiency} to class language selections (exclusive)`);
                        }
                        else if (!isRaceOption && !isClassOption && isBackgroundOption &&
                            (this.character.optionalProficiencies.languages.background?.selected?.length || 0) < (this.character.optionalProficiencies.languages.background?.allowed || 0)) {
                            // Only in background options
                            this.character.optionalProficiencies.languages.background.selected.push(proficiency);
                            console.log(`[ProficiencyCard] Added ${proficiency} to background language selections (exclusive)`);
                        }
                        else {
                            // Appears in multiple sources - prioritize based on which is MOST restrictive
                            // Class and background lists are usually more restricted than race

                            // 1. Check if race allows "any" language (large options list - standard languages)
                            const raceAllowsAny = isRaceOption &&
                                (this.character.optionalProficiencies.languages.race?.options?.length || 0) > 10 &&
                                (this.character.optionalProficiencies.languages.race?.selected?.length || 0) < (this.character.optionalProficiencies.languages.race?.allowed || 0);

                            // 2. Check if class has available slots with restricted options
                            const classIsRestricted = isClassOption &&
                                (this.character.optionalProficiencies.languages.class?.options?.length || 0) < 10 &&
                                (this.character.optionalProficiencies.languages.class?.selected?.length || 0) < (this.character.optionalProficiencies.languages.class?.allowed || 0);

                            // 3. Check if background has available slots with restricted options
                            const bgIsRestricted = isBackgroundOption &&
                                (this.character.optionalProficiencies.languages.background?.options?.length || 0) < 10 &&
                                (this.character.optionalProficiencies.languages.background?.selected?.length || 0) < (this.character.optionalProficiencies.languages.background?.allowed || 0);

                            if (classIsRestricted) {
                                // Prioritize class if it's restricted
                                this.character.optionalProficiencies.languages.class.selected.push(proficiency);
                                console.log(`[ProficiencyCard] Added ${proficiency} to class language selections (prioritized)`);
                            }
                            else if (bgIsRestricted) {
                                // Next prioritize background if it's restricted
                                this.character.optionalProficiencies.languages.background.selected.push(proficiency);
                                console.log(`[ProficiencyCard] Added ${proficiency} to background language selections (prioritized)`);
                            }
                            else if (raceAllowsAny) {
                                // If race allows any language, use that
                                this.character.optionalProficiencies.languages.race.selected.push(proficiency);
                                console.log(`[ProficiencyCard] Added ${proficiency} to race language selections (any language)`);
                            }
                            else {
                                // Default priority: class > background > race
                                if (isClassOption && (this.character.optionalProficiencies.languages.class?.selected?.length || 0) < (this.character.optionalProficiencies.languages.class?.allowed || 0)) {
                                    this.character.optionalProficiencies.languages.class.selected.push(proficiency);
                                    console.log(`[ProficiencyCard] Added ${proficiency} to class language selections (default)`);
                                } else if (isBackgroundOption && (this.character.optionalProficiencies.languages.background?.selected?.length || 0) < (this.character.optionalProficiencies.languages.background?.allowed || 0)) {
                                    this.character.optionalProficiencies.languages.background.selected.push(proficiency);
                                    console.log(`[ProficiencyCard] Added ${proficiency} to background language selections (default)`);
                                } else if (isRaceOption && (this.character.optionalProficiencies.languages.race?.selected?.length || 0) < (this.character.optionalProficiencies.languages.race?.allowed || 0)) {
                                    this.character.optionalProficiencies.languages.race.selected.push(proficiency);
                                    console.log(`[ProficiencyCard] Added ${proficiency} to race language selections (default)`);
                                }
                            }
                        }

                        // Update combined selection
                        if (!this.character.optionalProficiencies.languages.selected.includes(proficiency)) {
                            this.character.optionalProficiencies.languages.selected.push(proficiency);
                        }

                        // Update UI for languages
                        profItem.classList.add('selected', 'optional-selected');
                        const icon = profItem.querySelector('.proficiency-icon');
                        if (icon) {
                            icon.textContent = 'radio_button_checked';
                        }
                    } else {
                        console.log(`[ProficiencyCard] Cannot add ${proficiency} language - no slots available`);
                    }
                }
            } else if (profType === 'tools') {
                // Determine if the tool is part of race, class, or background options
                const isRaceOption = this.character.optionalProficiencies.tools.race?.options?.includes(proficiency);
                const isClassOption = this.character.optionalProficiencies.tools.class?.options?.includes(proficiency);
                const isBackgroundOption = this.character.optionalProficiencies.tools.background?.options?.includes(proficiency);

                console.log(`[ProficiencyCard] Toggle tool ${proficiency}:`, {
                    isRaceOption,
                    isClassOption,
                    isBackgroundOption,
                    raceAllowed: this.character.optionalProficiencies.tools.race?.allowed || 0,
                    classAllowed: this.character.optionalProficiencies.tools.class?.allowed || 0,
                    backgroundAllowed: this.character.optionalProficiencies.tools.background?.allowed || 0,
                    raceSelected: this.character.optionalProficiencies.tools.race?.selected || [],
                    classSelected: this.character.optionalProficiencies.tools.class?.selected || [],
                    backgroundSelected: this.character.optionalProficiencies.tools.background?.selected || []
                });

                // Handle selection or deselection
                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    // Remove from the appropriate source selection
                    if (isRaceOption && this.character.optionalProficiencies.tools.race?.selected?.includes(proficiency)) {
                        this.character.optionalProficiencies.tools.race.selected =
                            this.character.optionalProficiencies.tools.race.selected.filter(p => p !== proficiency);
                        console.log(`[ProficiencyCard] Removed ${proficiency} from race tool selections`);
                    } else if (isClassOption && this.character.optionalProficiencies.tools.class?.selected?.includes(proficiency)) {
                        this.character.optionalProficiencies.tools.class.selected =
                            this.character.optionalProficiencies.tools.class.selected.filter(p => p !== proficiency);
                        console.log(`[ProficiencyCard] Removed ${proficiency} from class tool selections`);
                    } else if (isBackgroundOption && this.character.optionalProficiencies.tools.background?.selected?.includes(proficiency)) {
                        this.character.optionalProficiencies.tools.background.selected =
                            this.character.optionalProficiencies.tools.background.selected.filter(p => p !== proficiency);
                        console.log(`[ProficiencyCard] Removed ${proficiency} from background tool selections`);
                    }

                    // Update combined selection
                    this.character.optionalProficiencies.tools.selected =
                        this.character.optionalProficiencies.tools.selected.filter(p => p !== proficiency);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected');
                    const icon = profItem.querySelector('.proficiency-icon');
                    if (icon) {
                        icon.textContent = 'radio_button_unchecked';
                    }
                } else {
                    // Check if we can add the tool based on available slots
                    const canAdd = (
                        (isRaceOption && (this.character.optionalProficiencies.tools.race?.selected?.length || 0) < (this.character.optionalProficiencies.tools.race?.allowed || 0)) ||
                        (isClassOption && (this.character.optionalProficiencies.tools.class?.selected?.length || 0) < (this.character.optionalProficiencies.tools.class?.allowed || 0)) ||
                        (isBackgroundOption && (this.character.optionalProficiencies.tools.background?.selected?.length || 0) < (this.character.optionalProficiencies.tools.background?.allowed || 0))
                    );

                    if (canAdd) {
                        // Check if this tool is ONLY available in one source
                        // This helps us prioritize restricted sources over general ones
                        if (isRaceOption && !isClassOption && !isBackgroundOption &&
                            (this.character.optionalProficiencies.tools.race?.selected?.length || 0) < (this.character.optionalProficiencies.tools.race?.allowed || 0)) {
                            // Only in race options
                            this.character.optionalProficiencies.tools.race.selected.push(proficiency);
                            console.log(`[ProficiencyCard] Added ${proficiency} to race tool selections (exclusive)`);
                        }
                        else if (!isRaceOption && isClassOption && !isBackgroundOption &&
                            (this.character.optionalProficiencies.tools.class?.selected?.length || 0) < (this.character.optionalProficiencies.tools.class?.allowed || 0)) {
                            // Only in class options
                            this.character.optionalProficiencies.tools.class.selected.push(proficiency);
                            console.log(`[ProficiencyCard] Added ${proficiency} to class tool selections (exclusive)`);
                        }
                        else if (!isRaceOption && !isClassOption && isBackgroundOption &&
                            (this.character.optionalProficiencies.tools.background?.selected?.length || 0) < (this.character.optionalProficiencies.tools.background?.allowed || 0)) {
                            // Only in background options
                            this.character.optionalProficiencies.tools.background.selected.push(proficiency);
                            console.log(`[ProficiencyCard] Added ${proficiency} to background tool selections (exclusive)`);
                        }
                        else {
                            // Appears in multiple sources - prioritize based on which is MOST restrictive

                            // 1. Check if race allows "any" tool (large options list)
                            const raceAllowsAny = isRaceOption &&
                                (this.character.optionalProficiencies.tools.race?.options?.length || 0) > 15 &&
                                (this.character.optionalProficiencies.tools.race?.selected?.length || 0) < (this.character.optionalProficiencies.tools.race?.allowed || 0);

                            // 2. Check if class has available slots with restricted options
                            const classIsRestricted = isClassOption &&
                                (this.character.optionalProficiencies.tools.class?.options?.length || 0) < 15 &&
                                (this.character.optionalProficiencies.tools.class?.selected?.length || 0) < (this.character.optionalProficiencies.tools.class?.allowed || 0);

                            // 3. Check if background has available slots with restricted options
                            const bgIsRestricted = isBackgroundOption &&
                                (this.character.optionalProficiencies.tools.background?.options?.length || 0) < 15 &&
                                (this.character.optionalProficiencies.tools.background?.selected?.length || 0) < (this.character.optionalProficiencies.tools.background?.allowed || 0);

                            if (classIsRestricted) {
                                // Prioritize class if it's restricted
                                this.character.optionalProficiencies.tools.class.selected.push(proficiency);
                                console.log(`[ProficiencyCard] Added ${proficiency} to class tool selections (prioritized)`);
                            }
                            else if (bgIsRestricted) {
                                // Next prioritize background if it's restricted
                                this.character.optionalProficiencies.tools.background.selected.push(proficiency);
                                console.log(`[ProficiencyCard] Added ${proficiency} to background tool selections (prioritized)`);
                            }
                            else if (raceAllowsAny) {
                                // If race allows any tool, use that
                                this.character.optionalProficiencies.tools.race.selected.push(proficiency);
                                console.log(`[ProficiencyCard] Added ${proficiency} to race tool selections (any tool)`);
                            }
                            else {
                                // Default priority: class > background > race
                                if (isClassOption && (this.character.optionalProficiencies.tools.class?.selected?.length || 0) < (this.character.optionalProficiencies.tools.class?.allowed || 0)) {
                                    this.character.optionalProficiencies.tools.class.selected.push(proficiency);
                                    console.log(`[ProficiencyCard] Added ${proficiency} to class tool selections (default)`);
                                } else if (isBackgroundOption && (this.character.optionalProficiencies.tools.background?.selected?.length || 0) < (this.character.optionalProficiencies.tools.background?.allowed || 0)) {
                                    this.character.optionalProficiencies.tools.background.selected.push(proficiency);
                                    console.log(`[ProficiencyCard] Added ${proficiency} to background tool selections (default)`);
                                } else if (isRaceOption && (this.character.optionalProficiencies.tools.race?.selected?.length || 0) < (this.character.optionalProficiencies.tools.race?.allowed || 0)) {
                                    this.character.optionalProficiencies.tools.race.selected.push(proficiency);
                                    console.log(`[ProficiencyCard] Added ${proficiency} to race tool selections (default)`);
                                }
                            }
                        }

                        // Update combined selection
                        if (!this.character.optionalProficiencies.tools.selected.includes(proficiency)) {
                            this.character.optionalProficiencies.tools.selected.push(proficiency);
                        }

                        // Update UI for tools
                        profItem.classList.add('selected', 'optional-selected');
                        const icon = profItem.querySelector('.proficiency-icon');
                        if (icon) {
                            icon.textContent = 'radio_button_checked';
                        }
                    } else {
                        console.log(`[ProficiencyCard] Cannot add ${proficiency} tool - no slots available`);
                    }
                }
            } else {
                // Handle other proficiency types (armor, weapons) using the original logic
                const selectedProfs = this.character.optionalProficiencies[profType].selected;
                const allowedCount = this.character.optionalProficiencies[profType].allowed;

                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    // Remove proficiency from selection
                    this.character.optionalProficiencies[profType].selected = selectedProfs.filter(p => p !== proficiency);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected');
                    const icon = profItem.querySelector('.proficiency-icon');
                    if (icon) {
                        icon.textContent = 'radio_button_unchecked';
                    }
                } else {
                    // Check if we can add more proficiencies
                    if (selectedProfs.length < allowedCount) {
                        // Add proficiency to selection
                        this.character.optionalProficiencies[profType].selected.push(proficiency);

                        // Update UI
                        profItem.classList.add('selected', 'optional-selected');
                        const icon = profItem.querySelector('.proficiency-icon');
                        if (icon) {
                            icon.textContent = 'radio_button_checked';
                        }
                    }
                }
            }

            // Update proficiency count displays
            this.updateSelectionCounters();

            // Trigger character change event
            document.dispatchEvent(new CustomEvent('characterChanged'));

        } catch (error) {
            console.error(`[ProficiencyCard] Error toggling proficiency ${proficiency}:`, error);
        }
    }

    /**
     * Update selection counters for optional proficiencies
     * @private
     */
    updateSelectionCounters() {
        for (const type of this.proficiencyTypes) {
            const container = this.proficiencyContainers[type];
            if (!container) continue;

            const header = container.closest('.proficiency-section')?.querySelector('h6');
            const counter = header?.querySelector('.selection-counter');
            if (!counter) continue;

            const allowed = this.character?.optionalProficiencies?.[type]?.allowed || 0;
            const selected = this.character?.optionalProficiencies?.[type]?.selected?.length || 0;
            counter.textContent = ` (${selected}/${allowed} selected)`;
        }
    }

    /**
     * Update proficiency notes section to show source for each proficiency
     * @private
     */
    updateProficiencyNotes() {
        if (!this.proficiencyNotesContainer || !this.character) return;

        // Group proficiencies by type with source in parentheses
        const typeGroups = {};

        // Process each proficiency type
        for (const type of this.proficiencyTypes) {
            if (!this.character.proficiencySources[type]) continue;

            // Initialize the type group if not exists
            if (!typeGroups[type]) {
                typeGroups[type] = [];
            }

            // Iterate through each proficiency and its sources
            for (const [proficiency, sources] of this.character.proficiencySources[type].entries()) {
                // Skip default proficiencies like Common language
                if (this.defaultProficiencies[type]?.includes(proficiency)) {
                    continue;
                }

                // Get source names as an array and capitalize first letter
                const sourceNames = Array.from(sources).map(src =>
                    src.charAt(0).toUpperCase() + src.slice(1)
                );

                // Add proficiency with source to the type group
                typeGroups[type].push({
                    name: proficiency,
                    source: sourceNames.join(', ')
                });
            }
        }

        // Add optionally selected proficiencies
        for (const type of this.proficiencyTypes) {
            if (!this.character.optionalProficiencies?.[type]?.selected?.length) continue;

            // Initialize the type group if not exists
            if (!typeGroups[type]) {
                typeGroups[type] = [];
            }

            const selected = this.character.optionalProficiencies[type].selected;

            for (const prof of selected) {
                // Skip if this proficiency is already included from another source
                if (typeGroups[type].some(item => item.name === prof)) {
                    continue;
                }

                // Most commonly, optional proficiencies come from backgrounds
                // If we can't determine the exact source, Background is a reasonable default
                typeGroups[type].push({
                    name: prof,
                    source: 'Background'
                });
            }
        }

        // If no proficiencies, show a message
        if (Object.keys(typeGroups).length === 0 ||
            Object.values(typeGroups).every(group => group.length === 0)) {
            this.proficiencyNotesContainer.innerHTML = '<p>No proficiencies applied.</p>';
            return;
        }

        // Build the notes HTML
        let notesHTML = '<p><strong>Proficiency Sources:</strong></p>';

        for (const type in typeGroups) {
            if (typeGroups[type].length === 0) continue;

            const typeLabel = this.getTypeLabel(type);
            notesHTML += `<div class="proficiency-note"><strong>${typeLabel}:</strong> `;

            // Sort proficiencies alphabetically
            typeGroups[type].sort((a, b) => a.name.localeCompare(b.name));

            // Create formatted strings with source in parentheses
            const profStrings = typeGroups[type].map(prof =>
                `${prof.name} (${prof.source})`
            );

            notesHTML += profStrings.join(', ');
            notesHTML += '</div>';
        }

        this.proficiencyNotesContainer.innerHTML = notesHTML;

        // Process the notes container to resolve reference tags
        textProcessor.processElement(this.proficiencyNotesContainer);
    }

    /**
     * Mark that there are unsaved changes
     * @private
     */
    markUnsavedChanges() {
        characterHandler.showUnsavedChanges();
    }

    /**
     * Check if a proficiency is granted by a fixed source (not a choice)
     * @param {string} type - Proficiency type
     * @param {string} proficiency - The proficiency to check
     * @returns {boolean} True if granted by a fixed source
     */
    isGrantedBySource(type, proficiency) {
        if (!this.character?.proficiencySources?.[type]) {
            return false;
        }

        // Normalize the proficiency name for case-insensitive comparison
        const normalizedProf = proficiency.toLowerCase().trim();

        // Find the matching proficiency by case-insensitive comparison
        let matchingProf = null;
        for (const [prof, _] of this.character.proficiencySources[type].entries()) {
            if (prof.toLowerCase().trim() === normalizedProf) {
                matchingProf = prof;
                break;
            }
        }

        if (!matchingProf) {
            return false;
        }

        const sources = this.character.proficiencySources[type].get(matchingProf);

        // Add extra debug log for specific skills we're having trouble with
        if (type === 'skills' && ['Sleight of Hand', 'sleight of hand', 'Deception'].some(s =>
            s.toLowerCase() === normalizedProf)) {
            console.log(`[ProficiencyCard] Checking sources for ${proficiency} (normalized: ${normalizedProf}, matched: ${matchingProf}):`,
                Array.from(sources));
        }

        // If there are no sources, the proficiency is not granted
        if (!sources || sources.size === 0) {
            return false;
        }

        // Check if any of the sources are fixed sources
        const fixedSources = Array.from(sources).filter(source =>
            source !== 'Race Choice' &&
            source !== 'Class Choice' &&
            source !== 'Background Choice' &&
            !source.includes('Choice')
        );

        // If there are any fixed sources, the proficiency is granted
        return fixedSources.length > 0;
    }

    /**
     * Remove proficiencies from the optional selected list when they become granted by a fixed source
     * This frees up optional slots for new selections when a proficiency becomes automatically granted
     * @private
     */
    cleanupOptionalProficiencies() {
        if (!this.character || !this.character.optionalProficiencies) return;

        let changesDetected = false;

        // Check each proficiency type
        for (const type of this.proficiencyTypes) {
            if (!this.character.optionalProficiencies[type]?.selected) continue;

            // Special handling for skills to manage race, class, and background sources separately
            if (type === 'skills') {
                // Get all the fixed proficiencies for this type
                const fixedProficiencies = this.character.proficiencies[type] || [];

                // Clean up race skills
                if (this.character.optionalProficiencies.skills.race?.selected) {
                    const raceSelected = [...this.character.optionalProficiencies.skills.race.selected];
                    for (const skill of raceSelected) {
                        // Check if this skill is now a fixed proficiency
                        if (fixedProficiencies.includes(skill)) {
                            // Check if it's granted by a fixed source (not from optional selection)
                            const sources = this.character.proficiencySources?.skills?.get(skill);
                            if (sources && Array.from(sources).some(source =>
                                source !== 'Race Choice' &&
                                source !== 'Class Choice' &&
                                source !== 'Background Choice')) {

                                // Remove from race selection
                                this.character.optionalProficiencies.skills.race.selected =
                                    this.character.optionalProficiencies.skills.race.selected.filter(s => s !== skill);
                                console.log('[ProficiencyCard] Removed', skill, 'from race selected skills (now granted by another source)');
                                changesDetected = true;
                            }
                        }
                    }

                    // Ensure race doesn't have more selections than allowed
                    const raceAllowed = this.character.optionalProficiencies.skills.race.allowed || 0;
                    if (this.character.optionalProficiencies.skills.race.selected.length > raceAllowed) {
                        console.log('[ProficiencyCard] Too many race skills selected, removing excess');
                        this.character.optionalProficiencies.skills.race.selected =
                            this.character.optionalProficiencies.skills.race.selected.slice(0, raceAllowed);
                        changesDetected = true;
                    }
                }

                // Clean up class skills
                if (this.character.optionalProficiencies.skills.class?.selected) {
                    const classSelected = [...this.character.optionalProficiencies.skills.class.selected];
                    for (const skill of classSelected) {
                        // Check if this skill is now a fixed proficiency
                        if (fixedProficiencies.includes(skill)) {
                            // Check if it's granted by a fixed source (not from optional selection)
                            const sources = this.character.proficiencySources?.skills?.get(skill);
                            if (sources && Array.from(sources).some(source =>
                                source !== 'Race Choice' &&
                                source !== 'Class Choice' &&
                                source !== 'Background Choice')) {

                                // Remove from class selection
                                this.character.optionalProficiencies.skills.class.selected =
                                    this.character.optionalProficiencies.skills.class.selected.filter(s => s !== skill);
                                console.log('[ProficiencyCard] Removed', skill, 'from class selected skills (now granted by another source)');
                                changesDetected = true;
                            }
                        }
                    }

                    // Ensure class doesn't have more selections than allowed
                    const classAllowed = this.character.optionalProficiencies.skills.class.allowed || 0;
                    if (this.character.optionalProficiencies.skills.class.selected.length > classAllowed) {
                        console.log('[ProficiencyCard] Too many class skills selected, removing excess');
                        this.character.optionalProficiencies.skills.class.selected =
                            this.character.optionalProficiencies.skills.class.selected.slice(0, classAllowed);
                        changesDetected = true;
                    }
                }

                // Clean up background skills
                if (this.character.optionalProficiencies.skills.background?.selected) {
                    const backgroundSelected = [...this.character.optionalProficiencies.skills.background.selected];
                    for (const skill of backgroundSelected) {
                        // Check if this skill is now a fixed proficiency
                        if (fixedProficiencies.includes(skill)) {
                            // Check if it's granted by a fixed source (not from optional selection)
                            const sources = this.character.proficiencySources?.skills?.get(skill);
                            if (sources && Array.from(sources).some(source =>
                                source !== 'Race Choice' &&
                                source !== 'Class Choice' &&
                                source !== 'Background Choice')) {

                                // Remove from background selection
                                this.character.optionalProficiencies.skills.background.selected =
                                    this.character.optionalProficiencies.skills.background.selected.filter(s => s !== skill);
                                console.log('[ProficiencyCard] Removed', skill, 'from background selected skills (now granted by another source)');
                                changesDetected = true;
                            }
                        }
                    }

                    // Ensure background doesn't have more selections than allowed
                    const backgroundAllowed = this.character.optionalProficiencies.skills.background.allowed || 0;
                    if (this.character.optionalProficiencies.skills.background.selected.length > backgroundAllowed) {
                        console.log('[ProficiencyCard] Too many background skills selected, removing excess');
                        this.character.optionalProficiencies.skills.background.selected =
                            this.character.optionalProficiencies.skills.background.selected.slice(0, backgroundAllowed);
                        changesDetected = true;
                    }
                }

                // Update combined selected list
                if (changesDetected) {
                    const raceSelected = this.character.optionalProficiencies.skills.race.selected || [];
                    const classSelected = this.character.optionalProficiencies.skills.class.selected || [];
                    const backgroundSelected = this.character.optionalProficiencies.skills.background.selected || [];
                    this.character.optionalProficiencies.skills.selected = [...raceSelected, ...classSelected, ...backgroundSelected];
                }
            }
            // Regular cleanup for non-skill proficiencies
            else {
                const selectedOptional = [...this.character.optionalProficiencies[type].selected];

                // Check if any of the selected optional proficiencies are now granted by a fixed source
                for (const prof of selectedOptional) {
                    // Skip if not in the character's proficiencies list
                    if (!this.character.proficiencies[type].includes(prof)) continue;

                    // Check if it's now granted by a source (race, class, background)
                    if (this.isGrantedBySource(type, prof)) {
                        // Remove from optional selection since it's now fixed
                        this.character.optionalProficiencies[type].selected =
                            this.character.optionalProficiencies[type].selected.filter(p => p !== prof);
                        console.log('[ProficiencyCard] Removed', prof, 'from optional', type, 'since it\'s now granted by another source');
                        changesDetected = true;
                    }
                }

                // Ensure we don't have more selections than allowed
                const allowed = this.character.optionalProficiencies[type].allowed || 0;
                const selected = this.character.optionalProficiencies[type].selected || [];

                if (selected.length > allowed) {
                    console.log('[ProficiencyCard] Too many', type, 'selected (', selected.length, '/', allowed, '), removing excess');
                    // Keep only the first 'allowed' number of selections
                    this.character.optionalProficiencies[type].selected = selected.slice(0, allowed);
                    changesDetected = true;
                }
            }
        }

        if (changesDetected) {
            // Refresh the display to show changes
            this.populateProficiencyContainers();

            // Mark unsaved changes
            this.markUnsavedChanges();
        }

        return changesDetected;
    }
} 