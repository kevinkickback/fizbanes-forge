/**
 * DataLoaderRace.js
 * Handles loading and processing of race data
 * 
 * @typedef {Object} Size
 * @property {('T'|'S'|'M'|'L'|'H'|'G')} type - Size category
 * @property {string|null} note - Additional size information
 * 
 * @typedef {Object} Speed
 * @property {number} walk - Walking speed in feet
 * @property {number} [fly] - Flying speed in feet
 * @property {number} [swim] - Swimming speed in feet
 * @property {number} [climb] - Climbing speed in feet
 * @property {number} [burrow] - Burrowing speed in feet
 * @property {boolean} [hover] - Whether the race can hover
 * @property {string|null} [note] - Additional movement notes
 * 
 * @typedef {Object} AbilityScore
 * @property {('str'|'dex'|'con'|'int'|'wis'|'cha')} ability - Ability score name
 * @property {number} bonus - Bonus value
 * 
 * @typedef {Object} AbilityScoreChoice
 * @property {'fixed'|'choice'} type - Type of choice
 * @property {number} count - Number of choices
 * @property {number} amount - Bonus amount
 * @property {Array<'str'|'dex'|'con'|'int'|'wis'|'cha'>} from - Available options
 * 
 * @typedef {Object} Age
 * @property {number|null} mature - Age of maturity
 * @property {number|null} max - Maximum age
 * @property {string|null} note - Additional age information
 * 
 * @typedef {Object} LanguageChoice
 * @property {number} count - Number of languages to choose
 * @property {Array<string>} choices - Available language options
 * 
 * @typedef {Object} Languages
 * @property {Array<string>} known - Known languages
 * @property {LanguageChoice|null} additional - Additional language options
 * 
 * @typedef {Object} RacialTraitChoice
 * @property {string} name - Choice name
 * @property {Array<Object>} options - Available options
 * @property {number} count - Number of options to choose
 * 
 * @typedef {Object} RacialTrait
 * @property {string} name - Trait name
 * @property {Array<Object>} entries - Trait description entries
 * @property {string} source - Source book
 * @property {RacialTraitChoice|null} choices - Available choices
 * @property {number} [choiceCount] - Number of choices available
 * @property {Object|null} requirements - Trait requirements
 * 
 * @typedef {Object} SkillProficiency
 * @property {Array<string>} choices - Available skill choices
 * @property {number} count - Number of skills to choose
 * 
 * @typedef {Object} Proficiencies
 * @property {Array<string>} armor - Armor proficiencies
 * @property {Array<string>} weapons - Weapon proficiencies
 * @property {Array<string>} tools - Tool proficiencies
 * @property {SkillProficiency} skills - Skill proficiencies
 * 
 * @typedef {Object} SpellcastingAbility
 * @property {('cha'|'int'|'wis')} type - The spellcasting ability
 * @property {Array<'cha'|'int'|'wis'>} [choices] - Available ability choices
 * 
 * @typedef {Object} SpellLevel
 * @property {Array<string>} spells - Spells known at this level
 * @property {number} slots - Number of spell slots
 * 
 * @typedef {Object} Spellcasting
 * @property {SpellcastingAbility} ability - Spellcasting ability or choices
 * @property {boolean} innate - Whether spellcasting is innate
 * @property {Object<number, SpellLevel>} spells - Known spells by level
 * @property {Object<number, SpellLevel>} daily - Daily spells by level
 * @property {Object|null} requirements - Spellcasting requirements
 * 
 * @typedef {Object} FluffImage
 * @property {string} type - Image type
 * @property {string} href - Image URL or reference
 * @property {string} [artist] - Artist name
 * @property {string} [source] - Image source
 * 
 * @typedef {Object} FluffEntry
 * @property {string} type - Entry type
 * @property {string|Array<string|Object>} content - Entry content
 * @property {string} [source] - Entry source
 * 
 * @typedef {Object} FluffData
 * @property {Array<FluffEntry>} entries - Descriptive entries
 * @property {Array<FluffImage>} images - Race images
 * @property {string} source - Source book
 * @property {string} [artist] - Primary artist
 * 
 * @typedef {Object} ProcessedRace
 * @property {string} id - Unique identifier
 * @property {string} name - Race name
 * @property {string} source - Source book
 * @property {number|null} page - Page number
 * @property {Size} size - Size information
 * @property {Speed} speed - Movement speeds
 * @property {Array<AbilityScore|AbilityScoreChoice>} abilityScores - Ability score improvements
 * @property {Age|null} age - Age information
 * @property {string|null} alignment - Typical alignment
 * @property {Languages|null} languages - Language proficiencies
 * @property {Array<RacialTrait>} traits - Racial traits
 * @property {Proficiencies|null} proficiencies - Racial proficiencies
 * @property {Spellcasting|null} spellcasting - Racial spellcasting
 * @property {FluffData|null} fluff - Descriptive information
 * @property {boolean} hasSubraces - Whether race has subraces
 * @property {string} subraceType - Type of subrace
 * @property {Array<Object>} additionalSpells - Additional spell options
 * @property {Object|null} requirements - Race requirements
 * @property {number} darkvision - Darkvision range
 * @property {Array<string>} resistances - Damage resistances
 * @property {Array<string>} vulnerabilities - Damage vulnerabilities
 * @property {Array<string>} immunities - Damage immunities
 * 
 * @typedef {Object} ProcessedSubrace
 * @property {string} id - Unique identifier
 * @property {string} name - Subrace name
 * @property {string} raceName - Parent race name
 * @property {string} source - Source book
 * @property {number|null} page - Page number
 * @property {Array<AbilityScore|AbilityScoreChoice>} abilityScores - Ability score improvements
 * @property {Array<RacialTrait>} traits - Racial traits
 * @property {Proficiencies|null} proficiencies - Racial proficiencies
 * @property {Spellcasting|null} spellcasting - Racial spellcasting
 * @property {FluffData|null} fluff - Descriptive information
 * @property {Array<Object>} additionalSpells - Additional spell options
 * @property {Object|null} requirements - Subrace requirements
 */

import { DataLoader } from './DataLoader.new.js';

/**
 * DataLoaderRace.js
 * Handles loading and processing of race data
 */
export class DataLoaderRace extends DataLoader {
    constructor(options = {}) {
        super({
            ...options,
            maxCacheSize: options.maxCacheSize || 50,
            defaultExpiry: options.defaultExpiry || 3600000 // 1 hour
        });
        this.dataFiles = {
            races: 'races.json',
            fluff: 'fluff-races.json'
        };
    }

    /**
     * Load all race data with improved caching and chunking
     * @param {Object} options - Loading options
     * @param {number} [options.maxRetries] - Maximum number of retries
     * @param {boolean} [options.forceRefresh] - Force cache refresh
     * @returns {Promise<{
     *   races: Array<ProcessedRace>,
     *   subraces: Array<ProcessedSubrace>
     * }>} Processed race data
     */
    async loadRaces(options = {}) {
        const cacheKey = 'races_all';
        return this.getOrLoadData(cacheKey, async () => {
            try {
                console.log('Loading race data...');
                const [raceData, fluffData] = await Promise.all([
                    this.loadJsonFile(this.dataFiles.races, {
                        ...options,
                        maxRetries: 3
                    }).catch(error => {
                        console.error('Failed to load race data:', error);
                        throw new Error('Failed to load race data');
                    }),
                    this.loadJsonFile(this.dataFiles.fluff, {
                        ...options,
                        maxRetries: 2
                    }).catch(() => ({ raceFluff: [] }))
                ]);

                if (!raceData || !raceData.race) {
                    throw new Error('Invalid or empty race data');
                }

                console.log(`Loaded ${raceData?.race?.length || 0} races and ${raceData?.subrace?.length || 0} subraces`);
                const processed = this.processRaceData(raceData, fluffData);
                console.log(`Processed ${processed.races.length} races and ${processed.subraces.length} subraces`);

                // Cache individual races and subraces for faster lookup
                for (const race of processed.races) {
                    this.dataCache.set(`race_${race.id}`, race);
                }
                for (const subrace of processed.subraces) {
                    this.dataCache.set(`subrace_${subrace.id}`, subrace);
                }

                return processed;
            } catch (error) {
                console.error('Error loading races:', error);
                throw error;
            }
        }, options);
    }

    /**
     * Load races in chunks for better performance with large datasets
     * @param {number} chunkSize - Size of each chunk
     * @param {Object} options - Loading options
     * @yields {Promise<Array<ProcessedRace|ProcessedSubrace>>} Generator yielding chunks of race data
     */
    async *loadRacesInChunks(chunkSize = 10, options = {}) {
        const data = await this.loadRaces(options);

        // Yield races in chunks
        if (data.races && Array.isArray(data.races)) {
            for (let i = 0; i < data.races.length; i += chunkSize) {
                yield data.races.slice(i, i + chunkSize);
            }
        }

        // Yield subraces in chunks
        if (data.subraces && Array.isArray(data.subraces)) {
            for (let i = 0; i < data.subraces.length; i += chunkSize) {
                yield data.subraces.slice(i, i + chunkSize);
            }
        }
    }

    /**
     * Process raw race data into standardized format
     * @private
     * @param {Object} raceData - Raw race data
     * @param {Object} fluffData - Race fluff data
     * @returns {{ races: Array<ProcessedRace>, subraces: Array<ProcessedSubrace> }}
     */
    processRaceData(raceData, fluffData) {
        const allowedSources = this.getAllowedSources();
        const processedData = {
            races: [],
            subraces: []
        };

        // Process races
        if (raceData.race) {
            processedData.races = raceData.race
                .filter(race => allowedSources.has(race.source || 'PHB'))
                .map(race => {
                    try {
                        return this.processRace(race, raceData, fluffData);
                    } catch (error) {
                        console.error(`Error processing race ${race.name}:`, error);
                        return null;
                    }
                }).filter(Boolean);
        }

        // Process subraces
        if (raceData.subrace) {
            processedData.subraces = raceData.subrace
                .filter(sub => allowedSources.has(sub.source || 'PHB'))
                .map(sub => {
                    try {
                        return this.processSubrace(sub, fluffData);
                    } catch (error) {
                        console.error(`Error processing subrace ${sub.name}:`, error);
                        return null;
                    }
                }).filter(Boolean);
        }

        return processedData;
    }

    /**
     * Process a single race
     * @private
     * @param {Object} race - Raw race data
     * @param {Object} raceData - Complete race data object
     * @param {Object} fluffData - Race fluff data
     * @returns {ProcessedRace} Processed race data
     */
    processRace(race, raceData, fluffData) {
        if (!race) return null;

        const baseId = (race.id || race.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const source = race.source || 'PHB';
        const id = `${baseId}_${source.toLowerCase()}`;

        // Check for subraces
        const hasSubraces = raceData.subrace?.some(sub =>
            sub && sub.raceName?.toLowerCase() === race.name?.toLowerCase() &&
            this.getAllowedSources().has(sub.source || 'PHB')
        );

        // Process race data
        return {
            id,
            name: race.name || 'Unknown Race',
            source: source,
            page: race.page || null,
            size: this.processSize(race.size),
            speed: this.processSpeed(race.speed),
            ability: race.ability || [],
            abilityScores: this.processAbilityScores(race.ability),
            age: this.processAge(race.age),
            alignment: this.processAlignment(race),
            languages: this.processLanguages(race),
            traits: this.processTraits(race),
            proficiencies: this.processProficiencies(race),
            spellcasting: this.processSpellcasting(race),
            fluff: this.processFluff(race.name, source, fluffData?.raceFluff),
            hasSubraces,
            subraceType: race.subraceType || 'subrace',
            additionalSpells: this.processAdditionalSpells(race.additionalSpells),
            requirements: race.requirements || null,
            darkvision: this.processDarkvision(race),
            resistances: this.processResistances(race),
            vulnerabilities: race.vulnerabilities || [],
            immunities: race.immunities || []
        };
    }

    /**
     * Process a single subrace
     * @private
     * @param {Object} subrace - Raw subrace data
     * @param {Object} fluffData - Race fluff data
     * @returns {ProcessedSubrace} Processed subrace data
     */
    processSubrace(subrace, fluffData) {
        if (!subrace) return null;

        const baseId = (subrace.id || `${subrace.raceName}-${subrace.name}` || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const source = subrace.source || 'PHB';
        const id = `${baseId}_${source.toLowerCase()}`;

        return {
            id,
            name: subrace.name || 'Unknown Subrace',
            raceName: subrace.raceName,
            source: source,
            page: subrace.page || null,
            ability: subrace.ability || [],
            abilityScores: this.processAbilityScores(subrace.ability),
            traits: this.processTraits(subrace),
            proficiencies: this.processProficiencies(subrace),
            spellcasting: this.processSpellcasting(subrace),
            fluff: this.processFluff(subrace.name, source, fluffData?.raceFluff),
            additionalSpells: this.processAdditionalSpells(subrace.additionalSpells),
            requirements: subrace.requirements || null
        };
    }

    /**
     * Process size data
     * @private
     * @param {Object|string|Array} size - Raw size data
     * @returns {Size} Processed size data
     */
    processSize(size) {
        if (!size) return { type: 'M' };
        if (Array.isArray(size)) {
            return {
                type: size[0] || 'M',
                note: size.length > 1 ? size[1] : null
            };
        }
        if (typeof size === 'string') {
            return { type: size };
        }
        return {
            type: size.type || 'M',
            note: size.note || null
        };
    }

    /**
     * Process speed data
     * @private
     * @param {Object|number} speed - Raw speed data
     * @returns {Speed} Processed speed data
     */
    processSpeed(speed) {
        if (!speed) return { walk: 30 };
        if (typeof speed === 'number') {
            return { walk: speed };
        }
        return {
            walk: speed.walk || 30,
            fly: speed.fly || 0,
            swim: speed.swim || 0,
            climb: speed.climb || 0,
            burrow: speed.burrow || 0,
            hover: speed.hover || false,
            note: speed.note || null
        };
    }

    /**
     * Process ability scores
     * @private
     * @param {Array} ability - Raw ability score data
     * @returns {Array<AbilityScore|AbilityScoreChoice>} Processed ability scores
     */
    processAbilityScores(ability) {
        if (!ability || !Array.isArray(ability)) return [];

        return ability.map(choice => {
            if (choice.choose) {
                return {
                    type: 'choice',
                    count: choice.choose.count || 1,
                    amount: choice.choose.amount || 1,
                    from: choice.choose.from || []
                };
            }
            return Object.entries(choice).map(([ability, bonus]) => ({
                ability: ability.toLowerCase(),
                bonus: Number(bonus)
            }));
        });
    }

    /**
     * Process alignment data
     * @private
     * @param {Object} race - Raw race data
     * @returns {string|null} Processed alignment
     */
    processAlignment(race) {
        if (race.alignment) return race.alignment;

        const alignmentEntry = race.entries?.find(entry =>
            (typeof entry === 'object' && entry.name?.toLowerCase().includes('alignment')) ||
            (typeof entry === 'string' && entry.toLowerCase().includes('alignment'))
        );

        if (!alignmentEntry) return null;

        if (typeof alignmentEntry === 'string') return alignmentEntry;
        return alignmentEntry.entries ?
            Array.isArray(alignmentEntry.entries) ? alignmentEntry.entries.join(' ') : alignmentEntry.entries
            : null;
    }

    /**
     * Process language data
     * @private
     * @param {Object} race - Raw race data
     * @returns {Languages|null} Processed language data
     */
    processLanguages(race) {
        // Try explicit languages first
        if (race.languages) {
            return {
                known: race.languages.known || [],
                additional: {
                    count: race.languages.additional?.count || 0,
                    choices: race.languages.additional?.choices || []
                }
            };
        }

        // Try language proficiencies
        if (race.languageProficiencies) {
            const known = [];
            for (const lang of race.languageProficiencies) {
                known.push(...Object.keys(lang).filter(key => lang[key] === true));
            }
            return {
                known,
                additional: { count: 0, choices: [] }
            };
        }

        return null;
    }

    /**
     * Process racial traits
     * @private
     * @param {Object} race - Raw race data
     * @returns {Array<RacialTrait>} Processed traits
     */
    processTraits(race) {
        const traits = [];

        // Process explicit traits
        if (race.traits) {
            traits.push(...race.traits.map(trait => ({
                name: trait.name,
                entries: trait.entries || [],
                source: trait.source || race.source || 'PHB',
                choices: trait.choices || null,
                choiceCount: trait.choiceCount || 0,
                requirements: trait.requirements || null
            })));
        }

        // Process traits from entries
        if (race.entries) {
            const entryTraits = race.entries
                .filter(entry =>
                    typeof entry === 'object' &&
                    entry.type === 'entries' &&
                    entry.name &&
                    Array.isArray(entry.entries)
                )
                .map(entry => ({
                    name: entry.name,
                    entries: this.processNestedEntries(entry.entries),
                    source: entry.source || race.source || 'PHB',
                    choices: entry.choices || null,
                    choiceCount: entry.choiceCount || 0,
                    requirements: entry.requirements || null
                }));

            traits.push(...entryTraits);
        }

        return traits;
    }

    /**
     * Process proficiencies
     * @private
     * @param {Object} race - Raw race data
     * @returns {Proficiencies|null} Processed proficiencies
     */
    processProficiencies(race) {
        if (!race.proficiencies && !race.entries) return null;

        const proficiencies = {
            weapons: [],
            armor: [],
            tools: [],
            skills: {
                choices: [],
                count: 0
            }
        };

        // Process explicit proficiencies
        if (race.proficiencies) {
            Object.assign(proficiencies, {
                armor: race.proficiencies.armor || [],
                weapons: race.proficiencies.weapons || [],
                tools: race.proficiencies.tools || [],
                skills: {
                    choices: race.proficiencies.skills?.choices || [],
                    count: race.proficiencies.skills?.count || 0
                }
            });
        }

        return Object.values(proficiencies).some(v =>
            Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0
        ) ? proficiencies : null;
    }

    /**
     * Process spellcasting
     * @private
     * @param {Object} race - Raw race data
     * @returns {Spellcasting|null} Processed spellcasting data
     */
    processSpellcasting(race) {
        // Initialize spellcasting data
        let spellcastingData = null;

        // Check for explicit spellcasting property
        if (race.spellcasting) {
            spellcastingData = {
                ability: race.spellcasting.ability,
                innate: race.spellcasting.innate || false,
                spells: race.spellcasting.spells || {},
                daily: race.spellcasting.daily || {},
                requirements: race.spellcasting.requirements || null
            };
        }

        // Check for additional spells
        if (race.additionalSpells && race.additionalSpells.length > 0) {
            spellcastingData = spellcastingData || {};
            const additionalSpells = race.additionalSpells[0]; // Usually only one entry for racial spells

            spellcastingData = {
                ability: additionalSpells.ability?.choose ?
                    { choices: additionalSpells.ability.choose } :
                    additionalSpells.ability || spellcastingData?.ability,
                innate: additionalSpells.innate ? true : (spellcastingData?.innate || false),
                spells: {
                    ...spellcastingData?.spells,
                    ...(additionalSpells.known || {})
                },
                daily: {
                    ...spellcastingData?.daily,
                    ...(additionalSpells.innate || {})
                },
                requirements: spellcastingData?.requirements || null
            };
        }

        // Check for spells in racial traits
        if (race.entries) {
            const spellTraits = race.entries.filter(entry =>
                typeof entry === 'object' &&
                entry.type === 'entries' &&
                entry.name &&
                (entry.name.includes('Legacy') || entry.name.includes('Magic') || entry.name.includes('Spellcasting'))
            );

            if (spellTraits.length > 0) {
                spellcastingData = spellcastingData || {};

                // Extract spellcasting ability and spells from trait descriptions
                for (const trait of spellTraits) {
                    const traitText = Array.isArray(trait.entries) ? trait.entries.join(' ') : trait.entries;

                    // Extract spellcasting ability
                    if (traitText.toLowerCase().includes('charisma is your spellcasting ability')) {
                        spellcastingData.ability = 'cha';
                    } else if (traitText.toLowerCase().includes('intelligence is your spellcasting ability')) {
                        spellcastingData.ability = 'int';
                    } else if (traitText.toLowerCase().includes('wisdom is your spellcasting ability')) {
                        spellcastingData.ability = 'wis';
                    }

                    // Mark as innate if it mentions "innately cast"
                    if (traitText.toLowerCase().includes('innately cast')) {
                        spellcastingData.innate = true;
                    }
                }
            }
        }

        return spellcastingData;
    }

    /**
     * Process additional spells
     * @private
     * @param {Array} spells - Raw additional spells data
     * @returns {Array} Processed additional spells
     */
    processAdditionalSpells(spells) {
        if (!spells) return [];

        return spells.map(spellGroup => ({
            name: spellGroup.name,
            ability: spellGroup.ability,
            spells: spellGroup.spells || {},
            daily: spellGroup.daily || {},
            prepared: spellGroup.prepared || false,
            requirements: spellGroup.requirements || null
        }));
    }

    /**
     * Process darkvision
     * @private
     * @param {Object} race - Raw race data
     * @returns {number} Darkvision range
     */
    processDarkvision(race) {
        if (typeof race.darkvision === 'number') return race.darkvision;

        const darkvisionEntry = race.entries?.find(entry =>
            (typeof entry === 'object' && entry.name?.toLowerCase().includes('darkvision')) ||
            (typeof entry === 'string' && entry.toLowerCase().includes('darkvision'))
        );

        if (!darkvisionEntry) return 0;

        const text = typeof darkvisionEntry === 'string' ?
            darkvisionEntry :
            JSON.stringify(darkvisionEntry);

        const match = text.match(/darkvision (\d+)/i);
        return match ? Number.parseInt(match[1]) : 0;
    }

    /**
     * Process resistances
     * @private
     * @param {Object} race - Raw race data
     * @returns {Array<string>} Processed resistances
     */
    processResistances(race) {
        if (race.resistances) return race.resistances;
        return [];
    }

    /**
     * Process age data
     * @private
     * @param {Object|null} age - Raw age data
     * @returns {Age|null} Processed age data
     */
    processAge(age) {
        if (!age) return null;
        return {
            mature: age.mature || null,
            max: age.max || null,
            note: age.note || null
        };
    }

    /**
     * Process fluff data
     * @private
     * @param {string} name - Race name
     * @param {string} source - Source book
     * @param {Array} fluffData - Raw fluff data
     * @returns {FluffData|null} Processed fluff data
     */
    processFluff(name, source, fluffData) {
        try {
            if (!fluffData?.raceFluff || !Array.isArray(fluffData.raceFluff)) {
                return null;
            }

            const fluff = fluffData.raceFluff.find(f =>
                f && f.name === name &&
                (f.source === source || !f.source)
            );

            if (!fluff) {
                return null;
            }

            // Process entries with better structure
            const processedEntries = this.processFluffEntries(fluff.entries);

            // Process images with additional metadata
            const processedImages = (fluff.images || []).map(img => ({
                type: img.type || 'image',
                href: img.href,
                artist: img.artist || null,
                source: img.source || source
            }));

            return {
                entries: processedEntries,
                images: processedImages,
                source: fluff.source || source,
                artist: fluff.artist || null
            };
        } catch (error) {
            console.warn(`Error processing fluff for ${name}:`, error);
            return null;
        }
    }

    /**
     * Process fluff entries with improved structure
     * @private
     * @param {Array|string} entries - Raw fluff entries
     * @returns {Array<FluffEntry>} Processed fluff entries
     */
    processFluffEntries(entries) {
        if (!entries) return [];
        if (typeof entries === 'string') return [{
            type: 'text',
            content: entries
        }];

        return entries.map(entry => {
            try {
                if (typeof entry === 'string') {
                    return {
                        type: 'text',
                        content: entry
                    };
                }

                if (entry.type === 'entries') {
                    return {
                        type: 'section',
                        name: entry.name,
                        content: this.processFluffEntries(entry.entries)
                    };
                }

                if (entry.type === 'list') {
                    return {
                        type: 'list',
                        content: entry.items.map(item =>
                            typeof item === 'string' ? item : this.processFluffEntries([item])[0]
                        )
                    };
                }

                return entry;
            } catch (error) {
                console.warn('Error processing fluff entry:', error);
                return null;
            }
        }).filter(Boolean);
    }

    /**
     * Process nested entries recursively
     * @private
     * @param {Array|string} entries - Raw entries
     * @returns {Array} Processed entries
     */
    processNestedEntries(entries) {
        if (!entries) return [];
        if (typeof entries === 'string') return [entries];

        return entries.map(entry => {
            if (typeof entry === 'string') return entry;

            if (entry.type === 'entries') {
                return {
                    name: entry.name,
                    entries: this.processNestedEntries(entry.entries)
                };
            }

            if (entry.entries) {
                return {
                    ...entry,
                    entries: this.processNestedEntries(entry.entries)
                };
            }

            return entry;
        });
    }

    /**
     * Get race by ID with improved caching
     * @param {string} raceId - Race identifier
     * @param {Object} options - Loading options
     * @returns {Promise<ProcessedRace|null>} Race data or null if not found
     */
    async getRaceById(raceId, options = {}) {
        const cacheKey = `race_${raceId.toLowerCase()}`;

        // Try to get from cache first
        const cached = this.dataCache.get(cacheKey);
        if (cached && !options.forceRefresh) {
            return cached;
        }

        try {
            const data = await this.loadRaces(options);
            const race = data.races.find(r => r.id === raceId.toLowerCase());

            if (race) {
                // Cache the individual race
                this.dataCache.set(cacheKey, race);
                return race;
            }

            return null;
        } catch (error) {
            console.error(`Error getting race ${raceId}:`, error);
            throw error;
        }
    }

    /**
     * Get subraces for a race with improved caching
     * @param {string} raceId - Race identifier
     * @param {Object} options - Loading options
     * @returns {Promise<Array<ProcessedSubrace>>} Array of subraces
     */
    async getSubraces(raceId, options = {}) {
        const cacheKey = `subraces_${raceId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadRaces();
            const race = await this.getRaceById(raceId);

            if (!race || !race.hasSubraces) return [];

            return data.subraces.filter(sub =>
                sub.raceName?.toLowerCase() === race.name?.toLowerCase() &&
                sub.source === race.source
            );
        }, options);
    }

    /**
     * Get racial traits with improved caching
     * @param {string} raceId - Race identifier
     * @param {Object} options - Loading options
     * @returns {Promise<Array<RacialTrait>>} Array of racial traits
     */
    async getRacialTraits(raceId, options = {}) {
        const cacheKey = `traits_${raceId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const race = await this.getRaceById(raceId);
            return race?.traits || [];
        }, options);
    }

    /**
     * Get racial spellcasting with improved caching
     * @param {string} raceId - Race identifier
     * @param {Object} options - Loading options
     * @returns {Promise<Spellcasting|null>} Spellcasting data or null
     */
    async getRacialSpellcasting(raceId, options = {}) {
        const cacheKey = `spellcasting_${raceId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const race = await this.getRaceById(raceId);
            return race?.spellcasting || null;
        }, options);
    }

    /**
     * Get races by ability score bonus with improved caching
     * @param {string} ability - Ability score (e.g., 'str', 'dex', 'con')
     * @param {Object} options - Loading options
     * @returns {Promise<Array<ProcessedRace>>} Array of races with the specified ability score bonus
     */
    async getRacesByAbility(ability, options = {}) {
        const cacheKey = `races_ability_${ability}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadRaces(options);
            const abilityLower = ability.toLowerCase();

            return data.races.filter(race =>
                race.abilityScores?.some(score =>
                    Array.isArray(score) ?
                        score.some(s => s.ability === abilityLower && s.bonus > 0) :
                        score.type === 'choice' && score.from.includes(abilityLower)
                )
            );
        }, options);
    }

    /**
     * Get races by size with improved caching
     * @param {string} size - Size category (e.g., 'S', 'M', 'L')
     * @param {Object} options - Loading options
     * @returns {Promise<Array<ProcessedRace>>} Array of races of the specified size
     */
    async getRacesBySize(size, options = {}) {
        const cacheKey = `races_size_${size}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadRaces();
            return data.races.filter(race =>
                race.size.type.toLowerCase() === size.toLowerCase()
            );
        }, options);
    }
} 