// Controller for background selection UI, coordinating views and variant logic.

import { AppState } from '../../../app/AppState.js';
import { CharacterManager } from '../../../app/CharacterManager.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import TextProcessor from '../../../lib/TextProcessor.js';

import {
	toSentenceCase,
	toTitleCase,
	unpackUid,
} from '../../../lib/5eToolsParser.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { backgroundService } from '../../../services/BackgroundService.js';
import { sourceService } from '../../../services/SourceService.js';

export class BackgroundCard {
	constructor() {
		this._backgroundService = backgroundService;

		// DOM elements
		this._choicesPanel = document.getElementById('backgroundChoicesPanel');
		this._backgroundList = document.getElementById('backgroundList');
		this._infoPanel = document.getElementById('backgroundInfoPanel');
		this._toggleBtn = document.getElementById('backgroundInfoToggle');
		this._searchInput = document.getElementById('backgroundSearchInput');

		this._detailsView = new BackgroundDetailsView();

		// DOM cleanup manager
		this._cleanup = DOMCleanup.create();

		// EventBus listener tracking
		this._eventHandlers = {};

		// Track current selection
		this._selectedBackground = null;
		this._selectedVariant = null;

		// Initialize the component
		this.initialize();
	}

	//-------------------------------------------------------------------------
	// Initialization Methods
	//-------------------------------------------------------------------------

	async initialize() {
		try {
			// Initialize background service FIRST before setting up listeners
			// This ensures background data is ready before any events try to use it
			await this._backgroundService.initialize();

			// NOW set up event listeners and load saved selection
			this._setupEventListeners();
			this._setupToggleButton();
			await this._populateBackgroundList();
			await this._loadSavedBackgroundSelection();
		} catch (error) {
			console.error(
				'BackgroundCard',
				'Failed to initialize background card:',
				error,
			);
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
		this.onEventBus('sources:allowed-changed', () => {
			this._populateBackgroundList();
			this._loadSavedBackgroundSelection();
		});

		// Search input event
		if (this._searchInput) {
			this._cleanup.on(this._searchInput, 'input', () => {
				this._populateBackgroundList();
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
			console.warn('[BackgroundCard]', 'Handler must be a function', { event });
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
						console.warn('[BackgroundCard]', 'Error removing listener', {
							event,
							error: e,
						});
					}
				}
			}
		}

		this._eventHandlers = {};
		console.debug('[BackgroundCard]', 'EventBus cleanup complete');
	}

	//-------------------------------------------------------------------------
	// Data Loading Methods
	//-------------------------------------------------------------------------

	async _populateBackgroundList() {
		if (!this._backgroundList) return;

		try {
			const backgrounds = this._backgroundService.getAllBackgrounds();
			if (!backgrounds || backgrounds.length === 0) {
				console.error('[BackgroundCard]', 'No backgrounds available to populate list');
				return;
			}

			// Filter backgrounds by allowed sources
			let filteredBackgrounds = backgrounds.filter((background) =>
				sourceService.isSourceAllowed(background.source)
			);

			// Apply search filter
			if (this._searchInput?.value?.trim()) {
				const query = this._searchInput.value.trim().toLowerCase();
				filteredBackgrounds = filteredBackgrounds.filter((background) =>
					background.name.toLowerCase().includes(query)
				);
			}

			if (filteredBackgrounds.length === 0) {
				console.error('[BackgroundCard]', 'No backgrounds available after filtering');
				this._backgroundList.innerHTML = '<div class="text-muted px-2">No backgrounds found.</div>';
				return;
			}

			// Sort backgrounds by name
			const sortedBackgrounds = [...filteredBackgrounds].sort((a, b) =>
				a.name.localeCompare(b.name)
			);

			// Clear existing content
			this._backgroundList.innerHTML = '';

			// Create background items
			for (const background of sortedBackgrounds) {
				await this._createBackgroundItem(background);
			}

			console.debug('[BackgroundCard]', `Populated ${sortedBackgrounds.length} backgrounds`);
		} catch (error) {
			console.error('[BackgroundCard]', 'Error populating background list:', error);
		}
	}

	async _createBackgroundItem(background) {
		const variants = background.variants || [];
		const hasVariants = variants && variants.length > 0;
		const backgroundId = this.sanitizeId(background.name);

		const backgroundItem = document.createElement('div');
		backgroundItem.className = 'background-item';
		backgroundItem.setAttribute(
			'data-background',
			`${background.name}_${background.source}`,
		);
		backgroundItem.setAttribute('data-info', backgroundId);

		const itemWrapper = document.createElement('div');
		itemWrapper.className = 'background-item-wrapper';

		itemWrapper.innerHTML = `
            <div class="d-flex align-items-center gap-2">
                <input type="radio" name="background" value="${background.name}_${background.source}" class="form-check-input">
                <div class="flex-grow-1">
                    <strong>${background.name}</strong>
                </div>
            </div>
        `;

		backgroundItem.appendChild(itemWrapper);

		// Add variant dropdown if applicable
		if (hasVariants) {
			// Filter variants by source first
			const filteredVariants = variants.filter((variant) => {
				const variantSource = variant.source || background.source;
				return (
					sourceService.isSourceAllowed(variantSource) &&
					variant.name &&
					variant.name.trim() !== ''
				);
			});

			// Only create dropdown if there are filtered variants
			if (filteredVariants.length > 0) {
				const dropdownContainer = document.createElement('div');
				dropdownContainer.className = 'inline-dropdown-container';

				const select = document.createElement('select');
				select.className = 'form-select form-select-sm';

				// Add variant options
				for (const variant of filteredVariants) {
					const option = document.createElement('option');
					option.value = variant.name;
					option.textContent = variant.name;
					select.appendChild(option);
					await this._createBackgroundInfoPanel(background, variant);
				}

				dropdownContainer.appendChild(select);
				const flexContainer = itemWrapper.querySelector('.d-flex');
				flexContainer.appendChild(dropdownContainer);

				// Handle variant selection
				this._cleanup.on(select, 'change', () => {
					const variantName = select.value;
					const variantData = variants.find((v) => v.name === variantName);
					this._selectedVariant = variantData;
					const variantId = this.sanitizeId(
						`${background.name}-${variantName}`,
					);
					this._showInfo(variantId);
					this._updateCharacterBackground(background, variantData);
				});
			} else {
				// No filtered variants, treat as background without variants
				await this._createBackgroundInfoPanel(background, null);
			}
		} else {
			await this._createBackgroundInfoPanel(background, null);
		}

		// Handle background selection
		const radio = itemWrapper.querySelector('input[type="radio"]');
		this._cleanup.on(backgroundItem, 'click', (e) => {
			// Don't trigger if clicking on the select itself
			if (
				e.target.tagName === 'SELECT' ||
				e.target.closest('.inline-dropdown-container')
			)
				return;

			if (radio) {
				radio.checked = true;
				this._selectedBackground = background;

				// Check if dropdown actually exists (filtered variants)
				const select = itemWrapper.querySelector('select');

				// If has dropdown with variants, show first variant info, otherwise show background info
				if (select && select.options.length > 0) {
					const variantName = select.value;
					if (variantName) {
						const variantData = variants.find((v) => v.name === variantName);
						this._selectedVariant = variantData;
						const variantId = this.sanitizeId(
							`${background.name}-${variantName}`,
						);
						this._showInfo(variantId);
						this._updateCharacterBackground(background, variantData);

						// Emit event to notify about character update (unsaved changes)
						eventBus.emit(EVENTS.CHARACTER_UPDATED, {
							character: CharacterManager.getCurrentCharacter(),
						});
					}
				} else {
					this._selectedVariant = null;
					this._showInfo(backgroundId);
					this._updateCharacterBackground(background, null);

					// Emit event to notify about character update (unsaved changes)
					eventBus.emit(EVENTS.CHARACTER_UPDATED, {
						character: CharacterManager.getCurrentCharacter(),
					});
				}

				// Remove selected class from all background items
				this._backgroundList
					.querySelectorAll('.background-item')
					.forEach((item) => {
						item.classList.remove('selected');
					});
				backgroundItem.classList.add('selected');
			}
		});

		// Add hover to show info
		this._cleanup.on(backgroundItem, 'mouseenter', () => {
			// Check if dropdown actually exists
			const select = itemWrapper.querySelector('select');

			if (select && select.options.length > 0) {
				const variantName = select.value;
				if (variantName) {
					const variantId = this.sanitizeId(
						`${background.name}-${variantName}`,
					);
					this._showInfo(variantId, false);
				}
			} else {
				this._showInfo(backgroundId, false);
			}
		});

		this._backgroundList.appendChild(backgroundItem);
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
		}
	}

	async _createBackgroundInfoPanel(background, variant = null) {
		if (!this._infoPanel) return;

		const infoContent = document.createElement('div');
		infoContent.className = 'info-content d-none';

		// Use combined ID if variant is provided
		const contentId = variant
			? this.sanitizeId(`${background.name}-${variant.name}`)
			: this.sanitizeId(background.name);
		infoContent.setAttribute('data-for', contentId);

		// Get description
		const description = this._extractDescription(variant || background);

		// Title shows variant name if provided
		const title = variant
			? `${background.name} (${variant.name})`
			: background.name;
		let html = `<h6>${title}</h6>`;

		// Add description
		html += description;

		html += `<hr class="my-2">`;

		// Use the details view to generate sections
		html += await this._detailsView.generateDetailsHTML(variant || background);

		infoContent.innerHTML = html;
		await textProcessor.processElement(infoContent);
		this._infoPanel.appendChild(infoContent);
	}

	sanitizeId(name) {
		return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
	}

	_extractDescription(background) {
		if (background?.entries) {
			for (const entry of background.entries) {
				if (typeof entry === 'string') {
					const truncated = entry.substring(0, 200);
					return `<p class="text-muted small">${truncated}${entry.length > 200 ? '...' : ''}</p>`;
				}
				if (entry.type === 'entries' && entry.entries) {
					for (const subEntry of entry.entries) {
						if (typeof subEntry === 'string') {
							const truncated = subEntry.substring(0, 200);
							return `<p class="text-muted small">${truncated}${subEntry.length > 200 ? '...' : ''}</p>`;
						}
					}
				}
			}
		}
		return `<p class="text-muted small">${background.name} is a character background from ${background.source}.</p>`;
	}

	async _loadSavedBackgroundSelection() {
		try {
			const character = AppState.getCurrentCharacter();
			if (!character?.background?.name || !character?.background?.source) {
				return; // No saved background to load
			}

			// Find the background item in the list
			const backgroundValue = `${character.background.name}_${character.background.source}`;
			console.debug(
				'[BackgroundCard]',
				'Loading saved background:',
				backgroundValue,
			);

			let backgroundItem = this._backgroundList?.querySelector(
				`[data-background="${backgroundValue}"]`,
			);
			if (!backgroundItem) {
				// Fallback: try to match by name ignoring source variants (e.g., PHB vs PHB-2014/XPHB)
				const fallbackItem = this._backgroundList?.querySelector(
					`[data-background^="${character.background.name}_"]`,
				);
				if (fallbackItem) {
					const fallbackAttr = fallbackItem.getAttribute('data-background');
					console.warn(
						'BackgroundCard',
						`Saved background "${backgroundValue}" not found; using available variant "${fallbackAttr}"`,
					);
					backgroundItem = fallbackItem;
					const [, fallbackSource] = fallbackAttr.split('_');
					character.background.source =
						fallbackSource || character.background.source;
				} else {
					console.warn(
						'BackgroundCard',
						`Saved background "${backgroundValue}" not found in available options. Character might use a source that's not currently allowed.`,
					);
					return;
				}
			}

			// Check the radio button for this background
			const radioButton = backgroundItem.querySelector('input[type="radio"]');
			if (radioButton) {
				radioButton.checked = true;
			}

			// Mark the background item as selected
			this._backgroundList
				.querySelectorAll('.background-item')
				.forEach((item) => {
					item.classList.remove('selected');
				});
			backgroundItem.classList.add('selected');

			// Get the background data
			const background = this._backgroundService.selectBackground(
				character.background.name,
				character.background.source,
			);
			if (!background) {
				console.error(
					'[BackgroundCard]',
					'Could not find background data for:',
					backgroundValue,
				);
				return;
			}

			// Store the selected background
			this._selectedBackground = background;

			// Handle variant if present
			let variant = null;
			let infoId = this.sanitizeId(background.name);

			if (character.background.variant) {
				console.debug(
					'[BackgroundCard]',
					'Saved variant found:',
					character.background.variant,
				);

				// Find and set the variant dropdown if it exists
				const variantSelect = backgroundItem.querySelector('select');
				if (variantSelect) {
					const variantOption = Array.from(variantSelect.options).find(
						(opt) => opt.value === character.background.variant,
					);
					if (variantOption) {
						variantSelect.value = character.background.variant;
						variant = background.variants?.find(
							(v) => v.name === character.background.variant,
						);
						this._selectedVariant = variant;
						infoId = this.sanitizeId(
							`${background.name}-${character.background.variant}`,
						);
						console.debug(
							'[BackgroundCard]',
							'Variant restored:',
							character.background.variant,
						);
					} else {
						console.warn(
							'BackgroundCard',
							`Saved variant "${character.background.variant}" not found in dropdown options.`,
						);
					}
				}
			}

			// Show info panel for this background/variant
			this._showInfo(infoId, true);

			// Regenerate proficiency options if they're empty (from older save files)
			// This ensures options arrays are properly populated without resetting allowed/selected
			await this._regenerateEmptyProficiencyOptions(character, background);

			// Note: We don't emit CHARACTER_UPDATED here because loading saved data
			// is not a user change and shouldn't trigger the unsaved changes indicator

			console.debug(
				'[BackgroundCard]',
				'Saved background selection loaded successfully',
			);
		} catch (error) {
			console.error(
				'BackgroundCard',
				'Error loading saved background selection:',
				error,
			);
		}
	}

	//-------------------------------------------------------------------------
	// Character Data Management
	//-------------------------------------------------------------------------

	async _updateCharacterBackground(background, variant) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Check if background has changed
		const hasChanged = !background
			? character.background?.name || character.background?.source
			: character.background?.name !== background.name ||
			character.background?.source !== background.source ||
			character.background?.variant !== (variant?.name || null);

		if (hasChanged) {
			// Clear previous background proficiencies
			character.removeProficienciesBySource('Background');

			// Notify UI to clear optional proficiencies from background
			document.dispatchEvent(
				new CustomEvent('proficienciesRemoved', {
					detail: { source: 'Background' },
				}),
			);

			if (!background) {
				// Clear background
				character.background = {};
			} else {
				// Set background
				character.background = {
					name: background.name,
					source: background.source,
				};

				// Add variant if selected
				if (variant) {
					character.background.variant = variant.name;
				} else {
					character.background.variant = null;
				}

				// Add background proficiencies
				await this._updateBackgroundProficiencies(background);

				// Force a refresh after a short delay to ensure everything is updated
				setTimeout(() => {
					document.dispatchEvent(
						new CustomEvent('proficiencyChanged', {
							detail: { triggerCleanup: true, forcedRefresh: true },
						}),
					);
				}, 100);

				// Emit CHARACTER_UPDATED to signal unsaved changes
				eventBus.emit(EVENTS.CHARACTER_UPDATED, {
					character: CharacterManager.getCurrentCharacter(),
				});
			}
		}
	}

	async _updateBackgroundProficiencies(background) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character || !background) return;

		// Store previous skill and language selections to restore valid ones
		const prevBackgroundSkillsSelected =
			character.optionalProficiencies.skills.background?.selected || [];
		const prevBackgroundLanguagesSelected =
			character.optionalProficiencies.languages.background?.selected || [];

		// Get fixed proficiencies from background
		const fixedProfs = this._getFixedProficiencies(background);

		// Add fixed skill proficiencies
		for (const skill of fixedProfs.skills) {
			character.addProficiency('skills', skill, 'Background');
		}

		// Add fixed tool proficiencies
		for (const tool of fixedProfs.tools) {
			character.addProficiency('tools', tool, 'Background');
		}

		// Reset background skill options
		character.optionalProficiencies.skills.background.allowed = 0;
		character.optionalProficiencies.skills.background.options = [];
		character.optionalProficiencies.skills.background.selected = [];

		// Reset background language options
		character.optionalProficiencies.languages.background.allowed = 0;
		character.optionalProficiencies.languages.background.options = [];
		character.optionalProficiencies.languages.background.selected = [];

		// Set up optional skill proficiencies (5etools normalized format)
		const skillProfs = background?.proficiencies?.skills || [];
		for (const skillEntry of skillProfs) {
			if (skillEntry.choose) {
				const count = skillEntry.choose.count || 1;
				const from = skillEntry.choose.from || [];

				character.optionalProficiencies.skills.background.allowed = count;
				character.optionalProficiencies.skills.background.options = from;

				// Restore valid selections using normalized comparison
				const normalizedFrom = from.map((skill) =>
					TextProcessor.normalizeForLookup(skill),
				);
				const validSelections = prevBackgroundSkillsSelected.filter(
					(skill) =>
						normalizedFrom.includes(TextProcessor.normalizeForLookup(skill)) &&
						!character.proficiencies.skills.includes(skill) &&
						!fixedProfs.skills.includes(skill),
				);

				character.optionalProficiencies.skills.background.selected =
					validSelections.slice(0, count);
			}
		}

		// Set up optional tool proficiencies (5etools normalized format)
		const toolProfs = background?.proficiencies?.tools || [];
		for (const toolEntry of toolProfs) {
			if (toolEntry.choose) {
				const count = toolEntry.choose.count || 1;
				character.optionalProficiencies.tools.background.allowed = count;
				character.optionalProficiencies.tools.background.options = [];
				character.optionalProficiencies.tools.background.selected = [];
			}
		}

		// Handle languages from normalized structure
		await this._updateBackgroundLanguageProficiencies(
			character,
			background,
			prevBackgroundLanguagesSelected,
		);

		// Update combined skill options
		this._updateCombinedSkillOptions(character);
	}

	_getFixedProficiencies(background) {
		const skills = [];
		const tools = [];

		// Extract fixed skill proficiencies
		const skillProfs = background?.proficiencies?.skills || [];
		for (const skillEntry of skillProfs) {
			// Only add skills without a choose property (these are fixed)
			if (!skillEntry.choose && skillEntry.skill) {
				skills.push(skillEntry.skill);
			}
		}

		// Extract fixed tool proficiencies
		const toolProfs = background?.proficiencies?.tools || [];
		for (const toolEntry of toolProfs) {
			// Only add tools without a choose property (these are fixed)
			if (!toolEntry.choose && toolEntry.tool) {
				tools.push(toolEntry.tool);
			}
		}

		return { skills, tools };
	}

	_updateCombinedSkillOptions(character) {
		if (!character) return;

		const raceAllowed =
			character.optionalProficiencies.skills.race?.allowed || 0;
		const classAllowed =
			character.optionalProficiencies.skills.class?.allowed || 0;
		const backgroundAllowed =
			character.optionalProficiencies.skills.background?.allowed || 0;

		const raceOptions =
			character.optionalProficiencies.skills.race?.options || [];
		const classOptions =
			character.optionalProficiencies.skills.class?.options || [];
		const backgroundOptions =
			character.optionalProficiencies.skills.background?.options || [];

		const raceSelected =
			character.optionalProficiencies.skills.race?.selected || [];
		const classSelected =
			character.optionalProficiencies.skills.class?.selected || [];
		const backgroundSelected =
			character.optionalProficiencies.skills.background?.selected || [];

		// Preserve existing selections if source arrays are empty
		const sourceSelections = [
			...raceSelected,
			...classSelected,
			...backgroundSelected,
		];
		const existingSkillSelections =
			character.optionalProficiencies.skills.selected || [];

		// Update total allowed count
		character.optionalProficiencies.skills.allowed =
			raceAllowed + classAllowed + backgroundAllowed;

		// Combine selected skills from all sources
		character.optionalProficiencies.skills.selected =
			sourceSelections.length > 0
				? [...new Set(sourceSelections)]
				: existingSkillSelections; // Keep saved data if sources are empty

		// For combined options, include options from all sources
		character.optionalProficiencies.skills.options = [
			...new Set([...raceOptions, ...classOptions, ...backgroundOptions]),
		];
	}

	_updateCombinedLanguageOptions(character) {
		if (!character) return;

		const raceAllowed =
			character.optionalProficiencies.languages.race?.allowed || 0;
		const classAllowed =
			character.optionalProficiencies.languages.class?.allowed || 0;
		const backgroundAllowed =
			character.optionalProficiencies.languages.background?.allowed || 0;

		const raceOptions =
			character.optionalProficiencies.languages.race?.options || [];
		const classOptions =
			character.optionalProficiencies.languages.class?.options || [];
		const backgroundOptions =
			character.optionalProficiencies.languages.background?.options || [];

		const raceSelected =
			character.optionalProficiencies.languages.race?.selected || [];
		const classSelected =
			character.optionalProficiencies.languages.class?.selected || [];
		const backgroundSelected =
			character.optionalProficiencies.languages.background?.selected || [];

		// Preserve existing selections if source arrays are empty
		const sourceSelections = [
			...raceSelected,
			...classSelected,
			...backgroundSelected,
		];
		const existingLanguageSelections =
			character.optionalProficiencies.languages.selected || [];

		// Update total allowed count
		character.optionalProficiencies.languages.allowed =
			raceAllowed + classAllowed + backgroundAllowed;

		// Combine selected languages from all sources
		character.optionalProficiencies.languages.selected =
			sourceSelections.length > 0
				? [...new Set(sourceSelections)]
				: existingLanguageSelections; // Keep saved data if sources are empty

		// For combined options, include options from all sources
		character.optionalProficiencies.languages.options = [
			...new Set([...raceOptions, ...classOptions, ...backgroundOptions]),
		];
	}

	async _updateBackgroundLanguageProficiencies(
		character,
		background,
		prevBackgroundLanguagesSelected,
	) {
		const langProfs = background?.proficiencies?.languages || [];
		const fixedLanguages = [];
		let choiceCount = 0;
		const choiceOptions = [];
		const normalizedOptions = new Map();

		// Process all language proficiency entries
		for (const langEntry of langProfs) {
			// Add fixed languages (those without a choose property)
			if (!langEntry.choose && langEntry.language) {
				character.addProficiency('languages', langEntry.language, 'Background');
				fixedLanguages.push(langEntry.language);
			}

			// Handle language choices
			if (langEntry.choose) {
				const count = langEntry.choose.count || 1;
				const from = langEntry.choose.from || [];

				console.debug('[BackgroundCard]', 'Language choice:', { count, from, langEntry });

				choiceCount += count;

				if (from.length > 0) {
					// Add specific language options from 'from' array
					for (const lang of from) {
						const norm = TextProcessor.normalizeForLookup(lang);
						if (!normalizedOptions.has(norm)) {
							normalizedOptions.set(norm, lang);
						}
					}
				} else {
					// No specific options means any language - load from service
					const { proficiencyService } = await import(
						'../../../services/ProficiencyService.js'
					);
					const allLanguages = await proficiencyService.getStandardLanguages();
					console.debug('[BackgroundCard]', 'Loaded standard languages:', allLanguages);
					for (const lang of allLanguages) {
						const norm = TextProcessor.normalizeForLookup(lang);
						if (!normalizedOptions.has(norm)) {
							normalizedOptions.set(norm, lang);
						}
					}
				}
			}
		}

		if (normalizedOptions.size > 0) {
			choiceOptions.splice(
				0,
				choiceOptions.length,
				...normalizedOptions.values(),
			);
		}

		console.debug('[BackgroundCard]', 'After processing, choiceCount:', choiceCount, 'choiceOptions:', choiceOptions);

		// Set up optional language choices if any exist
		if (choiceCount > 0) {
			character.optionalProficiencies.languages.background.allowed =
				choiceCount;
			character.optionalProficiencies.languages.background.options =
				choiceOptions;

			console.debug('[BackgroundCard]', 'Set language options:', {
				allowed: choiceCount,
				options: choiceOptions,
			});

			// Restore valid language selections if any, excluding now-fixed languages
			if (prevBackgroundLanguagesSelected.length > 0) {
				const optionNorms = new Set(
					choiceOptions.map((lang) => TextProcessor.normalizeForLookup(lang)),
				);
				const fixedNorms = new Set(
					fixedLanguages.map((lang) => TextProcessor.normalizeForLookup(lang)),
				);
				const existingLangs = new Set(
					character.proficiencies.languages.map((lang) =>
						TextProcessor.normalizeForLookup(lang),
					),
				);

				const validSelections = prevBackgroundLanguagesSelected.filter(
					(lang) => {
						const normalizedLang = TextProcessor.normalizeForLookup(lang);
						return (
							optionNorms.has(normalizedLang) &&
							!existingLangs.has(normalizedLang) &&
							!fixedNorms.has(normalizedLang)
						);
					},
				);

				character.optionalProficiencies.languages.background.selected =
					validSelections.slice(0, choiceCount);
			}

			// Update combined language options
			this._updateCombinedLanguageOptions(character);
		}
	}

	async _regenerateEmptyProficiencyOptions(character, background) {
		if (!character || !background) return;

		// Only regenerate language options if they're empty but allowed > 0
		const langAllowed = character.optionalProficiencies.languages.background?.allowed || 0;
		const langOptions = character.optionalProficiencies.languages.background?.options || [];

		if (langAllowed > 0 && langOptions.length === 0) {
			console.debug('[BackgroundCard]', 'Regenerating empty language options for saved character');

			const langProfs = background?.proficiencies?.languages || [];
			const normalizedOptions = new Map();

			for (const langEntry of langProfs) {
				if (langEntry.choose) {
					const from = langEntry.choose.from || [];

					if (from.length > 0) {
						// Add specific language options
						for (const lang of from) {
							const norm = TextProcessor.normalizeForLookup(lang);
							if (!normalizedOptions.has(norm)) {
								normalizedOptions.set(norm, lang);
							}
						}
					} else {
						// No specific options means any language - load from service
						const { proficiencyService } = await import(
							'../../../services/ProficiencyService.js'
						);
						const allLanguages = await proficiencyService.getStandardLanguages();
						console.debug('[BackgroundCard]', 'Loaded standard languages for empty options:', allLanguages.length);
						for (const lang of allLanguages) {
							const norm = TextProcessor.normalizeForLookup(lang);
							if (!normalizedOptions.has(norm)) {
								normalizedOptions.set(norm, lang);
							}
						}
					}
				}
			}

			if (normalizedOptions.size > 0) {
				character.optionalProficiencies.languages.background.options =
					Array.from(normalizedOptions.values());
				console.debug('[BackgroundCard]', 'Set language options:',
					character.optionalProficiencies.languages.background.options.length);
			}
		}

		// Same for skills if needed
		const skillAllowed = character.optionalProficiencies.skills.background?.allowed || 0;
		const skillOptions = character.optionalProficiencies.skills.background?.options || [];

		if (skillAllowed > 0 && skillOptions.length === 0) {
			console.debug('[BackgroundCard]', 'Regenerating empty skill options for saved character');

			const skillProfs = background?.proficiencies?.skills || [];
			for (const skillEntry of skillProfs) {
				if (skillEntry.choose) {
					const from = skillEntry.choose.from || [];
					character.optionalProficiencies.skills.background.options = from;
					console.debug('[BackgroundCard]', 'Set skill options:', from.length);
					break; // Only need first choose entry
				}
			}
		}

		// Tools are typically "choose 1" without specific options, so we don't populate them here
	}
}

//=============================================================================
// Background Details View - Proficiencies, equipment, features for info panel
//=============================================================================

class BackgroundDetailsView {
	async generateDetailsHTML(background) {
		if (!background) return '';

		let html = '';

		// Skills section - only show if background has skills
		const skillsHtml = this._formatSkillProficiencies(background);
		if (skillsHtml && skillsHtml !== 'None') {
			html += `
				<div class="detail-section mb-2">
					<h6 class="small mb-1"><strong>Skills</strong></h6>
					<div class="small text-muted">${skillsHtml}</div>
				</div>
			`;
		}

		// Tools section - only show if background has tools
		const toolsHtml = this._formatToolProficiencies(background);
		if (toolsHtml && toolsHtml !== 'None') {
			html += `
				<div class="detail-section mb-2">
					<h6 class="small mb-1"><strong>Tools</strong></h6>
					<div class="small text-muted">${toolsHtml}</div>
				</div>
			`;
		}

		// Languages section - only show if background has languages
		const languagesHtml = this._formatLanguages(background);
		if (languagesHtml && languagesHtml !== 'None') {
			html += `
				<div class="detail-section mb-2">
					<h6 class="small mb-1"><strong>Languages</strong></h6>
					<div class="small text-muted">${languagesHtml}</div>
				</div>
			`;
		}

		// Equipment section - only show if background has equipment
		const equipmentHtml = this._formatEquipment(background);
		if (equipmentHtml && equipmentHtml !== 'None') {
			html += `
				<div class="detail-section mb-2">
					<h6 class="small mb-1"><strong>Equipment</strong></h6>
					<div class="small text-muted">${equipmentHtml}</div>
				</div>
			`;
		}

		// Feature section - only show if background has a feature
		const feature = this._extractFeature(background);
		if (feature) {
			html += `
				<div class="detail-section mb-2">
					<h6 class="small mb-1"><strong>Feature</strong></h6>
					<div class="small text-muted"><strong>${feature.name}:</strong> ${feature.description}</div>
				</div>
			`;
		}

		return html;
	}

	_formatSkillProficiencies(background) {
		if (!background?.proficiencies?.skills) return 'None';

		// 5etools uses normalized structure: proficiencies.skills = [{skill: "...", optional: bool}]
		const skills = background.proficiencies.skills
			.map((prof) => {
				if (prof.choose) {
					return `Choose ${prof.choose.count || 1} from: ${prof.choose.from?.map(toTitleCase).join(', ') || 'any'}`;
				}
				return toTitleCase(prof.skill || prof);
			})
			.filter(Boolean);

		return skills.join(', ') || 'None';
	}

	_formatToolProficiencies(background) {
		if (!background?.proficiencies?.tools) return 'None';

		// 5etools uses normalized structure: proficiencies.tools = [{tool: "...", optional: bool}]
		const tools = background.proficiencies.tools
			.map((prof) => {
				if (prof.choose) {
					return `Choose ${prof.choose.count || 1} tool${prof.choose.count > 1 ? 's' : ''}`;
				}
				return toSentenceCase(prof.tool || prof);
			})
			.filter(Boolean);

		return tools.join(', ') || 'None';
	}

	_formatLanguages(background) {
		if (!background?.proficiencies?.languages) return 'None';

		// 5etools uses normalized structure: proficiencies.languages = [{language: "...", optional: bool}]
		const languages = background.proficiencies.languages
			.map((prof) => {
				if (prof.choose) {
					const count = prof.choose.count || 1;
					const suffix =
						prof.choose.type === 'anystandard'
							? ' (standard)'
							: prof.choose.type === 'any'
								? ' (any)'
								: '';
					return `Choose ${count} language${count > 1 ? 's' : ''}${suffix}`;
				}
				return prof.language || prof;
			})
			.filter(Boolean);

		return languages.join(', ') || 'None';
	}

	_formatEquipment(background) {
		if (!background?.equipment) return 'None';

		// 5etools normalizes equipment: equipment = [{item: "...", quantity: n}] or [{a: [...], b: [...]}]
		const equipment = [];

		for (const eq of background.equipment) {
			if (eq.a && eq.b) {
				// Choice between options
				equipment.push(
					`(a) ${this._formatEquipmentList(eq.a)} or (b) ${this._formatEquipmentList(eq.b)}`,
				);
			} else if (Array.isArray(eq)) {
				// Direct equipment list
				equipment.push(this._formatEquipmentList(eq));
			} else {
				// Single item
				equipment.push(this._formatSingleEquipment(eq));
			}
		}

		return equipment.join('; ') || 'None';
	}

	_formatEquipmentList(items) {
		return items.map((item) => this._formatSingleEquipment(item)).join(', ');
	}

	_formatSingleEquipment(item) {
		if (typeof item === 'string') {
			return item;
		}
		const qty = item.quantity ? `${item.quantity}x ` : '';
		const itemRef = item.item || '';
		const name =
			item.displayName ||
			(itemRef ? unpackUid(itemRef).name : '') ||
			item.name ||
			item.special ||
			'';
		return `${qty}${name}`.trim();
	}

	_extractFeature(background) {
		if (!background?.entries) return null;

		// 5etools typically marks features in entries array
		const featureEntry = background.entries.find(
			(entry) =>
				entry.name?.toLowerCase().includes('feature') || entry.data?.isFeature,
		);

		if (!featureEntry) return null;

		const description = Array.isArray(featureEntry.entries)
			? featureEntry.entries
				.map((e) => (typeof e === 'string' ? e : ''))
				.filter(Boolean)
				.join(' ')
			: featureEntry.entry || '';

		// Truncate description for compact display
		const truncated = description.substring(0, 150);

		return {
			name: featureEntry.name || 'Feature',
			description: truncated + (description.length > 150 ? '...' : ''),
		};
	}
}
