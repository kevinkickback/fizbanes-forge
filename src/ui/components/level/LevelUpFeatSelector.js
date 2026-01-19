import { AppState } from '../../../app/AppState.js';
import { featService } from '../../../services/FeatService.js';
import { sourceService } from '../../../services/SourceService.js';
import { LevelUpSelector } from './LevelUpSelector.js';

/**
 * LevelUpFeatSelector
 * 
 * Feat-specific adapter for generic LevelUpSelector.
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
        // If options is null or has a 'name' property (feat object), treat it as currentSelection
        if (options === null || (options && 'name' in options && !('currentSelection' in options))) {
            options = { currentSelection: options };
        }

        const {
            currentSelection = null,
            multiSelect = false,
            maxSelections = 1,
            onConfirm = null,
            showPrerequisiteNote = !multiSelect // Show note for level-up, hide for feats page
        } = options;

        return new Promise((resolve, reject) => {
            try {
                // Store resolver for later use
                this._resolveSelection = resolve;
                this._customOnConfirm = onConfirm;
                this._multiSelect = multiSelect;
                this._ignorePrerequisites = false; // Start with prerequisites enforced

                // Get character for prerequisite checking
                const character = AppState.getCurrentCharacter();

                // Load and filter feats
                this._loadAndFilterFeats(character);

                // Build filter sets for feats page (only if multiSelect)
                const filterSets = {};
                if (multiSelect) {
                    // Add ignore prerequisites as a special filter
                    filterSets.Prerequisites = ['Ignore Prerequisites'];
                }

                // Create generic selector with feat-specific config
                this._selector = new LevelUpSelector({
                    items: this._filteredFeats,
                    searchFields: ['name'],
                    filterSets,
                    multiSelect,
                    maxSelections,
                    tabLevels: [],
                    onConfirm: this._onFeatConfirmed.bind(this),
                    modalTitle: multiSelect ? 'Select Feats' : 'Select a Feat',
                    prerequisiteNote: showPrerequisiteNote ? 'Only feats you qualify for are shown.' : null,
                    context: {
                        currentSelection,
                        character
                    }
                });

                // Pre-select current selection if provided
                if (currentSelection) {
                    if (Array.isArray(currentSelection)) {
                        // Multi-select: array of feats
                        const selected = currentSelection
                            .map(sel => this._filteredFeats.find(f =>
                                f.id === sel.id || f.name === sel.name
                            ))
                            .filter(Boolean);
                        this._selector.selectedItems = selected;
                    } else {
                        // Single select: one feat
                        const selected = this._filteredFeats.find(f =>
                            (f.id === currentSelection.id || f.name === currentSelection.name)
                        );
                        if (selected) {
                            this._selector.selectedItems = [selected];
                        }
                    }
                }

                // Hook into modal close to handle cancellation
                const modalEl = document.getElementById('levelUpSelectorModal');
                if (modalEl) {
                    const handleHidden = () => {
                        // If promise not yet resolved, user cancelled
                        if (this._resolveSelection) {
                            this._resolveSelection(null);
                            this._resolveSelection = null;
                        }
                        modalEl.removeEventListener('hidden.bs.modal', handleHidden);
                    };
                    modalEl.addEventListener('hidden.bs.modal', handleHidden);
                }

                // Show modal
                this._selector.show();

                // Hook into the Prerequisites filter checkbox for feats page
                if (multiSelect) {
                    setTimeout(() => {
                        const modalEl = document.getElementById('levelUpSelectorModal');
                        const ignoreCheckbox = modalEl?.querySelector('[data-selector-filter="Prerequisites"][value="Ignore Prerequisites"]');
                        
                        if (ignoreCheckbox) {
                            ignoreCheckbox.addEventListener('change', () => {
                                this._ignorePrerequisites = ignoreCheckbox.checked;
                                this._loadAndFilterFeats(character);
                                this._selector.items = this._filteredFeats;
                                
                                // Preserve currently selected items if they exist in new filtered list
                                const currentSelections = this._selector.selectedItems;
                                this._selector.selectedItems = currentSelections.filter(selected => 
                                    this._filteredFeats.some(f => f.id === selected.id || f.name === selected.name)
                                );
                                
                                this._selector._renderItems();
                            });
                        }
                    }, 100);
                }
            } catch (error) {
                console.error('[LevelUpFeatSelector]', 'Error showing feat selector:', error);
                reject(error);
            }
        });
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
