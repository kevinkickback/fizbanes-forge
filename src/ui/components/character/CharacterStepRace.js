// Step 2: Race - character race and subrace selection

import {
	escapeHtml,
	getSpeedString,
	SIZE_ABV_TO_FULL,
	sizeAbvToFull,
	toTitleCase,
} from '../../../lib/5eToolsParser.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { getAbilityData } from '../../../services/AbilityScoreService.js';
import { raceService } from '../../../services/RaceService.js';
import { sourceService } from '../../../services/SourceService.js';

export class CharacterStepRace {
	constructor(session, modal) {
		this.session = session;
		this.modal = modal;
		this._cleanup = DOMCleanup.create();
		this._raceService = raceService;
	}

	async render() {
		return `
            <div class="step-2-race">
                <div class="card">
                    <div class="card-header">
                        <i class="fas fa-users"></i> Race Selection
                    </div>
                    <div class="card-body">
                        <div class="row g-3 mb-3">
                            <div class="col-md-6">
                                <label for="modalRaceSelect" class="form-label">Race</label>
                                <select class="form-select" id="modalRaceSelect">
                                    <option value="">Select a Race</option>
                                </select>
                            </div>
                            <div class="col-md-6">
                                <label for="modalSubraceSelect" class="form-label">Subrace</label>
                                <select class="form-select" id="modalSubraceSelect" disabled>
                                    <option value="">No Subraces</option>
                                </select>
                            </div>
                        </div>
                        
                        <div id="modalRaceDetails">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <div class="detail-section">
                                        <h6>Ability Score Increases</h6>
                                        <ul id="modalAbilityScores">
                                            <li class="placeholder-text">&nbsp;</li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="detail-section">
                                        <h6>Size</h6>
                                        <ul id="modalSize">
                                            <li class="placeholder-text">&nbsp;</li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="detail-section">
                                        <h6>Speed</h6>
                                        <ul id="modalSpeed">
                                            <li class="placeholder-text">&nbsp;</li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="col-md-12">
                                    <div class="detail-section">
                                        <h6>Languages</h6>
                                        <ul id="modalLanguages">
                                            <li class="placeholder-text">&nbsp;</li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="col-md-12">
                                    <div class="traits-section">
                                        <h6>Traits</h6>
                                        <div class="traits-grid" id="modalTraits">
                                            <span class="trait-tag">No traits available</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
	}

	async attachListeners(contentArea) {
		this._raceSelect = contentArea.querySelector('#modalRaceSelect');
		this._subraceSelect = contentArea.querySelector('#modalSubraceSelect');

		await this._raceService.initialize();

		this.session.restoreSourcesFromSession(sourceService);

		// Populate race dropdown
		await this._populateRaceSelect();

		// Restore saved selection if available
		const savedRace = this.session.get('race');
		if (savedRace?.name && savedRace?.source) {
			const raceValue = `${savedRace.name}|||${savedRace.source}`;
			this._raceSelect.value = raceValue;
			await this._handleRaceChange({ target: { value: raceValue } });

			// Restore subrace if available
			if (savedRace.subrace) {
				setTimeout(() => {
					this._subraceSelect.value = savedRace.subrace;
					this._handleSubraceChange({ target: { value: savedRace.subrace } });
				}, 100);
			}
		}

		// Attach event listeners
		this._cleanup.on(this._raceSelect, 'change', (e) =>
			this._handleRaceChange(e),
		);
		this._cleanup.on(this._subraceSelect, 'change', (e) =>
			this._handleSubraceChange(e),
		);

		// Store reference to traits grid for tooltip processing
		this._traitsGrid = contentArea.querySelector('#modalTraits');
	}

	async _populateRaceSelect() {
		const races = this._raceService.getAllRaces();
		if (!races || races.length === 0) {
			console.error('[Step2Race]', 'No races available');
			return;
		}

		// Filter by allowed sources
		const filteredRaces = races.filter((race) =>
			sourceService.isSourceAllowed(race.source),
		);

		// Sort by name
		const sortedRaces = [...filteredRaces].sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		// Populate select
		for (const race of sortedRaces) {
			const option = document.createElement('option');
			option.value = `${race.name}|||${race.source}`;
			option.textContent = `${race.name} (${race.source})`;
			this._raceSelect.appendChild(option);
		}
	}

	async _populateSubraceSelect(race) {
		this._subraceSelect.innerHTML = '<option value="">No Subraces</option>';
		this._subraceSelect.disabled = true;

		if (!race) return;

		const subraces = this._raceService.getSubraces(race.name, race.source);
		if (!subraces || subraces.length === 0) return;

		// Filter and sort
		const filteredSubraces = subraces.filter((subrace) => {
			const subraceSource = subrace.source || race.source;
			return (
				subrace.name &&
				subrace.name.trim() !== '' &&
				sourceService.isSourceAllowed(subraceSource)
			);
		});

		if (filteredSubraces.length === 0) return;

		const isRequired = this._raceService.isSubraceRequired(
			race.name,
			race.source,
		);

		// Set options
		if (!isRequired) {
			this._subraceSelect.innerHTML = '<option value="">Standard</option>';
		} else {
			this._subraceSelect.innerHTML = '';
		}

		this._subraceSelect.disabled = false;

		const sortedSubraces = [...filteredSubraces].sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		for (const subrace of sortedSubraces) {
			const option = document.createElement('option');
			option.value = subrace.name;
			option.textContent = subrace.name;
			this._subraceSelect.appendChild(option);
		}

		// Auto-select first if required
		if (isRequired && sortedSubraces.length > 0) {
			this._subraceSelect.value = sortedSubraces[0].name;
			this._handleSubraceChange({ target: { value: sortedSubraces[0].name } });
		}
	}

	async _handleRaceChange(event) {
		const [raceName, source] = event.target.value.split('|||');

		if (!raceName || !source) {
			this._resetDetails();
			await this._populateSubraceSelect(null);
			return;
		}

		const race = this._raceService.getRace(raceName, source);
		if (!race) {
			console.error('[Step2Race]', `Race not found: ${raceName} (${source})`);
			return;
		}

		// Get base subrace if exists
		const baseSubrace = this._raceService.getBaseSubrace(raceName, source);

		// Update UI
		this._updateDetails(race, baseSubrace);
		await this._populateSubraceSelect(race);
	}

	async _handleSubraceChange(event) {
		const subraceName = event.target.value;
		const raceValue = this._raceSelect.value;
		const [raceName, source] = raceValue.split('|||');

		if (!raceName || !source) return;

		const race = this._raceService.getRace(raceName, source);
		if (!race) return;

		let subrace = null;
		if (subraceName) {
			subrace = this._raceService.getSubrace(raceName, subraceName, source);
		} else {
			subrace = this._raceService.getBaseSubrace(raceName, source);
		}

		this._updateDetails(race, subrace);
	}

	_updateDetails(race, subrace) {
		this._updateAbilityScores(race, subrace);
		this._updateSize(race);
		this._updateSpeed(race);
		this._updateLanguages(race);
		this._updateTraits(race, subrace);
	}

	_updateAbilityScores(race, subrace) {
		const section = document.getElementById('modalAbilityScores');
		const abilityArray = [
			...(race?.ability || []),
			...(subrace?.ability || []),
		];

		if (abilityArray.length === 0) {
			section.innerHTML = '<li class="placeholder-text">None</li>';
			return;
		}

		const data = getAbilityData(abilityArray);
		const improvements = (data.asTextShort || data.asText || 'None').split(
			'\n',
		);
		section.innerHTML = improvements.map((imp) => `<li>${imp}</li>`).join('');
	}

	_updateSize(race) {
		const section = document.getElementById('modalSize');
		let sizeValue = SIZE_ABV_TO_FULL.M; // Default to Medium

		if (race?.size) {
			if (Array.isArray(race.size)) {
				sizeValue = race.size.map((s) => sizeAbvToFull(s)).join(' or ');
			} else {
				sizeValue = sizeAbvToFull(race.size);
			}
		}

		section.innerHTML = `<li>${sizeValue}</li>`;
	}

	_updateSpeed(race) {
		const section = document.getElementById('modalSpeed');
		const speeds = [];

		if (race?.speed) {
			if (typeof race.speed === 'number') {
				speeds.push(getSpeedString(race.speed));
			} else if (typeof race.speed === 'object') {
				if (race.speed.walk) {
					speeds.push(`Walk: ${getSpeedString(race.speed.walk)}`);
				}
				if (race.speed.fly) {
					speeds.push(`Fly: ${getSpeedString(race.speed.fly)}`);
				}
				if (race.speed.swim) {
					speeds.push(`Swim: ${getSpeedString(race.speed.swim)}`);
				}
				if (race.speed.climb) {
					speeds.push(`Climb: ${getSpeedString(race.speed.climb)}`);
				}
			}
		}

		if (speeds.length === 0) {
			speeds.push(getSpeedString(30)); // Default 30 ft.
		}

		section.innerHTML = speeds.map((speed) => `<li>${speed}</li>`).join('');
	}

	_updateLanguages(race) {
		const section = document.getElementById('modalLanguages');
		const languages = [];

		if (
			race?.languageProficiencies &&
			Array.isArray(race.languageProficiencies)
		) {
			for (const profObj of race.languageProficiencies) {
				for (const [key, value] of Object.entries(profObj)) {
					const keyLower = key.toLowerCase();
					if (
						value === true &&
						keyLower !== 'anystandard' &&
						keyLower !== 'any' &&
						keyLower !== 'choose'
					) {
						if (keyLower === 'other' && race.name !== 'Common') {
							languages.push(toTitleCase(race.name));
						} else if (keyLower !== 'other') {
							languages.push(toTitleCase(key));
						}
					} else if (keyLower === 'choose' && typeof value === 'object') {
						const count = value.count || 1;
						const from = value.from || [];
						if (from.includes('anyStandard')) {
							languages.push(`${count} of your choice`);
						}
					}
				}
			}
		}

		if (languages.length === 0) {
			section.innerHTML = '<li>None</li>';
		} else {
			section.innerHTML = `<li>${languages.join(', ')}</li>`;
		}
	}

	async _updateTraits(race, subrace) {
		if (!this._traitsGrid) return;

		const traits = [];
		const excludedNames = ['Age', 'Size', 'Languages', 'Alignment', 'Speed'];

		// Add race traits
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

		// Add subrace traits
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

		if (traits.length === 0) {
			this._traitsGrid.innerHTML =
				'<span class="trait-tag">No traits available</span>';
		} else {
			// Build trait tags with hover tooltips
			const traitTags = traits
				.map((trait) => {
					const escapedName = escapeHtml(trait.name);

					// Build description from entries
					let description = '';
					if (trait.entries && Array.isArray(trait.entries)) {
						description = trait.entries
							.filter((e) => typeof e === 'string')
							.map((e) => `<p>${escapeHtml(e)}</p>`)
							.join('');
					}

					return `
                    <a class="trait-tag rd__hover-link" 
                        data-hover-type="trait" 
                        data-hover-name="${escapedName}"
                        data-hover-content="${description.replace(/"/g, '&quot;')}">
                        ${escapedName}
                    </a>
                `;
				})
				.join('');

			this._traitsGrid.innerHTML = traitTags;

			// Process with textProcessor for tooltips
			await textProcessor.processElement(this._traitsGrid);
		}
	}

	_resetDetails() {
		document.getElementById('modalAbilityScores').innerHTML =
			'<li class="placeholder-text">&nbsp;</li>';
		document.getElementById('modalSize').innerHTML =
			'<li class="placeholder-text">&nbsp;</li>';
		document.getElementById('modalSpeed').innerHTML =
			'<li class="placeholder-text">&nbsp;</li>';
		document.getElementById('modalLanguages').innerHTML =
			'<li class="placeholder-text">&nbsp;</li>';
		if (this._traitsGrid) {
			this._traitsGrid.innerHTML =
				'<span class="trait-tag">No traits available</span>';
		}
	}

	async validate() {
		const raceValue = this._raceSelect?.value;
		if (!raceValue || raceValue === '') {
			console.warn('[Step2Race]', 'No race selected');
			return false;
		}

		const parts = raceValue.split('|||');
		const raceName = parts[0];
		const source = parts[1];

		if (!raceName || !source) {
			console.error('[Step2Race]', 'Failed to parse race value:', {
				raceValue,
				parts,
			});
			return false;
		}

		const isRequired = this._raceService.isSubraceRequired(raceName, source);

		if (isRequired) {
			const subraceValue = this._subraceSelect?.value;
			if (!subraceValue) {
				console.warn('[Step2Race]', 'Subrace required but not selected');
				return false;
			}
		}

		return true;
	}

	async save() {
		const raceValue = this._raceSelect?.value;
		if (!raceValue) {
			this.session.set('race', null);
			return;
		}

		const [raceName, source] = raceValue.split('|||');
		const subraceValue = this._subraceSelect?.value || '';

		this.session.set('race', {
			name: raceName,
			source,
			subrace: subraceValue,
		});
	}

	cleanup() {
		this._cleanup.cleanup();
	}
}
