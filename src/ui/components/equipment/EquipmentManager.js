// Component for managing the Equipment page

import { AppState } from '../../../app/AppState.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { equipmentService } from '../../../services/EquipmentService.js';
import { ItemSelectorModal } from './ItemSelectorModal.js';

export class EquipmentManager {
	constructor() {
		this.loggerScope = 'EquipmentManager';
		this.itemSelectorModal = null;
		this._cleanup = DOMCleanup.create();
		this.setupEventListeners();
	}

	setupEventListeners() {
		this._cleanup.on(document, 'click', (e) => {
			const addItemBtn = e.target.closest('#addItemBtn');
			if (addItemBtn) {
				this.handleAddItem();
				return;
			}

			const removeItemBtn = e.target.closest('[data-remove-item]');
			if (removeItemBtn) {
				const itemId = removeItemBtn.dataset.removeItem;
				this.handleRemoveItem(itemId);
				return;
			}

			const equipBtn = e.target.closest('[data-equip-item]');
			if (equipBtn) {
				const itemId = equipBtn.dataset.equipItem;
				const slot = equipBtn.dataset.slot;
				this.handleEquipItem(itemId, slot);
				return;
			}

			const unequipBtn = e.target.closest('[data-unequip-item]');
			if (unequipBtn) {
				const itemId = unequipBtn.dataset.unequipItem;
				this.handleUnequipItem(itemId);
				return;
			}

			const attuneBtn = e.target.closest('[data-attune-item]');
			if (attuneBtn) {
				const itemId = attuneBtn.dataset.attuneItem;
				this.handleAttuneItem(itemId);
				return;
			}

			const unattuneBtn = e.target.closest('[data-unattune-item]');
			if (unattuneBtn) {
				const itemId = unattuneBtn.dataset.unattuneItem;
				this.handleUnattuneItem(itemId);
				return;
			}
		});
	}

	cleanup() {
		this._cleanup.cleanup();
	}

	_executeAction(actionFn, errorMsg) {
		const character = AppState.getCurrentCharacter();
		if (!character) {
			showNotification('No character selected', 'error');
			return false;
		}

		const success = actionFn(character);
		if (success) {
			eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
			return true;
		}

		showNotification(errorMsg, 'error');
		return false;
	}

	render() {
		const character = AppState.getCurrentCharacter();
		if (!character) {
			console.warn(`[${this.loggerScope}]`, 'No character selected');
			return;
		}

		this.renderInventory(character);
		this.renderEquippedItems(character);
		this.renderAttunedItems(character);
		this.renderWeight(character);
	}

	renderInventory(character) {
		const container = document.getElementById('inventoryList');
		if (!container) return;

		const items = equipmentService.getInventoryItems(character);

		if (items.length === 0) {
			container.innerHTML =
				'<p class="text-muted">No items in inventory. Click "Add Item" to add equipment.</p>';
			return;
		}

		let html = '';
		for (const item of items) {
			const isEquipped = item.equipped;
			const isAttuned = item.attuned;

			html += `
                <div class="item-row card card-sm mb-2">
                    <div class="card-body d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${item.name}</h6>
                            <small class="text-muted">
                                Qty: ${item.quantity} | 
                                Weight: ${item.weight || 0} lb | 
                                Value: ${item.value ? `${item.value / 100} gp` : 'N/A'}
                                ${isEquipped ? '<span class="badge bg-success ms-2">Equipped</span>' : ''}
                                ${isAttuned ? '<span class="badge bg-info ms-2">Attuned</span>' : ''}
                            </small>
                        </div>
                        <div class="btn-group">
                            ${!isEquipped
					? `<button class="btn btn-sm btn-outline-primary" data-equip-item="${item.id}" title="Equip">
                                <i class="fas fa-shield-alt"></i>
                            </button>`
					: `<button class="btn btn-sm btn-outline-warning" data-unequip-item="${item.id}" title="Unequip">
                                <i class="fas fa-times-circle"></i>
                            </button>`
				}
                            ${!isAttuned
					? `<button class="btn btn-sm btn-outline-info" data-attune-item="${item.id}" title="Attune">
                                <i class="fas fa-star"></i>
                            </button>`
					: `<button class="btn btn-sm btn-outline-secondary" data-unattune-item="${item.id}" title="Unattune">
                                <i class="fas fa-star-half-alt"></i>
                            </button>`
				}
                            <button class="btn btn-sm btn-outline-danger" data-remove-item="${item.id}" title="Remove">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
		}

		container.innerHTML = html;
	}

	renderEquippedItems(character) {
		const container = document.getElementById('equipmentSlots');
		if (!container) return;

		const equipped = character.inventory?.equipped || {};
		const slots = equipmentService.validSlots;

		let html = '<div class="row g-3">';

		for (const [slotKey, slotName] of Object.entries(slots)) {
			const slotItems = equipped[slotKey];
			const isArraySlot = Array.isArray(slotItems);
			const hasItem = isArraySlot
				? slotItems && slotItems.length > 0
				: slotItems;

			html += `
                <div class="col-md-6">
                    <div class="equipment-slot-card card">
                        <div class="card-body">
                            <h6 class="mb-2">${slotName}</h6>
            `;

			if (hasItem) {
				if (isArraySlot) {
					for (const itemId of slotItems) {
						const item = equipmentService.findItemById(character, itemId);
						if (item) {
							html += `
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span>${item.name}</span>
                                    <button class="btn btn-sm btn-outline-warning" data-unequip-item="${itemId}">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            `;
						}
					}
				} else {
					const item = equipmentService.findItemById(character, slotItems);
					if (item) {
						html += `
                            <div class="d-flex justify-content-between align-items-center">
                                <span>${item.name}</span>
                                <button class="btn btn-sm btn-outline-warning" data-unequip-item="${slotItems}">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `;
					}
				}
			} else {
				html += '<p class="text-muted mb-0">Empty</p>';
			}

			html += `
                        </div>
                    </div>
                </div>
            `;
		}

		html += '</div>';
		container.innerHTML = html;
	}

	renderAttunedItems(character) {
		const container = document.getElementById('attunedItems');
		const countSpan = document.getElementById('attunedCount');
		const limitSpan = document.getElementById('attunementLimit');

		if (!container) return;

		const attunedItems = equipmentService.getAttunedItems(character);
		const limit = equipmentService.MAX_ATTUNEMENT_SLOTS;

		if (countSpan) countSpan.textContent = attunedItems.length;
		if (limitSpan) limitSpan.textContent = limit;

		if (attunedItems.length === 0) {
			container.innerHTML = '<p class="text-muted">No items attuned.</p>';
			return;
		}

		let html = '';
		for (const item of attunedItems) {
			html += `
                <div class="attuned-item-card card card-sm mb-2">
                    <div class="card-body d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${item.name}</h6>
                            <small class="text-muted">${item.type || 'Item'}</small>
                        </div>
                        <button class="btn btn-sm btn-outline-danger" data-unattune-item="${item.id}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
		}

		container.innerHTML = html;
	}

	renderWeight(character) {
		const weightSpan = document.getElementById('inventoryWeight');
		const capacitySpan = document.getElementById('weightCapacity');

		if (weightSpan) {
			const totalWeight = equipmentService.calculateTotalWeight(character);
			weightSpan.textContent = totalWeight.toFixed(1);
		}

		if (capacitySpan) {
			const capacity = equipmentService.calculateCarryCapacity(character);
			capacitySpan.textContent = capacity;
		}
	}

	async handleAddItem() {
		const character = AppState.getCurrentCharacter();
		if (!character) {
			showNotification('No character selected', 'error');
			return;
		}

		try {
			if (!this.itemSelectorModal) {
				this.itemSelectorModal = new ItemSelectorModal();
			}

			await this.itemSelectorModal.show();
		} catch (error) {
			console.error(`[${this.loggerScope}]`, 'Modal error', error);
		}
	}

	handleRemoveItem(itemId) {
		this._executeAction(
			(char) => equipmentService.removeItem(char, itemId, 1),
			'Failed to remove item',
		);
	}

	handleEquipItem(_itemId, _slot) {
		const character = AppState.getCurrentCharacter();
		if (!character) {
			showNotification('No character selected', 'error');
			return;
		}

		// TODO: Implement slot selection modal/dropdown
		showNotification(
			'Please select an equipment slot (feature in progress)',
			'info',
		);
	}

	handleUnequipItem(itemId) {
		this._executeAction(
			(char) => equipmentService.unequipItem(char, itemId),
			'Failed to unequip item',
		);
	}

	handleAttuneItem(itemId) {
		this._executeAction(
			(char) => equipmentService.attuneItem(char, itemId),
			'Failed to attune item (check attunement limit)',
		);
	}

	handleUnattuneItem(itemId) {
		this._executeAction(
			(char) => equipmentService.unattuneItem(char, itemId),
			'Failed to unattune item',
		);
	}
}
