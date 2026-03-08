import { spellSelectionService } from './SpellSelectionService.js';
import { spellService } from './SpellService.js';

class SpellValidatorService {
    checkSpells(character, classEntry, classData, report) {
        const className = classEntry.name;
        const classLevel = classEntry.levels || 0;

        const spellcasting = character.spellcasting?.classes?.[className];
        if (!spellcasting) {
            report.missing.spells.push({
                class: className,
                level: classLevel,
                message: `${className} spellcasting not initialized`,
            });
            return;
        }

        // Read spells known from class data
        const expectedSpellsKnown = this._getSpellsKnownFromClassTable(
            classData,
            classLevel,
        );
        const actualSpellsKnown = spellcasting.spellsKnown?.length || 0;

        if (
            expectedSpellsKnown !== null &&
            actualSpellsKnown < expectedSpellsKnown
        ) {
            report.missing.spells.push({
                class: className,
                level: classLevel,
                expected: expectedSpellsKnown,
                actual: actualSpellsKnown,
                missing: expectedSpellsKnown - actualSpellsKnown,
                message: `${className} is missing ${expectedSpellsKnown - actualSpellsKnown} spells (has ${actualSpellsKnown}, should have ${expectedSpellsKnown})`,
            });
        }

        // Check cantrips
        const expectedCantrips = this._getCantripsKnownFromClassTable(
            classData,
            classLevel,
        );
        const spellNames = spellcasting.spellsKnown || [];
        const spellMap = spellService.getSpells(spellNames);
        const actualCantrips = spellNames.filter((s) => {
            const spell = spellMap.get(s);
            return spell?.level === 0;
        }).length;

        if (expectedCantrips !== null && actualCantrips < expectedCantrips) {
            report.missing.spells.push({
                class: className,
                level: classLevel,
                type: 'cantrips',
                expected: expectedCantrips,
                actual: actualCantrips,
                missing: expectedCantrips - actualCantrips,
                message: `${className} is missing ${expectedCantrips - actualCantrips} cantrips`,
            });
        }
    }

    _getSpellsKnownFromClassTable(classData, level) {
        const spellsKnown = spellSelectionService.getSpellsKnownLimit(
            classData.name,
            level,
        );
        return spellsKnown > 0 ? spellsKnown : null;
    }

    _getCantripsKnownFromClassTable(classData, level) {
        const cantripsKnown = spellSelectionService.getCantripsKnown(
            classData.name,
            level,
        );
        return cantripsKnown > 0 ? cantripsKnown : null;
    }
}

export const spellValidatorService = new SpellValidatorService();
