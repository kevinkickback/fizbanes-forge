// Controller for spell notification section and inline spell choices.

import { CharacterManager } from '../../../app/CharacterManager.js';
import { SPELL_LEVEL_ORDINALS } from '../../../lib/5eToolsParser.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { ClassSpellSelectorModal } from './ClassSpellSelectorModal.js';

export class ClassSpellNotificationController {
	constructor(cleanup, classService) {
		this._cleanup = cleanup;
		this._classService = classService;
	}

	render(className) {
		const classData = this._classService.getClass(className);
		const character = CharacterManager.getCurrentCharacter();

		if (!classData?.spellcastingAbility) {
			this.hide();
			return;
		}

		const progressionClass = character.progression?.classes?.find(
			(c) => c.name === className,
		);
		const classLevel = progressionClass?.levels || 0;

		if (classLevel === 0) {
			this.hide();
			return;
		}

		const spellChoices = this._getSpellChoicesForLevels(className, classLevel);

		const pendingLevels = spellChoices.filter(
			(choice) => choice.cantrips > 0 || choice.spells > 0,
		);

		if (pendingLevels.length === 0) {
			this.hide();
			return;
		}

		const container = document.getElementById('spellNotificationSection');
		if (!container) return;

		const classSpellcasting = character.spellcasting?.classes?.[className];
		const existingSpells = classSpellcasting?.spellsKnown || [];

		let cardsHTML = '';
		for (const choice of pendingLevels) {
			const sessionKey = `${className}_${choice.level}`;
			const levelSpells =
				character.progression?.spellSelections?.[sessionKey] || [];

			const selectedCantrips = levelSpells.filter((s) => {
				const spell = existingSpells.find((es) => es.name === s);
				return spell && spell.level === 0;
			});
			const selectedLeveledSpells = levelSpells.filter((s) => {
				const spell = existingSpells.find((es) => es.name === s);
				return spell && spell.level > 0;
			});

			const badges = [];
			if (choice.cantrips > 0) {
				const cantripCount = selectedCantrips.length;
				const cantripClass =
					cantripCount === choice.cantrips
						? 'bg-success'
						: cantripCount > choice.cantrips
							? 'bg-danger'
							: '';
				badges.push(
					`<span class="badge me-1 ${cantripClass} ${!cantripClass ? 'u-bg-accent' : ''}">Cantrips ${cantripCount}/${choice.cantrips}</span>`,
				);
			}
			if (choice.spells > 0) {
				const maxSpellLevel = this._classService.getMaxSpellLevel(
					className,
					choice.level,
				);
				const spellCount = selectedLeveledSpells.length;
				const spellClass =
					spellCount === choice.spells
						? 'bg-success'
						: spellCount > choice.spells
							? 'bg-danger'
							: '';
				const spellLevelName = SPELL_LEVEL_ORDINALS[maxSpellLevel] || 'level';
				badges.push(
					`<span class="badge ${spellClass} ${!spellClass ? 'u-bg-accent' : ''}">${spellLevelName} ${spellCount}/${choice.spells}</span>`,
				);
			}
			const badgeDisplay = badges.join('');

			let selectedDisplay = 'None selected';
			if (levelSpells.length > 0) {
				selectedDisplay = levelSpells.join(', ');
			}

			cardsHTML += `
				<div class="card mb-3">
					<div class="card-header d-flex justify-content-between align-items-center">
						<div>
							<h6 class="mb-0"><i class="fas fa-hat-wizard"></i> Spell Selection</h6>
							<small class="text-muted">Level ${choice.level}</small>
						</div>
						<div>
							${badgeDisplay}
						</div>
					</div>
					<div class="card-body">
						<div class="d-flex justify-content-between align-items-center">
							<div class="flex-grow-1">
								<div class="text-muted small">
									<strong>Selected:</strong> ${selectedDisplay}
								</div>
							</div>
							<button class="btn btn-primary btn-sm ms-2" data-spell-select-level="${choice.level}" data-spell-select-class="${className}">
								<i class="fas fa-list"></i> Choose
							</button>
						</div>
					</div>
				</div>
			`;
		}

		container.innerHTML = cardsHTML;
		container.classList.remove('u-hidden');

		const spellButtons = container.querySelectorAll(
			'[data-spell-select-level]',
		);
		for (const button of spellButtons) {
			this._cleanup.on(button, 'click', () => {
				const level = parseInt(button.dataset.spellSelectLevel, 10);
				const cls = button.dataset.spellSelectClass;
				this.handleSelection(cls, level);
			});
		}
	}

	_getSpellChoicesForLevels(className, classLevel) {
		const classData = this._classService.getClass(className);
		if (!classData) return [];

		const choices = [];

		for (let level = 1; level <= classLevel; level++) {
			const cantripsAtLevel = spellSelectionService.getCantripsKnown(
				className,
				level,
			);
			const cantripsAtPrevLevel =
				level > 1
					? spellSelectionService.getCantripsKnown(className, level - 1)
					: 0;
			const newCantrips = cantripsAtLevel - cantripsAtPrevLevel;

			let newSpells = 0;

			if (classData.spellsKnownProgressionFixed) {
				const index = Math.max(
					0,
					Math.min(level - 1, classData.spellsKnownProgressionFixed.length - 1),
				);
				newSpells = classData.spellsKnownProgressionFixed[index] || 0;
			} else if (classData.spellsKnownProgression) {
				const spellsAtLevel = spellSelectionService.getSpellsKnownLimit(
					className,
					level,
				);
				const spellsAtPrevLevel =
					level > 1
						? spellSelectionService.getSpellsKnownLimit(className, level - 1)
						: 0;
				newSpells = spellsAtLevel - spellsAtPrevLevel;
			}

			if (newCantrips > 0 || newSpells > 0) {
				choices.push({
					level,
					cantrips: newCantrips,
					spells: newSpells,
					maxSpellLevel: this._classService.getMaxSpellLevel(className, level),
				});
			}
		}

		return choices;
	}

	async handleSelection(className, level) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) {
			console.warn(
				'[ClassSpellNotificationController]',
				'No character found for spell selection',
			);
			return;
		}

		const sessionKey = `${className}_${level}`;

		let existingSelections =
			character.progression?.spellSelections?.[sessionKey] || [];

		if (existingSelections.length === 0 && level === 1) {
			const classSpells =
				character.spellcasting?.classes?.[className]?.spellsKnown || [];
			existingSelections = classSpells.map((spell) =>
				typeof spell === 'string' ? spell : spell.name,
			);
		}

		const mockSession = {
			originalCharacter: character,
			stagedChanges: character,
			stepData: {
				selectedSpells: {
					[sessionKey]: [...existingSelections],
				},
			},
		};

		const spellSelector = new ClassSpellSelectorModal(
			mockSession,
			this,
			className,
			level,
		);

		try {
			await spellSelector.show();
		} catch (error) {
			console.error(
				'[ClassSpellNotificationController]',
				'Error in spell selection:',
				error,
			);
		}
	}

	async updateSpellSelection(className, level, selectedSpells) {
		const character = CharacterManager.getCurrentCharacter();
		if (!character) {
			console.warn(
				'[ClassSpellNotificationController]',
				'No character found for updateSpellSelection',
			);
			return;
		}

		if (!character.spellcasting?.classes?.[className]) {
			const classLevel =
				character.progression.classes.find((c) => c.name === className)
					?.levels || level;
			spellSelectionService.initializeSpellcastingForClass(
				character,
				className,
				classLevel,
			);
		}

		const previousSelections = spellSelectionService.getSpellSelections(
			character,
			className,
			level,
		);

		for (const prevSpellName of previousSelections) {
			const stillSelected = selectedSpells.some(
				(s) => s.name === prevSpellName,
			);
			if (!stillSelected) {
				spellSelectionService.removeKnownSpell(
					character,
					className,
					prevSpellName,
				);
			}
		}

		for (const spell of selectedSpells) {
			const alreadyKnown = character.spellcasting.classes[
				className
			].spellsKnown.some((s) => s.name === spell.name);

			if (!alreadyKnown) {
				spellSelectionService.addKnownSpell(character, className, spell);
			}
		}

		spellSelectionService.recordSpellSelections(
			character,
			className,
			level,
			selectedSpells.map((s) => s.name),
		);

		eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });

		this.render(className);
	}

	hide() {
		const container = document.getElementById('spellNotificationSection');
		if (container) {
			container.classList.add('u-hidden');
			container.innerHTML = '';
		}
	}

	renderChoice(choice, className) {
		const character = CharacterManager.getCurrentCharacter();

		const sessionKey = `${className}_${choice.level}`;
		let levelSpells =
			character.progression?.spellSelections?.[sessionKey] || [];

		if (levelSpells.length === 0 && choice.level === 1) {
			const classSpells =
				character.spellcasting?.classes?.[className]?.spellsKnown || [];
			levelSpells = classSpells.map((spell) =>
				typeof spell === 'string' ? spell : spell.name,
			);
		}

		let selectedDisplay = 'None selected';
		if (levelSpells.length > 0) {
			selectedDisplay = levelSpells.join(', ');
		}

		const isComplete = levelSpells.length > 0;

		const spellsAttr =
			levelSpells.length > 0
				? `data-hover-spells="${encodeURIComponent(JSON.stringify(levelSpells))}"`
				: '';

		return `
			<div class="choice-item border-bottom pb-2 mb-2" data-choice-card="${choice.id}"
				data-hover-type="spell" data-hover-class="${className}" data-hover-level="${choice.level}" ${spellsAttr}>
				<div class="d-flex justify-content-between align-items-start">
					<div class="flex-grow-1">
						<div class="d-flex align-items-center mb-1">
							<strong><i class="fas fa-hat-wizard"></i> Spell Selection</strong>
							${isComplete ? '<i class="fas fa-check-circle text-success ms-2"></i>' : ''}
						</div>
						<div class="text-muted small">
							${selectedDisplay}
						</div>
					</div>
					<button 
						class="btn btn-sm btn-outline-primary" 
						data-spell-select-level="${choice.level}" 
						data-spell-select-class="${className}">
						<i class="fas fa-list"></i> ${isComplete ? 'Change' : 'Choose'}
					</button>
				</div>
			</div>
		`;
	}
}
