/**
 * SourceCard.js
 * Manages the UI for source book selection in character creation.
 * 
 * @typedef {Object} SourceToggle
 * @property {HTMLElement} element - The toggle button element
 * @property {string} source - The source book identifier
 * @property {boolean} isSelected - Whether the source is currently selected
 */

import { SourceManager } from '../managers/SourceManager.js';
import { showNotification } from '../utils/notifications.js';

export class SourceCard {
    constructor() {
        this.container = null;
        this.headerContainer = null;
        this.sourceManager = new SourceManager();
        this._selectedSources = new Set();
        this._initialized = false;
    }

    /**
     * Initializes the source book selection UI
     * @returns {Promise<void>}
     */
    async initializeSourceSelection() {
        if (!this.container) {
            console.error('[SourceCard] Source selection container not found');
            return;
        }

        this.headerContainer = document.getElementById('sourceBookHeader');
        if (!this.headerContainer) {
            console.error('[SourceCard] Source book header container not found');
            return;
        }

        if (!this._initialized) {
            await this.sourceManager.initialize();
            this._initialized = true;
        }

        this.container.innerHTML = '';
        this.headerContainer.innerHTML = '';

        this.headerContainer.appendChild(this._createSourceHeader());

        const availableSources = this.sourceManager.getAvailableSources();
        for (const source of availableSources) {
            this.container.appendChild(this._createSourceToggle(source));
        }

        // Pre-select PHB
        const phbToggle = this.container.querySelector('[data-source="PHB"]');
        if (phbToggle) {
            this._handleSourceClick(phbToggle);
        }
    }

    /**
     * Creates the source selection header with links
     * @returns {HTMLElement} The header container with links
     * @private
     */
    _createSourceHeader() {
        const headerContainer = document.createElement('div');
        headerContainer.className = 'mb-1';

        const header = document.createElement('label');
        header.className = 'form-label';
        header.textContent = 'Source Books';
        headerContainer.appendChild(header);

        const linksContainer = document.createElement('div');
        linksContainer.className = 'd-flex align-items-center gap-2 ps-2';

        const selectAllLink = this._createHeaderLink('Select All', () => this.selectAllSources());
        const divider = document.createElement('span');
        divider.className = 'text-muted';
        divider.textContent = '|';
        const selectNoneLink = this._createHeaderLink('None', () => this.deselectAllSources());

        linksContainer.append(selectAllLink, divider, selectNoneLink);
        headerContainer.appendChild(linksContainer);

        return headerContainer;
    }

    /**
     * Creates a header link with the given text and click handler
     * @param {string} text - Link text
     * @param {Function} onClick - Click handler
     * @returns {HTMLElement} The created link element
     * @private
     */
    _createHeaderLink(text, onClick) {
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'text-decoration-none text-accent';
        link.textContent = text;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            onClick();
        });
        return link;
    }

    /**
     * Selects all available source books
     */
    selectAllSources() {
        const toggles = this.container.querySelectorAll('.source-toggle');
        for (const toggle of toggles) {
            if (!toggle.classList.contains('selected')) {
                this._handleSourceClick(toggle);
            }
        }
    }

    /**
     * Deselects all source books
     */
    deselectAllSources() {
        const toggles = this.container.querySelectorAll('.source-toggle');
        for (const toggle of toggles) {
            if (toggle.classList.contains('selected')) {
                this._handleSourceClick(toggle);
            }
        }
    }

    /**
     * Creates a toggle button for a source book
     * @param {string} source - The source book identifier
     * @returns {HTMLElement} The created toggle button
     * @private
     */
    _createSourceToggle(source) {
        const toggle = document.createElement('button');
        toggle.className = 'source-toggle';
        toggle.setAttribute('data-source', source);
        toggle.setAttribute('role', 'checkbox');
        toggle.setAttribute('aria-checked', 'false');
        toggle.setAttribute('tabindex', '0');
        toggle.setAttribute('type', 'button');

        const icon = document.createElement('i');
        icon.className = 'fas fa-book';
        toggle.appendChild(icon);

        const name = document.createElement('span');
        name.textContent = this.sourceManager.formatSourceName(source);
        toggle.appendChild(name);

        this._setupToggleEventListeners(toggle);
        return toggle;
    }

    /**
     * Sets up event listeners for a source toggle
     * @param {HTMLElement} toggle - The toggle button element
     * @private
     */
    _setupToggleEventListeners(toggle) {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            this._handleSourceClick(toggle);
        });
        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._handleSourceClick(toggle);
            }
        });
    }

    /**
     * Handles clicking a source toggle
     * @param {HTMLElement} toggle - The clicked toggle button
     * @private
     */
    _handleSourceClick(toggle) {
        toggle.preventDefault?.();

        const source = toggle.getAttribute('data-source');
        const isSelected = toggle.classList.contains('selected');

        toggle.classList.toggle('selected', !isSelected);
        toggle.setAttribute('aria-checked', !isSelected);

        if (!isSelected) {
            this._selectedSources.add(source);
        } else {
            this._selectedSources.delete(source);
        }

        this._validateSourceSelection();
    }

    /**
     * Validates the source selection
     * @param {Set<string>} selectedSources - The set of selected source books
     * @returns {boolean} Whether the selection is valid
     */
    validateSourceSelection(selectedSources) {
        if (!selectedSources.has('PHB') && !selectedSources.has('XPHB')) {
            showNotification('Please select at least one Player\'s Handbook (PHB\'14 or PHB\'24)', 'warning');
            return false;
        }
        return true;
    }

    /**
     * Validates the current source selection
     * @private
     */
    _validateSourceSelection() {
        if (!this._selectedSources.has('PHB') && !this._selectedSources.has('XPHB')) {
            showNotification('Please select at least one Player\'s Handbook (PHB\'14 or PHB\'24)', 'warning');
        }
    }

    /**
     * Loads available source books
     * @returns {Promise<Array>} Array of available sources
     */
    async loadSources() {
        try {
            return await this.sourceManager.loadSources();
        } catch (error) {
            console.error('Error loading sources:', error);
            showNotification('Error loading sources', 'error');
            return [];
        }
    }

    /**
     * Adds a source to the selection
     * @param {string} sourceId - The source book identifier
     */
    addSource(sourceId) {
        this._selectedSources.add(sourceId);
        this.sourceManager.addSource(sourceId);
    }

    /**
     * Removes a source from the selection
     * @param {string} sourceId - The source book identifier
     * @returns {boolean} Whether the source was removed
     */
    removeSource(sourceId) {
        if (sourceId === 'PHB') {
            showNotification('Cannot remove Player\'s Handbook', 'warning');
            return false;
        }
        const removed = this._selectedSources.delete(sourceId);
        if (removed) {
            this.sourceManager.removeSource(sourceId);
        }
        return removed;
    }

    /**
     * Clears all selected sources
     */
    clearSources() {
        this._selectedSources = new Set();
        this.sourceManager.clearSources();
    }

    /**
     * Get the currently selected sources
     * @returns {Set<string>} Set of selected source codes
     */
    get selectedSources() {
        return this._selectedSources;
    }

    /**
     * Set the selected sources
     * @param {Set<string>} sources - Set of source codes to select
     */
    set selectedSources(sources) {
        this._selectedSources = new Set(sources);
        if (this.container) {
            const toggles = this.container.querySelectorAll('.source-toggle');
            for (const toggle of toggles) {
                const source = toggle.getAttribute('data-source');
                toggle.classList.toggle('selected', sources.has(source));
                toggle.setAttribute('aria-checked', sources.has(source));
            }
        }
    }
} 