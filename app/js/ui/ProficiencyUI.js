export class ProficiencyUI {
    constructor(character) {
        this.character = character;
        this.proficiencyTypes = ['skills', 'savingThrows', 'languages', 'tools', 'armor', 'weapons'];
        this.proficiencyManager = window.proficiencyService;

        // Define default proficiencies that all characters have
        this.defaultProficiencies = {
            languages: ['Common'],
            weapons: ['Simple Weapons'],
            armor: [],
            tools: [],
            skills: [],
            savingThrows: []
        };

        // Define all available options
        this.availableOptions = {
            skills: [
                'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
                'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
                'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
                'Sleight of Hand', 'Stealth', 'Survival'
            ],
            savingThrows: [
                'Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'
            ],
            weapons: [
                'Simple Weapons', 'Martial Weapons', 'Crossbows', 'Longswords',
                'Rapiers', 'Shortswords', 'Hand Crossbows'
            ],
            armor: [
                'Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'
            ],
            tools: [
                'Alchemist\'s supplies', 'Brewer\'s supplies', 'Calligrapher\'s supplies',
                'Carpenter\'s tools', 'Cartographer\'s tools', 'Cobbler\'s tools',
                'Cook\'s utensils', 'Glassblower\'s tools', 'Jeweler\'s tools',
                'Leatherworker\'s tools', 'Mason\'s tools', 'Painter\'s supplies',
                'Potter\'s tools', 'Smith\'s tools', 'Tinker\'s tools',
                'Weaver\'s tools', 'Woodcarver\'s tools', 'Disguise kit',
                'Forgery kit', 'Herbalism kit', 'Navigator\'s tools',
                'Poisoner\'s kit', 'Thieves\' tools', 'Dice set',
                'Dragonchess set', 'Playing card set', 'Musical instrument'
            ],
            languages: {
                normal: [
                    'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin',
                    'Halfling', 'Orc'
                ],
                exotic: [
                    'Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal',
                    'Primordial', 'Sylvan', 'Undercommon'
                ]
            }
        };

        // Initialize character proficiency structures
        if (!this.character.proficiencies) {
            this.character.proficiencies = {};
        }

        // Initialize each proficiency type as an array
        this.proficiencyTypes.forEach(type => {
            if (!Array.isArray(this.character.proficiencies[type])) {
                this.character.proficiencies[type] = [];
            }
        });

        // Add default proficiencies
        for (const [type, defaults] of Object.entries(this.defaultProficiencies)) {
            for (const prof of defaults) {
                if (!this.character.proficiencies[type].includes(prof)) {
                    this.character.proficiencies[type].push(prof);
                }
            }
        }

        // Initialize optional proficiencies
        if (!this.character.optionalProficiencies) {
            this.character.optionalProficiencies = {};
        }

        // Initialize each optional proficiency type
        this.proficiencyTypes.forEach(type => {
            if (!this.character.optionalProficiencies[type]) {
                this.character.optionalProficiencies[type] = { allowed: 0, selected: [] };
            }
            if (!Array.isArray(this.character.optionalProficiencies[type].selected)) {
                this.character.optionalProficiencies[type].selected = [];
            }
        });
    }

    /**
     * Initialize all proficiency-related UI elements
     */
    async initialize() {
        await this.populateProficiencyContainers();
        this.setupProficiencyContainers();
        this.updateProficiencyNotes();
    }

    /**
     * Check if a proficiency is available for selection based on character's class/race/background
     */
    isProficiencyAvailable(type, proficiency) {
        // Default proficiencies are always selected but not selectable
        if (this.defaultProficiencies[type]?.includes(proficiency)) {
            return false;
        }

        // Check if proficiency is granted by class/race/background
        const isGranted = this.character?.proficiencySources?.[type]?.[proficiency];
        const isOptionallyAvailable = this.character?.optionalProficiencies?.[type]?.allowed > 0;

        return isGranted || isOptionallyAvailable;
    }

    /**
     * Populate the proficiency containers with available options
     */
    async populateProficiencyContainers() {
        for (const type of this.proficiencyTypes) {
            const container = document.getElementById(`${type}Container`);
            if (!container) continue;

            // Special handling for languages which are categorized
            let items = type === 'languages' ?
                [...this.availableOptions[type].normal, ...this.availableOptions[type].exotic] :
                this.availableOptions[type] || [];
            let icon = this.getIconForType(type);

            // Handle selection counter
            const header = container.previousElementSibling;
            if (header && type !== 'savingThrows') {
                const optionalCount = this.character?.optionalProficiencies?.[type]?.allowed || 0;
                if (optionalCount > 0) {
                    const selectedCount = this.character?.optionalProficiencies?.[type]?.selected?.length || 0;
                    header.innerHTML = `${this.getTypeLabel(type)} <span class="selection-counter">(${selectedCount}/${optionalCount} ${type} selected)</span>`;
                }
            }

            // Populate items
            container.innerHTML = items.map(item => {
                const isProficient = Array.isArray(this.character?.proficiencies?.[type]) &&
                    this.character.proficiencies[type].includes(item);
                const isOptionallySelected = Array.isArray(this.character?.optionalProficiencies?.[type]?.selected) &&
                    this.character.optionalProficiencies[type].selected.includes(item);
                const isDefault = this.defaultProficiencies[type]?.includes(item);
                const isAvailable = this.isProficiencyAvailable(type, item);
                const optionalCount = this.character?.optionalProficiencies?.[type]?.allowed || 0;
                const selectedCount = this.character?.optionalProficiencies?.[type]?.selected?.length || 0;
                const canSelect = type !== 'savingThrows' && !isDefault && isAvailable &&
                    optionalCount > selectedCount && !isProficient && !isOptionallySelected;

                // Add class for normal/exotic languages
                const isNormalLanguage = type === 'languages' && this.availableOptions.languages.normal.includes(item);
                const languageClass = type === 'languages' ? (isNormalLanguage ? 'normal-language' : 'exotic-language') : '';

                return `
                    <div class="proficiency-item ${isProficient || isDefault ? 'proficient' : ''} 
                         ${isOptionallySelected ? 'proficient optional-selected' : ''} 
                         ${canSelect ? 'selectable' : ''} 
                         ${!isAvailable && !isDefault ? 'disabled' : ''}
                         ${languageClass}"
                         data-proficiency="${item}"
                         data-type="${type}">
                        <i class="fas ${icon} ${isOptionallySelected ? 'optional' : ''}"></i>
                        ${item}
                        ${type === 'skills' ? `<span class="ability">(${this.proficiencyManager.getSkillAbility(item)})</span>` : ''}
                        ${isOptionallySelected ? '<span class="unselect-hint"><i class="fas fa-times"></i></span>' : ''}
                    </div>
                `;
            }).join('');
        }
    }

    /**
     * Get the appropriate icon class for a proficiency type
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
     * Setup the main proficiency containers and their event listeners
     */
    setupProficiencyContainers() {
        this.proficiencyTypes.forEach(type => {
            const container = document.getElementById(`${type}Container`);
            if (!container) return;

            container.addEventListener('click', (e) => {
                const item = e.target.closest('.proficiency-item');
                if (!item) return;

                const proficiency = item.dataset.proficiency;
                const isOptional = item.classList.contains('selectable');
                const isSelected = item.classList.contains('proficient');

                if (isOptional) {
                    this.toggleOptionalProficiency(type, proficiency, item);
                } else if (!isSelected) {
                    this.character?.addProficiency(type, proficiency, 'Character');
                    item.classList.add('proficient');
                    this.markUnsavedChanges();
                    this.updateProficiencyNotes();
                }
            });
        });
    }

    /**
     * Toggle an optional proficiency
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
     */
    updateSelectionCounters() {
        this.proficiencyTypes.forEach(type => {
            const container = document.getElementById(`${type}Container`);
            if (!container) return;

            const header = container.previousElementSibling;
            const counter = header?.querySelector('.selection-counter');
            if (!counter) return;

            const allowed = this.character?.optionalProficiencies?.[type]?.allowed || 0;
            const selected = this.character?.optionalProficiencies?.[type]?.selected?.length || 0;
            counter.textContent = ` (${selected}/${allowed} selected)`;
        });
    }

    /**
     * Update proficiency notes section
     */
    updateProficiencyNotes() {
        const notesContainer = document.getElementById('proficiencyNotes');
        if (!notesContainer || !this.character) return;

        if (!this.character.proficiencySources?.length) {
            notesContainer.innerHTML = '<p>No proficiencies applied.</p>';
            return;
        }

        // Group proficiencies by source
        const sourceGroups = {};
        for (const source of this.character.proficiencySources) {
            if (!sourceGroups[source.source]) {
                sourceGroups[source.source] = [];
            }
            sourceGroups[source.source].push({
                type: source.type,
                proficiency: source.proficiency
            });
        }

        let notesHTML = '<p><strong>Proficiency Sources:</strong></p>';

        for (const source in sourceGroups) {
            notesHTML += `<div class="proficiency-note"><strong>${source}:</strong> `;

            const profsByType = {};
            for (const prof of sourceGroups[source]) {
                if (!profsByType[prof.type]) {
                    profsByType[prof.type] = [];
                }
                profsByType[prof.type].push(prof.proficiency);
            }

            const typeLabels = {
                'skills': 'Skills',
                'tools': 'Tools',
                'languages': 'Languages',
                'armor': 'Armor',
                'weapons': 'Weapons'
            };

            const profStrings = [];
            for (const type in profsByType) {
                profStrings.push(`${typeLabels[type]}: ${profsByType[type].join(', ')}`);
            }

            notesHTML += profStrings.join('; ');
            notesHTML += '</div>';
        }

        notesContainer.innerHTML = notesHTML;
    }

    /**
     * Mark that there are unsaved changes
     */
    markUnsavedChanges() {
        window.dispatchEvent(new CustomEvent('unsavedChanges'));
    }
} 