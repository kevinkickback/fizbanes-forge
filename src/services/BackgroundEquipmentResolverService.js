import { unpackUid } from '../lib/5eToolsParser.js';
import { itemService } from './ItemService.js';

const EQUIPMENT_TYPE_LABELS = Object.freeze({
    toolArtisan: "Artisan's Tools (any)",
    instrumentMusical: 'Musical Instrument (any)',
    setGaming: 'Gaming Set (any)',
});

class BackgroundEquipmentResolverService {
    resolve(background, equipmentChoices) {
        const items = [];
        const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

        if (!background?.equipment) return { items, currency };

        let choiceIndex = 0;
        for (let i = 0; i < background.equipment.length; i++) {
            const eq = background.equipment[i];

            if (eq._) this._collectItems(eq._, items, currency);

            const choiceKeys = Object.keys(eq).filter(k => k !== '_').sort();
            if (choiceKeys.length > 1) {
                const choiceKey = equipmentChoices?.[choiceIndex];
                if (choiceKey && eq[choiceKey]) {
                    this._collectItems(eq[choiceKey], items, currency);
                }
                choiceIndex++;
            }
        }

        return { items, currency };
    }

    _collectItems(arr, items, currency) {
        for (const entry of arr) {
            if (typeof entry === 'string') {
                this._resolveStringEntry(entry, items);
            } else if (entry.value != null && !entry.item && !entry.special) {
                this._resolveCurrencyEntry(entry, currency);
            } else if (entry.equipmentType) {
                this._resolveEquipmentTypeEntry(entry, items);
            } else if (entry.item) {
                this._resolveItemEntry(entry, items, currency);
            } else if (entry.special) {
                this._resolveSpecialEntry(entry, items);
            }
        }
    }

    _resolveStringEntry(entry, items) {
        const { name, source } = unpackUid(entry);
        if (!name) return;
        try {
            const resolved = itemService.getItem(name, source || 'PHB');
            items.push({ ...resolved, quantity: 1 });
        } catch {
            items.push({ name, source: source || 'PHB', weight: 0, quantity: 1 });
        }
    }

    _resolveCurrencyEntry(entry, currency) {
        const converted = this._copperToCurrency(entry.value);
        currency.gp += converted.gp;
        currency.sp += converted.sp;
        currency.cp += converted.cp;
    }

    _resolveEquipmentTypeEntry(entry, items) {
        const name = EQUIPMENT_TYPE_LABELS[entry.equipmentType] || entry.equipmentType;
        items.push({ name, source: 'PHB', weight: 0, quantity: 1 });
    }

    _resolveItemEntry(entry, items, currency) {
        const { name, source } = unpackUid(entry.item);
        const qty = entry.quantity || 1;
        if (entry.containsValue) {
            const converted = this._copperToCurrency(entry.containsValue);
            currency.gp += converted.gp;
            currency.sp += converted.sp;
            currency.cp += converted.cp;
        }
        try {
            const resolved = itemService.getItem(
                entry.displayName || name,
                source || 'PHB',
            );
            items.push({ ...resolved, quantity: qty });
        } catch {
            items.push({
                name: entry.displayName || name,
                source: source || 'PHB',
                weight: 0,
                quantity: qty,
            });
        }
    }

    _resolveSpecialEntry(entry, items) {
        items.push({
            name: entry.special,
            source: 'PHB',
            weight: 0,
            quantity: entry.quantity || 1,
        });
    }

    _copperToCurrency(value) {
        const gp = Math.floor(value / 100);
        const remainder = value % 100;
        const sp = Math.floor(remainder / 10);
        const cp = remainder % 10;
        return { gp, sp, cp };
    }
}

export const backgroundEquipmentResolverService = new BackgroundEquipmentResolverService();
