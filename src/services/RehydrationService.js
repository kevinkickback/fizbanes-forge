import { attAbvToLower } from '../lib/5eToolsParser.js';
import { backgroundService } from './BackgroundService.js';
import { classService } from './ClassService.js';
import { raceService } from './RaceService.js';

class RehydrationServiceImpl {
    rehydrate(character) {
        if (!character) return;

        this._rehydrateRacialFeatures(character);
        this._rehydrateClassFeatures(character);
        this._rehydrateSpellcasting(character);
        this._rehydrateBackgroundFeature(character);

        console.debug('[RehydrationService]', 'Rehydration complete for', character.name);
    }

    _rehydrateRacialFeatures(character) {
        const raceName = character.race?.name;
        const raceSource = character.race?.source || 'PHB';
        if (!raceName) return;

        let raceData;
        try {
            raceData = raceService.getRace(raceName, raceSource);
        } catch {
            console.debug('[RehydrationService]', `Race not found: ${raceName} (${raceSource})`);
            return;
        }

        // Rehydrate traits only if empty (don't overwrite user-modified data)
        if (character.features.traits.size === 0) {
            this._applyTraits(character, raceData, 'Race');

            const subraceName = character.race?.subrace;
            if (subraceName) {
                try {
                    const subraceData = raceService.getSubrace(raceName, subraceName, raceSource);
                    this._applyTraits(character, subraceData, 'Subrace');
                } catch {
                    console.debug('[RehydrationService]', `Subrace not found: ${subraceName}`);
                }
            }
        }

        // Darkvision — rehydrate if unset
        if (!character.features.darkvision && raceData.darkvision) {
            character.features.darkvision = raceData.darkvision;
        }

        // Resistances — rehydrate if empty
        if (character.features.resistances.size === 0 && raceData.resist) {
            for (const entry of raceData.resist) {
                if (typeof entry === 'string') {
                    character.addResistance(entry);
                }
                // Skip choice-based resistances — those require user interaction
            }
        }
    }

    _applyTraits(character, raceOrSubrace, source) {
        if (!raceOrSubrace?.entries || !Array.isArray(raceOrSubrace.entries)) return;

        for (const entry of raceOrSubrace.entries) {
            if (entry.type === 'entries' && entry.name) {
                character.addTrait(entry.name, entry, source);
            }
        }
    }

    _rehydrateClassFeatures(character) {
        const classes = character.progression?.classes;
        if (!Array.isArray(classes) || classes.length === 0) return;

        // Only populate if no class features exist yet
        const hasClassFeatures = [...character.features.traits.values()].some(
            (t) => t.source && t.source !== 'Race' && t.source !== 'Subrace',
        );
        if (hasClassFeatures) return;

        for (const cls of classes) {
            if (!cls.name) continue;

            const level = cls.levels || 1;
            const source = cls.source || 'PHB';

            try {
                const features = classService.getClassFeatures(cls.name, level, source);
                for (const feature of features) {
                    if (!feature.name) continue;
                    character.addTrait(feature.name, feature, cls.name);
                }
            } catch {
                console.debug('[RehydrationService]', `Class features not found: ${cls.name}`);
            }

            // Subclass features
            if (cls.subclass) {
                try {
                    const subclassData = classService.getSubclass(cls.name, cls.subclass, source);
                    if (subclassData?.shortName) {
                        const scFeatures = classService.getSubclassFeatures(
                            cls.name, subclassData.shortName, level, source,
                        );
                        for (const feature of scFeatures) {
                            if (!feature.name) continue;
                            character.addTrait(feature.name, feature, cls.subclass);
                        }
                    }
                } catch {
                    console.debug('[RehydrationService]', `Subclass features not found: ${cls.subclass}`);
                }
            }
        }
    }

    _rehydrateBackgroundFeature(character) {
        const bgName = character.background?.name;
        const bgSource = character.background?.source || 'PHB';
        if (!bgName || character.backgroundFeature) return;

        try {
            const bgData = backgroundService.getBackground(bgName, bgSource);
            if (!bgData?.entries) return;

            const featureEntry = bgData.entries.find(
                (e) => e.data?.isFeature === true || (e.type === 'entries' && e.name?.startsWith('Feature:')),
            );

            if (featureEntry) {
                const name = featureEntry.name || '';
                const desc = Array.isArray(featureEntry.entries)
                    ? featureEntry.entries.filter((e) => typeof e === 'string').join(' ')
                    : '';
                character.backgroundFeature = desc ? `${name}\n${desc}` : name;
            }
        } catch {
            console.debug('[RehydrationService]', `Background not found: ${bgName}`);
        }
    }

    _rehydrateSpellcasting(character) {
        const classes = character.progression?.classes;
        if (!Array.isArray(classes) || classes.length === 0) return;

        if (!character.spellcasting) {
            character.spellcasting = {
                classes: {},
                multiclass: { isCastingMulticlass: false, combinedSlots: {} },
                other: { spellsKnown: [], itemSpells: [] },
            };
        }

        for (const cls of classes) {
            if (!cls.name) continue;

            const existing = character.spellcasting.classes[cls.name];

            // If class entry already exists with spellcasting ability, skip
            if (existing?.spellcastingAbility) continue;

            // Look up class data to determine spellcasting ability
            let classData;
            try {
                classData = classService.getClass(cls.name);
            } catch {
                continue;
            }

            if (!classData?.spellcastingAbility) continue;

            const ability = attAbvToLower(classData.spellcastingAbility);

            if (existing) {
                // Entry exists but missing spellcastingAbility — patch it
                existing.spellcastingAbility = ability;
                if (existing.level === undefined) existing.level = cls.levels || 1;
            } else {
                // No entry at all — create a minimal one preserving nothing
                character.spellcasting.classes[cls.name] = {
                    level: cls.levels || 1,
                    spellsKnown: [],
                    spellsPrepared: [],
                    spellSlots: {},
                    cantripsKnown: 0,
                    spellcastingAbility: ability,
                    ritualCasting: false,
                };
            }
        }
    }
}

export const rehydrationService = new RehydrationServiceImpl();
