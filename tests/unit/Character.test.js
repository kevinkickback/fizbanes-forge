import { beforeEach, describe, expect, it } from 'vitest';
import { Character } from '../../src/app/Character.js';

describe('Character', () => {
    let character;

    beforeEach(() => {
        character = new Character();
    });

    describe('Constructor', () => {
        it('should create a character with default values', () => {
            expect(character.name).toBe('');
            expect(character.playerName).toBe('');
            expect(character.id).toBe(null);
            expect(character.abilityScores).toEqual({
                strength: 8,
                dexterity: 8,
                constitution: 8,
                intelligence: 8,
                wisdom: 8,
                charisma: 8,
            });
        });

        it('should initialize with provided data', () => {
            const data = {
                id: 'test-123',
                name: 'Fizban',
                playerName: 'Kevin',
                race: {
                    name: 'Human',
                    source: 'PHB',
                    subrace: '',
                    abilityChoices: [],
                },
            };

            const char = new Character(data);
            expect(char.id).toBe('test-123');
            expect(char.name).toBe('Fizban');
            expect(char.playerName).toBe('Kevin');
            expect(char.race.name).toBe('Human');
        });

        it('should initialize allowedSources as a Set', () => {
            const char = new Character({ allowedSources: ['PHB', 'XGE'] });
            expect(char.allowedSources).toBeInstanceOf(Set);
            expect(char.allowedSources.has('PHB')).toBe(true);
            expect(char.allowedSources.has('XGE')).toBe(true);
        });

        it('should default to PHB if no sources provided', () => {
            expect(character.allowedSources.has('PHB')).toBe(true);
        });

        it('should normalize race.abilityChoices to array', () => {
            const data = {
                race: {
                    abilityChoices: {
                        0: { ability: 'str', value: 1 },
                        1: { ability: 'dex', value: 1 },
                    },
                },
            };

            const char = new Character(data);
            expect(Array.isArray(char.race.abilityChoices)).toBe(true);
            expect(char.race.abilityChoices.length).toBe(2);
        });
    });

    describe('Ability Scores', () => {
        it('should get ability score correctly', () => {
            character.abilityScores.strength = 15;
            expect(character.getAbilityScore('strength')).toBe(15);
        });

        it('should calculate ability modifier correctly', () => {
            character.abilityScores.strength = 10;
            expect(character.getAbilityModifier('strength')).toBe(0);

            character.abilityScores.strength = 16;
            expect(character.getAbilityModifier('strength')).toBe(3);

            character.abilityScores.strength = 8;
            expect(character.getAbilityModifier('strength')).toBe(-1);
        });

        it('should add ability bonus', () => {
            character.addAbilityBonus('strength', 2, 'Race');

            expect(character.abilityBonuses.strength).toContainEqual({
                value: 2,
                source: 'Race',
            });
        });

        it('should remove ability bonus by source', () => {
            character.addAbilityBonus('strength', 2, 'Race');
            character.addAbilityBonus('strength', 1, 'Feat');

            character.removeAbilityBonus('strength', 2, 'Race');

            expect(character.abilityBonuses.strength).toHaveLength(1);
            expect(character.abilityBonuses.strength[0].source).toBe('Feat');
        });

        it('should clear all bonuses from a source', () => {
            character.addAbilityBonus('strength', 2, 'Race');
            character.addAbilityBonus('dexterity', 1, 'Race');
            character.addAbilityBonus('constitution', 1, 'Feat');

            character.clearAbilityBonuses('Race');

            expect(character.abilityBonuses.strength).toHaveLength(0);
            expect(character.abilityBonuses.dexterity).toHaveLength(0);
            expect(character.abilityBonuses.constitution).toHaveLength(1);
        });

        it('should clear bonuses by prefix', () => {
            character.addAbilityBonus('strength', 1, 'Race:Human');
            character.addAbilityBonus('dexterity', 1, 'Race:Elf');
            character.addAbilityBonus('constitution', 1, 'Feat');

            character.clearAbilityBonusesByPrefix('Race');

            expect(character.abilityBonuses.strength).toHaveLength(0);
            expect(character.abilityBonuses.dexterity).toHaveLength(0);
            expect(character.abilityBonuses.constitution).toHaveLength(1);
        });

        it('should handle case-insensitive ability names', () => {
            character.addAbilityBonus('STR', 2, 'Test');
            character.addAbilityBonus('Strength', 1, 'Test2');

            expect(character.abilityBonuses.strength).toHaveLength(2);
        });
    });

    describe('Pending Ability Choices', () => {
        it('should add pending ability choice', () => {
            const choice = { source: 'Race', count: 1, options: ['str', 'dex'] };
            character.addPendingAbilityChoice(choice);

            const pending = character.getPendingAbilityChoices();
            expect(pending).toHaveLength(1);
            expect(pending[0].source).toBe('Race');
        });

        it('should clear pending choices', () => {
            character.addPendingAbilityChoice({ source: 'Race', count: 1 });
            character.clearPendingAbilityChoices();

            expect(character.getPendingAbilityChoices()).toHaveLength(0);
        });
    });

    describe('Proficiencies', () => {
        it('should add proficiency', () => {
            character.addProficiency('weapons', 'Longsword', 'Class');

            expect(character.proficiencies.weapons).toContain('Longsword');
        });

        it('should track proficiency source', () => {
            character.addProficiency('skills', 'Athletics', 'Background');

            const sources = character.proficiencySources.skills.get('Athletics');
            expect(sources).toBeDefined();
            expect(sources.has('Background')).toBe(true);
        });

        it('should remove proficiencies by source', () => {
            character.addProficiency('skills', 'Athletics', 'Class');
            character.addProficiency('skills', 'Perception', 'Class');
            character.addProficiency('weapons', 'Longsword', 'Race');

            character.removeProficienciesBySource('Class');

            expect(character.proficiencies.skills).not.toContain('Athletics');
            expect(character.proficiencies.skills).not.toContain('Perception');
            expect(character.proficiencies.weapons).toContain('Longsword');
        });
    });

    describe('Features', () => {
        it('should add resistance', () => {
            character.addResistance('fire');
            expect(character.features.resistances.has('fire')).toBe(true);
        });

        it('should clear resistances', () => {
            character.addResistance('fire');
            character.addResistance('cold');
            character.clearResistances();

            expect(character.features.resistances.size).toBe(0);
        });

        it('should add trait', () => {
            character.addTrait('Darkvision', 'You can see in dim light', 'Race');

            const trait = character.features.traits.get('Darkvision');
            expect(trait).toBeDefined();
            expect(trait.description).toBe('You can see in dim light');
            expect(trait.source).toBe('Race');
        });

        it('should clear traits by source', () => {
            character.addTrait('Trait1', 'Description', 'Race');
            character.addTrait('Trait2', 'Description', 'Race');
            character.addTrait('Trait3', 'Description', 'Class');

            character.clearTraits('Race');

            expect(character.features.traits.has('Trait1')).toBe(false);
            expect(character.features.traits.has('Trait2')).toBe(false);
            expect(character.features.traits.has('Trait3')).toBe(true);
        });

        it('should track darkvision distance', () => {
            expect(character.features.darkvision).toBe(0);
            character.features.darkvision = 60;
            expect(character.features.darkvision).toBe(60);
        });
    });

    describe('Feats', () => {
        it('should set feats with default source', () => {
            const feats = [{ name: 'Great Weapon Master' }];
            character.setFeats(feats, 'Level 4');

            expect(character.feats).toHaveLength(1);
            expect(character.feats[0].name).toBe('Great Weapon Master');
            const sources = character.featSources.get('Great Weapon Master');
            expect(sources).toBeInstanceOf(Set);
            expect(sources.has('Level 4')).toBe(true);
        });

        it('should preserve feat source if provided', () => {
            const feats = [{ name: 'Alert', source: 'Variant Human' }];
            character.setFeats(feats, 'Level 4');

            const sources = character.featSources.get('Alert');
            expect(sources).toBeInstanceOf(Set);
            expect(sources.has('Variant Human')).toBe(true);
        });
    });

    describe('Allowed Sources', () => {
        it('should add allowed source', () => {
            character.addAllowedSource('XGE');
            expect(character.allowedSources.has('XGE')).toBe(true);
        });

        it('should not add duplicate sources', () => {
            character.addAllowedSource('PHB');
            character.addAllowedSource('PHB');

            const sourcesArray = Array.from(character.allowedSources);
            const phbCount = sourcesArray.filter(s => s === 'PHB').length;
            expect(phbCount).toBe(1);
        });

        it('should remove allowed source', () => {
            character.addAllowedSource('XGE');
            character.removeAllowedSource('XGE');

            expect(character.allowedSources.has('XGE')).toBe(false);
        });

        it('should check if source is allowed', () => {
            character.addAllowedSource('PHB');

            expect(character.isSourceAllowed('PHB')).toBe(true);
            expect(character.isSourceAllowed('DMG')).toBe(false);
        });
    });

    describe('Inventory', () => {
        it('should initialize inventory structure', () => {
            expect(character.inventory).toBeDefined();
            expect(character.inventory.items).toEqual([]);
            expect(character.inventory.equipped).toBeDefined();
            expect(character.inventory.attuned).toEqual([]);
        });

        it('should preserve inventory data from constructor', () => {
            const data = {
                inventory: {
                    items: [{ name: 'Sword', qty: 1 }],
                    equipped: { head: 'Helmet' },
                },
            };

            const char = new Character(data);
            expect(char.inventory.items).toHaveLength(1);
            expect(char.inventory.equipped.head).toBe('Helmet');
        });
    });

    describe('Spellcasting', () => {
        it('should initialize spellcasting structure', () => {
            expect(character.spellcasting).toBeDefined();
            expect(character.spellcasting.classes).toEqual({});
            expect(character.spellcasting.multiclass).toBeDefined();
        });

        it('should preserve spellcasting data from constructor', () => {
            const data = {
                spellcasting: {
                    classes: {
                        Wizard: { spellsKnown: ['Fireball'] },
                    },
                },
            };

            const char = new Character(data);
            expect(char.spellcasting.classes.Wizard).toBeDefined();
            expect(char.spellcasting.classes.Wizard.spellsKnown).toContain('Fireball');
        });
    });

    describe('Hit Points', () => {
        it('should initialize hitPoints', () => {
            expect(character.hitPoints).toEqual({
                current: 0,
                max: 0,
                temp: 0,
            });
        });

        it('should preserve HP data from constructor', () => {
            const data = {
                hitPoints: { current: 25, max: 30, temp: 5 },
            };

            const char = new Character(data);
            expect(char.hitPoints.current).toBe(25);
            expect(char.hitPoints.max).toBe(30);
            expect(char.hitPoints.temp).toBe(5);
        });
    });

    describe('Variant Rules', () => {
        it('should initialize variant rules with defaults', () => {
            expect(character.variantRules).toEqual({
                variantfeat: false,
                abilityScoreMethod: 'custom',
            });
        });

        it('should preserve variant rules from constructor', () => {
            const data = {
                variantRules: {
                    variantfeat: true,
                    abilityScoreMethod: 'standard-array',
                },
            };

            const char = new Character(data);
            expect(char.variantRules.variantfeat).toBe(true);
            expect(char.variantRules.abilityScoreMethod).toBe('standard-array');
        });
    });

    describe('Timestamps', () => {
        it('should set createdAt timestamp', () => {
            expect(character.createdAt).toBeDefined();
            expect(new Date(character.createdAt).getTime()).toBeGreaterThan(0);
        });

        it('should set lastModified timestamp', () => {
            expect(character.lastModified).toBeDefined();
            expect(new Date(character.lastModified).getTime()).toBeGreaterThan(0);
        });

        it('should preserve timestamps from constructor', () => {
            const testDate = '2024-01-01T00:00:00.000Z';
            const data = {
                createdAt: testDate,
                lastModified: testDate,
            };

            const char = new Character(data);
            expect(char.createdAt).toBe(testDate);
            expect(char.lastModified).toBe(testDate);
        });
    });
});
