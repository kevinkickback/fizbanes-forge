/**
 * BackgroundManager.js
 * Manager class for handling character backgrounds
 * 
 * @typedef {Object} RawBackgroundData
 * @property {string} name - The name of the background
 * @property {string} source - The source book abbreviation
 * @property {string} [description] - Optional background description
 * @property {Object} [proficiencies] - Proficiency data
 * @property {Object} [languages] - Language data
 * @property {Array} [equipment] - Equipment provided by the background
 * @property {Object} [feature] - Special feature provided by the background
 * @property {Object} [characteristics] - Personality characteristics
 * 
 * @typedef {Object} ProcessedBackground
 * @property {string} id - Unique identifier combining name and source
 * @property {string} name - The name of the background
 * @property {string} source - The source book abbreviation
 * @property {string} description - Processed background description
 * @property {Object} proficiencies - Processed proficiency data
 * @property {Object} languages - Processed language data
 * @property {Array} equipment - Processed equipment list
 * @property {Object} feature - Processed feature data
 * @property {Object} characteristics - Processed personality characteristics
 * @property {Array} variants - Any background variants
 */

import { Background } from '../models/Background.js';
import { dataLoader } from '../dataloaders/DataLoader.js';
import { eventEmitter } from '../utils/EventEmitter.js';

/**
 * Manages character backgrounds, handling data processing and selection
 */
class BackgroundManager {
    /**
     * Creates a new BackgroundManager instance
     */
    constructor() {
        this._backgrounds = new Map();
        this._selectedBackground = null;
        this._selectedVariant = null;
    }

    /**
     * Initialize background data by loading and processing background information
     * @returns {Promise<boolean>} Promise resolving to true if initialization succeeded, false otherwise
     */
    async initialize() {
        try {
            // Initialize collections
            this._backgrounds = new Map();

            const backgroundData = await dataLoader.loadBackgrounds();
            this._processBackgroundData(backgroundData);

            eventEmitter.emit('backgrounds:loaded', Array.from(this._backgrounds.values()));
            return true;
        } catch (error) {
            console.error('Failed to initialize background data:', error);
            return false;
        }
    }

    /**
     * Process raw background data into Background objects
     * @param {Object} backgroundData - Raw background data from loader
     * @private
     */
    _processBackgroundData(backgroundData) {
        if (!backgroundData || !backgroundData.background) {
            console.error('Invalid background data');
            return;
        }

        // Process main backgrounds
        for (const rawBackground of backgroundData.background) {
            try {
                // Find associated fluff for this background
                const fluff = backgroundData.fluff?.find(f =>
                    f.name === rawBackground.name &&
                    (f.source === rawBackground.source || (!f.source && rawBackground.source === 'PHB'))
                );

                // Create a processed background object
                const processedData = {
                    id: `${rawBackground.name}_${rawBackground.source || 'PHB'}`,
                    name: rawBackground.name,
                    source: rawBackground.source || 'PHB',
                    description: this._getBackgroundDescription(rawBackground, fluff),
                    proficiencies: this._getBackgroundProficiencies(rawBackground),
                    languages: this._getBackgroundLanguages(rawBackground),
                    equipment: this._getEquipmentFromData(rawBackground),
                    feature: this._getBackgroundFeature(rawBackground),
                    characteristics: this._getBackgroundCharacteristics(rawBackground),
                    variants: []
                };

                // Create a Background model instance
                const background = new Background(processedData);

                // Add variants if they exist
                if (rawBackground.variants) {
                    for (const variant of rawBackground.variants) {
                        const variantData = {
                            ...processedData,
                            name: variant.name,
                            source: variant.source || rawBackground.source,
                            description: variant.description || processedData.description,
                            proficiencies: variant.proficiencies || processedData.proficiencies,
                            languages: variant.languages || processedData.languages,
                            equipment: variant.equipment || processedData.equipment,
                            feature: variant.feature || processedData.feature
                        };
                        background.variants.push(new Background(variantData));
                    }
                }

                // Store in the backgrounds map
                this._backgrounds.set(background.id, background);
            } catch (error) {
                console.error(`Error processing background ${rawBackground.name}:`, error);
            }
        }
    }

    /**
     * Gets background description from raw data and fluff entries
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @param {Object} [fluff] - Fluff entry for the background
     * @returns {string} The background description
     * @private
     */
    _getBackgroundDescription(backgroundData, fluff) {
        // Try to find matching fluff
        if (fluff) {
            if (Array.isArray(fluff.entries)) {
                // Combine all entries to make sure we get a complete description
                const entryText = this._processFluffEntries(fluff.entries);
                if (entryText) return entryText;
            }
        }

        // Fallback to entries in the background data
        if (backgroundData.entries?.length) {
            for (const entry of backgroundData.entries) {
                if (typeof entry === 'string') {
                    return entry;
                }
                // Skip entries with names (these are typically proficiencies, features, etc.)
                if (!entry.name && entry.entries && Array.isArray(entry.entries)) {
                    const entryText = this._processFluffEntries(entry.entries);
                    if (entryText) return entryText;
                }
            }
        }

        return `The ${backgroundData.name} background.`;
    }

    /**
     * Process fluff entries to extract meaningful description
     * @param {Array<Object|string>} entries - Fluff entries
     * @returns {string} Processed description or empty string
     * @private
     */
    _processFluffEntries(entries) {
        if (!Array.isArray(entries)) return '';

        // Try to find a meaningful description
        for (const entry of entries) {
            if (typeof entry === 'string') {
                if (entry.length > 20) { // Minimum length for a useful description
                    return entry;
                }
            } else if (entry.entries && Array.isArray(entry.entries)) {
                const nestedText = this._processFluffEntries(entry.entries);
                if (nestedText) return nestedText;
            } else if (entry.type === "section" && entry.entries) {
                const sectionText = this._processFluffEntries(entry.entries);
                if (sectionText) return sectionText;
            }
        }

        return '';
    }

    /**
     * Gets background proficiencies from raw data
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @returns {Object} Processed proficiency data
     * @private
     */
    _getBackgroundProficiencies(backgroundData) {
        let skillProfs = null;
        let toolProfs = null;

        // First check for explicit proficiency object
        if (backgroundData.proficiencies) {
            const profs = backgroundData.proficiencies;

            // Handle skill proficiencies
            if (profs.skills) {
                skillProfs = Array.isArray(profs.skills) ? profs.skills : [profs.skills];
            }

            // Handle tool proficiencies
            if (profs.tools) {
                toolProfs = Array.isArray(profs.tools) ? profs.tools : [profs.tools];
            }
        }

        // If not found, try to extract from entries
        if (!skillProfs || !toolProfs) {
            const extractedProfs = this._extractProficienciesFromEntries(backgroundData.entries);
            skillProfs = skillProfs || extractedProfs.skills;
            toolProfs = toolProfs || extractedProfs.tools;
        }

        return {
            skills: skillProfs || [],
            tools: toolProfs || []
        };
    }

    /**
     * Gets background languages from raw data
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @returns {Object} Processed language data
     * @private
     */
    _getBackgroundLanguages(backgroundData) {
        // Check for direct languageProficiencies array first (PHB format)
        if (backgroundData.languageProficiencies && Array.isArray(backgroundData.languageProficiencies)) {
            return this._processLanguageProficiencies(backgroundData.languageProficiencies);
        }

        // Then check for languages object in standard format
        if (backgroundData.languages) {
            return {
                known: backgroundData.languages.known || [],
                choices: backgroundData.languages.choices || []
            };
        }

        // Finally, try to extract from entries
        return this._extractLanguagesFromEntries(backgroundData.entries);
    }

    /**
     * Gets background equipment from raw data
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @returns {Array} Processed equipment list
     * @private
     */
    _getEquipmentFromData(backgroundData) {
        const equipment = [];

        // First check for explicit equipment array
        if (backgroundData?.equipment && Array.isArray(backgroundData.equipment)) {
            return backgroundData.equipment;
        }

        // Then try to find equipment in the entries
        if (backgroundData?.entries && Array.isArray(backgroundData.entries)) {
            for (const entry of backgroundData.entries) {
                if (typeof entry === 'string' &&
                    (entry.toLowerCase().includes('equipment:') ||
                        entry.toLowerCase().includes('you start with'))) {
                    return this._parseEquipmentFromText(entry);
                }

                if (entry?.name?.toLowerCase().includes('equipment') &&
                    entry?.entries && Array.isArray(entry.entries)) {
                    for (const subentry of entry.entries) {
                        if (typeof subentry === 'string') {
                            return this._parseEquipmentFromText(subentry);
                        }
                    }
                }
            }
        }

        return equipment;
    }

    /**
     * Parse equipment list from text description
     * @param {string} text - Equipment description text
     * @returns {Array} Processed equipment items
     * @private
     */
    _parseEquipmentFromText(text) {
        if (!text) return [];

        // Remove common prefixes and separators
        const cleanedText = text
            .replace(/^equipment:?\s*/i, '')
            .replace(/^you start with:?\s*/i, '')
            .replace(/^you start with the following:?\s*/i, '')
            .replace(/^you have:?\s*/i, '')
            .replace(/\band\b/g, ',');

        // Split by common delimiters
        const items = cleanedText
            .split(/[,.;]/)
            .map(item => item.trim())
            .filter(item => item.length > 0);

        return items;
    }

    /**
     * Gets background feature from raw data
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @returns {Object} Processed feature data
     * @private
     */
    _getBackgroundFeature(backgroundData) {
        if (backgroundData?.entries && Array.isArray(backgroundData.entries)) {
            // Look for a feature entry that has a name containing "Feature"
            for (const entry of backgroundData.entries) {
                if (entry?.name?.toLowerCase().includes('feature')) {
                    return {
                        name: entry.name,
                        description: this._processFeatureEntries(entry.entries)
                    };
                }
            }
        }

        // If no feature was found in entries, check for direct feature object
        if (backgroundData?.feature) {
            return {
                name: backgroundData.feature.name || 'Feature',
                description: backgroundData.feature.description ||
                    (Array.isArray(backgroundData.feature.entries) ?
                        this._processFeatureEntries(backgroundData.feature.entries) : '')
            };
        }

        return {
            name: 'Feature',
            description: ''
        };
    }

    /**
     * Process feature entries to get a formatted description
     * @param {Array} entries - Feature entry objects or strings
     * @returns {string} Processed feature description
     * @private
     */
    _processFeatureEntries(entries) {
        if (!Array.isArray(entries)) return '';

        // Combine all entries into a single description
        return entries
            .filter(entry => typeof entry === 'string')
            .join('\n\n');
    }

    /**
     * Gets background characteristics from raw data
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @returns {Object} Processed characteristics data
     * @private
     */
    _getBackgroundCharacteristics(backgroundData) {
        if (!backgroundData?.characteristics) {
            return this._extractCharacteristicsFromEntries(backgroundData?.entries);
        }

        // Process the characteristics object
        return {
            personalityTraits: this._formatCharacteristicOptions(backgroundData.characteristics?.personalityTraits),
            ideals: this._formatCharacteristicOptions(backgroundData.characteristics?.ideals),
            bonds: this._formatCharacteristicOptions(backgroundData.characteristics?.bonds),
            flaws: this._formatCharacteristicOptions(backgroundData.characteristics?.flaws)
        };
    }

    /**
     * Extract proficiencies from entries
     * @param {Array} entries - Background entry objects or strings
     * @returns {Object} Extracted proficiency data
     * @private
     */
    _extractProficienciesFromEntries(entries) {
        const skillProfs = [];
        const toolProfs = [];

        if (!Array.isArray(entries)) return { skills: skillProfs, tools: toolProfs };

        for (const entry of entries) {
            // Check for proficiency section
            if (entry?.name &&
                (entry.name.toLowerCase().includes('proficienc') ||
                    entry.name.toLowerCase().includes('skill')) &&
                entry?.entries && Array.isArray(entry.entries)) {

                for (const subentry of entry.entries) {
                    if (typeof subentry === 'string') {
                        // Try to extract skill proficiencies
                        if (subentry.toLowerCase().includes('skill')) {
                            const skillMatches = subentry.match(/\b(acrobatics|animal handling|arcana|athletics|deception|history|insight|intimidation|investigation|medicine|nature|perception|performance|persuasion|religion|sleight of hand|stealth|survival)\b/gi);
                            if (skillMatches) {
                                skillProfs.push(...skillMatches.map(s => s.toLowerCase()));
                            }
                        }

                        // Try to extract tool proficiencies
                        if (subentry.toLowerCase().includes('tool') ||
                            subentry.toLowerCase().includes('kit') ||
                            subentry.toLowerCase().includes('set')) {
                            toolProfs.push(subentry);
                        }
                    }
                }
            }
        }

        return {
            skills: skillProfs,
            tools: toolProfs
        };
    }

    /**
     * Extract languages from entries
     * @param {Array} entries - Background entry objects or strings
     * @returns {Object} Extracted language data
     * @private
     */
    _extractLanguagesFromEntries(entries) {
        const languages = {
            known: [],
            choices: []
        };

        if (!Array.isArray(entries)) return languages;

        for (const entry of entries) {
            // Check for language section
            if (entry?.name?.toLowerCase().includes('language') &&
                entry?.entries && Array.isArray(entry.entries)) {

                for (const subentry of entry.entries) {
                    if (typeof subentry === 'string') {
                        // Try to extract specific languages
                        const commonLanguages = ['common', 'dwarvish', 'elvish', 'giant', 'gnomish',
                            'goblin', 'halfling', 'orc', 'abyssal', 'celestial',
                            'draconic', 'deep speech', 'infernal', 'primordial',
                            'sylvan', 'undercommon'];

                        for (const lang of commonLanguages) {
                            if (subentry.toLowerCase().includes(lang)) {
                                languages.known.push(lang);
                            }
                        }

                        // Check for language choices
                        if (subentry.toLowerCase().includes('choose') ||
                            subentry.toLowerCase().includes('choice') ||
                            subentry.toLowerCase().includes('select')) {

                            languages.choices.push(subentry);
                        }
                    }
                }
            }
        }

        return languages;
    }

    /**
     * Process language proficiencies from raw data
     * @param {Array} langProfs - Language proficiency objects
     * @returns {Object} Processed language data
     * @private
     */
    _processLanguageProficiencies(langProfs) {
        const result = {
            known: [],
            choices: []
        };

        if (!Array.isArray(langProfs)) return result;

        for (const prof of langProfs) {
            // Handle standard languages
            if (prof.common) {
                result.known.push('common');
            }

            // Handle specific languages
            for (const [lang, value] of Object.entries(prof)) {
                if (value === true && lang !== 'common' && lang !== 'anyStandard' && lang !== 'anyExotic') {
                    result.known.push(lang);
                }
            }

            // Handle language choices
            if (prof.anyStandard) {
                result.choices.push(`Choose ${prof.anyStandard} standard language${prof.anyStandard > 1 ? 's' : ''}`);
            }

            if (prof.anyExotic) {
                result.choices.push(`Choose ${prof.anyExotic} exotic language${prof.anyExotic > 1 ? 's' : ''}`);
            }
        }

        return result;
    }

    /**
     * Extract character characteristics from entries
     * @param {Array} entries - Background entry objects or strings
     * @returns {Object} Extracted characteristics data
     * @private
     */
    _extractCharacteristicsFromEntries(entries) {
        const characteristics = {
            personalityTraits: [],
            ideals: [],
            bonds: [],
            flaws: []
        };

        if (!Array.isArray(entries)) return characteristics;

        for (const entry of entries) {
            // Check for personality traits
            if (entry?.name?.toLowerCase().includes('personality trait') &&
                entry?.entries && Array.isArray(entry.entries)) {
                characteristics.personalityTraits = this._extractOptionsFromEntries(entry.entries);
            }

            // Check for ideals
            else if (entry?.name?.toLowerCase().includes('ideal') &&
                entry?.entries && Array.isArray(entry.entries)) {
                characteristics.ideals = this._extractOptionsFromEntries(entry.entries);
            }

            // Check for bonds
            else if (entry?.name?.toLowerCase().includes('bond') &&
                entry?.entries && Array.isArray(entry.entries)) {
                characteristics.bonds = this._extractOptionsFromEntries(entry.entries);
            }

            // Check for flaws
            else if (entry?.name?.toLowerCase().includes('flaw') &&
                entry?.entries && Array.isArray(entry.entries)) {
                characteristics.flaws = this._extractOptionsFromEntries(entry.entries);
            }
        }

        return characteristics;
    }

    /**
     * Extract options from characteristic entries
     * @param {Array} entries - Characteristic entry objects or strings
     * @returns {Array} Extracted options
     * @private
     */
    _extractOptionsFromEntries(entries) {
        const options = [];

        if (!Array.isArray(entries)) return options;

        for (const entry of entries) {
            if (typeof entry === 'string') {
                options.push(entry);
            } else if (entry?.items && Array.isArray(entry.items)) {
                options.push(...entry.items.filter(item => typeof item === 'string'));
            } else if (entry?.entries && Array.isArray(entry.entries)) {
                options.push(...this._extractOptionsFromEntries(entry.entries));
            }
        }

        return options;
    }

    /**
     * Format characteristic options for consistent output
     * @param {Array|Object} options - Raw characteristic options
     * @returns {Array} Formatted options
     * @private
     */
    _formatCharacteristicOptions(options) {
        if (!options) return [];

        if (Array.isArray(options)) {
            return options.map(opt => typeof opt === 'string' ? opt : (opt.entry || ''));
        }

        if (options.entries && Array.isArray(options.entries)) {
            return this._extractOptionsFromEntries(options.entries);
        }

        if (options.options && Array.isArray(options.options)) {
            return options.options.map(opt => opt.entry || opt);
        }

        return [];
    }

    /**
     * Get all available backgrounds
     * @returns {Array<Background>} Array of all backgrounds
     */
    getAllBackgrounds() {
        return Array.from(this._backgrounds.values());
    }

    /**
     * Get a specific background by name and source
     * @param {string} name - Background name
     * @param {string} source - Source book
     * @returns {Background|null} Background object or null if not found
     */
    getBackground(name, source = 'PHB') {
        return this._backgrounds.get(`${name}_${source}`) || null;
    }

    /**
     * Select a background
     * @param {string} backgroundName - Name of the background to select
     * @param {string} source - Source of the background
     * @returns {Background|null} The selected background or null if not found
     */
    selectBackground(backgroundName, source = 'PHB') {
        this._selectedBackground = this.getBackground(backgroundName, source);
        this._selectedVariant = null; // Reset variant when changing background

        if (this._selectedBackground) {
            eventEmitter.emit('background:selected', this._selectedBackground);
        }

        return this._selectedBackground;
    }

    /**
     * Select a variant of the currently selected background
     * @param {string} variantName - Name of the variant to select
     * @returns {Background|null} The selected variant or null if not found
     */
    selectVariant(variantName) {
        if (!this._selectedBackground) return null;

        const variants = this._selectedBackground.getVariants();
        if (!variants || variants.length === 0) return null;

        this._selectedVariant = variants.find(variant => variant.name === variantName);

        if (this._selectedVariant) {
            eventEmitter.emit('background:variantSelected', this._selectedVariant);
        }

        return this._selectedVariant;
    }

    /**
     * Get the currently selected background
     * @returns {Background|null} Currently selected background
     */
    getSelectedBackground() {
        return this._selectedBackground;
    }

    /**
     * Get the currently selected variant
     * @returns {Background|null} Currently selected variant
     */
    getSelectedVariant() {
        return this._selectedVariant;
    }

    /**
     * Get formatted skill proficiencies string
     * @param {Background} [bgData] - Background data
     * @returns {string} Formatted skill proficiencies
     */
    getFormattedSkillProficiencies(bgData) {
        const backgroundData = bgData || this._selectedVariant || this._selectedBackground;

        if (!backgroundData?.proficiencies?.skills) {
            return 'None';
        }

        const skills = backgroundData.proficiencies.skills;
        if (!skills.length) return 'None';

        return skills.map(skill =>
            skill.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
        ).join(', ');
    }

    /**
     * Get formatted tool proficiencies string
     * @param {Background} [bgData] - Background data
     * @returns {string} Formatted tool proficiencies
     */
    getFormattedToolProficiencies(bgData) {
        const backgroundData = bgData || this._selectedVariant || this._selectedBackground;

        if (!backgroundData?.proficiencies?.tools) {
            return 'None';
        }

        const tools = backgroundData.proficiencies.tools;
        if (!tools.length) return 'None';

        return tools.join(', ');
    }

    /**
     * Get formatted languages string
     * @param {Background} [bgData] - Background data
     * @returns {string} Formatted languages
     */
    getFormattedLanguages(bgData) {
        const backgroundData = bgData || this._selectedVariant || this._selectedBackground;

        if (!backgroundData?.languages) {
            return 'None';
        }

        const languages = [];

        // Add known languages
        if (backgroundData.languages?.known?.length) {
            languages.push(backgroundData.languages.known
                .map(lang => lang.charAt(0).toUpperCase() + lang.slice(1))
                .join(', '));
        }

        // Add language choices
        if (backgroundData.languages?.choices?.length) {
            languages.push(...backgroundData.languages.choices);
        }

        return languages.length ? languages.join('\n') : 'None';
    }

    /**
     * Get formatted equipment string
     * @param {Background} [bgData] - Background data
     * @returns {string} Formatted equipment
     */
    getFormattedEquipment(bgData) {
        const backgroundData = bgData || this._selectedVariant || this._selectedBackground;

        if (!backgroundData?.equipment?.length) {
            return 'None';
        }

        return backgroundData.equipment.join(', ');
    }

    /**
     * Get formatted feature description
     * @param {Background} [bgData] - Background data
     * @returns {Object} Feature name and description
     */
    getFormattedFeature(bgData) {
        const backgroundData = bgData || this._selectedVariant || this._selectedBackground;

        if (!backgroundData?.feature) {
            return { name: 'Feature', description: 'None' };
        }

        return {
            name: backgroundData.feature.name || 'Feature',
            description: backgroundData.feature.description || 'None'
        };
    }

    /**
     * Get personality trait options
     * @param {Background} [bgData] - Background data
     * @returns {Array<string>} Personality trait options
     */
    getPersonalityTraitOptions(bgData) {
        const backgroundData = bgData || this._selectedVariant || this._selectedBackground;

        if (!backgroundData?.characteristics?.personalityTraits) {
            return [];
        }

        return backgroundData.characteristics.personalityTraits;
    }

    /**
     * Get ideal options
     * @param {Background} [bgData] - Background data
     * @returns {Array<string>} Ideal options
     */
    getIdealOptions(bgData) {
        const backgroundData = bgData || this._selectedVariant || this._selectedBackground;

        if (!backgroundData?.characteristics?.ideals) {
            return [];
        }

        return backgroundData.characteristics.ideals;
    }

    /**
     * Get bond options
     * @param {Background} [bgData] - Background data
     * @returns {Array<string>} Bond options
     */
    getBondOptions(bgData) {
        const backgroundData = bgData || this._selectedVariant || this._selectedBackground;

        if (!backgroundData?.characteristics?.bonds) {
            return [];
        }

        return backgroundData.characteristics.bonds;
    }

    /**
     * Get flaw options
     * @param {Background} [bgData] - Background data
     * @returns {Array<string>} Flaw options
     */
    getFlawOptions(bgData) {
        const backgroundData = bgData || this._selectedVariant || this._selectedBackground;

        if (!backgroundData?.characteristics?.flaws) {
            return [];
        }

        return backgroundData.characteristics.flaws;
    }

    /**
     * Gets available background variants for the currently selected background
     * @returns {Array<Background>} Array of available variants
     */
    getAvailableVariants() {
        if (!this._selectedBackground) return [];

        return this._selectedBackground.getVariants();
    }
}

/**
 * Export the singleton instance
 * @type {BackgroundManager}
 */
export const backgroundManager = new BackgroundManager(); 