/**
 * navigation.js
 * Handles page navigation and routing in the D&D Character Creator
 * 
 * @typedef {Object} NavigationState
 * @property {string} currentPage - The currently active page
 * @property {boolean} _initialized - Whether the navigation system has been initialized
 * 
 * @typedef {Object} PageConfig
 * @property {string} name - The name of the page
 * @property {boolean} [requiresCharacter=true] - Whether a character must be selected
 * @property {Function} [onLoad] - Callback function when page is loaded
 * 
 * @typedef {Object} NavigationOptions
 * @property {boolean} [forceReload=false] - Whether to force reload the page content
 * @property {boolean} [skipAnimation=false] - Whether to skip transition animations
 */

import { showNotification } from './notifications.js';
import { characterHandler } from './characterHandler.js';
import { settingsManager } from '../managers/SettingsManager.js';

/**
 * Navigation app with all navigation-related functionality
 * @type {NavigationState & {
 *   initialize: () => Promise<void>,
 *   loadPage: (pageName: string, options?: NavigationOptions) => Promise<void>,
 *   _initializePageContent: (pageName: string) => Promise<void>
 * }}
 */
export const navigation = {
    currentPage: 'home',
    _initialized: false,

    /**
     * Initialize the navigation system
     * @returns {Promise<void>}
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
     * Loads and displays a specific page
     * @param {string} pageName - The name of the page to load
     * @param {NavigationOptions} [options] - Navigation options
     * @returns {Promise<void>}
     */
    loadPage(pageName, options = {}) {
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
     * Initializes the content for a specific page
     * @param {string} pageName - The name of the page to initialize
     * @returns {Promise<void>}
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
                characterHandler.populateDetailsPage();
                break;
            case 'settings':
                // Initialize settings page UI and controls
                settingsManager.initializeEventListeners();
                settingsManager.updateSavePathDisplay();
                break;
        }
    }
}; 