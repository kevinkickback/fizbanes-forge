/**
 * Titlebar Controller
 * Manages the application titlebar UI and interactions
 */

import { eventBus, EVENTS } from '../lib/EventBus.js';
import { AppState } from './AppState.js';

export class TitlebarController {
    constructor() {
        this.characterNameEl = document.getElementById('titlebarCharacterName');
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
            // Force re-check of character state (including classes) 
            this.updateCharacterName();
            this.updateUnsavedIndicator();
            this.updateActionButtons();
        });

        eventBus.on(EVENTS.CHARACTER_SAVED, () => {
            this.updateCharacterName();
            this.updateUnsavedIndicator();
            this.updateActionButtons();
        });

        eventBus.on(EVENTS.PAGE_CHANGED, () => {
            this.updateActionButtons();
        });

        // Listen to hasUnsavedChanges state changes directly
        // This ensures save button updates even when CHARACTER_UPDATED
        // listeners fire in different order
        eventBus.on('state:hasUnsavedChanges:changed', () => {
            this.updateUnsavedIndicator();
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
        const hasUnsaved = AppState.get?.('hasUnsavedChanges');

        // Visual indicator now lives on the Save button
        if (this.saveBtn) {
            if (hasUnsaved) {
                this.saveBtn.classList.add('unsaved');
            } else {
                this.saveBtn.classList.remove('unsaved');
            }
        }
    }

    /**
     * Enable/disable action buttons based on current app state
     */
    updateActionButtons() {
        const character = AppState.getCurrentCharacter?.() || AppState.get?.('currentCharacter');
        const hasUnsaved = AppState.get?.('hasUnsavedChanges');

        // Debug logging
        console.log('[TitlebarController] updateActionButtons called');
        console.log('[TitlebarController] Character:', {
            exists: !!character,
            name: character?.name,
            hasProgression: !!character?.progression,
            progressionClasses: character?.progression?.classes,
            classesLength: character?.progression?.classes?.length
        });

        if (this.levelUpBtn) {
            const hasClasses = character?.progression?.classes && character.progression.classes.length > 0;
            this.levelUpBtn.disabled = !character || !hasClasses;

            console.log('[TitlebarController] Level Up Button:', {
                hasClasses,
                disabled: this.levelUpBtn.disabled,
                characterExists: !!character
            });

            // Update tooltip based on state
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
