import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/ClassService.js', () => ({
    classService: {
        getClassFeatures: vi.fn(),
    },
}));

import { classService } from '../../src/services/ClassService.js';
import { progressionValidatorService } from '../../src/services/ProgressionValidatorService.js';

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

describe('ProgressionValidatorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        classService.getClassFeatures.mockReturnValue([]);
    });

    describe('checkSubclass', () => {
        it('should add missing subclass when at or above subclass level', () => {
            const classEntry = { name: 'Fighter', levels: 3 };
            const classData = { subclassTitle: 'Martial Archetype' };
            const report = makeReport();

            progressionValidatorService.checkSubclass({}, classEntry, classData, report);

            expect(report.missing.subclasses).toHaveLength(1);
            expect(report.missing.subclasses[0].class).toBe('Fighter');
            expect(report.missing.subclasses[0].requiredAt).toBe(3);
        });

        it('should not report missing subclass when below subclass level', () => {
            const classEntry = { name: 'Fighter', levels: 2 };
            const classData = { subclassTitle: 'Martial Archetype' };
            const report = makeReport();

            progressionValidatorService.checkSubclass({}, classEntry, classData, report);

            expect(report.missing.subclasses).toHaveLength(0);
        });

        it('should not report missing subclass when subclass is selected', () => {
            const classEntry = { name: 'Fighter', levels: 5, subclass: 'Champion' };
            const classData = { subclassTitle: 'Martial Archetype' };
            const report = makeReport();

            progressionValidatorService.checkSubclass({}, classEntry, classData, report);

            expect(report.missing.subclasses).toHaveLength(0);
        });

        it('should detect custom subclass level from classFeatures', () => {
            const classEntry = { name: 'Wizard', levels: 2 };
            const classData = {
                subclassTitle: 'Arcane Tradition',
                classFeatures: [
                    [], // level 1
                    [{ gainSubclassFeature: true }], // level 2
                ],
            };
            const report = makeReport();

            progressionValidatorService.checkSubclass({}, classEntry, classData, report);

            expect(report.missing.subclasses).toHaveLength(1);
            expect(report.missing.subclasses[0].requiredAt).toBe(2);
        });

        it('should default to level 3 when no subclassTitle', () => {
            const classEntry = { name: 'Fighter', levels: 3 };
            const classData = {};
            const report = makeReport();

            progressionValidatorService.checkSubclass({}, classEntry, classData, report);

            // No subclassTitle → subclass check doesn't look for custom level,
            // defaults to 3 but still checks because classLevel >= 3 and no subclass
            expect(report.missing.subclasses).toHaveLength(1);
        });
    });

    describe('checkClassFeatures', () => {
        it('should detect missing invocations', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Eldritch Invocations', level: 2, entries: ['choose 3'] },
            ]);
            const character = { invocations: [] };
            const classEntry = { name: 'Warlock', levels: 2, source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkClassFeatures(character, classEntry, classData, report);

            expect(report.missing.invocations).toHaveLength(1);
            expect(report.missing.invocations[0].expected).toBe(3);
            expect(report.missing.invocations[0].actual).toBe(0);
        });

        it('should not report invocations when count is met', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Eldritch Invocations', level: 2, entries: ['choose 2'] },
            ]);
            const character = {
                invocations: [
                    { class: 'Warlock', name: 'Agonizing Blast' },
                    { class: 'Warlock', name: 'Repelling Blast' },
                ],
            };
            const classEntry = { name: 'Warlock', levels: 2, source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkClassFeatures(character, classEntry, classData, report);

            expect(report.missing.invocations).toHaveLength(0);
        });

        it('should detect missing metamagic', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Metamagic', level: 3, entries: ['choose 2'] },
            ]);
            const character = { metamagic: [] };
            const classEntry = { name: 'Sorcerer', levels: 3, source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkClassFeatures(character, classEntry, classData, report);

            expect(report.missing.metamagic).toHaveLength(1);
            expect(report.missing.metamagic[0].expected).toBe(2);
        });

        it('should detect missing pact boon', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Pact Boon', level: 3 },
            ]);
            const character = {};
            const classEntry = { name: 'Warlock', levels: 3, source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkClassFeatures(character, classEntry, classData, report);

            expect(report.missing.pactBoons).toHaveLength(1);
        });

        it('should not report pact boon when selected', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Pact Boon', level: 3 },
            ]);
            const character = {};
            const classEntry = { name: 'Warlock', levels: 3, pactBoon: 'Pact of the Chain', source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkClassFeatures(character, classEntry, classData, report);

            expect(report.missing.pactBoons).toHaveLength(0);
        });

        it('should detect missing fighting style', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Fighting Style', level: 1 },
            ]);
            const character = {};
            const classEntry = { name: 'Fighter', levels: 1, source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkClassFeatures(character, classEntry, classData, report);

            expect(report.missing.fightingStyles).toHaveLength(1);
        });

        it('should detect generic choice features', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Expertise', level: 1, entries: ['Choose two skills'] },
            ]);
            const character = {};
            const classEntry = { name: 'Rogue', levels: 1, source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkClassFeatures(character, classEntry, classData, report);

            expect(report.missing.other).toHaveLength(1);
            expect(report.missing.other[0].feature).toBe('Expertise');
        });
    });

    describe('checkASIs', () => {
        it('should report unused ASI levels', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Ability Score Improvement', level: 4 },
                { name: 'Ability Score Improvement', level: 8 },
            ]);
            const character = { progression: { levelUps: [] } };
            const classEntry = { name: 'Fighter', levels: 8, source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkASIs(character, classEntry, classData, report);

            expect(report.missing.asis).toHaveLength(1);
            expect(report.missing.asis[0].asiLevels).toEqual([4, 8]);
        });

        it('should not report ASI levels when used', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Ability Score Improvement', level: 4 },
            ]);
            const character = {
                progression: {
                    levelUps: [
                        { toLevel: 4, changedAbilities: { str: 2 } },
                    ],
                },
            };
            const classEntry = { name: 'Fighter', levels: 4, source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkASIs(character, classEntry, classData, report);

            expect(report.missing.asis).toHaveLength(0);
        });

        it('should count feat application as ASI usage', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Ability Score Improvement', level: 4 },
            ]);
            const character = {
                progression: {
                    levelUps: [
                        { toLevel: 4, appliedFeats: ['Alert'] },
                    ],
                },
            };
            const classEntry = { name: 'Fighter', levels: 4, source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkASIs(character, classEntry, classData, report);

            expect(report.missing.asis).toHaveLength(0);
        });

        it('should skip when no ASI features exist', () => {
            classService.getClassFeatures.mockReturnValue([
                { name: 'Second Wind', level: 1 },
            ]);
            const character = { progression: { levelUps: [] } };
            const classEntry = { name: 'Fighter', levels: 1, source: 'PHB' };
            const classData = { source: 'PHB' };
            const report = makeReport();

            progressionValidatorService.checkASIs(character, classEntry, classData, report);

            expect(report.missing.asis).toHaveLength(0);
        });
    });

    describe('_parseChoiceCount', () => {
        it('should parse "choose N" pattern', () => {
            const result = progressionValidatorService._parseChoiceCount({
                entries: ['choose 3 from the following'],
            });
            expect(result).toBe(3);
        });

        it('should parse "select N" pattern', () => {
            const result = progressionValidatorService._parseChoiceCount({
                entries: ['Select 2 options'],
            });
            expect(result).toBe(2);
        });

        it('should parse "learn N" pattern', () => {
            const result = progressionValidatorService._parseChoiceCount({
                entries: ['You learn 4 spells'],
            });
            expect(result).toBe(4);
        });

        it('should default to 1 when choose/select present but no count', () => {
            const result = progressionValidatorService._parseChoiceCount({
                entries: ['You may choose from the list'],
            });
            expect(result).toBe(1);
        });

        it('should return 0 when no choice keywords', () => {
            const result = progressionValidatorService._parseChoiceCount({
                entries: ['You gain proficiency'],
            });
            expect(result).toBe(0);
        });
    });
});
