/**
 * Step 2: Sources
 * 
 * User selects allowed source books using SourceCard component.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';
import { SourceCard } from '../../sources/Card.js';

export class Step2Sources {
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
        return `
            <div class="step-2-sources">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <div>
                            <span class="fw-bold">Select Allowed Sources</span>
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
        `;
    }

    /**
     * Attach event listeners to rendered content.
     */
    async attachListeners(contentArea) {
        console.debug('[Step2Sources]', 'Attaching listeners');

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
        const selectedSources = this._getSelectedSources();
        const isValid = this._sourceCard.validateSourceSelection(selectedSources);

        if (!isValid) {
            console.warn('[Step2Sources]', 'Source validation failed');
        }

        return isValid;
    }

    /**
     * Save step data to session.
     */
    async save() {
        const selectedSources = this._getSelectedSources();
        this.session.set('allowedSources', selectedSources);

        console.debug('[Step2Sources]', 'Saved sources:', Array.from(selectedSources));
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
