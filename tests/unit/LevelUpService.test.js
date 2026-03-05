import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/5eToolsParser.js', () => ({
    attAbvToLower: vi.fn((abbr) => abbr?.toLowerCase() ?? abbr),
}));

vi.mock('../../src/lib/EventBus.js', () => ({
    eventBus: { emit: vi.fn() },
    EVENTS: {
        MULTICLASS_ADDED: 'multiclass:added',
        MULTICLASS_REMOVED: 'multiclass:removed',
    },
}));

vi.mock('../../src/lib/ValidationSchemas.js', () => ({
    addClassLevelArgsSchema: {},
    removeClassLevelArgsSchema: {},
    validateInput: vi.fn((_schema, data) => data),
}));

vi.mock('../../src/services/ClassService.js', () => ({
    classService: {
        getClass: vi.fn(),
        getHitDie: vi.fn(() => 'd6'),
    },
}));

vi.mock('../../src/services/SourceService.js', () => ({
    sourceService: { getSource: vi.fn() },
}));

vi.mock('../../src/services/SpellSelectionService.js', () => ({
    spellSelectionService: {
        initializeSpellcastingForClass: vi.fn(),
        calculateSpellSlots: vi.fn(() => ({ 1: { max: 3, current: 3 } })),
    },
}));

import { levelUpService } from '../../src/services/LevelUpService.js';
import { spellSelectionService } from '../../src/services/SpellSelectionService.js';

describe('LevelUpService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('addClassLevel — spellcasting level sync', () => {
        function makeCharacterWithWizard(spellcastingLevel) {
            return {
                id: 'test-char',
                progression: {
                    classes: [{ name: 'Wizard', levels: 1 }],
                    levelUps: [],
                },
                spellcasting: {
                    classes: {
                        Wizard: {
                            level: spellcastingLevel,
                            spellsKnown: [],
                            spellsPrepared: [],
                            spellSlots: {},
                        },
                    },
                },
            };
        }

        it('should update spellcasting.classes[].level when leveling an existing class', () => {
            const character = makeCharacterWithWizard(1);
            levelUpService.addClassLevel(character, 'Wizard', 2);

            expect(character.spellcasting.classes.Wizard.level).toBe(2);
        });

        it('should sync spellcasting level to match new progression levels', () => {
            const character = makeCharacterWithWizard(1);
            levelUpService.addClassLevel(character, 'Wizard', 3);

            expect(character.spellcasting.classes.Wizard.level).toBe(3);
            expect(character.progression.classes[0].levels).toBe(3);
        });

        it('should not touch spellcasting if class has no spellcasting data', () => {
            const character = {
                id: 'test-char',
                progression: {
                    classes: [{ name: 'Wizard', levels: 1 }],
                    levelUps: [],
                },
                spellcasting: { classes: {} }, // Wizard not yet in spellcasting
            };

            expect(() => levelUpService.addClassLevel(character, 'Wizard', 2)).not.toThrow();
        });

        it('should call initializeSpellcastingForClass for a new class (not existing)', () => {
            const character = {
                id: 'test-char',
                progression: { classes: [], levelUps: [] },
                spellcasting: { classes: {} },
            };

            levelUpService.addClassLevel(character, 'Cleric', 1);

            expect(spellSelectionService.initializeSpellcastingForClass).toHaveBeenCalledWith(
                character,
                'Cleric',
                1,
            );
        });
    });

    describe('updateSpellSlots — uses classEntry.levels not classEntry.level', () => {
        it('should calculate new spell slots using classEntry.levels', () => {
            const character = {
                progression: {
                    classes: [{ name: 'Wizard', levels: 3 }],
                },
                spellcasting: {
                    classes: {
                        Wizard: {
                            spellSlots: { 1: { max: 2, current: 1 } },
                        },
                    },
                },
            };

            levelUpService.updateSpellSlots(character);

            expect(spellSelectionService.calculateSpellSlots).toHaveBeenCalledWith('Wizard', 3);
        });

        it('should preserve current slot counts when updating max', () => {
            spellSelectionService.calculateSpellSlots.mockReturnValue({
                1: { max: 4, current: 4 },
                2: { max: 2, current: 2 },
            });

            const character = {
                progression: {
                    classes: [{ name: 'Wizard', levels: 5 }],
                },
                spellcasting: {
                    classes: {
                        Wizard: {
                            spellSlots: {
                                1: { max: 3, current: 1 }, // current=1 (used some)
                            },
                        },
                    },
                },
            };

            levelUpService.updateSpellSlots(character);

            // current from old slots should be preserved for slot level 1
            expect(character.spellcasting.classes.Wizard.spellSlots[1].current).toBe(1);
            // new slot levels not in old slots get default from calculateSpellSlots
            expect(character.spellcasting.classes.Wizard.spellSlots[2].max).toBe(2);
        });

        it('should skip classes that have no spellcasting data', () => {
            const character = {
                progression: {
                    classes: [
                        { name: 'Fighter', levels: 5 },
                        { name: 'Wizard', levels: 3 },
                    ],
                },
                spellcasting: {
                    classes: {
                        Wizard: { spellSlots: {} },
                        // Fighter intentionally absent
                    },
                },
            };

            levelUpService.updateSpellSlots(character);

            expect(spellSelectionService.calculateSpellSlots).toHaveBeenCalledTimes(1);
            expect(spellSelectionService.calculateSpellSlots).toHaveBeenCalledWith('Wizard', 3);
        });
    });
});
