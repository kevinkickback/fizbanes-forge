import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

// Mock dependent services
vi.mock('../../src/services/ClassService.js', () => ({
    classService: {
        getClass: vi.fn(),
    },
}));

vi.mock('../../src/services/ProgressionValidatorService.js', () => ({
    progressionValidatorService: {
        checkSubclass: vi.fn(),
        checkClassFeatures: vi.fn(),
        checkASIs: vi.fn(),
    },
}));

vi.mock('../../src/services/SpellValidatorService.js', () => ({
    spellValidatorService: {
        checkSpells: vi.fn(),
    },
}));

import { characterValidationService } from '../../src/services/CharacterValidationService.js';
import { classService } from '../../src/services/ClassService.js';
import { progressionValidatorService } from '../../src/services/ProgressionValidatorService.js';
import { spellValidatorService } from '../../src/services/SpellValidatorService.js';

describe('CharacterValidationService', () => {
    const mockFighterClass = {
        name: 'Fighter',
        source: 'PHB',
        hd: 10,
        spellcastingAbility: null,
    };

    const mockWizardClass = {
        name: 'Wizard',
        source: 'PHB',
        hd: 6,
        spellcastingAbility: 'int',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        classService.getClass.mockReturnValue(mockFighterClass);
        progressionValidatorService.checkSubclass.mockImplementation(() => { });
        progressionValidatorService.checkClassFeatures.mockImplementation(() => { });
        progressionValidatorService.checkASIs.mockImplementation(() => { });
        spellValidatorService.checkSpells.mockImplementation(() => { });
    });

    describe('validateCharacter', () => {
        it('should return valid report for character with no missing choices', () => {
            const character = {
                progression: {
                    classes: [{ name: 'Fighter', levels: 1 }],
                },
            };

            const report = characterValidationService.validateCharacter(character);

            expect(report.isValid).toBe(true);
            expect(report.warnings).toHaveLength(0);
            expect(progressionValidatorService.checkSubclass).toHaveBeenCalled();
            expect(progressionValidatorService.checkClassFeatures).toHaveBeenCalled();
            expect(progressionValidatorService.checkASIs).toHaveBeenCalled();
        });

        it('should not call spell validator for non-caster classes', () => {
            const character = {
                progression: {
                    classes: [{ name: 'Fighter', levels: 1 }],
                },
            };

            characterValidationService.validateCharacter(character);
            expect(spellValidatorService.checkSpells).not.toHaveBeenCalled();
        });

        it('should call spell validator for caster classes', () => {
            classService.getClass.mockReturnValue(mockWizardClass);
            const character = {
                progression: {
                    classes: [{ name: 'Wizard', levels: 1 }],
                },
            };

            characterValidationService.validateCharacter(character);
            expect(spellValidatorService.checkSpells).toHaveBeenCalled();
        });

        it('should return invalid report for null character', () => {
            const report = characterValidationService.validateCharacter(null);
            expect(report.isValid).toBe(false);
        });

        it('should return invalid report for character without progression', () => {
            const report = characterValidationService.validateCharacter({});
            expect(report.isValid).toBe(false);
            expect(report.warnings).toContain('Character has no class progression data');
        });

        it('should skip classes at level 0', () => {
            const character = {
                progression: {
                    classes: [{ name: 'Fighter', levels: 0 }],
                },
            };

            characterValidationService.validateCharacter(character);
            expect(progressionValidatorService.checkSubclass).not.toHaveBeenCalled();
        });

        it('should add warning for unknown class', () => {
            classService.getClass.mockReturnValue(null);
            const character = {
                progression: {
                    classes: [{ name: 'Unknown', levels: 1 }],
                },
            };

            const report = characterValidationService.validateCharacter(character);
            expect(report.warnings).toContain('Unknown class: Unknown');
        });

        it('should mark invalid when missing items exist', () => {
            progressionValidatorService.checkSubclass.mockImplementation(
                (_char, _entry, _data, report) => {
                    report.missing.subclasses.push({ class: 'Fighter', level: 3 });
                },
            );

            const character = {
                progression: {
                    classes: [{ name: 'Fighter', levels: 3 }],
                },
            };

            const report = characterValidationService.validateCharacter(character);
            expect(report.isValid).toBe(false);
            expect(report.missing.subclasses).toHaveLength(1);
        });

        it('should validate multiple classes', () => {
            classService.getClass.mockImplementation((name) => {
                if (name === 'Fighter') return mockFighterClass;
                if (name === 'Wizard') return mockWizardClass;
                return null;
            });

            const character = {
                progression: {
                    classes: [
                        { name: 'Fighter', levels: 5 },
                        { name: 'Wizard', levels: 3 },
                    ],
                },
            };

            characterValidationService.validateCharacter(character);
            expect(progressionValidatorService.checkSubclass).toHaveBeenCalledTimes(2);
            expect(spellValidatorService.checkSpells).toHaveBeenCalledTimes(1);
        });
    });

    describe('getSummary', () => {
        it('should return empty array when nothing is missing', () => {
            const report = {
                isValid: true,
                missing: {
                    spells: [], invocations: [], metamagic: [],
                    fightingStyles: [], pactBoons: [], subclasses: [],
                    asis: [], features: [], other: [],
                },
            };

            const messages = characterValidationService.getSummary(report);
            expect(messages).toHaveLength(0);
        });

        it('should summarize missing subclasses', () => {
            const report = {
                missing: {
                    spells: [], invocations: [], metamagic: [],
                    fightingStyles: [], pactBoons: [], subclasses: [{ class: 'Fighter' }],
                    asis: [], features: [], other: [],
                },
            };

            const messages = characterValidationService.getSummary(report);
            expect(messages).toContain('Missing subclass choices: 1');
        });

        it('should summarize missing spells with total count', () => {
            const report = {
                missing: {
                    spells: [{ class: 'Wizard', missing: 3 }, { class: 'Cleric', missing: 2 }],
                    invocations: [], metamagic: [], fightingStyles: [],
                    pactBoons: [], subclasses: [], asis: [], features: [], other: [],
                },
            };

            const messages = characterValidationService.getSummary(report);
            expect(messages).toContain('Missing spells: 5');
        });

        it('should summarize other incomplete choices', () => {
            const report = {
                missing: {
                    spells: [], invocations: [], metamagic: [],
                    fightingStyles: [], pactBoons: [], subclasses: [],
                    asis: [], features: [],
                    other: [{ class: 'Fighter', name: 'Custom' }],
                },
            };

            const messages = characterValidationService.getSummary(report);
            expect(messages).toContain('Other incomplete choices: 1');
        });
    });

    describe('getPendingChoicesSummary', () => {
        it('should return zero total when character is complete', () => {
            const character = {
                progression: {
                    classes: [{ name: 'Fighter', levels: 1 }],
                },
            };

            const summary = characterValidationService.getPendingChoicesSummary(character);
            expect(summary.total).toBe(0);
            expect(summary.messages).toHaveLength(0);
        });

        it('should count ASI choices', () => {
            progressionValidatorService.checkASIs.mockImplementation(
                (_char, _entry, _data, report) => {
                    report.missing.asis.push({ class: 'Fighter', expectedCount: 2 });
                },
            );

            const character = {
                progression: {
                    classes: [{ name: 'Fighter', levels: 8 }],
                },
            };

            const summary = characterValidationService.getPendingChoicesSummary(character);
            expect(summary.total).toBe(2);
            expect(summary.byCategory.asis).toBe(2);
        });

        it('should count feature choices from multiple categories', () => {
            progressionValidatorService.checkClassFeatures.mockImplementation(
                (_char, _entry, _data, report) => {
                    report.missing.invocations.push({ class: 'Warlock', missing: 3 });
                    report.missing.metamagic.push({ class: 'Sorcerer', missing: 2 });
                },
            );

            classService.getClass.mockReturnValue(mockFighterClass);

            const character = {
                progression: {
                    classes: [{ name: 'Fighter', levels: 5 }],
                },
            };

            const summary = characterValidationService.getPendingChoicesSummary(character);
            expect(summary.byCategory.features).toBe(5);
        });
    });

    describe('getMissingChoicesForClass', () => {
        it('should return empty choices when nothing is missing', () => {
            const character = {
                progression: {
                    classes: [{ name: 'Fighter', levels: 1 }],
                },
            };

            const choices = characterValidationService.getMissingChoicesForClass(character, 'Fighter');
            expect(choices.subclass).toBeNull();
            expect(choices.features).toHaveLength(0);
            expect(choices.spells).toBeNull();
            expect(choices.asi).toBeNull();
        });

        it('should filter choices by class name', () => {
            progressionValidatorService.checkSubclass.mockImplementation(
                (_char, _entry, _data, report) => {
                    report.missing.subclasses.push({ class: 'Fighter', level: 3 });
                },
            );

            const character = {
                progression: {
                    classes: [{ name: 'Fighter', levels: 3 }],
                },
            };

            const choices = characterValidationService.getMissingChoicesForClass(character, 'Fighter');
            expect(choices.subclass).not.toBeNull();
            expect(choices.subclass.class).toBe('Fighter');

            const wizardChoices = characterValidationService.getMissingChoicesForClass(character, 'Wizard');
            expect(wizardChoices.subclass).toBeNull();
        });
    });
});
