/**
 * Step 4: Summary
 * 
 * Review all staged changes before applying.
 * Users can go back to edit any previous step.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';

export class Step4Summary {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
    }

    /**
     * Render the step HTML.
     */
    async render() {
        const summary = this.session.getChangeSummary();

        let html = `
            <div class="step-4-summary">
                <h5 class="mb-3"><i class="fas fa-clipboard-check"></i> Review Changes</h5>

                <!-- Level Changes -->
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-level-up-alt"></i> Level Changes</h6>
                    </div>
                    <div class="card-body">
                        <p class="mb-2">
                            <strong>Total Level:</strong> 
                            <span class="text-muted">${this.session.originalCharacter.level || 1}</span>
                            <i class="fas fa-arrow-right text-success mx-2"></i>
                            <span class="text-success">${this.session.stagedChanges.level}</span>
                        </p>
        `;

        if (summary.leveledClasses.length > 0) {
            html += '<div class="ms-3"><small class="text-muted">Classes leveled:</small><ul class="small mb-0">';
            summary.leveledClasses.forEach(change => {
                html += `
                    <li>
                        <strong>${change.name}:</strong> ${change.from} 
                        <i class="fas fa-arrow-right text-success"></i> 
                        ${change.to}
                    </li>
                `;
            });
            html += '</ul></div>';
        }

        html += `
                    </div>
                </div>
        `;

        // Ability Score Changes
        if (Object.keys(summary.changedAbilities).length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-dumbbell"></i> Ability Score Changes</h6>
                    </div>
                    <div class="card-body">
            `;

            Object.entries(summary.changedAbilities).forEach(([ability, change]) => {
                const sign = change.change > 0 ? '+' : '';
                html += `
                    <p class="mb-2">
                        <strong>${ability}:</strong> 
                        <span class="text-muted">${change.from}</span>
                        <i class="fas fa-arrow-right mx-2"></i>
                        <span class="text-success">${change.to} (${sign}${change.change})</span>
                    </p>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        // Features Summary
        if (Object.keys(summary.newFeatures).length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-tasks"></i> New Features</h6>
                    </div>
                    <div class="card-body small">
            `;

            Object.entries(summary.newFeatures).forEach(([className, features]) => {
                if (Array.isArray(features) && features.length > 0) {
                    html += `<strong>${className}:</strong><ul>`;
                    features.forEach(f => {
                        html += `<li>${f}</li>`;
                    });
                    html += '</ul>';
                }
            });

            html += `
                    </div>
                </div>
            `;
        }

        // ASI/Feat Summary
        if (summary.newASIs.length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-trophy"></i> Ability Score Improvements</h6>
                    </div>
                    <div class="card-body small">
            `;

            summary.newASIs.forEach((asi, index) => {
                if (asi.type === 'asi') {
                    const abilities = Object.entries(asi.abilities)
                        .map(([ab, val]) => `+${val} ${ab}`)
                        .join(', ');
                    html += `<p class="mb-1"><strong>Improvement ${index + 1}:</strong> ${abilities}</p>`;
                } else if (asi.type === 'feat') {
                    html += `<p class="mb-1"><strong>Feat ${index + 1}:</strong> ${asi.featName}</p>`;
                }
            });

            html += `
                    </div>
                </div>
            `;
        }

        // Spells Summary
        if (Object.keys(summary.newSpells).length > 0) {
            html += `
                <div class="card mb-3">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="fas fa-magic"></i> New Spells</h6>
                    </div>
                    <div class="card-body small">
            `;

            Object.entries(summary.newSpells).forEach(([className, spells]) => {
                if (Array.isArray(spells) && spells.length > 0) {
                    html += `<strong>${className}:</strong><ul>`;
                    spells.forEach(spell => {
                        const spellName = typeof spell === 'string' ? spell : spell.name;
                        html += `<li>${spellName}</li>`;
                    });
                    html += '</ul>';
                }
            });

            html += `
                    </div>
                </div>
            `;
        }

        html += `
                <!-- Info Message -->
                <div class="alert alert-info mb-0">
                    <i class="fas fa-info-circle"></i>
                    Review your changes above. Click 
                    <strong>Back</strong> to edit any step, or 
                    <strong>Confirm</strong> to apply changes.
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Attach event listeners.
     */
    attachListeners(contentArea) {
        console.debug('[Step4]', 'Attaching listeners');
        // Summary page is mostly read-only, listeners handled by modal
    }
}
