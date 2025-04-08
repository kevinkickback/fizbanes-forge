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
        /**
         * Reference to the current character
         * @type {Character|null}
         * @private
         */
        this._character = null;

        /**
         * Instance of the proficiency manager
         * @type {ProficiencyManager}
         * @private
         */
        this._proficiencyManager = new ProficiencyManager(dataLoader);

        /**
         * List of all proficiency types
         * @type {string[]}
         * @private
         */
        this._proficiencyTypes = ['skills', 'savingThrows', 'languages', 'tools', 'armor', 'weapons'];

        /**
         * Default proficiencies that all characters have
         * @type {Object.<string, string[]>}
         * @private
         */
        this._defaultProficiencies = {
            languages: ['Common'],
            weapons: [],
            armor: [],
            tools: [],
            skills: [],
            savingThrows: []
        };

        /**
         * DOM element references for proficiency containers
         * @type {Object.<string, HTMLElement>}
         * @private
         */
        this._proficiencyContainers = {};

        /**
         * DOM element reference for proficiency notes container
         * @type {HTMLElement|null}
         * @private
         */
        this._proficiencyNotesContainer = null;
    }

    //-------------------------------------------------------------------------
    // Initialization Methods
    //-------------------------------------------------------------------------

    /**
     * Initialize the proficiency card UI and data
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // Get the current character
            this._character = characterHandler.currentCharacter;
            if (!this._character) {
                console.error('No active character found');
                return;
            }

            // Initialize DOM element references
            this._initializeDomReferences();

            // Set up event listeners
            this._setupEventListeners();

            // Initialize character proficiency structures if needed
            this._initializeCharacterProficiencies();

            // Populate UI elements
            await this._populateProficiencyContainers();

            // Update notes display
            this._updateProficiencyNotes();
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }

    /**
     * Initialize DOM element references for all proficiency containers
     * @private
     */
    _initializeDomReferences() {
        for (const type of this._proficiencyTypes) {
            const containerId = `${type}Container`;
            this._proficiencyContainers[type] = document.getElementById(containerId);

            if (!this._proficiencyContainers[type]) {
                console.warn(`Container for ${type} not found: #${containerId}`);
            }
        }

        this._proficiencyNotesContainer = document.getElementById('proficiencyNotes');

        if (!this._proficiencyNotesContainer) {
            console.warn('Proficiency notes container not found');
        }
    }

    /**
     * Initialize character proficiency structures if they don't exist
     * @private
     */
    _initializeCharacterProficiencies() {
        if (!this._character) return;

        try {
            // Initialize proficiencies object if it doesn't exist
            if (!this._character.proficiencies) {
                this._character.proficiencies = {};
            }

            // Initialize proficiency sources object if it doesn't exist
            if (!this._character.proficiencySources) {
                this._character.proficiencySources = {};
            }

            // Initialize optional proficiencies object if it doesn't exist
            if (!this._character.optionalProficiencies) {
                this._character.optionalProficiencies = {};
            }

            // Initialize each proficiency type as an array
            for (const type of this._proficiencyTypes) {
                // Regular proficiencies
                if (!Array.isArray(this._character.proficiencies[type])) {
                    this._character.proficiencies[type] = [];
                }

                // Proficiency sources
                if (!this._character.proficiencySources[type]) {
                    this._character.proficiencySources[type] = new Map();
                }

                // Optional proficiencies
                if (!this._character.optionalProficiencies[type]) {
                    this._character.optionalProficiencies[type] = {
                        allowed: 0,
                        selected: []
                    };
                }

                // For skills and languages, ensure we have all the nested structures
                if (type === 'skills' || type === 'languages') {
                    this._initializeNestedProficiencyStructures(type);
                }
            }

            // Add default proficiencies if not already present
            this._addDefaultProficiencies();

        } catch (error) {
            console.error('Error initializing character proficiencies:', error);
        }
    }

    /**
     * Initialize nested proficiency structures for skills and languages
     * @param {string} type - The proficiency type to initialize
     * @private
     */
    _initializeNestedProficiencyStructures(type) {
        // Make sure top level options array exists
        if (!this._character.optionalProficiencies[type].options) {
            this._character.optionalProficiencies[type].options = [];
        }

        // Initialize race, class, and background structures
        const sources = ['race', 'class', 'background'];
        for (const source of sources) {
            if (!this._character.optionalProficiencies[type][source]) {
                this._character.optionalProficiencies[type][source] = {
                    allowed: 0,
                    options: [],
                    selected: []
                };
            } else {
                // Ensure all properties exist if the object itself does
                if (typeof this._character.optionalProficiencies[type][source].allowed === 'undefined') {
                    this._character.optionalProficiencies[type][source].allowed = 0;
                }
                if (!Array.isArray(this._character.optionalProficiencies[type][source].options)) {
                    this._character.optionalProficiencies[type][source].options = [];
                }
                if (!Array.isArray(this._character.optionalProficiencies[type][source].selected)) {
                    this._character.optionalProficiencies[type][source].selected = [];
                }
            }
        }
    }

    /**
     * Add default proficiencies to the character
     * @private
     */
    _addDefaultProficiencies() {
        for (const [type, defaults] of Object.entries(this._defaultProficiencies)) {
            for (const prof of defaults) {
                if (!this._character.proficiencies[type].includes(prof)) {
                    this._character.addProficiency(type, prof, 'Default');
                }
            }
        }
    }

    //-------------------------------------------------------------------------
    // Event Handling Methods
    //-------------------------------------------------------------------------

    /**
     * Set up event listeners for proficiency containers
     * @private
     */
    _setupEventListeners() {
        try {
            // Set up click listeners for each proficiency container
            this._setupContainerClickListeners();

            // Listen for character changes
            document.addEventListener('characterChanged', this._handleCharacterChanged.bind(this));

            // Listen for proficiency-specific events from the character handler
            document.addEventListener('proficiencyAdded', this._handleProficiencyChanged.bind(this));
            document.addEventListener('proficienciesRemoved', this._handleProficiencyChanged.bind(this));
            document.addEventListener('proficiencyChanged', this._handleProficiencyChanged.bind(this));

            // Add listeners to character handler static methods for proficiency changes
            this._setupCharacterProficiencyEventListeners();

        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    /**
     * Set up click listeners for each proficiency container
     * @private
     */
    _setupContainerClickListeners() {
        for (const type of this._proficiencyTypes) {
            const container = this._proficiencyContainers[type];
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
                    this._toggleOptionalProficiency(item);
                }
            });
        }
    }

    /**
     * Set up event listeners for character proficiency changes
     * @private
     */
    _setupCharacterProficiencyEventListeners() {
        if (!characterHandler._hasAddedProficiencyEventListeners && this._character) {
            // Set up a method to dispatch events when proficiencies are added
            const originalAddProficiency = this._character.addProficiency;
            this._character.addProficiency = function (type, proficiency, source) {
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
            const originalRemoveBySource = this._character.removeProficienciesBySource;
            this._character.removeProficienciesBySource = function (source) {
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
     * @param {CustomEvent} event - The character changed event
     * @private
     */
    _handleCharacterChanged(event) {
        try {
            this._character = characterHandler.currentCharacter;

            if (this._character) {
                // Add proficiency event listeners to the new character
                if (!characterHandler._hasAddedProficiencyEventListeners) {
                    this._setupCharacterProficiencyEventListeners();
                }

                this._initializeCharacterProficiencies();
                this._cleanupOptionalProficiencies();
                this._populateProficiencyContainers();
                this._updateProficiencyNotes();
            }
        } catch (error) {
            console.error('Error handling character change:', error);
        }
    }

    /**
     * Handle proficiency change events
     * @param {CustomEvent} event - The proficiency change event
     * @private
     */
    _handleProficiencyChanged(event) {
        try {
            // Get the event details
            const detail = event.detail || {};

            // Clean up optional proficiencies if needed
            if (detail.triggerCleanup) {
                this._cleanupOptionalProficiencies();
            }

            // Update the UI
            if (detail.forcedRefresh) {
                this._populateProficiencyContainers();
            } else {
                this._updateSelectionCounters();
            }

            // Update proficiency notes
            this._updateProficiencyNotes();

            // Mark character as having unsaved changes
            this._markUnsavedChanges();

            // Show refund notification if specified
            if (detail.showRefund && detail.proficiency) {
                this._showRefundNotification(detail.proficiency);
            }
        } catch (error) {
            console.error('Error handling proficiency change:', error);
        }
    }

    /**
     * Shows a notification when a skill proficiency has been refunded
     * @param {string} skill - The name of the skill that was refunded
     * @private
     */
    _showRefundNotification(skill) {
        // Implementation of notification logic here
        console.info(`Skill proficiency refunded: ${skill}`);
    }

    //-------------------------------------------------------------------------
    // Proficiency Management Methods
    //-------------------------------------------------------------------------

    /**
     * Populate the proficiency containers with available options
     * @returns {Promise<void>}
     */
    async _populateProficiencyContainers() {
        if (!this._character) return;

        for (const type of this._proficiencyTypes) {
            const container = this._proficiencyContainers[type];
            if (!container) continue;

            // Get available options for this proficiency type
            const availableOptions = await this._getAvailableOptions(type);


            // Handle selection counter in section header
            const header = container.closest('.proficiency-section')?.querySelector('h6');
            if (header && type !== 'savingThrows') {
                const optionalCount = this._character?.optionalProficiencies?.[type]?.allowed || 0;
                if (optionalCount > 0) {
                    const selectedCount = this._character?.optionalProficiencies?.[type]?.selected?.length || 0;
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
                const isProficient = this._character.proficiencies[type].includes(item);

                // Check if this is an optionally selected proficiency
                const isOptionallySelected = this._character?.optionalProficiencies?.[type]?.selected?.includes(item) || false;

                // Check if this is a default proficiency (always selected)
                const isDefault = this._defaultProficiencies[type]?.includes(item);

                // Check if this proficiency is granted by a source like race/background
                const isGranted = this._isGrantedBySource(type, item);

                // Directly use isProficiencyAvailable method to determine if this item is selectable
                let canSelect = false;

                // Special handling for languages and skills - use our isProficiencyAvailable method
                if (type === 'languages' || type === 'skills') {
                    canSelect = this._isProficiencyAvailable(type, item) && !isDefault && !isGranted && !isOptionallySelected;
                } else {
                    // For other types, just check if there are slots available
                    canSelect = this._isProficiencyAvailable(type, item) && !isDefault && !isGranted && !isOptionallySelected;
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
                        const raceOptions = this._character.optionalProficiencies?.[type]?.race?.options || [];
                        const classOptions = this._character.optionalProficiencies?.[type]?.class?.options || [];
                        const backgroundOptions = this._character.optionalProficiencies?.[type]?.background?.options || [];

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
                        <i class="fas ${this._getIconForType(type)} ${isOptionallySelected ? 'optional' : ''}"></i>
                        ${item}
                        ${type === 'skills' ? `<span class="ability">(${this._proficiencyManager.getSkillAbility(item)})</span>` : ''}
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
    async _getAvailableOptions(type) {
        switch (type) {
            case 'skills':
                return this._proficiencyManager.getAvailableSkills();
            case 'savingThrows':
                return ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
            case 'languages': {
                // Make sure to log the language options
                const availableLanguages = [
                    'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin',
                    'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Draconic',
                    'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'
                ];


                return availableLanguages;
            }
            case 'tools':
                return this._proficiencyManager.getAvailableTools();
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
    _isProficiencyAvailable(type, proficiency) {
        if (!this._character) return false;

        // Default proficiencies are always selected but not selectable
        if (this._defaultProficiencies[type]?.includes(proficiency)) {
            return false;
        }

        // If proficiency is granted by class/race/background, it's not selectable
        if (this._isGrantedBySource(type, proficiency)) {
            return false;
        }

        // Check if there are optional proficiencies of this type allowed
        const optionalAllowed = this._character.optionalProficiencies?.[type]?.allowed || 0;
        if (optionalAllowed <= 0) {
            return false;
        }

        // Check if all slots are already filled
        const selectedCount = this._character.optionalProficiencies?.[type]?.selected?.length || 0;
        if (selectedCount >= optionalAllowed) {
            return false;
        }

        // Special handling for languages
        if (type === 'languages') {
            // Get the options and allowed counts from background
            const backgroundOptions = this._character.optionalProficiencies.languages.background?.options || [];
            const backgroundAllowed = this._character.optionalProficiencies.languages.background?.allowed || 0;
            const backgroundSelected = this._character.optionalProficiencies.languages.background?.selected || [];

            // Special case: If background options contains 'Any', it means any language can be selected
            const backgroundAllowsAny = backgroundOptions.includes('Any');

            // Check if this language is in the background options and there are slots available
            // OR if background allows any language and there are slots available
            if ((backgroundAllowsAny || backgroundOptions.includes(proficiency)) &&
                backgroundSelected.length < backgroundAllowed) {
                // Skip if it's Common (default language) or already granted
                if (proficiency === 'Common' || this._isGrantedBySource('languages', proficiency)) {
                    return false;
                }
                return true;
            }

            // Also check race and class options
            const raceOptions = this._character.optionalProficiencies.languages.race?.options || [];
            const raceAllowed = this._character.optionalProficiencies.languages.race?.allowed || 0;
            const raceSelected = this._character.optionalProficiencies.languages.race?.selected || [];

            const raceAllowsAny = raceOptions.includes('Any');

            if ((raceAllowsAny || raceOptions.includes(proficiency)) &&
                raceSelected.length < raceAllowed) {
                return true;
            }

            const classOptions = this._character.optionalProficiencies.languages.class?.options || [];
            const classAllowed = this._character.optionalProficiencies.languages.class?.allowed || 0;
            const classSelected = this._character.optionalProficiencies.languages.class?.selected || [];

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
            const raceOptions = this._character.optionalProficiencies[type].race?.options || [];
            const classOptions = this._character.optionalProficiencies[type].class?.options || [];
            const backgroundOptions = this._character.optionalProficiencies[type].background?.options || [];
            const raceAllowed = this._character.optionalProficiencies[type].race?.allowed || 0;
            const classAllowed = this._character.optionalProficiencies[type].class?.allowed || 0;
            const backgroundAllowed = this._character.optionalProficiencies[type].background?.allowed || 0;

            // If we have race options and race slots available
            if (raceOptions.length > 0 && raceAllowed > 0) {
                // Is this a race option?
                const isRaceOption = raceOptions.includes(proficiency);
                // Are race slots filled?
                const raceSelected = this._character.optionalProficiencies[type].race?.selected || [];
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
                const classSelected = this._character.optionalProficiencies[type].class?.selected || [];
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
                const backgroundSelected = this._character.optionalProficiencies[type].background?.selected || [];
                const backgroundSlotsFull = backgroundSelected.length >= backgroundAllowed;

                if (isBackgroundOption && !backgroundSlotsFull) {
                    return true;
                }
            }

            // If none of the above conditions are met, the proficiency is not available
            return false;
        }

        // For other types, just check if there are slots available
        return this._character.optionalProficiencies?.[type]?.allowed > 0 &&
            this._character.optionalProficiencies?.[type]?.selected?.length < this._character.optionalProficiencies?.[type]?.allowed;
    }

    /**
     * Get the appropriate icon class for a proficiency type
     * @param {string} type - Proficiency type
     * @returns {string} Font Awesome icon class
     * @private
     */
    _getIconForType(type) {
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
    _getTypeLabel(type) {
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
    _toggleOptionalProficiency(profItem) {
        if (!this._character) return;

        const proficiency = profItem.dataset.proficiency;
        const profType = profItem.dataset.type;

        if (!proficiency || !profType) return;

        try {
            if (profType === 'skills') {
                // Determine if the proficiency is part of race, class, or background options
                const isRaceOption = this._character.optionalProficiencies.skills.race?.options?.includes(proficiency);
                const isClassOption = this._character.optionalProficiencies.skills.class?.options?.includes(proficiency);
                const isBackgroundOption = this._character.optionalProficiencies.skills.background?.options?.includes(proficiency);

                // Handle selection or deselection
                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    // Remove from the appropriate source selection
                    if (isRaceOption && this._character.optionalProficiencies.skills.race?.selected?.includes(proficiency)) {
                        this._character.optionalProficiencies.skills.race.selected =
                            this._character.optionalProficiencies.skills.race.selected.filter(p => p !== proficiency);
                    } else if (isClassOption && this._character.optionalProficiencies.skills.class?.selected?.includes(proficiency)) {
                        this._character.optionalProficiencies.skills.class.selected =
                            this._character.optionalProficiencies.skills.class.selected.filter(p => p !== proficiency);
                    } else if (isBackgroundOption && this._character.optionalProficiencies.skills.background?.selected?.includes(proficiency)) {
                        this._character.optionalProficiencies.skills.background.selected =
                            this._character.optionalProficiencies.skills.background.selected.filter(p => p !== proficiency);
                    }

                    // Update combined selection
                    this._character.optionalProficiencies.skills.selected =
                        this._character.optionalProficiencies.skills.selected.filter(p => p !== proficiency);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected');
                    const icon = profItem.querySelector('.proficiency-icon');
                    if (icon) {
                        icon.textContent = 'radio_button_unchecked';
                    }
                } else {
                    // Check if we can add the proficiency based on available slots
                    const canAdd = (
                        (isRaceOption && (this._character.optionalProficiencies.skills.race?.selected?.length || 0) < (this._character.optionalProficiencies.skills.race?.allowed || 0)) ||
                        (isClassOption && (this._character.optionalProficiencies.skills.class?.selected?.length || 0) < (this._character.optionalProficiencies.skills.class?.allowed || 0)) ||
                        (isBackgroundOption && (this._character.optionalProficiencies.skills.background?.selected?.length || 0) < (this._character.optionalProficiencies.skills.background?.allowed || 0))
                    );

                    if (canAdd) {
                        // Check if this skill is ONLY available in one source
                        // This helps us prioritize restricted sources over general ones
                        if (isRaceOption && !isClassOption && !isBackgroundOption &&
                            (this._character.optionalProficiencies.skills.race?.selected?.length || 0) < (this._character.optionalProficiencies.skills.race?.allowed || 0)) {
                            // Only in race options
                            this._character.optionalProficiencies.skills.race.selected.push(proficiency);
                        }
                        else if (!isRaceOption && isClassOption && !isBackgroundOption &&
                            (this._character.optionalProficiencies.skills.class?.selected?.length || 0) < (this._character.optionalProficiencies.skills.class?.allowed || 0)) {
                            // Only in class options
                            this._character.optionalProficiencies.skills.class.selected.push(proficiency);
                        }
                        else if (!isRaceOption && !isClassOption && isBackgroundOption &&
                            (this._character.optionalProficiencies.skills.background?.selected?.length || 0) < (this._character.optionalProficiencies.skills.background?.allowed || 0)) {
                            // Only in background options
                            this._character.optionalProficiencies.skills.background.selected.push(proficiency);
                        }
                        else {
                            // Appears in multiple sources - prioritize based on which is MOST restrictive
                            // Class and background lists are usually more restricted than race

                            // 1. Check if race allows "any" skill (large options list - standard skills)
                            const raceAllowsAny = isRaceOption &&
                                (this._character.optionalProficiencies.skills.race?.options?.length || 0) > 10 &&
                                (this._character.optionalProficiencies.skills.race?.selected?.length || 0) < (this._character.optionalProficiencies.skills.race?.allowed || 0);

                            // 2. Check if class has available slots with restricted options
                            const classIsRestricted = isClassOption &&
                                (this._character.optionalProficiencies.skills.class?.options?.length || 0) < 10 &&
                                (this._character.optionalProficiencies.skills.class?.selected?.length || 0) < (this._character.optionalProficiencies.skills.class?.allowed || 0);

                            // 3. Check if background has available slots with restricted options
                            const bgIsRestricted = isBackgroundOption &&
                                (this._character.optionalProficiencies.skills.background?.options?.length || 0) < 10 &&
                                (this._character.optionalProficiencies.skills.background?.selected?.length || 0) < (this._character.optionalProficiencies.skills.background?.allowed || 0);

                            if (classIsRestricted) {
                                // Prioritize class if it's restricted
                                this._character.optionalProficiencies.skills.class.selected.push(proficiency);
                            }
                            else if (bgIsRestricted) {
                                // Next prioritize background if it's restricted
                                this._character.optionalProficiencies.skills.background.selected.push(proficiency);
                            }
                            else if (raceAllowsAny) {
                                // If race allows any skill, use that
                                this._character.optionalProficiencies.skills.race.selected.push(proficiency);
                            }
                            else {
                                // Default priority: class > background > race
                                if (isClassOption && (this._character.optionalProficiencies.skills.class?.selected?.length || 0) < (this._character.optionalProficiencies.skills.class?.allowed || 0)) {
                                    this._character.optionalProficiencies.skills.class.selected.push(proficiency);
                                } else if (isBackgroundOption && (this._character.optionalProficiencies.skills.background?.selected?.length || 0) < (this._character.optionalProficiencies.skills.background?.allowed || 0)) {
                                    this._character.optionalProficiencies.skills.background.selected.push(proficiency);
                                } else if (isRaceOption && (this._character.optionalProficiencies.skills.race?.selected?.length || 0) < (this._character.optionalProficiencies.skills.race?.allowed || 0)) {
                                    this._character.optionalProficiencies.skills.race.selected.push(proficiency);
                                }
                            }
                        }

                        // Update combined selection
                        if (!this._character.optionalProficiencies.skills.selected.includes(proficiency)) {
                            this._character.optionalProficiencies.skills.selected.push(proficiency);
                        }

                        // Update UI
                        profItem.classList.add('selected', 'optional-selected');
                        const icon = profItem.querySelector('.proficiency-icon');
                        if (icon) {
                            icon.textContent = 'radio_button_checked';
                        }
                    }
                }
            } else if (profType === 'languages') {
                // Determine if the language is part of race, class, or background options
                const isRaceOption = this._character.optionalProficiencies.languages.race?.options?.includes(proficiency) ||
                    this._character.optionalProficiencies.languages.race?.options?.includes('Any');
                const isClassOption = this._character.optionalProficiencies.languages.class?.options?.includes(proficiency) ||
                    this._character.optionalProficiencies.languages.class?.options?.includes('Any');
                const isBackgroundOption = this._character.optionalProficiencies.languages.background?.options?.includes(proficiency) ||
                    this._character.optionalProficiencies.languages.background?.options?.includes('Any');

                // Handle selection or deselection
                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    // Remove from the appropriate source selection
                    if (isRaceOption && this._character.optionalProficiencies.languages.race?.selected?.includes(proficiency)) {
                        this._character.optionalProficiencies.languages.race.selected =
                            this._character.optionalProficiencies.languages.race.selected.filter(p => p !== proficiency);
                    } else if (isClassOption && this._character.optionalProficiencies.languages.class?.selected?.includes(proficiency)) {
                        this._character.optionalProficiencies.languages.class.selected =
                            this._character.optionalProficiencies.languages.class.selected.filter(p => p !== proficiency);
                    } else if (isBackgroundOption && this._character.optionalProficiencies.languages.background?.selected?.includes(proficiency)) {
                        this._character.optionalProficiencies.languages.background.selected =
                            this._character.optionalProficiencies.languages.background.selected.filter(p => p !== proficiency);
                    }

                    // Update combined selection
                    this._character.optionalProficiencies.languages.selected =
                        this._character.optionalProficiencies.languages.selected.filter(p => p !== proficiency);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected');
                    const icon = profItem.querySelector('.proficiency-icon');
                    if (icon) {
                        icon.textContent = 'radio_button_unchecked';
                    }
                } else {
                    // Check if we can add the language based on available slots
                    const canAdd = (
                        (isRaceOption && (this._character.optionalProficiencies.languages.race?.selected?.length || 0) < (this._character.optionalProficiencies.languages.race?.allowed || 0)) ||
                        (isClassOption && (this._character.optionalProficiencies.languages.class?.selected?.length || 0) < (this._character.optionalProficiencies.languages.class?.allowed || 0)) ||
                        (isBackgroundOption && (this._character.optionalProficiencies.languages.background?.selected?.length || 0) < (this._character.optionalProficiencies.languages.background?.allowed || 0))
                    );

                    if (canAdd) {
                        // Check if this language is ONLY available in one source
                        // This helps us prioritize restricted sources over general ones
                        if (isRaceOption && !isClassOption && !isBackgroundOption &&
                            (this._character.optionalProficiencies.languages.race?.selected?.length || 0) < (this._character.optionalProficiencies.languages.race?.allowed || 0)) {
                            // Only in race options
                            this._character.optionalProficiencies.languages.race.selected.push(proficiency);
                        }
                        else if (!isRaceOption && isClassOption && !isBackgroundOption &&
                            (this._character.optionalProficiencies.languages.class?.selected?.length || 0) < (this._character.optionalProficiencies.languages.class?.allowed || 0)) {
                            // Only in class options
                            this._character.optionalProficiencies.languages.class.selected.push(proficiency);
                        }
                        else if (!isRaceOption && !isClassOption && isBackgroundOption &&
                            (this._character.optionalProficiencies.languages.background?.selected?.length || 0) < (this._character.optionalProficiencies.languages.background?.allowed || 0)) {
                            // Only in background options
                            this._character.optionalProficiencies.languages.background.selected.push(proficiency);
                        }
                        else {
                            // Appears in multiple sources - prioritize based on which is MOST restrictive
                            // Class and background lists are usually more restricted than race

                            // 1. Check if race allows "any" language (large options list - standard languages)
                            const raceAllowsAny = isRaceOption &&
                                (this._character.optionalProficiencies.languages.race?.options?.length || 0) > 10 &&
                                (this._character.optionalProficiencies.languages.race?.selected?.length || 0) < (this._character.optionalProficiencies.languages.race?.allowed || 0);

                            // 2. Check if class has available slots with restricted options
                            const classIsRestricted = isClassOption &&
                                (this._character.optionalProficiencies.languages.class?.options?.length || 0) < 10 &&
                                (this._character.optionalProficiencies.languages.class?.selected?.length || 0) < (this._character.optionalProficiencies.languages.class?.allowed || 0);

                            // 3. Check if background has available slots with restricted options
                            const bgIsRestricted = isBackgroundOption &&
                                (this._character.optionalProficiencies.languages.background?.options?.length || 0) < 10 &&
                                (this._character.optionalProficiencies.languages.background?.selected?.length || 0) < (this._character.optionalProficiencies.languages.background?.allowed || 0);

                            if (classIsRestricted) {
                                // Prioritize class if it's restricted
                                this._character.optionalProficiencies.languages.class.selected.push(proficiency);
                            }
                            else if (bgIsRestricted) {
                                // Next prioritize background if it's restricted
                                this._character.optionalProficiencies.languages.background.selected.push(proficiency);
                            }
                            else if (raceAllowsAny) {
                                // If race allows any language, use that
                                this._character.optionalProficiencies.languages.race.selected.push(proficiency);
                            }
                            else {
                                // Default priority: class > background > race
                                if (isClassOption && (this._character.optionalProficiencies.languages.class?.selected?.length || 0) < (this._character.optionalProficiencies.languages.class?.allowed || 0)) {
                                    this._character.optionalProficiencies.languages.class.selected.push(proficiency);
                                } else if (isBackgroundOption && (this._character.optionalProficiencies.languages.background?.selected?.length || 0) < (this._character.optionalProficiencies.languages.background?.allowed || 0)) {
                                    this._character.optionalProficiencies.languages.background.selected.push(proficiency);
                                } else if (isRaceOption && (this._character.optionalProficiencies.languages.race?.selected?.length || 0) < (this._character.optionalProficiencies.languages.race?.allowed || 0)) {
                                    this._character.optionalProficiencies.languages.race.selected.push(proficiency);
                                }
                            }
                        }

                        // Update combined selection
                        if (!this._character.optionalProficiencies.languages.selected.includes(proficiency)) {
                            this._character.optionalProficiencies.languages.selected.push(proficiency);
                        }

                        // Update UI for languages
                        profItem.classList.add('selected', 'optional-selected');
                        const icon = profItem.querySelector('.proficiency-icon');
                        if (icon) {
                            icon.textContent = 'radio_button_checked';
                        }
                    }
                }
            } else if (profType === 'tools') {
                // Determine if the tool is part of race, class, or background options
                const isRaceOption = this._character.optionalProficiencies.tools.race?.options?.includes(proficiency);
                const isClassOption = this._character.optionalProficiencies.tools.class?.options?.includes(proficiency);
                const isBackgroundOption = this._character.optionalProficiencies.tools.background?.options?.includes(proficiency);

                // Handle selection or deselection
                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    // Remove from the appropriate source selection
                    if (isRaceOption && this._character.optionalProficiencies.tools.race?.selected?.includes(proficiency)) {
                        this._character.optionalProficiencies.tools.race.selected =
                            this._character.optionalProficiencies.tools.race.selected.filter(p => p !== proficiency);
                    } else if (isClassOption && this._character.optionalProficiencies.tools.class?.selected?.includes(proficiency)) {
                        this._character.optionalProficiencies.tools.class.selected =
                            this._character.optionalProficiencies.tools.class.selected.filter(p => p !== proficiency);
                    } else if (isBackgroundOption && this._character.optionalProficiencies.tools.background?.selected?.includes(proficiency)) {
                        this._character.optionalProficiencies.tools.background.selected =
                            this._character.optionalProficiencies.tools.background.selected.filter(p => p !== proficiency);
                    }

                    // Update combined selection
                    this._character.optionalProficiencies.tools.selected =
                        this._character.optionalProficiencies.tools.selected.filter(p => p !== proficiency);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected');
                    const icon = profItem.querySelector('.proficiency-icon');
                    if (icon) {
                        icon.textContent = 'radio_button_unchecked';
                    }
                } else {
                    // Check if we can add the tool based on available slots
                    const canAdd = (
                        (isRaceOption && (this._character.optionalProficiencies.tools.race?.selected?.length || 0) < (this._character.optionalProficiencies.tools.race?.allowed || 0)) ||
                        (isClassOption && (this._character.optionalProficiencies.tools.class?.selected?.length || 0) < (this._character.optionalProficiencies.tools.class?.allowed || 0)) ||
                        (isBackgroundOption && (this._character.optionalProficiencies.tools.background?.selected?.length || 0) < (this._character.optionalProficiencies.tools.background?.allowed || 0))
                    );

                    if (canAdd) {
                        // Check if this tool is ONLY available in one source
                        // This helps us prioritize restricted sources over general ones
                        if (isRaceOption && !isClassOption && !isBackgroundOption &&
                            (this._character.optionalProficiencies.tools.race?.selected?.length || 0) < (this._character.optionalProficiencies.tools.race?.allowed || 0)) {
                            // Only in race options
                            this._character.optionalProficiencies.tools.race.selected.push(proficiency);
                        }
                        else if (!isRaceOption && isClassOption && !isBackgroundOption &&
                            (this._character.optionalProficiencies.tools.class?.selected?.length || 0) < (this._character.optionalProficiencies.tools.class?.allowed || 0)) {
                            // Only in class options
                            this._character.optionalProficiencies.tools.class.selected.push(proficiency);
                        }
                        else if (!isRaceOption && !isClassOption && isBackgroundOption &&
                            (this._character.optionalProficiencies.tools.background?.selected?.length || 0) < (this._character.optionalProficiencies.tools.background?.allowed || 0)) {
                            // Only in background options
                            this._character.optionalProficiencies.tools.background.selected.push(proficiency);
                        }
                        else {
                            // Appears in multiple sources - prioritize based on which is MOST restrictive

                            // 1. Check if race allows "any" tool (large options list)
                            const raceAllowsAny = isRaceOption &&
                                (this._character.optionalProficiencies.tools.race?.options?.length || 0) > 15 &&
                                (this._character.optionalProficiencies.tools.race?.selected?.length || 0) < (this._character.optionalProficiencies.tools.race?.allowed || 0);

                            // 2. Check if class has available slots with restricted options
                            const classIsRestricted = isClassOption &&
                                (this._character.optionalProficiencies.tools.class?.options?.length || 0) < 15 &&
                                (this._character.optionalProficiencies.tools.class?.selected?.length || 0) < (this._character.optionalProficiencies.tools.class?.allowed || 0);

                            // 3. Check if background has available slots with restricted options
                            const bgIsRestricted = isBackgroundOption &&
                                (this._character.optionalProficiencies.tools.background?.options?.length || 0) < 15 &&
                                (this._character.optionalProficiencies.tools.background?.selected?.length || 0) < (this._character.optionalProficiencies.tools.background?.allowed || 0);

                            if (classIsRestricted) {
                                // Prioritize class if it's restricted
                                this._character.optionalProficiencies.tools.class.selected.push(proficiency);
                            }
                            else if (bgIsRestricted) {
                                // Next prioritize background if it's restricted
                                this._character.optionalProficiencies.tools.background.selected.push(proficiency);
                            }
                            else if (raceAllowsAny) {
                                // If race allows any tool, use that
                                this._character.optionalProficiencies.tools.race.selected.push(proficiency);
                            }
                            else {
                                // Default priority: class > background > race
                                if (isClassOption && (this._character.optionalProficiencies.tools.class?.selected?.length || 0) < (this._character.optionalProficiencies.tools.class?.allowed || 0)) {
                                    this._character.optionalProficiencies.tools.class.selected.push(proficiency);
                                } else if (isBackgroundOption && (this._character.optionalProficiencies.tools.background?.selected?.length || 0) < (this._character.optionalProficiencies.tools.background?.allowed || 0)) {
                                    this._character.optionalProficiencies.tools.background.selected.push(proficiency);
                                } else if (isRaceOption && (this._character.optionalProficiencies.tools.race?.selected?.length || 0) < (this._character.optionalProficiencies.tools.race?.allowed || 0)) {
                                    this._character.optionalProficiencies.tools.race.selected.push(proficiency);
                                }
                            }
                        }

                        // Update combined selection
                        if (!this._character.optionalProficiencies.tools.selected.includes(proficiency)) {
                            this._character.optionalProficiencies.tools.selected.push(proficiency);
                        }

                        // Update UI for tools
                        profItem.classList.add('selected', 'optional-selected');
                        const icon = profItem.querySelector('.proficiency-icon');
                        if (icon) {
                            icon.textContent = 'radio_button_checked';
                        }
                    }
                }
            } else {
                // Handle other proficiency types (armor, weapons) using the original logic
                const selectedProfs = this._character.optionalProficiencies[profType].selected;
                const allowedCount = this._character.optionalProficiencies[profType].allowed;

                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    // Remove proficiency from selection
                    this._character.optionalProficiencies[profType].selected = selectedProfs.filter(p => p !== proficiency);

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
                        this._character.optionalProficiencies[profType].selected.push(proficiency);

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
            this._updateSelectionCounters();

            // Trigger character change event
            document.dispatchEvent(new CustomEvent('characterChanged'));

        } catch (error) {
            console.error(`Error toggling proficiency ${proficiency}:`, error);
        }
    }

    /**
     * Update selection counters for optional proficiencies
     * @private
     */
    _updateSelectionCounters() {
        for (const type of this._proficiencyTypes) {
            const container = this._proficiencyContainers[type];
            if (!container) continue;

            const header = container.closest('.proficiency-section')?.querySelector('h6');
            const counter = header?.querySelector('.selection-counter');
            if (!counter) continue;

            const allowed = this._character?.optionalProficiencies?.[type]?.allowed || 0;
            const selected = this._character?.optionalProficiencies?.[type]?.selected?.length || 0;
            counter.textContent = ` (${selected}/${allowed} selected)`;
        }
    }

    /**
     * Update the proficiency notes display
     * @private
     */
    _updateProficiencyNotes() {
        if (!this._character || !this._character.proficiencySources) {
            this._proficiencyNotesContainer.innerHTML = '';
            return;
        }

        // Group proficiencies by type
        const typeGroups = {};
        for (const type in this._character.proficiencySources) {
            typeGroups[type] = [];

            // Add each proficiency with its source
            for (const [prof, sources] of this._character.proficiencySources[type].entries()) {
                for (const source of sources) {
                    typeGroups[type].push({
                        name: prof,
                        source: source
                    });
                }
            }
        }

        // Build the notes HTML
        let notesHTML = '<p><strong>Proficiency Sources:</strong></p>';

        for (const type in typeGroups) {
            if (typeGroups[type].length === 0) continue;

            const typeLabel = this._getTypeLabel(type);
            notesHTML += `<div class="proficiency-note"><strong>${typeLabel}:</strong> `;

            // Ensure all proficiencies have a name property that's a string
            const validProfs = typeGroups[type]
                .filter(prof => prof && (typeof prof.name === 'string' || typeof prof.name === 'number'))
                .map(prof => ({
                    name: String(prof.name),
                    source: prof.source
                }));

            // Sort proficiencies alphabetically
            try {
                validProfs.sort((a, b) => a.name.localeCompare(b.name));
            } catch (e) {
                console.warn('Error sorting proficiencies:', e);
                // Continue without sorting if there's an error
            }

            // Create formatted strings with source in parentheses
            const profStrings = validProfs.map(prof =>
                `${prof.name} (${prof.source})`
            );

            notesHTML += profStrings.join(', ');
            notesHTML += '</div>';
        }

        this._proficiencyNotesContainer.innerHTML = notesHTML;

        // Process the notes container to resolve reference tags
        textProcessor.processElement(this._proficiencyNotesContainer);
    }

    /**
     * Mark that there are unsaved changes
     * @private
     */
    _markUnsavedChanges() {
        characterHandler.showUnsavedChanges();
    }

    /**
     * Check if a proficiency is granted by a fixed source (not a choice)
     * @param {string} type - Proficiency type
     * @param {string|Object} proficiency - The proficiency to check
     * @returns {boolean} True if granted by a fixed source
     */
    _isGrantedBySource(type, proficiency) {
        if (!this._character?.proficiencySources?.[type]) {
            return false;
        }

        // Safety check - ensure proficiency is a string
        let profString = proficiency;
        if (typeof proficiency !== 'string') {
            console.warn('Non-string proficiency encountered:', proficiency);

            // Handle object or other types
            if (proficiency && typeof proficiency === 'object' && proficiency.name) {
                profString = proficiency.name;
            } else if (proficiency && typeof proficiency.toString === 'function') {
                profString = proficiency.toString();
            } else {
                return false; // Can't process this proficiency
            }
        }

        // Normalize the proficiency name for case-insensitive comparison
        const normalizedProf = profString.toLowerCase().trim();

        // Find the matching proficiency by case-insensitive comparison
        let matchingProf = null;
        for (const [prof, _] of this._character.proficiencySources[type].entries()) {
            if (prof.toLowerCase?.() !== undefined && prof.toLowerCase().trim() === normalizedProf) {
                matchingProf = prof;
                break;
            }
        }

        if (!matchingProf) {
            return false;
        }

        const sources = this._character.proficiencySources[type].get(matchingProf);

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
    _cleanupOptionalProficiencies() {
        if (!this._character || !this._character.optionalProficiencies) return;

        let changesDetected = false;

        // Check each proficiency type
        for (const type of this._proficiencyTypes) {
            if (!this._character.optionalProficiencies[type]?.selected) continue;

            // Special handling for skills to manage race, class, and background sources separately
            if (type === 'skills') {
                // Get all the fixed proficiencies for this type
                const fixedProficiencies = this._character.proficiencies[type] || [];

                // Clean up race skills
                if (this._character.optionalProficiencies.skills.race?.selected) {
                    const raceSelected = [...this._character.optionalProficiencies.skills.race.selected];
                    for (const skill of raceSelected) {
                        // Check if this skill is now a fixed proficiency
                        if (fixedProficiencies.includes(skill)) {
                            // Check if it's granted by a fixed source (not from optional selection)
                            const sources = this._character.proficiencySources?.skills?.get(skill);
                            if (sources && Array.from(sources).some(source =>
                                source !== 'Race Choice' &&
                                source !== 'Class Choice' &&
                                source !== 'Background Choice')) {

                                // Remove from race selection
                                this._character.optionalProficiencies.skills.race.selected =
                                    this._character.optionalProficiencies.skills.race.selected.filter(s => s !== skill);
                                changesDetected = true;
                            }
                        }
                    }

                    // Ensure race doesn't have more selections than allowed
                    const raceAllowed = this._character.optionalProficiencies.skills.race.allowed || 0;
                    if (this._character.optionalProficiencies.skills.race.selected.length > raceAllowed) {
                        this._character.optionalProficiencies.skills.race.selected =
                            this._character.optionalProficiencies.skills.race.selected.slice(0, raceAllowed);
                        changesDetected = true;
                    }
                }

                // Clean up class skills
                if (this._character.optionalProficiencies.skills.class?.selected) {
                    const classSelected = [...this._character.optionalProficiencies.skills.class.selected];
                    for (const skill of classSelected) {
                        // Check if this skill is now a fixed proficiency
                        if (fixedProficiencies.includes(skill)) {
                            // Check if it's granted by a fixed source (not from optional selection)
                            const sources = this._character.proficiencySources?.skills?.get(skill);
                            if (sources && Array.from(sources).some(source =>
                                source !== 'Race Choice' &&
                                source !== 'Class Choice' &&
                                source !== 'Background Choice')) {

                                // Remove from class selection
                                this._character.optionalProficiencies.skills.class.selected =
                                    this._character.optionalProficiencies.skills.class.selected.filter(s => s !== skill);
                                changesDetected = true;
                            }
                        }
                    }

                    // Ensure class doesn't have more selections than allowed
                    const classAllowed = this._character.optionalProficiencies.skills.class.allowed || 0;
                    if (this._character.optionalProficiencies.skills.class.selected.length > classAllowed) {
                        this._character.optionalProficiencies.skills.class.selected =
                            this._character.optionalProficiencies.skills.class.selected.slice(0, classAllowed);
                        changesDetected = true;
                    }
                }

                // Clean up background skills
                if (this._character.optionalProficiencies.skills.background?.selected) {
                    const backgroundSelected = [...this._character.optionalProficiencies.skills.background.selected];
                    for (const skill of backgroundSelected) {
                        // Check if this skill is now a fixed proficiency
                        if (fixedProficiencies.includes(skill)) {
                            // Check if it's granted by a fixed source (not from optional selection)
                            const sources = this._character.proficiencySources?.skills?.get(skill);
                            if (sources && Array.from(sources).some(source =>
                                source !== 'Race Choice' &&
                                source !== 'Class Choice' &&
                                source !== 'Background Choice')) {

                                // Remove from background selection
                                this._character.optionalProficiencies.skills.background.selected =
                                    this._character.optionalProficiencies.skills.background.selected.filter(s => s !== skill);
                                changesDetected = true;
                            }
                        }
                    }

                    // Ensure background doesn't have more selections than allowed
                    const backgroundAllowed = this._character.optionalProficiencies.skills.background.allowed || 0;
                    if (this._character.optionalProficiencies.skills.background.selected.length > backgroundAllowed) {
                        this._character.optionalProficiencies.skills.background.selected =
                            this._character.optionalProficiencies.skills.background.selected.slice(0, backgroundAllowed);
                        changesDetected = true;
                    }
                }

                // Update combined selected list
                if (changesDetected) {
                    const raceSelected = this._character.optionalProficiencies.skills.race.selected || [];
                    const classSelected = this._character.optionalProficiencies.skills.class.selected || [];
                    const backgroundSelected = this._character.optionalProficiencies.skills.background.selected || [];
                    this._character.optionalProficiencies.skills.selected = [...raceSelected, ...classSelected, ...backgroundSelected];
                }
            }
            // Regular cleanup for non-skill proficiencies
            else {
                const selectedOptional = [...this._character.optionalProficiencies[type].selected];

                // Check if any of the selected optional proficiencies are now granted by a fixed source
                for (const prof of selectedOptional) {
                    // Skip if not in the character's proficiencies list
                    if (!this._character.proficiencies[type].includes(prof)) continue;

                    // Check if it's now granted by a source (race, class, background)
                    if (this._isGrantedBySource(type, prof)) {
                        // Remove from optional selection since it's now fixed
                        this._character.optionalProficiencies[type].selected =
                            this._character.optionalProficiencies[type].selected.filter(p => p !== prof);
                        changesDetected = true;
                    }
                }

                // Ensure we don't have more selections than allowed
                const allowed = this._character.optionalProficiencies[type].allowed || 0;
                const selected = this._character.optionalProficiencies[type].selected || [];

                if (selected.length > allowed) {
                    this._character.optionalProficiencies[type].selected = selected.slice(0, allowed);
                    changesDetected = true;
                }
            }
        }

        if (changesDetected) {
            // Refresh the display to show changes
            this._populateProficiencyContainers();

            // Mark unsaved changes
            this._markUnsavedChanges();
        }

        return changesDetected;
    }
} 