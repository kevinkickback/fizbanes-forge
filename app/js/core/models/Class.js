export class Class {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.source = data.source;
        this.hitDice = data.hitDice;
        this.proficiencies = data.proficiencies || {};
        this.features = data.features || [];
        this.spellcasting = data.spellcasting || null;
        this.subclasses = data.subclasses || [];
        this.startingEquipment = data.startingEquipment || {};
        this.multiclassing = data.multiclassing || {};
        this.description = data.description || '';
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
        const progression = this.spellcasting.progression || [];
        const levelData = progression.find(p => p.level === level);
        return levelData?.slots || {};
    }
} 