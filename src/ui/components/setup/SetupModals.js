// Bootstrap modal components for app initialization and data refresh.

import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { disposeBootstrapModal, hideBootstrapModal, initializeBootstrapModal } from '../../../lib/ModalCleanupUtility.js';

//=============================================================================
// Loading Modal - Initial app startup
//=============================================================================

export class LoadingModal {
	constructor() {
		this.modal = null;
		this.bootstrapModal = null;
		this.progressBar = null;
		this._cleanup = DOMCleanup.create();
	}

	show() {
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
		disposeBootstrapModal(this.bootstrapModal);
		this.bootstrapModal = null;

		this.detailElement = this.modal.querySelector('.loading-detail');
		this.progressBar = this.modal.querySelector('.progress-bar');

		// Create Bootstrap modal instance
		this.bootstrapModal = initializeBootstrapModal(this.modal, {
			backdrop: 'static',
			keyboard: false,
		});

		// Register modal with cleanup to ensure proper disposal
		this._cleanup.registerBootstrapModal(this.modal, this.bootstrapModal);

		this.bootstrapModal.show();
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

	async hide() {
		if (!this.bootstrapModal && !this.modal) {
			return;
		}

		// Use centralized hide utility
		await hideBootstrapModal(this.bootstrapModal, this.modal);

		// Clean up component references
		this._cleanup.cleanup();
		this.modal = null;
		this.bootstrapModal = null;
		this.detailElement = null;
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
		this.bootstrapModal = initializeBootstrapModal(this.modal, {
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

	async hide() {
		if (!this.bootstrapModal) {
			return;
		}

		// Use centralized hide utility
		await hideBootstrapModal(this.bootstrapModal, this.modal);

		// Clean up component references
		this._cleanup.cleanup();
		this.modal = null;
		this.bootstrapModal = null;
		this.progressBar = null;
		this.messageElement = null;
		this.statusElement = null;
		this.confirmButton = null;
	}
}
