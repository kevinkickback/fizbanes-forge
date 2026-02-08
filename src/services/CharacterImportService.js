import fssync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { CharacterSchema } from '../lib/CharacterSchema.js';

export class CharacterImportService {
	constructor(savePath) {
		this.savePath = savePath;
	}

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

	async validateCharacter(character) {
		const validation = CharacterSchema.validate(character);
		return {
			valid: validation.valid,
			errors: validation.errors,
		};
	}

	async checkForConflict(characterId) {
		const existingFilePath = path.join(this.savePath, `${characterId}.ffp`);

		try {
			await fs.access(existingFilePath);
			const existingContent = await fs.readFile(existingFilePath, 'utf8');
			const existingCharacter = JSON.parse(existingContent);
			const stats = fssync.statSync(existingFilePath);

			return {
				exists: true,
				existing: existingCharacter,
				createdAt: stats.birthtime.toISOString(),
			};
		} catch {
			return { exists: false };
		}
	}

	processConflictResolution(character, action) {
		if (action === 'cancel') {
			return { canceled: true };
		}

		if (action === 'keepBoth') {
			character.id = uuidv4();
		}

		return { character };
	}

	async importCharacter(filePath) {
		const readResult = await this.readCharacterFile(filePath);
		if (readResult.error) {
			return { step: 'read', success: false, error: readResult.error };
		}

		const character = readResult.character;

		const validationResult = await this.validateCharacter(character);
		if (!validationResult.valid) {
			return {
				step: 'validate',
				success: false,
				error: `Invalid character data: ${validationResult.errors.join(', ')}`,
			};
		}

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

		return {
			step: 'ready',
			success: true,
			character,
		};
	}
}
