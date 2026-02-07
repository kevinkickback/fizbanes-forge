// Modal for preparing known spells using the universal selection modal.

import { AppState } from '../../../app/AppState.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { BaseSelectorModal, formatCategoryCounters } from '../selection/BaseSelectorModal.js';
import { ClassSwitcher } from '../selection/ClassSwitcher.js';
import { FilterBuilder } from '../selection/FilterBuilder.js';

export class PreparedSpellSelectorModal {
    constructor({ classNames = [] } = {}) {
        this.classNames = Array.isArray(classNames) ? classNames : [];
        this.selectedClassName = null; // Track currently selected class for switcher
        this.classSwitcher = null;
        this._controller = null;
        this._sessionSelections = new Map(); // Track selections per class during modal session
    }

    async show() {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return null;
        }

        const eligibleClasses = this._getPreparedClasses(character, this.classNames);
        if (eligibleClasses.length === 0) {
            showNotification('No prepared spell classes available', 'warning');
            return null;
        }

        this.classNames = eligibleClasses;

        // Initialize session selections with current prepared spells for each class
        this._sessionSelections.clear();
        for (const className of eligibleClasses) {
            const classData = character?.spellcasting?.classes?.[className];
            const prepared = classData?.spellsPrepared || [];
            const ids = new Set(
                prepared
                    .filter(spell => spell.level !== 0) // Exclude cantrips
                    .map(spell => this._buildItemId(className, spell))
            );
            this._sessionSelections.set(className, ids);
        }

        // Initialize selectedClassName to first eligible class
        if (!this.selectedClassName || !eligibleClasses.includes(this.selectedClassName)) {
            this.selectedClassName = eligibleClasses[0];
        }

        this._ensureController();

        // Wire up class switcher after modal is shown (for multiclass)
        if (this.classNames.length > 1) {
            setTimeout(() => {
                const modal = document.getElementById('preparedSpellSelectionModal');
                if (modal) {
                    const footer = modal.querySelector('.modal-footer');
                    if (footer) {
                        this.classSwitcher = new ClassSwitcher({
                            container: footer,
                            classes: this.classNames,
                            selectedClass: this.selectedClassName,
                            onChange: (newClassName) => this._handleClassChange(newClassName),
                            selectorId: 'preparedSpellClassSelector',
                            label: 'Current Class:',
                        });
                        this.classSwitcher.render();
                    }
                }
            }, 100);
        }

        return await this._controller.show(this._getContext());
    }

    _getContext() {
        return {
            character: AppState.getCurrentCharacter(),
            classNames: this.classNames,
            selectedClassName: this.selectedClassName,
        };
    }

    async _handleClassChange(newClassName) {
        if (newClassName === this.selectedClassName) return;

        // Save current class's selections before switching
        if (this.selectedClassName && this._controller?.state?.selectedIds) {
            this._sessionSelections.set(
                this.selectedClassName,
                new Set(this._controller.state.selectedIds)
            );
        }

        this.selectedClassName = newClassName;

        // Get selections for the new class from session cache
        const cachedSelectionIds = this._sessionSelections.get(newClassName) || new Set();

        // Update controller's selection state with cached selections
        if (this._controller?.state) {
            this._controller.state.selectedIds = new Set(cachedSelectionIds);
            this._controller.state.selectedItems = this._controller.state.items.filter(item =>
                cachedSelectionIds.has(this._controller.config.getItemId(item))
            );
        }

        // Reload items with new class filter
        await this._controller._reloadItems();

        // Update display
        this._controller._renderList();
        this._controller._renderSelected();
        this._controller._updateConfirmButton();
    }

    _ensureController() {
        if (this._controller) return;

        this._controller = new BaseSelectorModal({
            modalId: 'preparedSpellSelectionModal',
            modalTitle: 'Prepare Spells',
            allowClose: true,
            pageSize: 50,
            listContainerSelector: '.spell-list-container',
            selectedContainerSelector: '.selected-spells-container',
            searchInputSelector: '.spell-search-input',
            filterToggleSelector: '.spell-filter-toggle-btn',
            filterPanelSelector: '.spell-filters-column',
            confirmSelector: '.btn-confirm',
            cancelSelector: '.btn-cancel',
            itemIdAttribute: 'data-prepared-spell-id',
            selectionMode: 'multiple',
            selectionLimit: null,
            getContext: () => this._getContext(),
            getInitialSelection: (ctx) => this._getInitialSelection(ctx),
            loadItems: (ctx) => this._loadKnownSpells(ctx),
            matchItem: (item, state) => this._matchItem(item, state),
            renderItem: (item, state) => this._renderSpellCard(item, state),
            getItemId: (item) => item.id,
            canSelectItem: (item, state) => this._canSelectItem(item, state),
            onSelectBlocked: (item) => this._onSelectBlocked(item),
            onConfirm: (selected, ctx) => this._handleConfirm(selected, ctx),
            onCancel: () => { },
            buildFilters: (ctx, panel, cleanup) =>
                this._buildFilters(ctx, panel, cleanup),
            customCountFn: (selectedItems) =>
                this._getCountDisplay(selectedItems),
        });
    }

    _getPreparedClasses(character, preferred = []) {
        const classNames = Object.keys(character?.spellcasting?.classes || {});
        const eligible = classNames.filter((className) => {
            const classData = character.spellcasting.classes[className];
            const classLevel = classData?.level || 1;
            const limitInfo = spellSelectionService.getSpellLimitInfo(
                character,
                className,
                classLevel,
            );
            return limitInfo?.type === 'prepared';
        });

        if (preferred.length === 0) return eligible;

        return preferred.filter((name) => eligible.includes(name));
    }

    _loadKnownSpells(ctx) {
        const character = ctx.character;
        const items = [];

        // Filter to show only selected class if switcher is active
        const targetClasses = ctx.selectedClassName ? [ctx.selectedClassName] : ctx.classNames;

        for (const className of targetClasses) {
            const classData = character?.spellcasting?.classes?.[className];
            const known = classData?.spellsKnown || [];

            for (const spell of known) {
                // Skip cantrips (level 0) - they're always prepared
                if (spell.level === 0) continue;

                items.push({
                    id: this._buildItemId(className, spell),
                    name: spell.name,
                    className,
                    spell,
                });
            }
        }

        return items.sort((a, b) => {
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;
            return a.className.localeCompare(b.className);
        });
    }

    _getInitialSelection(ctx) {
        const character = ctx.character;
        const selectedIds = [];

        // Filter to show only selected class if switcher is active
        const targetClasses = ctx.selectedClassName ? [ctx.selectedClassName] : ctx.classNames;

        for (const className of targetClasses) {
            const classData = character?.spellcasting?.classes?.[className];
            const prepared = classData?.spellsPrepared || [];
            for (const spell of prepared) {
                // Skip cantrips - they're always prepared
                if (spell.level === 0) continue;
                selectedIds.push(this._buildItemId(className, spell));
            }
        }

        return selectedIds;
    }

    _matchItem(item, state) {
        const term = (state.searchTerm || '').trim().toLowerCase();
        if (term) {
            const name = (item.name || '').toLowerCase();
            const className = (item.className || '').toLowerCase();
            if (!name.includes(term) && !className.includes(term)) return false;
        }

        const spell = item.spell || {};

        // Apply level filters
        if (this.levelFilters && this.levelFilters.size > 0) {
            const lvl = Number(spell.level || 0);
            if (!this.levelFilters.has(String(lvl))) return false;
        }

        // Apply school filters
        if (this.schoolFilters && this.schoolFilters.size > 0) {
            const school = spell.school || '';
            if (!this.schoolFilters.has(school)) return false;
        }

        // Apply ritual filter
        if (this.ritualOnly === true) {
            if (!spell.meta?.ritual) return false;
        }

        // Apply concentration filter
        if (this.concentrationOnly === true) {
            if (!spell.duration?.[0]?.concentration) return false;
        }

        // Apply component filters
        if (this.noVerbal === true) {
            if (spell.components?.v) return false;
        }
        if (this.noSomatic === true) {
            if (spell.components?.s) return false;
        }
        if (this.noMaterial === true) {
            if (spell.components?.m) return false;
        }

        return true;
    }

    _renderSpellCard(item, state) {
        const isSelected = state?.selectedIds?.has(item.id);
        const spell = item.spell || {};
        const level = Number(spell.level || 0);
        const levelLabel = level === 0 ? 'Cantrip' : `${level}${this._getLevelSuffix(level)} Level`;
        const ritual = spell.meta?.ritual
            ? '<span class="badge bg-info ms-1">Ritual</span>'
            : '';
        const concentration = spell.duration?.[0]?.concentration
            ? '<span class="badge bg-warning ms-1">Concentration</span>'
            : '';
        const classBadge = `<span class="badge ${this._getClassBadgeColor(item.className)} ms-1">${item.className}</span>`;
        const levelBadge = `<span class="badge bg-secondary ms-1">${levelLabel}</span>`;

        return `
			<div class="spell-card ${isSelected ? 'selected' : ''}" data-prepared-spell-id="${item.id}">
				<div class="spell-card-header">
					<div>
						<strong>${item.name}</strong>
						${classBadge}${levelBadge}${ritual}${concentration}
					</div>
				</div>
			</div>
		`;
    }

    _canSelectItem(item, state) {
        const character = AppState.getCurrentCharacter();
        if (!character) return false;

        const classData = character?.spellcasting?.classes?.[item.className];
        const classLevel = classData?.level || 1;
        const limit = spellSelectionService._getPreparedSpellLimit(
            character,
            item.className,
            classLevel,
        );

        const selectedCount = this._getSelectedCountForClass(
            state.selectedItems,
            item.className,
        );

        return selectedCount < limit;
    }

    _onSelectBlocked(item) {
        const character = AppState.getCurrentCharacter();
        const classData = character?.spellcasting?.classes?.[item.className];
        const classLevel = classData?.level || 1;
        const limit = spellSelectionService._getPreparedSpellLimit(
            character,
            item.className,
            classLevel,
        );
        showNotification(
            `Prepared spell limit reached for ${item.className} (${limit}).`,
            'warning',
        );
    }

    _getCountDisplay(selectedItems) {
        const character = AppState.getCurrentCharacter();
        // If a class is selected via switcher, show only that class's count
        const targetClasses = this.selectedClassName ? [this.selectedClassName] : this.classNames;
        const categories = targetClasses.map((className) => {
            const classData = character?.spellcasting?.classes?.[className];
            const classLevel = classData?.level || 1;
            const max = spellSelectionService._getPreparedSpellLimit(
                character,
                className,
                classLevel,
            );
            return {
                label: className,
                selected: this._getSelectedCountForClass(selectedItems, className),
                max,
                color: this._getClassBadgeColor(className),
            };
        });

        return formatCategoryCounters(categories);
    }

    _getSelectedCountForClass(selectedItems, className) {
        return (selectedItems || []).filter(
            (item) => item.className === className,
        ).length;
    }

    _handleConfirm(_selected, ctx) {
        const character = ctx.character;
        if (!character) return;

        // Save final selections for current class before confirming
        if (this.selectedClassName && this._controller?.state?.selectedIds) {
            this._sessionSelections.set(
                this.selectedClassName,
                new Set(this._controller.state.selectedIds)
            );
        }

        // Build a map of class -> spell items from session selections
        // Need to load all known spells for all classes to reconstruct the items
        const byClass = new Map();
        for (const className of this.classNames) {
            byClass.set(className, []);
            const classData = character?.spellcasting?.classes?.[className];
            const known = classData?.spellsKnown || [];
            const selectedIds = this._sessionSelections.get(className) || new Set();

            // Reconstruct spell items from known spells that match selected IDs
            for (const spell of known) {
                const itemId = this._buildItemId(className, spell);
                if (selectedIds.has(itemId)) {
                    byClass.get(className).push({
                        name: spell.name,
                        className,
                    });
                }
            }
        }

        // Use all classNames to save across all classes
        for (const className of this.classNames) {
            const classData = character.spellcasting?.classes?.[className];
            if (!classData) continue;

            const desired = new Set(
                (byClass.get(className) || []).map((item) => item.name),
            );
            const existing = new Set(
                (classData.spellsPrepared || []).map((spell) => spell.name),
            );

            for (const spellName of existing) {
                if (!desired.has(spellName)) {
                    spellSelectionService.unprepareSpell(
                        character,
                        className,
                        spellName,
                    );
                }
            }

            for (const spellName of desired) {
                if (!existing.has(spellName)) {
                    spellSelectionService.prepareSpell(
                        character,
                        className,
                        spellName,
                    );
                }
            }
        }

        eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
    }

    _buildItemId(className, spell) {
        const source = (spell?.source || 'PHB').toLowerCase();
        return `${className}|${spell?.name || ''}|${source}`
            .toLowerCase()
            .replace(/\s+/g, '-');
    }

    _getClassBadgeColor(className) {
        const map = {
            Bard: 'bg-primary',
            Cleric: 'bg-primary',
            Druid: 'bg-success',
            Paladin: 'bg-warning',
            Ranger: 'bg-info',
            Wizard: 'bg-secondary',
            Warlock: 'bg-dark',
        };
        return map[className] || 'bg-secondary';
    }

    _getLevelSuffix(level) {
        const suffixes = ['', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'];
        return suffixes[level] || 'th';
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
        });
    }
}
