/**
 * Character lifecycle management.
 *
 * ARCHITECTURE: Application Layer - Orchestrates domain and infrastructure
 *
 * PURPOSE:
 * - Manage character CRUD operations
 * - Coordinate between domain models and infrastructure
 * - Update application state
 * - Emit lifecycle events
 *
 * @module application/CharacterManager
 */

import { Logger } from '../infrastructure/Logger.js';
import { Result } from '../infrastructure/Result.js';
import { AppState } from './AppState.js';
import { eventBus, EVENTS } from '../infrastructure/EventBus.js';
import { CharacterSchema } from './CharacterSchema.js';
import { Character } from './Character.js';

class CharacterManagerImpl {
	/**
	 * Create a new character.
	 * @param {string} name - Character name
	 * @returns {Promise<Result>} Result with character or error
	 */
	async createCharacter(name) {
		Logger.info('CharacterManager', 'Creating character', { name });

		try {
			// Create character from schema
			const characterData = CharacterSchema.create();

			// Generate UUID
			const uuidResult = await window.electron.invoke('character:generateUUID');
			if (!uuidResult.success) {
				return Result.err('Failed to generate character ID');
			}

			characterData.id = uuidResult.data;
			characterData.name = name;

			// Validate
			const validation = CharacterSchema.validate(characterData);
			if (!validation.valid) {
				Logger.warn('CharacterManager', 'Validation failed', validation.errors);
				return Result.err(`Invalid character: ${validation.errors.join(', ')}`);
			}

			// Convert to Character instance to enable domain methods
			const character = new Character(characterData);

			// Update state
			AppState.setCurrentCharacter(character);
			AppState.setHasUnsavedChanges(true);

			// Emit event
			eventBus.emit(EVENTS.CHARACTER_CREATED, character);

			Logger.info('CharacterManager', 'Character created', {
				id: character.id,
			});
			return Result.ok(character);
		} catch (error) {
			Logger.error('CharacterManager', 'Create failed', error);
			return Result.err(error.message);
		}
	}

	/**
	 * Load a character by ID.
	 * @param {string} id - Character ID
	 * @returns {Promise<Result>} Result with character or error
	 */
	async loadCharacter(id) {
		Logger.info(
			'CharacterManager',
			`[${new Date().toISOString()}] Loading character with ID: ${id}`,
		);

		try {
			// Get all characters
			const listResult = await window.electron.invoke('character:list');
			if (!listResult.success) {
				return Result.err('Failed to load character list');
			}

			const characters = listResult.characters || []; // FIX: Use 'characters' not 'data'
			const characterData = characters.find((c) => c.id === id);

			if (!characterData) {
				Logger.warn('CharacterManager', 'Character not found', { id });
				return Result.err('Character not found');
			}

			// Validate
			const validation = CharacterSchema.validate(characterData);
			if (!validation.valid) {
				Logger.warn(
					'CharacterManager',
					'Loaded character invalid',
					validation.errors,
				);
				return Result.err(
					`Invalid character data: ${validation.errors.join(', ')}`,
				);
			}

			// Convert to Character instance to enable domain methods
			const character = new Character(characterData);

			// Update state
			Logger.debug(
				'CharacterManager',
				`Setting current character to: ${character.name} (${character.id})`,
			);
			AppState.setCurrentCharacter(character);
			AppState.setHasUnsavedChanges(false);

			// Emit event
			Logger.debug(
				'CharacterManager',
				`Emitting CHARACTER_SELECTED event for character: ${character.name}`,
			);
			eventBus.emit(EVENTS.CHARACTER_SELECTED, character);

			Logger.info(
				'CharacterManager',
				`✓ Character loaded successfully: ${character.name}`,
				{ id },
			);
			return Result.ok(character);
		} catch (error) {
			Logger.error('CharacterManager', 'Load failed', error);
			return Result.err(error.message);
		}
	}

	/**
	 * Save current character.
	 * @returns {Promise<Result>} Result with success or error
	 */
	async saveCharacter() {
		const character = AppState.getCurrentCharacter();

		if (!character) {
			Logger.warn('CharacterManager', 'No character to save');
			return Result.err('No character selected');
		}

		Logger.info('CharacterManager', 'Saving character', { id: character.id });

		try {
			// Update timestamp
			CharacterSchema.touch(character);

			// Validate before saving
			const validation = CharacterSchema.validate(character);
			if (!validation.valid) {
				Logger.warn(
					'CharacterManager',
					'Cannot save invalid character',
					validation.errors,
				);
				return Result.err(`Cannot save: ${validation.errors.join(', ')}`);
			}

			// Serialize character using toJSON() to handle Sets and Maps
			const serializedCharacter = character.toJSON
				? character.toJSON()
				: character;

			// Save via IPC
			const saveResult = await window.electron.invoke(
				'character:save',
				serializedCharacter,
			);

			if (!saveResult.success) {
				return Result.err(saveResult.error || 'Save failed');
			}

			// Update state
			AppState.setHasUnsavedChanges(false);

			// Emit event
			eventBus.emit(EVENTS.CHARACTER_SAVED, character);

			Logger.info('CharacterManager', 'Character saved', { id: character.id });
			return Result.ok(true);
		} catch (error) {
			Logger.error('CharacterManager', 'Save failed', error);
			return Result.err(error.message);
		}
	}

	/**
	 * Delete a character by ID.
	 * @param {string} id - Character ID
	 * @returns {Promise<Result>} Result with success or error
	 */
	async deleteCharacter(id) {
		Logger.info('CharacterManager', 'Deleting character', { id });

		try {
			// Delete via IPC
			const deleteResult = await window.electron.invoke('character:delete', id);

			if (!deleteResult.success) {
				return Result.err(deleteResult.error || 'Delete failed');
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

			Logger.info('CharacterManager', 'Character deleted', { id });
			return Result.ok(true);
		} catch (error) {
			Logger.error('CharacterManager', 'Delete failed', error);
			return Result.err(error.message);
		}
	}

	/**
	 * Load list of all characters.
	 * @returns {Promise<Result>} Result with characters array or error
	 */
	async loadCharacterList() {
		Logger.info('CharacterManager', 'Loading character list');

		try {
			const listResult = await window.electron.invoke('character:list');

			if (!listResult.success) {
				return Result.err(listResult.error || 'Failed to load list');
			}

			const characters = listResult.characters || []; // FIX: Use 'characters' not 'data'

			// Update state
			AppState.setCharacters(characters);

			Logger.info('CharacterManager', 'Character list loaded', {
				count: characters.length,
			});
			return Result.ok(characters);
		} catch (error) {
			Logger.error('CharacterManager', 'Load list failed', error);
			return Result.err(error.message);
		}
	}

	/**
	 * Update current character data.
	 * @param {object} updates - Partial character updates
	 */
	updateCharacter(updates) {
		const character = AppState.getCurrentCharacter();

		if (!character) {
			Logger.warn('CharacterManager', 'No character to update');
			return;
		}

		Logger.debug('CharacterManager', 'Updating character', {
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

		Logger.debug('CharacterManager', 'Character updated', { id: character.id });
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
