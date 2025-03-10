import { Item } from './Item.js';

export class Weapon extends Item {
    constructor(data) {
        super(data);
        this.weaponCategory = data.weaponCategory || '';
        this.damage = this.constructor.processDamage(data.dmg1);
        this.damageType = data.dmgType || '';
        this.range = this.constructor.processRange(data.range);
        this.ammunition = data.ammo || false;
        this.versatile = this.constructor.processDamage(data.dmg2);
        this.thrown = data.property?.includes('thrown') || false;
        this.loading = data.property?.includes('loading') || false;
        this.finesse = data.property?.includes('finesse') || false;
        this.reach = data.property?.includes('reach') || false;
        this.heavy = data.property?.includes('heavy') || false;
        this.light = data.property?.includes('light') || false;
        this.twoHanded = data.property?.includes('two-handed') || false;
    }

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

    getAverageBaseDamage() {
        if (!this.damage) return 0;
        return (this.damage.diceCount * (this.damage.diceValue + 1) / 2) + this.damage.modifier;
    }

    getAverageVersatileDamage() {
        if (!this.versatile) return 0;
        return (this.versatile.diceCount * (this.versatile.diceValue + 1) / 2) + this.versatile.modifier;
    }

    getDamageFormula() {
        if (!this.damage) return '';
        let formula = `${this.damage.diceCount}d${this.damage.diceValue}`;
        if (this.damage.modifier) formula += ` + ${this.damage.modifier}`;
        return formula;
    }

    getVersatileDamageFormula() {
        if (!this.versatile) return '';
        let formula = `${this.versatile.diceCount}d${this.versatile.diceValue}`;
        if (this.versatile.modifier) formula += ` + ${this.versatile.modifier}`;
        return formula;
    }

    getRangeDescription() {
        if (!this.range) return 'Melee';
        if (!this.range.long) return `${this.range.normal} ft.`;
        return `${this.range.normal}/${this.range.long} ft.`;
    }

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
} 