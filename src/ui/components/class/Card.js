// Controller for class selection UI, coordinating views and subclass logic.
import { AppState } from '../../../app/AppState.js';
import { CharacterManager } from '../../../app/CharacterManager.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';

import {
	attAbvToFull,
	levelToProficiencyBonus,
	toSentenceCase, toTitleCase,
} from '../../../lib/5eToolsParser.js';
import DataNormalizer from '../../../lib/DataNormalizer.js';
import { ARTISAN_TOOLS } from '../../../lib/ProficiencyConstants.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { abilityScoreService } from '../../../services/AbilityScoreService.js';
import { classService } from '../../../services/ClassService.js';
import { levelUpService } from '../../../services/LevelUpService.js';
import { optionalFeatureService } from '../../../services/OptionalFeatureService.js';
import { progressionHistoryService } from '../../../services/ProgressionHistoryService.js';
import { sourceService } from '../../../services/SourceService.js';
import { LevelUpFeatureSelector } from '../level/LevelUpFeatureSelector.js';

export class ClassCard {
	constructor(_container) {
		this._classService = classService;

		this._cardView = new ClassCardView();

		this._subclassView = new SubclassPickerView();

		this._detailsView = new ClassDetailsView();

		this._activeClassTab = null;
		this._classTabsWrapper = document.getElementById('classTabs');
		this._classTabsList = document.getElementById('classTabsList');

		// DOM cleanup manager
		this._cleanup = DOMCleanup.create();

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

			// Set up event listeners
			this._setupEventListeners();

			// Load saved class selection from character data
			await this._loadSavedClassSelection();
		} catch (error) {
			console.error('ClassCard', 'Failed to initialize class card:', error);
		}
	}

	_setupEventListeners() {
		// Store handler references for cleanup
		this._classSelectedHandler = (classData) => {
			this._handleClassChange({ target: { value: classData.value } });
		};
		this._subclassSelectedHandler = (subclassData) => {
			this._handleSubclassChange({ target: { value: subclassData.value } });
		};
		this._characterUpdatedHandler = () => {
			this._syncWithCharacterProgression();
		};
		this._characterSelectedHandler = () => {
			this._handleCharacterChanged();
		};
		this._sourcesChangedHandler = () => {
			this._loadSavedClassSelection();
		};
		this._levelUpCompleteHandler = () => {
			this._handleLevelUpComplete();
		};

		// Listen to view events via EventBus
		eventBus.on(EVENTS.CLASS_SELECTED, this._classSelectedHandler);
		eventBus.on(EVENTS.SUBCLASS_SELECTED, this._subclassSelectedHandler);
		eventBus.on(EVENTS.CHARACTER_UPDATED, this._characterUpdatedHandler);
		eventBus.on(EVENTS.CHARACTER_SELECTED, this._characterSelectedHandler);
		eventBus.on('sources:allowed-changed', this._sourcesChangedHandler);
		eventBus.on('LEVEL_UP_COMPLETE', this._levelUpCompleteHandler);
	}

	_cleanupEventListeners() {
		// Manually remove all eventBus listeners
		if (this._classSelectedHandler) {
			eventBus.off(EVENTS.CLASS_SELECTED, this._classSelectedHandler);
		}
		if (this._subclassSelectedHandler) {
			eventBus.off(EVENTS.SUBCLASS_SELECTED, this._subclassSelectedHandler);
		}
		if (this._characterUpdatedHandler) {
			eventBus.off(EVENTS.CHARACTER_UPDATED, this._characterUpdatedHandler);
		}
		if (this._characterSelectedHandler) {
			eventBus.off(EVENTS.CHARACTER_SELECTED, this._characterSelectedHandler);
		}
		if (this._sourcesChangedHandler) {
			eventBus.off('sources:allowed-changed', this._sourcesChangedHandler);
		}
		if (this._levelUpCompleteHandler) {
			eventBus.off('LEVEL_UP_COMPLETE', this._levelUpCompleteHandler);
		}

		// Clean up all tracked DOM listeners
		this._cleanup.cleanup();
	}

	//-------------------------------------------------------------------------
	// Data Loading Methods
	//-------------------------------------------------------------------------

	async _loadSavedClassSelection() {
		console.log('[ClassCard] _loadSavedClassSelection called');
		try {
			// Populate class dropdown first
			await this._populateClassSelect();

			const character = AppState.getCurrentCharacter();
			console.log('[ClassCard] Current character:', character ? character.name : 'null');
			const primaryClass = character?.getPrimaryClass();
			console.log('[ClassCard] Primary class:', primaryClass);

			if (!primaryClass?.name) {
				console.log('[ClassCard] No primary class found, rendering tabs and returning');
				await this._renderClassTabsFromProgression();
				return; // No saved class to load
			}

			// Default to PHB if source is missing (legacy characters)
			const classSource = primaryClass.source || 'PHB';

			// Set the class selection if it exists in available options
			const classValue = `${primaryClass.name}_${classSource}`;
			console.log('[ClassCard] Setting class value:', classValue);

			if (this._cardView.hasClassOption(classValue)) {
				this._cardView.setSelectedClassValue(classValue);
				// Update UI from character data (skip unsaved event)
				await this._handleClassChange({ target: { value: classValue } }, true);

				// Get subclass from progression.classes[]
				const subclassName = primaryClass.subclass || null;
				console.log('[ClassCard] Subclass name:', subclassName);

				if (subclassName) {
					// Wait for subclass options to populate
					await new Promise((resolve) => setTimeout(resolve, 100));

					if (this._subclassView.hasSubclassOption(subclassName)) {
						this._subclassView.setSelectedSubclassValue(subclassName);
						// Optionally, update UI for subclass as well
						// await this._handleSubclassChange({ target: { value: subclassName } }, true);
					}
				}
			} else {
				console.warn(
					'ClassCard',
					`Saved class "${classValue}" not found in available options. Character might use a source that's not currently allowed.`,
				);
			}

			// Render multiclass tabs based on progression
			await this._renderClassTabsFromProgression();
		} catch (error) {
			console.error('ClassCard', 'Error loading saved class selection:', error);
		}
	}

	async _populateClassSelect() {
		try {
			const classes = this._classService.getAllClasses();
			if (!classes || classes.length === 0) {
				console.error('ClassCard', 'No classes available to populate dropdown');
				return;
			}

			// Filter classes by allowed sources (supports PHB variants)
			const filteredClasses = classes.filter((cls) =>
				sourceService.isSourceAllowed(cls.source),
			);

			if (filteredClasses.length === 0) {
				console.error(
					'ClassCard',
					'No classes available after source filtering',
				);
				return;
			}

			// Populate view
			this._cardView.populateClassSelect(filteredClasses);
		} catch (error) {
			console.error('ClassCard', 'Error populating class dropdown:', error);
		}
	}

	async _populateSubclassSelect(classData) {
		if (!classData) {
			this._subclassView.reset();
			return;
		}

		try {
			// Get character level
			const character = CharacterManager.getCurrentCharacter();
			const characterLevel = character?.getTotalLevel() || 1;

			// Get the level at which this class gains its subclass
			const subclassLevel = this._getSubclassLevel(classData);

			// Check if character is high enough level for subclass
			if (!subclassLevel || characterLevel < subclassLevel) {
				this._subclassView.resetWithMessage(
					`Available at level ${subclassLevel || '?'}`
				);
				return;
			}

			// Get subclasses from the service
			const subclasses = this._classService.getSubclasses(
				classData.name,
				classData.source,
			);

			if (!subclasses || subclasses.length === 0) {
				this._subclassView.reset();
				return;
			}

			// Filter subclasses by allowed sources
			const filteredSubclasses = subclasses.filter((sc) => {
				// Prefer explicit subclass source, then generic source, and only then classSource
				const subclassSource = sc.subclassSource || sc.source || sc.classSource;
				return sourceService.isSourceAllowed(subclassSource);
			});

			// Populate view
			this._subclassView.populateSubclassSelect(filteredSubclasses);
		} catch (error) {
			console.error(
				'ClassCard',
				'Error loading subclasses for dropdown:',
				error,
			);
		}
	}

	//-------------------------------------------------------------------------
	// Event Handlers
	//-------------------------------------------------------------------------

	async _handleClassChange(event) {
		try {
			const [className, source] = event.target.value.split('_');

			if (!className || !source) {
				this.resetClassDetails();
				await this._populateSubclassSelect(null);
				return;
			}
			const classData = this._classService.getClass(className, source);
			if (!classData) {
				console.error('ClassCard', `Class not found: ${className} (${source})`);
				return;
			}

			// Get fluff data for quick description
			const fluffData = this._classService.getClassFluff(
				classData.name,
				classData.source,
			);

			// Keep tab state aligned with the selected class
			this._activeClassTab = classData.name;
			await this._renderClassTabsFromProgression();

			// Update the UI with the selected class data
			await this._cardView.updateQuickDescription(classData, fluffData);
			await this.updateClassDetails(classData);
			await this._populateSubclassSelect(classData);

			// Update character data
			this._updateCharacterClass(classData);

			// Emit event to notify about character update (unsaved changes)
			eventBus.emit(EVENTS.CHARACTER_UPDATED, {
				character: CharacterManager.getCurrentCharacter(),
			});
		} catch (error) {
			console.error('ClassCard', 'Error handling class change:', error);
		}
	}

	async _handleSubclassChange(event) {
		try {
			const subclassName = event.target.value;
			const classValue = this._cardView.getSelectedClassValue();
			const [className, source] = classValue.split('_');

			if (!className || !source) {
				return;
			}

			const classData = this._classService.getClass(className, source);
			if (!classData) {
				console.error('ClassCard', `Class not found: ${className} (${source})`);
				return;
			}

			let subclassData = null;
			if (subclassName) {
				const subclasses = this._classService.getSubclasses(className, source);
				subclassData = subclasses.find((sc) => sc.name === subclassName);
			}

			// Update the UI with the subclass data
			await this.updateClassDetails(classData, subclassData);

			// Update character data
			this._updateCharacterClass(classData, subclassName);

			// Emit event to notify about character update (unsaved changes)
			eventBus.emit(EVENTS.CHARACTER_UPDATED, {
				character: CharacterManager.getCurrentCharacter(),
			});
		} catch (error) {
			console.error('ClassCard', 'Error handling subclass change:', error);
		}
	}

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
			await this._selectClassByName(this._activeClassTab, { triggerChange: false });
		}
	}

	async _handleLevelUpComplete() {
		try {
			console.log('[ClassCard]', 'Level up complete - refreshing class card');

			// Refresh the entire class selection to pick up new level and choices
			await this._loadSavedClassSelection();
		} catch (error) {
			console.error(
				'ClassCard',
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

		// Update class details (proficiencies, etc.)
		await this._detailsView.updateAllDetails(classData);

		// Update features separately
		await this._updateFeatures(classData, subclassData);
	}

	async _renderClassTabsFromProgression() {
		if (!this._classTabsWrapper || !this._classTabsList) return;

		const character = AppState.getCurrentCharacter();
		const classes = character?.progression?.classes || [];

		if (!classes.length || classes.length < 2) {
			this._classTabsWrapper.style.display = 'none';
			this._classTabsList.innerHTML = '';
			this._activeClassTab = classes[0]?.name || null;

			// Hide progression history note for single class
			const progressionNote = document.getElementById('progressionHistoryNote');
			if (progressionNote) {
				progressionNote.style.display = 'none';
			}
			return;
		}

		// Preserve current active tab if it still exists; otherwise use first class
		const availableNames = classes.map((c) => c.name);
		if (!this._activeClassTab || !availableNames.includes(this._activeClassTab)) {
			this._activeClassTab = classes[0].name;
		}

		const buttonsHtml = classes
			.map((cls) => {
				const isActive = cls.name === this._activeClassTab;
				const activeClass = isActive ? 'active' : '';
				return `<button type="button" class="nav-link ${activeClass}" data-class-name="${cls.name}">
					${cls.name} <span class="badge bg-secondary ms-1">Lv ${cls.levels}</span>
				</button>`;
			})
			.join('');

		this._classTabsList.innerHTML = buttonsHtml;
		this._classTabsWrapper.style.display = 'block';

		// Show progression history note for multiclass
		const progressionNote = document.getElementById('progressionHistoryNote');
		if (progressionNote) {
			progressionNote.style.display = 'block';
		}

		// Bind click handlers
		this._classTabsList.querySelectorAll('[data-class-name]').forEach((btn) => {
			btn.addEventListener('click', async () => {
				const name = btn.getAttribute('data-class-name');
				this._activeClassTab = name;

				// Update active state
				this._classTabsList.querySelectorAll('[data-class-name]').forEach((b) => {
					b.classList.toggle('active', b === btn);
				});

				await this._selectClassByName(name, { triggerChange: true });
			});
		});
	}

	async _selectClassByName(className, { triggerChange = true, skipTabUpdate = false } = {}) {
		if (!className) return;

		// Try to match existing class select option by name prefix
		const classSelect = this._cardView.getClassSelect();
		const match = Array.from(classSelect?.options || []).find((opt) =>
			opt.value.startsWith(`${className}_`),
		);

		if (match) {
			classSelect.value = match.value;
			if (triggerChange) {
				// Trigger normal flow (this will emit CHARACTER_UPDATED once)
				classSelect.dispatchEvent(new Event('change', { bubbles: true }));
			} else {
				// Update UI without emitting events
				const [clsName, source] = match.value.split('_');
				const classData = this._classService.getClass(clsName, source);
				if (classData) {
					const fluffData = this._classService.getClassFluff(classData.name, classData.source);
					await this._cardView.updateQuickDescription(classData, fluffData);
					await this.updateClassDetails(classData);
					await this._populateSubclassSelect(classData);
				}
			}
			return;
		}

		// Fallback: load class data directly by name
		const classData = this._classService.getClass(className);
		if (!classData) return;
		const fluffData = this._classService.getClassFluff(classData.name, classData.source);
		await this._cardView.updateQuickDescription(classData, fluffData);
		await this.updateClassDetails(classData);

		if (!skipTabUpdate) {
			await this._renderClassTabsFromProgression();
		}
	}

	async _updateFeatures(classData, subclassData = null) {
		const character = CharacterManager.getCurrentCharacter();
		const level = character?.getTotalLevel() || 1;

		// Get all class features up to the current level (cumulative)
		const classFeatures =
			this._classService.getClassFeatures(
				classData.name,
				level,
				classData.source,
			) || [];

		// Get all subclass features up to the current level if a subclass is selected
		let subclassFeatures = [];
		if (subclassData) {
			subclassFeatures =
				this._classService.getSubclassFeatures(
					classData.name,
					subclassData.shortName || subclassData.name,
					level,
					subclassData.source || subclassData.classSource,
				) || [];
		}

		// Combine and pass to view
		const allFeatures = [...classFeatures, ...subclassFeatures];
		await this._detailsView.updateFeatures(classData, allFeatures);

		// Update class choices section
		await this._updateClassChoices(classData, subclassData);
	}

	async _updateClassChoices(classData, subclassData = null) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character || !classData) {
			this._hideClassChoices();
			this._hideSubclassNotification();
			this._hideASISection();
			this._hideSpellNotification();
			return;
		}

		const level = character?.getTotalLevel() || 1;
		const className = classData.name;

		// Check and render subclass notification
		this._renderSubclassNotification(classData, className, level);

		// Check and render ASI section
		this._renderASISection(className, level);

		// Get class choices at current level
		const choices = await this._getClassChoicesAtLevel(className, level, subclassData);

		// Check and render spell notification
		this._renderSpellNotification(className);

		// Show container if any section has content
		const hasChoices = choices.length > 0;
		const hasSubclassNotification = document.getElementById('subclassChoiceSection')?.style.display !== 'none';
		const hasASISection = document.getElementById('asiChoiceSection')?.style.display !== 'none';
		const hasSpellNotification = document.getElementById('spellNotificationSection')?.style.display !== 'none';

		if (hasChoices || hasSubclassNotification || hasASISection || hasSpellNotification) {
			this._showClassChoices();
		} else {
			this._hideClassChoices();
		}

		if (hasChoices) {
			await this._renderClassChoices(className, choices);
		}
	}

	_renderSubclassNotification(classData, className, level) {
		const character = CharacterManager.getCurrentCharacter();
		const progressionClass = character.progression?.classes?.find(c => c.name === className);
		
		// Check if subclass is already selected
		if (progressionClass?.subclass) {
			this._hideSubclassNotification();
			return;
		}

		// Get subclass level requirement
		const subclassLevel = this._getSubclassLevel(classData) || 3;
		
		if (level >= subclassLevel) {
			const container = document.getElementById('subclassChoiceSection');
			if (!container) return;

			container.innerHTML = `
				<div class="alert alert-warning mb-3">
					<div class="d-flex justify-content-between align-items-center">
						<div>
							<i class="fas fa-exclamation-triangle me-2"></i>
							<strong>Subclass Required</strong>
							<p class="mb-0 mt-1">You've reached level ${subclassLevel}. Please select a subclass from the dropdown above.</p>
						</div>
					</div>
				</div>
			`;
			container.style.display = 'block';
		} else {
			this._hideSubclassNotification();
		}
	}

	_renderASISection(className) {
		const character = CharacterManager.getCurrentCharacter();
		
		// Get ASI levels for this class
		const asiLevels = levelUpService._getASILevelsForClass(className);
		const progressionClass = character.progression?.classes?.find(c => c.name === className);
		const classLevel = progressionClass?.levels || 0;
		
		// Check if this class level has an ASI
		if (!asiLevels.includes(classLevel)) {
			this._hideASISection();
			return;
		}

		// Check if ASI was already used at this level
		const levelUps = character.progression?.levelUps || [];
		const asiUsed = levelUps.some(lu => {
			const isThisLevel = lu.toLevel === classLevel;
			const hasChanges = (lu.changedAbilities && Object.keys(lu.changedAbilities).length > 0) ||
			                 (lu.appliedFeats && lu.appliedFeats.length > 0);
			return isThisLevel && hasChanges;
		});

		if (asiUsed) {
			this._hideASISection();
			return;
		}

		// Render ASI choice section
		const container = document.getElementById('asiChoiceSection');
		if (!container) return;

		container.innerHTML = `
			<div class="card mb-3">
				<div class="card-header">
					<h6 class="mb-0"><i class="fas fa-arrow-up"></i> Ability Score Improvement</h6>
					<small class="text-muted">Level ${classLevel}</small>
				</div>
				<div class="card-body">
					<p class="mb-3">You can increase one ability score by 2, or two ability scores by 1 each. Alternatively, you can choose a feat instead.</p>
					
					<div class="form-check mb-2">
						<input class="form-check-input" type="radio" name="asiChoice_${classLevel}" id="asiStandard_${classLevel}" value="standard">
						<label class="form-check-label" for="asiStandard_${classLevel}">
							<strong>Standard ASI</strong> - Increase ability scores
						</label>
					</div>
					
					<div id="asiAbilitySelectors_${classLevel}" class="ms-4 mb-3" style="display: none;">
						<div class="row g-2">
							<div class="col-md-6">
								<label class="form-label small">Ability 1</label>
								<select class="form-select form-select-sm" id="asiAbility1_${classLevel}">
									<option value="">Select ability...</option>
									<option value="str">Strength</option>
									<option value="dex">Dexterity</option>
									<option value="con">Constitution</option>
									<option value="int">Intelligence</option>
									<option value="wis">Wisdom</option>
									<option value="cha">Charisma</option>
								</select>
							</div>
							<div class="col-md-6">
								<label class="form-label small">Bonus</label>
								<select class="form-select form-select-sm" id="asiBonus1_${classLevel}">
									<option value="2">+2</option>
									<option value="1">+1</option>
								</select>
							</div>
						</div>
						<div class="row g-2 mt-2" id="asiSecondAbility_${classLevel}" style="display: none;">
							<div class="col-md-6">
								<label class="form-label small">Ability 2</label>
								<select class="form-select form-select-sm" id="asiAbility2_${classLevel}">
									<option value="">Select ability...</option>
									<option value="str">Strength</option>
									<option value="dex">Dexterity</option>
									<option value="con">Constitution</option>
									<option value="int">Intelligence</option>
									<option value="wis">Wisdom</option>
									<option value="cha">Charisma</option>
								</select>
							</div>
							<div class="col-md-6">
								<label class="form-label small">Bonus</label>
								<input type="text" class="form-control form-control-sm" value="+1" disabled>
							</div>
						</div>
						<button class="btn btn-primary btn-sm mt-3" id="applyASI_${classLevel}">
							Apply ASI
						</button>
					</div>
					
					<div class="form-check">
						<input class="form-check-input" type="radio" name="asiChoice_${classLevel}" id="asiFeat_${classLevel}" value="feat">
						<label class="form-check-label" for="asiFeat_${classLevel}">
							<strong>Choose a Feat</strong> - Browse and select a feat
						</label>
					</div>
					
					<div id="asiFeatButton_${classLevel}" class="ms-4 mt-2" style="display: none;">
						<button class="btn btn-secondary btn-sm" id="browseFeat_${classLevel}">
							<i class="fas fa-arrow-down"></i> Browse Feats Below
						</button>
					</div>
				</div>
			</div>
		`;
		container.style.display = 'block';

		// Attach event listeners
		this._attachASISectionListeners(classLevel);
	}

	_attachASISectionListeners(classLevel) {
		// Standard ASI radio
		const standardRadio = document.getElementById(`asiStandard_${classLevel}`);
		const asiAbilitySelectors = document.getElementById(`asiAbilitySelectors_${classLevel}`);
		
		if (standardRadio && asiAbilitySelectors) {
			this._cleanup.on(standardRadio, 'change', () => {
				asiAbilitySelectors.style.display = standardRadio.checked ? 'block' : 'none';
				document.getElementById(`asiFeatButton_${classLevel}`).style.display = 'none';
			});
		}

		// Feat radio
		const featRadio = document.getElementById(`asiFeat_${classLevel}`);
		const asiFeatButton = document.getElementById(`asiFeatButton_${classLevel}`);
		
		if (featRadio && asiFeatButton) {
			this._cleanup.on(featRadio, 'change', () => {
				asiFeatButton.style.display = featRadio.checked ? 'block' : 'none';
				if (asiAbilitySelectors) {
					asiAbilitySelectors.style.display = 'none';
				}
			});
		}

		// Bonus dropdown changes
		const bonus1Select = document.getElementById(`asiBonus1_${classLevel}`);
		const secondAbilityRow = document.getElementById(`asiSecondAbility_${classLevel}`);
		
		if (bonus1Select && secondAbilityRow) {
			this._cleanup.on(bonus1Select, 'change', () => {
				secondAbilityRow.style.display = bonus1Select.value === '1' ? 'block' : 'none';
			});
		}

		// Apply ASI button
		const applyButton = document.getElementById(`applyASI_${classLevel}`);
		if (applyButton) {
			this._cleanup.on(applyButton, 'click', () => {
				this._handleASIApplication(classLevel);
			});
		}

		// Browse feats button
		const browseFeatButton = document.getElementById(`browseFeat_${classLevel}`);
		if (browseFeatButton) {
			this._cleanup.on(browseFeatButton, 'click', () => {
				// Scroll to feat section
				const featSection = document.getElementById('build-feats');
				if (featSection) {
					featSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			});
		}
	}

	_handleASIApplication(classLevel) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const ability1 = document.getElementById(`asiAbility1_${classLevel}`)?.value;
		const bonus1 = parseInt(document.getElementById(`asiBonus1_${classLevel}`)?.value || '2', 10);
		
		if (!ability1) {
			alert('Please select an ability to improve.');
			return;
		}

		const changes = {};
		changes[ability1] = bonus1;

		// Check for second ability if +1/+1
		if (bonus1 === 1) {
			const ability2 = document.getElementById(`asiAbility2_${classLevel}`)?.value;
			if (!ability2) {
				alert('Please select a second ability for +1 bonus.');
				return;
			}
			if (ability2 === ability1) {
				alert('Please select two different abilities.');
				return;
			}
			changes[ability2] = 1;
		}

		// Apply changes to character
		for (const [ability, bonus] of Object.entries(changes)) {
			const currentScore = character.getAbilityScore(ability) || 10;
			character.setAbilityScore(ability, currentScore + bonus);
		}

		// Record in progression history
		levelUpService.recordLevelUp(character, classLevel - 1, classLevel, {
			changedAbilities: changes,
			appliedFeats: [],
			appliedFeatures: [],
		});

		// Hide ASI section and notify
		this._hideASISection();
		eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
	}

	_renderSpellNotification(className) {
		const classData = this._classService.getClass(className);
		
		// Check if class is a spellcaster
		if (!classData?.spellcastingAbility) {
			this._hideSpellNotification();
			return;
		}

		// Check if there are pending spell choices
		// This would need SpellSelectionService.getPendingSpellChoices() to be implemented
		// For now, show a basic notification
		const container = document.getElementById('spellNotificationSection');
		if (!container) return;

		container.innerHTML = `
			<div class="alert alert-info mb-3">
				<div class="d-flex justify-content-between align-items-center">
					<div>
						<i class="fas fa-wand-sparkles me-2"></i>
						<strong>Spell Selection Available</strong>
						<p class="mb-0 mt-1">Visit the Spells page to select your spells for ${className}.</p>
					</div>
					<button class="btn btn-primary btn-sm" id="goToSpells">
						Go to Spells <i class="fas fa-arrow-right"></i>
					</button>
				</div>
			</div>
		`;
		container.style.display = 'block';

		// Attach listener for "Go to Spells" button
		const goToSpellsBtn = document.getElementById('goToSpells');
		if (goToSpellsBtn) {
			this._cleanup.on(goToSpellsBtn, 'click', () => {
				// Navigate to spells page
				const { NavigationController } = require('../../../app/NavigationController.js');
				NavigationController.getInstance().navigate('spells');
			});
		}
	}

	_hideSubclassNotification() {
		const container = document.getElementById('subclassChoiceSection');
		if (container) {
			container.style.display = 'none';
			container.innerHTML = '';
		}
	}

	_hideASISection() {
		const container = document.getElementById('asiChoiceSection');
		if (container) {
			container.style.display = 'none';
			container.innerHTML = '';
		}
	}

	_hideSpellNotification() {
		const container = document.getElementById('spellNotificationSection');
		if (container) {
			container.style.display = 'none';
			container.innerHTML = '';
		}
	}

	async _getClassChoicesAtLevel(className, level, subclassData = null) {
		const choices = [];

		// Check for optional feature progressions (subclass is handled by main dropdown)
		const classData = this._classService.getClass(className);
		if (!classData) return choices;

		// Check for optional feature progressions
		const progressions = classData.optionalfeatureProgression || [];
		for (const progression of progressions) {
			const count = this._getCountAtLevel(progression.progression, level);
			if (count > 0) {
				const featureTypes = progression.featureType || [];
				const options = optionalFeatureService.getFeaturesByType(featureTypes)
					.filter(opt => sourceService.isSourceAllowed(opt.source))
					.map(opt => ({
						id: `${opt.name}_${opt.source}`,
						name: opt.name,
						source: opt.source,
						description: this._getFeatureDescription(opt),
						entries: opt.entries
					}));

				if (options.length > 0) {
					choices.push({
						id: `${className.toLowerCase()}_${progression.name.toLowerCase().replace(/\s+/g, '_')}_${level}`,
						name: progression.name,
						type: this._mapFeatureType(featureTypes[0]),
						options,
						required: true,
						count,
						level
					});
				}
			}
		}

		// Check subclass optional feature progressions
		if (subclassData?.optionalfeatureProgression) {
			for (const progression of subclassData.optionalfeatureProgression) {
				const count = this._getCountAtLevel(progression.progression, level);
				if (count > 0) {
					const featureTypes = progression.featureType || [];
					const options = optionalFeatureService.getFeaturesByType(featureTypes)
						.filter(opt => sourceService.isSourceAllowed(opt.source))
						.map(opt => ({
							id: `${opt.name}_${opt.source}`,
							name: opt.name,
							source: opt.source,
							description: this._getFeatureDescription(opt),
							entries: opt.entries
						}));

					if (options.length > 0) {
						choices.push({
							id: `${className.toLowerCase()}_${subclassData.shortName.toLowerCase()}_${progression.name.toLowerCase().replace(/\s+/g, '_')}_${level}`,
							name: progression.name,
							type: this._mapFeatureType(featureTypes[0]),
							options,
							required: true,
							count,
							level
						});
					}
				}
			}
		}

		return choices;
	}

	_getSubclassLevel(classData) {
		if (!classData?.classFeatures) return null;

		// Find the first classFeature with gainSubclassFeature flag
		for (const feature of classData.classFeatures) {
			if (feature.gainSubclassFeature === true) {
				// Parse level from classFeature string format: "Feature Name|ClassName||Level"
				const parts = feature.classFeature.split('|');
				const level = parseInt(parts[parts.length - 1], 10);
				return Number.isNaN(level) ? null : level;
			}
		}

		return null;
	}

	_getCountAtLevel(progression, level) {
		if (Array.isArray(progression)) {
			return progression[level - 1] || 0;
		}
		if (typeof progression === 'object') {
			return progression[level.toString()] || 0;
		}
		return 0;
	}

	_mapFeatureType(featureTypeCode) {
		const typeMap = {
			'EI': 'invocation',
			'MM': 'metamagic',
			'MV:B': 'maneuver',
			'FS:F': 'fighting-style',
			'FS:R': 'fighting-style',
			'FS:P': 'fighting-style',
			'PB': 'patron'
		};
		return typeMap[featureTypeCode] || 'other';
	}

	_getFeatureDescription(feature) {
		if (!feature.entries) return '';
		const firstEntry = feature.entries.find(e => typeof e === 'string');
		if (firstEntry) {
			return `${firstEntry.replace(/\{@[^}]+\}/g, '').substring(0, 150)}...`;
		}
		return '';
	}

	async _renderClassChoices(className, choices) {
		const container = document.getElementById('classChoicesContent');
		if (!container) return;

		let html = '';

		for (const choice of choices) {
			html += this._renderFeatureChoice(choice);
		}

		container.innerHTML = html;

		// Attach listeners
		this._attachClassChoiceListeners(container, className);
	}

	_renderFeatureChoice(choice) {
		const character = CharacterManager.getCurrentCharacter();
		const primaryClass = character?.getPrimaryClass();
		const className = primaryClass?.name;

		// Get current selections from progression history
		const currentSelections = progressionHistoryService.getChoices(
			character,
			className,
			choice.level
		)?.[choice.type]?.selected || [];

		const isMultiSelect = (choice.count || 1) > 1;
		let selectedDisplay = 'None selected';

		if (currentSelections.length > 0) {
			const selectedNames = currentSelections.map(selId => {
				const opt = choice.options.find(o => o.id === selId || o.name === selId);
				return opt ? opt.name : selId;
			});
			selectedDisplay = selectedNames.join(', ');
		}

		return `
			<div class="card mb-3" data-choice-card="${choice.id}">
				<div class="card-header d-flex justify-content-between align-items-center">
					<div>
						<h6 class="mb-0">${this._getFeatureIcon(choice.type)} ${choice.name}</h6>
						<small class="text-muted">Level ${choice.level}</small>
					</div>
					${isMultiSelect ? `<span class="badge" style="background-color: var(--accent-color);" data-selection-count="${choice.id}">${currentSelections.length}/${choice.count}</span>` : ''}
				</div>
				<div class="card-body">
					<div class="d-flex justify-content-between align-items-center">
						<div class="flex-grow-1">
							<div class="text-muted small" data-selected-display="${choice.id}">
								<strong>Selected:</strong> ${selectedDisplay}
							</div>
						</div>
						<button 
							class="btn btn-primary btn-sm ms-2" 
							data-feature-select-btn="${choice.id}"
							data-feature-type="${choice.type}"
							data-feature-level="${choice.level}"
							data-is-multi="${isMultiSelect}"
							data-max-count="${choice.count || 1}">
							<i class="fas fa-list"></i> Choose
						</button>
					</div>
				</div>
			</div>
		`;
	}

	_getFeatureIcon(type) {
		const icons = {
			'invocation': '<i class="fas fa-sparkles"></i>',
			'metamagic': '<i class="fas fa-wand-sparkles"></i>',
			'maneuver': '<i class="fas fa-fist-raised"></i>',
			'fighting-style': '<i class="fas fa-shield-alt"></i>',
			'patron': '<i class="fas fa-hand-sparkles"></i>',
			'other': '<i class="fas fa-star"></i>'
		};
		return icons[type] || icons.other;
	}

	_attachClassChoiceListeners(container, className) {
		// Feature selection buttons
		const featureButtons = container.querySelectorAll('[data-feature-select-btn]');
		featureButtons.forEach(button => {
			this._cleanup.on(button, 'click', async () => {
				const featureId = button.dataset.featureSelectBtn;
				const featureType = button.dataset.featureType;
				const featureLevel = parseInt(button.dataset.featureLevel, 10);
				const isMulti = button.dataset.isMulti === 'true';
				const maxCount = parseInt(button.dataset.maxCount, 10) || 1;

				await this._handleFeatureSelection(className, featureType, featureLevel, featureId, isMulti, maxCount);
			});
		});
	}

	async _handleFeatureSelection(className, featureType, level, featureId, isMulti, maxCount) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Get current selections
		const currentSelections = progressionHistoryService.getChoices(
			character,
			className,
			level
		)?.[featureType]?.selected || [];

		// Get available options based on feature type
		const featureTypeMap = {
			'invocation': ['EI'],
			'metamagic': ['MM'],
			'maneuver': ['MV:B'],
			'fighting-style': ['FS:F', 'FS:R', 'FS:P'],
			'patron': ['PB']
		};

		const featureTypeCodes = featureTypeMap[featureType] || [];
		const availableFeatures = optionalFeatureService.getFeaturesByType(featureTypeCodes)
			.filter(opt => sourceService.isSourceAllowed(opt.source));

		// Create a minimal session-like object for the selector
		const mockSession = {
			originalCharacter: character,
			stagedChanges: character,
			stepData: {
				selectedFeatures: {}
			}
		};

		// Show feature selector
		const selector = new LevelUpFeatureSelector(
			mockSession,
			this,
			className,
			featureTypeCodes[0] || featureType,
			level,
			featureId
		);

		// Map to selector format
		const mappedFeatures = availableFeatures.map(opt => ({
			id: `${opt.name}_${opt.source}`,
			name: opt.name,
			source: opt.source,
			description: this._getFeatureDescription(opt),
			entries: opt.entries,
			prerequisite: opt.prerequisite
		}));

		// Map current selections to feature objects
		const selectedFeatures = currentSelections.map(selId => {
			const opt = availableFeatures.find(f =>
				`${f.name}_${f.source}` === selId || f.name === selId
			);
			return opt ? {
				id: `${opt.name}_${opt.source}`,
				name: opt.name,
				source: opt.source
			} : { id: selId, name: selId };
		}).filter(Boolean);

		await selector.show(mappedFeatures, selectedFeatures, isMulti, maxCount);
	}

	updateFeatureSelection(className, featureType, level, selectedNames) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Save selections to progression history
		const choices = {};
		choices[featureType] = {
			selected: selectedNames,
			count: selectedNames.length
		};

		progressionHistoryService.recordChoices(character, className, level, choices);

		// Update display
		this._updateFeatureDisplay(className);

		// Emit event to notify about character update
		eventBus.emit(EVENTS.CHARACTER_UPDATED, {
			character: CharacterManager.getCurrentCharacter(),
		});
	}

	async _updateFeatureDisplay(className) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const classData = this._classService.getClass(className);
		if (!classData) return;

		// Get subclass from progression.classes[]
		const progressionClass = character.progression?.classes?.find(c => c.name === className);
		const subclassName = progressionClass?.subclass;
		let subclassData = null;
		if (subclassName) {
			const subclasses = this._classService.getSubclasses(className, classData.source);
			subclassData = subclasses.find(sc => sc.name === subclassName);
		}

		// Refresh the class choices section
		await this._updateClassChoices(classData, subclassData);
	}

	_showClassChoices() {
		const container = document.getElementById('classChoicesContainer');
		if (container) {
			container.style.display = 'block';
		}
	}

	_hideClassChoices() {
		const container = document.getElementById('classChoicesContainer');
		if (container) {
			container.style.display = 'none';
		}
	}

	resetClassDetails() {
		this._cardView.resetQuickDescription();
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
		const progressionClass = character.progression?.classes?.find(c => c.name === classData?.name);
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

			// Notify UI to clear optional proficiencies from class
			document.dispatchEvent(
				new CustomEvent('proficienciesRemoved', {
					detail: { source: 'Class' },
				}),
			);

			// Initialize progression to track classes (needed for multiclass)
			levelUpService.initializeProgression(character);

			if (classData) {
				// Update or add class in progression.classes[] (no legacy character.class field)

				// Add proficiencies
				this._updateProficiencies(classData);

				// Force a refresh after a short delay to ensure everything is updated
				setTimeout(() => {
					document.dispatchEvent(
						new CustomEvent('proficiencyChanged', {
							detail: { triggerCleanup: true, forcedRefresh: true },
						}),
					);
				}, 100);
			}

			// Trigger an event to update the UI
			document.dispatchEvent(
				new CustomEvent('classChanged', {
					detail: { classData, subclass: subclassName },
				}),
			);
			document.dispatchEvent(new CustomEvent('characterChanged'));
		}
	}

	_updateProficiencies(classData) {
		console.log('[ClassCard] _updateProficiencies() called');

		const character = CharacterManager.getCurrentCharacter();
		if (!character || !classData) return;

		console.log('[ClassCard] tools.class BEFORE reset:',
			JSON.stringify(character.optionalProficiencies?.tools?.class || {}));

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

		console.log('[ClassCard] tools.class AFTER reset:',
			JSON.stringify(character.optionalProficiencies?.tools?.class || {}));

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
				DataNormalizer.normalizeForLookup(skill),
			);
			character.optionalProficiencies.skills.class.selected =
				previousClassSkills.filter((skill) =>
					normalizedSkills.includes(
						DataNormalizer.normalizeForLookup(skill),
					),
				);
		}

		// Update combined options for all proficiency types
		this._updateCombinedProficiencyOptions(character);

		// Notify UI to update proficiencies
		document.dispatchEvent(new CustomEvent('proficiencyChanged'));
		document.dispatchEvent(new CustomEvent('characterChanged'));
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
		console.log('[ClassCard] _processClassToolProficiencies() called');

		const toolProfs = classData?.startingProficiencies?.toolProficiencies;
		if (!toolProfs || !Array.isArray(toolProfs)) {
			console.log('[ClassCard] No toolProficiencies found, returning');
			return;
		}

		// Accumulate all choices across multiple objects
		let maxAllowed = 0;
		const allOptions = [];

		for (const profObj of toolProfs) {
			// Handle fixed tool proficiencies (e.g., Druid with "herbalism kit": true)
			for (const [tool, hasProf] of Object.entries(profObj)) {
				if (hasProf === true && tool !== 'any' && tool !== 'anyMusicalInstrument' && tool !== 'anyArtisansTool' && tool !== 'choose') {
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
		console.log('[ClassCard] maxAllowed:', maxAllowed, 'allOptions:', allOptions);

		if (maxAllowed > 0) {
			character.optionalProficiencies.tools.class.allowed = maxAllowed;
			character.optionalProficiencies.tools.class.options = allOptions;
			character.optionalProficiencies.tools.class.selected = [];

			console.log('[ClassCard] Set tools.class:', JSON.stringify(character.optionalProficiencies.tools.class));

			// Special case: if ONLY "Musical instrument" is offered (like Bard),
			// auto-populate the selected array so it shows as granted/default
			if (allOptions.length === 1 && allOptions[0] === 'Musical instrument') {
				for (let i = 0; i < maxAllowed; i++) {
					character.optionalProficiencies.tools.class.selected.push(
						'Musical instrument',
					);
				}
				console.log('[ClassCard] Bard detected - populated selected array:', character.optionalProficiencies.tools.class.selected);
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

//=============================================================================
// Class Details View - Detailed class information display
//=============================================================================

class ClassDetailsView {
	constructor() {
		this._classDetails = document.getElementById('classDetails');
	}

	//-------------------------------------------------------------------------
	// Public API
	//-------------------------------------------------------------------------

	async updateAllDetails(classData) {
		if (!classData) {
			this.resetAllDetails();
			return;
		}

		// Update individual sections
		this.updateHitDie(classData);
		this.updateSkillProficiencies(classData);
		this.updateSavingThrows(classData);
		this.updateArmorProficiencies(classData);
		this.updateWeaponProficiencies(classData);
		this.updateToolProficiencies(classData);

		// Process the entire details container at once to resolve all reference tags
		await textProcessor.processElement(this._classDetails);
	}

	resetAllDetails() {
		const detailSections =
			this._classDetails.querySelectorAll('.detail-section');
		for (const section of detailSections) {
			const list = section.querySelector('ul');
			const paragraph = section.querySelector('p');

			if (list) {
				list.innerHTML = '<li class="placeholder-text">—</li>';
			}

			if (paragraph) {
				paragraph.textContent = '—';
				paragraph.classList.add('placeholder-text');
			}
		}

		// Reset features section
		const featuresSection =
			this._classDetails.querySelector('.features-section');
		if (featuresSection) {
			featuresSection.innerHTML = `
                <h6>Features</h6>
                <div class="features-grid">
                    <ul class="mb-0">
                        <li class="placeholder-text">—</li>
                    </ul>
                </div>
            `;
		}
	}

	//-------------------------------------------------------------------------
	// Hit Die Section
	//-------------------------------------------------------------------------

	updateHitDie(classData) {
		const hitDieSection = this._classDetails.querySelector(
			'.detail-section:nth-child(1) ul',
		);
		if (hitDieSection) {
			hitDieSection.innerHTML = '';
			const li = document.createElement('li');
			li.className = 'text-content';
			const hitDieText = this._formatHitDie(classData);
			li.textContent = hitDieText;
			hitDieSection.appendChild(li);
		}
	}

	_formatHitDie(classData) {
		if (!classData?.hd) return 'Unknown';
		const faces = classData.hd.faces || classData.hd;
		return `1d${faces}`;
	}

	//-------------------------------------------------------------------------
	// Skill Proficiencies Section
	//-------------------------------------------------------------------------

	updateSkillProficiencies(classData) {
		const skillProficienciesSection = this._classDetails.querySelector(
			'.detail-section:nth-child(2)',
		);
		if (!skillProficienciesSection) return;

		const skillList = skillProficienciesSection.querySelector('ul');
		if (!skillList) return;

		// Remove any existing choose header
		const existingChooseHeader =
			skillProficienciesSection.querySelector('.choose-text');
		if (existingChooseHeader) {
			existingChooseHeader.remove();
		}

		skillList.innerHTML = '';
		skillList.className = ''; // Reset classes

		if (classData) {
			const formattedString = this._formatSkillProficiencies(classData);
			const hasChoices = formattedString.includes('Choose');

			if (hasChoices) {
				// Check for "any skills" format first
				if (formattedString.includes('Choose any')) {
					const anySkillPattern = /(Choose any \d+ skills?)/;
					const anyMatches = formattedString.match(anySkillPattern);

					if (anyMatches && anyMatches.length >= 1) {
						const li = document.createElement('li');
						li.className = 'text-content';
						li.textContent = anyMatches[1];
						skillList.appendChild(li);
					}
				} else {
					// For "Choose X from Y" format, split into header and skills list
					const choosePattern = /(Choose \d+ from:)\s+(.*)/;
					const matches = formattedString.match(choosePattern);

					if (matches && matches.length >= 3) {
						const chooseText = matches[1]; // "Choose X from:"
						const skillsText = matches[2]; // The list of skills

						// Add the "Choose X from:" header
						const chooseHeader = document.createElement('div');
						chooseHeader.className = 'choose-text';
						chooseHeader.textContent = chooseText;
						skillProficienciesSection.insertBefore(chooseHeader, skillList);

						// Add the skills list, title-cased
						const skills = skillsText.split(', ').map(toTitleCase);

						// Apply multi-column if more than 3 skills
						if (skills.length > 3) {
							skillList.className = 'multi-column-list';
							if (skills.length > 6) {
								skillList.classList.add('many-items');
							}
						}

						for (const skill of skills) {
							const li = document.createElement('li');
							li.className = 'text-content';
							li.textContent = skill;
							skillList.appendChild(li);
						}
					} else {
						// Fallback for other formats, title-cased
						const li = document.createElement('li');
						li.className = 'text-content';
						li.textContent = toTitleCase(formattedString);
						skillList.appendChild(li);
					}
				}
			} else {
				// For simple list format
				const skills = formattedString.split(', ');

				// Apply multi-column if more than 3 skills
				if (skills.length > 3) {
					skillList.className = 'multi-column-list';
					if (skills.length > 6) {
						skillList.classList.add('many-items');
					}
				}

				for (const skill of skills) {
					const li = document.createElement('li');
					li.className = 'text-content';
					li.textContent = skill;
					skillList.appendChild(li);
				}
			}
		}
	}

	_formatSkillProficiencies(classData) {
		if (!classData?.startingProficiencies?.skills) return 'None';

		const skills = classData.startingProficiencies.skills;
		const parts = [];

		for (const skillEntry of skills) {
			if (skillEntry.choose) {
				const count = skillEntry.choose.count || 1;
				const from = skillEntry.choose.from || [];

				if (from.length === 0 || skillEntry.choose.fromFilter) {
					// Any skills
					parts.push(`Choose any ${count} skill${count > 1 ? 's' : ''}`);
				} else {
					// Specific list - use skills as-is from JSON
					parts.push(`Choose ${count} from: ${from.join(', ')}`);
				}
			} else {
				// Fixed proficiencies - use skills as-is from JSON
				parts.push(...Object.keys(skillEntry));
			}
		}

		return parts.join('; ') || 'None';
	}

	//-------------------------------------------------------------------------
	// Saving Throws Section
	//-------------------------------------------------------------------------

	updateSavingThrows(classData) {
		const savingThrowsSection = this._classDetails.querySelector(
			'.detail-section:nth-child(3) ul',
		);
		if (savingThrowsSection) {
			savingThrowsSection.innerHTML = '';

			const savingThrows = this._formatSavingThrows(classData);
			if (savingThrows && savingThrows.length > 0) {
				for (const save of savingThrows) {
					const li = document.createElement('li');
					li.className = 'text-content';
					li.textContent = save;
					savingThrowsSection.appendChild(li);
				}
			} else {
				const li = document.createElement('li');
				li.textContent = '—';
				savingThrowsSection.appendChild(li);
			}
		}
	}

	_formatSavingThrows(classData) {
		if (!classData?.proficiency) return [];
		return classData.proficiency.map((prof) => attAbvToFull(prof) || prof);
	}

	//-------------------------------------------------------------------------
	// Armor Proficiencies Section
	//-------------------------------------------------------------------------

	updateArmorProficiencies(classData) {
		const armorSection = this._classDetails.querySelector(
			'.detail-section:nth-child(4) ul',
		);
		if (armorSection) {
			armorSection.innerHTML = '';
			armorSection.className = ''; // Reset classes

			const armorProficiencies = this._formatArmorProficiencies(classData);
			if (armorProficiencies && armorProficiencies.length > 0) {
				// Apply multi-column if more than 3 proficiencies
				if (armorProficiencies.length > 3) {
					armorSection.className = 'multi-column-list';
					if (armorProficiencies.length > 6) {
						armorSection.classList.add('many-items');
					}
				}

				for (const armor of armorProficiencies) {
					const li = document.createElement('li');
					li.className = 'text-content';
					const armorStr = typeof armor === 'string' ? armor : String(armor);
					li.textContent = armorStr;
					armorSection.appendChild(li);
				}
			} else {
				const li = document.createElement('li');
				li.textContent = '—';
				armorSection.appendChild(li);
			}
		}
	}

	_formatArmorProficiencies(classData) {
		if (!classData?.startingProficiencies?.armor) return [];

		const armorMap = {
			light: 'Light Armor',
			medium: 'Medium Armor',
			heavy: 'Heavy Armor',
			shield: 'Shields',
		};

		return classData.startingProficiencies.armor.map((armor) => {
			if (armorMap[armor]) return armorMap[armor];
			// Return armor as-is to preserve tags
			return armor;
		});
	}

	//-------------------------------------------------------------------------
	// Weapon Proficiencies Section
	//-------------------------------------------------------------------------

	updateWeaponProficiencies(classData) {
		const weaponSection = this._classDetails.querySelector(
			'.detail-section:nth-child(5) ul',
		);
		if (weaponSection) {
			weaponSection.innerHTML = '';
			weaponSection.className = ''; // Reset classes

			const weaponProficiencies = this._formatWeaponProficiencies(classData);
			if (weaponProficiencies && weaponProficiencies.length > 0) {
				// Apply multi-column if more than 3 proficiencies
				if (weaponProficiencies.length > 3) {
					weaponSection.className = 'multi-column-list';
					if (weaponProficiencies.length > 6) {
						weaponSection.classList.add('many-items');
					}
				}

				for (const weapon of weaponProficiencies) {
					const li = document.createElement('li');
					li.className = 'text-content';
					const weaponStr =
						typeof weapon === 'string' ? weapon : String(weapon);
					li.textContent = toTitleCase(weaponStr);
					weaponSection.appendChild(li);
				}
			} else {
				const li = document.createElement('li');
				li.textContent = '—';
				weaponSection.appendChild(li);
			}
		}
	}

	_formatWeaponProficiencies(classData) {
		if (!classData?.startingProficiencies?.weapons) return [];

		const weaponMap = {
			simple: 'Simple Weapons',
			martial: 'Martial Weapons',
		};

		return classData.startingProficiencies.weapons.map((weapon) => {
			if (weaponMap[weapon]) return weaponMap[weapon];
			// Return weapon as-is to preserve tags like {@item dagger|phb|daggers}
			return weapon;
		});
	}

	//-------------------------------------------------------------------------
	// Tool Proficiencies Section
	//-------------------------------------------------------------------------

	updateToolProficiencies(classData) {
		const toolSection = this._classDetails.querySelector(
			'.detail-section:nth-child(6) ul',
		);
		if (toolSection) {
			toolSection.innerHTML = '';
			toolSection.className = ''; // Reset classes

			const toolProficiencies = this._formatToolProficiencies(classData);
			if (toolProficiencies && toolProficiencies.length > 0) {
				// Apply multi-column if more than 3 proficiencies
				if (toolProficiencies.length > 3) {
					toolSection.className = 'multi-column-list';
					if (toolProficiencies.length > 6) {
						toolSection.classList.add('many-items');
					}
				}

				for (const tool of toolProficiencies) {
					const li = document.createElement('li');
					li.className = 'text-content';
					const toolStr = typeof tool === 'string' ? tool : String(tool);
					li.textContent = toSentenceCase(toolStr);
					toolSection.appendChild(li);
				}
			} else {
				const li = document.createElement('li');
				li.textContent = '—';
				toolSection.appendChild(li);
			}
		}
	}

	_formatToolProficiencies(classData) {
		if (!classData?.startingProficiencies?.tools) return [];

		const tools = [];
		for (const toolEntry of classData.startingProficiencies.tools) {
			if (typeof toolEntry === 'string') {
				// Return tool as-is to preserve tags
				tools.push(toolEntry);
			} else if (toolEntry.choose) {
				// Choice of tools
				const count = toolEntry.choose.count || 1;
				tools.push(`Choose ${count} tool${count > 1 ? 's' : ''}`);
			} else {
				// Object with tool types - use tool names as-is from JSON
				for (const [key, value] of Object.entries(toolEntry)) {
					if (value === true) {
						tools.push(key);
					}
				}
			}
		}

		return tools;
	}

	//-------------------------------------------------------------------------
	// Features Section
	//-------------------------------------------------------------------------

	async updateFeatures(classData, allFeatures) {
		const featuresSection =
			this._classDetails.querySelector('.features-section');
		if (!featuresSection) {
			console.warn(
				'ClassDetailsView',
				'Features section not found in class details',
			);
			return;
		}

		const character = CharacterManager.getCurrentCharacter();
		const level = character?.level || 1;

		if (allFeatures.length > 0) {
			const processedFeatures = await Promise.all(
				allFeatures.map(async (feature) => {
					if (!feature.name) {
						console.warn('ClassDetailsView', 'Feature missing name:', feature);
						return '';
					}

					const name = feature.name;
					let description = '';

					// Handle different entry formats
					if (typeof feature.entries === 'string') {
						description = feature.entries;
					} else if (Array.isArray(feature.entries)) {
						description = await this._formatFeatureEntries(feature.entries);
					} else if (feature.entry) {
						description = await textProcessor.processString(feature.entry);
					} else if (feature.text) {
						description = await textProcessor.processString(feature.text);
					} else {
						console.warn('ClassDetailsView', 'Feature missing entries:', feature);
					}

					// Format source and page info
					const source = feature.source || classData.source || '';
					const page = feature.page || '';
					if (page) {
						description += `<div class="tooltip-source">${source}, p. ${page}</div>`;
					} else if (source) {
						description += `<div class="tooltip-source">${source}</div>`;
					}

					// Create hover link that will trigger tooltip (same as traits)
					return `<a class="trait-tag rd__hover-link" data-hover-type="feature" data-hover-name="${name}" data-hover-content="${description.replace(/"/g, '&quot;')}">${name}</a>`;
				}),
			);

			featuresSection.innerHTML = `
                <h6>Features</h6>
                <div class="traits-grid">
                    ${processedFeatures.join('')}
                </div>
            `;
		} else {
			featuresSection.innerHTML = `
                <h6>Features</h6>
                <div class="traits-grid">
                    <span class="trait-tag">No features at level ${level}</span>
                </div>
            `;
		}
	}

	async _formatFeatureEntries(entries) {
		// If entries is a string, process it and return
		if (typeof entries === 'string') {
			return await textProcessor.processString(entries);
		}

		// If entries is not an array, return empty string
		if (!Array.isArray(entries)) {
			console.warn(
				'ClassDetailsView',
				'Feature entries is not an array or string:',
				entries,
			);
			return '';
		}

		let result = '';

		// Process each entry in the array
		for (const entry of entries) {
			// Handle strings directly
			if (typeof entry === 'string') {
				const processed = await textProcessor.processString(entry);
				result += `<p>${processed}</p>`;
				continue;
			}

			// Handle objects with different types
			if (typeof entry === 'object') {
				// Handle lists
				if (entry.type === 'list') {
					result += '<ul class="tooltip-list">';

					if (Array.isArray(entry.items)) {
						for (const item of entry.items) {
							if (typeof item === 'string') {
								const processed = await textProcessor.processString(item);
								result += `<li>${processed}</li>`;
							} else if (typeof item === 'object') {
								// Handle items with name and entry
								if (item.name && item.entry) {
									const processedName = await textProcessor.processString(
										item.name,
									);
									const processedEntry = await textProcessor.processString(
										item.entry,
									);
									result += `<li><strong>${processedName}</strong>: ${processedEntry}</li>`;
								} else if (item.name && item.entries) {
									// Handle items with name and entries array
									const processedName = await textProcessor.processString(
										item.name,
									);
									const processedEntries = await this._formatFeatureEntries(
										item.entries,
									);
									result += `<li><strong>${processedName}</strong>: ${processedEntries}</li>`;
								} else {
									console.warn(
										'ClassDetailsView',
										'Unhandled list item format:',
										item,
									);
								}
							}
						}
					}

					result += '</ul>';
				}
				// Handle tables
				else if (entry.type === 'table') {
					result += '<div class="table-container">';

					if (entry.caption) {
						const processedCaption = await textProcessor.processString(
							entry.caption,
						);
						result += `<p><strong>${processedCaption}</strong></p>`;
					}

					result += '<table class="tooltip-table"><tbody>';

					if (Array.isArray(entry.rows)) {
						for (const row of entry.rows) {
							result += '<tr>';

							if (Array.isArray(row)) {
								for (const cell of row) {
									if (typeof cell === 'string') {
										const processed = await textProcessor.processString(cell);
										result += `<td>${processed}</td>`;
									} else {
										result += `<td>${JSON.stringify(cell)}</td>`;
									}
								}
							}

							result += '</tr>';
						}
					}

					result += '</tbody></table></div>';
				}
				// Handle entries property (recursive)
				else if (Array.isArray(entry.entries)) {
					result += await this._formatFeatureEntries(entry.entries);
				}
				// Handle entry property
				else if (entry.entry) {
					const processed = await textProcessor.processString(entry.entry);
					result += `<p>${processed}</p>`;
				}
				// Handle name and text properties
				else if (entry.name && entry.text) {
					const processedName = await textProcessor.processString(entry.name);
					const processedText = await textProcessor.processString(entry.text);
					result += `<p><strong>${processedName}</strong>. ${processedText}</p>`;
				}
				// Handle Spell Save DC
				else if (entry.type === 'abilityDc') {
					const character = CharacterManager.getCurrentCharacter();
					const abilityAbbr = entry.attributes?.[0]; // e.g., 'wis'
					if (!character || !abilityAbbr) {
						result += '<p>Error calculating Spell Save DC.</p>';
					} else {
						const abilityName = attAbvToFull(abilityAbbr) || abilityAbbr;
						const modifier = abilityScoreService.getModifier(abilityAbbr);
						const profBonus = character.getProficiencyBonus
							? character.getProficiencyBonus()
							: levelToProficiencyBonus(character.level);
						const dc = 8 + profBonus + modifier;
						const processedName = await textProcessor.processString(
							entry.name || 'Spell Save DC',
						);
						result += `<p><strong>${processedName}</strong> = 8 + your proficiency bonus + your ${abilityName} modifier (${dc})</p>`;
					}
				}
				// Handle Spell Attack Modifier
				else if (entry.type === 'abilityAttackMod') {
					const character = CharacterManager.getCurrentCharacter();
					const abilityAbbr = entry.attributes?.[0]; // e.g., 'wis'
					if (!character || !abilityAbbr) {
						result += '<p>Error calculating Spell Attack Modifier.</p>';
					} else {
						const abilityName = attAbvToFull(abilityAbbr) || abilityAbbr;
						const modifier = abilityScoreService.getModifier(abilityAbbr);
						const profBonus = character.getProficiencyBonus
							? character.getProficiencyBonus()
							: levelToProficiencyBonus(character.level);
						const attackMod = profBonus + modifier;
						const sign = attackMod >= 0 ? '+' : '';
						const processedName = await textProcessor.processString(
							entry.name || 'Spell Attack Modifier',
						);
						result += `<p><strong>${processedName}</strong> = your proficiency bonus + your ${abilityName} modifier (${sign}${attackMod})</p>`;
					}
				}
				// Handle optional feature reference
				else if (entry.type === 'refOptionalfeature') {
					const featureName = entry.optionalfeature;
					if (featureName) {
						const processed = await textProcessor.processString(featureName);
						result += `<p><em>${processed}</em></p>`;
					}
				}
				// Handle class feature reference (format: FeatureName|ParentClass|Source|Level)
				else if (entry.type === 'refClassFeature') {
					const featureRef = entry.classFeature;
					if (featureRef) {
						const { name: featureName } = window.api.unpackUid(featureRef);
						const processed = await textProcessor.processString(featureName);
						result += `<p><em>${processed}</em></p>`;
					}
				}
				// Fall back to JSON for unhandled formats
				else {
					console.warn('ClassDetailsView', 'Unhandled entry format:', entry);
					result += `<p>${JSON.stringify(entry)}</p>`;
				}
			}
		}

		return result;
	}
}

//=============================================================================
// Class Card View - Main class dropdown and quick description
//=============================================================================

class ClassCardView {
	constructor() {
		this._classSelect = document.getElementById('classSelect');

		this._classQuickDesc = document.getElementById('classQuickDesc');

		// Set up event listeners
		this._setupEventListeners();
	}

	//-------------------------------------------------------------------------
	// Event Setup
	//-------------------------------------------------------------------------

	_setupEventListeners() {
		if (this._classSelect) {
			this._classSelect.addEventListener('change', (event) => {
				const selectedValue = event.target.value;
				if (selectedValue) {
					const [className, source] = selectedValue.split('_');
					eventBus.emit(EVENTS.CLASS_SELECTED, {
						name: className,
						source,
						value: selectedValue,
					});
				}
			});
		}
	}

	//-------------------------------------------------------------------------
	// Public API
	//-------------------------------------------------------------------------

	getClassSelect() {
		return this._classSelect;
	}

	getSelectedClassValue() {
		return this._classSelect.value;
	}

	setSelectedClassValue(value) {
		this._classSelect.value = value;
	}

	populateClassSelect(classes) {
		this._classSelect.innerHTML = '<option value="">Select a Class</option>';

		if (!classes || classes.length === 0) {
			console.error('ClassCardView', 'No classes provided to populate dropdown');
			return;
		}

		// Sort classes by name
		const sortedClasses = [...classes].sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		// Add options to select
		for (const classData of sortedClasses) {
			const option = document.createElement('option');
			option.value = `${classData.name}_${classData.source}`;
			option.textContent = `${classData.name} (${classData.source})`;
			this._classSelect.appendChild(option);
		}
	}

	async updateQuickDescription(classData, fluffData = null) {
		if (!classData || !this._classQuickDesc) {
			return;
		}

		let description = '';

		// Extract description from fluff data
		if (fluffData?.entries) {
			// The fluff structure typically has:
			// - First 3 string entries: Story vignettes (skip these)
			// - 4th+ entries: Actual class description
			// We want to find the first descriptive paragraph that's not a story

			for (const entry of fluffData.entries) {
				if (entry.entries && Array.isArray(entry.entries)) {
					// Look through nested entries
					let foundDescription = false;
					for (let i = 0; i < entry.entries.length; i++) {
						const subEntry = entry.entries[i];
						if (typeof subEntry === 'string') {
							// Skip the first 3 story vignettes, get the 4th paragraph (index 3)
							if (i >= 3) {
								description = subEntry;
								foundDescription = true;
								break;
							}
						}
					}
					if (foundDescription) break;
				}
			}
		}

		// Fallback if no fluff found
		if (!description) {
			description =
				classData.description ||
				`${classData.name} class features and characteristics.`;
		}

		this._classQuickDesc.innerHTML = `
            <h5>${classData.name}</h5>
            <p>${description}</p>
        `;

		// Process reference tags in the description
		await textProcessor.processElement(this._classQuickDesc);
	}

	resetQuickDescription() {
		this._classQuickDesc.innerHTML = `
            <div class="placeholder-content">
                <h5>Select a Class</h5>
                <p>Choose a class to see details about their abilities, proficiencies, and other characteristics.</p>
            </div>
        `;
	}

	hasClassOption(classValue) {
		return Array.from(this._classSelect.options).some(
			(option) => option.value === classValue,
		);
	}

	triggerClassSelectChange() {
		this._classSelect.dispatchEvent(new Event('change', { bubbles: true }));
	}
}

//=============================================================================
// Subclass Picker View - Subclass dropdown
//=============================================================================

class SubclassPickerView {
	constructor() {
		this._subclassSelect = document.getElementById('subclassSelect');

		// Set up event listeners
		this._setupEventListeners();
	}

	//-------------------------------------------------------------------------
	// Event Setup
	//-------------------------------------------------------------------------

	_setupEventListeners() {
		if (this._subclassSelect) {
			this._subclassSelect.addEventListener('change', (event) => {
				const selectedValue = event.target.value;
				if (selectedValue) {
					eventBus.emit(EVENTS.SUBCLASS_SELECTED, {
						name: selectedValue,
						value: selectedValue,
					});
				}
			});
		}
	}

	//-------------------------------------------------------------------------
	// Public API
	//-------------------------------------------------------------------------

	getSubclassSelect() {
		return this._subclassSelect;
	}

	getSelectedSubclassValue() {
		return this._subclassSelect.value;
	}

	setSelectedSubclassValue(value) {
		this._subclassSelect.value = value;
	}

	populateSubclassSelect(subclasses) {
		this._subclassSelect.innerHTML =
			'<option value="">Select a Subclass</option>';
		this._subclassSelect.disabled = true;

		if (!subclasses || subclasses.length === 0) {
			return;
		}

		// Sort subclasses by name
		const sortedSubclasses = [...subclasses].sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		// Add options to select
		for (const subclass of sortedSubclasses) {
			const option = document.createElement('option');
			option.value = subclass.name;
			const src =
				subclass.subclassSource ||
				subclass.source ||
				subclass.classSource ||
				'';
			option.textContent = src ? `${subclass.name} (${src})` : subclass.name;
			this._subclassSelect.appendChild(option);
		}

		this._subclassSelect.disabled = false;
	}

	reset() {
		this._subclassSelect.innerHTML =
			'<option value="">Select a Subclass</option>';
		this._subclassSelect.disabled = true;
	}

	resetWithMessage(message) {
		this._subclassSelect.innerHTML =
			`<option value="">${message}</option>`;
		this._subclassSelect.disabled = true;
	}

	hasSubclassOption(subclassName) {
		return Array.from(this._subclassSelect.options).some(
			(option) => option.value === subclassName,
		);
	}

	triggerSubclassSelectChange() {
		this._subclassSelect.dispatchEvent(new Event('change', { bubbles: true }));
	}
}
