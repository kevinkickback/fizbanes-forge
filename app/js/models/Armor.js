import { Item } from './Item.js';

export class Armor extends Item {
    constructor(data) {
        super(data);
        const armorType = data.armor?.type || '';
        this.category = armorType;
        this.armorCategory = armorType;
        this.baseAC = data.armor?.ac || 10;
        this.dexBonus = this.constructor.processDexBonus(data.armor);
        this.maxDexBonus = data.armor?.dex || null;
        this.strengthRequired = data.armor?.strength || 0;
        this.stealthDisadvantage = data.armor?.stealth || false;
    }

    static processDexBonus(armor) {
        if (!armor) return false;
        if (armor.type === 'light') return true;
        if (armor.type === 'medium') return true;
        return false;
    }

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
} 