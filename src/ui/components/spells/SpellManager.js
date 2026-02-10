// Component for managing the Spells page

import { AppState } from '../../../app/AppState.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { levelUpService } from '../../../services/LevelUpService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { PreparedSpellSelectorModal } from './PreparedSpellSelectorModal.js';
import { SpellSelectorModal } from './SpellSelectorModal.js';

export class SpellsManager {
	constructor() {
		this.loggerScope = 'SpellsManager';
		this.spellSelectorModal = null;
		this.preparedSpellSelectorModal = null;
		this._cleanup = DOMCleanup.create();
		this.setupEventListeners();
	}

	setupEventListeners() {
		// Event delegation for buttons
		this._cleanup.on(document, 'click', (e) => {
			const addSpellBtn = e.target.closest('#addSpellBtn');
			if (addSpellBtn) {
				this.handleAddSpell();
				return;
			}

			const prepareSpellsBtn = e.target.closest('#prepareSpellsBtn');
			if (prepareSpellsBtn) {
				this.handlePrepareSpells();
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
	}

	_ensureSpellcastingInitialized(character) {
		// Initialize spellcasting for each class in progression that is a spellcaster
		if (!character.progression?.classes) return;

		for (const classEntry of character.progression.classes) {
			const className = classEntry.name;
			const classLevel = classEntry.levels || 1;

			// Check if spellcasting is already initialized for this class
			if (character.spellcasting?.classes?.[className]) continue;

			// Initialize spellcasting for this class (returns null for non-casters)
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
		const preparedClasses = new Set(this._getPreparedSpellClasses(character));
		let html = '';

		for (const className of classNames) {
			const classData = spellcasting.classes[className];
			if (!classData || !classData.spellsKnown) continue;

			html += `<div class="spell-class-group" data-class="${className}" data-multiclass="${isMulticlass}">`;

			// Get spell limit info for this class
			const classEntry = character.progression?.classes?.find(
				(c) => c.name === className,
			);
			const classLevel = classEntry?.levels || classData.level || 1;
			const limitInfo = spellSelectionService.getSpellLimitInfo(
				character,
				className,
				classLevel,
			);
			const isPreparedCaster = preparedClasses.has(className);
			const preparedCount = classData.spellsPrepared?.length || 0;
			const preparedMax = limitInfo?.limit || 0;

			// Add class header (if multiclass or has limit) - spans all columns
			if (isMulticlass || limitInfo.limit > 0) {
				html += `<div class="spell-class-divider" data-class="${className}">
                    <button class="spell-class-header" data-toggle-spells="${className}">
                        <span class="spell-class-name">${className}</span>
                        ${isPreparedCaster && preparedMax > 0
						? `<span class="spell-class-prepared-count">Prepared: ${preparedCount}/${preparedMax}</span>`
						: ''
					}
                        <span class="spell-class-count">Total: ${classData.spellsKnown.length}</span>
                        <i class="fas fa-chevron-down toggle-icon"></i>
                    </button>
                </div>`;
			}

			html += '<div class="spell-class-levels">';

			// Group spells by level
			const spellsByLevel = {};
			for (const spell of classData.spellsKnown) {
				const level = spell.level || 0;
				if (!spellsByLevel[level]) {
					spellsByLevel[level] = [];
				}
				spellsByLevel[level].push(spell);
			}

			// Get column count based on viewport
			const columnCount = this._getColumnCount();

			// Group levels into rows and find max per row
			const levelArray = [];
			for (let level = 0; level <= 9; level++) {
				const spells = spellsByLevel[level] || [];
				if (spells.length > 0) {
					levelArray.push({ level, spells });
				}
			}

			// Calculate max spells per row
			const rowMaxCounts = [];
			for (let i = 0; i < levelArray.length; i += columnCount) {
				const rowLevels = levelArray.slice(i, i + columnCount);
				const maxInRow = Math.max(...rowLevels.map(l => l.spells.length));
				rowMaxCounts.push(maxInRow);
			}

			// Render spells by level in compact list format
			let levelIndex = 0;
			for (let level = 0; level <= 9; level++) {
				const spells = spellsByLevel[level] || [];
				if (spells.length === 0) continue;

				const rowIndex = Math.floor(levelIndex / columnCount);
				const maxForThisRow = rowMaxCounts[rowIndex] || 0;

				html += `<div class="spell-level-section" data-level="${level}">
					<div class="spell-level-label">${this._getLevelLabel(level)} (${spells.length})</div>
					<div class="spell-items-list">`;

				for (const spell of spells) {
					// Cantrips are always prepared
					// Known spells (Sorcerer, Bard, Warlock) are always available
					const isCantrip = level === 0;
					const knownSpellClasses = ['Sorcerer', 'Bard', 'Warlock'];
					const isKnownSpellClass = knownSpellClasses.includes(className);
					const isPrepared =
						isCantrip ||
						isKnownSpellClass ||
						classData.spellsPrepared?.some((s) => s.name === spell.name) ||
						false;

					const spellSource = spell.source || 'PHB';
					const ritualClass = spell.ritual ? 'is-ritual' : '';
					const concentrationClass = spell.concentration ? 'is-concentration' : '';
					const preparedClass = isPrepared ? 'is-prepared' : '';

					html += `<div class="spell-item-compact ${ritualClass} ${concentrationClass} ${preparedClass}">
						<a href="#" class="spell-item-name reference-link" 
							data-hover-type="spell" 
							data-hover-name="${spell.name}" 
							data-hover-source="${spellSource}">${spell.name}</a>
						<div class="spell-item-actions">
							${spell.ritual ? '<i class="fas fa-ring text-info" title="Ritual"></i>' : ''}
							${spell.concentration ? '<i class="fas fa-hourglass-half text-warning" title="Concentration"></i>' : ''}
							<button class="btn-spell-remove" data-remove-spell="${spell.name}" data-class-name="${className}" title="Remove">
								<i class="fas fa-xmark"></i>
							</button>
						</div>
					</div>`;
				}

				// Add empty filler items to match tallest column in this row only
				const fillersNeeded = maxForThisRow - spells.length;
				for (let i = 0; i < fillersNeeded; i++) {
					html += `<div class="spell-item-filler"></div>`;
				}

				html += `</div></div>`;
				levelIndex++;
			}

			html += '</div></div>';
		}

		if (html === '') {
			html =
				'<p class="text-muted px-2 py-2">No known spells. Click "Add Spell" to select spells.</p>';
		}

		container.innerHTML = html;
		this._setupSpellClassToggle();
	}

	_setupSpellClassToggle() {
		document.querySelectorAll('[data-toggle-spells]').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				const group = btn.closest('.spell-class-group');
				if (!group) return;
				const isCollapsed = btn.classList.toggle('collapsed');
				group.classList.toggle('collapsed', isCollapsed);
				group.classList.toggle('expanded', !isCollapsed);
			});

			// Set initial state: expanded for single class, collapsed for multiclass
			const group = btn.closest('.spell-class-group');
			if (group) {
				const isMulticlass = group.dataset.multiclass === 'true';
				if (isMulticlass) {
					// Multiclass: start collapsed
					btn.classList.add('collapsed');
					group.classList.add('collapsed');
				} else {
					// Single class: start expanded
					group.classList.add('expanded');
				}
			}
		});
	}

	renderPreparedSpells(character) {
		const preparedClasses = this._getPreparedSpellClasses(character);
		let hasKnownPreparedSpells = false;

		for (const className of preparedClasses) {
			const classData = character.spellcasting?.classes?.[className];
			if (!classData) continue;

			const knownSpells = classData.spellsKnown || [];
			if (knownSpells.length > 0) {
				hasKnownPreparedSpells = true;
				break;
			}
		}

		const prepareSpellsBtn = document.getElementById('prepareSpellsBtn');
		if (prepareSpellsBtn) {
			prepareSpellsBtn.disabled =
				preparedClasses.length === 0 || !hasKnownPreparedSpells;
		}
	}

	renderSpellcastingInfo(character) {
		const container = document.getElementById('spellcastingInfo');
		if (!container) return;

		const spellcasting = character.spellcasting;
		const classNames = Object.keys(spellcasting?.classes || {});

		if (classNames.length === 0) {
			container.innerHTML =
				'<p class="text-muted px-2 py-1">No spellcasting ability.</p>';
			return;
		}

		let html = '<div class="spellcasting-info"><div class="spellcasting-classes-grid">';

		for (const className of classNames) {
			const classSpellcasting = spellcasting.classes[className];

			if (className === 'Bonus') {
				html += `<div class="spellcasting-class-info">
					<h6>Bonus Spells</h6>
					<p class="bonus-spell-note text-muted mb-0"><i class="fas fa-circle-info"></i> Spell save DC, spell attack bonus, and spellcasting ability vary depending on the source of each spell (item, feat, racial trait, etc.).</p>
				</div>`;
				continue;
			}

			const ability =
				classSpellcasting?.spellcastingAbility ||
				this._getSpellcastingAbility(className);
			const abilityMod = character.getAbilityModifier(ability);
			const proficiencyBonus = character.getProficiencyBonus?.() || 2;
			const spellSaveDC = 8 + abilityMod + proficiencyBonus;
			const spellAttack = abilityMod + proficiencyBonus;

			html += `<div class="spellcasting-class-info">
				<h6>${className}</h6>
				<div class="spellcasting-stats-grid">
					<div class="spellcasting-stat-item">
						<div class="stat-label">Spell Save DC</div>
						<div class="stat-value">${spellSaveDC}</div>
					</div>
					<div class="spellcasting-stat-item">
						<div class="stat-label">Spell Attack</div>
						<div class="stat-value">+${spellAttack}</div>
					</div>
					<div class="spellcasting-stat-item">
						<div class="stat-label">Spellcasting Ability</div>
						<div class="stat-value">${this._formatAbilityName(ability)} (${abilityMod >= 0 ? '+' : ''}${abilityMod})</div>
					</div>
				</div>
			</div>`;
		}

		// Add spell slots - recalculate from class level to ensure accuracy
		const isMulticlass = classNames.length > 1;
		let slotsToDisplay = null;

		if (isMulticlass) {
			// Use combined multiclass slots
			slotsToDisplay = levelUpService.calculateMulticlassSpellSlots(character);
		} else if (classNames.length === 1) {
			// Recalculate spell slots based on current class level
			const className = classNames[0];
			const classEntry = character.progression?.classes?.find(c => c.name === className);
			if (classEntry) {
				slotsToDisplay = spellSelectionService.calculateSpellSlots(className, classEntry.levels || 1);
			}
		}

		if (slotsToDisplay && Object.keys(slotsToDisplay).length > 0) {
			html += '<div class="spellcasting-class-info">';
			html += `<h6>${isMulticlass ? 'Combined Spell Slots' : 'Spell Slots'}</h6>`;
			html += '<div class="spellcasting-slots-grid">';
			for (let level = 1; level <= 9; level++) {
				const slotData = slotsToDisplay[level];
				if (!slotData) continue;
				const levelLabel = this._getLevelLabel(level).replace(' Level', '');
				html += `<span class="badge" title="${this._getLevelLabel(level)} slots">${levelLabel} Slots: ${slotData.max}</span>`;
			}
			html += '</div></div>';
		}

		html += '</div></div>';
		container.innerHTML = html;
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
			if (!this.spellSelectorModal) {
				this.spellSelectorModal = new SpellSelectorModal({
					className,
					initialSpells: knownSpells,
				});
			} else {
				// Update class name and initial spells for existing modal
				this.spellSelectorModal.className = className;
				this.spellSelectorModal.initialSpells = knownSpells;
			}

			const result = await this.spellSelectorModal.show();
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

	async handlePrepareSpells() {
		const character = AppState.getCurrentCharacter();
		if (!character) {
			showNotification('No character selected', 'error');
			return;
		}

		const preparedClasses = this._getPreparedSpellClasses(character);
		if (preparedClasses.length === 0) {
			showNotification('No prepared spell classes available', 'warning');
			return;
		}

		try {
			if (!this.preparedSpellSelectorModal) {
				this.preparedSpellSelectorModal =
					new PreparedSpellSelectorModal({ classNames: preparedClasses });
			} else {
				this.preparedSpellSelectorModal.classNames = preparedClasses;
			}

			await this.preparedSpellSelectorModal.show();
		} catch (error) {
			console.error(`[${this.loggerScope}]`, 'Prepare modal error', error);
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
			if (!classData) continue;

			// Remove from known spells
			const knownIndex = classData.spellsKnown?.findIndex(
				(s) => s.name === spellName,
			);
			if (knownIndex !== -1) {
				classData.spellsKnown.splice(knownIndex, 1);
				// Also remove from prepared if present
				const preparedIndex = classData.spellsPrepared?.findIndex(
					(s) => s.name === spellName,
				);
				if (preparedIndex !== -1) {
					classData.spellsPrepared.splice(preparedIndex, 1);
				}
				break; // Spell found and removed, no need to check other classes
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
				// Cantrips cannot be unprepared - they're always prepared
				if (knownSpell.level === 0) {
					showNotification(`${spellName} is a cantrip and is always prepared`, 'info');
					break;
				}

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

	_getPreparedSpellClasses(character) {
		const classNames = Object.keys(character?.spellcasting?.classes || {});
		return classNames.filter((className) => {
			const classData = character.spellcasting.classes[className];
			const classLevel = classData?.level || 1;
			const limitInfo = spellSelectionService.getSpellLimitInfo(
				character,
				className,
				classLevel,
			);
			return limitInfo?.type === 'prepared';
		});
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

	_getColumnCount() {
		const width = window.innerWidth;
		if (width >= 1600) return 4;
		if (width >= 1200) return 3;
		if (width >= 900) return 2;
		return 1;
	}

	cleanup() {
		this._cleanup.cleanup();
		console.debug(`[${this.loggerScope}]`, 'Cleanup complete');
	}
}
