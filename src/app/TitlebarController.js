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
    }

    /**
     * Initialize the titlebar controller
     */
    init() {
        this.setupEventListeners();
        this.updateCharacterName();
        this.updateUnsavedIndicator();
        console.log('[TitlebarController] Initialized');
    }

    /**
     * Setup event listeners for titlebar interactions
     */
    setupEventListeners() {
        // Character updates
        eventBus.on(EVENTS.CHARACTER_LOADED, () => {
            this.updateCharacterName();
            this.updateUnsavedIndicator();
        });

        eventBus.on(EVENTS.CHARACTER_UPDATED, () => {
            this.updateUnsavedIndicator();
        });

        eventBus.on(EVENTS.CHARACTER_SAVED, () => {
            this.updateUnsavedIndicator();
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

        const character = AppState.character;
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

        if (AppState.hasUnsavedChanges) {
            this.unsavedIndicatorEl.classList.add('visible');
        } else {
            this.unsavedIndicatorEl.classList.remove('visible');
        }
    }
}

// Create singleton instance
export const titlebarController = new TitlebarController();
