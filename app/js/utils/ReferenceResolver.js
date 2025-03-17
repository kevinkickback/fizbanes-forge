/**
 * ReferenceResolver.js
 * Handles reference resolution and tooltip creation for D&D content
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
 */

import { dataLoader } from '../dataloaders/DataLoader.js';

/**
 * Class responsible for resolving references and creating tooltips in the D&D Character Creator
 */
class ReferenceResolver {
    /**
     * @param {DataLoader} dataLoader - The data loader instance for fetching data
     * @throws {Error} If dataLoader is not provided
     */
    constructor(dataLoader) {
        if (!dataLoader) {
            throw new Error('DataLoader is required for ReferenceResolver');
        }
        this.dataLoader = dataLoader;
        this.cache = new Map();
        this.skillData = null;
        this.processingRefs = new Set(); // Track references being processed
    }

    /**
     * Loads and caches skill data from the skills.json file
     * @returns {Promise<Map<string, SkillData>>} A map of skill names to their data
     * @throws {Error} If the skills data cannot be loaded
     */
    async loadSkillData() {
        if (this.skillData) return this.skillData;
        try {
            const response = await fetch('data/skills.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.skillData = new Map(data.skill.map(s => [s.name.toLowerCase(), s]));
            return this.skillData;
        } catch (error) {
            console.error('Error loading skill data:', error);
            return new Map();
        }
    }

    /**
     * Resolves a reference to its full data
     * @param {string} ref - The reference to resolve
     * @param {number} [depth=0] - The current depth of reference resolution
     * @returns {Promise<Object>} The resolved reference data
     * @throws {Error} If the reference cannot be resolved
     */
    async resolveRef(ref, depth = 0) {
        // Check for circular references
        if (this.processingRefs.has(ref)) {
            console.warn('Circular reference detected:', ref);
            return ref;
        }

        // Check maximum depth
        if (depth > 5) {
            return ref;
        }

        const match = ref.match(/{@(\w+)\s+([^}]+)}/);
        if (!match) return ref;

        const [fullMatch, type, content] = match;
        let tooltipData = null;
        let entity = null;

        try {
            // Add to processing set to prevent circular references
            this.processingRefs.add(ref);

            // Split content into name and source if provided
            const [name, source = 'PHB'] = content.split('|');

            switch (type) {
                case 'spell': {
                    const spellsData = await this.dataLoader.loadSpells();
                    const spells = spellsData?.spell || [];
                    const fluff = spellsData?.fluff || [];
                    entity = spells.find(s => s?.name?.toLowerCase() === name.toLowerCase());

                    if (entity) {
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

                        tooltipData = {
                            title: entity.name,
                            description: description || 'No description available.',
                            level: entity.level,
                            school: entity.school,
                            castingTime: entity.time?.[0] ? `${entity.time[0].number} ${entity.time[0].unit}` : 'Unknown',
                            range: this.formatSpellRange(entity.range),
                            components: this.formatSpellComponents(entity.components),
                            duration: this.formatSpellDuration(entity.duration),
                            source: `${source}, page ${entity.page || '??'}`
                        };
                    } else {
                        tooltipData = {
                            title: name,
                            description: 'Spell details not found.',
                            source: source
                        };
                    }
                    return this.createTooltipElement(type, name, tooltipData, depth);
                }
                case 'rarity': {
                    const rarityDescriptions = {
                        'common': 'Common items are widespread and easily available.',
                        'uncommon': 'Uncommon items are more powerful than common items and require more effort to obtain.',
                        'rare': 'Rare items are very powerful and difficult to find.',
                        'very rare': 'Very rare items are extremely powerful and almost impossible to find.',
                        'legendary': 'Legendary items are the most powerful items in existence.'
                    };

                    tooltipData = {
                        title: name.charAt(0).toUpperCase() + name.slice(1),
                        description: rarityDescriptions[name.toLowerCase()] || 'Rarity description not found.',
                        source: source
                    };
                    return this.createTooltipElement(type, name, tooltipData, depth);
                }
                case 'source': {
                    const sourcesData = await this.dataLoader.loadSources();
                    const sources = sourcesData?.source || [];
                    const sourceData = sources.find(s => s.id === name);

                    if (sourceData) {
                        tooltipData = {
                            title: sourceData.name || name,
                            description: sourceData.description || 'No description available.',
                            published: sourceData.published,
                            author: sourceData.author,
                            group: sourceData.group,
                            version: sourceData.version,
                            source: sourceData.id
                        };
                    } else {
                        // Try to find in books if not found in sources
                        const books = sourcesData?.book || [];
                        const bookData = books.find(b => b.id === name);

                        if (bookData) {
                            tooltipData = {
                                title: bookData.name || name,
                                description: bookData.description || 'No description available.',
                                published: bookData.published,
                                author: bookData.author,
                                group: bookData.group,
                                version: bookData.version,
                                source: bookData.id
                            };
                        } else {
                            tooltipData = {
                                title: name,
                                description: 'Source information not found.',
                                source: name
                            };
                        }
                    }
                    return this.createTooltipElement(type, name, tooltipData, depth);
                }
                case 'race': {
                    const racesData = await this.dataLoader.loadRaces();
                    const races = racesData?.race || [];
                    // Try to find the race with the exact source first
                    let raceData = races.find(r => r?.name?.toLowerCase() === name.toLowerCase() && r.source === source);

                    // If not found and source is PHB, try XPHB
                    if (!raceData && source === 'PHB') {
                        raceData = races.find(r => r?.name?.toLowerCase() === name.toLowerCase() && r.source === 'XPHB');
                    }

                    // If still not found, try PHB as fallback
                    if (!raceData && source === 'XPHB') {
                        raceData = races.find(r => r?.name?.toLowerCase() === name.toLowerCase() && r.source === 'PHB');
                    }

                    if (raceData) {
                        const description = this.getRaceDescription(raceData);
                        tooltipData = {
                            title: raceData.name,
                            description: description || `A member of the ${raceData.name} race.`,
                            source: `${raceData.source || 'PHB'}, page ${raceData.page || '??'}`
                        };
                    } else {
                        tooltipData = {
                            title: name,
                            description: `A member of the ${name} race.`,
                            source: source || 'PHB'
                        };
                    }
                    return this.createTooltipElement(type, name, tooltipData, depth);
                }
                case 'skill': {
                    const skills = await this.loadSkillData();
                    entity = skills.get(name.toLowerCase());
                    if (entity) {
                        tooltipData = {
                            title: entity.name,
                            description: Array.isArray(entity.entries) ? entity.entries.join('\n') : entity.entries,
                            ability: entity.ability.toUpperCase(),
                            source: `${source}, page ${entity.page || '??'}`
                        };
                    }
                    break;
                }
                case 'item':
                case 'equipment':
                case 'pack': {
                    const itemsData = await this.dataLoader.loadItems();
                    const items = itemsData.item || [];
                    const baseItems = itemsData.baseitem || [];
                    const fluff = itemsData.fluff || [];
                    entity = items.find(i => i.name.toLowerCase() === name.toLowerCase()) ||
                        baseItems.find(i => i.name.toLowerCase() === name.toLowerCase());
                    const itemFluff = fluff.find(f => f.name.toLowerCase() === name.toLowerCase());
                    if (entity) {
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

                        let description = '';
                        if (entity.entries) {
                            description = Array.isArray(entity.entries) ?
                                entity.entries.map(entry => {
                                    if (typeof entry === 'string') return entry;
                                    if (entry.type === 'list') {
                                        return entry.items.map(item => {
                                            if (typeof item === 'string') return item;
                                            return `${item.name}: ${item.entries.join('\n')}`;
                                        }).join('\n');
                                    }
                                    if (entry.type === 'entries') {
                                        return `${entry.name}\n${entry.entries.join('\n')}`;
                                    }
                                    return '';
                                }).join('\n\n') :
                                entity.entries;
                        }

                        // Add additional entries if they exist
                        if (entity.additionalEntries) {
                            const additionalText = Array.isArray(entity.additionalEntries) ?
                                entity.additionalEntries.map(entry => {
                                    if (typeof entry === 'string') return entry;
                                    if (entry.type === 'entries') {
                                        return `${entry.name}\n${entry.entries.join('\n')}`;
                                    }
                                    if (entry.type === 'table') {
                                        return `${entry.caption}\n${entry.rows.map(row => row.join(': ')).join('\n')}`;
                                    }
                                    return '';
                                }).join('\n\n') :
                                entity.additionalEntries;

                            description = description ? `${description}\n\n${additionalText}` : additionalText;
                        }

                        // Add fluff if available
                        if (itemFluff?.entries) {
                            const fluffText = Array.isArray(itemFluff.entries) ?
                                itemFluff.entries.map(entry => {
                                    if (typeof entry === 'string') return entry;
                                    if (entry.type === 'entries') return entry.entries.join('\n');
                                    return '';
                                }).filter(Boolean).join('\n\n') :
                                itemFluff.entries;

                            if (fluffText) {
                                description = description ? `${description}\n\n${fluffText}` : fluffText;
                            }
                        }

                        description = description || entity.description || '';

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

                        tooltipData = {
                            title: entity.name,
                            description: description,
                            type: typeMap[entity.type] || entity.type,
                            rarity: entity.rarity === 'none' ? 'Common' : (entity.rarity || 'Common'),
                            value: entity.value ? `${entity.value / 100} gp` : 'No value listed',
                            weight: entity.weight ? `${entity.weight} lb.` : 'No weight listed',
                            properties: entity.properties,
                            attunement: entity.reqAttune,
                            source: `${source}, page ${entity.page || '??'}`
                        };
                        return this.createTooltipElement('item', entity.name, tooltipData, depth);
                    }
                    break;
                }
                case 'background': {
                    const backgroundsData = await this.dataLoader.loadBackgrounds();
                    const backgrounds = backgroundsData?.background || [];
                    entity = backgrounds.find(b => b.name.toLowerCase() === name.toLowerCase());
                    if (entity) {
                        tooltipData = {
                            title: entity.name,
                            description: Array.isArray(entity.entries) ? entity.entries.join('\n') : entity.entries,
                            source: `${source}, page ${entity.page || '??'}`
                        };
                    }
                    break;
                }
                case 'class': {
                    const classesData = await this.dataLoader.loadClasses();
                    const classes = classesData?.class || [];
                    const fluff = classesData?.fluff || [];
                    // Try to find the class with the exact source first
                    let classData = classes.find(c => c?.name?.toLowerCase() === name.toLowerCase() && c.source === source);

                    // If not found and source is PHB, try XPHB
                    if (!classData && source === 'PHB') {
                        classData = classes.find(c => c?.name?.toLowerCase() === name.toLowerCase() && c.source === 'XPHB');
                    }

                    // If still not found, try PHB as fallback
                    if (!classData && source === 'XPHB') {
                        classData = classes.find(c => c?.name?.toLowerCase() === name.toLowerCase() && c.source === 'PHB');
                    }

                    // Find matching fluff data
                    const classFluff = fluff.find(f => f.name.toLowerCase() === name.toLowerCase() &&
                        (f.source === source || (!f.source && source === 'PHB')));

                    if (classData) {
                        let description = '';

                        // Add fluff if available - just get the first entries directly
                        if (classFluff?.entries?.[0]?.entries) {
                            description = classFluff.entries[0].entries
                                .filter(entry => typeof entry === 'string')
                                .join('\n\n');
                        }

                        // Add class features if available
                        if (classData.entries) {
                            const featuresText = Array.isArray(classData.entries) ?
                                classData.entries.map(entry => {
                                    if (typeof entry === 'string') return entry;
                                    if (entry.type === 'entries') return entry.entries.join('\n');
                                    return '';
                                }).filter(Boolean).join('\n\n') :
                                classData.entries;

                            if (featuresText) {
                                description = description ? `${description}\n\n${featuresText}` : featuresText;
                            }
                        }

                        tooltipData = {
                            title: classData.name,
                            description: description || `A member of the ${classData.name} class.`,
                            source: `${classData.source || 'PHB'}, page ${classData.page || '??'}`
                        };
                    } else {
                        tooltipData = {
                            title: name,
                            description: `A member of the ${name} class.`,
                            source: source || 'PHB'
                        };
                    }
                    return this.createTooltipElement(type, name, tooltipData, depth);
                }
                case 'damage': {
                    tooltipData = {
                        title: 'Damage',
                        description: `Roll ${name} damage`,
                        roll: name
                    };
                    break;
                }
                case 'dc': {
                    tooltipData = {
                        title: 'Difficulty Class',
                        description: `DC ${name}`
                    };
                    break;
                }
                case 'hit': {
                    tooltipData = {
                        title: 'Attack Bonus',
                        description: `+${name} to hit`
                    };
                    break;
                }
                case 'condition': {
                    const conditionsData = await this.dataLoader.loadConditions();
                    const conditions = conditionsData?.condition || [];
                    const condition = conditions.find(c => c.name.toLowerCase() === name.toLowerCase());
                    if (condition) {
                        tooltipData = {
                            title: condition.name,
                            description: Array.isArray(condition.entries) ? condition.entries.map(entry => {
                                if (typeof entry === 'string') return entry;
                                if (entry.type === 'list') return entry.items.join('\n• ');
                                return '';
                            }).filter(Boolean).join('\n') : condition.entries,
                            source: `${source}, page ${condition.page || '??'}`
                        };
                    }
                    break;
                }
                case 'book': {
                    const booksData = await this.dataLoader.loadSources();
                    const books = booksData?.book || [];
                    entity = books.find(b => b.name.toLowerCase() === name.toLowerCase() || b.id.toLowerCase() === name.toLowerCase());
                    if (entity) {
                        tooltipData = {
                            title: entity.name,
                            description: `Source: ${entity.source}${entity.published ? `\nPublished: ${entity.published}` : ''}`,
                            source: entity.source
                        };
                    }
                    break;
                }
                case 'h': {
                    return 'Hit: ';
                }
                case 'atk': {
                    const attackTypes = {
                        mw: 'Melee Weapon Attack',
                        rw: 'Ranged Weapon Attack',
                        'mw,r': 'Melee or Ranged Weapon Attack',
                        ms: 'Melee Spell Attack',
                        rs: 'Ranged Spell Attack'
                    };
                    return attackTypes[name] || name;
                }
                case 'action': {
                    const actionsData = await this.dataLoader.loadActions();
                    const actions = actionsData?.action || [];
                    const action = actions.find(a => a.name.toLowerCase() === name.toLowerCase());
                    if (action) {
                        tooltipData = {
                            title: action.name,
                            description: action.entries.join('\n'),
                            source: action.source,
                            time: action.time || 'Action'
                        };
                    }
                    break;
                }
                case 'object': {
                    const objectsData = await this.dataLoader.loadObjects();
                    const objects = objectsData?.object || [];
                    const object = objects.find(o => o.name.toLowerCase() === name.toLowerCase());
                    if (object) {
                        tooltipData = {
                            title: object.name,
                            description: object.entries.join('\n'),
                            source: object.source,
                            size: object.size,
                            type: object.objectType
                        };
                    }
                    break;
                }
                case 'variantrule': {
                    const rulesData = await this.dataLoader.loadVariantRules();
                    const rules = rulesData?.variantrule || [];
                    const rule = rules.find(r => r.name.toLowerCase() === name.toLowerCase());
                    if (rule) {
                        tooltipData = {
                            title: rule.name,
                            description: rule.entries.join('\n'),
                            source: rule.source
                        };
                    }
                    break;
                }
                case 'feature': {
                    // First check if it's a racial trait like Darkvision
                    const racesData = await this.dataLoader.loadRaces();
                    const races = racesData?.race || [];
                    const raceWithFeature = races.find(r => {
                        // Check if the race has this feature as a property
                        if (name.toLowerCase() === 'darkvision' && r.darkvision) {
                            return true;
                        }
                        // Check if the race has this feature in its entries
                        if (r.entries) {
                            return r.entries.some(entry =>
                                entry.name && entry.name.toLowerCase() === name.toLowerCase()
                            );
                        }
                        return false;
                    });

                    if (raceWithFeature) {
                        let description = '';
                        if (name.toLowerCase() === 'darkvision') {
                            description = `You can see in dim light within ${raceWithFeature.darkvision} feet of you as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of gray.`;
                        } else {
                            const featureEntry = raceWithFeature.entries.find(entry =>
                                entry.name && entry.name.toLowerCase() === name.toLowerCase()
                            );
                            if (featureEntry) {
                                description = Array.isArray(featureEntry.entries) ?
                                    featureEntry.entries.join('\n') :
                                    featureEntry.entries;
                            }
                        }

                        tooltipData = {
                            title: name,
                            description: description,
                            source: `${raceWithFeature.source || 'PHB'}, page ${raceWithFeature.page || '??'}`
                        };
                        return this.createTooltipElement(type, name, tooltipData, depth);
                    }

                    // If not found as a racial trait, check optional features
                    const featuresData = await this.dataLoader.loadFeatures();
                    const features = featuresData?.optionalfeature || [];
                    const feature = features.find(f => f.name.toLowerCase() === name.toLowerCase());
                    if (feature) {
                        tooltipData = {
                            title: feature.name,
                            description: Array.isArray(feature.entries) ? feature.entries.join('\n') : feature.entries,
                            source: `${source}, page ${feature.page || '??'}`
                        };
                    }
                    break;
                }
                case 'feat': {
                    const featuresData = await this.dataLoader.loadFeatures();
                    const feats = featuresData?.feat || [];
                    const feat = feats.find(f => f.name.toLowerCase() === name.toLowerCase());
                    if (feat) {
                        let description = '';
                        if (feat.entries) {
                            description = Array.isArray(feat.entries) ?
                                feat.entries.map(entry => {
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
                                }).filter(Boolean).join('\n\n') :
                                feat.entries;
                        }

                        tooltipData = {
                            title: feat.name,
                            description: description || 'No description available.',
                            source: `${source}, page ${feat.page || '??'}`
                        };
                    }
                    break;
                }
            }

            if (!tooltipData) {
                return `<span class="reference">${name}</span>`;
            }

            return this.createTooltipElement(type, name, tooltipData, depth);
        } catch (error) {
            console.warn(`Error resolving reference ${ref}:`, error);
            return `<span class="reference">${content.split('|')[0]}</span>`;
        } finally {
            // Remove from processing set
            this.processingRefs.delete(ref);
        }
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
            if (this.processingRefs.has(ref)) {
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
     * @param {Object} data - Additional data for the tooltip
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
     * @param {Object} data - The tooltip data to format
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
    formatSpellRange(range) {
        if (!range) return 'Unknown';
        return range.distance?.type === 'self' ? 'Self' :
            `${range.distance?.amount || ''} ${range.distance?.type || ''}`.trim() || 'Unknown';
    }

    /**
     * Formats a spell's components information
     * @param {Object} components - The spell components data
     * @returns {string} The formatted components text
     */
    formatSpellComponents(components) {
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
    formatSpellDuration(duration) {
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

    /**
     * Clears all cached data and processing state
     */
    clearCache() {
        this.cache.clear();
        this.skillData = null;
        this.processingRefs.clear();
    }
}

// Create and export singleton instance with injected dependency
export const referenceResolver = new ReferenceResolver(dataLoader); 