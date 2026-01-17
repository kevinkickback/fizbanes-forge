import { DataLoader } from '../lib/DataLoader.js';
import { BaseDataService } from './BaseDataService.js';

/**
 * Service for managing optional class features like Metamagic, Maneuvers, Invocations, Fighting Styles
 */
class OptionalFeatureService extends BaseDataService {
    constructor() {
        super('optionalfeatures');
    }

    async initialize() {
        await this.initWithLoader(
            async () => {
                console.info('[OptionalFeatureService]', 'Initializing optional feature data');

                // Load main optionalfeatures data
                const optionalfeaturesData = await DataLoader.loadJSON('optionalfeatures.json');

                // Load fluff data
                const fluffData = await DataLoader.loadJSON('fluff-optionalfeatures.json');

                // Merge data
                const aggregated = {
                    optionalfeature: optionalfeaturesData.optionalfeature || [],
                    optionalfeatureFluff: fluffData.optionalfeatureFluff || []
                };

                return aggregated;
            },
            {
                emitPayload: (data) => data?.optionalfeature || [],
            }
        );
    }

    /**
     * Get all optional features
     * @returns {Array<Object>} Array of optional feature objects
     */
    getAllOptionalFeatures() {
        return this._data?.optionalfeature || [];
    }

    /**
     * Get optional features by feature type(s)
     * @param {string|Array<string>} featureTypes - Feature type code(s) (EI, MM, MV:B, FS:F, etc.)
     * @returns {Array<Object>} Array of matching optional feature objects
     */
    getFeaturesByType(featureTypes) {
        const types = Array.isArray(featureTypes) ? featureTypes : [featureTypes];
        return this.getAllOptionalFeatures().filter((feature) =>
            feature.featureType?.some((ft) => types.includes(ft))
        );
    }

    /**
     * Get Eldritch Invocations (Warlock)
     * @returns {Array<Object>} Array of invocation objects
     */
    getEldritchInvocations() {
        return this.getFeaturesByType('EI');
    }

    /**
     * Get Metamagic options (Sorcerer)
     * @returns {Array<Object>} Array of metamagic objects
     */
    getMetamagicOptions() {
        return this.getFeaturesByType('MM');
    }

    /**
     * Get Battle Master Maneuvers (Fighter)
     * @returns {Array<Object>} Array of maneuver objects
     */
    getManeuvers() {
        return this.getFeaturesByType('MV:B');
    }

    /**
     * Get Fighting Styles for a specific class
     * @param {string} className - Class name (Fighter, Ranger, Paladin)
     * @returns {Array<Object>} Array of fighting style objects
     */
    getFightingStyles(className) {
        const typeMap = {
            Fighter: ['FS:F', 'FS:B'],
            Ranger: ['FS:R', 'FS:B'],
            Paladin: ['FS:P', 'FS:B'],
        };
        const types = typeMap[className] || ['FS:B'];
        return this.getFeaturesByType(types);
    }

    /**
     * Get Pact Boons (Warlock)
     * @returns {Array<Object>} Array of pact boon objects
     */
    getPactBoons() {
        return this.getFeaturesByType('PB');
    }

    /**
     * Get Artificer Infusions
     * @returns {Array<Object>} Array of infusion objects
     */
    getArtificerInfusions() {
        return this.getFeaturesByType('AI');
    }

    /**
     * Check if an optional feature meets prerequisites
     * @param {Object} feature - The optional feature object
     * @param {Object} character - Character object with level, class, spells, etc.
     * @param {string} className - Optional class name for class-specific level checks
     * @returns {boolean} True if prerequisites are met
     */
    meetsPrerequisites(feature, character, className = null) {
        if (!feature.prerequisite) return true;

        // Check each prerequisite (all must be met)
        for (const prereq of feature.prerequisite) {
            // Check level requirement
            if (prereq.level) {
                // For class-specific features, check the class level, not total level
                let charLevel = character.getTotalLevel();
                if (className) {
                    // Check in progression.classes first (used during level-up)
                    if (character.progression?.classes) {
                        const classEntry = character.progression.classes.find(c => c.name === className);
                        if (classEntry) {
                            charLevel = classEntry.levels || 1;
                        }
                    }
                    // Fallback to direct classes array (if used elsewhere)
                    else if (character.classes) {
                        const classEntry = character.classes.find(c => c.name === className);
                        if (classEntry) {
                            charLevel = classEntry.level || classEntry.levels || 1;
                        }
                    }
                }
                const requiredLevel = typeof prereq.level === 'object' ? (prereq.level.level || 1) : prereq.level;
                if (charLevel < requiredLevel) return false;
            }

            // Check spell requirement (character must know the spell)
            if (prereq.spell) {
                const requiredSpells = Array.isArray(prereq.spell) ? prereq.spell : [prereq.spell];
                const hasAllSpells = requiredSpells.every(spellRef => {
                    // Clean spell reference (remove #c suffix and any source markers)
                    const spellName = spellRef.split('#')[0].split('|')[0].toLowerCase();

                    // Check in character's spellcasting data
                    if (character.spellcasting?.classes) {
                        for (const classSpellcasting of Object.values(character.spellcasting.classes)) {
                            // Check spells known
                            if (classSpellcasting.spellsKnown?.some(s =>
                                s.name.toLowerCase() === spellName
                            )) {
                                return true;
                            }
                            // Check cantrips
                            if (classSpellcasting.cantrips?.some(s =>
                                s.name.toLowerCase() === spellName
                            )) {
                                return true;
                            }
                            // Check prepared spells
                            if (classSpellcasting.preparedSpells?.some(s =>
                                s.name.toLowerCase() === spellName
                            )) {
                                return true;
                            }
                        }
                    }
                    return false;
                });

                if (!hasAllSpells) return false;
            }

            // Check pact requirement (for invocations)
            if (prereq.pact) {
                // Check if character has the required pact boon
                const hasPact = character.features?.some(f =>
                    f.name?.toLowerCase().includes(prereq.pact.toLowerCase())
                );
                if (!hasPact) return false;
            }

            // Check patron requirement
            if (prereq.patron) {
                if (!hasPatron) return false;
            }
        }

        return true;
    }

    /**
     * Get a specific optional feature by name
     * @param {string} name - Feature name
     * @param {string} source - Source book (optional)
     * @returns {Object|null} Optional feature object or null
     */
    getFeatureByName(name, source = null) {
        const features = this.getAllOptionalFeatures();
        if (source) {
            return features.find(
                (f) => f.name === name && f.source === source
            ) || features.find((f) => f.name === name);
        }
        return features.find((f) => f.name === name);
    }
}

// Export singleton instance
export const optionalFeatureService = new OptionalFeatureService();
