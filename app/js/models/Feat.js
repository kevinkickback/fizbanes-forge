/**
 * Feat.js
 * Model class representing a character feat in the D&D Character Creator
 */

/**
 * Represents a feat with its benefits and prerequisites
 */
export class Feat {
    /**
     * Creates a new Feat instance
     * @param {Object} data - Raw feat data
     */
    constructor(data) {
        /**
         * Unique identifier for the feat
         * @type {string}
         */
        this.id = data.id;

        /**
         * Name of the feat
         * @type {string}
         */
        this.name = data.name;

        /**
         * Source book for the feat
         * @type {string}
         */
        this.source = data.source || 'PHB';

        /**
         * Page number in the source book
         * @type {number}
         */
        this.page = data.page;

        /**
         * Feat description
         * @type {string}
         */
        this.description = data.description || '';

        /**
         * Prerequisites for taking the feat
         * @type {Object}
         */
        this.prerequisite = data.prerequisite;

        /**
         * Whether the feat can be taken multiple times
         * @type {boolean}
         */
        this.repeatable = data.repeatable || false;

        /**
         * Ability score improvements granted by the feat
         * @type {Array}
         */
        this.ability = data.ability;

        /**
         * Proficiencies granted by the feat
         * @type {Object}
         */
        this.proficiencies = data.proficiencies;

        /**
         * Spells granted by the feat
         * @type {Array}
         */
        this.spells = data.spells;

        /**
         * Special features granted by the feat
         * @type {Array}
         */
        this.features = data.features;

        /**
         * Flavor text for the feat
         * @type {string}
         */
        this.fluff = data.fluff;
    }

    //-------------------------------------------------------------------------
    // Text formatting methods
    //-------------------------------------------------------------------------

    /**
     * Gets a formatted string describing the feat's prerequisites
     * @returns {string} Formatted prerequisite text
     */
    getPrerequisiteText() {
        if (!this.prerequisite) return 'None';

        const parts = [];

        if (this.prerequisite.ability) {
            for (const [ability, score] of Object.entries(this.prerequisite.ability)) {
                parts.push(`${ability.charAt(0).toUpperCase() + ability.slice(1)} ${score}`);
            }
        }

        if (this.prerequisite.proficiency) {
            for (const prof of this.prerequisite.proficiency) {
                parts.push(`${prof.type} proficiency in ${prof.name}`);
            }
        }

        if (this.prerequisite.level) {
            parts.push(`Level ${this.prerequisite.level}`);
        }

        if (this.prerequisite.spellcasting) {
            parts.push('Ability to cast at least one spell');
        }

        if (this.prerequisite.feat) {
            parts.push(`${this.prerequisite.feat} feat`);
        }

        if (this.prerequisite.class) {
            if (typeof this.prerequisite.class === 'string') {
                parts.push(`${this.prerequisite.class} class`);
            } else if (this.prerequisite.class.name && this.prerequisite.class.level) {
                parts.push(`${this.prerequisite.class.name} level ${this.prerequisite.class.level}`);
            }
        }

        return parts.join(', ');
    }

    /**
     * Gets a formatted string describing the ability score improvements
     * @returns {string} Formatted ability text
     */
    getAbilityText() {
        if (!this.ability) return 'None';

        const parts = [];

        for (const ability of this.ability) {
            if (ability.fixed) {
                for (const [abilityName, value] of Object.entries(ability.fixed)) {
                    parts.push(`${abilityName.charAt(0).toUpperCase() + abilityName.slice(1)} +${value}`);
                }
            } else if (ability.choose) {
                parts.push(`Choose ${ability.choose.count} from ${ability.choose.from.join(', ')} (+${ability.choose.amount})`);
            }
        }

        return parts.join(', ');
    }

    /**
     * Gets a formatted string describing the proficiencies granted
     * @returns {string} Formatted proficiency text
     */
    getProficiencyText() {
        if (!this.proficiencies) return 'None';

        const parts = [];

        for (const [type, profs] of Object.entries(this.proficiencies)) {
            if (profs.length > 0) {
                parts.push(`${type}: ${profs.join(', ')}`);
            }
        }

        return parts.join('; ');
    }

    /**
     * Gets a formatted string describing the spells granted
     * @returns {string} Formatted spell text
     */
    getSpellText() {
        if (!this.spells) return 'None';

        return this.spells.map(spell => {
            let text = spell.id;
            if (spell.ability) text += ` (${spell.ability})`;
            if (spell.level) text += ` at level ${spell.level}`;
            if (spell.uses > 0) text += ` ${spell.uses}/day`;
            return text;
        }).join(', ');
    }

    /**
     * Gets a formatted string describing the special features granted
     * @returns {string} Formatted feature text
     */
    getFeatureText() {
        if (!this.features || this.features.length === 0) return 'None';

        return this.features.map(feature =>
            `${feature.name}: ${feature.description}`
        ).join('\n\n');
    }

    //-------------------------------------------------------------------------
    // Utility methods
    //-------------------------------------------------------------------------

    /**
     * Returns a string representation of the feat
     * @returns {string} String representation
     */
    toString() {
        return `${this.name} (${this.source})`;
    }

    /**
     * Converts the feat to a JSON object
     * @returns {Object} JSON representation of the feat
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            source: this.source,
            page: this.page,
            description: this.description,
            prerequisite: this.prerequisite,
            repeatable: this.repeatable,
            ability: this.ability,
            proficiencies: this.proficiencies,
            spells: this.spells,
            features: this.features,
            fluff: this.fluff
        };
    }
} 