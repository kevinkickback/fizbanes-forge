// Bootstrap modal components for app initialization and data refresh.

//=============================================================================
// Loading Modal - Initial app startup
//=============================================================================

export class LoadingModal {
    constructor() {
        this.modal = null;
        this.bootstrapModal = null;
        this.messageElement = null;
        this.progressBar = null;
    }

    show(initialMessage = 'Loading...') {
        if (this.modal) {
            return; // Already shown
        }

        this.modal = document.getElementById('loadingModal');
        if (!this.modal) {
            console.error('LoadingModal', 'Modal element not found in DOM');
            return;
        }

        this.messageElement = this.modal.querySelector('.loading-message');
        this.progressBar = this.modal.querySelector('.progress-bar');

        if (this.messageElement) {
            this.messageElement.textContent = initialMessage;
        }

        // Create Bootstrap modal instance
        this.bootstrapModal = new bootstrap.Modal(this.modal, {
            backdrop: 'static',
            keyboard: false,
        });
        this.bootstrapModal.show();
    }

    updateMessage(message) {
        if (this.messageElement) {
            this.messageElement.textContent = message;
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
        if (!this.bootstrapModal) {
            return;
        }

        this.bootstrapModal.hide();

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
            this.confirmButton.addEventListener('click', () => this.hide());
        }

        // Create Bootstrap modal instance
        this.bootstrapModal = new bootstrap.Modal(this.modal, {
            backdrop: 'static',
            keyboard: false,
        });
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
