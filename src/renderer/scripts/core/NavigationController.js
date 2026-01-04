/** Presentation controller coordinating router, page loader, and nav UI. */

import { eventBus, EVENTS } from '../utils/EventBus.js';

import { AppState } from './AppState.js';
import { PageLoader } from './PageLoader.js';
import { Router } from './Router.js';

class NavigationControllerImpl {
	constructor() {
		this.isInitialized = false;
		this.navButtons = new Map();
		this.sectionButtons = new Map();
		this.pendingSectionScroll = null;
		this.sectionObserver = null;
		this.sectionElements = [];
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

		// Listen for page load completion to handle deferred scroll targets
		eventBus.on(EVENTS.PAGE_LOADED, (page) => {
			if (page === 'build' && this.pendingSectionScroll) {
				this.scrollToSection(this.pendingSectionScroll);
				this.setActiveSection(this.pendingSectionScroll);
				this.pendingSectionScroll = null;
			}

			if (page === 'build') {
				this.setupBuildSectionObserver();
			} else {
				this.destroyBuildSectionObserver();
			}
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
		// Use event delegation for nav buttons and build sub-navigation
		const handleNavClick = async (e) => {
			const sectionButton = e.target.closest('[data-section]');
			if (sectionButton) {
				e.preventDefault();
				const sectionId = sectionButton.dataset.section;
				await this.handleSectionNavigation(sectionId);
				return;
			}

			const navButton = e.target.closest('[data-page]');
			if (navButton) {
				const page = navButton.dataset.page;
				await this.navigateTo(page);
			}
		};

		document.addEventListener('click', handleNavClick);

		// Store reference to nav buttons
		this.cacheNavigationButtons();
		this.cacheSectionButtons();

		console.debug('NavigationController', 'Navigation buttons setup');
	}

	/**
	 * Cache navigation button elements.
	 */
	cacheNavigationButtons() {
		this.navButtons.clear();
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
	 * Cache build section button elements.
	 */
	cacheSectionButtons() {
		this.sectionButtons.clear();
		const sectionButtons = document.querySelectorAll('[data-section]');
		sectionButtons.forEach((button) => {
			const section = button.dataset.section;
			this.sectionButtons.set(section, button);
		});

		console.debug('NavigationController', 'Cached build section buttons', {
			count: this.sectionButtons.size,
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
	 * Handle navigation to a build page section.
	 * @param {string} sectionId - Target section element id
	 */
	async handleSectionNavigation(sectionId) {
		if (!sectionId) {
			return;
		}

		this.pendingSectionScroll = sectionId;
		const currentPage = Router.getCurrentRoute();
		if (currentPage !== 'build') {
			try {
				await this.navigateTo('build');
			} catch (error) {
				console.warn('NavigationController', 'Section navigation failed', {
					sectionId,
					error,
				});
				this.pendingSectionScroll = null;
				return;
			}

			if (Router.getCurrentRoute() !== 'build') {
				this.pendingSectionScroll = null;
				return;
			}
		}

		this.scrollToSection(sectionId);
		this.setActiveSection(sectionId);
		this.pendingSectionScroll = null;
	}

	/**
	 * Observe build page sections and keep sublink active state in sync with scroll.
	 */
	setupBuildSectionObserver() {
		this.destroyBuildSectionObserver();

		const sections = [];
		this.sectionButtons.forEach((_, id) => {
			const el = document.getElementById(id);
			if (el) {
				sections.push(el);
			}
		});

		if (!sections.length) {
			console.debug(
				'NavigationController',
				'No build sections found to observe',
			);
			return;
		}

		this.sectionElements = sections;
		this.sectionObserver = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio);

				if (visible.length > 0) {
					this.setActiveSection(visible[0].target.id);
					return;
				}

				// Fallback: find the section closest to the top of the viewport
				const nearest = entries
					.map((entry) => ({
						id: entry.target.id,
						top: entry.boundingClientRect.top,
					}))
					.sort((a, b) => Math.abs(a.top) - Math.abs(b.top))[0];

				if (nearest?.id) {
					this.setActiveSection(nearest.id);
				}
			},
			{
				root: null,
				rootMargin: '0px 0px -40% 0px',
				threshold: [0.25, 0.4, 0.6, 0.75],
			},
		);

		this.sectionElements.forEach((section) => {
			this.sectionObserver.observe(section);
		});
	}

	/**
	 * Disconnect the build section observer.
	 */
	destroyBuildSectionObserver() {
		if (this.sectionObserver) {
			this.sectionObserver.disconnect();
			this.sectionObserver = null;
		}
		this.sectionElements = [];
	}

	/**
	 * Smoothly scroll to a build section if it exists.
	 * @param {string} sectionId - Target section element id
	 */
	scrollToSection(sectionId) {
		if (!sectionId) {
			return;
		}

		const target = document.getElementById(sectionId);
		if (target) {
			target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} else {
			console.warn('NavigationController', 'Unable to find section to scroll', {
				sectionId,
			});
		}
	}

	/**
	 * Update active state for build section links.
	 * @param {string|null} sectionId - Active section id
	 */
	setActiveSection(sectionId) {
		this.sectionButtons.forEach((button, id) => {
			const isActive = !!sectionId && id === sectionId;
			button.classList.toggle('active', isActive);
			if (isActive) {
				button.setAttribute('aria-current', 'true');
			} else {
				button.removeAttribute('aria-current');
			}
		});
	}

	/**
	 * Toggle visibility/expanded state for the build sub-navigation.
	 * @param {boolean} isOpen - Whether the build nav should be expanded
	 */
	toggleBuildSubnav(isOpen) {
		const buildNavItem = document.querySelector('[data-nav-group="build"]');
		if (buildNavItem) {
			buildNavItem.classList.toggle('is-open', isOpen);
			const trigger = buildNavItem.querySelector('[data-page="build"]');
			if (trigger) {
				trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
			}
		}
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

		this.toggleBuildSubnav(activePage === 'build');
		if (activePage !== 'build') {
			this.setActiveSection(null);
		}

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

		// Clean up section observer when leaving build
		if (page !== 'build') {
			this.destroyBuildSectionObserver();
		}

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
