/**
 * Handles the UI for source book selection in the create character modal
 */
export class SourceUI {
    constructor(sourceManager) {
        this.sourceManager = sourceManager;
        this.container = document.getElementById('sourceBookSelection');
        this.selectedSources = new Set();
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
            const button = this.createSourceToggle(abbr, details);
            // Pre-select PHB'14 by default
            if (abbr === 'PHB') {
                button.classList.add('selected');
                this.selectedSources.add(abbr);
            }
            this.container.appendChild(button);
        }
    }

    /**
     * Create a source toggle button
     * @param {string} abbr - Source abbreviation
     * @param {Object} details - Source details
     * @returns {HTMLElement} The created button element
     */
    createSourceToggle(abbr, details) {
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
        nameSpan.textContent = details.name;
        button.appendChild(nameSpan);

        // Add click handlers
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');
        button.addEventListener('click', () => this.handleSourceClick(button));
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.handleSourceClick(button);
            }
        });

        return button;
    }

    /**
     * Validate that at least one PHB version is selected
     * @returns {boolean} True if the selection is valid
     */
    validateSourceSelection() {
        const hasPHB14 = this.selectedSources.has('PHB');
        const hasPHB24 = this.selectedSources.has('XPHB');
        return hasPHB14 || hasPHB24;
    }

    /**
     * Handle source toggle click event
     * @param {HTMLElement} button - The clicked button
     */
    handleSourceClick(button) {
        const source = button.dataset.source;
        const isSelected = !button.classList.contains('selected');
        const isPHB = source === 'PHB' || source === 'XPHB';

        // If trying to deselect a PHB version, check if it would leave no PHB selected
        if (!isSelected && isPHB) {
            const otherPHB = source === 'PHB' ? 'XPHB' : 'PHB';
            if (!this.selectedSources.has(otherPHB)) {
                window.showNotification('At least one player\'s handbook must be selected', 'warning');
                return;
            }
        }

        // Update UI
        button.classList.toggle('selected', isSelected);

        // Update selected sources
        if (isSelected) {
            this.selectedSources.add(source);
        } else {
            this.selectedSources.delete(source);
        }
    }

    /**
     * Get the currently selected sources
     * @returns {Set} Set of selected source abbreviations
     */
    getSelectedSources() {
        return new Set(this.selectedSources);
    }

    /**
     * Set the selected sources
     * @param {Set<string>} sources - Set of source abbreviations to select
     */
    setSelectedSources(sources) {
        // Ensure at least one PHB is selected
        if (!sources.has('PHB') && !sources.has('XPHB')) {
            sources.add('PHB'); // Default to PHB'14 if neither is selected
        }

        this.selectedSources = new Set(sources);

        // Update UI to reflect the selection
        if (this.container) {
            const buttons = this.container.querySelectorAll('.source-toggle');
            for (const button of buttons) {
                const source = button.dataset.source;
                button.classList.toggle('selected', sources.has(source));
            }
        }
    }
} 