// Modal for selecting and adding equipment/items to character inventory

import { AppState } from '../../../app/AppState.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { equipmentService } from '../../../services/EquipmentService.js';
import { itemService } from '../../../services/ItemService.js';
import { sourceService } from '../../../services/SourceService.js';

export class EquipmentSelectionModal {
    constructor({ allowClose = true } = {}) {
        this.allowClose = allowClose;
        this.modal = null;
        this.bootstrapModal = null;
        this.allItems = [];
        this.filteredItems = [];
        this.searchTerm = '';
        this.selectedItems = [];
        this.selectedSources = new Set();

        // Filter state
        this.filters = {
            type: new Set(), // W (weapon), A (armor), G (gear), etc.
            rarity: new Set(), // common, uncommon, rare, very rare, legendary, artifact
            property: new Set(), // magic, cursed, consumable, etc.
        };
    }

    async show() {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return null;
        }

        try {
            await this._initializeModal();
            await this._loadItems();
            await this._setupSourceDropdown();
            this._setupEventListeners();
            this._renderItemList();

            return new Promise((resolve) => {
                this.resolvePromise = resolve;
                this.bootstrapModal.show();
            });
        } catch (error) {
            console.error('[EquipmentSelectionModal]', 'Failed to show modal:', error);
            showNotification('Failed to open equipment selection', 'error');
            return null;
        }
    }

    async _initializeModal() {
        this.modal = document.getElementById('equipmentSelectionModal');

        if (!this.modal) {
            throw new Error('Equipment selection modal element not found');
        }

        // Initialize Bootstrap modal
        this.bootstrapModal = new bootstrap.Modal(this.modal, {
            keyboard: this.allowClose,
            backdrop: this.allowClose ? true : 'static',
        });
    }

    async _setupSourceDropdown() {
        const sourceMenu = this.modal.querySelector('.equipment-source-menu');
        const sourceToggle = this.modal.querySelector('.equipment-source-toggle');
        if (!sourceMenu || !sourceToggle) return;

        try {
            // Get allowed sources
            const allowedSources = new Set(
                sourceService.getAllowedSources().map((s) => s.toLowerCase()),
            );

            // Get sources from valid items only
            const sources = Array.from(
                new Set(
                    this.allItems
                        .map((item) => (item.source || '').trim())
                        .filter((source) => {
                            return source && allowedSources.has(source.toLowerCase());
                        })
                        .map((s) => s.toLowerCase()),
                ),
            );
            sources.sort();

            // Build checkboxes
            sources.forEach((src) => {
                const id = `equipment-source-${src}`;
                const item = document.createElement('div');
                item.className = 'form-check';
                item.innerHTML = `
                    <input class="form-check-input" type="checkbox" value="${src}" id="${id}">
                    <label class="form-check-label" for="${id}">${src.toUpperCase()}</label>
                `;
                const cb = item.querySelector('input');
                cb.addEventListener('change', () => {
                    if (cb.checked) {
                        this.selectedSources.add(src);
                    } else {
                        this.selectedSources.delete(src);
                    }
                    this._updateSourceLabel(sourceToggle);
                    this._filterItems();
                });
                sourceMenu.appendChild(item);
            });

            this._updateSourceLabel(sourceToggle);
        } catch (error) {
            console.error(
                '[EquipmentSelectionModal]',
                'Failed to setup source dropdown:',
                error,
            );
        }
    }

    async _loadItems() {
        try {
            // Get all items (both regular items and base items)
            const regularItems = itemService.getAllItems() || [];
            const baseItems = itemService.getAllBaseItems() || [];

            // Combine and deduplicate
            const itemMap = new Map();

            // Add regular items
            for (const item of regularItems) {
                if (item?.name) {
                    const key = `${item.name}|${item.source || 'PHB'}`;
                    itemMap.set(key, { ...item, id: key });
                }
            }

            // Add base items
            for (const item of baseItems) {
                if (item?.name) {
                    const key = `${item.name}|${item.source || 'PHB'}`;
                    if (!itemMap.has(key)) {
                        itemMap.set(key, { ...item, id: key });
                    }
                }
            }

            this.allItems = Array.from(itemMap.values());
            this.filteredItems = [...this.allItems];

            console.log(
                '[EquipmentSelectionModal]',
                `Loaded ${this.allItems.length} items`,
            );
        } catch (error) {
            console.error('[EquipmentSelectionModal]', 'Failed to load items:', error);
            this.allItems = [];
            this.filteredItems = [];
        }
    }

    _setupEventListeners() {
        // Search input
        const searchInput = this.modal.querySelector('#equipmentSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase().trim();
                this._filterItems();
            });
        }

        // Source dropdown toggle
        const sourceMenu = this.modal.querySelector('.equipment-source-menu');
        const sourceToggle = this.modal.querySelector('.equipment-source-toggle');
        if (sourceMenu && sourceToggle) {
            sourceToggle.addEventListener('click', (e) => {
                e.preventDefault();
                sourceMenu.classList.toggle('show');
                sourceToggle.setAttribute(
                    'aria-expanded',
                    sourceMenu.classList.contains('show'),
                );
            });
            document.addEventListener('click', (e) => {
                if (!this.modal.contains(e.target)) return;
                if (
                    !sourceMenu.contains(e.target) &&
                    !sourceToggle.contains(e.target)
                ) {
                    sourceMenu.classList.remove('show');
                    sourceToggle.setAttribute('aria-expanded', 'false');
                }
            });
        }

        // Type filters
        const typeCheckboxes = this.modal.querySelectorAll(
            '[data-filter-type="item-type"]',
        );
        typeCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.filters.type.add(checkbox.value);
                } else {
                    this.filters.type.delete(checkbox.value);
                }
                this._filterItems();
            });
        });

        // Rarity filters
        const rarityCheckboxes = this.modal.querySelectorAll(
            '[data-filter-type="rarity"]',
        );
        rarityCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.filters.rarity.add(checkbox.value);
                } else {
                    this.filters.rarity.delete(checkbox.value);
                }
                this._filterItems();
            });
        });

        // Property filters
        const propertyCheckboxes = this.modal.querySelectorAll(
            '[data-filter-type="property"]',
        );
        propertyCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.filters.property.add(checkbox.value);
                } else {
                    this.filters.property.delete(checkbox.value);
                }
                this._filterItems();
            });
        });

        // Add selected button
        const addBtn = this.modal.querySelector('#addSelectedEquipmentBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this._handleAddSelected();
            });
        }

        // Cancel button
        const cancelBtn = this.modal.querySelector('#cancelEquipmentSelection');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this._handleCancel();
            });
        }

        // Item card clicks (for selection/details)
        this.modal.addEventListener('click', (e) => {
            const itemCard = e.target.closest('[data-item-id]');
            if (itemCard) {
                const itemId = itemCard.getAttribute('data-item-id');
                this._toggleItemSelection(itemId);
            }
        });

        // Modal hidden event
        this.modal.addEventListener('hidden.bs.modal', () => {
            this._cleanup();
        });
    }

    _filterItems() {
        this.filteredItems = this.allItems.filter((item) =>
            this._itemMatchesFilters(item),
        );
        this._renderItemList();
    }

    _itemMatchesFilters(item) {
        // Search term
        if (this.searchTerm) {
            const typeSearch = Array.isArray(item.type)
                ? item.type.join(' ').toLowerCase()
                : item.type?.toLowerCase() || '';
            const searchFields = [
                item.name?.toLowerCase() || '',
                typeSearch,
                item.entries?.join(' ').toLowerCase() || '',
            ].join(' ');

            if (!searchFields.includes(this.searchTerm)) {
                return false;
            }
        }

        // Source filter
        if (this.selectedSources.size > 0) {
            if (!this.selectedSources.has(item.source)) {
                return false;
            }
        }

        // Type filter (allow derived/prefixed type codes for items missing explicit type)
        if (this.filters.type.size > 0) {
            const itemTypes = this._getItemTypeCodes(item);

            const matchesType = Array.from(this.filters.type).some((t) => {
                const target = String(t).toUpperCase();
                return itemTypes.some((it) => it === target || it.startsWith(target));
            });

            if (!matchesType) {
                return false;
            }
        }

        // Rarity filter
        if (this.filters.rarity.size > 0) {
            const itemRarity = (item.rarity || 'none').toLowerCase();
            if (
                !Array.from(this.filters.rarity).some((r) => r.toLowerCase() === itemRarity)
            ) {
                return false;
            }
        }

        // Property filters
        if (this.filters.property.size > 0) {
            const hasProperty = (prop) => {
                if (prop === 'magic') return item.rarity && item.rarity !== 'none';
                if (prop === 'cursed') return item.curse || false;
                if (prop === 'consumable')
                    return item.type === 'P' || item.type === 'SC' || item.type === '$';
                if (prop === 'wondrous') return item.wondrous || false;
                if (prop === 'attunement') return this._requiresAttunement(item);
                return false;
            };

            if (!Array.from(this.filters.property).some((p) => hasProperty(p))) {
                return false;
            }
        }

        return true;
    }

    async _renderItemList() {
        const listContainer = this.modal.querySelector('.equipment-list-container');
        if (!listContainer) return;

        console.log(
            '[EquipmentSelectionModal]',
            `Rendering ${this.filteredItems.length} items`,
        );

        let html = '';

        if (this.filteredItems.length === 0) {
            html = '<div class="alert alert-info">No items match your filters.</div>';
        } else {
            for (const item of this.filteredItems) {
                const requiresAttunement = this._requiresAttunement(item);
                const typeCodes = this._getItemTypeCodes(item);
                const type = this._getItemTypeName(typeCodes[0]);
                const rarity = item.rarity || 'Common';
                const weight = item.weight ? `${item.weight} lb` : 'N/A';
                const value = item.value
                    ? `${item.value / 100} gp`
                    : item.cost
                        ? `${item.cost / 100} gp`
                        : 'N/A';

                // Get description with textProcessor for custom tooltips/tags
                let description = 'No description';
                if (item.entries && item.entries.length > 0) {
                    const descParts = [];
                    for (const entry of item.entries) {
                        if (typeof entry === 'string') {
                            descParts.push(await textProcessor.processString(entry));
                        } else if (entry?.entries && Array.isArray(entry.entries)) {
                            for (const subEntry of entry.entries) {
                                if (typeof subEntry === 'string') {
                                    descParts.push(await textProcessor.processString(subEntry));
                                }
                            }
                        }
                    }
                    description = descParts.join(' ');
                }

                const isSelected = this.selectedItems.includes(item.id);
                const selectedClass = isSelected ? 'selected' : '';

                html += `
                    <div class="item-card ${selectedClass}" data-item-id="${item.id}">
                        <div class="item-card-header">
                            <div>
                                <strong>${item.name}</strong> 
                                <span class="text-muted">(${type})</span>
                                ${rarity !== 'Common' && rarity !== 'none' ? `<span class="badge bg-secondary ms-2">${rarity}</span>` : ''}
                                ${requiresAttunement ? '<span class="badge bg-warning text-dark ms-2">Attunement</span>' : ''}
                            </div>
                        </div>
                        <div class="item-card-body">
                            <div class="item-stats">
                                <div class="item-stat-row">
                                    <div class="item-stat">
                                        <strong>Weight:</strong> ${weight}
                                    </div>
                                    <div class="item-stat">
                                        <strong>Value:</strong> ${value}
                                    </div>
                                </div>
                            </div>
                            <div class="item-description">
                                ${description}
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        listContainer.innerHTML = html;
        this._renderSelectedItemsList();
    }

    _renderSelectedItemsList() {
        const selectedContainer = this.modal.querySelector(
            '.selected-equipment-list',
        );
        if (!selectedContainer) return;

        if (this.selectedItems.length === 0) {
            selectedContainer.innerHTML =
                '<p class="text-muted">No items selected</p>';
            return;
        }

        let html = '<ul class="list-group">';
        for (const itemId of this.selectedItems) {
            const item = this.allItems.find((i) => i.id === itemId);
            if (item) {
                html += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <span>${item.name}</span>
                        <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation()" data-remove-item="${itemId}">
                            <i class="fas fa-times"></i>
                        </button>
                    </li>
                `;
            }
        }
        html += '</ul>';

        selectedContainer.innerHTML = html;

        // Add remove listeners
        selectedContainer.querySelectorAll('[data-remove-item]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = btn.getAttribute('data-remove-item');
                this._toggleItemSelection(itemId);
            });
        });
    }

    _toggleItemSelection(itemId) {
        const index = this.selectedItems.indexOf(itemId);
        if (index > -1) {
            this.selectedItems.splice(index, 1);
        } else {
            this.selectedItems.push(itemId);
        }

        // Update UI
        const card = this.modal.querySelector(`[data-item-id="${itemId}"]`);
        if (card) {
            card.classList.toggle('selected');
        }

        this._renderSelectedItemsList();
    }

    _getItemTypeCodes(item) {
        const types = new Set();

        const addType = (val) => {
            if (!val) return;
            const normalized = String(val).split('|')[0].toUpperCase();
            if (normalized) types.add(normalized);
        };

        if (Array.isArray(item.type)) {
            item.type.forEach(addType);
        } else {
            addType(item.type);
        }

        // Derived fallbacks for items without a canonical type code
        if (item.weaponCategory) types.add('W');
        if (item.staff) types.add('ST');
        if (item.wand) types.add('WD');
        if (item.ring) types.add('RG');
        if (item.rod) types.add('RD');
        if (item.scroll) types.add('SC');
        return Array.from(types);
    }

    _requiresAttunement(item) {
        if (!item) return false;
        const { reqAttune, reqAttuneAlt, requiresAttunement, reqAttuneTags } = item;
        if (reqAttune || reqAttuneAlt || requiresAttunement) return true;
        if (Array.isArray(reqAttuneTags) && reqAttuneTags.length > 0) return true;
        return false;
    }

    _getItemTypeName(typeCode) {
        const types = {
            W: 'Weapon',
            A: 'Armor',
            G: 'Adventuring Gear',
            P: 'Potion',
            SC: 'Scroll',
            RG: 'Ring',
            RD: 'Rod',
            ST: 'Staff',
            WD: 'Wand',
            $: 'Treasure',
            TAH: 'Tack and Harness',
            TG: 'Trade Good',
            VEH: 'Vehicle',
        };
        return types[typeCode] || 'Item';
    }

    _updateSourceLabel(toggleBtn) {
        if (!toggleBtn) return;
        if (this.selectedSources.size === 0) {
            toggleBtn.textContent = 'All sources';
            return;
        }
        const count = this.selectedSources.size;
        const preview = Array.from(this.selectedSources)
            .slice(0, 2)
            .map((s) => s.toUpperCase())
            .join(', ');
        const suffix = count > 2 ? ` +${count - 2}` : '';
        toggleBtn.textContent = `${preview}${suffix}`;
    }

    _clearFilters() {
        this.searchTerm = '';
        this.selectedSources.clear();
        this.filters.type.clear();
        this.filters.rarity.clear();
        this.filters.property.clear();

        // Reset UI
        const searchInput = this.modal.querySelector('#equipmentSearch');
        if (searchInput) searchInput.value = '';

        const sourceToggle = this.modal.querySelector('.equipment-source-toggle');
        if (sourceToggle) this._updateSourceLabel(sourceToggle);

        this.modal.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
            cb.checked = false;
        });

        this._filterItems();
    }

    async _handleAddSelected() {
        if (this.selectedItems.length === 0) {
            showNotification('No items selected', 'warning');
            return;
        }

        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return;
        }

        try {
            const addedItems = [];

            for (const itemId of this.selectedItems) {
                const item = this.allItems.find((i) => i.id === itemId);
                if (item) {
                    const addedItem = equipmentService.addItem(
                        character,
                        item,
                        1,
                        'Manual',
                    );
                    if (addedItem) {
                        addedItems.push(addedItem);
                    }
                }
            }

            if (addedItems.length > 0) {
                eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
                showNotification(
                    `Added ${addedItems.length} item(s) to inventory`,
                    'success',
                );
                this.bootstrapModal.hide();
                this.resolvePromise(addedItems);
            } else {
                showNotification('Failed to add items', 'error');
            }
        } catch (error) {
            console.error('[EquipmentSelectionModal]', 'Failed to add items:', error);
            showNotification('Failed to add items', 'error');
        }
    }

    _handleCancel() {
        this.bootstrapModal.hide();
        this.resolvePromise(null);
    }

    _cleanup() {
        this.selectedItems = [];
        this.searchTerm = '';
        this.selectedSources.clear();
        this.filters.type.clear();
        this.filters.rarity.clear();
        this.filters.property.clear();
    }
}
