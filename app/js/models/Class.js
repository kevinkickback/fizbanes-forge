/**
 * Class.js
 * Model class for character classes
 */
export class Class {
    /**
     * Creates a new Class instance
     * @param {Object} data - Class data
     */
    constructor(data = {}) {
        this.id = data.id || `${data.name}_${data.source || 'PHB'}`;
        this.name = data.name || '';
        this.source = data.source || 'PHB';
        this.level = data.level || 1;
        this.description = data.description || '';
        this.hitDice = data.hitDice || 8;

        // Proficiencies
        this.skillProficiencies = data.skillProficiencies || [];
        this.skillChoiceCount = data.skillChoiceCount || 0;
        this.savingThrows = data.savingThrows || [];
        this.armorProficiencies = data.armorProficiencies || [];
        this.weaponProficiencies = data.weaponProficiencies || [];
        this.toolProficiencies = data.toolProficiencies || [];

        // Features and spellcasting
        this.classFeatures = data.classFeatures || []; // Detailed feature objects
        this.spellcasting = data.spellcasting || null;
        this.spellcastingType = data.spellcastingType || null;

        // Subclasses and equipment
        this.subclasses = data.subclasses || [];
        this.startingEquipment = data.startingEquipment || {};
        this.multiclassing = data.multiclassing || {};
    }

    // Core getters
    getHitDice() {
        return this.hitDice;
    }

    getDescription() {
        return this.description;
    }

    getSkillProficiencies() {
        return this.skillProficiencies;
    }

    getSkillChoiceCount() {
        return this.skillChoiceCount;
    }

    getSavingThrows() {
        return this.savingThrows;
    }

    getArmorProficiencies() {
        return this.armorProficiencies;
    }

    getWeaponProficiencies() {
        return this.weaponProficiencies;
    }

    getToolProficiencies() {
        return this.toolProficiencies;
    }

    getSubclasses() {
        return this.subclasses;
    }

    /**
     * Get features for a specific level
     * @param {number|null} level - Level to get features for, or null for all features
     * @returns {Array} Array of feature objects
     */
    getFeatures(level = null) {
        // Keep only essential debug logs
        console.debug(`[Class] Getting features for ${this.name}${level ? ` at level ${level}` : ''}`);

        // Only use detailed class features
        if (!this.classFeatures || this.classFeatures.length === 0) {
            console.debug(`[Class] No detailed features found for ${this.name}`);
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
        console.debug(`[Class] Found ${filteredFeatures.length} features for ${this.name} at level ${level}`);
        return filteredFeatures;
    }

    /**
     * Get a detailed feature by name
     * @param {string} name - The name of the feature
     * @returns {Object|null} The detailed feature or null if not found
     */
    getDetailedFeature(name) {
        if (!this.classFeatures || !this.classFeatures.length) {
            return null;
        }

        return this.classFeatures.find(f => f.name === name) || null;
    }

    getSpellcasting() {
        return this.spellcasting;
    }

    // Equipment methods
    getStartingEquipment() {
        return this.startingEquipment;
    }

    getStartingEquipmentOptions() {
        return this.startingEquipment.options || [];
    }

    // Multiclassing methods
    getMulticlassingRequirements() {
        return this.multiclassing.requirements || {};
    }

    getMulticlassingProficiencies() {
        return this.multiclassing.proficiencies || {};
    }

    // Feature management
    hasFeatureAtLevel(featureName, level) {
        return this.getFeatures(level).some(f =>
            f.features.some(feat => feat.name === featureName)
        );
    }

    getFeatureByName(featureName) {
        for (const levelFeatures of this.features) {
            const found = levelFeatures.features.find(f => f.name === featureName);
            if (found) return found;
        }
        return null;
    }

    // Spellcasting methods
    canCastSpells() {
        return this.spellcasting !== null;
    }

    getSpellcastingAbility() {
        return this.spellcasting?.ability || null;
    }

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
            subclasses: this.subclasses
        };
    }
} 