/** Controller for background selection UI (card + details + service wiring). */

import { AppState } from '../../../app/AppState.js';
import { CharacterManager } from '../../../app/CharacterManager.js';
import DataNormalizer from '../../../lib/DataNormalizer.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';

import { toSentenceCase, toTitleCase } from '../../../lib/5eToolsParser.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { backgroundService } from '../../../services/BackgroundService.js';
import { sourceService } from '../../../services/SourceService.js';
import { BaseCard } from '../BaseCard.js';

/** Manages the background selection UI and related character updates. */
export class BackgroundCard extends BaseCard {
	/**
	 * Creates a new BackgroundCard instance
	 */
	constructor() {
		// Use null for parent constructor
		super(null);
		this._card = document.createElement('div');

		// Initialize view components
		const card = document.querySelector('.background-card') || document.body;
		this._cardView = new BackgroundCardView(card);
		this._detailsView = new BackgroundDetailsView(card);

		// Default placeholder text
		this.placeholderTitle = 'Select a Background';
		this.placeholderDesc =
			'Choose a background to see details about their traits, proficiencies, and other characteristics.';

		// Initialize the component
		this.initialize();
	}

	/**
	 * Initializes the background card UI components and event listeners
	 * @returns {Promise<void>}
	 */
	async initialize() {
		try {
			// Initialize required dependencies
			await backgroundService.initialize();

			// Populate background dropdown
			this._renderBackgroundSelection();

			// Set up event listeners
			this._attachSelectionListeners();

			// Load saved background selection from character data
			await this._loadSavedBackgroundSelection();
		} catch (error) {
			console.error(
				'BackgroundCard',
				'Failed to initialize background card:',
				error,
			);
		}
	}

	/**
	 * Populates the background selection dropdown with available backgrounds
	 * filtered by allowed sources
	 * @private
	 */
	_renderBackgroundSelection() {
		try {
			const backgrounds = backgroundService.getAllBackgrounds();
			if (!backgrounds || backgrounds.length === 0) {
				console.error(
					'BackgroundCard',
					'No backgrounds available to populate dropdown',
				);
				return;
			}

			// Filter backgrounds by allowed sources using SourceService
			const filteredBackgrounds = backgrounds.filter((bg) =>
				sourceService.isSourceAllowed(bg.source),
			);

			// Sort backgrounds by name
			filteredBackgrounds.sort((a, b) => a.name.localeCompare(b.name));

			// Populate view
			this._cardView.populateBackgroundSelect(filteredBackgrounds);

			// Reset to placeholder
			this._cardView.resetQuickDescription();
			this._detailsView.clearDetails();
		} catch (error) {
			console.error(
				'BackgroundCard',
				'Error populating background dropdown:',
				error,
			);
		}
	}

	/**
	 * Loads and sets the saved background selection from the character data
	 * @returns {Promise<void>}
	 * @private
	 */
	async _loadSavedBackgroundSelection() {
		try {
			const character = AppState.getCurrentCharacter();
			if (!character?.background?.name) {
				return; // No saved background to load
			}

			// Set the background selection
			const backgroundName = character.background.name;
			const backgroundSource = character.background.source;

			if (backgroundName && backgroundSource) {
				const background = backgroundService.selectBackground(
					backgroundName,
					backgroundSource,
				);
				if (background) {
					this._cardView.setSelectedBackground(
						`${backgroundName}_${backgroundSource}`,
					);
					// Don't emit CHARACTER_UPDATED during initialization (skip event emission)
					this._handleBackgroundChange(true);

					// Also set variant if one was selected
					if (character.background.variant) {
						await new Promise((resolve) => setTimeout(resolve, 100));
						this._cardView.setSelectedVariant(character.background.variant);
						// Don't emit CHARACTER_UPDATED during initialization
						this._handleVariantChange(true);
					}
				} else {
					console.warn(
						'BackgroundCard',
						`Saved background "${backgroundName}" (${backgroundSource}) not found. Character might use a source that's not currently allowed.`,
					);
				}
			}
		} catch (error) {
			console.error(
				'BackgroundCard',
				'Error loading saved background selection:',
				error,
			);
		}
	}

	/**
	 * Attaches event listeners to the background and variant selectors
	 * @private
	 */
	_attachSelectionListeners() {
		this._cardView.attachListeners(
			() => this._handleBackgroundChange(),
			() => this._handleVariantChange(),
		);

		// Listen for source changes and repopulate background dropdown
		eventBus.on('sources:allowed-changed', () => {
			this._renderBackgroundSelection();
			// Reload saved selection if one was made
			this._loadSavedBackgroundSelection();
		});
	}

	/**
	 * Handles background selection change events
	 * @private
	 */
	_handleBackgroundChange(skipEventDuringInit = false) {
		try {
			const backgroundId = this._cardView.getSelectedBackground();

			if (!backgroundId) {
				this._cardView.hideVariantSelector();
				this._cardView.resetQuickDescription();
				this._detailsView.clearDetails();
				this._updateCharacterBackground(null, null);
				return;
			}

			// Extract name and source from ID (format: name_source)
			const [name, source] = backgroundId.split('_');
			const background = backgroundService.selectBackground(name, source);

			if (background) {
				// Update variant options
				this._updateVariantOptions(background);

				// Render the background details
				this._renderEntityDetails(background);

				// Update character model
				this._updateCharacterBackground(background, null);

				// Emit event to notify about character update (unsaved changes)
				// Skip during initialization to prevent showing unsaved indicator on page load
				if (!skipEventDuringInit) {
					eventBus.emit(EVENTS.CHARACTER_UPDATED, {
						character: CharacterManager.getCurrentCharacter(),
					});
				}
			} else {
				this._cardView.hideVariantSelector();
				this._cardView.resetQuickDescription();
				this._detailsView.clearDetails();
				this._updateCharacterBackground(null, null);
			}
		} catch (error) {
			console.error(
				'BackgroundCard',
				'Error handling background change:',
				error,
			);
		}
	}

	/**
	 * Handles variant selection change events
	 * @private
	 */
	_handleVariantChange(skipEventDuringInit = false) {
		try {
			const variantName = this._cardView.getSelectedVariant();
			const background = backgroundService.getSelectedBackground();

			if (!background) {
				return;
			}

			if (!variantName) {
				// Show standard background
				this._renderEntityDetails(background);
				this._updateCharacterBackground(background, null);

				// Emit event to notify about character update (unsaved changes)
				// Skip during initialization to prevent showing unsaved indicator on page load
				if (!skipEventDuringInit) {
					eventBus.emit(EVENTS.CHARACTER_UPDATED, {
						character: CharacterManager.getCurrentCharacter(),
					});
				}
				return;
			}

			// Select and render the variant
			const variant = backgroundService.selectVariant(variantName);
			if (variant) {
				this._renderEntityDetails(variant);
				this._updateCharacterBackground(background, variant);

				// Emit event to notify about character update (unsaved changes)
				// Skip during initialization to prevent showing unsaved indicator on page load
				if (!skipEventDuringInit) {
					eventBus.emit(EVENTS.CHARACTER_UPDATED, {
						character: CharacterManager.getCurrentCharacter(),
					});
				}
			}
		} catch (error) {
			console.error('BackgroundCard', 'Error handling variant change:', error);
		}
	}

	/**
	 * Updates the variant selection dropdown based on available variants
	 * @param {Object} background - The selected background
	 * @private
	 */
	_updateVariantOptions(background) {
		try {
			if (background.variants?.length > 0) {
				// Filter variants by allowed sources using SourceService
				const filteredVariants = background.variants.filter((variant) => {
					const variantSource = variant.source || background.source;
					return sourceService.isSourceAllowed(variantSource);
				});

				if (filteredVariants.length > 0) {
					// Sort variants by name
					filteredVariants.sort((a, b) => a.name.localeCompare(b.name));

					this._cardView.populateVariantSelect(filteredVariants);
					this._cardView.showVariantSelector();
					return;
				}
			}

			this._cardView.hideVariantSelector();
		} catch (error) {
			console.error('BackgroundCard', 'Error updating variant options:', error);
			this._cardView.hideVariantSelector();
		}
	}

	/**
	 * Renders the details of a specific background
	 * @param {Object} background - The background to render
	 * @private
	 */
	async _renderEntityDetails(background) {
		if (!background) {
			this._cardView.resetQuickDescription();
			this._detailsView.clearDetails();
			return;
		}

		try {
			// Update image
			this._cardView.updateBackgroundImage(
				background.imageUrl || null,
				background.name,
			);

			// Update quick description
			await this._cardView.updateQuickDescription(background);

			// Update background details
			await this._detailsView.updateAllDetails(background);
		} catch (error) {
			console.error(
				'BackgroundCard',
				'Error rendering background details:',
				error,
			);
		}
	}

	/**
	 * Update character's background information
	 * @param {Object} background - Selected background
	 * @param {Object} variant - Selected variant
	 * @private
	 */
	_updateCharacterBackground(background, variant) {
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
				this._updateBackgroundProficiencies(background, variant);

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

			// Trigger an event to update the UI
			document.dispatchEvent(new CustomEvent('characterChanged'));
		}
	}

	/**
	 * Update character proficiencies based on selected background
	 * @param {Object} background - The selected background
	 * @param {Object} _variant - Selected variant
	 * @private
	 */
	_updateBackgroundProficiencies(background, _variant) {
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
					DataNormalizer.normalizeForLookup(skill),
				);
				const validSelections = prevBackgroundSkillsSelected.filter(
					(skill) =>
						normalizedFrom.includes(
							DataNormalizer.normalizeForLookup(skill),
						) &&
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
		this._updateBackgroundLanguageProficiencies(
			character,
			background,
			prevBackgroundLanguagesSelected,
		);

		// Update combined skill options
		this._updateCombinedSkillOptions(character);

		// Notify UI to update proficiencies
		document.dispatchEvent(
			new CustomEvent('proficiencyChanged', {
				detail: { triggerCleanup: true },
			}),
		);
	}

	/**
	 * Extract fixed proficiencies from background (5etools normalized format)
	 * @param {Object} background - Background object with proficiencies.{skills, tools, languages}
	 * @returns {Object} Object with skills and tools arrays
	 * @private
	 */
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

	/**
	 * Get all available languages
	 * @returns {Array<string>} Array of language names
	 * @private
	 */
	_getAllLanguages() {
		// Standard D&D 5e languages with proper casing from 5etools
		return [
			'Common',
			'Dwarvish',
			'Elvish',
			'Giant',
			'Gnomish',
			'Goblin',
			'Halfling',
			'Orc',
			'Abyssal',
			'Celestial',
			'Draconic',
			'Deep Speech',
			'Infernal',
			'Primordial',
			'Sylvan',
			'Undercommon',
		];
	}

	/**
	 * Updates the combined skill options from race, class and background
	 * @param {Character} character - The character object
	 * @private
	 */
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

	/**
	 * Updates the combined language options from race, class and background
	 * @param {Character} character - The character object
	 * @private
	 */
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

	/**
	 * Update background language proficiencies using 5etools normalized structure
	 * @param {Character} character - The character object
	 * @param {Object} background - Background object with proficiencies.languages
	 * @param {Array<string>} prevBackgroundLanguagesSelected - Previously selected languages
	 * @private
	 */
	_updateBackgroundLanguageProficiencies(
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

				choiceCount += count;

				if (from.length > 0) {
					// Add specific language options from 'from' array
					for (const lang of from) {
						const norm = DataNormalizer.normalizeForLookup(lang);
						if (!normalizedOptions.has(norm)) {
							normalizedOptions.set(norm, lang);
						}
					}
				} else {
					// No specific options means any language
					const allLanguages = this._getAllLanguages();
					for (const lang of allLanguages) {
						const norm = DataNormalizer.normalizeForLookup(lang);
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

		// Set up optional language choices if any exist
		if (choiceCount > 0) {
			character.optionalProficiencies.languages.background.allowed =
				choiceCount;
			character.optionalProficiencies.languages.background.options =
				choiceOptions;

			// Restore valid language selections if any, excluding now-fixed languages
			if (prevBackgroundLanguagesSelected.length > 0) {
				const optionNorms = new Set(
					choiceOptions.map((lang) => DataNormalizer.normalizeForLookup(lang)),
				);
				const fixedNorms = new Set(
					fixedLanguages.map((lang) => DataNormalizer.normalizeForLookup(lang)),
				);
				const existingLangs = new Set(
					character.proficiencies.languages.map((lang) =>
						DataNormalizer.normalizeForLookup(lang),
					),
				);

				const validSelections = prevBackgroundLanguagesSelected.filter(
					(lang) => {
						const normalizedLang = DataNormalizer.normalizeForLookup(lang);
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
}

//=============================================================================
// Background Card View - Selection dropdowns and quick description
//=============================================================================

/** @internal - Manages background selection view (dropdowns + quick description). */
class BackgroundCardView {
	/**
	 * @param {HTMLElement} card - Root card element
	 */
	constructor(card) {
		this._card = card;
		this._backgroundSelect = document.getElementById('backgroundSelect');
		this._variantContainer = document.getElementById('variantContainer');
		this._variantSelect = document.getElementById('variantSelect');
		this._quickDescription = document.getElementById('backgroundQuickDesc');
		this._imageElement = document.getElementById('backgroundImage');

		// Create variant container if it doesn't exist
		if (!this._variantContainer) {
			this._createVariantContainer();
		}
	}

	/**
	 * Creates the variant selection container if it doesn't exist
	 * @private
	 */
	_createVariantContainer() {
		const selectors = document.querySelector('.background-selectors');
		if (!selectors) {
			console.warn(
				'BackgroundView',
				'Background selectors container not found',
			);
			return;
		}

		this._variantContainer = document.createElement('div');
		this._variantContainer.id = 'variantContainer';
		this._variantContainer.className = 'background-select-container';
		this._variantContainer.style.display = 'none';
		this._variantContainer.innerHTML = `
			<label for="variantSelect">Variant</label>
			<select class="form-select" id="variantSelect">
				<option value="">Standard background</option>
			</select>
		`;
		selectors.appendChild(this._variantContainer);

		// Update the reference to the variant select element
		this._variantSelect = document.getElementById('variantSelect');
	}

	/**
	 * Populate background selection dropdown
	 * @param {Array} backgrounds - Array of background objects from backgroundService
	 */
	populateBackgroundSelect(backgrounds) {
		if (!this._backgroundSelect) return;

		// Clear existing options except the first (default)
		while (this._backgroundSelect.options.length > 1) {
			this._backgroundSelect.remove(1);
		}

		// Add background options
		backgrounds.forEach((background) => {
			const option = document.createElement('option');
			option.value = `${background.name}_${background.source}`;
			option.textContent = `${background.name} (${background.source})`;
			this._backgroundSelect.appendChild(option);
		});
	}

	/**
	 * Populate variant selection dropdown
	 * @param {Array} variants - Array of variant background objects
	 */
	populateVariantSelect(variants) {
		if (!this._variantSelect) return;

		// Clear existing options except the first (default)
		while (this._variantSelect.options.length > 1) {
			this._variantSelect.remove(1);
		}

		// Add variant options
		variants.forEach((variant) => {
			const option = document.createElement('option');
			option.value = variant.name;
			option.textContent = `${variant.name} (${variant.source})`;
			this._variantSelect.appendChild(option);
		});
	}

	/**
	 * Update quick description display
	 * @param {Object} background - Background object
	 */
	async updateQuickDescription(background) {
		if (!this._quickDescription || !background) return;

		const description = this._extractDescription(background);
		this._quickDescription.innerHTML = description;
		await textProcessor.processElement(this._quickDescription);
	}

	/**
	 * Reset quick description to default state
	 */
	resetQuickDescription() {
		if (!this._quickDescription) return;
		this._quickDescription.innerHTML = `
			<div class="placeholder-content">
				<h5>Select a Background</h5>
				<p>Choose a background to see details about their traits, proficiencies, and other characteristics.</p>
			</div>
		`;
	}

	/**
	 * Update background image
	 * @param {string} imageSrc - Image source URL
	 * @param {string} altText - Alternative text for the image
	 */
	updateBackgroundImage(imageSrc, altText = 'Background image') {
		if (!this._imageElement) return;

		try {
			// Clear existing content
			this._imageElement.innerHTML = '';

			// Create and append the image element
			if (imageSrc) {
				const img = document.createElement('img');
				img.src = imageSrc;
				img.alt = altText;
				img.classList.add('entity-img');
				this._imageElement.appendChild(img);
			} else {
				// Set a default icon
				this._imageElement.innerHTML =
					'<i class="fas fa-user-circle placeholder-icon"></i>';
			}
		} catch (error) {
			console.error(
				'BackgroundView',
				'Error updating background image:',
				error,
			);
			// Set a default icon on error
			this._imageElement.innerHTML =
				'<i class="fas fa-user-circle placeholder-icon"></i>';
		}
	}

	/**
	 * Show variant selector
	 */
	showVariantSelector() {
		if (this._variantContainer) {
			this._variantContainer.style.display = 'block';
		}
	}

	/**
	 * Hide variant selector and reset selection
	 */
	hideVariantSelector() {
		if (this._variantContainer) {
			this._variantContainer.style.display = 'none';
		}
		if (this._variantSelect) {
			this._variantSelect.selectedIndex = 0;
		}
	}

	/**
	 * Get current background selection
	 * @returns {string} Selected background name
	 */
	getSelectedBackground() {
		return this._backgroundSelect?.value || '';
	}

	/**
	 * Get current variant selection
	 * @returns {string} Selected variant name
	 */
	getSelectedVariant() {
		return this._variantSelect?.value || '';
	}

	/**
	 * Set background selection
	 * @param {string} backgroundName - Background name to select
	 */
	setSelectedBackground(backgroundName) {
		if (!this._backgroundSelect) return;

		// Find and select the option
		for (let i = 0; i < this._backgroundSelect.options.length; i++) {
			if (this._backgroundSelect.options[i].value === backgroundName) {
				this._backgroundSelect.selectedIndex = i;
				break;
			}
		}
	}

	/**
	 * Set variant selection
	 * @param {string} variantName - Variant name to select
	 */
	setSelectedVariant(variantName) {
		if (!this._variantSelect) return;

		// Find and select the option
		for (let i = 0; i < this._variantSelect.options.length; i++) {
			if (this._variantSelect.options[i].value === variantName) {
				this._variantSelect.selectedIndex = i;
				break;
			}
		}
	}

	/**
	 * Attach event listeners
	 * @param {Function} onBackgroundChange - Handler for background selection change
	 * @param {Function} onVariantChange - Handler for variant selection change
	 */
	attachListeners(onBackgroundChange, onVariantChange) {
		if (this._backgroundSelect) {
			this._backgroundSelect.addEventListener('change', onBackgroundChange);
		}
		if (this._variantSelect) {
			this._variantSelect.addEventListener('change', onVariantChange);
		}
	}

	/**
	 * Extract description from background data
	 * @param {Object} background - Background object
	 * @returns {string} HTML description
	 * @private
	 */
	_extractDescription(background) {
		if (background?.entries) {
			for (const entry of background.entries) {
				if (typeof entry === 'string') {
					return `<p>${entry}</p>`;
				}
				if (entry.type === 'entries' && entry.entries) {
					for (const subEntry of entry.entries) {
						if (typeof subEntry === 'string') {
							return `<p>${subEntry}</p>`;
						}
					}
				}
			}
		}
		return `<p>${background.name} is a character background from ${background.source}.</p>`;
	}
}

//=============================================================================
// Background Details View - Proficiencies, equipment, features
//=============================================================================

/** @internal - Handles background details rendering (proficiencies, equipment, features). */
class BackgroundDetailsView {
	/**
	 * @param {HTMLElement} card - Root card element
	 */
	constructor(card) {
		this._card = card;
		this._detailsContainer = document.getElementById('backgroundDetails');
	}

	/**
	 * Update all background details
	 * @param {Object} background - Background object from backgroundService
	 */
	async updateAllDetails(background) {
		if (!this._detailsContainer || !background) {
			this.clearDetails();
			return;
		}

		const html = `
			<div class="background-details-grid">
				${this._renderSkillProficiencies(background)}
				${this._renderToolProficiencies(background)}
				${this._renderLanguages(background)}
				${this._renderEquipment(background)}
			</div>
			${this._renderFeature(background)}
		`;

		this._detailsContainer.innerHTML = html;
		await textProcessor.processElement(this._detailsContainer);
	}

	/**
	 * Clear all details - do nothing, leave HTML placeholder intact
	 */
	clearDetails() {
		// Do nothing - the HTML already has the placeholder structure
		// We don't want to clear it
	}

	/**
	 * Render skill proficiencies section
	 * @param {Object} background - Background object
	 * @returns {string} HTML for skill proficiencies
	 * @private
	 */
	_renderSkillProficiencies(background) {
		const skillsHtml = this._formatSkillProficiencies(background);
		return `
			<div class="detail-section">
				<h6>Skill Proficiencies</h6>
				<ul class="mb-0">
					<li class="text-content">${skillsHtml}</li>
				</ul>
			</div>
		`;
	}

	/**
	 * Render tool proficiencies section
	 * @param {Object} background - Background object
	 * @returns {string} HTML for tool proficiencies
	 * @private
	 */
	_renderToolProficiencies(background) {
		const toolsHtml = this._formatToolProficiencies(background);
		return `
			<div class="detail-section">
				<h6>Tool Proficiencies</h6>
				<ul class="mb-0">
					<li class="text-content">${toolsHtml}</li>
				</ul>
			</div>
		`;
	}

	/**
	 * Render languages section
	 * @param {Object} background - Background object
	 * @returns {string} HTML for languages
	 * @private
	 */
	_renderLanguages(background) {
		const languagesHtml = this._formatLanguages(background);
		return `
			<div class="detail-section">
				<h6>Languages</h6>
				<ul class="mb-0">
					<li class="text-content">${languagesHtml}</li>
				</ul>
			</div>
		`;
	}

	/**
	 * Render equipment section
	 * @param {Object} background - Background object
	 * @returns {string} HTML for equipment
	 * @private
	 */
	_renderEquipment(background) {
		const equipmentHtml = this._formatEquipment(background);
		return `
			<div class="detail-section">
				<h6>Equipment</h6>
				<ul class="mb-0">
					${equipmentHtml}
				</ul>
			</div>
		`;
	}

	/**
	 * Render feature section
	 * @param {Object} background - Background object
	 * @returns {string} HTML for feature
	 * @private
	 */
	_renderFeature(background) {
		const feature = this._extractFeature(background);
		if (!feature) return '';

		return `
			<div class="traits-section detail-section">
				<h6>Feature</h6>
				<div class="feature-content">
					<ul class="mb-0">
						<li class="text-content"><strong>${feature.name}:</strong> ${feature.description}</li>
					</ul>
				</div>
			</div>
		`;
	}

	/**
	 * Format skill proficiencies from background data
	 * Uses 5etools normalized structure
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted skill proficiencies HTML
	 * @private
	 */
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

	/**
	 * Format tool proficiencies from background data
	 * Uses 5etools normalized structure
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted tool proficiencies HTML
	 * @private
	 */
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

	/**
	 * Format languages from background data
	 * Uses 5etools normalized structure
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted languages HTML
	 * @private
	 */
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

	/**
	 * Format equipment from background data
	 * Uses 5etools normalized structure
	 * @param {Object} background - Background JSON object
	 * @returns {string} Formatted equipment HTML
	 * @private
	 */
	_formatEquipment(background) {
		if (!background?.equipment) return '<li>None</li>';

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

		return equipment.map((e) => `<li>${e}</li>`).join('') || '<li>None</li>';
	}

	/**
	 * Format a list of equipment items
	 * @param {Array} items - Equipment items array
	 * @returns {string} Formatted items
	 * @private
	 */
	_formatEquipmentList(items) {
		return items.map((item) => this._formatSingleEquipment(item)).join(', ');
	}

	/**
	 * Format a single equipment item
	 * @param {string|Object} item - Equipment item
	 * @returns {string} Formatted item
	 * @private
	 */
	_formatSingleEquipment(item) {
		if (typeof item === 'string') {
			return item;
		}
		const qty = item.quantity ? `${item.quantity}x ` : '';
		const itemRef = item.item || '';
		const name =
			item.displayName ||
			(itemRef ? window.api.unpackUid(itemRef).name : '') ||
			item.name ||
			item.special ||
			'';
		return `${qty}${name}`.trim();
	}

	/**
	 * Extract background feature from raw JSON
	 * Uses 5etools normalized structure where feature is in entries
	 * @param {Object} background - Background JSON object
	 * @returns {Object|null} Feature object with name and description
	 * @private
	 */
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

		return {
			name: featureEntry.name || 'Feature',
			description: description.trim(),
		};
	}
}
