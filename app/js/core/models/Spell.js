export class Spell {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.source = data.source;
        this.level = data.level;
        this.school = data.school;
        this.time = data.time;
        this.range = data.range;
        this.components = data.components;
        this.duration = data.duration;
        this.description = data.description;
        this.classes = data.classes || [];
        this.ritual = data.ritual || false;
        this.concentration = data.concentration || false;
        this.material = data.material || null;
        this.higherLevels = data.higherLevels || null;
    }

    // Basic getters
    getName() {
        return this.name;
    }

    getLevel() {
        return this.level;
    }

    getSchool() {
        return this.school;
    }

    // Casting information
    getCastingTime() {
        return this.time;
    }

    getRange() {
        return this.range;
    }

    getComponents() {
        return this.components;
    }

    getDuration() {
        return this.duration;
    }

    // Spell properties
    isRitual() {
        return this.ritual;
    }

    requiresConcentration() {
        return this.concentration;
    }

    getMaterialComponents() {
        return this.material;
    }

    getHigherLevelEffects() {
        return this.higherLevels;
    }

    // Class availability
    isAvailableToClass(className) {
        return this.classes.includes(className);
    }

    getAvailableClasses() {
        return this.classes;
    }

    // Component checks
    requiresVerbalComponent() {
        return this.components.includes('V');
    }

    requiresSomaticComponent() {
        return this.components.includes('S');
    }

    requiresMaterialComponent() {
        return this.components.includes('M');
    }

    // Utility methods
    toString() {
        return `${this.name} (Level ${this.level} ${this.school})`;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            source: this.source,
            level: this.level,
            school: this.school,
            time: this.time,
            range: this.range,
            components: this.components,
            duration: this.duration,
            description: this.description,
            classes: this.classes,
            ritual: this.ritual,
            concentration: this.concentration,
            material: this.material,
            higherLevels: this.higherLevels
        };
    }

    // Spell comparison
    equals(other) {
        if (!(other instanceof Spell)) return false;
        return this.id === other.id && this.source === other.source;
    }

    // Validation
    isCantrip() {
        return this.level === 0;
    }

    isSpellLevel(level) {
        return this.level === level;
    }
} 