/** Modal for configuring D&D data source (URL or local folder) with validation/download UI. */


import { showNotification } from '../../utils/Notifications.js';

export class DataConfigurationModal {
    /**
     * Initialize the modal.
     *
     * @param {Object} [options={}] - Configuration options
     * @param {boolean} [options.allowClose=false] - Allow user to close without selecting data source
     */
    constructor(options = {}) {
        this.modal = null;
        this.isValidating = false;
        this.allowClose = options.allowClose || false;
        this.progressUnsub = null;
    }

    /**
     * Show the modal and wait for user selection.
     * Pre-loads any previously saved configuration.
     *
     * @returns {Promise<{type: 'url'|'local', value: string}>} User's configuration choice
     */
    async show() {
        // Load saved configuration to pre-populate fields
        await this._loadSavedConfiguration();

        return new Promise((resolve, reject) => {
            this.modal = this._createModalElement(resolve, reject);
            document.body.appendChild(this.modal);

            // Pre-populate with saved values if available
            this._populateSavedValues();

            // Animate modal in
            setTimeout(() => {
                this.modal.classList.add('show');
            }, 10);
        });
    }

    /**
     * Load saved data source configuration from preferences.
     * This allows the modal to pre-populate with the user's previous choice.
     *
     * @private
     * @returns {Promise<void>}
     */
    async _loadSavedConfiguration() {
        try {
            const result = await window.app.getDataSource();
            if (result.success) {
                this.savedType = result.type;
                this.savedValue = result.value;
                console.info('DataConfigurationModal', 'Loaded saved configuration:', {
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

    /**
     * Populate input fields with saved configuration values.
     * For URL: puts URL in input field, switches to URL tab.
     * For Local: puts path in input field, switches to Local tab, enables validate button.
     *
     * @private
     * @returns {void}
     */
    _populateSavedValues() {
        if (!this.savedType || !this.savedValue) {
            return;
        }

        if (this.savedType === 'url') {
            const urlInput = this.modal.querySelector('#dataSourceUrl');
            const validateBtn = this.modal.querySelector('[data-action="validate-url"]');
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

            // Switch to local tab
            const localTabBtn = this.modal.querySelector('[data-tab="local"]');
            if (localTabBtn) {
                localTabBtn.click();
            }
        }
    }

    /**
     * Create the modal DOM structure with all UI elements and event handlers.
     * Sets up tab switching, validation buttons, and form inputs.
     *
     * @private
     * @param {Function} onResolve - Called on successful validation
     * @param {Function} onReject - Called if user closes modal
     * @returns {HTMLElement} The modal element
     */
    _createModalElement(onResolve, onReject) {
        const wrapper = document.createElement('div');
        wrapper.className = 'data-config-modal-overlay';
        const subtitle = this.allowClose
            ? 'Visit the <a href="https://wiki.tercept.net/en/home" target="_blank">5e Tools Wiki</a> for link to their source code (github repository).'
            : 'D&D data files not found. Please provide a data source.<br>Visit the <a href="https://wiki.tercept.net/en/home" target="_blank">5e Tools Wiki</a> for link to their source code (github repository).';
        wrapper.innerHTML = `
			<div class="data-config-modal-dialog">
				<div class="data-config-modal-header">
					<h2>Configure Data Source</h2>
					${this.allowClose ? '<button class="data-config-modal-close-btn" aria-label="Close"><i class="fas fa-times"></i></button>' : ''}
                    <p class="text-muted">${subtitle}</p>
				</div>

				<div class="data-config-modal-body">
					<div class="data-config-tabs">
						<button class="data-config-tab-btn active" data-tab="url">
							<i class="fas fa-link"></i> URL Source
						</button>
						<button class="data-config-tab-btn" data-tab="local">
							<i class="fas fa-folder"></i> Local Folder
						</button>
					</div>

					<!-- URL Tab -->
					<div class="data-config-tab-content active" id="data-config-url-tab">
						<div class="form-group">
							<input
								type="url"
								id="dataSourceUrl"
								class="form-control"
								placeholder="https://example.com/5etools-src"
							/>
							<small class="form-text text-muted">
                                Enter the URL to a data repository. Must use <code>5etools</code> folder structure & <code>.json</code> schema.
							</small>
						</div>
						<button class="btn btn-primary data-config-submit-btn" data-action="validate-url">
							<span class="spinner-icon" style="display: none;">
								<i class="fas fa-spinner fa-spin"></i>
							</span>
                            <span class="button-text">Validate & Download</span>
						</button>
                        <div class="data-config-progress" id="dataDownloadStatus" style="display: none; margin-top: 10px;">
                            <div class="progress" style="height: 6px; background: #e9ecef; border-radius: 3px; overflow: hidden;">
                                <div id="dataDownloadProgressBar" style="width: 0%; height: 100%; background: #0d6efd;"></div>
                            </div>
                            <small id="dataDownloadStatusText" class="form-text text-muted">Preparing download...</small>
                        </div>
					</div>

					<!-- Local Folder Tab -->
					<div class="data-config-tab-content" id="data-config-local-tab">
						<div class="form-group">
							<div class="input-group">
								<input
									type="text"
									id="localFolderPath"
									class="form-control"
									placeholder="C:/path/to/data"
								/>
								<button class="btn btn-outline-secondary" id="browseLocalFolderBtn">
									<i class="fas fa-folder-open"></i> Browse
								</button>
							</div>
                            <small class="form-text text-muted">
                                Select a local folder. Must use <code>5etools</code> folder structure & <code>.json</code> schema.
                            </small>
						</div>
						<button class="btn btn-primary data-config-submit-btn" data-action="validate-local" disabled>
							<span class="spinner-icon" style="display: none;">
								<i class="fas fa-spinner fa-spin"></i>
							</span>
							<span class="button-text">Validate & Use Folder</span>
						</button>
					</div>

			</div>
		`;

        // Tab switching
        const tabBtns = wrapper.querySelectorAll('.data-config-tab-btn');
        const tabContents = wrapper.querySelectorAll('.data-config-tab-content');

        tabBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;

                // Update active tab button
                tabBtns.forEach((b) => {
                    b.classList.remove('active');
                });
                btn.classList.add('active');

                // Update active tab content
                tabContents.forEach((content) => {
                    content.classList.remove('active');
                });
                wrapper
                    .querySelector(`#data-config-${tab}-tab`)
                    .classList.add('active');
            });
        });

        // URL validation
        const validateUrlBtn = wrapper.querySelector(
            '[data-action="validate-url"]',
        );
        const urlInput = wrapper.querySelector('#dataSourceUrl');

        // Disable button if input is empty
        urlInput.addEventListener('input', () => {
            validateUrlBtn.disabled = urlInput.value.trim() === '';
        });
        // Initial state
        validateUrlBtn.disabled = urlInput.value.trim() === '';

        validateUrlBtn.addEventListener('click', async () => {
            const url = urlInput.value.trim();
            if (!url) {
                showNotification('Please enter a URL', 'error');
                return;
            }

            await this._validateAndSubmit('url', url, validateUrlBtn, onResolve);
        });

        // Local folder browser
        const browseBtn = wrapper.querySelector('#browseLocalFolderBtn');
        const localPathInput = wrapper.querySelector('#localFolderPath');
        const validateLocalBtn = wrapper.querySelector(
            '[data-action="validate-local"]',
        );

        localPathInput.addEventListener('input', () => {
            validateLocalBtn.disabled = localPathInput.value.trim() === '';
        });

        browseBtn.addEventListener('click', async () => {
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

        validateLocalBtn.addEventListener('click', async () => {
            const path = localPathInput.value.trim();
            if (!path) {
                showNotification('Please select a folder', 'error');
                return;
            }

            await this._validateAndSubmit('local', path, validateLocalBtn, onResolve);
        });

        // Allow Enter key in URL field
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                validateUrlBtn.click();
            }
        });

        // Close button (if allowed)
        if (this.allowClose) {
            const closeBtn = wrapper.querySelector('.data-config-modal-close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.modal.remove();
                    onReject(new Error('Modal closed by user'));
                });
            }
        }

        return wrapper;
    }

    /**
     * Attach listener for download progress events.
     * Shows progress bar with file count as downloads occur.
     * Used during URL validation to show real-time feedback.
     *
     * @returns {void}
     * @private
     */
    attachProgressListener() {
        this.detachProgressListener();
        if (!window.app?.onDataDownloadProgress) return;
        this.progressUnsub = window.app.onDataDownloadProgress((payload) => {
            if (!payload) return;
            const statusEl = this.modal.querySelector('#dataDownloadStatus');
            const barEl = this.modal.querySelector('#dataDownloadProgressBar');
            const textEl = this.modal.querySelector('#dataDownloadStatusText');
            if (!statusEl || !barEl || !textEl) return;

            statusEl.style.display = 'block';

            const total = payload.total || 0;
            const completed = payload.completed || 0;
            const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
            barEl.style.width = `${percent}%`;

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

    /**
     * Remove the download progress event listener.
     * Clean up resources after validation completes or fails.
     *
     * @returns {void}
     * @private
     */
    detachProgressListener() {
        if (this.progressUnsub) {
            this.progressUnsub();
            this.progressUnsub = null;
        }
    }

    /**
     * Validate data source and submit configuration.
     * For URLs: validates accessibility and downloads all files.
     * For Local: validates folder structure and required files.
     * On success: saves config to preferences, reloads app.
     * On failure: shows error message, allows user to retry.
     *
     * @private
     * @param {string} type - 'url' or 'local'
     * @param {string} value - URL or folder path
     * @param {HTMLElement} button - Submit button element
     * @param {Function} onResolve - Callback on success
     * @returns {Promise<void>}
     */
    async _validateAndSubmit(type, value, button, onResolve) {
        if (this.isValidating) return;

        this.isValidating = true;
        button.disabled = true;

        const spinner = button.querySelector('.spinner-icon');
        const text = button.querySelector('.button-text');
        spinner.style.display = 'inline-block';
        text.textContent = type === 'url' ? 'Validating & Downloading...' : 'Validating...';

        if (type === 'url') {
            this.attachProgressListener();
        }

        try {
            console.info(
                'DataConfigurationModal',
                `Validating ${type} source:`,
                value,
            );

            const response = await window.app.validateDataSource({
                type,
                value,
            });

            if (response.success) {
                console.info(
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
                    console.warn('DataConfigurationModal', 'Post-validate refresh failed', error);
                }
                window.location.reload();

                this.detachProgressListener();
                this.modal.remove();
                onResolve({ type, value });
            } else {
                console.warn(
                    'DataConfigurationModal',
                    'Validation failed:',
                    response.error,
                );
                showNotification(`Validation failed: ${response.error}`, 'error');

                this.isValidating = false;
                button.disabled = false;
                spinner.style.display = 'none';
                text.textContent =
                    type === 'url' ? 'Validate & Download' : 'Validate & Use Folder';
                this.detachProgressListener();
            }
        } catch (error) {
            console.error('DataConfigurationModal', 'Error during validation:', error);
            showNotification(`Error: ${error.message}`, 'error');

            this.isValidating = false;
            button.disabled = false;
            spinner.style.display = 'none';
            text.textContent =
                type === 'url' ? 'Validate & Download' : 'Validate & Use Folder';
            this.detachProgressListener();
        }
    }
}
