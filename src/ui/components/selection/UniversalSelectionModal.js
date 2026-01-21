import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { showNotification } from '../../../lib/Notifications.js';

// Shared helper functions for formatting category counters
export function formatCategoryCounters(categories) {
    /**
     * Format multiple category counters into HTML badges
     * Usage: formatCategoryCounters([
     *   { label: 'Cantrips', selected: 2, max: 2, color: 'bg-info' },
     *   { label: '1st Spells', selected: 1, max: 2, color: 'bg-success' }
     * ])
     * Returns: HTML string with separate badge elements
     */
    if (!Array.isArray(categories) || categories.length === 0) {
        return '<span class="badge bg-secondary">0 / ∞</span>';
    }

    return categories
        .map(cat => {
            const color = cat.color || 'bg-secondary';
            return `<span class="badge ${color}">${cat.selected}/${cat.max} ${cat.label}</span>`;
        })
        .join(' ');
}

export function formatCounter(category) {
    /**
     * Format a single category counter
     * Usage: formatCounter({ label: 'Items', selected: 2, max: 5 })
     * Returns: HTML string for a badge
     */
    const color = category.color || 'bg-info';
    return `<span class="badge ${color}">${category.selected}/${category.max} ${category.label}</span>`;
}

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
            // Optional per-item selection control
            canSelectItem: null, // (item, state) => boolean
            onSelectBlocked: null, // (item, state) => void
            // Optional info text to display under search bar
            prerequisiteNote: null,
            onError: null,
            // Description cache support
            descriptionCache: null,
            fetchDescription: null,
            descriptionContainerSelector: null,
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
                            ${this.config.buildFilters ? `<button class="btn btn-outline-secondary spell-filter-toggle-btn" type="button"
                                title="Toggle filters panel" data-filters-visible="true">
                                <i class="fas fa-filter"></i>
                            </button>` : ''}
                            <input type="text" class="form-control spell-search-input flex-grow-1"
                                placeholder="Search...">
                            <button class="btn btn-outline-secondary" type="button" data-search-clear
                                title="Clear search">
                                <i class="fas fa-times"></i> Clear
                            </button>
                        </div>
                        
                        <!-- Optional prerequisite/info note -->
                        ${this.config.prerequisiteNote ? `<div class="alert alert-info small mb-2">
                            ${this.config.prerequisiteNote}
                        </div>` : ''}
                        
                        <!-- Filters and Results (spell-filter-row layout) -->
                        <div class="spell-filter-row" ${this.config.buildFilters ? '' : 'style="grid-template-columns: 1fr;"'}>
                            <!-- Filters Panel (only shown if buildFilters provided) -->
                            ${this.config.buildFilters ? `<div class="spell-filters-column">
                                <!-- Filters populated by buildFilters callback -->
                            </div>` : ''}
                            
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
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <h6 class="mb-0">Selected</h6>
                                        <div class="selection-count d-flex flex-wrap gap-2" data-selection-count>
                                            <span class="badge bg-info">0 / ∞</span>
                                        </div>
                                    </div>
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
            console.debug('[UniversalSelectionModal]', 'Loaded items:', this.state.items.length, 'items');
            if (this.state.items.length === 0) {
                console.warn('[UniversalSelectionModal]', 'WARNING: No items loaded!');
            }

            // Prime initial selections if provided
            const initialSelection = this.config.getInitialSelection
                ? this.config.getInitialSelection(ctx) || []
                : this.config.initialSelectedItems || [];
            this._primeSelection(initialSelection);

            // Reset list containers before render
            this._renderList();
            this._renderSelected();
            this._updateConfirmButton(); // Update counter and button state

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

    async _reloadItems() {
        const ctx = this.config.getContext ? this.config.getContext() : {};
        this.state.items = await (this.config.loadItems?.(ctx) || []);
        this.state.page = 0;
        this._renderList();
    }

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
            const item = this.state.items.find((i) => this._getItemId(i) === itemId);
            if (!item) return;

            // If item is not currently selected, enforce per-item selection rules
            const alreadySelected = this.state.selectedIds.has(itemId);
            if (!alreadySelected && this.config.canSelectItem) {
                try {
                    const allowed = !!this.config.canSelectItem(item, this.state);
                    if (!allowed) {
                        if (typeof this.config.onSelectBlocked === 'function') {
                            this.config.onSelectBlocked(item, this.state);
                        } else {
                            showNotification('Selection limit reached for this category.', 'warning');
                        }
                        return; // do not toggle selection
                    }
                } catch (_err) {
                    // Fail-safe: allow selection if callback throws
                }
            }

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

            // Apply blocked/disabled visual if per-item selection says false
            const item = this.state.items.find((i) => this._getItemId(i) === id);
            let blocked = false;
            if (item && this.config.canSelectItem) {
                try {
                    // Only block if item is not already selected and cannot be selected
                    const isSelected = this.state.selectedIds.has(id);
                    blocked = !isSelected && !this.config.canSelectItem(item, this.state);
                } catch (_err) {
                    blocked = false;
                }
            }
            el.classList.toggle('blocked', blocked);
            if (blocked) {
                el.style.opacity = '0.6';
            } else {
                el.style.opacity = '';
            }
        });

        if (typeof this.config.onListRendered === 'function') {
            this.config.onListRendered(this.state);
        }

        // Process descriptions asynchronously
        this._processDescriptions(pageItems);

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

    _updateConfirmButton() {
        const confirmBtn = this.modal?.querySelector(this.config.confirmSelector);
        if (!confirmBtn) return;

        confirmBtn.disabled = this.state.selectedIds.size === 0;

        // Update selection counter if it exists
        const countContainer = this.modal?.querySelector('[data-selection-count]');
        if (countContainer) {
            // Use custom count function if provided
            if (typeof this.config.customCountFn === 'function') {
                countContainer.innerHTML = this.config.customCountFn(this.state.selectedItems);
            } else {
                const limit = this.config.selectionLimit === null || this.config.selectionLimit === Infinity
                    ? '∞'
                    : this.config.selectionLimit;
                countContainer.innerHTML = `<span class="badge bg-info">${this.state.selectedIds.size} / ${limit}</span>`;
            }
        }
    }

    _processDescriptions(pageItems) {
        const hasSupport = this.config.fetchDescription && this.config.descriptionCache && this.config.descriptionContainerSelector;
        if (!hasSupport || !Array.isArray(pageItems) || pageItems.length === 0) return;

        const cache = this.config.descriptionCache;
        const list = this.modal?.querySelector(this.config.listContainerSelector);
        if (!list) return;

        const processNext = (index) => {
            if (index >= pageItems.length) return;
            const item = pageItems[index];
            const id = this._getItemId(item);
            if (!id) {
                setTimeout(() => processNext(index + 1), 0);
                return;
            }

            if (cache.has(id)) {
                const slot = list.querySelector(`[${this.config.itemIdAttribute}="${id}"] ${this.config.descriptionContainerSelector}`);
                if (slot) slot.innerHTML = cache.get(id);
                setTimeout(() => processNext(index + 1), 0);
                return;
            }

            Promise.resolve(this.config.fetchDescription(item))
                .then((desc) => {
                    const html = desc || '<span class="text-muted small">No description available.</span>';
                    cache.set(id, html);
                    const slot = list.querySelector(`[${this.config.itemIdAttribute}="${id}"] ${this.config.descriptionContainerSelector}`);
                    if (slot) slot.innerHTML = html;
                })
                .catch(() => { /* ignore */ })
                .finally(() => {
                    setTimeout(() => processNext(index + 1), 0);
                });
        };

        processNext(0);
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
                // Enforce global selection limit
                if (this.config.selectionLimit && this.state.selectedIds.size >= this.config.selectionLimit) {
                    showNotification(`You can only select ${this.config.selectionLimit} item(s).`, 'warning');
                    return;
                }
                // Enforce per-item/category rules if provided
                if (this.config.canSelectItem) {
                    try {
                        const allowed = !!this.config.canSelectItem(item, this.state);
                        if (!allowed) {
                            if (typeof this.config.onSelectBlocked === 'function') {
                                this.config.onSelectBlocked(item, this.state);
                            } else {
                                showNotification('Selection limit reached for this category.', 'warning');
                            }
                            return;
                        }
                    } catch (_err) {
                        // ignore errors, allow selection
                    }
                }
                this.state.selectedIds.add(itemId);
                this.state.selectedItems.push(item);
            }
        }

        if (typeof this.config.onSelectionChange === 'function') {
            this.config.onSelectionChange({ ...this.state });
        }

        this._updateConfirmButton();
        this._renderSelected();

        // Update UI selection classes in the list
        const list = this.modal?.querySelector(this.config.listContainerSelector);
        if (list) {
            list.querySelectorAll(`[${this.config.itemIdAttribute}]`).forEach((el) => {
                const id = el.getAttribute(this.config.itemIdAttribute);
                el.classList.toggle('selected', this.state.selectedIds.has(id));
                const it = this.state.items.find((i) => this._getItemId(i) === id);
                let blocked = false;
                if (it && this.config.canSelectItem) {
                    try {
                        const isSelected = this.state.selectedIds.has(id);
                        blocked = !isSelected && !this.config.canSelectItem(it, this.state);
                    } catch (_err) {
                        blocked = false;
                    }
                }
                el.classList.toggle('blocked', blocked);
                el.style.opacity = blocked ? '0.6' : '';
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
