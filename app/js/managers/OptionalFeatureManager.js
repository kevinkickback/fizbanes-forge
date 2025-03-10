/**
 * OptionalFeatureManager.js
 * Manages optional feature functionality for the D&D Character Creator
 */

export class OptionalFeatureManager {
    constructor(character) {
        this.character = character;
        this.features = new Map();
    }

    async addFeature(featureId) {
        try {
            const feature = await this.character.feats.loadOptionalFeature(featureId);

            // Check prerequisites
            if (!this.checkPrerequisites(feature)) {
                console.warn(`Prerequisites not met for feature: ${featureId}`);
                return false;
            }

            // Add feature
            this.features.set(featureId, feature);

            // Apply feature effects
            await this.applyFeatureEffects(feature);

            return true;
        } catch (error) {
            console.error('Error adding optional feature:', error);
            return false;
        }
    }

    checkPrerequisites(feature) {
        if (!feature.prerequisite) return true;

        // Check class prerequisites
        if (feature.prerequisite.class) {
            const classLevel = this.character.getClassLevel(feature.prerequisite.class);
            if (!classLevel || classLevel < (feature.prerequisite.level || 1)) {
                return false;
            }
        }

        // Check ability score prerequisites
        if (feature.prerequisite.ability) {
            for (const [ability, score] of Object.entries(feature.prerequisite.ability)) {
                if (this.character.getAbilityScore(ability) < score) {
                    return false;
                }
            }
        }

        // Check proficiency prerequisites
        if (feature.prerequisite.proficiency) {
            for (const prof of feature.prerequisite.proficiency) {
                if (!this.character.hasProficiency(prof.type, prof.name)) {
                    return false;
                }
            }
        }

        // Check feat prerequisites
        if (feature.prerequisite.feat) {
            if (!this.character.feats.hasFeat(feature.prerequisite.feat)) {
                return false;
            }
        }

        return true;
    }

    async applyFeatureEffects(feature) {
        // Apply ability score increases
        if (feature.ability) {
            for (const ability of feature.ability) {
                if (ability.fixed) {
                    for (const [abilityName, value] of Object.entries(ability.fixed)) {
                        this.character.addAbilityBonus(abilityName, value, 'OptionalFeature');
                    }
                }
            }
        }

        // Apply proficiencies
        if (feature.proficiencies) {
            for (const [type, profs] of Object.entries(feature.proficiencies)) {
                for (const prof of profs) {
                    this.character.addProficiency(type, prof, 'OptionalFeature');
                }
            }
        }

        // Apply spells
        if (feature.spells) {
            for (const spell of feature.spells) {
                await this.character.spells.addSpell(spell.id, 'OptionalFeature');
            }
        }

        // Apply feature
        this.character.addFeature('optionalFeature', feature.name, feature.description);
    }

    removeFeature(featureId) {
        const feature = this.features.get(featureId);
        if (!feature) return false;

        // Remove feature effects
        this.removeFeatureEffects(feature);

        // Remove feature
        this.features.delete(featureId);

        return true;
    }

    removeFeatureEffects(feature) {
        // Remove ability score increases
        if (feature.ability) {
            this.character.clearAbilityBonuses('OptionalFeature');
        }

        // Remove proficiencies
        if (feature.proficiencies) {
            this.character.removeProficienciesBySource('OptionalFeature');
        }

        // Remove spells
        if (feature.spells) {
            this.character.spells.removeSpellsBySource('OptionalFeature');
        }

        // Remove feature
        this.character.removeFeaturesBySource('optionalFeature');
    }

    getFeatures() {
        return Array.from(this.features.values());
    }

    hasFeature(featureId) {
        return this.features.has(featureId);
    }
} 