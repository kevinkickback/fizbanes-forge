/**
 * Page template loading and rendering.
 * 
 * ARCHITECTURE: Presentation Layer - Handles HTML templates
 * 
 * PURPOSE:
 * - Load page templates from files or embedded HTML
 * - Render templates into the content area
 * - Cache loaded templates for performance
 * - Handle template loading errors
 * 
 * @module presentation/PageLoader
 */

import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';

class PageLoaderImpl {
    constructor() {
        this.templateCache = new Map();
        this.contentArea = null;
        Logger.info('PageLoader', 'PageLoader initialized');
    }

    /**
     * Initialize the page loader with content area.
     * @param {string} contentAreaId - ID of the content area element
     * @returns {Result} Result with success or error
     */
    initialize(contentAreaId = 'content-area') {
        this.contentArea = document.getElementById(contentAreaId);

        if (!this.contentArea) {
            Logger.error('PageLoader', 'Content area not found', { contentAreaId });
            return Result.err('Content area not found');
        }

        Logger.info('PageLoader', 'Initialized with content area', { contentAreaId });
        return Result.ok(true);
    }

    /**
     * Load a page template.
     * @param {string} templateName - Name of the template file
     * @returns {Promise<Result>} Result with HTML string or error
     */
    async loadPage(templateName) {
        Logger.debug('PageLoader', 'Loading page', { templateName });

        // Check cache first
        if (this.templateCache.has(templateName)) {
            Logger.debug('PageLoader', 'Using cached template', { templateName });
            return Result.ok(this.templateCache.get(templateName));
        }

        try {
            // Try to load from templates directory
            const response = await fetch(`templates/pages/${templateName}`);

            if (!response.ok) {
                throw new Error(`Failed to load ${templateName}: ${response.statusText}`);
            }

            const html = await response.text();

            // Cache the template
            this.templateCache.set(templateName, html);

            Logger.info('PageLoader', 'Page loaded and cached', { templateName });
            return Result.ok(html);

        } catch (error) {
            Logger.error('PageLoader', 'Load failed', { templateName, error: error.message });
            return Result.err(error.message);
        }
    }

    /**
     * Render HTML into the content area.
     * @param {string} html - HTML content to render
     * @returns {Result} Result with success or error
     */
    renderPage(html) {
        if (!this.contentArea) {
            Logger.error('PageLoader', 'Content area not initialized');
            return Result.err('Content area not initialized');
        }

        try {
            this.contentArea.innerHTML = html;
            Logger.debug('PageLoader', 'Page rendered successfully');
            return Result.ok(true);
        } catch (error) {
            Logger.error('PageLoader', 'Render failed', error);
            return Result.err(error.message);
        }
    }

    /**
     * Load and render a page in one operation.
     * @param {string} templateName - Name of the template file
     * @returns {Promise<Result>} Result with success or error
     */
    async loadAndRender(templateName) {
        Logger.info('PageLoader', 'Load and render', { templateName });

        const loadResult = await this.loadPage(templateName);
        if (loadResult.isErr()) {
            return loadResult;
        }

        return this.renderPage(loadResult.value);
    }

    /**
     * Clear the template cache.
     */
    clearCache() {
        const cacheSize = this.templateCache.size;
        this.templateCache.clear();
        Logger.info('PageLoader', 'Cache cleared', { cachedTemplates: cacheSize });
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
