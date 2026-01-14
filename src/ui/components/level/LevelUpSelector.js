import { DOMCleanup } from '../../../lib/DOMCleanup.js';

/**
 * LevelUpSelector
 * 
 * Generic, configurable modal for selecting items during level-up wizard.
 * Supports spells, class features, feats, and other searchable/filterable collections.
 * 
 * Configuration:
 * - items: Array of items to select from
 * - searchFields: Array of field names to search (e.g., ['name', 'description'])
 * - filterSets: Object of filter categories { school: [...], type: [...], etc }
 * - multiSelect: Boolean (default false)
 * - maxSelections: Number (default Infinity)
 * - tabLevels: Array of tab definitions for grouping [{ label: 'Cantrips', value: 0 }, ...]
 * - itemRenderer: Function(item) => html string
 * - onConfirm: Function(selectedItems) => void or Promise
 * - modalTitle: String
 * - context: Additional context object passed to functions
 */

export class LevelUpSelector {
    constructor(config) {
        // Core configuration
        this.items = config.items || [];
        this.searchFields = config.searchFields || ['name'];
        this.filterSets = config.filterSets || {};
        this.multiSelect = config.multiSelect ?? false;
        this.maxSelections = config.maxSelections ?? Infinity;
        this.tabLevels = config.tabLevels || [];
        this.itemRenderer = config.itemRenderer || this._defaultItemRenderer.bind(this);
        this.onConfirm = config.onConfirm || (() => {});
        this.modalTitle = config.modalTitle || 'Select Items';
        this.context = config.context || {};

        // Modal DOM elements
        this._modal = null;
        this._modalBS = null;
        this._cleanup = DOMCleanup.create();

        // Selection state
        this.selectedItems = [];
        this.filteredItems = [];

        // Filter state
        this.searchQuery = '';
        this.activeFilters = {}; // { school: Set(['abjuration']), type: Set(['spell']) }
        this.currentTab = this.tabLevels.length > 0 ? new Set() : null; // Set of selected tab values

        // Initialize filter defaults as Sets
        Object.keys(this.filterSets).forEach(filterKey => {
            this.activeFilters[filterKey] = new Set();
        });
    }

    /**
     * Initialize and display the selector modal
     */
    async show() {
        try {
            // Get or create modal
            this._getOrCreateModal();

            // Populate initial view
            this._renderItems();

            // Attach event listeners
            this._attachListeners();

            // Show modal
            if (this._modalBS) {
                this._modalBS.show();
            }
        } catch (error) {
            console.error('[LevelUpSelector]', 'Error showing selector:', error);
        }
    }

    /**
     * Get or create the modal element
     */
    _getOrCreateModal() {
        const modalId = 'levelUpSelectorModal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.innerHTML = this._getModalHTML();
            document.body.appendChild(modal);
        }

        this._modal = modal;

        // Initialize or refresh Bootstrap modal
        if (this._modalBS) {
            this._modalBS.dispose();
        }
        this._modalBS = new bootstrap.Modal(modal, { backdrop: 'static', keyboard: false });
    }

    /**
     * Generate modal HTML structure (matches equipment/spell modal design)
     */
    _getModalHTML() {
        const hasFilters = Object.keys(this.filterSets).length > 0 || this.tabLevels.length > 0;

        return `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-check-circle"></i>
                            ${this.modalTitle}
                        </h5>
                        <button type="button" class="btn-close" data-selector-cancel aria-label="Close"></button>
                    </div>
                    
                    <div class="modal-body">
                        <!-- Search Bar (Full Width) -->
                        <div class="d-flex gap-2 mb-2">
                            ${hasFilters ? `
                                <button class="btn btn-outline-secondary" type="button"
                                    data-selector-filter-toggle title="Toggle filters panel" data-filters-visible="true">
                                    <i class="fas fa-filter"></i>
                                </button>
                            ` : ''}
                            <input type="text" class="form-control flex-grow-1"
                                placeholder="Search..."
                                data-selector-search>
                            <button class="btn btn-outline-secondary" data-selector-clear>
                                <i class="fas fa-times"></i> Clear
                            </button>
                        </div>

                        <!-- Filters and Results Row -->
                        <div class="row">
                            ${hasFilters ? `
                                <!-- Filters Panel -->
                                <div class="col-md-4" data-selector-filters-panel>
                                    ${this._getFiltersHTML()}
                                </div>
                            ` : ''}
                            
                            <!-- Results List -->
                            <div class="${hasFilters ? 'col-md-8' : 'col-12'}">
                                <div class="selector-list-scroll" style="max-height: 400px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 0.25rem; padding: 0.5rem;">
                                    <div class="selector-list" data-selector-list>
                                        <!-- Items rendered here -->
                                    </div>
                                </div>
                                
                                <!-- Selected Items Display -->
                                <div class="mt-3">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <h6 class="mb-0">Selected Items</h6>
                                        <span class="badge bg-info" data-selector-count>0 / ${this.maxSelections === Infinity ? '∞' : this.maxSelections}</span>
                                    </div>
                                    <div class="alert alert-secondary mb-0" data-selector-selected-display style="min-height: 60px; max-height: 150px; overflow-y: auto;">
                                        <em class="text-muted">No items selected</em>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-selector-cancel>
                            Cancel
                        </button>
                        <button type="button" class="btn btn-primary" data-selector-confirm>
                            Confirm Selection
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate filter HTML for active filter sets (collapsible cards like spell/equipment modal)
     */
    _getFiltersHTML() {
        let html = '';

        // Spell level tabs as collapsible filter card
        if (this.tabLevels.length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header" style="cursor: pointer;" data-bs-toggle="collapse"
                        data-bs-target="#collapseLevels" aria-expanded="true">
                        <h6 class="mb-0 d-flex justify-content-between align-items-center">
                            <span>Level</span>
                            <i class="fas fa-chevron-down"></i>
                        </h6>
                    </div>
                    <div class="collapse show" id="collapseLevels">
                        <div class="card-body">
            `;

            this.tabLevels.forEach(tab => {
                const tabId = `level_${tab.value}`;
                html += `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" 
                            value="${tab.value}" 
                            data-selector-tab="${tab.value}"
                            id="${tabId}">
                        <label class="form-check-label" for="${tabId}">${tab.label}</label>
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
        }

        // Other filter sets as collapsible cards
        Object.entries(this.filterSets).forEach(([filterKey, filterOptions]) => {
            const capitalizedKey = filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
            const collapseId = `collapse${capitalizedKey}`;

            html += `
                <div class="card mb-3">
                    <div class="card-header" style="cursor: pointer;" data-bs-toggle="collapse"
                        data-bs-target="#${collapseId}" aria-expanded="true">
                        <h6 class="mb-0 d-flex justify-content-between align-items-center">
                            <span>${capitalizedKey}</span>
                            <i class="fas fa-chevron-down"></i>
                        </h6>
                    </div>
                    <div class="collapse show" id="${collapseId}">
                        <div class="card-body" style="max-height: 300px; overflow-y: auto;">
            `;

            filterOptions.forEach(opt => {
                const filterId = `${filterKey}_${opt}`.replace(/[^a-zA-Z0-9_-]/g, '_');
                html += `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" 
                            value="${opt}" 
                            data-selector-filter="${filterKey}"
                            id="${filterId}">
                        <label class="form-check-label" for="${filterId}">${opt}</label>
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
        });

        return html;
    }

    /**
     * Generate filter HTML for active filter sets
     */
    _getFilterHTML() {
        const filterHtml = Object.entries(this.filterSets)
            .map(([filterKey, filterOptions]) => {
                const capitalizedKey = filterKey.charAt(0).toUpperCase() + filterKey.slice(1);
                return `
                    <div class="col-md-3">
                        <select class="form-select form-select-sm" data-selector-filter="${filterKey}">
                            <option value="">All ${capitalizedKey}</option>
                            ${filterOptions.map(opt => 
                                `<option value="${opt}">${opt}</option>`
                            ).join('')}
                        </select>
                    </div>
                `;
            })
            .join('');

        return filterHtml;
    }

    /**
     * Default item renderer (override via config)
     */
    _defaultItemRenderer(item) {
        const checkboxType = this.multiSelect ? 'checkbox' : 'radio';
        const inputName = this.multiSelect ? `selector_item` : 'selector_item_single';
        const isSelected = this.selectedItems.some(s => this._itemKey(s) === this._itemKey(item));

        return `
            <div class="form-check selector-item-check mb-2">
                <input 
                    class="form-check-input" 
                    type="${checkboxType}" 
                    id="item_${this._itemKey(item)}"
                    value="${this._itemKey(item)}"
                    data-selector-item
                    name="${inputName}"
                    ${isSelected ? 'checked' : ''}
                >
                <label class="form-check-label w-100" for="item_${this._itemKey(item)}">
                    <strong>${item.name || item.id}</strong>
                    <div class="small text-muted">${item.source || ''}</div>
                </label>
            </div>
        `;
    }

    /**
     * Generate unique key for item (for selection tracking)
     */
    _itemKey(item) {
        return `${item.id || item.name}`;
    }

    /**
     * Render the item list with current filters/search applied
     */
    _renderItems() {
        const itemList = this._modal.querySelector('[data-selector-list]');
        if (!itemList) return;

        // Filter items based on current state
        this.filteredItems = this.items.filter(item => this._matchesAllFilters(item));

        // Render filtered items
        itemList.innerHTML = this.filteredItems
            .map(item => this.itemRenderer(item))
            .join('');

        // Update info
        this._updateSelectionInfo();
    }

    /**
     * Check if item matches all active filters
     */
    _matchesAllFilters(item) {
        // Tab filter (if using tabs) - check if any tab is selected
        if (this.currentTab !== null && this.tabLevels.length > 0) {
            // If tabs exist, currentTab holds selected tab values as a Set
            if (this.currentTab.size > 0 && !this.currentTab.has(item.level)) {
                return false;
            }
        }

        // Search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            const matches = this.searchFields.some(field => {
                const value = item[field];
                return value?.toString?.()?.toLowerCase?.()?.includes?.(query);
            });
            if (!matches) return false;
        }

        // Custom filters
        for (const [filterKey, filterValue] of Object.entries(this.activeFilters)) {
            if (filterValue && filterValue.size > 0 && !filterValue.has(item[filterKey])) {
                return false;
            }
        }

        return true;
    }

    /**
     * Attach event listeners to modal
     */
    _attachListeners() {
        // Search input
        const searchInput = this._modal.querySelector('[data-selector-search]');
        if (searchInput) {
            this._cleanup.on(searchInput, 'input', (e) => {
                this.searchQuery = e.target.value;
                this._renderItems();
            });
        }

        // Filter toggle button
        const filterToggle = this._modal.querySelector('[data-selector-filter-toggle]');
        const filtersPanel = this._modal.querySelector('[data-selector-filters-panel]');
        if (filterToggle && filtersPanel) {
            this._cleanup.on(filterToggle, 'click', () => {
                const isVisible = filterToggle.dataset.filtersVisible === 'true';
                filtersPanel.style.display = isVisible ? 'none' : 'block';
                filterToggle.dataset.filtersVisible = !isVisible;
            });
        }

        // Tab checkboxes
        const tabCheckboxes = this._modal.querySelectorAll('[data-selector-tab]');
        if (tabCheckboxes.length > 0) {
            tabCheckboxes.forEach((checkbox) => {
                this._cleanup.on(checkbox, 'change', () => {
                    const tabValue = parseInt(checkbox.value, 10);
                    if (checkbox.checked) {
                        this.currentTab.add(tabValue);
                    } else {
                        this.currentTab.delete(tabValue);
                    }
                    this._renderItems();
                });
            });
        }

        // Filter checkboxes
        Object.keys(this.filterSets).forEach(filterKey => {
            const filterCheckboxes = this._modal.querySelectorAll(`[data-selector-filter="${filterKey}"]`);
            filterCheckboxes.forEach(checkbox => {
                this._cleanup.on(checkbox, 'change', () => {
                    if (checkbox.checked) {
                        this.activeFilters[filterKey].add(checkbox.value);
                    } else {
                        this.activeFilters[filterKey].delete(checkbox.value);
                    }
                    this._renderItems();
                });
            });
        });

        // Clear button
        const clearBtn = this._modal.querySelector('[data-selector-clear]');
        if (clearBtn) {
            this._cleanup.on(clearBtn, 'click', () => {
                if (searchInput) searchInput.value = '';
                this.searchQuery = '';
                
                // Clear all filters
                Object.keys(this.activeFilters).forEach(key => {
                    this.activeFilters[key].clear();
                    const checkboxes = this._modal.querySelectorAll(`[data-selector-filter="${key}"]`);
                    checkboxes.forEach(cb => {
                        cb.checked = false;
                    });
                });
                
                // Clear tabs
                if (this.currentTab instanceof Set) {
                    this.currentTab.clear();
                    tabCheckboxes.forEach(cb => {
                        cb.checked = false;
                    });
                }
                
                this._renderItems();
            });
        }

        // Item inputs (checkboxes/radios)
        const inputs = this._modal.querySelectorAll('[data-selector-item]');
        inputs.forEach((input) => {
            this._cleanup.on(input, 'change', () => {
                this._updateSelectedItems();
            });
        });

        // Cancel button
        const cancelBtn = this._modal.querySelector('[data-selector-cancel]');
        if (cancelBtn) {
            this._cleanup.on(cancelBtn, 'click', () => {
                this.cancel();
            });
        }

        // Confirm button
        const confirmBtn = this._modal.querySelector('[data-selector-confirm]');
        if (confirmBtn) {
            this._cleanup.on(confirmBtn, 'click', async () => {
                await this.confirm();
            });
        }
    }

    /**
     * Update selectedItems from checked inputs
     */
    _updateSelectedItems() {
        const inputs = this._modal.querySelectorAll('[data-selector-item]:checked');
        const selectedKeys = Array.from(inputs).map(input => input.value);

        this.selectedItems = this.items.filter(item => selectedKeys.includes(this._itemKey(item)));

        this._updateSelectionInfo();
    }

    /**
     * Update selection counter and display
     */
    _updateSelectionInfo() {
        const countDisplay = this._modal.querySelector('[data-selector-count]');
        if (countDisplay) {
            countDisplay.textContent = `${this.selectedItems.length} / ${this.maxSelections === Infinity ? '∞' : this.maxSelections}`;
        }

        // Update selected items display
        const selectedDisplay = this._modal.querySelector('[data-selector-selected-display]');
        if (selectedDisplay) {
            if (this.selectedItems.length === 0) {
                selectedDisplay.innerHTML = '<em class="text-muted">No items selected</em>';
            } else {
                const itemsHtml = this.selectedItems.map(item => {
                    return `
                        <div class="badge bg-secondary me-2 mb-2">
                            ${item.name || item.id}
                            <button type="button" class="btn-close btn-close-white ms-1" 
                                style="font-size: 0.65rem; vertical-align: middle;"
                                data-deselect-item="${this._itemKey(item)}"
                                aria-label="Remove"></button>
                        </div>
                    `;
                }).join('');
                selectedDisplay.innerHTML = itemsHtml;

                // Attach deselect listeners
                this.selectedItems.forEach(item => {
                    const btn = selectedDisplay.querySelector(`[data-deselect-item="${this._itemKey(item)}"]`);
                    if (btn) {
                        this._cleanup.on(btn, 'click', () => {
                            // Find and uncheck the item
                            const checkbox = this._modal.querySelector(`[data-selector-item][value="${this._itemKey(item)}"]`);
                            if (checkbox) {
                                checkbox.checked = false;
                                this._updateSelectedItems();
                            }
                        });
                    }
                });
            }
        }
    }

    /**
     * Validate selections before confirming
     */
    _validateSelections() {
        if (this.selectedItems.length > this.maxSelections) {
            console.warn('[LevelUpSelector]', `Too many items selected: ${this.selectedItems.length} > ${this.maxSelections}`);
            return false;
        }

        return true;
    }

    /**
     * Confirm selections and call onConfirm handler
     */
    async confirm() {
        if (!this._validateSelections()) {
            alert(`You have selected too many items. Maximum allowed: ${this.maxSelections}`);
            return;
        }

        try {
            // Call confirmation handler with selected items
            await this.onConfirm(this.selectedItems, this.context);
        } catch (error) {
            console.error('[LevelUpSelector]', 'Error in onConfirm handler:', error);
        }

        // Close modal
        this.cancel();
    }

    /**
     * Cancel selection and close modal
     */
    cancel() {
        if (this._modalBS) {
            this._modalBS.hide();
        }
        this.dispose();
    }

    /**
     * Cleanup and dispose resources
     */
    dispose() {
        this._cleanup.cleanup();

        if (this._modalBS) {
            this._modalBS.dispose();
            this._modalBS = null;
        }

        if (this._modal) {
            this._modal.remove();
            this._modal = null;
        }
    }
}
