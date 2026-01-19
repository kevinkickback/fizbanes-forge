// View for rendering ability score bonus notes and explanations.
import { fullAbilityToAbbr } from '../../../lib/5eToolsParser.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { abilityScoreService } from '../../../services/AbilityScoreService.js';

class BonusNotesView {
	constructor(bonusesContainer) {
		this._bonusesContainer = bonusesContainer;
	}

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
						`${fullAbilityToAbbr(ability).toUpperCase()} ${value >= 0 ? '+' : ''}${value}`,
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

	_createBonusNote(source, content) {
		return `<div class="bonus-note">
            <strong>${source}</strong>: ${content}
        </div>`;
	}

	setContainer(bonusesContainer) {
		this._bonusesContainer = bonusesContainer;
	}
}

let _instance = null;

BonusNotesView.getInstance = (bonusesContainer) => {
	if (!_instance) {
		_instance = new BonusNotesView(bonusesContainer);
	}
	return _instance;
};

export { BonusNotesView };
export const bonusNotesView = BonusNotesView.getInstance;
