/**
 * SourceCard.js
 * Manages the UI for source book selection in character creation
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
            console.error('Source selection container not found');
            return;
        }

        // Initialize header container
        this.headerContainer = document.getElementById('sourceBookHeader');
        if (!this.headerContainer) {
            console.error('Source book header container not found');
            return;
        }

        // Initialize source manager if not already initialized
        if (!this._initialized) {
            await this.sourceManager.initialize();
            this._initialized = true;
        }

        // Clear existing content
        this.container.innerHTML = '';
        this.headerContainer.innerHTML = '';

        // Add header with links
        const headerElement = this.createSourceHeader();
        this.headerContainer.appendChild(headerElement);

        // Get available sources
        const availableSources = this.sourceManager.getAvailableSources();
        console.log('Available sources:', availableSources);

        // Create source toggles
        for (const source of availableSources) {
            const toggle = this.createSourceToggle(source);
            this.container.appendChild(toggle);
        }

        // Pre-select PHB
        const phbToggle = this.container.querySelector('[data-source="PHB"]');
        if (phbToggle) {
            this.handleSourceClick(phbToggle);
        }
    }

    /**
     * Creates the source selection header with links
     * @returns {HTMLElement} The header container with links
     */
    createSourceHeader() {
        const headerContainer = document.createElement('div');
        headerContainer.className = 'mb-1';

        // Create the header
        const header = document.createElement('label');
        header.className = 'form-label';
        header.textContent = 'Source Books';
        headerContainer.appendChild(header);

        // Create the links container
        const linksContainer = document.createElement('div');
        linksContainer.className = 'd-flex align-items-center gap-2 ps-2';

        // Create Select All link
        const selectAllLink = document.createElement('a');
        selectAllLink.href = '#';
        selectAllLink.className = 'text-decoration-none text-accent';
        selectAllLink.textContent = 'Select All';
        selectAllLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.selectAllSources();
        });

        // Create divider
        const divider = document.createElement('span');
        divider.className = 'text-muted';
        divider.textContent = '|';

        // Create None link
        const selectNoneLink = document.createElement('a');
        selectNoneLink.href = '#';
        selectNoneLink.className = 'text-decoration-none text-accent';
        selectNoneLink.textContent = 'None';
        selectNoneLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.deselectAllSources();
        });

        linksContainer.appendChild(selectAllLink);
        linksContainer.appendChild(divider);
        linksContainer.appendChild(selectNoneLink);
        headerContainer.appendChild(linksContainer);

        return headerContainer;
    }

    /**
     * Selects all available source books
     */
    selectAllSources() {
        const toggles = this.container.querySelectorAll('.source-toggle');
        for (const toggle of toggles) {
            if (!toggle.classList.contains('selected')) {
                this.handleSourceClick(toggle);
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
                this.handleSourceClick(toggle);
            }
        }
    }

    /**
     * Creates a toggle button for a source book
     * @param {string} source - The source book identifier
     * @returns {HTMLElement} The created toggle button
     */
    createSourceToggle(source) {
        const toggle = document.createElement('button');
        toggle.className = 'source-toggle';
        toggle.setAttribute('data-source', source);
        toggle.setAttribute('role', 'checkbox');
        toggle.setAttribute('aria-checked', 'false');
        toggle.setAttribute('tabindex', '0');
        toggle.setAttribute('type', 'button'); // Prevent form submission

        // Add icon
        const icon = document.createElement('i');
        icon.className = 'fas fa-book';
        toggle.appendChild(icon);

        // Add source name
        const name = document.createElement('span');
        name.textContent = this.sourceManager.formatSourceName(source);
        toggle.appendChild(name);

        // Add event listeners
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSourceClick(toggle);
        });
        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleSourceClick(toggle);
            }
        });

        return toggle;
    }

    /**
     * Handles clicking a source toggle
     * @param {HTMLElement} toggle - The clicked toggle button
     */
    handleSourceClick(toggle) {
        // Prevent form submission
        toggle.preventDefault?.();

        const source = toggle.getAttribute('data-source');
        const isSelected = toggle.classList.contains('selected');

        // Toggle selection
        toggle.classList.toggle('selected', !isSelected);
        toggle.setAttribute('aria-checked', !isSelected);

        if (!isSelected) {
            this._selectedSources.add(source);
        } else {
            this._selectedSources.delete(source);
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

    async loadSources() {
        try {
            return await this.sourceManager.loadSources();
        } catch (error) {
            console.error('Error loading sources:', error);
            showNotification('Error loading sources', 'error');
            return [];
        }
    }

    addSource(sourceId) {
        this._selectedSources.add(sourceId);
        this.sourceManager.addSource(sourceId);
    }

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