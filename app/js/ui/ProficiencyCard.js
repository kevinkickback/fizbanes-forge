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
        console.info(`Skill proficiency refunded: ${skill}`);
    }

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

            // Check combined slot availability BEFORE the loop
            const optionalAllowed = this._character?.optionalProficiencies?.[type]?.allowed || 0;
            const selectedCount = this._character?.optionalProficiencies?.[type]?.selected?.length || 0;
            const combinedSlotsAvailable = optionalAllowed > 0 && selectedCount < optionalAllowed;

            // Handle selection counter in section header
            const header = container.closest('.proficiency-section')?.querySelector('h6');
            if (header && type !== 'savingThrows') {
                // Use the pre-calculated optionalAllowed and selectedCount
                if (optionalAllowed > 0) {
                    let counterElem = header.querySelector('.selection-counter');
                    if (!counterElem) {
                        counterElem = document.createElement('span');
                        counterElem.className = 'selection-counter';
                        header.appendChild(counterElem);
                    }
                    counterElem.textContent = ` (${selectedCount}/${optionalAllowed} selected)`;
                } else if (header.querySelector('.selection-counter')) {
                    header.querySelector('.selection-counter').remove();
                }
            }

            // Build the container content
            let containerHtml = '';
            for (const item of availableOptions) {
                // Check if this proficiency is already selected (part of combined list)
                const isOptionallySelected = this._character?.optionalProficiencies?.[type]?.selected?.includes(item) || false;

                // Check if this is a default proficiency (always selected)
                const isDefault = this._defaultProficiencies[type]?.includes(item);

                // Check if this proficiency is granted by a fixed source like race/background/class feature
                const isGranted = this._isGrantedBySource(type, item);

                // Check if this proficiency *could* be selected based on its source/options/source-slots
                // (Uses the modified _isProficiencyAvailable which ignores combined limit)
                const isPotentiallySelectable = this._isProficiencyAvailable(type, item);

                // Determine UI state and classes
                const cssClasses = ['proficiency-item'];
                let isClickable = false; // Can this item be interacted with?

                if (isDefault || isGranted) {
                    cssClasses.push('proficient', 'default');
                    isClickable = false; // Granted/Default items are not clickable
                } else if (isOptionallySelected) {
                    cssClasses.push('proficient', 'selected', 'optional-selected');
                    isClickable = true; // Already selected optional items are clickable (to deselect)
                } else if (combinedSlotsAvailable && isPotentiallySelectable) {
                    cssClasses.push('selectable'); // Mark as visually selectable
                    isClickable = true; // Make it clickable to select
                } else {
                    cssClasses.push('disabled');
                    isClickable = false; // Not clickable
                }

                // Add source-specific classes ONLY if it's visually selectable (but not already selected)
                // This helps style items that CAN be chosen from a specific source
                if (cssClasses.includes('selectable') && (type === 'skills' || type === 'languages')) { // Check against 'selectable' class
                    const raceOptions = this._character.optionalProficiencies?.[type]?.race?.options || [];
                    const classOptions = this._character.optionalProficiencies?.[type]?.class?.options || [];
                    const backgroundOptions = this._character.optionalProficiencies?.[type]?.background?.options || [];

                    // Normalize item for comparison if needed, assuming options are consistent case
                    const normalizedItem = typeof item === 'string' ? item : String(item);

                    // Check if the item exists uniquely in one of the source lists
                    const inRace = raceOptions.includes(normalizedItem);
                    const inClass = classOptions.includes(normalizedItem);
                    const inBackground = backgroundOptions.includes(normalizedItem);

                    if (inRace && !inClass && !inBackground) {
                        cssClasses.push('race-only');
                    } else if (!inRace && inClass && !inBackground) {
                        cssClasses.push('class-only');
                    } else if (!inRace && !inClass && inBackground) {
                        cssClasses.push('background-only');
                    }
                    // If it's in multiple lists, no specific class is added here (handled by selection priority logic)
                }

                containerHtml += `<div class="${cssClasses.join(' ')}" data-proficiency="${item}" data-type="${type}"><i class="fas ${this._getIconForType(type)} ${isOptionallySelected ? 'optional' : ''}"></i>${item}${type === 'skills' ? `<span class="ability">(${this._proficiencyManager.getSkillAbility(item)})</span>` : ''}${isOptionallySelected ? '<span class="unselect-hint"><i class="fas fa-times"></i></span>' : ''}</div>`;
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
        if (this._defaultProficiencies[type]?.includes(proficiency)) return false;

        // If proficiency is granted by class/race/background, it's not selectable
        if (this._isGrantedBySource(type, proficiency)) return false;

        // Get the total optional allowed for this type
        const primaryOptionalAllowed = this._character.optionalProficiencies[type]?.allowed || 0;
        const totalOptionalAllowedFromSources = this._getTotalOptionalAllowedFromSources(type);

        if (primaryOptionalAllowed <= 0 && totalOptionalAllowedFromSources <= 0) return false;

        // Normalize proficiency for comparison
        const normalizedProf = String(proficiency).toLowerCase();

        // Handle languages
        if (type === 'languages') {
            const raceOptions = this._character.optionalProficiencies[type].race?.options || [];
            const classOptions = this._character.optionalProficiencies[type].class?.options || [];
            const backgroundOptions = this._character.optionalProficiencies[type].background?.options || [];

            const raceAllowed = this._character.optionalProficiencies[type].race?.allowed || 0;
            const classAllowed = this._character.optionalProficiencies[type].class?.allowed || 0;
            const backgroundAllowed = this._character.optionalProficiencies[type].background?.allowed || 0;

            const raceSelected = this._character.optionalProficiencies[type].race?.selected || [];
            const classSelected = this._character.optionalProficiencies[type].class?.selected || [];
            const backgroundSelected = this._character.optionalProficiencies[type].background?.selected || [];

            // Check if it's an option for any source
            const isRaceOption = raceOptions.map(o => String(o).toLowerCase()).includes(normalizedProf);
            const isClassOption = classOptions.map(o => String(o).toLowerCase()).includes(normalizedProf);
            const isBackgroundOption = backgroundOptions.map(o => String(o).toLowerCase()).includes(normalizedProf);

            // Check if available via any source that has slots left
            if (isRaceOption && raceSelected.length < raceAllowed) return true;
            if (isClassOption && classSelected.length < classAllowed) return true;
            if (isBackgroundOption && backgroundSelected.length < backgroundAllowed) return true;

            return false;
        }

        // For skills, check if the item is in either race, class, or background options AND if slots are available for that source
        if (type === 'skills') {
            const raceOptions = this._character.optionalProficiencies[type].race?.options?.map(o => o.toLowerCase()) || [];
            const classOptions = this._character.optionalProficiencies[type].class?.options?.map(o => o.toLowerCase()) || [];
            const backgroundOptions = this._character.optionalProficiencies[type].background?.options?.map(o => o.toLowerCase()) || [];
            const raceSelected = this._character.optionalProficiencies[type].race?.selected || [];
            const classSelected = this._character.optionalProficiencies[type].class?.selected || [];
            const backgroundSelected = this._character.optionalProficiencies[type].background?.selected || [];

            // Get the allowed counts
            const raceAllowed = this._character.optionalProficiencies[type].race?.allowed || 0;
            const classAllowed = this._character.optionalProficiencies[type].class?.allowed || 0;
            const backgroundAllowed = this._character.optionalProficiencies[type].background?.allowed || 0;

            // Is it a potential option from any source?
            const raceAllowsAny = raceOptions.includes('any');
            const classAllowsAny = classOptions.includes('any');
            const backgroundAllowsAny = backgroundOptions.includes('any');

            const isRaceOption = raceAllowsAny || raceOptions.includes(normalizedProf);
            const isClassOption = classAllowsAny || classOptions.includes(normalizedProf);
            const isBackgroundOption = backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

            // Are slots available for the source(s) it belongs to?
            const raceSlotsAvailable = raceSelected.length < raceAllowed;
            const classSlotsAvailable = classSelected.length < classAllowed;
            const backgroundSlotsAvailable = backgroundSelected.length < backgroundAllowed;

            // Proficiency is available if it's an option for *any* source that still has slots
            if (isRaceOption && raceSlotsAvailable) {
                return true;
            }
            if (!isRaceOption && isClassOption && classSlotsAvailable) {
                return true;
            }
            if (!isRaceOption && isBackgroundOption && backgroundSlotsAvailable) {
                return true;
            }

            return false;
        }

        // For other types (Tools, Armor, Weapons - check if *any* optional slots are allowed for the type)
        // Assumes these don't typically have source-specific options/slots like skills/languages.
        // If they do in the future, this needs logic similar to skills/languages.
        const otherTypeAllowed = this._character.optionalProficiencies?.[type]?.allowed > 0;
        if (otherTypeAllowed) {
            // Check if the specific item is listed in *any* source options for this type, if options exist
            const raceOptions = this._character.optionalProficiencies?.[type]?.race?.options || [];
            const classOptions = this._character.optionalProficiencies?.[type]?.class?.options || [];
            const backgroundOptions = this._character.optionalProficiencies?.[type]?.background?.options || [];
            const hasAnySourceOptions = raceOptions.length > 0 || classOptions.length > 0 || backgroundOptions.length > 0;

            if (hasAnySourceOptions) {
                // If source options lists exist, the item must be in one of them
                const normalizedItem = String(proficiency).toLowerCase();
                return raceOptions.map(o => String(o).toLowerCase()).includes(normalizedItem) ||
                    classOptions.map(o => String(o).toLowerCase()).includes(normalizedItem) ||
                    backgroundOptions.map(o => String(o).toLowerCase()).includes(normalizedItem);
            }
            // If no source options lists exist, assume any item of this type is potentially selectable if allowed > 0
            return true;
        }
        return false;
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
                // Normalize proficiency for checks
                const normalizedProf = proficiency.toLowerCase();
                // Determine if the proficiency is part of race, class, or background options, INCLUDING 'any' check
                const raceOptions = this._character.optionalProficiencies.skills.race?.options?.map(o => o.toLowerCase()) || [];
                const classOptions = this._character.optionalProficiencies.skills.class?.options?.map(o => o.toLowerCase()) || [];
                const backgroundOptions = this._character.optionalProficiencies.skills.background?.options?.map(o => o.toLowerCase()) || [];

                const raceAllowsAny = raceOptions.includes('any');
                const classAllowsAny = classOptions.includes('any');
                const backgroundAllowsAny = backgroundOptions.includes('any');

                const isRaceOption = raceAllowsAny || raceOptions.includes(normalizedProf);
                const isClassOption = classAllowsAny || classOptions.includes(normalizedProf);
                const isBackgroundOption = backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

                // Get current selections for logging and checking
                const raceSelected = this._character.optionalProficiencies.skills.race?.selected || [];
                const classSelected = this._character.optionalProficiencies.skills.class?.selected || [];
                const backgroundSelected = this._character.optionalProficiencies.skills.background?.selected || [];
                const combinedSelected = this._character.optionalProficiencies.skills.selected || [];

                // Handle deselection
                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    let removedFromSource = false; // Flag to track if removed from a specific source

                    // Remove from the appropriate source selection - Check using the normalized name
                    // Check if it *was* selected in race source list
                    if (raceSelected.some(p => p.toLowerCase() === normalizedProf)) {
                        this._character.optionalProficiencies.skills.race.selected =
                            raceSelected.filter(p => p.toLowerCase() !== normalizedProf);
                        removedFromSource = true;
                    }
                    // Check if it *was* selected in class source list
                    if (classSelected.some(p => p.toLowerCase() === normalizedProf)) {
                        this._character.optionalProficiencies.skills.class.selected =
                            classSelected.filter(p => p.toLowerCase() !== normalizedProf);
                        removedFromSource = true;
                    }
                    // Check if it *was* selected in background source list
                    if (backgroundSelected.some(p => p.toLowerCase() === normalizedProf)) {
                        this._character.optionalProficiencies.skills.background.selected =
                            backgroundSelected.filter(p => p.toLowerCase() !== normalizedProf);
                        removedFromSource = true;
                    }

                    if (!removedFromSource) {
                        console.warn('Deselecting skill, but could not find it in any source\'s selected list.');
                    }

                    // Update combined selection using the original proficiency name
                    this._character.optionalProficiencies.skills.selected =
                        combinedSelected.filter(p => p.toLowerCase() !== normalizedProf);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected', 'proficient'); // Ensure proficient is removed on deselect
                    const icon = profItem.querySelector('i.fas'); // Target the actual icon
                    if (icon) {
                        icon.classList.remove('optional');
                    }
                    const unselectHint = profItem.querySelector('.unselect-hint');
                    if (unselectHint) unselectHint.remove();

                }
                // Handle selection
                else {
                    // Get the allowed count for each source
                    const raceAllowed = this._character.optionalProficiencies.skills.race?.allowed || 0;
                    const classAllowed = this._character.optionalProficiencies.skills.class?.allowed || 0;
                    const backgroundAllowed = this._character.optionalProficiencies.skills.background?.allowed || 0;

                    // Calculate slot availability here - compare with allowed count
                    const raceSlotsAvailable = raceSelected.length < raceAllowed;
                    const classSlotsAvailable = classSelected.length < classAllowed;
                    const backgroundSlotsAvailable = backgroundSelected.length < backgroundAllowed;

                    // Prioritize assignment based on where the option comes from and slot availability
                    // Priority: Specific List (Class > Bg > Race) > "Any" List (Class > Bg > Race)
                    let assignedToSource = false; // Declare with let here, initialize to false

                    // 1. Prioritize sources offering the specific skill (NOT via 'any')
                    if (!classAllowsAny && isClassOption && classSlotsAvailable) {
                        this._character.optionalProficiencies.skills.class.selected.push(proficiency);
                        assignedToSource = true; // Assign here
                    }
                    else if (!assignedToSource && !backgroundAllowsAny && isBackgroundOption && backgroundSlotsAvailable) {
                        this._character.optionalProficiencies.skills.background.selected.push(proficiency);
                        assignedToSource = true; // Assign here
                    }
                    else if (!assignedToSource && !raceAllowsAny && isRaceOption && raceSlotsAvailable) {
                        this._character.optionalProficiencies.skills.race.selected.push(proficiency);
                        assignedToSource = true; // Assign here
                    }

                    // 2. If not assigned to a specific list, assign to highest priority 'any' source
                    if (!assignedToSource) {
                        // Priority Order: Class -> Background -> Race
                        if (classAllowsAny && classSlotsAvailable) {
                            this._character.optionalProficiencies.skills.class.selected.push(proficiency);
                            assignedToSource = true; // Assign here
                        }
                        else if (backgroundAllowsAny && backgroundSlotsAvailable) {
                            this._character.optionalProficiencies.skills.background.selected.push(proficiency);
                            assignedToSource = true; // Assign here
                        }
                        else if (raceAllowsAny && raceSlotsAvailable) {
                            this._character.optionalProficiencies.skills.race.selected.push(proficiency);
                            assignedToSource = true; // Assign here
                        }
                    }

                    // Update combined selection only if assigned to a source
                    if (assignedToSource) {
                        if (!this._character.optionalProficiencies.skills.selected.some(p => p.toLowerCase() === normalizedProf)) {
                            this._character.optionalProficiencies.skills.selected.push(proficiency);
                        }

                        // Update UI
                        profItem.classList.add('selected', 'optional-selected', 'proficient');
                        const icon = profItem.querySelector('i.fas'); // Target the actual icon
                        if (icon) {
                            icon.classList.add('optional');
                        }
                        if (!profItem.querySelector('.unselect-hint')) {
                            const hint = document.createElement('span');
                            hint.className = 'unselect-hint';
                            hint.innerHTML = '<i class="fas fa-times"></i>';
                            profItem.appendChild(hint);
                        }
                    } else {
                        console.warn('Could not assign skill to any source despite canAdd being true.');
                    }
                }
            } else if (profType === 'languages') {
                // Normalize proficiency for checks
                const normalizedProf = proficiency.toLowerCase();

                const languageOptions = this._character.optionalProficiencies.languages; // Shortcut
                const raceOptions = languageOptions.race?.options?.map(o => o.toLowerCase()) || [];
                const classOptions = languageOptions.class?.options?.map(o => o.toLowerCase()) || [];
                const backgroundOptions = languageOptions.background?.options?.map(o => o.toLowerCase()) || [];

                const raceAllowsAny = raceOptions.includes('any');
                const classAllowsAny = classOptions.includes('any');
                const backgroundAllowsAny = backgroundOptions.includes('any');

                const isRaceOption = raceAllowsAny || raceOptions.includes(normalizedProf);
                const isClassOption = classAllowsAny || classOptions.includes(normalizedProf);
                const isBackgroundOption = backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

                // Get current selections
                const raceSelected = languageOptions.race?.selected || [];
                const classSelected = languageOptions.class?.selected || [];
                const backgroundSelected = languageOptions.background?.selected || [];
                const combinedSelected = languageOptions.selected || [];

                // Handle deselection
                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    let removedFromSource = false;

                    // Remove from source lists (case-insensitive)
                    if (raceSelected.some(p => p.toLowerCase() === normalizedProf)) {
                        languageOptions.race.selected = raceSelected.filter(p => p.toLowerCase() !== normalizedProf);
                        removedFromSource = true;
                    }
                    if (classSelected.some(p => p.toLowerCase() === normalizedProf)) {
                        languageOptions.class.selected = classSelected.filter(p => p.toLowerCase() !== normalizedProf);
                        removedFromSource = true;
                    }
                    if (backgroundSelected.some(p => p.toLowerCase() === normalizedProf)) {
                        languageOptions.background.selected = backgroundSelected.filter(p => p.toLowerCase() !== normalizedProf);
                        removedFromSource = true;
                    }

                    if (!removedFromSource) {
                        console.warn('Deselecting language, but could not find it in any source\'s selected list.');
                    }

                    // Remove from combined list
                    languageOptions.selected = combinedSelected.filter(p => p.toLowerCase() !== normalizedProf);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected', 'proficient');
                    const icon = profItem.querySelector('i.fas');
                    if (icon) icon.classList.remove('optional');
                    const unselectHint = profItem.querySelector('.unselect-hint');
                    if (unselectHint) unselectHint.remove();

                }
                // Handle selection
                else {
                    const raceSelectedCount = raceSelected.length;
                    const raceAllowedCount = languageOptions.race?.allowed || 0;
                    const classSelectedCount = classSelected.length;
                    const classAllowedCount = languageOptions.class?.allowed || 0;
                    const backgroundSelectedCount = backgroundSelected.length;
                    const backgroundAllowedCount = languageOptions.background?.allowed || 0;
                    const combinedSelectedCount = combinedSelected.length;
                    const combinedAllowedCount = languageOptions.allowed || 0;

                    // Calculate slot availability here
                    const raceSlotsAvailable = raceSelectedCount < raceAllowedCount;
                    const classSlotsAvailable = classSelectedCount < classAllowedCount;
                    const backgroundSlotsAvailable = backgroundSelectedCount < backgroundAllowedCount;

                    // Prioritize assignment based on where the option comes from and slot availability
                    // Priority: Specific List (Class > Bg > Race) > "Any" List (Class > Bg > Race)
                    let assignedToSource = false; // Declare with let here

                    // 1. Prioritize sources offering the specific skill (NOT via 'any')
                    if (!classAllowsAny && isClassOption && classSlotsAvailable) {
                        languageOptions.class.selected.push(proficiency);
                        assignedToSource = true; // Assign here
                    }
                    else if (!assignedToSource && !backgroundAllowsAny && isBackgroundOption && backgroundSlotsAvailable) {
                        languageOptions.background.selected.push(proficiency);
                        assignedToSource = true; // Assign here
                    }
                    else if (!assignedToSource && !raceAllowsAny && isRaceOption && raceSlotsAvailable) {
                        languageOptions.race.selected.push(proficiency);
                        assignedToSource = true; // Assign here
                    }

                    // 2. If not assigned to a specific list, assign to highest priority 'any' source
                    if (!assignedToSource) {
                        // Priority Order: Class -> Background -> Race
                        if (classAllowsAny && classSlotsAvailable) {
                            languageOptions.class.selected.push(proficiency);
                            assignedToSource = true; // Assign here
                        }
                        else if (backgroundAllowsAny && backgroundSlotsAvailable) {
                            languageOptions.background.selected.push(proficiency);
                            assignedToSource = true; // Assign here
                        }
                        else if (raceAllowsAny && raceSlotsAvailable) {
                            languageOptions.race.selected.push(proficiency);
                            assignedToSource = true; // Assign here
                        }
                    }

                    if (assignedToSource) {
                        if (!languageOptions.selected.some(p => p.toLowerCase() === normalizedProf)) {
                            languageOptions.selected.push(proficiency);
                        }

                        // Update UI
                        profItem.classList.add('selected', 'optional-selected', 'proficient');
                        const icon = profItem.querySelector('i.fas');
                        if (icon) icon.classList.add('optional');
                        if (!profItem.querySelector('.unselect-hint')) {
                            const hint = document.createElement('span');
                            hint.className = 'unselect-hint';
                            hint.innerHTML = '<i class="fas fa-times"></i>';
                            profItem.appendChild(hint);
                        }
                    } else {
                        console.warn('Could not assign language to any source despite canAdd being true.');
                    }
                }
            } else if (profType === 'tools') {
                // Normalize proficiency for checks
                const normalizedProf = proficiency.toLowerCase();

                const toolOptions = this._character.optionalProficiencies.tools; // Shortcut
                const raceOptions = toolOptions.race?.options?.map(o => o.toLowerCase()) || [];
                const classOptions = toolOptions.class?.options?.map(o => o.toLowerCase()) || [];
                const backgroundOptions = toolOptions.background?.options?.map(o => o.toLowerCase()) || [];

                // Note: Tools typically don't have 'any', but we include check for consistency/future-proofing
                const raceAllowsAny = raceOptions.includes('any');
                const classAllowsAny = classOptions.includes('any');
                const backgroundAllowsAny = backgroundOptions.includes('any');

                const isRaceOption = raceAllowsAny || raceOptions.includes(normalizedProf);
                const isClassOption = classAllowsAny || classOptions.includes(normalizedProf);
                const isBackgroundOption = backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

                // Get current selections
                const raceSelected = toolOptions.race?.selected || [];
                const classSelected = toolOptions.class?.selected || [];
                const backgroundSelected = toolOptions.background?.selected || [];
                const combinedSelected = toolOptions.selected || [];

                // Handle deselection
                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    let removedFromSource = false;

                    // Remove from source lists (case-insensitive)
                    if (raceSelected.some(p => p.toLowerCase() === normalizedProf)) {
                        toolOptions.race.selected = raceSelected.filter(p => p.toLowerCase() !== normalizedProf);
                        removedFromSource = true;
                    }
                    if (classSelected.some(p => p.toLowerCase() === normalizedProf)) {
                        toolOptions.class.selected = classSelected.filter(p => p.toLowerCase() !== normalizedProf);
                        removedFromSource = true;
                    }
                    if (backgroundSelected.some(p => p.toLowerCase() === normalizedProf)) {
                        toolOptions.background.selected = backgroundSelected.filter(p => p.toLowerCase() !== normalizedProf);
                        removedFromSource = true;
                    }

                    if (!removedFromSource) {
                        console.warn('Deselecting tool, but could not find it in any source\'s selected list.');
                    }

                    // Remove from combined list
                    toolOptions.selected = combinedSelected.filter(p => p.toLowerCase() !== normalizedProf);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected', 'proficient');
                    const icon = profItem.querySelector('i.fas');
                    if (icon) icon.classList.remove('optional');
                    const unselectHint = profItem.querySelector('.unselect-hint');
                    if (unselectHint) unselectHint.remove();

                }
                // Handle selection
                else {
                    const raceSelectedCount = raceSelected.length;
                    const raceAllowedCount = toolOptions.race?.allowed || 0;
                    const classSelectedCount = classSelected.length;
                    const classAllowedCount = toolOptions.class?.allowed || 0;
                    const backgroundSelectedCount = backgroundSelected.length;
                    const backgroundAllowedCount = toolOptions.background?.allowed || 0;
                    const combinedSelectedCount = combinedSelected.length;
                    const combinedAllowedCount = toolOptions.allowed || 0;

                    // Calculate slot availability here
                    const raceSlotsAvailable = raceSelectedCount < raceAllowedCount;
                    const classSlotsAvailable = classSelectedCount < classAllowedCount;
                    const backgroundSlotsAvailable = backgroundSelectedCount < backgroundAllowedCount;

                    // Prioritize assignment based on where the option comes from and slot availability
                    // Priority: Specific List (Class > Bg > Race) > "Any" List (Class > Bg > Race)
                    let assignedToSource = false; // Declare with let here

                    // 1. Prioritize sources offering the specific skill (NOT via 'any')
                    if (!classAllowsAny && isClassOption && classSlotsAvailable) {
                        toolOptions.class.selected.push(proficiency);
                        assignedToSource = true; // Assign here
                    }
                    else if (!assignedToSource && !backgroundAllowsAny && isBackgroundOption && backgroundSlotsAvailable) {
                        toolOptions.background.selected.push(proficiency);
                        assignedToSource = true; // Assign here
                    }
                    else if (!assignedToSource && !raceAllowsAny && isRaceOption && raceSlotsAvailable) {
                        toolOptions.race.selected.push(proficiency);
                        assignedToSource = true; // Assign here
                    }

                    // 2. If not assigned to a specific list, assign to highest priority 'any' source
                    if (!assignedToSource) {
                        // Priority Order: Class -> Background -> Race
                        if (classAllowsAny && classSlotsAvailable) {
                            toolOptions.class.selected.push(proficiency);
                            assignedToSource = true; // Assign here
                        }
                        else if (backgroundAllowsAny && backgroundSlotsAvailable) {
                            toolOptions.background.selected.push(proficiency);
                            assignedToSource = true; // Assign here
                        }
                        else if (raceAllowsAny && raceSlotsAvailable) {
                            toolOptions.race.selected.push(proficiency);
                            assignedToSource = true; // Assign here
                        }
                    }

                    if (assignedToSource) {
                        if (!toolOptions.selected.some(p => p.toLowerCase() === normalizedProf)) {
                            toolOptions.selected.push(proficiency);
                        }

                        // Update UI
                        profItem.classList.add('selected', 'optional-selected', 'proficient');
                        const icon = profItem.querySelector('i.fas');
                        if (icon) icon.classList.add('optional');
                        if (!profItem.querySelector('.unselect-hint')) {
                            const hint = document.createElement('span');
                            hint.className = 'unselect-hint';
                            hint.innerHTML = '<i class="fas fa-times"></i>';
                            profItem.appendChild(hint);
                        }
                    } else {
                        console.warn('Could not assign tool to any source despite canAdd being true.');
                    }
                }
            } else {
                // Original Logic for Armor/Weapons (No source-specific selection)
                const selectedProfs = this._character.optionalProficiencies[profType]?.selected || [];
                const allowedCount = this._character.optionalProficiencies[profType]?.allowed || 0;

                if (profItem.classList.contains('selected') || profItem.classList.contains('optional-selected')) {
                    // Remove proficiency from selection
                    this._character.optionalProficiencies[profType].selected = selectedProfs.filter(p => p !== proficiency);

                    // Update UI
                    profItem.classList.remove('selected', 'optional-selected', 'proficient');
                    const icon = profItem.querySelector('i.fas');
                    if (icon) icon.classList.remove('optional');
                    const unselectHint = profItem.querySelector('.unselect-hint');
                    if (unselectHint) unselectHint.remove();

                } else {
                    // Check if we can add more proficiencies
                    if (selectedProfs.length < allowedCount) {
                        // Add proficiency to selection
                        this._character.optionalProficiencies[profType].selected.push(proficiency);

                        // Update UI
                        profItem.classList.add('selected', 'optional-selected', 'proficient');
                        const icon = profItem.querySelector('i.fas');
                        if (icon) icon.classList.add('optional');
                        if (!profItem.querySelector('.unselect-hint')) {
                            const hint = document.createElement('span');
                            hint.className = 'unselect-hint';
                            hint.innerHTML = '<i class="fas fa-times"></i>';
                            profItem.appendChild(hint);
                        }
                    }
                }
            }

            // Update proficiency count displays for all types
            this._updateSelectionCounters();

            // Refresh the specific container to reflect detailed UI state changes (like disabled status)
            this._populateProficiencyContainers(); // Re-run population to ensure correct disabled/selectable states

            // Trigger character change event to ensure data consistency and saving
            document.dispatchEvent(new CustomEvent('characterChanged'));

        } catch (error) {
            console.error('Error toggling proficiency:', error);
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
        let notesHTML = '<h6 class="mb-2">Sources:</h6>';

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

        const isGranted = fixedSources.length > 0;
        return isGranted;
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

    /**
     * Calculate the total number of optional proficiencies allowed from all sources
     * @param {string} type - The proficiency type
     * @returns {number} Total number of optional proficiencies allowed
     * @private
     */
    _getTotalOptionalAllowedFromSources(type) {
        if (!this._character || !this._character.optionalProficiencies || !this._character.optionalProficiencies[type]) {
            return 0;
        }

        const raceAllowed = this._character.optionalProficiencies[type]?.race?.allowed || 0;
        const classAllowed = this._character.optionalProficiencies[type]?.class?.allowed || 0;
        const backgroundAllowed = this._character.optionalProficiencies[type]?.background?.allowed || 0;

        return raceAllowed + classAllowed + backgroundAllowed;
    }
}