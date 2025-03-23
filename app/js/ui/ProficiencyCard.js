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

        // Initialize each proficiency type as an array
        for (const type of this.proficiencyTypes) {
            if (!Array.isArray(this.character.proficiencies[type])) {
                this.character.proficiencies[type] = [];
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

        // Initialize optional proficiencies structure
        if (!this.character.optionalProficiencies) {
            this.character.optionalProficiencies = {};
        }

        // Initialize each optional proficiency type
        for (const type of this.proficiencyTypes) {
            if (!this.character.optionalProficiencies[type]) {
                this.character.optionalProficiencies[type] = { allowed: 0, selected: [] };
            }
            if (!Array.isArray(this.character.optionalProficiencies[type].selected)) {
                this.character.optionalProficiencies[type].selected = [];
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
                const isOptional = item.classList.contains('selectable');
                const isSelected = item.classList.contains('proficient');

                if (isOptional) {
                    this.toggleOptionalProficiency(typeAttr, proficiency, item);
                } else if (!isSelected) {
                    this.character?.addProficiency(typeAttr, proficiency, 'Character');
                    item.classList.add('proficient');
                    this.markUnsavedChanges();
                    this.updateProficiencyNotes();
                }
            });
        }

        // Listen for character changes
        document.addEventListener('characterChanged', this.handleCharacterChanged.bind(this));
    }

    /**
     * Handle character change events
     * @private
     */
    handleCharacterChanged() {
        this.character = characterHandler.currentCharacter;

        if (this.character) {
            this.initializeCharacterProficiencies();
            this.populateProficiencyContainers();
            this.updateProficiencyNotes();
        }
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

            // Special handling for languages which may be categorized
            const items = availableOptions || [];

            // Build the container HTML
            let containerHtml = '';
            for (const item of items) {
                const isProficient = this.character.proficiencies[type].includes(item);
                const isOptionallySelected = Array.isArray(this.character?.optionalProficiencies?.[type]?.selected) &&
                    this.character.optionalProficiencies[type].selected.includes(item);
                const isDefault = this.defaultProficiencies[type]?.includes(item);
                const isAvailable = this.isProficiencyAvailable(type, item);
                const optionalCount = this.character?.optionalProficiencies?.[type]?.allowed || 0;
                const selectedCount = this.character?.optionalProficiencies?.[type]?.selected?.length || 0;
                const canSelect = type !== 'savingThrows' && !isDefault && isAvailable &&
                    optionalCount > selectedCount && !isProficient && !isOptionallySelected;

                // Special handling for language categories
                let languageClass = '';
                if (type === 'languages') {
                    const isStandard = ['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc'].includes(item);
                    languageClass = isStandard ? 'normal-language' : 'exotic-language';
                }

                containerHtml += `
                    <div class="proficiency-item ${isProficient || isDefault ? 'proficient' : ''} 
                        ${isOptionallySelected ? 'proficient optional-selected' : ''} 
                        ${canSelect ? 'selectable' : ''} 
                        ${!isAvailable && !isDefault ? 'disabled' : ''}
                        ${languageClass}"
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
                return ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'];
            case 'weapons':
                return ['Simple Weapons', 'Martial Weapons', 'Crossbows', 'Longswords',
                    'Rapiers', 'Shortswords', 'Hand Crossbows'];
            default:
                return [];
        }
    }

    /**
     * Check if a proficiency is available for selection based on character's class/race/background
     * @param {string} type - Proficiency type
     * @param {string} proficiency - Proficiency name
     * @returns {boolean} Whether the proficiency is available
     */
    isProficiencyAvailable(type, proficiency) {
        if (!this.character) return false;

        // Default proficiencies are always selected but not selectable
        if (this.defaultProficiencies[type]?.includes(proficiency)) {
            return false;
        }

        // Check if proficiency is granted by class/race/background
        const isGranted = !!this.character?.proficiencySources?.[type]?.get(proficiency)?.size;
        const isOptionallyAvailable = this.character?.optionalProficiencies?.[type]?.allowed > 0;

        return isGranted || isOptionallyAvailable;
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
            case 'savingThrows':
                return 'fa-check-circle';
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

        if (isSelected) {
            this.character.optionalProficiencies[type].selected =
                selected.filter(p => p !== proficiency);
            item.classList.remove('optional-selected', 'proficient');
        } else if (selected.length < allowed) {
            this.character.optionalProficiencies[type].selected.push(proficiency);
            item.classList.add('optional-selected', 'proficient');
        }

        this.updateSelectionCounters();
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

        // Group proficiencies by source
        const sourceGroups = {};

        // Process each proficiency type
        for (const type of this.proficiencyTypes) {
            if (!this.character.proficiencySources[type]) continue;

            // Iterate through each proficiency and its sources
            for (const [proficiency, sources] of this.character.proficiencySources[type].entries()) {
                // For each source of this proficiency
                for (const source of sources) {
                    if (!sourceGroups[source]) {
                        sourceGroups[source] = {};
                    }

                    if (!sourceGroups[source][type]) {
                        sourceGroups[source][type] = [];
                    }

                    sourceGroups[source][type].push(proficiency);
                }
            }
        }

        // Add optionally selected proficiencies
        for (const type of this.proficiencyTypes) {
            if (!this.character.optionalProficiencies?.[type]?.selected) continue;

            const selected = this.character.optionalProficiencies[type].selected;
            if (selected.length > 0) {
                if (!sourceGroups.Selected) {
                    sourceGroups.Selected = {};
                }

                if (!sourceGroups.Selected[type]) {
                    sourceGroups.Selected[type] = [];
                }

                for (const prof of selected) {
                    sourceGroups.Selected[type].push(prof);
                }
            }
        }

        // If no proficiencies, show a message
        if (Object.keys(sourceGroups).length === 0) {
            this.proficiencyNotesContainer.innerHTML = '<p>No proficiencies applied.</p>';
            return;
        }

        // Build the notes HTML
        let notesHTML = '<p><strong>Proficiency Sources:</strong></p>';

        for (const source in sourceGroups) {
            notesHTML += `<div class="proficiency-note"><strong>${source}:</strong> `;

            const profStrings = [];
            for (const type in sourceGroups[source]) {
                const typeLabel = this.getTypeLabel(type);
                const profs = sourceGroups[source][type].sort();
                profStrings.push(`${typeLabel}: ${profs.join(', ')}`);
            }

            notesHTML += profStrings.join('; ');
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
} 