/**
 * Step 1: Rules
 * 
 * User selects ability score method, variant rules, and allowed source books.
 */

import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { sourceService } from '../../../services/SourceService.js';
import { SourceCard } from '../sources/SourceCard.js';

export class CharacterStepRules {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
        this._sourceCard = new SourceCard();
    }

    /**
     * Render the step HTML.
     */
    async render() {
        const abilityScoreMethod = this.session.get('abilityScoreMethod') || 'pointBuy';
        const variantfeat = this.session.get('variantRules.variantfeat') ?? false;
        const averageHitPoints = this.session.get('variantRules.averageHitPoints') ?? false;

        return `
            <div class="step-1-rules">
                <div class="row g-3">
                    <div class="col-md-7">
                        <div class="card h-100">
                            <div class="card-header">
                                <i class="fas fa-dice-d20"></i> Ability Score Generation
                            </div>
                            <div class="card-body">
                                <div class="btn-group w-100" role="group" aria-label="Select ability score method">
                                    <input type="radio" 
                                           class="btn-check" 
                                           name="abilityScoreMethod" 
                                           id="pointBuy" 
                                           value="pointBuy" 
                                           ${abilityScoreMethod === 'pointBuy' ? 'checked' : ''}>
                                    <label class="btn btn-outline-secondary" for="pointBuy">Point Buy</label>
                                    
                                    <input type="radio" 
                                           class="btn-check" 
                                           name="abilityScoreMethod" 
                                           id="standardArray" 
                                           value="standardArray"
                                           ${abilityScoreMethod === 'standardArray' ? 'checked' : ''}>
                                    <label class="btn btn-outline-secondary" for="standardArray">Standard Array</label>
                                    
                                    <input type="radio" 
                                           class="btn-check" 
                                           name="abilityScoreMethod" 
                                           id="rollDice" 
                                           value="rollDice"
                                           ${abilityScoreMethod === 'rollDice' ? 'checked' : ''}>
                                    <label class="btn btn-outline-secondary" for="rollDice">Custom</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-5">
                        <div class="card h-100">
                            <div class="card-header">
                                <i class="fas fa-cogs"></i> Variant Rules
                            </div>
                            <div class="card-body">
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" 
                                           type="checkbox" 
                                           id="featVariant"
                                           ${variantfeat ? 'checked' : ''}>
                                    <label class="form-check-label" for="featVariant">
                                        Optional Class Features
                                    </label>
                                </div>
                                <div class="form-check form-switch">
                                    <input class="form-check-input" 
                                           type="checkbox" 
                                           id="averageHitPoints"
                                           ${averageHitPoints ? 'checked' : ''}>
                                    <label class="form-check-label" for="averageHitPoints">
                                        Average Hit Points
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Source Selection Section -->
                <div class="row g-3 mt-2">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <div>
                                    <i class="fas fa-book"></i> Allowed Sources
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    <a href="#" class="text-decoration-none text-accent" id="selectAllSources">Select All</a>
                                    <span class="text-muted">|</span>
                                    <a href="#" class="text-decoration-none text-accent" id="deselectAllSources">None</a>
                                </div>
                            </div>
                            <div class="card-body">
                                <div id="sourceBookHeader" style="display: none;"></div>
                                <div id="sourceBookSelection">
                                    <!-- Source book toggles will be added here -->
                                </div>
                                <small class="text-muted d-block mt-2">
                                    * At least one Player's Handbook (2014 or 2024) must be selected
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to rendered content.
     */
    async attachListeners(contentArea) {
        console.debug('[Step1Rules]', 'Attaching listeners');

        // Initialize source card
        const container = contentArea.querySelector('#sourceBookSelection');
        if (container) {
            this._sourceCard.container = container;
            await this._sourceCard.initializeSourceSelection();

            // Restore previously selected sources
            const allowedSources = this.session.get('allowedSources');
            if (allowedSources && allowedSources.size > 0) {
                this._restoreSourceSelection(allowedSources);
            }
        }

        // Select All button
        const selectAllBtn = contentArea.querySelector('#selectAllSources');
        if (selectAllBtn) {
            this._cleanup.on(selectAllBtn, 'click', (e) => {
                e.preventDefault();
                this._selectAllSources();
            });
        }

        // Deselect All button
        const deselectAllBtn = contentArea.querySelector('#deselectAllSources');
        if (deselectAllBtn) {
            this._cleanup.on(deselectAllBtn, 'click', (e) => {
                e.preventDefault();
                this._deselectAllSources();
            });
        }
    }

    /**
     * Restore previously selected sources.
     */
    _restoreSourceSelection(sources) {
        if (!this._sourceCard.container) return;

        const toggles = this._sourceCard.container.querySelectorAll('.source-toggle');
        for (const toggle of toggles) {
            const source = toggle.getAttribute('data-source')?.toUpperCase();
            if (source && sources.has(source)) {
                toggle.classList.add('selected');
            }
        }
    }

    /**
     * Select all sources.
     */
    _selectAllSources() {
        if (!this._sourceCard.container) return;

        const toggles = this._sourceCard.container.querySelectorAll('.source-toggle');
        for (const toggle of toggles) {
            toggle.classList.add('selected');
        }
    }

    /**
     * Deselect all sources.
     */
    _deselectAllSources() {
        if (!this._sourceCard.container) return;

        const toggles = this._sourceCard.container.querySelectorAll('.source-toggle');
        for (const toggle of toggles) {
            toggle.classList.remove('selected');
        }
    }

    /**
     * Validate step data.
     */
    async validate() {
        const abilityScoreMethod = document.querySelector('input[name="abilityScoreMethod"]:checked');
        if (!abilityScoreMethod) {
            console.error('[Step1Rules]', 'No ability score method selected');
            return false;
        }

        // Validate source selection
        const selectedSources = this._getSelectedSources();
        const isValid = this._sourceCard.validateSourceSelection(selectedSources);

        if (!isValid) {
            console.warn('[Step1Rules]', 'Source validation failed');
            return false;
        }

        return true;
    }

    /**
     * Save step data to session.
     */
    async save() {
        const abilityScoreMethod = document.querySelector('input[name="abilityScoreMethod"]:checked');
        const featVariant = document.getElementById('featVariant');
        const averageHitPoints = document.getElementById('averageHitPoints');

        if (abilityScoreMethod) {
            this.session.set('abilityScoreMethod', abilityScoreMethod.value);
        }

        if (featVariant) {
            this.session.set('variantRules.variantfeat', featVariant.checked);
        }

        if (averageHitPoints) {
            this.session.set('variantRules.averageHitPoints', averageHitPoints.checked);
        }

        // Save source selection
        const selectedSources = this._getSelectedSources();
        this.session.set('allowedSources', selectedSources);

        // Update sourceService with selected sources
        // Clear existing sources first (except PHB which can't be removed)
        const currentSources = sourceService.getAllowedSources();
        for (const source of currentSources) {
            if (source !== 'PHB' && !selectedSources.has(source)) {
                sourceService.removeAllowedSource(source);
            }
        }
        // Add newly selected sources
        for (const source of selectedSources) {
            sourceService.addAllowedSource(source);
        }

        console.debug('[Step1Rules]', 'Saved data:', {
            abilityScoreMethod: this.session.get('abilityScoreMethod'),
            variantRules: this.session.get('variantRules'),
            allowedSources: Array.from(selectedSources),
        });
    }

    /**
     * Get selected sources from UI.
     */
    _getSelectedSources() {
        const selectedSources = new Set();

        if (!this._sourceCard.container) {
            return selectedSources;
        }

        const selectedToggles = this._sourceCard.container.querySelectorAll('.source-toggle.selected');
        for (const toggle of selectedToggles) {
            const source = toggle.getAttribute('data-source')?.toUpperCase();
            if (source) {
                selectedSources.add(source);
            }
        }

        return selectedSources;
    }
}
