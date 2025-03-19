/**
 * Storage.js
 * Storage operations for characters including saving, loading, exporting, and importing
 * 
 * @typedef {Object} CharacterStorageResult
 * @property {boolean} success - Whether the operation was successful
 * @property {string} [message] - Optional message describing the result
 * @property {Error} [error] - Optional error if operation failed
 */

let instance = null;

/**
 * Class responsible for managing character storage operations
 */
export class Storage {
    /**
     * Initializes a new Storage instance
     * @private
     */
    constructor() {
        if (instance) {
            throw new Error('Storage is a singleton. Use Storage.getInstance() instead.');
        }
        instance = this;
    }

    /**
     * Load all characters from storage
     * @returns {Promise<Array>} Array of character objects
     */
    async loadCharacters() {
        try {
            return await window.characterStorage.loadCharacters();
        } catch (error) {
            console.error('Error loading characters from storage:', error);
            throw error;
        }
    }

    /**
     * Save a character to storage
     * @param {Object} character - The character to save
     * @returns {Promise<CharacterStorageResult>} Result of the save operation
     */
    async saveCharacter(character) {
        try {
            return await window.characterStorage.saveCharacter(character);
        } catch (error) {
            console.error('Error saving character to storage:', error);
            return {
                success: false,
                message: 'Failed to save character',
                error
            };
        }
    }

    /**
     * Generate a UUID for a new character
     * @returns {Promise<string>} A new UUID
     */
    async generateUUID() {
        return await window.characterStorage.generateUUID();
    }

    /**
     * Export a character to a JSON file
     * @param {string} characterId - The ID of the character to export
     * @returns {Promise<CharacterStorageResult>} Result of the export operation
     */
    async exportCharacter(characterId) {
        try {
            return await window.characterStorage.exportCharacter(characterId);
        } catch (error) {
            console.error('Error exporting character:', error);
            return {
                success: false,
                message: 'Failed to export character',
                error
            };
        }
    }

    /**
     * Import a character from a JSON file
     * @returns {Promise<CharacterStorageResult>} Result of the import operation
     */
    async importCharacter() {
        try {
            return await window.characterStorage.importCharacter();
        } catch (error) {
            console.error('Error importing character:', error);
            return {
                success: false,
                message: 'Failed to import character',
                error
            };
        }
    }

    /**
     * Delete a character from storage
     * @param {string} characterId - The ID of the character to delete
     * @returns {Promise<CharacterStorageResult>} Result of the delete operation
     */
    async deleteCharacter(characterId) {
        try {
            return await window.characterStorage.deleteCharacter(characterId);
        } catch (error) {
            console.error('Error deleting character:', error);
            return {
                success: false,
                message: 'Failed to delete character',
                error
            };
        }
    }

    /**
     * Gets the singleton instance of Storage
     * @returns {Storage} The singleton instance
     * @static
     */
    static getInstance() {
        if (!instance) {
            instance = new Storage();
        }
        return instance;
    }
}

export const storage = Storage.getInstance(); 