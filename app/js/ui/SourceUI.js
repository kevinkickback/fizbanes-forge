/**
 * Handles the UI for source book selection
 */
export class SourceUI {
    constructor(sourceManager) {
        this.sourceManager = sourceManager;
        this.container = document.getElementById('sourceBookSelection');
        this.sidebarContainer = document.getElementById('sidebarSourceList');
        // Track sources separately for modal and sidebar
        this.modalSources = new Set();
        this.sidebarSources = new Set();
    }

    /**
     * Initialize the source book selection UI for the create modal
     */
    initializeSourceSelection() {
        if (!this.container) return;

        // Clear existing content
        this.container.innerHTML = '';

        // Get available sources
        const availableSources = this.sourceManager.getAvailableSources();

        // Create buttons for all sources
        for (const [abbr, details] of availableSources) {
            const button = this.createSourceToggle(abbr, details, true, false);
            this.container.appendChild(button);
        }
    }

    /**
     * Initialize the sidebar sources UI
     */
    initializeSidebarSources() {
        if (!this.sidebarContainer) return;

        // Only initialize if not already initialized
        if (this.sidebarContainer.children.length === 0) {
            // Get available sources
            const availableSources = this.sourceManager.getAvailableSources();

            // Create buttons for all sources
            for (const [abbr, details] of availableSources) {
                const button = this.createSourceToggle(abbr, details, true, true);
                this.sidebarContainer.appendChild(button);
            }
        }
    }

    /**
     * Create a source toggle button
     * @param {string} abbr - Source abbreviation
     * @param {Object} details - Source details
     * @param {boolean} isInteractive - Whether the button should be clickable
     * @param {boolean} isSidebar - Whether this is a sidebar toggle
     * @returns {HTMLElement} The created button element
     */
    createSourceToggle(abbr, details, isInteractive, isSidebar) {
        const button = document.createElement('div');
        button.className = 'source-toggle';
        button.dataset.source = abbr;

        // Add book icon
        const icon = document.createElement('i');
        icon.className = 'fas fa-book';
        button.appendChild(icon);

        // Add source name in span
        const nameSpan = document.createElement('span');
        nameSpan.className = 'source-name';
        nameSpan.textContent = abbr === 'XPHB' ? "PHB '24" : abbr;
        button.appendChild(nameSpan);

        // Add click handlers if interactive
        if (isInteractive) {
            button.setAttribute('role', 'button');
            button.setAttribute('tabindex', '0');
            button.addEventListener('click', () => this.handleSourceClick(button, isSidebar));
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleSourceClick(button, isSidebar);
                }
            });
        }

        return button;
    }

    /**
     * Handle source toggle click event
     * @param {HTMLElement} button - The clicked button
     * @param {boolean} isSidebar - Whether this is a sidebar toggle
     */
    handleSourceClick(button, isSidebar) {
        const source = button.dataset.source;
        const isSelected = !button.classList.contains('selected');

        // Update UI
        button.classList.toggle('selected', isSelected);

        if (isSidebar && window.currentCharacter) {
            // Update sidebar sources and character's allowed sources
            if (isSelected) {
                this.sidebarSources.add(source);
            } else {
                this.sidebarSources.delete(source);
            }

            // Update character's sources
            window.currentCharacter.allowedSources = new Set(this.sidebarSources);
            window.currentCharacter.setAllowedSources(this.sidebarSources);
            window.dispatchEvent(new CustomEvent('unsavedChanges'));
        } else {
            // Update modal sources
            if (isSelected) {
                this.modalSources.add(source);
            } else {
                this.modalSources.delete(source);
            }
        }
    }

    /**
     * Update sidebar source toggles to match character's allowed sources
     * @param {Set} allowedSources - Set of source abbreviations from character save file
     */
    setSelectedSources(allowedSources) {
        if (!this.sidebarContainer) return;

        // Initialize sidebar if needed
        this.initializeSidebarSources();

        // First, update our internal state
        this.sidebarSources = new Set(allowedSources);

        // Then update the UI to match exactly what's in allowedSources
        const buttons = this.sidebarContainer.querySelectorAll('.source-toggle');
        buttons.forEach(button => {
            const source = button.dataset.source;
            const shouldBeSelected = allowedSources.has(source);

            // Only update if the state needs to change
            if (button.classList.contains('selected') !== shouldBeSelected) {
                button.classList.toggle('selected', shouldBeSelected);
            }
        });

        // Update character's sources if it exists
        if (window.currentCharacter) {
            window.currentCharacter.allowedSources = new Set(allowedSources);
            window.currentCharacter.setAllowedSources(allowedSources);
        }
    }

    /**
     * Get the currently selected sources
     * @returns {Set} Set of selected source abbreviations
     */
    getSelectedSources() {
        // If we're in the create modal, return modal sources
        if (document.getElementById('newCharacterModal')?.classList.contains('show')) {
            return new Set(this.modalSources);
        }
        // Otherwise return sidebar sources
        return new Set(this.sidebarSources);
    }
} 