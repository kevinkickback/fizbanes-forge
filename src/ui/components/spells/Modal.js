// Modal for selecting and adding spells to character spellcasting

import { AppState } from '../../../app/AppState.js';
import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../../../lib/EventBus.js';
import { showNotification } from '../../../lib/Notifications.js';
import { textProcessor } from '../../../lib/TextProcessor.js';
import { sourceService } from '../../../services/SourceService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { spellService } from '../../../services/SpellService.js';

export class SpellSelectionModal {
    constructor({ className = null, allowClose = true } = {}) {
        this.className = className;
        this.allowClose = allowClose;
        this.modal = null;
        this.bootstrapModal = null;
        this.validSpells = [];
        this.filteredSpells = [];
        this.searchTerm = '';
        this.selectedSpells = []; // Changed to array for multi-select
        this.selectedSources = new Set();
        this.ignoreClassRestrictions = false; // Toggle for showing spells from all classes

        // Filter state
        this.filters = {
            level: new Set(), // 0-9 (cantrip=0)
            school: new Set(), // Abjuration, Conjuration, etc.
            castingClass: new Set(), // Wizard, Cleric, etc.
            ritual: null, // null=any, true=ritual only, false=non-ritual only
            concentration: null, // null=any, true=concentration, false=no concentration
        };

        // Performance optimization
        this.descriptionCache = new Map(); // Cache processed descriptions
        this.filterDebounceTimer = null; // Debounce filter operations
        this.scrollTimeout = null; // Debounce scroll events

        // DOM cleanup manager
        this._cleanup = DOMCleanup.create();
        this._descriptionProcessingTimer = null; // Background description processing

        // Virtual scrolling parameters
        this.spellsPerPage = 50; // Render 50 spells at a time
        this.currentPage = 0;
    }

    async show() {
        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return null;
        }

        // Determine which class to add spells for
        if (!this.className) {
            // If no class specified, use primary class
            if (!character.class || !character.class.name) {
                showNotification('Character has no class selected', 'error');
                return null;
            }
            this.className = character.class.name;
        }

        try {
            await this._loadValidSpells(character);
            this.filteredSpells = this.validSpells;
            this.selectedSpells = []; // Reset selections

            // Get the modal element from DOM
            this.modal = document.getElementById('spellSelectionModal');
            if (!this.modal) {
                console.error('[SpellSelectionModal]', 'Modal element not found in DOM');
                showNotification('Could not open spell selection modal', 'error');
                return null;
            }

            await this._renderSpellList();
            this._attachEventListeners();

            // Set initial state of restrictions checkbox
            const ignoreRestrictionsCheckbox = this.modal.querySelector('#ignoreSpellRestrictionsToggle');
            if (ignoreRestrictionsCheckbox) {
                ignoreRestrictionsCheckbox.checked = this.ignoreClassRestrictions;
            }

            // Dispose old Bootstrap modal instance if exists
            if (this.bootstrapModal) {
                try {
                    this.bootstrapModal.dispose();
                } catch (e) {
                    console.warn('[SpellSelectionModal]', 'Error disposing old modal', e);
                }
            }

            // Create new Bootstrap modal instance
            this.bootstrapModal = new bootstrap.Modal(this.modal, {
                backdrop: true,
                keyboard: this.allowClose,
            });

            // Register with cleanup manager
            this._cleanup.registerBootstrapModal(this.modal, this.bootstrapModal);

            // Setup cleanup on modal hide
            this._cleanup.once(this.modal, 'hidden.bs.modal', () => this._onModalHidden());

            this.bootstrapModal.show();

            // Return promise that resolves when spell is added or modal closes
            return new Promise((resolve) => {
                this._resolvePromise = resolve;
            });
        } catch (error) {
            console.error('[SpellSelectionModal]', 'Error showing modal', error);
            showNotification('Failed to open spell selection modal', 'error');
            return null;
        }
    }

    async _loadValidSpells(character) {
        const allSpells = spellService.getAllSpells();
        const allowedSources = sourceService.getAllowedSources();

        // Filter spells available for the selected class
        this.validSpells = allSpells
            .filter((spell) => {
                // Check if source is allowed
                const spellSource = (spell.source || '').toLowerCase();
                const isSourceAllowed = allowedSources.some(
                    (s) => s.toLowerCase() === spellSource,
                );
                if (!isSourceAllowed) return false;

                // Check if spell is available for this class (unless restrictions ignored)
                if (!this.ignoreClassRestrictions) {
                    const isAvailableForClass = spellService.isSpellAvailableForClass(spell, this.className);
                    if (!isAvailableForClass) return false;
                }

                // Check if already known
                const classSpellcasting = character.spellcasting?.classes?.[this.className];
                if (classSpellcasting?.spellsKnown) {
                    const isKnown = classSpellcasting.spellsKnown.some(
                        (s) => s.name === spell.name && s.source === spell.source,
                    );
                    if (isKnown) return false;
                }

                return true;
            })
            .map((spell, index) => ({
                ...spell,
                id: spell.id || `spell-${index}`,
            }));

        console.info('[SpellSelectionModal]', 'Loaded spells for class', {
            className: this.className,
            count: this.validSpells.length,
        });
    }

    async _renderSpellList() {
        const listContainer = this.modal.querySelector('.spell-list-container');
        if (!listContainer) {
            console.warn('[SpellSelectionModal]', 'List container not found');
            return;
        }

        // Apply filters
        this.filteredSpells = this.validSpells.filter((spell) =>
            this._spellMatchesFilters(spell),
        );

        // Calculate pagination
        const startIdx = this.currentPage * this.spellsPerPage;
        const endIdx = startIdx + this.spellsPerPage;
        const spellsToRender = this.filteredSpells.slice(startIdx, endIdx);

        // Build HTML without awaiting descriptions
        let html = '';

        if (this.filteredSpells.length === 0) {
            html = '<div class="alert alert-info">No spells match your filters.</div>';
        } else {
            for (const spell of spellsToRender) {
                const level = spell.level !== undefined ? spell.level : 0;
                const levelText = level === 0 ? 'Cantrip' : `${level}${this._getOrdinalSuffix(level)}-level`;
                const school = spell.school || 'Unknown';
                const castingTime = spell.time ? `${spell.time[0]?.number || ''} ${spell.time[0]?.unit || ''}`.trim() : 'N/A';
                const range = spell.range ? `${spell.range.distance?.amount || ''} ${spell.range.distance?.type || ''}`.trim() : 'N/A';
                const duration = spell.duration ? spell.duration[0]?.type || 'N/A' : 'N/A';

                // Parse components
                let components = 'N/A';
                let materialDesc = '';
                if (spell.components) {
                    const parts = [];
                    if (spell.components.v) parts.push('V');
                    if (spell.components.s) parts.push('S');
                    if (spell.components.m) {
                        parts.push('M');
                        materialDesc = typeof spell.components.m === 'string' ? spell.components.m : '';
                    }
                    components = parts.length > 0 ? parts.join(', ') : 'N/A';
                }

                const ritual = spell.meta?.ritual ? '<span class="badge bg-info ms-2">Ritual</span>' : '';
                const concentration = spell.duration?.[0]?.concentration ? '<span class="badge bg-warning ms-2">Concentration</span>' : '';

                // Use cached description or placeholder
                const description = this.descriptionCache.has(spell.id)
                    ? this.descriptionCache.get(spell.id)
                    : '<span class="text-muted small">Loading...</span>';

                const isSelected = this.selectedSpells.some(s => s.id === spell.id);
                const selectedClass = isSelected ? 'selected' : '';

                html += `
                    <div class="spell-card ${selectedClass}" data-spell-id="${spell.id}">
                        <div class="spell-card-header">
                            <div>
                                <strong>${spell.name}</strong> <span class="text-muted">(${levelText} ${school})</span>
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
                                        <strong>Components:</strong> ${components}
                                        ${materialDesc ? `<br><span class="text-muted small">(${materialDesc})</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="spell-description">
                                ${description}
                            </div>
                        </div>
                    </div>
                `;
            }

            // Add "load more" button if there are more spells
            if (endIdx < this.filteredSpells.length) {
                html += `
                    <div class="text-center mt-3">
                        <button class="btn btn-sm btn-outline-secondary" id="loadMoreSpells">
                            Load More (${this.filteredSpells.length - endIdx} remaining)
                        </button>
                    </div>
                `;
            }
        }

        listContainer.innerHTML = html;

        // Attach load more handler
        const loadMoreBtn = listContainer.querySelector('#loadMoreSpells');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.currentPage++;
                this._renderSpellList();
            });
        }

        // Render selected spells list
        this._renderSelectedSpellsList();

        // Attach spell selection listeners
        const spellCards = listContainer.querySelectorAll('.spell-card');
        console.log('[SpellSelectionModal]', 'Found spell cards:', spellCards.length);
        spellCards.forEach((card) => {
            card.addEventListener('click', () => {
                const spellId = card.dataset.spellId;
                this._toggleSpellSelection(spellId);
            });
        });

        // Process descriptions asynchronously in background without blocking render
        this._processDescriptionsInBackground();
    }

    _processDescriptionsInBackground() {
        // Process spells that don't have cached descriptions yet
        const spellsNeedingDesc = this.filteredSpells.filter(
            (spell) => !this.descriptionCache.has(spell.id)
        );

        if (spellsNeedingDesc.length === 0) return;

        // Process one at a time without blocking
        let index = 0;
        const processNext = async () => {
            if (index >= spellsNeedingDesc.length) return;

            const spell = spellsNeedingDesc[index];
            index++;

            try {
                if (!this.descriptionCache.has(spell.id)) {
                    let description = 'No description';
                    if (spell.entries && spell.entries.length > 0) {
                        const descParts = [];
                        for (const entry of spell.entries) {
                            if (typeof entry === 'string') {
                                descParts.push(await textProcessor.processString(entry));
                            } else if (entry?.entries && Array.isArray(entry.entries)) {
                                for (const subEntry of entry.entries) {
                                    if (typeof subEntry === 'string') {
                                        descParts.push(await textProcessor.processString(subEntry));
                                    }
                                }
                            }
                        }
                        description = descParts.join(' ');
                    }
                    this.descriptionCache.set(spell.id, description);

                    // Update the DOM for this spell if it's still visible
                    const card = this.modal?.querySelector(`[data-spell-id="${spell.id}"] .spell-description`);
                    if (card) {
                        card.innerHTML = description;
                    }
                }
            } catch (error) {
                console.error('[SpellSelectionModal]', 'Error processing description:', error);
            }

            // Process next spell after a tiny delay to avoid blocking
            setTimeout(processNext, 0);
        };

        processNext();
    }

    _getOrdinalSuffix(num) {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) return 'st';
        if (j === 2 && k !== 12) return 'nd';
        if (j === 3 && k !== 13) return 'rd';
        return 'th';
    }

    _toggleSpellSelection(spellId) {
        const spell = this.validSpells.find(s => s.id === spellId);
        if (!spell) return;

        const index = this.selectedSpells.findIndex(s => s.id === spellId);
        if (index >= 0) {
            // Deselect
            this.selectedSpells.splice(index, 1);
        } else {
            // Select
            this.selectedSpells.push(spell);
        }

        // Update only the visual state of the card without full re-render
        const card = this.modal?.querySelector(`[data-spell-id="${spellId}"]`);
        if (card) {
            card.classList.toggle('selected');
        }

        // Update selected spells list
        this._renderSelectedSpellsList();
        this._updateAddButtonState();
    }

    _renderSelectedSpellsList() {
        const container = this.modal.querySelector('.selected-spells-container');
        if (!container) return;

        if (this.selectedSpells.length === 0) {
            container.innerHTML = '<p class="text-muted small mb-0">No spells selected</p>';
            return;
        }

        let html = '<div class="selected-spells-list">';
        for (const spell of this.selectedSpells) {
            html += `
                <span class="badge bg-secondary me-2 mb-2">
                    ${spell.name}
                    <button class="btn-close btn-close-white ms-2" data-deselect-spell="${spell.id}" style="font-size: 0.7rem;"></button>
                </span>
            `;
        }
        html += '</div>';

        container.innerHTML = html;

        // Attach deselect handlers
        const deselectButtons = container.querySelectorAll('[data-deselect-spell]');
        deselectButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const spellId = btn.dataset.deselectSpell;
                this._toggleSpellSelection(spellId);
            });
        });
    }

    _updateAddButtonState() {
        const addButton = this.modal.querySelector('.btn-add-spell');
        if (addButton) {
            addButton.disabled = this.selectedSpells.length === 0;
            const count = this.selectedSpells.length;
            const buttonText = count > 0
                ? `Add ${count} Spell${count > 1 ? 's' : ''}`
                : 'Add Spell';
            addButton.innerHTML = `<i class="fas fa-plus"></i> ${buttonText}`;
        }
    }

    _spellMatchesFilters(spell) {
        // Search term
        if (this.searchTerm && !spell.name.toLowerCase().includes(this.searchTerm.toLowerCase())) {
            return false;
        }

        // Source filter
        if (this.selectedSources.size > 0) {
            if (!this.selectedSources.has(spell.source)) {
                return false;
            }
        }

        // Spell level filter
        if (this.filters.level.size > 0) {
            const spellLevel = spell.level !== undefined ? spell.level : 0;
            if (!Array.from(this.filters.level).some((l) => parseInt(l, 10) === spellLevel)) {
                return false;
            }
        }

        // School filter
        if (this.filters.school.size > 0) {
            const spellSchool = (spell.school || 'Unknown').toLowerCase();
            if (!Array.from(this.filters.school).some(
                (s) => s.toLowerCase() === spellSchool,
            )) {
                return false;
            }
        }

        // Casting class filter
        if (this.filters.castingClass.size > 0) {
            if (spell.classes && Array.isArray(spell.classes)) {
                if (!spell.classes.some((cls) =>
                    Array.from(this.filters.castingClass).some((f) => f.toLowerCase() === cls.toLowerCase()),
                )) {
                    return false;
                }
            }
        }

        // Ritual filter
        if (this.filters.ritual !== null) {
            const isRitual = spell.meta?.ritual || false;
            if (this.filters.ritual !== isRitual) {
                return false;
            }
        }

        // Concentration filter
        if (this.filters.concentration !== null) {
            const needsConcentration = spell.duration?.[0]?.concentration || false;
            if (this.filters.concentration !== needsConcentration) {
                return false;
            }
        }

        return true;
    }

    /**
     * Update the spell preview panel.
     * @private
     */
    _updateSpellPreview() {
        console.log('[SpellSelectionModal]', '_updateSpellPreview called');
        const previewContainer = this.modal.querySelector('.spell-preview-container');
        console.log('[SpellSelectionModal]', 'Preview container found:', !!previewContainer);
        console.log('[SpellSelectionModal]', 'Selected spell:', this.selectedSpell);
        if (!previewContainer || !this.selectedSpell) return;

        const spell = this.selectedSpell;
        const level = spell.level !== undefined ? spell.level : 0;
        const school = spell.school || 'Unknown';
        const castingTime = spell.time ? spell.time[0]?.number + spell.time[0]?.unit : 'N/A';
        const range = spell.range ? `${spell.range.distance?.amount} ${spell.range.distance?.type}` : 'N/A';
        const duration = spell.duration ? spell.duration[0]?.type : 'N/A';

        // Parse components (V, S, M)
        let components = 'N/A';
        if (spell.components) {
            const parts = [];
            if (spell.components.v) parts.push('V');
            if (spell.components.s) parts.push('S');
            if (spell.components.m) {
                const material = typeof spell.components.m === 'string' ? spell.components.m : 'material component';
                parts.push(`M (${material})`);
            }
            components = parts.length > 0 ? parts.join(', ') : 'N/A';
        }

        const ritual = spell.meta?.ritual ? 'Yes' : 'No';
        const concentration = spell.concentration ? 'Yes' : 'No';
        const description = spell.entries
            ? spell.entries.map((e) => typeof e === 'string' ? e : '').join('\n\n')
            : 'No description available';

        previewContainer.innerHTML = `
			<div class="card">
				<div class="card-header">
					<h5>${spell.name}</h5>
				</div>
				<div class="card-body">
					<div class="row mb-3">
						<div class="col-md-6">
							<p><strong>Level:</strong> ${level}</p>
							<p><strong>School:</strong> ${school}</p>
							<p><strong>Casting Time:</strong> ${castingTime}</p>
						</div>
						<div class="col-md-6">
							<p><strong>Range:</strong> ${range}</p>
							<p><strong>Duration:</strong> ${duration}</p>
							<p><strong>Ritual:</strong> ${ritual}</p>
						</div>
					</div>
					<div class="row mb-3">
						<div class="col-12">
							<p><strong>Components:</strong> ${components}</p>
							<p><strong>Concentration:</strong> ${concentration}</p>
						</div>
					</div>
					<hr>
					<div class="description">
						<small>${description}</small>
					</div>
				</div>
			</div>
		`;

        // Update add button state
        const addButton = this.modal.querySelector('.btn-add-spell');
        console.log('[SpellSelectionModal]', 'Add button found:', !!addButton);
        if (addButton) {
            addButton.disabled = false;
            console.log('[SpellSelectionModal]', 'Add button enabled');
        }
    }

    _setupSourceDropdown() {
        try {
            const toggle = this.modal.querySelector('.spell-source-toggle');
            const menu = this.modal.querySelector('.spell-source-menu');

            if (!toggle || !menu) {
                console.warn('[SpellSelectionModal]', 'Source dropdown elements not found');
                return;
            }

            // Collect all unique sources from valid spells
            const sources = new Set();
            this.validSpells.forEach(spell => {
                if (spell.source) {
                    sources.add(spell.source);
                }
            });

            // Sort sources alphabetically
            const sortedSources = Array.from(sources).sort();

            // Build dropdown menu
            let html = '<a class="dropdown-item" data-source="">All sources</a>';

            sortedSources.forEach(source => {
                try {
                    const sourceName = sourceService.getSourceName(source) || source;
                    html += `<a class="dropdown-item" data-source="${source}">${sourceName}</a>`;
                } catch (err) {
                    console.warn('[SpellSelectionModal]', 'Error getting source name for', source, err);
                    html += `<a class="dropdown-item" data-source="${source}">${source}</a>`;
                }
            });

            menu.innerHTML = html;

            // Setup dropdown behavior
            const dropdown = this.modal.querySelector('.spell-source-dropdown');

            this._cleanup.on(toggle, 'click', (e) => {
                e.stopPropagation();
                const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', !isExpanded);
                menu.classList.toggle('show');
            });

            // Handle source selection
            const items = menu.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                this._cleanup.on(item, 'click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const source = item.dataset.source;

                    // Remove active class from all items
                    items.forEach(i => {
                        i.classList.remove('active');
                    });
                    item.classList.add('active');

                    // Update selected source
                    if (source) {
                        this.selectedSources = new Set([source]);
                        toggle.textContent = item.textContent;
                    } else {
                        this.selectedSources = new Set();
                        toggle.textContent = 'All sources';
                    }

                    // Close dropdown
                    menu.classList.remove('show');
                    toggle.setAttribute('aria-expanded', 'false');

                    // Re-render spell list with debounce
                    this._debouncedRenderSpellList();
                });
            });

            // Close dropdown when clicking outside
            const closeHandler = (e) => {
                if (dropdown && !dropdown.contains(e.target)) {
                    menu.classList.remove('show');
                    toggle.setAttribute('aria-expanded', 'false');
                }
            };
            this._cleanup.on(document, 'click', closeHandler);
        } catch (error) {
            console.error('[SpellSelectionModal]', 'Error setting up source dropdown', error);
        }
    }

    _attachEventListeners() {
        // Search input with debounce
        const searchInput = this.modal.querySelector('.spell-search-input');
        if (searchInput) {
            this._cleanup.on(searchInput, 'input', (e) => {
                this.searchTerm = e.target.value;
                this._debouncedRenderSpellList();
            });
        }

        // Filter toggle button
        const filterToggleBtn = this.modal.querySelector('#spellFilterToggleBtn');
        if (filterToggleBtn) {
            this._cleanup.on(filterToggleBtn, 'click', () => {
                const filtersPanel = this.modal.querySelector('#spellFiltersPanel');
                if (filtersPanel) {
                    const isVisible = filterToggleBtn.getAttribute('data-filters-visible') === 'true';
                    filtersPanel.classList.toggle('collapsed');
                    filterToggleBtn.setAttribute('data-filters-visible', !isVisible);
                }
            });
        }

        // Restrictions checkbox
        const ignoreRestrictionsCheckbox = this.modal.querySelector('#ignoreSpellRestrictionsToggle');
        if (ignoreRestrictionsCheckbox) {
            // Create and store the handler
            this._restrictionsToggleHandler = async () => {
                this.ignoreClassRestrictions = ignoreRestrictionsCheckbox.checked;
                // Reload valid spells with new restriction setting
                const character = AppState.getCurrentCharacter();
                await this._loadValidSpells(character);
                this.filteredSpells = this.validSpells;
                this._renderSpellList();
            };

            this._cleanup.on(ignoreRestrictionsCheckbox, 'change', this._restrictionsToggleHandler);
        }

        // Source filter dropdown
        this._setupSourceDropdown();

        // Spell level filter checkboxes
        const levelCheckboxes = this.modal.querySelectorAll('[data-filter-type="level"]');
        levelCheckboxes.forEach((checkbox) => {
            this._cleanup.on(checkbox, 'change', () => {
                if (checkbox.checked) {
                    this.filters.level.add(checkbox.value);
                } else {
                    this.filters.level.delete(checkbox.value);
                }
                this._debouncedRenderSpellList();
            });
        });

        // School filter checkboxes
        const schoolCheckboxes = this.modal.querySelectorAll('[data-filter-type="school"]');
        schoolCheckboxes.forEach((checkbox) => {
            this._cleanup.on(checkbox, 'change', () => {
                if (checkbox.checked) {
                    this.filters.school.add(checkbox.value);
                } else {
                    this.filters.school.delete(checkbox.value);
                }
                this._debouncedRenderSpellList();
            });
        });

        // Ritual filter
        const ritualCheckbox = this.modal.querySelector('[data-filter-type="ritual"]');
        if (ritualCheckbox) {
            this._cleanup.on(ritualCheckbox, 'change', () => {
                if (ritualCheckbox.checked) {
                    this.filters.ritual = true;
                } else {
                    this.filters.ritual = null;
                }
                this._debouncedRenderSpellList();
            });
        }

        // Concentration filter
        const concentrationCheckbox = this.modal.querySelector('[data-filter-type="concentration"]');
        if (concentrationCheckbox) {
            this._cleanup.on(concentrationCheckbox, 'change', () => {
                if (concentrationCheckbox.checked) {
                    this.filters.concentration = true;
                } else {
                    this.filters.concentration = null;
                }
                this._debouncedRenderSpellList();
            });
        }

        // Add button
        const addButton = this.modal.querySelector('.btn-add-spell');
        if (addButton) {
            this._cleanup.on(addButton, 'click', () => this._handleAddSpell());
        }

        // Cancel button
        const cancelButton = this.modal.querySelector('.btn-cancel-spell');
        if (cancelButton) {
            this._cleanup.on(cancelButton, 'click', () => this._handleCancel());
        }

        // Close modal on Escape
        if (this.allowClose) {
            this._cleanup.on(this.modal, 'keydown', (e) => {
                if (e.key === 'Escape') {
                    this._handleCancel();
                }
            });
        }
    }

    _debouncedRenderSpellList() {
        if (this.filterDebounceTimer) {
            this._cleanup.clearTimer(this.filterDebounceTimer);
        }
        this.currentPage = 0; // Reset to first page when filtering
        this.filterDebounceTimer = this._cleanup.setTimeout(() => {
            this._renderSpellList();
        }, 150); // 150ms debounce for responsive feel
    }

    _handleAddSpell() {
        if (this.selectedSpells.length === 0) {
            showNotification('Please select at least one spell', 'warning');
            return;
        }

        const character = AppState.getCurrentCharacter();
        if (!character) {
            showNotification('No character selected', 'error');
            return;
        }

        try {
            console.log('[SpellSelectionModal]', 'Adding spells:', {
                spells: this.selectedSpells,
                className: this.className,
                character
            });

            // Initialize spellcasting for class if not already initialized
            if (!character.spellcasting?.classes?.[this.className]) {
                console.log('[SpellSelectionModal]', 'Initializing spellcasting for class:', this.className);
                const classLevel = character.class?.name === this.className
                    ? character.level
                    : (character.multiclass?.find(c => c.name === this.className)?.level || 1);

                spellSelectionService.initializeSpellcastingForClass(
                    character,
                    this.className,
                    classLevel
                );
            }

            let successCount = 0;
            const failedSpells = [];

            for (const spell of this.selectedSpells) {
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

            console.log('[SpellSelectionModal]', 'Added spells:', successCount, 'Failed:', failedSpells);

            if (successCount > 0) {
                const message = successCount === 1
                    ? `Added ${this.selectedSpells[0].name} to ${this.className}`
                    : `Added ${successCount} spell${successCount > 1 ? 's' : ''} to ${this.className}`;
                showNotification(message, 'success');
                eventBus.emit(EVENTS.CHARACTER_UPDATED, character);
            }

            if (failedSpells.length > 0) {
                showNotification(`Failed to add: ${failedSpells.join(', ')}`, 'error');
            }

            if (successCount > 0) {
                this.bootstrapModal.hide();
                if (this._resolvePromise) {
                    this._resolvePromise({
                        spells: this.selectedSpells,
                        className: this.className,
                        successCount,
                    });
                }
            }
        } catch (error) {
            console.error('[SpellSelectionModal]', 'Error adding spells', error);
            showNotification('Error adding spells', 'error');
        }
    }

    _handleCancel() {
        this.bootstrapModal.hide();
        if (this._resolvePromise) {
            this._resolvePromise(null);
        }
    }

    _onModalHidden() {
        console.debug('[SpellSelectionModal]', 'Modal hidden, cleaning up resources');

        // Clear all timers
        if (this.filterDebounceTimer) {
            this._cleanup.clearTimer(this.filterDebounceTimer);
            this.filterDebounceTimer = null;
        }

        if (this._descriptionProcessingTimer) {
            this._cleanup.clearTimer(this._descriptionProcessingTimer);
            this._descriptionProcessingTimer = null;
        }

        // Clear all event listeners
        this._cleanup.cleanup();

        // Clear caches
        this.descriptionCache.clear();
        this.validSpells = [];
        this.filteredSpells = [];
        this.selectedSpells = [];
        this.filters = {
            level: new Set(),
            school: new Set(),
            castingClass: new Set(),
            ritual: null,
            concentration: null,
        };

        console.debug('[SpellSelectionModal]', 'Cleanup complete');
    }
}
