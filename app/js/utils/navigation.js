/**
 * navigation.js
 * Page navigation and routing
 * 
 * @typedef {Object} NavigationState
 * @property {string} currentPage - The currently active page
 * @property {boolean} _initialized - Whether the navigation system has been initialized
 * 
 * @typedef {Object} NavigationOptions
 * @property {boolean} [forceReload=false] - Whether to force reload the page content
 * @property {boolean} [skipAnimation=false] - Whether to skip transition animations
 */

import { showNotification } from './notifications.js';
import { characterHandler } from './characterHandler.js';
import { settingsManager } from '../managers/SettingsManager.js';
import { RaceCard } from '../ui/RaceCard.js';
import { AbilityScoreCard } from '../ui/AbilityScoreCard.js';

/**
 * Navigation app with all navigation-related functionality
 * @type {NavigationState & {
 *   initialize: () => Promise<void>,
 *   loadPage: (pageName: string) => Promise<void>,
 *   _initializePageContent: (pageName: string) => Promise<void>
 * }}
 */
export const navigation = {
    currentPage: 'home',
    _initialized: false,

    /** @type {readonly string[]} Pages that require a character to be selected */
    _CHARACTER_PAGES: Object.freeze(['build', 'equipment', 'details']),

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
     * Checks if a page requires a character to be selected
     * @param {string} pageName - The name of the page to check
     * @returns {boolean} Whether the page requires a character
     * @private
     */
    _requiresCharacter(pageName) {
        return this._CHARACTER_PAGES.includes(pageName);
    },

    /**
     * Loads and displays a specific page
     * @param {string} pageName - The name of the page to load
     * @returns {Promise<void>}
     */
    loadPage(pageName) {
        // Prevent navigation to character pages if no character is selected
        if (this._requiresCharacter(pageName) && (!characterHandler.currentCharacter || !characterHandler.currentCharacter.id)) {
            showNotification('Please select or create a character first', 'warning');
            return;
        }

        // Update navigation state
        this._updateNavigationState(pageName);

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
     * Updates the navigation state and UI
     * @param {string} pageName - The name of the current page
     * @private
     */
    _updateNavigationState(pageName) {
        const navLinks = document.querySelectorAll('.nav-link');
        for (const link of navLinks) {
            const page = link.getAttribute('data-page');
            link.classList.toggle('active', page === pageName);
            if (this._requiresCharacter(page)) {
                link.classList.toggle('disabled', !characterHandler.currentCharacter);
            }
        }
    },

    /**
     * Initializes the content for a specific page
     * @param {string} pageName - The name of the page to initialize
     * @returns {Promise<void>}
     * @private
     */
    _initializePageContent(pageName) {
        const pageInitializers = {
            home: () => {
                characterHandler.loadCharacters();
                characterHandler.initializeEventListeners();
            },
            build: () => {
                if (characterHandler.currentCharacter) {
                    new RaceCard();
                    new AbilityScoreCard();
                }
            },
            equipment: () => {
                // Initialize equipment page
            },
            details: () => {
                characterHandler.populateDetailsPage();
            },
            settings: () => {
                settingsManager.updateSavePathDisplay();
            }
        };

        const initializer = pageInitializers[pageName];
        if (initializer) {
            initializer();
        }
    }
}; 