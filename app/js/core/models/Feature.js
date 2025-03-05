export class Feature {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.source = data.source;
        this.className = data.className;
        this.subclassName = data.subclassName || null;
        this.level = data.level;
        this.description = data.description;
        this.type = data.type || 'class';  // 'class' or 'subclass'
        this.requirements = data.requirements || {};
        this.options = data.options || [];
    }

    // Basic getters
    getName() {
        return this.name;
    }

    getDescription() {
        return this.description;
    }

    getLevel() {
        return this.level;
    }

    getType() {
        return this.type;
    }

    // Feature type checks
    isClassFeature() {
        return this.type === 'class';
    }

    isSubclassFeature() {
        return this.type === 'subclass';
    }

    // Requirements handling
    hasRequirements() {
        return Object.keys(this.requirements).length > 0;
    }

    getRequirements() {
        return this.requirements;
    }

    meetsRequirements(character) {
        if (!this.hasRequirements()) return true;

        for (const [req, value] of Object.entries(this.requirements)) {
            switch (req) {
                case 'level':
                    if (character.level < value) return false;
                    break;
                case 'ability':
                    for (const [ability, score] of Object.entries(value)) {
                        if (character.getAbilityScore(ability) < score) return false;
                    }
                    break;
                case 'proficiency':
                    for (const prof of value) {
                        if (!character.hasProficiency(prof)) return false;
                    }
                    break;
                case 'feature':
                    if (!character.hasFeature(value)) return false;
                    break;
            }
        }
        return true;
    }

    // Options handling
    hasOptions() {
        return this.options.length > 0;
    }

    getOptions() {
        return this.options;
    }

    // Feature application
    async apply(character) {
        // Base implementation - override in specific feature types
        return true;
    }

    async remove(character) {
        // Base implementation - override in specific feature types
        return true;
    }

    // Utility methods
    toString() {
        return `${this.name} (${this.className}${this.subclassName ? ` - ${this.subclassName}` : ''} ${this.level})`;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            source: this.source,
            className: this.className,
            subclassName: this.subclassName,
            level: this.level,
            description: this.description,
            type: this.type,
            requirements: this.requirements,
            options: this.options
        };
    }
} 