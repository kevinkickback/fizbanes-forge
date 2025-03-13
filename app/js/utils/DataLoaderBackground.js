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
     * @returns {Promise<Object>} Processed background data
     */
    async loadBackgrounds(options = {}) {
        return this.getOrLoadData('backgrounds', async () => {
            try {
                const [backgroundData, fluffData] = await Promise.all([
                    this.loadJsonFile(this.dataFiles.backgrounds, { ...options, maxRetries: 3 }),
                    this.loadJsonFile(this.dataFiles.fluff, { ...options, maxRetries: 2 })
                        .catch(() => ({ backgroundFluff: [] }))
                ]);

                return this.processBackgroundData(backgroundData, fluffData);
            } catch (error) {
                console.error('Error loading backgrounds:', error);
                throw new Error(`Failed to load background data: ${error.message}`);
            }
        }, options);
    }

    /**
     * Load backgrounds in chunks for better performance
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Object[]>} Generator yielding chunks of background data
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
     */
    processBackgroundData(backgroundData, fluffData) {
        const allowedSources = this.getAllowedSources();
        const processedData = {
            backgrounds: []
        };

        if (backgroundData.background) {
            processedData.backgrounds = backgroundData.background
                .filter(bg => allowedSources.has(bg.source))
                .map(bg => {
                    // Base properties all backgrounds have
                    const processed = {
                        id: `${bg.name.toLowerCase()}_${bg.source.toLowerCase()}`,
                        name: bg.name,
                        source: bg.source,
                        page: bg.page || null,
                        description: this.processDescription(bg.entries)
                    };

                    // Source-specific processing
                    this.processSourceSpecificData(processed, bg);

                    return processed;
                });
        }

        return processedData;
    }

    /**
     * Process source-specific background data
     * @private
     */
    processSourceSpecificData(processed, bg) {
        // Edition-specific fields (mainly XPHB and newer)
        if (this.isNewEditionSource(bg.source)) {
            processed.edition = bg.edition || 'one';
            processed.abilityScores = this.processAbilityScores(bg.ability);
            processed.feats = this.processFeats(bg.feats);
        }

        // Proficiencies - handle both old and new format
        processed.proficiencies = this.processSourceSpecificProficiencies(bg);

        // Equipment - handle both simple and complex formats
        processed.startingEquipment = this.processSourceSpecificEquipment(bg);

        // Features and characteristics
        if (bg.features || bg.characteristics) {
            processed.features = this.processFeatures(bg.features);
            processed.characteristics = this.processCharacteristics(bg.characteristics);
        }

        // Personality tables - mainly PHB and similar sources
        if (this.hasPersonalityTables(bg)) {
            processed.personalityTraits = this.processPersonalityTable(bg.personalityTraits);
            processed.ideals = this.processPersonalityTable(bg.ideals);
            processed.bonds = this.processPersonalityTable(bg.bonds);
            processed.flaws = this.processPersonalityTable(bg.flaws);
        }

        // Variants - not all sources have these
        if (bg.variants) {
            processed.variants = this.processVariants(bg.variants);
        }

        // Guild-specific features (Ravnica backgrounds)
        if (this.isGuildBackground(bg.source)) {
            processed.guildFeatures = this.processGuildFeatures(bg);
        }

        // Fluff data - handle both inline and separate fluff
        processed.fluff = this.processSourceSpecificFluff(bg, bg.source, fluffData);

        return processed;
    }

    /**
     * Check if source is from newer edition format
     * @private
     */
    isNewEditionSource(source) {
        const newEditionSources = new Set(['XPHB', 'SCC', 'BGG', 'SatO', 'DSotDQ', 'WBtW']);
        return newEditionSources.has(source);
    }

    /**
     * Check if background has personality tables
     * @private
     */
    hasPersonalityTables(bg) {
        return bg.personalityTraits || bg.ideals || bg.bonds || bg.flaws;
    }

    /**
     * Check if background is from a guild source
     * @private
     */
    isGuildBackground(source) {
        return source === 'GGR';
    }

    /**
     * Process proficiencies based on source format
     * @private
     */
    processSourceSpecificProficiencies(bg) {
        // New format (XPHB and newer)
        if (this.isNewEditionSource(bg.source)) {
            return {
                skills: this.processSkillProficiencies(bg.skillProficiencies),
                tools: this.processToolProficiencies(bg.toolProficiencies),
                languages: this.processLanguages(bg.languages),
                expertise: bg.expertise || []
            };
        }

        // Old format (PHB and similar)
        return {
            skills: this.processLegacySkillProficiencies(bg.proficiencies?.skills),
            tools: this.processLegacyToolProficiencies(bg.proficiencies?.tools),
            languages: this.processLegacyLanguages(bg.proficiencies?.languages),
            expertise: []
        };
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
     * Process legacy skill proficiencies format
     * @private
     */
    processLegacySkillProficiencies(skills) {
        if (!skills) return [];
        if (typeof skills === 'string') return [skills];
        if (Array.isArray(skills)) return skills;

        // Handle old choose format
        if (skills.choose) {
            return {
                type: 'choice',
                count: skills.choose,
                from: skills.from || []
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
                    return entry.items.map(item => `• ${item}`).join('\n');
                }
                if (entry.entries) {
                    return this.processDescription(entry.entries);
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
     * Process skill proficiencies with weighted choices
     * @private
     */
    processSkillProficiencies(skills) {
        if (!skills) return [];

        return skills.map(profSet => {
            if (profSet.choose) {
                return {
                    type: 'choice',
                    count: profSet.choose.count || 1,
                    from: profSet.choose.from || [],
                    weighted: profSet.choose.weighted || null
                };
            }
            return Object.entries(profSet)
                .filter(([skill, hasProf]) => hasProf === true)
                .map(([skill]) => skill);
        });
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
        if (!features) return [];

        return Array.isArray(features) ? features.map(feature => ({
            name: feature.name,
            description: this.processDescription(feature.entries),
            requirements: feature.requirements || null
        })) : [];
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
    processVariants(variants) {
        if (!variants) return [];

        return Array.isArray(variants) ? variants.map(variant => ({
            name: variant.name,
            source: variant.source,
            description: this.processDescription(variant.entries),
            features: this.processFeatures(variant.features)
        })) : [];
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
     * @returns {Promise<Object|null>} Background data or null if not found
     */
    async getBackgroundById(backgroundId, options = {}) {
        const cacheKey = `background_${backgroundId.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadBackgrounds(options);
            return data.backgrounds.find(bg => bg.id.toLowerCase() === backgroundId.toLowerCase()) || null;
        }, options);
    }

    /**
     * Get background features with improved caching
     * @param {string} backgroundId - Background ID
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of background features
     */
    async getBackgroundFeatures(backgroundId, options = {}) {
        const cacheKey = `features_${backgroundId.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const background = await this.getBackgroundById(backgroundId, options);
            return background?.features || [];
        }, options);
    }

    /**
     * Get background characteristics with improved caching
     * @param {string} backgroundId - Background ID
     * @param {Object} options - Loading options
     * @returns {Promise<Object|null>} Background characteristics or null if not found
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
     * @returns {Promise<Array>} Array of background variants
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
     * @returns {Promise<Array>} Array of matching backgrounds
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
     * @returns {Promise<Array>} Array of backgrounds with the specified proficiency
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
                    profs.skills?.includes(term) ||
                    profs.tools?.includes(term) ||
                    profs.languages?.includes(term)
                );
            });
        }, options);
    }

    /**
     * Get backgrounds by feature with improved caching
     * @param {string} featureName - Feature name to search for
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of backgrounds with the specified feature
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