/**
 * Handles the UI for source book selection
 */
export class SourceUI {
    constructor(sourceManager) {
        this.sourceManager = sourceManager;
        this.container = document.getElementById('sourceBookSelection');
        this.sidebarContainer = document.getElementById('sidebarSourceList');
        this.selectedSources = new Set(['PHB', 'DMG', 'MM']); // Core books always selected
        this.isUpdatingFromEvent = false; // Flag to prevent event cascades

        // Bind methods
        this.handleSourceClick = this.handleSourceClick.bind(this);
        this.initializeSourceSelection = this.initializeSourceSelection.bind(this);
        this.initializeSidebarSources = this.initializeSidebarSources.bind(this);
        this.updateSidebarVisibility = this.updateSidebarVisibility.bind(this);
        this.handleCharacterChanged = this.handleCharacterChanged.bind(this);
        this.handleCharacterLoaded = this.handleCharacterLoaded.bind(this);

        // Initialize sidebar sources
        this.initializeSidebarSources();
        this.updateSidebarVisibility();

        // Listen for character events
        window.addEventListener('characterLoaded', this.handleCharacterLoaded);
        window.addEventListener('characterChanged', this.handleCharacterChanged);
    }

    /**
     * Handle character state changes
     */
    handleCharacterChanged() {
        // Only update UI elements, don't trigger source changes
        this.updateSidebarVisibility();
    }

    /**
     * Handle character loaded event
     */
    handleCharacterLoaded() {
        if (window.currentCharacter?.allowedSources) {
            // Update selected sources from character
            this.selectedSources = new Set(window.currentCharacter.allowedSources);

            // Update UI to reflect current sources
            this.updateAllSourceToggles();
            this.updateSidebarVisibility();
        }
    }

    /**
     * Handle source toggle click event
     * @param {Event} event - The click event
     */
    handleSourceClick(event) {
        if (this.isUpdatingFromEvent) return; // Prevent event cascade

        const button = event.currentTarget;
        const source = button.dataset.source;
        const isCore = this.sourceManager.getCoreSources().has(source);

        // Don't allow deselecting core sources
        if (isCore && button.classList.contains('selected')) {
            return;
        }

        button.classList.toggle('selected');

        if (button.classList.contains('selected')) {
            this.selectedSources.add(source);
        } else {
            this.selectedSources.delete(source);
        }

        // Update all instances of this source toggle
        this.updateSourceToggles(source);

        // Update character's allowed sources and trigger unsaved changes
        if (window.currentCharacter) {
            this.isUpdatingFromEvent = true;
            try {
                // Create a new Set with the current sources
                const updatedSources = new Set(this.selectedSources);

                // Ensure core sources are included
                for (const coreSource of this.sourceManager.getCoreSources()) {
                    updatedSources.add(coreSource);
                }

                // Update the character's allowed sources
                window.currentCharacter.setAllowedSources(updatedSources);

                // Only dispatch unsaved changes event
                window.dispatchEvent(new CustomEvent('unsavedChanges'));
            } finally {
                this.isUpdatingFromEvent = false;
            }
        }
    }

    /**
     * Update all source toggles to match current state
     */
    updateAllSourceToggles() {
        // Update all source toggles in both containers
        const updateContainer = (container) => {
            if (!container) return;
            const buttons = container.querySelectorAll('.source-toggle');
            buttons.forEach(button => {
                const source = button.dataset.source;
                button.classList.toggle('selected', this.selectedSources.has(source));
            });
        };

        updateContainer(this.container);
        updateContainer(this.sidebarContainer);
    }

    /**
     * Initialize the source book selection UI
     */
    initializeSourceSelection() {
        if (!this.container) return;

        // Clear existing content
        this.container.innerHTML = '';

        // Get available sources and core sources
        const availableSources = this.sourceManager.getAvailableSources();
        const coreSources = this.sourceManager.getCoreSources();

        // Create buttons for each non-core source
        for (const [abbr, details] of availableSources) {
            if (!coreSources.has(abbr)) {
                const button = this.createSourceToggle(abbr, details, false);
                this.container.appendChild(button);
            }
        }
    }

    /**
     * Initialize the sidebar sources UI
     */
    initializeSidebarSources() {
        if (!this.sidebarContainer) return;

        // Clear existing content
        this.sidebarContainer.innerHTML = '';

        // Get available sources
        const availableSources = this.sourceManager.getAvailableSources();

        // Create buttons for all sources (including core)
        for (const [abbr, details] of availableSources) {
            const button = this.createSourceToggle(abbr, details, true);
            this.sidebarContainer.appendChild(button);
        }

        // Initially hide the sidebar sources section
        this.updateSidebarVisibility();
    }

    /**
     * Update sidebar visibility based on active character
     */
    updateSidebarVisibility() {
        if (!this.sidebarContainer) return;

        const sourcesSection = this.sidebarContainer.closest('.sidebar-sources');
        if (!sourcesSection) return;

        // Show sources section only if there is an active character with an id
        if (window.currentCharacter && window.currentCharacter.id) {
            sourcesSection.style.display = 'block';
            if (window.currentCharacter.allowedSources) {
                // Convert array to Set if needed
                const sources = Array.isArray(window.currentCharacter.allowedSources)
                    ? new Set(window.currentCharacter.allowedSources)
                    : window.currentCharacter.allowedSources;
                this.setSelectedSources(sources);
            } else {
                // Reset to core sources when no sources are set
                this.setSelectedSources(this.sourceManager.getCoreSources());
            }
        } else {
            // Hide sources section when no character is active
            sourcesSection.style.display = 'none';
            // Reset to core sources
            this.setSelectedSources(this.sourceManager.getCoreSources());
        }
    }

    /**
     * Create a source toggle button
     * @param {string} abbr - Source abbreviation
     * @param {Object} details - Source details
     * @param {boolean} isSidebar - Whether this toggle is for the sidebar
     * @returns {HTMLElement} The created button element
     */
    createSourceToggle(abbr, details, isSidebar = false) {
        const button = document.createElement('div');
        button.className = 'source-toggle';
        button.dataset.source = abbr;
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');

        // Add book icon
        const icon = document.createElement('i');
        icon.className = 'fas fa-book';
        button.appendChild(icon);

        // Add source name in span
        const nameSpan = document.createElement('span');
        nameSpan.className = 'source-name';

        // Use abbreviated name in sidebar, full name in modal
        if (isSidebar) {
            nameSpan.textContent = abbr === 'XPHB' ? "PHB '24" : abbr;
        } else {
            nameSpan.textContent = details.name;
        }

        button.appendChild(nameSpan);

        // Set initial selected state
        if (this.selectedSources.has(abbr)) {
            button.classList.add('selected');
        }

        // Add event listeners
        button.addEventListener('click', this.handleSourceClick);
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleSourceClick(e);
            }
        });

        return button;
    }

    /**
     * Update all instances of a source toggle
     * @param {string} source - Source abbreviation
     */
    updateSourceToggles(source) {
        const isSelected = this.selectedSources.has(source);

        // Update in floating UI
        if (this.container) {
            const floatingButton = this.container.querySelector(`[data-source="${source}"]`);
            if (floatingButton) {
                floatingButton.classList.toggle('selected', isSelected);
            }
        }

        // Update in sidebar
        if (this.sidebarContainer) {
            const sidebarButton = this.sidebarContainer.querySelector(`[data-source="${source}"]`);
            if (sidebarButton) {
                sidebarButton.classList.toggle('selected', isSelected);
            }
        }
    }

    /**
     * Get the currently selected sources
     * @returns {Set} Set of selected source abbreviations
     */
    getSelectedSources() {
        return this.selectedSources;
    }

    /**
     * Set the selected sources
     * @param {Set} sources - Set of source abbreviations to select
     */
    setSelectedSources(sources) {
        this.selectedSources = new Set(sources);

        // Update all source toggles in both containers
        const updateContainer = (container) => {
            if (container) {
                const buttons = container.querySelectorAll('.source-toggle');
                buttons.forEach(button => {
                    const source = button.dataset.source;
                    button.classList.toggle('selected', this.selectedSources.has(source));
                });
            }
        };

        updateContainer(this.container);
        updateContainer(this.sidebarContainer);
    }
} 