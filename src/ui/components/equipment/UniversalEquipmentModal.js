import { AppState } from '../../../app/AppState.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { equipmentService } from '../../../services/EquipmentService.js';
import { itemService } from '../../../services/ItemService.js';
import { FilterBuilder } from '../selection/FilterBuilder.js';
import { UniversalSelectionModal } from '../selection/UniversalSelectionModal.js';

export class UniversalEquipmentModal {
    constructor({ allowClose = true } = {}) {
        this.allowClose = allowClose;
        this.descriptionCache = new Map();
        this._controller = null;

        this.typeFilters = new Set();
        this.rarityFilters = new Set();
        this.propertyFilters = new Set();
    }

    async show() {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return null;
        }

        this._ensureController();
        const result = await this._controller.show({ character });
        if (Array.isArray(result)) return result;
        return null;
    }

    _ensureController() {
        if (this._controller) return;

        this._controller = new UniversalSelectionModal({
            modalId: 'universalEquipmentSelectionModal',
            modalTitle: 'Add Equipment',
            allowClose: this.allowClose,
            pageSize: 50,
            listContainerSelector: '.spell-list-container',
            selectedContainerSelector: '.selected-spells-container',
            searchInputSelector: '.spell-search-input',
            filterToggleSelector: '.spell-filter-toggle-btn',
            filterPanelSelector: '.spell-filters-column',
            confirmSelector: '.btn-confirm',
            cancelSelector: '.btn-cancel',
            itemIdAttribute: 'data-item-id',
            selectionMode: 'multiple',
            selectionLimit: null,
            loadItems: (ctx) => this._loadItems(ctx),
            matchItem: (item, state) => this._itemMatchesFilters(item, state),
            renderItem: (item, state) => this._renderItemCard(item, state),
            getItemId: (item) => item.id,
            onConfirm: (selected) => this._handleConfirm(selected),
            onCancel: () => this._handleCancel(),
            buildFilters: (_ctx, panel, cleanup) => this._buildFilters(panel, cleanup),
            descriptionCache: this.descriptionCache,
            fetchDescription: (item) => this._fetchItemDescription(item),
            descriptionContainerSelector: '.item-description',
        });
    }

    async _loadItems(_ctx) {
        // Get all items (both regular items and base items)
        const regularItems = itemService.getAllItems?.() || [];
        const baseItems = itemService.getAllBaseItems?.() || [];

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

        const combined = Array.from(itemMap.values())
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return combined;
    }

    _itemMatchesFilters(item, state) {
        const term = (state.searchTerm || '').trim().toLowerCase();
        if (term) {
            if (!((item.name || '').toLowerCase().includes(term))) return false;
        }

        // Type filter - use _getItemTypeCodes to handle arrays and derived types
        if (this.typeFilters.size > 0) {
            const itemTypes = this._getItemTypeCodes(item);
            const matchesType = Array.from(this.typeFilters).some((filterValue) => {
                // Special handling for weapon and armor meta-filters
                if (filterValue === 'weapon') {
                    return item.weapon || item.weaponCategory ||
                        itemTypes.some(t => t === 'M' || t === 'R' || t.startsWith('M') || t.startsWith('R'));
                }
                if (filterValue === 'armor') {
                    return item.armor || itemTypes.some(t => t === 'LA' || t === 'MA' || t === 'HA' ||
                        t.startsWith('LA') || t.startsWith('MA') || t.startsWith('HA'));
                }
                // Direct type code matching
                const target = String(filterValue).toUpperCase();
                return itemTypes.some((it) => it === target || it.startsWith(target));
            });
            if (!matchesType) return false;
        }

        // Rarity filter
        if (this.rarityFilters.size > 0) {
            const itemRarity = (item.rarity || 'none').toLowerCase();
            if (!Array.from(this.rarityFilters).some((r) => r.toLowerCase() === itemRarity)) {
                return false;
            }
        }

        // Property filters - check specific properties
        if (this.propertyFilters.size > 0) {
            const hasProperty = (prop) => {
                if (prop === 'magic') return item.rarity && item.rarity !== 'none';
                if (prop === 'cursed') return item.curse || false;
                if (prop === 'consumable') {
                    const codes = this._getItemTypeCodes(item);
                    return codes.some(c => c === 'P' || c === 'SC' || c === '$');
                }
                return false;
            };

            if (!Array.from(this.propertyFilters).some((p) => hasProperty(p))) {
                return false;
            }
        }

        return true;
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

    _renderItemCard(item, state) {
        const isSelected = state?.selectedIds?.has(item.id);
        const typeCodes = this._getItemTypeCodes(item);
        const type = this._getItemTypeName(typeCodes[0]);
        const rarity = item.rarity || 'Common';
        const requiresAttunement = item.reqAttune || false;
        const weight = item.weight ? `${item.weight} lb` : 'N/A';
        const value = item.value ? `${item.value} gp` : 'N/A';

        const desc = this.descriptionCache.has(item.id)
            ? this.descriptionCache.get(item.id)
            : '<span class="text-muted small">Loading...</span>';

        return `
            <div class="item-card ${isSelected ? 'selected' : ''}" data-item-id="${item.id}">
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
                        ${desc}
                    </div>
                </div>
            </div>
        `;
    }

    async _fetchItemDescription(item) {
        const parts = [];
        if (Array.isArray(item.entries)) {
            for (const entry of item.entries) {
                if (typeof entry === 'string') {
                    parts.push(await textProcessor.processString(entry));
                } else if (Array.isArray(entry?.entries)) {
                    for (const sub of entry.entries) {
                        if (typeof sub === 'string') {
                            parts.push(await textProcessor.processString(sub));
                        }
                    }
                }
            }
        } else if (typeof item.entries === 'string') {
            parts.push(await textProcessor.processString(item.entries));
        }
        return parts.length ? parts.join(' ') : '<span class="text-muted small">No description available.</span>';
    }

    _buildFilters(panel, cleanup) {
        if (!panel) return;
        panel.innerHTML = '';
        const builder = new FilterBuilder(panel, cleanup);

        builder.addCheckboxGroup({
            title: 'Type',
            options: [
                { label: 'Weapon', value: 'weapon' },
                { label: 'Armor', value: 'armor' },
                { label: 'Ammunition', value: 'A' },
                { label: 'Adventuring Gear', value: 'G' },
                { label: 'Potion', value: 'P' },
                { label: 'Scroll', value: 'SC' },
            ],
            stateSet: this.typeFilters,
            onChange: () => this._controller._renderList(),
            columns: 2,
        });

        builder.addCheckboxGroup({
            title: 'Rarity',
            options: [
                { label: 'Common', value: 'common' },
                { label: 'Uncommon', value: 'uncommon' },
                { label: 'Rare', value: 'rare' },
                { label: 'Very Rare', value: 'very rare' },
                { label: 'Legendary', value: 'legendary' },
                { label: 'Artifact', value: 'artifact' },
            ],
            stateSet: this.rarityFilters,
            onChange: () => this._controller._renderList(),
            columns: 2,
        });

        builder.addCheckboxGroup({
            title: 'Properties',
            options: [
                { label: 'Magic', value: 'magic' },
                { label: 'Cursed', value: 'cursed' },
                { label: 'Consumable', value: 'consumable' },
            ],
            stateSet: this.propertyFilters,
            onChange: () => this._controller._renderList(),
            columns: 2,
        });
    }

    async _handleConfirm(selected) {
        const character = AppState.getCurrentCharacter();
        if (!character || !Array.isArray(selected) || selected.length === 0) {
            return selected;
        }

        let successCount = 0;
        const failedItems = [];

        for (const item of selected) {
            try {
                const success = equipmentService.addItem(character, item, 1);
                if (success) {
                    successCount++;
                } else {
                    failedItems.push(item.name);
                }
            } catch (error) {
                console.error('[UniversalEquipmentModal]', 'Error adding item:', error);
                failedItems.push(item.name);
            }
        }

        if (successCount > 0) {
            const message = successCount === 1
                ? `Added ${selected[0].name}`
                : `Added ${successCount} item${successCount > 1 ? 's' : ''}`;
            showNotification(message, 'success');
            eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
        }

        if (failedItems.length > 0) {
            showNotification(`Failed to add: ${failedItems.join(', ')}`, 'error');
        }

        // Return array of selected items
        return selected;
    }

    _handleCancel() {
        // No-op
    }
}
