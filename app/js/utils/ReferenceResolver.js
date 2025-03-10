/**
 * ReferenceResolver.js
 * Handles reference resolution for the D&D Character Creator
 */

export class ReferenceResolver {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.cache = new Map();
        this.skillData = null;
        this.processingRefs = new Set(); // Track references being processed
    }

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

    async resolveRef(ref, depth = 0) {
        if (depth > 10) {
            console.warn('Maximum reference resolution depth reached');
            return ref;
        }

        // Check if we're already processing this reference
        if (this.processingRefs.has(ref)) {
            console.warn('Circular reference detected:', ref);
            return ref;
        }

        const match = ref.match(/{@(\w+)\s+([^}]+)}/);
        if (!match) return ref;

        // Add reference to processing set
        this.processingRefs.add(ref);

        const [fullMatch, tag, content] = match;
        const [name, source = 'PHB', ...rest] = content.split('|');

        const cacheKey = `${tag}:${name}:${source}`;
        if (this.cache.has(cacheKey)) {
            // Remove reference from processing set
            this.processingRefs.delete(ref);
            return this.cache.get(cacheKey);
        }

        try {
            let entity = null;
            let tooltipData = null;

            if (tag === 'dice') {
                tooltipData = {
                    title: 'Dice Roll',
                    description: `Roll ${name}`,
                    roll: name
                };
            }

            switch (tag) {
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
                    const items = await this.dataLoader.loadItems();
                    entity = items.find(i => i.name.toLowerCase() === name.toLowerCase());
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

                        description = description || entity.description || '';

                        tooltipData = {
                            title: entity.name,
                            description: description,
                            type: typeMap[entity.type] || entity.type,
                            rarity: entity.rarity === 'none' ? 'Common' : (entity.rarity || 'Common'),
                            value: entity.value ? `${entity.value} gp` : 'No value listed',
                            weight: entity.weight ? `${entity.weight} lb.` : 'No weight listed',
                            properties: entity.properties,
                            attunement: entity.reqAttune,
                            source: `${source}, page ${entity.page || '??'}`
                        };
                    }
                    break;
                }
                case 'background': {
                    const backgrounds = await this.dataLoader.loadBackgrounds();
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
                    const classes = await this.dataLoader.loadClasses();
                    // Try to find the class with the exact source first
                    let classData = classes.find(c => c.name.toLowerCase() === name.toLowerCase() && c.source === source);

                    // If not found and source is PHB, try XPHB
                    if (!classData && source === 'PHB') {
                        classData = classes.find(c => c.name.toLowerCase() === name.toLowerCase() && c.source === 'XPHB');
                    }

                    // If still not found, try PHB as fallback
                    if (!classData && source === 'XPHB') {
                        classData = classes.find(c => c.name.toLowerCase() === name.toLowerCase() && c.source === 'PHB');
                    }

                    if (classData) {
                        const processEntries = (entries) => {
                            if (!entries) return '';
                            if (typeof entries === 'string') return entries;
                            if (Array.isArray(entries)) {
                                return entries.map(entry => {
                                    if (typeof entry === 'string') return entry;
                                    if (entry.type === 'section' || entry.type === 'entries') {
                                        const text = [];
                                        if (entry.name && entry.name !== classData.name && entry.name.toLowerCase() !== 'description') {
                                            text.push(entry.name);
                                        }
                                        if (entry.entries) {
                                            if (Array.isArray(entry.entries)) {
                                                text.push(entry.entries.map(e => {
                                                    if (typeof e === 'string') return e;
                                                    if (e.type === 'entries') return processEntries(e.entries);
                                                    return '';
                                                }).filter(Boolean).join('\n\n'));
                                            } else {
                                                text.push(processEntries(entry.entries));
                                            }
                                        }
                                        return text.filter(Boolean).join('\n\n');
                                    }
                                    return '';
                                }).filter(Boolean).join('\n\n');
                            }
                            return '';
                        };

                        // Get description from fluff entries
                        let description = '';

                        // Try fluff entries first
                        if (classData.fluff?.entries) {
                            // Get the first section that matches the class name or has no name
                            const mainSection = classData.fluff.entries.find(e =>
                                e.type === 'section' &&
                                (!e.name || e.name === classData.name || e.name.toLowerCase() === 'description')
                            );

                            if (mainSection) {
                                description = processEntries([mainSection]);
                            } else {
                                // If no main section found, try processing all entries
                                description = processEntries(classData.fluff.entries);
                            }
                        }

                        // If no fluff description, try regular entries
                        if (!description && classData.entries) {
                            description = processEntries(classData.entries);
                        }

                        tooltipData = {
                            title: classData.name,
                            description: description,
                            source: `${classData.source}, page ${classData.page || '??'}`
                        };
                    }
                    break;
                }
                case 'race': {
                    const races = await this.dataLoader.loadRaces();
                    const raceData = races.find(r => r.name.toLowerCase() === name.toLowerCase());
                    if (raceData) {
                        const processEntries = (entries) => {
                            if (!entries) return '';
                            if (typeof entries === 'string') return entries;
                            if (Array.isArray(entries)) {
                                return entries.map(entry => {
                                    if (typeof entry === 'string') return entry;
                                    if (entry.type === 'entries') {
                                        return `${entry.name}\n${processEntries(entry.entries)}`;
                                    }
                                    return '';
                                }).filter(Boolean).join('\n');
                            }
                            return '';
                        };

                        const description = processEntries(raceData.fluff?.entries) ||
                            processEntries(raceData.entries) ||
                            `A member of the ${raceData.name} race.`;

                        tooltipData = {
                            title: raceData.name,
                            description: description,
                            source: `${raceData.source}, page ${raceData.page || '??'}`
                        };
                    }
                    break;
                }
                case 'spell': {
                    const spells = await this.dataLoader.loadSpells();
                    entity = spells.find(s => s.name.toLowerCase() === name.toLowerCase());
                    if (entity) {
                        tooltipData = {
                            title: entity.name,
                            description: entity.description,
                            level: entity.level,
                            school: entity.school,
                            castingTime: entity.time?.[0]?.number + ' ' + entity.time?.[0]?.unit,
                            range: entity.range?.distance?.type === 'self' ? 'Self' :
                                `${entity.range?.distance?.amount || ''} ${entity.range?.distance?.type || ''}`,
                            components: Object.entries(entity.components)
                                .map(([type, value]) => type + (typeof value === 'string' ? ` (${value})` : ''))
                                .join(', '),
                            duration: entity.duration?.[0]?.type === 'instant' ? 'Instantaneous' :
                                entity.duration?.[0]?.type === 'timed' ?
                                    `${entity.duration[0].duration.amount} ${entity.duration[0].duration.type}` :
                                    entity.duration?.[0]?.type || '',
                            source: `${source}, page ${entity.page || '??'}`
                        };
                    }
                    break;
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
                    const conditions = await this.dataLoader.loadConditions();
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
                    const books = await this.dataLoader.loadBooks();
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
                        mw, r: 'Melee or Ranged Weapon Attack',
                        ms: 'Melee Spell Attack',
                        rs: 'Ranged Spell Attack'
                    };
                    return attackTypes[name] || name;
                }
                case 'action': {
                    const actions = await this.dataLoader.loadActions();
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
                    const objects = await this.dataLoader.loadObjects();
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
                    const rules = await this.dataLoader.loadVariantRules();
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
            }

            const result = tooltipData ?
                await this.createTooltipElement(tag, name, tooltipData, depth) :
                name;

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.warn(`Error resolving reference ${fullMatch}:`, error);
            return name;
        } finally {
            // Remove reference from processing set
            this.processingRefs.delete(ref);
        }
    }

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

    async resolveNestedReferences(text, depth) {
        if (typeof text !== 'string') return text;

        const references = text.match(/{@\w+[^}]+}/g) || [];
        if (references.length === 0) return text;

        let resolvedText = text;
        for (const ref of references) {
            // Skip if we're already processing this reference
            if (this.processingRefs.has(ref)) {
                console.warn('Skipping circular reference:', ref);
                continue;
            }
            const resolved = await this.resolveRef(ref, depth);
            resolvedText = resolvedText.replace(ref, resolved);
        }

        return resolvedText;
    }

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

        // Handle item-specific formatting
        if (data.type) {
            content += `<div class="item-type">${data.type}</div>`;
            if (data.rarity) {
                content += `<div class="item-rarity">${data.rarity}</div>`;
            }
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

        if (data.description) {
            content += `<div class="tooltip-description">${data.description}</div>`;
        }

        if (data.source) {
            content += `<div class="tooltip-source">${data.source}</div>`;
        }

        return content;
    }

    clearCache() {
        this.cache.clear();
        this.skillData = null;
        this.processingRefs.clear();
    }
} 