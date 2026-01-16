/**
 * Step 1: Rules
 * 
 * User selects ability score method and variant rules.
 */

import { DOMCleanup } from '../../../../lib/DOMCleanup.js';

export class Step1Rules {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
        this._cleanup = DOMCleanup.create();
    }

    /**
     * Render the step HTML.
     */
    async render() {
        const abilityScoreMethod = this.session.get('abilityScoreMethod') || 'pointBuy';
        const feats = this.session.get('variantRules.feats') ?? true;
        const averageHitPoints = this.session.get('variantRules.averageHitPoints') ?? true;

        return `
            <div class="step-1-rules">
                <div class="row g-3">
                    <div class="col-md-8">
                        <div class="card">
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
                    
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-header">
                                <i class="fas fa-cogs"></i> Variant Rules
                            </div>
                            <div class="card-body">
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" 
                                           type="checkbox" 
                                           id="featVariant"
                                           ${feats ? 'checked' : ''}>
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
            </div>
        `;
    }

    /**
     * Attach event listeners to rendered content.
     */
    attachListeners(_contentArea) {
        console.debug('[Step1Rules]', 'Attaching listeners');
        // Form inputs are saved on next/back
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
            this.session.set('variantRules.feats', featVariant.checked);
        }

        if (averageHitPoints) {
            this.session.set('variantRules.averageHitPoints', averageHitPoints.checked);
        }

        // Always set multiclassing to true (removed from UI)
        this.session.set('variantRules.multiclassing', true);

        console.debug('[Step1Rules]', 'Saved data:', {
            abilityScoreMethod: this.session.get('abilityScoreMethod'),
            variantRules: this.session.get('variantRules'),
        });
    }
}
