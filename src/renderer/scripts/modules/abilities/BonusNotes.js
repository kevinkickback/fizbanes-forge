/** View for rendering ability score bonus notes and explanations. */

import { abilityScoreService } from '../../services/AbilityScoreService.js';
import { fullAbilityToAbbr } from '../../utils/5eToolsParser.js';
import { textProcessor } from '../../utils/TextProcessor.js';

/** View for rendering ability score bonus notes. */
class BonusNotesView {
	/**
	 * Creates a new BonusNotesView
	 * @param {HTMLElement} bonusesContainer - The bonus notes container element
	 */
	constructor(bonusesContainer) {
		this._bonusesContainer = bonusesContainer;
	}

	/**
	 * Renders the bonus notes section that explains all active ability score bonuses
	 */
	render() {
		try {
			const bonusGroups = abilityScoreService.getBonusGroups();
			if (bonusGroups.size === 0) {
				this._bonusesContainer.innerHTML = 'No ability score bonuses applied.';
				return;
			}

			let bonusContent = '<h6 class="mb-2">Sources</h6>';
			const raceBonuses = this._processRaceBonuses(bonusGroups);

			if (raceBonuses.length > 0) {
				bonusContent += this._createBonusNote('Race', raceBonuses.join(', '));
			}

			// Process remaining bonus groups
			for (const [source, bonusMap] of bonusGroups.entries()) {
				if (source.startsWith('Race')) continue; // Skip race bonuses as they're handled separately

				// Format the bonuses for this source
				const bonusText = [];
				for (const [ability, value] of bonusMap.entries()) {
					bonusText.push(
						`${abbreviateAbility(ability)} ${value >= 0 ? '+' : ''}${value}`,
					);
				}
				bonusContent += this._createBonusNote(source, bonusText.join(', '));
			}

			this._bonusesContainer.innerHTML = bonusContent;

			// Process the bonuses container to resolve any reference tags
			if (textProcessor && typeof textProcessor.processElement === 'function') {
				textProcessor.processElement(this._bonusesContainer);
			}
		} catch (error) {
			console.error('BonusNotes', 'Error rendering bonus notes:', error);
		}
	}

	/**
	 * Processes race-related bonuses and formats them for display
	 * @param {Map<string, Map<string, number>>} bonusGroups - Map of all bonus groups
	 * @returns {Array<string>} Array of formatted race bonus strings
	 * @private
	 */
	_processRaceBonuses(bonusGroups) {
		const raceBonuses = new Map();
		const allRaceBonuses = [];

		// Collect race-related bonuses (any source that starts with "Race" or "Subrace")
		const sourcesToRemove = [];
		for (const [source, bonusMap] of bonusGroups.entries()) {
			if (source.startsWith('Race') || source.startsWith('Subrace')) {
				raceBonuses.set(source, bonusMap);
				sourcesToRemove.push(source);
			}
		}

		// Remove processed sources from the original map
		for (const source of sourcesToRemove) {
			bonusGroups.delete(source);
		}

		// Process all fixed race and subrace bonuses together
		const fixedBonuses = [];
		for (const [source, bonusMap] of raceBonuses.entries()) {
			if (source === 'Race' || source === 'Subrace') {
				// Convert Map entries to array of bonus objects
				for (const [ability, value] of bonusMap.entries()) {
					fixedBonuses.push({ ability, value });
				}
			}
		}

		// Format all fixed bonuses into a single line
		if (fixedBonuses.length > 0) {
			const formattedBonuses = fixedBonuses
				.map(
					(bonus) =>
						`${fullAbilityToAbbr(bonus.ability).toUpperCase()} ${bonus.value >= 0 ? '+' : ''}${bonus.value}`,
				)
				.join(', ');
			allRaceBonuses.push(formattedBonuses);
		}

		// Process choice bonuses separately
		for (const [source, bonusMap] of raceBonuses.entries()) {
			if (source.includes('Choice')) {
				for (const [ability, value] of bonusMap.entries()) {
					allRaceBonuses.push(
						`${fullAbilityToAbbr(ability).toUpperCase()} ${value >= 0 ? '+' : ''}${value} (choice)`,
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
	 * Updates the container reference for the view
	 * @param {HTMLElement} bonusesContainer - The new container element
	 */
	setContainer(bonusesContainer) {
		this._bonusesContainer = bonusesContainer;
	}
}

let _instance = null;

/**
 * Singleton accessor for BonusNotesView
 */
BonusNotesView.getInstance = (bonusesContainer) => {
	if (!_instance) {
		_instance = new BonusNotesView(bonusesContainer);
	}
	return _instance;
};

export { BonusNotesView };
export const bonusNotesView = BonusNotesView.getInstance;
