/**
 * data-loader.js
 * Module for loading and managing D&D data from JSON files
 */

// Cache for loaded data to avoid repeated file loading
const dataCache = {
    races: null,
    classes: {},
    backgrounds: null,
    items: null,
    spells: {},
    feats: null,
    languages: null,
    itemRefs: new Map() // Add cache for item references
};

/**
 * Resolve a JSON reference like {@tag name|source}
 * @param {string} ref - The reference string
 * @returns {Promise<string>} - The resolved reference text
 */
async function resolveJsonRef(ref) {
    // Extract the tag type and content
    const match = ref.match(/{@(\w+)\s+([^}]+)}/);
    if (!match) return ref;

    const [fullMatch, tag, content] = match;
    const [name, source = 'phb', ...rest] = content.split('|');

    // Check cache first for item references
    const cacheKey = `${tag}:${name}:${source}`;
    if (dataCache.itemRefs.has(cacheKey)) {
        return dataCache.itemRefs.get(cacheKey);
    }

    try {
        let result = name;
        switch (tag) {
            case 'variantrule': {
                const rules = (await loadJsonFile('data/variantrules.json')).variantrule;
                const rule = rules.find(r => r.name === name && (!source || r.source === source));
                if (rule) {
                    result = `${rule.name} (see Variant Rules)`;
                }
                break;
            }
            case 'condition': {
                const conditions = (await loadJsonFile('data/conditionsdiseases.json')).condition;
                const condition = conditions.find(c => c.name === name && (!source || c.source === source));
                if (condition) {
                    result = condition.name;
                }
                break;
            }
            case 'skill': {
                const skills = (await loadJsonFile('data/skills.json')).skill;
                const skill = skills.find(s => s.name === name && (!source || s.source === source));
                if (skill) {
                    result = skill.name;
                }
                break;
            }
            case 'item': {
                if (!dataCache.items) {
                    await loadItems();
                }
                const items = dataCache.items?.base?.item || [];
                const item = items.find(i => i.name.toLowerCase() === name.toLowerCase());
                if (item) {
                    result = item.name;
                }
                break;
            }
            case 'spell': {
                const spells = (await loadJsonFile(`data/spells/spells-${(source || 'phb').toLowerCase()}.json`)).spell;
                const spell = spells.find(s => s.name === name);
                if (spell) {
                    result = spell.name;
                }
                break;
            }
            case 'dice':
                result = name; // Just return the dice expression
                break;
            case 'damage':
                result = name; // Just return the damage expression
                break;
            case 'quickref':
                result = name; // Just return the reference name
                break;
            default:
                result = name; // Default to just returning the name
        }

        // Cache the result
        dataCache.itemRefs.set(cacheKey, result);
        return result;
    } catch (error) {
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
            console.warn(`Error resolving reference ${fullMatch}:`, error);
        }
        return name;
    }
}

/**
 * Process text to resolve all JSON references
 * @param {string} text - The text to process
 * @returns {Promise<string>} - The processed text with resolved references
 */
async function processText(text) {
    // Handle non-string inputs
    if (!text || typeof text !== 'string') {
        return text?.toString() || '';
    }

    // Find all JSON references in the text
    const refs = text.match(/{@\w+[^}]+}/g) || [];

    // Process each reference
    let result = text;
    for (const ref of refs) {
        const resolved = await resolveJsonRef(ref);
        result = result.replace(ref, resolved);
    }

    return result;
}

/**
 * Load JSON data from a file
 * @param {string} path - Path to the JSON file
 * @returns {Promise<Object>} - Parsed JSON data
 */
async function loadJsonFile(path) {
    try {
        // Use Electron's IPC to load the file
        if (window.electron?.invoke) {
            try {
                const data = await window.electron.invoke('read-json-file', path);
                return data;
            } catch (electronError) {
                console.error(`Error loading file via Electron: ${path}`, electronError);
                // Fall back to fetch if Electron method fails
            }
        }

        // Fall back to fetch API
        const fixedPath = path.startsWith('./') ? path : `./${path}`;
        const response = await fetch(fixedPath);
        if (!response.ok) {
            throw new Error(`Failed to load ${fixedPath}: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (parseError) {
            console.error(`Error parsing JSON from ${fixedPath}:`, parseError);
            throw parseError;
        }
    } catch (error) {
        // Try an alternative path as a fallback
        if (!path.startsWith('./data/') && !path.startsWith('data/')) {
            try {
                const altPath = `data/${path.split('/').pop()}`;
                const altResponse = await fetch(altPath);
                if (!altResponse.ok) {
                    throw new Error(`Failed to load alternative path ${altPath}`);
                }
                return await altResponse.json();
            } catch (altError) {
                console.error('Error loading alternative path:', altError);
            }
        }
        throw error;
    }
}

/**
 * Load race data
 * @returns {Promise<Object>} - Race data
 */
async function loadRaces() {
    if (dataCache.races) {
        return dataCache.races;
    }

    try {
        const raceData = await loadJsonFile('data/races.json');
        const fluffData = await loadJsonFile('data/fluff-races.json').catch(() => ({}));

        dataCache.races = {
            raw: raceData,
            fluff: fluffData
        };

        return dataCache.races;
    } catch (error) {
        console.error('Error loading race data:', error);
        throw error;
    }
}

/**
 * Load class data for a specific class
 * @param {string} className - Name of the class to load
 * @returns {Promise<Object>} - Class data
 */
async function loadClass(className) {
    if (dataCache.classes[className]) {
        return dataCache.classes[className];
    }

    try {
        const classData = await loadJsonFile(`data/class/class-${className.toLowerCase()}.json`);
        const fluffData = await loadJsonFile(`data/class/fluff-class-${className.toLowerCase()}.json`).catch(() => ({}));

        dataCache.classes[className] = {
            raw: classData,
            fluff: fluffData
        };

        return dataCache.classes[className];
    } catch (error) {
        console.error(`Error loading class data for ${className}:`, error);
        throw error;
    }
}

/**
 * Load all class data
 * @returns {Promise<Object>} - All class data
 */
async function loadAllClasses() {
    try {
        const classIndex = await loadJsonFile('data/class/index.json');
        const classNames = Object.keys(classIndex);
        await Promise.all(classNames.map(className => loadClass(className)));
        return dataCache.classes;
    } catch (error) {
        console.error('Error loading all class data:', error);
        throw error;
    }
}

/**
 * Load background data
 * @returns {Promise<Object>} - Background data
 */
async function loadBackgrounds() {
    if (dataCache.backgrounds) {
        return dataCache.backgrounds;
    }

    try {
        const backgroundData = await loadJsonFile('data/backgrounds.json');
        const fluffData = await loadJsonFile('data/fluff-backgrounds.json').catch(() => ({}));

        dataCache.backgrounds = {
            raw: backgroundData,
            fluff: fluffData
        };

        return dataCache.backgrounds;
    } catch (error) {
        console.error('Error loading background data:', error);
        throw error;
    }
}

/**
 * Load spell data for a specific source
 * @param {string} source - Source of the spells to load (e.g., 'phb')
 * @returns {Promise<Object>} - Spell data
 */
async function loadSpells(source = 'phb') {
    if (dataCache.spells[source]) {
        return dataCache.spells[source];
    }

    try {
        const spellData = await loadJsonFile(`data/spells/spells-${source.toLowerCase()}.json`);
        const fluffData = await loadJsonFile(`data/spells/fluff-spells-${source.toLowerCase()}.json`).catch(() => ({}));

        dataCache.spells[source] = {
            raw: spellData,
            fluff: fluffData
        };

        return dataCache.spells[source];
    } catch (error) {
        console.error(`Error loading spell data for ${source}:`, error);
        throw error;
    }
}

/**
 * Load item data
 * @returns {Promise<Object>} - Item data
 */
async function loadItems() {
    if (dataCache.items) {
        return dataCache.items;
    }

    try {
        const baseItems = await loadJsonFile('data/items-base.json');
        const magicVariants = await loadJsonFile('data/magicvariants.json').catch(() => ({}));
        const fluffData = await loadJsonFile('data/fluff-items.json').catch(() => ({}));

        dataCache.items = {
            base: baseItems,
            magic: magicVariants,
            fluff: fluffData
        };

        return dataCache.items;
    } catch (error) {
        console.error('Error loading item data:', error);
        throw error;
    }
}

/**
 * Load feat data
 * @returns {Promise<Object>} - Feat data
 */
async function loadFeats() {
    if (dataCache.feats) {
        return dataCache.feats;
    }

    try {
        const featData = await loadJsonFile('data/feats.json');
        const fluffData = await loadJsonFile('data/fluff-feats.json').catch(() => ({}));

        dataCache.feats = {
            raw: featData,
            fluff: fluffData
        };

        return dataCache.feats;
    } catch (error) {
        console.error('Error loading feat data:', error);
        throw error;
    }
}

/**
 * Load language data
 * @returns {Promise<Object>} - Language data
 */
async function loadLanguages() {
    if (dataCache.languages) {
        return dataCache.languages;
    }

    try {
        const languageData = await loadJsonFile('data/languages.json');
        const fluffData = await loadJsonFile('data/fluff-languages.json').catch(() => ({}));

        dataCache.languages = {
            raw: languageData,
            fluff: fluffData
        };

        return dataCache.languages;
    } catch (error) {
        console.error('Error loading language data:', error);
        throw error;
    }
}

/**
 * Get all races in a format suitable for UI display
 * @returns {Promise<Array>} - Array of race objects
 */
async function getRaces() {
    try {
        const raceData = await loadRaces();

        if (!raceData.raw || !raceData.raw.race) {
            return [];
        }

        // Filter out duplicate races and non-playable races
        const uniqueRaces = new Map();
        const subraceMap = new Map(); // Map to store subraces for each race

        for (const race of raceData.raw.race) {
            // Skip races marked as NPC races or with certain tags
            if (race.traitTags?.includes("NPC Race")) {
                continue;
            }

            // Check if this is a subrace/lineage/legacy by looking at the name pattern
            const baseRaceName = race.name.split(/[;(]/)[0].trim();
            const isVariant = race.name !== baseRaceName;

            if (isVariant) {
                // This is a variant (subrace/lineage/legacy)
                if (!subraceMap.has(baseRaceName)) {
                    subraceMap.set(baseRaceName, []);
                }
                subraceMap.get(baseRaceName).push(race);
            } else {
                // This is a base race
                const key = race.name.toLowerCase();
                const currentRace = uniqueRaces.get(key);

                // If race doesn't exist yet or this one is from PHB, add/replace it
                if (!currentRace || race.source === "PHB") {
                    uniqueRaces.set(key, race);
                }
            }
        }

        // Convert the filtered races to the format needed for UI
        const races = await Promise.all(Array.from(uniqueRaces.values()).map(async race => {
            try {
                // Extract description from entries
                let description = '';
                const traits = [];

                // Look for matching fluff data
                const fluffEntry = raceData.fluff?.raceFluff?.find(fluff =>
                    fluff.name === race.name &&
                    (fluff.source === race.source || !uniqueRaces.get(race.name.toLowerCase()))
                );

                // Process fluff entries for description
                if (fluffEntry?.entries) {
                    for (const entry of fluffEntry.entries) {
                        if (entry.type === 'entries' && entry.entries) {
                            for (const subEntry of entry.entries) {
                                if (typeof subEntry === 'string') {
                                    description += (description ? '\n\n' : '') + await processText(subEntry);
                                } else if (subEntry.type === 'entries' && !subEntry.name) {
                                    const entryText = Array.isArray(subEntry.entries)
                                        ? (await Promise.all(subEntry.entries.map(e => processText(e)))).join('\n\n')
                                        : await processText(subEntry.entries);
                                    description += (description ? '\n\n' : '') + entryText;
                                }
                            }
                        }
                    }
                }

                // Process race entries
                if (race.entries) {
                    for (const entry of race.entries) {
                        if (entry && entry.type === 'entries') {
                            // Skip entries that are already covered by standard fields
                            const skipNames = ['size', 'age', 'language', 'languages'];
                            if (entry.name && skipNames.some(name =>
                                entry.name.toLowerCase().includes(name.toLowerCase()))) {
                                continue;
                            }

                            // This is a trait
                            if (entry.name) {
                                traits.push({
                                    name: entry.name,
                                    description: Array.isArray(entry.entries)
                                        ? (await Promise.all(entry.entries.map(e => processText(e)))).join('\n')
                                        : await processText(entry.entries || 'No description')
                                });
                            }
                            // This might be a description
                            else if (!entry.name) {
                                const entryText = Array.isArray(entry.entries)
                                    ? (await Promise.all(entry.entries.map(e => processText(e)))).join('\n\n')
                                    : await processText(entry.entries || '');
                                if (!description) {
                                    description = entryText;
                                }
                            }
                        }
                    }
                }

                // Format age information
                let ageText = '';
                if (race.age) {
                    if (typeof race.age === 'string') {
                        ageText = await processText(race.age);
                    } else if (typeof race.age === 'object') {
                        if (race.age.mature && race.age.max) {
                            ageText = `Reaches maturity around ${race.age.mature} years and can live up to ${race.age.max} years.`;
                        } else {
                            const ageProps = [];
                            for (const [key, value] of Object.entries(race.age)) {
                                ageProps.push(`${key}: ${value}`);
                            }
                            ageText = ageProps.join(', ');
                        }
                    }
                }

                // Format size codes
                const sizeMap = {
                    'T': 'Tiny',
                    'S': 'Small',
                    'M': 'Medium',
                    'L': 'Large',
                    'H': 'Huge',
                    'G': 'Gargantuan'
                };

                let sizeText = '';
                if (race.size) {
                    if (Array.isArray(race.size)) {
                        sizeText = race.size.map(s => sizeMap[s] || s).join(', ');
                    } else {
                        sizeText = sizeMap[race.size] || race.size;
                    }
                }

                // Get variants (subraces/lineages/legacies) for this race
                const raceVariants = subraceMap.get(race.name) || [];
                const processedVariants = await Promise.all(raceVariants.map(async variant => {
                    const variantTraits = [];

                    // Process variant entries
                    if (variant.entries) {
                        for (const entry of variant.entries) {
                            if (entry && entry.type === 'entries' && entry.name) {
                                variantTraits.push({
                                    name: entry.name,
                                    description: Array.isArray(entry.entries)
                                        ? (await Promise.all(entry.entries.map(e => processText(e)))).join('\n')
                                        : await processText(entry.entries || 'No description')
                                });
                            }
                        }
                    }

                    // Extract variant type and name
                    const variantMatch = variant.name.match(/[;(]\s*([^)]+)/);
                    const variantName = variantMatch ? variantMatch[1].trim() : variant.name;
                    const variantType = variant.name.includes('Lineage') ? 'Lineage' :
                        variant.name.includes('Legacy') ? 'Legacy' : 'Subrace';

                    return {
                        id: variant.name.toLowerCase().replace(/\s+/g, '-'),
                        name: variantName,
                        type: variantType,
                        source: variant.source || race.source,
                        ability: variant.ability || [],
                        traits: variantTraits,
                        speed: variant.speed || race.speed,
                        size: variant.size || race.size,
                        spells: variant.spells || [],
                        innate: variant.innate || {}
                    };
                }));

                return {
                    id: race.name.toLowerCase().replace(/\s+/g, '-'),
                    name: race.name,
                    source: race.source || 'Unknown',
                    size: sizeText || 'Medium',
                    speed: typeof race.speed === 'number' ? race.speed :
                        (race.speed?.walk || 30),
                    ability: race.ability || [],
                    traits: traits,
                    description: description,
                    age: ageText,
                    languages: race.languageProficiencies ? race.languageProficiencies.flatMap(lang =>
                        lang ? Object.keys(lang).map(key => key.charAt(0).toUpperCase() + key.slice(1)) : []
                    ) : [],
                    subraces: processedVariants
                };
            } catch (error) {
                // Only log critical errors
                if (process.env.NODE_ENV === 'development') {
                    console.error(`Error processing race ${race.name || 'unknown'}:`, error);
                }
                return null;
            }
        }));

        // Filter out null entries and sort races alphabetically
        return races.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        // Only log critical errors
        if (process.env.NODE_ENV === 'development') {
            console.error('Error in getRaces:', error);
        }
        return [];
    }
}

/**
 * Get all classes in a format suitable for UI display
 * @returns {Promise<Array>} - Array of class objects
 */
async function getClasses() {
    try {
        await loadAllClasses();

        const classes = [];
        for (const [className, classData] of Object.entries(dataCache.classes)) {
            if (!classData.raw.class || !classData.raw.class.length) {
                console.warn(`Invalid class data structure for ${className}:`, classData);
                continue;
            }

            try {
                const classInfo = classData.raw.class[0];
                classes.push({
                    id: classInfo.name.toLowerCase().replace(/\s+/g, '-'),
                    name: classInfo.name,
                    source: classInfo.source || 'Unknown',
                    hitDie: classInfo.hd?.faces ? `d${classInfo.hd.faces}` : 'd8',
                    proficiencies: {
                        savingThrows: Array.isArray(classInfo.proficiency) ?
                            classInfo.proficiency.map(prof => prof.toUpperCase()) : [],
                        armor: classInfo.startingProficiencies?.armor || [],
                        weapons: classInfo.startingProficiencies?.weapons || [],
                        tools: classInfo.startingProficiencies?.tools || [],
                        skills: classInfo.startingProficiencies?.skills ?
                            classInfo.startingProficiencies.skills.map(skill =>
                                skill.choose ? { choose: skill.choose.count, from: skill.choose.from } : skill
                            ) : []
                    },
                    subclasses: classData.raw.subclass ? classData.raw.subclass.map(subclass => ({
                        id: subclass.name.toLowerCase().replace(/\s+/g, '-'),
                        name: subclass.name,
                        source: subclass.source || 'Unknown',
                        features: subclass.subclassFeatures?.map(feature => ({
                            name: feature.name || 'Feature',
                            level: feature.level || 1,
                            description: feature.entries ?
                                (Array.isArray(feature.entries) ? feature.entries.join('\n') : feature.entries) : ''
                        })) || []
                    })) : []
                });
            } catch (error) {
                console.error(`Error processing class ${className}:`, error);
                // Add a minimal valid class object to avoid breaking the UI
                classes.push({
                    id: className.toLowerCase().replace(/\s+/g, '-'),
                    name: className,
                    source: 'Unknown',
                    hitDie: 'd8',
                    proficiencies: {
                        savingThrows: [],
                        armor: [],
                        weapons: [],
                        tools: [],
                        skills: []
                    },
                    subclasses: []
                });
            }
        }

        return classes;
    } catch (error) {
        console.error('Error in getClasses:', error);
        return [];
    }
}

/**
 * Get all backgrounds in a format suitable for UI display
 * @returns {Promise<Array>} - Array of background objects
 */
async function getBackgrounds() {
    try {
        const backgroundData = await loadBackgrounds();

        if (!backgroundData.raw || !backgroundData.raw.background) {
            console.error('Invalid background data structure:', backgroundData);
            return [];
        }

        const backgrounds = backgroundData.raw.background.map(bg => {
            try {
                return {
                    id: bg.name.toLowerCase().replace(/\s+/g, '-'),
                    name: bg.name,
                    source: bg.source || 'Unknown',
                    skillProficiencies: bg.skillProficiencies ?
                        bg.skillProficiencies.map(prof =>
                            typeof prof === 'string' ? prof :
                                (prof ? Object.keys(prof)[0] : 'Unknown')
                        ) : [],
                    toolProficiencies: bg.toolProficiencies || [],
                    languages: bg.languageProficiencies ?
                        bg.languageProficiencies.map(lang =>
                            typeof lang === 'string' ? lang :
                                (lang ? Object.keys(lang)[0] : 'Unknown')
                        ) : [],
                    equipment: bg.startingEquipment?.default ?
                        bg.startingEquipment.default.map(item =>
                            typeof item === 'string' ? item :
                                (item?.item || item?.items?.join(', ') || 'Equipment')
                        ) : []
                };
            } catch (error) {
                console.error(`Error processing background ${bg.name || 'unknown'}:`, error);
                // Return a minimal valid background object to avoid breaking the UI
                return {
                    id: (bg.name || 'unknown').toLowerCase().replace(/\s+/g, '-'),
                    name: bg.name || 'Unknown Background',
                    source: bg.source || 'Unknown',
                    skillProficiencies: [],
                    toolProficiencies: [],
                    languages: [],
                    equipment: []
                };
            }
        });

        return backgrounds;
    } catch (error) {
        console.error('Error in getBackgrounds:', error);
        return [];
    }
}

// Export the functions
window.dndDataLoader = {
    loadRaces,
    loadClass,
    loadAllClasses,
    loadBackgrounds,
    loadSpells,
    loadItems,
    loadFeats,
    loadLanguages,
    getRaces,
    getClasses,
    getBackgrounds
}; 