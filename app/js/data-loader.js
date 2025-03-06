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

// Import race service
import { RaceService } from './core/services/RaceService.js';

// Initialize race service
const raceService = new RaceService();

// Import class service
import { ClassService } from './core/services/ClassService.js';
import { SpellcastingService } from './core/services/SpellcastingService.js';

// Initialize services
const classService = new ClassService();
const spellcastingService = new SpellcastingService();

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
    const [name, source = 'PHB', ...rest] = content.split('|');

    // Check cache first for item references
    const cacheKey = `${tag}:${name}:${source}`;
    if (dataCache.itemRefs.has(cacheKey)) {
        return dataCache.itemRefs.get(cacheKey);
    }

    try {
        let entity = null;
        let tooltipData = null;

        // Load and process entity
        switch (tag) {
            case 'item':
            case 'equipment':
            case 'pack': {
                const items = await loadItems();
                entity = items.find(i => i.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'background': {
                const backgrounds = await loadBackgrounds();
                entity = backgrounds.find(b => b.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'feat': {
                const feats = await loadFeats();
                entity = feats.find(f => f.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'optfeature': {
                const features = await loadOptionalFeatures();
                entity = features.find(f => f.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'class': {
                const classes = await loadAllClasses();
                for (const classData of Object.values(classes)) {
                    if (classData.raw.name.toLowerCase() === name.toLowerCase()) {
                        entity = classData.raw;
                        break;
                    }
                }
                break;
            }
            case 'subclass': {
                const classes = await loadAllClasses();
                for (const classData of Object.values(classes)) {
                    entity = classData.raw.subclasses?.find(sc =>
                        sc.name.toLowerCase() === name.toLowerCase()
                    );
                    if (entity) break;
                }
                break;
            }
            case 'race': {
                const races = await loadRaces();
                entity = races.raw.race.find(r => r.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'subrace': {
                const races = await loadRaces();
                for (const race of races.raw.race) {
                    entity = race.subraces?.find(sr =>
                        sr.name.toLowerCase() === name.toLowerCase()
                    );
                    if (entity) break;
                }
                break;
            }
            case 'spell': {
                const spells = await loadSpells(source.toLowerCase());
                entity = spells.find(s => s.name.toLowerCase() === name.toLowerCase());
                break;
            }
            case 'condition': {
                const conditions = await loadJsonFile('data/conditionsdiseases.json');
                entity = conditions.condition.find(c =>
                    c.name.toLowerCase() === name.toLowerCase() &&
                    (!source || c.source.toLowerCase() === source.toLowerCase())
                );
                break;
            }
            case 'skill': {
                const skills = await loadJsonFile('data/skills.json');
                entity = skills.skill.find(s =>
                    s.name.toLowerCase() === name.toLowerCase() &&
                    (!source || s.source.toLowerCase() === source.toLowerCase())
                );
                break;
            }
            case 'variantrule': {
                const rules = await loadJsonFile('data/variantrules.json');
                entity = rules.variantrule.find(r =>
                    r.name.toLowerCase() === name.toLowerCase() &&
                    (!source || r.source.toLowerCase() === source.toLowerCase())
                );
                break;
            }
            case 'dice':
            case 'damage':
            case 'quickref':
                return name;
        }

        // Create tooltip if entity found
        if (entity) {
            tooltipData = {
                title: entity.name,
                source: `${source}, page ${entity.page || '??'}`
            };

            // Add type-specific tooltip data
            switch (tag) {
                case 'item':
                case 'equipment':
                    tooltipData.description = await processText(entity.entries?.[0] || '');
                    tooltipData.properties = entity.property;
                    tooltipData.value = entity.value;
                    tooltipData.weight = entity.weight;
                    tooltipData.attunement = entity.reqAttune;
                    break;
                case 'pack':
                    tooltipData.description = await processText(entity.entries?.[0] || '');
                    tooltipData.contents = entity.items;
                    break;
                case 'feat':
                    tooltipData.description = await processText(entity.entries?.[0] || '');
                    tooltipData.prerequisite = entity.prerequisite;
                    tooltipData.ability = entity.ability;
                    break;
                case 'optfeature':
                    tooltipData.description = await processText(entity.entries?.[0] || '');
                    tooltipData.featureType = entity.featureType;
                    tooltipData.prerequisite = entity.prerequisite;
                    break;
                case 'class':
                    tooltipData.description = await processText(entity.entries?.[0] || '');
                    tooltipData.hitDice = `${entity.hd.number}d${entity.hd.faces}`;
                    tooltipData.spellcasting = entity.spellcasting?.ability;
                    break;
                case 'subclass':
                    tooltipData.description = await processText(entity.entries?.[0] || '');
                    tooltipData.parentClass = entity.className;
                    tooltipData.spellcasting = entity.spellcasting?.ability;
                    break;
                case 'race':
                    tooltipData.description = await processText(entity.entries?.[0] || '');
                    tooltipData.size = entity.size;
                    tooltipData.speed = entity.speed;
                    tooltipData.ability = entity.ability;
                    break;
                case 'subrace':
                    tooltipData.description = await processText(entity.entries?.[0] || '');
                    tooltipData.parentRace = entity.raceName;
                    tooltipData.ability = entity.ability;
                    break;
                case 'spell':
                    tooltipData.description = await processText(entity.entries?.[0] || '');
                    tooltipData.level = entity.level;
                    tooltipData.school = entity.school;
                    tooltipData.time = `${entity.time?.[0]?.number} ${entity.time?.[0]?.unit}`;
                    tooltipData.range = `${entity.range?.distance?.amount} ${entity.range?.distance?.type}`;
                    tooltipData.duration = entity.duration?.[0]?.type === 'timed' ?
                        `${entity.duration[0].duration.amount} ${entity.duration[0].duration.type}` :
                        entity.duration?.[0]?.type;
                    break;
                case 'condition':
                case 'skill':
                case 'variantrule':
                    tooltipData.description = await processText(entity.entries?.[0] || '');
                    break;
            }
        }

        // Create tooltip element
        const result = tooltipData ?
            createTooltipElement(tag, name, tooltipData) :
            name;

        // Cache and return
        dataCache.itemRefs.set(cacheKey, result);
        return result;
    } catch (error) {
        console.warn(`Error resolving reference ${fullMatch}:`, error);
        return name;
    }
}

/**
 * Create a tooltip element
 * @param {string} type - The type of entity
 * @param {string} text - The text to display
 * @param {Object} data - The tooltip data
 * @returns {string} - HTML string for the tooltip element
 */
function createTooltipElement(type, text, data) {
    let tooltipContent = `
        <div class="tooltip-title">${data.title}</div>
        ${data.description ? `<div class="tooltip-content">${data.description}</div>` : ''}
    `;

    // Add type-specific content
    switch (type) {
        case 'item':
        case 'equipment':
            if (data.properties?.length) {
                tooltipContent += `<div class="tooltip-content">Properties: ${data.properties.join(', ')}</div>`;
            }
            if (data.value) {
                tooltipContent += `<div class="tooltip-content">Value: ${data.value} gp</div>`;
            }
            if (data.weight) {
                tooltipContent += `<div class="tooltip-content">Weight: ${data.weight} lb.</div>`;
            }
            if (data.attunement) {
                tooltipContent += `<div class="tooltip-content">Requires Attunement</div>`;
            }
            break;
        case 'pack':
            if (data.contents?.length) {
                tooltipContent += `
                    <div class="tooltip-content">
                        Contents:<br>
                        ${data.contents.map(item =>
                    `• ${item.quantity || 1}× ${item.name}`
                ).join('<br>')}
                    </div>
                `;
            }
            break;
        case 'feat':
            if (data.prerequisite) {
                tooltipContent += `<div class="tooltip-content">Prerequisites: ${data.prerequisite}</div>`;
            }
            if (data.ability) {
                tooltipContent += `<div class="tooltip-content">Ability Score Improvement: ${data.ability}</div>`;
            }
            break;
        case 'optfeature':
            if (data.featureType) {
                tooltipContent += `<div class="tooltip-content">Type: ${data.featureType}</div>`;
            }
            if (data.prerequisite) {
                tooltipContent += `<div class="tooltip-content">Prerequisites: ${data.prerequisite}</div>`;
            }
            break;
        case 'class':
            tooltipContent += `<div class="tooltip-content">Hit Dice: ${data.hitDice}</div>`;
            if (data.spellcasting) {
                tooltipContent += `<div class="tooltip-content">Spellcasting Ability: ${data.spellcasting}</div>`;
            }
            break;
        case 'subclass':
            if (data.parentClass) {
                tooltipContent += `<div class="tooltip-content">Class: ${data.parentClass}</div>`;
            }
            if (data.spellcasting) {
                tooltipContent += `<div class="tooltip-content">Spellcasting Ability: ${data.spellcasting}</div>`;
            }
            break;
        case 'race':
            tooltipContent += `<div class="tooltip-content">Size: ${data.size}</div>`;
            if (data.speed) {
                tooltipContent += `<div class="tooltip-content">Speed: ${data.speed} feet</div>`;
            }
            if (data.ability) {
                tooltipContent += `<div class="tooltip-content">Ability Score Increase: ${data.ability}</div>`;
            }
            break;
        case 'subrace':
            if (data.parentRace) {
                tooltipContent += `<div class="tooltip-content">Race: ${data.parentRace}</div>`;
            }
            if (data.ability) {
                tooltipContent += `<div class="tooltip-content">Ability Score Increase: ${data.ability}</div>`;
            }
            break;
        case 'spell':
            tooltipContent += `
                <div class="tooltip-content">
                    Level ${data.level} ${data.school}<br>
                    Casting Time: ${data.time}<br>
                    Range: ${data.range}<br>
                    Duration: ${data.duration}
                </div>
            `;
            break;
    }

    // Add source
    if (data.source) {
        tooltipContent += `<div class="tooltip-source">${data.source}</div>`;
    }

    return `<span class="reference-link ${type}-reference" data-tooltip="${encodeURIComponent(tooltipContent)}">${text}</span>`;
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
 * Process an entity and its fluff data into a standardized format
 * @param {Object} entity - The entity data to process
 * @param {string} type - The type of entity (race, class, item, etc.)
 * @param {Object} fluff - Optional fluff data for the entity
 * @returns {Promise<Object>} - The processed entity data
 */
async function processEntityData(entity, type, fluff = null) {
    // Generate a unique ID based on name and source
    const id = entity.id || `${entity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(entity.source || 'phb').toLowerCase()}`;

    // Process the entity data
    const processed = {
        ...entity,
        id,
        type: type || 'unknown',
        // Add fluff data if available
        fluff: fluff ? {
            entries: fluff.entries,
            images: fluff.images
        } : null
    };

    return processed;
}

/**
 * Process proficiencies from an entity
 * @param {Object} entity - The entity containing proficiency data
 * @returns {Object} - Processed proficiency data
 */
function processProficiencies(entity) {
    return {
        skills: processSkillProficiencies(entity.skillProficiencies),
        tools: processToolProficiencies(entity.toolProficiencies),
        languages: processLanguageProficiencies(entity.languageProficiencies),
        weapons: entity.weaponProficiencies || [],
        armor: entity.armorProficiencies || []
    };
}

/**
 * Process skill proficiencies
 * @param {Object|Array} proficiencies - The skill proficiency data
 * @returns {Object} - Processed skill proficiency data
 */
function processSkillProficiencies(proficiencies) {
    if (!proficiencies) return { fixed: [], choices: [] };

    return {
        fixed: Array.isArray(proficiencies) ? proficiencies : [],
        choices: proficiencies?.choose ? [{
            count: proficiencies.choose.count || 1,
            from: proficiencies.choose.from || []
        }] : []
    };
}

/**
 * Process tool proficiencies
 * @param {Object|Array} proficiencies - The tool proficiency data
 * @returns {Object} - Processed tool proficiency data
 */
function processToolProficiencies(proficiencies) {
    if (!proficiencies) return { fixed: [], choices: [] };

    return {
        fixed: Array.isArray(proficiencies) ? proficiencies : [],
        choices: proficiencies?.choose ? [{
            count: proficiencies.choose.count || 1,
            from: proficiencies.choose.from || []
        }] : []
    };
}

/**
 * Process language proficiencies
 * @param {Object|Array} proficiencies - The language proficiency data
 * @returns {Object} - Processed language proficiency data
 */
function processLanguageProficiencies(proficiencies) {
    if (!proficiencies) return { fixed: [], choices: [] };

    return {
        fixed: Array.isArray(proficiencies) ? proficiencies : [],
        choices: proficiencies?.choose ? [{
            count: proficiencies.choose.count || 1,
            from: proficiencies.choose.from || []
        }] : []
    };
}

/**
 * Process value data
 * @param {number|string} value - The value to process
 * @returns {Object} - Processed value data
 */
function processValue(value) {
    if (!value) return { amount: 0, coin: 'gp' };
    if (typeof value === 'number') return { amount: value, coin: 'gp' };

    const match = String(value).match(/(\d+)\s*([a-z]{2})/i);
    return match ? {
        amount: Number.parseInt(match[1]),
        coin: match[2].toLowerCase()
    } : { amount: 0, coin: 'gp' };
}

/**
 * Process properties data
 * @param {Array|Object} properties - The properties to process
 * @returns {Array} - Processed properties
 */
function processProperties(properties) {
    if (!properties) return [];
    return Array.isArray(properties) ? properties : [properties];
}

/**
 * Process attunement requirements
 * @param {boolean|string} reqAttune - The attunement requirement
 * @returns {Object} - Processed attunement data
 */
function processAttunement(reqAttune) {
    if (!reqAttune) return false;
    if (reqAttune === true) return true;
    return {
        required: true,
        by: typeof reqAttune === 'string' ? reqAttune : null
    };
}

/**
 * Process ability score increases
 * @param {Object} ability - The ability score data
 * @returns {Object} - Processed ability score data
 */
function processAbilityScoreIncrease(ability) {
    if (!ability) return null;

    return ability.map(a => ({
        scores: a.improve?.map(i => i.abilityScore) || [],
        amount: a.improve?.[0]?.amount || 1,
        mode: a.mode || 'fixed'
    }));
}

/**
 * Process speed data
 * @param {Object|number} speed - The speed data
 * @returns {Object} - Processed speed data
 */
function processSpeed(speed) {
    if (typeof speed === 'number') return { walk: speed };
    if (!speed) return { walk: 30 };

    return Object.entries(speed).reduce((acc, [type, value]) => {
        acc[type] = value === true ? 30 : value;
        return acc;
    }, {});
}

/**
 * Process features data
 * @param {Array} features - The features data
 * @returns {Promise<Array>} - Processed features data
 */
async function processFeatures(features) {
    if (!features) return [];

    return Promise.all(features.map(async level => ({
        level: level.level,
        features: await Promise.all(level.features.map(async feature => ({
            name: feature.name,
            description: await processText(feature.entries)
        })))
    })));
}

/**
 * Process spellcasting data
 * @param {Object} spellcasting - The spellcasting data
 * @returns {Object} - Processed spellcasting data
 */
function processSpellcasting(spellcasting) {
    if (!spellcasting) return null;

    return {
        ability: spellcasting.ability,
        progression: spellcasting.progression || 'full',
        cantripProgression: spellcasting.cantripProgression || [0, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        spellsKnownProgression: spellcasting.spellsKnownProgression || null,
        spellsKnownProgressionFixed: spellcasting.spellsKnownProgressionFixed || false,
        spellsKnownProgressionType: spellcasting.spellsKnownProgressionType || null
    };
}

/**
 * Process traits data
 * @param {Array} traits - The traits data
 * @returns {Promise<Array>} - Processed traits data
 */
async function processTraits(traits) {
    if (!traits) return [];

    return Promise.all(traits.map(async trait => ({
        name: trait.name,
        description: await processText(trait.entries)
    })));
}

/**
 * Process spells data
 * @param {Array} spells - The spells data
 * @returns {Array} - Processed spells data
 */
function processSpells(spells) {
    if (!spells) return [];

    return spells.map(spell => ({
        ability: spell.ability,
        innate: Object.entries(spell.innate || {}).flatMap(([level, spellData]) => {
            if (typeof spellData === 'object') {
                return Object.entries(spellData).map(([uses, spellList]) => ({
                    level: Number.parseInt(level),
                    uses: uses === 'will' ? -1 : Number.parseInt(uses),
                    spells: spellList
                }));
            }
            return {
                level: Number.parseInt(level),
                uses: -1,
                spells: spellData
            };
        })
    }));
}

/**
 * Process starting equipment data
 * @param {Object} equipment - The starting equipment data
 * @returns {Object} - Processed starting equipment data
 */
function processStartingEquipment(equipment) {
    if (!equipment) return { default: [], choices: [] };

    return {
        default: equipment.default || [],
        choices: equipment.choices?.map(choice => ({
            count: choice.count || 1,
            items: choice.items || []
        })) || []
    };
}

/**
 * Process characteristics data
 * @param {Object} entity - The entity containing characteristics data
 * @returns {Promise<Object>} - Processed characteristics data
 */
async function processCharacteristics(entity) {
    if (!entity.characteristics) return null;

    return {
        personalityTraits: await Promise.all((entity.characteristics.personalityTraits || []).map(processText)),
        ideals: await Promise.all((entity.characteristics.ideals || []).map(processText)),
        bonds: await Promise.all((entity.characteristics.bonds || []).map(processText)),
        flaws: await Promise.all((entity.characteristics.flaws || []).map(processText))
    };
}

/**
 * Process pack contents
 * @param {Array} items - The pack items data
 * @returns {Promise<Array>} - Processed pack contents data
 */
async function processPackContents(items) {
    if (!items) return [];

    return Promise.all(items.map(async item => ({
        name: item.name,
        quantity: item.quantity || 1,
        description: await processText(item.entries?.[0] || '')
    })));
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
        // Load all item-related data
        const [baseItems, items, magicVariants, fluffData] = await Promise.all([
            loadJsonFile('data/items-base.json'),
            loadJsonFile('data/items.json'),
            loadJsonFile('data/magicvariants.json').catch(() => ({})),
            loadJsonFile('data/fluff-items.json').catch(() => ({}))
        ]);

        const processedItems = [];

        // Helper function to process items from a collection
        const processItemCollection = async (itemCollection, source = 'unknown') => {
            // Convert to array if necessary
            const itemArray = Array.isArray(itemCollection) ? itemCollection : Object.values(itemCollection);

            for (const item of itemArray) {
                try {
                    // Skip items without a name
                    if (!item.name) continue;

                    const fluff = fluffData.itemFluff?.find(f =>
                        f.name === item.name && f.source === item.source
                    );

                    const processed = await processEntityData(item, 'item', fluff);
                    processedItems.push(processed);
                } catch (err) {
                    console.warn(`Error processing item ${item.name}:`, err);
                }
            }
        };

        // Process base items
        if (baseItems.baseitem) {
            await processItemCollection(baseItems.baseitem, 'base');
        }

        // Process items from items.json
        if (items.item) {
            await processItemCollection(items.item, 'item');
        }

        // Process magic variants
        if (magicVariants.magicvariant) {
            for (const variant of magicVariants.magicvariant) {
                try {
                    // Skip variants without a name
                    if (!variant.name) continue;

                    const fluff = fluffData.itemFluff?.find(f =>
                        f.name === variant.name && f.source === variant.source
                    );

                    // Process the base variant
                    const processed = await processEntityData({
                        ...variant,
                        magical: true,
                        type: variant.type || 'MI'  // MI for magic items
                    }, 'item', fluff);
                    processedItems.push(processed);

                    // Create individual entries for variants if required
                    if (variant.requires && variant.requires.length > 0) {
                        for (const req of variant.requires) {
                            const variantItem = {
                                ...variant,
                                name: `${variant.name} (${req.type})`,
                                parentName: variant.name,
                                parentSource: variant.source,
                                type: req.type,
                                magical: true
                            };
                            const processedVariant = await processEntityData(variantItem, 'item', fluff);
                            processedItems.push(processedVariant);
                        }
                    }
                } catch (err) {
                    console.warn(`Error processing variant ${variant.name}:`, err);
                }
            }
        }

        // Cache and return processed items
        dataCache.items = processedItems;
        return processedItems;
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
            // Skip races marked as NPC races
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
                // Process base race data...
                const baseRaceData = await processRaceData(race);

                // Special handling for elves and tieflings
                if (race.name.toLowerCase() === 'elf') {
                    // Add standard subraces if not present
                    const standardSubraces = [
                        { name: 'High Elf', ability: { intelligence: 1 } },
                        { name: 'Wood Elf', ability: { wisdom: 1 } },
                        { name: 'Dark Elf', ability: { charisma: 1 } },
                        { name: 'Eladrin', ability: { charisma: 1 } },
                        { name: 'Sea Elf', ability: { constitution: 1 } },
                        { name: 'Shadar-kai', ability: { constitution: 1 } }
                    ];

                    // Get existing subraces
                    const existingSubraces = subraceMap.get(race.name) || [];

                    // Add standard subraces if they don't exist
                    for (const subrace of standardSubraces) {
                        if (!existingSubraces.some(sr => sr.name.toLowerCase().includes(subrace.name.toLowerCase()))) {
                            existingSubraces.push({
                                name: subrace.name,
                                source: 'PHB',
                                ability: subrace.ability,
                                entries: [{
                                    type: 'entries',
                                    name: subrace.name,
                                    entries: [`${subrace.name} variant`]
                                }]
                            });
                        }
                    }
                    subraceMap.set(race.name, existingSubraces);
                } else if (race.name.toLowerCase() === 'tiefling') {
                    // Add infernal legacy variants if not present
                    const infernalVariants = [
                        { name: 'Asmodeus', ability: { charisma: 2, intelligence: 1 } },
                        { name: 'Mephistopheles', ability: { charisma: 2, intelligence: 1 } },
                        { name: 'Zariel', ability: { charisma: 2, strength: 1 } },
                        { name: 'Baalzebul', ability: { charisma: 2, intelligence: 1 } },
                        { name: 'Dispater', ability: { charisma: 2, dexterity: 1 } },
                        { name: 'Fierna', ability: { charisma: 2, wisdom: 1 } },
                        { name: 'Glasya', ability: { charisma: 2, dexterity: 1 } },
                        { name: 'Levistus', ability: { charisma: 2, constitution: 1 } },
                        { name: 'Mammon', ability: { charisma: 2, intelligence: 1 } }
                    ];

                    // Get existing variants
                    const existingVariants = subraceMap.get(race.name) || [];

                    // Add infernal variants if they don't exist
                    for (const variant of infernalVariants) {
                        if (!existingVariants.some(v => v.name.toLowerCase().includes(variant.name.toLowerCase()))) {
                            existingVariants.push({
                                name: variant.name,
                                source: 'MToF',
                                ability: variant.ability,
                                entries: [{
                                    type: 'entries',
                                    name: variant.name,
                                    entries: [`${variant.name} bloodline variant`]
                                }]
                            });
                        }
                    }
                    subraceMap.set(race.name, existingVariants);
                } else if (race.name.toLowerCase() === 'dragonborn') {
                    // Add dragonborn variants
                    const dragonTypes = {
                        'Chromatic': [
                            { name: 'Black', damageType: 'acid' },
                            { name: 'Blue', damageType: 'lightning' },
                            { name: 'Green', damageType: 'poison' },
                            { name: 'Red', damageType: 'fire' },
                            { name: 'White', damageType: 'cold' }
                        ],
                        'Metallic': [
                            { name: 'Brass', damageType: 'fire' },
                            { name: 'Bronze', damageType: 'lightning' },
                            { name: 'Copper', damageType: 'acid' },
                            { name: 'Gold', damageType: 'fire' },
                            { name: 'Silver', damageType: 'cold' }
                        ],
                        'Gem': [
                            { name: 'Amethyst', damageType: 'force' },
                            { name: 'Crystal', damageType: 'radiant' },
                            { name: 'Emerald', damageType: 'psychic' },
                            { name: 'Sapphire', damageType: 'thunder' },
                            { name: 'Topaz', damageType: 'necrotic' }
                        ]
                    };

                    // Get existing variants
                    const existingVariants = subraceMap.get(race.name) || [];

                    // Add dragon variants if they don't exist
                    for (const [type, dragons] of Object.entries(dragonTypes)) {
                        for (const dragon of dragons) {
                            const variantName = `${type} (${dragon.name})`;
                            if (!existingVariants.some(v => v.name.toLowerCase() === variantName.toLowerCase())) {
                                existingVariants.push({
                                    name: variantName,
                                    source: type === 'Gem' ? 'FToD' : 'PHB',
                                    ability: type === 'Gem' ?
                                        { intelligence: 2, charisma: 1 } :
                                        { strength: 2, charisma: 1 },
                                    entries: [{
                                        type: 'entries',
                                        name: variantName,
                                        entries: [`${type} dragonborn with ${dragon.damageType} breath weapon`]
                                    }]
                                });
                            }
                        }
                    }
                    subraceMap.set(race.name, existingVariants);
                } else if (race.name.toLowerCase() === 'genasi') {
                    // Add genasi variants
                    const genasiTypes = [
                        { name: 'Air', ability: { dexterity: 1, constitution: 2 } },
                        { name: 'Earth', ability: { strength: 1, constitution: 2 } },
                        { name: 'Fire', ability: { intelligence: 1, constitution: 2 } },
                        { name: 'Water', ability: { wisdom: 1, constitution: 2 } }
                    ];

                    // Get existing variants
                    const existingVariants = subraceMap.get(race.name) || [];

                    // Add genasi variants if they don't exist
                    for (const variant of genasiTypes) {
                        if (!existingVariants.some(v => v.name.toLowerCase().includes(variant.name.toLowerCase()))) {
                            existingVariants.push({
                                name: variant.name,
                                source: 'EEPC',
                                ability: variant.ability,
                                entries: [{
                                    type: 'entries',
                                    name: variant.name,
                                    entries: [`${variant.name} Genasi variant`]
                                }]
                            });
                        }
                    }
                    subraceMap.set(race.name, existingVariants);
                } else if (race.name.toLowerCase() === 'aasimar') {
                    // Add aasimar variants
                    const aasimarTypes = [
                        { name: 'Protector', ability: { wisdom: 1, charisma: 2 } },
                        { name: 'Scourge', ability: { constitution: 1, charisma: 2 } },
                        { name: 'Fallen', ability: { strength: 1, charisma: 2 } }
                    ];

                    // Get existing variants
                    const existingVariants = subraceMap.get(race.name) || [];

                    // Add aasimar variants if they don't exist
                    for (const variant of aasimarTypes) {
                        if (!existingVariants.some(v => v.name.toLowerCase().includes(variant.name.toLowerCase()))) {
                            existingVariants.push({
                                name: variant.name,
                                source: 'VGM',
                                ability: variant.ability,
                                entries: [{
                                    type: 'entries',
                                    name: variant.name,
                                    entries: [`${variant.name} Aasimar variant`]
                                }]
                            });
                        }
                    }
                    subraceMap.set(race.name, existingVariants);
                }

                // Get variants/subraces for this race
                const variants = subraceMap.get(race.name) || [];
                const processedVariants = await Promise.all(variants.map(async variant => {
                    // Extract just the subrace name without the base race name and parentheses
                    const fullName = variant.name;
                    const nameMatch = fullName.match(/\(([^)]+)\)/);
                    const displayName = nameMatch ? nameMatch[1] : fullName.replace(race.name, '').trim();

                    const processedVariant = await processRaceData(variant, true);
                    return {
                        ...processedVariant,
                        name: displayName // Use the cleaned up name
                    };
                }));

                return {
                    ...baseRaceData,
                    subraces: processedVariants
                };
            } catch (error) {
                console.error(`Error processing race ${race.name}:`, error);
                return null;
            }
        }));

        // Filter out null entries and sort alphabetically
        return races.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error('Error in getRaces:', error);
        return [];
    }
}

// Helper function to process race data
async function processRaceData(race, isVariant = false) {
    const description = race.entries ? await processText(race.entries[0]) : '';

    const languages = race.languageProficiencies
        ? race.languageProficiencies.flatMap(lang =>
            lang ? Object.keys(lang).map(key => key.charAt(0).toUpperCase() + key.slice(1)) : []
        )
        : [];

    return {
        id: race.name.toLowerCase().replace(/\s+/g, '-'),
        name: race.name,
        source: race.source || 'PHB',
        description: description || `${race.name} race`,
        ability: race.ability || [],
        size: race.size || 'M',
        speed: race.speed || 30,
        languages,
        darkvision: race.darkvision || 0,
        resistances: race.resist || [],
        isVariant: isVariant
    };
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