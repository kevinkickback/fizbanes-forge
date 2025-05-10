/**
 * Class.js
 * Model class representing a character class in the D&D Character Creator
 */

/**
 * Represents a character class with its features, proficiencies, and spellcasting abilities
 */
export class Class {
    /**
     * Creates a new Class instance
     * @param {Object} data - Class data
     */
    constructor(data = {}) {
        /**
         * Unique identifier for the class
         * @type {string}
         */
        this.id = data.id || `${data.name}_${data.source || 'PHB'}`;

        /**
         * Name of the class
         * @type {string}
         */
        this.name = data.name || '';

        /**
         * Source book for the class
         * @type {string}
         */
        this.source = data.source || 'PHB';

        /**
         * Current level in this class
         * @type {number}
         */
        this.level = data.level || 1;

        /**
         * Class description
         * @type {string}
         */
        this.description = data.description || '';

        /**
         * Hit dice size (d6, d8, d10, d12)
         * @type {number}
         */
        this.hitDice = data.hitDice || 8;

        /**
         * Available skill proficiencies
         * @type {Array}
         */
        this.skillProficiencies = data.skillProficiencies || [];

        /**
         * Number of skills that can be chosen
         * @type {number}
         */
        this.skillChoiceCount = data.skillChoiceCount || 0;

        /**
         * Saving throw proficiencies
         * @type {Array}
         */
        this.savingThrows = data.savingThrows || [];

        /**
         * Armor proficiencies
         * @type {Array}
         */
        this.armorProficiencies = data.armorProficiencies || [];

        /**
         * Weapon proficiencies
         * @type {Array}
         */
        this.weaponProficiencies = data.weaponProficiencies || [];

        /**
         * Tool proficiencies
         * @type {Array}
         */
        this.toolProficiencies = data.toolProficiencies || [];

        /**
         * Class features by level
         * @type {Array}
         */
        this.classFeatures = data.classFeatures || [];

        /**
         * Spellcasting information
         * @type {Object|null}
         */
        this.spellcasting = data.spellcasting || null;

        /**
         * Type of spellcaster (full, half, third, etc.)
         * @type {string|null}
         */
        this.spellcastingType = data.spellcastingType || null;

        /**
         * Available subclasses
         * @type {Array}
         */
        this.subclasses = data.subclasses || [];

        /**
         * Starting equipment options
         * @type {Object}
         */
        this.startingEquipment = data.startingEquipment || {};

        /**
         * Multiclassing requirements and proficiencies
         * @type {Object}
         */
        this.multiclassing = data.multiclassing || {};
    }

    /**
     * Gets the hit dice size
     * @returns {number} Hit dice size (6, 8, 10, or 12)
     */
    getHitDice() {
        return this.hitDice;
    }

    /**
     * Gets the class description
     * @returns {string} Class description
     */
    getDescription() {
        return this.description;
    }

    /**
     * Gets available skill proficiencies
     * @returns {Array} Array of available skill proficiencies
     */
    getSkillProficiencies() {
        return this.skillProficiencies;
    }

    /**
     * Gets the number of skills that can be chosen
     * @returns {number} Skill choice count
     */
    getSkillChoiceCount() {
        return this.skillChoiceCount;
    }

    /**
     * Gets saving throw proficiencies
     * @returns {Array} Array of saving throw proficiencies
     */
    getSavingThrows() {
        return this.savingThrows;
    }

    /**
     * Gets armor proficiencies
     * @returns {Array} Array of armor proficiencies
     */
    getArmorProficiencies() {
        // Process the stored array to extract proficiency names
        return (this.armorProficiencies || []).map(prof => {
            if (typeof prof === 'string') {
                return prof; // Return strings directly
            }
            if (typeof prof === 'object' && prof !== null && prof.proficiency) {
                // For objects like { proficiency: "shield", ... }, return the proficiency value
                return prof.proficiency;
            }
            // Log unexpected format and return null for filtering
            console.warn('Unexpected armor proficiency format:', prof);
            return null;
        }).filter(prof => prof !== null); // Filter out any null results
    }

    /**
     * Gets weapon proficiencies
     * @returns {Array} Array of weapon proficiencies
     */
    getWeaponProficiencies() {
        return this.weaponProficiencies;
    }

    /**
     * Gets tool proficiencies
     * @returns {Array} Array of tool proficiencies
     */
    getToolProficiencies() {
        return this.toolProficiencies;
    }


    /**
     * Gets available subclasses
     * @returns {Array} Array of subclass objects
     */
    getSubclasses() {
        return this.subclasses;
    }


    /**
     * Gets features for a specific level
     * @param {number|null} level - Level to get features for, or null for all features
     * @returns {Array} Array of feature objects
     */
    getFeatures(level = null) {
        console.debug(`Getting features for ${this.name}${level ? ` at level ${level}` : ''}`);

        // Only use detailed class features
        if (!this.classFeatures || this.classFeatures.length === 0) {
            console.debug(`No detailed features found for ${this.name}`);
            return [];
        }

        // Filter features by class source
        const sourceFilteredFeatures = this.classFeatures.filter(feature =>
            feature.className === this.name &&
            (feature.classSource === this.source || feature.source === this.source)
        );

        if (level === null) {
            return sourceFilteredFeatures;
        }

        // Filter features to the specific level
        const filteredFeatures = sourceFilteredFeatures.filter(feature => feature.level === level);
        console.debug(`Found ${filteredFeatures.length} features for ${this.name} at level ${level}`);
        return filteredFeatures;
    }

    /**
     * Gets a detailed feature by name
     * @param {string} name - The name of the feature
     * @returns {Object|null} The detailed feature or null if not found
     */
    getDetailedFeature(name) {
        if (!this.classFeatures || !this.classFeatures.length) {
            return null;
        }

        return this.classFeatures.find(f => f.name === name) || null;
    }

    /**
     * Checks if a specific feature is available at a given level
     * @param {string} featureName - Name of the feature to check
     * @param {number} level - Level to check
     * @returns {boolean} Whether the feature is available
     */
    hasFeatureAtLevel(featureName, level) {
        return this.getFeatures(level).some(f =>
            f.features.some(feat => feat.name === featureName)
        );
    }

    /**
     * Gets a feature by name
     * @param {string} featureName - Name of the feature to find
     * @returns {Object|null} The feature or null if not found
     */
    getFeatureByName(featureName) {
        for (const levelFeatures of this.features) {
            const found = levelFeatures.features.find(f => f.name === featureName);
            if (found) return found;
        }
        return null;
    }


    /**
     * Gets spellcasting information
     * @returns {Object|null} Spellcasting information or null if not a spellcaster
     */
    getSpellcasting() {
        return this.spellcasting;
    }

    /**
     * Checks if this class can cast spells
     * @returns {boolean} Whether the class can cast spells
     */
    canCastSpells() {
        return this.spellcasting !== null;
    }

    /**
     * Gets the spellcasting ability
     * @returns {string|null} Spellcasting ability or null if not a spellcaster
     */
    getSpellcastingAbility() {
        return this.spellcasting?.ability || null;
    }

    /**
     * Gets the spellcasting type (full, half, third)
     * @returns {string|null} Spellcasting type or null if not a spellcaster
     */
    getSpellcastingType() {
        if (!this.spellcasting) return null;

        switch (this.name.toLowerCase()) {
            case 'paladin':
            case 'ranger':
                return 'half';
            case 'fighter': // Eldritch Knight
            case 'rogue':  // Arcane Trickster
                return this.subclass?.spellcasting ? 'third' : null;
            case 'artificer':
                return 'artificer';
            case 'wizard':
            case 'sorcerer':
            case 'bard':
            case 'cleric':
            case 'druid':
                return 'full';
            default:
                return null;
        }
    }

    /**
     * Gets starting equipment
     * @returns {Object} Starting equipment information
     */
    getStartingEquipment() {
        return this.startingEquipment;
    }

    /**
     * Gets starting equipment options
     * @returns {Array} Array of equipment options
     */
    getStartingEquipmentOptions() {
        return this.startingEquipment.options || [];
    }


    /**
     * Gets multiclassing requirements
     * @returns {Object} Multiclassing requirement information
     */
    getMulticlassingRequirements() {
        return this.multiclassing.requirements || {};
    }

    /**
     * Gets proficiencies gained when multiclassing into this class
     * @returns {Object} Multiclassing proficiency information
     */
    getMulticlassingProficiencies() {
        return this.multiclassing.proficiencies || {};
    }


    /**
     * Serializes the class to JSON
     * @returns {Object} JSON representation of the class
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            source: this.source,
            level: this.level,
            description: this.description,
            hitDice: this.hitDice,
            skillProficiencies: this.skillProficiencies,
            skillChoiceCount: this.skillChoiceCount,
            savingThrows: this.savingThrows,
            armorProficiencies: this.armorProficiencies,
            weaponProficiencies: this.weaponProficiencies,
            toolProficiencies: this.toolProficiencies,
            classFeatures: this.classFeatures,
            spellcasting: this.spellcasting,
            subclasses: this.subclasses,
            startingEquipment: this.startingEquipment,
            multiclassing: this.multiclassing
        };
    }

    /**
     * Returns a string representation of the class
     * @returns {string} String representation
     */
    toString() {
        return `${this.name} (${this.source})`;
    }
} 