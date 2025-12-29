/** Presentation controller coordinating router, page loader, and nav UI. */

import { eventBus, EVENTS } from '../utils/EventBus.js';

import { AppState } from './AppState.js';
import { PageLoader } from './PageLoader.js';
import { Router } from './Router.js';

class NavigationControllerImpl {
	constructor() {
		this.isInitialized = false;
		this.navButtons = new Map();
		console.info('NavigationController', 'Controller created');
	}

	/**
	 * Initialize the navigation controller.
	 * @returns {void}
	 */
	initialize() {
		if (this.isInitialized) {
			console.warn('NavigationController', 'Already initialized');
			return;
		}

		console.info('NavigationController', 'Initializing');

		// Initialize PageLoader
		try {
			PageLoader.initialize('pageContent');
		} catch (error) {
			console.error('NavigationController', 'Failed to initialize PageLoader');
			PageLoader.renderError(error.message);
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
		console.info('NavigationController', 'Initialized successfully');
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

		console.debug('NavigationController', 'Event listeners setup');
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

		console.debug('NavigationController', 'Navigation buttons setup');
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

		console.debug('NavigationController', 'Cached navigation buttons', {
			count: this.navButtons.size,
		});
	}

	/**
	 * Navigate to a page.
	 * @param {string} page - Page to navigate to
	 */
	async navigateTo(page) {
		console.info(
			'NavigationController',
			`[${new Date().toISOString()}] Navigate to page: "${page}"`,
		);

		// Show loading state
		PageLoader.renderLoading();

		let route;
		try {
			route = await Router.navigate(page);
		} catch (error) {
			console.error('NavigationController', 'Navigation failed', error.message);
			PageLoader.renderError(error.message);
			return;
		}

		// Log floating bar state BEFORE setting attribute and rendering
		const floatingBar = document.querySelector('.floating-actions');
		const floatingBarVisibleBefore = floatingBar
			? window.getComputedStyle(floatingBar).display !== 'none'
			: false;
		console.debug(
			'NavigationController',
			`[BEFORE RENDER] Page: ${page}, Floating bar visible: ${floatingBarVisibleBefore}`,
		);

		// Set data-current-page attribute immediately for CSS selectors
		document.body.setAttribute('data-current-page', page);
		console.debug(
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
		console.debug(
			'NavigationController',
			`[AFTER SETTING ATTR] Page: ${page}, Floating bar visible: ${floatingBarAfterAttr}`,
		);

		// Load and render the page
		await this.loadAndRenderPage(route.template, page);

		// Update navigation UI
		this.updateNavButtons(page);

		// Emit PAGE_CHANGED event
		console.debug(
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
		console.debug(
			'NavigationController',
			`[${new Date().toISOString()}] Starting loadAndRenderPage: ${pageName}`,
		);

		try {
			await PageLoader.loadAndRender(template);
		} catch (error) {
			console.error(
				'NavigationController',
				'Failed to load page',
				error.message,
			);
			PageLoader.renderError(`Failed to load page: ${error.message}`);
			return;
		}

		console.info(
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
		const shouldShowByCss = ['build', 'equipment', 'details'].includes(
			pageName,
		);

		// Detailed floating bar analysis
		console.debug(
			'NavigationController',
			`[AFTER RENDER] Page: "${pageName}"`,
			{
				floatingBarVisible: isVisible,
				shouldShowByCSS: shouldShowByCss,
				dataCurrentPage: finalAttribute,
				computedDisplay: floatingBar
					? window.getComputedStyle(floatingBar).display
					: 'N/A',
				inlineDisplay: floatingBar ? floatingBar.style.display : 'N/A',
			},
		);

		// WARNING if floating bar visibility doesn't match CSS selector
		if (pageName === 'home' && isVisible) {
			console.warn(
				'NavigationController',
				`⚠️ FLOATING BAR ISSUE: On home page but floating bar is VISIBLE!`,
				{
					page: pageName,
					shouldShowByCSS: shouldShowByCss,
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
			console.warn(
				'NavigationController',
				`⚠️ FLOATING BAR ISSUE: On ${pageName} page but floating bar is NOT VISIBLE!`,
				{
					page: pageName,
					shouldShowByCSS: shouldShowByCss,
					actuallyVisible: isVisible,
					dataCurrentPage: finalAttribute,
				},
			);
		} else {
			console.debug(
				'NavigationController',
				`✓ Floating bar visibility correct for page: ${pageName}`,
				{
					shouldShow: shouldShowByCss,
					isShowing: isVisible,
				},
			);
		}

		// Emit PAGE_LOADED event so page-specific handlers can initialize
		console.debug(
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

		console.debug('NavigationController', 'Nav buttons updated', {
			activePage,
		});
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

		console.debug('NavigationController', 'Navigation state updated', {
			hasCharacter,
		});
	}

	/**
	 * Handle page change events.
	 * @param {string} page - Page that was navigated to
	 */
	async handlePageChange(page) {
		console.debug('NavigationController', 'Handling page change', { page });

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
