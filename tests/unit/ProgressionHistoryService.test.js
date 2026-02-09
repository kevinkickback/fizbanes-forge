import { beforeEach, describe, expect, it } from 'vitest';
import { progressionHistoryService } from '../../src/services/ProgressionHistoryService.js';

describe('ProgressionHistoryService', () => {
    let character;

    beforeEach(() => {
        character = {};
    });

    describe('ensureInitialized', () => {
        it('should create progressionHistory object if missing', () => {
            progressionHistoryService.ensureInitialized(character);
            expect(character.progressionHistory).toEqual({});
        });

        it('should not overwrite existing progressionHistory', () => {
            character.progressionHistory = { Fighter: {} };
            progressionHistoryService.ensureInitialized(character);
            expect(character.progressionHistory).toEqual({ Fighter: {} });
        });
    });

    describe('recordChoices', () => {
        it('should record choices for a class at a given level', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {
                hitDie: 10,
                skills: ['Athletics', 'Intimidation'],
            });

            const entry = character.progressionHistory.Fighter['1'];
            expect(entry.choices.hitDie).toBe(10);
            expect(entry.choices.skills).toEqual(['Athletics', 'Intimidation']);
            expect(entry.timestamp).toBeDefined();
        });

        it('should overwrite choices at the same level', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {
                skills: ['Athletics'],
            });
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {
                skills: ['Acrobatics'],
            });

            const entry = character.progressionHistory.Fighter['1'];
            expect(entry.choices.skills).toEqual(['Acrobatics']);
        });

        it('should store choices for multiple classes', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {
                hitDie: 10,
            });
            progressionHistoryService.recordChoices(character, 'Wizard', 1, {
                hitDie: 6,
            });

            expect(character.progressionHistory.Fighter['1'].choices.hitDie).toBe(10);
            expect(character.progressionHistory.Wizard['1'].choices.hitDie).toBe(6);
        });

        it('should normalize level to string key', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 5, {
                asi: true,
            });
            expect(character.progressionHistory.Fighter['5']).toBeDefined();
        });
    });

    describe('getChoices', () => {
        it('should return choices for a recorded level', () => {
            progressionHistoryService.recordChoices(character, 'Rogue', 3, {
                subclass: 'Thief',
            });

            const choices = progressionHistoryService.getChoices(
                character,
                'Rogue',
                3,
            );
            expect(choices.subclass).toBe('Thief');
        });

        it('should return null when no progressionHistory exists', () => {
            expect(
                progressionHistoryService.getChoices(character, 'Rogue', 3),
            ).toBeNull();
        });

        it('should return null for unrecorded class', () => {
            progressionHistoryService.ensureInitialized(character);
            expect(
                progressionHistoryService.getChoices(character, 'Rogue', 3),
            ).toBeNull();
        });

        it('should return null for unrecorded level', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {});
            expect(
                progressionHistoryService.getChoices(character, 'Fighter', 5),
            ).toBeNull();
        });
    });

    describe('removeChoices', () => {
        it('should remove choices at a given level', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 3, {
                subclass: 'Champion',
            });

            const result = progressionHistoryService.removeChoices(
                character,
                'Fighter',
                3,
            );
            expect(result).toBe(true);
            expect(character.progressionHistory.Fighter['3']).toBeUndefined();
        });

        it('should return false when no progressionHistory exists', () => {
            expect(
                progressionHistoryService.removeChoices(character, 'Fighter', 1),
            ).toBe(false);
        });

        it('should return false for unrecorded class', () => {
            progressionHistoryService.ensureInitialized(character);
            expect(
                progressionHistoryService.removeChoices(character, 'Fighter', 1),
            ).toBe(false);
        });

        it('should return false for unrecorded level', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {});
            expect(
                progressionHistoryService.removeChoices(character, 'Fighter', 5),
            ).toBe(false);
        });
    });

    describe('getChoicesByRange', () => {
        it('should return choices within the level range', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {
                a: 1,
            });
            progressionHistoryService.recordChoices(character, 'Fighter', 2, {
                b: 2,
            });
            progressionHistoryService.recordChoices(character, 'Fighter', 3, {
                c: 3,
            });
            progressionHistoryService.recordChoices(character, 'Fighter', 5, {
                e: 5,
            });

            const result = progressionHistoryService.getChoicesByRange(
                character,
                'Fighter',
                1,
                3,
            );
            expect(Object.keys(result)).toEqual(['1', '2', '3']);
            expect(result[1]).toEqual({ a: 1 });
        });

        it('should return empty object when no history exists', () => {
            expect(
                progressionHistoryService.getChoicesByRange(
                    character,
                    'Fighter',
                    1,
                    5,
                ),
            ).toEqual({});
        });

        it('should return empty object for unrecorded class', () => {
            progressionHistoryService.ensureInitialized(character);
            expect(
                progressionHistoryService.getChoicesByRange(
                    character,
                    'Wizard',
                    1,
                    5,
                ),
            ).toEqual({});
        });
    });

    describe('getClassLevelHistory', () => {
        it('should return full class history', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {
                a: 1,
            });
            progressionHistoryService.recordChoices(character, 'Fighter', 2, {
                b: 2,
            });

            const history = progressionHistoryService.getClassLevelHistory(
                character,
                'Fighter',
            );
            expect(Object.keys(history)).toEqual(['1', '2']);
        });

        it('should return empty object when no history', () => {
            expect(
                progressionHistoryService.getClassLevelHistory(character, 'Fighter'),
            ).toEqual({});
        });
    });

    describe('getClassesWithHistory', () => {
        it('should return class names that have history', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {});
            progressionHistoryService.recordChoices(character, 'Wizard', 1, {});

            const classes =
                progressionHistoryService.getClassesWithHistory(character);
            expect(classes).toContain('Fighter');
            expect(classes).toContain('Wizard');
        });

        it('should exclude classes with empty history', () => {
            character.progressionHistory = { Fighter: {}, Wizard: { '1': {} } };

            const classes =
                progressionHistoryService.getClassesWithHistory(character);
            expect(classes).not.toContain('Fighter');
            expect(classes).toContain('Wizard');
        });

        it('should return empty array when no history', () => {
            expect(
                progressionHistoryService.getClassesWithHistory(character),
            ).toEqual([]);
        });
    });

    describe('hasClassHistory', () => {
        it('should return true when class has entries', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {});
            expect(
                progressionHistoryService.hasClassHistory(character, 'Fighter'),
            ).toBe(true);
        });

        it('should return falsy when class has no entries', () => {
            progressionHistoryService.ensureInitialized(character);
            expect(
                progressionHistoryService.hasClassHistory(character, 'Fighter'),
            ).toBeFalsy();
        });

        it('should return false when no history exists', () => {
            expect(
                progressionHistoryService.hasClassHistory(character, 'Fighter'),
            ).toBe(false);
        });
    });

    describe('getHighestRecordedLevel', () => {
        it('should return the highest level recorded', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {});
            progressionHistoryService.recordChoices(character, 'Fighter', 5, {});
            progressionHistoryService.recordChoices(character, 'Fighter', 3, {});

            expect(
                progressionHistoryService.getHighestRecordedLevel(
                    character,
                    'Fighter',
                ),
            ).toBe(5);
        });

        it('should return null when no history exists', () => {
            expect(
                progressionHistoryService.getHighestRecordedLevel(
                    character,
                    'Fighter',
                ),
            ).toBeNull();
        });

        it('should return null for class with no entries', () => {
            character.progressionHistory = { Fighter: {} };
            expect(
                progressionHistoryService.getHighestRecordedLevel(
                    character,
                    'Fighter',
                ),
            ).toBeNull();
        });
    });

    describe('clearClassHistory', () => {
        it('should clear all history for a class', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {});
            progressionHistoryService.recordChoices(character, 'Fighter', 2, {});

            progressionHistoryService.clearClassHistory(character, 'Fighter');

            expect(character.progressionHistory.Fighter).toBeUndefined();
        });

        it('should not throw when no history exists', () => {
            expect(() =>
                progressionHistoryService.clearClassHistory(character, 'Fighter'),
            ).not.toThrow();
        });
    });

    describe('clearAllHistory', () => {
        it('should reset progressionHistory to empty object', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {});
            progressionHistoryService.recordChoices(character, 'Wizard', 1, {});

            progressionHistoryService.clearAllHistory(character);

            expect(character.progressionHistory).toEqual({});
        });
    });

    describe('clearFeatureTypesFromClass', () => {
        it('should remove specified feature types from all levels', () => {
            progressionHistoryService.recordChoices(character, 'Warlock', 1, {
                invocations: ['Agonizing Blast'],
                pactBoon: 'Pact of the Blade',
            });
            progressionHistoryService.recordChoices(character, 'Warlock', 3, {
                invocations: ['Devil Sight'],
                spells: ['Hex'],
            });

            const affected = progressionHistoryService.clearFeatureTypesFromClass(
                character,
                'Warlock',
                ['invocations'],
            );

            expect(affected).toBe(2);
            expect(
                character.progressionHistory.Warlock['1'].choices.invocations,
            ).toBeUndefined();
            expect(
                character.progressionHistory.Warlock['1'].choices.pactBoon,
            ).toBe('Pact of the Blade');
            expect(
                character.progressionHistory.Warlock['3'].choices.invocations,
            ).toBeUndefined();
            expect(
                character.progressionHistory.Warlock['3'].choices.spells,
            ).toEqual(['Hex']);
        });

        it('should return 0 when no history exists', () => {
            expect(
                progressionHistoryService.clearFeatureTypesFromClass(
                    character,
                    'Warlock',
                    ['invocations'],
                ),
            ).toBe(0);
        });

        it('should return 0 when feature types not found', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {
                skills: ['Athletics'],
            });

            expect(
                progressionHistoryService.clearFeatureTypesFromClass(
                    character,
                    'Fighter',
                    ['invocations'],
                ),
            ).toBe(0);
        });
    });

    describe('getSummary', () => {
        it('should return summary with level counts and ranges', () => {
            progressionHistoryService.recordChoices(character, 'Fighter', 1, {});
            progressionHistoryService.recordChoices(character, 'Fighter', 3, {});
            progressionHistoryService.recordChoices(character, 'Fighter', 5, {});
            progressionHistoryService.recordChoices(character, 'Wizard', 1, {});

            const summary = progressionHistoryService.getSummary(character);

            expect(summary.Fighter.count).toBe(3);
            expect(summary.Fighter.min).toBe(1);
            expect(summary.Fighter.max).toBe(5);
            expect(summary.Fighter.levels).toEqual([1, 3, 5]);
            expect(summary.Wizard.count).toBe(1);
        });

        it('should return empty object when no history', () => {
            expect(progressionHistoryService.getSummary(character)).toEqual({});
        });
    });
});
