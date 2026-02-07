// Spell selector for class-specific spell/cantrip selection with known limits

import { getSchoolName, renderEntriesToText } from '../../../lib/5eToolsParser.js';
import { showNotification } from '../../../lib/Notifications.js';
import { classService } from '../../../services/ClassService.js';
import { sourceService } from '../../../services/SourceService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { spellService } from '../../../services/SpellService.js';
import {
	BaseSelectorModal,
	formatCategoryCounters,
} from '../selection/BaseSelectorModal.js';
import { FilterBuilder } from '../selection/FilterBuilder.js';

export class ClassSpellSelectorModal {
	constructor(session, parentStep, className, currentLevel) {
		this.session = session;
		this.parentStep = parentStep;
		this.className = className;
		this.currentLevel = currentLevel;

		// Spell limits
		this.maxSpells = 0;
		this.maxCantrips = 0;
		this.slotsByLevel = {}; // { 1: 2, 2: 2, 3: 1 }

		// Filter state (to track which filters are active)
		this.levelFilters = new Set();
		this.schoolFilters = new Set();
		this.ritualOnly = null;
		this.concentrationOnly = null;
		this.noVerbal = null;
		this.noSomatic = null;
		this.noMaterial = null;

		// Generic selector instance
		this._selector = null;

		// Description cache for spell cards
		this._descriptionCache = new Map();
	}

	async show() {
		try {
			// Calculate limits first
			this._calculateSpellLimits();

			// Load spell data
			const spellData = await this._loadSpellData();

			// If there are no spells to learn at this level, bail out with a notice
			if (!Array.isArray(spellData) || spellData.length === 0) {
				const maxSpellLevel = this._getMaxSpellLevel(
					this.className,
					this.currentLevel,
				);
				const ordinals = [
					'',
					'1st-level',
					'2nd-level',
					'3rd-level',
					'4th-level',
					'5th-level',
					'6th-level',
					'7th-level',
					'8th-level',
					'9th-level',
				];
				const levelText = ordinals[maxSpellLevel] || 'level';
				const msg =
					this.maxCantrips > 0 || this.maxSpells > 0
						? 'No valid spells found for selection.'
						: `No new ${levelText} spells or cantrips to learn at this level.`;
				showNotification(msg, 'info');
				return;
			}

			// Get previously selected spells
			const key = `${this.className}_${this.currentLevel}`;
			const previousSelections =
				this.session.stepData.selectedSpells[key] || [];

			// Match initialSelections against spellData (which includes current level selections)
			const initialSelections = previousSelections
				.map((prevSpell) => {
					const spellName =
						typeof prevSpell === 'string' ? prevSpell : prevSpell.name;
					return spellData.find((spell) => spell.name === spellName);
				})
				.filter(Boolean);

			// Build modal title
			let modalTitle = `Select Spells - ${this.className} (Level ${this.currentLevel})`;
			if (this.maxCantrips > 0 && this.maxSpells > 0) {
				const maxSpellLevel = this._getMaxSpellLevel(
					this.className,
					this.currentLevel,
				);
				const ordinals = [
					'',
					'1st-level',
					'2nd-level',
					'3rd-level',
					'4th-level',
					'5th-level',
					'6th-level',
					'7th-level',
					'8th-level',
					'9th-level',
				];
				modalTitle = `Learn ${this.maxCantrips} cantrip${this.maxCantrips !== 1 ? 's' : ''}, ${this.maxSpells} ${ordinals[maxSpellLevel] || 'level'} spell${this.maxSpells !== 1 ? 's' : ''}`;
			} else if (this.maxCantrips > 0) {
				modalTitle = `Learn ${this.maxCantrips} cantrip${this.maxCantrips !== 1 ? 's' : ''}`;
			} else if (this.maxSpells > 0) {
				const maxSpellLevel = this._getMaxSpellLevel(
					this.className,
					this.currentLevel,
				);
				const ordinals = [
					'',
					'1st-level',
					'2nd-level',
					'3rd-level',
					'4th-level',
					'5th-level',
					'6th-level',
					'7th-level',
					'8th-level',
					'9th-level',
				];
				modalTitle = `Learn ${this.maxSpells} ${ordinals[maxSpellLevel] || 'level'} spell${this.maxSpells !== 1 ? 's' : ''}`;
			}

			// Build filter sets using FilterBuilder (same as UniversalSpellModal)
			const buildFilters = (_ctx, panel, cleanup) => {
				if (!panel) return;
				const maxSpellLevel = this._getMaxSpellLevel(
					this.className,
					this.currentLevel,
				);
				const ordinals = [
					'Cantrip',
					'1st',
					'2nd',
					'3rd',
					'4th',
					'5th',
					'6th',
					'7th',
					'8th',
					'9th',
				];

				const builder = new FilterBuilder(panel, cleanup);

				// Build level options from available spells
				const availableLevels = [...new Set(spellData.map((s) => s.level))]
					.filter((l) => l <= maxSpellLevel)
					.sort((a, b) => a - b);

				const levelOptions = availableLevels.map((level) => ({
					label: ordinals[level],
					value: String(level),
				}));

				builder.addCheckboxGroup({
					title: 'Spell Level',
					options: levelOptions,
					stateSet: this.levelFilters,
					onChange: () => this._selector._renderList(),
					columns: 2,
				});

				// Build school options
				const schoolOptions = Array.from(
					new Set(spellData.map((s) => s.school).filter(Boolean)),
				)
					.sort()
					.map((code) => ({ label: getSchoolName(code) || code, value: code }));

				builder.addCheckboxGroup({
					title: 'School',
					options: schoolOptions,
					stateSet: this.schoolFilters,
					onChange: () => this._selector._renderList(),
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
								this._selector._renderList();
							},
						},
						{
							label: 'Concentration only',
							checked: this.concentrationOnly === true,
							onChange: (v) => {
								this.concentrationOnly = v ? true : null;
								this._selector._renderList();
							},
						},
						{
							label: 'No verbal',
							checked: this.noVerbal === true,
							onChange: (v) => {
								this.noVerbal = v ? true : null;
								this._selector._renderList();
							},
						},
						{
							label: 'No somatic',
							checked: this.noSomatic === true,
							onChange: (v) => {
								this.noSomatic = v ? true : null;
								this._selector._renderList();
							},
						},
						{
							label: 'No material',
							checked: this.noMaterial === true,
							onChange: (v) => {
								this.noMaterial = v ? true : null;
								this._selector._renderList();
							},
						},
					],
				});
			};

			this._selector = new BaseSelectorModal({
				modalId: `spellSelectorModal_${Date.now()}`,
				modalTitle,
				loadItems: () => spellData,
				selectionMode: 'multiple',
				selectionLimit: this.maxSpells + this.maxCantrips,
				initialSelectedItems: initialSelections,
				searchMatcher: (item, searchTerm) => {
					if (!searchTerm) return true;
					const term = searchTerm.toLowerCase();
					return item.name?.toLowerCase().includes(term);
				},
				buildFilters,
				renderItem: (item, state) => this._renderSpellItem(item, state),
				getItemId: (item) => item.id || item.name,
				matchItem: (item, state) => {
					if (state.searchTerm) {
						const term = state.searchTerm.toLowerCase();
						if (!item.name?.toLowerCase().includes(term)) return false;
					}

					// Level filter - check this.levelFilters Set
					if (
						this.levelFilters.size > 0 &&
						!this.levelFilters.has(String(item.level))
					) {
						return false;
					}

					// School filter - check this.schoolFilters Set
					if (
						this.schoolFilters.size > 0 &&
						!this.schoolFilters.has(item.school)
					) {
						return false;
					}

					// Type filters
					if (this.ritualOnly === true) {
						if (!item.meta?.ritual) return false;
					}
					if (this.concentrationOnly === true) {
						if (!item.duration?.[0]?.concentration) return false;
					}
					if (this.noVerbal === true) {
						if (item.components?.v) return false;
					}
					if (this.noSomatic === true) {
						if (item.components?.s) return false;
					}
					if (this.noMaterial === true) {
						if (item.components?.m) return false;
					}

					return true;
				},
				// Block selection per category when limits are reached
				canSelectItem: (item, state) => {
					const selectedByLevel = {};
					state.selectedItems.forEach((spell) => {
						const lvl = spell.level || 0;
						selectedByLevel[lvl] = (selectedByLevel[lvl] || 0) + 1;
					});
					const selectedCantrips = selectedByLevel[0] || 0;
					const selectedLeveled = state.selectedItems.filter(
						(s) => (s.level || 0) > 0,
					).length;


					if ((item.level || 0) === 0) {
						if (this.maxCantrips > 0 && selectedCantrips >= this.maxCantrips)
							return false;
						return true;
					} else {
						if (this.maxSpells > 0 && selectedLeveled >= this.maxSpells)
							return false;
						return true;
					}
				},
				onSelectBlocked: (item) => {
					const isCantrip = (item.level || 0) === 0;
					if (isCantrip) {
						showNotification(
							'Cantrip limit reached. Deselect a cantrip to add another.',
							'warning',
						);
					} else {
						const maxSpellLevel = this._getMaxSpellLevel(
							this.className,
							this.currentLevel,
						);
						const ordinals = [
							'Cantrip',
							'1st',
							'2nd',
							'3rd',
							'4th',
							'5th',
							'6th',
							'7th',
							'8th',
							'9th',
						];
						const lvlText = ordinals[maxSpellLevel];
						showNotification(
							`${lvlText} spell limit reached. Deselect a spell to add another.`,
							'warning',
						);
					}
				},
				// Description caching (optional, improves UX like manager)
				descriptionCache: this._descriptionCache,
				fetchDescription: (spell) => this._fetchSpellDescription(spell),
				descriptionContainerSelector: '.selector-description',
				customCountFn: (selectedItems) => this._getCountDisplay(selectedItems),
				onConfirm: this._onSpellsConfirmed.bind(this),
				onCancel: () => {
					// No-op
				},
			});

			this._selector.show();
		} catch (error) {
			console.error(
				'[ClassSpellSelectorModal]',
				'Error showing spell selector:',
				error,
			);
		}
	}

	/**
	 * Load available spells for this class and level
	 */
	async _loadSpellData() {
		const classInfo = spellSelectionService._getClassSpellcastingInfo(
			this.className,
		);
		if (!classInfo) {
			throw new Error(`${this.className} is not a spellcaster`);
		}

		// Calculate maximum spell level available at this character level
		const maxSpellLevel = this._getMaxSpellLevel(
			this.className,
			this.currentLevel,
		);

		// Collect already-known spells from character and session (across ALL classes)
		const alreadyKnown = new Set();

		// 1. Spells from original character's spellcasting data (check all classes EXCEPT current class at current level)
		const allClassSpells =
			this.session.originalCharacter?.spellcasting?.classes;
		if (allClassSpells) {
			Object.entries(allClassSpells).forEach(([cls, classData]) => {
				// Skip spells from the current class (we're editing them)
				// We only want to exclude spells from OTHER classes or from this class at OTHER levels
				if (cls === this.className) {
					return; // Don't mark current class spells as "already known"
				}

				// Add cantrips from OTHER classes
				if (classData.cantrips) {
					classData.cantrips.forEach((spell) => {
						const spellName = typeof spell === 'string' ? spell : spell.name;
						if (spellName) alreadyKnown.add(spellName);
					});
				}
				// Add known spells from OTHER classes
				if (classData.spellsKnown) {
					classData.spellsKnown.forEach((spell) => {
						const spellName = typeof spell === 'string' ? spell : spell.name;
						if (spellName) alreadyKnown.add(spellName);
					});
				}
			});
		}

		// 2. Spells from current session's selections (check all classes)
		if (this.session.stepData?.selectedSpells) {
			const currentKey = `${this.className}_${this.currentLevel}`;

			Object.entries(this.session.stepData.selectedSpells).forEach(
				([key, spells]) => {
					// Skip the current level being edited (so user can modify their current selection)
					if (key === currentKey) {
						return;
					}

					// Check spells from ALL classes (not just the current one)
					spells.forEach((spell) => {
						const spellName = typeof spell === 'string' ? spell : spell.name;
						if (spellName) alreadyKnown.add(spellName);
					});
				},
			);
		}

		// 3. Spells from progression history at OTHER levels (but same class)
		if (this.session.originalCharacter?.progression?.spellSelections) {
			const progressionClass =
				this.session.originalCharacter.progression?.classes?.find(
					(c) => c.name === this.className,
				);
			const classLevel = progressionClass?.levels || 0;

			for (let lvl = 1; lvl <= classLevel; lvl++) {
				// Skip the current level being edited
				if (lvl === this.currentLevel) {
					continue;
				}

				const levelSpells = spellSelectionService.getSpellSelections(
					this.session.originalCharacter,
					this.className,
					lvl,
				);

				levelSpells.forEach((spell) => {
					const spellName = typeof spell === 'string' ? spell : spell.name;
					if (spellName) alreadyKnown.add(spellName);
				});
			}
		}

		// Get all spells from SpellService
		const allSpells = spellService.getAllSpells();

		// Get current level's selections to include them even if "already known"
		const currentKey = `${this.className}_${this.currentLevel}`;
		const currentLevelSelections = new Set();
		if (this.session.stepData?.selectedSpells?.[currentKey]) {
			this.session.stepData.selectedSpells[currentKey].forEach((spell) => {
				const spellName = typeof spell === 'string' ? spell : spell.name;
				if (spellName) currentLevelSelections.add(spellName);
			});
		}

		// Filter by class eligibility, spell level, allowed sources, and exclude already known
		const availableSpells = allSpells.filter((spell) => {
			// Check if spell is available for this class
			if (!spellService.isSpellAvailableForClass(spell, this.className)) {
				return false;
			}

			// Check if spell level is available at this character level
			if (spell.level > maxSpellLevel) {
				return false;
			}

			// Exclude cantrips if no cantrips are gained at this level
			if (spell.level === 0 && this.maxCantrips === 0) {
				return false;
			}

			// Exclude leveled spells if no spells are gained at this level
			if (spell.level > 0 && this.maxSpells === 0) {
				return false;
			}

			// Check if source is allowed
			if (!sourceService.isSourceAllowed(spell.source)) {
				return false;
			}

			// Include spells selected for this level, even if already known
			if (currentLevelSelections.has(spell.name)) {
				return true;
			}

			// Exclude spells already known (from other levels/classes)
			if (alreadyKnown.has(spell.name)) {
				return false;
			}

			return true;
		});

		// Sort by level, then name
		availableSpells.sort((a, b) => {
			if (a.level !== b.level) {
				return a.level - b.level;
			}
			return a.name.localeCompare(b.name);
		});

		return availableSpells;
	}

	/**
	 * Generate custom count display showing breakdown by spell level
	 * Example: "2/2 cantrips, 2/2 level 1"
	 */
	_getCountDisplay(selectedItems) {
		const ordinals = [
			'Cantrip',
			'1st',
			'2nd',
			'3rd',
			'4th',
			'5th',
			'6th',
			'7th',
			'8th',
			'9th',
		];

		// Count selected spells by level
		const selectedByLevel = {};
		selectedItems.forEach((spell) => {
			const level = spell.level || 0;
			selectedByLevel[level] = (selectedByLevel[level] || 0) + 1;
		});

		// Build category objects for formatCategoryCounters
		const categories = [];

		// Add cantrips category if applicable
		if (this.maxCantrips > 0) {
			const selectedCantrips = selectedByLevel[0] || 0;
			categories.push({
				label: selectedCantrips === 1 ? 'cantrip' : 'cantrips',
				selected: selectedCantrips,
				max: this.maxCantrips,
				color: 'bg-info',
			});
		}

		// Add leveled spells category if applicable
		if (this.maxSpells > 0) {
			const maxSpellLevel = this._getMaxSpellLevel(
				this.className,
				this.currentLevel,
			);
			const selectedLeveled = selectedItems.filter((s) => s.level > 0).length;
			const levelText = ordinals[maxSpellLevel];
			categories.push({
				label: `${levelText} level`,
				selected: selectedLeveled,
				max: this.maxSpells,
				color: 'bg-success',
			});
		}

		// Use the shared helper to format badges
		return formatCategoryCounters(categories);
	}

	/**
	 * Get the maximum spell level available for a class at a given level
	 */
	_getMaxSpellLevel(className, characterLevel) {
		const classData =
			spellSelectionService._getClassSpellcastingInfo(className);
		if (!classData) return 0;

		// Get the class data from classService to check caster progression
		const classInfo = classService.getClass(className);
		const progression = classInfo?.casterProgression;

		let casterLevel = characterLevel;

		// Calculate effective caster level based on progression type
		if (progression === '1/2') {
			casterLevel = Math.floor(characterLevel / 2);
		} else if (progression === '1/3') {
			casterLevel = Math.floor(characterLevel / 3);
		} else if (progression === 'pact') {
			// Warlock uses pact magic - special progression
			// Warlocks gain spell levels: 1st at level 1, 2nd at level 3, 3rd at level 5, 4th at level 7, 5th at level 9
			if (characterLevel >= 9) return 5;
			if (characterLevel >= 7) return 4;
			if (characterLevel >= 5) return 3;
			if (characterLevel >= 3) return 2;
			return 1;
		}

		// Standard spell level progression for full/half/third casters
		// Level 1-2: 1st level spells
		// Level 3-4: 2nd level spells
		// Level 5-6: 3rd level spells
		// Level 7-8: 4th level spells
		// Level 9-10: 5th level spells
		// Level 11-12: 6th level spells
		// Level 13-14: 7th level spells
		// Level 15-16: 8th level spells
		// Level 17+: 9th level spells
		if (casterLevel >= 17) return 9;
		if (casterLevel >= 15) return 8;
		if (casterLevel >= 13) return 7;
		if (casterLevel >= 11) return 6;
		if (casterLevel >= 9) return 5;
		if (casterLevel >= 7) return 4;
		if (casterLevel >= 5) return 3;
		if (casterLevel >= 3) return 2;
		if (casterLevel >= 1) return 1;
		return 0;
	}

	/**
	 * Calculate spell slot and known spell limits
	 */
	_calculateSpellLimits() {
		const classData = spellSelectionService._getClassSpellcastingInfo(
			this.className,
		);
		if (!classData) {
			this.maxSpells = 0;
			this.maxCantrips = 0;
			return;
		}

		// Calculate spells to learn at this specific level
		const previousLevel = this.currentLevel - 1;

		// Calculate cantrips
		const previousCantrips = spellSelectionService._getCantripsKnown(
			this.className,
			previousLevel,
		);
		const currentCantrips = spellSelectionService._getCantripsKnown(
			this.className,
			this.currentLevel,
		);
		this.maxCantrips = currentCantrips - previousCantrips;

		// Handle Wizard separately - they learn spells for their spellbook
		if (this.className === 'Wizard') {
			// Wizard learns spells to add to spellbook (6 at level 1, 2 per level after)
			this.maxSpells = spellSelectionService._getSpellsLearnedAtLevel(
				this.className,
				this.currentLevel,
			);

			return;
		}

		// Get spells known at previous level and current level
		const previousSpellsKnown = spellSelectionService._getSpellsKnownLimit(
			this.className,
			previousLevel,
		);
		const currentSpellsKnown = spellSelectionService._getSpellsKnownLimit(
			this.className,
			this.currentLevel,
		);

		// Calculate new spells = difference between levels
		const newSpells = currentSpellsKnown - previousSpellsKnown;

		// For Warlock and other classes with fixed spells per level
		if (this.className === 'Warlock') {
			// Warlocks learn 1 spell per level (except level 1 which gives 2)
			this.maxSpells = this.currentLevel === 1 ? 2 : 1;
		} else if (
			['Sorcerer', 'Bard', 'Ranger'].includes(this.className)
		) {
			// These classes have spellsKnownProgression or learn a fixed number per level
			this.maxSpells = newSpells > 0 ? newSpells : 2; // Default to 2 if progression not found
		} else if (['Cleric', 'Druid', 'Paladin'].includes(this.className)) {
			// These classes prepare spells - they don't "learn" spells, they prepare from full list
			// So no spell selection during level-up
			this.maxSpells = 0;
		} else {
			// Default: use the difference in spells known
			this.maxSpells = newSpells > 0 ? newSpells : 0;
		}
	}

	/**
	 * Render a single spell item
	 */
	_renderSpellItem(spell, state) {
		const isSelected = state.selectedIds.has(spell.id || spell.name);
		const selectedClass = isSelected ? 'selected' : '';

		const level = typeof spell.level === 'number' ? spell.level : 0;
		const levelText = level === 0 ? 'Cantrip' : `${level}-level`;
		const schoolName = getSchoolName(spell.school) || 'Unknown';
		const ritualBadge = spell.meta?.ritual
			? '<span class="badge bg-info ms-2">Ritual</span>'
			: '';
		const concentrationBadge = spell.duration?.[0]?.concentration
			? '<span class="badge bg-warning ms-2">Concentration</span>'
			: '';

		const castingTime = spell.time
			? `${spell.time[0]?.number || ''} ${spell.time[0]?.unit || ''}`.trim()
			: 'N/A';
		const range = spell.range?.distance
			? `${spell.range.distance.amount || ''} ${spell.range.distance.type || ''}`.trim()
			: spell.range?.type || 'N/A';
		const duration = spell.duration?.[0]?.type || 'N/A';

		const components = [];
		if (spell.components?.v) components.push('V');
		if (spell.components?.s) components.push('S');
		if (spell.components?.m) {
			const material =
				typeof spell.components.m === 'string'
					? spell.components.m
					: spell.components.m?.text || 'material';
			components.push(`M (${material})`);
		}
		const componentsStr = components.length ? components.join(', ') : 'N/A';

		const desc = this._descriptionCache.has(spell.id || spell.name)
			? this._descriptionCache.get(spell.id || spell.name)
			: '<span class="text-muted small">Loading...</span>';

		return `
            <div class="spell-card selector-card ${selectedClass}" data-item-id="${spell.id || spell.name}">
                <div class="spell-card-header">
                    <div>
                        <strong>${spell.name}</strong>
                        <span class="text-muted">(${levelText} ${schoolName})</span>
                    </div>
                    <div>${ritualBadge}${concentrationBadge}</div>
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
                                <strong>Components:</strong> ${componentsStr}
                            </div>
                        </div>
                    </div>
                    <div class="spell-description selector-description">
                        ${desc}
                    </div>
                </div>
            </div>
        `;
	}

	async _fetchSpellDescription(spell) {
		return renderEntriesToText(spell);
	}

	/**
	 * Handle spell selection confirmation
	 */
	async _onSpellsConfirmed(selectedSpells) {
		// Update parent step with full spell objects (not just names)
		if (this.parentStep?.updateSpellSelection) {
			await this.parentStep.updateSpellSelection(
				this.className,
				this.currentLevel,
				selectedSpells,
			);
		}
	}

	/**
	 * Cancel selection and cleanup
	 */
	cancel() {
		if (this._selector) {
			this._selector.cancel();
		}
	}
}
