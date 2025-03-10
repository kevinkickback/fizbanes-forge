export class Item {
    constructor(data) {
        this.id = `${data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(data.source || 'phb').toLowerCase()}` || '';
        this.name = data.name || '';
        this.source = data.source || 'PHB';
        this.page = data.page || 0;
        this.type = this.constructor.getItemType(data);
        this.rarity = data.rarity || 'common';
        this.value = this.constructor.processValue(data.value);
        this.weight = data.weight || 0;
        this.description = data.description || '';
        this.properties = this.constructor.processProperties(data.property);
        this.attunement = this.constructor.processAttunement(data.reqAttune);
        this.quantity = data.quantity || 1;
        this.equipped = false;
        this.attuned = false;
    }

    static getItemType(data) {
        if (data.weapon || data.weaponCategory) return 'weapon';
        if (data.armor) return 'armor';
        if (data.containerCapacity) return 'container';
        if (data.ammoType) return 'ammunition';
        if (data.type === 'P') return 'potion';
        if (data.type === 'SC') return 'scroll';
        if (data.type === 'WD') return 'wand';
        if (data.type === 'RD') return 'rod';
        if (data.type === 'RG') return 'ring';
        if (data.type === 'G') return 'gear';
        return 'item';
    }

    static processValue(value) {
        if (!value) return 0;
        const match = String(value).match(/(\d+)\s*([cgsp]p)/i);
        if (!match) return 0;

        const amount = parseInt(match[1]);
        const currency = match[2].toLowerCase();

        // Convert to copper pieces for standardization
        switch (currency) {
            case 'cp': return amount;
            case 'sp': return amount * 10;
            case 'gp': return amount * 100;
            case 'pp': return amount * 1000;
            default: return 0;
        }
    }

    static processProperties(properties) {
        if (!properties) return [];
        return Array.isArray(properties) ? properties : [properties];
    }

    static processAttunement(reqAttune) {
        if (!reqAttune) return false;
        if (reqAttune === true) return true;
        if (typeof reqAttune === 'string') return reqAttune;
        return false;
    }

    // Instance methods
    equip() {
        if (this.canBeEquipped()) {
            this.equipped = true;
            return true;
        }
        return false;
    }

    unequip() {
        this.equipped = false;
        return true;
    }

    attune() {
        if (this.canBeAttuned() && !this.attuned) {
            this.attuned = true;
            return true;
        }
        return false;
    }

    unattune() {
        if (this.attuned) {
            this.attuned = false;
            return true;
        }
        return false;
    }

    canBeEquipped() {
        return ['weapon', 'armor', 'shield', 'ammunition'].includes(this.type);
    }

    canBeAttuned() {
        return this.attunement !== false;
    }

    addQuantity(amount) {
        this.quantity = Math.max(0, this.quantity + amount);
        return this.quantity;
    }

    getValueInGold() {
        return this.value / 100;
    }

    getFormattedValue() {
        if (this.value === 0) return '0 cp';
        if (this.value >= 1000) return `${this.value / 1000} pp`;
        if (this.value >= 100) return `${this.value / 100} gp`;
        if (this.value >= 10) return `${this.value / 10} sp`;
        return `${this.value} cp`;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            source: this.source,
            page: this.page,
            type: this.type,
            rarity: this.rarity,
            value: this.value,
            weight: this.weight,
            description: this.description,
            properties: this.properties,
            attunement: this.attunement,
            quantity: this.quantity,
            equipped: this.equipped,
            attuned: this.attuned
        };
    }
} 