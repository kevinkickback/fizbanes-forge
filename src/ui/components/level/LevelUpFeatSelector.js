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
    }

    /**
     * Initialize and display the feat selector modal
     */
    async show(currentSelection = null) {
        try {
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
                itemRenderer: this._renderFeatItem.bind(this),
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

            // Show modal
            await this._selector.show();
        } catch (error) {
            console.error('[LevelUpFeatSelector]', 'Error showing feat selector:', error);
        }
    }

    /**
     * Render a single feat item for the generic selector
     */
    _renderFeatItem(feat) {
        return `
            <div class="form-check selector-item-check mb-2">
                <input 
                    class="form-check-input" 
                    type="radio" 
                    id="feat_${feat.id}"
                    value="${feat.id}"
                    data-selector-item
                    name="selector_item_single"
                >
                <label class="form-check-label w-100" for="feat_${feat.id}">
                    <strong>${feat.name}</strong>
                    <div class="small text-muted">${feat.source || ''}</div>
                </label>
            </div>
        `;
    }

    /**
     * Handle feat selection confirmation
     */
    async _onFeatConfirmed(selectedFeats) {
        if (selectedFeats.length > 0) {
            const selectedFeat = selectedFeats[0];
            // Update parent step
            this.parentStep?.updateFeatSelection?.(selectedFeat.name || selectedFeat.id);
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
