/**
 * ClassCard.js
 * Controller for the class selection UI component.
 * Coordinates between views and manages class/subclass selection logic.
 */

import { classService } from '../../services/ClassService.js';
import { eventEmitter } from '../../utils/EventBus.js';
import { CharacterManager } from '../../application/CharacterManager.js';
import { ClassCardView } from './ClassView.js';
import { SubclassPickerView } from './SubclassPicker.js';
import { ClassDetailsView } from './ClassDetails.js';

/**
 * Controller for class selection and display
 */
export class ClassCard {
    /**
     * Creates a new ClassCard instance
     * @param {HTMLElement} container - The container element for the class card UI
     */
    constructor(container) {
        /**
         * Reference to the class service
         * @type {ClassService}
         * @private
         */
        this._classService = classService;

        /**
         * View for class selection and quick description
         * @type {ClassCardView}
         * @private
         */
        this._cardView = new ClassCardView();

        /**
         * View for subclass selection
         * @type {SubclassPickerView}
         * @private
         */
        this._subclassView = new SubclassPickerView();

        /**
         * View for class details display
         * @type {ClassDetailsView}
         * @private
         */
        this._detailsView = new ClassDetailsView();

        // Initialize the component
        this.initialize();
    }

    //-------------------------------------------------------------------------
    // Initialization Methods
    //-------------------------------------------------------------------------

    /**
     * Initializes the class card UI components and event listeners
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            // Initialize required dependencies
            await this._classService.initialize();

            // Set up event listeners
            this._setupEventListeners();

            // Load saved class selection from character data
            await this._loadSavedClassSelection();
        } catch (error) {
            console.error('Failed to initialize class card:', error);
        }
    }

    /**
     * Sets up event listeners for class and subclass selection changes
     * @private
     */
    _setupEventListeners() {
        this._cardView.onClassChange(event => this._handleClassChange(event));
        this._subclassView.onSubclassChange(event => this._handleSubclassChange(event));
        document.addEventListener('characterChanged', event => this._handleCharacterChanged(event));

        // Add direct listener for class:selected event
        document.addEventListener('class:selected', event => {
            this.updateClassDetails(event.detail).catch(err =>
                console.error('Error handling class:selected event:', err)
            );
        });
    }

    //-------------------------------------------------------------------------
    // Data Loading Methods
    //-------------------------------------------------------------------------

    /**
     * Loads and sets the saved class selection from the character data
     * @returns {Promise<void>}
     * @private
     */
    async _loadSavedClassSelection() {
        try {
            // Populate class dropdown first
            await this._populateClassSelect();

            const character = characterLifecycle?.currentCharacter;
            if (!character?.class?.name || !character?.class?.source) {
                return; // No saved class to load
            }

            // Set the class selection if it exists in available options
            const classValue = `${character.class.name}_${character.class.source}`;

            if (this._cardView.hasClassOption(classValue)) {
                this._cardView.setSelectedClassValue(classValue);
                this._cardView.triggerClassSelectChange();

                // Also set subclass if one was selected
                if (character.class.subclass) {
                    // Wait for subclass options to populate
                    await new Promise(resolve => setTimeout(resolve, 100));

                    if (this._subclassView.hasSubclassOption(character.class.subclass)) {
                        this._subclassView.setSelectedSubclassValue(character.class.subclass);
                        this._subclassView.triggerSubclassSelectChange();
                    }
                }
            } else {
                console.warn(`Saved class "${classValue}" not found in available options. Character might use a source that's not currently allowed.`);
            }
        } catch (error) {
            console.error('Error loading saved class selection:', error);
        }
    }

    /**
     * Populates the class selection dropdown with all available classes
     * filtered by allowed sources
     * @returns {Promise<void>}
     * @private
     */
    async _populateClassSelect() {
        try {
            const classes = this._classService.getAllClasses();
            if (!classes || classes.length === 0) {
                console.error('No classes available to populate dropdown');
                return;
            }

            const currentCharacter = CharacterManager.getCurrentCharacter();
            const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
            const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

            // Filter classes by allowed sources
            const filteredClasses = classes.filter(cls => {
                const classSource = cls.source?.toUpperCase();
                return upperAllowedSources.has(classSource);
            });

            if (filteredClasses.length === 0) {
                console.error('No classes available after source filtering');
                return;
            }

            // Populate view
            this._cardView.populateClassSelect(filteredClasses);
        } catch (error) {
            console.error('Error populating class dropdown:', error);
        }
    }

    /**
     * Populates the subclass selection dropdown based on the currently selected class
     * filtered by allowed sources
     * @param {Object} classData - The selected class data
     * @returns {Promise<void>}
     * @private
     */
    async _populateSubclassSelect(classData) {
        if (!classData) {
            this._subclassView.reset();
            return;
        }

        try {
            // Get subclasses from the service
            const subclasses = this._classService.getSubclasses(classData.name, classData.source);

            if (!subclasses || subclasses.length === 0) {
                this._subclassView.reset();
                return;
            }

            const currentCharacter = CharacterManager.getCurrentCharacter();
            const allowedSources = currentCharacter?.allowedSources || new Set(['PHB']);
            const upperAllowedSources = new Set(Array.from(allowedSources).map(source => source.toUpperCase()));

            // Filter subclasses by allowed sources
            const filteredSubclasses = subclasses.filter(subclass => {
                const subclassSource = subclass.source?.toUpperCase();
                return upperAllowedSources.has(subclassSource);
            });

            // Populate view
            this._subclassView.populateSubclassSelect(filteredSubclasses);
        } catch (error) {
            console.error('Error loading subclasses for dropdown:', error);
        }
    }

    //-------------------------------------------------------------------------
    // Event Handlers
    //-------------------------------------------------------------------------

    /**
     * Handles class selection change events
     * @param {Event} event - The change event
     * @returns {Promise<void>}
     * @private
     */
    async _handleClassChange(event) {
        try {
            const [className, source] = event.target.value.split('_');

            if (!className || !source) {
                this.resetClassDetails();
                await this._populateSubclassSelect(null);
                return;
            }

            const classData = this._classService.getClass(className, source);
            if (!classData) {
                console.error(`Class not found: ${className} (${source})`);
                return;
            }

            // Get fluff data for quick description
            const fluffData = this._classService.getClassFluff(classData.name, classData.source);

            // Update the UI with the selected class data
            await this._cardView.updateQuickDescription(classData, fluffData);
            await this.updateClassDetails(classData);
            await this._populateSubclassSelect(classData);

            // Update character data
            this._updateCharacterClass(classData);

        } catch (error) {
            console.error('Error handling class change:', error);
        }
    }

    /**
     * Handles subclass selection change events
     * @param {Event} event - The change event
     * @returns {Promise<void>}
     * @private
     */
    async _handleSubclassChange(event) {
        try {
            const subclassName = event.target.value;
            const classValue = this._cardView.getSelectedClassValue();
            const [className, source] = classValue.split('_');

            if (!className || !source) {
                return;
            }

            const classData = this._classService.getClass(className, source);
            if (!classData) {
                console.error(`Class not found: ${className} (${source})`);
                return;
            }

            let subclassData = null;
            if (subclassName) {
                const subclasses = this._classService.getSubclasses(className, source);
                subclassData = subclasses.find(sc => sc.name === subclassName);
            }

            // Update the UI with the subclass data
            await this.updateClassDetails(classData, subclassData);

            // Update character data
            this._updateCharacterClass(classData, subclassName);

        } catch (error) {
            console.error('Error handling subclass change:', error);
        }
    }

    /**
     * Handles character changed events
     * @param {Event} event - The character changed event
     * @returns {Promise<void>}
     * @private
     */
    async _handleCharacterChanged(event) {
        try {
            const character = event.detail?.character;
            if (!character) return;

            // Reload class selection to match character's class
            await this._loadSavedClassSelection();

        } catch (error) {
            console.error('Error handling character changed event:', error);
        }
    }

    //-------------------------------------------------------------------------
    // UI Update Methods
    //-------------------------------------------------------------------------

    /**
     * Updates the display of class details for the selected class and subclass
     * @param {Object} classData - The class data to display
     * @param {Object} subclassData - The optional subclass data
     * @returns {Promise<void>}
     */
    async updateClassDetails(classData, subclassData = null) {
        if (!classData) {
            this.resetClassDetails();
            return;
        }

        // Update class details (proficiencies, etc.)
        await this._detailsView.updateAllDetails(classData);

        // Update features separately
        await this._updateFeatures(classData, subclassData);
    }

    /**
     * Update the features section based on class and level
     * @param {Object} classData - Selected class
     * @param {Object} subclassData - Selected subclass (optional)
     * @returns {Promise<void>}
     * @private
     */
    async _updateFeatures(classData, subclassData = null) {
        const character = CharacterManager.getCurrentCharacter();
        const level = character?.level || 1;

        // Get all class features up to the current level (cumulative)
        const classFeatures = this._classService.getClassFeatures(
            classData.name,
            level,
            classData.source
        ) || [];

        // Get all subclass features up to the current level if a subclass is selected
        let subclassFeatures = [];
        if (subclassData) {
            subclassFeatures = this._classService.getSubclassFeatures(
                classData.name,
                subclassData.shortName || subclassData.name,
                level,
                subclassData.source || subclassData.classSource
            ) || [];
        }

        // Combine and pass to view
        const allFeatures = [...classFeatures, ...subclassFeatures];
        await this._detailsView.updateFeatures(classData, allFeatures);
    }

    /**
     * Reset class details to placeholder state
     */
    resetClassDetails() {
        this._cardView.resetQuickDescription();
        this._detailsView.resetAllDetails();
    }

    //-------------------------------------------------------------------------
    // Character Data Management
    //-------------------------------------------------------------------------

    /**
     * Update character's class information
     * @param {Object} classData - Selected class
     * @param {string} subclassName - Selected subclass name
     * @private
     */
    _updateCharacterClass(classData, subclassName = '') {
        const character = CharacterManager.getCurrentCharacter();
        if (!character) return;

        // Check if class has changed
        const hasChanged = !classData ?
            (character.class?.name || character.class?.source) :
            (character.class?.name !== classData.name ||
                character.class?.source !== classData.source ||
                character.subclass !== subclassName);

        if (hasChanged) {
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
                character.subclass = subclassName;

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
            document.dispatchEvent(new CustomEvent('classChanged', {
                detail: { classData, subclass: subclassName }
            }));
            document.dispatchEvent(new CustomEvent('characterChanged'));
        }
    }

    /**
     * Update proficiencies based on class data
     * @param {Object} classData - The class data
     * @private
     */
    _updateProficiencies(classData) {
        const character = CharacterManager.getCurrentCharacter();
        if (!character || !classData) return;

        // Store previous selected proficiencies to restore valid ones later
        const previousClassSkills = character.optionalProficiencies.skills.class?.selected || [];

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
        const savingThrows = this._getSavingThrows(classData);
        if (savingThrows && savingThrows.length > 0) {
            for (const save of savingThrows) {
                character.addProficiency('savingThrows', save, 'Class');
            }
        }

        // Add armor proficiencies
        const armorProficiencies = this._getArmorProficiencies(classData);
        if (armorProficiencies && armorProficiencies.length > 0) {
            for (const armor of armorProficiencies) {
                character.addProficiency('armor', armor, 'Class');
            }
        }

        // Add weapon proficiencies
        const weaponProficiencies = this._getWeaponProficiencies(classData);
        if (weaponProficiencies && weaponProficiencies.length > 0) {
            for (const weapon of weaponProficiencies) {
                character.addProficiency('weapons', weapon, 'Class');
            }
        }

        // Add tool proficiencies
        const toolProficiencies = this._getToolProficiencies(classData);
        if (toolProficiencies && toolProficiencies.length > 0) {
            for (const tool of toolProficiencies) {
                character.addProficiency('tools', tool, 'Class');
            }
        }

        // Handle skill proficiencies
        const skills = this._getSkillProficiencies(classData);
        const skillChoiceCount = this._getSkillChoiceCount(classData);

        if (skills && skills.length > 0 && skillChoiceCount > 0) {
            // Set up skill choices using the extracted names
            character.optionalProficiencies.skills.class.allowed = skillChoiceCount;
            character.optionalProficiencies.skills.class.options = skills;

            // Restore valid selections using the extracted names
            character.optionalProficiencies.skills.class.selected = previousClassSkills.filter(
                skill => skills.includes(skill)
            );
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
    }

    //-------------------------------------------------------------------------
    // Data Extraction Helper Methods
    //-------------------------------------------------------------------------

    /**
     * Get saving throws from class data
     * @param {Object} classData - Class JSON object
     * @returns {Array<string>} Array of saving throw names
     * @private
     */
    _getSavingThrows(classData) {
        if (!classData?.proficiency) return [];

        const abilityMap = {
            str: 'Strength',
            dex: 'Dexterity',
            con: 'Constitution',
            int: 'Intelligence',
            wis: 'Wisdom',
            cha: 'Charisma'
        };

        return classData.proficiency.map(prof => abilityMap[prof] || prof);
    }

    /**
     * Get armor proficiencies from class data
     * @param {Object} classData - Class JSON object
     * @returns {Array<string>} Array of armor proficiency names
     * @private
     */
    _getArmorProficiencies(classData) {
        if (!classData?.startingProficiencies?.armor) return [];

        const armorMap = {
            light: 'Light Armor',
            medium: 'Medium Armor',
            heavy: 'Heavy Armor',
            shield: 'Shields'
        };

        return classData.startingProficiencies.armor.map(armor => {
            if (armorMap[armor]) return armorMap[armor];
            return armor;
        });
    }

    /**
     * Get weapon proficiencies from class data
     * @param {Object} classData - Class JSON object
     * @returns {Array<string>} Array of weapon proficiency names
     * @private
     */
    _getWeaponProficiencies(classData) {
        if (!classData?.startingProficiencies?.weapons) return [];

        const weaponMap = {
            simple: 'Simple Weapons',
            martial: 'Martial Weapons'
        };

        return classData.startingProficiencies.weapons.map(weapon => {
            if (weaponMap[weapon]) return weaponMap[weapon];
            return weapon;
        });
    }

    /**
     * Get tool proficiencies from class data
     * @param {Object} classData - Class JSON object
     * @returns {Array<string>} Array of tool proficiency names
     * @private
     */
    _getToolProficiencies(classData) {
        if (!classData?.startingProficiencies?.tools) return [];

        const tools = [];
        for (const toolEntry of classData.startingProficiencies.tools) {
            if (typeof toolEntry === 'string') {
                tools.push(toolEntry);
            } else if (toolEntry.choose) {
                const count = toolEntry.choose.count || 1;
                tools.push(`Choose ${count} tool${count > 1 ? 's' : ''}`);
            } else {
                for (const [key, value] of Object.entries(toolEntry)) {
                    if (value === true) {
                        tools.push(key.charAt(0).toUpperCase() + key.slice(1));
                    }
                }
            }
        }

        return tools;
    }

    /**
     * Get skill proficiency options from class data
     * @param {Object} classData - Class JSON object
     * @returns {Array<string>} Array of skill names
     * @private
     */
    _getSkillProficiencies(classData) {
        if (!classData?.startingProficiencies?.skills) return [];

        const skills = classData.startingProficiencies.skills;
        const skillOptions = [];

        for (const skillEntry of skills) {
            if (skillEntry.choose?.from) {
                skillOptions.push(...skillEntry.choose.from);
            } else if (skillEntry.choose?.fromFilter) {
                // "Any" skills - return special marker
                skillOptions.push('any');
            } else {
                // Fixed proficiencies
                skillOptions.push(...Object.keys(skillEntry));
            }
        }

        return skillOptions;
    }

    /**
     * Get number of skills to choose from class data
     * @param {Object} classData - Class JSON object
     * @returns {number} Number of skills to choose
     * @private
     */
    _getSkillChoiceCount(classData) {
        if (!classData?.startingProficiencies?.skills) return 0;

        const skills = classData.startingProficiencies.skills;

        for (const skillEntry of skills) {
            if (skillEntry.choose) {
                return skillEntry.choose.count || 0;
            }
        }

        return 0;
    }
}
