/**
 * Step 2: Race
 * 
 * User selects character race.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';

export class Step2Race {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
    }

    /**
     * Render the step HTML.
     */
    async render() {
        return `
            <div class="step-2-race">
                <div class="card">
                    <div class="card-header">
                        <i class="fas fa-users"></i> Select Race
                    </div>
                    <div class="card-body">
                        <p class="text-muted">Race selection coming soon...</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to rendered content.
     */
    async attachListeners(_contentArea) {
        console.debug('[Step2Race]', 'Attaching listeners');
        // Race selection logic will be implemented here
    }

    /**
     * Validate step data.
     */
    async validate() {
        // Temporary: always valid until race selection is implemented
        return true;
    }

    /**
     * Save step data to session.
     */
    async save() {
        console.debug('[Step2Race]', 'Saved data');
        // Race selection will be saved here
    }

    /**
     * Clean up resources.
     */
    cleanup() {
        this._cleanup.cleanup();
    }
}
