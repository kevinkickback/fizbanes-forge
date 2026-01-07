/**
 * CharacterManager module
 *
 * Orchestrates character CRUD operations, state management, and event emission for the character builder.
 * Provides methods to create, load, save, and delete characters, and to synchronize with AppState and eventBus.
 *
 * @module CharacterManager
 */

import { eventBus, EVENTS } from '../utils/EventBus.js';

import { AppState } from './AppState.js';
import { Character, serializeCharacter } from './Character.js';
import { CharacterSchema } from './CharacterSchema.js';

/**
 * Character lifecycle orchestrator for CRUD, state, and events.
 * @class
 */
class CharacterManagerImpl {
	/**
	 * Create a new character.
	 * @param {string} name - Character name
	 * @returns {Promise<Character>} Newly created character
	 */
	async createCharacter(name) {
		console.info('CharacterManager', 'Creating character', { name });

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

	/**
	 * Load a character by ID.
	 * @param {string} id - Character ID
	 * @returns {Promise<Character>} Loaded character
	 */
	async loadCharacter(id) {
		console.info(
			'CharacterManager',
			`[${new Date().toISOString()}] Loading character with ID: ${id}`,
		);

		try {
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
			console.log('[CharacterManager] Loading character - optionalProficiencies.tools.class:', 
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

			console.info(
				'CharacterManager',
				`✓ Character loaded successfully: ${character.name}`,
				{ id },
			);
			return character;
		} catch (error) {
			console.error('CharacterManager', 'Load failed', error);
			throw error;
		}
	}

	/**
	 * Save current character.
	 * @returns {Promise<boolean>} true when saved
	 */
	async saveCharacter() {
		const character = AppState.getCurrentCharacter();

		if (!character) {
			console.warn('CharacterManager', 'No character to save');
			throw new Error('No character selected');
		}

		console.info('CharacterManager', 'Saving character', { id: character.id });

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

			// Save via IPC
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

	/**
	 * Delete a character by ID.
	 * @param {string} id - Character ID
	 * @returns {Promise<boolean>} true when deleted
	 */
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

	/**
	 * Load list of all characters.
	 * @returns {Promise<Array>} Characters array
	 */
	async loadCharacterList() {
		console.info('CharacterManager', 'Loading character list');

		try {
			const listResult = await window.characterStorage.loadCharacters();

			if (!listResult.success) {
				throw new Error(listResult.error || 'Failed to load list');
			}

			const characters = listResult.characters || []; // FIX: Use 'characters' not 'data'

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

	/**
	 * Update current character data.
	 * @param {object} updates - Partial character updates
	 */
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

		// Merge updates
		Object.assign(character, updates);

		// Touch timestamp
		CharacterSchema.touch(character);

		// Update state (triggers event)
		AppState.setCurrentCharacter(character);
		AppState.setHasUnsavedChanges(true);

		console.debug('CharacterManager', 'Character updated', {
			id: character.id,
		});
	}

	/**
	 * Get current character.
	 * @returns {object|null} Current character or null
	 */
	getCurrentCharacter() {
		return AppState.getCurrentCharacter();
	}

	/**
	 * Check if there are unsaved changes.
	 * @returns {boolean} True if there are unsaved changes
	 */
	hasUnsavedChanges() {
		return AppState.get('hasUnsavedChanges');
	}
}

// Export singleton instance
export const CharacterManager = new CharacterManagerImpl();
