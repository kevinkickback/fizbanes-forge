// Main wizard controller for character creation flow (7-step wizard with session staging)

import { AppState } from '../../../app/AppState.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { CharacterCreationSession } from './CharacterCreationSession.js';

export class CharacterCreationModal {
	constructor() {
		this.modalEl = null;
		this.bootstrapModal = null;
		this.session = null;
		this._cleanup = DOMCleanup.create();

		// Step components (lazy loaded)
		this._stepComponents = {};

		console.debug('[CharacterCreationModal]', 'Constructor initialized');
	}

	async show() {
		try {
			console.debug(
				'[CharacterCreationModal]',
				'Opening character creation wizard',
			);

			const failedServices = AppState.getFailedServices();
			if (Array.isArray(failedServices) && failedServices.length > 0) {
				const message = `Cannot create characters until data loads (${failedServices.join(', ')}).`;
				showNotification(message, 'error');
				return;
			}

			// Get modal element
			this.modalEl = document.getElementById('newCharacterModal');
			if (!this.modalEl) {
				console.error(
					'[CharacterCreationModal]',
					'Modal element #newCharacterModal not found in DOM',
				);
				showNotification('Could not open character creation form', 'error');
				return;
			}

			// Create new session
			this.session = new CharacterCreationSession();

			// Fresh cleanup instance
			this._cleanup = DOMCleanup.create();

			// Initialize Bootstrap modal
			this._initializeBootstrapModal();

			// Render step 0
			await this._renderStep(0);

			// Attach navigation button listeners after render
			this._attachNavigationListeners();

			// Show modal
			this.bootstrapModal.show();
		} catch (error) {
			console.error('[CharacterCreationModal]', 'Failed to show modal', error);
			showNotification('Failed to open character creation form', 'error');
		}
	}

	async hide() {
		if (!this.bootstrapModal) return;
		this.bootstrapModal.hide();
	}

	async nextStep() {
		if (!this.session) return;

		const currentStep = this.session.currentStep;

		// Validate current step before proceeding
		if (!(await this._validateStep(currentStep))) {
			return;
		}

		// Save current step data
		await this._saveStepData(currentStep);

		// If on last step (step 6 = review), create character
		if (currentStep === 6) {
			await this._createCharacter();
			return;
		}

		// Move to next step
		this.session.currentStep = currentStep + 1;
		await this._renderStep(this.session.currentStep);
	}

	async backStep() {
		if (!this.session) return;

		const currentStep = this.session.currentStep;
		if (currentStep === 0) return;

		// Save current step data
		await this._saveStepData(currentStep);

		// Move to previous step
		this.session.currentStep = currentStep - 1;
		await this._renderStep(this.session.currentStep);
	}

	_initializeBootstrapModal() {
		// Dispose old modal instance if exists
		const existing = bootstrap.Modal.getInstance(this.modalEl);
		if (existing) {
			try {
				existing.dispose();
			} catch (e) {
				console.warn(
					'[CharacterCreationModal]',
					'Error disposing existing modal',
					e,
				);
			}
		}

		// Create new Bootstrap modal instance
		this.bootstrapModal = new bootstrap.Modal(this.modalEl, {
			backdrop: 'static',
			keyboard: false,
		});

		// Handle modal hidden event
		this._cleanup.once(this.modalEl, 'hidden.bs.modal', () => {
			this._onModalHidden();
		});
	}

	_attachNavigationListeners() {
		const backBtn = this.modalEl.querySelector('#wizardBackBtn');
		const nextBtn = this.modalEl.querySelector('#wizardNextBtn');

		if (backBtn) {
			this._cleanup.on(backBtn, 'click', () => this.backStep());
		}

		if (nextBtn) {
			this._cleanup.on(nextBtn, 'click', () => this.nextStep());
		}

		// Handle keyboard shortcuts
		this._cleanup.on(document, 'keydown', (e) => {
			if (!this.modalEl || !this.modalEl.classList.contains('show')) return;

			if (e.key === 'ArrowLeft') {
				this.backStep();
			} else if (e.key === 'ArrowRight') {
				this.nextStep();
			}
		});
	}

	async _renderStep(stepIndex) {
		try {
			console.debug('[CharacterCreationModal]', 'Rendering step', stepIndex);

			// Get content area
			const contentArea = this.modalEl.querySelector('[data-step-content]');
			if (!contentArea) {
				console.error('[CharacterCreationModal]', 'Content area not found');
				return;
			}

			// Load step component if not already loaded
			if (!this._stepComponents[stepIndex]) {
				this._stepComponents[stepIndex] =
					await this._loadStepComponent(stepIndex);
			}

			const step = this._stepComponents[stepIndex];
			if (!step) {
				console.error(
					'[CharacterCreationModal]',
					'Step component not found for index',
					stepIndex,
				);
				return;
			}

			// Render step HTML
			const html = await step.render();
			contentArea.innerHTML = html;

			// Attach event listeners
			if (step.attachListeners) {
				step.attachListeners(contentArea);
			}

			// Update stepper UI
			this._updateStepper();

			// Update navigation buttons
			this._updateNavigationButtons();
		} catch (error) {
			console.error(
				'[CharacterCreationModal]',
				'Failed to render step',
				stepIndex,
				error,
			);
			showNotification('Failed to load step', 'error');
		}
	}

	/**
	 * Load a step component dynamically.
	 * @private
	 */
	async _loadStepComponent(stepIndex) {
		try {
			let StepClass;

			switch (stepIndex) {
				case 0: {
					const { CharacterStepBasics } = await import(
						'./CharacterStepBasics.js'
					);
					StepClass = CharacterStepBasics;
					break;
				}
				case 1: {
					const { CharacterStepRules } = await import(
						'./CharacterStepRules.js'
					);
					StepClass = CharacterStepRules;
					break;
				}
				case 2: {
					const { CharacterStepRace } = await import('./CharacterStepRace.js');
					StepClass = CharacterStepRace;
					break;
				}
				case 3: {
					const { CharacterStepClass } = await import(
						'./CharacterStepClass.js'
					);
					StepClass = CharacterStepClass;
					break;
				}
				case 4: {
					const { CharacterStepBackground } = await import(
						'./CharacterStepBackground.js'
					);
					StepClass = CharacterStepBackground;
					break;
				}
				case 5: {
					const { CharacterStepAbilityScores } = await import(
						'./CharacterStepAbilityScores.js'
					);
					StepClass = CharacterStepAbilityScores;
					break;
				}
				case 6: {
					const { CharacterStepReview } = await import(
						'./CharacterStepReview.js'
					);
					StepClass = CharacterStepReview;
					break;
				}
				default:
					throw new Error(`Invalid step index: ${stepIndex}`);
			}

			return new StepClass(this.session, this);
		} catch (error) {
			console.error(
				'[CharacterCreationModal]',
				'Failed to load step component',
				stepIndex,
				error,
			);
			return null;
		}
	}

	async _validateStep(stepIndex) {
		const step = this._stepComponents[stepIndex];
		if (!step) return true;

		// Use step's validate method if available
		if (step.validate) {
			return await step.validate();
		}

		// Fallback to session validation
		return this.session.validateCurrentStep();
	}

	async _saveStepData(stepIndex) {
		const step = this._stepComponents[stepIndex];
		if (!step || !step.save) return;

		try {
			await step.save();
		} catch (error) {
			console.error(
				'[CharacterCreationModal]',
				'Failed to save step data',
				stepIndex,
				error,
			);
		}
	}

	_updateStepper() {
		const stepperItems = this.modalEl.querySelectorAll(
			'#newCharacterStepper .list-group-item',
		);
		const currentStep = this.session?.currentStep || 0;

		stepperItems.forEach((item, index) => {
			if (index === currentStep) {
				item.classList.add('active');
			} else {
				item.classList.remove('active');
			}
		});
	}

	_updateNavigationButtons() {
		const backBtn = this.modalEl.querySelector('#wizardBackBtn');
		const nextBtn = this.modalEl.querySelector('#wizardNextBtn');
		const currentStep = this.session?.currentStep || 0;

		if (backBtn) {
			backBtn.disabled = currentStep === 0;
		}

		if (nextBtn) {
			if (currentStep === 6) {
				// Final step (review) - show Create button
				nextBtn.textContent = 'Create';
				nextBtn.classList.remove('btn-primary');
				nextBtn.classList.add('btn-success');
			} else {
				// Intermediate step - show Next button
				nextBtn.textContent = 'Next';
				nextBtn.classList.remove('btn-success');
				nextBtn.classList.add('btn-primary');
			}
		}
	}

	async _createCharacter() {
		try {
			const stagedData = this.session.getStagedData();

			// Import CharacterManager
			const { CharacterManager } = await import(
				'../../../app/CharacterManager.js'
			);

			// Create character
			const character = await CharacterManager.createCharacter(stagedData.name);

			// Apply staged data (no legacy character.level field)
			character.gender = stagedData.gender;
			character.portrait =
				stagedData.portrait ||
				'assets/images/characters/placeholder_char_card.webp';
			character.allowedSources = stagedData.allowedSources;
			character.variantRules = {
				...stagedData.variantRules,
				abilityScoreMethod: stagedData.abilityScoreMethod || 'pointBuy',
			};

			// Apply race selection
			if (stagedData.race) {
				character.race = {
					name: stagedData.race.name,
					source: stagedData.race.source,
					subrace: stagedData.race.subrace || '',
				};

				if (stagedData.race.abilityChoices) {
					const abilityChoices = Array.isArray(stagedData.race.abilityChoices)
						? [...stagedData.race.abilityChoices]
						: Object.entries(stagedData.race.abilityChoices)
								.sort(
									([a], [b]) => Number.parseInt(a, 10) - Number.parseInt(b, 10),
								)
								.map(([, choice]) => choice)
								.filter(Boolean);

					character.race.abilityChoices = abilityChoices;
				}
			}

			// Apply class selection (only in progression.classes[], no legacy character.class field)
			if (stagedData.class) {
				// New progression format - add class to progression.classes array
				if (!character.progression) {
					character.progression = {
						classes: [],
						experiencePoints: 0,
						levelUps: [],
					};
				}

				const classEntry = {
					name: stagedData.class.name,
					source: stagedData.class.source,
					levels: stagedData.level || 1, // Use 'levels' (plural) to match progression system
				};

				if (stagedData.class.subclass) {
					classEntry.subclass = stagedData.class.subclass;
				}

				character.progression.classes.push(classEntry);
			}

			// Apply background selection and proficiencies
			if (stagedData.background) {
				character.background = {
					name: stagedData.background.name,
					source: stagedData.background.source,
				};

				// Apply background proficiencies
				const { backgroundService } = await import(
					'../../../services/BackgroundService.js'
				);
				const background = backgroundService.getBackground(
					stagedData.background.name,
					stagedData.background.source,
				);
				if (background) {
					this._applyBackgroundProficiencies(character, background);
				}
			}

			// Apply ability scores
			if (stagedData.abilityScores) {
				character.abilityScores = { ...stagedData.abilityScores };
			}

			// Update SourceService
			const { sourceService } = await import(
				'../../../services/SourceService.js'
			);
			sourceService.allowedSources = new Set(stagedData.allowedSources);
			eventBus.emit('sources:allowed-changed', stagedData.allowedSources);

			// Save character
			await CharacterManager.saveCharacter();

			// Close modal
			this.bootstrapModal.hide();

			// Emit event
			eventBus.emit(EVENTS.CHARACTER_CREATED, character);

			showNotification('New character created successfully', 'success');
		} catch (error) {
			console.error(
				'[CharacterCreationModal]',
				'Failed to create character',
				error,
			);
			showNotification('Error creating new character', 'error');
		}
	}

	_onModalHidden() {
		console.debug('[CharacterCreationModal]', 'Modal hidden, cleaning up');

		// Cleanup all step components
		for (const step of Object.values(this._stepComponents)) {
			if (step._cleanup) {
				step._cleanup.cleanup();
			}
		}
		this._stepComponents = {};

		// Cleanup modal
		this._cleanup.cleanup();

		// Reset session
		if (this.session) {
			this.session.reset();
			this.session = null;
		}

		// Dispose Bootstrap modal
		if (this.bootstrapModal) {
			try {
				this.bootstrapModal.dispose();
			} catch (e) {
				console.warn('[CharacterCreationModal]', 'Error disposing modal', e);
			}
			this.bootstrapModal = null;
		}

		eventBus.emit(EVENTS.NEW_CHARACTER_MODAL_CLOSED);
	}

	// Apply background proficiencies to character (fixed and optional)
	_applyBackgroundProficiencies(character, background) {
		if (!character || !background) return;

		// Apply fixed skill proficiencies
		const skillProfs = background?.proficiencies?.skills || [];
		for (const skillEntry of skillProfs) {
			if (!skillEntry.choose && skillEntry.skill) {
				character.addProficiency('skills', skillEntry.skill, 'Background');
			}
			// Set up optional skill choices
			if (skillEntry.choose) {
				const count = skillEntry.choose.count || 1;
				const from = skillEntry.choose.from || [];
				character.optionalProficiencies.skills.background.allowed = count;
				character.optionalProficiencies.skills.background.options = from;
				character.optionalProficiencies.skills.background.selected = [];
			}
		}

		// Apply fixed tool proficiencies
		const toolProfs = background?.proficiencies?.tools || [];
		for (const toolEntry of toolProfs) {
			if (!toolEntry.choose && toolEntry.tool) {
				character.addProficiency('tools', toolEntry.tool, 'Background');
			}
			// Set up optional tool choices
			if (toolEntry.choose) {
				const count = toolEntry.choose.count || 1;
				character.optionalProficiencies.tools.background.allowed = count;
				character.optionalProficiencies.tools.background.options = [];
				character.optionalProficiencies.tools.background.selected = [];
			}
		}

		// Apply language proficiencies (fixed and optional)
		const langProfs = background?.proficiencies?.languages || [];
		for (const langEntry of langProfs) {
			// Fixed languages
			if (!langEntry.choose && langEntry.language) {
				character.addProficiency('languages', langEntry.language, 'Background');
			}
			// Optional language choices
			if (langEntry.choose) {
				const count = langEntry.choose.count || 1;
				const from = langEntry.choose.from || [];
				const type = langEntry.choose.type || '';

				character.optionalProficiencies.languages.background.allowed = count;

				// If 'any' or 'anystandard', provide all standard languages
				if (type === 'any' || type === 'anystandard' || from.length === 0) {
					character.optionalProficiencies.languages.background.options = [
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
				} else {
					character.optionalProficiencies.languages.background.options = from;
				}
				character.optionalProficiencies.languages.background.selected = [];
			}
		}

		console.debug(
			'[CharacterCreationModal]',
			'Applied background proficiencies',
			{
				skills: character.optionalProficiencies.skills.background,
				languages: character.optionalProficiencies.languages.background,
				tools: character.optionalProficiencies.tools.background,
			},
		);
	}
}
