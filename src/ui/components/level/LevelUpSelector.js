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
        this.activeFilters = {}; // { school: 'abjuration', type: 'spell' }
        this.currentTab = this.tabLevels.length > 0 ? this.tabLevels[0].value : null;

        // Initialize filter defaults
        Object.keys(this.filterSets).forEach(filterKey => {
            this.activeFilters[filterKey] = '';
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
     * Generate modal HTML structure
     */
    _getModalHTML() {
        const hasFilters = Object.keys(this.filterSets).length > 0;
        const hasTabs = this.tabLevels.length > 0;

        return `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header border-bottom">
                        <h5 class="modal-title">
                            <i class="fas fa-check-circle"></i>
                            ${this.modalTitle}
                        </h5>
                        <button type="button" class="btn-close" data-selector-cancel></button>
                    </div>
                    
                    <div class="modal-body">
                        <!-- Search and Filter Bar -->
                        <div class="row g-2 mb-3">
                            <div class="col-md-${hasFilters ? '6' : '8'}">
                                <input 
                                    type="text" 
                                    class="form-control form-control-sm"
                                    placeholder="Search..."
                                    data-selector-search
                                >
                            </div>
                            ${hasFilters ? this._getFilterHTML() : ''}
                            <div class="col-md-${hasFilters ? '2' : '4'}">
                                <button class="btn btn-sm btn-outline-secondary w-100" data-selector-clear>
                                    <i class="fas fa-times"></i> Clear
                                </button>
                            </div>
                        </div>

                        <!-- Item Level/Group Tabs (if applicable) -->
                        ${hasTabs ? `
                            <ul class="nav nav-tabs mb-3" role="tablist" data-selector-tabs>
                                ${this.tabLevels.map(tab => `
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link ${tab.value === this.currentTab ? 'active' : ''}" 
                                                type="button" 
                                                data-selector-tab="${tab.value}" 
                                                role="tab">
                                            ${tab.label}
                                        </button>
                                    </li>
                                `).join('')}
                            </ul>
                        ` : ''}

                        <!-- Item List -->
                        <div class="selector-list" data-selector-list style="max-height: 400px; overflow-y: auto;">
                            <!-- Items rendered here -->
                        </div>

                        <!-- Selection Info -->
                        <div class="alert alert-info mt-3 mb-0" data-selector-info>
                            <span data-selector-count>Selected: 0</span> / <span data-selector-max>${this.maxSelections === Infinity ? '∞' : this.maxSelections}</span>
                        </div>
                    </div>
                    
                    <div class="modal-footer border-top">
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
        // Tab filter (if using tabs)
        if (this.currentTab !== null && item.level !== undefined && item.level !== this.currentTab) {
            return false;
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
            if (filterValue && item[filterKey] !== filterValue) {
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

        // Filter selects
        Object.keys(this.filterSets).forEach(filterKey => {
            const filterSelect = this._modal.querySelector(`[data-selector-filter="${filterKey}"]`);
            if (filterSelect) {
                this._cleanup.on(filterSelect, 'change', (e) => {
                    this.activeFilters[filterKey] = e.target.value;
                    this._renderItems();
                });
            }
        });

        // Clear button
        const clearBtn = this._modal.querySelector('[data-selector-clear]');
        if (clearBtn) {
            this._cleanup.on(clearBtn, 'click', () => {
                if (searchInput) searchInput.value = '';
                this.searchQuery = '';
                Object.keys(this.activeFilters).forEach(key => {
                    this.activeFilters[key] = '';
                    const select = this._modal.querySelector(`[data-selector-filter="${key}"]`);
                    if (select) select.value = '';
                });
                this._renderItems();
            });
        }

        // Tab buttons
        const tabButtons = this._modal.querySelectorAll('[data-selector-tab]');
        if (tabButtons.length > 0) {
            tabButtons.forEach((btn) => {
                this._cleanup.on(btn, 'click', (e) => {
                    e.preventDefault();
                    this.currentTab = parseInt(btn.dataset.selectorTab, 10);

                    // Update active tab
                    tabButtons.forEach((b) => b.classList.remove('active'));
                    btn.classList.add('active');

                    this._renderItems();
                });
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
     * Update selection counter display
     */
    _updateSelectionInfo() {
        const countDisplay = this._modal.querySelector('[data-selector-count]');
        if (countDisplay) {
            countDisplay.textContent = `Selected: ${this.selectedItems.length}`;
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
