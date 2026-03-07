// Main wizard controller for character creation flow (7-step wizard with session staging)

import { AppState } from '../../../app/AppState.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { disposeBootstrapModal, hideBootstrapModal, initializeBootstrapModal } from '../../../lib/ModalCleanupUtility.js';
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
	}

	async show() {
		try {
			const failedServices = AppState.getFailedServices();
			if (Array.isArray(failedServices) && failedServices.length > 0) {
				const message = `Cannot create characters until data loads (${failedServices.join(', ')}).`;
				showNotification(message, 'error');
				return;
			}

			this.modalEl = document.getElementById('newCharacterModal');
			if (!this.modalEl) {
				console.error(
					'[CharacterCreationModal]',
					'Modal element #newCharacterModal not found in DOM',
				);
				showNotification('Could not open character creation form', 'error');
				return;
			}

			this.session = new CharacterCreationSession();

			this._cleanup = DOMCleanup.create();

			this._initializeBootstrapModal();

			await this._renderStep(0);
			this._attachNavigationListeners();

			this.bootstrapModal.show();
		} catch (error) {
			console.error('[CharacterCreationModal]', 'Failed to show modal', error);
			showNotification('Failed to open character creation form', 'error');
		}
	}

	async hide() {
		if (!this.bootstrapModal) return;

		await hideBootstrapModal(this.bootstrapModal, this.modalEl);

		this._cleanup.cleanup();
		this.bootstrapModal = null;
	}

	async nextStep() {
		if (!this.session) return;

		const currentStep = this.session.currentStep;

		if (!(await this._validateStep(currentStep))) {
			return;
		}

		await this._saveStepData(currentStep);

		if (currentStep === 6) {
			await this._createCharacter();
			return;
		}

		this.session.currentStep = currentStep + 1;
		await this._renderStep(this.session.currentStep);
	}

	async backStep() {
		if (!this.session) return;

		const currentStep = this.session.currentStep;
		if (currentStep === 0) return;

		await this._saveStepData(currentStep);

		this.session.currentStep = currentStep - 1;
		await this._renderStep(this.session.currentStep);
	}

	_initializeBootstrapModal() {
		this.bootstrapModal = initializeBootstrapModal(this.modalEl, {
			backdrop: 'static',
			keyboard: false,
		});

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
			const contentArea = this.modalEl.querySelector('[data-step-content]');
			if (!contentArea) {
				console.error('[CharacterCreationModal]', 'Content area not found');
				return;
			}

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

			const html = await step.render();
			contentArea.innerHTML = html;

			if (step.attachListeners) {
				step.attachListeners(contentArea);
			}

			this._updateStepper();
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

		if (step.validate) {
			return await step.validate();
		}

		return true;
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

			const { CharacterManager } = await import(
				'../../../app/CharacterManager.js'
			);

			const character = await CharacterManager.createCharacter(stagedData.name);

			character.gender = stagedData.gender;
			character.portrait =
				stagedData.portrait ||
				'assets/images/characters/placeholder_char_card.webp';
			character.allowedSources = stagedData.allowedSources;
			character.variantRules = {
				...stagedData.variantRules,
				abilityScoreMethod: stagedData.abilityScoreMethod || 'pointBuy',
			};

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

				await this._applyRaceProficiencies(character, stagedData.race);
			}

			if (stagedData.class) {
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

				await this._applyClassProficiencies(character, stagedData.class);
			}

			if (stagedData.background) {
				character.background = {
					name: stagedData.background.name,
					source: stagedData.background.source,
				};

				const { backgroundService } = await import(
					'../../../services/BackgroundService.js'
				);
				const background = backgroundService.getBackground(
					stagedData.background.name,
					stagedData.background.source,
				);
				if (background) {
					await this._applyBackgroundProficiencies(character, background);
					await this._applyBackgroundEquipment(character, background);
				}
			}

			if (stagedData.abilityScores) {
				character.abilityScores = { ...stagedData.abilityScores };
			}

			const { sourceService } = await import(
				'../../../services/SourceService.js'
			);
			sourceService.allowedSources = new Set(stagedData.allowedSources);
			eventBus.emit(EVENTS.SOURCES_ALLOWED_CHANGED, stagedData.allowedSources);

			await CharacterManager.saveCharacter();

			this.bootstrapModal.hide();

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

		for (const step of Object.values(this._stepComponents)) {
			if (step._cleanup) {
				step._cleanup.cleanup();
			}
		}
		this._stepComponents = {};

		this._cleanup.cleanup();

		if (this.session) {
			this.session.reset();
			this.session = null;
		}

		disposeBootstrapModal(this.bootstrapModal);
		this.bootstrapModal = null;

		eventBus.emit(EVENTS.NEW_CHARACTER_MODAL_CLOSED);
	}

	async _applyClassProficiencies(character, stagedClass) {
		if (!character || !stagedClass) return;

		const { classService } = await import(
			'../../../services/ClassService.js'
		);
		const { attAbvToFull } = await import(
			'../../../lib/5eToolsParser.js'
		);

		let classData;
		try {
			classData = classService.getClass(
				stagedClass.name,
				stagedClass.source || 'PHB',
			);
		} catch {
			return;
		}
		if (!classData) return;

		// Saving throws
		if (classData.proficiency) {
			for (const prof of classData.proficiency) {
				const fullName = attAbvToFull(prof) || prof;
				character.addProficiency('savingThrows', fullName, 'Class');
			}
		}

		const sp = classData.startingProficiencies;
		if (!sp) return;

		// Armor
		if (sp.armor) {
			const armorMap = {
				light: 'Light Armor', medium: 'Medium Armor',
				heavy: 'Heavy Armor', shield: 'Shields',
			};
			for (const armor of sp.armor) {
				character.addProficiency('armor', armorMap[armor] || armor, 'Class');
			}
		}

		// Weapons
		if (sp.weapons) {
			const weaponMap = { simple: 'Simple Weapons', martial: 'Martial Weapons' };
			for (const weapon of sp.weapons) {
				character.addProficiency('weapons', weaponMap[weapon] || weapon, 'Class');
			}
		}

		// Tools (fixed proficiencies)
		if (sp.tools) {
			for (const toolEntry of sp.tools) {
				if (typeof toolEntry === 'string') {
					if (!/\b(any|choose|of your choice)\b/i.test(toolEntry)) {
						character.addProficiency('tools', toolEntry, 'Class');
					}
				} else if (typeof toolEntry === 'object') {
					for (const [key, value] of Object.entries(toolEntry)) {
						if (value === true) {
							character.addProficiency('tools', key, 'Class');
						}
					}
				}
			}
		}

		// Tool proficiency choices (from toolProficiencies field)
		if (sp.toolProficiencies) {
			for (const profObj of sp.toolProficiencies) {
				for (const [tool, hasProf] of Object.entries(profObj)) {
					if (
						hasProf === true &&
						tool !== 'any' && tool !== 'anyMusicalInstrument' &&
						tool !== 'anyArtisansTool' && tool !== 'choose'
					) {
						character.addProficiency('tools', tool, 'Class');
					}
				}
			}
		}

		// Skill proficiency choices (set up optional structure for later selection)
		if (sp.skills) {
			const skillOptions = [];
			let skillChoiceCount = 0;
			for (const skillEntry of sp.skills) {
				if (skillEntry.choose) {
					skillChoiceCount = skillEntry.choose.count || 0;
					if (skillEntry.choose.from) {
						skillOptions.push(...skillEntry.choose.from);
					}
				}
			}
			if (skillChoiceCount > 0 && skillOptions.length > 0) {
				character.optionalProficiencies.skills.class.allowed = skillChoiceCount;
				character.optionalProficiencies.skills.class.options = skillOptions;
				character.optionalProficiencies.skills.class.selected = [];
			}
		}

		console.debug('[CharacterCreationModal]', 'Applied class proficiencies', {
			savingThrows: character.proficiencies.savingThrows,
			armor: character.proficiencies.armor,
			weapons: character.proficiencies.weapons,
		});
	}

	async _applyRaceProficiencies(character, stagedRace) {
		if (!character || !stagedRace) return;

		const { raceService } = await import(
			'../../../services/RaceService.js'
		);

		let raceData;
		try {
			raceData = raceService.getRace(
				stagedRace.name,
				stagedRace.source || 'PHB',
			);
		} catch {
			return;
		}
		if (!raceData) return;

		// Language proficiencies
		if (raceData.languageProficiencies) {
			for (const profObj of raceData.languageProficiencies) {
				for (const [key, value] of Object.entries(profObj)) {
					const keyLower = key.toLowerCase();
					if (
						value === true &&
						keyLower !== 'anystandard' && keyLower !== 'any' &&
						keyLower !== 'choose' && keyLower !== 'other'
					) {
						character.addProficiency('languages', key, 'Race');
					} else if (keyLower === 'other' && value === true) {
						if (raceData.name !== 'Common') {
							character.addProficiency('languages', raceData.name, 'Race');
						}
					}
				}
			}
		}

		// Weapon proficiencies
		if (raceData.weaponProficiencies) {
			for (const profObj of raceData.weaponProficiencies) {
				for (const [weapon, hasProf] of Object.entries(profObj)) {
					if (hasProf === true) {
						const name = weapon.includes('|') ? weapon.split('|')[0] : weapon;
						character.addProficiency('weapons', name, 'Race');
					}
				}
			}
		}

		// Tool proficiencies (fixed only)
		if (raceData.toolProficiencies) {
			for (const profObj of raceData.toolProficiencies) {
				for (const [tool, hasProf] of Object.entries(profObj)) {
					if (hasProf === true && tool !== 'any') {
						character.addProficiency('tools', tool, 'Race');
					}
				}
			}
		}

		// Skill proficiencies (fixed only)
		if (raceData.skillProficiencies) {
			for (const profObj of raceData.skillProficiencies) {
				for (const [skill, hasProf] of Object.entries(profObj)) {
					if (hasProf === true && skill !== 'choose' && skill !== 'any') {
						character.addProficiency('skills', skill, 'Race');
					}
				}
			}
		}

		console.debug('[CharacterCreationModal]', 'Applied race proficiencies', {
			languages: character.proficiencies.languages,
			weapons: character.proficiencies.weapons,
		});
	}

	async _applyBackgroundEquipment(character, background) {
		if (!character || !background) return;

		const { equipmentService } = await import(
			'../../../services/EquipmentService.js'
		);

		// Determine default equipment choices (first option for each choice group)
		let equipmentChoices = null;
		if (background.equipment) {
			for (const eq of background.equipment) {
				const keys = Object.keys(eq).filter(k => k !== '_').sort();
				if (keys.length > 1) {
					equipmentChoices = { 0: keys[0] };
					break;
				}
			}
		}

		if (equipmentChoices) {
			character.background.equipmentChoices = equipmentChoices;
		}

		equipmentService.applyBackgroundEquipment(
			character,
			background,
			equipmentChoices,
		);

		console.debug('[CharacterCreationModal]', 'Applied background equipment', {
			itemCount: character.inventory?.items?.length || 0,
		});
	}

	async _applyBackgroundProficiencies(character, background) {
		if (!character || !background) return;

		const skillProfs = background?.proficiencies?.skills || [];
		for (const skillEntry of skillProfs) {
			if (!skillEntry.choose && skillEntry.skill) {
				character.addProficiency('skills', skillEntry.skill, 'Background');
			}
			if (skillEntry.choose) {
				const count = skillEntry.choose.count || 1;
				const from = skillEntry.choose.from || [];
				character.optionalProficiencies.skills.background.allowed = count;
				character.optionalProficiencies.skills.background.options = from;
				character.optionalProficiencies.skills.background.selected = [];
			}
		}

		const toolProfs = background?.proficiencies?.tools || [];
		for (const toolEntry of toolProfs) {
			if (!toolEntry.choose && toolEntry.tool) {
				character.addProficiency('tools', toolEntry.tool, 'Background');
			}
			if (toolEntry.choose) {
				const count = toolEntry.choose.count || 1;
				character.optionalProficiencies.tools.background.allowed = count;
				character.optionalProficiencies.tools.background.options = [];
				character.optionalProficiencies.tools.background.selected = [];
			}
		}

		const langProfs = background?.proficiencies?.languages || [];
		for (const langEntry of langProfs) {
			if (!langEntry.choose && langEntry.language) {
				character.addProficiency('languages', langEntry.language, 'Background');
			}
			if (langEntry.choose) {
				const count = langEntry.choose.count || 1;
				const from = langEntry.choose.from || [];
				const type = langEntry.choose.type || '';

				character.optionalProficiencies.languages.background.allowed = count;

				if (type === 'any' || type === 'anystandard' || from.length === 0) {
					const { proficiencyDescriptionService } = await import(
						'../../../services/ProficiencyDescriptionService.js'
					);
					character.optionalProficiencies.languages.background.options =
						await proficiencyDescriptionService.getStandardLanguages();
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
