// Component for managing the Spells page

import { AppState } from '../../../app/AppState.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { levelUpService } from '../../../services/LevelUpService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { SpellSelectionModal } from './SpellSelectionModal.js';

export class SpellsManager {
	constructor() {
		this.loggerScope = 'SpellsManager';
		this.spellSelectionModal = null;
		this.setupEventListeners();
	}

	setupEventListeners() {
		// Event delegation for buttons
		document.addEventListener('click', (e) => {
			const addSpellBtn = e.target.closest('#addSpellBtn');
			if (addSpellBtn) {
				this.handleAddSpell();
				return;
			}

			// Handle spell removal
			const removeSpellBtn = e.target.closest('[data-remove-spell]');
			if (removeSpellBtn) {
				const spellName = removeSpellBtn.dataset.removeSpell;
				const className = removeSpellBtn.dataset.className;
				this.handleRemoveSpell(spellName, className);
				return;
			}

			// Handle spell preparation toggle
			const prepareToggle = e.target.closest('[data-prepare-spell]');
			if (prepareToggle) {
				const spellName = prepareToggle.dataset.prepareSpell;
				const className = prepareToggle.dataset.className;
				this.handleTogglePrepareSpell(spellName, className);
				return;
			}
		});

		console.debug(`[${this.loggerScope}]`, 'Event listeners setup');
	}

	render() {
		const character = AppState.getCurrentCharacter();
		if (!character) {
			console.warn(`[${this.loggerScope}]`, 'No character selected');
			return;
		}

		console.debug(`[${this.loggerScope}]`, 'Rendering spells page');

		// Ensure progression and spellcasting are initialized before rendering
		levelUpService.initializeProgression(character);
		this._ensureSpellcastingInitialized(character);

		this.renderKnownSpells(character);
		this.renderPreparedSpells(character);
		this.renderSpellcastingInfo(character);
		this.renderMulticlassSpellcasting(character);
	}

	_ensureSpellcastingInitialized(character) {
		// Initialize spellcasting for each class in progression that is a spellcaster
		if (!character.progression?.classes) return;

		for (const classEntry of character.progression.classes) {
			const className = classEntry.name;
			const classLevel = classEntry.levels || 1;

			// Check if spellcasting is already initialized for this class
			if (character.spellcasting?.classes?.[className]) continue;

			// Initialize spellcasting for this class if it's a spellcaster
			spellSelectionService.initializeSpellcastingForClass(
				character,
				className,
				classLevel,
			);
		}
	}

	renderKnownSpells(character) {
		const container = document.getElementById('knownSpellsList');
		if (!container) return;

		const spellcasting = character.spellcasting;
		const classNames = Object.keys(spellcasting?.classes || {});
		const isMulticlass = classNames.length > 1;
		let html = '';

		for (const className of classNames) {
			const classData = spellcasting.classes[className];
			if (!classData || !classData.spellsKnown) continue;

			// Get spell limit info for this class
			const classLevel = classData.level || 1;
			const limitInfo = spellSelectionService.getSpellLimitInfo(
				character,
				className,
				classLevel,
			);

			// Add class header with spell limit (if multiclass or has limit)
			if (isMulticlass || limitInfo.limit > 0) {
				html += `<div class="class-spell-section mb-4">
                    <h5 class="mb-2">${className}</h5>`;
			}

			// Group spells by level
			const spellsByLevel = {};
			for (const spell of classData.spellsKnown) {
				const level = spell.level || 0;
				if (!spellsByLevel[level]) {
					spellsByLevel[level] = [];
				}
				spellsByLevel[level].push(spell);
			}

			// Render spells by level
			for (let level = 0; level <= 9; level++) {
				const spells = spellsByLevel[level] || [];
				if (spells.length === 0) continue;

				html += `<div class="spell-level-group mb-3">
					<h6 class="mb-2">${this._getLevelLabel(level)}</h6>
					<div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-2">`;

				for (const spell of spells) {
					const isPrepared =
						classData.spellsPrepared?.some((s) => s.name === spell.name) ||
						false;

					const spellSource = spell.source || 'PHB';

					html += `<div class="col">
						<div class="spell-item card card-sm h-100">
							<div class="card-body py-1 px-2 d-flex justify-content-between align-items-center">
								<div class="spell-info flex-grow-1">
									<h6 class="mb-0">
										<a href="#" class="reference-link text-decoration-none" 
											data-hover-type="spell" 
											data-hover-name="${spell.name}" 
											data-hover-source="${spellSource}">${spell.name}</a>
									</h6>
									<div class="mt-1">
										${spell.ritual ? '<span class="badge bg-info">Ritual</span>' : ''}
										${spell.concentration ? '<span class="badge bg-warning ms-1">Concentration</span>' : ''}
										${isPrepared ? '<span class="badge bg-success ms-1">Prepared</span>' : ''}
									</div>
								</div>
								<div class="spell-actions ms-2">
									<button class="btn btn-sm btn-outline-danger" data-remove-spell="${spell.name}" data-class-name="${className}" title="Remove spell">
										<i class="fas fa-trash"></i>
									</button>
								</div>
							</div>
						</div>
					</div>`;
				}

				html += `</div></div>`;
			}

			// Close class section if we added one
			if (isMulticlass || limitInfo.limit > 0) {
				html += `</div>`;
			}
		}

		if (html === '') {
			html =
				'<p class="text-muted">No known spells. Click "Add Spell" to select spells.</p>';
		}

		container.innerHTML = html;
	}

	renderPreparedSpells(character) {
		const container = document.getElementById('preparedSpellsList');
		const section = document.getElementById('preparedSpellsSection');
		if (!container || !section) return;

		const spellcasting = character.spellcasting;
		const classNames = Object.keys(spellcasting?.classes || {});
		const preparedSpellClasses = [
			'Cleric',
			'Druid',
			'Paladin',
			'Ranger',
			'Wizard',
		];

		let html = '';
		let totalPrepared = 0;
		let totalLimit = 0;

		for (const className of classNames) {
			if (!preparedSpellClasses.includes(className)) continue;

			const classData = spellcasting.classes[className];
			if (!classData?.spellsPrepared) continue;

			for (const spell of classData.spellsPrepared) {
				totalPrepared++;
				html += `<div class="spell-item card card-sm mb-2">
					<div class="card-body d-flex justify-content-between align-items-center">
						<div>
							<h6 class="mb-1">${spell.name}</h6>
							<small class="text-muted">${className}</small>
						</div>
						<button class="btn btn-sm btn-outline-danger" data-prepare-spell="${spell.name}" data-class-name="${className}">
							<i class="fas fa-times"></i>
						</button>
					</div>
				</div>`;
			}

			// Calculate prepared spell limit for this class using the service
			const classLevel = classData.level || 1;
			const preparedLimit = spellSelectionService._getPreparedSpellLimit(
				character,
				className,
				classLevel,
			);
			totalLimit += preparedLimit;
		}

		if (html === '') {
			html = '<p class="text-muted">No prepared spells.</p>';
		}

		const preparedLimit = document.getElementById('preparedSpellsLimit');
		if (preparedLimit) {
			preparedLimit.textContent = `${totalPrepared} / ${totalLimit} prepared`;
		}

		container.innerHTML = html;
		section.style.display =
			totalPrepared > 0 || totalLimit > 0 ? 'block' : 'none';
	}

	renderSpellcastingInfo(character) {
		const container = document.getElementById('spellcastingInfo');
		if (!container) return;

		const spellcasting = character.spellcasting;
		const classNames = Object.keys(spellcasting?.classes || {});

		let html = '';

		for (const className of classNames) {
			const classData = spellcasting.classes[className];
			const ability = this._getSpellcastingAbility(className);
			const abilityMod = character.getAbilityModifier(ability);
			const proficiencyBonus = character.getProficiencyBonus?.() || 2;
			const spellSaveDC = 8 + abilityMod + proficiencyBonus;

			html += `<div class="spellcasting-class-info">
				<h6>${className}</h6>
				<div class="spellcasting-stats-grid">
					<div class="spellcasting-stat-item">
						<div class="stat-label">Spellcasting Ability</div>
						<div class="stat-value">${this._formatAbilityName(ability)}</div>
					</div>
					<div class="spellcasting-stat-item">
						<div class="stat-label">Spell Save DC</div>
						<div class="stat-value">${spellSaveDC}</div>
					</div>
					<div class="spellcasting-stat-item">
						<div class="stat-label">Spell Attack</div>
						<div class="stat-value">+${abilityMod + proficiencyBonus}</div>
					</div>
				</div>`;

			// Add spell slots information
			if (
				classData?.spellSlots &&
				Object.keys(classData.spellSlots).length > 0
			) {
				html += `<div class="mt-3">
					<div class="stat-label mb-2">Spell Slots</div>
					<div class="spellcasting-slots-grid">`;

				for (let level = 1; level <= 9; level++) {
					const slotData = classData.spellSlots[level];
					if (!slotData) continue;

					html += `<div class="badge bg-secondary">
						${this._getLevelLabel(level)}: ${slotData.max}
					</div>`;
				}

				html += `</div></div>`;
			}

			html += `</div>`;
		}

		container.innerHTML =
			html ||
			'<p class="text-muted">No spellcasting ability.</p>';
	}

	renderMulticlassSpellcasting(character) {
		const container = document.getElementById('multiclassSpellsList');
		const section = document.getElementById('multiclassSpellsSection');
		if (!container || !section) return;

		const spellcasting = character.spellcasting;
		const classCount = Object.keys(spellcasting?.classes || {}).length;

		if (classCount <= 1) {
			section.style.display = 'none';
			return;
		}

		let html =
			'<p class="text-info mb-3">Multiclass spellcasting rules apply. Spell slots are combined across classes.</p>';

		const multiclassSlots = spellcasting?.multiclass || {};
		if (Object.keys(multiclassSlots).length > 0) {
			html += '<div class="multiclass-slots">';
			for (let level = 1; level <= 9; level++) {
				const slots = multiclassSlots[level];
				if (!slots) continue;

				html += `<div class="mb-2">
					<small class="text-muted">${this._getLevelLabel(level)}:</small>
					<strong>${slots.current} / ${slots.max}</strong>
				</div>`;
			}
			html += '</div>';
		}

		container.innerHTML = html;
		section.style.display = 'block';
	}

	async handleAddSpell() {
		const character = AppState.getCurrentCharacter();
		if (!character) {
			showNotification('No character selected', 'error');
			return;
		}

		// Determine which class to add spells for
		const primaryClass = character.getPrimaryClass();
		const className = primaryClass?.name || 'Wizard';

		// Get currently known spells for this class to pre-select them
		const classSpellcasting = character.spellcasting?.classes?.[className];
		const knownSpells = classSpellcasting?.spellsKnown || [];

		try {
			if (!this.spellSelectionModal) {
				this.spellSelectionModal = new SpellSelectionModal({
					className,
					initialSpells: knownSpells,
				});
			} else {
				// Update class name and initial spells for existing modal
				this.spellSelectionModal.className = className;
				this.spellSelectionModal.initialSpells = knownSpells;
			}

			const result = await this.spellSelectionModal.show();
			if (result) {
				console.debug(`[${this.loggerScope}]`, 'Spells added', {
					count: result.successCount,
					className: result.className,
				});
			}
		} catch (error) {
			console.error(`[${this.loggerScope}]`, 'Modal error', error);
			// Don't show notification here - modal handles its own notifications
		}
	}

	handleRemoveSpell(spellName, className = null) {
		const character = AppState.getCurrentCharacter();
		if (!character) {
			showNotification('No character selected', 'error');
			return;
		}

		const spellcasting = character.spellcasting;
		const classesToCheck = className
			? [className]
			: Object.keys(spellcasting?.classes || {});

		for (const cls of classesToCheck) {
			const classData = spellcasting.classes[cls];

			// Remove from known spells
			const knownIndex = classData.spellsKnown?.findIndex(
				(s) => s.name === spellName,
			);
			if (knownIndex !== -1) {
				classData.spellsKnown.splice(knownIndex, 1);
			}

			// Remove from prepared spells
			const preparedIndex = classData.spellsPrepared?.findIndex(
				(s) => s.name === spellName,
			);
			if (preparedIndex !== -1) {
				classData.spellsPrepared.splice(preparedIndex, 1);
			}
		}

		eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
	}

	handleTogglePrepareSpell(spellName, className = null) {
		const character = AppState.getCurrentCharacter();
		if (!character) {
			showNotification('No character selected', 'error');
			return;
		}

		const spellcasting = character.spellcasting;
		const classesToCheck = className
			? [className]
			: Object.keys(spellcasting?.classes || {});

		for (const cls of classesToCheck) {
			const classData = spellcasting.classes[cls];
			const knownSpell = classData.spellsKnown?.find(
				(s) => s.name === spellName,
			);

			if (knownSpell) {
				const isPrepared =
					classData.spellsPrepared?.some((s) => s.name === spellName) || false;

				if (isPrepared) {
					const idx = classData.spellsPrepared.findIndex(
						(s) => s.name === spellName,
					);
					classData.spellsPrepared.splice(idx, 1);
					eventBus.emit(EVENTS.SPELL_UNPREPARED, character, cls, spellName);
				} else {
					classData.spellsPrepared.push(knownSpell);
					eventBus.emit(EVENTS.SPELL_PREPARED, character, cls, spellName);
				}

				showNotification(
					`${isPrepared ? 'Unprepared' : 'Prepared'} ${spellName}`,
					'success',
				);
				break;
			}
		}

		eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
	}

	_getSpellcastingAbility(className) {
		const abilityMap = {
			Bard: 'charisma',
			Cleric: 'wisdom',
			Druid: 'wisdom',
			Paladin: 'charisma',
			Ranger: 'wisdom',
			Sorcerer: 'charisma',
			Warlock: 'charisma',
			Wizard: 'intelligence',
		};

		return abilityMap[className] || 'wisdom';
	}

	_formatAbilityName(ability) {
		return ability.charAt(0).toUpperCase() + ability.slice(1);
	}

	_getLevelLabel(level) {
		if (level === 0) return 'Cantrips';
		const suffixes = ['', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'];
		return `${level}${suffixes[level]} Level`;
	}
}
