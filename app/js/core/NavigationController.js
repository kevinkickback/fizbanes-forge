/**
 * Navigation coordination controller.
 * 
 * ARCHITECTURE: Presentation Layer - Coordinates navigation
 * 
 * PURPOSE:
 * - Coordinate between Router and PageLoader
 * - Handle navigation button clicks
 * - Update UI state during navigation
 * - Listen for navigation events
 * 
 * @module presentation/NavigationController
 */

import { Logger } from '../infrastructure/Logger.js';
import { Router } from './Router.js';
import { PageLoader } from './PageLoader.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { AppState } from './AppState.js';

class NavigationControllerImpl {
    constructor() {
        this.isInitialized = false;
        this.navButtons = new Map();
        Logger.info('NavigationController', 'Controller created');
    }

    /**
     * Initialize the navigation controller.
     * @returns {Result} Result with success or error
     */
    initialize() {
        if (this.isInitialized) {
            Logger.warn('NavigationController', 'Already initialized');
            return;
        }

        Logger.info('NavigationController', 'Initializing');

        // Initialize PageLoader
        const initResult = PageLoader.initialize('pageContent');
        if (initResult.isErr()) {
            Logger.error('NavigationController', 'Failed to initialize PageLoader');
            return;
        }

        // Setup event listeners
        this.setupEventListeners();
        this.setupNavigationButtons();

        // Load initial page (home)
        this.navigateTo('home');

        this.isInitialized = true;
        Logger.info('NavigationController', 'Initialized successfully');
    }

    /**
     * Setup event listeners for navigation events.
     */
    setupEventListeners() {
        // Listen for page change events
        eventBus.on(EVENTS.PAGE_CHANGED, async (page) => {
            await this.handlePageChange(page);
        });

        // Listen for character selection events
        eventBus.on(EVENTS.CHARACTER_SELECTED, () => {
            this.updateNavigationState();
        });

        // Listen for character deletion events
        eventBus.on(EVENTS.CHARACTER_DELETED, () => {
            this.updateNavigationState();
        });

        Logger.debug('NavigationController', 'Event listeners setup');
    }

    /**
     * Setup navigation button click handlers.
     */
    setupNavigationButtons() {
        // Use event delegation for nav buttons
        document.addEventListener('click', (e) => {
            const navButton = e.target.closest('[data-page]');
            if (navButton) {
                const page = navButton.dataset.page;
                this.navigateTo(page);
            }
        });

        // Store reference to nav buttons
        this.cacheNavigationButtons();

        Logger.debug('NavigationController', 'Navigation buttons setup');
    }

    /**
     * Cache navigation button elements.
     */
    cacheNavigationButtons() {
        const buttons = document.querySelectorAll('[data-page]');
        buttons.forEach(button => {
            const page = button.dataset.page;
            this.navButtons.set(page, button);
        });

        Logger.debug('NavigationController', 'Cached navigation buttons', {
            count: this.navButtons.size
        });
    }

    /**
     * Navigate to a page.
     * @param {string} page - Page to navigate to
     */
    async navigateTo(page) {
        Logger.info('NavigationController', 'Navigate to', { page });

        // Show loading state
        PageLoader.renderLoading();

        // Navigate using router
        const navResult = await Router.navigate(page);

        if (navResult.isErr()) {
            Logger.error('NavigationController', 'Navigation failed', navResult.error);
            PageLoader.renderError(navResult.error);
            return;
        }

        const route = navResult.value;

        // Load and render the page
        await this.loadAndRenderPage(route.template, page);

        // Update navigation UI
        this.updateNavButtons(page);
    }

    /**
     * Load and render a page template.
     * @param {string} template - Template filename
     * @param {string} pageName - Name of the page being loaded
     */
    async loadAndRenderPage(template, pageName) {
        Logger.debug('NavigationController', 'Loading page', { template, pageName });

        const loadResult = await PageLoader.loadAndRender(template);

        if (loadResult.isErr()) {
            Logger.error('NavigationController', 'Failed to load page', loadResult.error);
            PageLoader.renderError(`Failed to load page: ${loadResult.error}`);
            return;
        }

        Logger.info('NavigationController', 'Page loaded successfully', { template, pageName });

        // Emit PAGE_LOADED event so page-specific handlers can initialize
        eventBus.emit(EVENTS.PAGE_LOADED, pageName);
    }

    /**
     * Update active state of navigation buttons.
     * @param {string} activePage - Currently active page
     */
    updateNavButtons(activePage) {
        this.navButtons.forEach((button, page) => {
            if (page === activePage) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        Logger.debug('NavigationController', 'Nav buttons updated', { activePage });
    }

    /**
     * Update navigation state based on character availability.
     */
    updateNavigationState() {
        const hasCharacter = AppState.getCurrentCharacter() !== null;

        this.navButtons.forEach((button, page) => {
            const route = Router.getRoute(page);

            if (route && route.requiresCharacter) {
                if (hasCharacter) {
                    button.removeAttribute('disabled');
                    button.classList.remove('disabled');
                } else {
                    button.setAttribute('disabled', 'true');
                    button.classList.add('disabled');
                }
            }
        });

        Logger.debug('NavigationController', 'Navigation state updated', { hasCharacter });
    }

    /**
     * Handle page change events.
     * @param {string} page - Page that was navigated to
     */
    async handlePageChange(page) {
        Logger.debug('NavigationController', 'Handling page change', { page });

        // Additional logic for page changes can go here
        // For example: analytics, scroll to top, etc.
    }

    /**
     * Navigate to home page.
     */
    navigateHome() {
        this.navigateTo('home');
    }

    /**
     * Get current page from router.
     * @returns {string|null} Current page
     */
    getCurrentPage() {
        return Router.getCurrentRoute();
    }
}

// Create singleton instance
export const NavigationController = new NavigationControllerImpl();
