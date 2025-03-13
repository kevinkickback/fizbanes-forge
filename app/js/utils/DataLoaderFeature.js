import { DataLoader } from './DataLoader.new.js';

/**
 * DataLoaderFeature.js
 * Handles loading and processing of character features, feats, and optional features
 */
export class DataLoaderFeature extends DataLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 200,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            feats: 'feats.json',
            optionalFeatures: 'optionalfeatures.json',
            featFluff: 'fluff-feats.json',
            optionalFluff: 'fluff-optionalfeatures.json'
        };
    }

    /**
     * Load all feature data with improved caching and error handling
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Processed feature data
     */
    async loadFeatures(options = {}) {
        return this.getOrLoadData('features', async () => {
            try {
                const [featData, optionalFeatureData, featFluffData, optionalFluffData] = await Promise.all([
                    this.loadJsonFile(this.dataFiles.feats, { ...options, maxRetries: 3 }),
                    this.loadJsonFile(this.dataFiles.optionalFeatures, { ...options, maxRetries: 3 }),
                    this.loadJsonFile(this.dataFiles.featFluff, { ...options, maxRetries: 2 })
                        .catch(() => ({ featFluff: [] })),
                    this.loadJsonFile(this.dataFiles.optionalFluff, { ...options, maxRetries: 2 })
                        .catch(() => ({ optionalfeatureFluff: [] }))
                ]);

                return this.processFeatureData(featData, optionalFeatureData, featFluffData, optionalFluffData);
            } catch (error) {
                console.error('Error loading features:', error);
                throw new Error(`Failed to load feature data: ${error.message}`);
            }
        }, options);
    }

    /**
     * Process raw feature data into standardized format with improved validation
     * @private
     */
    processFeatureData(featData, optionalFeatureData, featFluffData, optionalFluffData) {
        const allowedSources = this.getAllowedSources();
        const processedData = {
            feats: [],
            optionalFeatures: []
        };

        // Process feats
        if (featData.feat) {
            processedData.feats = featData.feat
                .filter(feat => allowedSources.has(feat.source))
                .map(feat => {
                    const processed = {
                        id: `${feat.name.toLowerCase()}_${feat.source.toLowerCase()}`,
                        name: feat.name,
                        source: feat.source,
                        page: feat.page || null,
                        category: feat.category || null,
                        prerequisite: this.processPrerequisites(feat.prerequisite),
                        repeatable: feat.repeatable || false,
                        description: this.processDescription(feat.entries)
                    };

                    // Source-specific processing for feats
                    this.processSourceSpecificFeatData(processed, feat, featFluffData?.featFluff);

                    return processed;
                });
        }

        // Process optional features
        if (optionalFeatureData.optionalfeature) {
            processedData.optionalFeatures = optionalFeatureData.optionalfeature
                .filter(feature => allowedSources.has(feature.source))
                .map(feature => {
                    const processed = {
                        id: `${feature.name.toLowerCase()}_${feature.source.toLowerCase()}`,
                        name: feature.name,
                        source: feature.source,
                        page: feature.page || null,
                        featureType: feature.featureType || [],
                        prerequisite: this.processPrerequisites(feature.prerequisite),
                        description: this.processDescription(feature.entries)
                    };

                    // Source-specific processing for optional features
                    this.processSourceSpecificFeatureData(processed, feature, optionalFluffData?.optionalfeatureFluff);

                    return processed;
                });
        }

        return processedData;
    }

    /**
     * Process source-specific feat data
     * @private
     */
    processSourceSpecificFeatData(processed, feat, fluffData) {
        // Handle XPHB and newer sources
        if (this.isNewEditionSource(feat.source)) {
            processed.edition = feat.freeRules2024 ? '2024' : 'one';
            processed.abilityScores = this.processAbilityScores(feat.ability);
            processed.additionalSpells = this.processAdditionalSpells(feat.additionalSpells);
        }

        // Handle PHB and similar sources
        else {
            processed.abilityScores = this.processLegacyAbilityScores(feat.ability);
            if (feat.additionalSpells) {
                processed.additionalSpells = this.processLegacySpells(feat.additionalSpells);
            }
        }

        // Process benefits based on source format
        processed.benefits = this.processSourceSpecificBenefits(feat);

        // Handle special feat types
        if (this.isClassFeatureVariant(feat)) {
            processed.variantRules = this.processVariantRules(feat);
        }

        // Process fluff data
        processed.fluff = this.processFluff(feat.name, feat.source, fluffData);
    }

    /**
     * Process source-specific optional feature data
     * @private
     */
    processSourceSpecificFeatureData(processed, feature, fluffData) {
        // Handle feature types
        processed.featureTypes = this.processFeatureTypes(feature.featureType);

        // Process consumption rules (e.g., superiority dice)
        if (feature.consumes) {
            processed.consumes = this.processConsumption(feature.consumes);
        }

        // Handle additional spells
        if (feature.additionalSpells) {
            processed.additionalSpells = this.processAdditionalSpells(feature.additionalSpells);
        }

        // Process resource usage
        if (feature.resource) {
            processed.resource = this.processResource(feature.resource);
        }

        // Process fluff data
        processed.fluff = this.processFluff(feature.name, feature.source, fluffData);
    }

    /**
     * Check if source is from newer edition format
     * @private
     */
    isNewEditionSource(source) {
        const newEditionSources = new Set(['XPHB', 'TCE', 'FTD', 'BGG', 'SCC']);
        return newEditionSources.has(source);
    }

    /**
     * Check if feature is a class feature variant
     * @private
     */
    isClassFeatureVariant(feature) {
        return feature.isClassFeatureVariant === true;
    }

    /**
     * Process prerequisites into a standardized format
     * @private
     */
    processPrerequisites(prerequisites) {
        if (!prerequisites) return null;

        return prerequisites.map(prereq => {
            const processed = {};

            // Level prerequisites
            if (prereq.level) {
                processed.level = typeof prereq.level === 'number'
                    ? { level: prereq.level }
                    : {
                        level: prereq.level.level,
                        class: prereq.level.class?.name,
                        classSource: prereq.level.class?.source
                    };
            }

            // Ability score prerequisites
            if (prereq.ability) {
                processed.ability = Object.entries(prereq.ability)
                    .map(([ability, score]) => ({
                        ability,
                        score
                    }));
            }

            // Spell prerequisites
            if (prereq.spell) {
                processed.spells = Array.isArray(prereq.spell)
                    ? prereq.spell
                    : [prereq.spell];
            }

            // Feat prerequisites
            if (prereq.feat) {
                processed.feats = Array.isArray(prereq.feat)
                    ? prereq.feat
                    : [prereq.feat];
            }

            // Other prerequisites
            if (prereq.other) {
                processed.other = prereq.other;
            }

            return processed;
        });
    }

    /**
     * Process ability scores based on source format
     * @private
     */
    processAbilityScores(ability) {
        if (!ability) return null;

        return ability.map(choice => {
            if (choice.choose) {
                return {
                    type: 'choice',
                    amount: choice.choose.amount || 1,
                    from: choice.choose.from
                };
            }
            return Object.entries(choice).map(([ability, bonus]) => ({
                ability,
                bonus
            }));
        });
    }

    /**
     * Process legacy ability scores format
     * @private
     */
    processLegacyAbilityScores(ability) {
        if (!ability) return null;
        if (typeof ability === 'string') return [{ ability, bonus: 1 }];

        return Object.entries(ability)
            .map(([ability, bonus]) => ({
                ability,
                bonus
            }));
    }

    /**
     * Process additional spells
     * @private
     */
    processAdditionalSpells(spells) {
        if (!spells) return null;

        return spells.map(spellGroup => ({
            ability: spellGroup.ability,
            innate: this.processInnateSpells(spellGroup.innate),
            known: this.processKnownSpells(spellGroup.known),
            prepared: spellGroup.prepared || false,
            requirements: spellGroup.requirements || null
        }));
    }

    /**
     * Process innate spells
     * @private
     */
    processInnateSpells(innate) {
        if (!innate) return null;

        const processed = {};
        for (const [frequency, spells] of Object.entries(innate)) {
            processed[frequency] = Array.isArray(spells)
                ? spells
                : Object.entries(spells).map(([level, spellList]) => ({
                    level: Number.parseInt(level),
                    spells: spellList
                }));
        }
        return processed;
    }

    /**
     * Process known spells
     * @private
     */
    processKnownSpells(known) {
        if (!known) return null;

        return Object.entries(known).map(([level, spells]) => ({
            level: Number.parseInt(level),
            spells: Array.isArray(spells) ? spells : [spells]
        }));
    }

    /**
     * Process source-specific benefits
     * @private
     */
    processSourceSpecificBenefits(feat) {
        const benefits = {
            abilityScores: [],
            proficiencies: [],
            features: [],
            spells: [],
            other: []
        };

        // Process ability score improvements
        if (feat.ability) {
            benefits.abilityScores = this.processAbilityScores(feat.ability);
        }

        // Process proficiencies
        if (feat.proficiencies) {
            benefits.proficiencies = this.processProficiencies(feat.proficiencies);
        }

        // Process features
        if (feat.features) {
            benefits.features = feat.features.map(feature => ({
                name: feature.name,
                description: this.processDescription(feature.entries),
                requirements: feature.requirements || null
            }));
        }

        // Process spells
        if (feat.additionalSpells) {
            benefits.spells = this.processAdditionalSpells(feat.additionalSpells);
        }

        return benefits;
    }

    /**
     * Process proficiencies
     * @private
     */
    processProficiencies(proficiencies) {
        if (!proficiencies) return null;

        return {
            weapons: proficiencies.weapons || [],
            armor: proficiencies.armor || [],
            tools: proficiencies.tools || [],
            skills: {
                choices: proficiencies.skills?.choices || [],
                count: proficiencies.skills?.count || 0
            }
        };
    }

    /**
     * Process feature types
     * @private
     */
    processFeatureTypes(types) {
        if (!types) return [];

        const typeMap = {
            'EI': 'Eldritch Invocation',
            'MV:B': 'Maneuver: Battle Master',
            'FS:F': 'Fighting Style: Fighter',
            'FS:R': 'Fighting Style: Ranger',
            'AI': 'Artificer Infusion'
        };

        return types.map(type => ({
            code: type,
            name: typeMap[type] || type
        }));
    }

    /**
     * Process consumption rules
     * @private
     */
    processConsumption(consumes) {
        if (!consumes) return null;

        return {
            type: consumes.type || 'other',
            amount: consumes.amount || 1,
            name: consumes.name,
            resource: consumes.resource || null
        };
    }

    /**
     * Process resource usage
     * @private
     */
    processResource(resource) {
        if (!resource) return null;

        return {
            name: resource.name,
            amount: resource.amount || 1,
            recovery: resource.recovery || 'long rest'
        };
    }

    /**
     * Process variant rules
     * @private
     */
    processVariantRules(feat) {
        if (!feat.isClassFeatureVariant) return null;

        return {
            className: feat.className || null,
            classSource: feat.classSource || null,
            level: feat.level || null,
            replaces: feat.replaces || null
        };
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
                if (entry.type === 'table') {
                    return this.processTable(entry);
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
     * Process table entries
     * @private
     */
    processTable(table) {
        if (!table.rows) return '';

        const header = table.colLabels
            ? `| ${table.colLabels.join(' | ')} |\n|${table.colLabels.map(() => '---').join('|')}|\n`
            : '';

        const rows = table.rows
            .map(row => `| ${row.join(' | ')} |`)
            .join('\n');

        return `${table.caption ? `${table.caption}\n` : ''}${header}${rows}`;
    }

    /**
     * Process fluff data
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
     * Load features in chunks for better performance
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Object[]>} Generator yielding chunks of feature data
     */
    async *loadFeaturesInChunks(chunkSize = 20, options = {}) {
        const data = await this.loadFeatures(options);

        for (const category of ['feats', 'optionalFeatures']) {
            if (data[category] && Array.isArray(data[category])) {
                for (let i = 0; i < data[category].length; i += chunkSize) {
                    yield {
                        category,
                        items: data[category].slice(i, i + chunkSize)
                    };
                }
            }
        }
    }

    /**
     * Get feature by ID with improved caching
     * @param {string} featureId - Feature ID
     * @param {Object} options - Loading options
     * @returns {Promise<Object|null>} Feature data or null if not found
     */
    async getFeatureById(featureId, options = {}) {
        const cacheKey = `feature_${featureId.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            return data.feats.find(f => f.id.toLowerCase() === featureId.toLowerCase()) || null;
        }, options);
    }

    /**
     * Get feat by ID with improved caching
     * @param {string} featId - Feat ID
     * @param {Object} options - Loading options
     * @returns {Promise<Object|null>} Feat data or null if not found
     */
    async getFeatById(featId, options = {}) {
        const cacheKey = `feat_${featId.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            return data.feats.find(f => f.id.toLowerCase() === featId.toLowerCase()) || null;
        }, options);
    }

    /**
     * Get optional feature by ID with improved caching
     * @param {string} optionalId - Optional feature ID
     * @param {Object} options - Loading options
     * @returns {Promise<Object|null>} Optional feature data or null if not found
     */
    async getOptionalFeatureById(optionalId, options = {}) {
        const cacheKey = `optional_${optionalId.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            return data.optionalFeatures.find(f => f.id.toLowerCase() === optionalId.toLowerCase()) || null;
        }, options);
    }

    /**
     * Get features by type with improved caching
     * @param {string} type - Feature type
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of features of the specified type
     */
    async getFeaturesByType(type, options = {}) {
        const cacheKey = `features_type_${type.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            return data.feats.filter(f => f.category?.toLowerCase() === type.toLowerCase());
        }, options);
    }

    /**
     * Get features by level and source with improved caching
     * @param {number} level - Feature level
     * @param {string} source - Source book
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of features matching level and source
     */
    async getFeaturesByLevelAndSource(level, source, options = {}) {
        const cacheKey = `features_level_${level}_source_${source.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            return data.feats.filter(f =>
                f.level === level &&
                f.source.toLowerCase() === source.toLowerCase()
            );
        }, options);
    }

    /**
     * Get features by class with improved caching
     * @param {string} className - Class name
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of features for the specified class
     */
    async getFeaturesByClass(className, options = {}) {
        const cacheKey = `features_class_${className.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            return data.feats.filter(f =>
                f.className?.toLowerCase() === className.toLowerCase()
            );
        }, options);
    }

    /**
     * Search features by name with improved caching
     * @param {string} searchTerm - Search term
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Object containing matching features, feats, and optional features
     */
    async searchByName(searchTerm, options = {}) {
        const cacheKey = `search_${searchTerm.toLowerCase()}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);
            const term = searchTerm.toLowerCase();

            return {
                feats: data.feats.filter(f => f.name.toLowerCase().includes(term)),
                optionalFeatures: data.optionalFeatures.filter(f => f.name.toLowerCase().includes(term))
            };
        }, options);
    }

    /**
     * Get features with specific prerequisites
     * @param {Object} prerequisites - Prerequisite criteria
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Object containing matching features and feats
     */
    async getByPrerequisites(prerequisites, options = {}) {
        const cacheKey = `prereq_${JSON.stringify(prerequisites)}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadFeatures(options);

            const matchesPrerequisites = (item) => {
                if (!item.prerequisites) return false;
                return Object.entries(prerequisites).every(([key, value]) =>
                    item.prerequisites[key] === value
                );
            };

            return {
                feats: data.feats.filter(matchesPrerequisites),
                optionalFeatures: data.optionalFeatures.filter(matchesPrerequisites)
            };
        }, options);
    }
} 