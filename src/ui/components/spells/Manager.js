// Component for managing the Spells page

import { AppState } from '../../../app/AppState.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { levelUpService } from '../../../services/LevelUpService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { UniversalSpellModal } from './UniversalSpellModal.js';

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

        console.info(`[${this.loggerScope}]`, 'Rendering spells page');

        // Ensure progression and spellcasting are initialized before rendering
        levelUpService.initializeProgression(character);

        this.renderKnownSpells(character);
        this.renderPreparedSpells(character);
        this.renderSpellcastingInfo(character);
        this.renderMulticlassSpellcasting(character);
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
					<div class="spell-list">`;

                for (const spell of spells) {
                    const isPrepared =
                        classData.spellsPrepared?.some((s) => s.name === spell.name) ||
                        false;

                    const prepareBtn =
                        level > 0
                            ? `<button class="btn btn-sm btn-outline-secondary" data-prepare-spell="${spell.name}" data-class-name="${className}" title="${isPrepared ? 'Unprepare' : 'Prepare'}">
						<i class="fas fa-check${isPrepared ? '' : '-circle'}"></i>
					</button>`
                            : '';

                    html += `<div class="spell-item card card-sm mb-2">
						<div class="card-body d-flex justify-content-between align-items-center">
							<div class="spell-info">
								<h6 class="mb-1">${spell.name}</h6>
								<small class="text-muted">${spell.school || 'Abjuration'}</small>
								${spell.ritual ? '<span class="badge bg-info ms-2">Ritual</span>' : ''}
								${spell.concentration ? '<span class="badge bg-warning ms-1">Concentration</span>' : ''}
							</div>
							<div class="spell-actions">
								${prepareBtn}
								<button class="btn btn-sm btn-outline-danger" data-remove-spell="${spell.name}" data-class-name="${className}" title="Remove spell">
									<i class="fas fa-trash"></i>
								</button>
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

            // Calculate prepared spell limit for this class
            const ability = this._getSpellcastingAbility(className);
            const abilityMod = character.getAbilityModifier(ability);
            const classLevel = classData.level || 1;
            totalLimit += Math.max(1, classLevel + abilityMod);
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

            html += `<div class="spellcasting-class-info mb-3 p-3 bg-light rounded">
				<h6 class="mb-3">${className}</h6>
				<div class="row g-3">
					<div class="col-md-6">
						<small class="d-block text-muted mb-1">Spellcasting Ability</small>
						<strong>${this._formatAbilityName(ability)} (${abilityMod > 0 ? '+' : ''}${abilityMod})</strong>
					</div>
					<div class="col-md-6">
						<small class="d-block text-muted mb-1">Spell Save DC</small>
						<strong>${spellSaveDC}</strong>
					</div>
					<div class="col-md-6">
						<small class="d-block text-muted mb-1">Spell Attack Bonus</small>
						<strong>+${abilityMod + proficiencyBonus}</strong>
					</div>
					<div class="col-md-6">
						<small class="d-block text-muted mb-1">Level</small>
						<strong>${classData.level || 1}</strong>
					</div>
				</div>`;

            // Add spell slots information
            if (
                classData?.spellSlots &&
                Object.keys(classData.spellSlots).length > 0
            ) {
                html += `<div class="mt-3">
					<small class="d-block text-muted mb-2">Spell Slots</small>
					<div class="d-flex flex-wrap gap-2">`;

                for (let level = 1; level <= 9; level++) {
                    const slotData = classData.spellSlots[level];
                    if (!slotData) continue;

                    html += `<div class="badge bg-secondary">
						${this._getLevelLabel(level)}: ${slotData.max}
					</div>`;
                }

                html += `</div></div>`;
            }

            // Add prepared spell limit for classes that prepare spells
            const preparedSpellClasses = [
                'Cleric',
                'Druid',
                'Paladin',
                'Ranger',
                'Wizard',
            ];
            const classLevel = classData.level || 1;
            const limitInfo = spellSelectionService.getSpellLimitInfo(
                character,
                className,
                classLevel,
            );

            // Add spell counters section
            if (limitInfo.limit > 0) {
                html += `<div class="mt-3">
					<small class="d-block text-muted mb-2">Spell Counters</small>
					<div class="d-flex flex-wrap gap-2">`;

                // Add Spells Known badge if applicable
                if (limitInfo.type === 'known') {
                    html += `<div class="badge bg-primary">
							Spells Known: ${limitInfo.current} / ${limitInfo.limit}
						</div>`;
                }

                // Add Prepared Spells badge if applicable
                if (preparedSpellClasses.includes(className)) {
                    html += `<div class="badge bg-info">
							Prepared Spells: ${limitInfo.current} / ${limitInfo.limit}
						</div>`;
                }

                html += `</div></div>`;
            }

            html += `</div>`;
        }

        container.innerHTML =
            html ||
            '<p style="color: var(--text-color)">No spellcasting ability.</p>';
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

        try {
            if (!this.spellSelectionModal) {
                this.spellSelectionModal = new UniversalSpellModal({
                    className,
                });
            } else {
                // Update class name for existing modal
                this.spellSelectionModal.className = className;
            }

            const result = await this.spellSelectionModal.show();
            if (result) {
                console.info(`[${this.loggerScope}]`, 'Spells added', {
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
