import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { SPELL_SCHOOL_NAMES } from '../../../lib/DnDConstants.js';
import { classService } from '../../../services/ClassService.js';
import { sourceService } from '../../../services/SourceService.js';
import { spellSelectionService } from '../../../services/SpellSelectionService.js';
import { spellService } from '../../../services/SpellService.js';

/**
 * LevelUpSpellSelector
 * 
 * Focused spell selection modal for level-up wizard.
 * Allows users to select new spells for a spellcasting class.
 * 
 * Features:
 * - Search and filter spells by name, school, type
 * - Enforce spell slot/known spell limits
 * - Display spell details with casting time, components
 * - Support for prepared vs known spells
 * - Ritual casting indicators
 */

export class LevelUpSpellSelector {
    constructor(session, parentStep, className, currentLevel) {
        this.session = session;
        this.parentStep = parentStep;
        this.className = className;
        this.currentLevel = currentLevel;

        // Modal DOM element
        this._modal = null;
        this._modalBS = null; // Bootstrap modal instance
        this._cleanup = DOMCleanup.create();

        // Service references
        this.spellService = spellService;
        this.spellSelectionService = spellSelectionService;
        this.classService = classService;

        // Selection state
        this.selectedSpells = [];
        this.availableSpells = [];
        this.filteredSpells = [];
        this.currentSpellLevel = 0; // Current tab: 0 = cantrips, 1 = 1st level, etc.

        // Filtering state
        this.searchQuery = '';
        this.schoolFilter = '';
        this.showRitualsOnly = false;
        this.showConcentrationOnly = false;

        // Slot limits
        this.maxSpells = 0;
        this.slotsByLevel = {}; // { 1: 2, 2: 2, 3: 1 }
    }

    /**
     * Initialize and display the spell selector modal
     */
    async show() {
        try {
            // Load spell data
            await this._loadSpellData();

            // Render modal or get existing
            this._getOrCreateModal();

            // Populate initial view
            this._renderSpellList();

            // Attach event listeners
            this._attachListeners();

            // Show modal
            if (this._modalBS) {
                this._modalBS.show();
            }
        } catch (error) {
            console.error('[LevelUpSpellSelector]', 'Error showing spell selector:', error);
        }
    }

    /**
     * Load available spells for this class and level
     */
    async _loadSpellData() {
        // Get class spellcasting info
        const classInfo = this.spellSelectionService._getClassSpellcastingInfo(this.className);
        if (!classInfo) {
            throw new Error(`${this.className} is not a spellcaster`);
        }

        // Calculate max spells at this level
        this._calculateSpellLimits();

        // Load all available spells for this class
        this.availableSpells = await this._getAvailableSpellsForClass();

        console.info('[LevelUpSpellSelector]', `Loaded ${this.availableSpells.length} available spells for ${this.className}`);
    }

    /**
     * Calculate spell slot and known spell limits
     */
    _calculateSpellLimits() {
        // Get spell slots for each level from class table
        const slotCounts = this.spellSelectionService.calculateSpellSlots(
            this.className,
            this.currentLevel
        );

        // slotCounts is typically { 1: [count, count], 2: [count, count], ... }
        // Convert to per-level known/prepared counts
        if (typeof slotCounts === 'object') {
            Object.entries(slotCounts).forEach(([level, slots]) => {
                // For most classes, known spells = available slots
                // For prepared spellcasters, prepared = spell slots
                if (Array.isArray(slots)) {
                    this.slotsByLevel[level] = slots[0]; // Use first value
                } else {
                    this.slotsByLevel[level] = slots;
                }
            });
        }

        // Total spells for display
        this.maxSpells = Object.values(this.slotsByLevel).reduce((a, b) => a + b, 0);
    }

    /**
     * Get all available spells for this class
     */
    async _getAvailableSpellsForClass() {
        // Get all spells from SpellService
        const allSpells = this.spellService.getAllSpells();

        // Filter by class eligibility and allowed sources
        const availableSpells = allSpells.filter(spell => {
            // Check if spell is available for this class
            if (!this.spellService.isSpellAvailableForClass(spell, this.className)) {
                return false;
            }

            // Check if source is allowed
            if (!sourceService.isSourceAllowed(spell.source)) {
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
     * Get or create the modal element
     */
    _getOrCreateModal() {
        // Try to find existing modal or create new one
        let modal = document.getElementById('levelUpSpellSelectorModal');

        if (!modal) {
            // Create new modal
            modal = document.createElement('div');
            modal.id = 'levelUpSpellSelectorModal';
            modal.className = 'modal fade';
            modal.setAttribute('tabindex', '-1');
            modal.innerHTML = this._getModalHTML();
            document.body.appendChild(modal);
        }

        this._modal = modal;

        // Initialize or refresh Bootstrap modal
        if (this._modalBS) {
            this._modalBS.dispose();
        }
        this._modalBS = new bootstrap.Modal(modal, { backdrop: 'static', keyboard: false });
    }

    /**
     * Generate modal HTML structure
     */
    _getModalHTML() {
        return `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header border-bottom">
                        <h5 class="modal-title">
                            <i class="fas fa-book"></i>
                            Select Spells - ${this.className} (Level ${this.currentLevel})
                        </h5>
                        <button type="button" class="btn-close" data-level-spell-cancel></button>
                    </div>
                    
                    <div class="modal-body">
                        <!-- Search and Filter Bar -->
                        <div class="row g-2 mb-3">
                            <div class="col-md-6">
                                <input 
                                    type="text" 
                                    class="form-control form-control-sm"
                                    placeholder="Search spells..."
                                    data-spell-search
                                >
                            </div>
                            <div class="col-md-3">
                                <select class="form-select form-select-sm" data-spell-school-filter>
                                    <option value="">All Schools</option>
                                    ${SPELL_SCHOOL_NAMES.map(school => `<option value="${school}">${school}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-3">
                                <button class="btn btn-sm btn-outline-secondary w-100" data-spell-clear>
                                    <i class="fas fa-times"></i> Clear
                                </button>
                            </div>
                        </div>

                        <!-- Spell Level Tabs -->
                        <ul class="nav nav-tabs mb-3" role="tablist" data-spell-level-tabs>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link active" type="button" data-spell-level="0" role="tab">
                                    Cantrips
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" type="button" data-spell-level="1" role="tab">
                                    1st Level
                                </button>
                            </li>
                            <li class="nav-item" role="presentation">
                                <button class="nav-link" type="button" data-spell-level="2" role="tab">
                                    2nd Level
                                </button>
                            </li>
                        </ul>

                        <!-- Spell List -->
                        <div class="spell-list" data-spell-list style="max-height: 400px; overflow-y: auto;">
                            <!-- Spells rendered here -->
                        </div>

                        <!-- Selection Info -->
                        <div class="alert alert-info mt-3 mb-0" data-spell-info>
                            <span data-spell-count>Selected: 0</span> / <span data-spell-max>0</span> spells
                        </div>
                    </div>
                    
                    <div class="modal-footer border-top">
                        <button type="button" class="btn btn-secondary" data-level-spell-cancel>
                            Cancel
                        </button>
                        <button type="button" class="btn btn-primary" data-level-spell-confirm>
                            Confirm Selection
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render the spell list for current level/filters
     */
    _renderSpellList() {
        const spellList = this._modal.querySelector('[data-spell-list]');
        if (!spellList) return;

        // Filter spells based on current level and search
        this.filteredSpells = this.availableSpells.filter((spell) => {
            // Level filter
            if (spell.level !== this.currentSpellLevel) {
                return false;
            }

            // Search filter
            if (this.searchQuery && !spell.name.toLowerCase().includes(this.searchQuery.toLowerCase())) {
                return false;
            }

            // School filter
            if (this.schoolFilter && spell.school !== this.schoolFilter) {
                return false;
            }

            // Ritual filter
            if (this.showRitualsOnly && !spell.ritual) {
                return false;
            }

            // Concentration filter
            if (this.showConcentrationOnly && !spell.concentration) {
                return false;
            }

            return true;
        });

        // Render filtered spells
        spellList.innerHTML = this.filteredSpells
            .map(spell => this._renderSpellCheckbox(spell))
            .join('');

        // Update info
        this._updateSelectionInfo();
    }

    /**
     * Render a single spell checkbox
     */
    _renderSpellCheckbox(spell) {
        const isSelected = this.selectedSpells.some(s => s.id === spell.id);
        const ritualBadge = spell.ritual ? '<span class="badge bg-secondary ms-1">Ritual</span>' : '';
        const concentrationBadge = spell.concentration ? '<span class="badge bg-warning ms-1">Conc.</span>' : '';

        return `
            <div class="form-check spell-option-check mb-2">
                <input 
                    class="form-check-input" 
                    type="checkbox" 
                    id="spell_${spell.id}"
                    value="${spell.id}"
                    data-spell-checkbox
                    ${isSelected ? 'checked' : ''}
                >
                <label class="form-check-label w-100" for="spell_${spell.id}">
                    <strong>${spell.name}</strong>
                    ${ritualBadge}
                    ${concentrationBadge}
                    <div class="small text-muted">${spell.school}</div>
                </label>
            </div>
        `;
    }

    /**
     * Attach event listeners to modal
     */
    _attachListeners() {
        // Search input
        const searchInput = this._modal.querySelector('[data-spell-search]');
        if (searchInput) {
            this._cleanup.on(searchInput, 'input', (e) => {
                this.searchQuery = e.target.value;
                this._renderSpellList();
            });
        }

        // School filter
        const schoolSelect = this._modal.querySelector('[data-spell-school-filter]');
        if (schoolSelect) {
            this._cleanup.on(schoolSelect, 'change', (e) => {
                this.schoolFilter = e.target.value;
                this._renderSpellList();
            });
        }

        // Clear button
        const clearBtn = this._modal.querySelector('[data-spell-clear]');
        if (clearBtn) {
            this._cleanup.on(clearBtn, 'click', () => {
                searchInput.value = '';
                schoolSelect.value = '';
                this.searchQuery = '';
                this.schoolFilter = '';
                this._renderSpellList();
            });
        }

        // Spell level tabs
        const levelTabs = this._modal.querySelectorAll('[data-spell-level]');
        levelTabs.forEach((tab) => {
            this._cleanup.on(tab, 'click', (e) => {
                e.preventDefault();
                const level = parseInt(tab.dataset.spellLevel, 10);

                // Update active tab
                levelTabs.forEach((t) => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');

                // Switch level
                this.currentSpellLevel = level;
                this._renderSpellList();
            });
        });

        // Spell checkboxes
        const checkboxes = this._modal.querySelectorAll('[data-spell-checkbox]');
        checkboxes.forEach((checkbox) => {
            this._cleanup.on(checkbox, 'change', () => {
                this._updateSelectedSpells();
            });
        });

        // Cancel button
        const cancelBtn = this._modal.querySelector('[data-level-spell-cancel]');
        if (cancelBtn) {
            this._cleanup.on(cancelBtn, 'click', () => {
                this.cancel();
            });
        }

        // Confirm button
        const confirmBtn = this._modal.querySelector('[data-level-spell-confirm]');
        if (confirmBtn) {
            this._cleanup.on(confirmBtn, 'click', async () => {
                await this.confirm();
            });
        }
    }

    /**
     * Update selectedSpells array from checkbox states
     */
    _updateSelectedSpells() {
        const checkboxes = this._modal.querySelectorAll('[data-spell-checkbox]:checked');
        this.selectedSpells = Array.from(checkboxes).map(checkbox => {
            const spellId = checkbox.value;
            const spell = this.availableSpells.find(s => s.id === spellId);
            return spell;
        });

        this._updateSelectionInfo();
    }

    /**
     * Update selection counter display
     */
    _updateSelectionInfo() {
        const countDisplay = this._modal.querySelector('[data-spell-count]');
        const maxDisplay = this._modal.querySelector('[data-spell-max]');

        if (countDisplay) {
            countDisplay.textContent = `Selected: ${this.selectedSpells.length}`;
        }
        if (maxDisplay) {
            maxDisplay.textContent = this.maxSpells;
        }
    }

    /**
     * Validate selections before confirming
     */
    _validateSelections() {
        // Check that user hasn't exceeded limits
        if (this.selectedSpells.length > this.maxSpells) {
            console.warn('[LevelUpSpellSelector]', 'Too many spells selected');
            return false;
        }

        return true;
    }

    /**
     * Confirm selections and return to parent
     */
    async confirm() {
        // Validate
        if (!this._validateSelections()) {
            alert('You have selected too many spells. Please reduce your selection.');
            return;
        }

        // Update parent step
        this.parentStep?.updateSpellSelection?.(
            this.className,
            this.currentLevel,
            this.selectedSpells.map(s => s.name)
        );

        // Close modal
        this.cancel();
    }

    /**
     * Cancel selection and close modal
     */
    cancel() {
        if (this._modalBS) {
            this._modalBS.hide();
        }
        this.dispose();
    }

    /**
     * Cleanup and dispose resources
     */
    dispose() {
        this._cleanup.cleanup();

        if (this._modalBS) {
            this._modalBS.dispose();
            this._modalBS = null;
        }

        if (this._modal) {
            this._modal.remove();
            this._modal = null;
        }
    }
}
