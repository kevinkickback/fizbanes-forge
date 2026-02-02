import { AppState } from '../../../app/AppState.js';
import { getSchoolName } from '../../../lib/5eToolsParser.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { sourceService } from '../../../services/SourceService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { spellService } from '../../../services/SpellService.js';
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
		this.allowClose = allowClose;
		this.ignoreClassRestrictions = !!ignoreClassRestrictions;
		this.initialSpells = initialSpells || [];
		this.descriptionCache = new Map();
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

		this._ensureController();
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

	_getInitialSelectionIds() {
		// Transform spell objects to spell IDs for initial selection
		if (!Array.isArray(this.initialSpells) || this.initialSpells.length === 0) {
			return [];
		}

		return this.initialSpells.map((spell) => {
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
			loadItems: (ctx) => this._loadValidSpells(ctx),
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

	async _loadValidSpells(ctx) {
		const allSpells = spellService.getAllSpells();
		const allowedSources = new Set(
			sourceService.getAllowedSources().map((s) => (s || '').toLowerCase()),
		);
		const className = ctx.className;

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
		if (this.hideKnownSpells === true) {
			const character = AppState.getCurrentCharacter();
			const classSpellcasting = character?.spellcasting?.classes?.[this.className];
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
		panel.innerHTML = '';

		this.levelFilters = this.levelFilters || new Set();
		this.schoolFilters = this.schoolFilters || new Set();
		this.ritualOnly = this.ritualOnly ?? null;
		this.concentrationOnly = this.concentrationOnly ?? null;
		this.noVerbal = this.noVerbal ?? null;
		this.noSomatic = this.noSomatic ?? null;
		this.noMaterial = this.noMaterial ?? null;
		this.hideKnownSpells = this.hideKnownSpells ?? false;
		this.ignoreSpellLimits = this.ignoreSpellLimits ?? false;

		const builder = new FilterBuilder(panel, cleanup);

		builder.addCheckboxGroup({
			title: 'Spell Level',
			options: [
				{ label: 'Cantrip', value: '0' },
				{ label: '1st', value: '1' },
				{ label: '2nd', value: '2' },
				{ label: '3rd', value: '3' },
				{ label: '4th', value: '4' },
				{ label: '5th', value: '5' },
				{ label: '6th', value: '6' },
				{ label: '7th', value: '7' },
				{ label: '8th', value: '8' },
				{ label: '9th', value: '9' },
			],
			stateSet: this.levelFilters,
			onChange: () => this._controller._renderList(),
			columns: 2,
		});

		const schoolOptions = Array.from(
			new Set(
				spellService
					.getAllSpells()
					.map((s) => s.school)
					.filter(Boolean),
			),
		)
			.sort()
			.map((code) => ({ label: getSchoolName(code), value: code }));

		builder.addCheckboxGroup({
			title: 'School',
			options: schoolOptions,
			stateSet: this.schoolFilters,
			onChange: () => this._controller._renderList(),
			columns: 2,
		});

		builder.addSwitchGroup({
			title: 'Type',
			switches: [
				{
					label: 'Ritual only',
					checked: this.ritualOnly === true,
					onChange: (v) => {
						this.ritualOnly = v ? true : null;
						this._controller._renderList();
					},
				},
				{
					label: 'Concentration only',
					checked: this.concentrationOnly === true,
					onChange: (v) => {
						this.concentrationOnly = v ? true : null;
						this._controller._renderList();
					},
				},
				{
					label: 'No verbal',
					checked: this.noVerbal === true,
					onChange: (v) => {
						this.noVerbal = v ? true : null;
						this._controller._renderList();
					},
				},
				{
					label: 'No somatic',
					checked: this.noSomatic === true,
					onChange: (v) => {
						this.noSomatic = v ? true : null;
						this._controller._renderList();
					},
				},
				{
					label: 'No material',
					checked: this.noMaterial === true,
					onChange: (v) => {
						this.noMaterial = v ? true : null;
						this._controller._renderList();
					},
				},
			],
		});

		builder.addSwitchGroup({
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
					onChange: async (v) => {
						this.ignoreClassRestrictions = !!v;
						await this._controller._reloadItems();
					},
				},
				{
					label: 'Hide already known',
					checked: this.hideKnownSpells,
					onChange: (v) => {
						this.hideKnownSpells = !!v;
						this._controller._renderList();
					},
				},
			],
		});
	}

	_getCountDisplay(selectedItems) {
		// If ignoring limits, show infinite badge
		if (this.ignoreSpellLimits) {
			return formatCategoryCounters([
				{
					label: 'spells',
					selected: selectedItems.length,
					max: Infinity,
					color: 'bg-secondary',
				},
			]);
		}

		const character = AppState.getCurrentCharacter();
		if (!character) return '';

		// Get all spellcasting classes and calculate combined totals
		const spellcastingClasses = Object.keys(character.spellcasting?.classes || {});

		let totalCantripsMax = 0;
		let totalSpellsMax = 0;

		// Count selected cantrips and leveled spells
		const selectedCantrips = selectedItems.filter((s) => (s.level || 0) === 0).length;
		const selectedLeveled = selectedItems.filter((s) => (s.level || 0) > 0).length;

		// Sum up limits across all classes
		for (const className of spellcastingClasses) {
			const classEntry = character.progression?.classes?.find(
				(c) => c.name === className,
			);
			const classLevel = classEntry?.levels || 1;

			const limitInfo = spellSelectionService.getSpellLimitInfo(
				character,
				className,
				classLevel,
			);

			const classSpellcasting = character.spellcasting?.classes?.[className];

			// Add cantrip limits
			const maxCantrips = classSpellcasting?.cantripsKnown || 0;
			totalCantripsMax += maxCantrips;

			// Add spell limits
			if (limitInfo.type === 'known') {
				totalSpellsMax += limitInfo.limit || 0;
			} else if (limitInfo.type === 'prepared') {
				totalSpellsMax += limitInfo.spellbookLimit || 0;
			}
		}

		const categories = [];

		// Add combined cantrips category
		if (totalCantripsMax > 0) {
			categories.push({
				label: selectedCantrips === 1 ? 'cantrip' : 'cantrips',
				selected: selectedCantrips,
				max: totalCantripsMax,
				color: 'bg-info',
			});
		}

		// Add combined spells category
		if (totalSpellsMax > 0) {
			categories.push({
				label: selectedLeveled === 1 ? 'spell' : 'spells',
				selected: selectedLeveled,
				max: totalSpellsMax,
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

		// Calculate combined limits across all spellcasting classes
		const spellcastingClasses = Object.keys(character.spellcasting?.classes || {});
		let totalCantripsMax = 0;
		let totalSpellsMax = 0;

		for (const className of spellcastingClasses) {
			const classEntry = character.progression?.classes?.find(
				(c) => c.name === className,
			);
			const classLevel = classEntry?.levels || 1;

			const limitInfo = spellSelectionService.getSpellLimitInfo(
				character,
				className,
				classLevel,
			);

			const classSpellcasting = character.spellcasting?.classes?.[className];

			// Add cantrip limits
			const maxCantrips = classSpellcasting?.cantripsKnown || 0;
			totalCantripsMax += maxCantrips;

			// Add spell limits
			if (limitInfo.type === 'known') {
				totalSpellsMax += limitInfo.limit || 0;
			} else if (limitInfo.type === 'prepared') {
				totalSpellsMax += limitInfo.spellbookLimit || 0;
			}
		}

		// Count selected spells by type
		const selectedCantrips = state.selectedItems.filter(
			(s) => (s.level || 0) === 0,
		).length;
		const selectedLeveled = state.selectedItems.filter(
			(s) => (s.level || 0) > 0,
		).length;

		// Check cantrip over-capacity
		if (totalCantripsMax > 0 && selectedCantrips > totalCantripsMax) {
			return {
				type: 'cantrips',
				excess: selectedCantrips - totalCantripsMax,
				selected: selectedCantrips,
				max: totalCantripsMax,
			};
		}

		// Check leveled spell over-capacity
		if (totalSpellsMax > 0 && selectedLeveled > totalSpellsMax) {
			return {
				type: 'spells',
				excess: selectedLeveled - totalSpellsMax,
				selected: selectedLeveled,
				max: totalSpellsMax,
			};
		}

		return null;
	}

	_canSelectSpell(spell, state) {
		// If ignoring limits, allow everything
		if (this.ignoreSpellLimits) return true;

		// Always allow deselection
		const isSelected = state.selectedIds.has(spell.id);
		if (isSelected) return true;

		const character = AppState.getCurrentCharacter();
		if (!character) return true;

		// Calculate combined limits across all spellcasting classes
		const spellcastingClasses = Object.keys(character.spellcasting?.classes || {});
		let totalCantripsMax = 0;
		let totalSpellsMax = 0;

		for (const className of spellcastingClasses) {
			const classEntry = character.progression?.classes?.find(
				(c) => c.name === className,
			);
			const classLevel = classEntry?.levels || 1;

			const limitInfo = spellSelectionService.getSpellLimitInfo(
				character,
				className,
				classLevel,
			);

			const classSpellcasting = character.spellcasting?.classes?.[className];

			// Add cantrip limits
			const maxCantrips = classSpellcasting?.cantripsKnown || 0;
			totalCantripsMax += maxCantrips;

			// Add spell limits
			if (limitInfo.type === 'known') {
				totalSpellsMax += limitInfo.limit || 0;
			} else if (limitInfo.type === 'prepared') {
				totalSpellsMax += limitInfo.spellbookLimit || 0;
			}
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
			if (totalCantripsMax > 0 && selectedCantrips >= totalCantripsMax) {
				return false;
			}
			return true;
		}

		// Check leveled spell limit
		if (totalSpellsMax > 0 && selectedLeveled >= totalSpellsMax) {
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

		// Initialize spellcasting for class if not already initialized
		if (!character.spellcasting?.classes?.[this.className]) {
			const classLevel =
				character.class?.name === this.className
					? character.level
					: character.multiclass?.find((c) => c.name === this.className)
						?.level || 1;

			spellSelectionService.initializeSpellcastingForClass(
				character,
				this.className,
				classLevel,
			);
		}

		let successCount = 0;
		const failedSpells = [];

		for (const spell of selected) {
			const success = spellSelectionService.addKnownSpell(
				character,
				this.className,
				spell,
			);
			if (success) {
				successCount++;
			} else {
				failedSpells.push(spell.name);
			}
		}

		if (successCount > 0) {
			const message =
				successCount === 1
					? `Added ${selected[0].name} to ${this.className}`
					: `Added ${successCount} spell${successCount > 1 ? 's' : ''} to ${this.className}`;
			showNotification(message, 'success');
			eventBus.emit(EVENTS.CHARACTER_UPDATED, { character });
		}

		if (failedSpells.length > 0) {
			showNotification(`Failed to add: ${failedSpells.join(', ')}`, 'error');
		}

		// Return formatted result matching old modal interface
		return {
			spells: selected,
			className: this.className,
			successCount,
		};
	}

	_handleCancel() {
		// No-op: allow UniversalSelectionModal to resolve null
	}
}
