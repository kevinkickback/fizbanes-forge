import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/SpellSelectionService.js', () => ({
    spellSelectionService: {
        getSpellsKnownLimit: vi.fn(),
        getCantripsKnown: vi.fn(),
    },
}));

vi.mock('../../src/services/SpellService.js', () => ({
    spellService: {
        getSpells: vi.fn(),
    },
}));

import { spellSelectionService } from '../../src/services/SpellSelectionService.js';
import { spellService } from '../../src/services/SpellService.js';
import { spellValidatorService } from '../../src/services/SpellValidatorService.js';

function makeReport() {
    return {
        missing: {
            subclasses: [],
            invocations: [],
            metamagic: [],
            pactBoons: [],
            fightingStyles: [],
            asis: [],
            spells: [],
            other: [],
        },
    };
}

describe('SpellValidatorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        spellSelectionService.getSpellsKnownLimit.mockReturnValue(0);
        spellSelectionService.getCantripsKnown.mockReturnValue(0);
        spellService.getSpells.mockReturnValue(new Map());
    });

    describe('checkSpells', () => {
        it('should report when spellcasting not initialized', () => {
            const character = { spellcasting: null };
            const classEntry = { name: 'Wizard', levels: 1 };
            const classData = { name: 'Wizard' };
            const report = makeReport();

            spellValidatorService.checkSpells(character, classEntry, classData, report);

            expect(report.missing.spells).toHaveLength(1);
            expect(report.missing.spells[0].message).toContain('not initialized');
        });

        it('should report missing spells known', () => {
            spellSelectionService.getSpellsKnownLimit.mockReturnValue(6);
            const character = {
                spellcasting: {
                    classes: {
                        Bard: { spellsKnown: ['Cure Wounds', 'Healing Word'] },
                    },
                },
            };
            const classEntry = { name: 'Bard', levels: 1 };
            const classData = { name: 'Bard' };
            const report = makeReport();

            spellValidatorService.checkSpells(character, classEntry, classData, report);

            expect(report.missing.spells).toHaveLength(1);
            expect(report.missing.spells[0].expected).toBe(6);
            expect(report.missing.spells[0].actual).toBe(2);
            expect(report.missing.spells[0].missing).toBe(4);
        });

        it('should not report when spells known meets expected', () => {
            spellSelectionService.getSpellsKnownLimit.mockReturnValue(2);
            const character = {
                spellcasting: {
                    classes: {
                        Bard: { spellsKnown: ['Cure Wounds', 'Healing Word'] },
                    },
                },
            };
            const classEntry = { name: 'Bard', levels: 1 };
            const classData = { name: 'Bard' };
            const report = makeReport();

            spellValidatorService.checkSpells(character, classEntry, classData, report);

            // Only cantrips check might add, but getCantripsKnown returns 0
            expect(report.missing.spells).toHaveLength(0);
        });

        it('should report missing cantrips', () => {
            spellSelectionService.getCantripsKnown.mockReturnValue(3);
            const spellMap = new Map([
                ['Light', { name: 'Light', level: 0 }],
            ]);
            spellService.getSpells.mockReturnValue(spellMap);

            const character = {
                spellcasting: {
                    classes: {
                        Wizard: { spellsKnown: ['Light'] },
                    },
                },
            };
            const classEntry = { name: 'Wizard', levels: 1 };
            const classData = { name: 'Wizard' };
            const report = makeReport();

            spellValidatorService.checkSpells(character, classEntry, classData, report);

            const cantripReport = report.missing.spells.find(r => r.type === 'cantrips');
            expect(cantripReport).toBeDefined();
            expect(cantripReport.expected).toBe(3);
            expect(cantripReport.actual).toBe(1);
            expect(cantripReport.missing).toBe(2);
        });

        it('should not report cantrips when count met', () => {
            spellSelectionService.getCantripsKnown.mockReturnValue(2);
            const spellMap = new Map([
                ['Light', { name: 'Light', level: 0 }],
                ['Mending', { name: 'Mending', level: 0 }],
            ]);
            spellService.getSpells.mockReturnValue(spellMap);

            const character = {
                spellcasting: {
                    classes: {
                        Wizard: { spellsKnown: ['Light', 'Mending'] },
                    },
                },
            };
            const classEntry = { name: 'Wizard', levels: 1 };
            const classData = { name: 'Wizard' };
            const report = makeReport();

            spellValidatorService.checkSpells(character, classEntry, classData, report);

            const cantripReport = report.missing.spells.find(r => r.type === 'cantrips');
            expect(cantripReport).toBeUndefined();
        });

        it('should skip spells-known check when limit returns 0', () => {
            spellSelectionService.getSpellsKnownLimit.mockReturnValue(0);
            const character = {
                spellcasting: {
                    classes: {
                        Cleric: { spellsKnown: [] },
                    },
                },
            };
            const classEntry = { name: 'Cleric', levels: 1 };
            const classData = { name: 'Cleric' };
            const report = makeReport();

            spellValidatorService.checkSpells(character, classEntry, classData, report);

            // Cleric prepares spells (no spells-known limit), so no report
            expect(report.missing.spells.filter(r => !r.type)).toHaveLength(0);
        });
    });
});
