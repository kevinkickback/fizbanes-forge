/**
 * Step 2: ASI/Feat Selection
 * 
 * Choose ability score improvements or feats.
 * Placeholder for Phase 3 implementation.
 */

export class Step2ASIFeat {
    constructor(session, modal) {
        this.session = session;
        this.modal = modal;
    }

    async render() {
        return `
            <div class="step-2-asi-feat">
                <h5 class="mb-3"><i class="fas fa-trophy"></i> Ability Score Improvements & Feats</h5>
                <p class="text-muted">ASI/Feat selection will be implemented in Phase 3</p>
            </div>
        `;
    }

    attachListeners(contentArea) {
        // TODO: Implement in Phase 3
    }
}
