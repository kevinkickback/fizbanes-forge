/** Progress modal shown while refreshing or updating data source files. */

export class RefreshProgressModal {
	constructor() {
		this.modal = null;
		this.bootstrapModal = null;
		this.progressBar = null;
		this.messageElement = null;
		this.statusElement = null;
		this.confirmButton = null;
	}

	/**
	 * Show the refresh progress modal
	 */
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

	/**
	 * Update the progress bar and message
	 * @param {number} percent - Progress percentage (0-100)
	 * @param {string} [message] - Optional message to display
	 */
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

	/**
	 * Show completion state and enable confirm button
	 * @param {string} message - Completion message to display
	 * @param {number} [percent=100] - Final percentage to display
	 */
	showCompletion(message, percent = 100) {
		this.updateProgress(percent, message);
		if (this.confirmButton) {
			this.confirmButton.classList.remove('d-none');
			this.confirmButton.focus();
		}
	}

	/**
	 * Hide and remove the modal
	 */
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
