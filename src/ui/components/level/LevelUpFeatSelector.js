import { featService } from '../../../services/FeatService.js';
import { sourceService } from '../../../services/SourceService.js';
import { LevelUpSelector } from './LevelUpSelector.js';

/**
 * LevelUpFeatSelector
 * 
 * Feat-specific adapter for generic LevelUpSelector.
 * Used for selecting feats during level-up, ASI, or other feat-granting moments.
 * 
 * Features:
 * - Search and filter feats by name
 * - Display feat source
 * - Enforce single-select for most cases
 * - Uses generic LevelUpSelector for consistent UX
 */

export class LevelUpFeatSelector {
    constructor(session, parentStep) {
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
     * Returns a Promise that resolves with the selected feat name or null if cancelled
     */
    async show(currentSelection = null) {
        return new Promise((resolve, reject) => {
            try {
                // Store resolver for later use
                this._resolveSelection = resolve;

                // Load all feats
                const allFeats = this.featService.getAllFeats();

                // Filter to only allowed sources
                const filtered = allFeats.filter(feat =>
                    sourceService.isSourceAllowed(feat.source)
                );

                // Create generic selector with feat-specific config
                this._selector = new LevelUpSelector({
                    items: filtered,
                    searchFields: ['name'],
                    filterSets: {},
                    multiSelect: false,
                    maxSelections: 1,
                    tabLevels: [],
                    onConfirm: this._onFeatConfirmed.bind(this),
                    modalTitle: 'Select a Feat',
                    context: {
                        currentSelection
                    }
                });

                // Pre-select current selection if provided
                if (currentSelection) {
                    const selected = filtered.find(f =>
                        (f.id === currentSelection.id || f.name === currentSelection.name)
                    );
                    if (selected) {
                        this._selector.selectedItems = [selected];
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
            } catch (error) {
                console.error('[LevelUpFeatSelector]', 'Error showing feat selector:', error);
                reject(error);
            }
        });
    }

    /**
     * Handle feat selection confirmation
     */
    async _onFeatConfirmed(selectedFeats) {
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
