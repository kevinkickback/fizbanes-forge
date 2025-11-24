/**
 * ProficiencyCard.js
 * Controller that manages the display and interaction of character proficiencies.
 * Coordinates between display, selection, and notes views.
 */

import { CharacterManager } from '../../core/CharacterManager.js';
import { AppState } from '../../core/AppState.js';
import { proficiencyService } from '../../services/ProficiencyService.js';
import { eventBus, EVENTS } from '../../infrastructure/EventBus.js';
import { ProficiencyCore } from '../../core/Proficiency.js';
import { ProficiencyDisplayView } from './ProficiencyDisplay.js';
import { ProficiencySelectionView } from './ProficiencySelection.js';
import { ProficiencyNotesView } from './ProficiencyNotes.js';

/**
 * Manages the proficiency card UI component and related functionality
 */
export class ProficiencyCard {
    /**
     * Creates a new ProficiencyCard instance
     */
    constructor() {
        this._character = null;
        this._proficiencyManager = proficiencyService;
        this._proficiencyTypes = ['skills', 'savingThrows', 'languages', 'tools', 'armor', 'weapons'];

        this._defaultProficiencies = {
            languages: ['Common'],
            weapons: [],
            armor: [],
            tools: [],
            skills: [],
            savingThrows: []
        };

        this._proficiencyContainers = {};
        this._proficiencyNotesContainer = null;

        // Initialize views
        this._displayView = new ProficiencyDisplayView();
        this._selectionView = new ProficiencySelectionView();
        this._notesView = new ProficiencyNotesView();
    }

    /**
     * Initialize the proficiency card UI and data
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            this._character = CharacterManager.getCurrentCharacter();
            if (!this._character) {
                console.error('No active character found');
                return;
            }

            this._initializeDomReferences();
            this._setupEventListeners();
            this._initializeCharacterProficiencies();
            await this._populateProficiencyContainers();
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
                if (type === 'skills' || type === 'languages' || type === 'tools') {
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
     * Initialize nested proficiency structures for skills, languages, and tools
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

            // Listen for proficiency changes via EventBus
            eventBus.on('proficiency:added', this._handleProficiencyAdded.bind(this));
            eventBus.on('proficiency:removedBySource', this._handleProficiencyRemoved.bind(this));
            eventBus.on('proficiency:refunded', this._handleProficiencyRefunded.bind(this));
            eventBus.on('proficiency:optionalSelected', this._handleProficiencyChanged.bind(this));
            eventBus.on('proficiency:optionalDeselected', this._handleProficiencyChanged.bind(this));

            // Legacy DOM event support (for backward compatibility)
            document.addEventListener('proficiencyChanged', this._handleProficiencyChanged.bind(this));

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

                // Only toggle if it's selectable or optionally selected
                const isSelectable = item.classList.contains('selectable');
                const isOptionalSelected = item.classList.contains('optional-selected');
                const isDefault = item.classList.contains('default');

                if ((isSelectable || isOptionalSelected) && !isDefault) {
                    const changed = this._selectionView.toggleOptionalProficiency(item, this._character);

                    if (changed) {
                        // Update proficiency count displays for all types
                        this._displayView.updateSelectionCounters(this._proficiencyContainers, this._character);

                        // Refresh the specific container to reflect detailed UI state changes
                        this._populateProficiencyContainers();

                        // Trigger character change event to ensure data consistency and saving
                        document.dispatchEvent(new CustomEvent('characterChanged'));
                    }
                }
            });
        }
    }

    /**
     * Handle proficiency added event from EventBus
     * @param {Object} data - Event data with type, proficiency, source, character
     * @private
     */
    _handleProficiencyAdded(data) {
        this._handleProficiencyChanged({ detail: data });
    }

    /**
     * Handle proficiency removed by source event from EventBus
     * @param {Object} data - Event data with source, removed, character
     * @private
     */
    _handleProficiencyRemoved(data) {
        this._handleProficiencyChanged({ detail: { forcedRefresh: true } });
    }

    /**
     * Handle proficiency refunded event from EventBus
     * @param {Object} data - Event data with type, proficiency, character
     * @private
     */
    _handleProficiencyRefunded(data) {
        this._handleProficiencyChanged({
            detail: {
                triggerCleanup: true,
                showRefund: true,
                proficiency: data.proficiency
            }
        });
    }

    /**
     * Handle character change events
     * @param {CustomEvent} event - The character changed event
     * @private
     */
    _handleCharacterChanged(event) {
        try {
            this._character = CharacterManager.getCurrentCharacter();

            if (this._character) {
                ProficiencyCore.initializeProficiencyStructures(this._character);
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
            const detail = event.detail || {};

            if (detail.triggerCleanup) {
                this._cleanupOptionalProficiencies();
            }

            if (detail.forcedRefresh) {
                this._populateProficiencyContainers();
            } else {
                this._displayView.updateSelectionCounters(this._proficiencyContainers, this._character);
            }

            this._updateProficiencyNotes();
            this._markUnsavedChanges();

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
     * @private
     */
    async _populateProficiencyContainers() {
        if (!this._character) return;

        // Get available options for all types
        const availableOptionsMap = {};
        for (const type of this._proficiencyTypes) {
            availableOptionsMap[type] = await this._getAvailableOptions(type);
        }

        // Render containers using display view
        this._displayView.renderContainers(
            this._proficiencyContainers,
            this._character,
            availableOptionsMap,
            this._defaultProficiencies,
            this._isGrantedBySource.bind(this),
            this._isProficiencyAvailable.bind(this),
            this._displayView.getIconForType.bind(this._displayView),
            this._proficiencyManager
        );
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
                return ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'];
            case 'weapons':
                return ['Simple Weapons', 'Martial Weapons'];
            default:
                return [];
        }
    }

    /**
     * Check if a proficiency can be selected by the user
     * @param {string} type - Proficiency type
     * @param {string} proficiency - Proficiency name
     * @returns {boolean} Whether the proficiency can be selected
     * @private
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

            const raceAllowsAny = raceOptions.map(o => String(o).toLowerCase()).includes('any');
            const classAllowsAny = classOptions.map(o => String(o).toLowerCase()).includes('any');
            const backgroundAllowsAny = backgroundOptions.map(o => String(o).toLowerCase()).includes('any');

            const isRaceOption = raceAllowsAny || raceOptions.map(o => String(o).toLowerCase()).includes(normalizedProf);
            const isClassOption = classAllowsAny || classOptions.map(o => String(o).toLowerCase()).includes(normalizedProf);
            const isBackgroundOption = backgroundAllowsAny || backgroundOptions.map(o => String(o).toLowerCase()).includes(normalizedProf);

            if (isRaceOption && raceSelected.length < raceAllowed) return true;
            if (isClassOption && classSelected.length < classAllowed) return true;
            if (isBackgroundOption && backgroundSelected.length < backgroundAllowed) return true;

            return false;
        }

        // For skills
        if (type === 'skills') {
            const raceOptions = this._character.optionalProficiencies[type].race?.options?.map(o => o.toLowerCase()) || [];
            const classOptions = this._character.optionalProficiencies[type].class?.options?.map(o => o.toLowerCase()) || [];
            const backgroundOptions = this._character.optionalProficiencies[type].background?.options?.map(o => o.toLowerCase()) || [];
            const raceSelected = this._character.optionalProficiencies[type].race?.selected || [];
            const classSelected = this._character.optionalProficiencies[type].class?.selected || [];
            const backgroundSelected = this._character.optionalProficiencies[type].background?.selected || [];

            const raceAllowed = this._character.optionalProficiencies[type].race?.allowed || 0;
            const classAllowed = this._character.optionalProficiencies[type].class?.allowed || 0;
            const backgroundAllowed = this._character.optionalProficiencies[type].background?.allowed || 0;

            const raceAllowsAny = raceOptions.includes('any');
            const classAllowsAny = classOptions.includes('any');
            const backgroundAllowsAny = backgroundOptions.includes('any');

            const isRaceOption = raceAllowsAny || raceOptions.includes(normalizedProf);
            const isClassOption = classAllowsAny || classOptions.includes(normalizedProf);
            const isBackgroundOption = backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

            const raceSlotsAvailable = raceSelected.length < raceAllowed;
            const classSlotsAvailable = classSelected.length < classAllowed;
            const backgroundSlotsAvailable = backgroundSelected.length < backgroundAllowed;

            if (isRaceOption && raceSlotsAvailable) return true;
            if (isClassOption && classSlotsAvailable) return true;
            if (isBackgroundOption && backgroundSlotsAvailable) return true;

            return false;
        }

        // For tools
        if (type === 'tools') {
            const raceOptions = this._character.optionalProficiencies[type].race?.options?.map(o => o.toLowerCase()) || [];
            const classOptions = this._character.optionalProficiencies[type].class?.options?.map(o => o.toLowerCase()) || [];
            const backgroundOptions = this._character.optionalProficiencies[type].background?.options?.map(o => o.toLowerCase()) || [];
            const raceSelected = this._character.optionalProficiencies[type].race?.selected || [];
            const classSelected = this._character.optionalProficiencies[type].class?.selected || [];
            const backgroundSelected = this._character.optionalProficiencies[type].background?.selected || [];

            const raceAllowed = this._character.optionalProficiencies[type].race?.allowed || 0;
            const classAllowed = this._character.optionalProficiencies[type].class?.allowed || 0;
            const backgroundAllowed = this._character.optionalProficiencies[type].background?.allowed || 0;

            const raceAllowsAny = raceOptions.includes('any');
            const classAllowsAny = classOptions.includes('any');
            const backgroundAllowsAny = backgroundOptions.includes('any');

            const isRaceOption = raceAllowsAny || raceOptions.includes(normalizedProf);
            const isClassOption = classAllowsAny || classOptions.includes(normalizedProf);
            const isBackgroundOption = backgroundAllowsAny || backgroundOptions.includes(normalizedProf);

            const raceSlotsAvailable = raceSelected.length < raceAllowed;
            const classSlotsAvailable = classSelected.length < classAllowed;
            const backgroundSlotsAvailable = backgroundSelected.length < backgroundAllowed;

            if (isRaceOption && raceSlotsAvailable) return true;
            if (isClassOption && classSlotsAvailable) return true;
            if (isBackgroundOption && backgroundSlotsAvailable) return true;

            return false;
        }

        // For other types (Armor, Weapons)
        const otherTypeAllowed = this._character.optionalProficiencies?.[type]?.allowed > 0;
        if (otherTypeAllowed) {
            const raceOptions = this._character.optionalProficiencies?.[type]?.race?.options || [];
            const classOptions = this._character.optionalProficiencies?.[type]?.class?.options || [];
            const backgroundOptions = this._character.optionalProficiencies?.[type]?.background?.options || [];
            const hasAnySourceOptions = raceOptions.length > 0 || classOptions.length > 0 || backgroundOptions.length > 0;

            if (hasAnySourceOptions) {
                const normalizedItem = String(proficiency).toLowerCase();
                return raceOptions.map(o => String(o).toLowerCase()).includes(normalizedItem) ||
                    classOptions.map(o => String(o).toLowerCase()).includes(normalizedItem) ||
                    backgroundOptions.map(o => String(o).toLowerCase()).includes(normalizedItem);
            }
            return true;
        }
        return false;
    }

    /**
     * Update the proficiency notes display
     * @private
     */
    _updateProficiencyNotes() {
        this._notesView.updateProficiencyNotes(
            this._proficiencyNotesContainer,
            this._character,
            this._displayView.getTypeLabel.bind(this._displayView)
        );
    }

    /**
     * Mark that there are unsaved changes
     * @private
     */
    _markUnsavedChanges() {
        AppState.setHasUnsavedChanges(true);
    }

    /**
     * Check if a proficiency is granted by a fixed source (not a choice)
     * @param {string} type - Proficiency type
     * @param {string|Object} proficiency - The proficiency to check
     * @returns {boolean} True if granted by a fixed source
     * @private
     */
    _isGrantedBySource(type, proficiency) {
        if (!this._character?.proficiencySources?.[type]) {
            return false;
        }

        // Safety check - ensure proficiency is a string
        let profString = proficiency;
        if (typeof proficiency !== 'string') {
            if (proficiency && typeof proficiency === 'object' && proficiency.name) {
                profString = proficiency.name;
            } else if (proficiency && typeof proficiency.toString === 'function') {
                profString = proficiency.toString();
            } else {
                return false;
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

        return fixedSources.length > 0;
    }

    /**
     * Remove proficiencies from the optional selected list when they become granted by a fixed source
     * @private
     */
    _cleanupOptionalProficiencies() {
        if (!this._character || !this._character.optionalProficiencies) return;

        let changesDetected = false;

        for (const type of this._proficiencyTypes) {
            if (!this._character.optionalProficiencies[type]?.selected) continue;

            // Special handling for skills to manage race, class, and background sources separately
            if (type === 'skills' || type === 'languages' || type === 'tools') {
                changesDetected = this._cleanupSourceSpecificProficiencies(type) || changesDetected;
            }
            // Regular cleanup for non-source-tracked proficiencies
            else {
                changesDetected = this._cleanupSimpleProficiencies(type) || changesDetected;
            }
        }

        if (changesDetected) {
            this._populateProficiencyContainers();
            this._markUnsavedChanges();
        }

        return changesDetected;
    }

    /**
     * Cleanup proficiencies with source-specific tracking
     * @private
     */
    _cleanupSourceSpecificProficiencies(type) {
        let changesDetected = false;
        const fixedProficiencies = this._character.proficiencies[type] || [];
        const sources = ['race', 'class', 'background'];

        for (const source of sources) {
            if (!this._character.optionalProficiencies[type][source]?.selected) continue;

            const selected = [...this._character.optionalProficiencies[type][source].selected];
            for (const prof of selected) {
                if (fixedProficiencies.includes(prof)) {
                    const profSources = this._character.proficiencySources?.[type]?.get(prof);
                    if (profSources && Array.from(profSources).some(s =>
                        s !== 'Race Choice' &&
                        s !== 'Class Choice' &&
                        s !== 'Background Choice')) {

                        this._character.optionalProficiencies[type][source].selected =
                            this._character.optionalProficiencies[type][source].selected.filter(s => s !== prof);
                        changesDetected = true;
                    }
                }
            }

            // Ensure source doesn't have more selections than allowed
            const allowed = this._character.optionalProficiencies[type][source].allowed || 0;
            if (this._character.optionalProficiencies[type][source].selected.length > allowed) {
                this._character.optionalProficiencies[type][source].selected =
                    this._character.optionalProficiencies[type][source].selected.slice(0, allowed);
                changesDetected = true;
            }
        }

        // Update combined selected list
        if (changesDetected) {
            const raceSelected = this._character.optionalProficiencies[type].race.selected || [];
            const classSelected = this._character.optionalProficiencies[type].class.selected || [];
            const backgroundSelected = this._character.optionalProficiencies[type].background.selected || [];
            this._character.optionalProficiencies[type].selected = [...raceSelected, ...classSelected, ...backgroundSelected];
        }

        return changesDetected;
    }

    /**
     * Cleanup simple proficiencies without source tracking
     * @private
     */
    _cleanupSimpleProficiencies(type) {
        let changesDetected = false;
        const selectedOptional = [...this._character.optionalProficiencies[type].selected];

        for (const prof of selectedOptional) {
            if (!this._character.proficiencies[type].includes(prof)) continue;

            if (this._isGrantedBySource(type, prof)) {
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
