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
    constructor(session, parentStep, className, featureType, requirementLevel, currentFeatureId = null) {
        this.session = session;
        this.parentStep = parentStep;
        this.className = className;
        this.featureType = featureType;  // e.g., 'EI' (Eldritch Invocations), 'MM' (Metamagic)
        this.requirementLevel = requirementLevel;
        this.currentFeatureId = currentFeatureId;  // The feature choice being edited

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
            console.log('[LevelUpFeatureSelector] Starting show', {
                className: this.className,
                featureType: this.featureType,
                currentFeatureId: this.currentFeatureId,
                availableCount: availableFeatures.length,
                currentSelectionsCount: currentSelections.length
            });

            // Collect already-selected features from character and session
            const alreadySelected = new Set();

            // 1. Features from original character's progression
            // Store features that match this class and could be of the same type
            if (this.session.originalCharacter?.progression?.classes) {
                this.session.originalCharacter.progression.classes.forEach(cls => {
                    if (cls.name === this.className && cls.features) {
                        cls.features.forEach(feature => {
                            if (feature && typeof feature === 'object') {
                                // Feature might be stored as { name, id, type, ... }
                                const featureName = feature.name || feature.id || feature;
                                if (featureName && typeof featureName === 'string') {
                                    alreadySelected.add(featureName);
                                    console.log('[LevelUpFeatureSelector] Added from character progression:', featureName);
                                }
                            } else if (typeof feature === 'string') {
                                alreadySelected.add(feature);
                                console.log('[LevelUpFeatureSelector] Added from character progression (string):', feature);
                            }
                        });
                    }
                });
            }

            // 2. Features from current session's selections (from other levels/feature choices)
            // We need to check all selected features but exclude the current feature choice being edited
            if (this.session.stepData?.selectedFeatures) {
                console.log('[LevelUpFeatureSelector] Session selectedFeatures:', this.session.stepData.selectedFeatures);

                // Iterate through all feature selections in the session
                Object.entries(this.session.stepData.selectedFeatures).forEach(([featureId, selection]) => {
                    console.log('[LevelUpFeatureSelector] Checking featureId:', featureId, 'current:', this.currentFeatureId, 'match:', featureId === this.currentFeatureId);

                    // Skip the feature choice currently being edited
                    if (featureId === this.currentFeatureId) {
                        console.log('[LevelUpFeatureSelector] Skipping current feature ID');
                        return;
                    }

                    // Parse selections (can be array or single value)
                    const selections = Array.isArray(selection) ? selection : [selection];

                    selections.forEach(featureName => {
                        if (featureName && typeof featureName === 'string') {
                            alreadySelected.add(featureName);
                            console.log('[LevelUpFeatureSelector] Added from session:', featureName, 'from featureId:', featureId);
                        }
                    });
                });
            }

            console.log('[LevelUpFeatureSelector] Already selected features:', Array.from(alreadySelected));

            console.log('[LevelUpFeatureSelector] Already selected features:', Array.from(alreadySelected));

            // Filter to only allowed sources AND exclude already-selected features
            const filtered = availableFeatures.filter(feature => {
                if (!sourceService.isSourceAllowed(feature.source)) {
                    return false;
                }

                // Check if this feature is already selected elsewhere
                const featureId = feature.id || feature.name;
                const featureName = feature.name;

                // Check both ID and name formats
                if (alreadySelected.has(featureId) || alreadySelected.has(featureName)) {
                    console.log('[LevelUpFeatureSelector] Filtering out:', featureName, 'id:', featureId);
                    return false;
                }

                return true;
            });

            // Determine max selections
            if (maxSelections !== null) {
                this.maxSelections = maxSelections;
            } else {
                this.maxSelections = multiSelect ? filtered.length : 1;
            }

            // Get character from session for prerequisite checking
            const character = this.session.stagedChanges;

            // Create prerequisite checker function that includes staged spell selections
            const prerequisiteChecker = (feature) => {
                if (!feature.prerequisite) return true;

                // Gather all staged spell selections for this class across all levels
                const stagedSpells = [];
                if (this.session.stepData?.selectedSpells) {
                    Object.keys(this.session.stepData.selectedSpells).forEach(key => {
                        // Key format is "ClassName_Level"
                        if (key.startsWith(`${this.className}_`)) {
                            const spells = this.session.stepData.selectedSpells[key] || [];
                            // Each spell can be a string (name) or object with name property
                            spells.forEach(spell => {
                                const spellName = typeof spell === 'string' ? spell : spell.name;
                                if (spellName) {
                                    stagedSpells.push({ name: spellName });
                                }
                            });
                        }
                    });
                }

                // Merge character data with session spell selections for prerequisite checking
                const characterWithStagedSpells = {
                    ...character,
                    // Include spell selections from step data if available
                    spellcasting: {
                        ...character.spellcasting,
                        classes: {
                            ...character.spellcasting?.classes,
                            [this.className]: {
                                ...character.spellcasting?.classes?.[this.className],
                                // Merge existing spells with staged selections
                                cantrips: [
                                    ...(character.spellcasting?.classes?.[this.className]?.cantrips || []),
                                    ...stagedSpells
                                ],
                                spellsKnown: [
                                    ...(character.spellcasting?.classes?.[this.className]?.spellsKnown || []),
                                    ...stagedSpells
                                ]
                            }
                        }
                    }
                };

                return this.optionalFeatureService.meetsPrerequisites(feature, characterWithStagedSpells, this.className);
            };

            // Get appropriate note based on feature type
            const prerequisiteNote = this._getPrerequisiteNote();

            // Create generic selector with feature-specific config
            this._selector = new LevelUpSelector({
                items: filtered,
                searchFields: ['name', 'source'],
                filterSets: {},
                multiSelect,
                maxSelections: this.maxSelections,
                tabLevels: [],
                onConfirm: this._onFeaturesConfirmed.bind(this),
                modalTitle: `Select ${this._getFeatureTypeName()} - ${this.className}`,
                prerequisiteChecker,
                prerequisiteNote,
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
     * Get prerequisite note for this feature type
     */
    _getPrerequisiteNote() {
        const notes = {
            'invocation': 'Some invocations require you to learn specific spells, pacts, or be high enough level before they unlock.',
            'EI': 'Some invocations require you to learn specific spells, pacts, or be high enough level before they unlock.',
            'MM': 'Only metamagic options you qualify for are shown.',
            'MV:B': 'Only battle maneuvers you qualify for are shown.',
            'MV:M': 'Only monk maneuvers you qualify for are shown.',
            'FS': 'Only fighting styles you qualify for are shown.',
            'AI': 'Only infusions you qualify for are shown. Some require minimum character levels to unlock.'
        };
        return notes[this.featureType] || null; // Return null if no specific note needed
    }

    /**
     * Generate unique key for feature
     */
    _featureKey(feature) {
        return feature.id || feature.name;
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
