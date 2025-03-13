import { DataLoader } from './DataLoader.new.js';

/**
 * DataLoaderClass.js
 * Handles loading and processing of class-related data
 */
export class DataLoaderClass extends DataLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 100,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.baseDir = 'class';
        this.fluffBaseDir = 'class';
    }

    /**
     * Load class index data
     * @private
     */
    async loadClassIndex(options = {}) {
        return this.loadJsonFile(`${this.baseDir}/index.json`, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load fluff index data
     * @private
     */
    async loadFluffIndex(options = {}) {
        return this.loadJsonFile(`${this.fluffBaseDir}/fluff-index.json`, {
            ...options,
            maxRetries: 2
        }).catch(() => ({}));
    }

    /**
     * Load individual class data
     * @private
     */
    async loadClassData(classKey, options = {}) {
        const index = await this.loadClassIndex(options);
        if (!index[classKey]) return null;

        return this.loadJsonFile(`${this.baseDir}/${index[classKey]}`, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load individual class fluff data
     * @private
     */
    async loadClassFluff(classKey, options = {}) {
        const fluffIndex = await this.loadFluffIndex(options);
        if (!fluffIndex[classKey]) return null;

        return this.loadJsonFile(`${this.fluffBaseDir}/${fluffIndex[classKey]}`, {
            ...options,
            maxRetries: 2
        }).catch(() => null);
    }

    /**
     * Load all class data with improved caching and chunking
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Processed class data
     */
    async loadClasses(options = {}) {
        return this.getOrLoadData('classes', async () => {
            try {
                const index = await this.loadClassIndex(options);
                const classKeys = Object.keys(index);

                // Load all class data in parallel
                const classDataPromises = classKeys.map(key =>
                    this.loadClassData(key, options)
                );
                const fluffDataPromises = classKeys.map(key =>
                    this.loadClassFluff(key, options)
                );

                const [classDataResults, fluffDataResults] = await Promise.all([
                    Promise.all(classDataPromises),
                    Promise.all(fluffDataPromises)
                ]);

                // Process and combine the data
                const processedData = {
                    classes: [],
                    subclasses: []
                };

                classDataResults.forEach((classData, index) => {
                    if (!classData) return;

                    const fluffData = fluffDataResults[index];
                    const classKey = classKeys[index];

                    this.processClassData(classData, fluffData, processedData);
                });

                // Sort classes and subclasses
                processedData.classes.sort((a, b) => a.name.localeCompare(b.name));
                processedData.subclasses.sort((a, b) => {
                    if (a.className === b.className) {
                        return a.name.localeCompare(b.name);
                    }
                    return a.className.localeCompare(b.className);
                });

                return processedData;
            } catch (error) {
                console.error('Error loading classes:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load classes in chunks for better performance with large datasets
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Object[]>} Generator yielding chunks of class data
     */
    async *loadClassesInChunks(chunkSize = 5, options = {}) {
        const data = await this.loadClasses(options);

        // Yield classes in chunks
        if (data.classes && Array.isArray(data.classes)) {
            for (let i = 0; i < data.classes.length; i += chunkSize) {
                yield data.classes.slice(i, i + chunkSize);
            }
        }

        // Yield subclasses in chunks
        if (data.subclasses && Array.isArray(data.subclasses)) {
            for (let i = 0; i < data.subclasses.length; i += chunkSize) {
                yield data.subclasses.slice(i, i + chunkSize);
            }
        }
    }

    /**
     * Process class data from individual files
     * @private
     */
    processClassData(classData, fluffData, processedData) {
        // Filter by allowed sources
        const allowedSources = this.getAllowedSources();

        // Process classes
        if (classData.class) {
            const processedClasses = classData.class
                .filter(cls => allowedSources.has(cls.source || 'PHB'))
                .map(cls => {
                    const processed = {
                        id: cls.name.toLowerCase(),
                        name: cls.name,
                        source: cls.source || 'PHB',
                        page: cls.page,
                        srd: cls.srd || false,
                        basicRules: cls.basicRules || false,
                        hd: cls.hd || { number: 1, faces: 8 },
                        proficiency: cls.proficiency || []
                    };

                    // Source-specific processing for classes
                    this.processSourceSpecificClassData(processed, cls, fluffData);

                    return processed;
                });

            processedData.classes.push(...processedClasses);
        }

        // Process subclasses
        if (classData.subclass) {
            const processedSubclasses = classData.subclass
                .filter(sub => allowedSources.has(sub.source || 'PHB'))
                .map(sub => {
                    const processed = {
                        id: sub.name.toLowerCase(),
                        name: sub.name,
                        shortName: sub.shortName || sub.name,
                        source: sub.source || 'PHB',
                        className: sub.className || classData.class[0]?.name,
                        classSource: sub.classSource || classData.class[0]?.source || 'PHB',
                        page: sub.page
                    };

                    // Source-specific processing for subclasses
                    this.processSourceSpecificSubclassData(processed, sub, fluffData);

                    return processed;
                });

            processedData.subclasses.push(...processedSubclasses);
        }
    }

    /**
     * Process source-specific class data
     * @private
     */
    processSourceSpecificClassData(processed, cls, fluffData) {
        // Handle XPHB and newer sources
        if (this.isNewEditionSource(cls.source)) {
            processed.edition = cls.freeRules2024 ? '2024' : 'one';
            processed.spellcasting = this.processNewEditionSpellcasting(cls.spellcasting);
            processed.optionalfeatures = this.processNewEditionOptionalFeatures(cls.optionalfeatureProgression);
            processed.variantFeatures = this.processVariantFeatures(cls.variantFeatures);
        }
        // Handle PHB and similar sources
        else {
            processed.spellcasting = this.processLegacySpellcasting(cls.spellcasting);
            processed.optionalfeatures = this.processLegacyOptionalFeatures(cls.optionalfeatureProgression);
        }

        // Common processing for both formats
        processed.startingProficiencies = this.processStartingProficiencies(cls.startingProficiencies);
        processed.startingEquipment = this.processStartingEquipment(cls.startingEquipment);
        processed.multiclassing = this.processMulticlassingData(cls.multiclassing);
        processed.classFeatures = this.processClassFeatures(cls.classFeatures);
        processed.subclassTitle = cls.subclassTitle || 'Subclass';
        processed.fluff = this.processFluff(cls.name, cls.source, fluffData);
    }

    /**
     * Process source-specific subclass data
     * @private
     */
    processSourceSpecificSubclassData(processed, sub, fluffData) {
        // Handle XPHB and newer sources
        if (this.isNewEditionSource(sub.source)) {
            processed.spellcasting = this.processNewEditionSpellcasting(sub.spellcasting);
            processed.additionalSpells = this.processNewEditionAdditionalSpells(sub.additionalSpells);
            processed.variantFeatures = this.processVariantFeatures(sub.variantFeatures);
        }
        // Handle PHB and similar sources
        else {
            processed.spellcasting = this.processLegacySpellcasting(sub.spellcasting);
            processed.additionalSpells = this.processLegacyAdditionalSpells(sub.additionalSpells);
        }

        // Common processing for both formats
        processed.subclassFeatures = this.processSubclassFeatures(sub.subclassFeatures);
        processed.fluff = this.processFluff(sub.name, sub.source, fluffData);
        processed.requirements = this.processRequirements(sub.requirements);
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
     * Process new edition spellcasting
     * @private
     */
    processNewEditionSpellcasting(spellcasting) {
        if (!spellcasting) return null;

        return {
            ability: this.validateSpellcastingAbility(spellcasting.ability),
            type: spellcasting.type || 'known',
            progression: spellcasting.progression || 'full',
            cantripProgression: spellcasting.cantripProgression || [],
            spellsKnownProgression: spellcasting.spellsKnownProgression || [],
            spellSlotProgression: spellcasting.spellSlotProgression || [],
            preparedSpells: spellcasting.preparedSpells || null,
            focusType: spellcasting.focusType || null,
            options: spellcasting.options || []
        };
    }

    /**
     * Process legacy spellcasting
     * @private
     */
    processLegacySpellcasting(spellcasting) {
        if (!spellcasting) return null;

        return {
            ability: this.validateSpellcastingAbility(spellcasting.ability),
            type: spellcasting.type || 'known',
            progression: spellcasting.progression || 'full',
            cantripProgression: spellcasting.cantripProgression || [],
            spellsKnownProgression: spellcasting.spellsKnownProgression || [],
            spellSlotProgression: spellcasting.spellSlotProgression || [],
            preparedSpells: spellcasting.preparedSpells || null
        };
    }

    /**
     * Validate spellcasting ability
     * @private
     */
    validateSpellcastingAbility(ability) {
        return ability || null;
    }

    /**
     * Process starting proficiencies with validation
     * @private
     */
    processStartingProficiencies(startingProfs) {
        if (!startingProfs) return null;

        return {
            armor: startingProfs.armor || [],
            weapons: startingProfs.weapons || [],
            tools: startingProfs.tools || [],
            skills: {
                choices: startingProfs.skills || [],
                count: startingProfs.skillChoices || 2
            },
            languages: startingProfs.languages || []
        };
    }

    /**
     * Process multiclassing requirements
     * @private
     */
    processMulticlassingRequirements(requirements) {
        if (!requirements) return null;

        const processed = {};
        for (const [ability, score] of Object.entries(requirements)) {
            processed[ability] = score;
        }
        return processed;
    }

    /**
     * Process new edition optional features
     * @private
     */
    processNewEditionOptionalFeatures(features) {
        if (!features) return [];

        return features.map(feature => ({
            name: feature.name,
            featureType: feature.featureType || [],
            progression: feature.progression || {},
            options: feature.options || [],
            requirements: this.processRequirements(feature.requirements)
        }));
    }

    /**
     * Process legacy optional features
     * @private
     */
    processLegacyOptionalFeatures(features) {
        if (!features) return [];

        return features.map(feature => ({
            name: feature.name,
            featureType: feature.featureType || [],
            progression: feature.progression || {}
        }));
    }

    /**
     * Process variant features
     * @private
     */
    processVariantFeatures(variants) {
        if (!variants) return null;

        return variants.map(variant => ({
            name: variant.name,
            source: variant.source,
            type: variant.type,
            replaces: variant.replaces,
            entries: this.processDescription(variant.entries)
        }));
    }

    /**
     * Process requirements with validation
     * @private
     */
    processRequirements(requirements) {
        if (!requirements) return null;

        const processed = {};

        if (requirements.ability) {
            processed.ability = Object.entries(requirements.ability)
                .reduce((acc, [ability, score]) => {
                    acc[ability] = score;
                    return acc;
                }, {});
        }

        if (requirements.level) {
            processed.level = requirements.level;
        }

        return processed;
    }

    /**
     * Process class features
     * @private
     */
    processClassFeatures(features) {
        if (!features) return [];

        return features.map(feature => ({
            name: feature.name,
            source: feature.source || 'PHB',
            page: feature.page,
            level: feature.level,
            entries: feature.entries || [],
            gainSubclassFeature: feature.gainSubclassFeature || false
        }));
    }

    /**
     * Process subclass features
     * @private
     */
    processSubclassFeatures(features) {
        if (!features) return [];

        return features.map(feature => ({
            name: feature.name,
            source: feature.source || 'PHB',
            page: feature.page,
            level: feature.level,
            entries: feature.entries || [],
            isSubclassFeature: true
        }));
    }

    /**
     * Process proficiencies data
     * @private
     */
    processProficiencies(proficiencies) {
        if (!proficiencies) return null;

        return {
            armor: proficiencies.armor || [],
            weapons: proficiencies.weapons || [],
            tools: proficiencies.tools || [],
            skills: {
                number: proficiencies.skills?.number || 0,
                choices: proficiencies.skills?.choices || []
            },
            savingThrows: proficiencies.savingThrows || []
        };
    }

    /**
     * Process starting equipment
     * @private
     */
    processStartingEquipment(equipment) {
        if (!equipment) return null;

        return {
            default: equipment.default || [],
            goldAlternative: equipment.goldAlternative || null,
            choices: equipment.choices || []
        };
    }

    /**
     * Process spellcasting data
     * @private
     */
    processSpellcasting(spellcasting) {
        if (!spellcasting) return null;

        return {
            ability: spellcasting.ability || null,
            type: spellcasting.type || 'known',
            progression: spellcasting.progression || 'full',
            cantripProgression: spellcasting.cantripProgression || [],
            spellsKnownProgression: spellcasting.spellsKnownProgression || [],
            spellSlotProgression: spellcasting.spellSlotProgression || [],
            preparedSpells: spellcasting.preparedSpells || null
        };
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
            entries: fluff.entries || [],
            images: fluff.images || []
        };
    }

    /**
     * Process class progression data
     * @private
     */
    processProgression(progression) {
        return progression.map(level => ({
            level: level.level,
            proficiencyBonus: level.proficiencyBonus || Math.floor((level.level - 1) / 4) + 2,
            features: level.features || [],
            classSpecific: level.classSpecific || null
        }));
    }

    /**
     * Process additional spells
     * @private
     */
    processAdditionalSpells(spells) {
        if (!spells) return null;

        return spells.map(spellGroup => ({
            name: spellGroup.name,
            source: spellGroup.source || 'PHB',
            spells: spellGroup.spells || {},
            ability: spellGroup.ability || null,
            prepared: spellGroup.prepared || false,
            requirements: spellGroup.requirements || null
        }));
    }

    /**
     * Get class by ID with improved caching
     * @param {string} classId - Class identifier
     * @param {Object} options - Loading options
     * @returns {Promise<Object|null>} Class data or null if not found
     */
    async getClassById(classId, options = {}) {
        const cacheKey = `class_${classId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadClasses();
            return data.classes.find(cls => cls.id === classId.toLowerCase()) || null;
        }, options);
    }

    /**
     * Get subclasses for a class with improved caching
     * @param {string} classId - Class identifier
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of subclasses
     */
    async getSubclasses(classId, options = {}) {
        const cacheKey = `subclasses_${classId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadClasses();
            const cls = await this.getClassById(classId);
            if (!cls) return [];

            return data.subclasses.filter(sub =>
                sub.className === cls.name &&
                sub.classSource === cls.source
            );
        }, options);
    }

    /**
     * Get features by level with improved caching
     * @param {string} classId - Class identifier
     * @param {number} level - Character level
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of features for the specified level
     */
    async getFeaturesByLevel(classId, level, options = {}) {
        const cacheKey = `features_${classId}_${level}`;
        return this.getOrLoadData(cacheKey, async () => {
            const cls = await this.getClassById(classId);
            if (!cls) return [];

            return cls.classFeatures.filter(f => f.level === level);
        }, options);
    }

    /**
     * Get classes by spellcasting ability with improved caching
     * @param {string} ability - Spellcasting ability (e.g., 'int', 'wis', 'cha')
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of classes with the specified spellcasting ability
     */
    async getClassesBySpellcastingAbility(ability, options = {}) {
        const cacheKey = `classes_spellcasting_${ability}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadClasses();
            return data.classes.filter(cls =>
                cls.spellcasting?.ability?.toLowerCase() === ability.toLowerCase()
            );
        }, options);
    }

    /**
     * Get classes by hit die with improved caching
     * @param {number} faces - Number of faces on the hit die (e.g., 6, 8, 10, 12)
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of classes with the specified hit die
     */
    async getClassesByHitDie(faces, options = {}) {
        const cacheKey = `classes_hd_${faces}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadClasses();
            return data.classes.filter(cls => cls.hd.faces === faces);
        }, options);
    }

    /**
     * Get classes by saving throw proficiency with improved caching
     * @param {string} ability - Ability score (e.g., 'str', 'dex', 'con')
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of classes with the specified saving throw proficiency
     */
    async getClassesBySavingThrow(ability, options = {}) {
        const cacheKey = `classes_save_${ability}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadClasses();
            return data.classes.filter(cls =>
                cls.proficiencies?.savingThrows?.some(save =>
                    save.toLowerCase() === ability.toLowerCase()
                )
            );
        }, options);
    }
} 