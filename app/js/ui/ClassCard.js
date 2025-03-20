/**
 * ClassCard.js
 * UI component that handles the display and selection of character classes and subclasses.
 * 
 * @typedef {Object} Class
 * @property {string} id - Unique identifier for the class
 * @property {string} name - Name of the class
 * @property {string} source - Source book of the class
 * @property {string} description - Brief description of the class
 * @property {number} hitDice - Hit die size (e.g., 8 for d8)
 * @property {string[]} primaryAbility - Primary ability scores for the class
 * @property {string[]} savingThrows - Saving throw proficiencies
 * @property {string[]} armorProficiencies - Armor proficiencies
 * @property {string[]} weaponProficiencies - Weapon proficiencies
 * @property {string[]} toolProficiencies - Tool proficiencies
 * @property {Array<Subclass>} subclasses - Available subclasses
 * 
 * @typedef {Object} Subclass
 * @property {string} id - Unique identifier for the subclass
 * @property {string} name - Name of the subclass
 * @property {string} source - Source book of the subclass
 * @property {string} shortName - Shortened version of the subclass name
 */

import { textProcessor } from '../utils/TextProcessor.js';
import { tooltipManager } from '../managers/TooltipManager.js';
import { characterHandler } from '../utils/characterHandler.js';
import { classManager } from '../managers/ClassManager.js';

/**
 * Manages the class selection UI component and related functionality
 */
export class ClassCard {
    /**
     * Creates a new ClassCard instance
     * @param {HTMLElement} container - The container element for the class card UI
     */
    constructor(container) {
        this.classManager = classManager;
        this.classSelect = document.getElementById('classSelect');
        this.subclassSelect = document.getElementById('subclassSelect');
        this.classQuickDesc = document.getElementById('classQuickDesc');
        this.classDetails = document.getElementById('classDetails');

        this.initialize();
    }

    /**
     * Initializes the class card UI components and event listeners
     */
    async initialize() {
        try {
            await this.classManager.initialize();
            await textProcessor.initialize();
            tooltipManager.initialize();
            this.setupEventListeners();
            await this.loadSavedClassSelection();
        } catch (error) {
            console.error('Failed to initialize class card:', error);
        }
    }

    /**
     * Load and set the saved class selection
     */
    async loadSavedClassSelection() {
        try {
            await this.populateClassSelect();

            const character = characterHandler?.currentCharacter;
            if (character?.class?.name && character?.class?.source) {
                const classValue = `${character.class.name}_${character.class.source}`;
                const classExists = Array.from(this.classSelect.options).some(option => option.value === classValue);

                if (classExists) {
                    this.classSelect.value = classValue;
                    this.classSelect.dispatchEvent(new Event('change', { bubbles: true }));

                    if (character.class.subclass) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        const subclassExists = Array.from(this.subclassSelect.options).some(option => option.value === character.class.subclass);
                        if (subclassExists) {
                            this.subclassSelect.value = character.class.subclass;
                            this.subclassSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                } else {
                    console.warn(`Saved class "${classValue}" not found in available options. Character might use a source that's not currently allowed.`);
                }
            }
        } catch (error) {
            console.error('Error loading saved class selection:', error);
        }
    }

    /**
     * Populates the class selection dropdown with all available classes
     */
    async populateClassSelect() {
        console.log('[ClassCard] Populating class select dropdown');
        this.classSelect.innerHTML = '<option value="">Select a Class</option>';

        try {
            const classes = this.classManager.getAllClasses();
            if (!classes || classes.length === 0) {
                console.error('No classes available to populate dropdown');
                return;
            }

            const currentCharacter = characterHandler.currentCharacter;
            const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
            const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

            const filteredClasses = classes.filter(cls => {
                const classSource = cls.source?.toUpperCase();
                return upperAllowedSources.has(classSource);
            });

            if (filteredClasses.length === 0) {
                console.error('No classes available after source filtering');
                return;
            }

            // Sort classes by name
            filteredClasses.sort((a, b) => a.name.localeCompare(b.name));

            // Add options to select
            for (const classData of filteredClasses) {
                const option = document.createElement('option');
                option.value = `${classData.name}_${classData.source}`;
                option.textContent = `${classData.name} (${classData.source})`;
                this.classSelect.appendChild(option);
            }
        } catch (error) {
            console.error('Error populating class dropdown:', error);
        }
    }

    /**
     * Populates the subclass selection dropdown based on the currently selected class
     */
    async populateSubclassSelect(classData) {
        console.log('[ClassCard] Populating subclass select dropdown');
        this.subclassSelect.innerHTML = '<option value="">Select a Subclass</option>';
        this.subclassSelect.disabled = true;

        if (!classData || !classData.subclasses || classData.subclasses.length === 0) {
            return;
        }

        try {
            const currentCharacter = characterHandler.currentCharacter;
            const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
            const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

            const filteredSubclasses = classData.subclasses.filter(subclass => {
                const subclassSource = subclass.source?.toUpperCase();
                return upperAllowedSources.has(subclassSource);
            });

            if (filteredSubclasses.length > 0) {
                for (const subclass of filteredSubclasses) {
                    const option = document.createElement('option');
                    option.value = subclass.name;
                    option.textContent = `${subclass.name} (${subclass.source})`;
                    this.subclassSelect.appendChild(option);
                }
                this.subclassSelect.disabled = false;
            }
        } catch (error) {
            console.error('Error loading subclasses for dropdown:', error);
        }
    }

    /**
     * Updates the display of class details for the selected class
     */
    async updateClassDetails(classData, subclassData = null) {
        if (!classData) {
            this.resetClassDetails();
            return;
        }

        // Update all sections of the class details
        this._updateHitDie(classData);
        this._updatePrimaryAbility(classData);
        this._updateSavingThrows(classData);
        this._updateArmorProficiencies(classData);
        this._updateWeaponProficiencies(classData);
        this._updateToolProficiencies(classData);

        // Update subclass specific details if available
        if (subclassData) {
            // Add subclass-specific details
        }

        // Explicitly process the updated content
        await textProcessor.processPageContent(this.classDetails);
    }

    /**
     * Updates the hit die information display
     */
    _updateHitDie(classData) {
        const hitDieSection = this.classDetails.querySelector('.detail-section:nth-child(1) p');
        if (hitDieSection) {
            hitDieSection.className = 'text-content';
            hitDieSection.textContent = `d${classData.hitDice}`;
            hitDieSection.classList.remove('placeholder-text');
        }
    }

    /**
     * Updates the primary ability information display
     */
    _updatePrimaryAbility(classData) {
        const primaryAbilitySection = this.classDetails.querySelector('.detail-section:nth-child(2) p');
        if (primaryAbilitySection) {
            const abilityMap = {
                'str': 'Strength',
                'dex': 'Dexterity',
                'con': 'Constitution',
                'int': 'Intelligence',
                'wis': 'Wisdom',
                'cha': 'Charisma'
            };

            const abilityText = classData.primaryAbility
                .map(ability => abilityMap[ability] || ability)
                .join(' or ');

            primaryAbilitySection.className = 'text-content';
            primaryAbilitySection.textContent = abilityText;
            primaryAbilitySection.classList.remove('placeholder-text');
        }
    }

    /**
     * Updates the saving throws information display
     */
    _updateSavingThrows(classData) {
        const savingThrowsSection = this.classDetails.querySelector('.detail-section:nth-child(3) ul');
        if (savingThrowsSection) {
            savingThrowsSection.innerHTML = '';

            if (classData.savingThrows && classData.savingThrows.length > 0) {
                for (const save of classData.savingThrows) {
                    const li = document.createElement('li');
                    li.className = 'text-content';
                    li.textContent = save;
                    savingThrowsSection.appendChild(li);
                }
            } else {
                const li = document.createElement('li');
                li.textContent = '—';
                savingThrowsSection.appendChild(li);
            }
        }
    }

    /**
     * Updates the armor proficiencies information display
     */
    _updateArmorProficiencies(classData) {
        const armorSection = this.classDetails.querySelector('.detail-section:nth-child(4) ul');
        if (armorSection) {
            armorSection.innerHTML = '';

            if (classData.armorProficiencies && classData.armorProficiencies.length > 0) {
                for (const armor of classData.armorProficiencies) {
                    const li = document.createElement('li');
                    li.className = 'text-content';
                    li.textContent = armor;
                    armorSection.appendChild(li);
                }
            } else {
                const li = document.createElement('li');
                li.textContent = '—';
                armorSection.appendChild(li);
            }
        }
    }

    /**
     * Updates the weapon proficiencies information display
     */
    _updateWeaponProficiencies(classData) {
        const weaponSection = this.classDetails.querySelector('.detail-section:nth-child(5) ul');
        if (weaponSection) {
            weaponSection.innerHTML = '';

            if (classData.weaponProficiencies && classData.weaponProficiencies.length > 0) {
                for (const weapon of classData.weaponProficiencies) {
                    const li = document.createElement('li');
                    li.className = 'text-content';
                    li.textContent = weapon;
                    weaponSection.appendChild(li);
                }
            } else {
                const li = document.createElement('li');
                li.textContent = '—';
                weaponSection.appendChild(li);
            }
        }
    }

    /**
     * Updates the tool proficiencies information display
     */
    _updateToolProficiencies(classData) {
        const toolSection = this.classDetails.querySelector('.detail-section:nth-child(6) ul');
        if (toolSection) {
            toolSection.innerHTML = '';

            if (classData.toolProficiencies && classData.toolProficiencies.length > 0) {
                for (const tool of classData.toolProficiencies) {
                    const li = document.createElement('li');
                    li.className = 'text-content';
                    li.textContent = tool;
                    toolSection.appendChild(li);
                }
            } else {
                const li = document.createElement('li');
                li.textContent = '—';
                toolSection.appendChild(li);
            }
        }
    }

    /**
     * Reset class details to placeholder state
     */
    resetClassDetails() {
        this.classQuickDesc.innerHTML = `
            <div class="placeholder-content">
                <h5>Select a Class</h5>
                <p>Choose a class to see details about their abilities, proficiencies, and other characteristics.</p>
            </div>
        `;

        const detailSections = this.classDetails.querySelectorAll('.detail-section');
        for (const section of detailSections) {
            const list = section.querySelector('ul');
            const paragraph = section.querySelector('p');

            if (list) {
                list.innerHTML = '<li class="placeholder-text">—</li>';
            }

            if (paragraph) {
                paragraph.textContent = '—';
                paragraph.classList.add('placeholder-text');
            }
        }
    }

    /**
     * Setup event listeners for class and subclass selection
     */
    setupEventListeners() {
        if (this.classSelect) {
            this.classSelect.addEventListener('change', (event) => this._handleClassChange(event));
        }

        if (this.subclassSelect) {
            this.subclassSelect.addEventListener('change', (event) => this._handleSubclassChange(event));
        }
    }

    /**
     * Event handler for class selection change
     * @param {Event} event - The change event
     * @private
     */
    async _handleClassChange(event) {
        const classValue = event.target.value;

        if (!classValue) {
            this.resetClassDetails();
            this._updateCharacterClass(null, null);
            return;
        }

        try {
            const [className, source] = classValue.split('_');
            const selectedClass = this.classManager.selectClass(className, source);

            if (selectedClass) {
                await this.updateQuickDescription(selectedClass);
                await this.updateClassDetails(selectedClass);
                await this.populateSubclassSelect(selectedClass);
                this._updateCharacterClass(selectedClass, null);
            } else {
                console.error('Selected class not found:', className, source);
                this.resetClassDetails();
            }
        } catch (error) {
            console.error('Error handling class change:', error);
        }
    }

    /**
     * Event handler for subclass selection change
     * @param {Event} event - The change event
     * @private
     */
    async _handleSubclassChange(event) {
        const subclassValue = event.target.value;

        if (!this.classManager.getSelectedClass()) {
            return;
        }

        try {
            const selectedSubclass = this.classManager.selectSubclass(subclassValue);
            await this.updateClassDetails(
                this.classManager.getSelectedClass(),
                selectedSubclass
            );
            this._updateCharacterClass(
                this.classManager.getSelectedClass(),
                selectedSubclass
            );
        } catch (error) {
            console.error('Error handling subclass change:', error);
        }
    }

    /**
     * Update character's class and subclass information
     */
    _updateCharacterClass(classData, subclassData) {
        if (!characterHandler.currentCharacter) return;

        const currentClass = this.classSelect.value.split('_');
        const savedClass = characterHandler.currentCharacter.class || {};
        const savedSubclass = savedClass.subclass || '';

        const hasChanged = !currentClass[0] ?
            (savedClass.name || savedClass.source) :
            (savedClass.name !== currentClass[0] || savedClass.source !== currentClass[1] || savedSubclass !== (subclassData?.name || ''));

        if (hasChanged) {
            characterHandler.showUnsavedChanges();
        } else {
            characterHandler.hideUnsavedChanges();
        }

        if (!classData) {
            characterHandler.currentCharacter.class = { level: 1 };
            characterHandler.currentCharacter.class.subclass = '';
        } else {
            characterHandler.currentCharacter.class = {
                name: classData.name,
                source: classData.source,
                level: 1,
                hitDice: classData.hitDice
            };

            if (subclassData) {
                characterHandler.currentCharacter.class.subclass = subclassData.name;
            } else {
                characterHandler.currentCharacter.class.subclass = '';
            }
        }

        // Apply proficiencies from class to character
        this._updateProficiencies(classData);
    }

    /**
     * Update character proficiencies based on class selection
     */
    _updateProficiencies(classData) {
        if (!characterHandler.currentCharacter || !classData) return;

        // Clear existing class-sourced proficiencies
        characterHandler.currentCharacter.removeProficienciesBySource('Class');

        // Add saving throw proficiencies
        if (classData.savingThrows && classData.savingThrows.length > 0) {
            for (const save of classData.savingThrows) {
                characterHandler.currentCharacter.addProficiency('savingThrows', save, 'Class');
            }
        }

        // Add armor proficiencies
        if (classData.armorProficiencies && classData.armorProficiencies.length > 0) {
            for (const armor of classData.armorProficiencies) {
                characterHandler.currentCharacter.addProficiency('armor', armor, 'Class');
            }
        }

        // Add weapon proficiencies
        if (classData.weaponProficiencies && classData.weaponProficiencies.length > 0) {
            for (const weapon of classData.weaponProficiencies) {
                characterHandler.currentCharacter.addProficiency('weapons', weapon, 'Class');
            }
        }

        // Add tool proficiencies
        if (classData.toolProficiencies && classData.toolProficiencies.length > 0) {
            for (const tool of classData.toolProficiencies) {
                characterHandler.currentCharacter.addProficiency('tools', tool, 'Class');
            }
        }
    }

    /**
     * Updates the quick description area based on the selected class
     * @param {Object} classData - The selected class data
     */
    async updateQuickDescription(classData) {
        if (!classData) {
            this.classQuickDesc.innerHTML = `
                <div class="placeholder-content">
                    <h5>Select a Class</h5>
                    <p>Choose a class to see details about their abilities, proficiencies, and other characteristics.</p>
                </div>
            `;
            return;
        }

        // Get the description from classData
        const description = classData.description || 'No description available.';

        // Set quick description - add text-content class to let TextProcessor handle it
        this.classQuickDesc.innerHTML = `
            <h5>${classData.name}</h5>
            <p class="text-content">${description}</p>
        `;
    }
} 
