import { showNotification } from '../../../lib/Notifications.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { optionalFeatureService } from '../../../services/OptionalFeatureService.js';
import { sourceService } from '../../../services/SourceService.js';
import {
	UniversalSelectionModal,
	formatCounter,
} from '../selection/UniversalSelectionModal.js';

// Feature selector adapter for class features (Invocations, Metamagic, Maneuvers, etc.)

export class ClassFeatureSelector {
	constructor(
		session,
		parentStep,
		className,
		featureType,
		requirementLevel,
		currentFeatureId = null,
	) {
		this.session = session;
		this.parentStep = parentStep;
		this.className = className;
		this.featureType = featureType; // e.g., 'EI' (Eldritch Invocations), 'MM' (Metamagic)
		this.requirementLevel = requirementLevel;
		this.currentFeatureId = currentFeatureId; // The feature choice being edited

		// Service references
		this.optionalFeatureService = optionalFeatureService;

		// Selection limits
		this.maxSelections = 1;

		// Generic selector instance
		this._selector = null;

		// Description cache for feature cards
		this._descriptionCache = new Map();
	}

	/**
	 * Initialize and display the feature selector modal
	 */
	async show(
		availableFeatures,
		currentSelections = [],
		multiSelect = false,
		maxSelections = null,
	) {
		try {
			console.debug('LevelUpFeatureSelector Starting show', {
				className: this.className,
				featureType: this.featureType,
				currentFeatureId: this.currentFeatureId,
				availableCount: availableFeatures.length,
				currentSelectionsCount: currentSelections.length,
			});

			// Collect already-selected features
			const alreadySelected = new Set();

			if (this.session.originalCharacter?.progression?.classes) {
				this.session.originalCharacter.progression.classes.forEach((cls) => {
					if (cls.name === this.className && cls.features) {
						cls.features.forEach((feature) => {
							if (feature && typeof feature === 'object') {
								const featureName = feature.name || feature.id || feature;
								if (featureName && typeof featureName === 'string') {
									alreadySelected.add(featureName);
								}
							} else if (typeof feature === 'string') {
								alreadySelected.add(feature);
							}
						});
					}
				});
			}

			if (this.session.stepData?.selectedFeatures) {
				Object.entries(this.session.stepData.selectedFeatures).forEach(
					([featureId, selection]) => {
						if (featureId === this.currentFeatureId) return;

						const selections = Array.isArray(selection)
							? selection
							: [selection];
						selections.forEach((featureName) => {
							if (featureName && typeof featureName === 'string') {
								alreadySelected.add(featureName);
							}
						});
					},
				);
			}

			// Filter available features
			const filtered = availableFeatures.filter((feature) => {
				if (!sourceService.isSourceAllowed(feature.source)) {
					return false;
				}

				const featureId = feature.id || feature.name;
				const featureName = feature.name;
				if (
					alreadySelected.has(featureId) ||
					alreadySelected.has(featureName)
				) {
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

			const character = this.session.stagedChanges;
			const prerequisiteChecker = (feature) => {
				if (!feature.prerequisite) return true;
				const featuresArray = [];
				if (character.progression?.classes) {
					for (const cls of character.progression.classes) {
						if (cls.features && Array.isArray(cls.features)) {
							featuresArray.push(...cls.features);
						}
					}
				}
				const originalFeatures = character.features;
				character.features = featuresArray;
				const result = this.optionalFeatureService.meetsPrerequisites(
					feature,
					character,
					this.className,
				);
				character.features = originalFeatures;
				return result;
			};

			this._selector = new UniversalSelectionModal({
				modalId: `featureSelectorModal_${Date.now()}`,
				modalTitle: `Select ${this._getFeatureTypeName()} - ${this.className}`,
				loadItems: () => filtered,
				selectionMode: multiSelect ? 'multiple' : 'single',
				selectionLimit: this.maxSelections,
				initialSelectedItems: filtered.filter((f) =>
					currentSelections.some(
						(sel) => this._featureKey(f) === this._featureKey(sel),
					),
				),
				searchMatcher: (item, searchTerm) => {
					if (!searchTerm) return true;
					const term = searchTerm.toLowerCase();
					return (
						item.name?.toLowerCase().includes(term) ||
						item.source?.toLowerCase().includes(term)
					);
				},
				buildFilters: null,
				prerequisiteNote: this._getPrerequisiteNote(),
				renderItem: (item, state) => this._renderFeatureItem(item, state),
				getItemId: (item) => item.id || item.name,
				matchItem: (item, state) => {
					if (!prerequisiteChecker(item)) return false;
					if (state.searchTerm) {
						const term = state.searchTerm.toLowerCase();
						return (
							item.name?.toLowerCase().includes(term) ||
							item.source?.toLowerCase().includes(term)
						);
					}
					return true;
				},
				// Block selection when reaching maxSelections
				canSelectItem: (_item, state) => {
					const isAtCap =
						this.maxSelections !== null &&
						state.selectedIds.size >= this.maxSelections;
					// Always allow deselection; only block new selections at cap
					return !isAtCap;
				},
				onSelectBlocked: () => {
					const label = this._getFeatureTypeName();
					showNotification(
						`${label} selection limit reached. Deselect a choice to add another.`,
						'warning',
					);
				},
				// Description caching and rendering
				descriptionCache: this._descriptionCache,
				fetchDescription: (feature) => this._fetchFeatureDescription(feature),
				descriptionContainerSelector: '.feature-description',
				// Counter rendering
				customCountFn: (selectedItems) =>
					formatCounter({
						label: `choice${this.maxSelections === 1 ? '' : 's'}`,
						selected: selectedItems.length,
						max: this.maxSelections || selectedItems.length,
						color: 'bg-info',
					}),
				onConfirm: this._onFeaturesConfirmed.bind(this),
				onCancel: () => {
					// No-op
				},
			});

			this._selector.show();
		} catch (error) {
			console.error(
				'[LevelUpFeatureSelector]',
				'Error showing feature selector:',
				error,
			);
		}
	}

	_renderFeatureItem(feature, state) {
		const isSelected = state.selectedIds.has(feature.id || feature.name);
		const selectedClass = isSelected ? 'selected' : '';

		let badgesHtml = '';
		if (feature.source) {
			badgesHtml += `<span class="badge bg-secondary me-2">${feature.source}</span>`;
		}

		const desc = this._descriptionCache.has(feature.id || feature.name)
			? this._descriptionCache.get(feature.id || feature.name)
			: '<span class="text-muted small">Loading...</span>';

		return `
            <div class="spell-card selector-card ${selectedClass}" data-item-id="${feature.id || feature.name}">
                <div class="spell-card-header">
                    <div>
                        <strong>${feature.name}</strong>
                    </div>
                    <div>${badgesHtml}</div>
                </div>
                <div class="spell-card-body">
                    <div class="feature-description selector-description">${desc}</div>
                </div>
            </div>
        `;
	}

	async _fetchFeatureDescription(feature) {
		const parts = [];
		if (Array.isArray(feature.entries)) {
			for (const entry of feature.entries) {
				if (typeof entry === 'string') {
					parts.push(await textProcessor.processString(entry));
				} else if (Array.isArray(entry?.entries)) {
					for (const sub of entry.entries) {
						if (typeof sub === 'string') {
							parts.push(await textProcessor.processString(sub));
						}
					}
				}
			}
		} else if (typeof feature.entries === 'string') {
			parts.push(await textProcessor.processString(feature.entries));
		}
		return parts.length
			? parts.join(' ')
			: '<span class="text-muted small">No description available.</span>';
	}

	/**
	 * Get feature type display name
	 */
	_getFeatureTypeName() {
		const typeNames = {
			EI: 'Eldritch Invocation',
			MM: 'Metamagic',
			'MV:B': 'Battle Maneuver',
			'MV:M': 'Monk Maneuver',
			FS: 'Fighting Style',
			PB: 'Pact Boon',
			AI: 'Artificer Infusion',
		};
		return typeNames[this.featureType] || 'Feature';
	}

	/**
	 * Get prerequisite note for this feature type
	 */
	_getPrerequisiteNote() {
		const notes = {
			invocation:
				'Some invocations require you to learn specific spells, pacts, or be high enough level before they unlock.',
			EI: 'Some invocations require you to learn specific spells, pacts, or be high enough level before they unlock.',
			MM: 'Only metamagic options you qualify for are shown.',
			'MV:B': 'Only battle maneuvers you qualify for are shown.',
			'MV:M': 'Only monk maneuvers you qualify for are shown.',
			FS: 'Only fighting styles you qualify for are shown.',
			AI: 'Only infusions you qualify for are shown. Some require minimum character levels to unlock.',
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
			selectedFeatures.map((f) => f.name || f.id),
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
