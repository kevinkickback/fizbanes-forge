import { DOMCleanup } from '../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { AppState } from './AppState.js';

export class TitlebarController {
	constructor() {
		this.characterNameEl = document.getElementById('titlebarCharacterName');
		this.settingsBtn = document.getElementById('settingsButton');
		this.levelUpBtn = document.getElementById('openLevelUpModalBtn');
		this.saveBtn = document.getElementById('saveCharacter');
		this._cleanup = DOMCleanup.create();
	}

	init() {
		this.setupEventListeners();
		this.updateCharacterName();
		this.updateUnsavedIndicator();
		this.updateActionButtons();
		console.debug('[TitlebarController] Initialized');
	}

	setupEventListeners() {
		this._cleanup.onEvent(EVENTS.CHARACTER_SELECTED, () => {
			this.updateCharacterName();
			this.updateUnsavedIndicator();
			this.updateActionButtons();
		});

		this._cleanup.onEvent(EVENTS.CHARACTER_UPDATED, () => {
			this.updateCharacterName();
			this.updateUnsavedIndicator();
			this.updateActionButtons();
		});

		this._cleanup.onEvent(EVENTS.CHARACTER_SAVED, () => {
			this.updateCharacterName();
			this.updateUnsavedIndicator();
			this.updateActionButtons();
		});

		this._cleanup.onEvent(EVENTS.PAGE_CHANGED, () => {
			this.updateActionButtons();
		});

		this._cleanup.onEvent('state:hasUnsavedChanges:changed', () => {
			this.updateUnsavedIndicator();
			this.updateActionButtons();
		});

		if (this.settingsBtn) {
			this._cleanup.on(this.settingsBtn, 'click', () => {
				eventBus.emit(EVENTS.NAVIGATE_TO_PAGE, { page: 'settings' });
			});
		}
	}

	destroy() {
		if (this._cleanup) {
			this._cleanup.cleanup();
		}
	}

	updateCharacterName() {
		if (!this.characterNameEl) return;

		const character =
			AppState.getCurrentCharacter?.() ||
			AppState.get?.('currentCharacter') ||
			null;
		if (character?.name) {
			this.characterNameEl.textContent = character.name;
		} else {
			this.characterNameEl.textContent = 'No Character Loaded';
		}
	}

	updateUnsavedIndicator() {
		const hasUnsaved = AppState.get?.('hasUnsavedChanges');

		if (this.saveBtn) {
			if (hasUnsaved) {
				this.saveBtn.classList.add('unsaved');
			} else {
				this.saveBtn.classList.remove('unsaved');
			}
		}
	}

	updateActionButtons() {
		const character =
			AppState.getCurrentCharacter?.() || AppState.get?.('currentCharacter');
		const hasUnsaved = AppState.get?.('hasUnsavedChanges');

		console.debug('[TitlebarController] updateActionButtons', {
			hasCharacter: !!character,
			name: character?.name,
			hasProgression: !!character?.progression,
			classCount: character?.progression?.classes?.length || 0,
			hasUnsaved,
		});

		if (this.levelUpBtn) {
			const hasClasses =
				character?.progression?.classes &&
				character.progression.classes.length > 0;
			this.levelUpBtn.disabled = !character || !hasClasses;

			if (!character) {
				this.levelUpBtn.title = 'No character loaded';
			} else if (!hasClasses) {
				this.levelUpBtn.title = 'Add a class before leveling up';
			} else {
				this.levelUpBtn.title = 'Level Up';
			}
		}

		if (this.saveBtn) {
			this.saveBtn.disabled = !hasUnsaved;
		}
	}
}

// Create singleton instance
export const titlebarController = new TitlebarController();
