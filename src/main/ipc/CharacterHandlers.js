import { dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { MainLogger } from '../Logger.js';
import { IPC_CHANNELS } from './channels.js';

import { CharacterSchema } from '../../lib/CharacterSchema.js';
import { MAX_CHARACTER_SIZE, MAX_PORTRAIT_SIZE } from '../../lib/GameRules.js';
import { CharacterImportService } from '../../services/CharacterImportService.js';

// Allows UUIDs, alphanumeric strings, hyphens, and underscores only.
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function resolveCharacterPath(savePath, id) {
	if (!id || typeof id !== 'string' || !SAFE_ID_PATTERN.test(id)) {
		return null;
	}
	const filePath = path.join(savePath, `${id}.ffp`);
	const resolved = path.resolve(filePath);
	if (!resolved.startsWith(path.resolve(savePath))) {
		return null;
	}
	return resolved;
}

const IMAGE_MIME_TYPES = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
};

/**
 * Embeds the character's portrait image as a base64 data URL into embeddedPortrait.
 * Skips embedding for asset paths, data URLs, empty portraits, or unsupported types.
 * On file-read failure, logs a warning and leaves embeddedPortrait unchanged.
 * @param {Object} character - Plain character object (mutated in place)
 */
export async function embedPortraitData(character) {
	const portrait = character.portrait;
	if (!portrait || portrait.startsWith('assets/') || portrait.startsWith('data:')) {
		return;
	}

	const ext = path.extname(portrait).toLowerCase();
	const mimeType = IMAGE_MIME_TYPES[ext];
	if (!mimeType) {
		MainLogger.warn('CharacterHandlers', 'Unsupported portrait extension, skipping embed:', ext);
		return;
	}

	try {
		const stats = await fs.stat(portrait);
		if (stats.size > MAX_PORTRAIT_SIZE) {
			MainLogger.warn('CharacterHandlers', 'Portrait file exceeds size limit, skipping embed');
			return;
		}
		const buffer = await fs.readFile(portrait);
		character.embeddedPortrait = {
			data: `data:${mimeType};base64,${buffer.toString('base64')}`,
			mimeType,
			originalFilename: path.basename(portrait),
		};
	} catch (error) {
		MainLogger.warn('CharacterHandlers', 'Could not embed portrait, skipping:', error.message);
	}
}

/**
 * Extracts the embedded portrait from the character into the portraits folder.
 * Updates character.portrait to the extracted file path (whether newly written or already existing).
 * If the file already exists, skips writing. On error, logs a warning without modifying portrait.
 * @param {Object} character - Plain character object (mutated in place)
 * @param {string} savePath - Character save directory path
 */
export async function extractEmbeddedPortrait(character, savePath) {
	const embedded = character.embeddedPortrait;
	if (!embedded?.data || !embedded?.originalFilename) {
		return;
	}

	const portraitsDir = path.join(path.dirname(savePath), 'portraits');

	const ext = path.extname(embedded.originalFilename).toLowerCase();
	const base = path.basename(embedded.originalFilename, ext);
	const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, '_');
	const safeName = safeBase ? `${safeBase}${ext}` : `portrait${ext || '.png'}`;

	const targetPath = path.join(portraitsDir, safeName);
	if (!path.resolve(targetPath).startsWith(path.resolve(portraitsDir))) {
		MainLogger.warn('CharacterHandlers', 'Portrait extraction path traversal attempt blocked');
		return;
	}

	try {
		await fs.access(targetPath);
		character.portrait = targetPath;
	} catch {
		try {
			await fs.mkdir(portraitsDir, { recursive: true });

			const match = embedded.data.match(/^data:[^;]+;base64,(.+)$/s);
			if (!match) {
				MainLogger.warn('CharacterHandlers', 'Invalid embedded portrait data URL, skipping extraction');
				return;
			}

			const buffer = Buffer.from(match[1], 'base64');
			await fs.writeFile(targetPath, buffer);
			character.portrait = targetPath;
			MainLogger.debug('CharacterHandlers', 'Extracted portrait to:', targetPath);
		} catch (error) {
			MainLogger.warn('CharacterHandlers', 'Could not extract portrait:', error.message);
		}
	}
}

export function registerCharacterHandlers(preferencesManager, windowManager) {
	MainLogger.debug('CharacterHandlers', 'Registering character handlers');

	ipcMain.handle(IPC_CHANNELS.CHARACTER_SAVE, async (_event, characterData) => {
		try {
			if (typeof characterData === 'string' && Buffer.byteLength(characterData) > MAX_CHARACTER_SIZE) {
				return { success: false, error: 'Character data exceeds maximum size limit' };
			}

			const character =
				typeof characterData === 'string'
					? JSON.parse(characterData)
					: characterData;
			const validation = CharacterSchema.validate(character);
			if (!validation.valid) {
				return {
					success: false,
					error: `Invalid character data: ${validation.errors.join(', ')}`,
				};
			}

			MainLogger.debug(
				'CharacterHandlers',
				'Saving character:',
				character.id,
				'Name:',
				character.name,
			);

			const savePath = preferencesManager.getCharacterSavePath();
			await embedPortraitData(character);
			const id = character.id || uuidv4();
			const filePath = resolveCharacterPath(savePath, id);
			if (!filePath) {
				return { success: false, error: 'Invalid character ID' };
			}
			const tempPath = `${filePath}.tmp`;

			try {
				// Atomic write: temp file then rename to prevent corruption on crash
				await fs.writeFile(tempPath, JSON.stringify(character, null, 2));
				await fs.rename(tempPath, filePath);
			} catch (writeError) {
				try {
					await fs.unlink(tempPath);
				} catch {
				}
				throw writeError;
			}

			MainLogger.debug('CharacterHandlers', 'Character saved:', filePath);
			return { success: true, path: filePath };
		} catch (error) {
			MainLogger.error('CharacterHandlers', 'Save failed:', error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(IPC_CHANNELS.CHARACTER_LOAD, async (_event, id) => {
		try {
			const savePath = preferencesManager.getCharacterSavePath();
			const filePath = resolveCharacterPath(savePath, id);
			if (!filePath) {
				return { success: false, error: 'Invalid character ID' };
			}

			try {
				const content = await fs.readFile(filePath, 'utf8');
				if (Buffer.byteLength(content) > MAX_CHARACTER_SIZE) {
					return { success: false, error: 'Character file exceeds maximum size limit' };
				}
				const character = JSON.parse(content);
				await extractEmbeddedPortrait(character, savePath);
				MainLogger.debug('CharacterHandlers', 'Loaded character:', id);
				return { success: true, character };
			} catch (readError) {
				if (readError.code === 'ENOENT') {
					return { success: false, error: `Character not found: ${id}` };
				}
				throw readError;
			}
		} catch (error) {
			MainLogger.error('CharacterHandlers', 'Load character failed:', error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(IPC_CHANNELS.CHARACTER_LIST, async () => {
		try {
			const savePath = preferencesManager.getCharacterSavePath();
			MainLogger.debug(
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
					if (Buffer.byteLength(content) > MAX_CHARACTER_SIZE) {
						MainLogger.warn('CharacterHandlers', `Skipping oversized file: ${file}`);
						continue;
					}
					const character = JSON.parse(content); await extractEmbeddedPortrait(character, savePath); characters.push(character);
				} catch (error) {
					MainLogger.error(
						'CharacterHandlers',
						`Error loading ${file}:`,
						error,
					);
				}
			}

			MainLogger.debug(
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

	ipcMain.handle(IPC_CHANNELS.CHARACTER_DELETE, async (_event, id) => {
		try {
			MainLogger.debug('CharacterHandlers', 'Deleting character:', id);

			const savePath = preferencesManager.getCharacterSavePath();
			const filePath = resolveCharacterPath(savePath, id);
			if (!filePath) {
				return { success: false, error: 'Invalid character ID' };
			}

			await fs.unlink(filePath);

			MainLogger.debug('CharacterHandlers', 'Character deleted:', filePath);
			return { success: true };
		} catch (error) {
			MainLogger.error('CharacterHandlers', 'Delete failed:', error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(IPC_CHANNELS.CHARACTER_EXPORT, async (_event, id) => {
		try {
			MainLogger.debug('CharacterHandlers', 'Exporting character:', id);

			const savePath = preferencesManager.getCharacterSavePath();
			const sourceFilePath = resolveCharacterPath(savePath, id);
			if (!sourceFilePath) {
				return { success: false, error: 'Invalid character ID' };
			}

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

			MainLogger.debug(
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

	ipcMain.handle(IPC_CHANNELS.CHARACTER_IMPORT, async (_event, userChoice) => {
		try {
			MainLogger.debug('CharacterHandlers', 'Importing character');

			const savePath = preferencesManager.getCharacterSavePath();
			const importService = new CharacterImportService(savePath);

			let sourceFilePath = userChoice?.sourceFilePath;
			let character = userChoice?.character;
			const action = userChoice?.action;

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

				const stats = await fs.stat(sourceFilePath);
				if (stats.size > MAX_CHARACTER_SIZE) {
					return { success: false, error: `File exceeds maximum size of ${MAX_CHARACTER_SIZE / (1024 * 1024)}MB` };
				}

				const importResult =
					await importService.importCharacter(sourceFilePath);

				if (!importResult.success) {
					if (importResult.step === 'conflict') {
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
					return { success: false, error: importResult.error };
				}

				character = importResult.character;
			}

			if (action) {
				const resolution = importService.processConflictResolution(
					character,
					action,
				);
				if (resolution.canceled) {
					MainLogger.debug('CharacterHandlers', 'Import canceled by user');
					return { success: false, canceled: true };
				}
				character = resolution.character;

				if (action === 'overwrite') {
					MainLogger.debug(
						'CharacterHandlers',
						'Overwriting existing character:',
						character.id,
					);
				} else if (action === 'keepBoth') {
					MainLogger.debug(
						'CharacterHandlers',
						'Keeping both - generated new ID:',
						character.id,
					);
				}
			}

			const id = character.id;
			const targetFilePath = resolveCharacterPath(savePath, id);
			if (!targetFilePath) {
				return { success: false, error: 'Invalid character ID' };
			}
			const tempPath = `${targetFilePath}.tmp`;

			try {
				await fs.writeFile(tempPath, JSON.stringify(character, null, 2));
				await fs.rename(tempPath, targetFilePath);
			} catch (writeError) {
				try {
					await fs.unlink(tempPath);
				} catch {
				}
				throw writeError;
			}

			await extractEmbeddedPortrait(character, savePath);
			MainLogger.debug('CharacterHandlers', 'Character imported:', character.id);
			return { success: true, character };
		} catch (error) {
			MainLogger.error('CharacterHandlers', 'Import failed:', error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(IPC_CHANNELS.CHARACTER_GENERATE_UUID, () => {
		return { success: true, data: uuidv4() };
	});

	MainLogger.debug('CharacterHandlers', 'All character handlers registered');
}
