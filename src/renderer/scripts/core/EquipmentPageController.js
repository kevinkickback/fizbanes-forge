/** @file Controller for the Equipment character page */

import { EquipmentSelectionModal } from '../modules/equipment/EquipmentSelectionModal.js';
import { equipmentService } from '../services/EquipmentService.js';
import { eventBus, EVENTS } from '../utils/EventBus.js';
import { showNotification } from '../utils/Notifications.js';
import { AppState } from './AppState.js';

/**
 * Controller for the Equipment character page.
 * Handles display of inventory, equipped items, and attunement.
 */
class EquipmentPageController {
    constructor() {
        this.loggerScope = 'EquipmentPageController';
        this.isInitialized = false;
        this.equipmentSelectionModal = null;
    }

    /**
     * Initialize the equipment page controller.
     * @returns {void}
     */
    initialize() {
        if (this.isInitialized) {
            console.warn(`[${this.loggerScope}]`, 'Already initialized');
            return;
        }

        console.info(`[${this.loggerScope}]`, 'Initializing');

        // Setup event listeners
        eventBus.on(EVENTS.PAGE_LOADED, (page) => {
            if (page === 'equipment') {
                this.render();
            }
        });

        eventBus.on(EVENTS.CHARACTER_UPDATED, () => {
            this.render();
        });

        eventBus.on(EVENTS.ITEM_ADDED, () => {
            this.render();
        });

        eventBus.on(EVENTS.ITEM_REMOVED, () => {
            this.render();
        });

        eventBus.on(EVENTS.ITEM_EQUIPPED, () => {
            this.render();
        });

        eventBus.on(EVENTS.ITEM_UNEQUIPPED, () => {
            this.render();
        });

        this.setupEventListeners();

        this.isInitialized = true;
        console.info(`[${this.loggerScope}]`, 'Initialized');
    }

    /**
     * Setup UI event listeners for the equipment page.
     * @private
     */
    setupEventListeners() {
        // Event delegation for buttons
        document.addEventListener('click', (e) => {
            const addItemBtn = e.target.closest('#addItemBtn');
            if (addItemBtn) {
                this.handleAddItem();
                return;
            }

            // Handle item removal
            const removeItemBtn = e.target.closest('[data-remove-item]');
            if (removeItemBtn) {
                const itemId = removeItemBtn.dataset.removeItem;
                this.handleRemoveItem(itemId);
                return;
            }

            // Handle equip item
            const equipBtn = e.target.closest('[data-equip-item]');
            if (equipBtn) {
                const itemId = equipBtn.dataset.equipItem;
                const slot = equipBtn.dataset.slot;
                this.handleEquipItem(itemId, slot);
                return;
            }

            // Handle unequip item
            const unequipBtn = e.target.closest('[data-unequip-item]');
            if (unequipBtn) {
                const itemId = unequipBtn.dataset.unequipItem;
                this.handleUnequipItem(itemId);
                return;
            }

            // Handle attune item
            const attuneBtn = e.target.closest('[data-attune-item]');
            if (attuneBtn) {
                const itemId = attuneBtn.dataset.attuneItem;
                this.handleAttuneItem(itemId);
                return;
            }

            // Handle unattune item
            const unattuneBtn = e.target.closest('[data-unattune-item]');
            if (unattuneBtn) {
                const itemId = unattuneBtn.dataset.unattuneItem;
                this.handleUnattuneItem(itemId);
                return;
            }
        });
    }

    /**
     * Render the equipment page with current character data.
     * @returns {void}
     */
    render() {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            console.warn(`[${this.loggerScope}]`, 'No character selected');
            return;
        }

        console.info(`[${this.loggerScope}]`, 'Rendering equipment page');

        this.renderInventory(character);
        this.renderEquippedItems(character);
        this.renderAttunedItems(character);
        this.renderWeight(character);
    }

    /**
     * Render the inventory list.
     * @param {Object} character - Character object
     * @private
     */
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
                                Value: ${item.value ? item.value / 100 + ' gp' : 'N/A'}
                                ${isEquipped ? '<span class="badge bg-success ms-2">Equipped</span>' : ''}
                                ${isAttuned ? '<span class="badge bg-info ms-2">Attuned</span>' : ''}
                            </small>
                        </div>
                        <div class="btn-group">
                            ${!isEquipped ? `<button class="btn btn-sm btn-outline-primary" data-equip-item="${item.id}" title="Equip">
                                <i class="fas fa-shield-alt"></i>
                            </button>` : `<button class="btn btn-sm btn-outline-warning" data-unequip-item="${item.id}" title="Unequip">
                                <i class="fas fa-times-circle"></i>
                            </button>`}
                            ${!isAttuned ? `<button class="btn btn-sm btn-outline-info" data-attune-item="${item.id}" title="Attune">
                                <i class="fas fa-star"></i>
                            </button>` : `<button class="btn btn-sm btn-outline-secondary" data-unattune-item="${item.id}" title="Unattune">
                                <i class="fas fa-star-half-alt"></i>
                            </button>`}
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

    /**
     * Render equipped items.
     * @param {Object} character - Character object
     * @private
     */
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

    /**
     * Render attuned items.
     * @param {Object} character - Character object
     * @private
     */
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

    /**
     * Render weight information.
     * @param {Object} character - Character object
     * @private
     */
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

    /**
     * Handle adding an item.
     * @private
     */
    async handleAddItem() {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return;
        }

        try {
            if (!this.equipmentSelectionModal) {
                this.equipmentSelectionModal = new EquipmentSelectionModal();
            }

            const result = await this.equipmentSelectionModal.show();
            if (result) {
                console.info(`[${this.loggerScope}]`, 'Items added', {
                    count: result.length,
                });
            }
        } catch (error) {
            console.error(`[${this.loggerScope}]`, 'Modal error', error);
        }
    }

    /**
     * Handle removing an item.
     * @param {string} itemId - Item instance ID
     * @private
     */
    handleRemoveItem(itemId) {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return;
        }

        const item = equipmentService.findItemById(character, itemId);
        if (!item) {
            showNotification('Item not found', 'error');
            return;
        }

        const success = equipmentService.removeItem(character, itemId, 1);
        if (success) {
            eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
            showNotification(`Removed ${item.name}`, 'success');
        } else {
            showNotification('Failed to remove item', 'error');
        }
    }

    /**
     * Handle equipping an item.
     * @param {string} itemId - Item instance ID
     * @param {string} slot - Equipment slot
     * @private
     */
    handleEquipItem(itemId, slot) {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return;
        }

        // TODO: Implement slot selection modal/dropdown
        showNotification('Please select an equipment slot (feature in progress)', 'info');
    }

    /**
     * Handle unequipping an item.
     * @param {string} itemId - Item instance ID
     * @private
     */
    handleUnequipItem(itemId) {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return;
        }

        const success = equipmentService.unequipItem(character, itemId);
        if (success) {
            eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
            showNotification('Item unequipped', 'success');
        } else {
            showNotification('Failed to unequip item', 'error');
        }
    }

    /**
     * Handle attuning an item.
     * @param {string} itemId - Item instance ID
     * @private
     */
    handleAttuneItem(itemId) {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return;
        }

        const success = equipmentService.attuneItem(character, itemId);
        if (success) {
            eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
            showNotification('Item attuned', 'success');
        } else {
            showNotification('Failed to attune item (check attunement limit)', 'error');
        }
    }

    /**
     * Handle unattuning an item.
     * @param {string} itemId - Item instance ID
     * @private
     */
    handleUnattuneItem(itemId) {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return;
        }

        const success = equipmentService.unattueItem(character, itemId);
        if (success) {
            eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
            showNotification('Item unattuned', 'success');
        } else {
            showNotification('Failed to unattune item', 'error');
        }
    }
}

// Export singleton instance
export const equipmentPageController = new EquipmentPageController();
