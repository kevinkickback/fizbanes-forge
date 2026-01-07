/** Controller for class selection UI, coordinating views and subclass logic. */

import { AppState } from '../../core/AppState.js';
import { CharacterManager } from '../../core/CharacterManager.js';
import { eventBus, EVENTS } from '../../utils/EventBus.js';

import { classService } from '../../services/ClassService.js';
import { sourceService } from '../../services/SourceService.js';
import { attAbvToFull } from '../../utils/5eToolsParser.js';
import { ARTISAN_TOOLS } from '../../utils/ProficiencyConstants.js';
import { ClassDetailsView } from './ClassDetails.js';
import { ClassCardView, SubclassPickerView } from './ClassViews.js';

/** Controller for class selection and display. */
export class ClassCard {
	/**
	 * Creates a new ClassCard instance
	 * @param {HTMLElement} _container - The container element for the class card UI
	 */
	constructor(_container) {
		/**
		 * Reference to the class service
		 * @type {ClassService}
		 * @private
		 */
		this._classService = classService;

		/**
		 * View for class selection and quick description
		 * @type {ClassCardView}
		 * @private
		 */
		this._cardView = new ClassCardView();

		/**
		 * View for subclass selection
		 * @type {SubclassPickerView}
		 * @private
		 */
		this._subclassView = new SubclassPickerView();

		/**
		 * View for class details display
		 * @type {ClassDetailsView}
		 * @private
		 */
		this._detailsView = new ClassDetailsView();

		// Initialize the component
		this.initialize();
	}

	//-------------------------------------------------------------------------
	// Initialization Methods
	//-------------------------------------------------------------------------

	/**
	 * Initializes the class card UI components and event listeners
	 * @returns {Promise<void>}
	 */
	async initialize() {
		try {
			// Initialize required dependencies
			await this._classService.initialize();

			// Set up event listeners
			this._setupEventListeners();

			// Load saved class selection from character data
			await this._loadSavedClassSelection();
		} catch (error) {
			console.error('ClassCard', 'Failed to initialize class card:', error);
		}
	}

	/**
	 * Sets up event listeners for class and subclass selection changes
	 * @private
	 */
	_setupEventListeners() {
		// Listen to view events via EventBus instead of callbacks
		eventBus.on(EVENTS.CLASS_SELECTED, (classData) => {
			this._handleClassChange({ target: { value: classData.value } });
		});
		eventBus.on(EVENTS.SUBCLASS_SELECTED, (subclassData) => {
			this._handleSubclassChange({ target: { value: subclassData.value } });
		});

		// Listen for character selection changes (when new character is loaded)
		eventBus.on(EVENTS.CHARACTER_SELECTED, () => {
			this._handleCharacterChanged();
		});

		// Listen for source changes and repopulate class/subclass dropdowns
		eventBus.on('sources:allowed-changed', () => {
			this._loadSavedClassSelection();
		});
	}

	//-------------------------------------------------------------------------
	// Data Loading Methods
	//-------------------------------------------------------------------------

	/**
	 * Loads and sets the saved class selection from the character data
	 * @returns {Promise<void>}
	 * @private
	 */
	async _loadSavedClassSelection() {
		try {
			// Populate class dropdown first
			await this._populateClassSelect();

			const character = AppState.getCurrentCharacter();
			if (!character?.class?.name || !character?.class?.source) {
				return; // No saved class to load
			}

			// Set the class selection if it exists in available options
			const classValue = `${character.class.name}_${character.class.source}`;

			if (this._cardView.hasClassOption(classValue)) {
				this._cardView.setSelectedClassValue(classValue);
				// Update UI from character data (skip unsaved event)
				await this._handleClassChange({ target: { value: classValue } }, true);

				// Also set subclass if one was selected
				if (character.class.subclass) {
					// Wait for subclass options to populate
					await new Promise((resolve) => setTimeout(resolve, 100));

					if (this._subclassView.hasSubclassOption(character.class.subclass)) {
						this._subclassView.setSelectedSubclassValue(
							character.class.subclass,
						);
						// Optionally, update UI for subclass as well
						// await this._handleSubclassChange({ target: { value: character.class.subclass } }, true);
					}
				}
			} else {
				console.warn(
					'ClassCard',
					`Saved class "${classValue}" not found in available options. Character might use a source that's not currently allowed.`,
				);
			}
		} catch (error) {
			console.error('ClassCard', 'Error loading saved class selection:', error);
		}
	}

	/**
	 * Populates the class selection dropdown with all available classes
	 * filtered by allowed sources
	 * @returns {Promise<void>}
	 * @private
	 */
	async _populateClassSelect() {
		try {
			const classes = this._classService.getAllClasses();
			if (!classes || classes.length === 0) {
				console.error('ClassCard', 'No classes available to populate dropdown');
				return;
			}

			// Filter classes by allowed sources (supports PHB variants)
			const filteredClasses = classes.filter((cls) =>
				sourceService.isSourceAllowed(cls.source),
			);

			if (filteredClasses.length === 0) {
				console.error(
					'ClassCard',
					'No classes available after source filtering',
				);
				return;
			}

			// Populate view
			this._cardView.populateClassSelect(filteredClasses);
		} catch (error) {
			console.error('ClassCard', 'Error populating class dropdown:', error);
		}
	}

	/**
	 * Populates the subclass selection dropdown based on the currently selected class
	 */
	async _populateSubclassSelect(classData) {
		if (!classData) {
			this._subclassView.reset();
			return;
		}

		try {
			// Get subclasses from the service
			const subclasses = this._classService.getSubclasses(
				classData.name,
				classData.source,
			);

			if (!subclasses || subclasses.length === 0) {
				this._subclassView.reset();
				return;
			}

			// Filter subclasses by allowed sources
			const filteredSubclasses = subclasses.filter((sc) => {
				// Prefer explicit subclass source, then generic source, and only then classSource
				const subclassSource = sc.subclassSource || sc.source || sc.classSource;
				return sourceService.isSourceAllowed(subclassSource);
			});

			// Populate view
			this._subclassView.populateSubclassSelect(filteredSubclasses);
		} catch (error) {
			console.error(
				'ClassCard',
				'Error loading subclasses for dropdown:',
				error,
			);
		}
	}

	//-------------------------------------------------------------------------
	// Event Handlers
	//-------------------------------------------------------------------------

	/**
	 * Handles class selection change events
	 * @param {Event} event - The change event
	 * @returns {Promise<void>}
	 * @private
	 */
	async _handleClassChange(event) {
		try {
			const [className, source] = event.target.value.split('_');

			if (!className || !source) {
				this.resetClassDetails();
				await this._populateSubclassSelect(null);
				return;
			}
			const classData = this._classService.getClass(className, source);
			if (!classData) {
				console.error('ClassCard', `Class not found: ${className} (${source})`);
				return;
			}

			// Get fluff data for quick description
			const fluffData = this._classService.getClassFluff(
				classData.name,
				classData.source,
			);

			// Update the UI with the selected class data
			await this._cardView.updateQuickDescription(classData, fluffData);
			await this.updateClassDetails(classData);
			await this._populateSubclassSelect(classData);

			// Update character data
			this._updateCharacterClass(classData);

			// Emit event to notify about character update (unsaved changes)
			eventBus.emit(EVENTS.CHARACTER_UPDATED, {
				character: CharacterManager.getCurrentCharacter(),
			});
		} catch (error) {
			console.error('ClassCard', 'Error handling class change:', error);
		}
	}

	/**
	 * Handles subclass selection change events
	 * @param {Event} event - The change event
	 * @returns {Promise<void>}
	 * @private
	 */
	async _handleSubclassChange(event) {
		try {
			const subclassName = event.target.value;
			const classValue = this._cardView.getSelectedClassValue();
			const [className, source] = classValue.split('_');

			if (!className || !source) {
				return;
			}

			const classData = this._classService.getClass(className, source);
			if (!classData) {
				console.error('ClassCard', `Class not found: ${className} (${source})`);
				return;
			}

			let subclassData = null;
			if (subclassName) {
				const subclasses = this._classService.getSubclasses(className, source);
				subclassData = subclasses.find((sc) => sc.name === subclassName);
			}

			// Update the UI with the subclass data
			await this.updateClassDetails(classData, subclassData);

			// Update character data
			this._updateCharacterClass(classData, subclassName);

			// Emit event to notify about character update (unsaved changes)
			eventBus.emit(EVENTS.CHARACTER_UPDATED, {
				character: CharacterManager.getCurrentCharacter(),
			});
		} catch (error) {
			console.error('ClassCard', 'Error handling subclass change:', error);
		}
	}

	/**
	 * Handles character changed events
	 * @param {Event} event - The character changed event
	 * @returns {Promise<void>}
	 * @private
	 */
	async _handleCharacterChanged() {
		try {
			// Reload class selection to match character's class
			await this._loadSavedClassSelection();
		} catch (error) {
			console.error(
				'ClassCard',
				'Error handling character changed event:',
				error,
			);
		}
	}

	//-------------------------------------------------------------------------
	// UI Update Methods
	//-------------------------------------------------------------------------

	/**
	 * Updates the display of class details for the selected class and subclass
	 * @param {Object} classData - The class data to display
	 * @param {Object} subclassData - The optional subclass data
	 * @returns {Promise<void>}
	 */
	async updateClassDetails(classData, subclassData = null) {
		if (!classData) {
			this.resetClassDetails();
			return;
		}

		// Update class details (proficiencies, etc.)
		await this._detailsView.updateAllDetails(classData);

		// Update features separately
		await this._updateFeatures(classData, subclassData);
	}

	/**
	 * Update the features section based on class and level
	 * @param {Object} classData - Selected class
	 * @param {Object} subclassData - Selected subclass (optional)
	 * @returns {Promise<void>}
	 * @private
	 */
	async _updateFeatures(classData, subclassData = null) {
		const character = CharacterManager.getCurrentCharacter();
		const level = character?.level || 1;

		// Get all class features up to the current level (cumulative)
		const classFeatures =
			this._classService.getClassFeatures(
				classData.name,
				level,
				classData.source,
			) || [];

		// Get all subclass features up to the current level if a subclass is selected
		let subclassFeatures = [];
		if (subclassData) {
			subclassFeatures =
				this._classService.getSubclassFeatures(
					classData.name,
					subclassData.shortName || subclassData.name,
					level,
					subclassData.source || subclassData.classSource,
				) || [];
		}

		// Combine and pass to view
		const allFeatures = [...classFeatures, ...subclassFeatures];
		await this._detailsView.updateFeatures(classData, allFeatures);
	}

	/**
	 * Reset class details to placeholder state
	 */
	resetClassDetails() {
		this._cardView.resetQuickDescription();
		this._detailsView.resetAllDetails();
	}

	//-------------------------------------------------------------------------
	// Character Data Management
	//-------------------------------------------------------------------------

	/**
	 * Update character's class information
	 * @param {Object} classData - Selected class
	 * @param {string} subclassName - Selected subclass name
	 * @private
	 */
	_updateCharacterClass(classData, subclassName = '') {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		// Check if class has changed
		const hasChanged = !classData
			? character.class?.name || character.class?.source
			: character.class?.name !== classData.name ||
			character.class?.source !== classData.source ||
			character.subclass !== subclassName;

		if (hasChanged) {
			// Clear previous class proficiencies, ability bonuses, and traits
			character.removeProficienciesBySource('Class');
			character.clearTraits('Class');

			// Remove subclass proficiencies and traits
			character.removeProficienciesBySource('Subclass');
			character.clearTraits('Subclass');

			// Notify UI to clear optional proficiencies from class
			document.dispatchEvent(
				new CustomEvent('proficienciesRemoved', {
					detail: { source: 'Class' },
				}),
			);

			if (!classData) {
				// Clear class
				character.class = {
					level: 1,
					subclass: '',
				};
			} else {
				// Set class
				character.class = {
					name: classData.name,
					source: classData.source,
					level: 1,
					subclass: subclassName || character.class.subclass || '',
				};

				// Add proficiencies
				this._updateProficiencies(classData);

				// Force a refresh after a short delay to ensure everything is updated
				setTimeout(() => {
					document.dispatchEvent(
						new CustomEvent('proficiencyChanged', {
							detail: { triggerCleanup: true, forcedRefresh: true },
						}),
					);
				}, 100);
			}

			// Trigger an event to update the UI
			document.dispatchEvent(
				new CustomEvent('classChanged', {
					detail: { classData, subclass: subclassName },
				}),
			);
			document.dispatchEvent(new CustomEvent('characterChanged'));
		}
	}

	/**
	 * Update proficiencies based on class data
	 * @param {Object} classData - The class data
	 * @private
	 */
	_updateProficiencies(classData) {
		console.log('[ClassCard] _updateProficiencies() called');

		const character = CharacterManager.getCurrentCharacter();
		if (!character || !classData) return;

		console.log('[ClassCard] tools.class BEFORE reset:',
			JSON.stringify(character.optionalProficiencies?.tools?.class || {}));

		// Store previous selected proficiencies to restore valid ones later
		const previousClassSkills =
			character.optionalProficiencies.skills.class?.selected || [];

		// Clear class-specific proficiencies by source
		character.removeProficienciesBySource('Class');

		// Reset class skill options
		character.optionalProficiencies.skills.class.allowed = 0;
		character.optionalProficiencies.skills.class.options = [];
		character.optionalProficiencies.skills.class.selected = [];

		character.optionalProficiencies.languages.class.allowed = 0;
		character.optionalProficiencies.languages.class.options = [];
		character.optionalProficiencies.languages.class.selected = [];

		character.optionalProficiencies.tools.class.allowed = 0;
		character.optionalProficiencies.tools.class.options = [];
		character.optionalProficiencies.tools.class.selected = [];

		console.log('[ClassCard] tools.class AFTER reset:',
			JSON.stringify(character.optionalProficiencies?.tools?.class || {}));

		// Add saving throw proficiencies
		const savingThrows = this._getSavingThrows(classData);
		if (savingThrows && savingThrows.length > 0) {
			for (const save of savingThrows) {
				character.addProficiency('savingThrows', save, 'Class');
			}
		}

		// Add armor proficiencies
		const armorProficiencies = this._getArmorProficiencies(classData);
		if (armorProficiencies && armorProficiencies.length > 0) {
			for (const armor of armorProficiencies) {
				character.addProficiency('armor', armor, 'Class');
			}
		}

		// Add weapon proficiencies
		const weaponProficiencies = this._getWeaponProficiencies(classData);
		if (weaponProficiencies && weaponProficiencies.length > 0) {
			for (const weapon of weaponProficiencies) {
				character.addProficiency('weapons', weapon, 'Class');
			}
		}

		// Add tool proficiencies (fixed proficiencies from tools field)
		const toolProficiencies = this._getToolProficiencies(classData);
		if (toolProficiencies && toolProficiencies.length > 0) {
			for (const tool of toolProficiencies) {
				// Skip display strings like "Choose X tools"
				if (!tool.toLowerCase().startsWith('choose')) {
					character.addProficiency('tools', tool, 'Class');
				}
			}
		}

		// Handle tool proficiency choices (from toolProficiencies field)
		this._processClassToolProficiencies(classData, character);

		// Handle skill proficiencies
		const skills = this._getSkillProficiencies(classData);
		const skillChoiceCount = this._getSkillChoiceCount(classData);

		if (skills && skills.length > 0 && skillChoiceCount > 0) {
			// Set up skill choices using the extracted names
			character.optionalProficiencies.skills.class.allowed = skillChoiceCount;
			character.optionalProficiencies.skills.class.options = skills;

			// Restore valid selections using the extracted names
			character.optionalProficiencies.skills.class.selected =
				previousClassSkills.filter((skill) => skills.includes(skill));
		}

		// Update combined options for all proficiency types
		this._updateCombinedProficiencyOptions(character);

		// Notify UI to update proficiencies
		document.dispatchEvent(new CustomEvent('proficiencyChanged'));
		document.dispatchEvent(new CustomEvent('characterChanged'));
	}

	/**
	 * Updates the combined proficiency options from race, class, and background
	 * @param {Character} character - The character object
	 * @private
	 */
	_updateCombinedProficiencyOptions(character) {
		if (!character) return;

		// Update skill options
		this._updateCombinedSkillOptions(character);

		// Update language options
		const raceLanguageAllowed =
			character.optionalProficiencies.languages.race?.allowed || 0;
		const classLanguageAllowed =
			character.optionalProficiencies.languages.class?.allowed || 0;
		const backgroundLanguageAllowed =
			character.optionalProficiencies.languages.background?.allowed || 0;

		const raceLanguageOptions =
			character.optionalProficiencies.languages.race?.options || [];
		const classLanguageOptions =
			character.optionalProficiencies.languages.class?.options || [];
		const backgroundLanguageOptions =
			character.optionalProficiencies.languages.background?.options || [];

		const raceLanguageSelected =
			character.optionalProficiencies.languages.race?.selected || [];
		const classLanguageSelected =
			character.optionalProficiencies.languages.class?.selected || [];
		const backgroundLanguageSelected =
			character.optionalProficiencies.languages.background?.selected || [];

		// Update total allowed count for languages
		character.optionalProficiencies.languages.allowed =
			raceLanguageAllowed + classLanguageAllowed + backgroundLanguageAllowed;

		// Combine selected languages from all sources
		character.optionalProficiencies.languages.selected = [
			...new Set([
				...raceLanguageSelected,
				...classLanguageSelected,
				...backgroundLanguageSelected,
			]),
		];

		// For combined options, include language options from all sources
		character.optionalProficiencies.languages.options = [
			...new Set([
				...raceLanguageOptions,
				...classLanguageOptions,
				...backgroundLanguageOptions,
			]),
		];
	}

	/**
	 * Updates the combined skill options from race, class, and background
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

	//-------------------------------------------------------------------------
	// Data Extraction Helper Methods
	//-------------------------------------------------------------------------

	/**
	 * Get saving throws from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {Array<string>} Array of saving throw names
	 * @private
	 */
	_getSavingThrows(classData) {
		if (!classData?.proficiency) return [];
		return classData.proficiency.map((prof) => attAbvToFull(prof) || prof);
	}

	/**
	 * Get armor proficiencies from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {Array<string>} Array of armor proficiency names
	 * @private
	 */
	_getArmorProficiencies(classData) {
		if (!classData?.startingProficiencies?.armor) return [];

		const armorMap = {
			light: 'Light Armor',
			medium: 'Medium Armor',
			heavy: 'Heavy Armor',
			shield: 'Shields',
		};

		return classData.startingProficiencies.armor.map((armor) => {
			if (armorMap[armor]) return armorMap[armor];
			return armor;
		});
	}

	/**
	 * Get weapon proficiencies from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {Array<string>} Array of weapon proficiency names
	 * @private
	 */
	_getWeaponProficiencies(classData) {
		if (!classData?.startingProficiencies?.weapons) return [];

		const weaponMap = {
			simple: 'Simple Weapons',
			martial: 'Martial Weapons',
		};

		return classData.startingProficiencies.weapons.map((weapon) => {
			if (weaponMap[weapon]) return weaponMap[weapon];
			return weapon;
		});
	}

	/**
	 * Process tool proficiency choices from class data
	 * Handles special fields like anyMusicalInstrument for Bard
	 * @param {Object} classData - Class JSON object
	 * @param {Object} character - Character object
	 * @private
	 */
	_processClassToolProficiencies(classData, character) {
		console.log('[ClassCard] _processClassToolProficiencies() called');

		const toolProfs = classData?.startingProficiencies?.toolProficiencies;
		if (!toolProfs || !Array.isArray(toolProfs)) {
			console.log('[ClassCard] No toolProficiencies found, returning');
			return;
		}

		// Accumulate all choices across multiple objects
		let maxAllowed = 0;
		const allOptions = [];

		for (const profObj of toolProfs) {
			// Handle fixed tool proficiencies (e.g., Druid with "herbalism kit": true)
			for (const [tool, hasProf] of Object.entries(profObj)) {
				if (hasProf === true && tool !== 'any' && tool !== 'anyMusicalInstrument' && tool !== 'anyArtisansTool' && tool !== 'choose') {
					// Add tool with original JSON casing preserved
					character.addProficiency('tools', tool, 'Class');
				}
			}

			// Handle "any musical instrument" choice (e.g., Bard with anyMusicalInstrument: 3)
			if (profObj.anyMusicalInstrument) {
				const count = profObj.anyMusicalInstrument;
				maxAllowed = Math.max(maxAllowed, count);
				allOptions.push('Musical instrument');
			}

			// Handle "any artisan's tool" choice (e.g., Monk with anyArtisansTool: 1)
			if (profObj.anyArtisansTool) {
				const count = profObj.anyArtisansTool;
				maxAllowed = Math.max(maxAllowed, count);
				// Add all individual artisan tools as options
				allOptions.push(...ARTISAN_TOOLS);
			}

			// Handle "any" tool proficiency choice
			if (profObj.any && profObj.any > 0) {
				maxAllowed = Math.max(maxAllowed, profObj.any);
				allOptions.push('any');
			}

			// Handle choose from specific list
			if (profObj.choose) {
				const count = profObj.choose.count || 1;
				const options = profObj.choose.from || [];
				maxAllowed = Math.max(maxAllowed, count);
				allOptions.push(...options);
			}
		}

		// Apply accumulated tool choices if any
		console.log('[ClassCard] maxAllowed:', maxAllowed, 'allOptions:', allOptions);

		if (maxAllowed > 0) {
			character.optionalProficiencies.tools.class.allowed = maxAllowed;
			character.optionalProficiencies.tools.class.options = allOptions;
			character.optionalProficiencies.tools.class.selected = [];

			console.log('[ClassCard] Set tools.class:', JSON.stringify(character.optionalProficiencies.tools.class));

			// Special case: if ONLY "Musical instrument" is offered (like Bard),
			// auto-populate the selected array so it shows as granted/default
			if (allOptions.length === 1 && allOptions[0] === 'Musical instrument') {
				for (let i = 0; i < maxAllowed; i++) {
					character.optionalProficiencies.tools.class.selected.push(
						'Musical instrument',
					);
				}
				console.log('[ClassCard] Bard detected - populated selected array:', character.optionalProficiencies.tools.class.selected);
			}
		}
	}

	/**
	 * Get tool proficiencies from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {Array<string>} Array of tool proficiency names
	 * @private
	 */
	_getToolProficiencies(classData) {
		if (!classData?.startingProficiencies?.tools) return [];

		// If toolProficiencies field exists, it handles the actual choices
		// so we should skip display text that represents those choices
		const hasToolProficienciesField =
			classData?.startingProficiencies?.toolProficiencies?.length > 0;

		const tools = [];
		for (const toolEntry of classData.startingProficiencies.tools) {
			if (typeof toolEntry === 'string') {
				// Skip display text for choices if toolProficiencies field handles them
				// Display text typically contains phrases like "any one", "of your choice"
				const isChoiceText = /\b(any|choose|of your choice)\b/i.test(toolEntry);
				if (!hasToolProficienciesField || !isChoiceText) {
					tools.push(toolEntry);
				}
			} else if (toolEntry.choose) {
				const count = toolEntry.choose.count || 1;
				tools.push(`Choose ${count} tool${count > 1 ? 's' : ''}`);
			} else {
				for (const [key, value] of Object.entries(toolEntry)) {
					if (value === true) {
						tools.push(key);
					}
				}
			}
		}

		return tools;
	}

	/**
	 * Get skill proficiency options from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {Array<string>} Array of skill names
	 * @private
	 */
	_getSkillProficiencies(classData) {
		if (!classData?.startingProficiencies?.skills) return [];

		const skills = classData.startingProficiencies.skills;
		const skillOptions = [];

		for (const skillEntry of skills) {
			if (skillEntry.choose?.from) {
				skillOptions.push(...skillEntry.choose.from);
			} else if (skillEntry.choose?.fromFilter) {
				// "Any" skills - return special marker
				skillOptions.push('any');
			} else {
				skillOptions.push(...Object.keys(skillEntry));
			}
		}

		return skillOptions;
	}

	/**
	 * Normalize skill name to proper casing matching 5etools format
	 * @param {string} skill - Skill name (may be lowercase from JSON)
	 * @returns {string} Skill name with proper casing
	 * @private
	 */
	/**
	 * Get number of skills to choose from class data
	 * @param {Object} classData - Class JSON object
	 * @returns {number} Number of skills to choose
	 * @private
	 */
	_getSkillChoiceCount(classData) {
		if (!classData?.startingProficiencies?.skills) return 0;

		const skills = classData.startingProficiencies.skills;

		for (const skillEntry of skills) {
			if (skillEntry.choose) {
				return skillEntry.choose.count || 0;
			}
		}

		return 0;
	}
}
