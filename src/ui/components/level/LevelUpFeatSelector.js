import { AppState } from '../../../app/AppState.js';
import { featService } from '../../../services/FeatService.js';
import { sourceService } from '../../../services/SourceService.js';
import { UniversalSelectionModal } from '../selection/UniversalSelectionModal.js';

/**
 * LevelUpFeatSelector
 * 
 * Feat-specific adapter for UniversalSelectionModal.
 * Used for selecting feats during level-up, ASI, or on the feats page.
 * 
 * Features:
 * - Search and filter feats by name
 * - Display feat source
 * - Support single or multi-select
 * - Prerequisite checking (level, ability, race, class, etc.)
 * - Uses generic LevelUpSelector for consistent UX
 */

export class LevelUpFeatSelector {
    constructor(session = null, parentStep = null) {
        this.session = session;
        this.parentStep = parentStep;

        // Service references
        this.featService = featService;

        // Generic selector instance
        this._selector = null;

        // Selection constraints
        this._baseMaxSelections = 1;
        this._ignoreSelectionLimit = false;
        this._ignorePrerequisites = false;

        // Promise resolver for awaiting selection
        this._resolveSelection = null;
    }

    /**
     * Initialize and display the feat selector modal
     * 
     * @param {Object|null} options - Configuration options (or legacy: currentSelection object)
     * @param {Array|Object|null} options.currentSelection - Currently selected feat(s)
     * @param {boolean} options.multiSelect - Allow multiple feat selection (default: false)
     * @param {number} options.maxSelections - Maximum number of feats to select (default: 1)
     * @param {Function} options.onConfirm - Callback for confirmation (optional, for feats page)
     * @param {boolean} options.showPrerequisiteNote - Show prerequisite filtering note (default: true for level-up, false for feats page)
     * 
     * Returns a Promise that resolves with:
     * - Single select: feat name or null if cancelled
     * - Multi select (feats page): array of feat objects
     */
    async show(options = {}) {
        // Support legacy calling convention: show(currentSelection) -> show({ currentSelection })
        if (options === null || (options && 'name' in options && !('currentSelection' in options))) {
            options = { currentSelection: options };
        }

        const {
            currentSelection = null,
            multiSelect = false,
            maxSelections = 1,
            onConfirm = null
        } = options;

        return new Promise((resolve, reject) => {
            try {
                this._resolveSelection = resolve;
                this._customOnConfirm = onConfirm;
                this._multiSelect = multiSelect;
                this._ignorePrerequisites = false;
                this._ignoreSelectionLimit = false;
                this._baseMaxSelections = maxSelections;

                const character = AppState.getCurrentCharacter();
                this._loadAndFilterFeats(character);

                // Build filters for feats page (only if multiSelect)
                const buildFilters = multiSelect ? (_ctx, panel, cleanup) => {
                    panel.innerHTML = `
                        <div class="card mb-3">
                            <div class="card-header" style="cursor: pointer;" data-bs-toggle="collapse"
                                data-bs-target="#collapsePrereqs" aria-expanded="true">
                                <h6 class="mb-0 d-flex align-items-center">
                                    <span>Prerequisites / Limits</span>
                                    <i class="fas fa-chevron-down ms-auto"></i>
                                </h6>
                            </div>
                            <div class="collapse show" id="collapsePrereqs">
                                <div class="card-body">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" value="Ignore Prerequisites"
                                            id="ignorePrereqs" data-filter-prereq="ignore-prerequisites">
                                        <label class="form-check-label" for="ignorePrereqs">Ignore Prerequisites</label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" value="Ignore Selection Limit"
                                            id="ignoreLimit" data-filter-prereq="ignore-limit">
                                        <label class="form-check-label" for="ignoreLimit">Ignore Selection Limit</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    // Attach prerequisite filter listeners
                    const ignorePrereqsCheckbox = panel.querySelector('[data-filter-prereq="ignore-prerequisites"]');
                    const ignoreLimitCheckbox = panel.querySelector('[data-filter-prereq="ignore-limit"]');

                    if (ignorePrereqsCheckbox) {
                        cleanup.on(ignorePrereqsCheckbox, 'change', () => {
                            this._ignorePrerequisites = ignorePrereqsCheckbox.checked;
                            this._loadAndFilterFeats(character);
                            // Trigger filter update
                            this._selector.state.items = this._filteredFeats;
                            this._selector._applyFiltersAndSearch();
                        });
                    }

                    if (ignoreLimitCheckbox) {
                        cleanup.on(ignoreLimitCheckbox, 'change', () => {
                            this._ignoreSelectionLimit = ignoreLimitCheckbox.checked;
                            // Update modal's max selections display if needed
                            this._selector.config.selectionLimit = this._getCurrentMaxSelections();
                        });
                    }
                } : null;

                this._selector = new UniversalSelectionModal({
                    modalId: `featSelectorModal_${Date.now()}`,
                    modalTitle: multiSelect ? 'Select Feats' : 'Select a Feat',
                    items: this._filteredFeats,
                    selectionMode: multiSelect ? 'multiple' : 'single',
                    selectionLimit: maxSelections,
                    initialSelectedItems: this._getInitialSelections(currentSelection),
                    searchMatcher: (item, searchTerm) => {
                        if (!searchTerm) return true;
                        const term = searchTerm.toLowerCase();
                        return item.name?.toLowerCase().includes(term);
                    },
                    buildFilters,
                    renderItem: (item, state) => this._renderFeatItem(item, state),
                    getItemId: (item) => item.id || item.name,
                    matchItem: (item, state) => {
                        // Already filtered in _filteredFeats, but match search here
                        if (state.searchTerm) {
                            const term = state.searchTerm.toLowerCase();
                            return item.name?.toLowerCase().includes(term);
                        }
                        return true;
                    },
                    onConfirm: this._onFeatConfirmed.bind(this),
                    onCancel: () => {
                        if (this._resolveSelection) {
                            this._resolveSelection(null);
                            this._resolveSelection = null;
                        }
                    }
                });

                this._selector.show();
            } catch (error) {
                console.error('[LevelUpFeatSelector]', 'Error showing feat selector:', error);
                reject(error);
            }
        });
    }

    _getInitialSelections(currentSelection) {
        if (!currentSelection) return [];
        if (Array.isArray(currentSelection)) {
            return currentSelection
                .map(sel => this._filteredFeats.find(f => f.id === sel.id || f.name === sel.name))
                .filter(Boolean);
        }
        const selected = this._filteredFeats.find(f => f.id === currentSelection.id || f.name === currentSelection.name);
        return selected ? [selected] : [];
    }

    _renderFeatItem(item, state) {
        const isSelected = state.selectedIds.has(item.id || item.name);
        const selectedClass = isSelected ? 'selected' : '';

        let badgesHtml = '';
        if (item.source) {
            badgesHtml += `<span class="badge bg-secondary me-2">${item.source}</span>`;
        }

        const description = item.entries?.[0] || 'No description available';

        return `
            <div class="spell-card selector-card ${selectedClass}" data-item-id="${item.id || item.name}">
                <div class="spell-card-header">
                    <div>
                        <strong>${item.name}</strong>
                    </div>
                    <div>${badgesHtml}</div>
                </div>
                <div class="spell-card-body">
                    <div class="spell-description">${description}</div>
                </div>
            </div>
        `;
    }

    /**
     * Load and filter feats based on sources and prerequisites
     */
    _loadAndFilterFeats(character) {
        const allFeats = this.featService.getAllFeats();

        this._filteredFeats = allFeats
            .filter(feat => sourceService.isSourceAllowed(feat.source))
            .filter(feat => this._ignorePrerequisites || this.featService.isFeatValidForCharacter(feat, character))
            .map((f, index) => ({
                ...f,
                id: f.id || `feat-${index}`
            }));
    }

    _getCurrentMaxSelections() {
        return this._ignoreSelectionLimit ? Infinity : this._baseMaxSelections;
    }

    /**
     * Handle feat selection confirmation
     */
    async _onFeatConfirmed(selectedFeats) {
        // If custom onConfirm provided (feats page), use it
        if (this._customOnConfirm) {
            await this._customOnConfirm(selectedFeats);
            if (this._resolveSelection) {
                this._resolveSelection(selectedFeats);
                this._resolveSelection = null;
            }
            return;
        }

        // Level-up flow: single select, return feat name
        if (selectedFeats.length > 0) {
            const selectedFeat = selectedFeats[0];
            const featName = selectedFeat.name || selectedFeat.id;

            // Update parent step (legacy behavior for compatibility)
            this.parentStep?.updateFeatSelection?.(featName);

            // Resolve the promise with the feat name
            if (this._resolveSelection) {
                this._resolveSelection(featName);
                this._resolveSelection = null;
            }
        } else {
            // No selection made
            if (this._resolveSelection) {
                this._resolveSelection(null);
                this._resolveSelection = null;
            }
        }
    }

    /**
     * Cancel selection and cleanup
     */
    cancel() {
        if (this._selector) {
            this._selector.cancel();
        }
    }
}
