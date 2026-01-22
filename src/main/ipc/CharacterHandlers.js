import { dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { MainLogger } from '../Logger.js';
import { IPC_CHANNELS } from './channels.js';

import { CharacterImportService } from '../../services/CharacterImportService.js';
import { CharacterSchema } from '../../shared/CharacterSchema.js';

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
			const validation = CharacterSchema.validate(character);
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
			const tempPath = `${filePath}.tmp`;

			try {
				// Write to temp file first for atomic safety (process crash during write won't corrupt file)
				await fs.writeFile(tempPath, JSON.stringify(character, null, 2));
				// Atomic rename: replaces existing file or creates new one
				await fs.rename(tempPath, filePath);
			} catch (writeError) {
				// Clean up temp file if it exists
				try {
					await fs.unlink(tempPath);
				} catch {
					// Temp file may not exist; ignore
				}
				throw writeError;
			}

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

			const parentWindow =
				typeof windowManager.getMainWindow === 'function'
					? windowManager.getMainWindow()
					: windowManager.mainWindow;

			const result = await dialog.showSaveDialog(parentWindow, {
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

			const savePath = preferencesManager.getCharacterSavePath();
			const importService = new CharacterImportService(savePath);

			let sourceFilePath = userChoice?.sourceFilePath;
			let character = userChoice?.character;
			const action = userChoice?.action;

			// If no file selected yet, show dialog
			if (!sourceFilePath) {
				const parentWindow =
					typeof windowManager.getMainWindow === 'function'
						? windowManager.getMainWindow()
						: windowManager.mainWindow;

				const result = await dialog.showOpenDialog(parentWindow, {
					title: 'Import Character',
					filters: [{ name: 'Fizbane Character', extensions: ['ffp'] }],
					properties: ['openFile'],
				});

				if (result.canceled) {
					return { success: false, canceled: true };
				}

				sourceFilePath = result.filePaths[0];

				// Use service to read, validate, and check for conflicts
				const importResult =
					await importService.importCharacter(sourceFilePath);

				if (!importResult.success) {
					if (importResult.step === 'conflict') {
						// Return conflict info for user resolution
						return {
							success: false,
							duplicateId: true,
							character: importResult.character,
							existingCharacter: {
								...importResult.existing,
								createdAt: importResult.createdAt,
							},
							sourceFilePath,
							message: `A character with ID "${importResult.character.id}" already exists. What would you like to do?`,
						};
					}
					// Other errors (read, validate)
					return { success: false, error: importResult.error };
				}

				// Success, character is ready
				character = importResult.character;
			}

			// Handle user's choice for duplicate ID (keepBoth, overwrite, cancel)
			if (action) {
				const resolution = importService.processConflictResolution(
					character,
					action,
				);
				if (resolution.canceled) {
					MainLogger.info('CharacterHandlers', 'Import canceled by user');
					return { success: false, canceled: true };
				}
				character = resolution.character;

				if (action === 'overwrite') {
					MainLogger.info(
						'CharacterHandlers',
						'Overwriting existing character:',
						character.id,
					);
				} else if (action === 'keepBoth') {
					MainLogger.info(
						'CharacterHandlers',
						'Keeping both - generated new ID:',
						character.id,
					);
				}
			}

			// Write character atomically
			const id = character.id;
			const targetFilePath = path.join(savePath, `${id}.ffp`);
			const tempPath = `${targetFilePath}.tmp`;

			try {
				// Write to temp file first for atomic safety
				await fs.writeFile(tempPath, JSON.stringify(character, null, 2));
				// Atomic rename: replaces existing file or creates new one
				await fs.rename(tempPath, targetFilePath);
			} catch (writeError) {
				// Clean up temp file if it exists
				try {
					await fs.unlink(tempPath);
				} catch {
					// Temp file may not exist; ignore
				}
				throw writeError;
			}

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
