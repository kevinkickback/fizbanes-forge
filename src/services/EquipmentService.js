import { unpackUid } from '../lib/5eToolsParser.js';
import { NotFoundError, ValidationError } from '../lib/Errors.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import {
	addItemArgsSchema,
	removeItemArgsSchema,
	removeItemsBySourceArgsSchema,
	validateInput,
} from '../lib/ValidationSchemas.js';
import { itemService } from './ItemService.js';

class EquipmentService {
	constructor() {
		this.MAX_ATTUNEMENT_SLOTS = 3;
		this.CARRY_CAPACITY_MULTIPLIER = 15;
		this.LIGHT_ENCUMBRANCE_MULTIPLIER = 5;
		this.HEAVY_ENCUMBRANCE_MULTIPLIER = 10;
	}

	_getTypeCode(item) {
		return String(item.type || '').split('|')[0].toUpperCase();
	}

	isEquippable(item) {
		if (item.weapon || item.armor) return true;
		const typeCode = this._getTypeCode(item);
		return ['LA', 'MA', 'HA', 'S', 'M', 'R'].includes(typeCode);
	}

	isAttuneable(item) {
		return !!item.reqAttune;
	}

	isArmor(item) {
		if (item.armor) return true;
		const typeCode = this._getTypeCode(item);
		return ['LA', 'MA', 'HA'].includes(typeCode);
	}

	isShield(item) {
		return this._getTypeCode(item) === 'S';
	}

	_generateItemInstanceId() {
		return `item-${crypto.randomUUID()}`;
	}

	addItem(character, itemData, quantity = 1, source = 'Manual') {
		const validated = validateInput(
			addItemArgsSchema,
			{ character, itemData, quantity, source },
			'Invalid parameters for addItem',
		);

		const { character: char, itemData: item, quantity: qty, source: src } = validated;

		if (!char.inventory) {
			throw new ValidationError('Character has no inventory initialized', {
				characterId: char.id,
			});
		}

		const itemInstance = {
			id: this._generateItemInstanceId(),
			name: item.name,
			baseItemId: item.id || item.name,
			quantity: Math.max(1, qty),
			equipped: false,
			attuned: false,
			cost: item.cost ? { ...item.cost } : null,
			weight: item.weight || 0,
			ac: item.ac || 0,
			source: item.source || 'Unknown',
			type: item.type || null,
			weapon: item.weapon || false,
			armor: item.armor || false,
			shield: this._getTypeCode(item) === 'S',
			reqAttune: item.reqAttune || false,
			metadata: {
				addedAt: new Date().toISOString(),
				addedFrom: src,
			},
		};

		char.inventory.items.push(itemInstance);
		this._updateInventoryWeight(char);

		eventBus.emit(EVENTS.ITEM_ADDED, char, itemInstance);
		return itemInstance;
	}

	_ensureEquippedArray(inventory) {
		if (!Array.isArray(inventory.equipped)) {
			inventory.equipped = [];
		}
	}

	removeItem(character, itemInstanceId, quantity = 1) {
		const validated = validateInput(
			removeItemArgsSchema,
			{ character, itemInstanceId, quantity },
			'Invalid parameters for removeItem',
		);

		const { character: char, itemInstanceId: instanceId, quantity: qty } = validated;

		if (!char.inventory) {
			throw new ValidationError('Character has no inventory initialized', {
				characterId: char.id,
			});
		}

		const itemIndex = char.inventory.items.findIndex(
			(item) => item.id === instanceId,
		);

		if (itemIndex === -1) {
			throw new NotFoundError('Item', instanceId, {
				characterId: char.id,
			});
		}

		const item = char.inventory.items[itemIndex];

		// If removing all quantity, delete the item entirely
		if (qty >= item.quantity) {
			// Unequip if needed
			if (item.equipped) {
				this.unequipItem(char, instanceId);
			}

			// Unatune if needed
			if (item.attuned) {
				this.unattuneItem(char, instanceId);
			}

			char.inventory.items.splice(itemIndex, 1);
		} else {
			// Reduce quantity
			item.quantity -= qty;
		}

		this._updateInventoryWeight(char);

		eventBus.emit(EVENTS.ITEM_REMOVED, char, item);
		return true;
	}

	equipItem(character, itemInstanceId) {
		if (!character.inventory) {
			throw new ValidationError('Character has no inventory initialized', {
				characterId: character.id,
			});
		}

		this._ensureEquippedArray(character.inventory);

		const item = character.inventory.items.find((i) => i.id === itemInstanceId);
		if (!item) {
			throw new NotFoundError('Item', itemInstanceId, {
				characterId: character.id,
			});
		}

		if (item.equipped) return true;

		if (this.isArmor(item)) {
			const existingArmor = character.inventory.items.find(
				(i) => i.equipped && i.id !== itemInstanceId && this.isArmor(i),
			);
			if (existingArmor) {
				throw new ValidationError(
					`Cannot equip ${item.name} — already wearing ${existingArmor.name}. Unequip it first.`,
					{ itemId: itemInstanceId, conflictId: existingArmor.id },
				);
			}
		}

		if (this.isShield(item)) {
			const existingShield = character.inventory.items.find(
				(i) => i.equipped && i.id !== itemInstanceId && this.isShield(i),
			);
			if (existingShield) {
				throw new ValidationError(
					`Cannot equip ${item.name} — already using ${existingShield.name}. Unequip it first.`,
					{ itemId: itemInstanceId, conflictId: existingShield.id },
				);
			}
		}

		item.equipped = true;
		if (!character.inventory.equipped.includes(itemInstanceId)) {
			character.inventory.equipped.push(itemInstanceId);
		}

		eventBus.emit(EVENTS.ITEM_EQUIPPED, character, item);
		return true;
	}

	unequipItem(character, itemInstanceId) {
		if (!character.inventory) {
			throw new ValidationError('Character has no inventory initialized', {
				characterId: character.id,
			});
		}

		this._ensureEquippedArray(character.inventory);

		const index = character.inventory.equipped.indexOf(itemInstanceId);
		if (index === -1) {
			throw new NotFoundError('Equipped item', itemInstanceId, {
				characterId: character.id,
			});
		}

		character.inventory.equipped.splice(index, 1);

		const item = character.inventory.items.find(
			(i) => i.id === itemInstanceId,
		);
		if (item) {
			item.equipped = false;
			eventBus.emit(EVENTS.ITEM_UNEQUIPPED, character, item);
		}

		return true;
	}

	attuneItem(character, itemInstanceId) {
		if (!character.inventory) {
			throw new ValidationError('Character has no inventory initialized', {
				characterId: character.id,
			});
		}

		const item = character.inventory.items.find((i) => i.id === itemInstanceId);

		if (!item) {
			throw new NotFoundError('Item', itemInstanceId, {
				characterId: character.id,
			});
		}

		if (!character.inventory.attuned.includes(itemInstanceId)) {
			character.inventory.attuned.push(itemInstanceId);
		}

		item.attuned = true;

		eventBus.emit(EVENTS.ITEM_ATTUNED, character, item);
		return true;
	}

	unattuneItem(character, itemInstanceId) {
		if (!character.inventory) {
			throw new ValidationError('Character has no inventory initialized', {
				characterId: character.id,
			});
		}

		const index = character.inventory.attuned.indexOf(itemInstanceId);

		if (index === -1) {
			throw new NotFoundError('Attuned item', itemInstanceId, {
				characterId: character.id,
			});
		}

		character.inventory.attuned.splice(index, 1);

		const item = character.inventory.items.find((i) => i.id === itemInstanceId);

		if (item) {
			item.attuned = false;

			eventBus.emit(EVENTS.ITEM_UNATTUNED, character, item);
		}

		return true;
	}

	calculateTotalWeight(character) {
		if (!character.inventory) return 0;

		return character.inventory.items.reduce((total, item) => {
			return total + item.weight * item.quantity;
		}, 0);
	}

	_getCarryCapacityModifier(character) {
		if (character.traits?.includes('Powerful Build')) {
			return 2;
		}

		if (character.race?.traits?.includes('Powerful Build')) {
			return 2;
		}

		return 1;
	}

	/** Carry capacity = STR × 15 lbs, modified by Powerful Build etc. */
	calculateCarryCapacity(character) {
		const strength = character.abilityScores?.strength || 10;
		const baseCapacity = strength * this.CARRY_CAPACITY_MULTIPLIER;
		const modifier = this._getCarryCapacityModifier(character);
		return Math.floor(baseCapacity * modifier);
	}

	/**
	 * Compute the character's effective Armor Class from equipped items.
	 * Rules: unarmored = 10 + DEX; light = ac + DEX; medium = ac + min(DEX, 2);
	 * heavy = flat ac; shield always adds its ac bonus (default +2).
	 */
	computeArmorClass(character) {
		const dex = character.abilityScores?.dexterity ?? 10;
		const dexMod = Math.floor((dex - 10) / 2);
		const items = character.inventory?.items || [];

		const armor = items.find((i) => i.equipped && this.isArmor(i));
		const shield = items.find((i) => i.equipped && this.isShield(i));

		let ac;
		if (!armor) {
			ac = 10 + dexMod;
		} else {
			const typeCode = this._getTypeCode(armor);
			const armorAc = armor.ac || 0;
			if (typeCode === 'LA') {
				ac = armorAc + dexMod;
			} else if (typeCode === 'MA') {
				ac = armorAc + Math.min(dexMod, 2);
			} else {
				// Heavy armor: flat AC, no DEX bonus
				ac = armorAc;
			}
		}

		if (shield) {
			ac += shield.ac || 2;
		}

		return ac;
	}

	_updateInventoryWeight(character) {
		if (!character.inventory) return;

		character.inventory.weight.current = this.calculateTotalWeight(character);
		character.inventory.weight.capacity =
			this.calculateCarryCapacity(character);
	}

	getInventoryItems(character) {
		return character.inventory?.items || [];
	}

	getAttunedItems(character) {
		if (!character.inventory) return [];

		return character.inventory.items.filter((item) =>
			character.inventory.attuned.includes(item.id),
		);
	}

	findItemById(character, itemInstanceId) {
		return (
			character.inventory?.items.find((item) => item.id === itemInstanceId) ||
			null
		);
	}

	removeItemsBySource(character, source) {
		const validated = validateInput(
			removeItemsBySourceArgsSchema,
			{ character, source },
			'Invalid parameters for removeItemsBySource',
		);

		const { character: char, source: src } = validated;

		if (!char.inventory) {
			return [];
		}

		const removed = [];

		for (let i = char.inventory.items.length - 1; i >= 0; i--) {
			const item = char.inventory.items[i];
			if (item.metadata?.addedFrom === src) {
				if (item.equipped) {
					const equippedIdx = char.inventory.equipped.indexOf(item.id);
					if (equippedIdx !== -1) char.inventory.equipped.splice(equippedIdx, 1);
					item.equipped = false;
				}
				if (item.attuned) {
					const attunedIdx = char.inventory.attuned.indexOf(item.id);
					if (attunedIdx !== -1) char.inventory.attuned.splice(attunedIdx, 1);
					item.attuned = false;
				}
				char.inventory.items.splice(i, 1);
				removed.push(item);
			}
		}

		this._updateInventoryWeight(char);
		eventBus.emit(EVENTS.INVENTORY_UPDATED, char);
		return removed;
	}

	addCurrency(character, currency) {
		if (!character?.inventory?.currency) {
			throw new ValidationError('Character has no inventory currency initialized', {
				characterId: character?.id,
			});
		}

		const denoms = ['cp', 'sp', 'ep', 'gp', 'pp'];
		for (const denom of denoms) {
			if (currency[denom]) {
				character.inventory.currency[denom] =
					(character.inventory.currency[denom] || 0) + currency[denom];
			}
		}

		eventBus.emit(EVENTS.INVENTORY_UPDATED, character);
	}

	_copperToCurrency(value) {
		const gp = Math.floor(value / 100);
		const remainder = value % 100;
		const sp = Math.floor(remainder / 10);
		const cp = remainder % 10;
		return { gp, sp, cp };
	}

	resolveBackgroundEquipment(background, equipmentChoices) {
		const EQUIPMENT_TYPE_LABELS = {
			toolArtisan: "Artisan's Tools (any)",
			instrumentMusical: 'Musical Instrument (any)',
			setGaming: 'Gaming Set (any)',
		};

		const items = [];
		const currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

		const collectItems = (arr) => {
			for (const entry of arr) {
				if (typeof entry === 'string') {
					const { name, source } = unpackUid(entry);
					if (!name) continue;
					try {
						const resolved = itemService.getItem(name, source || 'PHB');
						items.push({ ...resolved, quantity: 1 });
					} catch {
						items.push({ name, source: source || 'PHB', weight: 0, quantity: 1 });
					}
				} else if (entry.value != null && !entry.item && !entry.special) {
					const converted = this._copperToCurrency(entry.value);
					currency.gp += converted.gp;
					currency.sp += converted.sp;
					currency.cp += converted.cp;
				} else if (entry.equipmentType) {
					const name =
						EQUIPMENT_TYPE_LABELS[entry.equipmentType] || entry.equipmentType;
					items.push({ name, source: 'PHB', weight: 0, quantity: 1 });
				} else if (entry.item) {
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
				} else if (entry.special) {
					items.push({
						name: entry.special,
						source: 'PHB',
						weight: 0,
						quantity: entry.quantity || 1,
					});
				}
			}
		};

		if (!background?.equipment) return { items, currency };

		let choiceIndex = 0;
		for (let i = 0; i < background.equipment.length; i++) {
			const eq = background.equipment[i];

			if (eq._) collectItems(eq._);

			const choiceKeys = Object.keys(eq).filter(k => k !== '_').sort();
			if (choiceKeys.length > 1) {
				const choiceKey = equipmentChoices?.[choiceIndex];
				if (choiceKey && eq[choiceKey]) {
					collectItems(eq[choiceKey]);
				}
				choiceIndex++;
			}
		}

		return { items, currency };
	}

	applyBackgroundEquipment(character, background, equipmentChoices) {
		if (!character) return;

		// Remove previously auto-added background items and tracked currency
		this.removeItemsBySource(character, 'Background');

		if (character.background?.addedCurrency) {
			const prev = character.background.addedCurrency;
			const denoms = ['cp', 'sp', 'ep', 'gp', 'pp'];
			for (const denom of denoms) {
				if (prev[denom] && character.inventory?.currency) {
					character.inventory.currency[denom] = Math.max(
						0,
						(character.inventory.currency[denom] || 0) - prev[denom],
					);
				}
			}
			character.background.addedCurrency = null;
		}

		if (!background) return;

		const { items, currency } = this.resolveBackgroundEquipment(
			background,
			equipmentChoices,
		);

		for (const item of items) {
			this.addItem(character, item, item.quantity || 1, 'Background');
		}

		const hasCurrency = Object.values(currency).some((v) => v > 0);
		if (hasCurrency && character.inventory?.currency) {
			this.addCurrency(character, currency);
			if (character.background) {
				character.background.addedCurrency = { ...currency };
			}
		}
	}
}

// Export singleton
export const equipmentService = new EquipmentService();
