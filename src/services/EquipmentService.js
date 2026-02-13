import { NotFoundError, ValidationError } from '../lib/Errors.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import {
	addItemArgsSchema,
	removeItemArgsSchema,
	validateInput,
} from '../lib/ValidationSchemas.js';

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
}

// Export singleton
export const equipmentService = new EquipmentService();
