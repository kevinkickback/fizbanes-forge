// Shared base for selection modals (spells, feats, equipment, items)
// Provides search, source filtering, generic filter hooks, selection tracking, and Bootstrap lifecycle with DOMCleanup.

import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { showNotification } from '../../../lib/Notifications.js';

/**
 * UniversalSelectionModal
 * 
 * Generic, reusable modal for selecting items (spells, equipment, items, feats, etc).
 * Dynamically generates modal HTML using proven spell-filter-row CSS structure.
 * 
 * Configuration (passed via config object):
 * - modalTitle: String - Title for the modal
 * - items: Array - Items to select from
 * - loadItems: Function - Async loader for items
 * - renderItem: Function(item, state) - HTML renderer for individual items
 * - getItemId: Function(item) - Extract stable ID from item
 * - matchItem: Function(item, state) - Filter predicate
 * - buildFilters: Function(ctx, panel, cleanup) - Build filter UI
 * - onConfirm: Function(selectedItems) - Handler on confirm
 * - onCancel: Function() - Handler on cancel
 * - selectionMode: 'single'|'multiple' - Selection mode
 * - selectionLimit: number|null - Max selections allowed
 * - etc...
 */

export class UniversalSelectionModal {
    constructor(config = {}) {
        this.config = {
            modalId: `modal_${Date.now()}_${Math.random()}`, // Auto-generate unique ID
            modalTitle: 'Select Items',
            allowClose: true,
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
            initialSelectedItems: [],
            getInitialSelection: null,
            searchMatcher: null,
            buildFilters: null,
            onError: null,
            ...config,
        };

        this.modal = null;
        this.bootstrapModal = null;
        this._cleanup = DOMCleanup.create();
        this._resolvePromise = null;

        this.state = {
            items: [],
            filtered: [],
            selectedIds: new Set(),
            selectedItems: [],
            searchTerm: '',
            page: 0,
        };
    }

    /**
     * Get or create the modal element with proper spell-filter-row structure
     */
    _getOrCreateModal() {
        let modal = document.getElementById(this.config.modalId);

        if (!modal) {
            modal = document.createElement('div');
            modal.id = this.config.modalId;
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.setAttribute('aria-hidden', 'true');
            modal.setAttribute('data-bs-backdrop', 'static');
            modal.setAttribute('data-bs-keyboard', 'false');
            modal.innerHTML = this._getModalHTML();
            document.body.appendChild(modal);
        }

        this.modal = modal;

        // Dispose and recreate Bootstrap modal
        if (this.bootstrapModal) {
            try {
                this.bootstrapModal.dispose();
            } catch (e) {
                console.warn('[UniversalSelectionModal]', 'Dispose failed', e);
            }
        }
        this.bootstrapModal = new bootstrap.Modal(modal, {
            backdrop: this.config.allowClose ? true : 'static',
            keyboard: this.config.allowClose,
        });
    }

    /**
     * Generate complete modal HTML using spell-filter-row structure
     */
    _getModalHTML() {
        return `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-check-circle"></i>
                            ${this.config.modalTitle}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    
                    <div class="modal-body" style="overflow: hidden; display: flex; flex-direction: column; max-height: 100%;">
                        <!-- Search Bar -->
                        <div class="d-flex gap-2 mb-2">
                            <button class="btn btn-outline-secondary spell-filter-toggle-btn" type="button"
                                title="Toggle filters panel" data-filters-visible="true">
                                <i class="fas fa-filter"></i>
                            </button>
                            <input type="text" class="form-control spell-search-input flex-grow-1"
                                placeholder="Search...">
                            <button class="btn btn-outline-secondary" type="button" data-search-clear
                                title="Clear search">
                                <i class="fas fa-times"></i> Clear
                            </button>
                        </div>
                        
                        <!-- Filters and Results (spell-filter-row layout) -->
                        <div class="spell-filter-row">
                            <!-- Filters Panel -->
                            <div class="spell-filters-column">
                                <!-- Filters populated by buildFilters callback -->
                            </div>
                            
                            <!-- Results Column -->
                            <div class="spell-results-column">
                                <!-- List Container with scroll -->
                                <div class="spell-list-scroll-container">
                                    <div class="spell-list-container">
                                        <!-- Items rendered here -->
                                    </div>
                                </div>
                                
                                <!-- Selected Items Display -->
                                <div class="mt-3 selected-spells-section">
                                    <h6 class="mb-2">Selected</h6>
                                    <div class="selected-spells-container" style="min-height: 32px; max-height: 200px; overflow-y: auto;">
                                        <em class="text-muted">No items selected</em>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary btn-cancel" data-bs-dismiss="modal">
                            Cancel
                        </button>
                        <button type="button" class="btn btn-primary btn-confirm" disabled>
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async show(context = {}) {
        const ctx = this.config.getContext ? this.config.getContext() : context;
        try {
            // Create or get modal element with proper HTML structure
            this._getOrCreateModal();

            // Load data
            this.state.items = await (this.config.loadItems?.(ctx) || []);
            this.state.filtered = [...this.state.items];

            // Prime initial selections if provided
            const initialSelection = this.config.getInitialSelection
                ? this.config.getInitialSelection(ctx) || []
                : this.config.initialSelectedItems || [];
            this._primeSelection(initialSelection);

            // Reset list containers before render
            this._renderList();
            this._renderSelected();

            this._cleanup.registerBootstrapModal(this.modal, this.bootstrapModal);
            this._cleanup.once(this.modal, 'hidden.bs.modal', () => this._onHidden());

            this._setupSearch();
            this._setupFilterToggle();
            this._setupConfirmCancel(ctx);
            this._setupListSelection();

            // Allow caller to build custom filters after base hooks are ready
            if (typeof this.config.buildFilters === 'function') {
                const panel = this.modal.querySelector(this.config.filterPanelSelector);
                this.config.buildFilters(ctx, panel, this._cleanup);
            }

            this.bootstrapModal.show();

            return new Promise((resolve) => {
                this._resolvePromise = resolve;
            });
        } catch (error) {
            console.error('[UniversalSelectionModal]', 'Failed to show modal', error);
            if (this.config.onError) {
                this.config.onError(error);
            } else {
                showNotification('Failed to open selection', 'error');
            }
            return null;
        }
    }

    //-------------------------------------------------------------------------
    // Setup helpers
    //-------------------------------------------------------------------------

    _setupSearch() {
        const searchInput = this.modal.querySelector(this.config.searchInputSelector);
        if (!searchInput) return;

        this._cleanup.on(searchInput, 'input', (e) => {
            this.state.searchTerm = e.target.value.trim().toLowerCase();
            this.state.page = 0;
            this._renderList();
        });

        const clearBtn = this.modal.querySelector('[data-search-clear]');
        if (clearBtn) {
            this._cleanup.on(clearBtn, 'click', () => {
                searchInput.value = '';
                this.state.searchTerm = '';
                this.state.page = 0;
                this._renderList();
            });
        }
    }

    _setupFilterToggle() {
        const toggle = this.modal.querySelector(this.config.filterToggleSelector);
        const panel = this.modal.querySelector(this.config.filterPanelSelector);
        if (!toggle || !panel) return;

        this._cleanup.on(toggle, 'click', () => {
            const isCollapsed = panel.classList.toggle('collapsed');
            toggle.setAttribute('data-filters-visible', (!isCollapsed).toString());
        });
    }



    _setupConfirmCancel(ctx) {
        const confirmBtn = this.modal.querySelector(this.config.confirmSelector);
        if (confirmBtn) {
            this._cleanup.on(confirmBtn, 'click', async () => {
                const selected = this._currentSelection();

                if (this.config.selectionLimit && selected.length > this.config.selectionLimit) {
                    showNotification(`You can only select ${this.config.selectionLimit} item(s).`, 'warning');
                    return;
                }

                try {
                    await this.config.onConfirm?.(selected, ctx);
                } finally {
                    this._resolveAndHide(selected);
                }
            });
        }

        const cancelBtn = this.modal.querySelector(this.config.cancelSelector);
        if (cancelBtn) {
            this._cleanup.on(cancelBtn, 'click', () => {
                if (this.config.onCancel) this.config.onCancel(ctx);
                this._resolveAndHide(null);
            });
        }
    }

    _setupListSelection() {
        const list = this.modal.querySelector(this.config.listContainerSelector);
        if (!list) return;

        this._cleanup.on(list, 'click', (e) => {
            const target = e.target.closest(`[${this.config.itemIdAttribute}]`);
            if (!target) return;
            const itemId = target.getAttribute(this.config.itemIdAttribute);
            this._toggleSelection(itemId);
        });
    }

    //-------------------------------------------------------------------------
    // Rendering and selection
    //-------------------------------------------------------------------------

    _matches(item) {
        const term = this.state.searchTerm;
        if (term) {
            const matchesSearch = typeof this.config.searchMatcher === 'function'
                ? this.config.searchMatcher(item, term)
                : (item.name || '').toLowerCase().includes(term);

            if (!matchesSearch) return false;
        }

        if (typeof this.config.matchItem === 'function') {
            return this.config.matchItem(item, this.state);
        }

        return true;
    }

    _renderList() {
        const container = this.modal?.querySelector(this.config.listContainerSelector);
        if (!container) return;

        this.state.filtered = this.state.items.filter((item) => this._matches(item));

        const start = this.state.page * this.config.pageSize;
        const end = start + this.config.pageSize;
        const pageItems = this.state.filtered.slice(start, end);

        const rows = pageItems.map((item) => this.config.renderItem?.(item, this.state) || '');

        if (this.state.filtered.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No results match your filters.</div>';
        } else {
            let html = rows.join('');
            if (end < this.state.filtered.length) {
                html += `
                    <div class="text-center mt-3">
                        <button class="btn btn-sm btn-outline-secondary" data-load-more>
                            Load More (${this.state.filtered.length - end} remaining)
                        </button>
                    </div>
                `;
            }
            container.innerHTML = html;
        }

        const loadMore = container.querySelector('[data-load-more]');
        if (loadMore) {
            this._cleanup.on(loadMore, 'click', () => {
                this.state.page += 1;
                this._renderList();
            });
        }

        // Apply selected state styling to list items
        container.querySelectorAll(`[${this.config.itemIdAttribute}]`).forEach((el) => {
            const id = el.getAttribute(this.config.itemIdAttribute);
            el.classList.toggle('selected', this.state.selectedIds.has(id));
        });

        if (typeof this.config.onListRendered === 'function') {
            this.config.onListRendered(this.state);
        }

        this._renderSelected();
    }

    _renderSelected() {
        const container = this.modal?.querySelector(this.config.selectedContainerSelector);
        if (!container) return;

        if (this.state.selectedItems.length === 0) {
            container.innerHTML = '<p class="text-muted small mb-0">No selections</p>';
            return;
        }

        const chips = this.state.selectedItems.map((item) => {
            const id = this._getItemId(item);
            return `
                <span class="badge bg-secondary me-2 mb-2">
                    ${item.name}
                    <button class="btn-close btn-close-white ms-2" data-deselect="${id}" style="font-size: 0.7rem;"></button>
                </span>
            `;
        });

        container.innerHTML = `<div class="d-flex flex-wrap">${chips.join('')}</div>`;

        const buttons = container.querySelectorAll('[data-deselect]');
        buttons.forEach((btn) => {
            this._cleanup.on(btn, 'click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-deselect');
                this._toggleSelection(id);
            });
        });
    }

    _toggleSelection(itemId) {
        if (!itemId) return;

        const item = this.state.items.find((i) => this._getItemId(i) === itemId);
        if (!item) return;

        const alreadySelected = this.state.selectedIds.has(itemId);

        if (this.config.selectionMode === 'single') {
            this.state.selectedIds = new Set(alreadySelected ? [] : [itemId]);
            this.state.selectedItems = alreadySelected ? [] : [item];
        } else {
            if (alreadySelected) {
                this.state.selectedIds.delete(itemId);
                this.state.selectedItems = this.state.selectedItems.filter((i) => this._getItemId(i) !== itemId);
            } else {
                if (this.config.selectionLimit && this.state.selectedIds.size >= this.config.selectionLimit) {
                    showNotification(`You can only select ${this.config.selectionLimit} item(s).`, 'warning');
                    return;
                }
                this.state.selectedIds.add(itemId);
                this.state.selectedItems.push(item);
            }
        }

        if (typeof this.config.onSelectionChange === 'function') {
            this.config.onSelectionChange({ ...this.state });
        }

        this._renderSelected();

        // Update UI selection classes in the list
        const list = this.modal?.querySelector(this.config.listContainerSelector);
        if (list) {
            list.querySelectorAll(`[${this.config.itemIdAttribute}]`).forEach((el) => {
                const id = el.getAttribute(this.config.itemIdAttribute);
                el.classList.toggle('selected', this.state.selectedIds.has(id));
            });
        }
    }

    _currentSelection() {
        return [...this.state.selectedItems];
    }

    _resolveAndHide(value) {
        if (this._resolvePromise) {
            this._resolvePromise(value);
            this._resolvePromise = null;
        }
        if (this.bootstrapModal) {
            this.bootstrapModal.hide();
        }
    }

    _onHidden() {
        if (this._resolvePromise) {
            this._resolvePromise(null);
            this._resolvePromise = null;
        }

        this._cleanup.cleanup();

        this.state = {
            items: [],
            filtered: [],
            selectedIds: new Set(),
            selectedItems: [],
            searchTerm: '',
            selectedSources: new Set(),
            page: 0,
        };
    }

    _primeSelection(initialItems) {
        if (!Array.isArray(initialItems) || initialItems.length === 0) return;

        const resolved = [];
        const ids = new Set();

        initialItems.forEach((candidate) => {
            const targetId = typeof candidate === 'string'
                ? candidate
                : this._getItemId(candidate);

            if (!targetId) return;

            const match = this.state.items.find((i) => this._getItemId(i) === targetId) || candidate;
            ids.add(targetId);
            resolved.push(match);
        });

        this.state.selectedIds = ids;
        this.state.selectedItems = resolved;
    }

    _getItemId(item) {
        return this.config.getItemId?.(item) || item?.id;
    }
}
