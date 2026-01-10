/** Controller for race selection UI, coordinating views and subrace logic. */

import { AppState } from '../../core/AppState.js';
import { CharacterManager } from '../../core/CharacterManager.js';
import { eventBus, EVENTS } from '../../utils/EventBus.js';

import { abilityScoreService, getAbilityData, getRaceAbilityData } from '../../services/AbilityScoreService.js';
import { raceService } from '../../services/RaceService.js';
import { sourceService } from '../../services/SourceService.js';
import {
	getSpeedString,
	SIZE_ABV_TO_FULL,
	sizeAbvToFull,
	toTitleCase,
} from '../../utils/5eToolsParser.js';
import DataNormalizer from '../../utils/DataNormalizer.js';
import { textProcessor } from '../../utils/TextProcessor.js';

/** Controller for race selection and display. */
export class RaceCard {
	/**
	 * Creates a new RaceCard instance
	 */
	constructor() {
		/**
		 * Reference to the race service
		 * @type {RaceService}
		 * @private
		 */
		this._raceService = raceService;

		/**
		 * View for race selection and quick description
		 * @type {RaceCardView}
		 * @private
		 */
		this._cardView = new RaceCardView();

		/**
		 * View for subrace selection
		 * @type {SubracePickerView}
		 * @private
		 */
		this._subraceView = new SubracePickerView();

		/**
		 * View for race details display
		 * @type {RaceDetailsView}
		 * @private
		 */
		this._detailsView = new RaceDetailsView();

		// Initialize the component
		this.initialize();
	}

	//-------------------------------------------------------------------------
	// Initialization Methods
	//-------------------------------------------------------------------------

	/**
	 * Initializes the race card UI components and event listeners.
	 * Sets up views and binds event handlers for race and subrace selection.
	 */
	initialize() {
		try {
			// Initialize race service FIRST before setting up listeners
			// This ensures race data is ready before any events try to use it
			this._raceService
				.initialize()
				.then(() => {
					// NOW set up event listeners and load saved selection
					this._setupEventListeners();
					this._loadSavedRaceSelection();
				})
				.catch((error) => {
					console.error(
						'RaceCard',
						'Failed to initialize race service:',
						error,
					);
				});
		} catch (error) {
			console.error('RaceCard', 'Failed to initialize race card:', error);
		}
	}

	/**
	 * Sets up event listeners for race and subrace selection changes
	 * @private
	 */
	_setupEventListeners() {
		// Listen to view events via EventBus instead of callbacks
		eventBus.on(EVENTS.RACE_SELECTED, (raceData) => {
			this._handleRaceChange({ target: { value: raceData.value } });
		});
		eventBus.on(EVENTS.SUBRACE_SELECTED, (subraceData) => {
			this._handleSubraceChange({ target: { value: subraceData.value } });
		});

		// Listen for character selection changes (when new character is loaded)
		eventBus.on(EVENTS.CHARACTER_SELECTED, () => {
			this._handleCharacterChanged();
		});

		// Listen for source changes and repopulate race/subrace dropdowns
		eventBus.on('sources:allowed-changed', () => {
			this._loadSavedRaceSelection();
		});
	}

	//-------------------------------------------------------------------------
	// Data Loading Methods
	//-------------------------------------------------------------------------

	/**
	 * Loads and sets the saved race selection from the character data
	 * @returns {Promise<void>}
	 * @private
	 */
	async _loadSavedRaceSelection() {
		try {
			// Populate race dropdown first
			await this._populateRaceSelect();

			const character = AppState.getCurrentCharacter();
			if (!character?.race?.name || !character?.race?.source) {
				return; // No saved race to load
			}

			// Set the race selection if it exists in available options
			const raceValue = `${character.race.name}_${character.race.source}`;

			console.info('[RaceCard]', 'Setting race value:', raceValue);
			if (this._cardView.hasRaceOption(raceValue)) {
				console.info('[RaceCard]', 'Race option found, setting race');
				this._cardView.setSelectedRaceValue(raceValue);
				// Update UI from character data (skip unsaved event)
				await this._handleRaceChange({ target: { value: raceValue } }, true);

				// Also set subrace if one was selected
				if (character.race.subrace) {
					console.info(
						'[RaceCard]',
						'Saved subrace found:',
						character.race.subrace,
					);
					// Wait for subrace options to populate
					await new Promise((resolve) => setTimeout(resolve, 100));

					const subraceOptions = Array.from(
						this._subraceView.getSubraceSelect().options,
					).map((o) => ({ value: o.value, text: o.text }));
					console.info(
						'[RaceCard]',
						`Loading saved subrace: "${character.race.subrace}"`,
						{
							availableOptions: subraceOptions,
						},
					);
					if (this._subraceView.hasSubraceOption(character.race.subrace)) {
						console.info(
							'[RaceCard]',
							'Subrace option found, setting subrace value',
						);
						this._subraceView.setSelectedSubraceValue(character.race.subrace);
						// Update character data with the saved subrace (skip unsaved event during load)
						await this._handleSubraceChange(
							{ target: { value: character.race.subrace } },
							true,
							true,
						);
					} else {
						console.warn(
							'RaceCard',
							`Saved subrace "${character.race.subrace}" not found in available options for ${character.race.name}.`,
							{ availableOptions: subraceOptions },
						);
					}
				} else {
					console.info('[RaceCard]', 'No saved subrace for character');

					// Apply race benefits even when no subrace is present
					await this._handleSubraceChange(
						{ target: { value: '' } },
						true,
						true,
					);
				}
			} else {
				console.warn(
					'RaceCard',
					`Saved race "${raceValue}" not found in available options. Character might use a source that's not currently allowed.`,
				);
			}
		} catch (error) {
			console.error('RaceCard', 'Error loading saved race selection:', error);
		}
	}

	/**
	 * Populates the race selection dropdown with all available races
	 * filtered by allowed sources
	 * @returns {Promise<void>}
	 * @private
	 */
	async _populateRaceSelect() {
		try {
			const races = this._raceService.getAllRaces();
			if (!races || races.length === 0) {
				console.error('RaceCard', 'No races available to populate dropdown');
				return;
			}

			// Filter races by allowed sources (supports PHB variants)
			const filteredRaces = races.filter((race) =>
				sourceService.isSourceAllowed(race.source),
			);

			if (filteredRaces.length === 0) {
				console.error('RaceCard', 'No races available after source filtering');
				return;
			}

			// Populate view
			this._cardView.populateRaceSelect(filteredRaces);
		} catch (error) {
			console.error('RaceCard', 'Error populating race dropdown:', error);
		}
	}

	/**
	 * Populates the subrace selection dropdown based on the currently selected race
	 * filtered by allowed sources
	 * @param {Object} race - The selected race data
	 * @returns {Promise<void>}
	 * @private
	 */
	async _populateSubraceSelect(race) {
		if (!race) {
			this._subraceView.reset();
			return;
		}

		try {
			// Get subraces from service
			const subraces = this._raceService.getSubraces(race.name, race.source);

			console.info(
				'[RaceCard]',
				`Populating subraces for ${race.name} (${race.source}):`,
				{
					total: subraces?.length,
					names: subraces?.map((s) => s.name),
				},
			);

			if (!subraces || subraces.length === 0) {
				this._subraceView.reset();
				return;
			}

			// Filter subraces by allowed sources and validate they have names
			const filteredSubraces = subraces.filter((subrace) => {
				const subraceSource = subrace.source || race.source;
				const hasName = subrace.name && subrace.name.trim() !== '';
				const sourceAllowed = sourceService.isSourceAllowed(subraceSource);
				const passes = sourceAllowed && hasName;

				if (subrace.name === 'Variant') {
					console.info('[RaceCard]', 'Variant filter check:', {
						source: subraceSource,
						sourceAllowed,
						hasName,
						passes,
					});
				}

				return passes;
			});

			console.info('[RaceCard]', `Filtered subraces for ${race.name}:`, {
				filtered: filteredSubraces.length,
				names: filteredSubraces.map((s) => s.name),
			});

			// Check if subraces are required for this race
			const subraceRequired = this._raceService.isSubraceRequired(
				race.name,
				race.source,
			);

			// Populate view with the filtered subraces
			this._subraceView.populateSubraceSelect(
				filteredSubraces,
				subraceRequired,
			);

			// Auto-select the first subrace if it's required
			if (subraceRequired && filteredSubraces.length > 0) {
				const firstSubraceName = filteredSubraces[0].name;
				this._subraceView.setSelectedSubraceValue(firstSubraceName);
				// Trigger change event to update character data
				setTimeout(() => {
					this._subraceView.triggerSubraceSelectChange();
				}, 0);
			}
		} catch (error) {
			console.error('RaceCard', 'Error loading subraces for dropdown:', error);
		}
	}

	//-------------------------------------------------------------------------
	// Event Handlers
	//-------------------------------------------------------------------------

	/**
	 * Handles race selection change events
	 * @param {Event} event - The change event
	 * @returns {Promise<void>}
	 * @private
	 */
	async _handleRaceChange(event, skipCharacterUpdate = false) {
		try {
			const [raceName, source] = event.target.value.split('_');

			if (!raceName || !source) {
				this.resetRaceDetails();
				await this._populateSubraceSelect(null);
				return;
			}

			const raceData = this._raceService.getRace(raceName, source);
			if (!raceData) {
				console.error('RaceCard', `Race not found: ${raceName} (${source})`);
				return;
			}

			// Check if there's a nameless subrace (base variant like Human PHB)
			const namelessSubrace = this._raceService.getBaseSubrace(
				raceName,
				source,
			);

			// Get fluff data for quick description
			const fluffData = this._raceService.getRaceFluff(
				raceData.name,
				raceData.source,
			);

			// Update the UI with the selected race data
			await this._cardView.updateQuickDescription(raceData, fluffData);
			await this._detailsView.updateAllDetails(raceData, namelessSubrace);
			await this._populateSubraceSelect(raceData);

			// Update character data ONLY if not skipped (e.g., during initial load)
			if (!skipCharacterUpdate) {
				this._updateCharacterRace(raceData, namelessSubrace);

				// Emit event to notify about character update (unsaved changes)
				eventBus.emit(EVENTS.CHARACTER_UPDATED, {
					character: CharacterManager.getCurrentCharacter(),
				});
			}
		} catch (error) {
			console.error('RaceCard', 'Error handling race change:', error);
		}
	}

	/**
	 * Handles subrace selection change events
	 * @param {Event} event - The change event
	 * @param {boolean} skipEventDuringInit - Skip emitting CHARACTER_UPDATED during initialization
	 * @param {boolean} restoreAbilityChoices - Restore saved ability choices when loading
	 * @returns {Promise<void>}
	 * @private
	 */
	async _handleSubraceChange(
		event,
		skipEventDuringInit = false,
		restoreAbilityChoices = false,
	) {
		try {
			const subraceName = event.target.value;
			const raceValue = this._cardView.getSelectedRaceValue();
			const [raceName, source] = raceValue.split('_');

			if (!raceName || !source) {
				return;
			}

			const raceData = this._raceService.getRace(raceName, source);
			if (!raceData) {
				console.error('RaceCard', `Race not found: ${raceName} (${source})`);
				return;
			}

			let subraceData = null;
			if (subraceName) {
				// User selected a named subrace
				subraceData = this._raceService.getSubrace(
					raceName,
					subraceName,
					source,
				);
			} else {
				// User selected "Standard" - get the unnamed base subrace if it exists
				subraceData = this._raceService.getBaseSubrace(raceName, source);
			}
			console.debug(
				'RaceCard',
				`Subrace changed: ${subraceName || 'Standard'}`,
				{
					raceName,
					subraceName,
					subraceData: subraceData?.name || 'null',
				},
			);

			// Update the UI with the subrace data
			await this._detailsView.updateAllDetails(raceData, subraceData);

			// Update character data
			this._updateCharacterRace(raceData, subraceData, {
				restoreAbilityChoices,
			});

			// Emit event to notify about character update (unsaved changes)
			// Skip during initialization to prevent showing unsaved indicator on page load
			if (!skipEventDuringInit) {
				eventBus.emit(EVENTS.CHARACTER_UPDATED, {
					character: CharacterManager.getCurrentCharacter(),
				});
			}
		} catch (error) {
			console.error('RaceCard', 'Error handling subrace change:', error);
		}
	}

	/**
	 * Handles character selection change events
	 * @returns {Promise<void>}
	 * @private
	 */
	async _handleCharacterChanged() {
		try {
			// Reload race selection to match character's race
			await this._loadSavedRaceSelection();
		} catch (error) {
			console.error(
				'RaceCard',
				'Error handling character changed event:',
				error,
			);
		}
	}

	//-------------------------------------------------------------------------
	// UI Update Methods
	//-------------------------------------------------------------------------

	/**
	 * Reset race details to placeholder state
	 */
	resetRaceDetails() {
		this._cardView.resetQuickDescription();
		this._detailsView.resetAllDetails();
	}

	/**
	 * Updates the display of race details for the selected race
	 * @param {Object} raceData - The race data to display
	 * @returns {Promise<void>}
	 */
	async updateRaceDetails(raceData) {
		if (!raceData) {
			this.resetRaceDetails();
			return;
		}

		// Get fluff data for quick description
		const fluffData = this._raceService.getRaceFluff(
			raceData.name,
			raceData.source,
		);

		// Update the UI with the selected race data
		await this._cardView.updateQuickDescription(raceData, fluffData);

		// Check if there's a nameless subrace (base variant like Human PHB)
		const namelessSubrace = this._raceService.getBaseSubrace(
			raceData.name,
			raceData.source,
		);

		await this._detailsView.updateAllDetails(raceData, namelessSubrace);
		await this._populateSubraceSelect(raceData);
	}

	//-------------------------------------------------------------------------
	// Character Data Management
	//-------------------------------------------------------------------------

	/**
	 * Update character's race information
	 * @param {Object} race - Selected race
	 * @param {Object} subrace - Selected subrace
	 * @private
	 */
	_updateCharacterRace(race, subrace, options = {}) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const { restoreAbilityChoices = false } = options;
		const savedAbilityChoices = restoreAbilityChoices
			? [...(character.race?.abilityChoices || [])]
			: [];

		// Capture existing race optional proficiency selections before cleanup so they can be restored
		const previousRaceOptionalSelections = {
			skills:
				character.optionalProficiencies?.skills?.race?.selected?.slice() || [],
			languages:
				character.optionalProficiencies?.languages?.race?.selected?.slice() ||
				[],
			tools:
				character.optionalProficiencies?.tools?.race?.selected?.slice() || [],
		};

		// We want to do a more thorough cleanup, so always treat as changed
		const forceCleanup = true;

		// Check if race has changed
		const hasChanged =
			forceCleanup ||
			character.race?.name !== race?.name ||
			character.race?.source !== race?.source ||
			character.race?.subrace !== (subrace?.name || '');

		if (hasChanged) {
			// Perform thorough cleanup of all race-related benefits

			// Clear all ability bonuses from race and subrace
			character.clearRacialBenefits();

			// Clear the AbilityScoreManager's stored choices
			if (window.abilityScoreManager) {
				window.abilityScoreManager.clearStoredChoices();
			}

			// Clear ability score service's stored choices
			abilityScoreService.clearStoredChoices();

			// Notify UI to clear optional proficiencies from race and trigger full UI refresh
			document.dispatchEvent(
				new CustomEvent('proficienciesRemoved', {
					detail: { source: 'Race', triggerRefresh: true },
				}),
			);

			if (!race) {
				// Clear race
				character.race = {
					name: '',
					source: '',
					subrace: '',
				};
			} else {
				// Set race
				character.race = {
					name: race.name,
					source: race.source,
					subrace: subrace?.name || '',
				};

				// Update character size and speed
				character.size = race.size;
				character.speed = { ...race.speed };

				// Update ability scores and get new choices
				this._updateAbilityBonuses(race, subrace);

				// Restore saved racial ability choices (if any) after bonuses are reset
				if (restoreAbilityChoices && savedAbilityChoices.length > 0) {
					abilityScoreService.setRacialAbilityChoices(savedAbilityChoices);
				}

				// Add traits
				this._updateRacialTraits(race, subrace);

				// Add proficiencies
				this._updateRaceProficiencies(
					race,
					subrace,
					previousRaceOptionalSelections,
				);

				// Force a refresh after a short delay to ensure everything is updated
				setTimeout(() => {
					document.dispatchEvent(
						new CustomEvent('proficiencyChanged', {
							detail: { triggerCleanup: true, forcedRefresh: true },
						}),
					);
				}, 100);
			}

			// Trigger events to update the UI with longer delays to ensure complete refresh
			document.dispatchEvent(
				new CustomEvent('raceChanged', { detail: { race, subrace } }),
			);

			setTimeout(() => {
				document.dispatchEvent(new CustomEvent('characterChanged'));
				document.dispatchEvent(
					new CustomEvent('abilityScoresChanged', { detail: { character } }),
				);

				// Additional refresh for UI components
				document.dispatchEvent(
					new CustomEvent('updateUI', { detail: { fullRefresh: true } }),
				);
			}, 150);
		}
	}

	/**
	 * Updates ability bonuses based on race and subrace
	 * @param {Object} race - Selected race
	 * @param {Object} subrace - Selected subrace
	 * @private
	 */
	_updateAbilityBonuses(race, subrace) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character || !race) return;

		// Clear existing ability bonuses from race and subrace
		character.clearAbilityBonuses('Race');
		character.clearAbilityBonuses('Subrace');
		character.clearPendingAbilityChoices();

		try {
			// Special handling for Half-Elf (PHB)
			if (race.name === 'Half-Elf' && race.source === 'PHB') {
				// Add fixed +2 Charisma bonus
				character.addAbilityBonus('charisma', 2, 'Race');
			}

			// Use 5etools-based ability score parsing
			const abilityData = getRaceAbilityData(race, subrace);

			// Add fixed ability improvements
			for (const improvement of abilityData.fixed) {
				// Skip Half-Elf's Charisma bonus as it's already handled
				if (
					race.name === 'Half-Elf' &&
					race.source === 'PHB' &&
					improvement.ability === 'charisma' &&
					improvement.source === 'race'
				) {
					continue;
				}

				character.addAbilityBonus(
					improvement.ability,
					improvement.value,
					improvement.source === 'race' ? 'Race' : 'Subrace',
				);
			}

			// Add ability score choices
			if (abilityData.choices && abilityData.choices.length > 0) {
				console.debug(
					'RaceCard',
					'Adding pending ability choices:',
					abilityData.choices,
				);
				for (const choice of abilityData.choices) {
					// Expand each choice based on count (e.g., count:2 becomes 2 separate dropdowns)
					const count = choice.count || 1;
					for (let i = 0; i < count; i++) {
						character.addPendingAbilityChoice({
							count: 1, // Each individual choice is count:1
							amount: choice.amount,
							from: choice.from,
							source:
								choice.source === 'race' ? 'Race Choice' : 'Subrace Choice',
							type: 'ability',
						});
					}
				}
				console.debug(
					'RaceCard',
					'Pending ability choices after add:',
					character.getPendingAbilityChoices(),
				);
			} else {
				console.debug('RaceCard', 'No ability choices found for race/subrace');
			}
		} catch (error) {
			console.error('RaceCard', 'Error updating ability bonuses:', error);
		}

		// Notify of changes
		document.dispatchEvent(
			new CustomEvent('abilityScoresChanged', { detail: { character } }),
		);
	}

	/**
	 * Updates racial traits based on race and subrace
	 * @param {Object} race - Selected race
	 * @param {Object} subrace - Selected subrace
	 * @private
	 */
	_updateRacialTraits(race, subrace) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character || !race) return;

		// Clear existing racial traits
		character.clearTraits('Race');
		if (subrace) {
			character.clearTraits('Subrace');
		}

		// Add race traits
		if (race.entries && Array.isArray(race.entries)) {
			for (const entry of race.entries) {
				if (entry.type === 'entries' && entry.name) {
					character.addTrait(entry.name, entry, 'Race');
				}
			}
		}

		// Add subrace traits
		if (subrace?.entries && Array.isArray(subrace.entries)) {
			for (const entry of subrace.entries) {
				if (entry.type === 'entries' && entry.name) {
					character.addTrait(entry.name, entry, 'Subrace');
				}
			}
		}
	}

	/**
	 * Update character's proficiencies based on race and subrace
	 * @param {Object} race - Selected race
	 * @param {Object} subrace - Selected subrace
	 * @private
	 */
	_updateRaceProficiencies(race, subrace, previousRaceOptionalSelections = {}) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character || !race) return;

		// Store previously selected proficiencies to restore valid ones later
		const previousRaceSkills = previousRaceOptionalSelections.skills || [];
		const previousRaceLanguages =
			previousRaceOptionalSelections.languages || [];
		const previousRaceTools = previousRaceOptionalSelections.tools || [];

		// Reset race proficiency options
		character.optionalProficiencies.skills.race.allowed = 0;
		character.optionalProficiencies.skills.race.options = [];
		character.optionalProficiencies.skills.race.selected = [];

		character.optionalProficiencies.languages.race.allowed = 0;
		character.optionalProficiencies.languages.race.options = [];
		character.optionalProficiencies.languages.race.selected = [];

		character.optionalProficiencies.tools.race.allowed = 0;
		character.optionalProficiencies.tools.race.options = [];
		character.optionalProficiencies.tools.race.selected = [];

		// Process language proficiencies
		this._processLanguageProficiencies(race, character, previousRaceLanguages);

		// Process weapon proficiencies
		this._processWeaponProficiencies(race, character);

		// Process tool proficiencies
		this._processToolProficiencies(race, character, previousRaceTools);

		// Process skill proficiencies
		this._processSkillProficiencies(
			race,
			subrace,
			character,
			previousRaceSkills,
		);

		// Update combined options for all proficiency types
		this._updateCombinedProficiencyOptions(character);

		// Notify UI to update proficiencies
		document.dispatchEvent(new CustomEvent('proficiencyChanged'));
	}

	/**
	 * Process language proficiencies from race data
	 * @param {Object} race - Race data
	 * @param {Object} character - Character object
	 * @param {Array} previousSelections - Previously selected languages
	 * @private
	 */
	_processLanguageProficiencies(race, character, previousSelections) {
		if (
			!race.languageProficiencies ||
			!Array.isArray(race.languageProficiencies)
		)
			return;

		let languageCount = 0;
		const languageOptions = [];

		for (const profObj of race.languageProficiencies) {
			for (const [key, value] of Object.entries(profObj)) {
				const keyLower = key.toLowerCase();
				// Handle fixed languages
				if (
					value === true &&
					keyLower !== 'anystandard' &&
					keyLower !== 'any' &&
					keyLower !== 'choose' &&
					keyLower !== 'other'
				) {
					character.addProficiency('languages', key, 'Race');
				}
				// Handle race's unique language ('other')
				else if (keyLower === 'other' && value === true) {
					if (race.name !== 'Common') {
						character.addProficiency('languages', race.name, 'Race');
					}
				}
				// Handle 'any'/'anystandard' choices
				else if (
					(keyLower === 'anystandard' || keyLower === 'any') &&
					typeof value === 'number' &&
					value > 0
				) {
					languageCount += value;
					// Get standard language options from RaceService
					for (const lang of this._raceService.getStandardLanguageOptions()) {
						if (!languageOptions.includes(lang)) {
							languageOptions.push(lang);
						}
					}
				}
				// Handle specific 'choose' lists
				else if (
					keyLower === 'choose' &&
					typeof value === 'object' &&
					value.from &&
					value.count > 0
				) {
					languageCount += value.count;
					for (const lang of value.from) {
						if (!languageOptions.includes(lang)) {
							languageOptions.push(lang);
						}
					}
				}
			}
		}

		// Update optional proficiencies if choices were found
		if (languageCount > 0) {
			character.optionalProficiencies.languages.race.allowed = languageCount;
			character.optionalProficiencies.languages.race.options = languageOptions;
			// Restore valid selections using normalized comparison
			const normalizedLanguageOptions = languageOptions.map((lang) =>
				DataNormalizer.normalizeForLookup(lang),
			);
			character.optionalProficiencies.languages.race.selected =
				previousSelections.filter((lang) =>
					normalizedLanguageOptions.includes(
						DataNormalizer.normalizeForLookup(lang),
					),
				);
		}
	}

	/**
	 * Process weapon proficiencies from race data
	 * @param {Object} race - Race data
	 * @param {Object} character - Character object
	 * @private
	 */
	_processWeaponProficiencies(race, character) {
		if (!race.weaponProficiencies || !Array.isArray(race.weaponProficiencies))
			return;

		for (const profObj of race.weaponProficiencies) {
			for (const [weapon, hasProf] of Object.entries(profObj)) {
				if (hasProf === true) {
					// Extract the weapon name without the source using unpackUid
					const { name: weaponName } = window.api.unpackUid(weapon);
					character.addProficiency('weapons', weaponName, 'Race');
				}
			}
		}
	}

	/**
	 * Process tool proficiencies from race data
	 * @param {Object} race - Race data
	 * @param {Object} character - Character object
	 * @param {Array} previousSelections - Previously selected tools
	 * @private
	 */
	_processToolProficiencies(race, character, previousSelections) {
		if (!race.toolProficiencies || !Array.isArray(race.toolProficiencies))
			return;

		for (const profObj of race.toolProficiencies) {
			// Handle fixed tool proficiencies
			for (const [tool, hasProf] of Object.entries(profObj)) {
				if (hasProf === true && tool !== 'any') {
					// Add tool with original JSON casing preserved
					character.addProficiency('tools', tool, 'Race');
				}
			}

			// Handle "any" tool proficiency choice
			if (profObj.any && profObj.any > 0) {
				character.optionalProficiencies.tools.race.allowed = profObj.any;
				// Get standard tool options from RaceService
				character.optionalProficiencies.tools.race.options =
					this._raceService.getStandardToolOptions();
				// Restore valid selections using normalized comparison
				const normalizedToolOptions = character.optionalProficiencies.tools.race.options.map(
					(tool) => DataNormalizer.normalizeForLookup(tool),
				);
				character.optionalProficiencies.tools.race.selected =
					previousSelections.filter((tool) =>
						normalizedToolOptions.includes(
							DataNormalizer.normalizeForLookup(tool),
						),
					);
			}
		}
	}

	/**
	 * Process skill proficiencies from race data
	 * @param {Object} race - Race data
	 * @param {Object} subrace - Subrace data
	 * @param {Object} character - Character object
	 * @param {Array} previousSelections - Previously selected skills
	 * @private
	 */
	_processSkillProficiencies(race, subrace, character, previousSelections) {
		let raceSkillCount = 0;
		let raceSkillOptions = [];

		// Handle skill proficiencies if available
		if (race.skillProficiencies && Array.isArray(race.skillProficiencies)) {
			for (const profObj of race.skillProficiencies) {
				// Handle "any" skill proficiency choice
				if (profObj.any) {
					raceSkillCount += profObj.any;
					// Get standard skill options from RaceService
					raceSkillOptions = this._raceService.getStandardSkillOptions();
					continue;
				}

				// Handle fixed skill proficiencies
				for (const [skill, hasProf] of Object.entries(profObj)) {
					if (hasProf === true && skill !== 'choose') {
						// Add skill with original JSON casing preserved
						character.addProficiency('skills', skill, 'Race');
					}
				}

				// Handle skill choices with specific options
				if (profObj.choose && profObj.choose.count > 0) {
					raceSkillCount += profObj.choose.count;
					if (profObj.choose.from && Array.isArray(profObj.choose.from)) {
						// Add skill options with original JSON casing preserved
						raceSkillOptions.push(...profObj.choose.from);
					}
				}
			}
		}

		// Special case for Human Variant - always 1 skill of any choice
		if (
			race.name === 'Human' &&
			race.source === 'PHB' &&
			subrace &&
			subrace.name === 'Variant'
		) {
			raceSkillCount = 1;
			// Get standard skill options from RaceService
			raceSkillOptions = this._raceService.getStandardSkillOptions();
		}

		// Update race-specific skill options and count
		if (raceSkillCount > 0) {
			character.optionalProficiencies.skills.race.allowed = raceSkillCount;
			character.optionalProficiencies.skills.race.options = raceSkillOptions;
			// Restore valid selections using normalized comparison
			const normalizedRaceSkillOptions = raceSkillOptions.map((skill) =>
				DataNormalizer.normalizeForLookup(skill),
			);
			character.optionalProficiencies.skills.race.selected =
				previousSelections.filter((skill) =>
					normalizedRaceSkillOptions.includes(
						DataNormalizer.normalizeForLookup(skill),
					),
				);
		}
	}

	/**
	 * Updates the combined proficiency options from race, class, and background
	 * @param {Object} character - The character object
	 * @private
	 */
	_updateCombinedProficiencyOptions(character) {
		if (!character) return;

		// Merge proficiency options from all sources (race, class, background)
		this._mergeProficiencySource(character, 'skills');
		this._mergeProficiencySource(character, 'languages');
		this._mergeProficiencySource(character, 'tools');
	}

	/**
	 * Helper to merge proficiency options from race, class, and background sources
	 * @param {Object} character - The character object
	 * @param {string} profType - Proficiency type ('skills', 'languages', or 'tools')
	 * @private
	 */
	_mergeProficiencySource(character, profType) {
		const profData = character.optionalProficiencies[profType];
		if (!profData) return;

		// Extract source data
		const raceAllowed = profData.race?.allowed || 0;
		const classAllowed = profData.class?.allowed || 0;
		const backgroundAllowed = profData.background?.allowed || 0;

		const raceOptions = profData.race?.options || [];
		const classOptions = profData.class?.options || [];
		const backgroundOptions = profData.background?.options || [];

		const raceSelected = profData.race?.selected || [];
		const classSelected = profData.class?.selected || [];
		const backgroundSelected = profData.background?.selected || [];

		// Merge selections, preserving existing if sources are empty
		const sourceSelections = [
			...raceSelected,
			...classSelected,
			...backgroundSelected,
		];
		const existingSelections = profData.selected || [];

		// Update combined proficiency data
		profData.allowed = raceAllowed + classAllowed + backgroundAllowed;
		profData.selected =
			sourceSelections.length > 0
				? [...new Set(sourceSelections)]
				: existingSelections;
		profData.options = [
			...new Set([...raceOptions, ...classOptions, ...backgroundOptions]),
		];
	}

	/**
	 * Updates the combined skill options from race, class, and background
	 * @param {Object} character - The character object
	 * @private
	 */
	_updateCombinedSkillOptions(character) {
		this._mergeProficiencySource(character, 'skills');
	}

	/**
	 * Update language options
	 * @param {Object} character - The character object
	 * @private
	 */
	_updateCombinedLanguageOptions(character) {
		this._mergeProficiencySource(character, 'languages');
	}

	/**
	 * Update tool options
	 * @param {Object} character - The character object
	 * @private
	 */
	_updateCombinedToolOptions(character) {
		this._mergeProficiencySource(character, 'tools');
	}
}

//=============================================================================
// Default D&D 5e speed for most races
//=============================================================================
const DEFAULT_SPEED = 30; // 30 ft. walking speed

//=============================================================================
// RaceDetailsView - Consolidated from RaceDetails.js
//=============================================================================

/** View for displaying race details. */
class RaceDetailsView {
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
			const defaultSize = SIZE_ABV_TO_FULL.M; // 'Medium'
			sizeSection.innerHTML = `<li>${defaultSize}</li>`;

			const speedSection = this._raceDetails.querySelector(
				'.detail-section:nth-child(3) ul',
			);
			const defaultSpeed = getSpeedString(DEFAULT_SPEED); // '30 ft.'
			speedSection.innerHTML = `<li>${defaultSpeed}</li>`;
		}
	}

	/**
	 * Format size from race data
	 * @param {Object} race - Race JSON object
	 * @returns {string} Formatted size text
	 * @private
	 */
	_formatSize(race) {
		// Default to Medium size if not specified
		if (!race?.size) return SIZE_ABV_TO_FULL.M;

		if (Array.isArray(race.size)) {
			// Multiple size options
			return race.size.map((s) => sizeAbvToFull(s)).join(' or ');
		}

		return sizeAbvToFull(race.size);
	}

	/**
	 * Format movement speeds from race data
	 * @param {Object} race - Race JSON object
	 * @returns {string} Formatted movement speeds text
	 * @private
	 */
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
			.map((language) => {
				// Only title-case single-word or known language names, not phrases
				if (/^choose|one other|none/i.test(language))
					return `<li>${language}</li>`;
				// Title-case each word in comma-separated lists
				return `<li>${language.split(', ').map(toTitleCase).join(', ')}</li>`;
			})
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

//=============================================================================
// RaceCardView - Consolidated from RaceViews.js (Main race dropdown and quick description)
//=============================================================================

/** View for the race card's main display (dropdown + quick description). */
class RaceCardView {
	/**
	 * Creates a new RaceCardView instance
	 */
	constructor() {
		/**
		 * The main race selection dropdown element
		 * @type {HTMLSelectElement}
		 * @private
		 */
		this._raceSelect = document.getElementById('raceSelect');

		/**
		 * The quick description element for displaying race summary
		 * @type {HTMLElement}
		 * @private
		 */
		this._raceQuickDesc = document.getElementById('raceQuickDesc');

		// Set up event listeners
		this._setupEventListeners();
	}

	//-------------------------------------------------------------------------
	// Event Setup
	//-------------------------------------------------------------------------

	/**
	 * Sets up event listeners for race selection changes
	 * @private
	 */
	_setupEventListeners() {
		if (this._raceSelect) {
			this._raceSelect.addEventListener('change', (event) => {
				const selectedValue = event.target.value;
				if (selectedValue) {
					const [raceName, source] = selectedValue.split('_');
					eventBus.emit(EVENTS.RACE_SELECTED, {
						name: raceName,
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

	/**
	 * Get the race select element
	 * @returns {HTMLSelectElement}
	 */
	getRaceSelect() {
		return this._raceSelect;
	}

	/**
	 * Get the currently selected race value
	 * @returns {string} Format: "RaceName_Source" or empty string
	 */
	getSelectedRaceValue() {
		return this._raceSelect.value;
	}

	/**
	 * Set the selected race value
	 * @param {string} value - Format: "RaceName_Source"
	 */
	setSelectedRaceValue(value) {
		this._raceSelect.value = value;
	}

	/**
	 * Populate the race selection dropdown
	 * @param {Array<Object>} races - Array of race objects
	 */
	populateRaceSelect(races) {
		this._raceSelect.innerHTML = '<option value="">Select a Race</option>';

		if (!races || races.length === 0) {
			console.error('RaceView', 'No races provided to populate dropdown');
			return;
		}

		// Sort races by name
		const sortedRaces = [...races].sort((a, b) => a.name.localeCompare(b.name));

		// Add options to select
		for (const race of sortedRaces) {
			const option = document.createElement('option');
			option.value = `${race.name}_${race.source}`;
			option.textContent = `${race.name} (${race.source})`;
			this._raceSelect.appendChild(option);
		}
	}

	/**
	 * Update the quick description for the selected race
	 * @param {Object} race - The race data
	 * @param {Object|null} fluffData - The race fluff data
	 * @returns {Promise<void>}
	 */
	async updateQuickDescription(race, fluffData = null) {
		if (!race) {
			this.resetQuickDescription();
			return;
		}

		let description = '';

		// Extract description from fluff data
		if (fluffData?.entries) {
			// Race fluff has a deeply nested structure:
			// entries[0].entries[0].entries[0] is usually the first descriptive paragraph
			const traverseEntries = (entries) => {
				if (!Array.isArray(entries)) return null;

				for (const entry of entries) {
					if (typeof entry === 'string') {
						return entry;
					} else if (entry?.entries) {
						const result = traverseEntries(entry.entries);
						if (result) return result;
					}
				}
				return null;
			};

			description = traverseEntries(fluffData.entries);
		}

		// Fallback if no fluff found
		if (!description) {
			description = `${race.name} are a playable race in D&D.`;
		}

		const processedDescription = await textProcessor.processString(description);

		this._raceQuickDesc.innerHTML = `
            <h5>${race.name}</h5>
            <p>${processedDescription}</p>
        `;
	}

	/**
	 * Reset quick description to placeholder state
	 */
	resetQuickDescription() {
		this._raceQuickDesc.innerHTML = `
            <div class="placeholder-content">
                <h5>Select a Race</h5>
                <p>Choose a race to see details about their traits, abilities, and other characteristics.</p>
            </div>
        `;
	}

	/**
	 * Check if a race option exists in the dropdown
	 * @param {string} raceValue - Format: "RaceName_Source"
	 * @returns {boolean}
	 */
	hasRaceOption(raceValue) {
		return Array.from(this._raceSelect.options).some(
			(option) => option.value === raceValue,
		);
	}

	/**
	 * Trigger a change event on the race select
	 */
	triggerRaceSelectChange() {
		this._raceSelect.dispatchEvent(new Event('change', { bubbles: true }));
	}
}

//=============================================================================
// SubracePickerView - Consolidated from RaceViews.js (Subrace dropdown)
//=============================================================================

/** View for the subrace selection dropdown. */
class SubracePickerView {
	/**
	 * Creates a new SubracePickerView instance
	 */
	constructor() {
		/**
		 * The subrace selection dropdown element
		 * @type {HTMLSelectElement}
		 * @private
		 */
		this._subraceSelect = document.getElementById('subraceSelect');

		// Set up event listeners
		this._setupEventListeners();
	}

	//-------------------------------------------------------------------------
	// Event Setup
	//-------------------------------------------------------------------------

	/**
	 * Sets up event listeners for subrace selection changes
	 * @private
	 */
	_setupEventListeners() {
		if (this._subraceSelect) {
			this._subraceSelect.addEventListener('change', (event) => {
				const selectedValue = event.target.value;
				// Emit event for both named subraces and standard (empty value)
				eventBus.emit(EVENTS.SUBRACE_SELECTED, {
					name: selectedValue,
					value: selectedValue,
				});
			});
		}
	}

	//-------------------------------------------------------------------------
	// Public API
	//-------------------------------------------------------------------------

	/**
	 * Get the subrace select element
	 * @returns {HTMLSelectElement}
	 */
	getSubraceSelect() {
		return this._subraceSelect;
	}

	/**
	 * Get the currently selected subrace value
	 * @returns {string} Subrace name or empty string
	 */
	getSelectedSubraceValue() {
		return this._subraceSelect.value;
	}

	/**
	 * Set the selected subrace value
	 * @param {string} value - Subrace name
	 */
	setSelectedSubraceValue(value) {
		this._subraceSelect.value = value;
	}

	/**
	 * Populate the subrace selection dropdown
	 * @param {Array<Object>} subraces - Array of subrace objects
	 * @param {boolean} isRequired - Whether subrace selection is required
	 */
	populateSubraceSelect(subraces, isRequired = false) {
		this._subraceSelect.innerHTML = '<option value="">No Subraces</option>';
		this._subraceSelect.disabled = true;

		if (!subraces || subraces.length === 0) {
			return;
		}

		// Filter out subraces without names
		const namedSubraces = subraces.filter(
			(sr) => sr.name && sr.name.trim() !== '',
		);

		if (namedSubraces.length === 0) {
			return;
		}

		// Sort subraces by name
		const sortedSubraces = [...namedSubraces].sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		// If subraces are optional, show "Standard" option as the default
		if (!isRequired) {
			this._subraceSelect.innerHTML = '<option value="">Standard</option>';
		} else {
			// If required, don't show a placeholder option
			this._subraceSelect.innerHTML = '';
		}

		this._subraceSelect.disabled = false;

		// Add options to select
		for (const subrace of sortedSubraces) {
			const option = document.createElement('option');
			option.value = subrace.name;
			option.textContent = subrace.name;
			this._subraceSelect.appendChild(option);
		}
	}

	/**
	 * Clear and disable the subrace select
	 */
	reset() {
		this._subraceSelect.innerHTML = '<option value="">No Subraces</option>';
		this._subraceSelect.disabled = true;
	}

	/**
	 * Check if a subrace option exists in the dropdown
	 * @param {string} subraceName - Subrace name
	 * @returns {boolean}
	 */
	hasSubraceOption(subraceName) {
		return Array.from(this._subraceSelect.options).some(
			(option) => option.value === subraceName,
		);
	}

	/**
	 * Trigger a change event on the subrace select
	 */
	triggerSubraceSelectChange() {
		this._subraceSelect.dispatchEvent(new Event('change', { bubbles: true }));
	}
}
