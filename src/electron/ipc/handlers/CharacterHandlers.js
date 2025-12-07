/** IPC handlers for character operations. */

import { dialog, ipcMain } from 'electron';
import fssync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { MainLogger } from '../../MainLogger.js';
import { IPC_CHANNELS } from '../channels.js';

import { validate as validateCharacter } from '../../../renderer/scripts/core/CharacterValidation.js';

export function registerCharacterHandlers(preferencesManager, windowManager) {
	MainLogger.info('CharacterHandlers', 'Registering character handlers');

	// Save character
	ipcMain.handle(IPC_CHANNELS.CHARACTER_SAVE, async (_event, characterData) => {
		try {
			// Handle both serialized string and object
			const character =
				typeof characterData === 'string'
					? JSON.parse(characterData)
					: characterData;
			// Validate before saving
			const validation = await validateCharacter(character);
			if (!validation.valid) {
				return {
					success: false,
					error: `Invalid character data: ${validation.errors.join(', ')}`,
				};
			}

			MainLogger.info(
				'CharacterHandlers',
				'Saving character:',
				character.id,
				'Name:',
				character.name,
			);

			const savePath = preferencesManager.getCharacterSavePath();
			// Save using the character ID as filename (simple, predictable)
			const id = character.id || uuidv4();
			const filePath = path.join(savePath, `${id}.ffp`);

			await fs.writeFile(filePath, JSON.stringify(character, null, 2));

			MainLogger.info('CharacterHandlers', 'Character saved:', filePath);
			return { success: true, path: filePath };
		} catch (error) {
			MainLogger.error('CharacterHandlers', 'Save failed:', error);
			return { success: false, error: error.message };
		}
	});

	// Load all characters
	ipcMain.handle(IPC_CHANNELS.CHARACTER_LIST, async () => {
		try {
			const savePath = preferencesManager.getCharacterSavePath();
			MainLogger.info(
				'CharacterHandlers',
				'Loading characters from:',
				savePath,
			);

			const files = await fs.readdir(savePath);
			const ffpFiles = files.filter((file) => file.endsWith('.ffp'));

			const characters = [];
			for (const file of ffpFiles) {
				try {
					const filePath = path.join(savePath, file);
					const content = await fs.readFile(filePath, 'utf8');
					const character = JSON.parse(content);
					characters.push(character);
				} catch (error) {
					MainLogger.error(
						'CharacterHandlers',
						`Error loading ${file}:`,
						error,
					);
				}
			}

			MainLogger.info(
				'CharacterHandlers',
				'Loaded characters:',
				characters.length,
			);
			return { success: true, characters };
		} catch (error) {
			MainLogger.error('CharacterHandlers', 'Load failed:', error);
			return { success: false, error: error.message, characters: [] };
		}
	});

	// Delete character
	ipcMain.handle(IPC_CHANNELS.CHARACTER_DELETE, async (_event, id) => {
		try {
			MainLogger.info('CharacterHandlers', 'Deleting character:', id);

			const savePath = preferencesManager.getCharacterSavePath();
			const filePath = path.join(savePath, `${id}.ffp`);

			await fs.unlink(filePath);

			MainLogger.info('CharacterHandlers', 'Character deleted:', filePath);
			return { success: true };
		} catch (error) {
			MainLogger.error('CharacterHandlers', 'Delete failed:', error);
			return { success: false, error: error.message };
		}
	});

	// Export character
	ipcMain.handle(IPC_CHANNELS.CHARACTER_EXPORT, async (_event, id) => {
		try {
			MainLogger.info('CharacterHandlers', 'Exporting character:', id);

			const savePath = preferencesManager.getCharacterSavePath();
			const sourceFilePath = path.join(savePath, `${id}.ffp`);

			const result = await dialog.showSaveDialog(windowManager.mainWindow, {
				title: 'Export Character',
				defaultPath: `character-${id}.ffp`,
				filters: [{ name: 'Fizbane Character', extensions: ['ffp'] }],
			});

			if (result.canceled) {
				return { success: false, canceled: true };
			}

			await fs.copyFile(sourceFilePath, result.filePath);

			MainLogger.info(
				'CharacterHandlers',
				'Character exported to:',
				result.filePath,
			);
			return { success: true, path: result.filePath };
		} catch (error) {
			MainLogger.error('CharacterHandlers', 'Export failed:', error);
			return { success: false, error: error.message };
		}
	});

	// Import character
	ipcMain.handle(IPC_CHANNELS.CHARACTER_IMPORT, async (_event, userChoice) => {
		try {
			MainLogger.info('CharacterHandlers', 'Importing character');

			let sourceFilePath = userChoice?.sourceFilePath;
			let character = userChoice?.character;
			const action = userChoice?.action;

			// If no file selected yet, show dialog
			if (!sourceFilePath) {
				const result = await dialog.showOpenDialog(windowManager.mainWindow, {
					title: 'Import Character',
					filters: [{ name: 'Fizbane Character', extensions: ['ffp'] }],
					properties: ['openFile'],
				});

				if (result.canceled) {
					return { success: false, canceled: true };
				}

				sourceFilePath = result.filePaths[0];

				// Validate file extension
				if (!sourceFilePath.endsWith('.ffp')) {
					return {
						success: false,
						error: 'Invalid file format. Only .ffp files are supported.',
					};
				}

				// Read and parse file
				const content = await fs.readFile(sourceFilePath, 'utf8');
				try {
					character = JSON.parse(content);
				} catch {
					return {
						success: false,
						error: 'Invalid file content. File does not contain valid JSON.',
					};
				}

				// Validate character data structure
				const validation = await validateCharacter(character);
				if (!validation.valid) {
					return {
						success: false,
						error: `Invalid character data: ${validation.errors.join(', ')}`,
					};
				}
				// If a character payload was provided directly, validate it before proceeding
				if (character) {
					const validation = await validateCharacter(character);
					if (!validation.valid) {
						return {
							success: false,
							error: `Invalid character data: ${validation.errors.join(', ')}`,
						};
					}
				}

				const savePath = preferencesManager.getCharacterSavePath();
				const existingFilePath = path.join(savePath, `${character.id}.ffp`);

				// Check if character with same ID already exists
				try {
					await fs.access(existingFilePath);
					// File exists - read it and get creation time
					MainLogger.info(
						'CharacterHandlers',
						'Character ID already exists:',
						character.id,
					);
					const existingContent = await fs.readFile(existingFilePath, 'utf8');
					const existingCharacter = JSON.parse(existingContent);

					// Get file creation time
					const stats = fssync.statSync(existingFilePath);
					const createdAt = stats.birthtime.toISOString();

					return {
						success: false,
						duplicateId: true,
						character: character,
						existingCharacter: { ...existingCharacter, createdAt },
						sourceFilePath: sourceFilePath,
						message: `A character with ID "${character.id}" already exists. What would you like to do?`,
					};
				} catch {
					// File doesn't exist, proceed with import
				}
			}

			// Handle user's choice for duplicate ID
			if (action === 'overwrite') {
				MainLogger.info(
					'CharacterHandlers',
					'Overwriting existing character:',
					character.id,
				);
			} else if (action === 'keepBoth') {
				MainLogger.info(
					'CharacterHandlers',
					'Keeping both - generating new ID',
				);
				character.id = uuidv4();
			} else if (action === 'cancel') {
				MainLogger.info('CharacterHandlers', 'Import canceled by user');
				return { success: false, canceled: true };
			}

			const savePath = preferencesManager.getCharacterSavePath();
			const id = character.id;
			const targetFilePath = path.join(savePath, `${id}.ffp`);

			await fs.writeFile(targetFilePath, JSON.stringify(character, null, 2));

			MainLogger.info('CharacterHandlers', 'Character imported:', character.id);
			return { success: true, character };
		} catch (error) {
			MainLogger.error('CharacterHandlers', 'Import failed:', error);
			return { success: false, error: error.message };
		}
	});

	// Generate UUID
	ipcMain.handle(IPC_CHANNELS.CHARACTER_GENERATE_UUID, () => {
		return { success: true, data: uuidv4() };
	});

	MainLogger.info('CharacterHandlers', 'All character handlers registered');
}
