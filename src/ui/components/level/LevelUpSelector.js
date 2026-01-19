import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { showNotification } from '../../../lib/Notifications.js';
import { formatPrerequisite } from '../../../lib/StatBlockRenderer.js';
import { textProcessor } from '../../../lib/TextProcessor.js';

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
        this.onConfirm = config.onConfirm || (() => { });
        this.modalTitle = config.modalTitle || 'Select Items';
        this.context = config.context || {};
        this.prerequisiteChecker = config.prerequisiteChecker || null; // Function(item) => boolean
        this.prerequisiteNote = config.prerequisiteNote || null; // Optional note explaining prerequisite filtering
        this.validationFn = config.validationFn || null; // Function(selectedIds) => { isValid: boolean, message?: string }
        this.customCountFn = config.customCountFn || null; // Function(selectedItems) => HTML string for custom count badges
        this.selectionLimitFn = config.selectionLimitFn || null; // Function(item, selectedItems) => boolean (true if can select)

        // Modal DOM elements
        this._modal = null;
        this._modalBS = null;
        this._cleanup = DOMCleanup.create();

        // Selection state
        this.selectedItems = config.initialSelections || [];
        this.filteredItems = [];

        // Filter state
        this.searchQuery = '';
        this.activeFilters = {}; // { school: Set(['abjuration']), type: Set(['spell']) }
        this.currentTab = this.tabLevels.length > 0 ? new Set() : null; // Set of selected tab values

        // Description cache for async processing
        this.descriptionCache = new Map();
        this._descriptionProcessingTimer = null;

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
        // Only show filters UI if there are actual filter controls (not just prerequisite checking)
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
                                <button class="btn spell-filter-toggle-btn" type="button"
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
                        
                        <!-- Prerequisite Note -->
                        ${this.prerequisiteNote ? `
                            <div class="alert alert-info mb-2">
                                <i class="fas fa-info-circle me-1"></i>
                                ${this.prerequisiteNote}
                            </div>
                        ` : ''}

                        <!-- Filters and Results Row (with animation) -->
                        <div class="spell-filter-row">
                            ${hasFilters ? `
                                <!-- Filters Panel (animated) -->
                                <div class="spell-filters-column" data-selector-filters-panel>
                                    ${this._getFiltersHTML()}
                                </div>
                            ` : ''}
                            
                            <!-- Results List (expands when filters hidden) -->
                            <div class="spell-results-column">
                                <div class="spell-list-scroll-container">
                                    <div class="spell-list-container" data-selector-list>
                                        <!-- Items rendered here -->
                                    </div>
                                </div>
                                
                                <!-- Selected Items Display -->
                                <div class="mt-3">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <h6 class="mb-0">Selected Items</h6>
                                        <div data-selector-count-container>
                                            ${this.customCountFn ? '<span data-selector-custom-count></span>' : `<span class="badge bg-info" data-selector-count>0 / ${this.maxSelections === Infinity ? '∞' : this.maxSelections}</span>`}
                                        </div>
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
     * Default item renderer with card-based layout (override via config)
     */
    _defaultItemRenderer(item) {
        const isSelected = this.selectedItems.some(s => this._itemKey(s) === this._itemKey(item));
        const selectedClass = isSelected ? 'selected' : '';
        const itemKey = this._itemKey(item);

        // Use cached description or placeholder
        const description = this.descriptionCache.has(itemKey)
            ? this.descriptionCache.get(itemKey)
            : '<span class="text-muted small">Loading description...</span>';

        // Build metadata sections if available
        let metadataHtml = '';
        if (item.source) {
            metadataHtml += `<span class="badge bg-secondary me-2">${item.source}</span>`;
        }
        if (item.prerequisite) {
            const prereqText = formatPrerequisite(item.prerequisite);
            if (prereqText) {
                metadataHtml += `<span class="badge bg-info me-2">Requires: ${prereqText}</span>`;
            }
        }
        if (item.level !== undefined) {
            const levelText = item.level === 0 ? 'Cantrip' : `Level ${item.level}`;
            metadataHtml += `<span class="badge bg-primary me-2">${levelText}</span>`;
        }

        return `
            <div class="spell-card selector-card ${selectedClass}" data-item-id="${itemKey}" data-selector-item-card>
                <div class="spell-card-header">
                    <div>
                        <strong>${item.name || item.id}</strong>
                    </div>
                    <div>${metadataHtml}</div>
                </div>
                <div class="spell-card-body">
                    <div class="spell-description selector-description">
                        ${description}
                    </div>
                </div>
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
        if (this.filteredItems.length === 0) {
            itemList.innerHTML = '<div class="alert alert-info">No items match your filters.</div>';
        } else {
            itemList.innerHTML = this.filteredItems
                .map(item => this.itemRenderer(item))
                .join('');

            // Attach card click listeners
            const cards = itemList.querySelectorAll('[data-selector-item-card]');
            cards.forEach(card => {
                this._cleanup.on(card, 'click', () => {
                    const itemId = card.dataset.itemId;
                    this._toggleItemSelection(itemId);
                });
            });
        }

        // Process descriptions in background
        this._processDescriptionsInBackground();

        // Update info
        this._updateSelectionInfo();
    }

    /**
     * Process item descriptions asynchronously in background
     */
    _processDescriptionsInBackground() {
        // Clear any existing timer
        if (this._descriptionProcessingTimer) {
            clearTimeout(this._descriptionProcessingTimer);
        }

        // Process items that don't have cached descriptions yet
        const itemsNeedingDesc = this.filteredItems.filter(
            (item) => !this.descriptionCache.has(this._itemKey(item))
        );

        if (itemsNeedingDesc.length === 0) return;

        // Process one at a time without blocking
        let index = 0;
        const processNext = async () => {
            if (index >= itemsNeedingDesc.length) return;

            const item = itemsNeedingDesc[index];
            index++;

            try {
                const itemKey = this._itemKey(item);
                if (!this.descriptionCache.has(itemKey)) {
                    let description = 'No description available';

                    // Check for entries array (like spells/features)
                    if (item.entries && Array.isArray(item.entries)) {
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
                    // Check for simple description field
                    else if (item.description && typeof item.description === 'string') {
                        description = await textProcessor.processString(item.description);
                    }

                    this.descriptionCache.set(itemKey, description);

                    // Update the DOM for this item if it's still visible
                    const card = this._modal?.querySelector(`[data-item-id="${itemKey}"] .selector-description`);
                    if (card) {
                        card.innerHTML = description;
                    }
                }
            } catch (error) {
                console.error('[LevelUpSelector]', 'Error processing description:', error);
            }

            // Process next item after a tiny delay to avoid blocking
            this._descriptionProcessingTimer = setTimeout(processNext, 0);
        };

        processNext();
    }

    /**
     * Update visual state indicator when at maximum selections
     */
    _updateMaxSelectionsVisualState() {
        const resultsList = this._modal?.querySelector('.spell-list-container');
        const countDisplay = this._modal?.querySelector('[data-selector-count]');

        if (this.selectedItems.length >= this.maxSelections && this.maxSelections !== Infinity) {
            // At max - show visual warning
            if (resultsList) {
                resultsList.classList.add('at-max-selections');
            }
            if (countDisplay) {
                countDisplay.classList.add('badge-warning');
                countDisplay.classList.remove('bg-info');
                countDisplay.classList.add('bg-warning');
            }
        } else {
            // Not at max - remove visual warning
            if (resultsList) {
                resultsList.classList.remove('at-max-selections');
            }
            if (countDisplay) {
                countDisplay.classList.remove('badge-warning');
                countDisplay.classList.remove('bg-warning');
                countDisplay.classList.add('bg-info');
            }
        }
    }

    /**
     * Toggle item selection
     */
    _toggleItemSelection(itemId) {
        // Check if already selected
        const selectedIndex = this.selectedItems.findIndex(s => this._itemKey(s) === itemId);
        if (selectedIndex >= 0) {
            // Deselect - always allowed
            this.selectedItems.splice(selectedIndex, 1);
            const card = this._modal?.querySelector(`[data-item-id="${itemId}"]`);
            if (card) {
                card.classList.remove('selected');
            }
            // Update visual state on deselect (might clear warning if now below max)
            this._updateMaxSelectionsVisualState();
        } else {
            // Select
            const item = this.filteredItems.find(i => this._itemKey(i) === itemId);
            if (!item) return;

            // Check custom selection limit function if provided
            if (this.selectionLimitFn && !this.selectionLimitFn(item, this.selectedItems)) {
                // Custom limit reached - notification already shown by function
                this._updateMaxSelectionsVisualState();
                return;
            }

            // Check selection limit
            if (this.selectedItems.length >= this.maxSelections) {
                const maxText = this.maxSelections === Infinity ? 'unlimited' : this.maxSelections;
                showNotification(`Maximum selections reached: ${maxText}`, 'warning');
                // Show visual warning even though we didn't select
                this._updateMaxSelectionsVisualState();
                return;
            }

            this.selectedItems.push(item);
            const card = this._modal?.querySelector(`[data-item-id="${itemId}"]`);
            if (card) {
                card.classList.add('selected');
            }
            // Update visual state on selection
            this._updateMaxSelectionsVisualState();
        }

        this._updateSelectionInfo();
    }

    /**
     * Check if item matches all active filters
     */
    _matchesAllFilters(item) {
        // Prerequisite check (if checker provided)
        if (this.prerequisiteChecker && !this.prerequisiteChecker(item)) {
            return false;
        }

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
            if (filterValue && filterValue.size > 0) {
                // Skip Prerequisites filter - handled externally by LevelUpFeatSelector
                if (filterKey === 'Prerequisites') {
                    continue;
                }
                
                // Special handling for school filter - check both abbreviated and full name
                if (filterKey === 'school') {
                    const schoolAbbreviations = {
                        'Abjuration': 'A', 'Conjuration': 'C', 'Divination': 'D',
                        'Enchantment': 'E', 'Evocation': 'V', 'Illusion': 'I',
                        'Necromancy': 'N', 'Transmutation': 'T'
                    };
                    // Check if any selected school matches (either abbreviated or full name)
                    let matchesSchool = false;
                    for (const selectedSchool of filterValue) {
                        const abbrev = schoolAbbreviations[selectedSchool];
                        if (item[filterKey] === selectedSchool || item[filterKey] === abbrev) {
                            matchesSchool = true;
                            break;
                        }
                    }
                    if (!matchesSchool) return false;
                } else {
                    // Standard filter matching
                    if (!filterValue.has(item[filterKey])) {
                        return false;
                    }
                }
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
                if (isVisible) {
                    // Hide filters with animation
                    filtersPanel.classList.add('collapsed');
                    filterToggle.dataset.filtersVisible = 'false';
                } else {
                    // Show filters with animation
                    filtersPanel.classList.remove('collapsed');
                    filterToggle.dataset.filtersVisible = 'true';
                }
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

        // Cancel buttons (header close and footer cancel)
        const cancelBtns = this._modal.querySelectorAll('[data-selector-cancel]');
        cancelBtns.forEach(btn => {
            this._cleanup.on(btn, 'click', () => {
                this.cancel();
            });
        });

        // Confirm button
        const confirmBtn = this._modal.querySelector('[data-selector-confirm]');
        if (confirmBtn) {
            this._cleanup.on(confirmBtn, 'click', async () => {
                await this.confirm();
            });
        }
    }

    /**
     * Update selectedItems (now handled by _toggleItemSelection)
     */
    _updateSelectedItems() {
        // This method is now largely replaced by _toggleItemSelection
        // but kept for compatibility
        this._updateSelectionInfo();
    }

    /**
     * Update selection counter and display
     */
    _updateSelectionInfo() {
        // Use custom count display if provided
        if (this.customCountFn) {
            const customCountDisplay = this._modal.querySelector('[data-selector-custom-count]');
            if (customCountDisplay) {
                customCountDisplay.innerHTML = this.customCountFn(this.selectedItems);
            }
        } else {
            const countDisplay = this._modal.querySelector('[data-selector-count]');
            if (countDisplay) {
                countDisplay.textContent = `${this.selectedItems.length} / ${this.maxSelections === Infinity ? '∞' : this.maxSelections}`;
            }
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
                            // Toggle the item selection (works for both card and checkbox modes)
                            this._toggleItemSelection(this._itemKey(item));
                        });
                    }
                });
            }
        }

        // Update visual state based on max selections
        this._updateMaxSelectionsVisualState();
    }

    /**
     * Validate selections before confirming
     */
    _validateSelections() {
        // Use custom validation if provided
        if (this.validationFn) {
            const selectedIds = this.selectedItems.map(item => item.id || item.name);
            return this.validationFn(selectedIds, this.selectedItems);
        }

        // Default validation: check max selections
        if (this.selectedItems.length > this.maxSelections) {
            console.warn('[LevelUpSelector]', `Too many items selected: ${this.selectedItems.length} > ${this.maxSelections}`);
            return { isValid: false, message: `You have selected too many items. Maximum allowed: ${this.maxSelections}` };
        }

        return { isValid: true };
    }

    /**
     * Confirm selections and call onConfirm handler
     */
    async confirm() {
        const validationResult = this._validateSelections();
        if (!validationResult.isValid) {
            alert(validationResult.message || 'Invalid selection');
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
        // Clear description processing timer
        if (this._descriptionProcessingTimer) {
            clearTimeout(this._descriptionProcessingTimer);
            this._descriptionProcessingTimer = null;
        }

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
