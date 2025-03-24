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

            // For skills, ensure we have an options array
            if (type === 'skills' && !this.character.optionalProficiencies.skills.options) {
                this.character.optionalProficiencies.skills.options = [];
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
                    this.toggleOptionalProficiency(typeAttr, proficiency, item);
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
     * Handle proficiency change events
     * @private
     */
    handleProficiencyChanged(event) {
        if (!this.character) return;

        // If this is a proficiency removal event, clean up optional proficiencies
        if (event.type === 'proficienciesRemoved') {
            const source = event.detail?.source;
            if (source) {
                this.clearOptionalProficienciesBySource(source);
            }
        }

        // First check if any optionally selected proficiencies should be removed
        this.cleanupOptionalProficiencies();

        // Then update the UI
        this.populateProficiencyContainers();
        this.updateProficiencyNotes();
    }

    /**
     * Clear optional proficiency selections associated with a specific source
     * @param {string} source - The source to clear (e.g., 'Background', 'Race', 'Class')
     * @private
     */
    clearOptionalProficienciesBySource(source) {
        if (!this.character || !this.character.optionalProficiencies) return;

        console.log(`[ProficiencyCard] Clearing optional proficiencies for source: ${source}`);

        // Check if we need to reset allowed count and selected proficiencies
        // For background and race changes, clear their optional proficiencies
        if (source === 'Background') {
            // Clear background optional proficiencies (languages, tools, skills)
            for (const type of ['languages', 'tools', 'skills']) {
                if (this.character.optionalProficiencies[type]) {
                    console.log(`[ProficiencyCard] Clearing ${type} optional proficiencies for ${source}`);
                    // Reset allowed count to 0 and clear selections
                    this.character.optionalProficiencies[type].allowed = 0;
                    this.character.optionalProficiencies[type].selected = [];
                }
            }
        } else if (source === 'Race' || source === 'Subrace') {
            // Clear race optional proficiencies (typically languages, sometimes skills)
            for (const type of ['languages', 'skills']) {
                if (this.character.optionalProficiencies[type]) {
                    console.log(`[ProficiencyCard] Clearing ${type} optional proficiencies for ${source}`);
                    // Only reset Race (not Subrace) optional proficiencies
                    // This is so we don't clear language choices when the race has its own
                    if (source === 'Race') {
                        // We're only clearing the selections, not setting allowed to 0
                        // because the new race might set a new allowed count right afterward
                        this.character.optionalProficiencies[type].selected = [];
                    }
                }
            }
        } else if (source === 'Class') {
            // Clear class optional proficiencies (typically skills, sometimes tools)
            for (const type of ['skills', 'tools']) {
                if (this.character.optionalProficiencies[type]) {
                    console.log(`[ProficiencyCard] Clearing ${type} optional proficiencies for ${source}`);
                    // Reset allowed count to 0 and clear selections
                    this.character.optionalProficiencies[type].allowed = 0;
                    this.character.optionalProficiencies[type].selected = [];
                }
            }
        }

        // Mark unsaved changes if we modified anything
        this.markUnsavedChanges();
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

            // Build the container HTML
            let containerHtml = '';
            for (const item of availableOptions || []) {
                const isProficient = this.character.proficiencies[type].includes(item);
                const isOptionallySelected = Array.isArray(this.character?.optionalProficiencies?.[type]?.selected) &&
                    this.character.optionalProficiencies[type].selected.includes(item);
                const isDefault = this.defaultProficiencies[type]?.includes(item);

                // Check if this proficiency is granted by race/class/background
                const isGranted = this.isGrantedBySource(type, item);

                // Check if there are optional proficiencies allowed for this type
                const optionalCount = this.character?.optionalProficiencies?.[type]?.allowed || 0;
                const selectedCount = this.character?.optionalProficiencies?.[type]?.selected?.length || 0;
                const allSlotsFilled = optionalCount > 0 && selectedCount >= optionalCount;

                let canSelect = optionalCount > 0 &&
                    !isDefault &&
                    !isGranted &&
                    !isOptionallySelected &&
                    !allSlotsFilled;

                // For skills, also check if it's in the options list
                if (canSelect && type === 'skills' &&
                    Array.isArray(this.character.optionalProficiencies?.skills?.options) &&
                    this.character.optionalProficiencies.skills.options.length > 0) {
                    canSelect = this.character.optionalProficiencies.skills.options.includes(item);
                }

                // Special handling for language categories
                let languageClass = '';
                if (type === 'languages') {
                    const isStandard = ['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc'].includes(item);
                    languageClass = isStandard ? 'normal-language' : 'exotic-language';
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
                    cssClasses.push('proficient', 'optional-selected');
                }

                if (canSelect) {
                    cssClasses.push('selectable');
                }

                if (!canSelect && !isProficient && !isDefault && !isGranted && !isOptionallySelected) {
                    cssClasses.push('disabled');
                }

                if (languageClass) {
                    cssClasses.push(languageClass);
                }

                // Debug for weapons, armor and saving throws
                if ((type === 'weapons' || type === 'armor' || type === 'savingThrows')) {
                    console.log(`${type} - ${item}: isDefault=${isDefault}, isGranted=${isGranted}, cssClasses="${cssClasses.join(' ')}"`);
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
            case 'languages':
                return this.proficiencyManager.getAvailableLanguages();
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

        // For skills, check if the proficiency is in the options list
        if (type === 'skills' &&
            Array.isArray(this.character.optionalProficiencies?.skills?.options) &&
            this.character.optionalProficiencies.skills.options.length > 0) {
            return this.character.optionalProficiencies.skills.options.includes(proficiency);
        }

        // For other types, allow any proficiency to be selected
        return true;
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
     * Toggle an optional proficiency
     * @param {string} type - Proficiency type
     * @param {string} proficiency - Proficiency name
     * @param {HTMLElement} item - The DOM element
     * @private
     */
    toggleOptionalProficiency(type, proficiency, item) {
        if (!this.character?.optionalProficiencies?.[type]) return;

        const isSelected = item.classList.contains('optional-selected');
        const allowed = this.character.optionalProficiencies[type].allowed;
        const selected = this.character.optionalProficiencies[type].selected;

        // Store the count before making changes
        const wasFullBeforeDeselection = selected.length === allowed;

        if (isSelected) {
            this.character.optionalProficiencies[type].selected =
                selected.filter(p => p !== proficiency);
            item.classList.remove('optional-selected', 'proficient');
        } else if (selected.length < allowed) {
            this.character.optionalProficiencies[type].selected.push(proficiency);
            item.classList.add('optional-selected', 'proficient');
        }

        this.updateSelectionCounters();

        // Check if this toggle filled or freed up a slot
        // refresh the display if needed to update selectable items
        const selectedCount = this.character.optionalProficiencies[type].selected.length;
        if (selectedCount === allowed || // slots are full now
            (!isSelected && selectedCount === allowed - 1) || // selecting second-to-last slot
            (isSelected && wasFullBeforeDeselection)) { // deselecting when previously full
            this.populateProficiencyContainers();
        }

        this.markUnsavedChanges();
        this.updateProficiencyNotes();
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
     * Check if a proficiency is granted by a character source (race, class, background)
     * @param {string} type - Proficiency type
     * @param {string} proficiency - Proficiency name
     * @returns {boolean} Whether the proficiency is granted by a source
     */
    isGrantedBySource(type, proficiency) {
        const sources = this.character?.proficiencySources?.[type]?.get(proficiency);
        const isGranted = sources && sources.size > 0 && !sources.has('Default');

        // Debug for weapon and armor proficiencies
        if (type === 'weapons' || type === 'armor') {
            const allSources = sources ? Array.from(sources) : [];
            console.log(`[ProficiencyCard] Checking ${type} - ${proficiency}: isGranted=${isGranted}, sources=${allSources.join(', ')}`);
        }

        return isGranted;
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
                    console.log(`[ProficiencyCard] Removed ${prof} from optional ${type} since it's now granted by another source`);
                    changesDetected = true;
                }
            }
        }

        // Mark unsaved changes if we modified anything
        if (changesDetected) {
            this.markUnsavedChanges();
        }
    }
} 