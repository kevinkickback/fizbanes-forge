import { DataLoader } from './DataLoader.new.js';

/**
 * DataLoaderSpell.js
 * Handles loading and processing of spell data
 */
export class DataLoaderSpell extends DataLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 200,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.baseDir = 'spells';
        this.fluffBaseDir = 'spells';
    }

    /**
     * Load spell index data
     * @private
     */
    async loadSpellIndex(options = {}) {
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
     * Load individual spell data
     * @private
     */
    async loadSpellData(sourceKey, options = {}) {
        const index = await this.loadSpellIndex(options);
        if (!index[sourceKey]) return null;

        return this.loadJsonFile(`${this.baseDir}/${index[sourceKey]}`, {
            ...options,
            maxRetries: 3
        });
    }

    /**
     * Load individual spell fluff data
     * @private
     */
    async loadSpellFluff(sourceKey, options = {}) {
        const fluffIndex = await this.loadFluffIndex(options);
        if (!fluffIndex[sourceKey]) return null;

        return this.loadJsonFile(`${this.fluffBaseDir}/${fluffIndex[sourceKey]}`, {
            ...options,
            maxRetries: 2
        }).catch(() => null);
    }

    /**
     * Load all spell data with improved caching and chunking
     * @param {Object} options - Loading options
     * @returns {Promise<Object>} Processed spell data
     */
    async loadSpells(options = {}) {
        return this.getOrLoadData('spells', async () => {
            try {
                const index = await this.loadSpellIndex(options);
                const sourceKeys = Object.keys(index);

                // Load all spell data in parallel
                const spellDataPromises = sourceKeys.map(key =>
                    this.loadSpellData(key, options)
                );
                const fluffDataPromises = sourceKeys.map(key =>
                    this.loadSpellFluff(key, options)
                );

                const [spellDataResults, fluffDataResults] = await Promise.all([
                    Promise.all(spellDataPromises),
                    Promise.all(fluffDataPromises)
                ]);

                // Process and combine the data
                const processedData = {
                    spells: []
                };

                spellDataResults.forEach((spellData, index) => {
                    if (!spellData) return;

                    const fluffData = fluffDataResults[index];
                    const sourceKey = sourceKeys[index];

                    this.processSpellData(spellData, fluffData, processedData);
                });

                // Sort spells by name
                processedData.spells.sort((a, b) => a.name.localeCompare(b.name));

                return processedData;
            } catch (error) {
                console.error('Error loading spells:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load spells in chunks for better performance with large datasets
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @returns {AsyncGenerator<Object[]>} Generator yielding chunks of spell data
     */
    async *loadSpellsInChunks(chunkSize = 10, options = {}) {
        const data = await this.loadSpells(options);

        if (data.spells && Array.isArray(data.spells)) {
            for (let i = 0; i < data.spells.length; i += chunkSize) {
                yield data.spells.slice(i, i + chunkSize);
            }
        }
    }

    /**
     * Process spell data from individual files
     * @private
     */
    processSpellData(spellData, fluffData, processedData) {
        // Filter by allowed sources
        const allowedSources = this.getAllowedSources();

        if (spellData.spell) {
            const processedSpells = spellData.spell
                .filter(spell => allowedSources.has(spell.source || 'PHB'))
                .map(spell => ({
                    id: spell.name.toLowerCase(),
                    name: spell.name,
                    source: spell.source || 'PHB',
                    page: spell.page,
                    srd: spell.srd || false,
                    basicRules: spell.basicRules || false,
                    level: spell.level,
                    school: this.processSchool(spell.school),
                    time: this.processCastingTime(spell.time),
                    range: this.processRange(spell.range),
                    components: this.processComponents(spell.components),
                    duration: this.processDuration(spell.duration),
                    meta: this.processSpellMeta(spell.meta),
                    entries: spell.entries || [],
                    entriesHigherLevel: spell.entriesHigherLevel || [],
                    scalingLevelDice: this.processScalingDice(spell.scalingLevelDice),
                    damageInflict: spell.damageInflict || [],
                    damageResist: spell.damageResist || [],
                    damageImmune: spell.damageImmune || [],
                    damageVulnerable: spell.damageVulnerable || [],
                    conditionInflict: spell.conditionInflict || [],
                    conditionImmune: spell.conditionImmune || [],
                    savingThrow: spell.savingThrow || [],
                    abilityCheck: spell.abilityCheck || [],
                    areaTags: spell.areaTags || [],
                    classes: this.processClasses(spell.classes),
                    races: spell.races || [],
                    backgrounds: spell.backgrounds || [],
                    eldritchInvocations: spell.eldritchInvocations || [],
                    fluff: this.processFluff(spell.name, spell.source, fluffData)
                }));

            processedData.spells.push(...processedSpells);
        }
    }

    /**
     * Process spell school
     * @private
     */
    processSchool(school) {
        if (!school) return null;

        return {
            name: school.name || school,
            subschool: school.subschool || null
        };
    }

    /**
     * Process casting time
     * @private
     */
    processCastingTime(time) {
        if (!time) return null;

        return time.map(t => ({
            number: t.number || 1,
            unit: t.unit || 'action',
            condition: t.condition || null
        }));
    }

    /**
     * Process spell range
     * @private
     */
    processRange(range) {
        if (!range) return null;

        return {
            type: range.type || 'point',
            distance: this.processDistance(range.distance),
            target: range.target || null
        };
    }

    /**
     * Process distance
     * @private
     */
    processDistance(distance) {
        if (!distance) return null;

        return {
            type: distance.type || 'feet',
            amount: distance.amount || 0
        };
    }

    /**
     * Process spell components
     * @private
     */
    processComponents(components) {
        if (!components) return null;

        return {
            verbal: components.v || false,
            somatic: components.s || false,
            material: this.processMaterial(components.m),
            royalty: components.r || false
        };
    }

    /**
     * Process material components
     * @private
     */
    processMaterial(material) {
        if (!material) return null;
        if (typeof material === 'string') return { text: material };

        return {
            text: material.text || '',
            cost: material.cost || 0,
            consume: material.consume || false
        };
    }

    /**
     * Process spell duration
     * @private
     */
    processDuration(duration) {
        if (!duration) return null;

        return duration.map(d => ({
            type: d.type || 'instant',
            duration: {
                type: d.duration?.type || 'rounds',
                amount: d.duration?.amount || 0
            },
            concentration: d.concentration || false,
            condition: d.condition || null
        }));
    }

    /**
     * Process classes that can use the spell
     * @private
     */
    processClasses(classes) {
        if (!classes) return null;

        return {
            fromClassList: classes.fromClassList || [],
            fromClassListVariant: classes.fromClassListVariant || [],
            fromSubclass: classes.fromSubclass || []
        };
    }

    /**
     * Process spell metadata
     * @private
     */
    processSpellMeta(meta) {
        if (!meta) return null;

        return {
            ritual: meta.ritual || false,
            technomagic: meta.technomagic || false,
            tradition: meta.tradition || null,
            tags: meta.tags || []
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
     * Process scaling level dice
     * @private
     */
    processScalingDice(scaling) {
        if (!scaling) return null;

        return Object.entries(scaling).map(([level, dice]) => ({
            level: Number.parseInt(level),
            dice: dice
        }));
    }

    /**
     * Get spell by ID with improved caching
     * @param {string} spellId - Spell identifier
     * @param {Object} options - Loading options
     * @returns {Promise<Object|null>} Spell data or null if not found
     */
    async getSpellById(spellId, options = {}) {
        const cacheKey = `spell_${spellId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSpells();
            return data.spells.find(spell => spell.id === spellId.toLowerCase()) || null;
        }, options);
    }

    /**
     * Get spells by level with improved caching
     * @param {number} level - Spell level
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of spells of the specified level
     */
    async getSpellsByLevel(level, options = {}) {
        const cacheKey = `spells_level_${level}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSpells();
            return data.spells.filter(spell => spell.level === level);
        }, options);
    }

    /**
     * Get spells by school with improved caching
     * @param {string} school - Magic school
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of spells from the specified school
     */
    async getSpellsBySchool(school, options = {}) {
        const cacheKey = `spells_school_${school}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSpells();
            return data.spells.filter(spell =>
                spell.school.toLowerCase() === school.toLowerCase()
            );
        }, options);
    }

    /**
     * Get spells by class with improved caching
     * @param {string} className - Class name
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of spells available to the specified class
     */
    async getSpellsByClass(className, options = {}) {
        const cacheKey = `spells_class_${className}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSpells();
            return data.spells.filter(spell =>
                spell.classes?.fromClassList?.some(cls =>
                    cls.name.toLowerCase() === className.toLowerCase()
                )
            );
        }, options);
    }

    /**
     * Get ritual spells with improved caching
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of ritual spells
     */
    async getRitualSpells(options = {}) {
        const cacheKey = 'spells_ritual';
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSpells();
            return data.spells.filter(spell => spell.meta?.ritual);
        }, options);
    }

    /**
     * Get concentration spells with improved caching
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of concentration spells
     */
    async getConcentrationSpells(options = {}) {
        const cacheKey = 'spells_concentration';
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadSpells();
            return data.spells.filter(spell =>
                spell.duration.some(d => d.concentration)
            );
        }, options);
    }
} 