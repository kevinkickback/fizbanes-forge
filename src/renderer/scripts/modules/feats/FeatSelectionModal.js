// FeatSelectionModal.js
// Modal for selecting feats valid for the current character

import { featService } from '../../services/FeatService.js';
import { AppState } from '../../core/AppState.js';
import { eventBus, EVENTS } from '../../utils/EventBus.js';
import { showNotification } from '../../utils/Notifications.js';

export class FeatSelectionModal {
    constructor({ allowClose = true } = {}) {
        this.allowClose = allowClose;
        this.modal = null;
        this.validFeats = [];
    }

    async show() {
        await this._loadValidFeats();
        this._renderModal();
        this._attachEventListeners();
        // Remove any existing modal overlays to prevent duplicates
        document.querySelectorAll('.modal-overlay').forEach(el => { el.remove(); });
        // Ensure modal uses fixed positioning and is appended to <body>
        this.modal.style.position = 'fixed';
        this.modal.style.top = '0';
        this.modal.style.left = '0';
        this.modal.style.width = '100vw';
        this.modal.style.height = '100vh';
        this.modal.style.zIndex = '2000';
        document.body.appendChild(this.modal);
        // Prevent background scroll when modal is open
        document.body.classList.add('modal-open');
    }

    async _loadValidFeats() {
        const allFeats = await featService.getAllFeats();
        const character = AppState.getCurrentCharacter();
        // Filter feats based on character prerequisites
        this.validFeats = allFeats.filter(f => this._isFeatValidForCharacter(f, character));
    }

    _isFeatValidForCharacter(feat, _character) {
        // TODO: Implement full prerequisite logic
        if (!feat.prerequisite) return true;
        // Example: check for minimum level, race, class, etc.
        // Return false if requirements not met
        return true;
    }

    _renderModal() {
        this.modal = document.createElement('div');
        // Use the same modal structure/classes as the new character modal for consistency
        this.modal.className = 'modal-overlay';
        this.modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-dialog modal-lg" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2001;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Select a Feat</h2>
                        ${this.allowClose ? '<button class="modal-close btn-close" aria-label="Close"></button>' : ''}
                    </div>
                    <div class="modal-body">
                        <div class="feat-list">
                            ${this.validFeats.length === 0 ? '<p>No valid feats available.</p>' : this.validFeats.map(f => `
                                <div class="feat-item" data-feat-id="${f.id}">
                                    <strong>${f.name}</strong>
                                    <span class="feat-source">[${f.source}]</span>
                                    <button class="btn btn-sm btn-primary select-feat-btn" data-feat-id="${f.id}">Add</button>
                                    <div class="feat-desc">${f.entries ? f.entries.join(' ') : ''}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _attachEventListeners() {
        if (this.allowClose) {
            this.modal.querySelector('.modal-close').addEventListener('click', () => this.close());
        }
        this.modal.querySelectorAll('.select-feat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const featId = btn.getAttribute('data-feat-id');
                const feat = this.validFeats.find(f => f.id === featId);
                if (feat) {
                    eventBus.emit(EVENTS.FEAT_ADDED, feat);
                    showNotification(`Feat "${feat.name}" added!`, 'success');
                    this.close();
                }
            });
        });
    }

    close() {
        this.modal?.parentNode?.removeChild(this.modal);
        // Restore background scroll
        document.body.classList.remove('modal-open');
    }
}
