/** Loading modal displayed during app initialization with progress text. */

export class LoadingModal {
	constructor() {
		this.modal = null;
		this.messageElement = null;
		this.spinnerElement = null;
	}

	/**
	 * Show the loading modal with an optional initial message
	 * @param {string} [initialMessage='Loading...'] - Initial message to display
	 */
	show(initialMessage = 'Loading...') {
		if (this.modal) {
			return; // Already shown
		}

		const wrapper = document.createElement('div');
		wrapper.className = 'loading-modal-overlay';
		wrapper.innerHTML = `
			<div class="loading-modal-dialog">
				<div class="loading-modal-content">
					<div class="loading-spinner">
						<div class="spinner-circle"></div>
					</div>
					<h2>Initializing Application</h2>
					<p class="loading-message">${initialMessage}</p>
					<div class="loading-progress-bar">
						<div class="loading-progress-fill"></div>
					</div>
				</div>
			</div>
		`;

		document.body.appendChild(wrapper);
		this.modal = wrapper;
		this.messageElement = wrapper.querySelector('.loading-message');
		this.spinnerElement = wrapper.querySelector('.spinner-circle');

		// Trigger animation
		setTimeout(() => {
			this.modal?.classList.add('show');
		}, 10);
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
		const bar = this.modal?.querySelector('.loading-progress-fill');
		if (bar) {
			bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
		}
	}

	/**
	 * Hide and remove the loading modal
	 */
	hide() {
		if (!this.modal) {
			return;
		}

		this.modal.classList.remove('show');
		setTimeout(() => {
			if (this.modal?.parentElement) {
				this.modal.remove();
			}
			this.modal = null;
			this.messageElement = null;
			this.spinnerElement = null;
		}, 300);
	}
}
