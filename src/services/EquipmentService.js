import { eventBus, EVENTS } from '../lib/EventBus.js';

class EquipmentService {
	constructor() {
		this.validSlots = {
			head: 'Head (Helm, Crown)',
			body: 'Body (Armor)',
			hands: 'Hands (Gloves)',
			feet: 'Feet (Boots)',
			back: 'Back (Cloak, Cape)',
			neck: 'Neck (Amulet, Pendant)',
			wrists: 'Wrists (Bracers)',
			fingers: 'Fingers (Rings)',
			waist: 'Waist (Belt, Girdle)',
		};

		this.MAX_ATTUNEMENT_SLOTS = 3;
		this.CARRY_CAPACITY_MULTIPLIER = 15;
		this.LIGHT_ENCUMBRANCE_MULTIPLIER = 5;
		this.HEAVY_ENCUMBRANCE_MULTIPLIER = 10;
	}

	_generateItemInstanceId() {
		return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	addItem(character, itemData, quantity = 1, source = 'Manual') {
		if (!character.inventory) {
			console.warn('[EquipmentService]', 'Character missing inventory');
			return null;
		}

		if (!itemData || !itemData.name) {
			console.warn('[EquipmentService]', 'Invalid item data');
			return null;
		}

		try {
			const itemInstance = {
				id: this._generateItemInstanceId(),
				name: itemData.name,
				baseItemId: itemData.id || itemData.name,
				quantity: Math.max(1, quantity),
				equipped: false,
				attuned: false,
				cost: itemData.cost ? { ...itemData.cost } : null,
				weight: itemData.weight || 0,
				source: itemData.source || 'Unknown',
				metadata: {
					addedAt: new Date().toISOString(),
					addedFrom: source,
				},
			};

			character.inventory.items.push(itemInstance);
			this._updateInventoryWeight(character);

			eventBus.emit(EVENTS.ITEM_ADDED, character, itemInstance);
			return itemInstance;
		} catch (error) {
			console.error('[EquipmentService]', 'Failed to add item', error);
			return null;
		}
	}

	removeItem(character, itemInstanceId, quantity = 1) {
		if (!character.inventory) return false;

		const itemIndex = character.inventory.items.findIndex(
			(item) => item.id === itemInstanceId,
		);

		if (itemIndex === -1) {
			console.warn('[EquipmentService]', 'Item not found', { itemInstanceId });
			return false;
		}

		const item = character.inventory.items[itemIndex];

		// If removing all quantity, delete the item entirely
		if (quantity >= item.quantity) {
			// Unequip if needed
			if (item.equipped) {
				this.unequipItem(character, itemInstanceId);
			}

			// Unatune if needed
			if (item.attuned) {
				this.unattueItem(character, itemInstanceId);
			}

			character.inventory.items.splice(itemIndex, 1);
		} else {
			// Reduce quantity
			item.quantity -= quantity;
		}

		this._updateInventoryWeight(character);

		eventBus.emit(EVENTS.ITEM_REMOVED, character, item);
		return true;
	}

	unequipItem(character, itemInstanceId) {
		if (!character.inventory) return false;

		let slot = null;
		let found = false;

		// Search all slots for the item
		for (const [slotName, slotContent] of Object.entries(
			character.inventory.equipped,
		)) {
			if (Array.isArray(slotContent)) {
				const index = slotContent.indexOf(itemInstanceId);
				if (index !== -1) {
					slotContent.splice(index, 1);
					slot = slotName;
					found = true;
					break;
				}
			} else if (slotContent === itemInstanceId) {
				character.inventory.equipped[slotName] = null;
				slot = slotName;
				found = true;
				break;
			}
		}

		if (found) {
			const item = character.inventory.items.find(
				(i) => i.id === itemInstanceId,
			);
			if (item) {
				item.equipped = false;

				eventBus.emit(EVENTS.ITEM_UNEQUIPPED, character, item, slot);
			}
			return true;
		}

		console.warn('[EquipmentService]', 'Item not found in equipped slots', {
			itemInstanceId,
		});
		return false;
	}

	attuneItem(character, itemInstanceId) {
		if (!character.inventory) return false;

		const item = character.inventory.items.find((i) => i.id === itemInstanceId);

		if (!item) {
			console.warn('[EquipmentService]', 'Item not found', { itemInstanceId });
			return false;
		}

		if (!character.inventory.attuned.includes(itemInstanceId)) {
			character.inventory.attuned.push(itemInstanceId);
		}

		item.attuned = true;

		eventBus.emit(EVENTS.ITEM_ATTUNED, character, item);
		return true;
	}

	unattueItem(character, itemInstanceId) {
		if (!character.inventory) return false;

		const index = character.inventory.attuned.indexOf(itemInstanceId);

		if (index === -1) {
			console.warn('[EquipmentService]', 'Item not attuned', {
				itemInstanceId,
			});
			return false;
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
