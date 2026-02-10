import { eventBus, EVENTS } from '../lib/EventBus.js';

import { BuildPageController } from './pages/BuildPageController.js';
import { DetailsPageController } from './pages/DetailsPageController.js';
import { EquipmentPageController } from './pages/EquipmentPageController.js';
import { FeatsPageController } from './pages/FeatsPageController.js';
import { HomePageController } from './pages/HomePageController.js';
import { PreviewPageController } from './pages/PreviewPageController.js';
import { SettingsPageController } from './pages/SettingsPageController.js';
import { SpellsPageController } from './pages/SpellsPageController.js';

const PAGE_CONTROLLERS = {
	home: HomePageController,
	settings: SettingsPageController,
	build: BuildPageController,
	details: DetailsPageController,
	feats: FeatsPageController,
	equipment: EquipmentPageController,
	spells: SpellsPageController,
	preview: PreviewPageController,
};

class PageHandlerImpl {
	constructor() {
		this.isInitialized = false;
		this._activeController = null;
	}

	initialize() {
		if (this.isInitialized) {
			return;
		}

		eventBus.on(EVENTS.PAGE_LOADED, (pageName) => {
			this.handlePageLoaded(pageName);
		});

		eventBus.on(EVENTS.CHARACTER_DELETED, () => {
			PreviewPageController.clearCache();
		});

		eventBus.on(EVENTS.CHARACTER_SELECTED, (character) => {
			PreviewPageController.clearCacheIfChanged(character?.id);
		});

		this.isInitialized = true;
	}

	async handlePageLoaded(pageName) {
		try {
			// Cleanup previous page controller
			if (this._activeController) {
				this._activeController.cleanup();
				this._activeController = null;
			}

			const ControllerClass = PAGE_CONTROLLERS[pageName];
			if (!ControllerClass) {
				console.debug('[PageHandler]', 'No controller for page', { pageName });
				return;
			}

			this._activeController = new ControllerClass();
			await this._activeController.initialize();
		} catch (error) {
			console.error('[PageHandler]', 'Error initializing page', {
				pageName,
				error,
			});
		}
	}

	getActiveController() {
		return this._activeController;
	}
}

// Export singleton instance
export const PageHandler = new PageHandlerImpl();
