// View for detailed race information (ability scores, size, speed, languages, traits).

import {
	getSpeedString,
	SIZE_ABV_TO_FULL,
	sizeAbvToFull,
	toTitleCase,
} from '../../../lib/5eToolsParser.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { getAbilityData } from '../../../services/AbilityScoreService.js';

// Default D&D 5e speed for most races
const DEFAULT_SPEED = 30; // 30 ft. walking speed

export class RaceDetailsView {
	constructor() {
		this._raceDetails = document.getElementById('raceDetails');
	}

	//-------------------------------------------------------------------------
	// Public API
	//-------------------------------------------------------------------------

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

	_formatAbilityImprovements(race, subrace) {
		// Combine race and subrace ability arrays
		const abilityArray = [
			...(race?.ability || []),
			...(subrace?.ability || []),
		];

		if (abilityArray.length === 0) {
			return 'None';
		}

		// Use the unified ability parsing utility
		const data = getAbilityData(abilityArray);

		// Return formatted text (use short format for compact display)
		return data.asTextShort || data.asText || 'None';
	}

	//-------------------------------------------------------------------------
	// Size and Speed Sections
	//-------------------------------------------------------------------------

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
			const defaultSize = SIZE_ABV_TO_FULL.M; // 'Medium'
			sizeSection.innerHTML = `<li>${defaultSize}</li>`;

			const speedSection = this._raceDetails.querySelector(
				'.detail-section:nth-child(3) ul',
			);
			const defaultSpeed = getSpeedString(DEFAULT_SPEED); // '30 ft.'
			speedSection.innerHTML = `<li>${defaultSpeed}</li>`;
		}
	}

	_formatSize(race) {
		// Default to Medium size if not specified
		if (!race?.size) return SIZE_ABV_TO_FULL.M;

		if (Array.isArray(race.size)) {
			// Multiple size options
			return race.size.map((s) => sizeAbvToFull(s)).join(' or ');
		}

		return sizeAbvToFull(race.size);
	}

	_formatMovementSpeeds(race) {
		// Default to standard 30 ft. walking speed if not specified
		if (!race?.speed) return `Walk: ${getSpeedString(DEFAULT_SPEED)}`;

		// Use 5etools Parser utility for consistent speed formatting
		const speedText = getSpeedString(race);
		if (speedText) {
			// Split by comma to get individual speed modes
			const speedModes = speedText.split(', ');

			// If only one speed and it doesn't have a mode label (i.e., walk speed only),
			// add the "Walk:" prefix for clarity
			if (
				speedModes.length === 1 &&
				!speedModes[0].match(/^(burrow|climb|fly|swim)/i)
			) {
				return `Walk: ${speedModes[0]}`;
			}

			// For multiple speeds or labeled speeds, join with newlines
			// Capitalize the first letter of each mode for consistency
			return speedModes
				.map((mode) => {
					// If mode doesn't start with a movement type, it's walk speed
					if (!mode.match(/^(burrow|climb|fly|swim)/i)) {
						return `Walk: ${mode}`;
					}
					// Capitalize first letter of other movement types
					return mode.charAt(0).toUpperCase() + mode.slice(1);
				})
				.join('\n');
		}

		return `Walk: ${getSpeedString(DEFAULT_SPEED)}`;
	}

	//-------------------------------------------------------------------------
	// Languages Section
	//-------------------------------------------------------------------------

	async updateLanguages(race) {
		const languageSection = this._raceDetails.querySelector(
			'.detail-section:nth-child(4) ul',
		);
		if (!languageSection) return;

		const languages = this._formatLanguages(race).split('\n');
		languageSection.innerHTML = languages
			.map((language) => {
				// Only title-case single-word or known language names, not phrases
				if (/^choose|one other|none/i.test(language))
					return `<li>${language}</li>`;
				// Title-case each word in comma-separated lists
				return `<li>${language.split(', ').map(toTitleCase).join(', ')}</li>`;
			})
			.join('');
	}

	_formatLanguages(race) {
		if (!race?.languageProficiencies) return 'None';

		const languages = [];

		for (const langEntry of race.languageProficiencies) {
			// First, add all fixed languages
			for (const [lang, value] of Object.entries(langEntry)) {
				const langLower = lang.toLowerCase();
				if (
					value === true &&
					langLower !== 'other' &&
					langLower !== 'anystandard' &&
					langLower !== 'choose'
				) {
					languages.push(lang);
				}
			}

			// Then add optional language choices
			const anyStandardCount =
				langEntry.anyStandard || langEntry.anystandard || 0;
			if (anyStandardCount > 0) {
				languages.push(
					`Choose ${anyStandardCount} standard language${anyStandardCount > 1 ? 's' : ''}`,
				);
			}

			if (langEntry.choose) {
				const count = langEntry.choose.count || 1;
				languages.push(`Choose ${count} language${count > 1 ? 's' : ''}`);
			}

			// Handle race's unique language ('other')
			if (langEntry.other === true) {
				languages.push('One other language of your choice');
			}
		}

		return languages.join('\n') || 'None';
	}

	//-------------------------------------------------------------------------
	// Traits Section
	//-------------------------------------------------------------------------

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
