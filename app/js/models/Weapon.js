/**
 * Weapon.js
 * Model class representing a weapon in the D&D Character Creator
 */

import { Item } from './Item.js';

/**
 * Represents a weapon with its damage, range, and special properties
 * @extends Item
 */
export class Weapon extends Item {
    /**
     * Creates a new Weapon instance
     * @param {Object} data - Raw weapon data
     */
    constructor(data) {
        super(data);

        /**
         * Weapon category (simple, martial, etc.)
         * @type {string}
         */
        this.weaponCategory = data.weaponCategory || '';

        /**
         * Base damage information
         * @type {Object|null}
         */
        this.damage = this.constructor.processDamage(data.dmg1);

        /**
         * Damage type (slashing, piercing, bludgeoning, etc.)
         * @type {string}
         */
        this.damageType = data.dmgType || '';

        /**
         * Weapon range 
         * @type {Object|null}
         */
        this.range = this.constructor.processRange(data.range);

        /**
         * Whether the weapon requires ammunition
         * @type {boolean}
         */
        this.ammunition = data.ammo || false;

        /**
         * Versatile damage information (when used with two hands)
         * @type {Object|null}
         */
        this.versatile = this.constructor.processDamage(data.dmg2);

        /**
         * Whether the weapon has the thrown property
         * @type {boolean}
         */
        this.thrown = data.property?.includes('thrown') || false;

        /**
         * Whether the weapon has the loading property
         * @type {boolean}
         */
        this.loading = data.property?.includes('loading') || false;

        /**
         * Whether the weapon has the finesse property
         * @type {boolean}
         */
        this.finesse = data.property?.includes('finesse') || false;

        /**
         * Whether the weapon has the reach property
         * @type {boolean}
         */
        this.reach = data.property?.includes('reach') || false;

        /**
         * Whether the weapon has the heavy property
         * @type {boolean}
         */
        this.heavy = data.property?.includes('heavy') || false;

        /**
         * Whether the weapon has the light property
         * @type {boolean}
         */
        this.light = data.property?.includes('light') || false;

        /**
         * Whether the weapon requires two hands
         * @type {boolean}
         */
        this.twoHanded = data.property?.includes('two-handed') || false;
    }

    //-------------------------------------------------------------------------
    // Data processing methods
    //-------------------------------------------------------------------------

    /**
     * Processes damage string into a structured object
     * @param {string} damage - Raw damage string (e.g., "1d6+2")
     * @returns {Object|null} Structured damage object or null if invalid
     * @static
     */
    static processDamage(damage) {
        if (!damage) return null;
        const match = String(damage).match(/(\d+)d(\d+)(?:\s*\+\s*(\d+))?/);
        if (!match) return null;

        return {
            diceCount: Number.parseInt(match[1], 10),
            diceValue: Number.parseInt(match[2], 10),
            modifier: match[3] ? Number.parseInt(match[3], 10) : 0
        };
    }

    /**
     * Processes range string into a structured object
     * @param {string|number} range - Raw range string or number
     * @returns {Object|null} Structured range object or null if invalid
     * @static
     */
    static processRange(range) {
        if (!range) return null;
        if (typeof range === 'number') return { normal: range, long: null };

        const match = String(range).match(/(\d+)\/(\d+)/);
        if (!match) return { normal: 5, long: null };

        return {
            normal: Number.parseInt(match[1], 10),
            long: Number.parseInt(match[2], 10)
        };
    }

    //-------------------------------------------------------------------------
    // Damage calculation methods
    //-------------------------------------------------------------------------

    /**
     * Calculates the average base damage
     * @returns {number} Average damage value
     */
    getAverageBaseDamage() {
        if (!this.damage) return 0;
        return (this.damage.diceCount * (this.damage.diceValue + 1) / 2) + this.damage.modifier;
    }

    /**
     * Calculates the average versatile damage (when used with two hands)
     * @returns {number} Average versatile damage value
     */
    getAverageVersatileDamage() {
        if (!this.versatile) return 0;
        return (this.versatile.diceCount * (this.versatile.diceValue + 1) / 2) + this.versatile.modifier;
    }

    /**
     * Gets the damage formula string
     * @returns {string} Damage formula (e.g., "1d6 + 2")
     */
    getDamageFormula() {
        if (!this.damage) return '';
        let formula = `${this.damage.diceCount}d${this.damage.diceValue}`;
        if (this.damage.modifier) formula += ` + ${this.damage.modifier}`;
        return formula;
    }

    /**
     * Gets the versatile damage formula string
     * @returns {string} Versatile damage formula
     */
    getVersatileDamageFormula() {
        if (!this.versatile) return '';
        let formula = `${this.versatile.diceCount}d${this.versatile.diceValue}`;
        if (this.versatile.modifier) formula += ` + ${this.versatile.modifier}`;
        return formula;
    }

    //-------------------------------------------------------------------------
    // Display methods
    //-------------------------------------------------------------------------

    /**
     * Gets a formatted description of the weapon's range
     * @returns {string} Range description
     */
    getRangeDescription() {
        if (!this.range) return 'Melee';
        if (!this.range.long) return `${this.range.normal} ft.`;
        return `${this.range.normal}/${this.range.long} ft.`;
    }

    //-------------------------------------------------------------------------
    // Utility methods
    //-------------------------------------------------------------------------

    /**
     * Converts the weapon to a JSON object
     * @returns {Object} JSON representation of the weapon
     * @override
     */
    toJSON() {
        return {
            ...super.toJSON(),
            weaponCategory: this.weaponCategory,
            damage: this.damage,
            damageType: this.damageType,
            range: this.range,
            ammunition: this.ammunition,
            versatile: this.versatile,
            thrown: this.thrown,
            loading: this.loading,
            finesse: this.finesse,
            reach: this.reach,
            heavy: this.heavy,
            light: this.light,
            twoHanded: this.twoHanded
        };
    }

    /**
     * Returns a string representation of the weapon
     * @returns {string} String representation
     * @override
     */
    toString() {
        return `${this.name} (${this.weaponCategory} weapon, ${this.getDamageFormula()} ${this.damageType})`;
    }
} 