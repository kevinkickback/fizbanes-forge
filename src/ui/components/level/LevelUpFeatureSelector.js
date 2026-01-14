import { optionalFeatureService } from '../../../services/OptionalFeatureService.js';
import { sourceService } from '../../../services/SourceService.js';
import { LevelUpSelector } from './LevelUpSelector.js';

/**
 * LevelUpFeatureSelector
 * 
 * Feature-specific adapter for generic LevelUpSelector.
 * Used for selecting class features like Eldritch Invocations, Metamagic, Maneuvers, etc.
 * 
 * Features:
 * - Search and filter optional features by name, type
 * - Enforce selection limits based on feature availability
 * - Display feature descriptions
 * - Uses generic LevelUpSelector for consistent UX
 */

export class LevelUpFeatureSelector {
    constructor(session, parentStep, className, featureType, requirementLevel) {
        this.session = session;
        this.parentStep = parentStep;
        this.className = className;
        this.featureType = featureType;  // e.g., 'EI' (Eldritch Invocations), 'MM' (Metamagic)
        this.requirementLevel = requirementLevel;

        // Service references
        this.optionalFeatureService = optionalFeatureService;

        // Selection limits
        this.maxSelections = 1;

        // Generic selector instance
        this._selector = null;
    }

    /**
     * Initialize and display the feature selector modal
     */
    async show(availableFeatures, currentSelections = [], multiSelect = false, maxSelections = null) {
        try {
            // Filter to only allowed sources
            const filtered = availableFeatures.filter(feature =>
                sourceService.isSourceAllowed(feature.source)
            );

            // Determine max selections
            if (maxSelections !== null) {
                this.maxSelections = maxSelections;
            } else {
                this.maxSelections = multiSelect ? filtered.length : 1;
            }

            // Create generic selector with feature-specific config
            this._selector = new LevelUpSelector({
                items: filtered,
                searchFields: ['name', 'source'],
                filterSets: {},
                multiSelect,
                maxSelections: this.maxSelections,
                tabLevels: [],
                itemRenderer: this._renderFeatureItem.bind(this),
                onConfirm: this._onFeaturesConfirmed.bind(this),
                modalTitle: `Select ${this._getFeatureTypeName()} - ${this.className}`,
                context: {
                    className: this.className,
                    featureType: this.featureType,
                    currentSelections
                }
            });

            // Pre-select current selections
            if (currentSelections.length > 0) {
                this._selector.selectedItems = filtered.filter(f =>
                    currentSelections.some(sel => this._featureKey(f) === this._featureKey(sel))
                );
            }

            // Show modal
            await this._selector.show();
        } catch (error) {
            console.error('[LevelUpFeatureSelector]', 'Error showing feature selector:', error);
        }
    }

    /**
     * Get feature type display name
     */
    _getFeatureTypeName() {
        const typeNames = {
            'EI': 'Eldritch Invocation',
            'MM': 'Metamagic',
            'MV:B': 'Battle Maneuver',
            'MV:M': 'Monk Maneuver',
            'FS': 'Fighting Style',
            'PB': 'Pact Boon',
            'AI': 'Artificer Infusion'
        };
        return typeNames[this.featureType] || 'Feature';
    }

    /**
     * Generate unique key for feature
     */
    _featureKey(feature) {
        return feature.id || feature.name;
    }

    /**
     * Render a single feature item for the generic selector
     */
    _renderFeatureItem(feature) {
        const inputName = this._selector.multiSelect ? 'selector_item' : 'selector_item_single';
        const inputType = this._selector.multiSelect ? 'checkbox' : 'radio';

        return `
            <div class="form-check selector-item-check mb-2">
                <input 
                    class="form-check-input" 
                    type="${inputType}" 
                    id="feature_${this._featureKey(feature)}"
                    value="${this._featureKey(feature)}"
                    data-selector-item
                    name="${inputName}"
                >
                <label class="form-check-label w-100" for="feature_${this._featureKey(feature)}">
                    <strong>${feature.name}</strong>
                    <div class="small text-muted">
                        ${feature.source || ''}
                        ${feature.prerequisite ? ` • Requires: ${feature.prerequisite}` : ''}
                    </div>
                </label>
            </div>
        `;
    }

    /**
     * Handle feature selection confirmation
     */
    async _onFeaturesConfirmed(selectedFeatures) {
        // Update parent step
        this.parentStep?.updateFeatureSelection?.(
            this.className,
            this.featureType,
            this.requirementLevel,
            selectedFeatures.map(f => f.name || f.id)
        );
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
