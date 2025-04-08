/**
 * @file ClassManager.js
 * Manages character classes and subclasses, handling class data loading, processing, and selection.
 * 
 * @typedef {Object} RawClassData
 * @property {string} name - The name of the class
 * @property {string} source - The source book abbreviation
 * @property {number} hd - Hit dice value (e.g., 8, 10, 12)
 * @property {string} [description] - Optional class description
 * @property {Array<string>} [proficiency] - Saving throw proficiencies as ability score abbreviations
 * @property {Object} [startingProficiencies] - Starting proficiencies for the class
 * @property {Array<string>} [startingProficiencies.armor] - Armor proficiencies
 * @property {Array<string>} [startingProficiencies.weapons] - Weapon proficiencies
 * @property {Array<string>} [startingProficiencies.tools] - Tool proficiencies
 * @property {Array<Object>} [classFeatures] - Class features by level
 * @property {Object} [spellcasting] - Spellcasting information if applicable
 * 
 * @typedef {Object} RawSubclassData
 * @property {string} name - The name of the subclass
 * @property {string} shortName - Abbreviated or shortened name
 * @property {string} source - The source book abbreviation
 * @property {string} className - The parent class name
 * @property {string} classSource - The parent class source
 * @property {Array<Object>} [subclassFeatures] - Subclass features by level
 * @property {Object} [spellcasting] - Subclass-specific spellcasting information if applicable
 * 
 * @typedef {Object} ProcessedClass
 * @property {string} name - The name of the class
 * @property {string} source - The source book abbreviation
 * @property {string} id - Unique identifier combining name and source
 * @property {number} hitDie - Hit dice value (e.g., 8, 10, 12)
 * @property {string} description - Processed class description
 * @property {Array<string>} skillProficiencies - Available skill proficiencies
 * @property {number} skillChoiceCount - Number of skills to choose
 * @property {Array<string>} savingThrows - Saving throw proficiencies as full ability names
 * @property {Array<string>} armorProficiencies - Processed armor proficiencies
 * @property {Array<string>} weaponProficiencies - Processed weapon proficiencies
 * @property {Array<string>} toolProficiencies - Processed tool proficiencies
 * @property {Array<ProcessedSubclass>} subclasses - Array of processed subclasses
 * @property {Array<Object>} features - Array of processed class features
 * 
 * @typedef {Object} ProcessedSubclass
 * @property {string} name - The name of the subclass
 * @property {string} shortName - Abbreviated or shortened name
 * @property {string} source - The source book abbreviation 
 * @property {string} className - The parent class name
 * @property {string} classSource - The parent class source
 * @property {string} id - Unique identifier combining name and source
 * @property {Array<Object>} features - Array of processed subclass features
 */

import { Class } from '../models/Class.js';
import { dataLoader } from '../dataloaders/DataLoader.js';
import { eventEmitter } from '../utils/EventEmitter.js';

/**
 * Manages character classes and subclasses
 */
class ClassManager {
    /**
     * Creates a new ClassManager instance.
     */
    constructor() {
        this._classes = new Map();
        this._subclasses = new Map();
        this._selectedClass = null;
        this._selectedSubclass = null;
    }

    /**
     * Initialize class data by loading and processing class information
     * @returns {Promise<boolean>} Promise resolving to true if initialization succeeded, false otherwise
     */
    async initialize() {
        try {
            const classData = await dataLoader.loadClasses();
            this._processClassData(classData);
            eventEmitter.emit('classes:loaded', Array.from(this._classes.values()));
            return true;
        } catch (error) {
            console.error('Failed to initialize class data:', error);
            return false;
        }
    }

    /**
     * Process raw class data into structured format
     * @param {Object} classData - Raw class data from API
     * @private
     */
    _processClassData(classData) {
        if (!classData || !classData.class) {
            console.warn('No class data to process');
            return;
        }

        // Process main classes
        for (const classItem of classData.class) {
            const classId = this._generateClassId(classItem);

            // Find associated class fluff
            const fluff = classData.fluff?.find(f =>
                f.name === classItem.name && f.source === classItem.source
            );

            // Create enriched class object
            const enrichedClass = {
                ...classItem,
                id: classId,
                fluff: fluff || null,
                subclasses: []
            };

            this._classes.set(classId, enrichedClass);
        }

        // Process subclasses and associate with parent classes
        if (classData.subclass) {
            for (const subclass of classData.subclass) {
                const parentClassId = this._findParentClassId(subclass);

                if (parentClassId && this._classes.has(parentClassId)) {
                    const subclassId = this._generateSubclassId(subclass);

                    // Create enriched subclass object
                    const enrichedSubclass = {
                        ...subclass,
                        id: subclassId,
                        parentClassId
                    };

                    // Add to subclasses map
                    this._subclasses.set(subclassId, enrichedSubclass);

                    // Add to parent class's subclasses array
                    const parentClass = this._classes.get(parentClassId);
                    parentClass.subclasses.push(enrichedSubclass);
                }
            }
        }
    }

    /**
     * Gets class description from raw data and fluff entries
     * @param {RawClassData} classData - Raw class data
     * @param {Array<Object>} [fluffArray] - Array of fluff entries
     * @returns {string} The class description
     * @private
     */
    _getClassDescription(classData, fluffArray) {
        // Try to find matching fluff
        if (Array.isArray(fluffArray)) {
            const fluff = fluffArray.find(f =>
                f.name === classData.name &&
                (f.source === classData.source || (!f.source && classData.source === 'PHB'))
            );

            if (fluff?.entries?.length) {
                const firstEntry = fluff.entries[0];
                if (typeof firstEntry === 'string') {
                    return firstEntry;
                }
                if (firstEntry.entries && Array.isArray(firstEntry.entries)) {
                    return firstEntry.entries[0] || '';
                }
            }
        }

        // Fall back to class description if available
        if (classData.description) {
            return classData.description;
        }

        // Return empty string if no description found
        return '';
    }

    /**
     * Gets skill proficiencies from class data
     * @param {RawClassData} classData - Raw class data
     * @returns {Array<string>} Array of skill proficiencies
     * @private
     */
    _getSkillProficiencies(classData) {
        const skills = [];

        // Check for "choose" format
        if (classData.startingProficiencies?.skills?.choose) {
            const choose = classData.startingProficiencies.skills.choose;

            // Handle number format (e.g., { choose: 2, from: [...] })
            if (typeof choose === 'number' && classData.startingProficiencies.skills.from) {
                if (Array.isArray(classData.startingProficiencies.skills.from)) {
                    return classData.startingProficiencies.skills.from;
                }
            }
            // Handle object format (e.g., { choose: { count: 2, from: [...] } })
            else if (typeof choose === 'object' && choose.from) {
                return Array.isArray(choose.from) ? choose.from : [];
            }
        }

        // Direct skills array
        if (Array.isArray(classData.startingProficiencies?.skills)) {
            return classData.startingProficiencies.skills;
        }

        // Handle older format
        if (classData.proficiency?.skillchoice) {
            if (Array.isArray(classData.proficiency.skillchoice)) {
                return classData.proficiency.skillchoice;
            }
        }

        return skills;
    }

    /**
     * Gets number of skills to choose from the proficiency list
     * @param {RawClassData} classData - Raw class data
     * @returns {number} Number of skills to choose
     * @private
     */
    _getSkillChoiceCount(classData) {
        // Handle newer format with startingProficiencies.skills.choose
        if (classData.startingProficiencies?.skills?.choose) {
            const choose = classData.startingProficiencies.skills.choose;

            // Handle number format (e.g., { choose: 2, from: [...] })
            if (typeof choose === 'number') {
                return choose;
            }
            // Handle object format (e.g., { choose: { count: 2, from: [...] } })
            if (typeof choose === 'object' && choose.count) {
                return choose.count;
            }
        }

        // Handle older format with proficiency.skillChoiceCount
        if (classData.proficiency?.skillChoiceCount !== undefined) {
            return classData.proficiency.skillChoiceCount;
        }

        // Default based on class
        // Most classes offer 2 skills, but specific classes offer more
        switch (classData.name) {
            case 'Bard': case 'Ranger': return 3;
            case 'Rogue': return 4;
            default: return 2;
        }
    }

    /**
     * Gets saving throw proficiencies from class data
     * @param {RawClassData} classData - Raw class data
     * @returns {Array<string>} Array of saving throw proficiencies
     * @private
     */
    _getSavingThrows(classData) {
        if (!classData.proficiency || !Array.isArray(classData.proficiency)) {
            return [];
        }

        // Map abbreviations to full ability names
        const abilityMap = {
            'str': 'Strength',
            'dex': 'Dexterity',
            'con': 'Constitution',
            'int': 'Intelligence',
            'wis': 'Wisdom',
            'cha': 'Charisma'
        };

        // Convert abbreviations to full names
        return classData.proficiency
            .filter(p => typeof p === 'string')
            .map(p => abilityMap[p.toLowerCase()] || p);
    }

    /**
     * Gets armor proficiencies from class data
     * @param {RawClassData} classData - Raw class data
     * @returns {Array<string>} Array of armor proficiencies
     * @private
     */
    _getArmorProficiencies(classData) {
        if (Array.isArray(classData.startingProficiencies?.armor)) {
            return classData.startingProficiencies.armor;
        }

        return [];
    }

    /**
     * Gets weapon proficiencies from class data
     * @param {RawClassData} classData - Raw class data
     * @returns {Array<string>} Array of weapon proficiencies
     * @private
     */
    _getWeaponProficiencies(classData) {
        if (Array.isArray(classData.startingProficiencies?.weapons)) {
            return classData.startingProficiencies.weapons;
        }

        return [];
    }

    /**
     * Gets tool proficiencies from class data
     * @param {RawClassData} classData - Raw class data
     * @returns {Array<string>} Array of tool proficiencies
     * @private
     */
    _getToolProficiencies(classData) {
        if (Array.isArray(classData.startingProficiencies?.tools)) {
            return classData.startingProficiencies.tools;
        }

        return [];
    }

    /**
     * Get all available classes
     * @returns {Array<Class>} Array of Class objects
     */
    getAllClasses() {
        return Array.from(this._classes.values());
    }

    /**
     * Get a specific class by name and source
     * @param {string} name - Class name
     * @param {string} source - Source book
     * @returns {Class|null} Class object or null if not found
     */
    getClass(name, source = 'PHB') {
        // Generate the correct ID format for lookup
        const classId = `${name}_${source}`;
        console.log('DEBUG getClass - Looking for class ID:', classId);

        // Get the raw class data from the map
        const rawClassData = this._classes.get(classId);

        if (!rawClassData) {
            console.debug(`Class not found: ${name} (${source})`);
            return null;
        }

        console.log('DEBUG getClass - Raw class data found:', rawClassData);
        console.log('DEBUG getClass - Raw hitDice value:', rawClassData.hd || 8);
        console.log('DEBUG getClass - Raw skillProficiencies:', this._getSkillProficiencies(rawClassData));

        // Create a Class instance from the raw data
        const classInstance = new Class({
            id: rawClassData.id,
            name: rawClassData.name,
            source: rawClassData.source,
            description: rawClassData.description || '',
            hitDice: rawClassData.hd || 8,
            skillProficiencies: this._getSkillProficiencies(rawClassData),
            skillChoiceCount: this._getSkillChoiceCount(rawClassData),
            savingThrows: this._getSavingThrows(rawClassData),
            armorProficiencies: this._getArmorProficiencies(rawClassData),
            weaponProficiencies: this._getWeaponProficiencies(rawClassData),
            toolProficiencies: this._getToolProficiencies(rawClassData),
            // Handle both "classFeature" (singular) and "classFeatures" (plural) property names from raw data
            classFeatures: rawClassData.classFeature || rawClassData.classFeatures || [],
            spellcasting: rawClassData.spellcasting || null,
            // Attach any subclasses
            subclasses: rawClassData.subclasses || []
        });

        console.log('DEBUG getClass - Created Class instance:', classInstance);
        console.log('DEBUG getClass - Instance hitDice:', classInstance.hitDice);
        console.log('DEBUG getClass - Instance getHitDice() returns:', classInstance.getHitDice());
        console.log('DEBUG getClass - Instance skillProficiencies:', classInstance.skillProficiencies);
        console.log('DEBUG getClass - Instance getSkillProficiencies() returns:', classInstance.getSkillProficiencies());

        return classInstance;
    }

    /**
     * Select a class
     * @param {string} className - Name of the class to select
     * @param {string} source - Source of the class
     * @returns {Class|null} The selected class or null if not found
     */
    selectClass(className, source = 'PHB') {
        console.log('DEBUG selectClass - Called with:', className, source);
        this._selectedClass = this.getClass(className, source);
        this._selectedSubclass = null;

        console.log('DEBUG selectClass - Selected class:', this._selectedClass);

        if (this._selectedClass) {
            console.log('DEBUG selectClass - About to emit class:selected event');
            eventEmitter.emit('class:selected', this._selectedClass);
            console.log('DEBUG selectClass - Event emitted');
        }

        return this._selectedClass;
    }

    /**
     * Select a subclass for the currently selected class
     * @param {string} subclassName - Name of the subclass to select
     * @returns {Object|null} The selected subclass or null if not found
     */
    selectSubclass(subclassName) {
        if (!this._selectedClass || !Array.isArray(this._selectedClass.subclasses)) {
            return null;
        }

        this._selectedSubclass = this._selectedClass.subclasses.find(sc =>
            sc.name === subclassName || sc.shortName === subclassName
        ) || null;

        if (this._selectedSubclass) {
            eventEmitter.emit('subclass:selected', this._selectedSubclass);
        }

        return this._selectedSubclass;
    }

    /**
     * Get the currently selected class
     * @returns {Class|null} Currently selected class
     */
    getSelectedClass() {
        return this._selectedClass;
    }

    /**
     * Get the currently selected subclass
     * @returns {Object|null} Currently selected subclass
     */
    getSelectedSubclass() {
        return this._selectedSubclass;
    }

    /**
     * Gets the hit dice size
     * @param {Class|Object} classData - Class data or Class instance
     * @returns {string} Hit dice size (d6, d8, d10, or d12)
     */
    getFormattedHitDie(classData) {
        console.log('DEBUG getFormattedHitDie - Input:', classData);
        console.log('DEBUG getFormattedHitDie - Type:', typeof classData);
        console.log('DEBUG getFormattedHitDie - Is Class instance?', classData instanceof Class);
        console.log('DEBUG getFormattedHitDie - Has getHitDice method?', typeof classData?.getHitDice === 'function');
        console.log('DEBUG getFormattedHitDie - hitDice property:', classData?.hitDice);
        console.log('DEBUG getFormattedHitDie - hd property:', classData?.hd);

        if (!classData) {
            console.log('DEBUG getFormattedHitDie - No classData, returning d8');
            return 'd8';
        }

        // Handle Class instance
        if (classData && typeof classData.getHitDice === 'function') {
            const hitDice = classData.getHitDice();

            // If hitDice is an object with faces property
            if (hitDice && typeof hitDice === 'object' && hitDice.faces) {
                const result = `d${hitDice.faces}`;
                console.log('DEBUG getFormattedHitDie - Using hitDice.faces, result:', result);
                return result;
            }

            // If hitDice is a number
            if (typeof hitDice === 'number') {
                const result = `d${hitDice}`;
                console.log('DEBUG getFormattedHitDie - Using hitDice number, result:', result);
                return result;
            }
        }

        // Handle raw class data
        let hitDie = classData.hitDice || classData.hd || 8;

        // If hitDie is an object with faces
        if (hitDie && typeof hitDie === 'object') {
            hitDie = hitDie.faces || 8;
        }

        const result = `d${hitDie}`;
        console.log('DEBUG getFormattedHitDie - Using parsed value, result:', result);
        return result;
    }

    /**
     * Get formatted skill proficiencies string
     * @param {Class|Object} classData - Class data or Class instance
     * @returns {string} Formatted skill proficiencies
     */
    getFormattedSkillProficiencies(classData) {
        console.log('DEBUG getFormattedSkillProficiencies - Input:', classData);
        console.log('DEBUG getFormattedSkillProficiencies - Type:', typeof classData);
        console.log('DEBUG getFormattedSkillProficiencies - Is Class instance?', classData instanceof Class);
        console.log('DEBUG getFormattedSkillProficiencies - Has getSkillProficiencies method?', typeof classData?.getSkillProficiencies === 'function');
        console.log('DEBUG getFormattedSkillProficiencies - Has getSkillChoiceCount method?', typeof classData?.getSkillChoiceCount === 'function');
        console.log('DEBUG getFormattedSkillProficiencies - skillProficiencies property:', classData?.skillProficiencies);

        if (!classData) {
            console.log('DEBUG getFormattedSkillProficiencies - No classData, returning None');
            return 'None';
        }

        let skills = [];
        let count = 2;
        let anySkills = false;

        // Handle Class instance
        if (typeof classData.getSkillProficiencies === 'function') {
            const rawSkills = classData.getSkillProficiencies();
            console.log('DEBUG getFormattedSkillProficiencies - Raw skills from method:', rawSkills);

            // Check for "any" skill format
            if (Array.isArray(rawSkills) && rawSkills.length === 1 && typeof rawSkills[0] === 'object' && rawSkills[0].any !== undefined) {
                anySkills = true;
                count = rawSkills[0].any || 2;
                skills = ["any skill"];
                console.log('DEBUG getFormattedSkillProficiencies - Found "any" skill format with count:', count);
            } else {
                // Process the skills - extract names if they're objects
                if (Array.isArray(rawSkills)) {
                    skills = extractSkillNames(rawSkills);
                    // Check if skills array contains "any skill" indicator
                    if (skills.length === 1 && skills[0] === "any skill") {
                        anySkills = true;
                    }
                }
                console.log('DEBUG getFormattedSkillProficiencies - Processed skills:', skills);

                if (!anySkills && typeof classData.getSkillChoiceCount === 'function') {
                    count = classData.getSkillChoiceCount() || 2;
                    console.log('DEBUG getFormattedSkillProficiencies - Count from method:', count);
                }
            }
        }
        // Handle raw class data
        else {
            const rawSkills = this._getSkillProficiencies(classData);
            console.log('DEBUG getFormattedSkillProficiencies - Raw skills from _getSkillProficiencies:', rawSkills);

            // Check for "any" skill format
            if (Array.isArray(rawSkills) && rawSkills.length === 1 && typeof rawSkills[0] === 'object' && rawSkills[0].any !== undefined) {
                anySkills = true;
                count = rawSkills[0].any || 2;
                skills = ["any skill"];
                console.log('DEBUG getFormattedSkillProficiencies - Found "any" skill format with count:', count);
            } else {
                // Process the skills - extract names if they're objects
                if (Array.isArray(rawSkills)) {
                    skills = extractSkillNames(rawSkills);
                    // Check if skills array contains "any skill" indicator
                    if (skills.length === 1 && skills[0] === "any skill") {
                        anySkills = true;
                    }
                }
                console.log('DEBUG getFormattedSkillProficiencies - Processed skills:', skills);

                if (!anySkills) {
                    count = this._getSkillChoiceCount(classData) || 2;
                    console.log('DEBUG getFormattedSkillProficiencies - Count from _getSkillChoiceCount:', count);
                }
            }
        }

        if (!skills || !skills.length) {
            console.log('DEBUG getFormattedSkillProficiencies - No skills, returning None');
            return 'None';
        }

        // Special handling for "any skill" case
        if (anySkills) {
            const result = `Choose any ${count} skills`;
            console.log('DEBUG getFormattedSkillProficiencies - Final result (any skills):', result);
            return result;
        }

        const result = `Choose ${count} from: ${skills.join(', ')}`;
        console.log('DEBUG getFormattedSkillProficiencies - Final result:', result);
        return result;

        // Helper function to extract skill names from various data structures
        function extractSkillNames(skillsArray) {
            if (!Array.isArray(skillsArray)) return [];

            let extractedSkills = [];

            for (const skill of skillsArray) {
                // Case 1: Plain string
                if (typeof skill === 'string') {
                    extractedSkills.push(skill);
                    continue;
                }

                // Case 2: Object with 'choose' property containing a 'from' array
                if (skill && typeof skill === 'object') {
                    // Handle {"any": X} format - means any X skills
                    if (skill.any !== undefined) {
                        return ["any skill"];
                    }

                    if (skill.choose && Array.isArray(skill.choose.from)) {
                        extractedSkills = extractedSkills.concat(skill.choose.from);
                        continue;
                    }

                    // Case 3: Object with direct 'from' array
                    if (Array.isArray(skill.from)) {
                        extractedSkills = extractedSkills.concat(skill.from);
                        continue;
                    }

                    // Case 4: Object with name property
                    if (skill.name) {
                        extractedSkills.push(skill.name);
                        continue;
                    }

                    // Case 5: Object with skillName property
                    if (skill.skillName) {
                        extractedSkills.push(skill.skillName);
                        continue;
                    }

                    // Default: Convert to string as fallback
                    try {
                        console.log('DEBUG extractSkillNames - Unhandled skill format:', skill);
                        extractedSkills.push(JSON.stringify(skill));
                    } catch (e) {
                        extractedSkills.push(String(skill));
                    }
                }
            }

            return extractedSkills;
        }
    }

    /**
     * Get formatted saving throws string
     * @param {Class} classData - Class data
     * @returns {string} Formatted saving throws
     */
    getFormattedSavingThrows(classData) {
        if (!classData || !classData.savingThrows || !classData.savingThrows.length) {
            return 'None';
        }

        return classData.savingThrows.join(', ');
    }

    /**
     * Get formatted armor proficiencies string
     * @param {Class} classData - Class data
     * @returns {string} Formatted armor proficiencies
     */
    getFormattedArmorProficiencies(classData) {
        if (!classData || !classData.armorProficiencies || !classData.armorProficiencies.length) {
            return 'None';
        }

        return classData.armorProficiencies.join(', ');
    }

    /**
     * Get formatted weapon proficiencies string
     * @param {Class} classData - Class data
     * @returns {string} Formatted weapon proficiencies
     */
    getFormattedWeaponProficiencies(classData) {
        if (!classData || !classData.weaponProficiencies || !classData.weaponProficiencies.length) {
            return 'None';
        }

        return classData.weaponProficiencies.join(', ');
    }

    /**
     * Get formatted tool proficiencies string
     * @param {Class} classData - Class data
     * @returns {string} Formatted tool proficiencies
     */
    getFormattedToolProficiencies(classData) {
        if (!classData || !classData.toolProficiencies || !classData.toolProficiencies.length) {
            return 'None';
        }

        return classData.toolProficiencies.join(', ');
    }

    /**
     * Generates a unique class ID
     * @param {Object} classItem - Class data object
     * @returns {string} Unique class identifier
     * @private
     */
    _generateClassId(classItem) {
        return `${classItem.name}_${(classItem.source || 'PHB')}`;
    }

    /**
     * Generates a unique subclass ID
     * @param {Object} subclass - Subclass data object
     * @returns {string} Unique subclass identifier
     * @private
     */
    _generateSubclassId(subclass) {
        return `${subclass.className}_${subclass.name}_${(subclass.source || 'PHB')}`;
    }

    /**
     * Finds the parent class ID for a subclass
     * @param {Object} subclass - Subclass data object
     * @returns {string|null} Parent class ID or null if not found
     * @private
     */
    _findParentClassId(subclass) {
        if (!subclass.className) return null;

        // Try to find with exact class source
        const classSource = subclass.classSource || 'PHB';
        const classId = `${subclass.className}_${classSource}`;

        // If classes has this ID, return it
        if (this._classes.has(classId)) {
            return classId;
        }

        // Otherwise, try to find a class with the same name but different source
        for (const [id, classData] of this._classes.entries()) {
            if (classData.name === subclass.className) {
                return id;
            }
        }

        return null;
    }
}

// Create and export singleton instance
export const classManager = new ClassManager(); 