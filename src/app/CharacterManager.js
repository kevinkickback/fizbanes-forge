/** Orchestrates character CRUD operations and state management. */

import { eventBus, EVENTS } from '../lib/EventBus.js';
import { showNotification } from '../lib/Notifications.js';

import { CharacterSchema } from '../shared/CharacterSchema.js';
import { AppState } from './AppState.js';
import { Character, serializeCharacter } from './Character.js';

class CharacterManagerImpl {
	async createCharacter(name) {
		console.info('CharacterManager', 'Creating character', { name });

		const failedServices = AppState.getFailedServices();
		if (Array.isArray(failedServices) && failedServices.length > 0) {
			const message = `Cannot create characters until data loads (${failedServices.join(', ')}).`;
			showNotification(message, 'error');
			throw new Error(message);
		}

		try {
			// Create character from schema
			const characterData = CharacterSchema.create();

			// Generate UUID
			const uuidResult = await window.characterStorage.generateUUID();
			if (!uuidResult.success) {
				throw new Error('Failed to generate character ID');
			}

			characterData.id = uuidResult.data;
			characterData.name = name;

			// Validate
			const validation = CharacterSchema.validate(characterData);
			if (!validation.valid) {
				console.warn(
					'CharacterManager',
					'Validation failed',
					validation.errors,
				);
				throw new Error(`Invalid character: ${validation.errors.join(', ')}`);
			}

			// Convert to Character instance to enable domain methods
			const character = new Character(characterData);

			// Update state
			AppState.setCurrentCharacter(character);
			AppState.setHasUnsavedChanges(true);

			// Emit event
			eventBus.emit(EVENTS.CHARACTER_CREATED, character);

			console.info('CharacterManager', 'Character created', {
				id: character.id,
			});
			return character;
		} catch (error) {
			console.error('CharacterManager', 'Create failed', error);
			throw error;
		}
	}

	async loadCharacter(id) {
		console.debug(
			'CharacterManager',
			`[${new Date().toISOString()}] Loading character with ID: ${id}`,
		);

		try {
			// Set loading flag to prevent spurious unsaved change indicators
			AppState.setState({ isLoadingCharacter: true });

			// Get all characters
			const listResult = await window.characterStorage.loadCharacters();
			if (!listResult.success) {
				throw new Error('Failed to load character list');
			}

			const characters = listResult.characters || []; // FIX: Use 'characters' not 'data'
			const characterData = characters.find((c) => c.id === id);

			if (!characterData) {
				console.warn('CharacterManager', 'Character not found', { id });
				throw new Error('Character not found');
			}

			// Validate
			const validation = CharacterSchema.validate(characterData);
			if (!validation.valid) {
				console.warn(
					'CharacterManager',
					'Loaded character invalid',
					validation.errors,
				);
				throw new Error(
					`Invalid character data: ${validation.errors.join(', ')}`,
				);
			}

			// Convert to Character instance to enable domain methods
			console.debug('[CharacterManager] Loading character - optionalProficiencies.tools.class:',
				JSON.stringify(characterData.optionalProficiencies?.tools?.class || {}));
			const character = new Character(characterData);

			// Update state
			console.debug(
				'CharacterManager',
				`Setting current character to: ${character.name} (${character.id})`,
			);
			AppState.setCurrentCharacter(character);
			AppState.setHasUnsavedChanges(false);

			// Emit event
			console.debug(
				'CharacterManager',
				`Emitting CHARACTER_SELECTED event for character: ${character.name}`,
			);
			eventBus.emit(EVENTS.CHARACTER_SELECTED, character);

			console.debug(
				'CharacterManager',
				`✓ Character loaded successfully: ${character.name}`,
				{ id },
			);

			return character;
		} catch (error) {
			console.error('CharacterManager', 'Load failed', error);
			throw error;
		} finally {
			// Always clear loading flag, even on error
			AppState.setState({ isLoadingCharacter: false });
		}
	}

	async saveCharacter() {
		const character = AppState.getCurrentCharacter();

		if (!character) {
			console.warn('CharacterManager', 'No character to save');
			throw new Error('No character selected');
		}

		console.debug('CharacterManager', 'Saving character', { id: character.id });

		try {
			// Update timestamp
			CharacterSchema.touch(character);

			// Validate before saving
			const validation = CharacterSchema.validate(character);
			if (!validation.valid) {
				console.warn(
					'CharacterManager',
					'Cannot save invalid character',
					validation.errors,
				);
				throw new Error(`Cannot save: ${validation.errors.join(', ')}`);
			}

			// Serialize character using centralized utility
			const serializedCharacter = serializeCharacter(character);

			const saveResult =
				await window.characterStorage.saveCharacter(serializedCharacter);

			if (!saveResult.success) {
				throw new Error(saveResult.error || 'Save failed');
			}

			// Update state
			AppState.setHasUnsavedChanges(false);

			// Emit event
			eventBus.emit(EVENTS.CHARACTER_SAVED, character);

			console.info('CharacterManager', 'Character saved', { id: character.id });
			return true;
		} catch (error) {
			console.error('CharacterManager', 'Save failed', error);
			throw error;
		}
	}

	async deleteCharacter(id) {
		console.info('CharacterManager', 'Deleting character', { id });

		try {
			// Delete via IPC
			const deleteResult = await window.characterStorage.deleteCharacter(id);

			if (!deleteResult.success) {
				throw new Error(deleteResult.error || 'Delete failed');
			}

			// Update state - remove from list
			const characters = AppState.getCharacters().filter((c) => c.id !== id);
			AppState.setCharacters(characters);

			// Clear current if it was deleted
			if (AppState.getCurrentCharacter()?.id === id) {
				AppState.setCurrentCharacter(null);
				AppState.setHasUnsavedChanges(false);
			}

			// Emit event
			eventBus.emit(EVENTS.CHARACTER_DELETED, id);

			console.info('CharacterManager', 'Character deleted', { id });
			return true;
		} catch (error) {
			console.error('CharacterManager', 'Delete failed', error);
			throw error;
		}
	}

	async loadCharacterList() {
		console.info('CharacterManager', 'Loading character list');

		try {
			const listResult = await window.characterStorage.loadCharacters();

			if (!listResult.success) {
				throw new Error(listResult.error || 'Failed to load list');
			}

			const charactersData = listResult.characters || []; // FIX: Use 'characters' not 'data'

			// Convert plain objects to Character instances so helper methods work
			const characters = charactersData.map((data) => new Character(data));

			// Update state
			AppState.setCharacters(characters);

			console.info('CharacterManager', 'Character list loaded', {
				count: characters.length,
			});
			return characters;
		} catch (error) {
			console.error('CharacterManager', 'Load list failed', error);
			throw error;
		}
	}

	updateCharacter(updates) {
		const character = AppState.getCurrentCharacter();

		if (!character) {
			console.warn('CharacterManager', 'No character to update');
			return;
		}

		console.debug('CharacterManager', 'Updating character', {
			id: character.id,
			updates,
		});

		// Clone via serialization to preserve immutability semantics
		const baseData = serializeCharacter(character);
		const mergedData = { ...baseData, ...updates };
		const updatedCharacter = new Character(mergedData);

		// Touch timestamp on the new instance
		CharacterSchema.touch(updatedCharacter);

		// Update state with a new reference so AppState change detection fires
		AppState.setState({ currentCharacter: updatedCharacter });
		AppState.setHasUnsavedChanges(true);
		eventBus.emit(EVENTS.CHARACTER_UPDATED, updatedCharacter);

		console.debug('CharacterManager', 'Character updated', {
			id: updatedCharacter.id,
		});
	}

	getCurrentCharacter() {
		return AppState.getCurrentCharacter();
	}

	hasUnsavedChanges() {
		return AppState.get('hasUnsavedChanges');
	}
}

// Export singleton instance
export const CharacterManager = new CharacterManagerImpl();
