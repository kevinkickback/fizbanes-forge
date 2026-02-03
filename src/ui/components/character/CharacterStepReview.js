// Step 6: Review - final review before character creation

import {
	ABILITY_ABBREVIATIONS,
	attAbvToFull,
} from '../../../lib/5eToolsParser.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { raceService } from '../../../services/RaceService.js';

export class CharacterStepReview {
	constructor(session, modal) {
		this.session = session;
		this.modal = modal;
		this._cleanup = DOMCleanup.create();
	}

	async render() {
		const data = this.session.getStagedData();

		const portrait =
			data.portrait || 'assets/images/characters/placeholder_char_card.webp';
		const name = data.name || 'Unnamed';
		const gender = data.gender
			? data.gender.charAt(0).toUpperCase() + data.gender.slice(1)
			: 'Male';

		// Format sources as badges
		const sources = Array.isArray(data.allowedSources)
			? data.allowedSources
			: Array.from(data.allowedSources || []);
		const sourceBadges =
			sources.length > 0
				? sources
					.map((s) => `<span class="badge source-badge">${s}</span>`)
					.join(' ')
				: '<span class="text-muted">None selected</span>';

		// Race info
		const raceName = data.race?.name || 'Not selected';
		const raceSource = data.race?.source ? ` (${data.race.source})` : '';
		const subraceName = data.race?.subrace ? ` - ${data.race.subrace}` : '';
		const raceDisplay = `${raceName}${raceSource}${subraceName}`;

		// Class info (get subclass from progression if available)
		const className = data.class?.name || 'Not selected';
		const classSource = data.class?.source ? ` (${data.class.source})` : '';
		const progressionClass = data.progression?.classes?.find(
			(c) => c.name === data.class?.name,
		);
		const subclassName = progressionClass?.subclass
			? ` - ${progressionClass.subclass}`
			: '';
		const classDisplay = `${className}${classSource}${subclassName}`;

		// Background info
		const backgroundName = data.background?.name || 'Not selected';
		const backgroundSource = data.background?.source
			? ` (${data.background.source})`
			: '';
		const backgroundDisplay = `${backgroundName}${backgroundSource}`;

		// Ability scores with modifiers
		const abilityScoresDisplay = this._formatAbilityScores(data);

		// Calculate HP
		const hp = this._calculateHP(data);

		return `
            <div class="step-6-review">
                <div class="card">
                    <div class="card-body p-3">
                        <div class="row g-3">
                            <!-- Left Column: Portrait & Sources -->
                            <div class="col-md-5 d-flex flex-column">
                                <div class="review-portrait-preview mb-3">
                                    <img src="${portrait}" alt="Character portrait" />
                                </div>
                                
                                <div class="ability-scores-review review-sources-container flex-fill">
                                    <div class="review-sources-header-with-badges">
                                        <span class="sources-label"><i class="fas fa-book"></i> Sources:</span>
                                        <div class="review-sources-badges-inline">
                                            ${sourceBadges}
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="review-bottom-anchor"></div>
                            </div>
                            
                            <!-- Right Column: Character Info & Ability Scores -->
                            <div class="col-md-7 d-flex flex-column">
                                <div class="review-info-compact">
                                    <div class="review-item">
                                        <span class="review-label"><i class="fas fa-user"></i> Name</span>
                                        <span class="review-value text-truncate">${name}</span>
                                    </div>
                                    <div class="review-item">
                                        <span class="review-label"><i class="fas fa-venus-mars"></i> Gender</span>
                                        <span class="review-value">${gender}</span>
                                    </div>
                                    <div class="review-item">
                                        <span class="review-label"><i class="fas fa-users"></i> Race</span>
                                        <span class="review-value text-truncate">${raceDisplay}</span>
                                    </div>
                                    <div class="review-item">
                                        <span class="review-label"><i class="fas fa-hat-wizard"></i> Class</span>
                                        <span class="review-value text-truncate">${classDisplay}</span>
                                    </div>
                                    <div class="review-item">
                                        <span class="review-label"><i class="fas fa-book"></i> Background</span>
                                        <span class="review-value text-truncate">${backgroundDisplay}</span>
                                    </div>
                                    <div class="review-item">
                                        <span class="review-label"><i class="fas fa-heart"></i> Hit Points</span>
                                        <span class="review-value">${hp}</span>
                                    </div>
                                </div>
                                
                                <div class="ability-scores-review flex-fill">
                                    <h6 class="mb-2"><i class="fas fa-dice-d20"></i> Ability Scores</h6>
                                    ${abilityScoresDisplay}
                                </div>
                                
                                <div class="review-bottom-anchor"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
	}

	/**
	 * Attach event listeners to rendered content.
	 */
	attachListeners(_contentArea) {
		console.debug('Step3Review', 'Attaching listeners');
		// No listeners needed for review step
	}

	/**
	 * Format ability score method for display.
	 */
	_formatAbilityScoreMethod(method) {
		if (!method) return 'Point Buy';

		// Convert camelCase to Title Case
		return method
			.replace(/([A-Z])/g, ' $1')
			.replace(/^./, (str) => str.toUpperCase())
			.trim();
	}

	/**
	 * Format ability scores for display.
	 */
	_formatAbilityScores(data) {
		const scores = ABILITY_ABBREVIATIONS.map((abv) => {
			const key = attAbvToFull(abv).toLowerCase();
			const label = attAbvToFull(abv);
			const baseScore = data.abilityScores?.[key] || 8;
			const racialBonus = this._getRacialBonus(key, data);
			const totalScore = baseScore + racialBonus;
			const modifier = Math.floor((totalScore - 10) / 2);
			const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
			return `
                <div class="ability-score-summary">
                    <span class="ability-label">${label}</span>
                    <span class="ability-score">${totalScore}</span>
                    <span class="ability-modifier">(${modStr})</span>
                </div>
            `;
		}).join('');

		return `<div class="ability-scores-grid">${scores}</div>`;
	}

	/**
	 * Get racial bonus for an ability.
	 * @private
	 */
	_getRacialBonus(ability, data) {
		const raceName = data.race?.name;
		const raceSource = data.race?.source;
		const subraceName = data.race?.subrace;

		if (!raceName || !raceSource) return 0;

		// Get race and subrace data from service
		const race = raceService.getRace(raceName, raceSource);
		if (!race) return 0;

		let subrace = null;
		if (subraceName) {
			subrace = raceService.getSubrace(raceName, subraceName, raceSource);
		} else {
			// Get base (unnamed) subrace if no explicit subrace selected
			// This handles races like Human where ability bonuses are stored in the base subrace
			subrace = raceService.getBaseSubrace(raceName, raceSource);
		}

		// Parse ability increases from race and subrace
		const abilityArray = [
			...(race?.ability || []),
			...(subrace?.ability || []),
		];

		if (abilityArray.length === 0) return 0;

		// Calculate bonus for this specific ability
		let bonus = 0;
		for (const abilityEntry of abilityArray) {
			if (!abilityEntry) continue;

			// Handle different ability entry formats
			if (typeof abilityEntry === 'object') {
				// Direct ability mapping: { str: 2, dex: 1 }
				const shortName = ability.substring(0, 3);
				if (abilityEntry[shortName]) {
					bonus += abilityEntry[shortName];
				}
			}
		}

		// Add bonuses from racial ability choices (e.g., Variant Human)
		const savedChoices = data.race?.abilityChoices || [];
		for (const choice of savedChoices) {
			if (choice && choice.ability === ability) {
				bonus += choice.amount || 1;
			}
		}

		return bonus;
	}

	/**
	 * Calculate starting HP.
	 */
	_calculateHP(data) {
		const className = data.class?.name;
		const baseConScore = data.abilityScores?.constitution || 10;
		const racialConBonus = this._getRacialBonus('constitution', data);
		const totalConScore = baseConScore + racialConBonus;
		const conModifier = Math.floor((totalConScore - 10) / 2);

		// Hit die by class (simplified)
		const hitDice = {
			Barbarian: 12,
			Fighter: 10,
			Paladin: 10,
			Ranger: 10,
			Bard: 8,
			Cleric: 8,
			Druid: 8,
			Monk: 8,
			Rogue: 8,
			Warlock: 8,
			Sorcerer: 6,
			Wizard: 6,
		};

		const hitDie = hitDice[className] || 8;
		const baseHP = hitDie + conModifier;

		return Math.max(1, baseHP);
	}

	/**
	 * Validate step data.
	 */
	async validate() {
		// All validation already done in previous steps
		return true;
	}

	/**
	 * Save step data to session.
	 */
	async save() {
		// Nothing to save - this is the final review step
		console.debug('Step3Review', 'Final review complete');
	}
}
