import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Character } from '../../src/app/Character.js';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';
import { ProficiencyService } from '../../src/services/ProficiencyService.js';

describe('ProficiencyService', () => {
    let proficiencyService;
    let character;

    beforeEach(() => {
        proficiencyService = new ProficiencyService();
        character = new Character();
        vi.clearAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with default values', () => {
            expect(proficiencyService._initialized).toBe(false);
            expect(proficiencyService._skillData).toBe(null);
            expect(proficiencyService._languageData).toBe(null);
        });
    });

    describe('initializeProficiencyStructures', () => {
        it('should initialize proficiency arrays', () => {
            const char = {};
            proficiencyService.initializeProficiencyStructures(char);

            expect(char.proficiencies).toBeDefined();
            expect(char.proficiencies.skills).toEqual([]);
            expect(char.proficiencies.savingThrows).toEqual([]);
            expect(char.proficiencies.languages).toEqual(['Common']); // Default language
            expect(char.proficiencies.tools).toEqual([]);
            expect(char.proficiencies.armor).toEqual([]);
            expect(char.proficiencies.weapons).toEqual([]);
        });

        it('should initialize proficiency source Maps', () => {
            const char = {};
            proficiencyService.initializeProficiencyStructures(char);

            expect(char.proficiencySources).toBeDefined();
            expect(char.proficiencySources.skills).toBeInstanceOf(Map);
            expect(char.proficiencySources.languages).toBeInstanceOf(Map);
            expect(char.proficiencySources.tools).toBeInstanceOf(Map);
        });

        it('should initialize optional proficiency structures', () => {
            const char = {};
            proficiencyService.initializeProficiencyStructures(char);

            expect(char.optionalProficiencies).toBeDefined();
            expect(char.optionalProficiencies.skills).toBeDefined();
            expect(char.optionalProficiencies.skills.race).toEqual({
                allowed: 0,
                options: [],
                selected: [],
            });
            expect(char.optionalProficiencies.skills.class).toEqual({
                allowed: 0,
                options: [],
                selected: [],
            });
            expect(char.optionalProficiencies.skills.background).toEqual({
                allowed: 0,
                options: [],
                selected: [],
            });
        });

        it('should add Common language by default', () => {
            const char = {};
            proficiencyService.initializeProficiencyStructures(char);

            expect(char.proficiencies.languages).toContain('Common');
            expect(char.proficiencySources.languages.has('Common')).toBe(true);
            expect(char.proficiencySources.languages.get('Common')).toContain('Default');
        });

        it('should handle null character gracefully', () => {
            expect(() => proficiencyService.initializeProficiencyStructures(null)).not.toThrow();
        });

        it('should preserve existing proficiencies', () => {
            const char = {
                proficiencies: {
                    skills: ['Athletics'],
                    languages: ['Common', 'Elvish'],
                },
            };
            proficiencyService.initializeProficiencyStructures(char);

            expect(char.proficiencies.skills).toContain('Athletics');
            expect(char.proficiencies.languages).toContain('Elvish');
        });
    });

    describe('addProficiency', () => {
        beforeEach(() => {
            proficiencyService.initializeProficiencyStructures(character);
        });

        it('should add a new proficiency', () => {
            const result = proficiencyService.addProficiency(
                character,
                'skills',
                'Athletics',
                'Race',
            );

            expect(result).toBe(true);
            expect(character.proficiencies.skills).toContain('Athletics');
        });

        it('should track proficiency source', () => {
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Race');

            const sources = proficiencyService.getProficiencySources(
                character,
                'skills',
                'Athletics',
            );
            expect(sources.has('Race')).toBe(true);
        });

        it('should handle duplicate proficiency from same source', () => {
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Race');
            const result = proficiencyService.addProficiency(
                character,
                'skills',
                'Athletics',
                'Race',
            );

            expect(result).toBe(false); // Not a new proficiency
            expect(character.proficiencies.skills).toContain('Athletics');
            expect(character.proficiencies.skills.length).toBe(1);
        });

        it('should track multiple sources for same proficiency', () => {
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Race');
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Background');

            const sources = proficiencyService.getProficiencySources(
                character,
                'skills',
                'Athletics',
            );
            expect(sources.has('Race')).toBe(true);
            expect(sources.has('Background')).toBe(true);
            expect(character.proficiencies.skills.length).toBe(1);
        });

        it('should emit PROFICIENCY_ADDED event', () => {
            const emitSpy = vi.spyOn(eventBus, 'emit');

            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Race');

            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.PROFICIENCY_ADDED,
                expect.objectContaining({
                    type: 'skills',
                    proficiency: 'Athletics',
                    source: 'Race',
                    character,
                }),
            );
        });

        it('should handle invalid parameters gracefully', () => {
            const result = proficiencyService.addProficiency(null, 'skills', 'Athletics', 'Race');
            expect(result).toBe(false);
        });

        it('should handle missing type parameter', () => {
            const result = proficiencyService.addProficiency(
                character,
                null,
                'Athletics',
                'Race',
            );
            expect(result).toBe(false);
        });

        it('should handle missing proficiency parameter', () => {
            const result = proficiencyService.addProficiency(character, 'skills', null, 'Race');
            expect(result).toBe(false);
        });

        it('should handle missing source parameter', () => {
            const result = proficiencyService.addProficiency(
                character,
                'skills',
                'Athletics',
                null,
            );
            expect(result).toBe(false);
        });

        it('should add weapon proficiencies', () => {
            proficiencyService.addProficiency(character, 'weapons', 'Longsword', 'Class');

            expect(character.proficiencies.weapons).toContain('Longsword');
        });

        it('should add armor proficiencies', () => {
            proficiencyService.addProficiency(character, 'armor', 'Light Armor', 'Class');

            expect(character.proficiencies.armor).toContain('Light Armor');
        });

        it('should add tool proficiencies', () => {
            proficiencyService.addProficiency(character, 'tools', "Thieves' Tools", 'Background');

            expect(character.proficiencies.tools).toContain("Thieves' Tools");
        });

        it('should add language proficiencies', () => {
            proficiencyService.addProficiency(character, 'languages', 'Elvish', 'Race');

            expect(character.proficiencies.languages).toContain('Elvish');
        });

        it('should add saving throw proficiencies', () => {
            proficiencyService.addProficiency(character, 'savingThrows', 'Strength', 'Class');

            expect(character.proficiencies.savingThrows).toContain('Strength');
        });
    });

    describe('removeProficienciesBySource', () => {
        beforeEach(() => {
            proficiencyService.initializeProficiencyStructures(character);
        });

        it('should remove proficiencies from a specific source', () => {
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Race');
            proficiencyService.addProficiency(character, 'skills', 'Acrobatics', 'Race');
            proficiencyService.addProficiency(character, 'skills', 'Stealth', 'Background');

            const removed = proficiencyService.removeProficienciesBySource(character, 'Race');

            expect(removed.skills).toContain('Athletics');
            expect(removed.skills).toContain('Acrobatics');
            expect(removed.skills).not.toContain('Stealth');
            expect(character.proficiencies.skills).not.toContain('Athletics');
            expect(character.proficiencies.skills).not.toContain('Acrobatics');
            expect(character.proficiencies.skills).toContain('Stealth');
        });

        it('should keep proficiency if it has other sources', () => {
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Race');
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Background');

            proficiencyService.removeProficienciesBySource(character, 'Race');

            expect(character.proficiencies.skills).toContain('Athletics');
            const sources = proficiencyService.getProficiencySources(
                character,
                'skills',
                'Athletics',
            );
            expect(sources.has('Race')).toBe(false);
            expect(sources.has('Background')).toBe(true);
        });

        it('should emit PROFICIENCY_REMOVED_BY_SOURCE event', () => {
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Race');
            const emitSpy = vi.spyOn(eventBus, 'emit');

            proficiencyService.removeProficienciesBySource(character, 'Race');

            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.PROFICIENCY_REMOVED_BY_SOURCE,
                expect.objectContaining({
                    source: 'Race',
                    removed: expect.any(Object),
                    character,
                }),
            );
        });

        it('should handle null character gracefully', () => {
            const result = proficiencyService.removeProficienciesBySource(null, 'Race');
            expect(result).toEqual({});
        });

        it('should handle null source gracefully', () => {
            const result = proficiencyService.removeProficienciesBySource(character, null);
            expect(result).toEqual({});
        });

        it('should remove proficiencies across multiple types', () => {
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Race');
            proficiencyService.addProficiency(character, 'languages', 'Elvish', 'Race');
            proficiencyService.addProficiency(character, 'weapons', 'Longsword', 'Race');

            const removed = proficiencyService.removeProficienciesBySource(character, 'Race');

            expect(removed.skills).toContain('Athletics');
            expect(removed.languages).toContain('Elvish');
            expect(removed.weapons).toContain('Longsword');
        });

        it('should return empty object if character has no proficiencySources', () => {
            const char = {};
            const removed = proficiencyService.removeProficienciesBySource(char, 'Race');

            expect(removed).toEqual({});
        });
    });

    describe('getProficiencySources', () => {
        beforeEach(() => {
            proficiencyService.initializeProficiencyStructures(character);
        });

        it('should return Set of sources for a proficiency', () => {
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Race');
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Background');

            const sources = proficiencyService.getProficiencySources(
                character,
                'skills',
                'Athletics',
            );

            expect(sources).toBeInstanceOf(Set);
            expect(sources.size).toBe(2);
            expect(sources.has('Race')).toBe(true);
            expect(sources.has('Background')).toBe(true);
        });

        it('should return empty Set for non-existent proficiency', () => {
            const sources = proficiencyService.getProficiencySources(
                character,
                'skills',
                'NonExistent',
            );

            expect(sources).toBeInstanceOf(Set);
            expect(sources.size).toBe(0);
        });

        it('should handle null character gracefully', () => {
            const sources = proficiencyService.getProficiencySources(null, 'skills', 'Athletics');

            expect(sources).toBeInstanceOf(Set);
            expect(sources.size).toBe(0);
        });
    });

    describe('setOptionalProficiencies', () => {
        beforeEach(() => {
            proficiencyService.initializeProficiencyStructures(character);
        });

        it('should set optional proficiency choices', () => {
            proficiencyService.setOptionalProficiencies(
                character,
                'skills',
                'race',
                2,
                ['Athletics', 'Acrobatics', 'Perception'],
            );

            expect(character.optionalProficiencies.skills.race.allowed).toBe(2);
            expect(character.optionalProficiencies.skills.race.options).toEqual([
                'Athletics',
                'Acrobatics',
                'Perception',
            ]);
        });

        it('should recalculate overall optional proficiencies', () => {
            proficiencyService.setOptionalProficiencies(
                character,
                'skills',
                'race',
                2,
                ['Athletics', 'Acrobatics'],
            );
            proficiencyService.setOptionalProficiencies(
                character,
                'skills',
                'class',
                3,
                ['Stealth', 'Perception'],
            );

            expect(character.optionalProficiencies.skills.allowed).toBe(5);
            expect(character.optionalProficiencies.skills.options.length).toBeGreaterThan(0);
        });

        it('should emit PROFICIENCY_OPTIONAL_CONFIGURED event', () => {
            const emitSpy = vi.spyOn(eventBus, 'emit');

            proficiencyService.setOptionalProficiencies(
                character,
                'skills',
                'race',
                2,
                ['Athletics', 'Acrobatics'],
            );

            expect(emitSpy).toHaveBeenCalledWith(
                EVENTS.PROFICIENCY_OPTIONAL_CONFIGURED,
                expect.objectContaining({
                    type: 'skills',
                    source: 'race',
                    allowed: 2,
                    character,
                }),
            );
        });

        it('should handle null character gracefully', () => {
            expect(() =>
                proficiencyService.setOptionalProficiencies(
                    null,
                    'skills',
                    'race',
                    2,
                    ['Athletics'],
                ),
            ).not.toThrow();
        });

        it('should handle missing type parameter', () => {
            expect(() =>
                proficiencyService.setOptionalProficiencies(
                    character,
                    null,
                    'race',
                    2,
                    ['Athletics'],
                ),
            ).not.toThrow();
        });

        it('should handle missing source parameter', () => {
            expect(() =>
                proficiencyService.setOptionalProficiencies(
                    character,
                    'skills',
                    null,
                    2,
                    ['Athletics'],
                ),
            ).not.toThrow();
        });

        it('should create optional proficiency structure if missing', () => {
            const char = {};
            proficiencyService.setOptionalProficiencies(
                char,
                'skills',
                'race',
                2,
                ['Athletics'],
            );

            expect(char.optionalProficiencies).toBeDefined();
            expect(char.optionalProficiencies.skills).toBeDefined();
        });

        it('should handle language optional proficiencies', () => {
            proficiencyService.setOptionalProficiencies(
                character,
                'languages',
                'race',
                1,
                ['Elvish', 'Dwarvish', 'Orc'],
            );

            expect(character.optionalProficiencies.languages.race.allowed).toBe(1);
            expect(character.optionalProficiencies.languages.race.options).toEqual([
                'Elvish',
                'Dwarvish',
                'Orc',
            ]);
        });

        it('should handle tool optional proficiencies', () => {
            proficiencyService.setOptionalProficiencies(
                character,
                'tools',
                'background',
                1,
                ["Thieves' Tools", "Tinker's Tools"],
            );

            expect(character.optionalProficiencies.tools.background.allowed).toBe(1);
            expect(character.optionalProficiencies.tools.background.options).toHaveLength(2);
        });
    });

    describe('Edge Cases', () => {
        beforeEach(() => {
            proficiencyService.initializeProficiencyStructures(character);
        });

        it('should handle case-insensitive proficiency matching', () => {
            proficiencyService.addProficiency(character, 'skills', 'Athletics', 'Race');
            proficiencyService.addProficiency(character, 'skills', 'ATHLETICS', 'Background');

            // Should be treated as the same proficiency
            expect(character.proficiencies.skills.length).toBe(1);
            const sources = proficiencyService.getProficiencySources(
                character,
                'skills',
                'Athletics',
            );
            expect(sources.size).toBe(2);
        });

        it('should handle proficiencies with special characters', () => {
            proficiencyService.addProficiency(character, 'tools', "Thieves' Tools", 'Background');

            expect(character.proficiencies.tools).toContain("Thieves' Tools");
        });

        it('should handle empty proficiency name', () => {
            const result = proficiencyService.addProficiency(character, 'skills', '', 'Race');
            expect(result).toBe(false);
        });

        it('should handle whitespace-only proficiency name', () => {
            // Note: ProficiencyService currently allows whitespace-only names
            // This could be improved with validation in a future update
            const result = proficiencyService.addProficiency(character, 'skills', '   ', 'Race');
            expect(result).toBe(true); // Currently accepts whitespace
        });

        it('should allow removing proficiencies from non-existent source', () => {
            const removed = proficiencyService.removeProficienciesBySource(
                character,
                'NonExistentSource',
            );
            expect(removed).toEqual(expect.any(Object));
        });
    });

    describe('Integration', () => {
        it('should work with Character class', () => {
            const char = new Character();

            char.addProficiency('skills', 'Athletics', 'Race');
            char.addProficiency('skills', 'Acrobatics', 'Race');
            char.addProficiency('languages', 'Elvish', 'Race');

            expect(char.proficiencies.skills).toContain('Athletics');
            expect(char.proficiencies.skills).toContain('Acrobatics');
            expect(char.proficiencies.languages).toContain('Elvish');

            const removed = char.removeProficienciesBySource('Race');

            expect(removed.skills).toContain('Athletics');
            expect(removed.skills).toContain('Acrobatics');
            expect(removed.languages).toContain('Elvish');
            expect(char.proficiencies.skills).not.toContain('Athletics');
            expect(char.proficiencies.languages).not.toContain('Elvish');
        });
    });
});
