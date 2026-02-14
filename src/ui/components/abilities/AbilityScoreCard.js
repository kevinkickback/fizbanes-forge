// Controller for managing ability score UI and interactions.
import { CharacterManager } from '../../../app/CharacterManager.js';
import { ABILITY_ABBREVIATIONS, attAbvToFull, toSentenceCase } from '../../../lib/5eToolsParser.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { textProcessor } from '../../../lib/TextProcessor.js';

import { abilityScoreService } from '../../../services/AbilityScoreService.js';
import { skillService } from '../../../services/SkillService.js';
import { variantRuleService } from '../../../services/VariantRuleService.js';
import { bonusNotesView } from './AbilityScoreBonusNotes.js';
import { abilityScoreBoxView } from './AbilityScoreBox.js';
import { abilityChoicesView } from './AbilityScoreChoices.js';
import { methodControlsView } from './AbilityScoreMethodControls.js';
import { methodSwitcherView } from './AbilityScoreMethodSwitcher.js';

// Full lowercase ability names matching data-ability attributes in the DOM
const ABILITIES = ABILITY_ABBREVIATIONS.map(a => attAbvToFull(a).toLowerCase());

class AbilityScoreCard {
	constructor() {
		// Main DOM containers (querySelector for container, getElementById for bonuses)
		this._container = document.querySelector('.ability-score-container');
		this._bonusesContainer = document.getElementById('abilityBonusesNotes');
		this._infoPanel = document.getElementById('abilityScoreInfoPanel');
		this._toggleBtn = document.getElementById('abilityScoreInfoToggle');

		// Views (initialized after first render)
		this._methodSwitcherView = null;
		this._abilityScoreBoxView = null;
		this._abilityChoicesView = null;
		this._bonusNotesView = null;

		// Listener references (for EventBus only, DOM listeners managed by DOMCleanup)
		this._characterSelectedHandler = null;
		this._characterUpdatedHandler = null;

		// Initialization tracking
		this._initializedMethod = false;
		this._lastInitializedMethod = null;

		// DOM cleanup manager
		this._cleanup = DOMCleanup.create();
	}

	async initialize() {
		try {
			// Re-fetch container references each time in case DOM has been rebuilt
			this._container = document.querySelector('.ability-score-container');
			this._bonusesContainer = document.getElementById('abilityBonusesNotes');
			this._infoPanel = document.getElementById('abilityScoreInfoPanel');
			this._toggleBtn = document.getElementById('abilityScoreInfoToggle');

			// Ensure skill service is initialized
			await skillService.initialize();

			// Get or create view instances
			this._methodSwitcherView = methodSwitcherView(this._container);
			this._abilityScoreBoxView = abilityScoreBoxView(this._container);
			this._abilityChoicesView = abilityChoicesView(this._container);
			this._bonusNotesView = bonusNotesView(this._bonusesContainer);

			// IMPORTANT: Update container references for singleton instances
			// This ensures they reference the current DOM elements when re-initializing
			this._methodSwitcherView.setContainer(this._container);
			this._abilityScoreBoxView.setContainer(this._container);
			this._abilityChoicesView.setContainer(this._container);
			this._bonusNotesView.setContainer(this._bonusesContainer);

			// Sync with current character
			this._syncWithCurrentCharacter();

			// Set up event listeners
			this._setupEventListeners();

			// Setup toggle button and hover listeners
			this._setupToggleButton();
			this._setupAbilityHoverListeners();
			await this._showDefaultInfoPlaceholder();

			// Initial render
			this.render();

			return true;
		} catch (error) {
			console.error(
				'AbilityScoreCard',
				'Failed to initialize AbilityScoreCard:',
				error,
			);
			return false;
		}
	}

	_syncWithCurrentCharacter() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Set default ability score method if not already set
		if (!character.variantRules) {
			character.variantRules = {};
		}

		if (!character.variantRules.abilityScoreMethod) {
			character.variantRules.abilityScoreMethod = 'custom';
		}

		// Force the abilityScoreService to reset based on current character method
		abilityScoreService.resetAbilityScoreMethod();

		// Update UI element to reflect current method
		const methodSelect = document.getElementById('abilityScoreMethod');
		if (methodSelect) {
			methodSelect.value = character.variantRules.abilityScoreMethod;
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

	_setupAbilityHoverListeners() {
		const abilityBoxes = document.querySelectorAll('.ability-score-box');

		abilityBoxes.forEach((box) => {
			this._cleanup.on(box, 'mouseenter', () => {
				const ability = box.getAttribute('data-ability');
				if (ability) {
					this._showSkillsForAbility(ability);
					// Expand the info panel on hover
					if (this._infoPanel) {
						this._infoPanel.classList.remove('collapsed');
					}
				}
			});
		});
	}

	async _showDefaultInfoPlaceholder() {
		const infoContent = document.getElementById('abilityScoreInfoContent');
		if (!infoContent) return;

		// Load description from variant rules JSON
		const rule = variantRuleService.getVariantRule('Ability Score and Modifier');
		const description = rule?.entries?.[0] || 'A creature has six ability scores—Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma—each of which has a corresponding modifier.';

		infoContent.innerHTML = `
			<div class="ability-info">
				<h5><i class="fas fa-dice-d20 me-2"></i>Ability Scores</h5>
				<div class="mt-3">
					${description}
				</div>
				<p class="text-muted small mt-3">Hover over an ability to see related skills.</p>
			</div>
		`;

		await textProcessor.processElement(infoContent);
	}

	async _showSkillsForAbility(ability) {
		if (!this._infoPanel) return;

		const skills = skillService.getSkillsByAbility(ability);
		const infoContent = document.getElementById('abilityScoreInfoContent');

		if (!infoContent) return;

		// Special handling for Constitution (no skills, but has health/concentration)
		if (ability === 'constitution' && skills.length === 0) {
			infoContent.innerHTML = `
				<div class="mb-2">
					<h5>Constitution Effects</h5>
					<p class="text-muted small">Constitution affects the following:</p>
				</div>
				<div class="skill-info mb-3">
					<h6 class="mb-1">Hit Points</h6>
					<p class="small text-muted mb-0">Your Constitution modifier is added to each Hit Die you roll for your hit points.</p>
				</div>
				<div class="skill-info mb-3">
					<h6 class="mb-1">Concentration</h6>
					<p class="small text-muted mb-0">Constitution saves determine whether you maintain concentration on a spell when you take damage.</p>
				</div>
				<p class="text-muted small mt-3">Source: PHB, p. 174</p>
			`;
			return;
		}

		if (skills.length === 0) {
			infoContent.innerHTML = `
				<h6>${toSentenceCase(ability)}</h6>
				<p class="text-muted small">No skills use this ability score.</p>
			`;
			await textProcessor.processElement(infoContent);
			return;
		}

		// Group skills by name (PHB vs XPHB versions) and prefer XPHB or most recent
		const uniqueSkills = new Map();
		for (const skill of skills) {
			if (!uniqueSkills.has(skill.name) || skill.source === 'XPHB') {
				uniqueSkills.set(skill.name, skill);
			}
		}

		const skillsHTML = Array.from(uniqueSkills.values())
			.map((skill) => {
				const description = skill.entries?.[0] || 'No description available.';
				return `
					<div class="skill-info mb-3">
						<h6 class="mb-1">${skill.name}</h6>
						<p class="small text-muted mb-0">${description}</p>
					</div>
				`;
			})
			.join('');

		infoContent.innerHTML = `
			<div class="mb-2">
				<h5>${toSentenceCase(ability)} Skills</h5>
				<p class="text-muted small">Skills that use this ability score:</p>
			</div>
			${skillsHTML}
			<p class="text-muted small mt-3">Source: PHB, p. 174</p>
		`;
		await textProcessor.processElement(infoContent);
	}

	_setupEventListeners() {
		try {
			// Remove existing EventBus listeners to prevent duplicates
			if (this._characterSelectedHandler) {
				eventBus.off(EVENTS.CHARACTER_SELECTED, this._characterSelectedHandler);
			}
			if (this._characterUpdatedHandler) {
				eventBus.off(EVENTS.CHARACTER_UPDATED, this._characterUpdatedHandler);
			}

			// Listen to EventBus CHARACTER_SELECTED (when character is loaded/switched)
			this._characterSelectedHandler = (character) => {
				if (!character) return;

				// Sync with current character first
				this._syncWithCurrentCharacter();

				// Then render the UI
				this.render();
			};
			eventBus.on(EVENTS.CHARACTER_SELECTED, this._characterSelectedHandler);

			// Listen to EventBus CHARACTER_UPDATED (when character data changes)
			this._characterUpdatedHandler = () => {
				this.update();
			};
			eventBus.on(EVENTS.CHARACTER_UPDATED, this._characterUpdatedHandler);

			// Listen for ability score changes from race, class, or other components
			// Uses EventBus for proper cleanup tracking
			this._cleanup.onEvent(EVENTS.ABILITY_SCORES_CHANGED, () => {
				this.update();
			});

			// Use DOMCleanup for container delegation listeners
			if (this._container) {
				this._cleanup.on(this._container, 'click', this._handleContainerClickEvent.bind(this));
				this._cleanup.on(this._container, 'change', this._handleContainerChangeEvent.bind(this));
			}

			// Custom inputs - use delegation rather than individual listeners
			this._debouncedCustomInput = this._debounce(
				this._handleCustomInput.bind(this),
				300,
			);

		} catch (error) {
			console.error(
				'AbilityScoreCard',
				'Error setting up event listeners:',
				error,
			);
		}
	}

	//-------------------------------------------------------------------------
	// Event Handlers
	//-------------------------------------------------------------------------

	/**
	 * Handles all click events within the ability score container (delegation)
	 * @param {Event} event - The click event
	 * @private
	 */
	_handleContainerClickEvent(event) {
		const button = event.target.closest('button[data-action]');
		if (!button) return;

		const action = button.dataset.action;

		// Handle increase/decrease button clicks
		if (action === 'increase') {
			this._handlePointBuyIncrease(button);
		} else if (action === 'decrease') {
			this._handlePointBuyDecrease(button);
		}
	}

	_handleContainerChangeEvent(event) {
		if (event.target.classList.contains('ability-choice-select')) {
			this._handleAbilityChoice(event);
		} else if (event.target.classList.contains('standard-array-select')) {
			this._handleStandardArraySelection(event);
		} else if (event.target.classList.contains('ability-custom-input')) {
			this._debouncedCustomInput(event);
		}
	}

	_handleMethodChange(event) {
		const method = event.target.value;
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Update character's variant rules
		if (!character.variantRules) {
			character.variantRules = {};
		}
		character.variantRules.abilityScoreMethod = method;

		// Show/hide point counter based on method
		if (method === 'pointBuy') {
			this._methodSwitcherView.showPointBuyCounter();
		} else {
			this._methodSwitcherView.hidePointBuyCounter();
		}

		// Reset method and render
		abilityScoreService.resetAbilityScoreMethod();
		this.render();

		// Notify that ability scores have changed
		eventBus.emit(EVENTS.ABILITY_SCORES_CHANGED, { character });
	}

	_handleStandardArraySelection(event) {
		const ability = event.target.dataset.ability;
		const newValue = Number.parseInt(event.target.value, 10);

		if (!ability || Number.isNaN(newValue)) {
			return;
		}

		// Find if this value is already assigned to another ability
		const currentAbilityScore = abilityScoreService.getBaseScore(ability);

		// Check all abilities to see if any have this value assigned
		// Use ABILITIES (full names) to match data-ability attributes in the DOM
		let otherAbility = null;
		for (const checkAbility of ABILITIES) {
			// Skip the current ability
			if (checkAbility === ability) {
				continue;
			}

			// Check if this ability has the value we want to assign
			if (abilityScoreService.getBaseScore(checkAbility) === newValue) {
				otherAbility = checkAbility;
				break;
			}
		}

		// If value is already assigned to another ability, swap them
		if (otherAbility) {
			abilityScoreService.updateAbilityScore(otherAbility, currentAbilityScore);
		}

		// Update the current ability score with the new value
		abilityScoreService.updateAbilityScore(ability, newValue);

		// Update all standard array dropdowns to reflect the new assignments
		this._updateAllStandardArrayOptions();

		// Emit CHARACTER_UPDATED event
		console.debug(
			'AbilityScoreCard',
			'Emitting CHARACTER_UPDATED for ability score change',
			{ ability, newValue },
		);
		eventBus.emit(EVENTS.CHARACTER_UPDATED, {
			character: CharacterManager.getCurrentCharacter(),
		});
	}

	/**
	 * Handles increasing ability scores for point buy
	 * @param {HTMLElement} btn - The button element
	 * @private
	 */
	_handlePointBuyIncrease(btn) {
		const ability = btn.dataset.ability;
		if (!ability) return;

		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const currentScore = abilityScoreService.getBaseScore(ability);
		const newScore = currentScore + 1;

		// Determine method
		const method = character.variantRules?.abilityScoreMethod || 'custom';
		const isPointBuy = method === 'pointBuy';

		// Apply different constraints based on the method
		if (isPointBuy) {
			// For point buy, enforce 8-15 range and check remaining points
			const currentCost = abilityScoreService.getPointCost(currentScore) || 0;
			const newCost = abilityScoreService.getPointCost(newScore) || 0;
			const costDifference = newCost - currentCost;
			const remainingPoints = abilityScoreService.getRemainingPoints();

			// Check if score is at max or not enough points
			if (newScore > 15 || costDifference > remainingPoints) {
				// Flash the border to indicate limit reached
				this._abilityScoreBoxView.flashBorder(ability);
				return;
			}
		} else {
			// For other methods, enforce general max of 20
			if (newScore > 20) {
				// Flash the border to indicate limit reached
				this._abilityScoreBoxView.flashBorder(ability);
				return;
			}
		}

		// Update the score
		abilityScoreService.updateAbilityScore(ability, newScore);

		// Only update points counter if using point buy (to reduce lag)
		if (isPointBuy) {
			this._methodSwitcherView.updatePointBuyCounter();
		}

		// Update the UI to show the new score
		this._updateAbilityScoreValues();

		// Emit CHARACTER_UPDATED event
		console.debug(
			'AbilityScoreCard',
			'Emitting CHARACTER_UPDATED for point buy increase',
			{ ability, newScore },
		);
		eventBus.emit(EVENTS.CHARACTER_UPDATED, {
			character: CharacterManager.getCurrentCharacter(),
		});
	}

	_handlePointBuyDecrease(btn) {
		const ability = btn.dataset.ability;
		if (!ability) return;

		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const currentScore = abilityScoreService.getBaseScore(ability);
		const newScore = currentScore - 1;

		// Determine method
		const method = character.variantRules?.abilityScoreMethod || 'custom';
		const isPointBuy = method === 'pointBuy';

		// Apply different constraints based on the method
		if (isPointBuy) {
			// For point buy, enforce 8-15 range
			if (newScore < 8) {
				// Flash the border to indicate limit reached
				this._abilityScoreBoxView.flashBorder(ability);
				return;
			}
		} else {
			// For other methods, enforce general min of 3
			if (newScore < 3) {
				// Flash the border to indicate limit reached
				this._abilityScoreBoxView.flashBorder(ability);
				return;
			}
		}

		// Update the score
		abilityScoreService.updateAbilityScore(ability, newScore);

		// Only update points counter if using point buy (to reduce lag)
		if (isPointBuy) {
			this._methodSwitcherView.updatePointBuyCounter();
		}

		// Update the UI to show the new score
		this._updateAbilityScoreValues();

		// Emit CHARACTER_UPDATED event
		console.debug(
			'AbilityScoreCard',
			'Emitting CHARACTER_UPDATED for point buy decrease',
			{ ability, newScore },
		);
		eventBus.emit(EVENTS.CHARACTER_UPDATED, {
			character: CharacterManager.getCurrentCharacter(),
		});
	}

	_handleCustomInput(event) {
		const ability = event.target.dataset.ability;
		if (!ability) return;

		const newValue = Number.parseInt(event.target.value, 10);
		if (!Number.isNaN(newValue)) {
			abilityScoreService.updateAbilityScore(ability, newValue);
			// No need to render here as it will cause input focus loss
			this._updateAbilityScoreValues();

			// Emit CHARACTER_UPDATED event
			console.debug(
				'AbilityScoreCard',
				'Emitting CHARACTER_UPDATED for custom score input',
				{ ability, newValue },
			);
			eventBus.emit(EVENTS.CHARACTER_UPDATED, {
				character: CharacterManager.getCurrentCharacter(),
			});
		}
	}

	/**
	 * Handles the selection of an ability choice from a dropdown
	 * @param {Event} event - The change event from the dropdown
	 * @private
	 */
	_handleAbilityChoice(event) {
		const select = event.target;
		const choiceIndex = Number.parseInt(select.dataset.choiceIndex, 10);
		const bonus = Number.parseInt(select.dataset.bonus, 10);
		const source = select.dataset.source;
		const selectedAbility = select.value;

		// Use the abilityScoreService to handle the choice
		abilityScoreService.handleAbilityChoice(
			selectedAbility,
			choiceIndex,
			bonus,
			source,
		);

		// Refresh the ability choices UI
		this._abilityChoicesView.render(this._handleAbilityChoice.bind(this));

		// Update all score display and bonus notes
		this._renderAbilityScores();
		this._bonusNotesView.render();

		// Emit CHARACTER_UPDATED event
		console.debug(
			'AbilityScoreCard',
			'Emitting CHARACTER_UPDATED for ability choice selection',
			{ selectedAbility, bonus, source },
		);
		eventBus.emit(EVENTS.CHARACTER_UPDATED, {
			character: CharacterManager.getCurrentCharacter(),
		});
	}

	//-------------------------------------------------------------------------
	// Rendering Methods
	//-------------------------------------------------------------------------

	render() {
		console.debug('[AbilityScoreCard]', 'render() called');
		try {
			// Initialize scoring method system if needed
			this._initializeAbilityScoreMethod();

			// Make sure assigned standard array values are updated
			if (
				CharacterManager.getCurrentCharacter()?.variantRules
					?.abilityScoreMethod === 'standardArray'
			) {
				abilityScoreService.updateAssignedStandardArrayValues();
			}

			// Render method switcher/info
			this._methodSwitcherView.render(this._handleMethodChange.bind(this));
			// Get current method and show/hide point counter accordingly
			const character = CharacterManager.getCurrentCharacter();
			if (character) {
				const currentMethod =
					character.variantRules?.abilityScoreMethod || 'custom';
				if (currentMethod === 'pointBuy') {
					this._methodSwitcherView.showPointBuyCounter();
				} else {
					this._methodSwitcherView.hidePointBuyCounter();
				}
			}
			// Render ability scores
			this._renderAbilityScores();

			// Render ability choices
			this._abilityChoicesView.render(this._handleAbilityChoice.bind(this));

			// Render bonus notes
			this._bonusNotesView.render();
		} catch (error) {
			console.error(
				'AbilityScoreCard',
				'Error rendering ability score card:',
				error,
			);
		}
	}

	update() {
		this._updateAbilityScoreValues();
		this._abilityChoicesView.render(this._handleAbilityChoice.bind(this));
		this._bonusNotesView.render();
	}

	_renderAbilityScores() {
		try {
			// Get the ability score method directly from character
			const character = CharacterManager.getCurrentCharacter();
			if (!character) {
				console.warn('[AbilityScoreCard]', 'No character found in _renderAbilityScores');
				return;
			}

			// Always get the method directly from character.variantRules to ensure consistency
			const methodFromCharacter =
				character.variantRules?.abilityScoreMethod || 'custom';

			const isStandardArray = methodFromCharacter === 'standardArray';
			const isPointBuy = methodFromCharacter === 'pointBuy';
			const isCustom = methodFromCharacter === 'custom';

			// Render all ability score boxes
			this._abilityScoreBoxView.renderAllAbilityScores(
				isStandardArray,
				isPointBuy,
				isCustom,
			);
		} catch (error) {
			console.error(
				'AbilityScoreCard',
				'Error rendering ability scores:',
				error,
			);
		}
	}

	//-------------------------------------------------------------------------
	// Update Methods
	//-------------------------------------------------------------------------

	_updateAbilityScoreValues() {
		this._abilityScoreBoxView.updateAbilityScoreValues();
	}

	/**
	 * Updates all standard array option dropdowns
	 * @private
	 */
	_updateAllStandardArrayOptions() {
		// Use ABILITIES (full names) to match data-ability attributes in the DOM
		for (const ability of ABILITIES) {
			const box = this._container.querySelector(`[data-ability="${ability}"]`);
			if (!box) continue;

			const select = box.querySelector('.standard-array-select');
			if (!select) continue;

			methodControlsView.updateStandardArrayOptions(select, ability);
		}
	}

	_updateAbilityScores() {
		this._abilityScoreBoxView.updateAllAbilityScores();
		this._abilityChoicesView.render(this._handleAbilityChoice.bind(this));
		this._bonusNotesView.render();
	}

	//-------------------------------------------------------------------------
	// Public Coordination Methods (called by BuildPageController)
	//-------------------------------------------------------------------------

	refreshForRaceChange() {
		this._updateAbilityScores();
	}

	refreshForCharacterChange() {
		this._syncWithCurrentCharacter();
		this.render();
	}

	//-------------------------------------------------------------------------
	// Utility Methods
	//-------------------------------------------------------------------------

	_initializeAbilityScoreMethod() {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Only initialize if not already done for this method
		if (
			!this._initializedMethod ||
			this._lastInitializedMethod !== character.variantRules?.abilityScoreMethod
		) {
			this._lastInitializedMethod =
				character.variantRules?.abilityScoreMethod || 'custom';
			this._initializedMethod = true;

			// Update UI element to reflect current method
			const methodSelect = document.getElementById('abilityScoreMethod');
			if (methodSelect) {
				methodSelect.value = this._lastInitializedMethod;
			}

			// Ensure ability scores are properly initialized for the selected method
			abilityScoreService.resetAbilityScoreMethod();

			// For standard array, make sure the assignments are tracked properly
			if (this._lastInitializedMethod === 'standardArray') {
				abilityScoreService.updateAssignedStandardArrayValues();

				// Manually update all dropdowns to ensure they show correct values
				setTimeout(() => {
					this._updateAllStandardArrayOptions();
				}, 100);
			}
		}
	}

	_debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	/**
	 * Removes event listeners when the card is destroyed
	 */
	remove() {
		// Remove EventBus listeners
		if (this._characterSelectedHandler) {
			eventBus.off(EVENTS.CHARACTER_SELECTED, this._characterSelectedHandler);
		}

		if (this._characterUpdatedHandler) {
			eventBus.off(EVENTS.CHARACTER_UPDATED, this._characterUpdatedHandler);
		}

		// Clean up all DOM listeners
		this._cleanup.cleanup();
	}

	/**
	 * Initializes ability scores for a newly loaded character
	 * This should be called when a character is first loaded
	 * @param {Character} character - The character to initialize ability scores for
	 * @static
	 */
	static initializeForCharacter(character) {
		if (!character) return;

		// Get the ability score method from the character
		const method = character.variantRules?.abilityScoreMethod || 'custom';

		// Update the ability score manager based on the method
		if (method === 'standardArray') {
			abilityScoreService.updateAssignedStandardArrayValues();
		} else if (method === 'pointBuy') {
			abilityScoreService.getUsedPoints();
		}
	}
}

let _instance = null;

/**
 * Singleton accessor for AbilityScoreCard
 */
AbilityScoreCard.getInstance = () => {
	if (!_instance) {
		_instance = new AbilityScoreCard();
	}
	return _instance;
};

export { AbilityScoreCard };
export const abilityScoreCard = AbilityScoreCard.getInstance();
