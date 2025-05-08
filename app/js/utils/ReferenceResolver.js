/**
 * ReferenceResolver.js
 * Handle inline reference conversion and tooltip creation for dataLoader content.
 * Provides a centralized system for resolving D&D game content references in text
 * and generating tooltips with detailed information.
 * 
 * @typedef {Object} SkillData
 * @property {string} name - The name of the skill
 * @property {string} ability - The associated ability score
 * @property {string} entries - The skill's description
 * @property {number} [page] - The page number in the source book
 * 
 * @typedef {Object} TooltipData
 * @property {string} title - The tooltip title
 * @property {string} description - The tooltip description
 * @property {string} [source] - The source book and page
 * @property {string} [type] - The type of tooltip (spell, item, etc.)
 * @property {string} [ability] - For skills, the associated ability score
 * @property {string} [time] - For actions, the time required
 * @property {string} [size] - For objects, the size category
 * @property {string} [objectType] - For objects, the type of object
 * @property {string} [level] - For spells, the spell level
 * @property {string} [school] - For spells, the school of magic
 * @property {string} [castingTime] - For spells, the casting time
 * @property {string} [range] - For spells, the spell range
 * @property {string} [components] - For spells, the spell components
 * @property {string} [duration] - For spells, the spell duration
 * @property {string} [rarity] - For items, the item rarity
 * @property {string} [value] - For items, the item value
 * @property {string} [weight] - For items, the item weight
 * @property {string[]} [properties] - For items, the item properties
 * @property {boolean} [attunement] - For items, whether attunement is required
 * 
 * @typedef {Object} ReferenceEntry
 * @property {string} [name] - The entry name
 * @property {string|string[]} [entries] - The entry content
 * @property {string} [type] - The entry type (list, entries, etc.)
 * @property {Object[]} [items] - For list type entries, the list items
 * @property {string} [caption] - For table type entries, the table caption
 * @property {Array<Array<string>>} [rows] - For table type entries, the table rows
 */

import { dataLoader } from '../dataloaders/DataLoader.js';

/**
 * Class responsible for resolving references and creating tooltips in the D&D Character Creator.
 * Handles various types of game content references including spells, items, races, classes,
 * and other game elements.
 */
class ReferenceResolver {
    /**
     * Creates a new ReferenceResolver instance
     * @param {DataLoader} dataLoader - The data loader instance for fetching data
     * @throws {Error} If dataLoader is not provided
     */
    constructor(dataLoader) {
        if (!dataLoader) {
            throw new Error('DataLoader is required for ReferenceResolver');
        }

        /**
         * The data loader instance used to fetch game data
         * @type {DataLoader}
         * @private
         */
        this._dataLoader = dataLoader;

        /**
         * Cache for resolved references to improve performance
         * @type {Map<string, TooltipData>}
         * @private
         */
        this._cache = new Map();

        /**
         * Cache for skill data
         * @type {Map<string, SkillData>|null}
         * @private
         */
        this._skillData = null;

        /**
         * Set of references currently being processed to prevent circular references
         * @type {Set<string>}
         * @private
         */
        this._processingRefs = new Set();

        /**
         * Set of circular references already logged to prevent console spam
         * @type {Set<string>}
         * @private
         */
        this._loggedCircularRefs = new Set();
    }

    //-------------------------------------------------------------------------
    // Initialization & Data Loading
    //-------------------------------------------------------------------------

    /**
     * Loads and caches skill data from the skills.json file
     * @returns {Promise<Map<string, SkillData>>} A map of skill names to their data
     */
    async loadSkillData() {
        try {
            // Return cached data if available
            if (this._skillData) {
                return this._skillData;
            }

            const response = await fetch('data/skills.json');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !Array.isArray(data.skill)) {
                throw new Error('Invalid skill data format');
            }

            this._skillData = new Map(data.skill.map(s => [s.name.toLowerCase(), s]));

            return this._skillData;
        } catch (error) {
            console.error('Error loading skill data:', error);
            // Return empty map as fallback
            return new Map();
        }
    }

    /**
     * Clears all cached data and processing state
     */
    clearCache() {
        try {
            this._cache.clear();
            this._skillData = null;
            this._processingRefs.clear();
            this._loggedCircularRefs.clear();
        } catch (error) {
            console.error('Error clearing ReferenceResolver cache:', error);
        }
    }

    //-------------------------------------------------------------------------
    // Reference Resolution - Spells
    //-------------------------------------------------------------------------

    /**
     * Handles spell reference resolution
     * @param {string} name - The spell name
     * @param {string} source - The source book
     * @returns {Promise<TooltipData>} The tooltip data for the spell
     * @private
     */
    async _handleSpellRef(name, source) {
        try {
            if (!name) {
                console.warn('Empty spell name provided to reference resolver');
                return {
                    title: 'Unknown Spell',
                    description: 'No spell details available.',
                    source: source || 'Unknown source'
                };
            }

            // Attempt to load spell data
            const spellsData = await this._dataLoader.loadSpells();
            const spells = spellsData?.spell || [];
            const fluff = spellsData?.fluff || [];

            // Find matching spell by name (case-insensitive)
            const entity = spells.find(s => s?.name?.toLowerCase() === name.toLowerCase());

            if (!entity) {
                return {
                    title: name,
                    description: 'Spell details not found.',
                    source: source || 'Unknown source'
                };
            }

            let description = '';
            if (Array.isArray(entity.entries)) {
                description = entity.entries
                    .map(entry => {
                        if (typeof entry === 'string') return entry;
                        if (entry.type === 'list') {
                            return entry.items.map(item => {
                                if (typeof item === 'string') return item;
                                return `${item.name}: ${item.entries.join('\n')}`;
                            }).join('\n');
                        }
                        if (entry.type === 'entries') {
                            return entry.entries.join('\n');
                        }
                        return '';
                    })
                    .filter(Boolean)
                    .join('\n\n');
            }

            // Add fluff if available
            if (Array.isArray(fluff?.entries)) {
                const fluffText = fluff.entries
                    .map(entry => {
                        if (typeof entry === 'string') return entry;
                        if (entry.type === 'entries') return entry.entries.join('\n');
                        return '';
                    })
                    .filter(Boolean)
                    .join('\n\n');

                if (fluffText) {
                    description = `${description}\n\n${fluffText}`;
                }
            }

            return {
                title: entity.name,
                description: description || 'No description available.',
                level: entity.level,
                school: entity.school,
                castingTime: entity.time?.[0] ? `${entity.time[0].number} ${entity.time[0].unit}` : 'Unknown',
                range: this._formatSpellRange(entity.range),
                components: this._formatSpellComponents(entity.components),
                duration: this._formatSpellDuration(entity.duration),
                source: `${source || entity.source}, page ${entity.page || '??'}`
            };
        } catch (error) {
            console.error(`Error resolving spell reference for "${name}":`, error);
            return {
                title: name || 'Unknown Spell',
                description: 'An error occurred while loading spell details.',
                source: source || 'Unknown source'
            };
        }
    }

    //-------------------------------------------------------------------------
    // Reference Resolution - Items
    //-------------------------------------------------------------------------

    /**
     * Handles item reference resolution
     * @param {string} name - The item name
     * @param {string} source - The source book
     * @returns {Promise<TooltipData|null>} The tooltip data for the item, or null if not found
     * @private
     */
    async _handleItemRef(name, source) {
        try {
            if (!name) {
                console.warn('Empty item name provided to reference resolver');
                return null;
            }

            // Load item data
            const itemsData = await this._dataLoader.loadItems();
            const items = itemsData.item || [];
            const baseItems = itemsData.baseitem || [];
            const fluff = itemsData.fluff || [];

            // Find the item in regular items or base items
            const entity = items.find(i => i.name.toLowerCase() === name.toLowerCase()) ||
                baseItems.find(i => i.name.toLowerCase() === name.toLowerCase());

            // Find matching fluff information
            const itemFluff = fluff.find(f => f.name.toLowerCase() === name.toLowerCase());

            if (!entity) {
                return null;
            }

            // Map for item types
            const typeMap = {
                'T': 'Tool',
                'G': 'Gaming Set',
                'AT': 'Artisan\'s Tools',
                'INS': 'Instrument',
                'GS': 'General Store Item',
                'SCF': 'Spellcasting Focus',
                'A': 'Ammunition',
                'M': 'Melee Weapon',
                'R': 'Ranged Weapon',
                'LA': 'Light Armor',
                'MA': 'Medium Armor',
                'HA': 'Heavy Armor',
                'S': 'Shield',
                'P': 'Potion',
                'SC': 'Scroll',
                'W': 'Wondrous Item',
                'RD': 'Rod',
                'ST': 'Staff',
                'WD': 'Wand',
                'RG': 'Ring',
                'OTH': 'Other'
            };

            let description = this._formatItemDescription(entity, itemFluff);

            // Add weapon properties if it's a weapon
            if (entity.weapon) {
                const properties = [];
                if (entity.dmg1) properties.push(`Damage: ${entity.dmg1} ${entity.dmgType}`);
                if (entity.dmg2) properties.push(`Versatile: ${entity.dmg2}`);
                if (entity.property) {
                    const propertyMap = {
                        'A': 'Ammunition',
                        'F': 'Finesse',
                        'H': 'Heavy',
                        'L': 'Light',
                        'LD': 'Loading',
                        'R': 'Reach',
                        'S': 'Special',
                        'T': 'Thrown',
                        'V': 'Versatile',
                        '2H': 'Two-Handed'
                    };
                    properties.push(...entity.property.map(p => propertyMap[p] || p));
                }
                if (properties.length > 0) {
                    description = `${description}\n\n${properties.join('\n')}`;
                }
            }

            return {
                title: entity.name,
                description: description,
                type: typeMap[entity.type] || entity.type,
                rarity: entity.rarity === 'none' ? 'Common' : (entity.rarity || 'Common'),
                value: entity.value ? `${entity.value / 100} gp` : 'No value listed',
                weight: entity.weight ? `${entity.weight} lb.` : 'No weight listed',
                properties: entity.properties,
                attunement: entity.reqAttune,
                source: `${source || entity.source}, page ${entity.page || '??'}`
            };
        } catch (error) {
            console.error(`Error resolving item reference for "${name}":`, error);
            return null;
        }
    }

    /**
     * Formats item description including entries, additional entries, and fluff
     * @param {Object} entity - The item entity
     * @param {Object} itemFluff - The item's fluff data
     * @returns {string} The formatted description
     * @private
     */
    _formatItemDescription(entity, itemFluff) {
        try {
            let description = '';

            // Add main entries
            if (entity.entries) {
                description = Array.isArray(entity.entries) ?
                    entity.entries.map(entry => {
                        if (typeof entry === 'string') return entry;
                        if (entry.type === 'entries') {
                            return `${entry.name ? `${entry.name}. ` : ''}${Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries}`;
                        }
                        if (entry.items) {
                            return entry.items.join('\n');
                        }
                        return '';
                    }).filter(Boolean).join('\n\n') :
                    entity.entries;
            }

            // Additional entries (e.g., for magic items)
            if (entity.additionalEntries) {
                const additionalText = Array.isArray(entity.additionalEntries) ?
                    entity.additionalEntries.map(entry => {
                        if (typeof entry === 'string') return entry;
                        if (entry.type === 'entries') {
                            return `${entry.name ? `${entry.name}. ` : ''}${Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries}`;
                        }
                        return '';
                    }).filter(Boolean).join('\n\n') :
                    entity.additionalEntries;

                if (additionalText) {
                    description = description ? `${description}\n\n${additionalText}` : additionalText;
                }
            }

            // Add fluff if available
            if (itemFluff?.entries) {
                const fluffText = Array.isArray(itemFluff.entries) ?
                    itemFluff.entries.map(entry => {
                        if (typeof entry === 'string') return entry;
                        if (entry.type === 'entries') {
                            return `${entry.name ? `${entry.name}. ` : ''}${Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries}`;
                        }
                        return '';
                    }).filter(Boolean).join('\n\n') :
                    itemFluff.entries;

                if (fluffText) {
                    description = description ? `${description}\n\n${fluffText}` : fluffText;
                }
            }

            return description || 'No description available.';
        } catch (error) {
            console.error('Error formatting item description:', error);
            return 'Error loading item description.';
        }
    }

    //-------------------------------------------------------------------------
    // Reference Resolution - Monsters
    //-------------------------------------------------------------------------

    /**
     * Handles monster reference resolution
     * @param {string} name - The monster name
     * @param {string} source - The source book
     * @returns {Promise<TooltipData|null>} The tooltip data for the monster, or null if not found
     * @private
     */
    async _handleMonsterRef(name, source) {
        try {
            if (!name) {
                console.warn('Empty monster name provided to reference resolver');
                return null;
            }

            // Load monster data
            const monstersData = await this._dataLoader.loadMonsters();
            const monsters = monstersData.monster || [];
            const fluff = monstersData.fluff || [];

            // Find the monster
            const entity = monsters.find(m => m.name.toLowerCase() === name.toLowerCase());
            const monsterFluff = fluff.find(f => f.name.toLowerCase() === name.toLowerCase());

            if (!entity) {
                return null;
            }

            // Build description
            let description = '';

            // Basic traits
            const traits = [
                `${entity.size} ${entity.type}${entity.alignment ? `, ${entity.alignment}` : ''}`,
                `Armor Class ${entity.ac.value}${entity.ac.from ? ` (${entity.ac.from.join(', ')})` : ''}`,
                `Hit Points ${entity.hp.average} (${entity.hp.formula})`,
                `Speed ${Object.entries(entity.speed).map(([type, speed]) => type === 'walk' ? `${speed} ft.` : `${type} ${speed} ft.`).join(', ')}`
            ];

            description += traits.join('\n');

            // Ability scores
            const abilities = [
                `STR ${entity.str} (${Math.floor((entity.str - 10) / 2)})`,
                `DEX ${entity.dex} (${Math.floor((entity.dex - 10) / 2)})`,
                `CON ${entity.con} (${Math.floor((entity.con - 10) / 2)})`,
                `INT ${entity.int} (${Math.floor((entity.int - 10) / 2)})`,
                `WIS ${entity.wis} (${Math.floor((entity.wis - 10) / 2)})`,
                `CHA ${entity.cha} (${Math.floor((entity.cha - 10) / 2)})`
            ];

            description += `\n\n${abilities.join('  ')}`;

            // Other attributes
            const attributes = [];

            if (entity.save) {
                attributes.push(`Saving Throws ${Object.entries(entity.save).map(([ability, bonus]) => `${ability.toUpperCase()} ${bonus}`).join(', ')}`);
            }

            if (entity.skill) {
                attributes.push(`Skills ${Object.entries(entity.skill).map(([skill, bonus]) => `${skill} ${bonus}`).join(', ')}`);
            }

            if (entity.vulnerable) {
                attributes.push(`Damage Vulnerabilities ${Array.isArray(entity.vulnerable) ? entity.vulnerable.join(', ') : entity.vulnerable}`);
            }

            if (entity.resist) {
                attributes.push(`Damage Resistances ${Array.isArray(entity.resist) ? entity.resist.join(', ') : entity.resist}`);
            }

            if (entity.immune) {
                attributes.push(`Damage Immunities ${Array.isArray(entity.immune) ? entity.immune.join(', ') : entity.immune}`);
            }

            if (entity.conditionImmune) {
                attributes.push(`Condition Immunities ${Array.isArray(entity.conditionImmune) ? entity.conditionImmune.join(', ') : entity.conditionImmune}`);
            }

            if (entity.senses) {
                attributes.push(`Senses ${Array.isArray(entity.senses) ? entity.senses.join(', ') : entity.senses}`);
            }

            if (entity.languages) {
                attributes.push(`Languages ${Array.isArray(entity.languages) ? entity.languages.join(', ') : entity.languages}`);
            }

            if (entity.cr) {
                attributes.push(`Challenge ${entity.cr} (${this._getChallengeXP(entity.cr)} XP)`);
            }

            if (attributes.length > 0) {
                description += `\n\n${attributes.join('\n')}`;
            }

            // Add fluff description
            if (monsterFluff?.entries) {
                const fluffText = Array.isArray(monsterFluff.entries) ?
                    monsterFluff.entries.map(entry => {
                        if (typeof entry === 'string') return entry;
                        if (entry.type === 'entries') {
                            return `${entry.name ? `${entry.name}. ` : ''}${Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries}`;
                        }
                        return '';
                    }).filter(Boolean).join('\n\n') :
                    monsterFluff.entries;

                if (fluffText) {
                    description += `\n\n${fluffText}`;
                }
            }

            return {
                title: `${entity.name}`,
                description: description,
                type: entity.type,
                size: entity.size,
                cr: entity.cr,
                source: `${source || entity.source}, page ${entity.page || '??'}`
            };
        } catch (error) {
            console.error(`Error resolving monster reference for "${name}":`, error);
            return null;
        }
    }

    //-------------------------------------------------------------------------
    // Reference Resolution - Classes
    //-------------------------------------------------------------------------

    /**
     * Handles class reference resolution
     * @param {string} name - The class name
     * @param {string} source - The source book
     * @returns {Promise<TooltipData|null>} The tooltip data for the class, or null if not found
     * @private
     */
    async _handleClassRef(name, source) {
        try {
            if (!name) {
                console.warn('Empty class name provided to reference resolver');
                return null;
            }

            // Load class data
            const classesData = await this._dataLoader.loadClasses();
            const classes = classesData.class || [];

            // Find the class
            const entity = classes.find(c => c.name.toLowerCase() === name.toLowerCase());

            if (!entity) {
                return null;
            }

            // Build description
            let description = '';

            if (entity.fluff?.entries) {
                // Use the fluff entries for the class description
                description = Array.isArray(entity.fluff.entries) ?
                    entity.fluff.entries.map(entry => {
                        if (typeof entry === 'string') return entry;
                        if (entry.type === 'entries') {
                            return `${entry.name ? `${entry.name}\n` : ''}${Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries}`;
                        }
                        return '';
                    }).filter(Boolean).join('\n\n') :
                    entity.fluff.entries;
            }

            // Add class features summary
            const features = [];

            if (entity.hd) {
                features.push(`Hit Dice: 1d${entity.hd} per level`);
            }

            if (entity.proficiency) {
                features.push(`Proficiencies: ${entity.proficiency.join(', ')}`);
            }

            if (entity.startingProficiencies) {
                if (entity.startingProficiencies.armor) {
                    features.push(`Armor: ${entity.startingProficiencies.armor.join(', ')}`);
                }
                if (entity.startingProficiencies.weapons) {
                    features.push(`Weapons: ${entity.startingProficiencies.weapons.join(', ')}`);
                }
                if (entity.startingProficiencies.tools) {
                    features.push(`Tools: ${entity.startingProficiencies.tools.join(', ')}`);
                }
                if (entity.startingProficiencies.skills) {
                    const skillText = entity.startingProficiencies.skills.choose ?
                        `Choose ${entity.startingProficiencies.skills.choose.count} from ${entity.startingProficiencies.skills.choose.from.join(', ')}` :
                        entity.startingProficiencies.skills.join(', ');
                    features.push(`Skills: ${skillText}`);
                }
            }

            if (entity.spellcasting) {
                features.push(`Spellcasting Ability: ${entity.spellcasting.spellcastingAbility}`);
            }

            if (features.length > 0) {
                if (description) {
                    description += '\n\n';
                }
                description += features.join('\n');
            }

            return {
                title: entity.name,
                description: description || `The ${entity.name} class.`,
                source: `${source || entity.source}, page ${entity.page || '??'}`
            };
        } catch (error) {
            console.error(`Error resolving class reference for "${name}":`, error);
            return null;
        }
    }

    //-------------------------------------------------------------------------
    // Reference Resolution - Races
    //-------------------------------------------------------------------------

    /**
     * Handles race reference resolution
     * @param {string} name - The race name
     * @param {string} source - The source book
     * @returns {Promise<TooltipData|null>} The tooltip data for the race, or null if not found
     * @private
     */
    async _handleRaceRef(name, source) {
        try {
            if (!name) {
                console.warn('Empty race name provided to reference resolver');
                return null;
            }

            // Load race data
            const racesData = await this._dataLoader.loadRaces();
            const races = racesData.race || [];

            // Find the race
            const entity = races.find(r => r.name.toLowerCase() === name.toLowerCase());

            if (!entity) {
                return null;
            }

            // Get the race description
            const description = this._getRaceDescription(entity);

            // Build traits summary
            const traits = [];

            if (entity.size) {
                traits.push(`Size: ${entity.size}`);
            }

            if (entity.speed) {
                traits.push(`Speed: ${entity.speed}`);
            }

            if (entity.ability) {
                const abilities = [];
                for (const [ability, bonus] of Object.entries(entity.ability)) {
                    abilities.push(`${ability.toUpperCase()} +${bonus}`);
                }
                traits.push(`Ability Score Increase: ${abilities.join(', ')}`);
            }

            if (entity.languageProficiencies) {
                traits.push(`Languages: ${entity.languageProficiencies.join(', ')}`);
            }

            if (entity.traitTags) {
                traits.push(`Traits: ${entity.traitTags.join(', ')}`);
            }

            let fullDescription = description;

            if (traits.length > 0) {
                if (fullDescription) {
                    fullDescription += '\n\n';
                }
                fullDescription += traits.join('\n');
            }

            return {
                title: entity.name,
                description: fullDescription || `A member of the ${entity.name} race.`,
                source: `${source || entity.source}, page ${entity.page || '??'}`
            };
        } catch (error) {
            console.error(`Error resolving race reference for "${name}":`, error);
            return null;
        }
    }

    //-------------------------------------------------------------------------
    // Reference Resolution - Background
    //-------------------------------------------------------------------------

    /**
     * Handles background reference resolution
     * @param {string} name - The background name
     * @param {string} source - The source book
     * @returns {Promise<TooltipData|null>} The tooltip data for the background, or null if not found
     * @private
     */
    async _handleBackgroundRef(name, source) {
        try {
            if (!name) {
                console.warn('Empty background name provided to reference resolver');
                return null;
            }

            // Load background data
            const backgroundsData = await this._dataLoader.loadBackgrounds();
            const backgrounds = backgroundsData.background || [];

            // Find the background
            const entity = backgrounds.find(b => b.name.toLowerCase() === name.toLowerCase());

            if (!entity) {
                return null;
            }

            // Build description
            let description = '';

            if (entity.entries) {
                description = Array.isArray(entity.entries) ?
                    entity.entries.map(entry => {
                        if (typeof entry === 'string') return entry;
                        if (entry.type === 'entries') {
                            return `${entry.name ? `${entry.name}\n` : ''}${Array.isArray(entry.entries) ? entry.entries.join('\n') : entry.entries}`;
                        }
                        return '';
                    }).filter(Boolean).join('\n\n') :
                    entity.entries;
            }

            // Add background features summary
            const features = [];

            if (entity.skillProficiencies) {
                features.push(`Skill Proficiencies: ${entity.skillProficiencies.join(', ')}`);
            }

            if (entity.toolProficiencies) {
                features.push(`Tool Proficiencies: ${entity.toolProficiencies.join(', ')}`);
            }

            if (entity.languages) {
                features.push(`Languages: ${entity.languages.join(', ')}`);
            }

            if (entity.equipment) {
                features.push(`Equipment: ${entity.equipment.join(', ')}`);
            }

            if (entity.feature) {
                features.push(`Feature: ${entity.feature.name}\n${entity.feature.description}`);
            }

            if (features.length > 0) {
                if (description) {
                    description += '\n\n';
                }
                description += features.join('\n\n');
            }

            return {
                title: entity.name,
                description: description || `The ${entity.name} background.`,
                source: `${source || entity.source}, page ${entity.page || '??'}`
            };
        } catch (error) {
            console.error(`Error resolving background reference for "${name}":`, error);
            return null;
        }
    }

    //-------------------------------------------------------------------------
    // Reference Resolution - Skills
    //-------------------------------------------------------------------------

    /**
     * Handles skill reference resolution
     * @param {string} name - The skill name
     * @returns {Promise<TooltipData>} The tooltip data for the skill
     * @private
     */
    async _handleSkillRef(name) {
        try {
            if (!name) {
                console.warn('Empty skill name provided to reference resolver');
                return {
                    title: 'Unknown Skill',
                    description: 'No skill details available.'
                };
            }

            // Load skill data
            const skillData = await this.loadSkillData();
            const normalizedName = name.toLowerCase();
            const skill = skillData.get(normalizedName);

            if (!skill) {
                return {
                    title: name,
                    description: 'Skill details not found.'
                };
            }

            const description = Array.isArray(skill.entries) ? skill.entries.join('\n\n') : skill.entries || '';

            return {
                title: `${skill.name} (${skill.ability})`,
                description: description,
                ability: skill.ability,
                source: skill.page ? `PHB, page ${skill.page}` : 'Player\'s Handbook'
            };
        } catch (error) {
            console.error(`Error resolving skill reference for "${name}":`, error);
            return {
                title: name || 'Unknown Skill',
                description: 'An error occurred while loading skill details.'
            };
        }
    }

    //-------------------------------------------------------------------------
    // Core Reference Resolution
    //-------------------------------------------------------------------------

    /**
     * Resolves a reference to retrieve tooltip data
     * @param {string} type - The reference type ('spell', 'item', 'monster', etc.)
     * @param {string} name - The name of the referenced entity
     * @param {string} source - The source book for the entity
     * @returns {Promise<TooltipData|null>} The tooltip data or null if reference resolution failed
     */
    async resolveReference(type, name, source) {
        try {
            if (!type || !name) {
                console.warn('Invalid reference: type or name missing', { type, name });
                return null;
            }

            // Create a cache key for this reference
            const cacheKey = `${type}:${name.toLowerCase()}:${source || ''}`;

            // Check if we already have this reference in cache
            if (this._cache.has(cacheKey)) {
                return this._cache.get(cacheKey);
            }

            // Check if we're already processing this reference (prevent circular references)
            if (this._processingRefs.has(cacheKey)) {
                // Only log the warning if this specific circular ref hasn't been logged yet
                if (!this._loggedCircularRefs.has(cacheKey)) {
                    console.warn(`Circular reference detected: ${cacheKey}`);
                    this._loggedCircularRefs.add(cacheKey); // Mark as logged
                }
                return {
                    title: name,
                    description: 'Circular reference detected.'
                };
            }


            // Mark that we're processing this reference
            this._processingRefs.add(cacheKey);

            let result = null;

            // Resolve based on reference type
            switch (type.toLowerCase()) {
                case 'spell':
                    result = await this._handleSpellRef(name, source);
                    break;
                case 'item':
                    result = await this._handleItemRef(name, source);
                    break;
                case 'monster':
                    result = await this._handleMonsterRef(name, source);
                    break;
                case 'class':
                    result = await this._handleClassRef(name, source);
                    break;
                case 'race':
                    result = await this._handleRaceRef(name, source);
                    break;
                case 'background':
                    result = await this._handleBackgroundRef(name, source);
                    break;
                case 'skill':
                    result = await this._handleSkillRef(name);
                    break;
                case 'condition':
                    result = await this._handleConditionRef(name, source);
                    break;
                case 'damage': // Handle damage tags like {@damage 1d6 piercing}
                    result = {
                        title: name, // Use the content (e.g., "1d6 piercing") as the title
                        description: 'Damage expression' // Simple description
                    };
                    break;
                default:
                    console.warn(`Unknown reference type: ${type}`);
                    result = {
                        title: name,
                        description: `Unknown reference type: ${type}`
                    };
            }

            // We're done processing this reference
            this._processingRefs.delete(cacheKey);

            // Cache the result if successful
            if (result) {
                this._cache.set(cacheKey, result);
            }

            return result;
        } catch (error) {
            console.error(`Error resolving reference: ${type}:${name}`, error);

            // Clean up processing state
            const cacheKey = `${type}:${name.toLowerCase()}:${source || ''}`;
            this._processingRefs.delete(cacheKey);

            return {
                title: name,
                description: 'An error occurred while loading reference data.'
            };
        }
    }

    /**
     * Resolve a single reference tag like {@spell Fireball|PHB}
     * @param {string} ref - The reference string (e.g., {@spell Fireball|PHB})
     * @param {Object} [options={}] - Processing options, including resolveMode
     * @param {string} [options.resolveMode='tooltip'] - How to resolve ('tooltip' or 'displayName')
     * @param {number} [depth=0] - Recursion depth tracker
     * @returns {Promise<string>} The resolved HTML string or display name
     */
    async resolveRef(ref, options = {}, depth = 0) {
        const resolveMode = options.resolveMode || 'tooltip'; // Default to tooltip

        // Check for circular references
        if (this._processingRefs.has(ref)) {
            // Only log the warning if this specific circular ref hasn't been logged yet
            if (!this._loggedCircularRefs.has(ref)) {
                console.warn('Circular reference detected:', ref);
                this._loggedCircularRefs.add(ref); // Mark as logged
            }
            return ref; // Return original tag
        }

        // Check maximum depth
        if (depth > 5) {
            console.warn('Max reference depth exceeded for:', ref);
            return ref; // Return original tag
        }

        const match = ref.match(/{@(\w+)\s+([^}]+)}/);
        if (!match) return ref; // Return original tag if regex fails

        const [fullMatch, type, content] = match;
        const parts = content.split('|');
        const name = parts[0].trim(); // The part before the first pipe is the name/display name
        const source = parts[1] ? parts[1].trim() : 'PHB'; // Source is optional
        // Note: parts[2] (potential display text override) is ignored in current simple parsing

        // --- Handle displayName Mode --- 
        if (resolveMode === 'displayName') {
            return name; // Return just the extracted name part
        }
        // --- End displayName Mode ---

        // --- Handle tooltip Mode (Existing Logic) --- 
        let tooltipData = null;
        try {
            this._processingRefs.add(ref);

            tooltipData = await this.resolveReference(type, name, source);

            if (!tooltipData) {
                // If data not found, fallback to a simple span with the name
                return `<span class="reference not-found">${name}</span>`;
            }

            // Create the tooltip element (passing depth for nested resolution)
            return await this.createTooltipElement(type, name, tooltipData, depth);
        } catch (error) {
            console.warn(`Error resolving reference ${ref}:`, error);
            // Fallback to simple span on error
            return `<span class="reference error">${name}</span>`;
        } finally {
            this._processingRefs.delete(ref);
        }
        // --- End tooltip Mode ---
    }

    /**
     * Resolves nested references within text content
     * @param {string} text - The text containing references to resolve
     * @param {number} depth - The current depth of reference resolution
     * @returns {Promise<string>} The text with all references resolved
     */
    async resolveNestedReferences(text, depth) {
        if (typeof text !== 'string') return text;

        const references = text.match(/{@\w+[^}]+}/g) || [];
        if (references.length === 0) return text;

        let resolvedText = text;
        for (const ref of references) {
            // Skip if we're already processing this reference
            if (this._processingRefs.has(ref)) {
                continue;
            }

            // Skip if we've exceeded the maximum depth
            if (depth > 5) {
                continue;
            }

            const resolved = await this.resolveRef(ref, depth);
            resolvedText = resolvedText.replace(ref, resolved);
        }

        return resolvedText;
    }

    /**
     * Creates a tooltip element for displaying reference data
     * @param {string} type - The type of tooltip to create
     * @param {string} text - The text to display in the tooltip
     * @param {TooltipData} data - Additional data for the tooltip
     * @param {number} depth - The current depth of reference resolution
     * @returns {Promise<HTMLElement>} The created tooltip element
     */
    async createTooltipElement(type, text, data, depth) {
        if (data.description) {
            data.description = await this.resolveNestedReferences(data.description, depth + 1);
        }
        if (data.entries) {
            data.entries = await Promise.all(data.entries.map(entry =>
                this.resolveNestedReferences(entry, depth + 1)
            ));
        }

        const span = document.createElement('span');
        span.className = `reference-link ${type}-reference`;
        span.setAttribute('data-tooltip', encodeURIComponent(this.formatTooltipContent(data)));
        if (data.source) {
            span.setAttribute('data-source', data.source);
        }
        span.textContent = text;
        return span.outerHTML;
    }

    /**
     * Formats tooltip content based on the data type and properties
     * @param {TooltipData} data - The tooltip data to format
     * @returns {string} The formatted HTML content for the tooltip
     */
    formatTooltipContent(data) {
        let content = '';

        if (data.title) {
            content += `<strong>${data.title}</strong>`;
        }

        // Handle spell-specific formatting
        if (data.level !== undefined) {
            if (data.level === 0) {
                content += `<div class="spell-header">${data.school} Cantrip</div>`;
            } else {
                content += `<div class="spell-header">Level ${data.level} ${data.school}</div>`;
            }

            if (data.castingTime) {
                content += `<div class="spell-detail"><strong>Casting Time:</strong> ${data.castingTime}</div>`;
            }
            if (data.range) {
                content += `<div class="spell-detail"><strong>Range:</strong> ${data.range}</div>`;
            }
            if (data.components) {
                content += `<div class="spell-detail"><strong>Components:</strong> ${data.components}</div>`;
            }
            if (data.duration) {
                content += `<div class="spell-detail"><strong>Duration:</strong> ${data.duration}</div>`;
            }
        }

        // Handle source-specific formatting
        if (data.published || data.author || data.group || data.version) {
            if (data.published) {
                content += `<div class="source-detail"><strong>Published:</strong> ${data.published}</div>`;
            }
            if (data.author) {
                content += `<div class="source-detail"><strong>Author:</strong> ${data.author}</div>`;
            }
            if (data.group) {
                content += `<div class="source-detail"><strong>Group:</strong> ${data.group}</div>`;
            }
            if (data.version) {
                content += `<div class="source-detail"><strong>Version:</strong> ${data.version}</div>`;
            }
        }

        // Handle item-specific formatting
        if (data.type) {
            const rarityClass = data.rarity ? ` rarity-${data.rarity.toLowerCase().replace(/\s+/g, '-')}` : '';
            content += `<div class="item-type"><strong>Type:</strong> ${data.type}${data.rarity ? ` <span class="item-rarity${rarityClass}">(${data.rarity})</span>` : ''}</div>`;
            if (data.value) {
                content += `<div class="item-value"><strong>Value:</strong> ${data.value}</div>`;
            }
            if (data.weight) {
                content += `<div class="item-weight"><strong>Weight:</strong> ${data.weight}</div>`;
            }
            if (data.properties) {
                content += `<div class="item-properties"><strong>Properties:</strong> ${data.properties.join(', ')}</div>`;
            }
            if (data.attunement) {
                content += `<div class="item-attunement"><em>Requires attunement</em></div>`;
            }
        }

        // Handle action-specific formatting
        if (data.time) {
            content += `<div class="action-detail"><strong>Time:</strong> ${data.time}</div>`;
        }

        // Handle object-specific formatting
        if (data.size) {
            content += `<div class="object-detail"><strong>Size:</strong> ${data.size}</div>`;
        }
        if (data.objectType) {
            content += `<div class="object-detail"><strong>Type:</strong> ${data.objectType}</div>`;
        }

        // Handle skill-specific formatting
        if (data.ability) {
            content += `<div class="skill-detail"><strong>Ability:</strong> ${data.ability}</div>`;
        }

        // Handle condition-specific formatting
        if (data.condition) {
            content += `<div class="condition-detail"><strong>Condition:</strong> ${data.condition}</div>`;
        }

        // Handle feat-specific formatting
        if (data.prerequisite) {
            content += `<div class="feat-detail"><strong>Prerequisite:</strong> ${data.prerequisite}</div>`;
        }

        // Handle background-specific formatting
        if (data.background) {
            content += `<div class="background-detail"><strong>Background:</strong> ${data.background}</div>`;
        }

        // Handle class-specific formatting
        if (data.class) {
            content += `<div class="class-detail"><strong>Class:</strong> ${data.class}</div>`;
        }

        // Handle race-specific formatting
        if (data.race) {
            content += `<div class="race-detail"><strong>Race:</strong> ${data.race}</div>`;
        }

        // Handle damage-specific formatting
        if (data.roll) {
            content += `<div class="damage-detail"><strong>Roll:</strong> ${data.roll}</div>`;
        }

        // Handle DC-specific formatting
        if (data.dc) {
            content += `<div class="dc-detail"><strong>DC:</strong> ${data.dc}</div>`;
        }

        // Handle hit-specific formatting
        if (data.hit) {
            content += `<div class="hit-detail"><strong>Hit:</strong> ${data.hit}</div>`;
        }

        // Handle variant rule-specific formatting
        if (data.variantRule) {
            content += `<div class="variant-rule-detail"><strong>Variant Rule:</strong> ${data.variantRule}</div>`;
        }

        if (data.description) {
            content += `<div class="tooltip-description">${data.description}</div>`;
        }

        if (data.source) {
            content += `<div class="tooltip-source">${data.source}</div>`;
        }

        return content;
    }

    /**
     * Formats a spell's range information
     * @param {Object} range - The spell range data
     * @returns {string} The formatted range text
     */
    _formatSpellRange(range) {
        if (!range) return 'Unknown';
        return range.distance?.type === 'self' ? 'Self' :
            `${range.distance?.amount || ''} ${range.distance?.type || ''}`.trim() || 'Unknown';
    }

    /**
     * Formats a spell's components information
     * @param {Object} components - The spell components data
     * @returns {string} The formatted components text
     */
    _formatSpellComponents(components) {
        if (!components) return 'Unknown';
        return Object.entries(components)
            .map(([type, value]) => type + (typeof value === 'string' ? ` (${value})` : ''))
            .join(', ') || 'None';
    }

    /**
     * Formats a spell's duration information
     * @param {Array} duration - The spell duration data
     * @returns {string} The formatted duration text
     */
    _formatSpellDuration(duration) {
        if (!duration?.[0]) return 'Unknown';
        return duration[0].type === 'instant' ? 'Instantaneous' :
            duration[0].type === 'timed' ?
                `${duration[0].duration.amount} ${duration[0].duration.type}` :
                duration[0].type || 'Unknown';
    }

    /**
     * Gets a formatted description for a race
     * @param {Object} raceData - The race data to process
     * @returns {string} The formatted race description
     */
    getRaceDescription(raceData) {
        if (!raceData) return 'No description available.';

        const processEntries = (entries) => {
            if (!entries) return '';
            if (typeof entries === 'string') return entries;
            if (Array.isArray(entries)) {
                return entries.map(entry => {
                    if (typeof entry === 'string') return entry;
                    if (entry.type === 'entries') {
                        return `${entry.name ? `${entry.name}\n` : ''}${processEntries(entry.entries)}`;
                    }
                    return entry.entries || '';
                }).filter(Boolean).join('\n');
            }
            return '';
        };

        let description = '';
        if (raceData.fluff?.entries) {
            description = processEntries(raceData.fluff.entries);
        }
        if (!description && raceData.entries) {
            description = processEntries(raceData.entries);
        }
        return description || `A member of the ${raceData.name} race.`;
    }

    //-------------------------------------------------------------------------
    // Text Processing Methods
    //-------------------------------------------------------------------------

    /**
     * Extract and resolve references from a text string
     * @param {string} text - The text to process
     * @returns {Promise<string>} The processed text with references resolved
     */
    async processText(text) {
        try {
            if (!text) return '';

            // Define regex patterns for different reference types
            const patterns = {
                // Spell reference: {spell: Fireball}
                spell: /{@spell ([^}|]+)(?:\|([^}]+))?}/g,

                // Item reference: {item: Longsword}
                item: /{@item ([^}|]+)(?:\|([^}]+))?}/g,

                // Monster reference: {creature: Goblin}
                monster: /{@creature ([^}|]+)(?:\|([^}]+))?}/g,

                // Class reference: {class: Fighter}
                class: /{@class ([^}|]+)(?:\|([^}]+))?}/g,

                // Race reference: {race: Elf}
                race: /{@race ([^}|]+)(?:\|([^}]+))?}/g,

                // Background reference: {background: Acolyte}
                background: /{@background ([^}|]+)(?:\|([^}]+))?}/g,

                // Skill reference: {skill: Acrobatics}
                skill: /{@skill ([^}|]+)(?:\|([^}]+))?}/g,

                // General reference: {@condition poisoned}
                condition: /{@condition ([^}|]+)(?:\|([^}]+))?}/g,

                // Dice reference: {@dice 1d6+2}
                dice: /{@dice ([^}]+)}/g
            };

            // Process each reference type
            let processedText = text;

            for (const [type, pattern] of Object.entries(patterns)) {
                // Replace each reference with its resolved value
                processedText = await this._processReferences(processedText, type, pattern);
            }

            return processedText;
        } catch (error) {
            console.error('Error processing reference text:', error);
            return text; // Return original text on error
        }
    }

    /**
     * Process references of a specific type in text
     * @param {string} text - The text to process
     * @param {string} type - The reference type
     * @param {RegExp} pattern - The regex pattern to match references
     * @returns {Promise<string>} The processed text
     * @private
     */
    async _processReferences(text, type, pattern) {
        try {
            if (!text) return '';

            // Find all matches in the text
            const matches = [...text.matchAll(pattern)];

            if (matches.length === 0) {
                return text;
            }

            // Process each match
            let result = text;

            for (const match of matches) {
                const fullMatch = match[0];
                const name = match[1];
                const source = match[2];

                // Skip if reference is already being processed (prevent infinite recursion)
                const cacheKey = `${type}:${name.toLowerCase()}:${source || ''}`;
                if (this._processingRefs.has(cacheKey)) {
                    continue;
                }

                try {
                    if (type === 'dice') {
                        // Handle dice references directly
                        result = result.replace(fullMatch, `<span class="dice-ref">${name}</span>`);
                    } else {
                        // Resolve the reference
                        const refData = await this.resolveReference(type, name, source);

                        if (refData) {
                            // Create data attribute for tooltip
                            const tooltipData = encodeURIComponent(JSON.stringify({
                                title: refData.title,
                                content: refData.description,
                                type: type,
                                ...refData
                            }));

                            // Replace the reference with a linked span
                            result = result.replace(
                                fullMatch,
                                `<span class="ref-link" data-ref-type="${type}" data-ref-tooltip="${tooltipData}">${refData.title || name}</span>`
                            );
                        } else {
                            // If reference resolution failed, just use the name
                            result = result.replace(fullMatch, name);
                        }
                    }
                } catch (refError) {
                    console.error(`Error processing reference ${fullMatch}:`, refError);
                    // Replace with original name on error
                    result = result.replace(fullMatch, name);
                }
            }

            return result;
        } catch (error) {
            console.error(`Error processing references of type ${type}:`, error);
            return text; // Return original text on error
        }
    }

    //-------------------------------------------------------------------------
    // Utility Methods
    //-------------------------------------------------------------------------

    /**
     * Gets a formatted description for a race
     * @param {Object} raceData - The race data to process
     * @returns {string} The formatted race description
     * @private
     */
    _getRaceDescription(raceData) {
        try {
            if (!raceData) return 'No description available.';

            const processEntries = (entries) => {
                if (!entries) return '';
                if (typeof entries === 'string') return entries;
                if (Array.isArray(entries)) {
                    return entries.map(entry => {
                        if (typeof entry === 'string') return entry;
                        if (entry.type === 'entries') {
                            return `${entry.name ? `${entry.name}\n` : ''}${processEntries(entry.entries)}`;
                        }
                        return entry.entries || '';
                    }).filter(Boolean).join('\n');
                }
                return '';
            };

            let description = '';
            if (raceData.fluff?.entries) {
                description = processEntries(raceData.fluff.entries);
            }
            if (!description && raceData.entries) {
                description = processEntries(raceData.entries);
            }
            return description || `A member of the ${raceData.name} race.`;
        } catch (error) {
            console.error('Error processing race description:', error);
            return `A member of the ${raceData?.name || 'unknown'} race.`;
        }
    }

    /**
     * Gets XP value for a challenge rating
     * @param {string|number} cr - The challenge rating
     * @returns {string} The formatted XP value
     * @private
     */
    _getChallengeXP(cr) {
        try {
            const crXpMap = {
                '0': '0',
                '1/8': '25',
                '1/4': '50',
                '1/2': '100',
                '1': '200',
                '2': '450',
                '3': '700',
                '4': '1,100',
                '5': '1,800',
                '6': '2,300',
                '7': '2,900',
                '8': '3,900',
                '9': '5,000',
                '10': '5,900',
                '11': '7,200',
                '12': '8,400',
                '13': '10,000',
                '14': '11,500',
                '15': '13,000',
                '16': '15,000',
                '17': '18,000',
                '18': '20,000',
                '19': '22,000',
                '20': '25,000',
                '21': '33,000',
                '22': '41,000',
                '23': '50,000',
                '24': '62,000',
                '25': '75,000',
                '26': '90,000',
                '27': '105,000',
                '28': '120,000',
                '29': '135,000',
                '30': '155,000'
            };

            return crXpMap[cr.toString()] || '??';
        } catch (error) {
            console.error('Error determining challenge XP:', error);
            return '??';
        }
    }

    /**
     * Handle condition references
     * @param {string} name - Name of the condition
     * @param {string} [source='PHB'] - Source book of the condition
     * @returns {Promise<Object>} Condition data for tooltips
     */
    async _handleConditionRef(name, source = 'PHB') {
        try {
            if (!name) {
                console.warn('Invalid condition reference: name missing');
                return {
                    title: 'Unknown Condition',
                    description: 'Invalid condition reference: name missing'
                };
            }

            // Load condition data if not already loaded
            if (!this._conditionData) {
                const conditionData = await this._dataLoader.loadConditions();
                this._conditionData = conditionData;
            }

            // Extract the condition data
            const conditionData = this._conditionData;
            if (!conditionData || !conditionData.condition) {
                console.warn('Condition data not found');
                return {
                    title: name,
                    description: 'Condition data not found.'
                };
            }

            // Find the specific condition by name and source
            const normalizedName = name.toLowerCase();
            const condition = conditionData.condition.find(c =>
                c.name.toLowerCase() === normalizedName &&
                (!source || !c.source || c.source === source)
            );

            if (!condition) {
                console.warn(`Condition not found: ${name} (${source || 'unknown source'})`);
                return {
                    title: name,
                    description: 'Condition not found.'
                };
            }

            // Format the description from entries
            let description = '';
            if (condition.entries && Array.isArray(condition.entries)) {
                description = condition.entries.map(entry => {
                    if (typeof entry === 'string') {
                        return `<p>${entry}</p>`;
                    }
                    if (entry.type === 'list') {
                        const listItems = entry.items.map(item => `<li>${item}</li>`).join('');
                        return `<ul>${listItems}</ul>`;
                    }
                    return '';
                }).join('');
            }

            return {
                title: condition.name,
                source: condition.source,
                description: description || 'No description available',
                page: condition.page
            };
        } catch (error) {
            console.error('Error handling condition reference:', error);
            return {
                title: name,
                description: 'Error loading condition data.'
            };
        }
    }
}

// Create and export singleton instance with injected dependency
export const referenceResolver = new ReferenceResolver(dataLoader); 