// Navigation utilities

// Import required dependencies
import { showNotification } from './notifications.js';
import { characterHandler } from './characterHandler.js';
import { settingsManager } from '../managers/SettingsManager.js';

// Navigation app with all navigation-related functionality
export const navigation = {
    currentPage: 'home',
    _initialized: false,

    /**
     * Initialize the navigation system
     */
    initialize() {
        if (this._initialized) return;

        // Set up navigation buttons
        const navButtons = document.querySelectorAll('.nav-link');
        for (const button of navButtons) {
            button.addEventListener('click', (e) => {
                if (button.classList.contains('disabled')) {
                    e.preventDefault();
                    showNotification('Please select or create a character first', 'warning');
                    return;
                }

                const page = button.getAttribute('data-page');
                this.loadPage(page);
            });
        }

        // Load initial page
        this.loadPage('home');
        this._initialized = true;
        console.log('Navigation initialized');
    },

    /**
     * Load a page by name
     * @param {string} pageName - Name of the page to load
     */
    loadPage(pageName) {
        // Prevent navigation to character pages if no character is selected
        if (['build', 'equipment', 'details'].includes(pageName) &&
            (!window.currentCharacter || !window.currentCharacter.id)) {
            showNotification('Please select or create a character first', 'warning');
            return;
        }

        // Update navigation state
        const navLinks = document.querySelectorAll('.nav-link');
        for (const link of navLinks) {
            const page = link.getAttribute('data-page');
            link.classList.toggle('active', page === pageName);
            if (['build', 'equipment', 'details'].includes(page)) {
                link.classList.toggle('disabled', !window.currentCharacter);
            }
        }

        // Load page content
        const pageContent = document.getElementById('pageContent');
        const template = document.getElementById(`${pageName}Page`);

        if (template) {
            pageContent.innerHTML = '';
            pageContent.appendChild(template.content.cloneNode(true));
            document.body.setAttribute('data-current-page', pageName);
            this.currentPage = pageName;
            this._initializePageContent(pageName);
        }
    },

    /**
     * Initialize content for the current page
     * @private
     */
    _initializePageContent(pageName) {
        switch (pageName) {
            case 'home':
                // Load characters and initialize event listeners for new DOM elements
                characterHandler.loadCharacters();
                characterHandler.initializeEventListeners();
                break;
            case 'build':
                // Initialize build page
                break;
            case 'equipment':
                // Initialize equipment page
                break;
            case 'details':
                // Initialize details page
                break;
            case 'settings':
                // Initialize settings page UI and controls
                settingsManager.initializeEventListeners();
                settingsManager.updateSavePathDisplay();
                break;
        }
    }
}; 