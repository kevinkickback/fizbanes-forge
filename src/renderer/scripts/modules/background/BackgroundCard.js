/** Controller for background selection UI (card + details + service wiring). */

import { AppState } from '../../core/AppState.js';
import { CharacterManager } from '../../core/CharacterManager.js';
import { eventBus, EVENTS } from '../../utils/EventBus.js';

import { backgroundService } from '../../services/BackgroundService.js';
import { sourceService } from '../../services/SourceService.js';
import { BaseCard } from '../BaseCard.js';
import { BackgroundDetailsView } from './BackgroundDetails.js';
import { BackgroundCardView } from './BackgroundView.js';

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

		// Set up optional skill proficiencies
		if (background.skillProficiencies) {
			for (const skillEntry of background.skillProficiencies) {
				if (skillEntry.choose) {
					const count = skillEntry.choose.count || 1;
					const from = skillEntry.choose.from || [];

					character.optionalProficiencies.skills.background.allowed = count;
					character.optionalProficiencies.skills.background.options = from;

					// Restore valid selections
					const validSelections = prevBackgroundSkillsSelected.filter(
						(skill) =>
							from.includes(skill) &&
							!character.proficiencies.skills.includes(skill) &&
							!fixedProfs.skills.includes(skill),
					);

					character.optionalProficiencies.skills.background.selected =
						validSelections.slice(0, count);
				}
			}
		}

		// Set up optional tool proficiencies
		if (background.toolProficiencies) {
			for (const toolEntry of background.toolProficiencies) {
				if (toolEntry.choose) {
					const count = toolEntry.choose.count || 1;
					character.optionalProficiencies.tools.background.allowed = count;
					character.optionalProficiencies.tools.background.options = [];
					character.optionalProficiencies.tools.background.selected = [];
				}
			}
		}

		// Handle languages from languageProficiencies array
		if (background.languageProficiencies) {
			const fixedLanguages = [];
			let choiceCount = 0;
			const choiceOptions = [];

			for (const langEntry of background.languageProficiencies) {
				// Add fixed languages (specific languages set to true)
				for (const [lang, value] of Object.entries(langEntry)) {
					if (value === true && lang !== 'choose' && lang !== 'anyStandard') {
						const langName = lang.charAt(0).toUpperCase() + lang.slice(1);
						character.addProficiency('languages', langName, 'Background');
						fixedLanguages.push(langName);
					}
				}

				// Accumulate optional standard language choices
				if (langEntry.anyStandard && langEntry.anyStandard > 0) {
					choiceCount += langEntry.anyStandard;
					// Use full language list for 'anyStandard'
					const allLanguages = this._getAllLanguages();
					for (const lang of allLanguages) {
						if (!choiceOptions.includes(lang)) {
							choiceOptions.push(lang);
						}
					}
				}

				// Accumulate optional language choices with specific options
				if (langEntry.choose) {
					const count = langEntry.choose.count || 1;
					const from = langEntry.choose.from || [];

					choiceCount += count;

					if (from.length > 0) {
						// Add specific language options, capitalizing first letter
						for (const lang of from) {
							const langName = lang.charAt(0).toUpperCase() + lang.slice(1);
							if (!choiceOptions.includes(langName)) {
								choiceOptions.push(langName);
							}
						}
					} else {
						// No specific options means any language
						const allLanguages = this._getAllLanguages();
						for (const lang of allLanguages) {
							if (!choiceOptions.includes(lang)) {
								choiceOptions.push(lang);
							}
						}
					}
				}
			}

			// Set up the optional language choices if any exist
			if (choiceCount > 0) {
				character.optionalProficiencies.languages.background.allowed =
					choiceCount;
				character.optionalProficiencies.languages.background.options =
					choiceOptions;

				// Restore valid language selections if any, excluding now-fixed languages
				if (prevBackgroundLanguagesSelected.length > 0) {
					const validSelections = prevBackgroundLanguagesSelected.filter(
						(lang) =>
							!character.proficiencies.languages.includes(lang) &&
							!fixedLanguages.includes(lang),
					);

					character.optionalProficiencies.languages.background.selected =
						validSelections.slice(0, choiceCount);
				}

				// Update combined language options
				this._updateCombinedLanguageOptions(character);
			}
		}

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
	 * Extract fixed proficiencies from raw JSON
	 * @param {Object} background - Background JSON object
	 * @returns {Object} Object with skills and tools arrays
	 * @private
	 */
	_getFixedProficiencies(background) {
		const skills = [];
		const tools = [];

		// Extract skill proficiencies
		if (background?.skillProficiencies) {
			for (const skillEntry of background.skillProficiencies) {
				for (const [skill, value] of Object.entries(skillEntry)) {
					if (value === true && skill !== 'choose') {
						skills.push(skill);
					}
				}
			}
		}

		// Extract tool proficiencies
		if (background?.toolProficiencies) {
			for (const toolEntry of background.toolProficiencies) {
				for (const [tool, value] of Object.entries(toolEntry)) {
					if (value === true && tool !== 'choose') {
						tools.push(tool);
					}
				}
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
		// Standard D&D 5e languages
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

		// Update total allowed count
		character.optionalProficiencies.skills.allowed =
			raceAllowed + classAllowed + backgroundAllowed;

		// Combine selected skills from all sources
		character.optionalProficiencies.skills.selected = [
			...new Set([...raceSelected, ...classSelected, ...backgroundSelected]),
		];

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

		// Update total allowed count
		character.optionalProficiencies.languages.allowed =
			raceAllowed + classAllowed + backgroundAllowed;

		// Combine selected languages from all sources
		character.optionalProficiencies.languages.selected = [
			...new Set([...raceSelected, ...classSelected, ...backgroundSelected]),
		];

		// For combined options, include options from all sources
		character.optionalProficiencies.languages.options = [
			...new Set([...raceOptions, ...classOptions, ...backgroundOptions]),
		];
	}
}
