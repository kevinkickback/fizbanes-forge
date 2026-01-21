// Bootstrap modal components for app initialization and data refresh.

import { DOMCleanup } from '../../../lib/DOMCleanup.js';

//=============================================================================
// Loading Modal - Initial app startup
//=============================================================================

export class LoadingModal {
    constructor() {
        this.modal = null;
        this.bootstrapModal = null;
        this.messageElement = null;
        this.progressBar = null;
        this._cleanup = DOMCleanup.create();
    }

    show(initialMessage = 'Loading...') {
        // Clean up any leftover modals from previous session
        const existingBackdrops = document.querySelectorAll('.modal-backdrop');
        for (const backdrop of existingBackdrops) {
            backdrop.remove();
        }
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        this.modal = document.getElementById('loadingModal');
        if (!this.modal) {
            console.error('LoadingModal', 'Modal element not found in DOM');
            return;
        }

        // Dispose of any existing Bootstrap modal instance
        if (this.bootstrapModal) {
            try {
                this.bootstrapModal.dispose();
            } catch {
                // Silently continue
            }
        }

        this.messageElement = this.modal.querySelector('.loading-message');
        this.detailElement = this.modal.querySelector('.loading-detail');
        this.progressBar = this.modal.querySelector('.progress-bar');

        if (this.messageElement) {
            this.messageElement.textContent = initialMessage;
        }

        // Create Bootstrap modal instance
        this.bootstrapModal = new bootstrap.Modal(this.modal, {
            backdrop: 'static',
            keyboard: false,
        });

        // Register modal with cleanup to ensure proper disposal
        this._cleanup.registerBootstrapModal(this.modal, this.bootstrapModal);

        this.bootstrapModal.show();
    }

    updateMessage(message) {
        if (this.messageElement) {
            this.messageElement.textContent = message;
        }
    }

    updateDetail(detail) {
        if (this.detailElement) {
            this.detailElement.textContent = detail;
        }
    }

    updateProgress(percent) {
        if (this.progressBar) {
            const safePercent = Math.min(100, Math.max(0, percent));
            this.progressBar.style.width = `${safePercent}%`;
            this.progressBar.setAttribute('aria-valuenow', safePercent);
        }
    }

    hide() {
        if (!this.bootstrapModal && !this.modal) {
            return;
        }

        try {
            if (this.bootstrapModal) {
                this.bootstrapModal.hide();
            }

            // Immediate cleanup - no setTimeout to avoid timing issues on reload
            const backdrops = document.querySelectorAll('.modal-backdrop');
            for (const backdrop of backdrops) {
                backdrop.remove();
            }
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';

            // Force hide the modal element itself
            if (this.modal) {
                this.modal.classList.remove('show');
                this.modal.style.display = 'none';
                this.modal.setAttribute('aria-hidden', 'true');
                this.modal.removeAttribute('aria-modal');
            }
        } catch (e) {
            console.error('LoadingModal', 'Error hiding modal:', e);
        }

        // Clean up references
        this.modal = null;
        this.bootstrapModal = null;
        this.messageElement = null;
        this.progressBar = null;
    }
}

//=============================================================================
// Refresh Progress Modal - Data source refresh/update
//=============================================================================

export class RefreshProgressModal {
    constructor() {
        this.modal = null;
        this.bootstrapModal = null;
        this.progressBar = null;
        this.messageElement = null;
        this.statusElement = null;
        this.confirmButton = null;
        this._cleanup = DOMCleanup.create();
    }

    show() {
        if (this.modal) {
            return;
        }

        this.modal = document.getElementById('refreshProgressModal');
        if (!this.modal) {
            console.error('RefreshProgressModal', 'Modal element not found in DOM');
            return;
        }

        this.progressBar = this.modal.querySelector('.progress-bar');
        this.messageElement = this.modal.querySelector('.refresh-progress-message');
        this.statusElement = this.modal.querySelector('.refresh-progress-status');
        this.confirmButton = this.modal.querySelector('.refresh-progress-confirm');

        if (this.confirmButton) {
            this._cleanup.on(this.confirmButton, 'click', () => this.hide());
        }

        // Create Bootstrap modal instance
        this.bootstrapModal = new bootstrap.Modal(this.modal, {
            backdrop: 'static',
            keyboard: false,
        });

        // Register modal with cleanup to ensure proper disposal
        this._cleanup.registerBootstrapModal(this.modal, this.bootstrapModal);

        this.bootstrapModal.show();
    }

    updateProgress(percent, message) {
        if (this.progressBar) {
            const safePercent = Math.min(100, Math.max(0, percent));
            this.progressBar.style.width = `${safePercent}%`;
            this.progressBar.setAttribute('aria-valuenow', safePercent);
        }

        if (this.statusElement) {
            this.statusElement.textContent = `${Math.round(percent)}%`;
        }

        if (message && this.messageElement) {
            this.messageElement.textContent = message;
        }
    }

    showCompletion(message, percent = 100) {
        this.updateProgress(percent, message);
        if (this.confirmButton) {
            this.confirmButton.classList.remove('d-none');
            this.confirmButton.classList.add('show');
            this.confirmButton.focus();
        }
    }

    hide() {
        if (!this.bootstrapModal) {
            return;
        }

        this.bootstrapModal.hide();

        // Clean up references
        this.modal = null;
        this.bootstrapModal = null;
        this.progressBar = null;
        this.messageElement = null;
        this.statusElement = null;
        this.confirmButton = null;
    }
}
