/**
 * PrerequisiteManager.js
 * Manager for validating prerequisites for feats and features
 */

export class PrerequisiteManager {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
    }

    checkPrerequisites(character, prerequisites) {
        if (!prerequisites) return true;

        // Check each type of prerequisite
        return this.checkAbilityPrerequisites(character, prerequisites.ability) &&
            this.checkProficiencyPrerequisites(character, prerequisites.proficiency) &&
            this.checkLevelPrerequisites(character, prerequisites.level) &&
            this.checkSpellcastingPrerequisites(character, prerequisites.spellcasting) &&
            this.checkFeatPrerequisites(character, prerequisites.feat) &&
            this.checkClassPrerequisites(character, prerequisites.class);
    }

    checkAbilityPrerequisites(character, abilityReqs) {
        if (!abilityReqs) return true;

        for (const [ability, score] of Object.entries(abilityReqs)) {
            if (character.getAbilityScore(ability) < score) {
                return false;
            }
        }

        return true;
    }

    checkProficiencyPrerequisites(character, proficiencyReqs) {
        if (!proficiencyReqs) return true;

        for (const prof of proficiencyReqs) {
            if (!character.hasProficiency(prof.type, prof.name)) {
                return false;
            }
        }

        return true;
    }

    checkLevelPrerequisites(character, levelReq) {
        if (!levelReq) return true;
        return character.level >= levelReq;
    }

    checkSpellcastingPrerequisites(character, spellcastingReq) {
        if (!spellcastingReq) return true;
        return character.hasSpellcasting;
    }

    checkFeatPrerequisites(character, featReq) {
        if (!featReq) return true;
        return character.feats.hasFeat(featReq);
    }

    checkClassPrerequisites(character, classReq) {
        if (!classReq) return true;

        if (typeof classReq === 'string') {
            return character.hasClass(classReq);
        }

        // Handle class with level requirement
        if (classReq.name && classReq.level) {
            const classLevel = character.getClassLevel(classReq.name);
            return classLevel >= classReq.level;
        }

        // Handle OR conditions
        if (classReq.or) {
            return classReq.or.some(req => this.checkClassPrerequisites(character, req));
        }

        // Handle AND conditions
        if (classReq.and) {
            return classReq.and.every(req => this.checkClassPrerequisites(character, req));
        }

        return false;
    }

    getFailedPrerequisites(character, prerequisites) {
        if (!prerequisites) return [];

        const failed = [];

        // Check ability scores
        if (prerequisites.ability) {
            for (const [ability, score] of Object.entries(prerequisites.ability)) {
                if (character.getAbilityScore(ability) < score) {
                    failed.push(`${ability.charAt(0).toUpperCase() + ability.slice(1)} score of ${score}`);
                }
            }
        }

        // Check proficiencies
        if (prerequisites.proficiency) {
            for (const prof of prerequisites.proficiency) {
                if (!character.hasProficiency(prof.type, prof.name)) {
                    failed.push(`${prof.type} proficiency in ${prof.name}`);
                }
            }
        }

        // Check level
        if (prerequisites.level && character.level < prerequisites.level) {
            failed.push(`Character level ${prerequisites.level}`);
        }

        // Check spellcasting
        if (prerequisites.spellcasting && !character.hasSpellcasting) {
            failed.push('Ability to cast at least one spell');
        }

        // Check feat
        if (prerequisites.feat && !character.feats.hasFeat(prerequisites.feat)) {
            failed.push(`${prerequisites.feat} feat`);
        }

        // Check class
        if (prerequisites.class) {
            const classReq = prerequisites.class;
            if (typeof classReq === 'string' && !character.hasClass(classReq)) {
                failed.push(`${classReq} class`);
            } else if (classReq.name && classReq.level) {
                const classLevel = character.getClassLevel(classReq.name);
                if (classLevel < classReq.level) {
                    failed.push(`${classReq.name} level ${classReq.level}`);
                }
            }
        }

        return failed;
    }
} 