// Modal for configuring D&D data source (URL or local folder) with validation/download UI.

import { DOMCleanup } from '../../../lib/DOMCleanup.js';
import { showNotification } from '../../../lib/Notifications.js';

export class DataConfigurationModal {
	constructor(options = {}) {
		this.modal = null;
		this.bootstrapModal = null;
		this.isValidating = false;
		this.allowClose = options.allowClose || false;
		this.progressUnsub = null;
		this.resolveCallback = null;
		this.rejectCallback = null;
		this._cleanup = DOMCleanup.create();
	}

	async show() {
		// Load saved configuration to pre-populate fields
		await this._loadSavedConfiguration();

		return new Promise((resolve, reject) => {
			this.resolveCallback = resolve;
			this.rejectCallback = reject;

			this.modal = document.getElementById('dataConfigModal');
			if (!this.modal) {
				console.error(
					'DataConfigurationModal',
					'Modal element not found in DOM',
				);
				reject(new Error('Modal element not found'));
				return;
			}

			this._setupModal();
			this._populateSavedValues();
			this._attachEventListeners();

			// Create Bootstrap modal instance
			this.bootstrapModal = new bootstrap.Modal(this.modal, {
				backdrop: 'static',
				keyboard: false,
			});

			// Register modal with cleanup to ensure proper disposal
			this._cleanup.registerBootstrapModal(this.modal, this.bootstrapModal);

			this.bootstrapModal.show();
		});
	}

	_setupModal() {
		const closeBtn = this.modal.querySelector('.data-config-close-btn');
		const subtitle = this.modal.querySelector('.data-config-subtitle');

		if (this.allowClose) {
			closeBtn?.classList.remove('d-none');
			if (subtitle) {
				subtitle.innerHTML =
					'Visit the <a href="https://wiki.tercept.net/en/home" target="_blank">5e Tools Wiki</a> for link to their source code (github repository).';
			}
		} else {
			closeBtn?.classList.add('d-none');
			if (subtitle) {
				subtitle.innerHTML =
					'D&D data files not found. Please provide a data source.<br>Visit the <a href="https://wiki.tercept.net/en/home" target="_blank">5e Tools Wiki</a> for link to their source code (github repository).';
			}
		}
	}

	async _loadSavedConfiguration() {
		try {
			const result = await window.app.getDataSource();
			if (result.success) {
				this.savedType = result.type;
				this.savedValue = result.value;
				console.debug('DataConfigurationModal', 'Loaded saved configuration:', {
					type: this.savedType,
					value: this.savedValue,
				});
			}
		} catch (error) {
			console.warn(
				'DataConfigurationModal',
				'Failed to load saved configuration:',
				error,
			);
			this.savedType = null;
			this.savedValue = null;
		}
	}

	_populateSavedValues() {
		if (!this.savedType || !this.savedValue) {
			return;
		}

		if (this.savedType === 'url') {
			const urlInput = this.modal.querySelector('#dataSourceUrl');
			const validateBtn = this.modal.querySelector(
				'[data-action="validate-url"]',
			);
			if (urlInput) {
				urlInput.value = this.savedValue;
			}
			if (validateBtn && this.savedValue && this.savedValue.trim() !== '') {
				validateBtn.disabled = false;
			}
		} else if (this.savedType === 'local') {
			const localInput = this.modal.querySelector('#localFolderPath');
			const validateBtn = this.modal.querySelector(
				'[data-action="validate-local"]',
			);
			if (localInput) {
				localInput.value = this.savedValue;
			}
			if (validateBtn) {
				validateBtn.disabled = false;
			}

			// Switch to local tab using Bootstrap tab API
			const localTab = this.modal.querySelector('#local-tab');
			if (localTab) {
				const tab = new bootstrap.Tab(localTab);
				tab.show();
			}
		}
	}

	_attachEventListeners() {
		// URL validation
		const validateUrlBtn = this.modal.querySelector(
			'[data-action="validate-url"]',
		);
		const urlInput = this.modal.querySelector('#dataSourceUrl');

		// Disable button if input is empty
		urlInput?.addEventListener('input', () => {
			validateUrlBtn.disabled = urlInput.value.trim() === '';
		});
		// Initial state
		if (validateUrlBtn && urlInput) {
			validateUrlBtn.disabled = urlInput.value.trim() === '';
		}

		validateUrlBtn?.addEventListener('click', async () => {
			const url = urlInput.value.trim();
			if (!url) {
				showNotification('Please enter a URL', 'error');
				return;
			}

			await this._validateAndSubmit('url', url, validateUrlBtn);
		});

		// Local folder browser
		const browseBtn = this.modal.querySelector('#browseLocalFolderBtn');
		const localPathInput = this.modal.querySelector('#localFolderPath');
		const validateLocalBtn = this.modal.querySelector(
			'[data-action="validate-local"]',
		);

		localPathInput?.addEventListener('input', () => {
			validateLocalBtn.disabled = localPathInput.value.trim() === '';
		});

		browseBtn?.addEventListener('click', async () => {
			try {
				const result = await window.app.selectFolder();
				if (result.success && result.path) {
					localPathInput.value = result.path;
					validateLocalBtn.disabled = false;
				}
			} catch (error) {
				console.error(
					'DataConfigurationModal',
					'Error selecting folder:',
					error,
				);
				showNotification('Failed to select folder', 'error');
			}
		});

		validateLocalBtn?.addEventListener('click', async () => {
			const path = localPathInput.value.trim();
			if (!path) {
				showNotification('Please select a folder', 'error');
				return;
			}

			await this._validateAndSubmit('local', path, validateLocalBtn);
		});

		// Allow Enter key in URL field
		urlInput?.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				validateUrlBtn?.click();
			}
		});

		// Close button (if allowed)
		if (this.allowClose) {
			const closeBtn = this.modal.querySelector('.data-config-close-btn');
			closeBtn?.addEventListener('click', () => {
				this.bootstrapModal?.hide();
				this.rejectCallback?.(new Error('Modal closed by user'));
			});
		}
	}

	attachProgressListener() {
		this.detachProgressListener();
		if (!window.app?.onDataDownloadProgress) return;
		this.progressUnsub = window.app.onDataDownloadProgress((payload) => {
			if (!payload) return;
			const statusEl = this.modal.querySelector('.data-download-status');
			const barEl = this.modal.querySelector('.data-download-progress-bar');
			const textEl = this.modal.querySelector('.data-download-status-text');
			if (!statusEl || !barEl || !textEl) return;

			statusEl.classList.remove('d-none');

			const total = payload.total || 0;
			const completed = payload.completed || 0;
			const percent =
				total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
			barEl.style.width = `${percent}%`;
			barEl.setAttribute('aria-valuenow', percent);

			if (payload.status === 'start') {
				textEl.textContent = `Starting download (${total} files)...`;
				return;
			}
			if (payload.status === 'progress') {
				const fileText = payload.file ? ` ${payload.file}` : '';
				const errorText = payload.error ? ` (failed: ${payload.error})` : '';
				textEl.textContent = `Downloading${fileText} (${completed}/${total})${errorText}`;
				return;
			}
			if (payload.status === 'error') {
				textEl.textContent = payload.error || 'Download failed';
				return;
			}
			if (payload.status === 'complete') {
				textEl.textContent = 'Download complete';
				barEl.style.width = '100%';
			}
		});
	}

	detachProgressListener() {
		if (this.progressUnsub) {
			this.progressUnsub();
			this.progressUnsub = null;
		}
	}

	async _validateAndSubmit(type, value, button) {
		if (this.isValidating) return;

		this.isValidating = true;
		button.disabled = true;

		const spinner = button.querySelector('.data-config-spinner');
		const text = button.querySelector('.button-text');
		spinner?.classList.remove('d-none');
		if (text) {
			text.textContent =
				type === 'url' ? 'Validating & Downloading...' : 'Validating...';
		}

		if (type === 'url') {
			this.attachProgressListener();
		}

		try {
			console.debug(
				'DataConfigurationModal',
				`Validating ${type} source:`,
				value,
			);

			const response = await window.app.validateDataSource({
				type,
				value,
			});

			if (response.success) {
				console.debug(
					'DataConfigurationModal',
					'Data source validation successful',
				);
				const successMessage =
					type === 'url'
						? 'Data downloaded and configured successfully'
						: `Data source configured successfully (${type})`;
				showNotification(successMessage, 'success');

				// Ensure latest data is active and reload app state so DataLoader reinitializes
				try {
					await window.app.refreshDataSource();
				} catch (error) {
					console.warn(
						'DataConfigurationModal',
						'Post-validate refresh failed',
						error,
					);
				}
				window.location.reload();

				this.detachProgressListener();
				this.bootstrapModal?.hide();
				this.resolveCallback?.({ type, value });
			} else {
				console.warn(
					'DataConfigurationModal',
					'Validation failed:',
					response.error,
				);
				showNotification(`Validation failed: ${response.error}`, 'error');

				this.isValidating = false;
				button.disabled = false;
				spinner?.classList.add('d-none');
				if (text) {
					text.textContent =
						type === 'url' ? 'Validate & Download' : 'Validate & Use Folder';
				}
				this.detachProgressListener();
			}
		} catch (error) {
			console.error(
				'DataConfigurationModal',
				'Error during validation:',
				error,
			);
			showNotification(`Error: ${error.message}`, 'error');

			this.isValidating = false;
			button.disabled = false;
			spinner?.classList.add('d-none');
			if (text) {
				text.textContent =
					type === 'url' ? 'Validate & Download' : 'Validate & Use Folder';
			}
			this.detachProgressListener();
		}
	}
}
