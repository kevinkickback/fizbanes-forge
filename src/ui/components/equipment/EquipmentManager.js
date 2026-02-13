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
				this.handleEquipItem(itemId);
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

		this._cleanup.on(document, 'change', (e) => {
			const currencyInput = e.target.closest('.currency-input');
			if (currencyInput) {
				this.handleCurrencyChange(currencyInput);
				return;
			}

			const qtyInput = e.target.closest('.qty-input');
			if (qtyInput) {
				this.handleQuantityChange(qtyInput);
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
		this.renderWeight(character);
		this.renderCurrency(character);
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
			const canEquip = equipmentService.isEquippable(item);
			const canAttune = equipmentService.isAttuneable(item);

			let equipBtn = '';
			if (canEquip) {
				equipBtn = !isEquipped
					? `<button class="btn btn-sm btn-outline-primary" data-equip-item="${item.id}" title="Equip">
						<i class="fas fa-shield-alt"></i>
					</button>`
					: `<button class="btn btn-sm btn-outline-warning" data-unequip-item="${item.id}" title="Unequip">
						<i class="fas fa-times-circle"></i>
					</button>`;
			}

			let attuneBtn = '';
			if (canAttune) {
				attuneBtn = !isAttuned
					? `<button class="btn btn-sm btn-outline-info" data-attune-item="${item.id}" title="Attune">
						<i class="fas fa-star"></i>
					</button>`
					: `<button class="btn btn-sm btn-outline-secondary" data-unattune-item="${item.id}" title="Unattune">
						<i class="fas fa-star-half-alt"></i>
					</button>`;
			}

			html += `
                <div class="item-row card card-sm mb-2">
                    <div class="card-body d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1"><a href="#" class="reference-link" data-hover-type="item" data-hover-name="${item.name}" data-hover-source="${item.source}">${item.name}</a></h6>
                            <small class="text-muted">
                                <label class="qty-label">Qty<input type="number" min="1" class="qty-input" data-qty-item="${item.id}" value="${item.quantity}"></label>
                                <span class="ms-2">|</span> <span class="ms-2">Weight: ${item.weight || 0} lb</span>
                                ${isEquipped ? '<span class="badge bg-success ms-2">Equipped</span>' : ''}
                                ${isAttuned ? '<span class="badge bg-info ms-2">Attuned</span>' : ''}
                            </small>
                        </div>
                        <div class="btn-group">
                            ${equipBtn}
                            ${attuneBtn}
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

	renderWeight(character) {
		const weightSpan = document.getElementById('inventoryWeight');
		const capacitySpan = document.getElementById('weightCapacity');
		const countSpan = document.getElementById('attunedCount');
		const limitSpan = document.getElementById('attunementLimit');

		if (weightSpan) {
			const totalWeight = equipmentService.calculateTotalWeight(character);
			weightSpan.textContent = totalWeight.toFixed(1);
		}

		if (capacitySpan) {
			const capacity = equipmentService.calculateCarryCapacity(character);
			capacitySpan.textContent = capacity;
		}

		const attunedItems = equipmentService.getAttunedItems(character);
		if (countSpan) countSpan.textContent = attunedItems.length;
		if (limitSpan) limitSpan.textContent = equipmentService.MAX_ATTUNEMENT_SLOTS;
	}

	renderCurrency(character) {
		const currency = character.inventory?.currency || {};
		const fields = { pp: 'currencyPP', gp: 'currencyGP', ep: 'currencyEP', sp: 'currencySP', cp: 'currencyCP' };

		for (const [key, id] of Object.entries(fields)) {
			const input = document.getElementById(id);
			if (input) input.value = currency[key] || 0;
		}
	}

	handleQuantityChange(input) {
		const character = AppState.getCurrentCharacter();
		if (!character) return;

		const itemId = input.dataset.qtyItem;
		const value = Math.max(1, parseInt(input.value, 10) || 1);
		input.value = value;

		const item = character.inventory.items.find((i) => i.id === itemId);
		if (!item) return;

		item.quantity = value;
		this.renderWeight(character);
		eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
	}

	handleCurrencyChange(input) {
		const character = AppState.getCurrentCharacter();
		if (!character) return;

		const type = input.dataset.currency;
		const value = Math.max(0, parseInt(input.value, 10) || 0);
		input.value = value;

		if (!character.inventory.currency) {
			character.inventory.currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
		}

		character.inventory.currency[type] = value;
		eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
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

	handleEquipItem(itemId) {
		try {
			this._executeAction(
				(char) => equipmentService.equipItem(char, itemId),
				'Failed to equip item',
			);
		} catch (error) {
			showNotification(error.message, 'warning');
		}
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
