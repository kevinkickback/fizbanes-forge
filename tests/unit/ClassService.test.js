import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../src/lib/Errors.js';
import { eventBus, EVENTS } from '../../src/lib/EventBus.js';

// Mock TooltipManager to break circular dependency
vi.mock('../../src/ui/rendering/TooltipManager.js', () => ({
    initializeTooltipListeners: vi.fn(),
}));

import { classService } from '../../src/services/ClassService.js';

const mockClasses = [
    {
        name: 'Fighter',
        source: 'PHB',
        hd: 10,
        spellcastingAbility: null,
        casterProgression: null,
        optionalfeatureProgression: [
            { featureType: ['FS:F'], progression: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        ],
        classFeatures: [
            { classFeature: 'Fighting Style|Fighter||2', gainSubclassFeature: false },
            { classFeature: 'Martial Archetype|Fighter||3', gainSubclassFeature: true },
        ],
    },
    {
        name: 'Wizard',
        source: 'PHB',
        hd: 6,
        spellcastingAbility: 'int',
        casterProgression: 'full',
    },
    {
        name: 'Ranger',
        source: 'PHB',
        hd: 10,
        spellcastingAbility: 'wis',
        casterProgression: '1/2',
    },
    {
        name: 'Eldritch Knight',
        source: 'PHB',
        hd: 10,
        casterProgression: '1/3',
    },
    {
        name: 'Warlock',
        source: 'PHB',
        hd: 8,
        spellcastingAbility: 'cha',
        casterProgression: 'pact',
    },
    {
        name: 'Fighter',
        source: 'XPHB',
        hd: 10,
        edition: 'modern',
    },
];

const mockClassFeatures = [
    { name: 'Second Wind', className: 'Fighter', classSource: 'PHB', source: 'PHB', level: 1 },
    { name: 'Action Surge', className: 'Fighter', classSource: 'PHB', source: 'PHB', level: 2 },
    { name: 'Extra Attack', className: 'Fighter', classSource: 'PHB', source: 'PHB', level: 5 },
    { name: 'Arcane Recovery', className: 'Wizard', classSource: 'PHB', source: 'PHB', level: 1 },
    { name: 'Spellcasting', className: 'Wizard', classSource: 'PHB', source: 'PHB', level: 1 },
];

const mockSubclasses = [
    { name: 'Champion', shortName: 'Champion', className: 'Fighter', classSource: 'PHB', source: 'PHB' },
    { name: 'Battle Master', shortName: 'Battle Master', className: 'Fighter', classSource: 'PHB', source: 'PHB' },
    { name: 'School of Evocation', shortName: 'Evocation', className: 'Wizard', classSource: 'PHB', source: 'PHB' },
];

const mockSubclassFeatures = [
    { name: 'Improved Critical', className: 'Fighter', subclassShortName: 'Champion', classSource: 'PHB', source: 'PHB', level: 3 },
    { name: 'Remarkable Athlete', className: 'Fighter', subclassShortName: 'Champion', classSource: 'PHB', source: 'PHB', level: 7 },
    { name: 'Evocation Savant', className: 'Wizard', subclassShortName: 'Evocation', classSource: 'PHB', source: 'PHB', level: 2 },
];

const mockClassFluff = [
    { name: 'Fighter', source: 'PHB', entries: ['A master of martial combat.'] },
];

describe('ClassService', () => {
    beforeEach(async () => {
        classService._data = null;
        classService._initPromise = null;
        vi.clearAllMocks();

        const { DataLoader } = await import('../../src/lib/DataLoader.js');
        vi.spyOn(DataLoader, 'loadJSON').mockImplementation((file) => {
            if (file === 'class/index.json') {
                return Promise.resolve({ Fighter: 'class-fighter.json', Wizard: 'class-wizard.json' });
            }
            if (file === 'class/fluff-index.json') {
                return Promise.resolve({ Fighter: 'fluff-fighter.json' });
            }
            if (file === 'class/class-fighter.json') {
                return Promise.resolve({
                    class: mockClasses.filter(c => c.name === 'Fighter' && c.source === 'PHB'),
                    classFeature: mockClassFeatures.filter(f => f.className === 'Fighter'),
                    subclass: mockSubclasses.filter(s => s.className === 'Fighter'),
                    subclassFeature: mockSubclassFeatures.filter(f => f.className === 'Fighter'),
                });
            }
            if (file === 'class/class-wizard.json') {
                return Promise.resolve({
                    class: mockClasses.filter(c => c.name === 'Wizard'),
                    classFeature: mockClassFeatures.filter(f => f.className === 'Wizard'),
                    subclass: mockSubclasses.filter(s => s.className === 'Wizard'),
                    subclassFeature: mockSubclassFeatures.filter(f => f.className === 'Wizard'),
                });
            }
            if (file === 'class/fluff-fighter.json') {
                return Promise.resolve({ classFluff: mockClassFluff });
            }
            return Promise.resolve({});
        });

        await classService.initialize();
    });

    describe('initialize', () => {
        it('should load classes and aggregate data', () => {
            expect(classService.isInitialized()).toBe(true);
            expect(classService._data.class).toHaveLength(2);
            expect(classService._data.classFeature).toHaveLength(5);
            expect(classService._data.subclass).toHaveLength(3);
        });

        it('should handle failed class file loads gracefully', async () => {
            classService._data = null;
            classService._initPromise = null;

            const { DataLoader } = await import('../../src/lib/DataLoader.js');
            vi.spyOn(DataLoader, 'loadJSON').mockImplementation((file) => {
                if (file === 'class/index.json') {
                    return Promise.resolve({ Fighter: 'class-fighter.json' });
                }
                if (file === 'class/fluff-index.json') {
                    return Promise.resolve({});
                }
                if (file === 'class/class-fighter.json') {
                    return Promise.reject(new Error('File corrupted'));
                }
                return Promise.resolve({});
            });

            await classService.initialize();
            expect(classService.isInitialized()).toBe(true);
            expect(classService._data.class).toHaveLength(0);
        });
    });

    describe('resetData', () => {
        it('should clear all data', () => {
            classService.resetData();
            expect(classService._data).toBeNull();
        });

        it('should reset via DATA_INVALIDATED event', () => {
            eventBus.emit(EVENTS.DATA_INVALIDATED);
            expect(classService._data).toBeNull();
        });
    });

    describe('getAllClasses', () => {
        it('should return all loaded classes', () => {
            const classes = classService.getAllClasses();
            expect(classes).toHaveLength(2);
            expect(classes.map(c => c.name)).toContain('Fighter');
            expect(classes.map(c => c.name)).toContain('Wizard');
        });

        it('should return empty array when data is null', () => {
            classService._data = null;
            expect(classService.getAllClasses()).toEqual([]);
        });
    });

    describe('getClass', () => {
        it('should find class by name and source', () => {
            const cls = classService.getClass('Fighter', 'PHB');
            expect(cls.name).toBe('Fighter');
            expect(cls.source).toBe('PHB');
        });

        it('should fall back to any source when exact match not found', () => {
            const cls = classService.getClass('Fighter', 'XPHB');
            expect(cls.name).toBe('Fighter');
        });

        it('should prefer non-modern editions when falling back', () => {
            // Add modern edition to data
            classService._data.class.push(mockClasses.find(c => c.source === 'XPHB'));

            const cls = classService.getClass('Fighter', 'NONEXISTENT');
            expect(cls.source).toBe('PHB');
        });

        it('should throw NotFoundError for unknown class', () => {
            expect(() => classService.getClass('Artificer')).toThrow(NotFoundError);
        });

        it('should throw ValidationError for empty name', () => {
            expect(() => classService.getClass('')).toThrow();
        });
    });

    describe('getClassFeatures', () => {
        it('should return features up to given level', () => {
            const features = classService.getClassFeatures('Fighter', 2, 'PHB');
            expect(features).toHaveLength(2);
            expect(features.map(f => f.name)).toContain('Second Wind');
            expect(features.map(f => f.name)).toContain('Action Surge');
        });

        it('should not return features above the given level', () => {
            const features = classService.getClassFeatures('Fighter', 1, 'PHB');
            expect(features).toHaveLength(1);
            expect(features[0].name).toBe('Second Wind');
        });

        it('should return empty array when data is null', () => {
            classService._data = null;
            expect(classService.getClassFeatures('Fighter', 5)).toEqual([]);
        });
    });

    describe('getSubclasses', () => {
        it('should return subclasses for a class', () => {
            const subs = classService.getSubclasses('Fighter', 'PHB');
            expect(subs).toHaveLength(2);
            expect(subs.map(s => s.name)).toContain('Champion');
            expect(subs.map(s => s.name)).toContain('Battle Master');
        });

        it('should return empty array for class with no subclasses', () => {
            const subs = classService.getSubclasses('Nonexistent', 'PHB');
            expect(subs).toEqual([]);
        });

        it('should return empty array when data is null', () => {
            classService._data = null;
            expect(classService.getSubclasses('Fighter')).toEqual([]);
        });
    });

    describe('getSubclass', () => {
        it('should find subclass by name', () => {
            const sub = classService.getSubclass('Fighter', 'Champion', 'PHB');
            expect(sub.name).toBe('Champion');
        });

        it('should find subclass by shortName', () => {
            const sub = classService.getSubclass('Wizard', 'Evocation', 'PHB');
            expect(sub.shortName).toBe('Evocation');
        });

        it('should throw NotFoundError for unknown subclass', () => {
            expect(() => classService.getSubclass('Fighter', 'Nonexistent')).toThrow(NotFoundError);
        });
    });

    describe('getSubclassFeatures', () => {
        it('should return subclass features up to given level', () => {
            const features = classService.getSubclassFeatures('Fighter', 'Champion', 7, 'PHB');
            expect(features).toHaveLength(2);
        });

        it('should not return features above the given level', () => {
            const features = classService.getSubclassFeatures('Fighter', 'Champion', 3, 'PHB');
            expect(features).toHaveLength(1);
            expect(features[0].name).toBe('Improved Critical');
        });

        it('should return empty array when data is null', () => {
            classService._data = null;
            expect(classService.getSubclassFeatures('Fighter', 'Champion', 5)).toEqual([]);
        });
    });

    describe('getHitDie', () => {
        it('should return hit die from class data as number', () => {
            expect(classService.getHitDie('Fighter', 'PHB')).toBe('d10');
        });

        it('should return d8 default when class not found', () => {
            expect(classService.getHitDie('Artificer', 'PHB')).toBe('d8');
        });

        it('should return d8 when data is null', () => {
            classService._data = null;
            expect(classService.getHitDie('Fighter')).toBe('d8');
        });
    });

    describe('getClassByName', () => {
        it('should be an alias for getClass', () => {
            const cls = classService.getClassByName('Fighter', 'PHB');
            expect(cls.name).toBe('Fighter');
        });
    });

    describe('getClassFluff', () => {
        it('should return fluff data for a class', () => {
            const fluff = classService.getClassFluff('Fighter', 'PHB');
            expect(fluff).not.toBeNull();
            expect(fluff.name).toBe('Fighter');
        });

        it('should return null for unknown class', () => {
            expect(classService.getClassFluff('Artificer', 'PHB')).toBeNull();
        });

        it('should return null when data is null', () => {
            classService._data = null;
            expect(classService.getClassFluff('Fighter')).toBeNull();
        });
    });

    describe('getOptionalFeatureProgression', () => {
        it('should return progression for class with optional features', () => {
            const prog = classService.getOptionalFeatureProgression('Fighter', 'PHB');
            expect(prog).not.toBeNull();
            expect(prog[0].featureType).toContain('FS:F');
        });

        it('should return null for class without optional features', () => {
            const prog = classService.getOptionalFeatureProgression('Wizard', 'PHB');
            expect(prog).toBeNull();
        });
    });

    describe('getOptionalFeatureCountAtLevel', () => {
        it('should return count from array-based progression', () => {
            const count = classService.getOptionalFeatureCountAtLevel('Fighter', 2, ['FS:F'], 'PHB');
            expect(count).toBe(1);
        });

        it('should return 0 for level with no features', () => {
            const count = classService.getOptionalFeatureCountAtLevel('Fighter', 1, ['FS:F'], 'PHB');
            expect(count).toBe(0);
        });

        it('should return 0 when no matching feature types', () => {
            const count = classService.getOptionalFeatureCountAtLevel('Fighter', 2, ['EI'], 'PHB');
            expect(count).toBe(0);
        });
    });

    describe('getSubclassLevel', () => {
        it('should return level from classFeatures with gainSubclassFeature', () => {
            const fighter = classService.getClass('Fighter', 'PHB');
            const level = classService.getSubclassLevel(fighter);
            expect(level).toBe(3);
        });

        it('should return null for class without subclass entry', () => {
            const level = classService.getSubclassLevel({ classFeatures: [] });
            expect(level).toBeNull();
        });

        it('should return null for null input', () => {
            expect(classService.getSubclassLevel(null)).toBeNull();
        });
    });

    describe('getCountAtLevel', () => {
        it('should handle array-based progression', () => {
            expect(classService.getCountAtLevel([0, 1, 2, 3], 2)).toBe(1);
        });

        it('should handle object-based progression', () => {
            expect(classService.getCountAtLevel({ '3': 2, '5': 3 }, 3)).toBe(2);
        });

        it('should return 0 for missing level in array', () => {
            expect(classService.getCountAtLevel([1, 2], 5)).toBe(0);
        });

        it('should return 0 for string input', () => {
            expect(classService.getCountAtLevel('invalid', 1)).toBe(0);
        });
    });

    describe('mapFeatureType', () => {
        it('should map known feature type codes', () => {
            expect(classService.mapFeatureType('EI')).toBe('invocation');
            expect(classService.mapFeatureType('MM')).toBe('metamagic');
            expect(classService.mapFeatureType('MV:B')).toBe('maneuver');
            expect(classService.mapFeatureType('FS:F')).toBe('fighting-style');
        });

        it('should return other for unknown codes', () => {
            expect(classService.mapFeatureType('UNKNOWN')).toBe('other');
        });
    });

    describe('getFeatureEntryChoices', () => {
        it('should return empty array for feature with no entries', () => {
            expect(classService.getFeatureEntryChoices({})).toEqual([]);
            expect(classService.getFeatureEntryChoices(null)).toEqual([]);
        });

        it('should detect type:options entries', () => {
            const feature = {
                name: 'Test Feature',
                level: 3,
                source: 'PHB',
                entries: [
                    {
                        type: 'options',
                        count: 2,
                        entries: [
                            { type: 'entries', name: 'Option A', entries: ['Description A'] },
                            { type: 'entries', name: 'Option B', entries: ['Description B'] },
                        ],
                    },
                ],
            };

            const choices = classService.getFeatureEntryChoices(feature);
            expect(choices).toHaveLength(1);
            expect(choices[0].type).toBe('options');
            expect(choices[0].count).toBe(2);
            expect(choices[0].options).toHaveLength(2);
            expect(choices[0].options[0].value).toBe('Option A');
        });

        it('should detect type:table entries with choose text', () => {
            const feature = {
                name: 'Dragon Ancestor',
                level: 1,
                entries: [
                    'You choose one type of dragon as your ancestor.',
                    {
                        type: 'table',
                        colLabels: ['Dragon', 'Damage Type'],
                        rows: [
                            ['Black', 'Acid'],
                            ['Blue', 'Lightning'],
                            ['Red', 'Fire'],
                        ],
                    },
                ],
            };

            const choices = classService.getFeatureEntryChoices(feature);
            expect(choices).toHaveLength(1);
            expect(choices[0].type).toBe('table');
            expect(choices[0].options).toHaveLength(3);
            expect(choices[0].options[0].value).toBe('Black');
            expect(choices[0].options[0].metadata.damage_type).toBe('Acid');
        });

        it('should exclude random roll tables', () => {
            const feature = {
                name: 'Wild Magic Surge',
                level: 1,
                entries: [
                    'Roll to choose an effect.',
                    {
                        type: 'table',
                        colLabels: ['{@dice d100}', 'Effect'],
                        rows: [['01-02', 'Something happens']],
                    },
                ],
            };

            const choices = classService.getFeatureEntryChoices(feature);
            expect(choices).toHaveLength(0);
        });
    });

    describe('getMaxSpellLevel', () => {
        it('should return correct max level for full casters', () => {
            classService._data.class.push(mockClasses.find(c => c.name === 'Wizard'));
            expect(classService.getMaxSpellLevel('Wizard', 1)).toBe(1);
            expect(classService.getMaxSpellLevel('Wizard', 3)).toBe(2);
            expect(classService.getMaxSpellLevel('Wizard', 5)).toBe(3);
            expect(classService.getMaxSpellLevel('Wizard', 9)).toBe(5);
            expect(classService.getMaxSpellLevel('Wizard', 17)).toBe(9);
        });

        it('should return correct max level for half casters', () => {
            classService._data.class.push(mockClasses.find(c => c.name === 'Ranger'));
            expect(classService.getMaxSpellLevel('Ranger', 2)).toBe(1);
            expect(classService.getMaxSpellLevel('Ranger', 6)).toBe(2);
            expect(classService.getMaxSpellLevel('Ranger', 10)).toBe(3);
        });

        it('should return correct max level for pact casters', () => {
            classService._data.class.push(mockClasses.find(c => c.name === 'Warlock'));
            expect(classService.getMaxSpellLevel('Warlock', 1)).toBe(1);
            expect(classService.getMaxSpellLevel('Warlock', 3)).toBe(2);
            expect(classService.getMaxSpellLevel('Warlock', 5)).toBe(3);
            expect(classService.getMaxSpellLevel('Warlock', 9)).toBe(5);
        });

        it('should return correct max level for third casters', () => {
            classService._data.class.push(mockClasses.find(c => c.name === 'Eldritch Knight'));
            expect(classService.getMaxSpellLevel('Eldritch Knight', 3)).toBe(1);
            expect(classService.getMaxSpellLevel('Eldritch Knight', 7)).toBe(1);
            expect(classService.getMaxSpellLevel('Eldritch Knight', 9)).toBe(2);
        });
    });
});
