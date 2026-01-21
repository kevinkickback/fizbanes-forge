// Extracted UI handlers from AppInitializer.js
// Sets up save button, level-up button, and unsaved indicator listeners with proper cleanup.

import { DOMCleanup } from '../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { showNotification } from '../lib/Notifications.js';
import { AppState } from './AppState.js';
import { CharacterManager } from './CharacterManager.js';

/**
 * Setup UI event handlers and return a cleanup function.
 * Keeps listeners isolated from AppInitializer to reduce file size and complexity.
 * @returns {() => void} cleanup function to remove all listeners
 */
export function setupUiEventHandlers() {
    const cleanup = DOMCleanup.create();
    const listeners = new Map();

    // ----------------------------- Save Button -----------------------------
    const saveButton = document.getElementById('saveCharacter');
    if (saveButton) {
        cleanup.on(saveButton, 'click', async () => {
            try {
                console.info(
                    'UIHandlers',
                    `[${new Date().toISOString()}] Save button clicked`,
                );

                // Update character data from form inputs on details page
                const characterNameInput = document.getElementById('characterName');
                const playerNameInput = document.getElementById('playerName');
                const heightInput = document.getElementById('height');
                const weightInput = document.getElementById('weight');
                const genderInput = document.getElementById('gender');
                const alignmentSelect = document.getElementById('alignment');
                const deityInput = document.getElementById('deity');
                const backstoryTextarea = document.getElementById('backstory');

                const character = AppState.getCurrentCharacter();
                if (character) {
                    const updates = {};
                    if (characterNameInput) updates.name = characterNameInput.value;
                    if (playerNameInput) updates.playerName = playerNameInput.value;
                    if (heightInput) updates.height = heightInput.value;
                    if (weightInput) updates.weight = weightInput.value;
                    if (genderInput) updates.gender = genderInput.value;
                    if (alignmentSelect) updates.alignment = alignmentSelect.value;
                    if (deityInput) updates.deity = deityInput.value;
                    if (backstoryTextarea) updates.backstory = backstoryTextarea.value;

                    if (Object.keys(updates).length > 0) {
                        CharacterManager.updateCharacter(updates);
                    }
                }

                await CharacterManager.saveCharacter();

                console.info('UIHandlers', 'Character saved successfully');
                showNotification('Character saved successfully', 'success');
            } catch (error) {
                console.error('UIHandlers', 'Error saving character', error);
                showNotification('Error saving character', 'error');
            }
        });
    } else {
        console.warn('UIHandlers', 'Save button not found');
    }

    // --------------------------- Level Up Button ---------------------------
    const levelUpBtn = document.getElementById('openLevelUpModalBtn');
    if (levelUpBtn) {
        let levelUpModalInstance = null;
        cleanup.on(levelUpBtn, 'click', async () => {
            console.info('UIHandlers', '[LevelUp] Button clicked');
            try {
                const character = AppState.getCurrentCharacter();
                if (!character) {
                    console.warn('UIHandlers', '[LevelUp] No current character');
                    showNotification('No character selected', 'warning');
                    return;
                }

                if (!levelUpModalInstance) {
                    console.debug('UIHandlers', '[LevelUp] Importing LevelUpModal');
                    const { LevelUpModal } = await import('../ui/components/level-up/LevelUpModal.js');
                    levelUpModalInstance = new LevelUpModal();
                }
                console.debug('UIHandlers', '[LevelUp] Showing modal via controller');
                await levelUpModalInstance.show();
            } catch (error) {
                console.error('UIHandlers', 'Failed to open Level Up modal', error);
                // Fallback: attempt to open the modal directly if Bootstrap is available and element exists
                try {
                    const el = document.getElementById('levelUpModal');
                    const bs = window.bootstrap || globalThis.bootstrap;
                    if (el && bs) {
                        console.warn('UIHandlers', '[LevelUp] Falling back to direct Bootstrap.Modal.show()');
                        new bs.Modal(el, { backdrop: true, keyboard: true }).show();
                        showNotification('Level Up modal opened with fallback', 'warning');
                    } else {
                        showNotification('Failed to open Level Up modal', 'error');
                    }
                } catch (fallbackErr) {
                    console.error('UIHandlers', '[LevelUp] Fallback open failed', fallbackErr);
                    showNotification('Failed to open Level Up modal', 'error');
                }
            }
        });
    } else {
        console.warn('UIHandlers', 'Level Up button not found');
    }

    // ------------------------- Unsaved Indicator ---------------------------
    const PagesShowUnsaved = new Set(['build', 'details']);

    function updateUnsavedIndicator() {
        try {
            const hasUnsaved = AppState.get('hasUnsavedChanges');
            const currentPage = AppState.getCurrentPage();
            const shouldShow = Boolean(hasUnsaved && PagesShowUnsaved.has(currentPage));
            console.debug('UIHandlers', `Unsaved indicator updated: show=${shouldShow}`, {
                hasUnsaved,
                currentPage,
            });
        } catch (e) {
            console.error('UIHandlers', 'Error updating unsaved indicator', e);
        }
    }

    const addListener = (event, handler) => {
        eventBus.on(event, handler);
        listeners.set(event, handler);
    };

    const onCharacterUpdated = () => {
        if (AppState.get('isLoadingCharacter') || AppState.get('isNavigating')) {
            console.debug('UIHandlers', 'Ignored CHARACTER_UPDATED - loading or navigating', {
                isLoadingCharacter: AppState.get('isLoadingCharacter'),
                isNavigating: AppState.get('isNavigating'),
            });
            return;
        }
        console.debug('UIHandlers', `[${new Date().toISOString()}] EVENT: CHARACTER_UPDATED`);
        AppState.setHasUnsavedChanges(true);
        updateUnsavedIndicator();
    };
    addListener(EVENTS.CHARACTER_UPDATED, onCharacterUpdated);

    const onCharacterSaved = () => {
        console.debug('UIHandlers', `[${new Date().toISOString()}] EVENT: CHARACTER_SAVED`);
        AppState.setHasUnsavedChanges(false);
        updateUnsavedIndicator();
    };
    addListener(EVENTS.CHARACTER_SAVED, onCharacterSaved);

    const onCharacterSelected = () => {
        console.debug('UIHandlers', `[${new Date().toISOString()}] EVENT: CHARACTER_SELECTED`);
        AppState.setHasUnsavedChanges(false);
        updateUnsavedIndicator();
    };
    addListener(EVENTS.CHARACTER_SELECTED, onCharacterSelected);

    const onPageChanged = () => {
        console.debug('UIHandlers', `[${new Date().toISOString()}] EVENT: PAGE_CHANGED`);
        updateUnsavedIndicator();
    };
    addListener(EVENTS.PAGE_CHANGED, onPageChanged);

    const onHasUnsavedChangesChanged = () => {
        console.debug('UIHandlers', 'state:hasUnsavedChanges:changed');
        updateUnsavedIndicator();
    };
    addListener('state:hasUnsavedChanges:changed', onHasUnsavedChangesChanged);

    // Return cleanup function
    return () => {
        for (const [event, handler] of listeners) {
            eventBus.off(event, handler);
        }
        listeners.clear();
        cleanup.cleanup();
        console.info('UIHandlers', 'Cleaned up UI event handlers');
    };
}
