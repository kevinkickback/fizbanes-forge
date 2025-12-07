/** Progress modal shown while refreshing or updating data source files. */


export class RefreshProgressModal {
    constructor() {
        this.modal = null;
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

        const wrapper = document.createElement('div');
        wrapper.className = 'refresh-progress-overlay';
        wrapper.innerHTML = `
			<div class="refresh-progress-dialog">
				<div class="refresh-progress-header">
					<h3>Refreshing Data Source</h3>
				</div>
				<div class="refresh-progress-body">
					<p id="refreshProgressMessage" class="refresh-progress-message">Checking for updates...</p>
					<div class="refresh-progress-bar-container">
						<div id="refreshProgressBar" class="refresh-progress-bar"></div>
					</div>
					<small id="refreshProgressStatus" class="refresh-progress-status">0%</small>
					<button
						id="refreshProgressConfirm"
						type="button"
						class="btn btn-primary refresh-progress-confirm"
					>
						Done
					</button>
				</div>
			</div>
		`;

        document.body.appendChild(wrapper);
        this.modal = wrapper;
        this.progressBar = wrapper.querySelector('#refreshProgressBar');
        this.messageElement = wrapper.querySelector('#refreshProgressMessage');
        this.statusElement = wrapper.querySelector('#refreshProgressStatus');
        this.confirmButton = wrapper.querySelector('#refreshProgressConfirm');

        if (this.confirmButton) {
            this.confirmButton.addEventListener('click', () => this.hide());
        }

        // Trigger animation
        setTimeout(() => {
            this.modal?.classList.add('show');
        }, 10);
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
            this.confirmButton.classList.add('show');
            this.confirmButton.focus();
        }
    }

    /**
     * Hide and remove the modal
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
            this.progressBar = null;
            this.messageElement = null;
            this.statusElement = null;
            this.confirmButton = null;
        }, 300);
    }
}

