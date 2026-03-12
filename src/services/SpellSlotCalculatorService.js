import { classService } from './ClassService.js';

class SpellSlotCalculatorService {
    calculateSpellSlots(className, level) {
        const classData = classService.getClass(className);
        if (!classData || !classData.casterProgression) {
            return {};
        }

        const dataSlots = this._getSpellSlotsFromClassData(classData, level);
        if (dataSlots) return dataSlots;

        // Fallback to hardcoded tables
        const progression = classData.casterProgression;
        let casterLevel = level;

        if (progression === '1/2') {
            casterLevel = Math.floor(level / 2);
        } else if (progression === '1/3') {
            casterLevel = Math.floor(level / 3);
        } else if (progression === 'pact') {
            // Warlock uses pact magic - special progression
            return this._getPactMagicSlots(level);
        }

        return this.getStandardSpellSlots(casterLevel);
    }

    _getSpellSlotsFromClassData(classData, level) {
        if (!classData.classTableGroups) return null;

        if (classData.casterProgression === 'pact') {
            return this._getPactMagicSlotsFromData(classData, level);
        }

        const spellTable = classData.classTableGroups.find(g => g.rowsSpellProgression);
        if (!spellTable?.rowsSpellProgression) return null;

        const index = level - 1;
        if (index < 0 || index >= spellTable.rowsSpellProgression.length) return null;

        const levelSlots = spellTable.rowsSpellProgression[index];
        if (!levelSlots) return null;

        const result = {};
        for (let spellLevel = 1; spellLevel <= 9; spellLevel++) {
            if (levelSlots[spellLevel - 1]) {
                result[spellLevel] = {
                    max: levelSlots[spellLevel - 1],
                    current: levelSlots[spellLevel - 1],
                };
            }
        }
        return result;
    }

    _getPactMagicSlotsFromData(classData, level) {
        const rows = classData.classTableGroups?.[0]?.rows;
        if (!rows) return null;

        const index = level - 1;
        if (index < 0 || index >= rows.length) return null;

        const row = rows[index];
        if (!row || row.length < 4) return null;

        const slotCount = row[2];
        const slotLevelStr = String(row[3]);

        // Parse slot level from filter link: "{@filter 5th|spells|level=5|class=Warlock}"
        const levelMatch = slotLevelStr.match(/level=(\d+)/);
        const slotLevel = levelMatch ? parseInt(levelMatch[1], 10) : 1;

        if (!slotCount) return {};

        const count = Array.isArray(slotCount) ? slotCount[0] : slotCount;
        return {
            [slotLevel]: {
                max: count,
                current: count,
                isPactMagic: true,
            },
        };
    }

    getStandardSpellSlots(casterLevel) {
        // Standard D&D 5e spell slot progression table
        const standardSlots = [
            [],
            [2],
            [3],
            [4, 2],
            [4, 3],
            [4, 3, 2],
            [4, 3, 3],
            [4, 3, 3, 1],
            [4, 3, 3, 2],
            [4, 3, 3, 3, 1],
            [4, 3, 3, 3, 2],
            [4, 3, 3, 3, 2, 1],
            [4, 3, 3, 3, 2, 1],
            [4, 3, 3, 3, 2, 1, 1],
            [4, 3, 3, 3, 2, 1, 1],
            [4, 3, 3, 3, 2, 1, 1, 1],
            [4, 3, 3, 3, 2, 1, 1, 1],
            [4, 3, 3, 3, 3, 1, 1, 1, 1],
            [4, 3, 3, 3, 3, 2, 1, 1, 1],
            [4, 3, 3, 3, 3, 2, 2, 1, 1],
        ];

        if (casterLevel < 1 || casterLevel >= standardSlots.length) {
            return {};
        }

        const levelSlots = standardSlots[casterLevel] || [];
        const result = {};

        for (let spellLevel = 1; spellLevel <= 9; spellLevel++) {
            if (levelSlots[spellLevel - 1]) {
                result[spellLevel] = {
                    max: levelSlots[spellLevel - 1],
                    current: levelSlots[spellLevel - 1],
                };
            }
        }

        return result;
    }

    _getPactMagicSlots(level) {
        // Warlock pact magic progression
        const pactSlots = [
            [],
            [1],
            [2],
            [2],
            [2],
            [2],
            [2],
            [2],
            [2],
            [2],
            [2],
            [3],
            [3],
            [3],
            [3],
            [3],
            [3],
            [4],
            [4],
            [4],
            [4],
        ];

        const pactSlotLevels = [
            0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
        ];

        if (level < 1 || level > 20) {
            return {};
        }

        const slotCount = pactSlots[level] || 0;
        const slotLevel = pactSlotLevels[level] || 1;

        if (slotCount === 0) return {};

        return {
            [slotLevel]: {
                max: slotCount,
                current: slotCount,
                isPactMagic: true,
            },
        };
    }
}

export const spellSlotCalculatorService = new SpellSlotCalculatorService();
