import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependent services
vi.mock('../../src/services/RaceService.js', () => ({
    raceService: {
        getRace: vi.fn(),
        getSubrace: vi.fn(),
    },
}));

vi.mock('../../src/services/ClassService.js', () => ({
    classService: {
        getClassFeatures: vi.fn(),
        getSubclass: vi.fn(),
        getSubclassFeatures: vi.fn(),
        getClass: vi.fn(),
    },
}));

vi.mock('../../src/services/BackgroundService.js', () => ({
    backgroundService: {
        getBackground: vi.fn(),
    },
}));

import { backgroundService } from '../../src/services/BackgroundService.js';
import { classService } from '../../src/services/ClassService.js';
import { raceService } from '../../src/services/RaceService.js';
import { rehydrationService } from '../../src/services/RehydrationService.js';

function makeCharacter(overrides = {}) {
    return {
        name: 'TestChar',
        race: { name: 'Human', source: 'PHB' },
        features: {
            traits: new Map(),
            darkvision: 0,
            resistances: new Set(),
        },
        progression: { classes: [] },
        spellcasting: null,
        background: null,
        backgroundFeature: null,
        addTrait: vi.fn(),
        addResistance: vi.fn(),
        ...overrides,
    };
}

describe('RehydrationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        raceService.getRace.mockImplementation(() => { });
        raceService.getSubrace.mockImplementation(() => { });
        classService.getClassFeatures.mockReturnValue([]);
        classService.getSubclass.mockImplementation(() => { });
        classService.getSubclassFeatures.mockReturnValue([]);
        classService.getClass.mockImplementation(() => { });
        backgroundService.getBackground.mockImplementation(() => { });
    });

    describe('rehydrate', () => {
        it('should return empty warnings for null character', () => {
            const result = rehydrationService.rehydrate(null);
            expect(result.warnings).toEqual([]);
        });

        it('should return warnings array on success', () => {
            const character = makeCharacter({ race: null });
            const result = rehydrationService.rehydrate(character);
            expect(result).toHaveProperty('warnings');
            expect(Array.isArray(result.warnings)).toBe(true);
        });
    });

    describe('_rehydrateRacialFeatures', () => {
        it('should skip when no race name', () => {
            const character = makeCharacter({ race: { name: null } });
            const warnings = [];
            rehydrationService._rehydrateRacialFeatures(character, warnings);
            expect(raceService.getRace).not.toHaveBeenCalled();
        });

        it('should add warning when race not found', () => {
            raceService.getRace.mockImplementation(() => { throw new Error('Not found'); });
            const character = makeCharacter();
            const warnings = [];
            rehydrationService._rehydrateRacialFeatures(character, warnings);
            expect(warnings).toContain('Race not found: Human (PHB)');
        });

        it('should rehydrate traits when traits are empty', () => {
            const raceData = {
                entries: [
                    { type: 'entries', name: 'Speed', entries: ['30 ft.'] },
                    { type: 'entries', name: 'Languages', entries: ['Common'] },
                ],
            };
            raceService.getRace.mockReturnValue(raceData);

            const character = makeCharacter();
            const warnings = [];
            rehydrationService._rehydrateRacialFeatures(character, warnings);

            expect(character.addTrait).toHaveBeenCalledTimes(2);
            expect(character.addTrait).toHaveBeenCalledWith('Speed', raceData.entries[0], 'Race');
        });

        it('should not overwrite existing traits', () => {
            raceService.getRace.mockReturnValue({ entries: [{ type: 'entries', name: 'Speed' }] });
            const character = makeCharacter();
            character.features.traits.set('ExistingTrait', { source: 'Race' });

            const warnings = [];
            rehydrationService._rehydrateRacialFeatures(character, warnings);
            expect(character.addTrait).not.toHaveBeenCalled();
        });

        it('should rehydrate darkvision when unset', () => {
            raceService.getRace.mockReturnValue({ darkvision: 60, entries: [] });
            const character = makeCharacter();
            const warnings = [];
            rehydrationService._rehydrateRacialFeatures(character, warnings);
            expect(character.features.darkvision).toBe(60);
        });

        it('should not overwrite existing darkvision', () => {
            raceService.getRace.mockReturnValue({ darkvision: 60, entries: [] });
            const character = makeCharacter();
            character.features.darkvision = 120;
            const warnings = [];
            rehydrationService._rehydrateRacialFeatures(character, warnings);
            expect(character.features.darkvision).toBe(120);
        });

        it('should rehydrate resistances when empty', () => {
            raceService.getRace.mockReturnValue({ resist: ['fire', 'poison'], entries: [] });
            const character = makeCharacter();
            const warnings = [];
            rehydrationService._rehydrateRacialFeatures(character, warnings);
            expect(character.addResistance).toHaveBeenCalledWith('fire');
            expect(character.addResistance).toHaveBeenCalledWith('poison');
        });

        it('should skip choice-based resistances', () => {
            raceService.getRace.mockReturnValue({ resist: [{ choose: { from: ['fire', 'cold'] } }], entries: [] });
            const character = makeCharacter();
            const warnings = [];
            rehydrationService._rehydrateRacialFeatures(character, warnings);
            expect(character.addResistance).not.toHaveBeenCalled();
        });

        it('should warn when subrace not found', () => {
            raceService.getRace.mockReturnValue({ entries: [{ type: 'entries', name: 'Trait' }] });
            raceService.getSubrace.mockImplementation(() => { throw new Error('Not found'); });
            const character = makeCharacter({ race: { name: 'Elf', source: 'PHB', subrace: 'High Elf' } });
            const warnings = [];
            rehydrationService._rehydrateRacialFeatures(character, warnings);
            expect(warnings).toContain('Subrace not found: High Elf');
        });
    });

    describe('_rehydrateClassFeatures', () => {
        it('should skip when no classes', () => {
            const character = makeCharacter();
            const warnings = [];
            rehydrationService._rehydrateClassFeatures(character, warnings);
            expect(classService.getClassFeatures).not.toHaveBeenCalled();
        });

        it('should add class features when none exist', () => {
            const features = [
                { name: 'Second Wind', entries: [] },
                { name: 'Action Surge', entries: [] },
            ];
            classService.getClassFeatures.mockReturnValue(features);

            const character = makeCharacter({
                progression: { classes: [{ name: 'Fighter', levels: 2, source: 'PHB' }] },
            });
            const warnings = [];
            rehydrationService._rehydrateClassFeatures(character, warnings);

            expect(character.addTrait).toHaveBeenCalledTimes(2);
            expect(character.addTrait).toHaveBeenCalledWith('Second Wind', features[0], 'Fighter');
        });

        it('should not overwrite existing class features', () => {
            const character = makeCharacter({
                progression: { classes: [{ name: 'Fighter', levels: 2 }] },
            });
            character.features.traits.set('Second Wind', { source: 'Fighter' });

            const warnings = [];
            rehydrationService._rehydrateClassFeatures(character, warnings);
            expect(character.addTrait).not.toHaveBeenCalled();
        });

        it('should warn when class features fail to load', () => {
            classService.getClassFeatures.mockImplementation(() => { throw new Error('Failed'); });
            const character = makeCharacter({
                progression: { classes: [{ name: 'Fighter', levels: 2, source: 'PHB' }] },
            });
            const warnings = [];
            rehydrationService._rehydrateClassFeatures(character, warnings);
            expect(warnings).toContain('Class features not found: Fighter');
        });

        it('should warn when subclass features fail to load', () => {
            classService.getClassFeatures.mockReturnValue([]);
            classService.getSubclass.mockImplementation(() => { throw new Error('Not found'); });
            const character = makeCharacter({
                progression: { classes: [{ name: 'Fighter', levels: 3, subclass: 'Champion' }] },
            });
            const warnings = [];
            rehydrationService._rehydrateClassFeatures(character, warnings);
            expect(warnings).toContain('Subclass features not found: Champion');
        });
    });

    describe('_rehydrateBackgroundFeature', () => {
        it('should skip when no background', () => {
            const character = makeCharacter();
            const warnings = [];
            rehydrationService._rehydrateBackgroundFeature(character, warnings);
            expect(backgroundService.getBackground).not.toHaveBeenCalled();
        });

        it('should skip when backgroundFeature already exists', () => {
            const character = makeCharacter({
                background: { name: 'Acolyte', source: 'PHB' },
                backgroundFeature: 'Existing feature',
            });
            const warnings = [];
            rehydrationService._rehydrateBackgroundFeature(character, warnings);
            expect(backgroundService.getBackground).not.toHaveBeenCalled();
        });

        it('should rehydrate background feature from data', () => {
            backgroundService.getBackground.mockReturnValue({
                entries: [
                    {
                        type: 'entries',
                        name: 'Feature: Shelter of the Faithful',
                        entries: ['As an acolyte, you command the respect.'],
                    },
                ],
            });

            const character = makeCharacter({
                background: { name: 'Acolyte', source: 'PHB' },
            });
            const warnings = [];
            rehydrationService._rehydrateBackgroundFeature(character, warnings);
            expect(character.backgroundFeature).toContain('Feature: Shelter of the Faithful');
        });

        it('should warn when background not found', () => {
            backgroundService.getBackground.mockImplementation(() => { throw new Error('Not found'); });
            const character = makeCharacter({
                background: { name: 'Custom', source: 'PHB' },
            });
            const warnings = [];
            rehydrationService._rehydrateBackgroundFeature(character, warnings);
            expect(warnings).toContain('Background not found: Custom (PHB)');
        });
    });

    describe('_rehydrateSpellcasting', () => {
        it('should skip when no classes', () => {
            const character = makeCharacter();
            const warnings = [];
            rehydrationService._rehydrateSpellcasting(character, warnings);
            expect(classService.getClass).not.toHaveBeenCalled();
        });

        it('should initialize spellcasting structure when null', () => {
            classService.getClass.mockReturnValue({ spellcastingAbility: 'int' });
            const character = makeCharacter({
                progression: { classes: [{ name: 'Wizard', levels: 1 }] },
            });
            const warnings = [];
            rehydrationService._rehydrateSpellcasting(character, warnings);

            expect(character.spellcasting).not.toBeNull();
            expect(character.spellcasting.classes.Wizard).toBeDefined();
            expect(character.spellcasting.classes.Wizard.spellcastingAbility).toBe('intelligence');
        });

        it('should patch existing entry missing spellcastingAbility', () => {
            classService.getClass.mockReturnValue({ spellcastingAbility: 'cha' });
            const character = makeCharacter({
                progression: { classes: [{ name: 'Sorcerer', levels: 3 }] },
                spellcasting: {
                    classes: { Sorcerer: { spellsKnown: ['Fireball'], level: 3 } },
                    multiclass: { isCastingMulticlass: false, combinedSlots: {} },
                    other: { spellsKnown: [], itemSpells: [] },
                },
            });
            const warnings = [];
            rehydrationService._rehydrateSpellcasting(character, warnings);

            expect(character.spellcasting.classes.Sorcerer.spellcastingAbility).toBe('charisma');
            expect(character.spellcasting.classes.Sorcerer.spellsKnown).toEqual(['Fireball']);
        });

        it('should skip class entry that already has spellcastingAbility', () => {
            classService.getClass.mockReturnValue({ spellcastingAbility: 'int' });
            const character = makeCharacter({
                progression: { classes: [{ name: 'Wizard', levels: 5 }] },
                spellcasting: {
                    classes: { Wizard: { spellcastingAbility: 'intelligence', level: 5 } },
                    multiclass: { isCastingMulticlass: false, combinedSlots: {} },
                    other: { spellsKnown: [], itemSpells: [] },
                },
            });
            const warnings = [];
            rehydrationService._rehydrateSpellcasting(character, warnings);

            // getClass should still be called but the entry should not be modified
            expect(character.spellcasting.classes.Wizard.level).toBe(5);
        });

        it('should skip non-caster classes', () => {
            classService.getClass.mockReturnValue({ spellcastingAbility: null });
            const character = makeCharacter({
                progression: { classes: [{ name: 'Fighter', levels: 1 }] },
                spellcasting: {
                    classes: {},
                    multiclass: { isCastingMulticlass: false, combinedSlots: {} },
                    other: { spellsKnown: [], itemSpells: [] },
                },
            });
            const warnings = [];
            rehydrationService._rehydrateSpellcasting(character, warnings);

            expect(character.spellcasting.classes.Fighter).toBeUndefined();
        });
    });
});
