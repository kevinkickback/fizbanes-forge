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
     * @returns {boolean} True if prerequisites are met
     */
    meetsPrerequisites(feature, character) {
        if (!feature.prerequisite) return true;

        // Basic implementation - can be expanded for more complex prerequisites
        for (const prereq of feature.prerequisite) {
            // Check level requirement
            if (prereq.level) {
                const charLevel = character.level || 1;
                const requiredLevel = prereq.level.level || 1;
                if (charLevel < requiredLevel) return false;
            }

            // Check spell requirement
            if (prereq.spell) {
                // Would need to check character's known spells
                // Simplified for now
                continue;
            }

            // Check pact requirement (for invocations)
            if (prereq.pact) {
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
