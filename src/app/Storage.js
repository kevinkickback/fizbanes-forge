/** Persistence helper for character storage operations. */

import { eventBus, EVENTS } from '../lib/EventBus.js';

let _instance = null;

export class Storage {
	constructor() {
		if (_instance) {
			throw new Error(
				'Storage is a singleton. Use Storage.getInstance() instead.',
			);
		}
		_instance = this;
	}

	async getCharacters() {
		try {
			const characters = await window.characterStorage.loadCharacters();
			return characters || [];
		} catch (error) {
			console.error('Storage', 'Error loading characters from storage:', error);
			return [];
		}
	}

	async getCharacter(characterId) {
		try {
			const characters = await this.getCharacters();
			const character =
				characters.find((character) => character.id === characterId) || null;
			if (character) {
				eventBus.emit(EVENTS.STORAGE_CHARACTER_LOADED, character);
			}
			return character;
		} catch (error) {
			console.error(
				'Storage',
				`Error loading character with ID ${characterId}:`,
				error,
			);
			return null;
		}
	}

	async saveCharacter(character) {
		try {
			if (!character || !character.id) {
				console.error(
					'Storage',
					'Invalid character object passed to saveCharacter',
				);
				return false;
			}

			const serializedCharacter = JSON.stringify(character);
			const result =
				await window.characterStorage.saveCharacter(serializedCharacter);

			if (result?.success === true) {
				eventBus.emit(EVENTS.STORAGE_CHARACTER_SAVED, character);
			}

			return result?.success === true;
		} catch (error) {
			console.error('Storage', 'Error saving character to storage:', error);
			return false;
		}
	}

	async deleteCharacter(characterId) {
		try {
			if (!characterId) {
				console.error(
					'Storage',
					'Invalid character ID passed to deleteCharacter',
				);
				return false;
			}

			const result = await window.characterStorage.deleteCharacter(characterId);

			if (result?.success === true) {
				eventBus.emit(EVENTS.STORAGE_CHARACTER_DELETED, characterId);
			}

			return result?.success === true;
		} catch (error) {
			console.error(
				'Storage',
				`Error deleting character with ID ${characterId}:`,
				error,
			);
			return false;
		}
	}

	async exportCharacter(characterId) {
		try {
			if (!characterId) {
				console.error(
					'Storage',
					'Invalid character ID passed to exportCharacter',
				);
				return false;
			}

			const result = await window.characterStorage.exportCharacter(characterId);

			return result?.success === true;
		} catch (error) {
			console.error(
				'Storage',
				`Error exporting character with ID ${characterId}:`,
				error,
			);
			return false;
		}
	}

	async importCharacter() {
		try {
			let result = await window.characterStorage.importCharacter();

			if (result?.duplicateId) {
				const Modal = (await import('./Modal.js')).Modal;
				const modal = Modal.getInstance();

				const action = await modal.showDuplicateIdModal({
					characterName: result.character.name,
					characterId: result.character.id,
					createdAt: result.existingCharacter?.createdAt,
					lastModified: result.existingCharacter?.lastModified,
				});

				if (action === 'cancel') {
					return {
						success: false,
						character: null,
						canceled: true,
					};
				}

				result = await window.characterStorage.importCharacter({
					character: result.character,
					sourceFilePath: result.sourceFilePath,
					action,
				});
			}

			if (result?.success && result.character) {
				return {
					success: true,
					character: result.character,
				};
			}

			return {
				success: false,
				character: null,
				canceled: result?.canceled || false,
			};
		} catch (error) {
			console.error('Storage', 'Error importing character:', error);
			return {
				success: false,
				character: null,
			};
		}
	}

	async generateUUID() {
		try {
			return await window.characterStorage.generateUUID();
		} catch (error) {
			console.error('Storage', 'Error generating UUID:', error);
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
				const r = (Math.random() * 16) | 0;
				const v = c === 'x' ? r : (r & 0x3) | 0x8;
				return v.toString(16);
			});
		}
	}

	static getInstance() {
		if (!_instance) {
			_instance = new Storage();
		}
		return _instance;
	}
}

// Export a singleton instance
export const storage = Storage.getInstance();
