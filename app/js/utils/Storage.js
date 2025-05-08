/**
 * Storage.js
 * Provides a consistent interface for character data persistence
 * Handles saving, loading, importing, exporting, and deleting characters
 * 
 * @typedef {Object} CharacterStorageResult
 * @property {boolean} success - Whether the operation was successful
 * @property {string} [message] - Optional message describing the result
 * @property {Error} [error] - Optional error if operation failed
 */

import { eventEmitter } from './EventEmitter.js';

/**
 * Singleton instance for Storage class
 * @type {Storage|null}
 * @private
 */
let _instance = null;

/**
 * Class responsible for managing character storage operations
 */
export class Storage {
    /**
     * Initializes a new Storage instance
     * @private
     */
    constructor() {
        if (_instance) {
            throw new Error('Storage is a singleton. Use Storage.getInstance() instead.');
        }
        _instance = this;
    }


    /**
     * Gets all characters from storage
     * @returns {Promise<Array>} Array of character objects
     */
    async getCharacters() {
        try {
            const characters = await window.characterStorage.loadCharacters();
            return characters || [];
        } catch (error) {
            console.error('Error loading characters from storage:', error);
            return [];
        }
    }

    /**
     * Gets a specific character by ID
     * @param {string} characterId - The ID of the character to load
     * @returns {Promise<Object|null>} The character object or null if not found
     */
    async getCharacter(characterId) {
        try {
            const characters = await this.getCharacters();
            const character = characters.find(character => character.id === characterId) || null;
            if (character) {
                eventEmitter.emit('storage:characterLoaded', character);
            }
            return character;
        } catch (error) {
            console.error(`Error loading character with ID ${characterId}:`, error);
            return null;
        }
    }


    /**
     * Saves a character to storage
     * @param {Object} character - The character to save
     * @returns {Promise<boolean>} True if save was successful
     */
    async saveCharacter(character) {
        try {
            if (!character || !character.id) {
                console.error('Invalid character object passed to saveCharacter');
                return false;
            }


            // Pre-serialize the character to avoid IPC cloning issues
            const serializedCharacter = JSON.stringify(character);
            const result = await window.characterStorage.saveCharacter(serializedCharacter);

            if (result?.success === true) {
                eventEmitter.emit('storage:characterSaved', character);
            }

            return result?.success === true;
        } catch (error) {
            console.error('Error saving character to storage:', error);
            return false;
        }
    }

    /**
     * Deletes a character from storage
     * @param {string} characterId - The ID of the character to delete
     * @returns {Promise<boolean>} True if deletion was successful
     */
    async deleteCharacter(characterId) {
        try {
            if (!characterId) {
                console.error('Invalid character ID passed to deleteCharacter');
                return false;
            }

            const result = await window.characterStorage.deleteCharacter(characterId);

            if (result?.success === true) {
                eventEmitter.emit('storage:characterDeleted', characterId);
            }

            return result?.success === true;
        } catch (error) {
            console.error(`Error deleting character with ID ${characterId}:`, error);
            return false;
        }
    }


    /**
     * Exports a character to a JSON file via Electron's file dialog
     * @param {string} characterId - The ID of the character to export
     * @returns {Promise<boolean>} True if export was successful
     */
    async exportCharacter(characterId) {
        try {
            if (!characterId) {
                console.error('Invalid character ID passed to exportCharacter');
                return false;
            }

            const result = await window.characterStorage.exportCharacter(characterId);

            return result?.success === true;
        } catch (error) {
            console.error(`Error exporting character with ID ${characterId}:`, error);
            return false;
        }
    }

    /**
     * Imports a character from a JSON file via Electron's file dialog
     * @returns {Promise<{success: boolean, character: Object|null}>} Object with success status and imported character
     */
    async importCharacter() {
        try {
            const result = await window.characterStorage.importCharacter();

            if (result?.success && result.character) {
                return {
                    success: true,
                    character: result.character
                };
            }

            return {
                success: false,
                character: null
            };
        } catch (error) {
            console.error('Error importing character:', error);
            return {
                success: false,
                character: null
            };
        }
    }

    /**
     * Generates a UUID for a new character
     * @returns {Promise<string>} A new UUID
     */
    async generateUUID() {
        try {
            return await window.characterStorage.generateUUID();
        } catch (error) {
            console.error('Error generating UUID:', error);
            // Fallback to a simple UUID generation if the IPC call fails
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    }

    /**
     * Gets the singleton instance of Storage
     * @returns {Storage} The singleton instance
     * @static
     */
    static getInstance() {
        if (!_instance) {
            _instance = new Storage();
        }
        return _instance;
    }
}

// Export a singleton instance
export const storage = Storage.getInstance(); 