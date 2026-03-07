// Controller for class selection UI, coordinating views and subclass logic.
import { AppState } from '../../../app/AppState.js';
import { CharacterManager } from '../../../app/CharacterManager.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';

import { ARTISAN_TOOLS, attAbvToFull } from '../../../lib/5eToolsParser.js';
import TextProcessor from '../../../lib/TextProcessor.js';
import { classService } from '../../../services/ClassService.js';
import { levelUpService } from '../../../services/LevelUpService.js';
import { optionalFeatureService } from '../../../services/OptionalFeatureService.js';
import { progressionHistoryService } from '../../../services/ProgressionHistoryService.js';
import { sourceService } from '../../../services/SourceService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { ClassASIController } from './ClassASIController.js';
import { ClassCardView } from './ClassCardView.js';
import { ClassChoiceInfoPanel } from './ClassChoiceInfoPanel.js';
import { ClassChoiceQueryService } from './ClassChoiceQueryService.js';
import { ClassChoiceRenderer } from './ClassChoiceRenderer.js';
import { ClassDetailsView } from './ClassDetailsView.js';
import { ClassFeatureSelectorModal } from './ClassFeatureSelectorModal.js';
import { ClassSpellNotificationController } from './ClassSpellNotificationController.js';
import { SubclassPickerView } from './SubclassPickerView.js';

export class ClassCard {
	constructor(_container) {
		this._classService = classService;

		this._cardView = new ClassCardView();

		this._subclassView = new SubclassPickerView();

		this._detailsView = new ClassDetailsView();

		this._activeClassTab = null;
		this._classTabsWrapper = document.getElementById('classTabs');
		this._classTabsList = document.getElementById('classTabsList');

		// Info panel and toggle button
		this._infoPanel = document.getElementById('classInfoPanel');
		this._toggleBtn = document.getElementById('classInfoToggle');

		// DOM cleanup manager
		this._cleanup = DOMCleanup.create();

		// Sub-controllers
		this._asiController = new ClassASIController(this._cleanup);
		this._spellController = new ClassSpellNotificationController(
			this._cleanup,
			this._classService,
		);
		this._queryService = new ClassChoiceQueryService(this._classService);
		this._infoPanelController = new ClassChoiceInfoPanel(
			this._infoPanel,
			this._cleanup,
			this._classService,
		);
		this._choiceRenderer = new ClassChoiceRenderer(this._cleanup, {
			asiController: this._asiController,
			spellController: this._spellController,
			queryService: this._queryService,
			classService: this._classService,
			syncCallback: () => this._syncWithCharacterProgression(),
			onFeatureSelect: (
				className,
				featureType,
				level,
				featureId,
				isMulti,
				maxCount,
			) =>
				this._handleFeatureSelection(
					className,
					featureType,
					level,
					featureId,
					isMulti,
					maxCount,
				),
			onSubclassFeatureChoiceSelect: (className, choiceKey, level) =>
				this._showSubclassFeatureChoiceModal(className, choiceKey, level),
		});

		// Initialize the component
		this.initialize();
	}

	//-------------------------------------------------------------------------
	// Initialization Methods
	//-------------------------------------------------------------------------

	async initialize() {
		try {
			// Initialize required dependencies
			await this._classService.initialize();

			// Set up toggle button
			this._setupToggleButton();

			// Set up event listeners
			this._setupEventListeners();

			// Load saved class selection from character data
			await this._loadSavedClassSelection();

			// Set up hover listeners for choice items
			this._infoPanelController.setupHoverListeners(
				document.getElementById('classChoicesPanel'),
			);
		} catch (error) {
			console.error('[ClassCard]', 'Failed to initialize class card:', error);
		}
	}

	_setupToggleButton() {
		if (!this._toggleBtn || !this._infoPanel) return;

		this._cleanup.on(this._toggleBtn, 'click', () => {
			const isCollapsed = this._infoPanel.classList.contains('collapsed');

			if (isCollapsed) {
				this._infoPanel.classList.remove('collapsed');
				this._toggleBtn.querySelector('i').className = 'fas fa-chevron-right';
			} else {
				this._infoPanel.classList.add('collapsed');
				this._toggleBtn.querySelector('i').className = 'fas fa-chevron-left';
			}
		});
	}

	_setupEventListeners() {
		this._cleanup.onEvent(EVENTS.CHARACTER_UPDATED, () => {
			this._syncWithCharacterProgression();
		});
		this._cleanup.onEvent(EVENTS.CHARACTER_SELECTED, () => {
			this._handleCharacterChanged();
		});
		this._cleanup.onEvent(EVENTS.SOURCES_ALLOWED_CHANGED, () => {
			this._loadSavedClassSelection();
		});
		this._cleanup.onEvent('LEVEL_UP_COMPLETE', () => {
			this._handleLevelUpComplete();
		});
	}

	_cleanupEventListeners() {
		this._cleanup.cleanup();
	}

	//-------------------------------------------------------------------------
	// Data Loading Methods
	//-------------------------------------------------------------------------

	async _loadSavedClassSelection() {
		try {
			const character = AppState.getCurrentCharacter();

			// Check if character has class data in progression
			if (
				!character ||
				!character.progression?.classes ||
				character.progression.classes.length === 0
			) {
				await this._renderClassTabsFromProgression();
				this.resetClassDetails();
				return; // No class data to load
			}

			const primaryClass = character.getPrimaryClass();

			if (!primaryClass?.name) {
				await this._renderClassTabsFromProgression();
				this.resetClassDetails();
				return; // No saved class to load
			}

			// Default to PHB if source is missing (legacy characters)
			const classSource = primaryClass.source || 'PHB';

			// Load class data directly without dropdown
			const classData = this._classService.getClass(
				primaryClass.name,
				classSource,
			);
			if (classData) {
				// Get subclass from progression.classes[]
				const subclassName = primaryClass.subclass || null;

				let subclassData = null;
				if (subclassName) {
					const subclasses = this._classService.getSubclasses(
						classData.name,
						classData.source,
					);
					subclassData = subclasses.find((sc) => sc.name === subclassName);
				}

				// Update class details with class and subclass data
				await this.updateClassDetails(classData, subclassData);
			} else {
				console.warn(
					'ClassCard',
					`Saved class "${primaryClass.name}" (${classSource}) not found. Character might use a source that's not currently allowed.`,
				);
			}

			// Render multiclass tabs based on progression
			await this._renderClassTabsFromProgression();
		} catch (error) {
			console.error(
				'[ClassCard]',
				'Error loading saved class selection:',
				error,
			);
		}
	}

	// Dropdown population methods removed - class/subclass now managed through feature selection

	//-------------------------------------------------------------------------
	// Event Handlers
	//-------------------------------------------------------------------------

	async _handleCharacterChanged() {
		try {
			// Reload class selection to match character's class
			await this._loadSavedClassSelection();
			await this._renderClassTabsFromProgression();
		} catch (error) {
			console.error(
				'ClassCard',
				'Error handling character changed event:',
				error,
			);
		}
	}

	async _syncWithCharacterProgression() {
		await this._renderClassTabsFromProgression();

		// If the active tab changed, also sync the class select/details without firing change events
		if (this._activeClassTab) {
			await this._selectClassByName(this._activeClassTab);
		}
	}

	async _handleLevelUpComplete() {
		try {
			// Refresh the entire class selection to pick up new level and choices
			await this._loadSavedClassSelection();
		} catch (error) {
			console.error(
				'[ClassCard]',
				'Error handling level up completion:',
				error,
			);
		}
	}

	//-------------------------------------------------------------------------
	// UI Update Methods
	//-------------------------------------------------------------------------

	async updateClassDetails(classData, subclassData = null) {
		if (!classData) {
			this.resetClassDetails();
			return;
		}

		// Get fluff data for description
		const fluffData = this._classService.getClassFluff(
			classData.name,
			classData.source,
		);

		// Update class details (proficiencies, etc.) in info panel
		await this._detailsView.updateAllDetails(classData, fluffData);

		// Apply class proficiencies to character
		this._updateCharacterClass(classData, subclassData?.name || '');

		// Update class choices section
		await this._updateClassChoices(classData, subclassData);
	}

	async _renderClassTabsFromProgression() {
		if (!this._classTabsWrapper || !this._classTabsList) return;

		const character = AppState.getCurrentCharacter();
		const classes = character?.progression?.classes || [];

		if (!classes.length || classes.length < 2) {
			this._classTabsWrapper.classList.add('u-hidden');
			this._classTabsList.innerHTML = '';
			this._activeClassTab = classes[0]?.name || null;
			return;
		}

		// Preserve current active tab if it still exists; otherwise use first class
		const availableNames = classes.map((c) => c.name);
		if (
			!this._activeClassTab ||
			!availableNames.includes(this._activeClassTab)
		) {
			this._activeClassTab = classes[0].name;
		}

		const buttonsHtml = classes
			.map((cls) => {
				const isActive = cls.name === this._activeClassTab;
				const activeClass = isActive ? 'active' : '';
				return `<button type="button" class="nav-link py-1 px-3 u-text-md ${activeClass}" data-class-name="${cls.name}">
					${cls.name} <span class="badge bg-secondary ms-1 u-text-sm">Lv ${cls.levels}</span>
				</button>`;
			})
			.join('');

		this._classTabsList.innerHTML = buttonsHtml;
		this._classTabsWrapper.classList.remove('u-hidden');

		// Bind click handlers
		this._classTabsList.querySelectorAll('[data-class-name]').forEach((btn) => {
			btn.addEventListener('click', async () => {
				const name = btn.getAttribute('data-class-name');
				this._activeClassTab = name;

				// Update active state
				this._classTabsList
					.querySelectorAll('[data-class-name]')
					.forEach((b) => {
						b.classList.toggle('active', b === btn);
					});

				await this._selectClassByName(name);
			});
		});
	}

	async _selectClassByName(className, { skipTabUpdate = false } = {}) {
		if (!className) return;

		// Get character to find class source
		const character = CharacterManager.getCurrentCharacter();
		const progressionClass = character?.progression?.classes?.find(
			(c) => c.name === className,
		);
		const classSource = progressionClass?.source || 'PHB';

		// Load class data directly by name and source
		const classData = this._classService.getClass(className, classSource);
		if (!classData) {
			console.warn(
				'[ClassCard]',
				`Class not found: ${className} (${classSource})`,
			);
			return;
		}

		// Get subclass if selected
		const subclassName = progressionClass?.subclass;
		let subclassData = null;
		if (subclassName) {
			const subclasses = this._classService.getSubclasses(
				className,
				classSource,
			);
			subclassData = subclasses.find((sc) => sc.name === subclassName);
		}

		// Update UI (fluffData is fetched in updateClassDetails now)
		await this.updateClassDetails(classData, subclassData);

		if (!skipTabUpdate) {
			await this._renderClassTabsFromProgression();
		}
	}

	async _updateClassChoices(classData, subclassData = null) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character || !classData) {
			this._hideClassChoices();
			this._hideSubclassNotification();
			this._asiController.hide();
			this._spellController.hide();
			return;
		}

		const className = classData.name;

		// Get all class choices across all levels (including spell selections and ASI)
		const progressionClass = character.progression?.classes?.find(
			(c) => c.name === className,
		);
		const classLevel = progressionClass?.levels || 0;

		const allChoices = [];
		const allPassiveFeatures = [];
		for (let lvl = 1; lvl <= classLevel; lvl++) {
			const levelChoices = await this._queryService.getChoicesAtLevel(
				className,
				lvl,
				subclassData,
			);
			allChoices.push(...levelChoices);

			const levelPassiveFeatures =
				this._queryService.getNoChoiceFeaturesAtLevel(
					className,
					lvl,
					classData,
				);
			allPassiveFeatures.push(...levelPassiveFeatures);
		}

		// Sort all choices by level to ensure proper display order
		allChoices.sort((a, b) => a.level - b.level);

		// Hide the old spell notification section since spells are now integrated
		this._spellController.hide();
		// Hide the old separate ASI section since ASI is now integrated
		this._asiController.hide();

		// Show container if any choices or passive features exist
		const hasContent = allChoices.length > 0 || allPassiveFeatures.length > 0;

		if (hasContent) {
			this._showClassChoices();
		} else {
			this._hideClassChoices();
		}

		if (hasContent) {
			await this._choiceRenderer.renderChoices(
				className,
				allChoices,
				allPassiveFeatures,
			);
		}
	}

	_hideSubclassNotification() {
		const container = document.getElementById('subclassChoiceSection');
		if (container) {
			container.classList.add('u-hidden');
			container.innerHTML = '';
		}
	}

	/**
	 * Show modal for selecting subclass feature choices (e.g., Dragon Ancestor)
	 * @private
	 */
	async _showSubclassFeatureChoiceModal(className, choiceKey, level) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const progressionClass = character.progression?.classes?.find(
			(c) => c.name === className,
		);
		if (!progressionClass) return;

		// Get the choice definition
		const subclassShortName = this._classService
			.getSubclasses(className, progressionClass.source || 'PHB')
			.find((sc) => sc.name === progressionClass.subclass)?.shortName;
		if (!subclassShortName) return;

		const featureChoiceDefs = this._queryService.getSubclassFeatureChoices(
			className,
			subclassShortName,
			20,
			progressionClass.source,
		);
		const definition = featureChoiceDefs.find(
			(fc) => fc.choiceKey === choiceKey,
		);
		if (!definition) return;

		// Build mock session and parent for the modal (it expects this structure)
		const mockSession = {
			originalCharacter: character,
			stagedChanges: character,
			stepData: {},
		};

		const mockParent = {
			updateFeatureSelection: (_cls, _type, _reqLevel, selectedNames) => {
				this._handleSubclassFeatureChoiceChange(
					className,
					choiceKey,
					selectedNames[0] || null,
					level,
					definition,
				);
			},
		};

		// Convert choice options to feature-like objects for the modal
		const featureOptions = definition.options.map((opt) => {
			let entries = opt.entries || [];

			// For table-type choices with no entries, format metadata as description
			if (
				entries.length === 0 &&
				definition.choiceType === 'table' &&
				definition.colLabels
			) {
				const metadataEntries = [];
				for (let i = 1; i < definition.colLabels.length; i++) {
					const colLabel = definition.colLabels[i];
					const key = colLabel.toLowerCase().replace(/\s+/g, '_');
					const value = opt[key];
					if (value) {
						metadataEntries.push(`{@b ${colLabel}:} ${value}`);
					}
				}
				if (metadataEntries.length > 0) {
					entries = [metadataEntries.join(' • ')];
				}
			}

			return {
				id: opt.value,
				name: opt.value,
				source: opt.source || progressionClass.source || 'PHB',
				entries,
				// Store metadata for later retrieval
				_metadata: opt,
			};
		});

		// Find current selection
		const currentChoice = progressionClass.subclassChoices?.[choiceKey];
		const currentSelections = currentChoice
			? featureOptions.filter((f) => f.id === currentChoice.value)
			: [];

		const modal = new ClassFeatureSelectorModal(
			mockSession,
			mockParent,
			className,
			`subclass-${choiceKey}`,
			level,
			null,
		);

		await modal.show(
			featureOptions,
			currentSelections,
			false, // single select
			1, // max 1 selection
		);

		// Re-render after modal closes to reflect the choice
		await this._syncWithCharacterProgression();
	}

	/**
	 * Handle subclass feature choice change from modal
	 * @private
	 */
	async _handleSubclassFeatureChoiceChange(
		className,
		choiceKey,
		selectedValue,
		_level,
		definition,
	) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const progressionClass = character.progression?.classes?.find(
			(c) => c.name === className,
		);
		if (!progressionClass) return;

		if (!progressionClass.subclassChoices) {
			progressionClass.subclassChoices = {};
		}

		if (!selectedValue) {
			delete progressionClass.subclassChoices[choiceKey];
		} else {
			const selectedOption = definition.options.find(
				(o) => o.value === selectedValue,
			);
			if (!selectedOption) return;

			// Store value plus any metadata from the option
			const choiceData = { value: selectedOption.value };
			if (definition.colLabels) {
				for (const col of definition.colLabels.slice(1)) {
					const key = col.toLowerCase().replace(/\s+/g, '_');
					if (selectedOption[key]) {
						choiceData[key] = selectedOption[key];
					}
				}
			}
			progressionClass.subclassChoices[choiceKey] = choiceData;
		}

		eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
	}

	async _handleFeatureSelection(
		className,
		featureType,
		level,
		featureId,
		isMulti,
		maxCount,
	) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Handle subclass selection separately
		if (featureType === 'subclass') {
			return this._handleSubclassFeatureSelection(className, level, featureId);
		}

		// Get current selections at this level
		const currentSelections =
			progressionHistoryService.getChoices(character, className, level)?.[
				featureType
			]?.selected || [];

		// Get all selections from OTHER levels to exclude them
		const progressionClass = character.progression?.classes?.find(
			(c) => c.name === className,
		);
		const classLevel = progressionClass?.levels || 0;
		const otherLevelSelections = new Set();

		// Collect selections from all other levels
		for (let lvl = 1; lvl <= classLevel; lvl++) {
			if (lvl !== level) {
				const levelChoices = progressionHistoryService.getChoices(
					character,
					className,
					lvl,
				);
				const levelSelections = levelChoices?.[featureType]?.selected || [];
				for (const sel of levelSelections) {
					otherLevelSelections.add(sel);
				}
			}
		}

		// Get available options based on feature type
		const featureTypeMap = {
			invocation: ['EI'],
			metamagic: ['MM'],
			maneuver: ['MV:B'],
			'fighting-style': ['FS:F', 'FS:R', 'FS:P'],
			patron: ['PB'],
		};

		const featureTypeCodes = featureTypeMap[featureType] || [];
		const availableFeatures = optionalFeatureService
			.getFeaturesByType(featureTypeCodes)
			.filter((opt) => sourceService.isSourceAllowed(opt.source))
			.filter((opt) => {
				// Exclude features already selected at OTHER levels
				const featureName = opt.name;
				const featureId = `${opt.name}_${opt.source}`;
				return (
					!otherLevelSelections.has(featureName) &&
					!otherLevelSelections.has(featureId)
				);
			});

		// Create a minimal session-like object for the selector
		const mockSession = {
			originalCharacter: character,
			stagedChanges: character,
			stepData: {
				selectedFeatures: {},
			},
		};

		// Show feature selector
		const selector = new ClassFeatureSelectorModal(
			mockSession,
			this,
			className,
			featureType, // Use the mapped type, not the code
			level,
			featureId,
		);

		// Map to selector format
		const mappedFeatures = availableFeatures.map((opt) => ({
			id: `${opt.name}_${opt.source}`,
			name: opt.name,
			source: opt.source,
			description: this._queryService.getFeatureDescription(opt),
			entries: opt.entries,
			prerequisite: opt.prerequisite,
		}));

		// Map current selections to feature objects
		const selectedFeatures = currentSelections
			.map((selId) => {
				const opt = availableFeatures.find(
					(f) => `${f.name}_${f.source}` === selId || f.name === selId,
				);
				return opt
					? {
							id: `${opt.name}_${opt.source}`,
							name: opt.name,
							source: opt.source,
						}
					: { id: selId, name: selId };
			})
			.filter(Boolean);

		await selector.show(mappedFeatures, selectedFeatures, isMulti, maxCount);
	}

	async _handleSubclassFeatureSelection(className, level, featureId) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Get available subclasses
		const classData = this._classService.getClass(className);
		const availableSubclasses = this._classService
			.getSubclasses(className, classData.source)
			.filter((sc) => {
				const subclassSource = sc.subclassSource || sc.source || sc.classSource;
				return sourceService.isSourceAllowed(subclassSource);
			})
			.map((sc) => {
				// Resolve subclass feature entries if they're string references
				let entries = [];
				if (sc.subclassFeatures && sc.subclassFeatures.length > 0) {
					const firstFeatureRef = sc.subclassFeatures[0];
					if (typeof firstFeatureRef === 'string') {
						// Resolve from service data - get features up to character's level
						const features = this._classService.getSubclassFeatures(
							sc.className,
							sc.shortName,
							level || 20,
							sc.source || 'PHB',
						);
						// Get the first (lowest level) feature
						const firstFeature = features.length > 0 ? features[0] : null;
						entries = firstFeature?.entries || [];
					} else {
						// Already an object with entries
						entries = firstFeatureRef?.entries || [];
					}
				}

				return {
					id: `${sc.name}_${sc.subclassSource || sc.source || sc.classSource}`,
					name: sc.name,
					source: sc.subclassSource || sc.source || sc.classSource,
					description: this._queryService.getSubclassDescription(sc),
					entries,
					shortName: sc.shortName,
				};
			});

		// Create a minimal session-like object for the selector
		const mockSession = {
			originalCharacter: character,
			stagedChanges: character,
			stepData: {
				selectedFeatures: {},
			},
		};

		// Show feature selector
		const selector = new ClassFeatureSelectorModal(
			mockSession,
			this,
			className,
			'subclass',
			level,
			featureId,
		);

		await selector.show(availableSubclasses, [], false, 1);
	}

	updateFeatureSelection(className, featureType, level, selectedNames) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Handle subclass selection separately
		if (featureType === 'subclass') {
			this._updateSubclassSelection(className, selectedNames);
			return;
		}

		// Save selections to progression history
		const choices = {};
		choices[featureType] = {
			selected: selectedNames,
			count: selectedNames.length,
		};

		progressionHistoryService.recordChoices(
			character,
			className,
			level,
			choices,
		);

		// Emit event to notify about character update
		eventBus.emit(EVENTS.CHARACTER_UPDATED, {
			character: CharacterManager.getCurrentCharacter(),
		});
	}

	_updateSubclassSelection(className, selectedNames) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character || selectedNames.length === 0) return;

		// Extract subclass name from the selected ID (format: "SubclassName_Source")
		const selectedId = selectedNames[0];
		const subclassName = selectedId.split('_')[0];

		// Get class data
		const classData = this._classService.getClass(className);
		if (!classData) return;

		// Get current subclass before changing
		const progressionClass = character.progression?.classes?.find(
			(c) => c.name === className,
		);
		const oldSubclass = progressionClass?.subclass;

		// Check if subclass is actually changing
		const isChanging = oldSubclass && oldSubclass !== subclassName;

		if (isChanging) {
			// 1. Clear subclass-specific features from progression.classes[].features
			if (progressionClass?.features) {
				// Remove features that came from the old subclass
				const oldSubclassData = this._classService
					.getSubclasses(className, classData.source)
					.find((sc) => sc.name === oldSubclass);

				if (oldSubclassData) {
					// Get all old subclass feature names
					const oldSubclassFeatureNames = new Set();
					const classLevel = progressionClass.levels || 1;
					const oldFeatures = this._classService.getSubclassFeatures(
						className,
						oldSubclassData.shortName || oldSubclass,
						classLevel,
						oldSubclassData.source || classData.source,
					);

					for (const feature of oldFeatures) {
						oldSubclassFeatureNames.add(feature.name);
					}

					// Remove old subclass features
					progressionClass.features = (progressionClass.features || []).filter(
						(featureName) => !oldSubclassFeatureNames.has(featureName),
					);
				}
			}

			// 2. Clear subclass-specific optional feature choices from progression history
			// This includes invocations, metamagic, maneuvers, etc. that might be subclass-restricted
			const featureTypesToClear = [
				'invocation',
				'metamagic',
				'fighting-style',
				'maneuver',
			];
			progressionHistoryService.clearFeatureTypesFromClass(
				character,
				className,
				featureTypesToClear,
			);

			// 4. Clear subclass feature choices (e.g., Dragon Ancestor)
			if (progressionClass?.subclassChoices) {
				progressionClass.subclassChoices = {};
			}

			// 5. Clear subclass-specific spells if the spellcasting is subclass-dependent
			// Some subclasses grant specific spell lists (e.g., Cleric domains)
			if (character.spellcasting?.classes?.[className]) {
				// Clear spell selections from progression.spellSelections for this class
				// The user will need to re-select appropriate spells for the new subclass
				spellSelectionService.clearSpellSelectionsForClass(
					character,
					className,
				);

				// Note: We keep spellsKnown intact for now, but the user can use the spell selection
				// UI to remove incompatible spells and add new ones
			}
		}

		// Update character's subclass in progression.classes[]
		if (progressionClass) {
			progressionClass.subclass = subclassName;
		}

		// Emit event to notify about character update
		eventBus.emit(EVENTS.CHARACTER_UPDATED, {
			character: CharacterManager.getCurrentCharacter(),
		});

		// Show notification if subclass was changed
		if (isChanging) {
			// TODO: Import notification service to show subclass change warning
			// NotificationCenter doesn't have a show(message, type, duration) method
			// Should use Notifications.js show() method instead
			console.warn(
				'[ClassCard]',
				`Subclass changed to ${subclassName}. Please review your class features and spells.`,
			);
		}
	}

	async _updateFeatureDisplay(className) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const classData = this._classService.getClass(className);
		if (!classData) return;

		// Get subclass from progression.classes[]
		const progressionClass = character.progression?.classes?.find(
			(c) => c.name === className,
		);
		const subclassName = progressionClass?.subclass;
		let subclassData = null;
		if (subclassName) {
			const subclasses = this._classService.getSubclasses(
				className,
				classData.source,
			);
			subclassData = subclasses.find((sc) => sc.name === subclassName);
		}

		// Refresh the class choices section
		await this._updateClassChoices(classData, subclassData);
	}

	_showClassChoices() {
		const container = document.getElementById('classChoicesContainer');
		if (container) {
			container.classList.remove('u-hidden');
		}
	}

	_hideClassChoices() {
		const container = document.getElementById('classChoicesContainer');
		if (container) {
			container.classList.add('u-hidden');
		}
	}

	resetClassDetails() {
		this._detailsView.resetAllDetails();
	}

	//-------------------------------------------------------------------------
	// Character Data Management
	//-------------------------------------------------------------------------

	_updateCharacterClass(classData, subclassName = '') {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Check if class has changed (compare with progression.classes[])
		const primaryClass = character.getPrimaryClass();
		const progressionClass = character.progression?.classes?.find(
			(c) => c.name === classData?.name,
		);
		const currentSubclass = progressionClass?.subclass || '';
		const hasChanged = !classData
			? primaryClass?.name || primaryClass?.source
			: primaryClass?.name !== classData.name ||
				primaryClass?.source !== classData.source ||
				currentSubclass !== subclassName;

		if (hasChanged) {
			// Clear previous class proficiencies, ability bonuses, and traits
			character.removeProficienciesBySource('Class');
			character.clearTraits('Class');

			// Remove subclass proficiencies and traits
			character.removeProficienciesBySource('Subclass');
			character.clearTraits('Subclass');

			// Initialize progression to track classes (needed for multiclass)
			levelUpService.initializeProgression(character);

			if (classData) {
				// Update or add class in progression.classes[] (no legacy character.class field)

				// Add proficiencies
				this._updateProficiencies(classData);
			}

			// Notify coordinator to refresh dependent cards
			this.onBuildChange?.('class');
		}
	}

	_updateProficiencies(classData) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character || !classData) return;

		// Store previous selected proficiencies to restore valid ones later
		const previousClassSkills =
			character.optionalProficiencies.skills.class?.selected || [];

		// Clear class-specific proficiencies by source
		character.removeProficienciesBySource('Class');

		// Reset class skill options
		character.optionalProficiencies.skills.class.allowed = 0;
		character.optionalProficiencies.skills.class.options = [];
		character.optionalProficiencies.skills.class.selected = [];

		character.optionalProficiencies.languages.class.allowed = 0;
		character.optionalProficiencies.languages.class.options = [];
		character.optionalProficiencies.languages.class.selected = [];

		character.optionalProficiencies.tools.class.allowed = 0;
		character.optionalProficiencies.tools.class.options = [];
		character.optionalProficiencies.tools.class.selected = [];

		// Add saving throw proficiencies
		const savingThrows = this._getSavingThrows(classData);
		if (savingThrows && savingThrows.length > 0) {
			for (const save of savingThrows) {
				character.addProficiency('savingThrows', save, 'Class');
			}
		}

		// Add armor proficiencies
		const armorProficiencies = this._getArmorProficiencies(classData);
		if (armorProficiencies && armorProficiencies.length > 0) {
			for (const armor of armorProficiencies) {
				character.addProficiency('armor', armor, 'Class');
			}
		}

		// Add weapon proficiencies
		const weaponProficiencies = this._getWeaponProficiencies(classData);
		if (weaponProficiencies && weaponProficiencies.length > 0) {
			for (const weapon of weaponProficiencies) {
				character.addProficiency('weapons', weapon, 'Class');
			}
		}

		// Add tool proficiencies (fixed proficiencies from tools field)
		const toolProficiencies = this._getToolProficiencies(classData);
		if (toolProficiencies && toolProficiencies.length > 0) {
			for (const tool of toolProficiencies) {
				// Skip display strings like "Choose X tools"
				if (!tool.toLowerCase().startsWith('choose')) {
					character.addProficiency('tools', tool, 'Class');
				}
			}
		}

		// Handle tool proficiency choices (from toolProficiencies field)
		this._processClassToolProficiencies(classData, character);

		// Handle skill proficiencies
		const skills = this._getSkillProficiencies(classData);
		const skillChoiceCount = this._getSkillChoiceCount(classData);

		if (skills && skills.length > 0 && skillChoiceCount > 0) {
			// Set up skill choices using the extracted names
			character.optionalProficiencies.skills.class.allowed = skillChoiceCount;
			character.optionalProficiencies.skills.class.options = skills;

			// Restore valid selections using normalized name comparison
			const normalizedSkills = skills.map((skill) =>
				TextProcessor.normalizeForLookup(skill),
			);
			character.optionalProficiencies.skills.class.selected =
				previousClassSkills.filter((skill) =>
					normalizedSkills.includes(TextProcessor.normalizeForLookup(skill)),
				);
		}

		// Update combined options for all proficiency types
		this._updateCombinedProficiencyOptions(character);

		// Notify coordinator to refresh dependent cards
		this.onBuildChange?.('class-proficiency');
	}

	_updateCombinedProficiencyOptions(character) {
		if (!character) return;

		// Update skill options
		this._updateCombinedSkillOptions(character);

		// Update language options
		const raceLanguageAllowed =
			character.optionalProficiencies.languages.race?.allowed || 0;
		const classLanguageAllowed =
			character.optionalProficiencies.languages.class?.allowed || 0;
		const backgroundLanguageAllowed =
			character.optionalProficiencies.languages.background?.allowed || 0;

		const raceLanguageOptions =
			character.optionalProficiencies.languages.race?.options || [];
		const classLanguageOptions =
			character.optionalProficiencies.languages.class?.options || [];
		const backgroundLanguageOptions =
			character.optionalProficiencies.languages.background?.options || [];

		const raceLanguageSelected =
			character.optionalProficiencies.languages.race?.selected || [];
		const classLanguageSelected =
			character.optionalProficiencies.languages.class?.selected || [];
		const backgroundLanguageSelected =
			character.optionalProficiencies.languages.background?.selected || [];

		// Update total allowed count for languages
		character.optionalProficiencies.languages.allowed =
			raceLanguageAllowed + classLanguageAllowed + backgroundLanguageAllowed;

		// Combine selected languages from all sources
		character.optionalProficiencies.languages.selected = [
			...new Set([
				...raceLanguageSelected,
				...classLanguageSelected,
				...backgroundLanguageSelected,
			]),
		];

		// For combined options, include language options from all sources
		character.optionalProficiencies.languages.options = [
			...new Set([
				...raceLanguageOptions,
				...classLanguageOptions,
				...backgroundLanguageOptions,
			]),
		];
	}

	_updateCombinedSkillOptions(character) {
		if (!character) return;

		const raceAllowed =
			character.optionalProficiencies.skills.race?.allowed || 0;
		const classAllowed =
			character.optionalProficiencies.skills.class?.allowed || 0;
		const backgroundAllowed =
			character.optionalProficiencies.skills.background?.allowed || 0;

		const raceOptions =
			character.optionalProficiencies.skills.race?.options || [];
		const classOptions =
			character.optionalProficiencies.skills.class?.options || [];
		const backgroundOptions =
			character.optionalProficiencies.skills.background?.options || [];

		const raceSelected =
			character.optionalProficiencies.skills.race?.selected || [];
		const classSelected =
			character.optionalProficiencies.skills.class?.selected || [];
		const backgroundSelected =
			character.optionalProficiencies.skills.background?.selected || [];

		// Preserve existing selections if source arrays are empty
		const sourceSelections = [
			...raceSelected,
			...classSelected,
			...backgroundSelected,
		];
		const existingSkillSelections =
			character.optionalProficiencies.skills.selected || [];

		// Update total allowed count
		character.optionalProficiencies.skills.allowed =
			raceAllowed + classAllowed + backgroundAllowed;

		// Combine selected skills from all sources
		character.optionalProficiencies.skills.selected =
			sourceSelections.length > 0
				? [...new Set(sourceSelections)]
				: existingSkillSelections; // Keep saved data if sources are empty

		// For combined options, include options from all sources
		character.optionalProficiencies.skills.options = [
			...new Set([...raceOptions, ...classOptions, ...backgroundOptions]),
		];
	}

	//-------------------------------------------------------------------------
	// Data Extraction Helper Methods
	//-------------------------------------------------------------------------

	_getSavingThrows(classData) {
		if (!classData?.proficiency) return [];
		return classData.proficiency.map((prof) => attAbvToFull(prof) || prof);
	}

	_getArmorProficiencies(classData) {
		if (!classData?.startingProficiencies?.armor) return [];

		const armorMap = {
			light: 'Light Armor',
			medium: 'Medium Armor',
			heavy: 'Heavy Armor',
			shield: 'Shields',
		};

		return classData.startingProficiencies.armor.map((armor) => {
			if (armorMap[armor]) return armorMap[armor];
			return armor;
		});
	}

	_getWeaponProficiencies(classData) {
		if (!classData?.startingProficiencies?.weapons) return [];

		const weaponMap = {
			simple: 'Simple Weapons',
			martial: 'Martial Weapons',
		};

		return classData.startingProficiencies.weapons.map((weapon) => {
			if (weaponMap[weapon]) return weaponMap[weapon];
			return weapon;
		});
	}

	_processClassToolProficiencies(classData, character) {
		const toolProfs = classData?.startingProficiencies?.toolProficiencies;
		if (!toolProfs || !Array.isArray(toolProfs)) {
			return;
		}

		// Accumulate all choices across multiple objects
		let maxAllowed = 0;
		const allOptions = [];

		for (const profObj of toolProfs) {
			// Handle fixed tool proficiencies (e.g., Druid with "herbalism kit": true)
			for (const [tool, hasProf] of Object.entries(profObj)) {
				if (
					hasProf === true &&
					tool !== 'any' &&
					tool !== 'anyMusicalInstrument' &&
					tool !== 'anyArtisansTool' &&
					tool !== 'choose'
				) {
					// Add tool with original JSON casing preserved
					character.addProficiency('tools', tool, 'Class');
				}
			}

			// Handle "any musical instrument" choice (e.g., Bard with anyMusicalInstrument: 3)
			if (profObj.anyMusicalInstrument) {
				const count = profObj.anyMusicalInstrument;
				maxAllowed = Math.max(maxAllowed, count);
				allOptions.push('Musical instrument');
			}

			// Handle "any artisan's tool" choice (e.g., Monk with anyArtisansTool: 1)
			if (profObj.anyArtisansTool) {
				const count = profObj.anyArtisansTool;
				maxAllowed = Math.max(maxAllowed, count);
				// Add all individual artisan tools as options
				allOptions.push(...ARTISAN_TOOLS);
			}

			// Handle "any" tool proficiency choice
			if (profObj.any && profObj.any > 0) {
				maxAllowed = Math.max(maxAllowed, profObj.any);
				allOptions.push('any');
			}

			// Handle choose from specific list
			if (profObj.choose) {
				const count = profObj.choose.count || 1;
				const options = profObj.choose.from || [];
				maxAllowed = Math.max(maxAllowed, count);
				allOptions.push(...options);
			}
		}

		// Apply accumulated tool choices if any
		if (maxAllowed > 0) {
			character.optionalProficiencies.tools.class.allowed = maxAllowed;
			character.optionalProficiencies.tools.class.options = allOptions;
			character.optionalProficiencies.tools.class.selected = [];

			// Special case: if ONLY "Musical instrument" is offered (like Bard),
			// auto-populate the selected array so it shows as granted/default
			if (allOptions.length === 1 && allOptions[0] === 'Musical instrument') {
				for (let i = 0; i < maxAllowed; i++) {
					character.optionalProficiencies.tools.class.selected.push(
						'Musical instrument',
					);
				}
			}
		}
	}

	_getToolProficiencies(classData) {
		if (!classData?.startingProficiencies?.tools) return [];

		// If toolProficiencies field exists, it handles the actual choices
		// so we should skip display text that represents those choices
		const hasToolProficienciesField =
			classData?.startingProficiencies?.toolProficiencies?.length > 0;

		const tools = [];
		for (const toolEntry of classData.startingProficiencies.tools) {
			if (typeof toolEntry === 'string') {
				// Skip display text for choices if toolProficiencies field handles them
				// Display text typically contains phrases like "any one", "of your choice"
				const isChoiceText = /\b(any|choose|of your choice)\b/i.test(toolEntry);
				if (!hasToolProficienciesField || !isChoiceText) {
					tools.push(toolEntry);
				}
			} else if (toolEntry.choose) {
				const count = toolEntry.choose.count || 1;
				tools.push(`Choose ${count} tool${count > 1 ? 's' : ''}`);
			} else {
				for (const [key, value] of Object.entries(toolEntry)) {
					if (value === true) {
						tools.push(key);
					}
				}
			}
		}

		return tools;
	}

	_getSkillProficiencies(classData) {
		if (!classData?.startingProficiencies?.skills) return [];

		const skills = classData.startingProficiencies.skills;
		const skillOptions = [];

		for (const skillEntry of skills) {
			if (skillEntry.choose?.from) {
				skillOptions.push(...skillEntry.choose.from);
			} else if (skillEntry.choose?.fromFilter) {
				// "Any" skills - return special marker
				skillOptions.push('any');
			} else {
				skillOptions.push(...Object.keys(skillEntry));
			}
		}

		return skillOptions;
	}

	_getSkillChoiceCount(classData) {
		if (!classData?.startingProficiencies?.skills) return 0;

		const skills = classData.startingProficiencies.skills;

		for (const skillEntry of skills) {
			if (skillEntry.choose) {
				return skillEntry.choose.count || 0;
			}
		}

		return 0;
	}
}
