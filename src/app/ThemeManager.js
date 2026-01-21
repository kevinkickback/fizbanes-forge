export class ThemeManager {
    constructor() {
        this.currentTheme = this.loadTheme();
        this.themeToggleBtn = null;
    }

    init(eventBus) {
        this.applyTheme(this.currentTheme);
        this.setupToggleButton();

        if (eventBus) {
            eventBus.on('PAGE_CHANGED', () => {
                this.setupToggleButton();
            });
        }

        console.debug('[ThemeManager] Initialized with theme:', this.currentTheme);
    }

    loadTheme() {
        const saved = localStorage.getItem('theme');
        return saved || 'dark';
    }

    saveTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        this.updateToggleIcon();
        console.debug('[ThemeManager] Applied theme:', theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
        this.saveTheme(newTheme);
    }

    setupToggleButton() {
        this.themeToggleBtn = document.getElementById('themeToggle');
        if (this.themeToggleBtn) {
            this.themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
                setTimeout(() => this.themeToggleBtn.blur(), 0);
            });
            this.updateToggleIcon();
        }
    }

    updateToggleIcon() {
        if (!this.themeToggleBtn) return;

        const icon = this.themeToggleBtn.querySelector('i');
        const label = this.themeToggleBtn.querySelector('span#themeToggleLabel');
        if (icon) {
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

    getTheme() {
        return this.currentTheme;
    }
}

// Create singleton instance
export const themeManager = new ThemeManager();
