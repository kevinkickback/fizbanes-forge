/**
 * Theme Manager
 * Handles theme switching between light and dark modes
 */

export class ThemeManager {
    constructor() {
        this.currentTheme = this.loadTheme();
        this.themeToggleBtn = null;
    }

    /**
     * Initialize the theme manager
     * @param {Object} eventBus - Optional EventBus instance to listen for page changes
     */
    init(eventBus) {
        this.applyTheme(this.currentTheme);
        this.setupToggleButton();

        // Listen for page changes to re-setup buttons
        if (eventBus) {
            eventBus.on('PAGE_CHANGED', () => {
                this.setupToggleButton();
            });
        }

        console.log('[ThemeManager] Initialized with theme:', this.currentTheme);
    }

    /**
     * Load theme preference from localStorage
     * @returns {string} Theme name ('light' or 'dark')
     */
    loadTheme() {
        const saved = localStorage.getItem('theme');
        return saved || 'dark'; // Default to dark theme
    }

    /**
     * Save theme preference to localStorage
     * @param {string} theme - Theme name ('light' or 'dark')
     */
    saveTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    /**
     * Apply theme to the document
     * @param {string} theme - Theme name ('light' or 'dark')
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.updateToggleIcon();
        console.log('[ThemeManager] Applied theme:', theme);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        this.saveTheme(newTheme);
    }

    /**
     * Setup theme toggle button
     */
    setupToggleButton() {
        this.themeToggleBtn = document.getElementById('themeToggle');
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
                // Blur button after click to ensure it reverts to icon-only mode
                setTimeout(() => this.themeToggleBtn.blur(), 0);
            });
            this.updateToggleIcon();
        }
    }

    /**
     * Update toggle button icon based on current theme
     */
    updateToggleIcon() {
        if (!this.themeToggleBtn) return;

        const icon = this.themeToggleBtn.querySelector('i');
        const label = this.themeToggleBtn.querySelector('span#themeToggleLabel');
        if (icon) {
            // Show sun icon in dark mode (to switch to light)
            // Show moon icon in light mode (to switch to dark)
            if (this.currentTheme === 'dark') {
                icon.className = 'fas fa-sun';
                this.themeToggleBtn.title = 'Switch to light theme';
                if (label) label.textContent = 'Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                this.themeToggleBtn.title = 'Switch to dark theme';
                if (label) label.textContent = 'Dark Mode';
            }
        }
    }

    /**
     * Get current theme
     * @returns {string} Current theme name
     */
    getTheme() {
        return this.currentTheme;
    }
}

// Create singleton instance
export const themeManager = new ThemeManager();
