// Controller for managing ability score UI and interactions.
import { CharacterManager } from '../../../app/CharacterManager.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';

import { abilityScoreService } from '../../../services/AbilityScoreService.js';
import { bonusNotesView } from './BonusNotes.js';
import { abilityChoicesView } from './Choices.js';
import { methodControlsView } from './MethodControls.js';
import { methodSwitcherView } from './MethodSwitcher.js';
import { abilityScoreBoxView } from './ScoreBox.js';

class AbilityScoreCard {
	constructor() {
		// Main DOM containers (querySelector for container, getElementById for bonuses)
		this._container = document.querySelector('.ability-score-container');
		this._bonusesContainer = document.getElementById('abilityBonusesNotes');

		// Views (initialized after first render)
		this._methodSwitcherView = null;
		this._abilityScoreBoxView = null;
		this._abilityChoicesView = null;
		this._bonusNotesView = null;

		// Listener references
		this._abilityScoresChangedListener = null;
		this._handleContainerClicks = null;
		this._handleContainerChanges = null;
		this._debouncedCustomInput = null;

		// Initialization tracking
		this._initializedMethod = false;
		this._lastInitializedMethod = null;
	}

	async initialize() {
		try {
			// Re-fetch container references each time in case DOM has been rebuilt
			this._container = document.querySelector('.ability-score-container');
			this._bonusesContainer = document.getElementById('abilityBonusesNotes');

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

			// Add custom styles
			this._addStyles();

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


	_setupEventListeners() {
		try {
			// Remove any existing listeners first to prevent duplicates
			if (this._abilityScoresChangedListener) {
				document.removeEventListener(
					'abilityScoresChanged',
					this._abilityScoresChangedListener,
				);
			}
			if (this._handleCharacterChanged) {
				document.removeEventListener(
					'characterChanged',
					this._handleCharacterChanged,
				);
			}
			if (this._raceChangedListener) {
				document.removeEventListener('raceChanged', this._raceChangedListener);
			}
			if (this._subraceChangedListener) {
				document.removeEventListener(
					'subraceChanged',
					this._subraceChangedListener,
				);
			}

			// Create ability scores changed listener
			this._abilityScoresChangedListener = () => {
				console.debug(
					'AbilityScoreCard',
					'abilityScoresChanged event received',
				);
				this.update();
			};
			document.addEventListener(
				'abilityScoresChanged',
				this._abilityScoresChangedListener,
			); // Create character changed listener
			this._handleCharacterChanged = (_event) => {
				const character = CharacterManager.getCurrentCharacter();
				if (!character) return;

				console.debug('AbilityScoreCard', 'characterChanged event received', {
					name: character.name,
				});

				// Sync with current character first
				this._syncWithCurrentCharacter();

				// Then render the UI
				this.render();
			};
			document.addEventListener(
				'characterChanged',
				this._handleCharacterChanged,
			);

			// Remove existing click handlers on the container to prevent duplicates
			if (this._container) {
				if (this._handleContainerClicks) {
					this._container.removeEventListener(
						'click',
						this._handleContainerClicks,
					);
				}
				if (this._handleContainerChanges) {
					this._container.removeEventListener(
						'change',
						this._handleContainerChanges,
					);
				}

				// Create bound handler references for delegation
				this._handleContainerClicks =
					this._handleContainerClickEvent.bind(this);
				this._handleContainerChanges =
					this._handleContainerChangeEvent.bind(this);

				// Use delegation for all clicks and changes within the container
				this._container.addEventListener('click', this._handleContainerClicks);
				this._container.addEventListener(
					'change',
					this._handleContainerChanges,
				);
			}

			// Custom inputs - use delegation rather than individual listeners
			this._debouncedCustomInput = this._debounce(
				this._handleCustomInput.bind(this),
				300,
			);

			// Listen for race changes
			this._raceChangedListener = () => {
				this._updateAbilityScores();
			};
			document.addEventListener('raceChanged', this._raceChangedListener);

			// Listen for subrace changes
			this._subraceChangedListener = () => {
				this._updateAbilityScores();
			};
			document.addEventListener('subraceChanged', this._subraceChangedListener);
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

		// Reset method and render
		abilityScoreService.resetAbilityScoreMethod();
		this.render();

		// Notify that ability scores have changed
		document.dispatchEvent(
			new CustomEvent('abilityScoresChanged', {
				detail: { character },
			}),
		);
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
		let otherAbility = null;
		for (const checkAbility of abilityScoreService.getAllAbilities()) {
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
				this._handleStandardArraySelection.bind(this),
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
		const isPointBuy =
			CharacterManager.getCurrentCharacter()?.variantRules
				?.abilityScoreMethod === 'pointBuy';
		this._abilityScoreBoxView.updateAbilityScoreValues(isPointBuy);
	}

	/**
	 * Updates all standard array option dropdowns
	 * @private
	 */
	_updateAllStandardArrayOptions() {
		for (const ability of abilityScoreService.getAllAbilities()) {
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

	_addStyles() {
		const style = document.createElement('style');
		style.id = 'ability-score-methods-styles';

		style.textContent = `
            .ability-score-method-info {
                margin-bottom: 12px;
            }
            
            .ability-score-method-info .card {
                background-color: var(--card-bg-color, #f8f9fa);
                border-color: var(--border-color, #dee2e6);
                border-radius: var(--border-radius, 4px);
            }
            
            .point-cost {
                font-size: 11px;
                font-weight: 600;
                margin-left: 8px;
                padding: 2px 6px;
                border-radius: 4px;
                display: inline-block;
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
            }
            
            .point-cost.low {
                color: #0d6efd;
            }
            
            .point-cost.medium {
                color: #fd7e14;
            }
            
            .point-cost.high {
                color: #dc3545;
            }
            
            .ability-controls {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
            }
            
            .standard-array-select {
                width: 100%;
                max-width: 120px;
                margin: 0 auto;
            }
            
            @keyframes flashBorder {
                0% { border-color: var(--border-color, #dee2e6); }
                50% { border-color: var(--accent-color); }
                100% { border-color: var(--border-color, #dee2e6); }
            }
            
            .ability-score-box.flash-border {
                animation: flashBorder 0.5s ease;
            }
        `;

		// Only add if not already present
		if (!document.getElementById('ability-score-methods-styles')) {
			document.head.appendChild(style);
		}
	}

	/**
	 * Removes event listeners when the card is destroyed
	 */
	remove() {
		if (this._abilityScoresChangedListener) {
			document.removeEventListener(
				'abilityScoresChanged',
				this._abilityScoresChangedListener,
			);
		}

		if (this._container && this._handleContainerClicks) {
			this._container.removeEventListener('click', this._handleContainerClicks);
		}

		if (this._container && this._handleContainerChanges) {
			this._container.removeEventListener(
				'change',
				this._handleContainerChanges,
			);
		}
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
