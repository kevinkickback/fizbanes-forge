import {
	DataError,
	NotFoundError,
	ServiceError,
	ValidationError,
} from '../lib/Errors.js';
import { eventBus, EVENTS } from '../lib/EventBus.js';
import { showNotification } from '../lib/Notifications.js';

import { CharacterSchema } from '../lib/CharacterSchema.js';
import { AppState } from './AppState.js';
import { Character, serializeCharacter } from './Character.js';

class CharacterManagerImpl {
	async createCharacter(name) {
		const failedServices = AppState.getFailedServices();
		if (Array.isArray(failedServices) && failedServices.length > 0) {
			const message = `Cannot create characters until data loads (${failedServices.join(', ')}).`;
			showNotification(message, 'error');
			throw new ServiceError(
				'CharacterManager',
				message,
				{ failedServices },
			);
		}

		try {
			const characterData = CharacterSchema.create();

			const uuidResult = await window.characterStorage.generateUUID();
			if (!uuidResult.success) {
				throw new DataError('Failed to generate character ID');
			}

			characterData.id = uuidResult.data;
			characterData.name = name;

			const validation = CharacterSchema.validate(characterData);
			if (!validation.valid) {
				console.warn(
					'[CharacterManager]',
					'Validation failed:',
					validation.errors,
				);
				throw new ValidationError(
					`Invalid character: ${validation.errors.join(', ')}`,
					{ errors: validation.errors },
				);
			}

			const character = new Character(characterData);

			AppState.setCurrentCharacter(character);
			AppState.setHasUnsavedChanges(true);

			eventBus.emit(EVENTS.CHARACTER_CREATED, character);

			return character;
		} catch (error) {
			console.error('[CharacterManager]', 'Create failed:', error);
			throw error;
		}
	}

	async loadCharacter(id) {
		try {
			AppState.setState({ isLoadingCharacter: true });

			const listResult = await window.characterStorage.loadCharacters();
			if (!listResult.success) {
				throw new DataError('Failed to load character list');
			}

			const characters = listResult.characters || [];
			const characterData = characters.find((c) => c.id === id);

			if (!characterData) {
				console.warn('[CharacterManager]', 'Character not found:', id);
				throw new NotFoundError('Character', id);
			}

			const validation = CharacterSchema.validate(characterData);
			if (!validation.valid) {
				console.warn(
					'[CharacterManager]',
					'Loaded character invalid:',
					validation.errors,
				);
				throw new ValidationError(
					`Invalid character data: ${validation.errors.join(', ')}`,
					{ errors: validation.errors },
				);
			}

			const character = new Character(characterData);

			AppState.setCurrentCharacter(character);
			AppState.setHasUnsavedChanges(false);

			return character;
		} catch (error) {
			console.error('[CharacterManager]', 'Load failed:', error);
			throw error;
		} finally {
			AppState.setState({ isLoadingCharacter: false });
		}
	}

	async saveCharacter() {
		const character = AppState.getCurrentCharacter();

		if (!character) {
			console.warn('[CharacterManager]', 'No character to save');
			throw new NotFoundError('Character', 'current');
		}

		try {
			CharacterSchema.touch(character);

			const validation = CharacterSchema.validate(character);
			if (!validation.valid) {
				console.warn(
					'[CharacterManager]',
					'Cannot save invalid character:',
					validation.errors,
				);
				throw new ValidationError(
					`Cannot save: ${validation.errors.join(', ')}`,
					{ errors: validation.errors },
				);
			}

			const serializedCharacter = serializeCharacter(character);

			const saveResult =
				await window.characterStorage.saveCharacter(serializedCharacter);

			if (!saveResult.success) {
				throw new DataError(
					saveResult.error || 'Save failed',
					{ characterId: character.id },
				);
			}

			AppState.setHasUnsavedChanges(false);
			eventBus.emit(EVENTS.CHARACTER_SAVED, character);

			return true;
		} catch (error) {
			console.error('[CharacterManager]', 'Save failed:', error);
			throw error;
		}
	}

	async deleteCharacter(id) {
		try {
			const deleteResult = await window.characterStorage.deleteCharacter(id);

			if (!deleteResult.success) {
				throw new DataError(
					deleteResult.error || 'Delete failed',
					{ characterId: id },
				);
			}

			const characters = AppState.getCharacters().filter((c) => c.id !== id);
			AppState.setCharacters(characters);

			if (AppState.getCurrentCharacter()?.id === id) {
				AppState.setCurrentCharacter(null);
				AppState.setHasUnsavedChanges(false);
			}

			eventBus.emit(EVENTS.CHARACTER_DELETED, id);

			return true;
		} catch (error) {
			console.error('[CharacterManager]', 'Delete failed:', error);
			throw error;
		}
	}

	async loadCharacterList() {
		try {
			const listResult = await window.characterStorage.loadCharacters();

			if (!listResult.success) {
				throw new DataError(listResult.error || 'Failed to load list');
			}

			const charactersData = listResult.characters || [];

			const characters = charactersData.map((data) => new Character(data));

			AppState.setCharacters(characters);

			return characters;
		} catch (error) {
			console.error('[CharacterManager]', 'Load list failed:', error);
			throw error;
		}
	}

	updateCharacter(updates) {
		const character = AppState.getCurrentCharacter();

		if (!character) {
			console.warn('[CharacterManager]', 'No character to update');
			return;
		}

		const baseData = serializeCharacter(character);
		const mergedData = { ...baseData, ...updates };
		const updatedCharacter = new Character(mergedData);

		CharacterSchema.touch(updatedCharacter);

		AppState.setState({ currentCharacter: updatedCharacter });
		AppState.setHasUnsavedChanges(true);
		eventBus.emit(EVENTS.CHARACTER_UPDATED, updatedCharacter);
	}

	getCurrentCharacter() {
		return AppState.getCurrentCharacter();
	}
}

export const CharacterManager = new CharacterManagerImpl();
