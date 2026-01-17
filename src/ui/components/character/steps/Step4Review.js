/**
 * Step 4: Review
 * 
 * User reviews all settings before creating the character.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';

export class Step4Review {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
    }

    /**
     * Render the step HTML.
     */
    async render() {
        const data = this.session.getStagedData();

        const portrait = data.portrait || 'assets/images/characters/placeholder_char_card.webp';
        const name = data.name || 'Unnamed';
        const gender = data.gender ? data.gender.charAt(0).toUpperCase() + data.gender.slice(1) : 'Male';
        const abilityMethod = this._formatAbilityScoreMethod(data.abilityScoreMethod);
        const feats = data.variantRules?.feats ? 'Enabled' : 'Disabled';
        const averageHp = data.variantRules?.averageHitPoints ? 'Enabled' : 'Disabled';

        // Format sources as badges
        const sources = Array.isArray(data.allowedSources) ? data.allowedSources : Array.from(data.allowedSources || []);
        const sourceBadges = sources.length > 0
            ? sources.map(s => `<span class="badge source-badge">${s}</span>`).join(' ')
            : '<span class="text-muted">None selected</span>';

        // Race info
        const raceName = data.race?.name || 'Not selected';
        const raceSource = data.race?.source ? ` (${data.race.source})` : '';
        const subraceName = data.race?.subrace ? ` - ${data.race.subrace}` : '';
        const raceDisplay = `${raceName}${raceSource}${subraceName}`;

        // Class info
        const className = data.class?.name || 'Not selected';
        const classSource = data.class?.source ? ` (${data.class.source})` : '';
        const subclassName = data.class?.subclass ? ` - ${data.class.subclass}` : '';
        const classDisplay = `${className}${classSource}${subclassName}`;

        return `
            <div class="step-4-review">
                <div class="card">
                    <div class="card-body">
                        <div class="row g-3">
                            <div class="col-md-4">
                                <div class="review-portrait-preview">
                                    <img src="${portrait}" alt="Character portrait" />
                                </div>
                            </div>
                            
                            <div class="col-md-8">
                                <ul class="list-unstyled">
                                    <li class="review-name mb-2">
                                        <i class="fas fa-user review-icon"></i>
                                        <strong>Name:</strong> 
                                        <span class="review-value">${name}</span>
                                    </li>
                                    <li class="mb-2">
                                        <i class="fas fa-venus-mars review-icon"></i>
                                        <strong>Gender:</strong> 
                                        <span class="review-value">${gender}</span>
                                    </li>
                                    <li class="mb-2">
                                        <i class="fas fa-users review-icon"></i>
                                        <strong>Race:</strong> 
                                        <span class="review-value">${raceDisplay}</span>
                                    </li>
                                    <li class="mb-2">
                                        <i class="fas fa-hat-wizard review-icon"></i>
                                        <strong>Class:</strong> 
                                        <span class="review-value">${classDisplay}</span>
                                    </li>
                                    <li class="mb-2">
                                        <i class="fas fa-star review-icon"></i>
                                        <strong>Ability Scores:</strong> 
                                        <span class="review-value">${abilityMethod}</span>
                                    </li>
                                    <li class="mb-2">
                                        <i class="fas fa-scroll review-icon"></i>
                                        <strong>Optional Class Features:</strong> 
                                        <span class="review-value">${feats}</span>
                                    </li>
                                    <li class="mb-2">
                                        <i class="fas fa-heart review-icon"></i>
                                        <strong>Average Hit Points:</strong> 
                                        <span class="review-value">${averageHp}</span>
                                    </li>
                                    <li class="review-sources">
                                        <i class="fas fa-book review-icon"></i>
                                        <strong>Sources:</strong> 
                                        ${sourceBadges}
                                    </li>
                                </ul>
                                
                                <div id="reviewValidationMessage" class="mt-3"></div>
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
    attachListeners(_contentArea) {
        console.debug('[Step3Review]', 'Attaching listeners');
        // No listeners needed for review step
    }

    /**
     * Format ability score method for display.
     */
    _formatAbilityScoreMethod(method) {
        if (!method) return 'Point Buy';

        // Convert camelCase to Title Case
        return method
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase())
            .trim();
    }

    /**
     * Validate step data.
     */
    async validate() {
        // All validation already done in previous steps
        return true;
    }

    /**
     * Save step data to session.
     */
    async save() {
        // Nothing to save - this is the final review step
        console.debug('[Step3Review]', 'Final review complete');
    }
}
