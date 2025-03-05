/**
 * ReferenceResolver.js
 * Handles reference resolution for the D&D Character Creator
 */

export class ReferenceResolver {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.cache = new Map();
    }

    async resolveRef(ref) {
        const match = ref.match(/{@(\w+)\s+([^}]+)}/);
        if (!match) return ref;

        const [fullMatch, tag, content] = match;
        const [name, source = 'PHB', ...rest] = content.split('|');

        // Check cache
        const cacheKey = `${tag}:${name}:${source}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            let entity = null;
            let tooltipData = null;

            // Load and process entity
            switch (tag) {
                case 'item':
                case 'equipment':
                case 'pack': {
                    const items = await this.dataLoader.loadItems();
                    entity = items.find(i => i.name.toLowerCase() === name.toLowerCase());
                    break;
                }
                case 'background': {
                    const backgrounds = await this.dataLoader.loadBackgrounds();
                    entity = backgrounds.find(b => b.name.toLowerCase() === name.toLowerCase());
                    break;
                }
                case 'class': {
                    const classes = await this.dataLoader.loadClasses();
                    entity = classes.find(c => c.name.toLowerCase() === name.toLowerCase());
                    break;
                }
                case 'race': {
                    const races = await this.dataLoader.loadRaces();
                    entity = races.find(r => r.name.toLowerCase() === name.toLowerCase());
                    break;
                }
            }

            // Create tooltip if entity found
            if (entity) {
                tooltipData = {
                    title: entity.name,
                    description: entity.description,
                    source: `${source}, page ${entity.page || '??'}`
                };

                // Add type-specific tooltip data
                switch (tag) {
                    case 'item':
                    case 'equipment':
                        tooltipData.properties = entity.properties;
                        tooltipData.value = entity.value;
                        break;
                    case 'class':
                        tooltipData.hitDice = entity.hitDice;
                        tooltipData.spellcasting = entity.spellcasting?.ability;
                        break;
                    case 'race':
                        tooltipData.size = entity.size;
                        tooltipData.speed = entity.speed;
                        tooltipData.ability = entity.ability;
                        break;
                }
            }

            // Create tooltip element
            const result = tooltipData ?
                this.createTooltipElement(tag, name, tooltipData) :
                name;

            // Cache and return
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.warn(`Error resolving reference ${fullMatch}:`, error);
            return name;
        }
    }

    createTooltipElement(type, text, data) {
        return `<span class="reference-link ${type}-reference" 
                      data-tooltip="${encodeURIComponent(this.createTooltipContent(data))}"
                      data-source="${data.source || ''}">${text}</span>`;
    }

    createTooltipContent(data) {
        let content = data.description || '';

        if (data.properties?.length) {
            content += `\n\nProperties: ${data.properties.join(', ')}`;
        }
        if (data.value) {
            content += `\n\nValue: ${data.value.amount} ${data.value.coin}`;
        }
        if (data.hitDice) {
            content += `\n\nHit Dice: ${data.hitDice}`;
        }
        if (data.spellcasting) {
            content += `\n\nSpellcasting Ability: ${data.spellcasting}`;
        }
        if (data.size) {
            content += `\n\nSize: ${data.size}`;
        }
        if (data.speed?.walk) {
            content += `\n\nSpeed: ${data.speed.walk} feet`;
        }
        if (data.ability) {
            content += `\n\nAbility Score Increase: ${data.ability}`;
        }

        return content;
    }

    clearCache() {
        this.cache.clear();
    }
} 