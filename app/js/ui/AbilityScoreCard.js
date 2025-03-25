/**
 * AbilityScoreCard.js
 * Handles UI updates for ability scores, including rendering ability score boxes,
 * managing ability choice dropdowns, and displaying bonus notes.
 * 
 * @typedef {Object} AbilityChoice
 * @property {string} source - Source of the ability choice (e.g., "Race", "Background")
 * @property {number} amount - Amount of the bonus to apply
 * @property {boolean} [isChoice] - Whether this is a choice-based bonus
 * 
 * @typedef {Object} BonusGroup
 * @property {string} ability - The ability name
 * @property {number} value - The bonus value
 * @property {string} source - Source of the bonus
 * @property {boolean} [isChoice] - Whether this is a choice-based bonus
 * 
 * @typedef {Object} AbilityScoreBox
 * @property {HTMLElement} score - Element displaying the ability score
 * @property {HTMLElement} modifier - Element displaying the ability modifier
 * @property {HTMLElement} bonus - Element displaying any bonus
 */

import { abilityScoreManager } from '../managers/AbilityScoreManager.js';
import { characterHandler } from '../utils/characterHandler.js';
import { textProcessor } from '../utils/TextProcessor.js';

export class AbilityScoreCard {
    /**
     * Creates a new AbilityScoreCard instance
     * @constructor
     */
    constructor() {
        this.container = document.querySelector('.ability-score-container');
        this.bonusesContainer = document.getElementById('abilityBonusesNotes');
        this.abilityScoresChangedListener = () => this.render();
        this.initialize();
    }

    /**
     * Initializes the ability score card by rendering content and setting up event listeners
     */
    initialize() {
        console.log('[AbilityScoreCard] Initializing');
        this.render();
        this.setupEventListeners();
    }

    /**
     * Renders the entire ability score card, including scores, choices, and bonus notes
     */
    render() {
        console.log('[AbilityScoreCard] Rendering ability score card');

        if (!this.container) {
            console.log('[AbilityScoreCard] Container not found, skipping render');
            return;
        }

        this._renderAbilityScores();
        this._renderAbilityChoices();
        this._renderBonusNotes();
    }

    /**
     * Renders the ability score boxes with their current values and modifiers
     * @private
     */
    _renderAbilityScores() {
        for (const ability of abilityScoreManager.getAllAbilities()) {
            const box = this.container.querySelector(`[data-ability="${ability}"]`);
            if (box) {
                const score = abilityScoreManager.getTotalScore(ability);
                console.log(`[AbilityScoreCard] Updating ${ability} score to ${score}`);
                box.querySelector('.score').textContent = score;
                box.querySelector('.modifier').textContent = abilityScoreManager.getModifier(score);
                const bonusDiv = box.querySelector('.bonus');
                bonusDiv.innerHTML = this.renderBonus(ability);
            }
        }
    }

    /**
     * Renders the ability choice dropdowns for pending ability score choices
     * @private
     */
    _renderAbilityChoices() {
        const pendingChoices = abilityScoreManager.getPendingChoices();
        console.log('[AbilityScoreCard] Pending ability choices:', pendingChoices);

        if (pendingChoices.length === 0) {
            this._removeChoicesContainer();
            return;
        }

        const choicesContainer = this._getOrCreateChoicesContainer();
        choicesContainer.innerHTML = this._createAbilityChoicesContent(pendingChoices);
        this._setupChoiceEventListeners(choicesContainer);
    }

    /**
     * Creates the HTML content for ability choice dropdowns
     * @param {Array<AbilityChoice>} pendingChoices - Array of pending ability choices
     * @returns {string} HTML content for the choices
     * @private
     */
    _createAbilityChoicesContent(pendingChoices) {
        return `
            <div class="ability-choices-grid">
                ${pendingChoices.map((choice, index) => this._createChoiceDropdown(choice, index)).join('')}
            </div>
        `;
    }

    /**
     * Creates a single ability choice dropdown
     * @param {AbilityChoice} choice - The ability choice object
     * @param {number} index - The index of the choice
     * @returns {string} HTML content for the dropdown
     * @private
     */
    _createChoiceDropdown(choice, index) {
        const availableAbilities = abilityScoreManager.getAvailableAbilities(index);
        const selectedAbility = abilityScoreManager.abilityChoices.get(index);

        console.log(`[AbilityScoreCard] Creating dropdown for choice ${index}:`, {
            source: choice.source,
            amount: choice.amount,
            availableAbilities,
            selectedAbility
        });

        return `
            <div class="ability-choice-group">
                <label class="form-label">+${choice.amount} bonus (${choice.source.replace(/\s+\d+$/, '')})</label>
                <select class="form-select form-select-sm ability-choice-select" 
                    data-choice-index="${index}" 
                    data-bonus="${choice.amount}" 
                    data-source="${choice.source}">
                    <option value="">Choose...</option>
                    ${availableAbilities.map(ability => `
                        <option value="${ability}" ${selectedAbility === ability ? 'selected' : ''}>
                            ${this._getAbilityAbbreviation(ability)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    /**
     * Gets or creates the choices container element
     * @returns {HTMLElement} The choices container element
     * @private
     */
    _getOrCreateChoicesContainer() {
        let container = this.container.querySelector('.ability-choices-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'ability-choices-container';
            this.container.appendChild(container);
        }
        return container;
    }

    /**
     * Removes the choices container if it exists
     * @private
     */
    _removeChoicesContainer() {
        const container = this.container.querySelector('.ability-choices-container');
        if (container) {
            container.remove();
        }
    }

    /**
     * Sets up event listeners for ability choice dropdowns
     * @param {HTMLElement} container - The container with the dropdowns
     * @private
     */
    _setupChoiceEventListeners(container) {
        const dropdowns = container.querySelectorAll('.ability-choice-select');
        for (const dropdown of dropdowns) {
            dropdown.addEventListener('change', (e) => this.handleAbilityChoice(e));
        }
    }

    /**
     * Renders the bonus notes section that explains all active ability score bonuses
     * @private
     */
    _renderBonusNotes() {
        const bonusGroups = abilityScoreManager.getBonusGroups();
        console.log('[AbilityScoreCard] Bonus groups:', Array.from(bonusGroups.entries()));

        if (bonusGroups.size === 0) {
            this.bonusesContainer.innerHTML = '<div class="text-muted">No ability score bonuses applied.</div>';
            return;
        }

        let bonusContent = '<h6 class="mb-2">Ability Score Bonuses</h6>';
        const raceBonuses = this._processRaceBonuses(bonusGroups);

        if (raceBonuses.length > 0) {
            bonusContent += this._createBonusNote('Race', raceBonuses.join(', '));
        }

        // Process remaining bonus groups
        for (const [source, bonusList] of bonusGroups.entries()) {
            if (source.startsWith('Race')) continue; // Skip race bonuses as they're handled separately

            const bonusText = bonusList.map(b =>
                `${this._getAbilityAbbreviation(b.ability)} ${b.value >= 0 ? '+' : ''}${b.value}`
            ).join(', ');
            bonusContent += this._createBonusNote(source, bonusText);
        }

        this.bonusesContainer.innerHTML = bonusContent;

        // Process the bonuses container to resolve any reference tags
        textProcessor.processElement(this.bonusesContainer);
    }

    /**
     * Processes race-related bonuses and formats them for display
     * @param {Map<string, Array<BonusGroup>>} bonusGroups - Map of all bonus groups
     * @returns {Array<string>} Array of formatted race bonus strings
     * @private
     */
    _processRaceBonuses(bonusGroups) {
        const raceRelatedSources = ['Race', 'Subrace', 'Race Choice 1', 'Race Choice 2', 'Race Choice 3', 'Subrace Choice 1', 'Subrace Choice 2', 'Subrace Choice 3'];
        const raceBonuses = new Map();
        const allRaceBonuses = [];

        // Collect race-related bonuses
        for (const source of raceRelatedSources) {
            if (bonusGroups.has(source)) {
                raceBonuses.set(source, bonusGroups.get(source));
                bonusGroups.delete(source);
            }
        }

        // Process all fixed race and subrace bonuses together
        const fixedBonuses = [];
        for (const [source, bonusList] of raceBonuses.entries()) {
            if (source === 'Race' || source === 'Subrace') {
                const bonuses = bonusList.filter(b => !b.isChoice);
                fixedBonuses.push(...bonuses);
            }
        }

        // Format all fixed bonuses into a single line
        if (fixedBonuses.length > 0) {
            const formattedBonuses = fixedBonuses.map(bonus =>
                `${this._getAbilityAbbreviation(bonus.ability)} ${bonus.value >= 0 ? '+' : ''}${bonus.value}`
            ).join(', ');
            allRaceBonuses.push(formattedBonuses);
        }

        // Process choice bonuses separately
        for (const [source, bonusList] of raceBonuses.entries()) {
            if (source.includes('Choice')) {
                for (const bonus of bonusList) {
                    allRaceBonuses.push(
                        `${this._getAbilityAbbreviation(bonus.ability)} ${bonus.value >= 0 ? '+' : ''}${bonus.value} (choice)`
                    );
                }
            }
        }

        return allRaceBonuses;
    }

    /**
     * Creates a bonus note HTML element
     * @param {string} source - The source of the bonus
     * @param {string} content - The bonus content
     * @returns {string} HTML for the bonus note
     * @private
     */
    _createBonusNote(source, content) {
        return `<div class="bonus-note">
            <strong>${source}</strong>: ${content}
        </div>`;
    }

    /**
     * Renders the bonus display for a specific ability
     * @param {string} ability - The ability name
     * @returns {string} HTML for the bonus display
     */
    renderBonus(ability) {
        const score = abilityScoreManager.getTotalScore(ability);
        const baseScore = abilityScoreManager.getBaseScore(ability);
        const totalBonus = score - baseScore;

        if (totalBonus === 0) return '';

        const bonusClass = totalBonus >= 0 ? 'bonus' : 'bonus negative';
        return `<div class="${bonusClass}">${totalBonus >= 0 ? '+' : ''}${totalBonus}</div>`;
    }

    /**
     * Handles the selection of an ability choice from a dropdown
     * @param {Event} event - The change event from the dropdown
     */
    handleAbilityChoice(event) {
        const select = event.target;
        const choiceIndex = Number.parseInt(select.dataset.choiceIndex, 10);
        const bonus = Number.parseInt(select.dataset.bonus, 10);
        const source = select.dataset.source;
        const selectedAbility = select.value;

        abilityScoreManager.handleAbilityChoice(selectedAbility, choiceIndex, bonus, source);
    }

    /**
     * Sets up event listeners for the ability score card
     */
    setupEventListeners() {
        console.log('[AbilityScoreCard] Setting up event listeners');

        // Remove existing listeners first (to prevent duplicates)
        document.removeEventListener('abilityScoresChanged', this.abilityScoresChangedListener);

        // Store a reference to the listener for later removal
        this.abilityScoresChangedListener = (event) => {
            console.log('[AbilityScoreCard] Received abilityScoresChanged event:', event.detail);
            this.render();
        };

        // Add the listener
        document.addEventListener('abilityScoresChanged', this.abilityScoresChangedListener);

        // Add listeners for any interactive elements in the ability score card
        if (this.container) {
            this.container.addEventListener('click', this._handleAbilityScoreClick.bind(this));
        }

        console.log('[AbilityScoreCard] Event listeners set up successfully');
    }

    /**
     * Handles clicks on ability score buttons for increasing/decreasing scores
     * @param {Event} event - The click event
     * @private
     */
    _handleAbilityScoreClick(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const abilityBox = button.closest('.ability-score-box');
        if (!abilityBox) return;

        const ability = abilityBox.dataset.ability;
        const currentScore = abilityScoreManager.getBaseScore(ability);

        if (action === 'increase') {
            abilityScoreManager.updateBaseScore(ability, currentScore + 1);
        } else if (action === 'decrease') {
            abilityScoreManager.updateBaseScore(ability, currentScore - 1);
        }
    }

    /**
     * Removes event listeners when the card is destroyed
     */
    remove() {
        document.removeEventListener('abilityScoresChanged', this.abilityScoresChangedListener);
    }

    /**
     * Updates the ability score card display
     */
    update() {
        this.render();
    }

    /**
     * Converts an ability name to its standard abbreviation
     * @param {string} ability - The ability name
     * @returns {string} The abbreviated ability name
     * @private
     */
    _getAbilityAbbreviation(ability) {
        const abilityLower = ability.toLowerCase();
        switch (abilityLower) {
            case 'strength': return 'STR';
            case 'dexterity': return 'DEX';
            case 'constitution': return 'CON';
            case 'intelligence': return 'INT';
            case 'wisdom': return 'WIS';
            case 'charisma': return 'CHA';
            case 'str': return 'STR';
            case 'dex': return 'DEX';
            case 'con': return 'CON';
            case 'int': return 'INT';
            case 'wis': return 'WIS';
            case 'cha': return 'CHA';
            default: return ability.toUpperCase();
        }
    }
} 