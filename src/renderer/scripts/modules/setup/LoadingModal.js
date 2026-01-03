/** Loading modal displayed during app initialization with progress text. */

export class LoadingModal {
	constructor() {
		this.modal = null;
		this.bootstrapModal = null;
		this.messageElement = null;
		this.progressBar = null;
	}

	/**
	 * Show the loading modal with an optional initial message
	 * @param {string} [initialMessage='Loading...'] - Initial message to display
	 */
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

	/**
	 * Update the loading message
	 * @param {string} message - New message to display
	 */
	updateMessage(message) {
		if (this.messageElement) {
			this.messageElement.textContent = message;
		}
	}

	/**
	 * Update progress bar (0-100)
	 * @param {number} percent - Progress percentage (0-100)
	 */
	updateProgress(percent) {
		if (this.progressBar) {
			const safePercent = Math.min(100, Math.max(0, percent));
			this.progressBar.style.width = `${safePercent}%`;
			this.progressBar.setAttribute('aria-valuenow', safePercent);
		}
	}

	/**
	 * Hide and remove the loading modal
	 */
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
