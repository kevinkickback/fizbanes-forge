export class MagicItemManager {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.cache = {
            magicItems: null,
            variants: null
        };
    }

    async loadMagicItems() {
        if (this.cache.magicItems) {
            return this.cache.magicItems;
        }

        try {
            const items = await this.dataLoader.loadItems();
            this.cache.magicItems = items.filter(item => item.magical);
            return this.cache.magicItems;
        } catch (error) {
            console.error('Error loading magic items:', error);
            return [];
        }
    }

    async loadMagicVariants() {
        if (this.cache.variants) {
            return this.cache.variants;
        }

        try {
            const variants = await this.dataLoader.loadJsonFile('magicvariants.json');
            this.cache.variants = this.processMagicVariants(variants.magicvariant || []);
            return this.cache.variants;
        } catch (error) {
            console.error('Error loading magic variants:', error);
            return [];
        }
    }

    processMagicVariants(variants) {
        return variants.map(variant => {
            // Generate a consistent ID for the variant
            let id;
            // Handle different types of +X items
            if (variant.type === 'GV|DMG') {
                if (variant.name === '+1 Weapon') {
                    id = '+1-weapon-dmg';
                } else if (variant.name === '+2 Weapon') {
                    id = '+2-weapon-dmg';
                } else if (variant.name === '+3 Weapon') {
                    id = '+3-weapon-dmg';
                } else if (variant.name === '+1 Shield (*)') {
                    id = '+1-shield-dmg';
                } else if (variant.name === '+2 Shield (*)') {
                    id = '+2-shield-dmg';
                } else if (variant.name === '+3 Shield (*)') {
                    id = '+3-shield-dmg';
                } else if (variant.name === '+1 Armor') {
                    id = '+1-armor-dmg';
                } else if (variant.name === '+2 Armor') {
                    id = '+2-armor-dmg';
                } else if (variant.name === '+3 Armor') {
                    id = '+3-armor-dmg';
                } else if (variant.name === '+1 Ammunition') {
                    id = '+1-ammunition-dmg';
                } else if (variant.name === '+2 Ammunition') {
                    id = '+2-ammunition-dmg';
                } else if (variant.name === '+3 Ammunition') {
                    id = '+3-ammunition-dmg';
                } else {
                    id = variant.id || `${variant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(variant.source || 'dmg').toLowerCase()}`;
                }
            } else {
                id = variant.id || `${variant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(variant.source || 'dmg').toLowerCase()}`;
            }

            // Get name from variant or inherits
            const name = variant.name || (variant.inherits?.namePrefix?.trim() || '');

            // Get requirements
            const requires = [...(variant.requires || [])];
            if (variant.excludes?.net) {
                requires.push({ weapon: true });  // Add weapon requirement for +X weapons
            }

            // Handle special requirements for different item types
            if (variant.name?.includes('Shield')) {
                requires.push({ type: 'S' });  // Shield type requirement
            } else if (variant.name?.includes('Armor')) {
                requires.push({ armor: true });  // Armor requirement
            } else if (variant.name?.includes('Ammunition')) {
                requires.push({ ammo: true });  // Ammunition requirement
            }

            return {
                id,
                name,
                source: variant.source || variant.inherits?.source || 'DMG',
                type: variant.type,
                rarity: variant.rarity || variant.inherits?.rarity,
                requires,
                inherits: variant.inherits || null,
                bonuses: {
                    weapon: variant.bonusWeapon || variant.inherits?.bonusWeapon || null,
                    armor: variant.bonusAc || variant.inherits?.bonusAc || null,
                    spells: variant.bonusSpellAttack || variant.inherits?.bonusSpellAttack || null
                },
                properties: this.processMagicProperties(variant.properties)
            };
        });
    }

    processMagicProperties(properties) {
        if (!properties) return [];

        return properties.map(prop => {
            if (typeof prop === 'string') {
                const [name, detail] = prop.split('|');
                return { name, detail: detail || null };
            }
            return prop;
        });
    }

    async getMagicItem(itemId) {
        const items = await this.loadMagicItems();
        return items.find(item => item.id === itemId);
    }

    async getMagicVariant(variantId) {
        const variants = await this.loadMagicVariants();
        return variants.find(variant => variant.id === variantId);
    }

    async applyMagicVariant(baseItem, variantId) {
        const variant = await this.getMagicVariant(variantId);
        console.log('Found variant:', variant);
        if (!variant) {
            console.log('No variant found with ID:', variantId);
            return null;
        }

        // Check if the base item meets the variant requirements
        console.log('Checking requirements for base item:', baseItem);
        console.log('Against variant requirements:', variant.requires);
        if (!this.checkVariantRequirements(baseItem, variant)) {
            console.log('Failed variant requirements check');
            return null;
        }

        return {
            ...baseItem,
            ...variant,
            name: this.generateMagicItemName(baseItem, variant),
            magical: true,
            bonuses: {
                ...baseItem.bonuses,
                ...variant.bonuses
            },
            properties: [
                ...(baseItem.properties || []),
                ...(variant.properties || [])
            ]
        };
    }

    checkVariantRequirements(item, variant) {
        if (!variant.requires || variant.requires.length === 0) {
            console.log('No requirements to check');
            return true;
        }

        return variant.requires.every(req => {
            // Handle weapon requirement
            if (req.weapon === true) {
                const isWeapon = item.type === 'weapon' ||
                    item.weaponCategory ||
                    item.weapon === true ||
                    item.properties?.some(p =>
                        ['melee', 'ranged', 'thrown', 'ammunition', 'finesse', 'heavy', 'light', 'loading', 'reach', 'versatile'].includes(p?.name || p)
                    );
                console.log('Checking weapon requirement:', { isWeapon, itemType: item.type, itemProperties: item.properties });
                return isWeapon;
            }

            // Handle armor requirement
            if (req.armor === true) {
                const isArmor = item.type === 'armor' ||
                    item.armorCategory ||
                    item.armor === true;
                console.log('Checking armor requirement:', { isArmor, itemType: item.type, itemCategory: item.armorCategory });
                return isArmor;
            }

            // Handle ammunition requirement
            if (req.ammo === true) {
                const isAmmo = item.type === 'ammunition' ||
                    item.ammoType ||
                    item.ammunition === true;
                console.log('Checking ammunition requirement:', { isAmmo, itemType: item.type, itemAmmoType: item.ammoType });
                return isAmmo;
            }

            // Handle other requirements
            switch (req.type) {
                case 'type': {
                    console.log('Checking type requirement:', { required: req.value, actual: item.type });
                    return item.type === req.value;
                }
                case 'category': {
                    console.log('Checking category requirement:', { required: req.value, actual: item.category });
                    return item.category === req.value;
                }
                case 'property': {
                    const hasProperty = item.properties?.some(p => (p?.name || p) === req.value);
                    console.log('Checking property requirement:', { required: req.value, properties: item.properties, hasProperty });
                    return hasProperty;
                }
                default: {
                    // If we don't recognize the requirement type, assume it's met
                    console.log('Unknown requirement type:', req);
                    return true;
                }
            }
        });
    }

    generateMagicItemName(baseItem, variant) {
        if (variant.namePattern) {
            return variant.namePattern.replace('{base}', baseItem.name);
        }
        return `${variant.name} ${baseItem.name}`;
    }

    clearCache() {
        this.cache.magicItems = null;
        this.cache.variants = null;
    }
} 