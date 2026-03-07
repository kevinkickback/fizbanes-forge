// Controller for Ability Score Improvement (ASI) section and inline choices.

import { CharacterManager } from '../../../app/CharacterManager.js';
import {
	attAbvToFull,
	attAbvToLower,
	getAbilityAbbrDisplay,
	toTitleCase,
} from '../../../lib/5eToolsParser.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { levelUpService } from '../../../services/LevelUpService.js';

export class ClassASIController {
	constructor(cleanup) {
		this._cleanup = cleanup;
	}

	renderSection(className) {
		const character = CharacterManager.getCurrentCharacter();

		const asiLevels = levelUpService._getASILevelsForClass(className);
		const progressionClass = character.progression?.classes?.find(
			(c) => c.name === className,
		);
		const classLevel = progressionClass?.levels || 0;

		if (!asiLevels.includes(classLevel)) {
			this.hide();
			return;
		}

		const levelUps = character.progression?.levelUps || [];
		const asiUsed = levelUps.some((lu) => {
			const isThisLevel = lu.toLevel === classLevel;
			const hasChanges =
				(lu.changedAbilities && Object.keys(lu.changedAbilities).length > 0) ||
				(lu.appliedFeats && lu.appliedFeats.length > 0);
			return isThisLevel && hasChanges;
		});

		if (asiUsed) {
			this.hide();
			return;
		}

		const container = document.getElementById('asiChoiceSection');
		if (!container) return;

		container.innerHTML = `
			<div class="card mb-3">
				<div class="card-header">
					<h6 class="mb-0"><i class="fas fa-arrow-up"></i> Ability Score Improvement</h6>
					<small class="text-muted">Level ${classLevel}</small>
				</div>
				<div class="card-body">
					<p class="mb-3">You can increase one ability score by 2, or two ability scores by 1 each. Alternatively, you can choose a feat instead.</p>
					
					<div class="form-check mb-2">
						<input class="form-check-input" type="radio" name="asiChoice_${classLevel}" id="asiStandard_${classLevel}" value="standard">
						<label class="form-check-label" for="asiStandard_${classLevel}">
							<strong>Standard ASI</strong> - Increase ability scores
						</label>
					</div>
					
					<div id="asiAbilitySelectors_${classLevel}" class="ms-4 mb-3 u-hidden">
						<div class="row g-2">
							<div class="col-md-6">
								<label class="form-label small">Ability 1</label>
								<select class="form-select form-select-sm" id="asiAbility1_${classLevel}">
									<option value="">Select ability...</option>
									<option value="str">${getAbilityAbbrDisplay('str')}</option>
									<option value="dex">${getAbilityAbbrDisplay('dex')}</option>
									<option value="con">${getAbilityAbbrDisplay('con')}</option>
									<option value="int">${getAbilityAbbrDisplay('int')}</option>
									<option value="wis">${getAbilityAbbrDisplay('wis')}</option>
									<option value="cha">${getAbilityAbbrDisplay('cha')}</option>
								</select>
							</div>
							<div class="col-md-6">
								<label class="form-label small">Bonus</label>
								<select class="form-select form-select-sm" id="asiBonus1_${classLevel}">
									<option value="2">+2</option>
									<option value="1">+1</option>
								</select>
							</div>
						</div>
						<div class="row g-2 mt-2 u-hidden" id="asiSecondAbility_${classLevel}">
							<div class="col-md-6">
								<label class="form-label small">Ability 2</label>
								<select class="form-select form-select-sm" id="asiAbility2_${classLevel}">
									<option value="">Select ability...</option>
									<option value="str">${getAbilityAbbrDisplay('str')}</option>
									<option value="dex">${getAbilityAbbrDisplay('dex')}</option>
									<option value="con">${getAbilityAbbrDisplay('con')}</option>
									<option value="int">${getAbilityAbbrDisplay('int')}</option>
									<option value="wis">${getAbilityAbbrDisplay('wis')}</option>
									<option value="cha">${getAbilityAbbrDisplay('cha')}</option>
								</select>
							</div>
							<div class="col-md-6">
								<label class="form-label small">Bonus</label>
								<input type="text" class="form-control form-control-sm" value="+1" disabled>
							</div>
						</div>
						<button class="btn btn-primary btn-sm mt-3" id="applyASI_${classLevel}">
							Apply ASI
						</button>
					</div>
					
					<div class="form-check">
						<input class="form-check-input" type="radio" name="asiChoice_${classLevel}" id="asiFeat_${classLevel}" value="feat">
						<label class="form-check-label" for="asiFeat_${classLevel}">
							<strong>Choose a Feat</strong> - Browse and select a feat
						</label>
					</div>
					
					<div id="asiFeatButton_${classLevel}" class="ms-4 mt-2 u-hidden">
						<button class="btn btn-secondary btn-sm" id="browseFeat_${classLevel}">
							<i class="fas fa-arrow-down"></i> Browse Feats Below
						</button>
					</div>
				</div>
			</div>
		`;
		container.classList.remove('u-hidden');

		this._attachSectionListeners(classLevel);
	}

	_attachSectionListeners(classLevel) {
		const standardRadio = document.getElementById(`asiStandard_${classLevel}`);
		const asiAbilitySelectors = document.getElementById(
			`asiAbilitySelectors_${classLevel}`,
		);

		if (standardRadio && asiAbilitySelectors) {
			this._cleanup.on(standardRadio, 'change', () => {
				asiAbilitySelectors.classList.toggle(
					'u-hidden',
					!standardRadio.checked,
				);
				document
					.getElementById(`asiFeatButton_${classLevel}`)
					.classList.add('u-hidden');
			});
		}

		const featRadio = document.getElementById(`asiFeat_${classLevel}`);
		const asiFeatButton = document.getElementById(
			`asiFeatButton_${classLevel}`,
		);

		if (featRadio && asiFeatButton) {
			this._cleanup.on(featRadio, 'change', () => {
				asiFeatButton.classList.toggle('u-hidden', !featRadio.checked);
				if (asiAbilitySelectors) {
					asiAbilitySelectors.classList.add('u-hidden');
				}
			});
		}

		const bonus1Select = document.getElementById(`asiBonus1_${classLevel}`);
		const secondAbilityRow = document.getElementById(
			`asiSecondAbility_${classLevel}`,
		);

		if (bonus1Select && secondAbilityRow) {
			this._cleanup.on(bonus1Select, 'change', () => {
				secondAbilityRow.classList.toggle(
					'u-hidden',
					bonus1Select.value !== '1',
				);
			});
		}

		const applyButton = document.getElementById(`applyASI_${classLevel}`);
		if (applyButton) {
			this._cleanup.on(applyButton, 'click', () => {
				this._handleApplication(classLevel);
			});
		}

		const browseFeatButton = document.getElementById(
			`browseFeat_${classLevel}`,
		);
		if (browseFeatButton) {
			this._cleanup.on(browseFeatButton, 'click', () => {
				const featSection = document.getElementById('build-feats');
				if (featSection) {
					featSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			});
		}
	}

	_handleApplication(classLevel) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const ability1 = document.getElementById(
			`asiAbility1_${classLevel}`,
		)?.value;
		const bonus1 = parseInt(
			document.getElementById(`asiBonus1_${classLevel}`)?.value || '2',
			10,
		);

		if (!ability1) {
			showNotification('Please select an ability to improve.', 'warning');
			return;
		}

		const changes = {};
		changes[ability1] = bonus1;

		if (bonus1 === 1) {
			const ability2 = document.getElementById(
				`asiAbility2_${classLevel}`,
			)?.value;
			if (!ability2) {
				showNotification(
					'Please select a second ability for +1 bonus.',
					'warning',
				);
				return;
			}
			if (ability2 === ability1) {
				showNotification('Please select two different abilities.', 'warning');
				return;
			}
			changes[ability2] = 1;
		}

		for (const [ability, bonus] of Object.entries(changes)) {
			const currentScore = character.getAbilityScore(ability) || 10;
			character.setAbilityScore(ability, currentScore + bonus);
		}

		levelUpService.recordLevelUp(character, classLevel - 1, classLevel, {
			changedAbilities: changes,
			appliedFeats: [],
			appliedFeatures: [],
		});

		this.hide();
		eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
	}

	hide() {
		const container = document.getElementById('asiChoiceSection');
		if (container) {
			container.classList.add('u-hidden');
			container.innerHTML = '';
		}
	}

	renderChoice(choice, _className) {
		const character = CharacterManager.getCurrentCharacter();

		const levelUps = character.progression?.levelUps || [];
		const asiRecord = levelUps.find((lu) => {
			const isThisLevel = lu.toLevel === choice.level;
			const hasChanges =
				(lu.changedAbilities && Object.keys(lu.changedAbilities).length > 0) ||
				(lu.appliedFeats && lu.appliedFeats.length > 0);
			return isThisLevel && hasChanges;
		});

		const asiUsed = !!asiRecord;
		const hasFeat =
			asiRecord?.appliedFeats && asiRecord.appliedFeats.length > 0;
		const hasASI =
			asiRecord?.changedAbilities &&
			Object.keys(asiRecord.changedAbilities).length > 0;

		let selectedChoice = 'none';
		let selectedDisplay = 'None selected';

		if (asiUsed) {
			if (hasFeat) {
				selectedChoice = 'feat';
				selectedDisplay = asiRecord.appliedFeats.join(', ');
			} else if (hasASI) {
				selectedChoice = 'asi';
				const abilityChanges = Object.entries(asiRecord.changedAbilities)
					.map(
						([ability, change]) =>
							`+${change} ${toTitleCase(attAbvToFull(ability))}`,
					)
					.join(', ');
				selectedDisplay = abilityChanges;
			}
		}

		const asiChecked = selectedChoice === 'asi' || selectedChoice === 'none';
		const featChecked = selectedChoice === 'feat';
		const radiosDisabled = asiUsed;

		let buttonText, buttonIcon;
		if (asiUsed) {
			buttonText = 'Change';
			buttonIcon = 'fa-list';
		} else if (featChecked) {
			buttonText = 'Choose';
			buttonIcon = 'fa-scroll';
		} else {
			buttonText = 'Increase Scores';
			buttonIcon = 'fa-arrow-up';
		}

		const featAttr =
			hasFeat && asiRecord?.appliedFeats?.[0]
				? `data-hover-feat="${encodeURIComponent(asiRecord.appliedFeats[0])}"`
				: '';

		return `
			<div class="choice-item border-bottom pb-2 mb-2" data-choice-card="${choice.id}"
				data-hover-type="asi" data-hover-level="${choice.level}" ${featAttr}>
				<div class="d-flex justify-content-between align-items-start flex-column flex-md-row gap-2">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center mb-2">
							<strong><i class="fas fa-arrow-up"></i> Ability Score Improvement</strong>
							${asiUsed ? '<i class="fas fa-check-circle text-success ms-2"></i>' : ''}
						</div>
						<div class="text-muted small mb-2">
							${selectedDisplay}
						</div>
						<div class="d-flex flex-column gap-1">
							<div class="form-check form-check-inline">
								<input class="form-check-input" type="radio" name="asiChoice_${choice.level}" 
									id="asiRadio_${choice.level}" value="asi" ${asiChecked ? 'checked' : ''}
									${radiosDisabled ? 'disabled' : ''}
									data-asi-radio="${choice.level}">
								<label class="form-check-label" for="asiRadio_${choice.level}">
									Ability Score Increase
								</label>
							</div>
							<div class="form-check form-check-inline">
								<input class="form-check-input" type="radio" name="asiChoice_${choice.level}" 
									id="featRadio_${choice.level}" value="feat" ${featChecked ? 'checked' : ''}
									${radiosDisabled ? 'disabled' : ''}
									data-feat-radio="${choice.level}">
								<label class="form-check-label" for="featRadio_${choice.level}">
									Feat
								</label>
							</div>
						</div>
					</div>
					<button 
						class="btn btn-sm btn-outline-primary align-self-md-start" 
						data-asi-action-btn="${choice.level}"
						data-current-choice="${selectedChoice}"
						data-asi-used="${asiUsed}">
						<i class="fas ${buttonIcon}" data-asi-icon="${choice.level}"></i> 
						<span data-asi-btn-text="${choice.level}">${buttonText}</span>
					</button>
				</div>
			</div>
		`;
	}

	async handleChange(level, syncCallback) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		const levelUps = character.progression?.levelUps || [];
		const existingASI = levelUps.find((lu) => lu.toLevel === level);

		if (existingASI) {
			if (existingASI.changedAbilities) {
				for (const [ability, bonus] of Object.entries(
					existingASI.changedAbilities,
				)) {
					const normalizedAbility = attAbvToLower(ability);

					character.removeAbilityBonus(
						normalizedAbility,
						bonus,
						'Ability Score Increase',
					);
					character.abilityScores[ability] =
						(character.abilityScores[ability] || 10) - bonus;
				}
			}

			if (existingASI.appliedFeats?.length) {
				for (const featName of existingASI.appliedFeats) {
					const featIndex = character.feats.findIndex(
						(f) => f.name === featName,
					);
					if (featIndex !== -1) {
						character.feats.splice(featIndex, 1);
					}
				}
			}

			const existingIndex = levelUps.findIndex((lu) => lu.toLevel === level);
			if (existingIndex !== -1) {
				levelUps.splice(existingIndex, 1);
			}
		}

		await syncCallback();
		eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
		eventBus.emit(EVENTS.ABILITY_SCORES_CHANGED, { character });
	}

	async handleSelection(level, isSelectingFeat, syncCallback) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) return;

		if (isSelectingFeat) {
			const { ClassFeatSelectorModal } = await import(
				'../class/ClassFeatSelectorModal.js'
			);

			const levelUps = character.progression?.levelUps || [];
			const existingFeat = levelUps.find((lu) => {
				const isThisLevel = lu.toLevel === level;
				const hasFeat = lu.appliedFeats && lu.appliedFeats.length > 0;
				return isThisLevel && hasFeat;
			});

			const currentFeat = existingFeat?.appliedFeats?.[0];

			const featSelector = new ClassFeatSelectorModal(null, null);

			try {
				const selectedFeatName = await featSelector.show(
					currentFeat ? { name: currentFeat } : null,
				);

				if (selectedFeatName) {
					levelUpService.recordLevelUp(character, level - 1, level, {
						changedAbilities: {},
						appliedFeats: [selectedFeatName],
						appliedFeatures: [],
					});

					character.feats.push({
						name: selectedFeatName,
						source: 'Ability Score Improvement',
					});
					await syncCallback();
					eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
				}
			} catch (error) {
				console.error(
					'[ClassASIController]',
					'Error in feat selection:',
					error,
				);
			}
			return;
		}

		const primaryClass = character.getPrimaryClass();
		if (!primaryClass) return;

		const { AbilityScoreSelectorModal } = await import(
			'../class/AbilityScoreSelectorModal.js'
		);

		const levelUps = character.progression?.levelUps || [];
		const existingASI = levelUps.find((lu) => {
			const isThisLevel = lu.toLevel === level;
			const hasChanges =
				lu.changedAbilities && Object.keys(lu.changedAbilities).length > 0;
			return isThisLevel && hasChanges;
		});

		const currentASI = existingASI?.changedAbilities || {};

		const modal = new AbilityScoreSelectorModal(level, currentASI);

		try {
			const result = await modal.show();

			if (result) {
				for (const [ability, bonus] of Object.entries(result)) {
					const currentScore = character.abilityScores[ability] || 10;
					character.abilityScores[ability] = currentScore + bonus;

					character.addAbilityBonus(ability, bonus, 'Ability Score Increase');
				}

				levelUpService.recordLevelUp(character, level - 1, level, {
					changedAbilities: result,
					appliedFeats: [],
					appliedFeatures: [],
				});

				await syncCallback();
				eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
				eventBus.emit(EVENTS.ABILITY_SCORES_CHANGED, { character });
			}
		} catch (error) {
			console.error('[ClassASIController]', 'Error in ASI selection:', error);
		}
	}
}
