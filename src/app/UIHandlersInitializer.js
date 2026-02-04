import { DOMCleanup } from '../lib/DOMCleanup.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { showNotification } from '../lib/Notifications.js';
import { AppState } from './AppState.js';
import { CharacterManager } from './CharacterManager.js';

export function setupUiEventHandlers() {
	const cleanup = DOMCleanup.create();
	const listeners = new Map();

	const saveButton = document.getElementById('saveCharacter');
	if (saveButton) {
		cleanup.on(saveButton, 'click', async () => {
			try {
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

				showNotification('Character saved successfully', 'success');
			} catch (error) {
				console.error('[UIHandlers]', 'Error saving character', error);
				showNotification('Error saving character', 'error');
			}
		});
	} else {
		console.warn('[UIHandlers]', 'Save button not found');
	}

	const levelUpBtn = document.getElementById('openLevelUpModalBtn');
	if (levelUpBtn) {
		let levelUpModalInstance = null;
		cleanup.on(levelUpBtn, 'click', async () => {
			try {
				const character = AppState.getCurrentCharacter();
				if (!character) {
					console.warn('[UIHandlers]', '[LevelUp] No current character');
					showNotification('No character selected', 'warning');
					return;
				}

				if (!levelUpModalInstance) {
					const { LevelUpModal } = await import(
						'../ui/components/level-up/LevelUpModal.js'
					);
					levelUpModalInstance = new LevelUpModal();
				}
				await levelUpModalInstance.show();
			} catch (error) {
				console.error('[UIHandlers]', 'Failed to open Level Up modal', error);
				try {
					const el = document.getElementById('levelUpModal');
					const bs = window.bootstrap || globalThis.bootstrap;
					if (el && bs) {
						console.warn(
							'UIHandlers',
							'[LevelUp] Falling back to direct Bootstrap.Modal.show()',
						);
						new bs.Modal(el, { backdrop: true, keyboard: true }).show();
						showNotification('Level Up modal opened with fallback', 'warning');
					} else {
						showNotification('Failed to open Level Up modal', 'error');
					}
				} catch (fallbackErr) {
					console.error(
						'UIHandlers',
						'[LevelUp] Fallback open failed',
						fallbackErr,
					);
					showNotification('Failed to open Level Up modal', 'error');
				}
			}
		});
	} else {
		console.warn('[UIHandlers]', 'Level Up button not found');
	}

	const addListener = (event, handler) => {
		eventBus.on(event, handler);
		listeners.set(event, handler);
	};

	const onCharacterUpdated = () => {
		if (AppState.get('isLoadingCharacter') || AppState.get('isNavigating')) {
			return;
		}
		AppState.setHasUnsavedChanges(true);
	};
	addListener(EVENTS.CHARACTER_UPDATED, onCharacterUpdated);

	const onCharacterSaved = () => {
		AppState.setHasUnsavedChanges(false);
	};
	addListener(EVENTS.CHARACTER_SAVED, onCharacterSaved);

	const onCharacterSelected = () => {
		AppState.setHasUnsavedChanges(false);
	};
	addListener(EVENTS.CHARACTER_SELECTED, onCharacterSelected);

	return () => {
		for (const [event, handler] of listeners) {
			eventBus.off(event, handler);
		}
		listeners.clear();
		cleanup.cleanup();
	};
}
