// Controller for class selection UI, coordinating views and subclass logic.
import { AppState } from '../../../app/AppState.js';
import { CharacterManager } from '../../../app/CharacterManager.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';

import {
	attAbvToFull,
	toSentenceCase, toTitleCase,
} from '../../../lib/5eToolsParser.js';
import DataNormalizer from '../../../lib/DataNormalizer.js';
import { ARTISAN_TOOLS } from '../../../lib/ProficiencyConstants.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { classService } from '../../../services/ClassService.js';
import { levelUpService } from '../../../services/LevelUpService.js';
import { optionalFeatureService } from '../../../services/OptionalFeatureService.js';
import { progressionHistoryService } from '../../../services/ProgressionHistoryService.js';
import { sourceService } from '../../../services/SourceService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { ClassFeatureSelector } from '../class-progression/ClassFeatureSelector.js';
import { ClassSpellSelector } from '../class-progression/ClassSpellSelector.js';

export class ClassCard {
	// Spell level ordinal names for UI display
	static SPELL_LEVEL_ORDINALS = ['', '1st-level', '2nd-level', '3rd-level', '4th-level', '5th-level', '6th-level', '7th-level', '8th-level', '9th-level'];

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
		} catch (error) {
			console.error('ClassCard', 'Failed to initialize class card:', error);
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
		// Store handler references for cleanup
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

		// Listen to view events via EventBus (dropdown events removed)
		eventBus.on(EVENTS.CHARACTER_UPDATED, this._characterUpdatedHandler);
		eventBus.on(EVENTS.CHARACTER_SELECTED, this._characterSelectedHandler);
		eventBus.on('sources:allowed-changed', this._sourcesChangedHandler);
		eventBus.on('LEVEL_UP_COMPLETE', this._levelUpCompleteHandler);
	}

	_cleanupEventListeners() {
		// Manually remove all eventBus listeners
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
			const character = AppState.getCurrentCharacter();
			console.log('[ClassCard] Current character:', character ? character.name : 'null');

			// Check if character has class data in progression
			if (!character || !character.progression?.classes || character.progression.classes.length === 0) {
				console.log('[ClassCard] No class progression data found');
				await this._renderClassTabsFromProgression();
				this.resetClassDetails();
				return; // No class data to load
			}

			const primaryClass = character.getPrimaryClass();
			console.log('[ClassCard] Primary class:', primaryClass);

			if (!primaryClass?.name) {
				console.log('[ClassCard] No primary class found, rendering tabs and returning');
				await this._renderClassTabsFromProgression();
				this.resetClassDetails();
				return; // No saved class to load
			}

			// Default to PHB if source is missing (legacy characters)
			const classSource = primaryClass.source || 'PHB';

			// Load class data directly without dropdown
			const classData = this._classService.getClass(primaryClass.name, classSource);
			if (classData) {
				// Get subclass from progression.classes[]
				const subclassName = primaryClass.subclass || null;
				console.log('[ClassCard] Subclass name:', subclassName);

				let subclassData = null;
				if (subclassName) {
					const subclasses = this._classService.getSubclasses(classData.name, classData.source);
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
			console.error('ClassCard', 'Error loading saved class selection:', error);
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

		// Get fluff data for description
		const fluffData = this._classService.getClassFluff(classData.name, classData.source);

		// Update class details (proficiencies, etc.) in info panel
		await this._detailsView.updateAllDetails(classData, fluffData);

		// Update class choices section
		await this._updateClassChoices(classData, subclassData);
	}

	async _renderClassTabsFromProgression() {
		if (!this._classTabsWrapper || !this._classTabsList) return;

		const character = AppState.getCurrentCharacter();
		const classes = character?.progression?.classes || [];

		if (!classes.length || classes.length < 2) {
			this._classTabsWrapper.style.display = 'none';
			this._classTabsList.innerHTML = '';
			this._activeClassTab = classes[0]?.name || null;
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
				return `<button type="button" class="nav-link py-1 px-3 ${activeClass}" data-class-name="${cls.name}" style="font-size: 0.875rem;">
					${cls.name} <span class="badge bg-secondary ms-1" style="font-size: 0.75rem;">Lv ${cls.levels}</span>
				</button>`;
			})
			.join('');

		this._classTabsList.innerHTML = buttonsHtml;
		this._classTabsWrapper.style.display = 'block';

		// Bind click handlers
		this._classTabsList.querySelectorAll('[data-class-name]').forEach((btn) => {
			btn.addEventListener('click', async () => {
				const name = btn.getAttribute('data-class-name');
				this._activeClassTab = name;

				// Update active state
				this._classTabsList.querySelectorAll('[data-class-name]').forEach((b) => {
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
		const progressionClass = character?.progression?.classes?.find(c => c.name === className);
		const classSource = progressionClass?.source || 'PHB';

		// Load class data directly by name and source
		const classData = this._classService.getClass(className, classSource);
		if (!classData) {
			console.warn('[ClassCard]', `Class not found: ${className} (${classSource})`);
			return;
		}

		// Get subclass if selected
		const subclassName = progressionClass?.subclass;
		let subclassData = null;
		if (subclassName) {
			const subclasses = this._classService.getSubclasses(className, classSource);
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
			this._hideASISection();
			this._hideSpellNotification();
			return;
		}

		const className = classData.name;

		// Subclass notification removed - now handled as a mandatory feature choice

		// Get all class choices across all levels (including spell selections and ASI)
		const progressionClass = character.progression?.classes?.find(c => c.name === className);
		const classLevel = progressionClass?.levels || 0;

		const allChoices = [];
		for (let lvl = 1; lvl <= classLevel; lvl++) {
			const levelChoices = await this._getClassChoicesAtLevel(className, lvl, subclassData);
			allChoices.push(...levelChoices);
		}

		// Sort all choices by level to ensure proper display order
		allChoices.sort((a, b) => a.level - b.level);

		// Hide the old spell notification section since spells are now integrated
		this._hideSpellNotification();
		// Hide the old separate ASI section since ASI is now integrated
		this._hideASISection();

		// Show container if any choices exist
		const hasChoices = allChoices.length > 0;

		if (hasChoices) {
			this._showClassChoices();
		} else {
			this._hideClassChoices();
		}

		if (hasChoices) {
			await this._renderClassChoices(className, allChoices);
		}
	}

	// Subclass notification removed - now handled as a mandatory feature choice in _getClassChoicesAtLevel

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
		const character = CharacterManager.getCurrentCharacter();

		// Check if class is a spellcaster
		if (!classData?.spellcastingAbility) {
			this._hideSpellNotification();
			return;
		}

		// Get progression info for this class
		const progressionClass = character.progression?.classes?.find(c => c.name === className);
		const classLevel = progressionClass?.levels || 0;

		if (classLevel === 0) {
			this._hideSpellNotification();
			return;
		}

		// Get spell choices for each level
		const spellChoices = this._getSpellChoicesForLevels(className, classLevel);

		// Filter to only show levels that need spell selection
		const pendingLevels = spellChoices.filter(choice => choice.cantrips > 0 || choice.spells > 0);

		if (pendingLevels.length === 0) {
			this._hideSpellNotification();
			return;
		}

		// Render spell selection card
		const container = document.getElementById('spellNotificationSection');
		if (!container) return;

		// Get existing spell selections from character
		const classSpellcasting = character.spellcasting?.classes?.[className];
		const existingSpells = classSpellcasting?.spellsKnown || [];

		let cardsHTML = '';
		for (const choice of pendingLevels) {
			// Get spells selected for this level from session data (stored in character progression)
			const sessionKey = `${className}_${choice.level}`;
			const levelSpells = character.progression?.spellSelections?.[sessionKey] || [];

			// Separate cantrips from leveled spells
			const selectedCantrips = levelSpells.filter(s => {
				const spell = existingSpells.find(es => es.name === s);
				return spell && spell.level === 0;
			});
			const selectedLeveledSpells = levelSpells.filter(s => {
				const spell = existingSpells.find(es => es.name === s);
				return spell && spell.level > 0;
			});

			// Build badge display for spell requirements
			const badges = [];
			if (choice.cantrips > 0) {
				const cantripCount = selectedCantrips.length;
				const cantripClass = cantripCount === choice.cantrips ? 'bg-success' : cantripCount > choice.cantrips ? 'bg-danger' : '';
				badges.push(`<span class="badge me-1 ${cantripClass}" style="${!cantripClass ? 'background-color: var(--accent-color);' : ''}">Cantrips ${cantripCount}/${choice.cantrips}</span>`);
			}
			if (choice.spells > 0) {
				// Use centralized method to get max spell level
				const maxSpellLevel = this._getMaxSpellLevel(className, choice.level);
				const spellCount = selectedLeveledSpells.length;
				const spellClass = spellCount === choice.spells ? 'bg-success' : spellCount > choice.spells ? 'bg-danger' : '';
				const spellLevelName = ClassCard.SPELL_LEVEL_ORDINALS[maxSpellLevel] || 'level';
				badges.push(`<span class="badge ${spellClass}" style="${!spellClass ? 'background-color: var(--accent-color);' : ''}">${spellLevelName} ${spellCount}/${choice.spells}</span>`);
			}
			const badgeDisplay = badges.join('');

			// Build selected spell display
			let selectedDisplay = 'None selected';
			if (levelSpells.length > 0) {
				selectedDisplay = levelSpells.join(', ');
			}

			cardsHTML += `
				<div class="card mb-3">
					<div class="card-header d-flex justify-content-between align-items-center">
						<div>
							<h6 class="mb-0"><i class="fas fa-wand-sparkles"></i> Spell Selection</h6>
							<small class="text-muted">Level ${choice.level}</small>
						</div>
						<div>
							${badgeDisplay}
						</div>
					</div>
					<div class="card-body">
						<div class="d-flex justify-content-between align-items-center">
							<div class="flex-grow-1">
								<div class="text-muted small">
									<strong>Selected:</strong> ${selectedDisplay}
								</div>
							</div>
							<button class="btn btn-primary btn-sm ms-2" data-spell-select-level="${choice.level}" data-spell-select-class="${className}">
								<i class="fas fa-wand-sparkles"></i> Choose
							</button>
						</div>
					</div>
				</div>
			`;
		}

		container.innerHTML = cardsHTML;
		container.style.display = 'block';

		// Attach listeners for spell selection buttons
		const spellButtons = container.querySelectorAll('[data-spell-select-level]');
		for (const button of spellButtons) {
			this._cleanup.on(button, 'click', () => {
				const level = parseInt(button.dataset.spellSelectLevel, 10);
				const className = button.dataset.spellSelectClass;
				this._handleSpellSelection(className, level);
			});
		}
	}

	/**
	 * Get spell selection requirements for each level up to classLevel
	 * @param {string} className - Class name
	 * @param {number} classLevel - Current class level
	 * @returns {Array} Array of {level, cantrips, spells}
	 * @private
	 */
	_getSpellChoicesForLevels(className, classLevel) {
		const classData = this._classService.getClass(className);
		if (!classData) return [];

		const choices = [];

		// For each level, calculate new spells/cantrips available
		for (let level = 1; level <= classLevel; level++) {
			const cantripsAtLevel = spellSelectionService._getCantripsKnown(className, level);
			const cantripsAtPrevLevel = level > 1 ? spellSelectionService._getCantripsKnown(className, level - 1) : 0;
			const newCantrips = cantripsAtLevel - cantripsAtPrevLevel;

			let newSpells = 0;

			// Check if class learns spells on level up
			if (classData.spellsKnownProgressionFixed) {
				// Wizard: learns X spells per level
				const index = Math.max(0, Math.min(level - 1, classData.spellsKnownProgressionFixed.length - 1));
				newSpells = classData.spellsKnownProgressionFixed[index] || 0;
			} else if (classData.spellsKnownProgression) {
				// Bard, Sorcerer, Warlock, Ranger: total spells known increases
				const spellsAtLevel = spellSelectionService._getSpellsKnownLimit(className, level);
				const spellsAtPrevLevel = level > 1 ? spellSelectionService._getSpellsKnownLimit(className, level - 1) : 0;
				newSpells = spellsAtLevel - spellsAtPrevLevel;
			}
			// For prepared casters (Cleric, Druid, Paladin), they don't "learn" spells at level up
			// so newSpells stays 0

			if (newCantrips > 0 || newSpells > 0) {
				choices.push({
					level,
					cantrips: newCantrips,
					spells: newSpells,
					maxSpellLevel: this._getMaxSpellLevel(className, level)
				});
			}
		}

		return choices;
	}

	_getMaxSpellLevel(className, characterLevel) {
		const classData = this._classService.getClass(className);
		if (!classData) return 0;

		const progression = classData.casterProgression;
		let casterLevel = characterLevel;

		// Calculate effective caster level based on progression type
		if (progression === '1/2') {
			casterLevel = Math.floor(characterLevel / 2);
		} else if (progression === '1/3') {
			casterLevel = Math.floor(characterLevel / 3);
		} else if (progression === 'pact') {
			// Warlock uses pact magic - special progression
			if (characterLevel >= 9) return 5;
			if (characterLevel >= 7) return 4;
			if (characterLevel >= 5) return 3;
			if (characterLevel >= 3) return 2;
			return 1;
		}

		// Standard spell level progression
		if (casterLevel >= 17) return 9;
		if (casterLevel >= 15) return 8;
		if (casterLevel >= 13) return 7;
		if (casterLevel >= 11) return 6;
		if (casterLevel >= 9) return 5;
		if (casterLevel >= 7) return 4;
		if (casterLevel >= 5) return 3;
		if (casterLevel >= 3) return 2;
		if (casterLevel >= 1) return 1;
		return 0;
	}

	/**
	 * Handle spell selection for a specific level
	 * @param {string} className - Class name
	 * @param {number} level - Level to select spells for
	 * @private
	 */
	async _handleSpellSelection(className, level) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) {
			console.warn('[ClassCard]', 'No character found for spell selection');
			return;
		}

		// Get existing selections for this level
		const sessionKey = `${className}_${level}`;
		const existingSelections = character.progression?.spellSelections?.[sessionKey] || [];

		console.log('[ClassCard]', '_handleSpellSelection:', {
			className,
			level,
			sessionKey,
			existingSelections,
			progressionSpellSelections: character.progression?.spellSelections
		});

		// Create a mock session for LevelUpSpellSelector
		const mockSession = {
			originalCharacter: character,
			stagedChanges: character,
			stepData: {
				selectedSpells: {
					[sessionKey]: [...existingSelections] // Preload existing selections (copy array)
				}
			}
		};

		// Create and show spell selector
		const spellSelector = new ClassSpellSelector(
			mockSession,
			this, // parent step
			className,
			level
		);

		try {
			await spellSelector.show();
			// Note: CHARACTER_UPDATED event and display refresh happen in updateSpellSelection callback
		} catch (error) {
			console.error('[ClassCard]', 'Error in spell selection:', error);
		}
	}

	/**
	 * Update spell selection callback for LevelUpSpellSelector
	 * @param {string} className - Class name
	 * @param {number} level - Level
	 * @param {Array} selectedSpells - Array of spell objects
	 */
	async updateSpellSelection(className, level, selectedSpells) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) {
			console.warn('[ClassCard]', 'No character found for updateSpellSelection');
			return;
		}

		// Ensure spellcasting is initialized for this class
		if (!character.spellcasting?.classes?.[className]) {
			const classLevel = character.progression.classes.find(c => c.name === className)?.levels || level;
			spellSelectionService.initializeSpellcastingForClass(character, className, classLevel);
		}

		// Get the session key
		const sessionKey = `${className}_${level}`;

		// Initialize spell selections tracking if needed
		if (!character.progression.spellSelections) {
			character.progression.spellSelections = {};
		}

		// Get previous selections for this level
		const previousSelections = character.progression.spellSelections[sessionKey] || [];

		// Remove spells that are no longer selected
		for (const prevSpellName of previousSelections) {
			const stillSelected = selectedSpells.some(s => s.name === prevSpellName);
			if (!stillSelected) {
				spellSelectionService.removeKnownSpell(character, className, prevSpellName);
			}
		}

		// Add newly selected spells
		for (const spell of selectedSpells) {
			// Check if spell is already in known spells
			const alreadyKnown = character.spellcasting.classes[className].spellsKnown.some(
				s => s.name === spell.name
			);

			if (!alreadyKnown) {
				spellSelectionService.addKnownSpell(character, className, spell);
			}
		}

		// Update progression tracking
		character.progression.spellSelections[sessionKey] = selectedSpells.map(s => s.name);

		console.log('[ClassCard]', 'Updated spell selection:', {
			className,
			level,
			selectedSpells: selectedSpells.map(s => s.name),
			knownSpells: character.spellcasting.classes[className].spellsKnown.map(s => s.name)
		});

		// Emit CHARACTER_UPDATED event after spells are added
		eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });

		// Refresh spell notification display
		this._renderSpellNotification(className);
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
		const character = CharacterManager.getCurrentCharacter();

		const classData = this._classService.getClass(className);
		if (!classData) return choices;

		// Check for subclass selection at appropriate level
		// Different classes get subclass at different levels:
		// - Warlock, Cleric: Level 1
		// - Most classes: Level 3
		// - Some classes: Level 2
		// Get the level at which this class gains subclass from ClassService
		const subclassLevel = this._classService.getSubclassLevel(classData);

		// Default to level 3 if subclass level can't be determined
		const effectiveSubclassLevel = subclassLevel !== null ? subclassLevel : 3;

		// Always add subclass choice at the appropriate level (even if already selected, so users can see/change it)
		// This handles classes that get subclass at level 1 (Warlock, Cleric) or level 3 (most others)
		if (level === effectiveSubclassLevel) {
			console.log(`[ClassCard] Adding subclass choice for ${className} at level ${level} (subclass level: ${effectiveSubclassLevel})`);

			const availableSubclasses = this._classService.getSubclasses(className, classData.source)
				.filter((sc) => {
					const subclassSource = sc.subclassSource || sc.source || sc.classSource;
					return sourceService.isSourceAllowed(subclassSource);
				})
				.map(sc => {
					// Resolve subclass feature entries if they're string references
					let entries = [];
					if (sc.subclassFeatures && sc.subclassFeatures.length > 0) {
						const firstFeatureRef = sc.subclassFeatures[0];
						if (typeof firstFeatureRef === 'string') {
							// Resolve from service data
							const features = this._classService.getSubclassFeatures(
								sc.className,
								sc.shortName,
								1,
								sc.source || 'PHB'
							);
							const firstFeature = features.find(f => f.level === 1);
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
						description: this._getSubclassDescription(sc),
						entries,
						shortName: sc.shortName
					};
				});

			if (availableSubclasses.length > 0) {
				choices.push({
					id: `${className.toLowerCase()}_subclass_${level}`,
					name: 'Subclass Selection',
					type: 'subclass',
					options: availableSubclasses,
					required: true,
					count: 1,
					level
				});
			}
		}

		// Check for optional feature progressions
		const progressions = classData.optionalfeatureProgression || [];
		for (const progression of progressions) {
			const count = this._classService.getCountAtLevel(progression.progression, level);
			const prevCount = level > 1 ? this._classService.getCountAtLevel(progression.progression, level - 1) : 0;
			const newCount = count - prevCount; // Only new selections at this level

			if (newCount > 0) {
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
						type: this._classService.mapFeatureType(featureTypes[0]),
						options,
						required: true,
						count: newCount, // Use only the new count for this level
						level
					});
				}
			}
		}

		// Check subclass optional feature progressions
		if (subclassData?.optionalfeatureProgression) {
			for (const progression of subclassData.optionalfeatureProgression) {
				const count = this._classService.getCountAtLevel(progression.progression, level);
				const prevCount = level > 1 ? this._classService.getCountAtLevel(progression.progression, level - 1) : 0;
				const newCount = count - prevCount; // Only new selections at this level

				if (newCount > 0) {
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
							type: this._classService.mapFeatureType(featureTypes[0]),
							options,
							required: true,
							count: newCount, // Use only the new count for this level
							level
						});
					}
				}
			}
		}

		// Add spell selections for each level
		if (character && classData?.spellcastingAbility) {
			const progressionClass = character.progression?.classes?.find(c => c.name === className);
			const classLevel = progressionClass?.levels || 0;

			// Get spell choices for all levels up to current class level
			const spellChoices = this._getSpellChoicesForLevels(className, classLevel);

			for (const spellChoice of spellChoices) {
				// Only add spell choices that match this level
				if (spellChoice.level === level && (spellChoice.cantrips > 0 || spellChoice.spells > 0)) {
					choices.push({
						id: `${className.toLowerCase()}_spell_selection_${spellChoice.level}`,
						name: 'Spell Selection',
						type: 'spell',
						required: true,
						count: spellChoice.cantrips + spellChoice.spells,
						level: spellChoice.level,
						spellData: spellChoice
					});
				}
			}
		}

		// Check for ASI at this level
		const asiLevels = levelUpService._getASILevelsForClass(className);
		if (asiLevels.includes(level)) {
			// Check if ASI was already used at this level
			const levelUps = character.progression?.levelUps || [];
			const asiUsed = levelUps.some(lu => {
				const isThisLevel = lu.toLevel === level;
				const hasChanges = (lu.changedAbilities && Object.keys(lu.changedAbilities).length > 0) ||
					(lu.appliedFeats && lu.appliedFeats.length > 0);
				return isThisLevel && hasChanges;
			});

			// Always show ASI choice (even if used, so user can see what was selected)
			choices.push({
				id: `${className.toLowerCase()}_asi_${level}`,
				name: 'Ability Score Improvement',
				type: 'asi',
				required: true,
				count: 1,
				level,
				asiUsed
			});
		}

		// Sort by level
		choices.sort((a, b) => a.level - b.level);

		return choices;
	}

	// Helper methods moved to ClassService for better separation of concerns

	_getFeatureDescription(feature) {
		if (!feature.entries) return '';
		const firstEntry = feature.entries.find(e => typeof e === 'string');
		if (firstEntry) {
			return `${firstEntry.replace(/\{@[^}]+\}/g, '').substring(0, 150)}...`;
		}
		return '';
	}

	_getSubclassDescription(subclass) {
		if (!subclass.subclassFeatures || subclass.subclassFeatures.length === 0) return '';

		// Get the actual feature data - subclassFeatures may be string references
		const firstFeatureRef = subclass.subclassFeatures[0];
		let firstFeature = firstFeatureRef;

		// If it's a string reference, resolve it from the service data
		if (typeof firstFeatureRef === 'string') {
			const features = this._classService.getSubclassFeatures(
				subclass.className,
				subclass.shortName,
				1,
				subclass.source || 'PHB'
			);
			firstFeature = features.find(f => f.level === 1);
		}

		if (firstFeature?.entries) {
			const firstEntry = firstFeature.entries.find(e => typeof e === 'string');
			if (firstEntry) {
				return `${firstEntry.replace(/\{@[^}]+\}/g, '').substring(0, 150)}...`;
			}
		}
		return '';
	}

	async _renderClassChoices(className, choices) {
		const container = document.getElementById('classChoicesContent');
		if (!container) return;

		// Preserve accordion state before re-rendering
		const expandedLevels = new Set();
		const existingAccordion = document.getElementById('classChoicesAccordion');
		if (existingAccordion) {
			const collapses = existingAccordion.querySelectorAll('.accordion-collapse.show');
			collapses.forEach(collapse => {
				const match = collapse.id.match(/classChoicesLevel(\d+)/);
				if (match) {
					expandedLevels.add(Number(match[1]));
				}
			});
		}

		// Group choices by level
		const choicesByLevel = {};
		for (const choice of choices) {
			const level = choice.level || 1;
			if (!choicesByLevel[level]) {
				choicesByLevel[level] = [];
			}
			choicesByLevel[level].push(choice);
		}

		// Sort levels
		const levels = Object.keys(choicesByLevel).map(Number).sort((a, b) => a - b);

		// Build accordion HTML
		let html = '<div class="accordion accordion-flush" id="classChoicesAccordion">';

		for (const level of levels) {
			const levelChoices = choicesByLevel[level];
			// Keep previously expanded state, or default to collapsed
			const isExpanded = expandedLevels.size > 0 ? expandedLevels.has(level) : false;
			const collapseId = `classChoicesLevel${level}`;

			html += `
				<div class="accordion-item">
					<h2 class="accordion-header" id="heading${collapseId}">
						<button class="accordion-button ${isExpanded ? '' : 'collapsed'}" type="button" 
							data-bs-toggle="collapse" data-bs-target="#${collapseId}" 
							aria-expanded="${isExpanded}" aria-controls="${collapseId}">
							<strong>Level ${level} Choices</strong>
							<span class="badge bg-secondary ms-2">${levelChoices.length}</span>
						</button>
					</h2>
					<div id="${collapseId}" class="accordion-collapse collapse ${isExpanded ? 'show' : ''}" 
						aria-labelledby="heading${collapseId}">
						<div class="accordion-body p-2">
							${levelChoices.map(choice => this._renderFeatureChoice(choice)).join('')}
						</div>
					</div>
				</div>
			`;
		}

		html += '</div>';
		container.innerHTML = html;

		// Attach listeners
		this._attachClassChoiceListeners(container, className);
	}

	_renderFeatureChoice(choice) {
		const character = CharacterManager.getCurrentCharacter();
		const primaryClass = character?.getPrimaryClass();
		const className = primaryClass?.name;

		// Handle spell selection differently
		if (choice.type === 'spell') {
			return this._renderSpellChoice(choice, className);
		}

		// Handle subclass selection specially
		if (choice.type === 'subclass') {
			return this._renderSubclassChoice(choice, className);
		}

		// Handle ASI specially
		if (choice.type === 'asi') {
			return this._renderASIChoice(choice, className);
		}

		// Get current selections from progression history
		const currentSelections = progressionHistoryService.getChoices(
			character,
			className,
			choice.level
		)?.[choice.type]?.selected || [];

		const isMultiSelect = (choice.count || 1) > 1;
		const isComplete = currentSelections.length >= (choice.count || 1);
		let selectedDisplay = 'None selected';

		if (currentSelections.length > 0) {
			const selectedNames = currentSelections.map(selId => {
				const opt = choice.options.find(o => o.id === selId || o.name === selId);
				return opt ? opt.name : selId;
			});
			selectedDisplay = selectedNames.join(', ');
		}

		return `
			<div class="choice-item border-bottom pb-2 mb-2" data-choice-card="${choice.id}">
				<div class="d-flex justify-content-between align-items-start">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center mb-1">
							<strong>${this._getFeatureIcon(choice.type)} ${choice.name}</strong>
							${isComplete ? '<i class="fas fa-check-circle text-success ms-2"></i>' : ''}
						</div>
						<div class="text-muted small" data-selected-display="${choice.id}">
							${selectedDisplay}
						</div>
					</div>
					<button 
						class="btn btn-sm ${isComplete ? 'btn-outline-secondary' : 'btn-primary'}" 
						data-feature-select-btn="${choice.id}"
						data-feature-type="${choice.type}"
						data-feature-level="${choice.level}"
						data-is-multi="${isMultiSelect}"
						data-max-count="${choice.count || 1}">
						<i class="fas fa-list"></i> ${isComplete ? 'Change' : 'Choose'}
					</button>
				</div>
			</div>
		`;
	}

	_renderSubclassChoice(choice, className) {
		const character = CharacterManager.getCurrentCharacter();
		const progressionClass = character.progression?.classes?.find(c => c.name === className);
		const currentSubclass = progressionClass?.subclass;

		const selectedDisplay = currentSubclass || 'None selected';
		const isComplete = !!currentSubclass;

		return `
			<div class="choice-item border-bottom pb-2 mb-2" data-choice-card="${choice.id}">
				<div class="d-flex justify-content-between align-items-start">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center mb-1">
							<strong><i class="fas fa-star"></i> ${choice.name}</strong>
							${isComplete ? '<i class="fas fa-check-circle text-success ms-2"></i>' : ''}
						</div>
						<div class="text-muted small" data-selected-display="${choice.id}">
							${selectedDisplay}
						</div>
					</div>
					<button 
						class="btn btn-sm ${isComplete ? 'btn-outline-secondary' : 'btn-primary'}" 
						data-feature-select-btn="${choice.id}"
						data-feature-type="${choice.type}"
						data-feature-level="${choice.level}"
						data-is-multi="false"
						data-max-count="1">
						<i class="fas fa-list"></i> ${isComplete ? 'Change' : 'Choose'}
					</button>
				</div>
			</div>
		`;
	}

	_renderSpellChoice(choice, className) {
		const character = CharacterManager.getCurrentCharacter();

		const sessionKey = `${className}_${choice.level}`;
		const levelSpells = character.progression?.spellSelections?.[sessionKey] || [];

		// Build display of selected spells
		let selectedDisplay = 'None selected';
		if (levelSpells.length > 0) {
			selectedDisplay = levelSpells.join(', ');
		}

		const isComplete = levelSpells.length > 0;

		return `
			<div class="choice-item border-bottom pb-2 mb-2" data-choice-card="${choice.id}">
				<div class="d-flex justify-content-between align-items-start">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center mb-1">
							<strong><i class="fas fa-wand-sparkles"></i> Spell Selection</strong>
							${isComplete ? '<i class="fas fa-check-circle text-success ms-2"></i>' : ''}
						</div>
						<div class="text-muted small">
							${selectedDisplay}
						</div>
					</div>
					<button 
						class="btn btn-sm ${isComplete ? 'btn-outline-secondary' : 'btn-primary'}" 
						data-spell-select-level="${choice.level}" 
						data-spell-select-class="${className}">
						<i class="fas fa-wand-sparkles"></i> ${isComplete ? 'Change' : 'Choose'}
					</button>
				</div>
			</div>
		`;
	}

	_renderASIChoice(choice) {
		const character = CharacterManager.getCurrentCharacter();

		// Check if ASI was used at this level
		const levelUps = character.progression?.levelUps || [];
		const asiRecord = levelUps.find(lu => {
			const isThisLevel = lu.toLevel === choice.level;
			const hasChanges = (lu.changedAbilities && Object.keys(lu.changedAbilities).length > 0) ||
				(lu.appliedFeats && lu.appliedFeats.length > 0);
			return isThisLevel && hasChanges;
		});

		const asiUsed = !!asiRecord;
		const hasFeat = asiRecord?.appliedFeats && asiRecord.appliedFeats.length > 0;
		const hasASI = asiRecord?.changedAbilities && Object.keys(asiRecord.changedAbilities).length > 0;

		// Determine what was selected
		let selectedChoice = 'none'; // 'asi', 'feat', or 'none'
		let selectedDisplay = 'None selected';

		if (asiUsed) {
			if (hasFeat) {
				selectedChoice = 'feat';
				selectedDisplay = asiRecord.appliedFeats.join(', ');
			} else if (hasASI) {
				selectedChoice = 'asi';
				const abilityChanges = Object.entries(asiRecord.changedAbilities)
					.map(([ability, change]) => `+${change} ${toTitleCase(attAbvToFull(ability))}`)
					.join(', ');
				selectedDisplay = abilityChanges;
			}
		}

		// Determine radio button state
		const asiChecked = selectedChoice === 'asi' || selectedChoice === 'none';
		const featChecked = selectedChoice === 'feat';
		const radiosDisabled = asiUsed; // Disable after selection

		// Determine button text and icon based on state
		let buttonText, buttonIcon;
		if (asiUsed) {
			// Show "Change" when already selected
			buttonText = 'Change';
			buttonIcon = 'fa-list';
		} else if (featChecked) {
			// Show "Choose" for feat when not yet selected
			buttonText = 'Choose';
			buttonIcon = 'fa-scroll';
		} else {
			// Show contextual for ASI when not yet selected
			buttonText = 'Increase Scores';
			buttonIcon = 'fa-arrow-up';
		}

		return `
			<div class="choice-item border-bottom pb-2 mb-2" data-choice-card="${choice.id}">
				<div class="d-flex justify-content-between align-items-start flex-column flex-md-row gap-2">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center mb-2">
							<strong><i class="fas fa-arrow-up"></i> Ability Score Improvement</strong>
							${asiUsed ? '<i class="fas fa-check-circle text-success ms-2"></i>' : ''}
						</div>
						<div class="text-muted small mb-2">
							${selectedDisplay}
						</div>
						<div class="d-flex flex-column gap-1">
							<div class="form-check form-check-inline">
								<input class="form-check-input" type="radio" name="asiChoice_${choice.level}" 
									id="asiRadio_${choice.level}" value="asi" ${asiChecked ? 'checked' : ''}
									${radiosDisabled ? 'disabled' : ''}
									data-asi-radio="${choice.level}">
								<label class="form-check-label" for="asiRadio_${choice.level}">
									Ability Score Increase
								</label>
							</div>
							<div class="form-check form-check-inline">
								<input class="form-check-input" type="radio" name="asiChoice_${choice.level}" 
									id="featRadio_${choice.level}" value="feat" ${featChecked ? 'checked' : ''}
									${radiosDisabled ? 'disabled' : ''}
									data-feat-radio="${choice.level}">
								<label class="form-check-label" for="featRadio_${choice.level}">
									Feat
								</label>
							</div>
						</div>
					</div>
					<button 
						class="btn btn-sm ${asiUsed ? 'btn-outline-secondary' : 'btn-primary'} align-self-md-start" 
						data-asi-action-btn="${choice.level}"
						data-current-choice="${selectedChoice}"
						data-asi-used="${asiUsed}">
						<i class="fas ${buttonIcon}" data-asi-icon="${choice.level}"></i> 
						<span data-asi-btn-text="${choice.level}">${buttonText}</span>
					</button>
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
			'spell': '<i class="fas fa-wand-sparkles"></i>',
			'subclass': '<i class="fas fa-star"></i>',
			'asi': '<i class="fas fa-arrow-up"></i>',
			'other': '<i class="fas fa-star"></i>'
		};
		return icons[type] || icons.other;
	}

	_attachClassChoiceListeners(container, className) {
		// Spell selection buttons
		const spellButtons = container.querySelectorAll('[data-spell-select-level]');
		spellButtons.forEach(button => {
			this._cleanup.on(button, 'click', () => {
				const level = parseInt(button.dataset.spellSelectLevel, 10);
				const className = button.dataset.spellSelectClass;
				this._handleSpellSelection(className, level);
			});
		});

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

		// ASI selection - radio buttons and action button
		const asiActionButtons = container.querySelectorAll('[data-asi-action-btn]');
		asiActionButtons.forEach(button => {
			const level = parseInt(button.dataset.asiActionBtn, 10);
			const asiUsed = button.dataset.asiUsed === 'true';

			// Radio button change handlers (only if not yet selected)
			if (!asiUsed) {
				const asiRadio = container.querySelector(`[data-asi-radio="${level}"]`);
				const featRadio = container.querySelector(`[data-feat-radio="${level}"]`);
				const buttonTextEl = button.querySelector(`[data-asi-btn-text="${level}"]`);
				const buttonIconEl = button.querySelector(`[data-asi-icon="${level}"]`);

				const updateButtonState = () => {
					if (featRadio?.checked) {
						buttonTextEl.textContent = 'Choose';
						buttonIconEl.className = 'fas fa-scroll';
						buttonIconEl.className = 'fas fa-arrow-up';
					}
				};

				if (asiRadio) {
					this._cleanup.on(asiRadio, 'change', updateButtonState);
				}
				if (featRadio) {
					this._cleanup.on(featRadio, 'change', updateButtonState);
				}
			}

			// Button click handler
			this._cleanup.on(button, 'click', () => {
				if (asiUsed) {
					// When changing, show options to pick ASI or Feat again
					this._handleASIChange(level);
				} else {
					// First time selection
					const featRadio = container.querySelector(`[data-feat-radio="${level}"]`);
					const isSelectingFeat = featRadio?.checked;
					this._handleASISelection(level, isSelectingFeat);
				}
			});
		});
	}

	async _handleASIChange(level) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Clear the existing selection from levelUps
		const levelUps = character.progression?.levelUps || [];
		const existingASI = levelUps.find(lu => lu.toLevel === level);

		if (existingASI) {
			// Clear the old ASI bonuses from character.abilityBonuses
			if (existingASI.changedAbilities) {
				for (const [ability, bonus] of Object.entries(existingASI.changedAbilities)) {
					// Normalize ability name (str -> strength, dex -> dexterity, etc.)
					const normalizedAbility = ability
						.toLowerCase()
						.replace(/^str$/, 'strength')
						.replace(/^dex$/, 'dexterity')
						.replace(/^con$/, 'constitution')
						.replace(/^int$/, 'intelligence')
						.replace(/^wis$/, 'wisdom')
						.replace(/^cha$/, 'charisma');

					character.removeAbilityBonus(normalizedAbility, bonus, 'Ability Score Increase');
					// Also remove from base scores
					character.abilityScores[ability] = (character.abilityScores[ability] || 10) - bonus;
				}
			}

			// Remove the levelUp record
			const existingIndex = levelUps.findIndex(lu => lu.toLevel === level);
			if (existingIndex !== -1) {
				levelUps.splice(existingIndex, 1);
			}
		}

		// Re-render to show selection UI again
		await this._syncWithCharacterProgression();
		eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });

		// Notify ability score card to update
		const event = new CustomEvent('abilityScoresChanged', {
			detail: { character },
		});
		document.dispatchEvent(event);
	}

	async _handleASISelection(level, isSelectingFeat = false) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		if (isSelectingFeat) {
			// Open feat selection modal
			const { ClassFeatSelector } = await import('../class-progression/ClassFeatSelector.js');
			const { levelUpService } = await import('../../../services/LevelUpService.js');

			// Check if feat was already selected at this level
			const levelUps = character.progression?.levelUps || [];
			const existingFeat = levelUps.find(lu => {
				const isThisLevel = lu.toLevel === level;
				const hasFeat = lu.appliedFeats && lu.appliedFeats.length > 0;
				return isThisLevel && hasFeat;
			});

			const currentFeat = existingFeat?.appliedFeats?.[0];

			// Create feat selector (no wrapper needed now)
			const featSelector = new ClassFeatSelector(null, null);

			try {
				// Show modal and await the selected feat name
				const selectedFeatName = await featSelector.show(currentFeat ? { name: currentFeat } : null);

				if (selectedFeatName) {
					// Record feat selection in progression history
					levelUpService.recordLevelUp(character, level - 1, level, {
						changedAbilities: {},
						appliedFeats: [selectedFeatName],
						appliedFeatures: [],
					});

					// Apply feat to character
					character.feats.push({ name: selectedFeatName, source: 'Ability Score Improvement' });
					await this._syncWithCharacterProgression();
					eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
				}
			} catch (error) {
				console.error('[ClassCard] Error in feat selection:', error);
			}
			return;
		}

		// Otherwise, open ASI modal for ability score selection
		const primaryClass = character.getPrimaryClass();
		if (!primaryClass) return;

		// Import ASIModal
		const { ASIModal } = await import('../level/ASIModal.js');

		// Check if ASI was already used at this level
		const levelUps = character.progression?.levelUps || [];
		const existingASI = levelUps.find(lu => {
			const isThisLevel = lu.toLevel === level;
			const hasChanges = (lu.changedAbilities && Object.keys(lu.changedAbilities).length > 0);
			return isThisLevel && hasChanges;
		});

		const currentASI = existingASI?.changedAbilities || {};

		// Show ASI modal
		const modal = new ASIModal(level, currentASI);

		try {
			const result = await modal.show();

			if (result) {
				// Apply ability score changes and track as bonuses
				for (const [ability, bonus] of Object.entries(result)) {
					// Update base score
					const currentScore = character.abilityScores[ability] || 10;
					character.abilityScores[ability] = currentScore + bonus;

					// Track as ability bonus for display in ability scores card
					character.addAbilityBonus(ability, bonus, 'Ability Score Increase');
				}

				// Record in progression history
				levelUpService.recordLevelUp(character, level - 1, level, {
					changedAbilities: result,
					appliedFeats: [],
					appliedFeatures: [],
				});

				// Update UI
				await this._syncWithCharacterProgression();
				eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });

				// Notify ability score card to update
				const event = new CustomEvent('abilityScoresChanged', {
					detail: { character },
				});
				document.dispatchEvent(event);
			}
		} catch (error) {
			console.error('[ClassCard] Error in ASI selection:', error);
		}
	}

	async _handleFeatureSelection(className, featureType, level, featureId, isMulti, maxCount) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Handle subclass selection separately
		if (featureType === 'subclass') {
			return this._handleSubclassFeatureSelection(className, level, featureId);
		}

		// Get current selections at this level
		const currentSelections = progressionHistoryService.getChoices(
			character,
			className,
			level
		)?.[featureType]?.selected || [];

		// Get all selections from OTHER levels to exclude them
		const progressionClass = character.progression?.classes?.find(c => c.name === className);
		const classLevel = progressionClass?.levels || 0;
		const otherLevelSelections = new Set();

		// Collect selections from all other levels
		for (let lvl = 1; lvl <= classLevel; lvl++) {
			if (lvl !== level) {
				const levelChoices = progressionHistoryService.getChoices(character, className, lvl);
				const levelSelections = levelChoices?.[featureType]?.selected || [];
				for (const sel of levelSelections) {
					otherLevelSelections.add(sel);
				}
			}
		}

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
			.filter(opt => sourceService.isSourceAllowed(opt.source))
			.filter(opt => {
				// Exclude features already selected at OTHER levels
				const featureName = opt.name;
				const featureId = `${opt.name}_${opt.source}`;
				return !otherLevelSelections.has(featureName) && !otherLevelSelections.has(featureId);
			});

		// Create a minimal session-like object for the selector
		const mockSession = {
			originalCharacter: character,
			stagedChanges: character,
			stepData: {
				selectedFeatures: {}
			}
		};

		// Show feature selector
		const selector = new ClassFeatureSelector(
			mockSession,
			this,
			className,
			featureType, // Use the mapped type, not the code
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

	async _handleSubclassFeatureSelection(className, level, featureId) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Get available subclasses
		const classData = this._classService.getClass(className);
		const availableSubclasses = this._classService.getSubclasses(className, classData.source)
			.filter((sc) => {
				const subclassSource = sc.subclassSource || sc.source || sc.classSource;
				return sourceService.isSourceAllowed(subclassSource);
			})
			.map(sc => {
				// Resolve subclass feature entries if they're string references
				let entries = [];
				if (sc.subclassFeatures && sc.subclassFeatures.length > 0) {
					const firstFeatureRef = sc.subclassFeatures[0];
					if (typeof firstFeatureRef === 'string') {
						// Resolve from service data
						const features = this._classService.getSubclassFeatures(
							sc.className,
							sc.shortName,
							1,
							sc.source || 'PHB'
						);
						const firstFeature = features.find(f => f.level === 1);
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
					description: this._getSubclassDescription(sc),
					entries,
					shortName: sc.shortName
				};
			});

		// Create a minimal session-like object for the selector
		const mockSession = {
			originalCharacter: character,
			stagedChanges: character,
			stepData: {
				selectedFeatures: {}
			}
		};

		// Show feature selector
		const selector = new ClassFeatureSelector(
			mockSession,
			this,
			className,
			'subclass',
			level,
			featureId
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
		const progressionClass = character.progression?.classes?.find(c => c.name === className);
		const oldSubclass = progressionClass?.subclass;

		// Check if subclass is actually changing
		const isChanging = oldSubclass && oldSubclass !== subclassName;

		if (isChanging) {
			console.log(`[ClassCard] Subclass changing from ${oldSubclass} to ${subclassName} - clearing old subclass data`);

			// 1. Clear subclass-specific features from progression.classes[].features
			if (progressionClass?.features) {
				// Remove features that came from the old subclass
				const oldSubclassData = this._classService.getSubclasses(className, classData.source)
					.find((sc) => sc.name === oldSubclass);

				if (oldSubclassData) {
					// Get all old subclass feature names
					const oldSubclassFeatureNames = new Set();
					const classLevel = progressionClass.levels || 1;
					const oldFeatures = this._classService.getSubclassFeatures(
						className,
						oldSubclassData.shortName || oldSubclass,
						classLevel,
						oldSubclassData.source || classData.source
					);

					for (const feature of oldFeatures) {
						oldSubclassFeatureNames.add(feature.name);
					}

					// Remove old subclass features
					progressionClass.features = (progressionClass.features || []).filter(
						featureName => !oldSubclassFeatureNames.has(featureName)
					);
				}
			}

			// 2. Clear subclass-specific optional feature choices from progression history
			// This includes invocations, metamagic, maneuvers, etc. that might be subclass-restricted
			const classLevel = progressionClass?.levels || 1;
			for (let level = 1; level <= classLevel; level++) {
				const choices = progressionHistoryService.getChoices(character, className, level);
				if (choices) {
					// Clear optional feature choices that might be subclass-specific
					// We'll let the user re-select them for the new subclass
					if (choices.invocation) {
						console.log(`[ClassCard] Clearing invocation choices at level ${level}`);
						delete choices.invocation;
					}
					if (choices.metamagic) {
						console.log(`[ClassCard] Clearing metamagic choices at level ${level}`);
						delete choices.metamagic;
					}
					if (choices['fighting-style']) {
						console.log(`[ClassCard] Clearing fighting-style choices at level ${level}`);
						delete choices['fighting-style'];
					}
					if (choices.maneuver) {
						console.log(`[ClassCard] Clearing maneuver choices at level ${level}`);
						delete choices.maneuver;
					}

					// Update the progression history with cleared choices
					progressionHistoryService.recordChoices(character, className, level, choices);
				}
			}

			// 3. Clear subclass-specific spells if the spellcasting is subclass-dependent
			// Some subclasses grant specific spell lists (e.g., Cleric domains)
			if (character.spellcasting?.classes?.[className]) {
				// Clear spell selections from progression.spellSelections for this class
				// The user will need to re-select appropriate spells for the new subclass
				if (character.progression?.spellSelections) {
					for (let level = 1; level <= classLevel; level++) {
						const sessionKey = `${className}_${level}`;
						if (character.progression.spellSelections[sessionKey]) {
							console.log(`[ClassCard] Clearing spell selections at level ${level}`);
							delete character.progression.spellSelections[sessionKey];
						}
					}
				}

				// Note: We keep spellsKnown intact for now, but the user can use the spell selection
				// UI to remove incompatible spells and add new ones
				console.log(`[ClassCard] Spell selections cleared - user should review and update spells`);
			}
		}

		// Update character's subclass in progression.classes[]
		if (progressionClass) {
			progressionClass.subclass = subclassName;

			// Get new subclass data to add subclass features
			const subclasses = this._classService.getSubclasses(className, classData.source);
			const subclassData = subclasses.find((sc) => sc.name === subclassName);

			if (subclassData) {
				// Update UI with new subclass data
				this.updateClassDetails(classData, subclassData);
			}
		}

		// Emit event to notify about character update
		eventBus.emit(EVENTS.CHARACTER_UPDATED, {
			character: CharacterManager.getCurrentCharacter(),
		});

		// Show notification if subclass was changed
		if (isChanging) {
			// Import notification service dynamically to avoid circular dependencies
			import('../../lib/NotificationCenter.js').then(({ notificationCenter }) => {
				notificationCenter.show(
					`Subclass changed to ${subclassName}. Please review and update your class features, spells, and other subclass-specific choices.`,
					'warning',
					5000
				);
			}).catch(err => {
				console.error('[ClassCard] Failed to show notification:', err);
			});
		}
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
		this._classInfoPanel = document.getElementById('classInfoPanel');
	}

	//-------------------------------------------------------------------------
	// Public API
	//-------------------------------------------------------------------------

	async updateAllDetails(classData, fluffData = null) {
		if (!classData) {
			this.resetAllDetails();
			return;
		}

		// Build the complete info panel content
		let html = '';

		// Class Description Section
		html += '<div class="info-section">';
		html += await this._renderClassDescription(classData, fluffData);
		html += '</div>';

		// Hit Die Section
		html += '<div class="info-section">';
		html += '<h6><i class="fas fa-heart"></i> Hit Die</h6>';
		html += `<div class="info-content">${this._formatHitDie(classData)}</div>`;
		html += '</div>';

		// Proficiencies Section
		html += '<div class="info-section">';
		html += '<h6><i class="fas fa-shield-alt"></i> Proficiencies</h6>';
		html += '<div class="info-content">';
		html += await this._renderProficiencies(classData);
		html += '</div>';
		html += '</div>';

		// Set the complete content
		this._classInfoPanel.innerHTML = html;

		// Process the entire panel at once to resolve all reference tags
		await textProcessor.processElement(this._classInfoPanel);
	}

	async _renderClassDescription(classData, fluffData = null) {
		let description = '';

		// Extract description from fluff data
		if (fluffData?.entries) {
			for (const entry of fluffData.entries) {
				if (entry.entries && Array.isArray(entry.entries)) {
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
			description = classData.description || `${classData.name} class features and characteristics.`;
		}

		return `
			<h5 class="info-title">${classData.name}</h5>
			<p class="info-description">${description}</p>
		`;
	}

	async _renderProficiencies(classData) {
		let html = '';

		// Skill Proficiencies
		html += '<div class="proficiency-group">';
		html += '<strong>Skills:</strong> ';
		html += `<span>${this._formatSkillProficiencies(classData)}</span>`;
		html += '</div>';

		// Saving Throws
		html += '<div class="proficiency-group">';
		html += '<strong>Saving Throws:</strong> ';
		const savingThrows = this._formatSavingThrows(classData);
		html += `<span>${savingThrows.join(', ') || 'None'}</span>`;
		html += '</div>';

		// Armor Proficiencies
		html += '<div class="proficiency-group">';
		html += '<strong>Armor:</strong> ';
		const armorProfs = this._formatArmorProficiencies(classData);
		html += `<span>${armorProfs.join(', ') || 'None'}</span>`;
		html += '</div>';

		// Weapon Proficiencies
		html += '<div class="proficiency-group">';
		html += '<strong>Weapons:</strong> ';
		const weaponProfs = this._formatWeaponProficiencies(classData);
		html += `<span>${weaponProfs.map(w => toTitleCase(w)).join(', ') || 'None'}</span>`;
		html += '</div>';

		// Tool Proficiencies
		const toolProfs = this._formatToolProficiencies(classData);
		if (toolProfs.length > 0) {
			html += '<div class="proficiency-group">';
			html += '<strong>Tools:</strong> ';
			html += `<span>${toolProfs.map(t => toSentenceCase(t)).join(', ')}</span>`;
			html += '</div>';
		}

		return html;
	}

	resetAllDetails() {
		if (!this._classInfoPanel) return;

		this._classInfoPanel.innerHTML = `
			<div class="info-section">
				<h5 class="info-title">Select a Class</h5>
				<p class="info-description">Choose a class to see details about their abilities, proficiencies, and other characteristics.</p>
			</div>
		`;
	}

	//-------------------------------------------------------------------------
	// Hit Die Section
	//-------------------------------------------------------------------------

	_formatHitDie(classData) {
		if (!classData?.hd) return 'Unknown';
		const faces = classData.hd.faces || classData.hd;
		return `1d${faces}`;
	}

	//-------------------------------------------------------------------------
	// Skill Proficiencies Section
	//-------------------------------------------------------------------------

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

	_formatSavingThrows(classData) {
		if (!classData?.proficiency) return [];
		return classData.proficiency.map((prof) => attAbvToFull(prof) || prof);
	}

	//-------------------------------------------------------------------------
	// Armor Proficiencies Section
	//-------------------------------------------------------------------------

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
