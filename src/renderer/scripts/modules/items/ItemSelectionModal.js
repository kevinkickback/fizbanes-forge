/** @file Modal for selecting and adding items to character inventory */

import { AppState } from '../../core/AppState.js';
import { equipmentService } from '../../services/EquipmentService.js';
import { itemService } from '../../services/ItemService.js';
import { sourceService } from '../../services/SourceService.js';
import { eventBus, EVENTS } from '../../utils/EventBus.js';
import { showNotification } from '../../utils/Notifications.js';

/**
 * Modal for selecting items to add to character inventory.
 * Provides search, filtering by rarity/type/cost, and quantity selection.
 */
export class ItemSelectionModal {
    constructor({ allowClose = true } = {}) {
        this.allowClose = allowClose;
        this.modal = null;
        this.bootstrapModal = null;
        this.validItems = [];
        this.filteredItems = [];
        this.searchTerm = '';
        this.selectedSources = new Set();
        this.selectedItem = null;
        this.quantity = 1;

        // Filter state
        this.filters = {
            rarity: new Set(), // Common, Uncommon, Rare, etc.
            type: new Set(), // Weapon, Armor, Wondrous Item, etc.
            minCost: 0,
            maxCost: 10000,
            category: new Set(), // For weapons/armor
        };
    }

    /**
     * Show the modal for item selection.
     * @returns {Promise<Object|null>} Selected item data or null if cancelled
     */
    async show() {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return null;
        }

        try {
            await this._loadValidItems();
            this.filteredItems = this.validItems;
            this.selectedItem = null;
            this.quantity = 1;

            // Get the modal element from DOM
            this.modal = document.getElementById('itemSelectionModal');
            if (!this.modal) {
                console.error('[ItemSelectionModal]', 'Modal element not found in DOM');
                showNotification('Could not open item selection modal', 'error');
                return null;
            }

            await this._renderItemList();
            this._attachEventListeners();

            // Create or reuse Bootstrap modal instance
            if (!this.bootstrapModal) {
                this.bootstrapModal = new bootstrap.Modal(this.modal, {
                    backdrop: true,
                    keyboard: true,
                });
            }

            this.bootstrapModal.show();

            // Return promise that resolves when item is added or modal closes
            return new Promise((resolve) => {
                this._resolvePromise = resolve;
            });
        } catch (error) {
            console.error('[ItemSelectionModal]', 'Error showing modal', error);
            showNotification('Failed to open item selection modal', 'error');
            return null;
        }
    }

    /**
     * Load and filter valid items based on character.
     * @private
     */
    async _loadValidItems() {
        const allItems = itemService.getAllItems();
        const allowedSources = sourceService.getAllowedSources();

        this.validItems = allItems
            .filter((item) => {
                // Check if source is allowed
                const itemSource = (item.source || '').toLowerCase();
                const isSourceAllowed = allowedSources.some(
                    (s) => s.toLowerCase() === itemSource,
                );
                return isSourceAllowed;
            })
            .map((item, index) => ({
                ...item,
                id: item.id || `item-${index}`,
            }));

        console.info('[ItemSelectionModal]', 'Loaded items', {
            count: this.validItems.length,
        });
    }

    /**
     * Render the item list based on filters.
     * @private
     */
    async _renderItemList() {
        const listContainer = this.modal.querySelector('.item-list-container');
        if (!listContainer) {
            console.warn('[ItemSelectionModal]', 'List container not found');
            return;
        }

        // Apply filters
        this.filteredItems = this.validItems.filter((item) =>
            this._itemMatchesFilters(item),
        );

        // Build HTML
        let html = '';

        if (this.filteredItems.length === 0) {
            html = '<div class="alert alert-info">No items match your filters.</div>';
        } else {
            html = '<div class="list-group">';
            for (const item of this.filteredItems) {
                const rarity = item.rarity || 'Unknown';
                const type = item.type || 'Unknown';
                const cost = item.cost
                    ? `${item.cost.quantity || 0} ${item.cost.unit || 'gp'}`
                    : 'N/A';
                const weight = item.weight ? `${item.weight} lbs` : 'N/A';

                html += `
					<button class="list-group-item list-group-item-action item-option" data-item-id="${item.id}">
						<div class="d-flex w-100 justify-content-between">
							<h6 class="mb-1">${item.name}</h6>
							<small class="text-muted">${rarity}</small>
						</div>
						<p class="mb-1"><small class="text-muted">${type} • Weight: ${weight} • Cost: ${cost}</small></p>
						<p class="mb-0"><small>${item.entries ? item.entries[0] : 'No description'}</small></p>
					</button>
				`;
            }
            html += '</div>';
        }

        listContainer.innerHTML = html;

        // Attach item selection listeners
        const itemOptions = listContainer.querySelectorAll('.item-option');
        itemOptions.forEach((option) => {
            option.addEventListener('click', () => {
                const itemId = option.dataset.itemId;
                this.selectedItem = this.validItems.find((item) => item.id === itemId);
                this._updateItemPreview();
            });
        });
    }

    /**
     * Check if an item matches current filters.
     * @private
     */
    _itemMatchesFilters(item) {
        // Search term
        if (this.searchTerm && !item.name.toLowerCase().includes(this.searchTerm.toLowerCase())) {
            return false;
        }

        // Rarity filter
        if (this.filters.rarity.size > 0) {
            const itemRarity = (item.rarity || 'Unknown').toLowerCase();
            if (!Array.from(this.filters.rarity).some(
                (r) => r.toLowerCase() === itemRarity,
            )) {
                return false;
            }
        }

        // Type filter
        if (this.filters.type.size > 0) {
            const itemType = (item.type || 'Unknown').toLowerCase();
            if (!Array.from(this.filters.type).some((t) => t.toLowerCase() === itemType)) {
                return false;
            }
        }

        // Cost filter
        if (item.cost) {
            const costValue = item.cost.quantity || 0;
            if (costValue < this.filters.minCost || costValue > this.filters.maxCost) {
                return false;
            }
        }

        return true;
    }

    /**
     * Update the item preview panel.
     * @private
     */
    _updateItemPreview() {
        const previewContainer = this.modal.querySelector('.item-preview-container');
        if (!previewContainer || !this.selectedItem) return;

        const item = this.selectedItem;
        const rarity = item.rarity || 'Unknown';
        const type = item.type || 'Unknown';
        const cost = item.cost
            ? `${item.cost.quantity || 0} ${item.cost.unit || 'gp'}`
            : 'N/A';
        const weight = item.weight ? `${item.weight} lbs` : 'N/A';
        const requiresAttunement = item.reqAttune ? 'Yes' : 'No';
        const description = item.entries
            ? item.entries.map((e) => typeof e === 'string' ? e : '').join(' ')
            : 'No description available';

        previewContainer.innerHTML = `
			<div class="card">
				<div class="card-header">
					<h5>${item.name}</h5>
				</div>
				<div class="card-body">
					<div class="row mb-3">
						<div class="col-md-6">
							<p><strong>Rarity:</strong> ${rarity}</p>
							<p><strong>Type:</strong> ${type}</p>
							<p><strong>Weight:</strong> ${weight}</p>
						</div>
						<div class="col-md-6">
							<p><strong>Cost:</strong> ${cost}</p>
							<p><strong>Requires Attunement:</strong> ${requiresAttunement}</p>
						</div>
					</div>
					<hr>
					<div class="description">
						<small>${description}</small>
					</div>
				</div>
			</div>
		`;

        // Update add button state
        const addButton = this.modal.querySelector('.btn-add-item');
        if (addButton) {
            addButton.disabled = false;
        }
    }

    /**
     * Attach event listeners to modal controls.
     * @private
     */
    _attachEventListeners() {
        // Search input
        const searchInput = this.modal.querySelector('.item-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this._renderItemList();
            });
        }

        // Rarity filter checkboxes
        const rarityCheckboxes = this.modal.querySelectorAll('[data-filter-type="rarity"]');
        rarityCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.filters.rarity.add(checkbox.value);
                } else {
                    this.filters.rarity.delete(checkbox.value);
                }
                this._renderItemList();
            });
        });

        // Type filter checkboxes
        const typeCheckboxes = this.modal.querySelectorAll('[data-filter-type="type"]');
        typeCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.filters.type.add(checkbox.value);
                } else {
                    this.filters.type.delete(checkbox.value);
                }
                this._renderItemList();
            });
        });

        // Cost slider
        const costSlider = this.modal.querySelector('.cost-slider');
        if (costSlider) {
            costSlider.addEventListener('input', () => {
                this.filters.maxCost = parseInt(costSlider.value, 10);
                this._renderItemList();
            });
        }

        // Quantity input
        const quantityInput = this.modal.querySelector('.item-quantity-input');
        if (quantityInput) {
            quantityInput.addEventListener('change', (e) => {
                this.quantity = Math.max(1, parseInt(e.target.value, 10) || 1);
            });
        }

        // Add button
        const addButton = this.modal.querySelector('.btn-add-item');
        if (addButton) {
            addButton.addEventListener('click', () => this._handleAddItem());
        }

        // Cancel button
        const cancelButton = this.modal.querySelector('.btn-cancel-item');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => this._handleCancel());
        }

        // Close modal on Escape
        if (this.allowClose) {
            this.modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this._handleCancel();
                }
            });
        }
    }

    /**
     * Handle adding the selected item.
     * @private
     */
    _handleAddItem() {
        if (!this.selectedItem) {
            showNotification('Please select an item first', 'warning');
            return;
        }

        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return;
        }

        try {
            const addedItem = equipmentService.addItem(
                character,
                this.selectedItem,
                this.quantity,
                'Manual',
            );

            if (addedItem) {
                showNotification(`Added ${this.quantity}x ${addedItem.name}`, 'success');
                eventBus.emit(EVENTS.CHARACTER_UPDATED, character);

                this.bootstrapModal.hide();
                if (this._resolvePromise) {
                    this._resolvePromise({ item: this.selectedItem, quantity: this.quantity });
                }
            } else {
                showNotification('Failed to add item', 'error');
            }
        } catch (error) {
            console.error('[ItemSelectionModal]', 'Error adding item', error);
            showNotification('Error adding item', 'error');
        }
    }

    /**
     * Handle canceling the modal.
     * @private
     */
    _handleCancel() {
        this.bootstrapModal.hide();
        if (this._resolvePromise) {
            this._resolvePromise(null);
        }
    }
}
