/** View for detailed race information (ability scores, size, speed, languages, traits). */


import { textProcessor } from '../../utils/TextProcessor.js';

/** View for displaying race details. */
export class RaceDetailsView {
	/**
	 * Creates a new RaceDetailsView instance
	 */
	constructor() {
		/**
		 * The container element for race details
		 * @type {HTMLElement}
		 * @private
		 */
		this._raceDetails = document.getElementById('raceDetails');
	}

	//-------------------------------------------------------------------------
	// Public API
	//-------------------------------------------------------------------------

	/**
	 * Update all race details sections
	 * @param {Object} race - The race data
	 * @param {Object|null} subrace - Optional subrace data
	 * @returns {Promise<void>}
	 */
	async updateAllDetails(race, subrace = null) {
		if (!race) {
			this.resetAllDetails();
			return;
		}

		await this.updateAbilityScores(race, subrace);
		await this.updateSizeAndSpeed(race);
		await this.updateLanguages(race);
		await this.updateTraits(race, subrace);

		// Process the entire details container to resolve reference tags
		await textProcessor.processElement(this._raceDetails);
	}

	/**
	 * Reset all details sections to placeholder state
	 */
	resetAllDetails() {
		const sections = this._raceDetails.querySelectorAll('.detail-section ul');
		for (const section of sections) {
			section.innerHTML = '<li class="placeholder-text">—</li>';
		}

		// Reset traits section
		const traitsSection = this._raceDetails.querySelector('.traits-section');
		if (traitsSection) {
			traitsSection.innerHTML = `
                <h6>Traits</h6>
                <div class="traits-grid">
                    <span class="trait-tag">No traits available</span>
                </div>
            `;
		}
	}

	//-------------------------------------------------------------------------
	// Ability Scores Section
	//-------------------------------------------------------------------------

	/**
	 * Update ability scores section
	 * @param {Object} race - Selected race
	 * @param {Object} subrace - Selected subrace
	 * @returns {Promise<void>}
	 */
	async updateAbilityScores(race, subrace) {
		const abilitySection = this._raceDetails.querySelector(
			'.detail-section:nth-child(1) ul',
		);
		if (!abilitySection) return;

		const abilityImprovements = this._formatAbilityImprovements(
			race,
			subrace,
		).split('\n');
		abilitySection.innerHTML = abilityImprovements
			.map((improvement) => `<li>${improvement}</li>`)
			.join('');
	}

	/**
	 * Format ability score improvements from race and subrace data
	 * @param {Object} race - Race JSON object
	 * @param {Object} subrace - Subrace JSON object (optional)
	 * @returns {string} Formatted ability improvements text
	 * @private
	 */
	_formatAbilityImprovements(race, subrace) {
		const improvements = [];

		// Process race abilities
		if (race?.ability) {
			for (const abilityEntry of race.ability) {
				// Process fixed improvements first
				for (const [ability, bonus] of Object.entries(abilityEntry)) {
					if (bonus && typeof bonus === 'number' && ability !== 'choose') {
						const abilityName =
							ability.charAt(0).toUpperCase() + ability.slice(1);
						improvements.push(`${abilityName} +${bonus}`);
					}
				}

				// Then process choice-based improvements
				if (abilityEntry.choose) {
					const count = abilityEntry.choose.count || 1;
					const amount = abilityEntry.choose.amount || 1;
					improvements.push(
						`Increase ${count} ability score${count > 1 ? 's' : ''} by ${amount}`,
					);
				}
			}
		}

		// Process subrace abilities
		if (subrace?.ability) {
			for (const abilityEntry of subrace.ability) {
				// Process fixed improvements first
				for (const [ability, bonus] of Object.entries(abilityEntry)) {
					if (bonus && typeof bonus === 'number' && ability !== 'choose') {
						const abilityName =
							ability.charAt(0).toUpperCase() + ability.slice(1);
						improvements.push(`${abilityName} +${bonus}`);
					}
				}

				// Then process choice-based improvements
				if (abilityEntry.choose) {
					const count = abilityEntry.choose.count || 1;
					const amount = abilityEntry.choose.amount || 1;
					improvements.push(
						`Increase ${count} ability score${count > 1 ? 's' : ''} by ${amount}`,
					);
				}
			}
		}

		return improvements.join('\n') || 'None';
	}

	//-------------------------------------------------------------------------
	// Size and Speed Sections
	//-------------------------------------------------------------------------

	/**
	 * Update size and speed sections
	 * @param {Object} race - Selected race
	 * @returns {Promise<void>}
	 */
	async updateSizeAndSpeed(race) {
		try {
			const sizeSection = this._raceDetails.querySelector(
				'.detail-section:nth-child(2) ul',
			);
			const sizeValue = this._formatSize(race);
			sizeSection.innerHTML = `<li>${sizeValue}</li>`;

			const speedSection = this._raceDetails.querySelector(
				'.detail-section:nth-child(3) ul',
			);
			const speeds = this._formatMovementSpeeds(race).split('\n');
			speedSection.innerHTML =
				speeds.map((speed) => `<li>${speed}</li>`).join('') || '<li>None</li>';
		} catch (error) {
			console.error('[RaceDetails]', 'Error updating size and speed:', error);

			// Set default values if there's an error
			const sizeSection = this._raceDetails.querySelector(
				'.detail-section:nth-child(2) ul',
			);
			sizeSection.innerHTML = '<li>Medium</li>';

			const speedSection = this._raceDetails.querySelector(
				'.detail-section:nth-child(3) ul',
			);
			speedSection.innerHTML = '<li>Walk: 30 ft.</li>';
		}
	}

	/**
	 * Format size from race data
	 * @param {Object} race - Race JSON object
	 * @returns {string} Formatted size text
	 * @private
	 */
	_formatSize(race) {
		if (!race?.size) return 'Medium';

		const sizeMap = {
			T: 'Tiny',
			S: 'Small',
			M: 'Medium',
			L: 'Large',
			H: 'Huge',
			G: 'Gargantuan',
		};

		if (Array.isArray(race.size)) {
			// Multiple size options
			return race.size.map((s) => sizeMap[s] || s).join(' or ');
		}

		return sizeMap[race.size] || race.size;
	}

	/**
	 * Format movement speeds from race data
	 * @param {Object} race - Race JSON object
	 * @returns {string} Formatted movement speeds text
	 * @private
	 */
	_formatMovementSpeeds(race) {
		if (!race?.speed) return 'Walk: 30 ft.';

		const speeds = [];

		if (typeof race.speed === 'number') {
			speeds.push(`Walk: ${race.speed} ft.`);
		} else if (typeof race.speed === 'object') {
			for (const [type, value] of Object.entries(race.speed)) {
				if (value && typeof value === 'number') {
					const speedType = type.charAt(0).toUpperCase() + type.slice(1);
					speeds.push(`${speedType}: ${value} ft.`);
				}
			}
		}

		return speeds.join('\n') || 'Walk: 30 ft.';
	}

	//-------------------------------------------------------------------------
	// Languages Section
	//-------------------------------------------------------------------------

	/**
	 * Update languages section
	 * @param {Object} race - Selected race
	 * @returns {Promise<void>}
	 */
	async updateLanguages(race) {
		const languageSection = this._raceDetails.querySelector(
			'.detail-section:nth-child(4) ul',
		);
		if (!languageSection) return;

		const languages = this._formatLanguages(race).split('\n');
		languageSection.innerHTML = languages
			.map((language) => `<li>${language}</li>`)
			.join('');
	}

	/**
	 * Format languages from race data
	 * @param {Object} race - Race JSON object
	 * @returns {string} Formatted languages text
	 * @private
	 */
	_formatLanguages(race) {
		if (!race?.languageProficiencies) return 'None';

		const languages = [];

		for (const langEntry of race.languageProficiencies) {
			if (langEntry.anyStandard) {
				languages.push(
					`Choose ${langEntry.anyStandard} standard language${langEntry.anyStandard > 1 ? 's' : ''}`,
				);
			} else if (langEntry.choose) {
				const count = langEntry.choose.count || 1;
				languages.push(`Choose ${count} language${count > 1 ? 's' : ''}`);
			} else {
				// Fixed languages
				for (const [lang, value] of Object.entries(langEntry)) {
					if (value === true) {
						if (lang === 'other') {
							languages.push('One other language of your choice');
						} else {
							const langName = lang.charAt(0).toUpperCase() + lang.slice(1);
							languages.push(langName);
						}
					}
				}
			}
		}

		return languages.join('\n') || 'None';
	}

	//-------------------------------------------------------------------------
	// Traits Section
	//-------------------------------------------------------------------------

	/**
	 * Update traits section
	 * @param {Object} race - Selected race
	 * @param {Object} subrace - Selected subrace
	 * @returns {Promise<void>}
	 */
	async updateTraits(race, subrace) {
		const traitsSection = this._raceDetails.querySelector('.traits-section');
		if (!traitsSection) return;

		const traits = this._getCombinedTraits(race, subrace);

		if (traits.length > 0) {
			const processedTraits = await Promise.all(
				traits.map(async (trait) => {
					if (typeof trait === 'string') {
						const processed = await textProcessor.processString(trait);
						return `<span class="trait-tag">${processed}</span>`;
					}

					const name = trait.name || trait.text;
					let description = '';

					if (trait.entries) {
						if (Array.isArray(trait.entries)) {
							// Process each entry and join with spaces
							const processedEntries = await Promise.all(
								trait.entries.map((entry) => {
									if (typeof entry === 'string') {
										return textProcessor.processString(entry);
									} else if (entry.type === 'list' && entry.items) {
										// Handle list entries
										return Promise.all(
											entry.items.map((item) =>
												textProcessor.processString(
													typeof item === 'string' ? item : '',
												),
											),
										).then((items) => items.map((i) => `• ${i}`).join('<br>'));
									}
									return '';
								}),
							);
							description = processedEntries.join(' ');
						} else if (typeof trait.entries === 'string') {
							description = await textProcessor.processString(trait.entries);
						}
					}

					// Create hover link that will trigger tooltip
					return `<a class="trait-tag rd__hover-link" data-hover-type="trait" data-hover-name="${name}" data-hover-content="${description.replace(/"/g, '&quot;')}">${name}</a>`;
				}),
			);

			traitsSection.innerHTML = `
                <h6>Traits</h6>
                <div class="traits-grid">
                    ${processedTraits.join('')}
                </div>
            `;
		} else {
			traitsSection.innerHTML = `
                <h6>Traits</h6>
                <div class="traits-grid">
                    <span class="trait-tag">No traits available</span>
                </div>
            `;
		}
	}

	/**
	 * Get combined traits from race and subrace
	 * @param {Object} race - Race JSON object
	 * @param {Object} subrace - Subrace JSON object (optional)
	 * @returns {Array} Array of trait objects
	 * @private
	 */
	_getCombinedTraits(race, subrace) {
		const traits = [];
		// Entries to exclude - they have dedicated sections
		const excludedNames = ['Age', 'Size', 'Languages', 'Alignment', 'Speed'];

		// Add race entries
		if (race?.entries) {
			for (const entry of race.entries) {
				if (
					entry.type === 'entries' &&
					entry.name &&
					!excludedNames.includes(entry.name)
				) {
					traits.push(entry);
				}
			}
		}

		// Add subrace entries
		if (subrace?.entries) {
			for (const entry of subrace.entries) {
				if (
					entry.type === 'entries' &&
					entry.name &&
					!excludedNames.includes(entry.name)
				) {
					traits.push(entry);
				}
			}
		}

		return traits;
	}
}
