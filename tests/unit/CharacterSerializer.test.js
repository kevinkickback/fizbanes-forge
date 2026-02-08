import { beforeEach, describe, expect, it } from 'vitest';
import { Character } from '../../src/app/Character.js';
import * as CharacterSerializer from '../../src/app/CharacterSerializer.js';

describe('CharacterSerializer', () => {
    let character;

    beforeEach(() => {
        character = new Character({
            id: 'test-123',
            name: 'Fizban',
            playerName: 'Kevin',
            race: {
                name: 'Human',
                source: 'PHB',
                subrace: '',
                abilityChoices: [],
            },
            abilityScores: {
                strength: 15,
                dexterity: 14,
                constitution: 13,
                intelligence: 12,
                wisdom: 10,
                charisma: 8,
            },
        });
    });

    describe('serialize()', () => {
        it('should serialize a character to plain object', () => {
            const serialized = CharacterSerializer.serialize(character);

            expect(serialized).toBeDefined();
            expect(serialized.id).toBe('test-123');
            expect(serialized.name).toBe('Fizban');
            expect(serialized.playerName).toBe('Kevin');
        });

        it('should serialize ability scores', () => {
            const serialized = CharacterSerializer.serialize(character);

            expect(serialized.abilityScores).toEqual({
                strength: 15,
                dexterity: 14,
                constitution: 13,
                intelligence: 12,
                wisdom: 10,
                charisma: 8,
            });
        });

        it('should convert allowedSources Set to Array', () => {
            character.allowedSources = new Set(['PHB', 'XGE', 'TCE']);
            const serialized = CharacterSerializer.serialize(character);

            expect(Array.isArray(serialized.allowedSources)).toBe(true);
            expect(serialized.allowedSources).toContain('PHB');
            expect(serialized.allowedSources).toContain('XGE');
            expect(serialized.allowedSources).toContain('TCE');
        });

        it('should serialize race data', () => {
            const serialized = CharacterSerializer.serialize(character);

            expect(serialized.race).toBeDefined();
            expect(serialized.race.name).toBe('Human');
            expect(serialized.race.source).toBe('PHB');
            expect(serialized.race.subrace).toBe('');
        });

        it('should convert features.resistances Set to Array', () => {
            character.addResistance('fire');
            character.addResistance('cold');
            const serialized = CharacterSerializer.serialize(character);

            expect(Array.isArray(serialized.features.resistances)).toBe(true);
            expect(serialized.features.resistances).toContain('fire');
            expect(serialized.features.resistances).toContain('cold');
        });

        it('should convert features.traits Map to Object', () => {
            character.addTrait('Darkvision', 'See in darkness', 'Race');
            character.addTrait('Lucky', 'Reroll 1s', 'Race');
            const serialized = CharacterSerializer.serialize(character);

            expect(serialized.features.traits).toBeTypeOf('object');
            expect(serialized.features.traits.Darkvision).toBeDefined();
            expect(serialized.features.traits.Lucky).toBeDefined();
        });

        it('should serialize proficiencies arrays', () => {
            character.addProficiency('skills', 'Athletics', 'Class');
            character.addProficiency('weapons', 'Longsword', 'Race');
            const serialized = CharacterSerializer.serialize(character);

            expect(Array.isArray(serialized.proficiencies.skills)).toBe(true);
            expect(Array.isArray(serialized.proficiencies.weapons)).toBe(true);
            expect(serialized.proficiencies.skills).toContain('Athletics');
            expect(serialized.proficiencies.weapons).toContain('Longsword');
        });

        it('should convert proficiencySources Maps to Objects', () => {
            character.addProficiency('skills', 'Athletics', 'Class');
            const serialized = CharacterSerializer.serialize(character);

            expect(serialized.proficiencySources).toBeDefined();
            expect(serialized.proficiencySources.skills).toBeTypeOf('object');
            expect(serialized.proficiencySources.skills.Athletics).toBeDefined();
            expect(Array.isArray(serialized.proficiencySources.skills.Athletics)).toBe(true);
        });

        it('should serialize feats with sources', () => {
            character.setFeats([
                { name: 'Great Weapon Master' },
                { name: 'Alert' },
            ], 'Level 4');
            const serialized = CharacterSerializer.serialize(character);

            expect(Array.isArray(serialized.feats)).toBe(true);
            expect(serialized.feats).toHaveLength(2);
            expect(serialized.feats[0].name).toBe('Great Weapon Master');
        });

        it('should update lastModified timestamp', async () => {
            const originalTime = character.lastModified;
            // Wait a tiny bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));
            const serialized = CharacterSerializer.serialize(character);

            expect(serialized.lastModified).toBeDefined();
            expect(new Date(serialized.lastModified).getTime()).toBeGreaterThan(
                new Date(originalTime).getTime()
            );
        });

        it('should handle null character', () => {
            const serialized = CharacterSerializer.serialize(null);
            expect(serialized).toBe(null);
        });

        it('should handle character with minimal data', () => {
            const minimal = new Character();
            const serialized = CharacterSerializer.serialize(minimal);

            expect(serialized).toBeDefined();
            expect(serialized.name).toBe('');
            expect(serialized.proficiencies).toBeDefined();
        });

        it('should serialize speed object', () => {
            character.speed = { walk: 30, fly: 15, swim: 0 };
            const serialized = CharacterSerializer.serialize(character);

            expect(serialized.speed).toEqual({ walk: 30, fly: 15, swim: 0 });
        });

        it('should preserve inventory structure', () => {
            character.inventory.items = [{ name: 'Sword', qty: 1 }];
            const serialized = CharacterSerializer.serialize(character);

            expect(serialized.inventory).toBeDefined();
            expect(serialized.inventory.items).toHaveLength(1);
        });

        it('should preserve spellcasting structure', () => {
            character.spellcasting.classes = {
                Wizard: { spellsKnown: ['Fireball'] },
            };
            const serialized = CharacterSerializer.serialize(character);

            expect(serialized.spellcasting).toBeDefined();
            expect(serialized.spellcasting.classes.Wizard).toBeDefined();
        });
    });

    describe('deserialize()', () => {
        it('should deserialize a plain object to Character', () => {
            const data = {
                id: 'test-456',
                name: 'Tasha',
                playerName: 'Jane',
                abilityScores: {
                    strength: 10,
                    dexterity: 14,
                    constitution: 12,
                    intelligence: 16,
                    wisdom: 13,
                    charisma: 8,
                },
            };

            const deserialized = CharacterSerializer.deserialize(data);

            expect(deserialized).toBeInstanceOf(Character);
            expect(deserialized.id).toBe('test-456');
            expect(deserialized.name).toBe('Tasha');
            expect(deserialized.abilityScores.intelligence).toBe(16);
        });

        it('should restore allowedSources as Set', () => {
            const data = {
                allowedSources: ['PHB', 'XGE'],
            };

            const deserialized = CharacterSerializer.deserialize(data);

            expect(deserialized.allowedSources).toBeInstanceOf(Set);
            expect(deserialized.allowedSources.has('PHB')).toBe(true);
            expect(deserialized.allowedSources.has('XGE')).toBe(true);
        });

        it('should handle null data', () => {
            const deserialized = CharacterSerializer.deserialize(null);
            expect(deserialized).toBe(null);
        });

        it('should handle undefined data', () => {
            const deserialized = CharacterSerializer.deserialize(undefined);
            expect(deserialized).toBe(null);
        });
    });

    describe('Round-trip serialization', () => {
        it('should survive serialize/deserialize cycle', () => {
            character.addProficiency('skills', 'Athletics', 'Class');
            character.addResistance('fire');
            character.addTrait('Darkvision', 'See in darkness', 'Race');
            character.addAbilityBonus('strength', 2, 'Race');

            const serialized = CharacterSerializer.serialize(character);
            const deserialized = CharacterSerializer.deserialize(serialized);

            expect(deserialized.id).toBe(character.id);
            expect(deserialized.name).toBe(character.name);
            expect(deserialized.proficiencies.skills).toContain('Athletics');
            expect(deserialized.features.resistances.has('fire')).toBe(true);
            expect(deserialized.features.traits.has('Darkvision')).toBe(true);
            expect(deserialized.abilityBonuses.strength).toHaveLength(1);
        });

        it('should preserve complex nested structures', () => {
            character.optionalProficiencies.skills.allowed = 2;
            character.optionalProficiencies.skills.selected = ['Athletics', 'Acrobatics'];

            const serialized = CharacterSerializer.serialize(character);
            const deserialized = CharacterSerializer.deserialize(serialized);

            expect(deserialized.optionalProficiencies.skills.allowed).toBe(2);
            expect(deserialized.optionalProficiencies.skills.selected).toHaveLength(2);
        });

        it('should handle JSON.stringify/parse', () => {
            character.addProficiency('weapons', 'Longbow', 'Class');

            const serialized = CharacterSerializer.serialize(character);
            const json = JSON.stringify(serialized);
            const parsed = JSON.parse(json);
            const deserialized = CharacterSerializer.deserialize(parsed);

            expect(deserialized.proficiencies.weapons).toContain('Longbow');
        });
    });

    describe('Edge Cases', () => {
        it('should handle character with Set in proficiencySources', () => {
            // Simulate Map with Set values
            character.proficiencySources.skills.set('Athletics', new Set(['Class', 'Background']));

            const serialized = CharacterSerializer.serialize(character);

            expect(Array.isArray(serialized.proficiencySources.skills.Athletics)).toBe(true);
            expect(serialized.proficiencySources.skills.Athletics).toContain('Class');
            expect(serialized.proficiencySources.skills.Athletics).toContain('Background');
        });

        it('should handle empty arrays and collections', () => {
            const minimal = new Character();
            const serialized = CharacterSerializer.serialize(minimal);

            expect(serialized.proficiencies.skills).toEqual([]);
            expect(serialized.features.resistances).toEqual([]);
            expect(serialized.feats).toEqual([]);
        });

        it('should handle missing optional fields', () => {
            const data = { name: 'Test' };
            const deserialized = CharacterSerializer.deserialize(data);

            expect(deserialized.name).toBe('Test');
            expect(deserialized.proficiencies).toBeDefined();
            expect(deserialized.features).toBeDefined();
        });
    });
});
