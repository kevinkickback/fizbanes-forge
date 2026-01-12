/**
 * Titlebar Controller
 * Manages the application titlebar UI and interactions
 */

import { eventBus, EVENTS } from '../lib/EventBus.js';
import { AppState } from './AppState.js';

export class TitlebarController {
    constructor() {
        this.characterNameEl = document.getElementById('titlebarCharacterName');
        this.unsavedIndicatorEl = document.getElementById('titlebarUnsavedIndicator');
        this.settingsBtn = document.getElementById('settingsButton');
        this.levelUpBtn = document.getElementById('openLevelUpModalBtn');
        this.saveBtn = document.getElementById('saveCharacter');
    }

    /**
     * Initialize the titlebar controller
     */
    init() {
        this.setupEventListeners();
        this.updateCharacterName();
        this.updateUnsavedIndicator();
        this.updateActionButtons();
        console.log('[TitlebarController] Initialized');
    }

    /**
     * Setup event listeners for titlebar interactions
     */
    setupEventListeners() {
        // Character updates
        eventBus.on(EVENTS.CHARACTER_SELECTED, () => {
            this.updateCharacterName();
            this.updateUnsavedIndicator();
            this.updateActionButtons();
        });

        eventBus.on(EVENTS.CHARACTER_UPDATED, () => {
            this.updateUnsavedIndicator();
            this.updateActionButtons();
        });

        eventBus.on(EVENTS.CHARACTER_SAVED, () => {
            this.updateUnsavedIndicator();
            this.updateActionButtons();
        });

        eventBus.on(EVENTS.PAGE_CHANGED, () => {
            this.updateActionButtons();
        });

        // Settings button
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => {
                eventBus.emit(EVENTS.NAVIGATE_TO_PAGE, { page: 'settings' });
            });
        }
    }

    /**
     * Update character name display
     */
    updateCharacterName() {
        if (!this.characterNameEl) return;

        const character = AppState.getCurrentCharacter?.()
            || AppState.get?.('currentCharacter')
            || null;
        if (character?.name) {
            this.characterNameEl.textContent = character.name;
        } else {
            this.characterNameEl.textContent = 'No Character Loaded';
        }
    }

    /**
     * Update unsaved changes indicator
     */
    updateUnsavedIndicator() {
        if (!this.unsavedIndicatorEl) return;

        const hasUnsaved = AppState.get?.('hasUnsavedChanges');
        if (hasUnsaved) {
            this.unsavedIndicatorEl.classList.add('visible');
        } else {
            this.unsavedIndicatorEl.classList.remove('visible');
        }
    }

    /**
     * Enable/disable action buttons based on current app state
     */
    updateActionButtons() {
        const character = AppState.getCurrentCharacter?.() || AppState.get?.('currentCharacter');
        const hasUnsaved = AppState.get?.('hasUnsavedChanges');

        if (this.levelUpBtn) {
            this.levelUpBtn.disabled = !character;
        }

        if (this.saveBtn) {
            this.saveBtn.disabled = !hasUnsaved;
        }
    }
}

// Create singleton instance
export const titlebarController = new TitlebarController();
