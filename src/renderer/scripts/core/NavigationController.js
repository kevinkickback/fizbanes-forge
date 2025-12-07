/** Presentation controller coordinating router, page loader, and nav UI. */

import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { Logger } from '../infrastructure/Logger.js';
import { AppState } from './AppState.js';
import { PageLoader } from './PageLoader.js';
import { Router } from './Router.js';

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

		// Initialize navigation state (disable buttons that require character)
		this.updateNavigationState();

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

		// Listen for character creation events
		eventBus.on(EVENTS.CHARACTER_CREATED, () => {
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
		buttons.forEach((button) => {
			const page = button.dataset.page;
			this.navButtons.set(page, button);
		});

		Logger.debug('NavigationController', 'Cached navigation buttons', {
			count: this.navButtons.size,
		});
	}

	/**
	 * Navigate to a page.
	 * @param {string} page - Page to navigate to
	 */
	async navigateTo(page) {
		Logger.info(
			'NavigationController',
			`[${new Date().toISOString()}] Navigate to page: "${page}"`,
		);

		// Show loading state
		PageLoader.renderLoading();

		// Navigate using router
		const navResult = await Router.navigate(page);

		if (navResult.isErr()) {
			Logger.error(
				'NavigationController',
				'Navigation failed',
				navResult.error,
			);
			PageLoader.renderError(navResult.error);
			return;
		}

		const route = navResult.value;

		// Log floating bar state BEFORE setting attribute and rendering
		const floatingBar = document.querySelector('.floating-actions');
		const floatingBarVisibleBefore = floatingBar
			? window.getComputedStyle(floatingBar).display !== 'none'
			: false;
		Logger.debug(
			'NavigationController',
			`[BEFORE RENDER] Page: ${page}, Floating bar visible: ${floatingBarVisibleBefore}`,
		);

		// Set data-current-page attribute immediately for CSS selectors
		document.body.setAttribute('data-current-page', page);
		Logger.debug(
			'NavigationController',
			`Set data-current-page attribute to "${page}"`,
			{
				page,
				attributeValue: document.body.getAttribute('data-current-page'),
			},
		);

		// Log floating bar state AFTER setting attribute (CSS might update)
		const floatingBarAfterAttr = floatingBar
			? window.getComputedStyle(floatingBar).display !== 'none'
			: false;
		Logger.debug(
			'NavigationController',
			`[AFTER SETTING ATTR] Page: ${page}, Floating bar visible: ${floatingBarAfterAttr}`,
		);

		// Load and render the page
		await this.loadAndRenderPage(route.template, page);

		// Update navigation UI
		this.updateNavButtons(page);

		// Emit PAGE_CHANGED event
		Logger.debug(
			'NavigationController',
			`Emitting PAGE_CHANGED event for page: "${page}"`,
		);
		eventBus.emit(EVENTS.PAGE_CHANGED, page);
	}

	/**
	 * Load and render a page template.
	 * @param {string} template - Template filename
	 * @param {string} pageName - Name of the page being loaded
	 */
	async loadAndRenderPage(template, pageName) {
		Logger.debug(
			'NavigationController',
			`[${new Date().toISOString()}] Starting loadAndRenderPage: ${pageName}`,
		);

		const loadResult = await PageLoader.loadAndRender(template);

		if (loadResult.isErr()) {
			Logger.error(
				'NavigationController',
				'Failed to load page',
				loadResult.error,
			);
			PageLoader.renderError(`Failed to load page: ${loadResult.error}`);
			return;
		}

		Logger.info(
			'NavigationController',
			`[${new Date().toISOString()}] Page rendered successfully: ${pageName}`,
			{ template, pageName },
		);

		// Ensure data-current-page attribute is set (again, for safety)
		document.body.setAttribute('data-current-page', pageName);
		const finalAttribute = document.body.getAttribute('data-current-page');

		// Check floating bar visibility - AFTER page render
		const floatingBar = document.querySelector('.floating-actions');
		const isVisible = floatingBar
			? window.getComputedStyle(floatingBar).display !== 'none'
			: false;

		// Determine if floating bar SHOULD be visible for this page
		const shouldShowByCSS = ['build', 'equipment', 'details'].includes(
			pageName,
		);

		// Detailed floating bar analysis
		Logger.debug('NavigationController', `[AFTER RENDER] Page: "${pageName}"`, {
			floatingBarVisible: isVisible,
			shouldShowByCSS: shouldShowByCSS,
			dataCurrentPage: finalAttribute,
			computedDisplay: floatingBar
				? window.getComputedStyle(floatingBar).display
				: 'N/A',
			inlineDisplay: floatingBar ? floatingBar.style.display : 'N/A',
		});

		// WARNING if floating bar visibility doesn't match CSS selector
		if (pageName === 'home' && isVisible) {
			Logger.warn(
				'NavigationController',
				`⚠️ FLOATING BAR ISSUE: On home page but floating bar is VISIBLE!`,
				{
					page: pageName,
					shouldShowByCSS: shouldShowByCSS,
					actuallyVisible: isVisible,
					dataCurrentPage: finalAttribute,
				},
			);
		} else if (
			(pageName === 'build' ||
				pageName === 'equipment' ||
				pageName === 'details') &&
			!isVisible
		) {
			Logger.warn(
				'NavigationController',
				`⚠️ FLOATING BAR ISSUE: On ${pageName} page but floating bar is NOT VISIBLE!`,
				{
					page: pageName,
					shouldShowByCSS: shouldShowByCSS,
					actuallyVisible: isVisible,
					dataCurrentPage: finalAttribute,
				},
			);
		} else {
			Logger.debug(
				'NavigationController',
				`✓ Floating bar visibility correct for page: ${pageName}`,
				{
					shouldShow: shouldShowByCSS,
					isShowing: isVisible,
				},
			);
		}

		// Emit PAGE_LOADED event so page-specific handlers can initialize
		Logger.debug(
			'NavigationController',
			`Emitting PAGE_LOADED event for page: "${pageName}"`,
		);
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

			if (route?.requiresCharacter) {
				if (hasCharacter) {
					button.removeAttribute('disabled');
					button.classList.remove('disabled');
					button.title = route.title || page;
				} else {
					button.setAttribute('disabled', 'true');
					button.classList.add('disabled');
					button.title = `${route.title || page} - Load or create a character first`;
				}
			}
		});

		Logger.debug('NavigationController', 'Navigation state updated', {
			hasCharacter,
		});
	}

	/**
	 * Handle page change events.
	 * @param {string} page - Page that was navigated to
	 */
	async handlePageChange(page) {
		Logger.debug('NavigationController', 'Handling page change', { page });

		// Set data-current-page attribute on body for CSS selectors
		document.body.setAttribute('data-current-page', page);

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
