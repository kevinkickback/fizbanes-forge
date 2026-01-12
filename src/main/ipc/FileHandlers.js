import { dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MainLogger } from '../Logger.js';
import { IPC_CHANNELS } from './channels.js';

export function registerFileHandlers(windowManager) {
	MainLogger.info('FileHandlers', 'Registering file handlers');

	// Select folder
	ipcMain.handle(IPC_CHANNELS.FILE_SELECT_FOLDER, async () => {
		try {
			const result = await dialog.showOpenDialog(windowManager.mainWindow, {
				properties: ['openDirectory', 'createDirectory'],
			});

			if (result.canceled) {
				return { success: false, canceled: true };
			}

			return { success: true, path: result.filePaths[0] };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Select folder failed:', error);
			return { success: false, error: error.message };
		}
	});

	// Read JSON file
	ipcMain.handle(IPC_CHANNELS.FILE_READ_JSON, async (_event, filePath) => {
		try {
			const content = await fs.readFile(filePath, 'utf8');
			const data = JSON.parse(content);
			return { success: true, data };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Read JSON failed:', error);
			return { success: false, error: error.message };
		}
	});

	// Write JSON file
	ipcMain.handle(
		IPC_CHANNELS.FILE_WRITE_JSON,
		async (_event, filePath, data) => {
			try {
				await fs.writeFile(filePath, JSON.stringify(data, null, 2));
				return { success: true };
			} catch (error) {
				MainLogger.error('FileHandlers', 'Write JSON failed:', error);
				return { success: false, error: error.message };
			}
		},
	);

	// Check if file exists
	ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (_event, filePath) => {
		try {
			await fs.access(filePath);
			return { success: true, exists: true };
		} catch (error) {
			MainLogger.error('FileHandlers', 'File exists check failed:', error);
			return { success: true, exists: false };
		}
	});

	// Open file with default application
	ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (_event, filePath) => {
		try {
			await shell.openPath(filePath);
			return { success: true };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Open file failed:', error);
			return { success: false, error: error.message };
		}
	});

	// List portrait image files from a directory
	ipcMain.handle(IPC_CHANNELS.PORTRAITS_LIST, async (_event, dirPath) => {
		try {
			if (!dirPath || typeof dirPath !== 'string') {
				return { success: false, error: 'Invalid directory path' };
			}

			const entries = await fs.readdir(dirPath, { withFileTypes: true });
			const allowed = new Set(['.webp', '.png', '.jpg', '.jpeg']);
			const files = entries
				.filter((d) => d.isFile())
				.map((d) => path.join(dirPath, d.name))
				.filter((p) => allowed.has(path.extname(p).toLowerCase()));

			return { success: true, files };
		} catch (error) {
			MainLogger.error('FileHandlers', 'Portraits list failed:', error);
			return { success: false, error: error.message };
		}
	});

	// Save portrait image from data URL or buffer to portraits directory
	ipcMain.handle(
		IPC_CHANNELS.PORTRAITS_SAVE,
		async (_event, portraitsDir, imageData, fileName) => {
			try {
				if (!portraitsDir || !imageData || !fileName) {
					return {
						success: false,
						error: 'Missing required parameters',
					};
				}

				// Ensure the portraits directory exists
				await fs.mkdir(portraitsDir, { recursive: true });

				// Determine file extension from fileName or default to .png
				let extension = path.extname(fileName).toLowerCase();
				if (!extension) {
					extension = '.png';
				}

				// Sanitize filename - remove path separators and keep only alphanumeric, dash, underscore
				const baseName = path
					.basename(fileName, extension)
					.replace(/[^a-z0-9_-]/gi, '_');
				const finalFileName = `${baseName}${extension}`;
				const filePath = path.join(portraitsDir, finalFileName);

				// Handle data URL format (from FileReader.readAsDataURL)
				let buffer;
				if (typeof imageData === 'string' && imageData.startsWith('data:')) {
					const base64Data = imageData.split(',')[1];
					if (!base64Data) {
						return {
							success: false,
							error: 'Invalid image data URL',
						};
					}
					buffer = Buffer.from(base64Data, 'base64');
				} else if (typeof imageData === 'string') {
					// Assume it's base64
					buffer = Buffer.from(imageData, 'base64');
				} else if (Buffer.isBuffer(imageData)) {
					buffer = imageData;
				} else {
					return {
						success: false,
						error: 'Invalid image data format',
					};
				}

				await fs.writeFile(filePath, buffer);
				MainLogger.info('FileHandlers', 'Portrait saved:', filePath);

				return {
					success: true,
					filePath,
					fileName: finalFileName,
				};
			} catch (error) {
				MainLogger.error('FileHandlers', 'Save portrait failed:', error);
				return { success: false, error: error.message };
			}
		},
	);

	MainLogger.info('FileHandlers', 'All file handlers registered');
}
