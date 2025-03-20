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
 * @property {Array<string>} primaryAbility - Primary ability score abbreviations
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

let instance = null;

export class ClassManager {
    /**
     * Creates a new ClassManager instance.
     * Private constructor enforcing the singleton pattern.
     * @throws {Error} If trying to instantiate more than once
     */
    constructor() {
        if (instance) {
            throw new Error('ClassManager is a singleton. Use ClassManager.getInstance() instead.');
        }
        instance = this;

        this.classes = new Map();
        this.subclasses = new Map();
        this.selectedClass = null;
        this.selectedSubclass = null;
    }

    /**
     * Gets the singleton instance of ClassManager
     * @returns {ClassManager} The singleton instance
     * @static
     */
    static getInstance() {
        if (!instance) {
            instance = new ClassManager();
        }
        return instance;
    }

    /**
     * Initialize class data by loading and processing class information
     * @returns {Promise<boolean>} Promise resolving to true if initialization succeeded, false otherwise
     */
    async initialize() {
        try {
            const classData = await dataLoader.loadClasses();
            this.processClassData(classData);
            return true;
        } catch (error) {
            console.error('Failed to initialize class data:', error);
            return false;
        }
    }

    /**
     * Process raw class data into standardized format
     * @param {Object} classData - Raw class data from the data loader
     * @param {Array<RawClassData>} classData.class - Array of raw class data
     * @param {Array<RawSubclassData>} [classData.subclass] - Array of raw subclass data
     * @param {Array<Object>} [classData.fluff] - Array of descriptive fluff text for classes
     */
    processClassData(classData) {
        // Initialize collections
        this.classes = new Map();

        if (!classData || !classData.class || !Array.isArray(classData.class)) {
            console.error('Invalid class data structure', classData);
            return;
        }

        // Process each class
        for (const rawClass of classData.class) {
            try {
                // Create standardized class object
                const processedClass = {
                    id: `${rawClass.name}_${rawClass.source || 'PHB'}`,
                    name: rawClass.name,
                    source: rawClass.source || 'PHB',
                    description: this.getClassDescription(rawClass, classData.fluff),
                    hitDice: rawClass.hd?.faces || rawClass.hd || 8, // Support both formats
                    primaryAbility: this.getPrimaryAbility(rawClass),
                    savingThrows: this.getSavingThrows(rawClass),
                    armorProficiencies: this.getArmorProficiencies(rawClass),
                    weaponProficiencies: this.getWeaponProficiencies(rawClass),
                    toolProficiencies: this.getToolProficiencies(rawClass),
                    subclasses: [],
                    features: []
                };

                // Store in map for quick access
                this.classes.set(processedClass.id, processedClass);
            } catch (error) {
                console.error(`Error processing class ${rawClass.name}:`, error);
            }
        }

        // Process subclasses if available
        if (classData.subclass && Array.isArray(classData.subclass)) {
            for (const rawSubclass of classData.subclass) {
                try {
                    const classId = `${rawSubclass.className}_${rawSubclass.classSource || 'PHB'}`;
                    const parentClass = this.classes.get(classId);

                    if (parentClass) {
                        // Create standardized subclass object
                        const processedSubclass = new Subclass(
                            rawSubclass.name,
                            rawSubclass.source || 'PHB',
                            rawSubclass.shortName || rawSubclass.name
                        );

                        // Add to parent class
                        parentClass.subclasses.push(processedSubclass);
                    }
                } catch (error) {
                    console.error(`Error processing subclass ${rawSubclass.name}:`, error);
                }
            }
        }

        console.log('Processed class data:', this.classes);
    }

    /**
     * Gets class description from raw data and fluff entries
     * @param {RawClassData} classData - Raw class data
     * @param {Array<Object>} [fluffArray] - Array of fluff entries
     * @returns {string} The class description
     */
    getClassDescription(classData, fluffArray) {
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

        // Fallback to entries in the class data
        if (classData.entries?.length) {
            const firstEntry = classData.entries[0];
            if (typeof firstEntry === 'string') {
                return firstEntry;
            }
            if (firstEntry.entries && Array.isArray(firstEntry.entries)) {
                return firstEntry.entries[0] || '';
            }
        }

        return `The ${classData.name} class.`;
    }

    /**
     * Extracts primary abilities for a class
     * @param {RawClassData} classData - Raw class data
     * @returns {string[]} Array of primary ability abbreviations
     */
    getPrimaryAbility(classData) {
        // For simplicity, using a mapping of classes to their primary abilities
        const classAbilities = {
            'barbarian': ['str'],
            'bard': ['cha'],
            'cleric': ['wis'],
            'druid': ['wis'],
            'fighter': ['str', 'dex'],
            'monk': ['dex', 'wis'],
            'paladin': ['str', 'cha'],
            'ranger': ['dex', 'wis'],
            'rogue': ['dex'],
            'sorcerer': ['cha'],
            'warlock': ['cha'],
            'wizard': ['int'],
            'artificer': ['int']
        };

        const className = classData.name.toLowerCase();
        return classAbilities[className] || [];
    }

    /**
     * Extracts saving throw proficiencies from class data
     * @param {RawClassData} classData - Raw class data
     * @returns {string[]} Array of saving throw names (full names, not abbreviations)
     */
    getSavingThrows(classData) {
        // Extract saving throws from proficiency array
        if (!classData.proficiency) return [];

        const abilityMap = {
            'str': 'Strength',
            'dex': 'Dexterity',
            'con': 'Constitution',
            'int': 'Intelligence',
            'wis': 'Wisdom',
            'cha': 'Charisma'
        };

        return classData.proficiency.map(p => abilityMap[p] || p);
    }

    /**
     * Extracts armor proficiencies from class data
     * @param {RawClassData} classData - Raw class data
     * @returns {string[]} Array of armor proficiency names
     */
    getArmorProficiencies(classData) {
        if (!classData.startingProficiencies?.armor) return [];

        return classData.startingProficiencies.armor.map(armor => {
            if (typeof armor === 'string') return armor;
            return armor.proficiency || armor.name || '';
        }).filter(Boolean);
    }

    /**
     * Extracts weapon proficiencies from class data
     * @param {RawClassData} classData - Raw class data
     * @returns {string[]} Array of weapon proficiency names
     */
    getWeaponProficiencies(classData) {
        if (!classData.startingProficiencies?.weapons) return [];

        return classData.startingProficiencies.weapons.map(weapon => {
            if (typeof weapon === 'string') return weapon;
            return weapon.proficiency || weapon.name || '';
        }).filter(Boolean);
    }

    /**
     * Extracts tool proficiencies from class data
     * @param {RawClassData} classData - Raw class data
     * @returns {string[]} Array of tool proficiency names
     */
    getToolProficiencies(classData) {
        if (!classData.startingProficiencies?.tools) return [];

        return classData.startingProficiencies.tools.map(tool => {
            if (typeof tool === 'string') return tool;
            return tool.proficiency || tool.name || '';
        }).filter(Boolean);
    }

    /**
     * Get all available classes
     * @returns {Array<ProcessedClass>} Array of all processed classes
     */
    getAllClasses() {
        return Array.from(this.classes.values());
    }

    /**
     * Get class by name and source
     * @param {string} name - Class name
     * @param {string} [source='PHB'] - Class source book
     * @returns {ProcessedClass|null} Class object or null if not found
     */
    getClass(name, source = 'PHB') {
        return this.classes.get(`${name}_${source}`) || null;
    }

    /**
     * Select a class by name and source
     * @param {string} className - Name of the class
     * @param {string} [source='PHB'] - Source book of the class
     * @returns {ProcessedClass|null} The selected class or null if not found
     */
    selectClass(className, source = 'PHB') {
        this.selectedClass = this.getClass(className, source);
        this.selectedSubclass = null; // Reset subclass when changing class
        return this.selectedClass;
    }

    /**
     * Select a subclass by name
     * @param {string} subclassName - Name of the subclass
     * @returns {ProcessedSubclass|null} The selected subclass or null if not found
     */
    selectSubclass(subclassName) {
        if (!this.selectedClass || !this.selectedClass.subclasses) {
            return null;
        }

        this.selectedSubclass = this.selectedClass.subclasses.find(
            subclass => subclass.name === subclassName
        );

        return this.selectedSubclass;
    }

    /**
     * Get the currently selected class
     * @returns {ProcessedClass|null} The selected class or null if none selected
     */
    getSelectedClass() {
        return this.selectedClass;
    }

    /**
     * Get the currently selected subclass
     * @returns {ProcessedSubclass|null} The selected subclass or null if none selected
     */
    getSelectedSubclass() {
        return this.selectedSubclass;
    }

    /**
     * Get formatted hit die string for display
     * @param {ProcessedClass} classData - The class data
     * @returns {string} Formatted hit die string (e.g., "d8")
     */
    getFormattedHitDie(classData) {
        if (!classData) return '';
        return `d${classData.hitDice}`;
    }

    /**
     * Get formatted primary ability string for display
     * @param {ProcessedClass} classData - The class data
     * @returns {string} Formatted primary ability string
     */
    getFormattedPrimaryAbility(classData) {
        if (!classData || !classData.primaryAbility?.length) return 'None';
        return classData.primaryAbility.join(', ');
    }

    /**
     * Get formatted saving throws string for display
     * @param {ProcessedClass} classData - The class data
     * @returns {string} Formatted saving throws string
     */
    getFormattedSavingThrows(classData) {
        if (!classData || !classData.savingThrows?.length) return 'None';
        return classData.savingThrows.join(', ');
    }

    /**
     * Get formatted armor proficiencies string for display
     * @param {ProcessedClass} classData - The class data
     * @returns {string} Formatted armor proficiencies string
     */
    getFormattedArmorProficiencies(classData) {
        if (!classData || !classData.armorProficiencies?.length) return 'None';
        return classData.armorProficiencies.join(', ');
    }

    /**
     * Get formatted weapon proficiencies string for display
     * @param {ProcessedClass} classData - The class data
     * @returns {string} Formatted weapon proficiencies string
     */
    getFormattedWeaponProficiencies(classData) {
        if (!classData || !classData.weaponProficiencies?.length) return 'None';
        return classData.weaponProficiencies.join(', ');
    }

    /**
     * Get formatted tool proficiencies string for display
     * @param {ProcessedClass} classData - The class data
     * @returns {string} Formatted tool proficiencies string
     */
    getFormattedToolProficiencies(classData) {
        if (!classData || !classData.toolProficiencies?.length) return 'None';
        return classData.toolProficiencies.join(', ');
    }
}

/**
 * Export the singleton instance
 * @type {ClassManager}
 */
export const classManager = ClassManager.getInstance(); 