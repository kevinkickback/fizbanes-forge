/**
 * Armor.js
 * Model class representing armor in the D&D Character Creator
 */

import { Item } from './Item.js';

/**
 * Represents an armor item with its AC and special properties
 * @extends Item
 */
export class Armor extends Item {
    /**
     * Creates a new Armor instance
     * @param {Object} data - Raw armor data
     */
    constructor(data) {
        super(data);

        const armorType = data.armor?.type || '';

        /**
         * Armor category (legacy property)
         * @type {string}
         * @deprecated Use armorCategory instead
         */
        this.category = armorType;

        /**
         * Armor category (light, medium, heavy, shield)
         * @type {string}
         */
        this.armorCategory = armorType;

        /**
         * Base armor class without modifiers
         * @type {number}
         */
        this.baseAC = data.armor?.ac || 10;

        /**
         * Whether DEX modifier applies to AC
         * @type {boolean}
         */
        this.dexBonus = this.constructor.processDexBonus(data.armor);

        /**
         * Maximum DEX bonus that can be applied to AC
         * @type {number|null}
         */
        this.maxDexBonus = data.armor?.dex || null;

        /**
         * Minimum STR score required to wear without penalty
         * @type {number}
         */
        this.strengthRequired = data.armor?.strength || 0;

        /**
         * Whether the armor imposes disadvantage on stealth checks
         * @type {boolean}
         */
        this.stealthDisadvantage = data.armor?.stealth || false;
    }

    /**
     * Determines whether DEX bonus applies to AC based on armor type
     * @param {Object} armor - Armor data object
     * @returns {boolean} Whether DEX bonus applies
     * @static
     */
    static processDexBonus(armor) {
        if (!armor) return false;
        if (armor.type === 'light') return true;
        if (armor.type === 'medium') return true;
        return false;
    }

    /**
     * Gets the total AC with DEX modifier applied
     * @param {number} dexModifier - Character's DEX modifier
     * @returns {string} Formatted AC string
     */
    getACString(dexModifier = 0) {
        let ac = this.baseAC;

        if (this.dexBonus) {
            const effectiveDexMod = this.maxDexBonus !== null
                ? Math.min(dexModifier, this.maxDexBonus)
                : dexModifier;
            ac += effectiveDexMod;
        }

        return `${ac} AC`;
    }

    /**
     * Gets a detailed description of the armor type and properties
     * @returns {string} Formatted armor description
     */
    getArmorTypeDescription() {
        let desc = this.armorCategory.charAt(0).toUpperCase() + this.armorCategory.slice(1);
        desc += ' Armor';

        const details = [];
        if (this.strengthRequired) details.push(`Requires Str ${this.strengthRequired}`);
        if (this.stealthDisadvantage) details.push('Disadvantage on Stealth');
        if (this.maxDexBonus !== null) details.push(`Max Dex Bonus +${this.maxDexBonus}`);

        if (details.length) desc += ` (${details.join(', ')})`;
        return desc;
    }

    /**
     * Converts the armor to a JSON object
     * @returns {Object} JSON representation of the armor
     * @override
     */
    toJSON() {
        return {
            ...super.toJSON(),
            armorCategory: this.armorCategory,
            baseAC: this.baseAC,
            dexBonus: this.dexBonus,
            maxDexBonus: this.maxDexBonus,
            strengthRequired: this.strengthRequired,
            stealthDisadvantage: this.stealthDisadvantage
        };
    }

    /**
     * Returns a string representation of the armor
     * @returns {string} String representation
     * @override
     */
    toString() {
        return `${this.name} (${this.getArmorTypeDescription()})`;
    }
} 