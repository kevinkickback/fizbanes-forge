import { AppState } from '../../../app/AppState.js';
import { getSchoolName } from '../../../lib/5eToolsParser.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { sourceService } from '../../../services/SourceService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { spellService } from '../../../services/SpellService.js';
import { ClassSwitcher } from '../selection/ClassSwitcher.js';
import { FilterBuilder } from '../selection/FilterBuilder.js';
import {
	formatCategoryCounters,
	UniversalSelectionModal,
} from '../selection/UniversalSelectionModal.js';

export class SpellSelectionModal {
	constructor({
		className = null,
		allowClose = true,
		ignoreClassRestrictions = false,
		initialSpells = [],
	} = {}) {
		this.className = className;
		this.selectedClassName = className; // Track currently selected class for multiclass support
		this.allowClose = allowClose;
		this.ignoreClassRestrictions = !!ignoreClassRestrictions;
		this.initialSpells = initialSpells || [];
		this.descriptionCache = new Map();
		this.classSwitcher = null;
		this._controller = null;
	}

	async show() {
		const character = AppState.getCurrentCharacter();
		if (!character) {
			showNotification('No character selected', 'error');
			return null;
		}
		if (!this.className) {
			showNotification('No class selected for spell selection', 'error');
			return null;
		}

		// Reset selectedClassName to initial value, or default to Bonus if no spellcasting classes
		const spellcastingClasses = Object.keys(character.spellcasting?.classes || {});
		if (spellcastingClasses.length === 0) {
			this.selectedClassName = 'Bonus';
			this.ignoreClassRestrictions = true;
		} else {
			this.selectedClassName = this.className;
		}

		this._ensureController();

		// Wire up class switcher after modal is shown
		const options = ['Bonus', ...spellcastingClasses];

		if (options.length > 1) {
			setTimeout(() => {
				const modal = document.getElementById('universalSpellSelectionModal');
				if (modal) {
					const footer = modal.querySelector('.modal-footer');
					if (footer) {
						this.classSwitcher = new ClassSwitcher({
							container: footer,
							classes: options,
							selectedClass: this.selectedClassName,
							onChange: (newClassName) => this._handleClassChange(newClassName),
							selectorId: 'spellClassSelector',
						});
						this.classSwitcher.render();
					}
				}
			}, 100);
		}

		const result = await this._controller.show(this._getContext());
		if (Array.isArray(result)) return result; // selected items
		return null;
	}

	_getContext() {
		return {
			character: AppState.getCurrentCharacter(),
			className: this.className,
		};
	}

	async _handleClassChange(newClassName) {
		if (newClassName === this.selectedClassName) return;

		this.selectedClassName = newClassName;

		// Update ignore class restrictions if Bonus is selected
		const wasIgnoringRestrictions = this.ignoreClassRestrictions;
		if (newClassName === 'Bonus') {
			this.ignoreClassRestrictions = true;
		} else if (wasIgnoringRestrictions && this.className !== 'Bonus') {
			// Restore original setting if switching away from General
			const toggle = document.getElementById('ignoreClassRestrictionsToggle');
			if (toggle) {
				this.ignoreClassRestrictions = toggle.checked;
			}
		}

		// Get new initial selection for the selected class
		const newInitialIds = this._getInitialSelectionIds();

		// Update controller's selection state
		if (this._controller?.state) {
			this._controller.state.selectedIds = new Set(newInitialIds);
			this._controller.state.selectedItems = this._controller.state.items.filter(item =>
				newInitialIds.includes(this._controller.config.getItemId(item))
			);
		}

		// Reload items with new class filter
		await this._controller._reloadItems();

		// Update display
		this._controller._renderList();
		this._controller._renderSelected();
		this._controller._updateConfirmButton();
	}

	_getInitialSelectionIds() {
		// Load known spells for the currently selected class only
		const character = AppState.getCurrentCharacter();
		if (!character) return [];

		const targetClass = this.selectedClassName || this.className;

		// Skip for Bonus class
		if (targetClass === 'Bonus') return [];

		const classSpellcasting = character.spellcasting?.classes?.[targetClass];
		const knownSpells = classSpellcasting?.spellsKnown || [];

		return knownSpells.map((spell) => {
			const id = spell.id || `${spell.name}|${spell.source}`.toLowerCase().replace(/\s+/g, '-');
			return id;
		});
	}

	_ensureController() {
		if (this._controller) return;

		this._controller = new UniversalSelectionModal({
			modalId: 'universalSpellSelectionModal',
			modalTitle: 'Add Spell',
			allowClose: this.allowClose,
			pageSize: 50,
			listContainerSelector: '.spell-list-container',
			selectedContainerSelector: '.selected-spells-container',
			searchInputSelector: '.spell-search-input',
			filterToggleSelector: '.spell-filter-toggle-btn',
			filterPanelSelector: '.spell-filters-column',
			confirmSelector: '.btn-confirm',
			cancelSelector: '.btn-cancel',
			itemIdAttribute: 'data-spell-id',
			selectionMode: 'multiple',
			selectionLimit: null,
			getContext: () => this._getContext(),
			getInitialSelection: () => this._getInitialSelectionIds(),
			loadItems: () => this._loadValidSpells(),
			matchItem: (spell, state) => this._spellMatchesFilters(spell, state),
			renderItem: (spell, state) => this._renderSpellCard(spell, state),
			getItemId: (spell) => spell.id,
			canSelectItem: (spell, state) => this._canSelectSpell(spell, state),
			onSelectBlocked: (spell) => this._onSpellSelectionBlocked(spell),
			onConfirm: (selected) => this._handleConfirm(selected),
			onCancel: () => this._handleCancel(),
			buildFilters: (ctx, panel, cleanup) =>
				this._buildFilters(ctx, panel, cleanup),
			onSelectionChange: (_state) => { },
			onListRendered: (_state) => { },
			customCountFn: (selectedItems) => this._getCountDisplay(selectedItems),
			descriptionCache: this.descriptionCache,
			fetchDescription: (spell) => this._fetchSpellDescription(spell),
			descriptionContainerSelector: '.spell-description',
		});
	}

	async _loadValidSpells() {
		const allSpells = spellService.getAllSpells();
		const allowedSources = new Set(
			sourceService.getAllowedSources().map((s) => (s || '').toLowerCase()),
		);
		const className = this.selectedClassName;

		const valid = allSpells
			.filter((spell) => {
				const spellSource = (spell.source || '').toLowerCase();
				if (!allowedSources.has(spellSource)) return false;
				if (!this.ignoreClassRestrictions) {
					if (!spellService.isSpellAvailableForClass(spell, className))
						return false;
				}
				return true;
			})
			.map((spell) => ({
				...spell,
				id:
					spell.id ||
					`${spell.name}|${spell.source}`.toLowerCase().replace(/\s+/g, '-'),
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		return valid;
	}

	_spellMatchesFilters(spell, state) {
		const term = (state.searchTerm || '').trim().toLowerCase();
		if (term) {
			const name = (spell.name || '').toLowerCase();
			if (!name.includes(term)) return false;
		}
		// Additional filters are attached to DOM via FilterBuilder and stored on instance
		if (this.levelFilters && this.levelFilters.size > 0) {
			const lvl = Number(spell.level || 0);
			if (!this.levelFilters.has(String(lvl))) return false;
		}
		if (this.schoolFilters && this.schoolFilters.size > 0) {
			const school = spell.school || '';
			if (!this.schoolFilters.has(school)) return false;
		}
		if (this.ritualOnly === true) {
			if (!spell.meta?.ritual) return false;
		}
		if (this.concentrationOnly === true) {
			if (!spell.duration?.[0]?.concentration) return false;
		}
		if (this.noVerbal === true) {
			if (spell.components?.v) return false;
		}
		if (this.noSomatic === true) {
			if (spell.components?.s) return false;
		}
		if (this.noMaterial === true) {
			if (spell.components?.m) return false;
		}

		// Always hide spells known by ANY class to prevent duplicates across multiclass
		const character = AppState.getCurrentCharacter();
		const spellcastingClasses = Object.keys(character?.spellcasting?.classes || {});

		for (const className of spellcastingClasses) {
			const classSpellcasting = character.spellcasting.classes[className];
			if (classSpellcasting?.spellsKnown) {
				const isKnown = classSpellcasting.spellsKnown.some(
					(s) => s.name === spell.name && s.source === spell.source,
				);
				if (isKnown) return false;
			}
		}

		return true;
	}

	_renderSpellCard(spell, state) {
		const isSelected = state?.selectedIds?.has(spell.id);
		const level = spell.level !== undefined ? spell.level : 0;
		const levelText = level === 0 ? 'Cantrip' : `${level}-level`;
		const school = getSchoolName(spell.school) || 'Unknown';
		const ritual = spell.meta?.ritual
			? '<span class="badge bg-info ms-2">Ritual</span>'
			: '';
		const concentration = spell.duration?.[0]?.concentration
			? '<span class="badge bg-warning ms-2">Concentration</span>'
			: '';

		// Parse spell details
		const castingTime = spell.time
			? `${spell.time[0]?.number || ''} ${spell.time[0]?.unit || ''}`.trim()
			: 'N/A';
		const range = spell.range?.distance
			? `${spell.range.distance.amount || ''} ${spell.range.distance.type || ''}`.trim()
			: 'N/A';
		const duration = spell.duration?.[0]?.type || 'N/A';

		const components = [];
		if (spell.components?.v) components.push('V');
		if (spell.components?.s) components.push('S');
		if (spell.components?.m) {
			const material =
				typeof spell.components.m === 'string'
					? spell.components.m
					: 'material component';
			components.push(`M (${material})`);
		}
		const componentsText =
			components.length > 0 ? components.join(', ') : 'N/A';

		const desc = this.descriptionCache.has(spell.id)
			? this.descriptionCache.get(spell.id)
			: '<span class="text-muted small">Loading...</span>';

		return `
            <div class="spell-card ${isSelected ? 'selected' : ''}" data-spell-id="${spell.id}">
                <div class="spell-card-header">
                    <div>
                        <strong>${spell.name}</strong>
                        <span class="text-muted">(${levelText} ${school})</span>
                    </div>
                    <div>${ritual}${concentration}</div>
                </div>
                <div class="spell-card-body">
                    <div class="spell-stats">
                        <div class="spell-stat-row">
                            <div class="spell-stat">
                                <strong>Casting Time:</strong> ${castingTime}
                            </div>
                            <div class="spell-stat">
                                <strong>Range:</strong> ${range}
                            </div>
                        </div>
                        <div class="spell-stat-row">
                            <div class="spell-stat">
                                <strong>Duration:</strong> ${duration}
                            </div>
                            <div class="spell-stat">
                                <strong>Components:</strong> ${componentsText}
                            </div>
                        </div>
                    </div>
                    <div class="spell-description">
                        ${desc}
                    </div>
                </div>
            </div>
        `;
	}

	async _fetchSpellDescription(spell) {
		const parts = [];
		if (Array.isArray(spell.entries)) {
			for (const entry of spell.entries) {
				if (typeof entry === 'string') {
					parts.push(await textProcessor.processString(entry));
				} else if (Array.isArray(entry?.entries)) {
					for (const sub of entry.entries) {
						if (typeof sub === 'string') {
							parts.push(await textProcessor.processString(sub));
						}
					}
				}
			}
		} else if (typeof spell.entries === 'string') {
			parts.push(await textProcessor.processString(spell.entries));
		}
		return parts.length
			? parts.join(' ')
			: '<span class="text-muted small">No description available.</span>';
	}

	_buildFilters(_ctx, panel, cleanup) {
		if (!panel) return;

		this.levelFilters = this.levelFilters || new Set();
		this.schoolFilters = this.schoolFilters || new Set();
		this.ritualOnly = this.ritualOnly ?? null;
		this.concentrationOnly = this.concentrationOnly ?? null;
		this.noVerbal = this.noVerbal ?? null;
		this.noSomatic = this.noSomatic ?? null;
		this.noMaterial = this.noMaterial ?? null;
		this.ignoreSpellLimits = this.ignoreSpellLimits ?? false;

		FilterBuilder.buildSpellFilters({
			panel,
			cleanup,
			levelFilters: this.levelFilters,
			schoolFilters: this.schoolFilters,
			ritualOnly: this.ritualOnly,
			concentrationOnly: this.concentrationOnly,
			noVerbal: this.noVerbal,
			noSomatic: this.noSomatic,
			noMaterial: this.noMaterial,
			onFilterChange: (value, filterType) => {
				if (filterType) {
					// Type filters (switches)
					this[filterType] = value ? true : null;
				}
				this._controller._renderList();
			},
			additionalSwitches: {
				title: 'Restrictions',
				switches: [
					{
						label: 'Ignore spell limits',
						checked: this.ignoreSpellLimits,
						id: 'ignoreSpellLimitsToggle',
						onChange: (v) => {
							const wasIgnoring = this.ignoreSpellLimits;

							// If trying to turn limits back on, check if current selection exceeds limits
							if (wasIgnoring && !v) {
								const overCapacity = this._checkOverCapacity();
								if (overCapacity) {
									// Keep toggle on and show notification
									showNotification(
										`You have selected ${overCapacity.excess} too many ${overCapacity.type}. Please deselect some before re-enabling limits.`,
										'warning',
									);
									// Revert the visual toggle state
									const toggleInput = document.getElementById('ignoreSpellLimitsToggle');
									if (toggleInput) {
										toggleInput.checked = true;
									}
									return;
								}
							}

							// Only update state if we're not over capacity
							this.ignoreSpellLimits = !!v;
							this._controller._renderList();
							this._controller._updateConfirmButton(); // Update badges
						},
					},
					{
						label: 'Ignore class restrictions',
						checked: this.ignoreClassRestrictions,
						id: 'ignoreClassRestrictionsToggle',
						onChange: async (v) => {
							this.ignoreClassRestrictions = !!v;
							await this._controller._reloadItems();
						},
					},
				],
			},
		});
	}

	_getCountDisplay(selectedItems) {
		const character = AppState.getCurrentCharacter();
		if (!character) return '';

		// Show infinite badge for Bonus class
		if (this.selectedClassName === 'Bonus') {
			return formatCategoryCounters([
				{
					label: 'spells',
					selected: selectedItems.length,
					max: Infinity,
					color: 'bg-secondary',
				},
			]);
		}

		// Get limits for the currently selected class only
		const targetClass = this.selectedClassName || this.className;

		const classEntry = character.progression?.classes?.find(
			(c) => c.name === targetClass,
		);
		const classLevel = classEntry?.levels || 1;

		const limitInfo = spellSelectionService.getSpellLimitInfo(
			character,
			targetClass,
			classLevel,
		);

		const classSpellcasting = character.spellcasting?.classes?.[targetClass];

		const maxCantrips = classSpellcasting?.cantripsKnown || 0;
		let maxSpells = 0;
		if (limitInfo.type === 'known') {
			maxSpells = limitInfo.limit || 0;
		} else if (limitInfo.type === 'prepared') {
			maxSpells = limitInfo.spellbookLimit || 0;
		}

		// Count selected cantrips and leveled spells
		const selectedCantrips = selectedItems.filter((s) => (s.level || 0) === 0).length;
		const selectedLeveled = selectedItems.filter((s) => (s.level || 0) > 0).length;

		const categories = [];

		// Add cantrips category
		if (maxCantrips > 0) {
			categories.push({
				label: selectedCantrips === 1 ? 'cantrip' : 'cantrips',
				selected: selectedCantrips,
				max: maxCantrips,
				color: 'bg-info',
			});
		}

		// Add spells category
		if (maxSpells > 0) {
			categories.push({
				label: selectedLeveled === 1 ? 'spell' : 'spells',
				selected: selectedLeveled,
				max: maxSpells,
				color: 'bg-success',
			});
		}

		return formatCategoryCounters(categories);
	}

	_checkOverCapacity() {
		const character = AppState.getCurrentCharacter();
		if (!character) return null;

		const state = this._controller?.state;
		if (!state) return null;

		// No limits for Bonus class
		if (this.selectedClassName === 'Bonus') return null;

		// Get limits for the selected class only
		const classEntry = character.progression?.classes?.find(
			(c) => c.name === this.selectedClassName,
		);
		const classLevel = classEntry?.levels || 1;

		const limitInfo = spellSelectionService.getSpellLimitInfo(
			character,
			this.selectedClassName,
			classLevel,
		);

		const classSpellcasting = character.spellcasting?.classes?.[this.selectedClassName];

		const maxCantrips = classSpellcasting?.cantripsKnown || 0;
		let maxSpells = 0;
		if (limitInfo.type === 'known') {
			maxSpells = limitInfo.limit || 0;
		} else if (limitInfo.type === 'prepared') {
			maxSpells = limitInfo.spellbookLimit || 0;
		}

		// Count selected spells by type
		const selectedCantrips = state.selectedItems.filter(
			(s) => (s.level || 0) === 0,
		).length;
		const selectedLeveled = state.selectedItems.filter(
			(s) => (s.level || 0) > 0,
		).length;

		// Check cantrip over-capacity
		if (maxCantrips > 0 && selectedCantrips > maxCantrips) {
			return {
				type: 'cantrips',
				excess: selectedCantrips - maxCantrips,
				selected: selectedCantrips,
				max: maxCantrips,
			};
		}

		// Check leveled spell over-capacity
		if (maxSpells > 0 && selectedLeveled > maxSpells) {
			return {
				type: 'spells',
				excess: selectedLeveled - maxSpells,
				selected: selectedLeveled,
				max: maxSpells,
			};
		}

		return null;
	}

	_canSelectSpell(spell, state) {
		// If ignoring limits or Bonus class, allow everything
		if (this.ignoreSpellLimits || this.selectedClassName === 'Bonus') return true;

		// Always allow deselection
		const isSelected = state.selectedIds.has(spell.id);
		if (isSelected) return true;

		const character = AppState.getCurrentCharacter();
		if (!character) return true;

		// Get limits for the selected class only
		const classEntry = character.progression?.classes?.find(
			(c) => c.name === this.selectedClassName,
		);
		const classLevel = classEntry?.levels || 1;

		const limitInfo = spellSelectionService.getSpellLimitInfo(
			character,
			this.selectedClassName,
			classLevel,
		);

		const classSpellcasting = character.spellcasting?.classes?.[this.selectedClassName];

		const maxCantrips = classSpellcasting?.cantripsKnown || 0;
		let maxSpells = 0;
		if (limitInfo.type === 'known') {
			maxSpells = limitInfo.limit || 0;
		} else if (limitInfo.type === 'prepared') {
			maxSpells = limitInfo.spellbookLimit || 0;
		}

		// Count selected spells by type
		const selectedCantrips = state.selectedItems.filter(
			(s) => (s.level || 0) === 0,
		).length;
		const selectedLeveled = state.selectedItems.filter(
			(s) => (s.level || 0) > 0,
		).length;

		// Check cantrip limit
		if ((spell.level || 0) === 0) {
			if (maxCantrips > 0 && selectedCantrips >= maxCantrips) {
				return false;
			}
			return true;
		}

		// Check leveled spell limit
		if (maxSpells > 0 && selectedLeveled >= maxSpells) {
			return false;
		}

		return true;
	}

	_onSpellSelectionBlocked(spell) {
		const isCantrip = (spell.level || 0) === 0;
		if (isCantrip) {
			showNotification(
				'Cantrip limit reached. Deselect a cantrip to add another.',
				'warning',
			);
		} else {
			showNotification(
				'Spell limit reached. Deselect a spell to add another, or enable "Ignore spell limits".',
				'warning',
			);
		}
	}

	async _handleConfirm(selected) {
		const character = AppState.getCurrentCharacter();
		if (!character || !Array.isArray(selected) || selected.length === 0) {
			return selected;
		}

		const targetClass = this.selectedClassName;

		// Initialize spellcasting for class if not already initialized (skip for Bonus)
		if (targetClass !== 'Bonus' && !character.spellcasting?.classes?.[targetClass]) {
			const classLevel =
				character.class?.name === targetClass
					? character.level
					: character.multiclass?.find((c) => c.name === targetClass)
						?.level || 1;

			spellSelectionService.initializeSpellcastingForClass(
				character,
				targetClass,
				classLevel,
			);
		}

		// Get currently known spells for this class to avoid duplicates
		const classSpellcasting = character.spellcasting?.classes?.[targetClass];
		const currentlyKnown = classSpellcasting?.spellsKnown || [];
		const currentlyKnownSet = new Set(
			currentlyKnown.map(s => `${s.name}|${s.source}`.toLowerCase())
		);

		let successCount = 0;
		const failedSpells = [];
		const addedSpells = [];

		for (const spell of selected) {
			const spellKey = `${spell.name}|${spell.source}`.toLowerCase();

			// Skip if already known
			if (currentlyKnownSet.has(spellKey)) {
				continue;
			}

			const success = spellSelectionService.addKnownSpell(
				character,
				targetClass,
				spell,
			);
			if (success) {
				successCount++;
				addedSpells.push(spell.name);
			} else {
				failedSpells.push(spell.name);
			}
		}

		if (successCount > 0) {
			const message =
				successCount === 1
					? `Added ${addedSpells[0]}${targetClass !== 'Bonus' ? ` to ${targetClass}` : ''}`
					: `Added ${successCount} spell${successCount > 1 ? 's' : ''}${targetClass !== 'Bonus' ? ` to ${targetClass}` : ''}`;
			showNotification(message, 'success');
			eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
		}

		if (failedSpells.length > 0) {
			showNotification(`Failed to add: ${failedSpells.join(', ')}`, 'error');
		}

		// Return formatted result matching old modal interface
		return {
			spells: selected,
			className: targetClass,
			successCount,
		};
	}

	_handleCancel() {
		// No-op: allow UniversalSelectionModal to resolve null
	}
}
