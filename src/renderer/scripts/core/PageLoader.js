/** Caches, loads, and renders page templates into the content area. */


class PageLoaderImpl {
	constructor() {
		this.templateCache = new Map();
		this.contentArea = null;
		console.info('PageLoader', 'PageLoader initialized');
	}

	/**
	 * Initialize the page loader with content area.
	 * @param {string} contentAreaId - ID of the content area element
	 * @returns {void}
	 */
	initialize(contentAreaId = 'pageContent') {
		this.contentArea = document.getElementById(contentAreaId);

		if (!this.contentArea) {
			console.error('PageLoader', 'Content area not found', { contentAreaId });
			throw new Error('Content area not found');
		}

		console.info('PageLoader', 'Initialized with content area', {
			contentAreaId,
		});
	}

	/**
	 * Load a page template.
	 * @param {string} templateName - Name of the template file
	 * @returns {Promise<string>} HTML string
	 */
	async loadPage(templateName) {
		console.debug('PageLoader', 'Loading page', { templateName });

		// Check cache first
		if (this.templateCache.has(templateName)) {
			console.debug('PageLoader', 'Using cached template', { templateName });
			return this.templateCache.get(templateName);
		}

		try {
			// Try to load from pages directory
			const response = await fetch(`pages/${templateName}`);

			if (!response.ok) {
				throw new Error(
					`Failed to load ${templateName}: ${response.statusText}`,
				);
			}

			const html = await response.text();

			// Cache the template
			this.templateCache.set(templateName, html);

			console.info('PageLoader', 'Page loaded and cached', { templateName });
			return html;
		} catch (error) {
			console.error('PageLoader', 'Load failed', {
				templateName,
				error: error.message,
			});
			throw error;
		}
	}

	/**
	 * Render HTML into the content area.
	 * @param {string} html - HTML content to render
	 * @returns {void}
	 */
	renderPage(html) {
		if (!this.contentArea) {
			console.error('PageLoader', 'Content area not initialized');
			throw new Error('Content area not initialized');
		}

		try {
			this.contentArea.innerHTML = html;
			console.debug('PageLoader', 'Page rendered successfully');
		} catch (error) {
			console.error('PageLoader', 'Render failed', error);
			throw error;
		}
	}

	/**
	 * Load and render a page in one operation.
	 * @param {string} templateName - Name of the template file
	 * @returns {Promise<void>}
	 */
	async loadAndRender(templateName) {
		console.info('PageLoader', 'Load and render', { templateName });

		const html = await this.loadPage(templateName);
		this.renderPage(html);
	}

	/**
	 * Clear the template cache.
	 */
	clearCache() {
		const cacheSize = this.templateCache.size;
		this.templateCache.clear();
		console.info('PageLoader', 'Cache cleared', { cachedTemplates: cacheSize });
	}

	/**
	 * Get cached template count.
	 * @returns {number} Number of cached templates
	 */
	getCacheSize() {
		return this.templateCache.size;
	}

	/**
	 * Render a loading state.
	 */
	renderLoading() {
		if (!this.contentArea) return;

		this.contentArea.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    `;
	}

	/**
	 * Render an error state.
	 * @param {string} message - Error message to display
	 */
	renderError(message) {
		if (!this.contentArea) return;

		this.contentArea.innerHTML = `
      <div class="error-container">
        <i class="fas fa-exclamation-triangle"></i>
        <h2>Error</h2>
        <p>${message}</p>
        <button onclick="location.reload()">Reload</button>
      </div>
    `;
	}
}

// Create singleton instance
export const PageLoader = new PageLoaderImpl();
