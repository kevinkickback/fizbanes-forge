import { eventBus, EVENTS } from '../lib/EventBus.js';
import { AppState } from './AppState.js';

class RouterImpl {
	constructor() {
		this.routes = new Map();
		this.currentRoute = null;
	}

	register(path, config) {
		this.routes.set(path, {
			template: config.template || `${path}.html`,
			requiresCharacter: config.requiresCharacter || false,
			title: config.title || path,
		});
	}

	async navigate(path) {
		console.debug('[Router]', 'Navigating to', { path });
		if (!this.routes.has(path)) {
			console.error('[Router]', 'Route not found', { path });
			throw new Error(`Route not found: ${path}`);
		}

		const route = this.routes.get(path);

		if (route.requiresCharacter && !AppState.getCurrentCharacter()) {
			console.debug('[Router]', 'Route requires character', { path });
			throw new Error('Character required for this page');
		}

		this.currentRoute = path;
		AppState.setCurrentPage(path);

		console.debug('[Router]', 'Navigation successful', { path });
		return route;
	}

	getCurrentRoute() {
		return this.currentRoute;
	}

	getRoute(path) {
		return this.routes.get(path) || null;
	}

	hasRoute(path) {
		return this.routes.has(path);
	}

	getAllRoutes() {
		return Array.from(this.routes.keys());
	}
}

class PageLoaderImpl {
	constructor() {
		this.templateCache = new Map();
		this.contentArea = null;
	}

	initialize(contentAreaId) {
		this.contentArea = document.getElementById(contentAreaId);

		if (!this.contentArea) {
			console.error('PageLoader', 'Content area not found', { contentAreaId });
			throw new Error('Content area not found');
		}

		console.debug('PageLoader', 'Initialized with content area', {
			contentAreaId,
		});
	}

	async loadPage(templateName) {
		console.debug('PageLoader', 'Loading page', { templateName });

		if (this.templateCache.has(templateName)) {
			console.debug('PageLoader', 'Using cached template', { templateName });
			return this.templateCache.get(templateName);
		}

		try {
			const response = await fetch(`pages/${templateName}`);

			if (!response.ok) {
				throw new Error(
					`Failed to load ${templateName}: ${response.statusText}`,
				);
			}

			const html = await response.text();

			this.templateCache.set(templateName, html);

			console.debug('PageLoader', 'Page loaded and cached', { templateName });
			return html;
		} catch (error) {
			console.error('PageLoader', 'Load failed', {
				templateName,
				error: error.message,
			});
			throw error;
		}
	}

	renderPage(html) {
		if (!this.contentArea) {
			console.error('PageLoader', 'Content area not initialized');
			throw new Error('Content area not initialized');
		}

		try {
			this.contentArea.innerHTML = html;
			console.debug('PageLoader', 'Page rendered successfully');
		} catch (error) {
			console.error('PageLoader', 'Render failed', error);
			throw error;
		}
	}

	async loadAndRender(templateName) {
		console.debug('PageLoader', 'Load and render', { templateName });

		const html = await this.loadPage(templateName);
		this.renderPage(html);
	}

	clearCache() {
		const cacheSize = this.templateCache.size;
		this.templateCache.clear();
		console.debug('PageLoader', 'Cache cleared', {
			cachedTemplates: cacheSize,
		});
	}

	getCacheSize() {
		return this.templateCache.size;
	}

	renderLoading() {
		if (!this.contentArea) return;

		this.contentArea.innerHTML = `
      <div class="loading-container">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    `;
	}

	renderError(message) {
		if (!this.contentArea) return;

		this.contentArea.innerHTML = `
      <div class="error-container">
        <i class="fas fa-exclamation-triangle"></i>
        <h2>Error</h2>
        <p>${message}</p>
        <button onclick="location.reload()">Reload</button>
      </div>
    `;
	}
}

class NavigationControllerImpl {
	constructor() {
		this.isInitialized = false;
		this.navButtons = new Map();
		this.sectionButtons = new Map();
		this.pendingSectionScroll = null;
		this.sectionObserver = null;
		this.sectionElements = [];

		this.router = new RouterImpl();
		this.pageLoader = new PageLoaderImpl();

		this.registerRoutes();

		console.debug('NavigationController', 'Controller created');
	}

	registerRoutes() {
		this.router.register('home', {
			template: 'home.html',
			requiresCharacter: false,
			title: 'Home',
		});

		this.router.register('build', {
			template: 'build.html',
			requiresCharacter: true,
			title: 'Build',
		});

		this.router.register('feats', {
			template: 'feats.html',
			requiresCharacter: true,
			title: 'Feats',
		});

		this.router.register('equipment', {
			template: 'equipment.html',
			requiresCharacter: true,
			title: 'Equipment',
		});

		this.router.register('spells', {
			template: 'spells.html',
			requiresCharacter: true,
			title: 'Spells',
		});

		this.router.register('details', {
			template: 'details.html',
			requiresCharacter: true,
			title: 'Details',
		});

		this.router.register('settings', {
			template: 'settings.html',
			requiresCharacter: false,
			title: 'Settings',
		});

		this.router.register('preview', {
			template: 'preview.html',
			requiresCharacter: true,
			title: 'Preview',
		});

		console.debug('[Router]', 'All routes registered', {
			routes: this.router.getAllRoutes(),
		});
	}

	initialize() {
		if (this.isInitialized) {
			console.warn('NavigationController', 'Already initialized');
			return;
		}

		console.debug('NavigationController', 'Initializing');

		// Initialize PageLoader
		try {
			this.pageLoader.initialize('pageContent');
		} catch (error) {
			console.error('NavigationController', 'Failed to initialize PageLoader');
			this.pageLoader.renderError(error.message);
			return;
		}

		this.setupEventListeners();
		this.setupNavigationButtons();

		this.updateNavigationState();

		this.navigateTo('home');

		this.isInitialized = true;
		console.debug('NavigationController', 'Initialized successfully');
	}

	setupEventListeners() {
		eventBus.on(EVENTS.PAGE_CHANGED, async (page) => {
			await this.handlePageChange(page);
		});

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

		eventBus.on(EVENTS.CHARACTER_SELECTED, () => {
			this.updateNavigationState();
		});

		eventBus.on(EVENTS.CHARACTER_CREATED, () => {
			this.updateNavigationState();
		});

		eventBus.on(EVENTS.CHARACTER_DELETED, () => {
			this.updateNavigationState();
		});

		console.debug('NavigationController', 'Event listeners setup');
	}

	setupNavigationButtons() {
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

		this.cacheNavigationButtons();
		this.cacheSectionButtons();

		console.debug('NavigationController', 'Navigation buttons setup');
	}

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

	async navigateTo(page) {
		console.debug(
			'NavigationController',
			`[${new Date().toISOString()}] Navigate to page: "${page}"`,
		);

		AppState.setState({ isNavigating: true });

		this.pageLoader.renderLoading();

		let route;
		try {
			route = await this.router.navigate(page);
		} catch (error) {
			console.error('NavigationController', 'Navigation failed', error.message);
			this.pageLoader.renderError(error.message);
			AppState.setState({ isNavigating: false });
			return;
		}

		document.body.setAttribute('data-current-page', page);
		console.debug(
			'NavigationController',
			`Set data-current-page attribute to "${page}"`,
			{
				page,
				attributeValue: document.body.getAttribute('data-current-page'),
			},
		);

		await this.loadAndRenderPage(route.template, page);

		this.updateNavButtons(page);

		AppState.setState({ isNavigating: false });
	}

	async loadAndRenderPage(template, pageName) {
		console.debug(
			'NavigationController',
			`[${new Date().toISOString()}] Starting loadAndRenderPage: ${pageName}`,
		);

		try {
			await this.pageLoader.loadAndRender(template);
		} catch (error) {
			console.error(
				'NavigationController',
				'Failed to load page',
				error.message,
			);
			this.pageLoader.renderError(`Failed to load page: ${error.message}`);
			AppState.setState({ isNavigating: false });
			return;
		}

		console.debug(
			'NavigationController',
			`[${new Date().toISOString()}] Page rendered successfully: ${pageName}`,
			{ template, pageName },
		);

		console.debug('NavigationController', `Page render complete: ${pageName}`);

		document.body.setAttribute('data-current-page', pageName);

		eventBus.emit(EVENTS.PAGE_LOADED, pageName);

		AppState.setState({ isNavigating: false });
	}

	async handleSectionNavigation(sectionId) {
		if (!sectionId) {
			return;
		}

		this.pendingSectionScroll = sectionId;
		const currentPage = this.router.getCurrentRoute();
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

			if (this.router.getCurrentRoute() !== 'build') {
				this.pendingSectionScroll = null;
				return;
			}
		}

		this.scrollToSection(sectionId);
		this.setActiveSection(sectionId);
		this.pendingSectionScroll = null;
	}

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

	destroyBuildSectionObserver() {
		if (this.sectionObserver) {
			this.sectionObserver.disconnect();
			this.sectionObserver = null;
		}
		this.sectionElements = [];
	}

	scrollToSection(sectionId) {
		if (!sectionId) {
			return;
		}

		const target = document.getElementById(sectionId);
		if (target) {
			const scrollContainer = document.querySelector('.main-content');
			if (!scrollContainer) {
				console.warn('[NavigationController] Could not find scroll container');
				return;
			}

			const sectionRect = target.getBoundingClientRect();
			const containerRect = scrollContainer.getBoundingClientRect();
			const sectionTop =
				sectionRect.top - containerRect.top + scrollContainer.scrollTop;
			const scrollTo = sectionTop - 16;

			scrollContainer.scrollTo({
				top: Math.max(0, scrollTo),
				behavior: 'smooth',
			});
		} else {
			console.warn('NavigationController', 'Unable to find section to scroll', {
				sectionId,
			});
		}
	}

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
	 * Set a badge count on a navigation button.
	 * @param {string} page - Page name (e.g., 'build', 'spells')
	 * @param {number} count - Badge count (0 to hide badge)
	 */
	setBadge(page, count) {
		const button = this.navButtons.get(page);
		if (!button) {
			console.warn('NavigationController', 'Button not found for badge', {
				page,
			});
			return;
		}

		let badge = button.querySelector('.nav-badge');

		if (count > 0) {
			if (!badge) {
				badge = document.createElement('span');
				badge.className = 'nav-badge badge rounded-pill';
				badge.style.cssText =
					'background-color: var(--accent-color); margin-left: 5px; font-size: 0.7em;';
				button.appendChild(badge);
			}
			badge.textContent = count.toString();
			badge.style.display = '';
		} else {
			if (badge) {
				badge.style.display = 'none';
			}
		}

		console.debug('NavigationController', 'Badge updated', { page, count });
	}

	updateNavigationState() {
		const hasCharacter = AppState.getCurrentCharacter() !== null;

		this.navButtons.forEach((button, page) => {
			const route = this.router.getRoute(page);

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

	async handlePageChange(page) {
		console.debug('NavigationController', 'Handling page change', { page });

		document.body.setAttribute('data-current-page', page);

		if (page !== 'build') {
			this.destroyBuildSectionObserver();
		}
	}

	navigateHome() {
		this.navigateTo('home');
	}

	getCurrentPage() {
		return this.router.getCurrentRoute();
	}
}

// Create singleton instance
export const NavigationController = new NavigationControllerImpl();
