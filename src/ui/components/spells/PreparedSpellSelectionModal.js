// Modal for preparing known spells using the universal selection modal.

import { AppState } from '../../../app/AppState.js';
import { getSchoolName } from '../../../lib/5eToolsParser.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { spellService } from '../../../services/SpellService.js';
import { FilterBuilder } from '../selection/FilterBuilder.js';
import { formatCategoryCounters, UniversalSelectionModal } from '../selection/UniversalSelectionModal.js';

export class PreparedSpellSelectionModal {
    constructor({ classNames = [] } = {}) {
        this.classNames = Array.isArray(classNames) ? classNames : [];
        this._controller = null;
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
        this._ensureController();

        return await this._controller.show(this._getContext());
    }

    _getContext() {
        return {
            character: AppState.getCurrentCharacter(),
            classNames: this.classNames,
        };
    }

    _ensureController() {
        if (this._controller) return;

        this._controller = new UniversalSelectionModal({
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

        for (const className of ctx.classNames) {
            const classData = character?.spellcasting?.classes?.[className];
            const known = classData?.spellsKnown || [];

            for (const spell of known) {
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

        for (const className of ctx.classNames) {
            const classData = character?.spellcasting?.classes?.[className];
            const prepared = classData?.spellsPrepared || [];
            for (const spell of prepared) {
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
        const categories = this.classNames.map((className) => {
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

    _handleConfirm(selected, ctx) {
        const character = ctx.character;
        if (!character) return;

        const byClass = new Map();
        for (const item of selected || []) {
            if (!byClass.has(item.className)) byClass.set(item.className, []);
            byClass.get(item.className).push(item);
        }

        for (const className of ctx.classNames) {
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
        panel.innerHTML = '';

        this.levelFilters = this.levelFilters || new Set();
        this.schoolFilters = this.schoolFilters || new Set();
        this.ritualOnly = this.ritualOnly ?? null;
        this.concentrationOnly = this.concentrationOnly ?? null;
        this.noVerbal = this.noVerbal ?? null;
        this.noSomatic = this.noSomatic ?? null;
        this.noMaterial = this.noMaterial ?? null;

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
    }
}
