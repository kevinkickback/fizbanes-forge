/** Client-side router that validates access and emits navigation events. */

import { eventBus, EVENTS } from '../utils/EventBus.js';

import { AppState } from './AppState.js';

class RouterImpl {
	constructor() {
		this.routes = new Map();
		this.currentRoute = null;
		console.info('[Router]', 'Router initialized');
	}

	/**
	 * Register a route.
	 * @param {string} path - Route path
	 * @param {object} config - Route configuration
	 */
	register(path, config) {
		console.info('[Router]', 'Registering route', { path, config });
		this.routes.set(path, {
			template: config.template || `${path}.html`,
			requiresCharacter: config.requiresCharacter || false,
			title: config.title || path,
		});
	}

	/**
	 * Navigate to a route.
	 * @param {string} path - Route path to navigate to
	 * @returns {object} Route config
	 */
	async navigate(path) {
		console.info('[Router]', 'Navigating to', { path });

		if (!this.routes.has(path)) {
			console.error('[Router]', 'Route not found', { path });
			throw new Error(`Route not found: ${path}`);
		}

		const route = this.routes.get(path);

		// Check if character required
		if (route.requiresCharacter && !AppState.getCurrentCharacter()) {
			console.info('[Router]', 'Route requires character', { path });
			throw new Error('Character required for this page');
		}

		// Update state
		this.currentRoute = path;
		AppState.setCurrentPage(path);

		// Emit event
		eventBus.emit(EVENTS.PAGE_CHANGED, path);

		console.info('[Router]', 'Navigation successful', { path });
		return route;
	}

	/**
	 * Get current route path.
	 * @returns {string|null} Current route path
	 */
	getCurrentRoute() {
		return this.currentRoute;
	}

	/**
	 * Get route configuration.
	 * @param {string} path - Route path
	 * @returns {object|null} Route config or null
	 */
	getRoute(path) {
		return this.routes.get(path) || null;
	}

	/**
	 * Check if route exists.
	 * @param {string} path - Route path
	 * @returns {boolean} True if route exists
	 */
	hasRoute(path) {
		return this.routes.has(path);
	}

	/**
	 * Get all registered routes.
	 * @returns {Array} Array of route paths
	 */
	getAllRoutes() {
		return Array.from(this.routes.keys());
	}
}

// Create singleton instance
export const Router = new RouterImpl();

// Register all application routes
Router.register('home', {
	template: 'home.html',
	requiresCharacter: false,
	title: 'Home',
});

Router.register('build', {
	template: 'build.html',
	requiresCharacter: true,
	title: 'Build',
});

Router.register('equipment', {
	template: 'equipment.html',
	requiresCharacter: true,
	title: 'Equipment',
});

Router.register('spells', {
	template: 'spells.html',
	requiresCharacter: true,
	title: 'Spells',
});


Router.register('details', {
	template: 'details.html',
	requiresCharacter: true,
	title: 'Details',
});

Router.register('settings', {
	template: 'settings.html',
	requiresCharacter: false,
	title: 'Settings',
});

Router.register('preview', {
	template: 'preview.html',
	requiresCharacter: true,
	title: 'Preview',
});

if (typeof window !== 'undefined' && window.FF_DEBUG === true) {
	Router.register('tooltipTest', {
		template: 'tooltipTest.html',
		requiresCharacter: false,
		title: 'Tooltip Test',
	});
}

console.info('[Router]', 'All routes registered', {
	routes: Router.getAllRoutes(),
});
