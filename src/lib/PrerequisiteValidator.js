import { classService } from '../services/ClassService.js';

/**
 * Check if a character meets a single prerequisite condition.
 * Used by FeatService and OptionalFeatureService.
 *
 * @param {Object} prereq - Single prerequisite object from 5etools data
 * @param {Object} character - Character object
 * @param {Object} [options] - Options like { ignoreRacePrereq, className }
 * @returns {{ met: boolean, reason?: string }}
 */
export function checkPrerequisite(prereq, character, options = {}) {
    if (!character) return { met: false, reason: 'No character' };

    // Level requirement
    if (prereq.level !== undefined) {
        let charLevel = character.getTotalLevel();
        if (options.className) {
            if (character.progression?.classes) {
                const classEntry = character.progression.classes.find(
                    (c) => c.name === options.className,
                );
                if (classEntry) {
                    charLevel = classEntry.levels || 1;
                }
            } else if (character.classes) {
                const classEntry = character.classes.find(
                    (c) => c.name === options.className,
                );
                if (classEntry) {
                    charLevel = classEntry.level || classEntry.levels || 1;
                }
            }
        }
        const requiredLevel =
            typeof prereq.level === 'object'
                ? prereq.level.level || 1
                : prereq.level;
        if (charLevel < requiredLevel) {
            return { met: false, reason: `Requires ${options.className || 'character'} level ${requiredLevel}` };
        }
    }

    // Ability score requirement
    if (Array.isArray(prereq.ability)) {
        const abilityScores = character.abilityScores || {};
        const meetsAbility = prereq.ability.some((abilityReq) => {
            if (typeof abilityReq === 'string') {
                return (abilityScores[abilityReq] || 0) >= 13;
            }
            if (typeof abilityReq === 'object' && abilityReq.ability) {
                return (abilityScores[abilityReq.ability] || 0) >= (abilityReq.score || 13);
            }
            return false;
        });
        if (!meetsAbility) {
            return { met: false, reason: 'Does not meet ability score requirement' };
        }
    }

    // Race requirement
    if (!options.ignoreRacePrereq && Array.isArray(prereq.race)) {
        const characterRace = character.race?.name?.toLowerCase() || '';
        const meetsRace = prereq.race.some((raceReq) => {
            const reqName = typeof raceReq === 'string' ? raceReq : raceReq.name;
            return reqName && characterRace === reqName.toLowerCase();
        });
        if (!meetsRace) {
            return { met: false, reason: 'Race requirement not met' };
        }
    }

    // Class requirement
    if (Array.isArray(prereq.class)) {
        const primaryClass = character.getPrimaryClass();
        const characterClass = primaryClass?.name?.toLowerCase() || '';
        const meetsClass = prereq.class.some((classReq) => {
            const reqName = typeof classReq === 'string' ? classReq : classReq.name;
            return reqName && characterClass === reqName.toLowerCase();
        });
        if (!meetsClass) {
            return { met: false, reason: 'Class requirement not met' };
        }
    }

    // Spellcasting requirement
    if (prereq.spellcasting === true) {
        const classes = character.progression?.classes || [];
        const hasSpellcasting = classes.some((cls) => {
            const classData = classService?.getClass?.(cls.name, cls.source);
            return classData?.spellcastingAbility;
        });
        if (!hasSpellcasting) {
            return { met: false, reason: 'Requires spellcasting ability' };
        }
    }

    // Spell known requirement
    if (prereq.spell) {
        const requiredSpells = Array.isArray(prereq.spell) ? prereq.spell : [prereq.spell];
        const missing = requiredSpells.filter((spellRef) => {
            const spellName = spellRef.split('#')[0].split('|')[0].toLowerCase();
            if (character.spellcasting?.classes) {
                for (const cs of Object.values(character.spellcasting.classes)) {
                    if (cs.spellsKnown?.some((s) => s.name.toLowerCase() === spellName)) return false;
                    if (cs.cantrips?.some((s) => s.name.toLowerCase() === spellName)) return false;
                    if (cs.preparedSpells?.some((s) => s.name.toLowerCase() === spellName)) return false;
                }
            }
            return true;
        });
        if (missing.length > 0) {
            const names = missing.map((r) => r.split('#')[0].split('|')[0]).join(', ');
            return { met: false, reason: `Requires spell: ${names}` };
        }
    }

    // Pact requirement
    if (prereq.pact) {
        const hasPact = character.features?.some((f) =>
            f.name?.toLowerCase().includes(prereq.pact.toLowerCase()),
        );
        if (!hasPact) {
            return { met: false, reason: `Requires ${prereq.pact}` };
        }
    }

    // Patron requirement
    if (prereq.patron) {
        const hasPatron = character.features?.some((f) =>
            f.name?.toLowerCase().includes(prereq.patron.toLowerCase()),
        );
        if (!hasPatron) {
            return { met: false, reason: `Requires patron: ${prereq.patron}` };
        }
    }

    return { met: true };
}

/**
 * Check all prerequisites on a feature/feat (AND logic).
 * @returns {{ met: boolean, reasons: string[] }}
 */
export function checkAllPrerequisites(item, character, options = {}) {
    if (!item.prerequisite || !Array.isArray(item.prerequisite)) {
        return { met: true, reasons: [] };
    }
    const reasons = [];
    for (const prereq of item.prerequisite) {
        const result = checkPrerequisite(prereq, character, options);
        if (!result.met) reasons.push(result.reason);
    }
    return { met: reasons.length === 0, reasons };
}
