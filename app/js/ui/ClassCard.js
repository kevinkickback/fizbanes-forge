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
 * @property {string[]} skillProficiencies - Available skill proficiencies
 * @property {number} skillChoiceCount - Number of skills to choose
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
     * @param {Object} classData - The class data to display
     * @param {Object} subclassData - The optional subclass data
     */
    async updateClassDetails(classData, subclassData = null) {
        if (!classData) {
            this.resetClassDetails();
            return;
        }

        // Update individual sections
        this._updateHitDie(classData);
        this._updateSkillProficiencies(classData);
        this._updateSavingThrows(classData);
        await this._updateArmorProficiencies(classData);
        await this._updateWeaponProficiencies(classData);
        await this._updateToolProficiencies(classData);

        // Process the entire details container at once to resolve all reference tags
        await textProcessor.processElement(this.classDetails);

        // Update features
        await this._updateFeatures(classData, subclassData);
    }

    /**
     * Updates the hit die information display
     */
    _updateHitDie(classData) {
        const hitDieSection = this.classDetails.querySelector('.detail-section:nth-child(1) ul');
        if (hitDieSection) {
            hitDieSection.innerHTML = '';
            const li = document.createElement('li');
            li.className = 'text-content';
            li.textContent = `d${classData.getHitDice()}`;
            hitDieSection.appendChild(li);
        }
    }

    /**
     * Updates the skill proficiencies information display
     */
    _updateSkillProficiencies(classData) {
        // Find the skill proficiencies section by its position in the HTML structure
        const skillProficienciesSection = this.classDetails.querySelector('.detail-section:nth-child(2)');
        if (!skillProficienciesSection) return;

        // Clear previous content
        const skillList = skillProficienciesSection.querySelector('ul');
        if (!skillList) return;

        // Remove any existing choose header
        const existingChooseHeader = skillProficienciesSection.querySelector('.choose-text');
        if (existingChooseHeader) {
            existingChooseHeader.remove();
        }

        skillList.innerHTML = '';

        // If we have a class and it has skill proficiencies
        if (classData) {
            const skills = classData.getSkillProficiencies();
            if (skills?.length) {
                // Get the formatted string from the class manager
                const formattedString = this.classManager.getFormattedSkillProficiencies(classData);
                const hasChoices = formattedString.includes('Choose');

                if (hasChoices) {
                    // For "Choose X from Y" format, split into header and skills list
                    // Extract the "Choose X from:" part from the string
                    const choosePattern = /(Choose \d+ from:)\s+(.*)/;
                    const matches = formattedString.match(choosePattern);

                    if (matches && matches.length >= 3) {
                        const chooseText = matches[1]; // "Choose X from:"
                        const skillsText = matches[2]; // The list of skills

                        // Add the "Choose X from:" as a header above the list
                        const chooseHeader = document.createElement('div');
                        chooseHeader.className = 'choose-text font-weight-bold';
                        chooseHeader.style.marginBottom = '0.5rem';
                        chooseHeader.textContent = chooseText;

                        // Insert the header before the list
                        skillProficienciesSection.insertBefore(chooseHeader, skillList);

                        // Split the skills by comma and create a list item for each
                        const skillsArray = skillsText.split(', ');

                        // Apply multi-column if more than 3 skills
                        if (skillsArray.length > 3) {
                            skillList.className = 'multi-column-list';
                            if (skillsArray.length > 6) {
                                skillList.classList.add('many-items');
                            }
                        }

                        // Add each skill as a separate list item
                        for (const skill of skillsArray) {
                            const li = document.createElement('li');
                            li.className = 'text-content';
                            li.textContent = skill.trim();
                            skillList.appendChild(li);
                        }

                        // Set available skills in the character's optional proficiencies
                        if (characterHandler.currentCharacter) {
                            // Set the skill options list in the character (needed for ProficiencyCard to enable selection)
                            const skillOptions = skillsArray.map(skill => skill.trim());
                            characterHandler.currentCharacter.optionalProficiencies.skills.options = skillOptions;
                            console.log(`[ClassCard] Setting skill options from UI: ${skillOptions.join(', ')}`);
                        }
                    } else {
                        // Fallback if the pattern matching fails
                        const li = document.createElement('li');
                        li.className = 'text-content';
                        li.textContent = formattedString;
                        skillList.appendChild(li);
                    }
                } else {
                    // For fixed proficiencies without choices
                    const li = document.createElement('li');
                    li.className = 'text-content';
                    li.textContent = formattedString;
                    skillList.appendChild(li);
                }
            } else {
                // No skill proficiencies for this class
                const li = document.createElement('li');
                li.className = 'text-content';
                li.textContent = 'None';
                skillList.appendChild(li);
            }
        } else {
            // No class data available
            const li = document.createElement('li');
            li.className = 'text-content';
            li.textContent = 'None';
            skillList.appendChild(li);
        }
    }

    /**
     * Updates the saving throws information display
     */
    _updateSavingThrows(classData) {
        const savingThrowsSection = this.classDetails.querySelector('.detail-section:nth-child(3) ul');
        if (savingThrowsSection) {
            savingThrowsSection.innerHTML = '';

            const savingThrows = classData.getSavingThrows();
            if (savingThrows && savingThrows.length > 0) {
                for (const save of savingThrows) {
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
     * @private
     */
    async _updateArmorProficiencies(classData) {
        const armorSection = this.classDetails.querySelector('.detail-section:nth-child(4) ul');
        if (armorSection) {
            armorSection.innerHTML = '';
            armorSection.className = ''; // Reset classes

            const armorProficiencies = classData.getArmorProficiencies();
            if (armorProficiencies && armorProficiencies.length > 0) {
                // Apply multi-column if more than 3 proficiencies
                if (armorProficiencies.length > 3) {
                    armorSection.className = 'multi-column-list';
                    if (armorProficiencies.length > 6) {
                        armorSection.classList.add('many-items');
                    }
                }

                for (const armor of armorProficiencies) {
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
     * @private
     */
    async _updateWeaponProficiencies(classData) {
        const weaponSection = this.classDetails.querySelector('.detail-section:nth-child(5) ul');
        if (weaponSection) {
            weaponSection.innerHTML = '';
            weaponSection.className = ''; // Reset classes

            const weaponProficiencies = classData.getWeaponProficiencies();
            if (weaponProficiencies && weaponProficiencies.length > 0) {
                // Apply multi-column if more than 3 proficiencies
                if (weaponProficiencies.length > 3) {
                    weaponSection.className = 'multi-column-list';
                    if (weaponProficiencies.length > 6) {
                        weaponSection.classList.add('many-items');
                    }
                }

                for (const weapon of weaponProficiencies) {
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
     * @private
     */
    async _updateToolProficiencies(classData) {
        const toolSection = this.classDetails.querySelector('.detail-section:nth-child(6) ul');
        if (toolSection) {
            toolSection.innerHTML = '';
            toolSection.className = ''; // Reset classes

            const toolProficiencies = classData.getToolProficiencies();
            if (toolProficiencies && toolProficiencies.length > 0) {
                // Apply multi-column if more than 3 proficiencies
                if (toolProficiencies.length > 3) {
                    toolSection.className = 'multi-column-list';
                    if (toolProficiencies.length > 6) {
                        toolSection.classList.add('many-items');
                    }
                }

                for (const tool of toolProficiencies) {
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

        // Specifically update the features section to use a list item
        const featuresSection = this.classDetails.querySelector('.features-section');
        if (featuresSection) {
            featuresSection.innerHTML = `
                <h6>Features</h6>
                <div class="features-grid">
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
            `;
        }
    }

    /**
     * Setup event listeners for class selection
     */
    setupEventListeners() {
        this.classSelect.addEventListener('change', this._handleClassChange.bind(this));
        this.subclassSelect.addEventListener('change', this._handleSubclassChange.bind(this));

        // Listen for character changes (level, etc.) to update features
        document.addEventListener('characterChanged', this._handleCharacterChanged.bind(this));
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
     * Handle character changes (like level changes)
     * @param {Event} event - The character changed event
     * @private
     */
    async _handleCharacterChanged(event) {
        const classData = this.classManager.getSelectedClass();
        const subclassData = this.classManager.getSelectedSubclass();

        if (classData) {
            // Only update the features section, not the entire card
            await this._updateFeatures(classData, subclassData);
        }
    }

    /**
     * Update character's class information
     * @param {Class} classData - Selected class
     * @param {Subclass} subclass - Selected subclass
     * @private
     */
    _updateCharacterClass(classData, subclass) {
        const character = characterHandler.currentCharacter;
        if (!character) return;

        // Check if class has changed
        const hasChanged = !classData ?
            (character.class?.name || character.class?.source) :
            (character.class?.name !== classData.name ||
                character.class?.source !== classData.source ||
                character.subclass !== (subclass?.name || ''));

        if (hasChanged) {
            console.log(`[ClassCard] Class changed from ${character.class?.name || 'none'} to ${classData?.name || 'none'}`);

            // Clear previous class proficiencies, ability bonuses, and traits
            character.removeProficienciesBySource('Class');
            character.clearTraits('Class');

            // Remove subclass proficiencies and traits
            character.removeProficienciesBySource('Subclass');
            character.clearTraits('Subclass');

            // Notify UI to clear optional proficiencies from class
            document.dispatchEvent(new CustomEvent('proficienciesRemoved', {
                detail: { source: 'Class' }
            }));

            if (!classData) {
                // Clear class
                character.class = {
                    level: 1
                };
                character.subclass = '';
            } else {
                // Set class
                character.class = {
                    name: classData.name,
                    source: classData.source,
                    level: 1
                };
                character.subclass = subclass?.name || '';

                // Add proficiencies
                this._updateProficiencies(classData);

                // Force a refresh after a short delay to ensure everything is updated
                setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('proficiencyChanged', {
                        detail: { triggerCleanup: true, forcedRefresh: true }
                    }));
                }, 100);
            }

            // Trigger an event to update the UI
            document.dispatchEvent(new CustomEvent('classChanged', { detail: { classData, subclass } }));
            document.dispatchEvent(new CustomEvent('characterChanged'));
        }
    }

    /**
     * Update proficiencies based on class data
     * @param {Object} classData - The class data
     * @private
     */
    _updateProficiencies(classData) {
        const character = characterHandler.currentCharacter;
        if (!character || !classData) return;

        console.log('[ClassCard] Updating proficiencies for class:', classData.name);

        // Store previous selected proficiencies to restore valid ones later
        const previousClassSkills = character.optionalProficiencies.skills.class?.selected || [];
        const previousClassLanguages = character.optionalProficiencies.languages.class?.selected || [];
        const previousClassTools = character.optionalProficiencies.tools.class?.selected || [];

        // Clear class-specific proficiencies by source
        character.removeProficienciesBySource('Class');

        // Reset class skill options
        character.optionalProficiencies.skills.class.allowed = 0;
        character.optionalProficiencies.skills.class.options = [];
        character.optionalProficiencies.skills.class.selected = [];

        character.optionalProficiencies.languages.class.allowed = 0;
        character.optionalProficiencies.languages.class.options = [];
        character.optionalProficiencies.languages.class.selected = [];

        character.optionalProficiencies.tools.class.allowed = 0;
        character.optionalProficiencies.tools.class.options = [];
        character.optionalProficiencies.tools.class.selected = [];

        // Add saving throw proficiencies
        const savingThrows = classData.getSavingThrows();
        if (savingThrows && savingThrows.length > 0) {
            for (const save of savingThrows) {
                character.addProficiency('savingThrows', save, 'Class');
                console.log(`[ClassCard] Added saving throw proficiency: ${save}`);
            }
        }

        // Add armor proficiencies
        const armorProficiencies = classData.getArmorProficiencies();
        if (armorProficiencies && armorProficiencies.length > 0) {
            for (const armor of armorProficiencies) {
                character.addProficiency('armor', armor, 'Class');
                console.log(`[ClassCard] Added armor proficiency: ${armor}`);
            }
        }

        // Add weapon proficiencies
        const weaponProficiencies = classData.getWeaponProficiencies();
        if (weaponProficiencies && weaponProficiencies.length > 0) {
            for (const weapon of weaponProficiencies) {
                character.addProficiency('weapons', weapon, 'Class');
                console.log(`[ClassCard] Added weapon proficiency: ${weapon}`);
            }
        }

        // Add tool proficiencies
        const toolProficiencies = classData.getToolProficiencies();
        if (toolProficiencies && toolProficiencies.length > 0) {
            for (const tool of toolProficiencies) {
                character.addProficiency('tools', tool, 'Class');
                console.log(`[ClassCard] Added tool proficiency: ${tool}`);
            }
        }

        // Handle skill proficiencies
        const skills = classData.getSkillProficiencies();
        const skillChoiceCount = classData.getSkillChoiceCount();

        if (skills && skills.length > 0 && skillChoiceCount > 0) {
            // Set up skill choices
            character.optionalProficiencies.skills.class.allowed = skillChoiceCount;
            character.optionalProficiencies.skills.class.options = skills;

            // Restore valid selections
            character.optionalProficiencies.skills.class.selected = previousClassSkills.filter(
                skill => skills.includes(skill)
            );

            console.log(`[ClassCard] Added skill choice: ${skillChoiceCount} from ${skills.join(', ')}`);
        }

        // Update combined options for all proficiency types
        this._updateCombinedProficiencyOptions(character);

        // Notify UI to update proficiencies
        document.dispatchEvent(new CustomEvent('proficiencyChanged'));
        document.dispatchEvent(new CustomEvent('characterChanged'));
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

        console.log('[ClassCard] Updated combined language options:', {
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

        console.log('[ClassCard] Updated combined tool options:', {
            raceToolOptions,
            classToolOptions,
            backgroundToolOptions,
            combinedOptions: character.optionalProficiencies.tools.options,
            allowed: character.optionalProficiencies.tools.allowed,
            selected: character.optionalProficiencies.tools.selected
        });
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

        console.log('[ClassCard] Updated combined skill options:', {
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
        const description = classData.getDescription() || 'No description available.';

        // Set quick description - add text-content class to let TextProcessor handle it
        this.classQuickDesc.innerHTML = `
            <h5>${classData.name}</h5>
            <p class="text-content">${description}</p>
        `;
    }

    /**
     * Update the features section based on class and level
     * @param {Class} classData - Selected class
     * @param {Subclass} subclassData - Selected subclass (optional)
     * @private
     */
    async _updateFeatures(classData, subclassData = null) {
        const featuresSection = this.classDetails.querySelector('.features-section');
        if (!featuresSection) {
            console.warn('Features section not found in class details');
            return;
        }

        const character = characterHandler.currentCharacter;
        const level = character?.level || 1;

        console.log(`[ClassCard] Getting features for ${classData.name} at level ${level}`);

        // Get class features for the current level
        const features = classData.getFeatures(level) || [];
        console.log('[ClassCard] Found features:', features);

        // Get subclass features for the current level if a subclass is selected
        let subclassFeatures = [];
        if (subclassData) {
            subclassFeatures = subclassData.getFeatures?.(level) || [];
        }

        // Combine class and subclass features
        const allFeatures = [...features, ...subclassFeatures];

        if (allFeatures.length > 0) {
            const processedFeatures = await Promise.all(allFeatures.map(async feature => {
                if (!feature.name || !feature.entries) {
                    console.warn('[ClassCard] Feature missing name or entries:', feature);
                    return '';
                }

                const name = feature.name;
                let description = this._formatFeatureEntries(feature.entries);

                // Process the description with the text processor if it exists
                if (description) {
                    try {
                        description = await textProcessor.processString(description);
                    } catch (error) {
                        console.error('Error processing feature description:', error);
                    }
                }

                // Format source and page info
                const source = feature.source || classData.source || '';
                const page = feature.page || '';
                const sourceInfo = page ? `${source}, page ${page}` : source;

                // Format the tooltip with the feature name as a title and source info at the bottom
                const tooltipContent = description ?
                    `<strong>${name}</strong><br>${description}${sourceInfo ? `<div class="tooltip-source">${sourceInfo}</div>` : ''}` : '';

                return `<span class="feature-tag" data-tooltip="${encodeURIComponent(tooltipContent)}">${name}</span>`;
            }));

            featuresSection.innerHTML = `
                <h6>Features</h6>
                <div class="features-grid">
                    ${processedFeatures.join('')}
                </div>
            `;
        } else {
            featuresSection.innerHTML = `
                <h6>Features</h6>
                <div class="features-grid">
                    <ul class="mb-0">
                        <li class="text-content">No features at level ${level}</li>
                    </ul>
                </div>
            `;
        }
    }

    /**
     * Formats feature entries for display
     * @param {Array|String} entries - Array of entries or string
     * @returns {string} Formatted HTML string
     * @private
     */
    _formatFeatureEntries(entries) {
        // If entries is a string, just return it
        if (typeof entries === 'string') {
            return entries;
        }

        // If entries is not an array, return empty string
        if (!Array.isArray(entries)) {
            console.warn('Feature entries is not an array or string:', entries);
            return '';
        }

        let result = '';

        // Process each entry in the array
        for (const entry of entries) {
            // Handle strings directly
            if (typeof entry === 'string') {
                result += `<p>${entry}</p>`;
                continue;
            }

            // Handle objects with different types
            if (typeof entry === 'object') {
                // Handle lists
                if (entry.type === 'list') {
                    result += '<ul class="tooltip-list">';

                    if (Array.isArray(entry.items)) {
                        for (const item of entry.items) {
                            if (typeof item === 'string') {
                                result += `<li>${item}</li>`;
                            } else if (typeof item === 'object') {
                                // Handle items with name and entry
                                if (item.name && item.entry) {
                                    result += `<li><strong>${item.name}</strong>: ${item.entry}</li>`;
                                } else if (item.name && item.entries) {
                                    // Handle items with name and entries array
                                    result += `<li><strong>${item.name}</strong>: ${this._formatFeatureEntries(item.entries)}</li>`;
                                } else {
                                    console.warn('Unhandled list item format:', item);
                                }
                            }
                        }
                    }

                    result += '</ul>';
                }
                // Handle tables
                else if (entry.type === 'table') {
                    result += '<div class="table-container">';

                    if (entry.caption) {
                        result += `<p><strong>${entry.caption}</strong></p>`;
                    }

                    result += '<table class="tooltip-table"><tbody>';

                    if (Array.isArray(entry.rows)) {
                        for (const row of entry.rows) {
                            result += '<tr>';

                            if (Array.isArray(row)) {
                                for (const cell of row) {
                                    result += `<td>${typeof cell === 'string' ? cell : JSON.stringify(cell)}</td>`;
                                }
                            }

                            result += '</tr>';
                        }
                    }

                    result += '</tbody></table></div>';
                }
                // Handle entries property (recursive)
                else if (Array.isArray(entry.entries)) {
                    result += this._formatFeatureEntries(entry.entries);
                }
                // Handle entry property
                else if (entry.entry) {
                    result += `<p>${entry.entry}</p>`;
                }
                // Handle name and text properties
                else if (entry.name && entry.text) {
                    result += `<p><strong>${entry.name}</strong>. ${entry.text}</p>`;
                }
                // Fall back to JSON for unhandled formats
                else {
                    console.warn('Unhandled entry format:', entry);
                    result += `<p>${JSON.stringify(entry)}</p>`;
                }
            }
        }

        return result;
    }
} 
