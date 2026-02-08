import { describe, expect, it } from 'vitest';
import {
    abilityBonusSchema,
    abilitySchema,
    abilityScoresSchema,
    addProficiencySchema,
    backgroundIdentifierSchema,
    classIdentifierSchema,
    featIdentifierSchema,
    itemFilterSchema,
    itemIdentifierSchema,
    levelSchema,
    nameSchema,
    optionalSourceSchema,
    proficiencyTypeSchema,
    raceIdentifierSchema,
    sourceArraySchema,
    sourceSchema,
    spellFilterSchema,
    spellIdentifierSchema,
    subclassIdentifierSchema,
    subraceIdentifierSchema,
    validateInput,
    ValidationError,
} from '../../src/lib/ValidationSchemas.js';

describe('ValidationSchemas', () => {
    describe('Basic Schemas', () => {
        it('should validate source', () => {
            const result = sourceSchema.parse('phb');
            expect(result).toBe('PHB'); // Should be uppercase
        });

        it('should reject empty source', () => {
            expect(() => sourceSchema.parse('')).toThrow();
        });

        it('should validate name', () => {
            const result = nameSchema.parse('Elf');
            expect(result).toBe('Elf');
        });

        it('should reject empty name', () => {
            expect(() => nameSchema.parse('')).toThrow();
        });

        it('should provide default for optional source', () => {
            const result = optionalSourceSchema.parse(undefined);
            expect(result).toBe('PHB');
        });

        it('should uppercase optional source', () => {
            const result = optionalSourceSchema.parse('xge');
            expect(result).toBe('XGE');
        });
    });

    describe('Race Schemas', () => {
        it('should validate race identifier', () => {
            const result = raceIdentifierSchema.parse({
                name: 'Elf',
                source: 'PHB',
            });

            expect(result.name).toBe('Elf');
            expect(result.source).toBe('PHB');
        });

        it('should provide default source for race', () => {
            const result = raceIdentifierSchema.parse({
                name: 'Elf',
            });

            expect(result.source).toBe('PHB');
        });

        it('should validate subrace identifier', () => {
            const result = subraceIdentifierSchema.parse({
                raceName: 'Elf',
                subraceName: 'High Elf',
                source: 'PHB',
                raceSource: 'PHB',
            });

            expect(result.raceName).toBe('Elf');
            expect(result.subraceName).toBe('High Elf');
        });

        it('should reject empty race name', () => {
            expect(() => raceIdentifierSchema.parse({ name: '' })).toThrow();
        });
    });

    describe('Class Schemas', () => {
        it('should validate class identifier', () => {
            const result = classIdentifierSchema.parse({
                name: 'Wizard',
                source: 'PHB',
            });

            expect(result.name).toBe('Wizard');
            expect(result.source).toBe('PHB');
        });

        it('should validate subclass identifier', () => {
            const result = subclassIdentifierSchema.parse({
                className: 'Wizard',
                subclassName: 'Evocation',
                classSource: 'PHB',
                source: 'PHB',
            });

            expect(result.className).toBe('Wizard');
            expect(result.subclassName).toBe('Evocation');
        });

        it('should allow optional subclassShortName', () => {
            const result = subclassIdentifierSchema.parse({
                className: 'Wizard',
                subclassName: 'Evocation',
                subclassShortName: 'Evo',
            });

            expect(result.subclassShortName).toBe('Evo');
        });
    });

    describe('Background Schema', () => {
        it('should validate background identifier', () => {
            const result = backgroundIdentifierSchema.parse({
                name: 'Acolyte',
                source: 'PHB',
            });

            expect(result.name).toBe('Acolyte');
            expect(result.source).toBe('PHB');
        });
    });

    describe('Spell Schemas', () => {
        it('should validate spell identifier', () => {
            const result = spellIdentifierSchema.parse({
                name: 'Fireball',
                source: 'PHB',
            });

            expect(result.name).toBe('Fireball');
            expect(result.source).toBe('PHB');
        });

        it('should validate spell filter', () => {
            const result = spellFilterSchema.parse({
                level: 3,
                school: 'Evocation',
                classes: ['Wizard', 'Sorcerer'],
                source: 'PHB',
            });

            expect(result.level).toBe(3);
            expect(result.school).toBe('Evocation');
            expect(result.classes).toEqual(['Wizard', 'Sorcerer']);
        });

        it('should reject invalid spell level', () => {
            expect(() => spellFilterSchema.parse({ level: -1 })).toThrow();
            expect(() => spellFilterSchema.parse({ level: 10 })).toThrow();
        });

        it('should allow all optional spell filter fields', () => {
            const result = spellFilterSchema.parse({});
            expect(result).toEqual({});
        });
    });

    describe('Item Schemas', () => {
        it('should validate item identifier', () => {
            const result = itemIdentifierSchema.parse({
                name: 'Longsword',
                source: 'PHB',
            });

            expect(result.name).toBe('Longsword');
            expect(result.source).toBe('PHB');
        });

        it('should validate item filter', () => {
            const result = itemFilterSchema.parse({
                type: 'Weapon',
                rarity: 'Common',
                source: 'PHB',
                attunement: true,
            });

            expect(result.type).toBe('Weapon');
            expect(result.rarity).toBe('Common');
            expect(result.attunement).toBe(true);
        });

        it('should allow all optional item filter fields', () => {
            const result = itemFilterSchema.parse({});
            expect(result).toEqual({});
        });
    });

    describe('Feat Schema', () => {
        it('should validate feat identifier', () => {
            const result = featIdentifierSchema.parse({
                name: 'Alert',
                source: 'PHB',
            });

            expect(result.name).toBe('Alert');
            expect(result.source).toBe('PHB');
        });
    });

    describe('Proficiency Schemas', () => {
        it('should validate proficiency type', () => {
            expect(proficiencyTypeSchema.parse('armor')).toBe('armor');
            expect(proficiencyTypeSchema.parse('weapons')).toBe('weapons');
            expect(proficiencyTypeSchema.parse('skills')).toBe('skills');
        });

        it('should reject invalid proficiency type', () => {
            expect(() => proficiencyTypeSchema.parse('invalid')).toThrow();
        });

        it('should validate add proficiency schema', () => {
            const result = addProficiencySchema.parse({
                type: 'skills',
                proficiency: 'Perception',
                source: 'Race',
            });

            expect(result.type).toBe('skills');
            expect(result.proficiency).toBe('Perception');
            expect(result.source).toBe('Race');
        });

        it('should reject invalid proficiency data', () => {
            expect(() => addProficiencySchema.parse({
                type: 'invalid',
                proficiency: 'Test',
                source: 'Source',
            })).toThrow();
        });
    });

    describe('Ability Schemas', () => {
        it('should validate full ability names', () => {
            expect(abilitySchema.parse('strength')).toBe('strength');
            expect(abilitySchema.parse('dexterity')).toBe('dexterity');
            expect(abilitySchema.parse('constitution')).toBe('constitution');
            expect(abilitySchema.parse('intelligence')).toBe('intelligence');
            expect(abilitySchema.parse('wisdom')).toBe('wisdom');
            expect(abilitySchema.parse('charisma')).toBe('charisma');
        });

        it('should validate abbreviated ability names', () => {
            expect(abilitySchema.parse('str')).toBe('str');
            expect(abilitySchema.parse('dex')).toBe('dex');
            expect(abilitySchema.parse('con')).toBe('con');
            expect(abilitySchema.parse('int')).toBe('int');
            expect(abilitySchema.parse('wis')).toBe('wis');
            expect(abilitySchema.parse('cha')).toBe('cha');
        });

        it('should reject invalid ability names', () => {
            expect(() => abilitySchema.parse('invalid')).toThrow();
        });

        it('should validate ability scores', () => {
            const result = abilityScoresSchema.parse({
                strength: 10,
                dexterity: 12,
                constitution: 14,
                intelligence: 16,
                wisdom: 18,
                charisma: 20,
            });

            expect(result.strength).toBe(10);
            expect(result.charisma).toBe(20);
        });

        it('should reject invalid ability scores', () => {
            expect(() => abilityScoresSchema.parse({
                strength: 0, // Too low
                dexterity: 12,
                constitution: 14,
                intelligence: 16,
                wisdom: 18,
                charisma: 20,
            })).toThrow();

            expect(() => abilityScoresSchema.parse({
                strength: 31, // Too high
                dexterity: 12,
                constitution: 14,
                intelligence: 16,
                wisdom: 18,
                charisma: 20,
            })).toThrow();
        });

        it('should validate ability bonus', () => {
            const result = abilityBonusSchema.parse({
                ability: 'strength',
                value: 2,
                source: 'Race',
            });

            expect(result.ability).toBe('strength');
            expect(result.value).toBe(2);
            expect(result.source).toBe('Race');
        });

        it('should allow negative ability bonus', () => {
            const result = abilityBonusSchema.parse({
                ability: 'strength',
                value: -2,
                source: 'Curse',
            });

            expect(result.value).toBe(-2);
        });
    });

    describe('Level Schema', () => {
        it('should validate valid levels', () => {
            expect(levelSchema.parse(1)).toBe(1);
            expect(levelSchema.parse(10)).toBe(10);
            expect(levelSchema.parse(20)).toBe(20);
        });

        it('should reject invalid levels', () => {
            expect(() => levelSchema.parse(0)).toThrow();
            expect(() => levelSchema.parse(21)).toThrow();
            expect(() => levelSchema.parse(-1)).toThrow();
        });

        it('should reject non-integer levels', () => {
            expect(() => levelSchema.parse(10.5)).toThrow();
        });
    });

    describe('Source Array Schema', () => {
        it('should validate array of sources', () => {
            const result = sourceArraySchema.parse(['phb', 'xge', 'tcoe']);

            expect(result).toEqual(['PHB', 'XGE', 'TCOE']);
        });

        it('should reject array with empty strings', () => {
            expect(() => sourceArraySchema.parse(['PHB', ''])).toThrow();
        });
    });

    describe('validateInput Helper', () => {
        it('should validate and return data on success', () => {
            const result = validateInput(
                nameSchema,
                'Test Name',
                'Invalid name',
            );

            expect(result).toBe('Test Name');
        });

        it('should throw ValidationError on failure', () => {
            expect(() => {
                validateInput(nameSchema, '', 'Name is required');
            }).toThrow(ValidationError);
        });

        it('should include validation details in error', () => {
            try {
                validateInput(levelSchema, 25, 'Invalid level');
                throw new Error('Should have thrown ValidationError');
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);
                expect(error.message).toBe('Invalid level');
                expect(error.details.input).toBe(25);
            }
        });

        it('should transform data during validation', () => {
            const result = validateInput(
                sourceSchema,
                'phb',
                'Invalid source',
            );

            expect(result).toBe('PHB'); // Should be uppercased
        });
    });

    describe('Validation Error', () => {
        it('should create validation error with message', () => {
            const error = new ValidationError('Test error');

            expect(error.name).toBe('ValidationError');
            expect(error.message).toBe('Test error');
        });

        it('should store details', () => {
            const error = new ValidationError('Test error', {
                field: 'name',
                value: '',
            });

            expect(error.details.field).toBe('name');
            expect(error.details.value).toBe('');
        });

        it('should be instance of Error', () => {
            const error = new ValidationError('Test error');

            expect(error).toBeInstanceOf(Error);
        });
    });
});
