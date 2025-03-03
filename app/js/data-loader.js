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
    languages: null
};

/**
 * Load JSON data from a file
 * @param {string} path - Path to the JSON file
 * @returns {Promise<Object>} - Parsed JSON data
 */
async function loadJsonFile(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error loading ${path}:`, error);
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
        const raceData = await loadJsonFile('../data/races.json');
        const fluffData = await loadJsonFile('../data/fluff-races.json').catch(() => ({}));

        // Cache the data
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
        const classData = await loadJsonFile(`../data/class/class-${className.toLowerCase()}.json`);
        const fluffData = await loadJsonFile(`../data/class/fluff-class-${className.toLowerCase()}.json`).catch(() => ({}));

        // Cache the data
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
        const classIndex = await loadJsonFile('../data/class/index.json');
        const classPromises = classIndex.class.map(c => loadClass(c.name));
        await Promise.all(classPromises);
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
        const backgroundData = await loadJsonFile('../data/backgrounds.json');
        const fluffData = await loadJsonFile('../data/fluff-backgrounds.json').catch(() => ({}));

        // Cache the data
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
 * Load spell data
 * @param {string} source - Source book for spells (e.g., 'phb', 'xge')
 * @returns {Promise<Object>} - Spell data
 */
async function loadSpells(source = 'phb') {
    if (dataCache.spells[source]) {
        return dataCache.spells[source];
    }

    try {
        const spellData = await loadJsonFile(`../data/spells/spells-${source.toLowerCase()}.json`);
        const fluffData = await loadJsonFile(`../data/spells/fluff-spells-${source.toLowerCase()}.json`).catch(() => ({}));

        // Cache the data
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
        // Load base items and magic variants
        const baseItems = await loadJsonFile('../data/items-base.json');
        const magicVariants = await loadJsonFile('../data/magicvariants.json').catch(() => ({}));
        const fluffData = await loadJsonFile('../data/fluff-items.json').catch(() => ({}));

        // Cache the data
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
        const featData = await loadJsonFile('../data/feats.json');
        const fluffData = await loadJsonFile('../data/fluff-feats.json').catch(() => ({}));

        // Cache the data
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
        const languageData = await loadJsonFile('../data/languages.json');
        const fluffData = await loadJsonFile('../data/fluff-languages.json').catch(() => ({}));

        // Cache the data
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
    const raceData = await loadRaces();
    return raceData.raw.race.map(race => ({
        id: race.name.toLowerCase().replace(/\s+/g, '-'),
        name: race.name,
        source: race.source,
        size: race.size.join(', '),
        speed: typeof race.speed === 'number' ? race.speed : race.speed.walk,
        ability: race.ability,
        traits: race.entries ? race.entries.filter(entry => entry.type === 'entries').map(entry => ({
            name: entry.name,
            description: Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries
        })) : [],
        languages: race.languageProficiencies ? race.languageProficiencies.flatMap(lang =>
            Object.keys(lang).map(key => key.charAt(0).toUpperCase() + key.slice(1))
        ) : [],
        subraces: race.subraces ? race.subraces.map(subrace => ({
            id: subrace.name.toLowerCase().replace(/\s+/g, '-'),
            name: subrace.name,
            ability: subrace.ability,
            traits: subrace.entries ? subrace.entries.filter(entry => entry.type === 'entries').map(entry => ({
                name: entry.name,
                description: Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries
            })) : []
        })) : []
    }));
}

/**
 * Get all classes in a format suitable for UI display
 * @returns {Promise<Array>} - Array of class objects
 */
async function getClasses() {
    await loadAllClasses();

    const classes = [];
    for (const [className, classData] of Object.entries(dataCache.classes)) {
        if (!classData.raw.class || !classData.raw.class.length) continue;

        const classInfo = classData.raw.class[0];
        classes.push({
            id: classInfo.name.toLowerCase().replace(/\s+/g, '-'),
            name: classInfo.name,
            source: classInfo.source,
            hitDie: `d${classInfo.hd.faces}`,
            proficiencies: {
                savingThrows: classInfo.proficiency.map(prof => prof.toUpperCase()),
                armor: classInfo.startingProficiencies.armor || [],
                weapons: classInfo.startingProficiencies.weapons || [],
                tools: classInfo.startingProficiencies.tools || [],
                skills: classInfo.startingProficiencies.skills ?
                    classInfo.startingProficiencies.skills.map(skill =>
                        skill.choose ? { choose: skill.choose.count, from: skill.choose.from } : skill
                    ) : []
            },
            subclasses: classData.raw.subclass ? classData.raw.subclass.map(subclass => ({
                id: subclass.name.toLowerCase().replace(/\s+/g, '-'),
                name: subclass.name,
                source: subclass.source,
                features: subclass.subclassFeatures ? subclass.subclassFeatures.map(feature => ({
                    name: feature.name,
                    level: feature.level,
                    description: feature.entries ?
                        (Array.isArray(feature.entries) ? feature.entries.join('\n') : feature.entries) : ''
                })) : []
            })) : []
        });
    }

    return classes;
}

/**
 * Get all backgrounds in a format suitable for UI display
 * @returns {Promise<Array>} - Array of background objects
 */
async function getBackgrounds() {
    const backgroundData = await loadBackgrounds();

    return backgroundData.raw.background.map(bg => ({
        id: bg.name.toLowerCase().replace(/\s+/g, '-'),
        name: bg.name,
        source: bg.source,
        skillProficiencies: bg.skillProficiencies ?
            bg.skillProficiencies.map(prof => typeof prof === 'string' ? prof : Object.keys(prof)[0]) : [],
        toolProficiencies: bg.toolProficiencies || [],
        languages: bg.languageProficiencies ?
            bg.languageProficiencies.map(lang => typeof lang === 'string' ? lang : Object.keys(lang)[0]) : [],
        equipment: bg.startingEquipment ? bg.startingEquipment.default.map(item =>
            typeof item === 'string' ? item : item.item
        ) : [],
        features: bg.entries ? bg.entries.filter(entry => entry.type === 'entries').map(entry => ({
            name: entry.name,
            description: Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries
        })) : []
    }));
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