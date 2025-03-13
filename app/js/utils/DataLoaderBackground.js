/**
 * DataLoaderBackground.js
 * Handles loading and processing of character background data
 * 
 * @typedef {Object} BackgroundFeature
 * @property {string} name - Feature name
 * @property {string} description - Feature description
 * @property {Object|null} requirements - Feature requirements
 * 
 * @typedef {Object} PersonalityEntry
 * @property {number} roll - Dice roll value
 * @property {string} description - Entry description
 * 
 * @typedef {Object} BackgroundCharacteristics
 * @property {Array<PersonalityEntry>|null} personalityTraits - Personality traits table
 * @property {Array<PersonalityEntry>|null} ideals - Ideals table
 * @property {Array<PersonalityEntry>|null} bonds - Bonds table
 * @property {Array<PersonalityEntry>|null} flaws - Flaws table
 * 
 * @typedef {Object} BackgroundVariant
 * @property {string} name - Variant name
 * @property {string} source - Source book
 * @property {string} description - Variant description
 * @property {Array<BackgroundFeature>} features - Variant features
 * 
 * @typedef {Object} ProficiencyChoice
 * @property {string} type - Type of choice ('choice')
 * @property {number} count - Number of choices to make
 * @property {Array<string>} from - Available options
 * 
 * @typedef {Object} BackgroundProficiencies
 * @property {Array<string>|ProficiencyChoice} skills - Skill proficiencies or choices
 * @property {Array<string>|ProficiencyChoice} tools - Tool proficiencies or choices
 * @property {Array<string>|ProficiencyChoice} languages - Language proficiencies or choices
 * @property {Array<string>} expertise - Expertise in specific skills
 * 
 * @typedef {Object} StartingEquipment
 * @property {string} type - Type of equipment ('item' or 'currency')
 * @property {string} name - Item name
 * @property {string} source - Source book
 * @property {number} [value] - Currency value if type is 'currency'
 * 
 * @typedef {Object} FluffData
 * @property {string} entries - Descriptive text
 * @property {Array<Object>} images - Associated images
 * 
 * @typedef {Object} AbilityScore
 * @property {string} type - Type of ability score improvement ('weighted' or direct)
 * @property {Array<string>} [from] - Available options for weighted choices
 * @property {Array<number>} [weights] - Weights for weighted choices
 * 
 * @typedef {Object} Feat
 * @property {string} name - Feat name
 * @property {string} source - Source book
 * @property {boolean} required - Whether the feat is required
 * 
 * @typedef {Object} ProcessedBackground
 * @property {string} id - Unique identifier
 * @property {string} name - Background name
 * @property {string} source - Source book
 * @property {number|null} page - Page number
 * @property {string} description - Background description
 * @property {Array<BackgroundFeature>} features - Background features
 * @property {BackgroundCharacteristics|null} characteristics - Background characteristics
 * @property {BackgroundProficiencies} proficiencies - Background proficiencies
 * @property {Array<StartingEquipment>} startingEquipment - Starting equipment
 * @property {Array<BackgroundVariant>} variants - Background variants
 * @property {FluffData|null} fluff - Descriptive information
 * @property {Array<AbilityScore>|null} abilityScores - Ability score improvements
 * @property {Array<Feat>|null} feats - Available feats
 */

import { DataLoader } from './DataLoader.new.js';

/**
 * DataLoaderBackground.js
 * Handles loading and processing of character background data
 */
export class DataLoaderBackground extends DataLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            backgrounds: 'backgrounds.json',
            fluff: 'fluff-backgrounds.json'
        };
    }

    /**
     * Load all background data with improved caching and error handling
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<{backgrounds: Array<ProcessedBackground>}>} Processed background data
     */
    async loadBackgrounds(options = {}) {
        return this.getOrLoadData('backgrounds', async () => {
            try {
                console.log('Loading background data...');
                const [backgroundData, fluffData] = await Promise.all([
                    this.loadJsonFile(this.dataFiles.backgrounds, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load background data:', error);
                        throw new Error('Failed to load background data');
                    }),
                    this.loadJsonFile(this.dataFiles.fluff, {
                        ...options,
                        maxRetries: 2
                    }).catch(() => ({ backgroundFluff: [] }))
                ]);

                if (!backgroundData || !backgroundData.background) {
                    throw new Error('Invalid or empty background data');
                }

                console.log(`Loaded ${backgroundData?.background?.length || 0} backgrounds`);
                const processed = this.processBackgroundData(backgroundData, fluffData);
                console.log(`Processed ${processed.backgrounds.length} backgrounds`);

                // Cache individual backgrounds for faster lookup
                for (const background of processed.backgrounds) {
                    this.dataCache.set(`background_${background.id}`, background);
                }

                return processed;
            } catch (error) {
                console.error('Error loading backgrounds:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load backgrounds in chunks for better performance
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Array<ProcessedBackground>>} Generator yielding chunks of background data
     */
    async *loadBackgroundsInChunks(chunkSize = 5, options = {}) {
        const data = await this.loadBackgrounds(options);

        for (let i = 0; i < data.backgrounds.length; i += chunkSize) {
            yield data.backgrounds.slice(i, i + chunkSize);
        }
    }

    /**
     * Process raw background data into standardized format with improved validation
     * @private
     * @param {Object} backgroundData - Raw background data
     * @param {Object} fluffData - Background fluff data
     * @returns {{backgrounds: Array<ProcessedBackground>}} Processed background data
     */
    processBackgroundData(backgroundData, fluffData) {
        const allowedSources = this.getAllowedSources();
        const processedData = {
            backgrounds: []
        };

        if (backgroundData.background) {
            console.log('Total backgrounds before filtering:', backgroundData.background.length);
            console.log('Allowed sources:', Array.from(allowedSources));

            processedData.backgrounds = backgroundData.background
                .filter(bg => {
                    const isAllowed = allowedSources.has(bg.source);
                    if (!isAllowed) {
                        console.log(`Filtered out background ${bg.name} (${bg.source}) - not in allowed sources`);
                    }
                    return isAllowed;
                })
                .map(bg => {
                    try {
                        return this.processBackground(bg, fluffData, backgroundData);
                    } catch (error) {
                        console.error(`Error processing background ${bg.name}:`, error);
                        return null;
                    }
                })
                .filter(Boolean);

            console.log('Total backgrounds after filtering:', processedData.backgrounds.length);
        }

        return processedData;
    }

    /**
     * Process a single background
     * @private
     */
    processBackground(bg, fluffData, backgroundData) {
        try {
            if (!bg || !bg.name) {
                console.warn('Invalid background data:', bg);
                return null;
            }

            this.currentBackground = bg;

            const baseId = (bg.id || bg.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const source = bg.source || 'PHB';
            const id = `${baseId}_${source.toLowerCase()}`;

            // Extract features from entries
            let features = [];
            try {
                const directFeatures = bg.feature || bg.features;
                if (directFeatures) {
                    features = this.processFeatures(directFeatures);
                } else if (bg.entries) {
                    features = bg.entries
                        .filter(entry =>
                            entry.name?.toLowerCase().includes('feature:') ||
                            entry.data?.isFeature === true
                        )
                        .map(entry => ({
                            name: entry.name.replace(/^Feature:\s*/, '').trim(),
                            description: this.processDescription(entry.entries || []),
                            requirements: null
                        }));
                }
            } catch (error) {
                console.error(`Error processing features for ${bg.name}:`, error);
                features = [];
            }

            // Process proficiencies
            const proficiencies = {
                skills: this.processSkillProficiencies(bg.skillProficiencies),
                tools: this.processToolProficiencies(bg.toolProficiencies),
                languages: this.processLanguages(bg.languages),
                expertise: bg.expertise || []
            };

            // Process equipment
            const startingEquipment = bg.startingEquipment && Array.isArray(bg.startingEquipment)
                ? this.processStartingEquipment(bg.startingEquipment)
                : bg.equipment
                    ? [{
                        A: bg.equipment.map(item => ({
                            type: 'item',
                            name: item,
                            source: bg.source
                        }))
                    }]
                    : [];

            // Process characteristics
            let characteristics = null;
            try {
                if (bg.entries) {
                    const characteristicsEntry = bg.entries.find(entry =>
                        entry.name === 'Suggested Characteristics'
                    );
                    if (characteristicsEntry) {
                        const tables = characteristicsEntry.entries.filter(e => e.type === 'table');
                        characteristics = {
                            personalityTraits: tables[0]?.rows?.map(row => ({ roll: Number.parseInt(row[0], 10), description: row[1] })) || null,
                            ideals: tables[1]?.rows?.map(row => ({ roll: Number.parseInt(row[0], 10), description: row[1] })) || null,
                            bonds: tables[2]?.rows?.map(row => ({ roll: Number.parseInt(row[0], 10), description: row[1] })) || null,
                            flaws: tables[3]?.rows?.map(row => ({ roll: Number.parseInt(row[0], 10), description: row[1] })) || null
                        };
                    }
                }
            } catch (error) {
                console.error(`Error processing characteristics for ${bg.name}:`, error);
                characteristics = null;
            }

            // Filter out mechanical entries from description
            const descriptionEntries = bg.entries?.filter(entry => {
                if (!entry || entry.data?.isFeature) return false;
                const name = entry.name?.toLowerCase() || '';
                if (name.includes('skill proficiencies') ||
                    name.includes('tool proficiencies') ||
                    name.includes('languages') ||
                    name.includes('equipment')) {
                    return false;
                }
                if (entry.type === 'list' &&
                    (entry.style === 'list-hang-notitle' || entry.style === 'list-no-bullets') &&
                    entry.items?.every(item =>
                        item.name?.toLowerCase().includes('proficiencies') ||
                        item.name?.toLowerCase().includes('equipment') ||
                        item.name?.toLowerCase().includes('languages')
                    )) {
                    return false;
                }
                return true;
            }) || [];

            // Get description from fluff data if available
            const fluff = this.processFluff(bg.name, source, fluffData?.backgroundFluff || []);
            const description = fluff?.entries || this.processDescription(descriptionEntries);

            return {
                id,
                name: bg.name,
                source: source,
                page: bg.page || null,
                description,
                features,
                characteristics,
                proficiencies,
                startingEquipment,
                variants: this.processVariants(bg.variants, backgroundData),
                fluff,
                abilityScores: bg.ability?.map(choice => choice.choose?.weighted ? {
                    type: 'weighted',
                    from: choice.choose.weighted.from,
                    weights: choice.choose.weighted.weights
                } : choice) || null,
                feats: bg.feats?.map(feat => {
                    const [name, source = 'PHB'] = Object.keys(feat)[0].split('|');
                    return { name, source, required: Object.values(feat)[0] };
                }) || []
            };
        } catch (error) {
            console.error(`Error processing background ${bg?.name || 'unknown'}:`, error);
            return null;
        } finally {
            this.currentBackground = null;
        }
    }

    /**
     * Process skill proficiencies with weighted choices
     * @private
     */
    processSkillProficiencies(skills) {
        if (!skills) return [];
        if (typeof skills === 'string') return [skills];
        if (Array.isArray(skills)) {
            console.debug('Processing skill proficiencies array:', skills);
            return skills.flatMap(profSet => {
                if (profSet.choose) {
                    return {
                        type: 'choice',
                        count: profSet.choose.count || 1,
                        from: profSet.choose.from || []
                    };
                }
                // Handle direct proficiencies
                if (typeof profSet === 'object' && !Array.isArray(profSet)) {
                    console.debug('Processing object proficiency set:', profSet);
                    const result = Object.entries(profSet)
                        .filter(([_, hasProf]) => hasProf === true)
                        .map(([skill]) => skill);
                    console.debug('Extracted skills:', result);
                    return result;
                }
                // Handle string entries
                if (typeof profSet === 'string') {
                    return profSet;
                }
                return [];
            });
        }
        // Handle object format with boolean values
        if (typeof skills === 'object') {
            console.debug('Processing single object proficiency:', skills);
            const result = Object.entries(skills)
                .filter(([_, hasProf]) => hasProf === true)
                .map(([skill]) => skill);
            console.debug('Extracted skills:', result);
            return result;
        }
        return [];
    }

    /**
     * Process tool proficiencies into a standardized format
     * @private
     */
    processToolProficiencies(tools) {
        if (!tools) return [];
        if (typeof tools === 'string') return [tools];
        if (Array.isArray(tools)) return tools;

        if (tools.choose) {
            return {
                choose: {
                    count: tools.choose.count || 1,
                    from: tools.choose.from || []
                }
            };
        }

        return [];
    }

    /**
     * Process languages into a standardized format
     * @private
     */
    processLanguages(languages) {
        if (!languages) return [];
        if (Array.isArray(languages)) return languages;
        if (typeof languages === 'string') return [languages];

        if (languages.choose) {
            return {
                choose: {
                    count: languages.choose.count || 1,
                    from: languages.choose.from || []
                }
            };
        }

        return [];
    }

    /**
     * Process description entries into a formatted string
     * @private
     */
    processDescription(entries) {
        if (!entries) return '';
        if (typeof entries === 'string') return entries;

        return entries
            .map(entry => {
                if (typeof entry === 'string') return entry;
                if (entry.type === 'list') {
                    return entry.items.map(item => {
                        if (typeof item === 'string') return `• ${item}`;
                        if (item.name) return `• ${item.name}: ${this.processDescription([item])}`;
                        return `• ${this.processDescription([item])}`;
                    }).join('\n');
                }
                if (entry.type === 'table') {
                    return `Table: ${entry.caption || ''}\n${entry.rows.map(row => row.join(' | ')).join('\n')}`;
                }
                if (entry.type === 'item') {
                    return `${entry.name}: ${this.processDescription(entry.entries)}`;
                }
                if (entry.entries) {
                    return this.processDescription(entry.entries);
                }
                if (entry.items) {
                    return this.processDescription(entry.items);
                }
                return '';
            })
            .filter(Boolean)
            .join('\n\n');
    }

    /**
     * Process ability score improvements
     * @private
     */
    processAbilityScores(ability) {
        if (!ability) return null;

        return ability.map(choice => {
            if (choice.choose?.weighted) {
                return {
                    type: 'weighted',
                    from: choice.choose.weighted.from,
                    weights: choice.choose.weighted.weights
                };
            }
            return choice;
        });
    }

    /**
     * Process feat options
     * @private
     */
    processFeats(feats) {
        if (!feats) return [];

        return feats.map(feat => {
            const featEntry = Object.entries(feat)[0];
            return {
                name: featEntry[0].split('|')[0],
                source: featEntry[0].split('|')[1] || 'PHB',
                required: featEntry[1]
            };
        });
    }

    /**
     * Process equipment based on source format
     * @private
     */
    processSourceSpecificEquipment(bg) {
        // New format with options
        if (bg.startingEquipment && Array.isArray(bg.startingEquipment)) {
            return this.processStartingEquipment(bg.startingEquipment);
        }

        // Legacy format
        if (bg.equipment) {
            return [{
                A: bg.equipment.map(item => ({
                    type: 'item',
                    name: item,
                    source: bg.source
                }))
            }];
        }

        return [];
    }

    /**
     * Process guild-specific features
     * @private
     */
    processGuildFeatures(bg) {
        if (!bg.guildFeatures) return null;

        return {
            guildSpells: bg.guildFeatures.spells || [],
            guildBackground: this.processDescription(bg.guildFeatures.background),
            guildMember: this.processDescription(bg.guildFeatures.member),
            suggestions: bg.guildFeatures.suggestions || []
        };
    }

    /**
     * Process source-specific fluff data
     * @private
     */
    processSourceSpecificFluff(bg, source, fluffData) {
        // Check for inline fluff first
        if (bg.fluff) {
            return {
                entries: this.processDescription(bg.fluff),
                images: bg.fluff.images || []
            };
        }

        // Check separate fluff data
        return this.processFluff(bg.name, source, fluffData?.backgroundFluff);
    }

    /**
     * Process starting equipment with options
     * @private
     */
    processStartingEquipment(equipment) {
        if (!equipment) return [];

        return equipment.map(equipSet => {
            const processed = {};
            for (const [option, items] of Object.entries(equipSet)) {
                processed[option] = items.map(item => {
                    if (item.item) {
                        const [name, source] = item.item.split('|');
                        return {
                            type: 'item',
                            name,
                            source: source || 'PHB'
                        };
                    }
                    if (item.value) {
                        return {
                            type: 'currency',
                            value: item.value
                        };
                    }
                    return item;
                });
            }
            return processed;
        });
    }

    /**
     * Process background features into a standardized format
     * @private
     */
    processFeatures(features) {
        if (!features) {
            console.debug('No features provided');
            return [];
        }

        // Handle single feature object
        if (!Array.isArray(features) && features.name) {
            console.debug('Processing single feature:', features.name);
            return [{
                name: features.name,
                description: this.processDescription(features.entries || []),
                requirements: features.requirements || null
            }];
        }

        // Handle array of features
        if (Array.isArray(features)) {
            console.debug('Processing feature array of length:', features.length);
            return features.map(feature => {
                if (!feature || !feature.name) {
                    console.warn('Invalid feature data:', feature);
                    return null;
                }
                return {
                    name: feature.name,
                    description: this.processDescription(feature.entries || []),
                    requirements: feature.requirements || null
                };
            }).filter(Boolean);
        }

        console.warn('Unexpected features format:', features);
        return [];
    }

    /**
     * Process background characteristics into a standardized format
     * @private
     */
    processCharacteristics(characteristics) {
        if (!characteristics) return null;

        return {
            personalityTraits: this.processPersonalityTable(characteristics.personalityTraits),
            ideals: this.processPersonalityTable(characteristics.ideals),
            bonds: this.processPersonalityTable(characteristics.bonds),
            flaws: this.processPersonalityTable(characteristics.flaws)
        };
    }

    /**
     * Process personality table entries
     * @private
     */
    processPersonalityTable(table) {
        if (!table) return null;
        if (!table.rows) return null;

        return table.rows.map(row => ({
            roll: row[0],
            description: row[1]
        }));
    }

    /**
     * Process background variants into a standardized format
     * @private
     */
    processVariants(variants, backgroundData) {
        if (!variants && !backgroundData) return [];

        let processedVariants = [];

        // Handle direct variants array if present
        if (Array.isArray(variants)) {
            processedVariants = variants.map(variant => ({
                name: variant.name,
                source: variant.source,
                description: this.processDescription(variant.entries),
                features: this.processFeatures(variant.features)
            }));
        }

        // Look for variant backgrounds that copy this background
        if (backgroundData && Array.isArray(backgroundData.background)) {
            const variantCopies = backgroundData.background.filter(bg =>
                bg._copy?.name === this.currentBackground?.name &&
                bg._copy?.source === this.currentBackground?.source &&
                bg.name.startsWith('Variant')
            );

            for (const variant of variantCopies) {
                const variantFeatures = [];

                // Safely process feature replacements
                if (variant._copy?._mod?.entries) {
                    const entries = Array.isArray(variant._copy._mod.entries) ?
                        variant._copy._mod.entries : [variant._copy._mod.entries];

                    for (const mod of entries) {
                        if (mod.mode === 'replaceArr' && mod.items?.name?.startsWith('Feature:')) {
                            variantFeatures.push({
                                name: mod.items.name.replace('Feature: ', ''),
                                description: this.processDescription(mod.items.entries),
                                requirements: null
                            });
                        }
                    }
                }

                // Get variant description from the first non-feature entry if available
                let description = '';
                if (variant._copy?._mod?.entries) {
                    const entries = Array.isArray(variant._copy._mod.entries) ?
                        variant._copy._mod.entries : [variant._copy._mod.entries];

                    const descEntry = entries.find(e =>
                        e.mode === 'insertArr' &&
                        e.items?.entries?.[0]
                    );
                    description = descEntry ? descEntry.items.entries[0] : '';
                }

                processedVariants.push({
                    name: variant.name,
                    source: variant.source,
                    description,
                    features: variantFeatures
                });
            }
        }

        return processedVariants;
    }

    /**
     * Process fluff data for a background
     * @private
     */
    processFluff(name, source, fluffData) {
        if (!fluffData) return null;

        const fluff = fluffData.find(f =>
            f.name === name &&
            f.source === source
        );

        if (!fluff) return null;

        return {
            entries: this.processDescription(fluff.entries),
            images: fluff.images || []
        };
    }

    /**
     * Get background by ID with improved caching
     * @param {string} backgroundId - Background ID
     * @param {Object} options - Loading options
     * @returns {Promise<ProcessedBackground|null>} Background data or null if not found
     */
    async getBackgroundById(backgroundId, options = {}) {
        const cacheKey = `background_${backgroundId.toLowerCase()}`;

        // Try to get from cache first
        const cached = this.dataCache.get(cacheKey);
        if (cached && !options.forceRefresh) {
            return cached;
        }

        try {
            const data = await this.loadBackgrounds(options);
            const background = data.backgrounds.find(bg =>
                bg.id.toLowerCase() === backgroundId.toLowerCase()
            );

            if (background) {
                // Cache the individual background
                this.dataCache.set(cacheKey, background);
                return background;
            }

            return null;
        } catch (error) {
            console.error(`Error getting background ${backgroundId}:`, error);
            throw error;
        }
    }

    /**
     * Get background features with improved caching
     * @param {string} backgroundId - Background ID
     * @param {Object} options - Loading options
     * @returns {Promise<Array<BackgroundFeature>>} Array of background features
     */
    async getBackgroundFeatures(backgroundId, options = {}) {
        const cacheKey = `features_${backgroundId.toLowerCase()}`;
        try {
            return await this.getOrLoadData(cacheKey, async () => {
                console.debug(`Getting features for background: ${backgroundId}`);
                const background = await this.getBackgroundById(backgroundId, options);

                if (!background) {
                    console.warn(`Background not found: ${backgroundId}`);
                    return [];
                }

                if (!background.features) {
                    console.debug(`No features found for background: ${backgroundId}`);
                    return [];
                }

                console.debug(`Found ${background.features.length} features for ${backgroundId}`);
                return background.features;
            }, options);
        } catch (error) {
            console.error(`Error getting features for background ${backgroundId}:`, error);
            return [];
        }
    }

    /**
     * Get background characteristics with improved caching
     * @param {string} backgroundId - Background ID
     * @param {Object} options - Loading options
     * @returns {Promise<BackgroundCharacteristics|null>} Background characteristics or null
     */
    async getBackgroundCharacteristics(backgroundId, options = {}) {
        const cacheKey = `characteristics_${backgroundId.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const background = await this.getBackgroundById(backgroundId, options);
            return background?.characteristics || null;
        }, options);
    }

    /**
     * Get background variants with improved caching
     * @param {string} backgroundId - Background ID
     * @param {Object} options - Loading options
     * @returns {Promise<Array<BackgroundVariant>>} Array of background variants
     */
    async getBackgroundVariants(backgroundId, options = {}) {
        const cacheKey = `variants_${backgroundId.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const background = await this.getBackgroundById(backgroundId, options);
            return background?.variants || [];
        }, options);
    }

    /**
     * Search backgrounds by name with improved caching
     * @param {string} searchTerm - Search term
     * @param {Object} options - Loading options
     * @returns {Promise<Array<ProcessedBackground>>} Array of matching backgrounds
     */
    async searchByName(searchTerm, options = {}) {
        const cacheKey = `search_${searchTerm.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadBackgrounds(options);
            const term = searchTerm.toLowerCase();

            return data.backgrounds.filter(bg =>
                bg.name.toLowerCase().includes(term)
            );
        }, options);
    }

    /**
     * Get backgrounds by proficiency with improved caching
     * @param {string} proficiency - Proficiency to search for
     * @param {Object} options - Loading options
     * @returns {Promise<Array<ProcessedBackground>>} Array of backgrounds with the specified proficiency
     */
    async getBackgroundsByProficiency(proficiency, options = {}) {
        const cacheKey = `backgrounds_prof_${proficiency.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadBackgrounds(options);
            const term = proficiency.toLowerCase();

            return data.backgrounds.filter(bg => {
                const profs = bg.proficiencies;
                if (!profs) return false;

                return (
                    this.hasProficiency(profs.skills, term) ||
                    this.hasProficiency(profs.tools, term) ||
                    this.hasProficiency(profs.languages, term)
                );
            });
        }, options);
    }

    /**
     * Check if proficiency exists in a proficiency list or choice object
     * @private
     * @param {Array<string>|Object} profList - Proficiency list or choice object
     * @param {string} searchTerm - Term to search for
     * @returns {boolean} Whether the proficiency exists
     */
    hasProficiency(profList, searchTerm) {
        if (!profList) return false;
        const normalizedTerm = searchTerm.toLowerCase();
        console.debug(`Checking proficiency ${searchTerm} in:`, profList);

        // Handle array of strings, objects, or arrays
        if (Array.isArray(profList)) {
            return profList.some(p => {
                if (typeof p === 'string') {
                    return p.toLowerCase().includes(normalizedTerm);
                }
                // Handle nested arrays (from processSkillProficiencies)
                if (Array.isArray(p)) {
                    return p.some(subP =>
                        typeof subP === 'string' &&
                        subP.toLowerCase().includes(normalizedTerm)
                    );
                }
                // Handle choice objects in array
                if (p.type === 'choice') {
                    return (p.from || []).some(f =>
                        typeof f === 'string' &&
                        f.toLowerCase().includes(normalizedTerm)
                    );
                }
                // Handle object with boolean values
                if (typeof p === 'object') {
                    const hasProf = Object.entries(p)
                        .filter(([_, value]) => value === true)
                        .some(([key]) => key.toLowerCase().includes(normalizedTerm));
                    console.debug('Checking object proficiency:', p, hasProf);
                    return hasProf;
                }
                return false;
            });
        }

        // Handle choice object
        if (profList.type === 'choice' || profList.choose) {
            const fromList = profList.from || profList.choose?.from || [];
            return fromList.some(p => {
                if (typeof p === 'string') {
                    return p.toLowerCase().includes(normalizedTerm);
                }
                // Handle object with boolean values
                if (typeof p === 'object') {
                    return Object.entries(p)
                        .filter(([_, value]) => value === true)
                        .some(([key]) => key.toLowerCase().includes(normalizedTerm));
                }
                return false;
            });
        }

        // Handle object with boolean values
        if (typeof profList === 'object') {
            const hasProf = Object.entries(profList)
                .filter(([_, value]) => value === true)
                .some(([key]) => key.toLowerCase().includes(normalizedTerm));
            console.debug('Checking object proficiency:', profList, hasProf);
            return hasProf;
        }

        return false;
    }

    /**
     * Get backgrounds by feature with improved caching
     * @param {string} featureName - Feature name to search for
     * @param {Object} options - Loading options
     * @returns {Promise<Array<ProcessedBackground>>} Array of backgrounds with the specified feature
     */
    async getBackgroundsByFeature(featureName, options = {}) {
        const cacheKey = `backgrounds_feature_${featureName.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadBackgrounds(options);
            const term = featureName.toLowerCase();

            return data.backgrounds.filter(bg =>
                bg.features?.some(f => f.name.toLowerCase().includes(term))
            );
        }, options);
    }
} 