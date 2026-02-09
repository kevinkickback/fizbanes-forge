import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/lib/Errors.js';
import {
    abilityBonusSchema,
    abilitySchema,
    abilityScoresSchema,
    addClassLevelArgsSchema,
    addItemArgsSchema,
    addProficiencySchema,
    addSpellArgsSchema,
    backgroundIdentifierSchema,
    classIdentifierSchema,
    featIdentifierSchema,
    handleAbilityChoiceArgsSchema,
    itemFilterSchema,
    itemIdentifierSchema,
    levelSchema,
    nameSchema,
    optionalSourceSchema,
    proficiencyTypeSchema,
    raceIdentifierSchema,
    removeClassLevelArgsSchema,
    removeItemArgsSchema,
    removeSpellArgsSchema,
    sourceArraySchema,
    sourceIdentifierSchema,
    sourceSchema,
    spellFilterSchema,
    spellIdentifierSchema,
    subclassIdentifierSchema,
    subraceIdentifierSchema,
    updateAbilityScoreArgsSchema,
    validateInput,
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

    describe('AbilityScoreService Schemas', () => {
        it('should validate updateAbilityScore args', () => {
            const result = updateAbilityScoreArgsSchema.parse({
                ability: 'strength',
                score: 15,
            });

            expect(result.ability).toBe('strength');
            expect(result.score).toBe(15);
        });

        it('should coerce string score to number', () => {
            const result = updateAbilityScoreArgsSchema.parse({
                ability: 'dex',
                score: '12',
            });

            expect(result.score).toBe(12);
        });

        it('should reject score out of range', () => {
            expect(() => updateAbilityScoreArgsSchema.parse({
                ability: 'str',
                score: 0,
            })).toThrow();

            expect(() => updateAbilityScoreArgsSchema.parse({
                ability: 'str',
                score: 31,
            })).toThrow();
        });

        it('should reject empty ability name', () => {
            expect(() => updateAbilityScoreArgsSchema.parse({
                ability: '',
                score: 10,
            })).toThrow();
        });

        it('should validate handleAbilityChoice args', () => {
            const result = handleAbilityChoiceArgsSchema.parse({
                ability: 'wisdom',
                choiceIndex: 0,
                bonus: 2,
                source: 'Race Choice',
            });

            expect(result.ability).toBe('wisdom');
            expect(result.choiceIndex).toBe(0);
            expect(result.bonus).toBe(2);
            expect(result.source).toBe('Race Choice');
        });

        it('should reject negative choiceIndex', () => {
            expect(() => handleAbilityChoiceArgsSchema.parse({
                ability: 'str',
                choiceIndex: -1,
                bonus: 1,
                source: 'Race',
            })).toThrow();
        });
    });

    describe('LevelUpService Schemas', () => {
        it('should validate addClassLevel args', () => {
            const result = addClassLevelArgsSchema.parse({
                character: { progression: { classes: [] } },
                className: 'Fighter',
                level: 5,
                source: 'PHB',
            });

            expect(result.className).toBe('Fighter');
            expect(result.level).toBe(5);
            expect(result.source).toBe('PHB');
        });

        it('should provide defaults for level and source', () => {
            const result = addClassLevelArgsSchema.parse({
                character: { name: 'Test' },
                className: 'Wizard',
            });

            expect(result.level).toBe(1);
            expect(result.source).toBe('PHB');
        });

        it('should reject empty className', () => {
            expect(() => addClassLevelArgsSchema.parse({
                character: { name: 'Test' },
                className: '',
            })).toThrow();
        });

        it('should reject level out of range', () => {
            expect(() => addClassLevelArgsSchema.parse({
                character: { name: 'Test' },
                className: 'Fighter',
                level: 0,
            })).toThrow();

            expect(() => addClassLevelArgsSchema.parse({
                character: { name: 'Test' },
                className: 'Fighter',
                level: 21,
            })).toThrow();
        });

        it('should reject non-object character', () => {
            expect(() => addClassLevelArgsSchema.parse({
                character: null,
                className: 'Fighter',
            })).toThrow();
        });

        it('should validate removeClassLevel args', () => {
            const result = removeClassLevelArgsSchema.parse({
                character: { progression: { classes: [{ name: 'Fighter' }] } },
                className: 'Fighter',
            });

            expect(result.className).toBe('Fighter');
        });
    });

    describe('EquipmentService Schemas', () => {
        it('should validate addItem args', () => {
            const result = addItemArgsSchema.parse({
                character: { inventory: { items: [] } },
                itemData: { name: 'Longsword' },
            });

            expect(result.itemData.name).toBe('Longsword');
            expect(result.quantity).toBe(1);
            expect(result.source).toBe('Manual');
        });

        it('should validate addItem with full data', () => {
            const result = addItemArgsSchema.parse({
                character: { inventory: { items: [] } },
                itemData: {
                    name: 'Longsword',
                    id: 'longsword',
                    source: 'PHB',
                    weight: 3,
                },
                quantity: 2,
                source: 'Shop',
            });

            expect(result.itemData.name).toBe('Longsword');
            expect(result.quantity).toBe(2);
            expect(result.source).toBe('Shop');
        });

        it('should reject item without name', () => {
            expect(() => addItemArgsSchema.parse({
                character: { inventory: { items: [] } },
                itemData: { id: 'test' },
            })).toThrow();
        });

        it('should validate removeItem args', () => {
            const result = removeItemArgsSchema.parse({
                character: { inventory: { items: [] } },
                itemInstanceId: 'item-123',
            });

            expect(result.itemInstanceId).toBe('item-123');
            expect(result.quantity).toBe(1);
        });

        it('should reject empty itemInstanceId', () => {
            expect(() => removeItemArgsSchema.parse({
                character: { inventory: { items: [] } },
                itemInstanceId: '',
            })).toThrow();
        });
    });

    describe('SpellSelectionService Schemas', () => {
        it('should validate addSpell args', () => {
            const result = addSpellArgsSchema.parse({
                character: { spellcasting: { classes: {} } },
                className: 'Wizard',
                spellData: { name: 'Fireball', level: 3 },
            });

            expect(result.className).toBe('Wizard');
            expect(result.spellData.name).toBe('Fireball');
            expect(result.spellData.level).toBe(3);
        });

        it('should pass through extra spellData properties', () => {
            const result = addSpellArgsSchema.parse({
                character: { name: 'Test' },
                className: 'Wizard',
                spellData: { name: 'Fireball', level: 3, source: 'PHB', school: 'Evocation' },
            });

            expect(result.spellData.source).toBe('PHB');
            expect(result.spellData.school).toBe('Evocation');
        });

        it('should reject invalid spell level', () => {
            expect(() => addSpellArgsSchema.parse({
                character: { name: 'Test' },
                className: 'Wizard',
                spellData: { name: 'Fireball', level: -1 },
            })).toThrow();

            expect(() => addSpellArgsSchema.parse({
                character: { name: 'Test' },
                className: 'Wizard',
                spellData: { name: 'Fireball', level: 10 },
            })).toThrow();
        });

        it('should validate removeSpell args', () => {
            const result = removeSpellArgsSchema.parse({
                character: { spellcasting: { classes: {} } },
                className: 'Wizard',
                spellName: 'Fireball',
            });

            expect(result.className).toBe('Wizard');
            expect(result.spellName).toBe('Fireball');
        });

        it('should reject empty spellName', () => {
            expect(() => removeSpellArgsSchema.parse({
                character: { name: 'Test' },
                className: 'Wizard',
                spellName: '',
            })).toThrow();
        });
    });

    describe('SourceService Schemas', () => {
        it('should validate source identifier', () => {
            const result = sourceIdentifierSchema.parse('PHB');

            expect(result).toBe('PHB');
        });

        it('should reject empty source identifier', () => {
            expect(() => sourceIdentifierSchema.parse('')).toThrow();
        });
    });
});
