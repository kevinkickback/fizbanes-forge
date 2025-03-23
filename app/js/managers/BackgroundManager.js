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

let instance = null;

export class BackgroundManager {
    /**
     * Creates a new BackgroundManager instance.
     * Private constructor enforcing the singleton pattern.
     * @throws {Error} If trying to instantiate more than once
     */
    constructor() {
        if (instance) {
            throw new Error('BackgroundManager is a singleton. Use BackgroundManager.getInstance() instead.');
        }
        instance = this;

        this.backgrounds = new Map();
        this.selectedBackground = null;
        this.selectedVariant = null;
    }

    /**
     * Gets the singleton instance of BackgroundManager
     * @returns {BackgroundManager} The singleton instance
     * @static
     */
    static getInstance() {
        if (!instance) {
            instance = new BackgroundManager();
        }
        return instance;
    }

    /**
     * Initialize background data by loading and processing background information
     * @returns {Promise<boolean>} Promise resolving to true if initialization succeeded, false otherwise
     */
    async initialize() {
        try {
            // Initialize collections
            this.backgrounds = new Map();

            const backgroundData = await dataLoader.loadBackgrounds();
            this.processBackgroundData(backgroundData);
            return true;
        } catch (error) {
            console.error('Failed to initialize background data:', error);
            return false;
        }
    }

    /**
     * Process raw background data into Background objects
     * @param {Object} backgroundData - Raw background data from loader
     */
    processBackgroundData(backgroundData) {
        if (!backgroundData || !backgroundData.background) {
            console.error('Invalid background data');
            return;
        }

        // Process main backgrounds
        for (const rawBackground of backgroundData.background) {
            try {

                // Create a processed background object
                const processedData = {
                    id: `${rawBackground.name}_${rawBackground.source || 'PHB'}`,
                    name: rawBackground.name,
                    source: rawBackground.source || 'PHB',
                    description: this.getBackgroundDescription(rawBackground, backgroundData.fluff),
                    proficiencies: this.getBackgroundProficiencies(rawBackground),
                    languages: this.getBackgroundLanguages(rawBackground),
                    equipment: this.getBackgroundEquipment(rawBackground),
                    feature: this.getBackgroundFeature(rawBackground),
                    characteristics: this.getBackgroundCharacteristics(rawBackground),
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
                this.backgrounds.set(background.id, background);
            } catch (error) {
                console.error(`Error processing background ${rawBackground.name}:`, error);
            }
        }
    }

    /**
     * Gets background description from raw data and fluff entries
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @param {Array<Object>} [fluffArray] - Array of fluff entries
     * @returns {string} The background description
     */
    getBackgroundDescription(backgroundData, fluffArray) {

        // Try to find matching fluff
        if (Array.isArray(fluffArray)) {
            const fluff = fluffArray.find(f =>
                f.name === backgroundData.name &&
                (f.source === backgroundData.source || (!f.source && backgroundData.source === 'PHB'))
            );

            if (fluff) {

                if (Array.isArray(fluff.entries)) {
                    // Combine all entries to make sure we get a complete description
                    const entryText = this.processFluffEntries(fluff.entries);
                    if (entryText) return entryText;
                }
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
                    const entryText = this.processFluffEntries(entry.entries);
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
    processFluffEntries(entries) {
        if (!Array.isArray(entries)) return '';

        // Try to find a meaningful description
        for (const entry of entries) {
            if (typeof entry === 'string') {
                if (entry.length > 20) { // Minimum length for a useful description
                    return entry;
                }
            } else if (entry.entries && Array.isArray(entry.entries)) {
                const nestedText = this.processFluffEntries(entry.entries);
                if (nestedText) return nestedText;
            } else if (entry.type === "section" && entry.entries) {
                const sectionText = this.processFluffEntries(entry.entries);
                if (sectionText) return sectionText;
            }
        }

        // If no suitable entry was found, concatenate all text
        const allText = entries
            .filter(e => typeof e === 'string')
            .join(' ')
            .trim();

        return allText || '';
    }

    /**
     * Extracts proficiencies from background data by checking various possible locations
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @returns {Object} Processed proficiency data
     */
    getBackgroundProficiencies(backgroundData) {

        let skillProfs = null;
        let toolProfs = null;

        // NEW: Check for direct skillProficiencies array first (PHB format)
        if (backgroundData.skillProficiencies && Array.isArray(backgroundData.skillProficiencies)) {
            // Process direct skill proficiencies array
            // Convert the format {insight: true, religion: true} to ["Insight", "Religion"]
            const extractedSkills = [];
            for (const profObj of backgroundData.skillProficiencies) {
                for (const [skill, hasProf] of Object.entries(profObj)) {
                    if (hasProf === true) {
                        // Capitalize the skill name
                        extractedSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
                    }
                }
            }

            if (extractedSkills.length > 0) {
                skillProfs = {
                    fixed: extractedSkills,
                    choices: { count: 0, from: [] }
                };
            }
        }

        // NEW: Check for direct toolProficiencies array (PHB format)
        if (backgroundData.toolProficiencies && Array.isArray(backgroundData.toolProficiencies)) {
            // Process direct tool proficiencies array
            // Convert the format {"disguise kit": true, "forgery kit": true} to ["Disguise kit", "Forgery kit"]
            const extractedTools = [];
            for (const profObj of backgroundData.toolProficiencies) {
                for (const [tool, hasProf] of Object.entries(profObj)) {
                    if (hasProf === true) {
                        // Capitalize the tool name
                        extractedTools.push(tool.charAt(0).toUpperCase() + tool.slice(1));
                    }
                }
            }

            if (extractedTools.length > 0) {
                toolProfs = {
                    fixed: extractedTools,
                    choices: { count: 0, from: [] }
                };
            }
        }

        // Check for proficiencies object directly in the data (if we haven't found skills yet)
        if (!skillProfs && backgroundData.proficiencies) {
            // Handle direct proficiencies data structure
            if (backgroundData.proficiencies.skills) {
                skillProfs = {
                    fixed: Array.isArray(backgroundData.proficiencies.skills)
                        ? backgroundData.proficiencies.skills
                        : [],
                    choices: backgroundData.proficiencies.skillChoices || { count: 0, from: [] }
                };
            }

            if (backgroundData.proficiencies.tools) {
                toolProfs = {
                    fixed: Array.isArray(backgroundData.proficiencies.tools)
                        ? backgroundData.proficiencies.tools
                        : [],
                    choices: backgroundData.proficiencies.toolChoices || { count: 0, from: [] }
                };
            }
        }

        // If proficiencies weren't found directly, check for them in the entries
        if (!skillProfs || !toolProfs) {
            // Check for proficiencies in the entries array
            if (backgroundData.entries && Array.isArray(backgroundData.entries)) {
                for (const entry of backgroundData.entries) {
                    // Look for the "Skill Proficiencies" section (with or without colon)
                    if ((entry.name === "Skill Proficiencies" || entry.name === "Skill Proficiencies:") && entry.entry) {
                        const entryText = typeof entry.entry === "string"
                            ? entry.entry
                            : JSON.stringify(entry.entry);

                        skillProfs = this.parseSkillProficienciesFromText(entryText);
                    }

                    // Look for the "Tool Proficiencies" section (with or without colon)
                    if ((entry.name === "Tool Proficiencies" || entry.name === "Tool Proficiencies:") && entry.entry) {
                        const entryText = typeof entry.entry === "string"
                            ? entry.entry
                            : JSON.stringify(entry.entry);

                        toolProfs = this.parseToolProficienciesFromText(entryText);
                    }
                }
            }
        }

        // We don't want to remove the JSON tags anymore since they're needed for the text processor
        // Just return the extracted proficiencies as-is

        // Return the extracted proficiencies
        return {
            skills: skillProfs || { fixed: [], choices: { count: 0, from: [] } },
            tools: toolProfs || { fixed: [], choices: { count: 0, from: [] } }
        };
    }

    /**
     * Parse skill proficiencies from text description
     * @param {string} text - Text description of skill proficiencies
     * @returns {Object} Structured skill proficiencies object
     */
    parseSkillProficienciesFromText(text) {
        const result = {
            fixed: [],
            choices: { count: 0, from: [] }
        };

        if (!text) return result;

        // Special case for Acolyte pattern with JSON tags: "{@skill Insight}, {@skill Religion}"
        const skillTagRegex = /{@skill ([^}]+)}/g;
        const matches = Array.from(text.matchAll(skillTagRegex));

        if (matches.length > 0) {
            result.fixed = matches.map(match => match[1]);
            return result;
        }

        // Check for Acolyte-like pattern: "Insight, Religion"
        const simpleList = /^[\w\s,]+$/i.test(text);
        if (simpleList) {
            result.fixed = this.parseCommaSeparatedList(text);
            return result;
        }

        // Check for choices format - "Choose any two/two skills from..."
        const choiceMatch = text.match(/choose\s+(?:any\s+)?(\w+|\d+)(?:\s+skills)?\s+from(?:\s+among)?(?:\s+the\s+following)?:\s+([^\.]+)/i) ||
            text.match(/choose\s+(?:any\s+)?(\w+|\d+)(?:\s+skills)?\s+from\s+([^\.]+)/i);

        if (choiceMatch) {
            const countWord = choiceMatch[1].toLowerCase();
            const skillsText = choiceMatch[2];

            // Convert word to number if needed
            let count;
            if (/^\d+$/.test(countWord)) {
                count = Number.parseInt(countWord, 10);
            } else {
                const countMap = {
                    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
                };
                count = countMap[countWord] || 2; // Default to 2 if we can't parse
            }

            const skills = this.parseCommaSeparatedList(skillsText);

            result.choices.count = count;
            result.choices.from = skills;

            // Check for fixed skills before the choice
            const beforeChoice = text.match(/^([\w\s,]+)(?=.*choose)/i);
            if (beforeChoice) {
                result.fixed = this.parseCommaSeparatedList(beforeChoice[1]);
            }

            return result;
        }

        // If we get here, just try to parse as a list of fixed skills
        result.fixed = this.parseCommaSeparatedList(text);
        return result;
    }

    /**
     * Parse tool proficiencies from text description
     * @param {string} text - Text description of tool proficiencies
     * @returns {Object} Structured tool proficiencies object
     */
    parseToolProficienciesFromText(text) {
        const result = {
            fixed: [],
            choices: { count: 0, from: [] }
        };

        if (!text) return result;

        // Handle "None" case
        if (text.toLowerCase().includes('none')) {
            return result;
        }

        // Special case for pattern with JSON item tags: "{@item Disguise kit|phb}, {@item Forgery kit|phb}"
        const itemTagRegex = /{@item ([^}|]+)(?:\|[^}]+)?}/g;
        const itemMatches = Array.from(text.matchAll(itemTagRegex));

        if (itemMatches.length > 0) {
            result.fixed = itemMatches.map(match => match[1]);
            return result;
        }

        // Check for simple list (e.g., "Thieves' tools")
        const simpleList = /^[\w\s,']+$/i.test(text);
        if (simpleList) {
            result.fixed = this.parseCommaSeparatedList(text);
            return result;
        }

        // Check for choices format - "Choose any two from..."
        const choiceMatch = text.match(/choose\s+(?:any\s+)?(\w+|\d+)(?:\s+types\s+of|\s+sets\s+of|\s+)?(?:\s+tools)?\s+from(?:\s+among)?(?:\s+the\s+following)?:\s+([^\.]+)/i) ||
            text.match(/choose\s+(?:any\s+)?(\w+|\d+)(?:\s+types\s+of|\s+sets\s+of|\s+)?(?:\s+tools)?\s+from\s+([^\.]+)/i);

        if (choiceMatch) {
            const countWord = choiceMatch[1].toLowerCase();
            const toolsText = choiceMatch[2];

            // Convert word to number if needed
            let count;
            if (/^\d+$/.test(countWord)) {
                count = Number.parseInt(countWord, 10);
            } else {
                const countMap = {
                    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
                };
                count = countMap[countWord] || 1; // Default to 1 if we can't parse
            }

            const tools = this.parseCommaSeparatedList(toolsText);

            result.choices.count = count;
            result.choices.from = tools;

            // Check for fixed tools before the choice
            const beforeChoice = text.match(/^([\w\s,]+)(?=.*choose)/i);
            if (beforeChoice) {
                result.fixed = this.parseCommaSeparatedList(beforeChoice[1]);
            }

            return result;
        }

        // Handle "One type of xxx" pattern (common for gaming sets, musical instruments)
        const oneTypeMatch = text.match(/one\s+(?:type|set)\s+of\s+([\w\s]+)(?:\s+of\s+your\s+choice)?/i);
        if (oneTypeMatch) {
            const toolType = oneTypeMatch[1].trim();
            result.choices.count = 1;
            result.choices.from = [toolType];
            return result;
        }

        // If we get here, just try to parse as a list of fixed tools
        result.fixed = this.parseCommaSeparatedList(text);
        return result;
    }

    /**
     * Extracts languages from background data by checking various possible locations
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @returns {Object} Processed language data
     */
    getBackgroundLanguages(backgroundData) {

        // NEW: Check for direct languageProficiencies array first (PHB format)
        if (backgroundData.languageProficiencies && Array.isArray(backgroundData.languageProficiencies)) {
            for (const langObj of backgroundData.languageProficiencies) {
                // Handle the "anyStandard" case (e.g., {anyStandard: 2})
                if ('anyStandard' in langObj && typeof langObj.anyStandard === 'number') {
                    return {
                        fixed: [],
                        choices: { count: langObj.anyStandard, from: ['Any'] }
                    };
                }

                // Handle the "any" case
                if ('any' in langObj && typeof langObj.any === 'number') {
                    return {
                        fixed: [],
                        choices: { count: langObj.any, from: ['Any'] }
                    };
                }

                // Handle specific languages listed as {common: true, elvish: true}
                const languages = [];
                for (const [lang, hasProf] of Object.entries(langObj)) {
                    if (hasProf === true && lang !== 'anyStandard' && lang !== 'any') {
                        languages.push(lang.charAt(0).toUpperCase() + lang.slice(1));
                    }
                }

                if (languages.length > 0) {
                    return {
                        fixed: languages,
                        choices: { count: 0, from: [] }
                    };
                }
            }
        }

        // Check for direct languages property
        if (backgroundData.languages) {
            // If already in the right format with fixed and choices
            if (backgroundData.languages.fixed || backgroundData.languages.choices) {
                return {
                    fixed: backgroundData.languages.fixed || [],
                    choices: backgroundData.languages.choices || { count: 0, from: [] }
                };
            }

            // If it's an array of fixed languages
            if (Array.isArray(backgroundData.languages)) {
                return {
                    fixed: backgroundData.languages,
                    choices: { count: 0, from: [] }
                };
            }

            // If it's just a count of choices
            if (backgroundData.languages.any === true || typeof backgroundData.languages.any === 'number') {
                const count = typeof backgroundData.languages.any === 'number' ? backgroundData.languages.any : 1;
                return {
                    fixed: [],
                    choices: { count: count, from: ['Any'] }
                };
            }
        }

        // Check for languages in the entries array
        if (backgroundData.entries && Array.isArray(backgroundData.entries)) {
            for (const entry of backgroundData.entries) {
                // Look for the "Languages" section (with or without colon)
                if ((entry.name === "Languages" || entry.name === "Languages:") && entry.entry) {
                    const entryText = typeof entry.entry === "string"
                        ? entry.entry
                        : JSON.stringify(entry.entry);

                    // Handle exact match for "Two of your choice"
                    if (entryText === "Two of your choice") {
                        return {
                            fixed: [],
                            choices: { count: 2, from: ['Any'] }
                        };
                    }

                    // Handle all forms of "X of your choice"
                    if (/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:language|languages)\s+of\s+your\s+choice\b/i.test(entryText)) {
                        const countMatch = entryText.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:language|languages)/i);
                        if (countMatch) {
                            const countWord = countMatch[1].toLowerCase();
                            let count;

                            if (/^\d+$/.test(countWord)) {
                                count = Number.parseInt(countWord, 10);
                            } else {
                                const countMap = {
                                    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                                    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
                                };
                                count = countMap[countWord] || 1;
                            }

                            return {
                                fixed: [],
                                choices: { count: count, from: ['Any'] }
                            };
                        }
                    }

                    return this.parseLanguagesFromText(entryText);
                }
            }
        }

        // Return empty structure if no languages found
        return { fixed: [], choices: { count: 0, from: [] } };
    }

    /**
     * Parse languages from text description
     * @param {string} text - Text description of languages
     * @returns {Object} Structured languages object
     */
    parseLanguagesFromText(text) {
        const result = {
            fixed: [],
            choices: { count: 0, from: [] }
        };

        if (!text) return result;

        // Check for common choice patterns
        const twoOfYourChoice = text.match(/two\s+languages\s+of\s+your\s+choice/i);
        const oneOfYourChoice = text.match(/one\s+language\s+of\s+your\s+choice/i);
        const anyNumberOfYourChoice = text.match(/(\w+)\s+languages\s+of\s+your\s+choice/i);

        if (twoOfYourChoice) {
            result.choices.count = 2;
            result.choices.from = ['Any'];

            // Check if there are also fixed languages
            const fixedMatch = text.match(/([\w\s,]+)(?=and two)/i);
            if (fixedMatch) {
                result.fixed = this.parseCommaSeparatedList(fixedMatch[1]);
            }

            return result;
        }

        if (oneOfYourChoice) {
            result.choices.count = 1;
            result.choices.from = ['Any'];

            // Check if there are also fixed languages
            const fixedMatch = text.match(/([\w\s,]+)(?=and one)/i);
            if (fixedMatch) {
                result.fixed = this.parseCommaSeparatedList(fixedMatch[1]);
            }

            return result;
        }

        if (anyNumberOfYourChoice && !twoOfYourChoice && !oneOfYourChoice) {
            const countWord = anyNumberOfYourChoice[1].toLowerCase();
            const countMap = {
                'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
            };

            if (countMap[countWord]) {
                result.choices.count = countMap[countWord];
                result.choices.from = ['Any']; // From any available languages

                // Check if there are also fixed languages
                const fixedMatch = text.match(/([\w\s,]+)(?=and \w+ languages of your choice)/i);
                if (fixedMatch) {
                    result.fixed = this.parseCommaSeparatedList(fixedMatch[1]);
                }

                return result;
            }
        }

        // If no choice pattern was found, assume these are fixed languages
        result.fixed = this.parseCommaSeparatedList(text);
        return result;
    }

    /**
     * Helper to parse comma-separated lists
     * @param {string} text - The text to parse
     * @returns {Array} Array of parsed items
     */
    parseCommaSeparatedList(text) {
        // Split by commas and "and" while preserving any JSON tags
        return text
            .split(/,\s*and\s*|,\s*|\s+and\s+/)
            .map(s => s.trim())
            .filter(Boolean)
            .map(s => {
                // Only capitalize the first letter if it's not a JSON tag
                if (!s.startsWith('{@')) {
                    return s.charAt(0).toUpperCase() + s.slice(1);
                }
                return s;
            });
    }

    /**
     * Extracts equipment from background data
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @returns {Array} Processed equipment list
     */
    getBackgroundEquipment(backgroundData) {
        const equipment = [];

        // Check for equipment in the entries array
        if (backgroundData.entries && Array.isArray(backgroundData.entries)) {
            for (const entry of backgroundData.entries) {
                // Look for the "Equipment" section
                if (entry.name === "Equipment" && typeof entry.entry === "string") {
                    const items = this.parseEquipmentFromText(entry.entry);
                    equipment.push(...items);
                }
            }
        }

        // If we found equipment items in the entries, return them
        if (equipment.length > 0) {
            return equipment;
        }

        // Otherwise try to parse from startingEquipment
        if (backgroundData.startingEquipment && Array.isArray(backgroundData.startingEquipment)) {
            return this.processStartingEquipment(backgroundData.startingEquipment);
        }

        return [];
    }

    /**
     * Process the startingEquipment array from the background data
     * @param {Array} equipmentArray - The startingEquipment array
     * @returns {Array} Processed equipment list
     */
    processStartingEquipment(equipmentArray) {
        const results = [];

        for (const equipSection of equipmentArray) {
            if (equipSection._) {
                for (const item of equipSection._) {
                    if (typeof item === 'string') {
                        results.push(item.split('|')[0]);
                    } else if (item.item) {
                        results.push(item.displayName || item.item.split('|')[0]);
                    } else if (item.special) {
                        const quantity = item.quantity ? `${item.quantity} ` : '';
                        results.push(`${quantity}${item.special}`);
                    }
                }
            }

            // Handle choice options
            for (const key in equipSection) {
                if (key !== '_' && Array.isArray(equipSection[key])) {
                    const choices = equipSection[key].map(item => {
                        if (typeof item === 'string') {
                            return item.split('|')[0];
                        }
                        if (item.item) {
                            return item.displayName || item.item.split('|')[0];
                        }
                        if (item.special) {
                            return item.special;
                        }
                        return null;
                    }).filter(Boolean);

                    if (choices.length > 0) {
                        results.push(`Choice: ${choices.join(' or ')}`);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Parse equipment items from text description
     * @param {string} text - Text description of equipment
     * @returns {Array} List of equipment items
     */
    parseEquipmentFromText(text) {

        if (!text) return [];

        // Split by commas but handle "and" for the last item
        return text.split(/,\s*(?=(?:[^"]*"[^"]*")*[^"]*$)/)
            .flatMap(part => {
                const andParts = part.split(/\s+and\s+/);
                return andParts.length > 1 ? andParts : [part];
            })
            .map(item => item.trim())
            .filter(Boolean);
    }

    /**
     * Extracts feature from background data
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @returns {Object} Processed feature data
     */
    getBackgroundFeature(backgroundData) {
        if (backgroundData.entries && Array.isArray(backgroundData.entries)) {
            // Look for a feature entry that has a name containing "Feature"
            for (const entry of backgroundData.entries) {
                if (entry.name?.includes("Feature") && entry.entries) {
                    const featureName = entry.name;
                    let featureDesc = '';

                    // Concatenate the entries for the description
                    if (Array.isArray(entry.entries)) {
                        featureDesc = entry.entries.map(e => {
                            if (typeof e === 'string') return e;
                            if (e.entries && Array.isArray(e.entries)) return e.entries.join('\n');
                            return JSON.stringify(e);
                        }).join('\n');
                    }

                    return { name: featureName, description: featureDesc };
                }
            }
        }

        // Fallback to the feature property if present
        if (backgroundData.feature) {
            return {
                name: backgroundData.feature.name || '',
                description: (backgroundData.feature.entries || []).join('\n')
            };
        }

        return { name: '', description: '' };
    }

    /**
     * Extracts characteristics from background data
     * @param {RawBackgroundData} backgroundData - Raw background data
     * @returns {Object} Processed characteristics data
     */
    getBackgroundCharacteristics(backgroundData) {
        if (!backgroundData.characteristics) {
            return this.extractCharacteristicsFromEntries(backgroundData.entries);
        }

        return backgroundData.characteristics;
    }

    /**
     * Extract characteristics from background entries
     * @param {Array} entries - Background entries
     * @returns {Object} Characteristics object
     */
    extractCharacteristicsFromEntries(entries) {
        const characteristics = {
            personalityTraits: [],
            ideals: [],
            bonds: [],
            flaws: []
        };

        if (!entries || !Array.isArray(entries)) {
            return characteristics;
        }

        // Find the "Suggested Characteristics" section
        const suggestedCharacteristics = entries.find(entry =>
            entry.name === "Suggested Characteristics" && entry.type === "entries"
        );

        if (suggestedCharacteristics?.entries) {
            // Process each table in the entries
            for (const entry of suggestedCharacteristics.entries) {
                if (entry.type === "table") {
                    const label = entry.colLabels[1].toLowerCase();
                    if (label === "personality trait") {
                        characteristics.personalityTraits = entry.rows.map(row => row[1]);
                    } else if (label === "ideal") {
                        characteristics.ideals = entry.rows.map(row => row[1]);
                    } else if (label === "bond") {
                        characteristics.bonds = entry.rows.map(row => row[1]);
                    } else if (label === "flaw") {
                        characteristics.flaws = entry.rows.map(row => row[1]);
                    }
                }
            }
        }

        return characteristics;
    }

    /**
     * Gets all backgrounds without filtering
     * @returns {Array} Array of all background objects
     */
    getAllBackgrounds() {
        return Array.from(this.backgrounds.values());
    }

    /**
     * Get background by name and source
     * @param {string} name - Background name
     * @param {string} [source='PHB'] - Background source book
     * @returns {ProcessedBackground|null} Background object or null if not found
     */
    getBackground(name, source = 'PHB') {
        return this.backgrounds.get(`${name}_${source}`) || null;
    }

    /**
     * Select a background by name and source
     * @param {string} backgroundName - Name of the background
     * @param {string} [source='PHB'] - Source book of the background
     * @returns {ProcessedBackground|null} The selected background or null if not found
     */
    selectBackground(backgroundName, source = 'PHB') {
        this.selectedBackground = this.getBackground(backgroundName, source);
        this.selectedVariant = null; // Reset variant when changing background
        return this.selectedBackground;
    }

    /**
     * Select a variant background
     * @param {string} variantName - Name of the variant to select
     * @returns {Background|null} Selected variant or null if not found
     */
    selectVariant(variantName) {
        if (!this.selectedBackground) return null;

        const variants = this.selectedBackground.getVariants();
        if (!variants || variants.length === 0) return null;

        this.selectedVariant = variants.find(variant => variant.name === variantName);
        return this.selectedVariant;
    }

    /**
     * Get the currently selected background
     * @returns {ProcessedBackground|null} The selected background or null if none selected
     */
    getSelectedBackground() {
        return this.selectedBackground;
    }

    /**
     * Get the currently selected variant
     * @returns {Object|null} The selected variant or null if none selected
     */
    getSelectedVariant() {
        return this.selectedVariant;
    }

    /**
     * Gets the formatted skill proficiencies string for display
     * @param {Background} backgroundData - The background object
     * @returns {string} Formatted skill proficiencies string
     */
    getFormattedSkillProficiencies(backgroundData) {
        if (!backgroundData) return 'None';

        const fixedProficiencies = backgroundData.getFixedProficiencies();
        const fixedSkills = fixedProficiencies.skills || [];

        const skillChoices = backgroundData.proficiencies?.skills?.choices;
        let result = '';

        // Add fixed proficiencies
        if (fixedSkills.length > 0) {
            result += fixedSkills.join(', ');
        }

        // Add skill choices if present
        if (skillChoices && skillChoices.count > 0) {
            if (result) result += ', plus ';
            if (skillChoices.from.length > 0) {
                result += `choose ${skillChoices.count} from: ${skillChoices.from.join(', ')}`;
            } else {
                result += `choose ${skillChoices.count} skill${skillChoices.count > 1 ? 's' : ''}`;
            }
        }

        return result || 'None';
    }

    /**
     * Gets the formatted tool proficiencies string for display
     * @param {Background} backgroundData - The background object
     * @returns {string} Formatted tool proficiencies string
     */
    getFormattedToolProficiencies(backgroundData) {
        if (!backgroundData) return 'None';

        const fixedProficiencies = backgroundData.getFixedProficiencies();
        const fixedTools = fixedProficiencies.tools || [];

        const toolChoices = backgroundData.proficiencies?.tools?.choices;
        let result = '';

        // Add fixed proficiencies
        if (fixedTools.length > 0) {
            result += fixedTools.join(', ');
        }

        // Add tool choices if present
        if (toolChoices && toolChoices.count > 0) {
            if (result) result += ', plus ';
            if (toolChoices.from.length > 0 && toolChoices.from[0] !== 'Any') {
                result += `choose ${toolChoices.count} from: ${toolChoices.from.join(', ')}`;
            } else {
                result += `choose ${toolChoices.count} tool${toolChoices.count > 1 ? 's' : ''}`;
            }
        }

        return result || 'None';
    }

    /**
     * Gets the formatted languages string for display
     * @param {Background} backgroundData - The background object
     * @returns {string} Formatted languages string
     */
    getFormattedLanguages(backgroundData) {
        if (!backgroundData) return 'None';

        const fixedLanguages = backgroundData.getFixedLanguages() || [];
        const languageChoices = backgroundData.languages?.choices;
        let result = '';

        // Add fixed languages
        if (fixedLanguages.length > 0) {
            result += fixedLanguages.join(', ');
        }

        // Add language choices if present
        if (languageChoices && languageChoices.count > 0) {
            if (result) result += ', plus ';
            if (languageChoices.from && languageChoices.from.length > 0 && languageChoices.from[0] !== 'Any') {
                result += `choose ${languageChoices.count} from: ${languageChoices.from.join(', ')}`;
            } else {
                result += `choose ${languageChoices.count} language${languageChoices.count > 1 ? 's' : ''}`;
            }
        }

        return result || 'None';
    }

    /**
     * Gets the formatted equipment string for display
     * @param {Background} backgroundData - The background object
     * @returns {string} Formatted equipment string
     */
    getFormattedEquipment(backgroundData) {
        if (!backgroundData) return 'None';

        const equipment = backgroundData.equipment || [];

        if (equipment.length === 0) {
            return 'None';
        }

        return equipment.join(', ');
    }
}

/**
 * Export the singleton instance
 * @type {BackgroundManager}
 */
export const backgroundManager = BackgroundManager.getInstance(); 