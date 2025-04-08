/**
 * MagicItemManager.js
 * Manager for handling magic items and variants
 */

import { eventEmitter } from '../utils/EventEmitter.js';
import { characterInitializer } from '../utils/Initialize.js';

/**
 * Manages magic items and variants
 */
export class MagicItemManager {
    /**
     * Creates a new MagicItemManager instance
     * @private
     */
    constructor() {
        /**
         * Data loader for fetching item data
         * @type {DataLoader}
         * @private
         */
        this._dataLoader = characterInitializer.dataLoader;

        /**
         * Cache for loaded data
         * @type {Object}
         * @private
         */
        this._cache = {
            magicItems: null,
            variants: null
        };

        /**
         * Flag to track initialization state
         * @type {boolean}
         * @private
         */
        this._initialized = false;
    }

    /**
     * Initializes the magic item manager
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) {
            return;
        }

        try {
            console.debug('Initializing magic item manager');

            // Pre-load data into cache
            await Promise.all([
                this.loadMagicItems(),
                this.loadMagicVariants()
            ]);

            this._initialized = true;
            eventEmitter.emit('magicItemManager:initialized', this);
        } catch (error) {
            console.error('Failed to initialize magic item manager:', error);
            throw error;
        }
    }

    /**
     * Loads all available magic items
     * @returns {Promise<Array>} Array of magic items
     */
    async loadMagicItems() {
        if (this._cache.magicItems) {
            return this._cache.magicItems;
        }

        try {
            const itemData = await this._dataLoader.loadItems();
            this._cache.magicItems = itemData.item.filter(item => item.magical);
            return this._cache.magicItems;
        } catch (error) {
            console.error('Error loading magic items:', error);
            return [];
        }
    }

    /**
     * Loads all available magic variants
     * @returns {Promise<Array>} Array of magic variants
     */
    async loadMagicVariants() {
        if (this._cache.variants) {
            return this._cache.variants;
        }

        try {
            const itemData = await this._dataLoader.loadItems();
            this._cache.variants = this.processMagicVariants(itemData.magicvariant || []);
            return this._cache.variants;
        } catch (error) {
            console.error('Error loading magic variants:', error);
            return [];
        }
    }

    /**
     * Processes magic variants data 
     * @param {Array} variants - Raw magic variants data
     * @returns {Array} Processed magic variants
     * @private
     */
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

    /**
     * Processes magic properties
     * @param {Array} properties - Raw properties data
     * @returns {Array} Processed properties
     * @private
     */
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

    /**
     * Gets a magic item by ID
     * @param {string} itemId - ID of the magic item
     * @returns {Promise<Object|undefined>} Magic item object or undefined if not found
     */
    async getMagicItem(itemId) {
        const items = await this.loadMagicItems();
        return items.find(item => item.id === itemId);
    }

    /**
     * Gets a magic variant by ID
     * @param {string} variantId - ID of the magic variant
     * @returns {Promise<Object|undefined>} Magic variant object or undefined if not found
     */
    async getMagicVariant(variantId) {
        const variants = await this.loadMagicVariants();
        return variants.find(variant => variant.id === variantId);
    }

    /**
     * Gets a base item by name and source
     * @param {string} name - Base item name
     * @param {string} [source='PHB'] - Source book 
     * @returns {Promise<Object|undefined>} Base item object or undefined if not found
     */
    async getBaseItem(name, source = 'PHB') {
        const itemData = await this._dataLoader.loadItems();
        return itemData.baseitem.find(item =>
            item.name.toLowerCase() === name.toLowerCase() &&
            (item.source === source || !source)
        );
    }

    /**
     * Gets item fluff by name and source
     * @param {string} name - Item name
     * @param {string} [source='PHB'] - Source book
     * @returns {Promise<Object|undefined>} Item fluff object or undefined if not found
     */
    async getItemFluff(name, source = 'PHB') {
        const itemData = await this._dataLoader.loadItems();
        return itemData.fluff.find(f =>
            f.name.toLowerCase() === name.toLowerCase() &&
            (f.source === source || !source)
        );
    }

    /**
     * Applies a magic variant to a base item
     * @param {Object} baseItem - Base item object
     * @param {string} variantId - ID of the magic variant to apply
     * @returns {Promise<Object|null>} Modified item with magic properties or null if invalid
     */
    async applyMagicVariant(baseItem, variantId) {
        const variant = await this.getMagicVariant(variantId);
        console.debug('Found variant:', variant);
        if (!variant) {
            console.warn('No variant found with ID:', variantId);
            return null;
        }

        // Check if the base item meets the variant requirements
        console.debug('Checking requirements for base item:', baseItem);
        console.debug('Against variant requirements:', variant.requires);
        if (!this.checkVariantRequirements(baseItem, variant)) {
            console.warn('Failed variant requirements check');
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

    /**
     * Checks if an item meets variant requirements
     * @param {Object} item - Item to check
     * @param {Object} variant - Variant with requirements
     * @returns {boolean} True if requirements are met
     * @private
     */
    checkVariantRequirements(item, variant) {
        if (!variant.requires || variant.requires.length === 0) {
            console.debug('No requirements to check');
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
                console.debug('Checking weapon requirement:', { isWeapon, itemType: item.type, itemProperties: item.properties });
                return isWeapon;
            }

            // Handle armor requirement
            if (req.armor === true) {
                const isArmor = item.type === 'armor' ||
                    item.armorCategory ||
                    item.armor === true;
                console.debug('Checking armor requirement:', { isArmor, itemType: item.type, itemCategory: item.armorCategory });
                return isArmor;
            }

            // Handle ammunition requirement
            if (req.ammo === true) {
                const isAmmo = item.type === 'ammunition' ||
                    item.ammoType ||
                    item.ammunition === true;
                console.debug('Checking ammunition requirement:', { isAmmo, itemType: item.type, itemAmmoType: item.ammoType });
                return isAmmo;
            }

            // Handle other requirements
            switch (req.type) {
                case 'type': {
                    console.debug('Checking type requirement:', { required: req.value, actual: item.type });
                    return item.type === req.value;
                }
                case 'category': {
                    console.debug('Checking category requirement:', { required: req.value, actual: item.category });
                    return item.category === req.value;
                }
                case 'property': {
                    const hasProperty = item.properties?.some(p => (p?.name || p) === req.value);
                    console.debug('Checking property requirement:', { required: req.value, properties: item.properties, hasProperty });
                    return hasProperty;
                }
                default: {
                    // If we don't recognize the requirement type, assume it's met
                    console.warn('Unknown requirement type:', req);
                    return true;
                }
            }
        });
    }

    /**
     * Generates a name for a magic item
     * @param {Object} baseItem - Base item object
     * @param {Object} variant - Magic variant object
     * @returns {string} Generated name
     * @private
     */
    generateMagicItemName(baseItem, variant) {
        if (variant.namePattern) {
            return variant.namePattern.replace('{base}', baseItem.name);
        }
        return `${variant.name} ${baseItem.name}`;
    }

    /**
     * Clears the cache
     */
    clearCache() {
        this._cache.magicItems = null;
        this._cache.variants = null;
        console.debug('Magic item manager cache cleared');
    }
}

/**
 * Export the singleton instance
 * @type {MagicItemManager}
 */
export const magicItemManager = new MagicItemManager(); 