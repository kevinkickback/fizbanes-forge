// Controller for race selection UI, coordinating views and subrace logic.

import { AppState } from '../../../app/AppState.js';
import { CharacterManager } from '../../../app/CharacterManager.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { NotFoundError } from '../../../lib/Errors.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';

import {
	getSpeedString,
	SIZE_ABV_TO_FULL,
	sizeAbvToFull,
	STANDARD_LANGUAGE_OPTIONS,
	STANDARD_SKILL_OPTIONS,
	STANDARD_TOOL_OPTIONS,
	toTitleCase,
	unpackUid,
} from '../../../lib/5eToolsParser.js';
import TextProcessor, { textProcessor } from '../../../lib/TextProcessor.js';
import {
	abilityScoreService,
	getAbilityData,
	getRaceAbilityData,
} from '../../../services/AbilityScoreService.js';
import { raceService } from '../../../services/RaceService.js';
import { sourceService } from '../../../services/SourceService.js';

export class RaceCard {
	constructor() {
		this._raceService = raceService;

		// DOM elements
		this._choicesPanel = document.getElementById('raceChoicesPanel');
		this._raceList = document.getElementById('raceList');
		this._infoPanel = document.getElementById('raceInfoPanel');
		this._toggleBtn = document.getElementById('raceInfoToggle');
		this._searchInput = document.getElementById('raceSearchInput');

		this._detailsView = new RaceDetailsView();

		// DOM cleanup manager
		this._cleanup = DOMCleanup.create();

		// EventBus listener tracking
		this._eventHandlers = {};

		// Track current selection
		this._selectedRace = null;
		this._selectedSubrace = null;

		// Initialize the component
		this.initialize();
	}

	//-------------------------------------------------------------------------
	// Initialization Methods
	//-------------------------------------------------------------------------

	async initialize() {
		try {
			await this._raceService.initialize();
			this._setupEventListeners();
			this._setupToggleButton();
			await this._populateRaceList();
			await this._loadSavedRaceSelection();
		} catch (error) {
			console.error('[RaceCard]', 'Failed to initialize race card:', error);
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

	_setupEventListeners() {
		// sources:allowed-changed fires after CHARACTER_SELECTED and ensures
		// the list is populated with correctly filtered sources before loading
		// the saved selection.
		this.onEventBus(EVENTS.SOURCES_ALLOWED_CHANGED, () => {
			this._populateRaceList();
			this._loadSavedRaceSelection();
		});

		// Search input event
		if (this._searchInput) {
			this._cleanup.on(this._searchInput, 'input', () => {
				this._populateRaceList();
			});
		}
	}

	_cleanupEventListeners() {
		// Remove all eventBus listeners
		this._cleanupEventBusListeners();

		// Clean up all tracked DOM listeners
		this._cleanup.cleanup();
	}

	//-------------------------------------------------------------------------
	// EventBus Cleanup Helpers
	//-------------------------------------------------------------------------

	onEventBus(event, handler) {
		if (typeof handler !== 'function') {
			console.warn('[RaceCard]', 'Handler must be a function', { event });
			return;
		}

		eventBus.on(event, handler);

		if (!this._eventHandlers[event]) {
			this._eventHandlers[event] = [];
		}
		this._eventHandlers[event].push(handler);
	}

	_cleanupEventBusListeners() {
		for (const [event, handlers] of Object.entries(this._eventHandlers)) {
			if (Array.isArray(handlers)) {
				for (const handler of handlers) {
					try {
						eventBus.off(event, handler);
					} catch (e) {
						console.warn('[RaceCard]', 'Error removing listener', {
							event,
							error: e,
						});
					}
				}
			}
		}

		this._eventHandlers = {};
		console.debug('[RaceCard]', 'EventBus cleanup complete');
	}

	//-------------------------------------------------------------------------
	// Data Loading Methods
	//-------------------------------------------------------------------------

	async _populateRaceList() {
		if (!this._raceList) return;

		try {
			const races = this._raceService.getAllRaces();
			if (!races || races.length === 0) {
				console.error('[RaceCard]', 'No races available to populate list');
				return;
			}

			// Filter races by allowed sources
			let filteredRaces = races.filter((race) =>
				sourceService.isSourceAllowed(race.source)
			);

			// Apply search filter
			if (this._searchInput?.value?.trim()) {
				const query = this._searchInput.value.trim().toLowerCase();
				filteredRaces = filteredRaces.filter((race) =>
					race.name.toLowerCase().includes(query)
				);
			}

			if (filteredRaces.length === 0) {
				console.error('[RaceCard]', 'No races available after filtering');
				this._raceList.innerHTML = '<div class="text-muted px-2">No races found.</div>';
				return;
			}

			// Sort races by name
			const sortedRaces = [...filteredRaces].sort((a, b) =>
				a.name.localeCompare(b.name)
			);

			// Clear existing content
			this._raceList.innerHTML = '';

			// Create race items
			for (const race of sortedRaces) {
				await this._createRaceItem(race);
			}

			console.debug('[RaceCard]', `Populated ${sortedRaces.length} races`);
		} catch (error) {
			console.error('[RaceCard]', 'Error populating race list:', error);
		}
	}

	async _createRaceItem(race) {
		const subraces = this._raceService.getSubraces(race.name, race.source);
		const hasSubraces = subraces && subraces.length > 0;
		const raceId = this.sanitizeId(race.name);

		const raceItem = document.createElement('div');
		raceItem.className = 'race-item';
		raceItem.setAttribute('data-race', `${race.name}_${race.source}`);
		raceItem.setAttribute('data-info', raceId);

		const itemWrapper = document.createElement('div');
		itemWrapper.className = 'race-item-wrapper';

		itemWrapper.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <input type="radio" name="race" value="${race.name}_${race.source}" class="form-check-input">
                <div class="flex-grow-1">
                    <strong>${race.name}</strong>
                </div>
            </div>
        `;

		raceItem.appendChild(itemWrapper);

		// Add subrace dropdown if applicable
		if (hasSubraces) {
			// Filter subraces by source first
			const filteredSubraces = subraces.filter((subrace) => {
				const subraceSource = subrace.source || race.source;
				return (
					sourceService.isSourceAllowed(subraceSource) &&
					subrace.name &&
					subrace.name.trim() !== ''
				);
			});

			// Check if there's a base/standard race option (e.g., Standard Human vs Variant Human)
			const baseSubrace = this._raceService.getBaseSubrace(
				race.name,
				race.source,
			);

			// Only create dropdown if there are filtered subraces
			if (filteredSubraces.length > 0) {
				const dropdownContainer = document.createElement('div');
				dropdownContainer.className = 'inline-dropdown-container';

				const select = document.createElement('select');
				select.className = 'form-select form-select-sm';

				// If there's a base subrace, add "Standard" option first
				if (baseSubrace) {
					const standardOption = document.createElement('option');
					standardOption.value = '__standard__';
					standardOption.textContent = 'Standard';
					select.appendChild(standardOption);
					// Create info panel for the standard/base race using baseSubrace data
					await this._createRaceInfoPanel(race, baseSubrace, true);
				}

				// Add subrace options
				for (const subrace of filteredSubraces) {
					const option = document.createElement('option');
					option.value = subrace.name;
					option.textContent = subrace.name;
					select.appendChild(option);
					await this._createRaceInfoPanel(race, subrace);
				}

				dropdownContainer.appendChild(select);
				const flexContainer = itemWrapper.querySelector('.d-flex');
				flexContainer.appendChild(dropdownContainer);

				// Handle subrace selection
				this._cleanup.on(select, 'change', () => {
					const subraceName = select.value;

					// Handle "Standard" selection (base race with baseSubrace data)
					if (subraceName === '__standard__') {
						this._selectedSubrace = baseSubrace; // Use baseSubrace for ability data
						const raceId = this.sanitizeId(race.name);
						this._showInfo(raceId);
						this._updateCharacterRace(race, baseSubrace);
						return;
					}

					const subraceData = this._raceService.getSubrace(
						race.name,
						subraceName,
						race.source,
					);
					this._selectedSubrace = subraceData;
					const subraceId = this.sanitizeId(`${race.name}-${subraceName}`);
					this._showInfo(subraceId);
					this._updateCharacterRace(race, subraceData);
				});
			} else if (baseSubrace) {
				// Has base subrace but no named subraces (after filtering) - show base race
				await this._createRaceInfoPanel(race, null);
			} else {
				// No filtered subraces, treat as race without subraces
				await this._createRaceInfoPanel(race, null);
			}
		} else {
			await this._createRaceInfoPanel(race, null);
		}

		// Handle race selection
		const radio = itemWrapper.querySelector('input[type="radio"]');
		this._cleanup.on(raceItem, 'click', (e) => {
			// Don't trigger if clicking on the select itself
			if (
				e.target.tagName === 'SELECT' ||
				e.target.closest('.inline-dropdown-container')
			)
				return;

			if (radio) {
				radio.checked = true;
				this._selectedRace = race;

				// Check if dropdown actually exists (filtered subraces)
				const select = itemWrapper.querySelector('select');

				// If has dropdown with subraces, show first subrace info, otherwise show race info
				if (select && select.options.length > 0) {
					const subraceName = select.value;

					// Handle "Standard" selection (base race with baseSubrace data)
					if (subraceName === '__standard__') {
						const baseSubraceData = this._raceService.getBaseSubrace(
							race.name,
							race.source,
						);
						this._selectedSubrace = baseSubraceData;
						this._showInfo(raceId);
						this._updateCharacterRace(race, baseSubraceData);
					} else if (subraceName) {
						const subraceData = this._raceService.getSubrace(
							race.name,
							subraceName,
							race.source,
						);
						this._selectedSubrace = subraceData;
						const subraceId = this.sanitizeId(`${race.name}-${subraceName}`);
						this._showInfo(subraceId);
						this._updateCharacterRace(race, subraceData);
					}
				} else {
					this._selectedSubrace = null;
					this._showInfo(raceId);
					this._updateCharacterRace(race, null);
				}

				// Remove selected class from all race items
				this._raceList.querySelectorAll('.race-item').forEach((item) => {
					item.classList.remove('selected');
				});
				raceItem.classList.add('selected');
			}
		});

		// Add hover to show info
		this._cleanup.on(raceItem, 'mouseenter', () => {
			// Check if dropdown actually exists
			const select = itemWrapper.querySelector('select');

			if (select && select.options.length > 0) {
				const subraceName = select.value;
				// Handle "Standard" selection (base race)
				if (subraceName === '__standard__' || !subraceName) {
					this._showInfo(raceId, false);
				} else {
					const subraceId = this.sanitizeId(`${race.name}-${subraceName}`);
					this._showInfo(subraceId, false);
				}
			} else {
				this._showInfo(raceId, false);
			}
		});

		this._raceList.appendChild(raceItem);
	}

	_showInfo(contentId, expand = true) {
		if (!this._infoPanel) return;

		// Hide all info content
		const allContent = this._infoPanel.querySelectorAll('.info-content');
		allContent.forEach((content) => {
			content.classList.add('d-none');
		});

		// Show the selected content
		const targetContent = this._infoPanel.querySelector(
			`[data-for="${contentId}"]`,
		);
		if (targetContent) {
			targetContent.classList.remove('d-none');
			// Expand info panel if requested
			if (expand) {
				this._infoPanel.classList.remove('collapsed');
			}
		} else {
			console.warn('[RaceCard]', `Info panel not found for: ${contentId}`);
		}
	}

	async _createRaceInfoPanel(race, subrace = null, isBaseSubrace = false) {
		if (!this._infoPanel) return;

		// Use combined ID if subrace is provided (and not a base subrace)
		// Base subraces (like "Standard Human") use just the race name as ID
		const contentId =
			subrace && !isBaseSubrace
				? this.sanitizeId(`${race.name}-${subrace.name}`)
				: this.sanitizeId(race.name);

		// Check if panel already exists to avoid duplicates
		const existingPanel = this._infoPanel.querySelector(
			`[data-for="${contentId}"]`,
		);
		if (existingPanel) {
			console.debug(
				'[RaceCard]',
				`Info panel already exists for: ${contentId}`,
			);
			return;
		}

		const infoContent = document.createElement('div');
		infoContent.className = 'info-content d-none';
		infoContent.setAttribute('data-for', contentId);

		// Get fluff for description
		const fluff = this._raceService.getRaceFluff(race.name, race.source);
		const intro = fluff?.entries?.[0];

		// Title shows subrace name if provided (but not for base subraces which have no name)
		let title = race.name;
		if (subrace?.name) {
			title = `${race.name} (${subrace.name})`;
		} else if (isBaseSubrace) {
			title = `${race.name} (Standard)`;
		}
		let html = `<h6>${title}</h6>`;

		// Add description
		if (typeof intro === 'string') {
			html += `<p class="text-muted small">${intro.substring(0, 200)}${intro.length > 200 ? '...' : ''}</p>`;
		}

		html += `<hr class="my-2">`;

		// Use the details view to generate sections
		html += await this._detailsView.generateDetailsHTML(race, subrace);

		infoContent.innerHTML = html;
		await textProcessor.processElement(infoContent);
		this._infoPanel.appendChild(infoContent);
	}

	sanitizeId(name) {
		return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
	}

	async _loadSavedRaceSelection() {
		try {
			const character = AppState.getCurrentCharacter();
			if (!character?.race?.name || !character?.race?.source) {
				return; // No saved race to load
			}

			// Find the race item in the list
			const raceValue = `${character.race.name}_${character.race.source}`;
			console.debug('[RaceCard]', 'Loading saved race:', raceValue);

			let raceItem = this._raceList?.querySelector(
				`[data-race="${raceValue}"]`,
			);
			if (!raceItem) {
				// Fallback: try to match by name ignoring source (e.g., PHB vs PHB-2014/XPHB variants)
				const fallbackItem = this._raceList?.querySelector(
					`[data-race^="${character.race.name}_"]`,
				);
				if (fallbackItem) {
					const fallbackAttr = fallbackItem.getAttribute('data-race');
					console.warn(
						'RaceCard',
						`Saved race "${raceValue}" not found; using available variant "${fallbackAttr}"`,
					);
					raceItem = fallbackItem;
					const [, fallbackSource] = fallbackAttr.split('_');
					character.race.source = fallbackSource || character.race.source;
				} else {
					console.warn(
						'RaceCard',
						`Saved race "${raceValue}" not found in available options. Character might use a source that's not currently allowed.`,
					);
					return;
				}
			}

			// Check the radio button for this race
			const radioButton = raceItem.querySelector('input[type="radio"]');
			if (radioButton) {
				radioButton.checked = true;
			}

			// Mark the race item as selected
			this._raceList.querySelectorAll('.race-item').forEach((item) => {
				item.classList.remove('selected');
			});
			raceItem.classList.add('selected');

			// Scroll the race list to show the selected item if any part is not visible
			// Use requestAnimationFrame to ensure layout is complete
			requestAnimationFrame(() => {
				if (this._raceList) {
					const padding = 20; // Add padding to ensure full visibility
					const itemTop = raceItem.offsetTop;
					const itemHeight = raceItem.offsetHeight;
					const itemBottom = itemTop + itemHeight;
					const listScrollTop = this._raceList.scrollTop;
					const listHeight = this._raceList.offsetHeight;
					const listScrollBottom = listScrollTop + listHeight;

					console.debug('[RaceCard]', 'Scrolling to selected race:', {
						itemTop,
						itemBottom,
						listScrollTop,
						listScrollBottom,
						listHeight,
						padding,
					});

					// Scroll if any part of the item is not visible (with padding buffer)
					if (itemBottom + padding > listScrollBottom) {
						// Item bottom is below visible area - scroll down with padding
						const targetScroll = itemBottom + padding - listHeight;
						console.debug(
							'[RaceCard] Item bottom cut off, scrolling to:',
							targetScroll,
						);
						this._raceList.scrollTop = targetScroll;
					} else if (itemTop - padding < listScrollTop) {
						// Item top is above visible area - scroll up with padding
						const targetScroll = Math.max(0, itemTop - padding);
						console.debug(
							'[RaceCard] Item top cut off, scrolling to:',
							targetScroll,
						);
						this._raceList.scrollTop = targetScroll;
					}

					// Verify scroll happened
					setTimeout(() => {
						console.debug(
							'[RaceCard] Scroll complete. New scrollTop:',
							this._raceList.scrollTop,
						);
					}, 100);
				} else {
					console.warn('[RaceCard]', 'No race list found for scrolling');
				}
			});

			// Get the race data
			try {
				const race = this._raceService.getRace(
					character.race.name,
					character.race.source,
				);

				// Store the selected race
				this._selectedRace = race;

				// Handle subrace if present
				let subrace = null;
				let infoId = this.sanitizeId(race.name);

				if (character.race.subrace) {
					console.debug(
						'[RaceCard]',
						'Saved subrace found:',
						character.race.subrace,
					);

					// Find and set the subrace dropdown if it exists
					const subraceSelect = raceItem.querySelector('select');
					if (subraceSelect) {
						const subraceOption = Array.from(subraceSelect.options).find(
							(opt) => opt.value === character.race.subrace,
						);
						if (subraceOption) {
							subraceSelect.value = character.race.subrace;
							try {
								subrace = this._raceService.getSubrace(
									race.name,
									character.race.subrace,
									race.source,
								);
								this._selectedSubrace = subrace;
								infoId = this.sanitizeId(`${race.name}-${character.race.subrace}`);
								console.debug(
									'[RaceCard]',
									'Subrace restored:',
									character.race.subrace,
								);
							} catch (err) {
								console.warn(
									'[RaceCard]',
									`Saved subrace "${character.race.subrace}" not found:`,
									err.message,
								);
							}
						} else {
							console.warn(
								'RaceCard',
								`Saved subrace "${character.race.subrace}" not found in dropdown options.`,
							);
						}
					}
				} else {
					// No subrace saved - if there's a dropdown with "Standard" option, select it
					const subraceSelect = raceItem.querySelector('select');
					if (subraceSelect) {
						const standardOption = Array.from(subraceSelect.options).find(
							(opt) => opt.value === '__standard__',
						);
						if (standardOption) {
							subraceSelect.value = '__standard__';
							this._selectedSubrace = null;
							console.debug('[RaceCard]', 'Standard race option selected');
						}
					}
				}

				// Show info panel for this race/subrace
				this._showInfo(infoId, true);

				console.debug('[RaceCard]', 'Saved race selection loaded successfully');

				// Re-apply racial ability bonuses and pending choices (silently, without triggering DOM events)
				this._updateAbilityBonuses(race, subrace, { silent: true });

				// Restore any previously saved racial ability choices
				const savedChoices = character.race?.abilityChoices || [];
				if (savedChoices.length > 0) {
					abilityScoreService.setRacialAbilityChoices(savedChoices);
				}

				// Notify AbilityScoreCard so it re-renders with the restored bonuses
				eventBus.emit(EVENTS.ABILITY_SCORES_CHANGED, { source: 'RaceCard:loadSaved' });
			} catch (error) {
				console.error('[RaceCard]', 'Error loading saved race selection:', error);
				if (error instanceof NotFoundError) {
					console.warn('[RaceCard]', 'Race or subrace data not found - may need to select again');
				}
			}
		} catch (error) {
			console.error('[RaceCard]', 'Unexpected error in _loadSavedRaceSelection:', error);
		}
	}

	//-------------------------------------------------------------------------
	// Character Data Management
	//-------------------------------------------------------------------------

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

			// Notify EventBus so unsaved indicator and cross-component listeners react
			eventBus.emit(EVENTS.CHARACTER_UPDATED, {
				character: CharacterManager.getCurrentCharacter(),
			});
		}
	}

	_updateAbilityBonuses(race, subrace, options = {}) {
		const { silent = false } = options;
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
				console.debug('[RaceCard]', 'No ability choices found for race/subrace');
			}
		} catch (error) {
			console.error('[RaceCard]', 'Error updating ability bonuses:', error);
		}

		// Notify of changes (unless silent mode)
		if (!silent) {
			document.dispatchEvent(
				new CustomEvent('abilityScoresChanged', { detail: { character } }),
			);
		}
	}

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
					for (const lang of STANDARD_LANGUAGE_OPTIONS) {
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
				TextProcessor.normalizeForLookup(lang),
			);
			character.optionalProficiencies.languages.race.selected =
				previousSelections.filter((lang) =>
					normalizedLanguageOptions.includes(
						TextProcessor.normalizeForLookup(lang),
					),
				);
		}
	}

	_processWeaponProficiencies(race, character) {
		if (!race.weaponProficiencies || !Array.isArray(race.weaponProficiencies))
			return;

		for (const profObj of race.weaponProficiencies) {
			for (const [weapon, hasProf] of Object.entries(profObj)) {
				if (hasProf === true) {
					// Extract the weapon name without the source using unpackUid
					const { name: weaponName } = unpackUid(weapon);
					character.addProficiency('weapons', weaponName, 'Race');
				}
			}
		}
	}

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
					STANDARD_TOOL_OPTIONS;
				// Restore valid selections using normalized comparison
				const normalizedToolOptions =
					character.optionalProficiencies.tools.race.options.map((tool) =>
						TextProcessor.normalizeForLookup(tool),
					);
				character.optionalProficiencies.tools.race.selected =
					previousSelections.filter((tool) =>
						normalizedToolOptions.includes(
							TextProcessor.normalizeForLookup(tool),
						),
					);
			}
		}
	}

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
					raceSkillOptions = STANDARD_SKILL_OPTIONS;
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
			raceSkillOptions = STANDARD_SKILL_OPTIONS;
		}

		// Update race-specific skill options and count
		if (raceSkillCount > 0) {
			character.optionalProficiencies.skills.race.allowed = raceSkillCount;
			character.optionalProficiencies.skills.race.options = raceSkillOptions;
			// Restore valid selections using normalized comparison
			const normalizedRaceSkillOptions = raceSkillOptions.map((skill) =>
				TextProcessor.normalizeForLookup(skill),
			);
			character.optionalProficiencies.skills.race.selected =
				previousSelections.filter((skill) =>
					normalizedRaceSkillOptions.includes(
						TextProcessor.normalizeForLookup(skill),
					),
				);
		}
	}
	_updateCombinedProficiencyOptions(character) {
		if (!character) return;

		// Merge proficiency options from all sources (race, class, background)
		this._mergeProficiencySource(character, 'skills');
		this._mergeProficiencySource(character, 'languages');
		this._mergeProficiencySource(character, 'tools');
	}

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

	_updateCombinedSkillOptions(character) {
		this._mergeProficiencySource(character, 'skills');
	}

	_updateCombinedLanguageOptions(character) {
		this._mergeProficiencySource(character, 'languages');
	}

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

class RaceDetailsView {
	constructor() {
		this._raceDetails = document.getElementById('raceDetails');
	}

	//-------------------------------------------------------------------------
	// HTML Generation for Info Panel
	//-------------------------------------------------------------------------

	async generateDetailsHTML(race, subrace = null) {
		if (!race) return '';

		let html = '';

		// Ability Scores section
		html += `<div class="detail-section mb-2">
            <h6 class="small mb-1"><strong>Ability Score Increase</strong></h6>
            <div class="small text-muted">`;
		const abilityImprovements = this._formatAbilityImprovements(
			race,
			subrace,
		).split('\n');
		html += abilityImprovements.join('<br>');
		html += `</div></div>`;

		// Size section
		html += `<div class="detail-section mb-2">
            <h6 class="small mb-1"><strong>Size</strong></h6>
            <div class="small text-muted">${this._formatSize(race)}</div>
        </div>`;

		// Speed section
		html += `<div class="detail-section mb-2">
            <h6 class="small mb-1"><strong>Speed</strong></h6>
            <div class="small text-muted">`;
		const speeds = this._formatMovementSpeeds(race).split('\n');
		html += speeds.join('<br>');
		html += `</div></div>`;

		// Languages section
		html += `<div class="detail-section mb-2">
            <h6 class="small mb-1"><strong>Languages</strong></h6>
            <div class="small text-muted">`;
		const languages = this._formatLanguages(race).split('\n');
		html += languages.join('<br>');
		html += `</div></div>`;

		// Traits section
		const traits = this._getCombinedTraits(race, subrace);
		if (traits.length > 0) {
			html += `<div class="detail-section mb-2">
                <h6 class="small mb-1"><strong>Traits</strong></h6>
                <div class="traits-grid">`;

			// Process traits to create hover links with descriptions
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
							const processedEntries = await Promise.all(
								trait.entries.map((entry) => {
									if (typeof entry === 'string') {
										return textProcessor.processString(entry);
									} else if (entry.type === 'list' && entry.items) {
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

					return `<a class="trait-tag rd__hover-link" data-hover-type="trait" data-hover-name="${name}" data-hover-content="${description.replace(/"/g, '&quot;')}">${name}</a>`;
				}),
			);

			html += processedTraits.join('');
			html += `</div></div>`;
		}

		return html;
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
