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
     * @returns {Promise<Object>} Processed race data
     */
    async loadRaces(options = {}) {
        return this.getOrLoadData('races', async () => {
            try {
                console.log('Loading race data...');
                const [raceData, fluffData] = await Promise.all([
                    this.loadJsonFile(this.dataFiles.races, {
                        ...options,
                        maxRetries: 3
                    }),
                    this.loadJsonFile(this.dataFiles.fluff, {
                        ...options,
                        maxRetries: 2
                    }).catch(() => {
                        console.log('No fluff data found, using empty default');
                        return { raceFluff: [] };
                    })
                ]);

                console.log(`Loaded ${raceData?.race?.length || 0} races and ${raceData?.subrace?.length || 0} subraces`);
                const processed = this.processRaceData(raceData, fluffData);
                console.log(`Processed ${processed.races.length} races and ${processed.subraces.length} subraces`);
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
     * @returns {AsyncGenerator<Object[]>} Generator yielding chunks of race data
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
     * Process raw race data into standardized format with improved validation
     * @private
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
                        // Generate a unique ID based on name and source
                        const baseId = (race.id || race.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const source = race.source || 'PHB';
                        const id = `${baseId}_${source.toLowerCase()}`;

                        // Check for subraces
                        const hasSubraces = raceData.subrace?.some(sub =>
                            sub.raceName?.toLowerCase() === race.name?.toLowerCase() &&
                            allowedSources.has(sub.source || 'PHB')
                        );

                        // Extract traits from entries if present
                        const traits = this.extractTraitsFromEntries(race.entries || []);
                        const proficiencyInfo = this.extractProficienciesFromEntries(race.entries || [], race.proficiencies);

                        return {
                            id,
                            name: race.name,
                            source: source,
                            page: race.page || null,
                            size: this.processSize(race.size),
                            speed: this.processSpeed(race.speed),
                            ability: race.ability || [],
                            abilityScores: this.processAbilityScores(race.ability),
                            age: this.processAge(race.age),
                            alignment: this.extractAlignment(race.alignment, race.entries),
                            languages: this.processLanguages(race.languages) || this.extractLanguageFromEntries(race.entries, race.languageProficiencies),
                            traits: traits.length > 0 ? traits : this.processTraits(race.traits),
                            proficiencies: proficiencyInfo || this.processProficiencies(race.proficiencies),
                            spellcasting: this.processRaceSpellcasting(race.spellcasting),
                            fluff: this.processFluff(race.name, race.source, fluffData?.raceFluff),
                            hasSubraces,
                            subraceType: race.subraceType || 'subrace',
                            additionalSpells: this.processAdditionalSpells(race.additionalSpells),
                            requirements: race.requirements || null,
                            darkvision: this.extractDarkvision(race.darkvision, race.entries) || 0,
                            resistances: race.resistances || this.extractResistances(race.entries) || [],
                            vulnerabilities: race.vulnerabilities || [],
                            immunities: race.immunities || []
                        };
                    } catch (error) {
                        console.error(`Error processing race ${race.name}:`, error);
                        return null;
                    }
                }).filter(Boolean); // Remove any null entries from failed processing
        }

        // Process subraces
        if (raceData.subrace) {
            processedData.subraces = raceData.subrace
                .filter(sub =>
                    allowedSources.has(sub.source || 'PHB') &&
                    sub.name &&
                    sub.raceName
                )
                .map(sub => {
                    try {
                        // Generate a unique ID based on name, race name, and source
                        const baseId = (sub.id || `${sub.raceName}-${sub.name}` || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        const source = sub.source || 'PHB';
                        const id = `${baseId}_${source.toLowerCase()}`;

                        // Extract traits from entries if present
                        const traits = this.extractTraitsFromEntries(sub.entries || []);
                        const proficiencyInfo = this.extractProficienciesFromEntries(sub.entries || [], sub.proficiencies);

                        return {
                            id,
                            name: sub.name,
                            raceName: sub.raceName,
                            source: source,
                            page: sub.page || null,
                            ability: sub.ability || [],
                            abilityScores: this.processAbilityScores(sub.ability),
                            traits: traits.length > 0 ? traits : this.processTraits(sub.traits),
                            proficiencies: proficiencyInfo || this.processProficiencies(sub.proficiencies),
                            spellcasting: this.processRaceSpellcasting(sub.spellcasting),
                            fluff: this.processFluff(sub.name, sub.source, fluffData?.raceFluff),
                            additionalSpells: this.processAdditionalSpells(sub.additionalSpells),
                            requirements: sub.requirements || null
                        };
                    } catch (error) {
                        console.error(`Error processing subrace ${sub.name}:`, error);
                        return null;
                    }
                }).filter(Boolean); // Remove any null entries from failed processing
        }

        return processedData;
    }

    /**
     * Extract traits from entries array
     * @private
     */
    extractTraitsFromEntries(entries) {
        if (!Array.isArray(entries)) return [];

        return entries
            .filter(entry =>
                typeof entry === 'object' &&
                entry.type === 'entries' &&
                entry.name &&
                Array.isArray(entry.entries)
            )
            .map(entry => ({
                name: entry.name,
                entries: this.processNestedEntries(entry.entries),
                source: entry.source || 'PHB',
                choices: entry.choices || null,
                choiceCount: entry.choiceCount || 0,
                requirements: entry.requirements || null
            }));
    }

    /**
     * Extract language information from entries
     * @private
     */
    extractLanguageFromEntries(entries, languageProficiencies) {
        try {
            // First try languageProficiencies if available
            if (languageProficiencies) {
                return this.processLanguages(languageProficiencies);
            }

            // Handle undefined or null entries
            if (!entries) {
                return null;
            }

            // Ensure entries is an array
            if (!Array.isArray(entries)) {
                console.log('Entries is not an array, returning null');
                return null;
            }

            // Look for language information in entries
            const languageEntry = entries.find(entry => {
                if (!entry) return false;
                if (typeof entry === 'object') {
                    return entry.name?.toLowerCase().includes('language');
                }
                if (typeof entry === 'string') {
                    return entry.toLowerCase().includes('language');
                }
                return false;
            });

            if (!languageEntry) return null;

            // Extract known languages and additional choices
            const known = [];
            const additional = { count: 0, choices: [] };

            if (typeof languageEntry === 'string') {
                // Parse the string for language information
                const text = languageEntry.toLowerCase();
                if (text.includes('common')) known.push('Common');
                // Add other common languages you want to extract
            } else if (languageEntry.entries) {
                // Process structured entry
                const text = JSON.stringify(languageEntry.entries).toLowerCase();
                if (text.includes('common')) known.push('Common');
                // Add other language extraction logic
            }

            return { known, additional };
        } catch (error) {
            console.error('Error in extractLanguageFromEntries:', error);
            return null;
        }
    }

    /**
     * Extract proficiencies from entries
     * @private
     */
    extractProficienciesFromEntries(entries, existingProficiencies) {
        if (existingProficiencies) {
            return this.processProficiencies(existingProficiencies);
        }

        // Initialize proficiency object
        const proficiencies = {
            weapons: [],
            armor: [],
            tools: [],
            skills: {
                choices: [],
                count: 0
            },
            expertise: []
        };

        // Look for proficiency information in entries
        for (const entry of entries) {
            if (typeof entry === 'object' && entry.entries) {
                const text = JSON.stringify(entry.entries).toLowerCase();

                // Extract weapon proficiencies
                if (text.includes('weapon') && text.includes('proficien')) {
                    // Add weapon proficiency extraction logic
                }

                // Extract armor proficiencies
                if (text.includes('armor') && text.includes('proficien')) {
                    // Add armor proficiency extraction logic
                }

                // Extract tool proficiencies
                if (text.includes('tool') && text.includes('proficien')) {
                    // Add tool proficiency extraction logic
                }

                // Extract skill proficiencies
                if (text.includes('skill') && text.includes('proficien')) {
                    // Add skill proficiency extraction logic
                }
            }
        }

        return Object.keys(proficiencies).some(key =>
            Array.isArray(proficiencies[key]) ? proficiencies[key].length > 0 :
                Object.keys(proficiencies[key]).length > 0
        ) ? proficiencies : null;
    }

    /**
     * Extract alignment information from entries
     * @private
     */
    extractAlignment(alignment, entries) {
        if (alignment) return alignment;

        // Look for alignment information in entries
        const alignmentEntry = entries?.find(entry =>
            (typeof entry === 'object' && entry.name?.toLowerCase().includes('alignment')) ||
            (typeof entry === 'string' && entry.toLowerCase().includes('alignment'))
        );

        if (!alignmentEntry) return null;

        // Extract alignment information from the entry
        if (typeof alignmentEntry === 'string') {
            return alignmentEntry;
        }

        if (alignmentEntry.entries) {
            return Array.isArray(alignmentEntry.entries) ?
                alignmentEntry.entries.join(' ') :
                alignmentEntry.entries;
        }

        return null;
    }

    /**
     * Extract darkvision from entries
     * @private
     */
    extractDarkvision(darkvision, entries) {
        if (typeof darkvision === 'number') return darkvision;

        // Look for darkvision information in entries
        const darkvisionEntry = entries?.find(entry =>
            (typeof entry === 'object' && entry.name?.toLowerCase().includes('darkvision')) ||
            (typeof entry === 'string' && entry.toLowerCase().includes('darkvision'))
        );

        if (!darkvisionEntry) return 0;

        // Try to extract the darkvision range
        const text = typeof darkvisionEntry === 'string' ?
            darkvisionEntry :
            JSON.stringify(darkvisionEntry);

        const match = text.match(/darkvision (\d+)/i);
        return match ? Number.parseInt(match[1]) : 0;
    }

    /**
     * Extract resistances from entries
     * @private
     */
    extractResistances(entries) {
        if (!entries) return [];

        const resistances = [];
        for (const entry of entries) {
            if (typeof entry === 'object' && entry.entries) {
                const text = JSON.stringify(entry.entries).toLowerCase();
                if (text.includes('resistance')) {
                    // Add resistance extraction logic
                    // This is a placeholder - you would need to implement specific logic
                    // based on your data format
                }
            }
        }

        return resistances;
    }

    /**
     * Process size data
     * @private
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
     */
    processAbilityScores(ability) {
        try {
            if (!ability) {
                console.log('No ability scores provided');
                return null;
            }

            if (!Array.isArray(ability)) {
                console.log('Ability scores is not an array:', ability);
                return null;
            }

            console.log('Processing ability scores:', ability);

            return ability.map(choice => {
                if (choice.choose) {
                    console.log('Found choice type ability:', choice);
                    return {
                        type: 'choice',
                        count: choice.choose.count || 1,
                        amount: choice.choose.amount || 1,
                        from: choice.choose.from || []
                    };
                }

                console.log('Found fixed ability scores:', choice);
                return Object.entries(choice).map(([ability, bonus]) => ({
                    ability: ability.toLowerCase(),
                    bonus: Number(bonus)
                }));
            });
        } catch (error) {
            console.error('Error processing ability scores:', error);
            return null;
        }
    }

    /**
     * Process age data
     * @private
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
     * Process language data
     * @private
     */
    processLanguages(languages) {
        if (!languages) return null;

        // Handle languageProficiencies format
        if (Array.isArray(languages) && languages.length > 0 && typeof languages[0] === 'object') {
            const known = [];
            for (const lang of languages) {
                known.push(...Object.keys(lang).filter(key => lang[key] === true));
            }
            return {
                known,
                additional: { count: 0, choices: [] }
            };
        }

        // Handle standard format
        return {
            known: languages.known || [],
            additional: {
                count: languages.additional?.count || 0,
                choices: languages.additional?.choices || []
            }
        };
    }

    /**
     * Process racial traits
     * @private
     */
    processTraits(traits) {
        if (!traits) return [];

        return traits.map(trait => ({
            name: trait.name,
            entries: trait.entries || [],
            source: trait.source || 'PHB',
            choices: trait.choices || null,
            choiceCount: trait.choiceCount || 0,
            requirements: trait.requirements || null
        }));
    }

    /**
     * Process proficiencies
     * @private
     */
    processProficiencies(proficiencies) {
        if (!proficiencies) return null;

        return {
            armor: proficiencies.armor || [],
            weapons: proficiencies.weapons || [],
            tools: proficiencies.tools || [],
            skills: {
                choices: proficiencies.skills?.choices || [],
                count: proficiencies.skills?.count || 0
            }
        };
    }

    /**
     * Process racial spellcasting
     * @private
     */
    processRaceSpellcasting(spellcasting) {
        if (!spellcasting) return null;

        return {
            ability: spellcasting.ability,
            innate: spellcasting.innate || false,
            spells: spellcasting.spells || {},
            daily: spellcasting.daily || {},
            requirements: spellcasting.requirements || null
        };
    }

    /**
     * Process fluff data with improved nested entry handling
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
            entries: this.processNestedEntries(fluff.entries),
            images: fluff.images || []
        };
    }

    /**
     * Process nested entries recursively
     * @private
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
     * Process additional spells
     * @private
     */
    processAdditionalSpells(spells) {
        if (!spells) return null;

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
     * Get race by ID with improved caching
     * @param {string} raceId - Race identifier
     * @param {Object} options - Loading options
     * @returns {Promise<Object|null>} Race data or null if not found
     */
    async getRaceById(raceId, options = {}) {
        const cacheKey = `race_${raceId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadRaces();
            return data.races.find(race => race.id === raceId.toLowerCase()) || null;
        }, options);
    }

    /**
     * Get subraces for a race with improved caching
     * @param {string} raceId - Race identifier
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of subraces
     */
    async getSubraces(raceId, options = {}) {
        const cacheKey = `subraces_${raceId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadRaces();
            const race = await this.getRaceById(raceId);

            if (!race || !race.hasSubraces) {
                console.log(`No subraces found for race ${raceId}`);
                return [];
            }

            // Filter subraces matching the race name and source
            const matchingSubraces = data.subraces.filter(sub => {
                const matchesName = sub.raceName?.toLowerCase() === race.name?.toLowerCase();
                const matchesSource = sub.source === race.source;

                if (matchesName && matchesSource) {
                    console.log(`Found matching subrace: ${sub.name} for race ${race.name}`);
                    return true;
                }
                return false;
            });

            console.log(`Found ${matchingSubraces.length} subraces for ${race.name}`);
            return matchingSubraces;
        }, options);
    }

    /**
     * Get racial traits with improved caching
     * @param {string} raceId - Race identifier
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of racial traits
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
     * @returns {Promise<Object|null>} Spellcasting data or null
     */
    async getRacialSpellcasting(raceId, options = {}) {
        const cacheKey = `spellcasting_${raceId}`;
        return this.getOrLoadData(cacheKey, async () => {
            const race = await this.getRaceById(raceId);
            if (!race) return null;

            // First check direct spellcasting property
            if (race.spellcasting) return race.spellcasting;

            // Then check traits for spellcasting information
            const spellcastingTrait = race.traits?.find(trait =>
                trait.name?.toLowerCase().includes('spellcasting') ||
                (trait.entries && JSON.stringify(trait.entries).toLowerCase().includes('cast'))
            );

            if (!spellcastingTrait) return null;

            return {
                ability: this.extractSpellcastingAbility(spellcastingTrait.entries),
                innate: true, // Racial spellcasting is typically innate
                spells: this.extractSpellsFromTrait(spellcastingTrait.entries),
                daily: this.extractDailySpellsFromTrait(spellcastingTrait.entries),
                requirements: spellcastingTrait.requirements || null
            };
        }, options);
    }

    /**
     * Extract spellcasting ability from trait entries
     * @private
     */
    extractSpellcastingAbility(entries) {
        const text = JSON.stringify(entries).toLowerCase();
        if (text.includes('charisma') || text.includes('cha')) return 'cha';
        if (text.includes('intelligence') || text.includes('int')) return 'int';
        if (text.includes('wisdom') || text.includes('wis')) return 'wis';
        return 'cha'; // Default for most racial spellcasting
    }

    /**
     * Extract spells from trait entries
     * @private
     */
    extractSpellsFromTrait(entries) {
        const spells = {};
        const text = JSON.stringify(entries);

        // Common patterns for racial spells
        const spellMatches = text.match(/can cast (?:the)?\s*([^,.]+)/gi) || [];
        for (const match of spellMatches) {
            const spell = match.replace(/can cast (?:the)?\s*/i, '').trim().toLowerCase();
            if (spell && !spell.includes('at will') && !spell.includes('per day')) {
                spells[spell] = true;
            }
        }

        // Look for at-will spells
        const atWillMatches = text.match(/cast ([^,.]+) at will/gi) || [];
        for (const match of atWillMatches) {
            const spell = match.replace(/cast\s*|\s*at will/gi, '').trim().toLowerCase();
            if (spell) {
                spells[spell] = true;
            }
        }

        return spells;
    }

    /**
     * Extract daily spells from trait entries
     * @private
     */
    extractDailySpellsFromTrait(entries) {
        const daily = {};
        const text = JSON.stringify(entries);

        // Look for "X times per day" patterns
        const dailyMatches = text.match(/cast ([^,.]+) (\d+) times? per day/gi) || [];
        for (const match of dailyMatches) {
            const [_, spell, times] = match.match(/cast ([^,.]+) (\d+) times? per day/i) || [];
            if (spell && times) {
                const level = '0'; // Default to level 0 for racial spells
                if (!daily[level]) daily[level] = {};
                daily[level][spell.trim().toLowerCase()] = Number(times);
            }
        }

        return daily;
    }

    /**
     * Get races by ability score bonus with improved caching
     * @param {string} ability - Ability score (e.g., 'str', 'dex', 'con')
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of races with the specified ability score bonus
     */
    async getRacesByAbility(ability, options = {}) {
        const cacheKey = `races_ability_${ability}`;
        return this.getOrLoadData(cacheKey, async () => {
            const data = await this.loadRaces(options);
            const abilityLower = ability.toLowerCase();

            console.log(`Searching for races with ${abilityLower} bonus...`);

            return data.races.filter(race => {
                // Check if race has ability scores
                if (!race.ability || !Array.isArray(race.ability)) {
                    console.log(`Race ${race.name} has no ability scores`);
                    return false;
                }

                // Log the ability scores for debugging
                console.log(`Checking ability scores for race ${race.name}:`, race.ability);

                // Check each ability score entry
                return race.ability.some(abilityEntry => {
                    // Handle choice type
                    if (abilityEntry.choose) {
                        const hasChoice = abilityEntry.choose.from?.some(choice => {
                            const matches = choice.toLowerCase() === abilityLower;
                            if (matches) {
                                console.log(`Found ${abilityLower} in choices for ${race.name}`);
                            }
                            return matches;
                        });
                        if (hasChoice) return true;
                    }

                    // Handle direct ability score bonuses
                    const hasBonus = Object.entries(abilityEntry).some(([key, value]) => {
                        const matches = key.toLowerCase() === abilityLower && Number(value) > 0;
                        if (matches) {
                            console.log(`Found ${abilityLower} bonus of ${value} for ${race.name}`);
                        }
                        return matches;
                    });

                    return hasBonus;
                });
            });
        }, options);
    }

    /**
     * Get races by size with improved caching
     * @param {string} size - Size category (e.g., 'S', 'M', 'L')
     * @param {Object} options - Loading options
     * @returns {Promise<Array>} Array of races of the specified size
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