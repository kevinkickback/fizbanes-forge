import { characterInitializer } from '../utils/Initialize.js';

export class Class {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.source = data.source;
        this.level = data.level || 1;
        this.spellcastingType = data.spellcasting?.type;
        this.spellcastingService = characterInitializer.spellcastingService;
        this.hitDice = data.hitDice;
        this.proficiencies = data.proficiencies || {};
        this.features = data.features || [];
        this.spellcasting = data.spellcasting || null;
        this.subclasses = data.subclasses || [];
        this.startingEquipment = data.startingEquipment || {};
        this.multiclassing = data.multiclassing || {};
        this.description = data.description || '';
    }

    calculateSpellSlots(level) {
        return this.spellcastingService.calculateSpellSlots(level, this.spellcastingType);
    }

    // Core getters
    getHitDice() {
        return this.hitDice;
    }

    getProficiencies() {
        return this.proficiencies;
    }

    getFeatures(level = null) {
        if (level === null) {
            return this.features;
        }
        return this.features.filter(f => f.level === level);
    }

    getSpellcasting() {
        return this.spellcasting;
    }

    getSubclasses() {
        return this.subclasses;
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

    getSpellsKnownLevel(level) {
        if (!this.canCastSpells()) return 0;
        const progression = this.spellcasting.progression || [];
        return progression.find(p => p.level === level)?.spellsKnown || 0;
    }

    getSpellSlots(level) {
        if (!this.canCastSpells()) return {};

        // Use SpellcastingService for calculations
        return this.calculateSpellSlots(level);
    }

    getSpellcastingType() {
        if (!this.spellcasting) return null;

        // Determine spellcasting type based on class
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
} 