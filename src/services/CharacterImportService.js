import fssync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { CharacterSchema } from '../shared/CharacterSchema.js';

/**
 * Manages character import business logic (file reading, validation, conflict detection).
 * Separated from IPC handler to enable reuse and testing.
 * Does NOT handle dialog, logging, or file persistence (those remain in handler).
 */
export class CharacterImportService {
    constructor(savePath) {
        this.savePath = savePath;
    }

    /**
     * Read and parse a character file.
     * @param {string} filePath - Full path to .ffp file
     * @returns {Promise<{character: Object, error?: string}>} Parsed character or error
     */
    async readCharacterFile(filePath) {
        if (!filePath.endsWith('.ffp')) {
            return {
                error: 'Invalid file format. Only .ffp files are supported.',
            };
        }

        try {
            const content = await fs.readFile(filePath, 'utf8');
            const character = JSON.parse(content);
            return { character };
        } catch (error) {
            if (error instanceof SyntaxError) {
                return {
                    error: 'Invalid file content. File does not contain valid JSON.',
                };
            }
            return {
                error: `Failed to read file: ${error.message}`,
            };
        }
    }

    /**
     * Validate character data structure.
     * @param {Object} character - Character object
     * @returns {Promise<{valid: boolean, errors?: string[]}>} Validation result
     */
    async validateCharacter(character) {
        const validation = CharacterSchema.validate(character);
        return {
            valid: validation.valid,
            errors: validation.errors,
        };
    }

    /**
     * Check if a character with the given ID already exists.
     * @param {string} characterId - Character ID
     * @returns {Promise<{exists: boolean, existing?: Object, createdAt?: string}>} Conflict info
     */
    async checkForConflict(characterId) {
        const existingFilePath = path.join(this.savePath, `${characterId}.ffp`);

        try {
            await fs.access(existingFilePath);
            // File exists
            const existingContent = await fs.readFile(existingFilePath, 'utf8');
            const existingCharacter = JSON.parse(existingContent);
            const stats = fssync.statSync(existingFilePath);

            return {
                exists: true,
                existing: existingCharacter,
                createdAt: stats.birthtime.toISOString(),
            };
        } catch {
            // File doesn't exist
            return { exists: false };
        }
    }

    /**
     * Process user's conflict resolution choice.
     * @param {Object} character - Character to import
     * @param {string} action - 'overwrite' | 'keepBoth' | 'cancel'
     * @returns {{character: Object, canceled: boolean}} Modified character or cancellation
     */
    processConflictResolution(character, action) {
        if (action === 'cancel') {
            return { canceled: true };
        }

        if (action === 'keepBoth') {
            character.id = uuidv4();
        }

        // 'overwrite' or unknown action: keep original ID
        return { character };
    }

    /**
     * Full import flow: read, validate, check conflicts, and return prepared character.
     * @param {string} filePath - Path to .ffp file
     * @returns {Promise<{
     *   step: 'read'|'validate'|'conflict'|'ready',
     *   success: boolean,
     *   character?: Object,
     *   existing?: Object,
     *   createdAt?: string,
     *   error?: string
     * }>} Import status
     */
    async importCharacter(filePath) {
        // Step 1: Read file
        const readResult = await this.readCharacterFile(filePath);
        if (readResult.error) {
            return { step: 'read', success: false, error: readResult.error };
        }

        const character = readResult.character;

        // Step 2: Validate structure
        const validationResult = await this.validateCharacter(character);
        if (!validationResult.valid) {
            return {
                step: 'validate',
                success: false,
                error: `Invalid character data: ${validationResult.errors.join(', ')}`,
            };
        }

        // Step 3: Check for conflicts
        const conflictResult = await this.checkForConflict(character.id);
        if (conflictResult.exists) {
            return {
                step: 'conflict',
                success: false,
                character,
                existing: conflictResult.existing,
                createdAt: conflictResult.createdAt,
            };
        }

        // Ready for save
        return {
            step: 'ready',
            success: true,
            character,
        };
    }
}
