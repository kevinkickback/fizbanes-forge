/**
 * Feat.js
 * Model class for feats
 */

export class Feat {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.source = data.source || 'PHB';
        this.page = data.page;
        this.description = data.description || '';
        this.prerequisite = data.prerequisite;
        this.repeatable = data.repeatable || false;
        this.ability = data.ability;
        this.proficiencies = data.proficiencies;
        this.spells = data.spells;
        this.features = data.features;
        this.fluff = data.fluff;
    }

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

    getFeatureText() {
        if (!this.features || this.features.length === 0) return 'None';

        return this.features.map(feature =>
            `${feature.name}: ${feature.description}`
        ).join('\n\n');
    }
} 