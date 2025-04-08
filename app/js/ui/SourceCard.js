/**
 * SourceCard.js
 * Manages the UI for source book selection in character creation.
 * 
 * @typedef {Object} SourceToggle
 * @property {HTMLElement} element - The toggle button element
 * @property {string} source - The source book identifier
 * @property {boolean} isSelected - Whether the source is currently selected
 */

import { sourceManager } from '../managers/SourceManager.js';
import { showNotification } from '../utils/notifications.js';

/**
 * Manages the source book selection UI component
 */
export class SourceCard {
    /**
     * Creates a new SourceCard instance
     */
    constructor() {
        /**
         * Container for source toggles
         * @type {HTMLElement|null}
         * @private
         */
        this._container = null;

        /**
         * Container for the header
         * @type {HTMLElement|null}
         * @private
         */
        this._headerContainer = null;

        /**
         * Source manager instance
         * @type {SourceManager}
         * @private
         */
        this._sourceManager = sourceManager;

        /**
         * Set of currently selected sources
         * @type {Set<string>}
         * @private
         */
        this._selectedSources = new Set();

        /**
         * Whether the component has been initialized
         * @type {boolean}
         * @private
         */
        this._initialized = false;
    }

    //-------------------------------------------------------------------------
    // Initialization Methods
    //-------------------------------------------------------------------------

    /**
     * Initializes the source book selection UI
     * @returns {Promise<void>}
     */
    async initializeSourceSelection() {
        try {
            if (!this._container) {
                console.error('Source selection container not found');
                return;
            }

            this._headerContainer = document.getElementById('sourceBookHeader');
            if (!this._headerContainer) {
                console.error('Source book header container not found');
                return;
            }

            if (!this._initialized) {
                await this._sourceManager.initialize();
                this._initialized = true;
            }

            this._container.innerHTML = '';
            this._headerContainer.innerHTML = '';

            this._headerContainer.appendChild(this._createSourceHeader());

            const availableSources = this._sourceManager.getAvailableSources();
            for (const source of availableSources) {
                this._container.appendChild(this._createSourceToggle(source));
            }

            // Pre-select PHB
            this._preselectDefaultSources();
        } catch (error) {
            console.error('Error initializing source selection:', error);
        }
    }

    /**
     * Pre-selects default sources like the Player's Handbook
     * @private
     */
    _preselectDefaultSources() {
        const phbToggle = this._container.querySelector('[data-source="PHB"]');
        if (phbToggle) {
            this._handleSourceClick(phbToggle);
        }
    }

    //-------------------------------------------------------------------------
    // UI Creation Methods
    //-------------------------------------------------------------------------

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
        name.textContent = this._sourceManager.formatSourceName(source);
        toggle.appendChild(name);

        this._setupToggleEventListeners(toggle);
        return toggle;
    }

    //-------------------------------------------------------------------------
    // Event Handling Methods
    //-------------------------------------------------------------------------

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
        try {
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
        } catch (error) {
            console.error('Error handling source click:', error);
        }
    }

    //-------------------------------------------------------------------------
    // Selection Management Methods
    //-------------------------------------------------------------------------

    /**
     * Selects all available source books
     */
    selectAllSources() {
        try {
            const toggles = this._container.querySelectorAll('.source-toggle');
            for (const toggle of toggles) {
                if (!toggle.classList.contains('selected')) {
                    this._handleSourceClick(toggle);
                }
            }
        } catch (error) {
            console.error('Error selecting all sources:', error);
        }
    }

    /**
     * Deselects all source books
     */
    deselectAllSources() {
        try {
            const toggles = this._container.querySelectorAll('.source-toggle');
            for (const toggle of toggles) {
                if (toggle.classList.contains('selected')) {
                    this._handleSourceClick(toggle);
                }
            }
        } catch (error) {
            console.error('Error deselecting all sources:', error);
        }
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

    //-------------------------------------------------------------------------
    // Source Data Methods
    //-------------------------------------------------------------------------

    /**
     * Loads available source books
     * @returns {Promise<Array>} Array of available sources
     */
    async loadSources() {
        try {
            return await this._sourceManager.loadSources();
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
        try {
            this._selectedSources.add(sourceId);
            this._sourceManager.addSource(sourceId);
        } catch (error) {
            console.error('Error adding source:', error);
        }
    }

    /**
     * Removes a source from the selection
     * @param {string} sourceId - The source book identifier
     * @returns {boolean} Whether the source was removed
     */
    removeSource(sourceId) {
        try {
            if (this._selectedSources.has(sourceId)) {
                this._selectedSources.delete(sourceId);
                this._sourceManager.removeSource(sourceId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error removing source:', error);
            return false;
        }
    }

    /**
     * Clears all selected sources
     */
    clearSources() {
        try {
            this._selectedSources.clear();
            this._sourceManager.clearSources();
        } catch (error) {
            console.error('Error clearing sources:', error);
        }
    }

    //-------------------------------------------------------------------------
    // Getters and Setters
    //-------------------------------------------------------------------------

    /**
     * Gets the currently selected sources
     * @returns {Array<string>} Array of selected source IDs
     */
    get selectedSources() {
        return Array.from(this._selectedSources);
    }

    /**
     * Sets the selected sources
     * @param {Array<string>} sources - Array of source IDs to select
     */
    set selectedSources(sources) {
        this._selectedSources = new Set(sources);
    }

    /**
     * Sets the container element for source toggles
     * @param {HTMLElement} container - The container element
     */
    set container(container) {
        this._container = container;
    }

    /**
     * Gets the container element for source toggles
     * @returns {HTMLElement|null} The container element
     */
    get container() {
        return this._container;
    }
} 